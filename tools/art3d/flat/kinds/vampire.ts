import type { FlatKind } from '../kinds';

// Every pose keeps the shapes that carry her (art/sprites/vampire/design.prompt.txt): her height, straight up and
// down, the tallest figure in the cast (the read: everyone else is a small toy); the wide flat black sun hat level on
// a small head, a low flat crown with no point (the mage's brim sits on a small round figure); the long gown to the
// floor hiding her feet (a gown, never a coat over two legs: the slayer's); and the raised hand held out clear of
// her, the long nails splayed (inside the outline a hand is lost).
const KEEP =
  'always very tall, slim and straight, the wide flat black sun hat sitting level on her small head with white background above and beside it, the long plum gown down to the floor hiding her feet, and one hand raised out clear of her body with its long pointed silver nails splayed, white background all round the hand';

export const kind: FlatKind = {
  body: 142,
  map: {
    roles: ['gown', 'hat', 'skin', 'pearl', 'nail', 'dark'],
    // Sampled from the design (art/sprites/vampire/design.png, `swatch.py` and by hand: the median cut drops the
    // pearls and the nails).
    families: [
      // The gown and its cel shade, folded in.
      ['gown', [121, 47, 72]],
      ['gown', [122, 48, 75]],
      ['gown', [117, 47, 71]],
      ['gown', [102, 38, 65]],
      ['gown', [90, 29, 59]],
      ['gown', [87, 29, 58]],
      ['gown', [88, 26, 56]],
      // The hat, its shade and highlight, the hair's bun and the heels: one dark neutral.
      ['hat', [58, 54, 55]],
      ['hat', [48, 48, 48]],
      ['hat', [37, 35, 41]],
      ['hat', [48, 40, 48]],
      ['hat', [88, 72, 77]],
      // The skin and its shade, the lips folded in.
      ['skin', [244, 215, 205]],
      ['skin', [246, 210, 192]],
      ['skin', [240, 204, 186]],
      ['skin', [191, 154, 159]],
      ['skin', [192, 132, 138]],
      // The pearls and their shade.
      ['pearl', [252, 252, 252]],
      ['pearl', [246, 238, 230]],
      ['pearl', [228, 220, 216]],
      // The false nails.
      ['nail', [186, 180, 204]],
      ['nail', [174, 168, 186]],
      ['nail', [144, 138, 162]],
      // The ink.
      ['dark', [38, 6, 21]],
      ['dark', [57, 8, 30]],
      ['dark', [65, 30, 48]],
      ['dark', [30, 0, 8]],
    ],
    line: 'dark',
    thin: ['gown', 'hat', 'skin', 'pearl', 'nail'],
    fringe: 5,
    stroke: 2.4,
    feet: ['gown', 'hat'],
    // The background closed in between the arm on her hip and her waist, cut through.
    holes: 0.8,
    min: { dark: 0.3, pearl: 0.3, nail: 0.2, skin: 0.3 },
  },
  roles: [
    // The costume: the gown, in the player's colour.
    { name: 'gown', color: '#7a2e4a', slot: 'player' },
    // A colourway is the hat (VARIETY.palette), dark neutrals all: soot, charcoal, a dark plum-grey.
    { name: 'hat', color: '#34303a', alts: ['#2a2a2c', '#463c44'], vary: 6 },
    // The face: neutral, pale.
    { name: 'skin', color: '#f2dcd4' },
    { name: 'pearl', color: '#f4f0e8' },
    { name: 'nail', color: '#b8b4c8' },
    { name: 'dark', color: '#26101c' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // The brim shades her eyes in the design and most poses, and where a pose draws them they are thinner than the
  // ink and go as line: so the near eye is set by hand, just under the brim on the face (fractions of the figure's
  // box), and the far one from it, a sliver on a face this narrow.
  eyes: {
    role: 'dark',
    area: [0.1, 3],
    gap: [1, 2.6],
    specks: { dark: 3 },
    count: 1,
    pair: [0.8, 0],
    at: {
      idle: [0.447, 0.11],
      idle2: [0.58, 0.113],
      'walk-1': [0.552, 0.111],
      'walk-2': [0.513, 0.111],
      'run-1': [0.652, 0.121],
      'run-2': [0.624, 0.121],
      'air-1': [0.456, 0.167],
      'air-2': [0.445, 0.094],
      wall: [0.54, 0.126],
      cheer: [0.45, 0.113],
      cheer2: [0.414, 0.111],
    },
  },
  wear: {
    on: ['gown'],
    chin: 6,
    marks: [[['scuff', 0.4, 0.8, 0.3]], [['scorch', 0.6, 0.9, 0.3]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'crown', size: [1.4, 0.5] }],
  // Half-lidded, looking down at everyone.
  face: { r: 0.6, iris: '#26101c', eye: 'heavy' },
  gait: { bounce: [0, 0.3], lean: [0, 0.02] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    // A slow, grand glide.
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 44 },
    // She has to duck to jump: the air clip is smaller, inside the shared box.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.84 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.84 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.76 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/vampire/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing tall and bored, inspecting the long nails of her raised hand, her chin up, ${KEEP}.` },
    'walk-1': { pose: `gliding slowly to the right, the gown swaying forward at the hem, a knee pushing the gown out in front, ${KEEP}.` },
    'walk-2': { pose: `gliding to the right, the gown swaying back at the hem, her back hand on her hip, ${KEEP}.` },
    'run-1': {
      pose: `striding fast to the right, leaning forward, her back hand hitching up the gown, a long leg in a black heel striding out in front, the clawed hand reaching far out ahead, ${KEEP}.`,
    },
    'run-2': { pose: `running to the right mid-stride, the gown streaming out behind her, the clawed hand reaching far out ahead, ${KEEP}.` },
    'air-1': {
      pose: `jumping up, ducking her head under the hat, her knees tucked up so the gown bunches up round them, the clawed hand held out in front, ${KEEP}.`,
    },
    'air-2': { pose: `falling, her eyes wide in alarm, the gown's hem blown up and flaring wide below her, both arms out to the sides, ${KEEP}.` },
    wall: {
      pose: 'seen from her side, facing right: she is clinging to a tall wall on the right edge of her space (do not draw the wall), her clawed hand’s long nails dug into it, her knees bent and pressed to it under the gown, the wide flat black hat still on her head, her face turned to look back at us, eyes open.',
      far: true,
    },
    cheer: {
      pose: `a cruel triumphant laugh, standing tall, chin up, the clawed hand raised beside the hat's brim, clear of it, the other hand on her hip, ${KEEP}.`,
    },
    cheer2: { pose: `a haughty curtsy, one hand holding out the side of the gown wide, the clawed hand on her chest, head tilted, ${KEEP}.` },
    death: {
      pose: 'she has been knocked out and lies flat on her back on the floor, the whole body horizontal, her head on the left and the gown’s hem on the right, the wide black hat knocked off and lying flat on the floor beside her head, the clawed hand flopped up, eyes shut.',
      far: true,
    },
  },
};
