import { css, type HSL, hsl3, shift } from '../core/color';
import type { Rng } from '../core/rng';
import type { DecorKind, Theme } from '../gen/theme';
import { FRONTIER_DECOR } from './decor-frontier';
import { circle, ellipse, flame, glowDot, light, type RC } from './kit';

/**
 * Terrain decor registry. Each kind says where it grows (on top of ground or
 * hanging under ceilings), how wide it is in tiles, and how to draw it:
 *   - `bake`: static parts, painted once into the terrain bake (cheap),
 *   - `live`: animated / emissive parts, drawn every frame.
 * Decor is purely cosmetic and stays small so it never reads as a hazard.
 */

export interface Decor {
  kind: DecorKind;
  x: number;
  y: number;
  /** Tile that must stay solid for this decor to exist. */
  tx: number;
  ty: number;
  seed: number;
  size: number;
  /** Tiles spanned (fences). */
  span: number;
  color: HSL;
  flip: boolean;
}

export interface DecorDef {
  place: 'top' | 'under';
  /** Relative pick weight within a theme's decor list. */
  weight: number;
  /** Needs this many empty tiles above (top) / below (under). */
  clear: number;
  color(th: Theme, rng: Rng): HSL;
  bake?(s: CanvasRenderingContext2D, d: Decor, th: Theme): void;
  live?(rc: RC, d: Decor, th: Theme): void;
}

const WOOD: HSL = hsl3(28, 40, 34);
const IRON: HSL = hsl3(220, 8, 22);
const k01 = (d: Decor, n: number) => ((d.seed >>> n) % 1000) / 1000;

function box(s: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: HSL, edge = -14) {
  s.fillStyle = css(c, edge);
  s.fillRect(x - 0.5, y - 0.5, w + 1, h + 1);
  s.fillStyle = css(c);
  s.fillRect(x, y, w, h);
  s.fillStyle = css(c, 12, 0.7);
  s.fillRect(x, y, w, 1);
}

function steam(rc: RC, x: number, y: number, seed: number, scale = 1, a = 0.28) {
  const t = rc.t;
  for (let i = 0; i < 4; i++) {
    const p = (t * 0.55 + i / 4 + (seed % 10) / 10) % 1;
    rc.s.fillStyle = `rgba(225,228,236,${a * (1 - p) * Math.min(1, p * 6)})`;
    circle(rc.s, x + Math.sin(p * 5 + i + seed) * 2.5 * scale, y - p * 16 * scale, (1.4 + p * 3.6) * scale);
  }
}

export const DECOR: Record<DecorKind, DecorDef> = {
  // ---- generic -----------------------------------------------------------
  crystal: {
    place: 'top',
    weight: 1,
    clear: 1,
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
        const tx = bx + Math.cos(a) * len;
        const ty = by + Math.sin(a) * len;
        const nx = -Math.sin(a) * w;
        const ny = Math.cos(a) * w;
        s.fillStyle = css(d.color, -14);
        s.beginPath();
        s.moveTo(bx - nx, by - ny);
        s.lineTo(tx, ty);
        s.lineTo(bx + nx, by + ny);
        s.fill();
        s.fillStyle = css(d.color, 18);
        s.beginPath();
        s.moveTo(bx, by);
        s.lineTo(tx, ty);
        s.lineTo(bx + nx, by + ny);
        s.fill();
        rc.g.strokeStyle = css(d.color, 15, 0.7);
        rc.g.lineWidth = 0.8;
        rc.g.beginPath();
        rc.g.moveTo(bx, by);
        rc.g.lineTo(tx, ty);
        rc.g.stroke();
      }
      const pulse = 0.6 + Math.sin(rc.t * 2 + d.seed) * 0.25;
      glowDot(rc.g, d.x, d.y - 4 * k, 12 * k, d.color, 0.3 * pulse);
      light(rc, d.x, d.y - 4, 55 * k, d.color, 0.55 * pulse);
    },
  },
  mushroom: {
    place: 'top',
    weight: 1,
    clear: 1,
    color: (th, rng) => (th.night ? hsl3(rng.pick([190, 280, 320, 100]), 90, 60) : hsl3(rng.pick([0, 10, 30]), 75, 50)),
    bake(s, d, th) {
      const k = d.size;
      const h = 5 * k;
      s.fillStyle = css(hsl3(40, 25, 80), th.night ? -25 : 0);
      s.fillRect(d.x - 0.8, d.y - h, 1.6, h);
      s.fillStyle = css(d.color, -12);
      s.beginPath();
      s.ellipse(d.x, d.y - h, 3.6 * k, 2.6 * k, 0, Math.PI, 0);
      s.fill();
      if (!th.night) {
        s.fillStyle = 'rgba(255,255,255,0.85)';
        circle(s, d.x - 1.2 * k, d.y - h - 1.2 * k, 0.6 * k);
        circle(s, d.x + 1.4 * k, d.y - h - 0.7 * k, 0.5 * k);
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
      glowDot(rc.g, d.x, d.y - h, 9 * k, d.color, 0.3 * pulse);
      light(rc, d.x, d.y - h, 40 * k, d.color, 0.5 * pulse);
    },
  },
  flower: {
    place: 'top',
    weight: 1.2,
    clear: 1,
    color: (_th, rng) => hsl3(rng.pick([0, 50, 280, 320, 200, 30]), 80, 64),
    live(rc, d, th) {
      const s = rc.s;
      const k = d.size;
      const h = 6 * k;
      const sw = Math.sin(rc.t * 2 + d.seed) * 1.2;
      s.strokeStyle = css(th.terrain.capColor, -12);
      s.lineWidth = 0.9;
      s.beginPath();
      s.moveTo(d.x, d.y);
      s.quadraticCurveTo(d.x + sw * 0.5, d.y - h / 2, d.x + sw, d.y - h);
      s.stroke();
      s.fillStyle = css(d.color);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + d.seed;
        circle(s, d.x + sw + Math.cos(a) * 1.6 * k, d.y - h + Math.sin(a) * 1.6 * k, 1.2 * k);
      }
      s.fillStyle = '#ffe680';
      circle(s, d.x + sw, d.y - h, 0.9 * k);
    },
  },
  lantern: {
    place: 'under',
    weight: 1,
    clear: 1,
    color: (th) => th.lamp,
    live(rc, d) {
      const s = rc.s;
      const k = d.size;
      const len = 5 * k + (d.seed % 6);
      const sw = Math.sin(rc.t * 1.3 + d.seed) * 0.12;
      const lx = d.x + Math.sin(sw) * len;
      const ly = d.y + Math.cos(sw) * len;
      s.strokeStyle = 'rgba(25,22,20,0.95)';
      s.lineWidth = 0.7;
      s.beginPath();
      s.moveTo(d.x, d.y);
      s.lineTo(lx, ly);
      s.stroke();
      s.fillStyle = '#2b2622';
      s.fillRect(lx - 2.5, ly, 5, 1.3);
      s.fillRect(lx - 2.5, ly + 6, 5, 1.3);
      s.fillStyle = css(d.color, 20, 0.85);
      s.fillRect(lx - 2, ly + 1.3, 4, 4.7);
      s.fillStyle = '#2b2622';
      s.fillRect(lx - 0.3, ly + 1.3, 0.6, 4.7);
      const fl = 0.85 + Math.sin(rc.t * 9 + d.seed) * 0.08;
      rc.g.fillStyle = css(d.color, 10, 0.9 * fl);
      rc.g.fillRect(lx - 2, ly + 1.3, 4, 4.7);
      glowDot(rc.g, lx, ly + 3.5, 14 * k, d.color, 0.4 * fl);
      light(rc, lx, ly + 3.5, 80 * k, d.color, 0.9 * fl);
    },
  },
  vine: {
    place: 'under',
    weight: 1.6,
    clear: 1,
    color: (th) => shift(th.terrain.capColor, -6),
    live(rc, d) {
      const s = rc.s;
      const k = d.size;
      const segs = 4 + (d.seed % 7);
      const sx = (i: number) => d.x + Math.sin(rc.t * 1.1 + i * 0.6 + d.seed) * i * 0.32;
      s.strokeStyle = css(d.color, -8);
      s.lineWidth = 1.1;
      s.beginPath();
      s.moveTo(d.x, d.y);
      for (let i = 1; i <= segs; i++) s.lineTo(sx(i), d.y + i * 2.6 * k);
      s.stroke();
      for (let i = 1; i <= segs; i++) {
        s.fillStyle = css(d.color, (i % 3) * 5);
        ellipse(s, sx(i) + (i % 2 ? 1.6 : -1.6), d.y + i * 2.6 * k, 1.9, 1, i % 2 ? 0.5 : -0.5);
      }
    },
  },
  bones: {
    place: 'top',
    weight: 0.6,
    clear: 1,
    color: () => hsl3(40, 25, 80),
    bake(s, d) {
      const k = d.size;
      s.strokeStyle = css(d.color, -4);
      s.lineCap = 'round';
      s.lineWidth = 1.3 * k;
      s.beginPath();
      s.moveTo(d.x - 4 * k, d.y - 0.8);
      s.lineTo(d.x + 4 * k, d.y - 1.8);
      s.moveTo(d.x - 2 * k, d.y - 2.8);
      s.lineTo(d.x + 3 * k, d.y - 0.6);
      s.stroke();
      s.fillStyle = css(d.color);
      for (const [x, y] of [
        [-4, -0.8],
        [4, -1.8],
      ])
        circle(s, d.x + x * k, d.y + y, 1.1 * k);
    },
  },
  torch: {
    place: 'top',
    weight: 1,
    clear: 2,
    color: (th) => th.lamp,
    bake(s, d) {
      const k = d.size;
      s.fillStyle = css(WOOD, -10);
      s.fillRect(d.x - 1, d.y - 9 * k, 2, 9 * k);
      s.fillStyle = css(IRON, 8);
      s.fillRect(d.x - 2.2, d.y - 10 * k, 4.4, 2);
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
    place: 'top',
    weight: 1,
    clear: 2,
    color: () => hsl3(25, 30, 34),
    bake(s, d) {
      const k = d.size;
      const c = d.seed % 2 ? hsl3(25, 30, 34) : hsl3(150, 18, 32);
      s.fillStyle = css(c, -12);
      s.fillRect(d.x - 2, d.y - 10 * k, 4, 10 * k);
      const gr = s.createLinearGradient(d.x - 2, 0, d.x + 2, 0);
      gr.addColorStop(0, css(c, 8));
      gr.addColorStop(1, css(c, -10));
      s.fillStyle = gr;
      s.fillRect(d.x - 1.5, d.y - 10 * k, 3, 10 * k);
      s.fillStyle = css(c, 14);
      s.fillRect(d.x - 3, d.y - 11 * k, 6, 2);
      s.fillRect(d.x - 2.5, d.y - 4 * k, 5, 1.2);
    },
    live(rc, d) {
      steam(rc, d.x, d.y - 11 * d.size, d.seed, d.size);
    },
  },

  // ---- farm --------------------------------------------------------------
  fence: {
    place: 'top',
    weight: 1.4,
    clear: 1,
    color: () => hsl3(32, 30, 58),
    bake(s, d) {
      const w = d.span * 16;
      const x0 = d.x;
      const c = d.color;
      s.fillStyle = css(c, -22);
      for (const ry of [-8, -4.5]) s.fillRect(x0 - 1, d.y + ry - 0.5, w + 2, 2.4);
      s.fillStyle = css(c, -4);
      for (const ry of [-8, -4.5]) s.fillRect(x0 - 1, d.y + ry, w + 2, 1.6);
      for (let i = 0; i <= d.span; i++) {
        const px = x0 + i * 16 - (i === d.span ? 2 : 0);
        s.fillStyle = css(c, -24);
        s.fillRect(px - 0.4, d.y - 11, 2.8, 11);
        s.fillStyle = css(c, 2);
        s.fillRect(px, d.y - 11, 2, 11);
        s.fillStyle = css(c, 16);
        s.fillRect(px, d.y - 11, 2, 1);
      }
    },
  },
  haybale: {
    place: 'top',
    weight: 1,
    clear: 1,
    color: () => hsl3(44, 70, 58),
    bake(s, d) {
      const k = d.size;
      const w = 11 * k;
      const h = 8 * k;
      const x = d.x - w / 2;
      const y = d.y - h;
      s.fillStyle = css(d.color, -30);
      s.beginPath();
      s.roundRect(x - 0.6, y - 0.6, w + 1.2, h + 1.2, 2.5);
      s.fill();
      const gr = s.createLinearGradient(0, y, 0, y + h);
      gr.addColorStop(0, css(d.color, 12));
      gr.addColorStop(1, css(d.color, -14));
      s.fillStyle = gr;
      s.beginPath();
      s.roundRect(x, y, w, h, 2.2);
      s.fill();
      s.strokeStyle = css(d.color, -22, 0.6);
      s.lineWidth = 0.5;
      for (let i = 1; i < 6; i++) {
        s.beginPath();
        s.moveTo(x + 1, y + (i * h) / 6);
        s.lineTo(x + w - 1, y + (i * h) / 6 + ((i % 2) - 0.5));
        s.stroke();
      }
      s.fillStyle = css(hsl3(15, 50, 30));
      s.fillRect(x + w * 0.3, y, 1, h);
      s.fillRect(x + w * 0.7, y, 1, h);
    },
  },
  wheat: {
    place: 'top',
    weight: 1.6,
    clear: 1,
    color: (_th, rng) => hsl3(rng.range(40, 50), 70, 58),
    live(rc, d) {
      const s = rc.s;
      s.lineWidth = 0.8;
      for (let i = 0; i < 6; i++) {
        const bx = d.x - 5 + i * 2 + k01(d, i) * 1.2;
        const h = 7 + k01(d, i + 3) * 5;
        const sw = Math.sin(rc.t * 1.8 + bx * 0.2) * 1.5;
        s.strokeStyle = css(d.color, -15);
        s.beginPath();
        s.moveTo(bx, d.y);
        s.quadraticCurveTo(bx + sw * 0.4, d.y - h / 2, bx + sw, d.y - h);
        s.stroke();
        s.fillStyle = css(d.color, 6);
        ellipse(s, bx + sw, d.y - h - 1.4, 0.9, 2.2, sw * 0.12);
      }
    },
  },
  pumpkin: {
    place: 'top',
    weight: 0.8,
    clear: 1,
    color: (_th, rng) => hsl3(rng.range(22, 30), 90, 50),
    bake(s, d) {
      const k = d.size;
      const r = 3.6 * k;
      const cy = d.y - r + 0.5;
      s.fillStyle = css(d.color, -22);
      ellipse(s, d.x, cy, r * 1.35 + 0.6, r + 0.6);
      for (const [dx, dl] of [
        [-1.6, -6],
        [1.6, -6],
        [0, 6],
      ]) {
        s.fillStyle = css(d.color, dl);
        ellipse(s, d.x + dx * k, cy, r * 0.7, r);
      }
      s.fillStyle = css(hsl3(90, 50, 28));
      s.fillRect(d.x - 0.6, cy - r - 2, 1.4, 2.5);
    },
  },
  sunflower: {
    place: 'top',
    weight: 0.9,
    clear: 2,
    color: () => hsl3(48, 95, 55),
    live(rc, d, th) {
      const s = rc.s;
      const k = d.size;
      const h = 14 * k;
      const sw = Math.sin(rc.t * 1.2 + d.seed) * 0.8;
      s.strokeStyle = css(th.terrain.capColor, -14);
      s.lineWidth = 1.2;
      s.beginPath();
      s.moveTo(d.x, d.y);
      s.quadraticCurveTo(d.x, d.y - h / 2, d.x + sw, d.y - h);
      s.stroke();
      s.fillStyle = css(th.terrain.capColor, -6);
      ellipse(s, d.x + 2, d.y - h * 0.45, 2.4, 1, 0.5);
      ellipse(s, d.x - 2, d.y - h * 0.3, 2.4, 1, -0.5);
      s.fillStyle = css(d.color);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        ellipse(s, d.x + sw + Math.cos(a) * 2.6 * k, d.y - h + Math.sin(a) * 2.6 * k, 1.5 * k, 0.8 * k, a);
      }
      s.fillStyle = css(hsl3(25, 60, 22));
      circle(s, d.x + sw, d.y - h, 1.7 * k);
    },
  },

  // ---- factory -----------------------------------------------------------
  vent: {
    place: 'top',
    weight: 1,
    clear: 2,
    color: () => hsl3(210, 8, 42),
    bake(s, d) {
      const k = d.size;
      box(s, d.x - 4 * k, d.y - 5 * k, 8 * k, 5 * k, d.color);
      s.fillStyle = css(d.color, -22);
      for (let i = 0; i < 3; i++) s.fillRect(d.x - 3 * k, d.y - 4 * k + i * 1.4 * k, 6 * k, 0.7);
    },
    live(rc, d) {
      steam(rc, d.x, d.y - 5 * d.size, d.seed, d.size * 0.9, 0.22);
    },
  },
  barrel: {
    place: 'top',
    weight: 1.2,
    clear: 1,
    color: (th, rng) => (th.id === 'harbor' ? hsl3(28, 45, 36) : hsl3(rng.pick([5, 210, 120, 45]), 55, 40)),
    bake(s, d, th) {
      const k = d.size;
      const w = 7 * k;
      const h = 9 * k;
      const x = d.x - w / 2;
      const y = d.y - h;
      s.fillStyle = css(d.color, -26);
      s.beginPath();
      s.roundRect(x - 0.6, y - 0.6, w + 1.2, h + 1.2, 1.6);
      s.fill();
      const gr = s.createLinearGradient(x, 0, x + w, 0);
      gr.addColorStop(0, css(d.color, 10));
      gr.addColorStop(0.45, css(d.color, 2));
      gr.addColorStop(1, css(d.color, -16));
      s.fillStyle = gr;
      s.beginPath();
      s.roundRect(x, y, w, h, 1.4);
      s.fill();
      s.fillStyle = css(th.id === 'harbor' ? IRON : d.color, th.id === 'harbor' ? 10 : -20);
      s.fillRect(x, y + h * 0.2, w, 1);
      s.fillRect(x, y + h * 0.72, w, 1);
      if (th.id === 'factory' && d.seed % 3 === 0) {
        s.fillStyle = '#f2c230';
        s.beginPath();
        s.moveTo(d.x, y + h * 0.32);
        s.lineTo(d.x + 1.8, y + h * 0.6);
        s.lineTo(d.x - 1.8, y + h * 0.6);
        s.fill();
      }
    },
  },
  crate: {
    place: 'top',
    weight: 1,
    clear: 1,
    color: () => hsl3(32, 45, 44),
    bake(s, d) {
      const k = d.size;
      const w = 9 * k;
      const x = d.x - w / 2;
      const y = d.y - w;
      box(s, x, y, w, w, d.color, -26);
      s.strokeStyle = css(d.color, -18);
      s.lineWidth = 1;
      s.strokeRect(x + 1, y + 1, w - 2, w - 2);
      s.beginPath();
      s.moveTo(x + 1, y + 1);
      s.lineTo(x + w - 1, y + w - 1);
      s.stroke();
      if (d.seed % 2) {
        box(s, x + w * 0.2, y - w * 0.7, w * 0.7, w * 0.7, shift(d.color, -6), -26);
      }
    },
  },
  beacon: {
    place: 'top',
    weight: 0.7,
    clear: 1,
    color: () => hsl3(32, 100, 55),
    bake(s, d) {
      box(s, d.x - 2.5, d.y - 3, 5, 3, IRON, -6);
    },
    live(rc, d) {
      const a = rc.t * 4 + d.seed;
      rc.s.fillStyle = css(d.color, -10);
      rc.s.beginPath();
      rc.s.arc(d.x, d.y - 3, 2.2, Math.PI, 0);
      rc.s.fill();
      const on = 0.55 + 0.45 * Math.max(0, Math.cos(a));
      glowDot(rc.g, d.x, d.y - 4, 10, d.color, 0.55 * on);
      const g = rc.g;
      const dir = Math.cos(a) > 0 ? 1 : -1;
      const gr = g.createLinearGradient(d.x, 0, d.x + dir * 30, 0);
      gr.addColorStop(0, css(d.color, 10, 0.3 * on));
      gr.addColorStop(1, css(d.color, 0, 0));
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(d.x, d.y - 4);
      g.lineTo(d.x + dir * 30, d.y - 4 - 8 * Math.abs(Math.sin(a)));
      g.lineTo(d.x + dir * 30, d.y - 4 + 6 * Math.abs(Math.sin(a)));
      g.fill();
      light(rc, d.x, d.y - 4, 50, d.color, 0.6 * on);
    },
  },
  chain: {
    place: 'under',
    weight: 1,
    clear: 2,
    color: () => hsl3(220, 6, 40),
    live(rc, d) {
      const s = rc.s;
      const n = 5 + (d.seed % 6);
      const sw = Math.sin(rc.t * 0.9 + d.seed) * 0.08;
      s.lineWidth = 0.9;
      for (let i = 0; i < n; i++) {
        const x = d.x + Math.sin(sw) * i * 2.4;
        const y = d.y + 1.2 + i * 2.4;
        s.strokeStyle = css(d.color, i % 2 ? -10 : 8);
        s.beginPath();
        if (i % 2) s.ellipse(x, y, 0.5, 1.4, sw, 0, Math.PI * 2);
        else s.ellipse(x, y, 1.2, 1.4, sw, 0, Math.PI * 2);
        s.stroke();
      }
      if (d.seed % 3 === 0) {
        const x = d.x + Math.sin(sw) * n * 2.4;
        const y = d.y + n * 2.4 + 1.5;
        s.strokeStyle = css(d.color, 4);
        s.lineWidth = 1.2;
        s.beginPath();
        s.arc(x, y + 1.5, 2, -Math.PI * 0.1, Math.PI * 1.1);
        s.stroke();
      }
    },
  },
  cable: {
    place: 'under',
    weight: 0.8,
    clear: 2,
    color: (_th, rng) => hsl3(rng.pick([0, 210, 50]), 30, 18),
    live(rc, d) {
      const s = rc.s;
      const sag = 8 + (d.seed % 8);
      const sw = Math.sin(rc.t * 0.8 + d.seed) * 1.2;
      s.strokeStyle = css(d.color);
      s.lineWidth = 1.1;
      s.beginPath();
      s.moveTo(d.x - 6, d.y);
      s.quadraticCurveTo(d.x + sw, d.y + sag, d.x + 7, d.y);
      s.stroke();
    },
  },
  cagelamp: {
    place: 'under',
    weight: 0.9,
    clear: 1,
    color: (th) => th.lamp,
    live(rc, d) {
      const s = rc.s;
      s.fillStyle = css(IRON, 4);
      s.fillRect(d.x - 0.5, d.y, 1, 3);
      s.fillRect(d.x - 3, d.y + 3, 6, 1.4);
      const fl = 0.9 + Math.sin(rc.t * 30 + d.seed) * 0.04 + (Math.sin(rc.t * 3.1 + d.seed) > 0.97 ? -0.5 : 0);
      rc.g.fillStyle = css(d.color, 15, fl);
      rc.g.beginPath();
      rc.g.arc(d.x, d.y + 4.4, 2.4, 0, Math.PI);
      rc.g.fill();
      s.strokeStyle = css(IRON, 0);
      s.lineWidth = 0.5;
      s.beginPath();
      s.arc(d.x, d.y + 4.4, 2.8, 0, Math.PI);
      s.moveTo(d.x, d.y + 4.4);
      s.lineTo(d.x, d.y + 7.2);
      s.stroke();
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
    place: 'under',
    weight: 1.2,
    clear: 2,
    color: (th) => th.layers[th.layers.length - 1]?.detail ?? hsl3(0, 60, 40),
    live(rc, d) {
      const s = rc.s;
      const w = 7 * d.size;
      const h = 14 * d.size;
      const t = rc.t;
      s.fillStyle = css(WOOD, -6);
      s.fillRect(d.x - w / 2 - 1.5, d.y + 0.5, w + 3, 1.6);
      const wave = (i: number) => Math.sin(t * 2 + d.seed + i * 0.7) * 0.8 * (i / 6);
      s.fillStyle = css(d.color);
      s.beginPath();
      s.moveTo(d.x - w / 2, d.y + 2);
      s.lineTo(d.x + w / 2, d.y + 2);
      for (let i = 0; i <= 6; i++) s.lineTo(d.x + w / 2 + wave(i), d.y + 2 + (h * i) / 6);
      s.lineTo(d.x + wave(6), d.y + 2 + h - 3);
      for (let i = 6; i >= 0; i--) s.lineTo(d.x - w / 2 + wave(i), d.y + 2 + (h * i) / 6);
      s.fill();
      s.fillStyle = css(d.color, -14);
      s.fillRect(d.x - w / 2, d.y + 2, 1.2, h - 1);
      // Emblem.
      s.fillStyle = css(hsl3(45, 90, 60), 0, 0.9);
      s.beginPath();
      const ey = d.y + 2 + h * 0.42 + wave(3) * 0.5;
      s.moveTo(d.x, ey - 2.4);
      s.lineTo(d.x + 2, ey);
      s.lineTo(d.x, ey + 2.4);
      s.lineTo(d.x - 2, ey);
      s.fill();
      s.fillStyle = css(hsl3(45, 90, 60), -10, 0.9);
      s.fillRect(d.x - w / 2, d.y + 3, w, 0.8);
    },
  },
  skull: {
    place: 'top',
    weight: 0.5,
    clear: 1,
    color: () => hsl3(42, 22, 80),
    bake(s, d) {
      const k = d.size;
      s.fillStyle = css(d.color, -30);
      circle(s, d.x, d.y - 2.8 * k, 2.9 * k);
      s.fillStyle = css(d.color);
      circle(s, d.x, d.y - 2.9 * k, 2.5 * k);
      s.fillRect(d.x - 1.5 * k, d.y - 1.6 * k, 3 * k, 1.6 * k);
      s.fillStyle = '#1b1612';
      circle(s, d.x - 0.95 * k, d.y - 3 * k, 0.7 * k);
      circle(s, d.x + 0.95 * k, d.y - 3 * k, 0.7 * k);
    },
  },

  // ---- jungle ------------------------------------------------------------
  fern: {
    place: 'top',
    weight: 1.6,
    clear: 1,
    color: (th, rng) => shift(th.terrain.capColor, rng.range(-4, 8), 0, rng.range(-10, 10)),
    live(rc, d) {
      const s = rc.s;
      const k = d.size;
      const n = 5;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.42 + Math.sin(rc.t * 1.4 + d.seed + i) * 0.06;
        const len = (8 + (i % 2) * 3) * k;
        const ex = d.x + Math.cos(a) * len;
        const ey = d.y + Math.sin(a) * len * 0.9;
        const cx = d.x + Math.cos(a) * len * 0.5 + Math.cos(a) * 2;
        const cy = d.y + Math.sin(a) * len * 0.7 - 2;
        s.strokeStyle = css(d.color, -14);
        s.lineWidth = 0.8;
        s.beginPath();
        s.moveTo(d.x, d.y);
        s.quadraticCurveTo(cx, cy, ex, ey + Math.abs(Math.cos(a)) * 3);
        s.stroke();
        s.fillStyle = css(d.color, (i % 2) * 6);
        for (let j = 1; j < 5; j++) {
          const p = j / 5;
          const px = d.x + (ex - d.x) * p;
          const py = d.y + (ey - d.y) * p + Math.abs(Math.cos(a)) * 3 * p * p;
          ellipse(s, px, py, 1.7 * (1 - p * 0.5), 0.8, a + 1.2);
          ellipse(s, px, py, 1.7 * (1 - p * 0.5), 0.8, a - 1.2);
        }
      }
    },
  },
  bigleaf: {
    place: 'top',
    weight: 1,
    clear: 2,
    color: (th) => shift(th.terrain.capColor, 4, 5, -8),
    live(rc, d) {
      const s = rc.s;
      const k = d.size;
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i - 1) * 0.75 + Math.sin(rc.t * 1.1 + d.seed + i * 2) * 0.05;
        const len = (10 + i * 2) * k;
        const ex = d.x + Math.cos(a) * len;
        const ey = d.y + Math.sin(a) * len;
        s.strokeStyle = css(d.color, -18);
        s.lineWidth = 0.9;
        s.beginPath();
        s.moveTo(d.x, d.y);
        s.lineTo(ex, ey);
        s.stroke();
        s.fillStyle = css(d.color, i * 4 - 4);
        ellipse(s, (d.x + ex * 2) / 3 + Math.cos(a) * 2, (d.y + ey * 2) / 3 + Math.sin(a) * 2, len * 0.42, 2.6 * k, a);
        s.strokeStyle = css(d.color, 12, 0.6);
        s.lineWidth = 0.4;
        s.beginPath();
        s.moveTo(d.x + Math.cos(a) * 3, d.y + Math.sin(a) * 3);
        s.lineTo(ex, ey);
        s.stroke();
      }
    },
  },
  roots: {
    place: 'under',
    weight: 1,
    clear: 1,
    color: (th) => shift(th.terrain.dark, 6),
    bake(s, d) {
      s.strokeStyle = css(d.color);
      s.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const x = d.x + (i - 1) * 3;
        const len = 4 + k01(d, i) * 9;
        s.lineWidth = 1.2 - i * 0.2;
        s.beginPath();
        s.moveTo(x, d.y - 1);
        s.quadraticCurveTo(x + (k01(d, i + 2) - 0.5) * 6, d.y + len * 0.6, x + (k01(d, i + 4) - 0.5) * 4, d.y + len);
        s.stroke();
      }
    },
  },

  // ---- volcano -----------------------------------------------------------
  fumarole: {
    place: 'top',
    weight: 1,
    clear: 2,
    color: (th) => th.terrain.vein,
    bake(s, d, th) {
      s.fillStyle = css(th.terrain.dark, -4);
      s.beginPath();
      s.moveTo(d.x - 5, d.y + 0.5);
      s.lineTo(d.x - 2, d.y - 4);
      s.lineTo(d.x + 2, d.y - 4);
      s.lineTo(d.x + 5, d.y + 0.5);
      s.fill();
    },
    live(rc, d) {
      const t = rc.t;
      const pulse = 0.7 + Math.sin(t * 3 + d.seed) * 0.3;
      rc.g.fillStyle = css(d.color, 10, 0.9 * pulse);
      ellipse(rc.g, d.x, d.y - 4, 2, 0.8);
      glowDot(rc.g, d.x, d.y - 5, 12, d.color, 0.4 * pulse);
      for (let i = 0; i < 4; i++) {
        const p = (t * 0.45 + i / 4 + (d.seed % 7) / 7) % 1;
        rc.s.fillStyle = `rgba(60,50,48,${0.35 * (1 - p) * Math.min(1, p * 5)})`;
        circle(rc.s, d.x + Math.sin(p * 4 + i) * 3, d.y - 6 - p * 26, 1.8 + p * 6);
      }
      light(rc, d.x, d.y - 4, 50, d.color, 0.6 * pulse);
    },
  },
  obsidian: {
    place: 'top',
    weight: 1,
    clear: 1,
    color: (th) => th.terrain.vein,
    bake(s, d) {
      const k = d.size;
      const pts = [
        [-4, 0],
        [-2.5, -6],
        [0, -9],
        [1.5, -5],
        [4, -3],
        [4.5, 0],
      ];
      s.fillStyle = css(hsl3(270, 25, 8));
      s.beginPath();
      pts.forEach(([x, y], i) => (i ? s.lineTo(d.x + x * k, d.y + y * k) : s.moveTo(d.x + x * k, d.y + y * k)));
      s.fill();
      s.fillStyle = css(hsl3(260, 30, 30));
      s.beginPath();
      s.moveTo(d.x - 2.5 * k, d.y - 6 * k);
      s.lineTo(d.x, d.y - 9 * k);
      s.lineTo(d.x - 0.5 * k, d.y - 2 * k);
      s.fill();
    },
    live(rc, d) {
      const k = d.size;
      const pulse = 0.5 + Math.sin(rc.t * 1.7 + d.seed) * 0.3;
      rc.g.strokeStyle = css(d.color, 5, 0.8 * pulse);
      rc.g.lineWidth = 0.8;
      rc.g.beginPath();
      rc.g.moveTo(d.x - 3 * k, d.y);
      rc.g.lineTo(d.x + 1.5 * k, d.y - 5 * k);
      rc.g.stroke();
      glowDot(rc.g, d.x, d.y - 1, 8 * k, d.color, 0.25 * pulse);
    },
  },

  // ---- harbor ------------------------------------------------------------
  rope: {
    place: 'top',
    weight: 1,
    clear: 1,
    color: () => hsl3(38, 40, 58),
    bake(s, d) {
      const k = d.size;
      for (let i = 0; i < 3; i++) {
        s.strokeStyle = css(d.color, -20 + i * 8);
        s.lineWidth = 1.5;
        s.beginPath();
        s.ellipse(d.x, d.y - 1.5 - i * 1.3, (5 - i * 1.2) * k, 1.5 * k, 0, 0, Math.PI * 2);
        s.stroke();
      }
    },
  },
  bollard: {
    place: 'top',
    weight: 0.8,
    clear: 1,
    color: () => hsl3(215, 10, 26),
    bake(s, d) {
      const c = d.color;
      s.fillStyle = css(c, -12);
      s.beginPath();
      s.roundRect(d.x - 3, d.y - 7, 6, 7.5, [2.5, 2.5, 0, 0]);
      s.fill();
      s.fillStyle = css(c, 2);
      s.beginPath();
      s.roundRect(d.x - 2.4, d.y - 6.5, 4.8, 7, [2, 2, 0, 0]);
      s.fill();
      s.fillStyle = css(c, -4);
      s.fillRect(d.x - 3.6, d.y - 5, 7.2, 1.6);
      s.fillStyle = css(c, 18, 0.6);
      s.fillRect(d.x - 1.6, d.y - 6, 1, 5);
    },
  },
  lamppost: {
    place: 'top',
    weight: 1,
    clear: 3,
    color: (th) => th.lamp,
    bake(s, d) {
      const h = 26;
      s.fillStyle = css(IRON, -6);
      s.fillRect(d.x - 1, d.y - h, 2, h);
      s.fillRect(d.x - 2, d.y - 3, 4, 3);
      s.fillRect(d.x - 3, d.y - h - 1, 6, 1.4);
      s.beginPath();
      s.moveTo(d.x - 3, d.y - h - 5);
      s.lineTo(d.x, d.y - h - 7.5);
      s.lineTo(d.x + 3, d.y - h - 5);
      s.fill();
    },
    live(rc, d, th) {
      const h = 26;
      const fl = 0.92 + Math.sin(rc.t * 7 + d.seed) * 0.05;
      const on = th.night || th.mood === 'golden' || th.mood === 'dusk' ? 1 : 0.35;
      rc.s.fillStyle = css(d.color, 25, 0.9);
      rc.s.fillRect(d.x - 2.2, d.y - h - 4.8, 4.4, 3.8);
      rc.g.fillStyle = css(d.color, 15, fl * on);
      rc.g.fillRect(d.x - 2.2, d.y - h - 4.8, 4.4, 3.8);
      glowDot(rc.g, d.x, d.y - h - 3, 18, d.color, 0.4 * fl * on);
      light(rc, d.x, d.y - h - 2, 95, d.color, 0.95 * fl * on);
    },
  },
  gull: {
    place: 'top',
    weight: 0.6,
    clear: 1,
    color: () => hsl3(210, 10, 94),
    live(rc, d) {
      const s = rc.s;
      const t = rc.t + d.seed;
      const peck = Math.max(0, Math.sin(t * 1.3)) > 0.92 ? 1.2 : 0;
      const dir = d.flip ? -1 : 1;
      s.fillStyle = css(d.color, -30);
      s.fillRect(d.x - 0.5, d.y - 2, 0.6, 2);
      s.fillRect(d.x + 1, d.y - 2, 0.6, 2);
      s.fillStyle = css(d.color);
      ellipse(s, d.x + 0.5, d.y - 3.6, 3.4, 2);
      s.fillStyle = css(hsl3(215, 12, 55));
      ellipse(s, d.x - dir * 0.6, d.y - 4, 2.4, 1.2, -0.2 * dir);
      s.fillStyle = css(d.color);
      circle(s, d.x + dir * 3, d.y - 5.4 + peck, 1.5);
      s.fillStyle = '#f2b630';
      s.fillRect(d.x + dir * 4.2 - (dir < 0 ? 1.6 : 0), d.y - 5.4 + peck, 1.6, 0.7);
      s.fillStyle = '#111';
      s.fillRect(d.x + dir * 3.3, d.y - 6 + peck, 0.6, 0.6);
    },
  },
  net: {
    place: 'under',
    weight: 0.7,
    clear: 2,
    color: () => hsl3(35, 20, 55),
    bake(s, d) {
      s.strokeStyle = css(d.color, 0, 0.7);
      s.lineWidth = 0.5;
      const w = 12;
      const h = 9 + (d.seed % 5);
      for (let i = 0; i <= 4; i++) {
        s.beginPath();
        s.moveTo(d.x - w / 2 + (i * w) / 4, d.y);
        s.quadraticCurveTo(d.x - w / 4 + (i * w) / 8, d.y + h * 0.7, d.x - 1 + i * 0.5, d.y + h);
        s.stroke();
      }
      for (let j = 1; j <= 3; j++) {
        s.beginPath();
        const yy = d.y + (j * h) / 4;
        s.moveTo(d.x - w / 2 + j, yy - 1);
        s.quadraticCurveTo(d.x, yy + 2, d.x + w / 2 - j, yy - 1);
        s.stroke();
      }
    },
  },

  // ---- mine --------------------------------------------------------------
  support: {
    place: 'top',
    weight: 1,
    clear: 2,
    color: () => WOOD,
    bake(s, d) {
      const h = 20;
      const c = d.color;
      for (const dx of [-6, 6]) {
        s.fillStyle = css(c, -22);
        s.fillRect(d.x + dx - 1.8, d.y - h, 3.6, h);
        s.fillStyle = css(c, 0);
        s.fillRect(d.x + dx - 1.3, d.y - h, 2.6, h);
        s.fillStyle = css(c, 12, 0.6);
        s.fillRect(d.x + dx - 1.3, d.y - h, 0.8, h);
      }
      s.fillStyle = css(c, -22);
      s.fillRect(d.x - 9, d.y - h - 3.4, 18, 4);
      s.fillStyle = css(c, 4);
      s.fillRect(d.x - 8.6, d.y - h - 3, 17.2, 3.2);
      s.strokeStyle = css(c, -16);
      s.lineWidth = 1.4;
      s.beginPath();
      s.moveTo(d.x - 6, d.y - h + 5);
      s.lineTo(d.x - 2, d.y - h);
      s.moveTo(d.x + 6, d.y - h + 5);
      s.lineTo(d.x + 2, d.y - h);
      s.stroke();
    },
  },
  minecart: {
    place: 'top',
    weight: 0.8,
    clear: 1,
    color: () => hsl3(20, 25, 32),
    bake(s, d) {
      const c = d.color;
      s.fillStyle = css(IRON, -6);
      s.fillRect(d.x - 9, d.y - 1, 18, 1);
      s.fillStyle = css(c, -18);
      s.beginPath();
      s.moveTo(d.x - 7, d.y - 9);
      s.lineTo(d.x + 7, d.y - 9);
      s.lineTo(d.x + 5.5, d.y - 3);
      s.lineTo(d.x - 5.5, d.y - 3);
      s.fill();
      s.fillStyle = css(c, 0);
      s.fillRect(d.x - 6, d.y - 8.4, 12, 4.6);
      s.fillStyle = css(c, 12);
      s.fillRect(d.x - 7, d.y - 9.4, 14, 1.2);
      // Ore heap.
      s.fillStyle = css(hsl3(30, 10, 28));
      s.beginPath();
      s.ellipse(d.x, d.y - 9.4, 5, 2.4, 0, Math.PI, 0);
      s.fill();
      s.fillStyle = '#1c1a1a';
      circle(s, d.x - 3.5, d.y - 2.2, 1.6);
      circle(s, d.x + 3.5, d.y - 2.2, 1.6);
    },
    live(rc, d, th) {
      glowDot(rc.g, d.x + 1, d.y - 10.5, 4, th.terrain.vein, 0.5);
      rc.g.fillStyle = css(th.terrain.vein, 15, 0.9);
      rc.g.fillRect(d.x + 0.5, d.y - 11, 1.2, 1.2);
      rc.g.fillRect(d.x - 2.5, d.y - 10.2, 1, 1);
    },
  },
  pickaxe: {
    place: 'top',
    weight: 0.6,
    clear: 1,
    color: () => hsl3(215, 8, 60),
    bake(s, d) {
      const dir = d.flip ? -1 : 1;
      s.strokeStyle = css(WOOD, 4);
      s.lineWidth = 1.3;
      s.beginPath();
      s.moveTo(d.x - dir * 4, d.y);
      s.lineTo(d.x + dir * 3, d.y - 10);
      s.stroke();
      s.strokeStyle = css(d.color);
      s.lineWidth = 1.5;
      s.beginPath();
      s.moveTo(d.x + dir * -1, d.y - 11.5);
      s.quadraticCurveTo(d.x + dir * 3, d.y - 11.5, d.x + dir * 7, d.y - 7);
      s.stroke();
    },
  },

  // ---- rooftops ----------------------------------------------------------
  antenna: {
    place: 'top',
    weight: 1,
    clear: 3,
    color: () => hsl3(0, 100, 55),
    bake(s, d) {
      const h = 20 + (d.seed % 14);
      s.strokeStyle = css(IRON, 6);
      s.lineWidth = 1;
      s.beginPath();
      s.moveTo(d.x, d.y);
      s.lineTo(d.x, d.y - h);
      for (let i = 1; i <= 3; i++) {
        const y = d.y - h + i * 5;
        s.moveTo(d.x - 5 + i, y);
        s.lineTo(d.x + 5 - i, y);
      }
      s.moveTo(d.x - 4, d.y);
      s.lineTo(d.x, d.y - h * 0.5);
      s.lineTo(d.x + 4, d.y);
      s.stroke();
    },
    live(rc, d) {
      const h = 20 + (d.seed % 14);
      const on = (rc.t * 0.8 + (d.seed % 10) / 10) % 1 < 0.3 ? 1 : 0.1;
      rc.g.fillStyle = css(d.color, 10, on);
      circle(rc.g, d.x, d.y - h - 1, 1.2);
      glowDot(rc.g, d.x, d.y - h - 1, 8, d.color, 0.5 * on);
      if (on > 0.5) light(rc, d.x, d.y - h, 30, d.color, 0.4);
    },
  },
  acunit: {
    place: 'top',
    weight: 1,
    clear: 1,
    color: () => hsl3(210, 6, 58),
    bake(s, d) {
      const w = 12;
      const h = 9;
      box(s, d.x - w / 2, d.y - h, w, h, d.color, -28);
      s.fillStyle = css(d.color, -30);
      circle(s, d.x + 1.5, d.y - h / 2, 3.4);
      s.fillStyle = css(d.color, -12);
      for (let i = 0; i < 4; i++) s.fillRect(d.x - w / 2 + 1, d.y - h + 2 + i * 1.6, 2.4, 0.7);
    },
    live(rc, d) {
      const s = rc.s;
      const a = rc.t * 9 + d.seed;
      s.strokeStyle = css(d.color, -2);
      s.lineWidth = 1;
      s.beginPath();
      for (let i = 0; i < 3; i++) {
        const b = a + (i * Math.PI * 2) / 3;
        s.moveTo(d.x + 1.5, d.y - 4.5);
        s.lineTo(d.x + 1.5 + Math.cos(b) * 2.8, d.y - 4.5 + Math.sin(b) * 2.8);
      }
      s.stroke();
    },
  },
  neon: {
    place: 'top',
    weight: 0.9,
    clear: 2,
    color: (th, rng) => (rng.chance(0.5) ? (th.layers[th.layers.length - 1]?.detail ?? th.accent) : hsl3(rng.pick([190, 320, 50, 140]), 100, 60)),
    bake(s, d) {
      s.fillStyle = css(IRON, -4);
      s.fillRect(d.x - 5, d.y - 4, 1, 4);
      s.fillRect(d.x + 4, d.y - 4, 1, 4);
      s.fillStyle = 'rgba(12,10,18,0.92)';
      s.beginPath();
      s.roundRect(d.x - 8, d.y - 15, 16, 11, 1.5);
      s.fill();
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
      glowDot(g, cx, cy, 14, d.color, 0.3 * flick);
      light(rc, cx, cy, 60, d.color, 0.7 * flick);
    },
  },
  dish: {
    place: 'top',
    weight: 0.7,
    clear: 2,
    color: () => hsl3(210, 8, 78),
    bake(s, d) {
      const dir = d.flip ? -1 : 1;
      s.fillStyle = css(IRON, 6);
      s.fillRect(d.x - 0.6, d.y - 6, 1.2, 6);
      s.fillStyle = css(d.color, -20);
      s.beginPath();
      s.ellipse(d.x + dir * 1, d.y - 9, 6, 2.6, -0.6 * dir, 0, Math.PI * 2);
      s.fill();
      s.fillStyle = css(d.color);
      s.beginPath();
      s.ellipse(d.x + dir * 1.4, d.y - 9.4, 5.2, 2, -0.6 * dir, 0, Math.PI * 2);
      s.fill();
      s.strokeStyle = css(IRON, 10);
      s.lineWidth = 0.6;
      s.beginPath();
      s.moveTo(d.x + dir * 1.4, d.y - 9.4);
      s.lineTo(d.x + dir * 5, d.y - 13);
      s.stroke();
    },
  },
  ...FRONTIER_DECOR,
};
