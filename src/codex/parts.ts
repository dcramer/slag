import { type Cell, normalizeCells, type Vec } from '../core/geom';
import { type Ammo, type Material, type MetalStyle, type Module, type Motion, moduleSim, type PropDef, type PropStyle, type Trim } from '../sim/props';

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
};

export const PROJECTILE_NOTES: Record<Ammo, string> = {
  bolt: 'Straight and fast.',
  arrow: 'Arcs under gravity.',
  cannonball: 'Heavy, big hitbox, lobbed.',
  fireball: 'Slow, wobbles side to side, glows.',
  plasma: 'Fast glowing bolt.',
  shuriken: 'Spins, slight drop.',
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
              angle: ammo === 'cannonball' ? -0.5 : 0,
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
        { title: 'bomb', note: 'Detonates where you place it, clearing terrain and props.', def: def('bomb', [{ type: 'bomb', radius: 2.5 }]) },
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
