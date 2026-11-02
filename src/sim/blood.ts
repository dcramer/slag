import type { Cell, Rect } from '../core/geom';
import type { Rng } from '../core/rng';
import { TILE } from './constants';
import { isProtected, type Level, T_EMPTY, T_SOLID, tileAt } from './level';
import { type Solid, TILE_SOLID_ID } from './physics';
import { COAT_PX, COAT_SURFACES, FACE, footprintCells, mountAngle, patchRect, type PlacedProp, resolveProp } from './props';

/**
 * Blood: what a death leaves behind. A runner oozes a puddle in their own body
 * color onto the surface under them, and it's slippery for everyone, them
 * included, for as many rounds as the match's `bloodRounds` rule says. It is a
 * list of cells on `Match`, so it outlives the race that made it; a RunWorld
 * reads that same list and adds to it.
 *
 * On a floor a cell is a thin solid with the ice coat's surface, the same thing
 * a frost patch is, so stepBody needs nothing new. Whatever the weather does to
 * terrain stops at it, and a coat or patch already there wins. It's a `film`,
 * so nothing but a runner notices: a puddle can't plug a vent or stop a shot. A
 * wall smear builds nothing, so blood can never take a wall jump away and cut
 * off a climb.
 */

/** One bloodied face of a solid cell. Cells are unique per (tx, ty, face). */
export interface BloodCell {
  /** The host cell, and which of its faces (`FACE` order). */
  tx: number;
  ty: number;
  face: number;
  /** Whose blood: the art takes the color from this player's character. */
  slot: number;
  /** Rounds finished since it was spilled. */
  age: number;
  /** Race frame the ooze reaches this cell. 0 once settled, since race frames restart each round. */
  at: number;
}

/** Most cells in a match, oldest gone first. Each floor cell is a solid every frame, so this bounds what a long 8-player match adds to collision. */
export const BLOOD_CAP = 64;
/** Frames the ooze takes to fill one cell and move on to the next. */
export const OOZE_FRAMES = 16;
/** How far the ooze runs each way along a floor from where they died, tiles. */
const SPREAD: readonly [number, number] = [1, 2];
/** Tiles below the feet a death still reaches a floor: as far as a full jump leaves you. Higher up, it's only gibs. */
const FLOOR_REACH = 3;
/** Px from the body a wall can be and still get smeared. */
const WALL_REACH = 4;

/** `FACE` index of a floor. */
export const FACE_UP = 3;
const FACE_RIGHT = 0;
const FACE_LEFT = 2;

/** Materials blood lands on. Anything else already is a surface: ice is slippery, and a coat would take the belt, bounce or goo away. */
const PLAIN_MATERIALS: ReadonlySet<string> = new Set(['stone', 'metal', 'wood']);

/** What a surface check needs to know about the level right now. */
export interface Ground {
  level: Level;
  /** Cells of still, plain blocks: nothing moves, crumbles or breaks them during a race. */
  blocks: Set<number>;
  /** Cells any prop stands in. */
  taken: Set<number>;
  /** Faces under a coat, spike strip or snap trap. */
  coated: Set<number>;
}

const faceKey = (w: number, x: number, y: number, face: number) => (y * w + x) * 4 + face;

export function groundOf(level: Level, placed: readonly PlacedProp[]): Ground {
  const w = level.w;
  const g: Ground = { level, blocks: new Set(), taken: new Set(), coated: new Set() };
  for (const p of [...level.setPieces, ...placed]) {
    // A rider is never where its cells say for long, and blood only lands on what holds still.
    if (p.ride) continue;
    if (p.def.mount === 'face') {
      const face = Math.round(mountAngle(p.def, p.rot) / (Math.PI / 2)) & 3;
      for (const [x, y] of footprintCells(p)) g.coated.add(faceKey(w, x, y, face));
      continue;
    }
    for (const [x, y] of footprintCells(p)) g.taken.add(y * w + x);
    if (p.def.motion.type !== 'none') continue;
    for (const m of resolveProp(p).mods) {
      if (m.type === 'body' && PLAIN_MATERIALS.has(m.material)) for (const [x, y] of m.cells) g.blocks.add(y * w + x);
    }
  }
  return g;
}

const isOpen = (g: Ground, x: number, y: number) => tileAt(g.level, x, y) === T_EMPTY && !g.taken.has(y * g.level.w + x);

/**
 * The attachment rule (`mountCells`) plus two: the face has to be plain, and
 * as with frost patches there must be two open cells off it, or the thickness
 * would pinch a runner in a one-tile gap. Protected zones stay clean, so a
 * round can't start on it.
 */
export function canBleed(g: Ground, x: number, y: number, face: number): boolean {
  const { level } = g;
  if (x < 0 || y < 0 || x >= level.w || y >= level.h) return false;
  if (tileAt(level, x, y) !== T_SOLID && !g.blocks.has(y * level.w + x)) return false;
  if (g.coated.has(faceKey(level.w, x, y, face))) return false;
  const [dx, dy] = FACE[face];
  if (isProtected(level, x, y) || isProtected(level, x + dx, y + dy)) return false;
  return isOpen(g, x + dx, y + dy) && isOpen(g, x + 2 * dx, y + 2 * dy);
}

/** Row of the floor in column `tx` that feet at `feet` would land on, or -1. One-way tiles let it drip through. */
function floorBelow(g: Ground, tx: number, feet: number): number {
  const top = Math.floor(feet / TILE);
  for (let y = top; y <= top + FLOOR_REACH; y++) {
    const solid = tileAt(g.level, tx, y) === T_SOLID || g.taken.has(y * g.level.w + tx);
    if (solid) return canBleed(g, tx, y, FACE_UP) ? y : -1;
  }
  return -1;
}

/** Add a cell, taking over one already on that face. The list stays oldest first, which is what the cap relies on. */
function lay(blood: BloodCell[], tx: number, ty: number, face: number, slot: number, at: number) {
  const i = blood.findIndex((c) => c.tx === tx && c.ty === ty && c.face === face);
  // Fresh blood on an old cell doesn't lift the old one off the floor while it arrives.
  const was = i >= 0 ? blood.splice(i, 1)[0].at : at;
  blood.push({ tx, ty, face, slot, age: 0, at: Math.min(was, at) });
  if (blood.length > BLOOD_CAP) blood.shift();
}

/**
 * A runner died with their body at `b`. Prefer the floor under any part of
 * them and run along it; with no floor in reach, smear a wall they were next to
 * and let it run down. Falls and anything off the level find no surface, so
 * they leave nothing.
 */
export function spillBlood(blood: BloodCell[], g: Ground, b: Rect, slot: number, frame: number, rng: Rng): void {
  const feet = b.y + b.h;
  for (const x of [b.x + b.w / 2, b.x, b.x + b.w - 0.01]) {
    const tx = Math.floor(x / TILE);
    const ty = floorBelow(g, tx, feet);
    if (ty < 0) continue;
    lay(blood, tx, ty, FACE_UP, slot, frame);
    for (const dir of [-1, 1]) {
      const reach = rng.int(SPREAD[0], SPREAD[1]);
      for (let d = 1; d <= reach && canBleed(g, tx + dir * d, ty, FACE_UP); d++) lay(blood, tx + dir * d, ty, FACE_UP, slot, frame + d * OOZE_FRAMES);
    }
    return;
  }
  const ty = Math.floor((b.y + b.h / 2) / TILE);
  const walls: readonly [number, number][] = [
    [Math.floor((b.x - WALL_REACH) / TILE), FACE_RIGHT],
    [Math.floor((b.x + b.w + WALL_REACH) / TILE), FACE_LEFT],
  ];
  for (const [tx, face] of walls) {
    if (!canBleed(g, tx, ty, face)) continue;
    lay(blood, tx, ty, face, slot, frame);
    const reach = rng.int(SPREAD[0], SPREAD[1]);
    for (let d = 1; d <= reach && canBleed(g, tx, ty + d, face); d++) lay(blood, tx, ty + d, face, slot, frame + d * OOZE_FRAMES);
    return;
  }
}

/** This frame's footing. A frame's patches go in first, so a frost or goo patch on a puddle wins while it lasts. */
export function buildBlood(blood: readonly BloodCell[], frame: number, solids: Solid[]): void {
  for (const c of blood) {
    if (c.face !== FACE_UP || frame < c.at) continue;
    solids.push({ ...patchRect(c.tx, c.ty, FACE_UP, COAT_PX), id: TILE_SOLID_ID, dx: 0, dy: 0, surface: COAT_SURFACES.ice, propUid: -1, mi: -1, film: true });
  }
}

/** In place: a RunWorld and the art hold this same list. */
function keepBlood(blood: BloodCell[], keep: (c: BloodCell) => boolean) {
  let n = 0;
  for (const c of blood) if (keep(c)) blood[n++] = c;
  blood.length = n;
}

/** A round ended: everything settles, and what's had its `rounds` rounds goes. With 2, spilled in round R, it's gone when R+1 ends. */
export function ageBlood(blood: BloodCell[], rounds: number): void {
  keepBlood(blood, (c) => {
    c.at = 0;
    return ++c.age < rounds;
  });
}

/** Drop what no longer has a surface to be on: its host went, or a block or coat now covers it. */
export function cleanBlood(blood: BloodCell[], level: Level, placed: readonly PlacedProp[]): void {
  const g = groundOf(level, placed);
  keepBlood(blood, (c) => canBleed(g, c.tx, c.ty, c.face));
}

/** A blast clears blood from every cell it touches, whether or not the surface survives. */
export function washBlood(blood: BloodCell[], cells: readonly Cell[]): void {
  const hit = new Set(cells.map(([x, y]) => `${x},${y}`));
  keepBlood(blood, (c) => {
    const [dx, dy] = FACE[c.face];
    return !hit.has(`${c.tx},${c.ty}`) && !hit.has(`${c.tx + dx},${c.ty + dy}`);
  });
}
