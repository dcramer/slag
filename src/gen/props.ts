import { dcos, dsin, sq } from '../core/dmath';
import { type Cell, normalizeCells, type Vec } from '../core/geom';
import { moduleSim } from '../sim/props/registry';
import '../sim/props/modules';
import type { Aim, Ammo, Archetype, Head, LauncherStyle, Material, MetalStyle, Module, Motion, PropDef, PropStyle, Role, Trim } from '../sim/props/types';

import { ITEM_KINDS, type ItemKind } from '../sim/items/types';
import { AMMO, type MysteryLook } from '../sim/props/types';

export type { Aim, Ammo, Archetype, Head, LauncherStyle, Material, MetalStyle, Module, Motion, PropDef, PropStyle, Role, Trim };
export { AMMO };

import { deriveSeed, Rng } from '../core/rng';
import { BRIDGE_W } from './level/types';
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
  ['launcher', 3.8],
  ['flamer', 1.2],
  ['laser', 1.2],
  ['tesla', 1],
  ['crusher', 1],
  ['spring', 1.5],
  ['fan', 1.1],
  ['bomb', 1],
  ['emp', 0.6],
  ['drill', 0.7],
  ['charge', 0.6],
  ['timebomb', 0.5],
  ['spikestrip', 1.8],
  ['icecoat', 1.1],
  ['slimecoat', 1.1],
  ['portal', 1],
  ['bumper', 0.9],
  ['magnet', 0.9],
  ['web', 0.8],
  ['blinker', 1.1],
  ['dropper', 1.1],
  ['snapper', 1.1],
  ['wheel', 0.9],
  ['hangar', 1],
  ['mystery', 1.3],
  ['rope', 1],
  ['keg', 1],
];

/** Demolition archetypes: detonated (now or at race start) rather than built. */
/**
 * Weight a stuck match adds to the parts that get it moving, per step of
 * DRY_RAMP: bombs and breakers clear what's in the way, building parts cross
 * it. Anything not listed here keeps its weight, and pure hazards give some up.
 */
const DRY_PUSH: Partial<Record<Archetype, number>> = {
  bomb: 2.4,
  charge: 2,
  drill: 2,
  timebomb: 1.6,
  platform: 0.8,
  crumble: 0.6,
  spring: 0.4,
};
/** How much pure hazards fade per step of DRY_RAMP. */
const DRY_HAZARD_FADE = 0.3;
/**
 * Strength of the push by rounds in a row nobody finished, last entry held.
 * Round 1 of a level usually can't be finished, so one dry round is a nudge,
 * and it's capped so a crate stays a crate rather than a pile of bombs.
 */
const DRY_RAMP = [0, 0.15, 0.8, 1.5, 2, 2.4];

/** The archetype table a crate rolls from after `dry` rounds with no finisher. */
export function crateWeights(dry: number): readonly (readonly [Archetype, number])[] {
  const k = DRY_RAMP[Math.min(dry, DRY_RAMP.length - 1)];
  return ARCHETYPE_WEIGHTS.map(([a, w]) => {
    const push = DRY_PUSH[a];
    return [a, push ? w * (1 + push * k) : HAZARD.includes(a) ? w / (1 + DRY_HAZARD_FADE * k) : w] as const;
  });
}

export const DEMOLISH: ReadonlySet<Archetype> = new Set(['bomb', 'emp', 'drill', 'charge', 'timebomb']);

/** Launcher aim mix: fixed clearly dominates so trackers stay special (cannons/mortars track a third as often). */
export const LAUNCHER_AIM_WEIGHTS: readonly (readonly [Aim, number])[] = [
  ['fixed', 7],
  ['sweep', 2],
  ['track', 1.5],
];

const HAZARD: Archetype[] = ['spikestrip', 'spikeblock', 'saw', 'flail', 'launcher', 'flamer', 'laser', 'tesla', 'crusher', 'dropper', 'snapper'];

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
  mount?: 'face' | 'hang';
  /** Placement cells when they're more than the modules' anchors (e.g. a wheel's swept disk). */
  footprint?: Cell[];
}

/** Generate one prop of the given archetype. */
export function generateProp(rng: Rng, archetype: Archetype, key: string): PropDef {
  const style = rollStyle(rng);
  return assemble(rng, RECIPES[archetype](rng, style), style, key);
}

function assemble(rng: Rng, recipe: Recipe, style: PropStyle, key: string): PropDef {
  return {
    key,
    maker: makerName(rng),
    style,
    motion: recipe.motion ?? { type: 'none' },
    archetype: recipe.archetype,
    role: recipe.role,
    name: recipe.name,
    modules: recipe.modules,
    footprint: recipe.footprint ? normalizeCells(recipe.footprint) : footprintOf(recipe.modules),
    ...(recipe.mount ? { mount: recipe.mount } : {}),
  };
}

/** Good footing: it holds still, doesn't crumble and doesn't throw you around. */
const FOOTING: Partial<Record<Material, string[]>> = {
  stone: ['Slab', 'Ledge'],
  metal: ['Girder', 'Plate'],
  wood: ['Plank', 'Beam'],
};

/**
 * The part worldgen's solvability proof is about: a static, solid strip
 * BRIDGE_W long that stands wherever a solution needs one. Other building
 * parts might do the job too (or be a one-tile moving jelly), so the crate's
 * guarantee is made of these.
 */
export function generateBridge(rng: Rng, key: string): PropDef {
  const material = rng.pick(Object.keys(FOOTING) as Material[]);
  const name = title(rng, ['Trusty', 'Sturdy', 'Solid', 'Dependable'], FOOTING[material]!);
  const modules: Module[] = [{ type: 'body', cells: strip(BRIDGE_W), material, conveyor: 0, breakFrames: 0, respawnFrames: 0 }];
  return assemble(rng, { archetype: 'platform', role: 'build', name, modules }, rollStyle(rng), key);
}

/** True for a part that can stand in for a bridge in a level's solution. */
export function isBridgePart(def: PropDef): boolean {
  if (def.role !== 'build' || def.motion.type !== 'none' || def.modules.length !== 1) return false;
  const m = def.modules[0];
  if (m.type !== 'body' || m.breakFrames > 0 || m.conveyor !== 0 || !(m.material in FOOTING)) return false;
  const rows = new Set(m.cells.map((c) => c[1]));
  return rows.size === 1 && m.cells.length === BRIDGE_W;
}

/** A straight strip of `n` host cells along x, facing up at rot 0 (rotation picks the face). */
const strip = (n: number): Cell[] => Array.from({ length: n }, (_, i) => [i, 0] as Cell);

const RECIPES: Record<Archetype, (rng: Rng, style: PropStyle) => Recipe> = {
  spikestrip(rng) {
    const n = rng.weighted([
      [1, 2],
      [2, 3],
      [3, 2.5],
      [4, 1.2],
      [5, 0.5],
    ] as const);
    return {
      archetype: 'spikestrip',
      role: 'hazard',
      mount: 'face',
      name: title(rng, n >= 4 ? ['Long', 'Endless', 'Very Pointy'] : n === 1 ? ['Lone', 'Tiny', 'Single'] : ['Pointy', 'Rude', 'Prickly'], [
        'Spikes',
        'Spike Strip',
        'Caltrops',
        'Thorns',
      ]),
      modules: [{ type: 'coat', cells: strip(n), angle: -Math.PI / 2, kind: 'spikes' }],
    };
  },
  icecoat(rng) {
    const n = rng.int(2, 5);
    return {
      archetype: 'icecoat',
      role: 'hazard',
      mount: 'face',
      name: title(rng, n >= 4 ? ['Treacherous', 'Glacial'] : ['Slippery', 'Frosty', 'Polished'], ['Ice Patch', 'Frost Coat', 'Black Ice', 'Glaze']),
      modules: [{ type: 'coat', cells: strip(n), angle: -Math.PI / 2, kind: 'ice' }],
    };
  },
  slimecoat(rng) {
    const n = rng.int(2, 5);
    return {
      archetype: 'slimecoat',
      role: 'utility',
      mount: 'face',
      name: title(rng, n >= 4 ? ['Gloopy', 'Industrial'] : ['Sticky', 'Gooey', 'Questionable'], ['Slime', 'Goo Coat', 'Gunk', 'Honey Glaze']),
      modules: [{ type: 'coat', cells: strip(n), angle: -Math.PI / 2, kind: 'slime' }],
    };
  },
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
      const [dx, dy] = [Math.round(dcos(a)), Math.round(dsin(a))];
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
      modules.push({ type: 'spikes', cells: exposed(cells, Math.round(dcos(a)), Math.round(dsin(a))), angle: a });
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
    const style = rng.weighted<Exclude<LauncherStyle, 'hangar'>>([
      ['crossbow', 3],
      ['ballista', 1.2],
      ['cannon', 2],
      ['totem', 1.5],
      ['turret', 1.5],
      ['thrower', 1.2],
      ['rocket', 0.45],
      ['glaive', 1.1],
      ['gumball', 1.1],
      ['mortar', 1],
      ['gooper', 1],
      ['cryo', 1],
      ['prism', 1],
    ]);
    const ammo: Ammo = (
      {
        crossbow: rng.chance(0.6) ? 'bolt' : 'arrow',
        ballista: 'bolt',
        cannon: 'cannonball',
        totem: 'fireball',
        turret: 'plasma',
        thrower: 'shuriken',
        rocket: 'seeker',
        glaive: 'boomerang',
        gumball: 'rubber',
        mortar: 'cluster',
        gooper: 'goo',
        cryo: 'frost',
        prism: 'ricochet',
      } as const
    )[style];
    // Seekers steer themselves; boomerangs and bank shots read best on a fixed line.
    const aim =
      style === 'rocket' || style === 'prism'
        ? 'fixed'
        : rng.weighted<Aim>(
            LAUNCHER_AIM_WEIGHTS.map(
              ([k, w]) => [k, k === 'track' && (style === 'cannon' || style === 'mortar') ? w / 3 : k === 'track' && style === 'glaive' ? 0 : w] as const,
            ),
          );
    const lobbed = AMMO[ammo].gravity > 200;
    const angle = lobbed ? -rng.range(0.35, 0.8) : style === 'prism' ? rng.sign() * rng.range(0.4, 0.85) : style === 'rocket' ? -0.5 : 0;
    const spread =
      style === 'totem' || style === 'thrower'
        ? rng.weighted([
            [1, 2],
            [3, 1.5],
            [5, 0.4],
          ] as const)
        : style === 'prism' && rng.chance(0.35)
          ? 2
          : 1;
    const burst = style === 'turret' ? rng.int(2, 4) : (style === 'crossbow' || style === 'cryo') && rng.chance(0.25) ? 2 : 1;
    const interval =
      style === 'ballista'
        ? rng.int(110, 170)
        : style === 'turret'
          ? rng.int(80, 140)
          : style === 'rocket'
            ? rng.int(160, 240)
            : style === 'mortar'
              ? rng.int(120, 180)
              : style === 'glaive'
                ? rng.int(100, 160)
                : style === 'gooper' || style === 'cryo' || style === 'gumball' || style === 'prism'
                  ? rng.int(75, 140)
                  : rng.int(55, 140);
    const speed = (
      {
        crossbow: rng.range(200, 300),
        ballista: rng.range(330, 420),
        cannon: rng.range(220, 300),
        totem: rng.range(80, 140),
        turret: rng.range(200, 270),
        thrower: rng.range(150, 220),
        rocket: rng.range(90, 125),
        glaive: rng.range(230, 300),
        gumball: rng.range(170, 230),
        mortar: rng.range(210, 260),
        gooper: rng.range(160, 220),
        cryo: rng.range(230, 290),
        prism: rng.range(230, 300),
      } as const
    )[style];
    const nouns: Record<Exclude<LauncherStyle, 'hangar'>, string[]> = {
      crossbow: ['Crossbow', 'Arbalest', 'Bolt Thrower'],
      ballista: ['Ballista', 'Siege Bow', 'Scorpion'],
      cannon: ['Cannon', 'Mortar', 'Bombard'],
      totem: ['Fire Totem', 'Hex Idol', 'Ember Shrine'],
      turret: ['Plasma Turret', 'Zapper', 'Blaster'],
      thrower: ['Star Thrower', 'Shuriken Shrine', 'Ninja Box'],
      rocket: ['Seeker Pod', 'Homing Rack', 'Missile Nest'],
      glaive: ['Boomerang Arm', 'Glaive Flinger', 'Returner'],
      gumball: ['Gumball Machine', 'Ball Pitcher', 'Bouncer'],
      mortar: ['Cluster Mortar', 'Splitter', 'Scatter Shell'],
      gooper: ['Goo Gun', 'Slime Spitter', 'Gunk Lobber'],
      cryo: ['Freeze Ray', 'Cryo Cannon', 'Frost Spitter'],
      prism: ['Prism', 'Bank-Shot Lens', 'Ricochet Eye'],
    };
    const STYLE_ADJ: Partial<Record<LauncherStyle, string[]>> = {
      rocket: ['Relentless', 'Clingy', 'Persistent'],
      glaive: ['Loyal', 'Homesick'],
      gumball: ['Bouncy', 'Rubbery'],
      mortar: ['Generous', 'Sharing'],
      gooper: ['Sloppy', 'Messy'],
      cryo: ['Chilly', 'Frigid'],
      prism: ['Reflective', 'Angular'],
    };
    const adjs: string[] = [...(STYLE_ADJ[style] ?? [])];
    // Moving aim always shows in the name (tracking also gets an eye on the art).
    const aimAdj =
      aim === 'track' ? rng.pick(['Vigilant', 'Paranoid', 'Watchful', 'Tracking']) : aim === 'sweep' ? rng.pick(['Sweeping', 'Indecisive', 'Swiveling']) : null;
    if (interval < 70) adjs.push('Trigger-happy', 'Twitchy');
    if (spread > 1) adjs.push(spread === 5 ? 'Fan-Fire' : 'Triple', 'Scattershot');
    if (burst > 2) adjs.push('Chatty', 'Rapid');
    return {
      archetype: 'launcher',
      role: 'hazard',
      name: aimAdj ? `${aimAdj} ${rng.pick(nouns[style])}` : title(rng, adjs, nouns[style]),
      modules: [
        {
          type: 'body',
          cells: [[0, 0]],
          material: style === 'crossbow' || style === 'totem' || style === 'glaive' ? 'wood' : 'metal',
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

  portal(rng) {
    const dx = rng.int(3, 8);
    const dy = rng.chance(0.4) ? rng.int(-3, 3) : 0;
    const ay = dy < 0 ? -dy : 0;
    const far = dx + Math.abs(dy) >= 8;
    return {
      archetype: 'portal',
      role: 'utility',
      name: title(rng, far ? ['Long-Distance', 'Interstate', 'Overambitious'] : ['Twin', 'Paired', 'Quantum', 'Entangled'], [
        'Warp Pads',
        'Warp Rings',
        'Wormhole',
        'Blink Gates',
        'Shortcut',
      ]),
      modules: [{ type: 'portal', a: center(0, ay), b: center(dx, ay + dy) }],
    };
  },

  bumper(rng) {
    const twin = rng.chance(0.25);
    const power = rng.range(330, 520);
    const radius = rng.range(0.42, 0.6);
    const modules: Module[] = [{ type: 'bumper', at: center(), radius, power }];
    if (twin) modules.push({ type: 'bumper', at: center(rng.int(2, 3), rng.pick([0, 1])), radius, power });
    const motion: Motion =
      !twin && rng.chance(0.3) ? { type: 'rail', angle: rng.pick([AXIS[0], AXIS[3]]), range: rng.int(2, 4), period: rng.int(120, 220) } : { type: 'none' };
    return {
      archetype: 'bumper',
      role: 'utility',
      name: title(rng, power > 460 ? ['Violent', 'Overcharged', 'Rowdy'] : twin ? ['Twin', 'Pinball'] : ['Bouncy', 'Jolly', 'Boisterous'], [
        'Bumper',
        'Pinball Post',
        'Boing Ball',
        'Kicker',
      ]),
      modules,
      motion,
    };
  },

  magnet(rng) {
    const pull = rng.chance(0.6);
    const pulse = rng.chance(0.4);
    const radius = rng.range(2.5, 4.2);
    const strength = pull ? rng.range(900, 1500) : rng.range(1100, 1900);
    const adjs = pulse
      ? ['Pulsing', 'Moody', 'Intermittent']
      : radius > 3.6
        ? ['Huge', 'Overbearing']
        : pull
          ? ['Needy', 'Clingy', 'Magnetic']
          : ['Aloof', 'Standoffish'];
    return {
      archetype: 'magnet',
      role: 'utility',
      name: title(rng, adjs, pull ? ['Gravity Well', 'Magnet Core', 'Tractor Orb', 'Attractor'] : ['Repulsor', 'Push Field', 'Anti-Magnet', 'Deflector Orb']),
      modules: [
        metalBody([[0, 0]]),
        {
          type: 'magnet',
          at: center(),
          radius,
          strength,
          polarity: pull ? 1 : -1,
          on: pulse ? rng.int(70, 130) : 0,
          off: pulse ? rng.int(60, 120) : 0,
          warn: 30,
        },
      ],
    };
  },

  web(rng) {
    const n = rng.int(3, 6);
    const drag = rng.range(0.18, 0.3);
    return {
      archetype: 'web',
      role: 'utility',
      name: title(rng, n >= 5 ? ['Sprawling', 'Ambitious'] : drag > 0.25 ? ['Extra-Sticky', 'Clingy'] : ['Sticky', 'Dusty', 'Abandoned'], [
        'Web',
        'Cobweb',
        'Net',
        'Snare',
        'Gossamer',
      ]),
      modules: [{ type: 'web', cells: polyomino(rng, n, 0.15), drag }],
    };
  },

  blinker(rng) {
    const pair = rng.chance(0.55);
    if (pair) {
      const n = rng.int(1, 3);
      const t = rng.int(70, 130);
      const dy = rng.pick([-1, 0, 0, 1]);
      const gap = rng.int(0, 1);
      const ya = dy < 0 ? 1 : 0;
      const a = strip(n).map(([x]) => [x, ya] as Cell);
      const b = strip(n).map(([x]) => [x + n + gap, ya + dy] as Cell);
      return {
        archetype: 'blinker',
        role: 'build',
        name: title(rng, t < 90 ? ['Hasty', 'Frantic', 'Flip-Flop'] : ['Alternating', 'Ping-Pong', 'Turn-Taking'], [
          'Blink Blocks',
          'Phase Bricks',
          'Strobe Slabs',
          'Swap Tiles',
        ]),
        modules: [
          { type: 'phase', cells: a, on: t, off: t, offset: 0 },
          { type: 'phase', cells: b, on: t, off: t, offset: t },
        ],
      };
    }
    const n = rng.int(2, 4);
    const on = rng.int(90, 150);
    const off = rng.int(50, 100);
    return {
      archetype: 'blinker',
      role: 'build',
      name: title(rng, off > 80 ? ['Unreliable', 'Flaky', 'Shy'] : ['Flickering', 'Blinking', 'Nervous'], [
        'Blink Blocks',
        'Phase Bricks',
        'Ghost Tiles',
        'Strobe Slabs',
      ]),
      modules: [{ type: 'phase', cells: strip(n), on, off, offset: 0 }],
    };
  },

  dropper(rng) {
    const w = rng.weighted([
      [1, 1],
      [2, 3],
    ] as const);
    const h = rng.weighted([
      [1, 1.5],
      [2, 1],
    ] as const);
    const cells: Cell[] = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push([x, y]);
    const warn = rng.int(14, 24);
    return {
      archetype: 'dropper',
      role: 'hazard',
      name: title(rng, warn < 17 ? ['Twitchy', 'Jumpy', 'Short-Tempered'] : w * h >= 4 ? ['Massive', 'Brooding'] : ['Grumpy', 'Glowering', 'Patient'], [
        'Dropstone',
        'Grudge Block',
        'Ceiling Smasher',
        'Skull Slab',
        'Pounder',
      ]),
      modules: [{ type: 'dropper', cells, angle: AXIS[1], reach: rng.int(4, 9), warn, rest: rng.int(40, 80) }],
    };
  },

  snapper(rng) {
    const n = rng.weighted([
      [1, 2],
      [2, 3],
      [3, 1.5],
    ] as const);
    const warn = rng.int(14, 24);
    return {
      archetype: 'snapper',
      role: 'hazard',
      mount: 'face',
      name: title(rng, warn < 17 ? ['Hair-Trigger', 'Jumpy', 'Snappy'] : ['Lurking', 'Sneaky', 'Patient'], [
        'Snap Trap',
        'Pop-Up Spikes',
        'Gotcha Plate',
        'Spring Spikes',
      ]),
      modules: [{ type: 'snapper', cells: strip(n), angle: -Math.PI / 2, warn, up: rng.int(24, 45), cool: rng.int(40, 80) }],
    };
  },

  mystery(rng) {
    const pools: Record<'shots' | 'gadgets' | 'mixed', ItemKind[]> = {
      shots: ['sword', 'puck', 'boomerang'],
      gadgets: ['shield', 'rocket', 'smoke'],
      mixed: [...ITEM_KINDS],
    };
    const poolId = rng.weighted([
      ['mixed', 3],
      ['shots', 1.5],
      ['gadgets', 1.5],
    ] as const);
    const uses = rng.weighted([
      [0, 2.5],
      [1, 1.5],
      [3, 1],
    ] as const);
    const refill = rng.int(150, 420);
    const look = rng.weighted<MysteryLook>([
      ['crate', 3],
      ['chest', 1.5],
      ['gift', 1.5],
    ]);
    const adjs: string[] = [];
    if (uses === 1) adjs.push('One-Shot', 'Collectible');
    else if (uses > 1) adjs.push('Stingy', 'Rationed');
    else if (refill < 230) adjs.push('Bottomless', 'Generous', 'Overflowing');
    else if (refill > 350) adjs.push('Sleepy', 'Patient');
    if (poolId === 'shots') adjs.push('Armed', 'Rowdy');
    if (poolId === 'gadgets') adjs.push('Gadget', 'Clever', 'Tinkerer’s');
    if (poolId === 'mixed') adjs.push('Mysterious', 'Chaotic', 'Unlabeled');
    const nouns: Record<MysteryLook, string[]> = {
      crate: ['Mystery Crate', 'Surprise Crate', 'Grab Box'],
      chest: ['Lucky Chest', 'Treasure Trunk'],
      gift: ['Gift Box', 'Present', 'Surprise Parcel'],
    };
    return {
      archetype: 'mystery',
      role: 'utility',
      name: title(rng, adjs, nouns[look]),
      modules: [{ type: 'mystery', cells: [[0, 0]], pool: pools[poolId], uses, refill, look, seed: rng.int(0, 1 << 20) }],
    };
  },

  wheel(rng) {
    const arm = rng.range(1.6, 2.5);
    const count = rng.weighted([
      [2, 2],
      [3, 3],
      [4, 1.5],
    ] as const);
    const period = rng.int(220, 380);
    const width = rng.range(1.4, 2.1);
    // Reserve the disk the platforms sweep, so it isn't placed into terrain. Its center
    // cell must be `hub - 0.5` after normalizing, so the disk has to touch x = 0 and y = 0.
    const reach = arm + width / 2;
    const r = Math.floor(reach);
    const disk: Cell[] = [];
    for (let y = 0; y <= 2 * r; y++) for (let x = 0; x <= 2 * r; x++) if (sq(x - r) + sq(y - r) <= reach * reach) disk.push([x, y]);
    return {
      archetype: 'wheel',
      role: 'build',
      name: title(rng, period < 260 ? ['Speedy', 'Giddy'] : count >= 4 ? ['Crowded', 'Generous'] : ['Lazy', 'Leisurely', 'Creaky'], [
        'Ferris Wheel',
        'Cog Lift',
        'Paddle Wheel',
        'Carousel',
      ]),
      modules: [
        {
          type: 'rotor',
          look: 'cog',
          support: 'none',
          mastX: 0,
          hub: center(r, r),
          arm,
          count,
          angle0: rng.range(0, Math.PI * 2),
          period,
          swing: 0,
          dir: rng.sign(),
          width,
          thick: 0.5,
          material: 'metal',
          seed: rng.int(0, 1 << 20),
        },
      ],
      footprint: disk,
    };
  },

  bomb(rng) {
    const radius = rng.range(1.4, 4.2);
    return {
      archetype: 'bomb',
      role: 'demolish',
      name: title(rng, radius > 3.2 ? ['Big', 'Excessive', 'Overkill'] : radius < 2.1 ? ['Polite', 'Small', 'Pocket'] : ['Volatile', 'Grumpy'], [
        'Bomb',
        'Charge',
        'Kaboom',
        `${word(rng, 1, 2)}-Bomb`,
      ]),
      modules: [{ type: 'bomb', radius, look: 'bomb' }],
    };
  },

  emp(rng) {
    const radius = rng.range(2.5, 4.5);
    return {
      archetype: 'emp',
      role: 'demolish',
      name: title(rng, radius > 3.8 ? ['Wide-Area', 'Total'] : ['Targeted', 'Tidy', 'Surgical'], ['EMP', 'Wrecking Pulse', 'Junk Zapper', 'Scrap Charge']),
      modules: [{ type: 'bomb', radius, target: 'props', look: 'emp' }],
    };
  },

  drill(rng) {
    const length = rng.int(5, 10);
    const width = rng.chance(0.3) ? 3 : 1;
    return {
      archetype: 'drill',
      role: 'demolish',
      name: title(rng, width === 3 ? ['Wide-Bore', 'Industrial'] : length >= 8 ? ['Deep', 'Determined'] : ['Pocket', 'Hand'], [
        'Drill',
        'Tunneler',
        'Bore Charge',
        'Mole',
      ]),
      modules: [{ type: 'bomb', radius: length, shape: 'line', target: 'terrain', width, look: 'drill' }],
    };
  },

  charge(rng) {
    const cross = rng.chance(0.55);
    const radius = cross ? rng.int(3, 6) : rng.range(2.6, 4);
    return {
      archetype: 'charge',
      role: 'demolish',
      name: title(
        rng,
        cross ? ['Four-Way', 'Plus-Sized', 'Crossroads'] : ['Hollow', 'Donut', 'Halo'],
        cross ? ['Cross Charge', 'Plus Bomb', 'Star Blast'] : ['Ring Charge', 'Ring Mine', 'Moat Maker'],
      ),
      modules: [{ type: 'bomb', radius, shape: cross ? 'cross' : 'ring', width: cross ? 1 : 1.3, look: 'charge' }],
    };
  },

  hangar(rng) {
    const speed = rng.range(60, 110);
    const interval = rng.int(110, 200);
    return {
      archetype: 'hangar',
      role: 'utility',
      name: title(rng, speed > 95 ? ['Express', 'Hasty'] : interval < 140 ? ['Busy', 'Generous'] : ['Leisurely', 'Scenic', 'Rickety'], [
        'Glider Hangar',
        'Kite Loft',
        'Plank Catapult',
        'Air Ferry',
      ]),
      modules: [
        { type: 'body', cells: [[0, 0]], material: 'wood', conveyor: 0, breakFrames: 0, respawnFrames: 0 },
        {
          type: 'launcher',
          style: 'hangar',
          ammo: 'glider',
          at: center(),
          angle: 0,
          aim: 'fixed',
          sweep: 0,
          sweepPeriod: 200,
          interval,
          burst: 1,
          spread: 1,
          spreadAngle: 0,
          speed,
        },
      ],
    };
  },

  rope(rng) {
    const length = rng.int(3, 7);
    const strain = rng.int(240, 420);
    const adjs =
      length <= 3
        ? ['Cocktail', 'Stubby', 'Snack-Size']
        : length >= 6
          ? ["Butcher's", 'Foot-Long', 'Unending']
          : strain < 300
            ? ['Overcooked', 'Day-Old', 'Bargain']
            : ['Prime', 'Smoked', 'Cured'];
    return {
      archetype: 'rope',
      role: 'utility',
      mount: 'hang',
      name: title(rng, adjs, ['Sausage Vine', 'Swinging Links', 'Banger Rope', 'Bratwurst Vine', 'Salami Swing']),
      modules: [{ type: 'rope', at: [0.5, 0], length, strain, regrow: rng.int(240, 360) }],
    };
  },

  keg(rng) {
    const dirs = rng.chance(0.55)
      ? rng.pick([
          [5, 6, 7, 6],
          [6, 7, 0, 7],
          [4, 5, 6, 5],
        ])
      : [rng.pick([6, 7, 5, 0])];
    const power = rng.int(460, 640);
    const delay = rng.int(8, 16);
    const adjs =
      dirs.length > 1
        ? ['Tipsy', 'Wobbly', 'Hiccuping']
        : delay <= 10
          ? ['Hair-Trigger', 'Jumpy', 'Twitchy']
          : power > 570
            ? ['Cask-Strength', 'High-Proof', 'Overproof']
            : ['Aged', 'Oak-Barreled', 'Home-Brewed'];
    return {
      archetype: 'keg',
      role: 'utility',
      name: title(rng, adjs, ['Kegapult', 'Powder Keg', 'Cask Cannon', 'Moonshine Mortar', 'Hooch Howitzer']),
      modules: [{ type: 'keg', at: center(0.5, 0.5), dirs, step: rng.int(28, 46), power, delay, burn: rng.int(130, 220) }],
    };
  },

  timebomb(rng) {
    const radius = rng.range(2, 3.2);
    const emp = rng.chance(0.3);
    return {
      archetype: 'timebomb',
      role: 'demolish',
      name: title(rng, emp ? ['Spiteful', 'Delayed'] : ['Ticking', 'Patient', 'Punctual'], ['Time Bomb', 'Alarm Clock', 'Ticking Parcel', 'Countdown']),
      modules: [{ type: 'bomb', radius, target: emp ? 'props' : 'all', look: 'clock', delay: true }],
    };
  },
};

/**
 * The selection offered at the start of a round. Deterministic for
 * (seed, round). Always at least one building piece and one hazard.
 */
/**
 * A round's crate. It always holds a hazard and a bridge part, and at least
 * `bridges` parts that can stand in for a bridge (capped so the hazard keeps
 * its place): what the level still needs, so a match can't run out of ways
 * to reach the flag. `dry`, rounds in a row nobody finished, tilts the rest
 * toward parts that unstick a match (crateWeights); nothing says so on screen.
 */
export function generateCrate(seed: number, round: number, count: number, bridges = 1, dry = 0): PropDef[] {
  const rng = new Rng(deriveSeed(seed, `crate:${round}`));
  const weights = crateWeights(dry);
  const need = Math.max(1, Math.min(bridges, count - 1));
  const kinds: Archetype[] = [rng.pick(HAZARD)];
  while (kinds.length + need < count) kinds.push(rng.weighted(weights));
  const made = kinds.map((k, i) => generateProp(new Rng(deriveSeed(seed, `prop:${round}:${i}`)), k, `${round}-${i}`));
  for (let i = 0; i < need; i++) made.push(generateBridge(new Rng(deriveSeed(seed, `bridge:${round}:${i}`)), `${round}-b${i}`));
  return rng.shuffle(made);
}
