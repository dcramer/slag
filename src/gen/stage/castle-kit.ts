import type { Rng } from '../../core/rng';
import { type TileRect } from '../../sim/level';
import type { PropStyle } from '../../sim/props';
import { type Grid } from '../level/kit';
import { hardGap, pit } from '../level/sculptors/common';
import { makeStyle, type Site } from '../setpieces/place';
import { oneGap, SITE_MARGIN } from './kit';

/**
 * What the castle stage concepts (./castle.ts, ./castle-keep.ts) share beyond the landmark kit (./kit.ts):
 * the moat each one owns in front of it, the courtyard it stands on, and the castle's ironmongery.
 *
 * Every castle landmark owns the level's crossing: a moat in front, its far bank the landmark's doorstep.
 * A classic level has no room for a moat beside a landmark this size, and owning it keeps the structure
 * from making the sculptor's moat bare-passable off its roof.
 */

/** The structure's own box: everything right of the moat and the bank it lands on. */
export function structureOf(at: TileRect): TileRect {
  const m = oneGap() + 1;
  return { x: at.x + m, y: at.y, w: at.w - m, h: at.h };
}

/** Columns of structure a classic level's middle leaves beside the widest moat at this gravity. */
export function classicRoom(gravity?: number, w = 48): number {
  return w - 2 * SITE_MARGIN - oneGap(gravity) - 1;
}

/**
 * The moat in front of the structure, sized for `parts` with hardGap and dug to the bottom against the
 * bank (pit hints the bridge and undercuts the bank). Whatever the moat doesn't take is courtyard.
 * Returns the moat's columns, or null when the level asks for no part.
 */
export function digMoat(g: Grid, rng: Rng, at: TileRect, parts: number): [number, number] | null {
  const G = at.y + at.h;
  const s = structureOf(at);
  g.clear(at.x, at.y, s.x - 1, G - 1);
  if (parts <= 0) return null;
  const x1 = s.x - 2;
  const x0 = x1 - Math.min(oneGap(), hardGap(rng, parts)) + 1;
  pit(g, x0, x1, G, true);
  return [x0, x1];
}

/**
 * The row a backdrop shell over columns x0..x1 stands on: the lowest first solid tile at or below `from`
 * under any of them (a pit under one runs it down), so a doorway or a pit never shows sky under its wall.
 */
export function footing(s: Site, x0: number, x1: number, from: number): number {
  let low = from;
  for (let x = x0; x <= x1; x++) {
    let y = from;
    while (y < s.h && !s.solid(x, y)) y++;
    low = Math.max(low, y);
  }
  return low;
}

/** Alternating merlons on row y over [a, b], both ends included. */
export function merlons(g: Grid, a: number, b: number, y: number, from = 0): void {
  for (let x = a + from; x <= b; x += 2) g.set(x, y, 1, true);
  g.set(a, y, 1, true);
  g.set(b, y, 1, true);
}

/** Iron and gilt: the castle's ironmongery. */
export const IRON = (rng: Rng): PropStyle => makeStyle(rng, ['steel', 'obsidian'], [0, 30], { woodHue: rng.range(16, 26), glowHue: rng.range(24, 40) });
export const GILT = (rng: Rng): PropStyle => makeStyle(rng, ['brass', 'gold'], [36], { glowHue: rng.range(32, 46), woodHue: rng.range(14, 24) });
