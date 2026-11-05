import { mineOwns } from '../../stage/mine';
import { finish, Grid, groundFromHeights, hintGap, noise1D, noise2D, smoothCA } from '../kit';
import { jumpProfile } from '../probe';
import type { SculptCtx, Shape } from '../types';
import type { CarvedKit } from './types';
import { claimFlatSite, hardGap, jumpGap, keepClear, knobs, raiseLandmark, relax, rollChallenges, Slots, undercut } from '../sculptors/common';

/**
 * Mine: solid rock carved from the inside. Noise caverns with a rough,
 * CA-smoothed ceiling; tunnels on two levels joined by vertical shafts with
 * staggered one-way beam rungs; one-way timber cap beams hung under the
 * ceiling; flat rail ledges with sleepers across big caverns; chasms that
 * drop through the floor into the abyss (the bridge challenge).
 */
export const MINE_CARVED: CarvedKit = {
  name: 'mine',
  styles: (k) => [
    ['galleries', 3],
    ['cavern', 4 - 2 * k.density],
    ['shafts', 1 + 2 * k.density],
  ],
  // Background caverns from thresholded noise, roughened by CA.
  rock(g, rng, k, style) {
    const { W, H } = k;
    const n = noise2D(rng, W, H, rng.int(5, 8), 2);
    // Sparse mines are hollowed out into big caverns; dense ones stay mostly rock.
    const thr = (style === 'cavern' ? 0.05 : 0.3) + (0.5 - k.density) * 0.3;
    const m = new Uint8Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const edge = y < 2 || y > H - 3;
        m[y * W + x] = edge || n[y * W + x] < thr || rng.chance(0.06) ? 1 : 0;
      }
    const sm = smoothCA(W, H, m, 3, 5, 4, 1);
    for (let i = 0; i < W * H; i++) if (!sm[i]) g.t[i] = 0;
  },
  // Three segments leave no room for a chasm, so a challenged 'shafts' map gets two.
  segments: (style, challenges) => (style === 'shafts' && !challenges ? 3 : style === 'cavern' ? 1 : 2),
  headroom: (rng, style) => (style === 'cavern' ? rng.int(5, 6) : rng.int(4, 5)),
  // A shaft: going up needs staggered rungs, and a head frame beam across its top.
  connector(g, sx, top, bot, rise) {
    g.clear(sx, top, sx + 4, bot);
    g.fill(sx, bot + 1, sx + 4, bot + 1, 1, true);
    let left = true;
    for (let y = bot - rise; y > top + 1; y -= rise) {
      g.plank(left ? sx : sx + 3, left ? sx + 1 : sx + 4, y);
      left = !left;
    }
    g.plank(sx - 1, sx + 5, top - 1);
  },
  // Hard chasms sit under a low rock ceiling that caps the jump arc, so they need less width than an open-air chasm to be unjumpable.
  chasm(rng, hard) {
    const j = jumpProfile();
    return hard ? rng.int(j.gap + 1, j.gap + 4) : jumpGap(rng, 2, j.gapAt(2));
  },
  // Timber: cap beams under the ceiling, rail ledges across caverns.
  dress(g, rng, k, style, rows) {
    const { W, H } = k;
    for (let x = rng.int(6, 9); x < W - 6; x += rng.int(5, 8) + Math.round((1 - k.density) * 3)) {
      const fy = rows[x];
      if (Number.isNaN(fy)) continue;
      let cy = fy - 1;
      while (cy > 0 && g.empty(x, cy)) cy--;
      if (fy - cy < 5) continue;
      g.plank(x - 1, x + 1, cy + 1);
      g.set(x - 1, cy, 1);
    }
    if (style === 'shafts') return;
    for (let n = k.count(rng.int(1, 2)); n > 0; n--) {
      const len = rng.int(6, 10);
      const x0 = rng.int(6, W - 7 - len);
      const y = rng.int(5, H - 8);
      let clean = true;
      for (let yy = y - 3; yy <= y + 2 && clean; yy++) for (let xx = x0 - 1; xx <= x0 + len; xx++) if (!g.empty(xx, yy)) clean = false;
      if (!clean) continue;
      g.fill(x0, y, x0 + len - 1, y);
      for (let xx = x0; xx < x0 + len; xx += 2) g.set(xx, y + 1, 1); // sleepers / trestle
    }
  },
  stage: (ctx) => mineStage(ctx),
};

/**
 * A mine level built round a stage concept's landmark (gen/stage/mine.ts): one long cavern floor with a
 * rock roof over it, the roof lifted high over the landmark so it stands in a hall of its own, and over
 * any chasm so a jump there is an open-air jump. The landmark owns the level's crossing (or both, where
 * its box made room for a two-part one); a second chasm, where one is still asked for, is dug in the
 * floor elsewhere. Plain mine levels never come here, so they're generated exactly as before.
 */
function mineStage(ctx: SculptCtx): Shape {
  const { rng, attempt } = ctx;
  const k = knobs(ctx, Math.round(ctx.profile.h * 0.22));
  const { W, H } = k;
  const g = new Grid(W, H);
  g.carve = true;
  const slots = new Slots(6, W - 7);
  const base = H - rng.int(4, 6);
  const n = noise1D(rng, W, rng.int(6, 10), 2, 0.5);
  const surf = n.map((v, x) => Math.max(10, Math.min(H - 3, Math.round(base + k.ramp(x) + v * 2.5))));
  const locked = new Uint8Array(W);
  const sRow = surf[2];
  const gRow = surf[W - 3];
  for (let x = 0; x < 6; x++) surf[x] = sRow;
  for (let x = W - 6; x < W; x++) surf[x] = gRow;
  locked.fill(1, 0, 6);
  locked.fill(1, W - 6, W);
  const claim = claimFlatSite(ctx, k, slots, surf, locked, 4, true);
  if (!claim) return finish(g, { row: sRow - 1 }, { row: gRow - 1 }, 'mine:unclaimed');
  const challenges = rollChallenges(attempt, k);
  g.wantsProps = challenges > 0;
  const own = mineOwns(claim.concept, k, attempt, challenges);
  const hardLeft = Math.max(0, challenges - own);
  // A second chasm where one is still asked for, and a hop or two: banks levelled either side.
  const pits: { a: number; b: number; bank: number; hard: boolean; lip: number }[] = [];
  for (let i = 0; i < hardLeft + k.count(rng.int(0, 1)); i++) {
    const hard = i < hardLeft;
    const w = hard ? hardGap(rng) : jumpGap(rng, 2);
    const a = slots.take(rng, w, 3, 8, W - 9);
    if (a === null) continue;
    if (hard) keepClear(slots, a, w);
    const bank = Math.max(surf[a - 1], surf[a + w]);
    const lip = hard ? 4 : 1;
    for (let x = a - lip; x < a + w + lip; x++) {
      surf[x] = x >= a && x < a + w ? H : bank;
      locked[x] = 1;
    }
    pits.push({ a, b: a + w - 1, bank, hard, lip });
  }
  relax(surf, H, locked, 2);
  groundFromHeights(g, surf);
  // The roof: a few rows over the floor, wandering; lifted over the landmark's hall and the chasms.
  const hn = noise1D(rng, W, rng.int(4, 7), 2, 0.6);
  const roof = surf.map((f, x) => (f >= H ? H : f) - Math.max(6, Math.round(7.5 + hn[x] * 2)));
  const { x: lx, y: ly, w: lw } = claim.at;
  for (let x = Math.max(0, lx - 2); x <= Math.min(W - 1, lx + lw + 1); x++) roof[x] = Math.min(roof[x], ly - 2);
  for (const p of pits) for (let x = p.a - p.lip; x <= p.b + p.lip; x++) roof[x] = Math.min(roof[x], p.bank - 8);
  // Never a cliff in the roof: neighbours within three rows, by lifting the lower one.
  for (let pass = 0; pass < 4; pass++)
    for (const dir of [1, -1])
      for (let i = 0; i < W; i++) {
        const x = dir > 0 ? i : W - 1 - i;
        const nb = x - dir;
        if (nb >= 0 && nb < W) roof[x] = Math.min(roof[x], roof[nb] + 3);
      }
  for (let x = 0; x < W; x++) if (roof[x] >= 0) g.fill(x, 0, x, roof[x]);
  // Drips of rock off the roof, away from the landmark and the chasms.
  const busy = (x: number) => (x >= lx - 3 && x <= lx + lw + 2) || pits.some((p) => x >= p.a - p.lip - 1 && x <= p.b + p.lip + 1) || x < 7 || x > W - 8;
  for (let x = rng.int(6, 10); x < W - 6; x += rng.int(4, 9)) {
    if (busy(x) || roof[x] < 0 || surf[x] >= H || surf[x] - roof[x] < 8) continue;
    g.fill(x, roof[x] + 1, x, roof[x] + rng.int(1, 2));
  }
  for (const p of pits) {
    if (!p.hard) continue;
    hintGap(g, p.a, p.b, p.bank);
    undercut(g, p.b + 1, 2, p.bank);
  }
  raiseLandmark(g, ctx, claim, own);
  // Timber cap beams under the roof, clear of the landmark.
  for (let x = rng.int(6, 9); x < W - 6; x += rng.int(5, 8) + Math.round((1 - k.density) * 3)) {
    if (busy(x) || surf[x] >= H || roof[x] < 0) continue;
    const cy = roof[x] + 1;
    if (surf[x] - cy < 6 || !g.empty(x - 1, cy) || !g.empty(x + 1, cy)) continue;
    g.plank(x - 1, x + 1, cy);
  }
  return finish(g, { row: sRow - 1 }, { row: gRow - 1 }, 'mine:stage');
}
