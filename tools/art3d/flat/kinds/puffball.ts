import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 263,
  // A long line across a ball reads as a mouth at play size (the vinyl toy's seam did): no interior lines.
  map: {
    roles: ['pink', 'red', 'sole', 'white', 'dark'],
    // Sampled from the design (the googly-eyed knock-off, 2026-11-06). The crown's gloss and the blush fold into the
    // ball: the face kit draws the blush, one pink on any ball.
    families: [
      ['pink', [242, 146, 173]],
      ['pink', [213, 92, 127]],
      ['pink', [234, 116, 151]],
      ['pink', [227, 156, 177]],
      ['pink', [183, 98, 123]],
      ['pink', [220, 97, 132]],
      ['pink', [252, 196, 212]],
      ['pink', [203, 98, 122]],
      ['red', [185, 56, 51]],
      ['red', [173, 43, 45]],
      ['red', [124, 28, 41]],
      ['red', [169, 61, 59]],
      ['red', [150, 37, 45]],
      // The googly eyes' whites and the toe scuffed pale are one pale in the drawing. The eyes' go as specks under
      // the kit's own, so what's left is the toe, a tone between the shoe and the ball (in cream it read as a hole).
      ['sole', [224, 207, 209]],
      ['sole', [246, 244, 243]],
      ['sole', [199, 166, 181]],
      // The knocked-out drawing's discs, painted a white of their own round an ink cross (eyes.py).
      ['white', [200, 230, 240]],
      ['dark', [52, 13, 32]],
      ['dark', [50, 5, 25]],
      ['dark', [55, 31, 47]],
      ['dark', [128, 120, 126]],
    ],
    line: 'dark',
    thin: ['pink', 'red', 'sole', 'white'],
    fringe: 5,
    stroke: 99,
    feet: ['red'],
    // The open mouth's tongue is red: kept, it was a speck of the feet's colourway inside the mouth.
    min: { dark: 0.6, sole: 0.4, red: 2 },
  },
  roles: [
    { name: 'pink', color: '#f2a0bc', slot: 'player' },
    // The feet, a dark of the ball: the player's colour, as the plumber's cap shade is.
    { name: 'red', color: '#808080', on: 0, tone: -18 },
    // The shoe scuffed through at the toe, a tone between the shoe and the ball: in a cream padding it was the farm's own
    // colour, and read as a hole in the toe.
    { name: 'sole', color: '#808080', on: 0, tone: -8 },
    { name: 'white', color: '#f4efe6' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'scuff', color: '#808080', on: 0, tone: 8 },
    // One quiet mark a wear: on a smooth ball, a loud blob reads as a spot.
    { name: 'scorch', color: '#808080', on: 0, tone: -12 },
    // A colourway is the plaster (VARIETY.palette): fabric, gauze or grey tape.
    { name: 'plaster', color: '#e9d3b0', alts: ['#f1ede4', '#b9bcbf'], vary: 6 },
  ],
  slots: [
    { name: 'plaster', vary: 0, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // The drawn pupils are painted out and a dot set in each disc's middle (eyes.py): rolled two ways, they sat at two
  // heights, which the finder never pairs. The discs go as specks; the kit draws its own googly eyes there.
  eyes: { role: 'dark', area: [0.2, 6], gap: [3, 8], specks: { dark: 8, sole: 30 } },
  wear: {
    on: ['pink'],
    chin: 3.5,
    marks: [[['scuff', 0.68, 0.78, 1.0]], [['scorch', 0.7, 0.75, 1.1]]],
  },
  // Low on the side behind the near eye: on a ball's crown a cross read as bumps on top, and the ball as another
  // character; beside the googly eye it was a brow.
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2.2, 0.85], offset: [-2.6, 1.8] }],
  face: { r: 1.35, iris: '#2a1f1a', mouth: [2, 2.6], eye: 'googly' },
  gait: { bounce: [0.1, 0.8], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 26 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200] },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.92 },
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
