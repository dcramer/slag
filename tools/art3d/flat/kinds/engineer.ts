import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 238,
  map: {
    roles: ['skin', 'shirt', 'khaki', 'brown', 'tan', 'grey', 'yellow', 'strap', 'lens', 'white', 'dark'],
    families: [
      ['skin', [252, 177, 127]],
      ['skin', [203, 116, 90]],
      ['shirt', [170, 54, 43]],
      ['shirt', [125, 39, 35]],
      ['shirt', [174, 69, 55]],
      ['shirt', [154, 50, 42]],
      ['khaki', [140, 104, 78]],
      ['khaki', [93, 81, 74]],
      ['khaki', [85, 62, 51]],
      ['brown', [108, 70, 51]],
      ['brown', [124, 74, 50]],
      ['tan', [171, 121, 62]],
      ['tan', [170, 129, 81]],
      ['grey', [150, 150, 146]],
      ['grey', [118, 118, 116]],
      ['grey', [200, 200, 196]],
      ['yellow', [236, 187, 57]],
      ['yellow', [199, 138, 51]],
      ['yellow', [190, 130, 32]],
      ['yellow', [231, 183, 85]],
      ['strap', [54, 62, 64]],
      ['strap', [72, 82, 83]],
      ['grey', [107, 107, 107]],
      ['lens', [127, 166, 173]],
      // The lenses' glints and the teeth of a grin: as dark, a glint reads as a pupil in the goggles; as lens, the teeth go blue.
      ['white', [255, 255, 255]],
      ['dark', [37, 22, 28]],
      ['dark', [25, 9, 13]],
      ['dark', [48, 9, 10]],
      ['dark', [68, 35, 29]],
    ],
    line: 'dark',
    thin: ['skin', 'shirt', 'khaki', 'brown', 'tan', 'grey', 'yellow', 'strap', 'lens', 'white'],
    fringe: 5,
    stroke: 2.4,
    feet: ['khaki'],
    min: { dark: 0.12, grey: 0.25, lens: 0.2, white: 0.08 },
  },
  roles: [
    { name: 'skin', color: '#efc9a4' },
    // The work shirt is the costume, in the player's colour.
    { name: 'shirt', color: '#b8433c', slot: 'player' },
    // A colourway is the trousers (VARIETY.palette); the boots are drawn in them.
    { name: 'khaki', color: '#8c7a58', alts: ['#6b7178', '#5e5f3c'], vary: 6 },
    { name: 'brown', color: '#6b4a35' },
    { name: 'tan', color: '#b08454' },
    { name: 'grey', color: '#8e8a84' },
    { name: 'yellow', color: '#e9b730' },
    { name: 'strap', color: '#3a4246' },
    { name: 'lens', color: '#5fb0c8' },
    { name: 'white', color: '#f4efe6' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear, in tones of the shirt (the player's colour) and the trousers it's on: a faded patch, and soot.
    { name: 'scuff', color: '#808080', on: 1, tone: 12 },
    { name: 'scuff2', color: '#808080', on: 2, tone: 14 },
    { name: 'scorch', color: '#808080', on: 1, tone: -18 },
    { name: 'scorch2', color: '#808080', on: 2, tone: -22 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', area: [0.03, 2.6], gap: [1.4, 4.5], specks: { dark: 2.8 } },
  wear: {
    on: ['shirt', 'khaki'],
    chin: 3,
    marks: [
      [
        ['scuff', 0.55, 0.3, 1.0],
        ['scuff2', 0.4, 0.88, 0.6],
      ],
      [
        ['scorch', 0.5, 0.3, 1.1],
        ['scorch2', 0.62, 0.88, 0.6],
      ],
    ],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2.2, 0.9] }],
  face: { r: 0.85, iris: '#3c6fd0' },
  gait: { bounce: [0.1, 0.6], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box' },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3], eyes: false },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Every pose keeps the spanner level on his shoulder, its open jaw out behind him below the brim, and
  // nothing raised over the hat: a fist or the spanner held up read as spikes off the hat (blind read).
  poses: {
    idle2: {
      pose: 'standing with his chest puffed out and the bare hand on his hip, the spanner still resting level on his shoulder in the gloved hand, looking pleased with himself.',
    },
    'walk-1': {
      pose: 'trudging to the right with a heavy step, mid-step: the near boot forward, the far boot back, the spanner resting level on his shoulder.',
    },
    'walk-2': {
      pose: 'trudging to the right, the legs passing under the body: one boot planted flat, the other lifted a little, the spanner resting level on his shoulder.',
    },
    'run-1': {
      pose: 'running hard to the right, leaning forward, one knee high and the other leg pushing off, the bare fist pumping low at his side, the spanner level on his shoulder with its jaw out behind him.',
    },
    'run-2': {
      pose: 'running hard to the right, leaning forward, both boots off the ground with the legs gathered under him, the bare fist pumping low at his side, the spanner level on his shoulder with its jaw out behind him.',
    },
    'air-1': {
      pose: 'jumping up, the knees tucked up under him, the bare fist clenched in front of his chest, the spanner still level on his shoulder with its jaw out behind him; nothing raised above his hat.',
    },
    'air-2': {
      pose: 'falling, the legs reaching down, the bare arm flung out to the side at shoulder height, the spanner still level on his shoulder, the mouth open in alarm; nothing raised above his hat.',
    },
    wall: {
      pose: 'seen from his side, he is sliding down a tall wall on the right edge of the picture (do not draw the wall), the bare hand flat against it and both boots braced on it, the spanner level on his shoulder with its jaw out behind him, his head turned to look back at us.',
      far: true,
    },
    cheer: { pose: 'cheering, the bare fist punched up beside his hat, a big grin, up on his toes, the spanner still resting on his shoulder.' },
    cheer2: { pose: 'leaning back laughing, turned a little toward us, the bare hand on his belly, the spanner resting on his shoulder.' },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal across the picture, head on the left and boots on the right, arms and legs splayed limp, eyes shut, the bowl hat still on his head, the one spanner dropped beside him. One figure only, seen from the side.',
      far: true,
    },
  },
};
