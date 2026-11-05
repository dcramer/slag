import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { type ModuleOf, vehicleCols, vehiclePose } from '../../../sim/props';
import { inkFor, line, type P, stroke } from '../../ink';
import { ball, bar, barLine, boxPts, dot, glint, ovalPts, part, path, pen, poly, type Sprite, sprite, stamp, tick, tone } from '../../ink-props';
import { bulb, circle, flutter, glowDot, light, type MetalPalette, METALS, type RC, poseFrame } from '../../kit';
import { type DrawCtx, defineArt } from '../common';
import { wheel } from './setpiece';

/**
 * Vehicle art, inked. Each look is drawn in a local frame: origin at the rear-bottom of the body, +x toward
 * the front (art mirrors for `flip`), y up is negative. Body placement and wheel spin come from
 * vehiclePose / vehicleCols, the sim's own pose functions, and every roof sits on its column's height.
 * The still shell of each look is baked once; wheels, blades, forks, the ram and the bit move live.
 * Gags (docs/PARODY.md, Set pieces): the ram has a door-knocker ring on its head, the chase-scene boulder
 * has a film-reel scratch running down it, and the minecart wears a level sign.
 */

type Vehicle = ModuleOf<'vehicle'>;

interface Frame {
  rc: RC;
  m: Vehicle;
  d: DrawCtx;
  /** Canonical column heights (rear → front), px. */
  hc: number[];
  W: number;
  /** World x of the body's left edge, ground y. */
  x0: number;
  gy: number;
  /** Signed travel toward local +x (front) this frame, px/frame. */
  v: number;
  moving: boolean;
  /** Local rolling distance (px) toward the front. */
  roll: number;
  park: number;
  /** Local → world. */
  wx(lx: number): number;
  paint: HSL;
}

function frameOf(rc: RC, m: Vehicle, d: DrawCtx): Frame {
  const pose = vehiclePose(m, poseFrame(rc), d.r.phase);
  const cols = vehicleCols(m, pose.x, d.off);
  const W = cols.length * m.colW;
  const x0 = cols[0].x;
  const hs = cols.map((c) => c.h);
  // Copy before reversing: `hs` stays in column order (and the ES2022 lib has no toReversed).
  const hc = hs.slice();
  if (m.flip) hc.reverse();
  const sgn = m.flip ? -1 : 1;
  return {
    rc,
    m,
    d,
    hc,
    W,
    x0,
    gy: m.at[1] + d.off[1],
    v: pose.v * sgn,
    moving: pose.moving && Math.abs(pose.v) > 0.02,
    roll: pose.x * sgn,
    park: pose.park,
    wx: (lx) => (m.flip ? x0 + W - lx : x0 + lx),
    paint: { h: d.style.hue, s: 50, l: 46 },
  };
}

function local(F: Frame, fn: (s: CanvasRenderingContext2D, g: CanvasRenderingContext2D) => void) {
  const { s, g } = F.rc;
  for (const c of [s, g]) {
    c.save();
    c.translate(F.m.flip ? F.x0 + F.W : F.x0, F.gy);
    if (F.m.flip) c.scale(-1, 1);
  }
  fn(s, g);
  s.restore();
  g.restore();
}

/** A shell baked for this look, size and paint: `key` names the rest of what it reads. */
function shell(F: Frame, look: string, key: string, top: number, draw: (g: CanvasRenderingContext2D) => void): Sprite {
  const { W, hc, d } = F;
  return sprite(
    `vh|${look}|${W}|${hc.join(',')}|${d.style.hue | 0}|${d.style.woodHue | 0}|${d.pal.base.h},${d.pal.base.l}|${key}`,
    -14,
    -top - 16,
    W + 30,
    top + 20,
    draw,
  );
}

/** Lamp: emissive dot plus a light splat at local coords. Call outside `local`. */
function lamp(F: Frame, lx: number, ly: number, c: HSL, r = 2, reach = 60, k = 0.8) {
  const { g } = F.rc;
  const x = F.wx(lx);
  const y = F.gy + ly;
  bulb(g, x, y, r * 0.8, c, 0.95);
  glowDot(g, x, y, r * 2, c, 0.5);
  light(F.rc, x, y, reach, c, k);
}

function smoke(F: Frame, lx: number, ly: number, rate: number) {
  const e = F.d.o.emit;
  if (e && Math.random() < rate)
    e('smoke', F.wx(lx), F.gy + ly, (Math.random() - 0.5) * 12 - F.v * 8 * (F.m.flip ? -1 : 1), -18 - Math.random() * 14, { h: 0, s: 0, l: 42 });
}

/** A rod: its colour inside a thin rim that's a dark of it. */
function rod(s: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, col: HSL, seed = 1) {
  barLine(s, ax, ay, bx, by, w, col, seed, { taper: [0, 0], press: 0.05, rim: 0.3 });
}

const HAZARD: HSL = { h: 44, s: 92, l: 48 };
const STEELROD: HSL = { h: 225, s: 8, l: 26 };
/** Tyre and track rubber: a charcoal with room for a pen darker than it. */
const RUBBER: HSL = { h: 222, s: 8, l: 25 };

/** Hazard bands across a rect, clipped to it: the paint, and stripes a dark of it. */
function bands(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = css(HAZARD);
  g.fillRect(x, y, w, h);
  g.fillStyle = inkFor(HAZARD);
  for (let k = x - h; k < x + w + h; k += 3.2) {
    path(g, poly(k, y + h, k + 1.6, y + h, k + 1.6 + h, y, k + h, y));
    g.fill();
  }
  g.restore();
}

/** An empty bucket seat standing on (x, y): a backrest and a cushion, a dark of `col`, stitched. */
function seat(g: CanvasRenderingContext2D, x: number, y: number, col: HSL, seed: number) {
  part(g, poly(x, y, x + 0.4, y - 9, x + 2.6, y - 9.6, x + 3.2, y - 2.6, x + 7.4, y - 2.8, x + 7.6, y), col, seed, {
    depth: 0.6,
    shade: -10,
    thin: 0.4,
    thick: 1.1,
  });
  g.fillStyle = css(col, 22);
  line(g, x + 1.2, y - 8.4, x + 1.5, y - 3, { w: 0.5, seed: seed + 1, taper: [0.2, 0.3], press: 0.1 });
  tick(g, x + 3.6, y - 1.6, x + 7, y - 1.7, 0.35, seed + 2, css(col, 30));
}

/** A steering wheel on its column, the column foot at (x, y), leaning back toward the seat. */
function wheelie(g: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  barLine(g, x, y, x - 2.6, y - 5.2, 0.6, { h: 220, s: 7, l: 38 }, seed, { taper: [0, 0], press: 0.1, rim: 0.2 });
  part(g, ovalPts(x - 2.9, y - 5.6, 2.6, 0.9, seed + 1, 0.03, 12), RUBBER, seed + 1, { depth: 0.2, thin: 0.35, thick: 0.7 });
}

// ---------------------------------------------------------------------------
// Route markings (layer 0): rails, ruts, floor lines. Show the patrol path.

function drawRoute(rc: RC, m: Vehicle, d: DrawCtx) {
  const W = m.cols.length * m.colW;
  const x0 = m.at[0] + d.off[0] - 3;
  const x1 = m.at[0] + d.off[0] + m.span + W + 3;
  const y = m.at[1] + d.off[1];
  const key = `vh|route|${m.look}|${x0 | 0}|${x1 | 0}|${y | 0}|${d.style.woodHue | 0}`;
  stamp(
    rc.s,
    sprite(key, x0 - 1, y - 5, x1 - x0 + 2, 6, (g) => {
      if (m.look === 'minecart' || m.look === 'drill') {
        const tie: HSL = { h: d.style.woodHue, s: 35, l: 28 };
        for (let x = x0 + 2; x < x1; x += 6) part(g, boxPts(x, y - 2.2, 4, 2, 0.4, x | 0, 0.1), tie, x | 0, { depth: 0.3, thin: 0.25, thick: 0.55 });
        barLine(g, x0, y - 2.9, x1, y - 2.9, 1, METALS.steel.base, 3, { taper: [0, 0], press: 0.1, rim: 0.35 });
      } else if (m.look === 'tractor') {
        // Ruts: a churned line along the ground and the odd tread print, opaque and penned like any mark.
        const mud: HSL = { h: 26, s: 30, l: 26 };
        g.fillStyle = css(mud);
        for (let x = x0; x < x1 - 4; x += 10) line(g, x + 1, y - 0.8, x + 9, y - 0.7, { w: 1.3, seed: x, taper: [0.2, 0.3], press: 0.3 });
        for (let x = x0 + 3; x < x1 - 3; x += 9) tick(g, x, y - 2.2, x + 2, y - 2.3, 0.7, x, css(mud, -6));
      } else if (m.look === 'forklift') {
        g.globalAlpha = 0.75;
        bands(g, x0, y - 1.2, x1 - x0, 1.2);
        g.globalAlpha = 1;
      }
    }),
  );
}

// ---------------------------------------------------------------------------
// Looks.

function tractor(F: Frame) {
  const { hc, W, d } = F;
  const cabCols = hc.filter((h) => h > hc[hc.length - 1] + 10).length || 1;
  const cabW = cabCols * 16;
  const hood = hc[hc.length - 1];
  const roof = hc[0];
  const paint = F.paint;
  const rim: HSL = paint.h > 90 && paint.h < 160 ? { h: 50, s: 85, l: 52 } : { h: 40, s: 10, l: 88 };
  const R = cabCols > 1 ? 12.5 : 10.5;
  const rx = cabW / 2 + (cabCols > 1 ? 0 : 1);
  const hx = cabW - 3;
  const hw = W - hx - 1;
  const ht = -hood;
  const top = -roof;
  const body = shell(F, 'tractor', '', roof, (g) => {
    part(g, boxPts(-2, -8, 5, 2.4, 0.5, 2), STEELROD, 2, { depth: 0.3, thin: 0.3, thick: 0.6 });
    // Hood and engine.
    const hoodP = boxPts(hx, ht, hw, hood - 7, 3, 3, 0.15);
    tone(g, hoodP, paint, { depth: 1.6 });
    g.save();
    path(g, hoodP);
    g.clip();
    for (let x = hx + 5; x < hx + hw - 8; x += 5) tick(g, x, ht + 5, x, ht + 10, 0.55, x, css(paint, -26));
    glint(g, poly(hx + 2, ht + 1.4, hx + hw * 0.5, ht + 1.2, hx + hw - 6, ht + 1.6), css(paint, 30), 0.7);
    g.restore();
    pen(g, hoodP, 4, 0.5, 1.3, 3, inkFor(paint));
    part(g, boxPts(W - 5, ht + 3, 4, hood - 12, 1, 5), STEELROD, 5, { depth: 0.3, thin: 0.35, thick: 0.8 });
    for (let y = ht + 5; y < -9; y += 3) tick(g, W - 4.4, y, W - 1.6, y, 0.6, y, css(METALS.steel.light, -6));
    // Front cultivator blade (kills when driving forward), teeth out front.
    for (let y = -12; y < -1; y += 3)
      part(g, poly(W + 3.5, y, W + 6.8, y + 1.3, W + 3.5, y + 2.4), { h: 214, s: 8, l: 88 }, y, { depth: 0.2, thin: 0.25, thick: 0.6 });
    part(g, poly(W - 1, -15, W + 3, -13, W + 5.5, -2, W - 1, -2), METALS.steel.base, 6, { depth: 0.8, thin: 0.45, thick: 1.1 });
    // Exhaust stack.
    part(g, boxPts(hx + 3.7, ht - 8, 2.6, 9, 0.5, 7), METALS.steel.base, 7, { depth: 0.4, thin: 0.35, thick: 0.8 });
    part(g, boxPts(hx + 3.4, ht - 9, 3.2, 1.6, 0.4, 8), STEELROD, 8, { depth: 0.2, thin: 0.25, thick: 0.5 });
    // Cab glass, and the empty seat behind it: nobody's driving (docs/ART.md, Objects, not characters).
    g.fillStyle = css({ h: 198, s: 30, l: 74 });
    g.fillRect(2, top + 4, cabW - 3, roof - hood - 1);
    g.fillStyle = css({ h: 198, s: 30, l: 88 });
    path(g, poly(4, top + 5, 8, top + 5, 4, top + 11));
    g.fill();
    seat(g, cabW / 2 - 2.5, -hood + 1, { h: 30, s: 30, l: 24 }, 8);
    wheelie(g, cabW - 4, -hood - 2, 9);
    // Posts, roof, and the body under the cab.
    rod(g, 1.5, top + 3, 1.5, top + roof - 3, 1.6, { ...paint, l: paint.l - 22 }, 13);
    rod(g, cabW - 1.5, top + 3, cabW - 1.5, top + roof - hood + 3, 1.6, { ...paint, l: paint.l - 22 }, 14);
    part(g, boxPts(-1.5, top, cabW + 3, 4, 1.4, 15), paint, 15, { depth: 0.8, thin: 0.45, thick: 1.1 });
    part(g, boxPts(0, -hood + 1, cabW - 1, hood - 9, 2, 16), { ...paint, l: paint.l - 4 }, 16, { depth: 1, thin: 0.5, thick: 1.2 });
    dot(g, W - 2, ht + 2.5, 1.4, 17, '#ffffff', inkFor(paint));
  });
  local(F, (s, g) => {
    // Rear disc harrow (kills when reversing): it turns.
    s.save();
    s.translate(-3, -6);
    s.rotate(-F.roll / 5);
    for (let i = 0; i < 8; i++) {
      s.rotate(Math.PI / 4);
      s.fillStyle = inkFor(METALS.steel.base);
      path(s, poly(-1.3, 2, 0, 7.4, 1.3, 2));
      s.fill();
      s.fillStyle = '#b4bac4';
      path(s, poly(-0.9, 2.2, 0, 6.6, 0.9, 2.2));
      s.fill();
    }
    s.restore();
    ball(s, -3, -6, 3.4, METALS.steel.base, 18);
    stamp(s, body);
    wheel(s, rx, -R, R, F.roll / R, { hub: rim, rim, spokes: 6, tread: true, tyre: R * 0.36 });
    wheel(s, W - 7, -6, 6, F.roll / 6, { hub: rim, rim, spokes: 5, tread: true, tyre: 2.2 });
    // Rear fender over the big wheel.
    const fender: P[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 1.08 + (i / 10) * Math.PI * 0.84;
      fender.push({ x: rx + Math.cos(a) * (R + 1.8), y: -R + Math.sin(a) * (R + 1.8) });
    }
    bar(s, fender, 2, { ...paint, l: paint.l - 6 }, 19, { taper: [0.05, 0.05], press: 0.1, lit: 14 });
    // Headlight beam.
    g.fillStyle = 'rgba(255,240,200,0.12)';
    g.beginPath();
    g.moveTo(W - 1, ht + 2.5);
    g.lineTo(W + 34, ht - 2);
    g.lineTo(W + 34, ht + 10);
    g.fill();
  });
  lamp(F, W - 1.5, -hood + 2.5, { h: 50, s: 90, l: 75 }, 2, 70, 0.9);
  lamp(F, 0, -hood + 3, { h: 0, s: 100, l: 55 }, 1.2, 20, 0.4);
  smoke(F, cabW + 2, -hood - 9, F.moving ? 0.35 : 0.06);
  void d;
}

function forklift(F: Frame) {
  const { hc, W } = F;
  const paint = F.paint;
  const cw = hc[0];
  const roof = hc[1];
  const body = shell(F, 'forklift', '', Math.max(cw, roof), (g) => {
    // Mast rails.
    for (const x of [W - 6, W - 2.5]) part(g, boxPts(x, -roof + 1, 2.5, roof - 2, 0.4, x), METALS.steel.base, x, { depth: 0.4, thin: 0.35, thick: 0.8 });
    part(g, boxPts(W - 6, -roof * 0.6, 6, 1.6, 0.4, 2), STEELROD, 2, { depth: 0.2, thin: 0.25, thick: 0.5 });
    // Counterweight with hazard bands.
    const cwP = boxPts(0, -cw, 17, cw - 5, 3, 3, 0.12);
    tone(g, cwP, paint, { depth: 1.4 });
    g.save();
    path(g, cwP);
    g.clip();
    bands(g, 1, -9, 5, 4);
    g.restore();
    pen(g, cwP, 4, 0.5, 1.3, 3, inkFor(paint));
    // The counterweight is cast: a grille of slots and a row of fat bolts.
    for (let y = -cw + 5; y < -11; y += 3.4) tick(g, 8, y, 14, y, 0.55, y * 3, css(paint, -30, 1, 4));
    for (const x of [3, 13]) dot(g, x, -cw + 2.2, 0.55, x, css(paint, 30), inkFor(paint));
    part(g, boxPts(14, -15, W - 19, 11, 2, 5), { ...paint, l: paint.l - 4 }, 5, { depth: 1, thin: 0.5, thick: 1.2 });
    for (let x = 18; x < W - 7; x += 9) dot(g, x, -13.4, 0.5, x + 30, css(paint, 26), inkFor(paint));
    glint(g, poly(15.5, -14, 20, -14.3, 26, -14.1), css(paint, 28), 0.6);
    // The empty seat and the wheel: nobody's driving it (docs/ART.md, Objects, not characters).
    seat(g, 17.5, -15, { h: 220, s: 10, l: 22 }, 6);
    wheelie(g, W - 10.5, -18.5, 7);
    // Overhead guard: posts and the slatted roof you can ride.
    rod(g, 15.9, -roof + 2, 15.9, -13, 1.4, STEELROD, 9);
    rod(g, W - 7.1, -roof + 2, W - 7.1, -13, 1.4, STEELROD, 10);
    const guard = boxPts(13, -roof, W - 19, 3, 0.8, 11, 0.1);
    tone(g, guard, METALS.steel.base, { depth: 0.6 });
    for (let x = 17; x < W - 8; x += 5) tick(g, x, -roof + 0.8, x + 0.2, -roof + 2.2, 0.8, x, css(METALS.steel.base, -30));
    pen(g, guard, 12, 0.45, 1, 3, inkFor(METALS.steel.base));
    part(g, boxPts(19, -roof - 2, 4, 2, 0.5, 13), { h: 32, s: 60, l: 26 }, 13, { depth: 0.2, thin: 0.3, thick: 0.6 });
  });
  local(F, (s) => {
    const lift = F.moving ? 0 : Math.sin(F.park * Math.PI) * 8;
    part(s, boxPts(W - 1, -12 - lift, 2.5, 10, 0.5, 21), { h: 220, s: 8, l: 22 }, 21, { depth: 0.3, thin: 0.35, thick: 0.7 });
    stamp(s, body);
    part(s, poly(W, -4 - lift, W + 6.5, -4 - lift, W + 7.6, -3.1 - lift, W + 6.5, -2.2 - lift, W, -2.2 - lift), METALS.steel.light, 22, {
      depth: 0.3,
      thin: 0.3,
      thick: 0.7,
    });
    wheel(s, 7, -5, 5, F.roll / 5, { hub: { h: 0, s: 0, l: 80 }, rim: { h: 0, s: 0, l: 70 }, spokes: 4, tyre: 2 });
    wheel(s, W - 9, -5.5, 5.5, F.roll / 5.5, { hub: { h: 0, s: 0, l: 80 }, rim: { h: 0, s: 0, l: 70 }, spokes: 4, tyre: 2.2 });
  });
  const on = F.moving && Math.sin(F.rc.t * 14) > -0.2;
  if (on) lamp(F, 21, -hc[1] - 3.5, { h: 38, s: 100, l: 55 }, 2, 55, 0.8);
  else
    local(F, (s) => {
      s.fillStyle = inkFor({ h: 38, s: 70, l: 44 });
      circle(s, 21, -hc[1] - 3.5, 1.85);
      s.fillStyle = '#c08020';
      circle(s, 21, -hc[1] - 3.5, 1.5);
    });
  smoke(F, 2, -cw + 1, F.moving ? 0.12 : 0.02);
}

function ram(F: Frame) {
  const { hc, W, d } = F;
  const roof = hc[0];
  const wood: HSL = { h: d.style.woodHue, s: 42, l: 38 };
  const swing = Math.sin(F.rc.t * 2.2 + d.r.pp.uid) * 1.5 + (F.moving ? Math.min(3, Math.abs(F.v) * 2) * Math.sign(F.v) : 0);
  const ly = -roof * 0.45;
  const back = shell(F, 'ram', 'back', roof, (g) => {
    for (let x = 2; x < W; x += 8) rod(g, x, -roof + 4, x + 8, -6, 1, { ...wood, l: wood.l - 14 }, x);
  });
  const front = shell(F, 'ram', 'front', roof + 12, (g) => {
    for (const x of [1, W / 2 - 1, W - 4])
      part(g, boxPts(x, -roof + 2, 3, roof - 6, 0.6, x), { ...wood, l: wood.l - 6 }, x, { depth: 0.6, thin: 0.45, thick: 1 });
    // Roof: overlapping planks with an overhang; flat top to stand on.
    for (let k = 2; k >= 0; k--)
      part(g, boxPts(-3 + k, -roof + k * 2.2, W + 6 - k * 2, 3, 0.8, 30 + k), { ...wood, l: wood.l + 8 - k * 7 }, 30 + k, { depth: 0.6, thin: 0.45, thick: 1 });
    for (let x = 3; x < W; x += 9) tick(g, x, -roof + 0.4, x + 0.2, -roof + 5.6, 0.5, x, css(wood, -24));
    // Rear spikes.
    for (let y = -roof + 8; y < -6; y += 5) part(g, poly(0, y, -5, y + 1.5, 0, y + 3), { h: 214, s: 8, l: 76 }, y, { depth: 0.2, thin: 0.3, thick: 0.6 });
    rod(g, W / 2, -roof, W / 2, -roof - 10, 0.8, { h: 30, s: 38, l: 26 }, 33);
  });
  local(F, (s) => {
    stamp(s, back);
    // The ram log on ropes.
    s.fillStyle = css({ h: 38, s: 35, l: 55 });
    for (const t of [0.3, 0.7]) line(s, W * t, -roof + 3, W * t + swing, ly, { w: 0.8, seed: t * 9, taper: [0, 0], press: 0 });
    part(s, boxPts(4 + swing, ly - 3.5, W - 4, 7, 3.4, 41), wood, 41, { depth: 0.9, thin: 0.5, thick: 1.2 });
    // Iron ram head with curled horns, and a door-knocker ring hanging off its nose.
    const hx = W + swing;
    part(s, boxPts(hx - 4, ly - 4.5, 9, 9, 2.6, 42), d.pal.base, 42, { depth: 0.7, thin: 0.45, thick: 1.1 });
    const horn: P[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * 1.1 + (i / 10) * Math.PI * 1.3;
      horn.push({ x: hx + 0.5 + Math.cos(a) * 3.2, y: ly - 1 + Math.sin(a) * 3.2 });
    }
    bar(s, horn, 1.3, d.pal.light, 43, { taper: [0, 0.1], press: 0, rim: 0.4, ink: inkFor(d.pal.base) });
    // A rivet where the horn bolts on: it's cast iron, not an animal.
    dot(s, hx + 3, ly - 1.6, 0.8, 44, css(d.pal.light), inkFor(d.pal.base));
    const ring = ovalPts(hx + 5.4, ly + 3, 2.1, 2.5, 45, 0.02, 14);
    bar(s, [...ring, ring[0]], 0.8, METALS.brass.base, 45, { taper: [0, 0], press: 0.1, rim: 0.25 });
    stamp(s, front);
    // Pennant: it flies in a real wind, and hangs in still air.
    const fl = flutter(F.rc, 2.4, d.r.pp.uid);
    const pole = W / 2;
    const flag = poly(pole, -roof - 10, pole - 4.5 - fl * 1.5, -roof - 8.6 + Math.abs(fl), pole - 9 - fl * 2, -roof - 7 + Math.abs(fl) * 2, pole, -roof - 5.5);
    part(s, flag, { h: d.style.hue, s: 52, l: 48 }, 46, { depth: 0.3, thin: 0.3, thick: 0.7 });
    const ww: HSL = { h: d.style.woodHue, s: 40, l: 40 };
    wheel(s, 7, -6, 6, F.roll / 6, { hub: METALS.steel.base, rim: ww, spokes: 6, tyre: 1.6, wood: true });
    wheel(s, W - 8, -6, 6, F.roll / 6, { hub: METALS.steel.base, rim: ww, spokes: 6, tyre: 1.6, wood: true });
  });
}

/** The boulder's face: cracks, moss and a carved spiral, baked; it turns with the roll. */
function boulderFace(R: number, stone: HSL, uid: number) {
  return sprite(`vh|boulder|${R.toFixed(1)}|${stone.h | 0}|${uid % 7}`, -R - 2, -R - 2, R * 2 + 4, R * 2 + 4, (g) => {
    const pts: P[] = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const rr = R * (0.94 + hash2(i, uid, 1) * 0.06);
      pts.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
    }
    g.fillStyle = css(stone);
    path(g, pts);
    g.fill();
    g.save();
    path(g, pts);
    g.clip();
    for (let k = 0; k < 4; k++) {
      const a = hash2(k, uid, 2) * Math.PI * 2;
      g.fillStyle = css(stone, -26, 1, 6);
      stroke(
        g,
        poly(
          Math.cos(a) * R * 0.95,
          Math.sin(a) * R * 0.95,
          Math.cos(a + 0.3) * R * 0.55,
          Math.sin(a + 0.3) * R * 0.55,
          Math.cos(a + 0.1) * R * 0.35,
          Math.sin(a + 0.1) * R * 0.35,
        ),
        { w: 0.8, seed: k, taper: [0.1, 0.5], press: 0.2 },
      );
    }
    for (let k = 0; k < 5; k++) {
      const a = hash2(k, uid, 3) * Math.PI * 2;
      g.save();
      g.translate(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8);
      g.rotate(a);
      g.fillStyle = css({ h: 100, s: 45, l: 34 });
      path(g, ovalPts(0, 0, R * 0.22, R * 0.12, k + 5, 0.15, 10));
      g.fill();
      g.restore();
    }
    const spiral: P[] = [];
    for (let t = 0; t < 4 * Math.PI; t += 0.3) {
      const rr = R * 0.08 + t * R * 0.035;
      spiral.push({ x: Math.cos(t) * rr, y: Math.sin(t) * rr });
    }
    g.fillStyle = css(stone, -32, 1, 6);
    stroke(g, spiral, { w: 1.6, seed: 9, taper: [0.1, 0.1], press: 0.1 });
    g.restore();
  });
}

function boulder(F: Frame) {
  const { hc, W, d } = F;
  const R = Math.min(W / 2, Math.max(...hc) / 2) + 0.5;
  const stone: HSL = { h: d.style.hue, s: 14, l: 48 };
  const glow: HSL = { h: d.style.glowHue, s: 90, l: 58 };
  const rot = F.roll / R;
  local(F, (s, g) => {
    const cx = W / 2;
    const cy = -R;
    s.save();
    s.translate(cx, cy);
    s.rotate(rot);
    stamp(s, boulderFace(R, stone, d.r.pp.uid));
    s.restore();
    // The shadow stays with the light while the rock rolls; then the pen round it.
    const rim = ovalPts(cx, cy, R * 0.97, R * 0.97, 61, 0.03, 24);
    s.save();
    path(s, rim);
    s.clip();
    s.fillStyle = css(stone, -14, 1, 4);
    s.beginPath();
    s.arc(cx + R * 0.3, cy + R * 0.34, R * 1.05, 0, Math.PI * 2);
    s.arc(cx - R * 0.24, cy - R * 0.28, R * 1.05, 0, Math.PI * 2, true);
    s.fill('evenodd');
    s.restore();
    pen(s, rim, 62, 0.6, 1.5, 3, inkFor(stone));
    // Chase scene: a film-reel scratch running down it, jumping now and then.
    const sx = cx + (hash2(Math.floor(F.rc.frame / 7), d.r.pp.uid, 5) - 0.5) * R * 1.2;
    const half = Math.sqrt(Math.max(0, R * R - (sx - cx) ** 2)) * 0.96;
    s.fillStyle = 'rgba(250,246,236,0.85)';
    line(s, sx, cy - half, sx + 0.6, cy + half, { w: 0.45, seed: F.rc.frame >> 3, taper: [0.1, 0.1], press: 0.6, wobble: 0.3 });
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    g.fillStyle = css(glow, 10, 0.75);
    const spiral: P[] = [];
    for (let t = 0; t < 4 * Math.PI; t += 0.3) {
      const rr = R * 0.08 + t * R * 0.035;
      spiral.push({ x: Math.cos(t) * rr, y: Math.sin(t) * rr });
    }
    stroke(g, spiral, { w: 0.9, seed: 63, taper: [0.1, 0.1], press: 0 });
    g.restore();
  });
  light(F.rc, F.wx(W / 2), F.gy - R, R * 3, glow, 0.35);
  const e = d.o.emit;
  if (F.moving && e && Math.random() < 0.4)
    e('smoke', F.wx(W / 2 - Math.sign(F.v) * R * 0.6), F.gy - 2, -F.v * 15 * (F.m.flip ? -1 : 1), -10, { h: 35, s: 25, l: 55 });
}

function minecart(F: Frame) {
  const { hc, W, d } = F;
  const top = -hc[0];
  const pal = d.pal;
  const uid = d.r.pp.uid;
  const body = shell(F, 'minecart', `${uid % 5}`, hc[0], (g) => {
    for (let k = 0; k < W / 4; k++) {
      const x = 4 + hash2(k, uid, 1) * (W - 8);
      const r = 2.2 + hash2(k, uid, 2) * 2;
      ball(g, x, top + 1.5, r, { h: 30, s: 12, l: 26 + hash2(k, uid, 3) * 14 }, k);
    }
    const tub = poly(-0.5, top, W + 0.5, top, W - 3, -6, 3, -6);
    tone(g, tub, pal.base, { depth: 1.6 });
    g.save();
    path(g, tub);
    g.clip();
    g.fillStyle = css(pal.dark, -4);
    g.fillRect(-1, top, W + 2, 2.4);
    g.fillStyle = css(pal.light, 0, 0.7);
    g.fillRect(0, top + 0.4, W, 0.6);
    for (let x = 8; x < W - 4; x += 8) tick(g, x, top + 2.4, x - (x < W / 2 ? 1 : -1), -6, 0.7, x, css(pal.dark));
    // Iron straps riveted round each end, dented where the cart's been knocked about.
    for (const x of [2.6, W - 5.6]) {
      g.fillStyle = css(pal.dark, -6);
      path(g, poly(x, top, x + 3, top, x + 3 - (x < W / 2 ? -0.7 : 0.7), -6, x - (x < W / 2 ? -0.7 : 0.7), -6));
      g.fill();
      g.fillStyle = css(pal.light, -6);
      g.fillRect(x + 0.4, top + 2.6, 0.6, -top - 9);
      for (let y = top + 3.4; y < -7; y += 5) dot(g, x + 1.5 + (x < W / 2 ? 0.3 : -0.3), y, 0.45, x + y, css(pal.light, 10), inkFor(pal.dark));
    }
    tick(g, W * 0.62, top + 5, W * 0.62 + 2.4, top + 6.4, 0.5, 74, css(pal.dark, -10));
    g.restore();
    pen(g, tub, 71, 0.5, 1.4, 3, inkFor(pal.base));
    for (let x = 5; x < W - 3; x += 8) dot(g, x, top + 4.5, 0.5, x, css(pal.light), inkFor(pal.base));
    for (const x of [-3, W]) part(g, boxPts(x, top + 5, 3, 5, 0.6, x + 72), STEELROD, x + 72, { depth: 0.3, thin: 0.35, thick: 0.7 });
    // The level sign, bolted to its side.
    const sx = W / 2;
    const sy = (top + 2.4 - 6) / 2 + 0.6;
    part(g, boxPts(sx - 5, sy - 2.4, 10, 4.8, 0.6, 73), { h: 135, s: 40, l: 32 }, 73, { depth: 0.3, thin: 0.35, thick: 0.7 });
    g.fillStyle = '#f2f2ea';
    g.font = 'bold 3.6px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(`${1 + (uid % 8)}-${1 + ((uid >> 3) % 4)}`, sx, sy + 0.2);
  });
  local(F, (s) => {
    stamp(s, body);
    for (let k = 0; k < 3; k++) {
      const gem: HSL = { h: [50, 190, 300][(k + uid) % 3], s: 90, l: 62 };
      const x = 6 + hash2(k, uid, 4) * (W - 12);
      bulb(F.rc.g, x, top + 0.5, 1.2, gem, 0.95);
    }
    const wr = 4;
    for (const x of [6, W - 6]) wheel(s, x, -3.4 - wr + 0.5, wr, F.roll / wr, { hub: pal.light, rim: pal.dark, spokes: 4, tyre: 0 });
  });
  lamp(F, W + 1.5, top + 4, { h: d.style.glowHue, s: 100, l: 62 }, 1.8, 60, 0.7);
  const e = d.o.emit;
  if (e && F.moving && Math.abs(F.v) > 0.8 && Math.random() < 0.25)
    e('spark', F.wx(Math.random() < 0.5 ? 6 : W - 6), F.gy - 3.4, (Math.random() - 0.5) * 80 - F.v * 30 * (F.m.flip ? -1 : 1), -40 - Math.random() * 60, {
      h: 40,
      s: 100,
      l: 65,
    });
}

function drill(F: Frame) {
  const { hc, W, d } = F;
  const pal: MetalPalette = d.pal;
  const paint = F.paint;
  const cab = hc[0];
  const head = hc[hc.length - 1];
  const spin = F.moving ? F.rc.frame * 0.5 : F.rc.frame * 0.05;
  const by = -head / 2 - 4;
  const body = shell(F, 'drill', '', Math.max(cab, head), (g) => {
    // Engine block.
    const eng = boxPts(13, -hc[1], 19, hc[1] - 9, 2, 81, 0.12);
    tone(g, eng, pal.base, { depth: 1.4 });
    g.save();
    path(g, eng);
    g.clip();
    for (let y = -hc[1] + 4; y < -11; y += 4) tick(g, 16, y, 29, y, 0.6, y, css(pal.base, -28, 1, 4));
    g.restore();
    pen(g, eng, 82, 0.5, 1.3, 3, inkFor(pal.base));
    // Cab with a window and a hazard band.
    const cabP = boxPts(0, -cab, 15, cab - 9, 3, 83, 0.12);
    tone(g, cabP, paint, { depth: 1.4 });
    g.save();
    path(g, cabP);
    g.clip();
    bands(g, 0.5, -12.5, 14, 3);
    g.restore();
    pen(g, cabP, 84, 0.5, 1.3, 3, inkFor(paint));
    part(g, boxPts(4, -cab + 3, 9, 8, 1.5, 85), { h: 196, s: 45, l: 76 }, 85, { depth: 0.4, thin: 0.35, thick: 0.8 });
    glint(g, poly(5.4, -cab + 9, 8, -cab + 4.4, 9.6, -cab + 4), 'rgba(255,255,255,0.85)', 0.6);
    // Rear ripper claw.
    part(g, poly(1, -10, -5, -4, -3, -1, 2, -6), { h: 214, s: 8, l: 64 }, 86, { depth: 0.3, thin: 0.35, thick: 0.8 });
    // Drill motor housing.
    part(g, boxPts(W - 17, -head, 13, head - 9, 2, 87), pal.base, 87, { depth: 1, thin: 0.5, thick: 1.3 });
  });
  local(F, (s) => {
    // Caterpillar track, its treads walking with the roll.
    part(s, boxPts(0, -9, W - 4, 8.5, 4.2, 88), RUBBER, 88, { depth: 0.6, thin: 0.5, thick: 1.2 });
    s.fillStyle = '#4a4d56';
    const off = ((F.roll % 4) + 4) % 4;
    for (let x = 2 + off; x < W - 6; x += 4) {
      s.fillRect(x, -9.3, 2, 1.2);
      s.fillRect(x, -1.5, 2, 1.2);
    }
    for (const x of [5, (W - 4) / 2, W - 9]) wheel(s, x, -4.7, 3.4, F.roll / 3.4, { hub: pal.light, rim: pal.base, spokes: 3, tyre: 0 });
    stamp(s, body);
    // The bit, its flutes running as it turns.
    const bit = poly(W - 5, by - 7, W + 6, by, W - 5, by + 7);
    tone(s, bit, METALS.steel.light, { depth: 1 });
    s.save();
    path(s, bit);
    s.clip();
    s.fillStyle = '#3a3e48';
    for (let k = -3; k < 6; k++) {
      const x = W - 6 + ((k * 3 + spin) % 3) + k * 3;
      line(s, x, by - 8, x + 3, by + 8, { w: 1.2, seed: k, taper: [0, 0], press: 0 });
    }
    s.restore();
    pen(s, bit, 89, 0.5, 1.3, 3, inkFor(METALS.steel.light));
  });
  lamp(F, 3, -cab - 1, { h: 48, s: 90, l: 70 }, 1.6, 70, 0.8);
  smoke(F, 10, -cab - 2, F.moving ? 0.25 : 0.04);
  const e = d.o.emit;
  if (e && F.moving && Math.random() < 0.5)
    e('spark', F.wx(W + 5), F.gy - head / 2 - 4, (Math.random() - 0.3) * 160 * (F.m.flip ? -1 : 1), -60 - Math.random() * 80, { h: 40, s: 100, l: 65 });
}

const LOOKS: Record<Vehicle['look'], (F: Frame) => void> = { tractor, forklift, ram, boulder, minecart, drill };

defineArt<'vehicle'>({ type: 'vehicle', layer: 0, draw: (rc, m, d) => drawRoute(rc, m, d) });
defineArt<'vehicle'>({ type: 'vehicle', layer: 1, draw: (rc, m, d) => LOOKS[m.look](frameOf(rc, m, d)) });
