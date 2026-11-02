import { dsin } from '../../core/dmath';
import type { Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import { type LevelProfile, T_ONEWAY, type TileRect } from '../../sim/level';
import type { Module, PropStyle } from '../../sim/props';
import { type Grid, hintGap, POCKET } from '../level/kit';
import { jumpProfile, probeGravity } from '../level/probe';
import { jumpMetrics } from '../../sim/physics';
import { easyRise, hardGap, hopGap, type Knobs, pit, TWO_PART_TRIES, undercut } from '../level/sculptors/common';
import { BRIDGE_W } from '../level/types';
import { makeStyle, type Piece, SAFE_TILES, type Site } from '../setpieces/place';
import { capFlood } from './flood';
import { defineConcept } from './contract';
import type { Concept, Landmark } from './types';

/**
 * Volcano stage concepts (docs/SETPIECES.md, Volcano): five places, each one landmark that owns the
 * level's hard crossing, every one laid out afresh from its seed.
 *
 * - **The Caldera** (grand): a stepped cone across the middle of the level, its crater the crossing. Lava
 *   rises and falls in the crater and a magma serpent leaps across it; bombs fall on the flanks. Each
 *   flank is climbed (or left) two ways: over its steps, or through a lava tube under it and a shaft
 *   through the cone.
 * - **The Magma Tide** (grand, wide levels): a long basin under a broken basalt arch. A lava tide floods
 *   the basin floor on a slow cycle, with refuge rocks to wait on; the arch above is the dry way, a
 *   slab of crumbling obsidian over its break. Grates at both ends of the arch let you drop into the
 *   basin and climb back out.
 * - **The Lavafall Organ**: a cliff of basalt organ pipes stepping down from a sheer face, lava pouring
 *   off its cornices onto the terraces. Climb the face on its ledges, or go under it through a tube and
 *   up a shaft, a crack of lava dripping in the tube.
 * - **The Dragon Ribs**: a fossil skeleton half sunk in the ground, the spine a bony ridge over a cage of
 *   one-way ribs, a skull at one end breathing fire out of its mouth. Walk the spine, or go through the
 *   mouth and under the ribs past the vents between them.
 * - **The Lava Tube** (grand): a mesa with a lava tube running through it. Over the top, or drop into
 *   the tube and climb its shaft at the far end, past cooling drips from its ceiling and lava in its
 *   floor.
 *
 * Every landmark keeps a static way past itself (movers and hazards are timed, never the proof), and
 * owns the level's crossing: a lava moat in front of it, or the caldera's crater. Two-part levels get
 * a two-part crossing where the level has room for one beside the landmark (`volcanoOwns`).
 *
 * Anchors the tests and the skin read: `way{i}` / `way{i}s` is a rect that, filled, shuts one way
 * through (each way is a genuine alternative: shut one and the others still reach the flag), and
 * `sig{i}` are the structural numbers the seed rolled.
 */

/** Columns a landmark keeps from either end (sculptors/common.ts claimSite). */
const SITE_MARGIN = POCKET + SAFE_TILES;
/** Flat bank between a moat and the structure: the bridge's landing and a run-up. */
const BANK = 3;
/** Rows a tube under the ground is tall. */
const TUBE = 3;

/** The widest one-part crossing at this gravity (hardGap's top end). */
function oneGap(gravity?: number): number {
  const j = jumpProfile(gravity);
  return Math.max(j.gap + 2, BRIDGE_W + 2 * j.walkGap);
}

/**
 * The one-part crossing a classic level's box makes room for: a column short of hardGap's widest, so a
 * large landmark fits beside it in a classic level's middle (the build caps its roll at the box).
 */
function snugGap(gravity?: number): number {
  return Math.min(oneGap(gravity), jumpProfile(gravity).gap + 3);
}

/** The widest two-part crossing at this gravity. */
function twoGap(gravity?: number): number {
  const j = jumpProfile(gravity);
  return Math.max(j.gapAt(-6) + j.rise + 1, j.gap + 2 * BRIDGE_W + j.walkGap + 1);
}

/**
 * Columns for the crossing a landmark owns: a two-part one on a level that asks for two parts and has
 * room for it beside `struct` columns of structure, else a one-part one. Decided without rolling, so the
 * sculptor reads the same answer back (`volcanoOwns`).
 */
function crossFor(k: Knobs, struct: number): number {
  if (asksTwo(k) && twoGap() + struct <= k.W - 2 * SITE_MARGIN) return twoGap();
  return k.W > 56 ? oneGap() : snugGap();
}

/**
 * Share of levels whose landmark's own crossing takes two parts, where its box has room for a two-part one
 * (wide levels; a classic level's middle has none beside a landmark). A level built round a landmark has no
 * lava lakes or spare pits to need a second part by chance, the way a plain volcano level often does, so the
 * wide ones ask more often to keep the theme near TWO_PARTS (measured with `pnpm level --stats 200`).
 */
const LANDMARK_TWO = 0.3;
const asksTwo = (k: Knobs) => k.challenge < Math.max(k.twoParts, LANDMARK_TWO);

/** Does a landmark of `struct` columns fit beside a one-part crossing on this level? */
function roomFor(p: Partial<LevelProfile>, struct: number): boolean {
  return snugGap(p.gravity) + struct <= (p.w ?? 48) - 2 * SITE_MARGIN;
}

/** The crossing the build digs: as wide as `parts` take, or as the box allows. */
const crossCols = (parts: number) => (parts >= 2 ? twoGap() : oneGap());

/**
 * The lava moat in front of a landmark: a `hardGap` pit dug to the bottom at the right end of its
 * `cols` columns, its bridge hinted and its far bank undercut. Columns it doesn't need stay courtyard.
 */
function moat(g: Grid, rng: Rng, x0: number, cols: number, G: number, parts: number): void {
  if (parts <= 0) return;
  const gw = Math.min(cols, hardGap(rng, parts));
  const b = x0 + cols - 1;
  const a = b - gw + 1;
  pit(g, a, b, G, false);
  hintGap(g, a, b, G);
  undercut(g, b + 1, 2, G);
}

/**
 * A 2-wide shaft at column x from surface row `top` down to the floor row `bottom` (exclusive), with
 * one-way rungs a comfortable hop apart from the floor up and, with `lid`, a one-way lid on its mouth.
 */
function shaft(g: Grid, x: number, top: number, bottom: number, o: { rungs?: boolean; lid?: boolean } = {}): void {
  const R = easyRise();
  g.clear(x, top, x + 1, bottom - 1);
  if (o.rungs) for (let y = bottom - R; y > top; y -= R) for (const c of [x, x + 1]) g.set(c, y, T_ONEWAY, true);
  if (o.lid) for (const c of [x, x + 1]) g.set(c, top, T_ONEWAY, true);
}

/** A tube under the ground surface row G, from column a to b (inclusive): TUBE rows tall, floored below. */
function tube(g: Grid, a: number, b: number, G: number): void {
  g.clear(Math.min(a, b), G, Math.max(a, b), G + TUBE - 1);
}

/** One-way ledges two wide at columns x, x+1, a comfortable hop apart from the ground row G up to the surface row `top`. */
function ledges(g: Grid, x: number, top: number, G: number): void {
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

/** The structural numbers a landmark's seed rolled (`sig{i}` anchors), flattened. */
export function signatureOf(l: Landmark): number[] {
  const out: number[] = [];
  for (let i = 0; l.anchors[`sig${i}`]; i++) out.push(...l.anchors[`sig${i}`]);
  return out;
}

/** A list of layout numbers as one signature pair: how many, and a sum weighted by place, so a reorder shows. */
const listSig = (xs: readonly number[]): Vec => [xs.length, xs.reduce((t, v, i) => t + v * (i + 1), 0)];

/** Steps `n` columns wide in all, `count` of them, each at least one column, the spare spread at random. */
function stepWidths(rng: Rng, count: number, n: number): number[] {
  const out = Array.from({ length: count }, () => 1);
  for (let spare = n - count; spare > 0; spare--) {
    const open = out.map((w, i) => (w < 3 ? i : -1)).filter((i) => i >= 0);
    if (!open.length) break;
    out[rng.pick(open)]++;
  }
  return out;
}

const OBSIDIAN = (rng: Rng): PropStyle => makeStyle(rng, ['obsidian', 'rust'], [12, 18, 24], { glowHue: rng.range(14, 30) });

/** Falling bombs, one module each, on the stand cells `spots` (column, surface row), out of sync. */
function bombs(rng: Rng, spots: readonly Vec[], n: number): Module[] {
  const out: Module[] = [];
  for (const [x, top] of rng.shuffle(spots.slice()).slice(0, n)) {
    const to: Vec = [x + 0.5, top - 0.75];
    out.push({
      type: 'lob',
      look: 'bomb',
      from: [to[0] + rng.range(-5, 5), -3],
      to,
      apex: rng.range(0, 1),
      count: 1,
      lag: 0,
      radius: 0.7,
      off: rng.int(150, 260),
      warn: rng.int(60, 80),
      flight: rng.int(44, 56),
    });
  }
  return out;
}

const bombPiece = (rng: Rng, mods: Module[]): Piece => ({
  name: rng.pick(['Volcanic Bombs', 'Sky Rocks', 'Incoming!', 'Hot Hail']),
  archetype: 'launcher',
  role: 'hazard',
  style: OBSIDIAN(rng),
  modules: mods,
});

/** Same cycle for every flood module of a tide, so the basin fills as one. */
interface Tide {
  off: number;
  warn: number;
  rise: number;
  hold: number;
  fall: number;
}
const rollTide = (rng: Rng, slow = false): Tide => ({
  off: rng.int(slow ? 340 : 180, slow ? 440 : 260),
  warn: rng.int(60, 80),
  rise: rng.int(70, 100),
  hold: rng.int(slow ? 90 : 80, slow ? 140 : 140),
  fall: rng.int(70, 100),
});

// ------------------------------------------------------------------------------------------------ caldera

/** Structure columns the smallest caldera needs: flanks, plateaus and one tube. */
const CALDERA_MIN = 19;

function buildCaldera(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const G = at.y + at.h;
  const H = g.h;
  const cross = Math.min(at.w - CALDERA_MIN, crossCols(parts));
  const S = at.w - cross;
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  // Tubes run under the ground, so they need rows below it.
  const tubeOK = G + TUBE + 1 <= H - 1;
  const nearTube = tubeOK && rng.chance(0.6);
  const farTube = tubeOK && (!nearTube || rng.chance(S > 24 ? 0.6 : 0.2));
  // The near plateau is a run-up at the crater, past the shaft's lid.
  const pn = nearTube ? 6 : 5;
  const pf = farTube ? 6 : 4;
  const ends = (nearTube ? 2 : 0) + (farTube ? 2 : 0);
  const budget = S - pn - pf - ends;
  let ns = Math.min(rng.int(3, S > 26 ? 5 : 4), Math.floor((G - 5) / R));
  while (ns > 2 && budget < 2 * (ns - 1)) ns--;
  const hR = ns * R;
  // Spare columns widen the steps; any beyond go to the near foot.
  const steps = stepWidths(rng, 2 * (ns - 1), Math.min(budget, 6 * (ns - 1)));
  const lead = budget - steps.reduce((a, b) => a + b, 0);
  const near = steps.slice(0, ns - 1);
  const far = steps.slice(ns - 1);
  const rim = G - hR;

  let x = at.x + lead;
  const entry = x;
  if (nearTube) x += 2;
  const step1 = x;
  near.forEach((w, i) => {
    for (let c = 0; c < w; c++) col(g, x++, (i + 1) * R, G);
  });
  const p0 = x;
  // The near plateau takes whatever of the crater's columns its pit doesn't.
  const gw = parts > 0 ? Math.min(cross, hardGap(rng, parts)) : Math.min(cross, hopGap(rng, 2));
  const plateauN = pn + cross - gw;
  for (let c = 0; c < plateauN; c++) col(g, x++, hR, G);
  const a = x;
  const b = a + gw - 1;
  x = b + 1;
  for (let c = 0; c < pf; c++) col(g, x++, hR, G);
  // Down the far flank, its steps in the opposite order to the near one's.
  for (let i = 0; i < far.length; i++) for (let c = 0; c < far[far.length - 1 - i]; c++) col(g, x++, (ns - 1 - i) * R, G);
  const exit = x;

  // The crater: open to the bottom, its far lip overhanging.
  pit(g, a, b, rim, false);
  if (parts > 0) {
    hintGap(g, a, b, rim);
    undercut(g, b + 1, 2, rim);
  }
  // The tubes: under the near flank and up a shaft through the plateau; down a chute in the far plateau and out under the far flank.
  if (nearTube) {
    tube(g, entry, p0 + 1, G);
    shaft(g, p0, rim, G + TUBE, { rungs: true, lid: true });
  }
  const chute = b + 4;
  if (farTube) {
    tube(g, chute, exit + 1, G);
    shaft(g, chute, rim, G);
    shaft(g, exit, G, G + TUBE, { rungs: true });
  }
  const shut: TileRect[] = nearTube
    ? [
        { x: step1, y: 0, w: 1, h: G - R },
        { x: step1, y: G, w: 1, h: TUBE },
      ]
    : [
        { x: chute + 2, y: 0, w: 1, h: rim },
        { x: chute + 2, y: G, w: 1, h: TUBE },
      ];
  const stands: Vec[] = [];
  for (let c = step1; c < exit; c++) {
    const top = g.surface(c, 0);
    if (top < G && (c < a - 1 || c > b + 3) && g.empty(c, top - 1) && g.empty(c, top - 2)) stands.push([c, top]);
  }
  return {
    concept: 'caldera',
    // The cone and the ash column over it.
    rect: { x: at.x, y: Math.max(1, G - Math.max(hR + 3, 16)), w: at.w, h: Math.min(G - 1, Math.max(hR + 3, 16)) },
    air: [{ x: a, y: 0, w: gw + 2, h: rim + 2 }],
    anchors: {
      crater: [a, b],
      rim: [rim, H],
      ...Object.fromEntries(stands.map((s, i) => [`stand${i}`, s])),
      ...ways(shut),
      ...(nearTube ? { tubeN: [entry, p0 + 2 - entry] as Vec } : {}),
      ...(farTube ? { tubeF: [chute, exit + 2 - chute] as Vec } : {}),
      ground: [G, 0],
      sig0: [ns, gw],
      sig1: [(nearTube ? 1 : 0) + (farTube ? 2 : 0), p0 - at.x],
      sig2: listSig(near),
      sig3: listSig(far),
    },
  };
}

/** The stand cells (column, surface row) a landmark recorded as `stand{i}`. */
function standsOf(l: Landmark): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; l.anchors[`stand${i}`]; i++) out.push(l.anchors[`stand${i}`]);
  return out;
}

function* calderaPieces(rng: Rng, s: Site, l: Landmark): Generator<Piece> {
  const [a, b] = l.anchors.crater;
  const [rim, H] = l.anchors.rim;
  const gw = b - a + 1;
  const tide = rollTide(rng);
  const lava = capFlood(s.level, { type: 'flood', look: 'lava', at: [a, H], w: gw + 2, low: 0, high: Math.max(2, H - rim - 3), ...tide }, [], s.cache);
  if (!lava) return;
  // The serpent leaps out of the crater's lava over the rim's height, and dives back in on the far side.
  const peak = rim - rng.range(0.5, 2.5);
  const ends: [Vec, Vec] = [
    [a + 0.5 + rng.int(0, 1), H - 0.6],
    [b + 2.5 - rng.int(0, 1), H - 0.6],
  ];
  if (rng.chance(0.4)) ends.reverse();
  yield {
    name: rng.pick(['The Caldera', 'Crater Lake', 'Magma Serpent', 'Old Smoky']),
    archetype: 'flamer',
    role: 'hazard',
    style: OBSIDIAN(rng),
    modules: [
      // The ash column out of the crater, its box down to the crater's floor.
      { type: 'deco', kind: 'facade', at: [a - 1, 0], w: gw + 4, h: H, seed: rng.int(0, 1 << 20) },
      // The tubes' far walls: what the flanks stand on, seen through the tunnels under them.
      ...(['tubeN', 'tubeF'] as const)
        .filter((k) => l.anchors[k])
        .map((k): Module => ({
          type: 'deco',
          kind: 'facade',
          at: [l.anchors[k][0], l.anchors.ground[0]],
          w: l.anchors[k][1],
          h: TUBE,
          seed: rng.int(0, 1 << 20),
        })),
      lava,
      {
        type: 'lob',
        look: 'serpent',
        from: ends[0],
        to: ends[1],
        apex: H - 0.6 - peak,
        count: rng.int(5, 7),
        lag: rng.int(5, 7),
        radius: 0.6,
        off: rng.int(170, 260),
        warn: rng.int(55, 70),
        flight: rng.int(105, 135),
      },
    ],
  };
  const spots = standsOf(l);
  if (spots.length) yield bombPiece(rng, bombs(rng, spots, rng.int(1, 3)));
}

export const CALDERA = defineConcept({
  id: 'caldera',
  scale: 'grand',
  varies: ['crater width', 'cone height (steps)', 'step widths', 'which flanks have a tube', 'serpent arc and side', 'where the bombs fall'],
  weight: 3,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, CALDERA_MIN),
  ownsCrossing: true,
  family: ['lava plume', 'bombs', 'spitter', 'serpent'],
  names: ['The Caldera of {place}', 'Mount {place}', '{place} Crater', 'The Smoking Cone of {place}'],
  box: (k, rng) => {
    const cross = crossFor(k, CALDERA_MIN);
    const room = k.W - 2 * SITE_MARGIN - cross;
    const struct = k.W > 56 ? rng.int(Math.min(room, 26), Math.min(room, 40)) : Math.min(room, CALDERA_MIN + rng.int(0, 2));
    return { w: cross + struct, h: 3 * easyRise() + 4 };
  },
  build: buildCaldera,
  pieces: (rng, s, l) => calderaPieces(rng, s, l),
});

// ------------------------------------------------------------------------------------------------ magma tide

/** Basin columns the tide wants at the least, and abutment columns either side. */
const TIDE_BASIN = 18;
const TIDE_ABUT = 7;

/** Rows from the basin floor to the arch's deck: refuges and the exit stair stand under it with room to spare. */
function tideDeck(): number {
  const t = tideRows();
  return t.stair + Math.max(2, Math.min(hop(), easyRise()));
}

/** Rows the tallest step a runner climbs without a wall can be, at this gravity. */
function hop(): number {
  return Math.max(1, Math.floor(jumpMetrics(probeGravity()).jumpHeight));
}

/** The tide's rows: how high it rises, the refuges just above that, and the stair top under the far grate. */
function tideRows(): { high: number; refuge: number; stair: number } {
  const high = Math.max(1, Math.min(easyRise(), hop() - 1));
  const refuge = high + 1;
  return { high, refuge, stair: refuge + Math.max(1, Math.min(hop() - 1, easyRise())) };
}

function buildTide(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const G = at.y + at.h;
  const cross = Math.min(at.w - BANK - 2 * TIDE_ABUT - TIDE_BASIN, crossCols(parts));
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  moat(g, rng, at.x, cross, G, parts);
  const D = tideDeck();
  const deck = G - D;
  const n = Math.ceil(D / R);
  const tr = tideRows();
  // Abutments: steps up to the deck, outside the basin.
  const x0 = at.x + cross + BANK;
  const near = stepWidths(rng, n, n + rng.int(0, n));
  const far = stepWidths(rng, n, n + rng.int(0, n));
  let x = x0;
  near.forEach((w, i) => {
    for (let c = 0; c < w; c++) col(g, x++, Math.min(D, (i + 1) * R), G);
  });
  const b0 = x;
  const fw = far.reduce((s, w) => s + w, 0);
  const b1 = at.x + at.w - 2 - fw;
  x = b1 + 1;
  far.forEach((w, i) => {
    for (let c = 0; c < w; c++) col(g, x++, Math.min(D, (n - i) * R), G);
  });
  // The arch: grates at both ends (drop in, climb out), a deck thickening toward its springers, a hop-wide break in it.
  const span = b1 - b0 + 1;
  // Thicker toward its ends, as far as leaves headroom over the refuges, and thin over the drop and the climb out.
  const extra = Math.max(0, Math.min(2, D - tr.refuge - 3));
  const tAt = (c: number) => (c - b0 < 5 || b1 - c < 5 ? 1 : 1 + Math.round(extra * (1 - dsin((Math.PI * (c - b0 + 0.5)) / span))));
  for (let c = b0; c <= b1; c++) g.fill(c, deck, c, deck + tAt(c) - 1, 1, true);
  for (const c of [b0, b0 + 1, b1 - 1, b1]) {
    g.clear(c, deck, c, deck + 3);
    g.set(c, deck, T_ONEWAY, true);
  }
  const gapW = 2;
  const gx = rng.int(b0 + 5, b1 - 5 - gapW);
  g.clear(gx, deck, gx + gapW - 1, deck + 3);
  // The exit stair under the far grate, and refuge rocks along the floor, each above high water.
  const Rf = tr.refuge;
  col(g, b1 - 3, Rf, G);
  col(g, b1 - 2, Rf, G);
  col(g, b1 - 1, tr.stair, G);
  col(g, b1, tr.stair, G);
  const refuges: number[] = [];
  for (let c = b0 + 3 + rng.int(0, 3); c + 1 < b1 - 6; c += rng.int(6, 9)) {
    col(g, c, Rf, G);
    col(g, c + 1, Rf, G);
    refuges.push(c);
  }
  // Runs of open floor, for the tide.
  const runs: [number, number][] = [];
  for (let c = b0; c <= b1 - 4; c++) {
    if (!g.empty(c, G - 1)) continue;
    const last = runs[runs.length - 1];
    if (last && last[0] + last[1] === c) last[1]++;
    else runs.push([c, 1]);
  }
  const mid = runs.reduce((best, r) => (r[1] > best[1] ? r : best), runs[0]);
  const wc = mid[0] + (mid[1] >> 1);
  const deckStands: Vec[] = [];
  for (let c = b0 + 2; c <= b1 - 2; c++) if (c < gx || c >= gx + gapW) deckStands.push([c, deck]);
  return {
    concept: 'magma-tide',
    rect: { x: x0, y: deck - 4, w: at.x + at.w - x0, h: G - deck + 4 },
    air: [{ x: b0, y: deck + 1, w: span, h: G - deck - 1 }],
    anchors: {
      floor: [b0, G],
      gap: [gx, deck],
      facade: [b0, deck],
      facadeSize: [span, D],
      gapW: [gapW, 0],
      ...Object.fromEntries(runs.map((r, i) => [`run${i}`, r])),
      ...Object.fromEntries(deckStands.map((s, i) => [`stand${i}`, s])),
      ...ways([
        { x: wc, y: 0, w: 1, h: deck },
        { x: wc, y: deck + tAt(wc), w: 1, h: G - deck - tAt(wc) },
      ]),
      sig0: [span, refuges.length],
      sig1: [gx - b0, near.reduce((s, w) => s + w, 0)],
      sig2: listSig(refuges.map((c) => c - b0)),
    },
  };
}

function* tidePieces(rng: Rng, s: Site, l: Landmark): Generator<Piece> {
  const G = l.anchors.floor[1];
  const tide = rollTide(rng, true);
  const mods: Module[] = [];
  for (let i = 0; l.anchors[`run${i}`]; i++) {
    const [x, w] = l.anchors[`run${i}`];
    const m = capFlood(s.level, { type: 'flood', look: 'lava', at: [x, G], w, low: 0, high: tideRows().high, ...tide }, [], s.cache);
    if (!m) return;
    mods.push(m);
  }
  yield {
    name: rng.pick(['The Magma Tide', 'High Lava', 'Lava Tide', 'The Wave Pool']),
    archetype: 'flamer',
    role: 'hazard',
    style: OBSIDIAN(rng),
    modules: [
      { type: 'deco', kind: 'facade', at: l.anchors.facade, w: l.anchors.facadeSize[0], h: l.anchors.facadeSize[1], seed: rng.int(0, 1 << 20) },
      ...mods,
    ],
  };
  // The arch's break, slabbed over with obsidian that gives under you.
  const [gx, deck] = l.anchors.gap;
  const gapW = l.anchors.gapW[0];
  yield {
    name: rng.pick(['Obsidian Bridge', 'Glass Floor', 'Crunchy Shortcut']),
    archetype: 'crumble',
    role: 'hazard',
    style: OBSIDIAN(rng),
    modules: [
      {
        type: 'body',
        cells: Array.from({ length: gapW }, (_, i) => [gx + i, deck] as [number, number]),
        material: 'crumble',
        conveyor: 0,
        breakFrames: rng.int(16, 26),
        respawnFrames: rng.int(180, 260),
        look: 'obsidian',
      },
    ],
    pathSafe: true,
  };
  yield bombPiece(rng, bombs(rng, standsOf(l), rng.int(1, 3)));
}

export const MAGMA_TIDE = defineConcept({
  id: 'magma-tide',
  scale: 'grand',
  varies: ['basin length', 'refuge rocks', 'where the arch is broken', 'abutment steps', 'tide timing'],
  weight: 3,
  sizes: ['wide'],
  fits: (p) => roomFor(p, BANK + 2 * TIDE_ABUT + TIDE_BASIN + 6),
  ownsCrossing: true,
  family: ['bombs', 'serpent', 'spitter', 'lava plume'],
  names: ['The Magma Tide of {place}', '{place} Lava Flats', 'High Lava at {place}', 'The Burning Shallows of {place}'],
  box: (k, rng) => {
    const struct = BANK + 2 * TIDE_ABUT + TIDE_BASIN;
    const cross = crossFor(k, struct + 4);
    const room = k.W - 2 * SITE_MARGIN - cross;
    return { w: cross + rng.int(Math.min(room, struct + 4), Math.min(room, struct + 26)), h: tideDeck() + 4 };
  },
  build: buildTide,
  pieces: (rng, s, l) => tidePieces(rng, s, l),
});

// ------------------------------------------------------------------------------------------------ lavafall organ

const ORGAN_MIN = 15;

function buildOrgan(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const G = at.y + at.h;
  const H = g.h;
  const cross = Math.min(at.w - ORGAN_MIN, crossCols(parts));
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  moat(g, rng, at.x, cross, G, parts);
  const tubeOK = G + TUBE + 1 <= H - 1;
  // The entry hole, the ledges up the face, the face.
  const hole = at.x + cross + BANK;
  const face = hole + 4;
  const hF = Math.min(G - 5, rng.int(3, 4) * R + rng.int(0, 1));
  const x1 = at.x + at.w - 1;
  // Terraces of pipes stepping down from the face, a drop of up to a jump's rise each; the last steps down to the ground.
  const groups: { x: number; w: number; h: number }[] = [];
  let x = face;
  let h = hF;
  while (h > 0 && x <= x1 - 1) {
    const w = Math.min(x1 - x, rng.int(2, 4));
    if (w <= 0) break;
    groups.push({ x, w, h });
    x += w;
    h -= h > 2 * R + 1 && rng.chance(0.55) ? R + 1 : rng.int(1, R);
    if (x1 - x < Math.ceil(h / R)) h = Math.min(h, (x1 - x) * R);
  }
  // The tube under the face comes up a shaft through the second or third terrace.
  const k = Math.max(0, Math.min(groups.length - 1, rng.int(1, 2)));
  const sx = groups[k].x + (groups[k].w > 2 ? rng.int(0, groups[k].w - 2) : 0);
  for (const gr of groups)
    for (let c = 0; c < gr.w; c++) {
      // Organ pipes: each a column of its own, a row proud of its terrace now and then.
      const x = gr.x + c;
      const j = gr.w > 2 && c > 0 && c < gr.w - 1 && (x < sx || x > sx + 1) && rng.chance(0.35) ? 1 : 0;
      col(g, x, gr.h + j, G);
    }
  ledges(g, face - 2, G - hF, G);
  // Cornices where a terrace drops a full jump or more: lava pours off them onto the terrace below.
  const falls: { x: number; y: number; len: number }[] = [];
  for (let i = 1; i < groups.length; i++) {
    const hi = groups[i - 1];
    const lo = groups[i];
    if (hi.h - lo.h < R + 1 || lo.w < 2 || i === k) continue;
    g.set(lo.x, G - hi.h, 1, true);
    falls.push({ x: lo.x, y: G - hi.h + 1, len: hi.h - lo.h - 1 });
  }
  if (tubeOK && groups.length > 1) {
    tube(g, hole, sx + 1, G);
    shaft(g, sx, G - groups[k].h, G + TUBE, { rungs: true, lid: true });
  }
  const crack = face + 1;
  return {
    concept: 'lavafall-organ',
    rect: { x: hole, y: G - hF - 3, w: x1 - hole + 1, h: hF + 3 },
    air: [{ x: face - 2, y: G - hF - 2, w: 2, h: hF + 2 }],
    anchors: {
      ...Object.fromEntries(falls.map((f, i) => [`fall${i}`, [f.x, f.y] as Vec])),
      ...Object.fromEntries(falls.map((f, i) => [`fallLen${i}`, [f.len, 0] as Vec])),
      crack: [crack, G],
      tubeOK: [tubeOK ? 1 : 0, 0],
      facade: [face, G - hF],
      facadeSize: [x - face, hF + (tubeOK ? TUBE : 0)],
      ...ways([
        { x: face - 2, y: 0, w: 2, h: G },
        { x: face, y: G, w: 1, h: TUBE },
      ]),
      sig0: [hF, groups.length],
      sig1: [falls.length, k],
      sig2: listSig(groups.map((gr) => gr.h)),
    },
  };
}

function* organPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const mods: Module[] = [];
  for (let i = 0; l.anchors[`fall${i}`]; i++) {
    const [x, y] = l.anchors[`fall${i}`];
    const len = l.anchors[`fallLen${i}`][0];
    mods.push({
      type: 'geyser',
      look: 'lava',
      at: [x + 0.5, y],
      angle: Math.PI / 2,
      width: 0.9,
      length: len + 0.5,
      off: rng.int(110, 170),
      warn: rng.int(50, 64),
      on: rng.int(50, 80),
      lethal: true,
      strength: 0,
    });
  }
  // A crack in the tube's roof, dripping lava across it.
  if (l.anchors.tubeOK[0]) {
    const [cx, G] = l.anchors.crack;
    mods.push({
      type: 'geyser',
      look: 'lava',
      at: [cx + 0.5, G],
      angle: Math.PI / 2,
      width: 0.8,
      length: TUBE,
      off: rng.int(120, 180),
      warn: 50,
      on: rng.int(40, 60),
      lethal: true,
      strength: 0,
    });
  }
  if (!mods.length) return;
  yield {
    name: rng.pick(['Lavafall Organ', 'The Pipe Organ', 'Basalt Falls', 'Toccata in Lava']),
    archetype: 'flamer',
    role: 'hazard',
    style: OBSIDIAN(rng),
    modules: [
      { type: 'deco', kind: 'facade', at: l.anchors.facade, w: l.anchors.facadeSize[0], h: l.anchors.facadeSize[1], seed: rng.int(0, 1 << 20) },
      ...mods,
    ],
  };
}

export const LAVAFALL_ORGAN = defineConcept({
  id: 'lavafall-organ',
  varies: ['face height', 'terraces (count, widths, drops)', 'which drops pour lava', 'where the shaft comes up', 'pipe heights'],
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, ORGAN_MIN + BANK),
  ownsCrossing: true,
  family: ['lavafall', 'bombs', 'spitter'],
  names: ['The Lavafall Organ of {place}', '{place} Falls', 'The Pipes of {place}', '{place} Cathedral Rock'],
  box: (k, rng) => {
    const cross = crossFor(k, ORGAN_MIN + BANK);
    const room = k.W - 2 * SITE_MARGIN - cross;
    return { w: cross + BANK + Math.min(room - BANK, k.W > 56 ? rng.int(20, 30) : ORGAN_MIN + rng.int(0, 3)), h: 4 * easyRise() + 5 };
  },
  build: buildOrgan,
  pieces: (rng, _s, l) => organPieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ dragon ribs

const RIBS_MIN = 17;

function buildRibs(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const G = at.y + at.h;
  const cross = Math.min(at.w - RIBS_MIN - BANK, crossCols(parts));
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  moat(g, rng, at.x, cross, G, parts);
  const s0 = at.x + cross + BANK;
  const s1 = at.x + at.w - 1;
  const skullFirst = rng.chance(0.5);
  const dir = skullFirst ? 1 : -1;
  const skullW = at.w - cross - BANK > RIBS_MIN + 2 ? rng.int(5, 6) : rng.int(4, 5);
  const base = rng.int(4, 5);
  const bump = rng.int(0, 2);
  const tailW = Math.ceil(base / R) + 1;
  // Head first: ledges, skull, spine, tail. Tail first: tail, spine, skull, a column behind it.
  const kx0 = skullFirst ? s0 + 2 : s1 - skullW;
  const kx1 = kx0 + skullW - 1;
  const spineA = skullFirst ? kx1 + 1 : s0 + tailW;
  const spineB = skullFirst ? s1 - tailW : kx0 - 1;
  const len = spineB - spineA + 1;
  const sh = (c: number) => base + Math.round(bump * dsin((Math.PI * (c - spineA + 0.5)) / len));
  // The skull: a cranium a little above the spine, its mouth a way through at the ground, ledges up its brow.
  const top = G - sh(skullFirst ? spineA : spineB) - 2;
  // A cranium rounded at the back, a snout stepping down to the front, over the mouth's passage.
  for (let c = kx0; c <= kx1; c++) {
    const out = dir > 0 ? c - kx0 : kx1 - c;
    const drop = out === 0 ? 2 : out === 1 ? 1 : c === (dir > 0 ? kx1 : kx0) ? 1 : 0;
    g.fill(c, top + drop, c, G - 4, 1, true);
  }
  if (skullFirst) ledges(g, kx0 - 2, top + 1, G);
  // The spine: a ridge of bone with a knob every few vertebrae, ribs of one-way bone curving down from it to the ground.
  for (let c = spineA; c <= spineB; c++) {
    const y = G - sh(c);
    g.set(c, y, 1, true);
  }
  const ribs: number[] = [];
  const pitch = rng.int(3, 4);
  for (let c = spineA + 1 + rng.int(0, 1); c < spineB; c += pitch) {
    const y0 = G - sh(c) + 1;
    const n = G - y0;
    for (let t = 0; t < n; t++) {
      const rx = c + Math.round(dir * 1.6 * (t / Math.max(1, n - 1)) ** 2);
      if (rx >= spineA && rx <= spineB) g.set(rx, y0 + t, T_ONEWAY, true);
    }
    ribs.push(c);
  }
  // The tail: one-way vertebrae stepping down from the spine's free end to the ground.
  const end = skullFirst ? spineB : spineA;
  for (let i = 1, y = G - sh(end) + R; y < G; i++, y += R) g.set(end + dir * i, y, T_ONEWAY, true);
  const vents: number[] = [];
  for (let i = 0; i + 1 < ribs.length; i++) {
    const c = ribs[i] + Math.floor(pitch / 2) + (skullFirst ? 0 : -1);
    if (c > spineA + 1 && c < spineB - 1 && g.empty(c, G - 1) && g.empty(c, G - 2)) vents.push(c);
  }
  const mid = Math.floor((spineA + spineB) / 2);
  const stands: Vec[] = [];
  for (let c = spineA; c <= spineB; c++) if (g.empty(c, G - sh(c) - 1) && g.empty(c, G - sh(c) - 2)) stands.push([c, G - sh(c)]);
  return {
    concept: 'dragon-ribs',
    rect: { x: s0, y: top - 3, w: s1 - s0 + 1, h: G - top + 3 },
    air: [{ x: spineA, y: G - base - bump + 1, w: len, h: base + bump - 1 }],
    anchors: {
      skull: [kx0, top],
      skullW: [skullW, dir],
      facade: [s0, top],
      facadeSize: [s1 - s0 + 1, G - top],
      skullBox: [kx0, top],
      skullSize: [skullW, G - top],
      ground: [G, end],
      ...Object.fromEntries(vents.map((c, i) => [`vent${i}`, [c, G - sh(c) + 1] as Vec])),
      ...Object.fromEntries(stands.map((s, i) => [`stand${i}`, s])),
      ...ways([
        { x: mid, y: 0, w: 1, h: G - sh(mid) },
        { x: mid, y: G - sh(mid) + 1, w: 1, h: sh(mid) - 1 },
      ]),
      sig0: [ribs.length, base + bump],
      sig1: [skullFirst ? 1 : 0, skullW],
      sig2: [pitch, len],
    },
    skin: 'bone',
  };
}

function* ribsPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const [kx0] = l.anchors.skull;
  const [skullW, dir] = l.anchors.skullW;
  const [G] = l.anchors.ground;
  const vents: Module[] = [];
  const all: Vec[] = [];
  for (let i = 0; l.anchors[`vent${i}`]; i++) all.push(l.anchors[`vent${i}`]);
  for (const [c, under] of rng.shuffle(all).slice(0, rng.int(1, 2)))
    vents.push({
      type: 'geyser',
      look: 'lava',
      at: [c + 0.5, G],
      angle: -Math.PI / 2,
      width: 0.85,
      length: G - under,
      off: rng.int(110, 170),
      warn: 54,
      on: rng.int(40, 60),
      lethal: true,
      strength: 0,
    });
  // Fire out of the skull's mouth, along the passage and out of it.
  const mouth = dir > 0 ? kx0 + skullW - 1 : kx0;
  const breath: Module = {
    type: 'flame',
    at: [mouth + (dir > 0 ? 0.6 : 0.4), G - 1.5],
    angle: dir > 0 ? Math.PI : 0,
    length: skullW + 1,
    on: rng.int(40, 60),
    off: rng.int(110, 170),
    warn: 46,
  };
  yield {
    name: rng.pick(['Dragon Ribs', 'The Old Wyrm', 'Fossil Vents', 'Bad Breath']),
    archetype: 'flamer',
    role: 'hazard',
    style: makeStyle(rng, ['bone', 'obsidian'], [30, 18], { glowHue: rng.range(14, 30) }),
    modules: [
      { type: 'deco', kind: 'facade', at: l.anchors.facade, w: l.anchors.facadeSize[0], h: l.anchors.facadeSize[1], seed: rng.int(0, 1 << 20) },
      // The skull's own shell: its horns, swept back behind it (its seed says which way it faces).
      { type: 'deco', kind: 'facade', at: l.anchors.skullBox, w: l.anchors.skullSize[0], h: l.anchors.skullSize[1], seed: dir > 0 ? 1 : 0 },
      breath,
      ...vents,
    ],
  };
  const spots = standsOf(l);
  if (spots.length) yield bombPiece(rng, bombs(rng, spots, rng.int(1, 2)));
}

export const DRAGON_RIBS = defineConcept({
  id: 'dragon-ribs',
  varies: ['head or tail first', 'skull width', 'spine height and hump', 'rib count and pitch', 'which vents'],
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, RIBS_MIN + BANK),
  ownsCrossing: true,
  family: ['vent', 'bombs', 'spitter'],
  names: ['The Dragon Ribs of {place}', 'The Bone Yard at {place}', "{place}'s Last Dragon", 'The Wyrm of {place}'],
  box: (k, rng) => {
    const cross = crossFor(k, RIBS_MIN + BANK);
    const room = k.W - 2 * SITE_MARGIN - cross;
    return { w: cross + BANK + Math.min(room - BANK, k.W > 56 ? rng.int(22, 32) : RIBS_MIN + rng.int(0, 3)), h: 10 };
  },
  build: buildRibs,
  pieces: (rng, _s, l) => ribsPieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ lava tube

const TUBE_MIN = 16;

function buildLavaTube(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const G = at.y + at.h;
  const cross = Math.min(at.w - TUBE_MIN - BANK, crossCols(parts));
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  moat(g, rng, at.x, cross, G, parts);
  const m0 = at.x + cross + BANK;
  const m1 = at.x + at.w - 1;
  const hi = rng.int(4, 5);
  const roof = rng.int(2, 3);
  // A mesa: flanks of steps, the tube inside it at the ground.
  const n = Math.ceil((hi + roof) / R);
  const hM = n * R;
  // Up its near face by stairs or by ledges (always ledges where the level is narrow: the tube gets the room).
  const narrow = m1 - m0 + 1 < 24;
  const onLedges = narrow || rng.chance(0.4);
  const nearW = onLedges ? [] : stepWidths(rng, n - 1, n - 1 + rng.int(0, 2));
  const farW = stepWidths(rng, n - 1, n - 1 + (narrow ? 0 : rng.int(0, 2)));
  let x = m0;
  if (onLedges) {
    ledges(g, m0, G - hM, G);
    x += 2;
  }
  nearW.forEach((w, i) => {
    for (let c = 0; c < w; c++) col(g, x++, (i + 1) * R, G);
  });
  const t0 = x;
  const fw = farW.reduce((s, w) => s + w, 0);
  const t1 = m1 - fw;
  for (let c = t0; c <= t1; c++) col(g, c, hM, G);
  x = t1 + 1;
  farW.forEach((w, i) => {
    for (let c = 0; c < w; c++) col(g, x++, (n - 1 - i) * R, G);
  });
  // The tube: from just inside the near wall to just inside the far one.
  const a = t0 + 1;
  const b = t1 - 1;
  const ceil = G - hi;
  g.clear(a, ceil, b, G - 1);
  // In through a hole in the top near the near end; out up a shaft at the far end.
  shaft(g, a, G - hM, ceil);
  shaft(g, b - 1, G - hM, G, { rungs: true, lid: true });
  // Drips of cooled rock hanging from its ceiling, and lava pools in its floor to hop.
  const drips: number[] = [];
  const pools: number[] = [];
  for (let c = a + 3 + rng.int(0, 2); c < b - 3; c += rng.int(4, 7)) {
    if (rng.chance(0.45) && G + 2 < g.h - 1) {
      g.clear(c, G, c + 1, G + 1);
      pools.push(c);
      c += 1;
    } else drips.push(c);
  }
  for (const c of drips) if (rng.chance(0.4)) g.set(c, ceil, 1, true);
  const mid = Math.floor((a + b) / 2);
  const wc = pools.includes(mid) || pools.includes(mid - 1) ? mid + 2 : mid;
  const stands: Vec[] = [];
  for (let c = t0; c <= t1; c++) if (g.get(c, G - hM) === 1 && g.empty(c, G - hM - 1)) stands.push([c, G - hM]);
  return {
    concept: 'lava-tube',
    rect: { x: m0, y: G - hM - 3, w: m1 - m0 + 1, h: hM + 3 },
    air: [{ x: a, y: ceil, w: b - a + 1, h: hi }],
    anchors: {
      tube: [a, b],
      ceil: [ceil, G],
      ...Object.fromEntries(drips.map((c, i) => [`drip${i}`, [c, g.get(c, ceil) === 1 ? ceil + 1 : ceil] as Vec])),
      ...Object.fromEntries(pools.map((c, i) => [`pool${i}`, [c, G + 2] as Vec])),
      ...Object.fromEntries(stands.map((s, i) => [`stand${i}`, s])),
      facade: [a, ceil],
      // Down into the lava pools in its floor, where there are any.
      facadeSize: [b - a + 1, hi + (pools.length ? 2 : 0)],
      ...ways([
        { x: wc, y: 0, w: 1, h: G - hM },
        { x: wc, y: ceil, w: 1, h: hi },
      ]),
      sig0: [hi, roof],
      sig1: [b - a + 1, drips.length],
      sig2: [pools.length, onLedges ? -1 : nearW.reduce((s, w) => s + w, 0)],
    },
  };
}

function* tubePieces(rng: Rng, s: Site, l: Landmark): Generator<Piece> {
  const G = l.anchors.ceil[1];
  // Lava standing in its floor's pools (it never moves: a still hazard), drips of cooling rock over the floor.
  const mods: Module[] = [];
  for (let i = 0; l.anchors[`pool${i}`]; i++) {
    const [x, y] = l.anchors[`pool${i}`];
    const m = capFlood(s.level, { type: 'flood', look: 'lava', at: [x, y], w: 2, low: 1, high: 1, off: 60, warn: 20, rise: 1, hold: 60, fall: 1 }, [], s.cache);
    if (m) mods.push(m);
  }
  const drips: Vec[] = [];
  for (let i = 0; l.anchors[`drip${i}`]; i++) drips.push(l.anchors[`drip${i}`]);
  for (const [x, y] of rng.shuffle(drips).slice(0, rng.int(1, 3)))
    mods.push({ type: 'dropper', cells: [[x, y]], angle: Math.PI / 2, reach: G - 1 - y, warn: rng.int(24, 34), rest: rng.int(50, 80) });
  if (mods.length)
    yield {
      name: rng.pick(['The Lava Tube', 'Magma Pipeline', 'The Underpass', 'Slag Drops']),
      archetype: 'dropper',
      role: 'hazard',
      style: OBSIDIAN(rng),
      modules: mods,
    };
  // Bombs on the mesa's top, and the tube's far wall behind them all (a backdrop shell takes no cells, so it rides with them).
  const back: Module = {
    type: 'deco',
    kind: 'facade',
    at: l.anchors.facade,
    w: l.anchors.facadeSize[0],
    h: l.anchors.facadeSize[1],
    seed: rng.int(0, 1 << 20),
  };
  yield bombPiece(rng, [back, ...bombs(rng, standsOf(l), rng.int(1, 3))]);
}

export const LAVA_TUBE = defineConcept({
  id: 'lava-tube',
  varies: ['tube length', 'tube height', 'roof thickness', 'flank steps', 'drips, stalactites and lava pools'],
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, TUBE_MIN + BANK),
  ownsCrossing: true,
  family: ['bombs', 'lava plume', 'obsidian bridge', 'serpent'],
  names: ['The Lava Tube of {place}', '{place} Underpass', 'The Hollow Mesa of {place}', 'The Pipeline at {place}'],
  box: (k, rng) => {
    const cross = crossFor(k, TUBE_MIN + BANK);
    const room = k.W - 2 * SITE_MARGIN - cross;
    return { w: cross + BANK + Math.min(room - BANK, k.W > 56 ? rng.int(26, 44) : TUBE_MIN + rng.int(0, 3)), h: 3 * easyRise() + 6 };
  },
  build: buildLavaTube,
  pieces: (rng, s, l) => tubePieces(rng, s, l),
});

// ------------------------------------------------------------------------------------------------ registry

export const VOLCANO_CONCEPTS: Concept[] = [CALDERA, MAGMA_TIDE, LAVAFALL_ORGAN, DRAGON_RIBS, LAVA_TUBE];

/** Structure columns per concept, for the crossing a level's box gets room for. */
const STRUCT: Record<string, number> = {
  caldera: CALDERA_MIN,
  'magma-tide': BANK + 2 * TIDE_ABUT + TIDE_BASIN + 4,
  'lavafall-organ': ORGAN_MIN + BANK,
  'dragon-ribs': RIBS_MIN + BANK,
  'lava-tube': TUBE_MIN + BANK,
};

/**
 * How many parts the volcano landmark's own crossing takes on this attempt, given the level's `challenges`:
 * two where its box made room for a two-part one (and the attempt still insists on two, TWO_PART_TRIES),
 * else one; none when the level asks for none.
 */
export function volcanoOwns(c: Concept, k: Knobs, attempt: number, challenges: number): number {
  if (challenges <= 0) return 0;
  const s = STRUCT[c.id];
  return attempt < TWO_PART_TRIES && s !== undefined && crossFor(k, s) >= twoGap() && twoGap() > oneGap() ? 2 : 1;
}
