import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 223,
  map: {
    roles: ['skin', 'red', 'redshade', 'blue', 'brown', 'tan', 'grey', 'dark', 'mouth'],
    families: [
      ['skin', [253, 195, 153]],
      ['skin', [250, 217, 192]],
      ['skin', [216, 170, 124]],
      ['red', [187, 70, 58]],
      ['redshade', [134, 42, 40]],
      ['redshade', [107, 31, 31]],
      ['redshade', [75, 32, 28]],
      // The cup's highlights, nearer the copper than the cap: they folded into the handle's tan.
      ['redshade', [182, 88, 78]],
      ['blue', [67, 95, 164]],
      ['blue', [54, 68, 108]],
      ['brown', [66, 45, 31]],
      ['brown', [49, 34, 34]],
      ['brown', [70, 47, 33]],
      ['tan', [208, 141, 97]],
      ['tan', [161, 117, 89]],
      ['tan', [139, 85, 64]],
      // The copper handle and its shadow: nearer the cap's red than the gloves' tan, so the handle drew in
      // the player's colour wherever it crossed the overalls.
      ['tan', [186, 106, 62]],
      ['tan', [147, 66, 42]],
      ['grey', [150, 155, 160]],
      ['grey', [110, 115, 120]],
      ['dark', [10, 4, 4]],
      // The tongue of an open mouth (the cheers, the fall): red, it was drawn in the player's colour.
      ['mouth', [192, 84, 82]],
      ['mouth', [208, 92, 96]],
      // The eyes' glints, inside the eyes.
      ['dark', [255, 255, 255]],
    ],
    line: 'dark',
    thin: ['skin', 'red', 'redshade', 'blue', 'brown', 'tan', 'grey', 'mouth'],
    fringe: 5,
    stroke: 2.4,
    feet: ['brown'],
    min: { dark: 0.12, grey: 0.25 },
  },
  roles: [
    { name: 'skin', color: '#efc9a4' },
    { name: 'red', color: '#c9473f', slot: 'player' },
    // The drawing's own shadow on the cap and shirt, and the plunger's cup: a dark of the player's colour.
    { name: 'redshade', color: '#808080', on: 1, tone: -22 },
    // A colourway is the overalls (VARIETY.palette): denim, grey work cloth, washed denim. A navy went: on a
    // dark ground it and the boots sank into the ground.
    { name: 'blue', color: '#3f62b4', alts: ['#7e848a', '#86a3d4'], vary: 6 },
    { name: 'brown', color: '#4d3426' },
    { name: 'tan', color: '#b08454' },
    { name: 'grey', color: '#8e8a84' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'mouth', color: '#9a3d36' },
    // Wear on the overalls: a faded streak, and soot. Quiet tones: louder, a mark on the flat bib read as a spot.
    { name: 'scuff', color: '#808080', on: 3, tone: 10 },
    { name: 'scorch', color: '#808080', on: 3, tone: -16 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', area: [0.2, 2.6], gap: [1.4, 4.5], specks: { dark: 2.8 } },
  // The knee patch, in the overalls' own cloth: in the shirt's red it took the player's colour, a fleck on
  // the leg at every step. The lowest red by far (the sleeves end 7.3 under the eyes), and the rightmost lying.
  recolour: { from: 'red', to: 'blue', below: 8.2, lying: [1.2, 2] },
  wear: {
    on: ['blue'],
    chin: 3,
    marks: [
      [
        ['scuff', 0.5, 0.35, 0.75],
        ['scuff', 0.3, 0.85, 0.6],
      ],
      [
        ['scorch', 0.55, 0.4, 0.8],
        ['scorch', 0.3, 0.82, 0.6],
      ],
    ],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2.2, 0.9] }],
  face: { r: 0.9, iris: '#3c6fd0' },
  gait: { bounce: [0.15, 0.85], lean: [0, 0.035] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 44 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200] },
    wall: { frames: ['wall'], loop: true, fps: 1 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    // Shut, laughing eyes: none for the kit.
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3], eyes: false },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  poses: {
    idle2: { pose: 'standing with his arms folded across his chest, chest puffed out, the plunger leaning against his shoulder.' },
    'walk-1': { pose: 'walking to the right, mid-step: the near boot forward, the far boot back, the plunger over his shoulder.' },
    'walk-2': { pose: 'walking to the right, the legs passing under the body: one boot planted, the other lifted a little, the plunger over his shoulder.' },
    'run-1': {
      pose: 'running fast to the right, leaning forward, one knee high and the other leg pushing off, the free arm pumping, the plunger over his shoulder.',
    },
    'run-2': {
      pose: 'running fast to the right, leaning forward, both boots off the ground with the legs gathered under him, the plunger over his shoulder.',
    },
    'air-1': { pose: 'jumping straight up, one fist punched high over his head, the other hand gripping the plunger, the legs tucked under him.' },
    'air-2': { pose: 'falling, both arms flung up, the plunger still in one hand, the legs reaching down, the mouth open in alarm.' },
    wall: {
      pose: 'seen from his side, he is sliding down a tall wall on the right edge of the picture (do not draw the wall), one glove flat against it and both boots braced on it, the plunger on his back, his head turned to look back at us.',
      far: true,
    },
    cheer: { pose: 'cheering, both fists thrown high over his head, the plunger held up in one of them, up on his toes, a big grin under the mustache.' },
    cheer2: { pose: 'leaning back laughing, turned a little toward us, one hand on his belly, the plunger over his shoulder.' },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal across the picture, head on the left and boots on the right, arms and legs splayed limp, eyes shut, the plunger dropped beside him. Seen from the side.',
      far: true,
    },
  },
};
