import { LEVEL_H } from '../../../sim/constants';
import type { LevelProfile } from '../../../sim/level';
import { sculptTall } from '../sculptors/tall';
import type { BuilderDef, SetKit } from '../sets/types';
import type { SculptCtx, Shape } from '../types';
import { sculptArena } from './arena';
import { sculptCarved } from './carved';
import { sculptChain } from './chain';
import { sculptCourse } from './course';
import { sculptShaft } from './shaft';

/**
 * Level builders, one per shape or mode, each composing any set's kit (sets/, SET_KITS): the plan is the builder's,
 * the pieces the set's. A new mode's level is a new builder here asking for kit kinds every set provides (KIT_KINDS),
 * so every set builds it from the start. src/gen/AGENTS.md → Set kits and level builders.
 */
export type BuilderId = 'course' | 'climb' | 'descent' | 'tower' | 'shaft' | 'arena';

const COURSE_KINDS = ['ground', 'gap', 'stamps'] as const;

/** A course, climb or descent: the course plan on the route's ramp, which `knobs` reads from the profile's route. */
const onCourse = (ctx: SculptCtx, set: SetKit): Shape =>
  set.course ? sculptCourse(ctx, set.course) : set.chain ? sculptChain(ctx, set.chain) : sculptCarved(ctx, set.carved!);

export const BUILDERS: Record<BuilderId, BuilderDef> = {
  course: {
    about: 'a run left to right over the set’s ground, crossings cut in it and stamps stood on it',
    takes: (p) => p.size !== 'tall' && p.route === 'ltr',
    asks: COURSE_KINDS,
    build: onCourse,
  },
  climb: {
    about: 'the course on a ramp rising a quarter to a third of the level toward the flag',
    takes: (p) => p.size !== 'tall' && (p.route === 'climb' || p.route === 'zigzag'),
    asks: COURSE_KINDS,
    build: onCourse,
  },
  descent: {
    about: 'the course on a ramp falling toward the flag',
    takes: (p) => p.size !== 'tall' && p.route === 'descent',
    asks: COURSE_KINDS,
    build: onCourse,
  },
  tower: {
    about: 'storeys stacked up a shaft, two connectors between every pair, moats on the spawn and goal storeys',
    takes: (p) => p.size === 'tall' && !p.builder,
    asks: ['floor', 'connector', 'shell'],
    build: (ctx, set) => (set.tower ? (set.towerPost ?? keep)(sculptTall(ctx, set.tower), ctx) : onCourse(ctx, set)),
  },
  shaft: {
    about: 'Rising Slag: ledges staggered like bricks up a walled shaft that loops, several lines up every height, a wall-jump chimney up one side',
    takes: (p) => p.builder === 'shaft',
    asks: ['floor', 'shell'],
    build: (ctx, set) => (set.tower ? (set.towerPost ?? keep)(sculptShaft(ctx, set.tower), ctx) : onCourse(ctx, set)),
  },
  arena: {
    about: 'Brawl: one screen of ledges in tiers from islands over the pit to the top, open at the sides, its two ends mirrored',
    takes: (p) => p.builder === 'arena',
    asks: ['floor'],
    // The arena is the stage: a landmark would take the middle of the one screen, so its levels are plain.
    landmark: false,
    // Built for knocking people off things (docs/MODES.md → Brawl): room for nearly all the set pieces it asks for,
    // three boxes (a brawl's stands) mirrored and clear of what its pieces reach, several tiers, no wall at either
    // side, nearly every place to stand with a way to die near it.
    contract: {
      each: { fill: 0.5, repeat: 2, boxes: 3, boxesMirrored: true, boxesClear: true, tiers: 3, sideWall: LEVEL_H / 4, clearSpawns: true },
      set: { fill: 5 / 6, kinds: 4, stands: 0.8 },
      all: { safe: 0.2, edgy: 0.6, high: 0.6, mirrored: 0.9, shapes: { names: ['arena-bowl', 'arena-pyramid', 'arena-tiers'], share: 0.18 } },
    },
    build: (ctx, set) => (set.tower ? (set.towerPost ?? keep)(sculptArena(ctx, set.tower), ctx) : onCourse(ctx, set)),
  },
};

const keep = (s: Shape) => s;

/** The builder for a level's profile: the one its mode names, else the one whose `takes` fits. Every profile has exactly one. */
export function builderFor(p: LevelProfile): BuilderDef {
  if (p.builder) return BUILDERS[p.builder as BuilderId];
  return Object.values(BUILDERS).find((b) => b.takes(p))!;
}
