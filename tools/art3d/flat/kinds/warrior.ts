import type { FlatKind } from '../kinds';

// The round warrior, side on (round 4): his head is a shape of its own, the read the three-quarter rounds never had:
// a big round bald head with the nose and the bushy moustache sticking out past the body's line and the chin clear
// of the chest, and on its crown a small iron pot of a helmet, a low dome narrower than the head with a knob on top
// and a step at its rim (the twist: a cooking pot, its loop handles at the sides). Under it the huge round belly out
// in front, and the roast leg held out level in his fist, clear of everything: raised, it was the penguin king's
// hammer. The poses were drawn three to a 16:9 image with the design as the reference and cut apart
// (art/sprites/warrior/design.prompt.txt).
const KEEP =
  'seen exactly side on, his big round bald head with the big nose and the bushy moustache sticking out in front and the chin clear of his chest, the small dented iron pot always perched on top of his head, a low dome narrower than the head with its knob on top, his huge round belly always bulging out in front, the roast leg always in his front fist held out level, never raised over his head, his eye open';

export const kind: FlatKind = {
  body: 183,
  map: {
    roles: ['tunic', 'tshade', 'skin', 'iron', 'mous', 'leather', 'cloth', 'meat', 'bone', 'mouth', 'dark'],
    // Sampled from the design (art/sprites/warrior/design.png, `swatch.py`) and its poses.
    families: [
      ['tunic', [183, 60, 52]],
      ['tunic', [166, 53, 46]],
      // The tunic's shadow side and the patch on the belly, one dark red in the drawing: a dark of the costume, so
      // the patch stays a shape.
      ['tshade', [135, 43, 38]],
      ['skin', [239, 187, 139]],
      ['skin', [237, 201, 168]],
      ['skin', [248, 212, 178]],
      // The skin's shade, a shape of its own in the drawing, folded in: the figure is flat.
      ['skin', [206, 140, 100]],
      ['iron', [144, 148, 150]],
      ['iron', [108, 114, 118]],
      ['iron', [140, 128, 114]],
      // The moustache and the brow.
      ['mous', [80, 60, 40]],
      // The belt, the boots and the scabbard, and their shade.
      ['leather', [105, 69, 41]],
      ['leather', [114, 69, 40]],
      ['leather', [96, 61, 39]],
      ['leather', [132, 84, 48]],
      ['leather', [151, 99, 68]],
      ['leather', [74, 47, 34]],
      ['cloth', [128, 110, 96]],
      ['cloth', [100, 84, 68]],
      ['meat', [172, 92, 46]],
      ['meat', [188, 114, 71]],
      ['meat', [140, 64, 30]],
      ['bone', [232, 214, 186]],
      ['dark', [64, 29, 21]],
      ['dark', [54, 27, 20]],
      ['dark', [75, 27, 19]],
      // The eye's white and its glint: the kit draws the eye.
      ['dark', [255, 255, 255]],
    ],
    line: 'dark',
    thin: ['tunic', 'tshade', 'skin', 'iron', 'mous', 'leather', 'cloth', 'meat', 'bone', 'mouth'],
    fringe: 5,
    stroke: 2.4,
    feet: ['leather', 'cloth'],
    min: { dark: 0.12, mouth: 0.2, bone: 0.2, mous: 0.3, tshade: 0.4 },
  },
  roles: [
    // The tunic is the costume (Decisions 4); its shadow side and the patch a dark of it.
    { name: 'tunic', color: '#b83a31', slot: 'player' },
    { name: 'tshade', color: '#808080', on: 0, tone: -22 },
    { name: 'skin', color: '#efbb8b' },
    { name: 'iron', color: '#8e949a' },
    // Lighter than the drawing's near-black: a dark under the face reads as a mouth.
    { name: 'mous', color: '#5e4230' },
    // A colourway is the leather (VARIETY.palette): the belt, boots and scabbard together, brown, slate or tan.
    { name: 'leather', color: '#6e4628', alts: ['#5a5450', '#a88458'], vary: 6 },
    { name: 'cloth', color: '#7d7068' },
    { name: 'meat', color: '#ac5c2e' },
    { name: 'bone', color: '#ecdcb8' },
    { name: 'mouth', color: '#9a3d36' },
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
        ['scuff', 0.5, 0.45, 0.4],
        ['scuff', 0.45, 0.62, 0.3],
      ],
      [
        ['scorch', 0.55, 0.4, 0.45],
        ['scorch', 0.3, 0.72, 0.4],
      ],
    ],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2.2, 0.9], offset: [-0.3, -0.6] }],
  // A heavy lid over a round eye: the boaster's half-shut look, lifted on a jump, gone on a fall.
  face: { r: 0.85, iris: '#4a3428', mark: 1.1, eye: 'heavy' },
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
    idle2: { pose: `standing smug and boastful, his chin up, his free hand patting his huge belly, the roast leg held out level in front; ${KEEP}.` },
    'walk-1': {
      pose: `waddling heavily and proudly to the right, mid-step, his belly leading, the near boot forward and the far boot back, his free arm swinging; ${KEEP}.`,
    },
    'walk-2': {
      pose: `waddling to the right, the legs passing under the belly, one boot planted flat and the other lifted a little, his free arm swinging; ${KEEP}.`,
    },
    'run-1': {
      pose: `running fast to the right, leaning forward, his belly bouncing, one short leg reaching forward and the other pushing off behind, the free arm pumping behind; ${KEEP}.`,
    },
    'run-2': { pose: `running fast to the right, leaning forward, both boots off the ground with the short legs gathered up under the belly; ${KEEP}.` },
    'air-1': { pose: `jumping up and forward, both short legs tucked up under his belly, the free arm flung out behind, determined; ${KEEP}.` },
    'air-2': {
      pose: `falling, his short legs reaching down apart, the free arm flailing out behind, his eye wide and his mouth open in alarm under the moustache; ${KEEP}.`,
    },
    wall: {
      pose: 'seen exactly side on, facing right: he is sliding down a tall wall on the right edge of his space (do not draw the wall, no line), his belly and one free hand pressed flat against it and both boots braced on it, the roast leg held out behind him in his other hand, the small iron pot on his head, his eye open.',
      far: true,
    },
    cheer: {
      pose: `cheering in triumph, up on his toes, his free fist on his hip, the roast leg thrust out level in front, a huge open grin under the moustache; ${KEEP}.`,
    },
    cheer2: {
      pose: `laughing a big belly laugh, leaning back, his free hand slapping his huge belly, the roast leg held out level in front, his eye squeezed shut; ${KEEP}.`,
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, his head on the left and his boots on the right, his huge belly sticking up like a hill, his arms and legs splayed limp, the pot still on his head, the roast leg dropped beside him, his eyes shut. Seen from the side.',
      far: true,
    },
  },
};
