import type { FlatKind } from '../kinds';

// Every pose keeps the gaps: he has no arms or legs, and nobody else in the cast is in pieces, so the white round
// each glove and shoe is the read (docs/CHARACTERS.md → The limbless hero).
const FLOAT = 'his two gloves and two shoes floating free of his body with white space all round each, nothing joining them to him';

export const kind: FlatKind = {
  body: 135,
  map: {
    roles: ['top', 'ring', 'kerch', 'skin', 'hair', 'glove', 'shoe', 'white', 'dark'],
    // Sampled from the design (art/sprites/limbless/design.prompt.txt). The shoes and neckerchief are drawn gold
    // and red so they part from the top; the game paints them in the kind's roles. Every drawing has its floating
    // pieces pushed clear first (art/sprites/limbless/spread.py): drawn a world px off the body, the pen closed
    // the gaps at play size.
    families: [
      ['top', [131, 66, 150]],
      ['top', [124, 67, 125]],
      ['top', [95, 41, 116]],
      ['top', [94, 43, 84]],
      ['ring', [238, 231, 194]],
      ['ring', [238, 231, 177]],
      ['kerch', [197, 51, 50]],
      ['kerch', [139, 44, 59]],
      // The safety pin is a speck at play size: it goes with the neckerchief it holds.
      ['kerch', [172, 188, 193]],
      ['skin', [248, 195, 151]],
      ['skin', [248, 199, 156]],
      ['skin', [225, 187, 132]],
      ['skin', [234, 205, 168]],
      // The nose is the skin's, its shades and the face's one family: the nose's underside and the jaw's shade
      // are the same tan, so in roles of their own the jaw traced as a crescent of nose. The ink round the nose
      // keeps it the big shape out front.
      ['skin', [247, 169, 119]],
      ['skin', [243, 167, 108]],
      ['skin', [222, 147, 108]],
      ['skin', [252, 204, 160]],
      ['skin', [222, 168, 134]],
      ['skin', [175, 114, 95]],
      ['skin', [194, 117, 90]],
      ['hair', [131, 82, 42]],
      ['hair', [128, 83, 48]],
      ['hair', [138, 86, 42]],
      ['hair', [183, 115, 60]],
      // The hair's shade: nearer the shoes' own shade, it traced as a streak of the player's colour through the tuft.
      ['hair', [92, 44, 20]],
      ['hair', [128, 72, 36]],
      ['glove', [239, 231, 144]],
      ['glove', [240, 233, 152]],
      ['glove', [242, 234, 163]],
      ['glove', [183, 147, 96]],
      ['glove', [201, 173, 102]],
      ['shoe', [223, 168, 40]],
      ['shoe', [168, 112, 31]],
      ['shoe', [180, 115, 20]],
      ['shoe', [156, 100, 28]],
      ['shoe', [212, 165, 63]],
      ['shoe', [233, 164, 79]],
      ['white', [255, 255, 255]],
      ['dark', [45, 17, 32]],
      ['dark', [34, 6, 11]],
      ['dark', [56, 15, 25]],
      ['dark', [68, 33, 38]],
    ],
    line: 'dark',
    thin: ['top', 'ring', 'kerch', 'skin', 'hair', 'glove', 'shoe', 'white'],
    fringe: 5,
    stroke: 2.4,
    // He stands on his shoes, floating under him; the gloves wave about from pose to pose, so the body's size is
    // the rest of him.
    feet: ['shoe'],
    loose: ['glove'],
    // The neck hole's ink under the face (about 2 world px²) read as a mouth, and the thick ink between the hair's
    // spikes as specks: under 2.4 a dark goes into what's round it. The eyes come from the map.
    min: { dark: 2.4 },
  },
  roles: [
    // The top is the costume, in the player's colour; the shoes a light tone of it, far enough off to stay their
    // own shapes under him.
    { name: 'top', color: '#7b3fa6', slot: 'player' },
    { name: 'ring', color: '#efe7cf' },
    { name: 'kerch', color: '#e4ddd0' },
    { name: 'skin', color: '#f2c9a0' },
    // A colourway is the hair (VARIETY.palette), neutrals all: brown, straw and charcoal.
    { name: 'hair', color: '#8a5a34', alts: ['#c99a4a', '#4a3c36'], vary: 6 },
    { name: 'glove', color: '#f2efe6' },
    { name: 'shoe', color: '#808080', on: 0, tone: 24 },
    { name: 'white', color: '#fbf8f2' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear, in tones of the top and the shoes it's on: a faded patch, and soot.
    { name: 'scuff', color: '#808080', on: 0, tone: 12 },
    { name: 'scuff2', color: '#808080', on: 0, tone: 34 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'scorch2', color: '#808080', on: 0, tone: 8 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', from: 'map', area: [0.05, 1.4], gap: [0.8, 3], specks: { dark: 2.4, white: 6 }, band: [0.15, 0.45] },
  wear: {
    on: ['top', 'shoe'],
    chin: 3,
    marks: [
      [
        ['scuff', 0.3, 0.7, 0.8],
        ['scuff2', 0.5, 0.5, 0.5],
      ],
      [
        ['scorch', 0.4, 0.75, 0.6],
        ['scorch2', 0.5, 0.5, 0.5],
      ],
    ],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.8, 0.7] }],
  face: { r: 0.85, iris: '#2a1f1a' },
  gait: { bounce: [0.1, 0.7], lean: [0, 0.04] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 26 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.88 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/limbless/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing pleased with himself, chin up, both gloves held loose at his sides at hip height, the near shoe tapping its toe up, ${FLOAT}.` },
    'walk-1': {
      pose: `walking to the right, mid-step, the near shoe stepping forward and the far shoe back under him, the near glove swinging back and the far glove swinging forward, ${FLOAT}.`,
    },
    'walk-2': {
      pose: `walking to the right, the two shoes passing close together under him, one flat and the other just lifted, the gloves hanging at his sides, ${FLOAT}.`,
    },
    'run-1': {
      pose: `running fast to the right, leaning forward, the near shoe stretched far forward and the far shoe kicked far back behind him, the near glove swung back behind him and the far glove punched forward in front, ${FLOAT}.`,
    },
    'run-2': {
      pose: `running fast to the right, leaning forward, both shoes gathered up under him off the ground, the gloves pumping at his sides, ${FLOAT}.`,
    },
    'air-1': {
      pose: `jumping up, rising, both shoes tucked up under him, both gloves raised on either side of his head, his hair tuft standing straight up, ${FLOAT}.`,
    },
    'air-2': {
      pose: `falling, tipped back a little, both gloves flung up and out on either side of his head, the shoes dangling apart below him, his eyes wide open in alarm, ${FLOAT}.`,
    },
    wall: {
      pose: `seen from his side, he is sliding down a tall wall that is just to his right (do not draw the wall), both shoes and one glove pressed flat against where the wall would be, one above the other, his head turned to look back at us with his eyes open, ${FLOAT}.`,
      far: true,
    },
    cheer: {
      pose: `cheering with a big open grin and his eyes open, hopping, both gloves thrown up high on either side of his head, the shoes apart under him, ${FLOAT}.`,
    },
    cheer2: {
      pose: `giving a big thumbs up with the near glove held out in front of him, the far glove on his hip a little away from the body, grinning with his eyes open, the shoes planted apart, ${FLOAT}.`,
    },
    death: {
      pose: 'knocked out, lying flat on his back on the floor, his body horizontal, head on the left, eyes shut, his gloves and shoes dropped limp on the floor around him, each a little apart from the body. One figure only, seen from the side.',
      far: true,
    },
  },
};
