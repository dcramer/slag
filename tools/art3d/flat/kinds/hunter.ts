import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 206,
  map: {
    roles: ['buoy', 'stripe', 'orange', 'waist', 'pipe', 'visor', 'glint', 'dark'],
    families: [
      ['buoy', [180, 58, 51]],
      ['buoy', [179, 56, 50]],
      ['buoy', [181, 63, 48]],
      ['buoy', [139, 42, 41]],
      ['buoy', [111, 47, 45]],
      ['stripe', [244, 239, 227]],
      ['stripe', [244, 241, 227]],
      ['stripe', [241, 238, 225]],
      ['stripe', [191, 181, 176]],
      ['orange', [220, 102, 26]],
      ['orange', [220, 107, 36]],
      ['orange', [217, 98, 25]],
      ['orange', [187, 100, 53]],
      ['orange', [158, 65, 31]],
      ['orange', [160, 74, 34]],
      ['waist', [56, 51, 55]],
      ['waist', [48, 48, 54]],
      ['waist', [72, 72, 72]],
      ['pipe', [136, 140, 143]],
      ['pipe', [104, 104, 111]],
      ['pipe', [152, 162, 157]],
      ['pipe', [130, 136, 137]],
      ['pipe', [151, 141, 139]],
      ['visor', [40, 112, 56]],
      ['visor', [77, 105, 90]],
      ['glint', [112, 184, 128]],
      ['dark', [23, 11, 18]],
      ['dark', [38, 3, 6]],
      ['dark', [16, 3, 9]],
      ['dark', [45, 15, 18]],
    ],
    line: 'dark',
    thin: ['buoy', 'stripe', 'orange', 'waist', 'pipe', 'visor', 'glint'],
    fringe: 5,
    stroke: 2.4,
    feet: ['orange', 'pipe'],
    // No dark fill is worth a shape: the drawing's darks on the suit (the dents, the belt's ends at the hips)
    // were black specks at play size. A white scrap at the hip in idle2 was a pale ring there.
    min: { dark: 0.5, glint: 0.2, stripe: 1.2 },
  },
  roles: [
    // The fishing buoys: red with a white band, the shoulders nobody else in the cast is wider at.
    { name: 'buoy', color: '#c9473f' },
    { name: 'stripe', color: '#f4efe6' },
    // The suit: the water-heater torso, the helmet and the legs.
    { name: 'orange', color: '#d9661f', slot: 'player' },
    { name: 'waist', color: '#4a4a52' },
    // A colourway is the drainpipe and the boot made from its offcut (VARIETY.palette): grey, rusted iron or
    // bone-white PVC. The rust is a deep one: a light rust was the orange and yellow suits' own brown, and the
    // cannon and boots merged into them.
    { name: 'pipe', color: '#8e9298', alts: ['#6f3b2a', '#d6cdb6'], vary: 6 },
    { name: 'visor', color: '#2f7a3c' },
    { name: 'glint', color: '#9fe08a' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear on the suit: a scrape, and soot, one mark each on the thigh: two marks on the narrow legs read as
    // spots, and a scrape wide enough to show its fill inside its pen as a ring.
    { name: 'scuff', color: '#808080', on: 2, tone: -8 },
    { name: 'scorch', color: '#808080', on: 2, tone: -17 },
    { name: 'sticker', color: '#e8c24a' },
  ],
  slots: [
    { name: 'sticker', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // No face to draw: the visor hides it. The near buoy's white band is found as the anchor instead, so the
  // sticker lands on the buoy: anchored on the visor, it sat under the face and read as a mouth.
  eyes: { role: 'stripe', area: [1, 60], gap: [0, 0], specks: {}, count: 1, band: [0, 1] },
  wear: {
    on: ['orange'],
    chin: 0.5,
    marks: [[['scuff', 0.62, 0.78, 0.42]], [['scorch', 0.62, 0.78, 0.65]]],
  },
  accessories: [{ slot: 'sticker', role: 'sticker', at: 'cheek', size: [2.4, 0.95] }],
  gait: { bounce: [0, 0.4], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 32 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 46 },
    // The cannon out front on the way up and down, and on a long fall the ball tuck.
    air: { frames: ['air-1', 'air-2', 'ball'], loop: false, vy: [-250, 450], scale: 0.96 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // The cannon is held out level, clear of the body, in every standing, running and jumping pose: it and the
  // shoulders are the silhouette (the first drawings, with it across the chest or raised, read as a mushroom).
  poses: {
    idle2: {
      pose: 'standing square, feet planted wide, the free fist on its hip, the drainpipe cannon held out level in front (it is the arm itself: no hand under it), the helmet turned a little toward us.',
    },
    'walk-1': { pose: 'walking to the right with a heavy stride: the near boot forward, the far boot back, the drainpipe cannon held out level in front.' },
    'walk-2': {
      pose: 'walking to the right, the legs passing under the body: one boot planted, the other lifted a little, the drainpipe cannon held out level in front.',
    },
    'run-1': {
      pose: 'running to the right, leaning forward, one knee high and the other leg pushing off in a long heavy stride, the drainpipe cannon held out level in front.',
    },
    'run-2': {
      pose: 'running to the right, leaning forward, both boots off the ground with the legs gathered under the body, the drainpipe cannon held out level in front.',
    },
    'air-1': {
      pose: 'jumping up, both knees tucked up high under it, the drainpipe cannon held out level in front pointing a little upward (it is the arm itself: no hand under it).',
    },
    'air-2': {
      pose: 'falling, both legs reaching straight down and apart, the free arm flung up, the drainpipe cannon held out level in front (it is the arm itself: no hand under it).',
    },
    ball: {
      pose: 'curled up tight into a round armored ball in mid-air, spinning, the helmet tucked down between the two red-and-white buoys, the legs folded in, the drainpipe tucked against it, a near-round ball shape in orange and red.',
      far: true,
    },
    wall: {
      pose: 'seen from its side, it is sliding down a tall wall on the right edge of the picture (do not draw the wall), its back and both boots pressed flat against it, knees bent, the drainpipe cannon held out level away from the wall pointing to the left, its helmet turned to look along the cannon.',
      far: true,
    },
    cheer: { pose: 'cheering, the free fist punched high over its head, the drainpipe cannon held out level in front, up on its toes.' },
    cheer2: { pose: 'a victory stomp: one boot raised high off the ground, the drainpipe cannon held out level in front, the free fist pumping at its side.' },
    death: {
      pose: 'it has been knocked out and lies flat on its back on the floor, the whole body horizontal across the picture, helmet on the left and boots on the right, legs splayed limp, the drainpipe cannon still on its arm and lying flat along its side. Seen from the side.',
      far: true,
    },
  },
};
