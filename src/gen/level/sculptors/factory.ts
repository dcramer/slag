import type { Rng } from '../../../core/rng';
import { finish, Grid } from '../kit';
import type { Sculptor } from '../types';
import { easyGap, easyRise, hardGap, knobs, pit, rollChallenges, Slots, stepRows } from './common';
import { factoryTall } from './tall';

type FactoryStyle = 'foundry' | 'warehouse' | 'assembly';

/**
 * Factory: a flat concrete floor under a ceiling of ducts, cut by drop pits
 * (vats). Floor stamps: crate pyramids, furnace chimneys that run to the
 * ceiling with a firebox doorway, tiered shelving racks of one-way shelves,
 * press machines. Above: girder catwalks (one-way) hung from the ceiling on
 * rods, reached by stair stringers.
 */
export const factory: Sculptor = (ctx) => {
  if (ctx.profile.size === 'tall') return factoryTall(ctx);
  const { rng, attempt } = ctx;
  const k = knobs(ctx);
  const { W, H } = k;
  const style = rng.weighted<FactoryStyle>([
    ['foundry', 3],
    ['warehouse', 3],
    ['assembly', 3],
  ]);
  const g = new Grid(W, H);
  const slots = new Slots(6, W - 7);
  const f = H - rng.int(4, 7); // top floor row
  const ceil = rng.int(0, 1 + Math.round(k.density * 2)); // last ceiling row
  // Floor in level sections (loading docks), each within a climbable step of the last.
  const floor = stepRows(rng, k, f, [7, 14], 0.5, 2);
  const level = (a: number, b: number, row = floor[Math.max(0, a)]) => {
    for (let x = Math.max(0, a); x <= Math.min(W - 1, b); x++) floor[x] = row;
    return row;
  };

  // Vats (drop pits) in the floor: hard ones need a bridge.
  const challenges = rollChallenges(rng, 0.82, 0.15, attempt, k);
  g.wantsProps = challenges > 0;
  const vats: { a: number; b: number; hard: boolean }[] = [];
  const nEasy = rng.int(style === 'foundry' ? 1 : 0, 2) + Math.floor((k.wide - 1) * rng.range(1, 2.5));
  for (let i = 0; i < challenges + nEasy; i++) {
    const hard = i < challenges;
    const w = hard ? hardGap(rng) : easyGap(rng, 2);
    const a = slots.take(rng, w, 3, 9, W - 10);
    if (a === null) continue;
    level(a - 2, a + w + 1, Math.max(floor[a - 2], floor[a + w + 1]));
    vats.push({ a, b: a + w - 1, hard });
  }
  // Floor machinery sits on level ground.
  const placed: { m: Machine; x: number; w: number }[] = [];
  const bag: Machine[] = [];
  for (let r = 0; r < Math.max(1, Math.round(k.wide * (0.55 + 0.7 * k.density))); r++) bag.push(...BAGS[style](rng));
  for (const m of bag) {
    const w = m.w(rng);
    const x = slots.take(rng, w, 2);
    if (x === null) continue;
    level(x - 1, x + w);
    placed.push({ m, x, w });
  }
  const sRow = level(0, 5);
  const gRow = level(W - 6, W - 1);
  for (let x = 0; x < W; x++) g.fill(x, floor[x], x, H - 1);
  if ((style !== 'assembly' || rng.chance(0.5)) && rng.chance(0.3 + 0.7 * k.density)) g.fill(0, 0, W - 1, ceil);
  for (const v of vats) {
    pit(g, v.a, v.b, floor[v.a - 1], v.hard);
    g.clear(v.a, 0, v.b, ceil); // the shaft above a vat opens the roof
    if (!v.hard && rng.chance(0.5)) {
      g.set(v.a - 1, floor[v.a - 1] - 1, 1); // lips
      g.set(v.b + 1, floor[v.b + 1] - 1, 1);
    }
  }
  for (const p of placed) p.m.stamp(g, rng, p.x, p.w, floor[p.x], ceil);

  // Catwalks: one-way girders hung from the ceiling, never across hard vats' full width.
  const nWalks = k.count(style === 'assembly' ? rng.int(2, 3) : rng.int(0, 2));
  const rise = easyRise();
  for (let i = 0; i < nWalks; i++) {
    const len = rng.int(7, 14);
    const x0 = rng.int(6, W - 7 - len);
    const y = floor[x0] - rise * rng.int(2, 3) - (i % 2 === 0 ? 0 : 1);
    const x1 = x0 + len - 1;
    if (y <= ceil + 3) continue;
    if (vats.some((v) => v.hard && x1 >= v.a - 5 && x0 <= v.b + 5)) continue; // no flying over a hard vat
    let clean = true;
    for (let x = x0 - 1; x <= x1 + 1 && clean; x++) for (let yy = y - 3; yy <= y; yy++) if (!g.empty(x, yy)) clean = false;
    if (!clean) continue;
    g.plank(x0, x1, y);
    if (g.get(x0, ceil) === 1) {
      for (const rx of [x0 + 1, x1 - 1]) g.fill(rx, ceil + 1, rx, y - 4);
    }
    // Stair stringer up to the catwalk from the floor, from the left.
    if (rng.chance(0.75)) {
      let sx = x0 - 2;
      let sy = y + rise;
      while (sy < floor[Math.max(0, sx)] && sx > 5 && g.empty(sx, sy) && g.empty(sx + 1, sy)) {
        g.plank(sx, sx + 1, sy);
        sx -= 3;
        sy += rise;
      }
    }
  }

  // Hanging ducts.
  if (g.get(10, ceil) === 1) {
    for (let i = k.count(rng.int(2, 5)); i > 0; i--) {
      const x = rng.int(6, W - 8);
      const len = rng.int(1, 3);
      if (g.empty(x, ceil + len + 3)) g.fill(x, ceil + 1, x + rng.int(0, 1), ceil + len);
    }
  }

  return finish(g, { row: sRow - 1 }, { row: gRow - 1 }, `factory:${style}`);
};

interface Machine {
  w: (rng: Rng) => number;
  stamp: (g: Grid, rng: Rng, x: number, w: number, f: number, ceil: number) => void;
}

/** Crate stacks: 2-wide columns of 2×2 crates, heights stepping like a skyline, with the odd loose crate. */
const CRATES: Machine = {
  w: (rng) => rng.pick([4, 6, 6, 8]),
  stamp: (g, rng, x, w, f) => {
    const n = w >> 1;
    const peak = rng.int(0, n - 1);
    for (let i = 0; i < n; i++) {
      const h = Math.max(1, 3 - Math.abs(i - peak) + (rng.chance(0.3) ? -1 : 0));
      const cx = x + i * 2;
      g.fill(cx, f - h * 2, cx + 1, f - 1);
      // Gaps between crates read as seams.
      if (h >= 2 && rng.chance(0.5)) g.set(cx + (rng.chance(0.5) ? 0 : 1), f - h * 2, 0, true);
    }
  },
};

/** Furnace chimney to the ceiling with a firebox doorway, a flared hearth and one-way vent ledges. */
const CHIMNEY: Machine = {
  w: (rng) => rng.int(2, 3) + 4,
  stamp: (g, rng, x, w, f) => {
    const cw = w - 4;
    const cx = x + 2;
    g.fill(cx, 0, cx + cw - 1, f - 1);
    g.fill(cx - 2, f - 5, cx + cw + 1, f - 4); // hearth
    g.fill(cx - 1, f - 6, cx + cw, f - 6);
    g.clear(cx - 2, f - 3, cx + cw + 1, f - 1); // firebox you run through
    g.fill(cx - 2, f - 3, cx - 2, f - 3);
    g.fill(cx + cw + 1, f - 3, cx + cw + 1, f - 3);
    const ly = f - 6 - easyRise() - rng.int(0, 1);
    g.plank(cx - 2, cx - 1, ly);
    g.plank(cx + cw, cx + cw + 1, ly - rng.int(1, 3));
    for (let y = ly - 4; y > 3; y -= rng.int(3, 5)) g.fill(cx - 1, y, cx + cw, y); // banding
  },
};

/** Tiered shelving: one-way shelves stepping up to the right, posts on the high end. */
const RACK: Machine = {
  w: (rng) => rng.int(7, 10),
  stamp: (g, rng, x, w, f) => {
    const rise = easyRise();
    const tiers = rng.int(2, 3);
    const r = x + w - 1;
    for (let i = 0; i < tiers; i++) {
      const y = f - rise * (i + 1);
      const a = x + i * 2;
      g.plank(a, r, y);
      if (rng.chance(0.6)) g.fill(a + 1, y - 1, a + 2, y - 1); // boxes on the shelf
    }
    g.fill(r, f - rise * tiers, r, f - 3); // post; the bottom is forklift clearance
  },
};

/** Stamping press: a die base you hop onto, a ram head hanging above it on a piston rod. */
const PRESS: Machine = {
  w: (rng) => rng.int(4, 6),
  stamp: (g, rng, x, w, f, ceil) => {
    const r = x + w - 1;
    g.fill(x, f - 2, r, f - 1);
    const head = f - 6 - rng.int(0, 1);
    g.fill(x, head - 1, r, head);
    const mid = x + (w >> 1);
    g.fill(mid, ceil + 1, mid, head - 2);
    if (w >= 5) g.fill(mid - 1, ceil + 1, mid - 1, head - 2);
    g.plank(x - 1, x - 1, f - 2); // feed tray
  },
};

const BAGS: Record<FactoryStyle, (rng: Rng) => Machine[]> = {
  foundry: (rng) => [CHIMNEY, rng.pick([CRATES, PRESS]), rng.pick([CHIMNEY, CRATES])],
  warehouse: (rng) => [RACK, CRATES, rng.pick([RACK, CRATES])],
  assembly: (rng) => [PRESS, rng.pick([CRATES, RACK]), PRESS],
};
