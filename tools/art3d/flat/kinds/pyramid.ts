import type { FlatKind } from '../kinds';

// Every pose keeps the two shapes that carry him (art/sprites/pyramid/design.prompt.txt): the tall upright rusty
// pyramid sitting straight down on his shoulders, its point straight up and its base narrower than them (the read: a
// triangle for a head on a hulking body; the old wedge, its point out past his front shoulder, was a brim at play
// size, and the mage's hat); and the long cheese slicer in his back fist, slanting from it down to the floor behind
// him to the left (the second read, a great blade dragged; never raised, never across his legs, where his base
// flared into a robe). KEEP is the words the pose sheets were drawn with. The drawn cowl is repainted in every pose
// as a hard pyramid (art/sprites/pyramid/cowl.py, sources in cone-flat/): straight edges, a flat base as wide as his
// shoulders, 1.35 times as tall as drawn, a lit near face and a shaded far face. Drawn, it traced as a soft narrow
// cone and clean readers took it for a hood.
const KEEP =
  'the tall upright rusty pyramid helmet always sitting straight down on his shoulders with its point straight up, and the long cheese slicer always in his back fist, slanting from his fist down to the floor behind him to the left, never raised, never in front of his legs';

export const kind: FlatKind = {
  body: 146,
  map: {
    roles: ['boot', 'skin', 'apron', 'pig', 'rust', 'cowl', 'steel', 'dark'],
    // Sampled from the design (art/sprites/pyramid/design.png, `swatch.py`), region by region: the wedge's design's
    // samples and the pyramid's, which are the same character's colours.
    families: [
      // The boots and the trousers under the apron, and their shade: one dark brown.
      ['boot', [68, 60, 52]],
      ['boot', [68, 60, 44]],
      ['boot', [60, 52, 44]],
      ['boot', [52, 44, 36]],
      ['boot', [68, 52, 44]],
      ['boot', [84, 68, 60]],
      // The boots' cel shade in the pyramid's drawings, a dark brown just off the ink: big enough to stay a fill, it
      // traced as ink blots on the boots until it had a family.
      ['boot', [44, 38, 32]],
      ['boot', [48, 38, 32]],
      ['boot', [42, 32, 28]],
      // The grey skin and its cel shade.
      ['skin', [188, 180, 172]],
      ['skin', [186, 182, 173]],
      ['skin', [182, 178, 169]],
      ['skin', [181, 179, 169]],
      ['skin', [183, 180, 172]],
      ['skin', [173, 170, 163]],
      ['skin', [126, 123, 131]],
      ['skin', [132, 124, 132]],
      ['skin', [134, 128, 134]],
      ['skin', [132, 132, 132]],
      ['skin', [141, 130, 136]],
      ['skin', [189, 176, 169]],
      // The butcher's apron and its shade.
      ['apron', [76, 124, 164]],
      ['apron', [79, 119, 160]],
      ['apron', [76, 116, 156]],
      ['apron', [63, 97, 135]],
      ['apron', [52, 84, 124]],
      ['apron', [97, 121, 150]],
      ['apron', [78, 102, 130]],
      // The cartoon pig printed on it.
      ['pig', [228, 148, 148]],
      ['pig', [207, 164, 162]],
      ['pig', [220, 140, 148]],
      ['pig', [180, 138, 144]],
      ['pig', [205, 156, 156]],
      ['pig', [181, 134, 139]],
      // The cowl, redrawn as a hard pyramid (art/sprites/pyramid/cowl.py): its lit near face.
      ['rust', [172, 98, 60]],
      ['rust', [166, 96, 57]],
      ['rust', [180, 108, 68]],
      // Its shaded far face.
      ['cowl', [112, 58, 38]],
      // The cheese slicer, blade and handle, and its edge's shade.
      ['steel', [188, 196, 196]],
      ['steel', [196, 196, 204]],
      ['steel', [191, 194, 198]],
      ['steel', [195, 198, 201]],
      ['steel', [95, 97, 112]],
      ['steel', [186, 185, 190]],
      ['steel', [198, 198, 202]],
      // The ink.
      ['dark', [36, 19, 26]],
      ['dark', [28, 9, 15]],
      ['dark', [20, 4, 12]],
      ['dark', [27, 10, 12]],
    ],
    line: 'dark',
    thin: ['boot', 'skin', 'apron', 'pig', 'rust', 'cowl', 'steel'],
    // The pyramid's edges and point stay hard: rounded, it traced as a soft cone, a hood.
    smooth: 0,
    fringe: 5,
    stroke: 2.4,
    feet: ['boot'],
    // The slicer is carried, so the body's size is the man under his helmet, alike in every pose.
    loose: ['steel'],
    // Skin slivers on the slicer's blade (its grey is near his) and the pig's rust-brown eye dots go.
    min: { dark: 0.3, pig: 0.6, skin: 0.4, rust: 0.4, cowl: 0.4 },
    // The slicer's slot and the gaps between his arms and his body, cut through.
    holes: 0.6,
  },
  roles: [
    { name: 'boot', color: '#4a3e38' },
    { name: 'skin', color: '#b8b4ae' },
    // The costume: the butcher's apron, in the player's colour; the pig printed on it a light of it.
    { name: 'apron', color: '#4f7fae', slot: 'player' },
    { name: 'pig', color: '#808080', on: 2, tone: 34 },
    // A colourway is the cowl (VARIETY.palette), neutrals all: rust, an old brown rust, a weathered iron (light
    // enough that its shaded face stays off the ink). Never a grey: galvanised, the cowl was his grey skin's colour
    // and the helmet melted into his shoulders.
    { name: 'rust', color: '#a85e3a', alts: ['#8a5238', '#7a6a60'], vary: 6 },
    // The pyramid's far face, a shade of whichever metal it is: two flat faces meeting at a ridge are a metal
    // pyramid; one flat colour traced as a cone, a hood.
    { name: 'cowl', color: '#808080', on: 4, tone: -15 },
    { name: 'steel', color: '#c6cace' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'scuff', color: '#808080', on: 2, tone: 14 },
    { name: 'scorch', color: '#808080', on: 2, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // No face: nothing under the helmet. A kit eye in the first wedge's slot sat near its point and turned the helmet
  // into a bird's head with a beak, and the pyramid has no slot. The "eye" is only the place the build sets the
  // plaster from (and the wear's chin): set by hand on the pyramid's face in every pose (`at`, fractions of the
  // figure's box, the slicer in it, from the rust's centre); with no `face`, nothing is drawn there.
  eyes: {
    role: 'dark',
    area: [0.1, 2.4],
    gap: [99, 99],
    specks: {},
    count: 1,
    at: {
      idle: [0.77, 0.36],
      idle2: [0.72, 0.35],
      'walk-1': [0.76, 0.36],
      'walk-2': [0.76, 0.35],
      'run-1': [0.72, 0.37],
      'run-2': [0.72, 0.36],
      'air-1': [0.5, 0.31],
      'air-2': [0.44, 0.33],
      wall: [0.43, 0.29],
      cheer: [0.7, 0.35],
      cheer2: [0.67, 0.36],
    },
  },
  wear: {
    on: ['apron'],
    chin: 4,
    marks: [[['scuff', 0.35, 0.75, 0.5]], [['scorch', 0.6, 0.8, 0.4]]],
  },
  // A strip of tape over the cowl's dent, on the helmet's face (a cheek strip, moved up onto the place set above).
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2, 0.75], offset: [1.6, -1.9] }],
  gait: { bounce: [0.1, 0.4], lean: [0, 0.02] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    // A slow, heavy plod: long strides for his speed, so the boots barely hurry.
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 34 },
    // A touch smaller: the lurch's lean pushed the slicer past the box behind him.
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 48, scale: 0.95 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box', scale: 0.85 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.86 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.8 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/pyramid/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing still, his free hand scratching the side of his helmet, the slicer resting on the ground behind him, ${KEEP}.` },
    'walk-1': {
      pose: `plodding slowly to the right, mid-step, the near boot forward and the far boot back, the slicer dragging on the ground behind his heels, ${KEEP}.`,
    },
    'walk-2': {
      pose: `plodding to the right, the legs passing under the body, one boot planted and the other lifted a little, the slicer dragging the same way, ${KEEP}.`,
    },
    'run-1': {
      pose: `lurching forward to the right in a heavy lumbering run, leaning forward, the near knee lifted and the far leg pushing off behind, the free fist swinging forward, the slicer dragging on the ground behind him, ${KEEP}.`,
    },
    'run-2': { pose: `lurching to the right, both boots off the ground with the legs gathered under him, the slicer trailing out behind him, ${KEEP}.` },
    'air-1': { pose: `jumping up, both knees tucked up under him, the free arm out to the side, the slicer hanging down behind him, ${KEEP}.` },
    'air-2': { pose: `falling, both boots reaching down and apart, the free arm flung out sideways in alarm, the slicer hanging down behind him, ${KEEP}.` },
    wall: {
      pose: 'seen from his side, he is sliding down a tall wall that is just to his right (do not draw the wall), his free hand flat against it and both boots braced on it, knees bent, the helmet on his shoulders, the cheese slicer hanging down below him in his other hand.',
      far: true,
    },
    cheer: { pose: `cheering, a little heavy hop, his free fist pumped out in front of him at shoulder height, the slicer held low behind him, ${KEEP}.` },
    cheer2: { pose: `waving slowly, his free hand open and held out to the right at shoulder height, the slicer resting on the ground behind him, ${KEEP}.` },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, the helmet on the left and boots on the right, arms and legs limp, the cheese slicer dropped flat on the floor beside him.',
      far: true,
    },
  },
};
