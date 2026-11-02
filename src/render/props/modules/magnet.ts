import { css, type HSL } from '../../../core/color';
import { magnetCycle } from '../../../sim/props';
import { line, type P, stroke } from '../../ink';
import { ball, dot, INK, path, pen, sprite, stamp, tick, tone } from '../../ink-props';
import { circle, glowDot, light, type MetalPalette } from '../../kit';
import { defineArt } from '../common';
import { backplate, housed } from '../machine';

/**
 * The core: a black hole in a jar (pull) or a hot pushy orb (push), inked. Black Hole Lite wears a diet
 * soda's silver band.
 */
function orb(pull: boolean, lite: boolean) {
  return sprite(`mg|${pull}|${lite}`, -7, -7, 14, 14, (g) => {
    const base: HSL = pull ? { h: 268, s: 45, l: 26 } : { h: 22, s: 70, l: 46 };
    // A touch smaller than the cell, so the horseshoe's arms show either side of it.
    g.scale(0.86, 0.86);
    ball(g, 0, 0, 5, base, 3);
    if (pull) {
      // The event horizon swirl.
      g.fillStyle = css(base, 26, 0.9);
      const sw: P[] = [];
      for (let i = 0; i <= 18; i++) {
        const a = (i / 18) * Math.PI * 3;
        const r = 3.8 - (i / 18) * 3;
        sw.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.7 });
      }
      stroke(g, sw, { w: 0.6, seed: 4, taper: [0.1, 0.6], press: 0.1 });
      g.fillStyle = INK;
      g.beginPath();
      g.arc(0, 0, 1.3, 0, Math.PI * 2);
      g.fill();
    } else {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + 0.4;
        tick(g, Math.cos(a) * 1.6, Math.sin(a) * 1.6, Math.cos(a) * 3.6, Math.sin(a) * 3.6, 0.6, i, css(base, 30));
      }
    }
    if (lite) {
      g.save();
      g.beginPath();
      g.arc(0, 0, 5, 0, Math.PI * 2);
      g.clip();
      g.fillStyle = '#dfe4ec';
      g.fillRect(-6, -1.4, 12, 2.8);
      g.fillStyle = '#c6202a';
      g.font = 'bold 2.3px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('LITE', 0, 0.1);
      g.restore();
      tick(g, -4.8, -1.5, 4.8, -1.5, 0.35, 5);
      tick(g, -4.8, 1.5, 4.8, 1.5, 0.35, 6);
    }
  });
}

/**
 * The housing, a whole cell: a cartoon horseshoe magnet standing on its bend, its poles up, cradling the
 * core between its arms. A repulsor's is painted the other pole's blue.
 */
function horseshoe(pull: boolean, pal: MetalPalette) {
  return sprite(`mg|shoe|${pull}|${pal.base.h},${pal.base.l}`, -10, -10, 20, 20, (g) => {
    backplate(g, -8, -8, 16, 16, pal, 1);
    for (const sx of [-6, 6]) dot(g, sx, 6.2, 0.85, 2 + sx, css(pal.light));
    const paint: HSL = pull ? { h: 356, s: 72, l: 48 } : { h: 214, s: 66, l: 48 };
    const R = 7.8;
    const r = 3.3;
    const cy = 0.2;
    const shoe: P[] = [{ x: -R, y: -7.9 }];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI - (i / 12) * Math.PI;
      shoe.push({ x: Math.cos(a) * R, y: cy + Math.sin(a) * R * 0.98 });
    }
    shoe.push({ x: R, y: -7.9 }, { x: r, y: -7.9 });
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI;
      shoe.push({ x: Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    shoe.push({ x: -r, y: -7.9 });
    tone(g, shoe, paint, { depth: 1.2, shade: -18 });
    g.save();
    path(g, shoe);
    g.clip();
    // Steel pole pieces on the arms' ends, and a hard shine down the left arm.
    g.fillStyle = css({ h: 210, s: 10, l: 82 });
    g.fillRect(-9, -9, 18, 4.6);
    g.fillStyle = css({ h: 210, s: 12, l: 60 });
    g.fillRect(-9, -5.1, 18, 0.7);
    g.fillStyle = INK;
    line(g, -9, -4.4, 9, -4.4, { w: 0.7, seed: 3, taper: [0, 0], press: 0.2 });
    g.fillStyle = css(paint, 26);
    line(g, -6.6, -3.4, -6.4, 2.6, { w: 0.9, seed: 4, taper: [0.2, 0.4], press: 0.1 });
    g.restore();
    pen(g, shoe, 5, 0.6, 1.6);
  });
}

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
    // Core orb on the block, inked; the glow sits behind it so the pen stays on top.
    glowDot(g, x, y, 6 + charge * 6 + (on ? Math.sin(rc.t * 9) * 1.5 : 0), col, 0.4 + charge * 0.5);
    if (housed(d.r)) stamp(s, horseshoe(pull, d.pal), x, y);
    stamp(s, orb(pull, d.r.pp.def.name.includes('Lite')), x, y);
    g.fillStyle = css(col, 30, 0.35 + charge * 0.5);
    circle(g, x, y, 1.2 + charge);
    // Field edge, at the radius the sim uses. A repulsor's is floor tape with its distance on it.
    g.save();
    g.strokeStyle = css(col, 5, on ? 0.45 : 0.12 + charge * 0.4);
    g.lineWidth = on ? 1.2 : 0.8;
    if (!pull) g.setLineDash([5, 3]);
    else if (!on) g.setLineDash([2, 4]);
    g.beginPath();
    g.arc(x, y, m.radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (c.seg === 1 ? charge : 1));
    g.stroke();
    if (!pull) {
      g.fillStyle = css(col, 15, on ? 0.75 : 0.3 + charge * 0.4);
      g.font = 'bold 5px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('6 FT', x, y - m.radius - 4);
    }
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
