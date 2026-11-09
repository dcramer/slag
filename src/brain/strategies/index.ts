import type { ModeId } from '../../game/modes';
import { brawlStrategy } from './brawl';
import { raceStrategy } from './race';
import { slagStrategy } from './slag';
import type { StrategyDef } from './types';

/**
 * How a bot races in each playstyle mode (src/game/modes.ts). Pick and place are the brain's own and shared by every
 * mode; the race is the mode's. A new mode fails typecheck here until it has one.
 */
export const STRATEGIES: Record<ModeId, StrategyDef> = {
  race: raceStrategy,
  slag: slagStrategy,
  brawl: brawlStrategy,
};

export type { Strategy, StrategyDef } from './types';
