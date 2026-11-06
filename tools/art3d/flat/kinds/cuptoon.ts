import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 155,
  map: {
    // The coffee and the shoes are one brown in the drawing: `recolour` tells the shoes from the coffee by place.
    roles: ['white', 'red', 'sleeve', 'brown', 'shoe', 'tape', 'lid', 'dark'],
    families: [
      // The paper cup, the lid's lip, the handle, the gloves and the straw's white stripes, with their cel shadow. The
      // cup is drawn pure white: every drawing's enamel-white closed in by the outline is tinted just under the
      // tracer's near-white (art/sprites/cuptoon/design.prompt.txt), so `holes` cuts only the true gaps.
      ['white', [238, 236, 226]],
      ['white', [239, 231, 219]],
      ['white', [240, 234, 222]],
      ['white', [236, 228, 218]],
      ['white', [216, 218, 217]],
      ['white', [207, 207, 206]],
      ['white', [213, 211, 211]],
      ['white', [207, 197, 189]],
      ['white', [190, 188, 188]],
      // The shorts, the straw's red stripes and the nose (which goes with the drawn face), and the shorts' shade.
      ['red', [174, 46, 39]],
      ['red', [180, 50, 41]],
      ['red', [140, 39, 35]],
      ['red', [106, 30, 28]],
      // The cardboard sleeve and its shade.
      ['sleeve', [214, 120, 95]],
      ['sleeve', [217, 122, 97]],
      ['sleeve', [176, 101, 83]],
      ['sleeve', [189, 133, 120]],
      // The coffee under the popped lid, and the shoes.
      ['brown', [97, 63, 42]],
      ['brown', [97, 67, 48]],
      ['brown', [92, 57, 37]],
      ['brown', [106, 56, 41]],
      ['brown', [141, 105, 81]],
      // The tape holding the handle on.
      ['tape', [170, 171, 170]],
      ['tape', [136, 135, 140]],
      ['tape', [111, 102, 103]],
      // The plastic lid, painted grey in every drawing (design.prompt.txt): drawn white it was white rings on
      // the white cup, and the twist read as the original redrawn.
      ['lid', [86, 84, 92]],
      ['dark', [7, 12, 30]],
      ['dark', [3, 1, 8]],
      ['dark', [13, 9, 21]],
      ['dark', [23, 18, 29]],
      ['dark', [26, 6, 14]],
      ['dark', [54, 42, 42]],
    ],
    line: 'dark',
    thin: ['white', 'red', 'sleeve', 'brown', 'tape', 'lid'],
    fringe: 5,
    stroke: 2.4,
    feet: ['brown'],
    min: { dark: 0.1 },
    // The handle's eye and the gaps between the hose limbs.
    holes: 0.4,
    // Each hole takes its rim and the ink beside it goes to the figure: at 228 the handle's eye and the gaps
    // between the legs kept a white sliver of the cup's colour inside them.
    white: 150,
  },
  roles: [
    { name: 'white', color: '#f4f1ea' },
    // The shorts are the costume, in the player's colour; the straw's stripes are drawn in it too.
    { name: 'red', color: '#c9473f', slot: 'player' },
    // The cardboard sleeve: a light of the player's colour, the twist's colour block on the cup.
    { name: 'sleeve', color: '#808080', on: 1, tone: 14 },
    { name: 'brown', color: '#5c3a26' },
    // A colourway is the shoes (VARIETY.palette): brown leather, tan, grey.
    { name: 'shoe', color: '#6b4a35', alts: ['#9a7448', '#6e6a66'], vary: 6 },
    { name: 'tape', color: '#a9a8a4' },
    { name: 'lid', color: '#5c5a62' },
    { name: 'dark', color: '#1c1a24' },
    { name: 'scuff', color: '#808080', on: 1, tone: 12 },
    { name: 'scorch', color: '#808080', on: 1, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', area: [0.3, 4], gap: [1.4, 4.5], specks: { dark: 4, red: 0.8 } },
  recolour: { from: 'brown', to: 'shoe', below: 6, lying: [0.3, 0] },
  wear: {
    on: ['red'],
    chin: 4,
    marks: [[['scuff', 0.6, 0.9, 0.32]], [['scorch', 0.6, 0.9, 0.3]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.8, 0.8] }],
  face: { r: 0.9, iris: '#1c1a24', eye: 'tall' },
  gait: { bounce: [0.2, 0.85], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 42, centre: 'box' },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box', scale: 0.85 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Drawn three to a sheet (art/sprites/cuptoon/design.prompt.txt); these are the same poses one at a time.
  // The hose limbs bend in curves, never at an elbow or a knee: that is the 1930s read.
  poses: {
    idle2: { pose: 'standing with both gloves on his hips, the arms bowed out in round loops, chest out, rocking back on his heels with a pleased smile.' },
    'walk-1': { pose: 'strutting to the right, mid-step, the near shoe kicked forward and the far shoe back, the arms swinging in loose curves.' },
    'walk-2': { pose: 'strutting to the right, the legs passing under the body, one shoe planted and the other lifted a little behind.' },
    'run-1': {
      pose: 'running fast to the right, leaning forward, one knee high and the other leg stretched back pushing off, both arms pumping in big curves.',
    },
    'run-2': { pose: 'running fast to the right, leaning forward, both shoes off the ground, the legs gathered under him, the arms swung the other way.' },
    'air-1': {
      pose: 'jumping straight up, one glove punched high over his head on a long curving arm, the other arm down, both legs tucked up under the mug.',
    },
    'air-2': { pose: 'falling, both arms flung up over his head in wavy curves, the legs reaching down, the mouth open in alarm.' },
    wall: {
      pose: 'pressed against a tall wall just to his right (do not draw the wall): the near glove flat against it at shoulder height on a curving arm, both shoes braced against it, sliding down, his head turned to look back at us.',
    },
    cheer: { pose: 'cheering, both gloves thrown high over his head, up on the toes of his shoes, a big open grin.' },
    cheer2: {
      pose: 'dancing a little jig, turned a bit toward us, one leg kicked up high in a curve, one glove waving high, the other glove on his hip, laughing.',
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, the mug head on the left and the shoes on the right, the hose arms and legs splayed limp, eyes shut. Seen from the side.',
      far: true,
    },
  },
};
