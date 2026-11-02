import { type Cell, normalizeCells, type Vec } from '../core/geom';
import { AMMO, type Ammo, type Material, type MetalStyle, type Module, type Motion, moduleSim, type PropDef, type PropStyle, type Trim } from '../sim/props';

/**
 * The codex "parts" catalog: every building block in isolation, with fixed
 * representative parameters, so you can see what each piece *is* before
 * seeing the procedural combinations.
 */

export interface PartEntry {
  title: string;
  note: string;
  def: PropDef;
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

function def(name: string, modules: Module[], opts: { style?: Partial<PropStyle>; motion?: Motion } = {}): PropDef {
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
    footprint: normalizeCells([...cells.values()]),
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

const MATERIAL_NOTES: Record<Material, string> = {
  stone: 'Plain solid footing.',
  metal: 'Plain solid; most mounts are metal.',
  wood: 'Plain solid, warm and planky.',
  ice: 'Slippery: you keep sliding. On walls: no wall slide or wall jump.',
  conveyor: 'Carries you along its belt.',
  goo: 'Slow and sticky; weak jumps. On walls: you cling.',
  jelly: 'Bounces you back up when you land hard.',
  crumble: 'Breaks shortly after you stand on it, then respawns.',
};

const LAUNCHER_NOTES: Record<string, [Ammo, string]> = {
  crossbow: ['bolt', 'Fast, straight bolts (or arcing arrows).'],
  ballista: ['bolt', 'Slow to reload, very fast heavy bolts.'],
  cannon: ['cannonball', 'Lobs heavy cannonballs in an arc.'],
  totem: ['fireball', 'Wobbly, glowing fireballs; often fans out.'],
  turret: ['plasma', 'Rapid bursts of plasma.'],
  thrower: ['shuriken', 'Spinning stars, sometimes several at once.'],
  rocket: ['seeker', 'Slow homing missiles. Lure them into walls.'],
  glaive: ['boomerang', 'Throws a boomerang that comes back along the same line.'],
  gumball: ['rubber', 'Lobs bouncy balls that shove you (not lethal).'],
  mortar: ['cluster', 'Shells that burst into a fan of shrapnel at the top of their arc.'],
  gooper: ['goo', 'Goo globs: slow you on a hit, coat walls and floors in slime.'],
  cryo: ['frost', 'Frost shards: freeze you briefly, glaze surfaces with ice.'],
  prism: ['ricochet', 'Bolts that bank off walls up to three times.'],
  hangar: ['glider', 'Launches gliders you can ride. They sink under you.'],
};

export const PROJECTILE_NOTES: Record<Ammo, string> = {
  bolt: 'Straight and fast.',
  arrow: 'Arcs under gravity.',
  cannonball: 'Heavy, big hitbox, lobbed.',
  fireball: 'Slow, wobbles side to side, glows.',
  plasma: 'Fast glowing bolt.',
  shuriken: 'Spins, slight drop.',
  seeker: 'Homing: slow, turns toward the nearest runner a little each frame. Telegraphed by its red eye.',
  boomerang: 'Flies out, stops, and comes back through its thrower.',
  rubber: 'Bounces off walls and floors (five times). A hit shoves you instead of killing.',
  cluster: 'Lobbed shell that splits into five pieces of shrapnel.',
  shrapnel: 'Short-lived fragment from a cluster shell.',
  goo: 'Not lethal: slows you for a couple of seconds, or sticks to terrain as a slime coat.',
  frost: 'Not lethal: freezes you solid for a moment, or glazes terrain with ice.',
  ricochet: 'Fast bolt that reflects off walls up to three times.',
  glider: 'Not a bullet: a flying plank you can ride. Flies level, then sinks, faster with a rider.',
};

export function partGroups(): PartGroup[] {
  const materials: Material[] = ['stone', 'metal', 'wood', 'ice', 'conveyor', 'goo', 'jelly', 'crumble'];
  const metals: MetalStyle[] = ['steel', 'brass', 'copper', 'rust', 'obsidian', 'bone', 'jade', 'gold'];
  const trims: Trim[] = ['none', 'stripes', 'rivets', 'runes', 'gems'];
  return [
    {
      id: 'materials',
      title: 'Blocks & materials',
      blurb: 'Solid cells. The material changes how they feel to stand on (and to wall-jump off).',
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
      blurb: 'Mounted flush on an exposed face of a block (shown dashed). Rotate to choose the face: top, sides or underneath.',
      entries: (['spikes', 'ice', 'slime'] as const).flatMap((kind) =>
        [-Math.PI / 2, 0].map((angle) => ({
          title: `${kind} · ${angle === 0 ? 'wall' : 'floor'}`,
          note: {
            spikes: 'Lethal strip on that face.',
            ice: angle === 0 ? 'Slick wall: no wall slide, no wall jump.' : 'Slippery floor: you keep sliding.',
            slime: angle === 0 ? 'Sticky wall: you cling and slide slowly.' : 'Slow, sticky floor; weak jumps.',
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
      blurb: 'Deadly heads that sit on a hub: spin in place, orbit on an arm, or swing like a pendulum on a rod or chain.',
      entries: [
        {
          title: 'saw',
          note: 'Spinning blade. Throws sparks when it grinds terrain.',
          def: def('saw', [{ type: 'swinger', head: 'saw', hub: c(), arm: 0, angle0: 0, period: 30, swing: 0, dir: 1, radius: 1.1, count: 1, link: 'none' }]),
        },
        {
          title: 'mace',
          note: 'Spiked ball, usually on a chain.',
          def: def('mace', [
            body([[0, 0]]),
            { type: 'swinger', head: 'mace', hub: c(), arm: 2.2, angle0: 0, period: 150, swing: 0, dir: 1, radius: 0.8, count: 1, link: 'chain' },
          ]),
        },
        {
          title: 'axe',
          note: 'Pendulum blade.',
          def: def('axe', [
            body([[0, 0]]),
            { type: 'swinger', head: 'axe', hub: c(), arm: 2.6, angle0: R, period: 140, swing: 1.1, dir: 1, radius: 0.9, count: 1, link: 'rod' },
          ]),
        },
        {
          title: 'orbit',
          note: 'Heads circle the hub (1–3 heads).',
          def: def('orbit', [
            body([[0, 0]]),
            { type: 'swinger', head: 'saw', hub: c(), arm: 2, angle0: 0, period: 140, swing: 0, dir: 1, radius: 0.6, count: 2, link: 'rod' },
          ]),
        },
        {
          title: 'pendulum',
          note: 'Swings back and forth under the hub.',
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
      blurb: 'Fire projectiles on a schedule. Aim can be fixed, sweeping, or tracking the nearest runner.',
      entries: [
        ...Object.entries(LAUNCHER_NOTES).map(([styleName, [ammo, note]]) => ({
          title: styleName,
          note,
          def: def(styleName, [
            body([[0, 0]], styleName === 'crossbow' || styleName === 'totem' ? 'wood' : 'metal'),
            {
              type: 'launcher',
              style: styleName as 'crossbow',
              ammo,
              at: c(),
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
          title: 'tracking aim',
          note: 'Red sensor eye: turns toward runners in front of it.',
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
          title: 'sweeping aim',
          note: 'Aim oscillates back and forth.',
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
      ],
    },
    {
      id: 'emitters',
      title: 'Emitters & machines',
      blurb: 'Things that cycle between safe and deadly — learn their rhythm.',
      entries: [
        {
          title: 'spikes',
          note: 'Lethal face. Rotation picks the side.',
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
          title: 'flame jet',
          note: 'Sputters a warning, then roars.',
          def: def('flame', [body([[0, 0]]), { type: 'flame', at: c(), angle: UP, length: 3, on: 70, off: 60, warn: 30 }]),
        },
        {
          title: 'laser',
          note: 'Charges (telegraph), then fires to the first wall.',
          def: def('laser', [body([[0, 0]]), { type: 'laser', at: c(), angle: 0, charge: 50, fire: 50, off: 60, sweep: 0, sweepPeriod: 200 }]),
        },
        {
          title: 'tesla gate',
          note: 'Arcs lightning between two pylons.',
          def: def('tesla', [
            body([
              [0, 0],
              [3, 0],
            ]),
            { type: 'tesla', a: c(0, 0), b: c(3, 0), on: 50, off: 70, warn: 30 },
          ]),
        },
        {
          title: 'crusher',
          note: 'Slams out fast, retracts slowly. Squishes against walls.',
          def: def('crusher', [
            body([
              [0, 0],
              [1, 0],
            ]),
            { type: 'piston', at: [1, 0.5], angle: R, reach: 2.5, width: 2, period: 130 },
          ]),
        },
        { title: 'spring', note: 'Launches you the way it faces.', def: def('spring', [{ type: 'spring', at: c(), angle: UP, power: 700 }]) },
        {
          title: 'fan',
          note: 'Steady wind along its column: lifts you and lets you float at the top.',
          def: def('fan', [body([[0, 0]]), { type: 'fan', at: c(), angle: UP, length: 4, strength: 2200 }]),
        },
      ],
    },
    {
      id: 'movers',
      title: 'Movers & fields',
      blurb: 'Things that move you rather than kill you. Every one has an upside and a catch.',
      entries: [
        {
          title: 'warp pads',
          note: 'In one, out the other, speed intact.',
          def: def('portal', [{ type: 'portal', a: c(0, 0), b: c(4, 0) }]),
        },
        { title: 'bumper', note: 'Kicks you away from its center.', def: def('bumper', [{ type: 'bumper', at: c(), radius: 0.55, power: 420 }]) },
        {
          title: 'gravity well',
          note: 'Pulls you toward its core.',
          def: def('well', [body([[0, 0]]), { type: 'magnet', at: c(), radius: 2.6, strength: 1200, polarity: 1, on: 0, off: 0, warn: 30 }], {
            style: { glowHue: 275 },
          }),
        },
        {
          title: 'repulsor',
          note: 'Pushes you away; this one pulses.',
          def: def('repulsor', [body([[0, 0]]), { type: 'magnet', at: c(), radius: 2.6, strength: 1500, polarity: -1, on: 80, off: 60, warn: 30 }]),
        },
        {
          title: 'web',
          note: 'Catches falls; slows everything.',
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
          title: 'wheel',
          note: 'Platforms you ride around a hub.',
          def: def('wheel', [
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
          ]),
        },
      ],
    },
    {
      id: 'triggered',
      title: 'Timed & triggered',
      blurb: 'Blocks on a clock and traps that wait for you. Each has a visible tell before it changes.',
      entries: [
        {
          title: 'blink blocks',
          note: 'Solid on a timer; flicker first.',
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
          title: 'blink pair',
          note: 'Two sets take turns.',
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
          title: 'dropstone',
          note: 'Slams when you pass underneath.',
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
          title: 'snap trap',
          note: 'Spikes pop when you step on it.',
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
      blurb: 'Detonated, not built. Each blast has a shape and a target; the placement preview shows exactly which cells and props it takes.',
      entries: [
        { title: 'bomb', note: 'Disk: terrain and props.', def: def('bomb', [{ type: 'bomb', radius: 2.5, look: 'bomb' }]) },
        { title: 'EMP', note: 'Disk: props only, terrain untouched.', def: def('emp', [{ type: 'bomb', radius: 3.5, target: 'props', look: 'emp' }]) },
        {
          title: 'drill',
          note: 'Bores a tunnel the way it faces.',
          def: def('drill', [{ type: 'bomb', radius: 7, shape: 'line', target: 'terrain', look: 'drill' }]),
        },
        { title: 'cross charge', note: 'Blasts a plus shape.', def: def('cross', [{ type: 'bomb', radius: 4, shape: 'cross', look: 'charge' }]) },
        {
          title: 'ring charge',
          note: 'Hollow ring: the middle survives.',
          def: def('ring', [{ type: 'bomb', radius: 3.2, shape: 'ring', width: 1.3, look: 'charge' }]),
        },
        {
          title: 'time bomb',
          note: 'Goes off at race start, after everyone places.',
          def: def('timebomb', [{ type: 'bomb', radius: 2.5, look: 'clock', delay: true }]),
        },
      ],
    },
    {
      id: 'motion',
      title: 'Motion',
      blurb: 'Any prop can ride a rail or loop around — including hazards.',
      entries: [
        {
          title: 'rail',
          note: 'Back and forth along a track.',
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
          note: 'Circles around a point.',
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
      blurb: 'Cosmetic only: metal styles and trims rolled per prop.',
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
