import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 177,
  map: {
    roles: ['skin', 'shirt', 'khaki', 'brown', 'tan', 'grey', 'yellow', 'strap', 'lens', 'white', 'dark'],
    families: [
      ['skin', [251, 167, 118]],
      ['skin', [199, 104, 76]],
      ['skin', [184, 111, 68]],
      ['shirt', [157, 45, 34]],
      ['shirt', [100, 36, 30]],
      ['shirt', [155, 71, 51]],
      ['shirt', [128, 31, 25]],
      ['shirt', [86, 37, 29]],
      ['khaki', [134, 98, 69]],
      ['khaki', [128, 89, 63]],
      ['khaki', [97, 75, 63]],
      ['brown', [89, 60, 45]],
      ['tan', [175, 124, 52]],
      ['tan', [188, 132, 55]],
      ['yellow', [188, 128, 28]],
      ['grey', [157, 157, 150]],
      ['grey', [122, 109, 97]],
      ['grey', [139, 136, 130]],
      ['grey', [220, 203, 174]],
      ['yellow', [234, 172, 32]],
      ['yellow', [235, 177, 79]],
      ['yellow', [241, 180, 55]],
      ['strap', [70, 78, 80]],
      ['lens', [130, 159, 165]],
      // The lenses' glints and the teeth of a grin: as dark, a glint reads as a pupil in the goggles; as lens, the teeth go blue.
      ['white', [255, 255, 255]],
      ['dark', [36, 7, 6]],
      ['dark', [44, 26, 24]],
      ['dark', [20, 4, 4]],
    ],
    line: 'dark',
    thin: ['skin', 'shirt', 'khaki', 'brown', 'tan', 'grey', 'yellow', 'strap', 'lens', 'white'],
    fringe: 5,
    stroke: 2.4,
    ink: 5,
    feet: ['khaki'],
    min: { dark: 0.03, grey: 0.25, lens: 0.2, white: 1.0 },
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
  eyes: { role: 'dark', area: [0.015, 2.6], gap: [1.0, 4.5], specks: { dark: 2.8 } },
  wear: {
    on: ['shirt', 'khaki'],
    chin: 3,
    marks: [
      [
        ['scuff', 0.55, 0.3, 1.0],
        ['scuff2', 0.42, 0.8, 0.45],
      ],
      [
        ['scorch', 0.5, 0.3, 1.1],
        ['scorch2', 0.58, 0.8, 0.45],
      ],
    ],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.5, 0.7] }],
  face: { r: 0.62, iris: '#3c6fd0' },
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
  // Every pose keeps the spanner as the design holds it, its open jaw up beside his shoulder and clear of the
  // hat, and nothing raised over the hat: a fist or the spanner held up read as spikes off it (blind read).
  poses: {
    idle2: {
      pose: 'standing with his chest puffed out and the bare hand on his hip, the huge one-jawed spanner held as in the reference, gripped by its end in the gloved hand at his hip and slanting up past his shoulder, its big open jaw up beside his shoulder and clear of his hat, nothing of it below his hip, looking pleased with himself. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
    },
    'walk-1': {
      pose: 'trudging to the right with a heavy step, mid-step: the near boot forward, the far boot back, the huge one-jawed spanner held as in the reference, gripped by its end in the gloved hand at his hip and slanting up past his shoulder, its big open jaw up beside his shoulder and clear of his hat, nothing of it below his hip. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
    },
    'walk-2': {
      pose: 'trudging to the right, the legs passing under the body: one boot planted flat, the other lifted a little, the huge one-jawed spanner held as in the reference, gripped by its end in the gloved hand at his hip and slanting up past his shoulder, its big open jaw up beside his shoulder and clear of his hat, nothing of it below his hip. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
    },
    'run-1': {
      pose: 'running hard to the right, leaning forward, one knee high and the other leg pushing off, the bare fist pumping low, the huge one-jawed spanner held as in the reference, gripped by its end in the gloved hand at his hip and slanting up past his shoulder, its big open jaw up beside his shoulder and clear of his hat, nothing of it below his hip. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
    },
    'run-2': {
      pose: 'running hard to the right, leaning forward, both boots off the ground with the legs gathered under him, the bare fist pumping low, the huge one-jawed spanner held as in the reference, gripped by its end in the gloved hand at his hip and slanting up past his shoulder, its big open jaw up beside his shoulder and clear of his hat, nothing of it below his hip. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
    },
    'air-1': {
      pose: 'jumping up, the knees tucked up under him, the bare fist clenched at his chest, the huge one-jawed spanner held as in the reference, gripped by its end in the gloved hand at his hip and slanting up past his shoulder, its big open jaw up beside his shoulder and clear of his hat, nothing of it below his hip; nothing raised above his hat. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
    },
    'air-2': {
      pose: 'falling, the legs reaching down, the bare arm flung out to the side, the mouth open in alarm, the huge one-jawed spanner held as in the reference, gripped by its end in the gloved hand at his hip and slanting up past his shoulder, its big open jaw up beside his shoulder and clear of his hat, nothing of it below his hip; nothing raised above his hat. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
    },
    wall: {
      pose: 'seen from his side, he is sliding down a tall wall on the right edge of the picture (do not draw the wall), the bare hand flat against it and both boots braced on it, the huge one-jawed spanner gripped by its end in the gloved hand and slanting up behind him, its big open jaw clear of his hat, his head turned to look back at us. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
      far: true,
    },
    cheer: {
      pose: 'cheering, the bare fist punched up beside his hat, a big grin, up on his toes, the huge one-jawed spanner held as in the reference, gripped by its end in the gloved hand at his hip and slanting up past his shoulder, its big open jaw up beside his shoulder and clear of his hat, nothing of it below his hip. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
    },
    cheer2: {
      pose: 'leaning back laughing, turned a little toward us, the bare hand on his belly, the huge one-jawed spanner held as in the reference, gripped by its end in the gloved hand at his hip and slanting up past his shoulder, its big open jaw up beside his shoulder and clear of his hat, nothing of it below his hip. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal across the picture, head on the left and boots on the right, arms and legs splayed limp, eyes shut, the round hard hat still on his head, the one huge one-jawed spanner dropped beside him. One figure only, seen from the side. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
      far: true,
    },
  },
};
