import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { TILE } from '../../../sim/constants';
import { dirOf, flameCycle, type Module, type ModuleOf, type PropStyle, type Resolved } from '../../../sim/props';
import { line, type P, stroke } from '../../ink';
import { INK, part, pen, sprite, stamp, tone } from '../../ink-props';
import { circle, glowDot, light, type MetalPalette, type RC } from '../../kit';
import { beamOf, defineArt, type PropDrawOpts } from '../common';
import { disc, type Face, faceOf, flange, flat, housed, iron, lbox, lp, ltick, tf, within } from '../machine';

type M<T extends Module['type']> = ModuleOf<T>;

/**
 * A flame as it's inked in a comic: three flat tiers, red, orange and a yellow heart, licking at the
 * edges and splitting into tongues at the tip, with a dark line round the outside. `ramp` grows it.
 */
export function inkTongue(s: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, len: number, width: number, t: number, ramp: number) {
  const px = -dy;
  const py = dx;
  const N = 14;
  const side = (k: number, wid: number, L: number, sgn: number) => {
    const pts: P[] = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      // Fat near the base, tapering to licks: the edge wanders more the further out it is.
      const prof = Math.pow(Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.5 + 0.35), 1.2) * (1 - u * 0.85);
      const lick = Math.sin(u * 9 - t * 14 + sgn * 1.7 + k) * u * 1.6;
      const w = (wid * prof + lick) * ramp;
      const d = L * u * ramp;
      pts.push({ x: x + dx * d + px * w * sgn, y: y + dy * d + py * w * sgn });
    }
    return pts;
  };
  const tier = (k: number, wid: number, L: number, fill: string) => {
    const a = side(k, wid, L, 1);
    const back = side(k, wid, L, -1);
    const b: P[] = [];
    for (let i = back.length - 1; i >= 0; i--) b.push(back[i]);
    s.fillStyle = fill;
    s.beginPath();
    [...a, ...b].forEach((q, i) => (i ? s.lineTo(q.x, q.y) : s.moveTo(q.x, q.y)));
    s.closePath();
    s.fill();
    return [a, b];
  };
  const [a, b] = tier(0, width, len, 'rgb(226 64 26)');
  tier(1, width * 0.66, len * 0.8, 'rgb(255 150 34)');
  tier(2, width * 0.34, len * 0.55, 'rgb(255 228 110)');
  s.fillStyle = 'rgb(70 12 4)';
  stroke(s, a, { w: 1.1, seed: 3, taper: [0.1, 0.6], press: 0.3 });
  stroke(s, b, { w: 1.1, seed: 4, taper: [0.6, 0.1], press: 0.3 });
}

const TANK: HSL = { h: 4, s: 68, l: 47 };

/** The bottle's outline in the local frame: domed shoulders up top, a flat foot. */
function bottle(): P[] {
  const pts: P[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI + (i / 10) * Math.PI;
    pts.push({ x: Math.cos(a) * 7.2, y: -2.2 + Math.sin(a) * 4.6 });
  }
  pts.push({ x: 7.3, y: 3.6 }, { x: 6.6, y: 5.2 }, { x: -6.6, y: 5.2 }, { x: -7.3, y: 3.6 });
  return pts;
}

/**
 * The burner, a whole cell: a squat red gas bottle on a bolted foot ring, a pressure gauge and a
 * flammable diamond on its belly, and a steel collar round the valve with the nozzle flaring out of it:
 * the end the fire comes out of. Baked per face and metal.
 */
function burner(k: Face, pal: MetalPalette) {
  return sprite(`fl|${k}|${pal.base.h},${pal.base.l}`, -13, -13, 26, 26, (g) => {
    flange(g, k, -6.8, 6.8, 5, pal, 2);
    const tank = bottle().map((p) => tf(k, p.x, p.y));
    tone(g, tank, TANK, { depth: 1.4, shade: -19 });
    within(g, tank, () => {
      // The weld seam round its middle, and the hard shine on the shoulder.
      ltick(g, k, -8, 0.4, 8, 0.4, 0.8, 3, css(TANK, -30, 1, 6), [0, 0]);
      ltick(g, k, -8, -0.4, 8, -0.4, 0.5, 4, css(TANK, 18), [0, 0]);
      ltick(g, k, -5.8, -2.4, -3.2, -5.4, 1.2, 5, 'rgba(255,226,210,0.95)', [0.2, 0.35]);
    });
    pen(g, tank, 6, 0.55, 1.6);
    // The gauge: what its needle says is drawn live.
    const c = tf(k, -3, 2.3);
    g.fillStyle = INK;
    disc(g, c.x + 0.15, c.y + 0.2, 2.35, 7);
    g.fill();
    g.fillStyle = '#f3ead6';
    disc(g, c.x, c.y, 1.75, 8);
    g.fill();
    // A flammable diamond.
    const dm = lp(k, 3.3, 0.3, 5.3, 2.3, 3.3, 4.3, 1.3, 2.3);
    flat(g, dm, '#f6c632');
    pen(g, dm, 9, 0.35, 0.7);
    ltick(g, k, 3.3, 3.4, 3.4, 1.5, 0.75, 10, '#c0181e', [0.1, 0.6]);
    // The valve collar: a steel ring with two hand holes, the nozzle flaring up out of it.
    const collar = lbox(k, -4.8, -8.3, 9.6, 3.6, 1.2, 11);
    part(g, collar, iron(pal, 48), 11, { depth: 0.6, thin: 0.45, thick: 1.2 });
    for (const x of [-2.9, 2.9]) flat(g, lbox(k, x - 0.9, -7.5, 1.8, 1.6, 0.6, 12 + x), '#1a1210');
    const cone = lp(k, -1.3, -7.8, -1.3, -9.2, -3.3, -11.3, 3.3, -11.3, 1.3, -9.2, 1.3, -7.8);
    part(g, cone, { h: 40, s: 50, l: 56 }, 13, { depth: 0.6, thin: 0.45, thick: 1.2 });
    ltick(g, k, -2.4, -10.6, -1, -9, 0.55, 14, 'rgba(255,240,200,0.9)', [0.2, 0.3]);
    flat(g, lp(k, -2.8, -11.4, 2.8, -11.4, 2.3, -10.6, -2.3, -10.6), '#1b120d');
  });
}

/** The gauge needle: resting low while it's off, climbing through the warning, pinned in the red while it burns. */
function needle(s: CanvasRenderingContext2D, k: Face, x: number, y: number, u: number) {
  const a = -Math.PI * 0.95 + u * Math.PI * 0.8;
  const c = tf(k, -3, 2.3);
  const tip = tf(k, -3 + Math.cos(a) * 1.6, 2.3 + Math.sin(a) * 1.6);
  s.fillStyle = '#b3160f';
  line(s, x + c.x, y + c.y, x + tip.x, y + tip.y, { w: 0.6, seed: 1, taper: [0, 0.6], press: 0 });
  s.fillStyle = INK;
  circle(s, x + c.x, y + c.y, 0.4);
}

/** Dragon Burp: through the warning it hiccups little smoke rings, one every few beats, drifting out and fading. */
function hiccups(rc: RC, x: number, y: number, dx: number, dy: number, t: number) {
  const bg = rc.bg;
  const EVERY = 14;
  for (let k = 0; k < 3; k++) {
    const age = (t % EVERY) + k * EVERY;
    if (age > t || age > 36) continue;
    const u = age / 36;
    const cx = x + dx * (2 + age * 0.45) + Math.sin(age * 0.3) * 0.6;
    const cy = y + dy * (2 + age * 0.45) - age * 0.12;
    const r = 1.4 + age * 0.08;
    const ring: P[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ring.push({ x: cx + Math.cos(a) * r * (Math.abs(dy) > 0.5 ? 1 : 0.55), y: cy + Math.sin(a) * r * (Math.abs(dy) > 0.5 ? 0.55 : 1) });
    }
    bg.fillStyle = `rgba(200,196,192,${0.8 * (1 - u)})`;
    stroke(bg, ring, { w: 0.9, seed: k, taper: [0, 0], press: 0.3 });
  }
}

function drawFlame(rc: RC, m: M<'flame'>, r: Resolved, mi: number, off: Vec, _pal: MetalPalette, _st: PropStyle, o: PropDrawOpts) {
  const f = rc.frame;
  const x = m.at[0] + off[0];
  const y = m.at[1] + off[1];
  const [dx, dy] = dirOf(m.angle);
  const c = flameCycle(m, f, r.phase);
  if (housed(r)) needle(rc.s, faceOf(dx, dy), x, y, !o.level || c.seg === 2 ? 1 : c.seg === 1 ? 0.15 + (c.t / c.len) * 0.75 : 0.05);
  if (c.seg === 1 && o.level) hiccups(rc, x + dx * 11, y + dy * 11, dx, dy, c.t);
  const fire: HSL = { h: 28, s: 100, l: 55 };
  const nx = x + dx * 10;
  const ny = y + dy * 10;
  if (!o.level) {
    // On a card it's always lit: what a jet is for is the flame, not the nozzle.
    inkTongue(rc.s, nx - dx * 1.5, ny - dy * 1.5, dx, dy, m.length - 4, 7, rc.t, 1);
    return;
  }
  if (c.seg === 1) {
    // Pilot light + sputter: a blue tongue at the mouth that grows as it comes.
    const p = c.t / c.len;
    pilot(rc.s, nx + dx, ny + dy, dx, dy, p, rc.t);
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
    inkTongue(rc.s, nx - dx * 1.5, ny - dy * 1.5, dx, dy, len - 8, 7, rc.t, ramp);
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

/** The pilot: a small inked blue flame, steady at first and guttering as the warning runs out. */
function pilot(s: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, p: number, t: number) {
  const len = 2.2 + p * 2.6 + Math.sin(t * 40) * 0.5 * p;
  const w = 1.3 + p * 0.5;
  const px = -dy;
  const py = dx;
  s.fillStyle = 'rgb(40 70 170)';
  s.beginPath();
  s.moveTo(x + px * w, y + py * w);
  s.lineTo(x + dx * len * 0.55 + px * w * 0.8, y + dy * len * 0.55 + py * w * 0.8);
  s.lineTo(x + dx * len, y + dy * len);
  s.lineTo(x + dx * len * 0.55 - px * w * 0.8, y + dy * len * 0.55 - py * w * 0.8);
  s.lineTo(x - px * w, y - py * w);
  s.fill();
  s.fillStyle = 'rgb(150 205 255)';
  s.beginPath();
  s.moveTo(x + px * w * 0.45, y + py * w * 0.45);
  s.lineTo(x + dx * len * 0.6, y + dy * len * 0.6);
  s.lineTo(x - px * w * 0.45, y - py * w * 0.45);
  s.fill();
}

defineArt<'flame'>({
  type: 'flame',
  layer: 1,
  draw(rc, m, d) {
    if (!housed(d.r)) return;
    const [dx, dy] = dirOf(m.angle);
    stamp(rc.s, burner(faceOf(dx, dy), d.pal), m.at[0] + d.off[0], m.at[1] + d.off[1]);
  },
});
defineArt<'flame'>({ type: 'flame', layer: 3, draw: (rc, m, d) => drawFlame(rc, m, d.r, d.mi, d.off, d.pal, d.style, d.o) });
