import { describe, it } from 'vitest';
import { generateLevel } from '../../src/gen/level';
import { Match } from '../../src/game/match';
import { THEME_IDS } from '../../src/themes';
import { expectMarkersOnTerrain, seedAt } from '../lib/markers';

/** The spawn ring and flag on the terrain (tests/lib/markers.ts) at every theme, size and gravity, and on 80 stock levels. */
describe('spawn ring and flag sit on the terrain', () => {
  it('every theme, size and gravity', () => {
    let i = 0;
    for (const theme of THEME_IDS)
      for (const size of ['classic', 'wide', 'tall'] as const)
        for (const gravity of [0.7, 1, 1.35]) expectMarkersOnTerrain(generateLevel(seedAt(i++), theme, { size, gravity }), `${theme} ${size} ${gravity}`);
  });

  it('stock levels, rolled from the seed alone', () => {
    for (let i = 0; i < 80; i++) expectMarkersOnTerrain(new Match(seedAt(i)).level, `seed ${seedAt(i)}`);
  });
});
