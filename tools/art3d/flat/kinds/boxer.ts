import type { FlatKind } from '../kinds';

// Every pose keeps the shapes that carry him (art/sprites/boxer/design.prompt.txt): the two huge oven-mitt gloves, each
// bigger than his head, held far apart, the upper one out ahead of his face and the lower one ahead of his belly, with
// background between the gloves, his face and his body (head-sized gloves held close traced into his head, and two
// blind reads named a boxer only at low); upright and bouncing on his toes, never a low wide stance (the fighter's);
// the tank top and baggy shorts, the tea towel.
const KEEP =
  'his arms reaching out exactly as in the reference, the two huge green oven-mitt gloves, each bigger than his head, held far apart: the upper one out ahead of his face at eye height, the lower one out ahead of his belly, with wide white gaps between the two gloves, between the upper glove and his face and between the lower glove and his body; the grey tape at both wrists, the checked tea towel, the black tank top and baggy black shorts, the grey boots';

export const kind: FlatKind = {
  body: 207,
  map: {
    roles: ['glove', 'burn', 'skin', 'towel', 'black', 'grey', 'eye', 'dark'],
    // Sampled from the design (art/sprites/boxer/design.png, `swatch.py` and by region).
    families: [
      // The gloves, their cel shade and quilting.
      ['glove', [78, 163, 80]],
      ['glove', [82, 162, 83]],
      ['glove', [74, 138, 73]],
      ['glove', [56, 122, 65]],
      ['glove', [60, 117, 64]],
      ['glove', [82, 151, 79]],
      // The scorch on the upper mitt.
      ['burn', [81, 53, 41]],
      ['burn', [67, 51, 43]],
      ['burn', [104, 82, 52]],
      // Skin, its shade and the ear's inside.
      ['skin', [227, 167, 115]],
      ['skin', [224, 170, 118]],
      ['skin', [231, 194, 150]],
      ['skin', [170, 107, 81]],
      ['skin', [131, 92, 68]],
      // The tea towel and its checks.
      ['towel', [235, 232, 197]],
      ['towel', [176, 179, 145]],
      ['towel', [187, 163, 121]],
      // His hair, the tank top and the shorts: one charcoal, the cloth's shade folded in.
      ['black', [37, 37, 37]],
      ['black', [36, 38, 36]],
      ['black', [48, 48, 47]],
      ['black', [46, 48, 46]],
      ['black', [28, 28, 28]],
      ['black', [41, 39, 39]],
      // The boots and the wrist tape.
      ['grey', [132, 133, 128]],
      ['grey', [157, 157, 149]],
      ['grey', [145, 138, 130]],
      ['grey', [124, 128, 119]],
      ['grey', [96, 98, 93]],
      ['grey', [75, 80, 71]],
      // His eyes, painted apart from his brows (art/sprites/fighter/eyes.py, design.prompt.txt).
      ['eye', [96, 16, 72]],
      ['eye', [94, 27, 63]],
      // The ink.
      ['dark', [8, 3, 13]],
      ['dark', [19, 16, 28]],
      ['dark', [14, 10, 20]],
    ],
    line: 'dark',
    thin: ['glove', 'burn', 'skin', 'towel', 'black', 'grey'],
    fringe: 5,
    stroke: 2.4,
    smooth: 1,
    // The background closed in between the gloves and his arms.
    holes: 0.8,
    feet: ['grey'],
    min: { dark: 0.4, burn: 0.6, towel: 0.4, grey: 0.3, eye: 5 },
  },
  roles: [
    // The costume: the gloves in the player's colour, the scorch a dark of it.
    { name: 'glove', color: '#4ea350', slot: 'player' },
    { name: 'burn', color: '#808080', on: 0, tone: -18 },
    { name: 'skin', color: '#e3a773' },
    // A colourway is the tea towel (VARIETY.palette): a cream, a bone, a pale grey. Neutrals only.
    { name: 'towel', color: '#ece6c8', alts: ['#e0d4b8', '#d6d8d8'], vary: 6 },
    // Hair, tank top and shorts: a charcoal light enough to stay a shape on a dark theme.
    { name: 'black', color: '#3c3c42' },
    { name: 'grey', color: '#8c8e8a' },
    { name: 'eye', color: '#1c1620' },
    { name: 'dark', color: '#1c1620' },
    { name: 'scuff', color: '#808080', on: 4, tone: 16 },
    { name: 'scorch', color: '#808080', on: 4, tone: -12 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // Side on: one eye, a dot, found in the map (a small face's eyes smooth away), the far one a sliver.
  eyes: { role: 'eye', from: 'map', count: 1, pair: [-1, 0], area: [0.1, 3], gap: [0.8, 3.5], specks: { eye: 3, dark: 1.2 }, band: [0.05, 0.45] },
  wear: {
    on: ['black'],
    chin: 6,
    marks: [[['scuff', 0.4, 0.7, 0.26]], [['scorch', 0.55, 0.8, 0.24]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.2, 0.5] }],
  face: { r: 0.6, iris: '#1c1620', eye: 'dot' },
  // Always bouncing on his toes.
  gait: { bounce: [0.4, 0.9], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    // The jab, out of the bounce.
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [0.4, 1.6] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 22 },
    // Smaller on the run: the gloves held out reach past the box's side.
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 34, scale: 0.94 },
    // Rising, the uppercut (his special); falling, the arms flung out.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box', scale: 0.85 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.9 },
    // The double fist pump.
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.3] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.8, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.8 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/boxer/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: {
      pose: `bouncing on his toes, the upper glove punched straight out level far ahead in a jab, ${KEEP}.`,
    },
    'walk-1': { pose: `walking to the right, upright, mid-step, the near boot forward and the far boot back, ${KEEP}.` },
    'walk-2': { pose: `walking to the right, upright, the legs passing under him, one boot planted and the other lifted behind, ${KEEP}.` },
    'run-1': { pose: `jogging fast to the right, the near knee raised high in front and the far leg pushing off behind, ${KEEP}.` },
    'run-2': { pose: `jogging to the right mid-stride, both boots off the ground, the legs apart front and back, ${KEEP}.` },
    'air-1': {
      pose: 'a rising jumping uppercut, the upper glove punched straight up high above and ahead of his head, the lower glove out ahead of his belly, the near knee raised, the two huge green oven-mitt gloves, each bigger than his head, with wide white gaps between the two gloves, between each glove and his head and between each glove and his body; the grey tape at both wrists, the checked tea towel, the black tank top and baggy black shorts, the grey boots.',
    },
    'air-2': {
      pose: `falling, both boots reaching down and apart, both gloves thrown out wide to the sides for balance, eyes wide, the two huge green oven-mitt gloves, each bigger than his head, with a wide white gap between each glove and his head.`,
    },
    wall: {
      pose: 'seen from his side, facing right: he is sliding down a tall wall on the right edge of his space (do not draw the wall), one glove and both boots braced flat against it, knees bent, his other glove held out to the left, his head turned to look back at us, his eyes open.',
      far: true,
    },
    cheer: {
      pose: 'a double fist pump, both elbows bent and both gloves pulled down hard beside his chest, a big open grin, eyes open, the two huge green oven-mitt gloves, each bigger than his head, with a wide white gap between each glove and his head.',
    },
    cheer2: {
      pose: 'standing proudly, the front glove raised high in victory above his head, the other glove at his side, a cocky grin, eyes open, the two huge green oven-mitt gloves, each bigger than his head, with a wide white gap between each glove and his head.',
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, his head on the left and his boots on the right, arms and legs splayed limp, the gloves still on, his eyes shut.',
      far: true,
    },
  },
};
