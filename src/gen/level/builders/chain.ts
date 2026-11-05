import { finish, Grid, hintGap } from '../kit';
import { knobs, rollChallenges } from '../sculptors/common';
import type { ChainCourse, ChainKit } from '../sets/types';
import type { SculptCtx, Shape } from '../types';

/**
 * The course builder's plan for a set of bodies over a drop (ChainKit): the kit lays out its bodies and the voids
 * between them, hard ones sized to need parts; the builder gives the spare columns to a dock at each end (a pocket
 * each), sets the docks' rows on the route's ramp, builds every body left to right on the deck row the kit picks,
 * and hints every hard void a bridge. Spawn on the left dock, flag on the right one.
 */
export function sculptChain<S>(ctx: SculptCtx, kit: ChainKit<S>): Shape {
  if (ctx.concept && kit.stage) return kit.stage(ctx);
  const { rng, attempt } = ctx;
  const k = knobs(ctx, kit.maxClimb);
  const { W, H } = k;
  const style = kit.style(rng, k, ctx);
  const g = new Grid(W, H);
  const base = H - rng.int(kit.depth[0], kit.depth[1]);
  const asked = rollChallenges(attempt, k);
  const challenges = kit.parts ? kit.parts(asked, k) : asked;
  g.wantsProps = challenges > 0;
  const plan = kit.layout(rng, k, style, challenges, base);
  const { bodies, gaps, hard } = plan;
  const d = kit.dock;
  const at = (row: number) => ({ row: row - 1, ...(d.depth ? { depth: d.depth } : {}) });
  let docks = plan.docks;
  if (!docks) {
    const used = bodies.reduce((a, b) => a + b.w, 0) + gaps.reduce((a, b) => a + b, 0);
    const l = Math.max(d.min, Math.min(W - used - d.min, Math.floor((W - used) * rng.range(0.4, 0.6))));
    const clamp = (row: number) => Math.max(d.clamp[0], Math.min(H - d.clamp[1], row));
    docks = { l, r: W - used - l, sTop: clamp(base + k.ramp(0)), gTop: clamp(base + k.ramp(W - 1) + rng.int(-2, 1)) };
    if (docks.r < d.min) return finish(g, at(docks.sTop), at(docks.gTop), `${kit.name}:broken`);
  }
  const { l: dockL, r: dockR, sTop, gTop } = docks;
  const c: ChainCourse<S> = { ctx, rng, k, g, style, base, challenges, state: plan.state, dockL, dockR, sTop, gTop, tops: [], voids: [] };
  if (dockL > 0) d.build(g, rng, 0, dockL - 1, sTop, 'left', c);
  if (dockR > 0) d.build(g, rng, W - dockR, W - 1, gTop, 'right', c);
  let x = dockL;
  let prev = sTop;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    const x0 = x + gaps[i];
    const deck = kit.deck(rng, b, i, x, x0, prev, c);
    if (hard[i]) hintGap(g, x, x0 - 1, Math.max(prev, deck));
    c.voids.push({ a: x, b: x0 - 1, hard: hard[i] });
    prev = kit.body(g, rng, b, i, x0, deck, hard[i], c);
    c.tops.push({ x: x0, w: b.w, top: deck });
    x = x0 + b.w;
  }
  if (hard[bodies.length]) hintGap(g, x, W - dockR - 1, Math.max(prev, gTop));
  c.voids.push({ a: x, b: W - dockR - 1, hard: hard[bodies.length] });
  kit.dress?.(c);
  return finish(g, at(sTop), at(gTop), `${kit.name}:${style}`);
}
