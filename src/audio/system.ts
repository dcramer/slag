import type { Match } from '../game/match';
import { RUN_COUNTDOWN, TILE } from '../sim/constants';
import type { GameEvent } from '../sim/types';
import { RunnerTracker } from './actions';
import { type Cue, type CueEnv, cuesForEvent, GROUND_TONE, slotPitch } from './cues';
import { collectEmitters, type Emitter, type PropCue, propTransients, weatherEmitters } from './emitters';
import { AudioEngine } from './engine';
import type { AudioSystem, UiCue } from './index';
import { composeSong } from './music/compose';
import type { MixName } from './music/player';
import { listenerFor } from './spatial';
import { defaultStorage, type KV, loadVolumes, sanitizeVolumes, saveVolumes, type Volumes } from './volumes';

/**
 * The game-facing audio system: turns Match state and sim events into
 * cues for the AudioEngine. Presentation only — it reads the match and
 * never writes to it.
 *
 * Besides sim events it derives sounds from state diffs between rendered
 * frames: player actions (jump/land/wall-jump…), prop cycle edges, the
 * race countdown, timer warnings, score tallies and lobby/menu changes.
 */

export interface AudioOptions {
  /** Context factory (tests inject a fake; returns null when WebAudio is unavailable). */
  createContext?: () => BaseAudioContext | null;
  storage?: KV | null;
}

function browserContext(): BaseAudioContext | null {
  const w = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const C = w.AudioContext ?? w.webkitAudioContext;
  if (!C) return null;
  try {
    return new C({ latencyHint: 'interactive' });
  } catch {
    return null;
  }
}

/** Place → prop material for the placement thunk. */
const PLACE_VARIANT: Record<string, string> = { laser: 'magic', tesla: 'magic', bomb: 'magic' };
const WOODEN = new Set(['platform', 'crumble', 'spring', 'fan']);

export class WebAudioSystem implements AudioSystem {
  volumes: Volumes;
  engine: AudioEngine | null = null;
  private ctx: BaseAudioContext | null = null;
  private storage: KV | null;
  private createContext: () => BaseAudioContext | null;
  private failed = false;

  // --- frame-diff state
  private songKey = '';
  private tracker = new RunnerTracker();
  private run: unknown = null;
  private runFrame = -1;
  private loopsLive = false;
  private lastSecs = -1;
  private tally = -1;
  private tallyAt = 0;
  private lobby = new Map<number, { ready: boolean; char: number }>();
  private lobbySeed = -1;
  private hover = new Map<number, number>();
  private rot = new Map<number, number>();
  private victoryAt = -1;
  private emitters: Emitter[] = [];
  private transients: PropCue[] = [];
  private previewAt = 0;

  constructor(opts: AudioOptions = {}) {
    this.storage = opts.storage === undefined ? defaultStorage() : opts.storage;
    this.createContext = opts.createContext ?? browserContext;
    this.volumes = loadVolumes(this.storage);
  }

  /** True when sound can actually be scheduled right now. */
  get running(): boolean {
    return !!this.engine && this.ctx?.state === 'running';
  }

  unlock(): void {
    if (!this.ctx && !this.failed) {
      try {
        this.ctx = this.createContext();
        if (this.ctx) {
          this.engine = new AudioEngine(this.ctx, this.volumes);
          this.watchVisibility();
        } else this.failed = true;
      } catch {
        this.failed = true;
        this.ctx = null;
        this.engine = null;
      }
    }
    const c = this.ctx as AudioContext | null;
    if (c && c.state === 'suspended' && typeof c.resume === 'function' && !this.hidden()) c.resume().catch(() => {});
  }

  private hidden(): boolean {
    return typeof document !== 'undefined' && document.visibilityState === 'hidden';
  }

  /** Suspend while the tab is hidden: rAF stops, so loops would otherwise drone on. */
  private watchVisibility() {
    if (typeof document === 'undefined') return;
    document.addEventListener('visibilitychange', () => {
      const c = this.ctx as AudioContext | null;
      if (!c || typeof c.suspend !== 'function') return;
      if (this.hidden()) c.suspend().catch(() => {});
      else c.resume().catch(() => {});
    });
  }

  setVolumes(v: Partial<Volumes>): void {
    this.volumes = sanitizeVolumes({ ...this.volumes, ...v });
    saveVolumes(this.volumes, this.storage);
    this.engine?.mixer.setVolumes(this.volumes);
    // Audible preview while dragging the effects/master slider.
    if (this.running && (v.sfx !== undefined || v.master !== undefined)) {
      const now = this.ctx!.currentTime;
      if (now - this.previewAt > 0.09) {
        this.previewAt = now;
        this.engine!.play({ name: 'ui-tick' }, null);
      }
    }
  }

  ui(cue: UiCue): void {
    if (!this.running) return;
    const e = this.engine!;
    if (cue === 'hover') e.play({ name: 'ui-hover' }, null);
    else if (cue === 'click') e.play({ name: 'ui-click' }, null);
    else e.play({ name: 'ui-toggle', variant: cue === 'open' ? 'on' : 'off', pitch: 1.2 }, null);
  }

  private env(m: Match): CueEnv {
    const music = this.engine!.music;
    return {
      theme: m.level.theme.id,
      liquid: m.level.theme.liquid.kind,
      pitchOf: slotPitch,
      note: (d, o) => music.note(d, o),
      placedVariant: (slot) => {
        for (let i = m.placed.length - 1; i >= 0; i--) {
          const a = m.placed[i].def.archetype;
          if (m.placed[i].owner === slot) return PLACE_VARIANT[a] ?? (WOODEN.has(a) ? 'wood' : 'metal');
        }
        return 'magic'; // bombs leave nothing behind
      },
      propPos: (uid) => {
        const r = m.run?.resolved.find((x) => x.pp.uid === uid);
        const b = r?.mods.find((x) => x.type === 'body');
        if (b?.type !== 'body' || !b.cells.length) return null;
        let sx = 0;
        let sy = 0;
        for (const [cx, cy] of b.cells) {
          sx += cx;
          sy += cy;
        }
        return { x: (sx / b.cells.length + 0.5) * TILE, y: (sy / b.cells.length + 0.5) * TILE };
      },
    };
  }

  handle(events: readonly GameEvent[], match: Match): void {
    if (!this.running || !events.length) return;
    this.syncSong(match);
    const e = this.engine!;
    const env = this.env(match);
    const L = listenerFor(match);
    for (const ev of events) {
      for (const c of cuesForEvent(ev, env)) e.play(c, L);
      if (ev.type === 'phase') this.onPhase(ev.phase, match);
    }
  }

  private onPhase(phase: string, m: Match) {
    const music = this.engine!.music;
    if (phase === 'pick') music.roundSting();
    else if (phase === 'victory') {
      music.fanfare();
      this.victoryAt = m.frame;
    }
  }

  /** Start (or crossfade to) the song for the current level. */
  private syncSong(m: Match) {
    const key = `${m.level.seed}:${m.level.theme.id}`;
    if (key === this.songKey) return;
    const first = this.songKey === '';
    this.songKey = key;
    this.engine!.music.setSong(composeSong(m.level.seed, m.level.theme.id), first ? 2.5 : 1.6);
  }

  update(match: Match, _nowMs: number): void {
    if (!this.running) return;
    const e = this.engine!;
    this.syncSong(match);
    const L = listenerFor(match);
    const play = (c: Cue) => e.play(c, L);

    this.updatePhaseCues(match, play);
    e.music.setMix(this.mixFor(match), match.phase === 'run' ? 0.15 : 0.6);

    const run = match.phase === 'run' ? match.run : null;
    if (run) {
      if (run !== this.run) {
        this.run = run;
        this.runFrame = -1;
      }
      const f0 = this.runFrame;
      const f1 = run.frame;
      // Countdown beeps on the HUD's 3-2-1, then GO (+ the music drop).
      const third = RUN_COUNTDOWN / 3;
      for (const th of [0, third, 2 * third]) if (f0 < th && f1 >= th) play({ name: 'countdown', notes: [e.music.note(4, 0)] });
      if (f0 < RUN_COUNTDOWN && f1 >= RUN_COUNTDOWN) {
        play({ name: 'countdown', variant: 'go', notes: [e.music.note(0, 1), e.music.note(2, 1), e.music.note(4, 1)] });
        e.music.restart();
      }
      for (const c of this.tracker.update(run, GROUND_TONE[match.level.theme.id], slotPitch)) play(c);
      this.transients.length = 0;
      for (let f = Math.max(f0 + 1, f1 - 4); f <= f1 && f0 >= 0; f++) propTransients(run, f, this.transients);
      for (const c of this.transients) play({ name: c.name, x: c.x, y: c.y, pitch: c.pitch });
      this.emitters.length = 0;
      collectEmitters(run, f1, this.emitters);
      weatherEmitters(match.level, f1, L.x, L.y, this.emitters);
      e.loops.update(this.emitters, L);
      this.loopsLive = true;
      this.runFrame = f1;
    } else {
      this.run = null;
      this.emitters.length = 0;
      // You pick and build with the weather already in your ears.
      if (match.phase === 'pick' || match.phase === 'place') weatherEmitters(match.level, -1, L.x, L.y, this.emitters);
      if (this.emitters.length) {
        e.loops.update(this.emitters, L);
        this.loopsLive = true;
      } else if (this.loopsLive) {
        e.loops.silence(L);
        this.loopsLive = e.loops.live > 0;
      }
    }
    e.music.pump(this.ctx!.currentTime);
  }

  private mixFor(m: Match): MixName {
    switch (m.phase) {
      case 'lobby':
      case 'pick':
        return 'calm';
      case 'place':
        return 'build';
      case 'run':
        return m.run && m.run.frame < RUN_COUNTDOWN ? 'countdown' : 'drive';
      case 'score':
        return 'score';
      case 'victory':
        // Fanfare first, then the song comes back gently.
        return this.victoryAt >= 0 && m.frame - this.victoryAt < 60 * 4 ? this.engine!.music.mix : 'calm';
    }
  }

  /** Timer ticks, score tally, lobby and cursor feedback, all from state diffs. */
  private updatePhaseCues(m: Match, play: (c: Cue) => void) {
    const e = this.engine!;
    // Last seconds of a timed phase.
    let secs = -1;
    let limit = 0;
    if (m.phase === 'run' && m.run && Number.isFinite(m.run.timeLeft) && m.run.frame >= RUN_COUNTDOWN) {
      secs = Math.ceil(m.run.timeLeft / 60);
      limit = 10;
    } else if ((m.phase === 'pick' || m.phase === 'place') && Number.isFinite(m.phaseTimeLeft)) {
      secs = Math.ceil(m.phaseTimeLeft / 60);
      limit = 5;
    }
    if (secs > 0 && secs <= limit && secs !== this.lastSecs) play({ name: 'ui-tick', variant: 'urgent', pitch: secs <= 3 ? 1.12 : 1 });
    this.lastSecs = secs;

    // Score tally ticks follow the HUD's bar animation.
    if (m.phase === 'score') {
      const anim = Math.min(1, Math.max(0, (m.phaseFrame - 20) / 60));
      let shown = 0;
      for (const p of m.players) {
        const prev = m.prevScores.get(p.slot) ?? 0;
        shown += Math.round(prev + (p.score - prev) * anim);
      }
      const now = this.ctx!.currentTime;
      if (this.tally < 0) this.tally = shown;
      else if (shown !== this.tally && now - this.tallyAt > 0.045) {
        this.tally = shown;
        this.tallyAt = now;
        play({ name: 'ui-tick', pitch: 1 + anim * 0.6 });
      }
    } else this.tally = -1;

    // Lobby: joins, ready toggles, character / level rerolls.
    if (m.phase === 'lobby') {
      for (const p of m.players) {
        const was = this.lobby.get(p.slot);
        const pitch = slotPitch(p.slot);
        if (!was) {
          const semi = Math.round(12 * Math.log2(pitch));
          play({ name: 'join', pitch, notes: [e.music.note(0, 0) + semi, e.music.note(4, 0) + semi] });
        } else {
          if (was.ready !== p.ready) play({ name: 'ui-toggle', variant: p.ready ? 'on' : 'off', pitch });
          if (was.char !== p.character.seed) play({ name: 'reroll', pitch });
        }
        this.lobby.set(p.slot, { ready: p.ready, char: p.character.seed });
      }
      if (this.lobbySeed >= 0 && this.lobbySeed !== m.seed) play({ name: 'whoosh' });
      this.lobbySeed = m.seed;
    } else {
      this.lobby.clear();
      for (const p of m.players) this.lobby.set(p.slot, { ready: false, char: p.character.seed });
      this.lobbySeed = -1;
    }

    // Pick: a soft tick as each cursor moves onto a new card. Place: rotate clicks.
    for (const p of m.players) {
      if (m.phase === 'pick' && p.claim < 0) {
        const i = m.crateItemAt(p.cursor.x, p.cursor.y);
        if (i >= 0 && i !== (this.hover.get(p.slot) ?? -1)) play({ name: 'ui-hover', pitch: slotPitch(p.slot) });
        this.hover.set(p.slot, i);
      } else this.hover.delete(p.slot);
      if (m.phase === 'place' && !p.placed) {
        const was = this.rot.get(p.slot);
        if (was !== undefined && was !== p.rot) play({ name: 'ui-click', pitch: 1.25 });
        this.rot.set(p.slot, p.rot);
      } else this.rot.delete(p.slot);
    }
  }
}
