import type { FlatKind } from '../kinds';

// Every pose keeps what carries her (art/sprites/fighter/design.prompt.txt): the two round sock-covered hair buns
// standing out one each side of the top of her head, both showing, so the head is turned toward us (side on, the far
// one hides behind it); the puffed shoulders and the spiked dog collars on both wrists; thick strong legs under a
// short dress, in a fighter's stance or a kick. Bigger and higher, the buns read as a bear's or a mouse's ears in
// the design read; lower at the temples they vanished into the head.
const KEEP =
  'her head always turned toward us so both round white sock-covered hair buns stand out, one on each side of the top of her head, the big puffed shoulders, the black spiked collars on both wrists, the thick strong legs under the short dress';

export const kind: FlatKind = {
  body: 213,
  map: {
    roles: ['dress', 'trim', 'skin', 'hair', 'white', 'collar', 'steel', 'dark'],
    // Sampled from the design (art/sprites/fighter/design.png, `swatch.py`).
    families: [
      // The dress and its cel shade.
      ['dress', [70, 106, 163]],
      ['dress', [68, 107, 165]],
      ['dress', [67, 103, 162]],
      ['dress', [75, 103, 155]],
      ['dress', [48, 76, 122]],
      // The pale piping along the collar, sleeves and hem.
      ['trim', [183, 197, 224]],
      // Skin, its shade, and the blush some poses drew.
      ['skin', [252, 182, 131]],
      ['skin', [252, 166, 118]],
      ['skin', [241, 160, 117]],
      ['skin', [251, 188, 141]],
      ['skin', [252, 173, 124]],
      ['skin', [225, 132, 91]],
      ['skin', [176, 112, 93]],
      ['skin', [190, 147, 132]],
      // The hair.
      ['hair', [57, 40, 32]],
      ['hair', [61, 44, 39]],
      // The socks over the buns, the dressing-gown cord and the boots, and their shade.
      ['white', [245, 241, 231]],
      ['white', [244, 237, 226]],
      ['white', [246, 243, 232]],
      ['white', [231, 220, 205]],
      ['white', [219, 207, 197]],
      ['white', [240, 233, 214]],
      // The dog collars and the spikes on them.
      ['collar', [65, 63, 69]],
      ['steel', [140, 151, 153]],
      ['steel', [181, 184, 189]],
      ['steel', [199, 202, 206]],
      // The ink.
      ['dark', [32, 6, 4]],
      ['dark', [45, 22, 18]],
      ['dark', [33, 15, 15]],
      ['dark', [15, 3, 6]],
      ['dark', [37, 26, 31]],
    ],
    line: 'dark',
    thin: ['dress', 'trim', 'skin', 'hair', 'white', 'collar', 'steel'],
    fringe: 5,
    stroke: 2.4,
    feet: ['white'],
    min: { dark: 0.4, trim: 0.3, steel: 0.15 },
  },
  roles: [
    // The costume: the dress in the player's colour, its piping a light of it.
    { name: 'dress', color: '#466aa3', slot: 'player' },
    { name: 'trim', color: '#808080', on: 0, tone: 30 },
    { name: 'skin', color: '#f6b483' },
    { name: 'hair', color: '#3a2a20' },
    // A colourway is the socks, cord and boots (VARIETY.palette): white, a cream or a pale grey. Neutrals only.
    { name: 'white', color: '#f4f0e6', alts: ['#ece0c4', '#d8d8dc'], vary: 6 },
    { name: 'collar', color: '#3e3b42' },
    { name: 'steel', color: '#b6bac0' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', area: [0.1, 3], gap: [1.2, 4.5], band: [0.05, 0.4], specks: { dark: 3 } },
  wear: {
    on: ['dress'],
    chin: 4,
    marks: [[['scuff', 0.5, 0.4, 0.28]], [['scorch', 0.5, 0.55, 0.32]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.4, 0.6] }],
  // Her drawing's eyes are small black ovals, no white: the kit's `dot`, which acts with no brows (`tall` draws the
  // puffball's blush, a pink smudge on her cheek).
  face: { r: 0.75, iris: '#2a1f1a', eye: 'dot' },
  gait: { bounce: [0.3, 0.8], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    // Smaller in the air: the flying kick's leg reaches past the box's side.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.82 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.8 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/fighter/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `a ready stance, knees bent wide apart, bouncing on her toes, both fists raised in guard in front of her, her eyes open, ${KEEP}.` },
    'walk-1': {
      pose: `walking to the right in a low fighter's crouch, mid-step, the near boot forward and the far boot back, both fists up in guard, ${KEEP}.`,
    },
    'walk-2': {
      pose: `walking to the right, the legs passing under her, one boot planted flat and the other lifted a little behind it, fists up in guard, ${KEEP}.`,
    },
    'run-1': {
      pose: `running low and fast to the right, leaning forward, the near knee raised high in front and the far leg pushing off far behind, fists pumping, ${KEEP}.`,
    },
    'run-2': { pose: `running to the right, mid-stride, both boots off the ground, the legs split wide apart front and back, ${KEEP}.` },
    'air-1': {
      pose: `a flying kick in the air, her front leg kicked straight out forward level at hip height, the other knee tucked up under her, fists up, her eyes open, ${KEEP}.`,
    },
    'air-2': {
      pose: `falling, both boots reaching straight down and apart, both arms out to the sides for balance, her eyes wide and her mouth open, ${KEEP}.`,
    },
    wall: {
      pose: 'seen from her side: she is sliding down a tall wall that is just to her right (do not draw the wall), one hand and both white boots braced flat against it, knees bent, her other fist out, her head turned to look back at us so both buns show, eyes open.',
      far: true,
    },
    cheer: {
      pose: `a victory pose, standing tall, one fist on her hip and the other making a peace sign beside her cheek, one knee lifted, a big grin, her eyes open, ${KEEP}.`,
    },
    cheer2: {
      pose: `showing off, standing on one leg with the other leg kicked straight up high in front of her above her head, her arms out to the sides, a grin, ${KEEP}.`,
    },
    death: {
      pose: 'she has been knocked out and lies flat on her back on the floor, the whole body horizontal, her head on the left and her boots on the right, arms and legs splayed limp, her eyes shut. Seen from the side.',
      far: true,
    },
  },
};
