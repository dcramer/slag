import type { FlatKind } from '../kinds';

// Every pose keeps the carrier bag in its hand with the egg poking out of it, the torn bicycle seat low on its back,
// and the long tail out behind: the tail is what tells its head from a capped one in silhouette (blind read: with a
// short tail and the seat up by its head, one reader saw "a capped hero"). The poses were drawn three to a 16:9
// image with the design as the reference and cut apart (art/sprites/dino/design.prompt.txt).
const BAG = 'the carrier bag with the spotted egg in it held in one hand';
const TAIL = 'the long tail out level behind';

export const kind: FlatKind = {
  body: 185,
  map: {
    roles: ['skin', 'spike', 'belly', 'boot', 'seat', 'foam', 'chrome', 'belt', 'bag', 'mouth', 'dark'],
    // Sampled from the design (art/sprites/dino/design.png, `swatch.py`).
    families: [
      ['skin', [86, 185, 68]],
      ['skin', [96, 184, 77]],
      ['skin', [78, 156, 76]],
      ['skin', [41, 135, 79]],
      ['skin', [41, 128, 75]],
      ['spike', [232, 124, 52]],
      ['spike', [192, 72, 30]],
      ['belly', [245, 241, 229]],
      ['belly', [237, 245, 227]],
      ['belly', [171, 205, 178]],
      ['boot', [201, 58, 38]],
      ['boot', [218, 90, 42]],
      ['boot', [150, 32, 28]],
      ['boot', [102, 37, 33]],
      ['seat', [66, 66, 72]],
      ['seat', [48, 48, 54]],
      ['foam', [240, 188, 84]],
      ['chrome', [200, 205, 212]],
      ['chrome', [108, 132, 144]],
      ['belt', [108, 72, 48]],
      ['belt', [176, 141, 105]],
      ['belt', [159, 69, 47]],
      ['bag', [202, 191, 172]],
      ['bag', [192, 190, 180]],
      ['bag', [207, 204, 195]],
      // The open mouth and its tongue (the cheers, the jump): as the wellies' red, a grin went the player's colour.
      ['mouth', [212, 84, 82]],
      ['mouth', [168, 56, 62]],
      ['dark', [28, 21, 20]],
      ['dark', [25, 7, 14]],
      ['dark', [47, 26, 33]],
      // The drawings' white: the belly, cheeks and eye whites are drawn pure white, the background's own colour,
      // so `holes` cut them through. Without it, the white the figure closes in is the belly's; a real gap (between
      // the legs, inside the bag's handle) is under the belly's least part and goes into what's round it.
      ['belly', [255, 255, 255]],
      // The cream that far pupils moved off the snout's line were painted over with (air-1, run-2, cheer2).
      ['belly', [231, 227, 215]],
      ['belly', [246, 242, 230]],
    ],
    line: 'dark',
    thin: ['skin', 'spike', 'belly', 'boot', 'seat', 'foam', 'chrome', 'belt', 'bag', 'mouth'],
    fringe: 5,
    stroke: 2.4,
    feet: ['boot'],
    // The bag and its egg swing on the arm: left out of its size, so every pose is sized by the body alone.
    loose: ['bag'],
    min: { dark: 0.1, chrome: 0.25, foam: 0.3, belly: 0.7, mouth: 0.15 },
  },
  roles: [
    // The green skin is the costume, in the player's colour (Decisions 4).
    { name: 'skin', color: '#4cbf4a', slot: 'player' },
    // The head spikes and the wellies are tones of it, far enough apart that each stays a shape of its own.
    { name: 'spike', color: '#808080', on: 0, tone: 16 },
    { name: 'belly', color: '#f6f2e8' },
    { name: 'boot', color: '#808080', on: 0, tone: -22 },
    // A colourway is the bicycle seat (VARIETY.palette): black, brown leather or grey. Neutrals only.
    { name: 'seat', color: '#3d3d42', alts: ['#6e4a32', '#7e848a'], vary: 6 },
    { name: 'foam', color: '#e2c88a' },
    { name: 'chrome', color: '#c9ccd2' },
    { name: 'belt', color: '#6b4a35' },
    { name: 'bag', color: '#c9c6bd' },
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
  eyes: { role: 'dark', area: [0.08, 1.5], gap: [0.5, 3], specks: { dark: 3 }, band: [0, 0.4], from: 'map' },
  wear: {
    on: ['skin'],
    chin: 4,
    marks: [
      [
        ['scuff', 0.3, 0.55, 0.7],
        ['scuff', 0.35, 0.85, 0.5],
      ],
      [
        ['scorch', 0.3, 0.5, 0.6],
        ['scorch', 0.4, 0.85, 0.4],
      ],
    ],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.8, 0.8] }],
  face: { r: 0.7, iris: '#2a1f1a', eye: 'pill' },
  gait: { bounce: [0.2, 0.9], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 42 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200] },
    // Its tail hangs straight down the wall: drawn at the body size, the slide stands over the box's top.
    wall: { frames: ['wall'], loop: true, fps: 1, scale: 0.92 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.5, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  poses: {
    idle2: { pose: `standing, its free hand on its hip and its head tilted, a happy smile, ${TAIL}, ${BAG}, hanging at its side.` },
    'walk-1': { pose: `trotting to the right, mid-step: the near welly forward, the far welly back, ${TAIL}, ${BAG}, swinging.` },
    'walk-2': { pose: `trotting to the right, the legs passing under the body: one welly planted, the other lifted a little, ${TAIL}, ${BAG}, swinging.` },
    'run-1': {
      pose: `running fast to the right, leaning forward with the big snout out in front, one knee high and the other leg stretched far back pushing off, ${TAIL}, ${BAG}, swinging back.`,
    },
    'run-2': {
      pose: `running fast to the right in mid-stride, both wellies off the ground and tucked up under the body, leaning forward, ${TAIL}, ${BAG}, swinging back.`,
    },
    'air-1': { pose: `jumping up, the legs tucked up under it, the free arm raised, ${TAIL}, ${BAG}, held up.` },
    'air-2': {
      pose: `fluttering in the air, its legs paddling fast under it as if running on air, cheeks puffed out, the free arm out to the side, ${TAIL}, ${BAG}.`,
    },
    wall: {
      pose: `seen from its side, facing right, it is sliding down a tall wall on the right edge of the picture (do not draw the wall): its belly pressed against the wall, both palms and the sole of one welly flat against the wall, the other leg hanging, the long tail hanging down behind, ${BAG}, hanging from one wrist, its head turned to look back over its shoulder at us.`,
      far: true,
    },
    cheer: {
      pose: `cheering, the free fist thrown high over its head, up on the toes of its wellies, a big open grin, ${TAIL}, ${BAG}, held up high in the other fist.`,
    },
    cheer2: { pose: `hopping on one welly, the other knee up, the free fist punched up, a big happy grin, ${TAIL}, ${BAG}, swinging.` },
    death: {
      pose: 'it has been knocked out and lies flat on its back on the floor, belly up, the whole body horizontal across the picture, seen from the side: its head on the left, its eyes shut, its wellies on the right, arms and legs splayed limp, the long tail lying flat, the carrier bag dropped beside it.',
      far: true,
    },
  },
};
