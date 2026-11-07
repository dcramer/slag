import type { FlatKind } from '../kinds';

// A pixel crab from space cut from big square tiles, seen flat from the front, wider than tall: two antennae, a claw
// raised off each side, a row of stubby legs. Its two square eye holes are cut through the frame
// (art/sprites/marcher/holes.py paints the drawing's black squares white and `holes` cuts them), the level showing
// through as through the arcade's. The stepped edge is the read, so nothing rounds it (`smooth: 0`). Drawn from one
// game-size design, worn in one edit (a tile fallen out and taped back on crooked, the near antenna bent at its tip),
// the poses three to a 16:9 image and cut apart (art/sprites/marcher/design.prompt.txt).
const KEEP =
  'every figure keeps its outline stepped square by square in big pixel tiles, both antennae (the left one bent over at the tip), the taped tile on top, the two square eye holes, and its two claws clear of the body';

export const kind: FlatKind = {
  body: 273,
  map: {
    roles: ['body', 'tape', 'ink'],
    // Sampled from the design (art/sprites/marcher/design.png, `swatch.py`); the cel shadow folds into the body.
    families: [
      ['body', [158, 124, 221]],
      ['body', [157, 127, 219]],
      ['body', [155, 123, 220]],
      ['body', [156, 122, 218]],
      ['body', [154, 122, 217]],
      ['body', [148, 116, 208]],
      ['body', [117, 90, 185]],
      ['body', [118, 89, 184]],
      ['body', [119, 92, 183]],
      ['body', [115, 88, 182]],
      ['body', [115, 90, 180]],
      ['body', [104, 81, 156]],
      // The grey tape over the fallen tile.
      ['tape', [158, 162, 166]],
      ['tape', [150, 156, 160]],
      ['tape', [176, 178, 182]],
      ['ink', [27, 21, 39]],
      ['ink', [25, 17, 37]],
      ['ink', [16, 8, 30]],
      ['ink', [38, 30, 55]],
      ['ink', [70, 60, 90]],
    ],
    line: 'ink',
    thin: ['body', 'tape'],
    fringe: 5,
    stroke: 2.4,
    feet: ['body'],
    min: { tape: 0.4 },
    // The two square eye holes, cut through the body.
    holes: 0.3,
    // Drawn in square tiles: corner cutting would round every step into a curve.
    smooth: 0,
  },
  roles: [
    // The costume: the whole crab.
    { name: 'body', color: '#9a7ad8', slot: 'player' },
    // A colourway is the tape: grey duct tape, brown packing tape or masking tape.
    { name: 'tape', color: '#a4a8ac', alts: ['#c49a5a', '#e4d6ae'], vary: 6 },
    { name: 'ink', color: '#2a1f2e' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // The eyes are holes (`cutout`): no speck to find, so the left one is set by hand on each drawing (holes.py prints
  // where), and the right one from it.
  eyes: {
    role: 'ink',
    area: [0.1, 3],
    gap: [1, 6],
    specks: {},
    at: {
      idle: [0.488, 0.522],
      idle2: [0.488, 0.491],
      'walk-1': [0.489, 0.521],
      'walk-2': [0.488, 0.517],
      'run-1': [0.488, 0.474],
      'run-2': [0.487, 0.493],
      'air-1': [0.49, 0.461],
      'air-2': [0.49, 0.488],
      cheer: [0.487, 0.471],
      cheer2: [0.495, 0.475],
    },
    pair: [4, 0],
  },
  wear: {
    on: ['body'],
    chin: 3,
    marks: [[['scuff', 0.25, 0.7, 0.5]], [['scorch', 0.7, 0.72, 0.5]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2, 0.8], offset: [-3.5, 3] }],
  // The kit shuts a hole in the body's own colour, as big as covers its corners.
  face: { r: 0.8, iris: '#2a1f2e', eye: 'cutout', lid: { role: 0, r: 1.8 } },
  gait: { bounce: [0.3, 0.8], lean: [0, 0] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.6, 2.2] },
    // The arcade's two-step: legs out, then pinched in, a beat each.
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 18 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 30 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.8 },
    // Clinging with both claws up, legs dangling: the rising drawing does it.
    wall: { frames: ['air-1'], loop: true, fps: 1, centre: 'box' },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.4, 0.25] },
    cheer2: { frames: ['cheer2', 'cheer'], loop: true, holds: [0.3, 0.3] },
    // Flipped on its back, legs in the air.
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.85 },
  },
  // Each pose alone, for a redraw; the sheets' prompts are in art/sprites/marcher/design.prompt.txt.
  poses: {
    idle2: { pose: `standing, its legs pinched in close together under its body, both claws raised; ${KEEP}.` },
    'walk-1': { pose: `stepping, its legs spread far out wide to both sides, both claws raised high; ${KEEP}.` },
    'walk-2': { pose: `stepping, its legs pinched in close together under its body, both claws held out level to the sides; ${KEEP}.` },
    'run-1': { pose: `scuttling fast, every leg kicked out to the left, the antennae swept back to the left, both claws raised; ${KEEP}.` },
    'run-2': { pose: `scuttling fast, every leg swung in under it, both claws raised; ${KEEP}.` },
    'air-1': { pose: `jumping up, its legs dangling straight down together under it, both claws raised high above its antennae; ${KEEP}.` },
    'air-2': { pose: `falling in alarm, its legs splayed straight out wide to both sides, both claws flung out wide sideways; ${KEEP}.` },
    cheer: { pose: `cheering, both claws thrust high up over its head with the pincers wide open, its legs tucked up under it in a hop; ${KEEP}.` },
    cheer2: { pose: `cheering, dancing, both claws raised and snapping, its legs spread wide; ${KEEP}.` },
    death: {
      pose: 'knocked out, flipped upside down onto its back on the floor, its legs sticking straight up in the air, its claws flopped out to the sides, its antennae pointing down.',
      far: true,
    },
  },
};
