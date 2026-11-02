import { defineArt } from '../common';

/** Rising liquid (stage concepts): nothing to draw until the flood runs (docs/SETPIECES.md, Wave 1). */
defineArt<'flood'>({ type: 'flood', layer: 3, draw: () => {} });
