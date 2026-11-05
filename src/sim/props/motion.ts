import { dcos, dhypot, dsin } from '../../core/dmath';
import { frac, pingPong, type Vec } from '../../core/geom';
import { moduleSim } from './registry';
import type { Carry, Module, Motion, PropState, Resolved } from './types';

/**
 * Where a part is at a frame: its own motion (rail, loop, track), what it rides, and the cycles its modules run on.
 * Pure arithmetic on (part, frame), shared by the sim, the proofs, the bots and the art.
 */

export function newPropState(): PropState {
  return { triggerFrame: -1, brokenUntil: -1, lastFire: -999, aim: new Map(), vars: new Map() };
}

/** Round tiny float noise from cos/sin of axis-aligned angles. */
export function snap(v: number): number {
  return Math.abs(v) < 1e-9 ? 0 : Math.abs(Math.abs(v) - 1) < 1e-9 ? Math.sign(v) : v;
}

export function dirOf(angle: number): Vec {
  return [snap(dcos(angle)), snap(dsin(angle))];
}

/** Whole-prop translation (px) at frame f: its own motion, plus the travel of whatever it rides (./ride.ts). */
export function motionOffset(r: Resolved, f: number): Vec {
  const own = ownOffset(r, f);
  if (!r.carry) return own;
  const [cx, cy] = carryAt(r.carry, f);
  return [own[0] + cx, own[1] + cy];
}

/**
 * How far a carrier has moved a rider at frame f (px): the carrying solid's
 * position less the stored base. One function for the sim, the proof and the
 * art, so a rider is drawn exactly where it stands.
 */
export function carryAt(c: Carry, f: number): Vec {
  const [px, py] = carrierPos(c.by, c.mi, c.part, f);
  return [px - c.base[0], py - c.base[1]];
}

/** Where solid `part` of module `mi` sits at frame f (px), relative to an arbitrary fixed origin of its own: the prop's offset plus what the module adds. */
export function carrierPos(r: Resolved, mi: number, part: number, f: number): Vec {
  const [ox, oy] = motionOffset(r, f);
  const m = r.mods[mi];
  const at = m && moduleSim(m.type).carrier?.at(m, f, r.phase, part);
  return at ? [ox + at[0], oy + at[1]] : [ox, oy];
}

function ownOffset(r: Resolved, f: number): Vec {
  const m = r.motion;
  if (m.type === 'rail') {
    const d = m.stops?.length
      ? stopsAt(f, m.period, m.dwell ?? 0, m.range, m.stops, r.phase)
      : (m.dwell ? liftAt(f, m.period, m.dwell, r.phase) : pingPong(f / m.period + r.phase)) * m.range;
    return [snap(dcos(m.angle)) * d, snap(dsin(m.angle)) * d];
  }
  if (m.type === 'loop') {
    const a = m.dir * Math.PI * 2 * (f / m.period + r.phase);
    return [(dcos(a) - 1) * m.radius, dsin(a) * m.radius];
  }
  if (m.type === 'track') return trackAt(m.pts, m.closed, frac(f / m.period + r.phase));
  return [0, 0];
}

/**
 * A rail with stops, 0 → 1 → 0 over `period + 2 * dwell` frames: parked at 0
 * for `dwell` frames, eased out over half the period, parked at 1 for `dwell`,
 * eased back. Counted in whole frames, so every stop lasts exactly as long and
 * parks exactly at its end: a lift's floor lines up with the tiles it serves,
 * which is what the carrier ride proof needs (gen/level/ride.ts).
 */
function liftAt(f: number, period: number, dwell: number, phase: number): number {
  const total = period + 2 * dwell;
  const half = period / 2;
  let t = (((f + Math.floor(phase * total)) % total) + total) % total;
  if (t < dwell) return 0;
  t -= dwell;
  if (t < half) return (1 - dcos((Math.PI * t) / half)) / 2;
  t -= half;
  if (t < dwell) return 1;
  t -= dwell;
  return (1 + dcos((Math.PI * t) / half)) / 2;
}

/**
 * A rail lift that also parks at `stops` on the way (a manor's floors), in px
 * along the rail: parked at 0, eased up leg by leg with a `dwell` at every
 * stop, parked at `range`, and back down the same way. Each leg takes its
 * share of half the period by its length, so the cab keeps one pace; every
 * park returns its stop exactly, so the cab's floor lines up with the tiles.
 */
function stopsAt(f: number, period: number, dwell: number, range: number, stops: readonly number[], phase: number): number {
  const legs = stops.length + 1;
  const total = period + dwell * 2 * legs;
  let t = (((f + Math.floor(phase * total)) % total) + total) % total;
  const at = (i: number) => (i <= 0 ? 0 : i > stops.length ? range : stops[i - 1]);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < legs; i++) {
      // Up: stop i to stop i + 1; down: the same legs from the top.
      const a = pass === 0 ? at(i) : at(legs - i);
      const b = pass === 0 ? at(i + 1) : at(legs - i - 1);
      if (t < dwell) return a;
      t -= dwell;
      const span = (period / 2) * (Math.abs(b - a) / range);
      if (t < span) return a + ((b - a) * (1 - dcos((Math.PI * t) / span))) / 2;
      t -= span;
    }
  }
  return 0;
}

/**
 * Where a track puts its body at lap fraction `u`, in px: constant speed along
 * the polyline. A closed track runs pts[0] → … → pts[n-1] → pts[0], one way
 * round; an open one runs out to its last point and back the way it came, so a
 * lap is twice its length and it turns round only at its ends. Arithmetic and
 * square roots only (both exact across browsers), and nothing allocated: this
 * runs for every module of every moving prop, every frame.
 */
function trackAt(pts: readonly Vec[], closed: boolean, u: number): Vec {
  const n = pts.length;
  if (n < 2) return n ? [pts[0][0], pts[0][1]] : [0, 0];
  const segs = closed ? n : n - 1;
  let len = 0;
  for (let i = 0; i < segs; i++) len += segLen(pts, i);
  if (len === 0) return [pts[0][0], pts[0][1]];
  let s = u * (closed ? len : 2 * len);
  if (!closed && s > len) s = 2 * len - s;
  for (let i = 0; i < segs; i++) {
    const l = segLen(pts, i);
    if (s <= l || i === segs - 1) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const k = l ? Math.min(1, s / l) : 0;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
    s -= l;
  }
  return [pts[0][0], pts[0][1]];
}

function segLen(pts: readonly Vec[], i: number): number {
  const a = pts[i];
  const b = pts[(i + 1) % pts.length];
  return dhypot(b[0] - a[0], b[1] - a[1]);
}

export interface CycleState {
  /** Index of the current segment. */
  seg: number;
  /** Frames into the segment. */
  t: number;
  len: number;
}

/** Position within a repeating sequence of segments, offset by the prop's phase. */
export function cycle(f: number, phase: number, lens: number[]): CycleState {
  const total = lens.reduce((a, b) => a + b, 0);
  let t = (((f + Math.floor(phase * total)) % total) + total) % total;
  for (let i = 0; i < lens.length; i++) {
    if (t < lens[i]) return { seg: i, t, len: lens[i] };
    t -= lens[i];
  }
  return { seg: lens.length - 1, t: 0, len: lens[lens.length - 1] };
}

/** Longest sweep looked at (frames): chains of movers with unrelated periods stop here. */
const MAX_SWEEP = 2400;

/** Frames in one cycle of a whole-prop motion: a rail with stops parks at every one of them on the way up and down. */
export function motionPeriod(m: Motion): number {
  if (m.type === 'rail') return m.period + 2 * (m.dwell ?? 0) * (1 + (m.stops?.length ?? 0));
  if (m.type === 'loop' || m.type === 'track') return m.period;
  return 0;
}

/** Frames until a part's own motion and its whole chain of carriers are back where they started (capped). */
export function rideSpan(r: Resolved): number {
  let span = 1;
  const own = motionPeriod(r.motion);
  if (own > 0) span = Math.min(MAX_SWEEP, Math.round(own));
  for (let c = r.carry; c; c = c.by.carry) {
    const m = c.by.mods[c.mi];
    for (const p of [motionPeriod(c.by.motion), m ? (moduleSim(m.type).carrier?.period(m) ?? 0) : 0])
      if (p > 0) span = Math.min(MAX_SWEEP, lcm(span, Math.round(p)));
  }
  return span;
}

function lcm(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y) [x, y] = [y, x % y];
  return (a / x) * b;
}

/** Frames for one full cycle of every timed module and the piece's own motion (bounded). */
export function cycleFrames(mods: readonly Module[], motion: Motion = { type: 'none' }): number {
  let p = 120;
  if (motion.type === 'rail') p = Math.max(p, motion.period + 2 * (motion.dwell ?? 0) * (1 + (motion.stops?.length ?? 0)));
  if (motion.type === 'loop' || motion.type === 'track') p = Math.max(p, motion.period);
  for (const m of mods) {
    if (m.type === 'rotor') p = Math.max(p, m.period);
    if (m.type === 'vehicle') p = Math.max(p, 2 * (Math.round(m.span / (m.speed / 60)) + m.pause) + 4);
    if (m.type === 'piston') p = Math.max(p, m.period);
    if (m.type === 'geyser') p = Math.max(p, m.off + m.warn + m.on);
    if (m.type === 'tesla') p = Math.max(p, m.off + m.warn + m.on);
    if (m.type === 'flame') p = Math.max(p, m.off + m.warn + m.on);
    if (m.type === 'flood') p = Math.max(p, m.off + m.warn + m.rise + m.hold + m.fall);
    if (m.type === 'lob') p = Math.max(p, m.off + m.warn + m.flight + Math.max(0, m.count - 1) * m.lag);
    if (m.type === 'cavein') p = Math.max(p, m.off + m.warn + m.on);
    if (m.type === 'cart') p = Math.max(p, m.off + m.warn + m.run + m.back);
    if (m.type === 'sign') p = Math.max(p, m.off + m.warn + m.fall + m.live + m.lift);
    if (m.type === 'wire') p = Math.max(p, m.off + m.warn + m.run);
    if (m.type === 'neon') p = Math.max(p, m.off + m.warn + m.on);
    if (m.type === 'thaw') p = Math.max(p, m.frozen + m.warn + m.open);
    if (m.type === 'ladle') p = Math.max(p, m.off + m.warn + m.pour + m.set);
    if (m.type === 'arm') p = Math.max(p, m.rest + m.warn + m.strike + m.weld + m.back);
  }
  return Math.min(p, 1600);
}
