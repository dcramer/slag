import { css } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { TILE } from '../../../sim/constants';
import type { Module, ModuleOf } from '../../../sim/props';
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
    s.fillStyle = css(pal.dark, -5);
    s.fillRect(7, -7, 2, 14);
    for (let i = 0; i < 3; i++) {
      const y0 = -7 + i * 4.67;
      const gr = s.createLinearGradient(8, y0, 8, y0 + 4.67);
      gr.addColorStop(0, '#f2f4f8');
      gr.addColorStop(0.5, '#b6bcc8');
      gr.addColorStop(1, '#5d6370');
      s.fillStyle = gr;
      s.beginPath();
      s.moveTo(8.5, y0 + 0.2);
      s.lineTo(15.5, y0 + 2.33);
      s.lineTo(8.5, y0 + 4.47);
      s.fill();
      s.fillStyle = 'rgba(160,20,30,0.85)';
      s.beginPath();
      s.moveTo(13.2, y0 + 1.6);
      s.lineTo(15.5, y0 + 2.33);
      s.lineTo(13.2, y0 + 3.1);
      s.fill();
    }
    s.restore();
  }
}

defineArt<'spikes'>({ type: 'spikes', layer: 1, draw: (rc, m, d) => drawSpikes(rc, m, d.off, d.pal) });
