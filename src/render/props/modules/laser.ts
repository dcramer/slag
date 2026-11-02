import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { laserAngle, laserCycle, type Module, type ModuleOf, type PropStyle, type Resolved } from '../../../sim/props';
import { glowDot, light, type MetalPalette, metalFill, type RC, rrect } from '../../kit';
import { beamOf, defineArt, type PropDrawOpts } from '../common';

type M<T extends Module['type']> = ModuleOf<T>;

function drawLaser(rc: RC, m: M<'laser'>, r: Resolved, mi: number, off: Vec, pal: MetalPalette, st: PropStyle, o: PropDrawOpts) {
  const f = rc.frame;
  const x = m.at[0] + off[0];
  const y = m.at[1] + off[1];
  const beam = beamOf(o, r, mi);
  const a = beam?.angle ?? laserAngle(m, f, r.phase);
  const c = laserCycle(m, f, r.phase);
  const col: HSL = { h: st.glowHue, s: 100, l: 58 };
  const s = rc.s;
  const g = rc.g;
  // Emitter: rotating lens housing.
  s.save();
  s.translate(x, y);
  s.rotate(a);
  s.fillStyle = metalFill(s, pal, -3, -4.5, 12, 9);
  rrect(s, -3, -4.5, 12, 9, 2.5);
  s.fill();
  s.strokeStyle = css(pal.dark, -10);
  s.lineWidth = 0.8;
  s.stroke();
  s.fillStyle = css(pal.dark);
  s.fillRect(7.5, -3.5, 2.5, 7);
  s.restore();
  const lx = x + Math.cos(a) * 9;
  const ly = y + Math.sin(a) * 9;
  const charge = c.seg === 1 ? c.t / c.len : c.seg === 2 ? 1 : 0.1;
  glowDot(g, lx, ly, 3 + charge * 6, col, 0.6 + charge * 0.4);
  const len = beam?.len ?? 40;
  const ex = x + Math.cos(a) * len;
  const ey = y + Math.sin(a) * len;
  if (c.seg === 1) {
    if (Math.floor(f / 3) % 2 === 0 || charge > 0.7) {
      g.strokeStyle = css(col, 10, 0.25 + charge * 0.4);
      g.lineWidth = 0.6 + charge * 0.6;
      g.setLineDash([4, 4]);
      g.beginPath();
      g.moveTo(lx, ly);
      g.lineTo(ex, ey);
      g.stroke();
      g.setLineDash([]);
    }
    if (o.emit && Math.random() < charge) {
      const ra = Math.random() * Math.PI * 2;
      o.emit('spark', lx + Math.cos(ra) * 10, ly + Math.sin(ra) * 10, -Math.cos(ra) * 60, -Math.sin(ra) * 60, col);
    }
    light(rc, lx, ly, 30 + charge * 40, col, 0.5 * charge);
  } else if (c.seg === 2) {
    const ramp = Math.min(1, c.t / 4) * Math.min(1, (c.len - c.t) / 5);
    const w = (1 + Math.sin(rc.t * 50) * 0.15) * ramp;
    for (const [lw, al, dl] of [
      [10, 0.25, 0],
      [5, 0.55, 10],
      [2, 1, 40],
    ] as const) {
      g.strokeStyle = css(col, dl, al);
      g.lineWidth = lw * w;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(lx, ly);
      g.lineTo(ex, ey);
      g.stroke();
    }
    glowDot(g, ex, ey, 10 * w, col, 0.9);
    for (let d = 0; d < len; d += 70) light(rc, x + Math.cos(a) * d, y + Math.sin(a) * d, 60, col, 0.8 * ramp);
    light(rc, ex, ey, 70, col, 1.1 * ramp);
    if (o.emit)
      for (let i = 0; i < 2; i++)
        o.emit('spark', ex, ey, -Math.cos(a) * 80 + (Math.random() - 0.5) * 160, -Math.sin(a) * 80 + (Math.random() - 0.5) * 160 - 40, col);
  }
}

defineArt<'laser'>({ type: 'laser', layer: 3, draw: (rc, m, d) => drawLaser(rc, m, d.r, d.mi, d.off, d.pal, d.style, d.o) });
