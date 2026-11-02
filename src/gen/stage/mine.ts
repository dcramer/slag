import type { Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import { type LevelProfile, T_ONEWAY, type TileRect } from '../../sim/level';
import type { Module, PropStyle } from '../../sim/props';
import { type Grid, hintGap, POCKET } from '../level/kit';
import { jumpProfile } from '../level/probe';
import { easyRise, hardGap, hopGap, type Knobs, TWO_PART_TRIES, undercut } from '../level/sculptors/common';
import { BRIDGE_W } from '../level/types';
import { makeStyle, type Piece, SAFE_TILES, type Site } from '../setpieces/place';
import { defineConcept } from './contract';
import { capFlood } from './flood';
import type { Concept, Landmark } from './types';

/**
 * Mine stage concepts (docs/SETPIECES.md, Mine): five places dug out of the rock, each one landmark that
 * owns the level's hard crossing (a chasm in front of it) and is laid out afresh from its seed.
 *
 * - **The Headframe** (grand): a timber pit-head tower standing over its shaft, the winding wheel
 *   turning at the top. The cage rides the shaft from a slot in the floor to the deck, stopping at a
 *   landing on the way on some. Through the tower's hall at the floor, past the shaft and rock falling
 *   out of the bins over it; or up the ladder and over the deck, hopping the shaft's mouth.
 * - **The Trestle Line**: the mine railway on a rickety timber trestle, the track broken in places, and
 *   runaway carts on the deck and on the low line under it. Along the top hopping the breaks, or along
 *   the bottom between the bents.
 * - **The Ore Crusher**: an iron crusher house, a belt on its roof carrying ore to the hopper in the
 *   middle and the rolls turning inside. Over the roof against the belts, hopping the hopper's mouth; or
 *   through the cart tunnel underneath, where the ore comes down and the carts come through.
 * - **The Crystal Geode**: a hollow geode cracked open, a floor of crystal spikes inside. In at the
 *   crack and across on crystal ledges, out of a window high in the far side; or up the outside and over
 *   the dome.
 * - **The Flooded Gallery** (grand, wide levels): a timbered gallery through a long rock mass, flooding
 *   from the sump on a slow cycle, refuge rocks to wait on and a pump blowing up a shaft. Through it by
 *   timing, or over the top dry.
 *
 * Every landmark keeps a static way past itself (movers and hazards are timed, never the proof), and
 * owns the level's crossing. Two-part levels get a two-part chasm where the level has room for one
 * beside the landmark (`mineOwns`).
 *
 * Anchors the tests and the skin read: `way{i}` / `way{i}s` is a rect that, filled, shuts one way
 * through, and `sig{i}` are the structural numbers the seed rolled.
 */

/** Columns a landmark keeps from either end (sculptors/common.ts claimSite). */
const SITE_MARGIN = POCKET + SAFE_TILES;
/** Flat floor between the chasm and the structure: the bridge's landing and a run-up. */
const BANK = 3;

/** The widest one-part crossing at this gravity (hardGap's top end). */
function oneGap(gravity?: number): number {
  const j = jumpProfile(gravity);
  return Math.max(j.gap + 2, BRIDGE_W + 2 * j.walkGap);
}

/** The one-part crossing a classic level's box makes room for: a column or so short of hardGap's widest. */
function snugGap(gravity?: number): number {
  return Math.min(oneGap(gravity), jumpProfile(gravity).gap + 3);
}

/** The widest two-part crossing at this gravity. */
function twoGap(gravity?: number): number {
  const j = jumpProfile(gravity);
  return Math.max(j.gapAt(-6) + j.rise + 1, j.gap + 2 * BRIDGE_W + j.walkGap + 1);
}

/**
 * Share of levels whose landmark's own chasm takes two parts, where its box has room for a two-part one
 * (wide levels). A mine built round a landmark has none of the plain mine's sealed chasms that need a
 * second part by chance, so the wide ones ask more often to keep the theme near TWO_PARTS.
 */
const LANDMARK_TWO = 0.55;
const asksTwo = (k: Knobs) => k.challenge < Math.max(k.twoParts, LANDMARK_TWO);

/** Columns for the chasm a landmark owns: a two-part one where asked for and there's room, else one part. */
function crossFor(k: Knobs, struct: number): number {
  if (asksTwo(k) && twoGap() + BANK + struct <= k.W - 2 * SITE_MARGIN) return twoGap();
  return k.W > 56 ? oneGap() : snugGap();
}

/** Does a landmark of `struct` columns fit beside a one-part chasm on this level? */
function roomFor(p: Partial<LevelProfile>, struct: number): boolean {
  return snugGap(p.gravity) + BANK + struct <= (p.w ?? 48) - 2 * SITE_MARGIN;
}

/** The chasm the build digs: as wide as `parts` take. */
const crossCols = (parts: number) => (parts >= 2 ? twoGap() : oneGap());

/** A box: the chasm, a bank, and `struct` columns of structure, or as many more as `want` and the level allow. */
function boxFor(k: Knobs, rng: Rng, struct: number, want: readonly [number, number], h: number): { w: number; h: number } {
  const cross = crossFor(k, struct);
  const room = k.W - 2 * SITE_MARGIN - cross - BANK;
  const s = k.W > 56 ? rng.int(Math.min(room, want[0]), Math.min(room, want[1])) : Math.min(room, struct + rng.int(0, 2));
  return { w: cross + BANK + s, h };
}

/**
 * The chasm in front of a landmark: a `hardGap` drop dug from the box's top to the bottom at the right
 * end of its `cols` columns, its bridge hinted and its far bank undercut. Columns it doesn't need stay floor.
 */
function chasm(g: Grid, rng: Rng, x0: number, cols: number, top: number, G: number, parts: number): void {
  if (parts <= 0) return;
  const gw = Math.min(cols, hardGap(rng, parts));
  const b = x0 + cols - 1;
  const a = b - gw + 1;
  g.clear(a, top, b, g.h - 1);
  hintGap(g, a, b, G);
  undercut(g, b + 1, 2, G);
}

/** Clear the box and dig its chasm; returns the structure's first column. */
function site(g: Grid, rng: Rng, at: TileRect, min: number, parts: number): { G: number; s0: number; s1: number } {
  const G = at.y + at.h;
  const cross = Math.min(at.w - min - BANK, crossCols(parts));
  g.clear(at.x, at.y, at.x + at.w - 1, G - 1);
  chasm(g, rng, at.x, cross, at.y, G, parts);
  return { G, s0: at.x + cross + BANK, s1: at.x + at.w - 1 };
}

/** One-way rungs two wide at columns x, x+1, a comfortable hop apart from the ground row G up to row `top`. */
function rungs(g: Grid, x: number, top: number, G: number): void {
  const R = easyRise();
  for (let y = G - R; y > top; y -= R) for (const c of [x, x + 1]) g.set(c, y, T_ONEWAY, true);
}

/** Solid column x from row G - h to G - 1. */
function col(g: Grid, x: number, h: number, G: number): void {
  if (h > 0) g.fill(x, G - h, x, G - 1, 1, true);
}

/** The anchors of the ways through: each a rect that, filled, shuts that way. */
function ways(rects: readonly TileRect[]): Record<string, Vec> {
  const out: Record<string, Vec> = {};
  rects.forEach((r, i) => {
    out[`way${i}`] = [r.x, r.y];
    out[`way${i}s`] = [r.w, r.h];
  });
  return out;
}

/** A landmark's ways through, read back from its anchors (tests, tools). */
export function waysOf(l: Landmark): TileRect[] {
  const out: TileRect[] = [];
  for (let i = 0; l.anchors[`way${i}`]; i++) {
    const [x, y] = l.anchors[`way${i}`];
    const [w, h] = l.anchors[`way${i}s`];
    out.push({ x, y, w, h });
  }
  return out;
}

/** A list of layout numbers as one signature pair: how many, and a sum weighted by place, so a reorder shows. */
const listSig = (xs: readonly number[]): Vec => [xs.length, xs.reduce((t, v, i) => t + v * (i + 1), 0)];

const TIMBER = (rng: Rng): PropStyle => makeStyle(rng, ['rust', 'steel'], [24, 30], { woodHue: rng.range(20, 32), glowHue: rng.range(34, 46) });
const IRON = (rng: Rng): PropStyle => makeStyle(rng, ['rust', 'steel'], [20, 28], { trim: 'rivets', woodHue: rng.range(20, 30) });

/** A backdrop shell from the anchors `name` and `name`Size. */
const shell = (rng: Rng, l: Landmark, kind: 'headframe' | 'trestle' | 'facade', name = 'shell'): Module => ({
  type: 'deco',
  kind,
  at: l.anchors[name],
  w: l.anchors[`${name}Size`][0],
  h: l.anchors[`${name}Size`][1],
  seed: rng.int(0, 1 << 20),
});

/** Rocks out of a span of roof `at` (its top-left under the roof), `w` × `h`, onto the floor under it. */
const rockfall = (rng: Rng, at: Vec, w: number, h: number): Module => ({
  type: 'cavein',
  kind: 'rocks',
  at,
  w,
  h,
  off: rng.int(150, 230),
  warn: rng.int(52, 70),
  on: rng.int(40, 54),
  seed: rng.int(0, 1 << 20),
});

/** A runaway cart parked with its bottom-left at `at`, rolling `span` tiles toward `dir`. */
const runaway = (rng: Rng, at: Vec, span: number, dir: 1 | -1): Module => ({
  type: 'cart',
  at,
  w: 2,
  h: 1.1,
  span,
  dir,
  off: rng.int(130, 220),
  warn: rng.int(54, 72),
  run: Math.round(span * rng.range(4.2, 5.4)),
  back: rng.int(150, 210),
  seed: rng.int(0, 1 << 20),
});

// ------------------------------------------------------------------------------------------------ headframe

/** Structure columns the smallest headframe needs: ladder, legs, a hall with the shaft, room to drop. */
const HF_MIN = 15;
/** Rows of A-frame and winding wheel over the deck. */
const FRAME = 6;

function buildHeadframe(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const { G, s0, s1 } = site(g, rng, at, HF_MIN, parts);
  const hT = at.h - FRAME;
  const D = G - hT;
  const L = s0 + 2;
  const Rl = s1 - 2;
  // The shaft: two wide, somewhere in the hall with room either side of it.
  const sx = rng.int(L + 3, Rl - 4);
  // The deck over the hall, the shaft's mouth open in it; the legs down to doorways at the floor.
  g.fill(L, D, Rl, D, 1, true);
  g.clear(sx, D, sx + 1, D);
  for (const x of [L, Rl]) g.fill(x, D + 1, x, G - 4, 1, true);
  // The cage parks flush with the floor in a slot in it.
  g.clear(sx, G, sx + 1, G);
  // The ladder up the tower's near face; down the far one on some.
  rungs(g, s0, D, G);
  const farRungs = rng.chance(0.5);
  if (farRungs) rungs(g, Rl + 1, D, G);
  // A landing halfway up on one side of the shaft, where the cage stops too; the bins over the hall on the other, shedding rock.
  const nearW = sx - L - 1;
  const farW = Rl - sx - 2;
  const M = D + Math.max(2, Math.floor(hT / 2));
  const landing = M <= G - 4 && rng.chance(0.6) ? (rng.chance(0.5) ? -1 : 1) : 0;
  if (landing < 0) g.fill(L + 1, M, sx - 1, M, T_ONEWAY, true);
  if (landing > 0) g.fill(sx + 2, M, Rl - 1, M, T_ONEWAY, true);
  // The rockfall goes where the landing isn't (or the wider side).
  const fallFar = landing < 0 || (landing === 0 && farW > nearW);
  const f0 = fallFar ? sx + 2 : L + 1;
  const fw = fallFar ? farW : nearW;
  const mid = sx - 1;
  return {
    concept: 'headframe',
    rect: { x: at.x, y: D - FRAME, w: at.w, h: G - D + FRAME },
    air: [
      { x: sx, y: D, w: 2, h: G - D + 1 },
      { x: L + 1, y: D + 1, w: Rl - L - 1, h: G - D - 1 },
    ],
    anchors: {
      shaft: [sx, G],
      deck: [D, G],
      ...(landing ? { landing: [M, landing] as Vec } : {}),
      fall: [f0, D + 1],
      fallSize: [Math.min(4, fw), G - D - 1],
      shell: [L, D - FRAME],
      shellSize: [Rl - L + 1, G + 1 - (D - FRAME)],
      ...ways([
        { x: mid, y: D + 1, w: 1, h: G - D - 1 },
        { x: mid, y: at.y, w: 1, h: D - at.y },
      ]),
      sig0: [hT, sx - L],
      sig1: [landing, farRungs ? 1 : 0],
      sig2: [Rl - L, fw],
    },
    skin: 'planks',
  };
}

function* headframePieces(rng: Rng, l: Landmark): Generator<Piece> {
  const a = l.anchors;
  const [sx, G] = a.shaft;
  const [D] = a.deck;
  // The bins over the hall, shedding rock onto the floor, with the tower's frame and wheel behind it all.
  const [fw, fh] = a.fallSize;
  yield {
    name: rng.pick(['Loose Ore', 'The Bins', 'Falling Rock', 'Hard Hats Only']),
    archetype: 'dropper',
    role: 'hazard',
    style: TIMBER(rng),
    modules: [shell(rng, l, 'headframe'), rockfall(rng, a.fall, fw, fh)],
  };
  // The cage: a floor riding the shaft, parked flush with the floor, the landing and the deck in turn.
  const range = G - D;
  const stops = a.landing ? [G - a.landing[0]] : undefined;
  yield {
    name: rng.pick(['The Cage', 'Man Riding Cage', 'Going Down?', 'Shaft Lift']),
    archetype: 'platform',
    role: 'build',
    style: IRON(rng),
    modules: [
      {
        type: 'body',
        cells: [
          [sx, G],
          [sx + 1, G],
        ],
        material: 'metal',
        conveyor: 0,
        breakFrames: 0,
        respawnFrames: 0,
      },
      { type: 'deco', kind: 'cab', at: [sx, G - 2], w: 2, h: 2, seed: rng.int(0, 1 << 20) },
    ],
    motion: { type: 'rail', angle: -Math.PI / 2, range, period: rng.int(240, 330), dwell: rng.int(60, 100), ...(stops ? { stops } : {}) },
    // It runs flush through the deck and parks in the floor's slot: its push clearance would refuse both.
    crushOk: true,
  };
}

export const HEADFRAME = defineConcept({
  id: 'headframe',
  scale: 'grand',
  varies: [
    'tower height',
    'where the shaft is',
    'a landing (and the cage stopping there) on either side or none',
    'hall width',
    'a far ladder',
    'where the rock falls',
  ],
  weight: 3,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, HF_MIN),
  ownsCrossing: true,
  family: ['cave-in', 'ore bucket', 'runaway cart'],
  names: ['The Headframe of {place}', '{place} Pit Head', 'Number {place} Shaft', 'The Winding Tower at {place}'],
  box: (k, rng) => boxFor(k, rng, HF_MIN, [18, 26], FRAME + rng.int(9, 11)),
  build: buildHeadframe,
  pieces: (rng, _s, l) => headframePieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ trestle line

const TR_MIN = 16;

function buildTrestle(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const { G, s0, s1 } = site(g, rng, at, TR_MIN, parts);
  const hD = at.h - 3;
  const D = G - hD;
  // Up onto the trestle at its near end; the deck runs to a column short of the far end.
  rungs(g, s0, D, G);
  const d0 = s0 + 2;
  const d1 = s1 - 1;
  g.fill(d0, D, d1, D, 1, true);
  // Breaks in the track, each a hop, with deck enough between them for a cart to get going.
  const len = d1 - d0 + 1;
  const breaks: [number, number][] = [];
  const n = len >= 26 ? rng.int(2, 3) : len >= 18 ? rng.int(1, 2) : 1;
  for (let i = 0, tries = 0; i < n && tries < 40; tries++) {
    const w = hopGap(rng, 2);
    const x = rng.int(d0 + 4, d1 - 3 - w);
    if (breaks.some(([b, bw]) => x + w + 4 > b && x < b + bw + 4)) continue;
    breaks.push([x, w]);
    i++;
  }
  breaks.sort((p, q) => p[0] - q[0]);
  for (const [x, w] of breaks) g.clear(x, D, x + w - 1, D);
  // The deck's stretches between the breaks.
  const runs: [number, number][] = [];
  let x = d0;
  for (const [b, w] of [...breaks, [d1 + 1, 0] as [number, number]]) {
    if (b - x >= 1) runs.push([x, b - 1]);
    x = b + w;
  }
  const mid = Math.floor((d0 + d1) / 2);
  const wc = breaks.some(([b, w]) => mid >= b && mid < b + w) ? d0 + 1 : mid;
  return {
    concept: 'trestle-line',
    rect: { x: at.x, y: D - 3, w: at.w, h: G - D + 3 },
    air: [{ x: d0, y: D + 1, w: d1 - d0 + 1, h: G - D - 1 }],
    anchors: {
      deck: [D, G],
      ground: [d0, d1],
      ...Object.fromEntries(runs.map((r, i) => [`run${i}`, r as Vec])),
      shell: [d0, D],
      shellSize: [d1 - d0 + 1, G + 1 - D],
      ...ways([
        { x: wc, y: D + 1, w: 1, h: G - D - 1 },
        { x: wc, y: at.y, w: 1, h: D - at.y },
      ]),
      sig0: [hD, breaks.length],
      sig1: listSig(breaks.map(([b]) => b - d0)),
      sig2: listSig(breaks.map(([, w]) => w)),
    },
    skin: 'planks',
  };
}

function* trestlePieces(rng: Rng, l: Landmark): Generator<Piece> {
  const a = l.anchors;
  const [D, G] = a.deck;
  const [g0, g1] = a.ground;
  // The low line under the trestle: a cart running the length of it, the bents standing behind.
  const span = Math.min(14, g1 - g0 - 2);
  const dir: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  yield {
    name: rng.pick(['Low Line', 'The 4:15 Downhill', 'Runaway Cart', 'No Brakes']),
    archetype: 'crusher',
    role: 'hazard',
    style: IRON(rng),
    modules: [shell(rng, l, 'trestle'), runaway(rng, [dir > 0 ? g0 : g0 + span, G], span, dir)],
  };
  // On top: a runaway on the longest stretch of track, rolling toward a break.
  let best: Vec | null = null;
  for (let i = 0; a[`run${i}`]; i++) if (!best || a[`run${i}`][1] - a[`run${i}`][0] > best[1] - best[0]) best = a[`run${i}`];
  if (!best || best[1] - best[0] + 1 < 8) return;
  const [r0, r1] = best;
  const top = Math.min(10, r1 - r0 - 1);
  const d2: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  yield {
    name: rng.pick(['High Line', 'Express Ore', 'Mind The Gap', 'Rickety Express']),
    archetype: 'crusher',
    role: 'hazard',
    style: IRON(rng),
    modules: [runaway(rng, [d2 > 0 ? r0 : r0 + top, D], top, d2)],
  };
}

export const TRESTLE_LINE = defineConcept({
  id: 'trestle-line',
  varies: ['deck height', 'how many breaks in the track, where and how wide', 'trestle length', 'which way each cart runs', 'a cart on top or none'],
  weight: 3,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, TR_MIN),
  ownsCrossing: true,
  family: ['runaway cart', 'minecart', 'cave-in'],
  names: ['The Trestle Line of {place}', '{place} Railway', 'The {place} Express', 'The High Line at {place}'],
  box: (k, rng) => boxFor(k, rng, TR_MIN, [24, 40], 3 + rng.int(5, 7)),
  build: buildTrestle,
  pieces: (rng, _s, l) => trestlePieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ ore crusher

const OC_MIN = 15;

function buildCrusher(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const { G, s0, s1 } = site(g, rng, at, OC_MIN, parts);
  const hH = at.h - 4;
  const T = G - hH;
  const h0 = s0 + 2;
  const h1 = s1 - rng.int(1, 2);
  // The house: iron to the roof, the cart tunnel through its foot, the hopper down its middle into the tunnel.
  g.fill(h0, T, h1, G - 1, 1, true);
  g.clear(h0, G - 3, h1, G - 1);
  const hx = rng.int(h0 + 3, h1 - 4);
  g.clear(hx, T, hx + 1, G - 4);
  // A step on the roof's far end now and then: a motor housing.
  const motor = h1 - hx >= 6 && rng.chance(0.5);
  if (motor) g.fill(h1 - 1, T - 1, h1, T - 1, 1, true);
  rungs(g, s0, T, G);
  const wc = Math.floor((h0 + hx) / 2);
  return {
    concept: 'ore-crusher',
    rect: { x: at.x, y: T - 4, w: at.w, h: G - T + 4 },
    air: [
      { x: h0, y: G - 3, w: h1 - h0 + 1, h: 3 },
      { x: hx, y: T, w: 2, h: G - T },
    ],
    anchors: {
      house: [h0, h1],
      roof: [T, G],
      hopper: [hx, T],
      motor: [motor ? 1 : 0, 0],
      shell: [h0, T - 4],
      shellSize: [h1 - h0 + 1, G + 1 - (T - 4)],
      ...ways([
        { x: wc, y: G - 3, w: 1, h: 3 },
        { x: wc, y: at.y, w: 1, h: T - at.y },
      ]),
      sig0: [hH, h1 - h0],
      sig1: [hx - h0, motor ? 1 : 0],
    },
    skin: 'rustplate',
  };
}

function* crusherPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const a = l.anchors;
  const [h0, h1] = a.house;
  const [T, G] = a.roof;
  const [hx] = a.hopper;
  // Ore pouring down the hopper into the tunnel, the crusher's works behind the house.
  yield {
    name: rng.pick(['The Hopper', 'Ore Chute', 'Rock Bottom', 'Gravel Rain']),
    archetype: 'dropper',
    role: 'hazard',
    style: IRON(rng),
    modules: [shell(rng, l, 'facade'), rockfall(rng, [hx, T], 2, G - T)],
  };
  // The feed belts on the roof, both carrying toward the hopper.
  const speed = rng.int(50, 85);
  const near: [number, number][] = [];
  const far: [number, number][] = [];
  for (let x = h0 + 1; x < hx; x++) near.push([x, T - 1]);
  for (let x = hx + 2; x < h1 - (a.motor[0] ? 1 : 0); x++) far.push([x, T - 1]);
  const belts: Module[] = [];
  if (near.length >= 2) belts.push({ type: 'body', cells: near, material: 'conveyor', conveyor: speed, breakFrames: 0, respawnFrames: 0 });
  if (far.length >= 2) belts.push({ type: 'body', cells: far, material: 'conveyor', conveyor: -speed, breakFrames: 0, respawnFrames: 0 });
  if (belts.length)
    yield {
      name: rng.pick(['Feed Belt', 'Ore Conveyor', 'The Treadmill', 'Into The Hopper']),
      archetype: 'platform',
      role: 'utility',
      style: IRON(rng),
      modules: belts,
    };
  // A cart through the tunnel, toward the hopper, now and then.
  const span = hx - h0 - 3;
  if (span >= 5 && rng.chance(0.65))
    yield {
      name: rng.pick(['Ore Cart', 'Runaway Cart', 'Feed Cart', 'Next Stop: Gravel']),
      archetype: 'crusher',
      role: 'hazard',
      style: IRON(rng),
      modules: [runaway(rng, [h0 - 1, G], span, 1)],
    };
}

export const ORE_CRUSHER = defineConcept({
  id: 'ore-crusher',
  varies: ['house width and height', 'where the hopper is', 'a motor housing on the roof or none', 'belt speed', 'a cart in the tunnel or none'],
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, OC_MIN),
  ownsCrossing: true,
  family: ['cave-in', 'runaway cart', 'drill'],
  names: ['The Ore Crusher of {place}', 'The {place} Stamp Mill', 'The Grinder at {place}', '{place} Crushing Works'],
  box: (k, rng) => boxFor(k, rng, OC_MIN, [16, 22], 4 + rng.int(7, 10)),
  build: buildCrusher,
  pieces: (rng, _s, l) => crusherPieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ crystal geode

const GE_MIN = 16;

function buildGeode(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const { G, s0, s1 } = site(g, rng, at, GE_MIN, parts);
  const H = g.h;
  const gx0 = s0 + 2 + rng.int(0, 1);
  const gx1 = s1 - rng.int(0, 1);
  const a = (gx1 - gx0) / 2;
  const cx = (gx0 + gx1) / 2;
  // The base: walls straight up from the floor; the dome over them, a half ellipse.
  const wallH = rng.int(4, 5);
  const yS = G - wallH;
  const b = at.h - 2 - wallH;
  const top = yS - b;
  const inside = (x: number, y: number, ra: number, rb: number) => {
    const dx = (x - cx) / ra;
    const dy = y <= yS ? (y - yS) / rb : 0;
    return dx * dx + dy * dy <= 1;
  };
  for (let y = top; y < G; y++)
    for (let x = gx0; x <= gx1; x++) {
      const out = inside(x, y, a + 0.5, b + 0.5);
      const inn = inside(x, y, a - 0.6, b - 0.7);
      if (out && !inn) g.set(x, y, 1, true);
    }
  // The crack in at the floor on the near side, a window high in the far side.
  g.clear(gx0, G - 3, gx0 + 1, G - 1);
  const win = G - rng.int(5, 6);
  g.clear(gx1 - 1, win - 2, gx1, win);
  // The bowl: dug two rows into the floor where it's deep enough, the spikes go in its bottom.
  const bowl0 = gx0 + 3;
  const bowl1 = gx1 - 3;
  const deep = G + 2 < H - 1;
  if (deep) g.clear(bowl0, G, bowl1, G + 1);
  // Ledges across: two wide, a hop apart, at the window's sill height and a step under it.
  const ledges: number[] = [];
  const sill = win + 1;
  for (let x = gx0 + 2 + rng.int(0, 1), i = 0; x + 1 < gx1 - 1; i++) {
    const y = i % 2 ? sill + 1 : sill + (rng.chance(0.5) ? 1 : 2);
    g.fill(x, Math.min(G - 2, y), x + 1, Math.min(G - 2, y), T_ONEWAY, true);
    ledges.push(x);
    x += 2 + hopGap(rng, 2);
  }
  // Up the outside: crystal outcrops on the near wall, to the dome's top.
  rungs(g, s0, top, G);
  const wc = Math.round(cx);
  // Crystal breaking off the dome's crown now and then: a flat stretch of its inside, over the ledges.
  const cs = wc - 1;
  const under = (c: number) => {
    let y = top;
    while (y < G && !g.empty(c, y)) y++;
    return y;
  };
  const ft = under(cs);
  let fb = ft;
  while (fb < G + 2 && g.empty(cs, fb) && g.empty(cs + 1, fb)) fb++;
  const fall = under(cs + 1) === ft && fb - ft >= 3 && rng.chance(0.55);
  return {
    concept: 'crystal-geode',
    rect: { x: at.x, y: top - 2, w: at.w, h: G - top + 2 },
    air: [{ x: gx0 + 1, y: yS - Math.floor(b / 2), w: gx1 - gx0 - 1, h: G - yS + Math.floor(b / 2) }],
    anchors: {
      bowl: [bowl0, bowl1],
      floor: [deep ? G + 1 : G - 1, G],
      dome: [top, yS],
      ...(fall ? { fall: [cs, ft] as Vec, fallSize: [2, fb - ft] as Vec } : {}),
      shell: [gx0, top],
      shellSize: [gx1 - gx0 + 1, (deep ? G + 2 : G) - top],
      ...ways([
        { x: wc, y: top + 1, w: 1, h: G - top - 1 },
        { x: wc, y: at.y, w: 1, h: top - at.y },
      ]),
      sig0: [wallH, b],
      sig1: [win, gx1 - gx0 + (fall ? 100 : 0)],
      sig2: listSig(ledges.map((x) => x - gx0)),
    },
    skin: 'crystal',
  };
}

function* geodePieces(rng: Rng, l: Landmark): Generator<Piece> {
  const a = l.anchors;
  const [b0, b1] = a.bowl;
  const [fy] = a.floor;
  // The bowl's floor of crystal spikes, the geode's inside wall behind it all.
  const cells: [number, number][] = [];
  for (let x = b0; x <= b1; x++) cells.push([x, fy]);
  yield {
    name: rng.pick(['Crystal Bed', 'The Geode', 'Pointy Rocks', 'Birthstones']),
    archetype: 'spikestrip',
    role: 'hazard',
    style: makeStyle(rng, ['steel', 'jade'], [285, 190, 320]),
    modules: [
      shell(rng, l, 'facade'),
      { type: 'body', cells, material: 'stone', conveyor: 0, breakFrames: 0, respawnFrames: 0 },
      { type: 'spikes', cells: cells.slice(), angle: -Math.PI / 2, look: 'crystal' },
    ],
    pathSafe: true,
  };
  if (a.fall)
    yield {
      name: rng.pick(['Crystal Fall', 'Shattering Crown', 'Loose Quartz', 'Falling Gems']),
      archetype: 'dropper',
      role: 'hazard',
      style: makeStyle(rng, ['steel', 'jade'], [285, 190, 320]),
      modules: [rockfall(rng, a.fall, a.fallSize[0], a.fallSize[1])],
    };
}

export const CRYSTAL_GEODE = defineConcept({
  id: 'crystal-geode',
  varies: ['geode width and where it stands', 'wall height and dome height', 'how high the far window is', 'the ledges across (where and how high)', 'crystal falling from its crown or none'],
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, GE_MIN),
  ownsCrossing: true,
  family: ['cave-in', 'firedamp', 'ore bucket'],
  names: ['The Crystal Geode of {place}', 'The {place} Geode', 'The Glittering Hollow of {place}', '{place} Crystal Cave'],
  box: (k, rng) => boxFor(k, rng, GE_MIN, [17, 24], 2 + rng.int(10, 12)),
  build: buildGeode,
  pieces: (rng, _s, l) => geodePieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ flooded gallery

/** Gallery columns at the least, flank columns either side. */
const FG_GALLERY = 20;
const FG_FLANK = 6;
/** Rows of the gallery, floor to roof; high water; how tall a refuge rock stands. */
const FG_ROWS = 5;
const FG_HIGH = 2;
const FG_REFUGE = 3;

function buildGallery(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const { G, s0, s1 } = site(g, rng, at, FG_GALLERY + 2 * FG_FLANK, parts);
  const hM = at.h - 3;
  // The rock mass: a long slab of rock over the gallery, its top wandering a row up and down.
  const m0 = s0 + 2;
  const m1 = s1 - 2;
  const tops: number[] = [];
  let h = hM;
  for (let c = m0; c <= m1; c++) {
    if (c > m0 + 2 && c < m1 - 2 && rng.chance(0.18)) h = Math.max(hM - 1, Math.min(hM + 1, h + rng.pick([-1, 1])));
    tops.push(G - h);
    col(g, c, h, G);
  }
  // The gallery through it at the floor, end to end.
  g.clear(m0, G - FG_ROWS, m1, G - 1);
  // Up its near end on rungs; down the far one on some.
  rungs(g, s0, tops[0], G);
  const farRungs = rng.chance(0.5);
  if (farRungs) rungs(g, m1 + 1, tops[tops.length - 1], G);
  // Refuge rocks along the gallery floor, each standing over high water.
  const refuges: number[] = [];
  for (let c = m0 + 3 + rng.int(0, 2); c + 1 < m1 - 3; c += rng.int(6, 9)) {
    col(g, c, FG_REFUGE, G);
    col(g, c + 1, FG_REFUGE, G);
    refuges.push(c);
  }
  // The pump shaft, up from the gallery's roof through the top, now and then: clear of the refuges.
  let shaftX = m1 - m0 > 14 && rng.chance(0.6) ? rng.int(m0 + 4, m1 - 6) : -1;
  if (refuges.some((c) => c + 1 >= shaftX - 1 && c <= shaftX + 2)) shaftX = -1;
  if (shaftX >= 0) g.clear(shaftX, 0, shaftX + 1, G - FG_ROWS - 1);
  const pump = shaftX >= 0;
  // Runs of open floor for the water.
  const runs: [number, number][] = [];
  for (let c = m0; c <= m1; c++) {
    if (!g.empty(c, G - 1)) continue;
    const last = runs[runs.length - 1];
    if (last && last[0] + last[1] === c) last[1]++;
    else runs.push([c, 1]);
  }
  const wide = runs.reduce((bst, r) => (r[1] > bst[1] ? r : bst), runs[0] ?? [m0, 1]);
  const wc = wide[0] + (wide[1] >> 1);
  const top = Math.min(...tops);
  return {
    concept: 'flooded-gallery',
    rect: { x: at.x, y: top - 3, w: at.w, h: G - top + 3 },
    air: [{ x: m0, y: G - FG_ROWS, w: m1 - m0 + 1, h: FG_ROWS }],
    anchors: {
      floor: [m0, G],
      ...Object.fromEntries(runs.map((r, i) => [`run${i}`, r])),
      ...(pump ? { pump: [shaftX, G - hM - 1] as Vec } : {}),
      shell: [m0, G - FG_ROWS],
      shellSize: [m1 - m0 + 1, FG_ROWS + 1],
      ...ways([
        { x: wc, y: G - FG_ROWS, w: 1, h: FG_ROWS },
        { x: wc, y: at.y, w: 1, h: tops[wc - m0] - at.y },
      ]),
      sig0: [m1 - m0, refuges.length],
      sig1: [pump ? shaftX - m0 : -1, farRungs ? 1 : 0],
      sig2: listSig(refuges.map((c) => c - m0)),
      sig3: listSig(tops.map((t) => G - t)),
    },
  };
}

function* galleryPieces(rng: Rng, s: Site, l: Landmark): Generator<Piece> {
  const a = l.anchors;
  const G = a.floor[1];
  // One slow cycle for the whole gallery, so it fills as one.
  const tide = { off: rng.int(300, 420), warn: rng.int(60, 80), rise: rng.int(70, 100), hold: rng.int(90, 140), fall: rng.int(70, 100) };
  const mods: Module[] = [];
  for (let i = 0; a[`run${i}`]; i++) {
    const [x, w] = a[`run${i}`];
    const m = capFlood(s.level, { type: 'flood', look: 'water', at: [x, G], w, low: 0, high: FG_HIGH, ...tide }, [], s.cache);
    if (!m) return;
    mods.push(m);
  }
  yield {
    name: rng.pick(['The Flooded Gallery', 'Groundwater', 'Sump Tide', 'Wet Work']),
    archetype: 'fan',
    role: 'hazard',
    style: TIMBER(rng),
    modules: [shell(rng, l, 'facade'), ...mods],
  };
  // The pump, blowing the shaft clear: up from the gallery's floor to the top.
  if (a.pump) {
    const [px, top] = a.pump;
    yield {
      name: rng.pick(['Sump Pump', 'Air Shaft', 'The Blower', 'Updraft']),
      archetype: 'fan',
      role: 'utility',
      style: IRON(rng),
      modules: [{ type: 'fan', at: [px + 1, G], angle: -Math.PI / 2, length: G - top + 2, strength: rng.range(1.1, 1.4) }],
    };
  }
}

export const FLOODED_GALLERY = defineConcept({
  id: 'flooded-gallery',
  scale: 'grand',
  varies: ['gallery length', 'refuge rocks', 'a pump shaft and where', 'flank steps', 'tide timing'],
  weight: 3,
  sizes: ['wide'],
  fits: (p) => roomFor(p, FG_GALLERY + 2 * FG_FLANK + 6),
  ownsCrossing: true,
  family: ['cave-in', 'firedamp', 'runaway cart'],
  names: ['The Flooded Gallery of {place}', '{place} Sump', 'The Drowned Level at {place}', 'The Wet Seam of {place}'],
  box: (k, rng) => boxFor(k, rng, FG_GALLERY + 2 * FG_FLANK, [FG_GALLERY + 2 * FG_FLANK + 4, FG_GALLERY + 2 * FG_FLANK + 22], 3 + rng.int(8, 10)),
  build: buildGallery,
  pieces: (rng, s, l) => galleryPieces(rng, s, l),
});

// ------------------------------------------------------------------------------------------------ registry

export const MINE_CONCEPTS: Concept[] = [HEADFRAME, TRESTLE_LINE, ORE_CRUSHER, CRYSTAL_GEODE, FLOODED_GALLERY];

/** Structure columns per concept, for the chasm a level's box gets room for. */
const STRUCT: Record<string, number> = {
  headframe: HF_MIN,
  'trestle-line': TR_MIN,
  'ore-crusher': OC_MIN,
  'crystal-geode': GE_MIN,
  'flooded-gallery': FG_GALLERY + 2 * FG_FLANK,
};

/**
 * How many parts the mine landmark's own chasm takes on this attempt, given the level's `challenges`: two
 * where its box made room for a two-part one (and the attempt still insists on two, TWO_PART_TRIES), else
 * one; none when the level asks for none.
 */
export function mineOwns(c: Concept, k: Knobs, attempt: number, challenges: number): number {
  if (challenges <= 0) return 0;
  const s = STRUCT[c.id];
  return attempt < TWO_PART_TRIES && s !== undefined && crossFor(k, s) >= twoGap() && twoGap() > oneGap() ? 2 : 1;
}
