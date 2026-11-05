import type { Rng } from '../../../core/rng';
import { FAR_ROOM, NEAR_QUAY } from '../../stage/harbor-kit';
import { finish, Grid, hintGap } from '../kit';
import { jumpProfile } from '../probe';
import { harborTall } from './tall';
import type { SculptCtx, Sculptor, Shape } from '../types';
import { jumpGap, easyRise, hardGap, hopGap, type Knobs, knobs, raiseLandmark, rollChallenges } from './common';
import { oneGap } from '../../stage/kit';

type HarborStyle = 'docks' | 'galleon' | 'marina';
type Kind = 'pier' | 'ship' | 'boat' | 'buoys';

/**
 * Harbor: open water at the bottom of the whole map. Stone quays at both
 * ends (bollards, crate stacks), and in between a
 * chain of floating/standing elements separated by water gaps: one-way plank
 * piers on solid posts, a ship hull silhouette (tapered hull, raised
 * forecastle and quarterdeck, masts with one-way yards, diagonal rigging
 * ratlines and a crow's nest), small boats, and buoy hops.
 */
export const harbor: Sculptor = (ctx) => {
  // Only Rising Slag asks this set for a tower (its races never go tall): its shaft is the tall builder's (./tall.ts).
  if (ctx.profile.size === 'tall') return harborTall(ctx);
  const { rng, attempt } = ctx;
  const kn = knobs(ctx, 5);
  if (ctx.concept) return harborStage(ctx, kn);
  const { W, H } = kn;
  const style = rng.weighted<HarborStyle>([
    ['docks', 3],
    ['galleon', 4],
    ['marina', 2],
  ]);
  const g = new Grid(W, H);
  const q = H - rng.int(7, 10); // quay top row
  const challenges = rollChallenges(attempt, kn);
  g.wantsProps = challenges > 0;
  const kinds: Kind[] =
    style === 'galleon'
      ? ['ship']
      : style === 'docks'
        ? rng.shuffle<Kind>(['pier', rng.pick<Kind>(['boat', 'pier'])])
        : rng.shuffle<Kind>(['boat', 'buoys', 'boat']);
  const widthOf = (k: Kind) =>
    k === 'ship' ? rng.int(20, 24) : k === 'pier' ? rng.int(7, 11 + Math.round(kn.density * 4)) : k === 'boat' ? rng.int(6, 8) : rng.int(5, 8);
  const widths = kinds.map(widthOf);
  // Wide harbors sprawl: keep adding moorings (sparse maps leave more open water) until the waterfront is full.
  const pool: Kind[] = style === 'galleon' ? ['pier', 'boat', 'ship'] : style === 'docks' ? ['pier', 'boat', 'pier'] : ['boat', 'buoys', 'pier'];
  const fill = 0.62 + 0.16 * kn.density;
  while (widths.reduce((a, b) => a + b, 0) + (kinds.length + 1) * 4 + 12 < W * fill) {
    const kind = rng.pick(pool);
    const at = rng.int(0, kinds.length);
    kinds.splice(at, 0, kind);
    widths.splice(at, 0, widthOf(kind));
  }

  // Lay out: quay | gap | element | gap | ... | quay. A galleon's hard gap is
  // usually the boarding gap (its masts would give a long falling jump after it).
  const nGaps = kinds.length + 1;
  const hardIdx = new Set<number>();
  if (challenges && style === 'galleon' && rng.chance(0.75)) hardIdx.add(0);
  while (hardIdx.size < Math.min(challenges, nGaps)) hardIdx.add(rng.int(0, nGaps - 1));
  const hard = Array.from({ length: nGaps }, (_, i) => hardIdx.has(i));
  const gaps = hard.map((h) => (h ? hardGap(rng) : jumpGap(rng, 2)));
  const total = () => widths.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0) + 12;
  const minHard = jumpProfile().gap + 2;
  while (total() > W) {
    const si = kinds.indexOf('ship');
    const easy = gaps.findIndex((gp, i) => !hard[i] && gp > 2);
    const wide = gaps.findIndex((gp, i) => hard[i] && gp > minHard);
    if (si >= 0 && widths[si] > 15) widths[si]--;
    else if (easy >= 0) gaps[easy]--;
    else if (wide >= 0) gaps[wide]--;
    else if (kinds.length > 1) {
      // Drop the last element and the gap before it (keeping any hard flag on the final gap).
      const k = kinds.length - 1;
      if (hard[k]) hard[k + 1] = true;
      kinds.pop();
      widths.pop();
      gaps.splice(k, 1);
      hard.splice(k, 1);
    } else break;
  }
  hardIdx.clear();
  hard.forEach((h, i) => {
    if (h) hardIdx.add(i);
  });
  const used = widths.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
  const quayL = Math.max(6, Math.min(W - used - 6, Math.floor((W - used) * rng.range(0.4, 0.6))));
  const quayR = W - used - quayL;
  if (quayR < 6) return finish(g, { row: q - 1 }, { row: q - 1 }, 'harbor:broken'); // validator rejects; next attempt

  const qL = q + kn.ramp(0);
  const gR = Math.max(6, Math.min(H - 5, q + kn.ramp(W - 1) + rng.int(-2, 1)));
  quay(g, rng, 0, quayL - 1, qL, 'left');
  quay(g, rng, W - quayR, W - 1, gR, 'right');
  let x = quayL;
  let prevDeck = qL;
  for (let i = 0; i < kinds.length; i++) {
    const gap = gaps[i];
    const x0 = x + gap;
    const deck = elementDeck(rng, kinds[i], q, kn.ramp(x + (widths[i] >> 1)));
    if (hardIdx.has(i)) hintGap(g, x, x0 - 1, Math.max(prevDeck, deck));
    const top = stamp(g, rng, kinds[i], x0, widths[i], deck);
    prevDeck = top;
    x = x0 + widths[i];
  }
  if (hardIdx.has(kinds.length)) hintGap(g, x, W - quayR - 1, Math.max(prevDeck, gR));

  return finish(g, { row: qL - 1 }, { row: gR - 1 }, `harbor:${style}`);
};

/**
 * A harbor with a stage concept (gen/stage/harbor.ts): the near quay, the landmark (its berth, the level's
 * crossing, in front of it), then moorings on to the far quay. A two-part ask puts its second crossing out
 * among the moorings, never right under the landmark's far end, where a jump off its heights could clear it.
 */
function harborStage(ctx: SculptCtx, kn: Knobs): Shape {
  const { rng, attempt } = ctx;
  const concept = ctx.concept!;
  const { W, H } = kn;
  const g = new Grid(W, H);
  const challenges = rollChallenges(attempt, kn);
  g.wantsProps = challenges > 0;
  const q0 = H - rng.int(7, 10);
  const G = q0 + kn.ramp(0);
  const box = concept.box(kn, rng);
  const h = Math.min(box.h, G - 1);
  const w = box.w;
  const extra = challenges > 1;
  const hardW = extra ? hardGap(rng) : 0;
  // Room past the landmark for a mooring and the second crossing, when it asks for one and there's room.
  const wideRoom = W - (2 + 7 + oneGap() + 6) - w;
  const hi = extra && wideRoom >= NEAR_QUAY ? wideRoom : W - FAR_ROOM - w;
  if (hi < NEAR_QUAY) return finish(g, { row: G - 1 }, { row: G - 1 }, 'harbor:unclaimed');
  const x = rng.int(NEAR_QUAY, hi);
  // The near quay, its clutter kept back from the berth's edge so nothing launches a longer jump over it.
  g.fill(0, G, x - 1, H - 1);
  if (x - 5 >= 6 && rng.chance(0.6)) {
    const cx = rng.int(5, x - 5);
    if (rng.chance(0.5)) g.set(cx, G - 1, 1);
    else g.fill(cx, G - 2, cx + 1, G - 1);
  }
  const l = raiseLandmark(g, ctx, { concept, at: { x, y: G - h, w, h }, ground: G }, challenges > 0 ? 1 : 0);
  // Lanes keep off the landmark's columns altogether: it brings its own ways through, and nothing hangs in its sky.
  l.air.push({ x: l.rect.x, y: l.rect.y, w: l.rect.w, h: 1 });
  const [ex, exitRow] = l.anchors.exit;
  const xs = ex + 1;

  // Moorings out to the far quay: easy gaps, the last one hard when a second crossing is asked and fits.
  const pool: Kind[] = rng.pick([
    ['pier', 'boat', 'pier'],
    ['boat', 'buoys', 'pier'],
  ]);
  const widthOf = (k: Kind) => (k === 'pier' ? rng.int(7, 10) : k === 'boat' ? rng.int(6, 8) : rng.int(5, 7));
  const elems: { kind: Kind; w: number; gap: number }[] = [];
  let used = 0;
  for (;;) {
    const kind = rng.pick(pool);
    const ew = widthOf(kind);
    const gap = jumpGap(rng, 2);
    const last = extra ? hardW : 2;
    if (used + gap + ew + last + 6 > W - xs) break;
    elems.push({ kind, w: ew, gap });
    used += gap + ew;
  }
  const hardLast = extra && elems.length > 0;
  const lastGap = hardLast ? hardW : Math.min(jumpGap(rng, 2), W - xs - used - 6);
  const quayR = W - xs - used - lastGap;
  let at = xs;
  let prev = exitRow;
  for (const e of elems) {
    const x0 = at + e.gap;
    const deck = Math.max(prev - 3, elementDeck(rng, e.kind, q0, kn.ramp(x0 + (e.w >> 1))));
    prev = stamp(g, rng, e.kind, x0, e.w, deck);
    at = x0 + e.w;
  }
  const gR = Math.max(prev - 3, Math.max(6, Math.min(H - 5, q0 + kn.ramp(W - 1) + rng.int(-2, 1))));
  quay(g, rng, W - quayR, W - 1, gR, 'right');
  if (hardLast) hintGap(g, at, W - quayR - 1, Math.max(prev, gR));
  return finish(g, { row: G - 1 }, { row: gR - 1 }, `harbor:${concept.id}`);
}

/** Deck row of a mooring; piers and ships follow the route ramp (stilted jetties, high-sided hulls), boats float. */
function elementDeck(rng: Rng, kind: Kind, q: number, ramp: number): number {
  switch (kind) {
    case 'ship':
      return q + rng.int(-2, 0) + Math.round(ramp * 0.6);
    case 'pier':
      return q + rng.int(0, 1) + ramp;
    case 'boat':
      return q + rng.int(1, 2);
    case 'buoys':
      return q + rng.int(1, 3);
  }
}

/** Stamp an element at [x, x+w-1] with deck row `d`; returns the row at its right edge. */
function stamp(g: Grid, rng: Rng, kind: Kind, x: number, w: number, d: number): number {
  const r = x + w - 1;
  switch (kind) {
    case 'pier': {
      g.plank(x, r, d);
      for (let px = x; px <= r; px += rng.int(3, 4)) g.fill(px, d + 1, px, g.h - 1);
      g.fill(r, d + 1, r, g.h - 1);
      if (rng.chance(0.6)) g.fill(r, d - 1, r, d - 1); // bollard at the end
      if (rng.chance(0.5)) g.fill(x + 2, d - 2, x + 3, d - 1); // crate
      return d;
    }
    case 'boat': {
      hull(g, x, r, d, 3);
      g.set(x, d - 1, 1);
      g.set(r, d - 1, 1);
      const cab = x + rng.int(2, Math.max(2, w - 5));
      g.fill(cab, d - 2, cab + 2, d - 1); // wheelhouse
      g.plank(cab - 1, cab + 3, d - 3);
      return d;
    }
    case 'buoys': {
      let bx = x;
      let by = d;
      while (bx + 1 <= r) {
        g.plank(bx, bx + 1, by);
        g.set(bx, by + 1, 1);
        bx += 2 + hopGap(rng);
        by = d + rng.int(-1, 1);
      }
      return by;
    }
    case 'ship':
      return ship(g, rng, x, r, d);
  }
}

/** Tapered hull: deck row d, `depth` rows below, each narrower; the bow (right) rakes harder. */
function hull(g: Grid, a: number, b: number, d: number, depth: number): void {
  for (let i = 0; i < depth; i++) g.fill(a + i, d + i, b - Math.round(i * 1.6), d + i);
}

function ship(g: Grid, rng: Rng, a: number, b: number, d: number): number {
  hull(g, a, b, d, rng.int(4, 5));
  // Quarterdeck (stern, left) with a cabin window; forecastle (bow, right).
  const qd = rng.int(2, 3);
  const qw = rng.int(4, 5);
  g.fill(a, d - qd, a + qw - 1, d - 1);
  g.clear(a + 1, d - qd + 1, a + 1, d - qd + 1);
  g.set(a, d - qd - 1, 1); // taffrail
  const fw = rng.int(3, 4);
  g.fill(b - fw + 1, d - 2, b, d - 1);
  g.fill(b + 1, d - 2, b + 2, d - 2); // bowsprit
  g.set(b - fw + 1, d - 3, 1);
  // Mainmast: ratlines (diagonal one-way steps) up to a wide lower yard, a
  // narrower topsail yard, and the masthead poking one tile above it.
  const rise = easyRise();
  const m = Math.min(b - fw - 6, a + qw + 7 + rng.int(0, 2));
  const ly = d - 1 - rise;
  const uy = ly - rise;
  g.fill(m, uy - 1, m, d - 1);
  for (let i = 0; i < rise; i++) g.plank(m - 8 + i, m - 8 + i, d - 1 - i);
  g.plank(m - 5, m + 5, ly);
  g.plank(m - 2, m + 2, uy);
  g.set(m, uy - 2, 2); // pennant
  if (rng.chance(0.6)) {
    // Mizzen stub on the quarterdeck with its own little yard.
    const z = a + 2;
    g.fill(z, d - qd - 3, z, d - qd - 1);
    g.plank(z - 1, z + 1, d - qd - 3);
  }
  return d - 2;
}

/** Stone quay from x0..x1 at row q, with harbor clutter. */
function quay(g: Grid, rng: Rng, x0: number, x1: number, q: number, side: 'left' | 'right'): void {
  g.fill(x0, q, x1, g.h - 1);
  // The far quay's coping overhangs the water, so nobody climbs the sea wall out of the drink.
  if (side === 'right') g.clear(x0, q + 2, x0 + 1, g.h - 1);
  // Sea wall step down to the water edge.
  const edge = side === 'left' ? x1 : x0;
  g.set(edge, q, 2, true);
  for (let y = q + 1; y < g.h; y += 3) g.set(edge, y, 0, true);
  const inner = side === 'left' ? [x0 + 5, x1 - 1] : [x0 + 1, x1 - 5];
  if (inner[1] - inner[0] < 1) return;
  const pick = rng.int(0, 2);
  if (pick === 0) {
    const bx = rng.int(inner[0], inner[1]);
    g.set(bx, q - 1, 1); // bollard
  } else if (pick === 1 && inner[1] - inner[0] >= 2) {
    const cx = rng.int(inner[0], inner[1] - 1);
    g.fill(cx, q - 2, cx + 1, q - 1); // crate
    if (rng.chance(0.5)) g.set(cx + rng.int(0, 1), q - 3, 1);
  }
}
