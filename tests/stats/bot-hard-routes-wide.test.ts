import { describe, it } from 'vitest';
import { expectHardRoutes } from '../lib/hard-routes';

/** A Hard bot over every theme's wide levels, racing over the parts three Hard bots placed (tests/lib/hard-routes.ts). */
describe('hard bot routes', () => {
  it('finishes most wide levels with parts placed', { timeout: 400_000 }, () => expectHardRoutes('wide', { finished: 0.82, frames: 565 }));
});
