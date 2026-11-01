import { css } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { dirOf, fanZone, type Module, type ModuleOf, type PropStyle } from '../../../sim/props';
import { circle, type MetalPalette, type RC, sphereFill } from '../../kit';
import { defineArt, type PropDrawOpts } from '../common';

type M<T extends Module['type']> = ModuleOf<T>;

function drawFan(rc: RC, m: M<'fan'>, off: Vec, pal: MetalPalette, st: PropStyle, o: PropDrawOpts) {
  const s = rc.s;
  const x = m.at[0] + off[0];
  const y = m.at[1] + off[1];
  if (o.level) {
    const z = fanZone(o.level, m, off);
    const [dx, dy] = dirOf(m.angle);
    const len = dx !== 0 ? z.w : z.h;
    const g = rc.g;
    g.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const p = (rc.t * (m.strength / 900) + i / 7) % 1;
      const along = p * len;
      const across = 3 + ((i * 7) % 11);
      const fade = Math.sin(p * Math.PI);
      g.strokeStyle = `rgba(220,240,255,${0.28 * fade})`;
      g.lineWidth = 1;
      g.beginPath();
      if (dx !== 0) {
        const lx = dx > 0 ? z.x + along : z.x + z.w - along;
        const ly = z.y + across + Math.sin(p * 9 + i) * 1.5;
        g.moveTo(lx, ly);
        g.lineTo(lx - dx * 7, ly);
      } else {
        const ly = dy > 0 ? z.y + along : z.y + z.h - along;
        const lx = z.x + across + Math.sin(p * 9 + i) * 1.5;
        g.moveTo(lx, ly);
        g.lineTo(lx, ly - dy * 7);
      }
      g.stroke();
    }
  }
  s.save();
  s.translate(x, y);
  s.fillStyle = 'rgba(10,10,14,0.85)';
  circle(s, 0, 0, 6.4);
  s.rotate(rc.t * (m.strength / 80));
  for (let i = 0; i < 4; i++) {
    s.rotate(Math.PI / 2);
    s.fillStyle = css({ h: st.hue, s: 50, l: 70 }, 0, 0.85);
    s.beginPath();
    s.ellipse(3.2, 0, 3.2, 1.5, 0.35, 0, Math.PI * 2);
    s.fill();
  }
  s.restore();
  s.strokeStyle = css(pal.light, 0, 0.6);
  s.lineWidth = 0.6;
  for (let i = -2; i <= 2; i++) {
    s.beginPath();
    s.moveTo(x - 6.2, y + i * 2.5);
    s.lineTo(x + 6.2, y + i * 2.5);
    s.stroke();
  }
  s.fillStyle = sphereFill(s, x, y, 1.6, pal.base);
  circle(s, x, y, 1.6);
}

defineArt<'fan'>({ type: 'fan', layer: 2, draw: (rc, m, d) => drawFan(rc, m, d.off, d.pal, d.style, d.o) });
