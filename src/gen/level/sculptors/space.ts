import type { Rng } from '../../../core/rng';
import { finish, Grid, hintGap } from '../kit';
import { jumpProfile } from '../probe';
import type { Sculptor } from '../types';
import { easyRise, hardGap, hopGap, knobs, rollChallenges } from './common';

type SpaceStyle = 'asteroids' | 'station';

/** Share of wide space levels asking for two parts (classic ones ask for one): about TWO_PARTS over the theme. */
const WIDE_TWO_PARTS = 0.4;

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
 * third of a classic level. So a classic level asks for one part, and a wide
 * one asks for two more often than other themes do (`WIDE_TWO_PARTS`), which
 * keeps the theme's share of two-part levels where the rest are. A void two
 * bridges wide doesn't work here: at this gravity a long fall onto one low
 * bridge and a jump back up crosses it.
 */
export const space: Sculptor = (ctx) => {
  const { rng, attempt } = ctx;
  const style: SpaceStyle = ctx.theme?.terrain?.kind === 'hull' ? 'station' : 'asteroids';
  const k = knobs(ctx);
  const { W, H } = k;
  const g = new Grid(W, H);
  const j = jumpProfile();
  const asked = rollChallenges(attempt, k);
  const challenges = asked && W < 64 ? 1 : asked && k.challenge < WIDE_TWO_PARTS && attempt < 16 ? 2 : asked;
  g.wantsProps = challenges > 0;
  const base = H - rng.int(7, 10);

  const widthOf = () => (style === 'station' ? rng.int(6, 11) : rng.int(5, 10));
  const widths: number[] = [widthOf()];
  const fill = 0.5 + 0.2 * k.density;
  while (widths.reduce((a, b) => a + b, 0) + (widths.length + 1) * 5 + 12 < W * fill) widths.push(widthOf());

  const nGaps = widths.length + 1;
  const hardIdx = new Set<number>();
  while (hardIdx.size < Math.min(challenges, nGaps)) hardIdx.add(rng.int(0, nGaps - 1));
  const hard = Array.from({ length: nGaps }, (_, i) => hardIdx.has(i));
  // Easy voids stay a walking hop: a run-up's worth would leave no room for anything else.
  const gaps = hard.map((h) => (h ? hardGap(rng) : hopGap(rng, 2)));
  const minHard = j.gap + 2;
  const total = () => widths.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0) + 12;
  while (total() > W) {
    const easy = gaps.findIndex((gp, i) => !hard[i] && gp > 2);
    const wide = gaps.findIndex((gp, i) => hard[i] && gp > minHard);
    const fat = widths.findIndex((w) => w > 5);
    if (easy >= 0) gaps[easy]--;
    else if (wide >= 0) gaps[wide]--;
    else if (fat >= 0) widths[fat]--;
    else if (widths.length > 1) {
      // Drop the last body and the gap before it, keeping a hard flag on the final gap.
      const at = widths.length - 1;
      if (hard[at]) hard[at + 1] = true;
      widths.pop();
      gaps.splice(at, 1);
      hard.splice(at, 1);
    } else break;
  }
  const used = widths.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
  const dockL = Math.max(6, Math.min(W - used - 6, Math.floor((W - used) * rng.range(0.4, 0.6))));
  const dockR = W - used - dockL;
  const sTop = Math.max(8, Math.min(H - 7, base + k.ramp(0)));
  const gTop = Math.max(8, Math.min(H - 7, base + k.ramp(W - 1) + rng.int(-2, 1)));
  if (dockR < 6) return finish(g, { row: sTop - 1, depth: 2 }, { row: gTop - 1, depth: 2 }, `space:broken`);

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
    const before = tops.filter((t) => t.x + t.w <= c).pop();
    const after = tops.find((t) => t.x > c);
    return Math.max(before?.top ?? sTop, after?.top ?? gTop);
  };
  upperLane(g, rng, row, dockL - 3, W - dockR + 2, style === 'station');

  return finish(g, { row: sTop - 1, depth: 2 }, { row: gTop - 1, depth: 2 }, `space:${style}`);
};

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
  const depth = rng.int(2, Math.min(6, 2 + (w >> 1)));
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
 * station, a hop apart. It breaks off over every hard crossing (anything there would be a way across), so
 * the route splits and rejoins instead of needing lanes laid over it later.
 */
function upperLane(g: Grid, rng: Rng, row: (x: number) => number, from: number, to: number, station: boolean): void {
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
    x += w + rng.int(2, Math.min(5, hopGap(rng, 2) + 1));
  }
}
