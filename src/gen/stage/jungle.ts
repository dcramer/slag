import { datan2, dhypot } from '../../core/dmath';
import type { Cell, Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import { type LevelProfile, T_ONEWAY, type TileRect } from '../../sim/level';
import type { Module, PropStyle } from '../../sim/props';
import { type Grid, hintGap, POCKET } from '../level/kit';
import { jumpProfile } from '../level/probe';
import { easyRise, hardGap, type Knobs, pit, TWO_PART_TRIES, undercut } from '../level/sculptors/common';
import { BRIDGE_W } from '../level/types';
import { snapjaw } from '../setpieces/jungle';
import { makeStyle, type Piece, SAFE_TILES, type Site } from '../setpieces/place';
import { defineConcept } from './contract';
import type { Concept, Landmark } from './types';

/**
 * Jungle stage concepts (docs/SETPIECES.md, Jungle): five places, each one landmark that owns the level's
 * hard crossing (a swamp river, or the gorge itself), every one laid out afresh from its seed.
 *
 * - **The Step Temple** (grand): a stepped pyramid on a plinth, the swamp river in front of it. Over the
 *   top, up the plinth's ledges and the tiers, where a boulder rolls back and forth across the summit and
 *   dart idols on the landings shoot down the stair; or straight through the passage in its base.
 * - **The Waterfall Cliff**: a sheer cliff with a river pouring off its lip. Climb the ledges up its face,
 *   under the falls that shove you back down while they run, or walk through the grotto behind them.
 * - **The Canopy Village** (grand): treehouses on giant trunks, their decks joined by rope bridges with
 *   rotten planks in them. Along the forest floor through the hollow trunks, or up the branches and
 *   across the decks; a barrel cannon fires you up through a bridge, a pulley lift runs at the far end.
 * - **The Thorn Gorge**: the crossing is a gorge with thorns down its walls and a broken rope bridge
 *   hanging into it, a bramble bluff on its far side. Through the thorn-roofed tunnel in the bluff, or
 *   over its top, where spiked logs swing from a timber frame.
 * - **The Sun Gate**: a carved monolith with a gate through its foot and a sun disc on its face. A great
 *   lens set in the disc, and another on the monolith's crown, focus the sun into burning beams over
 *   the ledges up its face and across its top. Through the gate (mind the pressure plate) or over.
 *
 * Every landmark keeps a static way past itself (movers and hazards are timed, never the proof), and
 * owns the level's crossing. Anchors the tests read: `way{i}` / `way{i}s` is a rect that, filled, shuts
 * one way through (each way is a genuine alternative); `sig{i}` are the structural numbers the seed rolled.
 */

/** Columns a landmark keeps from either end (sculptors/common.ts claimSite). */
const SITE_MARGIN = POCKET + SAFE_TILES;
/** Flat bank between the river and the structure: the bridge's landing and a run-up. */
const BANK = 3;
/** Rows a passage through a structure is tall: a runner's height and a jump's start. */
const DOOR = 3;

const UP = -Math.PI / 2;
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
 * (wide levels). A level built round a landmark has little room left for the sculptor's own pools, so the
 * wide ones ask more often to keep the theme near TWO_PARTS (measured with `pnpm level --stats 200`).
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
 * The swamp river in front of a landmark: a `hardGap` pit dug to the bottom at the right end of its `cols`
 * columns, its bridge hinted and its far bank undercut. Columns it doesn't need stay riverbank. Returns
 * the gap's columns.
 */
function river(g: Grid, rng: Rng, x0: number, cols: number, G: number, parts: number): [number, number] {
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

/** A passage DOOR rows tall at the ground (row G is the floor) from column a to b. */
function passage(g: Grid, a: number, b: number, G: number): void {
  g.clear(Math.min(a, b), G - DOOR, Math.max(a, b), G - 1);
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

/** Points recorded as `${key}{i}` anchors, back as a list. */
function listOf(l: Landmark, key: string): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; l.anchors[`${key}${i}`]; i++) out.push(l.anchors[`${key}${i}`]);
  return out;
}
const record = (key: string, xs: readonly Vec[]) => Object.fromEntries(xs.map((v, i) => [`${key}${i}`, v]));

/** A backdrop shell (drawn by the jungle skin, chosen by the level's concept and the box's shape). */
const shell = (rng: Rng, at: Vec, w: number, h: number): Module => ({ type: 'deco', kind: 'facade', at, w, h, seed: rng.int(0, 1 << 20) });

const STONE = (rng: Rng): PropStyle => makeStyle(rng, ['jade', 'steel'], [40, 100, 160], { woodHue: rng.range(18, 30), glowHue: rng.range(110, 160) });
const LEAFY = (rng: Rng): PropStyle => makeStyle(rng, 'jade', [100, 120, 140], { woodHue: rng.range(20, 32), glowHue: rng.range(80, 130) });

/** A carved stone pressure plate on the stand cell (x, y): a block a hop high whose spikes spring when stepped near. */
function plate(rng: Rng, x: number, y: number): Module[] {
  return [
    { type: 'body', cells: [[x, y]], material: 'stone', conveyor: 0, breakFrames: 0, respawnFrames: 0 },
    { type: 'snapper', cells: [[x, y]], angle: UP, warn: rng.int(24, 32), up: rng.int(26, 36), cool: rng.int(70, 100) },
  ];
}

/** A dart idol standing on the stand cell (x, y), aimed at the point (tx, ty) (tiles): its darts fly straight. */
function idol(rng: Rng, x: number, y: number, tx: number, ty: number): Module {
  const at: Vec = [x + 0.5, y + 0.45];
  return {
    type: 'cannon',
    look: 'totem',
    at,
    angle: datan2(ty - at[1], tx - at[0]),
    ammo: 'bolt',
    interval: rng.int(120, 180),
    burst: rng.int(1, 2),
    speed: rng.int(190, 240),
    length: 0.95,
    seed: rng.int(0, 1 << 20),
  };
}

const idolPiece = (rng: Rng, mods: Module[]): Piece => ({
  name: rng.pick(['Dart Idols', 'Cursed Idol', 'The Blowgun Gods', 'Pointy Welcome']),
  archetype: 'launcher',
  role: 'hazard',
  style: makeStyle(rng, 'jade', [100, 30], { glowHue: rng.pick([120, 150, 40]), woodHue: rng.range(18, 30) }),
  modules: mods,
});

// ------------------------------------------------------------------------------------------------ step temple

/** Structure columns the smallest temple needs: ledges, two tiers each side and a summit. */
const TEMPLE_MIN = 15;

function buildTemple(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const G = at.y + at.h;
  const cross = Math.min(at.w - TEMPLE_MIN - BANK, crossCols(parts));
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  river(g, rng, at.x, cross, G, parts);
  const s0 = at.x + cross + BANK;
  const s1 = at.x + at.w - 1;
  // The plinth: the passage through its foot, its roof two or three rows thick.
  const p0 = s0 + 2;
  const roof = rng.int(2, 3);
  const P = DOOR + roof;
  const plinthW = s1 - p0 + 1;
  // Tiers on the plinth, stepping in from both sides to a summit at least five wide.
  let n = Math.max(1, Math.min(rng.int(2, 4), Math.floor((G - P - 6) / R)));
  while (n > 1 && plinthW - 2 * n < 5) n--;
  const steps = stepWidths(rng, 2 * n, Math.min(plinthW - 5, 2 * n + rng.int(0, n + 2)));
  const near = steps.slice(0, n);
  const far = steps.slice(n);
  // The plinth's landing is where a dart idol stands, so it gets a second column: from the summit where
  // that leaves five, else from a far step.
  if (near[0] < 2) {
    const donor = far.findIndex((w) => w > 1);
    if (plinthW - steps.reduce((t, w) => t + w, 0) > 5) near[0]++;
    else if (donor >= 0) {
      far[donor]--;
      near[0]++;
    }
  }
  for (let c = p0; c <= s1; c++) col(g, c, P, G);
  let a = p0;
  let b = s1;
  const landings: Vec[] = [];
  for (let k = 0; k < n; k++) {
    // The landing this tier steps back from, near side: its last column, against the tier's face.
    if (near[k] >= 2) landings.push([a + near[k] - 1, G - P - k * R - 1]);
    a += near[k];
    b -= far[k];
    for (let c = a; c <= b; c++) col(g, c, P + (k + 1) * R, G);
  }
  const top = G - P - n * R;
  passage(g, p0, s1, G);
  ledges(g, s0, G - P, G);
  // Plates on the far landings, a column in from each tier's foot.
  const plates: Vec[] = [];
  let fb = s1;
  for (let k = 0; k < n; k++) {
    if (far[k] >= 2) plates.push([fb - far[k] + 2, G - P - k * R - 1]);
    fb -= far[k];
  }
  const mid = Math.floor((a + b) / 2);
  return {
    concept: 'step-temple',
    rect: { x: at.x, y: Math.max(1, G - Math.max(P + n * R + 4, 16)), w: at.w, h: Math.min(G - 1, Math.max(P + n * R + 4, 16)) },
    air: [
      { x: a, y: top - 3, w: b - a + 1, h: 3 },
      { x: p0, y: G - DOOR, w: s1 - p0 + 1, h: DOOR },
    ],
    anchors: {
      summit: [a, b],
      top: [top, G],
      passage: [p0, s1],
      ledges: [s0, G - P],
      ...record('landing', landings),
      ...record('plate', plates),
      ...ways([
        { x: mid, y: 0, w: 1, h: top },
        { x: mid, y: G - DOOR, w: 1, h: DOOR },
      ]),
      sig0: [n, P],
      sig1: [b - a + 1, s1 - s0],
      sig2: listSig(near),
      sig3: listSig(far),
    },
    skin: 'carved',
  };
}

function* templePieces(rng: Rng, _s: Site, l: Landmark): Generator<Piece> {
  const [a, b] = l.anchors.summit;
  const [top, G] = l.anchors.top;
  const [p0, p1] = l.anchors.passage;
  const [s0] = l.anchors.ledges;
  const R = easyRise();
  // The boulder, rolling back and forth across the summit, with the temple's back wall behind it all.
  const w = R > 2 ? 3 : 2;
  const sw = b - a + 1;
  yield {
    name: rng.pick(['The Idol Run', 'Chase-Scene Boulder', 'Rolling Thunder', 'Temple Run']),
    archetype: 'crusher',
    role: 'hazard',
    style: makeStyle(rng, 'jade', [34, 40], { glowHue: rng.range(110, 160) }),
    modules: [
      // The passage's carved walls, and the shrine and the pyramid's back behind the summit.
      shell(rng, [p0, G - DOOR], p1 - p0 + 1, DOOR),
      shell(rng, [a, top - 4], sw, 4),
      {
        type: 'vehicle',
        look: 'boulder',
        at: [a, top],
        cols: w === 2 ? [1.75, 1.75] : [2.4, 2.9, 2.4],
        colW: 1,
        span: Math.max(2, sw - w),
        speed: rng.range(2.2, 3.4),
        pause: rng.int(40, 90),
        hurt: 'lead',
        flip: rng.chance(0.5),
        seed: rng.int(0, 1 << 20),
      },
    ],
  };
  // Dart idols on the near landings, aimed down the stair at the foot of the ledges.
  const spots = listOf(l, 'landing');
  if (spots.length) {
    const mods = rng
      .shuffle(spots.slice())
      .slice(0, rng.int(1, 2))
      .map(([x, y]) => idol(rng, x, y, s0 - 1.5, G - 0.5));
    yield idolPiece(rng, mods);
  }
  // Pressure plates on the far landings.
  const plates = listOf(l, 'plate');
  if (plates.length)
    yield {
      name: rng.pick(['Pressure Plates', 'Mind the Step', 'Booby Trap', 'Click']),
      archetype: 'snapper',
      role: 'hazard',
      style: STONE(rng),
      modules: rng
        .shuffle(plates.slice())
        .slice(0, rng.int(1, 2))
        .flatMap(([x, y]) => plate(rng, x, y)),
    };
}

export const STEP_TEMPLE = defineConcept({
  id: 'step-temple',
  scale: 'grand',
  varies: ['tiers (count and step widths)', 'plinth height', 'summit width', 'which landings hold idols and plates', 'boulder speed and side'],
  weight: 3,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, TEMPLE_MIN + BANK),
  ownsCrossing: true,
  family: ['dart idol', 'snapjaw', 'log trap', 'boulder'],
  names: ['The Step Temple of {place}', 'Temple of {place}', 'The Sunken Pyramid of {place}', 'The Idol Run at {place}'],
  codex: {
    about:
      'A stepped pyramid: a boulder patrolling the summit, darts down the stair, pressure plates on the landings. Over the top, or through the passage at its foot.',
  },
  box: (k, rng) => {
    const cross = crossFor(k, TEMPLE_MIN + BANK);
    return { w: cross + BANK + structCols(k, rng, TEMPLE_MIN, [20, 32], true), h: boxH(k, DOOR + 3 + 4 * easyRise() + 4) };
  },
  build: buildTemple,
  pieces: (rng, s, l) => templePieces(rng, s, l),
});

// ------------------------------------------------------------------------------------------------ waterfall cliff

const CLIFF_MIN = 13;

function buildCliff(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const G = at.y + at.h;
  const cross = Math.min(at.w - CLIFF_MIN - BANK, crossCols(parts));
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  river(g, rng, at.x, cross, G, parts);
  const s0 = at.x + cross + BANK;
  const s1 = at.x + at.w - 1;
  const c0 = s0 + 2;
  // A sheer face a few ledges high, then rough terraces stepping down at the back, none lower than the
  // grotto under them needs.
  const low = DOOR + 2;
  const hc = Math.max(low + R, Math.min(G - 6, rng.int(4, 5) * R + rng.int(1, 2)));
  const pw = Math.max(3, Math.min(s1 - c0 + 1 - 2, rng.int(4, 7)));
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
  // The river's notch in the lip, where it spills over.
  const notch = rng.chance(0.5);
  if (notch) g.clear(c0, G - hc, c0, G - hc);
  // Up the face under the falls, or through the grotto behind them.
  ledges(g, s0, G - hc, G);
  passage(g, c0, s1, G);
  const mid = c0 + Math.floor(pw / 2);
  const stands: Vec[] = [];
  for (let c = c0 + 2; c < c0 + pw; c++) stands.push([c, G - hc - 1]);
  return {
    concept: 'waterfall-cliff',
    rect: { x: s0, y: G - hc - 3, w: s1 - s0 + 1, h: hc + 3 },
    air: [
      { x: s0, y: G - hc, w: 2, h: hc },
      { x: c0, y: G - DOOR, w: s1 - c0 + 1, h: DOOR },
    ],
    anchors: {
      // The falls leave level with the clifftop (never a ledge's row), between the two ledge columns.
      lip: [s0 + 1, G - hc],
      notch: [notch ? 1 : 0, 0],
      grotto: [c0, s1],
      ground: [G, hc],
      ...record('stand', stands),
      ...ways([
        { x: mid, y: 0, w: 1, h: G - hc },
        { x: mid, y: G - DOOR, w: 1, h: DOOR },
      ]),
      sig0: [hc, pw],
      sig1: [notch ? 1 : 0, backs.length],
      sig2: listSig(backs.map((t) => t.h)),
    },
  };
}

function* cliffPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const [lx, ly] = l.anchors.lip;
  const [G, hc] = l.anchors.ground;
  const [c0, s1] = l.anchors.grotto;
  // The falls: off the lip and down over both ledge columns, shoving whoever climbs there back down while
  // they run, easing off now and then; behind them, the grotto's wall and the cliff's back.
  yield {
    name: rng.pick(['The Falls', 'Angel Falls', 'Big Splash', 'Over the Edge']),
    archetype: 'fan',
    role: 'hazard',
    style: LEAFY(rng),
    modules: [
      shell(rng, [c0, G - hc - 2], s1 - c0 + 1, hc + 2),
      {
        type: 'geyser',
        look: 'water',
        at: [lx, ly],
        angle: DOWN,
        width: 1.6,
        length: G - ly,
        off: rng.int(60, 90),
        warn: rng.int(36, 48),
        on: rng.int(150, 220),
        lethal: false,
        strength: rng.int(2200, 2800),
      },
    ],
  };
  // A snapjaw rooted on the clifftop, out of the falls' reach.
  const tops = listOf(l, 'stand');
  if (tops.length)
    yield {
      name: rng.pick(['Snapjaws', 'Man-Eating Plants', 'Feed Me', 'The Salad Bar']),
      archetype: 'snapper',
      role: 'hazard',
      style: LEAFY(rng),
      modules: rng
        .shuffle(tops.slice())
        .filter((p, i, all) => i === 0 || Math.abs(p[0] - all[0][0]) >= 2)
        .slice(0, rng.int(1, 2))
        .flatMap(([x, y]) => snapjaw(rng, x, y)),
    };
}

export const WATERFALL_CLIFF = defineConcept({
  id: 'waterfall-cliff',
  varies: ['cliff height', 'clifftop length', 'back terraces (count, widths, heights)', 'the notch the river spills from', 'where the snapjaw roots'],
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, CLIFF_MIN + BANK),
  ownsCrossing: true,
  family: ['snapjaw', 'log swing', 'dart idol'],
  names: ['The Falls of {place}', '{place} Falls', 'The Hidden Grotto of {place}', 'The Cliffs of {place}'],
  codex: {
    about: 'A river spilling off a sheer cliff onto the ledges you’d climb. Up through the falls when they ease off, or through the grotto behind them.',
  },
  box: (k, rng) => {
    const cross = crossFor(k, CLIFF_MIN + BANK);
    return { w: cross + BANK + structCols(k, rng, CLIFF_MIN, [16, 26]), h: boxH(k, 5 * easyRise() + 6) };
  },
  build: buildCliff,
  pieces: (rng, _s, l) => cliffPieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ canopy village

const VILLAGE_MIN = 16;
/** Trunk width. */
const TRUNK = 2;

function buildVillage(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const G = at.y + at.h;
  const cross = Math.min(at.w - VILLAGE_MIN - BANK, crossCols(parts));
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  river(g, rng, at.x, cross, G, parts);
  const s0 = at.x + cross + BANK;
  const s1 = at.x + at.w - 1;
  // Decks a storey up (a runner walks the floor under them), each tree's a little higher or lower than the last.
  const base = Math.max(DOOR + 2, Math.min(G - 8, rng.int(2, 3) * R + 1));
  // The trees, the rest spread between: the first a column or two past the branch ledges, the last one to
  // three short of the lift.
  const first = s0 + 3 + rng.int(0, 1);
  const lastX = s1 - 5 - rng.int(0, 2);
  const nTrees = Math.max(2, Math.min(4, Math.floor((lastX - first) / 8) + 1));
  const trees: { x: number; d: number }[] = [];
  for (let i = 0; i < nTrees; i++) {
    const x = Math.round(first + ((lastX - first) * i) / (nTrees - 1)) + (i > 0 && i < nTrees - 1 ? rng.int(-1, 1) : 0);
    const d = Math.max(DOOR + 2, base + (i % 2 ? rng.pick([0, R]) : rng.pick([0, -1])));
    trees.push({ x, d });
  }
  // A deck round the top of each trunk; the last one runs on to the lift.
  const decks: [number, number, number][] = [];
  for (const [i, t] of trees.entries()) {
    for (let c = t.x; c < t.x + TRUNK; c++) col(g, c, t.d, G);
    const l = i === 0 ? s0 + 2 : t.x - 1;
    const r = i === trees.length - 1 ? s1 - 3 : t.x + TRUNK;
    for (let c = l; c <= r; c++) if (c < t.x || c >= t.x + TRUNK) g.set(c, G - t.d, T_ONEWAY, true);
    decks.push([l, r, G - t.d]);
  }
  // Rope bridges between the decks, level with the lower one (the higher deck is a hop up from its end), a
  // rotten stretch a hop wide in the middle of some, where planks that give way go.
  const gaps: Vec[] = [];
  const floors: Vec[] = [];
  for (let i = 0; i + 1 < trees.length; i++) {
    const [, r0, y0] = decks[i];
    const [l1, , y1] = decks[i + 1];
    const y = Math.max(y0, y1);
    const from = r0 + 1;
    const to = l1 - 1;
    const rot = to - from >= 4 && rng.chance(0.65) ? from + rng.int(1, to - from - 2) : -1;
    for (let c = from; c <= to; c++) if (rot < 0 || c < rot || c > rot + 1) g.set(c, y, T_ONEWAY, true);
    if (rot >= 0) gaps.push([rot, y], [rot + 1, y]);
    for (let c = from + 1; c < to; c++) floors.push([c, G - 1]);
  }
  // Up the first tree's branches, or along the floor through the hollow trunks.
  ledges(g, s0, G - trees[0].d, G);
  for (const t of trees) passage(g, t.x, t.x + TRUNK - 1, G);
  const last = trees[trees.length - 1];
  const hi = Math.max(...trees.map((t) => t.d));
  const mid = trees[0].x + TRUNK + Math.floor((trees[1].x - trees[0].x - TRUNK) / 2);
  return {
    concept: 'canopy-village',
    rect: { x: at.x, y: Math.max(1, G - Math.max(hi + 9, 16)), w: at.w, h: Math.min(G - 1, Math.max(hi + 9, 16)) },
    air: [{ x: s1 - 2, y: G - last.d - 2, w: 2, h: last.d + 2 }],
    anchors: {
      village: [s0, s1],
      ground: [G, hi],
      lift: [s1 - 2, last.d],
      ...record(
        'tree',
        trees.map((t) => [t.x, t.d] as Vec),
      ),
      ...record('rot', gaps),
      ...record('floor', floors),
      ...ways([
        { x: mid, y: 0, w: 1, h: G - Math.min(trees[0].d, trees[1].d) + 1 },
        { x: mid, y: G - DOOR, w: 1, h: DOOR },
      ]),
      sig0: [nTrees, base],
      sig1: listSig(trees.map((t) => t.x - s0)),
      sig2: listSig(trees.map((t) => t.d)),
      sig3: [gaps.length, s1 - s0],
    },
    // Trunks and decks of boards: the village is built, not grown.
    skin: 'planks',
  };
}

function* villagePieces(rng: Rng, l: Landmark): Generator<Piece> {
  const [s0, s1] = l.anchors.village;
  const [G, hi] = l.anchors.ground;
  // A snapjaw rooted on the forest floor between two trees (or on the first deck, where the trees stand close),
  // with the village behind it all: crowns, huts and ladders, down to the floor so the hollow trunks stand on it.
  const floors = listOf(l, 'floor');
  const [tx, td] = l.anchors.tree0;
  const root: Vec = floors.length ? rng.pick(floors) : [tx + TRUNK, G - td - 1];
  yield {
    name: rng.pick(['Snapjaw', 'Man-Eating Plant', 'Feed Me', 'Undergrowth']),
    archetype: 'snapper',
    role: 'hazard',
    style: LEAFY(rng),
    modules: [shell(rng, [s0, G - hi - 8], s1 - s0 + 1, hi + 8), ...snapjaw(rng, ...root)],
  };
  // Rotten planks in the bridges, giving way under you and back a while later.
  const rot = listOf(l, 'rot') as Cell[];
  if (rot.length)
    yield {
      name: rng.pick(['Rotten Planks', 'Wobbly Walkway', 'Do Not Look Down', 'Rope Bridge']),
      archetype: 'crumble',
      role: 'build',
      style: LEAFY(rng),
      modules: [{ type: 'body', cells: rot, material: 'crumble', conveyor: 0, breakFrames: rng.int(18, 28), respawnFrames: rng.int(160, 240) }],
      pathSafe: true,
    };
  // The pulley lift at the far end: a basket hauled from the floor up level with the last deck and back.
  const [lx, d] = l.anchors.lift;
  yield {
    name: rng.pick(['Pulley Lift', 'Basket Lift', 'Going Up', 'The Banana Elevator']),
    archetype: 'platform',
    role: 'build',
    style: LEAFY(rng),
    modules: [
      {
        type: 'body',
        cells: [
          [lx, G - 1],
          [lx + 1, G - 1],
        ],
        material: 'wood',
        conveyor: 0,
        breakFrames: 0,
        respawnFrames: 0,
      },
    ],
    motion: { type: 'rail', angle: UP, range: d - 1, period: rng.int(240, 320), dwell: rng.int(70, 100) },
    crushOk: true,
  };
}

export const CANOPY_VILLAGE = defineConcept({
  id: 'canopy-village',
  scale: 'grand',
  varies: ['trees (count and spacing)', 'deck heights', 'rotten planks in the bridges', 'where the snapjaw roots', 'lift timing'],
  weight: 3,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, VILLAGE_MIN + BANK),
  ownsCrossing: true,
  family: ['snapjaw', 'log trap', 'dart idol', 'log swing'],
  names: ['The Canopy Village of {place}', '{place} Treetops', 'The Tree Houses of {place}', 'The High Village at {place}'],
  codex: {
    about:
      'Tree houses on two to four trunks, rope bridges between them with a few planks gone soft. Across the decks, up the pulley lift, or through the hollow trunks below.',
  },
  box: (k, rng) => {
    const cross = crossFor(k, VILLAGE_MIN + BANK);
    return { w: cross + BANK + structCols(k, rng, VILLAGE_MIN, [22, 34], true), h: boxH(k, 3 * easyRise() + 10) };
  },
  build: buildVillage,
  pieces: (rng, _s, l) => villagePieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ thorn gorge

const GORGE_MIN = 13;

function buildGorge(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const G = at.y + at.h;
  const cross = Math.min(at.w - GORGE_MIN - BANK, crossCols(parts));
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  const [a, b] = river(g, rng, at.x, cross, G, parts);
  const s0 = at.x + cross + BANK;
  const s1 = at.x + at.w - 1;
  // The bramble bluff: up its roots (one-way), over its top, or through the tunnel under it.
  const c0 = s0 + 2;
  const hb = Math.max(DOOR + 2, Math.min(G - 9, DOOR + rng.int(2, 3) + (rng.chance(0.4) ? R : 0)));
  for (let c = c0; c <= s1; c++) col(g, c, hb, G);
  passage(g, c0, s1, G);
  ledges(g, s0, G - hb, G);
  const mid = Math.floor((c0 + s1) / 2);
  // How far down the gorge's walls the thorns grow.
  const deep = Math.min(g.h - 1, G + rng.int(4, 6));
  return {
    concept: 'thorn-gorge',
    rect: { x: at.x, y: G - hb - 7, w: at.w, h: hb + 7 },
    air: [
      { x: c0, y: G - hb - 6, w: s1 - c0 + 1, h: 6 },
      { x: c0, y: G - DOOR, w: s1 - c0 + 1, h: DOOR },
    ],
    anchors: {
      gorge: [a, b],
      deep: [deep, 0],
      bluff: [c0, s1],
      top: [G - hb, G],
      ...ways([
        { x: mid, y: 0, w: 1, h: G - hb },
        { x: mid, y: G - DOOR, w: 1, h: DOOR },
      ]),
      sig0: [hb, b - a + 1],
      sig1: [s1 - c0 + 1, deep - G],
    },
  };
}

function* gorgePieces(rng: Rng, s: Site, l: Landmark): Generator<Piece> {
  const [a, b] = l.anchors.gorge;
  const [deep] = l.anchors.deep;
  const [c0, s1] = l.anchors.bluff;
  const [top, G] = l.anchors.top;
  // The gorge: its far wall and the broken rope bridge hanging into it behind, thorns down its walls in front.
  const near: Cell[] = [];
  const far: Cell[] = [];
  if (b >= a) {
    for (let y = G + 2; y <= deep; y++) {
      if (s.solid(a - 1, y)) near.push([a - 1, y]);
      if (s.solid(b + 3, y) && !s.solid(b + 2, y)) far.push([b + 3, y]);
    }
  }
  yield {
    name: rng.pick(['Thorn Gorge', 'The Briar Patch', 'Prickly Drop', 'Bramble Canyon']),
    archetype: 'spikestrip',
    role: 'hazard',
    style: LEAFY(rng),
    modules: [
      ...(b >= a ? [shell(rng, [a - 1, G - 2], b - a + 3, s.h - G + 2)] : []),
      ...(near.length ? [{ type: 'spikes', cells: near, angle: 0, look: 'thorn' } as Module] : []),
      ...(far.length ? [{ type: 'spikes', cells: far, angle: Math.PI, look: 'thorn' } as Module] : []),
    ],
    pathSafe: true,
  };
  // The bramble tunnel: thorns hanging from its roof, and the bluff's dark inside behind.
  const roof: Cell[] = [];
  for (let c = c0 + 1; c < s1; c++) if (rng.chance(0.55)) roof.push([c, G - DOOR - 1]);
  if (!roof.length) roof.push([c0 + 1, G - DOOR - 1]);
  yield {
    name: rng.pick(['Bramble Tunnel', 'Thorny Underpass', 'Mind Your Head', 'Hedge Fund']),
    archetype: 'spikestrip',
    role: 'hazard',
    style: LEAFY(rng),
    modules: [shell(rng, [c0, G - DOOR], s1 - c0 + 1, DOOR), { type: 'spikes', cells: roof, angle: DOWN, look: 'thorn' }],
    pathSafe: true,
  };
  // Spiked logs swinging over the bluff's top from a timber frame, out of step with each other.
  const w = s1 - c0 + 1;
  const n = w >= 18 ? 2 : 1;
  const mods: Module[] = [];
  for (let i = 0; i < n; i++) {
    const hx = c0 + Math.round(((i + 0.5) * w) / n);
    mods.push({
      type: 'swinger',
      head: 'log',
      hub: [hx + 0.5, top - 4.3],
      arm: 3.6,
      angle0: DOWN,
      period: rng.int(215, 250),
      swing: rng.range(0.95, 1.1),
      dir: i % 2 ? -1 : 1,
      radius: rng.range(0.75, 0.85),
      count: 1,
      link: 'rod',
    });
  }
  yield {
    name: rng.pick(['Log Traps', 'The Battering Logs', 'Timber!', 'Knock on Wood']),
    archetype: 'flail',
    role: 'hazard',
    style: LEAFY(rng),
    modules: mods,
  };
}

export const THORN_GORGE = defineConcept({
  id: 'thorn-gorge',
  varies: ['gorge width and depth', 'bluff height and width', 'thorns in the tunnel roof', 'how many logs swing', 'log timing'],
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, GORGE_MIN + BANK),
  ownsCrossing: true,
  family: ['log trap', 'snapjaw', 'dart idol'],
  names: ['The Thorn Gorge of {place}', '{place} Gorge', 'The Briars of {place}', 'The Broken Bridge at {place}'],
  codex: {
    about:
      'A gorge lined with thorns and a rope bridge that gave up. Past it, a bramble bluff: through the tunnel under its thorny roof, or over the top under the swinging logs.',
  },
  box: (k, rng) => {
    const cross = crossFor(k, GORGE_MIN + BANK);
    return { w: cross + BANK + structCols(k, rng, GORGE_MIN, [16, 26]), h: boxH(k, DOOR + 3 + easyRise() + 8) };
  },
  build: buildGorge,
  pieces: (rng, s, l) => gorgePieces(rng, s, l),
});

// ------------------------------------------------------------------------------------------------ sun gate

const GATE_MIN = 12;

function buildGate(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const G = at.y + at.h;
  const cross = Math.min(at.w - GATE_MIN - BANK, crossCols(parts));
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  river(g, rng, at.x, cross, G, parts);
  const s0 = at.x + cross + BANK;
  const s1 = at.x + at.w - 1;
  // The monolith: tall, sometimes crowned a row proud at either end, the gate through its foot.
  const m0 = s0 + 2;
  const mw = Math.max(GATE_MIN - 4, Math.min(s1 - m0, rng.int(GATE_MIN - 4, GATE_MIN + 2)));
  const m1 = m0 + mw - 1;
  const hm = Math.max(DOOR + 4, Math.min(G - 6, rng.int(4, 5) * R + rng.int(2, 3)));
  const crown = rng.chance(0.5);
  for (let c = m0; c <= m1; c++) col(g, c, hm + (crown && (c === m0 || c === m1) ? 1 : 0), G);
  passage(g, m0, m1, G);
  const ledgeRows = ledges(g, s0, G - hm - (crown ? 1 : 0), G);
  const mid = Math.floor((m0 + m1) / 2);
  return {
    concept: 'sun-gate',
    rect: { x: s0, y: G - hm - 4, w: s1 - s0 + 1, h: hm + 4 },
    air: [
      { x: s0, y: G - hm - 2, w: 2, h: hm + 2 },
      { x: m0, y: G - DOOR, w: mw, h: DOOR },
    ],
    anchors: {
      mono: [m0, m1],
      top: [G - hm, G],
      crown: [crown ? 1 : 0, 0],
      ...ways([
        { x: mid, y: 0, w: 1, h: G - hm },
        { x: mid, y: G - DOOR, w: 1, h: DOOR },
      ]),
      sig0: [hm, mw],
      sig1: [crown ? 1 : 0, s1 - m1],
      sig2: [ledgeRows.length, mid - s0],
    },
    skin: 'carved',
  };
}

function* gatePieces(rng: Rng, l: Landmark): Generator<Piece> {
  const [m0, m1] = l.anchors.mono;
  const [top, G] = l.anchors.top;
  const crown = l.anchors.crown[0] > 0;
  // A pressure plate in the gate, first: the inner beam stops at it, so it shields whoever hops it.
  const px = m0 + 2 + rng.int(0, Math.max(0, m1 - m0 - 4));
  yield {
    name: rng.pick(['Pressure Plate', 'The Floor Is Lying', 'Booby Trap', 'Click']),
    archetype: 'snapper',
    role: 'hazard',
    style: STONE(rng),
    modules: plate(rng, px, G - 1),
  };
  // Two lenses in the gate's lintel, at either end of it: the outer one burns down across the approach and
  // the ledges' foot, the inner one along the gate itself at a runner's height.
  const out: Module = {
    type: 'flame',
    at: [m0 + 0.5, G - DOOR + 0.4],
    angle: Math.PI - rng.range(0.55, 0.75),
    length: rng.range(4.5, 5.5),
    on: rng.int(40, 60),
    off: rng.int(120, 170),
    warn: rng.int(40, 52),
  };
  // The inner beam slants from the far lintel to the floor at the gate's mouth: no ducking under it.
  const run = m1 - m0;
  const along: Module = {
    type: 'flame',
    at: [m1 + 0.5, G - DOOR + 0.4],
    angle: datan2(DOOR - 1.1, -run),
    length: dhypot(run, DOOR - 1.1),
    on: rng.int(36, 52),
    off: rng.int(140, 190),
    warn: rng.int(40, 52),
  };
  yield {
    name: rng.pick(['The Sun Gate', 'Burning Glass', 'Solar Altar', 'Magnifying Glare']),
    archetype: 'flamer',
    role: 'hazard',
    style: STONE(rng),
    modules: [shell(rng, [m0, G - DOOR], m1 - m0 + 1, DOOR), out, along],
  };
  // A dart idol on the crown's far end, aimed down the ledges.
  const ix = crown ? m1 - 1 : m1;
  yield idolPiece(rng, [idol(rng, ix, top - 1, m0 - 2.5, G - 0.5)]);
}

export const SUN_GATE = defineConcept({
  id: 'sun-gate',
  varies: ['monolith height and width', 'its crown', 'beam angles and timing', 'where the pressure plate is'],
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, GATE_MIN + BANK),
  ownsCrossing: true,
  family: ['dart idol', 'snapjaw', 'boulder'],
  names: ['The Sun Gate of {place}', 'The Burning Glass of {place}', 'The Solar Gate at {place}', '{place} Monolith'],
  codex: {
    about:
      'A carved monolith whose two lenses focus the sun into burning beams. Through the gate between beats, or up and over the crown, where a dart idol keeps watch.',
  },
  box: (k, rng) => {
    const cross = crossFor(k, GATE_MIN + BANK);
    return { w: cross + BANK + structCols(k, rng, GATE_MIN, [14, 18]), h: boxH(k, 5 * easyRise() + 7) };
  },
  build: buildGate,
  pieces: (rng, _s, l) => gatePieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ registry

export const JUNGLE_CONCEPTS: Concept[] = [STEP_TEMPLE, WATERFALL_CLIFF, CANOPY_VILLAGE, THORN_GORGE, SUN_GATE];

/** Structure columns per concept, for the crossing a level's box gets room for. */
const STRUCT: Record<string, number> = {
  'step-temple': TEMPLE_MIN + BANK,
  'waterfall-cliff': CLIFF_MIN + BANK,
  'canopy-village': VILLAGE_MIN + BANK,
  'thorn-gorge': GORGE_MIN + BANK,
  'sun-gate': GATE_MIN + BANK,
};

/**
 * How many parts the jungle landmark's own crossing takes on this attempt, given the level's `challenges`:
 * two where its box made room for a two-part one (and the attempt still insists on two, TWO_PART_TRIES),
 * else one; none when the level asks for none.
 */
export function jungleOwns(c: Concept, k: Knobs, attempt: number, challenges: number): number {
  if (challenges <= 0) return 0;
  const s = STRUCT[c.id];
  return attempt < TWO_PART_TRIES && s !== undefined && crossFor(k, s) >= twoGap() && twoGap() > oneGap() ? 2 : 1;
}
