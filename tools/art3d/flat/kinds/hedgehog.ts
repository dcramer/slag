import type { FlatKind } from '../kinds';

// The tin wind-up toy speedster (2026-11-06): the big key out of his hip is the twist and the joke; his head is a
// pressed-tin box with a grey flange round its seam and a square snout block, the quills three fat tin strips with a
// pale folded edge, the shoes boxy tin blocks on grey soles.
export const kind: FlatKind = {
  body: 273,
  map: {
    roles: ['blue', 'edge', 'peach', 'shoe', 'steel', 'white', 'dark', 'iris'],
    families: [
      ['blue', [74, 98, 153]],
      ['blue', [60, 81, 130]],
      ['blue', [64, 81, 132]],
      ['blue', [71, 86, 134]],
      ['blue', [57, 68, 100]],
      ['blue', [75, 101, 151]],
      ['blue', [86, 85, 110]],
      // The quills' folded tin edge: a light of the quills, or the strips trace as one blue mass. Drawn in the eye
      // whites' off-white, it is painted light blue in every drawing first (art/sprites/hedgehog/edges.py).
      ['edge', [176, 198, 232]],
      ['edge', [128, 144, 163]],
      ['peach', [246, 161, 105]],
      ['peach', [248, 167, 113]],
      ['peach', [235, 159, 109]],
      ['peach', [226, 181, 151]],
      ['peach', [203, 168, 146]],
      // A rivet on the peach plates folds into them.
      ['peach', [147, 132, 126]],
      ['shoe', [165, 30, 24]],
      ['shoe', [158, 39, 31]],
      ['shoe', [78, 22, 15]],
      // The key, the head's flange, the soles and the shoes' straps.
      ['steel', [132, 132, 133]],
      ['steel', [152, 150, 151]],
      ['steel', [109, 107, 110]],
      ['steel', [120, 125, 129]],
      ['white', [255, 255, 252]],
      // The eye whites and the grin's teeth, drawn a step off white (and tinted so in every drawing,
      // art/sprites/hedgehog/whites.py) so `holes` cuts the key's two holes and never the face.
      ['white', [218, 210, 198]],
      ['white', [238, 234, 224]],
      ['dark', [50, 30, 27]],
      ['dark', [34, 11, 10]],
      ['dark', [51, 42, 47]],
      ['dark', [37, 28, 31]],
      ['dark', [75, 51, 48]],
      ['iris', [88, 140, 68]],
    ],
    line: 'dark',
    thin: ['blue', 'edge', 'peach', 'shoe', 'steel', 'white'],
    fringe: 5,
    stroke: 2.4,
    feet: ['shoe', 'steel'],
    // The key's two holes, and the gaps between the legs: traced white, they were white dots on the bow.
    holes: 0.4,
    // The rivets on the blue tin are specks at play size: they fold away (the steel's smallest real part is a
    // shoe strap).
    min: { dark: 0.85, white: 0.8, iris: 0.1, steel: 0.6, edge: 0.4 },
  },
  roles: [
    { name: 'blue', color: '#2f5bd0', slot: 'player' },
    // The quills' folded edge, a light of them: the tin strips stay strips at play size.
    { name: 'edge', color: '#808080', on: 0, tone: 30 },
    { name: 'peach', color: '#f0c99c' },
    // The tin shoes, a dark of the quills: far enough off them that the legs end in shoes.
    { name: 'shoe', color: '#808080', on: 0, tone: -22 },
    // A colourway is the key (VARIETY.palette): steel, bright tin or dark iron, the soles and straps with it.
    // Greys only: brass and copper keys sank into an orange or tan player's tin and the twist went.
    { name: 'steel', color: '#9a9d9f', alts: ['#bcbfc0', '#76797c'], vary: 6 },
    { name: 'white', color: '#fbf8f2' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'iris', color: '#3a9a46' },
    { name: 'scuff', color: '#808080', on: 2, tone: 10 },
    { name: 'scorch', color: '#808080', on: 2, tone: -16 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 0, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'iris', area: [0.05, 1.5], gap: [1, 4.5], specks: { dark: 1.6, white: 4, iris: 2 }, band: [0.1, 0.45] },
  wear: {
    on: ['peach'],
    chin: 3,
    // One quiet streak each on the belly: two, or a strong tone, read as a rash on the peach.
    marks: [[['scuff', 0.5, 0.6, 0.45]], [['scorch', 0.5, 0.6, 0.45]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2.2, 0.9] }],
  face: { r: 0.9, iris: '#3a9a46', mouth: [1.4, 2.7] },
  gait: { bounce: [0, 0.45], lean: [0.01, 0.06] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 48 },
    // The jump is the spin ball, all the way up and down, with no face, the key turning round it; centred on
    // itself, since its feet are wherever the spin left them.
    air: { frames: ['air-1', 'air-1b'], loop: true, fps: 12, eyes: false, centre: 'box' },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    // The punch's eyes are drawn squeezed shut: the drawing's own, not the kit's.
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25], eyes: false },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.7, 0.3] },
    // Run down: flat on his back, the key standing up out of him.
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.92 },
  },
  poses: {
    idle2: { pose: 'standing with his arms folded across his chest, tapping one toe, smirking.' },
    'walk-1': { pose: 'walking to the right, mid-step: the near shoe forward, the far one back, the arms swinging the other way.' },
    'walk-2': { pose: 'walking to the right, the legs passing under the body: one shoe planted, the other lifted a little.' },
    'run-1': { pose: 'running flat out to the right, leaning hard forward, the legs in a long stride, the arms swept back, the quills streaming behind.' },
    'run-2': { pose: 'running flat out to the right, leaning hard forward, both shoes off the ground with the legs gathered under him, the arms swept back.' },
    'air-1': {
      pose: 'curled up tight into a round spinning ball in mid-air, the tin quills all round the outside, no face showing, the grey wind-up key sticking straight out of the ball.',
      far: true,
    },
    'air-1b': { pose: 'the same spinning ball turned a little further round, the key sticking out at another angle.', far: true },
    wall: {
      pose: 'seen from his side, he is sliding down a tall wall that is just to his right (do not draw the wall), one hand flat against it and both shoes braced on it, his head turned to look back at us, the key sticking out behind him.',
      far: true,
    },
    cheer: { pose: 'cheering, one fist punched high over his head, a big grin.' },
    cheer2: { pose: 'stretching with both fists high over his head, up on his toes, his eyes wide open and looking ahead, grinning.' },
    death: {
      pose: 'he has run down and lies flat on his back on the floor, the whole body horizontal, head on the left and shoes on the right, arms and legs splayed limp, eyes shut, the key sticking up out of his hip.',
      far: true,
    },
  },
};
