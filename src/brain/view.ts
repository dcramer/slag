import type { Match, Player } from '../game/match';
import { isBridgePart, type PropDef } from '../gen/props';
import { prove, settled } from '../gen/level';
import { RUN_COUNTDOWN, TILE } from '../sim/constants';
import { barrierOf, hangRow, type PlacedProp, spotAt } from '../sim/props';
import type { Body } from '../sim/physics';
import { raceMap } from './route';
import { BRAIN_VIEW_VERSION, type BrainView, type Lift, type Pace, type PropSense, type SelfSense } from './types';

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

/** Where the held part lands with the cursor aimed at (tx, y): what Match.ghostOrigin decides, for any turn. */
export function ghostAt(m: Match, def: PropDef, rot: number, tx: number, y: number) {
  const ty = def.mount === 'hang' ? hangRow(m.level, m.placed, def, tx, y, m.frame) : y;
  return { ...spotAt(m.level, m.placed, def, rot, tx, ty, m.frame), tx, ty };
}

/** The level still has a plan (at most its bridges) with `pp` standing too. */
function keepsWay(m: Match, pp: PlacedProp): boolean {
  if (pp.def.modules.some((x) => x.type === 'bomb' && !x.delay)) return true; // a blast only takes away
  const s = settled(m.level, [...m.placed, pp]);
  return prove(s.level, s.placed, m.plan) !== null;
}

function selfOf(m: Match, p: Player): SelfSense | null {
  const run = m.run;
  const r = m.phase === 'run' ? run?.runners.find((x) => x.slot === p.slot) : undefined;
  if (!run || !r) return null;
  const b = r.body;
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
  };
}

/** The view for seat `p` of `m` this frame. */
export function senseView(m: Match, p: Player): BrainView {
  const run = m.phase === 'run' ? m.run : null;
  const held = p.claim >= 0 ? m.crate[p.claim]?.def : undefined;
  return {
    version: BRAIN_VIEW_VERSION,
    phase: m.phase,
    phaseFrame: m.phaseFrame,
    slot: p.slot,
    ready: p.ready,
    level: {
      w: m.level.w,
      h: m.level.h,
      tiles: m.level.tiles,
      spawn: { ...m.level.spawn },
      goal: { ...m.level.goal },
      plan: m.plan.map((b) => ({ tx: b.x, ty: b.y })),
    },
    props: m.phase === 'lobby' ? [] : propsOf(m),
    crate: m.crate.map((c) => ({
      claimed: c.claimedBy >= 0,
      role: c.secret ?? c.def.role,
      bridge: !c.secret && isBridgePart(c.def),
      clears: !!c.clears,
    })),
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
            alive: r.alive,
            finished: r.finished,
          }))
      : [],
    live: !!run && run.frame >= RUN_COUNTDOWN,
    canPlace: (tx, ty, rot) => !!held && m.phase === 'place' && ghostAt(m, held, rot, tx, ty).ok,
    keepsWay: (tx, ty, rot) => {
      if (!held || m.phase !== 'place') return false;
      const g = ghostAt(m, held, rot, tx, ty);
      return g.ok && keepsWay(m, { uid: -1, def: g.def, owner: p.slot, tx: g.tx, ty: g.ty, rot, ...(g.ride && { ride: g.ride }) });
    },
  };
}
