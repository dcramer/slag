import type { FlatKind } from '../kinds';

// Every pose keeps what carries him (art/sprites/mushroom/design.prompt.txt): the huge round cap, a dome with a
// rolled lip much wider than him, level on his head with his small face under its rim (the read in black); the
// chequered flag on its taped broom handle held out level ahead below the rim, with background round it (raised
// beside the cap it joined the dome and the outline stopped being a dome; upright beside him it's the mage's staff);
// the vest with its crooked race plate over the puffy trousers.
const KEEP =
  "always the huge round white spotted mushroom cap the same size as in the reference, a wide dome with a rolled lip much wider than him, level on his head with his small face under its rim, the chequered flag on its taped broom handle held out level ahead of him at shoulder height, below the cap's rim and clear of the cap with white background round it, the red vest with the crooked race plate, the white puffy trousers";

export const kind: FlatKind = {
  body: 263,
  map: {
    roles: ['white', 'skin', 'red', 'trim', 'wood', 'check', 'dark'],
    // Sampled from the design (art/sprites/mushroom/design.png, `swatch.py` and by hand).
    families: [
      // The spots, the patch and the vest, and the vest's cel shade.
      ['red', [187, 63, 54]],
      ['red', [182, 61, 53]],
      ['red', [188, 61, 53]],
      ['red', [179, 57, 52]],
      ['red', [152, 40, 48]],
      ['red', [155, 31, 41]],
      ['red', [153, 81, 77]],
      // The vest's dark trim.
      ['trim', [79, 23, 33]],
      // The lampshade's white, its cel shade and the underside of its lip, the trousers, the race plate and the flag's
      // white squares.
      ['white', [243, 239, 227]],
      ['white', [245, 240, 229]],
      ['white', [240, 235, 225]],
      ['white', [244, 236, 227]],
      ['white', [196, 182, 187]],
      ['white', [199, 177, 181]],
      ['white', [174, 155, 155]],
      // Skin and its shade.
      ['skin', [255, 208, 168]],
      ['skin', [247, 210, 179]],
      ['skin', [230, 196, 177]],
      ['skin', [212, 139, 123]],
      // The broom handle.
      ['wood', [180, 138, 86]],
      ['wood', [150, 108, 64]],
      // The tape on the handle, the lampshade's wire and the safety pin, folded into the white: a grey of their own
      // took the shade under the cap's lip with it and speckled the rim.
      ['white', [160, 154, 164]],
      ['white', [138, 134, 140]],
      // The ink, the eyes and the flag's black squares.
      ['dark', [42, 16, 32]],
      ['dark', [40, 12, 29]],
      ['dark', [33, 5, 19]],
    ],
    line: 'dark',
    thin: ['red', 'trim', 'white', 'skin', 'wood'],
    fringe: 5,
    stroke: 2.4,
    feet: ['skin', 'white'],
    min: { dark: 0.4, trim: 0.3, wood: 0.3 },
  },
  roles: [
    // Back to front: the white first, so the spots and the vest lie on it (the other way, the dome covered them).
    // A colourway is the lampshade and the trousers together (VARIETY.palette): white, a cream or a linen.
    { name: 'white', color: '#f4f0e8', alts: ['#efe2c4', '#e4dccf'], vary: 6 },
    { name: 'skin', color: '#f8cfa8' },
    // The costume: the cap's spots and the vest in the player's colour, the vest's trim a dark of it.
    { name: 'red', color: '#c9473f', slot: 'player' },
    { name: 'trim', color: '#808080', on: 2, tone: -26 },
    { name: 'wood', color: '#b48a56' },
    // The flag's dark squares and the race plate's ring, a grey: in the ink, the flag was a black blot in his hand
    // and the ring a mouth on his chest.
    { name: 'check', color: '#6c6672' },
    { name: 'dark', color: '#2a1420' },
    // The wear is on the trousers, the one bare surface under his face: tones of the white.
    { name: 'scuff', color: '#808080', on: 0, tone: -16 },
    { name: 'scorch', color: '#808080', on: 0, tone: -44 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', from: 'map', area: [0.1, 1.5], gap: [0.8, 3], band: [0.35, 0.6], edge: 0.2, glint: 0.25, specks: { dark: 2 } },
  recolour: { from: 'dark', to: 'check', below: 1, lying: [0.3, -99] },
  wear: {
    on: ['white'],
    chin: 6,
    marks: [[['scuff', 0.35, 0.65, 0.22]], [['scorch', 0.6, 0.7, 0.2]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.1, 0.45] }],
  // The drawing's eyes are small black ovals with a glint, no white: the kit's `dot`. The `tall` eye brings the
  // puffball's blush with it, and the two round small kinds must not share a face.
  face: { r: 0.5, iris: '#2a1420', eye: 'dot' },
  gait: { bounce: [0.3, 0.8], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 20 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 30 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200] },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.9 },
    // Waving the flag, his eyes squeezed shut in the shout.
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.6, 0.3], eyes: false },
    // The proud bow, his eyes shut in a smile.
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.7, 0.3], eyes: false },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.8 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/mushroom/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing still, nervous, the free hand on his belly, the flag held out low ahead, ${KEEP}.` },
    'walk-1': { pose: `scurrying to the right in quick short steps, the near foot stepping forward, ${KEEP}.` },
    'walk-2': { pose: `scurrying to the right, the legs passing under him, one foot planted and the other lifted behind, ${KEEP}.` },
    'run-1': { pose: `running fast to the right, leaning forward, the near knee raised in front and the far leg pushing off behind, ${KEEP}.` },
    'run-2': { pose: `running to the right mid-stride, both feet off the ground, the legs wide apart front and back, ${KEEP}.` },
    'air-1': { pose: `a frantic hop straight up, both feet tucked up under him, the free arm flung out to the side, eyes wide, ${KEEP}.` },
    'air-2': { pose: `falling, both feet reaching down and apart, the free arm thrown out behind him, eyes wide, ${KEEP}.` },
    wall: {
      pose: 'seen from his side, facing right: he is clinging to a tall wall on the right edge of his space (do not draw the wall), both feet and his free hand braced flat against it, knees bent, the huge round white spotted mushroom cap level on his head, a wide dome with a rolled lip, the flag held out away from the wall to the left, his face turned to look back at us, eyes open.',
      far: true,
    },
    cheer: {
      pose: `cheering, a happy little jump with both feet kicked up behind him, the free arm flung out behind, his mouth open in a happy shout, ${KEEP}.`,
    },
    cheer2: { pose: `a deep proud bow, bent forward at the waist with the cap tipped toward us, the free hand on his belly, eyes shut happily, ${KEEP}.` },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, his head on the left and his feet on the right, arms and legs splayed limp, the huge spotted cap still on his head lying on its side, the flag dropped on the floor beside him, his eyes shut. Seen from the side.',
      far: true,
    },
  },
};
