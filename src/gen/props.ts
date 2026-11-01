import { type Cell, normalizeCells, type Vec } from '../core/geom';
import { moduleSim } from '../sim/props/registry';
import '../sim/props/modules';
import type { Aim, Ammo, Archetype, Head, LauncherStyle, Material, MetalStyle, Module, Motion, PropDef, PropStyle, Role, Trim } from '../sim/props/types';

import { AMMO } from '../sim/props/types';

export type { Aim, Ammo, Archetype, Head, LauncherStyle, Material, MetalStyle, Module, Motion, PropDef, PropStyle, Role, Trim };
export { AMMO };

import { deriveSeed, Rng } from '../core/rng';
import { makerName, word } from './names';

/**
 * Props are assembled from modules (bodies, spikes, swinging heads,
 * launchers, emitters...) by archetype recipes. Every parameter — shape,
 * timing, kinematics, ammo, styling — is rolled, so two crossbows or two
 * saws are rarely the same thing.
 *
 * Coordinates in a PropDef are in tiles, relative to the top-left of the
 * footprint's bounding box. Angles are radians in screen space (y down).
 */

export const ARCHETYPE_WEIGHTS: readonly (readonly [Archetype, number])[] = [
  ['platform', 3.5],
  ['crumble', 1.2],
  ['spikeblock', 1.6],
  ['saw', 2.6],
  ['flail', 1.3],
  ['launcher', 3.2],
  ['flamer', 1.2],
  ['laser', 1.2],
  ['tesla', 1],
  ['crusher', 1],
  ['spring', 1.5],
  ['fan', 1.1],
  ['bomb', 1],
];

const BUILD: Archetype[] = ['platform', 'crumble', 'spring'];
const HAZARD: Archetype[] = ['spikeblock', 'saw', 'flail', 'launcher', 'flamer', 'laser', 'tesla', 'crusher'];

const R = Math.PI / 2;
const AXIS = [0, R, 2 * R, 3 * R]; // right, down, left, up

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
  while (cells.length < n && guard++ < 300) {
    const [bx, by] = rng.chance(straightness) ? cells[cells.length - 1] : rng.pick(cells);
    const [dx, dy] = rng.chance(straightness) ? dirs[0] : rng.pick(dirs);
    if (!has(bx + dx, by + dy)) cells.push([bx + dx, by + dy]);
  }
  return normalizeCells(cells);
}

/** Cells of `cells` whose neighbor in direction (dx, dy) is not in the set. */
export function exposed(cells: readonly Cell[], dx: number, dy: number): Cell[] {
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  return cells.filter(([x, y]) => !set.has(`${x + dx},${y + dy}`));
}

const GENERIC_ADJ = [
  'Suspicious',
  'Vintage',
  'Cursed',
  'Deluxe',
  'Discount',
  'Haunted',
  'Artisanal',
  'Bootleg',
  'Certified',
  'Recalled',
  'Sentient',
  'Lukewarm',
  'Forbidden',
  'Gilded',
  'Feral',
  'Bespoke',
  'Ominous',
];
const SUFFIX = ['Mk II', 'Mk III', 'XL', 'Deluxe', 'Pro', '9000', 'of Regret', 'of Doom', 'Jr.', 'Classic', 'Ultra'];

function title(rng: Rng, adjs: string[], nouns: string[]): string {
  const adj = adjs.length && rng.chance(0.8) ? rng.pick(adjs) : rng.pick(GENERIC_ADJ);
  const name = `${adj} ${rng.pick(nouns)}`;
  return rng.chance(0.18) ? `${name} ${rng.pick(SUFFIX)}` : name;
}

function rollStyle(rng: Rng): PropStyle {
  return {
    metal: rng.weighted<MetalStyle>([
      ['steel', 3],
      ['brass', 2],
      ['copper', 1.5],
      ['rust', 1.5],
      ['obsidian', 1],
      ['bone', 0.8],
      ['jade', 0.7],
      ['gold', 0.5],
    ]),
    trim: rng.weighted<Trim>([
      ['none', 2],
      ['stripes', 2],
      ['rivets', 3],
      ['runes', 1],
      ['gems', 1],
    ]),
    hue: rng.range(0, 360),
    glowHue: rng.pick([0, 15, 35, 50, 120, 170, 190, 210, 280, 300, 330]) + rng.range(-10, 10),
    woodHue: rng.range(18, 38),
  };
}

const metalBody = (cells: Cell[]): Module => ({ type: 'body', cells, material: 'metal', conveyor: 0, breakFrames: 0, respawnFrames: 0 });
const center = (x = 0, y = 0): Vec => [x + 0.5, y + 0.5];

function footprintOf(modules: Module[]): Cell[] {
  const set = new Map<string, Cell>();
  for (const m of modules) for (const c of moduleSim(m.type).anchors(m)) set.set(`${c[0]},${c[1]}`, c);
  return normalizeCells([...set.values()]);
}

interface Recipe {
  archetype: Archetype;
  role: Role;
  name: string;
  modules: Module[];
  motion?: Motion;
}

/** Generate one prop of the given archetype. */
export function generateProp(rng: Rng, archetype: Archetype, key: string): PropDef {
  const style = rollStyle(rng);
  const recipe = RECIPES[archetype](rng, style);
  return {
    key,
    maker: makerName(rng),
    style,
    motion: recipe.motion ?? { type: 'none' },
    archetype: recipe.archetype,
    role: recipe.role,
    name: recipe.name,
    modules: recipe.modules,
    footprint: footprintOf(recipe.modules),
  };
}

const RECIPES: Record<Archetype, (rng: Rng, style: PropStyle) => Recipe> = {
  platform(rng) {
    const moving = rng.chance(0.35);
    const n = rng.weighted([
      [1, 1],
      [2, 2.5],
      [3, 3],
      [4, 2],
      [5, 1],
    ] as const);
    const material = moving
      ? rng.weighted<Material>([
          ['metal', 3],
          ['wood', 2],
          ['stone', 1],
          ['ice', 1],
        ])
      : rng.weighted<Material>([
          ['stone', 3],
          ['metal', 2],
          ['wood', 2],
          ['ice', 2],
          ['conveyor', 2],
          ['goo', 1.3],
          ['jelly', 1.5],
        ]);
    const cells = polyomino(rng, n, moving || material === 'conveyor' ? 0.8 : 0.3);
    const conveyor = material === 'conveyor' ? rng.sign() * rng.range(50, 115) : 0;
    const modules: Module[] = [{ type: 'body', cells, material, conveyor, breakFrames: 0, respawnFrames: 0 }];
    const spiky = rng.chance(0.22);
    if (spiky) {
      const dir = rng.pick([1, 2]); // down or left/right
      const a = dir === 1 ? AXIS[1] : rng.pick([AXIS[0], AXIS[2]]);
      const [dx, dy] = [Math.round(Math.cos(a)), Math.round(Math.sin(a))];
      modules.push({ type: 'spikes', cells: exposed(cells, dx, dy), angle: a });
    }
    let motion: Motion = { type: 'none' };
    if (moving) {
      motion = rng.chance(0.7)
        ? { type: 'rail', angle: rng.pick([AXIS[0], AXIS[3]]), range: rng.int(2, 6), period: rng.int(110, 260) }
        : { type: 'loop', radius: rng.range(1.2, 2.5), period: rng.int(160, 300), dir: rng.sign() };
    }
    const nouns: Record<Material, string[]> = {
      stone: ['Slab', 'Boulder', 'Chunk', 'Brick'],
      metal: ['Girder', 'Plate', 'Bulkhead'],
      wood: ['Plank', 'Crate', 'Raft'],
      ice: ['Glacier', 'Ice Block', 'Frost Slab'],
      conveyor: ['Conveyor', 'Belt', 'Treadmill'],
      goo: ['Goo Block', 'Gum Slab', 'Jam Brick'],
      jelly: ['Jelly', 'Trampolard', 'Wobbler'],
      crumble: ['Biscuit'],
    };
    const adjs: string[] = [];
    if (n >= 5) adjs.push('Chonky', 'Mega');
    if (n === 1) adjs.push('Tiny', 'Lil');
    if (moving) adjs.push(motion.type === 'loop' ? 'Orbiting' : 'Restless', 'Wandering');
    if (spiky) adjs.push('Spiky', 'Prickly');
    if (Math.abs(conveyor) > 95) adjs.push('Turbo', 'Express');
    return { archetype: 'platform', role: spiky ? 'hazard' : 'build', name: title(rng, adjs, nouns[material]), modules, motion };
  },

  crumble(rng) {
    const n = rng.int(2, 4);
    const breakFrames = rng.int(14, 45);
    const cells = polyomino(rng, n, 0.75);
    const adjs = breakFrames < 22 ? ['Flimsy', 'Fragile', 'Anxious'] : breakFrames > 38 ? ['Sturdy-ish', 'Patient'] : ['Crumbly', 'Stale'];
    return {
      archetype: 'crumble',
      role: 'build',
      name: title(rng, adjs, ['Biscuit', 'Crumbler', 'Rubble', 'Wafer', 'Shortbread']),
      modules: [{ type: 'body', cells, material: 'crumble', conveyor: 0, breakFrames, respawnFrames: rng.int(150, 300) }],
    };
  },

  spikeblock(rng) {
    const cells = polyomino(
      rng,
      rng.weighted([
        [1, 2],
        [2, 3],
        [3, 2],
        [4, 1],
      ] as const),
      0.6,
    );
    const modules: Module[] = [metalBody(cells)];
    const dirs = rng.shuffle([0, 1, 2, 3]).slice(
      0,
      rng.weighted([
        [1, 3],
        [2, 2],
        [4, 1],
      ] as const),
    );
    for (const d of dirs) {
      const a = AXIS[d];
      modules.push({ type: 'spikes', cells: exposed(cells, Math.round(Math.cos(a)), Math.round(Math.sin(a))), angle: a });
    }
    return {
      archetype: 'spikeblock',
      role: 'hazard',
      name: title(rng, dirs.length === 4 ? ['Very Pointy', 'Hostile', 'Urchin'] : ['Pointy', 'Rude', 'Prickly'], [
        'Spike Block',
        'Caltrop',
        'Thornbox',
        'Pincushion',
      ]),
      modules,
    };
  },

  saw(rng) {
    const variant = rng.weighted([
      ['static', 1.5],
      ['rail', 2],
      ['orbit', 2.2],
      ['pendulum', 1.5],
    ] as const);
    const head: Head = variant === 'pendulum' && rng.chance(0.45) ? 'axe' : 'saw';
    const base = { type: 'swinger' as const, head, hub: center(), dir: rng.sign(), link: 'none' as const };
    switch (variant) {
      case 'static': {
        const radius = rng.range(0.6, 1.35);
        return {
          archetype: 'saw',
          role: 'hazard',
          name: title(rng, radius > 1.1 ? ['Mega', 'Industrial'] : ['Stationary', 'Lazy', 'Loyal'], ['Buzzsaw', 'Grinder', 'Shredder']),
          modules: [{ ...base, arm: 0, angle0: 0, period: rng.int(20, 40), swing: 0, radius, count: 1 }],
        };
      }
      case 'rail': {
        const range = rng.int(2, 6);
        const period = rng.int(80, 220);
        return {
          archetype: 'saw',
          role: 'hazard',
          name: title(rng, (range * 2) / period > 0.06 ? ['Frantic', 'Unhinged', 'Zippy'] : ['Patrolling', 'Wandering'], [
            'Rail Saw',
            'Track Grinder',
            'Saw Sled',
          ]),
          modules: [{ ...base, arm: 0, angle0: 0, period: 30, swing: 0, radius: rng.range(0.5, 1), count: 1 }],
          motion: { type: 'rail', angle: rng.pick([AXIS[0], AXIS[3]]), range, period },
        };
      }
      case 'orbit': {
        const count = rng.weighted([
          [1, 3],
          [2, 2],
          [3, 1],
        ] as const);
        const period = rng.int(90, 240);
        return {
          archetype: 'saw',
          role: 'hazard',
          name: title(rng, count > 1 ? ['Twin', 'Triple', 'Spinny'] : period < 120 ? ['Frantic', 'Dizzy'] : ['Orbiting', 'Lazy'], [
            'Orbit Saw',
            'Saw Carousel',
            'Blade Wheel',
          ]),
          modules: [
            metalBody([[0, 0]]),
            { ...base, link: 'rod', arm: rng.range(1.4, 3), angle0: rng.range(0, Math.PI * 2), period, swing: 0, radius: rng.range(0.45, 0.8), count },
          ],
        };
      }
      case 'pendulum': {
        return {
          archetype: 'saw',
          role: 'hazard',
          name: title(
            rng,
            ['Swinging', 'Hypnotic', 'Tick-Tock'],
            head === 'axe' ? ['Pendulum Axe', 'Guillotine', 'Executioner'] : ['Pendulum Saw', 'Swing Blade'],
          ),
          modules: [
            metalBody([[0, 0]]),
            {
              ...base,
              link: rng.chance(0.5) ? 'chain' : 'rod',
              arm: rng.range(2, 3.6),
              angle0: Math.PI / 2,
              period: rng.int(100, 200),
              swing: rng.range(0.7, 1.3),
              radius: rng.range(0.6, 1),
              count: 1,
            },
          ],
        };
      }
    }
  },

  flail(rng) {
    const pend = rng.chance(0.5);
    const radius = rng.range(0.55, 1.1);
    return {
      archetype: 'flail',
      role: 'hazard',
      name: title(
        rng,
        radius > 0.95 ? ['Wrecking', 'Hefty'] : pend ? ['Swinging', 'Medieval'] : ['Whirling', 'Dizzy'],
        radius > 0.95 ? ['Wrecking Ball', 'Demolisher'] : ['Flail', 'Morning Star', 'Mace'],
      ),
      modules: [
        metalBody([[0, 0]]),
        {
          type: 'swinger',
          head: 'mace',
          hub: center(),
          link: 'chain',
          arm: rng.range(1.8, 3.4),
          angle0: pend ? Math.PI / 2 : rng.range(0, 6.28),
          period: rng.int(100, 230),
          swing: pend ? rng.range(0.8, 1.4) : 0,
          dir: rng.sign(),
          radius,
          count: !pend && rng.chance(0.25) ? 2 : 1,
        },
      ],
    };
  },

  launcher(rng) {
    const style = rng.weighted<LauncherStyle>([
      ['crossbow', 3],
      ['ballista', 1.2],
      ['cannon', 2],
      ['totem', 1.5],
      ['turret', 1.5],
      ['thrower', 1.2],
    ]);
    const ammo: Ammo = (
      {
        crossbow: rng.chance(0.6) ? 'bolt' : 'arrow',
        ballista: 'bolt',
        cannon: 'cannonball',
        totem: 'fireball',
        turret: 'plasma',
        thrower: 'shuriken',
      } as const
    )[style];
    const aim = rng.weighted<Aim>([
      ['fixed', 5],
      ['sweep', 2],
      ['track', style === 'cannon' ? 0.5 : 2],
    ]);
    const lobbed = AMMO[ammo].gravity > 200;
    const angle = lobbed ? -rng.range(0.35, 0.8) : 0;
    const spread =
      style === 'totem' || style === 'thrower'
        ? rng.weighted([
            [1, 2],
            [3, 1.5],
            [5, 0.4],
          ] as const)
        : 1;
    const burst = style === 'turret' ? rng.int(2, 4) : style === 'crossbow' && rng.chance(0.25) ? 2 : 1;
    const interval = style === 'ballista' ? rng.int(110, 170) : style === 'turret' ? rng.int(80, 140) : rng.int(55, 140);
    const speed = (
      {
        crossbow: rng.range(200, 300),
        ballista: rng.range(330, 420),
        cannon: rng.range(220, 300),
        totem: rng.range(80, 140),
        turret: rng.range(200, 270),
        thrower: rng.range(150, 220),
      } as const
    )[style];
    const nouns: Record<LauncherStyle, string[]> = {
      crossbow: ['Crossbow', 'Arbalest', 'Bolt Thrower'],
      ballista: ['Ballista', 'Siege Bow', 'Scorpion'],
      cannon: ['Cannon', 'Mortar', 'Bombard'],
      totem: ['Fire Totem', 'Hex Idol', 'Ember Shrine'],
      turret: ['Plasma Turret', 'Zapper', 'Blaster'],
      thrower: ['Star Thrower', 'Shuriken Shrine', 'Ninja Box'],
    };
    const adjs: string[] = [];
    if (aim === 'track') adjs.push('Vigilant', 'Paranoid', 'Heat-Seeking');
    if (aim === 'sweep') adjs.push('Sweeping', 'Indecisive', 'Restless');
    if (interval < 70) adjs.push('Trigger-happy', 'Twitchy');
    if (spread > 1) adjs.push(spread === 5 ? 'Fan-Fire' : 'Triple', 'Scattershot');
    if (burst > 2) adjs.push('Chatty', 'Rapid');
    return {
      archetype: 'launcher',
      role: 'hazard',
      name: title(rng, adjs, nouns[style]),
      modules: [
        {
          type: 'body',
          cells: [[0, 0]],
          material: style === 'crossbow' || style === 'totem' ? 'wood' : 'metal',
          conveyor: 0,
          breakFrames: 0,
          respawnFrames: 0,
        },
        {
          type: 'launcher',
          style,
          ammo,
          at: center(),
          angle,
          aim,
          sweep: aim === 'sweep' ? rng.range(0.4, 1.1) : 0,
          sweepPeriod: rng.int(150, 300),
          interval,
          burst,
          spread,
          spreadAngle: rng.range(0.18, 0.35),
          speed,
        },
      ],
    };
  },

  flamer(rng) {
    const length = rng.int(2, 5);
    const on = rng.int(40, 95);
    return {
      archetype: 'flamer',
      role: 'hazard',
      name: title(rng, length >= 4 ? ['Long-Range', 'Ambitious'] : on > 80 ? ['Relentless', 'Hungry'] : ['Hiccuping', 'Grumpy'], [
        'Flamethrower',
        'Dragon Vent',
        'Furnace Jet',
        'Fire Spout',
      ]),
      modules: [metalBody([[0, 0]]), { type: 'flame', at: center(), angle: AXIS[3], length, on, off: rng.int(60, 140), warn: rng.int(24, 40) }],
    };
  },

  laser(rng) {
    const sweep = rng.chance(0.45) ? rng.range(0.4, 1.2) : 0;
    return {
      archetype: 'laser',
      role: 'hazard',
      name: title(rng, sweep ? ['Sweeping', 'Lighthouse', 'Searching'] : ['Focused', 'Unblinking', 'Judgmental'], [
        'Laser',
        'Death Ray',
        'Lumen Lance',
        'Photon Pike',
      ]),
      modules: [
        metalBody([[0, 0]]),
        {
          type: 'laser',
          at: center(),
          angle: AXIS[0],
          charge: rng.int(45, 75),
          fire: rng.int(30, 80),
          off: rng.int(60, 160),
          sweep,
          sweepPeriod: rng.int(170, 300),
        },
      ],
    };
  },

  tesla(rng) {
    const d = rng.int(2, 5);
    return {
      archetype: 'tesla',
      role: 'hazard',
      name: title(rng, d >= 4 ? ['Wide', 'Ambitious'] : ['Crackling', 'Buzzing', 'Static'], ['Tesla Gate', 'Arc Pylons', 'Zap Fence', 'Spark Gap']),
      modules: [
        metalBody([
          [0, 0],
          [d, 0],
        ]),
        { type: 'tesla', a: center(0, 0), b: center(d, 0), on: rng.int(40, 90), off: rng.int(60, 130), warn: 30 },
      ],
    };
  },

  crusher(rng) {
    const width = rng.weighted([
      [1, 2],
      [2, 2],
      [3, 1],
    ] as const);
    const cells = Array.from({ length: width }, (_, i) => [i, 0] as Cell);
    const period = rng.int(90, 190);
    return {
      archetype: 'crusher',
      role: 'hazard',
      name: title(rng, period < 120 ? ['Eager', 'Hyperactive'] : width === 3 ? ['Mega', 'Industrial'] : ['Patient', 'Grumpy'], [
        'Crusher',
        'Piston',
        'Smasher',
        'Thwacker',
        'Stamper',
      ]),
      modules: [metalBody(cells), { type: 'piston', at: [width / 2, 0.5], angle: AXIS[1], reach: rng.range(2, 5), width, period }],
    };
  },

  spring(rng) {
    const power = rng.range(520, 820);
    return {
      archetype: 'spring',
      role: 'utility',
      name: title(rng, power > 720 ? ['Overclocked', 'Ballistic'] : power < 600 ? ['Wimpy', 'Polite'] : ['Bouncy', 'Springy'], [
        'Spring',
        'Launcher',
        'Boing',
        'Trampoline',
      ]),
      modules: [{ type: 'spring', at: center(), angle: AXIS[3], power }],
    };
  },

  fan(rng) {
    const strength = rng.range(1300, 2800);
    return {
      archetype: 'fan',
      role: 'utility',
      name: title(rng, strength > 2300 ? ['Hurricane', 'Industrial'] : strength < 1700 ? ['Gentle', 'Asthmatic'] : ['Breezy', 'Gusty'], [
        'Fan',
        'Blower',
        'Gust Box',
        'Turbine',
      ]),
      modules: [metalBody([[0, 0]]), { type: 'fan', at: center(), angle: AXIS[3], length: rng.int(3, 8), strength }],
    };
  },

  bomb(rng) {
    const radius = rng.range(1.6, 3.6);
    return {
      archetype: 'bomb',
      role: 'demolish',
      name: title(rng, radius > 3 ? ['Big', 'Excessive'] : radius < 2.1 ? ['Polite', 'Small'] : ['Volatile', 'Grumpy'], [
        'Bomb',
        'Charge',
        'Kaboom',
        `${word(rng, 1, 2)}-Bomb`,
      ]),
      modules: [{ type: 'bomb', radius }],
    };
  },
};

/**
 * The selection offered at the start of a round. Deterministic for
 * (seed, round). Always at least one building piece and one hazard.
 */
export function generateCrate(seed: number, round: number, count: number): PropDef[] {
  const rng = new Rng(deriveSeed(seed, `crate:${round}`));
  const kinds: Archetype[] = [rng.pick(BUILD), rng.pick(HAZARD)];
  while (kinds.length < count) kinds.push(rng.weighted(ARCHETYPE_WEIGHTS));
  rng.shuffle(kinds);
  return kinds.map((k, i) => generateProp(new Rng(deriveSeed(seed, `prop:${round}:${i}`)), k, `${round}-${i}`));
}
