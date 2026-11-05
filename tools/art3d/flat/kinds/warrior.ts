import type { FlatKind } from '../kinds';

// The round warrior: the huge round belly on short legs, a small iron pot of a helmet with a knob on top perched on
// a bald head, its handle out behind (the twist), and the roast leg held out clear of the body in his front fist.
// The poses were drawn three to a 16:9 image with the design as the reference and cut apart
// (art/sprites/warrior/design.prompt.txt). Rounds 2 and 3 (a spike and a straight handle; side on with the belly
// out front) are in art/sprites/warrior/r2 and r3: neither read better blind.
const KEEP =
  'the small dented iron pot always on his bald head with its knob on top and its bent handle sticking out behind, the roast leg always in his front fist held out in front of him clear of his body, his huge round belly, his moustache, his eyes open';

export const kind: FlatKind = {
  body: 239,
  map: {
    roles: ['tunic', 'skin', 'iron', 'mous', 'leather', 'cloth', 'meat', 'bone', 'mouth', 'dark'],
    // Sampled from the design (art/sprites/warrior/design.png, `swatch.py`) and its poses.
    families: [
      ['tunic', [192, 64, 56]],
      ['tunic', [188, 64, 56]],
      // The tunic's cel shadow, folded in: the figure is flat.
      ['tunic', [150, 36, 38]],
      ['skin', [244, 184, 140]],
      ['skin', [252, 216, 188]],
      ['skin', [242, 199, 167]],
      // The skin's shade, the tongue, the meat's bitten flesh and the belly's patch are one salmon in the drawing:
      // the patch folds into the skin, a neutral, or the arms' shade took the player's colour.
      ['skin', [214, 113, 92]],
      ['skin', [224, 116, 104]],
      ['skin', [220, 122, 106]],
      ['skin', [220, 100, 92]],
      ['iron', [144, 144, 148]],
      ['iron', [180, 184, 188]],
      ['iron', [102, 106, 110]],
      ['mous', [60, 40, 28]],
      // The belt, the boots, the scabbard and the hilt, and their shade: near the open mouth's dark red, the boots'
      // backs drew in it.
      ['leather', [118, 70, 40]],
      ['leather', [134, 80, 44]],
      ['leather', [146, 94, 58]],
      ['leather', [84, 42, 26]],
      ['cloth', [132, 100, 84]],
      ['cloth', [94, 60, 60]],
      ['meat', [176, 92, 36]],
      ['meat', [188, 100, 57]],
      ['meat', [144, 64, 32]],
      ['bone', [240, 220, 176]],
      ['mouth', [96, 36, 40]],
      ['dark', [45, 12, 26]],
      ['dark', [36, 4, 13]],
      ['dark', [48, 19, 33]],
      ['dark', [16, 0, 0]],
      // The soles, and the eyes' glints, inside the eyes.
      ['dark', [44, 44, 40]],
      ['dark', [255, 255, 255]],
    ],
    line: 'dark',
    thin: ['tunic', 'skin', 'iron', 'mous', 'leather', 'cloth', 'meat', 'bone', 'mouth'],
    fringe: 5,
    stroke: 2.4,
    feet: ['leather', 'cloth'],
    min: { dark: 0.12, mouth: 0.2, bone: 0.2, mous: 0.3 },
  },
  roles: [
    // The tunic is the costume (Decisions 4).
    { name: 'tunic', color: '#c24a40', slot: 'player' },
    { name: 'skin', color: '#efc09a' },
    { name: 'iron', color: '#8e949a' },
    // Lighter than the drawing's near-black: a dark under the face reads as a mouth.
    { name: 'mous', color: '#5a4030' },
    // A colourway is the leather (VARIETY.palette): the belt, boots and scabbard together, brown, slate or tan.
    { name: 'leather', color: '#7a5034', alts: ['#5a5450', '#a88458'], vary: 6 },
    { name: 'cloth', color: '#857a70' },
    { name: 'meat', color: '#b0602e' },
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
  eyes: { role: 'dark', area: [0.06, 2.6], gap: [1.2, 4.5], specks: { dark: 2.8 } },
  wear: {
    on: ['tunic'],
    chin: 3,
    marks: [
      [
        ['scuff', 0.5, 0.35, 0.75],
        ['scuff', 0.3, 0.75, 0.6],
      ],
      [
        ['scorch', 0.55, 0.4, 0.8],
        ['scorch', 0.3, 0.72, 0.6],
      ],
    ],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2.2, 0.9], offset: [-0.3, -0.6] }],
  face: { r: 0.85, iris: '#4a3428', mark: 1.1 },
  gait: { bounce: [0.15, 0.8], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 26 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    // A shade small for the box: the falling arm flung out goes past its width, the wall drawing past its top.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box', scale: 0.95 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.95 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3], eyes: false },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/warrior/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: {
      pose: `standing smug with his arms crossed over the top of his huge belly, the roast leg held in one fist sticking out in front past his arm, his chin up; ${KEEP}.`,
    },
    'walk-1': {
      pose: `waddling heavily and proudly to the right, mid-step, his belly leading, the near boot forward and the far boot back, leaning back a little; ${KEEP}.`,
    },
    'walk-2': { pose: `waddling to the right, the legs passing under the belly, one boot planted flat and the other lifted a little; ${KEEP}.` },
    'run-1': {
      pose: `running fast to the right, leaning forward, his belly bouncing, one knee high and the other leg pushing off behind, the roast leg thrust out level in front like a club, the free arm pumping behind; ${KEEP}.`,
    },
    'run-2': {
      pose: `running fast to the right, leaning forward, both boots off the ground with the short legs gathered up under the belly, the roast leg held out level in front; ${KEEP}.`,
    },
    'air-1': {
      pose: `jumping up, both short legs tucked up under his belly, the roast leg held out level in front, the free arm flung out behind, determined; ${KEEP}.`,
    },
    'air-2': {
      pose: `falling, his short legs reaching down, the free arm flailing up and out behind, the roast leg still held out in front, his eyes wide and his mouth open in alarm; ${KEEP}.`,
    },
    wall: {
      pose: 'seen from his side, facing right: he is sliding down a tall wall on the right edge of his space (do not draw the wall), his belly and one free hand pressed flat against it and both boots braced on it, the roast leg held out behind him in his other hand, his head turned to look back at us, his eyes open.',
      far: true,
    },
    cheer: {
      pose: `cheering in triumph, the roast leg thrust up and forward at arm's length in front of him, his free fist on his hip, up on his toes, a huge open grin under the moustache; ${KEEP}.`,
    },
    cheer2: {
      pose: `laughing a big belly laugh, leaning back, his free hand slapping his huge belly, the roast leg held out in front, his eyes squeezed shut; ${KEEP}.`,
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, his head on the left and his boots on the right, his huge belly sticking up like a hill, his arms and legs splayed limp, the pot still on his head, the roast leg dropped beside him, his eyes shut. Seen from the side.',
      far: true,
    },
  },
};
