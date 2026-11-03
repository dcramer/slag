import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 246,
  map: {
    roles: ['buoy', 'stripe', 'orange', 'waist', 'pipe', 'visor', 'glint', 'lights', 'dark'],
    families: [
      ['buoy', [188, 64, 53]],
      ['buoy', [152, 45, 38]],
      ['buoy', [184, 63, 48]],
      ['buoy', [101, 32, 26]],
      ['stripe', [246, 239, 228]],
      ['stripe', [221, 221, 205]],
      ['stripe', [193, 170, 152]],
      ['stripe', [163, 138, 126]],
      ['orange', [208, 94, 23]],
      ['orange', [210, 98, 27]],
      ['orange', [205, 97, 28]],
      ['orange', [198, 81, 37]],
      ['orange', [171, 76, 25]],
      ['orange', [165, 65, 26]],
      ['orange', [165, 72, 32]],
      ['orange', [145, 56, 9]],
      ['waist', [58, 57, 60]],
      ['waist', [47, 52, 55]],
      ['pipe', [140, 142, 147]],
      ['pipe', [153, 147, 152]],
      ['pipe', [100, 107, 108]],
      ['pipe', [114, 124, 121]],
      ['pipe', [138, 155, 143]],
      ['pipe', [146, 137, 130]],
      ['pipe', [123, 106, 98]],
      ['pipe', [96, 71, 65]],
      ['visor', [41, 109, 54]],
      ['glint', [103, 175, 105]],
      ['lights', [130, 217, 105]],
      ['dark', [32, 5, 7]],
      ['dark', [44, 5, 6]],
      ['dark', [42, 18, 19]],
      ['dark', [56, 4, 3]],
    ],
    line: 'dark',
    thin: ['buoy', 'stripe', 'orange', 'waist', 'pipe', 'visor', 'glint', 'lights'],
    fringe: 5,
    stroke: 2.4,
    feet: ['orange', 'pipe'],
    min: { dark: 0.12, lights: 0.1, glint: 0.2 },
  },
  roles: [
    // The fishing buoys: red with a white band, the shoulders nobody else in the cast is wider at.
    { name: 'buoy', color: '#c9473f' },
    { name: 'stripe', color: '#f4efe6' },
    // The suit: the water-heater torso, the helmet and the legs.
    { name: 'orange', color: '#d9661f', slot: 'player' },
    { name: 'waist', color: '#4a4a52' },
    // A colourway is the drainpipe and the boot made from its offcut (VARIETY.palette): grey, rusted iron or bone-white PVC.
    { name: 'pipe', color: '#8e9298', alts: ['#9a5f3e', '#d6cdb6'], vary: 6 },
    { name: 'visor', color: '#2f7a3c' },
    { name: 'glint', color: '#9fe08a' },
    { name: 'lights', color: '#7fd06a' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear on the suit: a rubbed patch, and soot.
    { name: 'scuff', color: '#808080', on: 2, tone: 14 },
    { name: 'scorch', color: '#808080', on: 2, tone: -17 },
    { name: 'sticker', color: '#e8c24a' },
  ],
  slots: [
    { name: 'sticker', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // No face to draw: the visor hides it. A chest light is found as the anchor instead, so the hazard sticker
  // lands on the water-heater tank under it: anchored on the visor it sat under the face and read as a mouth.
  eyes: { role: 'lights', area: [0.02, 3], gap: [0, 0], specks: {}, count: 1, band: [0, 1] },
  wear: {
    on: ['orange'],
    chin: 0.8,
    marks: [
      [
        ['scuff', 0.45, 0.5, 0.65],
        ['scuff', 0.65, 0.85, 0.6],
      ],
      [
        ['scorch', 0.5, 0.42, 0.75],
        ['scorch', 0.62, 0.55, 0.55],
      ],
    ],
  },
  accessories: [{ slot: 'sticker', role: 'sticker', at: 'cheek', size: [2.4, 0.95] }],
  gait: { bounce: [0, 0.4], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 32 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 46 },
    // The cannon up on the way up, a fall, and on a long fall the ball tuck.
    air: { frames: ['air-1', 'air-2', 'ball'], loop: false, vy: [-250, 450], scale: 0.95 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  poses: {
    idle2: {
      pose: 'standing at ease, the drainpipe cannon lowered and pointing down at the ground in front of it, the other hand on its hip, the helmet tilted.',
    },
    'walk-1': { pose: 'walking to the right with a heavy stride: the near boot forward, the far boot back, the drainpipe cannon held out in front.' },
    'walk-2': {
      pose: 'walking to the right, the legs passing under the body: one boot planted, the other lifted a little, the drainpipe cannon held out in front.',
    },
    'run-1': {
      pose: 'running to the right, leaning forward, one knee high and the other leg pushing off in a long heavy stride, the drainpipe cannon held out in front.',
    },
    'run-2': {
      pose: 'running to the right, leaning forward, both boots off the ground with the legs gathered under the body, the drainpipe cannon held out in front.',
    },
    'air-1': { pose: 'jumping straight up, the drainpipe cannon raised and pointing up high over its head, the legs tucked under it.' },
    'air-2': { pose: 'falling, the drainpipe cannon and the other arm flung up, the legs reaching down.' },
    ball: {
      pose: 'curled up tight into a round armored ball in mid-air, spinning, the helmet tucked down between the two red-and-white buoys, the legs folded in, the drainpipe tucked against it, a near-round ball shape in orange and red.',
      far: true,
    },
    wall: {
      pose: 'seen from its side, it is sliding down a tall wall on the right edge of the picture (do not draw the wall), its free hand flat against it and both boots braced on it, the drainpipe cannon held pointing up, its helmet turned to look back at us.',
      far: true,
    },
    cheer: { pose: 'cheering, the drainpipe cannon thrust high over its head, the other fist pumping, up on its toes.' },
    cheer2: { pose: 'a proud pose: the drainpipe cannon propped on its shoulder pointing up behind it, the other fist on its hip, chest out.' },
    death: {
      pose: 'it has been knocked out and lies flat on its back on the floor, the whole body horizontal across the picture, helmet on the left and boots on the right, arms and legs splayed limp, the drainpipe cannon lying beside it. Seen from the side.',
      far: true,
    },
  },
};
