import { overlaps, type Rect } from '../../core/geom';
import { TILE } from '../constants';
import { isProtected, T_EMPTY, tileAt } from '../level';
import { DEFAULT_SURFACE, type Solid, TILE_SOLID_ID } from '../physics';
import type { Runner, RunWorld } from '../run';
import { cx, itemEvent } from './common';
import type { ItemWorld } from './types';

/**
 * Pocket Block: one solid cell where you need it, for a few seconds. These
 * are the race's only transient solids from items. The solvability proof
 * never counts on them (they come and go mid-race), and a block never goes
 * where it could hurt the proof's promises: not in a protected zone, not in a
 * cell with anyone in it (so nobody is ever caught inside one), not over
 * terrain or another solid.
 */
export const POCKET = {
  /** Frames a block stands before it crumbles, and how long it shakes first. */
  life: 240,
  warn: 45,
} as const;

/**
 * Where a block may go, best first. In the air: right under your feet. On the ground: the floor under your
 * leading foot if it's open (you're at the edge), else the floor ahead of you, else the cell ahead at foot
 * level (a step up, or a wall at your back).
 */
export function blockCells(r: Runner): [number, number][] {
  const b = r.body;
  if (!b.onGround) return [[Math.floor(cx(r) / TILE), Math.ceil((b.y + b.h) / TILE)]];
  const lead = b.facing > 0 ? Math.floor((b.x + b.w - 0.01) / TILE) : Math.floor(b.x / TILE);
  const ahead = lead + (b.facing > 0 ? 1 : -1);
  const feet = Math.round((b.y + b.h) / TILE);
  return [
    [lead, feet],
    [ahead, feet],
    [ahead, feet - 1],
  ];
}

const cellRect = (tx: number, ty: number): Rect => ({ x: tx * TILE, y: ty * TILE, w: TILE, h: TILE });

/** Can a block go in this cell right now? Empty terrain, outside protected zones, clear of every runner and solid. */
export function blockFits(w: RunWorld, tx: number, ty: number): boolean {
  const { level } = w;
  if (tx < 0 || tx >= level.w || ty < 0 || ty >= level.h - 1) return false;
  if (tileAt(level, tx, ty) !== T_EMPTY || isProtected(level, tx, ty)) return false;
  const c = cellRect(tx, ty);
  if (w.runners.some((r) => r.alive && overlaps(c, r.body))) return false;
  return !w.solids.some((s) => !s.film && overlaps(c, s));
}

/** Put a block down for `r`. False (no use spent) when there's nowhere it fits. */
export function placeBlock(w: RunWorld, r: Runner): boolean {
  const cell = blockCells(r).find(([tx, ty]) => blockFits(w, tx, ty));
  if (!cell) return false;
  const [tx, ty] = cell;
  w.items.blocks.push({ tx, ty, born: w.frame, until: w.frame + POCKET.life, owner: r.slot });
  // It's solid from the next build, before anyone moves again.
  w.solids.push(blockSolid(tx, ty));
  itemEvent(w, 'use', 'block', r.slot, (tx + 0.5) * TILE, (ty + 0.5) * TILE);
  return true;
}

const blockSolid = (tx: number, ty: number): Solid => ({ ...cellRect(tx, ty), id: TILE_SOLID_ID, dx: 0, dy: 0, surface: DEFAULT_SURFACE, propUid: -1, mi: -1 });

/** This frame's blocks into the solids (RunWorld's build, before rays are traced, so beams and shots stop at them). */
export function buildBlocks(items: ItemWorld, frame: number, solids: Solid[]): void {
  for (const k of items.blocks) if (frame < k.until) solids.push(blockSolid(k.tx, k.ty));
}

/** Blocks crumble when their time is up. */
export function stepBlocks(w: RunWorld): void {
  const blocks = w.items.blocks;
  if (!blocks.length || !blocks.some((k) => w.frame + 1 >= k.until)) return;
  w.items.blocks = blocks.filter((k) => {
    if (w.frame + 1 < k.until) return true;
    itemEvent(w, 'fizzle', 'block', k.owner, (k.tx + 0.5) * TILE, (k.ty + 0.5) * TILE);
    return false;
  });
}
