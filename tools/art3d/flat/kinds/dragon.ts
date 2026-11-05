import type { FlatKind } from '../kinds';

// Small and low on four legs, side on, with what only this little dragon has in outline: the long horns swept
// straight back off the head, the stubby wings up off the shoulders, and the arrowhead on the end of the tail. The
// wings are umbrella cloth on bent spokes and a firefly in a jam jar hangs from the tail: the twist. The poses were
// drawn three to a 16:9 image with the design as the reference and cut apart (art/sprites/dragon/design.prompt.txt).
const KEEP =
  'the two long pale horns always swept straight back off its head, the two small umbrella-cloth wings always on its shoulders, the taped arrowhead tip always on the end of its tail with the small jam jar hanging from it, its eye open';

export const kind: FlatKind = {
  body: 214,
  map: {
    roles: ['wing', 'far', 'scales', 'bone', 'grey', 'glass', 'mouth', 'dark'],
    // Sampled from the design (art/sprites/dragon/design.png, `swatch.py`) and its poses.
    families: [
      ['scales', [137, 106, 209]],
      ['scales', [140, 108, 206]],
      ['scales', [135, 110, 187]],
      ['scales', [146, 115, 191]],
      // The far legs, and the scales' cel shadow under the belly and the head, in the drawing's one shade.
      ['far', [96, 77, 144]],
      ['far', [104, 81, 158]],
      ['far', [115, 89, 157]],
      ['far', [98, 75, 139]],
      // The umbrella cloth, and its shade.
      ['wing', [212, 176, 224]],
      ['wing', [206, 171, 215]],
      ['wing', [185, 149, 179]],
      ['wing', [178, 142, 180]],
      ['wing', [161, 127, 174]],
      // The belly, the horns, the spines and the arrowhead, their shade, and the eye's white.
      ['bone', [236, 219, 183]],
      ['bone', [238, 229, 204]],
      ['bone', [234, 215, 184]],
      ['bone', [193, 169, 161]],
      ['bone', [221, 206, 191]],
      // The wing's patch and the tape round the arrowhead.
      ['grey', [160, 147, 164]],
      ['grey', [154, 144, 152]],
      // The jar's glass and the firefly's glow.
      ['glass', [216, 232, 236]],
      ['glass', [208, 224, 232]],
      ['glass', [236, 240, 192]],
      ['mouth', [208, 116, 124]],
      ['mouth', [172, 88, 96]],
      ['mouth', [232, 140, 134]],
      ['dark', [47, 19, 57]],
      ['dark', [52, 29, 58]],
      ['dark', [28, 10, 35]],
      ['dark', [39, 20, 47]],
    ],
    line: 'dark',
    thin: ['wing', 'far', 'scales', 'bone', 'grey', 'glass', 'mouth'],
    fringe: 5,
    stroke: 2.4,
    feet: ['scales', 'far'],
    // The jar swings on its string below the tail: left out of the body's size.
    loose: ['glass'],
    min: { dark: 0.05, grey: 0.2, mouth: 0.2, glass: 0.3, far: 0.6 },
  },
  roles: [
    // The umbrella cloth, a light of the player's colour; the scales are the costume (Decisions 4).
    { name: 'wing', color: '#808080', on: 2, tone: 24 },
    { name: 'far', color: '#808080', on: 2, tone: -14 },
    { name: 'scales', color: '#8a5cc0', slot: 'player' },
    { name: 'bone', color: '#ecdcb8' },
    // A colourway is the wing's patch and the tail's tape together (VARIETY.palette): grey cloth, charcoal or tan.
    { name: 'grey', color: '#9a9c98', alts: ['#5d6168', '#b49a74'], vary: 6 },
    { name: 'glass', color: '#d8e6e8' },
    { name: 'mouth', color: '#9a3d36' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear on the scales, in tones of the player's colour: a faded patch, and soot.
    { name: 'scuff', color: '#808080', on: 2, tone: 12 },
    { name: 'scorch', color: '#808080', on: 2, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // Side on, one big eye shows: a pale white round a dark pupil with a glint. The pupil is the biggest speck in
  // the head's band, and the far eye is set along the snout from it.
  eyes: { role: 'dark', from: 'map', glint: 0.25, area: [0.12, 1.5], gap: [1, 4], band: [0, 0.78], count: 1, pair: [1.5, -0.1], specks: { dark: 0.5 } },
  wear: {
    on: ['scales'],
    chin: 1,
    marks: [[['scuff', 0.45, 0.6, 0.4]], [['scorch', 0.45, 0.6, 0.4]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.8, 0.8] }],
  face: { r: 0.65, iris: '#2a1f1a' },
  gait: { bounce: [0.2, 0.8], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 24 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 38, scale: 0.8 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box', scale: 0.9 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25], eyes: false },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.78 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/dragon/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    // Not the tail arched over the back to hold the jar up to its face: standing in the blind sheet, the arc hid the
    // horns and wings and it read as a kettle.
    idle2: { pose: `standing on all four legs, one front foot raised and curled, its head held high, a smug little smile, the tail out low behind; ${KEEP}.` },
    'walk-1': {
      pose: `scampering to the right at a quick trot, the near front leg reaching forward and the far back leg pushing back, the other two legs planted, the wings flicked up; ${KEEP}.`,
    },
    'walk-2': { pose: `trotting to the right, the legs passing under the body, all four feet close to the ground, one front foot just lifted; ${KEEP}.` },
    'run-1': {
      pose: `running flat out to the right, stretched out long and low: both front legs reaching far forward, both back legs kicked far back, the head pushed forward, the tail streaming straight out behind; ${KEEP}.`,
    },
    'run-2': {
      pose: `running flat out to the right, gathered: all four legs bunched up under its body, every foot off the ground, the back rounded, the tail streaming out behind; ${KEEP}.`,
    },
    'air-1': {
      pose: `leaping up and forward, both front legs tucked up under its chest, both back legs stretched out behind, both umbrella wings flung up high, the tail out behind; ${KEEP}.`,
    },
    'air-2': {
      pose: `gliding down, both umbrella wings spread wide open out to the sides like a parachute, all four legs dangling straight down below it, its eye wide and its mouth open in alarm; ${KEEP}.`,
    },
    wall: {
      pose: 'seen from its side, facing right: it is clinging to a tall wall on the right edge of its space (do not draw the wall), standing up on its hind legs with both front claws braced flat against the wall, its tail hanging down behind, its head turned to look back at us, its eye open.',
      far: true,
    },
    cheer: {
      pose: `rearing up tall on its hind legs, both front legs raised high in the air, both wings spread wide, its head thrown up, a huge open grin; ${KEEP}.`,
    },
    cheer2: {
      pose: `a happy play bow, its front legs stretched forward flat on the ground and its rump high in the air, the tail raised high and wagging, a big grin; ${KEEP}.`,
    },
    death: {
      pose: 'it has been knocked out and lies on its back on the floor, the whole body horizontal, its head on the left and its tail on the right, all four legs sticking stiffly straight up in the air, its tongue out, its eyes shut. Seen from the side.',
      far: true,
    },
  },
};
