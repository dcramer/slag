import type { HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { TILE } from '../../../sim/constants';
import { dirOf, flameCycle, type Module, type ModuleOf, type PropStyle, type Resolved } from '../../../sim/props';
import { glowDot, light, type MetalPalette, type RC } from '../../kit';
import { beamOf, defineArt, nozzle, type PropDrawOpts } from '../common';

type M<T extends Module['type']> = ModuleOf<T>;

function drawFlame(rc: RC, m: M<'flame'>, r: Resolved, mi: number, off: Vec, pal: MetalPalette, _st: PropStyle, o: PropDrawOpts) {
  const f = rc.frame;
  const x = m.at[0] + off[0];
  const y = m.at[1] + off[1];
  const [dx, dy] = dirOf(m.angle);
  nozzle(rc.s, x, y, m.angle, pal, 7, 9);
  const c = flameCycle(m, f, r.phase);
  const fire: HSL = { h: 28, s: 100, l: 55 };
  const nx = x + dx * 10;
  const ny = y + dy * 10;
  if (c.seg === 1) {
    // Pilot light + sputter.
    const p = c.t / c.len;
    glowDot(rc.g, nx, ny, 5 + p * 5, { h: 210, s: 100, l: 60 }, 0.8);
    if (o.emit && Math.random() < 0.35) o.emit('smoke', nx, ny, dx * 20 + (Math.random() - 0.5) * 10, dy * 20 - 10);
    if (o.emit && Math.random() < p) o.emit('ember', nx, ny, dx * 80 + (Math.random() - 0.5) * 40, dy * 80 + (Math.random() - 0.5) * 40, fire);
    light(rc, nx, ny, 30, { h: 210, s: 100, l: 60 }, 0.4);
  } else if (c.seg === 2) {
    const beam = beamOf(o, r, mi);
    const len = beam?.len ?? m.length + TILE / 2;
    const g = rc.g;
    const ramp = Math.min(1, c.t / 6) * Math.min(1, (c.len - c.t) / 6);
    const n = Math.ceil(len / 4);
    const px = -dy;
    const py = dx;
    for (let i = 0; i < n; i++) {
      const tt = i / n;
      const d = 10 + (len - 10) * tt * ramp;
      const jitter = Math.sin(rc.t * 30 + i * 1.7) * (1 + tt * 3);
      const fx = x + dx * d + px * jitter;
      const fy = y + dy * d + py * jitter;
      const rad = (3 + tt * 7) * ramp;
      const col: HSL = { h: 50 - tt * 40, s: 100, l: 70 - tt * 25 };
      glowDot(g, fx, fy, rad * 1.8, col, 0.55 * (1 - tt * 0.5), 0.35);
    }
    g.strokeStyle = 'rgba(255,255,230,0.85)';
    g.lineWidth = 2.5 * ramp;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(nx, ny);
    g.lineTo(x + dx * (10 + (len - 10) * 0.45 * ramp), y + dy * (10 + (len - 10) * 0.45 * ramp));
    g.stroke();
    for (let d = 10; d < len; d += 28) light(rc, x + dx * d, y + dy * d, 70, fire, 0.9 * ramp);
    if (beam?.hit) {
      // Whatever stopped it, it spreads out along the face.
      const ex = x + dx * len;
      const ey = y + dy * len;
      for (const side of [-1, 1]) {
        glowDot(g, ex + px * side * 6 * ramp, ey + py * side * 6 * ramp, 9 * ramp, { h: 34, s: 100, l: 62 }, 0.5, 0.35);
        if (o.emit && Math.random() < 0.4) o.emit('ember', ex, ey, px * side * 90 - dx * 25, py * side * 90 - dy * 25, fire);
      }
    }
    // A stopped flame throws its embers back rather than through what stopped it.
    const on = beam?.hit ? -0.4 : 1;
    if (o.emit && Math.random() < 0.8)
      o.emit('ember', x + dx * len * 0.8, y + dy * len * 0.8, dx * 60 * on + (Math.random() - 0.5) * 60, dy * 60 * on - 30, fire);
    if (o.emit && Math.random() < 0.3) o.emit('smoke', x + dx * len, y + dy * len, dx * 30 * on, dy * 30 * on - 20);
  }
}

defineArt<'flame'>({ type: 'flame', layer: 3, draw: (rc, m, d) => drawFlame(rc, m, d.r, d.mi, d.off, d.pal, d.style, d.o) });
