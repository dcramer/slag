import type { FlatKind } from '../kinds';

// A chunky little woman with a black bob in a bell of a dress, and over her head, with background all round it, the
// green diamond: a long double point, cracked and taped, hanging crooked (the twist), a beat behind her on the run.
// The diamond is the read and the gap under it the whole of it: joined to her head it is a pointed hat. So no drawing's
// own diamond ships: each is painted out and one diamond, drawn once (art/sprites/sim/gem.py), is hung back over her
// head the same gap above her in every pose (art/sprites/sim/float.py, floats.txt). Drawn three to a 16:9 image with
// the design as the reference and cut apart (art/sprites/sim/design.prompt.txt).
const KEEP = 'her own green diamond floating high above her head with wide white background under it, never touching her hair, her black bob, her blue dress';

export const kind: FlatKind = {
  body: 104,
  map: {
    roles: ['dress', 'shoe', 'skin', 'hair', 'gem', 'gemlit', 'tape', 'dark'],
    // Sampled from the design (art/sprites/sim/design.png, `swatch.py`); the diamond's are gem.py's own.
    families: [
      ['dress', [65, 110, 175]],
      ['dress', [63, 111, 174]],
      ['dress', [71, 107, 163]],
      ['dress', [51, 95, 156]],
      ['dress', [41, 67, 114]],
      ['shoe', [27, 39, 69]],
      ['skin', [254, 191, 144]],
      ['skin', [236, 173, 135]],
      ['skin', [204, 138, 110]],
      // The bob, and its shine folded in: a near-black of its own, a step off the ink, so the pen shows round it.
      ['hair', [36, 30, 41]],
      ['hair', [34, 28, 40]],
      ['hair', [61, 65, 92]],
      ['gem', [70, 200, 74]],
      ['gem', [52, 160, 62]],
      ['gemlit', [158, 232, 122]],
      ['tape', [154, 156, 152]],
      ['tape', [90, 92, 90]],
      ['dark', [24, 15, 25]],
      ['dark', [46, 21, 27]],
      // Her eyes, a warmer near-black than the bob: without it half of them folded into the hair, and no eyes were found.
      ['dark', [50, 30, 38]],
      // The diamond's own ink, a dark green: the line round it, like hers.
      ['dark', [24, 96, 40]],
    ],
    line: 'dark',
    thin: ['dress', 'shoe', 'skin', 'hair', 'gem', 'gemlit', 'tape'],
    fringe: 5,
    stroke: 2.4,
    feet: ['shoe'],
    // The diamond floats: the body's size is her alone, alike in every pose.
    loose: ['gem', 'gemlit', 'tape'],
    min: { dark: 0.3, tape: 0.2 },
    holes: 0.8,
    // No corner-cutting: any rounded the diamond's points, and it read blind as a leaf or a ball.
    smooth: 0,
  },
  roles: [
    // The costume: the dress, in the player's colour; the shoes a dark of it.
    { name: 'dress', color: '#3f6fb5', slot: 'player' },
    { name: 'shoe', color: '#808080', on: 0, tone: -26 },
    { name: 'skin', color: '#efc4a0' },
    // A colourway is the bob (VARIETY.palette), neutrals all: black, a dark brown, a charcoal.
    { name: 'hair', color: '#2a2430', alts: ['#3e2c24', '#3c3c42'], vary: 6 },
    // The diamond keeps its green on every look, the read, like the zapmouse's red cheeks.
    { name: 'gem', color: '#43c24a' },
    { name: 'gemlit', color: '#a2e880' },
    { name: 'tape', color: '#9a9c98' },
    { name: 'dark', color: '#2a1f22' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'smudge', color: '#d0605e' },
  ],
  slots: [
    { name: 'smudge', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', from: 'map', area: [0.04, 1.2], gap: [0.9, 3.2], specks: { dark: 2.4 }, band: [0.3, 0.62], glint: 0.12 },
  wear: {
    on: ['dress'],
    chin: 4,
    marks: [[['scuff', 0.35, 0.6, 0.45]], [['scorch', 0.6, 0.7, 0.4]]],
  },
  // A smudge of lipstick across the cheek.
  accessories: [{ slot: 'smudge', role: 'smudge', at: 'cheek', size: [1.1, 0.4] }],
  face: { r: 0.6, iris: '#2a1f22', eye: 'dot' },
  gait: { bounce: [0.2, 0.8], lean: [0, 0.04] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 26 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box', scale: 0.8 },
    // Smaller on the wall, as in the air: the diamond over her reaches past the box's top when the drawer stretches her.
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.8 },
    // Her eyes are squeezed shut in the cheer.
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25], eyes: false },
    // She waves, the life game's hello.
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/sim/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing politely with both hands clasped in front of her dress, head tilted, a vacant smile, her eyes open; ${KEEP}.` },
    'walk-1': { pose: `walking briskly to the right, mid-step, the near shoe forward and the far shoe back, the arms swinging, her eyes open; ${KEEP}.` },
    'walk-2': {
      pose: `walking to the right with a hitch, the legs passing under the body, weight on the flat shoe that lost its heel, the other foot just lifted behind, her eyes open; ${KEEP}.`,
    },
    'run-1': {
      pose: `running fast to the right, leaning forward, the near knee raised in front and the far leg pushing off behind, the arms pumping, her eyes open; ${KEEP}.`,
    },
    'run-2': {
      pose: `running fast to the right, mid-stride, both shoes off the ground, the legs split apart front and back, the dress flying back, her eyes open; ${KEEP}.`,
    },
    'air-1': {
      pose: `jumping up and forward, rising, both knees tucked up under the dress, both arms out to the sides at shoulder height, her eyes open; ${KEEP}.`,
    },
    'air-2': {
      pose: `falling, both shoes dangling apart below her, both arms flung out to the sides at shoulder height, the dress blown up into a bell, her eyes wide open and her mouth a small round O; ${KEEP}.`,
    },
    wall: {
      pose: `seen from her side, facing right: she is sliding down a tall wall on the right edge of her space (do not draw the wall), both palms and one shoe flat against where the wall would be, the other leg hanging, her head turned to look back at us, her eyes open; ${KEEP}.`,
      far: true,
    },
    cheer: {
      pose: `cheering, up on her toes, one fist pumped up beside her head, the other arm bent at her side, a big happy smile, her eyes squeezed shut; ${KEEP}.`,
    },
    cheer2: { pose: `waving hello with one hand raised at shoulder height, the other hand on her hip, a polite vacant smile, her eyes open; ${KEEP}.` },
    death: {
      pose: 'seen from the side: she has been knocked out and lies flat on her back on the floor, the whole body horizontal, her head on the left and her shoes on the right, arms and legs splayed limp, her eyes shut, her green diamond floating above her with white background under it.',
      far: true,
    },
  },
};
