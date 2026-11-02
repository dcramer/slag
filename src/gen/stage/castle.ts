import type { Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import type { TileRect } from '../../sim/level';
import type { Module, PropStyle } from '../../sim/props';
import { type Grid, T_EMPTY, T_ONEWAY } from '../level/kit';
import { type Piece, makeStyle, type Site } from '../setpieces/place';
import { digMoat, footing, moatMax, structureOf } from './castle-kit';
import { BELL_TOWER, BOSS_BRIDGE, GATEHOUSE } from './castle-keep';
import { defineConcept } from './contract';
import type { Concept, Landmark } from './types';

export { moatMax, structureOf } from './castle-kit';

/**
 * Castle stage concepts (docs/SETPIECES.md, Castle).
 *
 * The Haunted Wing is the owner's own example: a three-storey manor of plank and plaster that owns the
 * middle of the level. Its hall runs straight through, and a stairwell of loose boards climbs from it to
 * every floor and a door off the top one: the static way up, and with the hall the two ways past it.
 * A dumbwaiter rides a shaft beside the stairs, parking flush at every floor: the quick way up, never
 * needed. Both outer walls carry a huge broken window, the glass standing out of its frame, so the walls
 * you'd climb outside cut you. A chandelier hangs over the hall waiting to drop, cobwebs fill a corner
 * and the floor beside the cab's first stop is rotten through.
 *
 * The Throne Hall is a long stone hall between two towers: chandeliers swinging in step from the
 * ceiling, one hung to drop on whoever climbs the dais at the far end to the throne, and the way out
 * behind it. The seed sets its length, its towers, its roof and its dais.
 *
 * The Gatehouse, the Bell Tower and the Boss Bridge are in ./castle-keep.ts. Every one owns the level's
 * crossing: a moat in front, its far bank their doorstep (./castle-kit.ts).
 */

// ------------------------------------------------------------------------------------------------ manor

/** Hall air (rows) on the ground floor; the floors above get UPPER rows each. */
const HALL = 5;
const UPPER = 3;
const ROOF = 3;
/** Box height: hall, two upper floors, three slabs, the gable. */
export const MANOR_H = HALL + 2 * UPPER + 3 + ROOF;

/** The dumbwaiter's shaft: a hop across under a low ceiling while the cab is away, at any gravity. */
const shaftW = () => 2;

/** Where the manor's parts are, worked out from its box alone (build and the tests both read it). */
export interface Manor {
  /** Ground row (first solid row under the box). */
  G: number;
  x0: number;
  x1: number;
  /** Columns of open air either side for the glass to stand out into. */
  gm: number;
  /** Outer and inner wall columns, left and right. */
  L0: number;
  L1: number;
  R1: number;
  R0: number;
  /** Interior columns. */
  ix0: number;
  ix1: number;
  /** Slab rows: the first and second floors, and the top ceiling under the gable. */
  F1: number;
  F2: number;
  RB: number;
  /** Shaft's left column and width; the stairwell starts right of it, at `sw`. */
  sx: number;
  S: number;
  sw: number;
}

export function manorPlan(at: TileRect): Manor {
  const gm = glassMargin();
  return manorWithin(at.x + gm, at.x + at.w - 1 - gm, at.y + at.h, gm);
}

/**
 * The manor between its outer walls' columns, standing on row G: what the art reads back from the back
 * wall's box, which spans exactly those columns, without having to know the level's gravity.
 */
export function manorWithin(L0: number, R0: number, G: number, gm = 0): Manor {
  const ix0 = L0 + 2;
  const ix1 = R0 - 2;
  const S = shaftW();
  // The shaft against the front wall, the stairwell beside it, and the rooms beyond: nothing on a route crosses the shaft.
  const sx = ix0;
  const F1 = G - HALL - 1;
  const F2 = F1 - UPPER - 1;
  return { G, x0: L0 - gm, x1: R0 + gm, gm, L0, L1: L0 + 1, R1: R0 - 1, R0, ix0, ix1, F1, F2, RB: F2 - UPPER - 1, sx, S, sw: sx + S };
}

/**
 * Open columns either side of the walls the glass stands out into: two, unless a classic level's middle
 * can't spare them beside the moat (low gravity's moat is wide). Gravity alone decides it, so the plan
 * reads it back from the box.
 */
function glassMargin(): number {
  return moatMax() + 1 + 2 * 2 + 4 + STAIRWELL + shaftW() + BACK <= 30 ? 2 : 1;
}

/** Columns the stairwell takes beside the shaft. */
const STAIRWELL = 4;
/** Columns past the stairwell at the least: the top floor's walk to its door, the hall's drop chandelier, the rotten boards. */
const BACK = 4;

/** Columns of the manor's interior: the least its rooms take on a classic level, more on a wide one. */
function manorInterior(wide: boolean, rng: Rng): number {
  const least = STAIRWELL + shaftW() + BACK;
  return wide ? least + rng.int(4, 7) : least;
}

const ANCHOR = (x: number, y: number): Vec => [x, y];

/**
 * The manor. Its hall runs straight through, front door to back door, past the dumbwaiter's shaft
 * against the front wall and under a stairwell of loose boards beside it: up through the first floor,
 * up again to the top one, and along the top floor to a door high in the back wall. So there are two
 * ways past it, the hall and the floors above, and the stairs reach every floor the cab stops at.
 */
function buildManor(g: Grid, rng: Rng, box: TileRect, parts: number): Landmark {
  digMoat(g, rng, box, parts);
  const at = structureOf(box);
  const p = manorPlan(at);
  const { G, x0, x1, L0, L1, R1, R0, ix0, ix1, F1, F2, RB, sx, S, sw } = p;
  g.clear(x0, at.y, x1, G - 1);
  // Walls two thick (the outer column takes the window frames), three floors of slabs, the ceiling.
  g.fill(L0, RB, L1, G - 1, 1, true);
  g.fill(R1, RB, R0, G - 1, 1, true);
  for (const row of [F1, F2, RB]) g.fill(L0, row, R0, row, 1, true);
  // A stepped gable with a chimney stub on one slope.
  for (let r = 1; r <= ROOF; r++) {
    const a = L0 + 2 * r - 1;
    const b = R0 - 2 * r + 1;
    if (a <= b) g.fill(a, RB - r, b, RB - r, 1, true);
  }
  const chim = rng.chance(0.5) ? L0 + 2 * ROOF - 3 : R0 - 2 * ROOF + 2;
  g.fill(chim, RB - ROOF, chim + 1, RB - ROOF, 1, true);

  // Front and back doors on the hall, and the way out off the top floor.
  g.clear(L0, G - 3, L1, G - 1);
  g.clear(R1, G - 3, R0, G - 1);
  g.clear(R1, F2 - UPPER, R0, F2 - 1);

  // The shaft: holes through both floors, and a pit in the hall floor the cab parks flush in.
  g.clear(sx, F2, sx + S - 1, F2);
  g.clear(sx, F1, sx + S - 1, F1);
  g.clear(sx, G, sx + S - 1, G);

  // The stairwell: loose boards up from the hall (you walk under them), a hole to the first floor,
  // a board up to the hole into the top floor.
  for (let j = 0; j < 2; j++) g.set(sw + j, G - 2 - j, T_ONEWAY, true);
  g.clear(sw + 1, F1, sw + 2, F1);
  g.set(sw + 3, F1 - 2, T_ONEWAY, true);
  g.clear(sw + 2, F2, sw + 3, F2);
  // The rotten boards: a gap in the first floor beside the cab's stop, floored by a crumbling piece and off every route.
  const rot = ix1 - 1;
  g.clear(rot, F1, rot + 1, F1);

  // Window frames cut into the outer walls, between the doors.
  const glass = (outer: number, lo: number, hi: number): Vec => {
    const h = Math.min(hi - lo + 1, rng.chance(0.75) ? 4 : 3);
    const y = rng.int(lo, hi - h + 1);
    for (let yy = y; yy < y + h; yy++) g.set(outer, yy, T_EMPTY, true);
    return [y, h];
  };
  const [ly, lh] = glass(L0, RB + 1, G - 5);
  const [ry, rh] = glass(R0, F2 + 1, G - 5);

  return {
    concept: 'haunted-wing',
    rect: at,
    // The rooms and the air in front of the glass stay empty: lanes, filler and decor keep out.
    air: [
      { x: ix0, y: RB + 1, w: ix1 - ix0 + 1, h: G - RB - 1 },
      { x: x0, y: at.y, w: p.gm, h: G - at.y },
      { x: R0 + 1, y: at.y, w: p.gm, h: G - at.y },
      // The doorways.
      { x: L0, y: G - 3, w: 2, h: 3 },
      { x: R1, y: G - 3, w: 2, h: 3 },
      { x: R1, y: F2 - UPPER, w: 2, h: UPPER },
    ],
    anchors: {
      glassL: ANCHOR(x0, ly),
      glassLh: ANCHOR(lh, 0),
      glassR: ANCHOR(R0, ry),
      glassW: ANCHOR(p.gm + 1, 0),
      glassRh: ANCHOR(rh, 0),
      shaft: ANCHOR(sx, G),
      stops: ANCHOR(G - F1, G - F2),
      chandelier: ANCHOR(ix1 - 3, F1 + 1),
      rot: ANCHOR(rot, F1),
      web: ANCHOR(ix1, F1 - UPPER),
      facade: ANCHOR(L0, at.y),
      facadeEnd: ANCHOR(R0, G),
    },
    skin: 'timber',
  };
}

const STEEL = (rng: Rng): PropStyle => makeStyle(rng, ['brass', 'gold'], [36], { glowHue: rng.range(32, 46), woodHue: rng.range(14, 24) });

function* manorPieces(rng: Rng, s: Site, l: Landmark): Generator<Piece> {
  const a = l.anchors;
  const [sx, G] = a.shaft;
  const S = shaftW();
  const [mid, top] = a.stops;
  // The dumbwaiter: a cab floor riding the shaft, parked flush with each floor in turn, its cage on behind.
  const dwell = rng.int(70, 100);
  yield {
    name: rng.pick(['Dumbwaiter', 'Service Lift', 'Ghost Elevator', 'Going Up?']),
    archetype: 'platform',
    role: 'build',
    style: makeStyle(rng, ['rust', 'obsidian'], [20], { trim: 'rivets' }),
    modules: [
      {
        type: 'body',
        cells: Array.from({ length: S }, (_, i) => [sx + i, G] as [number, number]),
        material: 'metal',
        conveyor: 0,
        breakFrames: 0,
        respawnFrames: 0,
      },
      { type: 'deco', kind: 'cab', at: [sx, G - 2], w: S, h: 2, seed: rng.int(0, 1 << 20) },
    ],
    motion: { type: 'rail', angle: -Math.PI / 2, range: top, period: rng.int(260, 340), dwell, stops: [mid] },
    // It runs flush through the floors and parks in the hall's pit: its push clearance would refuse both.
    crushOk: true,
  };
  // The broken windows, one on each outer wall.
  for (const [k, dir] of [
    ['glassL', -1],
    ['glassR', 1],
  ] as const) {
    const [x, y] = a[k];
    const h = a[`${k}h`][0];
    yield {
      name: rng.pick(['Broken Window', 'Stained Glass, Mostly Stains', 'Bay Window, Bad Day', 'Seven Years Bad Luck']),
      archetype: 'spikestrip',
      role: 'hazard',
      style: STEEL(rng),
      modules: [{ type: 'shards', at: [x, y], w: a.glassW[0], h, dir, inset: 1, seed: rng.int(0, 1 << 20) }],
      pathSafe: true,
    };
  }
  // The hall's chandelier, hung to drop.
  const [cx, cy] = a.chandelier;
  yield {
    name: rng.pick(['Loose Chandelier', 'The Drop-In Guest', 'Ceiling Fixture (Temporary)']),
    archetype: 'dropper',
    role: 'hazard',
    style: STEEL(rng),
    modules: [
      {
        type: 'dropper',
        cells: [
          [cx, cy],
          [cx + 1, cy],
        ],
        angle: Math.PI / 2,
        reach: HALL - 1,
        warn: rng.int(26, 36),
        rest: rng.int(50, 80),
        look: 'chandelier',
      },
    ],
  };
  // The rotten boards in the first floor.
  const [rx, ry] = a.rot;
  yield {
    name: rng.pick(['Rotten Boards', 'Termite Buffet', 'Creaky Floor']),
    archetype: 'crumble',
    role: 'hazard',
    style: STEEL(rng),
    modules: [
      {
        type: 'body',
        cells: [
          [rx, ry],
          [rx + 1, ry],
        ],
        material: 'crumble',
        conveyor: 0,
        breakFrames: rng.int(18, 30),
        respawnFrames: rng.int(200, 280),
      },
    ],
    pathSafe: true,
  };
  // Cobwebs in the first floor's far corner, out of every route's way, and the rooms' back wall behind it all.
  const [wx, wy] = a.web;
  const [fx, fy] = a.facade;
  const [fr, fg] = a.facadeEnd;
  const fw = fr - fx + 1;
  const fh = footing(s, fx, fr, fg) - fy;
  yield {
    name: 'Cobwebs',
    archetype: 'web',
    role: 'utility',
    style: STEEL(rng),
    modules: [
      { type: 'deco', kind: 'facade', at: a.facade, w: fw, h: fh, seed: rng.int(0, 1 << 20) },
      {
        type: 'web',
        cells: [
          [wx, wy],
          [wx - 1, wy],
          [wx, wy + 1],
        ],
        drag: 0.35,
      },
    ],
  };
}

export const HAUNTED_WING: Concept = {
  id: 'haunted-wing',
  weight: 3,
  sizes: ['classic', 'wide'],
  ownsCrossing: true,
  family: ['glass', 'chandelier', 'axe', 'chandrop'],
  budget: 2,
  names: ['The Haunted Wing of {place}', 'The East Wing of {place}', 'The Unrentable Wing of {place}', '{place}: Viewing by Appointment'],
  varies: ['moat width', 'interior width (wide)', 'chimney side', 'window glass', 'cab timing'],
  box: (k, rng) => ({ w: moatMax() + 1 + 2 * glassMargin() + 4 + manorInterior(k.W > 56, rng), h: MANOR_H }),
  build: buildManor,
  pieces: (rng, s, l) => manorPieces(rng, s, l),
};

// ------------------------------------------------------------------------------------------------ throne hall

/** Hall air (rows), the ceiling's thickness, tower thickness. */
export const HALL_AIR = 7;
export const CEIL = 2;
export const TOWER = 2;
/** Columns one swinging chandelier needs, with room to push a rider aside. */
const CHANDELIER_W = 7;

/** What the hall's box alone says: the ground, both ends, the hall floor's first column and its top row of air. */
export interface ThroneHall {
  G: number;
  x0: number;
  x1: number;
  /** First hall floor column, past the front tower. */
  fx0: number;
  /** Top row of hall air. */
  top: number;
}

export function throneHallPlan(at: TileRect): ThroneHall {
  const G = at.y + at.h;
  return { G, x0: at.x, x1: at.x + at.w - 1, fx0: at.x + TOWER, top: G - HALL_AIR };
}

/** The dais the seed rolled: its first column, how many steps, and where its top step starts. */
export interface Dais {
  dx0: number;
  steps: number;
  ts: number;
}

/** The dais in front of the back tower, read back off the tiles (the art and the tests read it this way). */
export function throneDais(solid: (x: number, y: number) => boolean, p: ThroneHall): Dais {
  const inner = p.x1 - TOWER;
  let steps = 0;
  while (steps < 4 && solid(inner, p.G - 1 - steps)) steps++;
  const first = (row: number) => {
    let x = inner;
    while (x > p.fx0 && solid(x - 1, row)) x--;
    return x;
  };
  return { dx0: first(p.G - 1), steps, ts: first(p.G - Math.max(1, steps)) };
}

function buildThroneHall(g: Grid, rng: Rng, box: TileRect, parts: number): Landmark {
  digMoat(g, rng, box, parts);
  const at = structureOf(box);
  const p = throneHallPlan(at);
  const { G, x0, x1, fx0, top } = p;
  g.clear(x0, at.y, x1, G - 1);
  // Towers at both ends, each standing a row or so proud of the roof by the seed, with merlons.
  for (const tx of [x0, x1 - TOWER + 1]) {
    const crown = at.y + rng.int(0, Math.max(0, at.h - HALL_AIR - CEIL - 2));
    g.fill(tx, crown + 1, tx + TOWER - 1, G - 1, 1, true);
    g.set(tx === x0 ? tx : tx + TOWER - 1, crown, 1, true);
  }
  // The ceiling, and merlons along the roof.
  g.fill(x0 + TOWER, top - CEIL, x1 - TOWER, top - 1, 1, true);
  for (let x = x0 + TOWER + 1 + rng.int(0, 1); x < x1 - TOWER; x += 2) g.set(x, top - CEIL - 1, 1, true);
  // The dais: one to three steps up to the throne, as deep as the floor spares beside its chandeliers.
  const steps = rng.int(1, 3);
  const sw = rng.int(1, 2);
  const tw = rng.int(2, 3);
  const room = x1 - TOWER - fx0 + 1 - CHANDELIER_W;
  const daisW = Math.max(2, Math.min(room, tw + (steps - 1) * sw));
  const dx0 = x1 - TOWER - daisW + 1;
  for (let k = 0; k < steps; k++) g.fill(Math.min(x1 - TOWER - 1, dx0 + k * sw), G - 1 - k, x1 - TOWER, G - 1 - k, 1, true);
  // The front door at the floor, the boss door behind the throne at its top step.
  g.clear(x0, G - 3, x0 + TOWER - 1, G - 1);
  g.clear(x1 - TOWER + 1, G - steps - 3, x1, G - steps - 1);
  return {
    concept: 'throne-hall',
    rect: at,
    air: [
      { x: fx0, y: top, w: x1 - TOWER - fx0 + 1, h: G - top - steps },
      { x: x0, y: G - 3, w: TOWER, h: 3 },
      { x: x1 - TOWER + 1, y: G - steps - 3, w: TOWER, h: 3 },
    ],
    anchors: { floor: [fx0, dx0 - 1], top: [top, G], dais: [dx0, steps], back: [x0, top - CEIL], backEnd: [x1, G] },
    skin: 'stone',
  };
}

function* throneHallPieces(rng: Rng, s: Site, l: Landmark): Generator<Piece> {
  const [fx0, fx1] = l.anchors.floor;
  const [top] = l.anchors.top;
  const d = throneDais((x, y) => s.solid(x, y), throneHallPlan(l.rect));
  const span = fx1 - fx0 + 1;
  // As many chandeliers as the floor holds, spaced along it, all on one prop so they swing as one.
  const n = Math.max(1, Math.min(3, Math.floor(span / CHANDELIER_W)));
  const c0 = fx0 + Math.floor((span - n * CHANDELIER_W) / 2);
  const swing = rng.range(0.2, 0.3);
  const period = rng.int(200, 260);
  const style = makeStyle(rng, ['gold', 'brass'], [40], { glowHue: rng.range(30, 45) });
  const rotors: Module[] = [];
  for (let i = 0; i < n; i++) {
    const hx = c0 + i * CHANDELIER_W + (CHANDELIER_W >> 1);
    rotors.push({
      type: 'rotor',
      look: 'chandelier',
      support: 'ceiling',
      mastX: hx + 0.5,
      hub: [hx + 0.5, top + 0.5],
      arm: 2.6,
      count: 1,
      angle0: Math.PI / 2,
      period,
      swing,
      dir: 1,
      width: 3,
      thick: 0.5,
      material: 'metal',
      seed: rng.int(0, 1 << 20),
    });
  }
  // The hall's back wall (banners, tall windows, the throne and the door behind it) goes with them.
  const [bx, by] = l.anchors.back;
  const [br, bg] = l.anchors.backEnd;
  const back: Module = { type: 'deco', kind: 'facade', at: [bx, by], w: br - bx + 1, h: footing(s, bx, br, bg) - by, seed: rng.int(0, 1 << 20) };
  yield {
    name: rng.pick(['The Royal Chandeliers', 'Three Tenors', 'Synchronized Swinging']),
    archetype: 'platform',
    role: 'build',
    style,
    modules: [back, ...rotors],
  };
  // The one over the throne drops on whoever climbs to it.
  yield {
    name: rng.pick(['Falling Chandelier', 'The Opera Special', 'Overhead Costs']),
    archetype: 'dropper',
    role: 'hazard',
    style,
    modules: [
      {
        type: 'dropper',
        cells: [
          [d.ts, top],
          [d.ts + 1, top],
        ],
        angle: Math.PI / 2,
        reach: HALL_AIR - 1,
        warn: rng.int(24, 34),
        rest: rng.int(50, 80),
        look: 'chandelier',
      },
    ],
  };
}

/** A classic level's hall: as long as its middle leaves beside the moat, a column or two shorter by the seed. */
const classicHall = (rng: Rng) => Math.max(16, Math.min(18, 30 - moatMax() - 1)) - rng.int(0, 2);

export const THRONE_HALL = defineConcept({
  id: 'throne-hall',
  weight: 2,
  sizes: ['classic', 'wide'],
  ownsCrossing: true,
  family: ['chandelier', 'ram', 'axe', 'cannon', 'chandrop'],
  budget: 1,
  names: ['The Throne Hall of {place}', 'The Boss Room of {place}', 'The Great Hall of {place}'],
  varies: ['moat width', 'hall length', 'tower heights', 'dais steps and depth', 'roof merlons'],
  box: (k, rng) => ({ w: moatMax() + 1 + (k.W > 56 ? rng.int(26, 32) : classicHall(rng)), h: HALL_AIR + CEIL + rng.int(2, 3) }),
  build: buildThroneHall,
  pieces: (rng, s, l) => throneHallPieces(rng, s, l),
});

export const CASTLE_CONCEPTS: Concept[] = [HAUNTED_WING, THRONE_HALL, GATEHOUSE, BELL_TOWER, BOSS_BRIDGE];
