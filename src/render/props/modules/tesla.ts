import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { type Module, type ModuleOf, type PropStyle, type Resolved, teslaCycle } from '../../../sim/props';
import { circle, ellipse, glowDot, light, lightning, METALS, type MetalPalette, type RC, sphereFill } from '../../kit';
import { beamOf, defineArt, type PropDrawOpts } from '../common';

type M<T extends Module['type']> = ModuleOf<T>;

function drawTesla(rc: RC, m: M<'tesla'>, r: Resolved, mi: number, off: Vec, pal: MetalPalette, st: PropStyle, o: PropDrawOpts) {
  const s = rc.s;
  const g = rc.g;
  const c = teslaCycle(m, rc.frame, r.phase);
  const col: HSL = { h: st.glowHue, s: 100, l: 65 };
  const tops: [number, number][] = [];
  for (const p of [m.a, m.b]) {
    const x = p[0] + off[0];
    const y = p[1] + off[1];
    // Coil stack.
    for (let i = 0; i < 4; i++) {
      const cy = y + 5 - i * 3.2;
      const w = 6 - i * 0.8;
      s.fillStyle = sphereFill(s, x, cy, w, METALS.copper.base, 25, 20);
      ellipse(s, x, cy, w, 1.8);
      s.strokeStyle = css(METALS.copper.dark);
      s.lineWidth = 0.6;
      s.stroke();
    }
    s.fillStyle = sphereFill(s, x, y - 9, 3.4, pal.base, 35, 20);
    circle(s, x, y - 9, 3.4);
    tops.push([x, y - 9]);
    const idle = c.seg === 1 ? c.t / c.len : c.seg === 2 ? 1 : 0.15;
    glowDot(g, x, y - 9, 5 + idle * 7, col, 0.3 + idle * 0.6);
    if (Math.random() < 0.1 + idle * 0.5) {
      g.strokeStyle = css(col, 20, 0.7);
      g.lineWidth = 0.7;
      const ra = Math.random() * Math.PI * 2;
      lightning(g, x, y - 9, x + Math.cos(ra) * 7, y - 9 + Math.sin(ra) * 7, 3, 4);
      g.stroke();
    }
  }
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
