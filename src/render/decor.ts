import { css, type HSL, hsl3, shift } from '../core/color';
import type { Rng } from '../core/rng';
import type { DecorKind, DecorSpot } from '../gen/decor';
import type { Theme } from '../gen/theme';
import { CASTLE_DECOR } from './decor-castle';
import { FARM_DECOR } from './decor-farm';
import { FRONTIER_DECOR } from './decor-frontier';
import { GLACIER_DECOR } from './decor-glacier';
import { HARBOR_DECOR } from './decor-harbor';
import { JUNGLE_DECOR } from './decor-jungle';
import { MINE_DECOR } from './decor-mine';
import { ROOFTOPS_DECOR } from './decor-rooftops';
import { SPACE_DECOR } from './decor-space';
import { VOLCANO_DECOR } from './decor-volcano';
import { blob, line, type P, stroke } from './ink';
import { inkFence, inkHay } from './ink-parts';
import { ball, boxPts, dot, glint, INK, ovalPts, part, path, pen, poly, tick, tone } from './ink-props';
import { bulb, circle, flame, flutter, glowDot, light, type RC } from './kit';

/**
 * Terrain decor art, inked like the terrain it stands on (docs/ART.md, World art). Where each kind grows,
 * how much room it takes and where it goes in a level is decided in gen (src/gen/decor: its rule and
 * `placeDecor`); this is how it's drawn:
 *   - `color`: its tint, rolled from the spot's own seed,
 *   - `bake`: static parts, painted once into the terrain bake (cheap),
 *   - `live`: animated / emissive parts, drawn every frame.
 * Decor is purely cosmetic and stays small so it never reads as a hazard or as somewhere to stand.
 */

/** A placed piece (`DecorSpot`) with its tint. */
export interface Decor extends DecorSpot {
  color: HSL;
}

export interface DecorDef {
  color(th: Theme, rng: Rng): HSL;
  bake?(s: CanvasRenderingContext2D, d: Decor, th: Theme): void;
  live?(rc: RC, d: Decor, th: Theme): void;
}

const WOOD: HSL = hsl3(28, 40, 34);
const IRON: HSL = hsl3(220, 8, 22);
const k01 = (d: Decor, n: number) => ((d.seed >>> n) % 1000) / 1000;
const sd = (d: Decor) => d.seed & 0xffff;

/** An inked box: hand-cut, two tones, the pen round it. */
function box(s: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: HSL, seed: number, r = 0.8) {
  const pts = boxPts(x, y, w, h, r, seed, 0.15);
  part(s, pts, c, seed, { depth: Math.min(1.2, Math.min(w, h) * 0.2), thin: 0.45, thick: 1.1 });
  return pts;
}

/** A stick or stem: an ink ribbon with color over it. */
function stick(s: CanvasRenderingContext2D, pts: readonly P[], w: number, c: string, seed: number, ink = INK) {
  s.fillStyle = ink;
  stroke(s, pts, { w: w + 1, seed, taper: [0.02, 0.3], press: 0.1 });
  s.fillStyle = c;
  stroke(s, pts, { w, seed, taper: [0.02, 0.4], press: 0.1 });
}

/** A curved stem from (x, y) up by h, its tip pushed sideways by `sw`. */
function stemPts(x: number, y: number, h: number, sw: number, n = 5): P[] {
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ x: x + sw * t * t, y: y - h * t });
  }
  return pts;
}

/** A leaf: a pointed oval in two greens split down the vein, with an ink edge. */
function leaf(s: CanvasRenderingContext2D, x: number, y: number, a: number, L: number, W: number, c: HSL) {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const tip = { x: x + ca * L, y: y + sa * L };
  const mid = { x: x + ca * L * 0.45, y: y + sa * L * 0.45 };
  const up = { x: mid.x - sa * W, y: mid.y + ca * W };
  const dn = { x: mid.x + sa * W, y: mid.y - ca * W };
  const base = { x, y };
  s.fillStyle = INK;
  path(s, [
    { x: base.x - ca * 0.4, y: base.y - sa * 0.4 },
    { x: up.x - sa * 0.5, y: up.y + ca * 0.5 },
    { x: tip.x + ca * 0.6, y: tip.y + sa * 0.6 },
    { x: dn.x + sa * 0.5, y: dn.y - ca * 0.5 },
  ]);
  s.fill();
  s.fillStyle = css(c, 8);
  path(s, [base, dn, tip]);
  s.fill();
  s.fillStyle = css(c, -8);
  path(s, [base, up, tip]);
  s.fill();
}

/** Soft rising puffs, on the background layer where soft things stay soft. */
function steam(rc: RC, x: number, y: number, seed: number, scale = 1, a = 0.28) {
  const t = rc.t;
  for (let i = 0; i < 4; i++) {
    const p = (t * 0.55 + i / 4 + (seed % 10) / 10) % 1;
    rc.bg.fillStyle = `rgba(225,228,236,${a * (1 - p) * Math.min(1, p * 6)})`;
    circle(rc.bg, x + Math.sin(p * 5 + i + seed) * 2.5 * scale, y - p * 16 * scale, (1.4 + p * 3.6) * scale);
  }
}

export const DECOR: Record<DecorKind, DecorDef> = {
  // ---- generic -----------------------------------------------------------
  crystal: {
    color: (th, rng) => (rng.chance(0.7) ? th.terrain.vein : hsl3(rng.range(0, 360), 85, 62)),
    live(rc, d) {
      const s = rc.s;
      const k = d.size;
      const n = 2 + (d.seed % 3);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.45 + ((d.seed >> (i * 3)) % 7) * 0.03;
        const len = (5 + ((d.seed >> (i * 5)) % 5)) * k;
        const w = 1.8 * k;
        const bx = d.x + (i - (n - 1) / 2) * 2;
        const by = d.y + 1;
        const tip = { x: bx + Math.cos(a) * len, y: by + Math.sin(a) * len };
        const nx = -Math.sin(a) * w;
        const ny = Math.cos(a) * w;
        const l = { x: bx - nx, y: by - ny };
        const r = { x: bx + nx, y: by + ny };
        s.fillStyle = css(d.color, -16, 1, 6);
        path(s, [l, tip, { x: bx, y: by }]);
        s.fill();
        s.fillStyle = css(d.color, 20);
        path(s, [{ x: bx, y: by }, tip, r]);
        s.fill();
        pen(s, [l, tip, r], sd(d) + i, 0.4, 0.9, 2, css(d.color, -46, 1, 10));
      }
      const pulse = 0.6 + Math.sin(rc.t * 2 + d.seed) * 0.25;
      light(rc, d.x, d.y - 4, 34 * k, d.color, 0.45 * pulse);
    },
  },
  mushroom: {
    color: (th, rng) => (th.night ? hsl3(rng.pick([190, 280, 320, 100]), 90, 60) : hsl3(rng.pick([0, 10, 30]), 75, 50)),
    bake(s, d, th) {
      const k = d.size;
      const h = 5 * k;
      stick(s, poly(d.x, d.y, d.x + 0.2, d.y - h), 1.4, css(hsl3(40, 25, 80), th.night ? -25 : 0), sd(d));
      const cap: P[] = [];
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI + (i / 10) * Math.PI;
        cap.push({ x: d.x + Math.cos(a) * 3.6 * k, y: d.y - h + Math.sin(a) * 2.6 * k });
      }
      part(s, cap, shift(d.color, -6), sd(d) + 1, { depth: 0.6 * k, thin: 0.4, thick: 0.9 });
      if (!th.night) {
        dot(s, d.x - 1.2 * k, d.y - h - 1.2 * k, 0.6 * k, sd(d) + 2);
        s.fillStyle = 'rgba(255,255,255,0.9)';
        circle(s, d.x - 1.2 * k, d.y - h - 1.2 * k, 0.5 * k);
        circle(s, d.x + 1.4 * k, d.y - h - 0.7 * k, 0.45 * k);
      }
    },
    live(rc, d, th) {
      if (!th.night) return;
      const k = d.size;
      const h = 5 * k;
      const pulse = 0.65 + Math.sin(rc.t * 1.5 + d.seed) * 0.35;
      rc.g.fillStyle = css(d.color, 10, 0.6 * pulse);
      rc.g.beginPath();
      rc.g.ellipse(d.x, d.y - h, 3.6 * k, 2.6 * k, 0, Math.PI, 0);
      rc.g.fill();
      light(rc, d.x, d.y - h, 28 * k, d.color, 0.45 * pulse);
    },
  },
  flower: {
    color: (_th, rng) => hsl3(rng.pick([0, 50, 280, 320, 200, 30]), 80, 64),
    live(rc, d, th) {
      const s = rc.s;
      const k = d.size;
      const h = 6 * k;
      const sw = flutter(rc, 2, d.seed) * 1.5;
      stick(s, stemPts(d.x, d.y, h, sw, 4), 0.7, css(th.terrain.capColor, -12), sd(d));
      const hx = d.x + sw;
      const hy = d.y - h;
      s.fillStyle = INK;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + d.seed;
        circle(s, hx + Math.cos(a) * 1.6 * k, hy + Math.sin(a) * 1.6 * k, 1.2 * k + 0.45);
      }
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + d.seed;
        s.fillStyle = css(d.color, i < 2 ? 8 : -4);
        circle(s, hx + Math.cos(a) * 1.6 * k, hy + Math.sin(a) * 1.6 * k, 1.2 * k);
      }
      s.fillStyle = '#ffe680';
      circle(s, hx, hy, 0.9 * k);
    },
  },
  lantern: {
    color: (th) => th.lamp,
    live(rc, d) {
      const s = rc.s;
      const k = d.size;
      const len = 5 * k + (d.seed % 6);
      const sw = flutter(rc, 1.3, d.seed) * 0.15;
      const lx = d.x + Math.sin(sw) * len;
      const ly = d.y + Math.cos(sw) * len;
      s.fillStyle = INK;
      line(s, d.x, d.y, lx, ly, { w: 0.49, seed: sd(d), taper: [0, 0], press: 0 });
      const fl = 0.85 + Math.sin(rc.t * 9 + d.seed) * 0.08;
      s.fillStyle = css(d.color, 20);
      s.fillRect(lx - 2, ly + 1.3, 4, 4.7);
      s.fillStyle = INK;
      s.fillRect(lx - 2.8, ly - 0.2, 5.6, 1.8);
      s.fillRect(lx - 2.8, ly + 5.7, 5.6, 1.8);
      s.fillRect(lx - 2.5, ly + 1.3, 0.8, 4.7);
      s.fillRect(lx + 1.7, ly + 1.3, 0.8, 4.7);
      s.fillRect(lx - 0.3, ly + 1.3, 0.6, 4.7);
      rc.g.fillStyle = css(d.color, 10, 0.9 * fl);
      rc.g.fillRect(lx - 1.7, ly + 1.3, 3.4, 4.7);
      glowDot(rc.g, lx, ly + 3.5, 8 * k, d.color, 0.4 * fl);
      light(rc, lx, ly + 3.5, 80 * k, d.color, 0.9 * fl);
    },
  },
  vine: {
    color: (th) => shift(th.terrain.capColor, -6),
    live(rc, d) {
      const s = rc.s;
      const k = d.size;
      const segs = 4 + (d.seed % 7);
      const pts: P[] = [{ x: d.x, y: d.y }];
      for (let i = 1; i <= segs; i++) pts.push({ x: d.x + flutter(rc, 1.1, i * 0.6 + d.seed) * i * 0.4, y: d.y + i * 2.6 * k });
      stick(s, pts, 0.8, css(d.color, -8), sd(d));
      for (let i = 1; i <= segs; i++) leaf(s, pts[i].x, pts[i].y, i % 2 ? 0.5 : Math.PI - 0.5, 2.6, 1.1, shift(d.color, (i % 3) * 5));
    },
  },
  bones: {
    color: () => hsl3(40, 25, 80),
    bake(s, d) {
      const k = d.size;
      const c = css(d.color, -4);
      for (const [ax, ay, bx, by] of [
        [-4, -0.8, 4, -1.8],
        [-2, -2.8, 3, -0.6],
      ]) {
        stick(s, poly(d.x + ax * k, d.y + ay, d.x + bx * k, d.y + by), 1.1 * k, c, sd(d) + ax);
        for (const [ex, ey] of [
          [ax, ay],
          [bx, by],
        ])
          ball(s, d.x + ex * k, d.y + ey, 1 * k, d.color, ex + 9);
      }
    },
  },
  torch: {
    color: (th) => th.lamp,
    bake(s, d) {
      const k = d.size;
      stick(s, poly(d.x, d.y, d.x, d.y - 9 * k), 1.8, css(WOOD, -6), sd(d));
      box(s, d.x - 2.2, d.y - 10 * k, 4.4, 2, shift(IRON, 10), sd(d) + 1, 0.4);
    },
    live(rc, d) {
      const k = d.size;
      const fl = 0.8 + Math.sin(rc.t * 17 + d.seed) * 0.12 + Math.sin(rc.t * 29 + d.seed * 2) * 0.08;
      const fy = d.y - 10 * k;
      flame(rc.g, d.x, fy, 2.6 * k * fl, 6 * k * fl, d.color, rc.t + d.seed);
      glowDot(rc.g, d.x, fy - 2, 18 * k, d.color, 0.32 * fl);
      light(rc, d.x, fy, 90 * k, d.color, 0.95 * fl);
    },
  },
  pipe: {
    color: () => hsl3(25, 30, 34),
    bake(s, d) {
      const k = d.size;
      const c = d.seed % 2 ? hsl3(25, 30, 36) : hsl3(150, 18, 34);
      box(s, d.x - 2, d.y - 10 * k, 4, 10 * k, c, sd(d), 0.5);
      box(s, d.x - 3, d.y - 11 * k, 6, 2, shift(c, 10), sd(d) + 1, 0.4);
      box(s, d.x - 2.5, d.y - 4 * k, 5, 1.3, shift(c, 10), sd(d) + 2, 0.3);
    },
    live(rc, d) {
      steam(rc, d.x, d.y - 11 * d.size, d.seed, d.size);
    },
  },

  // ---- farm --------------------------------------------------------------
  fence: {
    color: () => hsl3(32, 30, 58),
    bake: (s, d) => inkFence(s, d),
  },
  haybale: {
    color: () => hsl3(44, 70, 58),
    bake: (s, d) => inkHay(s, d),
  },
  wheat: {
    color: (_th, rng) => hsl3(rng.range(40, 50), 70, 58),
    live(rc, d) {
      const s = rc.s;
      for (let i = 0; i < 6; i++) {
        const bx = d.x - 5 + i * 2 + k01(d, i) * 1.2;
        const h = 7 + k01(d, i + 3) * 5;
        const sw = flutter(rc, 1.8, bx * 0.2) * 1.8;
        s.fillStyle = css(d.color, -22, 1, 6);
        stroke(s, stemPts(bx, d.y, h, sw, 4), { w: 0.6, seed: i, taper: [0.02, 0.3], press: 0 });
        // The ear: two flat tones split down the middle, an ink edge.
        const ex = bx + sw;
        const ey = d.y - h - 1.4;
        s.fillStyle = INK;
        s.beginPath();
        s.ellipse(ex, ey, 1.3, 2.6, sw * 0.12, 0, Math.PI * 2);
        s.fill();
        s.fillStyle = css(d.color, 8);
        s.beginPath();
        s.ellipse(ex, ey, 0.85, 2.2, sw * 0.12, 0, Math.PI * 2);
        s.fill();
        s.fillStyle = css(d.color, -10);
        s.fillRect(ex, ey - 1.8, 0.6, 3.6);
      }
    },
  },
  pumpkin: {
    color: (_th, rng) => hsl3(rng.range(22, 30), 90, 50),
    bake(s, d) {
      const k = d.size;
      const r = 3.6 * k;
      const cy = d.y - r + 0.5;
      s.fillStyle = INK;
      path(s, ovalPts(d.x + 0.2, cy + 0.2, r * 1.35 + 0.7, r + 0.7, sd(d), 0.04, 20));
      s.fill();
      for (const [dx, dl] of [
        [-1.6, -8],
        [1.6, -12],
        [0, 4],
      ]) {
        s.fillStyle = css(d.color, dl);
        path(s, ovalPts(d.x + dx * k, cy, r * 0.7, r, sd(d) + dx, 0.03, 16));
        s.fill();
      }
      tick(s, d.x - 1.6 * k + r * 0.25, cy - r * 0.8, d.x - 1.6 * k + r * 0.25, cy + r * 0.8, 0.5, sd(d), css(d.color, -30));
      tick(s, d.x + 1.6 * k - r * 0.25, cy - r * 0.8, d.x + 1.6 * k - r * 0.25, cy + r * 0.8, 0.5, sd(d) + 1, css(d.color, -30));
      glint(s, poly(d.x - r * 0.4, cy - r * 0.5, d.x - r * 0.1, cy - r * 0.75), 'rgba(255,230,190,0.9)', 0.6);
      stick(s, poly(d.x - 0.2, cy - r + 0.4, d.x + 0.4, cy - r - 2.2), 1, css(hsl3(90, 50, 30)), sd(d) + 2);
    },
  },
  sunflower: {
    color: () => hsl3(48, 95, 55),
    live(rc, d, th) {
      const s = rc.s;
      const k = d.size;
      const h = 14 * k;
      const sw = flutter(rc, 1.2, d.seed);
      const stem = stemPts(d.x, d.y, h, sw, 6);
      stick(s, stem, 1, css(th.terrain.capColor, -14), sd(d));
      leaf(s, stem[3].x, stem[3].y, -0.4, 4, 1.4, shift(th.terrain.capColor, -6));
      leaf(s, stem[2].x, stem[2].y, Math.PI + 0.4, 4, 1.4, shift(th.terrain.capColor, -6));
      const hx = d.x + sw;
      const hy = d.y - h;
      s.fillStyle = INK;
      circle(s, hx, hy, 4.4 * k);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        s.fillStyle = css(d.color, i % 2 ? -8 : 6);
        s.beginPath();
        s.ellipse(hx + Math.cos(a) * 2.6 * k, hy + Math.sin(a) * 2.6 * k, 1.5 * k, 0.8 * k, a, 0, Math.PI * 2);
        s.fill();
      }
      s.fillStyle = css(hsl3(25, 60, 22));
      circle(s, hx, hy, 1.7 * k);
      s.fillStyle = css(hsl3(25, 50, 34));
      circle(s, hx - 0.5 * k, hy - 0.5 * k, 0.6 * k);
    },
  },

  // ---- factory -----------------------------------------------------------
  vent: {
    color: () => hsl3(210, 8, 42),
    bake(s, d) {
      const k = d.size;
      box(s, d.x - 4 * k, d.y - 5 * k, 8 * k, 5 * k, d.color, sd(d));
      for (let i = 0; i < 3; i++) tick(s, d.x - 3 * k, d.y - 4 * k + i * 1.4 * k, d.x + 3 * k, d.y - 4 * k + i * 1.4 * k, 0.6, i, INK);
    },
    live(rc, d) {
      steam(rc, d.x, d.y - 5 * d.size, d.seed, d.size * 0.9, 0.22);
    },
  },
  barrel: {
    color: (th, rng) => (th.id === 'harbor' ? hsl3(28, 45, 36) : hsl3(rng.pick([5, 210, 120, 45]), 55, 40)),
    bake(s, d, th) {
      const k = d.size;
      const w = 7 * k;
      const h = 9 * k;
      const x = d.x - w / 2;
      const y = d.y - h;
      const pts = boxPts(x, y, w, h, 1.4, sd(d), 0.4);
      tone(s, pts, d.color, { depth: 1 });
      s.save();
      path(s, pts);
      s.clip();
      const hoop = th.id === 'harbor' ? shift(IRON, 12) : shift(d.color, -22);
      for (const t of [0.2, 0.72]) {
        s.fillStyle = INK;
        s.fillRect(x, y + h * t - 0.3, w, 1.6);
        s.fillStyle = css(hoop);
        s.fillRect(x, y + h * t, w, 0.9);
      }
      if (th.id === 'harbor') for (let xx = x + 1.8; xx < x + w - 1; xx += 1.8) tick(s, xx, y + 0.5, xx, y + h - 0.5, 0.35, xx, css(d.color, -18));
      glint(s, poly(x + 1.2, y + h * 0.3, x + 1.1, y + h * 0.6), css(d.color, 22), 0.6);
      s.restore();
      pen(s, pts, sd(d) + 1, 0.45, 1.1);
      if (th.id === 'factory' && d.seed % 3 === 0) {
        part(s, poly(d.x, y + h * 0.32, d.x + 1.8, y + h * 0.6, d.x - 1.8, y + h * 0.6), hsl3(48, 90, 56), sd(d) + 2, { depth: 0.2, thin: 0.3, thick: 0.5 });
      }
    },
  },
  crate: {
    color: () => hsl3(32, 45, 44),
    bake(s, d) {
      const k = d.size;
      const w = 9 * k;
      const one = (x: number, y: number, ww: number, c: HSL, seed: number) => {
        const pts = boxPts(x, y, ww, ww, 0.6, seed, 0.15);
        tone(s, pts, c, { depth: 0.9 });
        s.save();
        path(s, pts);
        s.clip();
        s.fillStyle = INK;
        for (const [ax, ay, bx, by] of [
          [x + 1, y + 1, x + ww - 1, y + 1],
          [x + 1, y + ww - 1, x + ww - 1, y + ww - 1],
          [x + 1, y + 1, x + ww - 1, y + ww - 1],
        ])
          line(s, ax, ay, bx, by, { w: 1.5, seed: ax + by, taper: [0.02, 0.02], press: 0.15 });
        s.fillStyle = css(c, 10);
        line(s, x + 1, y + 1, x + ww - 1, y + ww - 1, { w: 0.6, seed, taper: [0.02, 0.02], press: 0.15 });
        s.restore();
        pen(s, pts, seed + 1, 0.45, 1.1);
      };
      if (d.seed % 2) one(d.x - w / 2 + w * 0.2, d.y - w - w * 0.7, w * 0.7, shift(d.color, -6), sd(d) + 3);
      one(d.x - w / 2, d.y - w, w, d.color, sd(d));
    },
  },
  beacon: {
    color: () => hsl3(32, 100, 55),
    bake(s, d) {
      box(s, d.x - 2.5, d.y - 3, 5, 3, shift(IRON, 6), sd(d), 0.4);
    },
    live(rc, d) {
      const a = rc.t * 4 + d.seed;
      const s = rc.s;
      s.fillStyle = INK;
      s.beginPath();
      s.arc(d.x, d.y - 3, 2.8, Math.PI, 0);
      s.fill();
      s.fillStyle = css(d.color, -10);
      s.beginPath();
      s.arc(d.x, d.y - 3, 2.2, Math.PI, 0);
      s.fill();
      const on = 0.55 + 0.45 * Math.max(0, Math.cos(a));
      bulb(rc.g, d.x, d.y - 4, 1.5, d.color, 0.9 * on);
      const g = rc.g;
      const dir = Math.cos(a) > 0 ? 1 : -1;
      // The sweep: a flat wedge, not a fade.
      g.fillStyle = css(d.color, 10, 0.12 * on);
      g.beginPath();
      g.moveTo(d.x, d.y - 4);
      g.lineTo(d.x + dir * 30, d.y - 4 - 8 * Math.abs(Math.sin(a)));
      g.lineTo(d.x + dir * 30, d.y - 4 + 6 * Math.abs(Math.sin(a)));
      g.fill();
      light(rc, d.x, d.y - 4, 50, d.color, 0.6 * on);
    },
  },
  chain: {
    color: () => hsl3(220, 6, 40),
    live(rc, d) {
      const s = rc.s;
      const n = 5 + (d.seed % 6);
      const sw = flutter(rc, 0.9, d.seed) * 0.1;
      for (let i = 0; i < n; i++) {
        const x = d.x + Math.sin(sw) * i * 2.4;
        const y = d.y + 1.2 + i * 2.4;
        const ring = ovalPts(x, y, i % 2 ? 0.55 : 1.2, 1.45, i, 0.02, 10);
        s.fillStyle = INK;
        stroke(s, [...ring, ring[0]], { w: 1, seed: i, taper: [0, 0], press: 0 });
        s.fillStyle = css(d.color, i % 2 ? -6 : 10);
        stroke(s, [...ring, ring[0]], { w: 0.55, seed: i, taper: [0, 0], press: 0 });
      }
      if (d.seed % 3 === 0) {
        const x = d.x + Math.sin(sw) * n * 2.4;
        const y = d.y + n * 2.4 + 1.5;
        const hook: P[] = [];
        for (let i = 0; i <= 8; i++) {
          const a = -Math.PI * 0.1 + (i / 8) * Math.PI * 1.2;
          hook.push({ x: x + Math.cos(a) * 2, y: y + 1.5 + Math.sin(a) * 2 });
        }
        stick(s, hook, 0.8, css(d.color, 4), sd(d));
      }
    },
  },
  cable: {
    color: (_th, rng) => hsl3(rng.pick([0, 210, 50]), 30, 18),
    live(rc, d) {
      const sag = 8 + (d.seed % 8);
      const sw = flutter(rc, 0.8, d.seed) * 1.5;
      const pts: P[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const u = 1 - t;
        pts.push({ x: u * u * (d.x - 6) + 2 * u * t * (d.x + sw) + t * t * (d.x + 7), y: u * u * d.y + 2 * u * t * (d.y + sag) + t * t * d.y });
      }
      rc.s.fillStyle = css(d.color, -6);
      stroke(rc.s, pts, { w: 1.3, seed: sd(d), taper: [0, 0], press: 0.1 });
    },
  },
  cagelamp: {
    color: (th) => th.lamp,
    live(rc, d) {
      const s = rc.s;
      const fl = 0.9 + Math.sin(rc.t * 30 + d.seed) * 0.04 + (Math.sin(rc.t * 3.1 + d.seed) > 0.97 ? -0.5 : 0);
      rc.g.fillStyle = css(d.color, 15, fl);
      rc.g.beginPath();
      rc.g.arc(d.x, d.y + 4.4, 2.4, 0, Math.PI);
      rc.g.fill();
      s.fillStyle = css(d.color, 18);
      s.beginPath();
      s.arc(d.x, d.y + 4.4, 2.3, 0, Math.PI);
      s.fill();
      s.fillStyle = INK;
      s.fillRect(d.x - 0.6, d.y, 1.2, 3.2);
      s.fillRect(d.x - 3.2, d.y + 3, 6.4, 1.6);
      const cage: P[] = [];
      for (let i = 0; i <= 8; i++) cage.push({ x: d.x + Math.cos((i / 8) * Math.PI) * 2.9, y: d.y + 4.4 + Math.sin((i / 8) * Math.PI) * 2.9 });
      stroke(s, cage, { w: 0.6, seed: sd(d), taper: [0, 0], press: 0 });
      line(s, d.x, d.y + 4.4, d.x, d.y + 7.3, { w: 0.5, seed: sd(d) + 1, taper: [0, 0], press: 0 });
      // Cone of light downward.
      const g = rc.g;
      const gr = g.createLinearGradient(0, d.y + 5, 0, d.y + 40);
      gr.addColorStop(0, css(d.color, 10, 0.16 * fl));
      gr.addColorStop(1, css(d.color, 0, 0));
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(d.x - 2.5, d.y + 5);
      g.lineTo(d.x + 2.5, d.y + 5);
      g.lineTo(d.x + 14, d.y + 40);
      g.lineTo(d.x - 14, d.y + 40);
      g.fill();
      light(rc, d.x, d.y + 10, 70, d.color, 0.85 * fl);
    },
  },

  // ---- castle ------------------------------------------------------------
  banner: {
    color: (th) => th.layers[th.layers.length - 1]?.detail ?? hsl3(0, 60, 40),
    live(rc, d) {
      const s = rc.s;
      const w = 7 * d.size;
      const h = 14 * d.size;
      const wave = (i: number) => flutter(rc, 2, d.seed + i * 0.7) * 2.4 * (i / 6);
      const cloth: P[] = [
        { x: d.x - w / 2, y: d.y + 2 },
        { x: d.x + w / 2, y: d.y + 2 },
      ];
      for (let i = 0; i <= 6; i++) cloth.push({ x: d.x + w / 2 + wave(i), y: d.y + 2 + (h * i) / 6 });
      cloth.push({ x: d.x + wave(6), y: d.y + 2 + h - 3 });
      for (let i = 6; i >= 0; i--) cloth.push({ x: d.x - w / 2 + wave(i), y: d.y + 2 + (h * i) / 6 });
      tone(s, cloth, d.color, { depth: 1.2 });
      const ey = d.y + 2 + h * 0.42 + wave(3) * 0.5;
      part(s, poly(d.x, ey - 2.4, d.x + 2, ey, d.x, ey + 2.4, d.x - 2, ey), hsl3(45, 90, 60), sd(d) + 1, { depth: 0.3, thin: 0.3, thick: 0.6 });
      s.fillStyle = css(hsl3(45, 90, 60), -10);
      s.fillRect(d.x - w / 2, d.y + 3, w, 0.8);
      pen(s, cloth, sd(d), 0.45, 1.1);
      stick(s, poly(d.x - w / 2 - 1.5, d.y + 1.3, d.x + w / 2 + 1.5, d.y + 1.3), 1.2, css(WOOD, -6), sd(d) + 2);
    },
  },
  skull: {
    color: () => hsl3(42, 22, 80),
    bake(s, d) {
      const k = d.size;
      const head = ovalPts(d.x, d.y - 2.9 * k, 2.5 * k, 2.4 * k, sd(d), 0.05, 14);
      part(s, head, d.color, sd(d), { depth: 0.5 * k, thin: 0.4, thick: 0.9 });
      box(s, d.x - 1.5 * k, d.y - 1.6 * k, 3 * k, 1.6 * k, d.color, sd(d) + 1, 0.3);
      s.fillStyle = INK;
      blob(s, d.x - 0.95 * k, d.y - 3 * k, 0.75 * k, sd(d) + 2, 1, 0.15);
      s.fill();
      blob(s, d.x + 0.95 * k, d.y - 3 * k, 0.75 * k, sd(d) + 3, 1, 0.15);
      s.fill();
      tick(s, d.x - 0.5 * k, d.y - 1.4 * k, d.x - 0.5 * k, d.y - 0.2, 0.3, 4);
      tick(s, d.x + 0.5 * k, d.y - 1.4 * k, d.x + 0.5 * k, d.y - 0.2, 0.3, 5);
    },
  },

  // ---- jungle ------------------------------------------------------------
  fern: {
    color: (th, rng) => shift(th.terrain.capColor, rng.range(-4, 8), 0, rng.range(-10, 10)),
    live(rc, d) {
      const s = rc.s;
      const k = d.size;
      const n = 5;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.42 + flutter(rc, 1.4, d.seed + i) * 0.08;
        const len = (8 + (i % 2) * 3) * k;
        const ex = d.x + Math.cos(a) * len;
        const ey = d.y + Math.sin(a) * len * 0.9;
        const frond: P[] = [];
        for (let j = 0; j <= 5; j++) {
          const p = j / 5;
          frond.push({ x: d.x + (ex - d.x) * p, y: d.y + (ey - d.y) * p + Math.abs(Math.cos(a)) * 3 * p * p });
        }
        s.fillStyle = css(d.color, -22, 1, 6);
        stroke(s, frond, { w: 0.7, seed: i, taper: [0.02, 0.5], press: 0 });
        for (let j = 1; j < 5; j++) {
          const p = j / 5;
          const L = 2.4 * (1 - p * 0.5);
          leaf(s, frond[j].x, frond[j].y, a + 1.2, L, 0.7, shift(d.color, (i % 2) * 6));
          leaf(s, frond[j].x, frond[j].y, a - 1.2, L, 0.7, shift(d.color, (i % 2) * 6));
        }
      }
    },
  },
  bigleaf: {
    color: (th) => shift(th.terrain.capColor, 4, 5, -8),
    live(rc, d) {
      const s = rc.s;
      const k = d.size;
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i - 1) * 0.75 + flutter(rc, 1.1, d.seed + i * 2) * 0.07;
        const len = (10 + i * 2) * k;
        const ex = d.x + Math.cos(a) * len;
        const ey = d.y + Math.sin(a) * len;
        stick(s, poly(d.x, d.y, ex, ey), 0.6, css(d.color, -18), sd(d) + i);
        leaf(s, d.x + Math.cos(a) * 2, d.y + Math.sin(a) * 2, a, len * 0.95, 2.8 * k, shift(d.color, i * 4 - 4));
      }
    },
  },
  roots: {
    color: (th) => shift(th.terrain.dark, 6),
    bake(s, d) {
      for (let i = 0; i < 3; i++) {
        const x = d.x + (i - 1) * 3;
        const len = 4 + k01(d, i) * 9;
        const cx = x + (k01(d, i + 2) - 0.5) * 6;
        const ex = x + (k01(d, i + 4) - 0.5) * 4;
        const pts: P[] = [];
        for (let j = 0; j <= 6; j++) {
          const t = j / 6;
          const u = 1 - t;
          pts.push({ x: u * u * x + 2 * u * t * cx + t * t * ex, y: u * u * (d.y - 1) + 2 * u * t * (d.y + len * 0.6) + t * t * (d.y + len) });
        }
        stick(s, pts, 1.1 - i * 0.2, css(d.color), sd(d) + i);
      }
    },
  },

  // ---- volcano -----------------------------------------------------------
  fumarole: {
    color: (th) => th.terrain.vein,
    bake(s, d, th) {
      part(s, poly(d.x - 5, d.y + 0.5, d.x - 2, d.y - 4, d.x + 2, d.y - 4, d.x + 5, d.y + 0.5), shift(th.terrain.dark, -2), sd(d), {
        depth: 0.7,
        thin: 0.45,
        thick: 1,
      });
      s.fillStyle = INK;
      path(s, ovalPts(d.x, d.y - 4, 2.2, 0.9, sd(d) + 1, 0.05, 10));
      s.fill();
    },
    live(rc, d) {
      const t = rc.t;
      const pulse = 0.7 + Math.sin(t * 3 + d.seed) * 0.3;
      rc.g.fillStyle = css(d.color, 10, 0.9 * pulse);
      rc.g.beginPath();
      rc.g.ellipse(d.x, d.y - 4, 1.8, 0.7, 0, 0, Math.PI * 2);
      rc.g.fill();
      glowDot(rc.g, d.x, d.y - 5, 12, d.color, 0.4 * pulse);
      for (let i = 0; i < 4; i++) {
        const p = (t * 0.45 + i / 4 + (d.seed % 7) / 7) % 1;
        rc.bg.fillStyle = `rgba(60,50,48,${0.35 * (1 - p) * Math.min(1, p * 5)})`;
        circle(rc.bg, d.x + Math.sin(p * 4 + i) * 3, d.y - 6 - p * 26, 1.8 + p * 6);
      }
      light(rc, d.x, d.y - 4, 50, d.color, 0.6 * pulse);
    },
  },
  obsidian: {
    color: (th) => th.terrain.vein,
    bake(s, d) {
      const k = d.size;
      const pts = poly(-4, 0, -2.5, -6, 0, -9, 1.5, -5, 4, -3, 4.5, 0).map((p) => ({ x: d.x + p.x * k, y: d.y + p.y * k }));
      part(s, pts, hsl3(270, 25, 12), sd(d), { depth: 0.8 * k, thin: 0.45, thick: 1.1 });
      s.fillStyle = css(hsl3(260, 30, 34));
      path(s, poly(d.x - 2.5 * k, d.y - 6 * k, d.x, d.y - 9 * k, d.x - 0.5 * k, d.y - 2 * k));
      s.fill();
      glint(s, poly(d.x - 1.8 * k, d.y - 6 * k, d.x - 0.4 * k, d.y - 8 * k), 'rgba(220,210,255,0.8)', 0.5);
    },
    live(rc, d) {
      const k = d.size;
      const pulse = 0.5 + Math.sin(rc.t * 1.7 + d.seed) * 0.3;
      rc.g.fillStyle = css(d.color, 5, 0.8 * pulse);
      line(rc.g, d.x - 3 * k, d.y, d.x + 1.5 * k, d.y - 5 * k, { w: 0.8, seed: sd(d), taper: [0.1, 0.3], press: 0 });
    },
  },

  // ---- harbor ------------------------------------------------------------
  rope: {
    color: () => hsl3(38, 40, 58),
    bake(s, d) {
      const k = d.size;
      for (let i = 0; i < 3; i++) {
        const ring = ovalPts(d.x, d.y - 1.5 - i * 1.3, (5 - i * 1.2) * k, 1.5 * k, sd(d) + i, 0.04, 16);
        s.fillStyle = INK;
        stroke(s, [...ring, ring[0]], { w: 1.8, seed: i, taper: [0, 0], press: 0.1 });
        s.fillStyle = css(d.color, -14 + i * 8);
        stroke(s, [...ring, ring[0]], { w: 1.2, seed: i, taper: [0, 0], press: 0.1 });
      }
    },
  },
  bollard: {
    color: () => hsl3(215, 10, 26),
    bake(s, d) {
      const c = d.color;
      const body = boxPts(d.x - 3, d.y - 7, 6, 7.5, 2.4, sd(d), 0.1);
      part(s, body, shift(c, 4), sd(d), { depth: 0.9, thin: 0.45, thick: 1.1 });
      box(s, d.x - 3.6, d.y - 5, 7.2, 1.6, c, sd(d) + 1, 0.4);
      glint(s, poly(d.x - 1.6, d.y - 6, d.x - 1.6, d.y - 1.4), css(c, 22), 0.6);
    },
  },
  lamppost: {
    color: (th) => th.lamp,
    bake(s, d) {
      const h = 26;
      stick(s, poly(d.x, d.y, d.x, d.y - h), 1.8, css(IRON, 6), sd(d));
      box(s, d.x - 2, d.y - 3, 4, 3, IRON, sd(d) + 1, 0.4);
      box(s, d.x - 3, d.y - h - 1, 6, 1.4, IRON, sd(d) + 2, 0.3);
      part(s, poly(d.x - 3.2, d.y - h - 5, d.x, d.y - h - 7.6, d.x + 3.2, d.y - h - 5), IRON, sd(d) + 3, { depth: 0.3, thin: 0.35, thick: 0.7 });
    },
    live(rc, d, th) {
      const h = 26;
      const fl = 0.92 + Math.sin(rc.t * 7 + d.seed) * 0.05;
      const on = th.night || th.mood === 'golden' || th.mood === 'dusk' ? 1 : 0.35;
      rc.s.fillStyle = INK;
      rc.s.fillRect(d.x - 2.8, d.y - h - 5.2, 5.6, 4.6);
      rc.s.fillStyle = css(d.color, 25, 0.95);
      rc.s.fillRect(d.x - 2.2, d.y - h - 4.8, 4.4, 3.8);
      rc.g.fillStyle = css(d.color, 15, fl * on);
      rc.g.fillRect(d.x - 2.2, d.y - h - 4.8, 4.4, 3.8);
      glowDot(rc.g, d.x, d.y - h - 3, 9, d.color, 0.35 * fl * on);
      light(rc, d.x, d.y - h - 2, 95, d.color, 0.95 * fl * on);
    },
  },
  gull: {
    color: () => hsl3(210, 10, 94),
    live(rc, d) {
      const s = rc.s;
      const t = rc.t + d.seed;
      const peck = Math.max(0, Math.sin(t * 1.3)) > 0.92 ? 1.2 : 0;
      const dir = d.flip ? -1 : 1;
      s.fillStyle = css(hsl3(30, 70, 50));
      s.fillRect(d.x - 0.5, d.y - 2, 0.6, 2);
      s.fillRect(d.x + 1, d.y - 2, 0.6, 2);
      s.fillStyle = INK;
      s.beginPath();
      s.ellipse(d.x + 0.5, d.y - 3.6, 3.9, 2.5, 0, 0, Math.PI * 2);
      s.fill();
      circle(s, d.x + dir * 3, d.y - 5.4 + peck, 2);
      s.fillStyle = css(d.color);
      s.beginPath();
      s.ellipse(d.x + 0.5, d.y - 3.6, 3.4, 2, 0, 0, Math.PI * 2);
      s.fill();
      s.fillStyle = css(hsl3(215, 12, 55));
      s.beginPath();
      s.ellipse(d.x - dir * 0.6, d.y - 4, 2.4, 1.2, -0.2 * dir, 0, Math.PI * 2);
      s.fill();
      s.fillStyle = css(d.color);
      circle(s, d.x + dir * 3, d.y - 5.4 + peck, 1.5);
      s.fillStyle = '#f2b630';
      s.fillRect(d.x + dir * 4.2 - (dir < 0 ? 1.6 : 0), d.y - 5.4 + peck, 1.6, 0.7);
      s.fillStyle = '#111';
      s.fillRect(d.x + dir * 3.3, d.y - 6 + peck, 0.6, 0.6);
    },
  },
  net: {
    color: () => hsl3(35, 20, 55),
    bake(s, d) {
      const w = 12;
      const h = 9 + (d.seed % 5);
      s.fillStyle = css(d.color, -6);
      for (let i = 0; i <= 4; i++) {
        const pts: P[] = [];
        const ax = d.x - w / 2 + (i * w) / 4;
        const cx = d.x - w / 4 + (i * w) / 8;
        const ex = d.x - 1 + i * 0.5;
        for (let j = 0; j <= 6; j++) {
          const t = j / 6;
          const u = 1 - t;
          pts.push({ x: u * u * ax + 2 * u * t * cx + t * t * ex, y: u * u * d.y + 2 * u * t * (d.y + h * 0.7) + t * t * (d.y + h) });
        }
        stroke(s, pts, { w: 0.55, seed: i, taper: [0.1, 0.3], press: 0.2 });
      }
      for (let j = 1; j <= 3; j++) {
        const yy = d.y + (j * h) / 4;
        const pts: P[] = [];
        for (let q = 0; q <= 6; q++) {
          const t = q / 6;
          const u = 1 - t;
          pts.push({
            x: u * u * (d.x - w / 2 + j) + 2 * u * t * d.x + t * t * (d.x + w / 2 - j),
            y: u * u * (yy - 1) + 2 * u * t * (yy + 2) + t * t * (yy - 1),
          });
        }
        stroke(s, pts, { w: 0.5, seed: j + 9, taper: [0.1, 0.1], press: 0.2 });
      }
      ball(s, d.x - 1 + 1, d.y + h + 0.6, 1.2, hsl3(10, 70, 50), sd(d));
    },
  },

  // ---- mine --------------------------------------------------------------
  support: {
    color: () => WOOD,
    bake(s, d) {
      const h = 20;
      const c = d.color;
      for (const dx of [-6, 6]) box(s, d.x + dx - 1.6, d.y - h, 3.2, h, shift(c, 2), sd(d) + dx, 0.5);
      for (const dx of [-1, 1]) stick(s, poly(d.x + dx * 6, d.y - h + 5, d.x + dx * 2, d.y - h), 1.2, css(c, -6), sd(d) + dx * 3);
      box(s, d.x - 9, d.y - h - 3.4, 18, 4, shift(c, 4), sd(d) + 9, 0.6);
      for (const nx of [-7.5, 7.5]) dot(s, d.x + nx, d.y - h - 1.4, 0.45, nx);
    },
  },
  minecart: {
    color: () => hsl3(20, 25, 32),
    bake(s, d) {
      const c = d.color;
      stick(s, poly(d.x - 9, d.y - 0.6, d.x + 9, d.y - 0.6), 0.8, css(IRON, 10), sd(d));
      const ore: P[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        ore.push({ x: d.x + Math.cos(a) * 5, y: d.y - 9.4 + Math.sin(a) * 2.4 });
      }
      part(s, ore, hsl3(30, 10, 30), sd(d) + 1, { depth: 0.5, thin: 0.35, thick: 0.8 });
      part(s, poly(d.x - 7, d.y - 9.4, d.x + 7, d.y - 9.4, d.x + 5.5, d.y - 3, d.x - 5.5, d.y - 3), c, sd(d) + 2, { depth: 0.8, thin: 0.45, thick: 1.1 });
      s.fillStyle = INK;
      s.fillRect(d.x - 7, d.y - 9.6, 14, 1.4);
      for (const wx of [-3.5, 3.5]) ball(s, d.x + wx, d.y - 2.2, 1.6, hsl3(220, 8, 18), wx + 9);
    },
    live(rc, d, th) {
      rc.g.fillStyle = css(th.terrain.vein, 15, 0.9);
      rc.g.fillRect(d.x + 0.5, d.y - 11, 1.2, 1.2);
      rc.g.fillRect(d.x - 2.5, d.y - 10.2, 1, 1);
    },
  },
  pickaxe: {
    color: () => hsl3(215, 8, 60),
    bake(s, d) {
      const dir = d.flip ? -1 : 1;
      stick(s, poly(d.x - dir * 4, d.y, d.x + dir * 3, d.y - 10), 1.1, css(WOOD, 8), sd(d));
      const head: P[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const u = 1 - t;
        head.push({ x: d.x + dir * (u * u * -1 + 2 * u * t * 3 + t * t * 7), y: u * u * (d.y - 11.5) + 2 * u * t * (d.y - 11.5) + t * t * (d.y - 7) });
      }
      stick(s, head, 1.3, css(d.color), sd(d) + 1);
    },
  },

  // ---- rooftops ----------------------------------------------------------
  antenna: {
    color: () => hsl3(0, 100, 55),
    bake(s, d) {
      const h = 20 + (d.seed % 14);
      const c = css(IRON, 14);
      stick(s, poly(d.x, d.y, d.x, d.y - h), 0.8, c, sd(d));
      for (let i = 1; i <= 3; i++) stick(s, poly(d.x - 5 + i, d.y - h + i * 5, d.x + 5 - i, d.y - h + i * 5), 0.6, c, sd(d) + i);
      stick(s, poly(d.x - 4, d.y, d.x, d.y - h * 0.5, d.x + 4, d.y), 0.5, c, sd(d) + 9);
    },
    live(rc, d) {
      const h = 20 + (d.seed % 14);
      const on = (rc.t * 0.8 + (d.seed % 10) / 10) % 1 < 0.3 ? 1 : 0.1;
      bulb(rc.g, d.x, d.y - h - 1, 1.2, d.color, on);
      if (on > 0.5) light(rc, d.x, d.y - h, 30, d.color, 0.4);
    },
  },
  acunit: {
    color: () => hsl3(210, 6, 58),
    bake(s, d) {
      const w = 12;
      const h = 9;
      box(s, d.x - w / 2, d.y - h, w, h, d.color, sd(d), 1);
      s.fillStyle = INK;
      circle(s, d.x + 1.5, d.y - h / 2, 3.7);
      s.fillStyle = css(d.color, -34);
      circle(s, d.x + 1.5, d.y - h / 2, 3.2);
      for (let i = 0; i < 4; i++) tick(s, d.x - w / 2 + 1, d.y - h + 2.3 + i * 1.6, d.x - w / 2 + 3.4, d.y - h + 2.3 + i * 1.6, 0.5, i);
    },
    live(rc, d) {
      const s = rc.s;
      const a = rc.t * 9 + d.seed;
      s.fillStyle = css(d.color, 4);
      for (let i = 0; i < 3; i++) {
        const b = a + (i * Math.PI * 2) / 3;
        line(s, d.x + 1.5, d.y - 4.5, d.x + 1.5 + Math.cos(b) * 2.8, d.y - 4.5 + Math.sin(b) * 2.8, { w: 1, seed: i, taper: [0, 0.4], press: 0 });
      }
    },
  },
  neon: {
    color: (th, rng) => (rng.chance(0.5) ? (th.layers[th.layers.length - 1]?.detail ?? th.accent) : hsl3(rng.pick([190, 320, 50, 140]), 100, 60)),
    bake(s, d) {
      for (const lx of [-4.5, 4.5]) stick(s, poly(d.x + lx, d.y, d.x + lx, d.y - 4), 0.8, css(IRON, 6), sd(d) + lx);
      part(s, boxPts(d.x - 8, d.y - 15, 16, 11, 1.5, sd(d), 0.1), hsl3(250, 25, 9), sd(d), { depth: 0.6, thin: 0.45, thick: 1 });
    },
    live(rc, d) {
      const g = rc.g;
      const flick = Math.sin(rc.t * 23 + d.seed) > 0.96 || (rc.t + d.seed) % 7 < 0.12 ? 0.25 : 1;
      g.strokeStyle = css(d.color, 15, flick);
      g.lineWidth = 1;
      g.lineCap = 'round';
      g.beginPath();
      // Simple glyph: a tiny abstract icon (cup, star or arrow) by seed.
      const v = d.seed % 3;
      const cx = d.x;
      const cy = d.y - 9.5;
      if (v === 0) {
        g.moveTo(cx - 3, cy - 3);
        g.lineTo(cx - 2, cy + 3);
        g.lineTo(cx + 2, cy + 3);
        g.lineTo(cx + 3, cy - 3);
        g.moveTo(cx + 3, cy - 1);
        g.arc(cx + 4, cy, 1.2, -Math.PI / 2, Math.PI / 2);
      } else if (v === 1) {
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
          const px = cx + Math.cos(a) * 3.6;
          const py = cy + Math.sin(a) * 3.6;
          if (i) g.lineTo(px, py);
          else g.moveTo(px, py);
        }
        g.closePath();
      } else {
        g.moveTo(cx - 5, cy);
        g.lineTo(cx + 4, cy);
        g.moveTo(cx + 1, cy - 3);
        g.lineTo(cx + 4, cy);
        g.lineTo(cx + 1, cy + 3);
      }
      g.stroke();
      glowDot(g, cx, cy, 9, d.color, 0.25 * flick);
      light(rc, cx, cy, 60, d.color, 0.7 * flick);
    },
  },
  dish: {
    color: () => hsl3(210, 8, 78),
    bake(s, d) {
      const dir = d.flip ? -1 : 1;
      stick(s, poly(d.x, d.y, d.x, d.y - 6), 0.9, css(IRON, 10), sd(d));
      s.save();
      s.translate(d.x + dir * 1.2, d.y - 9.2);
      s.rotate(-0.6 * dir);
      part(s, ovalPts(0, 0, 6, 2.6, sd(d), 0.02, 18), d.color, sd(d) + 1, { depth: 0.8, thin: 0.45, thick: 1 });
      s.restore();
      stick(s, poly(d.x + dir * 1.4, d.y - 9.4, d.x + dir * 5, d.y - 13), 0.5, css(IRON, 14), sd(d) + 2);
      dot(s, d.x + dir * 5, d.y - 13, 0.6, sd(d) + 3);
    },
  },
  ...FRONTIER_DECOR,
  ...CASTLE_DECOR,
  ...FARM_DECOR,
  ...VOLCANO_DECOR,
  ...HARBOR_DECOR,
  ...JUNGLE_DECOR,
  ...MINE_DECOR,
  ...ROOFTOPS_DECOR,
  ...SPACE_DECOR,
  ...GLACIER_DECOR,
};
