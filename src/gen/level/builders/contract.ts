import { type Level, T_EMPTY } from '../../../sim/level';
import { drivenOf, hurtsOf, type Role } from '../../../sim/props';
import { ReachCache, T_NOGO } from '../../../sim/reach';
import { lipDrop, isSurge } from '../loop-surges';
import { harmed, harmReach } from '../harm';
import { fieldOf } from '../winnable';
import { unmirrored } from '../loop-boxes';
import { CENTRE_KEY, isBox, type Measures, measureLevel } from '../measure';
import type { BuilderContract } from '../sets/types';

/**
 * A builder's per-level promises (`BuilderContract.each`), checked on a finished level: the pipeline rejects an
 * attempt that breaks one (gen/level/index.ts), and tests/conformance runs the same check on every level it builds.
 */

/** A filler set piece's recipe and role: one the placer stood, as against a landmark's own piece, a gate or a box. */
export interface Filler {
  recipe: string;
  role: Role;
}

/** The level's filler set pieces, by recipe (`setpiece:<set>:<recipe>` keys that aren't its landmark's). */
export function fillerOf(level: Level): Filler[] {
  const mine = level.landmark ? `:${level.landmark.concept}` : null;
  return level.setPieces
    .filter((p) => p.def.key.startsWith('setpiece:') && !(mine && p.def.key.endsWith(mine)))
    .map((p) => ({ recipe: p.def.key.split(':')[2], role: p.def.role }));
}

/** Loot boxes the level hangs. */
export const boxesOf = (level: Level) => level.setPieces.filter((p) => isBox(p.def.key)).length;

/** Share of the set pieces asked for that stand (all of none). */
export const fillOf = (level: Level, asked: number) => (asked ? fillerOf(level).length / asked : 1);

/** What only the shape and stand cells answer: measured once, only for a contract that reads it. */
const SHAPED: readonly (keyof NonNullable<BuilderContract['each']>)[] = ['tiers', 'sideWall', 'centre'];

/**
 * Where `level` breaks `each`, one line per promise (none: it keeps them). `asked` is the set pieces the pipeline
 * asked the placer for. `clearSpawns` is a simulation, so it's conformance's alone; `boxesClear` plays the set pieces too, but
 * for tens of ms, so the pipeline holds every level to it.
 */
export function builderFaults(each: NonNullable<BuilderContract['each']>, level: Level, asked: number, cache?: ReachCache, measured?: Measures): string[] {
  const out: string[] = [];
  const filler = fillerOf(level);
  const fill = asked ? filler.length / asked : 1;
  if (each.fill !== undefined && fill < each.fill) out.push(`fill: ${filler.length} of ${asked} set pieces stand, under ${pct(each.fill)}`);
  if (each.repeat !== undefined)
    for (const r of new Set(filler.map((f) => f.recipe))) {
      const n = filler.filter((f) => f.recipe === r).length;
      if (n > each.repeat) out.push(`repeat: ${r} ${n} times, over ${each.repeat}`);
    }
  if (each.boxes !== undefined && level.profile?.boxes && boxesOf(level) < each.boxes) out.push(`boxes: ${boxesOf(level)}, under ${each.boxes}`);
  if (each.surges && level.profile?.surges) {
    const lips = level.setPieces.filter((p) => isSurge(p.def.key)).map((p) => p.def.footprint[0]);
    if (lips.length < each.surges.count) out.push(`surges: ${lips.length}, under ${each.surges.count}`);
    for (const [x, y] of lips)
      if (lipDrop(level, x, y) < each.surges.drop) out.push(`surges: the one at (${x},${y}) drops ${lipDrop(level, x, y)} rows, under ${each.surges.drop}`);
  }
  const boxes = level.setPieces.filter((p) => isBox(p.def.key));
  const cells = boxes.map((p) => p.def.footprint[0]);
  if (each.boxesMirrored) for (const f of unmirrored(level.w, cells)) out.push(`boxesMirrored: ${f}`);
  if (each.boxesClear && boxes.length) {
    const harm = harmReach(level, level.setPieces);
    for (const [x, y] of cells) if (harmed(harm, level.w, x, y)) out.push(`boxesClear: ${x},${y} is within a tile of where a set piece reaches`);
  }
  if (each.clearWay) out.push(...clearWayFaults(level, cache));
  if (SHAPED.some((k) => each[k] !== undefined)) {
    const m = measured ?? measureLevel(level, cache);
    if (each.tiers !== undefined && m.tiers < each.tiers) out.push(`tiers: the field stands on ${m.tiers} rows, under ${each.tiers}`);
    if (each.sideWall !== undefined && m.wall >= each.sideWall) out.push(`sideWall: a side column runs ${m.wall} rows of terrain, not under ${each.sideWall}`);
    if (each.centre !== undefined && !m.centres) out.push('centre: no centrepiece stands');
    else if (each.centre !== undefined && m.centre < each.centre)
      out.push(`centre: ${pct(m.centre)} of stand cells near the centrepiece, under ${pct(each.centre)}`);
  }
  return out;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Frames a hazard has to leave a cell clear for it not to wall a way: the motor with a fight's haste crosses a hall
 * floor or a roof run (9 to 11 tiles) from a standstill in 56 to 92 frames (seeds 1-30 of the brawl arenas), and the
 * slowest hands react in 18; a margin over both. A press's slam, a patrol's pass or a ladle's pour leaves its cells clear
 * longer and is waited out; a long-on hazard with a short off is a wall.
 */
export const CROSSING = 120;

/** Tiles from a centrepiece's cells a way has to come within to count as getting to it: about a knock. */
const NEAR_CENTRE = 3;

/**
 * Where `level` has no way round its hazards (`BuilderContract.each.clearWay`): every cell a set piece that hurts and
 * never leaves clear for `CROSSING` frames (a long-on blast, a crowd of patrols), and every cell a cart, a tractor or a
 * boulder drives through (`drivenOf`: a way along its run needs the whole run clear at once, and it never is), made a wall
 * no move enters or stands on, and from each end a bare reach to the other end and to within `NEAR_CENTRE` tiles of the centrepiece. One reach each
 * way over the walled grid: a hazard with too short a gap across the only way out of a spawn holds the field at home,
 * and nobody can wait it out.
 */
export function clearWayFaults(level: Level, cache?: ReachCache): string[] {
  const { w } = level;
  // The field the proof walks (parts' blocks as ground, what they hold as no-go), and every cell a set piece that
  // hurts holds too long to get past a wall too. The centrepiece's every cell is what a way has to get near.
  const tiles = fieldOf({ ...level, setPieces: [] }, level.setPieces).tiles;
  const centre = new Set<number>();
  for (const p of level.setPieces) {
    if (p.def.role !== 'hazard' || isBox(p.def.key) || isSurge(p.def.key)) continue;
    for (const k of [...hurtsOf(level, p, CROSSING), ...drivenOf(level, p)]) if (tiles[k] === T_EMPTY) tiles[k] = T_NOGO;
    if (p.def.key.endsWith(CENTRE_KEY)) for (const k of hurtsOf(level, p)) centre.add(k);
  }
  const walled: Level = { ...level, tiles };
  const out: string[] = [];
  for (const [from, to] of [
    [level.spawn, level.goal],
    [level.goal, level.spawn],
  ] as const) {
    // Through the level's own cache, when there's one: only the traces the walls touch run again.
    const way: Level = { ...walled, spawn: from, goal: to };
    const { goalReached, cells: reachable } = (cache ?? new ReachCache(level)).analyze(way, false);
    const at = `from (${from.tx},${from.ty})`;
    if (!goalReached) out.push(`clearWay: ${at} no way to the other end round the hazards`);
    if (centre.size && !reachable.some((k) => nearAny(centre, w, k % w, Math.floor(k / w))))
      out.push(`clearWay: ${at} no way to the centrepiece round the hazards`);
  }
  return out;
}

const nearAny = (cells: ReadonlySet<number>, w: number, x: number, y: number) => {
  for (let dy = -NEAR_CENTRE; dy <= NEAR_CENTRE; dy++) for (let dx = -NEAR_CENTRE; dx <= NEAR_CENTRE; dx++) if (cells.has((y + dy) * w + x + dx)) return true;
  return false;
};
