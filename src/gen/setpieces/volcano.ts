import type { Vec } from '../../core/geom';
import type { Rng } from '../../core/rng';
import type { Module } from '../../sim/props';
import { cannons, geysers, pendulums } from './builders';
import { best, makeStyle, type Piece, type Recipe, SAFE_TILES, type Site } from './place';

/**
 * Volcano: lava plumes out of the pits, vents (lava or launching steam), magma spitters, a slab on chains,
 * lavafalls pouring off overhangs, and three things no other theme has (docs/SETPIECES.md, Volcano):
 *
 * - **Volcanic bombs** falling out of the sky onto the route, each one's shadow growing on the spot it
 *   will land before it comes down (`lob`, look `bomb`).
 * - **The magma serpent**, linked segments leaping out of a lava pit in an arc over the route and diving
 *   back in, the lava boiling where it will leap (`lob`, look `serpent`).
 * - **Obsidian bridges** of volcanic glass over a small gap, cracking red and giving way under you, back
 *   a while later (`body`, crumbling, look `obsidian`).
 */

/** Spots for volcanic bombs: stand cells on the route, away from spawn and goal, with sky over them. */
function* bombs(rng: Rng, s: Site): Generator<Piece> {
  const spots: Vec[] = [];
  for (const r of s.groundRuns(3, 2))
    for (let x = r.x0; x <= r.x1; x++) {
      if (s.zoneDist(x, r.y) <= SAFE_TILES + 2 || !s.reachable(x, r.y)) continue;
      let open = true;
      for (let y = r.y - 1; y >= 0 && open; y--) open = !s.solid(x, y);
      if (open) spots.push([x, r.y + 1]);
    }
  for (const [x, top] of best(rng, spots, () => 0, 10)) {
    const n = rng.int(1, 3);
    const mods: Module[] = [];
    for (let i = 0; i < n; i++) {
      const tx = x + i * rng.int(3, 5);
      if (i && !spots.some(([sx, st]) => sx === tx && st === top)) break;
      const to: Vec = [tx + 0.5, top - 0.75];
      mods.push({
        type: 'lob',
        look: 'bomb',
        from: [to[0] + rng.range(-5, 5), -3],
        to,
        apex: rng.range(0, 1),
        count: 1,
        lag: 0,
        radius: rng.range(0.65, 0.85),
        off: rng.int(150, 260),
        warn: rng.int(60, 80),
        flight: rng.int(44, 56),
      });
    }
    yield {
      name: rng.pick(['Volcanic Bombs', 'Sky Rocks', 'Incoming!', 'Hot Hail', 'Forecast: Boulders']),
      archetype: 'launcher',
      role: 'hazard',
      style: makeStyle(rng, 'obsidian', [18]),
      modules: mods,
    };
  }
}

/** Pits wide enough for a serpent to leap across: runs of columns with no ground under them, edge to edge. */
function pits(s: Site): { a: number; b: number; bank: number }[] {
  const out: { a: number; b: number; bank: number }[] = [];
  let a = -1;
  for (let x = 1; x < s.w - 1; x++) {
    const open = s.overPit(x, 0) && s.free(x, s.h - 1);
    if (open && a < 0) a = x;
    if (!open && a >= 0) {
      const b = x - 1;
      const bank = Math.min(s.groundBelow(a - 1, 0), s.groundBelow(b + 1, 0));
      if (b - a >= 3 && bank > 0) out.push({ a, b, bank });
      a = -1;
    }
  }
  return out;
}

/** The magma serpent, leaping a lava pit edge to edge, its arc a few tiles over the banks. */
function* serpents(rng: Rng, s: Site): Generator<Piece> {
  for (const p of best(rng, pits(s), (p) => Math.min(4, (p.b - p.a) / 3))) {
    const ends: [Vec, Vec] = [
      [p.a + 0.5, s.h - 0.6],
      [p.b + 0.5, s.h - 0.6],
    ];
    if (rng.chance(0.5)) ends.reverse();
    yield {
      name: rng.pick(['Magma Serpent', 'Lava Eel', 'The Long Hot Thing', 'Pit Noodle']),
      archetype: 'flamer',
      role: 'hazard',
      style: makeStyle(rng, 'obsidian', [18]),
      modules: [
        {
          type: 'lob',
          look: 'serpent',
          from: ends[0],
          to: ends[1],
          apex: s.h - 0.6 - (p.bank - rng.range(2, 4)),
          count: rng.int(5, 7),
          lag: rng.int(5, 7),
          radius: 0.6,
          off: rng.int(160, 240),
          warn: rng.int(55, 70),
          flight: rng.int(90, 120),
        },
      ],
    };
  }
}

/** Obsidian slabs across a small gap between two banks at the same height. */
function* obsidianBridges(rng: Rng, s: Site): Generator<Piece> {
  const spans: { a: number; b: number; y: number }[] = [];
  for (let y = 4; y < s.h - 1; y++)
    for (let x = 1; x < s.w - 6; x++) {
      if (!s.solid(x, y) || s.solid(x + 1, y) || s.ground(x + 1, y)) continue;
      let b = x + 1;
      while (b < s.w - 1 && !s.ground(b, y) && b - x <= 5) b++;
      const w = b - x - 1;
      if (w < 2 || w > 4 || !s.solid(b, y) || !s.reachable(x, y - 1)) continue;
      let free = true;
      for (let c = x + 1; c < b && free; c++) free = s.free(c, y) && s.free(c, y - 1) && s.overPit(c, y);
      if (free && s.zoneDist(x, y) > SAFE_TILES + 1) spans.push({ a: x + 1, b: b - 1, y });
    }
  for (const sp of best(rng, spans, (sp) => sp.b - sp.a)) {
    yield {
      name: rng.pick(['Obsidian Bridge', 'Glass Floor', 'Crunchy Shortcut', 'Volcanic Glass']),
      archetype: 'crumble',
      role: 'build',
      style: makeStyle(rng, 'obsidian', [18]),
      modules: [
        {
          type: 'body',
          cells: Array.from({ length: sp.b - sp.a + 1 }, (_, i) => [sp.a + i, sp.y] as [number, number]),
          material: 'crumble',
          conveyor: 0,
          breakFrames: rng.int(16, 26),
          respawnFrames: rng.int(180, 260),
          look: 'obsidian',
        },
      ],
    };
  }
}

export const VOLCANO: Recipe[] = [
  {
    name: 'lava plume',
    weight: 3,
    role: 'hazard',
    repeat: true,
    candidates: (rng, s) =>
      geysers(rng, s, {
        name: 'Floor Is Lava',
        look: 'lava',
        where: 'pit',
        style: makeStyle(rng, 'obsidian', [18]),
        length: [10, 16],
        width: 1.25,
        off: [110, 170],
        warn: 54,
        on: [45, 70],
        lethal: true,
      }),
  },
  {
    name: 'vent',
    weight: 2,
    role: 'hazard',
    repeat: true,
    candidates: (rng, s) => {
      const lava = rng.chance(0.5);
      return geysers(rng, s, {
        name: lava ? 'Magma Vent' : 'Steam Vent',
        look: lava ? 'lava' : 'steam',
        where: 'ground',
        style: makeStyle(rng, 'obsidian', [18]),
        length: lava ? [5, 8] : [7, 11],
        width: 1.05,
        off: [100, 160],
        warn: 50,
        on: lava ? [40, 60] : [50, 80],
        lethal: lava,
        strength: 2700,
      });
    },
  },
  {
    name: 'lavafall',
    weight: 2,
    role: 'hazard',
    candidates: (rng, s) =>
      geysers(rng, s, {
        name: rng.pick(['Lavafall', 'Hot Shower', 'Molten Drip']),
        look: 'lava',
        aim: 'down',
        where: 'ground',
        style: makeStyle(rng, 'obsidian', [18]),
        length: [5, 9],
        width: 1.1,
        off: [110, 170],
        warn: 54,
        on: [45, 70],
        lethal: true,
      }),
  },
  {
    name: 'spitter',
    weight: 2,
    role: 'hazard',
    candidates: (rng, s) =>
      cannons(rng, s, {
        name: 'Magma Spitter',
        look: 'spitter',
        style: makeStyle(rng, 'obsidian', [15], { glowHue: rng.range(15, 35) }),
        ammo: 'fireball',
        speed: [130, 180],
        interval: [130, 200],
        burst: [1, 3],
        elev: [0, 0.25],
        length: 0.85,
      }),
  },
  {
    name: 'slab',
    weight: 1.5,
    role: 'build',
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: 'Basalt Slab',
        look: 'slab',
        support: 'ceiling',
        style: makeStyle(rng, ['obsidian', 'rust'], [15]),
        arm: [3.5, 6],
        swing: [0.3, 0.6],
        width: [3, 4],
        period: [220, 320],
        material: 'stone',
      }),
  },
  { name: 'bombs', weight: 2.5, role: 'hazard', repeat: true, candidates: bombs },
  { name: 'serpent', weight: 2.5, role: 'hazard', candidates: serpents },
  { name: 'obsidian bridge', weight: 1.5, role: 'build', candidates: obsidianBridges },
];
