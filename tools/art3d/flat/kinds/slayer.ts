import type { FlatKind } from '../kinds';

// Tall and lean in a long coat, the white hair tied back, and a sword and a furled umbrella (the twist) slung together
// over one shoulder, their handles up behind it. One each side of the head, the hilts read as horns in two blind
// reads; together over one shoulder they don't. Every pose keeps them clear of the head. The poses were drawn three
// to a 16:9 image with the design as the reference and cut apart (art/sprites/slayer/design.prompt.txt), then
// whites.py tinted the hair in each.
const KEEP =
  "the sword and the furled umbrella always slung together over one shoulder only, their two handles, the sword's cross-guard hilt and the umbrella's hooked crook, sticking far up and back together behind his back shoulder and clear of his head, their two tips poking out together below his coat at the other hip, nothing over the other shoulder, the white ponytail hanging down his back, the round bottle cap on his chest, his eyes open";

export const kind: FlatKind = {
  body: 178,
  map: {
    roles: ['black', 'steel', 'hair', 'coat', 'leather', 'skin', 'eye', 'dark'],
    // Sampled from the design (art/sprites/slayer/design.png, `swatch.py`) and its run and fall drawings.
    families: [
      // The coat, its cel shade and the collar's; the sword's grip is drawn in the coat's shade, so it is the coat.
      ['coat', [86, 94, 81]],
      ['coat', [84, 89, 79]],
      ['coat', [85, 92, 81]],
      ['coat', [84, 92, 78]],
      ['coat', [88, 95, 83]],
      ['coat', [87, 89, 80]],
      ['coat', [80, 85, 77]],
      ['coat', [83, 90, 75]],
      ['coat', [86, 89, 76]],
      ['coat', [72, 74, 66]],
      ['coat', [61, 65, 59]],
      ['coat', [66, 71, 65]],
      ['coat', [62, 67, 61]],
      ['coat', [63, 67, 65]],
      ['coat', [60, 65, 57]],
      ['coat', [69, 76, 65]],
      ['coat', [65, 67, 58]],
      // Gloves, boots and the shoelace: one leather (the gloves and boots repainted brown in the design, so their
      // colour stays apart from the coat's shade).
      ['leather', [84, 56, 38]],
      ['leather', [86, 60, 40]],
      ['leather', [62, 45, 35]],
      ['leather', [58, 39, 31]],
      ['leather', [78, 52, 39]],
      ['leather', [70, 60, 51]],
      ['leather', [113, 88, 75]],
      ['leather', [96, 75, 66]],
      // The furled umbrella, the trousers under the coat and the soles: neutral dark cloth.
      ['black', [53, 51, 55]],
      ['black', [59, 55, 62]],
      ['black', [45, 43, 53]],
      ['black', [55, 55, 57]],
      ['black', [50, 49, 46]],
      ['black', [51, 51, 48]],
      ['black', [68, 68, 59]],
      ['black', [62, 61, 56]],
      ['black', [43, 43, 44]],
      // The sword's cross and pommel, the bottle cap and the broken spoke.
      ['steel', [179, 184, 188]],
      ['steel', [175, 182, 190]],
      ['steel', [162, 169, 176]],
      ['steel', [183, 191, 194]],
      ['steel', [168, 173, 180]],
      ['steel', [155, 158, 163]],
      ['steel', [186, 186, 187]],
      ['steel', [128, 132, 140]],
      ['steel', [119, 119, 129]],
      ['steel', [100, 102, 112]],
      ['steel', [103, 104, 97]],
      ['steel', [107, 104, 98]],
      // The hair as whites.py tints it (20 under the drawing's), so `holes` leaves it, and as drawn.
      ['hair', [222, 222, 221]],
      ['hair', [224, 223, 221]],
      ['hair', [213, 207, 203]],
      ['hair', [242, 242, 241]],
      ['hair', [233, 227, 214]],
      ['hair', [233, 223, 217]],
      ['hair', [207, 197, 193]],
      ['skin', [242, 204, 183]],
      ['skin', [238, 213, 197]],
      ['skin', [233, 202, 186]],
      ['skin', [222, 197, 183]],
      ['skin', [191, 155, 145]],
      ['skin', [129, 119, 116]],
      // The yellow of the cat's eyes, a role of its own: the landmark the face kit finds them by, since the slit
      // pupils are thinner than the ink.
      ['eye', [228, 210, 106]],
      ['eye', [184, 168, 112]],
      ['dark', [255, 255, 255]],
      ['dark', [26, 22, 30]],
      ['dark', [28, 26, 34]],
      ['dark', [17, 15, 23]],
      ['dark', [31, 29, 37]],
      ['dark', [35, 34, 42]],
      ['dark', [4, 3, 8]],
      ['dark', [12, 10, 16]],
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
    // Smaller in the air: the fall's flung-up ponytail over the hilts reached past the box's top.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box', scale: 0.92 },
    // Smaller on the wall: the hilts over his raised shoulder reached past the box's top.
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.9 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/slayer/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    // Not reaching up for the hilt: an arm raised to the shoulder read as "arms raised" in the first blind read.
    idle2: { pose: `standing wary, his head turned a little toward us, one gloved hand resting on the bottle cap on his chest; ${KEEP}.` },
    'walk-1': {
      pose: `prowling to the right, mid-step, the near boot forward and the far boot back, leaning a little forward, his gloved hands low and ready; ${KEEP}.`,
    },
    'walk-2': { pose: `prowling to the right, the legs passing under the body, one boot planted and the other just lifted, his hands low and ready; ${KEEP}.` },
    'run-1': {
      pose: `running fast to the right, leaning forward, one knee high and the other leg pushing off far back, the arms pumping, the coat tails flying out behind him; ${KEEP}.`,
    },
    'run-2': {
      pose: `running fast to the right, leaning forward, both boots off the ground with the legs gathered under him, the coat tails flying out behind; ${KEEP}.`,
    },
    'air-1': { pose: `jumping up, both knees tucked up high, the arms out to the sides, the coat flaring out below; ${KEEP}.` },
    'air-2': {
      pose: `falling, both legs reaching straight down, both arms out to the sides for balance, the coat tails flapping up, his eyes wide and his mouth open in alarm; ${KEEP}.`,
    },
    wall: {
      pose: 'seen from his side, facing right: he is sliding down a tall wall on the right edge of his space (do not draw the wall), one gloved hand flat against it and both boots braced on it, his coat hanging down, his head turned to look back at us, his eyes open.',
      far: true,
    },
    cheer: {
      pose: `cheering, one gloved fist punched straight forward out in front of him at shoulder height, never above his head, a grim little grin; ${KEEP}.`,
    },
    cheer2: { pose: `standing with his arms folded across his chest, a small satisfied smirk, turned a little toward us; ${KEEP}.` },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, his head on the left and his boots on the right, arms and legs splayed limp, his eyes shut. Seen from the side.',
      far: true,
    },
  },
};
