import type { ModuleOf } from '../../../sim/props';
import { defineArt } from '../common';
import { drawSpikeCells } from '../spike-looks';

/** Spike rails on a block's faces, in the block's own metal unless a look says what they're made of (glass, thorns, ...). */
defineArt<'spikes'>({ type: 'spikes', layer: 1, draw: (rc, m: ModuleOf<'spikes'>, d) => drawSpikeCells(rc.s, m.cells, m.angle, m.look, d.pal.dark, d.off) });
