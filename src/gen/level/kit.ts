import { dexp } from '../../core/dmath';
import type { Rng } from '../../core/rng';
import { T_EMPTY, T_ONEWAY, T_SOLID } from '../../sim/level';
import { jumpProfile } from './probe';
import { BRIDGE_W, type BridgeHint, type Shape } from './types';

/**
 * Sculpting toolkit shared by the per-theme sculptors: a tile grid with a
 * "keep" mask (cells later stamps must leave empty), 1-D value noise for
 * heightmaps, cellular-automaton smoothing for organic shapes, and the
 * spawn/goal pocket finisher every sculptor ends with.
 *
 * Levels come in any size (gen/level/profile.ts), so everything here is
 * parametrized by the grid's own `w`×`h`; there are no global dimensions.
 * Determinism: only Rng and plain arithmetic (no Math.exp/sin/pow…), so
 * results are bit-identical across JS engines.
 */

export { T_EMPTY, T_ONEWAY, T_SOLID };

/** Spawn stands in column 2, the goal in column w-3; their pockets are 5 wide. */
export const SPAWN_X = 2;
export const POCKET = 5;

export class Grid {
  readonly t: Uint8Array;
  /** Cells that non-forced stamps must leave untouched (walk lanes, pockets). */
  readonly keep: Uint8Array;
  readonly hints: BridgeHint[] = [];
  /** Column spans of hard crossings (recorded by hintGap). */
  readonly crossings: [number, number][] = [];
  /** Set by sculptors that built a crossing meant to need a bridge prop. */
  wantsProps = false;
  /** Set by sculptors working in solid rock: second routes are carved, not hung (Shape.carve). */
  carve = false;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.t = new Uint8Array(w * h);
    this.keep = new Uint8Array(w * h);
  }

  inb(x: number, y: number): boolean {
    return x >= 0 && x < this.w && y >= 0 && y < this.h;
  }
  /** Like tileAt: outside x is solid wall, outside y is empty. */
  get(x: number, y: number): number {
    if (x < 0 || x >= this.w) return T_SOLID;
    if (y < 0 || y >= this.h) return T_EMPTY;
    return this.t[y * this.w + x];
  }
  empty(x: number, y: number): boolean {
    return this.get(x, y) === T_EMPTY;
  }
  set(x: number, y: number, v: number, force = false): void {
    if (!this.inb(x, y)) return;
    const k = y * this.w + x;
    if (!force && this.keep[k] && v !== T_EMPTY) return;
    this.t[k] = v;
  }
  /** Fill an inclusive rect (corners in any order). */
  fill(x0: number, y0: number, x1: number, y1: number, v: number = T_SOLID, force = false): void {
    const [ax, bx] = x0 <= x1 ? [x0, x1] : [x1, x0];
    const [ay, by] = y0 <= y1 ? [y0, y1] : [y1, y0];
    for (let y = Math.max(0, ay); y <= Math.min(this.h - 1, by); y++)
      for (let x = Math.max(0, ax); x <= Math.min(this.w - 1, bx); x++) this.set(x, y, v, force);
  }
  clear(x0: number, y0: number, x1: number, y1: number): void {
    this.fill(x0, y0, x1, y1, T_EMPTY, true);
  }
  /** One-way plank row, only into empty cells (never overwrites solid). */
  plank(x0: number, x1: number, y: number): void {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) if (this.empty(x, y)) this.set(x, y, T_ONEWAY);
  }
  /** Mark an inclusive rect as must-stay-empty for later non-forced stamps. */
  reserve(x0: number, y0: number, x1: number, y1: number): void {
    for (let y = Math.max(0, Math.min(y0, y1)); y <= Math.min(this.h - 1, Math.max(y0, y1)); y++)
      for (let x = Math.max(0, Math.min(x0, x1)); x <= Math.min(this.w - 1, Math.max(x0, x1)); x++) this.keep[y * this.w + x] = 1;
  }
  /** Topmost non-empty row in column x at or below `from` (this.h if none). */
  surface(x: number, from = 0): number {
    for (let y = from; y < this.h; y++) if (this.get(x, y) !== T_EMPTY) return y;
    return this.h;
  }
  /** Fill column x from row `top` to the bottom. */
  column(x: number, top: number, v: number = T_SOLID, force = false): void {
    this.fill(x, top, x, this.h - 1, v, force);
  }
  hint(x: number, y: number): void {
    this.hints.push({ x, y });
  }
}

/**
 * 1-D fractal value noise in [-1, 1], `n` samples. `scale` is the lattice
 * spacing of the first octave in samples; each octave halves it.
 */
export function noise1D(rng: Rng, n: number, scale: number, octaves = 2, persistence = 0.5): number[] {
  const out = new Array<number>(n).fill(0);
  let amp = 1;
  let norm = 0;
  let s = scale;
  for (let o = 0; o < octaves; o++) {
    const pts = Math.ceil(n / s) + 2;
    const lat = Array.from({ length: pts }, () => rng.range(-1, 1));
    for (let i = 0; i < n; i++) {
      const f = i / s;
      const i0 = Math.floor(f);
      const t = f - i0;
      const u = t * t * (3 - 2 * t);
      out[i] += amp * (lat[i0] * (1 - u) + lat[i0 + 1] * u);
    }
    norm += amp;
    amp *= persistence;
    s = Math.max(1, s / 2);
  }
  return out.map((v) => v / norm);
}

/**
 * Cellular-automaton smoothing on a boolean mask (W×H). A cell becomes
 * solid with ≥ birth solid neighbors (of 8), stays solid with ≥ survive.
 * Out-of-bounds counts as `edge`.
 */
export function smoothCA(W: number, H: number, mask: Uint8Array, iters: number, birth = 5, survive = 4, edge = 1): Uint8Array {
  let cur = mask;
  for (let it = 0; it < iters; it++) {
    const nxt = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            const xx = x + dx;
            const yy = y + dy;
            n += xx < 0 || yy < 0 || xx >= W || yy >= H ? edge : cur[yy * W + xx];
          }
        const k = y * W + x;
        nxt[k] = cur[k] ? (n >= survive ? 1 : 0) : n >= birth ? 1 : 0;
      }
    }
    cur = nxt;
  }
  return cur;
}

/** Fill a ground heightmap: `surf[x]` is the top solid row of column x (≥ H means pit). */
export function groundFromHeights(g: Grid, surf: readonly number[], v: number = T_SOLID): void {
  for (let x = 0; x < g.w; x++) if (surf[x] < g.h) g.column(x, surf[x], v);
}

/** Limit neighbor height differences so the walk stays climbable (values ≥ H are pits). */
export function limitSlope(surf: number[], maxStep: number, H: number): number[] {
  for (let pass = 0; pass < 3; pass++) {
    for (let x = 1; x < surf.length; x++) {
      if (surf[x] >= H || surf[x - 1] >= H) continue;
      if (surf[x] < surf[x - 1] - maxStep) surf[x] = surf[x - 1] - maxStep;
    }
    for (let x = surf.length - 2; x >= 0; x--) {
      if (surf[x] >= H || surf[x + 1] >= H) continue;
      if (surf[x] < surf[x + 1] - maxStep) surf[x] = surf[x + 1] - maxStep;
    }
  }
  return surf;
}

export interface Pocket {
  /** Row players stand in (the floor is row + 1). */
  row: number;
  /** Fill the floor under the pocket down this many rows (default: to the bottom). */
  depth?: number;
  /** Floor tile kind (default solid). */
  floor?: number;
}

/**
 * Carve the spawn (left) and goal (right) pockets, guarantee their floors,
 * and package the grid as a Shape. Pockets are 5 wide and 4 tall above the
 * floor; the protected rects cover pocket + floor row.
 */
export function finish(g: Grid, spawn: Pocket, goal: Pocket, style: string): Shape {
  const W = g.w;
  const H = g.h;
  const pocket = (x0: number, p: Pocket) => {
    g.clear(x0, p.row - 3, x0 + POCKET - 1, p.row);
    const bottom = p.depth ? Math.min(H - 1, p.row + p.depth) : H - 1;
    g.fill(x0, p.row + 1, x0 + POCKET - 1, p.row + 1, p.floor ?? T_SOLID, true);
    for (let x = x0; x < x0 + POCKET; x++) for (let y = p.row + 2; y <= bottom; y++) if (g.empty(x, y)) g.set(x, y, T_SOLID, true);
  };
  pocket(0, spawn);
  pocket(W - POCKET, goal);
  return {
    w: g.w,
    h: g.h,
    tiles: g.t,
    spawn: { tx: SPAWN_X, ty: spawn.row },
    goal: { tx: W - 3, ty: goal.row },
    protectedRects: [
      { x: 0, y: spawn.row - 3, w: POCKET, h: 5 },
      { x: W - POCKET, y: goal.row - 3, w: POCKET, h: 5 },
    ],
    style,
    bridgeHints: g.hints.slice(),
    wantsProps: g.wantsProps,
    crossings: g.crossings.slice(),
    carve: g.carve,
  };
}

/** Hint a bridge in the middle of a gap whose floor row is `row` (bridge top = row - 1 stand cell). */
export function hintGap(g: Grid, x0: number, x1: number, row: number): void {
  g.crossings.push([x0, x1]);
  const w = x1 - x0 + 1;
  if (w <= 3) {
    g.hint(x0, row);
    return;
  }
  // A lone bridge can't sit in the middle of a wide gap: you can run at it but only walk off it,
  // so it goes a walking jump short of the far bank.
  const { walkGap } = jumpProfile();
  g.hint(Math.max(x0, x1 - walkGap - BRIDGE_W + 1), row);
  if (w >= 9) {
    g.hint(x0 + Math.floor(w / 3) - 1, row);
    g.hint(x1 - Math.floor(w / 3) - 1, row);
  }
  g.hint(x0 + Math.floor((w - 3) / 2), row);
}

/**
 * Organic terrain: a solid-probability field that rises below a noisy
 * surface line, roughened with random speckle and smoothed by a cellular
 * automaton. Yields overhangs, undercuts and pockets instead of a heightmap.
 * `surf[x]` is the nominal ground row; `soft` is how many rows the
 * transition blurs over.
 */
export function organicMask(rng: Rng, W: number, H: number, surf: readonly number[], soft = 3, iters = 4): Uint8Array {
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = (y - surf[x]) / soft; // >0 below the surface
      const p = 1 / (1 + dexp(-d * 2.2));
      m[y * W + x] = rng.next() < p ? 1 : 0;
    }
  return smoothCA(W, H, m, iters, 5, 4, 0);
}

/**
 * Carve a walkable corridor from (x0, y0) to (x1, y1): `clear` rows of
 * headroom above a floor row that wanders by at most one row per column.
 * Returns the stand row per column (NaN outside the corridor).
 */
export function carveCorridor(g: Grid, rng: Rng, x0: number, y0: number, x1: number, y1: number, clear = 4, wander = 0.35): number[] {
  const W = g.w;
  const H = g.h;
  const rows = new Array<number>(W).fill(Number.NaN);
  let y = y0;
  for (let x = x0; x <= x1; x++) {
    const left = x1 - x;
    const want = y1 - y;
    if (left > 0 && Math.abs(want) >= left) y += Math.sign(want);
    else if (rng.chance(wander)) y += rng.chance(0.5 + Math.sign(want) * 0.2) ? 1 : -1;
    y = Math.max(clear + 1, Math.min(H - 3, y));
    rows[x] = y;
    g.clear(x, y - clear + 1, x, y);
    if (g.empty(x, y + 1)) g.set(x, y + 1, T_SOLID, true);
  }
  return rows;
}

/** 2-D value noise over the tile grid in [-1, 1] (smoothstep-interpolated lattice every `scale` tiles, 2 octaves). */
export function noise2D(rng: Rng, W: number, H: number, scale: number, octaves = 2): Float32Array {
  const out = new Float32Array(W * H);
  let amp = 1;
  let norm = 0;
  let s = scale;
  for (let o = 0; o < octaves; o++) {
    const lw = Math.ceil(W / s) + 2;
    const lh = Math.ceil(H / s) + 2;
    const lat = Array.from({ length: lw * lh }, () => rng.range(-1, 1));
    for (let y = 0; y < H; y++) {
      const fy = y / s;
      const y0 = Math.floor(fy);
      const ty = fy - y0;
      const v = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < W; x++) {
        const fx = x / s;
        const x0 = Math.floor(fx);
        const tx = fx - x0;
        const u = tx * tx * (3 - 2 * tx);
        const a = lat[y0 * lw + x0] * (1 - u) + lat[y0 * lw + x0 + 1] * u;
        const b = lat[(y0 + 1) * lw + x0] * (1 - u) + lat[(y0 + 1) * lw + x0 + 1] * u;
        out[y * W + x] += amp * (a * (1 - v) + b * v);
      }
    }
    norm += amp;
    amp *= 0.5;
    s = Math.max(1, s / 2);
  }
  for (let i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}
