import { css } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { SNAP_ARM, SNAP_COOL, SNAP_SPIKE, SNAP_UP, snapperPhase } from '../../../sim/props';
import { glowDot, metalFill, rivet } from '../../kit';
import { defineArt } from '../common';

/**
 * Pop-up spike plate. Drawn in the cell's local frame with -y as the face
 * normal: a riveted plate with slots; tips peek and rattle while arming,
 * shoot out to SNAP_SPIKE px while up (exactly the sim's lethal strip), and
 * sink back during cooldown.
 */
defineArt<'snapper'>({
  type: 'snapper',
  layer: 2,
  draw(rc, m, d) {
    const s = rc.s;
    const g = rc.g;
    const ph = snapperPhase(m, d.o.state, d.mi, rc.frame);
    let ext = 0;
    if (ph.seg === SNAP_ARM) ext = 1.5 + (Math.floor(rc.frame / 2) % 2) * 1.2;
    else if (ph.seg === SNAP_UP) ext = SNAP_SPIKE * Math.min(1, ph.u * 6);
    else if (ph.seg === SNAP_COOL) ext = SNAP_SPIKE * (1 - Math.min(1, ph.u * 2.5)) * 0.8;
    for (const [cx, cy] of m.cells) {
      s.save();
      s.translate((cx + 0.5) * TILE + d.off[0], (cy + 0.5) * TILE + d.off[1]);
      s.rotate(m.angle + Math.PI / 2);
      const top = -TILE / 2;
      // Spikes (behind the plate edge so they rise out of the slots).
      if (ext > 0) {
        s.fillStyle = metalFill(s, d.pal, -8, top - ext, 16, ext);
        s.strokeStyle = css(d.pal.dark, -10);
        s.lineWidth = 0.6;
        for (let i = 0; i < 4; i++) {
          const bx = -6 + i * 4;
          s.beginPath();
          s.moveTo(bx - 1.6, top);
          s.lineTo(bx, top - ext);
          s.lineTo(bx + 1.6, top);
          s.closePath();
          s.fill();
          s.stroke();
        }
      }
      s.fillStyle = metalFill(s, d.pal, -8, top - 3, 16, 3);
      s.fillRect(-8, top - 3, 16, 3);
      s.fillStyle = css(d.pal.dark, -15);
      for (let i = 0; i < 4; i++) s.fillRect(-6.8 + i * 4, top - 2.6, 1.6, 1);
      rivet(s, -7, top - 1.5, d.pal, 0.6);
      rivet(s, 7, top - 1.5, d.pal, 0.6);
      s.restore();
      if (ph.seg === SNAP_ARM) {
        const [nx, ny] = [Math.cos(m.angle), Math.sin(m.angle)];
        glowDot(g, (cx + 0.5 + nx * 0.5) * TILE + d.off[0], (cy + 0.5 + ny * 0.5) * TILE + d.off[1], 7, { h: 10, s: 100, l: 55 }, 0.5 + ph.u * 0.4);
      }
    }
  },
});
