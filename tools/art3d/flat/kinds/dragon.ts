import type { FlatKind } from '../kinds';

// Small and low on four legs, side on, with what only this little dragon has in outline: the long horns swept
// straight back off a big round head, a small wing standing straight up off the middle of the back with background
// between it and the horns (swept back beside them, wing, horns and spines read as one bundle of quills: the
// hedgehog), and the arrowhead on the end of the tail. The run is a charge, the horns raised and the chin tucked, never
// a flat dash with everything streaming back (read as the hedgehog too). The wings are umbrella cloth on bent spokes
// and a firefly in a jam jar hangs from the tail: the twist. The poses were drawn three to a 16:9 image with the design
// as the reference and cut apart (art/sprites/dragon/design.prompt.txt).
const KEEP =
  'the two long pale horns always on its big round head, the small umbrella-cloth wing always standing straight up off the middle of its back, the taped arrowhead tip always on the end of its tail with the small jam jar hanging from it on a string, its eye open';

export const kind: FlatKind = {
  body: 250,
  map: {
    roles: ['wing', 'far', 'scales', 'bone', 'grey', 'glass', 'mouth', 'dark'],
    // Sampled from the design (art/sprites/dragon/design.png, `swatch.py`) and its poses.
    families: [
      ['scales', [135, 102, 207]],
      ['scales', [133, 100, 204]],
      ['scales', [134, 105, 198]],
      ['scales', [130, 98, 200]],
      ['scales', [136, 106, 201]],
      ['scales', [129, 100, 189]],
      ['scales', [146, 114, 184]],
      // The far legs, and the scales' cel shadow under the belly and the head, in the drawing's one shade.
      ['far', [114, 85, 132]],
      ['far', [124, 97, 176]],
      ['far', [119, 93, 162]],
      // The umbrella cloth, and its shade.
      ['wing', [193, 178, 217]],
      ['wing', [187, 172, 209]],
      ['wing', [189, 172, 223]],
      ['wing', [172, 154, 185]],
      ['wing', [136, 115, 165]],
      // The belly, the horns, the spines and the arrowhead, their shade, and the eye's white.
      ['bone', [235, 219, 183]],
      ['bone', [234, 226, 198]],
      ['bone', [239, 228, 200]],
      ['bone', [230, 215, 183]],
      ['bone', [212, 200, 191]],
      // The wing's patch and the tape round the arrowhead.
      ['grey', [161, 148, 176]],
      ['grey', [153, 143, 145]],
      ['grey', [168, 158, 168]],
      // The jar's glass and the firefly's glow.
      ['glass', [216, 232, 236]],
      ['glass', [208, 224, 232]],
      ['glass', [236, 240, 192]],
      ['mouth', [208, 116, 124]],
      ['mouth', [172, 88, 96]],
      ['mouth', [232, 140, 134]],
      ['mouth', [112, 68, 90]],
      ['dark', [48, 35, 35]],
      ['dark', [34, 21, 27]],
      ['dark', [51, 36, 45]],
      ['dark', [63, 47, 61]],
      ['dark', [83, 68, 84]],
    ],
    line: 'dark',
    thin: ['wing', 'far', 'scales', 'bone', 'grey', 'glass', 'mouth'],
    fringe: 3,
    holes: 0.8,
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
  // the head's band that sits in its white (`in`): the darks between the wing's panels are as big, and in the air
  // the eye landed on the wing. The white goes with it (`bone` in `specks`), or its rim showed round the kit's eye
  // and under its blink; the kit's eye is as big as it. The far eye is set along the snout from it.
  eyes: {
    role: 'dark',
    from: 'map',
    glint: 0.25,
    area: [0.12, 1.5],
    gap: [1, 4],
    band: [0, 0.78],
    count: 1,
    pair: [1.5, -0.1],
    in: 'bone',
    specks: { dark: 0.5, bone: 6 },
  },
  wear: {
    on: ['scales'],
    chin: 1,
    marks: [[['scuff', 0.45, 0.6, 0.4]], [['scorch', 0.45, 0.6, 0.4]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.8, 0.8] }],
  face: { r: 1.15, iris: '#3a2a5a', eye: 'profile', far: 'none' },
  gait: { bounce: [0.2, 0.8], lean: [0, 0.03] },
  clips: {
    // Long and low, the tail and its jar reach past the box behind him: every pose is centred on itself.
    idle: { frames: ['idle'], loop: true, fps: 1, centre: 'box' },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4], centre: 'box' },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 24, centre: 'box' },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 38, scale: 0.9, centre: 'box' },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box', scale: 0.8 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.74 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25], eyes: false, centre: 'box' },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3], centre: 'box' },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.78 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/dragon/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing on all four legs, one front foot raised and curled, its head held high, a smug little smile, the tail out low behind; ${KEEP}.` },
    'walk-1': {
      pose: `trotting briskly to the right with a cocky bounce, the near front leg lifted high and reaching forward and the far back leg pushing back, the other two legs planted, its chin up; ${KEEP}.`,
    },
    'walk-2': { pose: `trotting to the right, the legs passing under the body, all four feet close to the ground, one front foot just lifted; ${KEEP}.` },
    // A charge, not a dash: the head and horns up and forward, the wing up. Streamed back, the dash read as the hedgehog.
    'run-1': {
      pose: `charging to the right at a full gallop like a little bull, its head lowered and pushed forward so both long horns point forward like a battering ram, both front legs reaching forward and both back legs pushing off far behind, the wing up on its back, a cocky determined grin; ${KEEP}.`,
    },
    'run-2': {
      pose: `galloping to the right, gathered: all four legs bunched up under its body, every foot off the ground, its back rounded, its head still lowered with the horns pointing forward, the wing up; ${KEEP}.`,
    },
    'air-1': {
      pose: `leaping up and forward, its body tilted up, both front legs tucked up under its chest, both back legs stretched out behind, both umbrella wings spread wide and flung up high, the tail out behind; ${KEEP}.`,
    },
    'air-2': {
      pose: `gliding down, both umbrella wings spread wide open out to the sides like a parachute, all four legs dangling straight down below it, its eye wide and its mouth open in alarm; ${KEEP}.`,
    },
    // Drawn facing left and mirrored.
    wall: {
      pose: 'seen from its side, facing right: it is clinging to a tall wall on the right edge of its space (do not draw the wall), standing up on its hind legs with both front claws braced flat against the wall, its tail hanging down behind, its head turned to look back at us, its eye open.',
      far: true,
    },
    cheer: {
      pose: `rearing up on its hind legs, both front legs raised forward in front of its chest, both wings spread up, its head thrown up, a huge open grin, its horns swept back; ${KEEP}.`,
    },
    // Drawn facing left and mirrored.
    cheer2: {
      pose: `a happy play bow, its front legs stretched forward flat on the ground and its rump high in the air, the tail raised high, a big grin; ${KEEP}.`,
    },
    death: {
      pose: 'it has been knocked out and lies on its back on the floor, the whole body horizontal, its head on the left and its tail on the right, all four legs sticking stiffly straight up in the air, its tongue out, its eyes shut. Seen from the side.',
      far: true,
    },
  },
};
