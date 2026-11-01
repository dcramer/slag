import { normalizeCells, type Cell } from '../core/geom';
import { deriveSeed, Rng } from '../core/rng';
import { makerName } from './names';

export type PropKind = 'block' | 'spikes' | 'crumble' | 'mover' | 'saw' | 'spring' | 'turret' | 'fan' | 'bomb';
export type Material = 'stone' | 'ice' | 'conveyor' | 'sticky';

interface PropBase {
  /** Stable id: `${round}-${index}` within a match. */
  key: string;
  name: string;
  maker: string;
  hue: number;
}

export interface BlockDef extends PropBase {
  kind: 'block';
  cells: Cell[];
  material: Material;
  /** Belt speed px/s (conveyor only). */
  conveyor: number;
}
export interface SpikesDef extends PropBase {
  kind: 'spikes';
  cells: Cell[];
}
export interface CrumbleDef extends PropBase {
  kind: 'crumble';
  cells: Cell[];
  breakFrames: number;
  respawnFrames: number;
}
export interface MoverDef extends PropBase {
  kind: 'mover';
  length: number;
  axis: 'h' | 'v';
  /** Travel distance in tiles. */
  range: number;
  period: number;
}
export interface SawDef extends PropBase {
  kind: 'saw';
  /** Blade radius in tiles. */
  radius: number;
  axis: 'h' | 'v';
  range: number;
  period: number;
}
export interface SpringDef extends PropBase {
  kind: 'spring';
  power: number;
}
export interface TurretDef extends PropBase {
  kind: 'turret';
  interval: number;
  speed: number;
  burst: number;
}
export interface FanDef extends PropBase {
  kind: 'fan';
  length: number;
  strength: number;
}
export interface BombDef extends PropBase {
  kind: 'bomb';
  radius: number;
}

export type PropDef = BlockDef | SpikesDef | CrumbleDef | MoverDef | SawDef | SpringDef | TurretDef | FanDef | BombDef;

export const KIND_WEIGHTS: readonly (readonly [PropKind, number])[] = [
  ['block', 4],
  ['spikes', 3],
  ['saw', 2.5],
  ['crumble', 2],
  ['mover', 2],
  ['spring', 2],
  ['turret', 2],
  ['fan', 1.5],
  ['bomb', 1.2],
];

/** Grow a connected polyomino of `n` cells by random accretion. */
export function polyomino(rng: Rng, n: number, straightness = 0): Cell[] {
  const cells: Cell[] = [[0, 0]];
  const has = (x: number, y: number) => cells.some(([cx, cy]) => cx === x && cy === y);
  const dirs: Cell[] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  let guard = 0;
  while (cells.length < n && guard++ < 200) {
    const [bx, by] = rng.chance(straightness) ? cells[cells.length - 1] : rng.pick(cells);
    const [dx, dy] = rng.chance(straightness) ? dirs[0] : rng.pick(dirs);
    if (!has(bx + dx, by + dy)) cells.push([bx + dx, by + dy]);
  }
  return normalizeCells(cells);
}

const GENERIC_ADJ = ['Suspicious', 'Vintage', 'Cursed', 'Deluxe', 'Discount', 'Haunted', 'Artisanal', 'Bootleg', 'Certified', 'Recalled', 'Sentient', 'Lukewarm'];

function title(rng: Rng, adjs: string[], nouns: string[]): string {
  const adj = adjs.length && rng.chance(0.85) ? rng.pick(adjs) : rng.pick(GENERIC_ADJ);
  return `${adj} ${rng.pick(nouns)}`;
}

/** Generate a single prop of a given kind. Parameters are random; the name is derived from them. */
export function generateProp(rng: Rng, kind: PropKind, key: string): PropDef {
  const base = { key, maker: makerName(rng), hue: rng.range(0, 360) };
  switch (kind) {
    case 'block': {
      const n = rng.weighted([
        [1, 1],
        [2, 2.5],
        [3, 3],
        [4, 2],
        [5, 1],
      ] as const);
      const material = rng.weighted<Material>([
        ['stone', 6],
        ['ice', 2],
        ['conveyor', 2],
        ['sticky', 1.5],
      ]);
      const conveyor = material === 'conveyor' ? rng.sign() * rng.range(50, 110) : 0;
      const cells = polyomino(rng, n, material === 'conveyor' ? 0.8 : 0.3);
      const adjs: string[] = [];
      const nouns = material === 'conveyor' ? ['Conveyor', 'Belt', 'Treadmill'] : material === 'ice' ? ['Ice Block', 'Glacier', 'Frost Slab'] : material === 'sticky' ? ['Goo Block', 'Gum Slab', 'Jam Brick'] : ['Block', 'Brick', 'Chunk', 'Slab', 'Lump'];
      if (n >= 5) adjs.push('Chonky', 'Mega');
      if (n === 1) adjs.push('Tiny', 'Lil');
      if (Math.abs(conveyor) > 90) adjs.push('Turbo', 'Express');
      if (Math.abs(conveyor) && Math.abs(conveyor) < 65) adjs.push('Lazy', 'Sunday');
      return { ...base, kind, cells, material, conveyor, name: title(rng, adjs, nouns) };
    }
    case 'spikes': {
      const n = rng.weighted([
        [1, 2],
        [2, 3],
        [3, 2],
        [4, 0.8],
      ] as const);
      const cells = polyomino(rng, n, 0.7);
      return { ...base, kind, cells, name: title(rng, n >= 3 ? ['Long', 'Endless', 'Very Pointy'] : ['Pointy', 'Rude', 'Prickly'], ['Spikes', 'Caltrops', 'Thorns', 'Pokers']) };
    }
    case 'crumble': {
      const n = rng.int(2, 4);
      const breakFrames = rng.int(14, 45);
      const respawnFrames = rng.int(150, 300);
      const adjs = breakFrames < 22 ? ['Flimsy', 'Fragile', 'Anxious'] : breakFrames > 38 ? ['Sturdy-ish', 'Patient'] : ['Crumbly', 'Stale'];
      return { ...base, kind, cells: polyomino(rng, n, 0.75), breakFrames, respawnFrames, name: title(rng, adjs, ['Biscuit', 'Crumbler', 'Rubble', 'Wafer']) };
    }
    case 'mover': {
      const range = rng.int(2, 6);
      const period = rng.int(100, 260);
      const speed = (range * 2) / period;
      const adjs = speed > 0.07 ? ['Zippy', 'Frantic', 'Caffeinated'] : speed < 0.035 ? ['Sluggish', 'Sleepy', 'Leisurely'] : ['Wandering', 'Restless'];
      return {
        ...base,
        kind,
        length: rng.int(2, 4),
        axis: rng.chance(0.6) ? 'h' : 'v',
        range,
        period,
        name: title(rng, adjs, ['Platform', 'Lift', 'Shuttle', 'Elevator']),
      };
    }
    case 'saw': {
      const radius = rng.range(0.5, 1.3);
      const range = rng.chance(0.3) ? 0 : rng.int(2, 5);
      const period = rng.int(80, 220);
      const adjs: string[] = [];
      if (radius > 1.05) adjs.push('Mega', 'Industrial');
      if (radius < 0.7) adjs.push('Mini', 'Pocket');
      if (range === 0) adjs.push('Stationary', 'Lazy');
      else if ((range * 2) / period > 0.06) adjs.push('Frantic', 'Unhinged');
      return { ...base, kind, radius, axis: rng.chance(0.55) ? 'h' : 'v', range, period, name: title(rng, adjs, ['Buzzsaw', 'Grinder', 'Shredder', 'Blade']) };
    }
    case 'spring': {
      const power = rng.range(520, 820);
      return { ...base, kind, power, name: title(rng, power > 720 ? ['Overclocked', 'Ballistic'] : power < 600 ? ['Wimpy', 'Polite'] : ['Bouncy', 'Springy'], ['Spring', 'Launcher', 'Boing', 'Trampoline']) };
    }
    case 'turret': {
      const interval = rng.int(50, 140);
      const speed = rng.range(110, 260);
      const burst = rng.weighted([
        [1, 4],
        [2, 2],
        [3, 1],
      ] as const);
      const adjs: string[] = [];
      if (interval < 70) adjs.push('Trigger-happy', 'Twitchy');
      if (burst === 3) adjs.push('Triple', 'Chatty');
      if (speed > 220) adjs.push('Snappy', 'Sniper');
      return { ...base, kind, interval, speed, burst, name: title(rng, adjs, ['Turret', 'Cannon', 'Blaster', 'Pea Shooter']) };
    }
    case 'fan': {
      const strength = rng.range(1300, 2800);
      return { ...base, kind, length: rng.int(3, 8), strength, name: title(rng, strength > 2300 ? ['Hurricane', 'Industrial'] : strength < 1700 ? ['Gentle', 'Asthmatic'] : ['Breezy', 'Gusty'], ['Fan', 'Blower', 'Gust Box']) };
    }
    case 'bomb': {
      const radius = rng.range(1.6, 3.6);
      return { ...base, kind, radius, name: title(rng, radius > 3 ? ['Big', 'Excessive'] : radius < 2.1 ? ['Polite', 'Small'] : ['Volatile', 'Grumpy'], ['Bomb', 'Charge', 'Boomer', 'Kaboom'], ) };
    }
  }
}

/**
 * The prop selection offered at the start of a round. Deterministic for
 * (seed, round). Guarantees at least one "building" prop and one hazard so a
 * crate is never all-traps or all-platforms.
 */
export function generateCrate(seed: number, round: number, count: number): PropDef[] {
  const rng = new Rng(deriveSeed(seed, `crate:${round}`));
  const kinds: PropKind[] = [];
  kinds.push(rng.pick(['block', 'mover', 'spring', 'crumble'] as const));
  kinds.push(rng.pick(['spikes', 'saw', 'turret'] as const));
  while (kinds.length < count) kinds.push(rng.weighted(KIND_WEIGHTS));
  rng.shuffle(kinds);
  return kinds.map((k, i) => generateProp(new Rng(deriveSeed(seed, `prop:${round}:${i}`)), k, `${round}-${i}`));
}
