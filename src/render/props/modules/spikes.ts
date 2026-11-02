import { css } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { TILE } from '../../../sim/constants';
import type { Module, ModuleOf } from '../../../sim/props';
import { inkThorns } from '../../ink-parts';
import type { MetalPalette, RC } from '../../kit';
import { defineArt } from '../common';

type M<T extends Module['type']> = ModuleOf<T>;

function drawSpikes(rc: RC, m: M<'spikes'>, off: Vec, pal: MetalPalette) {
  const s = rc.s;
  for (const [x, y] of m.cells) {
    s.save();
    s.translate((x + 0.5) * TILE + off[0], (y + 0.5) * TILE + off[1]);
    s.rotate(m.angle);
    // Local frame: spikes protrude toward +x from the face at x = 8.
    inkThorns(s, m.angle, x * 31 + y * 17, css(pal.dark, 4));
    s.restore();
  }
}

defineArt<'spikes'>({ type: 'spikes', layer: 1, draw: (rc, m, d) => drawSpikes(rc, m, d.off, d.pal) });
