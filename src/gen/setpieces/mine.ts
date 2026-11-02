import type { Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import { pendulums, vehicles } from './builders';
import { defineSetPiece } from './contract';
import { best, makeStyle, type Piece, type Recipe, SAFE_TILES, type Site } from './place';

/**
 * Mine: runaway minecarts on patrol, a tunnelling drill rig, an ore bucket swinging under a lantern, and
 * three things no other theme has (docs/SETPIECES.md, Mine):
 *
 * - **The cave-in**: a stretch of cracked roof over the route that comes down on a cycle, grit sifting out
 *   of it first (`cavein`, kind `rocks`).
 * - **Firedamp**: a pocket of gas pooled under the roof that a spark sets off, the whole pocket a flash of
 *   fire, the haze thickening first (`cavein`, kind `gas`).
 * - **The runaway cart**: a minecart that breaks loose at the top of its rail, its bell ringing, and
 *   gathers speed all the way to the buffer before the winch hauls it back (`cart`).
 */

/** A span of route under one flat stretch of rock roof: the box from the roof down to the floor. */
export interface RoofSpan {
  x: number;
  /** The roof's underside: the box's top row. */
  top: number;
  w: number;
  /** Rows from the roof to the floor. */
  h: number;
}

/**
 * Spans of the route `w` wide under a flat, low stretch of rock roof (`h` rows from roof to floor, inside
 * `rows`), clear of the spawn and the goal, every cell free.
 */
export function roofSpans(s: Site, w: readonly [number, number], rows: readonly [number, number]): RoofSpan[] {
  const out: RoofSpan[] = [];
  for (const r of s.groundRuns(2, w[0]))
    for (let x = r.x0; x + w[0] - 1 <= r.x1; x++) {
      if (s.zoneDist(x, r.y) <= SAFE_TILES + 2 || s.zoneDist(x + w[0] - 1, r.y) <= SAFE_TILES + 2) continue;
      const c = s.ceilingAbove(x, r.y + 1, rows[1] + 1);
      if (c < 0) continue;
      const h = r.y - c;
      if (h < rows[0] || h > rows[1]) continue;
      let n = 0;
      while (n < w[1] && x + n <= r.x1 && s.ceilingAbove(x + n, r.y + 1, rows[1] + 1) === c && s.freeRect(x + n, c + 1, x + n, r.y)) n++;
      if (n >= w[0]) out.push({ x, top: c + 1, w: n, h });
    }
  return out;
}

/** The cave-in: rocks out of a cracked stretch of roof over the route. */
function* caveins(rng: Rng, s: Site): Generator<Piece> {
  for (const sp of best(rng, roofSpans(s, [3, 5], [3, 7]), (sp) => sp.w + (s.runReachable({ y: sp.top + sp.h - 1, x0: sp.x, x1: sp.x + sp.w - 1 }) ? 4 : 0)))
    yield {
      name: rng.pick(['Cave-In', 'Loose Roof', 'Bad Timber', 'Rock Shower', 'Hard Hat Area']),
      archetype: 'dropper',
      role: 'hazard',
      style: makeStyle(rng, ['rust', 'steel'], [28]),
      modules: [
        {
          type: 'cavein',
          kind: 'rocks',
          at: [sp.x, sp.top],
          w: sp.w,
          h: sp.h,
          off: rng.int(150, 240),
          warn: rng.int(52, 70),
          on: rng.int(40, 56),
          seed: rng.int(0, 1 << 20),
        },
      ],
    };
}

/** Firedamp: a pocket of gas under the roof over the route that a spark lights. */
function* firedamp(rng: Rng, s: Site): Generator<Piece> {
  for (const sp of best(rng, roofSpans(s, [3, 4], [3, 6]), (sp) => sp.h))
    yield {
      name: rng.pick(['Firedamp', 'Gas Pocket', 'Mind The Lamp', 'Swamp Breath', 'Do Not Strike']),
      archetype: 'flamer',
      role: 'hazard',
      style: makeStyle(rng, ['rust', 'brass'], [60]),
      modules: [
        {
          type: 'cavein',
          kind: 'gas',
          at: [sp.x, sp.top],
          w: sp.w,
          h: sp.h,
          off: rng.int(170, 260),
          warn: rng.int(60, 80),
          on: rng.int(26, 36),
          seed: rng.int(0, 1 << 20),
        },
      ],
    };
}

/** The runaway cart: a flat stretch of route long enough to roll down, rail laid along it. */
function* runaways(rng: Rng, s: Site): Generator<Piece> {
  const spots: { at: Vec; span: number; dir: 1 | -1 }[] = [];
  for (const r of s.groundRuns(2, 8)) {
    if (!s.runReachable(r)) continue;
    const len = r.x1 - r.x0 + 1;
    const span = Math.min(14, len - 2);
    if (span < 6) continue;
    const dir: 1 | -1 = rng.chance(0.5) ? 1 : -1;
    const x0 = r.x0 + rng.int(0, len - 2 - span);
    // Bottom-left of the cart where it's parked: the near end of the stretch it runs.
    spots.push({ at: [dir > 0 ? x0 : x0 + span, r.y + 1], span, dir });
  }
  for (const sp of best(rng, spots, (sp) => sp.span))
    yield {
      name: rng.pick(['Runaway Cart', 'No Brakes', 'Express Ore', 'The 4:15 Downhill', 'Mind The Gap']),
      archetype: 'crusher',
      role: 'hazard',
      style: makeStyle(rng, ['rust', 'steel', 'copper'], [20], { woodHue: rng.range(18, 30) }),
      modules: [
        {
          type: 'cart',
          at: sp.at,
          w: 2,
          h: 1.1,
          span: sp.span,
          dir: sp.dir,
          off: rng.int(130, 210),
          warn: rng.int(54, 72),
          run: Math.round(sp.span * rng.range(4.2, 5.4)),
          back: rng.int(150, 210),
          seed: rng.int(0, 1 << 20),
        },
      ],
    };
}

export const MINE: Recipe[] = [
  {
    name: 'minecart',
    weight: 3,
    role: 'hazard',
    repeat: true,
    candidates: (rng, s) =>
      vehicles(rng, s, {
        name: `${rng.pick(['Runaway', 'Rickety', 'Mandatory'])} Minecart`,
        look: 'minecart',
        style: makeStyle(rng, ['rust', 'steel', 'copper'], [20], { woodHue: rng.range(18, 30) }),
        w: [2, 3],
        cols: (_r, w) => Array.from({ length: w }, () => 1.3),
        speed: [2.6, 4.6],
        pause: [30, 90],
      }),
  },
  {
    name: 'drill',
    weight: 2,
    role: 'hazard',
    candidates: (rng, s) =>
      vehicles(rng, s, {
        name: 'Tunnel Drill',
        look: 'drill',
        style: makeStyle(rng, ['steel', 'rust'], [48, 28, 0], { trim: 'stripes' }),
        w: [3, 3],
        // Cab, engine, drill head (lower; the bit sticks out ahead).
        cols: () => [1.9, 1.6, 1.4],
        speed: [1.3, 2.2],
        pause: [40, 90],
        flip: 0.5,
      }),
  },
  {
    name: 'ore bucket',
    weight: 2,
    role: 'build',
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: 'Ore Bucket',
        look: 'bucket',
        support: 'ceiling',
        style: makeStyle(rng, ['rust', 'steel'], [20], { glowHue: rng.range(30, 45) }),
        arm: [3, 5],
        swing: [0.3, 0.6],
        width: [2, 2],
        thick: 0.75,
        period: [200, 300],
        material: 'metal',
      }),
  },
  defineSetPiece({ name: 'cave-in', unique: true, weight: 2.5, role: 'hazard', repeat: true, candidates: caveins }),
  defineSetPiece({ name: 'firedamp', unique: true, weight: 2, role: 'hazard', candidates: firedamp }),
  defineSetPiece({ name: 'runaway cart', unique: true, weight: 2, role: 'hazard', candidates: runaways }),
];
