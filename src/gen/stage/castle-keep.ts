import type { Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import type { LevelProfile, TileRect } from '../../sim/level';
import type { Module } from '../../sim/props';
import type { Grid } from '../level/kit';
import { hopGap, type Knobs } from '../level/sculptors/common';
import type { Piece, Site } from '../setpieces/place';
import {
  boxH,
  classicRoom,
  DOOR,
  DOWN,
  digMoat,
  footing,
  GILT,
  IRON,
  ledges,
  listOf,
  merlons,
  moatMax,
  passage,
  record,
  shell,
  SITE_MARGIN,
  structureOf,
  ways,
} from './castle-kit';
import { defineConcept } from './contract';
import { capFlood } from './flood';
import type { Landmark } from './types';

/**
 * Three more castle places (docs/SETPIECES.md, Castle), each laid out afresh from its seed, each owning the
 * level's moat in front of it (./castle-kit.ts), each with two static ways past: through its foot, or up
 * one-way ledges on its front face and over the top.
 *
 * - **The Gatehouse**: two towers and the gate between them, the drawbridge hanging broken into the moat
 *   in front. Through the gate passage, under a portcullis that slams on whoever lingers under it and
 *   murder holes that pour fire down from the vault, or up the front tower and along the wall-walk.
 * - **The Bell Tower**: a chapel and its tower. Through the arch at the tower's foot and down the nave,
 *   under a chandelier waiting to drop, or up the tower's face, through the belfry past the great bell
 *   swinging in it, and over the nave's roof.
 * - **The Boss Bridge** (grand): two keeps over a trench of lava, our own take on the plumber's last
 *   castle. A stone bridge across the lava with gaps to hop, burning bars turning over it; or up the
 *   front keep and over the high walkway between the keeps' tops. The lava rises and falls in the trench.
 *
 * Anchors the tests read: `way{i}` / `way{i}s` is a rect that, filled, shuts one way through.
 */

/** Room for a structure of `min` columns beside the widest moat on this level, at its gravity. */
const roomFor = (p: Partial<LevelProfile>, min: number) => min <= classicRoom(p.gravity, p.w ?? 48);

/** Columns of structure: at least `min`, a few more by the seed, a lot more on a wide level, never more than the middle leaves. */
function structCols(k: Knobs, rng: Rng, min: number, wide: readonly [number, number]): number {
  const room = k.W - 2 * SITE_MARGIN - moatMax() - 1;
  return Math.max(min, Math.min(room, k.W > 56 ? rng.int(wide[0], wide[1]) : min + rng.int(0, 4)));
}

// ------------------------------------------------------------------------------------------------ gatehouse

const GATE_MIN = 13;
/** Tower width. */
const GT = 3;

function buildGatehouse(g: Grid, rng: Rng, box: TileRect, parts: number): Landmark {
  const moat = digMoat(g, rng, box, parts);
  const at = structureOf(box);
  const G = at.y + at.h;
  const s0 = at.x;
  const s1 = at.x + at.w - 1;
  g.clear(s0, at.y, s1, G - 1);
  const f0 = s0 + 2;
  const f1 = f0 + GT - 1;
  const b0 = s1 - GT + 1;
  // The gate block over the passage, two or three rows thick; the towers stand above its wall-walk.
  const T = rng.int(2, 3);
  const Gt = G - DOOR - T;
  const spare = Math.max(1, Gt - at.y - 2);
  const Ft = Gt - Math.min(spare, rng.int(2, 4));
  const Bt = Gt - Math.min(spare, rng.int(1, 3));
  g.fill(f0, Ft, f1, G - 1, 1, true);
  g.fill(b0, Bt, s1, G - 1, 1, true);
  g.fill(f1 + 1, Gt, b0 - 1, G - 1, 1, true);
  merlons(g, f0, f1, Ft - 1);
  merlons(g, b0, s1, Bt - 1);
  // Merlons along the wall-walk, alternate columns, never against a tower (a notch you'd be stuck in).
  for (let x = f1 + 2 + rng.int(0, 1); x <= b0 - 2; x += 2) g.set(x, Gt - 1, 1, true);
  // The gate passage, straight through both towers and the gate between them.
  passage(g, f0, s1, G);
  ledges(g, s0, Ft, G);
  const mid = Math.floor((f1 + 1 + b0 - 1) / 2);
  return {
    concept: 'gatehouse',
    rect: at,
    air: [{ x: f0, y: G - DOOR, w: s1 - f0 + 1, h: DOOR }],
    anchors: {
      gate: [f1 + 1, b0 - 1],
      ground: [G, Gt],
      towers: [Ft, Bt],
      span: [f0, s1],
      ...(moat ? { moat } : {}),
      ...ways([
        { x: mid, y: G - DOOR, w: 1, h: DOOR },
        { x: mid, y: 0, w: 1, h: Gt },
      ]),
    },
    skin: 'stone',
  };
}

function* gatehousePieces(rng: Rng, s: Site, l: Landmark): Generator<Piece> {
  const [g0, g1] = l.anchors.gate;
  const [G] = l.anchors.ground;
  const [Ft, Bt] = l.anchors.towers;
  const [f0, s1] = l.anchors.span;
  // The portcullis at the gate's mouth (and on some its twin at the back), hung in its slot in the vault:
  // it slams to the floor on whoever stops under it, and winds back up.
  const back = g1 - g0 >= 6 && rng.chance(0.4);
  const front = g1 - g0 >= 6 && rng.chance(0.4) ? g0 + 1 : g0;
  const gates = back ? [front, g1 - 1] : [front];
  const top = Math.min(Ft, Bt) - 3;
  // The drawbridge, hanging broken from its hinge into the moat on one chain: scenery, never a way over.
  const moat = l.anchors.moat;
  yield {
    name: rng.pick(['Portcullis', 'The Iron Curtain', 'Mind the Gate', 'Closing Time']),
    archetype: 'dropper',
    role: 'hazard',
    style: IRON(rng),
    modules: [
      // The gatehouse's inside: the passage's vault, the back parapet and the pennants over the towers.
      shell(rng, [f0, top], s1 - f0 + 1, footing(s, f0, s1, G) - top),
      ...(moat ? [shell(rng, [moat[0], Ft], f0 - moat[0], s.h - Ft)] : []),
      ...gates.map((x): Module => ({
        type: 'dropper',
        cells: [
          [x, G - DOOR],
          [x + 1, G - DOOR],
          [x, G - DOOR + 1],
          [x + 1, G - DOOR + 1],
        ],
        angle: DOWN,
        reach: 1,
        warn: rng.int(24, 34),
        rest: rng.int(60, 90),
        look: 'portcullis',
      })),
    ],
  };
  // Murder holes in the vault between the gates, pouring fire on whoever's under them, in turn.
  const holes: number[] = [];
  for (let x = g0 + 1; x < g1; x++) if (gates.every((p) => x < p - 1 || x > p + 2)) holes.push(x);
  const n = Math.min(holes.length, rng.int(1, 2));
  const pick = rng.shuffle(holes.slice()).slice(0, n);
  const off = rng.int(120, 170);
  if (pick.length)
    yield {
      name: rng.pick(['Murder Holes', 'Hot Welcome', 'Pitch Drop', 'Mind Your Head']),
      archetype: 'flamer',
      role: 'hazard',
      style: IRON(rng),
      modules: pick.map((x, i): Module => ({
        type: 'flame',
        at: [x + 0.5, G - DOOR + 0.05],
        angle: DOWN,
        length: DOOR - 0.1,
        on: rng.int(40, 56),
        off: off + i * 37,
        warn: rng.int(30, 40),
      })),
    };
}

export const GATEHOUSE = defineConcept({
  id: 'gatehouse',
  varies: ['tower heights', 'gate depth', 'vault thickness', 'one portcullis or two', 'murder holes', 'wall-walk merlons'],
  weight: 3,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, GATE_MIN),
  ownsCrossing: true,
  family: ['cannon', 'glass', 'axe', 'ram'],
  budget: 2,
  names: ['The Gatehouse of {place}', 'The Barbican of {place}', 'The Gates of {place}', '{place}: Drawbridge Up'],
  box: (k, rng) => ({ w: moatMax() + 1 + structCols(k, rng, GATE_MIN, [16, 22]), h: boxH(k.H, DOOR + 3 + 4 + 2) }),
  build: buildGatehouse,
  pieces: (rng, s, l) => gatehousePieces(rng, s, l),
});

// ------------------------------------------------------------------------------------------------ bell tower

const BELL_MIN = 14;
/** Rows of open belfry over the tower's body: the bell's rod hangs from the top, its swing clears the floor's corners. */
export const BELFRY = 4;
/** The bell's rod, from its pin under the belfry roof to the bell's middle. */
export const BELL_ARM = 2.5;

function buildBellTower(g: Grid, rng: Rng, box: TileRect, parts: number): Landmark {
  digMoat(g, rng, box, parts);
  const at = structureOf(box);
  const G = at.y + at.h;
  const s0 = at.x;
  const s1 = at.x + at.w - 1;
  g.clear(s0, at.y, s1, G - 1);
  const TW = rng.int(5, 6);
  const t0 = s0 + 2;
  const t1 = t0 + TW - 1;
  const n0 = t1 + 1;
  // Rows the tower's body may take: the box over the belfry, its roof, the spire and a row of sky.
  const spire = rng.int(1, 2);
  const body = at.h - 1 - BELFRY - 1 - spire;
  // The nave: a hall of three to six rows under a roof, a gable on it where it's wide enough, all of it
  // two rows under the belfry's floor.
  const navH = Math.max(3, Math.min(rng.int(4, 6), body - 3));
  const Nr = G - navH - 1;
  g.fill(n0, Nr, s1, Nr, 1, true);
  g.fill(s1, Nr, s1, G - 1, 1, true);
  let ridge = Nr;
  if (s1 - n0 >= 5 && body - navH - 3 >= 1) {
    g.fill(n0 + 1, Nr - 1, s1 - 1, Nr - 1, 1, true);
    ridge = Nr - 1;
    if (s1 - n0 >= 9 && body - navH - 3 >= 2 && rng.chance(0.6)) {
      g.fill(n0 + 3, Nr - 2, s1 - 3, Nr - 2, 1, true);
      ridge = Nr - 2;
    }
  }
  // The tower: its body up past the nave's ridge, the belfry open over it, its roof and spire.
  const lo = G - ridge + 2;
  const hb = rng.int(lo, Math.max(lo, Math.min(body, lo + 3)));
  const Tb = G - hb;
  g.fill(t0, Tb, t1, G - 1, 1, true);
  const roof = Tb - BELFRY - 1;
  g.fill(t0, roof, t1, roof, 1, true);
  for (let k = 1; k <= spire; k++) g.fill(t0 + k, roof - k, t1 - k, roof - k, 1, true);
  // Through the tower's foot and down the nave to the back door; or up the ledges on its face.
  passage(g, t0, t1, G);
  g.clear(s1, G - DOOR, s1, G - 1);
  ledges(g, s0, Tb, G);
  const nm = Math.floor((n0 + s1) / 2);
  return {
    concept: 'bell-tower',
    rect: { x: s0, y: roof - spire - 1, w: s1 - s0 + 1, h: G - (roof - spire - 1) },
    air: [
      { x: t0, y: Tb - BELFRY, w: TW, h: BELFRY },
      { x: n0, y: Nr + 1, w: s1 - n0, h: navH },
      { x: t0, y: G - DOOR, w: TW, h: DOOR },
    ],
    anchors: {
      tower: [t0, t1],
      belfry: [Tb, spire],
      nave: [n0, s1],
      roof: [Nr, navH],
      ground: [G, 0],
      ...ways([
        { x: nm, y: Nr + 1, w: 1, h: navH },
        { x: nm, y: 0, w: 1, h: Nr },
      ]),
    },
    skin: 'stone',
  };
}

function* bellTowerPieces(rng: Rng, s: Site, l: Landmark): Generator<Piece> {
  const [t0, t1] = l.anchors.tower;
  const [Tb, spire] = l.anchors.belfry;
  const [n0, s1] = l.anchors.nave;
  const [Nr, navH] = l.anchors.roof;
  const [G] = l.anchors.ground;
  const TW = t1 - t0 + 1;
  // The great bell, swinging on its rod in the belfry: whoever walks through has to time it. The chapel
  // behind it all.
  const top = Tb - BELFRY - 2 - spire;
  yield {
    name: rng.pick(['The Great Bell', 'For Whom It Tolls', 'Ding Dong', 'Big Bertha']),
    archetype: 'flail',
    role: 'hazard',
    style: GILT(rng),
    modules: [
      shell(rng, [t0, top], s1 - t0 + 1, footing(s, t0, s1, G) - top),
      {
        type: 'swinger',
        head: 'axe',
        hub: [t0 + TW / 2, Tb - BELFRY + 0.2],
        arm: BELL_ARM,
        angle0: DOWN,
        period: rng.int(240, 290),
        swing: rng.range(0.85, 0.95),
        dir: rng.chance(0.5) ? 1 : -1,
        radius: 0.95,
        count: 1,
        link: 'rod',
      },
    ],
  };
  // A chandelier in the nave, hung to drop.
  const nw = s1 - n0;
  const cx = n0 + 1 + rng.int(0, Math.max(0, nw - 4));
  yield {
    name: rng.pick(['Falling Chandelier', 'Overhead Costs', 'The Collection Plate']),
    archetype: 'dropper',
    role: 'hazard',
    style: GILT(rng),
    modules: [
      {
        type: 'dropper',
        cells: [
          [cx, Nr + 1],
          [cx + 1, Nr + 1],
        ],
        angle: DOWN,
        reach: navH - 1,
        warn: rng.int(26, 36),
        rest: rng.int(50, 80),
        look: 'chandelier',
      },
    ],
  };
}

export const BELL_TOWER = defineConcept({
  id: 'bell-tower',
  varies: ['tower width and height', 'spire', 'nave height and gable', 'where the chandelier hangs', 'bell timing'],
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, BELL_MIN),
  ownsCrossing: true,
  family: ['glass', 'chandelier', 'chandrop', 'axe'],
  budget: 2,
  names: ['The Bell Tower of {place}', 'The Belfry of {place}', '{place} Chapel', 'The Bells of {place}'],
  box: (k, rng) => ({ w: moatMax() + 1 + structCols(k, rng, BELL_MIN, [16, 22]), h: boxH(k.H, 20) }),
  build: buildBellTower,
  pieces: (rng, s, l) => bellTowerPieces(rng, s, l),
});

// ------------------------------------------------------------------------------------------------ boss bridge

const BRIDGE_MIN = 14;
/** A firebar's fireballs: how far apart along it, and how big. */
const BALL_STEP = 0.6;
export const BALL_R = 0.34;
/**
 * The innermost fireball's arm. The balls run in from the tip, as close to the pin as leaves every cell they
 * cross clear for a while each turn (the safe window): the pin on a grid line lets them come in further.
 */
const BALL_IN = 0.55;
const BALL_IN_CENTRED = 1.2;

function buildBossBridge(g: Grid, rng: Rng, box: TileRect, parts: number): Landmark {
  digMoat(g, rng, box, parts);
  const at = structureOf(box);
  const G = at.y + at.h;
  const s0 = at.x;
  const s1 = at.x + at.w - 1;
  g.clear(s0, at.y, s1, G - 1);
  const K = at.w >= BRIDGE_MIN + 2 && rng.chance(0.5) ? 4 : 3;
  const f0 = s0 + 2;
  const f1 = f0 + K - 1;
  const b0 = s1 - K + 1;
  const t0 = f1 + 1;
  const t1 = b0 - 1;
  // The hall between the keeps: seven or eight rows of air over the lower bridge, the walkway over it.
  const Ha = rng.int(7, 8);
  const U = G - Ha - 1;
  const Ft = U - rng.int(0, 2);
  const Bt = U - rng.int(0, 2);
  g.fill(f0, Ft, f1, G - 1, 1, true);
  g.fill(b0, Bt, s1, G - 1, 1, true);
  merlons(g, f0, f1, Ft - 1);
  merlons(g, b0, s1, Bt - 1);
  g.fill(t0, U, t1, U, 1, true);
  // The trench, down to the bottom, and the bridge over it at the floor, with a gap or two to hop.
  g.clear(t0, G, t1, g.h - 1);
  g.fill(t0, G, t1, G, 1, true);
  const gaps: Vec[] = [];
  const nGaps = t1 - t0 >= 9 ? rng.int(1, 2) : 1;
  for (let i = 0; i < nGaps; i++) {
    const w = Math.min(2, hopGap(rng, 1));
    const lo = t0 + 2 + Math.floor(((t1 - t0 - 3) * i) / nGaps);
    const hiX = t0 + 2 + Math.floor(((t1 - t0 - 3) * (i + 1)) / nGaps) - w;
    const x = rng.int(lo, Math.max(lo, hiX));
    g.clear(x, G, x + w - 1, G);
    gaps.push([x, w]);
  }
  passage(g, f0, f1, G);
  passage(g, b0, s1, G);
  ledges(g, s0, Ft, G);
  const mid = Math.floor((t0 + t1) / 2);
  const top = Math.min(Ft, Bt) - 2;
  return {
    concept: 'boss-bridge',
    // Grand: the moat, the keeps and the trench down to the lava.
    rect: { x: box.x, y: top, w: box.w, h: g.h - top },
    air: [
      { x: t0, y: U + 1, w: t1 - t0 + 1, h: Ha },
      { x: t0, y: G + 1, w: t1 - t0 + 1, h: g.h - G - 1 },
      { x: f0, y: G - DOOR, w: K, h: DOOR },
      { x: b0, y: G - DOOR, w: K, h: DOOR },
    ],
    anchors: {
      keeps: [f0, s1],
      trench: [t0, t1],
      hall: [U, Ha],
      tops: [Ft, Bt],
      ground: [G, K],
      ...record('gap', gaps),
      ...ways([
        { x: mid, y: U + 1, w: 1, h: Ha },
        { x: mid, y: 0, w: 1, h: U },
      ]),
    },
    skin: 'stone',
  };
}

/** A firebar: fireballs strung along one arm, turning round a pin, every one a swinger on the same hub and beat. */
function firebar(hub: Vec, len: number, angle0: number, period: number, dir: 1 | -1): Module[] {
  const out: Module[] = [];
  // A pin in the middle of a cell: the inner balls would never leave it, so they start further out.
  const centred = hub[0] % 1 !== 0 && hub[1] % 1 !== 0;
  for (let arm = len; arm >= (centred ? BALL_IN_CENTRED : BALL_IN) - 1e-6; arm -= BALL_STEP)
    out.push({ type: 'swinger', head: 'saw', hub, arm, angle0, period, swing: 0, dir, radius: BALL_R, count: 1, link: 'none' });
  return out;
}

function* bossBridgePieces(rng: Rng, s: Site, l: Landmark): Generator<Piece> {
  const [f0, s1] = l.anchors.keeps;
  const [t0, t1] = l.anchors.trench;
  const [U, Ha] = l.anchors.hall;
  const [Ft, Bt] = l.anchors.tops;
  const [G] = l.anchors.ground;
  // The keeps' insides and the trench's piers and chains behind, and the lava rising and falling in it,
  // never more than halfway up the piers.
  const top = Math.min(Ft, Bt) - 1;
  const lava = capFlood(
    s.level,
    {
      type: 'flood',
      look: 'lava',
      at: [t0, s.h],
      w: t1 - t0 + 1,
      low: 0,
      // Halfway up the trench at most: higher drowns the bridge's piers, and the bridge reads as floating.
      high: Math.max(1, Math.min(s.h - G - 2, Math.ceil((s.h - G - 1) / 2))),
      off: rng.int(180, 260),
      warn: rng.int(60, 80),
      rise: rng.int(70, 100),
      hold: rng.int(80, 140),
      fall: rng.int(70, 100),
    },
    [],
    s.cache,
  );
  yield {
    name: rng.pick(['The Lava Trench', 'Hot Tub', 'The Last Bridge', 'Floor Is Lava']),
    archetype: 'flamer',
    role: 'hazard',
    style: IRON(rng),
    modules: [shell(rng, [f0, top], s1 - f0 + 1, s.h - top), ...(lava ? [lava] : [])],
  };
  // Firebars turning over the lower bridge, out of reach of the walkway above.
  // Pinned mid-hall, its tip passing a hair under the walkway and through anyone standing on the bridge.
  const cy = U + 1 + Ha / 2;
  const len = Ha / 2 - 0.15 - BALL_R;
  const reach = len + BALL_R;
  const lo = t0 + reach;
  const hi = t1 + 1 - reach;
  const n = hi - lo >= 5 ? 2 : 1;
  const mods: Module[] = [];
  const period = rng.int(170, 240);
  for (let i = 0; i < n; i++) {
    const want = n === 1 ? lo + (hi - lo) * rng.range(0.3, 0.7) : lo + ((hi - lo) * i) / (n - 1);
    const cx =
      Math.ceil(lo) <= Math.floor(hi)
        ? Math.min(Math.floor(hi), Math.max(Math.ceil(lo), Math.round(want)))
        : Math.min(hi, Math.max(lo, Math.round(want * 2) / 2));
    mods.push(...firebar([cx, cy], len, rng.range(0, Math.PI * 2), period + i * 23, rng.chance(0.5) ? 1 : -1));
  }
  yield {
    name: rng.pick(['Firebars', 'Rotisserie', 'The Fire Spinners', 'Hot Spokes']),
    archetype: 'flail',
    role: 'hazard',
    style: IRON(rng),
    modules: mods,
  };
}

/** The bridge's gaps, as tiles: [x, width] each (tests). */
export const bridgeGaps = (l: Landmark): Vec[] => listOf(l.anchors, 'gap');

export const BOSS_BRIDGE = defineConcept({
  id: 'boss-bridge',
  scale: 'grand',
  varies: ['keep widths and heights', 'hall height', 'gaps in the bridge', 'how many firebars and where', 'firebar spin', 'lava timing'],
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, BRIDGE_MIN),
  ownsCrossing: true,
  family: ['cannon', 'axe', 'chandrop', 'glass'],
  budget: 2,
  names: ['The Boss Bridge of {place}', 'The Last Castle of {place}', 'The Lava Keep of {place}', '{place}: The Princess Is Elsewhere'],
  box: (k, rng) => ({ w: moatMax() + 1 + structCols(k, rng, BRIDGE_MIN, [18, 24]), h: boxH(k.H, 8 + 2 + 3) }),
  build: buildBossBridge,
  pieces: (rng, s, l) => bossBridgePieces(rng, s, l),
});
