import { defineModule } from '../registry';

/** Placement-time only: Match calls detonate() instead of placing it. */
defineModule<'bomb'>({
  type: 'bomb',
  resolve: (m) => m,
  anchors: () => [[0, 0]],
});
