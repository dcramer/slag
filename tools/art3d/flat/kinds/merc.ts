import type { FlatKind } from '../kinds';

// Every pose keeps the bread knife in his hand, never on his back (the plumber's plunger owns the back), and
// low: tip-down beside him or trailing behind, never raised over the spikes, which would push it out of the box.
const KNIFE = 'the giant serrated bread knife in his hand, never on his back';

export const kind: FlatKind = {
  body: 177,
  map: {
    roles: ['skin', 'top', 'pants', 'hair', 'singe', 'brown', 'hub', 'steel', 'dark'],
    // Sampled from the design (art/sprites/merc/design.png, `swatch.py`), and from the one before its hair and
    // knife were made bigger.
    families: [
      ['skin', [254, 199, 147]],
      ['skin', [254, 200, 151]],
      ['skin', [235, 196, 160]],
      ['skin', [217, 138, 107]],
      ['skin', [249, 197, 128]],
      ['skin', [247, 191, 129]],
      ['skin', [181, 122, 90]],
      ['top', [69, 94, 170]],
      ['top', [79, 85, 130]],
      ['pants', [42, 52, 101]],
      ['pants', [42, 49, 87]],
      ['pants', [50, 52, 90]],
      ['pants', [54, 57, 90]],
      ['pants', [22, 25, 55]],
      ['pants', [37, 36, 59]],
      ['pants', [40, 47, 92]],
      ['pants', [39, 43, 76]],
      ['pants', [52, 47, 74]],
      ['pants', [28, 24, 44]],
      ['hair', [239, 205, 111]],
      ['hair', [233, 205, 112]],
      ['hair', [236, 207, 122]],
      ['hair', [226, 201, 135]],
      ['hair', [220, 180, 120]],
      ['hair', [203, 154, 82]],
      ['hair', [238, 201, 95]],
      ['hair', [202, 147, 78]],
      ['hair', [208, 163, 94]],
      ['hair', [235, 208, 145]],
      // Belts, boots and the knife's handle: leather and wood, one brown in the drawing.
      ['brown', [114, 75, 50]],
      ['brown', [128, 94, 69]],
      ['brown', [106, 76, 59]],
      ['brown', [70, 48, 38]],
      ['brown', [107, 67, 44]],
      ['brown', [124, 99, 81]],
      ['brown', [76, 44, 26]],
      ['brown', [160, 112, 72]],
      // The hubcap, darker than the blade, so the two stay two shapes.
      ['hub', [163, 156, 146]],
      ['hub', [166, 170, 176]],
      ['hub', [132, 138, 144]],
      ['hub', [117, 118, 130]],
      ['hub', [104, 108, 120]],
      ['hub', [173, 164, 153]],
      // The singed tips of the spikes, and their edge into the blond: as ink or the boots' brown, they were
      // specks round each tip.
      ['singe', [40, 40, 36]],
      ['singe', [48, 40, 40]],
      ['singe', [96, 84, 52]],
      ['singe', [140, 118, 62]],
      ['steel', [192, 196, 202]],
      ['steel', [189, 191, 198]],
      ['steel', [226, 224, 224]],
      ['steel', [193, 191, 196]],
      ['dark', [255, 255, 255]],
      ['dark', [9, 3, 13]],
      ['dark', [16, 12, 28]],
      ['dark', [34, 24, 36]],
    ],
    line: 'dark',
    thin: ['skin', 'top', 'pants', 'hair', 'singe', 'brown', 'hub', 'steel'],
    fringe: 5,
    stroke: 2.4,
    // The poses are cut from sheets of three, drawn smaller than the design: at the default, their pupils traced as
    // lines and half the poses had no eyes to find.
    ink: 5,
    feet: ['brown'],
    // The knife is left out of his size, so every pose is sized by the body alone.
    loose: ['steel'],
    min: { dark: 0.1, hub: 0.3 },
    holes: 0.6,
  },
  roles: [
    { name: 'skin', color: '#f0cfa8' },
    // The sleeveless knit top is the costume, in the player's colour, and the trousers a dark of it near enough to
    // read as the same colour: at −24 they were dark trousers, and at play scale he was blond hair and a grey
    // blade. The crossed belts between them keep the two shapes apart.
    { name: 'top', color: '#4a5ab0', slot: 'player' },
    { name: 'pants', color: '#808080', on: 1, tone: -12 },
    { name: 'hair', color: '#f0d470' },
    { name: 'singe', color: '#3e3834' },
    // Belts, boots and the knife's handle, a deep dark of the top: dyed leather, so the whole outfit is his colour.
    { name: 'brown', color: '#808080', on: 1, tone: -32 },
    // A colourway is the hubcap (VARIETY.palette): chrome, a gunmetal or a gold-painted cap. Neutrals only.
    { name: 'hub', color: '#9aa0a8', alts: ['#6b7078', '#b8a070'], vary: 6 },
    { name: 'steel', color: '#c9ccd2' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'scuff', color: '#808080', on: 1, tone: 14 },
    { name: 'scuff2', color: '#808080', on: 1, tone: -12 },
    { name: 'scorch', color: '#808080', on: 1, tone: -18 },
    { name: 'scorch2', color: '#808080', on: 1, tone: -38 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // The near eye from the role map; the far one sits on the face's outline under the fringe, so it's set from it.
  // The band stops above the mouth and `area` under the far eye where it runs into the fringe's ink: the wall
  // slide's eye sat on his teeth, and the cheer's on the far eye, its sliver on his arm.
  eyes: { role: 'dark', from: 'map', area: [0.06, 1], gap: [1.6, 4.2], band: [0.2, 0.37], specks: { dark: 2, brown: 1.2 }, count: 1, pair: [2.9, 0] },
  wear: {
    on: ['top', 'pants'],
    chin: 3,
    marks: [
      [
        ['scuff', 0.5, 0.5, 0.5],
        ['scuff2', 0.45, 0.6, 0.5],
      ],
      [
        ['scorch', 0.5, 0.5, 0.5],
        ['scorch2', 0.4, 0.62, 0.5],
      ],
    ],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.8, 0.75] }],
  face: { r: 0.8, iris: '#4fa8c8', eye: 'heavy' },
  gait: { bounce: [0.1, 0.6], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 44 },
    // Smaller in the air: the falling drawing's raised arm and the spikes over it reached past the box's top.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box', scale: 0.88 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.94 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  poses: {
    idle2: {
      pose: `standing with his arms folded across his chest, brooding, the bread knife standing tip-down in the ground beside him on its own; ${KNIFE}.`,
    },
    'walk-1': {
      pose: `walking to the right, mid-step, the near boot forward and the far boot back, the bread knife held by its handle down at his side, its blade slanting back steeply behind him, its tip just off the ground behind his heels; ${KNIFE}.`,
    },
    'walk-2': {
      pose: `walking to the right, the legs passing under the body, one boot planted and the other lifted a little, the bread knife held the same way; ${KNIFE}.`,
    },
    'run-1': {
      pose: `running fast to the right in a low lope, leaning forward, one knee high and the other leg pushing off, the free arm pumping, the bread knife held low in the other hand behind his hip, its blade trailing back behind him, its tip dragging on the ground behind his heels; ${KNIFE}.`,
    },
    'run-2': {
      pose: `running fast to the right in a low lope, leaning forward, both boots off the ground with the legs gathered under him, the bread knife held low behind his hip, its blade trailing back behind him; ${KNIFE}.`,
    },
    'air-1': {
      pose: `jumping up mid-spin with his knees tucked, the bread knife swung round low behind him in a slash, its blade level with his boots; ${KNIFE}.`,
    },
    'air-2': {
      pose: `falling, the legs reaching down, the free arm flung up, the bread knife pointing down beside him in the other hand, the mouth open in alarm; ${KNIFE}.`,
    },
    wall: {
      pose: `seen from his side, he is sliding down a tall wall on the right edge of the picture (do not draw the wall), the free hand flat against it and both boots braced on it, the bread knife hanging down below him in his other hand, his head turned to look back at us; ${KNIFE}.`,
      far: true,
    },
    cheer: {
      pose: `cheering, one fist punched up beside his spikes, the other hand on the handle of the bread knife standing tip-down beside him, a cocky grin; ${KNIFE}.`,
    },
    cheer2: {
      pose: `leaning on the bread knife standing tip-down beside him, one elbow on its handle, the other hand on his hip, a smirk, turned a little toward us; ${KNIFE}.`,
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal across the picture, head on the left and boots on the right, arms and legs splayed limp, eyes shut, the bread knife dropped flat on the floor beside him. Seen from the side.',
      far: true,
    },
  },
};
