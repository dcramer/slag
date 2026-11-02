import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { PHASE_WARN, phaseCycle, phaseSolid } from '../../../sim/props';
import { glowDot, light, rrect } from '../../kit';
import { defineArt } from '../common';

/**
 * Blink blocks. Solid cells are glassy tinted bricks; in their last
 * PHASE_WARN frames they flicker. Gone cells are a dashed outline that
 * fills from the bottom in the PHASE_WARN frames before they return.
 * Paired sets get complementary colors so you can see which set is next.
 */
defineArt<'phase'>({
  type: 'phase',
  layer: 1,
  draw(rc, m, d) {
    const s = rc.s;
    const g = rc.g;
    const c = phaseCycle(m, rc.frame, d.r.phase);
    const left = c.len - c.t;
    const col: HSL = { h: (d.style.glowHue + (m.offset > 0 ? 180 : 0)) % 360, s: 85, l: 58 };
    const ox = d.off[0];
    const oy = d.off[1];
    m.cells.forEach(([cx, cy], ci) => {
      const x = cx * TILE + ox;
      const y = cy * TILE + oy;
      if (phaseSolid(m, rc.frame, d.r.phase, d.o.state, d.mi, ci)) {
        const warn = left <= PHASE_WARN;
        const blink = warn && Math.floor(rc.frame / (left < 12 ? 2 : 4)) % 2 === 0;
        s.globalAlpha = blink ? 0.45 : 1;
        s.fillStyle = 'rgba(0,0,0,0.25)';
        s.fillRect(x + 1.5, y + 2.5, TILE, TILE);
        const gr = s.createLinearGradient(x, y, x, y + TILE);
        gr.addColorStop(0, css(col, 18));
        gr.addColorStop(1, css(col, -18));
        s.fillStyle = gr;
        rrect(s, x + 0.5, y + 0.5, TILE - 1, TILE - 1, 2.5);
        s.fill();
        s.strokeStyle = css(col, -30);
        s.lineWidth = 1;
        s.stroke();
        s.fillStyle = 'rgba(255,255,255,0.35)';
        s.fillRect(x + 2.5, y + 2, TILE - 6, 1.5);
        s.fillRect(x + 2.5, y + 3.5, 1.5, 5);
        s.globalAlpha = 1;
        glowDot(g, x + TILE / 2, y + TILE / 2, 9, col, blink ? 0.1 : 0.22);
      } else {
        s.save();
        s.strokeStyle = css(col, 10, 0.5);
        s.setLineDash([2, 2]);
        s.lineWidth = 1;
        s.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
        s.restore();
        if (c.seg === 1 && left <= PHASE_WARN) {
          const u = 1 - left / PHASE_WARN;
          s.fillStyle = css(col, 0, 0.25 + u * 0.35);
          s.fillRect(x + 1.5, y + TILE - 1.5 - (TILE - 3) * u, TILE - 3, (TILE - 3) * u);
          glowDot(g, x + TILE / 2, y + TILE / 2, 6 + u * 4, col, 0.15 + u * 0.3);
        }
      }
    });
    const [cx, cy] = m.cells[0];
    light(rc, (cx + 0.5) * TILE + ox, (cy + 0.5) * TILE + oy, 40, col, c.seg === 0 ? 0.35 : 0.1);
  },
});
