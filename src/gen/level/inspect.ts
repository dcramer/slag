import { type Level, spawnsOf } from '../../sim/level';
import { analyzeReach } from '../../sim/reach';
import type { RecipeTry } from '../setpieces';
import { BUILDERS, builderFor } from './builders';
import { boxesOf, builderFaults, type Filler, fillerOf } from './builders/contract';
import type { GenInfo } from './index';
import { type Measures, measureLevel } from './measure';

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
  const tries = info.placement?.tries ?? [];
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
