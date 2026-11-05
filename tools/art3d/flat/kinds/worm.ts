import type { FlatKind } from '../kinds';

// Every pose keeps the three things that carry him (the redraw, art/sprites/worm/design.prompt.txt): the thin
// pink worm neck rising out of the collar and arcing forward once at the top, with a head wider than it and huge
// eyes standing up out of it (a pole the head's own width read as a thumb, an S as a dragon's snout); the hero's
// build, round shoulder pads, a narrow belted waist, slim legs in big boots (a stuffed boiler suit was a sack); and
// the small hair dryer held out in one hand like a raygun, clear of the body (across the belly, it was never seen).
const KIT =
  "his thin pink worm neck always rising out of the collar and arcing forward at the top, his head with its two huge bulging eyes on its end, and the small grey hair dryer always held out like a raygun at arm's length in his front gloved hand, angled down a little, clear of his body with white background round it";

export const kind: FlatKind = {
  body: 132,
  map: {
    roles: ['suit', 'glove', 'patch', 'grey', 'pink', 'eye', 'dark'],
    // Sampled from the design (art/sprites/worm/design.prompt.txt).
    families: [
      // The suit and its cel shadow, pads and chest alike.
      ['suit', [88, 138, 175]],
      ['suit', [84, 132, 174]],
      ['suit', [90, 138, 174]],
      ['suit', [100, 139, 172]],
      ['suit', [85, 132, 169]],
      ['suit', [47, 92, 133]],
      ['suit', [55, 93, 127]],
      // The gloves, boots and belt, and their shadow.
      ['glove', [62, 91, 114]],
      ['glove', [64, 88, 112]],
      ['glove', [60, 84, 108]],
      ['glove', [43, 61, 83]],
      ['glove', [39, 48, 70]],
      ['glove', [36, 54, 78]],
      ['glove', [81, 95, 115]],
      ['glove', [65, 66, 84]],
      // The small paler patch on the shin, and the pads' shine (too close to it to tell apart).
      ['patch', [150, 186, 204]],
      ['patch', [168, 187, 203]],
      // The hair dryer, lit and shaded.
      ['grey', [144, 138, 132]],
      ['grey', [150, 144, 138]],
      ['grey', [134, 123, 137]],
      ['grey', [110, 104, 100]],
      // The worm, and the ring lines down him.
      ['pink', [244, 157, 161]],
      ['pink', [240, 150, 156]],
      ['pink', [172, 149, 157]],
      ['pink', [200, 110, 120]],
      // The eyes' whites and the teeth, repainted by art/sprites/worm/prep.py so they aren't holes: the eyes are
      // found by their whites, and the kit draws its own.
      ['eye', [220, 222, 240]],
      ['eye', [230, 202, 214]],
      // The ink.
      ['dark', [32, 13, 33]],
      ['dark', [20, 11, 31]],
      ['dark', [32, 21, 41]],
      ['dark', [19, 2, 16]],
    ],
    line: 'dark',
    thin: ['suit', 'glove', 'patch', 'grey', 'pink', 'eye'],
    fringe: 5,
    stroke: 2.4,
    // The background the figure closes in (between an arm and the body, round the cord's stub) cut through.
    holes: 1,
    feet: ['glove'],
    // The dryer is carried, so the body's size is the worm in his suit, alike in every pose.
    loose: ['grey'],
    // The boots' and gloves' shine is the suit's own colour and their shade the suit's shadow, so they fall to the
    // suit in scraps (and the dryer's in grey), and the ink thickens into specks
    // where lines meet: below these they're dropped, or the suit reads mottled at play size.
    min: { dark: 0.4, patch: 0.6, suit: 1.2, glove: 1, grey: 0.6 },
  },
  roles: [
    // The costume: the suit, its shoulder pads and the collar, in the player's colour.
    { name: 'suit', color: '#5f8fb5', slot: 'player' },
    // The gloves, boots and belt, a dark of the suit; the shin patch a light one.
    { name: 'glove', color: '#808080', on: 0, tone: -22 },
    { name: 'patch', color: '#808080', on: 0, tone: 16 },
    // A colourway is the dryer (VARIETY.palette), neutrals all: grey, cream plastic, charcoal.
    { name: 'grey', color: '#9a9aa0', alts: ['#d6ccb4', '#6e6a66'], vary: 6 },
    // The worm: a face, so neutral.
    { name: 'pink', color: '#f19aa6' },
    { name: 'eye', color: '#fbfaf6' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // Found by their whites (repainted by art/sprites/worm/prep.py), one: the drawn eyes touch and trace as one patch
  // in most poses, so the far eye is set from the near one. The whites and the teeth stay: they are the huge
  // bulging eyes and the wide grin, and the kit's pupils sit on them.
  eyes: { role: 'eye', area: [0.15, 9], gap: [0.6, 3], band: [0, 0.3], specks: { eye: 1, dark: 2 }, count: 1, pair: [1.8, -0.1] },
  wear: {
    on: ['suit'],
    chin: 6,
    marks: [[['scuff', 0.4, 0.7, 0.5]], [['scorch', 0.5, 0.75, 0.35]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.4, 0.6] }],
  face: { r: 0.7, iris: '#2a1f1a' },
  gait: { bounce: [0.2, 0.8], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.88 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.9 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    // The laugh's eyes are shut and drawn as lids, so it finds no whites and draws no face.
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.7 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/worm/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing, his empty fist on his hip, leaning back pleased with himself, the head cocked, his eyes wide open, ${KIT}.` },
    'walk-1': { pose: `walking to the right with a heavy stride, mid-step, the near boot forward and the far boot back, ${KIT}.` },
    'walk-2': { pose: `walking to the right, the legs passing under the body, one boot planted flat and the other lifted a little behind it, ${KIT}.` },
    'run-1': { pose: `running hard to the right, leaning forward, the near knee raised high in front and the far leg pushing off far behind, ${KIT}.` },
    'run-2': { pose: `running to the right, mid-stride, both big boots off the ground, the legs split wide apart front and back, ${KIT}.` },
    'air-1': { pose: `jumping up, both knees tucked up under him, his empty fist punched up, his eyes open, ${KIT}.` },
    'air-2': {
      pose: `falling, both big boots reaching straight down and apart, the empty arm flung up, the hair dryer held out and down, his eyes wide and his mouth open, ${KIT}.`,
    },
    wall: {
      pose: "seen from his side, he is sliding down a tall wall that is just to his right (do not draw the wall), his empty glove and both big boots braced flat against it, knees bent, the hair dryer held out at arm's length away from the wall to the left like a raygun, his thin pink worm neck rising out of the collar, his head with its huge bulging eyes turned to look back at us, eyes open.",
      far: true,
    },
    cheer: {
      pose: `cheering, up on his toes, his empty fist punched high in the air, the hair dryer held out in front, a big open grin, his eyes open, ${KIT}.`,
    },
    cheer2: { pose: `laughing, the neck arcing back and the head tipped back, his eyes shut, a big grin, the hair dryer held out in front, ${KIT}.` },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, the suit on the left and boots on the right, his thin pink worm neck lying limp along the floor to the left with the head at its end, eyes shut, the hair dryer dropped flat on the floor beside him.',
      far: true,
    },
  },
};
