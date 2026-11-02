import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { CART_RUN, CART_WARN, cartCycle, cartDist, cartRect, type ModuleOf } from '../../../sim/props';
import { inkFor, line } from '../../ink';
import { ball, barLine, boxPts, dot, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { circle, glowDot } from '../../kit';
import { defineArt } from '../common';

/**
 * A runaway minecart (sim/props/modules/cart.ts), drawn on the box the sim kills with. Behind it, its
 * stretch of rail: sleepers and two iron rails from the winch at the top to the buffer at the bottom
 * (both thin: nothing here is somewhere to stand). Parked, it sits heaped with ore on its cable; in the
 * warning it rocks against its brake and the bell on the winch post swings and rings; then it breaks
 * loose, the cable whipping free, sparks under its wheels as it gathers speed; at the buffer it jolts;
 * then the winch reels it back up on a taut cable.
 */

type Cart = ModuleOf<'cart'>;

const IRON: HSL = { h: 220, s: 8, l: 30 };
const WOOD: HSL = { h: 28, s: 36, l: 30 };
const BRASS: HSL = { h: 44, s: 70, l: 52 };
const SPARK: HSL = { h: 44, s: 100, l: 66 };

/** The rail, the winch post at the top and the buffer at the bottom, baked: it never moves. */
function rail(m: Cart, uid: number) {
  const len = m.span + m.w;
  return sprite(`cart|rail|${Math.round(len)}|${m.dir}|${uid % 7}`, -10, -16, len + 20, 20, (g) => {
    // Sleepers, then the rails over them.
    for (let x = 2; x < len; x += 6) part(g, boxPts(x, -1.6, 3.6, 2.2, 0.4, x + uid, 0.1), WOOD, x, { depth: 0.3, thin: 0.3, thick: 0.6 });
    barLine(g, -2, -2, len + 2, -2, 1, { ...IRON, l: IRON.l + 14 }, 3, { lit: 16 });
    // The buffer at the low end: a stop of two thin posts and a rope-wrapped beam, low.
    const bx = m.dir > 0 ? len + 1 : -4;
    for (const dx of [0, 2.4]) part(g, boxPts(bx + dx, -7, 1.4, 6, 0.3, dx + 9, 0.1), WOOD, dx + 9, { depth: 0.3, thin: 0.3, thick: 0.6 });
    part(g, boxPts(bx - 0.6, -7.6, 5, 1.8, 0.4, 12, 0.1), { h: 6, s: 60, l: 42 }, 12, { depth: 0.3, thin: 0.3, thick: 0.6 });
    g.fillStyle = css({ h: 40, s: 10, l: 86 });
    g.fillRect(bx + 1.2, -7.4, 1.2, 1.4);
    // The winch at the high end: a drum on a little frame.
    const wx = m.dir > 0 ? -7 : len + 3;
    part(g, poly(wx - 1, -1, wx + 1, -9, wx + 4, -9, wx + 6, -1), WOOD, 21, { depth: 0.4, thin: 0.3, thick: 0.7 });
    ball(g, wx + 2.5, -7, 2.4, IRON, 22);
    dot(g, wx + 2.5, -7, 0.6, 23, css(IRON, 30), inkFor(IRON));
  });
}

/** The cart itself: a riveted tub heaped with ore, two spoked wheels, in the box (local px, feet at 0). */
function tub(g: CanvasRenderingContext2D, w: number, h: number, pal: { base: HSL; dark: HSL; light: HSL }, uid: number) {
  const top = -h;
  for (let k = 0; k < w / 4; k++)
    ball(g, 3 + hash2(k, uid, 1) * (w - 6), top + 1.2, 1.8 + hash2(k, uid, 2) * 1.6, { h: 30, s: 12, l: 24 + hash2(k, uid, 3) * 16 }, k);
  const body = poly(-0.4, top + 0.5, w + 0.4, top + 0.5, w - 2.5, -4.5, 2.5, -4.5);
  tone(g, body, pal.base, { depth: 1.4 });
  g.save();
  path(g, body);
  g.clip();
  g.fillStyle = css(pal.dark, -4);
  g.fillRect(-1, top + 0.5, w + 2, 2);
  for (const x of [2.4, w - 4.8]) {
    g.fillStyle = css(pal.dark, -8);
    g.fillRect(x, top + 0.5, 2.4, h);
  }
  g.restore();
  pen(g, body, 71, 0.5, 1.2, 3, inkFor(pal.base));
  for (let x = 3.5; x < w - 2; x += 3.5) dot(g, x, top + 3.6, 0.4, x, css(pal.light), inkFor(pal.base));
}

function wheels(s: CanvasRenderingContext2D, x: number, w: number, gy: number, roll: number) {
  for (const wx of [x + 4, x + w - 4]) {
    s.fillStyle = inkFor(IRON);
    circle(s, wx, gy - 2.6, 2.75);
    s.fillStyle = css(IRON, 6);
    circle(s, wx, gy - 2.6, 2.3);
    s.fillStyle = css(IRON, 20);
    circle(s, wx - 0.5, gy - 3.1, 1.3);
    s.fillStyle = inkFor(IRON);
    for (let k = 0; k < 2; k++) {
      const a = roll + (k * Math.PI) / 2;
      line(s, wx - Math.cos(a) * 2, gy - 2.6 - Math.sin(a) * 2, wx + Math.cos(a) * 2, gy - 2.6 + Math.sin(a) * 2, {
        w: 0.5,
        seed: k,
        taper: [0.02, 0.04],
        press: 0,
      });
    }
  }
}

defineArt<'cart'>({
  type: 'cart',
  layer: 0,
  draw: (rc, m, d) => {
    const x0 = m.dir > 0 ? m.at[0] : m.at[0] - m.span;
    stamp(rc.s, rail(m, d.r.pp.uid), x0 + d.off[0], m.at[1] + d.off[1]);
  },
});

defineArt<'cart'>({
  type: 'cart',
  layer: 2,
  draw: (rc, m, d) => {
    const c = cartCycle(m, rc.frame, d.r.phase);
    const dist = cartDist(m, rc.frame, d.r.phase);
    const r = cartRect(m, dist, d.off[0], d.off[1]);
    const gy = r.y + r.h;
    const s = rc.s;
    // Warning: it rocks on its brake, harder toward the end.
    const k = c.seg === CART_WARN ? c.t / Math.max(1, c.len) : 0;
    const rock = c.seg === CART_WARN ? Math.sin(rc.frame * (0.5 + 0.6 * k)) * (0.04 + 0.1 * k) : 0;
    // The cable to the winch, taut while it's hauled up or holding it.
    const wx = (m.dir > 0 ? m.at[0] - 4.5 : m.at[0] + m.w + 4.5) + d.off[0];
    if (c.seg !== CART_RUN) barLine(s, wx, gy - 7, m.dir > 0 ? r.x : r.x + r.w, gy - 5, 0.5, { ...IRON, l: IRON.l + 20 }, 5, { rim: 0.2 });
    s.save();
    s.translate(r.x + r.w / 2, gy);
    s.rotate(rock);
    s.translate(-r.w / 2, 0);
    tub(s, r.w, r.h, d.pal, d.r.pp.uid);
    s.restore();
    wheels(s, r.x, r.w, gy, (dist / 3) * m.dir);
    // The bell on the winch post: still, or swinging and ringing.
    const bx = wx;
    const by = gy - 13;
    const swing = c.seg === CART_WARN ? Math.sin(rc.frame * 0.7) * 0.6 : 0;
    barLine(s, bx, gy - 9, bx, by, 0.7, WOOD, 8);
    const hx = bx + Math.sin(swing) * 3;
    const hy = by + Math.cos(swing) * 3;
    part(s, poly(hx - 2, hy + 1.6, hx - 1.2, hy - 1.4, hx + 1.2, hy - 1.4, hx + 2, hy + 1.6), BRASS, 30, { depth: 0.3, thin: 0.3, thick: 0.6 });
    if (c.seg === CART_WARN && Math.abs(swing) > 0.4)
      for (const side of [-1, 1]) {
        s.fillStyle = css(BRASS, 20, 0.8);
        line(s, hx + side * 3.5, hy - 2, hx + side * 5, hy - 3.5, { w: 0.6, seed: side + 40, taper: [0.2, 0.2], press: 0 });
        line(s, hx + side * 3.8, hy + 0.5, hx + side * 5.6, hy + 0.5, { w: 0.6, seed: side + 41, taper: [0.2, 0.2], press: 0 });
      }
    if (c.seg !== CART_RUN) return;
    // Running: speed streaks behind it and sparks off the wheels, more the faster it goes.
    const u = c.t / Math.max(1, c.len);
    const tail = m.dir > 0 ? r.x : r.x + r.w;
    for (let i = 0; i < 3; i++) {
      const sy = r.y + 2 + i * (r.h / 3);
      tick(s, tail - m.dir * (2 + i), sy, tail - m.dir * (6 + 10 * u + i * 2), sy, 0.6, i + 50, css(IRON, 30, 0.7));
    }
    for (let i = 0; i < 4; i++) {
      const p = (rc.frame * 0.2 + i / 4) % 1;
      const sx = tail - m.dir * p * 8;
      const sy = gy - 1 - p * 4 * (i % 2 ? 1 : 0.5);
      s.fillStyle = css(SPARK, 6, (1 - p) * u);
      circle(s, sx, sy, 0.7);
      glowDot(rc.g, sx, sy, 3, SPARK, (1 - p) * u * 0.8);
    }
    if (u > 0.92) glowDot(rc.g, m.dir > 0 ? r.x + r.w : r.x, gy - 3, 8, SPARK, 0.6);
  },
});
