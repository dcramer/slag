import type { FlatKind } from '../kinds';

// Drawn from one game-size design, worn in one edit (a twist of rubber tied round the tip's root, tape over a pinhole
// on its back with a drop leaking from under it, the body sagging lopsided), and eleven poses three to a 16:9 image, cut
// apart (art/sprites/slime/design.prompt.txt). It never walks: every moving pose is a squash and a spring. run-1 and
// air-1 are copies of walk-2 (the clips' notes).
const KEEP =
  'In every one it has no arms, no legs and no feet, its tall pointed tip with the knot tied round its root stands up clear of the body, and the grey tape and the hanging drop stay on its back.';

export const kind: FlatKind = {
  body: 218,
  map: {
    roles: ['blue', 'shine', 'tape', 'white', 'mouth', 'tongue', 'dark'],
    families: [
      // The goo and its cel shadow: the player's colour.
      ['blue', [65, 151, 228]],
      ['blue', [60, 144, 216]],
      ['blue', [36, 111, 180]],
      ['blue', [49, 114, 176]],
      ['blue', [36, 96, 168]],
      ['blue', [84, 144, 204]],
      // The rubber's shine and the drop: a light of the goo.
      ['shine', [201, 229, 251]],
      ['shine', [192, 216, 240]],
      // The tape over the pinhole: a neutral grey.
      ['tape', [168, 168, 168]],
      ['tape', [144, 170, 188]],
      ['tape', [156, 156, 156]],
      ['tape', [113, 133, 178]],
      // The eye whites and the teeth.
      ['white', [252, 252, 252]],
      ['white', [240, 240, 240]],
      // The open grin's dark inside, a warm brown apart from the navy ink.
      ['mouth', [38, 28, 25]],
      ['mouth', [36, 24, 12]],
      ['tongue', [208, 96, 96]],
      ['tongue', [226, 106, 106]],
      ['tongue', [102, 66, 70]],
      // The ink and the pupils: navy.
      ['dark', [16, 25, 45]],
      ['dark', [15, 22, 41]],
      ['dark', [15, 32, 60]],
      ['dark', [10, 16, 34]],
      ['dark', [34, 39, 49]],
    ],
    line: 'dark',
    thin: ['blue', 'shine', 'tape', 'white', 'mouth', 'tongue'],
    fringe: 5,
    // The read is the tip's point: rounded, it is a dome (the jelly's).
    smooth: 0,
    // The rubber's creases and the knot's ties are flecks at play size.
    stroke: 99,
    feet: ['blue'],
    min: { shine: 1.2, tape: 0.5, dark: 0.2 },
  },
  roles: [
    // The costume: the goo.
    { name: 'blue', color: '#3d8fe0', slot: 'player' },
    // Its shine and the leaking drop, a light of the goo.
    { name: 'shine', color: '#808080', on: 0, tone: 26 },
    // A colourway is the tape (VARIETY.palette), in greys: a brown parcel tape read as a smear of mud on the goo.
    { name: 'tape', color: '#a4a7aa', alts: ['#c6c8c8', '#7e8286'], vary: 6 },
    { name: 'white', color: '#f8f6f0' },
    { name: 'mouth', color: '#2a1f1a' },
    // A face mark: warm and fixed whatever the player's colour.
    { name: 'tongue', color: '#e06a6a' },
    { name: 'dark', color: '#1c1a26' },
    { name: 'scuff', color: '#808080', on: 0, tone: 10 },
    // One quiet mark a wear: on a smooth balloon, a loud blob reads as a spot.
    { name: 'scorch', color: '#808080', on: 0, tone: -16 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // The pupils, navy specks in the whites; the big dark grin under them is the mouth's own role, so it stays as drawn.
  eyes: { role: 'dark', area: [0.1, 3], gap: [1.5, 6], specks: { dark: 3, white: 8 }, band: [0.3, 0.68], glint: 0.3 },
  wear: {
    on: ['blue'],
    chin: 3,
    marks: [[['scuff', 0.45, 0.8, 0.7]], [['scorch', 0.42, 0.72, 0.7]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2, 0.8] }],
  face: { r: 1, iris: '#1c1a26', eye: 'round' },
  gait: { bounce: [0.2, 0.9], lean: [0, 0.04] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    // A squash and a spring, never a step. Its own springs drawn with two lobes under them read as legs: walk-2's has three drips.
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 24 },
    // Squashed flat on landing, then sprung off again. The drawn lunge, stretched long and low with its tip swept back,
    // read in black as a seal or a slug: the run's spring is the walk's (run-1 is a copy of walk-2).
    run: { frames: ['run-2', 'run-1'], loop: true, stride: 36, scale: 0.96 },
    // The drawn leap, stretched tall and narrow, stood half again over the box: the rise is the walk's spring too
    // (air-1 is a copy of walk-2), drawn a little smaller.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.96 },
    // Pressed flat to the wall, its side squeezed up into a second lobe beside the tip.
    wall: { frames: ['wall'], loop: true, fps: 1 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.7, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Each pose alone, for a redraw; the sheets' prompts are in art/sprites/slime/design.prompt.txt.
  poses: {
    'walk-1': { pose: `hopping along to the right, squashed low and wide on the ground just before a spring, the grin half open. ${KEEP}` },
    'walk-2': { pose: `hopping along to the right, springing up off the ground, stretched a little taller and narrower, the grin wide open. ${KEEP}` },
    idle2: { pose: `sitting still, squashed a little, looking up, smiling with its mouth shut. ${KEEP}` },
    'run-1': { pose: `bounding fast to the right, leaning forward, stretched long and low, the tip swept back a little, the grin wide open. ${KEEP}` },
    'run-2': { pose: `bounding fast to the right, leaning forward, squashed flat on landing, the grin wide open. ${KEEP}` },
    'air-1': { pose: `leaping up into the air, stretched tall and narrow, the tip pointing straight up, the grin wide open. ${KEEP}` },
    'air-2': { pose: `falling, spread a little wider, its bottom stretched down, the mouth open in alarm, the eyes wide. ${KEEP}` },
    cheer: { pose: `bouncing high on the spot with joy, stretched tall, the grin thrown wide open. ${KEEP}` },
    cheer2: { pose: `wobbling with laughter, tipped back a little, squashed wide, the grin wide open. ${KEEP}` },
    wall: {
      pose: 'it is sliding down a tall wall that is just to its right (do not draw the wall), its right side pressed flat against it, the tip leaning away from the wall, looking back at us with a nervous grin.',
      far: true,
    },
    death: {
      pose: 'knocked out and melted into a low flat puddle of goo on the floor, much wider than it is tall, its tip still poking up out of the middle, its eyes shut, the mouth a limp wavy line. Seen from the side.',
      far: true,
    },
  },
};
