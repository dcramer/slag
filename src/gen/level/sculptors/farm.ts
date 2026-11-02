import type { Rng } from '../../../core/rng';
import { finish, Grid, groundFromHeights, noise1D } from '../kit';
import type { Sculptor } from '../types';
import { easyGap, easyRise, flatten, hardGap, type Knobs, knobs, pit, relax, rollChallenges, Slots } from './common';

type FarmStyle = 'fields' | 'barnyard' | 'windmill' | 'orchard';
type Stamp = (g: Grid, rng: Rng, x: number, w: number, f: number) => void;

interface Feature {
  w: (rng: Rng) => number;
  stamp: Stamp;
}

/**
 * Farm: rolling hill heightmap with ponds cut into it, and landmarks sat on
 * flattened ground — a gabled barn (doors, hay-loft one-way, stepped roof),
 * a domed silo with a hay-bale staircase, a tapered windmill tower with a
 * one-way gallery, fruit trees with branch perches, hay wagons, fence rows
 * with one-way rails and haystack mounds.
 */
export const farm: Sculptor = (ctx) => {
  const { rng, attempt } = ctx;
  const k = knobs(ctx);
  const { W, H } = k;
  const style = rng.weighted<FarmStyle>([
    ['fields', k.wide > 1.4 ? 5 : 3],
    ['barnyard', 4],
    ['windmill', 3],
    ['orchard', 3],
  ]);
  const g = new Grid(W, H);
  const slots = new Slots(6, W - 7);
  const locked = new Uint8Array(W);
  const surf = heights(rng, k);

  // Ponds first: hard ones need a bridge, easy ones are a hop. Wide farms get more of them.
  const challenges = rollChallenges(attempt, k);
  g.wantsProps = challenges > 0;
  const pits: { x0: number; x1: number; hard: boolean }[] = [];
  const nEasy = rng.int(0, style === 'fields' ? 2 : 1) + Math.floor((k.wide - 1) * rng.range(1, 2.5));
  for (let i = 0; i < challenges + nEasy; i++) {
    const hard = i < challenges;
    const w = hard ? hardGap(rng) : easyGap(rng, 2);
    const a = slots.take(rng, w + 4, 2, 8, W - 9);
    if (a === null) continue;
    const x0 = a + 2;
    const x1 = x0 + w - 1;
    const bank = Math.max(surf[x0 - 2], surf[x1 + 2]);
    for (let x = a; x <= a + w + 3; x++) {
      surf[x] = x >= x0 && x <= x1 ? H : bank;
      locked[x] = 1;
    }
    pits.push({ x0, x1, hard });
  }

  // Landmarks on flattened ground: one bag per ~48 columns, thinned on sparse maps.
  const bag: Feature[] = [];
  for (let r = 0; r < Math.max(1, Math.round(k.wide * (0.6 + 0.6 * k.density))); r++) bag.push(...FEATURES[style](rng));
  if (k.density < 0.3 && bag.length > 1) bag.length = Math.max(1, bag.length - 1);
  const placed: { f: Feature; x: number; w: number }[] = [];
  for (const f of bag) {
    const w = f.w(rng);
    const x = slots.take(rng, w, 2);
    if (x === null) continue;
    flatten(surf, H, x - 1, x + w);
    for (let i = x - 1; i <= x + w; i++) locked[i] = 1;
    placed.push({ f, x, w });
  }
  const sRow = flatten(surf, H, 0, 5);
  const gRow = flatten(surf, H, W - 6, W - 1);
  for (const x of [0, 1, 2, 3, 4, 5, W - 6, W - 5, W - 4, W - 3, W - 2, W - 1]) locked[x] = 1;
  relax(surf, H, locked, 1);
  groundFromHeights(g, surf);
  for (const p of pits) pit(g, p.x0, p.x1, surf[p.x0 - 1], p.hard);
  for (const p of placed) p.f.stamp(g, rng, p.x, p.w, surf[p.x]);

  // Small decor on whatever flat ground is left.
  const decor: Feature[] = [FENCE, HAYSTACK, HAYSTACK, WAGON];
  for (let i = k.count(rng.int(1, 3)); i > 0; i--) {
    const f = rng.pick(decor);
    const w = f.w(rng);
    for (let tries = 0; tries < 12; tries++) {
      const x = rng.int(7, W - 8 - w);
      if (!slots.free(x, x + w - 1, 1) || !isFlat(surf, H, x, x + w - 1)) continue;
      slots.mark(x, x + w - 1);
      f.stamp(g, rng, x, w, surf[x]);
      break;
    }
  }

  return finish(g, { row: sRow - 1 }, { row: gRow - 1 }, `farm:${style}`);
};

/** Rolling hills on a route ramp (climbing farms terrace uphill toward the goal). */
function heights(rng: Rng, k: Knobs): number[] {
  const { W, H } = k;
  const base = H - rng.int(5, 8);
  const amp = rng.range(2, 4.5) * (0.7 + 0.6 * k.density);
  const n = noise1D(rng, W, rng.int(10, 18), 2, 0.35);
  const out = n.map((v, x) => Math.max(6, Math.min(H - 3, Math.round(base + k.ramp(x) + v * amp * 1.4))));
  return relax(out, H, new Uint8Array(W), 1);
}

function isFlat(surf: number[], H: number, a: number, b: number): boolean {
  for (let x = a; x <= b; x++) if (surf[x] !== surf[a] || surf[x] >= H) return false;
  return true;
}

// --- stamps (f = top solid row of the ground under the stamp) ---------------

/** Gabled barn: walls with doors, a hay loft, a stepped roof with a cupola. */
const BARN: Feature = {
  w: (rng) => rng.pick([9, 11, 11, 13]),
  stamp: (g, rng, x, w, f) => {
    const wallH = rng.int(5, 6);
    const top = f - wallH;
    const r = x + w - 1;
    g.fill(x, top, x, f - 1);
    g.fill(r, top, r, f - 1);
    g.clear(x, f - 3, x, f - 1);
    g.clear(r, f - 3, r, f - 1);
    // Hay loft: one-way floor with a ladder hole and a bale to climb from.
    const holeLeft = rng.chance(0.5);
    g.plank(x + (holeLeft ? 3 : 1), r - (holeLeft ? 1 : 3), f - 4);
    g.fill(holeLeft ? x + 4 : r - 4, f - 1, holeLeft ? x + 5 : r - 5, f - 1);
    // Roof: 1-row steps with a one-tile eave; the attic is solid.
    const step = rng.chance(0.65) ? 1 : 2;
    let a = x - 1;
    let b = r + 1;
    let y = top - 1;
    while (a <= b && y >= 1) {
      g.fill(a, y, b, y);
      a += step;
      b -= step;
      y--;
    }
    if (rng.chance(0.7)) g.fill(x + (w >> 1), y, x + (w >> 1), y - 1);
  },
};

/** Domed silo with a hay-bale staircase climbing its open side. */
const SILO: Feature = {
  w: (rng) => rng.int(3, 4) + 4,
  stamp: (g, rng, x, w, f) => {
    const sw = w - 4;
    const left = rng.chance(0.85); // stairs usually face the approach (players run left → right)
    const sx = left ? x + 4 : x;
    const h = rng.int(8, 10);
    const top = f - h;
    g.fill(sx, top, sx + sw - 1, f - 1);
    g.fill(sx + 1, top - 1, sx + sw - 2, top - 1);
    g.clear(sx, top, sx, top);
    g.clear(sx + sw - 1, top, sx + sw - 1, top);
    const rise = easyRise();
    for (let i = 0; i < 2; i++) {
      const hgt = h - rise * (i + 1);
      if (hgt <= 0) break;
      const bx = left ? sx - 2 - 2 * i : sx + sw + 2 * i;
      g.fill(bx, f - hgt, bx + 1, f - 1);
    }
  },
};

/** Tapered windmill tower: narrows in steps (climbable ledges), one-way gallery, cap. */
const WINDMILL: Feature = {
  w: (rng) => rng.pick([7, 9]),
  stamp: (g, rng, x, w, f) => {
    const levels = rng.int(3, 4);
    const rise = easyRise();
    let a = x;
    let b = x + w - 1;
    let y = f - 1;
    for (let i = 0; i < levels && a <= b; i++) {
      g.fill(a, y - rise + 1, b, y);
      y -= rise;
      a++;
      b--;
    }
    const mid = x + (w >> 1);
    g.fill(mid - 1, y, mid + 1, y);
    g.fill(mid, y - 1, mid, y - 1);
    // Gallery around the tower partway up.
    const gy = f - rise * 2;
    g.plank(x - 2, x + w + 1, gy);
    if (rng.chance(0.5)) g.clear(x, f - 2, x + w - 1, f - 1); // archway at the base
  },
};

/** Fruit tree: trunk, rounded canopy, a low one-way branch to climb from. */
const TREE: Feature = {
  w: (rng) => rng.pick([7, 9]),
  stamp: (g, rng, x, w, f) => {
    const mid = x + (w >> 1);
    const trunkH = rng.int(3, 4);
    const cb = f - trunkH - 1; // canopy bottom row
    const ch = rng.int(2, 3);
    g.fill(mid, cb, mid, f - 1);
    for (let i = 0; i < ch; i++) {
      const inset = i === ch - 1 ? 1 : 0;
      g.fill(x + 1 + inset, cb - i, x + w - 2 - inset, cb - i);
    }
    g.set(x + 1, cb, 0, true);
    g.set(x + w - 2, cb, 0, true);
    const by = f - easyRise();
    g.plank(x - 1, mid - 1, by);
    if (rng.chance(0.4)) g.plank(mid + 1, x + w, by);
  },
};

/** Hay wagon: a two-row bed on two wheels. */
const WAGON: Feature = {
  w: (rng) => rng.int(5, 6),
  stamp: (g, _rng, x, w, f) => {
    g.fill(x, f - 3, x + w - 1, f - 2);
    g.set(x + 1, f - 1, 1);
    g.set(x + w - 2, f - 1, 1);
    g.plank(x, x + w - 1, f - 4);
  },
};

/** Fence: posts every 3 columns with a one-way rail. */
const FENCE: Feature = {
  w: (rng) => rng.pick([7, 10]),
  stamp: (g, _rng, x, w, f) => {
    for (let i = x; i < x + w; i += 3) g.fill(i, f - 3, i, f - 1);
    g.plank(x, x + w - 1, f - 2);
  },
};

/** Haystack mound (rounded, 2–3 rows). */
const HAYSTACK: Feature = {
  w: (rng) => rng.int(3, 6),
  stamp: (g, _rng, x, w, f) => {
    g.fill(x, f - 1, x + w - 1, f - 1);
    if (w >= 3) g.fill(x + 1, f - 2, x + w - 2, f - 2);
    if (w >= 5) g.fill(x + 2, f - 3, x + w - 3, f - 3);
  },
};

const FEATURES: Record<FarmStyle, (rng: Rng) => Feature[]> = {
  fields: (rng) => [rng.pick([TREE, WAGON]), FENCE, HAYSTACK],
  barnyard: (rng) => (rng.chance(0.5) ? [BARN, SILO] : [SILO, BARN]),
  windmill: (rng) => [WINDMILL, rng.pick([TREE, FENCE, WAGON])],
  orchard: () => [TREE, TREE, TREE],
};
