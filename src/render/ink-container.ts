import { css, type HSL, shift } from '../core/color';
import { hash2 } from '../core/rng';
import { TILE } from '../sim/constants';
import { line } from './ink';
import type { InkMaterial } from './ink-material';

/**
 * Shipping containers, as a terrain material (the harbor's Container Terminal wears it as its landmark skin).
 * The boxes sit on a lattice fixed in the world, four tiles long and two high, every other course shifted by
 * half a box, so a stack reads as boxes stacked bond-wise, however the generator cut it. Each box gets a paint
 * from the level's seed, corrugated ribs, a rail along its top, corner castings, a stencil code (marks, no
 * letters) on some, and where a stack ends, the door end: two locking bars and their handles. Everything is
 * keyed to world tiles, so a crater only changes the boxes it hits.
 */

const BOX_W = 4;
const BOX_H = 2;
const PAINTS: HSL[] = [
  { h: 6, s: 58, l: 40 },
  { h: 206, s: 50, l: 38 },
  { h: 146, s: 34, l: 32 },
  { h: 32, s: 72, l: 46 },
  { h: 186, s: 44, l: 34 },
  { h: 350, s: 36, l: 30 },
  { h: 48, s: 70, l: 50 },
  { h: 220, s: 8, l: 62 },
];

/** The box a tile belongs to: its course, its index along the course, and where it starts (tiles). */
function boxOf(x: number, y: number) {
  const course = Math.floor(y / BOX_H);
  const shiftX = (course & 1) * (BOX_W / 2);
  const bx = Math.floor((x + shiftX) / BOX_W);
  return { course, bx, x0: bx * BOX_W - shiftX, y0: course * BOX_H };
}

export const containers: InkMaterial = (p) => {
  const { g, seed, ink } = p;
  for (let y = p.span.ty0; y <= p.span.ty1; y++) {
    for (let x = p.span.tx0; x <= p.span.tx1; x++) {
      if (!p.inside(x, y)) continue;
      const b = boxOf(x, y);
      const paint = PAINTS[Math.floor(hash2(b.bx, b.course, seed + 31) * PAINTS.length)];
      const wx = x * TILE;
      const wy = y * TILE;
      g.fillStyle = css(paint);
      g.fillRect(wx - 0.5, wy - 0.5, TILE + 1, TILE + 1);
      // Corrugation: ribs pressed into the side, shadowed one side and lit the other.
      for (let k = 1.4; k < TILE; k += 3.2) {
        g.fillStyle = css(shift(paint, -10, 2));
        g.fillRect(wx + k, wy, 1.2, TILE);
        g.fillStyle = css(shift(paint, 10, -4));
        g.fillRect(wx + k + 1.2, wy, 0.6, TILE);
      }
      const top = y === b.y0;
      const bottom = y === b.y0 + BOX_H - 1;
      const left = x === b.x0;
      const right = x === b.x0 + BOX_W - 1;
      // The rails along its top and bottom, the posts at its ends: a box's frame.
      g.fillStyle = css(shift(paint, -22, -6));
      if (top) g.fillRect(wx - 0.5, wy, TILE + 1, 2.2);
      if (bottom) g.fillRect(wx - 0.5, wy + TILE - 2, TILE + 1, 2);
      if (left) g.fillRect(wx, wy - 0.5, 2.2, TILE + 1);
      if (right) g.fillRect(wx + TILE - 2.2, wy - 0.5, 2.2, TILE + 1);
      g.fillStyle = ink;
      if (top) line(g, wx - 0.5, wy, wx + TILE + 0.5, wy, { w: 0.9, seed: x * 31 + y, taper: [0.05, 0.05], press: 0.3 });
      if (left) line(g, wx, wy, wx, wy + TILE, { w: 0.9, seed: x * 37 + y, taper: [0.05, 0.05], press: 0.3 });
      // Corner castings.
      g.fillStyle = css({ h: 210, s: 6, l: 24 });
      if (top && left) g.fillRect(wx, wy, 3, 2.6);
      if (top && right) g.fillRect(wx + TILE - 3, wy, 3, 2.6);
      if (bottom && left) g.fillRect(wx, wy + TILE - 2.6, 3, 2.6);
      if (bottom && right) g.fillRect(wx + TILE - 3, wy + TILE - 2.6, 3, 2.6);
      // A stack's end is a box's doors: two locking bars and their handles.
      for (const dir of [-1, 1]) {
        if (p.inside(x + dir, y)) continue;
        const bx = dir < 0 ? wx + 3.5 : wx + TILE - 7;
        for (const k of [0, 3]) {
          g.fillStyle = ink;
          g.fillRect(bx + k - 0.4, wy, 1.6, TILE);
          g.fillStyle = css({ h: 210, s: 8, l: 70 });
          g.fillRect(bx + k, wy, 0.8, TILE);
          if (bottom) g.fillRect(bx + k - 1, wy + 6, 2.6, 1.2);
        }
      }
      // A stencil code on some boxes: dashes and a check digit's box, in white, never letters.
      if (top && left && hash2(b.bx, b.course, seed + 32) < 0.6) {
        g.fillStyle = 'rgba(245,245,240,0.85)';
        for (let k = 0; k < 4; k++) g.fillRect(wx + 5 + k * 3.2, wy + 5, 2.2, 1.6);
        for (let k = 0; k < 3; k++) g.fillRect(wx + 5 + k * 3.2, wy + 8.4, 2.2, 1.6);
        g.strokeStyle = 'rgba(245,245,240,0.85)';
        g.lineWidth = 0.6;
        g.strokeRect(wx + 15, wy + 7.6, 3, 3);
      }
    }
  }
};
