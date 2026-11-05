import type { FlatKind } from '../kinds';

// Every pose keeps the three shapes that carry her (art/sprites/stinger/design.prompt.txt): the white mask's two long
// horns, sharp crescents hooking back, with background between them (the read: no one else has a horned mask; drawn
// straighter, they read as a rabbit's ears in the first blind read); the cloak a short bell with her thin dark legs
// clearly under it (a long garment on a slim figure read as a gown); and the knitting needle, thick, held level and
// sticking out past her body on both sides (thin, it vanished at play size).
const KEEP =
  "the white mask's two long horns always sharp crescents sweeping up and hooking back, with white background between them, the striped dishcloth cloak always a short bell with her two thin black legs clearly under it, the thick steel knitting needle always held level in one fist, sticking far out past her body on both sides, the yarn hanging from its round knob";

export const kind: FlatKind = {
  body: 155,
  map: {
    roles: ['cloak', 'stripe', 'grey', 'white', 'dark'],
    // Sampled from the design (art/sprites/stinger/design.png, `swatch.py`) and its walk drawing.
    families: [
      // The dishcloth cloak and its cel shade, the shade folded in.
      ['cloak', [158, 48, 53]],
      ['cloak', [151, 44, 51]],
      ['cloak', [167, 64, 68]],
      ['cloak', [138, 60, 64]],
      ['cloak', [148, 49, 52]],
      ['cloak', [107, 31, 44]],
      ['cloak', [106, 66, 66]],
      // The dishcloth's two pale stripes and their shade.
      ['stripe', [225, 150, 154]],
      ['stripe', [218, 144, 147]],
      ['stripe', [167, 124, 127]],
      ['stripe', [162, 131, 130]],
      // The patch and the needle: one grey.
      ['grey', [164, 159, 155]],
      ['grey', [152, 154, 153]],
      ['grey', [135, 133, 137]],
      // The mask and horns, their cel shade, and the yarn, one neutral white.
      ['white', [241, 237, 225]],
      ['white', [241, 234, 217]],
      ['white', [218, 209, 204]],
      ['white', [186, 175, 180]],
      ['white', [188, 165, 174]],
      // The ink, the thin black limbs and the eye holes.
      ['dark', [33, 25, 34]],
      ['dark', [45, 32, 41]],
      ['dark', [54, 47, 54]],
      ['dark', [48, 17, 28]],
      ['dark', [11, 7, 11]],
      ['dark', [1, 0, 0]],
    ],
    line: 'dark',
    thin: ['cloak', 'stripe', 'grey', 'white'],
    fringe: 5,
    stroke: 2.4,
    // The background the figure closes in (inside the yarn's loop, between the arm and the cloak) cut through.
    holes: 0.6,
    feet: ['dark'],
    // The needle is carried, so the body's size is the bug in her cloak, alike in every pose.
    loose: ['grey'],
    min: { dark: 0.1, stripe: 0.5, grey: 0.4, cloak: 0.8 },
  },
  roles: [
    // The costume: the cloak, in the player's colour; the dishcloth's stripes a light of it.
    { name: 'cloak', color: '#b8343c', slot: 'player' },
    { name: 'stripe', color: '#808080', on: 0, tone: 30 },
    // A colourway is the needle and the patch (VARIETY.palette), neutrals all: steel, bamboo, charcoal.
    { name: 'grey', color: '#a4a2a0', alts: ['#c4a878', '#6e6a66'], vary: 6 },
    // The mask: a face, so neutral.
    { name: 'white', color: '#f2eee6' },
    { name: 'dark', color: '#2a2630' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // The mask's two black eye holes: the biggest pair of dark specks under the horns.
  eyes: { role: 'dark', area: [0.3, 5], gap: [1, 4.5], band: [0.2, 0.6], specks: { dark: 5 } },
  wear: {
    on: ['cloak'],
    chin: 4,
    marks: [[['scuff', 0.45, 0.55, 0.3]], [['scorch', 0.4, 0.75, 0.42]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.6, 0.7] }],
  face: { r: 0.95, iris: '#1c1a24', eye: 'hole' },
  gait: { bounce: [0.1, 0.6], lean: [0, 0.04] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 26 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.88 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.9 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.7 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/stinger/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: {
      pose: `standing still, leaning on the knitting needle planted point down on the floor beside her like a cane, her head tilted a little, ${KEEP}.`,
    },
    'walk-1': { pose: `walking to the right with quick light steps, mid-step, the near leg forward and the far leg back, ${KEEP}.` },
    'walk-2': { pose: `walking to the right, the legs passing under the cloak, one foot planted and the other just lifted, ${KEEP}.` },
    'run-1': {
      pose: `dashing fast to the right, leaning far forward, the near knee raised high in front and the far leg pushing off far behind, the cloak flying out behind her, ${KEEP}.`,
    },
    'run-2': {
      pose: `dashing to the right, mid-stride, both feet off the ground, the legs split wide apart front and back, the cloak flying out behind, ${KEEP}.`,
    },
    'air-1': { pose: `jumping up, both thin legs tucked up under the cloak, the cloak flaring out below, ${KEEP}.` },
    'air-2': { pose: `falling, both thin legs reaching straight down and apart, the cloak blown up a little at its hem, the needle held out level, ${KEEP}.` },
    wall: {
      pose: 'seen from her side, facing right: she is clinging to a tall wall on the right edge of her space (do not draw the wall), both thin black feet and one hand braced flat against it, knees bent, the knitting needle held out level away from the wall to the left, her mask turned to look back at us.',
      far: true,
    },
    cheer: {
      pose: `cheering, up on her toes, the knitting needle thrust up and forward at a steep slant like a salute, its point far out in front of her horns, clear of her head, ${KEEP}.`,
    },
    cheer2: {
      pose: `a little curtsy, one thin black hand holding the cloak's hem out to the side, one knee bent, the needle held out level in the other hand, ${KEEP}.`,
    },
    death: {
      pose: 'she has been knocked out and lies flat on her back on the floor, the whole body horizontal, her mask and horns on the left and her feet on the right, the cloak spread flat, the knitting needle dropped flat on the floor beside her.',
      far: true,
    },
  },
};
