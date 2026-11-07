import type { FlatKind } from '../kinds';

// Every pose keeps the shapes that carry him (art/sprites/skeleton/design.prompt.txt): the huge round grinning skull
// with its black sockets, one lit; the plastic hanging loop on its crown, the decoration's (ours); the grey fur hood
// round his neck; the baggy hoodie with its ragged hem and both hands in its pockets; the ketchup bottle in the side
// pocket.
const KEEP =
  'every one keeping the huge round grinning skull with its black sockets and one cyan pupil, the hanging loop on top, the grey fur hood, the baggy blue hoodie with both hands in its pockets and the red ketchup bottle in its side pocket';

export const kind: FlatKind = {
  body: 175,
  map: {
    roles: ['hoodie', 'bottle', 'bone', 'lip', 'teeth', 'nose', 'fur', 'shorts', 'dark'],
    // Sampled from the design (art/sprites/skeleton/design.png, `swatch.py` and by region).
    families: [
      // The hoodie, its cel shade and folds.
      ['hoodie', [83, 129, 185]],
      ['hoodie', [84, 125, 177]],
      ['hoodie', [83, 127, 181]],
      ['hoodie', [57, 87, 130]],
      ['hoodie', [61, 84, 118]],
      ['hoodie', [59, 86, 125]],
      ['hoodie', [66, 96, 136]],
      ['hoodie', [63, 97, 143]],
      ['hoodie', [96, 130, 171]],
      ['hoodie', [81, 112, 147]],
      ['hoodie', [119, 139, 167]],
      ['hoodie', [104, 124, 151]],
      // The ketchup bottle and its cap.
      ['bottle', [180, 52, 42]],
      ['bottle', [174, 48, 36]],
      ['bottle', [176, 66, 60]],
      ['bottle', [140, 40, 36]],
      ['bottle', [112, 55, 59]],
      // The skull, the bones and the loop: bone, its tan cel shade and the gloss folded in.
      ['bone', [232, 226, 206]],
      ['bone', [230, 224, 205]],
      ['bone', [237, 233, 215]],
      ['bone', [228, 226, 206]],
      ['bone', [219, 214, 203]],
      ['bone', [242, 239, 223]],
      ['bone', [250, 249, 240]],
      ['bone', [171, 157, 147]],
      ['bone', [184, 170, 156]],
      ['bone', [184, 164, 143]],
      ['bone', [174, 156, 132]],
      // The teeth, painted one placeholder colour (art/sprites/skeleton/sockets.py).
      ['teeth', [255, 0, 255]],
      // The grin's rim round the teeth, painted its own colour (sockets.py): drawn as thin ink it was dropped.
      ['lip', [0, 255, 255]],
      // The nose, painted its own colour (sockets.py), so it isn't taken for a speck of the drawn face.
      ['nose', [0, 200, 0]],
      // The fur trim and the fluffy slippers: one grey fluff.
      ['fur', [191, 191, 191]],
      ['fur', [180, 180, 180]],
      ['fur', [123, 118, 118]],
      ['fur', [126, 126, 120]],
      ['fur', [198, 198, 210]],
      ['fur', [204, 204, 216]],
      ['fur', [150, 150, 168]],
      // The shorts.
      ['shorts', [50, 54, 65]],
      ['shorts', [78, 84, 84]],
      ['shorts', [48, 54, 54]],
      ['shorts', [42, 48, 54]],
      // The ink and the sockets, filled solid (art/sprites/skeleton/sockets.py).
      ['dark', [30, 16, 27]],
      ['dark', [1, 1, 2]],
      ['dark', [19, 11, 23]],
      ['dark', [22, 16, 30]],
      ['dark', [11, 5, 13]],
      ['dark', [24, 12, 24]],
    ],
    line: 'dark',
    thin: ['hoodie', 'bottle', 'bone', 'teeth', 'lip', 'nose', 'fur', 'shorts'],
    fringe: 5,
    stroke: 2.4,
    // The background inside the hanging loop.
    holes: 0.3,
    feet: ['fur'],
    min: { dark: 0.3, bottle: 0.3 },
  },
  roles: [
    // The costume: the hoodie in the player's colour, the ketchup bottle a light of it.
    { name: 'hoodie', color: '#5381b9', slot: 'player' },
    { name: 'bottle', color: '#808080', on: 0, tone: 34 },
    // Bone a step warmer than the teeth, so the grin is a white band in the skull at play scale.
    { name: 'bone', color: '#ebe6da' },
    // The rim before the teeth: a part is drawn whole, so the rim drawn after them covered them.
    { name: 'lip', color: '#2a2230' },
    { name: 'teeth', color: '#ffffff' },
    { name: 'nose', color: '#2a2230' },
    // A colourway is the fur and the slippers (VARIETY.palette): a grey, a darker grey, a warm fawn. Neutrals only.
    { name: 'fur', color: '#b6b4ae', alts: ['#9c9890', '#c8bca8'], vary: 6 },
    { name: 'shorts', color: '#4a4e56' },
    { name: 'dark', color: '#1c1620' },
    { name: 'scuff', color: '#808080', on: 0, tone: 16 },
    { name: 'scorch', color: '#808080', on: 0, tone: -14 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // The two sockets, solid black: the near one big, the far one foreshortened beside the nose.
  eyes: { role: 'dark', from: 'map', area: [0.4, 6], gap: [1.5, 5], band: [0.12, 0.42], specks: { dark: 6 } },
  wear: {
    on: ['hoodie'],
    chin: 5,
    marks: [[['scuff', 0.35, 0.55, 0.3]], [['scorch', 0.6, 0.6, 0.28]]],
  },
  // On the cranium behind the near socket: on a ball's crown a cross reads as a bow.
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.4, 0.55], offset: [-0.8, -3.2] }],
  // A skull's sockets, the far one lit (`socket` in the face kit's EYES), drawn where the drawing has them.
  face: { r: 1.3, iris: '#8ff0ff', eye: 'socket', far: 'turned', mark: 0.5 },
  // A lazy shuffle: little bounce, a slouch.
  gait: { bounce: [0.1, 0.4], lean: [0, 0.02] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    // Pulls the ketchup out.
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.6, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 22 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 34 },
    // Rising, the lazy hop; falling, the arms flung out and a slipper flying off.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box', scale: 0.9 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.84 },
    // The thumbs up; the ketchup toast.
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.8, 0.3] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.8, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.8 },
  },
  // Drawn three to an image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/skeleton/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: {
      pose: `leaning back lazily, one hand in a pocket, the other holding the ketchup bottle out to the side at belly height, clear of his body; ${KEEP}.`,
    },
    'walk-1': {
      pose: `walking lazily to the right, a slouching shuffle, the near slipper forward and the far one back, both hands in the hoodie pockets; ${KEEP}.`,
    },
    'walk-2': { pose: `walking lazily to the right, the legs passing under him, one slipper lifted a little, both hands in the pockets; ${KEEP}.` },
    'run-1': {
      pose: `jogging to the right, leaning forward, the near knee raised and the far leg pushing off behind, both hands still in the pockets; ${KEEP}.`,
    },
    'run-2': { pose: `jogging to the right mid-stride, both slippers off the ground, the legs apart front and back, hands in the pockets; ${KEEP}.` },
    'air-1': { pose: `a lazy hop straight up, knees tucked up under the hoodie, hands in the pockets, both eye sockets open; ${KEEP}.` },
    'air-2': {
      pose: `falling, both slippers dangling down apart, both arms flung out wide to the sides, the ketchup bottle still in the side pocket; ${KEEP}.`,
    },
    wall: {
      pose: 'seen from his side, facing right: he is sliding down a tall wall on the right edge of his space (do not draw the wall), one hand and both slippers braced flat against it, knees bent, the other hand in his pocket, his skull turned to look back at us, eye sockets open.',
      far: true,
    },
    cheer: { pose: `a lazy cheer, one hand in a pocket, the other giving a big thumbs up held out level in front of him, clear of his body; ${KEEP}.` },
    cheer2: {
      pose: `a toast, one hand in a pocket, the other raising the ketchup bottle up high out to the side beside his skull, with white space between the bottle and the skull; ${KEEP}.`,
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, his skull on the left and his slippers on the right, arms and legs splayed limp, the hanging loop and the ketchup bottle still on him, eye sockets empty.',
      far: true,
    },
  },
};
