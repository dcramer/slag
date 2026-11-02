import { css } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { dirOf, fanColumn, type Module, type ModuleOf, type PropStyle, type Resolved } from '../../../sim/props';
import { windProfile, windSpeed } from '../../../sim/wind';
import { circle, type MetalPalette, type RC, sphereFill } from '../../kit';
import { beamOf, defineArt, type PropDrawOpts } from '../common';

type M<T extends Module['type']> = ModuleOf<T>;

/**
 * Fan art, drawn from the sim's own column (fanColumn at its Beam) and air profile
 * (windProfile): streaks travel at the air speed and fade/shorten exactly
 * where the push tapers off; the blades spin in proportion to the air speed.
 * Timing comes from the sim frame, so a paused sim pauses the art.
 */
function drawFan(rc: RC, m: M<'fan'>, r: Resolved, mi: number, off: Vec, pal: MetalPalette, st: PropStyle, o: PropDrawOpts) {
  const s = rc.s;
  const x = m.at[0] + off[0];
  const y = m.at[1] + off[1];
  const speed = windSpeed(m.strength);
  const t = rc.frame / 60;
  const beam = beamOf(o, r, mi);
  if (beam) {
    const z = fanColumn(m, beam.len, off);
    const [dx, dy] = dirOf(m.angle);
    const len = dx !== 0 ? z.w : z.h;
    const across = dx !== 0 ? z.h : z.w;
    const g = rc.g;
    g.lineCap = 'round';
    const n = Math.max(5, Math.round(len / 9));
    for (let i = 0; i < n; i++) {
      // Each streak rides the air from the fan face to the column end at the air speed.
      const along = (t * speed + (i * len) / n + ((i * 37) % 13)) % len;
      const k = windProfile(z, len - along);
      if (k <= 0.02) continue;
      const a = 0.34 * Math.min(1, along / 10) * k * (0.6 + speed / 600);
      const lat = 3 + ((i * 7) % Math.max(1, across - 6)) + Math.sin(t * 9 + i * 1.7) * 0.8;
      const tail = 3 + (speed / 20) * k;
      g.strokeStyle = `rgba(220,240,255,${a})`;
      g.lineWidth = 1;
      g.beginPath();
      if (dx !== 0) {
        const lx = dx > 0 ? z.x + along : z.x + z.w - along;
        const ly = z.y + lat;
        g.moveTo(lx, ly);
        g.lineTo(lx - dx * tail, ly);
      } else {
        const ly = dy > 0 ? z.y + along : z.y + z.h - along;
        const lx = z.x + lat;
        g.moveTo(lx, ly);
        g.lineTo(lx, ly - dy * tail);
      }
      g.stroke();
    }
  }
  s.save();
  s.translate(x, y);
  s.fillStyle = 'rgba(10,10,14,0.85)';
  circle(s, 0, 0, 6.4);
  // Motion-blur disc: stronger fans read as a faster blur.
  s.fillStyle = css({ h: st.hue, s: 40, l: 70 }, 0, Math.min(0.35, speed / 900));
  circle(s, 0, 0, 5.8);
  // <= 0.35 rad/frame so the 4-blade rotor never strobes backwards.
  s.rotate(t * (speed / 12));
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

defineArt<'fan'>({ type: 'fan', layer: 2, draw: (rc, m, d) => drawFan(rc, m, d.r, d.mi, d.off, d.pal, d.style, d.o) });
