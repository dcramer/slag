import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 293,
  map: {
    roles: ['yellow', 'dark', 'grey', 'napkin', 'check'],
    families: [
      ['yellow', [244, 203, 33]],
      ['yellow', [187, 144, 32]],
      ['yellow', [245, 208, 57]],
      ['dark', [41, 28, 20]],
      ['grey', [154, 154, 153]],
      ['napkin', [248, 243, 230]],
      ['check', [166, 61, 39]],
      ['check', [179, 103, 59]],
    ],
    line: 'dark',
    thin: ['yellow', 'grey', 'napkin', 'check'],
    fringe: 5,
    stroke: 2.4,
    // Its open mouth is a gap, not a dark fill: the wedge is the read, in the silhouette above all.
    cut: { role: 'dark', area: 2 },
    feet: ['yellow'],
    min: { dark: 0.1, check: 0.15 },
  },
  roles: [
    { name: 'yellow', color: '#f6d02a', slot: 'player' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'grey', color: '#9aa0a8' },
    { name: 'napkin', color: '#fbf6ee' },
    // A colourway is the napkin's check (VARIETY.palette): red, blue or green.
    { name: 'check', color: '#c9473f', alts: ['#3f62b4', '#3f8a3a'], vary: 6 },
    { name: 'scuff', color: '#808080', on: 0, tone: 8 },
    // One quiet mark a wear: on a smooth ball, a loud blob reads as a spot.
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', area: [0.08, 1.5], gap: [1, 4], specks: { dark: 0.9 }, count: 1 },
  wear: {
    on: ['yellow'],
    chin: 2,
    marks: [[['scuff', 0.25, 0.8, 0.9]], [['scorch', 0.22, 0.72, 1.1]]],
  },
  // On the crown, a cross reads as a bow and a ball with a bow as another kind: across the cheek.
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2.2, 0.8] }],
  face: { r: 0.8, iris: '#14121a', eye: 'dot' },
  gait: { bounce: [0, 0.7], lean: [0, 0.04] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 24 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 36 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200] },
    // Its wall drawing grew a slab pressed to the wall, taller than the box: a ball slides in its fall.
    wall: { frames: ['air-2'], loop: true, fps: 1 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.7, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.9 },
  },
  poses: {
    idle2: { pose: 'mouth shut tight into a full round ball with only a line for the mouth, eyeing the floor.' },
    'walk-1': { pose: 'moving to the right with the mouth half open.' },
    'walk-2': { pose: 'moving to the right with the mouth shut to a thin line.' },
    'run-1': { pose: 'racing to the right, tipped forward, the mouth thrown wide open.' },
    'run-2': { pose: 'racing to the right, tipped forward, the mouth snapped shut to a thin line.' },
    'air-1': { pose: 'hopping up into the air, the mouth wide open.' },
    'air-2': { pose: 'falling, tipped back, the mouth open in alarm and the eye wide.' },
    cheer: { pose: 'hopping on the spot with joy, the mouth wide open in a grin.' },
    cheer2: { pose: 'rolling back on itself, tipped over backwards, the mouth thrown wide open, laughing.' },
    death: {
      pose: 'knocked out and squashed flat as a pancake on the floor, an oval much wider than it is tall, the mouth a limp line, the eye shut. Seen from the side.',
      far: true,
    },
  },
};
