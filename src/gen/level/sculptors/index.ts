import type { ThemeId } from '../../../themes';
import type { Sculptor } from '../types';
import { castle } from './castle';
import { factory } from './factory';
import { farm } from './farm';
import { harbor } from './harbor';
import { jungle } from './jungle';
import { legacy } from './legacy';
import { mine } from './mine';
import { rooftops } from './rooftops';
import { volcano } from './volcano';

/** Level-shape generator per theme (one file each in this folder). */
export const SCULPTORS: Record<ThemeId, Sculptor> = {
  farm,
  factory,
  castle,
  jungle,
  volcano,
  harbor,
  mine,
  rooftops,
};

/**
 * Theme-agnostic generator the pipeline falls back to if a theme sculptor
 * keeps failing validation (should never happen; tests assert it doesn't).
 */
export const FALLBACK_SCULPTOR: Sculptor = legacy;
