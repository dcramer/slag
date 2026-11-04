import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 215,
  map: {
    roles: ['buoy', 'stripe', 'suit', 'joint', 'pipe', 'visor', 'glint', 'dark'],
    families: [
      ['buoy', [204, 64, 53]],
      ['buoy', [201, 61, 51]],
      ['buoy', [131, 44, 39]],
      ['buoy', [187, 68, 42]],
      ['buoy', [246, 138, 126]],
      ['stripe', [236, 237, 236]],
      ['pipe', [201, 206, 203]],
      ['stripe', [153, 143, 144]],
      ['suit', [167, 68, 24]],
      ['suit', [217, 102, 30]],
      ['suit', [214, 105, 34]],
      ['suit', [218, 106, 34]],
      ['suit', [151, 70, 35]],
      ['suit', [176, 109, 64]],
      ['suit', [206, 96, 33]],
      ['suit', [161, 129, 117]],
      ['joint', [82, 76, 83]],
      ['joint', [64, 63, 69]],
      ['joint', [105, 84, 84]],
      ['pipe', [114, 129, 124]],
      ['pipe', [126, 132, 132]],
      ['pipe', [150, 156, 156]],
      ['pipe', [171, 177, 180]],
      ['visor', [48, 118, 76]],
      ['glint', [102, 168, 120]],
      ['dark', [14, 1, 1]],
      ['dark', [3, 0, 1]],
      ['dark', [33, 1, 0]],
      ['dark', [3, 2, 3]],
      ['dark', [66, 35, 31]],
      ['dark', [27, 23, 25]],
    ],
    line: 'dark',
    thin: ['buoy', 'stripe', 'suit', 'joint', 'pipe', 'visor', 'glint'],
    fringe: 5,
    stroke: 3,
    feet: ['suit'],
    min: { dark: 0.5, glint: 0.2, stripe: 3.5, joint: 0.6, visor: 1 },
  },
  roles: [
    // The fishing buoys, the shoulders nobody else in the cast is wider at: a dark of the suit, with a white band.
    { name: 'buoy', color: '#808080', on: 2, tone: -28 },
    { name: 'stripe', color: '#f1ece2' },
    // The suit: the water-heater chest, the helmet and the long legs.
    { name: 'suit', color: '#d9661f', slot: 'player' },
    // The undersuit: the collar, waist, gloves and knee pads, the suit's only metal. A colourway
    // (VARIETY.palette), all dark: gunmetal, slate or an old iron. A light steel or bone one blotched the
    // suit at play scale, the undersuit's big shapes scattered over it like camouflage.
    { name: 'joint', color: '#4b5059', alts: ['#646a73', '#3e3a37'], vary: 6 },
    // The drainpipe cannon, painted to match: a light of the suit, so it stays a shape of its own against the buoy.
    { name: 'pipe', color: '#808080', on: 2, tone: 18 },
    // Dark smoky glass, a neutral: nothing read as a face takes the player's colour.
    { name: 'visor', color: '#38434c' },
    { name: 'glint', color: '#a7b3bb' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear on the suit: a scrape, and soot, one mark each on the thigh: two marks on the narrow legs read as
    // spots, and a scrape wide enough to show its fill inside its pen as a ring.
    { name: 'scuff', color: '#808080', on: 2, tone: -8 },
    { name: 'scorch', color: '#808080', on: 2, tone: -17 },
    // A sticker painted on the near buoy's band, in the suit's own colour: between the buoy's dark and the band's white.
    { name: 'sticker', color: '#808080', on: 2, tone: 4 },
  ],
  slots: [
    { name: 'sticker', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // No face to draw: the visor hides it. The near buoy's white band is found as the anchor instead, so the
  // sticker lands on the buoy: anchored on the visor, it sat under the face and read as a mouth.
  eyes: { role: 'stripe', area: [1, 60], gap: [0, 0], specks: {}, count: 1, band: [0, 1] },
  wear: {
    on: ['suit'],
    chin: 0.5,
    marks: [[['scuff', 0.62, 0.78, 0.42]], [['scorch', 0.62, 0.78, 0.65]]],
  },
  accessories: [{ slot: 'sticker', role: 'sticker', at: 'cheek', size: [2.4, 0.95] }],
  gait: { bounce: [0, 0.4], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 32 },
    // A touch smaller: the cannon far out front and the run's lean reach the shared box's edge.
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 46, scale: 0.96 },
    // The cannon out front on the way up and down, and on a long fall the ball tuck.
    air: { frames: ['air-1', 'air-2', 'ball'], loop: false, vy: [-250, 450], scale: 0.9 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.9 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.94 },
  },
  // The cannon is the forearm, held straight out from the shoulder in every standing, running and jumping
  // pose: it and the shoulders are the silhouette. Carried across the waist it barely left the outline, and
  // the buoys and helmet read as one lobed head (blind read, 2026-11-04: "Rayman-like"). The long, thick
  // legs are the rest of it: short legs in big boots under a round helmet are the robot boy's.
  poses: {
    idle2: {
      pose: 'standing tall and square on its long legs, feet planted apart, the free fist on its hip, the drainpipe cannon arm stretched straight out in front at shoulder height, the helmet turned a little toward us.',
    },
    'walk-1': {
      pose: 'walking to the right with a long heavy stride of its long legs: the near foot forward, the far foot back, the drainpipe cannon arm stretched straight out in front at shoulder height.',
    },
    'walk-2': {
      pose: 'walking to the right, caught at the passing moment of the step, not a stride: one long leg straight and upright under the hips with its foot flat on the ground, the other knee bent forward and that foot lifted off the ground beside the standing ankle, the feet close together, the drainpipe cannon arm stretched straight out in front at shoulder height.',
    },
    'run-1': {
      pose: 'running to the right, leaning forward, one knee high and the other long leg stretched back pushing off in a long stride, the drainpipe cannon arm stretched straight out in front at shoulder height.',
    },
    'run-2': {
      pose: 'running to the right, leaning forward, caught between strides, not a stride: both legs gathered under the body, one knee raised high in front with its shin hanging down, the other foot kicked up behind under the hips, both feet off the ground, the drainpipe cannon arm stretched straight out in front at shoulder height.',
    },
    'air-1': {
      pose: 'jumping up, both knees tucked up high under it, the drainpipe cannon arm stretched straight out in front at shoulder height, pointing a little upward.',
    },
    'air-2': {
      pose: 'falling, both long legs reaching straight down and a little apart, the drainpipe cannon arm stretched straight out in front at shoulder height.',
    },
    ball: {
      pose: 'curled up tight into a round armored ball in mid-air, spinning, the helmet tucked down between the two red-and-white buoys, the long legs folded in tight, the drainpipe tucked against it, a near-round ball shape in orange and red.',
      far: true,
    },
    wall: {
      pose: 'seen from its side, it is sliding down a tall wall on the right edge of the picture (do not draw the wall), its back and both feet pressed flat against it, knees bent, the drainpipe cannon held out level away from the wall pointing to the left, its helmet turned to look along the cannon.',
      far: true,
    },
    cheer: {
      pose: 'cheering, standing tall, the free fist punched high over its head, the drainpipe cannon arm stretched straight out in front at shoulder height.',
    },
    cheer2: {
      pose: 'a victory stomp: one long leg raised high with the knee bent, the drainpipe cannon arm stretched straight out in front at shoulder height, the free fist pumping at its side.',
    },
    death: {
      pose: 'it has been knocked out and lies flat on its back on the floor, the whole body horizontal across the picture, helmet on the left and feet on the right, the long legs splayed limp, the drainpipe cannon still on its arm and lying flat along its side. Seen from the side.',
      far: true,
    },
  },
};
