import type { FlatKind } from '../kinds';

// On all four legs, side on: upright on two, ten blind readers took it for a fox or the bandicoot. Every pose keeps
// what only a horse has in outline: the mane standing up as a crest along a long neck, the long blunt head, the long
// straight tail hanging behind, and the hooves. The poses were drawn three to a 16:9 image with the design as the
// reference and cut apart (art/sprites/horse/design.prompt.txt).
const KEEP =
  'the red scarf always wound round its neck, the stiff dark mane always standing up along its neck, the long straight tail always hanging behind, its long blunt head always pointing forward and down, both eyes open';

export const kind: FlatKind = {
  body: 180,
  map: {
    roles: ['coat', 'far', 'muzzle', 'mane', 'scarf', 'grey', 'mouth', 'dark'],
    // Sampled from the design (art/sprites/horse/design.png, `swatch.py`).
    families: [
      ['coat', [226, 122, 31]],
      ['coat', [221, 125, 38]],
      ['coat', [199, 112, 44]],
      // The far legs, and the coat's cel shadow under the belly and the neck, in the drawing's one shade.
      ['far', [134, 68, 36]],
      ['far', [138, 70, 39]],
      ['far', [126, 61, 38]],
      ['far', [129, 69, 43]],
      ['muzzle', [243, 220, 179]],
      ['muzzle', [236, 208, 162]],
      ['muzzle', [199, 147, 103]],
      // The eye whites and the teeth: the muzzle's pale.
      ['muzzle', [250, 248, 240]],
      // The mane, the tail, the hooves and the nostrils: one dark brown in the drawing, so one role.
      ['mane', [71, 49, 35]],
      ['mane', [79, 55, 41]],
      ['mane', [60, 36, 28]],
      ['mane', [66, 44, 33]],
      ['mane', [87, 50, 37]],
      ['mane', [92, 40, 24]],
      ['scarf', [178, 66, 52]],
      ['scarf', [132, 44, 36]],
      // The zip and the knee patch: steel and grey cloth.
      ['grey', [138, 138, 126]],
      ['grey', [178, 178, 170]],
      ['mouth', [215, 110, 105]],
      ['mouth', [190, 80, 80]],
      ['dark', [29, 8, 8]],
      ['dark', [48, 15, 14]],
      ['dark', [50, 6, 4]],
      ['dark', [49, 26, 23]],
    ],
    line: 'dark',
    thin: ['coat', 'far', 'muzzle', 'mane', 'scarf', 'grey', 'mouth'],
    fringe: 5,
    stroke: 2.4,
    feet: ['mane'],
    // The scarf's folds and the patch's stitches are slivers: under a part worth a shape, they fold away.
    min: { dark: 0.05, grey: 0.15, mouth: 0.2, scarf: 0.4, far: 0.6 },
  },
  roles: [
    // The costume is the player's colour; the far legs and the scarf darks of it, far enough apart to stay shapes.
    { name: 'coat', color: '#c8743a', slot: 'player' },
    { name: 'far', color: '#808080', on: 0, tone: -14 },
    { name: 'muzzle', color: '#e6cfae' },
    // A colourway is the mane, tail and hooves together (VARIETY.palette): dark bay, black or chestnut. Neutrals only.
    { name: 'mane', color: '#4a3428', alts: ['#302c2c', '#74492f'], vary: 6 },
    { name: 'scarf', color: '#808080', on: 0, tone: -28 },
    { name: 'grey', color: '#9a9c98' },
    { name: 'mouth', color: '#9a3d36' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear on the costume, in tones of the player's colour: a faded patch, and soot.
    { name: 'scuff', color: '#808080', on: 0, tone: 12 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // The drawn eyes are big whites round a small pupil, the far one peeking over the brow hard against the outline.
  // The near pupil is the biggest speck in the head's band, found in the role map, and the far eye is set from it.
  eyes: { role: 'dark', from: 'map', area: [0.12, 0.8], gap: [1, 4], band: [0, 0.7], count: 1, pair: [1.5, -0.1], specks: { dark: 0.4 } },
  wear: {
    on: ['coat'],
    // Bucking, its head is lower than its back: below the chin is only its legs, so the marks may sit higher, on the
    // body, still well clear of the eyes.
    chin: -6,
    marks: [[['scuff', 0.4, 0.6, 0.4]], [['scorch', 0.4, 0.6, 0.4]]],
  },
  // On the jowl, under and behind the near eye.
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.8, 0.8] }],
  face: { r: 0.65, iris: '#2a1f1a' },
  gait: { bounce: [0.2, 0.9], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28 },
    // Stretched out flat, the gallop is longer than the box at the body size.
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 44, scale: 0.86 },
    // The buck's tail stands up over the box's top in the air.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box', scale: 0.8 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.86 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/horse/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing still, pawing the ground with one front hoof raised and bent, its head held high, a smug grin; ${KEEP}.` },
    'walk-1': {
      pose: `walking to the right at a high-stepping trot, the near front leg lifted high with its knee bent and its hoof dangling, the far back leg lifted, the other two legs planted; ${KEEP}.`,
    },
    'walk-2': {
      pose: `walking to the right at a trot, the legs passing under the body, all four hooves close to the ground, one front hoof just lifted; ${KEEP}.`,
    },
    'run-1': {
      pose: `galloping flat out to the right, stretched out long: both front legs reaching far forward, both back legs kicked far back, the neck stretched forward, the mane and tail streaming back; ${KEEP}.`,
    },
    'run-2': {
      pose: `galloping flat out to the right, gathered: all four legs tucked up under its body, every hoof off the ground, the back rounded, the mane and tail streaming back; ${KEEP}.`,
    },
    'air-1': {
      pose: `leaping up and forward over a fence like a show jumper, both front legs folded up tight under its chest, both back legs stretched out behind, the neck reaching forward; ${KEEP}.`,
    },
    'air-2': { pose: `falling, all four legs stretched straight down below it, the mouth open in alarm, the mane and tail flying up; ${KEEP}.` },
    wall: {
      pose: `seen from its side, facing right, it is rearing up on its hind legs against a tall wall on the right edge of the picture (do not draw the wall), both front hooves braced flat against the wall, its head turned to look back at us; ${KEEP}.`,
      far: true,
    },
    cheer: { pose: `rearing up tall on its hind legs, both front legs pawing the air high, its head thrown up, a huge buck-toothed grin; ${KEEP}.` },
    cheer2: { pose: `bucking with joy: its front hooves planted, both back legs kicked high up into the air behind it, a big grin; ${KEEP}.` },
    death: {
      pose: 'it has been knocked out and lies on its side on the floor, the whole body horizontal across the picture, its head on the left and its rump on the right, all four legs sticking stiffly straight up in the air, the tongue out, eyes shut, the red scarf still round its neck. Seen from the side.',
      far: true,
    },
  },
};
