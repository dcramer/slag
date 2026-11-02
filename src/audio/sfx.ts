import { burst, metal, mtof, pluck, sweep, tone, type Voice } from './synth';

/**
 * The SFX palette: every one-shot sound, as data + a tiny synth patch.
 * `gain` is the voice level before spatial attenuation; patches keep their
 * internal envelopes peaking near 1 so `gain` alone sets loudness. Levels
 * were balanced with OfflineAudioContext renders in headless Chromium at
 * default volumes: frequent actions peak ≈ −17 dBFS, deaths/finish ≈ −6,
 * explosions ≈ −3, against music at ≈ −23 dBFS short-term loudness.
 */

export interface SfxOpts {
  /** Pitch ratio (1 = as designed). */
  pitch: number;
  /** Sub-flavor (surface, liquid, prop material…). */
  variant: string;
  /** 0..1 strength (landing impact, explosion size…). */
  amount: number;
  /** MIDI notes for musical cues (finish arpeggio, claim chime…), taken from the current song's key. */
  notes: readonly number[];
}

export interface SfxDef {
  /** Voice-limiter priority 0..3. */
  prio: number;
  gain: number;
  reverb: number;
  /** At most `max` plays per `window` seconds (keyed by name + variant). */
  max: number;
  window: number;
  /** Duck the music by this much (0 = no duck). */
  duck?: number;
  play(v: Voice, t: number, o: SfxOpts): void;
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function pipeWarble(v: Voice, t: number, pitch: number, steps: readonly number[]) {
  const lp = v.filter(v.out, 'lowpass', 1800);
  steps.forEach((f, i) => tone(v, 'square', f * pitch, f * 0.94 * pitch, t + i * 0.07, 0.003, 0.08, 0.7, lp));
}

// ---------------------------------------------------------------- variants

const LAND: Record<string, (v: Voice, t: number, k: number) => void> = {
  soft: (v, t, k) => burst(v, 'brown', t, 0.002, 0.07 + k * 0.05, 1, 'lowpass', 500 + k * 400),
  stone: (v, t, k) => {
    burst(v, 'brown', t, 0.002, 0.06 + k * 0.05, 1, 'lowpass', 900 + k * 600);
    burst(v, 'white', t, 0.001, 0.02, 0.35, 'bandpass', 2400, 2400, 1.2);
  },
  metal: (v, t, k) => {
    burst(v, 'brown', t, 0.002, 0.06, 0.8, 'lowpass', 800);
    metal(v, t, 310 + k * 40, 0.12 + k * 0.1, 0.35);
  },
  wood: (v, t, k) => {
    burst(v, 'brown', t, 0.002, 0.06, 0.8, 'lowpass', 700);
    tone(v, 'triangle', 210, 160, t, 0.001, 0.07 + k * 0.04, 0.6);
  },
  ice: (v, t) => {
    burst(v, 'brown', t, 0.002, 0.05, 0.6, 'lowpass', 700);
    tone(v, 'sine', 2400, 2300, t, 0.001, 0.08, 0.3);
  },
  goo: (v, t, k) => burst(v, 'pink', t, 0.004, 0.12 + k * 0.08, 1, 'bandpass', 250, 900, 5),
};

const STEP: Record<string, [BiquadFilterType, number, number]> = {
  soft: ['lowpass', 900, 0.7],
  stone: ['bandpass', 1800, 1.5],
  metal: ['bandpass', 3200, 4],
  wood: ['bandpass', 1100, 2],
  ice: ['highpass', 4200, 0.7],
  goo: ['bandpass', 500, 4],
};

const SPLASH: Record<string, (v: Voice, t: number) => void> = {
  water: (v, t) => {
    burst(v, 'white', t, 0.004, 0.35, 1, 'bandpass', 2600, 500, 1);
    tone(v, 'sine', 320, 90, t, 0.002, 0.12, 0.8);
    for (let i = 0; i < 5; i++) {
      const f = rnd(450, 950);
      tone(v, 'sine', f, f * 1.7, t + rnd(0.08, 0.5), 0.002, 0.04, 0.25);
    }
  },
  slag: (v, t) => {
    tone(v, 'sine', 230, 70, t, 0.002, 0.15, 0.9);
    burst(v, 'crackle', t, 0.01, 1.1, 1, 'highpass', 2000);
    burst(v, 'white', t + 0.02, 0.03, 0.8, 0.45, 'highpass', 3500);
    burst(v, 'brown', t, 0.01, 0.6, 0.8, 'lowpass', 220);
  },
  acid: (v, t) => {
    tone(v, 'sine', 260, 90, t, 0.002, 0.12, 0.8);
    burst(v, 'crackle', t, 0.02, 0.9, 1, 'highpass', 4000);
    burst(v, 'white', t, 0.03, 0.6, 0.4, 'bandpass', 6000, 6000, 1.5);
  },
  void: (v, t) => {
    burst(v, 'white', t, 0.01, 0.75, 1, 'bandpass', 3200, 180, 4);
    tone(v, 'sine', 420, 38, t, 0.01, 0.85, 0.6);
  },
  tar: (v, t) => {
    const lp = v.filter(v.out, 'lowpass', 700, 3);
    tone(v, 'sine', 170, 60, t, 0.004, 0.25, 1, lp);
    tone(v, 'sine', 130, 48, t + 0.18, 0.004, 0.3, 0.7, lp);
    burst(v, 'brown', t, 0.01, 0.4, 0.7, 'lowpass', 300);
  },
};

/** Per-liquid level trims (measured offline so every splash peaks alike). */
const SPLASH_TRIM: Record<string, number> = { slag: 0.85, water: 1.4, acid: 1.4, void: 1.6, tar: 1.25 };

// ---------------------------------------------------------------- palette

const P = (prio: number, gain: number, reverb: number, max: number, window: number, play: SfxDef['play'], duck?: number): SfxDef => ({
  prio,
  gain,
  reverb,
  max,
  window,
  play,
  duck,
});

export const SFX = {
  // --- player actions
  jump: P(1, 0.13, 0.05, 4, 0.08, (v, t, o) => {
    tone(v, 'triangle', 260 * o.pitch, 560 * o.pitch, t, 0.004, 0.09, 1);
    burst(v, 'white', t, 0.002, 0.04, 0.3, 'highpass', 2500);
  }),
  walljump: P(1, 0.14, 0.05, 4, 0.08, (v, t, o) => {
    tone(v, 'triangle', 340 * o.pitch, 760 * o.pitch, t, 0.003, 0.08, 1);
    burst(v, 'white', t, 0.001, 0.05, 0.6, 'bandpass', 3200, 1800, 1.5);
  }),
  land: P(1, 0.22, 0.03, 3, 0.06, (v, t, o) => {
    (LAND[o.variant] ?? LAND.soft)(v, t, o.amount);
    tone(v, 'sine', 140, 55, t, 0.002, 0.07 + o.amount * 0.05, 0.6 + o.amount * 0.4);
  }),
  step: P(0, 0.1, 0, 6, 0.1, (v, t, o) => {
    const [type, f, q] = STEP[o.variant] ?? STEP.soft;
    burst(v, 'white', t, 0.001, 0.025, 1, type, f * rnd(0.85, 1.15), f, q);
  }),
  bounce: P(1, 0.17, 0.08, 3, 0.08, (v, t, o) => {
    const g = v.env(v.out, t, 1, 0.004, 0.3);
    const osc = v.osc('sine', 200 * o.pitch, t, 0.36, g);
    osc.frequency.exponentialRampToValueAtTime(520 * o.pitch, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(330 * o.pitch, t + 0.28);
    const lfo = v.gain(osc.frequency, 28);
    v.osc('sine', 14, t, 0.36, lfo);
  }),
  drop: P(0, 0.28, 0, 3, 0.1, (v, t) => {
    burst(v, 'pink', t, 0.02, 0.12, 1, 'bandpass', 2000, 600, 1.5);
  }),
  spring: P(2, 0.2, 0.1, 4, 0.06, (v, t) => {
    const g = v.env(v.out, t, 1, 0.003, 0.38);
    const o = v.osc('triangle', 150, t, 0.42, g);
    o.frequency.exponentialRampToValueAtTime(620, t + 0.1);
    o.frequency.exponentialRampToValueAtTime(430, t + 0.35);
    const depth = v.gain(o.frequency, 0);
    depth.gain.setValueAtTime(60, t + 0.06);
    depth.gain.exponentialRampToValueAtTime(2, t + 0.4);
    v.osc('sine', 19, t, 0.42, depth);
    metal(v, t, 900, 0.12, 0.25, [1, 2.4]);
  }),
  // A pipe trip: a three-step warble falling as you go in, climbing as you come out.
  'pipe-in': P(2, 0.16, 0.15, 4, 0.1, (v, t, o) => pipeWarble(v, t, o.pitch, [330, 247, 185])),
  'pipe-out': P(2, 0.16, 0.15, 4, 0.1, (v, t, o) => pipeWarble(v, t, o.pitch, [185, 247, 330])),

  // --- deaths
  'death-hazard': P(3, 0.55, 0.25, 4, 0.1, (v, t, o) => {
    burst(v, 'pink', t, 0.002, 0.2, 1, 'lowpass', 2200, 300, 1);
    tone(v, 'sine', 520 * o.pitch, 130 * o.pitch, t, 0.003, 0.2, 0.75);
    burst(v, 'white', t, 0.001, 0.06, 0.5, 'bandpass', 900, 900, 3);
    tone(v, 'square', 233 * o.pitch, 220 * o.pitch, t + 0.02, 0.003, 0.12, 0.12);
  }),
  'death-crush': P(3, 0.6, 0.2, 4, 0.1, (v, t) => {
    tone(v, 'sine', 95, 34, t, 0.002, 0.3, 1);
    burst(v, 'brown', t, 0.002, 0.22, 0.9, 'lowpass', 800);
    for (const dt of [0, 0.03, 0.058]) burst(v, 'white', t + dt, 0.001, 0.03, 0.6, 'bandpass', 2600, 2600, 2);
  }),
  'death-pop': P(3, 0.45, 0.2, 4, 0.1, (v, t, o) => {
    burst(v, 'white', t, 0.001, 0.05, 1, 'highpass', 1000);
    tone(v, 'sine', 900 * o.pitch, 1800 * o.pitch, t, 0.002, 0.08, 0.4);
    burst(v, 'pink', t + 0.01, 0.01, 0.25, 0.3, 'bandpass', 3000, 2000, 1.5);
  }),
  'death-timeout': P(3, 0.21, 0.2, 3, 0.2, (v, t, o) => {
    const f = 233 * o.pitch;
    const g = v.gain(v.out);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 0.02);
    g.gain.setValueAtTime(1, t + 0.17);
    g.gain.linearRampToValueAtTime(0.3, t + 0.2);
    g.gain.linearRampToValueAtTime(1, t + 0.23);
    g.gain.setValueAtTime(1, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
    const lp = v.filter(g, 'lowpass', 500, 5);
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.linearRampToValueAtTime(1600, t + 0.1);
    lp.frequency.linearRampToValueAtTime(500, t + 0.2);
    lp.frequency.linearRampToValueAtTime(1500, t + 0.32);
    lp.frequency.linearRampToValueAtTime(400, t + 0.75);
    const osc = v.osc('sawtooth', f, t, 0.8, lp);
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.setValueAtTime(f * 0.944, t + 0.2);
    osc.frequency.linearRampToValueAtTime(f * 0.89, t + 0.75);
  }),
  splash: P(3, 0.38, 0.25, 4, 0.1, (v, t, o) => {
    v.out.gain.value *= SPLASH_TRIM[o.variant] ?? 1;
    (SPLASH[o.variant] ?? SPLASH.slag)(v, t);
  }),

  // --- finish & musical cues
  finish: P(3, 0.4, 0.35, 4, 0.1, (v, t, o) => {
    o.notes.forEach((m, i) => {
      const at = t + i * 0.075;
      const last = i === o.notes.length - 1;
      const d = last ? 0.7 : 0.25;
      tone(v, 'triangle', mtof(m), mtof(m), at, 0.004, d, 0.8);
      tone(v, 'sine', mtof(m + 12), mtof(m + 12), at, 0.004, d * 0.8, 0.35);
      if (last && o.notes.length > 2) tone(v, 'sine', mtof(m + 24), mtof(m + 24), at + 0.05, 0.01, 0.6, 0.15);
    });
    burst(v, 'white', t, 0.02, 0.4, 0.15, 'highpass', 7000);
  }),
  claim: P(2, 0.27, 0.25, 4, 0.05, (v, t, o) => {
    o.notes.forEach((m, i) => {
      tone(v, 'sine', mtof(m), mtof(m), t + i * 0.08, 0.004, 0.3, 0.9);
      tone(v, 'triangle', mtof(m + 12), mtof(m + 12), t + i * 0.08, 0.004, 0.12, 0.3);
    });
  }),
  place: P(2, 0.28, 0.15, 4, 0.05, (v, t, o) => {
    tone(v, 'sine', 170, 75, t, 0.002, 0.11, 1);
    burst(v, 'brown', t, 0.002, 0.07, 0.8, 'lowpass', 900);
    if (o.variant === 'metal') metal(v, t, 420, 0.3, 0.4);
    else if (o.variant === 'magic') tone(v, 'sine', 1400, 2800, t, 0.01, 0.25, 0.25);
    else tone(v, 'triangle', 260, 220, t, 0.001, 0.08, 0.45);
    o.notes.forEach((m, i) => tone(v, 'sine', mtof(m + 24), mtof(m + 24), t + 0.06 + i * 0.05, 0.003, 0.15, 0.22));
  }),
  countdown: P(3, 0.12, 0.15, 2, 0.1, (v, t, o) => {
    const go = o.variant === 'go';
    const notes = go ? o.notes : o.notes.slice(0, 1);
    for (const m of notes) {
      const g = v.gain(v.out);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(go ? 0.55 : 0.8, t + 0.006);
      g.gain.setValueAtTime(go ? 0.55 : 0.8, t + (go ? 0.3 : 0.09));
      g.gain.exponentialRampToValueAtTime(0.0001, t + (go ? 0.75 : 0.2));
      const lp = v.filter(g, 'lowpass', go ? 4000 : 2600, 0.7);
      v.osc('square', mtof(m), t, go ? 0.8 : 0.25, lp);
      v.osc('sine', mtof(m) * 2, t, go ? 0.8 : 0.25, v.gain(lp, 0.5));
    }
  }),

  // --- launchers
  'fire-crossbow': P(1, 0.17, 0.1, 3, 0.08, (v, t, o) => {
    pluck(v, t, 190 * o.pitch, 0.18, 1, 2800);
    burst(v, 'white', t, 0.002, 0.06, 0.6, 'bandpass', 3500, 1200, 3);
  }),
  'fire-ballista': P(1, 0.2, 0.15, 3, 0.1, (v, t, o) => {
    pluck(v, t, 105 * o.pitch, 0.3, 1, 1800);
    burst(v, 'white', t, 0.002, 0.1, 0.6, 'bandpass', 2400, 700, 2);
    tone(v, 'triangle', 140, 120, t + 0.02, 0.01, 0.12, 0.3);
  }),
  'fire-cannon': P(
    2,
    0.4,
    0.35,
    2,
    0.12,
    (v, t) => {
      tone(v, 'sine', 85, 32, t, 0.002, 0.45, 1);
      burst(v, 'brown', t, 0.002, 0.5, 1, 'lowpass', 1000, 150);
      burst(v, 'white', t, 0.001, 0.05, 0.6, 'lowpass', 4500);
    },
    0.25,
  ),
  'fire-totem': P(1, 0.28, 0.15, 3, 0.08, (v, t) => {
    burst(v, 'pink', t, 0.05, 0.25, 1, 'bandpass', 400, 2200, 2);
    tone(v, 'sine', 520, 500, t, 0.001, 0.06, 0.6);
    tone(v, 'sine', 1560, 1500, t, 0.001, 0.03, 0.2);
  }),
  'fire-turret': P(1, 0.15, 0.1, 4, 0.06, (v, t, o) => {
    const lp = v.filter(v.out, 'lowpass', 4000);
    tone(v, 'square', 1800 * o.pitch, 180 * o.pitch, t, 0.002, 0.13, 0.8, lp);
    tone(v, 'sine', 2400 * o.pitch, 600 * o.pitch, t, 0.002, 0.08, 0.5);
  }),
  // A sentry's rounds: a dry clack with a short noisy crack, quick enough to chatter through a burst.
  'fire-sentry': P(1, 0.16, 0.08, 6, 0.08, (v, t, o) => {
    burst(v, 'white', t, 0.001, 0.035, 1, 'bandpass', 2600 * o.pitch, 1800 * o.pitch, 1.5);
    tone(v, 'square', 210 * o.pitch, 120 * o.pitch, t, 0.001, 0.05, 0.6);
  }),
  'fire-thrower': P(1, 0.4, 0.1, 3, 0.08, (v, t) => {
    const am = v.gain(v.out, 0.5);
    const lfo = v.gain(am.gain, 0.5);
    const l = v.osc('square', 38, t, 0.3, lfo);
    sweep(l.frequency, 38, 70, t, 0.26);
    burst(v, 'white', t, 0.01, 0.25, 1, 'bandpass', 3000, 3600, 6, am);
    metal(v, t, 3200, 0.08, 0.25, [1, 1.47]);
  }),

  // --- projectile impacts
  'pop-bolt': P(1, 0.18, 0.08, 4, 0.06, (v, t) => {
    tone(v, 'sine', 300, 120, t, 0.001, 0.06, 1);
    burst(v, 'white', t, 0.001, 0.04, 0.6, 'bandpass', 900, 900, 2);
  }),
  'pop-arrow': P(1, 0.18, 0.08, 4, 0.06, (v, t) => {
    tone(v, 'sine', 280, 120, t, 0.001, 0.06, 1);
    burst(v, 'white', t, 0.001, 0.04, 0.5, 'bandpass', 900, 900, 2);
    const o = tone(v, 'triangle', 230, 220, t + 0.01, 0.002, 0.15, 0.3);
    v.osc('sine', 32, t, 0.2, v.gain(o.frequency, 25));
  }),
  'pop-cannonball': P(
    2,
    0.3,
    0.2,
    3,
    0.08,
    (v, t) => {
      tone(v, 'sine', 110, 40, t, 0.002, 0.25, 1);
      burst(v, 'brown', t, 0.002, 0.3, 0.9, 'lowpass', 650);
      for (let i = 0; i < 4; i++) burst(v, 'white', t + rnd(0.02, 0.18), 0.001, 0.025, 0.35, 'bandpass', rnd(1500, 3200), undefined, 2);
    },
    0.12,
  ),
  'pop-fireball': P(1, 0.32, 0.12, 4, 0.06, (v, t) => {
    burst(v, 'brown', t, 0.003, 0.25, 1, 'lowpass', 1300, 200);
    burst(v, 'crackle', t, 0.005, 0.3, 0.6, 'highpass', 3000);
  }),
  'pop-plasma': P(1, 0.17, 0.15, 4, 0.06, (v, t) => {
    tone(v, 'sine', 2000, 3500, t, 0.001, 0.05, 0.6);
    tone(v, 'sine', 1700, 1700, t, 0.002, 0.2, 0.4);
    tone(v, 'sine', 2310, 2300, t, 0.002, 0.18, 0.3);
    burst(v, 'white', t, 0.001, 0.05, 0.4, 'highpass', 5000);
  }),
  'pop-shuriken': P(1, 0.1, 0.1, 4, 0.06, (v, t) => {
    metal(v, t, 2900, 0.13, 1, [1, 1.41, 1.83]);
    burst(v, 'white', t, 0.001, 0.01, 0.6, 'highpass', 3000);
  }),

  // --- level events
  explosion: P(
    3,
    0.5,
    0.4,
    3,
    0.15,
    (v, t, o) => {
      const k = 0.6 + o.amount * 0.4;
      tone(v, 'sine', 72, 24, t, 0.003, 0.7 * k, 1);
      burst(v, 'brown', t, 0.003, 1.1 * k, 1, 'lowpass', 1500, 120);
      burst(v, 'white', t, 0.001, 0.12, 0.8, 'lowpass', 6000, 800);
      burst(v, 'crackle', t + 0.05, 0.02, 0.9 * k, 0.5, 'bandpass', 1500);
    },
    0.4,
  ),
  'crumble-start': P(1, 0.2, 0.1, 3, 0.1, (v, t) => {
    const lp = v.filter(v.out, 'lowpass', 420, 8);
    tone(v, 'sawtooth', 62, 92, t, 0.05, 0.4, 0.5, lp);
    burst(v, 'crackle', t, 0.05, 0.5, 1, 'bandpass', 1200);
  }),
  'crumble-break': P(2, 0.42, 0.2, 3, 0.1, (v, t) => {
    burst(v, 'brown', t, 0.003, 0.4, 1, 'lowpass', 900);
    burst(v, 'white', t, 0.002, 0.1, 0.5, 'bandpass', 2000);
    for (let i = 0; i < 5; i++) {
      const f = rnd(380, 900);
      tone(v, 'sine', f, f * 0.8, t + rnd(0.03, 0.32), 0.001, 0.03, 0.3);
    }
  }),

  // --- prop transients (derived from module cycles)
  'flame-ignite': P(1, 0.3, 0.1, 3, 0.1, (v, t) => {
    burst(v, 'brown', t, 0.03, 0.3, 1, 'lowpass', 200, 1500, 1);
    tone(v, 'sine', 90, 70, t, 0.02, 0.25, 0.5);
  }),
  'laser-fire': P(1, 0.17, 0.12, 3, 0.1, (v, t) => {
    const lp = v.filter(v.out, 'lowpass', 5000);
    tone(v, 'sawtooth', 1300, 280, t, 0.002, 0.16, 0.7, lp);
    tone(v, 'sine', 3000, 2600, t, 0.002, 0.1, 0.4);
  }),
  'tesla-arc': P(1, 0.18, 0.1, 3, 0.1, (v, t) => {
    burst(v, 'white', t, 0.001, 0.05, 1, 'highpass', 2000);
    burst(v, 'crackle', t, 0.002, 0.25, 1, 'bandpass', 3000, 3000, 1);
  }),
  'piston-hiss': P(0, 0.1, 0.05, 3, 0.1, (v, t) => {
    burst(v, 'white', t, 0.01, 0.12, 1, 'highpass', 3000);
  }),
  'piston-slam': P(1, 0.2, 0.15, 3, 0.1, (v, t) => {
    tone(v, 'sine', 140, 60, t, 0.001, 0.15, 1);
    metal(v, t, 380, 0.22, 0.5);
    burst(v, 'white', t, 0.001, 0.02, 0.5, 'bandpass', 2500);
  }),
  swoosh: P(0, 0.4, 0.05, 4, 0.1, (v, t, o) => {
    burst(v, 'pink', t, 0.06, 0.16, 1, 'bandpass', 500 * o.pitch, 1500 * o.pitch, 2);
  }),

  // --- UI / phases
  whoosh: P(2, 0.34, 0.15, 2, 0.2, (v, t) => {
    burst(v, 'pink', t, 0.12, 0.3, 1, 'bandpass', 400, 2000, 1.4);
  }),
  // A sentry spotting someone: two quick rising beeps.
  'sentry-beep': P(2, 0.13, 0.05, 3, 0.2, (v, t, o) => {
    const lp = v.filter(v.out, 'lowpass', 3200);
    tone(v, 'square', 1320 * o.pitch, 1320 * o.pitch, t, 0.002, 0.06, 0.8, lp);
    tone(v, 'square', 1760 * o.pitch, 1760 * o.pitch, t + 0.09, 0.002, 0.08, 0.8, lp);
  }),
  'ui-hover': P(0, 0.06, 0, 4, 0.06, (v, t, o) => {
    tone(v, 'sine', 1250 * o.pitch, 1250 * o.pitch, t, 0.002, 0.03, 1);
  }),
  'ui-click': P(2, 0.09, 0.05, 4, 0.05, (v, t, o) => {
    tone(v, 'triangle', 720 * o.pitch, 480 * o.pitch, t, 0.001, 0.05, 1);
    burst(v, 'white', t, 0.001, 0.01, 0.4, 'highpass', 3000);
  }),
  'ui-toggle': P(2, 0.11, 0.05, 4, 0.05, (v, t, o) => {
    const up = o.variant !== 'off';
    tone(v, 'triangle', (up ? 520 : 780) * o.pitch, (up ? 520 : 780) * o.pitch, t, 0.002, 0.05, 0.9);
    tone(v, 'triangle', (up ? 780 : 520) * o.pitch, (up ? 780 : 520) * o.pitch, t + 0.06, 0.002, 0.08, 0.9);
  }),
  'ui-tick': P(2, 0.1, 0, 6, 0.05, (v, t, o) => {
    if (o.variant === 'urgent') {
      const lp = v.filter(v.out, 'lowpass', 2500);
      tone(v, 'square', 880 * o.pitch, 880 * o.pitch, t, 0.002, 0.07, 0.8, lp);
    } else tone(v, 'sine', 1500 * o.pitch, 1500 * o.pitch, t, 0.001, 0.03, 1);
  }),
  join: P(2, 0.15, 0.2, 4, 0.05, (v, t, o) => {
    tone(v, 'sine', 380 * o.pitch, 900 * o.pitch, t, 0.003, 0.08, 0.8);
    o.notes.forEach((m, i) => tone(v, 'triangle', mtof(m), mtof(m), t + 0.07 + i * 0.07, 0.003, 0.2, 0.7));
  }),
  reroll: P(1, 0.11, 0.05, 2, 0.1, (v, t, o) => {
    for (let i = 0; i < 4; i++) tone(v, 'triangle', 600 * o.pitch * 1.12 ** i, 600 * o.pitch * 1.12 ** i, t + i * 0.035, 0.001, 0.03, 0.8);
  }),
} satisfies Record<string, SfxDef>;

export type SfxName = keyof typeof SFX;
export const SFX_NAMES = Object.keys(SFX) as SfxName[];
