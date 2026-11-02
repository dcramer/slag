import type { Rng } from '../../../core/rng';
import { GROUND_ICE } from '../../../sim/ground';
import { T_EMPTY, T_SOLID } from '../../../sim/level';
import { glacierOwns, rectsOf } from '../../stage/glacier';
import { finish, Grid, noise1D } from '../kit';
import type { SculptCtx, Sculptor, Shape } from '../types';
import {
  type Claim,
  claimSite,
  easyGap,
  easyRise,
  flatten,
  hardGap,
  keepClear,
  type Knobs,
  knobs,
  pit,
  raiseLandmark,
  relax,
  rollChallenges,
  Slots,
  stepRows,
} from './common';
import { glacierTall } from './tall';

type GlacierStyle = 'crevasses' | 'icefall' | 'cave';

/**
 * Glacier: a smooth ice field split by crevasses, stepped icefalls with
 * frozen falls down their risers, or an ice cave under a hanging ceiling.
 * Seracs stand on the field as blocks of solid ice, and the crevasses drop
 * to meltwater (the kill pit).
 *
 * The ice is ground (sim/ground.ts), laid by `glaze` once the shape is final:
 * it fills the beds, the long stretches of floor, and stops short of every
 * edge, so a skid ends on rock instead of in a crevasse. Rock stays where
 * footing matters: the lips, the banks of a hard crossing, the pockets,
 * anything too short to skate on. Seracs, frozen falls and the cave's ceiling
 * are ice right through, so their faces can't be wall-jumped.
 *
 * A stage concept's landmark (stage/glacier.ts) claims its site first, on an ice field (never in a cave,
 * whose roof would bury it), owns the level's hard crossing, and says which of its tiles are ice.
 */
export const glacier: Sculptor = (ctx) => {
  if (ctx.profile.size === 'tall') return glaze(glacierTall(ctx), new Uint8Array(ctx.profile.w * ctx.profile.h), ctx.rng, 0.75);
  const { rng, attempt } = ctx;
  const k = knobs(ctx);
  const { W, H } = k;
  const style = rng.weighted<GlacierStyle>([
    ['crevasses', 4],
    ['icefall', 3],
    ['cave', ctx.concept ? 0 : 1.5 + 2 * k.density],
  ]);
  const g = new Grid(W, H);
  const ice = new Uint8Array(W * H);
  const slots = new Slots(6, W - 7);
  const locked = new Uint8Array(W);
  const base = H - rng.int(5, style === 'cave' ? 7 : 8);
  let surf: number[];
  if (style === 'icefall') surf = stepRows(rng, k, base, [4, 8], 0.75, 2);
  else {
    // Ice fields are smooth: long swells, no teeth.
    const n = noise1D(rng, W, rng.int(9, 15), 2, 0.4);
    const amp = 1.5 + 2 * k.density;
    surf = n.map((v, x) => Math.max(style === 'cave' ? 12 : 6, Math.min(H - 3, Math.round(base + k.ramp(x) + v * amp))));
  }

  // The stage concept's landmark comes first; it owns one crossing, or both where its box made room for a two-part one.
  const claim = ctx.concept ? claimGlacierSite(ctx, k, slots, surf, locked) : null;
  if (ctx.concept && !claim) return finish(g, { row: surf[2] - 1 }, { row: surf[W - 3] - 1 }, 'glacier:unclaimed');

  // Crevasses: hard ones need a bridge, easy ones are a hop. Each gets rock lips to land on.
  const challenges = rollChallenges(attempt, k);
  g.wantsProps = challenges > 0;
  const own = claim ? glacierOwns(claim.concept, k, attempt, challenges) : 0;
  const left = challenges - own;
  // Two parts is often one crevasse two bridges wide: two one-bridge crevasses and their banks crowd a classic level.
  const double = left === 2 && (W < 64 || rng.chance(0.4));
  const hards = double ? 1 : Math.max(0, left);
  const pits: { x0: number; x1: number; hard: boolean }[] = [];
  const nEasy = rng.int(1, 2) + Math.floor((k.wide - 1) * rng.range(1, 2));
  for (let i = 0; i < hards + nEasy; i++) {
    const hard = i < hards;
    const w = hard ? hardGap(rng, double ? 2 : 1) : easyGap(rng, 2);
    const lip = hard ? 3 : 2;
    const a = slots.take(rng, w + lip * 2, 1, 6, W - 7);
    if (a === null) continue;
    const x0 = a + lip;
    const x1 = x0 + w - 1;
    if (hard) keepClear(slots, x0, w);
    const bank = Math.max(surf[x0 - 1], surf[x1 + 1]);
    for (let x = a; x <= x1 + lip; x++) {
      surf[x] = x >= x0 && x <= x1 ? H : bank;
      locked[x] = 1;
    }
    pits.push({ x0, x1, hard });
  }

  // Seracs: blocks of ice on flattened ground, low enough to hop.
  const seracs: { x: number; w: number }[] = [];
  for (let i = k.count(style === 'crevasses' ? rng.int(2, 3) : rng.int(0, 2)); i > 0; i--) {
    const w = rng.int(2, 4);
    const x = slots.take(rng, w, 2);
    if (x === null) continue;
    flatten(surf, H, x - 1, x + w);
    for (let c = x - 1; c <= x + w; c++) locked[c] = 1;
    seracs.push({ x, w });
  }
  const sRow = flatten(surf, H, 0, 5);
  const gRow = flatten(surf, H, W - 6, W - 1);
  for (const x of [0, 1, 2, 3, 4, 5, W - 6, W - 5, W - 4, W - 3, W - 2, W - 1]) locked[x] = 1;
  relax(surf, H, locked, style === 'icefall' ? 3 : 1);
  for (let x = 0; x < W; x++) if (surf[x] < H) g.fill(x, surf[x], x, H - 1);
  for (const p of pits) pit(g, p.x0, p.x1, surf[p.x0 - 1], p.hard);
  for (const s of seracs) serac(g, ice, rng, s.x, s.w, surf[s.x]);
  if (style === 'icefall') frozenFalls(g, ice, surf);
  const lm = claim ? raiseLandmark(g, ctx, claim, own) : null;
  // The landmark's own ice, and no shelf hung in its sky.
  if (lm)
    for (const r of rectsOf(lm, 'ice'))
      for (let y = Math.max(0, r.y); y < Math.min(H, r.y + r.h); y++)
        for (let x = Math.max(0, r.x); x < Math.min(W, r.x + r.w); x++) if (g.get(x, y) === T_SOLID) ice[y * W + x] = 1;
  const off = lm ? [{ x0: lm.rect.x - 3, x1: lm.rect.x + lm.rect.w + 2 }] : [];
  if (style !== 'cave') shelves(g, ice, rng, k.count(rng.int(0, 2)), surf, [...pits, ...off]);
  else ceiling(g, ice, rng, surf, pits);

  return glaze(finish(g, { row: sRow - 1 }, { row: gRow - 1 }, `glacier:${style}`), ice, rng, style === 'icefall' ? 0.75 : 0.85);
};

/**
 * The landmark's site (claimSite), on ground levelled a couple of columns past it either side and never so
 * low that its crevasse has no bank under it. Nothing else lands within a running jump of its far side, where
 * a crevasse could be cleared bare off its top.
 */
function claimGlacierSite(ctx: SculptCtx, k: Knobs, slots: Slots, surf: number[], locked: Uint8Array): Claim | null {
  const claim = claimSite(ctx, k, slots, surf, locked);
  if (!claim) return null;
  const { x, w } = claim.at;
  const ground = Math.min(claim.ground, k.H - 5);
  slots.mark(x - 3, x + w + 8);
  flatten(surf, k.H, x - 2, x + w + 1, ground);
  for (let i = Math.max(0, x - 3); i <= Math.min(k.W - 1, x + w + 2); i++) locked[i] = 1;
  return { ...claim, ground, at: { ...claim.at, y: ground - claim.at.h } };
}

/** A serac: a block of ice with one corner sheared off, standing on row f. */
function serac(g: Grid, ice: Uint8Array, rng: Rng, x: number, w: number, f: number): void {
  const h = rng.int(2, easyRise());
  const top = f - h;
  g.fill(x, top, x + w - 1, f - 1);
  if (w > 2) g.clear(rng.chance(0.5) ? x : x + w - 1, top, rng.chance(0.5) ? x : x + w - 1, top);
  for (let y = top; y < f; y++) for (let c = x; c < x + w; c++) if (g.get(c, y) === T_SOLID) ice[y * g.w + c] = 1;
}

/** Icefall risers freeze: the face under every step's lip is ice, so it can't be climbed by wall jumps. */
function frozenFalls(g: Grid, ice: Uint8Array, surf: number[]): void {
  for (let x = 1; x < g.w - 1; x++) {
    for (const n of [x - 1, x + 1]) {
      if (surf[x] >= g.h || surf[n] >= g.h || surf[n] - surf[x] < 2) continue;
      for (let y = surf[x] + 1; y < surf[n]; y++) ice[y * g.w + x] = 1;
    }
  }
}

/** Ice shelves: floating slabs of ice a plain jump above open ground, off the crossings. */
function shelves(g: Grid, ice: Uint8Array, rng: Rng, n: number, surf: number[], pits: { x0: number; x1: number }[]): void {
  const rise = easyRise();
  for (let i = 0; i < n; i++) {
    const w = rng.int(4, 6);
    const x = rng.int(7, g.w - 8 - w);
    if (pits.some((p) => x + w + 4 >= p.x0 && x - 4 <= p.x1)) continue;
    const f = Math.min(...surf.slice(x, x + w));
    const y = f - rise;
    if (y < 4) continue;
    let clear = true;
    for (let yy = y - 3; yy <= y + 2 && clear; yy++) for (let xx = x - 1; xx <= x + w; xx++) if (!g.empty(xx, yy)) clear = false;
    if (!clear) continue;
    g.fill(x, y, x + w - 1, y);
    for (let c = x; c < x + w; c++) ice[y * g.w + c] = 1;
  }
}

/** The cave's roof: a band of ice with icicles, open over the crevasses where the light gets in. */
function ceiling(g: Grid, ice: Uint8Array, rng: Rng, surf: number[], pits: { x0: number; x1: number }[]): void {
  const n = noise1D(rng, g.w, rng.int(6, 10), 2, 0.5);
  const open = (x: number) => pits.some((p) => x >= p.x0 - 1 && x <= p.x1 + 1);
  for (let x = 0; x < g.w; x++) {
    if (open(x)) continue;
    const f = surf[x] < g.h ? surf[x] : g.h - 6;
    const c = Math.max(0, Math.min(f - 11, Math.round(2 + (n[x] + 1) * 1.6)));
    g.fill(x, 0, x, c);
    for (let y = Math.max(0, c - 1); y <= c; y++) ice[y * g.w + x] = 1;
    if (x > 6 && x < g.w - 7 && f - c > 12 && rng.chance(0.22)) {
      const len = rng.int(1, 2);
      g.fill(x, c + 1, x, c + len);
      for (let y = c + 1; y <= c + len; y++) ice[y * g.w + x] = 1;
    }
  }
}

/** Rock kept at the end of a bed that drops away: a skid stops before the edge. */
const LIP = 2;
/** A bed shorter than this stays rock: too short to skate on, long enough to trip on. */
const MIN_BED = 5;
/** Rows of ice under a bed's surface, so a crater shows more ice, not rock. */
const BED_DEPTH = 2;
/** Columns of rock either side of a hard crossing: take-offs are exact, and measured on plain ground. */
const BANK = 5;

/**
 * Lay ice into the beds of a finished shape: on each stretch of floor long
 * enough to skate (a share of them), short of any edge it drops off, and
 * never near a hard crossing's banks or the pockets. Ice already marked
 * (seracs, falls, shelves, ceilings) stays. Writes `shape.ground`.
 */
export function glaze(s: Shape, ice: Uint8Array, rng: Rng, share: number): Shape {
  const { w: W, h: H, tiles } = s;
  const solid = (x: number, y: number) => (x < 0 || x >= W ? true : y < 0 || y >= H ? false : tiles[y * W + x] === T_SOLID);
  const air = (x: number, y: number) => x >= 0 && x < W && y >= 0 && y < H && tiles[y * W + x] === T_EMPTY;
  // A crossing's banks are the floor at the row its bridges were hinted on; a tower's other storeys skate over it freely.
  const banks = (s.crossings ?? []).map(([a, b]) => ({ a: a - BANK, b: b + BANK, row: s.bridgeHints?.find((h) => h.x >= a - 3 && h.x <= b)?.y }));
  const banked = (x: number, y: number) => banks.some((k) => x >= k.a && x <= k.b && (k.row === undefined || Math.abs(y - k.row) <= 4));
  const pocket = (x: number, y: number) => s.protectedRects.some((r) => x >= r.x - 2 && x < r.x + r.w + 2 && y >= r.y - 1 && y < r.y + r.h + 2);
  const top = (x: number, y: number) => solid(x, y) && air(x, y - 1);
  for (let y = 1; y < H; y++) {
    for (let x = 0; x < W;) {
      if (!top(x, y)) {
        x++;
        continue;
      }
      let e = x;
      while (e + 1 < W && top(e + 1, y)) e++;
      // A run's end drops away unless the next cell along is solid (a wall going up, or the level's side).
      const a = x + (solid(x - 1, y) ? 0 : LIP);
      const b = e - (solid(e + 1, y) ? 0 : LIP);
      if (rng.chance(share)) {
        for (let i = a; i <= b;) {
          if (banked(i, y) || pocket(i, y)) {
            i++;
            continue;
          }
          let j = i;
          while (j + 1 <= b && !banked(j + 1, y) && !pocket(j + 1, y)) j++;
          if (j - i + 1 >= MIN_BED) for (let c = i; c <= j; c++) for (let d = 0; d < BED_DEPTH; d++) if (solid(c, y + d)) ice[(y + d) * W + c] = 1;
          i = j + 1;
        }
      }
      x = e + 1;
    }
  }
  let any = false;
  for (let i = 0; i < W * H; i++) {
    if (tiles[i] !== T_SOLID || pocket(i % W, Math.floor(i / W))) ice[i] = 0;
    else if (ice[i]) {
      ice[i] = GROUND_ICE;
      any = true;
    }
  }
  return any ? { ...s, ground: ice } : s;
}
