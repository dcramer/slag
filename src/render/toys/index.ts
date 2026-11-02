import type { Toy } from '../../gen/character';
import { IRON_TOYS } from './iron';
import type { ToyArt } from './kit';
import { TIN_TOYS } from './tin';

/** Every toy's art, by kind (tests/ink-character.test.ts checks none is missing). */
export const TOY_ART: Record<Toy, ToyArt> = { ...TIN_TOYS, ...IRON_TOYS } as Record<Toy, ToyArt>;
