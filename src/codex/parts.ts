import { type Cell, normalizeCells, type Vec } from '../core/geom';
import { ITEMS } from '../sim/items/roster';
import { ITEM_KINDS, type ItemKind } from '../sim/items/types';
import {
  AMMO,
  type Ammo,
  launcherBody,
  launcherFrame,
  type LauncherStyle,
  type Material,
  type MetalStyle,
  type Module,
  type Motion,
  moduleSim,
  type MysteryLook,
  type PropDef,
  type PropStyle,
  type Trim,
} from '../sim/props';

/**
 * The codex "parts" catalog: every building block in isolation, with fixed
 * representative parameters, so you can see what each piece *is* before
 * seeing the procedural combinations.
 */

export interface PartEntry {
  title: string;
  note: string;
  def: PropDef;
  /** Held-item entries: draw this item instead of the def (a crate that only holds it). */
  item?: ItemKind;
}

export interface PartGroup {
  id: string;
  title: string;
  blurb: string;
  entries: PartEntry[];
}

const R = Math.PI / 2;
const UP = 3 * R;
const c = (x = 0, y = 0): Vec => [x + 0.5, y + 0.5];

function style(over: Partial<PropStyle> = {}): PropStyle {
  return { metal: 'steel', trim: 'rivets', hue: 20, glowHue: 190, woodHue: 28, ...over };
}

function def(name: string, modules: Module[], opts: { style?: Partial<PropStyle>; motion?: Motion; footprint?: Cell[] } = {}): PropDef {
  const cells = new Map<string, Cell>();
  for (const m of modules) for (const cell of moduleSim(m.type).anchors(m)) cells.set(`${cell[0]},${cell[1]}`, cell);
  return {
    key: `part:${name}`,
    name,
    maker: '',
    archetype: 'platform',
    role: 'build',
    style: style(opts.style),
    motion: opts.motion ?? { type: 'none' },
    modules,
    footprint: opts.footprint ?? normalizeCells([...cells.values()]),
  };
}

const body = (cells: Cell[], material: Material = 'metal', extra: Partial<Extract<Module, { type: 'body' }>> = {}): Module => ({
  type: 'body',
  cells,
  material,
  conveyor: 0,
  breakFrames: 30,
  respawnFrames: 200,
  ...extra,
});

/*
 * Labels follow the parody names (docs/PARODY.md) and notes are one-line
 * jokes, never how-to text (docs/DESIGN.md → Discovery): the numbers in the
 * modal say what a part does, and playing it says the rest.
 */

const MATERIAL_NOTES: Record<Material, string> = {
  stone: 'Floats. Nobody asks.',
  metal: 'Rivets: decorative.',
  wood: 'Not a crate yet.',
  ice: 'Every game has one.',
  conveyor: 'Clock in.',
  goo: 'Do not lick.',
  jelly: 'Boing.',
  crumble: 'Best before now.',
};

/** Launcher style → its ammo, codex label and joke. */
const LAUNCHER_NOTES: Record<string, [Ammo, string, string]> = {
  crossbow: ['bolt', 'arrow trap', 'Knees beware.'],
  ballista: ['bolt', 'ballista', 'Overkill, slowly.'],
  cannon: ['cannonball', 'pirate cannon', 'Arr.'],
  totem: ['fireball', 'heartburn idol', 'Spicy.'],
  turret: ['plasma', 'sorry turret', 'It feels bad about this.'],
  thrower: ['shuriken', 'ninja box', 'Stars, vended.'],
  rocket: ['seeker', 'grudge launcher', 'Keeps count.'],
  glaive: ['boomerang', 'boomerang bruh', 'It always comes back.'],
  gumball: ['rubber', 'dodgeball coach', 'Gym class flashbacks.'],
  mortar: ['cluster', 'banana mortar', 'Share the bunch.'],
  gooper: ['goo', 'splat gun', 'Bless you.'],
  cryo: ['frost', 'brain freezer', 'Slurped too fast.'],
  prism: ['ricochet', 'trick-shot lens', 'Called it.'],
  hangar: ['glider', 'budget airline', 'Seats sold separately.'],
};

/** Projectile label and joke for the codex. */
export const PROJECTILE_NOTES: Record<Ammo, [string, string]> = {
  bolt: ['trap bolt', 'Knee-high.'],
  arrow: ['arrow', 'Still knee-high.'],
  cannonball: ['cannonball', 'Arr.'],
  fireball: ['heartburn', 'Spicy.'],
  plasma: ['apology', 'Sorry!'],
  shuriken: ['throwing star', 'Ninja-grade.'],
  seeker: ['grudge missile', 'It remembers.'],
  boomerang: ['boomerang', 'Comes back.'],
  rubber: ['dodgeball', 'Dodge.'],
  cluster: ['banana bunch', 'Sharing is caring.'],
  shrapnel: ['banana', 'Split.'],
  goo: ['sneeze', 'Bless you.'],
  frost: ['slushie', 'Brain freeze.'],
  ricochet: ['trick shot', 'Called it.'],
  glider: ['economy seat', 'Delays likely.'],
  slug: ['slug', 'Nothing personal.'],
  meteor: ['shooting star', 'Make a wish.'],
  snowball: ['avalanche', 'It started as a snowflake.'],
  puck: ['evicted shell', 'Nobody home.'],
  smokebomb: ['fog of war', 'Unexplored.'],
};

const ITEM_NOTES: Record<ItemKind, string> = {
  sword: 'Legendary. Squishy.',
  puck: 'Nobody home.',
  boomerang: 'Returns, mostly.',
  shield: 'Pop.',
  rocket: 'Trial expired.',
  smoke: 'Unexplored.',
  bat: 'Going, going…',
  tremor: 'Off the charts.',
  tax: 'Progressive.',
  block: 'Some assembly required.',
};

const crate = (name: string, pool: ItemKind[], uses: number, look: MysteryLook): PropDef =>
  def(name, [{ type: 'mystery', cells: [[0, 0]], pool, uses, refill: 240, look, seed: 3 }], { style: { hue: 40, woodHue: 30 } });

export function partGroups(): PartGroup[] {
  const materials: Material[] = ['stone', 'metal', 'wood', 'ice', 'conveyor', 'goo', 'jelly', 'crumble'];
  const metals: MetalStyle[] = ['steel', 'brass', 'copper', 'rust', 'obsidian', 'bone', 'jade', 'gold'];
  const trims: Trim[] = ['none', 'stripes', 'rivets', 'runes', 'gems'];
  return [
    {
      id: 'materials',
      title: 'Blocks & materials',
      blurb: 'Floating in midair since the first level of everything.',
      entries: materials.map((m) => ({
        title: m,
        note: MATERIAL_NOTES[m],
        def: def(
          m,
          [
            body(
              [
                [0, 0],
                [1, 0],
                [2, 0],
              ] as Cell[],
              m,
              m === 'conveyor' ? { conveyor: 90 } : {},
            ),
          ],
          { style: { trim: 'none', hue: 200 } },
        ),
      })),
    },
    {
      id: 'attachments',
      title: 'Attachments',
      blurb: 'Paint jobs with consequences.',
      entries: (['spikes', 'ice', 'slime', 'boost'] as const).flatMap((kind) =>
        [-Math.PI / 2, 0].map((angle) => ({
          title: `${{ spikes: 'death carpet', ice: 'ice physics', slime: 'swamp level', boost: 'express lane' }[kind]} · ${angle === 0 ? 'wall' : 'floor'}`,
          note: {
            spikes: angle === 0 ? 'Rude, sideways.' : 'Rude.',
            ice: angle === 0 ? 'No grip. No dignity.' : 'Zamboni-fresh.',
            slime: angle === 0 ? 'Spider-adjacent.' : 'Do not lick.',
            boost: angle === 0 ? 'Going down.' : 'Speed limit: yes.',
          }[kind],
          def: {
            ...def(`${kind}-${angle}`, [
              {
                type: 'coat',
                cells: (angle === 0
                  ? [
                      [0, 0],
                      [0, 1],
                    ]
                  : [
                      [0, 0],
                      [1, 0],
                      [2, 0],
                    ]) as Cell[],
                angle,
                kind,
              },
            ]),
            mount: 'face' as const,
          },
        })),
      ),
    },
    {
      id: 'heads',
      title: 'Swinging heads',
      blurb: 'Every castle has a guy who installs these.',
      entries: [
        {
          title: 'pizza cutter',
          note: 'Extra sauce.',
          def: def('saw', [{ type: 'swinger', head: 'saw', hub: c(), arm: 0, angle0: 0, period: 30, swing: 0, dir: 1, radius: 1.1, count: 1, link: 'none' }]),
        },
        {
          title: 'chain chump',
          note: 'Woof.',
          def: def('mace', [
            body([[0, 0]]),
            { type: 'swinger', head: 'mace', hub: c(), arm: 2.2, angle0: 0, period: 150, swing: 0, dir: 1, radius: 0.8, count: 1, link: 'chain' },
          ]),
        },
        {
          title: 'hypnotist',
          note: 'You are getting very sleepy.',
          def: def('axe', [
            body([[0, 0]]),
            { type: 'swinger', head: 'axe', hub: c(), arm: 2.6, angle0: R, period: 140, swing: 1.1, dir: 1, radius: 0.9, count: 1, link: 'rod' },
          ]),
        },
        {
          title: 'spin bar',
          note: 'Around and around.',
          def: def('orbit', [
            body([[0, 0]]),
            { type: 'swinger', head: 'saw', hub: c(), arm: 2, angle0: 0, period: 140, swing: 0, dir: 1, radius: 0.6, count: 2, link: 'rod' },
          ]),
        },
        {
          title: 'grandfather saw',
          note: 'Tick. Tock. Ow.',
          def: def('pendulum', [
            body([[0, 0]]),
            { type: 'swinger', head: 'saw', hub: c(), arm: 2.6, angle0: R, period: 130, swing: 1.2, dir: 1, radius: 0.7, count: 1, link: 'chain' },
          ]),
        },
      ],
    },
    {
      id: 'launchers',
      title: 'Launchers',
      blurb: 'Fixed, Sweeps or Tracks. Mostly Fixed.',
      entries: [
        ...Object.entries(LAUNCHER_NOTES).map(([styleName, [ammo, label, note]]) => ({
          title: label,
          note: `Fixed. ${note}`,
          def: def(styleName, [
            launcherBody(styleName as LauncherStyle, styleName === 'crossbow' || styleName === 'totem' || styleName === 'hangar' ? 'wood' : 'metal'),
            {
              type: 'launcher',
              style: styleName as LauncherStyle,
              ammo,
              at: launcherFrame(styleName as LauncherStyle).at,
              angle: AMMO[ammo].gravity > 200 ? -0.5 : 0,
              aim: 'fixed',
              sweep: 0,
              sweepPeriod: 200,
              interval: 90,
              burst: 1,
              spread: 1,
              spreadAngle: 0.25,
              speed: 200,
            },
          ]),
        })),
        {
          title: 'paranoid arrow trap',
          note: 'Tracks. Trust issues.',
          def: def('track', [
            body([[0, 0]], 'wood'),
            {
              type: 'launcher',
              style: 'crossbow',
              ammo: 'bolt',
              at: c(),
              angle: 0,
              aim: 'track',
              sweep: 0,
              sweepPeriod: 200,
              interval: 90,
              burst: 1,
              spread: 1,
              spreadAngle: 0.25,
              speed: 220,
            },
          ]),
        },
        {
          title: 'indecisive dome turret',
          note: 'Sweeps. Can’t decide.',
          def: def('sweep', [
            body([[0, 0]]),
            {
              type: 'launcher',
              style: 'turret',
              ammo: 'plasma',
              at: c(),
              angle: 0,
              aim: 'sweep',
              sweep: 0.8,
              sweepPeriod: 160,
              interval: 90,
              burst: 2,
              spread: 1,
              spreadAngle: 0.25,
              speed: 220,
            },
          ]),
        },
        {
          title: 'auto-turret',
          note: 'Tracks. Beeps first.',
          def: def('sentry', [
            body([[0, 0]]),
            {
              type: 'sentry',
              at: c(),
              angle: 0,
              cone: 1,
              sweepPeriod: 240,
              range: 8,
              turn: 0.036,
              spin: 30,
              burst: 4,
              gap: 5,
              cool: 90,
              speed: 420,
              ammo: 'slug',
            },
          ]),
        },
      ],
    },
    {
      id: 'emitters',
      title: 'Emitters & machines',
      blurb: 'Hazards with a sense of rhythm.',
      entries: [
        {
          title: 'spike block',
          note: 'Unstompable.',
          def: def('spikes', [
            body([
              [0, 0],
              [1, 0],
            ]),
            {
              type: 'spikes',
              cells: [
                [0, 0],
                [1, 0],
              ],
              angle: UP,
            },
          ]),
        },
        {
          title: 'dragon burp',
          note: 'Excuse me.',
          def: def('flame', [body([[0, 0]]), { type: 'flame', at: c(), angle: UP, length: 3, on: 70, off: 60, warn: 30 }]),
        },
        {
          title: 'laser pointer',
          note: 'Not for cats.',
          def: def('laser', [body([[0, 0]]), { type: 'laser', at: c(), angle: 0, charge: 50, fire: 50, off: 60, sweep: 0, sweepPeriod: 200 }]),
        },
        {
          title: 'bug zapper',
          note: 'You are the bug.',
          def: def('tesla', [
            body([
              [0, 0],
              [3, 0],
            ]),
            { type: 'tesla', a: c(0, 0), b: c(3, 0), on: 50, off: 70, warn: 30 },
          ]),
        },
        {
          title: 'panini press',
          note: 'Runner filling.',
          def: def('crusher', [
            body([
              [0, 0],
              [1, 0],
            ]),
            { type: 'piston', at: [1, 0.5], angle: R, reach: 2.5, width: 2, period: 130 },
          ]),
        },
        { title: 'bedspring', note: 'No jumping on the bed.', def: def('Bedspring', [{ type: 'spring', at: c(), angle: UP, power: 700 }]) },
        {
          title: 'launch plate',
          note: 'No refunds.',
          def: def('plate', [{ type: 'spring', at: c(), angle: UP, power: 640, exact: true, arc: [300, -560] }]),
        },
        {
          title: 'hair dryer',
          note: 'Big hair day.',
          def: def('fan', [body([[0, 0]]), { type: 'fan', at: c(), angle: UP, length: 4, strength: 2200 }]),
        },
        {
          title: 'fire hydrant',
          note: 'Property of the city. Opened by a kid with a wrench.',
          def: def('hydrant', [
            body([[0, 0]], 'metal', { look: 'hydrant', hue: 4 }),
            { type: 'geyser', look: 'hydrant', at: [0.48, 0.6], angle: 0, width: 0.7, length: 5, off: 120, warn: 42, on: 60, lethal: false, strength: 2200 },
          ]),
        },
      ],
    },
    {
      id: 'movers',
      title: 'Movers & fields',
      blurb: 'Upside, catch, repeat.',
      entries: [
        {
          title: 'pipe dream',
          note: 'Some assembly required. Two, actually.',
          def: def('pipe', [
            {
              type: 'pipe',
              cells: [
                [0, 0],
                [1, 0],
                [0, 1],
                [1, 1],
                [0, 2],
                [1, 2],
              ],
              at: [1, 0],
              angle: UP,
              look: 'green',
            },
          ]),
        },
        { title: 'pinball bumper', note: 'Tilt.', def: def('bumper', [{ type: 'bumper', at: c(), radius: 0.55, power: 420 }]) },
        {
          title: 'sausage vine',
          note: 'Fresh from the hook.',
          def: { ...def('vine', [{ type: 'rope', at: [0.5, 0], length: 5, strain: 330, regrow: 300 }]), mount: 'hang' },
        },
        { title: 'kegapult', note: 'XXX.', def: def('keg', [{ type: 'keg', at: [1, 1], dirs: [7], step: 36, power: 540, delay: 12, burn: 170 }]) },
        {
          title: 'y-fling',
          note: 'Pull. Aim. Regret.',
          def: def('fling', [{ type: 'keg', at: [1, 1], dirs: [7], step: 40, power: 600, delay: 0, burn: 180, aim: 'player', charge: 45, regrow: 240 }], {
            style: { woodHue: 30 },
          }),
        },
        {
          title: 'tipsy kegapult',
          note: 'XXX.',
          def: def('tipsy', [{ type: 'keg', at: [1, 1], dirs: [5, 6, 7, 6], step: 36, power: 540, delay: 12, burn: 170 }]),
        },
        {
          title: 'black hole lite',
          note: 'Zero calories.',
          def: def('well', [body([[0, 0]]), { type: 'magnet', at: c(), radius: 2.6, strength: 1200, polarity: 1, on: 0, off: 0, warn: 30 }], {
            style: { glowHue: 275 },
          }),
        },
        {
          title: 'social distancer',
          note: 'Personal space, enforced.',
          def: def('repulsor', [body([[0, 0]]), { type: 'magnet', at: c(), radius: 2.6, strength: 1500, polarity: -1, on: 80, off: 60, warn: 30 }]),
        },
        {
          title: 'world wide web',
          note: 'Spider not included.',
          def: def('web', [
            {
              type: 'web',
              cells: [
                [0, 0],
                [1, 0],
                [0, 1],
                [1, 1],
              ] as Cell[],
              drag: 0.25,
            },
          ]),
        },
        {
          title: 'hamster wheel',
          note: 'You are the hamster.',
          def: def(
            'wheel',
            [
              {
                type: 'rotor',
                look: 'cog',
                support: 'none',
                mastX: 0,
                hub: c(2, 2),
                arm: 2,
                count: 3,
                angle0: 0,
                period: 300,
                swing: 0,
                dir: 1,
                width: 1.6,
                thick: 0.5,
                material: 'metal',
                seed: 1,
              },
            ],
            {
              footprint: [
                [0, 0],
                [4, 4],
              ],
            },
          ),
        },
      ],
    },
    {
      id: 'triggered',
      title: 'Timed & triggered',
      blurb: 'Patient, petty, punctual.',
      entries: [
        {
          title: 'panic button',
          note: 'The cover was like that when we got here.',
          def: def('panic', [
            {
              type: 'button',
              at: c(0, 1),
              angle: UP,
              cells: [
                [2, 0],
                [3, 0],
                [4, 0],
              ] as Cell[],
              on: 300,
              warn: 60,
            },
          ]),
        },
        {
          title: 'fuse crate',
          note: 'FRAGILE. Very.',
          def: def('fuse', [{ type: 'fuse', cells: [[0, 0]], trigger: 'land', count: 180, radius: 1.5, regrow: 360 }]),
        },
        {
          title: 'four-square',
          note: 'Not the long one. Never the long one.',
          def: def('tetra', [
            body(
              [
                [0, 0],
                [1, 0],
                [2, 0],
                [1, 1],
              ] as Cell[],
              'stone',
              { look: 'tetra', hue: 285 },
            ),
          ]),
        },
        {
          title: 'yolo blocks',
          note: 'Trust the beat.',
          def: def('blink', [
            {
              type: 'phase',
              cells: [
                [0, 0],
                [1, 0],
                [2, 0],
              ] as Cell[],
              on: 100,
              off: 70,
              offset: 0,
            },
          ]),
        },
        {
          title: 'on/off bricks',
          note: 'Your turn. My turn.',
          def: def('blinkpair', [
            {
              type: 'phase',
              cells: [
                [0, 0],
                [1, 0],
              ] as Cell[],
              on: 90,
              off: 90,
              offset: 0,
            },
            {
              type: 'phase',
              cells: [
                [2, 0],
                [3, 0],
              ] as Cell[],
              on: 90,
              off: 90,
              offset: 90,
            },
          ]),
        },
        {
          title: 'thwunk',
          note: 'Gravity, on a hair trigger.',
          def: def('dropper', [
            {
              type: 'dropper',
              cells: [
                [0, 0],
                [1, 0],
                [0, 1],
                [1, 1],
              ] as Cell[],
              angle: R,
              reach: 3,
              warn: 20,
              rest: 60,
            },
          ]),
        },
        {
          title: 'surprise party',
          note: 'Surprise!',
          def: {
            ...def('snapper', [
              {
                type: 'snapper',
                cells: [
                  [0, 0],
                  [1, 0],
                ] as Cell[],
                angle: UP,
                warn: 18,
                up: 30,
                cool: 60,
              },
            ]),
            mount: 'face' as const,
          },
        },
      ],
    },
    {
      id: 'demolition',
      title: 'Demolition',
      blurb: 'Renovation, the fast way.',
      entries: [
        { title: 'cartoon bomb', note: 'Lit.', def: def('bomb', [{ type: 'bomb', radius: 2.5, look: 'bomb' }]) },
        { title: 'balance patch', note: 'Patch notes: yes.', def: def('emp', [{ type: 'bomb', radius: 3.5, target: 'props', look: 'emp' }]) },
        {
          title: 'tunnel vision',
          note: 'Straight ahead.',
          def: def('drill', [{ type: 'bomb', radius: 7, shape: 'line', target: 'terrain', look: 'drill' }]),
        },
        { title: 'plus bomb', note: 'Plus-sized.', def: def('cross', [{ type: 'bomb', radius: 4, shape: 'cross', look: 'charge' }]) },
        {
          title: 'glazed donut',
          note: 'Hole included.',
          def: def('ring', [{ type: 'bomb', radius: 3.2, shape: 'ring', width: 1.3, look: 'charge' }]),
        },
        {
          title: 'hurry-up timer',
          note: 'Snooze.',
          def: def('timebomb', [{ type: 'bomb', radius: 2.5, look: 'clock', delay: true }]),
        },
      ],
    },
    {
      id: 'items',
      title: 'Items',
      blurb: 'Odds not disclosed.',
      entries: [
        { title: 'loot box', note: 'Contents may vary.', def: crate('loot box', [...ITEM_KINDS], 0, 'crate') },
        ...ITEM_KINDS.map((k) => ({ title: ITEMS[k].name.toLowerCase(), note: ITEM_NOTES[k], def: crate(ITEMS[k].name, [k], 0, 'crate'), item: k })),
      ],
    },
    {
      id: 'motion',
      title: 'Motion',
      blurb: 'Anything can commute. Even saws.',
      entries: [
        {
          title: 'rail',
          note: 'Nine to five.',
          def: def(
            'rail',
            [
              body(
                [
                  [0, 0],
                  [1, 0],
                  [2, 0],
                ],
                'wood',
              ),
            ],
            { motion: { type: 'rail', angle: 0, range: 3, period: 160 } },
          ),
        },
        {
          title: 'loop',
          note: 'Around we go.',
          def: def(
            'loop',
            [
              body(
                [
                  [0, 0],
                  [1, 0],
                ],
                'metal',
              ),
            ],
            { motion: { type: 'loop', radius: 1.5, period: 200, dir: 1 } },
          ),
        },
      ],
    },
    {
      id: 'finishes',
      title: 'Finishes',
      blurb: 'Cosmetic only. No pay-to-win here.',
      entries: [
        ...metals.map((m) => ({
          title: m,
          note: 'metal style',
          def: def(
            m,
            [
              body([
                [0, 0],
                [1, 0],
              ]),
            ],
            { style: { metal: m, trim: 'rivets' } },
          ),
        })),
        ...trims.map((t) => ({
          title: t,
          note: 'trim',
          def: def(
            t,
            [
              body([
                [0, 0],
                [1, 0],
              ]),
            ],
            { style: { metal: 'steel', trim: t, glowHue: 170 } },
          ),
        })),
      ],
    },
  ];
}
