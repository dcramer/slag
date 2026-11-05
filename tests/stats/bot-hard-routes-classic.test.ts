import { describe, it } from 'vitest';
import { expectHardRoutes } from '../lib/hard-routes';

/** A Hard bot over every theme's classic levels, racing over the parts three Hard bots placed (tests/lib/hard-routes.ts). */
describe('hard bot routes', () => {
  it('finishes most classic levels with parts placed', { timeout: 400_000 }, () => expectHardRoutes('classic', { finished: 0.87, frames: 510 }));
});
