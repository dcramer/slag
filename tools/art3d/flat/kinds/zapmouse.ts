import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 157,
  map: {
    roles: ['fur', 'dark', 'cheek', 'tin', 'plug'],
    families: [
      ['fur', [240, 196, 40]],
      ['fur', [186, 124, 30]],
      ['fur', [222, 170, 30]],
      ['tin', [170, 186, 188]],
      ['tin', [126, 140, 142]],
      ['tin', [192, 192, 196]],
      // The tail's crumpled highlights are cool and the plug warm: one pale family took both, and orange
      // plugs left orange slivers along the tail.
      ['tin', [218, 222, 228]],
      // The ear's tape is a neutral grey, and the fur's highlight a pale yellow: both were nearest the plug's shade.
      ['tin', [160, 160, 162]],
      ['tin', [204, 204, 206]],
      ['fur', [246, 222, 124]],
      ['cheek', [216, 76, 54]],
      ['plug', [216, 210, 194]],
      ['plug', [190, 178, 158]],
      ['dark', [30, 20, 16]],
    ],
    line: 'dark',
    thin: ['tin'],
    feet: ['fur'],
    loose: ['tin'],
    min: { dark: 0.12, cheek: 0.3, plug: 0.8 },
  },
  eyes: { role: 'dark', area: [0.06, 0.7], gap: [2, 5.5], specks: { dark: 1.2, cheek: 0.35 } },
  recolour: { from: 'dark', to: 'cord', below: 2.5, lying: [0.4, -4] },
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
    // A colourway is the cord and its plug together (VARIETY.palette).
    { name: 'plug', color: '#e8e2d4', alts: ['#d9622b', '#e8e2d4'], vary: 6 },
    { name: 'cord', color: '#7a5236', alts: ['#4b5560', '#9a3b2a'], vary: 6 },
    { name: 'cheek', color: '#e0473b' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear, in tones of the fur it's on: rubbed pale, and burnt.
    { name: 'scuff', color: '#808080', on: 1, tone: 10 },
    { name: 'scorch', color: '#808080', on: 1, tone: -16 },
    { name: 'tape', color: '#c9c6bd' },
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
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200] },
    wall: { frames: ['wall'], loop: true, fps: 1 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.45, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  poses: {
    idle2: { pose: 'standing, looking back over its shoulder at its tin tail, one hand raised to scratch its taped ear.' },
    'walk-1': { pose: 'walking to the right, mid-step: the near foot forward, the far foot back, the arms swinging the other way.' },
    'walk-2': { pose: 'walking to the right, the legs passing under the body: one foot planted, the other lifted a little.' },
    'run-1': {
      pose: 'running fast to the right, leaning well forward, the legs wide apart in a long stride, the arms pumping, the tail streaming out behind.',
    },
    'run-2': {
      pose: 'running fast to the right, leaning well forward, both feet off the ground with the legs gathered under the body, the tail streaming out behind.',
    },
    'air-1': { pose: 'jumping straight up, both arms raised over its head, the legs tucked under it.' },
    'air-2': { pose: 'falling, both arms flung up and out, the legs dangling, the mouth open in alarm.' },
    wall: {
      pose: 'seen from its side, it is sliding down a tall wall on the right edge of the picture (do not draw the wall), its front pressed against it, both palms and one sole flat on it, the other leg hanging, its head turned to look back at us.',
      far: true,
    },
    cheer: { pose: 'cheering, both arms thrown high over its head, up on its toes, a big open grin.' },
    cheer2: { pose: 'jumping for joy with one fist punched straight up into the air, the other arm swinging back.' },
    death: {
      pose: 'it has been knocked out and lies flat on its back on the floor, the whole body horizontal across the picture, head on the left and feet on the right, arms and legs splayed limp, eyes shut. Seen from the side.',
      far: true,
    },
  },
};
