import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { type ModuleOf, vehicleCols, vehiclePose } from '../../../sim/props';
import { circle, ellipse, glowDot, hazardStripes, light, METALS, type MetalPalette, metalFill, type RC, rivet, rrect, sphereFill } from '../../kit';
import { type DrawCtx, defineArt } from '../common';
import { wheel } from './setpiece';

/**
 * Vehicle art. Each look is drawn in a local frame: origin at the
 * rear-bottom of the body, +x toward the front (art mirrors for `flip`),
 * y up is negative. Body placement and wheel spin come from vehiclePose /
 * vehicleCols, the sim's own pose functions.
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
  const pose = vehiclePose(m, rc.frame, d.r.phase);
  const cols = vehicleCols(m, pose.x, d.off);
  const W = cols.length * m.colW;
  const x0 = cols[0].x;
  const hs = cols.map((c) => c.h);
  const hc = m.flip ? hs.slice().reverse() : hs;
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
    paint: { h: d.style.hue, s: 70, l: 46 },
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

/** Lamp: emissive dot plus a light splat at local coords. Call outside `local`. */
function lamp(F: Frame, lx: number, ly: number, c: HSL, r = 2, reach = 60, k = 0.8) {
  const { g } = F.rc;
  const x = F.wx(lx);
  const y = F.gy + ly;
  g.fillStyle = css(c, 18, 0.95);
  circle(g, x, y, r * 0.7);
  glowDot(g, x, y, r * 5, c, 0.8);
  light(F.rc, x, y, reach, c, k);
}

function smoke(F: Frame, lx: number, ly: number, rate: number) {
  const e = F.d.o.emit;
  if (e && Math.random() < rate)
    e('smoke', F.wx(lx), F.gy + ly, (Math.random() - 0.5) * 12 - F.v * 8 * (F.m.flip ? -1 : 1), -18 - Math.random() * 14, { h: 0, s: 0, l: 42 });
}

// ---------------------------------------------------------------------------
// Route markings (layer 0): rails, ruts, floor lines. Show the patrol path.

function drawRoute(rc: RC, m: Vehicle, d: DrawCtx) {
  const s = rc.s;
  const W = m.cols.length * m.colW;
  const x0 = m.at[0] + d.off[0] - 3;
  const x1 = m.at[0] + d.off[0] + m.span + W + 3;
  const y = m.at[1] + d.off[1];
  if (m.look === 'minecart' || m.look === 'drill') {
    for (let x = x0 + 2; x < x1; x += 6) {
      s.fillStyle = css({ h: d.style.woodHue, s: 35, l: 26 });
      s.fillRect(x, y - 2, 4, 2);
    }
    s.fillStyle = css(METALS.steel.dark);
    s.fillRect(x0, y - 3.4, x1 - x0, 1.8);
    s.fillStyle = css(METALS.steel.light, 0, 0.8);
    s.fillRect(x0, y - 3.4, x1 - x0, 0.6);
  } else if (m.look === 'tractor') {
    s.fillStyle = 'rgba(60,38,20,0.55)';
    s.fillRect(x0, y - 1.5, x1 - x0, 1.5);
    s.fillStyle = 'rgba(30,18,8,0.5)';
    for (let x = x0; x < x1; x += 5) s.fillRect(x, y - 2.5, 2.5, 1);
  } else if (m.look === 'forklift') {
    s.save();
    s.globalAlpha = 0.7;
    hazardStripes(s, x0, y - 1.2, x1 - x0, 1.2, 0.8);
    s.restore();
  }
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
  local(F, (s, g) => {
    // Rear disc harrow (kills when reversing).
    s.save();
    s.translate(-3, -6);
    s.rotate(-F.roll / 5);
    s.fillStyle = '#8b9099';
    for (let i = 0; i < 8; i++) {
      s.rotate(Math.PI / 4);
      s.beginPath();
      s.moveTo(-1, 2);
      s.lineTo(0, 7);
      s.lineTo(1, 2);
      s.fill();
    }
    s.fillStyle = sphereFill(s, 0, 0, 3.5, METALS.steel.base);
    circle(s, 0, 0, 3.5);
    s.restore();
    s.fillStyle = css(METALS.steel.dark);
    s.fillRect(-2, -8, 5, 2.4);
    // Hood / engine.
    const hx = cabW - 3;
    const hw = W - hx - 1;
    const ht = -hood;
    s.fillStyle = 'rgba(0,0,0,0.25)';
    rrect(s, hx + 1, ht + 2, hw, hood - 7, [3, 6, 2, 2]);
    s.fill();
    const hg = s.createLinearGradient(0, ht, 0, -6);
    hg.addColorStop(0, css(paint, 18));
    hg.addColorStop(0.35, css(paint, 2));
    hg.addColorStop(1, css(paint, -16));
    s.fillStyle = hg;
    rrect(s, hx, ht, hw, hood - 7, [3, 6, 2, 2]);
    s.fill();
    s.strokeStyle = css(paint, -32);
    s.lineWidth = 1;
    s.stroke();
    s.fillStyle = css(paint, 30, 0.5);
    s.fillRect(hx + 2, ht + 1.2, hw - 6, 1);
    // Engine louvres.
    s.strokeStyle = css(paint, -28, 0.8);
    s.lineWidth = 0.8;
    for (let x = hx + 5; x < hx + hw - 8; x += 3) {
      s.beginPath();
      s.moveTo(x, ht + 5);
      s.lineTo(x, ht + 10);
      s.stroke();
    }
    // Grille.
    s.fillStyle = '#23252b';
    rrect(s, W - 5, ht + 3, 4, hood - 12, 1);
    s.fill();
    s.fillStyle = '#c4c9d2';
    for (let y = ht + 4.5; y < -9; y += 2.2) s.fillRect(W - 4.5, y, 3, 0.8);
    // Front cultivator blade (kills when driving forward).
    s.fillStyle = metalFill(s, METALS.steel, W - 1, -14, 7, 14);
    s.beginPath();
    s.moveTo(W - 1, -15);
    s.lineTo(W + 3, -13);
    s.lineTo(W + 5.5, -2);
    s.lineTo(W - 1, -2);
    s.fill();
    s.fillStyle = '#e8ebf0';
    for (let y = -12; y < -1; y += 3) {
      s.beginPath();
      s.moveTo(W + 3.5, y);
      s.lineTo(W + 6.5, y + 1.3);
      s.lineTo(W + 3.5, y + 2.4);
      s.fill();
    }
    // Exhaust stack.
    const ex = hx + 5;
    s.fillStyle = metalFill(s, METALS.steel, ex - 1.5, ht - 8, 3, 9);
    s.fillRect(ex - 1.3, ht - 8, 2.6, 9);
    s.fillStyle = '#18181c';
    s.fillRect(ex - 1.6, ht - 9, 3.2, 1.6);
    // Cab.
    const top = -roof;
    s.fillStyle = 'rgba(160,210,235,0.55)';
    s.fillRect(2, top + 4, cabW - 3, roof - hood - 1);
    s.fillStyle = 'rgba(255,255,255,0.35)';
    s.beginPath();
    s.moveTo(4, top + 5);
    s.lineTo(8, top + 5);
    s.lineTo(4, top + 11);
    s.fill();
    // Farmer: hat, head, shoulders.
    const fx = cabW / 2 + 1;
    const fy = top + roof - hood - 3;
    s.fillStyle = css({ h: 210, s: 45, l: 35 });
    rrect(s, fx - 3.5, fy, 7, 6, 2);
    s.fill();
    s.fillStyle = '#e8b48c';
    circle(s, fx + 0.5, fy - 2, 2.4);
    s.fillStyle = css({ h: 45, s: 60, l: 62 });
    ellipse(s, fx + 0.5, fy - 4, 4.5, 1.1);
    rrect(s, fx - 1.5, fy - 7, 4, 3, 1);
    s.fill();
    // Steering wheel.
    s.strokeStyle = '#1b1b1f';
    s.lineWidth = 1;
    s.beginPath();
    s.moveTo(fx + 3, fy + 3);
    s.lineTo(cabW - 2, fy - 1);
    s.stroke();
    // Posts and roof.
    s.fillStyle = css(paint, -22);
    s.fillRect(0.5, top + 3, 2, roof - 6);
    s.fillRect(cabW - 2.5, top + 3, 2, roof - hood);
    const rg = s.createLinearGradient(0, top, 0, top + 4);
    rg.addColorStop(0, css(paint, 20));
    rg.addColorStop(1, css(paint, -12));
    s.fillStyle = rg;
    rrect(s, -1.5, top, cabW + 3, 4, 1.5);
    s.fill();
    s.strokeStyle = css(paint, -32);
    s.lineWidth = 0.8;
    s.stroke();
    // Seat / body under the cab.
    s.fillStyle = css(paint, -6);
    rrect(s, 0, -hood + 1, cabW - 1, hood - 9, 2);
    s.fill();
    // Wheels: big rear, small front.
    wheel(s, rx, -R, R, F.roll / R, { hub: rim, rim, spokes: 6, tread: true, tyre: R * 0.36 });
    wheel(s, W - 7, -6, 6, F.roll / 6, { hub: rim, rim, spokes: 5, tread: true, tyre: 2.2 });
    // Rear fender.
    s.strokeStyle = css(paint, -10);
    s.lineWidth = 2.6;
    s.beginPath();
    s.arc(rx, -R, R + 1.8, Math.PI * 1.08, Math.PI * 1.92);
    s.stroke();
    // Headlight beam.
    s.fillStyle = '#f0f0e0';
    circle(s, W - 2, ht + 2.5, 1.6);
    g.fillStyle = 'rgba(255,240,200,0.12)';
    g.beginPath();
    g.moveTo(W - 1, ht + 2.5);
    g.lineTo(W + 34, ht - 2);
    g.lineTo(W + 34, ht + 10);
    g.fill();
  });
  lamp(F, W - 1.5, -hood + 2.5, { h: 50, s: 90, l: 75 }, 2, 70, 0.9);
  lamp(F, 0, -hood + 3, { h: 0, s: 100, l: 55 }, 1.2, 20, 0.4);
  // Exhaust (world space emit).
  smoke(F, cabW + 2, -hood - 9, F.moving ? 0.35 : 0.06);
  void d;
}

function forklift(F: Frame) {
  const { hc, W } = F;
  const paint = F.paint;
  const cw = hc[0];
  const roof = hc[1];
  local(F, (s) => {
    // Mast rails & carriage with forks.
    const lift = F.moving ? 0 : Math.sin(F.park * Math.PI) * 8;
    s.fillStyle = metalFill(s, METALS.steel, W - 6, -roof, 4, roof);
    s.fillRect(W - 6, -roof + 1, 2.5, roof - 2);
    s.fillRect(W - 2.5, -roof + 1, 2.5, roof - 2);
    s.fillStyle = css(METALS.steel.dark);
    s.fillRect(W - 6, -roof * 0.6, 6, 1.6);
    s.fillStyle = '#2b2d33';
    s.fillRect(W - 1, -12 - lift, 2.5, 10);
    s.fillStyle = metalFill(s, METALS.steel, W, -4 - lift, 7, 2);
    s.fillRect(W, -4 - lift, 6.5, 1.8);
    s.fillStyle = '#e8ebf0';
    s.beginPath();
    s.moveTo(W + 6.5, -4 - lift);
    s.lineTo(W + 7.5, -3.1 - lift);
    s.lineTo(W + 6.5, -2.2 - lift);
    s.fill();
    // Counterweight.
    s.fillStyle = 'rgba(0,0,0,0.25)';
    rrect(s, 1, -cw + 2, 17, cw - 5, [6, 2, 2, 3]);
    s.fill();
    const g1 = s.createLinearGradient(0, -cw, 0, -4);
    g1.addColorStop(0, css(paint, 16));
    g1.addColorStop(1, css(paint, -18));
    s.fillStyle = g1;
    rrect(s, 0, -cw, 17, cw - 5, [6, 2, 2, 3]);
    s.fill();
    s.strokeStyle = css(paint, -32);
    s.lineWidth = 1;
    s.stroke();
    hazardStripes(s, 1, -9, 5, 4, 0.85);
    // Body under the cab.
    s.fillStyle = css(paint, -4);
    rrect(s, 14, -15, W - 19, 11, 2);
    s.fill();
    s.strokeStyle = css(paint, -32);
    s.stroke();
    // Driver.
    s.fillStyle = css({ h: 25, s: 80, l: 50 });
    rrect(s, 18, -24, 7, 9, 2);
    s.fill();
    s.fillStyle = '#d8a582';
    circle(s, 22, -26.5, 2.5);
    s.fillStyle = css({ h: 50, s: 90, l: 55 });
    ellipse(s, 22, -28.5, 3, 1.6);
    // Overhead guard: posts and a slatted roof (the rideable top).
    s.fillStyle = '#2b2d33';
    s.fillRect(15, -roof + 2, 1.8, roof - 15);
    s.fillRect(W - 8, -roof + 2, 1.8, roof - 15);
    s.fillStyle = metalFill(s, METALS.steel, 13, -roof, W - 19, 3);
    rrect(s, 13, -roof, W - 19, 3, 1);
    s.fill();
    s.fillStyle = 'rgba(0,0,0,0.5)';
    for (let x = 16; x < W - 8; x += 3) s.fillRect(x, -roof + 0.8, 1.2, 1.4);
    // Wheels.
    wheel(s, 7, -5, 5, F.roll / 5, { hub: { h: 0, s: 0, l: 80 }, rim: { h: 0, s: 0, l: 70 }, spokes: 4, tyre: 2 });
    wheel(s, W - 9, -5.5, 5.5, F.roll / 5.5, { hub: { h: 0, s: 0, l: 80 }, rim: { h: 0, s: 0, l: 70 }, spokes: 4, tyre: 2.2 });
    // Beacon.
    s.fillStyle = '#5a3a10';
    s.fillRect(19, -roof - 2, 4, 2);
  });
  const on = F.moving && Math.sin(F.rc.t * 14) > -0.2;
  if (on) lamp(F, 21, -hc[1] - 3.5, { h: 38, s: 100, l: 55 }, 2, 55, 0.8);
  else
    local(F, (s) => {
      s.fillStyle = '#c08020';
      circle(s, 21, -hc[1] - 3.5, 1.6);
    });
  smoke(F, 2, -cw + 1, F.moving ? 0.12 : 0.02);
}

function ram(F: Frame) {
  const { hc, W, d } = F;
  const roof = hc[0];
  const wood: HSL = { h: d.style.woodHue, s: 42, l: 36 };
  const swing = Math.sin(F.rc.t * 2.2 + d.r.pp.uid) * 1.5 + (F.moving ? Math.min(3, Math.abs(F.v) * 2) * Math.sign(F.v) : 0);
  local(F, (s) => {
    // Back wall lattice.
    s.strokeStyle = css(wood, -18);
    s.lineWidth = 1.6;
    s.beginPath();
    for (let x = 2; x < W; x += 8) {
      s.moveTo(x, -roof + 4);
      s.lineTo(x + 8, -6);
    }
    s.stroke();
    // The ram log on ropes.
    const ly = -roof * 0.45;
    s.strokeStyle = css({ h: 38, s: 35, l: 55 });
    s.lineWidth = 0.8;
    s.beginPath();
    s.moveTo(W * 0.3, -roof + 3);
    s.lineTo(W * 0.3 + swing, ly);
    s.moveTo(W * 0.7, -roof + 3);
    s.lineTo(W * 0.7 + swing, ly);
    s.stroke();
    const lg = s.createLinearGradient(0, ly - 4, 0, ly + 4);
    lg.addColorStop(0, css(wood, 10));
    lg.addColorStop(1, css(wood, -16));
    s.fillStyle = lg;
    rrect(s, 4 + swing, ly - 3.5, W - 4, 7, 3.5);
    s.fill();
    // Iron ram head with curled horns at the front.
    const hx = W + swing;
    s.fillStyle = metalFill(s, d.pal, hx - 4, ly - 5, 9, 10);
    rrect(s, hx - 4, ly - 4.5, 9, 9, [2, 4, 4, 2]);
    s.fill();
    s.strokeStyle = css(d.pal.dark, -8);
    s.lineWidth = 0.8;
    s.stroke();
    s.strokeStyle = css(d.pal.light);
    s.lineWidth = 1.6;
    s.beginPath();
    s.arc(hx + 0.5, ly - 1, 3.2, Math.PI * 1.1, Math.PI * 2.4);
    s.stroke();
    s.fillStyle = '#ff5a30';
    circle(s, hx + 3, ly - 1.5, 0.8);
    // Posts.
    s.fillStyle = css(wood, -8);
    for (const x of [1, W / 2 - 1, W - 4]) s.fillRect(x, -roof + 2, 3, roof - 6);
    // Roof: overlapping planks with an overhang; flat top to stand on.
    s.fillStyle = 'rgba(0,0,0,0.3)';
    s.fillRect(-2, -roof + 5, W + 4, 2);
    for (let k = 0; k < 3; k++) {
      s.fillStyle = css(wood, 10 - k * 7);
      rrect(s, -3 + k, -roof + k * 2.2, W + 6 - k * 2, 3, 1);
      s.fill();
    }
    s.strokeStyle = css(wood, -24);
    s.lineWidth = 0.7;
    for (let x = 0; x < W; x += 5) {
      s.beginPath();
      s.moveTo(x, -roof);
      s.lineTo(x, -roof + 6);
      s.stroke();
    }
    // Rear spikes.
    s.fillStyle = '#b8bec9';
    for (let y = -roof + 8; y < -6; y += 5) {
      s.beginPath();
      s.moveTo(0, y);
      s.lineTo(-5, y + 1.5);
      s.lineTo(0, y + 3);
      s.fill();
    }
    // Pennant.
    const fl = Math.sin(F.rc.t * 6 + d.r.pp.uid) * 1.5;
    s.strokeStyle = '#3a2a1a';
    s.lineWidth = 1;
    s.beginPath();
    s.moveTo(W / 2, -roof);
    s.lineTo(W / 2, -roof - 10);
    s.stroke();
    s.fillStyle = css({ h: d.style.hue, s: 75, l: 48 });
    s.beginPath();
    s.moveTo(W / 2, -roof - 10);
    s.quadraticCurveTo(W / 2 - 4, -roof - 8 + fl, W / 2 - 9, -roof - 7 + fl);
    s.lineTo(W / 2, -roof - 5.5);
    s.fill();
    // Wheels.
    const ww: HSL = { h: d.style.woodHue, s: 40, l: 40 };
    wheel(s, 7, -6, 6, F.roll / 6, { hub: METALS.steel.base, rim: ww, spokes: 6, tyre: 1.6, wood: true });
    wheel(s, W - 8, -6, 6, F.roll / 6, { hub: METALS.steel.base, rim: ww, spokes: 6, tyre: 1.6, wood: true });
  });
}

function boulder(F: Frame) {
  const { hc, W, d } = F;
  const R = Math.min(W / 2, Math.max(...hc) / 2) + 0.5;
  const stone: HSL = { h: d.style.hue, s: 14, l: 46 };
  const glow: HSL = { h: d.style.glowHue, s: 90, l: 58 };
  const rot = F.roll / R;
  local(F, (s, g) => {
    const cx = W / 2;
    const cy = -R;
    s.fillStyle = 'rgba(0,0,0,0.3)';
    ellipse(s, cx, -1, R * 0.9, 2.2);
    s.save();
    s.translate(cx, cy);
    s.fillStyle = sphereFill(s, -0, 0, R, stone, 22, 30);
    s.beginPath();
    for (let i = 0; i < 14; i++) {
      const a = rot + (i / 14) * Math.PI * 2;
      const rr = R * (0.94 + hash2(i, d.r.pp.uid, 1) * 0.06);
      s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    s.closePath();
    s.fill();
    s.strokeStyle = css(stone, -28);
    s.lineWidth = 1;
    s.stroke();
    s.rotate(rot);
    // Cracks, moss and a carved glowing glyph.
    s.strokeStyle = css(stone, -24, 0.8);
    s.lineWidth = 0.8;
    s.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = hash2(k, d.r.pp.uid, 2) * Math.PI * 2;
      s.moveTo(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95);
      s.lineTo(Math.cos(a + 0.3) * R * 0.55, Math.sin(a + 0.3) * R * 0.55);
      s.lineTo(Math.cos(a + 0.1) * R * 0.35, Math.sin(a + 0.1) * R * 0.35);
    }
    s.stroke();
    for (let k = 0; k < 5; k++) {
      const a = hash2(k, d.r.pp.uid, 3) * Math.PI * 2;
      s.fillStyle = css({ h: 100, s: 45, l: 34 }, 0, 0.85);
      ellipse(s, Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8, R * 0.22, R * 0.12, a);
    }
    s.strokeStyle = css(stone, -32);
    s.lineWidth = 1.6;
    s.beginPath();
    for (let t = 0; t < 4 * Math.PI; t += 0.3) {
      const rr = R * 0.08 + t * R * 0.035;
      s.lineTo(Math.cos(t) * rr, Math.sin(t) * rr);
    }
    s.stroke();
    s.restore();
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    g.strokeStyle = css(glow, 10, 0.75);
    g.lineWidth = 0.9;
    g.beginPath();
    for (let t = 0; t < 4 * Math.PI; t += 0.3) {
      const rr = R * 0.08 + t * R * 0.035;
      g.lineTo(Math.cos(t) * rr, Math.sin(t) * rr);
    }
    g.stroke();
    g.restore();
    glowDot(g, cx, cy, R * 0.9, glow, 0.2);
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
  local(F, (s) => {
    // Ore heap.
    for (let k = 0; k < W / 4; k++) {
      const x = 4 + hash2(k, d.r.pp.uid, 1) * (W - 8);
      const r = 2.2 + hash2(k, d.r.pp.uid, 2) * 2;
      s.fillStyle = css({ h: 30, s: 12, l: 24 + hash2(k, d.r.pp.uid, 3) * 14 });
      circle(s, x, top + 1.5, r);
    }
    for (let k = 0; k < 3; k++) {
      const gem: HSL = { h: [50, 190, 300][(k + d.r.pp.uid) % 3], s: 90, l: 62 };
      const x = 6 + hash2(k, d.r.pp.uid, 4) * (W - 12);
      F.rc.g.fillStyle = css(gem, 10, 0.95);
      circle(F.rc.g, x, top + 0.5, 1.2);
      glowDot(F.rc.g, x, top + 0.5, 5, gem, 0.5);
    }
    // Tub.
    s.fillStyle = 'rgba(0,0,0,0.3)';
    s.beginPath();
    s.moveTo(1, top + 2);
    s.lineTo(W + 1, top + 2);
    s.lineTo(W - 2, -4);
    s.lineTo(4, -4);
    s.fill();
    s.beginPath();
    s.moveTo(-0.5, top);
    s.lineTo(W + 0.5, top);
    s.lineTo(W - 3, -6);
    s.lineTo(3, -6);
    s.closePath();
    s.fillStyle = metalFill(s, pal, 0, top, W, -6 - top, Math.PI / 2);
    s.fill();
    s.strokeStyle = css(pal.dark, -10);
    s.lineWidth = 1;
    s.stroke();
    s.fillStyle = css(pal.dark, -4);
    s.fillRect(-1, top, W + 2, 2.4);
    s.fillStyle = css(pal.light, 0, 0.6);
    s.fillRect(0, top + 0.4, W, 0.7);
    s.strokeStyle = css(pal.dark, 0, 0.7);
    s.lineWidth = 0.8;
    for (let x = 8; x < W - 4; x += 8) {
      s.beginPath();
      s.moveTo(x, top + 2.4);
      s.lineTo(x - (x < W / 2 ? 1 : -1), -6);
      s.stroke();
    }
    for (let x = 4; x < W - 2; x += 4) rivet(s, x, top + 4.5, pal, 0.7);
    // Bumpers.
    s.fillStyle = '#2a2a30';
    s.fillRect(-3, top + 5, 3, 5);
    s.fillRect(W, top + 5, 3, 5);
    // Wheels on the rail.
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
  local(F, (s) => {
    // Caterpillar track.
    s.fillStyle = '#1c1d22';
    rrect(s, 0, -9, W - 4, 8.5, 4.2);
    s.fill();
    s.fillStyle = '#3b3d45';
    const off = ((F.roll % 4) + 4) % 4;
    for (let x = 2 + off; x < W - 6; x += 4) {
      s.fillRect(x, -9.5, 2, 1.4);
      s.fillRect(x, -1.4, 2, 1.4);
    }
    for (const x of [5, (W - 4) / 2, W - 9]) wheel(s, x, -4.7, 3.4, F.roll / 3.4, { hub: pal.light, rim: pal.base, spokes: 3, tyre: 0 });
    // Engine block.
    s.fillStyle = metalFill(s, pal, 14, -hc[1], 18, hc[1] - 9);
    rrect(s, 13, -hc[1], 19, hc[1] - 9, 2);
    s.fill();
    s.strokeStyle = css(pal.dark, -10);
    s.lineWidth = 0.8;
    s.stroke();
    for (let y = -hc[1] + 3; y < -11; y += 3) {
      s.fillStyle = 'rgba(0,0,0,0.4)';
      s.fillRect(16, y, 13, 1);
    }
    // Cab.
    const cg = s.createLinearGradient(0, -cab, 0, -9);
    cg.addColorStop(0, css(paint, 14));
    cg.addColorStop(1, css(paint, -18));
    s.fillStyle = cg;
    rrect(s, 0, -cab, 15, cab - 9, [3, 3, 1, 1]);
    s.fill();
    s.strokeStyle = css(paint, -32);
    s.stroke();
    s.fillStyle = 'rgba(150,210,235,0.6)';
    rrect(s, 4, -cab + 3, 9, 8, 1.5);
    s.fill();
    hazardStripes(s, 0.5, -12.5, 14, 3, 0.85);
    // Rear ripper claw.
    s.fillStyle = '#9aa0ab';
    s.beginPath();
    s.moveTo(1, -10);
    s.lineTo(-5, -4);
    s.lineTo(-3, -1);
    s.lineTo(2, -6);
    s.fill();
    // Drill motor housing + spiral bit.
    s.fillStyle = metalFill(s, pal, W - 17, -head, 13, head - 9);
    rrect(s, W - 17, -head, 13, head - 9, 2);
    s.fill();
    s.strokeStyle = css(pal.dark, -10);
    s.stroke();
    const by = -head / 2 - 4;
    s.save();
    s.beginPath();
    s.moveTo(W - 5, by - 7);
    s.lineTo(W + 6, by);
    s.lineTo(W - 5, by + 7);
    s.closePath();
    s.fillStyle = metalFill(s, METALS.steel, W - 5, by - 7, 11, 14);
    s.fill();
    s.clip();
    s.strokeStyle = '#3a3e48';
    s.lineWidth = 1.4;
    for (let k = -3; k < 6; k++) {
      const x = W - 6 + ((k * 3 + spin) % 3) + k * 3;
      s.beginPath();
      s.moveTo(x, by - 8);
      s.lineTo(x + 3, by + 8);
      s.stroke();
    }
    s.restore();
    s.strokeStyle = '#2a2d33';
    s.lineWidth = 0.8;
    s.beginPath();
    s.moveTo(W - 5, by - 7);
    s.lineTo(W + 6, by);
    s.lineTo(W - 5, by + 7);
    s.stroke();
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
