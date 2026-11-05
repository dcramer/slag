import { DOWN, UP, type Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import { T_ONEWAY, type TileRect } from '../../sim/level';
import type { PropStyle } from '../../sim/props';
import { type Grid } from '../level/kit';
import { easyRise, type Knobs, TWO_PART_TRIES } from '../level/sculptors/common';
import { makeStyle, type Piece, type Site } from '../setpieces/place';
import { CITY, neonModules, neonPiece, signModule, signPiece, wireModule, wirePiece } from '../setpieces/rooftops';
import { defineConcept } from './contract';
import type { Concept, Landmark } from './types';
import { bankCrossing, bankKit, boxH, DOOR, ledges, listOf, listSig, oneGap, record, shell, twoGap, ways } from './kit';

/**
 * Rooftops stage concepts (docs/SETPIECES.md, Rooftops): five places on the city's roofs, each one
 * landmark standing on the far side of an alley, the level's crossing, every one laid out afresh from its
 * seed. The alley drops to the street (the pit); the landmark stands on the far building's roof.
 *
 * - **The Girder Works** (grand): a building going up, storeys of steel decks on a skeleton you can see
 *   through, a construction hoist running up its near end. Along the roof under it all (mind the safety
 *   sign hung from the first deck), or up the ladders storey by storey and across the top deck, where a
 *   wrecking ball swings from the tower crane.
 * - **The Neon Billboard**: a giant billboard on legs, its ad lit by spotlights. Under it, where a live
 *   wire hangs between its legs, or up the service ladder and over its top, across neon letters that
 *   light up one after another and are live while they're lit.
 * - **The Water Tower Row**: wooden water tanks on steel legs. Under the tanks, past a live wire strung
 *   between the legs, or up a ladder and hopping tank to tank, where a burst valve sprays across the hop.
 * - **The Clock Tower** (grand): a stone tower with a clock face on it and an arch through its foot.
 *   Through the arch, where the clock's pendulum swings, or up the ledges on its face and over its top,
 *   under the bell.
 * - **The El Station**: an elevated railway's viaduct, a train shuttling along it. Along the track (dodge
 *   the train, or ride its roof) or along the street under it, where the station sign comes down.
 *
 * Every landmark keeps a static way past itself (movers and hazards are timed, never the proof), and
 * owns the level's crossing. Two-part levels get a two-part alley where the level has room for one beside
 * the landmark (`rooftopsOwns`), else the sculptor digs the second alley further on.
 *
 * Anchors the tests and the skin read: `way{i}` / `way{i}s` is a rect that, filled, shuts one way through
 * (each a genuine alternative), and `sig{i}` are the structural numbers the seed rolled.
 */

/** Flat roof between the alley and the structure: the bridge's landing and a run-up. */
const BANK = 3;

const { crossFor, roomFor, crossCols, structCols } = bankKit({ bank: BANK, two: 0.45 });

/** A one-way deck from column a to b on row y. */
function deck(g: Grid, a: number, b: number, y: number): void {
  for (let c = a; c <= b; c++) g.set(c, y, T_ONEWAY, true);
}

/** The landmark's box over its roof: from `top` (clamped to the level) down to the roof row G. */
const rectOver = (at: TileRect, top: number, G: number): TileRect => {
  const y = Math.max(1, top);
  return { x: at.x, y, w: at.w, h: G - y };
};

const STEEL = (rng: Rng): PropStyle => makeStyle(rng, ['rust', 'steel'], [8, 16, 30], { trim: 'rivets', glowHue: rng.range(36, 50) });

// ------------------------------------------------------------------------------------------------ girder works

/** Structure columns the smallest site needs: the hoist, a ladder, decks to cross and the far ladder. */
const GIRDER_MIN = 14;
/** The hoist's shaft width. */
const SHAFT = 2;

function buildGirders(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const G = at.y + at.h;
  const cross = Math.min(at.w - GIRDER_MIN - BANK, crossCols(parts));
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  bankCrossing(g, rng, at.x, cross, G, parts);
  const s0 = at.x + cross + BANK;
  const s1 = at.x + at.w - 1;
  // Storeys: a runner's height and a deck each, as many as the sky leaves room for with the crane over them.
  const P = DOOR + 1 + rng.int(0, 1);
  const n = Math.max(2, Math.min(rng.int(2, 4), Math.floor((at.h - 6) / P)));
  const decks = Array.from({ length: n }, (_, k) => G - (k + 1) * P);
  const top = decks[n - 1];
  // The hoist runs up one end, parked flush in a slot in the roof; the decks run from its shaft to the other.
  const far = rng.chance(0.5);
  const sx = far ? s1 - SHAFT + 1 : s0;
  const d0 = far ? s0 : s0 + SHAFT;
  const d1 = far ? s1 - SHAFT : s1;
  g.clear(sx, G, sx + SHAFT - 1, G);
  // Ladders zigzag from end to end, each a column or two in from its end.
  const ladders: number[] = [];
  for (let k = 0; k < n; k++) ladders.push(k % 2 === 0 ? d0 + rng.int(0, 2) : d1 - 1 - rng.int(0, 2));
  for (let k = 0; k < n; k++) {
    deck(g, d0, d1, decks[k]);
    ledges(g, ladders[k], decks[k], k === 0 ? G : decks[k - 1]);
  }
  // A bay left out of the lower decks here and there: a hop across, or a drop to the storey under it.
  const holes: Vec[] = [];
  for (let k = 0; k < n - 1; k++) {
    if (!rng.chance(0.7)) continue;
    const w = rng.int(2, 3);
    const lo = d0 + 3;
    const hi = d1 - 2 - w;
    if (hi < lo) continue;
    const x = rng.int(lo, hi);
    const busy = [ladders[k], ladders[k + 1]].some((lx) => x <= lx + 2 && x + w - 1 >= lx - 1);
    if (busy) continue;
    g.clear(x, decks[k], x + w - 1, decks[k]);
    holes.push([x, w]);
  }
  // The wrecking ball swings over the top deck, somewhere along its middle, from the crane's jib, never
  // over the hoist's shaft.
  const arm = Math.min(4.6, Math.max(3, top - 2.2));
  const reach = Math.ceil(arm * 0.82 + 1.2);
  const span = d1 - d0 + 1;
  const mid = d0 + Math.floor(span / 2);
  const blo = far ? d0 + 2 : d0 + reach;
  const bhi = far ? d1 - reach : d1 - 2;
  const bx = Math.max(blo, Math.min(bhi, mid + rng.int(-Math.floor(span / 6), Math.floor(span / 6))));
  return {
    concept: 'girder-works',
    rect: rectOver(at, top - Math.ceil(arm) - 3, G),
    air: [{ x: d0, y: Math.max(0, Math.floor(top - arm - 1)), w: span, h: Math.ceil(arm) + 1 }],
    anchors: {
      site: [s0, s1],
      ground: [G, P],
      hoist: [sx, top],
      decks: [d0, d1],
      ball: [bx, arm],
      ...record(
        'deck',
        decks.map((y, k) => [ladders[k], y] as Vec),
      ),
      ...ways([
        { x: mid, y: 0, w: 1, h: decks[0] + 1 },
        { x: mid, y: decks[0] + 1, w: 1, h: G - decks[0] - 1 },
      ]),
      sig0: [n, P],
      sig1: listSig(ladders.map((x) => x - s0)),
      sig2: listSig(holes.map(([x, w]) => (x - s0) * 4 + w)),
      sig3: [bx - s0, far ? 1 : 0],
    },
    skin: 'girder',
  };
}

function* girderPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const [s0, s1] = l.anchors.site;
  const [G, P] = l.anchors.ground;
  const [sx, top] = l.anchors.hoist;
  const [d0, d1] = l.anchors.decks;
  const [bx, arm] = l.anchors.ball;
  const decks = listOf(l, 'deck').map(([, y]) => y);
  // The skeleton and the tower crane behind it all, and the wrecking ball on the crane's hook.
  const craneTop = Math.max(0, Math.floor(top - arm - 2));
  yield {
    name: rng.pick(['Wrecking Ball', 'Demolition Derby', 'The Ball Is Back', 'Swing Shift']),
    archetype: 'flail',
    role: 'hazard',
    style: STEEL(rng),
    modules: [
      shell(rng, [s0, craneTop], s1 - s0 + 1, G - craneTop + 1),
      {
        type: 'swinger',
        head: 'weight',
        hub: [bx + 0.5, top - 0.4 - arm],
        arm,
        angle0: DOWN,
        period: rng.int(210, 250),
        swing: rng.range(0.8, 0.95),
        dir: rng.chance(0.5) ? 1 : -1,
        radius: rng.range(0.95, 1.1),
        count: 1,
        link: 'chain',
      },
    ],
  };
  // The hoist: a cage floor riding the shaft at one end, parked flush with the roof and every deck.
  const range = G - top;
  const stops = decks.slice(0, -1).map((y) => G - y);
  yield {
    name: rng.pick(['Construction Hoist', 'Going Up', 'Hard Hat Elevator', 'The Material Lift']),
    archetype: 'platform',
    role: 'build',
    style: STEEL(rng),
    modules: [
      {
        type: 'body',
        cells: Array.from({ length: SHAFT }, (_, i) => [sx + i, G] as [number, number]),
        material: 'metal',
        conveyor: 0,
        breakFrames: 0,
        respawnFrames: 0,
      },
      { type: 'deco', kind: 'cab', at: [sx, G - 2], w: SHAFT, h: 2, seed: rng.int(0, 1 << 20) },
    ],
    motion: { type: 'rail', angle: UP, range, period: rng.int(150, 220) + 30 * stops.length, dwell: rng.int(60, 90), ...(stops.length ? { stops } : {}) },
    // It runs flush through the decks and parks in the roof's slot: its push clearance would refuse both.
    crushOk: true,
  };
  // The safety sign, hung from the first deck over the roof, waiting to prove its point.
  const lo = d0 + 3;
  const hi = d1 - 4;
  if (hi >= lo && P - 2 >= 2) {
    const x = rng.int(lo, hi);
    yield {
      ...signPiece(rng, signModule(rng, x, decks[0] + 1, 3, 1, G)),
      name: rng.pick(['Safety First', 'Hard Hat Area', 'Zero Accidents', 'Days Without Incident']),
    };
  }
}

export const GIRDER_WORKS = defineConcept({
  id: 'girder-works',
  scale: 'grand',
  varies: ['storeys (count and height)', 'which ends the ladders climb', 'bays missing from the decks', 'where the wrecking ball swings', 'hoist timing'],
  weight: 3,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, GIRDER_MIN + BANK),
  ownsCrossing: true,
  family: ['falling sign', 'live wire', 'gondola'],
  names: ['The Girder Works at {place}', '{place} Tower (Under Construction)', 'The Building Site of {place}', 'The Steel Skeleton of {place}'],
  codex: {
    about:
      'A building going up: girder decks with bays left out and a hoist at either end. Along the roof under it all, or up and over the top deck under the wrecking ball.',
  },
  box: (k, rng) => {
    const cross = crossFor(k, GIRDER_MIN + BANK);
    return { w: cross + BANK + structCols(k, rng, GIRDER_MIN, [22, 32], true), h: boxH(k.H, 4 * (DOOR + 2) + 7) };
  },
  build: buildGirders,
  pieces: (rng, _s, l) => girderPieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ neon billboard

const BILL_MIN = 13;

function buildBillboard(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const G = at.y + at.h;
  const cross = Math.min(at.w - BILL_MIN - BANK, crossCols(parts));
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  bankCrossing(g, rng, at.x, cross, G, parts);
  const s0 = at.x + cross + BANK;
  const s1 = at.x + at.w - 1;
  // The board on its legs: a runner's height (or a little more) clear under it, three to five rows of sign.
  const b0 = s0 + 2;
  const b1 = Math.max(b0 + 8, s1 - rng.int(1, 3));
  const clear = DOOR + rng.int(0, 1);
  const bb = G - clear - 1;
  const bh = Math.max(3, Math.min(rng.int(3, 5), bb - 6));
  const bt = bb - bh + 1;
  g.fill(b0, bt, b1, bb, 1, true);
  // Up the service ladder on the near leg and over the top; or along the roof under it.
  ledges(g, s0, bt, G);
  // The word on top: a column of board left dark at each end to stand on.
  const free = b1 - b0 + 1 - 2;
  const n = Math.max(3, Math.min(free - 1, rng.int(4, 7)));
  const w0 = b0 + 1 + rng.int(0, Math.max(0, free - n));
  const mid = Math.floor((b0 + b1) / 2);
  return {
    concept: 'neon-billboard',
    rect: rectOver(at, bt - 4, G),
    air: [{ x: b0, y: Math.max(0, bt - 3), w: b1 - b0 + 1, h: 2 }],
    anchors: {
      site: [s0, s1],
      board: [b0, b1],
      rows: [bt, bb],
      ground: [G, clear],
      word: [w0, n],
      ...ways([
        { x: mid, y: 0, w: 1, h: bt },
        { x: mid, y: bb + 1, w: 1, h: G - bb - 1 },
      ]),
      sig0: [b1 - b0, bh],
      sig1: [clear, s1 - b1],
      sig2: [n, w0 - b0],
    },
    skin: 'metal',
  };
}

function* billboardPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const [b0, b1] = l.anchors.board;
  const [bt, bb] = l.anchors.rows;
  const [G] = l.anchors.ground;
  const [w0, n] = l.anchors.word;
  // The neon word on top, lit letter by letter, with the frame, legs and spotlights behind it all.
  const cells = Array.from({ length: n }, (_, i) => [w0 + i, bt - 1] as [number, number]);
  yield {
    ...neonPiece(rng, [shell(rng, [b0, bt], b1 - b0 + 1, G - bt), ...neonModules(rng, cells)]),
    pathSafe: true,
  };
  // A live wire strung between the legs under the board, sagging to head height.
  yield wirePiece(rng, [wireModule(rng, b0, b1, G, G - bb - 1.3, 1)]);
}

export const NEON_BILLBOARD = defineConcept({
  id: 'neon-billboard',
  varies: ['board width and height', 'clearance under it', 'how many letters, and where', 'wire timing'],
  weight: 3,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, BILL_MIN + BANK),
  ownsCrossing: true,
  family: ['neon sign', 'live wire', 'antennas'],
  names: ['The Neon Billboard of {place}', 'The Big Sign over {place}', '{place} Lights', 'The Billboard at {place}'],
  codex: {
    about: 'A billboard on steel legs, its ad lit from below. Under the board past the live wire, or up the ladder and across the neon letters as they light.',
  },
  box: (k, rng) => {
    const cross = crossFor(k, BILL_MIN + BANK);
    return { w: cross + BANK + structCols(k, rng, BILL_MIN, [18, 28]), h: boxH(k.H, DOOR + 1 + 5 + 5) };
  },
  build: buildBillboard,
  pieces: (rng, _s, l) => billboardPieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ water tower row

const TOWER_MIN = 14;

function buildTowers(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const G = at.y + at.h;
  const cross = Math.min(at.w - TOWER_MIN - BANK, crossCols(parts));
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  bankCrossing(g, rng, at.x, cross, G, parts);
  const s0 = at.x + cross + BANK;
  const s1 = at.x + at.w - 1;
  // Tanks on legs, two or three of them (more on a wide roof), a hop apart, each a little higher or lower.
  const t0 = s0 + 2;
  const room = s1 - 1 - t0 + 1;
  const legBase = DOOR + rng.int(0, 1);
  const tanks: { x: number; w: number; leg: number; h: number }[] = [];
  let x = t0;
  for (;;) {
    const w = rng.int(3, 4);
    const gap = tanks.length ? rng.int(2, 3) : 0;
    if (x + gap + w - 1 > t0 + room - 1) break;
    const leg = Math.max(DOOR, legBase + (tanks.length ? rng.int(-1, R > 2 ? 1 : 2) : 0));
    tanks.push({ x: x + gap, w, leg, h: rng.int(3, 4) });
    x += gap + w;
    if (tanks.length >= (room > 22 ? 4 : 3)) break;
  }
  const tops: Vec[] = [];
  for (const t of tanks) {
    const bot = G - t.leg - 1;
    const top = bot - t.h + 1;
    g.fill(t.x, top, t.x + t.w - 1, bot, 1, true);
    // The conical lid: a row narrower than the tank, stepped up from its rim.
    g.fill(t.x + 1, top - 1, t.x + t.w - 2, top - 1, 1, true);
    tops.push([t.x, top]);
  }
  ledges(g, s0, tops[0][1], G);
  const first = tanks[0];
  const last = tanks[tanks.length - 1];
  const hi = Math.min(...tops.map(([, y]) => y));
  const lowLeg = Math.min(...tanks.map((t) => t.leg));
  // The way over is shut in the gap after the first tank (or on it, with only one); the way under, under it.
  const wx = tanks.length > 1 ? first.x + first.w : first.x + 1;
  return {
    concept: 'water-towers',
    rect: rectOver(at, hi - 4, G),
    air: [{ x: first.x, y: Math.max(0, hi - 3), w: last.x + last.w - first.x, h: 2 }],
    anchors: {
      site: [s0, s1],
      ground: [G, lowLeg],
      ...record(
        'tank',
        tanks.map((t) => [t.x, t.w] as Vec),
      ),
      ...record('top', tops),
      ...ways([
        { x: wx, y: 0, w: 1, h: G - lowLeg - 1 },
        { x: wx, y: G - lowLeg, w: 1, h: lowLeg },
      ]),
      sig0: [tanks.length, legBase],
      sig1: listSig(tanks.map((t) => t.x - s0)),
      sig2: listSig(tanks.map((t) => t.leg * 10 + t.h)),
    },
    skin: 'planks',
  };
}

function* towerPieces(rng: Rng, s: Site, l: Landmark): Generator<Piece> {
  const [s0, s1] = l.anchors.site;
  const [G, lowLeg] = l.anchors.ground;
  const tanks = listOf(l, 'tank');
  const tops = listOf(l, 'top');
  const [fx] = tanks[0];
  const [lx, lw] = tanks[tanks.length - 1];
  const hi = Math.min(...tops.map(([, y]) => y));
  // The legs, braces and ladders behind the tanks, and the live wire strung low along under them.
  yield wirePiece(rng, [shell(rng, [s0, hi - 1], s1 - s0 + 1, G - hi + 1), wireModule(rng, fx, lx + lw - 1, G, lowLeg - 0.3, 1)]);
  // A burst valve on a tank's rim, spraying back across the hop from the one before it.
  for (let i = 1; i < tanks.length; i++) {
    const [x] = tanks[i];
    const [px, pw] = tanks[i - 1];
    const [, ty] = tops[i];
    const gap = x - (px + pw);
    if (!s.free(x, ty - 1) || gap < 2 || !rng.chance(0.75)) continue;
    yield {
      name: rng.pick(['Burst Valve', 'Pressure Washer', 'Leaky Tank', 'Water Pressure']),
      archetype: 'fan',
      role: 'hazard',
      style: CITY(rng),
      modules: [
        {
          type: 'geyser',
          look: 'water',
          at: [x + 0.2, ty - 0.55],
          angle: Math.PI,
          width: 1.1,
          length: gap + 1.6,
          off: rng.int(90, 150),
          warn: rng.int(30, 44),
          on: rng.int(50, 80),
          lethal: false,
          strength: rng.int(1800, 2400),
        },
      ],
    };
    return;
  }
}

export const WATER_TOWERS = defineConcept({
  id: 'water-towers',
  varies: ['how many tanks', 'tank widths and heights', 'leg heights', 'gaps between them', 'which hop the valve sprays'],
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, TOWER_MIN + BANK),
  ownsCrossing: true,
  family: ['live wire', 'ac updraft', 'gondola'],
  names: ['The Water Towers of {place}', '{place} Tank Row', 'The Tanks over {place}', 'The Reservoir Roofs of {place}'],
  codex: {
    about:
      'Two to four water tanks on legs. Under them past a live wire strung along the legs, or up the ladder and tank to tank, where a burst valve sprays across a hop.',
  },
  box: (k, rng) => {
    const cross = crossFor(k, TOWER_MIN + BANK);
    return { w: cross + BANK + structCols(k, rng, TOWER_MIN, [18, 30]), h: boxH(k.H, DOOR + 2 + 5 + 5) };
  },
  build: buildTowers,
  pieces: (rng, s, l) => towerPieces(rng, s, l),
});

// ------------------------------------------------------------------------------------------------ clock tower

const CLOCK_MIN = 13;
/** Rows the arch through the tower's foot is tall: room for the pendulum over a runner. */
const ARCH = DOOR + 1;

function buildClock(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const G = at.y + at.h;
  const cross = Math.min(at.w - CLOCK_MIN - BANK, crossCols(parts));
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  bankCrossing(g, rng, at.x, cross, G, parts);
  const s0 = at.x + cross + BANK;
  const s1 = at.x + at.w - 1;
  // The tower: tall, a landing strip of roof past it, a spire or a belfry frame on top.
  const t0 = s0 + 2;
  const tw = Math.max(7, Math.min(s1 - 2 - t0 + 1, rng.int(7, 10)));
  const t1 = t0 + tw - 1;
  const th = Math.max(ARCH + 6, Math.min(at.h - 5, rng.int(4, 5) * R + rng.int(3, 6)));
  const tt = G - th;
  g.fill(t0, tt, t1, G - 1, 1, true);
  g.clear(t0, G - ARCH, t1, G - 1);
  // A buttress a row proud at the tower's corners, sometimes.
  const crown = rng.chance(0.5);
  if (crown) {
    g.set(t0, tt - 1, 1, true);
    g.set(t1, tt - 1, 1, true);
  }
  const ledgeRows = ledges(g, s0, tt - (crown ? 1 : 0), G);
  const mid = Math.floor((t0 + t1) / 2);
  // The bell hangs over the roof's middle third, from a frame on top.
  const bell = mid + rng.int(-1, 1);
  return {
    concept: 'clock-tower',
    rect: rectOver(at, tt - 6, G),
    air: [
      { x: t0 + 1, y: Math.max(0, tt - 5), w: tw - 2, h: 5 },
      { x: t0, y: G - ARCH, w: tw, h: ARCH },
    ],
    anchors: {
      tower: [t0, t1],
      top: [tt, G],
      bell: [bell, crown ? 1 : 0],
      ...ways([
        { x: mid, y: 0, w: 1, h: tt },
        { x: mid, y: G - ARCH, w: 1, h: ARCH },
      ]),
      sig0: [th, tw],
      sig1: [crown ? 1 : 0, s1 - t1],
      sig2: [ledgeRows.length, bell - t0],
    },
    skin: 'stone',
  };
}

function* clockPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const [t0, t1] = l.anchors.tower;
  const [tt, G] = l.anchors.top;
  const [bell] = l.anchors.bell;
  // The pendulum in the arch, swinging steady under the clockwork; the arch's dark and the works behind it.
  const px = Math.floor((t0 + t1) / 2);
  yield {
    name: rng.pick(['The Pendulum', 'Tick Tock', 'Grandfather Time', 'The Long Case']),
    archetype: 'flail',
    role: 'hazard',
    style: makeStyle(rng, ['brass', 'gold'], [40], { glowHue: rng.range(36, 48) }),
    modules: [
      shell(rng, [t0, G - ARCH], t1 - t0 + 1, ARCH),
      {
        type: 'swinger',
        head: 'weight',
        hub: [px + 0.5, G - ARCH + 0.1],
        arm: ARCH - 1.35,
        angle0: DOWN,
        period: rng.int(190, 230),
        swing: rng.range(0.85, 1.0),
        dir: 1,
        radius: rng.range(0.7, 0.8),
        count: 1,
        link: 'rod',
      },
    ],
  };
  // The bell, swinging in its frame over the roof.
  yield {
    name: rng.pick(['The Big Bell', 'For Whom It Tolls', 'Ding Dong', 'The Belfry']),
    archetype: 'flail',
    role: 'hazard',
    style: makeStyle(rng, ['brass', 'gold'], [36], { glowHue: rng.range(36, 48) }),
    modules: [
      shell(rng, [t0, tt - 6], t1 - t0 + 1, 6),
      {
        type: 'swinger',
        head: 'weight',
        hub: [bell + 0.5, tt - 4.2],
        arm: 3.4,
        angle0: DOWN,
        period: rng.int(220, 260),
        swing: rng.range(0.6, 0.75),
        dir: rng.chance(0.5) ? 1 : -1,
        radius: rng.range(0.85, 0.95),
        count: 1,
        link: 'rod',
      },
    ],
  };
}

export const CLOCK_TOWER = defineConcept({
  id: 'clock-tower',
  scale: 'grand',
  varies: ['tower height and width', 'its corner buttresses', 'where the bell hangs', 'pendulum and bell timing'],
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, CLOCK_MIN + BANK),
  ownsCrossing: true,
  family: ['falling sign', 'antennas', 'gondola'],
  names: ['The Clock Tower of {place}', '{place} Clock Tower', 'Big {place}', 'The Town Clock at {place}'],
  codex: { about: 'A town clock keeping the race’s time. Through the arch under the swinging pendulum, or up the ledges and over the top under the bell.' },
  box: (k, rng) => {
    const cross = crossFor(k, CLOCK_MIN + BANK);
    return { w: cross + BANK + structCols(k, rng, CLOCK_MIN, [16, 24], true), h: boxH(k.H, 5 * easyRise() + 18) };
  },
  build: buildClock,
  pieces: (rng, _s, l) => clockPieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ el station

const EL_MIN = 14;

function buildEl(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const G = at.y + at.h;
  const cross = Math.min(at.w - EL_MIN - BANK, crossCols(parts));
  g.clear(at.x, 0, at.x + at.w - 1, G - 1);
  bankCrossing(g, rng, at.x, cross, G, parts);
  const s0 = at.x + cross + BANK;
  const s1 = at.x + at.w - 1;
  // The viaduct: a track bed on piers, a runner's height and a bit over the street.
  const vh = DOOR + 1 + rng.int(0, at.h >= 13 ? 2 : 1);
  const V = G - vh;
  const v0 = s0 + 2;
  const v1 = s1 - rng.int(0, 2);
  g.fill(v0, V, v1, V, 1, true);
  // Up the station stairs at the near end; off the far end, down its own stairs where there's room.
  ledges(g, s0, V, G);
  const down = v1 + 2 <= s1 && rng.chance(0.6);
  if (down) ledges(g, v1 + 1, V, G);
  // A signal bridge over the track somewhere along it: a perch over the trains.
  const sig = V - 4 >= 2 && v1 - v0 >= 10 && rng.chance(0.65) ? rng.int(v0 + 4, v1 - 6) : -1;
  if (sig >= 0) deck(g, sig, sig + 2, V - 4);
  const mid = Math.floor((v0 + v1) / 2);
  return {
    concept: 'el-station',
    rect: rectOver(at, V - 6, G),
    air: [{ x: v0, y: Math.max(0, V - 3), w: v1 - v0 + 1, h: 3 }],
    anchors: {
      site: [s0, s1],
      deck: [v0, v1],
      ground: [G, V],
      ...ways([
        { x: mid, y: 0, w: 1, h: V },
        { x: mid, y: V + 1, w: 1, h: G - V - 1 },
      ]),
      gantry: [sig, V - 4],
      sig0: [vh, v1 - v0],
      sig1: [s1 - v1, s1 - s0],
      sig2: [down ? 1 : 0, sig - v0],
    },
    skin: 'metal',
  };
}

function* elPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const [s0, s1] = l.anchors.site;
  const [v0, v1] = l.anchors.deck;
  const [G, V] = l.anchors.ground;
  // The train, shuttling along the track and waiting at each end; the piers and the station behind it all.
  const len = v1 - v0 + 1;
  const w = Math.max(3, Math.min(6, Math.floor(len / 3) + rng.int(-1, 1)));
  const flip = rng.chance(0.5);
  yield {
    name: rng.pick(['The El', 'Express Service', 'Mind the Gap', 'The Late Train', 'Rush Hour']),
    archetype: 'crusher',
    role: 'hazard',
    style: makeStyle(rng, ['steel'], [140, 200, 20, 48], { trim: 'stripes', glowHue: rng.range(40, 52) }),
    modules: [
      shell(rng, [s0, V - 5], s1 - s0 + 1, G - V + 5),
      {
        type: 'vehicle',
        look: 'minecart',
        at: [v0, V],
        cols: Array.from({ length: w }, (_, i) => (i === 0 || i === w - 1 ? 1.75 : 2)),
        colW: 1,
        span: Math.max(2, len - w),
        speed: rng.range(3.4, 4.6),
        pause: rng.int(70, 110),
        hurt: 'lead',
        flip,
        seed: rng.int(0, 1 << 20),
      },
    ],
  };
  // Under the track: the station sign, hung from it and waiting to come down on the street, or a downed
  // power line strung between two of its piers.
  const lo = v0 + 2;
  const hi = v1 - 4;
  if (rng.chance(0.35) && v1 - v0 >= 9) {
    const a = rng.int(v0 + 1, v1 - 8);
    yield wirePiece(rng, [wireModule(rng, a, a + rng.int(6, Math.min(9, v1 - 1 - a)), G, G - V - 1.3, 1)]);
  } else if (hi >= lo && G - (V + 2) >= 2) {
    const x = rng.int(lo, hi);
    yield { ...signPiece(rng, signModule(rng, x, V + 1, 3, 1, G)), name: rng.pick(['Next Stop: Pit', 'Platform Sign', 'Way Out', 'Uptown Only']) };
  }
}

export const EL_STATION = defineConcept({
  id: 'el-station',
  varies: ['track height', 'viaduct length', 'train length and timing', 'where the station sign hangs'],
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, EL_MIN + BANK),
  ownsCrossing: true,
  family: ['falling sign', 'live wire', 'neon sign'],
  names: ['The El Station at {place}', '{place} Elevated', 'The {place} Line', 'The Overground at {place}'],
  codex: { about: 'An elevated railway and a train that waits for no one, mostly. Along the track, or along the street under it.' },
  box: (k, rng) => {
    const cross = crossFor(k, EL_MIN + BANK);
    return { w: cross + BANK + structCols(k, rng, EL_MIN, [22, 34]), h: boxH(k.H, DOOR + 3 + 7) };
  },
  build: buildEl,
  pieces: (rng, _s, l) => elPieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ registry

export const ROOFTOPS_CONCEPTS: Concept[] = [GIRDER_WORKS, NEON_BILLBOARD, WATER_TOWERS, CLOCK_TOWER, EL_STATION];

/** Structure columns per concept, for the alley a level's box gets room for. */
const STRUCT: Record<string, number> = {
  'girder-works': GIRDER_MIN + BANK,
  'neon-billboard': BILL_MIN + BANK,
  'water-towers': TOWER_MIN + BANK,
  'clock-tower': CLOCK_MIN + BANK,
  'el-station': EL_MIN + BANK,
};

/**
 * How many parts the rooftops landmark's own alley takes on this attempt, given the level's `challenges`:
 * two where its box made room for a two-part one (and the attempt still insists on two, TWO_PART_TRIES),
 * else one; none when the level asks for none.
 */
export function rooftopsOwns(c: Concept, k: Knobs, attempt: number, challenges: number): number {
  if (challenges <= 0) return 0;
  const s = STRUCT[c.id];
  return attempt < TWO_PART_TRIES && s !== undefined && crossFor(k, s) >= twoGap() && twoGap() > oneGap() ? 2 : 1;
}
