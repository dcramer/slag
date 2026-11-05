import type { FlatKind } from '../kinds';

// Every pose keeps the two things that carry him: the thick bare pink worm rising dead straight up out of the collar
// like a pole, clear of the pillow shoulders, its blunt head on top (the read: nobody else is a head on a stalk;
// curled, it read as a snout, and thin, as nothing), and the hair dryer held at his hip, its barrel forward and
// down. Held level from the shoulder it would be the hunter's and the robot boy's outline; tilted up in front of
// the chest it made a capped, stocky man.
const KIT =
  'his thick pink worm neck always rising straight up out of the collar like a pole, as tall as the suit, never arching, his blunt round worm head on top pointing forward, and the big grey hair dryer always held at his hip, its barrel pointing forward and down, never raised';

export const kind: FlatKind = {
  body: 220,
  map: {
    roles: ['suit', 'glove', 'patch', 'grey', 'pink', 'eye', 'dark'],
    // Sampled from the design (art/sprites/worm/design.prompt.txt).
    families: [
      // The suit and its cel shadow; the pillow shoulders are the suit's own cloth.
      ['suit', [107, 130, 146]],
      ['suit', [109, 132, 147]],
      ['suit', [109, 122, 136]],
      ['suit', [106, 121, 135]],
      ['suit', [85, 97, 111]],
      ['suit', [64, 76, 97]],
      ['suit', [67, 78, 98]],
      ['suit', [74, 83, 102]],
      ['suit', [111, 128, 143]],
      ['suit', [115, 134, 148]],
      ['suit', [87, 97, 111]],
      ['suit', [77, 88, 105]],
      ['suit', [72, 81, 100]],
      // The gloves and the boots, and their shadow.
      ['glove', [65, 87, 105]],
      ['glove', [67, 90, 108]],
      ['glove', [42, 52, 67]],
      ['glove', [56, 61, 77]],
      ['glove', [69, 89, 105]],
      ['glove', [49, 59, 73]],
      ['glove', [61, 75, 91]],
      // The paler patches on the knee and the shoulder.
      ['patch', [145, 177, 202]],
      ['patch', [160, 182, 201]],
      ['patch', [168, 183, 196]],
      ['patch', [137, 160, 185]],
      // The hair dryer, lit and shaded.
      ['grey', [153, 148, 153]],
      ['grey', [159, 153, 158]],
      ['grey', [137, 143, 151]],
      ['grey', [104, 119, 131]],
      ['grey', [188, 192, 194]],
      ['grey', [204, 200, 203]],
      ['grey', [112, 112, 120]],
      ['grey', [105, 108, 118]],
      ['grey', [143, 145, 150]],
      ['grey', [199, 201, 210]],
      ['grey', [147, 145, 149]],
      ['grey', [99, 100, 111]],
      ['grey', [133, 140, 148]],
      ['grey', [174, 176, 176]],
      ['grey', [142, 140, 143]],
      ['grey', [102, 101, 109]],
      // The worm, and the ring lines down him.
      ['pink', [251, 165, 172]],
      ['pink', [248, 166, 172]],
      ['pink', [212, 176, 185]],
      ['pink', [161, 116, 128]],
      ['pink', [200, 108, 120]],
      ['pink', [250, 215, 220]],
      ['pink', [249, 164, 171]],
      ['pink', [144, 121, 133]],
      ['pink', [177, 159, 166]],
      ['pink', [152, 121, 133]],
      // The eyes' whites and the teeth, repainted by art/sprites/worm/prep.py so they aren't holes: the eyes are
      // found by their whites, and the kit draws its own.
      ['eye', [220, 222, 240]],
      ['eye', [216, 216, 234]],
      ['eye', [182, 177, 198]],
      // The ink.
      ['dark', [21, 12, 32]],
      ['dark', [11, 6, 21]],
      ['dark', [29, 20, 41]],
      ['dark', [36, 34, 52]],
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
    // The costume: the suit, its pillow shoulders and the collar, in the player's colour.
    { name: 'suit', color: '#5f8fb5', slot: 'player' },
    // The gloves and boots, a dark of the suit; the knee patch a light one.
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
  // in most poses, so the far eye is set from the near one, and the whole white is painted over.
  eyes: { role: 'eye', area: [0.15, 9], gap: [0.6, 3], band: [0, 0.3], specks: { eye: 9, dark: 2 }, count: 1, pair: [1.8, -0.1] },
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
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40, scale: 0.95 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.76 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.86 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    // The laugh's eyes are shut and drawn as lids, so it finds no whites and draws no face.
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.6 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/worm/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing, leaning back pleased with himself, the head cocked, his eyes wide open, ${KIT}.` },
    'walk-1': { pose: `walking to the right with a heavy stomp, mid-step, the near boot forward and the far boot back, legs apart, ${KIT}.` },
    'walk-2': { pose: `walking to the right, the legs passing under the body, one boot planted flat and the other lifted a little behind it, ${KIT}.` },
    'run-1': { pose: `running hard to the right, leaning forward, the near knee raised high in front and the far leg pushing off far behind, ${KIT}.` },
    'run-2': { pose: `running to the right, mid-stride, both big boots off the ground, the legs split wide apart front and back, ${KIT}.` },
    'air-1': { pose: `jumping up, both knees tucked up under him, the neck straight up, his eyes open, ${KIT}.` },
    'air-2': { pose: `falling, both big boots reaching straight down and apart, the empty arm flung up, his eyes wide and his mouth open, ${KIT}.` },
    wall: {
      pose: 'seen from his side, he is sliding down a tall wall that is just to his right (do not draw the wall), one empty glove and both big boots braced flat against it, knees bent, the hair dryer held in his other hand at his hip pointing down, his thick pink worm neck rising straight up out of the collar, his head turned to look back at us, eyes open.',
      far: true,
    },
    cheer: { pose: `cheering, up on his toes, one empty gloved fist punched high in the air, the hair dryer in the other hand at his hip, a big open grin, his eyes open, ${KIT}.` },
    cheer2: { pose: `laughing, the head tipped back, his eyes shut, a big grin, ${KIT}.` },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, the suit on the left and boots on the right, his thick pink worm neck lying limp and straight along the floor to the left with the head at its end, eyes shut, the hair dryer dropped flat on the floor beside him.',
      far: true,
    },
  },
};
