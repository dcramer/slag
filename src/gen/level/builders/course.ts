import { finish, Grid, groundFromHeights } from '../kit';
import { flatten, hardGap, jumpCount, jumpCrossing, keepClear, knobs, pit, raiseLandmark, relax, rollChallenges, Slots, claimSite } from '../sculptors/common';
import type { Course, CourseKit, Gap, Stamp } from '../sets/types';
import type { SculptCtx, Shape } from '../types';

/**
 * The course builder: a level you run across, spawn on the left, flag on the right, over a set's ground on the
 * route's ramp (flat for a course, rising for a climb, falling for a descent: `knobs`). The builder owns the plan,
 * and the kit (sets/<theme>.ts) every piece of it:
 *
 *   1. the set's style, and its ground profile along the ramp (`ground.profile`)
 *   2. the landmark's site, before anything else (`site`, default `claimSite`)
 *   3. the ask: one part, or two (`rollChallenges`), less what the landmark's own crossing takes (`owns`)
 *   4. the set's own crossings first (`plan`), then hard crossings no jump clears (`hardGap`) and jumpable ones
 *      (`jumpCrossing`), placed and banked by the gap style's declared attributes
 *   5. what the set reserves (`reserve`), then its stamps on levelled ground (`stamps`)
 *   6. the pockets, relaxing the profile to the ground's step, laying it (`ground.lay`), cutting every crossing to
 *      the drop (`pit`) and dressing it (`gap.dress`), then the stamps
 *   7. dressing (`dress`), stamps standing on the ground as it lies (`standing`), the landmark (`raiseLandmark`), what keeps off it (`crown`), and `post`
 */
export function sculptCourse<S>(ctx: SculptCtx, kit: CourseKit<S>): Shape {
  const { rng, attempt } = ctx;
  const k = knobs(ctx);
  const { W, H } = k;
  const style = rng.weighted(kit.styles(k, ctx));
  const g = new Grid(W, H);
  const slots = new Slots(6, W - 7);
  const locked = new Uint8Array(W);
  const { surf, state } = kit.ground.profile(rng, k, style, ctx);
  const c: Course<S> = { ctx, rng, k, g, slots, style, surf, locked, state, claim: null, challenges: 0, own: 0, hardLeft: 0, gaps: [], sRow: 0, gRow: 0 };
  if (kit.ground.pockets === 'early') {
    c.sRow = surf[2];
    c.gRow = surf[W - 3];
    surf.fill(c.sRow, 0, 6);
    surf.fill(c.gRow, W - 6, W);
    locked.fill(1, 0, 6);
    locked.fill(1, W - 6, W);
  }

  // The landmark comes first: its site is levelled before anything else is placed.
  c.claim = ctx.concept ? (kit.site ? kit.site(c) : claimSite(ctx, k, slots, surf, locked)) : null;
  if (ctx.concept && !c.claim) return finish(g, { row: surf[2] - 1 }, { row: surf[W - 3] - 1 }, `${kit.name}:unclaimed`);

  c.challenges = rollChallenges(attempt, k);
  g.wantsProps = c.challenges > 0;
  const claim = c.claim;
  c.own = claim ? (kit.owns ? kit.owns(claim.concept, k, attempt, c.challenges) : claim.concept.ownsCrossing ? Math.min(1, c.challenges) : 0) : 0;
  c.hardLeft = Math.max(0, c.challenges - c.own);
  kit.plan?.(c);

  // Crossings: the hard ones first, so they get the room, then the jumpable ones.
  const gs = kit.gap;
  let parts = 1;
  if (c.hardLeft === 2 && gs.double?.(rng, k)) {
    c.hardLeft = 1;
    parts = 2;
  }
  const nEasy = jumpCount(rng, k) + (gs.extra?.(style) ?? 0);
  for (let i = 0, n = c.hardLeft + nEasy; i < n; i++) {
    const hard = i < c.hardLeft;
    const { w: open, stones } = hard ? { w: hardGap(rng, parts), stones: [] } : jumpCrossing(rng, 2);
    const rolled = gs.roll?.(rng, hard);
    const w = open + (rolled?.w ?? 0);
    const pad = gs.pad(hard);
    const a = slots.take(rng, w + 2 * pad, gs.margin, gs.range[0], W - gs.range[1]);
    if (a === null) continue;
    const x0 = a + pad;
    const x1 = x0 + w - 1;
    if (hard && gs.keepClear) keepClear(slots, x0, w);
    const span = gs.bank(hard, w);
    const bank = Math.max(surf[x0 - gs.sample], surf[x1 + gs.sample]);
    for (let x = x0 - span; x <= x1 + span; x++) {
      surf[x] = gs.sink && x >= x0 && x <= x1 ? H : bank;
      locked[x] = 1;
    }
    const gap: Gap = { x0, x1, hard, stones };
    if (rolled) gap.extra = rolled.extra;
    c.gaps.push(gap);
  }
  kit.reserve?.(c);

  // Stamps, each on ground levelled under it.
  const placed: { s: Stamp<S>; x: number; w: number }[] = [];
  const ss = kit.stamps;
  if (ss)
    for (const s of ss.bag(rng, k, style)) {
      let stamp = s;
      let w = s.w(rng);
      let x = slots.take(rng, w, ss.margin);
      if (x === null && ss.fallback) {
        stamp = ss.fallback.stamp;
        w = stamp.w(rng) - ss.fallback.shrink;
        x = slots.take(rng, w, ss.margin);
      }
      if (x === null) continue;
      if (ss.level === 'near') surf.fill(surf[Math.max(0, x - 1)], Math.max(0, x - 1), Math.min(W, x + w + 1));
      else flatten(surf, H, x - 1, x + w, ss.level === 'inner' ? flatten(surf, H, x, x + w - 1) : undefined);
      for (let i = x - 1; i <= x + w; i++) locked[i] = 1;
      placed.push({ s: stamp, x, w });
    }

  if (kit.ground.pockets === 'max') {
    c.sRow = flatten(surf, H, 0, 5);
    c.gRow = flatten(surf, H, W - 6, W - 1);
  } else if (kit.ground.pockets === 'near') {
    c.sRow = surf[0];
    surf.fill(c.sRow, 0, 6);
    c.gRow = surf[W - 6];
    surf.fill(c.gRow, W - 6, W);
  }
  if (kit.ground.pockets !== 'early') for (const x of [0, 1, 2, 3, 4, 5, W - 6, W - 5, W - 4, W - 3, W - 2, W - 1]) locked[x] = 1;
  const step = kit.ground.step?.(style);
  if (step) relax(surf, H, locked, step);
  if (kit.ground.lay) kit.ground.lay(c);
  else groundFromHeights(g, surf);
  for (const gap of c.gaps) {
    const row = surf[gap.x0 - 1];
    pit(g, gap.x0, gap.x1, row, gap.hard, gap.stones);
    gs.dress?.(g, rng, gap, row, c);
  }
  for (const p of placed) p.s.stamp(g, rng, p.x, p.w, surf[p.x], c);

  kit.dress?.(c);
  for (const group of kit.standing ?? [])
    for (let i = 0, n = group.count(rng, k, style); i < n; i++) {
      const w = group.stamp.w(rng);
      const x = slots.take(rng, w, group.margin);
      if (x !== null) group.stamp.stamp(g, rng, x, w, surf[x], c);
    }
  const lm = claim ? raiseLandmark(g, ctx, claim, c.own) : null;
  kit.crown?.(c, lm);
  const shape = finish(g, { row: c.sRow - 1 }, { row: c.gRow - 1 }, `${kit.name}:${style}`);
  return kit.post ? kit.post(shape, c) : shape;
}
