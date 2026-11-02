import { css, type HSL } from '../core/color';
import type { Cell, Vec } from '../core/geom';
import { hash2 } from '../core/rng';
import { TILE } from '../sim/constants';
import type { Material, PropStyle } from '../sim/props';
import { blob, type EdgeP, line, looseLoop, type P, shadeOf, sn, stroke, traceCorners, vn } from './ink';
import { inkWood } from './ink-parts';
import type { MetalPalette } from './kit';

/**
 * Building blocks, inked: the bridge, slabs, girders, planks, ice, belts, goo, jelly and biscuits. A
 * block is cut by hand the way terrain is (`looseLoop`: corners of their own, edges that stray inside
 * the fair-play limits), filled in two flat tones with one hard shadow shape, marked with what it's made
 * of, hatched when it's big enough, and outlined with the pen.
 *
 * All of that is the same every frame, so each block is drawn once into a small bitmap and stamped;
 * only what moves (belt treads, rollers, drips, cracks, a jiggle) is drawn live on top.
 */

/** Bake resolution, px per world px: enough for a close race camera, or a crate card, on a big screen. */
const K = 6;
/** World px of room around the cells for ink that leans out, and drips. */
const PAD = 4;
const CACHE_MAX = 120;

interface Bake {
  canvas: HTMLCanvasElement;
  /** Where the bitmap's corner sits, in the cells' own px. */
  x: number;
  y: number;
  w: number;
  h: number;
  loops: EdgeP[][];
}

interface Tones {
  shade: string;
  base: string;
  light: string;
  ink: string;
  hatch: string;
}

const bakes = new Map<string, Bake>();

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) & 0xffffff;
}

const keyOf = (x: number, y: number) => (y + 512) * 2048 + x + 512;

/** The block's hand-cut outline, in the cells' own px. */
function outline(cells: readonly Cell[], seed: number): EdgeP[][] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of cells) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const set = new Set(cells.map(([x, y]) => keyOf(x, y)));
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const loops = traceCorners((x, y) => set.has(keyOf(x + x0, y + y0)), w, h);
  return loops.map((c) =>
    looseLoop(c, { tile: TILE, w, h, seed, edge: { x: -3, y: -3, w: w + 6, h: h + 6 } }).map((p) => ({
      ...p,
      x: p.x + x0 * TILE,
      y: p.y + y0 * TILE,
      hidden: false,
    })),
  );
}

function trace(g: CanvasRenderingContext2D, loops: readonly EdgeP[][], dx = 0, dy = 0) {
  g.beginPath();
  for (const loop of loops) {
    loop.forEach((p, i) => (i ? g.lineTo(p.x + dx, p.y + dy) : g.moveTo(p.x + dx, p.y + dy)));
    g.closePath();
  }
}

/** The contour: many strokes, lifting at fixed places, heavier away from the light. */
function pen(g: CanvasRenderingContext2D, loops: readonly EdgeP[][], ink: string, seed: number, weight: number) {
  g.fillStyle = ink;
  for (const loop of loops) {
    const n = loop.length;
    if (n < 4) continue;
    const cell = (p: P) => {
      const j = sn(p.x * 0.05, p.y * 0.05, seed + 50) * 0.3;
      return Math.floor(p.x / 22 + j) * 4096 + Math.floor(p.y / 22 - j);
    };
    let start = 0;
    for (let i = 0; i < n; i++) {
      if (cell(loop[i]) !== cell(loop[(i + n - 1) % n])) {
        start = i;
        break;
      }
    }
    let run: EdgeP[] = [];
    const flush = () => {
      if (run.length >= 2) {
        const m = run[run.length >> 1];
        const sh = shadeOf(m.nx, m.ny);
        // Registration is never perfect by hand: the line sits a hair off the fill.
        const dx = sn(m.x * 0.05, m.y * 0.05, seed + 51) * 0.35;
        const dy = sn(m.y * 0.05, m.x * 0.05, seed + 52) * 0.3;
        // Only lit edges ever lift, and not often: a part has to hold its shape on a card.
        if (sh > 0.3 || vn(m.x * 0.08, m.y * 0.08, seed + 53) > 0.22)
          stroke(
            g,
            run.map((p) => ({ x: p.x + dx, y: p.y + dy })),
            { w: (0.9 + 1.9 * sh * sh) * weight, seed: ((m.x * 3 + m.y * 5) | 0) + seed, taper: [0.08, 0.22], press: 0.4, wobble: 0.2 },
          );
      }
      run = [];
    };
    for (let k = 0; k <= n; k++) {
      const p = loop[(start + k) % n];
      const q = loop[(start + k + n - 1) % n];
      if (k && cell(p) !== cell(q)) {
        run.push(p);
        flush();
        run.push(q);
      }
      run.push(p);
    }
    flush();
  }
}

/** Parallel strokes off the edges facing away from the light, fading into the fill. Big blocks only. */
function hatch(g: CanvasRenderingContext2D, loops: readonly EdgeP[][], col: string, seed: number) {
  const SP = 2.6;
  g.fillStyle = col;
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i++) {
      const p = loop[i];
      const q = loop[(i + 1) % loop.length];
      const sh = shadeOf(p.nx, p.ny);
      if (sh < 0.74) continue;
      const a = (p.x * 0.8 - p.y * 0.6) / SP;
      const b = (q.x * 0.8 - q.y * 0.6) / SP;
      if (Math.floor(a) === Math.floor(b)) continue;
      const k = Math.floor(Math.max(a, b));
      if (hash2(k, 11, seed) < 0.18) continue;
      const len = (3 + 9 * (sh - 0.74) * 3.2) * (0.55 + 0.7 * hash2(k, 12, seed));
      const sx = p.x - p.nx * 0.6;
      const sy = p.y - p.ny * 0.6;
      line(g, sx, sy, sx - 0.6 * len, sy - 0.8 * len, { w: 0.9, seed: k, taper: [0.02, 0.85], wobble: 0.2 });
    }
  }
}

const has = (set: Set<number>, x: number, y: number) => set.has(keyOf(x, y));

function tonesOf(material: Material, st: PropStyle, pal: MetalPalette): Tones {
  const t = (c: HSL, shade: number, light: number, ink = 10): Tones => ({
    shade: css(c, shade, 1, 6),
    base: css(c),
    light: css(c, light, 1, -4),
    ink: css({ h: c.h, s: Math.min(60, c.s + 10), l: ink }),
    hatch: css(c, shade - 14, 1, 8),
  });
  switch (material) {
    case 'stone':
      return t({ h: st.hue, s: 14, l: 52 }, -14, 9);
    case 'metal':
      return { ...t(pal.base, pal.dark.l - pal.base.l + 14, (pal.light.l - pal.base.l) * 0.55), ink: css({ h: pal.dark.h, s: pal.dark.s, l: 8 }) };
    case 'wood':
      return t({ h: st.woodHue, s: 48, l: 42 }, -12, 8, 9);
    case 'ice':
      return { ...t({ h: 196, s: 72, l: 78 }, -16, 10), ink: css({ h: 212, s: 60, l: 16 }), hatch: css({ h: 205, s: 60, l: 58 }) };
    case 'conveyor':
      return t({ h: 222, s: 10, l: 30 }, -9, 9, 7);
    case 'goo':
      return t({ h: st.hue, s: 62, l: 42 }, -12, 12, 11);
    case 'jelly':
      return t({ h: (st.hue + 300) % 360, s: 82, l: 62 }, -14, 10, 14);
    case 'crumble':
      return t({ h: 33, s: 52, l: 58 }, -14, 9, 12);
  }
}

/** What a block is made of, said with marks. Drawn inside its own outline. */
const MARKS: Record<
  Material,
  (g: CanvasRenderingContext2D, cells: readonly Cell[], set: Set<number>, T: Tones, seed: number, st: PropStyle, pal: MetalPalette) => void
> = {
  stone(g, cells, set, T, seed) {
    for (const [x, y] of cells) {
      const px = x * TILE;
      const py = y * TILE;
      const r = (k: number) => hash2(x, y + k * 31, seed);
      // A worn top face where feet go.
      if (!has(set, x, y - 1)) {
        g.fillStyle = T.light;
        g.fillRect(px - 1, py, TILE + 2, 2.6 + r(1) * 0.8);
      }
      // Slabs are laid in pieces: a mortar seam at some joints, never all of them.
      g.fillStyle = T.ink;
      if (has(set, x + 1, y) && r(2) < 0.6)
        line(g, px + TILE + (r(3) - 0.5) * 2, py + 2.5, px + TILE + (r(4) - 0.5) * 2, py + TILE - 1.5, { w: 1.1, seed: seed + x, taper: [0.15, 0.3] });
      if (has(set, x, y + 1) && r(5) < 0.5)
        line(g, px + 2, py + TILE + (r(6) - 0.5), px + TILE - 2, py + TILE + (r(7) - 0.5), { w: 1, seed: seed + y, taper: [0.15, 0.3] });
      // Chisel ticks.
      g.fillStyle = T.hatch;
      for (let i = 0; i < 2; i++) {
        const cx = px + 3 + r(8 + i) * 10;
        const cy = py + 5 + r(10 + i) * 8;
        line(g, cx, cy, cx + 2.2, cy - 1.6, { w: 0.8, seed: seed + i, taper: [0.2, 0.6] });
      }
      if (r(12) < 0.45) {
        g.fillStyle = T.light;
        blob(g, px + 4 + r(13) * 8, py + 6 + r(14) * 7, 0.9, seed + x * 3 + y, 1, 0.4);
        g.fill();
      }
    }
    // One crack per slab, from an edge in.
    const [cx, cy] = cells[Math.floor(hash2(1, 2, seed) * cells.length)];
    g.fillStyle = T.ink;
    const pts: P[] = [];
    let ax = cx * TILE + 3 + hash2(3, 4, seed) * 10;
    let ay = cy * TILE + TILE;
    for (let i = 0; i < 4; i++) {
      pts.push({ x: ax, y: ay });
      ax += (hash2(i, 5, seed) - 0.5) * 4;
      ay -= 2 + hash2(i, 6, seed) * 1.8;
    }
    stroke(g, pts, { w: 0.9, seed, taper: [0.05, 0.9] });
  },

  metal(g, cells, set, T, seed, st, pal) {
    const girder = cells.every(([x, y]) => !has(set, x, y - 1) && !has(set, x, y + 1));
    const dark = css(pal.dark, -4);
    const spec = css(pal.spec, -6);
    const rivet = (x: number, y: number) => {
      g.fillStyle = T.ink;
      blob(g, x, y, 1.05, (x * 7 + y * 3) | 0, 1, 0.15);
      g.fill();
      g.fillStyle = spec;
      g.fillRect(x - 0.6, y - 0.7, 0.7, 0.6);
    };
    for (const [x, y] of cells) {
      const px = x * TILE;
      const py = y * TILE;
      if (girder) {
        // An I-beam: two flanges and a web with a lightening hole, which is what says "girder" at a glance.
        g.fillStyle = T.light;
        g.fillRect(px - 1, py, TILE + 2, 3.4);
        g.fillStyle = T.shade;
        g.fillRect(px - 1, py + TILE - 3.6, TILE + 2, 3.8);
        g.fillStyle = T.ink;
        line(g, px - 0.5, py + 3.6, px + TILE + 0.5, py + 3.5, { w: 0.8, seed: seed + x, taper: [0, 0], press: 0.2 });
        line(g, px - 0.5, py + TILE - 3.7, px + TILE + 0.5, py + TILE - 3.6, { w: 0.8, seed: seed + x + 9, taper: [0, 0], press: 0.2 });
        if (st.trim !== 'gems' && st.trim !== 'runes') {
          // The hole's far rim catches the light, and the rest of it is dark: it has depth.
          g.fillStyle = T.base;
          blob(g, px + TILE / 2, py + TILE / 2, 2.9, seed + x, 0.62, 0.08);
          g.fill();
          g.save();
          g.clip();
          g.fillStyle = dark;
          blob(g, px + TILE / 2 - 0.9, py + TILE / 2 - 0.7, 2.9, seed + x, 0.62, 0.08);
          g.fill();
          g.restore();
          g.fillStyle = T.ink;
          const ring: P[] = [];
          for (let i = 0; i <= 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            ring.push({ x: px + TILE / 2 + Math.cos(a) * 3, y: py + TILE / 2 + Math.sin(a) * 1.9 });
          }
          stroke(g, ring, { w: 0.8, seed: seed + x, taper: [0.1, 0.3] });
        }
        if (st.trim !== 'none') {
          rivet(px + 3, py + 1.7);
          rivet(px + TILE - 3, py + 1.7);
        }
      } else {
        // Plate: a seam at each joint, and a rivet in every corner.
        g.fillStyle = T.ink;
        if (has(set, x + 1, y)) line(g, px + TILE, py + 1, px + TILE, py + TILE - 1, { w: 0.8, seed: seed + x, taper: [0.1, 0.2] });
        if (has(set, x, y + 1)) line(g, px + 1, py + TILE, px + TILE - 1, py + TILE, { w: 0.8, seed: seed + y, taper: [0.1, 0.2] });
        if (!has(set, x, y - 1)) {
          g.fillStyle = T.light;
          g.fillRect(px - 1, py, TILE + 2, 2.4);
        }
        if (st.trim === 'rivets' || st.trim === 'gems' || st.trim === 'runes')
          for (const [ax, ay] of [
            [3, 3.4],
            [TILE - 3, 3.4],
            [3, TILE - 3],
            [TILE - 3, TILE - 3],
          ])
            rivet(px + ax, py + ay);
      }
      // A glint, cut hard, on the upper left of every other panel.
      if ((x + y) % 2 === 0) {
        g.fillStyle = spec;
        line(g, px + 3, py + TILE - 5, px + 7, py + 5.5, { w: 1.1, seed: seed + x * 5, taper: [0.2, 0.4], press: 0.1 });
      }
      if (st.trim === 'stripes' && !has(set, x, y - 1)) {
        g.save();
        g.beginPath();
        g.rect(px - 1, py, TILE + 2, 4.2);
        g.clip();
        g.fillStyle = '#1b1a18';
        g.fillRect(px - 1, py, TILE + 2, 4.2);
        g.fillStyle = 'rgb(246 196 38)';
        for (let i = -6; i < TILE + 6; i += 6) {
          g.beginPath();
          g.moveTo(px + i, py + 4.2);
          g.lineTo(px + i + 3, py + 4.2);
          g.lineTo(px + i + 7.2, py);
          g.lineTo(px + i + 4.2, py);
          g.fill();
        }
        g.restore();
      }
      if (st.trim === 'gems' || st.trim === 'runes') {
        // The socket; what glows in it is drawn live.
        const cx = px + TILE / 2;
        const cy = py + TILE / 2 + (girder ? 0 : 0.5);
        g.fillStyle = T.ink;
        g.beginPath();
        g.moveTo(cx, cy - 4.4);
        g.lineTo(cx + 3.8, cy);
        g.lineTo(cx, cy + 4.4);
        g.lineTo(cx - 3.8, cy);
        g.closePath();
        g.fill();
      }
    }
  },

  wood(g, cells, _set, _T, seed, st) {
    inkWood(g, cells, [0, 0], st.woodHue, seed);
  },

  ice(g, cells, set, T, seed) {
    for (const [x, y] of cells) {
      const px = x * TILE;
      const py = y * TILE;
      const r = (k: number) => hash2(x, y + k * 29, seed);
      if (!has(set, x, y - 1)) {
        g.fillStyle = T.light;
        g.fillRect(px - 1, py, TILE + 2, 3);
      }
      // A crack that forks, deep blue, and frost in the corners.
      if (r(1) < 0.6) {
        g.fillStyle = T.hatch;
        const ax = px + 3 + r(2) * 10;
        const ay = py + 4 + r(3) * 4;
        const bx = ax + (r(4) - 0.5) * 7;
        const by = ay + 5 + r(5) * 3;
        line(g, ax, ay, bx, by, { w: 0.8, seed: seed + x, taper: [0.1, 0.7] });
        line(g, (ax + bx) / 2, (ay + by) / 2, (ax + bx) / 2 + 3, (ay + by) / 2 + 1.5, { w: 0.6, seed: seed + y, taper: [0.1, 0.8] });
      }
      g.fillStyle = 'rgb(250 254 255)';
      // Two hard glints, the way ice is drawn: parallel, short, clipped.
      if (r(6) < 0.7 || !has(set, x - 1, y)) {
        line(g, px + 2.5, py + 11, px + 7.5, py + 5, { w: 1.7, seed: seed + x * 3, taper: [0.15, 0.2], press: 0.1 });
        line(g, px + 6, py + 12, px + 9, py + 8.5, { w: 1, seed: seed + y * 3, taper: [0.15, 0.2], press: 0.1 });
      }
      blob(g, px + 12 + r(7) * 2, py + 12 + r(8) * 2, 0.6, seed + x + y, 1, 0.2);
      g.fill();
    }
  },

  conveyor(g, cells, set, T, seed) {
    for (const [x, y] of cells) {
      const px = x * TILE;
      const py = y * TILE;
      if (!has(set, x, y - 1)) {
        // The belt: black rubber over the top, with its lip.
        g.fillStyle = '#16151a';
        g.fillRect(px - 1, py, TILE + 2, 4.6);
        g.fillStyle = T.ink;
        line(g, px - 0.5, py + 4.8, px + TILE + 0.5, py + 4.7, { w: 0.9, seed: seed + x, taper: [0, 0], press: 0.2 });
      }
      // A roller socket: the roller itself turns, so it's drawn live.
      g.fillStyle = T.ink;
      blob(g, px + TILE / 2, py + TILE - 5.2, 3.7, seed + x, 1, 0.06);
      g.fill();
      g.fillStyle = 'rgb(120 124 134)';
      blob(g, px + TILE / 2, py + TILE - 5.2, 2.8, seed + x + 1, 1, 0.06);
      g.fill();
      g.fillStyle = 'rgb(180 184 192)';
      blob(g, px + TILE / 2 - 0.8, py + TILE - 6, 1.1, seed + x + 2, 1, 0.1);
      g.fill();
    }
  },

  goo(g, cells, set, T, seed) {
    for (const [x, y] of cells) {
      const px = x * TILE;
      const py = y * TILE;
      const r = (k: number) => hash2(x, y + k * 23, seed);
      if (!has(set, x, y - 1)) {
        g.fillStyle = T.light;
        stroke(
          g,
          [
            { x: px + 2, y: py + 3.2 },
            { x: px + 7, y: py + 2.4 },
            { x: px + 12, y: py + 3 },
          ],
          { w: 1.7, seed: seed + x, taper: [0.25, 0.35], press: 0.2 },
        );
      }
      // Bubbles caught in it: a ring and a speck.
      for (let i = 0; i < 2; i++) {
        const bx = px + 3 + r(1 + i) * 10;
        const by = py + 6 + r(3 + i) * 7;
        const br = 0.9 + r(5 + i) * 1.1;
        g.fillStyle = T.light;
        blob(g, bx, by, br + 0.6, seed + i, 1, 0.1);
        g.fill();
        g.fillStyle = T.base;
        blob(g, bx + 0.3, by + 0.3, br, seed + i, 1, 0.1);
        g.fill();
      }
      g.fillStyle = T.shade;
      blob(g, px + 4 + r(7) * 8, py + 9 + r(8) * 4, 1.6, seed + x * 7, 1, 0.4);
      g.fill();
    }
  },

  jelly(g, cells, set, T, seed) {
    for (const [x, y] of cells) {
      const px = x * TILE;
      const py = y * TILE;
      const r = (k: number) => hash2(x, y + k * 19, seed);
      // Light goes through jelly: it comes out as a bright line just inside the shadow side, under a
      // big wet shine at the top. Bubbles hang in it.
      if (!has(set, x, y + 1)) {
        g.fillStyle = T.light;
        line(g, px + 1.5, py + TILE - 2.6, px + TILE - 1.5, py + TILE - 2.8, { w: 1.3, seed: seed + x, taper: [0.2, 0.2], press: 0.3 });
      }
      if (!has(set, x + 1, y)) {
        g.fillStyle = T.light;
        line(g, px + TILE - 2.6, py + 3, px + TILE - 2.8, py + TILE - 3.5, { w: 1.2, seed: seed + y, taper: [0.2, 0.2], press: 0.3 });
      }
      for (let i = 0; i < 2; i++) {
        const bx = px + 4 + r(3 + i) * 8;
        const by = py + 6 + r(5 + i) * 6;
        g.fillStyle = T.light;
        blob(g, bx, by, 1.2 + i * 0.4, seed + i, 1, 0.1);
        g.fill();
        g.fillStyle = T.base;
        blob(g, bx + 0.35, by + 0.35, 0.8 + i * 0.4, seed + i, 1, 0.1);
        g.fill();
      }
      if (!has(set, x, y - 1)) {
        g.fillStyle = 'rgb(255 250 252)';
        stroke(
          g,
          [
            { x: px + 2.6, y: py + 6 },
            { x: px + 3.4, y: py + 3.4 },
            { x: px + 7, y: py + 2.6 },
          ],
          { w: 1.9, seed: seed + x, taper: [0.25, 0.35], press: 0.1 },
        );
      }
      g.fillStyle = 'rgb(255 250 252)';
      blob(g, px + 10 + r(1) * 3, py + 6 + r(2) * 4, 0.75, seed + y, 1, 0.1);
      g.fill();
    }
  },

  crumble(g, cells, set, T, seed) {
    for (const [x, y] of cells) {
      const px = x * TILE;
      const py = y * TILE;
      const r = (k: number) => hash2(x, y + k * 17, seed);
      if (!has(set, x, y - 1)) {
        g.fillStyle = T.light;
        g.fillRect(px - 1, py, TILE + 2, 2.4);
      }
      // A shortbread: docking holes in a grid, each a dark prick with a lit lip.
      for (const [hx, hy] of [
        [4.5, 5.5],
        [11.5, 5.5],
        [4.5, 11.5],
        [11.5, 11.5],
      ]) {
        g.fillStyle = T.light;
        blob(g, px + hx + 0.4, py + hy + 0.4, 1.05, seed + hx, 1, 0.1);
        g.fill();
        g.fillStyle = T.ink;
        blob(g, px + hx, py + hy, 0.85, seed + hy, 1, 0.1);
        g.fill();
      }
      // Sugar.
      g.fillStyle = 'rgb(255 246 222)';
      for (let i = 0; i < 2; i++) {
        blob(g, px + 2 + r(i) * 12, py + 2 + r(i + 4) * 12, 0.45, seed + i, 1, 0.1);
        g.fill();
      }
    }
  },
};

function bake(cells: readonly Cell[], material: Material, st: PropStyle, pal: MetalPalette, key: string): Bake {
  const seed = hashStr(key);
  const loops = outline(cells, seed);
  const set = new Set(cells.map(([x, y]) => keyOf(x, y)));
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of cells) {
    x0 = Math.min(x0, x * TILE);
    y0 = Math.min(y0, y * TILE);
    x1 = Math.max(x1, (x + 1) * TILE);
    y1 = Math.max(y1, (y + 1) * TILE);
  }
  const b: Bake = { canvas: document.createElement('canvas'), x: x0 - PAD, y: y0 - PAD, w: x1 - x0 + PAD * 2, h: y1 - y0 + PAD * 2, loops };
  b.canvas.width = Math.ceil(b.w * K);
  b.canvas.height = Math.ceil(b.h * K);
  const g = b.canvas.getContext('2d')!;
  g.setTransform(K, 0, 0, K, -b.x * K, -b.y * K);
  g.lineJoin = 'round';
  const T = tonesOf(material, st, pal);
  // Two flat tones: the shade everywhere, then the lit part of the block shifted up and left, which
  // leaves one hard shadow shape along the bottom and right.
  g.fillStyle = T.shade;
  trace(g, loops);
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = T.base;
  trace(g, loops, -1.8, -2);
  g.fill();
  MARKS[material](g, cells, set, T, seed, st, pal);
  if (cells.length >= 3 && material !== 'jelly' && material !== 'goo') hatch(g, loops, T.hatch, seed);
  g.restore();
  pen(g, loops, T.ink, seed, material === 'jelly' || material === 'goo' ? 0.9 : 1);
  return b;
}

function bakeOf(cells: readonly Cell[], material: Material, st: PropStyle, pal: MetalPalette): Bake {
  const sig = cells.map(([x, y]) => `${x},${y}`).join(';');
  const key = `${material}|${st.trim}|${st.hue | 0}|${st.woodHue | 0}|${pal.base.h},${pal.base.l}|${sig}`;
  let b = bakes.get(key);
  if (!b) {
    if (bakes.size >= CACHE_MAX) bakes.clear();
    b = bake(cells, material, st, pal, key);
    bakes.set(key, b);
  }
  return b;
}

/** Stamp a baked block at offset `O` (world px of the cells' origin). `jiggle` squashes it about its base. */
export function stampBlock(
  s: CanvasRenderingContext2D,
  cells: readonly Cell[],
  O: Vec,
  material: Material,
  st: PropStyle,
  pal: MetalPalette,
  jiggle = 0,
): Bake {
  const b = bakeOf(cells, material, st, pal);
  if (jiggle) {
    const base = b.y + b.h - PAD;
    const cx = b.x + b.w / 2;
    s.save();
    s.translate(O[0] + cx, O[1] + base);
    s.scale(1 - jiggle * 0.6, 1 + jiggle);
    s.drawImage(b.canvas, b.x - cx, b.y - base, b.w, b.h);
    s.restore();
  } else s.drawImage(b.canvas, O[0] + b.x, O[1] + b.y, b.w, b.h);
  return b;
}

/** A block's hand-cut outline, for live marks that follow it (a broken biscuit's ghost). */
export function blockLoops(cells: readonly Cell[], material: Material, st: PropStyle, pal: MetalPalette): readonly EdgeP[][] {
  return bakeOf(cells, material, st, pal).loops;
}

/**
 * Any one-tile part, inked the block way and stamped: a hand-cut tile in `base` with its hard shadow
 * shape, `marks` on top inside its outline, `over` past it (a bow on a gift), and the pen round it.
 * Baked once per `key`.
 */
export function stampTile(
  s: CanvasRenderingContext2D,
  px: number,
  py: number,
  key: string,
  base: HSL,
  marks: (g: CanvasRenderingContext2D, seed: number) => void,
  over?: (g: CanvasRenderingContext2D, seed: number, ink: string) => void,
) {
  let b = bakes.get(key);
  if (!b) {
    if (bakes.size >= CACHE_MAX) bakes.clear();
    const seed = hashStr(key);
    const loops = outline([[0, 0]], seed);
    b = { canvas: document.createElement('canvas'), x: -PAD, y: -PAD, w: TILE + PAD * 2, h: TILE + PAD * 2, loops };
    b.canvas.width = Math.ceil(b.w * K);
    b.canvas.height = Math.ceil(b.h * K);
    const g = b.canvas.getContext('2d')!;
    g.setTransform(K, 0, 0, K, PAD * K, PAD * K);
    const ink = css({ h: base.h, s: Math.min(60, base.s + 10), l: 10 });
    g.fillStyle = css(base, -15, 1, 6);
    trace(g, loops);
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = css(base);
    trace(g, loops, -1.6, -1.8);
    g.fill();
    marks(g, seed);
    g.restore();
    pen(g, loops, ink, seed, 1);
    over?.(g, seed, ink);
    bakes.set(key, b);
  }
  s.drawImage(b.canvas, px + b.x, py + b.y, b.w, b.h);
}

/**
 * One blink-block tile in `hue`: a stamped switch block with an inset panel, so a row of them reads as
 * separate bricks that come and go one at a time. `variant` picks one of a few hands.
 */
export function stampPhaseTile(s: CanvasRenderingContext2D, px: number, py: number, hue: number, variant: number) {
  const key = `phase|${hue | 0}|${variant % 3}`;
  let b = bakes.get(key);
  if (!b) {
    if (bakes.size >= CACHE_MAX) bakes.clear();
    const seed = hashStr(key);
    const loops = outline([[0, 0]], seed);
    b = { canvas: document.createElement('canvas'), x: -PAD, y: -PAD, w: TILE + PAD * 2, h: TILE + PAD * 2, loops };
    b.canvas.width = Math.ceil(b.w * K);
    b.canvas.height = Math.ceil(b.h * K);
    const g = b.canvas.getContext('2d')!;
    g.setTransform(K, 0, 0, K, PAD * K, PAD * K);
    const c: HSL = { h: hue, s: 85, l: 56 };
    g.fillStyle = css(c, -16, 1, 6);
    trace(g, loops);
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = css(c);
    trace(g, loops, -1.6, -1.8);
    g.fill();
    // The inset panel: a darker square cut into the face, its lower right lip catching the light.
    g.fillStyle = css(c, -12, 1, 4);
    blob(g, TILE / 2, TILE / 2, 4.2, seed, 1, 0.05);
    g.fill();
    g.fillStyle = css(c, 18, 1, -10);
    line(g, 4.8, 11.7, 11.6, 11.5, { w: 1, seed, taper: [0.1, 0.1], press: 0 });
    line(g, 11.7, 4.8, 11.6, 11.5, { w: 1, seed: seed + 1, taper: [0.1, 0.1], press: 0 });
    g.fillStyle = 'rgba(255,255,255,0.85)';
    line(g, 2.6, 7, 2.8, 3, { w: 1.2, seed: seed + 2, taper: [0.2, 0.2], press: 0.1 });
    line(g, 2.8, 2.8, 6.5, 2.6, { w: 1.2, seed: seed + 3, taper: [0.2, 0.2], press: 0.1 });
    g.restore();
    pen(g, loops, css({ h: hue, s: 60, l: 11 }), seed, 1);
    bakes.set(key, b);
  }
  s.drawImage(b.canvas, px + b.x, py + b.y, b.w, b.h);
}
