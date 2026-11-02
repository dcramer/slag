import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { type P } from '../../ink';
import { boxPts, path, pen, tick, tone } from '../../ink-props';
import type { DrawCtx } from '../common';

/**
 * The castle skins' shared kit (./castle.ts, ./castle-stage.ts): the haze every backdrop shell sinks
 * toward, a flat two-tone shape with a light pen in its own dark, a doorway seen through its opening, and
 * the castle's colours. Shells are scenery, never a slab to stand on (docs/ART.md, Fair play).
 */

export const HAZE = 0.28;
/** A hazed tone: toward the level's fog in lightness and saturation, never in hue. */
export function hz(d: DrawCtx) {
  const fog = d.o.level?.theme.fog;
  const k = fog ? `${fog.h | 0},${fog.l | 0}` : '-';
  const hsl = (c: HSL): HSL => (fog ? { h: c.h, s: c.s * (1 - HAZE), l: c.l + (fog.l - c.l) * HAZE } : c);
  return { k, hsl, c: (b: HSL, dl = 0, a = 1) => css(hsl(b), dl, a), ink: (b: HSL) => css({ h: b.h, s: b.s * 0.5, l: Math.max(5, hsl(b).l * 0.3) }) };
}
export type Hz = ReturnType<typeof hz>;

export function flat(g: CanvasRenderingContext2D, pts: readonly P[], base: HSL, t: Hz, seed: number, depth = 0.6) {
  tone(g, pts, t.hsl(base), { depth });
  pen(g, pts, seed, 0.3, 0.8, 3, t.ink(base));
}

/**
 * A coursed stone wall over (x, y, w, h) in a hazed tone: the face flat, about a third of the blocks cut by hand in
 * a second tone, and a joint where one block meets the next, lifted often. Never a ruled grid of joints.
 */
export function ashlar(g: CanvasRenderingContext2D, t: Hz, x: number, y: number, w: number, h: number, stone: HSL, seed: number, course = 9) {
  tone(g, boxPts(x, y, w, h, 0.4, seed, 0.05), t.hsl(stone), { depth: 0.4 });
  const len = course * 2.3;
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  for (let yy = y + 1, row = 0; yy < y + h - 2; yy += course, row++) {
    for (let xx = x + (row & 1 ? -len / 2 : 0), j = 0; xx < x + w; xx += len, j++) {
      const k = hash2(j, row, seed);
      if (k < 0.36) {
        g.fillStyle = t.c(stone, k < 0.18 ? 4 : -4);
        path(g, boxPts(xx + 0.7, yy + 0.7, len - 1.4, course - 1.4, 1.1, (j * 31 + row + seed) | 0, 0.3));
        g.fill();
      }
      const joint = t.c(stone, -11);
      if (k > 0.3) tick(g, xx, yy + 1, xx + 0.2, yy + course - 1, 0.5, j * 7 + row, joint);
      if (hash2(row, j, seed + 5) < 0.55) tick(g, xx + 1.5, yy, xx + len - 1.5, yy + 0.3, 0.5, j * 11 + row, joint);
    }
  }
  g.restore();
}

/** A doorway through a wall, seen behind its opening: the wall's reveal down both sides, a dark arch, a threshold. */
export function doorway(g: CanvasRenderingContext2D, t: Hz, x: number, y: number, w: number, h: number, wall: HSL, seed: number) {
  flat(g, boxPts(x, y, w, h, 0.4, seed, 0.05), wall, t, seed, 0.5);
  const j = 4;
  const r = (w - 2 * j) / 2;
  const arch: P[] = [{ x: x + j, y: y + h }];
  for (let k = 0; k <= 10; k++) arch.push({ x: x + j + r - Math.cos((k / 10) * Math.PI) * r, y: y + r + 2 - Math.sin((k / 10) * Math.PI) * r });
  arch.push({ x: x + w - j, y: y + h });
  flat(g, arch, { h: 250, s: 18, l: 7 }, t, seed + 1, 0.2);
  flat(g, boxPts(x - 1, y + h - 3, w + 2, 3, 0.3, seed + 2), { h: 30, s: 6, l: 40 }, t, seed + 2, 0.3);
}

export const GILT: HSL = { h: 42, s: 58, l: 46 };
export const WOOD: HSL = { h: 22, s: 38, l: 20 };
export const CANDLE: HSL = { h: 40, s: 100, l: 62 };
export const MOON: HSL = { h: 214, s: 58, l: 76 };
export const STONE: HSL = { h: 30, s: 8, l: 30 };
export const BANNER: HSL = { h: 354, s: 62, l: 32 };
