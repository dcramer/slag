import type { FlatKind } from '../kinds';

// A tall painted cardboard box on four stubby block legs, no arms, three-quarter on so the four legs stand apart.
// His face is four holes cut through the box (art/sprites/creeper/holes.py paints a bolder face than the drawing's
// white where its black holes were, and `holes` cuts it through the frame): in black his outline alone is a post, and
// with the holes a reader names him. Drawn from one game-size design, worn in one edit, the poses three to a 16:9
// image and cut apart, then the candle burnt down to a stub in an edit of each sheet: tall, it read as an antenna or a
// hat (art/sprites/creeper/design.prompt.txt).
const KEEP =
  'no arms ever, the four short block legs always clear of each other, the four square face holes and the lit birthday candle stub always on his head';

export const kind: FlatKind = {
  body: 147,
  map: {
    roles: ['green', 'light', 'dark', 'card', 'tape', 'wax', 'flame', 'ink'],
    // Sampled from the design (art/sprites/creeper/design.png, `swatch.py`).
    families: [
      // The painted box, and its patchwork of lighter and darker squares; the cube's shaded side folds into the dark.
      ['green', [95, 175, 83]],
      ['green', [98, 173, 83]],
      ['green', [98, 178, 83]],
      ['green', [97, 176, 82]],
      ['green', [94, 177, 80]],
      ['green', [93, 174, 81]],
      ['green', [91, 167, 81]],
      ['light', [146, 212, 109]],
      ['light', [160, 195, 98]],
      ['light', [132, 165, 95]],
      ['dark', [65, 140, 75]],
      ['dark', [69, 141, 77]],
      ['dark', [66, 142, 75]],
      ['dark', [62, 130, 69]],
      ['dark', [70, 133, 65]],
      ['dark', [44, 101, 60]],
      ['dark', [29, 83, 37]],
      // The corrugated brown where a corner is torn open, and the packing tape over the split.
      ['card', [157, 126, 73]],
      ['card', [122, 122, 76]],
      ['tape', [192, 153, 90]],
      ['tape', [189, 149, 89]],
      // The birthday candle's wax and its flame.
      ['wax', [227, 234, 192]],
      ['wax', [240, 240, 222]],
      ['flame', [246, 196, 67]],
      ['flame', [240, 160, 40]],
      ['ink', [8, 58, 14]],
      ['ink', [11, 28, 7]],
      ['ink', [37, 59, 21]],
      ['ink', [77, 90, 50]],
    ],
    line: 'ink',
    thin: ['green', 'light', 'dark', 'card', 'tape', 'wax', 'flame'],
    fringe: 5,
    stroke: 2.4,
    feet: ['green', 'light', 'dark'],
    min: { light: 0.5, dark: 0.5, card: 0.4, flame: 0.2 },
    // The face's four holes, cut through the box.
    holes: 0.3,
    // Drawn in boxes: corner cutting traces a box as a pebble.
    smooth: 0,
  },
  roles: [
    // The costume: the painted box.
    { name: 'green', color: '#5aa846', slot: 'player' },
    // Its painted squares, a light and a dark of it.
    { name: 'light', color: '#808080', on: 0, tone: 22 },
    { name: 'dark', color: '#808080', on: 0, tone: -20 },
    { name: 'card', color: '#9e7e49' },
    // A colourway is the packing tape: brown, grey duct tape, or masking tape.
    { name: 'tape', color: '#c49a5a', alts: ['#a4a8ac', '#e4d6ae'], vary: 6 },
    { name: 'wax', color: '#f0ebda' },
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
  // The eyes are holes (`cutout`): no speck to find, so the near one is set by hand on each drawing (holes.py prints
  // where), and the far one from it.
  eyes: {
    role: 'ink',
    area: [0.1, 3],
    gap: [1, 4],
    specks: {},
    at: {
      idle: [0.505, 0.276],
      idle2: [0.426, 0.274],
      'walk-1': [0.533, 0.292],
      'walk-2': [0.472, 0.277],
      'run-1': [0.663, 0.281],
      'run-2': [0.669, 0.284],
      'air-1': [0.503, 0.264],
      'air-2': [0.264, 0.28],
      cheer: [0.452, 0.281],
      cheer2: [0.506, 0.279],
      wall: [0.303, 0.284],
    },
    pair: [2.98, -0.25],
  },
  wear: {
    on: ['green', 'dark'],
    chin: 4,
    marks: [[['scuff', 0.4, 0.75, 0.5]], [['scorch', 0.55, 0.62, 0.5]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'crown', size: [2, 0.8] }],
  // The kit shuts a hole in the box's own colour, as big as covers its corners.
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
    // He swells up fat to burst, shaking, the candle flaring: the homage's hiss, for joy.
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    // Standing tall, then stretched up off his feet.
    cheer2: { frames: ['cheer2', 'air-1'], loop: true, holds: [0.3, 0.5] },
    // Toppled on his side, the candle blown out: the holes stay his face.
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.8 },
  },
  // Each pose alone, for a redraw; the sheets' prompts are in art/sprites/creeper/design.prompt.txt.
  poses: {
    idle2: { pose: `standing on all four legs, leaning back a little, his head tipped up as if looking at the candle flame; ${KEEP}.` },
    'walk-1': {
      pose: `shuffling forward to the right, the near front leg stepping forward and the near back leg pushed back, leaning forward a little; ${KEEP}.`,
    },
    'walk-2': { pose: `shuffling to the right, his legs passing under him, all four feet close to the ground, one front foot just lifted; ${KEEP}.` },
    'run-1': {
      pose: `scurrying fast to the right, his whole body tipped forward, both front legs reaching far forward and both back legs kicked far back; ${KEEP}.`,
    },
    'run-2': { pose: `scurrying fast to the right, tipped forward, all four legs bunched together under him off the ground; ${KEEP}.` },
    'air-1': { pose: `jumping up, his body stretched tall, all four legs dangling straight down together, the candle flame streaming back; ${KEEP}.` },
    'air-2': { pose: `falling, all four legs splayed out wide below him, his body tipped back a little in alarm, the candle flame streaming up; ${KEEP}.` },
    wall: {
      pose: 'seen from his side, facing right, he is sliding down a tall wall that is just to his right (do not draw the wall), his two front legs braced flat against it and his two back legs hanging, his head turned to look back at us so his frowning face of four square black holes shows, the lit candle on his head.',
      far: true,
    },
    cheer: {
      pose: `cheering, his whole box swelled up fat and round like it is about to burst, shaking, the candle flame flaring up big and tall, his four legs planted wide; ${KEEP}.`,
    },
    cheer2: { pose: `cheering, standing up tall and proud on all four legs; ${KEEP}.` },
    death: {
      pose: 'he has been knocked out and toppled over, lying flat on his side on the floor, the whole box horizontal, his head on the left and his four stiff legs sticking straight out to the right, the candle on his head blown out with a thin wisp of grey smoke.',
      far: true,
    },
  },
};
