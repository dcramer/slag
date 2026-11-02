import type { Rng } from '../../../core/rng';
import { finish, Grid, hintGap, noise1D } from '../kit';
import type { Sculptor } from '../types';
import { easyGap, easyRise, H, hardGap, pit, relax, rollChallenges, Slots, W } from './common';

type VolcanoStyle = 'spires' | 'caldera' | 'flows';

/**
 * Volcano: jagged, hostile rock. A sawtooth heightmap broken by big lava
 * pits; tapered spires with ragged flanks; basalt organ-pipe clusters (1-wide
 * columns stepping in height); floating rock chunks with dripping undersides
 * as stepping stones over lava lakes ('flows'); or a huge cone with a crater
 * to cross at the top ('caldera').
 */
export const volcano: Sculptor = ({ rng, attempt }) => {
  const style = rng.weighted<VolcanoStyle>([
    ['spires', 3],
    ['caldera', 2],
    ['flows', 3],
  ]);
  const g = new Grid();
  const slots = new Slots();
  const base = rng.int(19, 22);
  const n = noise1D(rng, W, rng.int(5, 8), 3, 0.6);
  const surf = n.map((v, x) => Math.max(12, Math.min(24, Math.round(base + v * 4 + (x % 2 ? rng.int(0, 1) : 0)))));
  const locked = new Uint8Array(W);
  const sRow = surf[2];
  const gRow = surf[W - 3];
  for (let x = 0; x < 6; x++) surf[x] = sRow;
  for (let x = W - 6; x < W; x++) surf[x] = gRow;
  locked.fill(1, 0, 6);
  locked.fill(1, W - 6, W);
  const challenges = rollChallenges(rng, 0.42, 0.25, attempt);
  let hardLeft = challenges;

  // Lava lake with floating stepping stones.
  const stones: { x: number; y: number; w: number }[] = [];
  if (style === 'flows') {
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
      const hardAt = hardLeft > 0 ? rng.int(0, 2) : -1;
      for (let i = 0; px < b - 3; i++) {
        const gap = i === hardAt ? hardGap(rng) : easyGap(rng, 2);
        const w = rng.int(2, 4);
        const x = px + gap + 1;
        if (x + w - 1 > b - 2) break;
        const y = Math.max(bank - 6, Math.min(bank + 1, py + rng.int(-2, 2)));
        if (i === hardAt) {
          hintGap(g, px + 1, x - 1, Math.max(py, y) + 1);
          hardLeft--;
        }
        stones.push({ x, y, w });
        px = x + w - 1;
        py = y;
      }
    }
  }
  // Caldera: a big cone whose crater is the crossing.
  let crater: { a: number; b: number; rim: number } | null = null;
  if (style === 'caldera') {
    const cw = rng.int(22, 28);
    const x = slots.take(rng, cw, 0, 8, W - 9);
    if (x !== null) {
      const mid = x + (cw >> 1);
      const peak = rng.int(9, 12);
      const cr = hardLeft > 0 ? hardGap(rng) : easyGap(rng, 2);
      if (hardLeft > 0) hardLeft--;
      const ca = mid - (cr >> 1);
      const cb = ca + cr - 1;
      for (let i = x; i < x + cw; i++) {
        const d = i < ca ? ca - i : i > cb ? i - cb : 0;
        surf[i] = d === 0 ? H : Math.min(surf[i], peak + Math.floor(d * 0.75) + (d > 2 && rng.chance(0.3) ? 1 : 0));
        locked[i] = 1;
      }
      surf[ca - 1] = surf[cb + 1] = peak;
      crater = { a: ca, b: cb, rim: peak };
    }
  }
  // Remaining lava pits.
  const pits: { a: number; b: number; hard: boolean }[] = [];
  for (let i = 0; i < hardLeft + rng.int(1, 2); i++) {
    const hard = i < hardLeft;
    const w = hard ? hardGap(rng) : easyGap(rng, 2);
    const a = slots.take(rng, w, 3, 8, W - 9);
    if (a === null) continue;
    const bank = Math.max(surf[a - 1], surf[a + w]);
    for (let x = a - 1; x <= a + w; x++) {
      surf[x] = x >= a && x < a + w ? H : bank;
      locked[x] = 1;
    }
    pits.push({ a, b: a + w - 1, hard });
  }
  relax(surf, locked, 2);
  for (let x = 0; x < W; x++) if (surf[x] < H) g.fill(x, surf[x], x, H - 1);
  for (const p of pits) pit(g, p.a, p.b, surf[p.a - 1], p.hard);
  if (crater) {
    pit(g, crater.a, crater.b, crater.rim, true);
    // Jagged rim teeth.
    g.set(crater.a - 1, crater.rim - 1, 1);
    g.set(crater.b + 1, crater.rim - 1, 1);
  }
  for (const s of stones) rock(g, rng, s.x, s.y, s.w);

  // Spires and basalt clusters on the remaining ground.
  const nSpires = style === 'spires' ? rng.int(2, 4) : rng.int(0, 2);
  for (let i = 0; i < nSpires; i++) {
    const w = rng.pick([3, 5, 5, 7]);
    const x = slots.take(rng, w, 1);
    if (x === null) continue;
    spire(g, rng, x, w, surf);
  }
  const nBasalt = style === 'spires' ? rng.int(1, 2) : rng.int(0, 1);
  for (let i = 0; i < nBasalt; i++) {
    const w = rng.int(4, 7);
    const x = slots.take(rng, w, 1);
    if (x === null) continue;
    basalt(g, rng, x, w, surf);
  }
  // Floating chunks in the sky over open ground.
  for (let i = rng.int(0, 2); i > 0; i--) {
    const x = rng.int(8, W - 12);
    const y = rng.int(7, 12);
    let clean = true;
    for (let yy = y - 3; yy <= y + 5 && clean; yy++) for (let xx = x - 2; xx <= x + 6; xx++) if (!g.empty(xx, yy)) clean = false;
    if (clean) rock(g, rng, x, y, rng.int(3, 5));
  }

  return finish(g, { row: sRow - 1 }, { row: gRow - 1 }, `volcano:${style}`);
};

/** Floating rock: flat top at row y, tapering to a dripping point underneath. */
function rock(g: Grid, rng: Rng, x: number, y: number, w: number): void {
  g.fill(x, y, x + w - 1, y);
  if (w >= 3) g.fill(x + 1, y + 1, x + w - 2, y + 1);
  else g.set(x + rng.int(0, 1), y + 1, 1);
  if (w >= 4) g.set(x + rng.int(1, w - 2), y + 2, 1);
}

/** Tapered spire with ragged flanks: steps in by a column every 1–2 rows, topped by a short needle. */
function spire(g: Grid, rng: Rng, x: number, w: number, surf: number[]): void {
  const f = Math.max(...surf.slice(x, x + w).filter((v) => v < H));
  let a = x;
  let b = x + w - 1;
  let y = f - 1;
  const rise = easyRise();
  while (a <= b && y > 4) {
    const h = rng.int(1, Math.min(2, rise));
    g.fill(a, y - h + 1, b, y);
    y -= h;
    // Step in on at least one side every band so the flanks stay climbable.
    const left = rng.chance(0.5);
    if (left || b - a >= 2) a++;
    if (!left || b - a >= 2) b--;
  }
  if (a > b) {
    const mid = x + (w >> 1);
    if (rng.chance(0.6)) g.set(mid, y, 1);
  }
}

/** Basalt organ pipes: adjacent 1-wide columns whose heights step by ±1. */
function basalt(g: Grid, rng: Rng, x: number, w: number, surf: number[]): void {
  let h = rng.int(2, 3);
  for (let i = 0; i < w; i++) {
    const f = surf[x + i];
    if (f >= H) continue;
    g.fill(x + i, f - h, x + i, f - 1);
    h = Math.max(1, Math.min(6, h + rng.pick([-1, 1, 1])));
  }
}
