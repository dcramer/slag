import type { Emitter, LoopKind } from './emitters';
import { type Listener, loopGain, panFor } from './spatial';
import { type NoiseKind, noiseBuffer } from './synth';

/**
 * Continuous hazard sounds. Each loop kind has a small fixed pool of
 * long-lived synth patches (e.g. 2 saw whines); every frame the loudest
 * emitters of that kind (after distance rolloff) are assigned to the pool
 * and the rest fold their energy into the last voice. Patches are built
 * lazily, all parameter changes are smoothed with setTargetAtTime (no
 * zipper noise / clicks), and idle patches are torn down after a few
 * seconds so a quiet level costs nothing.
 */

interface Patch {
  out: GainNode;
  pan: StereoPannerNode;
  set(p: number, t: number): void;
  stop(t: number): void;
}

interface KindSpec {
  max: number;
  gain: number;
  build(b: PatchBuilder): (p: number, t: number) => void;
}

/** Tiny helper that tracks sources so a patch can stop them all. */
class PatchBuilder {
  srcs: AudioScheduledSourceNode[] = [];
  constructor(
    readonly ctx: BaseAudioContext,
    readonly out: AudioNode,
  ) {}
  gain(to: AudioNode | AudioParam, v: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = v;
    g.connect(to as AudioNode);
    return g;
  }
  filter(to: AudioNode, type: BiquadFilterType, f: number, q = 0.7): BiquadFilterNode {
    const n = this.ctx.createBiquadFilter();
    n.type = type;
    n.frequency.value = f;
    n.Q.value = q;
    n.connect(to);
    return n;
  }
  osc(type: OscillatorType, f: number, to: AudioNode | AudioParam): OscillatorNode {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.connect(to as AudioNode);
    o.start();
    this.srcs.push(o);
    return o;
  }
  noise(kind: NoiseKind, to: AudioNode, rate = 1): AudioBufferSourceNode {
    const s = this.ctx.createBufferSource();
    s.buffer = noiseBuffer(this.ctx, kind);
    s.loop = true;
    s.playbackRate.value = rate;
    s.connect(to);
    s.start(this.ctx.currentTime, Math.random() * 1.5);
    this.srcs.push(s);
    return s;
  }
}

const tc = 0.06;

export const LOOP_SPECS: Record<LoopKind, KindSpec> = {
  saw: {
    max: 2,
    gain: 0.3,
    build(b) {
      const amp = b.gain(b.out, 0.65);
      const bp = b.filter(amp, 'bandpass', 2600, 1.2);
      const base = 1100 + Math.random() * 160;
      const o1 = b.osc('sawtooth', base, b.gain(bp, 0.5));
      const o2 = b.osc('sawtooth', base * 1.505, b.gain(bp, 0.3));
      b.noise('white', b.filter(b.gain(amp, 0.25), 'highpass', 4500));
      b.osc('square', 41 + Math.random() * 6, b.gain(amp.gain, 0.3));
      return (p, t) => {
        o1.frequency.setTargetAtTime(base * (0.9 + p * 0.2), t, 0.1);
        o2.frequency.setTargetAtTime(base * 1.505 * (0.9 + p * 0.2), t, 0.1);
      };
    },
  },
  flame: {
    max: 2,
    gain: 0.6,
    build(b) {
      const amp = b.gain(b.out, 0.75);
      const lp = b.filter(amp, 'lowpass', 750, 0.8);
      b.noise('brown', b.gain(lp, 1));
      b.noise('pink', b.filter(b.gain(amp, 0.3), 'bandpass', 1700, 0.8), 0.9);
      b.noise('crackle', b.filter(b.gain(amp, 0.35), 'highpass', 2500), 0.8);
      const depth = b.gain(amp.gain, 0);
      b.osc('sine', 11, depth);
      return (p, t) => {
        depth.gain.setTargetAtTime(p * 0.5, t, tc);
        lp.frequency.setTargetAtTime(p ? 380 : 750, t, tc);
      };
    },
  },
  laserCharge: {
    max: 1,
    gain: 0.17,
    build(b) {
      const o1 = b.osc('triangle', 220, b.gain(b.out, 0.6));
      const o2 = b.osc('sine', 442, b.gain(b.out, 0.25));
      const vib = b.gain(o1.frequency, 4);
      b.osc('sine', 7, vib);
      return (p, t) => {
        const f = 220 * 2 ** (p * 2.5);
        o1.frequency.setTargetAtTime(f, t, 0.03);
        o2.frequency.setTargetAtTime(f * 2.01, t, 0.03);
        vib.gain.setTargetAtTime(f * 0.012, t, 0.05);
      };
    },
  },
  laserFire: {
    max: 1,
    gain: 0.23,
    build(b) {
      const amp = b.gain(b.out, 0.8);
      const lp = b.filter(amp, 'lowpass', 1800, 2);
      b.osc('square', 110, b.gain(lp, 0.4));
      b.osc('sawtooth', 220.7, b.gain(lp, 0.3));
      b.osc('sine', 60, b.gain(amp.gain, 0.2));
      b.noise('white', b.filter(b.gain(b.out, 0.1), 'highpass', 6000));
      return () => {};
    },
  },
  tesla: {
    max: 2,
    gain: 0.6,
    build(b) {
      b.noise('crackle', b.filter(b.gain(b.out, 1), 'bandpass', 3000, 0.7));
      b.noise('crackle', b.filter(b.gain(b.out, 0.5), 'highpass', 6000), 1.3);
      const buzz = b.gain(b.out, 0);
      b.osc('sawtooth', 120, b.filter(buzz, 'lowpass', 900));
      return (p, t) => buzz.gain.setTargetAtTime(p * 0.35, t, tc);
    },
  },
  fan: {
    max: 1,
    gain: 0.28,
    build(b) {
      const amp = b.gain(b.out, 0.8);
      b.noise('pink', b.filter(amp, 'bandpass', 700, 0.6));
      b.osc('sine', 13, b.gain(amp.gain, 0.2));
      b.osc('sine', 95, b.gain(b.out, 0.15));
      return () => {};
    },
  },
  conveyor: {
    max: 1,
    gain: 0.25,
    build(b) {
      b.noise('brown', b.filter(b.gain(b.out, 1), 'lowpass', 220));
      b.osc('square', 9, b.filter(b.gain(b.out, 0.2), 'highpass', 1500));
      b.osc('triangle', 55, b.gain(b.out, 0.12));
      return () => {};
    },
  },
  slide: {
    max: 2,
    gain: 0.24,
    build(b) {
      const bp = b.filter(b.gain(b.out, 1), 'bandpass', 2600, 1.2);
      b.noise('white', bp);
      return (p, t) => bp.frequency.setTargetAtTime(p ? 900 : 2600, t, tc);
    },
  },
};

interface Slot {
  patch: Patch | null;
  idleSince: number;
  /** Last targets sent, so we only automate on real changes. */
  g: number;
  pan: number;
  p: number;
}

export class LoopBank {
  private slots = new Map<LoopKind, Slot[]>();
  private byKind = new Map<LoopKind, Emitter[]>();

  constructor(
    readonly ctx: BaseAudioContext,
    readonly dest: AudioNode,
  ) {
    for (const k of Object.keys(LOOP_SPECS) as LoopKind[]) {
      this.slots.set(
        k,
        Array.from({ length: LOOP_SPECS[k].max }, () => ({ patch: null, idleSince: 0, g: -1, pan: 0, p: -1 })),
      );
      this.byKind.set(k, []);
    }
  }

  private make(kind: LoopKind): Patch {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    const pan = ctx.createStereoPanner();
    out.connect(pan).connect(this.dest);
    const b = new PatchBuilder(ctx, out);
    const set = LOOP_SPECS[kind].build(b);
    return {
      out,
      pan,
      set,
      stop: (t) => {
        for (const s of b.srcs) s.stop(t);
        b.srcs[0].onended = () => {
          out.disconnect();
          pan.disconnect();
        };
      },
    };
  }

  /** Retarget every loop for this frame's emitters. Pass an empty list to fade everything out. */
  update(emitters: readonly Emitter[], L: Listener, fade = tc): void {
    const t = this.ctx.currentTime;
    for (const list of this.byKind.values()) list.length = 0;
    for (const e of emitters) this.byKind.get(e.kind)?.push(e);
    for (const [kind, slots] of this.slots) {
      const spec = LOOP_SPECS[kind];
      const list = this.byKind.get(kind)!;
      const scored = list.map((e) => ({ e, g: e.level * loopGain(e.x, e.y, L) })).sort((a, b) => b.g - a.g);
      // Fold the energy of emitters beyond the pool into the last voice.
      let rest = 0;
      for (let i = slots.length; i < scored.length; i++) rest += scored[i].g ** 2;
      slots.forEach((s, i) => {
        const hit = scored[i];
        let g = hit ? hit.g : 0;
        if (hit && i === Math.min(slots.length, scored.length) - 1) g = Math.min(1, Math.sqrt(g * g + rest));
        if (g > 0.003 && !s.patch) {
          s.patch = this.make(kind);
          s.g = s.p = -1;
        }
        const p = s.patch;
        if (!p) return;
        if (Math.abs(g - s.g) > 0.002 || (g === 0 && s.g !== 0)) {
          p.out.gain.setTargetAtTime(g * spec.gain, t, fade);
          s.g = g;
        }
        if (hit) {
          const pan = panFor(hit.e.x, L);
          if (Math.abs(pan - s.pan) > 0.01) p.pan.pan.setTargetAtTime((s.pan = pan), t, 0.08);
          if (Math.abs(hit.e.p - s.p) > 0.01) p.set((s.p = hit.e.p), t);
        }
        if (g > 0.003) s.idleSince = t;
        else if (t - s.idleSince > 3) {
          p.stop(t + 0.3);
          s.patch = null;
        }
      });
    }
  }

  /** Fade every loop out (leaving a race); patches tear down once idle. */
  silence(L: Listener, fade = 0.15): void {
    this.update([], L, fade);
  }

  /** Live patch count (diagnostics/tests). */
  get live(): number {
    let n = 0;
    for (const s of this.slots.values()) for (const x of s) if (x.patch) n++;
    return n;
  }
}
