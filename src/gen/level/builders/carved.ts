import { carveCorridor, finish, Grid, hintGap } from '../kit';
import { easyRise, jumpCount, knobs, rollChallenges } from '../sculptors/common';
import type { CarvedKit } from '../sets/types';
import type { SculptCtx, Shape } from '../types';

/**
 * The course builder's plan for a set cut from solid rock (CarvedKit): fill the level, let the kit hollow it,
 * carve tunnel floors on two levels (alternating on a course; stepping up a climb or down a descent), join each
 * pair with the kit's connector, then cut chasms in the floors, never in a shaft, sealing the rock over a hard
 * one and cutting back its far lip so it can't be gone over or climbed out of.
 */
export function sculptCarved(ctx: SculptCtx, kit: CarvedKit): Shape {
  if (ctx.concept && kit.stage) return kit.stage(ctx);
  const { rng, attempt } = ctx;
  const k = knobs(ctx);
  const { W, H } = k;
  const style = rng.weighted(kit.styles(k, ctx));
  const g = new Grid(W, H);
  g.carve = true;
  g.fill(0, 0, W - 1, H - 1);
  const rise = easyRise();
  kit.rock(g, rng, k, style);

  // Tunnel levels: segments alternate between an upper and a lower floor row
  // (ltr), or step monotonically up (climb) / down (descent) through the rock.
  const upper = Math.max(7, H - rng.int(15, 19));
  const lower = rng.int(upper + 8, Math.min(H - 4, upper + 12));
  const challenges = rollChallenges(attempt, k);
  g.wantsProps = challenges > 0;
  // Wide levels get more segments.
  const per = kit.segments(style, challenges);
  const nSeg = Math.max(1, Math.round(per * k.wide * (k.wide > 1 ? rng.range(0.8, 1.1) : 1)));
  const startUpper = k.route === 'descent' ? true : k.route === 'climb' ? false : rng.chance(0.5);
  const cuts: number[] = [0];
  for (let i = 1; i < nSeg; i++) cuts.push(Math.round((W * i) / nSeg) + rng.int(-3, 3));
  cuts.push(W - 1);
  const rows: number[] = [];
  const mono = (k.route === 'climb' || k.route === 'descent') && nSeg > 1;
  for (let i = 0; i < nSeg; i++) {
    const isUpper = (i % 2 === 0) === startUpper;
    const t = i / Math.max(1, nSeg - 1);
    const monoRow = Math.round(k.route === 'climb' ? lower + (upper - lower) * t : upper + (lower - upper) * t);
    const row = (mono ? monoRow : isUpper ? upper : lower) + rng.int(-1, 1);
    const end = i === nSeg - 1 ? cuts[i + 1] : cuts[i + 1] + 2;
    const r = carveCorridor(g, rng, cuts[i], row, end, row + rng.int(-1, 1), kit.headroom(rng, style), 0.25);
    for (let x = cuts[i]; x <= end; x++) if (!Number.isNaN(r[x])) rows[x] = r[x];
  }
  // Connectors joining consecutive segments.
  for (let i = 1; i < nSeg; i++) {
    const sx = cuts[i] - 2;
    const yA = rows[sx - 1];
    const yB = rows[cuts[i] + 3];
    kit.connector(g, sx, Math.min(yA, yB) - 3, Math.max(yA, yB), rise);
  }

  // Chasms in the floors (never in a shaft): hard ones need a bridge.
  const taken: [number, number][] = cuts.slice(1, -1).map((c) => [c - 3, c + 3]);
  for (let i = 0, n = challenges + jumpCount(rng, k); i < n; i++) {
    const hard = i < challenges;
    const w = kit.chasm(rng, hard);
    for (let tries = 0; tries < 60; tries++) {
      const a = rng.int(6, W - 7 - w);
      const b = a + w - 1;
      if (taken.some(([t0, t1]) => b + 1 >= t0 && a - 1 <= t1)) continue;
      const row = rows[a - 1];
      if (rows[a - 1] === undefined || Number.isNaN(row) || Number.isNaN(rows[b + 1]) || Math.abs(rows[b + 1] - row) > 2) continue;
      g.clear(a, row - 3, b, H - 1);
      if (hard) {
        // Seal the rock above so there is no high route over the chasm.
        for (let x = a - 3; x <= b + 3; x++) {
          const top = x >= a && x <= b ? Math.min(rows[a - 1], rows[b + 1]) - 4 : rows[x] - 5;
          if (!Number.isNaN(top)) g.fill(x, 0, x, top, 1, true);
        }
        // Undercut the far lip: a climber coming up the far wall from the depths meets a ceiling.
        g.clear(b + 1, rows[b + 1] + 3, b + 4, H - 1);
        hintGap(g, a, b, row + 1);
      }
      taken.push([a, b]);
      break;
    }
  }
  kit.dress?.(g, rng, k, style, rows);
  return finish(g, { row: rows[2] }, { row: rows[W - 3] }, `${kit.name}:${style}`);
}
