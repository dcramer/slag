import { type Cell, overlaps, type Rect, rectCircle } from '../../core/geom';
import type { Rng } from '../../core/rng';
import { DT, LEVEL_H, PLAYER_H, PLAYER_W, RUN_COUNTDOWN, TILE } from '../../sim/constants';
import { isProtected, type Level, T_EMPTY, T_SOLID, tileAt } from '../../sim/level';
import {
  AMMO,
  type Archetype,
  type Contrib,
  cannonMuzzle,
  type Hazard,
  type MetalStyle,
  type Module,
  moduleSim,
  newPropState,
  type PlacedProp,
  type PropDef,
  type PropStyle,
  type Role,
  resolveProp,
  type Trim,
  type Xform,
} from '../../sim/props';
import '../../sim/props/modules';
import { analyzeReach } from '../../sim/reach';

/**
 * Shared machinery for set-piece placers: a terrain scan (`Site`) that
 * recipes query for spots (ground runs, open air, ledges), and `finalize`,
 * which validates a candidate by *simulating* it — every solid, hazard and
 * projectile it produces over a full cycle — so the rules hold for any
 * module mix:
 *
 *   - swept solids (plus rider/crush clearance) stay in free, unprotected,
 *     unclaimed cells, and become the footprint;
 *   - nothing dangerous (or moving) comes within SAFE_TILES of spawn/goal;
 *   - static solids never cut the reachable path to the goal.
 */

/** Hazards, moving solids and projectiles stay this many tiles away from spawn and goal. */
export const SAFE_TILES = 4;

/** One candidate set piece. Module coordinates are absolute world tiles. */
export interface Piece {
  name: string;
  archetype: Archetype;
  role: Role;
  style: PropStyle;
  modules: Module[];
  /** Extra cells to reserve (absolute), e.g. a crane mast. Must be free. */
  extra?: Cell[];
  /** Solids may crush against terrain by design (presses): skip clearance checks. */
  crushOk?: boolean;
  /**
   * The recipe guarantees its static solids can't cut the route (e.g. a
   * low block with lots of headroom: a step you hop onto), so skip the
   * reachability re-check, which is the most expensive part of placement.
   */
  pathSafe?: boolean;
}

export interface Recipe {
  name: string;
  weight: number;
  /** Allow a second copy in the same level. */
  repeat?: boolean;
  /** Lazily yields candidates, best first. The placer takes the first valid one. */
  candidates(rng: Rng, s: Site): Iterable<Piece>;
}

export interface Run {
  /** Empty stand row (ground is at y + 1). */
  y: number;
  x0: number;
  /** Inclusive. */
  x1: number;
}

export class Site {
  readonly w: number;
  readonly h: number;
  readonly taken = new Set<number>();
  readonly zones: Rect[];
  private reachCache: { reachable: Set<number>; goalReached: boolean } | null = null;

  constructor(readonly level: Level) {
    this.w = level.w;
    this.h = level.h;
    this.zones = [level.spawn, level.goal].map((c) => ({
      x: (c.tx - SAFE_TILES) * TILE,
      y: (c.ty - SAFE_TILES) * TILE,
      w: (SAFE_TILES * 2 + 1) * TILE,
      h: (SAFE_TILES * 2 + 1) * TILE,
    }));
    // Keep worldgen's known prop solution buildable: reserve each bridge (3 wide) plus headroom above it.
    for (const b of level.solution ?? []) for (let dy = -2; dy <= 0; dy++) for (let i = 0; i < 3; i++) this.taken.add((b.y + dy) * this.w + b.x + i);
  }

  /** Full reachability (real controller). Expensive: only computed when a static solid needs checking. */
  get reach(): { reachable: Set<number>; goalReached: boolean } {
    this.reachCache ??= analyzeReach(this.level, false);
    return this.reachCache;
  }

  tile(x: number, y: number): number {
    return tileAt(this.level, x, y);
  }
  solid(x: number, y: number): boolean {
    return this.tile(x, y) === T_SOLID;
  }
  /** Something you can stand on (solid or one-way). */
  ground(x: number, y: number): boolean {
    return y >= 0 && y < this.h && this.tile(x, y) !== T_EMPTY;
  }
  /** Free for a set piece: in bounds, no tile, unprotected, unclaimed. */
  free(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.tile(x, y) === T_EMPTY && !isProtected(this.level, x, y) && !this.taken.has(y * this.w + x);
  }
  freeRect(x0: number, y0: number, x1: number, y1: number): boolean {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (!this.free(x, y)) return false;
    return true;
  }
  /**
   * Cheap "on the route" proxy for scoring: a stand cell (empty, ground
   * below). Validation never relies on it; it only ranks candidates.
   */
  reachable(x: number, y: number): boolean {
    return x >= 0 && x < this.w && y >= 0 && y < this.h - 1 && this.tile(x, y) === T_EMPTY && this.ground(x, y + 1);
  }
  /** Tile distance (Chebyshev) to the nearer of spawn/goal. */
  zoneDist(x: number, y: number): number {
    const { spawn, goal } = this.level;
    return Math.min(Math.max(Math.abs(x - spawn.tx), Math.abs(y - spawn.ty)), Math.max(Math.abs(x - goal.tx), Math.abs(y - goal.ty)));
  }
  /** Is there a reachable stand cell within dx columns and dy rows (below, or slightly above) of (x, y)? */
  boardable(x: number, y: number, dx = 2, below = 4, above = 1): boolean {
    for (let yy = y - above; yy <= y + below; yy++) for (let xx = x - dx; xx <= x + dx; xx++) if (this.reachable(xx, yy)) return true;
    return false;
  }
  /** Row of the first ground tile at or below y in column x, or -1. */
  groundBelow(x: number, y: number, max = LEVEL_H): number {
    for (let yy = Math.max(0, y); yy < Math.min(this.h, y + max); yy++) if (this.ground(x, yy)) return yy;
    return -1;
  }
  /** Row of the first solid tile above y in column x, or -1. */
  ceilingAbove(x: number, y: number, max = LEVEL_H): number {
    for (let yy = y - 1; yy >= Math.max(0, y - max); yy--) if (this.solid(x, yy)) return yy;
    return -1;
  }
  /** Column over a pit: no ground anywhere below row y. */
  overPit(x: number, y: number): boolean {
    return this.groundBelow(x, y) < 0;
  }
  /** Maximal runs of stand cells with `headroom` free rows (stand row included). */
  groundRuns(headroom: number, minLen = 1): Run[] {
    const out: Run[] = [];
    for (let y = headroom; y < this.h - 1; y++) {
      let x0 = -1;
      for (let x = 0; x <= this.w; x++) {
        let ok = x < this.w && this.ground(x, y + 1) && !this.ground(x, y);
        for (let k = 0; ok && k < headroom; k++) ok = this.free(x, y - k);
        if (ok && x0 < 0) x0 = x;
        if (!ok && x0 >= 0) {
          if (x - x0 >= minLen) out.push({ y, x0, x1: x - 1 });
          x0 = -1;
        }
      }
    }
    return out;
  }
  runReachable(r: Run): boolean {
    for (let x = r.x0; x <= r.x1; x++) if (this.reachable(x, r.y)) return true;
    return false;
  }
}

/** Order candidates: score (higher first) with a random tiebreak, keep the best `n`. */
export function best<T>(rng: Rng, items: T[], score: (t: T) => number, n = 12): T[] {
  return items
    .map((t) => ({ t, k: score(t) + rng.next() * 0.999 }))
    .sort((a, b) => b.k - a.k)
    .slice(0, n)
    .map((x) => x.t);
}

export function makeStyle(rng: Rng, metal: MetalStyle | readonly MetalStyle[], hue: number | readonly number[], o: Partial<PropStyle> = {}): PropStyle {
  return {
    metal: typeof metal === 'string' ? metal : rng.pick(metal),
    trim: (o.trim ?? 'rivets') as Trim,
    hue: typeof hue === 'number' ? hue : rng.pick(hue) + rng.range(-8, 8),
    glowHue: o.glowHue ?? rng.range(25, 50),
    woodHue: o.woodHue ?? rng.range(20, 34),
  };
}

// ---------------------------------------------------------------------------
// Validation by simulation.

function rectCells(r: Rect): Cell[] {
  const out: Cell[] = [];
  const x0 = Math.floor(r.x / TILE);
  const x1 = Math.floor((r.x + r.w - 1e-3) / TILE);
  const y0 = Math.floor(r.y / TILE);
  const y1 = Math.floor((r.y + r.h - 1e-3) / TILE);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]);
  return out;
}

function hazardRect(h: Hazard): Rect {
  if (h.kind === 'rect') return h.r;
  if (h.kind === 'circle') return { x: h.x - h.r, y: h.y - h.r, w: h.r * 2, h: h.r * 2 };
  const x = Math.min(h.x1, h.x2) - h.r;
  const y = Math.min(h.y1, h.y2) - h.r;
  return { x, y, w: Math.abs(h.x2 - h.x1) + h.r * 2, h: Math.abs(h.y2 - h.y1) + h.r * 2 };
}

function hazardHits(h: Hazard, z: Rect): boolean {
  if (h.kind === 'circle') return rectCircle(z, h.x, h.y, h.r);
  if (h.kind === 'rect') return overlaps(h.r, z);
  const n = Math.max(1, Math.ceil(Math.hypot(h.x2 - h.x1, h.y2 - h.y1) / 4));
  for (let i = 0; i <= n; i++) if (rectCircle(z, h.x1 + ((h.x2 - h.x1) * i) / n, h.y1 + ((h.y2 - h.y1) * i) / n, h.r)) return true;
  return false;
}

/** Frames for one full cycle of every timed module (bounded). */
function cycleFrames(mods: readonly Module[]): number {
  let p = 120;
  for (const m of mods) {
    if (m.type === 'rotor') p = Math.max(p, m.period);
    if (m.type === 'vehicle') p = Math.max(p, 2 * (Math.round(m.span / (m.speed / 60)) + m.pause) + 4);
    if (m.type === 'piston') p = Math.max(p, m.period);
    if (m.type === 'geyser') p = Math.max(p, m.off + m.warn + m.on);
    if (m.type === 'tesla') p = Math.max(p, m.off + m.warn + m.on);
    if (m.type === 'flame') p = Math.max(p, m.off + m.warn + m.on);
  }
  return Math.min(p, 1600);
}

/**
 * Validate a candidate and turn it into a PlacedProp (footprint = every
 * cell its solids sweep, plus clearance). Returns null if it breaks a rule.
 */
export function finalize(s: Site, piece: Piece, uid: number, key: string): PlacedProp | null {
  const level = s.level;
  const raw: PropDef = {
    key,
    name: piece.name,
    maker: 'the level',
    archetype: piece.archetype,
    role: piece.role,
    style: piece.style,
    motion: { type: 'none' },
    modules: piece.modules,
    footprint: [[0, 0]],
  };
  const pp: PlacedProp = { uid, def: raw, owner: -1, tx: 0, ty: 0, rot: 0 };
  const r = resolveProp(pp);
  const fp = new Map<number, Cell>();
  const add = (c: Cell) => fp.set(c[1] * s.w + c[0], c);
  const need = (c: Cell) => {
    if (fp.has(c[1] * s.w + c[0])) return true;
    if (!s.free(c[0], c[1])) return false;
    add(c);
    return true;
  };
  /** Claim every cell under a px rect; `must` = they all have to be free (else best-effort). */
  const claim = (rc: Rect, must: boolean): boolean => {
    const x0 = Math.floor(rc.x / TILE);
    const x1 = Math.floor((rc.x + rc.w - 1e-3) / TILE);
    const y0 = Math.floor(rc.y / TILE);
    const y1 = Math.floor((rc.y + rc.h - 1e-3) / TILE);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const k = y * s.w + x;
        if (fp.has(k)) continue;
        if (s.free(x, y)) fp.set(k, [x, y]);
        else if (must) return false;
      }
    }
    return true;
  };

  for (const m of piece.modules) for (const c of moduleSim(m.type).anchors(m)) if (!need(c)) return null;
  for (const c of piece.extra ?? []) if (!need(c)) return null;

  const state = newPropState();
  const out: Contrib = { solids: [], hazards: [], springs: [], winds: [] };
  const first = new Map<number, Rect>();
  const moved = new Set<number>();
  const P = cycleFrames(r.mods);
  // Sample every few frames; each sample claims the box swept since the previous one.
  const last = new Map<number, Rect>();
  for (let f = RUN_COUNTDOWN; f <= RUN_COUNTDOWN + P; f += 3) {
    out.solids.length = 0;
    out.hazards.length = 0;
    for (let mi = 0; mi < r.mods.length; mi++)
      moduleSim(r.mods[mi].type).build?.(r.mods[mi], { level, frame: f, r, off: [0, 0], prev: [0, 0], state, mi, live: true }, out);
    for (const sd of out.solids) {
      if (s.zones.some((z) => overlaps(sd, z)) && (sd.dx || sd.dy || moved.has(sd.id))) return null;
      const lp = last.get(sd.id);
      const sweep: Rect = lp
        ? {
            x: Math.min(lp.x, sd.x),
            y: Math.min(lp.y, sd.y),
            w: Math.max(lp.x + lp.w, sd.x + sd.w) - Math.min(lp.x, sd.x),
            h: Math.max(lp.y + lp.h, sd.y + sd.h) - Math.min(lp.y, sd.y),
          }
        : sd;
      last.set(sd.id, { x: sd.x, y: sd.y, w: sd.w, h: sd.h });
      if (!claim(sweep, true)) return null;
      const f0 = first.get(sd.id);
      if (!f0) first.set(sd.id, { x: sd.x, y: sd.y, w: sd.w, h: sd.h });
      else if (f0.x !== sd.x || f0.y !== sd.y) moved.add(sd.id);
      if (piece.crushOk || (!sd.dx && !sd.dy)) continue;
      // Clearance: a rider on top, and room to push a runner aside without crushing it into terrain.
      const cl: Rect = {
        x: sd.x - (sd.dx ? PLAYER_W + 1 : 0),
        y: sd.y - PLAYER_H - 1,
        w: sd.w + (sd.dx ? 2 * (PLAYER_W + 1) : 0),
        h: sd.h + PLAYER_H + 1 + (sd.dy ? PLAYER_H + 1 : 0),
      };
      if (!claim(cl, true)) return null;
    }
    for (const hz of out.hazards) {
      if (s.zones.some((z) => hazardHits(hz, z))) return null;
      claim(hazardRect(hz), false);
    }
  }

  // Projectiles: a fixed gun fires the same shot every time, so trace one shot's
  // flight (same integration as RunWorld) and keep it clear of spawn/goal.
  for (const m of r.mods) {
    if (m.type !== 'cannon') continue;
    const spec = AMMO[m.ammo];
    const pad = 6 + spec.radius + spec.wobble * 5;
    let [x, y] = cannonMuzzle(m);
    const vx = Math.cos(m.angle) * m.speed;
    let vy = Math.sin(m.angle) * m.speed;
    for (let f = 0; f < 60 * 8; f++) {
      vy += spec.gravity * DT;
      x += vx * DT;
      y += vy * DT;
      if (x < -16 || x > s.w * TILE + 16 || y > s.h * TILE + 16 || y < -200 || s.solid(Math.floor(x / TILE), Math.floor(y / TILE))) break;
      if (s.zones.some((z) => rectCircle(z, x, y, pad))) return null;
    }
  }

  // Static solids must not cut the path to the goal.
  const statics = [...first.entries()].filter(([id]) => !moved.has(id)).map(([, rc]) => rc);
  if (statics.length && !piece.pathSafe) {
    const tiles = new Uint8Array(level.tiles);
    for (const rc of statics) for (const [x, y] of rectCells(rc)) tiles[y * s.w + x] = T_SOLID;
    const before = s.reach;
    const after = analyzeReach({ ...level, tiles }, before.goalReached);
    if (before.goalReached && !after.goalReached) return null;
    if (!before.goalReached) for (const k of before.reachable) if (!after.reachable.has(k) && tiles[k] !== T_SOLID) return null;
  }

  // Normalize: origin at the footprint's top-left, modules shifted into prop-local tiles.
  const cells = [...fp.values()];
  const tx = Math.min(...cells.map((c) => c[0]));
  const ty = Math.min(...cells.map((c) => c[1]));
  const shift: Xform = { P: (p) => [p[0] - tx, p[1] - ty], C: (cs) => cs.map((c) => [c[0] - tx, c[1] - ty] as Cell), da: 0, T: 1 };
  const modules = piece.modules.map((m) => moduleSim(m.type).resolve(m, shift));
  const def: PropDef = { ...raw, modules, footprint: cells.map((c) => [c[0] - tx, c[1] - ty] as Cell).sort((a, b) => a[1] - b[1] || a[0] - b[0]) };
  return { uid, def, owner: -1, tx, ty, rot: 0 };
}

/** Claim a placed piece's cells so later pieces avoid them. */
export function commit(s: Site, pp: PlacedProp): void {
  for (const [x, y] of pp.def.footprint) s.taken.add((y + pp.ty) * s.w + (x + pp.tx));
}

/**
 * Build a theme placer from recipes: pick 1–3 pieces, trying recipes in a
 * weighted random order and each recipe's candidates best-first.
 */
export function makePlacer(themeKey: string, recipes: readonly Recipe[], uidBase: number) {
  return (rng: Rng, level: Level): PlacedProp[] => {
    const s = new Site(level);
    const want = rng.weighted([
      [1, 2],
      [2, 4],
      [3, 3],
    ] as const);
    const pool = recipes.map((r) => ({ r, k: rng.next() ** (1 / r.weight) })).sort((a, b) => b.k - a.k);
    const order = [...pool.map((p) => p.r), ...pool.filter((p) => p.r.repeat).map((p) => p.r)];
    const out: PlacedProp[] = [];
    for (const recipe of order) {
      if (out.length >= want) break;
      let tries = 0;
      for (const cand of recipe.candidates(rng, s)) {
        if (++tries > 16) break;
        const pp = finalize(s, cand, uidBase + out.length, `setpiece:${themeKey}:${recipe.name}`);
        if (pp) {
          out.push(pp);
          commit(s, pp);
          break;
        }
      }
    }
    return out;
  };
}
