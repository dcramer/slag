import { describe, expect, it } from 'vitest';
import { noFreeRide } from '../../src/gen/level/winnable';
import { THEME_IDS } from '../../src/themes';
import { levelsOfEveryTheme } from '../lib/set-piece-checks';

/**
 * How many levels a bare run could finish by riding a set piece: reach.ts
 * doesn't ride movers, so worldgen checks each piece parked at 8 points of its
 * cycle (`noFreeRide`, docs/SETPIECES.md). Before that check, 13 of 200 levels
 * (6.5%) had a piece that opened the flag to a bare ghost this way.
 */
const SEEDS = Array.from({ length: 20 }, (_, i) => (i * 2654435761 + 777) >>> 0);

describe('free rides', () => {
  it('almost no level lets a bare run ride a set piece to the flag', () => {
    const levels = levelsOfEveryTheme(SEEDS);
    const free = levels.filter(({ level }) => level.setPieces.some((pp) => !noFreeRide({ ...level, setPieces: level.setPieces.filter((o) => o !== pp) }, pp)));
    const per = THEME_IDS.map((t) => `${t} ${free.filter((l) => l.theme === t).length}`).join(', ');
    console.log(`free rides: ${free.length} of ${levels.length} (${per})`);
    expect(free.length / levels.length).toBeLessThanOrEqual(0.01);
  });
});
