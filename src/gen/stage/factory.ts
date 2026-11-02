import type { Vec } from '../../core/geom';
import { T_ONEWAY } from '../../sim/level';
import type { Module } from '../../sim/props';
import { jumpProfile } from '../level/probe';
import { easyRise, hardGap } from '../level/sculptors/common';
import { greatWheel } from '../setpieces/builders';
import { makeStyle, type Piece } from '../setpieces/place';
import { defineConcept } from './contract';
import { BOILER_HOUSE, FOUNDRY, ROBOT_LINE } from './factory-works';
import { roomFor, SITE_MARGIN, vat, widestGap } from './factory-kit';
import type { Concept } from './types';

/**
 * Factory stage concepts (docs/SETPIECES.md, Factory).
 *
 * Both own the level's hard crossing and lay out the same way, left to right: the vat (a `hardGap` pit, the
 * crossing the parts close), then the landmark on its far bank. Past the crossing, nothing the landmark
 * carries can give a bare run a ride over it, and the landmark gets every column the vat doesn't need: a
 * classic level is 48 wide, and a 17-tile wheel beside a separate vat with its banks kept clear doesn't fit.
 *
 * - **The Great Wheel**: a flywheel at least 17 tiles across on an A-frame, its rim carrying level cars you
 *   ride to the roof and its spokes carrying saws between them. Movers are never the proof, so the wheel
 *   stands over two static ways past it: a grated catwalk, and the flywheel pit under it (or, where the
 *   floor is too near the bottom for a pit, the floor under a raised catwalk).
 * - **The Stamping Line**: a row of big presses under a girder, slamming in sequence onto a conveyor bed, so
 *   a sprint that keeps pace with the wave gets through underneath. The girder's top is the static way over,
 *   up ladders of one-way rungs at both ends.
 */

// ---------------------------------------------------------------------------
// The Great Wheel.

/** Smallest wheel: cars ride 7 tiles out, so with their decks it is 17 tiles across. */
const MIN_ARM = 7;
const MAX_ARM = 9;
/** Car deck width (tiles). */
const CAR = 3;
/** Saw blades: radius, and how far inside the rim they ride. */
const SAW = 1.25;
const SAW_INSET = 1.9;
/** Rows above the ground the smallest wheel and its catwalk need (claimSite keeps one more above). */
const WHEEL_ROWS = 2 * MIN_ARM + 4;

/** The biggest wheel a level this size could hold (a classic level has room for the smallest only). */
function wheelArm(W: number, H: number): number {
  if (W <= 48) return MIN_ARM;
  return Math.max(MIN_ARM, Math.min(MAX_ARM, Math.floor((H - 7.2) / 2)));
}

/**
 * Columns a wheel of `arm` sweeps with its hub at a column's centre: the cars' decks out at 9 and 3 o'clock,
 * plus the push room finalize keeps beside a car that moves sideways.
 */
function wheelCols(arm: number): number {
  return 2 * arm + 5;
}

/** Columns (tile centres) where the A-frame under a wheel's axle meets the ground: a wide stance, inside the pit's walls. */
export function wheelFeet(hubX: number, arm: number): [number, number] {
  const spread = Math.floor(arm * 0.78);
  return [hubX - spread, hubX + spread];
}

/** Tiles per second the rim turns at: a majestic crawl, and a ride from the floor to the roof in about eight seconds. */
const RIM_SPEED: readonly [number, number] = [2.6, 3.4];

export const GREAT_WHEEL: Concept = {
  id: 'great-wheel',
  weight: 3,
  sizes: ['classic', 'wide'],
  // A flat floor run: a ramp levelled under a 30-column landmark would leave a wall no jump climbs.
  routes: ['ltr'],
  fits: (p) => roomFor(p, wheelCols(wheelArm(p.w ?? 48, p.h ?? 27))),
  ownsCrossing: true,
  family: ['press', 'forklift'],
  names: ['The Great Wheel of {place}', '{place} Flywheel Works', 'The Big Wheel at {place}', '{place} Wheelhouse'],
  scale: 'grand',
  varies: ['vat width', 'wheel size (wide)', 'cars', 'saws'],
  box: (k, rng) => ({ w: hardGap(rng) + wheelCols(wheelArm(k.W, k.H)), h: WHEEL_ROWS }),
  build(g, _rng, at, parts) {
    const { w: W, h: H } = g;
    const G = at.y + at.h;
    const aMax = wheelArm(W, H);
    const cols = wheelCols(aMax);
    const x0 = at.x;
    const discL = x0 + at.w - cols;
    const discR = x0 + at.w - 1;
    // Open sky over the vat and the wheel: no ceiling, no stamp.
    g.clear(x0, 0, discR, G - 1);
    if (parts > 0) vat(g, x0, discL - 1, G);
    // Two static ways under the wheel: a grated catwalk, and the pit or the floor a jump below it.
    const d = Math.min(H - 1 - G, Math.max(3, Math.min(4, jumpProfile().rise - 1)));
    const pitMode = d >= 3;
    const C = pitMode ? G : G - 3;
    const F = pitMode ? G + d : G;
    // The pit keeps a wall between itself and the vat's undercut far bank.
    const t0 = discL + 3;
    const t1 = discR - 1;
    if (pitMode) {
      g.clear(t0, C + 1, t1, F - 1);
      for (let x = t0; x <= t1; x++) g.set(x, C, T_ONEWAY, true);
    } else g.plank(t0, t1, C);
    // The lowest car passes a short hop over the catwalk; the top one leaves a runner's height under the roof.
    const arm = Math.max(MIN_ARM, Math.min(aMax, Math.floor((C - 3.2) / 2)));
    const hc = discL + aMax + 2;
    const hub: Vec = [hc + 0.5, C - 2 - arm];
    const top = Math.max(0, Math.floor(hub[1] - arm - 2.2));
    const [footL, footR] = wheelFeet(hub[0], arm);
    return {
      concept: 'great-wheel',
      rect: { x: discL, y: top, w: cols, h: H - top },
      air: [{ x: discL, y: top, w: cols, h: C - top }],
      anchors: { hub, rim: [hub[0], hub[1] + arm], footL: [footL, F], footR: [footR, F], catwalk: [t0, C] },
      skin: 'metal',
    };
  },
  *pieces(rng, s, l) {
    const hub = l.anchors.hub;
    const arm = l.anchors.rim[1] - hub[1];
    const cars = arm >= 8 && rng.chance(0.6) ? 8 : 6;
    const saws = cars === 6 ? rng.pick([2, 3]) : rng.pick([2, 4]);
    const turn = (v: number) => Math.round((2 * Math.PI * arm * 60) / v);
    yield* greatWheel(rng, s, {
      name: rng.pick(['Great Wheel', 'Flywheel', 'Big Wheel', 'Prime Mover']),
      style: makeStyle(rng, ['steel', 'rust', 'brass'], [8, 28, 200, 210], { trim: 'rivets' }),
      hub,
      arm,
      cars,
      saws,
      car: CAR,
      saw: SAW,
      inset: SAW_INSET,
      period: [turn(RIM_SPEED[1]), turn(RIM_SPEED[0])],
      shell: l.air[0],
    });
  },
};

// ---------------------------------------------------------------------------
// The Stamping Line.

/** Columns the line takes past its vat (ladder, girder over the presses, ladder): fewest, and the most its seed rolls. A classic level has room for three presses. */
function lineRange(W: number): [number, number] {
  return W <= 48 ? [17, 19] : [23, 28];
}

/** Fewest columns between the girder's ends that still hang three presses. */
const PRESS_ROOM = 11;

/** Tiles per second the slams travel down the line: between a walk and a run, so keeping pace takes a jog. */
const WAVE_SPEED = 9;

export const STAMPING_LINE: Concept = defineConcept({
  id: 'stamping-line',
  weight: 2,
  sizes: ['classic', 'wide'],
  routes: ['ltr'],
  fits: (p) => roomFor(p, lineRange(p.w ?? 48)[0] + 1),
  ownsCrossing: true,
  family: ['forklift', 'cog lift', 'robot arm'],
  names: ['The Stamping Line at {place}', '{place} Press Shop', 'The Pancake Line of {place}', '{place} Panel Works'],
  varies: ['vat width', 'line length', 'girder height', 'where the girder starts and ends', 'a plinth under the bed', 'press width and count'],
  // The widest vat this gravity rolls, then the line: the vat the build digs is rolled inside its columns.
  box: (k, rng) => {
    const [lo, hi] = lineRange(k.W);
    const room = k.W - 2 * SITE_MARGIN - widestGap() - 1;
    return { w: widestGap() + 1 + Math.max(lo, Math.min(room, rng.int(lo, hi))), h: 13 };
  },
  build(g, rng, at, parts) {
    const G = at.y + at.h;
    const lineW = at.w - widestGap() - 1;
    const x0 = at.x;
    const L0 = x0 + at.w - lineW;
    const R = x0 + at.w - 1;
    if (parts > 0) vat(g, L0 - 1 - Math.min(widestGap(), hardGap(rng)), L0 - 2, G);
    // The girder: the presses hang under it, and its top is the way over them. Where the line has columns
    // to spare, an end stands a column in from its ladder.
    const B = G - 8 - rng.int(0, 2);
    g.clear(L0, B - 4, R, G - 1);
    const spare = lineW - 6 - PRESS_ROOM;
    const inL = spare > 0 ? rng.int(0, 1) : 0;
    const inR = spare - inL > 0 ? rng.int(0, 1) : 0;
    const beamL = L0 + 2 + inL;
    const beamR = R - 2 - inR;
    g.fill(beamL, B, beamR, B);
    // The bed: the conveyor on the floor, or up on a plinth a row high on some lines.
    const plinth = rng.int(0, 1);
    if (plinth) g.fill(beamL, G - 1, beamR, G - 1);
    // Ladders of one-way rungs up to it at both ends, a comfortable hop apart, under its ends.
    const r = easyRise();
    for (const lx of [beamL - 2, beamR + 1]) for (let y = G - r; y > B; y -= r) g.plank(lx, lx + 1, y);
    return {
      concept: 'stamping-line',
      rect: { x: L0, y: B - 1, w: lineW, h: G - B + 1 },
      air: [
        { x: beamL, y: B + 1, w: beamR - beamL + 1, h: G - B - 1 },
        { x: L0, y: B - 4, w: lineW, h: 4 },
      ],
      anchors: { beam: [beamL, B], end: [beamR, B], floor: [beamL, G - plinth] },
      skin: 'metal',
    };
  },
  *pieces(rng, _s, l) {
    const [beamL, B] = l.anchors.beam;
    const beamR = l.anchors.end[0];
    const G = l.anchors.floor[1];
    const inner = beamR - beamL - 1;
    const pw = inner >= 20 && rng.chance(0.5) ? 4 : 3;
    // At least three presses: a classic level's line packs them a column apart.
    const pg = Math.floor((inner + 2) / (pw + 2)) >= 3 ? rng.int(1, 2) : 1;
    const n = Math.floor((inner + pg) / (pw + pg));
    const span = n * pw + (n - 1) * pg;
    const first = beamL + 1 + Math.floor((inner - span) / 2);
    const period = rng.int(140, 180);
    // Each press runs a pitch's travel behind the last, so the open stretch rolls down the line; now and then it rolls toward you.
    const lag = (((pw + pg) / WAVE_SPEED) * 60) / period;
    const sign = rng.chance(0.75) ? 1 : -1;
    // Under the head at full stroke: the conveyor bed, one row over the floor.
    const reach = G - 1 - (B + 1.5) - 1;
    const modules: Module[] = [
      { type: 'deco', kind: 'gantry', at: [beamL, B + 1], w: beamR - beamL + 1, h: G - B - 2, seed: rng.int(0, 1 << 20) },
      {
        type: 'body',
        cells: Array.from({ length: beamR - beamL + 1 }, (_, i) => [beamL + i, G - 1] as [number, number]),
        material: 'conveyor',
        conveyor: rng.sign() * rng.int(55, 95),
        breakFrames: 0,
        respawnFrames: 0,
      },
    ];
    for (let i = 0; i < n; i++) {
      const k = sign > 0 ? i : n - 1 - i;
      modules.push({ type: 'piston', at: [first + i * (pw + pg) + pw / 2, B + 1.5], angle: Math.PI / 2, reach, width: pw, period, lag: (k * lag) % 1 });
    }
    const piece: Piece = {
      name: rng.pick(['Stamping Line', 'Press Line', 'Pancake Line']),
      archetype: 'crusher',
      role: 'hazard',
      style: makeStyle(rng, ['steel', 'steel', 'rust'], [48, 200, 0], { trim: 'stripes', glowHue: 0 }),
      crushOk: true,
      modules,
    };
    yield piece;
  },
});

export const FACTORY_CONCEPTS: Concept[] = [GREAT_WHEEL, STAMPING_LINE, FOUNDRY, BOILER_HOUSE, ROBOT_LINE];
