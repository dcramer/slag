import { dcos, dsin } from '../../core/dmath';
import { type Cell, DOWN } from '../../core/geom';
import type { Rng } from '../../core/rng';
import { cannons, pendulums, vehicles } from './builders';
import { best, makeStyle, type Piece, type Recipe, SAFE_TILES, type Site } from './place';

/**
 * Castle: rampart cannons, chandeliers to swing on and to dodge when they drop, giant pendulum axes,
 * broken windows bristling with glass, a battering ram trundling the halls. Everything that hangs
 * hangs from a real ceiling (docs/SETPIECES.md, Grounding).
 */

const gilt = (rng: Rng) => makeStyle(rng, ['gold', 'brass', 'steel'], [40], { glowHue: rng.range(30, 45) });

/**
 * A broken window's glass (the `shards` module, world-only) standing out of a tall wall face: the wall
 * runs on above and below it like a frame, and it hangs clear of the floor, where you'd wall-jump.
 */
function* glassWalls(rng: Rng, s: Site): Generator<Piece> {
  const h = rng.int(3, 4);
  const w = 2;
  const spots: { x: number; y: number; d: 1 | -1; score: number }[] = [];
  for (let y = 1; y + h + 2 < s.h; y++)
    for (let x = 1; x < s.w - 1; x++)
      for (const d of [1, -1] as const) {
        const bx = d > 0 ? x + 1 : x - w;
        let ok = s.solid(x, y - 1) && s.solid(x, y + h);
        for (let yy = y; ok && yy < y + h; yy++) {
          ok = s.solid(x, yy);
          for (let i = 0; ok && i < w; i++) ok = s.free(bx + i, yy);
        }
        // Clear of the floor: two open rows under it.
        for (let i = 0; ok && i < w; i++) ok = !s.ground(bx + i, y + h) && !s.ground(bx + i, y + h + 1);
        if (!ok || s.zoneDist(bx, y) <= SAFE_TILES + 2) continue;
        let near = 0;
        for (let yy = y - 1; yy <= y + h + 3; yy++) for (let i = -1; i <= w; i++) if (s.reachable(bx + i, yy)) near++;
        spots.push({ x: bx, y, d, score: Math.min(3, near) });
      }
  for (const c of best(rng, spots, (c) => c.score)) {
    yield {
      name: rng.pick(['Broken Window', 'Stained Glass, Mostly Stains', 'Seven Years Bad Luck', 'Draughty Window']),
      archetype: 'spikestrip',
      role: 'hazard',
      style: gilt(rng),
      modules: [{ type: 'shards', at: [c.x, c.y], w, h, dir: c.d, inset: 0, seed: rng.int(0, 1 << 20) }],
      pathSafe: true,
    };
  }
}

/** A giant axe on a chain, swinging from a ceiling across a walkway. Its whole arc stays in the open. */
function* axes(rng: Rng, s: Site): Generator<Piece> {
  const arm = rng.range(3.4, 5.2);
  const radius = rng.range(1, 1.25);
  const swing = rng.range(0.7, 1);
  const spots: { x: number; y: number; score: number }[] = [];
  for (let y = 1; y < s.h - arm - 2; y++)
    for (let x = 2; x < s.w - 2; x++) {
      if (!s.solid(x, y - 1) || !s.free(x, y)) continue;
      let ok = true;
      const cells: Cell[] = [];
      for (let k = -4; ok && k <= 4; k++) {
        const a = DOWN + (swing * k) / 4;
        const hx = x + 0.5 + dcos(a) * arm;
        const hy = y + 0.5 + dsin(a) * arm;
        for (let yy = Math.floor(hy - radius); ok && yy <= Math.floor(hy + radius); yy++)
          for (let xx = Math.floor(hx - radius); ok && xx <= Math.floor(hx + radius); xx++) {
            ok = s.free(xx, yy);
            cells.push([xx, yy]);
          }
      }
      if (!ok || cells.some(([cx, cy]) => s.zoneDist(cx, cy) <= SAFE_TILES)) continue;
      const low = Math.floor(y + 0.5 + arm);
      spots.push({ x, y, score: (s.boardable(x, low, 2, 2, 1) ? 3 : 0) + (s.ceilingAbove(x, y, 2) >= 0 ? 0.5 : 0) });
    }
  for (const c of best(rng, spots, (c) => c.score)) {
    yield {
      name: `${rng.pick(['Executioner', 'Pendulum', 'Grandfather', 'Headsman'])}'s Axe`,
      archetype: 'flail',
      role: 'hazard',
      style: makeStyle(rng, ['steel', 'obsidian', 'rust'], [0], { woodHue: rng.range(18, 30) }),
      modules: [
        {
          type: 'swinger',
          head: 'axe',
          hub: [c.x + 0.5, c.y + 0.3],
          arm,
          angle0: DOWN,
          // Slow enough that the bottom of the arc stays clear past a timed hazard's window between passes, even
          // with the widest swing and the biggest head: at 150 frames those leave under 60.
          period: rng.int(180, 220),
          swing,
          dir: 1,
          radius,
          count: 1,
          link: 'chain',
        },
      ],
    };
  }
}

/** A chandelier under a ceiling with a clear drop to the floor below: it falls when you walk under it. */
function* chandrops(rng: Rng, s: Site): Generator<Piece> {
  const w = rng.int(2, 3);
  const spots: { x: number; y: number; reach: number; score: number }[] = [];
  for (let y = 1; y < s.h - 4; y++)
    for (let x = 1; x + w < s.w; x++) {
      let ok = true;
      for (let i = 0; ok && i < w; i++) ok = s.solid(x + i, y - 1) && s.free(x + i, y);
      if (!ok) continue;
      let reach = 0;
      while (reach < 8 && Array.from({ length: w }, (_, i) => s.free(x + i, y + reach + 1)).every(Boolean)) reach++;
      if (reach < 3 || reach >= 8 || !Array.from({ length: w }, (_, i) => s.ground(x + i, y + reach + 1)).some(Boolean)) continue;
      if (s.zoneDist(x, y + reach) <= SAFE_TILES + 1) continue;
      let under = 0;
      for (let i = 0; i < w; i++) if (s.reachable(x + i, y + reach)) under++;
      spots.push({ x, y, reach, score: under ? 3 + under * 0.3 : 0 });
    }
  for (const c of best(rng, spots, (c) => c.score)) {
    yield {
      name: rng.pick(['Falling Chandelier', 'The Opera Special', 'Overhead Costs', 'Loose Fixture']),
      archetype: 'dropper',
      role: 'hazard',
      style: gilt(rng),
      modules: [
        {
          type: 'dropper',
          cells: Array.from({ length: w }, (_, i) => [c.x + i, c.y] as Cell),
          angle: DOWN,
          reach: c.reach,
          warn: rng.int(26, 36),
          rest: rng.int(50, 80),
          look: 'chandelier',
        },
      ],
    };
  }
}

export const CASTLE: Recipe[] = [
  {
    name: 'cannon',
    weight: 3,
    role: 'hazard',
    repeat: true,
    candidates: (rng, s) =>
      cannons(rng, s, {
        name: `${rng.pick(['Rampart', 'Boss-Room', 'Royal', 'Old Thunder'])} Cannon`,
        look: 'castle',
        style: makeStyle(rng, ['steel', 'obsidian', 'brass'], [0], { woodHue: rng.range(18, 30) }),
        ammo: 'cannonball',
        speed: [240, 330],
        interval: [150, 230],
        burst: [1, 1],
        elev: [0.12, 0.45],
        length: 1.25,
      }),
  },
  {
    name: 'chandelier',
    weight: 2.5,
    role: 'build',
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: `${rng.pick(['Grand', 'Dusty', 'Load-Bearing', 'Wobbly'])} Chandelier`,
        look: 'chandelier',
        support: 'ceiling',
        style: makeStyle(rng, ['gold', 'brass', 'steel'], [40], { glowHue: rng.range(30, 45) }),
        arm: [3.5, 6],
        swing: [0.35, 0.65],
        width: [3, 4],
        period: [220, 320],
        material: 'metal',
      }),
  },
  {
    name: 'ram',
    weight: 1.5,
    role: 'hazard',
    candidates: (rng, s) =>
      vehicles(rng, s, {
        name: 'Door Knocker',
        look: 'ram',
        style: makeStyle(rng, 'steel', [0, 210, 120, 280], { woodHue: rng.range(18, 30) }),
        w: [3, 4],
        cols: (_r, w) => Array.from({ length: w }, () => 1.75),
        speed: [1.4, 2.4],
        pause: [50, 100],
        flip: 0.5,
      }),
  },
  {
    name: 'glass',
    weight: 2.5,
    role: 'hazard',
    repeat: true,
    unique: true,
    codex: {
      title: 'Broken Glass',
      note: 'Seven years’ bad luck, wholesale.',
      about: 'Giant shards of stained glass standing out of a wall or a window frame. They never move. Your wall-jump might.',
    },
    candidates: glassWalls,
  },
  {
    name: 'axe',
    weight: 2,
    role: 'hazard',
    unique: true,
    codex: { title: 'Pendulum Axe', note: 'Tick. Tock. Ow.', about: 'A giant axe on a rod, swinging wide and slow from the ceiling.' },
    candidates: axes,
  },
  {
    name: 'chandrop',
    weight: 2,
    role: 'hazard',
    unique: true,
    codex: {
      title: 'Drop Chandelier',
      note: 'Mind the candles.',
      about: 'Hangs from the ceiling until you walk under it, falls, then winches itself back up.',
    },
    candidates: chandrops,
  },
];
