import { firstOverlap, type Solid } from '../physics';
import type { Runner, RunWorld } from '../run';
import type { ItemEventKind } from '../types';
import type { ItemDrop, ItemKind, ItemSpawn } from './types';

/**
 * Helpers shared by the roster and the per-frame item step. Everything takes
 * the RunWorld explicitly and keeps its state in plain data on it
 * (`world.items`, `runner.items`), so a snapshot captures it all.
 */

export function itemEvent(w: RunWorld, what: ItemEventKind, kind: string, slot: number, x: number, y: number): void {
  w.events.push({ type: 'item', what, kind, slot, x, y });
}

/** Add a loose item with `uses` left. */
export function spawnDrop(w: RunWorld, s: ItemSpawn, uses: number): ItemDrop {
  const d: ItemDrop = {
    id: w.items.nextId++,
    kind: s.kind,
    uses: s.uses ?? uses,
    x: s.x,
    y: s.y,
    vx: s.vx,
    vy: s.vy,
    born: w.frame,
    grace: s.grace ?? 0,
    onGround: false,
  };
  w.items.drops.push(d);
  return d;
}

/** Center of a runner's hitbox. */
export const cx = (r: Runner) => r.body.x + r.body.w / 2;
export const cy = (r: Runner) => r.body.y + r.body.h / 2;

export const isActive = (r: Runner) => r.alive && !r.finished;

/** Put an item in a runner's hands, or drop it at (x, y) if they're full. */
export function giveOrDrop(w: RunWorld, r: Runner, kind: ItemKind, uses: number, x: number, y: number): void {
  if (!r.items.held) r.items.held = { kind, uses };
  else spawnDrop(w, { kind, x, y, vx: 0, vy: -120, grace: 10 }, uses);
}

/** What the square of half-size `h` centered at (x, y) overlaps. One-ways only count when their top is at or below `oneWayFrom`. */
function boxHits(w: RunWorld, x: number, y: number, h: number, oneWayFrom = Number.POSITIVE_INFINITY): Solid | null {
  return firstOverlap({ x: x - h, y: y - h, w: h * 2, h: h * 2 }, w.world, false, oneWayFrom);
}

export interface BoxMove {
  hitX: boolean;
  hitY: boolean;
  /** What it landed on, if anything. Only read `dx`/`dy`: tile hits share a scratch object. */
  ground: Solid | null;
}

/**
 * Move a small box (center x, y, half-size h) by (dx, dy) with tile and solid
 * collision, axis by axis in steps of at most 4 px, leaving it flush against
 * what it hit.
 */
export function moveBox(w: RunWorld, p: { x: number; y: number }, dx: number, dy: number, h: number): BoxMove {
  let hitX = false;
  let hitY = false;
  let ground: Solid | null = null;
  const nx = Math.max(1, Math.ceil(Math.abs(dx) / 4));
  for (let i = 0; i < nx && !hitX; i++) {
    const s = boxHits(w, p.x + dx / nx, p.y, h);
    if (s) {
      hitX = true;
      const fx = dx > 0 ? s.x - h - 0.01 : s.x + s.w + h + 0.01;
      if (Math.abs(fx - p.x) <= Math.abs(dx / nx) + 0.01 && !boxHits(w, fx, p.y, h)) p.x = fx;
    } else p.x += dx / nx;
  }
  const ny = Math.max(1, Math.ceil(Math.abs(dy) / 4));
  for (let i = 0; i < ny && !hitY; i++) {
    const s = boxHits(w, p.x, p.y + dy / ny, h, dy > 0 ? p.y + h : Number.POSITIVE_INFINITY);
    if (s) {
      hitY = true;
      const fy = dy > 0 ? s.y - h - 0.01 : s.y + s.h + h + 0.01;
      if (Math.abs(fy - p.y) <= Math.abs(dy / ny) + 0.01 && !boxHits(w, p.x, fy, h)) p.y = fy;
      if (dy > 0) ground = s;
    } else p.y += dy / ny;
  }
  return { hitX, hitY, ground };
}
