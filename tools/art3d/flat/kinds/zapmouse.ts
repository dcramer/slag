import type { FlatKind } from '../kinds';

// Every pose keeps what reads in any player's colour (the clean colour audit, 2026-11-06: in purple, with one ear
// bent down and a crumpled tail, "a cat-like body", "a horned creature"): both long ears up in a V with their
// black tips, the tin bolt out behind clear of the body, the cord belt.
const KEEP =
  'both long black-tipped ears always standing up in a V clear of its arms, the grey tin zigzag tail always out behind it clear of its body, the brown cord belt and grey plug always on';

export const kind: FlatKind = {
  body: 146,
  map: {
    roles: ['fur', 'dark', 'cheek', 'tin', 'cord', 'eartape'],
    // Sampled from the sixth round's design (art/sprites/zapmouse/design.prompt.txt). Its pen is a dark olive
    // brown, its ear tips near black; both are the ink. The plug is the tail's grey and folds into the tin.
    families: [
      ['fur', [238, 193, 27]],
      ['fur', [194, 141, 26]],
      ['fur', [190, 138, 30]],
      ['fur', [184, 138, 27]],
      ['fur', [234, 195, 51]],
      ['fur', [235, 207, 112]],
      ['fur', [225, 194, 75]],
      ['fur', [208, 176, 89]],
      ['tin', [168, 172, 178]],
      ['tin', [154, 155, 157]],
      ['tin', [178, 179, 183]],
      // The ear's tape, a paler grey than the tin, so it is a shape of its own (drawn as the crown's tape).
      ['eartape', [194, 195, 202]],
      ['eartape', [205, 205, 208]],
      ['cheek', [218, 66, 52]],
      ['cheek', [166, 63, 34]],
      ['cord', [144, 99, 57]],
      ['cord', [139, 96, 55]],
      ['cord', [111, 73, 47]],
      ['dark', [42, 30, 21]],
      ['dark', [78, 47, 9]],
      ['dark', [107, 71, 14]],
      ['dark', [100, 64, 8]],
      ['dark', [116, 78, 15]],
    ],
    line: 'dark',
    thin: ['fur', 'tin', 'eartape', 'cheek', 'cord'],
    fringe: 5,
    feet: ['fur'],
    loose: ['tin', 'eartape'],
    // The bolt's corners are the read: no corner cutting, or its points trace round.
    smooth: 0,
    min: { dark: 1.6, cheek: 0.87, cord: 0.5 },
  },
  eyes: { role: 'dark', area: [0.06, 1.3], gap: [2, 5.5], specks: { dark: 1.2, cheek: 0.35 }, from: 'map' },
  wear: {
    on: ['fur'],
    chin: 4.5,
    // One mark a wear: two on the belly read as a rash of rings and blobs.
    marks: [[['scuff', 0.3, 0.8, 0.95]], [['scorch', 0.68, 0.76, 1.0]]],
  },
  accessories: [{ slot: 'tape', role: 'tape', at: 'crown', size: [2.9, 0.85] }],
  roles: [
    { name: 'tin', color: '#a9afb7' },
    { name: 'fur', color: '#f2c62a', slot: 'player' },
    // A colourway is the cord (VARIETY.palette), in neutrals: a brown flex, a slate one, a taupe one.
    { name: 'cord', color: '#7a5236', alts: ['#4b5560', '#857a6e'], vary: 6 },
    { name: 'cheek', color: '#e0473b' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear, in tones of the fur it's on: rubbed pale, and burnt.
    { name: 'scuff', color: '#808080', on: 1, tone: 10 },
    { name: 'scorch', color: '#808080', on: 1, tone: -16 },
    { name: 'tape', color: '#c9c6bd' },
    { name: 'eartape', color: '#c9c6bd' },
  ],
  slots: [
    { name: 'tape', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  face: { r: 0.85, iris: '#2a1f1a', mouth: [1.8, 1.6], eye: 'dot' },
  gait: { bounce: [0.15, 0.75], lean: [0, 0.04] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.6, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 44 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.95 },
    wall: { frames: ['wall'], loop: true, fps: 1, scale: 0.94 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.45, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/zapmouse/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing, looking back over its shoulder at its tin tail, one paw raised to scratch its taped ear, ${KEEP}.` },
    'walk-1': { pose: `walking to the right, mid-step, the near foot forward and the far foot back, the stubby arms swinging the other way, ${KEEP}.` },
    'walk-2': { pose: `walking to the right, the legs passing under the body, one foot planted and the other lifted a little, ${KEEP}.` },
    'run-1': {
      pose: `running fast to the right, leaning well forward, the legs wide apart in a long stride, the stubby arms pumping, the ears swept back a little, ${KEEP}.`,
    },
    'run-2': { pose: `running fast to the right, leaning well forward, both feet off the ground with the legs gathered under the body, ${KEEP}.` },
    'air-1': { pose: `jumping straight up, both stubby arms raised a little above its shoulders, the legs tucked under it, ${KEEP}.` },
    'air-2': { pose: `falling, both stubby arms flung out to the sides, the legs dangling, the mouth open in alarm, ${KEEP}.` },
    wall: {
      pose: 'seen from its side, it is sliding down a tall wall that is just to its right (do not draw the wall), its front pressed against it, both paws and one foot flat on it, the other leg hanging, its head turned to look back at us, both ears standing up, the tin tail out behind it to the left.',
      far: true,
    },
    cheer: { pose: `cheering, both stubby arms thrown up and out wide in a V, up on its toes, a big open grin, ${KEEP}.` },
    cheer2: { pose: `jumping for joy with one fist punched straight up into the air, the other arm swinging back, a big grin, ${KEEP}.` },
    death: {
      pose: 'it has been knocked out and lies flat on its back on the floor, the whole body horizontal, head on the left and feet on the right, arms and legs splayed limp, eyes shut, the long ears lying flat out to the left past its head, the tin tail flat on the floor below it. Seen from the side.',
      far: true,
    },
  },
};
