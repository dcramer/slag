import { css, type HSL, shift } from '../core/color';
import { hash2 } from '../core/rng';
import type { TerrainKind } from '../gen/theme';
import { TILE } from '../sim/constants';
import { blob, line, type P, sn, stroke } from './ink';

/**
 * What terrain is made of, drawn. One painter per family of `TerrainKind`, colored by the theme, so a
 * material carries across seeds and themes with no per-theme art. Every mark comes from a lattice fixed
 * in the world, never from the terrain's shape: a crater cuts through stonework the way a real one would,
 * and everything it didn't touch stays put.
 */

export interface Tones {
  base: HSL;
  dark: HSL;
  light: HSL;
}

export interface Paint {
  g: CanvasRenderingContext2D;
  seed: number;
  T: Tones;
  ink: string;
  /** Tiles to visit. */
  span: { tx0: number; ty0: number; tx1: number; ty1: number };
  /** World rect being painted. */
  area: { x0: number; y0: number; x1: number; y1: number };
  /** Does this material show at this tile? */
  inside: (x: number, y: number) => boolean;
  /** Tiles from this tile to the nearest air. */
  depth: (x: number, y: number) => number;
}

export type InkMaterial = (p: Paint) => void;

/** Tiles around a painter's reach, for marks that start on one tile and land on the next. */
function eachTile(p: Paint, fn: (x: number, y: number, wx: number, wy: number) => void) {
  for (let y = p.span.ty0; y <= p.span.ty1; y++) {
    for (let x = p.span.tx0; x <= p.span.tx1; x++) {
      if (p.inside(x, y)) fn(x, y, x * TILE, y * TILE);
    }
  }
}

function fillArea(p: Paint, color: string) {
  p.g.fillStyle = color;
  p.g.fillRect(p.area.x0, p.area.y0, p.area.x1 - p.area.x0, p.area.y1 - p.area.y0);
}

function tonePatch(p: Paint, want: (d: number) => boolean) {
  const { g, seed } = p;
  eachTile(p, (x, y, wx, wy) => {
    if (!want(p.depth(x, y))) return;
    const cx = wx + TILE / 2;
    const cy = wy + TILE / 2;
    blob(g, cx + sn(cx * 0.3, cy * 0.3, seed + 2) * 3, cy + sn(cy * 0.3, cx * 0.3, seed + 3) * 3, 13, ((cx + cy * 3) | 0) + seed, 1, 0.4);
    g.fill();
  });
}

/** Soil: lumpy flat tones with pebbles, cracks, ticks and grit. */
const soil: InkMaterial = (p) => {
  const { g, T, seed, ink } = p;
  fillArea(p, css(T.base));
  // Second tone: lumpy flat shape from a pile of blobs, so its edge is a brush's, not a gradient's.
  g.fillStyle = css(shift(T.base, -7, 2));
  tonePatch(p, (d) => d >= 2);
  g.fillStyle = css(shift(T.dark, 3, 2));
  tonePatch(p, (d) => d >= 4);
  // Sunlit soil near the surface, in dragged strokes rather than a band.
  g.fillStyle = css(shift(T.light, -3), undefined, 0.8);
  eachTile(p, (x, y, wx, wy) => {
    if (p.depth(x, y) !== 1) return;
    const n = 2 + Math.floor(hash2(wx, wy, seed + 5) * 2);
    for (let i = 0; i < n; i++) {
      const sx = wx + hash2(wx, i, seed + 6) * TILE;
      const sy = wy + 4 + hash2(wy, i, seed + 7) * 11;
      const len = 8 + hash2(wx, wy + i, seed + 8) * 14;
      line(g, sx, sy, sx + len, sy + sn(sx * 0.1, sy * 0.1, seed) * 2, { w: 1.5, seed: (sx * 13) | 0, wobble: 0.5 });
    }
  });

  const stone = css(shift(T.light, 6, -8));
  const stoneShade = css(shift(T.base, -4, -6));
  const speck = css(shift(T.dark, -4));
  eachTile(p, (x, y, wx, wy) => {
    const roll = hash2(wx, wy, seed + 20);
    const px = wx + 2 + hash2(wx, wy, seed + 21) * 12;
    const py = wy + 2 + hash2(wx, wy, seed + 22) * 12;
    const sd = ((wx * 7 + wy * 11) | 0) + seed;
    if (roll < 0.17 && p.depth(x, y) >= 2) {
      // A pebble: flat fill, a shaded underside, and a line that doesn't quite close.
      const r = 1.5 + hash2(wx, wy, seed + 23) * 2.6;
      g.fillStyle = stone;
      blob(g, px, py, r, sd, 0.72);
      g.fill();
      g.fillStyle = stoneShade;
      blob(g, px + r * 0.15, py + r * 0.28, r * 0.72, sd + 1, 0.5);
      g.fill();
      g.fillStyle = ink;
      const arc: P[] = [];
      for (let i = 0; i <= 9; i++) {
        const a = 0.2 + (i / 9) * 4.9;
        arc.push({ x: px + Math.cos(a) * r * 1.08, y: py + Math.sin(a) * r * 0.8 });
      }
      stroke(g, arc, { w: 1.05, seed: sd, taper: [0.05, 0.45] });
    } else if (roll < 0.34) {
      crack(p, px, py, hash2(wx, wy, seed + 24) * 2 + 0.6, 7 + hash2(wx, wy, seed + 25) * 12, sd);
    } else if (roll < 0.6) {
      // Strata ticks: short dashes, all leaning the same way.
      g.fillStyle = speck;
      const n = 2 + Math.floor(hash2(wx, wy, seed + 26) * 3);
      for (let i = 0; i < n; i++) {
        const dx = hash2(wx + i, wy, seed + 27) * 12 - 6;
        const dy = hash2(wx, wy + i, seed + 28) * 12 - 6;
        line(g, px + dx, py + dy, px + dx + 3 + hash2(i, wx, seed) * 3, py + dy + 0.8, { w: 0.85, seed: sd + i, taper: [0.2, 0.6] });
      }
    } else if (roll < 0.74) {
      // Stipple: the cheapest way to say "grit".
      g.fillStyle = speck;
      for (let i = 0; i < 4; i++) {
        blob(g, px + hash2(i, wx, seed + 29) * 9 - 4, py + hash2(i, wy, seed + 30) * 9 - 4, 0.4 + hash2(i, sd, 1) * 0.4, sd + i, 1, 0.1);
        g.fill();
      }
    }
  });
};

/** A crack: a stroke with a fork, pressed hard at the start. */
function crack(p: Paint, x: number, y: number, a: number, len: number, seed: number) {
  const { g, ink } = p;
  const pts: P[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push({ x: x + Math.cos(a) * len * t + sn(x + t * 3, y, seed) * 2.2, y: y + Math.sin(a) * len * t + sn(y, x + t * 3, seed) * 2.2 });
  }
  g.fillStyle = ink;
  stroke(g, pts, { w: 1.25, seed, taper: [0.04, 0.8] });
  const m = pts[3];
  line(g, m.x, m.y, m.x + Math.cos(a + 0.8) * len * 0.35, m.y + Math.sin(a + 0.8) * len * 0.35, { w: 0.8, seed: seed + 1, taper: [0.04, 0.8] });
}

interface Coursing {
  /** World px of a course, and of a block along it. */
  h: number;
  w: number;
  /** How far a joint strays, as a share of the block; and how round a block's corners are, in px. */
  stray: number;
  round: number;
  /** Chance of two blocks being one long one. */
  long: number;
  /** Plates and boards line up; bricks stagger. */
  stack?: boolean;
  /** Cast in one batch: block tones stay close, or a wall of panels reads as a checkerboard. */
  even?: boolean;
  /** What a block has on it, instead of chisel marks. */
  mark?: (p: Paint, x0: number, y0: number, x1: number, y1: number, seed: number) => void;
}

/** Laid masonry: courses of blocks on a fixed lattice, each with its own tone and its own hand. */
function masonry(c: Coursing): InkMaterial {
  return (p) => {
    const { T, seed, ink, area } = p;
    fillArea(p, css(shift(T.dark, 3, -6)));
    const tones = c.even
      ? [css(shift(T.base, 3, -1)), css(T.base), css(shift(T.base, -3, 1)), css(shift(T.base, 6, -3)), css(shift(T.base, 1, 2, 4))]
      : [css(shift(T.base, 7, -2)), css(T.base), css(shift(T.base, -5, 2)), css(shift(T.light, -6, -6)), css(shift(T.base, 3, 4, 6))];
    const deep = c.even
      ? [css(shift(T.base, -6, 0)), css(shift(T.base, -8, 1)), css(shift(T.base, -10, 2)), css(shift(T.base, -5, -2)), css(shift(T.base, -7, 2, 4))]
      : [css(shift(T.base, -6, 0)), css(shift(T.base, -9, 2)), css(shift(T.base, -12, 2)), css(shift(T.base, -4, -4)), css(shift(T.base, -8, 4, 6))];
    const shade = css(shift(T.dark, 2, 6));
    const lit = css(shift(T.light, 10, -8));
    const r0 = Math.floor(area.y0 / c.h) - 1;
    const r1 = Math.ceil(area.y1 / c.h) + 1;
    for (let r = r0; r <= r1; r++) {
      const off = c.stack ? 0 : (r & 1) * c.w * 0.5 + hash2(r, 1, seed) * c.w * 0.3;
      const joint = (k: number) => k * c.w + off + (hash2(k, r, seed + 2) - 0.5) * c.w * c.stray;
      const k0 = Math.floor((area.x0 - off) / c.w) - 8;
      const k1 = Math.ceil((area.x1 - off) / c.w) + 2;
      for (let k = k0; k <= k1; k++) {
        // A joint can be skipped, which makes a long block; the rule looks left only, so it can't depend on where drawing started.
        if (hash2(k, r, seed + 3) < c.long) continue;
        let end = k + 1;
        while (end < k + 8 && hash2(end, r, seed + 3) < c.long) end++;
        block(p, joint(k), r * c.h, joint(end) - joint(k), c.h, c, tones, deep, shade, lit, ink, k * 977 + r * 131 + seed);
      }
    }
  };
}

function block(
  p: Paint,
  x: number,
  y: number,
  w: number,
  h: number,
  c: Coursing,
  tones: string[],
  deep: string[],
  shade: string,
  lit: string,
  ink: string,
  sd: number,
) {
  const { g, area } = p;
  if (x + w < area.x0 - 2 || x > area.x1 + 2 || y + h < area.y0 - 2 || y > area.y1 + 2) return;
  const tx = Math.floor((x + w / 2) / TILE);
  const ty = Math.floor((y + h / 2) / TILE);
  const gap = 0.6;
  const x0 = x + gap;
  const y0 = y + gap;
  const x1 = x + w - gap;
  const y1 = y + h - gap;
  const r = Math.min(c.round, (y1 - y0) / 2 - 0.2);
  const j = (i: number, a: number) => sn(sd * 0.13 + i * 1.9, a, 5) * 0.55;
  // Corners cut by hand: each a little different, sides a little bowed.
  const pts: P[] = [
    { x: x0 + r + j(1, 1), y: y0 + j(2, 1) },
    { x: (x0 + x1) / 2 + j(3, 2), y: y0 + j(4, 2) * 0.7 },
    { x: x1 - r + j(5, 1), y: y0 + j(6, 1) },
    { x: x1 + j(7, 1), y: y0 + r + j(8, 1) },
    { x: x1 + j(9, 1), y: y1 - r + j(10, 1) },
    { x: x1 - r + j(11, 1), y: y1 + j(12, 1) },
    { x: (x0 + x1) / 2 + j(13, 2), y: y1 + j(14, 2) * 0.7 },
    { x: x0 + r + j(15, 1), y: y1 + j(16, 1) },
    { x: x0 + j(17, 1), y: y1 - r + j(18, 1) },
    { x: x0 + j(19, 1), y: y0 + r + j(20, 1) },
  ];
  const tone = Math.floor(hash2(sd, 3, 1) * tones.length);
  g.fillStyle = p.depth(tx, ty) >= 3 ? deep[tone] : tones[tone];
  g.beginPath();
  pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
  g.closePath();
  g.fill();

  // Weight on the underside and the side away from the light, and a dry lit edge on the other two.
  g.fillStyle = shade;
  stroke(g, [pts[3], pts[4], pts[5], pts[6], pts[7]], { w: 1.5, seed: sd, taper: [0.2, 0.35], press: 0.3 });
  g.fillStyle = lit;
  if (hash2(sd, 5, 1) > 0.3) stroke(g, [pts[9], pts[0], pts[1], pts[2]], { w: 0.85, seed: sd + 1, taper: [0.25, 0.5], press: 0.4 });

  g.fillStyle = ink;
  // Not every joint gets a line: the ones left out are what make it read as drawn, not stamped.
  if (hash2(sd, 6, 1) > 0.25) stroke(g, [pts[4], pts[5], pts[6], pts[7], pts[8]], { w: 1, seed: sd + 2, taper: [0.3, 0.3], press: 0.5 });
  if (hash2(sd, 7, 1) > 0.55) stroke(g, [pts[2], pts[3], pts[4]], { w: 0.8, seed: sd + 3, taper: [0.2, 0.5] });

  if (c.mark) {
    c.mark(p, x0, y0, x1, y1, sd);
    return;
  }
  const roll = hash2(sd, 8, 1);
  const cx = x0 + (x1 - x0) * (0.2 + 0.6 * hash2(sd, 9, 1));
  const cy = y0 + (y1 - y0) * (0.25 + 0.5 * hash2(sd, 10, 1));
  if (roll < 0.1) crack(p, cx, cy, 0.5 + hash2(sd, 11, 1) * 2, Math.min(w, h) * 0.6, sd + 4);
  else if (roll < 0.34) {
    // Chisel marks: a few short strokes all going the same way.
    g.fillStyle = shade;
    for (let i = 0; i < 3; i++) line(g, cx + i * 1.6, cy + i * 0.5, cx + i * 1.6 + 1.2, cy + i * 0.5 + 2.2, { w: 0.65, seed: sd + i, taper: [0.2, 0.6] });
  } else if (roll < 0.42) {
    g.fillStyle = ink;
    blob(g, cx, cy, 0.8, sd, 0.7, 0.3);
    g.fill();
  }
}

/** A wall of boards: grain along the length, a knot here and there, nails at the ends. */
function boardMarks(p: Paint, x0: number, y0: number, x1: number, y1: number, sd: number) {
  const { g, T, ink } = p;
  g.fillStyle = css(shift(T.dark, 2, 6));
  const rows = 2 + Math.floor(hash2(sd, 1, 2) * 2);
  for (let i = 0; i < rows; i++) {
    const gy = y0 + 1.6 + (y1 - y0 - 3) * ((i + hash2(sd, i, 3)) / rows);
    const gx = x0 + 2 + hash2(sd, i, 4) * (x1 - x0) * 0.5;
    const len = 8 + hash2(sd, i, 5) * (x1 - x0) * 0.45;
    const pts: P[] = [];
    for (let t = 0; t <= 8; t++) pts.push({ x: gx + (len * t) / 8, y: gy + sn(gx * 0.1 + t * 0.4, gy, sd & 255) * 0.7 });
    stroke(g, pts, { w: 0.7, seed: sd + i, taper: [0.3, 0.6] });
  }
  g.fillStyle = ink;
  if (hash2(sd, 6, 2) < 0.2) {
    // A knot: a ring that doesn't quite close, grain would bend round it.
    const kx = x0 + (x1 - x0) * (0.25 + 0.5 * hash2(sd, 7, 2));
    const ky = (y0 + y1) / 2;
    const arc: P[] = [];
    for (let i = 0; i <= 8; i++) arc.push({ x: kx + Math.cos(i * 0.68) * 1.9, y: ky + Math.sin(i * 0.68) * 1.2 });
    stroke(g, arc, { w: 0.8, seed: sd, taper: [0.1, 0.5] });
  }
  for (const nx of [x0 + 2.4, x1 - 2.4]) {
    blob(g, nx, y0 + 2.2, 0.55, sd, 1, 0.2);
    g.fill();
    if (y1 - y0 > 7) {
      blob(g, nx, y1 - 2.2, 0.55, sd + 1, 1, 0.2);
      g.fill();
    }
  }
}

/** Plate: rivets in the corners, a scuff or two, a dry diagonal of sheen. */
function plateMarks(p: Paint, x0: number, y0: number, x1: number, y1: number, sd: number) {
  const { g, T, ink } = p;
  g.fillStyle = css(shift(T.light, 4, -6));
  const r = hash2(sd, 1, 6);
  if (r < 0.4) {
    const cx = x0 + (x1 - x0) * (0.3 + 0.3 * hash2(sd, 2, 6));
    line(g, cx, y1 - 3, cx + 7, y0 + 3, { w: 1, seed: sd, taper: [0.3, 0.6], press: 0.6 });
    line(g, cx + 3, y1 - 3, cx + 7.5, y1 - 10, { w: 0.6, seed: sd + 1, taper: [0.3, 0.6] });
  }
  g.fillStyle = ink;
  for (const [x, y] of [
    [x0 + 2.6, y0 + 2.6],
    [x1 - 2.6, y0 + 2.6],
    [x0 + 2.6, y1 - 2.6],
    [x1 - 2.6, y1 - 2.6],
  ]) {
    blob(g, x, y, 0.8, sd + x, 1, 0.12);
    g.fill();
  }
  g.fillStyle = css(shift(T.light, 12, -10));
  for (const [x, y] of [
    [x0 + 2.4, y0 + 2.3],
    [x1 - 2.8, y0 + 2.3],
    [x0 + 2.4, y1 - 2.9],
    [x1 - 2.8, y1 - 2.9],
  ]) {
    blob(g, x, y, 0.3, sd, 1, 0.1);
    g.fill();
  }
  if (hash2(sd, 3, 6) < 0.18) crack(p, x0 + 4, y0 + 5, 0.9, 7, sd + 2);
}

/** The same plate, gone off: stains that run down from the seams. */
function rustMarks(p: Paint, x0: number, y0: number, x1: number, y1: number, sd: number) {
  plateMarks(p, x0, y0, x1, y1, sd);
  const { g, T } = p;
  g.fillStyle = css(shift(T.light, -2, 16, -4));
  const n = 1 + Math.floor(hash2(sd, 4, 6) * 3);
  for (let i = 0; i < n; i++) {
    const x = x0 + 3 + hash2(sd, i, 7) * (x1 - x0 - 6);
    const len = 5 + hash2(sd, i, 8) * 12;
    line(g, x, y0 + 1, x + (hash2(sd, i, 9) - 0.5) * 1.2, Math.min(y1, y0 + len), { w: 1.7, seed: sd + i, taper: [0.1, 0.8], press: 0.5 });
  }
}

/** Laid in beds: wavy bands of their own tone, with a broken line along each bedding plane. */
const strata: InkMaterial = (p) => {
  const { g, T, seed, ink, area } = p;
  fillArea(p, css(T.base));
  const H = 10;
  const tones = [css(shift(T.base, 4, -2)), css(T.base), css(shift(T.base, -6, 2)), css(shift(T.dark, 6, 2)), css(shift(T.light, -8, -6))];
  const bed = (k: number, x: number) => k * H + sn(x * 0.018, k * 0.7, seed) * 5 + sn(x * 0.07, k, seed + 1) * 1.1;
  const x0 = Math.floor(area.x0 / 6) * 6 - 6;
  const x1 = Math.ceil(area.x1 / 6) * 6 + 6;
  for (let k = Math.floor(area.y0 / H) - 2; k <= Math.ceil(area.y1 / H) + 2; k++) {
    g.fillStyle = tones[Math.floor(hash2(k, 1, seed) * tones.length)];
    g.beginPath();
    for (let x = x0; x <= x1; x += 6) g.lineTo(x, bed(k, x));
    for (let x = x1; x >= x0; x -= 6) g.lineTo(x, bed(k + 1, x) + 0.5);
    g.closePath();
    g.fill();
  }
  g.fillStyle = ink;
  for (let k = Math.floor(area.y0 / H) - 2; k <= Math.ceil(area.y1 / H) + 2; k++) {
    for (let c = Math.floor(x0 / 40); c * 40 < x1; c++) {
      if (hash2(c, k, seed + 2) < 0.45) continue;
      const pts: P[] = [];
      for (let x = c * 40; x <= c * 40 + 30; x += 5) pts.push({ x, y: bed(k, x) });
      stroke(g, pts, { w: 0.85, seed: c + k * 57, taper: [0.25, 0.45] });
    }
  }
  eachTile(p, (_, __, wx, wy) => {
    const r = hash2(wx, wy, seed + 3);
    if (r < 0.1) crack(p, wx + r * 90, wy + 4, 1.3, 9, wx + wy);
  });
};

/** Broken rock: angular planes of tone, long straight-sided cracks, and chips off the corners. */
const rockface: InkMaterial = (p) => {
  const { g, T, seed, ink, area } = p;
  fillArea(p, css(T.base));
  const C = 26;
  const planes = [css(shift(T.base, 5, -2)), css(shift(T.base, -5, 2)), css(shift(T.dark, 5, 2)), css(shift(T.light, -9, -6))];
  const deep = [css(shift(T.base, -6, 2)), css(shift(T.base, -10, 2)), css(shift(T.dark, 2, 2)), css(shift(T.base, -3, -2))];
  for (let cy = Math.floor(area.y0 / C) - 1; cy * C < area.y1 + C; cy++) {
    for (let cx = Math.floor(area.x0 / C) - 1; cx * C < area.x1 + C; cx++) {
      const sd = cx * 131 + cy * 977 + seed;
      const x = (cx + 0.5 + (hash2(cx, cy, seed + 1) - 0.5) * 0.7) * C;
      const y = (cy + 0.5 + (hash2(cx, cy, seed + 2) - 0.5) * 0.7) * C;
      const r = C * (0.5 + 0.34 * hash2(cx, cy, seed + 3));
      const n = 5 + Math.floor(hash2(cx, cy, seed + 4) * 2);
      const tone = Math.floor(hash2(cx, cy, seed + 5) * planes.length);
      g.fillStyle = (p.depth(Math.floor(x / TILE), Math.floor(y / TILE)) >= 3 ? deep : planes)[tone];
      g.beginPath();
      const start = hash2(cx, cy, seed + 6) * 6;
      const pts: P[] = [];
      for (let i = 0; i < n; i++) {
        const a = start + (i / n) * Math.PI * 2;
        const k = r * (0.72 + 0.4 * hash2(sd, i, 1));
        pts.push({ x: x + Math.cos(a) * k, y: y + Math.sin(a) * k * 0.8 });
      }
      pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
      g.closePath();
      g.fill();
      // Ink only the plane's underside, broken: rock is planes meeting, not outlined shapes.
      g.fillStyle = ink;
      for (let i = 0; i < n; i++) {
        const q = pts[i];
        const u = pts[(i + 1) % n];
        if ((q.y + u.y) / 2 > y && hash2(sd, i, 2) > 0.45) line(g, q.x, q.y, u.x, u.y, { w: 1.05, seed: sd + i, taper: [0.15, 0.5], press: 0.55 });
      }
    }
  }
  eachTile(p, (_, __, wx, wy) => {
    const r = hash2(wx, wy, seed + 8);
    if (r < 0.12) crack(p, wx + 3 + r * 80, wy + 3, 0.9 + r * 6, 8 + r * 60, wx * 3 + wy);
  });
};

/** Columnar basalt: tall six-sided posts set side by side, cooled and split. */
const columnar: InkMaterial = (p) => {
  const { T, seed, ink, area } = p;
  fillArea(p, css(shift(T.dark, -2)));
  const W = 14;
  const c: Coursing = { h: 30, w: W, stray: 0, round: 1.4, long: 0 };
  const tones = [css(shift(T.base, 6)), css(T.base), css(shift(T.base, -4)), css(shift(T.light, -8, -4)), css(shift(T.base, 3, 3))];
  const deep = [css(shift(T.base, 1)), css(shift(T.base, -4)), css(shift(T.base, -7)), css(shift(T.base, -2, -2)), css(shift(T.base, -3, 3))];
  const shade = css(shift(T.dark, -3, 4));
  const lit = css(shift(T.light, 8, -6));
  for (let k = Math.floor(area.x0 / W) - 2; k * W < area.x1 + W; k++) {
    const off = hash2(k, 1, seed) * 26;
    const j0 = hash2(k, 2, seed) * 3;
    const w = W + (hash2(k + 1, 2, seed) * 3 - j0);
    for (let i = Math.floor((area.y0 - off) / 30) - 1; i * 30 + off < area.y1 + 30; i++) {
      block(p, k * W + j0, i * 30 + off + (hash2(k, i, seed + 2) - 0.5) * 6, w, 30, c, tones, deep, shade, lit, ink, k * 977 + i * 131 + seed);
    }
  }
};

/** Spray paint a city's walls carry: hot pink, cyan, acid yellow. */
const SPRAY: HSL[] = [
  { h: 322, s: 85, l: 62 },
  { h: 188, s: 80, l: 56 },
  { h: 56, s: 90, l: 58 },
];

/**
 * A cast panel of a city block's concrete: the form's tie holes in a grid, each a recess with a lit lip,
 * rust weeping from one now and then, a cold joint where a pour stopped, a chipped corner, a patch, and
 * once in a long while a tag sprayed over it or a flyer pasted up.
 */
function concreteMarks(p: Paint, x0: number, y0: number, x1: number, y1: number, sd: number) {
  const { g, T, ink } = p;
  const w = x1 - x0;
  const h = y1 - y0;
  const r = hash2(sd, 1, 9);
  if (r < 0.07) {
    // A patch: newer, lighter render troweled over a repair, its edge not quite square.
    const px = x0 + 4 + hash2(sd, 2, 9) * (w - 18);
    const py = y0 + 4 + hash2(sd, 3, 9) * (h - 14);
    const pw = 9 + hash2(sd, 4, 9) * 6;
    const ph = 6 + hash2(sd, 5, 9) * 3;
    g.fillStyle = css(shift(T.light, -4, -8));
    g.beginPath();
    g.moveTo(px, py + 0.4);
    g.lineTo(px + pw, py);
    g.lineTo(px + pw + 0.5, py + ph);
    g.lineTo(px + 0.3, py + ph - 0.3);
    g.closePath();
    g.fill();
    g.fillStyle = css(shift(T.dark, 4));
    line(g, px + 0.3, py + ph - 0.2, px + pw + 0.5, py + ph, { w: 0.7, seed: sd, taper: [0.2, 0.4] });
    line(g, px + pw + 0.2, py + 0.4, px + pw + 0.5, py + ph - 0.6, { w: 0.6, seed: sd + 1, taper: [0.2, 0.5] });
  }
  // Tie holes: two across, two down, in the same place on every panel the form cast.
  const holes: [number, number][] = [];
  for (const fx of [0.22, 0.78]) for (const fy of [0.28, 0.72]) holes.push([x0 + w * fx, y0 + h * fy]);
  const lip = css(shift(T.light, 8, -8));
  for (const [hx, hy] of holes) {
    g.fillStyle = ink;
    blob(g, hx, hy, 1.05, sd + hx, 1, 0.1);
    g.fill();
    g.fillStyle = lip;
    line(g, hx - 0.9, hy + 1.3, hx + 1.1, hy + 0.8, { w: 0.55, seed: sd + hy, taper: [0.3, 0.3], press: 0 });
  }
  if (r > 0.62) {
    // Rust weeping from a tie hole, pooling a little at the foot of the streak.
    const [hx, hy] = holes[Math.floor(hash2(sd, 6, 9) * 4)];
    const len = 6 + hash2(sd, 7, 9) * Math.min(14, y1 - hy - 1);
    g.fillStyle = css({ h: 24, s: 38, l: Math.max(18, T.base.l - 8) }, undefined, 0.7);
    line(g, hx, hy + 1, hx + (hash2(sd, 8, 9) - 0.5) * 1.4, hy + 1 + len, { w: 1.5, seed: sd + 2, taper: [0.05, 0.85], press: 0.5 });
  }
  const r2 = hash2(sd, 9, 9);
  if (r2 < 0.3) {
    // A cold joint: where one pour stopped and the next began, a broken line across the panel.
    const cy = y0 + h * (0.45 + hash2(sd, 10, 9) * 0.1);
    g.fillStyle = css(shift(T.dark, 6, -2));
    const a = x0 + 2 + hash2(sd, 11, 9) * 6;
    const b = x1 - 2 - hash2(sd, 12, 9) * 10;
    line(g, a, cy, b, cy + (hash2(sd, 13, 9) - 0.5) * 1.2, { w: 0.75, seed: sd + 3, taper: [0.2, 0.3], press: 0.3 });
  } else if (r2 < 0.42)
    crack(p, x0 + w * (0.3 + hash2(sd, 14, 9) * 0.4), y0 + 3, 1 + hash2(sd, 15, 9) * 1.2, Math.min(h - 4, 10 + hash2(sd, 16, 9) * 8), sd + 4);
  else if (r2 < 0.52) {
    // A chipped corner: the aggregate shows where it spalled off.
    const left = hash2(sd, 17, 9) < 0.5;
    const cx = left ? x0 + 0.5 : x1 - 0.5;
    const cy = y1 - 0.5;
    const s = left ? 1 : -1;
    g.fillStyle = css(shift(T.dark, 2, 4));
    g.beginPath();
    g.moveTo(cx, cy - 4.5);
    g.lineTo(cx + s * 2.2, cy - 2.6);
    g.lineTo(cx + s * 4.8, cy - 0.4);
    g.lineTo(cx, cy);
    g.closePath();
    g.fill();
    g.fillStyle = ink;
    line(g, cx, cy - 4.5, cx + s * 2.2, cy - 2.6, { w: 0.6, seed: sd + 5, taper: [0.2, 0.2] });
    line(g, cx + s * 2.2, cy - 2.6, cx + s * 4.8, cy - 0.4, { w: 0.6, seed: sd + 6, taper: [0.2, 0.2] });
    g.fillStyle = css(shift(T.light, -2, -10));
    for (let i = 0; i < 3; i++) {
      blob(g, cx + s * (0.9 + hash2(sd, 18 + i, 9) * 1.6), cy - 0.9 - hash2(sd, 21 + i, 9) * 1.8, 0.35, sd + i, 1, 0.1);
      g.fill();
    }
  }
  const r3 = hash2(sd, 24, 9);
  if (r3 < 0.035 && w > 30) {
    // A tag: one loop-and-swash in spray paint, never a word.
    const col = SPRAY[Math.floor(hash2(sd, 25, 9) * SPRAY.length)];
    const tx = x0 + 6 + hash2(sd, 26, 9) * (w - 26);
    const ty = y0 + h * 0.5;
    const pts: P[] = [];
    for (let i = 0; i <= 22; i++) {
      const t = i / 22;
      pts.push({ x: tx + t * 16 + Math.sin(t * 14 + sd) * 2.4, y: ty + Math.cos(t * 9 + sd) * 3.4 - t * 2 });
    }
    g.fillStyle = css(col, -28);
    stroke(
      g,
      pts.map((q) => ({ x: q.x + 0.5, y: q.y + 0.6 })),
      { w: 1.6, seed: sd + 7, taper: [0.1, 0.3], press: 0.4 },
    );
    g.fillStyle = css(col);
    stroke(g, pts, { w: 1.2, seed: sd + 7, taper: [0.1, 0.3], press: 0.4 });
    line(g, tx - 1, ty + 5, tx + 17, ty + 3.4, { w: 0.9, seed: sd + 8, taper: [0.05, 0.6], press: 0.5 });
  } else if (r3 < 0.07 && h > 20) {
    // A flyer pasted up, one corner torn off, a headline and two lines of type.
    const fx = x0 + 5 + hash2(sd, 27, 9) * (w - 18);
    const fy = y0 + 4 + hash2(sd, 28, 9) * (h - 18);
    const paper = { h: 48, s: 30, l: 86 };
    g.fillStyle = css(paper, -24);
    g.fillRect(fx + 0.8, fy + 0.8, 8, 10);
    g.fillStyle = css(paper);
    g.beginPath();
    g.moveTo(fx, fy);
    g.lineTo(fx + 8, fy);
    g.lineTo(fx + 8, fy + 7.4);
    g.lineTo(fx + 6.2, fy + 8.2);
    g.lineTo(fx + 5.4, fy + 10);
    g.lineTo(fx, fy + 10);
    g.closePath();
    g.fill();
    g.fillStyle = css(SPRAY[Math.floor(hash2(sd, 29, 9) * SPRAY.length)], -12);
    g.fillRect(fx + 1, fy + 1.2, 6, 2.2);
    g.fillStyle = ink;
    line(g, fx + 1.2, fy + 5, fx + 6.6, fy + 5, { w: 0.5, seed: sd + 9, taper: [0.1, 0.1], press: 0 });
    line(g, fx + 1.2, fy + 6.8, fx + 5, fy + 6.8, { w: 0.5, seed: sd + 10, taper: [0.1, 0.1], press: 0 });
  }
}

/** A city block's concrete: cast panels in a stacked grid, each with its own tone and its own wear. */
const castPanels = masonry({ h: 32, w: 48, stray: 0, round: 1.2, long: 0.08, stack: true, even: true, mark: concreteMarks });

/** Packed sand: ripples, and grit that gathers in them. */
const sand: InkMaterial = (p) => {
  const { g, T, seed } = p;
  fillArea(p, css(T.base));
  g.fillStyle = css(shift(T.base, -5, 2));
  tonePatch(p, (d) => d >= 3);
  const speck = css(shift(T.dark, 4));
  eachTile(p, (_, __, wx, wy) => {
    g.fillStyle = css(shift(T.light, -2, -4));
    const pts: P[] = [];
    const y = wy + 4 + hash2(wx, wy, seed) * 8;
    for (let i = 0; i <= 5; i++) pts.push({ x: wx + i * 3.4, y: y + sn((wx + i * 3.4) * 0.09, wy * 0.09, seed) * 1.6 });
    stroke(g, pts, { w: 1, seed: wx + wy, taper: [0.3, 0.5] });
    g.fillStyle = speck;
    for (let i = 0; i < 3; i++) {
      blob(g, wx + hash2(wx, i, seed + 1) * 16, wy + hash2(wy, i, seed + 2) * 16, 0.4, i, 1, 0.1);
      g.fill();
    }
  });
};

/** Ashlar: big dressed blocks. */
const ashlar = masonry({ h: 11, w: 19, stray: 0.34, round: 1.6, long: 0.16 });
const brickwork = masonry({ h: 5.5, w: 12, stray: 0.12, round: 0.7, long: 0.04 });
const cobbles = masonry({ h: 8.5, w: 10, stray: 0.5, round: 3, long: 0 });
const boards = masonry({ h: 9.5, w: 46, stray: 0.5, round: 0.6, long: 0.1, mark: boardMarks });
const plates = masonry({ h: 24, w: 32, stray: 0, round: 1, long: 0, stack: true, mark: plateMarks });
const rusted = masonry({ h: 24, w: 32, stray: 0, round: 1, long: 0, stack: true, mark: rustMarks });

/**
 * Ice: big glassy facets, a sheen dragged across them, fracture lines and trapped bubbles. No ink inside
 * the ice: it's clear, so its marks are tones of itself, and a glance tells it from the rock around it.
 */
const glass: InkMaterial = (p) => {
  const { g, T, seed, area } = p;
  fillArea(p, css(T.base));
  const C = 30;
  const planes = [css(shift(T.base, 4, -3)), css(shift(T.base, -4, 3)), css(shift(T.base, 8, -8)), css(shift(T.base, -8, 6))];
  const deep = [css(shift(T.base, -4, 2)), css(shift(T.base, -9, 4)), css(shift(T.dark, 10, -4)), css(shift(T.base, -2, -2))];
  for (let cy = Math.floor(area.y0 / C) - 1; cy * C < area.y1 + C; cy++) {
    for (let cx = Math.floor(area.x0 / C) - 1; cx * C < area.x1 + C; cx++) {
      const x = (cx + 0.5 + (hash2(cx, cy, seed + 1) - 0.5) * 0.6) * C;
      const y = (cy + 0.5 + (hash2(cx, cy, seed + 2) - 0.5) * 0.6) * C;
      const r = C * (0.5 + 0.3 * hash2(cx, cy, seed + 3));
      const n = 4 + Math.floor(hash2(cx, cy, seed + 4) * 2);
      const tone = Math.floor(hash2(cx, cy, seed + 5) * planes.length);
      g.fillStyle = (p.depth(Math.floor(x / TILE), Math.floor(y / TILE)) >= 3 ? deep : planes)[tone];
      g.beginPath();
      const start = hash2(cx, cy, seed + 6) * 6;
      for (let i = 0; i < n; i++) {
        const a = start + (i / n) * Math.PI * 2;
        const k = r * (0.75 + 0.35 * hash2(cx * 31 + cy, i, seed + 7));
        const px = x + Math.cos(a) * k;
        const py = y + Math.sin(a) * k * 0.75;
        if (i) g.lineTo(px, py);
        else g.moveTo(px, py);
      }
      g.closePath();
      g.fill();
    }
  }
  const fracture = css(shift(T.dark, -6, 6));
  const sheen = css(shift(T.light, 6, -6));
  eachTile(p, (_, __, wx, wy) => {
    const r = hash2(wx, wy, seed + 8);
    const sd = wx * 7 + wy * 13 + seed;
    if (r < 0.1) {
      // A fracture: two straight legs at an angle, the way ice splits.
      const a = 0.4 + hash2(wx, wy, seed + 9) * 2.2;
      const len = 6 + hash2(wx, wy, seed + 10) * 10;
      const mx = wx + 4 + r * 80;
      const my = wy + 5;
      g.fillStyle = fracture;
      line(g, mx, my, mx + Math.cos(a) * len, my + Math.sin(a) * len, { w: 0.8, seed: sd, taper: [0.1, 0.7] });
      line(g, mx, my, mx + Math.cos(a + 2.4) * len * 0.6, my + Math.sin(a + 2.4) * len * 0.6, { w: 0.65, seed: sd + 1, taper: [0.1, 0.7] });
    } else if (r < 0.32) {
      // Sheen: a pair of parallel diagonals, the long one first.
      const sx = wx + 2 + hash2(wx, wy, seed + 11) * 8;
      const sy = wy + 12 - hash2(wx, wy, seed + 12) * 4;
      const len = 6 + hash2(wx, wy, seed + 13) * 7;
      g.fillStyle = sheen;
      line(g, sx, sy, sx + len * 0.7, sy - len * 0.7, { w: 1.3, seed: sd, taper: [0.2, 0.5], press: 0.4 });
      line(g, sx + 3, sy + 0.5, sx + 3 + len * 0.35, sy + 0.5 - len * 0.35, { w: 0.8, seed: sd + 2, taper: [0.2, 0.5] });
    } else if (r < 0.42) {
      // Bubbles caught in the ice.
      g.fillStyle = sheen;
      for (let i = 0; i < 3; i++) {
        blob(g, wx + 3 + hash2(wx, i, seed + 14) * 10, wy + 3 + hash2(wy, i, seed + 15) * 10, 0.5 + hash2(i, sd, 3) * 0.6, sd + i, 1, 0.1);
        g.fill();
      }
    }
  });
};

/** Regolith: dust over rock, pocked with craters (shadow inside, a lit rim on the far side) and grit. */
const regolith: InkMaterial = (p) => {
  const { g, T, seed, ink } = p;
  fillArea(p, css(T.base));
  g.fillStyle = css(shift(T.base, -6, 2));
  tonePatch(p, (d) => d >= 2);
  g.fillStyle = css(shift(T.dark, 4, 2));
  tonePatch(p, (d) => d >= 4);
  const shadow = css(shift(T.dark, -2, 4));
  const rim = css(shift(T.light, 2, -6));
  const speck = css(shift(T.dark, -4));
  eachTile(p, (x, y, wx, wy) => {
    const roll = hash2(wx, wy, seed + 20);
    const px = wx + 3 + hash2(wx, wy, seed + 21) * 10;
    const py = wy + 3 + hash2(wx, wy, seed + 22) * 10;
    const sd = ((wx * 7 + wy * 11) | 0) + seed;
    if (roll < 0.16 && p.depth(x, y) >= 1) {
      const r = 2.2 + hash2(wx, wy, seed + 23) * 3.4;
      g.fillStyle = shadow;
      blob(g, px - r * 0.12, py - r * 0.1, r, sd, 0.62, 0.15);
      g.fill();
      g.fillStyle = rim;
      const lit: P[] = [];
      for (let i = 0; i <= 7; i++) {
        const a = 0.1 + (i / 7) * 2.6;
        lit.push({ x: px + Math.cos(a) * r * 1.1, y: py + Math.sin(a) * r * 0.72 });
      }
      stroke(g, lit, { w: 1.2, seed: sd, taper: [0.2, 0.4] });
      g.fillStyle = ink;
      const dark: P[] = [];
      for (let i = 0; i <= 7; i++) {
        const a = 3.3 + (i / 7) * 2.4;
        dark.push({ x: px + Math.cos(a) * r * 1.05, y: py + Math.sin(a) * r * 0.7 });
      }
      stroke(g, dark, { w: 0.9, seed: sd + 1, taper: [0.15, 0.5] });
    } else if (roll < 0.26) crack(p, px, py, hash2(wx, wy, seed + 24) * 2 + 0.6, 6 + hash2(wx, wy, seed + 25) * 8, sd);
    else if (roll < 0.6) {
      g.fillStyle = speck;
      for (let i = 0; i < 4; i++) {
        blob(g, px + hash2(i, wx, seed + 29) * 9 - 4, py + hash2(i, wy, seed + 30) * 9 - 4, 0.4 + hash2(i, sd, 1) * 0.4, sd + i, 1, 0.1);
        g.fill();
      }
    }
  });
};

/** Station hull: plate with rivets, and now and then a porthole, a vent grille or a band of hazard stripes. */
function hullMarks(p: Paint, x0: number, y0: number, x1: number, y1: number, sd: number) {
  plateMarks(p, x0, y0, x1, y1, sd);
  const { g, ink } = p;
  const r = hash2(sd, 11, 6);
  const cx = (x0 + x1) / 2 + (hash2(sd, 12, 6) - 0.5) * (x1 - x0) * 0.4;
  const cy = (y0 + y1) / 2;
  if (r < 0.14 && y1 - y0 > 9) {
    // Porthole: a dark disc, a lit pane, a rim that doesn't quite close.
    g.fillStyle = ink;
    blob(g, cx, cy, 3.4, sd, 1, 0.06);
    g.fill();
    g.fillStyle = css({ h: 200, s: 60, l: 62 });
    blob(g, cx + 0.3, cy + 0.3, 2.2, sd + 1, 1, 0.06);
    g.fill();
    g.fillStyle = css({ h: 200, s: 40, l: 90 });
    line(g, cx - 1, cy + 0.4, cx + 0.6, cy - 1.2, { w: 0.8, seed: sd, taper: [0.2, 0.5] });
  } else if (r < 0.28) {
    g.fillStyle = ink;
    for (let i = 0; i < 3; i++) line(g, cx - 4, cy - 2.5 + i * 2.5, cx + 4, cy - 2.5 + i * 2.5, { w: 0.9, seed: sd + i, taper: [0.15, 0.15] });
  } else if (r < 0.38 && x1 - x0 > 14) {
    // Hazard stripes along the plate's foot.
    const yb = y1 - 1;
    const yt = y1 - 4.5;
    for (let x = x0 + 1.5, i = 0; x < x1 - 3; x += 3.2, i++) {
      g.fillStyle = i % 2 ? css({ h: 48, s: 92, l: 52 }) : css({ h: 230, s: 20, l: 14 });
      g.beginPath();
      g.moveTo(x, yb);
      g.lineTo(x + 3.2, yb);
      g.lineTo(x + 5.2, yt);
      g.lineTo(x + 2, yt);
      g.closePath();
      g.fill();
    }
  }
}

const hullPlates = masonry({ h: 16, w: 32, stray: 0, round: 1.2, long: 0.25, stack: true, mark: hullMarks });

/*
 * Landmark skins (docs/SETPIECES.md): what a built thing is made of, for the tiles inside a landmark's box.
 * No theme lays these as its ground, so each says "somebody built this" at a glance next to the theme's own.
 */

/** Storey and bay of a half-timbered wall, in world px: a frame member lands on every one, wherever the wall starts. */
const STOREY = 32;
const BAY = 24;

/**
 * Half-timbering: plaster panels in a frame of dark beams, a brace across some bays, pegs at the joints,
 * and here and there plaster fallen away to show the laths. `base` is the plaster, `dark` the timber.
 */
const halfTimber: InkMaterial = (p) => {
  const { g, T, seed, ink, area } = p;
  fillArea(p, css(T.base));
  const plaster = [css(T.base), css(shift(T.base, -4, 2)), css(shift(T.light, -5, -4)), css(shift(T.base, 2, -2))];
  const wood = css(T.dark);
  const woodLit = css(shift(T.dark, 13, -6));
  const grain = css(shift(T.dark, 7, -4));
  const r0 = Math.floor(area.y0 / STOREY) - 1;
  const r1 = Math.ceil(area.y1 / STOREY) + 1;
  const j0 = Math.floor(area.x0 / BAY) - 1;
  const j1 = Math.ceil(area.x1 / BAY) + 1;
  // Panels first: each its own tone, its own wear.
  for (let r = r0; r <= r1; r++) {
    for (let j = j0; j <= j1; j++) {
      const x = j * BAY;
      const y = r * STOREY;
      const sd = j * 977 + r * 131 + seed;
      g.fillStyle = plaster[Math.floor(hash2(j, r, seed + 1) * plaster.length)];
      g.fillRect(x + 1.5, y + 1.5, BAY - 3, STOREY - 3);
      const roll = hash2(j, r, seed + 2);
      if (roll < 0.1) {
        // Plaster fallen off: the laths behind it, in a ragged hole.
        const hx = x + 5 + hash2(j, r, seed + 3) * (BAY - 14);
        const hy = y + 7 + hash2(j, r, seed + 4) * (STOREY - 18);
        g.fillStyle = css(shift(T.dark, 16, -10));
        blob(g, hx + 3, hy + 3, 3.6, sd, 0.8, 0.45);
        g.fill();
        g.fillStyle = css(shift(T.dark, 26, -14));
        for (let i = 0; i < 3; i++) line(g, hx - 0.5, hy + 1 + i * 2.2, hx + 6.5, hy + 1 + i * 2.2, { w: 0.9, seed: sd + i, taper: [0.1, 0.1], press: 0 });
        g.fillStyle = ink;
        const rim: P[] = [];
        for (let i = 0; i <= 8; i++) {
          const a = 3.4 + (i / 8) * 3.2;
          rim.push({ x: hx + 3 + Math.cos(a) * 4, y: hy + 3 + Math.sin(a) * 3.2 });
        }
        stroke(g, rim, { w: 0.9, seed: sd, taper: [0.2, 0.4] });
      } else if (roll < 0.22) crack(p, x + 4 + hash2(j, r, seed + 5) * (BAY - 8), y + 4, 1.2 + hash2(j, r, seed + 6) * 0.8, 8 + hash2(j, r, seed + 7) * 9, sd);
    }
  }
  /** One frame member: a band of timber with a lit edge, grain, and ink along its underside. */
  const member = (ax: number, ay: number, bx: number, by: number, w: number, sd: number) => {
    g.fillStyle = wood;
    line(g, ax, ay, bx, by, { w, seed: sd, taper: [0, 0], press: 0.05, wobble: 0.15 });
    const d = Math.hypot(bx - ax, by - ay) || 1;
    const nx = (by - ay) / d;
    const ny = -(bx - ax) / d;
    const k = ny > 0 || (ny === 0 && nx > 0) ? -1 : 1;
    g.fillStyle = woodLit;
    line(g, ax + nx * k * w * 0.32, ay + ny * k * w * 0.32, bx + nx * k * w * 0.32, by + ny * k * w * 0.32, {
      w: w * 0.28,
      seed: sd + 1,
      taper: [0.15, 0.2],
      press: 0,
    });
    if (hash2(sd, 2, 4) > 0.4) {
      g.fillStyle = grain;
      const t = 0.2 + hash2(sd, 3, 4) * 0.4;
      line(g, ax + (bx - ax) * t, ay + (by - ay) * t, ax + (bx - ax) * (t + 0.3), ay + (by - ay) * (t + 0.3), { w: 0.6, seed: sd + 2, taper: [0.3, 0.5] });
    }
    g.fillStyle = ink;
    line(g, ax - nx * k * w * 0.5, ay - ny * k * w * 0.5, bx - nx * k * w * 0.5, by - ny * k * w * 0.5, {
      w: 0.9,
      seed: sd + 3,
      taper: [0.15, 0.2],
      press: 0.5,
    });
  };
  for (let r = r0; r <= r1; r++) {
    for (let j = j0; j <= j1; j++) {
      const x = j * BAY;
      const y = r * STOREY;
      const sd = j * 977 + r * 131 + seed;
      if (hash2(j, r, seed + 8) < 0.32) {
        const up = hash2(j, r, seed + 9) < 0.5;
        member(x + 2, up ? y + STOREY - 2 : y + 2, x + BAY - 2, up ? y + 2 : y + STOREY - 2, 2.6, sd + 10);
      }
      member(x, y + 1, x, y + STOREY - 1, 3.6, sd + 20);
    }
  }
  for (let r = r0; r <= r1; r++)
    for (let j = j0; j <= j1; j++) member(j * BAY - 1, r * STOREY, (j + 1) * BAY + 1, r * STOREY, 4, j * 977 + r * 131 + seed + 30);
  // Pegs where post meets rail.
  g.fillStyle = ink;
  for (let r = r0; r <= r1; r++) {
    for (let j = j0; j <= j1; j++) {
      if (hash2(j, r, seed + 11) < 0.35) continue;
      blob(g, j * BAY + 0.3, r * STOREY + 3.6, 0.6, j * 31 + r, 1, 0.15);
      g.fill();
    }
  }
};

/** A line cut into stone: the shadowed wall of the groove, then the lit one just under it. */
function incise(g: CanvasRenderingContext2D, pts: readonly P[], shade: string, lit: string, sd: number) {
  g.fillStyle = shade;
  stroke(g, pts, { w: 1.15, seed: sd, taper: [0.15, 0.25], press: 0.3 });
  g.fillStyle = lit;
  stroke(
    g,
    pts.map((q) => ({ x: q.x + 0.55, y: q.y + 0.6 })),
    { w: 0.55, seed: sd + 1, taper: [0.2, 0.3], press: 0 },
  );
}

const MOSS: HSL = { h: 96, s: 34, l: 31 };

/**
 * Carved stone: dressed blocks, a course of chevrons now and then, and blocks cut with spirals, sun discs
 * and step frets, with moss creeping over their tops. The carvings are grooves, not ink: shadow and lit lip.
 */
function carvedMarks(p: Paint, x0: number, y0: number, x1: number, y1: number, sd: number) {
  const { g, T, seed } = p;
  const shade = css(shift(T.dark, 4, 4));
  const lit = css(shift(T.light, 8, -8));
  const w = x1 - x0;
  const h = y1 - y0;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const course = Math.round(y0 / 16);
  if (hash2(course, 7, seed) < 0.22) {
    // A frieze: the whole course carries the same chevrons, so it reads as one band across the wall.
    const pts: P[] = [];
    for (let x = Math.ceil(x0 / 4) * 4; x <= x1 - 1; x += 4) pts.push({ x, y: cy + ((x / 4) & 1 ? -2.4 : 2.4) });
    if (pts.length >= 2) incise(g, pts, shade, lit, sd);
  } else {
    const roll = hash2(sd, 21, 3);
    if (roll < 0.14) {
      // A spiral, two and a half turns.
      const rmax = Math.min(w, h) * 0.36;
      const pts: P[] = [];
      for (let i = 0; i <= 26; i++) {
        const t = i / 26;
        const a = t * Math.PI * 5 + sd;
        pts.push({ x: cx + Math.cos(a) * rmax * t, y: cy + Math.sin(a) * rmax * t * 0.9 });
      }
      incise(g, pts, shade, lit, sd);
    } else if (roll < 0.22) {
      // A sun: a ring and its rays.
      const r = Math.min(w, h) * 0.22;
      const ring: P[] = [];
      for (let i = 0; i <= 12; i++) ring.push({ x: cx + Math.cos((i / 12) * 6.28) * r, y: cy + Math.sin((i / 12) * 6.28) * r });
      incise(g, ring, shade, lit, sd);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * 6.28 + 0.2;
        incise(
          g,
          [
            { x: cx + Math.cos(a) * (r + 1.2), y: cy + Math.sin(a) * (r + 1.2) },
            { x: cx + Math.cos(a) * (r + 3.2), y: cy + Math.sin(a) * (r + 3.2) },
          ],
          shade,
          lit,
          sd + i,
        );
      }
    } else if (roll < 0.32) {
      // A step fret: the key pattern, climbing.
      const s = Math.min(3, h / 4);
      const pts: P[] = [{ x: x0 + 2, y: y1 - 2 }];
      for (let x = x0 + 2; x < x1 - s - 2; x += s * 2) {
        const last = pts[pts.length - 1];
        pts.push({ x: x + s, y: last.y }, { x: x + s, y: last.y === y1 - 2 ? y0 + 2.5 : y1 - 2 });
      }
      incise(g, pts, shade, lit, sd);
    } else if (roll < 0.5) {
      g.fillStyle = shade;
      for (let i = 0; i < 3; i++) line(g, cx + i * 1.6, cy + i * 0.5, cx + i * 1.6 + 1.2, cy + i * 0.5 + 2.2, { w: 0.65, seed: sd + i, taper: [0.2, 0.6] });
    }
  }
  if (hash2(sd, 22, 3) < 0.2) {
    // Moss on the block's top, a drip or two hanging off it.
    const mx = x0 + 3 + hash2(sd, 23, 3) * (w - 6);
    g.fillStyle = css(MOSS);
    blob(g, mx, y0 + 0.8, 2.6 + hash2(sd, 24, 3) * 2, sd, 0.5, 0.4);
    g.fill();
    g.fillStyle = css(MOSS, 9);
    blob(g, mx - 0.8, y0 + 0.2, 1.6, sd + 1, 0.5, 0.3);
    g.fill();
    g.fillStyle = css(MOSS, -6);
    line(g, mx + 1, y0 + 1.5, mx + 1.3, y0 + 3.5 + hash2(sd, 25, 3) * 4, { w: 1.2, seed: sd, taper: [0.1, 0.9], press: 0 });
  }
}

const carvedStone = masonry({ h: 16, w: 24, stray: 0.14, round: 1.3, long: 0.12, mark: carvedMarks });

/** A cut block of ice: a lighter facet off its top corner, a sheen, now and then bubbles. No cracks of ink: it's clear. */
function iceMarks(p: Paint, x0: number, y0: number, x1: number, y1: number, sd: number) {
  const { g, T } = p;
  const w = x1 - x0;
  const h = y1 - y0;
  const r = hash2(sd, 1, 11);
  g.fillStyle = css(shift(T.light, -3, -6));
  g.beginPath();
  g.moveTo(x0 + 1.4, y0 + 1.4);
  g.lineTo(x0 + w * (0.45 + 0.25 * r), y0 + 1.4);
  g.lineTo(x0 + 1.4, y0 + h * (0.55 + 0.3 * hash2(sd, 2, 11)));
  g.closePath();
  g.fill();
  const sheen = css(shift(T.light, 8, -12));
  g.fillStyle = sheen;
  if (r < 0.45) {
    const sx = x0 + w * 0.35;
    const sy = y1 - 2.5;
    line(g, sx, sy, sx + 5, sy - 6, { w: 1.1, seed: sd, taper: [0.2, 0.5], press: 0.4 });
    line(g, sx + 2.6, sy, sx + 5, sy - 3, { w: 0.7, seed: sd + 1, taper: [0.2, 0.5] });
  } else if (r < 0.62) {
    for (let i = 0; i < 3; i++) {
      blob(g, x0 + 3 + hash2(sd, i, 12) * (w - 6), y0 + 3 + hash2(sd, i, 13) * (h - 6), 0.45 + hash2(sd, i, 14) * 0.5, sd + i, 1, 0.1);
      g.fill();
    }
  }
}

const iceBlocks = masonry({ h: 14, w: 22, stray: 0.2, round: 2.2, long: 0.06, mark: iceMarks });

/**
 * Crystal: a cluster of prisms grown at their own angles, each split down its length into a lit face and
 * a shadow face, with a hard glint near the tip and ink only down the shadow side.
 */
const crystalline: InkMaterial = (p) => {
  const { g, T, seed, ink, area } = p;
  fillArea(p, css(shift(T.dark, -4)));
  const C = 20;
  for (let cy = Math.floor(area.y0 / C) - 2; cy * C < area.y1 + 2 * C; cy++) {
    for (let cx = Math.floor(area.x0 / C) - 2; cx * C < area.x1 + 2 * C; cx++) {
      const sd = cx * 131 + cy * 977 + seed;
      const x = (cx + 0.5 + (hash2(cx, cy, seed + 1) - 0.5) * 0.6) * C;
      const y = (cy + 0.5 + (hash2(cx, cy, seed + 2) - 0.5) * 0.6) * C;
      const a = -Math.PI / 2 + (hash2(cx, cy, seed + 3) - 0.5) * 1.9;
      const L = C * (0.9 + 0.6 * hash2(cx, cy, seed + 4));
      const W = C * (0.34 + 0.22 * hash2(cx, cy, seed + 5));
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const nx = -dy;
      const ny = dx;
      const bx = x - (dx * L) / 2;
      const by = y - (dy * L) / 2;
      const sx = x + dx * (L / 2 - W * 0.65);
      const sy = y + dy * (L / 2 - W * 0.65);
      const tip = { x: x + (dx * L) / 2, y: y + (dy * L) / 2 };
      const hw = W / 2;
      const side = (k: number): P[] => [
        { x: bx, y: by },
        { x: bx + nx * hw * k, y: by + ny * hw * k },
        { x: sx + nx * hw * k, y: sy + ny * hw * k },
        tip,
        { x: sx, y: sy },
      ];
      // The face whose normal leans toward the light (upper left) is the lit one.
      const litK = nx * -0.6 + ny * -0.8 > 0 ? 1 : -1;
      const deep = p.depth(Math.floor(x / TILE), Math.floor(y / TILE)) >= 3;
      const fill = (pts: P[], c: string) => {
        g.fillStyle = c;
        g.beginPath();
        pts.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
        g.closePath();
        g.fill();
      };
      const tone = hash2(cx, cy, seed + 6);
      fill(side(-litK), css(shift(T.base, deep ? -10 : -3 - tone * 4, 2)));
      fill(side(litK), css(shift(T.light, deep ? -12 : -2 - tone * 6, -4)));
      // The tip's own facet, lighter still.
      fill([{ x: sx + nx * hw * litK, y: sy + ny * hw * litK }, tip, { x: sx, y: sy }], css(shift(T.light, deep ? -4 : 8, -10)));
      g.fillStyle = ink;
      stroke(g, [{ x: bx - nx * hw * litK, y: by - ny * hw * litK }, { x: sx - nx * hw * litK, y: sy - ny * hw * litK }, tip], {
        w: 1.15,
        seed: sd,
        taper: [0.1, 0.35],
        press: 0.5,
      });
      if (!deep && hash2(cx, cy, seed + 7) > 0.35) {
        g.fillStyle = css({ h: T.light.h, s: 30, l: 96 });
        const gx = sx + nx * hw * litK * 0.5;
        const gy = sy + ny * hw * litK * 0.5;
        line(g, gx - dx * 4, gy - dy * 4, gx + dx * 1.5, gy + dy * 1.5, { w: 0.9, seed: sd + 1, taper: [0.3, 0.4], press: 0 });
      }
    }
  }
};

/** Bone: ivory with long grain, pores in clusters, a crack, and the odd dark knuckle where two pieces meet. */
const ivory: InkMaterial = (p) => {
  const { g, T, seed, ink, area } = p;
  fillArea(p, css(T.base));
  g.fillStyle = css(shift(T.base, -5, 3));
  tonePatch(p, (d) => d >= 2);
  g.fillStyle = css(shift(T.dark, 12, -6));
  const G = 30;
  for (let k = Math.floor(area.y0 / 5) - 1; k * 5 < area.y1 + 5; k++) {
    for (let c = Math.floor(area.x0 / G) - 1; c * G < area.x1 + G; c++) {
      if (hash2(c, k, seed + 1) < 0.55) continue;
      const x = c * G + hash2(c, k, seed + 2) * 10;
      const y = k * 5 + hash2(k, c, seed + 3) * 2;
      const len = 10 + hash2(c, k, seed + 4) * 14;
      const pts: P[] = [];
      for (let i = 0; i <= 5; i++) pts.push({ x: x + (len * i) / 5, y: y + sn((x + (len * i) / 5) * 0.06, k, seed) * 1.1 });
      stroke(g, pts, { w: 0.6, seed: c * 31 + k, taper: [0.3, 0.6] });
    }
  }
  const pore = css(shift(T.dark, 2, 2));
  eachTile(p, (_, __, wx, wy) => {
    const r = hash2(wx, wy, seed + 5);
    const sd = wx * 7 + wy * 13 + seed;
    if (r < 0.35) {
      g.fillStyle = pore;
      const px = wx + 3 + hash2(wx, wy, seed + 6) * 10;
      const py = wy + 3 + hash2(wx, wy, seed + 7) * 10;
      for (let i = 0; i < 4; i++) {
        blob(g, px + hash2(i, wx, seed + 8) * 5 - 2.5, py + hash2(i, wy, seed + 9) * 5 - 2.5, 0.35 + hash2(i, sd, 1) * 0.35, sd + i, 1, 0.1);
        g.fill();
      }
    } else if (r < 0.43) crack(p, wx + 4, wy + 4, 0.8 + hash2(wx, wy, seed + 10) * 1.5, 8 + hash2(wx, wy, seed + 11) * 8, sd);
    else if (r < 0.48) {
      // A knuckle: a darker band across, inked on its shadow side.
      g.fillStyle = css(shift(T.dark, 8, -2));
      blob(g, wx + 8, wy + 8, 4.5, sd, 0.45, 0.25);
      g.fill();
      g.fillStyle = ink;
      line(g, wx + 4, wy + 10, wx + 12, wy + 10.4, { w: 0.8, seed: sd, taper: [0.2, 0.4] });
    }
  });
};

export const INK_MATERIALS: Record<TerrainKind, InkMaterial> = {
  dirt: soil,
  loam: soil,
  organic: soil,
  sand,
  strata,
  rock: rockface,
  cave: rockface,
  crystal: crystalline,
  basalt: columnar,
  stone: ashlar,
  brick: brickwork,
  cobble: cobbles,
  planks: boards,
  barnboard: boards,
  metal: plates,
  rustplate: rusted,
  concrete: castPanels,
  ice: glass,
  regolith,
  hull: hullPlates,
  timber: halfTimber,
  carved: carvedStone,
  iceblock: iceBlocks,
  bone: ivory,
};
