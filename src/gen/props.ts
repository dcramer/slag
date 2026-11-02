import { dcos, dsin, sq } from '../core/dmath';
import { type Cell, normalizeCells, type Vec } from '../core/geom';
import { moduleSim } from '../sim/props/registry';
import { cardExtent } from '../sim/props/transform';
import '../sim/props/modules';
import type {
  Aim,
  Ammo,
  Archetype,
  Head,
  LauncherStyle,
  Material,
  MetalStyle,
  Module,
  Motion,
  PartSize,
  PropDef,
  PropStyle,
  Role,
  Trim,
} from '../sim/props/types';

import { ITEM_KINDS } from '../sim/items/types';
import { AMMO } from '../sim/props/types';

export type { Aim, Ammo, Archetype, Head, LauncherStyle, Material, MetalStyle, Module, Motion, PartSize, PropDef, PropStyle, Role, Trim };
export { AMMO };

import { deriveSeed, Rng } from '../core/rng';
import { BRIDGE_W } from './level/types';
import { makerName, word } from './names';

/**
 * Props are assembled from modules (bodies, spikes, swinging heads,
 * launchers, emitters...) by archetype recipes. A recipe rolls a part's
 * identity (name, look, timing, kinematics, ammo) once, so two matches' saws
 * are rarely the same thing, and a seed's roster (generateRoster) is the short
 * list a match's crates draw from. Within a match a part differs only in size.
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
  ['sentry', 1.1],
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

/**
 * How strongly a crate favors a roster part of this archetype after `dry`
 * rounds with no finisher. It starts level: ARCHETYPE_WEIGHTS already had its
 * say in the roster, and a rare part on a short list should still turn up.
 */
export function dryLean(archetype: Archetype, dry: number): number {
  const k = DRY_RAMP[Math.min(dry, DRY_RAMP.length - 1)];
  const push = DRY_PUSH[archetype];
  return push ? 1 + push * k : HAZARD.includes(archetype) ? 1 / (1 + DRY_HAZARD_FADE * k) : 1;
}

/** Demolition archetypes: detonated (now or at race start) rather than built. */
export const DEMOLISH: ReadonlySet<Archetype> = new Set(['bomb', 'emp', 'drill', 'charge', 'timebomb']);

/** Launcher aim mix: fixed clearly dominates so trackers stay special (cannons/mortars track a third as often). */
export const LAUNCHER_AIM_WEIGHTS: readonly (readonly [Aim, number])[] = [
  ['fixed', 7],
  ['sweep', 2],
  ['track', 1.5],
];

const HAZARD: Archetype[] = ['spikestrip', 'spikeblock', 'saw', 'flail', 'launcher', 'sentry', 'flamer', 'laser', 'tesla', 'crusher', 'dropper', 'snapper'];

const R = Math.PI / 2;
const AXIS = [0, R, 2 * R, 3 * R]; // right, down, left, up

/** Grow a connected shape by random accretion. Cells stay in growth order, so any prefix is the same shape, smaller. */
function growCells(rng: Rng, n: number, straightness = 0): Cell[] {
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
  return cells;
}

/** Grow a connected polyomino of `n` cells by random accretion. */
export function polyomino(rng: Rng, n: number, straightness = 0): Cell[] {
  return normalizeCells(growCells(rng, n, straightness));
}

/** Cells of `cells` whose neighbor in direction (dx, dy) is not in the set. */
export function exposed(cells: readonly Cell[], dx: number, dy: number): Cell[] {
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  return cells.filter(([x, y]) => !set.has(`${x + dx},${y + dy}`));
}

/** Box-art words: every part sounds like something off a bargain-bin shelf. */
const GENERIC_ADJ = [
  'Bootleg',
  'Cursed',
  'Unpatched',
  'Glitched',
  'Beta',
  'Retro',
  'Legendary',
  'Shiny',
  'Pre-Order',
  'Early-Access',
  'Licensed',
  'Unlicensed',
  'Haunted',
  'Discount',
  'Overpowered',
  'Nerfed',
  'Suspicious',
];
/** Sequel and re-release tags. */
const SUFFIX = ['II', 'DX', 'HD', 'Turbo', '64', 'EX', 'Zero', 'Remastered', 'Deluxe', 'Classic', 'GOTY'];

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

/** What a part is made of at one size. */
interface Shape {
  modules: Module[];
  motion?: Motion;
  /** Placement cells when they're more than the modules' anchors (e.g. a wheel's swept disk). */
  footprint?: Cell[];
}

/**
 * A rolled part. `sized` runs after every roll, so a part's sizes can't differ
 * in anything else. Parts with nothing to scale (a one-tile launcher, a keg)
 * skip it and come in one size.
 */
type Recipe = { archetype: Archetype; role: Role; name: string; mount?: 'face' | 'hang' } & (Shape | { sized: (size: PartSize) => Shape });

/** A roster entry: one identity, one card per size it comes in. */
export interface Part {
  id: string;
  archetype: Archetype;
  role: Role;
  variants: PropDef[];
}

const SIZES: readonly PartSize[] = ['small', 'medium', 'large'];
/** Medium goes without a word: it's the part's plain name. */
const SIZE_WORD: Record<PartSize, string> = { small: 'Small ', medium: '', large: 'Big ' };
const by = <T>(size: PartSize, small: T, medium: T, large: T): T => ({ small, medium, large })[size];

/** Roll one part: everything but its size is settled here. */
function rollPart(rng: Rng, recipeOf: (rng: Rng, style: PropStyle) => Recipe, id: string): Part {
  const style = rollStyle(rng);
  const recipe = recipeOf(rng, style);
  const maker = makerName(rng);
  const assemble = (size: PartSize, shape: Shape, word: string): PropDef => ({
    key: id,
    part: id,
    size,
    maker,
    style,
    motion: shape.motion ?? { type: 'none' },
    archetype: recipe.archetype,
    role: recipe.role,
    name: word + recipe.name,
    modules: shape.modules,
    footprint: shape.footprint ? normalizeCells(shape.footprint) : footprintOf(shape.modules),
    ...(recipe.mount ? { mount: recipe.mount } : {}),
  });
  const sized = 'sized' in recipe ? recipe.sized : null;
  const variants = sized ? SIZES.map((s) => assemble(s, sized(s), SIZE_WORD[s])) : [assemble('medium', recipe as Shape, '')];
  if (sized) {
    const span = Math.max(...variants.map(cardExtent));
    for (const v of variants) v.span = span;
  }
  return { id, archetype: recipe.archetype, role: recipe.role, variants };
}

/** One part of the given archetype, with all its sizes. */
export function generatePart(rng: Rng, archetype: Archetype, id: string): Part {
  return rollPart(rng, RECIPES[archetype], id);
}

/** Generate one prop of the given archetype, at a random size. */
export function generateProp(rng: Rng, archetype: Archetype, key: string): PropDef {
  return { ...rng.pick(generatePart(rng, archetype, key).variants), key };
}

/** Good footing: it holds still, doesn't crumble and doesn't throw you around. */
const FOOTING: Partial<Record<Material, string[]>> = {
  stone: ['Slab', 'Ledge'],
  metal: ['Girder', 'I-Beam'],
  wood: ['Plank', 'Beam'],
};

/**
 * The part worldgen's solvability proof is about: a static, solid strip
 * BRIDGE_W long that stands wherever a solution needs one. Other building
 * parts might do the job too (or be a one-tile moving jelly), so the crate's
 * guarantee is made of these.
 */
export function generateBridge(rng: Rng, key: string): PropDef {
  return { ...medium(rollPart(rng, bridgeRecipe, key)), key };
}

const medium = (p: Part): PropDef => p.variants.find((v) => v.size === 'medium')!;

function bridgeRecipe(rng: Rng): Recipe {
  const material = rng.pick(Object.keys(FOOTING) as Material[]);
  return {
    archetype: 'platform',
    role: 'build',
    name: title(rng, ['Tutorial', 'Load-Bearing', 'Floating', 'Placeholder'], FOOTING[material]!),
    sized: (size) => ({
      modules: [{ type: 'body', cells: strip(by(size, BRIDGE_W - 1, BRIDGE_W, BRIDGE_W + 2)), material, conveyor: 0, breakFrames: 0, respawnFrames: 0 }],
    }),
  };
}

/** A block of plain footing, whatever its length or shape. */
function isPlainFooting(def: PropDef): boolean {
  if (def.role !== 'build' || def.motion.type !== 'none' || def.modules.length !== 1) return false;
  const m = def.modules[0];
  return m.type === 'body' && m.breakFrames === 0 && m.conveyor === 0 && m.material in FOOTING;
}

/** True for a part that can stand in for a bridge in a level's solution. */
export function isBridgePart(def: PropDef): boolean {
  const m = def.modules[0];
  if (!isPlainFooting(def) || m.type !== 'body') return false;
  const rows = new Set(m.cells.map((c) => c[1]));
  return rows.size === 1 && m.cells.length === BRIDGE_W;
}

/** A straight strip of `n` host cells along x, facing up at rot 0 (rotation picks the face). */
const strip = (n: number): Cell[] => Array.from({ length: n }, (_, i) => [i, 0] as Cell);

const RECIPES: Record<Archetype, (rng: Rng, style: PropStyle) => Recipe> = {
  spikestrip(rng) {
    return {
      archetype: 'spikestrip',
      role: 'hazard',
      mount: 'face',
      name: title(rng, ['One-Hit', 'Unfair', 'Rude', 'Pointy'], ['Spikes', 'Floor Spikes', 'Death Carpet', 'Spike Strip']),
      sized: (size) => ({ modules: [{ type: 'coat', cells: strip(by(size, 1, 3, 5)), angle: -Math.PI / 2, kind: 'spikes' }] }),
    };
  },
  icecoat(rng) {
    return {
      archetype: 'icecoat',
      role: 'hazard',
      mount: 'face',
      name: title(rng, ['Frictionless', 'Slippery', 'Polished', 'Treacherous', 'Zamboni-Fresh'], ['Ice Physics', 'Ice Patch', 'Black Ice', 'Glaze']),
      sized: (size) => ({ modules: [{ type: 'coat', cells: strip(by(size, 2, 3, 5)), angle: -Math.PI / 2, kind: 'ice' }] }),
    };
  },
  slimecoat(rng) {
    return {
      archetype: 'slimecoat',
      role: 'utility',
      mount: 'face',
      name: title(rng, ['Sticky', 'Questionable', 'Gloopy', 'Toxic-Looking', 'Harmless-ish'], ['Swamp Level', 'Slime Trail', 'Gunk', 'Honey Glaze']),
      sized: (size) => ({ modules: [{ type: 'coat', cells: strip(by(size, 2, 3, 5)), angle: -Math.PI / 2, kind: 'slime' }] }),
    };
  },
  platform(rng) {
    const moving = rng.chance(0.35);
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
    const growth = growCells(rng, 5, moving || material === 'conveyor' ? 0.8 : 0.3);
    const conveyor = material === 'conveyor' ? rng.sign() * rng.range(50, 115) : 0;
    const spiky = rng.chance(0.22);
    const spikeAngle = rng.pick([AXIS[1], AXIS[1], AXIS[0], AXIS[2]]); // down or left/right
    let motion: Motion = { type: 'none' };
    if (moving) {
      motion = rng.chance(0.7)
        ? { type: 'rail', angle: rng.pick([AXIS[0], AXIS[3]]), range: rng.int(2, 6), period: rng.int(110, 260) }
        : { type: 'loop', radius: rng.range(1.2, 2.5), period: rng.int(160, 300), dir: rng.sign() };
    }
    const nouns: Record<Material, string[]> = {
      stone: ['Floating Brick', 'Slab', 'Sky Rock', 'Brick'],
      metal: ['Girder', 'Lift', 'Elevator'],
      wood: ['Plank', 'Obligatory Crate', 'Raft'],
      ice: ['Ice Block', 'Ice Level', 'Ice Cube'],
      conveyor: ['Conveyor', 'Baggage Claim', 'Treadmill'],
      goo: ['Goo Block', 'Gum Slab', 'Jam Brick'],
      jelly: ['Jelly', 'Jiggle Block', 'Bounce House'],
      crumble: ['Biscuit'],
    };
    const adjs: string[] = [];
    if (moving) adjs.push(motion.type === 'loop' ? 'Orbiting' : 'Restless', 'Timing-Based');
    if (spiky) adjs.push('Spiky', 'Prickly');
    if (Math.abs(conveyor) > 95) adjs.push('Turbo', 'Express');
    return {
      archetype: 'platform',
      role: spiky ? 'hazard' : 'build',
      name: title(rng, adjs, nouns[material]),
      sized(size) {
        const cells = normalizeCells(growth.slice(0, by(size, 1, 3, 5)));
        const modules: Module[] = [{ type: 'body', cells, material, conveyor, breakFrames: 0, respawnFrames: 0 }];
        const [dx, dy] = [Math.round(dcos(spikeAngle)), Math.round(dsin(spikeAngle))];
        if (spiky) modules.push({ type: 'spikes', cells: exposed(cells, dx, dy), angle: spikeAngle });
        return { modules, motion };
      },
    };
  },

  crumble(rng) {
    const breakFrames = rng.int(14, 45);
    const growth = growCells(rng, 4, 0.75);
    const respawnFrames = rng.int(150, 300);
    const adjs = breakFrames < 22 ? ['Dunked', 'Soggy', 'Anxious'] : breakFrames > 38 ? ['Twice-Baked', 'Stale'] : ['Crumbly', 'Day-Old'];
    return {
      archetype: 'crumble',
      role: 'build',
      name: title(rng, adjs, ['Biscuit', 'Donut Ledge', 'Wafer', 'Shortbread', 'Rusk']),
      sized: (size) => ({
        modules: [{ type: 'body', cells: normalizeCells(growth.slice(0, by(size, 2, 3, 4))), material: 'crumble', conveyor: 0, breakFrames, respawnFrames }],
      }),
    };
  },

  spikeblock(rng) {
    const growth = growCells(rng, 4, 0.6);
    const dirs = rng.shuffle([0, 1, 2, 3]).slice(
      0,
      rng.weighted([
        [1, 3],
        [2, 2],
        [4, 1],
      ] as const),
    );
    return {
      archetype: 'spikeblock',
      role: 'hazard',
      name: title(rng, dirs.length === 4 ? ['Unstompable', 'Very Pointy', 'Hostile'] : ['Unstompable', 'Rude', 'Prickly'], [
        'Spike Block',
        'Pincushion',
        'Hedgehog Crate',
        'Porcupine',
      ]),
      sized(size) {
        const cells = normalizeCells(growth.slice(0, by(size, 1, 2, 4)));
        const modules: Module[] = [metalBody(cells)];
        for (const d of dirs) {
          const a = AXIS[d];
          modules.push({ type: 'spikes', cells: exposed(cells, Math.round(dcos(a)), Math.round(dsin(a))), angle: a });
        }
        return { modules };
      },
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
        const period = rng.int(20, 40);
        return {
          archetype: 'saw',
          role: 'hazard',
          name: title(rng, ['Rage-Inducing', 'Stationary', 'Bloodthirsty', 'Industrial'], ['Buzzsaw', 'Pizza Cutter', 'Meat Grinder']),
          sized: (size) => ({ modules: [{ ...base, arm: 0, angle0: 0, period, swing: 0, radius: by(size, 0.7, 1, 1.35), count: 1 }] }),
        };
      }
      case 'rail': {
        const range = rng.int(2, 6);
        const period = rng.int(80, 220);
        const motion: Motion = { type: 'rail', angle: rng.pick([AXIS[0], AXIS[3]]), range, period };
        return {
          archetype: 'saw',
          role: 'hazard',
          name: title(rng, (range * 2) / period > 0.06 ? ['Frantic', 'Unhinged', 'Zippy'] : ['Patrolling', 'Commuting'], [
            'Rail Saw',
            'Pizza Cutter',
            'Deli Slicer',
          ]),
          sized: (size) => ({ modules: [{ ...base, arm: 0, angle0: 0, period: 30, swing: 0, radius: by(size, 0.5, 0.75, 1), count: 1 }], motion }),
        };
      }
      case 'orbit': {
        const count = rng.weighted([
          [1, 3],
          [2, 2],
          [3, 1],
        ] as const);
        const period = rng.int(90, 240);
        const arm = rng.range(1.4, 3);
        const angle0 = rng.range(0, Math.PI * 2);
        return {
          archetype: 'saw',
          role: 'hazard',
          name: title(rng, count > 1 ? ['Twin', 'Triple', 'Spinny'] : period < 120 ? ['Frantic', 'Dizzy'] : ['Orbiting', 'Lazy'], [
            'Spin Bar',
            'Saw Carousel',
            'Merry-Go-Saw',
          ]),
          sized: (size) => ({
            modules: [metalBody([[0, 0]]), { ...base, link: 'rod', arm, angle0, period, swing: 0, radius: by(size, 0.45, 0.6, 0.8), count }],
          }),
        };
      }
      case 'pendulum': {
        const link = rng.chance(0.5) ? 'chain' : 'rod';
        const arm = rng.range(2, 3.6);
        const period = rng.int(100, 200);
        const swing = rng.range(0.7, 1.3);
        return {
          archetype: 'saw',
          role: 'hazard',
          name: title(
            rng,
            ['Swinging', 'Hypnotic', 'Tick-Tock'],
            head === 'axe' ? ['Pendulum Axe', 'Guillotine', 'Hypnotist'] : ['Pendulum Saw', 'Grandfather Saw'],
          ),
          sized: (size) => ({
            modules: [metalBody([[0, 0]]), { ...base, link, arm, angle0: Math.PI / 2, period, swing, radius: by(size, 0.6, 0.8, 1), count: 1 }],
          }),
        };
      }
    }
  },

  flail(rng) {
    const pend = rng.chance(0.5);
    const arm = rng.range(1.8, 3.4);
    const angle0 = pend ? Math.PI / 2 : rng.range(0, 6.28);
    const period = rng.int(100, 230);
    const swing = pend ? rng.range(0.8, 1.4) : 0;
    const dir = rng.sign();
    const count = !pend && rng.chance(0.25) ? 2 : 1;
    return {
      archetype: 'flail',
      role: 'hazard',
      name: title(rng, pend ? ['Leashed', 'Medieval', 'Hefty'] : ['Off-Leash', 'Whirling', 'Dizzy'], [
        'Chain Chump',
        'Ball and Chain',
        'Morning Star',
        'Wrecking Ball',
      ]),
      sized: (size) => ({
        modules: [
          metalBody([[0, 0]]),
          { type: 'swinger', head: 'mace', hub: center(), link: 'chain', arm, angle0, period, swing, dir, radius: by(size, 0.6, 0.8, 1.1), count },
        ],
      }),
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
      crossbow: ['Arrow Trap', 'Kneecapper', 'Crossbow'],
      ballista: ['Ballista', 'Siege Bow', 'Tower Defense'],
      cannon: ['Cannon', 'Pirate Cannon', 'Bombard'],
      totem: ['Tiki Spitter', 'Fire Totem', 'Heartburn Idol'],
      turret: ['Sentry Gun', 'Sorry Turret', 'Blaster'],
      thrower: ['Ninja Box', 'Star Thrower', 'Shuriken Vendor'],
      rocket: ['Seeker Pod', 'Homing Rack', 'Grudge Launcher'],
      glaive: ['Boomerang Bruh', 'Glaive Flinger', 'Return Policy'],
      gumball: ['Gumball Machine', 'Dodgeball Coach', 'Ball Pit'],
      mortar: ['Banana Mortar', 'Bunch Launcher', 'Split Shell'],
      gooper: ['Splat Gun', 'Goo Gun', 'Sneeze Cannon'],
      cryo: ['Freeze Ray', 'Brain Freezer', 'Slushie Gun'],
      prism: ['Trick-Shot Lens', 'Bank-Shot Prism', 'Mirror Puzzle'],
    };
    const STYLE_ADJ: Partial<Record<LauncherStyle, string[]>> = {
      rocket: ['Relentless', 'Clingy', 'Rubber-Band'],
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
    if (spread > 1) adjs.push(spread === 5 ? 'Spread-Shot' : 'Triple', 'Scattershot');
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

  // The team shooter's engineer sentry, as a squat tripod gun that beeps before it chatters.
  sentry(rng) {
    const turn = rng.range(0.028, 0.045);
    const spin = rng.int(22, 40);
    const burst = rng.int(3, 5);
    const gap = rng.int(4, 6);
    // Never fewer than MIN_OPENING frames between bursts (sim/props/barrier.ts): the lull is the way past.
    const cool = rng.int(70, 120);
    const speed = rng.range(380, 460);
    const cone = rng.range(0.85, 1.2);
    const sweepPeriod = rng.int(200, 320);
    const adjs: string[] = [];
    if (turn > 0.039) adjs.push('Twitchy', 'Hair-Trigger');
    if (turn < 0.033) adjs.push('Rusty', 'Sluggish');
    if (spin < 28) adjs.push('Trigger-Happy', 'Jumpy');
    if (spin > 34) adjs.push('Dramatic', 'Wind-Up');
    if (burst >= 5) adjs.push('Chatty', 'Spammy');
    if (cool > 105) adjs.push('Overheating', 'Lazy');
    if (cone > 1.1) adjs.push('Nosy', 'Wide-Eyed');
    return {
      archetype: 'sentry',
      role: 'hazard',
      name: title(rng, adjs, ['Auto-Turret', 'Sentry Nest', 'Level 1 Sentry', 'Spy Checker', 'Lawn Defender']),
      sized: (size) => ({
        modules: [
          metalBody([[0, 0]]),
          { type: 'sentry', at: center(), angle: 0, cone, sweepPeriod, range: by(size, 6, 8, 10), turn, spin, burst, gap, cool, speed, ammo: 'slug' },
        ],
      }),
    };
  },

  flamer(rng) {
    const on = rng.int(40, 95);
    const off = rng.int(60, 140);
    const warn = rng.int(24, 40);
    return {
      archetype: 'flamer',
      role: 'hazard',
      name: title(rng, on > 80 ? ['Relentless', 'Hungry'] : ['Hiccuping', 'Grumpy'], ['Burner', 'Dragon Burp', 'Fire Spout', 'Flambé Jet']),
      sized: (size) => ({ modules: [metalBody([[0, 0]]), { type: 'flame', at: center(), angle: AXIS[3], length: by(size, 2, 3, 5), on, off, warn }] }),
    };
  },

  laser(rng) {
    const sweep = rng.chance(0.45) ? rng.range(0.4, 1.2) : 0;
    return {
      archetype: 'laser',
      role: 'hazard',
      name: title(rng, sweep ? ['Sweeping', 'Lighthouse', 'Searching'] : ['Focused', 'Unblinking', 'Judgmental'], [
        'Death Ray',
        'Laser Pointer',
        'Doomsday Laser',
        'Laser Sight',
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
    const on = rng.int(40, 90);
    const off = rng.int(60, 130);
    return {
      archetype: 'tesla',
      role: 'hazard',
      name: title(rng, ['Crackling', 'Buzzing', 'Static', 'Ambitious'], ['Bug Zapper', 'Tesla Coil', 'Zap Fence', 'Electric Fence']),
      sized(size) {
        const d = by(size, 2, 3, 5);
        return {
          modules: [
            metalBody([
              [0, 0],
              [d, 0],
            ]),
            { type: 'tesla', a: center(0, 0), b: center(d, 0), on, off, warn: 30 },
          ],
        };
      },
    };
  },

  crusher(rng) {
    const period = rng.int(90, 190);
    const reach = rng.range(2, 5);
    return {
      archetype: 'crusher',
      role: 'hazard',
      name: title(rng, period < 120 ? ['Eager', 'Hyperactive'] : ['Patient', 'Grumpy', 'Industrial'], ['Crusher', 'Piston', 'Whack-a-Player', 'Panini Press']),
      sized(size) {
        const width = by(size, 1, 2, 3);
        return { modules: [metalBody(strip(width)), { type: 'piston', at: [width / 2, 0.5], angle: AXIS[1], reach, width, period }] };
      },
    };
  },

  spring(rng) {
    const power = rng.range(520, 820);
    return {
      archetype: 'spring',
      role: 'utility',
      name: title(rng, power > 720 ? ['Overclocked', 'Ballistic'] : power < 600 ? ['Wimpy', 'Polite'] : ['Bouncy', 'Springy'], [
        'Spring',
        'Coil Pup',
        'Boing',
        'Launch Pad',
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
        'Updraft Fan',
        'Leaf Blower',
        'Hair Dryer',
        'Turbine',
      ]),
      sized: (size) => ({ modules: [metalBody([[0, 0]]), { type: 'fan', at: center(), angle: AXIS[3], length: by(size, 3, 5, 8), strength }] }),
    };
  },

  portal(rng) {
    const dy = rng.chance(0.4) ? rng.int(-3, 3) : 0;
    const ay = dy < 0 ? -dy : 0;
    return {
      archetype: 'portal',
      role: 'utility',
      name: title(rng, ['Twin', 'Quantum', 'Entangled', 'Speedrun', 'Non-Euclidean'], ['Plot Holes', 'Wormholes', 'Warp Pads', 'Sequence Break']),
      sized: (size) => ({ modules: [{ type: 'portal', a: center(0, ay), b: center(by(size, 3, 5, 8), ay + dy) }] }),
    };
  },

  bumper(rng) {
    const twin = rng.chance(0.25);
    const power = rng.range(330, 520);
    const second = center(rng.int(2, 3), rng.pick([0, 1]));
    const motion: Motion =
      !twin && rng.chance(0.3) ? { type: 'rail', angle: rng.pick([AXIS[0], AXIS[3]]), range: rng.int(2, 4), period: rng.int(120, 220) } : { type: 'none' };
    return {
      archetype: 'bumper',
      role: 'utility',
      name: title(rng, power > 460 ? ['Violent', 'Overcharged', 'Tilt'] : twin ? ['Twin', 'Multiball'] : ['Bouncy', 'High-Score', 'Boisterous'], [
        'Bumper',
        'Pinball Bumper',
        'Casino Bumper',
        'Jackpot',
      ]),
      sized(size) {
        const radius = by(size, 0.42, 0.55, 0.75);
        const modules: Module[] = [{ type: 'bumper', at: center(), radius, power }];
        if (twin) modules.push({ type: 'bumper', at: second, radius, power });
        return { modules, motion };
      },
    };
  },

  magnet(rng) {
    const pull = rng.chance(0.6);
    const pulse = rng.chance(0.4);
    const strength = pull ? rng.range(900, 1500) : rng.range(1100, 1900);
    const on = pulse ? rng.int(70, 130) : 0;
    const off = pulse ? rng.int(60, 120) : 0;
    const adjs = pulse ? ['Pulsing', 'Moody', 'Intermittent'] : pull ? ['Needy', 'Clingy', 'Magnetic'] : ['Aloof', 'Standoffish', 'Overbearing'];
    return {
      archetype: 'magnet',
      role: 'utility',
      name: title(
        rng,
        adjs,
        pull ? ['Gravity Well', 'Tractor Beam', 'Black Hole Lite', 'Attractor'] : ['Repulsor', 'Anti-Magnet', 'Social Distancer', 'Force Push'],
      ),
      sized: (size) => ({
        modules: [metalBody([[0, 0]]), { type: 'magnet', at: center(), radius: by(size, 2.5, 3.3, 4.2), strength, polarity: pull ? 1 : -1, on, off, warn: 30 }],
      }),
    };
  },

  web(rng) {
    const drag = rng.range(0.18, 0.3);
    const growth = growCells(rng, 6, 0.15);
    return {
      archetype: 'web',
      role: 'utility',
      name: title(rng, drag > 0.25 ? ['Extra-Sticky', 'Clingy'] : ['Sticky', 'Dusty', 'Abandoned'], ['Cobweb', 'Spider Level', 'World Wide Web', 'Net']),
      sized: (size) => ({ modules: [{ type: 'web', cells: normalizeCells(growth.slice(0, by(size, 3, 4, 6))), drag }] }),
    };
  },

  blinker(rng) {
    const pair = rng.chance(0.55);
    if (pair) {
      const t = rng.int(70, 130);
      const dy = rng.pick([-1, 0, 0, 1]);
      const gap = rng.int(0, 1);
      const ya = dy < 0 ? 1 : 0;
      return {
        archetype: 'blinker',
        role: 'build',
        name: title(rng, t < 90 ? ['Hasty', 'Frantic', 'Flip-Flop'] : ['Alternating', 'Ping-Pong', 'Turn-Taking'], [
          'Yolo Blocks',
          'Blink Blocks',
          'On/Off Bricks',
          'Swap Tiles',
        ]),
        sized(size) {
          const n = by(size, 1, 2, 3);
          const a = strip(n).map(([x]) => [x, ya] as Cell);
          const b = strip(n).map(([x]) => [x + n + gap, ya + dy] as Cell);
          return {
            modules: [
              { type: 'phase', cells: a, on: t, off: t, offset: 0 },
              { type: 'phase', cells: b, on: t, off: t, offset: t },
            ],
          };
        },
      };
    }
    const on = rng.int(90, 150);
    const off = rng.int(50, 100);
    return {
      archetype: 'blinker',
      role: 'build',
      name: title(rng, off > 80 ? ['Unreliable', 'Flaky', 'Shy'] : ['Flickering', 'Blinking', 'Nervous'], [
        'Yolo Blocks',
        'Blink Blocks',
        'Ghost Tiles',
        'Lag Bricks',
      ]),
      sized: (size) => ({ modules: [{ type: 'phase', cells: strip(by(size, 2, 3, 4)), on, off, offset: 0 }] }),
    };
  },

  dropper(rng) {
    const warn = rng.int(14, 24);
    const reach = rng.int(4, 9);
    const rest = rng.int(40, 80);
    return {
      archetype: 'dropper',
      role: 'hazard',
      name: title(rng, warn < 17 ? ['Twitchy', 'Jumpy', 'Short-Tempered'] : ['Grumpy', 'Glowering', 'Patient', 'Brooding'], [
        'Thwunk',
        'Grudge Block',
        'Angry Brick',
        'Dropstone',
        'Ceiling Grump',
      ]),
      sized(size) {
        const w = by(size, 1, 2, 2);
        const h = by(size, 1, 1, 2);
        const cells: Cell[] = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push([x, y]);
        return { modules: [{ type: 'dropper', cells, angle: AXIS[1], reach, warn, rest }] };
      },
    };
  },

  snapper(rng) {
    const warn = rng.int(14, 24);
    const up = rng.int(24, 45);
    const cool = rng.int(40, 80);
    return {
      archetype: 'snapper',
      role: 'hazard',
      mount: 'face',
      name: title(rng, warn < 17 ? ['Hair-Trigger', 'Jumpy', 'Snappy'] : ['Lurking', 'Sneaky', 'Patient'], [
        'Gotcha Plate',
        'Pressure Plate',
        'Pop-Up Spikes',
        'Surprise Party',
      ]),
      sized: (size) => ({ modules: [{ type: 'snapper', cells: strip(by(size, 1, 2, 3)), angle: -Math.PI / 2, warn, up, cool }] }),
    };
  },

  /** One loot box, the question block you punch from below: any item can come out. Only how often it gives varies. */
  mystery(rng) {
    const uses = rng.weighted([
      [0, 2.5],
      [1, 1.5],
      [3, 1],
    ] as const);
    const refill = rng.int(150, 420);
    const adjs: string[] = ['Gacha', 'Chaotic', 'Unlabeled'];
    if (uses === 1) adjs.push('Limited-Time', 'One-Shot');
    else if (uses > 1) adjs.push('Battle-Pass', 'Rationed');
    else if (refill < 230) adjs.push('Bottomless', 'Pay-to-Win', 'Whale-Bait');
    else if (refill > 350) adjs.push('Daily', 'Sleepy');
    return {
      archetype: 'mystery',
      role: 'utility',
      name: title(rng, adjs, ['Loot Box', 'Surprise Mechanic', 'Lucky Block']),
      modules: [{ type: 'mystery', cells: [[0, 0]], pool: [...ITEM_KINDS], uses, refill, look: 'crate', seed: rng.int(0, 1 << 20) }],
    };
  },

  wheel(rng) {
    const count = rng.weighted([
      [2, 2],
      [3, 3],
      [4, 1.5],
    ] as const);
    const period = rng.int(220, 380);
    const width = rng.range(1.4, 2.1);
    const angle0 = rng.range(0, Math.PI * 2);
    const dir = rng.sign();
    const seed = rng.int(0, 1 << 20);
    return {
      archetype: 'wheel',
      role: 'build',
      name: title(rng, period < 260 ? ['Speedy', 'Giddy'] : count >= 4 ? ['Crowded', 'Generous'] : ['Leisurely', 'Creaky', 'Squeaky'], [
        'Ferris Wheel',
        'Cog Lift',
        'Hamster Wheel',
        'Lazy Susan',
      ]),
      sized(size) {
        const arm = by(size, 1.6, 2, 2.5);
        // Reserve the disk the platforms sweep, so it isn't placed into terrain. Its center
        // cell must be `hub - 0.5` after normalizing, so the disk has to touch x = 0 and y = 0.
        const reach = arm + width / 2;
        const r = Math.floor(reach);
        const disk: Cell[] = [];
        for (let y = 0; y <= 2 * r; y++) for (let x = 0; x <= 2 * r; x++) if (sq(x - r) + sq(y - r) <= reach * reach) disk.push([x, y]);
        return {
          modules: [
            {
              type: 'rotor',
              look: 'cog',
              support: 'none',
              mastX: 0,
              hub: center(r, r),
              arm,
              count,
              angle0,
              period,
              swing: 0,
              dir,
              width,
              thick: 0.5,
              material: 'metal',
              seed,
            },
          ],
          footprint: disk,
        };
      },
    };
  },

  bomb(rng) {
    return {
      archetype: 'bomb',
      role: 'demolish',
      name: title(rng, ['Volatile', 'Grumpy', 'Polite', 'Excessive'], ['Cartoon Bomb', 'Kaboom', 'Fuse Ball', `${word(rng, 1, 2)}-omb`]),
      sized: (size) => ({ modules: [{ type: 'bomb', radius: by(size, 1.6, 2.6, 4), look: 'bomb' }] }),
    };
  },

  emp(rng) {
    return {
      archetype: 'emp',
      role: 'demolish',
      name: title(rng, ['Day-One', 'Emergency', 'Surgical', 'Unannounced'], ['Balance Patch', 'Hotfix', 'EMP', 'Nerf Pulse']),
      sized: (size) => ({ modules: [{ type: 'bomb', radius: by(size, 2.5, 3.5, 4.5), target: 'props', look: 'emp' }] }),
    };
  },

  drill(rng) {
    const width = rng.chance(0.3) ? 3 : 1;
    return {
      archetype: 'drill',
      role: 'demolish',
      name: title(rng, width === 3 ? ['Wide-Bore', 'Industrial'] : ['Deep', 'Determined', 'Hand'], ['Drill', 'Digger', 'Tunnel Vision', 'Mole']),
      sized: (size) => ({ modules: [{ type: 'bomb', radius: by(size, 5, 7, 10), shape: 'line', target: 'terrain', width, look: 'drill' }] }),
    };
  },

  charge(rng) {
    const cross = rng.chance(0.55);
    return {
      archetype: 'charge',
      role: 'demolish',
      name: title(
        rng,
        cross ? ['Four-Way', 'Plus-Sized', 'Grid-Locked'] : ['Hollow', 'Glazed', 'Frosted'],
        cross ? ['Plus Bomb', 'Arena Bomb', 'Cross Charge'] : ['Donut', 'Ring Charge', 'Moat Maker'],
      ),
      sized: (size) => ({
        modules: [
          { type: 'bomb', radius: cross ? by(size, 3, 4, 6) : by(size, 2.6, 3.2, 4), shape: cross ? 'cross' : 'ring', width: cross ? 1 : 1.3, look: 'charge' },
        ],
      }),
    };
  },

  hangar(rng) {
    const speed = rng.range(60, 110);
    const interval = rng.int(110, 200);
    return {
      archetype: 'hangar',
      role: 'utility',
      name: title(rng, speed > 95 ? ['Express', 'Hasty'] : interval < 140 ? ['Busy', 'Generous'] : ['Leisurely', 'Scenic', 'Rickety'], [
        'Budget Airline',
        'Air Ferry',
        'Kite Loft',
        'Paper Planery',
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
    const strain = rng.int(240, 420);
    const regrow = rng.int(240, 360);
    const adjs = strain < 300 ? ['Overcooked', 'Day-Old', 'Bargain'] : ['Prime', 'Smoked', 'Cured', "Butcher's"];
    return {
      archetype: 'rope',
      role: 'utility',
      mount: 'hang',
      name: title(rng, adjs, ['Sausage Vine', 'Swinging Links', 'Banger Rope', 'Bratwurst Vine', 'Salami Swing']),
      sized: (size) => ({ modules: [{ type: 'rope', at: [0.5, 0], length: by(size, 3, 5, 7), strain, regrow }] }),
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
    const emp = rng.chance(0.3);
    return {
      archetype: 'timebomb',
      role: 'demolish',
      name: title(rng, emp ? ['Spiteful', 'Delayed'] : ['Ticking', 'Patient', 'Punctual'], ['Time Bomb', 'Alarm Clock', 'Hurry-Up Timer', 'Snooze Button']),
      sized: (size) => ({ modules: [{ type: 'bomb', radius: by(size, 2, 2.6, 3.2), target: emp ? 'props' : 'all', look: 'clock', delay: true }] }),
    };
  },
};

/** Every roster holds at least this many parts: the bridge plus ROSTER_SLOTS. */
const ROSTER_MIN = 8;
/** Parts a roster holds beyond one crate's cards, so crates differ round to round but every part keeps coming back. */
const ROSTER_SPARE = 4;
/** How many unique parts a match with `cards`-card crates draws from. */
export const rosterSize = (cards: number): number => Math.max(ROSTER_MIN, cards + ROSTER_SPARE);

const pool = (...kinds: Archetype[]) => ARCHETYPE_WEIGHTS.filter(([k]) => kinds.includes(k));
const HAZARDS = pool(...HAZARD);
/**
 * What every roster holds after its bridge: a breaker that clears terrain,
 * since dry rounds lean on it (an EMP or a props-only time bomb wouldn't help),
 * held items, and a spread of roles. Hazards get three so the crate's hazard
 * card isn't always the same one.
 */
const ROSTER_SLOTS = [
  pool('bomb', 'charge', 'drill'),
  pool('mystery'),
  HAZARDS,
  HAZARDS,
  HAZARDS,
  pool('spring', 'fan', 'slimecoat', 'portal', 'bumper', 'magnet', 'web', 'hangar', 'rope', 'keg'),
  pool('platform', 'crumble', 'blinker', 'wheel'),
];

/**
 * The match's parts, from the seed alone so every peer agrees and a snapshot
 * needs nothing new. The bridge comes first, then ROSTER_SLOTS, then anything
 * by ARCHETYPE_WEIGHTS. One part per archetype, except that the bridge leaves
 * room for a platform that isn't plain footing, or conveyors and jelly would
 * never turn up. A longer roster starts with the shorter one, and each part
 * rolls from its own stream, so someone joining between rounds only adds parts.
 */
export function generateRoster(seed: number, size: number): Part[] {
  const rng = new Rng(deriveSeed(seed, 'roster'));
  const parts = [rollPart(new Rng(deriveSeed(seed, 'part:bridge')), bridgeRecipe, 'bridge')];
  const taken = new Set<Archetype>();
  const take = (from: readonly (readonly [Archetype, number])[]): boolean => {
    const open = from.filter(([k]) => !taken.has(k));
    if (!open.length) return false;
    const kind = rng.weighted(open);
    taken.add(kind);
    const part = generatePart(new Rng(deriveSeed(seed, `part:${kind}`)), kind, kind);
    if (part.variants.some(isPlainFooting)) return take(from);
    parts.push(part);
    return true;
  };
  for (const slot of ROSTER_SLOTS) take(slot);
  while (parts.length < size && take(ARCHETYPE_WEIGHTS));
  return parts.slice(0, size);
}

/** How much less likely a part already in the crate is to fill another card, so a crate stays a choice between parts. */
const REPEAT_WEIGHT = 0.3;

/**
 * A round's crate, drawn from the match's roster. It always holds a hazard
 * and at least `bridges` medium bridge cards (capped so the hazard keeps its
 * place): what the level still needs, so a match can't run out of ways to
 * reach the flag. Past that no card is shown twice, but a part can show up
 * again at another size. `dry`, rounds in a row nobody finished, tilts the rest
 * toward parts that unstick a match (dryLean); nothing says so on screen.
 */
export function generateCrate(seed: number, round: number, count: number, bridges = 1, dry = 0): PropDef[] {
  const rng = new Rng(deriveSeed(seed, `crate:${round}`));
  const roster = generateRoster(seed, rosterSize(count));
  const need = Math.max(1, Math.min(bridges, count - 1));
  const cards: PropDef[] = Array.from({ length: need }, () => medium(roster[0]));
  const left = (p: Part) => p.variants.filter((v) => !cards.includes(v));
  const draw = (p: Part) => cards.push(rng.pick(left(p)));
  draw(rng.pick(roster.filter((p) => HAZARD.includes(p.archetype))));
  while (cards.length < count) {
    const open = roster.filter((p) => left(p).length);
    draw(rng.weighted(open.map((p) => [p, dryLean(p.archetype, dry) * (cards.some((c) => c.part === p.id) ? REPEAT_WEIGHT : 1)] as const)));
  }
  return rng.shuffle(cards.map((c, i) => ({ ...c, key: `${round}-${i}` })));
}

/**
 * Secret Parts: the part behind a role card, rolled when the card is claimed.
 * It comes from the match roster (the same one the crate drew from), filtered
 * to the card's role and weighted like the crate (dryLean, and less likely to
 * repeat a part already rolled this round, `taken`). The roster always holds
 * every role, so the filter only comes up empty for a role it can't have.
 */
export function rollSecret(rng: Rng, roster: readonly Part[], role: Role, dry: number, taken: readonly string[]): PropDef {
  const fits = roster.filter((p) => p.role === role);
  const from = fits.length ? fits : roster;
  const part = rng.weighted(from.map((p) => [p, dryLean(p.archetype, dry) * (taken.includes(p.id) ? REPEAT_WEIGHT : 1)] as const));
  return rng.pick(part.variants);
}
