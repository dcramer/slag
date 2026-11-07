import type { FlatKind } from '../kinds';

// Every pose keeps the three things that carry him (round 8, art/sprites/worm/design.prompt.txt): the thin pink
// worm neck rising out of the collar and arcing forward once at the top, with a big head on it, far wider than the
// neck, and huge eyes standing up out of it (at round 7's size the head read as a hook or a tube snout at play
// size); the hero's build, two huge round shoulder pads in a pale tint of the suit so they stay their own shapes,
// a narrow belted waist, slim legs in big boots (pads in the suit's own colour merged into one blob); and the big
// hair dryer held out in one hand like a raygun, clear of the body.
const KIT =
  "his thin pink worm neck always rising out of the collar and arcing forward at the top, his big worm head on its end exactly as big as in the reference with its two huge bulging white eyes, his two huge round pale shoulder pads always showing, and the big grey hair dryer always held out like a raygun at arm's length in his front gloved hand, clear of his body with white background round it";

export const kind: FlatKind = {
  body: 134,
  map: {
    roles: ['suit', 'glove', 'patch', 'grey', 'pink', 'eye', 'dark', 'pad'],
    // Sampled from round 8's design (art/sprites/worm/design.prompt.txt).
    families: [
      // The suit and its cel shadow, chest, arms and legs alike.
      ['suit', [93, 137, 173]],
      ['suit', [91, 137, 173]],
      ['suit', [92, 136, 171]],
      ['suit', [90, 136, 172]],
      ['suit', [57, 95, 128]],
      ['suit', [115, 140, 161]],
      // The gloves, boots and belt, and their shadow and shine.
      ['glove', [67, 91, 113]],
      ['glove', [63, 90, 113]],
      ['glove', [68, 94, 115]],
      ['glove', [64, 72, 88]],
      ['glove', [38, 40, 59]],
      ['glove', [100, 114, 129]],
      // The small paler patch on the shin.
      ['patch', [154, 174, 190]],
      // The two big round shoulder pads, a pale tint of the suit, and their shine.
      ['pad', [197, 225, 238]],
      ['pad', [230, 236, 239]],
      // The hair dryer, lit and shaded, and its shine.
      ['grey', [144, 138, 132]],
      ['grey', [134, 123, 137]],
      ['grey', [110, 104, 100]],
      ['grey', [229, 222, 225]],
      // The worm, and the ring lines down him.
      ['pink', [242, 155, 161]],
      ['pink', [242, 159, 164]],
      ['pink', [226, 180, 183]],
      ['pink', [194, 151, 151]],
      ['pink', [155, 114, 119]],
      // The eyes' whites and the teeth, repainted by art/sprites/worm/prep.py so they aren't holes: the eyes are
      // found by their whites, and the kit draws its own.
      ['eye', [220, 222, 240]],
      // The ink.
      ['dark', [35, 13, 32]],
      ['dark', [27, 11, 28]],
      ['dark', [43, 13, 33]],
      ['dark', [58, 50, 67]],
    ],
    line: 'dark',
    thin: ['suit', 'glove', 'patch', 'grey', 'pink', 'eye', 'pad'],
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
    // The shoulder pads, a light of the suit: in the suit's own colour they merged into the chest at play size.
    { name: 'pad', color: '#808080', on: 0, tone: 28 },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // Found by their whites (repainted by art/sprites/worm/prep.py), one: the drawn eyes touch and trace as one patch
  // in most poses, so the far eye is set from the near one. The whites and the teeth stay: they are the huge
  // bulging eyes and the wide grin, and the kit's pupils sit on them. When the eyes shut the kit lids them in the
  // worm's pink (`lid`, role 4): erased instead, the eyes sank inside the head and the grin went with them.
  eyes: { role: 'eye', area: [0.15, 16], gap: [0.6, 3], band: [0, 0.3], specks: { eye: 1, dark: 2 }, count: 1, pair: [1.8, -0.1] },
  wear: {
    on: ['suit'],
    chin: 6,
    marks: [[['scuff', 0.4, 0.7, 0.5]], [['scorch', 0.5, 0.75, 0.35]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.4, 0.6] }],
  face: { r: 1.05, iris: '#2a1f1a', far: 'sliver', lid: { role: 4, r: 2 } },
  gait: { bounce: [0.2, 0.8], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.88 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.9 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    // The laugh's eyes are shut and drawn as lids; the whites it finds are the teeth, so it draws no face.
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3], eyes: false },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.66 },
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
