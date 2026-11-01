import { defineModule } from '../registry';

/** Placement-time only: Match calls detonate() instead of placing it. */
export const bomb = defineModule<'bomb'>({
  type: 'bomb',
  resolve: (m) => m,
  anchors: () => [[0, 0]],
});
