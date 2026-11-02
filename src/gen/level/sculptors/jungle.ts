import type { Rng } from '../../../core/rng';
import { jungleOwns } from '../../stage/jungle';
import { carveCorridor, finish, Grid, noise1D, noise2D, smoothCA } from '../kit';
import type { SculptCtx, Sculptor } from '../types';
import {
  type Claim,
  claimSite,
  easyGap,
  easyRise,
  flatten,
  hardGap,
  type Knobs,
  knobs,
  pit,
  raiseLandmark,
  relax,
  keepClear,
  rollChallenges,
  Slots,
} from './common';
import { jungleTall } from './tall';

type JungleStyle = 'canopy' | 'temple' | 'grotto';

/**
 * Jungle: organic everything. A cellular-automaton canopy hangs from the top
 * with vines; giant edge trees hold the spawn and goal in hollows; mid-map
 * trees have round crowns and one-way branch perches; fallen logs bridge
 * pools (a broken log is the bridge challenge); 'temple' raises an overgrown
 * stepped ziggurat; 'grotto' replaces the heightmap with a CA terrain full
 * of overhangs and undercuts, threaded by a carved walkway. A stage concept's landmark (stage/jungle.ts)
 * claims its site first and owns the level's hard crossing; the canopy stays off it.
 */
export const jungle: Sculptor = (ctx) => {
  if (ctx.profile.size === 'tall') return jungleTall(ctx);
  const { rng, attempt } = ctx;
  const k = knobs(ctx);
  const { W, H } = k;
  // A landmark brings its own temple, and a grotto's rock would bury it.
  const style = rng.weighted<JungleStyle>([
    ['canopy', 3],
    ['temple', ctx.concept ? 0 : 2],
    ['grotto', ctx.concept ? 0 : 1 + 3 * k.density],
  ]);
  const g = new Grid(W, H);
  const slots = new Slots(6, W - 7);
  const base = H - rng.int(5, 8);
  const surf = noise1D(rng, W, rng.int(8, 14), 3, 0.5).map((v, x) => Math.max(6, Math.min(H - 3, Math.round(base + k.ramp(x) + v * 4))));
  const locked = new Uint8Array(W);
  const sRow = surf[2];
  const gRow = surf[W - 3];
  for (let x = 0; x < 6; x++) surf[x] = sRow;
  for (let x = W - 6; x < W; x++) surf[x] = gRow;
  locked.fill(1, 0, 6);
  locked.fill(1, W - 6, W);
  // The stage concept's landmark comes first; it owns one crossing, or both where its box made room for a two-part one.
  const claim = ctx.concept ? claimJungleSite(ctx, k, slots, surf, locked) : null;
  if (ctx.concept && !claim) return finish(g, { row: sRow - 1 }, { row: gRow - 1 }, 'jungle:unclaimed');

  // Pools: hard ones get a broken log, easy ones sometimes a whole log.
  const challenges = rollChallenges(attempt, k);
  g.wantsProps = challenges > 0;
  const own = claim ? jungleOwns(claim.concept, k, attempt, challenges) : 0;
  const hardLeft = Math.max(0, challenges - own);
  const pools: { a: number; b: number; hard: boolean }[] = [];
  for (let i = 0; i < hardLeft + k.count(rng.int(0, 2)); i++) {
    const hard = i < hardLeft;
    const w = hard ? hardGap(rng) : easyGap(rng, 2);
    const a = slots.take(rng, w, 3, 8, W - 9);
    if (a === null) continue;
    if (hard) keepClear(slots, a, w);
    const bank = Math.max(surf[a - 1], surf[a + w]);
    for (let x = a - 2; x <= a + w + 1; x++) {
      surf[x] = bank;
      locked[x] = 1;
    }
    pools.push({ a, b: a + w - 1, hard });
  }
  const temples: { x: number; w: number }[] = [];
  for (let n = style === 'temple' ? Math.max(1, Math.round(k.wide * 0.7)) : 0; n > 0; n--) {
    const w = rng.pick([13, 15, 17]);
    const x = slots.take(rng, w, 1);
    if (x !== null) {
      temples.push({ x, w });
      const row = Math.max(...surf.slice(x, x + w));
      for (let i = x - 1; i <= x + w; i++) {
        surf[i] = row;
        locked[i] = 1;
      }
    }
  }
  relax(surf, H, locked, 1);

  if (style === 'grotto') {
    // Thresholded 2-D noise around a raised surface line: rock lumps with overhangs and undercuts.
    const n = noise2D(rng, W, H, rng.int(5, 7), 2);
    const m = new Uint8Array(W * H);
    for (let y = 4; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = (y - (surf[x] - 3)) / 4 + n[y * W + x] * 1.6 > 0 ? 1 : 0;
    const sm = smoothCA(W, H, m, 2, 5, 4, 0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (sm[y * W + x]) g.set(x, y, 1);
    for (let x = 0; x < W; x++) g.fill(x, surf[x] + 2, x, H - 1);
    carveCorridor(g, rng, 0, sRow - 1, W - 1, gRow - 1, 3, 0.3);
  } else {
    for (let x = 0; x < W; x++) g.fill(x, surf[x], x, H - 1);
  }
  for (const p of pools) {
    const row = surf[p.a - 1];
    pit(g, p.a, p.b, row, p.hard);
    logBridge(g, rng, p.a, p.b, row, p.hard);
  }
  for (const t of temples) ziggurat(g, rng, t.x, t.w, surf[t.x]);

  // Mid-map trees on free ground.
  const nTrees = k.count(style === 'canopy' ? rng.int(2, 3) : rng.int(0, 1));
  for (let i = 0; i < nTrees; i++) {
    const w = rng.pick([7, 9]);
    const x = slots.take(rng, w, 1);
    if (x === null) continue;
    tree(g, rng, x, w, surf);
  }

  const lm = claim ? raiseLandmark(g, ctx, claim, own) : null;
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

  return finish(g, { row: sRow - 1 }, { row: gRow - 1 }, `jungle:${style}`);
};

/**
 * The landmark's site (claimSite), on ground levelled a couple of columns past it either side and never so
 * low that its river has no bank under it. Nothing else lands within a running jump of its far side, where
 * a pool could be cleared bare off its top.
 */
function claimJungleSite(ctx: SculptCtx, k: Knobs, slots: Slots, surf: number[], locked: Uint8Array): Claim | null {
  const claim = claimSite(ctx, k, slots, surf, locked);
  if (!claim) return null;
  const { x, w } = claim.at;
  const ground = Math.min(claim.ground, k.H - 5);
  slots.mark(x - 3, x + w + 8);
  flatten(surf, k.H, x - 2, x + w + 1, ground);
  for (let i = Math.max(0, x - 3); i <= Math.min(k.W - 1, x + w + 2); i++) locked[i] = 1;
  return { ...claim, ground, at: { ...claim.at, y: ground - claim.at.h } };
}

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
  if (!rng.chance(0.5)) return;
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
