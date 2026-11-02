import type { Vec } from '../../../core/geom';
import { TILE } from '../../../sim/constants';
import type { Module, ModuleOf } from '../../../sim/props';
import { spikeSprite } from '../../ink-build';
import { stamp } from '../../ink-props';
import type { MetalPalette, RC } from '../../kit';
import { defineArt } from '../common';

type M<T extends Module['type']> = ModuleOf<T>;

/** Spike rails on a block's faces: baked once per light side, stamped per cell in the face's frame. */
function drawSpikes(rc: RC, m: M<'spikes'>, off: Vec, pal: MetalPalette) {
  const s = rc.s;
  for (const [x, y] of m.cells) {
    s.save();
    s.translate((x + 0.5) * TILE + off[0], (y + 0.5) * TILE + off[1]);
    s.rotate(m.angle);
    stamp(s, spikeSprite(m.angle, x * 31 + y * 17, pal.dark));
    s.restore();
  }
}

defineArt<'spikes'>({ type: 'spikes', layer: 1, draw: (rc, m, d) => drawSpikes(rc, m, d.off, d.pal) });
