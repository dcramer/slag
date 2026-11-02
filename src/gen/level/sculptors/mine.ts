import { carveCorridor, finish, Grid, hintGap, noise2D, smoothCA } from '../kit';
import type { Sculptor } from '../types';
import { easyGap, easyRise, H, hardGap, rollChallenges, W } from './common';

type MineStyle = 'galleries' | 'cavern' | 'shafts';

/**
 * Mine: solid rock carved from the inside. Noise caverns with a rough,
 * CA-smoothed ceiling; tunnels on two levels joined by vertical shafts with
 * staggered one-way beam rungs; one-way timber cap beams hung under the
 * ceiling; flat rail ledges with sleepers across big caverns; chasms that
 * drop through the floor into the abyss (the bridge challenge).
 */
export const mine: Sculptor = ({ rng, attempt }) => {
  const style = rng.weighted<MineStyle>([
    ['galleries', 3],
    ['cavern', 3],
    ['shafts', 2],
  ]);
  const g = new Grid();
  g.fill(0, 0, W - 1, H - 1);
  const rise = easyRise();

  // Background caverns from thresholded noise, roughened by CA.
  const n = noise2D(rng, rng.int(5, 8), 2);
  const thr = style === 'cavern' ? 0.05 : 0.3;
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const edge = y < 2 || y > H - 3;
      m[y * W + x] = edge || n[y * W + x] < thr || rng.chance(0.06) ? 1 : 0;
    }
  const sm = smoothCA(m, 3, 5, 4, 1);
  for (let i = 0; i < W * H; i++) if (!sm[i]) g.t[i] = 0;

  // Tunnel levels: segments alternate between an upper and a lower floor row.
  const upper = rng.int(8, 12);
  const lower = rng.int(upper + 8, Math.min(H - 4, upper + 12));
  const nSeg = style === 'shafts' ? 3 : style === 'galleries' ? 2 : 1;
  const startUpper = rng.chance(0.5);
  const cuts: number[] = [0];
  for (let i = 1; i < nSeg; i++) cuts.push(Math.round((W * i) / nSeg) + rng.int(-3, 3));
  cuts.push(W - 1);
  const rows: number[] = [];
  for (let i = 0; i < nSeg; i++) {
    const isUpper = (i % 2 === 0) === startUpper;
    const row = (isUpper ? upper : lower) + rng.int(-1, 1);
    const end = i === nSeg - 1 ? cuts[i + 1] : cuts[i + 1] + 2;
    const r = carveCorridor(g, rng, cuts[i], row, end, row + rng.int(-1, 1), style === 'cavern' ? rng.int(5, 6) : rng.int(4, 5), 0.25);
    for (let x = cuts[i]; x <= end; x++) if (!Number.isNaN(r[x])) rows[x] = r[x];
  }
  // Shafts joining consecutive segments; going up needs staggered rungs.
  for (let i = 1; i < nSeg; i++) {
    const sx = cuts[i] - 2;
    const yA = rows[sx - 1];
    const yB = rows[cuts[i] + 3];
    const top = Math.min(yA, yB) - 3;
    const bot = Math.max(yA, yB);
    g.clear(sx, top, sx + 4, bot);
    g.fill(sx, bot + 1, sx + 4, bot + 1, 1, true);
    let left = true;
    for (let y = bot - rise; y > top + 1; y -= rise) {
      g.plank(left ? sx : sx + 3, left ? sx + 1 : sx + 4, y);
      left = !left;
    }
    // Head frame beam across the shaft top.
    g.plank(sx - 1, sx + 5, top - 1);
  }

  // Chasms in the floors (never in a shaft): hard ones need a bridge.
  const challenges = rollChallenges(rng, 0.55, 0.25, attempt);
  const taken: [number, number][] = cuts.slice(1, -1).map((c) => [c - 4, c + 4]);
  for (let i = 0; i < challenges + rng.int(0, 1); i++) {
    const hard = i < challenges;
    const w = hard ? hardGap(rng) : easyGap(rng, 2);
    for (let tries = 0; tries < 40; tries++) {
      const a = rng.int(7, W - 8 - w);
      const b = a + w - 1;
      if (taken.some(([t0, t1]) => b + 3 >= t0 && a - 3 <= t1)) continue;
      const row = rows[a - 1];
      if (rows[a - 1] === undefined || Number.isNaN(row) || Number.isNaN(rows[b + 1]) || Math.abs(rows[b + 1] - row) > 2) continue;
      g.clear(a, row - 3, b, H - 1);
      if (hard) hintGap(g, a, b, row + 1);
      taken.push([a, b]);
      break;
    }
  }

  // Timber: cap beams under the ceiling, rail ledges across caverns.
  for (let x = rng.int(6, 9); x < W - 6; x += rng.int(6, 9)) {
    const fy = rows[x];
    if (Number.isNaN(fy)) continue;
    let cy = fy - 1;
    while (cy > 0 && g.empty(x, cy)) cy--;
    if (fy - cy < 5) continue;
    g.plank(x - 1, x + 1, cy + 1);
    g.set(x - 1, cy, 1);
  }
  if (style !== 'shafts') {
    for (let k = rng.int(1, 2); k > 0; k--) {
      const len = rng.int(6, 10);
      const x0 = rng.int(6, W - 7 - len);
      const y = rng.int(5, H - 8);
      let clean = true;
      for (let yy = y - 3; yy <= y + 2 && clean; yy++) for (let xx = x0 - 1; xx <= x0 + len; xx++) if (!g.empty(xx, yy)) clean = false;
      if (!clean) continue;
      g.fill(x0, y, x0 + len - 1, y);
      for (let xx = x0; xx < x0 + len; xx += 2) g.set(xx, y + 1, 1); // sleepers / trestle
    }
  }

  const sRow = rows[2];
  const gRow = rows[W - 3];
  return finish(g, { row: sRow }, { row: gRow }, `mine:${style}`);
};
