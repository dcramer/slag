import type { FlatKind } from '../kinds';

// Every pose keeps the two shapes that carry him side on: the smooth shell dome on his back with its rim and
// its few big spikes, and the big horned head with its open jaw out front. Spikes all round (the second round)
// read as a hedgehog or a porcupine; arms flung up (the first) as the ape.
const KEEP =
  'the smooth green shell dome always on his back with its cream rim and its few big spikes along the top, his head always out in front with the long horns, the crown and the open crocodile jaw';

export const kind: FlatKind = {
  body: 305,
  map: {
    roles: ['shell', 'plate', 'bone', 'skin', 'belly', 'mane', 'crown', 'mouth', 'dark'],
    // Sampled from the design (the third round: art/sprites/king/design.prompt.txt) and its poses.
    families: [
      ['shell', [60, 129, 54]],
      ['shell', [70, 123, 57]],
      ['shell', [59, 84, 42]],
      ['shell', [45, 92, 38]],
      ['shell', [80, 120, 66]],
      ['shell', [84, 122, 75]],
      ['shell', [114, 145, 124]],
      ['plate', [153, 160, 166]],
      ['plate', [159, 163, 167]],
      ['plate', [118, 108, 109]],
      // The rim, the spikes, the horns and the fangs, and their shade.
      ['bone', [243, 235, 196]],
      ['bone', [242, 228, 180]],
      ['bone', [249, 235, 200]],
      ['bone', [238, 228, 203]],
      ['bone', [190, 155, 117]],
      ['bone', [178, 147, 110]],
      ['bone', [171, 134, 90]],
      ['bone', [185, 157, 127]],
      ['skin', [239, 175, 39]],
      ['skin', [235, 171, 46]],
      ['skin', [242, 182, 65]],
      ['skin', [249, 191, 100]],
      ['skin', [169, 110, 30]],
      ['skin', [163, 97, 14]],
      ['skin', [179, 112, 15]],
      ['belly', [232, 211, 147]],
      ['belly', [229, 208, 155]],
      ['belly', [215, 194, 135]],
      ['belly', [196, 167, 113]],
      ['mane', [200, 77, 39]],
      ['mane', [212, 83, 38]],
      ['mane', [183, 95, 42]],
      ['mane', [150, 52, 27]],
      ['mane', [130, 52, 32]],
      ['crown', [167, 201, 229]],
      ['crown', [128, 149, 173]],
      ['crown', [154, 163, 178]],
      ['mouth', [213, 102, 92]],
      ['mouth', [160, 63, 60]],
      ['mouth', [108, 46, 39]],
      ['mouth', [84, 30, 30]],
      ['dark', [33, 3, 1]],
      ['dark', [38, 10, 0]],
      ['dark', [59, 24, 15]],
      ['dark', [62, 0, 0]],
      ['dark', [40, 42, 21]],
      // The fangs are drawn white, the cream of the horns at play size.
      ['bone', [255, 255, 255]],
    ],
    line: 'dark',
    thin: ['shell', 'plate', 'bone', 'skin', 'belly', 'mane', 'crown', 'mouth'],
    fringe: 5,
    stroke: 2.4,
    feet: ['skin'],
    min: { dark: 0.12, plate: 0.3, mouth: 0.2, crown: 0.3 },
  },
  roles: [
    // The shell, a dark of the player's colour; the skin is the costume (Decisions 4, the neutral palette), the
    // largest region on him: a fixed gold there made every king the same king.
    { name: 'shell', color: '#808080', on: 3, tone: -20 },
    // A colourway is the patch plate (VARIETY.palette): steel, black iron, tin.
    { name: 'plate', color: '#9aa0a8', alts: ['#5d6168', '#bdb6a6'], vary: 6 },
    { name: 'bone', color: '#efe2c0' },
    { name: 'skin', color: '#e8b23c', slot: 'player' },
    { name: 'belly', color: '#e9d29a' },
    // The mane, a light of the skin. As a dark below the shell's (−36) it was as dark as the silhouette's ink on
    // the blue, purple and sky kings, and sank into the outline and the shell.
    { name: 'mane', color: '#808080', on: 3, tone: 20 },
    // The paper crown: a lighter tone still, so it stays a shape on the mane behind it.
    { name: 'crown', color: '#808080', on: 3, tone: 38 },
    { name: 'mouth', color: '#9a3d36' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'scuff', color: '#808080', on: 0, tone: 12 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // Side on, one eye shows; the far one is set along the snout from it. Each drawing's eye is inked solid
  // (art/sprites/king/design.prompt.txt), and the band and area keep it from the open jaw's dark throat just
  // below, which is bigger: with them open, the kit's eyes sat in his mouth.
  eyes: { role: 'dark', from: 'map', area: [0.2, 0.95], band: [0.1, 0.37], gap: [0.8, 4.5], specks: { dark: 2.8 }, count: 1, pair: [1.6, 0] },
  wear: {
    on: ['shell'],
    chin: 1.5,
    // Low on the shell, clear of the patch plate and the spikes.
    marks: [
      [
        ['scuff', 0.2, 0.7, 0.36],
        ['scuff', 0.1, 0.45, 0.3],
      ],
      [
        ['scorch', 0.2, 0.7, 0.36],
        ['scorch', 0.1, 0.45, 0.3],
      ],
    ],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2, 0.8] }],
  face: { r: 1, iris: '#2a1f1a', eye: 'scowl', far: 'none' },
  gait: { bounce: [0.1, 0.5], lean: [0, 0.025] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 42, scale: 0.89 },
    // Up on the jump, alarmed on the fall, and tucked into the shell near the fall's top speed (450).
    air: { frames: ['air-1', 'air-2', 'air-2', 'tuck'], loop: false, vy: [-200, 600], scale: 0.93 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.88 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Drawn three to a 16:9 image (the design as the reference) and cut apart: art/sprites/king/design.prompt.txt.
  // These are each pose alone, for a redraw.
  poses: {
    'walk-1': { pose: `stomping heavily to the right, mid-step, the near clawed foot forward and the far foot back, fists low, ${KEEP}.` },
    'walk-2': { pose: `stomping to the right, the legs passing under the body, one foot planted flat and the other lifted a little, ${KEEP}.` },
    idle2: { pose: `standing with his thick arms folded across his chest, smug, his feet planted wide apart, his jaw shut in a toothy smirk, ${KEEP}.` },
    'run-1': { pose: `running hard to the right, leaning forward, one knee high and the other leg pushing off, the near fist pumping, ${KEEP}.` },
    'run-2': { pose: `running hard to the right, leaning forward, both feet off the ground with the legs gathered under him, the arms swinging, ${KEEP}.` },
    'air-1': { pose: `jumping up, his knees tucked up under him and his fists clenched in front of his chest, roaring, ${KEEP}.` },
    'air-2': { pose: `falling, the legs reaching down, the fists out in front of him at his chest, his jaw open in alarm, ${KEEP}.` },
    tuck: {
      pose: 'tucked into his shell in mid-air like a turtle hiding, facing right: his arms and legs pulled all the way in, his head with its horns, crown and open jaw peeking out of the front of the shell, the smooth green shell dome with its rim and few big spikes filling the figure, seen from the side.',
      far: true,
    },
    wall: {
      pose: 'seen from his side, he is sliding down a tall wall on the right edge of the figure (do not draw the wall), one hand flat against it and both feet braced on it, the shell on his back away from the wall, his head turned back over his shoulder toward us, his eye open.',
      far: true,
    },
    cheer: { pose: `cheering, both fists pumped up in front of his chest, a big open roar, up on his toes, ${KEEP}.` },
    cheer2: { pose: `laughing, one hand on his belly, his jaw wide open, ${KEEP}.` },
    death: {
      pose: 'knocked out, flipped over on his back like an upturned turtle, lying on his round shell on the floor, his body horizontal with his head on the left and his feet on the right, arms and legs limp in the air, eyes shut, the paper crown still on his head, seen from the side.',
      far: true,
    },
  },
};
