import type { FlatKind } from '../kinds';

// Every pose keeps the shapes that carry her (art/sprites/vampire/design.prompt.txt): her height, straight up and
// down, the tallest figure in the cast (the read: everyone else is a small toy); the huge pale sun hat level on a
// small head, a low flat crown with no point and a dark band, its brim far wider than her shoulders (the mage's brim
// sits on a small round figure; pale, it reads as her hat and not as dark hair); the gown pulled in at the waist and
// flaring to the floor (a gown, never a coat over two legs: the slayer's); and the clawed hand held out clear of her,
// four long blades fanned with background between them (the clean colour read named her by them, 2026-11-06; small
// nails inside the outline were lost).
const KEEP =
  'always very tall, slim and straight, the huge pale cream flat-crowned sun hat with its black band sitting level on her small head, its brim far wider than her shoulders with white background above and beside it, the long plum gown pulled in at the waist and flaring to the floor, and her front hand held out clear of her body with its four very long silver blade claws fanned out, white background between each claw and all round the hand';

export const kind: FlatKind = {
  body: 189,
  map: {
    roles: ['gown', 'hat', 'skin', 'pearl', 'nail', 'dark', 'band', 'lips'],
    // Sampled from the design (art/sprites/vampire/design.png, `swatch.py` and by hand: the median cut drops the
    // pearls, the claws and the lips).
    families: [
      // The gown and its cel shade, folded in.
      ['gown', [119, 45, 72]],
      ['gown', [118, 44, 70]],
      ['gown', [121, 48, 72]],
      ['gown', [104, 38, 65]],
      ['gown', [111, 48, 70]],
      ['gown', [84, 28, 56]],
      ['gown', [88, 26, 56]],
      // The hat and its shade.
      ['hat', [227, 218, 200]],
      ['hat', [234, 223, 210]],
      ['hat', [214, 204, 186]],
      // The hat's band, her black hair and her heels: one dark neutral.
      ['band', [50, 38, 44]],
      ['band', [45, 39, 42]],
      ['band', [62, 54, 58]],
      // The skin and its shade under the brim.
      ['skin', [241, 211, 199]],
      ['skin', [246, 210, 192]],
      ['skin', [243, 213, 201]],
      ['skin', [183, 155, 165]],
      ['lips', [184, 32, 44]],
      // The pearls and their shade.
      ['pearl', [252, 252, 252]],
      ['pearl', [238, 226, 230]],
      ['pearl', [228, 216, 220]],
      // The claws and their shade.
      ['nail', [186, 180, 204]],
      ['nail', [203, 192, 204]],
      ['nail', [176, 160, 168]],
      ['nail', [146, 130, 138]],
      ['nail', [114, 88, 97]],
      // The ink.
      ['dark', [48, 6, 25]],
      ['dark', [30, 4, 14]],
      ['dark', [65, 19, 41]],
    ],
    line: 'dark',
    thin: ['gown', 'hat', 'skin', 'pearl', 'nail', 'band', 'lips'],
    fringe: 5,
    // The claws' points, the hem's tears and the hat's corners stay points: smoothed, the claws traced as a mitten.
    smooth: 0,
    stroke: 2.4,
    feet: ['gown', 'band'],
    // The background closed in between the arm on her hip and her waist, cut through.
    holes: 0.8,
    min: { dark: 0.3, pearl: 0.3, nail: 0.2, skin: 0.3, lips: 0.05 },
  },
  roles: [
    // The costume: the gown, in the player's colour.
    { name: 'gown', color: '#7a2e4a', slot: 'player' },
    // A colourway is the hat (VARIETY.palette), pale neutrals all: cream straw, bleached linen, a warm stone.
    { name: 'hat', color: '#f8f5ef', alts: ['#fdfcf9', '#ebe4d6'], vary: 6 },
    // The face: neutral, pale.
    { name: 'skin', color: '#f6e6e2' },
    { name: 'pearl', color: '#f6f3ee' },
    { name: 'nail', color: '#b8b4c8' },
    { name: 'dark', color: '#26101c' },
    // The hat's band and her hair: near black.
    { name: 'band', color: '#2e2a30' },
    // A face mark: the red lips.
    { name: 'lips', color: '#c42834' },
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
      idle: [0.43, 0.122],
      idle2: [0.55, 0.114],
      'walk-1': [0.5, 0.11],
      'walk-2': [0.5, 0.112],
      'run-1': [0.47, 0.112],
      'run-2': [0.53, 0.103],
      'air-1': [0.36, 0.222],
      'air-2': [0.45, 0.118],
      wall: [0.45, 0.184],
      cheer: [0.43, 0.12],
      cheer2: [0.5, 0.106],
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
    // Centred on her box, standing too: the claws held out in front reach further from her gown than the box
    // allows about her feet, and centred she can stand the tallest it allows. She stands at the back of her
    // hitbox, claws forward.
    idle: { frames: ['idle'], loop: true, fps: 1, centre: 'box' },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4], centre: 'box' },
    // A slow, grand glide.
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30, centre: 'box', scale: 0.95 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 44, centre: 'box', scale: 0.8 },
    // She has to duck to jump: the air clip is smaller, inside the shared box.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.76 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.73 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25], centre: 'box' },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3], centre: 'box' },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.76 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/vampire/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing tall and bored, the clawed hand lowered at her side, the claws hanging down clear of the gown, her chin up, ${KEEP}.` },
    'walk-1': {
      pose: `gliding slowly to the right, the gown swaying forward at the hem, a knee pushing the gown out in front, the clawed hand held out ahead, ${KEEP}.`,
    },
    'walk-2': { pose: `gliding to the right, the gown swaying back at the hem, her back hand on her hip, the clawed hand held out ahead, ${KEEP}.` },
    'run-1': {
      pose: `striding fast to the right, leaning forward, her back hand hitching up the gown, a long leg in a black heel striding out in front, the clawed hand reaching far out ahead, ${KEEP}.`,
    },
    'run-2': { pose: `running to the right mid-stride, the gown streaming out behind her, the clawed hand reaching far out ahead, ${KEEP}.` },
    'air-1': {
      pose: `jumping up, ducking her head under the hat, her knees tucked up so the gown bunches up round them, the clawed hand held out in front, ${KEEP}.`,
    },
    'air-2': { pose: `falling, her eyes wide in alarm, the gown's hem blown up and flaring wide below her, both arms out to the sides, ${KEEP}.` },
    wall: {
      pose: 'seen from her side, facing right: she is clinging to a tall wall on the right edge of her space (do not draw the wall), her four long silver blade claws dug into it, her knees bent and pressed to it under the gown, the huge pale cream flat sun hat with its black band still on her head, her face turned to look back at us, eyes open.',
      far: true,
    },
    cheer: {
      pose: `a cruel triumphant laugh, standing tall, chin up, the clawed hand raised high beside the hat's brim, clear of it, the other hand on her hip, ${KEEP}.`,
    },
    cheer2: { pose: `a haughty curtsy, one hand holding out the side of the gown wide, the clawed hand held out to the side, head tilted, ${KEEP}.` },
    death: {
      pose: 'she has been knocked out and lies flat on her back on the floor, the whole body horizontal, her head on the left and the gown’s hem on the right, the huge pale cream hat knocked off and lying flat on the floor beside her head, the clawed hand flopped up, eyes shut.',
      far: true,
    },
  },
};
