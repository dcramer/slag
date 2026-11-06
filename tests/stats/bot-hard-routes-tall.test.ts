import { describe, it } from 'vitest';
import { expectHardRoutes } from '../lib/hard-routes';

/** A Hard bot over every theme's tall levels, racing over the parts three Hard bots placed (tests/lib/hard-routes.ts). */
describe('hard bot routes', () => {
  it('finishes most tall levels with parts placed', { timeout: 400_000 }, () => expectHardRoutes('tall', { finished: 0.85, frames: 650 }));
});
