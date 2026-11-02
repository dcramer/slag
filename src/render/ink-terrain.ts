import { css, type HSL, shift } from '../core/color';
import { hash2 } from '../core/rng';
import type { Theme } from '../gen/theme';
import { TILE } from '../sim/constants';
import { type Level, T_ONEWAY, tileAt, type TileRect } from '../sim/level';
import { blob, type EdgeP, line, looseLoop, type P, shadeOf, sn, stroke, traceCorners, vn } from './ink';

/**
 * Terrain as an ink drawing instead of a textured mask. Each layer is marks a hand would make: flat tones
 * cut as lumpy shapes, material marks, hatching that hangs off shadow edges, tapered contour strokes, and
 * a cap with its own drips and blades.
 *
 * All of it comes from the tile grid plus theme colors, so it fits any level size, recolors with the
 * theme, and survives bombs: every mark is keyed on world position, so only what a blast changed moves.
 */

export interface InkBake {
  mask: Path2D;
  loops: EdgeP[][];
}

/** World rect to paint. Layers skip what can't reach it; the clip does the rest. */
export interface Area {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** True if a point, or anything drawn within `pad` of it, can land in the area. */
const near = (a: Area, x: number, y: number, pad: number) => x >= a.x0 - pad && x <= a.x1 + pad && y >= a.y0 - pad && y <= a.y1 + pad;

/** Tiles to visit for an area: marks drawn from a tile reach about two tiles out of it. */
function tilesIn(a: Area, level: Level) {
  return {
    tx0: Math.max(0, Math.floor(a.x0 / TILE) - 2),
    ty0: Math.max(0, Math.floor(a.y0 / TILE) - 2),
    tx1: Math.min(level.w - 1, Math.ceil(a.x1 / TILE) + 2),
    ty1: Math.min(level.h - 1, Math.ceil(a.y1 / TILE) + 2),
  };
}

/**
 * Tile rect a change needs redrawn, or null if nothing changed. `margin` is how far one tile's change
 * can reach: tones read four tiles of depth, and a contour stroke or mark adds about two more.
 */
export function dirtyTiles(was: Uint8Array, now: Uint8Array, w: number, h: number, margin = 6): TileRect | null {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (was[y * w + x] === now[y * w + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const left = Math.max(0, x0 - margin);
  const top = Math.max(0, y0 - margin);
  return { x: left, y: top, w: Math.min(w, x1 + margin + 1) - left, h: Math.min(h, y1 + margin + 1) - top };
}

interface Ctx {
  g: CanvasRenderingContext2D;
  level: Level;
  th: Theme;
  seed: number;
  solid: (x: number, y: number) => boolean;
  inkCol: string;
  span: { tx0: number; ty0: number; tx1: number; ty1: number };
}

/** Past the window the grid carries on as it was, so a region running out of it still closes. */
function windowSolid(level: Level, solid: (x: number, y: number) => boolean, r: TileRect) {
  return (x: number, y: number) => {
    const cx = Math.max(0, Math.min(level.w - 1, x + r.x));
    const cy = Math.max(0, Math.min(level.h - 1, y + r.y));
    return solid(Math.max(r.x, Math.min(r.x + r.w - 1, cx)), Math.max(r.y, Math.min(r.y + r.h - 1, cy)));
  };
}

/** Tiles of contour traced past a partial redraw: enough that what the window cuts off never reaches the area. */
const TRACE_PAD = 5;

/**
 * Shapes of the terrain in world px, for the whole level or just around `tiles`. Points are keyed to the
 * world, so tracing a window gives the same outline inside it as tracing the level does.
 */
export function inkContours(level: Level, seed: number, solid: (x: number, y: number) => boolean, tiles?: TileRect): InkBake {
  const x0 = tiles ? Math.max(0, tiles.x - TRACE_PAD) : 0;
  const y0 = tiles ? Math.max(0, tiles.y - TRACE_PAD) : 0;
  const x1 = tiles ? Math.min(level.w, tiles.x + tiles.w + TRACE_PAD) : level.w;
  const y1 = tiles ? Math.min(level.h, tiles.y + tiles.h + TRACE_PAD) : level.h;
  const r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  const corners = traceCorners(windowSolid(level, solid, r), r.w, r.h);
  const shifted = corners.map((c) => c.map((p) => ({ x: p.x + x0, y: p.y + y0 })));
  const loops = shifted.map((c) => looseLoop(c, { tile: TILE, w: level.w, h: level.h, seed, edge: tiles ? r : undefined }));
  const mask = new Path2D();
  for (const l of loops) {
    l.forEach((p, i) => (i ? mask.lineTo(p.x, p.y) : mask.moveTo(p.x, p.y)));
    mask.closePath();
  }
  return { mask, loops };
}

/** Everything inside the mask that the flat-tones approach would otherwise leave empty. */
export function inkMaterial(g: CanvasRenderingContext2D, level: Level, th: Theme, seed: number, solid: (x: number, y: number) => boolean, a: Area) {
  const T = th.terrain;
  const span = tilesIn(a, level);
  const ctx: Ctx = { g, level, th, seed, solid, inkCol: inkOf(th), span };
  const dist = airDistance(level, solid);
  const D = (x: number, y: number) => (x < 0 || y < 0 || x >= level.w || y >= level.h ? 99 : dist[y * level.w + x]);

  g.fillStyle = css(T.base);
  g.fillRect(a.x0, a.y0, a.x1 - a.x0, a.y1 - a.y0);

  // Second tone: lumpy flat shape from a pile of blobs, so its edge is a brush's, not a gradient's.
  g.fillStyle = css(shift(T.base, -7, 2));
  tonePatch(ctx, 13, 3, 0.4, (x, y) => D(x, y) >= 2);
  g.fillStyle = css(shift(T.dark, 3, 2));
  tonePatch(ctx, 13, 3, 0.4, (x, y) => D(x, y) >= 4);

  // Sunlit soil under the grass, in dragged strokes rather than a band.
  g.fillStyle = css(shift(T.light, -3), undefined, 0.8);
  for (let y = span.ty0; y <= span.ty1; y++) {
    for (let x = span.tx0; x <= span.tx1; x++) {
      if (!solid(x, y) || D(x, y) !== 1) continue;
      const wx = x * TILE;
      const wy = y * TILE;
      const n = 2 + Math.floor(hash2(wx, wy, seed + 5) * 2);
      for (let i = 0; i < n; i++) {
        const sx = wx + hash2(wx, i, seed + 6) * TILE;
        const sy = wy + 4 + hash2(wy, i, seed + 7) * 11;
        const len = 8 + hash2(wx, wy + i, seed + 8) * 14;
        line(g, sx, sy, sx + len, sy + sn(sx * 0.1, sy * 0.1, seed) * 2, { w: 1.5, seed: (sx * 13) | 0, wobble: 0.5 });
      }
    }
  }

  marks(ctx, D);
}

function inkOf(th: Theme): string {
  return css(shift(th.terrain.outline, -4, 6));
}

function tonePatch(c: Ctx, r: number, jitter: number, lump: number, inside: (x: number, y: number) => boolean) {
  const { g, seed, span } = c;
  for (let y = span.ty0; y <= span.ty1; y++) {
    for (let x = span.tx0; x <= span.tx1; x++) {
      if (!c.solid(x, y) || !inside(x, y)) continue;
      const wx = (x + 0.5) * TILE;
      const wy = (y + 0.5) * TILE;
      blob(g, wx + sn(wx * 0.3, wy * 0.3, seed + 2) * jitter, wy + sn(wy * 0.3, wx * 0.3, seed + 3) * jitter, r, ((wx + wy * 3) | 0) + seed, 1, lump);
      g.fill();
    }
  }
}

/** Pebbles, cracks and strata ticks. One roll per tile, keyed on where the tile is. */
function marks(c: Ctx, D: (x: number, y: number) => number) {
  const { g, th, seed, span } = c;
  const T = th.terrain;
  const stone = css(shift(T.light, 6, -8));
  const stoneShade = css(shift(T.base, -4, -6));
  const speck = css(shift(T.dark, -4));
  g.lineCap = 'round';
  for (let y = span.ty0; y <= span.ty1; y++) {
    for (let x = span.tx0; x <= span.tx1; x++) {
      if (!c.solid(x, y)) continue;
      const wx = x * TILE;
      const wy = y * TILE;
      const roll = hash2(wx, wy, seed + 20);
      const px = wx + 2 + hash2(wx, wy, seed + 21) * 12;
      const py = wy + 2 + hash2(wx, wy, seed + 22) * 12;
      const sd = ((wx * 7 + wy * 11) | 0) + seed;
      if (roll < 0.17 && D(x, y) >= 2) {
        // A pebble: flat fill, a shaded underside, and a line that doesn't quite close.
        const r = 1.5 + hash2(wx, wy, seed + 23) * 2.6;
        g.fillStyle = stone;
        blob(g, px, py, r, sd, 0.72);
        g.fill();
        g.fillStyle = stoneShade;
        blob(g, px + r * 0.15, py + r * 0.28, r * 0.72, sd + 1, 0.5);
        g.fill();
        g.fillStyle = c.inkCol;
        const arc: P[] = [];
        for (let i = 0; i <= 9; i++) {
          const a = 0.2 + (i / 9) * 4.9;
          arc.push({ x: px + Math.cos(a) * r * 1.08, y: py + Math.sin(a) * r * 0.8 });
        }
        stroke(g, arc, { w: 1.05, seed: sd, taper: [0.05, 0.45] });
      } else if (roll < 0.34) {
        // A crack: a stroke with a fork, pressed hard at the start.
        const a = hash2(wx, wy, seed + 24) * 2 + 0.6;
        const len = 7 + hash2(wx, wy, seed + 25) * 12;
        const pts: P[] = [];
        for (let i = 0; i <= 6; i++) {
          const t = i / 6;
          pts.push({ x: px + Math.cos(a) * len * t + sn(px + t * 3, py, sd) * 2.2, y: py + Math.sin(a) * len * t + sn(py, px + t * 3, sd) * 2.2 });
        }
        g.fillStyle = c.inkCol;
        stroke(g, pts, { w: 1.25, seed: sd, taper: [0.04, 0.8] });
        const m = pts[3];
        line(g, m.x, m.y, m.x + Math.cos(a + 0.8) * len * 0.35, m.y + Math.sin(a + 0.8) * len * 0.35, { w: 0.8, seed: sd + 1, taper: [0.04, 0.8] });
      } else if (roll < 0.6) {
        // Strata ticks: short curved dashes, all leaning the same way.
        g.fillStyle = speck;
        const n = 2 + Math.floor(hash2(wx, wy, seed + 26) * 3);
        for (let i = 0; i < n; i++) {
          const dx = hash2(wx + i, wy, seed + 27) * 12 - 6;
          const dy = hash2(wx, wy + i, seed + 28) * 12 - 6;
          line(g, px + dx, py + dy, px + dx + 3 + hash2(i, wx, seed) * 3, py + dy + 0.8, { w: 0.85, seed: sd + i, taper: [0.2, 0.6] });
        }
      } else if (roll < 0.74) {
        // Stipple: three or four dots, the cheapest way to say "grit".
        g.fillStyle = speck;
        for (let i = 0; i < 4; i++) {
          blob(g, px + hash2(i, wx, seed + 29) * 9 - 4, py + hash2(i, wy, seed + 30) * 9 - 4, 0.4 + hash2(i, sd, 1) * 0.4, sd + i, 1, 0.1);
          g.fill();
        }
      }
    }
  }
}

/** Parallel strokes hanging off every edge that faces away from the light; they fade into the fill. */
export function inkHatch(g: CanvasRenderingContext2D, loops: readonly EdgeP[][], th: Theme, seed: number, area: Area) {
  const dx = -0.6;
  const dy = -0.8;
  const col = css(shift(th.terrain.dark, -8, 4));
  const SP = 2.7;
  g.fillStyle = col;
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i++) {
      const p = loop[i];
      const q = loop[(i + 1) % loop.length];
      const sh = shadeOf(p.nx, p.ny);
      if (sh < 0.74 || p.hidden || !near(area, p.x, p.y, 32)) continue;
      // The lattice is fixed in the world, so a hatch line sits at the same place after any re-bake.
      const a = (p.x * 0.8 - p.y * 0.6) / SP;
      const b = (q.x * 0.8 - q.y * 0.6) / SP;
      if (Math.floor(a) === Math.floor(b)) continue;
      const k = Math.floor(Math.max(a, b));
      const skip = hash2(k, 11, seed);
      if (skip < 0.14) continue;
      const len = (5 + 15 * (sh - 0.74) * 3.2) * (0.55 + 0.75 * hash2(k, 12, seed)) * (0.7 + 0.6 * vn(p.x * 0.06, p.y * 0.06, seed + 40));
      const sx = p.x - p.nx * 0.5;
      const sy = p.y - p.ny * 0.5;
      line(g, sx, sy, sx + dx * len, sy + dy * len, { w: 1.05, seed: k, taper: [0.02, 0.85], wobble: 0.25 });
    }
  }
}

/** The contour itself: one pen, many strokes, lifting between them and leaning on the shadow side. */
export function inkEdges(g: CanvasRenderingContext2D, loops: readonly EdgeP[][], th: Theme, seed: number, area: Area, weight = 1) {
  g.fillStyle = inkOf(th);
  for (const loop of loops) {
    const n = loop.length;
    if (n < 4) continue;
    // Start the walk at a break, or the first stroke would wrap the seam.
    const cell = (p: EdgeP) => {
      const jx = sn(p.x * 0.02, p.y * 0.02, seed + 50) * 0.3;
      return Math.floor(p.x / 42 + jx) * 4096 + Math.floor(p.y / 42 - jx);
    };
    let start = 0;
    for (let i = 0; i < n; i++) {
      if (cell(loop[i]) !== cell(loop[(i + n - 1) % n]) || loop[i].hidden !== loop[(i + n - 1) % n].hidden) {
        start = i;
        break;
      }
    }
    let run: EdgeP[] = [];
    const flush = () => {
      if (run.length >= 3 && !run[0].hidden && run.some((p) => near(area, p.x, p.y, 8))) {
        const m = run[run.length >> 1];
        const sh = shadeOf(m.nx, m.ny);
        const ww = (1.0 + 2.1 * sh * sh) * weight;
        const sd = ((m.x * 3 + m.y * 5) | 0) + seed;
        // Shift off the fill by a hair: registration is never perfect by hand.
        const dx = sn(m.x * 0.03, m.y * 0.03, seed + 51) * 0.55;
        const dy = sn(m.y * 0.03, m.x * 0.03, seed + 52) * 0.45;
        const pts: P[] = run.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        // Lit edges lift off the page sometimes; shadow edges hold.
        if (sh > 0.42 || vn(m.x * 0.05, m.y * 0.05, seed + 53) > 0.3) stroke(g, pts, { w: ww, seed: sd, taper: [0.1, 0.3], press: 0.5, wobble: 0.3 });
      }
      run = [];
    };
    for (let k = 0; k <= n; k++) {
      const p = loop[(start + k) % n];
      const q = loop[(start + k + n - 1) % n];
      if (k && (cell(p) !== cell(q) || p.hidden !== q.hidden)) {
        // Overrun the corner a little so strokes overlap instead of butting.
        run.push(p);
        flush();
        run.push(q);
      }
      run.push(p);
    }
    flush();
  }
}

/** Top-facing stretches of contour, so grass can follow what the outline really does. */
function topRuns(loops: readonly EdgeP[][]): EdgeP[][] {
  const runs: EdgeP[][] = [];
  for (const loop of loops) {
    const n = loop.length;
    let begin = -1;
    for (let i = 0; i < n; i++) {
      if (loop[i].ny >= -0.3 && loop[(i + 1) % n].ny < -0.3) {
        begin = (i + 1) % n;
        break;
      }
    }
    if (begin < 0) continue;
    let run: EdgeP[] = [];
    for (let k = 0; k <= n; k++) {
      const p = loop[(begin + k) % n];
      if (p.ny < -0.3 && !p.hidden) run.push(p);
      else if (run.length) {
        if (run.length >= 2) runs.push(run);
        run = [];
      }
    }
  }
  return runs;
}

/** Grass as one drawn shape along each run: scalloped underside, a highlight stroke, blades and ink. */
export function inkGrass(g: CanvasRenderingContext2D, loops: readonly EdgeP[][], capColor: HSL, seed: number, area: Area) {
  const dark = css(capColor, -20, 1, 6);
  const mid = css(capColor, -5, 1, 4);
  const top = css(capColor, 9);
  const hi = css(capColor, 24, 1, -4);
  const ink = css({ h: capColor.h + 25, s: Math.min(80, capColor.s + 15), l: 9 });
  const under = (x: number, e: number) =>
    e * (4.3 + 2.4 * vn(x * 0.13, 1.5, seed) + 3.4 * Math.pow(Math.abs(Math.sin(x * 0.29 + 2.5 * sn(x * 0.06, 2, seed))), 2.2));
  for (const run of topRuns(loops)) {
    if (!run.some((p) => near(area, p.x, p.y, 24))) continue;
    const N = run.length;
    const L = (i: number) => Math.min(1, i / 2.5, (N - 1 - i) / 2.5);
    const bottom: P[] = [];
    const edge: P[] = [];
    for (let i = 0; i < N; i++) {
      const p = run[i];
      const e = 0.35 + 0.65 * L(i);
      edge.push({ x: p.x, y: p.y - 1.1 });
      bottom.push({ x: p.x, y: p.y + under(p.x, e) });
    }
    const band = (from: readonly P[], to: readonly P[], fill: string) => {
      g.fillStyle = fill;
      g.beginPath();
      from.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
      for (let i = to.length - 1; i >= 0; i--) g.lineTo(to[i].x, to[i].y);
      g.closePath();
      g.fill();
    };
    band(edge, bottom, dark);
    const midLine = bottom.map((b, i) => ({ x: b.x, y: edge[i].y + (b.y - edge[i].y) * (0.62 + 0.12 * sn(b.x * 0.2, 3, seed)) }));
    band(edge, midLine, mid);
    const topLine = bottom.map((b, i) => ({ x: b.x, y: edge[i].y + (b.y - edge[i].y) * (0.27 + 0.1 * sn(b.x * 0.27, 4, seed)) }));
    band(edge, topLine, top);

    // Ink under the drips: thick in the troughs, gone across the peaks.
    g.fillStyle = ink;
    let piece: P[] = [];
    const cut = () => {
      if (piece.length >= 3 && piece.some((q) => near(area, q.x, q.y, 8)))
        stroke(g, piece, { w: 1.5, seed: ((piece[0].x * 3) | 0) + seed, taper: [0.2, 0.3], wobble: 0.15 });
      piece = [];
    };
    for (let i = 0; i < N; i++) {
      const b = bottom[i];
      // Lift at a fixed place every so often, or one stroke could run the whole ledge and a crater at
      // one end would change its pressure at the other.
      if (i && Math.floor(b.x / 34) !== Math.floor(bottom[i - 1].x / 34)) cut();
      if (vn(b.x * 0.09, 7, seed + 60) > 0.32) piece.push({ x: b.x, y: b.y + 0.25 });
      else cut();
    }
    cut();
    // Top line, thin and broken; the blades carry the silhouette.
    let topPiece: P[] = [];
    for (let i = 0; i < N; i++) {
      const c = Math.floor(edge[i].x / 34);
      topPiece.push(edge[i]);
      if (i === N - 1 || Math.floor(edge[i + 1].x / 34) !== c) {
        if (topPiece.length >= 3 && hash2(c, 3, seed) > 0.25) stroke(g, topPiece, { w: 0.95, seed: c + seed, taper: [0.25, 0.4] });
        topPiece = [edge[i]];
      }
    }

    // A fringe of short blades, so the top edge is never one clean line.
    for (let i = 1; i < N - 1; i++) {
      const p = edge[i];
      const h0 = hash2(p.x | 0, 7, seed);
      if (h0 < 0.3 || !near(area, p.x, p.y, 8)) continue;
      const lean = (hash2(p.x | 0, 8, seed) - 0.5) * 1.2;
      const hh = 1.6 + hash2(p.x | 0, 9, seed) * 2.1;
      blade(g, p.x, p.y + 1.2, lean, hh + 0.5, 2.4, ink);
      blade(g, p.x, p.y + 1.2, lean, hh, 1.5, h0 > 0.65 ? top : mid);
    }

    // Highlights.
    g.fillStyle = hi;
    for (let i = 1; i < N - 2; i++) {
      const p = edge[i];
      if (hash2(p.x | 0, 5, seed) < 0.72 || !near(area, p.x, p.y, 12)) continue;
      line(g, p.x, p.y + 1.6, p.x + 3 + hash2(p.x | 0, 6, seed) * 5, p.y + 1.9, { w: 1, seed: p.x | 0, taper: [0.2, 0.7] });
    }
  }
}

/** One live tuft: blades as filled, tapered leaves, held so they sway without re-rolling. */
export interface Tuft {
  x: number;
  y: number;
  blades: { lean: number; h: number; w: number; tone: number }[];
  tx: number;
  ty: number;
}

export function makeTufts(loops: readonly EdgeP[][], seed: number, keepClear: readonly P[] = []): Tuft[] {
  const tufts: Tuft[] = [];
  for (const run of topRuns(loops)) {
    let last = -1e9;
    for (const p of run) {
      // One roll per stretch of ground, so a tuft stays where it was when the run around it changes.
      const cell = Math.floor(p.x / 22);
      if (cell === last || p.ny > -0.8) continue;
      last = cell;
      if (hash2(cell, 9, seed) < 0.3) continue;
      if (keepClear.some((q) => Math.abs(q.x - p.x) < 11 && Math.abs(q.y - p.y) < 6)) continue;
      const n = 2 + Math.floor(hash2(p.x | 0, 10, seed) * 3);
      tufts.push({
        x: p.x,
        y: p.y + 0.5,
        tx: Math.floor(p.x / TILE),
        ty: Math.floor((p.y + 2) / TILE),
        blades: Array.from({ length: n }, (_, i) => ({
          lean: (i - (n - 1) / 2) * 0.32 + (hash2(p.x | 0, i, seed + 1) - 0.5) * 0.3,
          h: 3 + hash2(p.x | 0, i, seed + 2) * 4,
          w: 1.6 + hash2(p.x | 0, i, seed + 3) * 1,
          tone: i % 3,
        })),
      });
    }
  }
  return tufts;
}

export function drawTufts(s: CanvasRenderingContext2D, tufts: readonly Tuft[], level: Level, capColor: HSL, t: number, pushers: readonly P[]) {
  const tones = [css(capColor, -4, 1, 4), css(capColor, 10), css(capColor, -14, 1, 6)];
  const ink = css({ h: capColor.h + 25, s: Math.min(80, capColor.s + 15), l: 9 });
  for (const tf of tufts) {
    if (!tileAt(level, tf.tx, tf.ty) || tileAt(level, tf.tx, tf.ty) === T_ONEWAY) continue;
    let sway = Math.sin(t * 2.1 + tf.x * 0.15) * 0.14 + Math.sin(t * 0.7 + tf.x * 0.03) * 0.1;
    for (const p of pushers) {
      const dx = tf.x - p.x;
      if (Math.abs(dx) < 10 && Math.abs(tf.y - p.y) < 12) sway += Math.sign(dx || 1) * (1 - Math.abs(dx) / 10) * 0.9;
    }
    for (const b of tf.blades) blade(s, tf.x + b.lean * 4, tf.y, b.lean + sway, b.h + 0.8, b.w + 1.15, ink);
    for (const b of tf.blades) blade(s, tf.x + b.lean * 4, tf.y, b.lean + sway, b.h, b.w, tones[b.tone]);
  }
}

function blade(s: CanvasRenderingContext2D, x: number, y: number, lean: number, h: number, w: number, fill: string) {
  const tx = x + lean * h;
  const ty = y - h * (1 - Math.min(0.5, Math.abs(lean) * 0.4));
  const cx = x + lean * h * 0.25;
  const cy = y - h * 0.62;
  s.fillStyle = fill;
  s.beginPath();
  s.moveTo(x - w / 2, y);
  s.quadraticCurveTo(cx - w * 0.35, cy, tx, ty);
  s.quadraticCurveTo(cx + w * 0.35, cy, x + w / 2, y);
  s.closePath();
  s.fill();
}

/** Jump-through planks, drawn as whole boards per run rather than a tile stamp. */
export function inkPlatforms(g: CanvasRenderingContext2D, level: Level, th: Theme, seed: number, solid: (x: number, y: number) => boolean, area: Area) {
  const c = th.terrain.platform.color;
  const ink = inkOf(th);
  const light = css(c, 14);
  const shade = css(c, -15, 1, 4);
  const grain = css(c, -24, 1, 6);
  for (let ty = 0; ty < level.h; ty++) {
    for (let tx = 0; tx < level.w; tx++) {
      if (tileAt(level, tx, ty) !== T_ONEWAY || tileAt(level, tx - 1, ty) === T_ONEWAY) continue;
      let end = tx;
      while (tileAt(level, end + 1, ty) === T_ONEWAY) end++;
      const x0 = tx * TILE - (solid(tx - 1, ty) ? 2 : 0.5);
      const x1 = (end + 1) * TILE + (solid(end + 1, ty) ? 2 : 0.5);
      const y = ty * TILE;
      if (x1 + 8 < area.x0 || x0 - 8 > area.x1 || y + 14 < area.y0 || y - 2 > area.y1) continue;
      const wy = y;
      const H = 5.4;
      const wob = (x: number, k: number, a: number) => sn(x * 0.09, wy * 0.1 + k, seed + 70) * a;
      const topE: P[] = [];
      const botE: P[] = [];
      const midE: P[] = [];
      for (let x = x0; x <= x1 + 0.01; x += 2.5) {
        topE.push({ x, y: y + wob(x, 0, 0.2) });
        botE.push({ x, y: y + H + wob(x, 1, 0.55) });
        midE.push({ x, y: y + H * 0.62 + wob(x, 2, 0.5) });
      }
      const shape = (a: readonly P[], b: readonly P[], fill: string) => {
        g.fillStyle = fill;
        g.beginPath();
        a.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
        for (let i = b.length - 1; i >= 0; i--) g.lineTo(b[i].x, b[i].y);
        g.closePath();
        g.fill();
      };
      // Braces first: the board overlaps them.
      if (!solid(tx - 1, ty)) brace(g, x0 + 4, y + H, 1, css(c, -10), ink, seed + tx);
      if (!solid(end + 1, ty)) brace(g, x1 - 4, y + H, -1, css(c, -10), ink, seed + end);
      shape(topE, botE, css(c));
      shape(midE, botE, shade);
      shape(
        topE,
        topE.map((q) => ({ x: q.x, y: q.y + 1.15 })),
        light,
      );
      g.fillStyle = grain;
      for (let x = x0 + 2; x < x1 - 3; x += 3) {
        const r = hash2(x | 0, wy | 0, seed + 71);
        if (r < 0.62) continue;
        const gy = y + 1.8 + hash2(x | 0, 2, seed + 72) * 2.4;
        line(g, x, gy, x + 5 + r * 8, gy + (r - 0.8) * 2, { w: 0.65, seed: (x | 0) + seed, taper: [0.3, 0.6] });
      }
      g.fillStyle = ink;
      // Board ends and nails, irregular on purpose.
      for (let x = x0 + 12 + hash2(tx, ty, seed) * 16; x < x1 - 8; x += 22 + hash2(x | 0, ty, seed) * 24) {
        const lean = (hash2(x | 0, 1, seed) - 0.5) * 1.3;
        line(g, x, y + 0.2, x + lean, y + H - 0.1, { w: 1.1, seed: x | 0, taper: [0.1, 0.25] });
        blob(g, x - 2, y + 1.6 + hash2(x | 0, 2, seed), 0.5, x | 0, 1, 0.2);
        g.fill();
        blob(g, x + 2.2, y + 3 + hash2(x | 0, 3, seed), 0.5, (x | 0) + 1, 1, 0.2);
        g.fill();
      }
      stroke(g, botE, { w: 1.9, seed: tx + seed, taper: [0.03, 0.05], press: 0.55 });
      stroke(g, topE, { w: 0.85, seed: tx + seed + 1, taper: [0.1, 0.12], press: 0.6 });
      if (!solid(tx - 1, ty)) line(g, x0, y - 0.3, x0 + wob(x0, 3, 0.5), y + H + 0.3, { w: 1.5, seed: tx, taper: [0.1, 0.1] });
      if (!solid(end + 1, ty)) line(g, x1, y - 0.3, x1 + wob(x1, 3, 0.5), y + H + 0.3, { w: 1.8, seed: end, taper: [0.1, 0.1] });
    }
  }
}

function brace(g: CanvasRenderingContext2D, x: number, y: number, dir: number, fill: string, ink: string, seed: number) {
  g.fillStyle = ink;
  line(g, x, y - 1, x + dir * 6, y + 5, { w: 3.5, seed, taper: [0, 0.12], press: 0.15 });
  g.fillStyle = fill;
  line(g, x, y - 1, x + dir * 6, y + 5, { w: 1.9, seed: seed + 1, taper: [0, 0.12], press: 0.15 });
}

function airDistance(level: Level, solid: (x: number, y: number) => boolean): Int16Array {
  const { w, h } = level;
  const d = new Int16Array(w * h).fill(9999);
  const q: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) {
        d[y * w + x] = 0;
        q.push(y * w + x);
      }
    }
  }
  for (let i = 0; i < q.length; i++) {
    const c = q[i];
    const x = c % w;
    const y = (c - x) / w;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (d[j] > d[c] + 1) {
        d[j] = d[c] + 1;
        q.push(j);
      }
    }
  }
  return d;
}
