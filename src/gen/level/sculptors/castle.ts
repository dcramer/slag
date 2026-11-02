import type { Rng } from '../../../core/rng';
import { finish, Grid } from '../kit';
import type { SculptCtx, Sculptor } from '../types';
import {
  type Claim,
  claimSite,
  easyGap,
  easyRise,
  flatten,
  hardGap,
  keepClear,
  type Knobs,
  knobs,
  pit,
  raiseLandmark,
  rollChallenges,
  Slots,
  stepRows,
} from './common';
import { castleTall } from './tall';

type CastleStyle = 'bailey' | 'gatehouse' | 'dungeon';

interface Module {
  w: (rng: Rng) => number;
  stamp: (g: Grid, rng: Rng, x: number, w: number, fl: number) => void;
}

/**
 * Castle: crenellated stone masses on level courtyards. Towers (arched
 * passages or outside stairs, corbelled tops, arrow slits), curtain walls
 * with a stair ramp and a crenellated wall-walk, a gatehouse with turrets
 * over an arched gate, a moat (often with a collapsed bridge — the classic
 * place to need a bridge prop), and dungeon ceilings with portcullis teeth.
 */
export const castle: Sculptor = (ctx) => {
  if (ctx.profile.size === 'tall') return castleTall(ctx);
  const { rng, attempt } = ctx;
  const k = knobs(ctx);
  const { W, H } = k;
  const style = rng.weighted<CastleStyle>([
    ['bailey', 3],
    ['gatehouse', 3],
    ['dungeon', 1 + 2 * k.density],
  ]);
  const g = new Grid(W, H);
  const slots = new Slots(6, W - 7);
  const f = H - rng.int(5, 8);
  const floor = stepRows(rng, k, f, [6, 12], 0.6, 2);
  const level = (a: number, b: number, row = floor[Math.max(0, a)]) => {
    for (let x = Math.max(0, a); x <= Math.min(W - 1, b); x++) floor[x] = row;
    return row;
  };
  const claim = ctx.concept ? claimCastleSite(ctx, k, slots, floor) : null;

  // Moats: hard ones keep a collapsed bridge's stubs, easy ones are a hop.
  const challenges = rollChallenges(attempt, k);
  g.wantsProps = challenges > 0;
  // A landmark that owns the crossing digs one of them itself, in front of it.
  const own = claim?.concept.ownsCrossing && challenges > 0 ? 1 : 0;
  const moats: { a: number; b: number; hard: boolean; stubs: [number, number] }[] = [];
  for (let i = 0; i < Math.max(challenges - own, rng.int(0, 1) + Math.floor((k.wide - 1) * 2 * rng.next())); i++) {
    const hard = i < challenges - own;
    const open = hard ? hardGap(rng) : easyGap(rng, 2);
    const stubs: [number, number] = hard && rng.chance(0.7) ? [rng.int(1, 2), rng.int(1, 2)] : [0, 0];
    const w = open + stubs[0] + stubs[1];
    const a = slots.take(rng, w, 3, 8, W - 9);
    if (a === null) continue;
    if (hard) keepClear(slots, a, w);
    level(a - 2, a + w + 1, Math.max(floor[a - 2], floor[a + w + 1]));
    moats.push({ a, b: a + w - 1, hard, stubs });
  }

  // The goal often sits on a donjon at the right edge, reached by a stair.
  let goalKeep = 0;
  if (rng.chance(0.4) && slots.free(W - 13, W - 7, 2) && Math.min(...floor.slice(W - 13)) > 15) {
    goalKeep = rng.int(5, 8);
    slots.mark(W - 13, W - 7);
  }
  const placed: { m: Module; x: number; w: number }[] = [];
  const bag: Module[] = [];
  for (let r = 0; r < Math.max(1, Math.round(k.wide * (0.55 + 0.7 * k.density))); r++) bag.push(...BAGS[style](rng));
  for (const m of bag) {
    let w = m.w(rng);
    let x = slots.take(rng, w, 1);
    if (x === null) {
      w = TOWER.w(rng) - 1;
      x = slots.take(rng, w, 1);
      if (x === null) continue;
      placed.push({ m: TOWER, x, w });
    } else placed.push({ m, x, w });
    level(x - 1, x + w);
  }
  const sRow = level(0, 5);
  let gRow = level(W - 6, W - 1);
  if (goalKeep) {
    level(W - 13, W - 7, gRow);
    for (let x = 0; x < W; x++) g.fill(x, floor[x], x, H - 1);
    g.fill(W - 6, gRow - goalKeep, W - 1, gRow - 1);
    g.fill(W - 7, gRow - goalKeep, W - 7, gRow - goalKeep + 1);
    crenellate(g, W - 7, W - 7, gRow - goalKeep - 1);
    stairs(g, W - 7, goalKeep, gRow);
    gRow -= goalKeep;
  } else for (let x = 0; x < W; x++) g.fill(x, floor[x], x, H - 1);

  for (const m of moats) {
    const row = floor[m.a - 1];
    pit(g, m.a, m.b, row, m.hard);
    // Collapsed bridge: deck stubs (2 thick) with a corbel under the bank end.
    if (m.stubs[0]) g.fill(m.a, row, m.a + m.stubs[0] - 1, row + 1);
    if (m.stubs[1]) g.fill(m.b - m.stubs[1] + 1, row, m.b, row + 1);
    if (m.stubs[0]) g.set(m.a, row + 2, 1);
    if (m.stubs[1]) g.set(m.b, row + 2, 1);
  }
  for (const p of placed) p.m.stamp(g, rng, p.x, p.w, floor[p.x]);

  if (style === 'dungeon') dungeonCeiling(g, rng, floor, claim);
  else if (k.density > 0.7 && rng.chance(0.5)) dungeonCeiling(g, rng, floor, claim);
  // Last, so it stands whole over anything a neighbour's stair spilled into its box.
  if (claim) raiseLandmark(g, ctx, claim, own);

  return finish(g, { row: sRow - 1 }, { row: gRow - 1 }, `castle:${style}`);
};

/**
 * The landmark's site (claimSite) on a courtyard levelled a column or two past it, so its doors and
 * glass face open ground. Nothing else lands just right of it: a moat there could be cleared bare by a
 * jump off its roof.
 */
function claimCastleSite(ctx: SculptCtx, k: Knobs, slots: Slots, floor: number[]): Claim | null {
  const claim = claimSite(ctx, k, slots, floor);
  if (!claim) return null;
  const { x, w } = claim.at;
  slots.mark(x - 2, x + w + 5);
  flatten(floor, k.H, x - 2, x + w + 1, claim.ground);
  return claim;
}

/** Alternating merlons on row y over [a, b], both ends included. */
function crenellate(g: Grid, a: number, b: number, y: number): void {
  for (let x = a; x <= b; x += 2) g.set(x, y, 1);
  g.set(b, y, 1);
}

/**
 * Rounded archway through a mass: clear rows fl-h+1..fl-1 over [a, b] with a
 * rounded crown, leaving one-tile door sills at both ends to hop over.
 */
function arch(g: Grid, a: number, b: number, fl: number, h: number): void {
  g.clear(a, fl - h + 1, b, fl - 1);
  if (b - a >= 2) g.clear(a + 1, fl - h, b - 1, fl - h);
  g.set(a, fl - 1, 1);
  g.set(b, fl - 1, 1);
}

/** Solid stair ramp: 2-wide steps climbing toward height h at column `toX`, from the left. */
function stairs(g: Grid, toX: number, h: number, fl: number): void {
  const rise = easyRise();
  for (let i = 1; ; i++) {
    const hgt = h - rise * i;
    if (hgt <= 0) break;
    g.fill(toX - 2 * i, fl - hgt, toX - 2 * i + 1, fl - 1);
  }
}

const TOWER: Module = {
  w: (rng) => rng.int(5, 7) + 6,
  stamp: (g, rng, x0, w0, fl) => {
    const x = x0 + 6; // the six columns on the left hold an outside stair, or stay open
    const w = w0 - 6;
    const h = rng.int(8, 12);
    const top = fl - h;
    const r = x + w - 1;
    g.fill(x, top, r, fl - 1);
    // Corbelled parapet overhanging both sides, then merlons.
    g.fill(x - 1, top, r + 1, top + 1);
    g.clear(x - 1, top + 1, x - 1, top + 1);
    g.clear(r + 1, top + 1, r + 1, top + 1);
    crenellate(g, x - 1, r + 1, top - 1);
    // Arrow slits.
    const mid = x + (w >> 1);
    for (let y = top + 3; y < fl - 5; y += 4) g.clear(mid, y, mid, y + 1);
    if (rng.chance(0.6)) arch(g, x, r, fl, 4);
    else stairs(g, x - 1, h, fl);
  },
};

const WALL: Module = {
  w: (rng) => rng.int(9, 13),
  stamp: (g, rng, x, w, fl) => {
    const h = rng.int(5, 7);
    const ws = x + 4;
    const r = x + w - 1;
    g.fill(ws, fl - h, r, fl - 1);
    crenellate(g, ws, r, fl - h - 1);
    stairs(g, ws, h, fl);
    if (rng.chance(0.4) && r - ws >= 6) arch(g, ws + 2, r - 2, fl, 3); // postern gate (dead-end alcove reads as a door)
  },
};

const GATEHOUSE: Module = {
  w: (rng) => rng.pick([10, 12]),
  stamp: (g, rng, x, w, fl) => {
    const h = rng.int(7, 8);
    const r = x + w - 1;
    g.fill(x, fl - h, r, fl - 1);
    arch(g, x, r, fl, 4);
    // Turrets on both ends.
    const th = rng.int(2, 3);
    g.fill(x - 1, fl - h - th, x + 2, fl - h - 1);
    g.fill(r - 2, fl - h - th, r + 1, fl - h - 1);
    crenellate(g, x - 1, x + 2, fl - h - th - 1);
    crenellate(g, r - 2, r + 1, fl - h - th - 1);
    crenellate(g, x + 3, r - 3, fl - h - 1);
    // Murder-hole slot and banner ledge.
    g.clear(x + (w >> 1), fl - 4, x + (w >> 1), fl - 4);
    g.plank(x - 3, x - 2, fl - h + 1);
  },
};

const KEEP: Module = {
  w: (rng) => rng.int(8, 9),
  stamp: (g, rng, x, w, fl) => {
    const h = rng.int(10, 13);
    const r = x + w - 1;
    // Stepped keep: lower hall with a tall tower rising from one half.
    const hall = rng.int(5, 6);
    g.fill(x, fl - hall, r, fl - 1);
    crenellate(g, x, r, fl - hall - 1);
    const tx = rng.chance(0.5) ? x + 1 : r - 4;
    g.fill(tx, fl - h, tx + 3, fl - hall - 1);
    g.fill(tx - 1, fl - h, tx + 4, fl - h + 1);
    crenellate(g, tx - 1, tx + 4, fl - h - 1);
    arch(g, x, r, fl, 3);
    stairs(g, x, hall, fl);
  },
};

function dungeonCeiling(g: Grid, rng: Rng, floor: number[], claim: Claim | null): void {
  const W = g.w;
  const a = rng.int(6, Math.max(6, W - 32));
  const b = Math.min(W - 7, a + Math.round(rng.int(14, 24) * Math.max(1, W / 60)));
  let depth = rng.int(3, 5);
  for (let x = a; x <= b; x++) {
    if (rng.chance(0.3)) depth = Math.max(2, Math.min(7, depth + rng.pick([-1, 1])));
    // The landmark keeps its sky (and its roof), with a column of air either side.
    if (claim && x >= claim.at.x - 2 && x <= claim.at.x + claim.at.w + 1) continue;
    const lim = Math.min(depth, floor[x] - 8);
    for (let y = 0; y <= lim; y++) if (g.empty(x, y)) g.set(x, y, 1);
    // Portcullis teeth / chains.
    if (x % 3 === 0 && g.empty(x, lim + 2) && g.empty(x, lim + 3)) g.fill(x, lim + 1, x, lim + 1 + rng.int(0, 1));
  }
}

const BAGS: Record<CastleStyle, (rng: Rng) => Module[]> = {
  bailey: (rng) => [WALL, TOWER, rng.pick([TOWER, KEEP])],
  gatehouse: (rng) => [GATEHOUSE, rng.pick([TOWER, WALL])],
  dungeon: (rng) => [rng.pick([TOWER, WALL]), rng.pick([KEEP, TOWER])],
};
