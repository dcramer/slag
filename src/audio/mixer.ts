import { FLOOR, Voice } from './synth';
import { sliderGain, type Volumes } from './volumes';

/**
 * Mixer graph:
 *
 *   sfx voices ──► [panner] ──► sfxBus ───────┐
 *        └──► send ──► reverb (convolver) ──► echo ──► reverbOut ─┤
 *   music tracks ─► duck ─► musicBus ─────────┤
 *                                             ▼
 *              master ─► 28 Hz highpass ─► glue comp ─► limiter ─► soft clip ─► destination
 *
 * The voice limiter keeps the number of live SFX voices bounded (8 players
 * and a level full of hazards must not explode CPU or clip): a new voice
 * steals the oldest voice of lower-or-equal priority, or is dropped.
 */

/** Internal trims so the sliders' "1.0" sits at a sane level. */
const MUSIC_TRIM = 1.6;
const SFX_TRIM = 1;
/** Max simultaneous SFX / music voices. */
export const MAX_SFX_VOICES = 36;
export const MAX_MUSIC_VOICES = 56;

export interface VoiceOpts {
  bus: 'sfx' | 'music';
  /** 0 (ambient) … 3 (must play). */
  prio: number;
  gain: number;
  pan?: number;
  /** Reverb send 0..1. */
  reverb?: number;
  /** Explicit destination (music track buses); overrides `bus` routing but still counts against its budget. */
  dest?: AudioNode;
}

/** Soft-clip curve: linear to ±0.8, then a smooth knee that never exceeds ±0.98. Exported for tests. */
export function softClipCurve(n = 2048): Float32Array<ArrayBuffer> {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= 0.8 ? a : 0.8 + 0.18 * Math.tanh((a - 0.8) / 0.18);
    c[i] = Math.sign(x) * y;
  }
  return c;
}

/** Stereo reverb impulse: decaying noise that darkens over time. */
function impulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const k = 0.55 - 0.45 * t; // one-pole lowpass coefficient: brighter early, darker tail
      lp += (Math.random() * 2 - 1 - lp) * k;
      d[i] = lp * (1 - t) ** 2.4 * (i < ctx.sampleRate * 0.008 ? i / (ctx.sampleRate * 0.008) : 1);
    }
  }
  return buf;
}

export class Mixer {
  readonly master: GainNode;
  readonly sfxBus: GainNode;
  readonly musicBus: GainNode;
  /** Music ducking (explosions, stingers). */
  readonly duck: GainNode;
  readonly reverbIn: GainNode;
  private reverbOut: GainNode;
  private echoFb: GainNode;
  private echoWet: GainNode;
  private echoDelay: DelayNode;
  private voices: { sfx: Voice[]; music: Voice[] } = { sfx: [], music: [] };
  private prios = new WeakMap<Voice, number>();
  /** Voices dropped or stolen since start (diagnostics/tests). */
  stats = { dropped: 0, stolen: 0, played: 0 };

  constructor(
    readonly ctx: BaseAudioContext,
    volumes: Volumes,
    dest: AudioNode = ctx.destination,
  ) {
    const c = ctx;
    this.master = c.createGain();
    const glue = c.createDynamicsCompressor();
    glue.threshold.value = -14;
    glue.knee.value = 10;
    glue.ratio.value = 2.5;
    glue.attack.value = 0.008;
    glue.release.value = 0.25;
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.12;
    const clip = c.createWaveShaper();
    clip.curve = softClipCurve();
    clip.oversample = '2x';
    // Subsonic cut: pitch-drop booms sweep below 30 Hz, which only eats limiter headroom.
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 28;
    hp.Q.value = 0.6;
    this.master.connect(hp).connect(glue).connect(limiter).connect(clip).connect(dest);

    this.sfxBus = c.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus = c.createGain();
    this.duck = c.createGain();
    this.duck.connect(this.musicBus).connect(this.master);

    // Shared reverb (+ an optional feedback echo for caves / halls).
    this.reverbIn = c.createGain();
    const conv = c.createConvolver();
    conv.buffer = impulse(c, 1.9);
    this.reverbOut = c.createGain();
    this.reverbOut.gain.value = 0.32;
    this.reverbIn.connect(conv).connect(this.reverbOut).connect(this.master);
    this.echoDelay = c.createDelay(1);
    this.echoDelay.delayTime.value = 0.32;
    this.echoFb = c.createGain();
    this.echoFb.gain.value = 0.3;
    this.echoWet = c.createGain();
    this.echoWet.gain.value = 0;
    const echoLp = c.createBiquadFilter();
    echoLp.type = 'lowpass';
    echoLp.frequency.value = 2200;
    this.reverbIn.connect(this.echoDelay);
    this.echoDelay.connect(echoLp).connect(this.echoFb).connect(this.echoDelay);
    echoLp.connect(this.echoWet).connect(this.master);

    this.setVolumes(volumes, true);
  }

  setVolumes(v: Volumes, immediate = false): void {
    const t = this.ctx.currentTime;
    const set = (p: AudioParam, val: number) => {
      if (immediate) p.value = val;
      else {
        p.cancelScheduledValues(t);
        p.setTargetAtTime(val, t, 0.04);
      }
    };
    set(this.master.gain, sliderGain(v.master));
    set(this.musicBus.gain, sliderGain(v.music) * MUSIC_TRIM);
    set(this.sfxBus.gain, sliderGain(v.sfx) * SFX_TRIM);
  }

  /** Per-theme space: reverb return level and echo amount / time. */
  setSpace(reverb: number, echo: number, echoTime: number): void {
    const t = this.ctx.currentTime;
    this.reverbOut.gain.setTargetAtTime(reverb, t, 0.5);
    this.echoWet.gain.setTargetAtTime(echo, t, 0.5);
    this.echoDelay.delayTime.setTargetAtTime(echoTime, t, 0.5);
  }

  /** Dip the music by `amount` (0..1) and recover over `dur` seconds. */
  duckMusic(amount: number, dur: number): void {
    const t = this.ctx.currentTime;
    const g = this.duck.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(Math.max(FLOOR, 1 - amount), t + 0.03);
    g.setTargetAtTime(1, t + 0.03 + dur * 0.3, dur / 3);
  }

  /** Allocate a voice, or null if the budget is full of more important sounds. */
  voice(o: VoiceOpts, t = this.ctx.currentTime): Voice | null {
    const now = this.ctx.currentTime;
    const list = this.voices[o.bus];
    const max = o.bus === 'sfx' ? MAX_SFX_VOICES : MAX_MUSIC_VOICES;
    // Purge voices that have finished (or will before this one starts).
    for (let i = list.length - 1; i >= 0; i--) if (list[i].dead || list[i].end <= now) list.splice(i, 1);
    if (list.length >= max) {
      let victim = -1;
      for (let i = 0; i < list.length; i++) {
        if ((this.prios.get(list[i]) ?? 0) <= o.prio && (victim < 0 || list[i].t < list[victim].t)) victim = i;
      }
      if (victim < 0) {
        this.stats.dropped++;
        return null;
      }
      list[victim].kill(now);
      list.splice(victim, 1);
      this.stats.stolen++;
    }
    const v = new Voice(this.ctx, t, o.gain);
    this.prios.set(v, o.prio);
    let tail: AudioNode = v.out;
    if (o.pan !== undefined && o.pan !== 0) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, o.pan));
      v.out.connect(p);
      v.own(p);
      tail = p;
    }
    tail.connect(o.dest ?? (o.bus === 'sfx' ? this.sfxBus : this.duck));
    if (o.reverb && o.reverb > 0) {
      const s = this.ctx.createGain();
      s.gain.value = o.reverb;
      tail.connect(s).connect(this.reverbIn);
      v.own(s);
    }
    list.push(v);
    this.stats.played++;
    return v;
  }

  /** Live voices on a bus (diagnostics/tests). */
  liveVoices(bus: 'sfx' | 'music'): number {
    const now = this.ctx.currentTime;
    return this.voices[bus].filter((v) => !v.dead && v.end > now).length;
  }
}

/** Rate limiter for repeated cues (8 players landing at once, projectile spam). Pure; time in seconds. */
export class Throttle {
  private hist = new Map<string, number[]>();

  /** Allow at most `max` plays of `key` per `window` seconds. */
  allow(key: string, now: number, max: number, window: number): boolean {
    let h = this.hist.get(key);
    if (!h) this.hist.set(key, (h = []));
    while (h.length && now - h[0] >= window) h.shift();
    if (h.length >= max) return false;
    h.push(now);
    return true;
  }
}
