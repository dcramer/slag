import type { Rng } from '../../core/rng';
import { cannons, geysers, pendulums, vehicles } from './builders';
import { defineSetPiece } from './contract';
import { best, makeStyle, type Piece, type Recipe, SAFE_TILES, type Site } from './place';

/**
 * Harbor: a dock crane swinging a cargo crate, a shore battery, a forklift hauling crates, a wave breaking
 * along a quay out of its sea wall (it shoves, it doesn't drown), and a tentacle rising out of open water on
 * its own beat (no face, just the arm). Three no other theme has:
 *
 * - **the harpoon gun**: a whaler's gun on a swivel post, its harpoons flying long and dropping;
 * - **the whirlpool**: a maelstrom in a water gap that, while it turns, drags whoever jumps over it down;
 * - **the channel light**: a harbor light on a pier end whose beam sweeps the gap on a long dark.
 */

/** Columns of open water (no ground anywhere in them) with ground near on both sides, and the deck row beside them. */
function waterGaps(s: Site): { x0: number; x1: number; deck: number }[] {
  const out: { x0: number; x1: number; deck: number }[] = [];
  for (let x = 1; x < s.w - 1;) {
    if (!s.overPit(x, 0)) {
      x++;
      continue;
    }
    let x1 = x;
    while (x1 + 1 < s.w - 1 && s.overPit(x1 + 1, 0)) x1++;
    const l = s.groundBelow(x - 1, 0);
    const r = s.groundBelow(x1 + 1, 0);
    if (l >= 0 && r >= 0 && x1 - x + 1 <= 12) out.push({ x0: x, x1, deck: Math.min(l, r) });
    x = x1 + 1;
  }
  return out;
}

/** A maelstrom in a water gap a few rows under its banks: the pull reaches whoever jumps across. */
function* whirlpools(rng: Rng, s: Site): Generator<Piece> {
  const radius = rng.range(3.4, 4.6);
  const spots: { x: number; y: number; score: number }[] = [];
  for (const gp of waterGaps(s)) {
    const x = (gp.x0 + gp.x1 + 1) / 2;
    const y = Math.min(s.h - 1.5, gp.deck + 2.5);
    if (!s.free(Math.floor(x), Math.floor(y)) || s.zoneDist(Math.floor(x), Math.floor(y)) <= SAFE_TILES + Math.ceil(radius)) continue;
    let near = 0;
    for (let yy = Math.floor(y - radius); yy <= y + radius; yy++) for (let xx = Math.floor(x - radius); xx <= x + radius; xx++) if (s.reachable(xx, yy)) near++;
    if (near) spots.push({ x, y, score: Math.min(4, near / 2) });
  }
  for (const c of best(rng, spots, (c) => c.score)) {
    yield {
      name: rng.pick(['Whirlpool', 'The Plughole', 'Maelstrom', 'Down the Drain']),
      archetype: 'magnet',
      role: 'hazard',
      style: makeStyle(rng, 'steel', [196]),
      modules: [
        {
          type: 'magnet',
          look: 'whirlpool',
          at: [c.x, c.y],
          radius,
          strength: rng.range(1400, 1900),
          polarity: 1,
          on: rng.int(90, 130),
          off: rng.int(150, 230),
          warn: rng.int(45, 60),
        },
      ],
    };
  }
}

/** A harbor light on a pier end or a quay's edge, its beam sweeping out over the water beside it. */
function* channelLights(rng: Rng, s: Site): Generator<Piece> {
  const spots: { x: number; y: number; d: 1 | -1; score: number }[] = [];
  for (let y = 3; y < s.h - 2; y++)
    for (let x = 2; x < s.w - 2; x++)
      for (const d of [1, -1] as const) {
        // An edge: ground under this cell, open water past it.
        if (!s.free(x, y) || !s.solid(x, y + 1) || !s.free(x, y - 1) || !s.overPit(x + d, y)) continue;
        if (s.zoneDist(x, y) <= SAFE_TILES + 2) continue;
        let near = 0;
        for (let k = 2; k < 12; k++) for (let dy = -2; dy <= 3; dy++) if (s.reachable(x + d * k, y + dy)) near++;
        spots.push({ x, y, d, score: Math.min(4, near / 3) });
      }
  for (const c of best(rng, spots, (c) => c.score)) {
    const tilt = rng.range(0.05, 0.16);
    yield {
      name: rng.pick(['Channel Light', 'Harbour Light', 'Leading Light', 'Pierhead Lamp']),
      archetype: 'laser',
      role: 'hazard',
      style: makeStyle(rng, ['brass', 'gold'], [44], { glowHue: rng.range(40, 52) }),
      modules: [
        {
          type: 'laser',
          look: 'lamp',
          at: [c.x + 0.5, c.y + 0.35],
          angle: c.d > 0 ? tilt : Math.PI - tilt,
          charge: rng.int(45, 65),
          fire: rng.int(40, 60),
          off: rng.int(200, 300),
          sweep: rng.range(0.12, 0.26),
          sweepPeriod: rng.int(220, 320),
        },
      ],
    };
  }
}

export const HARBOR: Recipe[] = [
  defineSetPiece({
    name: 'crane',
    weight: 3,
    role: 'build',
    candidates: (rng, s) =>
      pendulums(rng, s, {
        name: rng.pick(['Dock Crane', 'Cargo Hook', 'Swinging Freight']),
        look: 'crane',
        support: 'mast',
        style: makeStyle(rng, ['steel', 'rust'], [28, 48, 0, 205], { trim: 'stripes' }),
        arm: [3.5, 6.5],
        swing: [0.35, 0.65],
        width: [2, 3],
        thick: 1,
        period: [220, 320],
        material: 'wood',
      }),
  }),
  defineSetPiece({
    name: 'shore battery',
    weight: 1.5,
    role: 'hazard',
    candidates: (rng, s) =>
      cannons(rng, s, {
        name: 'Shore Battery',
        look: 'ship',
        style: makeStyle(rng, ['steel', 'brass'], [0], { woodHue: rng.range(18, 28) }),
        ammo: 'cannonball',
        speed: [250, 340],
        interval: [160, 240],
        burst: [1, 2],
        elev: [0.1, 0.4],
        length: 1.25,
      }),
  }),
  defineSetPiece({
    name: 'dock forklift',
    weight: 1.5,
    role: 'hazard',
    candidates: (rng, s) =>
      vehicles(rng, s, {
        name: 'Dock Forklift',
        look: 'forklift',
        style: makeStyle(rng, 'steel', [28, 200, 48], { trim: 'stripes' }),
        w: [3, 3],
        cols: (r) => [1.45 + r.range(0, 0.15), 2.3, 2.3],
        speed: [2, 3.4],
        pause: [30, 90],
        flip: 0.5,
      }),
  }),
  defineSetPiece({
    name: 'wave',
    weight: 1.5,
    role: 'hazard',
    candidates: (rng, s) =>
      geysers(rng, s, {
        name: rng.pick(['Breaking Wave', 'Rogue Wave', 'The Big One', 'Spray']),
        look: 'water',
        aim: 'side',
        where: 'ground',
        style: makeStyle(rng, 'steel', [200]),
        archetype: 'fan',
        role: 'hazard',
        length: [6, 12],
        width: 2,
        off: [170, 250],
        warn: 50,
        on: [45, 70],
        lethal: false,
        strength: rng.int(2700, 3400),
      }),
  }),
  defineSetPiece({
    name: 'tentacle',
    weight: 2,
    role: 'hazard',
    candidates: (rng, s) =>
      geysers(rng, s, {
        name: rng.pick(['Tentacle', 'Something Below', 'The Arm', 'Calamari Revenge']),
        look: 'tentacle',
        where: 'pit',
        style: makeStyle(rng, 'brass', [340, 10, 280, 150]),
        length: [7, 12],
        width: 1.4,
        off: [160, 260],
        warn: 60,
        on: [55, 85],
        lethal: true,
      }),
  }),
  defineSetPiece({
    name: 'harpoon',
    weight: 2,
    role: 'hazard',
    repeat: true,
    unique: true,
    candidates: (rng, s) =>
      cannons(rng, s, {
        name: rng.pick(['Harpoon Gun', 'Whaler', 'The Long Reach']),
        look: 'harpoon',
        style: makeStyle(rng, ['brass', 'steel'], [20], { woodHue: rng.range(18, 28) }),
        ammo: 'arrow',
        speed: [300, 380],
        interval: [130, 190],
        burst: [1, 1],
        elev: [0.04, 0.16],
        length: 1.4,
      }),
  }),
  defineSetPiece({ name: 'whirlpool', weight: 2, role: 'hazard', unique: true, candidates: whirlpools }),
  defineSetPiece({ name: 'channel light', weight: 1.5, role: 'hazard', unique: true, candidates: channelLights }),
];
