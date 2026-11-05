import type { ThemeId } from '../../../themes';
import { decorFor } from '../../decor';
import { SET_PIECE_RECIPES } from '../../setpieces';
import { CONCEPTS } from '../../stage';
import { CASTLE_COURSE } from './castle';
import { FACTORY_COURSE } from './factory';
import { GLACIER_COURSE, glaze } from './glacier';
import { HARBOR_CHAIN } from './harbor';
import { JUNGLE_COURSE } from './jungle';
import { MINE_CARVED } from './mine';
import { ROOFTOPS_CHAIN } from './rooftops';
import { SPACE_CHAIN } from './space';
import {
  CASTLE_TOWER,
  FACTORY_TOWER,
  FARM_TOWER,
  GLACIER_TOWER,
  HARBOR_TOWER,
  JUNGLE_TOWER,
  MINE_TOWER,
  ROOFTOPS_TOWER,
  SPACE_TOWER,
  VOLCANO_TOWER,
} from '../sculptors/tall';
import { VOLCANO_COURSE } from './volcano';
import { FARM_COURSE } from './farm';
import type { ChainKit, CourseKit, SetKit } from './types';

/**
 * Every level set's kit (src/gen/AGENTS.md → Set kits and level builders): the pieces each theme provides, for the
 * builders (builders/, BUILDERS) to compose. One entry per theme; KIT_KINDS says what each must provide.
 */
export const SET_KITS: Record<ThemeId, SetKit> = {
  farm: { theme: 'farm', course: FARM_COURSE, tower: FARM_TOWER },
  factory: { theme: 'factory', course: FACTORY_COURSE as CourseKit, tower: FACTORY_TOWER },
  castle: { theme: 'castle', course: CASTLE_COURSE as CourseKit, tower: CASTLE_TOWER },
  jungle: { theme: 'jungle', course: JUNGLE_COURSE, tower: JUNGLE_TOWER },
  volcano: { theme: 'volcano', course: VOLCANO_COURSE as CourseKit, tower: VOLCANO_TOWER },
  harbor: { theme: 'harbor', chain: HARBOR_CHAIN, tower: HARBOR_TOWER },
  mine: { theme: 'mine', carved: MINE_CARVED, tower: MINE_TOWER },
  rooftops: { theme: 'rooftops', chain: ROOFTOPS_CHAIN as ChainKit, tower: ROOFTOPS_TOWER },
  glacier: {
    theme: 'glacier',
    course: GLACIER_COURSE as CourseKit,
    tower: GLACIER_TOWER,
    towerPost: (s, ctx) => glaze(s, new Uint8Array(s.w * s.h), ctx.rng, 0.75),
  },
  space: { theme: 'space', chain: SPACE_CHAIN as ChainKit, tower: SPACE_TOWER },
};

/**
 * The kinds of piece a set provides, what each is, and whether a set has it. Builders ask for these by id
 * (BuilderDef.asks); tests/conformance/kits checks every set provides every kind.
 */
export const KIT_KINDS: Record<string, { about: string; has(set: SetKit): boolean }> = {
  ground: {
    about:
      'what a course stands on: a ground profile and how it’s laid (CourseKit.ground), the docks and decks of a chain (ChainKit.dock, deck), or rock to carve (CarvedKit.rock)',
    has: (s) => !!(s.course?.ground || s.chain?.dock || s.carved?.rock),
  },
  gap: {
    about: 'how a crossing is cut: a gap style’s banks, pad and margin (CourseKit.gap), a chain’s voids (ChainKit.layout), or a chasm (CarvedKit.chasm)',
    has: (s) => !!(s.course?.gap || s.chain?.layout || s.carved?.chasm),
  },
  stamps: {
    about:
      'what stands in a course: stamps on levelled ground or on the ground as it lies (CourseKit.stamps, standing), a chain’s bodies (ChainKit.body), or a carved level’s tunnels and timber (CarvedKit.headroom, dress)',
    has: (s) => !!(s.course?.stamps || s.course?.standing || s.chain?.body || s.carved?.dress),
  },
  floor: { about: 'a storey’s floor (TallKit.deck)', has: (s) => !!s.tower?.deck },
  connector: { about: 'a way between storeys and the columns it takes for a storey’s rise (TallKit.link, linkW)', has: (s) => !!s.tower?.link },
  shell: {
    about: 'a tower’s edges: the columns its shell owns (TallKit.margin), walled where it builds one (shell)',
    has: (s) => !!s.tower && s.tower.margin >= 1,
  },
  landmarks: { about: 'its stage concepts (CONCEPTS)', has: (s) => CONCEPTS[s.theme].length > 0 },
  'set pieces': { about: 'its set pieces and hazards (SET_PIECE_RECIPES)', has: (s) => SET_PIECE_RECIPES[s.theme].length > 0 },
  decor: { about: 'its decor (DECOR_RULES)', has: (s) => decorFor(s.theme).length > 0 },
};

/** The kinds a set doesn't provide yet ([] when it has them all). */
export function kitShortfalls(set: SetKit): string[] {
  return Object.keys(KIT_KINDS).filter((id) => !KIT_KINDS[id].has(set));
}
