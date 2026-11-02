import type { Kind } from '../../gen/character';
import { KINDS } from './kinds';
import type { KindArt } from './kit';

/** Every kind's art: `tsc` names a kind that has none. */
export const CAST_ART: Record<Kind, KindArt> = KINDS;
