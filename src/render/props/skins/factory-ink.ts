import { css, type HSL } from '../../../core/color';
import { blob, inkFor, type P } from '../../ink';
import { barLine, path, pen, poly, tone } from '../../ink-props';
import type { DrawCtx } from '../common';

/**
 * The factory skins' shared pen (./factory.ts, ./factory-works.ts): the theme's paint and steel, and the
 * backdrop tones its landmark shells are drawn in, hazed toward the sky and penned in a dark of each tone.
 */

export const STEEL: HSL = { h: 212, s: 9, l: 46 };
export const IRON: HSL = { h: 215, s: 10, l: 30 };
export const CONCRETE: HSL = { h: 34, s: 8, l: 46 };
export const HAZARD: HSL = { h: 46, s: 78, l: 54 };
export const PAINT: HSL = { h: 12, s: 48, l: 44 };
/** The wheel's stand, in machinery yellow. */
export const FRAME: HSL = { h: 44, s: 56, l: 50 };

/** Share of the way a shell's tones go toward the sky's haze: back, but still the biggest thing in the level. */
export const HAZE = 0.26;

/** A shell's tones under this level's sky: pulled toward its fog, and a pen that's a dark of the tone, not black. */
export function hazer(d: DrawCtx) {
  const fog = d.o.level?.theme.fog;
  const hsl = (c: HSL): HSL => (fog ? { h: c.h, s: c.s * (1 - HAZE * 1.3), l: c.l + (fog.l - c.l) * HAZE } : c);
  return {
    key: fog ? `${fog.h | 0},${fog.s | 0},${fog.l | 0}` : '-',
    hsl,
    c: (base: HSL, dl = 0) => css(hsl(base), dl),
    ink: (base: HSL) => css({ h: base.h, s: base.s * 0.5, l: Math.max(5, hsl(base).l * 0.26) }),
  };
}
export type Haze = ReturnType<typeof hazer>;

/** A girder drawn with the backdrop pen: its hazed tone in a thin rim of its own dark, and a lit flange toward the light. */
export function member(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, base: HSL, t: Haze, seed: number) {
  barLine(g, ax, ay, bx, by, w, t.hsl(base), seed, { ink: t.ink(base), rim: 0.3, press: 0.05, lit: w > 1.5 ? 12 : 0 });
}

/** A flat shape in a hazed tone, penned in a dark of itself. */
export function flat(g: CanvasRenderingContext2D, pts: readonly P[], base: HSL, t: Haze, seed: number, depth = 1) {
  tone(g, pts, t.hsl(base), { depth });
  pen(g, pts, seed, 0.4, 1, 3, t.ink(base));
}

/** Rivets along a segment, every `step` px. */
export function rivets(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, step: number, r: number, col: string, seed: number) {
  const L = Math.hypot(bx - ax, by - ay);
  const n = Math.max(1, Math.floor(L / step));
  g.fillStyle = col;
  for (let i = 0; i <= n; i++) {
    blob(g, ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n, r, seed + i, 1, 0.1);
    g.fill();
  }
}

/** Hazard bands across a rect, clipped to it. */
export function bands(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t?: Haze) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = t ? t.c(HAZARD) : css(HAZARD);
  g.fillRect(x, y, w, h);
  g.fillStyle = t ? t.ink(HAZARD) : inkFor(HAZARD);
  for (let k = x - h; k < x + w + h; k += 5) {
    path(g, poly(k, y + h, k + 2.4, y + h, k + 2.4 + h, y, k + h, y));
    g.fill();
  }
  g.restore();
}
