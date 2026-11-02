import type { Toy } from '../../gen/character';
import { KINDS } from './kinds';
import type { ToyArt } from './kit';

/** Every toy's art, by kind: `tsc` names a kind that has none. */
export const TOY_ART: Record<Toy, ToyArt> = KINDS;
