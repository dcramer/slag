import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 157,
  map: {
    roles: ['batt', 'brass', 'tin', 'paper', 'label', 'hole', 'light', 'blue', 'disc', 'boot2', 'skin', 'dark'],
    families: [
      // The battery on his back: its dark body, and its brass cap and band.
      ['batt', [46, 46, 53]],
      ['batt', [60, 60, 68]],
      ['brass', [223, 187, 126]],
      ['brass', [186, 135, 103]],
      ['brass', [215, 193, 166]],
      // The tin can and the battery's tape: one grey.
      ['tin', [193, 194, 198]],
      ['tin', [185, 190, 194]],
      ['tin', [166, 158, 157]],
      ['tin', [195, 204, 205]],
      ['paper', [231, 218, 202]],
      ['paper', [212, 202, 186]],
      ['label', [207, 53, 42]],
      // The can's open end, dark inside.
      ['hole', [62, 54, 47]],
      ['hole', [80, 44, 48]],
      ['hole', [124, 70, 70]],
      ['light', [92, 189, 231]],
      ['light', [98, 187, 229]],
      ['light', [70, 128, 173]],
      ['light', [66, 114, 160]],
      ['blue', [48, 101, 193]],
      ['blue', [31, 69, 135]],
      ['blue', [52, 107, 190]],
      // The near ear disc's face: folded into the helmet, the disc was lost in its round.
      ['disc', [45, 109, 171]],
      ['disc', [48, 104, 172]],
      // The arm-length redraw's own shades: the helmet's deep shadow, the label's, the battery's grey.
      ['blue', [28, 57, 110]],
      ['blue', [39, 59, 103]],
      ['label', [133, 43, 41]],
      ['batt', [77, 72, 86]],
      ['tin', [157, 163, 170]],
      ['brass', [194, 130, 97]],
      ['paper', [197, 189, 173]],
      ['paper', [225, 211, 194]],
      ['boot2', [142, 179, 206]],
      ['boot2', [131, 186, 218]],
      ['skin', [255, 198, 142]],
      ['skin', [236, 143, 101]],
      ['skin', [247, 150, 114]],
      ['dark', [24, 32, 60]],
      ['dark', [11, 18, 44]],
      // The eyes' whites and glints, inside the eyes.
      ['dark', [255, 255, 255]],
    ],
    line: 'dark',
    thin: ['batt', 'brass', 'tin', 'paper', 'label', 'hole', 'light', 'blue', 'disc', 'boot2', 'skin'],
    fringe: 5,
    stroke: 2.4,
    feet: ['blue', 'boot2'],
    // The helmet's light glints (the dent's lip, the disc's rim) were stray pale arcs on the round.
    min: { dark: 0.12, light: 0.8 },
  },
  roles: [
    { name: 'batt', color: '#3a3a42', alts: ['#6b7178', '#5e412d'], vary: 6 },
    { name: 'brass', color: '#c99a4a' },
    { name: 'tin', color: '#c9ccd2' },
    { name: 'paper', color: '#efe6d6' },
    { name: 'label', color: '#808080', on: 7, tone: 0 },
    { name: 'hole', color: '#4a3f3c' },
    { name: 'light', color: '#808080', on: 7, tone: 18 },
    { name: 'blue', color: '#2a5fc4', slot: 'player' },
    { name: 'disc', color: '#808080', on: 7, tone: -12 },
    { name: 'boot2', color: '#808080', on: 7, tone: 9 },
    { name: 'skin', color: '#f3d0aa' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'scuff', color: '#808080', on: 7, tone: 28 },
    { name: 'scorch', color: '#808080', on: 7, tone: 4 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', area: [0.3, 4], gap: [1.6, 5], specks: { dark: 4.5 } },
  wear: {
    on: ['light'],
    chin: 3,
    marks: [[['scuff', 0.42, 0.7, 0.45]], [['scorch', 0.45, 0.72, 0.5]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.8, 0.8] }],
  face: { r: 0.85, iris: '#2a5fc4' },
  gait: { bounce: [0.2, 0.9], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200] },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // The cannon arm is stretched straight out, the can at full arm length clear of the helmet, in every standing,
  // running and jumping pose: held at the chest it barely cleared the helmet, and the silhouette was a lump
  // (blind read, 2026-11-04).
  poses: {
    idle2: {
      pose: 'standing, rocking back on his heels, his cannon arm stretched straight out in front at shoulder height, the tin can at full arm length clear of his helmet, his free hand scratching the back of his helmet, eyes open.',
    },
    'walk-1': {
      pose: 'walking to the right, mid-step: the near boot forward, the far boot back, his cannon arm stretched straight out in front at shoulder height, the tin can at full arm length clear of his helmet.',
    },
    'walk-2': {
      pose: 'walking to the right, the legs passing under the body: one boot planted, the other lifted a little, his cannon arm stretched straight out in front at shoulder height, the tin can at full arm length clear of his helmet.',
    },
    'run-1': {
      pose: 'running to the right in a bouncy stride, leaning forward, one knee high and the other leg pushing off, his cannon arm stretched straight out in front, the tin can at full arm length clear of his helmet, the battery on his back.',
    },
    'run-2': {
      pose: 'running to the right in a bouncy stride, leaning forward, both big boots off the ground with the legs gathered under him, his cannon arm stretched straight out in front, the tin can at full arm length clear of his helmet, the battery on his back.',
    },
    'air-1': {
      pose: 'jumping up, both big boots tucked up under him, his cannon arm stretched straight out in front pointing a little upward, the tin can at full arm length clear of his helmet, the free arm up, eyes open.',
    },
    'air-2': {
      pose: 'falling, both big boots reaching straight down and apart, the free arm flung up, his cannon arm stretched straight out in front, the tin can at full arm length clear of his helmet, his mouth open in alarm, eyes wide open.',
    },
    wall: {
      pose: 'seen from his side, he is sliding down a tall wall on the right edge of the picture (do not draw the wall), his free glove and both big boots braced flat against it, knees bent, his cannon arm stretched straight out away from the wall pointing to the left, the tin can at full arm length, his helmet turned to look back along the cannon, eyes open.',
      far: true,
    },
    cheer: {
      pose: 'cheering, up on his toes, the free fist punched high over his helmet, his cannon arm stretched straight out in front, the tin can at full arm length clear of his helmet, a big open grin, eyes open.',
    },
    cheer2: {
      pose: 'a happy little hop, both big boots off the ground and kicked back, his cannon arm stretched straight out in front, the tin can at full arm length clear of his helmet, the free hand waving, a big grin, eyes open.',
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal across the picture, helmet on the left and boots on the right, legs splayed limp, eyes shut, the tin-can cannon still on his arm and lying flat along his side, the battery under him. Seen from the side.',
      far: true,
    },
  },
};
