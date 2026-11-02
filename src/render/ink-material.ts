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
  /** What a block has on it, instead of chisel marks. */
  mark?: (p: Paint, x0: number, y0: number, x1: number, y1: number, seed: number) => void;
}

/** Laid masonry: courses of blocks on a fixed lattice, each with its own tone and its own hand. */
function masonry(c: Coursing): InkMaterial {
  return (p) => {
    const { T, seed, ink, area } = p;
    fillArea(p, css(shift(T.dark, 3, -6)));
    const tones = [css(shift(T.base, 7, -2)), css(T.base), css(shift(T.base, -5, 2)), css(shift(T.light, -6, -6)), css(shift(T.base, 3, 4, 6))];
    const deep = [css(shift(T.base, -6, 0)), css(shift(T.base, -9, 2)), css(shift(T.base, -12, 2)), css(shift(T.base, -4, -4)), css(shift(T.base, -8, 4, 6))];
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

/** Poured concrete: board marks from the formwork, tie holes, and a stain under each one. */
const poured: InkMaterial = (p) => {
  const { g, T, seed, ink, area } = p;
  fillArea(p, css(T.base));
  g.fillStyle = css(shift(T.base, -5, 1));
  tonePatch(p, (d) => d >= 3);
  const H = 26;
  g.fillStyle = css(shift(T.dark, 8, -2));
  for (let k = Math.floor(area.y0 / H) - 1; k * H < area.y1 + H; k++) {
    for (let c = Math.floor(area.x0 / 60) - 1; c * 60 < area.x1 + 60; c++) {
      if (hash2(c, k, seed) > 0.6) continue;
      line(p.g, c * 60 + hash2(c, k, seed + 1) * 20, k * H, c * 60 + 40 + hash2(c, k, seed + 2) * 20, k * H + (hash2(c, k, seed + 3) - 0.5) * 1.5, {
        w: 0.9,
        seed: c + k,
        taper: [0.2, 0.3],
      });
    }
  }
  eachTile(p, (x, y, wx, wy) => {
    const r = hash2(wx, wy, seed + 4);
    const sd = wx * 7 + wy * 3;
    if ((x + y * 3) % 5 === 0 && r < 0.5) {
      g.fillStyle = ink;
      blob(g, wx + 8, wy + 8, 1, sd, 1, 0.12);
      g.fill();
      g.fillStyle = css(shift(T.dark, 10, -4), undefined, 0.65);
      line(g, wx + 8, wy + 9, wx + 8.4, wy + 15 + r * 12, { w: 1.5, seed: sd, taper: [0.1, 0.8] });
    } else if (r > 0.9) crack(p, wx + 4, wy + 3, 1.2, 9 + r * 8, sd);
  });
};

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

export const INK_MATERIALS: Record<TerrainKind, InkMaterial> = {
  dirt: soil,
  loam: soil,
  organic: soil,
  sand,
  strata,
  rock: rockface,
  cave: rockface,
  crystal: rockface,
  basalt: columnar,
  stone: ashlar,
  brick: brickwork,
  cobble: cobbles,
  planks: boards,
  metal: plates,
  rustplate: rusted,
  concrete: poured,
  ice: glass,
  regolith,
  hull: hullPlates,
};
