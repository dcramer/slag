import type { Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import type { TileRect } from '../../sim/level';
import type { Module } from '../../sim/props';
import type { Grid } from '../level/kit';
import { ladleAt, LADLE_NAMES, robotArm, ARM_NAMES, ARM_SWEEP } from '../setpieces/factory';
import { makeStyle, type Piece, type Site } from '../setpieces/place';
import { defineConcept } from './contract';
import { APRON, BANK, listOf, record, roomFor, rungs, shell, structCols, vatBefore, ways, widestGap } from './factory-kit';
import type { Landmark } from './types';

/**
 * Three more factory places (docs/SETPIECES.md, Factory), each laid out afresh from its seed, each owning
 * the level's crossing (a vat on its spawn side, `vatBefore`) and keeping two ways past itself. Anchors the
 * tests read: `way{i}` / `way{i}s` is a rect that, filled, shuts one way through.
 *
 * - **The Foundry** (grand): a cupola furnace tower at the far end of a casting floor, a crane runway girder
 *   over the floor from a ladder to the cupola's charging door, slag ladles hanging from it, each tipping
 *   on its own beat and spilling along the floor. Under the ladles and through the tapping passage in the
 *   cupola's foot, or up the ladder, along the runway and through the charging door.
 * - **The Boiler House**: a brick boiler house with its smokestack standing on the roof. Through the boiler
 *   room, over the boilers while their fireboxes blow flame back at the door and a safety valve vents
 *   steam, or up the fire escape and across the roof under the stack.
 * - **The Robot Line**: an assembly line on a raised deck, robot arms on pedestals along it striking and
 *   welding over the deck. Along the deck between the arms, or under it, down the service trench on some.
 */

/** Rows a passage through a structure is tall: a runner's height and a jump's start. */
const DOOR = 3;

const RUST = (rng: Rng) => makeStyle(rng, ['rust', 'steel'], [20, 30]);

// ---------------------------------------------------------------------------------------------- the foundry

/** Columns the smallest foundry needs past its bank: ladder, a casting floor two ladles wide, a cupola. */
const FOUNDRY_MIN = 15 + APRON;

/** How big the foundry's ladles are drawn: crane ladles, a good deal bigger than a filler's. */
const LADLE_SIZE = 1.4;

/** Rows the box asks for: the cupola's stack, never more than the level has over its ground. */
const foundryRows = (H: number) => Math.min(H - 9, 18);

function buildFoundry(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const G = at.y + at.h;
  const s0 = at.x + widestGap() + BANK;
  const E = at.x + at.w - 1;
  const R = E - APRON;
  vatBefore(g, rng, s0, G, parts);
  g.clear(at.x, 0, E, G - 1);
  // The cupola at the far end: a furnace tower with its stack, the tapping passage through its foot and the
  // charging door at the runway's height.
  const cw = rng.int(4, 5);
  const c0 = R - cw + 1;
  const T = G - Math.min(at.h - 1, rng.int(15, 17));
  const B = G - 10 - rng.int(0, 1);
  g.fill(c0, T, R, G - 1);
  g.clear(c0, G - DOOR, R, G - 1);
  g.clear(c0, B - DOOR, R, B - 1);
  // The runway girder over the casting floor, from the ladder to the charging door.
  const f0 = s0 + 2;
  const f1 = c0 - 1;
  g.fill(f0, B, f1, B);
  rungs(g, s0, B, G);
  // On some, the floor under the ladles is a casting pit a row deep.
  const sunk = rng.int(0, 1);
  if (sunk) g.clear(f0 + 1, G, f1 - 1, G);
  // The ladles: two or more along the runway, evenly spaced over the floor they spill on, each spill
  // running out to its neighbours' halfway marks and never off that floor.
  const F = f1 - f0 + 1;
  const n = Math.max(2, Math.min(4, Math.floor(F / 5)));
  const fl = sunk ? f0 + 1 : f0;
  const fr = sunk ? f1 : f1 + 1;
  const lo = f0 + 2;
  const hi = f1 - 2;
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = lo + Math.round(((hi - lo) * i) / Math.max(1, n - 1));
    xs.push(Math.max(lo, Math.min(hi, n > 2 && i > 0 && i < n - 1 ? a + rng.int(-1, 0) : a)));
  }
  const clamp = (v: number) => Math.max(1, Math.min(2.5, v));
  const lips: Vec[] = xs.map((x) => [x + 0.5, (sunk ? G + 1 : G) - rng.int(4, 5)]);
  const spills: Vec[] = xs.map((x, i) => [clamp(i === 0 ? x + 0.25 - fl : (x - xs[i - 1]) / 2), clamp(i === n - 1 ? fr - x - 0.75 : (xs[i + 1] - x) / 2)]);
  // The cupola's stack goes on up over the tower, behind (a shell), toward the top of the view.
  const stackTop = Math.max(1, T - rng.int(4, 7));
  const mid = Math.floor((f0 + f1) / 2);
  return {
    concept: 'foundry',
    rect: { x: at.x, y: T, w: at.w, h: G - T },
    air: [
      { x: f0, y: B + 1, w: F, h: G - B - 1 },
      { x: s0, y: B - 4, w: c0 - s0, h: 4 },
      { x: c0, y: stackTop, w: cw, h: T - stackTop },
    ],
    anchors: {
      hall: [f0, B],
      cupola: [c0, R],
      stack: [stackTop, T],
      floor: [G, sunk],
      ...record('lip', lips),
      ...record('spill', spills),
      ...ways([
        { x: c0, y: B - DOOR, w: 1, h: DOOR },
        { x: mid, y: B + 1, w: 1, h: G - B - 1 + sunk },
      ]),
    },
    skin: 'rustplate',
  };
}

function* foundryPieces(rng: Rng, _s: Site, l: Landmark): Generator<Piece> {
  const [f0, B] = l.anchors.hall;
  const [G, sunk] = l.anchors.floor;
  const lips = listOf(l.anchors, 'lip');
  const spills = listOf(l.anchors, 'spill');
  const [c0, R] = l.anchors.cupola;
  const [stackTop, T] = l.anchors.stack;
  for (let i = 0; i < lips.length; i++) {
    const [x, lip] = lips[i];
    // Tip toward the wider side of its floor.
    const dir: 1 | -1 = spills[i][1] > spills[i][0] ? 1 : spills[i][1] < spills[i][0] ? -1 : rng.chance(0.5) ? 1 : -1;
    const drop = G + sunk - lip;
    const mods: Module[] = [{ ...ladleAt(rng, { at: [x, lip], drop, spill: spills[i], hang: lip - (B + 1) }, dir, 3), size: LADLE_SIZE }];
    // The hall behind it all rides in the first ladle's piece: the casting bay's back wall, the runway's
    // columns down to the floor and the cupola's lining, standing on the ground under its open foot.
    if (i === 0)
      mods.unshift(
        shell(rng, 'facade', [f0, B + 1], c0 - f0, G - B - 1 + sunk),
        // The cupola's own shell, behind its tower from its top to the floor: the lining through both its openings.
        shell(rng, 'facade', [c0, T], R - c0 + 1, G - T),
        shell(rng, 'smokestack', [c0 + (R - c0 > 3 ? 1 : 0.5), stackTop], R - c0 > 3 ? R - c0 - 1 : R - c0, T - stackTop),
      );
    yield { name: rng.pick(LADLE_NAMES), archetype: 'flamer', role: 'hazard', style: RUST(rng), modules: mods };
  }
}

export const FOUNDRY = defineConcept({
  id: 'foundry',
  weight: 3,
  sizes: ['classic', 'wide'],
  routes: ['ltr'],
  fits: (p) => roomFor(p, FOUNDRY_MIN + BANK) && (p.h ?? 27) - 9 >= 16,
  ownsCrossing: true,
  family: ['slag ladle', 'press', 'forklift'],
  names: ['The Foundry at {place}', '{place} Iron Works', 'The Slag Works of {place}', '{place} Casting Shop'],
  codex: {
    about:
      'A cupola furnace with crane ladles tipping slag across the casting floor. Under the pours and out through the tapping passage, or along the runway to the charging door.',
  },
  scale: 'grand',
  varies: ['vat width', 'foundry length (wide)', 'cupola width and height', 'runway height', 'a casting pit', 'ladles: how many, where, how high'],
  box: (k, rng) => ({ w: widestGap() + BANK + structCols(k, rng, FOUNDRY_MIN, [20, 30]), h: foundryRows(k.H) }),
  build: buildFoundry,
  pieces: foundryPieces,
});

// ------------------------------------------------------------------------------------------ the boiler house

/** Columns the smallest boiler house needs past its bank: the fire escape and a building two boilers long. */
const BOILER_MIN = 15 + APRON;

function buildBoiler(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const G = at.y + at.h;
  const s0 = at.x + widestGap() + BANK;
  const E = at.x + at.w - 1;
  const R = E - APRON;
  vatBefore(g, rng, s0, G, parts);
  g.clear(at.x, 0, E, G - 1);
  // The building: brick walls, a hall tall enough to hop the boilers in, a roof one or two courses thick.
  const b0 = s0 + 2;
  const b1 = R;
  const hH = rng.int(6, 7);
  const rt = rng.int(1, 2);
  const roofBot = G - 1 - hH;
  const roofTop = roofBot - rt + 1;
  g.fill(b0, roofTop, b1, roofBot);
  g.fill(b0, roofBot + 1, b0, G - 1);
  g.fill(b1, roofBot + 1, b1, G - 1);
  g.clear(b0, G - DOOR, b0, G - 1);
  g.clear(b1, G - DOOR, b1, G - 1);
  // The fire escape up the near wall to the roof.
  rungs(g, s0, roofTop - 1, G);
  // The boilers: two or three along the hall, room in front of each for its firebox to blow.
  const i0 = b0 + 1;
  const i1 = b1 - 1;
  const Wi = i1 - i0 + 1;
  let n = Wi >= 20 ? 3 : 2;
  let widths: number[] = [];
  for (; n >= 1; n--) {
    widths = Array.from({ length: n }, () => rng.int(3, 4));
    while (widths.reduce((t, w) => t + w, 0) + 2 * n + 1 > Wi && widths.some((w) => w > 3)) widths[widths.indexOf(Math.max(...widths))]--;
    if (widths.reduce((t, w) => t + w, 0) + 2 * n + 1 <= Wi) break;
  }
  const spare = Wi - widths.reduce((t, w) => t + w, 0) - 2 * n - 1;
  const extra = Array.from({ length: n + 1 }, () => 0);
  for (let k = 0; k < spare; k++) extra[rng.int(0, n)]++;
  const boilers: Vec[] = [];
  const tall: number[] = [];
  let x = i0;
  for (let i = 0; i < n; i++) {
    x += 2 + extra[i];
    const bh = hH >= 7 ? rng.int(2, 3) : 2;
    g.fill(x, G - bh, x + widths[i] - 1, G - 1);
    boilers.push([x, widths[i]]);
    tall.push(bh);
    x += widths[i];
  }
  // The smokestack stands on the roof toward the far end, drawn behind (it's the building's, not a wall).
  const sw = rng.int(2, 3);
  const sx = b1 - sw - rng.int(1, 3);
  const stackTop = Math.max(at.y, roofTop - rng.int(7, 10));
  const mid = Math.floor((b0 + b1) / 2);
  return {
    concept: 'boiler-house',
    rect: { x: s0, y: stackTop, w: E - s0 + 1, h: G - stackTop },
    air: [
      { x: i0, y: roofBot + 1, w: Wi, h: hH },
      { x: s0, y: roofTop - 3, w: E - s0 + 1, h: 3 },
    ],
    anchors: {
      hall: [b0, roofBot],
      walls: [b0, b1],
      roof: [roofTop, G],
      stack: [sx, stackTop],
      stackW: [sw, rt],
      ...record('boiler', boilers),
      ...record(
        'tall',
        tall.map((h, i) => [h, i] as Vec),
      ),
      ...ways([
        { x: mid, y: 0, w: 1, h: roofTop },
        { x: mid, y: roofBot + 1, w: 1, h: hH },
      ]),
    },
    skin: 'brick',
  };
}

function* boilerPieces(rng: Rng, _s: Site, l: Landmark): Generator<Piece> {
  const [b0, roofBot] = l.anchors.hall;
  const [roofTop, G] = l.anchors.roof;
  const [sx, stackTop] = l.anchors.stack;
  const [sw] = l.anchors.stackW;
  const [, b1] = l.anchors.walls;
  const boilers = listOf(l.anchors, 'boiler');
  const tall = listOf(l.anchors, 'tall').map(([h]) => h);
  // One boiler's safety valve vents steam to the roof, shoving whoever's over it up into the rafters.
  const valve = rng.int(0, boilers.length - 1);
  for (let i = 0; i < boilers.length; i++) {
    const [x, w] = boilers[i];
    const mods: Module[] = [
      // The firebox door on its front, blowing flame back along the floor toward the door you came in by.
      {
        type: 'flame',
        at: [x - 0.05, G - 0.5],
        angle: Math.PI,
        length: rng.range(1.6, 2.2),
        on: rng.int(40, 56),
        off: rng.int(120, 170),
        warn: rng.int(28, 36),
      },
    ];
    if (i === valve) {
      const top = G - tall[i];
      mods.push({
        type: 'geyser',
        look: 'steam',
        at: [x + w / 2, top],
        angle: -Math.PI / 2,
        width: 1,
        length: top - (roofBot + 1),
        off: rng.int(140, 200),
        warn: rng.int(30, 40),
        on: rng.int(40, 60),
        lethal: false,
        strength: rng.range(0.7, 1),
      });
    }
    if (i === 0)
      mods.unshift(
        // The boiler room's back wall, down to its floor through both doors, and the stack on the roof.
        shell(rng, 'facade', [b0, roofBot + 1], b1 - b0 + 1, G - roofBot - 1),
        shell(rng, 'smokestack', [sx, stackTop], sw, roofTop - stackTop),
      );
    yield {
      name: rng.pick(['Boiler No. ' + (i + 1), 'Firebox', 'Back Draft', 'Stoker']),
      archetype: 'flamer',
      role: 'hazard',
      style: makeStyle(rng, ['rust', 'copper', 'brass'], [16, 28]),
      modules: mods,
    };
  }
}

export const BOILER_HOUSE = defineConcept({
  id: 'boiler-house',
  weight: 2,
  sizes: ['classic', 'wide'],
  routes: ['ltr'],
  fits: (p) => roomFor(p, BOILER_MIN + BANK),
  ownsCrossing: true,
  family: ['forklift', 'cog lift', 'slag ladle'],
  names: ['The Boiler House at {place}', '{place} Steam Plant', 'The Old Boilers of {place}', '{place} Power House'],
  codex: {
    about:
      'A brick boiler room whose fireboxes blow back at the door, and one safety valve with opinions. Through the boilers, or up the fire escape and over the roof.',
  },
  varies: [
    'vat width',
    'house length (wide)',
    'hall height',
    'roof thickness',
    'boilers: how many, how wide, how tall, where',
    'which valve vents',
    'the stack',
  ],
  box: (k, rng) => ({ w: widestGap() + BANK + structCols(k, rng, BOILER_MIN, [20, 30]), h: Math.min(k.H - 9, 17) }),
  build: buildBoiler,
  pieces: boilerPieces,
});

// -------------------------------------------------------------------------------------------- the robot line

/** Columns the smallest line needs past its bank: the ladder and a deck two arms long. */
const LINE_MIN = 15 + APRON;
/** Rows over the deck a raised arm takes. */
const ARM_HEAD = 7;

/**
 * Pedestal columns and the side each arm strikes toward, along a deck from d0 to d1: the end ones strike
 * inward, the rest either way, spaced at least a sweep apart so no head swings over another's pedestal.
 */
function armLayout(rng: Rng, d0: number, d1: number): Vec[] {
  const len = d1 - d0 + 1;
  const n = Math.max(1, Math.min(4, Math.floor((len - 1) / ARM_SWEEP) + 1, Math.floor((len + 2) / (ARM_SWEEP + 1))));
  if (n === 1) return [[d0, 1]];
  const out: Vec[] = [];
  for (let i = 0; i < n; i++) {
    const x = d0 + Math.round(((len - 1) * i) / (n - 1));
    out.push([x, i === 0 ? 1 : i === n - 1 ? -1 : rng.chance(0.5) ? 1 : -1]);
  }
  return out;
}

function buildRobotLine(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const G = at.y + at.h;
  const s0 = at.x + widestGap() + BANK;
  const E = at.x + at.w - 1;
  const R = E - APRON;
  vatBefore(g, rng, s0, G, parts);
  g.clear(at.x, 0, E, G - 1);
  // The line's deck, a ladder up to it, the floor under it a service trench a row deep on some.
  const D = G - 4 - rng.int(0, 1);
  const d0 = s0 + 2;
  const d1 = R;
  g.fill(d0, D, d1, D);
  rungs(g, s0, D - 1, G);
  const trench = rng.int(0, 1);
  if (trench) g.clear(d0 + 1, G, d1 - 1, G);
  const arms = armLayout(rng, d0 + 1, d1);
  const mid = Math.floor((d0 + d1) / 2);
  const under = G - D - 1 + trench;
  return {
    concept: 'robot-line',
    rect: { x: s0, y: D - ARM_HEAD, w: E - s0 + 1, h: G - D + ARM_HEAD },
    air: [
      { x: d0, y: D - ARM_HEAD, w: d1 - d0 + 1, h: ARM_HEAD },
      { x: d0, y: D + 1, w: d1 - d0 + 1, h: under },
    ],
    anchors: {
      deck: [d0, D],
      deckEnd: [d1, D],
      under: [under, G],
      ...record('arm', arms),
      ...ways([
        { x: mid, y: 0, w: 1, h: D },
        { x: mid, y: D + 1, w: 1, h: under },
      ]),
    },
    skin: 'metal',
  };
}

function* robotPieces(rng: Rng, _s: Site, l: Landmark): Generator<Piece> {
  const [d0, D] = l.anchors.deck;
  const [under] = l.anchors.under;
  const [d1] = l.anchors.deckEnd;
  const arms = listOf(l.anchors, 'arm');
  // A car body on its jig between each pair of robots, where they weld: a step up onto the line's way. The
  // cars go in first: an arm's sweep claims the deck it swings over.
  const xs = arms.map(([x]) => x).sort((a, b) => a - b);
  for (let i = 0; i + 1 < xs.length; i++) {
    const gap = xs[i + 1] - xs[i] - 1;
    if (gap < 5) continue;
    const cx = xs[i] + 1 + Math.floor((gap - 3) / 2) + rng.int(0, gap % 2);
    yield {
      name: rng.pick(['Car Body', 'Body in White', "Next Year's Model", 'Unit 0']),
      archetype: 'platform',
      role: 'build',
      style: makeStyle(rng, ['steel'], [205]),
      modules: [{ type: 'body', cells: carCells(cx, D - 1, rng.chance(0.5) ? 1 : -1), material: 'metal', conveyor: 0, breakFrames: 0, respawnFrames: 0 }],
    };
  }
  const reach = rng.range(2.2, 2.6);
  for (let i = 0; i < arms.length; i++) {
    const [x, dir] = arms[i];
    const mods = robotArm(rng, x, D - 1, dir as 1 | -1, reach);
    // The line behind it all rides in the first arm's piece: legs down to the floor, the robot cells' backs,
    // car bodies going by on the overhead hooks.
    if (i === 0) mods.unshift(shell(rng, 'facade', [d0, D - ARM_HEAD + 1], d1 - d0 + 1, ARM_HEAD + under));
    yield { name: rng.pick(ARM_NAMES), archetype: 'saw', role: 'hazard', style: makeStyle(rng, ['steel'], [30]), modules: mods };
  }
}

/** A car body three tiles long standing on the stand row `y` from column x: its lower body, and its cabin two tiles long over the end away from its hood. */
export function carCells(x: number, y: number, hood: 1 | -1): [number, number][] {
  const cab = hood > 0 ? x : x + 1;
  return [
    [x, y],
    [x + 1, y],
    [x + 2, y],
    [cab, y - 1],
    [cab + 1, y - 1],
  ];
}

export const ROBOT_LINE = defineConcept({
  id: 'robot-line',
  weight: 2,
  sizes: ['classic', 'wide'],
  routes: ['ltr'],
  fits: (p) => roomFor(p, LINE_MIN + BANK),
  ownsCrossing: true,
  family: ['robot arm', 'forklift', 'press'],
  names: ['The Robot Line at {place}', '{place} Assembly Plant', 'The Line at {place}', '{place} Motor Works'],
  codex: { about: 'Robot arms welding car bodies along a raised deck. Along the deck between strikes, or under it all, down the service trench.' },
  varies: ['vat width', 'line length (wide)', 'deck height', 'a service trench', 'robots: how many, where, which way', 'car bodies: where, which way'],
  box: (k, rng) => ({ w: widestGap() + BANK + structCols(k, rng, LINE_MIN, [22, 32]), h: 4 + ARM_HEAD + 2 }),
  build: buildRobotLine,
  pieces: robotPieces,
});
