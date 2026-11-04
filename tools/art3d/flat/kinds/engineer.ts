import type { FlatKind } from '../kinds';

// Every pose keeps his kit as the design carries it, low and clear of his head: the toolbox in the hand on the
// left of the picture, the spanner low in the gloved hand on the right, its open jaw forward. Carried up by his
// shoulder, the spanner's jaw read as ears (blind read), so it is never raised past his chest.
const KIT =
  'the big green toolbox always in his hand on the left of the picture, and the giant spanner always held low in his gloved other hand, its open jaw forward, nothing raised above his shoulders';

export const kind: FlatKind = {
  body: 182,
  map: {
    roles: ['skin', 'shirt', 'hat', 'khaki', 'glove', 'grey', 'strap', 'box', 'mouth', 'dark'],
    // Sampled from the design (the fifth round, art/sprites/engineer/design.prompt.txt). The belt and boots are
    // the trousers' own browns, so they fold into them: the trousers' colourway is the boots' too.
    families: [
      ['skin', [238, 147, 101]],
      ['skin', [232, 144, 96]],
      ['skin', [240, 144, 104]],
      ['skin', [173, 97, 65]],
      ['skin', [184, 88, 64]],
      ['skin', [200, 129, 73]],
      ['mouth', [100, 36, 40]],
      ['mouth', [230, 102, 96]],
      ['shirt', [125, 39, 20]],
      ['shirt', [94, 27, 19]],
      ['shirt', [127, 42, 22]],
      ['shirt', [117, 48, 29]],
      ['shirt', [131, 54, 32]],
      ['shirt', [113, 32, 19]],
      ['hat', [232, 160, 8]],
      ['hat', [224, 160, 16]],
      ['hat', [176, 120, 24]],
      ['hat', [222, 186, 109]],
      ['hat', [240, 200, 112]],
      // The rim's top and its underside, a thin band between two ink lines.
      ['hat', [251, 190, 79]],
      ['hat', [202, 141, 27]],
      ['hat', [184, 129, 57]],
      ['hat', [163, 110, 31]],
      ['khaki', [141, 106, 74]],
      ['khaki', [136, 104, 72]],
      ['khaki', [130, 98, 70]],
      ['khaki', [112, 77, 52]],
      ['khaki', [104, 72, 48]],
      ['khaki', [88, 56, 40]],
      ['khaki', [79, 63, 51]],
      ['khaki', [66, 39, 28]],
      ['khaki', [56, 32, 16]],
      ['glove', [152, 104, 40]],
      ['glove', [112, 72, 32]],
      ['glove', [153, 120, 79]],
      ['glove', [203, 159, 87]],
      ['box', [65, 94, 71]],
      ['box', [105, 125, 97]],
      ['box', [84, 90, 72]],
      ['box', [79, 98, 79]],
      ['box', [88, 128, 88]],
      ['box', [64, 88, 64]],
      ['grey', [156, 143, 122]],
      ['grey', [144, 136, 128]],
      ['grey', [120, 160, 168]],
      ['grey', [112, 112, 108]],
      ['grey', [198, 198, 192]],
      ['strap', [72, 72, 80]],
      ['strap', [56, 56, 56]],
      ['dark', [255, 255, 255]],
      ['dark', [41, 7, 5]],
      ['dark', [24, 7, 5]],
      ['dark', [18, 0, 0]],
      ['dark', [61, 10, 6]],
      ['dark', [54, 27, 18]],
    ],
    line: 'dark',
    thin: ['skin', 'shirt', 'hat', 'khaki', 'glove', 'grey', 'strap', 'box', 'mouth'],
    fringe: 5,
    stroke: 2.4,
    ink: 7,
    // The gaps between arm and body and between the legs, and the toolbox's handle and the spanner's jaw, cut
    // through.
    holes: 0.6,
    // No corner cutting: at two rounds, and still at one, the toolbox traced as a soft bag, and its square
    // corners are the read (no other kind carries a box).
    smooth: 0,
    feet: ['khaki'],
    // The kit is carried, so the body's size is the man's, alike in every pose whatever the kit does.
    loose: ['grey', 'box'],
    min: { dark: 0.03, grey: 0.25, mouth: 0.2, skin: 1.5 },
  },
  roles: [
    { name: 'skin', color: '#efc9a4' },
    // The work shirt is the costume, in the player's colour; the hard hat a light tone of it, the toolbox a dark
    // one, each far enough from the shirt to stay its own shape.
    { name: 'shirt', color: '#b8433c', slot: 'player' },
    { name: 'hat', color: '#808080', on: 1, tone: 22 },
    // A colourway is the trousers (VARIETY.palette), neutrals all: khaki, slate, charcoal; the boots are drawn in them.
    { name: 'khaki', color: '#8c7a58', alts: ['#6b7178', '#5b5955'], vary: 6 },
    { name: 'glove', color: '#a8794a' },
    { name: 'grey', color: '#8e8a84' },
    { name: 'strap', color: '#3a4246' },
    { name: 'box', color: '#808080', on: 1, tone: -20 },
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
  // Found in the role map. The drawn eyes are thinner than the ink threshold and traced as line, so each pose's
  // two eyes are inked over as solid ovals before tracing (art/sprites/engineer/design.prompt.txt), big enough
  // to win over the specks of ink under the goggles' lenses just above them.
  eyes: { role: 'dark', from: 'map', area: [0.3, 0.95], band: [0.12, 0.36], gap: [0.8, 2.4], specks: { dark: 2.8 } },
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
  // Off the brim and thicker than the floor: his shut eyes and laugh were hairlines on the brim's ink line.
  face: { r: 0.62, iris: '#3c6fd0', mark: 0.6 },
  gait: { bounce: [0.1, 0.6], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.88 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.95 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    // The laugh's eyes are shut, which is what the kit's cheer draws.
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.92 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/engineer/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: {
      pose: `standing with his chest puffed out, looking pleased with himself, the toolbox hanging beside his knee and the spanner slanting forward and down, ${KIT}.`,
    },
    'walk-1': { pose: `trudging to the right with a heavy step, mid-step, the near boot forward and the far boot back, ${KIT}.` },
    'walk-2': {
      pose: `walking to the right, the legs passing under the body, both legs nearly straight and close together, one boot planted flat and the other just lifted off the ground behind it, ${KIT}.`,
    },
    'run-1': {
      pose: `running hard to the right, leaning forward, one knee high and the other leg pushing off behind, the toolbox swinging back behind him by its handle, ${KIT}.`,
    },
    'run-2': {
      pose: `running hard to the right, leaning forward, both boots off the ground with the legs gathered under him, the toolbox swinging back behind him by its handle, ${KIT}.`,
    },
    'air-1': { pose: `jumping up, the knees tucked up under him, the toolbox hanging by its handle below his hand, ${KIT}.` },
    'air-2': {
      pose: `falling, the legs reaching down, the toolbox flung out low behind him, the spanner pointing down beside him, his mouth open in alarm, ${KIT}.`,
    },
    wall: {
      pose: 'seen from his side, he is sliding down a tall wall that is just to his right (do not draw the wall), both boots braced on it, his head turned to look back at us, the toolbox hanging by its handle from his hand behind him, the spanner held low in his gloved other hand, its open jaw down by his knees.',
      far: true,
    },
    cheer: {
      pose: `cheering with a big open grin, up on his toes, both arms swung out wide and low at his sides, the toolbox swinging out by its handle to the left at hip height and the spanner out to the right at hip height, its open jaw pointing forward, ${KIT}.`,
    },
    cheer2: {
      pose: `leaning back laughing, his eyes shut, the toolbox hanging by its handle beside his knee, the spanner held low and slanting forward and down, ${KIT}.`,
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, head on the left and boots on the right, arms and legs splayed limp, eyes shut, the hard hat still on his head, the toolbox and the spanner dropped flat on the floor just below him. One figure only, seen from the side.',
      far: true,
    },
  },
};
