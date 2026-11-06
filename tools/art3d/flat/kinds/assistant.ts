import type { FlatKind } from '../kinds';

// Every pose keeps the shapes that carry her (art/sprites/assistant/design.prompt.txt): the tall fanned tuft standing
// straight up off the top of her head with the bell at its base (the read: a bell and a knot on a dog's head, the
// ears hanging under it; a low round knot is the fighter's bun, so it stands tall and splays), the two floppy ears
// hanging down (raised, they are the zapmouse's), and the clipboard held out clear of her body (hugged, it vanishes
// into the outline).
const KEEP =
  'the tall fanned tuft always standing straight up off the top of her head with the dented silver bell at its base, the two floppy ears always hanging down, and the cracked clipboard always held out away from her body with white background all round it';

export const kind: FlatKind = {
  body: 151,
  map: {
    roles: ['fur', 'vest', 'earin', 'shirt', 'skirt', 'bell', 'collar', 'board', 'mouth', 'dark'],
    // Sampled from the design (art/sprites/assistant/design.png) and the poses with `swatch.py`.
    families: [
      // The fur, its cel shade and its highlight, folded in.
      ['fur', [243, 201, 74]],
      ['fur', [239, 197, 71]],
      ['fur', [235, 201, 93]],
      ['fur', [231, 196, 91]],
      ['fur', [226, 184, 88]],
      ['fur', [221, 177, 90]],
      // The fur's cel shade, under the chin and down the far side: an orange the wood is nearest to, so named here.
      ['fur', [208, 147, 65]],
      ['fur', [213, 154, 74]],
      ['fur', [196, 138, 61]],
      ['fur', [204, 141, 64]],
      ['fur', [244, 204, 96]],
      // The vest and its shade.
      ['vest', [165, 115, 31]],
      ['vest', [152, 106, 21]],
      ['vest', [147, 107, 37]],
      ['vest', [144, 108, 49]],
      ['vest', [143, 101, 30]],
      // The folded ear's pale inside and the ears' pale tips.
      ['earin', [248, 235, 205]],
      ['earin', [240, 210, 133]],
      ['earin', [243, 229, 196]],
      ['earin', [245, 226, 186]],
      ['earin', [227, 202, 129]],
      // The shirt.
      ['shirt', [247, 243, 233]],
      // The skirt and its shade.
      ['skirt', [89, 95, 106]],
      ['skirt', [69, 71, 80]],
      ['skirt', [99, 99, 105]],
      ['skirt', [79, 81, 90]],
      // The bell, the clip and the tape: one steel.
      ['bell', [190, 187, 188]],
      ['bell', [183, 176, 171]],
      ['bell', [129, 108, 73]],
      ['bell', [157, 136, 112]],
      ['bell', [186, 170, 152]],
      ['bell', [148, 127, 102]],
      ['bell', [106, 88, 73]],
      // The collar round the knot.
      ['collar', [89, 61, 40]],
      ['collar', [76, 49, 31]],
      ['collar', [72, 51, 41]],
      // The clipboard's wood and its shade. Its papers are the shirt's white.
      ['board', [200, 153, 96]],
      ['board', [204, 156, 102]],
      ['board', [198, 161, 115]],
      ['board', [188, 159, 123]],
      ['board', [180, 146, 106]],
      // The open mouth and its tongue.
      ['mouth', [156, 66, 62]],
      ['mouth', [214, 122, 106]],
      // The ink.
      ['dark', [52, 23, 16]],
      ['dark', [38, 16, 13]],
      ['dark', [57, 31, 26]],
      ['dark', [119, 73, 43]],
    ],
    line: 'dark',
    thin: ['fur', 'vest', 'earin', 'shirt', 'skirt', 'bell', 'collar', 'board', 'mouth'],
    fringe: 5,
    stroke: 2.4,
    smooth: 1,
    feet: ['fur'],
    // The clipboard is carried, so the body's size is the dog in her tuft, alike in every pose (its papers are the
    // shirt's white, which sits inside her outline anyway).
    loose: ['board', 'shirt'],
    min: { dark: 0.3, collar: 0.4, bell: 0.4, earin: 0.4, mouth: 0.2 },
  },
  roles: [
    // The costume: the fur, in the player's colour; the vest a dark of it, the ears' pale insides a light of it.
    { name: 'fur', color: '#f2c84a', slot: 'player' },
    { name: 'vest', color: '#808080', on: 0, tone: -34 },
    { name: 'earin', color: '#808080', on: 0, tone: 26 },
    { name: 'shirt', color: '#f6f2ea' },
    // A colourway is the skirt (VARIETY.palette), neutrals all: slate, charcoal, a warm grey.
    { name: 'skirt', color: '#5e6470', alts: ['#3e4048', '#7a7068'], vary: 6 },
    { name: 'bell', color: '#bcbcc0' },
    { name: 'collar', color: '#5a3a26' },
    { name: 'board', color: '#c8955a' },
    { name: 'mouth', color: '#9c423e' },
    { name: 'dark', color: '#2e1a14' },
    { name: 'scuff', color: '#808080', on: 0, tone: 12 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: {
    role: 'dark',
    area: [0.1, 1.6],
    gap: [1.2, 5],
    band: [0.35, 0.56],
    edge: 0.15,
    glint: 0.25,
    from: 'map',
    specks: { dark: 2.5, mouth: 3, shirt: 0.5 },
  },
  wear: {
    on: ['fur'],
    chin: 4.5,
    marks: [[['scuff', 0.42, 0.92, 0.13]], [['scorch', 0.58, 0.95, 0.18]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.3, 0.55] }],
  face: { r: 0.8, iris: '#2e1a14', eye: 'dot', mouth: [1.4, 1.6] },
  gait: { bounce: [0.25, 0.9], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 22 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 34 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200] },
    wall: { frames: ['wall'], loop: true, fps: 1 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    // The twirl's eyes are drawn shut in a laugh: no face.
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3], eyes: false },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/assistant/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing still, reading the clipboard held out in front of her, her head tilted a little, her free hand on her hip, ${KEEP}.` },
    'walk-1': {
      pose: `trotting eagerly to the right, mid-step, the near foot forward and the far foot back, the clipboard held out in front of her, ${KEEP}.`,
    },
    'walk-2': { pose: `trotting to the right, her legs passing under her, one foot planted and the other lifted behind, ${KEEP}.` },
    'run-1': {
      pose: `running fast to the right, leaning well forward, her legs wide apart in a long stride, the clipboard held out ahead of her, her ears flapping back, ${KEEP}.`,
    },
    'run-2': { pose: `running fast to the right, leaning forward, her legs passing under her, the clipboard held out ahead, ${KEEP}.` },
    'air-1': {
      pose: `jumping up, both knees tucked up under her, her skirt flaring, her ears flapping out to the sides, the clipboard held out to the front, ${KEEP}.`,
    },
    'air-2': {
      pose: `falling, both legs reaching straight down and apart, her free arm flung out to the side, her ears blown out sideways, her eyes wide, ${KEEP}.`,
    },
    wall: {
      pose: 'seen from her side, facing right, she is sliding down a tall wall that is just to her right (do not draw the wall), both feet and her free hand braced flat against it, knees bent, the clipboard held out low away from the wall to the left, the tall fanned tuft with its bell still standing up off her head, her face turned to look back at us, eyes open.',
      far: true,
    },
    cheer: { pose: `cheering, a happy hop up on her toes, the clipboard thrust out in front of her at shoulder height, a huge open smile, ${KEEP}.` },
    cheer2: { pose: `a happy twirl on one foot, her skirt flaring out wide, the clipboard held out level at arm's length, a big smile, ${KEEP}.` },
    death: {
      pose: 'she has been knocked out and lies flat on her back on the floor, the whole body horizontal, her head on the left and her feet on the right, arms and legs splayed limp, the tuft flopped over, the clipboard dropped on the floor beside her, eyes shut.',
      far: true,
    },
  },
};
