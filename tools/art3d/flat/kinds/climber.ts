import type { FlatKind } from '../kinds';

// Side on, a small girl leaning forward under a big messy mop of red hair that floats up and streams back off her
// head as if in a wind, with background round its ragged tips; the puffy banded parka to her hips (a sleeping bag
// with arms cut in), a lunchbox on a string on her back, slim legs and chunky boots. The hair is the read: short and
// loose, nobody else's (the archer's is a bushy mane with braids beside a bow, the raider's one braid, the genie's a
// ponytail from the crown); it streams straight back on the dash and floats up on the wall. Drawn three to a 16:9
// image with the design as the reference and cut apart (art/sprites/climber/design.prompt.txt).
const KEEP =
  'her big messy mop of red hair always floating up and streaming back behind her head as in the reference, with white background round its ragged tips, the puffy banded parka to her hips, the grey lunchbox on a string on her back';

export const kind: FlatKind = {
  body: 198,
  map: {
    roles: ['parka', 'band', 'skin', 'hair', 'box', 'legs', 'boot', 'white', 'dark'],
    families: [
      // The parka, its cel shade and its dark folds.
      ['parka', [66, 114, 171]],
      ['parka', [58, 98, 151]],
      ['parka', [50, 69, 107]],
      // The puffy bands and their shade.
      ['band', [184, 210, 234]],
      ['band', [138, 157, 177]],
      // Skin and its shade under the hair.
      ['skin', [237, 217, 203]],
      ['skin', [213, 148, 131]],
      // The hair and its shade; the strawberry magnet is drawn in it.
      ['hair', [174, 46, 34]],
      ['hair', [177, 47, 34]],
      ['hair', [181, 52, 41]],
      ['hair', [155, 54, 49]],
      ['hair', [135, 35, 31]],
      // The lunchbox and the tape on her sleeve, and their shade.
      ['box', [158, 141, 146]],
      ['box', [187, 182, 189]],
      ['box', [107, 118, 141]],
      // The leggings and their shade.
      ['legs', [59, 48, 63]],
      ['legs', [33, 26, 45]],
      ['boot', [114, 73, 63]],
      ['boot', [63, 44, 40]],
      // The stuffing out of the torn hem.
      ['white', [246, 246, 246]],
      // The ink.
      ['dark', [30, 9, 22]],
      ['dark', [53, 19, 27]],
    ],
    line: 'dark',
    thin: ['parka', 'band', 'skin', 'hair', 'box', 'legs', 'boot', 'white'],
    fringe: 5,
    stroke: 2.4,
    feet: ['boot'],
    min: { dark: 0.4 },
  },
  roles: [
    // The costume: the parka in the player's colour, its puffy bands a light of it.
    { name: 'parka', color: '#3f6fb5', slot: 'player' },
    { name: 'band', color: '#808080', on: 0, tone: 34 },
    { name: 'skin', color: '#f0d4c0' },
    // The red hair: a fixed tone the read needs (hair is a neutral).
    { name: 'hair', color: '#ae2e22' },
    // The lunchbox a tan tin, drawn grey: grey at play size read as a wing or nothing, tan as her pack (round 3's mock,
    // two readers at medium where the grey had one at low and one unsure). The tape on her sleeve is drawn in it.
    { name: 'box', color: '#966942' },
    { name: 'legs', color: '#3a3042' },
    // A colourway is the boots (VARIETY.palette): brown, a dark grey or an oxblood leather, neutrals all, none the
    // lunchbox's tan.
    { name: 'boot', color: '#72493f', alts: ['#55524f', '#6a3530'], vary: 6 },
    { name: 'white', color: '#f0eeea' },
    { name: 'dark', color: '#24141a' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: {
    role: 'dark',
    from: 'map',
    count: 1,
    pair: [-1, 0],
    area: [0.05, 2],
    gap: [0.8, 3.5],
    specks: { dark: 2.4, white: 1.5 },
    glint: 0.25,
    // The second walk's eye traces as line; its place, by hand.
    at: { 'walk-2': [0.865, 0.26] },
    band: [0.1, 0.42],
  },
  wear: {
    on: ['parka'],
    chin: 5,
    marks: [[['scuff', 0.6, 0.85, 0.22]], [['scorch', 0.4, 0.82, 0.22]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.2, 0.5], offset: [0, -0.5] }],
  // Her drawn eye is a small dark oval, no white: the kit's `dot`, side on, the far one a sliver.
  face: { r: 0.6, iris: '#24141a', eye: 'dot' },
  gait: { bounce: [0.3, 0.8], lean: [0, 0.05] },
  clips: {
    // She idles in the design's determined step, leaning into the climb.
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 26 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 38 },
    // The dash, the hair streamed straight back: her jump is a dash, up and down. A little smaller: stretched out,
    // she is wider than the box.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box', scale: 0.92 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    cheer: { frames: ['cheer'], loop: true, fps: 1, eyes: false },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.82 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/climber/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing still, catching her breath, looking up ahead at a peak, one mitten shading her eyes, her eyes open; ${KEEP}.` },
    'walk-1': { pose: `walking briskly to the right, leaning forward, mid-step, the near boot forward and the far boot back, her eyes open; ${KEEP}.` },
    'walk-2': {
      pose: `walking to the right, leaning forward, the legs passing under her, one boot planted and the other lifted behind, her eyes open; ${KEEP}.`,
    },
    'run-1': {
      pose: `running fast to the right, leaning far forward, the near knee raised high in front and the far leg pushing off far behind, her arms pumping, her eyes open; ${KEEP}.`,
    },
    'run-2': { pose: `running fast to the right, mid-stride, both boots off the ground, the legs split wide apart front and back, her eyes open; ${KEEP}.` },
    'air-1': {
      pose: `dashing through the air up and forward to the right, her whole body stretched out in a straight diagonal line, both arms reaching ahead, her legs trailing behind together, her red hair streaming straight back behind her head, her eyes open; ${KEEP}.`,
    },
    'air-2': { pose: `falling, both boots reaching down and apart, both arms flung up and out for balance, her eyes wide and her mouth open; ${KEEP}.` },
    wall: {
      pose: 'seen from her side, facing right: she clings to a tall wall on the right edge of her space (do not draw the wall), both mittens gripping it high and both boots braced flat on it, knees bent, her red hair floating up and back behind her head, her eyes open looking up.',
      far: true,
    },
    cheer: { pose: `cheering, hopping up on her toes, one fist pumped up high above her head, a big open grin, her eyes shut tight; ${KEEP}.` },
    cheer2: { pose: `standing proudly, holding a big red strawberry out level ahead of her in one mitten, a big smile, her eyes open; ${KEEP}.` },
    death: {
      pose: 'seen from the side: she has been knocked out and lies flat on her back on the floor, the whole body horizontal, her head on the left and her boots on the right, arms and legs splayed limp, her red hair spread out round her head, the lunchbox fallen open beside her, her eyes shut.',
      far: true,
    },
  },
};
