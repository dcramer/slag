import type { Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import { type LevelProfile, T_ONEWAY, type TileRect } from '../../sim/level';
import type { Module } from '../../sim/props';
import { type Grid, hintGap, POCKET } from '../level/kit';
import { jumpProfile } from '../level/probe';
import { easyRise, hardGap, type Knobs, pit, undercut } from '../level/sculptors/common';
import { BRIDGE_W } from '../level/types';
import { SAFE_TILES } from '../setpieces/place';

/**
 * What every factory landmark shares (gen/stage/factory.ts, factory-works.ts): each one owns the level's
 * hard crossing, a vat on its spawn side sized with `hardGap`, and stands on the far bank. Past the vat,
 * nothing it carries can give a bare run a ride over it.
 */

/** Columns a landmark keeps from either end (sculptors/common.ts claimSite). */
export const SITE_MARGIN = POCKET + SAFE_TILES;

/** Flat floor between a vat and the structure: the bridge's landing. */
export const BANK = 2;

/**
 * Open floor a landmark leaves at its far end, in its box: the ground past the box may stand a step higher
 * than the floor the box levelled, and a passage that ended against it would be a dead end.
 */
export const APRON = 2;

/** The widest hard crossing `hardGap(rng, 1)` rolls at this gravity. */
export function widestGap(gravity?: number): number {
  const j = jumpProfile(gravity);
  return Math.max(j.gap + 2, BRIDGE_W + j.walkGap * 2);
}

/**
 * The hard vat a landmark owns: columns x0..x1 open to the bottom, its bridge hinted, its far bank undercut
 * below the floor row `G` (`undercut` from the ceiling would hollow the whole bank under a roof).
 */
export function vat(g: Grid, x0: number, x1: number, G: number): void {
  pit(g, x0, x1, G, false);
  hintGap(g, x0, x1, G);
  undercut(g, x1 + 1, 2, G);
}

/** Does a landmark `cols` wide fit beside the widest crossing, inside the margins? A classic level under low gravity doesn't. */
export function roomFor(p: Partial<LevelProfile>, cols: number): boolean {
  if (p.w === undefined) return true;
  return widestGap(p.gravity) + cols <= p.w - 2 * SITE_MARGIN;
}

/**
 * Columns of structure a landmark's box asks for past its vat and bank: all a classic level's middle has
 * left, a roll in `wide` on a wider one (never under `min`, never more than there's room for).
 */
export function structCols(k: Knobs, rng: Rng, min: number, wide: readonly [number, number]): number {
  const room = k.W - 2 * SITE_MARGIN - widestGap() - BANK;
  return Math.max(min, Math.min(room, k.W > 56 ? rng.int(wide[0], wide[1]) : room));
}

/**
 * The vat in front of a structure whose first column is `s0`: a `hardGap` dug at the right end of the
 * crossing's columns, the bank's columns left standing between it and the structure. Nothing dug when the
 * level asks for no parts.
 */
export function vatBefore(g: Grid, rng: Rng, s0: number, G: number, parts: number): void {
  if (parts <= 0) return;
  const x1 = s0 - BANK - 1;
  vat(g, x1 - Math.min(widestGap(), hardGap(rng)) + 1, x1, G);
}

/** One-way rungs two wide at columns x, x+1, a comfortable hop apart from the floor row G up to just under row `top`. */
export function rungs(g: Grid, x: number, top: number, G: number): number[] {
  const r = easyRise();
  const rows: number[] = [];
  for (let y = G - r; y > top; y -= r) {
    for (const c of [x, x + 1]) g.set(c, y, T_ONEWAY, true);
    rows.push(y);
  }
  return rows;
}

/** The anchors of the ways through: each a rect that, filled, shuts that way (tests read them with `waysOf`). */
export function ways(rects: readonly TileRect[]): Record<string, Vec> {
  const out: Record<string, Vec> = {};
  rects.forEach((r, i) => {
    out[`way${i}`] = [r.x, r.y];
    out[`way${i}s`] = [r.w, r.h];
  });
  return out;
}

/** Points recorded as `${key}{i}` anchors, back as a list. */
export function listOf(anchors: Record<string, Vec>, key: string): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; anchors[`${key}${i}`]; i++) out.push(anchors[`${key}${i}`]);
  return out;
}

/** A list as `${key}{i}` anchors. */
export const record = (key: string, xs: readonly Vec[]) => Object.fromEntries(xs.map((v, i) => [`${key}${i}`, v]));

/** A backdrop shell, drawn by the factory skin (render/props/skins/factory.ts) by the level's concept. */
export const shell = (rng: Rng, kind: 'facade' | 'smokestack', at: Vec, w: number, h: number): Module => ({
  type: 'deco',
  kind,
  at,
  w,
  h,
  seed: rng.int(0, 1 << 20),
});
