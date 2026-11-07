import type { FlatKind } from '../kinds';

// Every pose keeps what carries him (art/sprites/hitman/design.prompt.txt): the huge smooth bald head with the white
// price sticker and its barcode on the back of the skull; the broad square suit with the white shirt V and the tie
// down it (in an orange suit, the V and the tie are what make it a suit, not a jumpsuit); a stapler held like a pistol
// in each black-gloved fist, low and out from his sides with background round it (hung against the legs, they were
// lost in the outline and he read as a thin man in a jumpsuit).
const KEEP =
  'always the huge smooth bald head with the white barcode price sticker on the back of his skull, the broad square suit with the white shirt V and the crooked red tie, a big silver stapler held like a pistol in each black-gloved fist, low and out from his sides with white background round it, black shoes';

export const kind: FlatKind = {
  body: 228,
  map: {
    // Back to front: the sticker's white is drawn over the head (under it, the head's skin covered it).
    roles: ['suit', 'tie', 'skin', 'white', 'glove', 'steel', 'eye', 'dark'],
    // Sampled from the design (art/sprites/hitman/design.png, `swatch.py` and by hand).
    families: [
      // The suit, its cel shade and the lapels' (one shape: the lapels are only its shade).
      ['suit', [76, 87, 111]],
      ['suit', [80, 91, 110]],
      ['suit', [83, 92, 111]],
      ['suit', [74, 84, 106]],
      ['suit', [53, 59, 80]],
      ['suit', [52, 55, 80]],
      ['suit', [57, 57, 75]],
      ['suit', [50, 56, 75]],
      // The tie and its shade.
      ['tie', [185, 48, 58]],
      ['tie', [186, 46, 57]],
      ['tie', [132, 46, 51]],
      // The shirt, the cuffs and the price sticker (made one white label by art/sprites/hitman/sticker.py).
      ['white', [245, 246, 240]],
      ['white', [255, 255, 247]],
      ['white', [244, 244, 238]],
      ['white', [241, 242, 236]],
      // Skin, its shade and highlight.
      ['skin', [239, 200, 165]],
      ['skin', [237, 201, 167]],
      ['skin', [235, 202, 169]],
      ['skin', [205, 162, 138]],
      ['skin', [208, 162, 140]],
      ['skin', [232, 218, 202]],
      // The gloves and shoes.
      ['glove', [43, 46, 51]],
      ['glove', [49, 51, 53]],
      ['glove', [35, 37, 44]],
      ['glove', [30, 33, 36]],
      // The staplers and their shade.
      ['steel', [177, 185, 190]],
      ['steel', [168, 174, 180]],
      ['steel', [141, 132, 131]],
      // The eyes, drawn in the same warm brown as the head's outline (cheer2's outline is made ink by sticker.py: there
      // it closed into one ring of this role, traced as a fill over the whole head).
      ['eye', [54, 41, 40]],
      // The ink, and the sticker's three bars.
      ['dark', [16, 14, 26]],
      ['dark', [11, 10, 24]],
      ['dark', [17, 18, 32]],
      ['dark', [24, 25, 39]],
      ['dark', [33, 31, 29]],
    ],
    line: 'dark',
    thin: ['suit', 'tie', 'skin', 'white', 'glove', 'steel'],
    fringe: 5,
    stroke: 2.4,
    feet: ['glove'],
    // The staplers are carried, so the body's size is him alone, alike in every pose.
    loose: ['steel'],
    min: { dark: 0.3, tie: 0.4, steel: 0.4, eye: 5 },
    // The background closed in between an arm and the body, and between the legs. Only what is lighter than 249 is a
    // hole: at the default 228 the white shirt V and the sticker were closed-in white too, and were cut through.
    holes: 0.8,
    white: 249,
  },
  roles: [
    // The costume: the suit in the player's colour, the tie a light of it. It lies on the white shirt, so it is only a
    // little lighter: at +30 it went white on a pink or a cyan suit and the shirt V lost it.
    { name: 'suit', color: '#4c5770', slot: 'player' },
    { name: 'tie', color: '#808080', on: 0, tone: 16 },
    { name: 'skin', color: '#efc8a6' },
    { name: 'white', color: '#f4f3ee' },
    // A colourway is the gloves and shoes together (VARIETY.palette): black leather, a dark brown, a charcoal.
    { name: 'glove', color: '#2e3036', alts: ['#4a3a30', '#45474e'], vary: 6 },
    { name: 'steel', color: '#b6bcc2' },
    { name: 'eye', color: '#2a2020' },
    { name: 'dark', color: '#1c1c24' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -22 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'eye', from: 'map', area: [0.1, 2], gap: [0.8, 4], band: [0.1, 0.4], edge: 0.2, specks: { eye: 3, dark: 1.5 } },
  wear: {
    on: ['suit'],
    chin: 7,
    marks: [[['scuff', 0.4, 0.62, 0.14]], [['scorch', 0.45, 0.74, 0.14]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'crown', size: [1.4, 0.5] }],
  // His drawing's eyes are small black dots with a glint, calm and blank: the kit's `dot`, and the far one turned,
  // since the three-quarter face draws both.
  face: { r: 0.55, iris: '#2a2020', eye: 'dot', far: 'turned' },
  // An unhurried, even walk, upright: little bounce, no lean.
  gait: { bounce: [0.2, 0.5], lean: [0, 0.02] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    // The near stapler raised and held out level, like a pistol.
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 22 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 32 },
    // Smaller in the air: the fall flings both staplers out past the box's sides.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.7 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.9 },
    // He straightens the crooked tie.
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.8, 0.3] },
    // A small smug hop, eyes shut.
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3], eyes: false },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.8 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/hitman/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: {
      pose: `standing still, the near stapler raised and held out level ahead of him at chest height like a pistol, white background round it, the other held low, ${KEEP}.`,
    },
    'walk-1': { pose: `walking to the right in an unhurried even step, the near shoe stepping forward, arms still at his sides, ${KEEP}.` },
    'walk-2': { pose: `walking to the right, the legs passing under him, one shoe planted and the other lifted behind, ${KEEP}.` },
    'run-1': { pose: `running fast to the right, body upright, the near knee raised in front and the far leg pushing off behind, ${KEEP}.` },
    'run-2': { pose: `running to the right mid-stride, both shoes off the ground, the legs wide apart front and back, body upright, ${KEEP}.` },
    'air-1': { pose: `jumping straight up, both shoes tucked up under him, both staplers held out low to the sides, ${KEEP}.` },
    'air-2': {
      pose: `falling, both shoes reaching down and apart, both arms flung out wide to the sides at shoulder height, a stapler in each fist, ${KEEP}.`,
    },
    wall: {
      pose: 'seen from his side, facing right: he is sliding down a tall wall on the right edge of his space (do not draw the wall), both shoes and his near gloved fist braced flat against it, knees bent, the huge bald head with the barcode sticker on its back, the far stapler held out away from the wall to the left, his face turned to look back at us.',
      far: true,
    },
    cheer: {
      pose: `cheering, standing, straightening his crooked tie at his collar with his near fist, the stapler still in it, the other stapler held low out from his side, ${KEEP}.`,
    },
    cheer2: {
      pose: `a small calm hop, both shoes off the ground, both staplers held out wide to the sides at hip height, his eyes shut in a smug little smile, ${KEEP}.`,
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, his bald head on the left and his shoes on the right, arms and legs splayed limp, the barcode sticker hanging half off his head, the two staplers dropped on the floor beside him. Seen from the side.',
      far: true,
    },
  },
};
