import { css, type HSL } from '../core/color';
import type { Cell, Vec } from '../core/geom';
import { hash2 } from '../core/rng';
import { TILE } from '../sim/constants';
import type { Material, PropStyle } from '../sim/props';
import { blob, type EdgeP, line, looseLoop, type P, shadeOf, sn, stroke, traceCorners, vn } from './ink';
import { markBiscuit, markMetal, markStone, markWood, overIce, overWood, retroTile, runsOf, type Tones } from './ink-build';
import { type Belt, beltsOf, type Cut, markConveyor, markGoo, markJelly, overGoo } from './ink-surface';
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
const PAD = 6;
const CACHE_MAX = 120;

interface Bake {
  canvas: HTMLCanvasElement;
  /** Where the bitmap's corner sits, in the cells' own px. */
  x: number;
  y: number;
  w: number;
  h: number;
  loops: EdgeP[][];
  /** A conveyor's belts, for the live cleats and spokes. */
  belts?: Belt[];
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

/**
 * What a block is made of, said with marks, inside its own outline. Stone, metal, wood and biscuit are
 * built objects (`ink-build.ts`); the rest are surfaces with marks on them.
 */
const MARKS: Record<Material, (g: CanvasRenderingContext2D, cells: readonly Cell[], set: Set<number>, T: Tones, seed: number, b: Cut) => void> = {
  stone(g, _cells, _set, _T, _seed, b) {
    markStone(g, b, { h: b.st.hue, s: 14, l: 52 });
  },
  metal(g, _cells, _set, _T, _seed, b) {
    markMetal(g, b);
  },
  wood(g, _cells, _set, _T, _seed, b) {
    markWood(g, b);
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

  conveyor(g, _cells, _set, _T, _seed, b) {
    markConveyor(g, b);
  },
  goo(g, _cells, _set, _T, _seed, b) {
    markGoo(g, b);
  },
  jelly(g, _cells, _set, _T, _seed, b) {
    markJelly(g, b);
  },

  crumble(g, _cells, _set, _T, _seed, b) {
    markBiscuit(g, b);
  },
};

/** What a block wears past its outline, after the pen: thin things only (ropes, knots, strings of tar). */
const OVER: Partial<Record<Material, (g: CanvasRenderingContext2D, b: Cut) => void>> = { wood: overWood, ice: overIce, goo: overGoo };

/** Materials whose own structure carries the form, so hatching would only muddy it. */
const NO_HATCH = new Set<Material>(['jelly', 'goo', 'metal', 'wood', 'crumble', 'stone', 'conveyor']);

function bake(cells: readonly Cell[], material: Material, st: PropStyle, pal: MetalPalette, key: string, dir: number, turn: number): Bake {
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
  const has = (x: number, y: number) => set.has(keyOf(x, y));
  const blk: Cut = { cells, has, runs: runsOf(cells, has), seed, T, st, pal, loops, dir, turn };
  if (material === 'conveyor') b.belts = beltsOf(blk);
  MARKS[material](g, cells, set, T, seed, blk);
  if (cells.length >= 3 && !NO_HATCH.has(material)) hatch(g, loops, T.hatch, seed);
  g.restore();
  pen(g, loops, T.ink, seed, material === 'jelly' || material === 'goo' ? 0.9 : 1);
  OVER[material]?.(g, blk);
  return b;
}

function bakeOf(cells: readonly Cell[], material: Material, st: PropStyle, pal: MetalPalette, dir = 1, turn = 0): Bake {
  const sig = cells.map(([x, y]) => `${x},${y}`).join(';');
  const key = `${material}|${st.trim}|${st.hue | 0}|${st.woodHue | 0}|${pal.base.h},${pal.base.l}|${material === 'conveyor' ? `${dir},${turn}` : ''}|${sig}`;
  let b = bakes.get(key);
  if (!b) {
    if (bakes.size >= CACHE_MAX) bakes.clear();
    b = bake(cells, material, st, pal, key, dir, turn);
    bakes.set(key, b);
  }
  return b;
}

/**
 * Stamp a baked block at offset `O` (world px of the cells' origin). `squash` presses it down about its
 * base by that many px (negative stretches it), bulging the sides a little less. For a conveyor, `dir` is
 * which way its belt runs round the block (its painted arrows show it) and `turn` the face it's on.
 */
export function stampBlock(
  s: CanvasRenderingContext2D,
  cells: readonly Cell[],
  O: Vec,
  material: Material,
  st: PropStyle,
  pal: MetalPalette,
  squash = 0,
  dir = 1,
  turn = 0,
): Bake {
  const b = bakeOf(cells, material, st, pal, dir, turn);
  if (squash) {
    const base = b.y + b.h - PAD;
    const cx = b.x + b.w / 2;
    const bulge = Math.max(-0.5, Math.min(1, squash * 0.7));
    s.save();
    s.translate(O[0] + cx, O[1] + base);
    s.scale(1 + (2 * bulge) / (b.w - PAD * 2), 1 - squash / (b.h - PAD * 2));
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
 * One retro blink-block tile in `hue`, stamped: `brick` for the famous brick block's courses, otherwise
 * the exclamation switch block (`retroTile`). A row of them reads as separate blocks that come and go one
 * at a time. `variant` picks one of a few hands.
 */
export function stampPhaseTile(s: CanvasRenderingContext2D, px: number, py: number, hue: number, variant: number, brick: boolean) {
  const key = `phase|${hue | 0}|${variant % 3}|${brick}`;
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
    g.save();
    trace(g, loops);
    g.clip();
    retroTile(g, hue, brick, seed);
    g.restore();
    pen(g, loops, css({ h: hue, s: 60, l: 11 }), seed, 1);
    bakes.set(key, b);
  }
  s.drawImage(b.canvas, px + b.x, py + b.y, b.w, b.h);
}
