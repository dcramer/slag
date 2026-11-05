import type { FlatKind } from '../kinds';

// The sixth round (2026-11-04, art/sprites/robot/design.prompt.txt): the outline the original is known by. A
// wide stance on huge flared boots, a small body, a ridge down the helmet and an ear disc standing proud of it,
// and the forearm itself the cannon, a thick taped tin can with no hand, held out level at full arm length in
// every standing, running and jumping pose. Drawn three to a 16:9 image and cut apart.
const CAN = 'his taped tin-can cannon arm always held straight out level to the right at shoulder height, the can at full arm length, clear of his helmet';

export const kind: FlatKind = {
  body: 198,
  map: {
    roles: ['tape', 'rim', 'light', 'blue', 'boot2', 'can', 'disc', 'skin', 'dark'],
    families: [
      // The tape binding the can on, and its shade.
      ['tape', [214, 217, 222]],
      ['tape', [227, 225, 220]],
      ['tape', [157, 155, 169]],
      // The thick grey rim round the face: what keeps the face apart from a helmet of any colour.
      ['rim', [73, 75, 89]],
      ['rim', [73, 74, 79]],
      // The suit, the ridge and the brow's square, and their shades.
      ['light', [124, 192, 229]],
      ['light', [123, 191, 229]],
      ['light', [123, 189, 228]],
      ['light', [132, 198, 233]],
      ['light', [159, 198, 221]],
      ['light', [94, 148, 198]],
      ['light', [76, 132, 177]],
      ['light', [72, 125, 180]],
      ['light', [89, 126, 166]],
      // The helmet, the near boot and the free mitten, and their cel shadow.
      ['blue', [47, 100, 184]],
      ['blue', [44, 98, 185]],
      ['blue', [46, 98, 184]],
      ['blue', [51, 97, 177]],
      ['blue', [54, 103, 179]],
      ['blue', [37, 73, 138]],
      // The repainted far boot.
      ['boot2', [112, 166, 219]],
      ['boot2', [108, 157, 216]],
      ['boot2', [116, 154, 204]],
      ['boot2', [143, 178, 204]],
      // The tin can, a dark of the helmet.
      ['can', [49, 80, 132]],
      ['can', [47, 85, 139]],
      // The ear disc, darker still, and the can's dark muzzle.
      ['disc', [33, 57, 104]],
      ['disc', [32, 63, 119]],
      ['disc', [24, 44, 85]],
      ['disc', [27, 55, 103]],
      // The face, and the eyes' whites (the kit draws its own eyes).
      ['skin', [236, 224, 202]],
      ['skin', [233, 243, 246]],
      ['dark', [31, 19, 41]],
      ['dark', [21, 19, 46]],
      ['dark', [25, 14, 34]],
      ['dark', [13, 10, 33]],
      ['dark', [37, 35, 62]],
      ['dark', [255, 255, 255]],
    ],
    line: 'dark',
    thin: ['tape', 'rim', 'light', 'blue', 'boot2', 'can', 'disc', 'skin'],
    fringe: 5,
    stroke: 2.4,
    feet: ['blue', 'boot2'],
    min: { dark: 0.12, tape: 0.3, rim: 0.2 },
  },
  roles: [
    { name: 'tape', color: '#c9ccd2', alts: ['#d8cfb8', '#9aa0a8'], vary: 6 },
    { name: 'rim', color: '#4a4c55' },
    // The suit and the ridge, a light tone of the helmet.
    { name: 'light', color: '#808080', on: 3, tone: 20 },
    // The costume: the helmet, the near boot and the free mitten.
    { name: 'blue', color: '#2a5fc4', slot: 'player' },
    { name: 'boot2', color: '#808080', on: 3, tone: 9 },
    { name: 'can', color: '#808080', on: 3, tone: -12 },
    { name: 'disc', color: '#808080', on: 3, tone: -24 },
    // Paler than any suit tone: a peach face sank into an orange or a gold helmet.
    { name: 'skin', color: '#f7e7d6' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'scuff', color: '#808080', on: 2, tone: 14 },
    { name: 'scorch', color: '#808080', on: 2, tone: -16 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', area: [0.3, 4], gap: [1.2, 4], specks: { dark: 4.5 } },
  wear: {
    on: ['light'],
    chin: 3,
    marks: [[['scuff', 0.45, 0.7, 0.45]], [['scorch', 0.5, 0.72, 0.5]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.5, 0.7] }],
  face: { r: 0.9, iris: '#2a5fc4' },
  gait: { bounce: [0.2, 0.9], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40, scale: 0.92 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.88 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    // The grin's eyes are shut, which is what the kit's cheer draws.
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Each pose alone, for a redraw; the sheets' prompts are in art/sprites/robot/design.prompt.txt.
  poses: {
    idle2: { pose: `standing in his wide stance, leaning back a little, his free mitten on his hip, looking pleased, ${CAN}.` },
    'walk-1': { pose: `walking to the right, mid-stride, the near boot stepping forward and the far boot back, legs wide apart, ${CAN}.` },
    'walk-2': { pose: `walking to the right, the legs passing under the body, one boot planted flat and the other lifted a little behind it, ${CAN}.` },
    'run-1': {
      pose: `running hard to the right, leaning forward, the near knee raised high in front and the far leg kicked far back behind him, bent at the knee, ${CAN}.`,
    },
    'run-2': { pose: `running to the right, mid-stride, both big boots off the ground, the legs split wide apart front and back, ${CAN}.` },
    'air-1': {
      pose: `jumping up, his free mitten punched straight up high above his helmet as a fist, one knee tucked up and the other leg hanging straight below, ${CAN}.`,
    },
    'air-2': { pose: `falling, both big boots reaching straight down and apart, the free arm flung up, his mouth open in alarm, ${CAN}.` },
    wall: {
      pose: 'seen from his side, he is sliding down a tall wall that is just to his right (do not draw the wall), his free mitten and both big boots braced flat against it, knees bent, his cannon arm stretched straight out away from the wall pointing to the left, the can at full arm length, his helmet turned to look back along the cannon, eyes open.',
      far: true,
    },
    cheer: { pose: `cheering, up on his toes in his wide stance, the free fist punched high over his helmet, a big open grin, ${CAN}.` },
    cheer2: { pose: `a happy little hop, both big boots off the ground and kicked back, the free mitten waving, a big grin, ${CAN}.` },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, helmet on the left and boots on the right, legs splayed limp, eyes shut, the tin-can cannon still on his arm lying flat along his side.',
      far: true,
    },
  },
};
