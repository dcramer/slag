import { type Level, spawnsOf } from '../../sim/level';
import { analyzeReach } from '../../sim/reach';
import type { RecipeTry } from '../setpieces';
import { BUILDERS, builderFor } from './builders';
import { boxesOf, builderFaults, type Filler, fillerOf } from './builders/contract';
import type { GenInfo } from './index';
import { CENTRE_KEY, type Measures, measureLevel } from './measure';

/**
 * What a generated level holds, for `pnpm level` and the tests that read it: its builder, the set pieces it asked for
 * and stood, the recipes that found no spot or were turned down, its boxes, how safe its places to stand are, and
 * whether its spawns reach each other bare. Diagnostics only: nothing in a match reads it.
 */
export interface LevelReport {
  builder: string;
  style: string;
  setPieces: {
    asked: number;
    placed: Filler[];
    /** The landmark's own pieces, every one required, outside the ask. */
    landmark: number;
    /** Recipes tried that offered no candidate spot. */
    noSpot: string[];
    /** Recipes that offered spots but stood nothing, with why each candidate was turned down. */
    refused: Pick<RecipeTry, 'recipe' | 'offered' | 'refused'>[];
  };
  /** What the level was laid round (`Shape.centre`): the room's kind, and the recipe that stood there first (one, or a mirrored pair), or none. */
  centre?: { kind: string; recipe: string | null; pieces: number };
  /** Loot boxes it hangs: absent when its profile deals none and it hangs none. */
  boxes?: number;
  measures: Measures;
  /** Each start cell (spawn, then the level's other spawns) and whether it reaches every other start, and the goal, bare. */
  spawns?: { tx: number; ty: number; others: boolean; goal: boolean }[];
  /** Promises of its builder's (`BuilderContract.each`) this level breaks. */
  faults: string[];
}

export function inspectLevel(level: Level, info: GenInfo, opts: { spawns?: boolean } = {}): LevelReport {
  const def = builderFor(level.profile!);
  // The centrepiece's tries are the room's; the filler's are the level's.
  const all = info.placement?.tries ?? [];
  const tries = all.filter((t) => !t.centre);
  const core = level.setPieces.filter((p) => p.def.key.endsWith(CENTRE_KEY));
  const asked = info.placement?.asked ?? 0;
  const placed = fillerOf(level);
  const measures = measureLevel(level);
  return {
    builder: Object.entries(BUILDERS).find(([, b]) => b === def)![0],
    style: level.style,
    setPieces: {
      asked,
      placed,
      landmark: level.setPieces.filter((p) => level.landmark && p.def.key.endsWith(`:${level.landmark.concept}`)).length,
      noSpot: [...new Set(tries.filter((t) => !t.offered).map((t) => t.recipe))],
      refused: tries.filter((t) => t.offered && !t.placed).map(({ recipe, offered, refused }) => ({ recipe, offered, refused })),
    },
    ...(info.placement?.centre
      ? { centre: { kind: info.placement.centre, recipe: core.length ? core[0].def.key.split(':')[2] : null, pieces: core.length } }
      : {}),
    ...(level.profile?.boxes || boxesOf(level) ? { boxes: boxesOf(level) } : {}),
    measures,
    ...(opts.spawns ? { spawns: spawnReach(level) } : {}),
    faults: def.contract?.each ? builderFaults(def.contract.each, level, asked, undefined, measures) : [],
  };
}

/** Every start cell, distinct, with what it reaches bare: each other start, and the goal. */
function spawnReach(level: Level): NonNullable<LevelReport['spawns']> {
  const starts = spawnsOf(level).filter((c, i, all) => all.findIndex((o) => o.tx === c.tx && o.ty === c.ty) === i);
  return starts.map((c) => {
    const { reachable, goalReached } = analyzeReach({ ...level, spawn: c }, false);
    return { tx: c.tx, ty: c.ty, others: starts.every((o) => o === c || reachable.has(o.ty * level.w + o.tx)), goal: goalReached };
  });
}
