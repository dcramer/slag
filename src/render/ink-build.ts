import { css, type HSL } from '../core/color';
import type { Cell } from '../core/geom';
import { hash2 } from '../core/rng';
import { TILE } from '../sim/constants';
import type { PropStyle } from '../sim/props';
import { blob, line, type P, shadeOf, sn, stroke } from './ink';
import { boxPts, INK, path, poly, type Sprite, sprite } from './ink-props';
import type { MetalPalette } from './kit';

/**
 * Building parts drawn as the things they parody: a riveted truss girder, a vault-plate block, a coursed
 * stone ledge with its capstone, a rope-lashed plank raft, a slatted crate, a sandwich biscuit, retro
 * bricks and their reversed-question blocks, and bolted spike rails.
 *
 * Every piece is cut on the cell grid: a part of any length is end caps plus a repeating middle with its
 * joints on tile lines, so one tile and five tiles are the same object at two sizes. All of it is baked
 * once (by `ink-blocks.ts` or `sprite`) and stamped; nothing here runs per frame.
 */

export interface Tones {
  shade: string;
  base: string;
  light: string;
  ink: string;
  hatch: string;
}

/** A horizontal run of cells in one row, inclusive. */
export interface Run {
  y: number;
  x0: number;
  x1: number;
}

export interface Block {
  cells: readonly Cell[];
  has: (x: number, y: number) => boolean;
  runs: Run[];
  seed: number;
  T: Tones;
  st: PropStyle;
  pal: MetalPalette;
}

export function runsOf(cells: readonly Cell[], has: (x: number, y: number) => boolean): Run[] {
  const out: Run[] = [];
  const sorted = [...cells].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  for (const [x, y] of sorted) {
    if (has(x - 1, y)) continue;
    let x1 = x;
    while (has(x1 + 1, y)) x1++;
    out.push({ y, x0: x, x1 });
  }
  return out;
}

/** Two flat tones cut by hand: the shape in `lo`, its lit body pulled up-left in `hi`. Returns the outline. */
function slab(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, lo: string, hi: string, d = 1.2, r = 1.6, bow = 0.25) {
  const pts = boxPts(x, y, w, h, r, seed, bow);
  g.fillStyle = lo;
  path(g, pts);
  g.fill();
  g.save();
  g.clip();
  g.translate(-d, -d * 1.1);
  g.fillStyle = hi;
  path(g, pts);
  g.fill();
  g.restore();
  return pts;
}

function fillPoly(g: CanvasRenderingContext2D, pts: readonly P[], col: string) {
  g.fillStyle = col;
  path(g, pts);
  g.fill();
}

/** A bolt head: ink, a lit cap and a fleck. */
function bolt(g: CanvasRenderingContext2D, x: number, y: number, r: number, cap: string, fleck: string, seed: number) {
  g.fillStyle = INK;
  blob(g, x + 0.2, y + 0.25, r + 0.35, seed, 1, 0.1);
  g.fill();
  g.fillStyle = cap;
  blob(g, x - 0.1, y - 0.1, r, seed + 1, 1, 0.08);
  g.fill();
  g.fillStyle = fleck;
  g.fillRect(x - r * 0.6, y - r * 0.6, r * 0.55, r * 0.5);
}

/** A pen line along a tile edge, lifted at both ends by a hand's amount so a run of them reads as drawn. */
function seam(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, seed: number, col: string) {
  const k0 = 0.6 + hash2(ax, ay, seed) * 1.4;
  const k1 = 0.6 + hash2(bx, by, seed + 1) * 1.4;
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  g.fillStyle = col;
  line(g, ax + ux * k0, ay + uy * k0, bx - ux * k1, by - uy * k1, { w, seed, taper: [0.12, 0.2], press: 0.3 });
}

// ---------------------------------------------------------------------------------------------- metal

/**
 * A truss girder seen side on: a lit top flange, a dark web cut into triangles by its struts, a bottom
 * flange in shadow, and a bolted end plate at each end. The struts repeat once per tile, so the joints
 * fall on the grid at any length.
 */
function girder(g: CanvasRenderingContext2D, b: Block) {
  const { pal, st, seed } = b;
  const flange = css(pal.light, -10);
  const web = css(pal.base, -12);
  const hole = css(pal.dark, -10, 1, -10);
  const low = css(pal.base, -6);
  const lip = css(pal.light, 4);
  const spec = css(pal.spec, -4);
  const ink = css({ h: pal.dark.h, s: pal.dark.s, l: 8 });
  const sockets = st.trim === 'gems' || st.trim === 'runes';
  for (const r of b.runs) {
    const X0 = r.x0 * TILE;
    const X1 = (r.x1 + 1) * TILE;
    const Y = r.y * TILE;
    const a = Y + 3.9;
    const bb = Y + 12.3;
    g.fillStyle = web;
    g.fillRect(X0 - 3, a, X1 - X0 + 6, bb - a);
    for (let x = r.x0; x <= r.x1; x++) {
      const px = x * TILE;
      // Up-pointing hole under each tile's apex, down-pointing hole over each joint.
      const holes: P[][] = [];
      if (!sockets) holes.push(poly(px + 8, a + 2.1, px + 13.5, bb - 0.9, px + 2.5, bb - 0.9));
      if (x < r.x1) holes.push(poly(px + 16, bb - 2.1, px + 10.5, a + 0.9, px + 21.5, a + 0.9));
      for (const h of holes) {
        fillPoly(g, h, hole);
        // The strut under the hole catches the light; its far wall doesn't.
        const up = h[0].y < h[1].y;
        g.fillStyle = lip;
        if (up) line(g, h[2].x + 1, h[2].y - 0.35, h[1].x - 1.2, h[1].y - 0.35, { w: 0.75, seed: seed + x, taper: [0.2, 0.3], press: 0.2 });
        else line(g, h[0].x + 0.4, h[0].y - 0.6, h[2].x - 1, h[2].y + 0.5, { w: 0.7, seed: seed + x + 3, taper: [0.2, 0.3], press: 0.2 });
      }
      if (sockets) {
        const cx = px + TILE / 2;
        const cy = Y + TILE / 2;
        fillPoly(g, poly(cx, cy - 3.9, cx + 3.6, cy, cx, cy + 3.9, cx - 3.6, cy), INK);
      }
    }
    // Flanges: lit on top, in shadow underneath, each with its edge drawn.
    g.fillStyle = flange;
    g.fillRect(X0 - 3, Y - 3, X1 - X0 + 6, a - Y + 3);
    g.fillStyle = low;
    g.fillRect(X0 - 3, bb, X1 - X0 + 6, Y + 19 - bb);
    g.fillStyle = css(pal.dark, 4);
    g.fillRect(X0 - 3, Y + 14.6, X1 - X0 + 6, 4);
    for (let x = r.x0; x <= r.x1; x++) {
      const px = x * TILE;
      seam(g, px, a + 0.2, px + TILE, a + 0.25, 1.15, seed + x * 3, ink);
      seam(g, px, bb, px + TILE, bb - 0.05, 0.8, seed + x * 3 + 1, ink);
      g.fillStyle = lip;
      line(g, px + 1.5, bb + 0.9, px + TILE - 2.5, bb + 0.9, { w: 0.6, seed: seed + x, taper: [0.3, 0.3], press: 0.2 });
      g.fillStyle = spec;
      if (hash2(x, r.y, seed) < 0.7)
        line(g, px + 1 + hash2(x, 1, seed) * 3, Y + 1.3, px + 10 + hash2(x, 2, seed) * 4, Y + 1.25, { w: 0.8, seed, taper: [0.25, 0.4], press: 0.2 });
      if (st.trim === 'rivets' || sockets) {
        bolt(g, px + 8, Y + 2.3, 0.9, flange, spec, seed + x);
        bolt(g, px + 8, Y + 14.1, 0.85, low, lip, seed + x + 7);
      }
    }
    if (st.trim === 'stripes') hazard(g, X0 - 1, bb + 1.4, X1 - X0 + 2, 2.8);
    // End plates, bolted through.
    for (const [ex, dir] of [
      [X0, 1],
      [X1, -1],
    ] as const) {
      const pw = 3.6;
      const x = dir > 0 ? ex - 2 : ex - pw;
      slab(g, x, Y - 2, pw + 2, TILE + 4, seed + ex, css(pal.base, -12), css(pal.base, 4), 0.9, 1);
      g.fillStyle = ink;
      line(g, ex + dir * pw, Y + 1.2, ex + dir * pw, Y + TILE - 1.2, { w: 0.9, seed: seed + ex, taper: [0.15, 0.2], press: 0.3 });
      const bx = ex + dir * (pw / 2);
      bolt(g, bx, Y + 5, 0.8, css(pal.base, 8), spec, seed + ex);
      bolt(g, bx, Y + 11, 0.8, css(pal.base, 8), spec, seed + ex + 1);
    }
  }
}

/** Yellow and black, cut on a slant. */
function hazard(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = '#1b1a18';
  g.fillRect(x, y, w, h);
  g.fillStyle = 'rgb(246 196 38)';
  for (let i = Math.floor(x / 6) * 6 - 6; i < x + w + 6; i += 6) {
    g.beginPath();
    g.moveTo(i, y + h);
    g.lineTo(i + 3, y + h);
    g.lineTo(i + 3 + h, y);
    g.lineTo(i + h, y);
    g.fill();
  }
  g.restore();
}

/**
 * Plate armour: every tile a recessed panel in a heavy frame, seams between tiles, the lit top worn
 * bright. What fills the panel is the part's trim: bolt heads, hazard stripes, a gem socket, or a glint.
 */
function plates(g: CanvasRenderingContext2D, b: Block) {
  const { pal, st, seed, has, T } = b;
  const spec = css(pal.spec, -6);
  const ink = css({ h: pal.dark.h, s: pal.dark.s, l: 8 });
  for (const [x, y] of b.cells) {
    const px = x * TILE;
    const py = y * TILE;
    const k = seed + x * 13 + y * 7;
    if (!has(x, y - 1)) {
      g.fillStyle = T.light;
      g.fillRect(px - 1, py - 1, TILE + 2, 3.4);
    }
    const cx = px + TILE / 2;
    const cy = py + TILE / 2 + 0.3;
    const P0 = 3.4;
    const wall = boxPts(px + P0, py + P0 + 0.3, TILE - P0 * 2, TILE - P0 * 2, 1.4, k, 0.2);
    if (st.trim === 'rivets') {
      // Boiler plate: a line of rivets along each plate's top and bottom, and a dent where something hit it.
      for (const ry of [2.7, 13.3])
        for (const rx of [3.4, 8, 12.6]) bolt(g, px + rx + (hash2(rx, ry, k) - 0.5) * 0.4, py + ry, 0.68, css(pal.base, 8), spec, k + rx * 3 + ry);
      if (hash2(x, y, seed + 4) < 0.5) {
        const dx = px + 4 + hash2(x, y, seed + 5) * 6;
        const dy = py + 6.5 + hash2(x, y, seed + 6) * 2;
        g.fillStyle = css(pal.dark, 10);
        blob(g, dx, dy, 1.7, k, 0.7, 0.2);
        g.fill();
        g.fillStyle = css(pal.light, -4);
        line(g, dx - 1, dy + 1.3, dx + 1.6, dy + 0.7, { w: 0.55, seed: k, taper: [0.3, 0.3], press: 0.1 });
      }
    } else {
      // The recess: its upper-left walls in shadow, its lower-right walls lit, the floor between.
      fillPoly(g, wall, css(pal.dark, 6));
      g.save();
      path(g, wall);
      g.clip();
      g.translate(1.1, 1.2);
      fillPoly(g, wall, css(pal.light, -14));
      g.translate(-0.5, -0.55);
      fillPoly(g, boxPts(px + P0 + 0.7, py + P0 + 1, TILE - P0 * 2 - 1.4, TILE - P0 * 2 - 1.4, 1, k + 1, 0.15), css(pal.base, -7));
      g.restore();
    }
    if (st.trim === 'stripes') {
      g.save();
      path(g, wall);
      g.clip();
      hazard(g, px + P0 + 0.6, py + P0 + 0.9, TILE - P0 * 2 - 0.8, TILE - P0 * 2 - 0.8);
      g.restore();
    } else if (st.trim === 'gems' || st.trim === 'runes') {
      fillPoly(g, poly(cx, cy - 3.6, cx + 3.3, cy, cx, cy + 3.6, cx - 3.3, cy), INK);
    } else if (st.trim !== 'rivets') {
      g.fillStyle = css(pal.light, -2);
      line(g, cx - 3, cy + 2.2, cx + 1.4, cy - 2.4, { w: 0.9, seed: k, taper: [0.25, 0.4], press: 0.2 });
    }
    // Seams between plates, each with a lit lip on its lower-right side.
    if (has(x + 1, y)) {
      seam(g, px + TILE, py, px + TILE, py + TILE, 0.95, k + 2, ink);
      g.fillStyle = css(pal.light, -10);
      line(g, px + TILE + 0.9, py + 2, px + TILE + 0.9, py + TILE - 2, { w: 0.5, seed: k, taper: [0.3, 0.3], press: 0.1 });
    }
    if (has(x, y + 1)) {
      seam(g, px, py + TILE, px + TILE, py + TILE, 0.95, k + 3, ink);
      g.fillStyle = css(pal.light, -10);
      line(g, px + 2, py + TILE + 0.9, px + TILE - 2, py + TILE + 0.9, { w: 0.5, seed: k + 1, taper: [0.3, 0.3], press: 0.1 });
    }
    // A glint on the frame's lit corner, every other plate.
    if ((x + y) % 2 === 0) {
      g.fillStyle = spec;
      line(g, px + 1.3, py + 6.5, px + 1.6, py + 2.2, { w: 0.9, seed: k + 4, taper: [0.2, 0.4], press: 0.1 });
    }
  }
}

export function markMetal(g: CanvasRenderingContext2D, b: Block) {
  const flat = b.cells.length > 1 && b.cells.every(([x, y]) => !b.has(x, y - 1) && !b.has(x, y + 1));
  if (flat) girder(g, b);
  else plates(g, b);
}

// ---------------------------------------------------------------------------------------------- stone

/**
 * A stone ledge: a capstone along every top a foot can reach, undercut by a dark line, over coursed
 * blocks whose joints fall on the half-tile lattice and stagger row by row. Each block is its own two-tone
 * shape with a lit top, so the face reads as stones and not a grey slab with lines on it.
 */
export function markStone(g: CanvasRenderingContext2D, b: Block, c: HSL) {
  const { has, seed, T } = b;
  const mortar = css(c, -30, 1, 4);
  const capLo = css(c, 4, 1, -2);
  const capHi = css(c, 17, 1, -5);
  for (const r of b.runs) {
    const Y = r.y * TILE;
    const X0 = r.x0 * TILE;
    const X1 = (r.x1 + 1) * TILE;
    g.fillStyle = mortar;
    g.fillRect(X0 - 3, Y - 1, X1 - X0 + 6, TILE + 4);
    // Joints on the half-tile lattice, staggered by course.
    const joints: number[] = [X0 - 3];
    for (let j = r.x0 * 2 + 1; j < (r.x1 + 1) * 2; j++) {
      if ((j + r.y) % 2 !== 0) continue;
      if (hash2(j, r.y, seed + 5) < 0.82) joints.push(j * 8);
    }
    joints.push(X1 + 3);
    for (let i = 0; i + 1 < joints.length; i++) {
      const a = joints[i] + (i === 0 ? 0 : 0.8);
      const e = joints[i + 1] - (i + 2 === joints.length ? 0 : 0.8);
      const span: number[] = [];
      for (let x = Math.max(r.x0, Math.floor(a / TILE)); x <= Math.min(r.x1, Math.floor((e - 0.01) / TILE)); x++) span.push(x);
      const top = span.some((x) => has(x, r.y - 1)) ? Y + 0.6 : Y + 4.4;
      const bottom = span.some((x) => has(x, r.y + 1)) ? Y + TILE - 0.6 : Y + TILE + 3;
      const k = seed + joints[i] * 3 + r.y * 101;
      // Each stone its own shade of the rock, so the face reads as stones laid, not one slab.
      const dl = (hash2(k, 6, 0) - 0.5) * 9;
      slab(g, a, top, e - a, bottom - top, k, css(c, dl - 15, 1, 5), css(c, dl - 1), 1.9, 2.2, 0.4);
      // The block's lit top edge, and one sparse mark: chisel ticks or a chip.
      g.fillStyle = capHi;
      line(g, a + 1.6, top + 0.9, e - 2.4 - hash2(k, 1, 0) * 3, top + 0.8, { w: 0.7, seed: k, taper: [0.2, 0.5], press: 0.3 });
      const m = hash2(k, 2, 0);
      if (m < 0.4 && e - a > 9) {
        g.fillStyle = T.hatch;
        const mx = a + 3 + hash2(k, 3, 0) * (e - a - 8);
        const my = top + 3 + hash2(k, 4, 0) * Math.max(0, bottom - top - 7);
        line(g, mx, my + 1.8, mx + 2.2, my, { w: 0.75, seed: k, taper: [0.2, 0.6] });
        line(g, mx + 1.6, my + 2.4, mx + 3.6, my + 0.8, { w: 0.65, seed: k + 1, taper: [0.2, 0.6] });
      } else if (m > 0.78) {
        g.fillStyle = mortar;
        const mx = a + 2 + hash2(k, 5, 0) * (e - a - 5);
        blob(g, mx, bottom - 2.2, 0.9, k, 0.8, 0.4);
        g.fill();
      }
    }
    // The capstone over every reachable top: lit, with an undercut where it overhangs the face.
    for (let x = r.x0; x <= r.x1; x++) {
      if (has(x, r.y - 1)) continue;
      const px = x * TILE;
      const l = has(x - 1, r.y) && !has(x - 1, r.y - 1) ? px - 0.2 : px - 3;
      const rr = has(x + 1, r.y) && !has(x + 1, r.y - 1) ? px + TILE + 0.2 : px + TILE + 3;
      // The overhang's shadow on the stones under it, then the cap: a lit top, a front face, an ink lip.
      g.fillStyle = mortar;
      g.fillRect(l, Y + 4, rr - l, 2.3 + hash2(x, r.y, seed + 2) * 0.5);
      g.fillStyle = capLo;
      g.fillRect(l, Y - 2, rr - l, 6.4);
      g.fillStyle = capHi;
      g.fillRect(l, Y - 2, rr - l, 3.6);
      seam(g, px - 0.4, Y + 4.4, px + TILE + 0.4, Y + 4.5 + (hash2(x, r.y, seed) - 0.5) * 0.5, 1.2, seed + x * 7, T.ink);
      // Wear on the cap: a pale scuff, and a joint in the capstone every so often.
      g.fillStyle = css(c, 22, 1, -4);
      if (hash2(x, r.y, seed + 9) < 0.6)
        line(g, px + 2 + hash2(x, 3, seed) * 6, Y + 1.1, px + 8 + hash2(x, 4, seed) * 6, Y + 1.15, { w: 0.7, seed: x, taper: [0.3, 0.4], press: 0.2 });
      if (x > r.x0 && !has(x - 1, r.y - 1) && hash2(x, r.y, seed + 10) < 0.4) seam(g, px, Y + 0.4, px, Y + 4.4, 0.8, seed + x, mortar);
    }
  }
  // One crack per ledge, run in from an edge.
  const [cx, cy] = b.cells[Math.floor(hash2(1, 2, seed) * b.cells.length)];
  g.fillStyle = T.ink;
  const pts: P[] = [];
  let ax = cx * TILE + 4 + hash2(3, 4, seed) * 8;
  let ay = cy * TILE + TILE;
  for (let i = 0; i < 4; i++) {
    pts.push({ x: ax, y: ay });
    ax += (hash2(i, 5, seed) - 0.5) * 4;
    ay -= 1.8 + hash2(i, 6, seed) * 1.4;
  }
  stroke(g, pts, { w: 0.85, seed, taper: [0.05, 0.9] });
}

// ----------------------------------------------------------------------------------------------- wood

const woodOf = (hue: number): HSL => ({ h: hue, s: 50, l: 44 });

/** One board: two tones, grain that runs its length, maybe a knot, and nails at its ends. */
function board(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, wood: HSL, k: number, nails: boolean) {
  const dl = (hash2(k, 1, 0) - 0.5) * 8;
  slab(g, x0, y0, x1 - x0, y1 - y0, k, css(wood, dl - 12, 1, 4), css(wood, dl), 0.9, 1.1, 0.3);
  const h = y1 - y0;
  g.fillStyle = css(wood, dl - 22, 1, 6);
  // Grain: one or two long strokes that wander along the board.
  const n = h > 6 ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const gy = y0 + h * (n === 1 ? 0.55 : 0.35 + i * 0.35);
    const pts: P[] = [];
    const a = x0 + 1.5 + hash2(k, 2 + i, 0) * 4;
    const e = x1 - 1.5 - hash2(k, 4 + i, 0) * 5;
    for (let x = a; x <= e; x += 2) pts.push({ x, y: gy + sn(x * 0.12, i * 3.1, k) * 0.7 });
    if (pts.length > 1) stroke(g, pts, { w: 0.55, seed: k + i, taper: [0.25, 0.35], press: 0.4 });
  }
  if (x1 - x0 > 10 && hash2(k, 7, 0) < 0.45) {
    const kx = x0 + 4 + hash2(k, 8, 0) * (x1 - x0 - 8);
    const ky = y0 + h * 0.5;
    g.fillStyle = css(wood, -26, 1, 6);
    blob(g, kx, ky, 1.3, k, 0.55, 0.15);
    g.fill();
    g.fillStyle = css(wood, dl);
    blob(g, kx - 0.1, ky - 0.1, 0.6, k + 1, 0.55, 0.15);
    g.fill();
  }
  // The lit top edge of the board.
  g.fillStyle = css(wood, 16, 1, -6);
  line(g, x0 + 1.2, y0 + 0.6, x1 - 2 - hash2(k, 9, 0) * 3, y0 + 0.55, { w: 0.6, seed: k, taper: [0.2, 0.5], press: 0.3 });
  if (nails)
    for (const nx of [x0 + 1.9, x1 - 1.9]) {
      g.fillStyle = INK;
      blob(g, nx, y0 + h / 2, 0.62, k + nx, 1, 0.15);
      g.fill();
      g.fillStyle = 'rgba(255,240,220,0.7)';
      g.fillRect(nx - 0.4, y0 + h / 2 - 0.45, 0.35, 0.3);
    }
}

/**
 * Wood: one row is a plank raft, two boards deep with their butt joints staggered on the grid; anything
 * taller is a stack of slatted crates, each framed and braced.
 */
export function markWood(g: CanvasRenderingContext2D, b: Block) {
  const wood = woodOf(b.st.woodHue);
  const ink = css({ h: wood.h, s: 60, l: 9 });
  const tall = b.cells.some(([x, y]) => b.has(x, y + 1));
  if (!tall && b.cells.length > 1) {
    for (const r of b.runs) {
      const Y = r.y * TILE;
      const X0 = r.x0 * TILE;
      const X1 = (r.x1 + 1) * TILE;
      g.fillStyle = ink;
      g.fillRect(X0 - 3, Y - 2, X1 - X0 + 6, TILE + 5);
      // Upper board breaks on tile lines, lower board on half tiles: never the same place twice.
      for (const [y0, y1, lat, off, salt] of [
        [Y - 2, Y + 7.7, 16, 0, 1],
        [Y + 8.3, Y + 19, 16, 8, 2],
      ] as const) {
        const cuts = [X0 - 3];
        for (let x = X0 + off + (off ? 0 : lat); x < X1 - 4; x += lat) if (x > X0 + 4 && hash2(x, r.y * 7 + salt, b.seed) < 0.5) cuts.push(x);
        cuts.push(X1 + 3);
        for (let i = 0; i + 1 < cuts.length; i++) board(g, cuts[i] + (i ? 0.35 : 0), y0, cuts[i + 1] - 0.35, y1, wood, b.seed + cuts[i] * 5 + salt, true);
      }
    }
    return;
  }
  for (const [x, y] of b.cells) {
    const px = x * TILE;
    const py = y * TILE;
    const k = b.seed + x * 31 + y * 17;
    g.fillStyle = ink;
    g.fillRect(px - 1, py - 1, TILE + 2, TILE + 2);
    // Slats behind, frame over them, the brace across.
    board(g, px + 2.6, py + 2.8, px + TILE - 2.6, py + 8, { ...wood, l: wood.l - 7 }, k + 1, false);
    board(g, px + 2.6, py + 8.4, px + TILE - 2.6, py + TILE - 2.8, { ...wood, l: wood.l - 9 }, k + 2, false);
    const L = b.has(x - 1, y) ? 0.3 : -2;
    const R = b.has(x + 1, y) ? -0.3 : 2;
    const U = b.has(x, y - 1) ? 0.3 : -2;
    const D = b.has(x, y + 1) ? -0.3 : 2;
    board(g, px + L, py + U, px + TILE + R, py + 2.9, { ...wood, l: wood.l + 5 }, k + 3, false);
    board(g, px + L, py + TILE - 2.9, px + TILE + R, py + TILE + D, { ...wood, l: wood.l + 1 }, k + 4, false);
    board(g, px + L, py + 2.7, px + 2.8, py + TILE - 2.7, { ...wood, l: wood.l + 3 }, k + 5, false);
    board(g, px + TILE - 2.8, py + 2.7, px + TILE + R, py + TILE - 2.7, { ...wood, l: wood.l }, k + 6, false);
    g.fillStyle = ink;
    line(g, px + 2.4, py + TILE - 2.6, px + TILE - 2.4, py + 2.6, { w: 3.7, seed: k, taper: [0.02, 0.02], press: 0.15 });
    g.fillStyle = css(wood, 4);
    line(g, px + 2.4, py + TILE - 2.6, px + TILE - 2.4, py + 2.6, { w: 2.1, seed: k + 1, taper: [0.02, 0.02], press: 0.15 });
    g.fillStyle = css(wood, 18, 1, -6);
    line(g, px + 3.4, py + TILE - 4, px + TILE - 4.4, py + 3.6, { w: 0.55, seed: k + 2, taper: [0.2, 0.4], press: 0.2 });
    for (const [nx, ny] of [
      [1.6, 1.5],
      [TILE - 1.6, 1.5],
      [1.6, TILE - 1.5],
      [TILE - 1.6, TILE - 1.5],
    ]) {
      g.fillStyle = INK;
      blob(g, px + nx, py + ny, 0.6, k + nx + ny, 1, 0.15);
      g.fill();
    }
  }
}

/** Rope lashed round each end of a plank raft: the mount, and what says "raft" at a glance. Past the pen. */
export function overWood(g: CanvasRenderingContext2D, b: Block) {
  const tall = b.cells.some(([x, y]) => b.has(x, y + 1));
  if (tall || b.cells.length < 2) return;
  const rope: HSL = { h: 40, s: 42, l: 66 };
  for (const r of b.runs) {
    if (r.x1 === r.x0) continue;
    const Y = r.y * TILE;
    for (const x of [r.x0 * TILE + 4.6, (r.x1 + 1) * TILE - 6.4]) {
      const k = b.seed + x;
      for (let i = 0; i < 3; i++) {
        const wx = x + i * 1.35;
        const pts = poly(wx - 0.9, Y - 0.7, wx - 0.1, Y + 5, wx + 0.5, Y + 11, wx + 1, Y + 16.7);
        g.fillStyle = INK;
        stroke(g, pts, { w: 2.1, seed: k + i, taper: [0.1, 0.1], press: 0.2 });
        g.fillStyle = css(rope, i === 1 ? 4 : -6);
        stroke(
          g,
          pts.map((p) => ({ x: p.x - 0.2, y: p.y })),
          { w: 1.15, seed: k + i + 9, taper: [0.15, 0.15], press: 0.2 },
        );
      }
      // The knot under the raft, and its two loose ends.
      g.fillStyle = INK;
      blob(g, x + 1.6, Y + 17, 1.3, k, 0.8, 0.2);
      g.fill();
      g.fillStyle = css(rope, -4);
      blob(g, x + 1.4, Y + 16.8, 0.8, k + 1, 0.8, 0.2);
      g.fill();
      g.fillStyle = INK;
      for (const [dx, dy] of [
        [-1.3, 3.2],
        [1.2, 3.8],
      ])
        line(g, x + 1.6, Y + 17.4, x + 1.6 + dx, Y + 17.4 + dy, { w: 0.9, seed: k + dx, taper: [0.1, 0.7], press: 0.2 });
    }
  }
}

// -------------------------------------------------------------------------------------------- biscuit

/**
 * A sandwich biscuit, row by row: a docked top biscuit, a band of cream that bulges where it's squeezed,
 * a darker bottom biscuit. It reads as food first and footing second, which is the joke.
 */
export function markBiscuit(g: CanvasRenderingContext2D, b: Block) {
  const top: HSL = { h: 34, s: 66, l: 60 };
  const bot: HSL = { h: 30, s: 62, l: 52 };
  const cream: HSL = { h: 44, s: 78, l: 90 };
  for (const r of b.runs) {
    const Y = r.y * TILE;
    const X0 = r.x0 * TILE - 3;
    const X1 = (r.x1 + 1) * TILE + 3;
    const k = b.seed + r.y * 97;
    g.fillStyle = css(bot, -30, 1, 6);
    g.fillRect(X0, Y - 1, X1 - X0, TILE + 3);
    const any = (dy: number) => Array.from({ length: r.x1 - r.x0 + 1 }, (_, i) => b.has(r.x0 + i, r.y + dy)).some(Boolean);
    const capT = any(-1) ? Y + 0.4 : Y - 2;
    const capB = any(1) ? Y + TILE - 0.4 : Y + TILE + 3;
    slab(g, X0, capT, X1 - X0, Y + 6.2 - capT, k, css(top, -12, 1, 4), css(top), 1, 1.4, 0.3);
    slab(g, X0, Y + 9.9, X1 - X0, capB - Y - 9.9, k + 1, css(bot, -12, 1, 4), css(bot), 1, 1.4, 0.3);
    // Cream: a wavy band, squeezed out a touch between the biscuits.
    const c: P[] = [];
    for (let x = X0; x <= X1; x += 1.5) c.push({ x, y: Y + 6 + sn(x * 0.21, 1.3, k) * 0.45 });
    for (let x = X1; x >= X0; x -= 1.5) c.push({ x, y: Y + 10.1 + Math.max(0, sn(x * 0.17, 4.1, k)) * 0.9 });
    fillPoly(g, c, css(cream, -12, 1, -10));
    g.save();
    path(g, c);
    g.clip();
    g.translate(0, -0.9);
    fillPoly(g, c, css(cream));
    g.restore();
    g.fillStyle = css(bot, -36, 1, 6);
    for (let x = r.x0; x <= r.x1; x++) {
      const px = x * TILE;
      seam(g, px - 0.5, Y + 6.1, px + TILE + 0.5, Y + 6.05, 0.7, k + x, css(top, -38, 1, 8));
      // Docking holes: a prick with a lit lip, two on top, one below, keyed to the tile.
      for (const [hx, hy] of [
        [4.2, 3],
        [11.8, 3],
        [8, 13.2],
      ]) {
        g.fillStyle = css(top, 14, 1, -4);
        blob(g, px + hx + 0.35, Y + hy + 0.4, 0.95, k + hx, 1, 0.1);
        g.fill();
        g.fillStyle = css(bot, -38, 1, 6);
        blob(g, px + hx, Y + hy, 0.72, k + hy + x, 1, 0.1);
        g.fill();
      }
      // Baked edge: a few short crimp ticks on the bottom biscuit, never a ruled row.
      if (!b.has(x, r.y + 1)) {
        g.fillStyle = css(bot, -24, 1, 6);
        for (let i = 0; i < 4; i++) {
          if (hash2(x * 4 + i, r.y, k) < 0.35) continue;
          const tx = px + 2 + i * 4 + hash2(i, x, k) * 1.2;
          line(g, tx, Y + TILE - 0.4, tx + 0.3, Y + TILE - 2.2, { w: 0.55, seed: k + i, taper: [0.1, 0.5] });
        }
      }
      // Sugar on top.
      if (!b.has(x, r.y - 1)) {
        g.fillStyle = 'rgb(255 248 228)';
        for (let i = 0; i < 2; i++) {
          blob(g, px + 2 + hash2(x, i, k) * 12, Y + 1 + hash2(x, i + 3, k) * 2.6, 0.42, k + i, 1, 0.1);
          g.fill();
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------- retro

/**
 * A retro block tile, baked into `g` at (0, 0). `brick`: the famous brick block's course of bricks, in the
 * blink set's own color. Otherwise the "question" block, reversed: bevelled rim, a rivet in each corner,
 * and a mirrored question mark, because it doesn't know either.
 */
export function retroTile(g: CanvasRenderingContext2D, hue: number, brick: boolean, seed: number) {
  const c: HSL = { h: hue, s: 86, l: brick ? 50 : 56 };
  const dark = css(c, -30, 1, 6);
  if (brick) {
    g.fillStyle = dark;
    g.fillRect(-2, -2, TILE + 4, TILE + 4);
    // Two courses: halves on top, a whole between two halves below.
    for (const [x0, y0, x1, y1] of [
      [-2, -2, 7.7, 7.6],
      [8.3, -2, 18, 7.6],
      [-2, 8.2, 3.7, 18],
      [4.3, 8.2, 11.7, 18],
      [12.3, 8.2, 18, 18],
    ]) {
      const k = seed + x0 * 5 + y0;
      slab(g, x0, y0, x1 - x0, y1 - y0, k, css(c, -12, 1, 4), css(c), 0.9, 1.1, 0.2);
      g.fillStyle = css(c, 18, 1, -10);
      line(g, Math.max(0.8, x0 + 1.2), Math.max(1.2, y0 + 0.9), Math.min(TILE - 1.8, x1 - 1.6), Math.max(1.2, y0 + 0.9), {
        w: 0.75,
        seed: k,
        taper: [0.2, 0.4],
        press: 0.2,
      });
    }
    return;
  }
  // The rim: lit on top and left, dark on the bottom and right, round a flat face.
  slab(g, -2, -2, TILE + 4, TILE + 4, seed, css(c, -20, 1, 6), css(c, 14, 1, -8), 1.9, 1, 0);
  slab(g, 2.2, 2.2, TILE - 4.4, TILE - 4.4, seed + 1, css(c, -6), css(c), 0.5, 1, 0.15);
  for (const [x, y] of [
    [2.6, 2.6],
    [TILE - 2.6, 2.6],
    [2.6, TILE - 2.6],
    [TILE - 2.6, TILE - 2.6],
  ]) {
    g.fillStyle = dark;
    blob(g, x + 0.2, y + 0.2, 0.75, seed + x + y, 1, 0.1);
    g.fill();
    g.fillStyle = css(c, 26, 1, -12);
    g.fillRect(x - 0.45, y - 0.5, 0.4, 0.35);
  }
  // A mirrored question mark: hook opening the wrong way, then the dot.
  const hook = poly(10.6, 5.7, 10.2, 4.3, 8.9, 3.6, 7.2, 3.6, 5.9, 4.4, 5.5, 5.8, 6.1, 7.1, 7.6, 8.1, 8, 9, 8, 10);
  g.fillStyle = dark;
  stroke(
    g,
    hook.map((p) => ({ x: p.x + 0.7, y: p.y + 0.8 })),
    { w: 2.6, seed, taper: [0.08, 0.05], press: 0.15 },
  );
  blob(g, 8.7, 13.2, 1.35, seed + 3, 1, 0.08);
  g.fill();
  g.fillStyle = 'rgb(255 247 226)';
  stroke(g, hook, { w: 2.3, seed, taper: [0.08, 0.05], press: 0.15 });
  blob(g, 8, 12.4, 1.2, seed + 3, 1, 0.08);
  g.fill();
}

/** Where a gone retro block will come back: its four corners, pencilled, so the space reads as held. */
export function retroGhost(s: CanvasRenderingContext2D, x: number, y: number, col: string, seed: number) {
  s.fillStyle = col;
  const L = 4.6;
  const o = { w: 1.1, taper: [0.1, 0.5] as [number, number], press: 0.2 };
  for (const [cx, cy, dx, dy] of [
    [1.5, 1.5, 1, 1],
    [TILE - 1.5, 1.5, -1, 1],
    [1.5, TILE - 1.5, 1, -1],
    [TILE - 1.5, TILE - 1.5, -1, -1],
  ]) {
    line(s, x + cx, y + cy, x + cx + dx * L, y + cy, { ...o, seed: seed + cx });
    line(s, x + cx, y + cy, x + cx, y + cy + dy * L, { ...o, seed: seed + cy + 1 });
  }
}

// ----------------------------------------------------------------------------------------------- spikes

/**
 * Three fat spikes on a bolted rail, in a frame where the host face is x = 8 and the tips point to +x.
 * `upLit` says which flank faces the light once the frame is turned into the world. They stay inside the
 * sim's hazard strip (7 px out, 2 px in from each side), so what looks sharp is what hurts.
 */
function spikeRail(g: CanvasRenderingContext2D, upLit: boolean, seed: number, rail: HSL) {
  const lit = '#eef0f4';
  const mid = '#a4abb8';
  const dark = '#5d6370';
  // Rail: a dark bar on the face, two bolts through it.
  g.fillStyle = INK;
  line(g, 7.7, -7.9, 7.7, 7.9, { w: 3.6, seed, taper: [0.04, 0.04], press: 0.15 });
  g.fillStyle = css(rail, 6);
  line(g, 7.4, -7.3, 7.4, 7.3, { w: 1.9, seed: seed + 1, taper: [0.05, 0.05], press: 0.15 });
  for (const by of [-5.6, 5.6]) {
    g.fillStyle = css(rail, 30, 1, -10);
    blob(g, 7.3, by, 0.6, seed + by, 1, 0.1);
    g.fill();
  }
  for (let i = 0; i < 3; i++) {
    const yc = -4.4 + i * 4.4 + (hash2(i, 2, seed) - 0.5) * 0.4;
    const len = 6.1 + hash2(i, 3, seed) * 0.8;
    const tip = { x: 9 + len, y: yc + (hash2(i, 4, seed) - 0.5) * 0.9 };
    const a = { x: 8.8, y: yc - 2.5 };
    const b = { x: 8.8, y: yc + 2.5 };
    const spine = { x: 9.1, y: yc + (upLit ? 0.5 : -0.5) };
    // A cone, cut down its spine: the lit flank, the dark flank, a bright edge along the lit one.
    fillPoly(g, [a, tip, spine], upLit ? lit : dark);
    fillPoly(g, [spine, tip, b], upLit ? dark : lit);
    fillPoly(g, [{ x: 9, y: (upLit ? a.y : b.y) * 0.55 + yc * 0.45 }, tip, spine], mid);
    // Collar where it's set into the rail.
    fillPoly(g, poly(8.6, yc - 2.7, 10.1, yc - 2.2, 10.1, yc + 2.2, 8.6, yc + 2.7), css(rail, -4));
    g.fillStyle = INK;
    stroke(g, [a, tip], { w: upLit ? 0.65 : 1.25, seed: seed + i, taper: [0.1, 0.65], press: 0.2 });
    stroke(g, [b, tip], { w: upLit ? 1.25 : 0.65, seed: seed + i + 5, taper: [0.1, 0.65], press: 0.2 });
    line(g, 10.1, yc - 2.1, 10.1, yc + 2.1, { w: 0.6, seed: seed + i + 9, taper: [0.2, 0.2], press: 0.2 });
    // The point's been used.
    fillPoly(g, [{ x: tip.x - 2.2, y: tip.y - 0.65 }, tip, { x: tip.x - 2.2, y: tip.y + 0.65 }], '#b3192b');
  }
}

/** The spike rail for one face, baked per light side and hand. Stamp it in the face's frame (see `spikeRail`). */
export function spikeSprite(angle: number, seed: number, rail: HSL): Sprite {
  // Which flank faces the light: the one on local -y, turned into the world.
  const upLit = shadeOf(Math.sin(angle), -Math.cos(angle)) < 0.5;
  const v = seed & 3;
  return sprite(`spk|${upLit}|${v}|${rail.h | 0},${rail.s | 0},${rail.l | 0}`, 4.5, -9.5, 13.5, 19, (g) => spikeRail(g, upLit, v * 7 + 3, rail));
}

// ------------------------------------------------------------------------------------------------- ice

/** Short icicles under an ice block's open bottoms: thin, so they're decoration, and they say "frozen" at a glance. */
export function overIce(g: CanvasRenderingContext2D, b: Block) {
  for (const [x, y] of b.cells) {
    if (b.has(x, y + 1)) continue;
    const Y = (y + 1) * TILE - 0.6;
    for (let i = 0; i < 2; i++) {
      if (hash2(x, y * 2 + i, b.seed) < 0.35) continue;
      const ix = x * TILE + 3.5 + i * 7 + hash2(x + i, y, b.seed + 1) * 3;
      const h = 2 + hash2(x, y + i, b.seed + 2) * 1.4;
      const tri = poly(ix - 1.1, Y, ix + 1.1, Y, ix + 0.2, Y + h);
      fillPoly(g, tri, 'hsl(196 72% 84%)');
      g.fillStyle = 'hsl(212 60% 16%)';
      stroke(g, [tri[1], tri[2]], { w: 0.6, seed: x + i, taper: [0.1, 0.7], press: 0.1 });
      stroke(g, [tri[0], tri[2]], { w: 0.35, seed: x + i + 3, taper: [0.1, 0.7], press: 0.1 });
    }
  }
}
