import type { FlatKind } from '../kinds';

// Drawn from one game-size design, worn in one edit (a dent pushed into the back of the ball, the snout creased,
// the near trainer's sole flapping, the far one's laces undone), and eleven poses three to a 16:9 image, cut apart
// (art/sprites/hopper/design.prompt.txt). He never walks: every moving pose is a hop with both feet together.
const SNOUT = 'the long snout with its flared open end always sticking straight out level to the right, no arms ever, both legs pressed together side by side';

export const kind: FlatKind = {
  body: 206,
  map: {
    roles: ['sole', 'canvas', 'orange', 'snout', 'paper', 'white', 'dark'],
    families: [
      // The trainers' thick soles, and the canvas uppers with their shade: neutral greys.
      ['sole', [145, 137, 126]],
      ['sole', [158, 149, 138]],
      ['canvas', [212, 205, 192]],
      ['canvas', [222, 210, 196]],
      ['canvas', [207, 199, 187]],
      // The ball and the legs, and their cel shadow: the player's colour.
      ['orange', [227, 104, 27]],
      ['orange', [225, 100, 26]],
      ['orange', [228, 108, 33]],
      ['orange', [191, 62, 8]],
      ['orange', [187, 67, 16]],
      ['orange', [198, 69, 11]],
      // The snout, its shade and its pale bands, folded into one paler tube.
      ['snout', [247, 166, 102]],
      ['snout', [238, 145, 83]],
      ['snout', [182, 109, 63]],
      ['snout', [231, 187, 151]],
      ['snout', [250, 214, 183]],
      // The party blower's paper streamer, unrolled on the cheer: its pink and its pale stripes.
      ['paper', [240, 124, 156]],
      ['paper', [200, 124, 140]],
      ['paper', [248, 224, 224]],
      // The big eyes' whites, standing up out of the top of the ball, tinted a step off white in every drawing
      // (art/sprites/hopper/whites.py) so `holes` cuts the gap between the legs and never the eyes.
      ['white', [238, 234, 224]],
      ['white', [255, 255, 255]],
      // The ink, the snout's dark open end and the dent's dark.
      ['dark', [50, 7, 8]],
      ['dark', [51, 18, 17]],
      ['dark', [27, 5, 6]],
      ['dark', [49, 30, 17]],
      ['dark', [89, 62, 53]],
    ],
    line: 'dark',
    thin: ['sole', 'canvas', 'orange', 'snout', 'paper', 'white'],
    fringe: 5,
    stroke: 2.4,
    feet: ['sole', 'canvas'],
    // The trailing laces' scraps under the trainers.
    min: { dark: 0.12, canvas: 0.6, sole: 0.6, paper: 0.3 },
    // The gap between the two legs, under the ball: traced white, it was a pale blob between them.
    holes: 0.4,
  },
  roles: [
    { name: 'sole', color: '#8e8a84', alts: ['#6f6a64', '#a89c86'], vary: 6 },
    { name: 'canvas', color: '#d4d0c6' },
    // The costume: the ball and its legs.
    { name: 'orange', color: '#e8742a', slot: 'player' },
    // The snout, a light tone of the ball: a tube of its own in every colour.
    { name: 'snout', color: '#808080', on: 2, tone: 18 },
    // The party blower's streamer, lighter still.
    { name: 'paper', color: '#808080', on: 2, tone: 32 },
    { name: 'white', color: '#f8f4ec' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'scuff', color: '#808080', on: 2, tone: 10 },
    // One quiet mark a wear: on a smooth ball, a loud blob reads as a spot.
    { name: 'scorch', color: '#808080', on: 2, tone: -16 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', area: [0.1, 3], gap: [1.5, 6], specks: { dark: 3 }, band: [0, 0.4], glint: 0.3 },
  wear: {
    on: ['orange'],
    chin: 3,
    marks: [[['scuff', 0.35, 0.62, 1]], [['scorch', 0.3, 0.66, 1.1]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2, 0.8] }],
  face: { r: 1, iris: '#3a2a20' },
  gait: { bounce: [0.2, 0.9], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    // Hops, never steps: crouched on both feet, then both tucked up off the ground.
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 26 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.95 },
    // Its own wall drawing tilts the head back, the two eyes too far off level for the kit to find: a ball slides in its fall.
    wall: { frames: ['air-2'], loop: true, fps: 1, scale: 0.95 },
    // The snout's party blower unrolls its streamer; the eyes are squeezed shut.
    // One drawing, centred: the streamer reaches past the box from the feet, and the shared cheer hops it.
    cheer: { frames: ['cheer'], loop: true, fps: 1, centre: 'box' },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Each pose alone, for a redraw; the sheets' prompts are in art/sprites/hopper/design.prompt.txt.
  poses: {
    idle2: { pose: `standing on both feet, leaning back a little, the snout tipped up a little, his eyes looking up, no arms ever.` },
    'walk-1': {
      pose: `crouched low ready to hop, both knees bent and both trainers side by side flat on the ground, the ball squashed down a little over them, ${SNOUT}.`,
    },
    'walk-2': { pose: `in a small hop just off the ground, both legs tucked up under the ball, both trainers side by side in the air, ${SNOUT}.` },
    'run-1': {
      pose: `crouched to spring forward to the right, the ball tipped forward and squashed low, both knees bent together, both trainers flat on the ground, ${SNOUT}.`,
    },
    'run-2': { pose: `landing from a long leap to the right, both legs together reaching forward under him, the ball tipped back a little, ${SNOUT}.` },
    'air-1': { pose: `jumping straight up, both legs together stretched straight down, both trainers side by side pointing down, ${SNOUT}.` },
    'air-2': { pose: `falling, both legs together reaching down, his eyes wide open in alarm, ${SNOUT}.` },
    wall: {
      pose: 'seen from his side, he is sliding down a tall wall that is just to his right (do not draw the wall), both trainers braced flat against it, the ball turned to look back at us over his shoulder, the snout pointing up and back to the left.',
      far: true,
    },
    cheer: {
      pose: 'cheering, hopping on the spot with both trainers together off the ground, his eyes squeezed shut in joy, blowing his snout like a party blower: a long curled paper streamer has unrolled out of its flared open end, straight out to the right with a little curl at its tip.',
    },
    cheer2: { pose: 'cheering, a big happy hop with both legs tucked up together, his eyes open and happy, the snout tipped up toward the sky.' },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the ball on the floor with both legs and trainers sticking up limp in the air, the snout drooping limp to one side, his eyes shut.',
      far: true,
    },
  },
};
