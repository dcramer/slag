import { describe, expect, it, vi } from 'vitest';
import { RunnerTracker } from '../src/audio/actions';
import { collectEmitters, propTransients } from '../src/audio/emitters';
import { AudioEngine } from '../src/audio/engine';
import { FakeAudioContext } from '../src/audio/fake';
import { MAX_MUSIC_VOICES, MAX_SFX_VOICES, Mixer } from '../src/audio/mixer';
import { composeSong } from '../src/audio/music/compose';
import { INSTRUMENTS, type InstId } from '../src/audio/music/instruments';
import { SFX, SFX_NAMES } from '../src/audio/sfx';
import { WebAudioSystem } from '../src/audio/system';
import { DEFAULT_VOLUMES } from '../src/audio/volumes';
import { Rng } from '../src/core/rng';
import { Match } from '../src/game/match';
import { generateLevel } from '../src/gen/level';
import { type Archetype, generateProp } from '../src/gen/props';
import { canPlace, type PlacedProp } from '../src/sim/props';
import { RunWorld } from '../src/sim/run';
import { type InputFrame, NO_INPUT } from '../src/sim/types';
import { THEME_IDS } from '../src/themes';

const VARIANTS = ['', 'soft', 'stone', 'metal', 'wood', 'ice', 'goo', 'water', 'slag', 'acid', 'void', 'tar', 'go', 'urgent', 'off', 'magic'];

function placeKinds(level: ReturnType<typeof generateLevel>, kinds: Archetype[]): PlacedProp[] {
  const placed: PlacedProp[] = [];
  kinds.forEach((k, i) => {
    const def = generateProp(new Rng(31 + i * 17), k, `t${i}`);
    for (let n = 0; n < 4000; n++) {
      const tx = 6 + ((i * 7 + n * 13) % (level.w - 12));
      const ty = 3 + ((i * 5 + n * 7) % (level.h - 6));
      if (canPlace(level, placed, def, 0, tx, ty)) {
        placed.push({ uid: 100 + i, def, owner: 0, tx, ty, rot: 0 });
        return;
      }
    }
  });
  return placed;
}

describe('audio engine on a strict fake context', () => {
  it('every SFX patch and variant schedules valid automation', () => {
    const ctx = new FakeAudioContext();
    const e = new AudioEngine(ctx.asContext(), DEFAULT_VOLUMES);
    for (const name of SFX_NAMES) {
      for (const variant of VARIANTS) {
        ctx.advance(0.5); // clear throttles and voices
        expect(() => e.play({ name, variant, amount: 0.7, notes: [60, 64, 67, 72], x: 100, y: 100 }, { x: 384, y: 216, zoom: 1, runners: [] })).not.toThrow();
      }
    }
    expect(e.mixer.stats.played).toBeGreaterThan(SFX_NAMES.length * 4);
  });

  it('every instrument plays a note', () => {
    const ctx = new FakeAudioContext();
    const m = new Mixer(ctx.asContext(), DEFAULT_VOLUMES);
    for (const id of Object.keys(INSTRUMENTS) as InstId[]) {
      const v = m.voice({ bus: 'music', prio: 1, gain: 0.2 })!;
      expect(() => INSTRUMENTS[id](v, 0.1, 220, 0.4), id).not.toThrow();
      expect(v.end, id).toBeGreaterThan(0.1);
      ctx.advance(3);
      expect(v.dead, `${id} releases its voice`).toBe(true);
    }
  });

  it('voice limiter bounds live voices and respects priority', () => {
    const ctx = new FakeAudioContext();
    const m = new Mixer(ctx.asContext(), DEFAULT_VOLUMES);
    const make = (prio: number) => {
      const v = m.voice({ bus: 'sfx', prio, gain: 0.1 });
      v?.osc('sine', 440, 0, 2, v.out);
      return v;
    };
    for (let i = 0; i < MAX_SFX_VOICES; i++) make(3);
    expect(make(0)).toBeNull();
    expect(m.stats.dropped).toBe(1);
    expect(make(3)).not.toBeNull();
    expect(m.stats.stolen).toBe(1);
    expect(m.liveVoices('sfx')).toBeLessThanOrEqual(MAX_SFX_VOICES);
  });

  it('music schedules every theme ahead of time and stays within its voice budget', () => {
    for (const th of THEME_IDS) {
      const ctx = new FakeAudioContext();
      const e = new AudioEngine(ctx.asContext(), DEFAULT_VOLUMES);
      e.music.setSong(composeSong(42, th));
      e.music.setMix('drive', 0.01);
      let peak = 0;
      for (let i = 0; i < 60 * 8; i++) {
        e.music.pump(ctx.currentTime);
        peak = Math.max(peak, e.mixer.liveVoices('music'));
        ctx.advance(1 / 60);
      }
      expect(e.music.current!.scheduled, th).toBeGreaterThan(40);
      expect(peak, th).toBeLessThanOrEqual(MAX_MUSIC_VOICES);
    }
  });

  it('crossfades songs and plays stingers without throwing', () => {
    const ctx = new FakeAudioContext();
    const e = new AudioEngine(ctx.asContext(), DEFAULT_VOLUMES);
    e.music.setSong(composeSong(1, 'castle'));
    e.music.pump(0);
    e.music.roundSting();
    ctx.advance(1);
    e.music.setSong(composeSong(2, 'rooftops'));
    e.music.fanfare();
    for (let i = 0; i < 400; i++) {
      e.music.pump(ctx.currentTime);
      ctx.advance(1 / 60);
    }
    expect(e.music.song!.theme).toBe('rooftops');
  });
});

describe('derived sounds', () => {
  it('hazard loops and cycle transients follow the sim', () => {
    const level = generateLevel(5);
    const placed = placeKinds(level, ['laser', 'flamer', 'tesla', 'saw', 'fan', 'crusher', 'flail']);
    const run = new RunWorld(level, placed, [0]);
    const kinds = new Set<string>();
    const cues = new Map<string, number>();
    for (let f = 0; f < 60 * 12; f++) {
      run.step([NO_INPUT]);
      for (const e of collectEmitters(run, run.frame)) {
        kinds.add(e.kind);
        expect(Number.isFinite(e.x) && Number.isFinite(e.y) && e.level >= 0 && e.level <= 1).toBe(true);
      }
      for (const c of propTransients(run, run.frame)) cues.set(c.name, (cues.get(c.name) ?? 0) + 1);
    }
    const hasSaw = placed.some((p) => p.def.modules.some((m) => m.type === 'swinger' && m.head === 'saw'));
    if (hasSaw) expect(kinds.has('saw')).toBe(true);
    for (const k of ['laserCharge', 'laserFire', 'flame', 'tesla', 'fan']) expect(kinds.has(k), k).toBe(true);
    for (const c of ['laser-fire', 'flame-ignite', 'tesla-arc', 'piston-slam']) expect(cues.get(c) ?? 0, c).toBeGreaterThan(0);
  });

  it('tracks jumps and landings from runner state', () => {
    const level = generateLevel(5);
    const run = new RunWorld(level, [], [0]);
    const tr = new RunnerTracker();
    const seen = new Set<string>();
    // Hop in place after the countdown, then run off.
    const inp = (f: number): InputFrame => ({ ...NO_INPUT, right: f > 200, jump: f < 200 && f % 40 < 20, jumpPressed: f < 200 && f % 40 === 2 });
    for (let f = 0; f < 60 * 6; f++) {
      run.step([inp(f)]);
      for (const c of tr.update(run, 'soft', () => 1)) seen.add(c.name);
    }
    expect(seen.has('jump')).toBe(true);
    expect(seen.has('land')).toBe(true);
    expect(seen.has('step')).toBe(true);
  });
});

describe('WebAudioSystem', () => {
  const store = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it('degrades to silence without WebAudio', () => {
    const a = new WebAudioSystem({ createContext: () => null, storage: store() });
    a.unlock();
    const m = new Match(3);
    expect(() => {
      a.handle([{ type: 'spring', x: 0, y: 0 }], m);
      a.update(m, 0);
      a.setVolumes({ sfx: 0.2 });
    }).not.toThrow();
    expect(a.volumes.sfx).toBe(0.2);
  });

  it('is silent until unlocked, and persists volumes', () => {
    const ctx = new FakeAudioContext();
    const s = store();
    const a = new WebAudioSystem({ createContext: () => ctx.asContext(), storage: s });
    const m = new Match(3);
    a.update(m, 0);
    expect(ctx.nodes).toBe(1); // only the fake's destination
    a.setVolumes({ music: 0.3 });
    expect(new WebAudioSystem({ createContext: () => null, storage: s }).volumes.music).toBe(0.3);
  });

  it('plays the title tune off the menus, hands over to a lobby and takes it back', () => {
    vi.useFakeTimers();
    try {
      const ctx = new FakeAudioContext();
      const a = new WebAudioSystem({ createContext: () => ctx.asContext(), storage: store() });
      a.menu();
      expect(ctx.nodes).toBe(1); // nothing before the unlock gesture
      a.unlock();
      const music = a.engine!.music;
      expect(music.song!.theme).toBe('title');
      // No game loop pumps the menus: the system keeps the title tune scheduled itself.
      ctx.advance(1);
      vi.advanceTimersByTime(1000);
      expect(music.current!.scheduled).toBeGreaterThan(0);
      const m = new Match(3);
      a.update(m, 0);
      expect(music.song!.theme).toBe(m.level.theme.id);
      a.menu();
      expect(music.song!.theme).toBe('title');
      a.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('plays a whole match: bounded voices, loops and valid params', () => {
    const ctx = new FakeAudioContext();
    const a = new WebAudioSystem({ createContext: () => ctx.asContext(), storage: store() });
    a.unlock();
    const m = new Match(77);
    m.rules = { ...m.rules, raceSeconds: 30, targetScore: 1 };
    const devices = ['kb1', 'kb2', 'pad0', 'pad1', 'pad2', 'pad3', 'pad4', 'pad5'];
    for (const d of devices) m.join(d);
    m.startMatch();
    m.placed.push(...placeKinds(m.level, ['saw', 'laser', 'flamer', 'tesla', 'fan', 'launcher', 'crusher', 'crumble', 'spring']));
    m.startRun();
    let maxLoops = 0;
    let maxSfx = 0;
    for (let f = 0; f < 60 * 40 && m.phase !== 'victory'; f++) {
      const inputs = Object.fromEntries(
        devices.map((d, i) => [
          d,
          { ...NO_INPUT, right: true, jump: (f + i * 7) % 40 < 15, jumpPressed: (f + i * 7) % 40 === 0, confirmPressed: m.phase === 'score' && f % 30 === 0 },
        ]),
      );
      m.step(inputs);
      a.handle(m.drainEvents(), m);
      a.update(m, f * 16.7);
      ctx.advance(1 / 60);
      maxLoops = Math.max(maxLoops, a.engine!.loops.live);
      maxSfx = Math.max(maxSfx, a.engine!.mixer.liveVoices('sfx'));
    }
    const st = a.engine!.mixer.stats;
    expect(st.played).toBeGreaterThan(50);
    expect(maxSfx).toBeLessThanOrEqual(MAX_SFX_VOICES);
    expect(maxLoops).toBeLessThanOrEqual(12);
    expect(maxLoops).toBeGreaterThan(0);
    expect(a.engine!.music.current!.scheduled).toBeGreaterThan(100);
    expect(ctx.maxParam).toBeLessThan(1e5);
    expect(SFX.explosion.gain).toBeLessThan(1);
  });
});
