import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { circle } from '../../kit';
import { defineArt } from '../common';

/** Sticky web: anchor threads between neighboring cells plus a little orb-web in each cell. Dew catches the light. */
defineArt<'web'>({
  type: 'web',
  layer: 2,
  draw(rc, m, d) {
    const s = rc.s;
    const g = rc.g;
    const set = new Set(m.cells.map(([x, y]) => `${x},${y}`));
    const ox = d.off[0];
    const oy = d.off[1];
    s.save();
    s.lineCap = 'round';
    // Faint fill so the zone reads at a glance.
    s.fillStyle = 'rgba(225,225,235,0.07)';
    for (const [x, y] of m.cells) s.fillRect(x * TILE + ox, y * TILE + oy, TILE, TILE);
    s.strokeStyle = 'rgba(232,232,242,0.75)';
    s.lineWidth = 0.6;
    for (const [x, y] of m.cells) {
      const cx = (x + 0.5) * TILE + ox;
      const cy = (y + 0.5) * TILE + oy;
      const sway = Math.sin(rc.t * 1.3 + x + y * 0.7) * 0.4;
      // Spokes to the cell corners and edge midpoints.
      s.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        const rr = k % 2 ? TILE * 0.7 : TILE * 0.5;
        s.moveTo(cx, cy);
        s.lineTo(cx + Math.cos(a) * rr * 0.98 + sway, cy + Math.sin(a) * rr * 0.98);
      }
      s.stroke();
      // Spiral rings.
      for (const r of [2.5, 4.8, 7]) {
        s.beginPath();
        for (let k = 0; k <= 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const sag = k % 2 ? 0.86 : 1;
          s.lineTo(cx + Math.cos(a) * r * sag + sway * 0.5, cy + Math.sin(a) * r * sag + 0.4);
        }
        s.stroke();
      }
      // Bridges to neighbors.
      if (set.has(`${x + 1},${y}`)) {
        s.beginPath();
        s.moveTo(cx, cy);
        s.quadraticCurveTo(cx + 8, cy + 2, cx + 16, cy);
        s.stroke();
      }
      if (set.has(`${x},${y + 1}`)) {
        s.beginPath();
        s.moveTo(cx, cy);
        s.quadraticCurveTo(cx + 1.5, cy + 8, cx, cy + 16);
        s.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const k = hash2(x * 3 + i, y, d.r.pp.uid);
        const a = k * Math.PI * 2;
        const rr = 2.5 + hash2(i, x, y) * 4.5;
        g.fillStyle = `rgba(210,235,255,${0.35 + 0.3 * Math.sin(rc.t * 2 + k * 9)})`;
        circle(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.6);
      }
    }
    s.restore();
  },
});
