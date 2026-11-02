import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { dirOf, fanColumn, type Module, type ModuleOf, type PropStyle, type Resolved } from '../../../sim/props';
import { windProfile, windSpeed } from '../../../sim/wind';
import { blob, stroke } from '../../ink';
import { ball, dot, INK, ovalPts, part, path, pen, poly, sprite, stamp, tick } from '../../ink-props';
import type { MetalPalette, RC } from '../../kit';
import { beamOf, defineArt, type PropDrawOpts } from '../common';
import { type Face, faceOf, flange, housed, iron, lp, tf } from '../machine';

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
  const k = faceOf(...dirOf(m.angle));
  stamp(s, grip(st.hue, k), x, y);
  stamp(s, housing(k, pal, housed(r)), x, y);
  const c = tf(k, 0, -0.4);
  // Blades: a blur that gets stronger with the air, and the baked rotor turning over it. <= 0.35 rad/frame
  // so a 4-blade rotor never strobes backwards.
  s.fillStyle = css({ h: st.hue, s: 40, l: 70 }, 0, Math.min(0.35, speed / 900));
  s.beginPath();
  s.arc(x + c.x, y + c.y, 5.2, 0, Math.PI * 2);
  s.fill();
  s.save();
  s.translate(x + c.x, y + c.y);
  s.rotate(t * (speed / 12));
  stamp(s, blades(st.hue));
  s.restore();
  stamp(s, grill(pal), x + c.x, y + c.y);
}

/**
 * The housing, a whole cell: a bolted plate with a mounting flange at the back and a deep round cowl in
 * front of it, its lip thick on the side the air leaves by. A set piece (the AC unit) brings its own plate.
 */
function housing(k: Face, pal: MetalPalette, plate: boolean) {
  return sprite(`fan|h|${k}|${plate}|${pal.base.h},${pal.base.l}`, -11, -11, 22, 22, (g) => {
    if (plate) {
      flange(g, k, -6, 6, 5.2, pal, 3);
    }
    const c = tf(k, 0, -0.4);
    part(g, ovalPts(c.x, c.y, 7.3, 7.3, 3, 0.02), iron(pal, 42), 3, { depth: 1.2, thin: 0.55, thick: 1.5 });
    // The lip: a lighter band round the outlet side.
    g.save();
    path(g, ovalPts(c.x, c.y, 7.3, 7.3, 3, 0.02));
    g.clip();
    const lip = tf(k, 0, -4.6);
    g.fillStyle = css(iron(pal, 42), 14);
    blob(g, lip.x, lip.y, 5.6, 6, 0.9, 0.05);
    g.fill();
    g.restore();
    g.fillStyle = '#121218';
    path(g, ovalPts(c.x, c.y, 5.6, 5.6, 4, 0.02));
    g.fill();
    pen(g, ovalPts(c.x, c.y, 5.6, 5.6, 4, 0.02), 5, 0.9, 0.4);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      dot(g, c.x + Math.cos(a) * 6.45, c.y + Math.sin(a) * 6.45, 0.55, 6 + i, css(pal.light));
    }
  });
}

/** The rotor: four swept blades round a hub, baked once and turned. */
function blades(hue: number) {
  return sprite(`fan|b|${hue | 0}`, -6, -6, 12, 12, (g) => {
    const col: HSL = { h: hue, s: 45, l: 70 };
    for (let i = 0; i < 4; i++) {
      g.save();
      g.rotate((i / 4) * Math.PI * 2);
      part(g, poly(0.6, -0.9, 3.2, -2.4, 5.1, -1.6, 5.2, 0.4, 3.4, 1.2, 0.8, 0.9), col, 7 + i, { depth: 0.5, thin: 0.3, thick: 0.7, shade: -20 });
      g.restore();
    }
  });
}

/** Grill bars and a hub cap over the blades. */
function grill(pal: MetalPalette) {
  return sprite(`fan|g|${pal.base.h},${pal.base.l}`, -7, -7, 14, 14, (g) => {
    g.save();
    path(g, ovalPts(0, 0, 5.6, 5.6, 4, 0.02));
    g.clip();
    for (let i = -2; i <= 2; i++) tick(g, -6, i * 2.2, 6, i * 2.2 + 0.1, 0.45, i + 9, css(pal.light, -6, 0.85));
    g.restore();
    ball(g, 0, 0, 1.6, pal.base, 5);
  });
}
/** A household hair-dryer grip off the back corner, with a sliding switch and a bit of cord. */
function grip(hue: number, k: Face) {
  return sprite(`fan|grip|${hue | 0}|${k}`, -13, -13, 26, 26, (g) => {
    const plastic: HSL = { h: hue, s: 55, l: 58 };
    // Local grip frame: turned 0.55 rad and hung off (-4.4, 4), then to the face.
    const at = (xy: number[]) => {
      const c = Math.cos(0.55);
      const sn = Math.sin(0.55);
      const out: number[] = [];
      for (let i = 0; i < xy.length; i += 2) out.push(-4.4 + xy[i] * c - xy[i + 1] * sn, 4 + xy[i] * sn + xy[i + 1] * c);
      return lp(k, ...out);
    };
    part(g, at([-1.8, 0, 1.8, 0, 1.9, 5, 1.2, 6, -1.2, 6, -1.9, 5]), plastic, 6, { depth: 0.6, thin: 0.45, thick: 1 });
    part(g, at([-0.9, 1.6, 0.9, 1.6, 0.9, 4, -0.9, 4]), { h: 0, s: 0, l: 92 }, 7, { depth: 0.2, thin: 0.3, thick: 0.5 });
    g.fillStyle = INK;
    stroke(g, at([0, 5.8, 0.4, 7.2, -0.6, 8.2]), { w: 1, seed: 8, taper: [0, 0.4], press: 0 });
  });
}

defineArt<'fan'>({ type: 'fan', layer: 2, draw: (rc, m, d) => drawFan(rc, m, d.r, d.mi, d.off, d.pal, d.style, d.o) });
