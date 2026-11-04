import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 144,
  map: {
    roles: ['green', 'darn', 'skin', 'hair', 'brown', 'lid', 'iron', 'dark'],
    families: [
      ['green', [71, 124, 56]],
      ['green', [48, 87, 60]],
      ['green', [68, 118, 58]],
      ['green', [95, 131, 85]],
      ['darn', [169, 193, 119]],
      ['skin', [246, 199, 160]],
      ['skin', [238, 205, 179]],
      ['skin', [181, 130, 99]],
      ['hair', [228, 187, 82]],
      ['hair', [237, 193, 117]],
      ['brown', [107, 70, 52]],
      ['brown', [69, 45, 36]],
      ['brown', [125, 92, 73]],
      ['brown', [77, 57, 50]],
      ['lid', [157, 162, 168]],
      ['lid', [170, 169, 166]],
      ['lid', [121, 110, 109]],
      ['lid', [167, 153, 135]],
      ['dark', [255, 255, 255]],
      ['iron', [40, 44, 46]],
      ['iron', [60, 62, 66]],
      // The poker's highlight stripe: nearer the lid's shade, it split the poker and let the silhouette's ink (the player's) through.
      ['iron', [92, 92, 96]],
      ['dark', [12, 13, 17]],
    ],
    line: 'dark',
    thin: ['green', 'darn', 'skin', 'hair', 'brown', 'lid', 'iron'],
    fringe: 5,
    stroke: 6,
    feet: ['brown'],
    loose: ['iron'],
    ink: 5,
    min: { dark: 0.1 },
  },
  roles: [
    { name: 'green', color: '#3f7a34', slot: 'player' },
    // The darned toe is a light of the costume, so it follows the player's colour.
    { name: 'darn', color: '#5a9a4a', on: 0, tone: 18 },
    { name: 'skin', color: '#efc9a4' },
    { name: 'hair', color: '#e6c25a' },
    { name: 'brown', color: '#6b4a35' },
    // A colourway is the dustbin lid (VARIETY.palette): galvanised, recycling blue or black plastic.
    { name: 'lid', color: '#a8adb4', alts: ['#5f80a8', '#5a5e66'], vary: 6 },
    { name: 'iron', color: '#4a4a52' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -16 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // What's left of the drawing's eyes once its specks are painted over (a rim the traced speck missed), and the
  // dark scraps under the face, drawn as skin: under the kit's thin cheer arcs and blink the rim read as a
  // black eye.
  recolour: { from: 'dark', to: 'skin', below: -0.8, lying: [99, 0] },
  eyes: { role: 'dark', area: [0.12, 1.8], gap: [1.2, 4.5], specks: { dark: 2 }, band: [0.1, 0.45], count: 1, pair: [1.7, 0] },
  wear: {
    on: ['green'],
    chin: 3,
    marks: [
      [
        ['scuff', 0.6, 0.6, 0.5],
        ['scuff', 0.45, 0.76, 0.4],
      ],
      // Off the jagged hem and quiet: a dark mark down there read as a hole or a blotch.
      [
        ['scorch', 0.55, 0.62, 0.5],
        ['scorch', 0.42, 0.76, 0.4],
      ],
    ],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.9, 0.8] }],
  face: { r: 0.65, iris: '#3c78c8' },
  gait: { bounce: [0.2, 0.8], lean: [0, 0.04] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 46 },
    // One jump drawing up and down: his falling ones lost the cap.
    air: { frames: ['air-1'], loop: true, fps: 1 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.7, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  poses: {
    idle2: { pose: 'standing alert with one hand on his belt, looking off to the side.' },
    'walk-1': { pose: 'walking to the right, mid-step: the near boot forward, the far boot back, the poker in his hand, the arms swinging the other way.' },
    'walk-2': { pose: 'walking to the right, the legs passing under the body: one boot planted, the other lifted a little, the poker in his hand.' },
    'run-1': { pose: 'running fast to the right, striding out long, leaning forward, the poker in his hand, the sock cap streaming out behind.' },
    'run-2': {
      pose: 'running fast to the right, leaning forward, both boots off the ground with the legs gathered under him, the sock cap streaming out behind.',
    },
    'air-1': { pose: 'jumping up with his knees tucked, the poker raised over his head, the sock cap flung up behind.' },
    wall: {
      pose: 'seen from his side, he is sliding down a tall wall on the right edge of the picture (do not draw the wall), one glove flat against it and both boots braced on it, the lid on his back, his head turned to look back at us.',
      far: true,
    },
    cheer: { pose: 'cheering with the poker raised high over his head in one fist, his eyes wide open and looking ahead, a big open grin.' },
    cheer2: {
      pose: 'holding the dustbin lid up high in one hand like a trophy, the arm stretched out to the side so the lid is well clear of his head and sock cap, the poker in the other hand, his eyes wide open, grinning.',
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal across the picture, head on the left and boots on the right, arms and legs splayed limp, eyes shut, the poker and the lid dropped beside him. Seen from the side.',
      far: true,
    },
  },
};
