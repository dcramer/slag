import { datan2 } from '../../core/dmath';
import type { Cell, Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import { type LevelProfile, T_ONEWAY, type TileRect } from '../../sim/level';
import type { Module, PropStyle } from '../../sim/props';
import { type Grid, hintGap, POCKET } from '../level/kit';
import { jumpProfile } from '../level/probe';
import { easyRise, hardGap, hopGap, type Knobs, pit, TWO_PART_TRIES, undercut } from '../level/sculptors/common';
import { BRIDGE_W } from '../level/types';
import { cornice, thinIce } from '../setpieces/glacier';
import { makeStyle, type Piece, SAFE_TILES, type Site } from '../setpieces/place';
import { defineConcept } from './contract';
import type { Concept, Landmark } from './types';

/**
 * Glacier stage concepts (docs/SETPIECES.md, Glacier): five places on the ice, each one landmark that owns
 * the level's hard crossing (a crevasse in front of it), every one laid out afresh from its seed, and each
 * with its glacier ice where it hurts most: ice is slick underfoot and can't be wall-jumped (sim/ground.ts),
 * so a face of it is a wall and a floor of it is a skid.
 *
 * - **The Ice Palace** (grand): two towers of ice block and a great hall between them. Through the hall on
 *   its ice floor, under icicles hanging from the vault, or up the front tower, along the roof and over the
 *   back tower, a frost cannon on its top sweeping the roof.
 * - **The Summit** (grand): the climbers' mountain, a toe of ice under a peak that climbs in tiers on the
 *   near side and falls away in one long slide on the far side. Up the tiers under a cornice that lets go
 *   of snowballs down them, or through the ice cave in its foot, where icicles break off the roof.
 * - **The Frozen Shipwreck**: a ship frozen into the ice field and listing, its deck glazed. Up its anchor
 *   chain and along the deck, past its frost gun, or through the hold where the ice stove her in.
 * - **The Frozen Falls**: a cliff whose waterfall froze where it fell, a sheer wall of ice down its face.
 *   Up the icicle ledges beside it, or through the cave behind it, across a pool skinned with thin ice that
 *   gives way.
 * - **The Ski Jump**: a start tower and an inrun of ice stepping down to the take-off. Up the tower and
 *   down the inrun, a snow cannon at the take-off firing frost back up it, or along the ground under the
 *   inrun's trestle.
 *
 * Every landmark keeps a static way past itself (movers and hazards are timed, never the proof). Anchors
 * the tests and the sculptor read: `way{i}` / `way{i}s` is a rect that, filled, shuts one way through;
 * `ice{i}` / `ice{i}s` a rect whose solid tiles are glacier ice; `sig{i}` the structural numbers its seed
 * rolled.
 */

/** Columns a landmark keeps from either end (sculptors/common.ts claimSite). */
const SITE_MARGIN = POCKET + SAFE_TILES;
/** Flat bank between the crevasse and the structure: the bridge's landing and a run-up. */
const BANK = 3;
/** Rows a passage through a structure is tall: a runner's height and a jump's start. */
const DOOR = 3;

const DOWN = Math.PI / 2;

/** The widest one-part crossing at this gravity (hardGap's top end). */
function oneGap(gravity?: number): number {
  const j = jumpProfile(gravity);
  return Math.max(j.gap + 2, BRIDGE_W + 2 * j.walkGap);
}

/** The one-part crossing a classic level's box makes room for: a column short of hardGap's widest. */
function snugGap(gravity?: number): number {
  return Math.min(oneGap(gravity), jumpProfile(gravity).gap + 3);
}

/** The widest two-part crossing at this gravity. */
function twoGap(gravity?: number): number {
  const j = jumpProfile(gravity);
  return Math.max(j.gapAt(-6) + j.rise + 1, j.gap + 2 * BRIDGE_W + j.walkGap + 1);
}

/**
 * Share of levels whose landmark's own crossing takes two parts, where its box has room for a two-part one
 * (wide levels). A level built round a landmark has little room left for the sculptor's own crevasses, so
 * the wide ones ask more often to keep the theme near TWO_PARTS (measured with `pnpm level --stats 200`).
 */
const LANDMARK_TWO = 0.4;
const asksTwo = (k: Knobs) => k.challenge < Math.max(k.twoParts, LANDMARK_TWO);

/** Columns for the crossing a landmark owns: two-part where asked and there's room, else one-part. Never rolls. */
function crossFor(k: Knobs, struct: number): number {
  if (asksTwo(k) && twoGap() + struct <= k.W - 2 * SITE_MARGIN) return twoGap();
  return k.W > 56 ? oneGap() : snugGap();
}

/** Does a landmark of `struct` columns fit beside a one-part crossing on this level? */
function roomFor(p: Partial<LevelProfile>, struct: number): boolean {
  return snugGap(p.gravity) + struct <= (p.w ?? 48) - 2 * SITE_MARGIN;
}

/** The crossing the build digs: as wide as `parts` take, or as the box allows. */
const crossCols = (parts: number) => (parts >= 2 ? twoGap() : oneGap());

/** Columns of structure for a box: what a classic level's middle leaves, more on a wide one. */
function structCols(k: Knobs, rng: Rng, min: number, wide: readonly [number, number], grand = false): number {
  const room = k.W - 2 * SITE_MARGIN - crossFor(k, min + BANK) - BANK;
  // A grand landmark owns a classic level's whole middle.
  return Math.min(room, k.W > 56 ? rng.int(wide[0], wide[1]) : grand ? room : min + rng.int(0, 3));
}

/** Rows a box asks for, never more than a level of this height has over its ground (claimSite needs a row of sky). */
const boxH = (k: Knobs, h: number) => Math.min(k.H - 9, h);

/**
 * The crevasse in front of a landmark: a `hardGap` pit dug to the meltwater at the right end of its `cols`
 * columns, its bridge hinted and its far bank undercut. Columns it doesn't need stay ice field. Returns the
 * gap's columns.
 */
function crevasse(g: Grid, rng: Rng, x0: number, cols: number, G: number, parts: number): [number, number] {
  const b = x0 + cols - 1;
  if (parts <= 0) return [b + 1, b];
  const gw = Math.min(cols, hardGap(rng, parts));
  const a = b - gw + 1;
  pit(g, a, b, G, false);
  hintGap(g, a, b, G);
  undercut(g, b + 1, 2, G);
  return [a, b];
}

/** One-way ledges two wide at columns x, x+1, a comfortable hop apart from the ground row G up to the surface row `top`. */
function ledges(g: Grid, x: number, top: number, G: number): number[] {
  const R = easyRise();
  const rows: number[] = [];
  for (let y = G - R; y > top; y -= R) {
    for (const c of [x, x + 1]) g.set(c, y, T_ONEWAY, true);
    rows.push(y);
  }
  return rows;
}

/** Solid column x from row G - h to G - 1. */
function col(g: Grid, x: number, h: number, G: number): void {
  if (h > 0) g.fill(x, G - h, x, G - 1, 1, true);
}

/** A passage `h` rows tall at the ground (row G is the floor) from column a to b. */
function passage(g: Grid, a: number, b: number, G: number, h = DOOR): void {
  g.clear(Math.min(a, b), G - h, Math.max(a, b), G - 1);
}

/** Anchors of a list of rects under `key`: `${key}{i}` its corner, `${key}{i}s` its size. */
function rects(key: string, rs: readonly TileRect[]): Record<string, Vec> {
  const out: Record<string, Vec> = {};
  rs.forEach((r, i) => {
    out[`${key}${i}`] = [r.x, r.y];
    out[`${key}${i}s`] = [r.w, r.h];
  });
  return out;
}

/** The anchors of the ways through: each a rect that, filled, shuts that way. */
const ways = (rs: readonly TileRect[]) => rects('way', rs);

/** Rects recorded with `rects` under `key`, back as a list. */
export function rectsOf(l: Pick<Landmark, 'anchors'>, key: string): TileRect[] {
  const out: TileRect[] = [];
  for (let i = 0; l.anchors[`${key}${i}`]; i++) {
    const [x, y] = l.anchors[`${key}${i}`];
    const [w, h] = l.anchors[`${key}${i}s`];
    out.push({ x, y, w, h });
  }
  return out;
}

/** A list of layout numbers as one signature pair: how many, and a sum weighted by place, so a reorder shows. */
const listSig = (xs: readonly number[]): Vec => [xs.length, xs.reduce((t, v, i) => t + v * (i + 1), 0)];

/** Steps `n` columns wide in all, `count` of them, each at least one column, the spare spread at random. */
function stepWidths(rng: Rng, count: number, n: number, most = 3): number[] {
  const out = Array.from({ length: count }, () => 1);
  for (let spare = n - count; spare > 0; spare--) {
    const open = out.map((w, i) => (w < most ? i : -1)).filter((i) => i >= 0);
    if (!open.length) break;
    out[rng.pick(open)]++;
  }
  return out;
}

/** Points recorded as `${key}{i}` anchors, back as a list. */
function listOf(l: Landmark, key: string): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; l.anchors[`${key}${i}`]; i++) out.push(l.anchors[`${key}${i}`]);
  return out;
}
const record = (key: string, xs: readonly Vec[]) => Object.fromEntries(xs.map((v, i) => [`${key}${i}`, v]));

/** A backdrop shell (drawn by the glacier skin, chosen by the level's concept and the box's shape). */
const shell = (rng: Rng, at: Vec, w: number, h: number): Module => ({ type: 'deco', kind: 'facade', at, w, h, seed: rng.int(0, 1 << 20) });

const ICY = (rng: Rng): PropStyle => makeStyle(rng, ['steel', 'bone'], [196, 205, 215], { trim: 'stripes', woodHue: rng.range(20, 30) });

/** Icicles (a still spike strip, look icicle) hanging from the solid cells `cells` of a ceiling, with `more` (its shell) in the same piece. */
function icicles(rng: Rng, cells: Cell[], ...more: Module[]): Piece {
  return {
    name: rng.pick(['Icicles', 'Cold Snap', 'Hang Time', 'Mind Your Head', 'Frozen Fringe']),
    archetype: 'spikestrip',
    role: 'hazard',
    style: ICY(rng),
    modules: [...more, { type: 'spikes', cells, angle: DOWN, look: 'icicle' }],
    pathSafe: true,
  };
}

/** A frost cannon on the stand cell (x, y), aimed at the point (tx, ty) (tiles): it freezes whoever it hits. */
function frostGun(rng: Rng, x: number, y: number, tx: number, ty: number, name: string): Piece {
  const at: Vec = [x + 0.5, y + 0.45];
  const d = tx < at[0] ? -1 : 1;
  return {
    name,
    archetype: 'launcher',
    role: 'hazard',
    style: makeStyle(rng, ['steel', 'bone'], [205, 0, 220], { trim: 'stripes', woodHue: rng.range(20, 30) }),
    extra: [[x - d, y]],
    modules: [
      {
        type: 'cannon',
        look: 'castle',
        at,
        angle: datan2(ty - at[1], tx - at[0]),
        ammo: 'frost',
        interval: rng.int(150, 220),
        burst: rng.int(1, 2),
        speed: rng.int(180, 230),
        length: 1,
        seed: rng.int(0, 1 << 20),
      },
    ],
  };
}

/** Icicles that break off a ceiling over the cells under `cells` and drop to the floor `reach` rows down. */
function fallingIcicles(rng: Rng, cells: Cell[], reach: number): Piece {
  return {
    name: rng.pick(['Falling Icicles', 'Icicle Drop', 'Cold Front', 'Look Up']),
    archetype: 'dropper',
    role: 'hazard',
    style: ICY(rng),
    modules: cells.map((c) => ({ type: 'dropper', cells: [c], angle: DOWN, reach, warn: rng.int(26, 36), rest: rng.int(60, 90), look: 'icicle' }) as Module),
  };
}

// ------------------------------------------------------------------------------------------------ ice palace

const PALACE_MIN = 14;

function buildPalace(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const G = at.y + at.h;
  const cross = Math.min(at.w - PALACE_MIN - BANK, crossCols(parts));
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  crevasse(g, rng, at.x, cross, G, parts);
  const s0 = at.x + cross + BANK;
  const s1 = at.x + at.w - 1;
  // The towers: the front one past the ledges up its face, the back one at the far end, each two or three wide.
  const t0 = s0 + 2;
  const tw = rng.int(2, 3);
  const bw = rng.int(2, 3);
  const b0 = s1 - bw + 1;
  // The hall: a vault four or five rows high under a roof a row or two thick; towers a rise or two over it.
  const room = at.h - 3;
  const hall = rng.int(DOOR + 1, DOOR + 2);
  const roof = rng.int(1, 2);
  const hR = hall + roof;
  const hF = Math.min(room, hR + R * rng.int(1, 2));
  const hB = Math.min(room, hR + R * rng.int(1, 2));
  // A keep in the middle of a long hall, a rise over the roof, on some.
  const span = b0 - (t0 + tw);
  const keep = span >= 12 && rng.chance(0.6) ? { x: t0 + tw + Math.floor(span / 2) - 1 + rng.int(-1, 1), w: 3 } : null;
  for (let c = t0; c < t0 + tw; c++) col(g, c, hF, G);
  for (let c = t0 + tw; c < b0; c++) col(g, c, keep && c >= keep.x && c < keep.x + keep.w ? hR + R : hR, G);
  for (let c = b0; c <= s1; c++) col(g, c, hB, G);
  // The hall, and the doors through both towers' feet.
  passage(g, t0 + tw, b0 - 1, G, hall);
  passage(g, t0, s1, G);
  if (keep) passage(g, keep.x, keep.x + keep.w - 1, G, hall);
  // Up the front tower's face; up the back tower's from the roof, where it's more than a hop.
  ledges(g, s0, G - hF, G);
  const backLedges: number[] = [];
  for (let y = G - hR - R; y > G - hB; y -= R) {
    g.set(b0 - 1, y, T_ONEWAY, true);
    backLedges.push(y);
  }
  // Icicles under the vault, in a few places along it.
  const drips: Vec[] = [];
  for (let c = t0 + tw + 1; c < b0 - 1; c++) if (rng.chance(0.4) && !(keep && c >= keep.x - 1 && c <= keep.x + keep.w)) drips.push([c, G - hall - 1]);
  if (!drips.length) drips.push([t0 + tw + 1, G - hall - 1]);
  const top = Math.max(hF, hB, keep ? hR + R : 0);
  const mid = keep ? keep.x - 1 : Math.floor((t0 + tw + b0) / 2);
  return {
    concept: 'ice-palace',
    rect: { x: at.x, y: Math.max(1, G - top - 5), w: at.w, h: Math.min(G - 1, top + 5) },
    air: [{ x: t0 + tw, y: G - hall, w: b0 - t0 - tw, h: hall }],
    anchors: {
      palace: [s0, s1],
      towers: [t0, tw],
      back: [b0, bw],
      heights: [hF, hB],
      hall: [hall, hR],
      ground: [G, top],
      ...record('drip', drips),
      ...ways([
        { x: mid, y: 0, w: 1, h: G - hR - (keep && mid >= keep.x && mid < keep.x + keep.w ? R : 0) },
        { x: mid, y: G - hall, w: 1, h: hall },
      ]),
      // The towers' faces and the vault are ice right through; the hall floor is a rink.
      ...rects('ice', [
        { x: t0, y: G - hF + 1, w: tw, h: hF - 1 },
        { x: t0 + tw, y: G - hR, w: b0 - t0 - tw, h: roof + R + 1 },
        { x: b0, y: G - hB + 1, w: bw, h: hB - 1 },
        { x: t0, y: G, w: s1 - t0 + 1, h: 1 },
      ]),
      sig0: [tw, bw],
      sig1: [hF, hB],
      sig2: [hall, roof],
      sig3: [keep ? keep.x - s0 : 0, backLedges.length],
    },
    skin: 'iceblock',
  };
}

function* palacePieces(rng: Rng, l: Landmark): Generator<Piece> {
  const [, s1] = l.anchors.palace;
  const [t0] = l.anchors.towers;
  const [b0, bw] = l.anchors.back;
  const [, hB] = l.anchors.heights;
  const [, hR] = l.anchors.hall;
  const [G, top] = l.anchors.ground;
  // Icicles under the vault, with the palace behind it all: the vault's back wall and windows, spires over the towers.
  yield icicles(rng, listOf(l, 'drip') as Cell[], shell(rng, [t0, G - top - 4], s1 - t0 + 1, top + 4));
  // A frost cannon on the back tower, sweeping the roof toward the front tower.
  const x = bw >= 3 ? b0 + 1 : b0;
  yield frostGun(rng, x, G - hB - 1, t0 + 1.5, G - hR - 0.6, rng.pick(['The Cold Shoulder', 'Royal Salute', 'Brain Freeze Battery', 'Snow Queen']));
}

export const ICE_PALACE = defineConcept({
  id: 'ice-palace',
  scale: 'grand',
  varies: ['tower widths and heights', 'hall height and roof', 'a keep over the hall', 'where the icicles hang', 'cannon timing'],
  weight: 3,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, PALACE_MIN + BANK),
  ownsCrossing: true,
  family: ['frost cannon', 'thin ice', 'hanging serac', 'frost vent'],
  names: ['The Ice Palace of {place}', 'The Frozen Court of {place}', 'The Snow Queen’s {place}', 'The Winter Hall at {place}'],
  box: (k, rng) => {
    const cross = crossFor(k, PALACE_MIN + BANK);
    return { w: cross + BANK + structCols(k, rng, PALACE_MIN, [22, 32], true), h: boxH(k, DOOR + 4 + 2 * easyRise() + 6) };
  },
  build: buildPalace,
  pieces: (rng, _s, l) => palacePieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ the summit

const SUMMIT_MIN = 15;

function buildSummit(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const G = at.y + at.h;
  const cross = Math.min(at.w - SUMMIT_MIN - BANK, crossCols(parts));
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  crevasse(g, rng, at.x, cross, G, parts);
  const s0 = at.x + cross + BANK;
  const s1 = at.x + at.w - 1;
  // The toe: an apron of ice the cave runs through, its roof two or three rows thick.
  const p0 = s0 + 2;
  const P = DOOR + rng.int(2, 3);
  const S = s1 - p0 + 1;
  // Tiers on the near side, a peak, then the slide down the far side to the toe.
  let n = Math.max(2, Math.min(rng.int(3, 5), Math.floor((at.h - 3 - P) / R)));
  const pw = rng.int(2, 4);
  // The slide falls a row a column (or two on a steep one) from the peak down to the toe.
  const steep = rng.chance(0.35) ? 2 : 1;
  while (n > 1 && Math.ceil((n * R) / steep) + pw + n > S) n--;
  const slide = Math.ceil((n * R) / steep);
  const nearW = Math.max(n, S - pw - slide);
  const steps = stepWidths(rng, n, Math.min(nearW, 3 * n));
  // Whatever the tiers don't take widens the toe in front of them.
  const lead = S - pw - slide - steps.reduce((t, w) => t + w, 0);
  const heights: number[] = [];
  for (let i = 0; i < Math.max(0, lead); i++) heights.push(P);
  // The first tier is the toe itself; each after it a rise higher.
  steps.forEach((w, k) => {
    for (let i = 0; i < w; i++) heights.push(P + k * R);
  });
  const hP = P + n * R;
  for (let i = 0; i < pw; i++) heights.push(hP);
  for (let i = 1; heights.length < S; i++) heights.push(Math.max(P, hP - i * steep));
  heights.length = S;
  heights.forEach((h, i) => col(g, p0 + i, h, G));
  passage(g, p0, s1, G);
  ledges(g, s0, G - P, G);
  const pk = p0 + heights.indexOf(hP);
  // Icicles hanging in the cave, where its roof is thick enough to hold them.
  const drops: Cell[] = [];
  for (let c = p0 + 1; c < s1; c++) if (heights[c - p0] >= DOOR + 3 && rng.chance(0.3) && !drops.some(([x]) => Math.abs(x - c) < 3)) drops.push([c, G - DOOR]);
  const mid = pk + Math.floor(pw / 2);
  return {
    concept: 'summit',
    rect: { x: at.x, y: Math.max(1, G - hP - 4), w: at.w, h: Math.min(G - 1, hP + 4) },
    air: [
      { x: pk, y: G - hP - 3, w: pw, h: 3 },
      { x: p0, y: G - DOOR, w: S, h: DOOR },
    ],
    anchors: {
      summit: [s0, s1],
      toe: [p0, P],
      peak: [pk, pw],
      ground: [G, hP],
      ...record('drop', drops),
      ...ways([
        { x: mid, y: 0, w: 1, h: G - hP },
        { x: mid, y: G - DOOR, w: 1, h: DOOR },
      ]),
      // The tiers' risers and the slide are ice: no wall-jumping up the near side, a skid down the far side.
      ...rects('ice', [{ x: p0, y: G - hP, w: S, h: hP - DOOR - 1 }]),
      sig0: [n, P],
      sig1: [pw, steep],
      sig2: listSig(steps),
      sig3: [lead, drops.length],
    },
  };
}

function* summitPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const [, s1] = l.anchors.summit;
  const [p0] = l.anchors.toe;
  const [pk] = l.anchors.peak;
  const [G, hP] = l.anchors.ground;
  // The cornice on the peak's near edge: its snowballs roll off it and down the tiers at whoever's climbing.
  // The ice cave's walls and the peak behind come with it.
  yield {
    name: rng.pick(['Avalanche!', 'Snowball Effect', 'The Cornice', 'Look Out Below']),
    archetype: 'launcher',
    role: 'hazard',
    style: makeStyle(rng, 'bone', [205]),
    extra: [[pk + 1, G - hP - 1]],
    modules: [shell(rng, [p0, G - DOOR], s1 - p0 + 1, DOOR), cornice(rng, pk, G - hP - 1, -1)],
  };
  const drops = listOf(l, 'drop') as Cell[];
  if (drops.length) yield fallingIcicles(rng, rng.shuffle(drops.slice()).slice(0, rng.int(1, 2)), DOOR - 1);
}

export const SUMMIT = defineConcept({
  id: 'summit',
  scale: 'grand',
  varies: ['tiers (count and widths)', 'the toe and the cave roof', 'peak width', 'how steep the slide is', 'where icicles hang in the cave'],
  weight: 3,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, SUMMIT_MIN + BANK),
  ownsCrossing: true,
  family: ['avalanche', 'frost vent', 'thin ice', 'frost cannon'],
  names: ['The Summit of {place}', 'Mount {place}', 'The Peak at {place}', 'The North Face of {place}'],
  box: (k, rng) => {
    const cross = crossFor(k, SUMMIT_MIN + BANK);
    return { w: cross + BANK + structCols(k, rng, SUMMIT_MIN, [22, 34], true), h: boxH(k, DOOR + 3 + 5 * easyRise() + 4) };
  },
  build: buildSummit,
  pieces: (rng, _s, l) => summitPieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ frozen shipwreck

const WRECK_MIN = 14;

function buildWreck(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const G = at.y + at.h;
  const cross = Math.min(at.w - WRECK_MIN - BANK, crossCols(parts));
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  crevasse(g, rng, at.x, cross, G, parts);
  const s0 = at.x + cross + BANK;
  const s1 = at.x + at.w - 1;
  const p0 = s0 + 2;
  const L = s1 - p0 + 1;
  // Bow near or far; the ship lists toward its bow, a row down every few columns of deck.
  const bowNear = rng.chance(0.5);
  const hD = Math.min(at.h - 4 - R, DOOR + rng.int(2, 3) + rng.int(0, 1) * R);
  const castle = rng.int(3, 4);
  const fo = rng.int(2, 3);
  const every = rng.int(3, 5);
  const heights: number[] = [];
  for (let i = 0; i < L; i++) {
    // i counted from the stern.
    const fromStern = bowNear ? L - 1 - i : i;
    let h = hD - Math.floor(Math.max(0, fromStern - castle) / every);
    if (fromStern < castle) h = hD + R;
    if (fromStern >= L - fo) h = Math.max(DOOR + 2, hD - Math.floor((L - fo - castle) / every)) + 1;
    heights.push(Math.max(DOOR + 2, h));
  }
  heights.forEach((h, i) => col(g, p0 + i, h, G));
  // The hold, stove in at both ends: straight through under the deck.
  passage(g, p0, s1, G);
  // The anchor chain up the near end.
  ledges(g, s0, G - heights[0], G);
  const top = Math.max(...heights);
  // The gun on the sterncastle, aimed down the deck toward the bow.
  const stern = bowNear ? s1 - 1 : p0 + 1;
  const bow = bowNear ? p0 + 1 : s1 - 1;
  // Icicles from the deck's underside, over the hold.
  const drips: Vec[] = [];
  for (let c = p0 + 2; c < s1 - 1; c++) if (rng.chance(0.3) && !drips.some(([x]) => Math.abs(x - c) < 3)) drips.push([c, G - DOOR - 1]);
  if (!drips.length) drips.push([p0 + Math.floor(L / 2), G - DOOR - 1]);
  const mid = p0 + Math.floor(L / 2);
  return {
    concept: 'frozen-wreck',
    rect: { x: at.x, y: Math.max(1, G - top - 6), w: at.w, h: Math.min(G - 1, top + 6) },
    air: [{ x: p0, y: G - DOOR, w: L, h: DOOR }],
    anchors: {
      wreck: [p0, s1],
      ends: [stern, bow],
      ground: [G, top],
      list: [bowNear ? 1 : 0, every],
      ...record(
        'h',
        heights.map((h, i) => [p0 + i, h] as Vec),
      ),
      ...record('drip', drips),
      ...ways([
        { x: mid, y: 0, w: 1, h: G - heights[mid - p0] },
        { x: mid, y: G - DOOR, w: 1, h: DOOR },
      ]),
      // The deck is glazed over: a skid toward the bow.
      ...rects('ice', [{ x: p0, y: G - top, w: L, h: top - DOOR - 1 }]),
      sig0: [hD, bowNear ? 1 : 0],
      sig1: [castle, fo],
      sig2: [every, drips.length],
    },
    skin: 'hull',
  };
}

function* wreckPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const [p0, s1] = l.anchors.wreck;
  const [stern, bow] = l.anchors.ends;
  const [G, top] = l.anchors.ground;
  const hAt = (x: number) => l.anchors[`h${x - p0}`][1];
  // The ship above and behind its hull: masts, frozen sails and rigging, the hold's dark through the breach.
  yield {
    ...icicles(rng, listOf(l, 'drip') as Cell[]),
    modules: [shell(rng, [p0, G - top - 5], s1 - p0 + 1, top + 5), ...icicles(rng, listOf(l, 'drip') as Cell[]).modules],
  };
  // Its gun, frozen on the sterncastle, still firing: frost down the deck.
  yield frostGun(rng, stern, G - hAt(stern) - 1, bow + 0.5, G - hAt(bow) - 0.5, rng.pick(['The Old Salt', 'Frozen Broadside', 'Ice Breaker', 'Deck Swabber']));
}

export const FROZEN_WRECK = defineConcept({
  id: 'frozen-wreck',
  varies: ['which end the bow is', 'deck height and list', 'sterncastle and forecastle lengths', 'icicles under the deck'],
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, WRECK_MIN + BANK),
  ownsCrossing: true,
  family: ['frost cannon', 'thin ice', 'hanging serac', 'avalanche'],
  names: ['The Wreck of {place}', 'The Frozen Ship at {place}', 'The {place} Expedition', 'Icebound at {place}'],
  box: (k, rng) => {
    const cross = crossFor(k, WRECK_MIN + BANK);
    return { w: cross + BANK + structCols(k, rng, WRECK_MIN, [18, 28]), h: boxH(k, DOOR + 4 + 2 * easyRise() + 7) };
  },
  build: buildWreck,
  pieces: (rng, _s, l) => wreckPieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ frozen falls

const FALLS_MIN = 13;
/** The cave behind the falls is a row taller than a door: room to hop the pool. */
const CAVE = DOOR + 1;

function buildFalls(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const G = at.y + at.h;
  const cross = Math.min(at.w - FALLS_MIN - BANK, crossCols(parts));
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  crevasse(g, rng, at.x, cross, G, parts);
  const s0 = at.x + cross + BANK;
  const s1 = at.x + at.w - 1;
  const c0 = s0 + 2;
  // A sheer face a few ledges high, the frozen falls down it two or three columns wide, then rough
  // terraces stepping down at the back.
  const low = CAVE + 2;
  const hc = Math.max(low + R, Math.min(at.h - 3, rng.int(4, 5) * R + rng.int(1, 2)));
  const fw = rng.int(2, 3);
  const pw = Math.max(fw + 1, Math.min(s1 - c0 + 1 - 2, rng.int(fw + 2, fw + 5)));
  const backs: { w: number; h: number }[] = [];
  let x = c0 + pw;
  let h = hc;
  while (x <= s1) {
    const w = Math.min(s1 - x + 1, rng.int(1, 3));
    h = Math.max(low, h - rng.int(1, R));
    backs.push({ w, h });
    x += w;
  }
  for (let c = c0; c < c0 + pw; c++) col(g, c, hc, G);
  x = c0 + pw;
  for (const t of backs) for (let i = 0; i < t.w; i++) col(g, x++, t.h, G);
  ledges(g, s0, G - hc, G);
  passage(g, c0, s1, G, CAVE);
  // The pool in the cave floor: a hop wide, two rows deep, skinned with thin ice.
  const pwid = Math.min(3, hopGap(rng, 2));
  const px = c0 + 2 + rng.int(0, Math.max(0, s1 - c0 - 4 - pwid));
  g.clear(px, G, px + pwid - 1, G + 1);
  const mid = c0 + Math.floor(pw / 2);
  return {
    concept: 'frozen-falls',
    rect: { x: s0, y: G - hc - 3, w: s1 - s0 + 1, h: hc + 3 },
    air: [
      { x: s0, y: G - hc, w: 2, h: hc },
      { x: c0, y: G - CAVE, w: s1 - c0 + 1, h: CAVE },
    ],
    anchors: {
      cave: [c0, s1],
      ground: [G, hc],
      falls: [c0, fw],
      pool: [px, pwid],
      ...ways([
        { x: mid, y: 0, w: 1, h: G - hc },
        { x: px + pwid, y: G - CAVE, w: 1, h: CAVE },
      ]),
      // The falls froze down the face: ice from the lip to the ground, no wall to jump.
      ...rects('ice', [
        { x: c0, y: G - hc, w: fw, h: hc - CAVE },
        { x: c0, y: G, w: s1 - c0 + 1, h: 1 },
      ]),
      sig0: [hc, pw],
      sig1: [fw, backs.length],
      sig2: listSig(backs.map((t) => t.h)),
      sig3: [px - c0, pwid],
    },
  };
}

function* fallsPieces(rng: Rng, s: Site, l: Landmark): Generator<Piece> {
  const [c0, s1] = l.anchors.cave;
  const [G, hc] = l.anchors.ground;
  const [px, pwid] = l.anchors.pool;
  // The pool's thin ice, with the cave and the frozen falls behind it all.
  const cells = Array.from({ length: pwid }, (_, i) => [px + i, G] as Cell);
  yield {
    name: rng.pick(['Thin Ice', 'Skate at Own Risk', 'The Plunge Pool', 'Polar Plunge']),
    archetype: 'crumble',
    role: 'hazard',
    style: ICY(rng),
    modules: [shell(rng, [c0, G - hc - 2], s1 - c0 + 1, hc + 4), { ...thinIce(rng, cells, s.h), depth: 2 } as Module],
  };
  // Icicles breaking off the cave roof, away from the pool.
  const spots: Cell[] = [];
  for (let c = c0 + 1; c < s1; c++) if (c < px - 1 || c > px + pwid) spots.push([c, G - CAVE]);
  if (spots.length) yield fallingIcicles(rng, rng.shuffle(spots).slice(0, rng.int(1, 2)), CAVE - 1);
}

export const FROZEN_FALLS = defineConcept({
  id: 'frozen-falls',
  varies: ['cliff height', 'width of the frozen falls', 'back terraces (count, widths, heights)', 'where the pool is', 'where icicles fall'],
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, FALLS_MIN + BANK),
  ownsCrossing: true,
  family: ['thin ice', 'hanging serac', 'frost vent', 'avalanche'],
  names: ['The Frozen Falls of {place}', '{place} Falls', 'The Ice Cave at {place}', 'The Still Water of {place}'],
  box: (k, rng) => {
    const cross = crossFor(k, FALLS_MIN + BANK);
    return { w: cross + BANK + structCols(k, rng, FALLS_MIN, [16, 26]), h: boxH(k, 5 * easyRise() + 7) };
  },
  build: buildFalls,
  pieces: (rng, s, l) => fallsPieces(rng, s, l),
});

// ------------------------------------------------------------------------------------------------ ski jump

const JUMP_MIN = 14;

function buildJump(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const G = at.y + at.h;
  const cross = Math.min(at.w - JUMP_MIN - BANK, crossCols(parts));
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  crevasse(g, rng, at.x, cross, G, parts);
  const s0 = at.x + cross + BANK;
  const s1 = at.x + at.w - 1;
  // The start tower, two wide, its door at the foot.
  const t0 = s0 + 2;
  const run = s1 - (t0 + 2) + 1;
  // The take-off: high enough for the ground route under it.
  const hK = DOOR + 1 + rng.int(0, 1);
  // The inrun steps down a row every column or two from just under the tower's top to the take-off.
  const every = rng.chance(0.5) ? 1 : 2;
  const hT = Math.min(at.h - 3, Math.max(hK + R + 1, hK + Math.floor(run / every) + 1 - rng.int(0, 2)));
  for (let c = t0; c < t0 + 2; c++) col(g, c, hT, G);
  const deck: number[] = [];
  for (let i = 0; i < run; i++) {
    const h = Math.max(hK, hT - 1 - Math.floor(i / every));
    deck.push(h);
    g.fill(t0 + 2 + i, G - h, t0 + 2 + i, G - h, 1, true);
  }
  // A lip at the end of the take-off on some: one row up, the last thing under your feet.
  const lip = rng.chance(0.5) && deck[run - 1] === hK && deck[run - 2] === hK;
  if (lip) g.fill(s1, G - hK - 1, s1, G - hK - 1, 1, true);
  passage(g, t0, t0 + 1, G);
  ledges(g, s0, G - hT, G);
  const mid = t0 + 2 + Math.floor(run / 2);
  return {
    concept: 'ski-jump',
    rect: { x: at.x, y: Math.max(1, G - hT - 4), w: at.w, h: Math.min(G - 1, hT + 4) },
    air: [{ x: t0, y: G - DOOR, w: run + 2, h: DOOR }],
    anchors: {
      jump: [t0, s1],
      ground: [G, hT],
      takeoff: [s1, hK],
      ...record(
        'deck',
        deck.map((h, i) => [t0 + 2 + i, h] as Vec),
      ),
      ...ways([
        { x: mid, y: 0, w: 1, h: G - deck[mid - t0 - 2] },
        { x: mid, y: G - DOOR, w: 1, h: DOOR },
      ]),
      // The inrun is groomed ice the whole way down.
      ...rects('ice', [{ x: t0 + 2, y: G - hT, w: run, h: hT - hK + 1 }]),
      sig0: [hT, hK],
      sig1: [every, lip ? 1 : 0],
      sig2: [run, s1 - s0],
    },
  };
}

function* jumpPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const [t0, s1] = l.anchors.jump;
  const [G, hT] = l.anchors.ground;
  const decks = listOf(l, 'deck');
  // The trestle under the inrun and the start house on the tower, behind it all; a snow cannon at the
  // take-off, firing frost back up the inrun at whoever's coming down.
  const [kx, kh] = decks[decks.length - 2] ?? decks[decks.length - 1];
  const [ux, uh] = decks[0];
  const gun = frostGun(rng, kx, G - kh - 1, ux + 0.5, G - uh - 0.6, rng.pick(['Snow Machine', 'Powder Day', 'Fresh Tracks', 'Artificial Snow']));
  yield { ...gun, modules: [shell(rng, [t0, G - hT - 3], s1 - t0 + 1, hT + 3), ...gun.modules] };
}

export const SKI_JUMP = defineConcept({
  id: 'ski-jump',
  varies: ['tower height', 'how steep the inrun is', 'take-off height and lip', 'length of the inrun'],
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, JUMP_MIN + BANK),
  ownsCrossing: true,
  family: ['chairlift', 'frost cannon', 'thin ice', 'frost vent'],
  names: ['The {place} Ski Jump', 'The Big Air at {place}', 'The Hill at {place}', 'The {place} Invitational'],
  box: (k, rng) => {
    const cross = crossFor(k, JUMP_MIN + BANK);
    return { w: cross + BANK + structCols(k, rng, JUMP_MIN, [18, 28]), h: boxH(k, 5 * easyRise() + 8) };
  },
  build: buildJump,
  pieces: (rng, _s, l) => jumpPieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ registry

export const GLACIER_CONCEPTS: Concept[] = [ICE_PALACE, SUMMIT, FROZEN_WRECK, FROZEN_FALLS, SKI_JUMP];

/** Structure columns per concept, for the crossing a level's box gets room for. */
const STRUCT: Record<string, number> = {
  'ice-palace': PALACE_MIN + BANK,
  summit: SUMMIT_MIN + BANK,
  'frozen-wreck': WRECK_MIN + BANK,
  'frozen-falls': FALLS_MIN + BANK,
  'ski-jump': JUMP_MIN + BANK,
};

/**
 * How many parts the glacier landmark's own crossing takes on this attempt, given the level's `challenges`:
 * two where its box made room for a two-part one (and the attempt still insists on two, TWO_PART_TRIES),
 * else one; none when the level asks for none.
 */
export function glacierOwns(c: Concept, k: Knobs, attempt: number, challenges: number): number {
  if (challenges <= 0) return 0;
  const s = STRUCT[c.id];
  return attempt < TWO_PART_TRIES && s !== undefined && crossFor(k, s) >= twoGap() && twoGap() > oneGap() ? 2 : 1;
}
