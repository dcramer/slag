import type { Rng } from '../../../core/rng';
import { jungleOwns } from '../../stage/jungle';
import { carveCorridor, type Grid, noise1D, noise2D, smoothCA } from '../kit';
import { claimFlatSite, easyRise } from '../sculptors/common';
import type { CourseKit, Stamp } from './types';

/** An overgrown stepped ziggurat, standing on ground levelled under its whole width. */
const TEMPLE: Stamp<unknown> = { w: (rng) => rng.pick([13, 15, 17]), stamp: (g, rng, x, w, f) => ziggurat(g, rng, x, w, f) };

/**
 * Jungle: organic everything. A cellular-automaton canopy hangs from the top
 * with vines; giant edge trees hold the spawn and goal in hollows; mid-map
 * trees have round crowns and one-way branch perches; fallen logs bridge
 * pools (a broken log is the bridge challenge); 'temple' raises an overgrown
 * stepped ziggurat; 'grotto' replaces the heightmap with a CA terrain full
 * of overhangs and undercuts, threaded by a carved walkway. A stage concept's landmark (stage/jungle.ts)
 * claims its site first and owns the level's hard crossing (or both, where its box made room for a two-part
 * one); the canopy stays off it.
 */
export const JUNGLE_COURSE: CourseKit = {
  name: 'jungle',
  // A landmark brings its own temple, and a grotto's rock would bury it.
  styles: (k, ctx) => [
    ['canopy', 3],
    ['temple', ctx.concept ? 0 : 2],
    ['grotto', ctx.concept ? 0 : 1 + 3 * k.density],
  ],
  ground: {
    profile(rng, k) {
      const base = k.H - rng.int(5, 8);
      const surf = noise1D(rng, k.W, rng.int(8, 14), 3, 0.5).map((v, x) => Math.max(6, Math.min(k.H - 3, Math.round(base + k.ramp(x) + v * 4))));
      return { surf, state: undefined };
    },
    pockets: 'early',
    step: () => 1,
    lay({ g, rng, k, style, surf, sRow, gRow }) {
      const { W, H } = k;
      if (style !== 'grotto') {
        for (let x = 0; x < W; x++) g.fill(x, surf[x], x, H - 1);
        return;
      }
      // Thresholded 2-D noise around a raised surface line: rock lumps with overhangs and undercuts.
      const n = noise2D(rng, W, H, rng.int(5, 7), 2);
      const m = new Uint8Array(W * H);
      for (let y = 4; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = (y - (surf[x] - 3)) / 4 + n[y * W + x] * 1.6 > 0 ? 1 : 0;
      const sm = smoothCA(W, H, m, 2, 5, 4, 0);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (sm[y * W + x]) g.set(x, y, 1);
      for (let x = 0; x < W; x++) g.fill(x, surf[x] + 2, x, H - 1);
      carveCorridor(g, rng, 0, sRow - 1, W - 1, gRow - 1, 3, 0.3);
    },
  },
  // Pools: hard ones get a broken log, easy ones now and then a whole one, or stones.
  gap: {
    pad: () => 0,
    margin: 3,
    range: [8, 9],
    bank: () => 2,
    sample: 1,
    sink: false,
    keepClear: true,
    dress(g, rng, p, row) {
      if (!p.stones.length) logBridge(g, rng, p.x0, p.x1, row, p.hard);
    },
  },
  stamps: {
    bag: (_rng, k, style) => Array.from({ length: style === 'temple' ? Math.max(1, Math.round(k.wide * 0.7)) : 0 }, () => TEMPLE),
    margin: 1,
    level: 'inner',
  },
  site: (c) => claimFlatSite(c.ctx, c.k, c.slots, c.surf, c.locked),
  owns: jungleOwns,
  // Mid-map trees on free ground.
  standing: [
    {
      count: (rng, k, style) => k.count(style === 'canopy' ? rng.int(2, 3) : rng.int(0, 1)),
      margin: 1,
      stamp: { w: (rng) => rng.pick([7, 9]), stamp: (g, rng, x, w, _f, c) => tree(g, rng, x, w, c.surf) },
    },
  ],
  crown({ g, rng, k, style, surf, claim, sRow, gRow }, lm) {
    const { W } = k;
    // Canopy band: dense jungles hang it lower; sparse ones open up to the sky. Never over the landmark.
    const off: [number, number] = lm ? [lm.rect.x - 2, lm.rect.x + lm.rect.w + 1] : [W, W];
    if (k.density > 0.25 || rng.chance(0.5)) canopy(g, rng, Math.round((style === 'grotto' ? rng.int(4, 5) : rng.int(5, 8)) * (0.6 + 0.6 * k.density)), off);
    edgeTree(g, rng, 0, sRow - 1);
    edgeTree(g, rng, W - 3, gRow - 1);
    // Floating mossy islands.
    for (let i = claim ? 0 : k.count(rng.int(0, 2)); i > 0; i--) {
      const x = rng.int(8, W - 14);
      const y = surf[x] - rng.int(8, 12);
      if (y < 5) continue;
      const w = rng.int(3, 6);
      let clean = true;
      for (let yy = y - 4; yy <= y + 4 && clean; yy++) for (let xx = x - 2; xx <= x + w + 1; xx++) if (!g.empty(xx, yy)) clean = false;
      if (!clean) continue;
      g.fill(x, y, x + w - 1, y);
      g.fill(x + 1, y + 1, x + w - 2, y + 1);
    }
  },
};

/** CA canopy band hanging from the top edge, with vine one-ways dangling from it, none of it in columns `off[0]..off[1]`. */
function canopy(g: Grid, rng: Rng, depth: number, off: readonly [number, number]): void {
  const W = g.w;
  const H = g.h;
  const m = new Uint8Array(W * H);
  for (let y = 0; y <= depth + 1; y++)
    for (let x = 0; x < W; x++) {
      const p = y < 2 ? 0.95 : 0.72 - (y / depth) * 0.55;
      m[y * W + x] = rng.chance(p) ? 1 : 0;
    }
  const s = smoothCA(W, H, m, 3, 5, 4, 0);
  const out = (x: number) => x < off[0] || x > off[1];
  for (let y = 0; y <= depth + 1; y++) for (let x = 0; x < W; x++) if (s[y * W + x] && out(x) && g.empty(x, y + 3)) g.set(x, y, 1);
  // Vines: one-way rungs hanging below the canopy's lowest lumps.
  for (let i = rng.int(1, 3); i > 0; i--) {
    const x = rng.int(6, W - 8);
    const y = g.surface(x) - 0;
    if (y > depth + 2 || y < 1 || !out(x - 1) || !out(x + 1)) continue;
    const len = rng.int(2, 4);
    if (!g.empty(x, y + len + 3)) continue;
    g.plank(x - 1, x + 1, y + len);
  }
}

/** Giant tree framing a pocket: a 3-wide trunk from the top to the ground, its hollow holding the pocket. */
function edgeTree(g: Grid, rng: Rng, x: number, row: number): void {
  const top = 0;
  g.fill(x, top, x + 2, row + 1);
  // Branch perch out of the trunk toward the map.
  const dir = x === 0 ? 1 : -1;
  const by = row - easyRise() - rng.int(1, 3);
  if (by > 3) g.plank(dir > 0 ? x + 3 : x - 3, dir > 0 ? x + 5 : x - 1, by);
}

/** Round-crowned tree with branch perches up its left side. */
function tree(g: Grid, rng: Rng, x: number, w: number, surf: number[]): void {
  const mid = x + (w >> 1);
  const f = surf[mid];
  const rise = easyRise();
  const trunkH = rise + rng.int(1, 2);
  const cb = f - trunkH; // crown bottom row
  g.fill(mid, cb, mid, f - 1);
  if (w >= 9) g.fill(mid + 1, cb, mid + 1, f - 1);
  const ch = rng.int(3, 4);
  for (let i = 0; i < ch; i++) {
    const inset = i === 0 || i === ch - 1 ? 1 : 0;
    g.fill(x + inset, cb - i, x + w - 1 - inset, cb - i);
  }
  g.plank(x - 2, x - 1, f - rise);
  if (rng.chance(0.5)) g.plank(x + w, x + w + 1, cb - 1);
}

/** Fallen log over a pool: a 2-thick trunk with a root ball; hard pools only get the broken stubs. */
function logBridge(g: Grid, rng: Rng, a: number, b: number, row: number, hard: boolean): void {
  if (hard) {
    if (rng.chance(0.6)) {
      g.fill(a - 2, row - 2, a, row - 1); // root ball on the near bank
      g.set(a, row - 3, 1);
    }
    return;
  }
  // Rarely: a log you walk over is a crossing that asks nothing.
  if (!rng.chance(0.2)) return;
  g.fill(a - 1, row - 1, b + 1, row - 1);
  g.fill(a - 2, row - 2, a - 1, row - 1); // root ball
  g.set(b + 1, row - 2, 2);
}

/** Overgrown stepped ziggurat with a shrine on top and a tunnel through its base. */
function ziggurat(g: Grid, rng: Rng, x: number, w: number, f: number): void {
  const step = 2;
  let a = x;
  let b = x + w - 1;
  let y = f - 1;
  while (b - a >= 4) {
    g.fill(a, y - step + 1, b, y);
    y -= step;
    a += 2;
    b -= 2;
  }
  // Shrine with a doorway.
  g.fill(a, y - 2, b, y);
  g.clear(a + 1, y - 1, b - 1, y);
  g.fill(a - 1, y - 3, b + 1, y - 3);
  // Moss lumps.
  for (let i = 0; i < 3; i++) {
    const mx = rng.int(x, x + w - 1);
    const my = g.surface(mx);
    if (my < g.h && my > 2 && g.empty(mx, my - 2)) g.set(mx, my - 1, 2);
  }
}
