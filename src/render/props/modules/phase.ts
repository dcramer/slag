import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { PHASE_WARN, phaseCycle, phaseSolid } from '../../../sim/props';
import { line } from '../../ink';
import { stampPhaseTile } from '../../ink-blocks';
import { light } from '../../kit';
import { defineArt } from '../common';

/**
 * Blink blocks. Solid cells are inked switch blocks; in their last PHASE_WARN frames they flicker.
 * Gone cells are a pencilled outline that fills from the bottom in the PHASE_WARN frames before they
 * return. Paired sets get complementary colors so you can see which set is next.
 */
defineArt<'phase'>({
  type: 'phase',
  layer: 1,
  draw(rc, m, d) {
    const s = rc.s;
    const c = phaseCycle(m, rc.frame, d.r.phase);
    const left = c.len - c.t;
    const hue = (d.style.glowHue + (m.offset > 0 ? 180 : 0)) % 360;
    const col: HSL = { h: hue, s: 85, l: 58 };
    const ox = d.off[0];
    const oy = d.off[1];
    m.cells.forEach(([cx, cy], ci) => {
      const x = cx * TILE + ox;
      const y = cy * TILE + oy;
      // A card shows every block there: what you buy is the bricks, not the moment between them.
      if (!d.o.level || phaseSolid(m, rc.frame, d.r.phase, d.o.state, d.mi, ci)) {
        const warn = left <= PHASE_WARN;
        const blink = !!d.o.level && warn && Math.floor(rc.frame / (left < 12 ? 2 : 4)) % 2 === 0;
        const a0 = s.globalAlpha;
        s.globalAlpha = a0 * (blink ? 0.45 : 1);
        stampPhaseTile(s, x, y, hue, ci + cx * 7);
        s.globalAlpha = a0;
      } else {
        // Where it will be: a dashed pencil square, every dash its own stroke.
        s.fillStyle = css(col, 12, 0.55);
        for (let i = 0; i < 4; i++) {
          const [ax, ay, bx, by] = [
            [1.5, 1.5, TILE - 1.5, 1.5],
            [TILE - 1.5, 1.5, TILE - 1.5, TILE - 1.5],
            [TILE - 1.5, TILE - 1.5, 1.5, TILE - 1.5],
            [1.5, TILE - 1.5, 1.5, 1.5],
          ][i];
          for (let k = 0; k < 3; k++) {
            const u0 = k / 3 + 0.04;
            const u1 = k / 3 + 0.22;
            line(s, x + ax + (bx - ax) * u0, y + ay + (by - ay) * u0, x + ax + (bx - ax) * u1, y + ay + (by - ay) * u1, {
              w: 1,
              seed: i * 3 + k,
              taper: [0.2, 0.2],
              press: 0,
            });
          }
        }
        if (c.seg === 1 && left <= PHASE_WARN) {
          const u = 1 - left / PHASE_WARN;
          s.fillStyle = css(col, 0, 0.3 + u * 0.4);
          s.fillRect(x + 2, y + TILE - 2 - (TILE - 4) * u, TILE - 4, (TILE - 4) * u);
        }
      }
    });
    const [cx, cy] = m.cells[0];
    light(rc, (cx + 0.5) * TILE + ox, (cy + 0.5) * TILE + oy, 40, col, c.seg === 0 ? 0.35 : 0.1);
  },
});
