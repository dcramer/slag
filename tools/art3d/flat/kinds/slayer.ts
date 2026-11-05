import type { FlatKind } from '../kinds';

// Broad-shouldered in a short coat over two legs in tall boots, a long silver sword in his hand held low in a guard,
// and two straight hilts side by side above his back shoulder: the steel sword's and the umbrella's wooden knob (the
// twist). The first version (a long coat, flowing hair, a slim figure) read as a princess in a gown in a full-cast
// blind read; it is in art/sprites/slayer/r1/. The poses were drawn three to a 16:9 image with the design as the
// reference and cut apart (art/sprites/slayer/design.prompt.txt), then whites.py tinted the hair in each.
const KEEP =
  "the two straight hilts, the steel sword's cross-guard hilt and the umbrella's wooden knob handle, always side by side above his back shoulder and well clear of his head, his white hair tied back tight in a short tail, the round bottle cap on his chest, the long straight silver sword always in his hand, his eyes open";

export const kind: FlatKind = {
  body: 214,
  map: {
    roles: ['black', 'steel', 'hair', 'coat', 'leather', 'skin', 'eye', 'dark'],
    // Sampled from the design (art/sprites/slayer/design.png, `swatch.py`); the first version's are in r1/.
    families: [
      // The coat and its cel shade. The trousers under it are drawn in the coat's shade, so they are the coat too,
      // and so is the sword's grip.
      ['coat', [83, 90, 73]],
      ['coat', [79, 84, 69]],
      ['coat', [84, 87, 73]],
      ['coat', [82, 85, 71]],
      ['coat', [77, 79, 67]],
      ['coat', [80, 88, 71]],
      ['coat', [88, 88, 76]],
      ['coat', [83, 81, 70]],
      ['coat', [95, 98, 86]],
      ['coat', [56, 56, 51]],
      ['coat', [58, 59, 52]],
      ['coat', [61, 63, 55]],
      ['coat', [66, 71, 65]],
      // Gloves, boots, the shoelace and the umbrella's handle: one leather, all drawn in the same brown.
      ['leather', [73, 46, 35]],
      ['leather', [84, 58, 45]],
      ['leather', [80, 50, 40]],
      ['leather', [73, 63, 55]],
      ['leather', [62, 45, 35]],
      // The soles and the umbrella's furled cloth.
      ['black', [43, 43, 44]],
      ['black', [45, 43, 53]],
      ['black', [49, 43, 44]],
      // The swords' blades, cross-guards and pommels, and the bottle cap.
      ['steel', [182, 183, 184]],
      ['steel', [167, 164, 167]],
      ['steel', [133, 132, 135]],
      ['steel', [141, 142, 139]],
      ['steel', [159, 144, 143]],
      ['steel', [165, 164, 168]],
      ['steel', [183, 191, 194]],
      ['steel', [119, 119, 129]],
      // The hair as whites.py tints it (20 under the drawing's), so `holes` leaves it, and as drawn.
      ['hair', [222, 222, 221]],
      ['hair', [227, 225, 222]],
      ['hair', [242, 242, 241]],
      ['skin', [230, 196, 181]],
      ['skin', [242, 204, 183]],
      ['skin', [222, 197, 183]],
      ['skin', [191, 155, 145]],
      // The yellow of the cat's eyes, a role of its own: the landmark the face kit finds them by, since the slit
      // pupils are thinner than the ink.
      ['eye', [228, 210, 106]],
      ['eye', [184, 168, 112]],
      ['dark', [255, 255, 255]],
      ['dark', [32, 27, 30]],
      ['dark', [27, 21, 24]],
      ['dark', [45, 30, 32]],
      ['dark', [22, 12, 15]],
      ['dark', [8, 4, 6]],
    ],
    line: 'dark',
    // Not the eyes' yellow: a narrow almond is as thin as the ink's fringe, and went with it.
    thin: ['black', 'steel', 'hair', 'coat', 'leather', 'skin'],
    fringe: 5,
    stroke: 2.4,
    ink: 5,
    feet: ['leather', 'black'],
    min: { dark: 0.1, steel: 0.2, leather: 0.2 },
    holes: 0.6,
  },
  roles: [
    { name: 'black', color: '#3e3e44' },
    // A colourway is the steel: the sword's cross, the bottle cap and the spoke (VARIETY.palette): bright steel, old
    // iron or a brass-painted cap. Neutrals only.
    { name: 'steel', color: '#b4bac2', alts: ['#8c8e92', '#bca878'], vary: 6 },
    { name: 'hair', color: '#f2f0ec' },
    // The coat is the costume, in the player's colour; the gloves and boots a dark of it, as dyed leather.
    { name: 'coat', color: '#5a6250', slot: 'player' },
    { name: 'leather', color: '#808080', on: 3, tone: -26 },
    { name: 'skin', color: '#f0cbb2' },
    { name: 'eye', color: '#e0c850' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'scuff', color: '#808080', on: 3, tone: 14 },
    { name: 'scorch', color: '#808080', on: 3, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // The near eye by its yellow; the far one, turned three-quarter, is close to the cheek's outline, so it's set from
  // the near one at the design's spacing.
  eyes: { role: 'eye', from: 'map', area: [0.08, 1.4], gap: [0.8, 2.6], band: [0.08, 0.34], count: 1, pair: [1.4, 0.1], specks: { eye: 1.6, dark: 1 } },
  wear: {
    on: ['coat'],
    chin: 3,
    marks: [
      [
        ['scuff', 0.55, 0.52, 0.4],
        ['scuff', 0.42, 0.64, 0.32],
      ],
      [
        ['scorch', 0.55, 0.5, 0.4],
        ['scorch', 0.42, 0.64, 0.32],
      ],
    ],
  },
  // The plaster goes over the scar on his cheek.
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.8, 0.75] }],
  // Cat's eyes: yellow almonds round a slit (`cat` in the face kit's EYES). Three-quarter, the far eye is the kit's
  // sliver behind the near one.
  face: { r: 0.75, iris: '#e0b830', mark: 0.55, eye: 'cat' },
  gait: { bounce: [0.1, 0.5], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 44 },
    // Smaller in the air: the hilts over the shoulder reached past the box's top.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box', scale: 0.88 },
    // Smaller on the wall: the hilts over his raised shoulder reached past the box's top.
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.9 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    // Smaller knocked out: lying flat with the dropped sword beside him, he was wider than the box.
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.85 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/slayer/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: {
      pose: `standing wary in a wide stance, one gloved hand resting on the bottle cap on his chest, the silver sword held low in the other hand pointing at the ground; ${KEEP}.`,
    },
    'walk-1': {
      pose: `prowling to the right in a wide stance, mid-step, the front boot forward and the back boot back, the silver sword held low in front of him; ${KEEP}.`,
    },
    'walk-2': {
      pose: `prowling to the right, the legs passing under the body, one boot planted and the other just lifted, the silver sword held low; ${KEEP}.`,
    },
    'run-1': {
      pose: `running fast to the right, leaning forward, one knee high and the other leg pushing off far back, the silver sword held low and trailing out behind him, its blade clear of his legs; ${KEEP}.`,
    },
    'run-2': {
      pose: `running fast to the right, leaning forward, both boots off the ground with the legs gathered under him, the silver sword trailing out behind; ${KEEP}.`,
    },
    'air-1': { pose: `leaping up, both knees tucked up high, the silver sword held out level to the side, clear of his body; ${KEEP}.` },
    'air-2': {
      pose: `falling, both legs reaching straight down, his free arm out to the side for balance, the silver sword held out to the other side, his eyes wide and his mouth open in alarm; ${KEEP}.`,
    },
    // Drawn facing left with the wall on the left, and mirrored.
    wall: {
      pose: 'seen from his side, facing right: he is sliding down a tall wall on the right edge of his space (do not draw the wall), one gloved hand flat against it and both boots braced on it, the silver sword hanging down in his other hand, his head turned to look back at us, his eyes open.',
      far: true,
    },
    cheer: {
      pose: `cheering, his free gloved fist punched straight forward at shoulder height, never above his head, the silver sword held low in the other hand, a grim little grin; ${KEEP}.`,
    },
    cheer2: {
      pose: `standing in a wide stance resting the flat of the silver sword on his front shoulder, its blade pointing up and back, his other hand on his hip, a smirk; ${KEEP}.`,
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, his head on the left and his boots on the right, arms and legs splayed limp, the silver sword dropped beside him, his eyes shut. Seen from the side.',
      far: true,
    },
  },
};
