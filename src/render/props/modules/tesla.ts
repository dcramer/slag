import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { type Module, type ModuleOf, type PropStyle, type Resolved, teslaCycle } from '../../../sim/props';
import { blob, stroke } from '../../ink';
import { ball, boxPts, INK, part, path, pen, poly, sprite, stamp, tick } from '../../ink-props';
import { glowDot, light, lightning, type MetalPalette, type RC } from '../../kit';
import { beamOf, defineArt, type PropDrawOpts } from '../common';

type M<T extends Module['type']> = ModuleOf<T>;

/**
 * A pylon as a bug zapper (docs/PARODY.md, tesla): a cage of blue grid wire between two caps, a terminal
 * on a post above it where the arc jumps from, and on the first pylon a moth that got too close.
 */
function pylon(pal: MetalPalette, col: HSL, moth: boolean) {
  return sprite(`ts|${pal.base.h},${pal.base.l}|${col.h | 0}|${moth}`, -7.5, -13, 15, 21, (g) => {
    tick(g, 0, -6.4, 0, -9.6, 1.6, 1);
    tick(g, -0.2, -6.4, -0.2, -9.4, 0.5, 2, css(pal.light));
    ball(g, 0, -10.2, 1.9, pal.base, 3);
    // The cage: a dark inside, blue bars and rings over it.
    const cage = boxPts(-4.6, -5.2, 9.2, 10.4, 1, 4);
    g.fillStyle = '#141626';
    path(g, cage);
    g.fill();
    g.save();
    path(g, cage);
    g.clip();
    g.fillStyle = css(col, -25, 0.55);
    g.fillRect(-4.6, -5.2, 9.2, 10.4);
    g.fillStyle = '#5f86ff';
    for (let bx = -3.4; bx <= 3.5; bx += 1.7) g.fillRect(bx - 0.25, -5.2, 0.5, 10.4);
    g.fillStyle = '#9db4ff';
    for (const by of [-2.4, 0.6, 3.4]) g.fillRect(-4.6, by - 0.25, 9.2, 0.5);
    g.restore();
    pen(g, cage, 5, 0.45, 1);
    part(g, boxPts(-5.8, -7.2, 11.6, 2.4, 0.8, 6), pal.base, 6, { depth: 0.4, thin: 0.4, thick: 0.9 });
    part(g, boxPts(-6.2, 5, 12.4, 2.6, 0.8, 7), pal.base, 7, { depth: 0.5, thin: 0.45, thick: 1.1 });
    if (moth) {
      // Scorched, on its back on the base, with a last curl of smoke.
      g.fillStyle = '#2b2420';
      path(g, poly(2.4, 5.1, 3.6, 3.2, 4.4, 4.9));
      g.fill();
      path(g, poly(3.6, 5.1, 5.2, 3.4, 5.6, 5));
      g.fill();
      g.fillStyle = INK;
      blob(g, 4, 5, 0.75, 8, 0.6, 0.1);
      g.fill();
      g.fillStyle = 'rgba(210,205,200,0.8)';
      stroke(g, poly(4, 2.8, 3.4, 1.4, 4.4, 0.2, 3.8, -1.2), { w: 0.45, seed: 9, taper: [0.2, 0.8], press: 0 });
    }
  });
}

function drawTesla(rc: RC, m: M<'tesla'>, r: Resolved, mi: number, off: Vec, pal: MetalPalette, st: PropStyle, o: PropDrawOpts) {
  const s = rc.s;
  const g = rc.g;
  const c = teslaCycle(m, rc.frame, r.phase);
  const col: HSL = { h: st.glowHue, s: 100, l: 65 };
  const tops: [number, number][] = [];
  const idle = c.seg === 1 ? c.t / c.len : c.seg === 2 ? 1 : 0.15;
  [m.a, m.b].forEach((p, i) => {
    const x = p[0] + off[0];
    const y = p[1] + off[1];
    // The light inside the cage, behind its bars.
    glowDot(g, x, y - 0.5, 6 + idle * 3, col, 0.25 + idle * 0.45);
    stamp(s, pylon(pal, col, i === 0), x, y);
    tops.push([x, y - 10]);
    glowDot(g, x, y - 10, 4 + idle * 6, col, 0.3 + idle * 0.6);
    if (Math.random() < 0.1 + idle * 0.5) {
      g.strokeStyle = css(col, 20, 0.7);
      g.lineWidth = 0.7;
      const ra = Math.random() * Math.PI * 2;
      lightning(g, x, y - 10, x + Math.cos(ra) * 7, y - 10 + Math.sin(ra) * 7, 3, 4);
      g.stroke();
    }
  });
  const [a, b] = tops;
  if (beamOf(o, r, mi)?.hit) return; // Shorted: the coils charge, and nothing crosses.
  if (c.seg === 1 && Math.random() < c.t / c.len) {
    g.strokeStyle = css(col, 20, 0.35);
    g.lineWidth = 0.8;
    lightning(g, a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + (Math.random() - 0.5) * 10, 6, 5);
    g.stroke();
  }
  if (c.seg === 2) {
    const ax = m.a[0] + off[0];
    const ay = m.a[1] + off[1];
    const bx = m.b[0] + off[0];
    const by = m.b[1] + off[1];
    for (let k = 0; k < 3; k++) {
      lightning(g, ax, ay - 2, bx, by - 2, 7, 12);
      g.strokeStyle = css(col, 0, 0.4);
      g.lineWidth = 4;
      g.stroke();
      g.strokeStyle = css(col, 30, 0.95);
      g.lineWidth = 1.2;
      g.stroke();
    }
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    light(rc, mx, my, Math.hypot(bx - ax, by - ay) * 0.8 + 40, col, 1.1);
    if (o.emit && Math.random() < 0.5) o.emit('spark', mx, my, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, col);
  }
}

defineArt<'tesla'>({ type: 'tesla', layer: 3, draw: (rc, m, d) => drawTesla(rc, m, d.r, d.mi, d.off, d.pal, d.style, d.o) });
