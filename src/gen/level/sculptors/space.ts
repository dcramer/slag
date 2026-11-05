import type { Rng } from '../../../core/rng';
import { deckOf, SPACE_DOCK, SPACE_UNDER, spaceAsksTwo, spaceOwns } from '../../stage/space';
import { finish, Grid, hintGap } from '../kit';
import { jumpProfile } from '../probe';
import { spaceTall } from './tall';
import type { SculptCtx, Sculptor, Shape } from '../types';
import { easyRise, hardGap, type Knobs, knobs, raiseLandmark, rollChallenges } from './common';

type SpaceStyle = 'asteroids' | 'station';

/** Narrowest dock: the spawn or goal pocket plus the lipped column at its void end. */
const DOCK = SPACE_DOCK;
/** Narrowest bank of a hard crossing: enough to run at the bridge from (reach.ts runs from 4). */
const BANK = 5;

/**
 * The easy voids between bodies, in columns: the long end of a walking hop
 * at this level's gravity, so space under its own low gravity spreads out
 * and a host's Normal or High packs it back in. Denser fields reach a little
 * further down for the short end.
 */
export function spaceHop(density: number): { lo: number; hi: number } {
  const hi = jumpProfile().walkGap;
  return { lo: Math.max(2, Math.min(hi, Math.ceil(hi * (0.8 - 0.3 * density)))), hi: Math.max(2, hi) };
}

/**
 * Space: nothing underfoot but what floats. There is no ground and no pit
 * floor: fall off and you're gone. Docks hold the spawn and the goal, and in
 * between is a chain of bodies over the void:
 *
 *   asteroids  lumpy rocks with flat tops and tapered, lipped undersides, and
 *              pebbles floating a jump above them as a second lane
 *   station    hull modules joined by nothing, with antenna masts and one-way
 *              solar wings on top and docking clamps underneath
 *
 * The look picks the style (hull plating builds a station, regolith an
 * asteroid field), so what you see is what was sculpted. Gravity is low
 * (gen/level/profile.ts SPACE_GRAVITY) and every gap is sized from jumps
 * measured at it, so the voids are wide: one a jump can't clear takes a
 * third of a classic level, and the rest are the long end of a walking hop
 * between small bodies (spaceHop, chain), so the field reads as open void.
 * So a classic level asks for one part, and a wide
 * one asks for two more often than other themes do (TWO_PART_ASK.space), which
 * keeps the theme's share of two-part levels where the rest are. A void two
 * bridges wide doesn't work here: at this gravity a long fall onto one low
 * bridge and a jump back up crosses it.
 */
export const space: Sculptor = (ctx) => {
  // Only Rising Slag asks this set for a tower (its races never go tall): its shaft is the tall builder's (./tall.ts).
  if (ctx.profile.size === 'tall') return spaceTall(ctx);
  if (ctx.concept) return spaceStage(ctx);
  const { rng, attempt } = ctx;
  const style: SpaceStyle = ctx.theme?.terrain?.kind === 'hull' ? 'station' : 'asteroids';
  const k = knobs(ctx);
  const { W, H } = k;
  const g = new Grid(W, H);
  const asked = rollChallenges(attempt, k);
  const challenges = asked && W < 64 ? 1 : asked;
  g.wantsProps = challenges > 0;
  const base = H - rng.int(7, 10);

  const hop = spaceHop(k.density);
  const { widths, gaps, hard } = chain(rng, W, hop, challenges, style === 'station' ? [4, 8] : [3, 7]);
  const used = widths.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
  const dockL = Math.max(DOCK, Math.min(W - used - DOCK, Math.floor((W - used) * rng.range(0.4, 0.6))));
  const dockR = W - used - dockL;
  const sTop = Math.max(8, Math.min(H - 7, base + k.ramp(0)));
  const gTop = Math.max(8, Math.min(H - 7, base + k.ramp(W - 1) + rng.int(-2, 1)));
  if (dockR < DOCK) return finish(g, { row: sTop - 1, depth: 2 }, { row: gTop - 1, depth: 2 }, `space:broken`);

  dock(g, 0, dockL - 1, sTop);
  dock(g, W - dockR, W - 1, gTop);
  let x = dockL;
  let prev = sTop;
  const tops: { x: number; w: number; top: number }[] = [];
  for (let i = 0; i < widths.length; i++) {
    const x0 = x + gaps[i];
    const w = widths[i];
    let top = Math.max(8, Math.min(H - 7, base + k.ramp(x0 + (w >> 1)) + rng.int(-2, 2)));
    top = Math.max(prev - 3, Math.min(prev + 4, top));
    if (hard[i]) hintGap(g, x, x0 - 1, Math.max(prev, top));
    if (style === 'station') module(g, rng, x0, w, top);
    else asteroid(g, rng, x0, w, top, hard[i]);
    tops.push({ x: x0, w, top });
    prev = top;
    x = x0 + w;
  }
  if (hard[widths.length]) hintGap(g, x, W - dockR - 1, Math.max(prev, gTop));
  // Far banks of hard crossings are lipped (asteroids taper, docks and modules overhang their clamps), so
  // nobody wall-climbs out of the void. Above the chain, a second lane a plain jump up, off the crossings.
  const row = (c: number) => {
    if (c < dockL) return sTop;
    if (c >= W - dockR) return gTop;
    const on = tops.find((t) => c >= t.x - 1 && c <= t.x + t.w);
    if (on) return on.top;
    // Tops run left to right: the body after `c` is the first one past it, and the one before is just ahead of that.
    const next = tops.findIndex((t) => t.x > c);
    const before = next < 0 ? tops[tops.length - 1] : tops[next - 1];
    return Math.max(before?.top ?? sTop, next < 0 ? gTop : tops[next].top);
  };
  upperLane(g, rng, row, dockL - 3, W - dockR + 2, style === 'station', hop);

  return finish(g, { row: sTop - 1, depth: 2 }, { row: gTop - 1, depth: 2 }, `space:${style}`);
};

/** The bodies between the docks, left to right, and the voids before, between and after them. */
export interface Chain {
  widths: number[];
  /** One more than widths: gaps[i] is the void before body i, the last one the void before the goal dock. */
  gaps: number[];
  /** Which voids are hard crossings (hardGap: no jump clears them). */
  hard: boolean[];
}

/**
 * Lay out a chain that spans `W` columns with its docks: small bodies and
 * wide voids, as many bodies as fit with every easy void at least `hop.lo`,
 * so lower gravity spreads them further apart. Spare columns open the easy
 * voids up to a full hop before the docks get them.
 */
export function chain(rng: Rng, W: number, hop: { lo: number; hi: number }, challenges: number, body: [number, number]): Chain {
  const widthOf = () => rng.int(body[0], body[1]);
  const hardGaps = Array.from({ length: challenges }, () => hardGap(rng));
  const widths: number[] = [widthOf()];
  const plan = (n: number) => n + hardGaps.reduce((a, b) => a + b, 0) + Math.max(0, widths.length + 2 - challenges) * hop.lo + 2 * DOCK;
  const fits = (w: number) => plan(widths.reduce((a, b) => a + b, 0) + w) <= W;
  // The last body that fits is a small one rather than none, so spare room is void, not a wider dock.
  for (let next = widthOf(); fits(next) || fits(body[0]); next = widthOf()) widths.push(fits(next) ? next : body[0]);

  const nGaps = widths.length + 1;
  const hardIdx = new Set<number>();
  while (hardIdx.size < Math.min(challenges, nGaps)) hardIdx.add(rng.int(0, nGaps - 1));
  const hard = Array.from({ length: nGaps }, (_, i) => hardIdx.has(i));
  const bank = (i: number) => hard[i] || hard[i + 1];
  // A hard crossing's banks are long enough to run at the bridge from.
  widths.forEach((w, i) => (widths[i] = bank(i) ? Math.max(w, BANK) : w));
  // Easy voids stay a walking hop: a run-up's worth would leave no room for anything else.
  let nextHard = 0;
  const gaps = hard.map((h) => (h ? hardGaps[nextHard++] : rng.int(hop.lo, hop.hi)));
  const minHard = jumpProfile().gap + 2;
  const total = () => widths.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0) + 2 * DOCK;
  for (let i = 0; total() < W && gaps.some((gp, n) => !hard[n] && gp < hop.hi); i = (i + 1) % nGaps) if (!hard[i] && gaps[i] < hop.hi) gaps[i]++;
  while (total() > W) {
    const easy = gaps.findIndex((gp, i) => !hard[i] && gp > hop.lo);
    const wide = gaps.findIndex((gp, i) => hard[i] && gp > minHard);
    const fat = widths.findIndex((w, i) => w > (bank(i) ? BANK : body[0]));
    if (easy >= 0) gaps[easy]--;
    else if (wide >= 0) gaps[wide]--;
    else if (fat >= 0) widths[fat]--;
    else if (widths.length > 1) {
      // Drop the last body and one of the voids beside it, keeping a hard one.
      const at = widths.length - 1;
      const drop = hard[at] && !hard[at + 1] ? at + 1 : at;
      widths.pop();
      gaps.splice(drop, 1);
      hard.splice(drop, 1);
    } else break;
  }
  return { widths, gaps, hard };
}

/** A dock: a slab three thick with a lip at the void end, so its face can't be climbed. */
function dock(g: Grid, x0: number, x1: number, top: number): void {
  g.fill(x0, top, x1, top + 2);
  const edge = x0 === 0 ? x1 : x0;
  g.clear(edge, top + 1, edge, top + 2);
  g.fill(Math.min(x0, x1) + 2, top + 3, Math.max(x0, x1) - 2, top + 3);
}

/** An asteroid: a flat top on row `t`, tapering underneath from a lip, with a boulder or two on top. */
function asteroid(g: Grid, rng: Rng, x: number, w: number, t: number, farBank: boolean): void {
  g.fill(x, t, x + w - 1, t);
  // Underneath, a rounded body that hangs below the top: never wider than the row above, so every side is a lip.
  // No deeper than half its width, so a pebble of a rock stays a wedge instead of a nail.
  const depth = rng.int(2, Math.max(2, Math.min(6, (w + 1) >> 1)));
  const mid = x + (w - 1) / 2 + rng.range(-1, 1);
  let a = x + (farBank ? 2 : 1);
  let b = x + w - 2;
  for (let i = 1; i <= depth; i++) {
    const u = i / (depth + 1);
    const half = (w / 2) * Math.sqrt(1 - u * u) - 0.4 + rng.range(-0.6, 0.6);
    a = Math.max(a, Math.round(mid - half));
    b = Math.min(b, Math.round(mid + half));
    if (a > b) break;
    g.fill(a, t + i, b, t + i);
  }
  // A hump or a boulder on top, away from the edges.
  if (w >= 7 && rng.chance(0.55)) {
    const hw = rng.int(1, Math.min(3, w - 5));
    const hx = rng.int(x + 2, x + w - 2 - hw);
    g.fill(hx, t - 1, hx + hw - 1, t - 1);
  }
}

/** A hull module: a slab with a clamp underneath, and an antenna mast or a one-way solar wing on top. */
function module(g: Grid, rng: Rng, x: number, w: number, t: number): void {
  const h = rng.int(2, 3);
  g.fill(x, t, x + w - 1, t + h - 1);
  // Clamp under the middle: the overhang either side keeps the faces from being climbed out of the void.
  const c = x + (w >> 1) - 1;
  g.fill(c, t + h, c + 1, t + h + 1);
  g.clear(x, t + 1, x, t + h - 1);
  const roll = rng.next();
  if (roll < 0.4 && w >= 7) {
    const m = rng.int(x + 2, x + w - 3);
    g.fill(m, t - rng.int(1, 2), m, t - 1);
  } else if (roll < 0.75 && w >= 6) {
    const y = t - easyRise();
    if (y > 3) g.plank(x + 1, x + w - 2, y);
  }
}

/**
 * A second lane a plain jump above the chain, from dock to dock: pebbles in a field, one-way gantries on a
 * station, a hop apart (a little short of the voids below, since they sit at different heights). It breaks off over every hard crossing (anything there would be a way across), so
 * the route splits and rejoins instead of needing lanes laid over it later.
 */
function upperLane(g: Grid, rng: Rng, row: (x: number) => number, from: number, to: number, station: boolean, hop: { lo: number; hi: number }): void {
  const rise = easyRise();
  const off = (x: number) => g.crossings.some(([a, b]) => x >= a - 5 && x <= b + 5);
  for (let x = Math.max(1, from); x < Math.min(g.w - 2, to);) {
    const w = station ? rng.int(3, 5) : rng.int(2, 4);
    const y = row(x + (w >> 1)) - rise + rng.int(-1, 0);
    let clear = y >= 4 && !off(x) && !off(x + w - 1);
    for (let yy = y - 3; yy <= y + 2 && clear; yy++) for (let xx = x - 1; xx <= x + w; xx++) if (!g.empty(xx, yy)) clear = false;
    if (clear) {
      if (station) g.plank(x, x + w - 1, y);
      else {
        g.fill(x, y, x + w - 1, y);
        if (w >= 3) g.set(x + rng.int(1, w - 2), y + 1, 1);
      }
    }
    x += w + rng.int(Math.max(2, hop.lo - 1), Math.max(2, hop.hi - 1));
  }
}

/**
 * A space level built round a stage concept's landmark (gen/stage/space.ts): the spawn dock, a chain of
 * bodies where there's room, the landmark (its own void in front, its gangway, the structure), a chain on
 * to the goal dock. The landmark owns the level's crossing, or both where a wide level made room for a
 * two-part one; a crossing it doesn't own goes in the longer chain. Plain space levels never come here, so
 * they're generated exactly as before.
 */
function spaceStage(ctx: SculptCtx): Shape {
  const { rng, attempt } = ctx;
  const concept = ctx.concept!;
  const style: SpaceStyle = ctx.theme?.terrain?.kind === 'hull' ? 'station' : 'asteroids';
  const k = knobs(ctx);
  const { W, H } = k;
  const g = new Grid(W, H);
  const asked = rollChallenges(attempt, k);
  const challenges = asked > 1 && !spaceAsksTwo(k) ? 1 : asked;
  g.wantsProps = challenges > 0;
  const hop = spaceHop(k.density);
  const { w, h } = concept.box(k, rng);
  const lo = SPACE_DOCK;
  const hi = W - SPACE_DOCK - w;
  const deck = Math.min(H - SPACE_UNDER - 1, Math.max(h - SPACE_UNDER + 1, H - SPACE_UNDER - rng.int(1, 3)));
  const at = { x: hi >= lo ? rng.int(lo, hi) : lo, y: deck + SPACE_UNDER - h, w, h };
  if (hi < lo || at.y < 1) return finish(g, { row: deck - 1, depth: 2 }, { row: deck - 1, depth: 2 }, 'space:unclaimed');
  const own = spaceOwns(concept, k, attempt, challenges);
  const lm = raiseLandmark(g, ctx, { concept, at, ground: deck }, own);
  const D = deckOf(at);
  const [ex, eRow] = lm.anchors.exit;
  // A crossing the landmark doesn't own goes in the longer of the two chains, where one fits.
  const left = at.x;
  const right = W - ex;
  const spare = challenges - own;
  const fitsHard = (cols: number) => cols >= 2 * DOCK + hardGap(rng) + 2;
  const hardL = spare > 0 && left >= right && fitsHard(left) ? spare : 0;
  const hardR = spare > 0 && !hardL && fitsHard(right) ? spare : 0;
  const sTop = left >= 2 * DOCK + 3 + 2 * hop.lo ? clampRow(k, D + rng.int(-2, 2)) : D;
  const gTop = right >= 2 * DOCK + 3 + 2 * hop.lo ? clampRow(k, eRow + rng.int(-2, 2)) : eRow;
  const ok = stretch(g, rng, k, 0, left - 1, sTop, D, hardL, hop, style) && stretch(g, rng, k, ex, W - 1, eRow, gTop, hardR, hop, style);
  if (!ok) g.landmark = undefined;
  return finish(g, { row: sTop - 1, depth: 2 }, { row: gTop - 1, depth: 2 }, `space:${concept.id}`);
}

const clampRow = (k: Knobs, row: number) => Math.max(8, Math.min(k.H - 7, row));

/**
 * Bodies from column `xa` (its top on row `rowA`) to `xb` (on `rowB`): one dock where there's no room for
 * more, else a dock at each end and a chain between them, with `hard` crossings among its voids and a
 * second lane over it. False when the chain can't be laid out.
 */
function stretch(
  g: Grid,
  rng: Rng,
  k: Knobs,
  xa: number,
  xb: number,
  rowA: number,
  rowB: number,
  hard: number,
  hop: { lo: number; hi: number },
  style: SpaceStyle,
): boolean {
  const W2 = xb - xa + 1;
  if (W2 <= 0) return true;
  if (W2 < 2 * DOCK + 3 + 2 * hop.lo) {
    dock(g, xa, xb, rowA);
    return true;
  }
  const { widths, gaps, hard: hs } = chain(rng, W2, hop, hard, style === 'station' ? [4, 8] : [3, 7]);
  const used = widths.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
  const dA = Math.max(DOCK, Math.min(W2 - used - DOCK, Math.floor((W2 - used) * rng.range(0.4, 0.6))));
  const dB = W2 - used - dA;
  if (dB < DOCK) return false;
  dock(g, xa, xa + dA - 1, rowA);
  dock(g, xb - dB + 1, xb, rowB);
  let x = xa + dA;
  let prev = rowA;
  const tops: { x: number; w: number; top: number }[] = [];
  for (let i = 0; i < widths.length; i++) {
    const x0 = x + gaps[i];
    const wi = widths[i];
    const t = (x0 + wi / 2 - xa) / W2;
    let top = clampRow(k, Math.round(rowA + (rowB - rowA) * t) + rng.int(-2, 2));
    top = Math.max(prev - 3, Math.min(prev + 4, top));
    if (hs[i]) hintGap(g, x, x0 - 1, Math.max(prev, top));
    if (style === 'station') module(g, rng, x0, wi, top);
    else asteroid(g, rng, x0, wi, top, hs[i]);
    tops.push({ x: x0, w: wi, top });
    prev = top;
    x = x0 + wi;
  }
  if (hs[widths.length]) hintGap(g, x, xb - dB, Math.max(prev, rowB));
  const row = (c: number) => {
    if (c < xa + dA) return rowA;
    if (c > xb - dB) return rowB;
    const on = tops.find((t) => c >= t.x - 1 && c <= t.x + t.w);
    if (on) return on.top;
    const next = tops.findIndex((t) => t.x > c);
    const before = next < 0 ? tops[tops.length - 1] : tops[next - 1];
    return Math.max(before?.top ?? rowA, next < 0 ? rowB : tops[next].top);
  };
  upperLane(g, rng, row, xa + dA - 3, xb - dB + 2, style === 'station', hop);
  return true;
}
