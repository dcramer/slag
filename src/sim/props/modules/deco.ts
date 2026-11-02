import type { Cell } from '../../../core/geom';
import { defineModule } from '../registry';
import type { DecoKind } from '../types';

/**
 * Backdrop shells (docs/SETPIECES.md §4): scenery behind a landmark's terrain, the manor's facade behind
 * its walls and rooms. They claim no cells, so a shell can stand behind tiles; a piece with one in it
 * claims its cells through its other modules.
 */
const SHELLS: ReadonlySet<DecoKind> = new Set([
  'facade',
  'gantry',
  'flywheel',
  'headframe',
  'hull',
  'billboard',
  'clockface',
  'windmill',
  'headhouse',
  'barn',
  'flume',
  'trestle',
]);

/** Scenery dressing for set pieces. Occupies its cells for placement (a backdrop shell none); no runtime behavior. */
export const deco = defineModule<'deco'>({
  type: 'deco',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), w: m.w * x.T, h: m.h * x.T }),
  anchors: (m) => {
    const out: Cell[] = [];
    if (SHELLS.has(m.kind)) return out;
    for (let y = Math.floor(m.at[1]); y < Math.ceil(m.at[1] + m.h); y++) for (let x = Math.floor(m.at[0]); x < Math.ceil(m.at[0] + m.w); x++) out.push([x, y]);
    return out;
  },
});
