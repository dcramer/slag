import type { FlatKind } from '../kinds';

// A tall painted cardboard box on four stubby block feet, no arms, his face square to us and only a sliver of his side
// showing. His face is solid ink, two square eyes over a long frown, as big as the head takes: cut through him as holes
// it showed the level, a light patch in a colour, and the read went with it (the clean audit's "magenta striped
// cylinder"). The box is painted in square pixel tiles, a light and a dark of his colour, and nothing crosses it: a band
// of packing tape read as stripes. Drawn from one game-size design, worn in one edit, the poses three to a 16:9 image
// and cut apart (art/sprites/creeper/design.prompt.txt).
const KEEP =
  'no arms ever, his head and body always crisp square boxes with sharp corners, his four short block feet always clear of each other with white between them, the big black frowning face and the lit candle stub always on his head';

export const kind: FlatKind = {
  body: 177,
  map: {
    roles: ['green', 'light', 'dark', 'card', 'wax', 'flame', 'ink'],
    // Sampled from the design (art/sprites/creeper/design.png, `swatch.py`).
    families: [
      // The painted box, and its pixel tiles a light and a dark of it.
      ['green', [84, 154, 69]],
      ['green', [88, 161, 72]],
      ['green', [86, 161, 71]],
      ['green', [87, 160, 72]],
      ['green', [87, 152, 71]],
      ['green', [85, 156, 69]],
      ['green', [88, 163, 72]],
      ['green', [87, 163, 71]],
      ['green', [97, 160, 79]],
      ['green', [84, 150, 70]],
      ['green', [79, 143, 66]],
      ['light', [129, 206, 96]],
      ['light', [130, 207, 98]],
      ['light', [136, 195, 99]],
      ['light', [139, 207, 108]],
      ['light', [115, 184, 89]],
      ['dark', [65, 117, 61]],
      ['dark', [66, 120, 62]],
      ['dark', [71, 103, 57]],
      // The corrugated brown where a corner is torn open, and the crumpled corner's shade.
      ['card', [148, 114, 66]],
      ['card', [184, 152, 100]],
      ['dark', [135, 129, 78]],
      // The birthday candle's wax and its flame.
      ['wax', [241, 236, 218]],
      ['flame', [244, 204, 80]],
      // The line and the face, solid ink.
      ['ink', [26, 41, 23]],
      ['ink', [12, 25, 8]],
      ['ink', [13, 34, 10]],
      ['ink', [24, 37, 19]],
      ['ink', [31, 45, 25]],
      ['ink', [24, 45, 21]],
    ],
    line: 'ink',
    thin: ['green', 'light', 'dark', 'card', 'wax', 'flame'],
    fringe: 5,
    stroke: 2.4,
    feet: ['green', 'light', 'dark'],
    min: { light: 0.5, dark: 0.5, card: 0.4, flame: 0.2 },
    // Drawn in boxes: corner cutting traces a box as a pebble.
    smooth: 0,
  },
  roles: [
    // The costume: the painted box.
    { name: 'green', color: '#5aa846', slot: 'player' },
    // Its painted squares, a light and a dark of it.
    { name: 'light', color: '#808080', on: 0, tone: 20 },
    { name: 'dark', color: '#808080', on: 0, tone: -20 },
    { name: 'card', color: '#9e7e49' },
    // A colourway is the candle's wax: white, beeswax or grey.
    { name: 'wax', color: '#f0ebda', alts: ['#e6d0a0', '#c8cacb'], vary: 6 },
    { name: 'flame', color: '#f4b63a' },
    { name: 'ink', color: '#2a1f1a' },
    { name: 'scuff', color: '#808080', on: 0, tone: 12 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // The face's two square eyes; the frown under them is too big to be one.
  eyes: {
    role: 'ink',
    area: [0.5, 6],
    gap: [1.5, 6],
    band: [0.05, 0.45],
    specks: {},
  },
  wear: {
    on: ['green', 'dark'],
    chin: 4,
    marks: [[['scuff', 0.4, 0.75, 0.5]], [['scorch', 0.55, 0.62, 0.5]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'crown', size: [2, 0.8] }],
  // The drawn ink is the eye (`cutout`): the kit draws none, acts in the brows and shuts it in the box's own colour, as
  // big as covers its corners.
  face: { r: 0.6, iris: '#2a1f1a', eye: 'cutout', lid: { role: 0, r: 1.5 } },
  gait: { bounce: [0.1, 0.5], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    // A shuffle on four stiff legs, then a scurry tipped forward.
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 22 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 34 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.92 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    // The candle flaring up big; then standing tall and proud. Never swelled round: round, he read as a cylinder.
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    // Toppled on his side, the candle blown out.
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.8 },
  },
  // Each pose alone, for a redraw; the sheets' prompts are in art/sprites/creeper/design.prompt.txt.
  poses: {
    idle2: { pose: `standing on all four feet, leaning back a little, his head tipped up as if looking at the candle flame; ${KEEP}.` },
    'walk-1': {
      pose: `shuffling to the right, one front foot stepping forward and one back foot pushed back, his body leaning forward a little; ${KEEP}.`,
    },
    'walk-2': { pose: `shuffling to the right, his feet passing under him, all four close to the ground, one front foot just lifted; ${KEEP}.` },
    'run-1': {
      pose: `scurrying fast to the right, his whole body tipped forward, the front feet reaching far forward and the back feet kicked far back; ${KEEP}.`,
    },
    'run-2': { pose: `scurrying fast to the right, tipped forward, all four feet bunched together under him off the ground; ${KEEP}.` },
    'air-1': { pose: `jumping up, his body straight and tall, all four feet dangling straight down together, the candle flame streaming back; ${KEEP}.` },
    'air-2': { pose: `falling, all four feet splayed out wide below him, his body tipped back a little in alarm; ${KEEP}.` },
    wall: {
      pose: 'seen from his side, facing right, he is sliding down a tall wall that is just to his right (do not draw the wall), his front feet braced flat against it and his back feet hanging, his head turned to look back at us so his big black frowning face shows, the lit candle stub on his head.',
      far: true,
    },
    cheer: { pose: `cheering, a big happy hop high off the ground, all four feet tucked up under him, the candle flame flaring up tall; ${KEEP}.` },
    cheer2: { pose: `cheering, standing up tall and proud on his four feet, still a crisp square box; ${KEEP}.` },
    death: {
      pose: 'he has been knocked out and toppled over, lying flat on his side on the floor, the whole box horizontal, his head on the left and his four stiff feet sticking straight out to the right, the candle stub blown out with a thin wisp of grey smoke.',
      far: true,
    },
  },
};
