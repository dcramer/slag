import { css, type HSL, hsl3 } from '../core/color';
import { hash2 } from '../core/rng';
import type { Decor, DecorDef } from './decor';
import { inkFor, line, type P, stroke } from './ink';
import { ball, barLine, boxPts, dot, glint, ovalPts, part, path, pen, poly, tick } from './ink-props';

/**
 * Farm decor, inked: the yard's clutter between the fields. A scarecrow with a sack for a head, a water
 * trough, milk churns, feed sacks, a wheelbarrow, a weathervane on its post, a stile, a hen coop on
 * stilts, a beehive, an old tractor tyre, a well and a rusted plough. Small and cosmetic like all decor,
 * so none of it reads as something to stand on or dodge. All of it holds still and bakes with the terrain.
 */

const WOOD: HSL = hsl3(30, 38, 36);
const OLDWOOD: HSL = hsl3(34, 18, 46);
const TIN: HSL = hsl3(205, 8, 66);
const BURLAP: HSL = hsl3(36, 38, 62);
const STONE: HSL = hsl3(30, 8, 56);
const RUST: HSL = hsl3(18, 52, 36);
const STRAW: HSL = hsl3(46, 70, 62);

const sd = (d: Decor) => d.seed & 0xffff;
const k01 = (d: Decor, n: number) => hash2(n, 7, sd(d));
/** Mirror x about the piece's own centre when it's flipped. */
const fx = (d: Decor) => (d.flip ? -1 : 1);

/** An inked part from a box: hand-cut, toned, penned. */
function box(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: HSL, seed: number, r = 0.8) {
  const pts = boxPts(x, y, w, h, r, seed, 0.15);
  part(g, pts, c, seed, { depth: Math.min(1.1, Math.min(w, h) * 0.18), thin: 0.4, thick: 1 });
  return pts;
}

/** A shape from points: toned and penned. */
function shape(g: CanvasRenderingContext2D, pts: readonly P[], c: HSL, seed: number, depth = 0.8) {
  part(g, pts, c, seed, { depth, thin: 0.4, thick: 1 });
}

/** A pole or rail: a bar in its own colour inside a rim that's a dark of it. */
function pole(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, c: HSL, seed: number) {
  barLine(g, ax, ay, bx, by, w, c, seed, { taper: [0.02, 0.05], press: 0.1 });
}

/** A few straw strokes fanning out of a point. */
function straw(g: CanvasRenderingContext2D, x: number, y: number, dir: number, n: number, seed: number) {
  for (let i = 0; i < n; i++) {
    const a = dir + (i / Math.max(1, n - 1) - 0.5) * 1.1;
    g.fillStyle = css(STRAW, i % 2 ? 8 : -6);
    line(g, x, y, x + Math.cos(a) * (3 + hash2(i, 3, seed) * 2), y + Math.sin(a) * (3 + hash2(i, 4, seed) * 2), { w: 0.7, seed: seed + i, taper: [0.1, 0.7] });
  }
}

export const FARM_DECOR = {
  scarecrow: {
    color: (_th, rng) => hsl3(rng.pick([4, 210, 130, 30]), 36, 42),
    bake(g, d) {
      const k = d.size;
      const x = d.x;
      const y = d.y;
      const s = sd(d);
      const top = y - 27 * k;
      pole(g, x, y + 0.5, x + 0.4, top + 2, 1.6, OLDWOOD, s);
      pole(g, x - 9 * k, top + 8 * k, x + 9 * k, top + 7.5 * k, 1.4, OLDWOOD, s + 2);
      // The shirt hung on the crossbar, sleeves out along it, straw at the cuffs and the hem.
      const shirt = poly(
        x - 9 * k,
        top + 6.5 * k,
        x + 9 * k,
        top + 6 * k,
        x + 8.6 * k,
        top + 10 * k,
        x + 4 * k,
        top + 10.5 * k,
        x + 5 * k,
        top + 19 * k,
        x - 5 * k,
        top + 19.4 * k,
        x - 4 * k,
        top + 10.5 * k,
        x - 8.6 * k,
        top + 10.4 * k,
      );
      shape(g, shirt, d.color, s + 3, 0.7);
      tick(g, x - 2 * k, top + 11.5 * k, x - 2.2 * k, top + 18 * k, 0.45, s + 13, css(d.color, -24));
      tick(g, x - 4.4 * k, top + 14 * k, x + 1 * k, top + 13.8 * k, 0.4, s + 14, css(d.color, -24));
      straw(g, x - 9 * k, top + 8.5 * k, Math.PI, 3, s + 4);
      straw(g, x + 9 * k, top + 8 * k, 0, 3, s + 5);
      straw(g, x, top + 19.4 * k, Math.PI / 2, 4, s + 6);
      // A sack for a head, stitched shut, under a battered hat.
      const head = ovalPts(x + 0.3, top + 3 * k, 3.6 * k, 4 * k, s + 7, 0.08, 14);
      shape(g, head, BURLAP, s + 8, 0.5);
      tick(g, x - 2 * k, top + 3.6 * k, x + 2.4 * k, top + 3.4 * k, 0.45, s + 9, css(BURLAP, -40));
      for (let i = -1; i <= 1; i++) tick(g, x + i * 1.3 * k, top + 2.9 * k, x + i * 1.3 * k + 0.2, top + 4.2 * k, 0.4, s + 10 + i, css(BURLAP, -40));
      shape(g, boxPts(x - 6 * k, top - 0.8 * k, 12.4 * k, 1.6 * k, 0.6, s + 11), hsl3(30, 28, 30), s + 11, 0.3);
      shape(
        g,
        poly(x - 3 * k, top - 0.6 * k, x - 2.4 * k, top - 4.6 * k, x + 2.8 * k, top - 4.2 * k, x + 3.2 * k, top - 0.6 * k),
        hsl3(30, 28, 30),
        s + 12,
        0.4,
      );
    },
  },
  trough: {
    color: (_th, rng) => (rng.chance(0.5) ? TIN : WOOD),
    bake(g, d) {
      const k = d.size;
      const w = 20 * k;
      const h = 6.5 * k;
      const x0 = d.x - w / 2;
      const y = d.y;
      for (const lx of [x0 + 2.5, x0 + w - 4.5]) box(g, lx, y - 2.4, 2, 2.6, WOOD, sd(d) + lx, 0.3);
      const body = poly(x0, y - 2 - h, x0 + w, y - 2 - h, x0 + w - 2, y - 2, x0 + 2, y - 2);
      shape(g, body, d.color, sd(d), 0.8);
      // Water to the brim, a glint on it.
      g.fillStyle = css(hsl3(200, 50, 52));
      g.fillRect(x0 + 1.2, y - 2 - h + 0.6, w - 2.4, 1.4);
      glint(g, poly(x0 + 4, y - 1.6 - h, x0 + 9, y - 1.7 - h), 'rgba(235,245,255,0.9)', 0.5);
      if (d.color === TIN) for (let i = 1; i < 4; i++) tick(g, x0 + (w * i) / 4, y - h, x0 + (w * i) / 4 + 0.2, y - 3, 0.4, i, css(TIN, -24));
      else for (let i = 1; i < 3; i++) tick(g, x0 + 1.5, y - 2 - (h * i) / 3, x0 + w - 1.5, y - 2 - (h * i) / 3, 0.4, i, css(WOOD, -20));
    },
  },
  churn: {
    color: () => TIN,
    bake(g, d) {
      const k = d.size;
      const n = 1 + (d.seed % 2);
      for (let i = 0; i < n; i++) {
        const x = d.x + (i - (n - 1) / 2) * 8 * k * fx(d);
        const y = d.y;
        const h = (11 - i) * k;
        const body = poly(
          x - 3.4 * k,
          y,
          x - 3.6 * k,
          y - h * 0.65,
          x - 2.2 * k,
          y - h * 0.82,
          x - 1.6 * k,
          y - h,
          x + 1.6 * k,
          y - h,
          x + 2.2 * k,
          y - h * 0.82,
          x + 3.6 * k,
          y - h * 0.65,
          x + 3.4 * k,
          y,
        );
        shape(g, body, d.color, sd(d) + i, 0.9);
        tick(g, x - 3.5 * k, y - h * 0.3, x + 3.5 * k, y - h * 0.3, 0.6, i, css(TIN, -30));
        shape(g, boxPts(x - 2.2 * k, y - h - 1.4 * k, 4.4 * k, 1.6 * k, 0.5, sd(d) + i + 4), TIN, sd(d) + i + 4, 0.3);
        glint(g, poly(x - 2.4 * k, y - h * 0.55, x - 2.6 * k, y - h * 0.2), 'rgba(255,255,255,0.8)', 0.5);
      }
    },
  },
  sacks: {
    color: () => BURLAP,
    bake(g, d) {
      const k = d.size;
      const n = 2 + (d.seed % 2);
      for (let i = 0; i < n; i++) {
        const lean = (i - (n - 1) / 2) * 0.25;
        const x = d.x + (i - (n - 1) / 2) * 6 * k;
        const y = d.y;
        const h = (8 + k01(d, i) * 2) * k;
        const sack = poly(
          x - 3.4 * k,
          y,
          x - 3.6 * k + lean * 2,
          y - h * 0.7,
          x - 1.2 * k + lean * 4,
          y - h,
          x + 1.4 * k + lean * 4,
          y - h,
          x + 3.6 * k + lean * 2,
          y - h * 0.7,
          x + 3.4 * k,
          y,
        );
        shape(g, sack, hsl3(d.color.h + i * 4, d.color.s - i * 2, d.color.l - i * 4), sd(d) + i, 0.9);
        tick(g, x - 1.6 * k + lean * 4, y - h * 0.86, x + 1.8 * k + lean * 4, y - h * 0.86, 0.6, i + 3, css(BURLAP, -44));
        // A stencilled band where the feed's mark goes.
        g.fillStyle = css(hsl3(4, 50, 40), 0, 0.7);
        g.fillRect(x - 2 * k, y - h * 0.45, 4 * k, 1.1 * k);
      }
    },
  },
  barrow: {
    color: (_th, rng) => hsl3(rng.pick([4, 120, 210, 48]), 36, 44),
    bake(g, d) {
      const k = d.size;
      const f = fx(d);
      const x = d.x;
      const y = d.y;
      const wx = x + 7 * k * f;
      pole(g, x - 9 * k * f, y - 6 * k, wx, y - 3.4 * k, 1, OLDWOOD, sd(d));
      pole(g, x - 4 * k * f, y - 4.4 * k, x - 4.6 * k * f, y, 0.9, OLDWOOD, sd(d) + 2);
      const tray = poly(x - 6 * k * f, y - 9 * k, x + 6 * k * f, y - 9.6 * k, x + 4 * k * f, y - 4 * k, x - 3.6 * k * f, y - 4 * k);
      shape(g, tray, d.color, sd(d) + 3, 0.8);
      ball(g, wx, y - 3, 2.8 * k, hsl3(30, 10, 30), sd(d) + 5);
      // A spade left in it.
      pole(g, x - 1 * k * f, y - 8 * k, x + 2 * k * f, y - 17 * k, 0.8, WOOD, sd(d) + 6);
    },
  },
  vane: {
    color: (_th, rng) => hsl3(rng.pick([4, 40, 200]), 30, 30),
    bake(g, d) {
      const k = d.size;
      const x = d.x;
      const y = d.y;
      const top = y - 40 * k;
      pole(g, x, y + 0.5, x, top + 4, 1.4, OLDWOOD, sd(d));
      pole(g, x, top + 9, x, top, 0.8, d.color, sd(d) + 1);
      // The points of the compass on their arms, and the arrow over them.
      const ay = top + 7;
      pole(g, x - 6 * k, ay, x + 6 * k, ay, 0.6, d.color, sd(d) + 2);
      for (const ex of [-6, 6]) dot(g, x + ex * k, ay, 0.9, sd(d) + ex, undefined, inkFor(d.color));
      const f = fx(d);
      const arrow = poly(
        x - 9 * k * f,
        top + 1.6,
        x + 6 * k * f,
        top + 1.6,
        x + 6 * k * f,
        top + 0.2,
        x + 10 * k * f,
        top + 2.4,
        x + 6 * k * f,
        top + 4.6,
        x + 6 * k * f,
        top + 3.2,
        x - 9 * k * f,
        top + 3.2,
      );
      shape(g, arrow, d.color, sd(d) + 3, 0.3);
      shape(g, poly(x - 9 * k * f, top + 2.4, x - 12 * k * f, top - 2, x - 13 * k * f, top + 7, x - 9 * k * f, top + 3), d.color, sd(d) + 4, 0.3);
      ball(g, x, top + 2.4, 1.3, hsl3(44, 70, 52), sd(d) + 5);
    },
  },
  stile: {
    color: () => OLDWOOD,
    bake(g, d) {
      const k = d.size;
      const x = d.x;
      const y = d.y;
      // A stretch of rail fence, and the steps up and over it.
      for (const px of [-7, 7]) pole(g, x + px * k, y + 0.5, x + px * k, y - 15 * k, 1.5, d.color, sd(d) + px);
      for (const ry of [-6, -12]) pole(g, x - 10 * k, y + ry * k, x + 10 * k, y + ry * k + 0.4, 1.1, d.color, sd(d) + ry);
      for (const [sy, sw] of [
        [-4, 9],
        [-8.5, 6],
      ] as const) {
        box(g, x - sw * k, y + sy * k - 1.2, sw * 2 * k, 2.2, WOOD, sd(d) + sy, 0.4);
        for (const e of [-1, 1]) pole(g, x + e * (sw - 1) * k, y + sy * k + 1, x + e * (sw + 1.5) * k, y, 0.8, WOOD, sd(d) + sy + e);
      }
    },
  },
  coop: {
    color: (_th, rng) => hsl3(rng.pick([4, 30, 200, 90]), 28, 50),
    bake(g, d) {
      const k = d.size;
      const f = fx(d);
      const x = d.x;
      const y = d.y;
      const w = 15 * k;
      const by = y - 6 * k;
      for (const lx of [-w / 2 + 1.5, w / 2 - 2.5]) pole(g, x + lx, y + 0.5, x + lx, by, 1.1, OLDWOOD, sd(d) + lx);
      const house = boxPts(x - w / 2, by - 11 * k, w, 11 * k, 0.6, sd(d), 0.12);
      shape(g, house, d.color, sd(d) + 1, 1);
      for (let i = 1; i < 4; i++) tick(g, x - w / 2 + 0.6, by - (11 * k * i) / 4, x + w / 2 - 0.6, by - (11 * k * i) / 4, 0.35, i, css(d.color, -26));
      const roof = poly(x - w / 2 - 2, by - 10.6 * k, x, by - 18 * k, x + w / 2 + 2, by - 10.6 * k);
      shape(g, roof, hsl3(10, 40, 34), sd(d) + 2, 0.6);
      // The little door, and its ramp down to the yard with cleats on it.
      box(g, x + f * 2 - 2.4, by - 6.4 * k, 4.8, 6.4 * k, hsl3(20, 30, 18), sd(d) + 3, 0.5);
      pole(g, x + f * 2, by, x + f * (w / 2 + 6), y, 1.2, OLDWOOD, sd(d) + 4);
      straw(g, x - f * 4, by, Math.PI / 2, 4, sd(d) + 5);
    },
  },
  hive: {
    color: (_th, rng) => (rng.chance(0.6) ? hsl3(48, 30, 82) : hsl3(46, 48, 58)),
    bake(g, d) {
      const k = d.size;
      const x = d.x;
      const y = d.y;
      const w = 10 * k;
      box(g, x - w / 2 - 1, y - 2, w + 2, 2, OLDWOOD, sd(d), 0.3);
      for (let i = 0; i < 3; i++) box(g, x - w / 2, y - 2 - (i + 1) * 3.6 * k, w, 3.6 * k, i % 2 ? d.color : { ...d.color, l: d.color.l - 6 }, sd(d) + i, 0.4);
      shape(
        g,
        poly(x - w / 2 - 1.4, y - 2 - 10.8 * k, x + w / 2 + 1.4, y - 2 - 10.8 * k, x + w / 2, y - 2 - 13 * k, x - w / 2, y - 2 - 13 * k),
        hsl3(20, 20, 40),
        sd(d) + 5,
        0.3,
      );
      // The entrance slot at the foot.
      g.fillStyle = css(d.color, -38);
      path(g, boxPts(x - 2 * k, y - 3.5 * k, 4 * k, 1, 0.4, sd(d) + 6, 0.1));
      g.fill();
    },
  },
  tyre: {
    color: () => hsl3(220, 6, 27),
    bake(g, d) {
      const k = d.size;
      const x = d.x;
      const y = d.y;
      // Half sunk in the ground, standing on edge, tread nubs round it.
      const R = 7.5 * k;
      const ring = ovalPts(x, y - R * 0.55, R, R * 0.92, sd(d), 0.03, 22);
      g.save();
      g.beginPath();
      g.rect(x - R - 3, y - 2 * R - 3, 2 * R + 6, 2 * R + 3);
      g.clip();
      shape(g, ring, d.color, sd(d) + 1, 0.8);
      g.fillStyle = css(hsl3(30, 30, 30));
      path(g, ovalPts(x, y - R * 0.55, R * 0.48, R * 0.44, sd(d) + 2, 0.03, 14));
      g.fill();
      pen(g, ovalPts(x, y - R * 0.55, R * 0.48, R * 0.44, sd(d) + 2, 0.03, 14), sd(d) + 3, 0.3, 0.7, 3, inkFor(d.color));
      // Tread on the lit shoulder only: a few lifted ticks across it.
      for (let i = 0; i < 4; i++) {
        const a = Math.PI * 1.08 + i * 0.3;
        const cx = x + Math.cos(a) * R * 0.8;
        const cy = y - R * 0.55 + Math.sin(a) * R * 0.74;
        tick(g, cx - Math.cos(a) * 1.1, cy - Math.sin(a) * 1.1, cx + Math.cos(a) * 1.1, cy + Math.sin(a) * 1.1, 0.5, sd(d) + 6 + i, css(d.color, 16));
      }
      g.restore();
    },
  },
  well: {
    color: () => STONE,
    bake(g, d) {
      const k = d.size;
      const x = d.x;
      const y = d.y;
      const w = 14 * k;
      // The ring of stones, the posts, the little roof, the windlass and its bucket.
      for (const px of [-w / 2 + 1, w / 2 - 1]) pole(g, x + px, y - 5, x + px, y - 24 * k, 1.3, OLDWOOD, sd(d) + px);
      shape(g, poly(x - w / 2 - 3, y - 22 * k, x, y - 29 * k, x + w / 2 + 3, y - 22 * k), hsl3(10, 34, 32), sd(d) + 1, 0.5);
      pole(g, x - w / 2 + 1, y - 17 * k, x + w / 2 - 1, y - 17 * k, 1.2, WOOD, sd(d) + 2);
      barLine(g, x + 1, y - 17 * k, x + 1, y - 10 * k, 0.5, hsl3(36, 30, 52), 3, { rim: 0.2 });
      box(g, x - 1, y - 10 * k, 4, 3.4, WOOD, sd(d) + 3, 0.4);
      const ring = boxPts(x - w / 2 - 1, y - 7 * k, w + 2, 7 * k, 1.6, sd(d) + 4, 0.2);
      shape(g, ring, d.color, sd(d) + 4, 0.9);
      g.save();
      path(g, ring);
      g.clip();
      // One course line, lifted halfway, and a few joints off it: the stones, not a grid of them.
      const joint = css(d.color, -28);
      tick(g, x - w / 2, y - 4.6 * k, x - 1, y - 4.7 * k, 0.4, sd(d) + 5, joint);
      tick(g, x + 2, y - 4.5 * k, x + w / 2, y - 4.6 * k, 0.4, sd(d) + 6, joint);
      for (const [i, jx] of [-0.3, 0.1, 0.36].entries()) {
        const up = i % 2 ? 0 : 1;
        tick(g, x + jx * w, y - (up ? 7 : 4.5) * k + 0.4, x + jx * w + 0.2, y - (up ? 4.8 : 2.2) * k, 0.4, sd(d) + 7 + i, joint);
      }
      g.restore();
    },
  },
  plough: {
    color: () => RUST,
    bake(g, d) {
      const k = d.size;
      const f = fx(d);
      const x = d.x;
      const y = d.y;
      // A beam, two handles back, and the curved share biting the ground.
      pole(g, x - 9 * k * f, y - 6 * k, x + 8 * k * f, y - 4 * k, 1.2, OLDWOOD, sd(d));
      for (const h of [0, 1.6]) pole(g, x - 6 * k * f, y - 5.4 * k, x - (11 + h) * k * f, y - (13 - h) * k, 0.9, OLDWOOD, sd(d) + 1 + h);
      const share = poly(x + 2 * k * f, y - 5 * k, x + 7 * k * f, y - 4.4 * k, x + 9 * k * f, y, x + 2 * k * f, y);
      shape(g, share, d.color, sd(d) + 3, 0.6);
      pole(g, x + 6 * k * f, y - 4.4 * k, x + 7 * k * f, y + 0.5, 0.9, d.color, sd(d) + 4);
      stroke(g, poly(x + 3 * k * f, y - 1, x + 6 * k * f, y - 2.2), { w: 0.4, seed: 5, taper: [0.2, 0.5] });
    },
  },
} satisfies Record<'scarecrow' | 'trough' | 'churn' | 'sacks' | 'barrow' | 'vane' | 'stile' | 'coop' | 'hive' | 'tyre' | 'well' | 'plough', DecorDef>;
