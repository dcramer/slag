import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { PHASE_WARN, phaseCycle, phaseSolid } from '../../../sim/props';
import { retroGhost } from '../../ink-build';
import { stampPhaseTile } from '../../ink-blocks';
import { boxPts, path } from '../../ink-props';
import { light } from '../../kit';
import { defineArt } from '../common';

/**
 * Blink blocks, as retro blocks: the first set is bricks, a paired second set is reversed question
 * blocks in the complementary color, so you can see which set is next. Solid cells flicker in their last
 * PHASE_WARN frames. A gone cell is its four corners in pencil, and fills from the bottom in the
 * PHASE_WARN frames before it returns.
 */
defineArt<'phase'>({
  type: 'phase',
  layer: 1,
  draw(rc, m, d) {
    const s = rc.s;
    const c = phaseCycle(m, rc.frame, d.r.phase);
    const left = c.len - c.t;
    const brick = m.offset === 0;
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
        stampPhaseTile(s, x, y, hue, ci + cx * 7, brick);
        s.globalAlpha = a0;
      } else {
        retroGhost(s, x, y, css(col, 12, 0.6), cx * 7 + cy);
        if (c.seg === 1 && left <= PHASE_WARN) {
          const u = 1 - left / PHASE_WARN;
          const h = (TILE - 4) * u;
          s.fillStyle = css(col, 0, 0.3 + u * 0.4);
          path(s, boxPts(x + 2, y + TILE - 2 - h, TILE - 4, h, 1, cx * 3 + cy, 0.2));
          s.fill();
        }
      }
    });
    const [cx, cy] = m.cells[0];
    light(rc, (cx + 0.5) * TILE + ox, (cy + 0.5) * TILE + oy, 40, col, c.seg === 0 ? 0.35 : 0.1);
  },
});
