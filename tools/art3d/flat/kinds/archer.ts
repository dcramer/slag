import type { FlatKind } from '../kinds';

// Side on, a young huntress with the curtain-rod bow held out ahead of her at arm's length, upright and as tall as
// she is, background all round it; the huge bushy red hair and its braids puffing out behind her head, the fur wrap
// over her shoulders. The bow is the read: nobody else in the cast holds one, and held out clear of her it stays a
// thin curve of its own (the raider's pistols and the hunter's cannon are blocks). She idles in the design's kneel,
// drawing the bow. Drawn three to a 16:9 image with the design as the reference and cut apart
// (art/sprites/archer/design.prompt.txt).
const KEEP =
  "her big curtain-rod bow always held out ahead of her at arm's length in her front hand, upright and as tall as she is, with white background all round it, her huge bushy red hair and thick braids puffing out behind her head, the cream fur wrap";

export const kind: FlatKind = {
  body: 221,
  map: {
    roles: ['leather', 'fur', 'skin', 'hair', 'wood', 'boot', 'strap', 'grey', 'dark'],
    // Sampled from the design (art/sprites/archer/design.png, `swatch.py`).
    families: [
      // The tunic, the arm and leg wraps, and their cel shade.
      ['leather', [99, 125, 49]],
      ['leather', [86, 104, 58]],
      ['leather', [57, 73, 41]],
      // The fur wrap and its shade.
      ['fur', [237, 217, 170]],
      ['fur', [238, 220, 175]],
      ['fur', [173, 152, 122]],
      ['skin', [218, 158, 105]],
      ['skin', [213, 155, 104]],
      ['skin', [213, 178, 141]],
      // The hair, the braids and their shade.
      ['hair', [141, 49, 27]],
      ['hair', [140, 48, 25]],
      ['hair', [143, 50, 27]],
      ['hair', [137, 49, 28]],
      ['hair', [131, 44, 26]],
      ['hair', [96, 30, 21]],
      ['hair', [73, 29, 19]],
      // The curtain rod and its knobs.
      ['wood', [163, 107, 65]],
      ['wood', [123, 62, 36]],
      ['wood', [118, 78, 50]],
      ['boot', [100, 68, 47]],
      ['boot', [70, 48, 35]],
      // The belt, the strap across her chest and the quiver.
      ['strap', [139, 113, 77]],
      // The tape on the rod and the suction-cup darts.
      ['grey', [154, 156, 152]],
      ['grey', [120, 122, 120]],
      ['grey', [190, 190, 186]],
      // The ink and the bungee string.
      ['dark', [5, 4, 2]],
      ['dark', [19, 7, 3]],
      ['dark', [29, 16, 8]],
      ['dark', [38, 8, 3]],
      ['dark', [37, 31, 23]],
    ],
    line: 'dark',
    thin: ['leather', 'fur', 'skin', 'hair', 'wood', 'boot', 'strap', 'grey'],
    fringe: 5,
    stroke: 2.4,
    feet: ['boot'],
    // The bow is carried, so the body's size is her alone, alike in every pose.
    loose: ['wood', 'grey'],
    min: { dark: 0.4, grey: 0.4, strap: 0.4 },
    // The background closed in between the bow and its string, and between an arm and the body.
    holes: 0.8,
  },
  roles: [
    // The costume: the tunic and the wraps, in the player's colour; the fur a light of it.
    { name: 'leather', color: '#5f7d33', slot: 'player' },
    { name: 'fur', color: '#808080', on: 0, tone: 30 },
    { name: 'skin', color: '#da9e69' },
    { name: 'hair', color: '#8d311b' },
    { name: 'wood', color: '#a36b41' },
    // A colourway is the boots (VARIETY.palette): brown, a dark grey or a tan leather, neutrals all.
    { name: 'boot', color: '#64442f', alts: ['#4c4a48', '#86694a'], vary: 6 },
    { name: 'strap', color: '#8b714d' },
    { name: 'grey', color: '#9a9c98' },
    { name: 'dark', color: '#24140c' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', from: 'map', count: 1, pair: [-1, 0], area: [0.1, 2], gap: [0.8, 3.5], specks: { dark: 2.4 }, band: [0.1, 0.45] },
  wear: {
    on: ['leather'],
    chin: 5,
    marks: [[['scuff', 0.5, 0.75, 0.3]], [['scorch', 0.45, 0.7, 0.3]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.2, 0.5], offset: [0, -0.5] }],
  // Her drawn eye is a small dark oval with no white: the kit's `dot`, side on, the far one a sliver.
  face: { r: 0.6, iris: '#24140c', eye: 'dot' },
  gait: { bounce: [0.2, 0.6], lean: [0, 0.04] },
  clips: {
    // She idles in the design's kneel, drawing the bow level ahead.
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 42 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box' },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.9 },
    // Her eyes are squeezed shut in the cheer.
    cheer: { frames: ['cheer'], loop: true, fps: 1, eyes: false },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.82 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/archer/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing up straight, calm, the bow held out ahead, a dart nocked, not drawn, her eyes open; ${KEEP}.` },
    'walk-1': { pose: `walking upright to the right, mid-step, the near boot forward and the far boot back, her eyes open; ${KEEP}.` },
    'walk-2': { pose: `standing up straight mid-step, the legs passing under her, her eyes open; ${KEEP}.` },
    'run-1': {
      pose: `running fast to the right, leaning forward, the near knee raised high in front and the far leg pushing off far behind, her eyes open; ${KEEP}.`,
    },
    'run-2': { pose: `running fast to the right, mid-stride, both boots off the ground, the legs split wide apart front and back, her eyes open; ${KEEP}.` },
    'air-1': {
      pose: `leaping up and forward, both knees tucked up under her, drawing the bow level ahead of her, a dart on the string, her eyes open; ${KEEP}.`,
    },
    'air-2': { pose: `falling, both boots reaching down and apart, her other arm flung out behind for balance, her eyes wide and her mouth open; ${KEEP}.` },
    wall: {
      pose: "seen from her side, facing right: she is sliding down a tall wall on the right edge of her space (do not draw the wall), one hand flat against it and both boots braced on it, knees bent, her other hand holding the bow out to the left at arm's length, her head turned to look back at us, her eyes open.",
      far: true,
    },
    cheer: { pose: `cheering, hopping up on her toes, a big open grin, her other fist pumped up beside her head, her eyes shut tight; ${KEEP}.` },
    cheer2: { pose: `standing proudly, twirling a suction-cup dart in her other hand beside her shoulder, a cocky smile, her eyes open; ${KEEP}.` },
    death: {
      pose: 'seen from the side: she has been knocked out and lies flat on her back on the floor, the whole body horizontal, her head on the left and her boots on the right, arms and legs splayed limp, the bow dropped beside her, her eyes shut.',
      far: true,
    },
  },
};
