import type { FlatKind } from '../kinds';

// Every pose keeps the scarf wound round its throat and the long head tilted down, its muzzle in front: the
// muzzle and the ears are the read, and a head thrown back or turned to us loses both.
const KEEP =
  'the red scarf still wound round its throat, the long head still tilted down with its muzzle pointing forward and down, the tail a smooth narrow sweep, both eyes open';

export const kind: FlatKind = {
  body: 184,
  map: {
    roles: ['coat', 'muzzle', 'mane', 'scarf', 'grey', 'mouth', 'dark'],
    // Sampled from the design (art/sprites/horse/design.png, `swatch.py`) and the open mouths.
    families: [
      ['coat', [240, 121, 22]],
      ['coat', [234, 125, 33]],
      // The coat's cel shadow down its back and under the head.
      ['coat', [189, 77, 29]],
      ['coat', [206, 95, 27]],
      ['coat', [174, 86, 41]],
      ['muzzle', [242, 219, 175]],
      ['muzzle', [248, 233, 202]],
      ['muzzle', [204, 178, 149]],
      // The mane, the tail and the hooves: one dark brown in the drawing, so one role.
      ['mane', [72, 50, 36]],
      ['mane', [81, 56, 41]],
      ['mane', [70, 47, 34]],
      ['mane', [72, 44, 32]],
      ['scarf', [194, 69, 49]],
      ['scarf', [132, 37, 22]],
      ['scarf', [122, 62, 42]],
      // The zip and the knee patch: steel and grey cloth.
      ['grey', [144, 144, 132]],
      ['grey', [188, 184, 176]],
      // The tongue of an open mouth (the fall, the cheer): red, it was the scarf's, in the player's colour.
      ['mouth', [215, 110, 105]],
      ['mouth', [190, 80, 80]],
      ['dark', [60, 17, 9]],
      ['dark', [44, 12, 6]],
      ['dark', [62, 10, 2]],
      ['dark', [60, 27, 18]],
      ['dark', [78, 34, 21]],
      // The eye whites, white in the drawing: the muzzle's pale, so the pupils are specks of their own in them.
      ['muzzle', [252, 250, 244]],
    ],
    line: 'dark',
    thin: ['coat', 'muzzle', 'mane', 'scarf', 'grey', 'mouth'],
    fringe: 5,
    stroke: 2.4,
    feet: ['mane'],
    // The scarf's knit ridges and the patch's stitches are slivers: under a part worth a shape, they fold away.
    min: { dark: 0.05, grey: 0.15, mouth: 0.2, scarf: 0.4 },
  },
  roles: [
    // The costume is the player's colour; the scarf a dark of it, far enough down that the two stay two shapes.
    { name: 'coat', color: '#c8743a', slot: 'player' },
    { name: 'muzzle', color: '#e6cfae' },
    // A colourway is the mane, tail and hooves together (VARIETY.palette): dark bay, black or chestnut. Neutrals only.
    { name: 'mane', color: '#4a3428', alts: ['#302c2c', '#74492f'], vary: 6 },
    { name: 'scarf', color: '#808080', on: 0, tone: -22 },
    { name: 'grey', color: '#9a9c98' },
    { name: 'mouth', color: '#9a3d36' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear on the costume, in tones of the player's colour: a faded patch, and soot.
    { name: 'scuff', color: '#808080', on: 0, tone: 12 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // The drawn eyes are big whites round a small pupil, the far one peeking over the brow hard against the
  // outline and often merged into it. So each drawing's near pupil is repainted as a solid disc (design.prompt.txt),
  // the biggest speck in the top fifth, found in the role map, and the far eye is set from it. The nostrils sit
  // lower (a third of the way down) and stay; the pupils and the shadow under the jaw, a frown at play size, go.
  eyes: { role: 'dark', from: 'map', area: [0.06, 0.6], gap: [1, 4], band: [0.06, 0.2], count: 1, pair: [1.5, -0.1], specks: { dark: 0.4 } },
  wear: {
    on: ['coat'],
    chin: 4,
    marks: [[['scuff', 0.5, 0.6, 0.7]], [['scorch', 0.5, 0.6, 0.7]]],
  },
  // On the bridge of the muzzle (the roster's plaster on the muzzle): the cast's cheek spot is under the eye, where
  // a pale strip reads as a lower lid.
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2, 0.8], offset: [2.6, 1.2] }],
  face: { r: 0.65, iris: '#2a1f1a' },
  gait: { bounce: [0.2, 0.9], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 44 },
    // Arms flung wide and a long head out in front: centred on itself, or the fall's reach leaves the box.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box' },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  poses: {
    idle2: { pose: `standing with its arms folded across its chest, one hoof tapping, a smug grin; ${KEEP}.` },
    'walk-1': {
      pose: `prancing to the right with a high step, mid-step: the near knee lifted high in front, its hoof dangling, the far leg straight behind, the arms swinging; ${KEEP}.`,
    },
    'walk-2': { pose: `prancing to the right, the legs passing under the body: one hoof planted, the other lifted a little, the arms swinging; ${KEEP}.` },
    'run-1': {
      pose: `galloping fast to the right on its two legs, leaning forward, one knee high and the other leg pushing off behind, both arms pumping, the mane and tail streaming back; ${KEEP}.`,
    },
    'run-2': {
      pose: `galloping fast to the right on its two legs, leaning forward, both hooves off the ground with the legs gathered under it, the mane and tail streaming back; ${KEEP}.`,
    },
    'air-1': { pose: `jumping up with both heels kicked up high behind it, both arms flung up, the mane flying; ${KEEP}.` },
    'air-2': { pose: `falling, both arms flung up, the legs reaching down, the mouth open in alarm; ${KEEP}.` },
    wall: {
      pose: `seen from its side, it is sliding down a tall wall on the right edge of the picture (do not draw the wall), one hoof flat against it and both feet braced on it, its head turned to look back at us; ${KEEP}.`,
      far: true,
    },
    cheer: { pose: `cheering, both hooves thrown high over its head, up on its toes, a huge buck-toothed grin; ${KEEP}.` },
    cheer2: { pose: `waving one hoof high above its head, the other hoof on its hip, a big grin; ${KEEP}.` },
    death: {
      pose: 'it has been knocked out and lies flat on its back on the floor, the whole body horizontal across the picture, the head on the left with its long muzzle pointing up, the hooves on the right, arms and legs splayed limp, the tongue out, eyes shut, the red scarf still round its throat. Seen from the side.',
      far: true,
    },
  },
};
