import type { Cue } from './cues';
import { LoopBank } from './loops';
import { Mixer, Throttle } from './mixer';
import { MusicDirector } from './music/player';
import { SFX } from './sfx';
import { type Listener, placeOneShot } from './spatial';
import type { Volumes } from './volumes';

/**
 * Context-agnostic audio core: mixer + SFX player + hazard loops + music.
 * Knows nothing about Match; `WebAudioSystem` feeds it cues. Works with any
 * BaseAudioContext, which is how levels are verified offline.
 */
export class AudioEngine {
  readonly mixer: Mixer;
  readonly music: MusicDirector;
  readonly loops: LoopBank;
  private throttle = new Throttle();

  constructor(
    readonly ctx: BaseAudioContext,
    volumes: Volumes,
  ) {
    this.mixer = new Mixer(ctx, volumes);
    this.music = new MusicDirector(this.mixer);
    this.loops = new LoopBank(ctx, this.mixer.sfxBus);
  }

  /** Play one cue (positioned relative to `L` when it has a position). Returns false if throttled/dropped. */
  play(cue: Cue, L: Listener | null, at = this.ctx.currentTime): boolean {
    const def = SFX[cue.name];
    const now = this.ctx.currentTime;
    const t = Math.max(now, at) + (cue.delay ?? 0);
    if (!this.throttle.allow(cue.variant ? `${cue.name}:${cue.variant}` : cue.name, t, def.max, def.window)) return false;
    let gain = def.gain * (cue.gain ?? 1);
    let pan = 0;
    if (L && cue.x !== undefined && cue.y !== undefined) {
      const s = placeOneShot(cue.x, cue.y, L);
      gain *= s.gain;
      pan = s.pan;
    }
    const v = this.mixer.voice({ bus: 'sfx', prio: def.prio, gain, pan, reverb: def.reverb }, t);
    if (!v) return false;
    // A hair of random detune keeps repeated non-musical hits from sounding robotic.
    const pitch = (cue.pitch ?? 1) * (cue.notes ? 1 : 1 + (Math.random() - 0.5) * 0.05);
    def.play(v, t, { pitch, variant: cue.variant ?? '', amount: cue.amount ?? 0.5, notes: cue.notes ?? [] });
    if (def.duck) this.mixer.duckMusic(def.duck, 0.7);
    return true;
  }
}
