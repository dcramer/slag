import type { FlatKind } from '../kinds';

// Every pose keeps what carries her in colour, whatever colour she rolls (the clean colour read, 2026-11-06: the open
// umbrella held out low read as "a shield or a fan", and nothing else said it was her): the tin-can top hat as tall as
// the rest of her, standing straight up on its wide flat brim, with a wide band; the short cape flaring off her
// shoulders like two little wings, her shorts and legs showing under it; the long ponytail out of the back under the
// brim; and the umbrella plainly an umbrella, closed with its hook handle on the ground (held like a bat, leaned on
// like a cane) and open over her head in the air, its dome clear of the hat.
const KEEP =
  'the tall tin-can top hat always standing straight up off her head with its wide lilac band and its wide flat brim level, white background above and beside it, the short cape flaring off her shoulders, the long ponytail out of the back under the brim, and the closed furled cream umbrella with its hook handle in her front hand';
// The air poses, drawn on a sheet of their own so the model keeps the umbrella open in every figure.
const OPEN =
  "the tall tin-can top hat always standing straight up off her head with its wide lilac band and its wide flat brim level, the short cape flaring off her shoulders, the long ponytail out of the back under the brim; in every figure her umbrella is wide open: a big round cream paper cocktail umbrella with its dome canopy and thin ribs, on a long wooden toothpick stick, held up in her raised front hand so the open dome floats above and in front of the top of her hat, clear of the hat with white background between them";

export const kind: FlatKind = {
  body: 183,
  map: {
    roles: ['hat', 'band', 'tin', 'hair', 'skin', 'shorts', 'paper', 'white', 'dark'],
    // Sampled from the design (art/sprites/tophat/design.png, `swatch.py` and by hand: the median cut drops the hair).
    families: [
      // The hat and cape, their cel shade and the dent's, folded in.
      ['hat', [146, 54, 121]],
      ['hat', [141, 54, 114]],
      ['hat', [145, 48, 120]],
      ['hat', [147, 49, 121]],
      ['hat', [142, 49, 118]],
      ['hat', [99, 32, 88]],
      ['hat', [109, 40, 83]],
      ['hat', [138, 64, 97]],
      ['hat', [153, 60, 125]],
      ['hat', [104, 39, 92]],
      // The wide hair-tie band and its bow, and the cape's lining.
      ['band', [221, 170, 207]],
      ['band', [216, 168, 216]],
      ['band', [210, 178, 199]],
      ['band', [168, 125, 163]],
      // The tin's ridged rims and the socks: one grey.
      ['tin', [160, 160, 152]],
      ['tin', [172, 154, 164]],
      ['tin', [208, 208, 216]],
      ['tin', [120, 112, 120]],
      ['tin', [131, 120, 129]],
      // The hair and its shades.
      ['hair', [120, 68, 36]],
      ['hair', [113, 82, 71]],
      ['hair', [107, 49, 60]],
      ['hair', [143, 95, 97]],
      ['hair', [91, 68, 62]],
      ['hair', [85, 62, 64]],
      ['hair', [89, 41, 19]],
      // The skin and its shade.
      ['skin', [249, 194, 155]],
      ['skin', [225, 141, 119]],
      ['skin', [240, 215, 193]],
      ['skin', [237, 182, 183]],
      // The shorts and boots.
      ['shorts', [72, 64, 72]],
      ['shorts', [64, 64, 72]],
      ['shorts', [46, 29, 42]],
      ['shorts', [57, 46, 57]],
      // The umbrella's paper and its toothpick.
      ['paper', [240, 226, 192]],
      ['paper', [248, 232, 200]],
      ['paper', [240, 224, 184]],
      ['paper', [234, 194, 146]],
      ['paper', [228, 186, 138]],
      // The eyes' whites and the grin's teeth.
      ['white', [254, 250, 254]],
      // The ink.
      ['dark', [19, 3, 15]],
      ['dark', [31, 5, 24]],
      ['dark', [34, 15, 32]],
      ['dark', [43, 6, 33]],
      ['dark', [48, 16, 38]],
      ['dark', [72, 36, 49]],
    ],
    line: 'dark',
    thin: ['hat', 'band', 'tin', 'hair', 'skin', 'shorts', 'paper', 'white'],
    fringe: 5,
    stroke: 2.4,
    // The background the figure closes in (between the umbrella's ribs, the arm and the cape) cut through.
    holes: 0.8,
    feet: ['shorts'],
    // The umbrella is carried (open over her in the air), so the body's size is the girl in her hat, alike in every pose.
    loose: ['paper'],
    min: { dark: 0.3, band: 0.5, tin: 0.4, hair: 0.5, white: 0.2 },
  },
  roles: [
    // The costume: the hat and cape, in the player's colour; the hair tie and the cape's lining a light of it.
    { name: 'hat', color: '#963c8f', slot: 'player' },
    { name: 'band', color: '#808080', on: 0, tone: 30 },
    // A colourway is the tin's rims and the socks (VARIETY.palette), neutrals all: tin, steel blue-grey, brass.
    { name: 'tin', color: '#a09aa0', alts: ['#8c96a0', '#b8a47c'], vary: 6 },
    { name: 'hair', color: '#7a4426' },
    // The face: neutral.
    { name: 'skin', color: '#f8c8a0' },
    { name: 'shorts', color: '#4a4650' },
    { name: 'paper', color: '#f2e6c4' },
    { name: 'white', color: '#fbfaf6' },
    { name: 'dark', color: '#2a1426' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', area: [0.1, 3], gap: [1.4, 2.8], band: [0.4, 0.7], specks: { dark: 4, white: 3 } },
  wear: {
    on: ['hat'],
    chin: 3,
    marks: [[['scuff', 0.35, 0.86, 0.24]], [['scorch', 0.55, 0.88, 0.2]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.4, 0.6] }],
  // The grin: the drawing's teeth go with the face's specks, so the kit draws it, a grin on the cheer, an O on the fall.
  face: { r: 0.85, iris: '#2a1426', eye: 'anime', mouth: [1.1, 1.6] },
  gait: { bounce: [0.2, 0.8], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 24 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 36 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.76 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.9 },
    // The cheer's eyes are drawn shut in a laugh: no face.
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25], eyes: false },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.7 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses), the closed-umbrella poses and the open ones on
  // sheets of their own; the sheets' prompts are in art/sprites/tophat/design.prompt.txt. These are each pose alone.
  poses: {
    idle2: { pose: `standing with a smug grin, her free fist on her hip, leaning on the closed umbrella like a cane, its point on the floor in front of her, ${KEEP}.` },
    'walk-1': {
      pose: `skipping to the right with a bouncy confident step, the near leg forward and the far leg back, swinging the closed umbrella out in front of her like a baseball bat, angled up and forward, clear of her body and below the brim, ${KEEP}.`,
    },
    'walk-2': {
      pose: `skipping to the right, one boot planted and the other lifted behind, the closed umbrella held out in front of her like a baseball bat, angled up and forward, clear of her body, ${KEEP}.`,
    },
    'run-1': {
      pose: `running fast to the right, leaning forward, the near knee raised high in front and the far leg pushing off far behind, the cape and the ponytail flying out behind her, the closed umbrella held out in front of her like a baseball bat, angled up and forward, clear of her body and below the brim, ${KEEP}.`,
    },
    'run-2': {
      pose: `running to the right, both boots off the ground, the legs split wide apart front and back, the cape and ponytail flying out behind, the closed umbrella held out in front like a baseball bat, angled up and forward, ${KEEP}.`,
    },
    'air-1': { pose: `jumping up, both knees tucked under her, eyes open, holding the open umbrella up over her, ${OPEN}.` },
    'air-2': { pose: `floating down under the open umbrella held up high, both legs dangling straight down and apart, the ponytail and cape blown up, eyes wide, ${OPEN}.` },
    wall: {
      pose: 'seen from her side, facing right, she clings to a tall wall on the right edge of her space (do not draw the wall), both boots and her free hand braced flat against it, knees bent, the tall tin-can top hat with its wide lilac band still standing straight up off her head, the long ponytail and short cape hanging behind her, the closed furled cream umbrella with its hook handle held out low away from the wall to the left, her face turned to look back at us, eyes open.',
      far: true,
    },
    cheer: {
      pose: `cheering, up on her toes, a huge open laughing grin with her eyes shut, the closed umbrella thrust forward and up at a slant like a sword at arm's length, clear of the hat, ${KEEP}.`,
    },
    cheer2: { pose: `a cheeky twirl on one foot, the cape flaring out round her, the open umbrella held up over her shoulder, a big grin, ${OPEN}.` },
    death: {
      pose: 'knocked out, lying flat on her back on the floor, the whole body horizontal, her head on the left and her boots on the right, the tall tin-can top hat knocked off and lying on its side on the floor beside her head, the long ponytail spread out, the closed umbrella dropped on the floor beside her, eyes shut.',
      far: true,
    },
  },
};
