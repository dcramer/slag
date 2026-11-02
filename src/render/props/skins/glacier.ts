import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { line, type P, stroke } from '../../ink';
import { ball, dot, glint, INK, part, path, pen, poly, tick, tone, boxPts } from '../../ink-props';
import { bulb, circle, light, type RC } from '../../kit';
import type { DrawCtx } from '../common';
import { ceilingAbovePx, groundBelowPx } from '../modules/setpiece';
import { type Cannon, type CannonPose, ICE, type RotorSkin, slab, STEEL, type ThemeSkins, tube } from './common';
import { GLACIER_SHELLS, SNOW } from './glacier-shells';

/**
 * Glacier skins. The sim gives the glacier its pieces through looks other themes own (a chairlift is a
 * `gondola`, a serac a `slab`, a frost cannon a `castle` cannon); these give them its own art
 * (docs/PARODY.md, Set pieces), drawn on the exact shapes the sim moves.
 */

/** Bunny Hill Chairlift: a lift tower with a bullwheel, a bench chair, a footrest, and a lift pass. */
const chairlift: RotorSkin = {
  support(rc, m, d) {
    const s = rc.s;
    const hx = m.hub[0] + d.off[0];
    const hy = m.hub[1] + d.off[1];
    const mx = m.mastX + d.off[0];
    const gy = groundBelowPx(d.o.level, mx, hy);
    const side = Math.sign(hx - mx) || 1;
    tube(s, mx, gy, mx, hy - 6, 3, STEEL, 3);
    tube(s, mx - side * 5, hy - 5, hx + side * 3, hy - 5, 2, STEEL, 5);
    // Padding wrapped round the foot of the tower, the way a ski slope does it.
    part(s, boxPts(mx - 3.4, gy - 14, 6.8, 12, 2, 7), { h: 210, s: 70, l: 46 }, 7, { depth: 0.8, thin: 0.5, thick: 1.1 });
    tick(s, mx - 3, gy - 10, mx + 3, gy - 10, 0.6, 8, '#f2f2f2');
    tick(s, mx - 3, gy - 6.5, mx + 3, gy - 6.5, 0.6, 9, '#f2f2f2');
  },
  link(rc, m, d, a, p) {
    const s = rc.s;
    const hx = m.hub[0] + d.off[0];
    const hy = m.hub[1] + d.off[1];
    const paint: HSL = { h: d.style.hue, s: 65, l: 48 };
    // Hanger bar down to the backrest's top rail; the backrest is thin rails, behind the rider.
    tube(s, hx, hy, a.x, p.y - 10, 1.4, STEEL, 11);
    tube(s, p.x + 2, p.y - 9, p.x + p.w - 2, p.y - 9, 1.2, paint, 12);
    for (let x = p.x + 2; x <= p.x + p.w - 1.9; x += Math.max(6, (p.w - 4) / Math.round((p.w - 4) / 9))) tube(s, x, p.y - 9, x, p.y, 0.6, paint, 13 + x);
    // Footrest, hung off the seat's ends.
    s.fillStyle = INK;
    line(s, p.x + 3, p.y + p.h, p.x + 5, p.y + p.h + 5, { w: 0.42, seed: 14, taper: [0, 0], press: 0 });
    line(s, p.x + p.w - 3, p.y + p.h, p.x + p.w - 5, p.y + p.h + 5, { w: 0.42, seed: 15, taper: [0, 0], press: 0 });
    tube(s, p.x + 4, p.y + p.h + 5, p.x + p.w - 4, p.y + p.h + 5, 0.8, STEEL, 16);
  },
  platform(rc, _m, d, _a, p) {
    const s = rc.s;
    const paint: HSL = { h: d.style.hue, s: 65, l: 48 };
    const pts = slab(s, p, paint, 21);
    s.save();
    path(s, pts);
    s.clip();
    for (let x = p.x + 6; x < p.x + p.w - 2; x += 6) tick(s, x, p.y + 0.6, x, p.y + p.h - 0.6, 0.45, x, css(paint, -22));
    s.restore();
    pen(s, pts, 22, 0.5, 1.2);
    // The lift pass, on a loop of string off the end of the top rail.
    const tx = p.x + p.w - 3.5;
    const ty = p.y - 5.5;
    s.fillStyle = 'rgba(240,236,226,0.95)';
    line(s, p.x + p.w - 2.4, p.y - 9, tx, ty - 1.6, { w: 0.35, seed: 23, taper: [0, 0], press: 0 });
    part(s, boxPts(tx - 1.8, ty - 1.6, 3.6, 3.2, 0.3, 24), { h: 50, s: 20, l: 94 }, 24, { depth: 0.2, thin: 0.25, thick: 0.5 });
    s.fillStyle = css({ h: d.style.hue + 140, s: 70, l: 46 });
    s.fillRect(tx - 1.5, ty - 1.3, 3, 0.8);
    s.fillStyle = INK;
    for (let k = 0; k < 5; k++) s.fillRect(tx - 1.3 + k * 0.6, ty, k % 2 ? 0.2 : 0.35, 1.1);
  },
  hub(rc, m, d) {
    const hx = m.hub[0] + d.off[0];
    const hy = m.hub[1] + d.off[1];
    ball(rc.s, hx, hy, 3.2, STEEL, 25);
    dot(rc.s, hx, hy, 0.9, 26);
  },
};

/** Icicle of Damocles: a slab of ice hanging from one hair-thin thread. */
const damocles: RotorSkin = {
  support(rc, m, d) {
    const hx = m.hub[0] + d.off[0];
    const hy = m.hub[1] + d.off[1];
    const cy = ceilingAbovePx(d.o.level, hx, hy);
    const s = rc.s;
    s.fillStyle = 'rgba(232,236,244,0.9)';
    line(s, hx, cy, hx, hy, { w: 0.3, seed: 31, taper: [0, 0], press: 0 });
    if (cy > 0) {
      s.fillStyle = css(ICE, -10);
      path(s, poly(hx - 2, cy, hx + 2, cy, hx, cy + 2.4));
      s.fill();
    }
  },
  link(rc, m, d, a, p) {
    const s = rc.s;
    s.fillStyle = 'rgba(232,236,244,0.9)';
    line(s, m.hub[0] + d.off[0], m.hub[1] + d.off[1], a.x, p.y, { w: 0.3, seed: 32, taper: [0, 0], press: 0 });
  },
  platform(rc, _m, _d, a, p, i) {
    const s = rc.s;
    const seed = 41 + i;
    // A few short icicles under it: thin, so nothing there looks like floor.
    s.fillStyle = css(ICE, 6);
    for (let k = 0; k < 4; k++) {
      const ix = p.x + 3 + hash2(k, seed, 1) * (p.w - 6);
      const len = 2 + hash2(k, seed, 2) * 2.6;
      path(s, poly(ix - 1, p.y + p.h - 0.4, ix + 1, p.y + p.h - 0.4, ix + 0.2, p.y + p.h + len));
      s.fill();
    }
    const pts = slab(s, p, ICE, seed);
    s.save();
    path(s, pts);
    s.clip();
    glint(s, poly(p.x + 2, p.y + 1.6, p.x + p.w * 0.4, p.y + 1.2, p.x + p.w * 0.55, p.y + 1.4), 'rgba(255,255,255,0.95)', 0.8);
    for (let k = 0; k < 3; k++) {
      const cx = p.x + 4 + hash2(k, seed, 3) * (p.w - 8);
      tick(s, cx, p.y + 1, cx + 2, p.y + p.h - 1, 0.4, k, css(ICE, -26));
    }
    s.restore();
    pen(s, pts, seed + 5, 0.45, 1.1, 3, '#16364d');
    s.fillStyle = INK;
    circle(s, a.x, p.y, 0.6);
  },
  hub(rc, m, d) {
    rc.s.fillStyle = 'rgba(232,236,244,0.95)';
    circle(rc.s, m.hub[0] + d.off[0], m.hub[1] + d.off[1], 0.7);
  },
};
/** Brain Freeze Cannon: an ice barrel on a sled with ski runners, a snowball pile behind, frost building at the mouth as the tell. */
function iceCannon(rc: RC, m: Cannon, d: DrawCtx, q: CannonPose) {
  const s = rc.s;
  const wood: HSL = { h: d.style.woodHue, s: 40, l: 36 };
  s.save();
  s.translate(q.x, q.gy);
  s.scale(q.dir, 1);
  for (const [bx, by] of [
    [-17, -2.8],
    [-22.4, -2.8],
    [-19.7, -7.4],
  ])
    ball(s, bx, by, 2.8, { h: 205, s: 20, l: 92 }, bx);
  // Ski runners, curling up at the front.
  const runner = poly(-20, -1, 2, -1, 6, -2.4, 7.4, -5);
  s.fillStyle = INK;
  stroke(s, runner, { w: 2.4, seed: 101, taper: [0, 0.2], press: 0 });
  s.fillStyle = css(STEEL, 10);
  stroke(s, runner, { w: 1.1, seed: 101, taper: [0, 0.3], press: 0 });
  part(s, poly(-18, -2.4, -16, -8, -6, -13, 3, -13, 5, -4, 3, -2.4), wood, 102, { depth: 0.9, thin: 0.5, thick: 1.2 });
  for (const x of [-12, -2]) tick(s, x, -2.4, x + 1, -11, 0.5, x, css(wood, -16));
  s.restore();
  s.save();
  s.translate(q.x, q.y);
  s.rotate(m.angle);
  if (Math.cos(m.angle) < 0) s.scale(1, -1);
  s.translate(-q.recoil, 0);
  const L = m.length + 2;
  const body = poly(-11, -5.5, L - 3, -4, L - 3, 4, -11, 5.5, -14.5, 3, -15, 0, -14.5, -3);
  tone(s, body, ICE, { depth: 1.2 });
  s.save();
  path(s, body);
  s.clip();
  // Facets and a band of rime.
  for (let k = 0; k < 4; k++) tick(s, -9 + k * (L / 4), -5.5, -6 + k * (L / 4), 5.5, 0.45, k, css(ICE, -24));
  s.fillStyle = '#f6fbff';
  for (const bx of [-5, L - 9]) {
    const rim: P[] = [];
    for (let k = 0; k <= 8; k++) rim.push({ x: bx + Math.sin(k * 1.9) * 0.7, y: -6 + k * 1.5 });
    stroke(s, rim, { w: 2, seed: bx, taper: [0, 0], press: 0.2 });
  }
  glint(s, poly(-9, -3.6, 0, -3.4, L - 6, -2.8), 'rgba(255,255,255,0.95)', 0.9);
  s.restore();
  pen(s, body, 103, 0.55, 1.4, 3, '#173c55');
  part(s, boxPts(L - 4, -5.5, 4.5, 11, 1.5, 104), ICE, 104, { depth: 0.5, thin: 0.45, thick: 1.1, ink: '#173c55' });
  s.fillStyle = '#0d2233';
  path(s, poly(L, -3.4, L + 0.6, -3.4, L + 0.6, 3.4, L, 3.4));
  s.fill();
  s.fillStyle = css(ICE, 8);
  for (const ix of [-8, -2, 4]) {
    path(s, poly(ix - 1, 5.2, ix + 1, 5.2, ix, 8 + (ix & 1)));
    s.fill();
  }
  s.restore();
  if (q.warn > 0) {
    // The tell: frost crystals growing at the mouth.
    const g = rc.g;
    const ice: HSL = { h: 195, s: 100, l: 75 };
    bulb(g, q.mx, q.my, 1.5 + q.warn * 2.5, ice, 0.5 + q.warn * 0.5);
    g.fillStyle = 'rgba(235,250,255,0.95)';
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + rc.t * 0.6;
      line(g, q.mx, q.my, q.mx + Math.cos(a) * (2 + q.warn * 4), q.my + Math.sin(a) * (2 + q.warn * 4), { w: 0.6, seed: k, taper: [0.1, 0.6], press: 0 });
    }
    light(rc, q.mx, q.my, 30 + q.warn * 30, ice, 0.3 + q.warn * 0.6);
  }
}

/**
 * The avalanche's cornice: a drift of snow on the ledge, its lip curling out over the edge the snowballs
 * leave by, a heap of them packed behind. The tell is the lip giving: cracks open along its root and snow
 * trickles off it, faster as the next one is about to go.
 */
function cornice(rc: RC, _m: Cannon, _d: DrawCtx, q: CannonPose) {
  const s = rc.s;
  s.save();
  s.translate(q.x, q.gy);
  s.scale(q.dir, 1);
  for (const [bx, by, r] of [
    [-15, -13.5, 2.8],
    [-10.5, -14.5, 3.2],
    [-12.8, -18.6, 2.6],
  ])
    ball(s, bx, by, r, SNOW, bx, undefined, '#56708a');
  const drift = poly(-20, 0, -18, -6, -12, -10.5, -4, -12.5, 4, -12, 10, -10.5, 15, -9, 16.5, -7.4, 13, -6.2, 9, -5.4, 6, -3, 4, 0);
  tone(s, drift, SNOW, { depth: 1.4 });
  for (let k = 0; k < 3; k++) {
    const x = -14 + k * 7;
    tick(s, x, -3 - k, x + 4, -5 - k, 0.4, k, css(SNOW, -16));
  }
  pen(s, drift, 61, 0.35, 0.9, 3, '#24445c');
  // Icicles off the lip's underside.
  s.fillStyle = css(ICE, 4);
  for (const [ix, len] of [
    [9, 3],
    [12.5, 2.2],
  ]) {
    path(s, poly(ix - 0.9, -5.6, ix + 0.9, -5.8, ix + 0.1, -5.6 + len));
    s.fill();
  }
  if (q.warn > 0) {
    // The lip lets go: cracks along its root, and snow running off it.
    s.fillStyle = '#1d3d55';
    line(s, 2, -12, 6 + q.warn * 3, -6, { w: 0.5 + q.warn * 0.4, seed: 70, taper: [0.1, 0.6], press: 0 });
    line(s, 5, -11.4, 8, -9 + q.warn * 2, { w: 0.4, seed: 71, taper: [0.1, 0.6], press: 0 });
  }
  s.restore();
  if (q.warn > 0)
    for (let k = 0; k < 4; k++) {
      const p = (rc.frame * (0.03 + 0.05 * q.warn) + k / 4) % 1;
      rc.bg.fillStyle = `rgba(240,246,252,${0.7 * (1 - p)})`;
      circle(rc.bg, q.x + q.dir * (14 + Math.sin(k * 3) * 1.5), q.gy - 6 + p * 18 * (0.4 + q.warn), 0.8 + p * 1.2);
    }
}

export const GLACIER: ThemeSkins = {
  rotor: { gondola: chairlift, slab: damocles },
  cannon: { castle: iceCannon, ship: cornice },
  deco: GLACIER_SHELLS,
};
