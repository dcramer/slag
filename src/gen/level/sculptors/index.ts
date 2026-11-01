import type { ThemeId } from '../../../themes';
import type { Sculptor } from '../types';
import { legacy } from './legacy';

/**
 * Level-shape generator per theme. Every theme currently uses the legacy
 * sculptor; replace entries with theme-specific sculptors in ./<theme>.ts.
 */
export const SCULPTORS: Record<ThemeId, Sculptor> = {
  farm: legacy,
  factory: legacy,
  castle: legacy,
  jungle: legacy,
  volcano: legacy,
  harbor: legacy,
  mine: legacy,
  rooftops: legacy,
};
