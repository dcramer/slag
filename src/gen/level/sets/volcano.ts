import type { Rng } from '../../../core/rng';
import { volcanoOwns } from '../../stage/volcano';
import { type Grid, hintGap, noise1D } from '../kit';
import { jumpProfile } from '../probe';
import type { SculptCtx } from '../types';
import { type Claim, claimSite, easyRise, flatten, hardGap, hopGap, jumpGap, type Knobs, pit, type Slots } from '../sculptors/common';
import type { CourseKit } from './types';

interface VolcanoState {
  base: number;
  /** Stepping stones in the lava lakes. */
  stones: { x: number; y: number; w: number }[];
  /** The caldera's crater, the crossing at the top of its cone. */
  crater: { a: number; b: number; rim: number } | null;
}

/**
 * Volcano: jagged, hostile rock. A sawtooth heightmap broken by big lava
 * pits; tapered spires with ragged flanks; basalt organ-pipe clusters (1-wide
 * columns stepping in height); floating rock chunks with dripping undersides
 * as stepping stones over lava lakes ('flows'); or a huge cone with a crater
 * to cross at the top ('caldera'). The landmark owns one crossing, or both where its box made room for a
 * two-part one.
 */
export const VOLCANO_COURSE: CourseKit<VolcanoState> = {
  name: 'volcano',
  styles: (k, ctx) => [
    ['spires', 1 + 3 * k.density],
    // A landmark brings its own crater: the plain caldera would be a second one.
    ['caldera', ctx.concept ? 0 : 2],
    ['flows', 4 - 2 * k.density],
  ],
  ground: {
    profile(rng, k) {
      const base = k.H - rng.int(5, 8);
      const n = noise1D(rng, k.W, rng.int(5, 8), 3, 0.6);
      const surf = n.map((v, x) => Math.max(6, Math.min(k.H - 3, Math.round(base + k.ramp(x) + v * 4 + (x % 2 ? rng.int(0, 1) : 0)))));
      return { surf, state: { base, stones: [], crater: null } };
    },
    pockets: 'early',
    step: () => 2,
  },
  // Lava pits: level banks either side of one you need a run-up for, wide enough to run on and land on.
  gap: {
    pad: () => 0,
    margin: 3,
    range: [8, 9],
    bank: (hard, w) => (hard || w > jumpProfile().walkGap ? 4 : 2),
    sample: 1,
    sink: true,
    keepClear: true,
  },
  site: (c) => claimVolcanoSite(c.ctx, c.k, c.slots, c.surf, c.locked),
  owns: volcanoOwns,
  plan(c) {
    const { g, rng, k, style, slots, surf, locked, state } = c;
    const { H, W } = k;
    const stones = state.stones;
    // Lava lake with floating stepping stones.
    for (let lake = style === 'flows' ? Math.max(1, Math.round(k.wide * 0.8)) : 0; lake > 0; lake--) {
      const lw = rng.int(16, 24);
      const a = slots.take(rng, lw, 2, 8, W - 9);
      if (a !== null) {
        const b = a + lw - 1;
        const bank = Math.max(surf[a - 1], surf[b + 1]);
        for (let x = a - 2; x <= b + 2; x++) {
          surf[x] = x >= a && x <= b ? H : bank;
          locked[x] = 1;
        }
        // Chain stones from the left bank; one link may be a hard jump.
        let px = a - 1;
        let py = bank - 1;
        const hardAt = c.hardLeft > 0 ? rng.int(0, 2) : -1;
        for (let i = 0; px < b - 3; i++) {
          const gap = i === hardAt ? hardGap(rng) : hopGap(rng, 2);
          const w = rng.int(2, 4);
          const x = px + gap + 1;
          if (x + w - 1 > b - 2) break;
          const y = Math.max(bank - 6, Math.min(bank + 1, py + rng.int(-2, 2)));
          if (i === hardAt) {
            hintGap(g, px + 1, x - 1, Math.max(py, y) + 1);
            c.hardLeft--;
          }
          stones.push({ x, y, w });
          px = x + w - 1;
          py = y;
        }
      }
    }
    // Caldera: a big cone whose crater is the crossing.
    if (style === 'caldera') {
      const cw = rng.int(22, 28);
      const x = slots.take(rng, cw, 0, 8, W - 9);
      if (x !== null) {
        const mid = x + (cw >> 1);
        const peak = Math.max(5, Math.min(...surf.slice(x, x + cw)) - rng.int(7, 10));
        const cr = c.hardLeft > 0 ? hardGap(rng) : jumpGap(rng, 2);
        if (c.hardLeft > 0) c.hardLeft--;
        const ca = mid - (cr >> 1);
        const cb = ca + cr - 1;
        for (let i = x; i < x + cw; i++) {
          const d = i < ca ? ca - i : i > cb ? i - cb : 0;
          surf[i] = d === 0 ? H : Math.min(surf[i], peak + Math.floor(d * 0.75) + (d > 2 && rng.chance(0.3) ? 1 : 0));
          locked[i] = 1;
        }
        // Flat far rim so its undercut lip has solid rock behind it (no slope to climb out onto).
        surf[ca - 1] = peak;
        for (let i = cb + 1; i <= Math.min(x + cw - 1, cb + 4); i++) surf[i] = peak;
        state.crater = { a: ca, b: cb, rim: peak };
      }
    }
  },
  dress({ g, rng, state: { crater, stones } }) {
    if (crater) {
      pit(g, crater.a, crater.b, crater.rim, true);
      // Jagged rim teeth.
      g.set(crater.a - 1, crater.rim - 1, 1);
      g.set(crater.b + 1, crater.rim - 1, 1);
    }
    for (const s of stones) rock(g, rng, s.x, s.y, s.w);
  },
  // Spires and basalt clusters on the remaining ground.
  standing: [
    {
      count: (rng, k, style) => k.count(style === 'spires' ? rng.int(2, 4) : rng.int(0, 2)),
      margin: 1,
      stamp: { w: (rng) => rng.pick([4, 5, 6, 7]), stamp: (g, rng, x, w, _f, c) => spire(g, rng, x, w, c.surf) },
    },
    {
      count: (rng, k, style) => k.count(style === 'spires' ? rng.int(1, 2) : rng.int(0, 1)),
      margin: 1,
      stamp: { w: (rng) => rng.int(4, 7), stamp: (g, rng, x, w, _f, c) => basalt(g, rng, x, w, c.surf) },
    },
  ],
  crown({ g, rng, k, surf, claim, state: { base } }) {
    const { W, H } = k;
    // Floating chunks in the sky over open ground.
    for (let i = claim ? 0 : k.count(rng.int(0, 2)); i > 0; i--) {
      const x = rng.int(8, W - 12);
      const y = Math.max(5, (surf[x] < H ? surf[x] : base) - rng.int(8, 13));
      let clean = true;
      for (let yy = y - 3; yy <= y + 5 && clean; yy++) for (let xx = x - 2; xx <= x + 6; xx++) if (!g.empty(xx, yy)) clean = false;
      if (clean) rock(g, rng, x, y, rng.int(3, 5));
    }
  },
};

/**
 * The landmark's site (claimSite), on ground levelled a couple of columns past it either side and never
 * so low that its tubes have no rock under them. Nothing else lands within a running jump of its far
 * side, where a pit could be cleared bare off its top.
 */
function claimVolcanoSite(ctx: SculptCtx, k: Knobs, slots: Slots, surf: number[], locked: Uint8Array): Claim | null {
  const claim = claimSite(ctx, k, slots, surf, locked);
  if (!claim) return null;
  const { x, w } = claim.at;
  const ground = Math.min(claim.ground, k.H - 5);
  slots.mark(x - 3, x + w + 8);
  flatten(surf, k.H, x - 2, x + w + 1, ground);
  for (let i = Math.max(0, x - 3); i <= Math.min(k.W - 1, x + w + 2); i++) locked[i] = 1;
  return { ...claim, ground, at: { ...claim.at, y: ground - claim.at.h } };
}

/** Floating rock: flat top at row y, tapering to a dripping point underneath. */
function rock(g: Grid, rng: Rng, x: number, y: number, w: number): void {
  g.fill(x, y, x + w - 1, y);
  if (w >= 3) g.fill(x + 1, y + 1, x + w - 2, y + 1);
  else g.set(x + rng.int(0, 1), y + 1, 1);
  if (w >= 4) g.set(x + rng.int(1, w - 2), y + 2, 1);
}

/** Tapered spire with ragged flanks: steps in by a column every 1–2 rows, topped by a short needle. */
function spire(g: Grid, rng: Rng, x: number, w: number, surf: number[]): void {
  const f = Math.max(...surf.slice(x, x + w).filter((v) => v < g.h));
  let a = x;
  let b = x + w - 1;
  let y = f - 1;
  const rise = easyRise();
  const tall = rng.int(7, 13);
  // Bands of 1..rise rows; each band steps in on one side (ragged, leaning flanks).
  while (a <= b && y > f - 1 - tall && y > 3) {
    const h = rng.int(1, rise);
    g.fill(a, y - h + 1, b, y);
    y -= h;
    if (b - a >= 3 || rng.chance(0.5)) a++;
    else b--;
    if (b - a >= 3) b--;
  }
  // Needle tip.
  const tip = x + (w >> 1) + rng.int(-1, 1);
  g.fill(tip, y - rng.int(0, 2), tip, y);
}

/** Basalt organ pipes: adjacent 1-wide columns whose heights step by ±1. */
function basalt(g: Grid, rng: Rng, x: number, w: number, surf: number[]): void {
  let h = rng.int(2, 3);
  for (let i = 0; i < w; i++) {
    const f = surf[x + i];
    if (f >= g.h) continue;
    g.fill(x + i, f - h, x + i, f - 1);
    h = Math.max(1, Math.min(6, h + rng.pick([-1, 1, 1])));
  }
}
