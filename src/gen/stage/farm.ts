import { datan2 } from '../../core/dmath';
import type { Cell, Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import { T_ONEWAY, type TileRect } from '../../sim/level';
import type { Module, PropStyle } from '../../sim/props';
import { type Grid, POCKET } from '../level/kit';
import { jumpProfile } from '../level/probe';
import { easyRise, hardGap, hopGap, pit } from '../level/sculptors/common';
import { BRIDGE_W } from '../level/types';
import { makeStyle, type Piece, SAFE_TILES } from '../setpieces/place';
import { defineConcept } from './contract';
import type { Concept, Landmark } from './types';

/**
 * Farm stage concepts (docs/SETPIECES.md, Farm). Every one owns the level's crossing the way the castle's
 * do: a mill pond in front, its far bank the landmark's doorstep. Past the pond nothing the landmark
 * carries can give a bare run a ride back over it, and the landmark gets every column the pond leaves.
 *
 * - **The Great Windmill**: a mill house of boards with a huge sail wheel turning over its roof, the
 *   tower and cap standing behind. Through the hall, or up the outside stair onto the roof; the lowest
 *   sail passes a hop over the roof and carries you up the sky.
 * - **The Grain Elevator** (grand): concrete silos with the elevator's leg between the first two, a lift
 *   riding the leg to the bin tops. Up a ladder and over the tops, or down into the conveyor tunnel under
 *   the silos, where the grain pours or the dust flares.
 * - **The Big Barn** (grand): a red barn the level runs through. The stalls below, haylofts above either
 *   side of the open mow, reached by an outside stair to the hay door, with a bale swinging across the mow
 *   from the ridge or a hay hook in its place, and a live fence among the stalls.
 * - **The Water Mill**: a tall stone mill with a water wheel on its back wall, turning over the tail race
 *   under a flume that runs out from the roof and pours on its paddles. Through the mill and under the
 *   wheel, or up the ladder over the roof and out along the flume.
 * - **The Combine Run** (grand, wide levels): a combine harvester mowing back and forth along a long
 *   field, its reel spinning at the front. Race it over the stubble, or take the farm track over the field,
 *   live fence and all.
 *
 * Each varies with its seed: storeys, widths and heights, where the doors, stairs and holes are, which
 * hazards it carries, and the movers' speeds and phases. Every one keeps two static ways past itself,
 * recorded as anchors `way0` and `way1` (the top of a column of cells that shuts that way, `wayNh` rows
 * tall), so a test can shut each in turn.
 */

const UP = -Math.PI / 2;
/** arcsin over [0, 1] through datan2: Math.asin differs across browsers. */
const asin = (v: number) => datan2(v, Math.sqrt(Math.max(0, 1 - v * v)));
const DOWN = Math.PI / 2;

/** Columns a landmark keeps from either end (sculptors/common.ts claimSite). */
const SITE_MARGIN = POCKET + SAFE_TILES;

// ------------------------------------------------------------------------------------------------ pond

/** The widest one-part pond at this gravity (hardGap's top end): the box always has room for it. */
export function pondMax(): number {
  const j = jumpProfile();
  return Math.max(j.gap + 2, BRIDGE_W + 2 * j.walkGap);
}

/** Columns in front of the structure: the pond and the bank it lands on. */
const front = () => pondMax() + 1;

/** The structure's own box: everything right of the pond and its far bank. */
export function structureOf(box: TileRect): TileRect {
  const m = front();
  return { x: box.x + m, y: box.y, w: box.w - m, h: box.h };
}

/**
 * The mill pond in front of the structure, sized for `parts` with hardGap and dug to the bottom against
 * the bank (pit hints the bridge and undercuts the bank). Whatever the pond doesn't take is farmyard.
 */
function digPond(g: Grid, rng: Rng, box: TileRect, parts: number): void {
  const G = box.y + box.h;
  const s = structureOf(box);
  g.clear(box.x, 0, s.x + s.w - 1, G - 1);
  if (parts <= 0) return;
  const x1 = s.x - 2;
  pit(g, x1 - Math.min(pondMax(), hardGap(rng, parts)) + 1, x1, G, true);
}

/** Columns the structure gets on a level `W` wide: what a classic level's middle leaves past the pond, more on a wide one. */
function structureCols(W: number, want: readonly [number, number], rng: Rng): number {
  const classic = 30 - front();
  if (W <= 48) return Math.min(want[1], classic);
  return Math.max(classic, Math.min(rng.int(want[0], want[1]), W - 2 * SITE_MARGIN - front() - 12));
}

// ------------------------------------------------------------------------------------------------ kit

const set = (g: Grid, x: number, y: number, v = 1) => g.set(x, y, v, true);
const fill = (g: Grid, x0: number, y0: number, x1: number, y1: number, v = 1) => g.fill(x0, y0, x1, y1, v, true);
const board = (g: Grid, x0: number, x1: number, y: number) => fill(g, x0, y, x1, y, T_ONEWAY);

/**
 * Rows of a stair of boards from a floor (row `lo`) up toward a floor at row `F`, `easyRise` apart: the
 * first a hop off the floor, the last within a hop of standing on `F`. Outside (`under` false) the last may
 * stand level with `F`, beside it; under a floor it leaves a runner's head room, and you jump up through
 * a hole beside it (or through the boards of a loft). Lowest first.
 */
export function stairRows(lo: number, F: number, under = false): number[] {
  const r = easyRise();
  const out: number[] = [];
  for (let b = lo - r; under ? b >= F + 2 : b > F; b -= r) out.push(b);
  return out;
}

/**
 * Rows from a floor (row `lo`) up to the next floor of a storey: the boards' rise and two, so the last
 * board stands a hop under the hole in the floor above.
 */
const storey = (n: number) => easyRise() * n + 2;

/** A ladder of one-way rungs in column `x`, from a hop off the ground (row `G`) to within a hop of standing on row `F`. */
function ladder(g: Grid, x: number, G: number, F: number): void {
  for (const y of stairRows(G, F)) set(g, x, y, T_ONEWAY);
}

/** Record way `i`: the top of a column of `h` rows at `x` that shuts it. */
function way(a: Record<string, Vec>, i: number, x: number, y: number, h: number): void {
  a[`way${i}`] = [x, y];
  a[`way${i}h`] = [h, 0];
}

/** Rows a cut has to stand to keep a jump from clearing it. */
const cutRows = () => jumpProfile().rise + 2;

const wood = (rng: Rng): PropStyle => makeStyle(rng, ['rust', 'steel'], [4, 12, 30, 200], { woodHue: rng.range(20, 32) });
const iron = (rng: Rng): PropStyle => makeStyle(rng, ['steel', 'rust'], [4, 120, 205, 30], { trim: 'rivets', woodHue: rng.range(20, 30) });

/**
 * The mill's sack hoist: its hook block on a chain from the beam under the floor above (`hub`), swinging
 * across the hall at head height, `swing` rad either side.
 */
function sackHoist(rng: Rng, hub: Vec, arm: number, swing: number): Piece {
  return {
    name: rng.pick(['Sack Hoist', 'The Hoist Block', 'Mind Your Head', 'Lifting Gear']),
    archetype: 'flail',
    role: 'hazard',
    style: iron(rng),
    modules: [{ type: 'swinger', head: 'mace', hub, arm, angle0: DOWN, period: rng.int(220, 280), swing, dir: 1, radius: 0.6, count: 1, link: 'chain' }],
  };
}

/** A live fence between two posts at knee height over a floor (stand row `y`), switched on and off. */
export function liveFence(rng: Rng, x0: number, x1: number, y: number, extra: Module[] = []): Piece {
  return {
    name: rng.pick(['Electric Fence', 'Live Wire', 'Keep Off The Grass', 'Cattle Persuader']),
    archetype: 'tesla',
    role: 'hazard',
    style: makeStyle(rng, ['steel', 'rust'], [48, 200], { woodHue: rng.range(20, 32) }),
    modules: [...extra, { type: 'tesla', a: [x0 + 0.5, y + 0.55], b: [x1 + 0.5, y + 0.55], on: rng.int(50, 75), off: rng.int(90, 130), warn: 40 }],
  };
}

/** A hay hook on a chain from `hub`, swinging `swing` rad either side. */
export function hayHook(rng: Rng, hub: Vec, arm: number, swing: number, extra: Module[] = []): Piece {
  return {
    name: rng.pick(['Hay Hook', 'The Bale Grabber', 'Hook, Line and Sinker', 'Hay There']),
    archetype: 'flail',
    role: 'hazard',
    style: iron(rng),
    modules: [
      ...extra,
      { type: 'swinger', head: 'mace', hub, arm, angle0: DOWN, period: rng.int(150, 200), swing, dir: 1, radius: 0.7, count: 1, link: 'chain' },
    ],
  };
}

// ------------------------------------------------------------------------------------------------ the great windmill

/**
 * The windmill: a mill house of boards, its hall straight through (doors at both ends), an outside stair
 * of boards up its near wall to the roof, and inside, on some, boards and a hatch up to the roof as well.
 * The sails turn over the roof, the lowest a hop above it; the tower behind them stands on the mill.
 */
function buildWindmill(g: Grid, rng: Rng, box: TileRect, parts: number): Landmark {
  digPond(g, rng, box, parts);
  const s = structureOf(box);
  const G = box.y + box.h;
  const hatch = rng.chance(0.6);
  // A hatch needs a hall of whole stair flights under the roof; without one the roof sits a row lower.
  const R = G - (hatch ? storey(easyRise() > 2 ? 1 : 2) : easyRise() + 3);
  const steps = stairRows(G, R);
  const nb = steps.length;
  // The mill in the middle of the structure where the stair against its near wall leaves room, and the hub
  // over the mill's middle: the tower is drawn round the hub, so a hub left at the structure's middle stood
  // the tower off its own mill whenever the stair pushed the mill along.
  const mw = Math.max(7, Math.min(s.w - 2 * nb - 2, rng.int(7, 11)));
  const mx0 = Math.max(s.x + 2 * nb, Math.round(s.x + s.w / 2 - mw / 2));
  const mx1 = Math.min(s.x + s.w - 2, mx0 + mw - 1);
  const hx = (mx0 + mx1 + 1) / 2;
  fill(g, mx0, R, mx1, R);
  fill(g, mx0, R, mx0, G - 1);
  fill(g, mx1, R, mx1, G - 1);
  g.clear(mx0, G - 3, mx0, G - 1);
  g.clear(mx1, G - 3, mx1, G - 1);
  // The outside stair: boards climbing to the near wall, the last one against it.
  steps.forEach((y, i) => board(g, mx0 - 2 * (nb - i), mx0 - 2 * (nb - i) + 1, y));
  // Inside: boards up to a hatch in the roof, from whichever end.
  const inLeft = rng.chance(0.5);
  if (hatch) {
    const rows = stairRows(G, R, true);
    rows.forEach((y, i) => {
      const bx = inLeft ? mx0 + 1 + 2 * i : mx1 - 2 - 2 * i;
      board(g, bx, bx + 1, y);
    });
    const last = inLeft ? mx0 + 1 + 2 * (rows.length - 1) : mx1 - 2 - 2 * (rows.length - 1);
    const h0 = inLeft ? last + 1 : last - 1;
    g.clear(h0, R, h0 + 1, R);
  }
  // The longest sails the sky and the site leave, less a little now and then: no two mills the same size.
  const arm = Math.max(3.5, Math.min(7.5, (R - 1 - 2.75) / 2, hx - s.x - 2.6, s.x + s.w - hx - 2.6) - rng.range(0, 1.25));
  const hy = R - arm - 1.5;
  const top = Math.max(0, Math.floor(hy - arm - 2.5));
  const a: Record<string, Vec> = {
    hub: [hx, hy],
    arm: [arm, 0],
    mill: [mx0, mx1],
    roof: [R, G],
    // The sack hoist's beam under the roof, over the hall's middle.
    hoist: [(mx0 + mx1 + 1) / 2, R + 1.2],
    layout: [mw, (hatch ? 2 : 0) + (inLeft ? 1 : 0)],
    shell: [mx0, top],
    shellSize: [mx1 - mx0 + 1, G - top],
  };
  // The hall, and the roof from the outside stair (shut by a wall at the roof's near edge).
  way(a, 0, mx0, G - 3, 3);
  way(a, 1, mx0, R - cutRows(), cutRows());
  return {
    concept: 'great-windmill',
    // The sails' sky and the mill under them.
    rect: {
      x: Math.min(mx0 - 2 * nb, Math.floor(hx - arm - 2.6)),
      y: top,
      w: Math.max(mx1 + 1, Math.ceil(hx + arm + 2.6)) - Math.min(mx0 - 2 * nb, Math.floor(hx - arm - 2.6)),
      h: G - top,
    },
    air: [
      { x: Math.floor(hx - arm - 2.6), y: top, w: Math.ceil(2 * arm + 5.2), h: R - top },
      { x: mx0 + 1, y: R + 1, w: mx1 - mx0 - 1, h: G - R - 1 },
    ],
    anchors: a,
    skin: 'planks',
  };
}

function* windmillPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const a = l.anchors;
  const [arm] = a.arm;
  const count = rng.pick([4, 4, 4, 5, 6]);
  // A tip speed of a brisk walk: one turn in five to nine seconds.
  const period = Math.round((2 * Math.PI * arm * 60) / rng.range(3.4, 5));
  const [sw, sh] = a.shellSize;
  yield {
    name: rng.pick(['Great Windmill', 'The Sails', 'Old Whirly', 'Wind Wheel']),
    archetype: 'platform',
    role: 'build',
    style: wood(rng),
    modules: [
      { type: 'deco', kind: 'windmill', at: a.shell, w: sw, h: sh, seed: rng.int(0, 1 << 20) },
      {
        type: 'rotor',
        look: 'windmill',
        support: 'none',
        mastX: a.hub[0],
        hub: a.hub,
        arm,
        count,
        angle0: rng.range(0, Math.PI * 2),
        period,
        swing: 0,
        dir: rng.sign(),
        width: 3,
        thick: 0.5,
        material: 'wood',
        seed: rng.int(0, 1 << 20),
      },
    ],
  };
  const [, G] = a.roof;
  if (rng.chance(0.75)) yield sackHoist(rng, a.hoist, G - 0.9 - a.hoist[1], rng.range(0.45, 0.7));
}

export const GREAT_WINDMILL = defineConcept({
  varies: ['mill width', 'hall height', 'a hatch and inner stair or none, from either end', 'sail length, count, speed and turn', 'a sack hoist or none'],
  id: 'great-windmill',
  weight: 3,
  sizes: ['classic', 'wide'],
  ownsCrossing: true,
  family: ['electric fence', 'tractor', 'hay hoist', 'hay hook', 'pumpkin catapult'],
  budget: 1,
  names: ['The Great Windmill of {place}', '{place} Mill', 'The Sails of {place}', 'The Windmill at {place}'],
  box: (k, rng) => ({ w: front() + structureCols(k.W, [20, 26], rng), h: 15 }),
  build: buildWindmill,
  pieces: (rng, _s, l) => windmillPieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ the grain elevator

/**
 * The elevator: two or three silos in a row, the leg (the lift's shaft, two wide) between the first two,
 * a ladder of rungs up the first silo's near face, and the bin tops to walk along. Under them, where the
 * ground is deep enough and the site wide enough, the conveyor tunnel: a hole down before the ladder and
 * a step up out past the last silo. Where it isn't, the silos straddle a drive-through bay instead.
 */
function buildElevator(g: Grid, rng: Rng, box: TileRect, parts: number): Landmark {
  digPond(g, rng, box, parts);
  const s = structureOf(box);
  const G = box.y + box.h;
  const sEnd = s.x + s.w - 1;
  // Two columns of yard first: the bank's undercut reaches under the first of them.
  // The tunnel: three rows where the ground is deep enough, two at a squeeze.
  const th = Math.min(3, g.h - 2 - G);
  let tunnel = th >= 2 && s.w >= 17;
  const e = s.x + 2;
  const lc = e + (tunnel ? 2 : 0);
  const end = sEnd - (tunnel ? 4 : 1);
  const wa = s.w >= 18 ? rng.pick([3, 4]) : 3;
  const A0 = lc + 1;
  const shaft = A0 + wa;
  const B0 = shaft + 2;
  let wb = rng.pick([3, 4, 5]);
  while (B0 + wb - 1 > end && wb > 3) wb--;
  if (B0 + wb - 1 > end) tunnel = false;
  const spans: [number, number][] = [
    [A0, A0 + wa - 1],
    [B0, B0 + wb - 1],
  ];
  const C0 = B0 + wb + 2;
  if (C0 + 2 <= end && rng.chance(0.75)) spans.push([C0, Math.min(end, C0 + rng.pick([3, 4, 5]) - 1)]);
  const hT = Math.max(9, Math.min(G - 4, rng.int(11, 15)));
  const T = G - hT;
  const drops = [0, rng.int(0, 2), rng.int(1, 3)];
  const silos = spans.map(([x0, x1], i) => {
    // The first meets the leg's head; the next stands as tall or a little lower, a third lower still.
    const top = T + drops[i];
    fill(g, x0, top, x1, G - 1);
    fill(g, x0 + 1, top - 1, x1 - 1, top - 1);
    if (x1 - x0 >= 4) set(g, x0 + 2, top - 2);
    return [x0, x1, top] as const;
  });
  const last = silos[silos.length - 1];
  ladder(g, lc, G, T);
  // The leg: the cab parks flush with the ground in a slot in it, and its cable runs up to the head pulley's beam.
  g.clear(shaft, G, shaft + 1, G);
  fill(g, shaft, T - 4, shaft + 1, T - 4);
  const a: Record<string, Vec> = {
    shaft: [shaft, G],
    top: [T, G],
    ladder: [lc, G],
    layout: [silos.length * 10 + drops[1], wa * 10 + wb],
    head: [shaft - 1, T - 6],
    headSize: [4, G - T + 6 + (tunnel ? th + 1 : 1)],
  };
  if (tunnel) {
    // Down a hole, along under the silos, up a step past the last one.
    const q = last[1] + 1;
    g.clear(e, G, e + 1, G);
    g.clear(e, G + 1, q + 3, G + th);
    g.clear(q, G, q + 3, G);
    fill(g, q + 2, G + 2, q + 3, G + th);
    fill(g, e - 1, G + th + 1, q + 3, G + th + 1);
    a.tunnel = [e, q + 3];
    a.spout = [silos[1][0] + 1, G + 1];
    a.deep = [th, 0];
    way(a, 0, q - 1, G + 1, th);
  } else {
    // The drive-through bay: every silo's foot open three rows high.
    g.clear(A0, G - 3, last[1], G - 1);
    a.bay = [A0, last[1]];
    a.spout = [silos[1][0] + 1, G - 3];
    way(a, 0, last[1], G - 3, 3);
  }
  way(a, 1, last[1], last[2] - cutRows(), cutRows());
  return {
    concept: 'grain-elevator',
    // Grand: the bins own the sky, and the pond at their feet is theirs.
    rect: { x: box.x, y: Math.max(0, T - 6), w: last[1] + 1 - box.x, h: G - Math.max(0, T - 6) },
    air: [
      { x: shaft, y: T - 4, w: 2, h: G - T + 4 },
      { x: lc, y: Math.max(0, T - 6), w: last[1] - lc + 1, h: 4 },
      tunnel ? { x: e, y: G + 1, w: last[1] + 4 - e + 1, h: th } : { x: A0, y: G - 3, w: last[1] - A0 + 1, h: 3 },
    ],
    anchors: a,
    skin: 'concrete',
  };
}

function* elevatorPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const a = l.anchors;
  const [sx, G] = a.shaft;
  const [T] = a.top;
  const range = G - T;
  // A stop halfway now and then: the lift taking its time.
  const stops = range >= 10 && rng.chance(0.4) ? [Math.floor(range / 2)] : undefined;
  yield {
    name: rng.pick(['Bucket Elevator', 'The Leg', 'Grain Lift', 'Going Up (Corn)']),
    archetype: 'platform',
    role: 'build',
    style: makeStyle(rng, ['rust', 'steel'], [4, 30, 200], { trim: 'rivets' }),
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
    motion: { type: 'rail', angle: UP, range, period: rng.int(220, 320), dwell: rng.int(60, 100), ...(stops ? { stops } : {}) },
    crushOk: true,
  };
  // Under the second silo: the grain pours, or the dust flares. The headhouse over the leg stands behind it all.
  const [hw, hh] = a.headSize;
  const head: Module = { type: 'deco', kind: 'headhouse', at: a.head, w: hw, h: hh, seed: rng.int(0, 1 << 20) };
  const [px, py] = a.spout;
  const deep = a.deep?.[0] ?? 3;
  if (rng.chance(0.55))
    yield {
      name: rng.pick(['Grain Chute', 'Corn Shower', 'Bin Spout']),
      archetype: 'fan',
      role: 'utility',
      style: wood(rng),
      modules: [
        head,
        {
          type: 'geyser',
          look: 'snow',
          at: [px + 0.5, py],
          angle: DOWN,
          width: 2,
          length: 3,
          off: rng.int(80, 130),
          warn: 30,
          on: rng.int(60, 90),
          lethal: false,
          strength: 2400,
        },
      ],
    };
  else
    yield {
      name: rng.pick(['Dust Flare', 'Grain Dust', 'No Smoking']),
      archetype: 'flamer',
      role: 'hazard',
      style: iron(rng),
      modules: [head, { type: 'flame', at: [px + 0.5, py], angle: DOWN, length: deep - 0.4, on: rng.int(40, 60), off: rng.int(100, 140), warn: 40 }],
    };
}

export const GRAIN_ELEVATOR = defineConcept({
  scale: 'grand',
  varies: [
    'two or three silos',
    'silo widths and heights',
    'a conveyor tunnel or a drive-through bay',
    'a lift stop halfway',
    'lift speed and dwell',
    'a grain chute or a dust flare',
  ],
  id: 'grain-elevator',
  weight: 2,
  sizes: ['classic', 'wide'],
  ownsCrossing: true,
  family: ['electric fence', 'muck spreader', 'tractor', 'hay hook'],
  budget: 1,
  names: ['The {place} Grain Elevator', '{place} Co-op Elevator', 'The Silos of {place}', 'The Bins at {place}'],
  box: (k, rng) => ({ w: front() + structureCols(k.W, [20, 26], rng), h: 15 }),
  build: buildElevator,
  pieces: (rng, _s, l) => elevatorPieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ the big barn

/**
 * The barn: walls with a ground door at each end and a hay door above each, a hayloft either side of the
 * open mow (a hop across), boards inside from the stalls up through the near loft, and outside, a stair of
 * boards up to the near hay door. Over it all a hollow gambrel roof, the ridge the swing hangs from.
 */
function buildBarn(g: Grid, rng: Rng, box: TileRect, parts: number): Landmark {
  digPond(g, rng, box, parts);
  const s = structureOf(box);
  const G = box.y + box.h;
  const F1 = G - easyRise() - 4;
  const loft = 4 + (rng.chance(0.4) ? 1 : 0);
  const Wt = F1 - loft - 1;
  const steps = stairRows(G, F1);
  const nb = steps.length;
  const bx0 = s.x + 2 * nb;
  const bx1 = s.x + s.w - 2;
  // Walls, doors and hay doors, and the hay hood over the far one.
  fill(g, bx0, Wt, bx0, G - 1);
  fill(g, bx1, Wt, bx1, G - 1);
  g.clear(bx0, G - 3, bx0, G - 1);
  g.clear(bx1, G - 3, bx1, G - 1);
  g.clear(bx0, F1 - 3, bx0, F1 - 1);
  g.clear(bx1, F1 - 3, bx1, F1 - 1);
  set(g, bx1 + 1, F1 - 4);
  // The roof: eaves, then a hollow gambrel, steep below and shallow above, up to the ridge.
  set(g, bx0 - 1, Wt);
  set(g, bx1 + 1, Wt);
  let a0 = bx0;
  let a1 = bx1;
  let y = Wt - 1;
  const steep = rng.int(1, 2);
  for (let i = 0; y >= 2; i++, y--) {
    const step = i < steep ? 1 : 2;
    // Stop while the row under the ridge still has an inside, where the swing hangs.
    if (a1 - a0 < 2 * step + 4) break;
    fill(g, a0, y, a0 + step, y);
    fill(g, a1 - step, y, a1, y);
    a0 += step;
    a1 -= step;
  }
  fill(g, a0, y, a1, y);
  const ridge = y;
  const cupola = rng.chance(0.6) && ridge >= 2;
  if (cupola) fill(g, Math.floor((a0 + a1) / 2), ridge - 1, Math.floor((a0 + a1) / 2) + 1, ridge - 1);
  // Lofts either side of the mow, a hop apart.
  const inner = bx1 - bx0 - 1;
  const M = Math.max(2, Math.min(jumpProfile().walkGap, hopGap(rng, 2)));
  const m0 = bx0 + 1 + Math.floor((inner - M) / 2);
  const m1 = m0 + M - 1;
  board(g, bx0 + 1, m0 - 1, F1);
  board(g, m1 + 1, bx1 - 1, F1);
  // Outside: a stair of boards to the near hay door. Inside: boards from the stalls up through the near loft.
  steps.forEach((yy, i) => board(g, bx0 - 2 * (nb - i), bx0 - 2 * (nb - i) + 1, yy));
  const inSide = rng.chance(0.5);
  stairRows(G, F1, true).forEach((yy, i) => {
    const bx = inSide ? bx0 + 1 + 2 * i : m0 - 2 - 2 * i;
    if (bx > bx0 && bx + 1 < m0) board(g, bx, bx + 1, yy);
  });
  // Stall rails to hop past the mow, now and then; the live fence goes across the near stalls or the far ones.
  const rails = rng.chance(0.5);
  const farFence = !rails && bx1 - 1 - (m1 + 2) >= 3 && rng.chance(0.5);
  if (rails) for (let i = 0, x = m1 + 3; i < 2 && x < bx1 - 1; i++, x += 3) set(g, x, G - 1);
  const hub: Vec = [Math.floor((a0 + a1 + 1) / 2) + 0.5, ridge + 1.5];
  const a: Record<string, Vec> = {
    walls: [bx0, bx1],
    floors: [F1, G],
    mow: [m0, m1],
    ridge: [ridge, Wt],
    hub,
    layout: [bx1 - bx0 + 1, loft * 10 + (rails ? 1 : 0) + (inSide ? 2 : 0) + (cupola ? 4 : 0)],
    fence: farFence ? [m1 + 2, Math.min(bx1 - 1, m1 + 5)] : [bx0 + 1, Math.min(m0 - 1, bx0 + 4)],
    shell: [bx0 - 1, ridge],
    shellSize: [bx1 - bx0 + 3, G - ridge],
  };
  way(a, 0, bx0, G - 3, 3);
  way(a, 1, bx0, F1 - 3, 3);
  return {
    concept: 'big-barn',
    // Grand: the barn, its yard and the pond in front of it.
    rect: { x: box.x, y: ridge - 1, w: bx1 + 2 - box.x, h: G - ridge + 1 },
    air: [
      { x: bx0 + 1, y: ridge + 1, w: bx1 - bx0 - 1, h: G - ridge - 1 },
      { x: bx1 + 1, y: F1 - 3, w: 1, h: G - F1 + 3 },
    ],
    anchors: a,
    skin: 'barnboard',
  };
}

function* barnPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const a = l.anchors;
  const [bx0, bx1] = a.walls;
  const [F1, G] = a.floors;
  const hub = a.hub;
  const [sw, sh] = a.shellSize;
  // The barn's back wall and rafters ride with what hangs from them.
  const back: Module = { type: 'deco', kind: 'barn', at: a.shell, w: sw, h: sh, seed: rng.int(0, 1 << 20) };
  // Across the mow: a bale on a rope from the ridge you can ride, or a hay hook that swings for you.
  const arm = F1 - 1.4 - hub[1];
  const half = Math.min(hub[0] - bx0 - 1, bx1 - hub[0]) - 2.7;
  if (rng.chance(0.65)) {
    const swing = Math.max(0.2, Math.min(0.75, asin(Math.max(0, Math.min(1, half / arm)))));
    yield {
      name: rng.pick(['Hay Bale Swing', 'The Mow Swing', 'Rope Swing', 'Bale Out']),
      archetype: 'platform',
      role: 'build',
      style: wood(rng),
      modules: [
        back,
        {
          type: 'rotor',
          look: 'hay',
          support: 'ceiling',
          mastX: hub[0],
          hub,
          arm,
          count: 1,
          angle0: DOWN,
          period: rng.int(180, 240),
          swing,
          dir: 1,
          width: 2,
          thick: 0.75,
          material: 'wood',
          seed: rng.int(0, 1 << 20),
        },
      ],
    };
  } else {
    const hookArm = arm - 0.3;
    const swing = Math.max(0.3, Math.min(0.9, asin(Math.max(0, Math.min(1, (half + 1.5) / hookArm)))));
    yield hayHook(rng, hub, hookArm, swing, [back]);
  }
  // Among the stalls: a live fence.
  const [f0, f1] = a.fence;
  yield liveFence(rng, f0, f1, G - 1);
}

export const BIG_BARN = defineConcept({
  scale: 'grand',
  varies: [
    'barn width',
    'loft height',
    'roof pitch and cupola',
    'mow width',
    'inner stair side',
    'a bale swing or a hay hook',
    'stall rails, and which stalls the live fence crosses',
  ],
  id: 'big-barn',
  weight: 3,
  sizes: ['classic', 'wide'],
  ownsCrossing: true,
  family: ['hay hook', 'hay hoist', 'tractor', 'muck spreader'],
  budget: 2,
  names: ['The Big Barn at {place}', '{place} Barn Raising', 'The Hayloft of {place}', 'The Red Barn of {place}'],
  box: (k, rng) => ({ w: front() + structureCols(k.W, [22, 30], rng), h: 15 }),
  build: buildBarn,
  pieces: (rng, _s, l) => barnPieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ the water mill

/**
 * The water mill: a tall stone mill, storey on storey, boards and a hole up through each floor on
 * alternating sides, doors through the ground floor, a ladder up its near wall to the roof. On the back
 * wall the wheel turns over the tail race (a hop) under a flume that runs out from the roof and pours on it.
 */
function buildMill(g: Grid, rng: Rng, box: TileRect, parts: number): Landmark {
  digPond(g, rng, box, parts);
  const s = structureOf(box);
  const G = box.y + box.h;
  const r = easyRise();
  const mw = s.w >= 18 ? rng.int(5, 6) : 5;
  const mx0 = s.x + 1;
  const mx1 = mx0 + mw - 1;
  // Three or four storeys where the sky leaves room (two at the least), the hall the tallest.
  const floors: number[] = [G - storey(r > 2 ? 1 : 2)];
  const want = rng.int(3, 4);
  while (floors.length < want && floors[floors.length - 1] - storey(1) >= 3) floors.push(floors[floors.length - 1] - storey(1));
  const R = floors[floors.length - 1];
  fill(g, mx0, R, mx0, G - 1);
  fill(g, mx1, R, mx1, G - 1);
  for (const f of floors) fill(g, mx0, f, mx1, f);
  g.clear(mx0, G - 3, mx0, G - 1);
  g.clear(mx1, G - 3, mx1, G - 1);
  // Up through the floors: boards, then a hole beside the last, on alternating sides.
  const first = rng.chance(0.5);
  let left = first;
  let below = G;
  for (const f of floors) {
    const bx = left ? mx0 + 1 : mx1 - 2;
    for (const b of stairRows(below, f, true)) board(g, bx, bx + 1, b);
    const h0 = left ? bx + 1 : bx - 1;
    g.clear(h0, f, h0 + 1, f);
    below = f;
    left = !left;
  }
  ladder(g, mx0 - 1, G, R);
  // The wheel beside the back wall: its lowest paddle a jump off the ground, its top under the flume.
  const wheelRoom = s.x + s.w - 1 - mx1;
  const arm = Math.max(2.5, Math.min(6.5, (G - R - 5.8) / 2, (wheelRoom - 3.4) / 2));
  const hx = mx1 + 1 + arm + 1.7;
  const hy = G - 2.4 - arm;
  // The tail race under it: a hop.
  const rx = Math.round(hx - 1);
  pit(g, rx, rx + 1, G, false);
  // The flume: boards from the roof out over the wheel.
  const fx = Math.round(hx + rng.range(0.6, 1.4));
  board(g, mx1 + 1, fx, R);
  const a: Record<string, Vec> = {
    mill: [mx0, mx1],
    floors: [floors.length, R],
    ground: [G, 0],
    hub: [hx, hy],
    arm: [arm, 0],
    race: [rx, rx + 1],
    // The pour needs the row under the flume's end clear of the wheel's top.
    flume: [fx, R],
    pour: [hy - arm - 1.2 >= R + 2 ? 1 : 0, 0],
    layout: [floors.length, mw * 2 + (first ? 1 : 0)],
    shell: [mx0, R],
    shellSize: [mw, G - R],
  };
  way(a, 0, mx0, G - 3, 3);
  way(a, 1, mx0, R - cutRows(), cutRows());
  return {
    concept: 'water-mill',
    rect: { x: mx0 - 1, y: R, w: Math.ceil(hx + arm + 1.8) - mx0 + 1, h: G - R },
    air: [
      { x: mx1 + 1, y: R + 1, w: Math.ceil(hx + arm + 2.4) - mx1, h: G - R - 1 },
      { x: mx0 + 1, y: R + 1, w: mw - 2, h: G - R - 1 },
    ],
    anchors: a,
    skin: 'stone',
  };
}

function* millPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const a = l.anchors;
  const [arm] = a.arm;
  const hub = a.hub;
  const paddles = arm >= 4 ? rng.pick([6, 8]) : 6;
  const period = Math.round((2 * Math.PI * arm * 60) / rng.range(1.8, 2.8));
  const [fw, fh] = a.shellSize;
  const [G] = a.ground;
  yield {
    name: rng.pick(['Water Wheel', 'Mill Wheel', 'The Overshot', 'Paddle Wheel']),
    archetype: 'platform',
    role: 'build',
    style: wood(rng),
    modules: [
      { type: 'deco', kind: 'flume', at: a.shell, w: fw, h: fh, seed: rng.int(0, 1 << 20) },
      {
        type: 'rotor',
        look: 'flywheel',
        support: 'none',
        mastX: hub[0],
        hub,
        arm,
        count: paddles,
        angle0: rng.range(0, Math.PI * 2),
        period,
        swing: 0,
        // Mostly the near side climbs, lifting you toward the mill.
        dir: rng.chance(0.75) ? -1 : 1,
        width: 2,
        thick: 0.5,
        material: 'wood',
        seed: rng.int(0, 1 << 20),
      },
    ],
  };
  // The pour off the flume's end onto the paddles.
  const [fx, R] = a.flume;
  if (a.pour[0] && rng.chance(0.7))
    yield {
      name: rng.pick(['Flume Pour', 'Mill Race', 'The Overflow']),
      archetype: 'fan',
      role: 'utility',
      style: wood(rng),
      modules: [
        {
          type: 'geyser',
          look: 'water',
          at: [fx + 0.5, R + 1],
          angle: DOWN,
          width: 1,
          length: G - R - 1,
          off: rng.int(90, 140),
          warn: 30,
          on: rng.int(50, 80),
          lethal: false,
          strength: 2200,
        },
      ],
    };
  // Between the back door and the race, now and then, a live fence.
  const [, mx1] = a.mill;
  const [rx] = a.race;
  if (rx - 1 - (mx1 + 1) >= 2 && rng.chance(0.6)) yield liveFence(rng, mx1 + 1, rx - 1, G - 1);
}

export const WATER_MILL = defineConcept({
  varies: ['two to four storeys', 'mill width', 'stair sides', 'wheel size, paddles and turn', 'flume length', 'a pour or none', 'a live fence or none'],
  id: 'water-mill',
  weight: 2,
  sizes: ['classic', 'wide'],
  ownsCrossing: true,
  family: ['tractor', 'hay hook', 'pumpkin catapult', 'electric fence'],
  budget: 1,
  names: ['The Water Mill of {place}', '{place} Mill Pond', 'The Mill Race at {place}', 'The Old Mill, {place}'],
  box: (k, rng) => ({ w: front() + structureCols(k.W, [20, 26], rng), h: 15 }),
  build: buildMill,
  pieces: (rng, _s, l) => millPieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ the combine run

/** Rows over the field the farm track runs at: over the combine's tank, a rider on it and a jump. */
const TRACK = 8;

/**
 * The field: a long flat run for the combine, with a farm track of boards over it on trestles, reached by
 * a stair of boards at the near end. Past the track's end you drop.
 */
function buildCombine(g: Grid, rng: Rng, box: TileRect, parts: number): Landmark {
  digPond(g, rng, box, parts);
  const s = structureOf(box);
  const G = box.y + box.h;
  const Wk = G - TRACK + rng.int(0, 1);
  const steps = stairRows(G, Wk);
  const nb = steps.length;
  steps.forEach((y, i) => board(g, s.x + 1 + 2 * i, s.x + 2 + 2 * i, y));
  const f0 = s.x + 1 + 2 * nb;
  const f1 = s.x + s.w - 2;
  const t1 = f1 - rng.int(0, 3);
  board(g, f0, t1, Wk);
  const a: Record<string, Vec> = {
    field: [f0, f1],
    ground: [G, 0],
    track: [Wk, t1],
    layout: [f1 - f0 + 1, Wk],
    shell: [f0, Wk],
    shellSize: [t1 - f0 + 1, G - Wk],
  };
  // The field, shut at its far end under the track; the track, shut halfway along.
  way(a, 0, f1 - 1, Wk + 1, G - Wk - 1);
  way(a, 1, Math.floor((f0 + t1) / 2), Wk - cutRows(), cutRows());
  return {
    concept: 'combine-run',
    rect: { x: s.x + 1, y: Wk, w: f1 - s.x, h: G - Wk },
    air: [{ x: f0, y: Wk + 1, w: f1 - f0 + 1, h: G - Wk - 1 }],
    anchors: a,
  };
}

function* combinePieces(rng: Rng, l: Landmark): Generator<Piece> {
  const a = l.anchors;
  const [f0, f1] = a.field;
  const [G] = a.ground;
  const [Wk, t1] = a.track;
  const cw = rng.int(5, 6);
  // Facing the way you come: its header and reel at the near end.
  const x0 = f0 + 4;
  const travel = f1 - 2 - cw - x0 + 1;
  const cells: Cell[] = [];
  for (let x = x0; x < x0 + cw; x++) for (const y of [G - 1, G - 2]) cells.push([x, y]);
  // The cab at the front and the grain tank behind it.
  cells.push([x0 + 1, G - 3], [x0 + cw - 2, G - 3], [x0 + cw - 1, G - 3]);
  const speed = rng.range(3.2, 4.6);
  const reel: Module = {
    type: 'swinger',
    head: 'saw',
    hub: [x0 - 1.1, G - 1.7],
    arm: 1,
    angle0: rng.range(0, Math.PI),
    period: rng.int(42, 60),
    swing: 0,
    dir: -1,
    radius: 0.42,
    count: rng.pick([4, 5]),
    link: 'rod',
  };
  yield {
    name: rng.pick(['Combine Harvester', 'The Reaper', 'Big Red', 'Harvest Moon']),
    archetype: 'crusher',
    role: 'hazard',
    style: makeStyle(rng, ['steel', 'rust'], [2, 48, 118, 205], { trim: 'stripes', woodHue: rng.range(30, 40) }),
    modules: [{ type: 'body', cells, material: 'metal', conveyor: 0, breakFrames: 0, respawnFrames: 0 }, reel],
    motion: { type: 'rail', angle: 0, range: travel, period: Math.round(((2 * travel) / speed) * 60), dwell: rng.int(40, 90) },
  };
  // A live fence along the track, with its trestles behind.
  const [sw, sh] = a.shellSize;
  const fx = rng.int(f0 + 2, Math.max(f0 + 2, t1 - 6));
  yield liveFence(rng, fx, fx + rng.int(3, 4), Wk - 1, [{ type: 'deco', kind: 'trestle', at: a.shell, w: sw, h: sh, seed: rng.int(0, 1 << 20) }]);
}

export const COMBINE_RUN = defineConcept({
  varies: ['field length', 'track height and end', 'combine size and speed', 'reel blades and spin', 'where the live fence runs'],
  id: 'combine-run',
  weight: 3,
  sizes: ['wide'],
  routes: ['ltr'],
  ownsCrossing: true,
  family: ['tractor', 'electric fence', 'muck spreader', 'pumpkin catapult'],
  budget: 1,
  names: ['The Harvest at {place}', '{place} Combine Run', 'Reaping Day at {place}', 'The Back Forty of {place}'],
  box: (k, rng) => ({ w: front() + structureCols(k.W, [26, 40], rng), h: 10 }),
  build: buildCombine,
  pieces: (rng, _s, l) => combinePieces(rng, l),
});

export const FARM_CONCEPTS: Concept[] = [GREAT_WINDMILL, GRAIN_ELEVATOR, BIG_BARN, WATER_MILL, COMBINE_RUN];
