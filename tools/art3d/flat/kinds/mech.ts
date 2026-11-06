import type { FlatKind } from '../kinds';

// Every pose keeps what carries her (art/sprites/mech/design.prompt.txt): the mech is the outline, she is its crest. The
// wide flat washing-machine body, the two long duct cannons jutting far forward with a band of background between them,
// the thick mech legs, and her small head in big headphones over its top. Round-bodied with its ducts curled in at its
// sides, the first design traced at 22 px as a ball on stubs; with its body as tall as it was wide and its
// two ducts close together, the first drawn set read as "a hunched, bulky figure" (r1/). So the body is half
// again as wide and the ducts twice as long and far apart.
const KEEP =
  "always the wide flat pink washing-machine body much wider than tall, the two long straight grey duct cannons sticking far forward, one high and one low with a wide band of white between them, the thick grey mech legs, and the pilot's small head with headphones and long brown hair over its top";

export const kind: FlatKind = {
  body: 262,
  map: {
    roles: ['shell', 'panel', 'trim', 'metal', 'plate', 'glass', 'hair', 'skin', 'white', 'dark'],
    // Sampled from the design (art/sprites/mech/design.png, `swatch.py` and by hand).
    families: [
      // The shell's side, its shade and the dent's.
      ['shell', [205, 88, 141]],
      ['shell', [207, 86, 141]],
      ['shell', [206, 91, 142]],
      ['shell', [195, 86, 135]],
      ['shell', [194, 95, 139]],
      ['shell', [199, 100, 144]],
      ['shell', [163, 60, 107]],
      ['shell', [201, 82, 138]],
      ['shell', [144, 55, 90]],
      ['shell', [193, 74, 129]],
      // The front, a light of it.
      ['panel', [233, 124, 166]],
      ['panel', [234, 129, 168]],
      ['panel', [224, 128, 162]],
      ['panel', [228, 124, 164]],
      ['panel', [223, 122, 161]],
      ['panel', [201, 126, 152]],
      // The pale strips along the top and the bottom of the front.
      ['trim', [248, 190, 216]],
      ['trim', [247, 192, 197]],
      ['trim', [204, 130, 165]],
      // The legs, the ducts and the porthole's rim.
      ['metal', [164, 171, 175]],
      ['metal', [162, 168, 172]],
      ['metal', [185, 182, 191]],
      ['metal', [148, 150, 156]],
      ['plate', [125, 122, 133]],
      ['plate', [118, 116, 129]],
      ['plate', [117, 114, 126]],
      ['plate', [89, 87, 96]],
      ['plate', [81, 79, 85]],
      ['plate', [112, 102, 115]],
      // The porthole's glass and the laundry behind it.
      ['glass', [92, 108, 121]],
      ['glass', [101, 107, 119]],
      ['glass', [151, 110, 131]],
      ['hair', [95, 66, 53]],
      ['hair', [100, 64, 40]],
      ['hair', [70, 41, 42]],
      ['hair', [109, 64, 55]],
      ['hair', [60, 35, 37]],
      ['skin', [245, 199, 165]],
      ['skin', [248, 198, 194]],
      // The headphones, the sock in the door and the bunny patch.
      ['white', [253, 253, 251]],
      ['white', [232, 227, 233]],
      ['white', [214, 204, 200]],
      ['white', [207, 174, 193]],
      ['white', [219, 215, 219]],
      ['white', [200, 187, 191]],
      ['dark', [16, 6, 20]],
      ['dark', [5, 1, 10]],
      ['dark', [24, 18, 30]],
      ['dark', [25, 4, 19]],
    ],
    line: 'dark',
    thin: ['shell', 'panel', 'trim', 'metal', 'plate', 'glass', 'hair', 'skin', 'white'],
    fringe: 5,
    stroke: 2.4,
    feet: ['metal', 'plate'],
    min: { dark: 0.4, trim: 0.4, white: 0.3 },
  },
  roles: [
    // The costume: the shell in the player's colour, the front a light of it and its pale strips a lighter one.
    { name: 'shell', color: '#cd588d', slot: 'player' },
    { name: 'panel', color: '#808080', on: 0, tone: 18 },
    { name: 'trim', color: '#808080', on: 0, tone: 36 },
    // A colourway is the metal (VARIETY.palette): a steel, a gunmetal or a pale aluminium. Neutrals only.
    { name: 'metal', color: '#a4abaf', alts: ['#8e9296', '#bcbfc2'], vary: 6 },
    { name: 'plate', color: '#77747f' },
    { name: 'glass', color: '#8fa6b8' },
    { name: 'hair', color: '#5f4235' },
    { name: 'skin', color: '#f5c7a5' },
    { name: 'white', color: '#f6f4f0' },
    { name: 'dark', color: '#1c1020' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', from: 'map', area: [0.1, 1.8], gap: [0.8, 3.5], band: [0.02, 0.3], edge: 0.2, specks: { dark: 2 } },
  wear: {
    on: ['shell'],
    chin: 7,
    marks: [[['scuff', 0.25, 0.55, 0.3]], [['scorch', 0.3, 0.68, 0.3]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.2, 0.5] }],
  // Her drawing's eyes are small black ovals, no white: the kit's `dot`.
  face: { r: 0.5, iris: '#1c1020', eye: 'dot', far: 'turned' },
  gait: { bounce: [0.4, 0.9], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.6, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 26 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 38 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200] },
    // Smaller on the wall: the cannons pointing up along it reach over the box's top.
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.86 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25], eyes: false },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.7, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/mech/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing with its weight on one leg, the other foot lifted to tap, the pilot looking up, ${KEEP}.` },
    'walk-1': { pose: `stomping to the right, the near leg stepping far forward, the far leg back, ${KEEP}.` },
    'walk-2': { pose: `stomping to the right, one heavy foot planted and the other lifted high, the body tipped forward, ${KEEP}.` },
    'run-1': { pose: `running fast to the right, the body tipped forward, the near leg reaching far ahead and the far leg kicking back, ${KEEP}.` },
    'run-2': { pose: `running to the right mid-stride, both feet off the ground, the legs split front and back, ${KEEP}.` },
    'air-1': { pose: `a boost hop straight up, both legs tucked up tight under the body, ${KEEP}.` },
    'air-2': { pose: `falling, both legs reaching down and apart, the body tipped back, the pilot's eyes wide, ${KEEP}.` },
    wall: {
      pose: "seen from its side, it is sliding down a tall wall that is just to its right (do not draw the wall): both mech feet braced flat against the wall, the legs bent, the two long cannons pointing up along the wall, the pilot's head turned to look back at us, eyes open.",
      far: true,
    },
    cheer: {
      pose: `hopping for joy, both feet off the ground and kicked apart, both duct cannons swung up pointing at the sky, the pilot's eyes squeezed happily shut, ${KEEP}.`,
    },
    cheer2: {
      pose: `standing, the pilot has risen up out of the top to her waist, one arm out making a peace sign beside her face, a big grin, eyes open, ${KEEP}.`,
    },
    death: {
      pose: "knocked out, the wide washing-machine mech has toppled over and lies flat on its side on the floor, horizontal, the pilot's head on the floor at the left with her eyes shut, the grey mech legs sticking out limp on the right, the cannons limp.",
      far: true,
    },
  },
};
