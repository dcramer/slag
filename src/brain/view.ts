import type { Match, Player } from '../game/match';
import { MODES, type ModeId } from '../game/modes';
import { RACE_SHOVE } from '../sim/collide';
import { isBridgePart, type PropDef } from '../gen/props';
import { type Bridge, cacheFor, canPlaceBridge, fieldOf, prove, settled, withBridges } from '../gen/level';
import { JumpCache, levelPrecision } from '../gen/level/precision';
import { analyzeRoutes } from '../gen/level/routes';
import { type Level, spawnsOf } from '../sim/level';
import { RUN_COUNTDOWN, TILE } from '../sim/constants';
import { knockScale } from '../sim/items';
import { barrierOf, footprint, hangRow, motionOffset, mysterySpent, mysteryState, type PlacedProp, spotAt } from '../sim/props';
import type { Body } from '../sim/physics';
import { feetUp, type Runner, type RunWorld } from '../sim/run';
import { raceMap } from './route';
import { screenEdges } from '../sim/screen';
import { rankOf } from '../sim/standing';
import { BRAIN_VIEW_VERSION, type BoxSense, type BrainView, type Lift, type Objective, type Pace, type PropSense, type SelfSense } from './types';

/**
 * What a seat senses: the match as a player would read it, never the sim's
 * own objects. Positions are rounded, speeds are words, and parts are what
 * they do to a route (barrierOf), not their names.
 */

/** Quarter tiles: close enough to play by, too coarse to play frame-perfect off. */
const round4 = (v: number) => Math.round(v * 4) / 4;

/** Parts as senses, kept while nothing is placed or blown up: building them reads every part's barrier. */
const propCache = new WeakMap<Match, { key: unknown[]; props: PropSense[] }>();

function propsOf(m: Match): PropSense[] {
  const key = [m.level, m.level.setPieces, m.placed, m.placed.length];
  const hit = propCache.get(m);
  if (hit && hit.key.every((k, i) => k === key[i])) return hit.props;
  const props = [...m.level.setPieces, ...m.placed].map((pp) => {
    const b = barrierOf(m.level, pp);
    return { owner: pp.owner, ground: b.ground, noGo: b.noGo };
  });
  propCache.set(m, { key, props });
  return props;
}

function pace(b: Body): Pace {
  const v = Math.abs(b.vx);
  if (!b.onGround) return v < 20 ? 'still' : 'flying';
  return v < 20 ? 'still' : v <= 120 ? 'walking' : 'running';
}

function lift(b: Body): Lift {
  if (b.onGround || Math.abs(b.vy) < 30) return 'level';
  return b.vy < 0 ? 'rising' : b.vy < 400 ? 'falling' : 'plunging';
}

/**
 * What each mode's race is for, as a bot sees it. A new mode fails typecheck here until it says, and its strategy
 * (strategies/) reads it.
 */
const OBJECTIVES: Record<ModeId, (m: Match) => Objective> = {
  race: (m) => ({ kind: 'reach', cell: { ...m.level.goal } }),
  slag: (m) => ({ kind: 'climb', lapLine: { ...m.level.goal }, loop: m.level.loop ?? 0 }),
  brawl: (m) => ({
    kind: 'fight',
    cell: { tx: Math.round((m.level.spawn.tx + m.level.goal.tx) / 2), ty: m.level.spawn.ty },
    ends: spawnsOf(m.level).map((c) => ({ ...c })),
  }),
};

/** Rows `r`'s feet stand above the spawn's floor, laps and all. */
const upOf = (run: RunWorld, r: Runner) => round4(((run.level.spawn.ty + 1) * TILE - feetUp(run.level, r)) / TILE);

/** The mystery boxes standing in the race, where they stand now. */
function boxesOf(run: RunWorld): BoxSense[] {
  const out: BoxSense[] = [];
  for (const rp of run.resolved)
    rp.mods.forEach((mod, mi) => {
      if (mod.type !== 'mystery') return;
      const st = mysteryState(run.propState.get(rp.pp.uid), mi);
      const ready = !mysterySpent(mod, st.pops) && run.frame >= st.ready;
      const [ox, oy] = motionOffset(rp, run.frame);
      for (const [cx, cy] of mod.cells) out.push({ tx: Math.round(cx + ox / TILE), ty: Math.round(cy + oy / TILE), ready, hands: !!mod.deal });
    });
  return out;
}

/** The cursor point (world px) Match.ghostOrigin turns back into origin (tx, ty) for `def` turned `rot`: where to aim to put it there. */
export function aimPoint(def: PropDef, rot: number, tx: number, ty: number): { x: number; y: number } {
  let w = 0;
  let h = 0;
  for (const [x, y] of footprint(def, rot)) {
    w = Math.max(w, x + 1);
    h = Math.max(h, y + 1);
  }
  return { x: (tx + (w - 1) / 2 + 0.5) * TILE, y: (ty + (h - 1) / 2 + 0.5) * TILE };
}

/**
 * Whether a cursor can aim the held part at (tx, ty): the cursor stops at the level's edges, so a spot whose aim
 * point lies past one (a part hanging half off the bottom row, its legal cells trimmed) is legal but out of reach,
 * and a bot steering for it would press the arrow against the edge forever.
 */
function aimable(m: Match, def: PropDef, rot: number, tx: number, ty: number): boolean {
  const { x, y } = aimPoint(def, rot, tx, ty);
  return x >= 0 && y >= 0 && x <= m.level.w * TILE - 1 && y <= m.level.h * TILE - 1;
}

/** Where the held part lands with the cursor aimed at (tx, y): what Match.ghostOrigin decides, for any turn. */
export function ghostAt(m: Match, def: PropDef, rot: number, tx: number, y: number) {
  const ty = def.mount === 'hang' ? hangRow(m.level, m.placed, def, tx, y, m.frame) : y;
  return { ...spotAt(m.level, m.placed, def, rot, tx, ty, m.frame), tx, ty };
}

/** Each level's jumps as measured, shared by every bot weighing spots on it: a spot only re-measures the jumps near it. */
const jumpCaches = new WeakMap<Level, JumpCache>();

/** How hard the run is over `placed`: tight jumps on the forgiving way and its length, or null when no plan gets through. */
function hardness(level: Level, placed: readonly PlacedProp[], prior: readonly Bridge[]) {
  let jumps = jumpCaches.get(level);
  if (!jumps) jumpCaches.set(level, (jumps = new JumpCache(level)));
  const s = settled(level, placed);
  const field = fieldOf(s.level, s.placed);
  // The level's own cache: each spot weighed differs from the last by a few cells, so only those get traced again.
  const cache = cacheFor(field);
  // Only the plan everyone is already building counts: searching for another can take a frame's whole budget many times over.
  if (!prior.every((b) => canPlaceBridge(field, b)) || !cache.analyze(withBridges(field, prior)).goalReached) return null;
  const routes = analyzeRoutes(field, prior, cache);
  const tight = levelPrecision(field, routes, prior, jumps);
  return { routes, tight, length: routes.length };
}

/** The route as the parts stand, kept while nothing is placed. */
type Route = ReturnType<BrainView['route']>;
const routeCache = new WeakMap<Match, { key: unknown[]; route: Route }>();

function routeOf(m: Match): Route {
  const key = [m.level, m.placed, m.placed.length];
  const hit = routeCache.get(m);
  if (hit && hit.key.every((k, i) => k === key[i])) return hit.route;
  const h = hardness(m.level, m.placed, m.plan);
  const route = h ? { cells: [...new Set([...h.routes.fastest, ...h.routes.alternative])], tight: h.tight, length: h.length } : NO_ROUTE;
  routeCache.set(m, { key, route });
  return route;
}

const NO_ROUTE: Route = { cells: [], tight: 0, length: 0 };

/** The plan everyone is building (or what's left of it) still gets through with `pp` standing too. */
function keepsWay(m: Match, pp: PlacedProp): boolean {
  if (pp.def.modules.some((x) => x.type === 'bomb' && !x.delay)) return true; // a blast only takes away
  const s = settled(m.level, [...m.placed, pp]);
  // Never searches for another plan: that runs dozens of analyses, and a bot asks this of many spots in a row.
  return prove(s.level, s.placed, m.plan, false) !== null;
}

function selfOf(m: Match, p: Player): SelfSense | null {
  const run = m.run;
  const r = m.phase === 'run' ? run?.runners.find((x) => x.slot === p.slot) : undefined;
  if (!run || !r) return null;
  const b = r.body;
  const it = r.items;
  const tx = Math.floor((b.x + b.w / 2) / TILE);
  const ty = Math.floor((b.y + b.h - 1) / TILE);
  const map = raceMap(run);
  const w = map.field.w;
  const inside = tx >= 0 && tx < w && ty >= 0 && ty < map.field.h;
  const goal = m.level.goal.ty * w + m.level.goal.tx;
  const d = inside ? map.dist(goal)[ty * w + tx] : Infinity;
  const rough = inside ? map.rough(goal)[ty * w + tx] : Infinity;
  return {
    x: round4((b.x + b.w / 2) / TILE),
    y: round4((b.y + b.h) / TILE),
    tx,
    ty,
    pace: pace(b),
    lift: lift(b),
    facing: b.facing,
    grounded: b.onGround,
    wall: b.wallDir,
    alive: r.alive,
    finished: r.finished,
    togo: Number.isFinite(d) ? Math.round(d / 10) : Infinity,
    away: Number.isFinite(rough) ? Math.round(rough / 10) : Infinity,
    up: upOf(run, r),
    slag: run.slag === null ? null : round4((run.slag - feetUp(run.level, r)) / TILE),
    screen: run.screen === null ? null : round4((screenEdges(run.rules.screen!, run.screen).bottom - feetUp(run.level, r)) / TILE),
    rank: rankOf(run, r),
    held: it.held ? { ...it.held } : null,
    shielded: run.isSafe(r),
    armed: !!it.held && it.cooldown === 0 && it.swing === 0 && it.windup === 0 && it.cast === 0 && it.daze === 0 && it.thrust === 0,
    hurt: Math.round(knockScale(run, r) * 10) / 10,
  };
}

/** Tiles of route a stop at (tx, ty) adds to `p`'s way to the goal, rounded; Infinity where no route leads through it. */
function detourOf(m: Match, p: Player, tx: number, ty: number): number {
  const run = m.phase === 'run' ? m.run : null;
  const r = run?.runners.find((x) => x.slot === p.slot);
  if (!run || !r) return Infinity;
  const map = raceMap(run);
  const w = map.field.w;
  const b = r.body;
  const hx = Math.floor((b.x + b.w / 2) / TILE);
  const hy = Math.floor((b.y + b.h - 1) / TILE);
  if (hx < 0 || hx >= w || hy < 0 || hy >= map.field.h || tx < 0 || tx >= w || ty < 0 || ty >= map.field.h) return Infinity;
  const here = hy * w + hx;
  const at = ty * w + tx;
  const goal = m.level.goal.ty * w + m.level.goal.tx;
  const there = map.dist(at)[here] + map.dist(goal)[at];
  if (!Number.isFinite(there)) return Infinity;
  const now = map.dist(goal)[here];
  return Math.max(0, Math.round((there - (Number.isFinite(now) ? now : map.rough(goal)[here])) / 10));
}

/** The view for seat `p` of `m` this frame. */
export function senseView(m: Match, p: Player): BrainView {
  const run = m.phase === 'run' ? m.run : null;
  const held = p.claim >= 0 ? m.crate[p.claim]?.def : undefined;
  return {
    version: BRAIN_VIEW_VERSION,
    phase: m.phase,
    mode: m.rules.mode,
    shove: MODES[m.rules.mode].run.shove ?? RACE_SHOVE,
    phaseFrame: m.phaseFrame,
    slot: p.slot,
    ready: p.ready,
    score: p.score,
    level: {
      w: m.level.w,
      h: m.level.h,
      tiles: m.level.tiles,
      spawn: { ...m.level.spawn },
      plan: m.plan.map((b) => ({ tx: b.x, ty: b.y })),
    },
    props: m.phase === 'lobby' ? [] : propsOf(m),
    crate: m.crate.map((c) => ({
      claimed: c.claimedBy >= 0,
      by: c.claimedBy,
      role: c.secret ?? c.def.role,
      bridge: !c.secret && isBridgePart(c.def),
      clears: !!c.clears,
    })),
    objective: OBJECTIVES[m.rules.mode](m),
    boxes: run ? boxesOf(run) : [],
    drops: run ? run.items.drops.map((d) => ({ x: round4(d.x / TILE), y: round4(d.y / TILE), kind: d.kind })) : [],
    detour: (tx, ty) => detourOf(m, p, tx, ty),
    claim: p.claim,
    placed: p.placed,
    self: selfOf(m, p),
    runners: run
      ? run.runners
          .filter((r) => r.slot !== p.slot)
          .map((r) => ({
            slot: r.slot,
            x: round4((r.body.x + r.body.w / 2) / TILE),
            y: round4((r.body.y + r.body.h) / TILE),
            up: upOf(run, r),
            grounded: r.body.onGround,
            alive: r.alive,
            finished: r.finished,
            held: r.items.held?.kind ?? null,
            hurt: Math.round(knockScale(run, r) * 10) / 10,
            shielded: run.isSafe(r),
          }))
      : [],
    rivals: m.players
      .filter((q) => q.slot !== p.slot)
      .map((q) => ({
        slot: q.slot,
        score: q.score,
        hover: m.phase === 'pick' && q.claim < 0 ? m.crateItemAt(q.cursor.x, q.cursor.y) : -1,
        cursor: m.phase === 'place' && !q.placed ? { x: round4(q.cursor.x / TILE), y: round4(q.cursor.y / TILE) } : null,
      })),
    kills: (m.phase === 'run' || m.phase === 'score') && m.run ? m.run.kills.map((k) => ({ ...k })) : [],
    live: !!run && run.frame >= RUN_COUNTDOWN,
    canPlace: (tx, ty, rot) => !!held && m.phase === 'place' && aimable(m, held, rot, tx, ty) && ghostAt(m, held, rot, tx, ty).ok,
    route: () => (m.phase === 'place' ? routeOf(m) : NO_ROUTE),
    assess: (tx, ty, rot) => {
      if (!held || m.phase !== 'place') return null;
      const g = ghostAt(m, held, rot, tx, ty);
      if (!g.ok) return null;
      const pp: PlacedProp = { uid: -1, def: g.def, owner: p.slot, tx: g.tx, ty: g.ty, rot, ...(g.ride && { ride: g.ride }) };
      const h = hardness(m.level, [...m.placed, pp], m.plan);
      return h && { tight: h.tight, length: h.length };
    },
    keepsWay: (tx, ty, rot) => {
      if (!held || m.phase !== 'place') return false;
      const g = ghostAt(m, held, rot, tx, ty);
      return g.ok && keepsWay(m, { uid: -1, def: g.def, owner: p.slot, tx: g.tx, ty: g.ty, rot, ...(g.ride && { ride: g.ride }) });
    },
  };
}
