import type { FlatKind } from '../kinds';

// Every pose but the design is cut from the design itself (art/sprites/miner/design.prompt.txt): he's a wooden
// toy, every limb a rigid block on a dowel, so a pose is the design's own blocks turned about their joints.
// The poses' prompts are what the image model would be asked for when the allowance allows a redraw.
const TOY = "His arms and legs stay straight blocks that swing stiffly from the shoulder and hip like a wooden toy's, never bending at an elbow or a knee.";
const PICK = 'the taped wooden pickaxe held as in the reference, its head up clear of his cube head';

export const kind: FlatKind = {
  body: 208,
  map: {
    roles: ['skin', 'side', 'flake', 'shirt', 'trousers', 'hair', 'grey', 'handle', 'dark'],
    // Sampled from the design (`swatch.py`). The cube's side face is a role of its own: folded into the face's
    // wood, the head was a flat square, and two faces showing is what makes it a cube.
    families: [
      ['skin', [232, 171, 117]],
      ['skin', [233, 173, 118]],
      ['skin', [218, 153, 105]],
      ['side', [199, 127, 84]],
      ['side', [200, 128, 85]],
      ['side', [177, 131, 104]],
      // The bare wood where the shirt's paint has flaked off.
      ['flake', [235, 189, 144]],
      ['shirt', [37, 189, 42]],
      ['shirt', [32, 140, 42]],
      ['shirt', [80, 166, 84]],
      ['shirt', [34, 163, 42]],
      ['trousers', [40, 42, 100]],
      ['trousers', [59, 63, 138]],
      ['trousers', [29, 33, 69]],
      ['trousers', [51, 50, 95]],
      ['trousers', [48, 76, 101]],
      ['hair', [61, 39, 23]],
      ['hair', [76, 50, 30]],
      ['hair', [57, 40, 33]],
      // The pickaxe's head, its tape and the shoes: one grey in the drawing.
      ['grey', [154, 153, 153]],
      ['grey', [112, 109, 117]],
      ['handle', [158, 106, 65]],
      ['handle', [109, 77, 61]],
      ['dark', [37, 9, 9]],
      ['dark', [51, 10, 7]],
      ['dark', [54, 22, 19]],
      // The square eyes, white and violet, go to the ink so each traces as one dark square for the face kit.
      ['dark', [255, 255, 255]],
      ['dark', [100, 90, 176]],
    ],
    line: 'dark',
    thin: ['skin', 'side', 'flake', 'shirt', 'trousers', 'hair', 'grey', 'handle'],
    fringe: 5,
    stroke: 2.4,
    feet: ['grey'],
    loose: ['handle'],
    holes: 0.5,
    // No corner cutting: rounded, the cube head traced as a ball under a mop of hair.
    smooth: 0,
  },
  roles: [
    // Bare birch for skin, and the cube's side face a darker grain: neutrals. Pale, so a yellow or orange
    // shirt doesn't run into the wood.
    { name: 'skin', color: '#e8c89c' },
    { name: 'side', color: '#c49a6c' },
    { name: 'flake', color: '#f2dcb8' },
    // The painted T-shirt is the costume, in the player's colour.
    { name: 'shirt', color: '#3fb0b0', slot: 'player' },
    // The trousers, a dark of it: shirt over darker trousers is the outfit's colour block.
    { name: 'trousers', color: '#808080', on: 3, tone: -22 },
    // A colourway is the hair (VARIETY.palette): dark brown, chestnut, ash.
    { name: 'hair', color: '#4a3020', alts: ['#6b4426', '#5c5650'], vary: 6 },
    { name: 'grey', color: '#8a8c92' },
    { name: 'handle', color: '#8a5c34' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear on the shirt and trousers: a faded patch, and soot. The trousers' marks are tones of the shirt
    // (the trousers' -22, then ±): a tone of a tone isn't one.
    { name: 'scuff', color: '#808080', on: 3, tone: 12 },
    { name: 'scuff2', color: '#808080', on: 3, tone: -10 },
    { name: 'scorch', color: '#808080', on: 3, tone: -16 },
    { name: 'scorch2', color: '#808080', on: 3, tone: -36 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', area: [0.3, 1.6], gap: [1.4, 3.2], specks: { dark: 2 } },
  wear: {
    on: ['shirt', 'trousers'],
    chin: 4,
    marks: [
      [
        ['scuff', 0.35, 0.4, 0.9],
        ['scuff2', 0.6, 0.55, 0.5],
      ],
      [
        ['scorch', 0.45, 0.35, 1.0],
        ['scorch2', 0.4, 0.6, 0.5],
      ],
    ],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.6, 0.8] }],
  face: { r: 0.8, iris: '#4a3cae' },
  // Stiff-limbed: a small hop on each step and almost no lean, the toy rocking upright.
  gait: { bounce: [0.1, 0.55], lean: [0, 0.02] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200] },
    wall: { frames: ['wall'], loop: true, fps: 1 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  poses: {
    idle2: { pose: `standing to attention, his feet together, the pickaxe raised upright beside his shoulder. ${TOY}` },
    'walk-1': {
      pose: `walking to the right, mid-step: the near leg swung straight forward, the far leg straight back, the free arm swung straight the other way, ${PICK}. ${TOY}`,
    },
    'walk-2': { pose: `walking to the right, the legs passing under the body: both legs straight and nearly together, ${PICK}. ${TOY}` },
    'run-1': {
      pose: `running fast to the right, leaning forward, the legs swung far apart in a wide straight scissor, the free arm swung straight forward, ${PICK}. ${TOY}`,
    },
    'run-2': {
      pose: `running fast to the right, leaning forward, the straight legs swung the opposite way, the free arm swung straight back, ${PICK}. ${TOY}`,
    },
    'air-1': { pose: `jumping up, the pickaxe raised high beside his head, the free arm straight out behind him, the straight legs together. ${TOY}` },
    'air-2': { pose: `falling, the free arm flung up and back, the pickaxe still in his other hand, the straight legs spread wide. ${TOY}` },
    wall: {
      pose: `sliding down a tall wall on the right edge of the picture (do not draw the wall), the free arm raised, one straight leg braced out against it, ${PICK}. ${TOY}`,
      far: true,
    },
    cheer: { pose: `cheering, the pickaxe thrust up high beside his head, the free arm raised up, his feet together. ${TOY}` },
    cheer2: { pose: `tipped back on his heel laughing, the free arm straight out behind him, the pickaxe raised beside his shoulder. ${TOY}` },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor like a toppled wooden toy, the whole body horizontal across the picture, the cube head on the left and the shoes on the right, his straight block limbs stiff, eyes shut, the pickaxe dropped beside him. One figure only, seen from the side.',
      far: true,
    },
  },
};
