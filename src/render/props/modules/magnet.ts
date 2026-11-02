import { css, type HSL } from '../../../core/color';
import { magnetCycle } from '../../../sim/props';
import { circle, glowDot, light, sphereFill } from '../../kit';
import { defineArt } from '../common';

/**
 * Gravity well / repulsor. The field edge is drawn as a ring at the exact
 * radius the sim uses; motes stream inward (pull) or outward (push) while
 * it's on. Pulsing fields show a dim dotted ring while off and a filling
 * ring while charging.
 */
defineArt<'magnet'>({
  type: 'magnet',
  layer: 3,
  draw(rc, m, d) {
    const s = rc.s;
    const g = rc.g;
    const x = m.at[0] + d.off[0];
    const y = m.at[1] + d.off[1];
    const c = magnetCycle(m, rc.frame, d.r.phase);
    const pull = m.polarity > 0;
    const col: HSL = pull ? { h: 275, s: 90, l: 62 } : { h: 28, s: 100, l: 60 };
    const on = c.seg === 2;
    const charge = c.seg === 1 ? c.t / c.len : on ? 1 : 0;
    // Core orb on the block.
    s.fillStyle = sphereFill(s, x, y, 5, pull ? { h: 270, s: 40, l: 30 } : { h: 20, s: 50, l: 34 }, 35, 20);
    circle(s, x, y, 5);
    glowDot(g, x, y, 6 + charge * 6 + (on ? Math.sin(rc.t * 9) * 1.5 : 0), col, 0.4 + charge * 0.5);
    g.fillStyle = css(col, 30, 0.5 + charge * 0.5);
    circle(g, x, y, 1.8 + charge);
    // Field edge.
    g.save();
    g.strokeStyle = css(col, 5, on ? 0.45 : 0.12 + charge * 0.4);
    g.lineWidth = on ? 1.2 : 0.8;
    if (!on) g.setLineDash([2, 4]);
    g.beginPath();
    g.arc(x, y, m.radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (c.seg === 1 ? charge : 1));
    g.stroke();
    g.restore();
    if (!on) return;
    // Streaming motes: 14 spokes, each mote travels in (pull) or out (push) once a second.
    const n = 14;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + (i % 2) * 0.2;
      let u = (rc.t * 0.9 + i * 0.37) % 1;
      if (pull) u = 1 - u;
      const r = 6 + u * (m.radius - 6);
      const fade = Math.sin(u * Math.PI);
      g.fillStyle = css(col, 20, 0.7 * fade);
      circle(g, x + Math.cos(a) * r, y + Math.sin(a) * r, 1.1);
    }
    light(rc, x, y, m.radius * 1.1, col, 0.35);
  },
});
