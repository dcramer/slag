import type { FlatKind } from '../kinds';

// Side on, a chunky little dancer at the cast's size, her thick purple ponytail springing up high from the ring on her
// crown and falling back behind her like a fountain, background between it and her head and back; two balloon harem
// trousers with background between the legs, the cropped top, the tin-foil tiara. The cast's box has height to spare,
// not width: a plume swept straight back read at play size as a squirrel's tail and a level rope as a bazooka, both on
// a body half the cast's (art/sprites/genie/r1/, r2/). Drawn three to a 16:9 image with the design as the reference
// and cut apart (art/sprites/genie/design.prompt.txt).
const KEEP =
  'her thick purple ponytail springing up high from the white ring on top of her head, arching back over and falling behind her like a fountain, with white background between it and her head and back; the foil tiara, the huge round pink harem trousers with a white gap between the two legs, her eyes open';

export const kind: FlatKind = {
  body: 112,
  map: {
    roles: ['hair', 'cloth', 'sash', 'skin', 'foil', 'white', 'eye', 'dark'],
    // Sampled from the design (art/sprites/genie/design.png, `swatch.py`).
    families: [
      // The ponytail and the hair, their cel shade.
      ['hair', [124, 73, 165]],
      ['hair', [123, 72, 165]],
      ['hair', [91, 47, 138]],
      ['hair', [81, 47, 111]],
      ['hair', [120, 71, 160]],
      ['hair', [92, 49, 131]],
      ['hair', [121, 77, 154]],
      ['hair', [110, 66, 141]],
      // The cropped top and the trousers, their cel shades (the rope edit drew them a little deeper).
      ['cloth', [207, 35, 108]],
      ['cloth', [177, 23, 90]],
      ['cloth', [152, 19, 74]],
      ['cloth', [110, 18, 67]],
      ['cloth', [200, 28, 102]],
      ['cloth', [140, 16, 75]],
      ['cloth', [159, 16, 80]],
      // The sash.
      ['sash', [70, 52, 71]],
      ['sash', [90, 60, 99]],
      ['sash', [72, 46, 85]],
      ['skin', [222, 163, 107]],
      ['skin', [212, 166, 121]],
      ['skin', [139, 88, 111]],
      ['skin', [220, 160, 106]],
      ['skin', [163, 102, 79]],
      ['skin', [205, 166, 135]],
      // The tin-foil tiara and the tape round the ponytail.
      ['foil', [210, 201, 205]],
      ['foil', [202, 206, 210]],
      ['foil', [177, 162, 146]],
      ['foil', [178, 175, 178]],
      ['foil', [151, 158, 164]],
      ['foil', [155, 130, 123]],
      ['foil', [211, 192, 183]],
      // The shower-curtain ring, the hoops and her teeth.
      ['white', [236, 239, 246]],
      ['white', [231, 233, 242]],
      // Her eyes, painted apart (art/sprites/genie/prep.py).
      ['eye', [40, 200, 60]],
      // The ink.
      ['dark', [42, 14, 44]],
      ['dark', [58, 12, 51]],
      ['dark', [86, 11, 54]],
      ['dark', [47, 24, 50]],
      ['dark', [36, 6, 34]],
      ['dark', [18, 1, 33]],
    ],
    line: 'dark',
    thin: ['hair', 'cloth', 'sash', 'skin', 'foil', 'white'],
    fringe: 5,
    stroke: 2.4,
    feet: ['skin'],
    // The ponytail flies out behind: the body's size is her alone, alike in every pose.
    loose: ['hair'],
    // The eyes are found in the map and never traced (`eye` folds into the skin): her small dark oval is narrower
    // than the ink's opening, so it is painted apart first (art/sprites/genie/prep.py).
    min: { dark: 0.4, foil: 0.3, white: 0.3, eye: 5 },
  },
  roles: [
    { name: 'hair', color: '#7c49a5' },
    // The costume: the top and the trousers in the player's colour; the sash a dark of it.
    { name: 'cloth', color: '#cf236c', slot: 'player' },
    { name: 'sash', color: '#808080', on: 1, tone: -30 },
    { name: 'skin', color: '#dea36b' },
    // A colourway is the foil tiara and the tape (VARIETY.palette): silver foil, gold foil or a pale steel.
    { name: 'foil', color: '#c4c8cc', alts: ['#d8bc6c', '#a8b0b8'], vary: 6 },
    { name: 'white', color: '#eceff6' },
    { name: 'eye', color: '#2a0e2c' },
    { name: 'dark', color: '#2a0e2c' },
    { name: 'scuff', color: '#808080', on: 1, tone: 14 },
    { name: 'scorch', color: '#808080', on: 1, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: {
    role: 'eye',
    from: 'map',
    count: 1,
    pair: [-1, 0],
    area: [0.06, 2],
    gap: [0.8, 3.5],
    specks: { eye: 2, dark: 1.5, white: 1 },
    band: [0.15, 0.6],
    edge: 0.2,
  },
  wear: {
    on: ['cloth'],
    chin: 6,
    marks: [[['scuff', 0.55, 0.75, 0.3]], [['scorch', 0.45, 0.6, 0.22]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.2, 0.5], offset: [0, -0.5] }],
  // Her drawn eye is a small dark oval with no white: the kit's `dot`, side on, the far one a sliver.
  face: { r: 0.6, iris: '#2a0e2c', eye: 'dot' },
  gait: { bounce: [0.4, 0.9], lean: [0, 0.03] },
  clips: {
    // She idles in the design's dance, arms out, the ponytail out level behind.
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    // A bouncy dancer's skip.
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28, scale: 0.93 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40, scale: 0.92 },
    // Her jump flicks the ponytail up behind; the fall throws it straight up over her.
    // Smaller in the air: the fall's ponytail flies straight up over the box's top.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.8 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.86 },
    // The hair whip: the ponytail cracked out straight and level, her eyes squeezed shut.
    // A little smaller: the cracked ponytail reaches past the box's side.
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.6, 0.3], eyes: false },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.8, 0.4] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.8 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/genie/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `a dancer's pose, one hand on her hip and the other arm curved out in front of her, weight on one bare foot; ${KEEP}.` },
    'walk-1': { pose: `walking to the right with a bouncy dancer's skip, the near bare foot stepping forward, arms out to the sides; ${KEEP}.` },
    'walk-2': { pose: `walking to the right up on her toes, the legs passing under her, one foot lifted behind; ${KEEP}.` },
    'run-1': {
      pose: `running fast to the right, leaning forward, the near knee raised high in front and the far leg pushing off far behind, arms pumping; ${KEEP}.`,
    },
    'run-2': { pose: `running fast to the right mid-stride, both bare feet off the ground, the legs split wide front and back; ${KEEP}.` },
    'air-1': { pose: `jumping up, both knees tucked up under her, arms out to the sides, the ponytail flicked up high behind her; ${KEEP}.` },
    'air-2': {
      pose: `falling, both bare feet reaching down and apart, arms flung out to the sides, eyes wide and mouth open, the ponytail flying up above her; ${KEEP}.`,
    },
    wall: {
      pose: 'seen from her side, facing right: she is sliding down a tall wall on the right edge of her space (do not draw the wall), one palm flat against it and both bare feet braced on it, knees bent, her other arm out to the left, the ponytail streaming up and out to the left, her head turned to look back at us, eyes open.',
      far: true,
    },
    cheer: {
      pose: `her hair whip, leaning forward with her fists back, the ponytail cracked out straight and level behind her like a flag, her eyes squeezed shut; ${KEEP}.`,
    },
    cheer2: { pose: `standing proudly, both hands on her hips, a big grin; ${KEEP}.` },
    death: {
      pose: 'seen from the side: knocked out, lying flat on her back on the floor, the whole body horizontal, her head on the left and her feet on the right, arms and legs splayed limp, the ponytail spread out on the floor beyond her head, eyes shut.',
      far: true,
    },
  },
};
