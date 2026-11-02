import { dcos, dsin } from '../../core/dmath';
import type { Rng } from '../../core/rng';
import type { Module, PropStyle } from '../../sim/props';
import { LOG_LEN, LOG_THICK } from '../../sim/props/modules/swinger';
import { cannons, pendulums, vehicles } from './builders';
import { defineSetPiece } from './contract';
import { best, makeStyle, type Piece, type Recipe, SAFE_TILES, type Site } from './place';

/**
 * Jungle: a log swinging on vines to ride, a rolling temple boulder, and three things no other theme has
 * (docs/SETPIECES.md, Jungle):
 *
 * - **Dart idols**: carved totems spitting poison darts along the route (`cannon`, ammo `bolt`).
 * - **Snapjaws**: man-eating plants rooted on the route, their traps snapping shut on whoever lingers
 *   over them (`snapper` on a root stump; the jungle skin draws the plant).
 * - **Log traps**: a spiked log slung level on two ropes from the canopy, battering along its whole
 *   length across a walkway (`swinger`, head `log`).
 */

const DOWN = Math.PI / 2;
const UP = -Math.PI / 2;

const leafy = (rng: Rng): PropStyle => makeStyle(rng, 'jade', [100, 120, 140], { woodHue: rng.range(20, 32), glowHue: rng.range(80, 130) });

/**
 * One snapjaw on the stand cell (x, y): a root stump in the cell, its trap on top. It snaps when someone
 * comes over it, after the trap's leaves twitch for `warn` frames. Shared with the landmarks.
 */
export function snapjaw(rng: Rng, x: number, y: number): Module[] {
  return [
    { type: 'body', cells: [[x, y]], material: 'wood', conveyor: 0, breakFrames: 0, respawnFrames: 0 },
    { type: 'snapper', cells: [[x, y]], angle: UP, warn: rng.int(22, 30), up: rng.int(30, 44), cool: rng.int(60, 90) },
  ];
}

/** A bed of snapjaws on the route: one to three plants a hop apart along a run of open ground. */
function* snapjaws(rng: Rng, s: Site): Generator<Piece> {
  const spots: { x: number; y: number; n: number; score: number }[] = [];
  for (const r of s.groundRuns(3, 3))
    for (let x = r.x0 + 1; x <= r.x1 - 1; x++) {
      if (!s.solid(x, r.y + 1) || s.zoneDist(x, r.y) <= SAFE_TILES + 2) continue;
      // Room for more plants further along the run, each three columns on.
      let n = 1;
      while (n < 3 && x + 3 * n <= r.x1 - 1 && s.solid(x + 3 * n, r.y + 1) && s.zoneDist(x + 3 * n, r.y) > SAFE_TILES + 2) n++;
      spots.push({ x, y: r.y, n, score: (s.reachable(x, r.y) ? 2 : 0) + n * 0.4 });
    }
  for (const c of best(rng, spots, (c) => c.score)) {
    const n = rng.int(1, c.n);
    yield {
      name: rng.pick(['Snapjaw', 'Man-Eating Plant', 'Feed Me', 'Green Thumbs Down', 'Venus Mantrap']),
      archetype: 'snapper',
      role: 'hazard',
      style: leafy(rng),
      modules: Array.from({ length: n }, (_, i) => snapjaw(rng, c.x + 3 * i, c.y)).flat(),
    };
  }
}

/** The cells a log slung from (hx, hy) on `arm` sweeps over its swing, sampled (tiles, with its box). */
function logSweep(hx: number, hy: number, arm: number, swing: number, radius: number): [number, number][] {
  const out: [number, number][] = [];
  const L = radius * LOG_LEN;
  const T = radius * LOG_THICK;
  for (let k = -6; k <= 6; k++) {
    const a = DOWN + (swing * k) / 6;
    const cx = hx + dcos(a) * arm;
    const cy = hy + dsin(a) * arm;
    for (let y = Math.floor(cy - T / 2); y <= Math.floor(cy + T / 2); y++)
      for (let x = Math.floor(cx - L / 2); x <= Math.floor(cx + L / 2); x++) out.push([x, y]);
  }
  return out;
}

/** A spiked log on two ropes from a ceiling (the canopy, a branch, a temple lintel), battering across a walkway. */
function* logTraps(rng: Rng, s: Site): Generator<Piece> {
  // A wide, slow swing: the log is longer than an axe is wide, so only the time it hangs out at either end
  // of its swing leaves a window under the middle.
  const arm = rng.range(3.6, 4.8);
  const radius = rng.range(0.75, 0.9);
  const swing = rng.range(1, 1.15);
  const spots: { x: number; y: number; score: number }[] = [];
  for (let y = 1; y < s.h - arm - 2; y++)
    for (let x = 3; x < s.w - 3; x++) {
      if (!s.solid(x, y - 1) || !s.free(x, y)) continue;
      const cells = logSweep(x + 0.5, y + 0.3, arm, swing, radius);
      if (!cells.every(([cx, cy]) => s.free(cx, cy)) || cells.some(([cx, cy]) => s.zoneDist(cx, cy) <= SAFE_TILES)) continue;
      // It should batter someone walking under it: the bottom of its swing at a runner's height over the ground.
      const low = Math.floor(y + 0.3 + arm);
      let under = 0;
      for (let i = -1; i <= 1; i++) if (s.reachable(x + i, low) || s.reachable(x + i, low + 1)) under++;
      spots.push({ x, y, score: under ? 3 + under * 0.4 : 0 });
    }
  for (const c of best(rng, spots, (c) => c.score)) {
    yield {
      name: rng.pick(['Log Trap', 'The Battering Log', 'Timber!', 'Swinging Spike Log', 'Knock on Wood']),
      archetype: 'flail',
      role: 'hazard',
      style: leafy(rng),
      modules: [
        {
          type: 'swinger',
          head: 'log',
          hub: [c.x + 0.5, c.y + 0.3],
          arm,
          angle0: DOWN,
          period: rng.int(215, 250),
          swing,
          dir: 1,
          radius,
          count: 1,
          link: 'rod',
        },
      ],
    };
  }
}

export const JUNGLE: Recipe[] = [
  {
    name: 'log swing',
    weight: 3,
    role: 'build',
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: 'Log Ride',
        look: 'log',
        support: 'ceiling',
        style: makeStyle(rng, 'jade', [110], { woodHue: rng.range(20, 32) }),
        arm: [3.5, 6],
        swing: [0.5, 0.85],
        width: [3, 4],
        period: [180, 260],
        material: 'wood',
      }),
  },
  {
    name: 'boulder',
    weight: 2,
    role: 'hazard',
    candidates: (rng, s) =>
      vehicles(rng, s, {
        name: 'Chase-Scene Boulder',
        look: 'boulder',
        style: makeStyle(rng, 'jade', [30, 90, 200], { glowHue: rng.range(120, 170) }),
        w: [2, 3],
        cols: (_r, w) => (w === 2 ? [1.75, 1.75] : [2.4, 2.9, 2.4]),
        speed: [2, 3.4],
        pause: [30, 80],
      }),
  },
  defineSetPiece({
    name: 'dart idol',
    unique: true,
    weight: 2,
    role: 'hazard',
    repeat: true,
    candidates: (rng, s) =>
      cannons(rng, s, {
        name: 'Cursed Idol',
        look: 'totem',
        style: makeStyle(rng, 'jade', [100, 30], { glowHue: rng.pick([120, 150, 40]), woodHue: rng.range(18, 30) }),
        ammo: 'bolt',
        speed: [200, 260],
        interval: [110, 170],
        burst: [1, 3],
        elev: [0, 0.04],
        length: 0.95,
      }),
  }),
  defineSetPiece({ name: 'snapjaw', unique: true, weight: 2, role: 'hazard', repeat: true, candidates: snapjaws }),
  defineSetPiece({ name: 'log trap', unique: true, weight: 2, role: 'hazard', candidates: logTraps }),
];
