import type { Rng } from '../../../core/rng';
import { SAFE_TILES } from '../../setpieces/place';
import { rooftopsOwns } from '../../stage/rooftops';
import { finish, Grid, hintGap, POCKET } from '../kit';
import type { SculptCtx, Sculptor, Shape } from '../types';
import { easyGap, easyRise, hardGap, type Knobs, knobs, raiseLandmark, rollChallenges, undercut } from './common';
import { rooftopsTall } from './tall';

type RoofStyle = 'downtown' | 'tenements' | 'skyline';

interface Building {
  x: number;
  w: number;
  /** Roof row (top solid row). */
  roof: number;
}

/**
 * Rooftops: a run of buildings of varied heights separated by alleys that
 * drop to the street (the kill pit). Roofs carry parapets, setbacks,
 * cornices, water towers on legs with a ladder rung, chimneys, AC units,
 * antennas, billboards and one-way skylights; taller neighbors get zigzag
 * fire-escape landings on the alley wall so the climb stays honest. A wide
 * alley is the bridge challenge.
 */
export const rooftops: Sculptor = (ctx) => {
  if (ctx.profile.size === 'tall') return rooftopsTall(ctx);
  const { rng, attempt } = ctx;
  const k = knobs(ctx);
  if (ctx.concept) return rooftopsStage(ctx, k);
  const { W, H } = k;
  const style = rng.weighted<RoofStyle>([
    ['downtown', 3],
    ['tenements', 1 + 3 * k.density],
    ['skyline', 3 - k.density],
  ]);
  const g = new Grid(W, H);
  const rise = easyRise();
  const challenges = rollChallenges(attempt, k);
  g.wantsProps = challenges > 0;

  // Plan buildings left → right until the map is full.
  const bs: Building[] = [];
  const gaps: { a: number; b: number; hard: boolean }[] = [];
  const baseRoof = H - rng.int(7, 13);
  const sRoof = Math.max(7, baseRoof + k.ramp(0));
  bs.push({ x: 0, w: rng.int(6, 9), roof: sRoof });
  let hardLeft = challenges;
  const minW = style === 'tenements' ? 4 : 5;
  const maxW = style === 'skyline' ? 12 : style === 'tenements' ? 8 : 10;
  for (;;) {
    const prev = bs[bs.length - 1];
    const end = prev.x + prev.w;
    const remaining = W - end;
    const hard = hardLeft > 0 && rng.chance(0.5 + (remaining < 24 ? 0.5 : 0));
    const gap = hard ? hardGap(rng) : easyGap(rng, style === 'tenements' ? 1 : 2);
    const w = rng.int(minW, maxW);
    // Random walk around the route ramp (climbing skylines step up toward the goal).
    const want = baseRoof + k.ramp(end + gap + (w >> 1));
    let roof = Math.max(6, Math.min(H - 5, prev.roof + rng.int(-5, 5)));
    if (roof - want > 4) roof -= rng.int(2, 4);
    else if (want - roof > 4) roof += rng.int(2, 4);
    if (end + gap + w + 7 > W || remaining - gap - w < 6) {
      // Final building holds the goal and runs to the right edge.
      const fx = end + gap;
      if (W - fx < 5) {
        // Not enough room: widen the previous building instead.
        prev.w = W - prev.x;
        break;
      }
      if (hard) hardLeft--;
      if (hard || gap >= 2) gaps.push({ a: end, b: fx - 1, hard });
      bs.push({ x: fx, w: W - fx, roof: hard ? prev.roof + rng.int(-1, 1) : roof });
      break;
    }
    if (hard) {
      roof = prev.roof + rng.int(-1, 1);
      hardLeft--;
    }
    gaps.push({ a: end, b: end + gap - 1, hard });
    bs.push({ x: end + gap, w, roof });
  }
  g.wantsProps = gaps.some((gp) => gp.hard);

  for (let i = 0; i < bs.length; i++) {
    const b = bs[i];
    g.fill(b.x, b.roof, b.x + b.w - 1, H - 1);
    // Windows: a regular grid of 1×1 holes reads as a facade.
    if (b.w >= 5) for (let y = b.roof + 3; y < H - 1; y += 3) for (let x = b.x + 1 + (i % 2); x < b.x + b.w - 1; x += 2) g.set(x, y, 0, true);
  }
  for (const gp of gaps) {
    if (!gp.hard) continue;
    hintGap(g, gp.a, gp.b, Math.max(roofAt(bs, gp.a - 1, H), roofAt(bs, gp.b + 1, H)));
    undercut(g, gp.b + 1); // cantilevered top floor: the facade below can't be wall-climbed to the roof
  }

  // Fire escapes where the next roof is too high to jump to.
  for (let i = 1; i < bs.length; i++) {
    const a = bs[i - 1];
    const b = bs[i];
    if (a.roof - b.roof <= rise - 1) continue;
    let y = a.roof - rise;
    let left = true;
    while (y > b.roof) {
      if (left) g.plank(b.x - 2, b.x - 1, y);
      else g.plank(b.x - 3, b.x - 2, y);
      y -= rise;
      left = !left;
    }
  }

  // Rooftop clutter on interior buildings (not the spawn/goal roofs' pockets).
  for (let i = 0; i < bs.length; i++) {
    if (k.density < 0.3 && rng.chance(0.5)) continue; // sparse: bare roofs
    const b = bs[i];
    const a = Math.max(b.x, i === 0 ? 6 : b.x);
    const z = Math.min(b.x + b.w - 1, i === bs.length - 1 ? W - 7 : b.x + b.w - 1);
    if (z - a < 1) continue;
    decorate(g, rng, a, z, b.roof, style);
  }

  return finish(g, { row: sRoof - 1 }, { row: bs[bs.length - 1].roof - 1 }, `rooftops:${style}`);
};

/** Columns the goal's building keeps past a landmark at least: an alley's hop and a roof for the pocket. */
const FAR_ROOM = 9;

/**
 * Rooftops with a stage concept (gen/stage/rooftops.ts): the spawn's roof, then the landmark's box (its alley,
 * the level's crossing, in front of the building it stands on), then a run of buildings on to the goal's,
 * easy hops between them, fire escapes up the taller ones. A two-part ask the landmark's alley didn't take
 * gets a second hard alley out there, never right after the landmark, where a jump off its heights would
 * clear it.
 */
function rooftopsStage(ctx: SculptCtx, k: Knobs): Shape {
  const { rng, attempt } = ctx;
  const concept = ctx.concept!;
  const { W, H } = k;
  const g = new Grid(W, H);
  const challenges = rollChallenges(attempt, k);
  g.wantsProps = challenges > 0;
  const own = rooftopsOwns(concept, k, attempt, challenges);
  const box = concept.box(k, rng);
  const lo = POCKET + SAFE_TILES;
  const hi = W - FAR_ROOM - box.w;
  if (hi < lo) return finish(g, { row: H - 8 }, { row: H - 8 }, 'rooftops:unclaimed');
  const x = rng.int(lo, Math.min(hi, lo + 2));
  const G = Math.max(box.h + 1, Math.min(H - 5, H - rng.int(6, 9) + k.ramp(x + (box.w >> 1))));
  const h = Math.min(box.h, G - 1);
  // The spawn's roof, run on to the alley's edge (its clutter kept back from it), and the landmark's building.
  g.fill(0, G, x + box.w - 1, H - 1);
  windows(g, 0, x - 1, G, 0);
  if (x - 5 >= 8) decorate(g, rng, 6, x - 5, G, 'downtown');
  const l = raiseLandmark(g, ctx, { concept, at: { x, y: G - h, w: box.w, h }, ground: G }, own);
  windows(g, l.rect.x, l.rect.x + l.rect.w - 1, G, 1);
  // Lanes keep off the landmark's columns altogether: it brings its own ways through.
  l.air.push({ x: l.rect.x, y: l.rect.y, w: l.rect.w, h: 1 });

  // On to the goal: easy hops, the last one hard when a second alley is asked for and there's room for it.
  const extra = challenges > own;
  const hardW = extra ? hardGap(rng) : 0;
  const rise = easyRise();
  let at = x + box.w;
  let prev = G;
  const bs: Building[] = [];
  const gaps: { a: number; b: number }[] = [];
  for (;;) {
    const gap = easyGap(rng, 2);
    const w = rng.int(5, 9);
    // A second alley needs a building between it and the landmark, and the goal's roof after it.
    const tail = extra && bs.length > 0 ? hardW + 7 : 7;
    if (at + gap + w + tail > W) break;
    let roof = Math.max(6, Math.min(H - 5, prev + rng.int(-4, 3)));
    const want = G + k.ramp(at + gap + (w >> 1)) - k.ramp(x);
    if (roof - want > 3) roof -= rng.int(1, 3);
    else if (want - roof > 3) roof += rng.int(1, 3);
    bs.push({ x: at + gap, w, roof });
    gaps.push({ a: at, b: at + gap - 1 });
    at += gap + w;
    prev = roof;
  }
  const hardLast = extra && bs.length > 0 && at + hardW + 6 <= W;
  const lastGap = hardLast ? hardW : Math.max(2, Math.min(easyGap(rng, 2), W - at - 6));
  const gx = at + lastGap;
  const gR = hardLast ? prev : Math.max(6, Math.min(H - 5, prev + rng.int(-2, 2)));
  bs.push({ x: gx, w: W - gx, roof: gR });
  for (const [i, b] of bs.entries()) {
    g.fill(b.x, b.roof, b.x + b.w - 1, H - 1);
    windows(g, b.x, b.x + b.w - 1, b.roof, i);
    if (i < bs.length - 1 && b.w >= 6 && k.density > 0.25) decorate(g, rng, b.x + 1, b.x + b.w - 2, b.roof, 'downtown');
  }
  if (hardLast) {
    hintGap(g, at, gx - 1, Math.max(prev, gR));
    undercut(g, gx);
  }
  // Fire escapes up the wall of a roof too high to jump to.
  const roofs = [{ x: x, w: box.w, roof: G }, ...bs];
  for (let i = 1; i < roofs.length; i++) {
    const a = roofs[i - 1];
    const b = roofs[i];
    if (a.roof - b.roof <= rise - 1) continue;
    let y = a.roof - rise;
    let left = true;
    while (y > b.roof) {
      if (left) g.plank(b.x - 2, b.x - 1, y);
      else g.plank(b.x - 3, b.x - 2, y);
      y -= rise;
      left = !left;
    }
  }
  return finish(g, { row: G - 1 }, { row: gR - 1 }, `rooftops:${concept.id}`);
}

/** A facade's windows: a regular grid of 1×1 holes below the roof row (cosmetic: nobody gets in). */
function windows(g: Grid, a: number, b: number, roof: number, odd: number): void {
  if (b - a < 4) return;
  // Only where the wall goes on either side: never a notch in a building's edge, over an alley.
  for (let y = roof + 3; y < g.h - 1; y += 3)
    for (let x = a + 1 + (odd % 2); x < b; x += 2) if (!g.empty(x, y) && !g.empty(x - 1, y) && !g.empty(x + 1, y)) g.set(x, y, 0, true);
}

function roofAt(bs: Building[], x: number, H: number): number {
  for (const b of bs) if (x >= b.x && x < b.x + b.w) return b.roof;
  return H;
}

function decorate(g: Grid, rng: Rng, a: number, z: number, roof: number, style: RoofStyle): void {
  const w = z - a + 1;
  const y = roof - 1;
  // Parapet lips on the roof edges.
  if (rng.chance(0.6)) {
    g.set(a, y, 1);
    g.set(z, y, 1);
  }
  const pick = rng.weighted<string>([
    ['tower', style === 'tenements' ? 3 : 2],
    ['setback', style === 'skyline' ? 3 : 1],
    ['chimneys', style === 'tenements' ? 3 : 1],
    ['ac', 2],
    ['antenna', 1],
    ['billboard', style === 'downtown' ? 2 : 1],
    ['skylight', 2],
  ]);
  const rise = easyRise();
  switch (pick) {
    case 'tower': {
      if (w < 6) return;
      const tx = a + rng.int(1, w - 5);
      // Legs, tank, cone roof; a ladder rung on the left leg.
      g.fill(tx, y - 1, tx, y);
      g.fill(tx + 3, y - 1, tx + 3, y);
      g.fill(tx, y - 4, tx + 3, y - 2);
      g.fill(tx + 1, y - 5, tx + 2, y - 5);
      g.plank(tx - 2, tx - 1, y - 1);
      return;
    }
    case 'setback': {
      if (w < 7) return;
      const h = rng.int(2, rise);
      g.fill(a + 2, y - h + 1, z - 2, y);
      for (let x = a + 3; x < z - 2; x += 2) g.set(x, y - h + 2, 0, true);
      if (rng.chance(0.5)) g.set(a + 3 + rng.int(0, w - 7), y - h, 1); // spire stub
      return;
    }
    case 'chimneys': {
      for (let x = a + 1; x < z; x += rng.int(3, 5)) g.fill(x, y - rng.int(0, 1), x, y);
      return;
    }
    case 'ac': {
      if (w < 4) return;
      const x = a + rng.int(1, w - 3);
      g.fill(x, y, x + 1, y);
      if (rng.chance(0.5)) g.set(x, y - 1, 2);
      return;
    }
    case 'antenna': {
      const x = a + rng.int(0, w - 1);
      g.fill(x, y - 2, x, y);
      g.plank(x - 1, x + 1, y - 2);
      return;
    }
    case 'billboard': {
      if (w < 6) return;
      const x = a + rng.int(1, w - 5);
      const top = y - rise - rng.int(0, 1);
      g.fill(x, top, x + 3, top + 1);
      g.plank(x - 1, x + 4, top - 1);
      return;
    }
    case 'skylight': {
      if (w < 5) return;
      const x = a + rng.int(1, w - 4);
      g.clear(x, roof, x + 2, roof + 2);
      g.fill(x, roof, x + 2, roof, 2, true);
      return;
    }
  }
}
