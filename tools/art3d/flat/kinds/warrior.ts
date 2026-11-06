import type { FlatKind } from '../kinds';

// The round warrior, side on (round 5): the belly is the outline, a huge ball out in front, wider than the head,
// on short legs in big boots; on top a round bald head with the big nose and the bushy moustache in profile, and
// on its crown a small dented iron pot of a helmet, a low dome narrower than the head with a tall spike on top
// and two little loop handles (the twist: a cooking pot). His broad straight sword, the comic's own weapon, is
// held out level in front at belly height with background all round the blade: the roast leg of round 4 read at
// play size as a fist (a fat man punching, the plumber's rival), and a club as an arm cannon. The poses were drawn
// three to a 16:9 image with the design as the reference and cut apart (art/sprites/warrior/design.prompt.txt), and
// the spike on the pot stretched on each by art/sprites/warrior/spike.py: drawn, it was a pixel at play size and the
// pot read as the plumber's cap.
const KEEP =
  'the small dented iron pot with its spike always on top of his bald head, his big nose and bushy moustache sticking out in front, his huge round belly always bulging out in front, the sword always gripped in his front fist held out level in front of him pointing forward, clear of his body, never raised, his eye open';

export const kind: FlatKind = {
  body: 193,
  map: {
    roles: ['tunic', 'tshade', 'skin', 'iron', 'mous', 'leather', 'steel', 'dark'],
    // Sampled from the design (art/sprites/warrior/design.png, `swatch.py`) and its poses.
    families: [
      ['tunic', [185, 61, 51]],
      ['tunic', [176, 56, 44]],
      ['tunic', [168, 56, 48]],
      ['tunic', [176, 74, 64]],
      ['tunic', [181, 67, 57]],
      // The patch on the belly: a dark of the costume, so it stays a shape.
      ['tshade', [130, 38, 33]],
      ['tshade', [120, 32, 32]],
      ['skin', [244, 194, 147]],
      ['skin', [240, 184, 136]],
      ['skin', [242, 199, 160]],
      ['skin', [232, 184, 136]],
      ['iron', [140, 145, 147]],
      ['iron', [133, 129, 129]],
      ['iron', [128, 136, 136]],
      // The moustache and the brow.
      ['mous', [86, 63, 45]],
      ['mous', [88, 60, 40]],
      // The belt, the boots and the scabbard, and their shade.
      ['leather', [117, 78, 44]],
      ['leather', [104, 72, 40]],
      ['leather', [103, 71, 47]],
      ['leather', [128, 74, 49]],
      // The blade, the crossguard and the pommel, and their shade.
      ['steel', [216, 219, 224]],
      ['steel', [194, 190, 191]],
      ['steel', [184, 186, 194]],
      ['dark', [51, 20, 21]],
      ['dark', [44, 11, 11]],
      ['dark', [75, 31, 25]],
      ['dark', [24, 0, 0]],
      // The eye's glint: the kit draws the eye.
      ['dark', [255, 255, 255]],
    ],
    line: 'dark',
    thin: ['tunic', 'tshade', 'skin', 'iron', 'mous', 'leather', 'steel'],
    fringe: 5,
    stroke: 2.4,
    ink: 7,
    // The spike on the pot is a point, and the sword's tip: corner cutting rounds both into leaves.
    smooth: 0,
    feet: ['leather'],
    min: { dark: 0.12, mous: 0.3, tshade: 0.4, steel: 0.3 },
  },
  roles: [
    // The tunic is the costume (Decisions 4); the patch on the belly a dark of it.
    { name: 'tunic', color: '#b83a31', slot: 'player' },
    { name: 'tshade', color: '#808080', on: 0, tone: -24 },
    { name: 'skin', color: '#efbb8b' },
    { name: 'iron', color: '#8e949a' },
    // Lighter than the drawing's near-black: a dark under the face reads as a mouth.
    { name: 'mous', color: '#5e4230' },
    // A colourway is the leather (VARIETY.palette): the belt and the boots together, brown, slate or tan.
    { name: 'leather', color: '#6e4628', alts: ['#5a5450', '#a88458'], vary: 6 },
    { name: 'steel', color: '#d2d5da' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear on the tunic, in tones of the player's colour: a faded streak, and soot.
    { name: 'scuff', color: '#808080', on: 0, tone: 12 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // Side on, one eye: the biggest dark speck in the head's band.
  eyes: { role: 'dark', from: 'map', area: [0.06, 2.6], gap: [1, 4.5], specks: { dark: 2.8 }, count: 1 },
  wear: {
    on: ['tunic', 'tshade'],
    chin: 3,
    marks: [
      [
        ['scuff', 0.35, 0.45, 0.4],
        ['scuff', 0.3, 0.62, 0.3],
      ],
      [
        ['scorch', 0.4, 0.4, 0.45],
        ['scorch', 0.3, 0.7, 0.4],
      ],
    ],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2.2, 0.9], offset: [-0.3, -0.6] }],
  // A small round eye under the brow, as drawn: the heavy lid at 0.85 closed the eye, the brow and the moustache
  // into one dark band across the face at play scale (sunglasses, a pug's mask).
  face: { r: 0.7, iris: '#4a3428', mark: 1.1, eye: 'round' },
  gait: { bounce: [0.15, 0.8], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 26 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box', scale: 0.95 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.95 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3], eyes: false },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/warrior/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing smug and boastful, his chin up, his boots together, his other hand on his hip; ${KEEP}.` },
    'walk-1': { pose: `waddling heavily and proudly to the right, mid-step, his belly leading, the near boot forward and the far boot back; ${KEEP}.` },
    'walk-2': { pose: `waddling to the right, the legs passing under the belly, one boot planted flat and the other lifted a little; ${KEEP}.` },
    'run-1': {
      pose: `running fast to the right, leaning forward, his belly bouncing, one short leg reaching forward and the other pushing off behind, the free arm pumping behind; ${KEEP}.`,
    },
    'run-2': { pose: `running fast to the right, both boots off the ground with the short legs gathered up under the belly; ${KEEP}.` },
    'air-1': { pose: `jumping up and forward, both short legs tucked up under his belly, the other arm flung out behind; ${KEEP}.` },
    'air-2': {
      pose: `falling, his short legs reaching down apart, the free arm flailing out, his eye wide and his mouth open in alarm under the moustache; ${KEEP}.`,
    },
    wall: {
      pose: 'seen exactly side on, facing right: he is sliding down a tall wall on the right edge of his space (do not draw the wall, no line), his belly and one free hand pressed flat against it and both boots braced on it, the sword held out behind him in his other hand, the small iron pot on his head, his eye open.',
      far: true,
    },
    cheer: {
      pose: `cheering in triumph, up on his toes, his free fist raised by his shoulder, the sword thrust out level in front, a huge open grin under the moustache; ${KEEP}.`,
    },
    cheer2: {
      pose: `laughing a big belly laugh, leaning back, his free hand slapping his huge belly, the sword held out level low in front, his eye squeezed shut; ${KEEP}.`,
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, his head on the left and his boots on the right, his huge belly sticking up like a hill, his arms and legs splayed limp, the pot still on his head, the sword still in his hand lying flat beside him, his eyes shut. Seen from the side.',
      far: true,
    },
  },
};
