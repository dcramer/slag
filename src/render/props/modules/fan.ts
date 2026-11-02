import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { dirOf, fanColumn, type Module, type ModuleOf, type PropStyle, type Resolved } from '../../../sim/props';
import { windProfile, windSpeed } from '../../../sim/wind';
import { stroke } from '../../ink';
import { ball, boxPts, INK, ovalPts, part, path, poly, sprite, stamp, tick } from '../../ink-props';
import type { MetalPalette, RC } from '../../kit';
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
  // The grip goes on the side away from where it blows, as a hair dryer's does.
  stamp(s, grip(st.hue), x, y);
  stamp(s, housing(pal), x, y);
  s.save();
  s.translate(x, y);
  // Blades: a blur that gets stronger with the air. <= 0.35 rad/frame so a 4-blade rotor never strobes backwards.
  s.fillStyle = css({ h: st.hue, s: 40, l: 70 }, 0, Math.min(0.35, speed / 900));
  s.beginPath();
  s.arc(0, 0, 5, 0, Math.PI * 2);
  s.fill();
  s.rotate(t * (speed / 12));
  s.fillStyle = css({ h: st.hue, s: 50, l: 72 }, 0, 0.9);
  for (let i = 0; i < 4; i++) {
    s.rotate(Math.PI / 2);
    s.beginPath();
    s.ellipse(2.8, 0, 2.7, 1.3, 0.35, 0, Math.PI * 2);
    s.fill();
  }
  s.restore();
  stamp(s, grill(pal), x, y);
}

/** The housing: a dark round mouth in a bezel. */
function housing(pal: MetalPalette) {
  return sprite(`fan|h|${pal.base.h},${pal.base.l}`, -8, -8, 16, 16, (g) => {
    part(g, ovalPts(0, 0, 6.9, 6.9, 3, 0.02), pal.base, 3, { depth: 0.9, thin: 0.5, thick: 1.2 });
    g.fillStyle = '#121218';
    path(g, ovalPts(0, 0, 5.4, 5.4, 4, 0.02));
    g.fill();
  });
}

/** Grill bars and a hub cap over the blades. */
function grill(pal: MetalPalette) {
  return sprite(`fan|g|${pal.base.h},${pal.base.l}`, -7, -7, 14, 14, (g) => {
    g.save();
    path(g, ovalPts(0, 0, 5.4, 5.4, 4, 0.02));
    g.clip();
    for (let i = -2; i <= 2; i++) tick(g, -6, i * 2.2, 6, i * 2.2 + 0.1, 0.45, i + 9, css(pal.light, -6, 0.85));
    g.restore();
    ball(g, 0, 0, 1.5, pal.base, 5);
  });
}

/** A household hair-dryer grip off the bottom-left, with a sliding switch and a bit of cord. */
function grip(hue: number) {
  return sprite(`fan|grip|${hue | 0}`, -12, -2, 12, 14, (g) => {
    const plastic: HSL = { h: hue, s: 55, l: 58 };
    g.save();
    g.translate(-4.4, 4);
    g.rotate(0.55);
    part(g, boxPts(-1.8, 0, 3.6, 6, 1.5, 6), plastic, 6, { depth: 0.6, thin: 0.45, thick: 1 });
    part(g, boxPts(-0.9, 1.6, 1.8, 2.4, 0.6, 7), { h: 0, s: 0, l: 92 }, 7, { depth: 0.2, thin: 0.3, thick: 0.5 });
    g.fillStyle = INK;
    stroke(g, poly(0, 5.8, 0.4, 7.2, -0.6, 8.2), { w: 1, seed: 8, taper: [0, 0.4], press: 0 });
    g.restore();
  });
}

defineArt<'fan'>({ type: 'fan', layer: 2, draw: (rc, m, d) => drawFan(rc, m, d.r, d.mi, d.off, d.pal, d.style, d.o) });
