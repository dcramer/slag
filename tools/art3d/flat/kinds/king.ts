import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 297,
  map: {
    roles: ['shell', 'bone', 'skin', 'belly', 'mane', 'cuff', 'plate', 'crown', 'mouth', 'dark'],
    // Sampled from the design (the worn edit, then the huge spikes, then the clean silhouette) and its poses.
    families: [
      ['shell', [65, 137, 61]],
      ['shell', [70, 131, 61]],
      ['shell', [46, 78, 51]],
      ['shell', [68, 91, 65]],
      ['shell', [32, 90, 56]],
      ['shell', [26, 41, 26]],
      // The rim, the spikes and the horns, and their shade.
      ['bone', [244, 235, 194]],
      ['bone', [242, 228, 178]],
      ['bone', [240, 224, 176]],
      ['bone', [196, 179, 142]],
      ['bone', [189, 162, 130]],
      ['bone', [174, 144, 111]],
      ['bone', [200, 168, 120]],
      ['bone', [240, 216, 88]],
      ['skin', [247, 176, 3]],
      ['skin', [211, 122, 1]],
      ['skin', [231, 172, 46]],
      // The soles' shade: nearer the mane's red, the soles went red at every step.
      ['skin', [164, 94, 8]],
      ['belly', [229, 206, 140]],
      ['belly', [224, 200, 136]],
      ['belly', [197, 143, 76]],
      ['belly', [154, 115, 63]],
      ['mane', [208, 72, 16]],
      ['mane', [196, 79, 25]],
      ['mane', [160, 36, 16]],
      ['mane', [113, 41, 20]],
      ['cuff', [116, 108, 92]],
      ['cuff', [80, 72, 64]],
      ['plate', [152, 152, 160]],
      ['plate', [150, 150, 152]],
      ['plate', [133, 144, 137]],
      ['crown', [166, 201, 227]],
      ['crown', [160, 184, 200]],
      ['crown', [112, 152, 184]],
      ['mouth', [208, 78, 70]],
      ['mouth', [120, 30, 40]],
      ['dark', [15, 9, 9]],
      ['dark', [27, 10, 7]],
      // The eyes' glints, inside the eyes.
      ['dark', [255, 255, 255]],
    ],
    line: 'dark',
    thin: ['shell', 'bone', 'skin', 'belly', 'mane', 'cuff', 'plate', 'crown', 'mouth'],
    fringe: 5,
    stroke: 2.4,
    feet: ['skin'],
    min: { dark: 0.12, plate: 0.3, cuff: 0.25, mouth: 0.2 },
  },
  roles: [
    // The shell, a dark of the player's colour: his scales are the costume (Decisions 4, the neutral palette), the
    // largest region on him; a fixed gold there made every king the same king.
    { name: 'shell', color: '#808080', on: 2, tone: -22 },
    { name: 'bone', color: '#efe2c0' },
    { name: 'skin', color: '#e8b23c', slot: 'player' },
    { name: 'belly', color: '#e9d29a' },
    { name: 'mane', color: '#808080', on: 2, tone: -36 },
    // A colourway is the cuffs (VARIETY.palette): worn leather, black iron, steel.
    { name: 'cuff', color: '#7a5f44', alts: ['#34343a', '#8e8a84'], vary: 6 },
    { name: 'plate', color: '#9aa0a8' },
    // The paper crown: a light tone of the player's colour.
    { name: 'crown', color: '#808080', on: 2, tone: 26 },
    { name: 'mouth', color: '#9a3d36' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'scuff', color: '#808080', on: 0, tone: 12 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', from: 'map', area: [0.03, 2.6], band: [0, 0.55], gap: [0.8, 4.5], specks: { dark: 2.8 } },
  wear: {
    on: ['shell'],
    chin: 1.5,
    // Low on the shell, clear of the patch plate and the spikes: its top is level with his eyes, above the chin.
    marks: [
      [
        ['scuff', 0.32, 0.72, 0.45],
        ['scuff', 0.2, 0.66, 0.4],
      ],
      [
        ['scorch', 0.32, 0.72, 0.45],
        ['scorch', 0.15, 0.65, 0.4],
      ],
    ],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2, 0.8] }],
  face: { r: 0.8, iris: '#c9473f' },
  gait: { bounce: [0.1, 0.5], lean: [0, 0.025] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 42 },
    // Up on the jump, alarmed on the fall, and tucked into the shell near the fall's top speed (450).
    air: { frames: ['air-1', 'air-2', 'air-2', 'tuck'], loop: false, vy: [-200, 600], scale: 0.93 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.92 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Drawn three to an image (16:9, the design as the reference) and cut apart, every sheet's prompt also holding the
  // huge spikes, long horns, small crown and both eyes open in every figure: art/sprites/king/poses.prompt.txt.
  poses: {
    'walk-1': {
      pose: 'stomping heavily to the right, mid-step: the near clawed foot forward, the far foot back, his big shoulders rolled forward, fists low.',
    },
    'walk-2': {
      pose: 'stomping to the right, the legs passing under the body: one foot planted flat, the other lifted a little, the shoulders rolling the other way.',
    },
    idle2: {
      pose: 'standing with his thick arms folded across his chest, smug, his feet planted apart, his head level, both of his eyes wide open, round, level and clearly visible.',
    },
    'run-1': {
      pose: 'running hard to the right, leaning forward, one knee high and the other leg pushing off, the near fist pumping, the shell bouncing on his back.',
    },
    'run-2': { pose: 'running hard to the right, leaning forward, both feet off the ground with the legs gathered under him, the arms swinging.' },
    'air-1': {
      pose: 'jumping up, his knees tucked up under him and his fists clenched in front of his chest, the shell with its huge long spikes on his back and showing behind him, his head level and looking ahead to the right, both of his eyes open, level and visible, roaring.',
    },
    'air-2': { pose: 'falling, both arms flung up beside his head, the legs reaching down, the mouth open in alarm.' },
    cheer: {
      pose: 'cheering, both fists thrown up beside his horns, a big toothy grin, up on his toes, his head level, both of his eyes wide open, round, level and clearly visible.',
    },
    cheer2: { pose: 'laughing, one hand on his belly, his mouth wide open, his head level, both of his eyes wide open, round, level and clearly visible.' },
    wall: {
      pose: 'seen from his side, he is sliding down a tall wall on the right edge of the figure (do not draw the wall), one hand flat against it and both feet braced on it, the spiked shell on his back away from the wall, his whole head turned round over his shoulder to face us, both of his eyes wide open and clearly visible, the paper crown on his head.',
      far: true,
    },
    tuck: {
      pose: 'tucked into his spiked shell in mid-air like a turtle hiding: his arms and legs pulled all the way in, only his head with its horns, mane, crown and eyes peeking out of the front of the shell, the round spiked shell filling the figure, seen from the side.',
      far: true,
    },
    death: {
      pose: 'knocked out, flipped over on his back like an upturned turtle, lying on his round shell on the floor, his body horizontal with his head on the left and his feet on the right, arms and legs limp in the air, eyes shut, the paper crown still on his head, seen from the side.',
      far: true,
    },
  },
};
