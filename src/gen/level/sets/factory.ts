import type { Rng } from '../../../core/rng';
import type { Grid } from '../kit';
import { claimSite, easyRise, stepRows } from '../sculptors/common';
import type { CourseKit } from './types';

type FactoryStyle = 'foundry' | 'warehouse' | 'assembly';

interface FactoryState {
  /** Last ceiling row. */
  ceil: number;
}

/**
 * Factory: a flat concrete floor under a ceiling of ducts, cut by drop pits
 * (vats). Floor stamps: crate pyramids, furnace chimneys that run to the
 * ceiling with a firebox doorway, tiered shelving racks of one-way shelves,
 * press machines. Above: girder catwalks (one-way) hung from the ceiling on
 * rods, reached by stair stringers.
 */
export const FACTORY_COURSE: CourseKit<FactoryState> = {
  name: 'factory',
  styles: () => [
    ['foundry', 3],
    ['warehouse', 3],
    ['assembly', 3],
  ],
  ground: {
    // Floor in level sections (loading docks), each within a climbable step of the last.
    profile(rng, k) {
      const f = k.H - rng.int(4, 7);
      const ceil = rng.int(0, 1 + Math.round(k.density * 2));
      return { surf: stepRows(rng, k, f, [7, 14], 0.5, 2), state: { ceil } };
    },
    pockets: 'near',
    lay({ g, rng, k, style, surf, state }) {
      for (let x = 0; x < k.W; x++) g.fill(x, surf[x], x, k.H - 1);
      if ((style !== 'assembly' || rng.chance(0.5)) && rng.chance(0.3 + 0.7 * k.density)) g.fill(0, 0, k.W - 1, state.ceil);
    },
  },
  // Vats (drop pits) in the floor: hard ones need a bridge.
  gap: {
    pad: () => 0,
    margin: 3,
    range: [9, 10],
    bank: () => 2,
    sample: 2,
    sink: false,
    keepClear: true,
    extra: (style) => (style === 'foundry' ? 1 : 0),
    dress(g, rng, v, row, { state, surf }) {
      g.clear(v.x0, 0, v.x1, state.ceil); // the shaft above a vat opens the roof
      if (!v.hard && !v.stones.length && rng.chance(0.5)) {
        g.set(v.x0 - 1, row - 1, 1); // lips
        g.set(v.x1 + 1, surf[v.x1 + 1] - 1, 1);
      }
    },
  },
  // Floor machinery sits on level ground.
  stamps: {
    bag(rng, k, style) {
      const bag: Machine[] = [];
      for (let r = 0; r < Math.max(1, Math.round(k.wide * (0.55 + 0.7 * k.density))); r++) bag.push(...BAGS[style as FactoryStyle](rng));
      return bag.map((m) => ({ w: m.w, stamp: (g, rng2, x, w, f, c) => m.stamp(g, rng2, x, w, f, c.state.ceil) }));
    },
    margin: 2,
    level: 'near',
  },
  // The landmark owns one of the hard vats (stage/factory.ts), and nothing stands on its vat's near bank or within
  // a falling jump of its far side, where its movers could carry a bare run over the next vat.
  site({ ctx, k, slots, surf }) {
    const claim = claimSite(ctx, k, slots, surf);
    if (claim) {
      slots.mark(claim.at.x - 4, claim.at.x - 1);
      slots.mark(claim.at.x + claim.at.w, claim.at.x + claim.at.w + 8);
    }
    return claim;
  },
  crown({ g, rng, k, style, surf: floor, state: { ceil }, gaps: vats, claim }) {
    const { W } = k;
    const lm = claim ? [claim.at.x - 1, claim.at.x + claim.at.w] : null;
    // Catwalks: one-way girders hung from the ceiling, never across hard vats' full width.
    const nWalks = k.count(style === 'assembly' ? rng.int(2, 3) : rng.int(0, 2));
    const rise = easyRise();
    for (let i = 0; i < nWalks; i++) {
      const len = rng.int(7, 14);
      const x0 = rng.int(6, W - 7 - len);
      const y = floor[x0] - rise * rng.int(2, 3) - (i % 2 === 0 ? 0 : 1);
      const x1 = x0 + len - 1;
      if (y <= ceil + 3) continue;
      if (vats.some((v) => v.hard && x1 >= v.x0 - 5 && x0 <= v.x1 + 5)) continue; // no flying over a hard vat
      if (g.crossings.some(([a, b]) => x1 >= a - 5 && x0 <= b + 5)) continue;
      if (lm && x1 >= lm[0] && x0 <= lm[1]) continue; // nor into the landmark
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
        // Nothing hangs over a landmark: it opened its own sky, and a duct there would hang from nothing.
        if (lm && x + 1 >= lm[0] && x <= lm[1]) continue;
        if (g.empty(x, ceil + len + 3)) g.fill(x, ceil + 1, x + rng.int(0, 1), ceil + len);
      }
    }
  },
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
