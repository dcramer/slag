import { hash2 } from '../../core/rng';
import { type D, mark, oval, poly, spot, stalk, toned, tonedOval } from './draw';

/** Shared bits more than one direction draws: a body-height helper, wings, antennae, a muzzle. */

/** Body y at fraction `u` of its height (0 bottom, 1 top). */
export const Y = (d: D, u: number) => d.by - d.H * u;

export const airborne = (d: D) => d.m === 'up' || d.m === 'fall' || d.m === 'wall' || d.m === 'cheer';

/** Two pale wings off the upper back that buzz in the air and twitch at rest. */
export function wings(d: D, rx = 3.1, ry = 4.6, fill = '#eef6ff', shade = '#b6cadf') {
  const flap = airborne(d) ? Math.sin(d.t * 55) * 0.55 : Math.sin(d.t * 3.3) * 0.08;
  for (const side of [-1, 1]) {
    const cx = side * d.W * 0.34 - d.f * 1.6;
    const cy = d.top + 1.2;
    const rot = side * (0.55 + flap);
    toned(d.s, oval(cx + side * Math.sin(rot) * ry * 0.6, cy - Math.cos(rot) * ry * 0.6, rx, ry, 12, rot), fill, shade, d.pal.ink, 0.5, 0.9 * d.k, 0.6);
  }
}

/** Two antennae with knobs. */
export function antennae(d: D, len = 5.5, spread = 0.22, knob = 1.4, fill = d.pal.dark, shade = d.pal.darkShade) {
  for (const side of [-1, 1]) {
    const x0 = side * d.W * spread + d.f * 0.6;
    stalk(d, x0, d.top + 2, x0 + side * 2.6 + d.wob * 0.5, d.top - len, knob, fill, shade);
  }
}

/** A row of `n` ink spots of radius `r` scattered over the body, keyed to the seed. Spots under the face shrink. */
export function scatter(d: D, n: number, r: number, fill: string, salt: number, lo = 0.08, hi = 0.95, ring?: string) {
  for (let i = 0; i < n; i++) {
    const a = hash2(d.sd, i, salt);
    const b = hash2(d.sd, i, salt + 1);
    const x = (a - 0.5) * d.W * 0.95;
    const u = lo + b * (hi - lo);
    const y = Y(d, u);
    const nearFace = Math.abs(x) < d.W * 0.3 && u > 0.38 && u < 0.72;
    const rr = r * (0.7 + hash2(d.sd, i, salt + 2) * 0.6) * (nearFace ? 0.55 : 1);
    spot(d.s, x, y, rr, rr * 0.9, d.sd + i * 7 + salt, fill, 0.25, a * 6);
    if (ring) spot(d.s, x + 0.2, y + 0.1, rr * 0.5, rr * 0.45, d.sd + i * 7 + salt + 3, ring, 0.2);
  }
}

/** Where `mouth()` puts the mouth, in face space. */
export const mouthY = (d: D) => Math.min(d.by - 2.6, d.by - d.H * d.c.eyes.y + d.c.eyes.size * 1.24 * (d.c.eyes.count === 3 ? 1.2 : 1) + 2.9);
export const mouthX = (d: D) => Math.max(-d.W / 2 + 4, Math.min(d.W / 2 - 4, d.f * 1.5));

/** A pale muzzle across the mouth line, drawn before the face so the mouth sits on it. */
export function muzzle(d: D, fill: string, w = 0.36, h = 0.17, shade = d.pal.lightShade) {
  tonedOval(d.s, mouthX(d) + d.lk.skew * d.f * 0.55, mouthY(d) - 0.6, d.W * w, d.H * h, 12, fill, shade, d.pal.ink, 0.45, 0.8 * d.k, 0.5);
}

/** Tapered stripes coming in from each side, like a cat's or a tiger's. */
export function sideStripes(d: D, n: number, len: number, w: number, color: string, salt: number) {
  for (let i = 0; i < n; i++) {
    const u = 0.15 + (i / Math.max(1, n - 1)) * 0.6 + (hash2(d.sd, i, salt) - 0.5) * 0.06;
    for (const side of [-1, 1]) {
      const x0 = side * d.W * 0.6;
      const y0 = Y(d, u);
      mark(
        d.s,
        color,
        [
          { x: x0, y: y0 },
          { x: x0 - side * d.W * len * 0.5, y: y0 - 0.6 },
          { x: x0 - side * d.W * len, y: y0 - 1.6 + hash2(d.sd, i, salt + side) },
        ],
        w,
        d.sd + i + side,
        [0, 0.8],
      );
    }
  }
}

/** A curl of `n` points, for a pig's tail or a snail's shell. */
export function spiral(cx: number, cy: number, r: number, turns: number, n = 18) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * turns * Math.PI * 2;
    const rr = r * (1 - t * 0.85);
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  return pts;
}

export { poly };
