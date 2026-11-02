/**
 * WebAudio building blocks shared by SFX, loops and music.
 *
 * Every sound is a `Voice`: a gain node that its oscillators / noise sources
 * feed through filters and envelopes. The voice knows when its sources end,
 * disconnects itself afterwards, and can be "stolen" (faded out in 20 ms)
 * by the mixer's voice limiter. Envelopes always start from 0 and ramp, and
 * exponential ramps never target 0 (WebAudio throws), so nothing clicks.
 *
 * Everything takes a `BaseAudioContext`, so the same code renders in a live
 * AudioContext, an OfflineAudioContext (level checks), or a fake (tests).
 */

/** Floor for exponential ramps (−80 dB). */
export const FLOOR = 0.0001;

export type NoiseKind = 'white' | 'pink' | 'brown' | 'crackle';

const noiseCache = new WeakMap<BaseAudioContext, Partial<Record<NoiseKind, AudioBuffer>>>();

/** 2 s looping mono noise buffers, generated once per context. */
export function noiseBuffer(ctx: BaseAudioContext, kind: NoiseKind): AudioBuffer {
  let c = noiseCache.get(ctx);
  if (!c) noiseCache.set(ctx, (c = {}));
  const hit = c[kind];
  if (hit) return hit;
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  fillNoise(buf.getChannelData(0), kind, ctx.sampleRate);
  c[kind] = buf;
  return buf;
}

/** Fill `d` with roughly unit-peak noise of the given color. Exported for tests. */
export function fillNoise(d: Float32Array, kind: NoiseKind, sampleRate: number): void {
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let last = 0;
  let crackleEnv = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === 'white') d[i] = w * 0.9;
    else if (kind === 'pink') {
      // Paul Kellet's economy pink filter.
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    } else if (kind === 'brown') {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    } else {
      // Sparse electrical crackle: random clicks with fast decays.
      if (Math.random() < 120 / sampleRate) crackleEnv = 0.4 + Math.random() * 0.6;
      crackleEnv *= 0.993;
      d[i] = w * crackleEnv;
    }
  }
}

/** Ramp a param exponentially (both ends clamped above zero). */
export function sweep(p: AudioParam, from: number, to: number, t: number, dur: number): void {
  p.setValueAtTime(Math.max(FLOOR, from), t);
  p.exponentialRampToValueAtTime(Math.max(FLOOR, to), t + Math.max(0.001, dur));
}

/** Attack/decay envelope on a gain param: 0 → peak (linear) → floor (exponential) → 0. Returns end time. */
export function envAD(p: AudioParam, t: number, peak: number, attack: number, decay: number): number {
  const pk = Math.max(FLOOR * 2, peak);
  const a = Math.max(0.002, attack);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(pk, t + a);
  p.exponentialRampToValueAtTime(FLOOR, t + a + Math.max(0.005, decay));
  p.linearRampToValueAtTime(0, t + a + decay + 0.01);
  return t + a + decay + 0.01;
}

/** Attack/hold/release envelope for sustained notes. Returns end time. */
export function envAHR(p: AudioParam, t: number, peak: number, attack: number, hold: number, release: number, sustain = 1): number {
  const pk = Math.max(FLOOR * 2, peak);
  const a = Math.max(0.003, attack);
  const h = Math.max(0, hold);
  const r = Math.max(0.01, release);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(pk, t + a);
  if (sustain < 1) p.exponentialRampToValueAtTime(Math.max(FLOOR * 2, pk * sustain), t + a + Math.max(0.005, h));
  else p.setValueAtTime(pk, t + a + h);
  p.exponentialRampToValueAtTime(FLOOR, t + a + h + r);
  p.linearRampToValueAtTime(0, t + a + h + r + 0.01);
  return t + a + h + r + 0.01;
}

/**
 * One sound instance. Build it by chaining sources → filters → env gains → `out`.
 * The voice disconnects its output when every source has ended.
 */
export class Voice {
  readonly out: GainNode;
  /** Latest scheduled source stop time. */
  end = 0;
  dead = false;
  private srcs: AudioScheduledSourceNode[] = [];
  private live = 0;
  private extra: AudioNode[] = [];

  constructor(
    readonly ctx: BaseAudioContext,
    readonly t: number,
    gain: number,
    private onDone?: (v: Voice) => void,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = gain;
  }

  /** Extra nodes (panner, sends) that should be disconnected with the voice. */
  own(n: AudioNode): void {
    this.extra.push(n);
  }

  private track<T extends AudioScheduledSourceNode>(s: T, start: number, stop: number): T {
    s.start(start);
    s.stop(stop);
    this.end = Math.max(this.end, stop);
    this.srcs.push(s);
    this.live++;
    s.onended = () => {
      if (--this.live <= 0) this.finish();
    };
    return s;
  }

  osc(type: OscillatorType | PeriodicWave, freq: number, t: number, dur: number, to: AudioNode | AudioParam, detune = 0): OscillatorNode {
    const o = this.ctx.createOscillator();
    if (typeof type === 'string') o.type = type as OscillatorType;
    else o.setPeriodicWave(type);
    o.frequency.setValueAtTime(Math.max(1, freq), t);
    if (detune) o.detune.setValueAtTime(detune, t);
    o.connect(to as AudioNode);
    return this.track(o, t, t + dur);
  }

  noise(kind: NoiseKind, t: number, dur: number, to: AudioNode, rate = 1): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = noiseBuffer(this.ctx, kind);
    s.loop = true;
    s.playbackRate.setValueAtTime(rate, t);
    s.connect(to);
    // Random offset so repeated hits don't sound identical.
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur);
    this.end = Math.max(this.end, t + dur);
    this.srcs.push(s);
    this.live++;
    s.onended = () => {
      if (--this.live <= 0) this.finish();
    };
    return s;
  }

  /** Gain node into a node or an AudioParam (modulation depth). */
  gain(to: AudioNode | AudioParam, v = 0): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = v;
    g.connect(to as AudioNode);
    return g;
  }

  filter(to: AudioNode, type: BiquadFilterType, freq: number, q = 0.7): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    f.connect(to);
    return f;
  }

  /** A gain node with an attack/decay envelope, feeding `to`. */
  env(to: AudioNode, t: number, peak: number, attack: number, decay: number): GainNode {
    const g = this.gain(to);
    envAD(g.gain, t, peak, attack, decay);
    return g;
  }

  /** Fade out quickly and stop (voice stealing / cut-offs). */
  kill(now: number, fade = 0.02): void {
    if (this.dead) return;
    const g = this.out.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + fade);
    for (const s of this.srcs) {
      try {
        s.stop(now + fade + 0.01);
      } catch {
        // already stopped
      }
    }
    this.end = Math.min(this.end, now + fade + 0.01);
  }

  private finish() {
    if (this.dead) return;
    this.dead = true;
    this.out.disconnect();
    for (const n of this.extra) n.disconnect();
    this.onDone?.(this);
  }
}

// ---------------------------------------------------------------- patch helpers

/** Oscillator with an AD envelope and optional exponential pitch sweep. */
export function tone(v: Voice, type: OscillatorType, f0: number, f1: number, t: number, a: number, d: number, peak: number, to: AudioNode = v.out) {
  const g = v.env(to, t, peak, a, d);
  const o = v.osc(type, f0, t, a + d + 0.03, g);
  if (f1 !== f0) sweep(o.frequency, f0, f1, t, a + d);
  return o;
}

/** Filtered noise burst with an AD envelope and optional filter sweep. */
export function burst(
  v: Voice,
  kind: NoiseKind,
  t: number,
  a: number,
  d: number,
  peak: number,
  type: BiquadFilterType,
  f0: number,
  f1 = f0,
  q = 0.7,
  to: AudioNode = v.out,
) {
  const g = v.env(to, t, peak, a, d);
  const f = v.filter(g, type, f0, q);
  if (f1 !== f0) sweep(f.frequency, f0, f1, t, a + d);
  v.noise(kind, t, a + d + 0.03, f);
  return f;
}

/** Inharmonic metal partials (clanks, tinks, anvils). */
export function metal(v: Voice, t: number, base: number, d: number, peak: number, ratios = [1, 2.76, 5.4, 8.93]) {
  ratios.forEach((r, i) => tone(v, 'sine', base * r, base * r, t, 0.001, d / (1 + i * 0.5), peak / (1 + i * 0.8)));
}

/** Plucked-string-ish tone: bright saw through a closing lowpass. */
export function pluck(v: Voice, t: number, f: number, d: number, peak: number, bright = 3000) {
  const g = v.env(v.out, t, peak, 0.002, d);
  const lp = v.filter(g, 'lowpass', bright, 2);
  sweep(lp.frequency, bright, Math.max(200, f * 1.2), t, d * 0.6);
  v.osc('sawtooth', f, t, d + 0.05, lp);
  v.osc('square', f * 2, t, d + 0.05, v.env(lp, t, 0.25, 0.002, d * 0.3));
}

export const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);
export const semis = (n: number) => 2 ** (n / 12);
