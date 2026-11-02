import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { dirOf, laserAngle, laserCycle, type Module, type ModuleOf, type PropStyle, type Resolved } from '../../../sim/props';
import { ball, boxPts, dot, glint, INK, part, pen, poly, sprite, stamp, tone } from '../../ink-props';
import { circle, glowDot, light, type MetalPalette, type RC } from '../../kit';
import { beamOf, defineArt, type PropDrawOpts } from '../common';
import { backplate, disc, type Face, faceOf, flange, flat, housed, iron, lbox, ltick, tf, within } from '../machine';

type M<T extends Module['type']> = ModuleOf<T>;

/** Where the charge lamps sit on the flange, in the local frame. */
const LAMPS = [-2.2, 0, 2.2];
const RING_Y = 0;

/**
 * The emplacement, a whole cell: an armored housing bolted down at the back, vent slots down its flanks, a
 * painted lip at the front, three charge lamps on the flange and a deep turret socket in the middle that
 * the pointer swivels in. All that, for a pen.
 */
function bunker(k: Face, pal: MetalPalette, hue: number) {
  return sprite(`lz|bunker|${k}|${pal.base.h},${pal.base.l}|${hue | 0}`, -11, -11, 22, 22, (g) => {
    backplate(g, -8, -8, 16, 16, pal, 1);
    flange(g, k, -8, 8, 4.6, pal, 2);
    for (const x of LAMPS) {
      const p = tf(k, x, 6.3);
      g.fillStyle = INK;
      disc(g, p.x, p.y, 0.95, 3 + x);
      g.fill();
    }
    const body = lbox(k, -7.7, -7.6, 15.4, 12.4, 3, 4, 0.25);
    tone(g, body, iron(pal, 40), { depth: 1.3, shade: -17 });
    within(g, body, () => {
      flat(g, lbox(k, -9, -9, 18, 3.4, 0, 5), css({ h: hue, s: 58, l: 46 }));
      ltick(g, k, -8, -5.5, 8, -5.5, 0.7, 6, INK, [0, 0]);
      for (const sg of [-1, 1])
        for (const y of [-3.2, -0.9, 1.4]) {
          flat(g, lbox(k, sg > 0 ? 5.3 : -7.4, y - 0.55, 2.1, 1.1, 0.5, 7 + y + sg), css(pal.dark, -8));
          ltick(g, k, sg * 7.2, y + 0.95, sg * 5.5, y + 0.95, 0.45, 8 + y + sg, css(iron(pal, 40), 20), [0.1, 0.1]);
        }
    });
    pen(g, body, 8, 0.55, 1.5);
    // The socket: a dark well with a lit rim on its far side.
    const c = tf(k, 0, RING_Y);
    g.fillStyle = INK;
    disc(g, c.x, c.y, 4.5, 9);
    g.fill();
    g.fillStyle = css(iron(pal, 40), 22);
    disc(g, c.x + 0.45, c.y + 0.5, 3.7, 10);
    g.fill();
    g.fillStyle = '#16141a';
    disc(g, c.x - 0.15, c.y - 0.1, 3.4, 11);
    g.fill();
  });
}

/** The swivel the pointer sits in: a ball in the socket. */
function swivel(pal: MetalPalette) {
  return sprite(`lz|swivel|${pal.base.h},${pal.base.l}`, -4, -4, 8, 8, (g) => {
    ball(g, 0, 0, 2.3, iron(pal, 46), 3);
  });
}

/** A laser pointer along +x: a pen body, a clip, a button and a brass tip at x = 9. */
function pointer(hue: number) {
  return sprite(`lz|pen|${hue | 0}`, -6, -3, 16.5, 6, (g) => {
    const body: HSL = { h: hue, s: 30, l: 30 };
    part(g, boxPts(-5, -1.3, 11.2, 2.6, 1.2, 5), body, 5, { depth: 0.4, thin: 0.4, thick: 0.9 });
    part(g, poly(6, -1.3, 8.4, -0.8, 9.2, -0.5, 9.2, 0.5, 8.4, 0.8, 6, 1.3), { h: 44, s: 60, l: 58 }, 6, { depth: 0.3, thin: 0.35, thick: 0.7 });
    // The clip and the button.
    g.fillStyle = '#c9ced8';
    g.fillRect(-4.2, -2, 4.6, 0.7);
    g.fillStyle = INK;
    g.fillRect(0.2, -2.1, 0.5, 1);
    dot(g, 2.4, -1.3, 0.6, 7, '#ff6b6b');
    glint(g, poly(-4, -0.6, -1, -0.75, 3, -0.7), css(body, 34), 0.45);
  });
}

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
  // Emitter: a pen-sized pointer on a swivel, far too small for what comes out of it.
  stamp(s, swivel(pal), x, y);
  s.save();
  s.translate(x, y);
  s.rotate(a);
  if (Math.cos(a) < 0) s.scale(1, -1);
  stamp(s, pointer(st.hue));
  s.restore();
  const lx = x + Math.cos(a) * 9.2;
  const ly = y + Math.sin(a) * 9.2;
  const charge = c.seg === 1 ? c.t / c.len : c.seg === 2 ? 1 : 0.1;
  glowDot(g, lx, ly, 3 + charge * 6, col, 0.6 + charge * 0.4);
  if (housed(r)) {
    // The charge lamps fill one by one through the warning; all three burn while it fires.
    const k = faceOf(...dirOf(m.angle));
    const lit = c.seg === 2 ? 3 : c.seg === 1 ? Math.ceil(charge * 3) : 0;
    for (let i = 0; i < LAMPS.length; i++) {
      const p = tf(k, LAMPS[i], 6.3);
      s.fillStyle = i < lit ? css(col, 18) : '#4a3a34';
      circle(s, x + p.x, y + p.y, 0.62);
      if (i < lit) glowDot(g, x + p.x, y + p.y, 3, col, 0.85);
    }
  }
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

defineArt<'laser'>({
  type: 'laser',
  layer: 1,
  draw(rc, m, d) {
    if (housed(d.r)) stamp(rc.s, bunker(faceOf(...dirOf(m.angle)), d.pal, d.style.hue), m.at[0] + d.off[0], m.at[1] + d.off[1]);
  },
});
defineArt<'laser'>({ type: 'laser', layer: 3, draw: (rc, m, d) => drawLaser(rc, m, d.r, d.mi, d.off, d.pal, d.style, d.o) });
