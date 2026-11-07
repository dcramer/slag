import { dcos, dhypot, dpow, dsin } from '../../core/dmath';
import { type Cell, overlaps, type Rect, rectCircle, type Vec } from '../../core/geom';
import { Rng } from '../../core/rng';
import { PLAYER_H, PLAYER_W, RUN_COUNTDOWN, TILE } from '../../sim/constants';
import { isProtected, type Level, T_EMPTY, T_SOLID, tileAt, type TileRect } from '../../sim/level';
import {
  AMMO,
  cycleFrames,
  type Archetype,
  buildSolids,
  type Contrib,
  cannonMuzzle,
  type Hazard,
  type MetalStyle,
  type Module,
  type Motion,
  motionOffset,
  moduleSim,
  newPropState,
  type PlacedProp,
  type PropCtx,
  type PropDef,
  type PropStyle,
  type Resolved,
  type Role,
  resolveProp,
  traceRays,
  traceShot,
  type Trim,
  type Xform,
} from '../../sim/props';
import '../../sim/props/modules';
import { ReachCache } from '../../sim/reach';
import { gustPeak } from '../../sim/weather';
import { CENTRE_KEY } from '../level/measure';
import { noFreeRide } from '../level/winnable';
import { hazardBox, tellFaults, throughFaults, windowFaults } from './contract';

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
  /** Whole-piece motion (a lift's rail with `dwell`, a track); none when absent. */
  motion?: Motion;
}

export interface Recipe {
  name: string;
  weight: number;
  /** What the piece mostly does (danger knob tilts weights toward hazards or helpers). Default 'hazard'. */
  role?: Role;
  /** Allow a second copy in the same level. */
  repeat?: boolean;
  /**
   * A hazard no other theme has (docs/DESIGN.md: at least 3 per theme): its hazard signature
   * (`hazardSignature`, ./contract.ts) matches no other theme's recipe, which tests/conformance checks.
   */
  unique?: boolean;
  /**
   * Its card in the codex's maps (src/codex/maps.ts), which shows every `unique` recipe under its theme: the
   * name it goes by, a one-line joke and what it does. tests/codex-maps.test.ts asks every unique recipe for one.
   */
  codex?: { title: string; note: string; about: string };
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

  constructor(
    readonly level: Level,
    readonly cache = new ReachCache(level),
  ) {
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
    if (!this.reachCache) {
      const { goalReached, cells } = this.cache.analyze(this.level, false);
      this.reachCache = { goalReached, reachable: new Set(cells) };
    }
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
  groundBelow(x: number, y: number, max = this.h): number {
    for (let yy = Math.max(0, y); yy < Math.min(this.h, y + max); yy++) if (this.ground(x, yy)) return yy;
    return -1;
  }
  /** Row of the first solid tile above y in column x, or -1. */
  ceilingAbove(x: number, y: number, max = this.h): number {
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

function hazardHits(h: Hazard, z: Rect): boolean {
  if (h.kind === 'circle') return rectCircle(z, h.x, h.y, h.r);
  if (h.kind === 'rect') return overlaps(h.r, z);
  const n = Math.max(1, Math.ceil(dhypot(h.x2 - h.x1, h.y2 - h.y1) / 4));
  for (let i = 0; i <= n; i++) if (rectCircle(z, h.x1 + ((h.x2 - h.x1) * i) / n, h.y1 + ((h.y2 - h.y1) * i) / n, h.r)) return true;
  return false;
}

/**
 * Validate a candidate and turn it into a PlacedProp (footprint = every
 * cell its solids sweep, plus clearance). Returns null if it breaks a rule. `path` false skips the one rule
 * that asks reach (its static solids cut no path), for a probe that proves nothing.
 */
export function finalize(s: Site, piece: Piece, uid: number, key: string, path = true): PlacedProp | null {
  const level = s.level;
  const raw: PropDef = {
    key,
    name: piece.name,
    maker: 'the level',
    archetype: piece.archetype,
    role: piece.role,
    style: piece.style,
    motion: piece.motion ?? { type: 'none' },
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
  const P = cycleFrames(r.mods, r.motion);
  // Sample every few frames; each sample claims the box swept since the previous one.
  const last = new Map<number, Rect>();
  for (let f = RUN_COUNTDOWN; f <= RUN_COUNTDOWN + P; f += 3) {
    out.solids.length = 0;
    out.hazards.length = 0;
    const ctx = (rp: Resolved, mi: number): PropCtx => ({
      level,
      frame: f,
      r: rp,
      off: motionOffset(rp, f),
      prev: motionOffset(rp, f - 1),
      state,
      mi,
      live: true,
    });
    buildSolids([r], ctx, out);
    traceRays([r], ctx, out);
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
      claim(hazardBox(hz), false);
    }
  }

  // Projectiles: a fixed gun fires the same shot every time, so trace one shot through the real
  // projectile step (bounces, rolls and wobble included) and keep it clear of spawn/goal. A ballistic
  // copy of the flight stopped at the first wall and missed a rubber ball bouncing into the goal. A gust
  // carries a shot sideways somewhere between still air and full push, so both bound where it can go.
  const airs = [...new Set([0, gustPeak(level)])];
  for (const m of r.mods) {
    if (m.type !== 'cannon') continue;
    const pad = 6 + AMMO[m.ammo].radius;
    const [mx, my] = cannonMuzzle(m);
    const shot = { x: mx, y: my, vx: dcos(m.angle) * m.speed, vy: dsin(m.angle) * m.speed, owner: -1, ammo: m.ammo };
    for (const air of airs) if (traceShot(level, shot, undefined, air).some((q) => s.zones.some((z) => rectCircle(z, q.x, q.y, pad)))) return null;
  }

  // Static solids must not cut the path to the goal.
  const statics = [...first.entries()].filter(([id]) => !moved.has(id)).map(([, rc]) => rc);
  if (path && statics.length && !piece.pathSafe) {
    const tiles = new Uint8Array(level.tiles);
    for (const rc of statics) for (const [x, y] of rectCells(rc)) tiles[y * s.w + x] = T_SOLID;
    const before = s.reach;
    const after = s.cache.analyze({ ...level, tiles }, before.goalReached);
    if (before.goalReached && !after.goalReached) return null;
    if (!before.goalReached) {
      const still = new Set(after.cells);
      for (const k of before.reachable) if (!still.has(k) && tiles[k] !== T_SOLID) return null;
    }
  }

  // Normalize: origin at the footprint's top-left, modules shifted into prop-local tiles.
  const cells = [...fp.values()];
  const tx = Math.min(...cells.map((c) => c[0]));
  const ty = Math.min(...cells.map((c) => c[1]));
  const shiftP = (p: Vec): Vec => [p[0] - tx, p[1] - ty];
  const shift: Xform = { P: shiftP, U: shiftP, UA: (a) => a, C: (cs) => cs.map((c) => [c[0] - tx, c[1] - ty] as Cell), da: 0, T: 1 };
  const modules = piece.modules.map((m) => moduleSim(m.type).resolve(m, shift));
  const def: PropDef = { ...raw, modules, footprint: cells.map((c) => [c[0] - tx, c[1] - ty] as Cell).sort((a, b) => a[1] - b[1] || a[0] - b[0]) };
  return { uid, def, owner: -1, tx, ty, rot: 0 };
}

/** Claim a placed piece's cells so later pieces avoid them. */
export function commit(s: Site, pp: PlacedProp): void {
  for (const [x, y] of pp.def.footprint) s.taken.add((y + pp.ty) * s.w + (x + pp.tx));
}

/** Level-profile knobs for the placer. */
export interface PlacerOpts {
  /** How many pieces to aim for (0–4). Default: a 1–3 roll. */
  count?: number;
  /** 0 = favour build/utility recipes (lifts, platforms) … 1 = favour hazard recipes. Default 0.5 (recipe weights as written). */
  danger?: number;
  /** The level's reachability cache, if the caller has one. */
  cache?: ReachCache;
  /** Has the last say on each piece, given every piece so far with it last (worldgen: the solution still holds). */
  keep?: (pieces: readonly PlacedProp[]) => boolean;
  /** Pieces already standing (a landmark's): their cells are taken, and the new pieces' uids follow theirs. */
  standing?: readonly PlacedProp[];
  /** Areas to leave empty (a landmark's air). */
  avoid?: readonly TileRect[];
  /** Draw only from these recipe names (a stage concept's hazard family). */
  family?: readonly string[];
  /** Draw only recipes of these roles (the level profile's `setPieceRoles`). */
  roles?: readonly Role[];
  /**
   * The room the builder laid the level round (`Shape.centre`, a brawl arena's): before anything else one of the set's
   * hazards stands in these cells as its centrepiece, centred on the middle or a pair mirrored across it (`placeCentre`).
   */
  centre?: readonly TileRect[];
  /** Gets one entry per recipe tried, in order (diagnostics: `GenInfo.placement`, `pnpm level`); never changes a placement. */
  log?: RecipeTry[];
}

/** Why a candidate was turned down: the placer's checks, in the order it runs them (`reach`: a centrepiece that reaches too few places to stand). */
type Refusal = 'tell' | 'fit' | 'window' | 'through' | 'reach' | 'keep' | 'ride';

/** One recipe the placer tried on a level: how many candidate spots it offered (none: it found no spot), and whether one went in. */
export interface RecipeTry {
  recipe: string;
  role: Role;
  offered: number;
  placed: boolean;
  /** Candidates turned down, by the first check each failed. */
  refused: Partial<Record<Refusal, number>>;
  /** Tried as the level's centrepiece (`PlacerOpts.centre`). */
  centre?: true;
}

/** Columns off the middle a centrepiece's footprint centres on and still counts as centred, and a mirrored pair's as each other's mirror. */
const CENTRED = 1.5;
/** Off-centre candidates of a recipe whose mirror the centrepiece pass looks for. */
const MIRROR_TRIES = 2;
/** Tiles round the mirror of a centrepiece's footprint its twin may take: a recipe's spot is its own, not a reflection. */
const TWIN_SLACK = 2;
/** Tiles from a centrepiece within which a place to stand counts as in its reach: as far as a knock carries you (level/measure.ts). */
const REACH = 3;
/**
 * Places to stand (`Site.reachable`: a floor with air over it) a centrepiece reaches at least: the feature of the
 * arena, not a glass pane on a lip.
 */
const CENTRE_REACH = 12;

/** Places to stand within `REACH` tiles of any of `pps`' footprints. */
function reachOf(s: Site, pps: readonly PlacedProp[]): number {
  const near = new Set<number>();
  for (const pp of pps)
    for (const [fx, fy] of pp.def.footprint)
      for (let y = fy + pp.ty - REACH; y <= fy + pp.ty + REACH; y++)
        for (let x = fx + pp.tx - REACH; x <= fx + pp.tx + REACH; x++) if (s.reachable(x, y)) near.add(y * s.w + x);
  return near.size;
}

/** The mean of a piece's footprint cells, in tiles. */
function centroid(pp: PlacedProp): Vec {
  const n = pp.def.footprint.length;
  let x = 0;
  let y = 0;
  for (const [cx, cy] of pp.def.footprint) {
    x += cx + pp.tx + 0.5;
    y += cy + pp.ty + 0.5;
  }
  return [x / n, y / n];
}

/** A piece whose footprint centres on the level's middle column. */
const centredIn = (s: Site, pp: PlacedProp) => Math.abs(centroid(pp)[0] - s.w / 2) <= CENTRED;

/** A copy of `s` (the same level and cache, what it's taken) with every cell outside `inside` taken too. */
function fenced(s: Site, inside: (x: number, y: number) => boolean): Site {
  const f = new Site(s.level, s.cache);
  for (const k of s.taken) f.taken.add(k);
  for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (!inside(x, y)) f.taken.add(y * f.w + x);
  return f;
}

const inRects = (rects: readonly TileRect[]) => (x: number, y: number) => rects.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);

/** The checks a candidate passes on its own (tell, fit, window, through), before the proofs (keep, ride). */
function fits(s: Site, cand: Piece, uid: number, key: string, path = true): { pp: PlacedProp | null; why: Refusal | null } {
  if (tellFaults(cand.modules).length) return { pp: null, why: 'tell' };
  const pp = finalize(s, cand, uid, key, path);
  if (!pp) return { pp, why: 'fit' };
  return { pp, why: windowFaults(s.level, pp).length ? 'window' : throughFaults(s.level, pp).length ? 'through' : null };
}

/**
 * Whether one of `recipes` (of `roles`, hazards only) would stand in `rooms` as a centrepiece (`placeCentre`), short of
 * the proofs (keep, ride): the pipeline asks before it proves a level built round a centre (`Shape.centre`), so a
 * room none of the set's hazards can stand in is laid again as another kind rather than proven and then turned down.
 */
export function centreFits(
  rng: Rng,
  level: Level,
  rooms: readonly TileRect[],
  recipes: readonly Recipe[],
  roles?: readonly Role[],
  cache?: ReachCache,
): boolean {
  if (roles && !roles.includes('hazard')) return false;
  const hazards = recipes.filter((r) => (r.role ?? 'hazard') === 'hazard');
  return (
    placeCentre(rng, new Site(level, cache), rooms, hazards, { cap: tryCapOf(level), uid: 0, key: () => 'probe', holds: () => null, path: false }).length > 0
  );
}

const tryCapOf = (level: Level) => Math.round(16 * Math.max(1, Math.sqrt((level.w * level.h) / (48 * 27))));

/** Recipe weight scaled by the level's danger: hazards up to ×2.4 on nasty levels, ×0.4 on tame ones (and the reverse for helpers). */
function dangerWeight(r: Recipe, danger: number): number {
  const hazard = r.role === 'hazard' || r.role === undefined;
  const k = hazard ? 0.4 + 2 * danger : 2.4 - 2 * danger;
  return r.weight * Math.max(0.15, k);
}

/**
 * Build a theme placer from recipes: pick `opts.count` pieces (default a 1–3
 * roll), trying recipes in a weighted random order (weights tilted by
 * `opts.danger`) and each recipe's candidates best-first. Bigger levels get
 * more candidate tries per recipe. A candidate goes in once `finalize` and
 * `opts.keep` accept it and it gives a bare run no free ride
 * (`noFreeRide`, ../level/winnable.ts).
 */
export function makePlacer(themeKey: string, recipes: readonly Recipe[], uidBase: number) {
  return (rng: Rng, level: Level, opts: PlacerOpts = {}): PlacedProp[] => {
    const s = new Site(level, opts.cache);
    const standing = opts.standing ?? [];
    for (const pp of standing) commit(s, pp);
    for (const a of opts.avoid ?? [])
      for (let y = Math.max(0, a.y); y < Math.min(s.h, a.y + a.h); y++)
        for (let x = Math.max(0, a.x); x < Math.min(s.w, a.x + a.w); x++) s.taken.add(y * s.w + x);
    const first = standing.length;
    const rolled = rng.weighted([
      [1, 2],
      [2, 4],
      [3, 3],
    ] as const);
    const want = opts.count ?? rolled;
    if (want <= 0) return [];
    const danger = opts.danger ?? 0.5;
    const tryCap = tryCapOf(level);
    const family = opts.family;
    const roles = opts.roles;
    const pool = recipes
      .filter((r) => (!family || family.includes(r.name)) && (!roles || roles.includes(r.role ?? 'hazard')))
      .map((r) => ({ r, k: dpow(rng.next() + 1e-9, 1 / (opts.danger === undefined ? r.weight : dangerWeight(r, danger))) }))
      .sort((a, b) => b.k - a.k)
      .map((p) => p.r);
    const out: PlacedProp[] = [];
    const key = (r: Recipe) => `setpiece:${themeKey}:${r.name}`;
    /** The proofs (keep, ride), for `pp` going in after `more` (a centrepiece's twin after its first). */
    const holds = (pp: PlacedProp, more: readonly PlacedProp[] = []): Refusal | null =>
      opts.keep && !opts.keep([...out, ...more, pp]) ? 'keep' : !noFreeRide(level, pp, [...standing, ...out, ...more], s.cache) ? 'ride' : null;
    if (opts.centre?.length) {
      const hazards = pool.filter((r) => (r.role ?? 'hazard') === 'hazard');
      for (const pp of placeCentre(rng, s, opts.centre, hazards, {
        cap: tryCap,
        uid: uidBase + first,
        key: (r) => key(r) + CENTRE_KEY,
        holds,
        log: opts.log,
      })) {
        out.push(pp);
        commit(s, pp);
      }
      // The room is the centrepiece's: the rest stand round it, so it reads as the feature, and the fight round it
      // isn't a crowd of hazards (bots used items a fifth less a minute with the rest let in).
      for (const a of opts.centre)
        for (let y = Math.max(0, a.y); y < Math.min(s.h, a.y + a.h); y++)
          for (let x = Math.max(0, a.x); x < Math.min(s.w, a.x + a.w); x++) s.taken.add(y * s.w + x);
    }
    // The rest of the ask from the whole pool, a recipe once and one that repeats twice, the centrepiece's copies counted.
    const used = (r: Recipe) => out.filter((pp) => pp.def.key === key(r) + CENTRE_KEY).length;
    const order = [...pool.filter((r) => !used(r) || (r.repeat && used(r) < 2)), ...pool.filter((r) => r.repeat && !used(r))];
    for (const recipe of order) {
      if (out.length >= want) break;
      let tries = 0;
      const log = tryLog(recipe);
      for (const cand of recipe.candidates(rng, s)) {
        if (++tries > tryCap) break;
        log.offered++;
        const { pp, why } = fits(s, cand, uidBase + first + out.length, key(recipe));
        const no = why ?? (pp ? holds(pp) : 'fit');
        if (no) refuse(log, no);
        else if (pp) {
          out.push(pp);
          commit(s, pp);
          log.placed = true;
          break;
        }
      }
      opts.log?.push(log);
    }
    return out;
  };
}

const tryLog = (r: Recipe): RecipeTry => ({ recipe: r.name, role: r.role ?? 'hazard', offered: 0, placed: false, refused: {} });
const refuse = (log: RecipeTry, why: Refusal) => (log.refused[why] = (log.refused[why] ?? 0) + 1);

/** What the centrepiece pass takes from its placer. */
interface CentreCtx {
  cap: number;
  /** The first centrepiece's uid; a twin takes the next. */
  uid: number;
  key: (r: Recipe) => string;
  holds: (pp: PlacedProp, more?: readonly PlacedProp[]) => Refusal | null;
  log?: RecipeTry[];
  /** False for a probe: `finalize` skips its reach check of what a piece's static solids cut, a proof the probe leaves to the placer. */
  path?: false;
}

/**
 * The level's centrepiece (docs/MODES.md → Brawl): the first of the set's hazards, in the placer's own order, that
 * stands in `rooms` centred on the middle, or as a pair mirrored across it, and reaches `CENTRE_REACH` places to stand.
 * A twin is the recipe's own spot round the mirror of where the first went, fenced off for it, from the same stream,
 * so it rolls the same size. Failing every recipe, the first off-centre one that reaches as far alone. Each recipe
 * finds its own spots, as it does anywhere: the room only fences off the rest of the level.
 */
function placeCentre(rng: Rng, s: Site, rooms: readonly TileRect[], hazards: readonly Recipe[], c: CentreCtx): PlacedProp[] {
  const room = fenced(s, inRects(rooms));
  const centred = (pp: PlacedProp) => centredIn(s, pp);
  let fallback: { pp: PlacedProp; log: RecipeTry } | null = null;
  for (const r of hazards) {
    const stream = rng.int(0, 0x7fffffff);
    const log: RecipeTry = { ...tryLog(r), centre: true };
    c.log?.push(log);
    const off: PlacedProp[] = [];
    let got: PlacedProp[] = [];
    let tries = 0;
    for (const cand of r.candidates(new Rng(stream), room)) {
      if (++tries > c.cap) break;
      log.offered++;
      const { pp, why } = fits(room, cand, c.uid, c.key(r), c.path);
      const reach = pp && !why ? reachOf(room, [pp]) : 0;
      const no = why ?? (!pp ? 'fit' : reach < CENTRE_REACH / (centred(pp) ? 1 : 2) ? 'reach' : centred(pp) ? c.holds(pp) : null);
      if (no) refuse(log, no);
      else if (pp && !centred(pp)) off.push(pp);
      else if (pp) {
        got = [pp];
        break;
      }
    }
    // A pair: the recipe's own spot where the mirror of an off-centre one falls.
    for (const one of got.length ? [] : off.slice(0, MIRROR_TRIES)) {
      const [x0, y0] = centroid(one);
      const cells = one.def.footprint.map(([fx, fy]) => [s.w - 1 - (fx + one.tx), fy + one.ty] as const);
      const twin = fenced(s, (x, y) => cells.some(([cx, cy]) => Math.abs(cx - x) <= TWIN_SLACK && Math.abs(cy - y) <= TWIN_SLACK));
      commit(twin, one);
      let n = 0;
      for (const cand of r.candidates(new Rng(stream), twin)) {
        if (++n > c.cap) break;
        log.offered++;
        const { pp, why } = fits(twin, cand, c.uid + 1, c.key(r), c.path);
        if (why || !pp) {
          refuse(log, why ?? 'fit');
          continue;
        }
        const [x1, y1] = centroid(pp);
        if (Math.abs(x1 - (s.w - x0)) > CENTRED || Math.abs(y1 - y0) > CENTRED) continue;
        const no = reachOf(room, [one, pp]) < CENTRE_REACH ? 'reach' : (c.holds(one) ?? c.holds(pp, [one]));
        if (no) refuse(log, no);
        else {
          got = [one, pp];
          break;
        }
      }
      if (got.length) break;
    }
    if (got.length) {
      log.placed = true;
      return got;
    }
    if (!fallback)
      for (const pp of off)
        if (reachOf(room, [pp]) >= CENTRE_REACH && !c.holds(pp)) {
          fallback = { pp, log };
          break;
        }
  }
  if (fallback) fallback.log.placed = true;
  return fallback ? [fallback.pp] : [];
}
