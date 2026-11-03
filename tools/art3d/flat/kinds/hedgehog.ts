import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 229,
  map: {
    roles: ['blue', 'peach', 'red', 'yellow', 'grey', 'brown', 'white', 'dark', 'iris', 'stripe'],
    families: [
      ['blue', [60, 98, 181]],
      ['blue', [45, 72, 134]],
      ['blue', [47, 63, 107]],
      ['blue', [82, 102, 156]],
      ['blue', [62, 92, 167]],
      ['peach', [247, 188, 131]],
      ['peach', [223, 188, 148]],
      ['peach', [194, 159, 125]],
      ['peach', [239, 191, 125]],
      ['red', [192, 54, 39]],
      ['red', [101, 39, 29]],
      ['yellow', [237, 201, 97]],
      ['grey', [141, 142, 134]],
      // The tape round the back quill: grey, or its light shade is the belly's tan, floating off the head.
      ['grey', [172, 166, 158]],
      ['grey', [130, 126, 116]],
      ['brown', [137, 86, 59]],
      ['brown', [105, 74, 53]],
      // The scarf's dark stripes: a role of their own, apart from the ink, or they're grey chips (as grey) or a
      // chain of ink dots across him (as the ink).
      ['stripe', [76, 66, 54]],
      ['white', [255, 255, 252]],
      // The eye white's shade under the brow: white, or a grey scrap over the eye.
      ['white', [180, 188, 196]],
      ['dark', [42, 16, 10]],
      ['dark', [59, 31, 23]],
      // The soot on the quill tips: dark, or it's grey chips on them.
      ['dark', [48, 48, 48]],
      // The green irises: a role of their own, so the face kit finds the eye and nothing else (as brown or
      // dark, a scarf stripe or a quill's soot won, and the kit's eyes rode the chest or the back of the head).
      ['iris', [88, 140, 68]],
    ],
    line: 'dark',
    thin: ['blue', 'peach', 'red', 'yellow', 'grey', 'brown', 'white', 'stripe'],
    fringe: 5,
    stroke: 2.4,
    // The neckerchief's and gloves' outlines stay line, not scraps of ink on them.
    ink: 13,
    feet: ['red', 'grey'],
    min: { dark: 0.12, white: 0.1, iris: 0.1 },
  },
  roles: [
    { name: 'blue', color: '#2f5bd0', slot: 'player' },
    { name: 'peach', color: '#f0c99c' },
    // A colourway is the sneakers (VARIETY.palette): red, racing green or cream.
    { name: 'red', color: '#d8382f', alts: ['#2f8a57', '#ebe5d6'], vary: 6 },
    { name: 'yellow', color: '#e8c24a' },
    { name: 'grey', color: '#9a9894' },
    { name: 'brown', color: '#7a5236' },
    { name: 'white', color: '#fbf8f2' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'iris', color: '#3a9a46' },
    { name: 'stripe', color: '#4c4236' },
    { name: 'scuff', color: '#808080', on: 1, tone: 10 },
    { name: 'scorch', color: '#808080', on: 1, tone: -16 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 0, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'iris', area: [0.05, 1.5], gap: [1, 4.5], specks: { dark: 1.6, white: 4, iris: 2, stripe: 1 }, band: [0.1, 0.45] },
  wear: {
    on: ['peach'],
    chin: 3,
    // One quiet streak each on the belly: two, or a strong tone, read as a rash on the tan.
    marks: [[['scuff', 0.5, 0.62, 0.6]], [['scorch', 0.5, 0.62, 0.6]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2.2, 0.9] }],
  face: { r: 1, iris: '#3a9a46', mouth: [1.4, 2.7] },
  gait: { bounce: [0, 0.45], lean: [0.01, 0.06] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 48 },
    // The jump is the spin ball, all the way up and down, with no face.
    air: { frames: ['air-1', 'air-1b'], loop: true, fps: 12, eyes: false },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.7, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  poses: {
    idle2: { pose: 'standing with his arms folded across his chest, tapping one toe, smirking.' },
    'walk-1': { pose: 'walking to the right, mid-step: the near sneaker forward, the far one back, the arms swinging the other way.' },
    'walk-2': { pose: 'walking to the right, the legs passing under the body: one sneaker planted, the other lifted a little.' },
    'run-1': {
      pose: 'running flat out to the right, leaning hard forward, the legs a long blur of a stride, the arms swept back, the quills streaming behind.',
    },
    'run-2': {
      pose: 'running flat out to the right, leaning hard forward, both sneakers off the ground with the legs gathered under him, the arms swept back.',
    },
    'air-1': { pose: 'curled up tight into a spinning ball in mid-air, the quills all round the outside, no face showing.', far: true },
    wall: {
      pose: 'seen from his side, he is sliding down a tall wall on the right edge of the picture (do not draw the wall), one glove flat against it and both sneakers braced on it, his head turned to look back at us.',
      far: true,
    },
    cheer: { pose: 'cheering, one fist punched high over his head, a big grin.' },
    cheer2: { pose: 'stretching with both fists high over his head, up on his toes, his eyes wide open and looking ahead, grinning.' },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal across the picture, head on the left and sneakers on the right, arms and legs splayed limp, eyes shut. Seen from the side.',
      far: true,
    },
    'air-1b': { pose: 'curled up tight into a spinning ball in mid-air, the quills all round the outside, no face showing.', far: true },
  },
};
