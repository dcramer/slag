import type { LevelProfile } from '../../../sim/level';
import { sculptTall } from '../sculptors/tall';
import type { BuilderDef, SetKit } from '../sets/types';
import type { SculptCtx, Shape } from '../types';
import { sculptCarved } from './carved';
import { sculptChain } from './chain';
import { sculptCourse } from './course';
import { sculptShaft } from './shaft';

/**
 * Level builders, one per shape or mode, each composing any set's kit (sets/, SET_KITS): the plan is the builder's,
 * the pieces the set's. A new mode's level is a new builder here asking for kit kinds every set provides (KIT_KINDS),
 * so every set builds it from the start. src/gen/AGENTS.md → Set kits and level builders.
 */
export type BuilderId = 'course' | 'climb' | 'descent' | 'tower' | 'shaft';

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
};

const keep = (s: Shape) => s;

/** The builder for a level's profile: the one its mode names, else the one whose `takes` fits. Every profile has exactly one. */
export function builderFor(p: LevelProfile): BuilderDef {
  if (p.builder) return BUILDERS[p.builder as BuilderId];
  return Object.values(BUILDERS).find((b) => b.takes(p))!;
}
