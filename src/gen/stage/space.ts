import { datan2, dcos, dsin } from '../../core/dmath';
import { DOWN, UP, type Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import { type LevelProfile, T_ONEWAY, type TileRect } from '../../sim/level';
import type { Module, PropStyle } from '../../sim/props';
import { type Grid, hintGap, noise1D } from '../level/kit';
import { easyRise, hardGap, hopGap, type Knobs, TWO_PART_TRIES } from '../level/sculptors/common';
import { makeStyle, type Piece, type Site } from '../setpieces/place';
import { defineConcept } from './contract';
import type { Concept, Landmark } from './types';
import { DOOR, oneGap, shell, twoGap, ways, ledges as rungs } from './kit';

/**
 * Space stage concepts (docs/SETPIECES.md, Space): five places floating in the void, each one landmark that
 * owns the level's hard crossing, laid out afresh from its seed. Nothing in space stands on anything, so
 * every landmark is `floating`, and each reads as one built or natural thing: a hull, a ring, a planetoid.
 *
 * - **The Starship** (grand): a stubby carrier moored at the end of a gangway. Through its hangar deck,
 *   where a cargo hauler runs, or up its stern and over the flight deck under the bridge's point-defense
 *   gun; its engines idle out over the crossing.
 * - **The Ring Station** (grand): a habitat ring of hull round a hub, its floor a chord across the bottom.
 *   In through one airlock and out the other under the hub's spinning maintenance saws, or up the hand
 *   holds and over the ring, where the antennas arc.
 * - **The Planetoid** (large): a little world with a moon on its own orbit, which passes through the hops
 *   onto and off it. Through the tunnel at its equator, past a vent of its molten core, or over the top.
 * - **The Launch Gantry** (large): a rocket on its pad beside its service tower. Under the rocket between
 *   its clamps while the engine isn't test-firing, or up the tower (rungs, or the lift) and over the nose.
 * - **The Mining Rig** (large): an asteroid bored through, a drill rig on top whose bit plunges down its
 *   shaft through both ways and back. Through the bore, or over the rock.
 *
 * Every landmark keeps a static way past itself and owns the crossing: a void in front of it, sized with
 * `hardGap` at the level's gravity, its far bank the landmark's own gangway or docking arm. Anchors the
 * tests read: `way{i}` / `way{i}s` (a rect that, filled, shuts one way through), `deck` (the row the
 * crossing's banks stand on), `exit` (the first column past the structure and the row it leaves at).
 */

/** Columns kept at either end of a space level for its docks: the spawn or goal pocket and a column past it. */
export const SPACE_DOCK = 6;
/** Rows a landmark may hang below its deck (a keel, the ring's floor, a planet's south pole). */
export const SPACE_UNDER = 6;
/** Fewest columns of gangway between the void and the structure: somewhere to land and a step. */
const ARM = 3;

/** Columns between the docks. */
const middle = (w: number) => w - 2 * SPACE_DOCK;

/**
 * Share of levels built round a landmark that ask for two parts (wide ones only: a classic level has no room
 * for a two-part crossing). A landmark makes room for its two-part crossing every time, where a plain space
 * level often can't fit one, so it asks less often than the theme's TWO_PART_ASK to hold space's share of
 * two-part levels (measured with `pnpm level --stats 200 --theme space`).
 */
export const SPACE_LANDMARK_TWO = 0.36;
export const spaceAsksTwo = (k: Pick<Knobs, 'W' | 'challenge'>) => k.W >= 64 && k.challenge < SPACE_LANDMARK_TWO;

/** Columns for the crossing a landmark owns: two-part where the level asks for two and a wide one has room. Never rolls. */
function crossFor(k: Knobs, struct: number): number {
  if (spaceAsksTwo(k) && twoGap() + ARM + struct <= middle(k.W)) return twoGap();
  return oneGap();
}

/** Does a landmark of `struct` columns fit beside a one-part crossing on this level? */
function roomFor(p: Partial<LevelProfile>, struct: number): boolean {
  return oneGap(p.gravity) + ARM + struct <= middle(p.w ?? 48);
}

/** Columns of structure for a box: what a classic level's middle leaves (all of it for a grand one), more on a wide one. */
function structCols(k: Knobs, rng: Rng, min: number, wide: readonly [number, number], grand = false): number {
  const room = middle(k.W) - crossFor(k, min) - ARM;
  return Math.max(min, Math.min(room, k.W > 56 ? rng.int(wide[0], wide[1]) : grand ? room : min + rng.int(0, 3)));
}

/** Rows a box asks for: `above` its deck (never more than a level this tall has) and the rows under it. */
const deckBox = (k: Knobs, above: number) => Math.min(k.H - SPACE_UNDER - 2, above) + SPACE_UNDER;

/** The deck row of a landmark's box: the row its gangway, floors and the crossing's banks stand on. */
export const deckOf = (at: TileRect) => at.y + at.h - SPACE_UNDER;

/**
 * The void in front of a landmark and the gangway across to it: a `hardGap` (or, when the level asks for no
 * part, a hop) from the box's left edge, its bridge hinted, then a one-row gangway on the deck row out to
 * the structure, which starts at `s0`. Returns the void's columns and `s0`.
 */
function approach(g: Grid, rng: Rng, at: TileRect, parts: number, min: number): { a: number; b: number; s0: number; D: number } {
  const D = deckOf(at);
  g.clear(at.x, 0, at.x + at.w - 1, g.h - 1);
  const cross = Math.max(2, Math.min(at.w - min - ARM, parts >= 2 ? twoGap() : oneGap()));
  const gw = Math.min(cross, parts > 0 ? hardGap(rng, parts) : hopGap(rng, 2));
  const a = at.x;
  const b = a + gw - 1;
  const s0 = at.x + cross + ARM;
  g.fill(b + 1, D, s0 - 1, D, 1, true);
  if (parts > 0) hintGap(g, a, b, D);
  return { a, b, s0, D };
}

const HULL = (rng: Rng): PropStyle => makeStyle(rng, 'steel', [205, 215, 48], { trim: 'stripes', glowHue: rng.pick([190, 330, 120, 48]) });
const ROCK = (rng: Rng): PropStyle => makeStyle(rng, ['steel', 'rust'], [30, 200, 280], { glowHue: rng.pick([20, 170, 280]) });

/** A plasma gun on the stand cell (x, y), aimed at the point (tx, ty) (tiles). */
function plasmaGun(rng: Rng, x: number, y: number, tx: number, ty: number): Module {
  const at: Vec = [x + 0.5, y + 0.45];
  return {
    type: 'cannon',
    look: 'castle',
    at,
    angle: datan2(ty - at[1], tx - at[0]),
    ammo: 'plasma',
    interval: rng.int(150, 220),
    burst: rng.int(1, 2),
    speed: rng.int(150, 200),
    length: 1.1,
    seed: rng.int(0, 1 << 20),
  };
}

/** Distance from a cell to a center, both in whole tiles. */
const dist = (x: number, y: number, cx: number, cy: number) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));

// ------------------------------------------------------------------------------------------------ starship

const SHIP_MIN = 13;

function buildStarship(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const { s0, D } = approach(g, rng, at, parts, SHIP_MIN);
  const s1 = at.x + at.w - 1;
  // The superstructure: a hangar straight through at deck level, a flight deck on its roof. The stern faces
  // the void (its engines out over the crossing), the bow leaves a stretch of foredeck before the exit.
  const roof = rng.int(1, 2);
  const P = DOOR + roof;
  const h0 = s0 + 2;
  const bow = rng.int(2, 3);
  const h1 = s1 - bow;
  g.fill(s0, D, s1, D, 1, true);
  g.fill(h0, D - P, h1, D - 1, 1, true);
  g.clear(h0, D - DOOR, h1, D - 1);
  // A raked bow: the flight deck's front corner cut back.
  g.clear(h1, D - P, h1, D - P);
  // The keel under the deck, blunt at the stern and raked toward the bow.
  const depth = rng.int(2, Math.min(3, SPACE_UNDER - 2));
  for (let i = 1; i <= depth; i++) {
    const a = s0 + i - 1 + (i > 1 ? rng.int(0, 1) : 0);
    const b = s1 - 2 * i - rng.int(0, 1);
    if (a <= b) g.fill(a, D + i, b, D + i, 1, true);
  }
  // The bridge island on the flight deck: low enough to hop, somewhere between amidships and the bow.
  const iw = rng.int(2, 3);
  const ih = Math.max(1, Math.min(3, R - 1));
  const span = h1 - 1 - iw - (h0 + 2);
  const ix = h0 + 2 + Math.max(0, Math.round(span * rng.range(0.45, 1)));
  g.fill(ix, D - P - ih, ix + iw - 1, D - P - 1, 1, true);
  // Up the stern on rungs where the jump falls short.
  const steps = rungs(g, s0, D - P, D);
  const mid = Math.floor((h0 + ix) / 2);
  const top = D - P - ih - 6;
  return {
    concept: 'starship',
    rect: { x: at.x, y: Math.max(0, top), w: at.w, h: D + depth + 1 - Math.max(0, top) },
    air: [
      { x: h0, y: D - DOOR, w: h1 - h0 + 1, h: DOOR },
      { x: h0, y: D - P - ih - 2, w: h1 - h0 + 1, h: 2 },
    ],
    anchors: {
      deck: [D, 0],
      exit: [s1 + 1, D],
      ship: [s0, s1],
      hangar: [h0, h1],
      roof: [D - P, D],
      island: [ix, iw],
      islandH: [ih, depth],
      ...ways([
        { x: mid, y: 0, w: 1, h: D - P },
        { x: mid, y: D - DOOR, w: 1, h: DOOR },
      ]),
      sig0: [h1 - h0, roof],
      sig1: [ix - h0, iw],
      sig2: [bow, depth],
      sig3: [steps.length, 0],
    },
    skin: 'hull',
  };
}

function* starshipPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const [s0, s1] = l.anchors.ship;
  const [h0, h1] = l.anchors.hangar;
  const [roofTop, D] = l.anchors.roof;
  const [ix, iw] = l.anchors.island;
  const [ih, depth] = l.anchors.islandH;
  // The hull's paint, bridge and engines behind it all, and a cargo hauler running the hangar deck.
  const room = h1 - h0 + 1;
  yield {
    name: rng.pick(['Cargo Hauler', 'Forklift Drone', 'Load Lifter', 'Union Rules Hauler']),
    archetype: 'crusher',
    role: 'hazard',
    style: HULL(rng),
    modules: [
      shell(rng, [s0 - 1, roofTop - ih - 6], s1 - s0 + 3, D - roofTop + ih + 7 + depth),
      {
        type: 'vehicle',
        look: 'forklift',
        at: [h0 + 1, D],
        cols: [1.1, 1.4],
        colW: 1,
        span: Math.max(1, room - 4),
        speed: rng.range(1.8, 2.8),
        pause: rng.int(50, 90),
        hurt: 'lead',
        flip: rng.chance(0.5),
        seed: rng.int(0, 1 << 20),
      },
    ],
  };
  // The engines, idling out over the crossing from the stern: one, or two stacked where the deck is deep.
  const rows = D - DOOR - roofTop >= 2 ? [roofTop + 0.5, roofTop + 1.5] : [roofTop + 0.5];
  yield {
    name: rng.pick(['Main Engines', 'Afterburners', 'Reverse Thrust', 'Exhaust Port']),
    archetype: 'flamer',
    role: 'hazard',
    style: HULL(rng),
    modules: rows.map((y) => ({
      type: 'flame' as const,
      at: [h0 - 0.02, y] as Vec,
      angle: Math.PI,
      length: rng.range(4, 6),
      on: rng.int(40, 60),
      off: rng.int(130, 180),
      warn: rng.int(40, 52),
    })),
  };
  // Point defense on the bridge, aimed down the flight deck at the stern.
  yield {
    name: rng.pick(['Point Defense', 'Bridge Gun', 'Warranty-Void Turret', 'Overzealous Turret']),
    archetype: 'launcher',
    role: 'hazard',
    style: HULL(rng),
    modules: [plasmaGun(rng, ix + Math.floor(iw / 2), roofTop - ih - 1, h0 + 0.5, roofTop + 0.15)],
  };
}

export const STARSHIP = defineConcept({
  id: 'starship',
  scale: 'grand',
  footing: 'floating',
  varies: ['hull length', 'flight deck height', 'where the bridge island stands and its width', 'keel depth', 'engines', 'hauler timing'],
  weight: 3,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, SHIP_MIN),
  ownsCrossing: true,
  family: ['turret', 'meteor shower', 'airlock', 'fuel cells', 'solar flare'],
  names: ['The Starship at {place}', 'The {place} Carrier', 'The Mothership of {place}', 'Docking Bay {place}'],
  codex: {
    about:
      'A stubby carrier moored at the end of its gangway. Through the hangar where a cargo hauler runs, or over the flight deck under the bridge’s plasma gun.',
  },
  box: (k, rng) => {
    const struct = structCols(k, rng, SHIP_MIN, [22, 34], true);
    return { w: crossFor(k, SHIP_MIN) + ARM + struct, h: deckBox(k, DOOR + 2 + 3 + 7) };
  },
  build: buildStarship,
  pieces: (rng, _s, l) => starshipPieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ ring station

const RING_MIN = 13;

function buildRing(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const { s0, D } = approach(g, rng, at, parts, RING_MIN);
  const s1 = at.x + at.w - 1;
  const above = D - at.y;
  const keel = rng.int(2, 3);
  // The ring as big as the room allows: hand holds up the outside of its near side, the exit deck past it.
  const most = Math.max(5, Math.min(9, Math.floor((s1 - s0 - 2) / 2), Math.floor((above + keel - 3) / 2)));
  const Ro = most > 6 ? most - rng.int(0, 1) : most;
  const thick = 2;
  const Ri = Ro - thick;
  const cx = s1 - Ro - (s1 - s0 - 2 > 2 * Ro ? rng.int(0, 1) : 0);
  const dy = Ro - keel;
  const cy = D - dy;
  for (let y = cy - Ro - 1; y <= cy + Ro + 1; y++)
    for (let x = cx - Ro - 1; x <= cx + Ro + 1; x++) {
      const d = dist(x, y, cx, cy);
      if (d <= Ro + 0.35 && (d > Ri + 0.35 || y >= D)) g.set(x, y, 1, true);
    }
  // The airlocks: the ring's wall cut through at deck level either side.
  for (let y = D - DOOR; y < D; y++)
    for (let x = cx - Ro - 1; x <= cx + Ro + 1; x++) {
      const d = dist(x, y, cx, cy);
      if (d > Ri + 0.35 && d <= Ro + 0.35) g.set(x, y, 0, true);
    }
  // A viewport or two through the ring's upper wall.
  for (let i = rng.int(0, 2); i > 0; i--) {
    const a = -Math.PI * rng.range(0.2, 0.8);
    const r = Ro - thick / 2;
    g.set(Math.round(cx + dcos(a) * r), Math.round(cy + dsin(a) * r), 0, true);
  }
  // The docking arm on into the near airlock, and the deck out of the far one.
  g.fill(s0, D, s1, D, 1, true);
  const holds = rungs(g, s0, cy - Ro + 1, D);
  return {
    concept: 'ring-station',
    rect: { x: at.x, y: Math.max(0, cy - Ro - 2), w: at.w, h: cy + Ro + 1 - Math.max(0, cy - Ro - 2) + 1 },
    air: [{ x: cx - Ri + 1, y: cy - Ri + 1, w: 2 * Ri - 1, h: D - cy + Ri - 1 }],
    anchors: {
      deck: [D, 0],
      exit: [s1 + 1, D],
      ring: [cx, cy],
      radii: [Ro, Ri],
      ...ways([
        { x: cx, y: 0, w: 1, h: cy - Ro },
        { x: cx, y: cy - Ri + 1, w: 1, h: D - (cy - Ri + 1) },
      ]),
      sig0: [Ro, thick],
      sig1: [keel, holds.length],
      sig2: [s1 - s0, R],
    },
    skin: 'hull',
  };
}

function* ringPieces(rng: Rng, s: Site, l: Landmark): Generator<Piece> {
  const [cx, cy] = l.anchors.ring;
  const [Ro, Ri] = l.anchors.radii;
  const [D] = l.anchors.deck;
  const [ex] = l.anchors.exit;
  // The hub's maintenance saws, sweeping the inside of the ring down to the floor: the station spinning.
  // The ring's spokes, hub and windows are the shell behind it.
  const r = 0.7;
  const arm = Math.max(1.4, Math.min(Ri - 0.1 - r, D - cy - 0.55 - r));
  yield {
    name: rng.pick(['Maintenance Saws', 'Spin Cycle', 'The Centrifuge', 'Habitat Spokes']),
    archetype: 'saw',
    role: 'hazard',
    style: HULL(rng),
    modules: [
      shell(rng, [cx - Ro - 2, cy - Ro - 2], 2 * Ro + 5, D - cy + Ro + 2),
      {
        type: 'swinger',
        head: 'saw',
        hub: [cx + 0.5, cy + 0.5],
        arm,
        angle0: rng.range(0, Math.PI * 2),
        period: rng.int(260, 360),
        swing: 0,
        dir: rng.chance(0.5) ? 1 : -1,
        radius: r,
        count: rng.int(2, 3),
        link: 'rod',
      },
    ],
  };
  // Antennas on the crown, arcing across it: two masts a few columns apart, the arc at a runner's height.
  let top = 0;
  while (top < s.h && !s.solid(cx, top)) top++;
  const span = rng.int(2, Math.min(4, Ro - 2));
  const a: Vec = [cx - span + 0.5, top - 0.55];
  const b: Vec = [cx + span + 0.5, top - 0.55];
  if (s.free(Math.floor(a[0]), Math.floor(a[1])) && s.free(Math.floor(b[0]), Math.floor(b[1])) && b[0] < ex)
    yield {
      name: rng.pick(['Comm Arc', 'Static Crown', 'Antenna Farm', 'Do Not Lick']),
      archetype: 'tesla',
      role: 'hazard',
      style: HULL(rng),
      modules: [{ type: 'tesla', a, b, on: rng.int(40, 60), off: rng.int(130, 180), warn: rng.int(36, 48) }],
    };
}

export const RING_STATION = defineConcept({
  id: 'ring-station',
  scale: 'grand',
  footing: 'floating',
  varies: ['ring radius and thickness', 'floor depth', 'hand holds', 'saw count, reach and spin', 'where the antennas stand'],
  weight: 3,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, RING_MIN),
  ownsCrossing: true,
  family: ['comm array', 'turret', 'airlock', 'meteor shower', 'docking arm'],
  names: ['The Ring Station of {place}', '{place} Ring', 'The Habitat at {place}', 'Station {place}'],
  codex: {
    about:
      'A habitat ring round a hub. In one airlock and out the other under the maintenance saws, or up the hand holds and over the ring past the arcing antennas.',
  },
  box: (k, rng) => {
    const struct = structCols(k, rng, RING_MIN, [17, 23], true);
    const Ro = Math.min(9, Math.floor((struct - 2) / 2));
    return { w: crossFor(k, RING_MIN) + ARM + struct, h: deckBox(k, 2 * Ro + 1) };
  },
  build: buildRing,
  pieces: (rng, s, l) => ringPieces(rng, s, l),
});

// ------------------------------------------------------------------------------------------------ planetoid

const PLANET_MIN = 19;
/** Columns of void either side of the planetoid that its moon passes through. */
const ORBIT_GAP = 4;

function buildPlanetoid(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const { s0, D } = approach(g, rng, at, parts, PLANET_MIN);
  const s1 = at.x + at.w - 1;
  const above = D - at.y;
  const Rp = Math.max(4, Math.min(7, Math.floor((s1 - s0 + 1 - 2 * ORBIT_GAP - 1) / 2), above - 6, SPACE_UNDER - 1 + 1));
  const cx = s0 + ORBIT_GAP + Rp;
  const cy = D - 1;
  // A lumpy little world: its radius wanders a little round the rim, never below the tunnel's roof.
  const n = noise1D(rng, 24, 6, 2, 0.5);
  const radius = (x: number, y: number) => Rp + 0.35 + 0.45 * n[(Math.round(((datan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI)) * 23) + 24) % 24];
  for (let y = cy - Rp - 1; y <= cy + Rp + 1; y++)
    for (let x = cx - Rp - 1; x <= cx + Rp + 1; x++) if (dist(x, y, cx, cy) <= radius(x, y)) g.set(x, y, 1, true);
  // The tunnel through its equator, its floor on the deck row.
  for (let x = cx - Rp - 1; x <= cx + Rp + 1; x++) g.clear(x, D - DOOR, x, D - 1);
  for (let x = cx - Rp; x <= cx + Rp; x++) g.set(x, D, 1, true);
  // A crater or two on top: a notch a column or two wide, never at the summit.
  const craters: number[] = [];
  for (let i = rng.int(0, 2); i > 0; i--) {
    const x = cx + rng.pick([-1, 1]) * rng.int(2, Math.max(2, Rp - 2));
    let y = 0;
    while (y < D && g.empty(x, y)) y++;
    if (y < D - DOOR - 2) {
      g.clear(x, y, x, y);
      craters.push(x - cx);
    }
  }
  // Rungs at the gangway's end for the climb onto it.
  const holds = rungs(g, s0 - 2, cy - Rp - 1, D);
  const Rm = Rp + 3;
  return {
    concept: 'planetoid',
    rect: { x: at.x, y: Math.max(0, cy - Rm - 1), w: at.w, h: Math.min(g.h - 1, cy + Rm + 1) - Math.max(0, cy - Rm - 1) + 1 },
    air: [
      { x: s0, y: cy - Rm - 1, w: ORBIT_GAP, h: 2 * Rm + 3 },
      { x: cx + Rp + 1, y: cy - Rm - 1, w: ORBIT_GAP, h: 2 * Rm + 3 },
      { x: cx - Rp, y: D - DOOR, w: 2 * Rp + 1, h: DOOR },
    ],
    anchors: {
      deck: [D, 0],
      exit: [s1 + 1, D],
      planet: [cx, cy],
      radii: [Rp, Rm],
      ...ways([
        { x: cx, y: 0, w: 1, h: cy - Rp - 1 },
        { x: cx, y: D - DOOR, w: 1, h: DOOR },
      ]),
      sig0: [Rp, holds.length],
      sig1: [craters.length, craters.reduce((t, v, i) => t + v * (i + 1), 0)],
      sig2: [s1 - s0, R],
    },
    skin: 'regolith',
  };
}

function* planetoidPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const [cx, cy] = l.anchors.planet;
  const [Rp, Rm] = l.anchors.radii;
  const [D] = l.anchors.deck;
  // The moon on its orbit (one, or two opposite), passing through the hops on and off the planetoid. It's
  // a ride over the top for anyone who catches it.
  yield {
    name: rng.pick(['Little Moon', 'Moonlet', 'The Orbit', 'Tiny Satellite']),
    archetype: 'platform',
    role: 'build',
    style: ROCK(rng),
    modules: [
      shell(rng, [cx - Rm - 1, cy - Rm - 1], 2 * Rm + 3, 2 * Rm + 3),
      {
        type: 'rotor',
        look: 'moon',
        support: 'none',
        mastX: 0,
        hub: [cx + 0.5, cy + 0.5],
        arm: Rm,
        count: rng.chance(0.35) ? 2 : 1,
        angle0: rng.range(0, Math.PI * 2),
        period: rng.int(520, 720),
        swing: 0,
        dir: rng.chance(0.5) ? 1 : -1,
        width: 2,
        thick: 1,
        material: 'stone',
        seed: rng.int(0, 1 << 20),
      },
    ],
    crushOk: true,
  };
  // A vent of its molten core in the tunnel floor, off the middle.
  const vx = cx + rng.pick([-1, 1]) * rng.int(1, Math.max(1, Rp - 2));
  yield {
    name: rng.pick(['Core Vent', 'Planet Burp', 'Molten Core', 'Hot Spring']),
    archetype: 'flamer',
    role: 'hazard',
    style: ROCK(rng),
    modules: [
      {
        type: 'geyser',
        look: 'lava',
        at: [vx + 0.5, D],
        angle: UP,
        width: 0.95,
        length: DOOR,
        off: rng.int(120, 170),
        warn: rng.int(40, 55),
        on: rng.int(40, 60),
        lethal: true,
        strength: 0,
      },
    ],
  };
}

export const PLANETOID = defineConcept({
  id: 'planetoid',
  footing: 'floating',
  varies: ['planet radius and how lumpy it is', 'craters', 'one moon or two, and their orbit', 'where the core vents'],
  weight: 3,
  // Its moon needs room to orbit clear of the gangway: a classic level at space's gravity has none.
  sizes: ['wide'],
  fits: (p) => roomFor(p, PLANET_MIN),
  ownsCrossing: true,
  family: ['meteor shower', 'solar flare', 'fuel cells', 'turret'],
  names: ['The Planetoid of {place}', 'Little {place}', 'The World of {place}', '{place} Minor'],
  codex: {
    about: 'A lumpy little world with a moon of its own. Through the tunnel past the vent of its molten core, or over the top. Catch the moon for a lift.',
  },
  box: (k, rng) => {
    const struct = structCols(k, rng, PLANET_MIN, [19, 25]);
    const Rp = Math.min(7, Math.floor((struct - 2 * ORBIT_GAP - 1) / 2));
    return { w: crossFor(k, PLANET_MIN) + ARM + struct, h: deckBox(k, Rp + 6) };
  },
  build: buildPlanetoid,
  pieces: (rng, _s, l) => planetoidPieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ launch gantry

const GANTRY_MIN = 11;
/** The rocket's width. */
const ROCKET_W = 3;
/** Rows its nose stands over the body. */
export const NOSE_ROWS = 2;
/** Height of each of the nose's and the fins' collision steps, in tiles (2 world px): the curve stays within a pixel of them. */
const STEP = 1 / 8;

/** The nose's half width `v` of the way up it (0 its foot, 1 its tip), in tiles: an ogive off the body's full width. */
export function noseHalf(v: number): number {
  return (ROCKET_W / 2) * (1 - v * v);
}

/**
 * A fin's top `u` of the way out from the body (0 against it, 1 its tip), in tiles down from the top of its cell:
 * the leading edge swept down and out. Its bottom is the cell's.
 */
export function finTop(u: number): number {
  return 0.1 + 0.62 * u;
}

/**
 * The nose, fins and escape tower as sub-tile solids, so they collide as the shapes they're drawn as rather than
 * as tiles (docs/ART.md, Fair play): each curve stepped every 2 px, a step's width taken at its middle.
 */
function rocketTrim(rx0: number, rt: number, base: number, fins: boolean, tower: boolean): Module[] {
  const body = (cells: Vec[], shape: [number, number, number, number][]): Module => ({
    type: 'body',
    cells,
    material: 'metal',
    conveyor: 0,
    breakFrames: 0,
    respawnFrames: 0,
    shape,
  });
  const cx = rx0 + ROCKET_W / 2;
  const n = NOSE_ROWS / STEP;
  const nose: [number, number, number, number][] = [];
  for (let k = 0; k < n; k++) {
    const h = noseHalf((k + 0.5) / n);
    nose.push([cx - h, rt - (k + 1) * STEP, h * 2, STEP]);
  }
  const noseCells: Vec[] = [];
  for (let y = rt - NOSE_ROWS; y < rt; y++) for (let x = rx0; x < rx0 + ROCKET_W; x++) noseCells.push([x, y]);
  const out = [body(noseCells, nose)];
  if (fins)
    for (const side of [-1, 1] as const) {
      const fx = side < 0 ? rx0 - 1 : rx0 + ROCKET_W;
      const fin: [number, number, number, number][] = [];
      for (let k = 0; k < 1 / STEP; k++) {
        const top = finTop((k + 0.5) * STEP);
        fin.push([side < 0 ? fx + 1 - (k + 1) * STEP : fx + k * STEP, base + top, STEP, 1 - top]);
      }
      out.push(body([[fx, base]], fin));
    }
  // The escape tower: a lattice mast a third of a tile wide on the nose's tip.
  if (tower) out.push(body([[rx0 + 1, rt - NOSE_ROWS - 1]], [[cx - 0.18, rt - NOSE_ROWS - 1 + 0.1, 0.36, 0.9]]));
  return out;
}

function buildGantry(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const { s0, D } = approach(g, rng, at, parts, GANTRY_MIN);
  const s1 = at.x + at.w - 1;
  const above = D - at.y;
  // The pad: the deck on, a tail of it past the rocket for the drop off its far side.
  g.fill(s0, D, s1, D, 1, true);
  for (let x = s0 + 1; x < s1 - 1; x++) g.set(x, D + 1, 1, true);
  // The service tower: rungs up its near column pair, a lift shaft beside them, the access arm across.
  const tail = rng.int(2, Math.max(2, s1 - s0 + 1 - 4 - ROCKET_W - 1));
  const rx0 = s1 - tail - ROCKET_W + 1;
  const rx1 = rx0 + ROCKET_W - 1;
  // The rocket stands on its clamps over the flame trench (a runner's height of air at deck level).
  const base = D - DOOR - 1;
  const rh = Math.max(4, Math.min(above - DOOR - 5, rng.int(2, 3) * R + rng.int(0, 2)));
  const rt = base - rh + 1;
  g.fill(rx0, rt, rx1, base, 1, true);
  // Fins either side of its foot, a nose and, on some, the escape tower over it: sub-tile solids, the
  // rocket's pieces (rocketTrim), so its terrain is the body alone.
  const fins = rng.chance(0.6);
  const tower = rng.chance(0.5) && rt - NOSE_ROWS - 2 > at.y;
  // The access arm level with the rocket's top, from the tower to its side.
  const shaft = rx0 - s0 >= 5;
  const armX0 = s0 + (shaft ? 4 : 2);
  for (let x = armX0; x < rx0 - (fins ? 0 : 0); x++) g.set(x, rt, T_ONEWAY, true);
  const holds = rungs(g, s0, rt, D);
  // The last rung up to the arm itself where the tower is taller than a step.
  if (!holds.length || holds[holds.length - 1] - rt > R) for (const c of [s0, s0 + 1]) g.set(c, rt, T_ONEWAY, true);
  const mid = rx0 + 1;
  return {
    concept: 'launch-gantry',
    rect: { x: at.x, y: Math.max(0, rt - 4), w: at.w, h: D + 2 - Math.max(0, rt - 4) + 1 },
    air: [
      { x: rx0 - 1, y: D - DOOR, w: ROCKET_W + 2, h: DOOR },
      ...(shaft ? [{ x: s0 + 2, y: rt, w: 2, h: D - rt }] : []),
      // The nose's and the fins' cells: open in the terrain, their pieces' to fill.
      { x: rx0, y: rt - NOSE_ROWS - (tower ? 1 : 0), w: ROCKET_W, h: NOSE_ROWS + (tower ? 1 : 0) },
      ...(fins
        ? [
            { x: rx0 - 1, y: base, w: 1, h: 1 },
            { x: rx1 + 1, y: base, w: 1, h: 1 },
          ]
        : []),
    ],
    anchors: {
      deck: [D, 0],
      exit: [s1 + 1, D],
      pad: [s0, s1],
      rocket: [rx0, rt],
      base: [base, rh],
      trim: [fins ? 1 : 0, tower ? 1 : 0],
      shaft: [shaft ? s0 + 2 : -1, rt],
      ...ways([
        { x: mid, y: 0, w: 1, h: rt - NOSE_ROWS - (tower ? 1 : 0) },
        { x: mid, y: D - DOOR, w: 1, h: DOOR },
      ]),
      sig0: [rh, tail],
      sig1: [fins ? 1 : 0, tower ? 1 : 0],
      sig2: [shaft ? 1 : 0, holds.length],
    },
    skin: 'metal',
  };
}

function* gantryPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const [s0, s1] = l.anchors.pad;
  const [rx0, rt] = l.anchors.rocket;
  const [base] = l.anchors.base;
  const [D] = l.anchors.deck;
  const [sx] = l.anchors.shaft;
  const [fins, tower] = l.anchors.trim;
  // The rocket's nose, fins and escape tower: its shape, so they're its own piece, nothing to place round.
  yield {
    name: rng.pick(['The Rocket', 'Flight Hardware', 'Payload', 'Do Not Climb']),
    archetype: 'platform',
    role: 'build',
    style: HULL(rng),
    modules: rocketTrim(rx0, rt, base, fins > 0, tower > 0),
  };
  // The engine test-firing down into the trench under the rocket, with the tower, clamps, umbilicals and
  // the rocket's paint behind it all.
  yield {
    name: rng.pick(['Engine Test', 'Static Fire', 'Ignition Sequence', 'Do Not Stand Here']),
    archetype: 'flamer',
    role: 'hazard',
    style: HULL(rng),
    modules: [
      shell(rng, [s0, rt - 4], s1 - s0 + 1, D - rt + 6),
      {
        type: 'geyser',
        look: 'lava',
        at: [rx0 + ROCKET_W / 2, base + 1],
        angle: DOWN,
        width: ROCKET_W - 1,
        length: DOOR,
        off: rng.int(130, 190),
        warn: rng.int(45, 60),
        on: rng.int(45, 70),
        lethal: true,
        strength: 0,
      },
    ],
  };
  // Liquid oxygen venting off its flank onto the tower: it doesn't burn, it shoves you off the rungs.
  const vy = rt + Math.max(1, Math.floor((base - rt) / 2));
  yield {
    name: rng.pick(['LOX Vent', 'Boil-Off', 'Cold Snap', 'Venting']),
    archetype: 'fan',
    role: 'hazard',
    style: HULL(rng),
    modules: [
      {
        type: 'geyser',
        look: 'steam',
        at: [rx0, vy + 0.5],
        angle: Math.PI,
        width: 1,
        length: Math.max(2, rx0 - s0 - 1),
        off: rng.int(140, 200),
        warn: rng.int(30, 45),
        on: rng.int(50, 80),
        lethal: false,
        strength: rng.int(1600, 2200),
      },
    ],
  };
  // The service lift up the tower's shaft, parked flush with the pad and with the access arm.
  if (sx >= 0)
    yield {
      name: rng.pick(['Service Lift', 'Crew Elevator', 'Going Up', 'Rickety Lift']),
      archetype: 'platform',
      role: 'build',
      style: HULL(rng),
      modules: [
        {
          type: 'body',
          cells: [
            [sx, D - 1],
            [sx + 1, D - 1],
          ],
          material: 'metal',
          conveyor: 0,
          breakFrames: 0,
          respawnFrames: 0,
        },
      ],
      motion: { type: 'rail', angle: UP, range: D - 1 - rt, period: rng.int(260, 340), dwell: rng.int(70, 100) },
      crushOk: true,
    };
}

export const LAUNCH_GANTRY = defineConcept({
  id: 'launch-gantry',
  footing: 'floating',
  varies: ['rocket height', 'fins and escape tower', 'the pad past it', 'a lift shaft or none', 'engine and vent timing'],
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, GANTRY_MIN),
  ownsCrossing: true,
  family: ['turret', 'meteor shower', 'fuel cells', 'airlock', 'comm array'],
  names: ['The Launch Pad at {place}', '{place} Launch Complex', 'The Gantry of {place}', 'Pad 39 {place}'],
  codex: {
    about:
      'A rocket on its clamps beside its service tower. Under the rocket while the engine isn’t test-firing, or up the tower and across the access arm over the nose.',
  },
  box: (k, rng) => {
    const struct = structCols(k, rng, GANTRY_MIN, [12, 16]);
    return { w: crossFor(k, GANTRY_MIN) + ARM + struct, h: deckBox(k, DOOR + 1 + 3 * easyRise() + 2 + 6) };
  },
  build: buildGantry,
  pieces: (rng, _s, l) => gantryPieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ mining rig

const RIG_MIN = 12;

function buildRig(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark {
  const R = easyRise();
  const { s0, D } = approach(g, rng, at, parts, RIG_MIN);
  const s1 = at.x + at.w - 1;
  const above = D - at.y;
  // A long lumpy rock: its top a few rows over the bore, its belly hanging under the deck.
  const c0 = s0 + 2;
  const rx = (s1 - c0) / 2;
  const cx = c0 + rx;
  const hi = Math.max(DOOR + 3, Math.min(above - 7, DOOR + rng.int(3, 3 + Math.max(1, R - 1))));
  const lo = rng.int(3, SPACE_UNDER - 1);
  const n = noise1D(rng, s1 - c0 + 1, rng.int(3, 5), 2, 0.5);
  const tops: number[] = [];
  for (let x = c0; x <= s1; x++) {
    const u = (x - cx) / (rx + 0.6);
    const k = Math.sqrt(Math.max(0, 1 - u * u));
    const up = Math.max(DOOR + 1, Math.round(DOOR + 1 + (hi - DOOR - 1) * k + n[x - c0] * 1.2));
    const down = Math.max(1, Math.round(lo * k));
    g.fill(x, D - up, x, D + down - 1, 1, true);
    tops.push(D - up);
  }
  g.fill(s0, D, c0, D, 1, true);
  // The bore through it, and the drill shaft from its crown down into the bore.
  g.clear(c0, D - DOOR, s1, D - 1);
  const dx = Math.round(cx) + rng.pick([-1, 0]) + (rng.chance(0.5) ? -Math.floor(rx / 3) : Math.floor(rx / 3));
  const surf = Math.min(tops[dx - c0], tops[dx + 1 - c0]);
  g.clear(dx, 0, dx + 1, D - DOOR - 1);
  const holds = rungs(g, s0, Math.min(...tops.slice(0, 3)) - 1, D);
  const mid = dx + (dx - c0 > s1 - dx ? -2 : 3);
  return {
    concept: 'mining-rig',
    rect: { x: at.x, y: Math.max(0, surf - 7), w: at.w, h: D + lo + 1 - Math.max(0, surf - 7) },
    air: [
      { x: dx, y: surf - 6, w: 2, h: D - surf + 6 },
      { x: c0, y: D - DOOR, w: s1 - c0 + 1, h: DOOR },
    ],
    anchors: {
      deck: [D, 0],
      exit: [s1 + 1, D],
      rock: [c0, s1],
      shaft: [dx, surf],
      ...ways([
        { x: mid, y: 0, w: 1, h: tops[mid - c0] },
        { x: mid, y: D - DOOR, w: 1, h: DOOR },
      ]),
      sig0: [hi, lo],
      sig1: [dx - c0, holds.length],
      sig2: [s1 - c0, R],
    },
    skin: 'regolith',
  };
}

function* rigPieces(rng: Rng, l: Landmark): Generator<Piece> {
  const [c0, s1] = l.anchors.rock;
  const [dx, surf] = l.anchors.shaft;
  const [D] = l.anchors.deck;
  // The drill bit: parked up in the derrick, it plunges down the shaft into the bore and back, cutting
  // across the way over the rock and the way through it.
  const top = surf - 5;
  yield {
    name: rng.pick(['Core Drill', 'The Big Bit', 'Deep Bore', 'Rock Muncher']),
    archetype: 'saw',
    role: 'hazard',
    style: ROCK(rng),
    modules: [{ type: 'swinger', head: 'saw', hub: [dx + 1, top + 0.5], arm: 0, angle0: 0, period: 40, swing: 0, dir: 1, radius: 0.9, count: 1, link: 'none' }],
    motion: { type: 'rail', angle: DOWN, range: D - 2 - top, period: rng.int(300, 380), dwell: rng.int(60, 90) },
  };
  // An ore hauler driving the bore floor on some, else a plasma cutter's flame across it; with the derrick,
  // its lights and the bore's ribs behind it all (a shell holds still, so it rides with neither).
  const back = shell(rng, [c0 - 2, surf - 7], s1 - c0 + 3, D - surf + 8);
  const long = dx - c0 > s1 - dx;
  const from = long ? c0 + 1 : dx + 3;
  const to = long ? dx - 2 : s1 - 1;
  if (to - from >= 4 && rng.chance(0.5)) {
    yield {
      name: rng.pick(['Ore Hauler', 'Rock Truck', 'Space Dumper', 'Haul Road']),
      archetype: 'crusher',
      role: 'hazard',
      style: ROCK(rng),
      modules: [
        back,
        {
          type: 'vehicle',
          look: 'minecart',
          at: [from, D],
          cols: [1.2, 1.2],
          colW: 1,
          span: to - from - 1,
          speed: rng.range(2, 3),
          pause: rng.int(50, 90),
          hurt: 'lead',
          flip: rng.chance(0.5),
          seed: rng.int(0, 1 << 20),
        },
      ],
    };
    return;
  }
  const fx = long ? c0 + 1 : s1 - 1;
  yield {
    name: rng.pick(['Plasma Cutter', 'Rock Torch', 'Hot Knife', 'Slag Lance']),
    archetype: 'flamer',
    role: 'hazard',
    style: ROCK(rng),
    modules: [
      back,
      {
        type: 'flame',
        at: [fx + 0.5, D - DOOR + 0.02],
        angle: DOWN,
        length: DOOR - 0.1,
        on: rng.int(40, 60),
        off: rng.int(130, 180),
        warn: rng.int(40, 52),
      },
    ],
  };
}

export const MINING_RIG = defineConcept({
  id: 'mining-rig',
  footing: 'floating',
  varies: ['rock length, height and belly', 'its lumps', 'where the drill shaft is', 'a hauler or a cutter in the bore', 'drill timing'],
  weight: 2,
  sizes: ['classic', 'wide'],
  fits: (p) => roomFor(p, RIG_MIN),
  ownsCrossing: true,
  family: ['meteor shower', 'fuel cells', 'solar flare', 'turret'],
  names: ['The Mining Rig of {place}', '{place} Diggings', 'The Asteroid Mine at {place}', 'Claim {place}'],
  codex: { about: 'A long asteroid bored through, a drill plunging down its shaft. Through the bore past the hauler or the cutter, or over the rock.' },
  box: (k, rng) => {
    const struct = structCols(k, rng, RIG_MIN, [16, 26]);
    return { w: crossFor(k, RIG_MIN) + ARM + struct, h: deckBox(k, DOOR + 3 + easyRise() + 8) };
  },
  build: buildRig,
  pieces: (rng, _s, l) => rigPieces(rng, l),
});

// ------------------------------------------------------------------------------------------------ registry

export const SPACE_CONCEPTS: Concept[] = [STARSHIP, RING_STATION, PLANETOID, LAUNCH_GANTRY, MINING_RIG];

/** Structure columns per concept, for the crossing a level's box gets room for. */
const STRUCT: Record<string, number> = {
  starship: SHIP_MIN,
  'ring-station': RING_MIN,
  planetoid: PLANET_MIN,
  'launch-gantry': GANTRY_MIN,
  'mining-rig': RIG_MIN,
};

/**
 * How many parts the space landmark's own crossing takes on this attempt, given the level's `challenges`:
 * two where its box made room for a two-part one (and the attempt still insists on two, TWO_PART_TRIES),
 * else one; none when the level asks for none.
 */
export function spaceOwns(c: Concept, k: Knobs, attempt: number, challenges: number): number {
  if (challenges <= 0) return 0;
  const s = STRUCT[c.id];
  return attempt < TWO_PART_TRIES && challenges >= 2 && s !== undefined && crossFor(k, s) >= twoGap() && twoGap() > oneGap() ? 2 : 1;
}
