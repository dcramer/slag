import type { Cell } from '../../core/geom';
import type { Rng } from '../../core/rng';
import { TILE } from '../../sim/constants';
import { type Module, traceShot } from '../../sim/props';
import { cannons, geysers, pendulums } from './builders';
import { defineSetPiece } from './contract';
import { best, makeStyle, type Piece, type Recipe, SAFE_TILES, type Site } from './place';

/**
 * Glacier: a frost vent that throws you up, a chairlift, a serac hanging off the cave roof, and three things
 * no other theme has (docs/SETPIECES.md, Glacier):
 *
 * - **The frost cannon**: a cannon that fires frost, freezing whoever it hits (`cannon`, ammo `frost`).
 * - **The avalanche**: a snow cornice on a ledge that lets go of a snowball now and then, which rolls along
 *   the ground, off ledges and down steps, until a wall or a crevasse takes it (`cannon`, ammo `snowball`).
 * - **Thin ice**: ice over a flooded crevasse, flush with the floor, that cracks and gives way on a cycle,
 *   and whoever's on it goes through (`thaw`).
 */

/** The avalanche's snowball leaving a cornice at stand cell (x, y), rolling toward `d`: the cannon module. */
export function cornice(rng: Rng, x: number, y: number, d: 1 | -1, speed = rng.int(70, 110)): Module {
  return {
    type: 'cannon',
    look: 'ship',
    at: [x + 0.5, y + 0.45],
    angle: d > 0 ? 0 : Math.PI,
    ammo: 'snowball',
    interval: rng.int(170, 260),
    burst: 1,
    speed,
    length: 0.8,
    seed: rng.int(0, 1 << 20),
  };
}

/** Where a snowball from a cornice at (x, y) rolling toward `d` goes: the cells it passes through, in order. */
export function rollCells(s: Site, x: number, y: number, d: 1 | -1, speed: number): Cell[] {
  const path = traceShot(s.level, { x: (x + 0.5 + 0.8 * d) * TILE, y: (y + 0.45) * TILE, vx: d * speed, vy: 0, owner: -1, ammo: 'snowball' }, 180);
  const out: Cell[] = [];
  for (const q of path) {
    const c: Cell = [Math.floor(q.x / TILE), Math.floor(q.y / TILE)];
    const l = out[out.length - 1];
    if (!l || l[0] !== c[0] || l[1] !== c[1]) out.push(c);
  }
  return out;
}

/**
 * The avalanche: a cornice on the edge of a ledge, near where the ground drops away, whose snowballs roll
 * off it and on down along the floor below, over stand cells (the route) the whole way.
 */
function* avalanches(rng: Rng, s: Site): Generator<Piece> {
  const speed = rng.int(70, 110);
  const spots: { x: number; y: number; d: 1 | -1; hits: number; drop: number }[] = [];
  for (let y = 3; y < s.h - 2; y++)
    for (let x = 2; x < s.w - 2; x++)
      for (const d of [1, -1] as const) {
        if (!(s.free(x, y) && s.free(x - d, y) && s.free(x, y - 1) && s.ground(x, y + 1) && s.ground(x - d, y + 1))) continue;
        if (s.zoneDist(x, y) <= SAFE_TILES + 1) continue;
        // A cornice hangs over an edge: the ground ends within a few columns ahead.
        let edge = false;
        for (let k = 1; k <= 5 && !edge; k++) {
          if (s.solid(x + k * d, y)) break;
          if (!s.ground(x + k * d, y + 1)) edge = true;
        }
        if (!edge) continue;
        const cells = rollCells(s, x, y, d, speed);
        let hits = 0;
        let low = y;
        for (const [cx, cy] of cells) {
          if (s.reachable(cx, cy)) hits++;
          low = Math.max(low, cy);
        }
        if (hits >= 4 && low > y) spots.push({ x, y, d, hits, drop: low - y });
      }
  for (const c of best(rng, spots, (c) => Math.min(4, c.hits / 3) + Math.min(2, c.drop / 3)))
    yield {
      name: rng.pick(['Avalanche!', 'Snowball Effect', 'Cornice', 'Downhill Express', 'Look Out Below']),
      archetype: 'launcher',
      role: 'hazard',
      style: makeStyle(rng, 'bone', [205], { woodHue: rng.range(20, 30) }),
      extra: [[c.x - c.d, c.y]],
      modules: [cornice(rng, c.x, c.y, c.d, speed)],
    };
}

/** Thin ice over the cells `cells` (one row, flush with the floor), the water under it `depth` rows deep. */
export function thinIce(rng: Rng, cells: Cell[], depth: number): Module {
  return {
    type: 'thaw',
    cells,
    depth,
    frozen: rng.int(150, 230),
    warn: rng.int(40, 56),
    open: rng.int(90, 140),
    seed: rng.int(0, 1 << 20),
  };
}

/**
 * Thin ice: a narrow crevasse (a hop wide) in the route, banks of solid ground level either side, iced
 * over flush with them.
 */
function* thinIces(rng: Rng, s: Site): Generator<Piece> {
  const spots: { x0: number; x1: number; y: number; depth: number }[] = [];
  for (let y = 4; y < s.h - 1; y++)
    for (let x = 1; x < s.w - 2; x++) {
      if (!s.solid(x - 1, y) || !s.free(x, y) || !s.reachable(x - 1, y - 1)) continue;
      let e = x;
      while (e + 1 < s.w && s.free(e + 1, y) && e - x < 5) e++;
      const w = e - x + 1;
      if (w < 2 || w > 5 || !s.solid(e + 1, y) || !s.reachable(e + 1, y - 1)) continue;
      if (s.zoneDist(x, y) <= SAFE_TILES + 1 || s.zoneDist(e, y) <= SAFE_TILES + 1) continue;
      // Over a crevasse (water to the bottom of the level) or a melt pond (a hollow with a floor a few rows down).
      const floor = s.groundBelow(x, y);
      const depth = floor < 0 ? s.h - y : floor - y;
      let open = depth >= 2 && (floor < 0 || depth <= 3);
      for (let c = x; c <= e && open; c++) if (s.groundBelow(c, y) !== floor || !s.free(c, y + 1)) open = false;
      if (open) spots.push({ x0: x, x1: e, y, depth });
    }
  for (const c of best(rng, spots, (c) => c.x1 - c.x0))
    yield {
      name: rng.pick(['Thin Ice', 'Skate at Own Risk', 'Polar Plunge', 'Ice Is Nice', 'Cracking Up']),
      archetype: 'crumble',
      role: 'hazard',
      style: makeStyle(rng, 'bone', [196]),
      modules: [
        thinIce(
          rng,
          Array.from({ length: c.x1 - c.x0 + 1 }, (_, i) => [c.x0 + i, c.y] as Cell),
          c.depth,
        ),
      ],
    };
}

export const GLACIER: Recipe[] = [
  {
    name: 'frost cannon',
    unique: true,
    weight: 2.5,
    role: 'hazard',
    repeat: true,
    candidates: (rng, s) =>
      cannons(rng, s, {
        name: `${rng.pick(['Brain Freeze', 'Cold Shoulder', 'Polar Vortex', 'Snow Day'])} Cannon`,
        look: 'castle',
        style: makeStyle(rng, ['steel', 'bone'], [205, 0, 220], { trim: 'stripes', woodHue: rng.range(20, 30) }),
        ammo: 'frost',
        speed: [180, 240],
        interval: [140, 210],
        burst: [1, 2],
        elev: [0, 0.08],
        length: 1,
      }),
  },
  {
    name: 'frost vent',
    weight: 2.5,
    role: 'utility',
    repeat: true,
    candidates: (rng, s) =>
      geysers(rng, s, {
        name: 'Frost Vent',
        look: 'steam',
        where: 'ground',
        style: makeStyle(rng, 'bone', [200]),
        length: [6, 10],
        width: 0.85,
        off: [110, 170],
        warn: 50,
        on: [50, 80],
        lethal: false,
        strength: 2600,
      }),
  },
  {
    name: 'chairlift',
    weight: 2,
    role: 'build',
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: `${rng.pick(['Bunny Hill', 'Black Diamond', 'Après', 'Lift Pass'])} Chairlift`,
        look: 'gondola',
        support: 'mast',
        style: makeStyle(rng, 'steel', [0, 205, 48], { trim: 'stripes' }),
        arm: [3, 5],
        swing: [0.25, 0.5],
        width: [3, 4],
        period: [240, 340],
        material: 'metal',
      }),
  },
  {
    name: 'hanging serac',
    weight: 1.5,
    role: 'build',
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: 'Icicle of Damocles',
        look: 'slab',
        support: 'ceiling',
        style: makeStyle(rng, 'bone', [195]),
        arm: [3, 5],
        swing: [0.3, 0.55],
        width: [2, 3],
        period: [220, 320],
        material: 'ice',
      }),
  },
  defineSetPiece({ name: 'avalanche', unique: true, weight: 2.2, role: 'hazard', candidates: avalanches }),
  defineSetPiece({ name: 'thin ice', unique: true, weight: 2, role: 'hazard', repeat: true, candidates: thinIces }),
];
