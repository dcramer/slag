import type { Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import type { TileRect } from '../../sim/level';
import type { Module, PropStyle } from '../../sim/props';
import { type Grid, T_EMPTY, T_ONEWAY } from '../level/kit';
import { jumpProfile } from '../level/probe';
import { hardGap, pit } from '../level/sculptors/common';
import { BRIDGE_W } from '../level/types';
import { type Piece, makeStyle } from '../setpieces/place';
import type { Concept, Landmark } from './types';

/**
 * Castle stage concepts (docs/SETPIECES.md, Castle).
 *
 * The Haunted Wing is the owner's own example: a three-storey manor of plank and plaster that owns the
 * middle of the level. A switchback of stairs climbs inside it from the front door to a door out of
 * the top floor, and that static climb is the proof. A dumbwaiter cab rides a shaft up the middle,
 * parking at every floor: the quick way up, never needed. Both outer walls carry a huge broken window,
 * the glass standing out of its frame, so the walls you'd climb outside cut you. A chandelier hangs over
 * the hall waiting to drop, cobwebs fill the corners and the top floor is rotten through.
 *
 * The Throne Hall is a long stone hall between two towers: chandeliers swinging in step from the
 * ceiling, one hung to drop on whoever walks under it, and a dais at the far end with the throne and
 * the way out behind it.
 *
 * Both own the level's crossing: a moat in front, its far bank their doorstep, so the landmark is
 * where the level asks for its part. A classic level has no room for a moat beside a landmark this
 * size, and owning it keeps the structure from making the sculptor's moat bare-passable off its roof.
 */

// ------------------------------------------------------------------------------------------------ moat

/** The widest one-part moat at this gravity (hardGap's top end): the box always has room for it. */
export function moatMax(): number {
  const j = jumpProfile();
  return Math.max(j.gap + 2, BRIDGE_W + 2 * j.walkGap);
}

/** The structure's own box: everything right of the moat and the bank it lands on. */
export function structureOf(at: TileRect): TileRect {
  const m = moatMax() + 1;
  return { x: at.x + m, y: at.y, w: at.w - m, h: at.h };
}

/**
 * The moat in front of the structure, sized for `parts` with hardGap and dug to the bottom against the
 * bank (pit hints the bridge and undercuts the bank). Whatever the moat doesn't take is courtyard.
 */
function digMoat(g: Grid, rng: Rng, at: TileRect, parts: number): void {
  const G = at.y + at.h;
  const s = structureOf(at);
  g.clear(at.x, at.y, s.x - 1, G - 1);
  if (parts <= 0) return;
  const x1 = s.x - 2;
  pit(g, x1 - Math.min(moatMax(), hardGap(rng, parts)) + 1, x1, G, true);
}

// ------------------------------------------------------------------------------------------------ manor

/** Hall air (rows) on the ground floor; the floors above get UPPER rows each. */
const HALL = 5;
const UPPER = 3;
const ROOF = 3;
/** Box height: hall, two upper floors, three slabs, the gable. */
const MANOR_H = HALL + 2 * UPPER + 3 + ROOF;

/** The dumbwaiter's shaft: a hop across under a low ceiling while the cab is away, at any gravity. */
const shaftW = () => 2;

/** Where the manor's parts are, worked out from its box alone (build and the tests both read it). */
export interface Manor {
  /** Ground row (first solid row under the box). */
  G: number;
  x0: number;
  x1: number;
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
  /** Shaft's left column and width. */
  sx: number;
  S: number;
}

export function manorPlan(at: TileRect): Manor {
  const G = at.y + at.h;
  const x0 = at.x;
  const x1 = at.x + at.w - 1;
  const ix0 = x0 + 3;
  const ix1 = x1 - 3;
  const S = shaftW();
  // The stairwell takes four columns on the left and the rotten boards four on the right; the shaft splits what's left.
  const spare = ix1 - ix0 + 1 - STAIRWELL - S - BACK;
  const sx = ix0 + STAIRWELL + Math.floor(spare * 0.5);
  const F1 = G - HALL - 1;
  const F2 = F1 - UPPER - 1;
  return { G, x0, x1, L0: x0 + 1, L1: x0 + 2, R1: x1 - 2, R0: x1 - 1, ix0, ix1, F1, F2, RB: F2 - UPPER - 1, sx, S };
}

/** Columns the stairwell takes at the hall's front end. */
const STAIRWELL = 4;
/** Columns between the shaft and the back wall: a landing, then the rotten boards. */
const BACK = 4;

/** Columns of the manor's interior: the least its rooms take on a classic level, more on a wide one. */
function manorInterior(wide: boolean, rng: Rng): number {
  const least = STAIRWELL + shaftW() + BACK;
  return wide ? least + rng.int(4, 7) : least;
}

const ANCHOR = (x: number, y: number): Vec => [x, y];

/**
 * The manor. Its hall runs straight through, front door to back door, under a stairwell of loose
 * boards that climbs at the front: up through the first floor, up again to the top one, and along the
 * top floor (over the shaft and the rotten boards) to a door high in the back wall. So there are two
 * ways past it, the hall and the floors above, and the stairs reach every floor the cab stops at.
 */
function buildManor(g: Grid, rng: Rng, box: TileRect, parts: number): Landmark {
  digMoat(g, rng, box, parts);
  const at = structureOf(box);
  const p = manorPlan(at);
  const { G, x0, x1, L0, L1, R1, R0, ix0, ix1, F1, F2, RB, sx, S } = p;
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
  for (let j = 0; j < 2; j++) g.set(ix0 + j, G - 2 - j, T_ONEWAY, true);
  g.clear(ix0 + 1, F1, ix0 + 2, F1);
  g.set(ix0, F1 - 2, T_ONEWAY, true);
  g.clear(ix0, F2, ix0 + 1, F2);
  // The rotten boards: a gap in the top floor between the shaft and the door, floored by a crumbling piece.
  const rot = ix1 - 1;
  g.clear(rot, F2, rot + 1, F2);

  // Window frames cut into the outer walls, between the doors.
  const glass = (outer: number, lo: number, hi: number): Vec => {
    const h = Math.min(hi - lo + 1, rng.int(3, 4));
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
      { x: x0, y: at.y, w: 1, h: G - at.y },
      { x: x1, y: at.y, w: 1, h: G - at.y },
      // The doorways.
      { x: L0, y: G - 3, w: 2, h: 3 },
      { x: R1, y: G - 3, w: 2, h: 3 },
      { x: R1, y: F2 - UPPER, w: 2, h: UPPER },
    ],
    anchors: {
      glassL: ANCHOR(x0, ly),
      glassLh: ANCHOR(lh, 0),
      glassR: ANCHOR(R0, ry),
      glassRh: ANCHOR(rh, 0),
      shaft: ANCHOR(sx, G),
      stops: ANCHOR(G - F1, G - F2),
      chandelier: ANCHOR(sx + S, F1 + 1),
      rot: ANCHOR(rot, F2),
      web: ANCHOR(ix1, F1 - UPPER),
    },
    skin: 'planks',
  };
}

const STEEL = (rng: Rng): PropStyle => makeStyle(rng, ['brass', 'gold'], [36], { glowHue: rng.range(32, 46), woodHue: rng.range(14, 24) });

function* manorPieces(rng: Rng, l: Landmark): Generator<Piece> {
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
    style: STEEL(rng),
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
      modules: [{ type: 'shards', at: [x, y], w: 2, h, dir, inset: 1, seed: rng.int(0, 1 << 20) }],
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
  // The rotten boards in the top floor.
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
  // Cobwebs in the first floor's far corner, out of every route's way.
  const [wx, wy] = a.web;
  yield {
    name: 'Cobwebs',
    archetype: 'web',
    role: 'utility',
    style: STEEL(rng),
    modules: [
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
  box: (k, rng) => ({ w: moatMax() + 1 + 6 + manorInterior(k.W > 56, rng), h: MANOR_H }),
  build: buildManor,
  pieces: (rng, _s, l) => manorPieces(rng, l),
};

// ------------------------------------------------------------------------------------------------ throne hall

/** Hall air (rows), the ceiling's thickness, tower thickness and how far the towers stand above the roof. */
const HALL_AIR = 7;
const CEIL = 2;
const TOWER = 2;
const THRONE_H = HALL_AIR + CEIL + 3;
/** Columns one swinging chandelier needs, with room to push a rider aside. */
const CHANDELIER_W = 7;

export interface ThroneHall {
  G: number;
  x0: number;
  x1: number;
  /** Hall floor columns, door to dais. */
  fx0: number;
  fx1: number;
  /** Dais columns (the throne stands on the top step). */
  dx0: number;
  /** Top row of hall air. */
  top: number;
}

export function throneHallPlan(at: TileRect): ThroneHall {
  const G = at.y + at.h;
  const x0 = at.x;
  const x1 = at.x + at.w - 1;
  const dx0 = x1 - TOWER - 3;
  return { G, x0, x1, fx0: x0 + TOWER, fx1: dx0 - 1, dx0, top: G - HALL_AIR };
}

function buildThroneHall(g: Grid, rng: Rng, box: TileRect, parts: number): Landmark {
  digMoat(g, rng, box, parts);
  const at = structureOf(box);
  const p = throneHallPlan(at);
  const { G, x0, x1, dx0, top } = p;
  g.clear(x0, at.y, x1, G - 1);
  // Towers at both ends, above the roof, with merlons.
  g.fill(x0, at.y + 1, x0 + TOWER - 1, G - 1, 1, true);
  g.fill(x1 - TOWER + 1, at.y + 1, x1, G - 1, 1, true);
  for (const tx of [x0, x1]) g.set(tx, at.y, 1, true);
  // The ceiling, and merlons along the roof.
  g.fill(x0 + TOWER, top - CEIL, x1 - TOWER, top - 1, 1, true);
  for (let x = x0 + TOWER + 1; x < x1 - TOWER; x += 2) g.set(x, top - CEIL - 1, 1, true);
  // The dais: two steps up to the throne, and the boss door behind it.
  g.fill(dx0, G - 1, x1 - TOWER, G - 1, 1, true);
  g.fill(dx0 + 2, G - 2, x1 - TOWER, G - 2, 1, true);
  g.clear(x0, G - 3, x0 + TOWER - 1, G - 1);
  g.clear(x1 - TOWER + 1, G - 5, x1, G - 3);
  return {
    concept: 'throne-hall',
    rect: at,
    air: [
      { x: p.fx0, y: top, w: x1 - TOWER - p.fx0 + 1, h: G - top },
      { x: x0, y: G - 3, w: TOWER, h: 3 },
      { x: x1 - TOWER + 1, y: G - 5, w: TOWER, h: 3 },
    ],
    anchors: { floor: [p.fx0, p.fx1], top: [top, G], dais: [dx0, G - 2] },
    skin: 'stone',
  };
}

function* throneHallPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const [fx0, fx1] = l.anchors.floor;
  const [top] = l.anchors.top;
  const [dx0] = l.anchors.dais;
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
  yield { name: rng.pick(['The Royal Chandeliers', 'Three Tenors', 'Synchronized Swinging']), archetype: 'platform', role: 'build', style, modules: rotors };
  // The one over the dais drops on whoever climbs to the throne.
  yield {
    name: rng.pick(['Falling Chandelier', 'The Opera Special', 'Overhead Costs']),
    archetype: 'dropper',
    role: 'hazard',
    style,
    modules: [
      {
        type: 'dropper',
        cells: [
          [dx0 + 1, top],
          [dx0 + 2, top],
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

/** A classic level's hall: as long as its middle leaves beside the moat. */
const classicHall = () => Math.max(16, Math.min(18, 30 - moatMax() - 1));

export const THRONE_HALL: Concept = {
  id: 'throne-hall',
  weight: 2,
  sizes: ['classic', 'wide'],
  ownsCrossing: true,
  family: ['chandelier', 'ram', 'axe', 'cannon', 'chandrop'],
  budget: 1,
  names: ['The Throne Hall of {place}', 'The Boss Room of {place}', 'The Great Hall of {place}'],
  box: (k, rng) => ({ w: moatMax() + 1 + (k.W > 56 ? rng.int(26, 32) : classicHall()), h: THRONE_H }),
  build: buildThroneHall,
  pieces: (rng, _s, l) => throneHallPieces(rng, l),
};

export const CASTLE_CONCEPTS: Concept[] = [HAUNTED_WING, THRONE_HALL];
