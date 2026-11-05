import type { Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import { T_ONEWAY, type TileRect } from '../../sim/level';
import type { Module, PropStyle } from '../../sim/props';
import { type Grid, POCKET } from '../level/kit';
import { jumpProfile } from '../level/probe';
import { easyRise, hardGap, pit } from '../level/sculptors/common';
import { BRIDGE_W } from '../level/types';
import { makeStyle, SAFE_TILES, type Site } from '../setpieces/place';

/**
 * What every castle stage concept is built from (./castle.ts, ./castle-keep.ts): the moat each one owns in
 * front of it, the courtyard it stands on, the one-way ledges up a face, a passage through a foot, and the
 * anchors the tests read back (`way{i}` / `way{i}s`: a rect that, filled, shuts one way past).
 *
 * Every castle landmark owns the level's crossing: a moat in front, its far bank the landmark's doorstep.
 * A classic level has no room for a moat beside a landmark this size, and owning it keeps the structure
 * from making the sculptor's moat bare-passable off its roof.
 */

/** Columns a landmark keeps from either end (sculptors/common.ts claimSite). */
export const SITE_MARGIN = POCKET + SAFE_TILES;
/** Rows a passage through a structure is tall: a runner's height and a jump's start. */
export const DOOR = 3;

export const DOWN = Math.PI / 2;

/** The widest one-part moat at this gravity (hardGap's top end): the box always has room for it. */
export function moatMax(gravity?: number): number {
  const j = jumpProfile(gravity);
  return Math.max(j.gap + 2, BRIDGE_W + 2 * j.walkGap);
}

/** The structure's own box: everything right of the moat and the bank it lands on. */
export function structureOf(at: TileRect): TileRect {
  const m = moatMax() + 1;
  return { x: at.x + m, y: at.y, w: at.w - m, h: at.h };
}

/** Columns of structure a classic level's middle leaves beside the widest moat at this gravity. */
export function classicRoom(gravity?: number, w = 48): number {
  return w - 2 * SITE_MARGIN - moatMax(gravity) - 1;
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
  const x0 = x1 - Math.min(moatMax(), hardGap(rng, parts)) + 1;
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

/** One-way ledges two wide at columns x, x+1, a comfortable hop apart from the ground row G up to the surface row `top`. */
export function ledges(g: Grid, x: number, top: number, G: number): number[] {
  const R = easyRise();
  const rows: number[] = [];
  for (let y = G - R; y > top; y -= R) {
    for (const c of [x, x + 1]) g.set(c, y, T_ONEWAY, true);
    rows.push(y);
  }
  return rows;
}

/** A passage DOOR rows tall at the ground (row G is the floor) from column a to b. */
export function passage(g: Grid, a: number, b: number, G: number): void {
  g.clear(Math.min(a, b), G - DOOR, Math.max(a, b), G - 1);
}

/** Alternating merlons on row y over [a, b], both ends included. */
export function merlons(g: Grid, a: number, b: number, y: number, from = 0): void {
  for (let x = a + from; x <= b; x += 2) g.set(x, y, 1, true);
  g.set(a, y, 1, true);
  g.set(b, y, 1, true);
}

/** The anchors of the ways through: each a rect that, filled, shuts that way. */
export function ways(rects: readonly TileRect[]): Record<string, Vec> {
  const out: Record<string, Vec> = {};
  rects.forEach((r, i) => {
    out[`way${i}`] = [r.x, r.y];
    out[`way${i}s`] = [r.w, r.h];
  });
  return out;
}

/** Points recorded as `${key}{i}` anchors. */
export const record = (key: string, xs: readonly Vec[]) => Object.fromEntries(xs.map((v, i) => [`${key}${i}`, v]));

/** Points recorded as `${key}{i}` anchors, back as a list. */
export function listOf(anchors: Record<string, Vec>, key: string): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; anchors[`${key}${i}`]; i++) out.push(anchors[`${key}${i}`]);
  return out;
}

/** A backdrop shell (drawn by the castle skin, chosen by the level's concept and the shell's shape). */
export const shell = (rng: Rng, at: Vec, w: number, h: number): Module => ({ type: 'deco', kind: 'facade', at, w, h, seed: rng.int(0, 1 << 20) });

/** Iron and gilt: the castle's ironmongery. */
export const IRON = (rng: Rng): PropStyle => makeStyle(rng, ['steel', 'obsidian'], [0, 30], { woodHue: rng.range(16, 26), glowHue: rng.range(24, 40) });
export const GILT = (rng: Rng): PropStyle => makeStyle(rng, ['brass', 'gold'], [36], { glowHue: rng.range(32, 46), woodHue: rng.range(14, 24) });

/** Rows a box asks for, never more than a level of this height has over its ground (claimSite needs a row of sky). */
export const boxH = (H: number, h: number) => Math.min(H - 9, h);
