import type { FlatKind } from '../kinds';

// Every pose keeps what carries her (art/sprites/succubus/design.prompt.txt): the two big ribbed bat wings spread up
// and out from the sides of her head like a crest, with background between them and her hair (touching the head
// they're ears; narrow, the stinger's horns); the felt back wings on their coat hangers, smaller than the head pair
// (big, the dragon's); the big dark hair down her back and the long thin legs (a tall woman, hatless: not the
// vampire); and the slippers, the twist.
const KEEP =
  'always the two big ribbed bat wings spreading up and out from the sides of her head with white background between them and her hair, the felt back wings on their coat hangers, her long dark wavy hair down her back, long thin legs in black tights and the cream fuzzy slippers, the front one a bunny';

export const kind: FlatKind = {
  body: 172,
  map: {
    roles: ['suit', 'hwing', 'bwing', 'hair', 'tights', 'skin', 'slipper', 'wire', 'dark'],
    // Sampled from the design (art/sprites/succubus/design.png, `swatch.py` and by hand).
    families: [
      // The bodysuit, its cel shade and highlight.
      ['suit', [131, 75, 142]],
      ['suit', [134, 76, 142]],
      ['suit', [113, 67, 111]],
      ['suit', [78, 48, 102]],
      ['suit', [84, 44, 91]],
      // The head wings (the hair-clip set), their ribs and shade.
      ['hwing', [177, 112, 154]],
      ['hwing', [177, 115, 156]],
      ['hwing', [171, 114, 151]],
      ['hwing', [143, 87, 142]],
      ['hwing', [147, 112, 138]],
      ['hwing', [192, 145, 156]],
      ['hwing', [167, 135, 152]],
      // The felt back wings and their shade.
      ['bwing', [80, 40, 81]],
      ['bwing', [72, 40, 72]],
      ['bwing', [79, 43, 79]],
      ['bwing', [58, 31, 59]],
      ['bwing', [44, 20, 48]],
      ['bwing', [63, 40, 67]],
      // The hair, its shade and highlight.
      ['hair', [68, 73, 83]],
      ['hair', [65, 66, 77]],
      ['hair', [38, 39, 55]],
      ['hair', [37, 37, 47]],
      // The tights.
      ['tights', [56, 50, 52]],
      ['tights', [54, 51, 52]],
      ['tights', [59, 52, 56]],
      ['tights', [49, 46, 51]],
      // Skin and its shade.
      ['skin', [248, 195, 166]],
      ['skin', [251, 198, 167]],
      ['skin', [230, 200, 193]],
      ['skin', [214, 160, 140]],
      // The fuzzy slippers and their shade.
      ['slipper', [242, 218, 196]],
      ['slipper', [247, 233, 198]],
      ['slipper', [240, 228, 194]],
      ['slipper', [253, 245, 234]],
      ['slipper', [214, 196, 170]],
      ['slipper', [179, 154, 142]],
      ['slipper', [153, 136, 128]],
      ['slipper', [181, 157, 147]],
      // The coat hangers' wire.
      ['wire', [150, 150, 156]],
      ['wire', [110, 110, 118]],
      ['wire', [205, 205, 208]],
      // The ink.
      ['dark', [2, 1, 5]],
      ['dark', [8, 1, 9]],
      ['dark', [21, 9, 24]],
      ['dark', [31, 24, 33]],
      ['dark', [19, 11, 29]],
    ],
    line: 'dark',
    thin: ['suit', 'hwing', 'bwing', 'hair', 'tights', 'skin', 'slipper', 'wire'],
    fringe: 5,
    stroke: 2.4,
    // The head wings' points are the read: rounded, they're leaves.
    smooth: 0,
    feet: ['slipper'],
    min: { dark: 0.4, wire: 0.3, skin: 0.3 },
  },
  roles: [
    // The costume: the bodysuit in the player's colour, the head wings a light of it and the felt back wings a dark.
    { name: 'suit', color: '#834b8e', slot: 'player' },
    { name: 'hwing', color: '#808080', on: 0, tone: 30 },
    { name: 'bwing', color: '#808080', on: 0, tone: -26 },
    // A colourway is the hair (VARIETY.palette), dark neutrals all: charcoal, near black, a dark brown.
    { name: 'hair', color: '#3e424e', alts: ['#2a2a30', '#4a3a34'], vary: 6 },
    { name: 'tights', color: '#36322f' },
    { name: 'skin', color: '#f8c6a8' },
    { name: 'slipper', color: '#f2e6cc' },
    { name: 'wire', color: '#96969c' },
    { name: 'dark', color: '#1c1020' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // Her drawn eyes are thinner than the ink and go as line, so the near one is set by hand where each drawing has
  // it (fractions of the figure's box, found in the drawings), and the far one from it, a sliver.
  eyes: {
    role: 'dark',
    area: [0.1, 3],
    gap: [0.8, 2.6],
    specks: { dark: 1.5 },
    count: 1,
    pair: [0.9, 0],
    at: {
      idle: [0.574, 0.295],
      idle2: [0.571, 0.297],
      'walk-1': [0.572, 0.289],
      'walk-2': [0.573, 0.29],
      'run-1': [0.789, 0.35],
      'run-2': [0.548, 0.306],
      'air-1': [0.606, 0.372],
      'air-2': [0.576, 0.285],
      wall: [0.614, 0.348],
      cheer: [0.567, 0.308],
      cheer2: [0.569, 0.295],
    },
  },
  wear: {
    on: ['suit'],
    chin: 3,
    marks: [[['scuff', 0.35, 0.55, 0.24]], [['scorch', 0.6, 0.7, 0.24]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.2, 0.5] }],
  // Her drawing's eyes are small dark almonds under a lid: the kit's `heavy`, half-lidded and cocky.
  face: { r: 0.55, iris: '#1c1020', eye: 'heavy' },
  gait: { bounce: [0.2, 0.6], lean: [0, 0.02] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    // A strut, on her toes.
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 42 },
    // The jump is a flap of the felt wings; she floats down on them.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.82 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.9 },
    // A blown kiss.
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.6, 0.3] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.5, 0.25] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.76 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/succubus/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing with her weight on one leg, twirling a lock of her hair with one finger, bored and cocky, ${KEEP}.` },
    'walk-1': { pose: `a strutting catwalk walk to the right on her toes, the near leg crossing in front, one hand on her hip, ${KEEP}.` },
    'walk-2': { pose: `strutting to the right, the back leg swinging forward past the other, hips swaying, the arm swinging, ${KEEP}.` },
    'run-1': {
      pose: `running fast to the right, leaning forward, the near knee raised high in front and the far leg pushing off far behind, arms pumping, her hair streaming back, ${KEEP}.`,
    },
    'run-2': { pose: `running to the right mid-stride, both slippers off the ground, the long legs split wide front and back, ${KEEP}.` },
    'air-1': { pose: `jumping up, both knees tucked up under her, the felt back wings flapped up high, arms out to the sides, ${KEEP}.` },
    'air-2': {
      pose: `floating down slowly, the felt back wings spread wide, both slippers dangling down with the toes pointed, arms out to the sides, eyes wide, ${KEEP}.`,
    },
    wall: {
      pose: 'seen from her side, facing right: she is sliding down a tall wall on the right edge of her space (do not draw the wall), one palm and both fuzzy slippers braced flat against it, knees bent, the two big ribbed bat wings still spread up and out from the sides of her head, the felt back wings folded behind her, her face turned to look back at us, eyes open.',
      far: true,
    },
    cheer: {
      pose: `blowing a kiss, standing tall on one leg with the other knee bent up, one hand on her hip and the other held out level in front of her at shoulder height, clear of her body, a wink, ${KEEP}.`,
    },
    cheer2: { pose: `a cocky victory pose, chest out, one hand on her hip and the other arm thrown out to the side, legs crossed, a big smirk, ${KEEP}.` },
    death: {
      pose: 'she has been knocked out and lies flat on her back on the floor, the whole body horizontal, her head on the left and her slippers on the right, arms and legs splayed limp, the bat wings on her head crumpled, her eyes shut. Seen from the side.',
      far: true,
    },
  },
};
