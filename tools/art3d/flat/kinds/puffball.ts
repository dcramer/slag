import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 279,
  // Its seam traced as one long stroke across the ball and its pale highlight as a strip, a mouth at play
  // size; its tape cross beside the eyes read as a third eye: no interior lines, and tape and highlight are the ball.
  map: {
    roles: ['pink', 'red', 'dark'],
    families: [
      ['pink', [244, 154, 179]],
      ['pink', [203, 98, 122]],
      ['pink', [222, 112, 142]],
      ['pink', [179, 105, 124]],
      ['pink', [211, 168, 180]],
      ['red', [190, 64, 57]],
      ['red', [149, 43, 47]],
      ['pink', [184, 176, 178]],
      ['pink', [234, 200, 203]],
      ['dark', [71, 20, 40]],
      ['dark', [33, 4, 15]],
      ['dark', [255, 255, 255]],
    ],
    line: 'dark',
    thin: ['pink', 'red'],
    fringe: 5,
    stroke: 99,
    feet: ['red'],
    min: { dark: 0.35 },
  },
  roles: [
    { name: 'pink', color: '#f2a0bc', slot: 'player' },
    // A colourway is the feet (VARIETY.palette): red, orange or yellow.
    { name: 'red', color: '#c9473f', alts: ['#e07b2c', '#e8b23a'], vary: 6 },
    { name: 'white', color: '#f4efe6' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'scuff', color: '#808080', on: 0, tone: 8 },
    // One quiet mark a wear: on a smooth ball, a loud blob reads as a spot.
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 0, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', area: [0.2, 6], gap: [1.5, 5.5], specks: { dark: 6 } },
  wear: {
    on: ['pink'],
    chin: 3.5,
    marks: [[['scuff', 0.68, 0.78, 1.0]], [['scorch', 0.7, 0.75, 1.1]]],
  },
  // Across the cheek: on a ball's crown a cross read as bumps on top, and the ball as another character.
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2.2, 0.85] }],
  face: { r: 1, iris: '#2a1f1a', mouth: [2, 2.6], eye: 'tall' },
  gait: { bounce: [0.1, 0.8], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 26 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200] },
    wall: { frames: ['wall'], loop: true, fps: 1 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.7, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  poses: {
    idle2: { pose: 'looking up, both stubby arms tucked behind it, tapping one foot.' },
    'walk-1': { pose: 'waddling to the right, mid-step: the near foot forward, the far foot back.' },
    'walk-2': { pose: 'waddling to the right, one foot planted, the other lifted a little.' },
    'run-1': { pose: 'running fast to the right, leaning forward, the feet in a long stride, the arms swept back.' },
    'run-2': { pose: 'running fast to the right, leaning forward, both feet off the ground tucked under it.' },
    'air-1': { pose: 'jumping up, both arms raised, the feet tucked under.' },
    'air-2': { pose: 'falling, both arms flung up, the feet dangling, the mouth open in alarm.' },
    wall: {
      pose: 'seen from its side, it is sliding down a tall wall on the right edge of the picture (do not draw the wall), one arm and one foot pressed flat against it, looking back at us.',
      far: true,
    },
    cheer: { pose: 'cheering with both arms thrown up, up on its toes, a big open smile.' },
    cheer2: { pose: 'puffed up even rounder, waving one arm high, a big open smile.' },
    death: { pose: 'knocked out and lying flat on its back on the floor, feet in the air, eyes shut. Seen from the side.', far: true },
  },
};
