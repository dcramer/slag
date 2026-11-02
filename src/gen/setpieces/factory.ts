import type { Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import type { Module } from '../../sim/props';
import { presses, vehicles, wheels } from './builders';
import { defineSetPiece } from './contract';
import { best, makeStyle, type Piece, type Recipe, SAFE_TILES, type Site } from './place';

/**
 * Factory: a hydraulic press in a gantry, a forklift shuttling along the floor, a cog-wheel lift, and two
 * more things no other theme has (docs/SETPIECES.md, Factory):
 *
 * - **The slag ladle**: a ladle of molten slag on a crane hook that tips on a cycle, pouring a stream
 *   straight down that spills out along the floor and stays molten a while (`ladle`).
 * - **The robot arm**: an assembly-line arm on a pedestal that chops down and sweeps its welding head out
 *   along the floor in front of it, welds, and folds back up (`arm`).
 */

/** A ladle's lip over a floor: the stream's origin, the floor under it, how far the spill can run each way, and what it hangs from. */
export interface LadleSpot {
  at: Vec;
  drop: number;
  spill: Vec;
  hang: number;
}

/** Rows a ladle takes over its lip: the bowl, its bail and the hook. */
const LADLE_ROWS = 3;

/**
 * Lips over flat floor a ladle can pour on: `drop` rows over a run of stand cells with at least a column
 * of floor either side of the stream, the ladle's own cells free, clear of the spawn and the goal.
 */
export function ladleSpots(s: Site, drops: readonly [number, number], spillMax: number): LadleSpot[] {
  const out: LadleSpot[] = [];
  for (const r of s.groundRuns(drops[0] + LADLE_ROWS, 4))
    for (let x = r.x0 + 1; x <= r.x1 - 1; x++) {
      if (s.zoneDist(x, r.y) <= SAFE_TILES + 3) continue;
      const floor = r.y + 1;
      for (let d = drops[1]; d >= drops[0]; d--) {
        const lip = floor - d;
        if (!s.freeRect(x - 2, lip - LADLE_ROWS, x + 1, r.y)) continue;
        const c = s.ceilingAbove(x, lip, 9);
        out.push({
          at: [x + 0.5, lip],
          drop: d,
          spill: [Math.min(spillMax, x + 0.5 - r.x0 - 0.25), Math.min(spillMax, r.x1 + 1 - (x + 0.5) - 0.25)],
          hang: c >= 0 ? lip - (c + 1) : 0,
        });
        break;
      }
    }
  return out;
}

/** The ladle module for a spot, its timing rolled. */
export function ladleAt(rng: Rng, sp: LadleSpot, dir: 1 | -1, spill: number): Module {
  return {
    type: 'ladle',
    at: sp.at,
    dir,
    drop: sp.drop,
    spill: [Math.min(sp.spill[0], spill), Math.min(sp.spill[1], spill)],
    hang: sp.hang,
    off: rng.int(150, 230),
    warn: rng.int(42, 58),
    pour: rng.int(50, 70),
    set: rng.int(30, 44),
    seed: rng.int(0, 1 << 20),
  };
}

export const LADLE_NAMES = ['Slag Ladle', 'The Big Pour', 'Hot Soup', 'Ladle of Regret', 'Pour Decisions'];

/** The slag ladle: over a stretch of floor the route crosses, its spill along it. */
function* ladles(rng: Rng, s: Site): Generator<Piece> {
  const spots = ladleSpots(s, [4, 6], 3.5).filter((sp) => sp.spill[0] >= 1 && sp.spill[1] >= 1);
  for (const sp of best(rng, spots, (sp) => sp.spill[0] + sp.spill[1] + (s.reachable(Math.floor(sp.at[0]), Math.floor(sp.at[1]) + sp.drop - 1) ? 3 : 0)))
    yield {
      name: rng.pick(LADLE_NAMES),
      archetype: 'flamer',
      role: 'hazard',
      style: makeStyle(rng, ['rust', 'steel'], [24, 30]),
      modules: [ladleAt(rng, sp, rng.chance(0.5) ? 1 : -1, rng.range(2, 3.5))],
    };
}

/** Columns in front of a pedestal a robot arm's head sweeps (it reaches about two links out). */
export const ARM_SWEEP = 6;
/** Rows over the floor a raised arm takes. */
const ARM_ROWS = 6;

/** A robot arm and its pedestal standing on the stand cell (x, y), striking toward `dir`. */
export function robotArm(rng: Rng, x: number, y: number, dir: 1 | -1, reach = rng.range(2.2, 2.6)): Module[] {
  return [
    {
      type: 'body',
      cells: [
        [x, y - 1],
        [x, y],
      ],
      material: 'metal',
      conveyor: 0,
      breakFrames: 0,
      respawnFrames: 0,
    },
    {
      type: 'arm',
      at: [x + 0.5, y - 1],
      dir,
      reach,
      rest: rng.int(140, 200),
      warn: rng.int(36, 50),
      strike: rng.int(18, 24),
      weld: rng.int(30, 44),
      back: rng.int(50, 70),
      seed: rng.int(0, 1 << 20),
    },
  ];
}

export const ARM_NAMES = ['Robot Arm', 'Welding Cell', 'Automation', 'Unit 7', 'The New Hire'];

/** The robot arm: a pedestal on a flat run, its sweep over the floor beyond it. */
function* arms(rng: Rng, s: Site): Generator<Piece> {
  const spots: { x: number; y: number; dir: 1 | -1 }[] = [];
  for (const r of s.groundRuns(ARM_ROWS, ARM_SWEEP + 1))
    for (let x = r.x0; x <= r.x1; x++)
      for (const dir of [1, -1] as const) {
        const far = x + dir * ARM_SWEEP;
        if (far < r.x0 || far > r.x1) continue;
        if (s.zoneDist(x, r.y) <= SAFE_TILES + 2 || s.zoneDist(far, r.y) <= SAFE_TILES + 2) continue;
        if (!s.freeRect(Math.min(x, far), r.y - ARM_ROWS + 1, Math.max(x, far), r.y)) continue;
        spots.push({ x, y: r.y, dir });
      }
  for (const sp of best(rng, spots, (sp) => (s.reachable(sp.x + sp.dir * 3, sp.y) ? 4 : 0)))
    yield {
      name: rng.pick(ARM_NAMES),
      archetype: 'saw',
      role: 'hazard',
      style: makeStyle(rng, ['steel'], [30]),
      modules: robotArm(rng, sp.x, sp.y, sp.dir),
    };
}

export const FACTORY: Recipe[] = [
  {
    name: 'press',
    unique: true,
    weight: 3,
    role: 'hazard',
    repeat: true,
    candidates: (rng, s) =>
      presses(rng, s, {
        name: `${rng.pick(['Hydraulic', 'Pancake', 'Stamping', 'Thousand-Ton'])} Press`,
        style: makeStyle(rng, ['steel', 'steel', 'rust'], [48, 200, 0], { trim: 'stripes', glowHue: 0 }),
        height: [5, 6],
        width: [2, 3],
        period: [130, 200],
      }),
  },
  {
    name: 'forklift',
    weight: 2.5,
    role: 'hazard',
    candidates: (rng, s) =>
      vehicles(rng, s, {
        name: `${rng.pick(['Unlicensed', 'Speedy', 'Overworked', 'Model T'])} Forklift`,
        look: 'forklift',
        style: makeStyle(rng, 'steel', [46, 30, 200], { trim: 'stripes' }),
        w: [3, 3],
        // Counterweight, cab under its overhead guard, mast (forks stick out the front).
        cols: (r) => [1.45 + r.range(0, 0.15), 2.3, 2.3],
        speed: [2, 3.6],
        pause: [30, 90],
        flip: 0.5,
      }),
  },
  {
    name: 'cog lift',
    weight: 2,
    role: 'build',
    candidates: (rng, s) =>
      wheels(rng, s, {
        name: 'Cog Lift',
        look: 'cog',
        support: 'tower',
        style: makeStyle(rng, ['steel', 'brass', 'copper', 'rust'], [48, 200], { trim: 'rivets' }),
        arm: [2.6, 3.5],
        width: [2, 2],
        count: [3, 4],
        period: [360, 620],
        material: 'metal',
      }),
  },
  defineSetPiece({ name: 'slag ladle', unique: true, weight: 2, role: 'hazard', repeat: true, candidates: ladles }),
  defineSetPiece({ name: 'robot arm', unique: true, weight: 2, role: 'hazard', candidates: arms }),
];
