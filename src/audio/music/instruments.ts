import { burst, envAHR, metal, pluck, sweep, tone, type Voice } from '../synth';
import type { SampleSetId } from './sample-map';
import { sampled } from './sampler';

/**
 * Music instruments: tiny subtractive / FM / additive patches. Each builds
 * one note into a Voice (whose gain already carries track level × velocity)
 * with internal peaks near 1. `f` is the note frequency in Hz, `d` the
 * written note length in seconds; decaying instruments (plucks, bells,
 * drums) ignore `d`, sustained ones hold for it and then release.
 */
export type Inst = (v: Voice, t: number, f: number, d: number) => void;

const waves = new WeakMap<BaseAudioContext, Record<string, PeriodicWave>>();

/** Cached additive waveforms (organ drawbars, accordion reeds). */
function wave(v: Voice, name: 'organ' | 'reed'): PeriodicWave {
  let w = waves.get(v.ctx);
  if (!w) waves.set(v.ctx, (w = {}));
  if (!w[name]) {
    const h = name === 'organ' ? [0, 1, 0.7, 0.05, 0.45, 0, 0.25, 0, 0.18] : [0, 1, 0.75, 0.55, 0.45, 0.35, 0.28, 0.22, 0.17, 0.13, 0.1, 0.08];
    const real = new Float32Array(h.length);
    w[name] = v.ctx.createPeriodicWave(real, Float32Array.from(h));
  }
  return w[name];
}

const curves = new WeakMap<BaseAudioContext, Float32Array<ArrayBuffer>>();

/** Overdrive transfer curve (tanh), one per context. */
function drive(ctx: BaseAudioContext): Float32Array<ArrayBuffer> {
  let c = curves.get(ctx);
  if (!c) {
    c = new Float32Array(1024);
    for (let i = 0; i < c.length; i++) c[i] = Math.tanh(((i / (c.length - 1)) * 2 - 1) * 4);
    curves.set(ctx, c);
  }
  return c;
}

/** Sustained note helper: gain node with an AHR envelope. */
function held(v: Voice, t: number, d: number, a: number, r: number, sustain = 1, to: AudioNode = v.out): GainNode {
  const g = v.gain(to);
  envAHR(g.gain, t, 1, a, Math.max(0, d - a), r, sustain);
  return g;
}
const len = (d: number, a: number, r: number) => a + Math.max(0, d - a) + r + 0.05;

/** Delayed vibrato on an oscillator's frequency. */
function vibrato(v: Voice, o: OscillatorNode, t: number, dur: number, rate: number, depth: number, delay = 0.12) {
  const g = v.gain(o.frequency);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(depth, t + delay + 0.15);
  v.osc('sine', rate, t, dur, g);
}

/** The synth patches: every instrument's own sound, and the fallback for the recorded ones below. */
const SYNTH = {
  // --- farm
  banjo: (v, t, f) => {
    pluck(v, t, f, 0.32, 1, 3800);
    tone(v, 'triangle', f * 2, f * 2, t, 0.001, 0.08, 0.25);
  },
  whistle: (v, t, f, d) => {
    const g = held(v, t, d, 0.035, 0.09);
    const o = v.osc('sine', f, t, len(d, 0.035, 0.09), g);
    sweep(o.frequency, f * 0.97, f, t, 0.05);
    vibrato(v, o, t, len(d, 0.035, 0.09), 5.6, f * 0.012);
    burst(v, 'white', t, 0.02, d * 0.6 + 0.05, 0.06, 'bandpass', f * 2, f * 2, 6);
  },
  upright: (v, t, f, d) => {
    const lp = v.filter(v.out, 'lowpass', 900);
    const dd = Math.min(0.6, d + 0.15);
    tone(v, 'sine', f, f, t, 0.006, dd, 1, lp);
    tone(v, 'triangle', f, f, t, 0.004, dd * 0.6, 0.5, lp);
    burst(v, 'brown', t, 0.002, 0.03, 0.25, 'lowpass', 300);
  },

  // --- factory
  squarelead: (v, t, f, d) => {
    const g = held(v, t, d * 0.85, 0.005, 0.06, 0.6);
    const lp = v.filter(g, 'lowpass', 2400, 3);
    v.osc('square', f, t, len(d, 0.005, 0.06), lp);
    v.osc('square', f * 1.005, t, len(d, 0.005, 0.06), v.gain(lp, 0.6));
  },
  stab: (v, t, f) => {
    const g = v.env(v.out, t, 1, 0.004, 0.2);
    const lp = v.filter(g, 'lowpass', 3000, 2);
    sweep(lp.frequency, 3200, 500, t, 0.18);
    v.osc('sawtooth', f, t, 0.26, lp, -8);
    v.osc('sawtooth', f, t, 0.26, lp, 8);
  },
  acid: (v, t, f, d) => {
    const g = held(v, t, d * 0.8, 0.003, 0.05, 0.7);
    const lp = v.filter(g, 'lowpass', 2200, 11);
    sweep(lp.frequency, 1800 + Math.random() * 1200, 260, t, 0.16);
    v.osc('sawtooth', f, t, len(d, 0.003, 0.05), lp);
  },

  // --- castle
  organ: (v, t, f, d) => {
    const g = held(v, t, d, 0.02, 0.12);
    v.osc(wave(v, 'organ'), f, t, len(d, 0.02, 0.12), g);
  },
  organbass: (v, t, f, d) => {
    const g = held(v, t, d, 0.015, 0.1);
    const lp = v.filter(g, 'lowpass', 700);
    v.osc(wave(v, 'organ'), f, t, len(d, 0.015, 0.1), lp);
    v.osc('sine', f / 2, t, len(d, 0.015, 0.1), v.gain(lp, 0.5));
  },
  harpsichord: (v, t, f) => {
    const g = v.env(v.out, t, 1, 0.001, 0.55);
    const hp = v.filter(g, 'highpass', 250);
    const lp = v.filter(hp, 'lowpass', 6000, 1);
    sweep(lp.frequency, 6000, 1400, t, 0.35);
    v.osc('sawtooth', f, t, 0.6, lp);
    v.osc('square', f * 2, t, 0.6, v.gain(lp, 0.25));
  },
  timpani: (v, t, f) => {
    tone(v, 'sine', f * 1.03, f, t, 0.003, 0.9, 1);
    tone(v, 'sine', f * 1.5, f * 1.5, t, 0.003, 0.4, 0.3);
    burst(v, 'brown', t, 0.002, 0.08, 0.5, 'lowpass', 400);
  },

  // --- jungle
  marimba: (v, t, f) => {
    tone(v, 'sine', f, f, t, 0.002, 0.4, 1);
    tone(v, 'sine', f * 3.93, f * 3.93, t, 0.001, 0.06, 0.35);
    burst(v, 'white', t, 0.001, 0.008, 0.15, 'bandpass', 2500);
  },
  flute: (v, t, f, d) => {
    const g = held(v, t, d, 0.06, 0.12);
    const o = v.osc('sine', f, t, len(d, 0.06, 0.12), g);
    v.osc('triangle', f * 2, t, len(d, 0.06, 0.12), v.gain(g, 0.12));
    vibrato(v, o, t, len(d, 0.06, 0.12), 5, f * 0.01, 0.2);
    burst(v, 'pink', t, 0.04, d * 0.5 + 0.05, 0.12, 'bandpass', f * 1.5, f * 1.5, 3);
  },
  woodbass: (v, t, f) => {
    const lp = v.filter(v.out, 'lowpass', 800);
    tone(v, 'sine', f, f, t, 0.003, 0.32, 1, lp);
    tone(v, 'sine', f * 2, f * 2, t, 0.002, 0.12, 0.3, lp);
  },

  // --- volcano
  brass: (v, t, f, d) => {
    const g = held(v, t, d, 0.05, 0.16, 0.8);
    const lp = v.filter(g, 'lowpass', f * 1.5, 1.5);
    lp.frequency.setValueAtTime(f * 1.5, t);
    lp.frequency.linearRampToValueAtTime(f * 6, t + 0.08);
    lp.frequency.setTargetAtTime(f * 3, t + 0.08, 0.2);
    v.osc('sawtooth', f, t, len(d, 0.05, 0.16), lp, -6);
    v.osc('sawtooth', f, t, len(d, 0.05, 0.16), lp, 6);
  },
  drone: (v, t, f, d) => {
    const g = held(v, t, d, 0.5, 0.8);
    const lp = v.filter(g, 'lowpass', 650, 1);
    for (const c of [-10, 0, 10]) v.osc('sawtooth', f, t, len(d, 0.5, 0.8), v.gain(lp, 0.4), c);
  },
  sub: (v, t, f, d) => {
    const g = held(v, t, d, 0.01, 0.12);
    v.osc('sine', f, t, len(d, 0.01, 0.12), g);
    v.osc('triangle', f * 2, t, len(d, 0.01, 0.12), v.gain(g, 0.18));
  },
  taiko: (v, t, f) => {
    const k = Math.max(40, f);
    tone(v, 'sine', k * 2, k, t, 0.002, 0.55, 1);
    burst(v, 'brown', t, 0.002, 0.25, 0.7, 'lowpass', 450);
    burst(v, 'white', t, 0.001, 0.03, 0.3, 'bandpass', 1000);
  },
  tom: (v, t, f) => {
    tone(v, 'sine', f * 2.4, f * 1.7, t, 0.002, 0.22, 1);
    burst(v, 'white', t, 0.001, 0.02, 0.2, 'bandpass', 1500);
  },

  // --- harbor
  accordion: (v, t, f, d) => {
    const g = held(v, t, d, 0.03, 0.08);
    const trem = v.gain(g, 0.85);
    v.osc('sine', 6, t, len(d, 0.03, 0.08), v.gain(trem.gain, 0.12));
    const lp = v.filter(trem, 'lowpass', 2600);
    v.osc(wave(v, 'reed'), f, t, len(d, 0.03, 0.08), v.gain(lp, 0.55));
    v.osc(wave(v, 'reed'), f * 1.004, t, len(d, 0.03, 0.08), v.gain(lp, 0.45));
  },
  tuba: (v, t, f, d) => {
    const g = held(v, t, d * 0.9, 0.02, 0.08);
    const lp = v.filter(g, 'lowpass', f * 3, 1);
    v.osc('sawtooth', f, t, len(d, 0.02, 0.08), v.gain(lp, 0.6));
    v.osc('sine', f, t, len(d, 0.02, 0.08), v.gain(g, 0.5));
  },
  stomp: (v, t) => {
    burst(v, 'brown', t, 0.002, 0.12, 1, 'lowpass', 320);
    tone(v, 'sine', 85, 48, t, 0.002, 0.12, 0.8);
  },

  // --- mine
  bell: (v, t, f) => {
    const g = v.env(v.out, t, 1, 0.002, 1.4);
    const car = v.osc('sine', f, t, 1.5, g);
    const idx = v.gain(car.frequency);
    sweep(idx.gain, f * 2.2, f * 0.05, t, 1.2);
    v.osc('sine', f * 3.5, t, 1.5, idx);
  },
  darkpad: (v, t, f, d) => {
    const g = held(v, t, d, 0.4, 0.7);
    const lp = v.filter(g, 'lowpass', 900);
    v.osc('triangle', f, t, len(d, 0.4, 0.7), v.gain(lp, 0.6), -7);
    v.osc('sawtooth', f, t, len(d, 0.4, 0.7), v.gain(lp, 0.25), 7);
  },
  pluckbass: (v, t, f) => pluck(v, t, f, 0.35, 1, 900),
  clank: (v, t) => metal(v, t, 600 + Math.random() * 300, 0.35, 1, [1, 2.4, 3.9, 5.3]),
  drip: (v, t) => tone(v, 'sine', 1100 + Math.random() * 400, 2400, t, 0.002, 0.05, 1),

  // --- rooftops
  synthlead: (v, t, f, d) => {
    const g = held(v, t, d, 0.01, 0.14, 0.85);
    const lp = v.filter(g, 'lowpass', 3200, 1);
    const o = v.osc('sawtooth', f, t, len(d, 0.01, 0.14), v.gain(lp, 0.5), -7);
    v.osc('sawtooth', f, t, len(d, 0.01, 0.14), v.gain(lp, 0.5), 7);
    v.osc('square', f / 2, t, len(d, 0.01, 0.14), v.gain(lp, 0.2));
    vibrato(v, o, t, len(d, 0.01, 0.14), 5.5, f * 0.008, 0.2);
  },
  syntharp: (v, t, f) => {
    const g = v.env(v.out, t, 1, 0.002, 0.15);
    const lp = v.filter(g, 'lowpass', 2200, 2);
    sweep(lp.frequency, 2400, 800, t, 0.14);
    v.osc('square', f, t, 0.2, lp);
  },
  synthpad: (v, t, f, d) => {
    const g = held(v, t, d, 0.3, 0.6);
    const lp = v.filter(g, 'lowpass', 1400);
    v.osc('sawtooth', f, t, len(d, 0.3, 0.6), v.gain(lp, 0.4), -12);
    v.osc('sawtooth', f, t, len(d, 0.3, 0.6), v.gain(lp, 0.4), 12);
  },
  synthbass: (v, t, f, d) => {
    const g = held(v, t, d * 0.8, 0.003, 0.05, 0.75);
    const lp = v.filter(g, 'lowpass', 900, 4);
    sweep(lp.frequency, 1100, 280, t, 0.12);
    v.osc('sawtooth', f, t, len(d, 0.003, 0.05), lp);
    v.osc('square', f / 2, t, len(d, 0.003, 0.05), v.gain(lp, 0.35));
  },
  gatedsnare: (v, t) => {
    const g = v.gain(v.out);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 0.002);
    g.gain.setValueAtTime(0.8, t + 0.14);
    g.gain.linearRampToValueAtTime(0, t + 0.17);
    const bp = v.filter(g, 'bandpass', 1600, 0.6);
    v.noise('white', t, 0.2, bp);
    tone(v, 'triangle', 210, 170, t, 0.002, 0.07, 0.6);
  },

  // --- second arrangements (see `arrangements` in styles.ts)
  fiddle: (v, t, f, d) => {
    const L = len(d, 0.05, 0.1);
    const g = held(v, t, d, 0.05, 0.1, 0.85);
    const lp = v.filter(g, 'lowpass', 3800, 0.8);
    // A second, nasal resonance gives the bowed edge.
    const body = v.filter(g, 'bandpass', 2600, 1.6);
    const o = v.osc('sawtooth', f, t, L, lp);
    o.connect(v.gain(body, 0.5));
    vibrato(v, o, t, L, 5.8, f * 0.012, 0.18);
    burst(v, 'white', t, 0.015, 0.07, 0.06, 'bandpass', f * 3, f * 3, 2);
  },
  guitar: (v, t, f) => {
    pluck(v, t, f, 0.55, 1, 2600);
    tone(v, 'sine', f, f, t, 0.002, 0.5, 0.3);
  },
  lute: (v, t, f) => {
    pluck(v, t, f, 0.45, 1, 1700);
    tone(v, 'triangle', f * 2, f * 2, t, 0.001, 0.15, 0.2);
  },
  twang: (v, t, f, d) => {
    const L = Math.max(0.5, d + 0.35);
    const g = v.env(v.out, t, 1, 0.002, L);
    const lp = v.filter(g, 'lowpass', 3500, 3);
    sweep(lp.frequency, 3600, f * 2.2, t, 0.45);
    const o = v.osc('sawtooth', f, t, L + 0.05, lp);
    v.osc('square', f, t, L + 0.05, v.gain(lp, 0.3));
    vibrato(v, o, t, L, 6, f * 0.01, 0.25);
  },
  bodhran: (v, t) => {
    tone(v, 'sine', 120, 70, t, 0.002, 0.18, 1);
    burst(v, 'brown', t, 0.002, 0.06, 0.5, 'lowpass', 600);
    burst(v, 'white', t, 0.001, 0.02, 0.15, 'bandpass', 1800);
  },
  celesta: (v, t, f) => {
    tone(v, 'sine', f, f, t, 0.002, 0.9, 1);
    tone(v, 'sine', f * 2, f * 2, t, 0.001, 0.4, 0.15);
    tone(v, 'sine', f * 4, f * 4, t, 0.001, 0.12, 0.25);
  },
  ocarina: (v, t, f, d) => {
    const L = len(d, 0.04, 0.1);
    const g = held(v, t, d, 0.04, 0.1);
    const o = v.osc('sine', f, t, L, g);
    v.osc('sine', f * 2, t, L, v.gain(g, 0.06));
    vibrato(v, o, t, L, 5, f * 0.008, 0.3);
    burst(v, 'pink', t, 0.03, d * 0.4 + 0.05, 0.08, 'bandpass', f * 2, f * 2, 3);
  },
  kalimba: (v, t, f) => {
    tone(v, 'sine', f, f, t, 0.002, 0.8, 1);
    tone(v, 'sine', f * 5.9, f * 5.9, t, 0.001, 0.05, 0.25);
    burst(v, 'white', t, 0.001, 0.006, 0.12, 'bandpass', 3000);
  },
  talkdrum: (v, t, f) => {
    tone(v, 'sine', f * 2.2, f * 1.6, t, 0.003, 0.25, 1);
    burst(v, 'white', t, 0.001, 0.015, 0.2, 'bandpass', 1200);
  },
  powerchord: (v, t, f, d) => {
    const L = len(d * 0.9, 0.004, 0.08);
    const g = held(v, t, d * 0.9, 0.004, 0.08, 0.8);
    const lp = v.filter(g, 'lowpass', 2400, 1);
    const ws = v.ctx.createWaveShaper();
    ws.curve = drive(v.ctx);
    ws.connect(lp);
    // Root, fifth and octave into one overdriven amp.
    for (const [r, c] of [
      [1, -5],
      [1.4983, 5],
      [2, 0],
    ])
      v.osc('sawtooth', f * r, t, L, v.gain(ws, 0.5), c);
  },
  epiano: (v, t, f, d) => {
    const L = Math.max(0.8, d + 0.4);
    const g = v.env(v.out, t, 1, 0.003, L);
    const car = v.osc('sine', f, t, L + 0.05, g);
    const idx = v.gain(car.frequency);
    sweep(idx.gain, f * 1.4, f * 0.08, t, 0.5);
    v.osc('sine', f, t, L + 0.05, idx);
    tone(v, 'sine', f * 14, f * 14, t, 0.001, 0.03, 0.08);
  },
  steeldrum: (v, t, f) => {
    const g = v.env(v.out, t, 1, 0.002, 0.55);
    for (const [r, a] of [
      [1, 1],
      [2, 0.45],
      [3.02, 0.2],
    ]) {
      const o = v.osc('sine', f * r, t, 0.6, v.gain(g, a));
      sweep(o.frequency, f * r * 1.01, f * r, t, 0.05);
    }
    burst(v, 'white', t, 0.001, 0.01, 0.15, 'bandpass', f * 4, f * 4, 2);
  },
  sleigh: (v, t) => {
    metal(v, t, 5200, 0.25, 1, [1, 1.37, 1.81, 2.3]);
    burst(v, 'white', t, 0.002, 0.12, 0.5, 'highpass', 7000);
  },
  theremin: (v, t, f, d) => {
    const L = len(d, 0.12, 0.25);
    const g = held(v, t, d, 0.12, 0.25);
    const o = v.osc('sine', f, t, L, g);
    sweep(o.frequency, f * 0.97, f, t, 0.12);
    v.osc('triangle', f, t, L, v.gain(g, 0.08));
    vibrato(v, o, t, L, 6.2, f * 0.025, 0.05);
  },

  // --- shared kit
  kick: (v, t) => {
    tone(v, 'sine', 155, 44, t, 0.002, 0.3, 1);
    burst(v, 'white', t, 0.001, 0.006, 0.3, 'highpass', 3000);
  },
  softkick: (v, t) => {
    const lp = v.filter(v.out, 'lowpass', 600);
    tone(v, 'sine', 115, 50, t, 0.003, 0.2, 1, lp);
  },
  snare: (v, t) => {
    burst(v, 'white', t, 0.001, 0.15, 1, 'bandpass', 1900, 1900, 0.8);
    tone(v, 'triangle', 195, 160, t, 0.001, 0.07, 0.5);
  },
  brush: (v, t) => burst(v, 'pink', t, 0.02, 0.12, 1, 'bandpass', 3000, 2500, 0.9),
  hat: (v, t) => burst(v, 'white', t, 0.001, 0.035, 1, 'highpass', 7500),
  shaker: (v, t) => burst(v, 'white', t, 0.012, 0.05, 1, 'bandpass', 6000, 6000, 1.5),
  clap: (v, t) => {
    for (const dt of [0, 0.011, 0.023]) burst(v, 'white', t + dt, 0.001, 0.01, 0.8, 'bandpass', 1300, 1300, 1.2);
    burst(v, 'white', t + 0.03, 0.001, 0.12, 0.6, 'bandpass', 1200, 1200, 1);
  },
  rim: (v, t) => {
    tone(v, 'sine', 1700, 1650, t, 0.001, 0.018, 1);
    burst(v, 'white', t, 0.001, 0.01, 0.5, 'highpass', 3000);
  },
  conga: (v, t) => {
    tone(v, 'sine', 310, 250, t, 0.002, 0.16, 1);
    burst(v, 'white', t, 0.001, 0.012, 0.25, 'bandpass', 1800);
  },
  bongo: (v, t) => tone(v, 'sine', 490, 430, t, 0.001, 0.08, 1),
  anvil: (v, t) => metal(v, t, 1050 + Math.random() * 150, 0.28, 1),
  steam: (v, t) => burst(v, 'white', t, 0.03, 0.22, 1, 'highpass', 2500),
  crash: (v, t) => {
    burst(v, 'white', t, 0.002, 1.3, 1, 'highpass', 4500);
    metal(v, t, 3100, 0.6, 0.25, [1, 1.38, 1.73]);
  },
  tambourine: (v, t) => {
    burst(v, 'white', t, 0.002, 0.09, 0.8, 'highpass', 6500);
    metal(v, t, 4800, 0.08, 0.3, [1, 1.33]);
  },
} satisfies Record<string, Inst>;

const S = SYNTH;

/**
 * Every instrument. Acoustic ones play recordings (sampler.ts) over their synth patch; synths stay
 * synths. A few have no synth of their own and borrow the nearest one until their samples load.
 */
export const INSTRUMENTS = {
  ...SYNTH,
  banjo: sampled('strumstick', S.banjo),
  whistle: sampled('recorder', S.whistle, { sustain: true }),
  upright: sampled('contrabass', S.upright),
  woodbass: sampled('contrabass', S.woodbass),
  pluckbass: sampled('contrabass', S.pluckbass),
  organ: sampled('organ', S.organ, { sustain: true, release: 0.2 }),
  organbass: sampled('organpedal', S.organbass, { sustain: true, release: 0.2 }),
  harpsichord: sampled('harpsichord', S.harpsichord),
  marimba: sampled('marimba', S.marimba),
  flute: sampled('flute', S.flute, { sustain: true, release: 0.15 }),
  brass: sampled('horn', S.brass, { sustain: true, release: 0.2 }),
  taiko: sampled('bassdrum', S.taiko, { tune: 36 }),
  tom: sampled('tom', S.tom, { tune: 50 }),
  accordion: sampled('accordion', S.accordion, { sustain: true, release: 0.1 }),
  tuba: sampled('tuba', S.tuba),
  bell: sampled('vibes', S.bell),
  clank: sampled('brakedrum', S.clank),
  fiddle: sampled('violin', S.fiddle, { sustain: true, release: 0.12 }),
  guitar: sampled('ukulele', S.guitar),
  lute: sampled('folkharp', S.lute),
  twang: sampled('eguitar', S.twang),
  bodhran: sampled('framedrum', S.bodhran),
  celesta: sampled('glock', S.celesta),
  ocarina: sampled('ocarina', S.ocarina, { sustain: true, release: 0.1 }),
  kalimba: sampled('kalimba', S.kalimba),
  talkdrum: sampled('slitdrum', S.talkdrum, { tune: 45 }),
  powerchord: sampled('dguitar', S.powerchord, { sustain: true, release: 0.06, stack: [7] }),
  epiano: sampled('fmpiano', S.epiano, { sustain: true, release: 0.3 }),
  steeldrum: sampled('steeldrum', S.steeldrum),
  sleigh: sampled('sleigh', S.sleigh),
  softkick: sampled('bassdrum', S.softkick),
  snare: sampled('snare', S.snare),
  hat: sampled('hihat', S.hat),
  shaker: sampled('shaker', S.shaker),
  clap: sampled('clap', S.clap),
  rim: sampled('sidestick', S.rim),
  conga: sampled('conga', S.conga),
  bongo: sampled('bongo', S.bongo),
  anvil: sampled('anvil', S.anvil),
  tambourine: sampled('tambourine', S.tambourine),
  // Recorded only.
  harmonica: sampled('harmonica', S.accordion, { sustain: true, release: 0.1 }),
  recorder: sampled('altrecorder', S.flute, { sustain: true, release: 0.1 }),
  sax: sampled('sax', S.synthlead, { sustain: true, release: 0.15 }),
  cello: sampled('cello', S.darkpad, { sustain: true, release: 0.3 }),
  chimes: sampled('chimes', S.bell),
} satisfies Record<string, Inst>;

export type InstId = keyof typeof INSTRUMENTS;

/** The sample sets a list of instruments plays, so a song can load them before it starts. */
export function sampleSets(insts: Iterable<InstId>): SampleSetId[] {
  const out = new Set<SampleSetId>();
  for (const i of insts) {
    const p: Inst & { set?: SampleSetId } = INSTRUMENTS[i];
    if (p.set) out.add(p.set);
  }
  return [...out];
}
