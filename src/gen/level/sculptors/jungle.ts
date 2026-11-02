import type { Rng } from '../../../core/rng';
import { carveCorridor, finish, Grid, noise1D, noise2D, smoothCA } from '../kit';
import type { Sculptor } from '../types';
import { easyGap, easyRise, H, hardGap, pit, relax, rollChallenges, Slots, W } from './common';

type JungleStyle = 'canopy' | 'temple' | 'grotto';

/**
 * Jungle: organic everything. A cellular-automaton canopy hangs from the top
 * with vines; giant edge trees hold the spawn and goal in hollows; mid-map
 * trees have round crowns and one-way branch perches; fallen logs bridge
 * pools (a broken log is the bridge challenge); 'temple' raises an overgrown
 * stepped ziggurat; 'grotto' replaces the heightmap with a CA terrain full
 * of overhangs and undercuts, threaded by a carved walkway.
 */
export const jungle: Sculptor = ({ rng, attempt }) => {
  const style = rng.weighted<JungleStyle>([
    ['canopy', 3],
    ['temple', 2],
    ['grotto', 3],
  ]);
  const g = new Grid();
  const slots = new Slots();
  const base = rng.int(19, 22);
  const surf = noise1D(rng, W, rng.int(8, 14), 3, 0.5).map((v) => Math.max(13, Math.min(24, Math.round(base + v * 4))));
  const locked = new Uint8Array(W);
  const sRow = surf[2];
  const gRow = surf[W - 3];
  for (let x = 0; x < 6; x++) surf[x] = sRow;
  for (let x = W - 6; x < W; x++) surf[x] = gRow;
  locked.fill(1, 0, 6);
  locked.fill(1, W - 6, W);

  // Pools: hard ones get a broken log, easy ones sometimes a whole log.
  const challenges = rollChallenges(rng, 0.82, 0.15, attempt);
  g.wantsProps = challenges > 0;
  const pools: { a: number; b: number; hard: boolean }[] = [];
  for (let i = 0; i < challenges + rng.int(0, 2); i++) {
    const hard = i < challenges;
    const w = hard ? hardGap(rng) : easyGap(rng, 2);
    const a = slots.take(rng, w, 3, 8, W - 9);
    if (a === null) continue;
    const bank = Math.max(surf[a - 1], surf[a + w]);
    for (let x = a - 2; x <= a + w + 1; x++) {
      surf[x] = bank;
      locked[x] = 1;
    }
    pools.push({ a, b: a + w - 1, hard });
  }
  let temple: { x: number; w: number } | null = null;
  if (style === 'temple') {
    const w = rng.pick([13, 15, 17]);
    const x = slots.take(rng, w, 1);
    if (x !== null) {
      temple = { x, w };
      const row = Math.max(...surf.slice(x, x + w));
      for (let i = x - 1; i <= x + w; i++) {
        surf[i] = row;
        locked[i] = 1;
      }
    }
  }
  relax(surf, locked, 1);

  if (style === 'grotto') {
    // Thresholded 2-D noise around a raised surface line: rock lumps with overhangs and undercuts.
    const n = noise2D(rng, rng.int(5, 7), 2);
    const m = new Uint8Array(W * H);
    for (let y = 8; y < H; y++) for (let x = 0; x < W; x++) m[y * W + x] = (y - (surf[x] - 3)) / 4 + n[y * W + x] * 1.6 > 0 ? 1 : 0;
    const sm = smoothCA(m, 2, 5, 4, 0);
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
  if (temple) ziggurat(g, rng, temple.x, temple.w, surf[temple.x]);

  // Mid-map trees on free ground.
  const nTrees = style === 'canopy' ? rng.int(2, 3) : rng.int(0, 1);
  for (let i = 0; i < nTrees; i++) {
    const w = rng.pick([7, 9]);
    const x = slots.take(rng, w, 1);
    if (x === null) continue;
    tree(g, rng, x, w, surf);
  }

  canopy(g, rng, style === 'grotto' ? rng.int(4, 5) : rng.int(5, 8));
  edgeTree(g, rng, 0, sRow - 1);
  edgeTree(g, rng, W - 3, gRow - 1);
  // Floating mossy islands.
  for (let i = rng.int(0, 2); i > 0; i--) {
    const x = rng.int(8, W - 14);
    const y = rng.int(9, 13);
    const w = rng.int(3, 6);
    let clean = true;
    for (let yy = y - 4; yy <= y + 4 && clean; yy++) for (let xx = x - 2; xx <= x + w + 1; xx++) if (!g.empty(xx, yy)) clean = false;
    if (!clean) continue;
    g.fill(x, y, x + w - 1, y);
    g.fill(x + 1, y + 1, x + w - 2, y + 1);
  }

  return finish(g, { row: sRow - 1 }, { row: gRow - 1 }, `jungle:${style}`);
};

/** CA canopy band hanging from the top edge, with vine one-ways dangling from it. */
function canopy(g: Grid, rng: Rng, depth: number): void {
  const m = new Uint8Array(W * H);
  for (let y = 0; y <= depth + 1; y++)
    for (let x = 0; x < W; x++) {
      const p = y < 2 ? 0.95 : 0.72 - (y / depth) * 0.55;
      m[y * W + x] = rng.chance(p) ? 1 : 0;
    }
  const s = smoothCA(m, 3, 5, 4, 0);
  for (let y = 0; y <= depth + 1; y++) for (let x = 0; x < W; x++) if (s[y * W + x] && g.empty(x, y + 3)) g.set(x, y, 1);
  // Vines: one-way rungs hanging below the canopy's lowest lumps.
  for (let i = rng.int(1, 3); i > 0; i--) {
    const x = rng.int(6, W - 8);
    const y = g.surface(x) - 0;
    if (y > depth + 2 || y < 1) continue;
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
    if (my < H && my > 2 && g.empty(mx, my - 2)) g.set(mx, my - 1, 2);
  }
}
