import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 265,
  map: {
    roles: ['can', 'cap', 'body', 'tan', 'visor', 'vshade', 'glint', 'dark'],
    families: [
      ['body', [98, 167, 76]],
      ['body', [59, 137, 84]],
      ['body', [49, 109, 77]],
      ['body', [136, 193, 114]],
      ['body', [114, 172, 126]],
      ['body', [77, 150, 81]],
      ['visor', [170, 218, 227]],
      ['visor', [178, 222, 230]],
      ['vshade', [127, 175, 195]],
      ['glint', [252, 253, 253]],
      ['can', [162, 46, 46]],
      ['can', [186, 69, 58]],
      ['cap', [236, 196, 81]],
      ['tan', [224, 198, 128]],
      ['tan', [189, 159, 102]],
      ['dark', [20, 63, 40]],
      ['dark', [16, 51, 29]],
      ['dark', [81, 21, 17]],
      ['dark', [80, 60, 52]],
    ],
    line: 'dark',
    thin: ['can', 'cap', 'body', 'tan', 'visor', 'vshade', 'glint'],
    fringe: 5,
    stroke: 2.4,
    // No eyes or other dark fills: every dark is the line, even the thick seam between the suit and the can.
    ink: 21,
    feet: ['body'],
    min: { dark: 0.12 },
  },
  roles: [
    // A colourway is the jerrycan (VARIETY.palette): fuel red, army olive or bare steel.
    { name: 'can', color: '#c9473f', alts: ['#6b7340', '#8e949a'], vary: 6 },
    { name: 'cap', color: '#e8c24a' },
    { name: 'body', color: '#5aa84a', slot: 'player' },
    { name: 'tan', color: '#d9c79a' },
    { name: 'visor', color: '#a9dbe8' },
    { name: 'vshade', color: '#6aa6ba' },
    { name: 'glint', color: '#ffffff' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear on the suit, in tones of the player's colour: a rubbed patch, and soot. One quiet mark a wear: on a
    // smooth bean two dark blobs read as spots.
    { name: 'scuff', color: '#808080', on: 2, tone: 10 },
    { name: 'scorch', color: '#808080', on: 2, tone: -16 },
    { name: 'note', color: '#f4e38a' },
  ],
  slots: [
    { name: 'note', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // No face: the visor is its face, drawn as it is, and no face kit draws over it. The glint is found as the
  // one "eye" only so the build has a place to set the sticky note from and the wear's chin; with no `face`,
  // nothing is drawn on it. Below the band's top is the jerrycan's handle hole, white like the glint.
  eyes: { role: 'glint', area: [0.1, 4], gap: [99, 99], specks: {}, count: 1, band: [0.17, 0.6] },
  wear: {
    on: ['body'],
    chin: 2.5,
    marks: [[['scuff', 0.6, 0.62, 1.1]], [['scorch', 0.62, 0.7, 1.0]]],
  },
  // A sticky note on the visor, small enough to leave the visor its read.
  accessories: [{ slot: 'note', role: 'note', at: 'cheek', size: [1.5, 1.3] }],
  gait: { bounce: [0.1, 0.6], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    // The image model won't move a bean off the design's stance (four tries came back as the idle): its second idle
    // is the design rocked back 8° on its rear heel (a PIL rotate about that heel), an impatient rock looking up.
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [0.9, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 26 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200] },
    wall: { frames: ['wall'], loop: true, fps: 1 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  poses: {
    'walk-1': { pose: 'waddling to the right, mid-step: the near stubby leg forward, the far leg back, the whole bean rocking forward onto the front leg.' },
    'walk-2': { pose: 'waddling to the right, the legs passing under the bean: one stubby leg planted, the other lifted a little, the bean rocking back.' },
    'run-1': { pose: 'running fast to the right, the whole bean leaning well forward, the stubby legs wide apart in a long stride.' },
    'run-2': { pose: 'running fast to the right, the whole bean leaning well forward, both stubby legs off the ground and gathered under it.' },
    'air-1': { pose: 'jumping straight up, the bean stretched a little tall, both stubby legs tucked up under it.' },
    'air-2': { pose: 'falling, the bean tipped back a little in alarm, both stubby legs dangling apart.' },
    wall: {
      pose: 'seen from its side, it is sliding down a tall wall on the right edge of the picture (do not draw the wall), the front of the bean and its visor pressed against it, both stubby feet braced flat on it, the jerrycan on its back away from the wall.',
      far: true,
    },
    cheer: { pose: 'hopping for joy on the spot, both stubby legs off the ground, the bean tipped back happily.' },
    cheer2: { pose: 'hopping on one stubby leg, the whole bean leaning far back and over with glee, the other leg kicked high up in front of it.' },
    death: {
      pose: 'it has been knocked out and lies flat on its side on the floor, the whole bean horizontal across the picture, the visor on the right and the stubby legs limp on the left, the jerrycan still strapped on its back. Seen from the side.',
      far: true,
    },
  },
};
