import type { FlatKind } from '../kinds';

// Every pose keeps his kit as the design carries it, low and clear of his head: the little turret hanging by its
// handle from the steel robot hand on the left of the picture, its barrel pointing back, and the spanner low in the
// gloved hand on the right, its open jaw forward; the dark goggles always down over his eyes. Carried up by his
// shoulder, the spanner's jaw read as ears (blind read), so it is never raised past his chest.
const KIT =
  'the dark goggles always down over his eyes, the little red turret robot always hanging by its handle from his steel robot hand on the left of the picture, its long barrel pointing back away from him, and the giant spanner always held low in his gloved other hand, its open jaw forward, nothing raised above his shoulders';

export const kind: FlatKind = {
  body: 201,
  map: {
    roles: ['skin', 'shirt', 'hat', 'khaki', 'glove', 'grey', 'box', 'mouth', 'dark'],
    // Sampled from the design (the sixth round, art/sprites/engineer/design.prompt.txt). The belt and boots are
    // the trousers' own browns, so they fold into them: the trousers' colourway is the boots' too. The turret was
    // drawn in the shirt's red; each drawing's is painted violet (its red pieces under the steel hand), so it maps
    // to a role of its own.
    families: [
      ['box', [96, 24, 112]],
      ['box', [72, 16, 88]],
      ['box', [64, 16, 80]],
      ['box', [88, 24, 104]],
      ['box', [96, 32, 120]],
      ['skin', [232, 136, 88]],
      ['skin', [211, 127, 87]],
      ['skin', [215, 150, 117]],
      ['skin', [199, 145, 116]],
      ['skin', [185, 116, 76]],
      ['skin', [164, 86, 62]],
      ['mouth', [96, 36, 36]],
      ['mouth', [90, 36, 42]],
      ['mouth', [220, 110, 110]],
      ['shirt', [118, 30, 14]],
      ['shirt', [97, 22, 14]],
      ['shirt', [118, 35, 17]],
      ['shirt', [123, 37, 20]],
      ['shirt', [111, 32, 15]],
      ['shirt', [109, 39, 24]],
      ['shirt', [116, 36, 18]],
      ['shirt', [82, 35, 26]],
      ['shirt', [79, 22, 17]],
      ['shirt', [115, 40, 22]],
      // The steel hard hat, and the turret's tape: the palest neutral.
      ['hat', [184, 176, 164]],
      ['hat', [208, 201, 191]],
      ['hat', [181, 172, 159]],
      ['hat', [224, 216, 200]],
      ['khaki', [140, 101, 71]],
      ['khaki', [125, 97, 71]],
      ['khaki', [126, 92, 66]],
      ['khaki', [108, 77, 58]],
      ['khaki', [96, 65, 49]],
      ['khaki', [93, 66, 50]],
      ['khaki', [117, 80, 57]],
      ['khaki', [112, 72, 48]],
      ['khaki', [66, 49, 40]],
      ['khaki', [59, 34, 27]],
      ['khaki', [53, 38, 32]],
      ['glove', [152, 104, 40]],
      ['glove', [152, 96, 32]],
      ['glove', [112, 72, 32]],
      ['glove', [203, 159, 87]],
      // The spanner, the robot hand, the goggles' rims and the turret's barrel and legs: one steel.
      ['grey', [145, 146, 139]],
      ['grey', [139, 138, 129]],
      ['grey', [136, 124, 111]],
      ['grey', [132, 128, 120]],
      ['grey', [124, 109, 93]],
      ['grey', [102, 95, 89]],
      ['grey', [98, 90, 84]],
      ['grey', [144, 130, 114]],
      // The goggles' dark lenses and their glints go to the ink, so each traces as one dark disc for the face kit.
      ['dark', [42, 48, 42]],
      ['dark', [48, 48, 40]],
      ['dark', [255, 255, 255]],
      ['dark', [33, 3, 2]],
      ['dark', [18, 2, 2]],
      ['dark', [51, 3, 2]],
      ['dark', [55, 15, 11]],
      ['dark', [45, 8, 6]],
      ['dark', [55, 22, 18]],
    ],
    line: 'dark',
    thin: ['skin', 'shirt', 'hat', 'khaki', 'glove', 'grey', 'box', 'mouth'],
    fringe: 5,
    stroke: 2.4,
    ink: 7,
    // The gaps between arm and body and between the legs, the turret's handle and legs and the spanner's jaw, cut
    // through.
    holes: 0.6,
    // No corner cutting: the turret's thin legs and barrel and the hat's rim keep their points.
    smooth: 0,
    feet: ['khaki'],
    // The kit is carried, so the body's size is the man's, alike in every pose whatever the kit does.
    loose: ['grey', 'box'],
    min: { dark: 0.03, grey: 0.25, mouth: 0.2, skin: 1.5 },
  },
  roles: [
    { name: 'skin', color: '#efc9a4' },
    // The work shirt is the costume, in the player's colour; the turret a dark of it, far enough from the shirt to
    // stay its own shape.
    { name: 'shirt', color: '#b8433c', slot: 'player' },
    // A battered steel hard hat, neutral: in a tone of the shirt it matched the costume the way a cap does, and the
    // clean read took him for the plumber.
    { name: 'hat', color: '#c9c5bc' },
    // A colourway is the trousers (VARIETY.palette), neutrals all: khaki, slate, charcoal; the boots are drawn in them.
    { name: 'khaki', color: '#8c7a58', alts: ['#6b7178', '#5b5955'], vary: 6 },
    { name: 'glove', color: '#a8794a' },
    { name: 'grey', color: '#8e8a84' },
    { name: 'box', color: '#808080', on: 1, tone: -24 },
    { name: 'mouth', color: '#6a2826' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear, in tones of the shirt and the trousers it's on: a faded patch, and soot.
    { name: 'scuff', color: '#808080', on: 1, tone: 12 },
    { name: 'scuff2', color: '#808080', on: 3, tone: 14 },
    { name: 'scorch', color: '#808080', on: 1, tone: -18 },
    { name: 'scorch2', color: '#808080', on: 3, tone: -22 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // The goggles' lenses, found in the role map (`from: 'map'`): the kit draws its goggle over each.
  eyes: { role: 'dark', from: 'map', area: [0.5, 3], band: [0.12, 0.34], gap: [1.2, 3.2], specks: { dark: 3.2 } },
  wear: {
    on: ['shirt', 'khaki'],
    chin: 3,
    marks: [
      [
        ['scuff', 0.5, 0.3, 0.9],
        ['scuff2', 0.42, 0.62, 0.45],
      ],
      [
        ['scorch', 0.55, 0.3, 1.0],
        ['scorch2', 0.58, 0.62, 0.45],
      ],
    ],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.5, 0.7] }],
  // Welding goggles down over his eyes, so no eye shows: the kit's goggle, which never shuts.
  face: { r: 1.15, iris: '#2a1f1a', eye: 'goggle' },
  gait: { bounce: [0.1, 0.6], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40, scale: 0.94 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.86 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.92 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25], scale: 0.89 },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.95 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/engineer/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: {
      pose: `standing with his chest puffed out, looking pleased with himself, the turret hanging beside his knee and the spanner slanting forward and down, ${KIT}.`,
    },
    'walk-1': { pose: `trudging to the right with a heavy step, mid-step, the near boot forward and the far boot back, ${KIT}.` },
    'walk-2': {
      pose: `walking to the right, the legs passing under the body, both legs nearly straight and close together, one boot planted flat and the other just lifted off the ground behind it, ${KIT}.`,
    },
    'run-1': {
      pose: `running hard to the right, leaning forward, one knee high and the other leg pushing off behind, the turret swinging back behind him by its handle, ${KIT}.`,
    },
    'run-2': {
      pose: `running hard to the right, leaning forward, both boots off the ground with the legs gathered under him, the turret swinging back behind him by its handle, ${KIT}.`,
    },
    'air-1': { pose: `jumping up, the knees tucked up under him, the turret hanging by its handle below his steel hand, ${KIT}.` },
    'air-2': {
      pose: `falling, the legs reaching down, the turret flung out low behind him, the spanner pointing down beside him, his mouth open in alarm, ${KIT}.`,
    },
    wall: {
      pose: 'seen from his side, he is sliding down a tall wall that is just to his right (do not draw the wall), both boots braced on it, his head turned to look back at us, the dark goggles down over his eyes, the turret hanging by its handle from his steel robot hand behind him, the spanner held low in his gloved other hand, its open jaw down by his knees.',
      far: true,
    },
    cheer: {
      pose: `cheering with a big open grin, up on his toes, both arms swung out wide and low at his sides, the turret swinging out by its handle to the left at hip height and the spanner out to the right at hip height, its open jaw pointing forward, ${KIT}.`,
    },
    cheer2: {
      pose: `leaning back laughing with his mouth wide open, the turret hanging by its handle beside his knee, the spanner held low and slanting forward and down, ${KIT}.`,
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, head on the left and boots on the right, arms and legs splayed limp, the hard hat and goggles still on his head, the turret and the spanner dropped flat on the floor just below him. One figure only, seen from the side.',
      far: true,
    },
  },
};
