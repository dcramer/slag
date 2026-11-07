import type { Level } from '../../../sim/level';
import type { Role } from '../../../sim/props';
import type { ReachCache } from '../../../sim/reach';
import { lipDrop, isSurge } from '../loop-surges';
import { harmed, harmReach } from '../harm';
import { unmirrored } from '../loop-boxes';
import { isBox, type Measures, measureLevel } from '../measure';
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
