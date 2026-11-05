import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 172,
  map: {
    // The tea and the shoes are one brown in the drawing: `recolour` tells the shoes from the tea by place.
    roles: ['white', 'red', 'rim', 'brown', 'shoe', 'tag', 'dark'],
    families: [
      // The enamel, the gloves and the straw's white stripes, with the mug's cel shadow.
      ['white', [245, 239, 226]],
      ['white', [243, 236, 224]],
      ['white', [236, 230, 222]],
      ['white', [203, 181, 154]],
      ['white', [215, 198, 156]],
      ['white', [202, 192, 175]],
      ['white', [168, 156, 145]],
      // The shorts, the straw's red stripes and the nose (which goes with the drawn face), and the shorts' shade.
      ['red', [183, 56, 43]],
      ['red', [190, 51, 41]],
      ['red', [166, 66, 47]],
      ['red', [134, 32, 23]],
      ['red', [108, 41, 31]],
      ['rim', [65, 97, 140]],
      ['rim', [71, 89, 118]],
      ['rim', [85, 104, 130]],
      ['rim', [81, 83, 93]],
      ['brown', [105, 68, 42]],
      ['brown', [137, 77, 37]],
      ['brown', [100, 53, 35]],
      ['brown', [95, 67, 50]],
      ['brown', [152, 116, 90]],
      ['tag', [227, 189, 72]],
      ['tag', [215, 187, 113]],
      ['dark', [6, 9, 27]],
      ['dark', [2, 2, 14]],
      ['dark', [16, 17, 31]],
      ['dark', [40, 22, 26]],
      ['dark', [68, 57, 54]],
    ],
    line: 'dark',
    thin: ['white', 'red', 'rim', 'brown', 'tag'],
    fringe: 5,
    stroke: 2.4,
    feet: ['brown'],
    loose: ['tag'],
    min: { dark: 0.1 },
    // The handle's eye and the gaps between the hose limbs (the drawings' cream is kept under the near-white).
    holes: 0.4,
    // Each hole takes its rim and the ink beside it goes to the figure: at 228 the handle's eye and the gaps
    // between the legs kept a white sliver of the enamel's colour inside them.
    white: 150,
  },
  roles: [
    { name: 'white', color: '#f4efe6' },
    // The shorts are the costume, in the player's colour; the straw's stripes are drawn in it too.
    { name: 'red', color: '#c9473f', slot: 'player' },
    // The enamel rim: a dark of the player's colour, apart from the white mug and the tea.
    { name: 'rim', color: '#808080', on: 1, tone: -22 },
    { name: 'brown', color: '#7a4e30' },
    // A colourway is the shoes (VARIETY.palette): brown leather, tan, grey.
    { name: 'shoe', color: '#6b4a35', alts: ['#9a7448', '#6e6a66'], vary: 6 },
    // The tea-bag's tag: a light tone of the player's colour.
    { name: 'tag', color: '#808080', on: 1, tone: 26 },
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
    chin: 6,
    marks: [[['scuff', 0.6, 0.9, 0.45]], [['scorch', 0.6, 0.9, 0.42]]],
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
