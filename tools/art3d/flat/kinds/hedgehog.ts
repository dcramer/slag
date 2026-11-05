import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 229,
  map: {
    roles: ['blue', 'peach', 'shoe', 'scarf', 'grey', 'brown', 'white', 'dark', 'iris', 'sole', 'tape'],
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
      ['shoe', [192, 54, 39]],
      ['shoe', [101, 39, 29]],
      ['scarf', [237, 201, 97]],
      ['grey', [141, 142, 134]],
      // The tape round the back quill: a role of its own, drawn in the quills' colour (grey, it was a lump behind
      // the head at play size).
      ['tape', [172, 166, 158]],
      ['tape', [130, 126, 116]],
      ['brown', [137, 86, 59]],
      ['brown', [105, 74, 53]],
      // The scarf's dark stripes fold into its cloth: at play size a hazard stripe is a dark mottle on the chest.
      ['scarf', [76, 66, 54]],
      // The flapping sole's dark underside: a role of its own, or (as the stripes' cloth) the shoe opens in the scarf's colour.
      ['sole', [64, 64, 64]],
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
    thin: ['blue', 'peach', 'shoe', 'scarf', 'grey', 'brown', 'white', 'sole', 'tape'],
    fringe: 5,
    stroke: 2.4,
    // The neckerchief's and gloves' outlines stay line, not scraps of ink on them. Over 13: the knot behind the neck,
    // its stripes' shade wrapped in thick ink, stayed a solid black blob there in every pose.
    ink: 19,
    feet: ['shoe', 'grey'],
    // The face's stray specks fold away: a white gap by the glove, scraps of the grin and of the scarf's dark
    // (painted over, a speck leaves a rim). The tape's light grey on the soles folds into the shoe.
    min: { dark: 0.85, white: 0.8, iris: 0.1, tape: 3.5 },
  },
  roles: [
    { name: 'blue', color: '#2f5bd0', slot: 'player' },
    { name: 'peach', color: '#f0c99c' },
    // The sneakers, a dark of the quills: far enough off them that the legs end in shoes.
    { name: 'shoe', color: '#808080', on: 0, tone: -22 },
    // The neckerchief, a dark of the quills: its tails cross them behind the neck. A light of them was the
    // muzzle's peach on an orange hedgehog, and the neckerchief and the chin drew as one shape.
    { name: 'scarf', color: '#808080', on: 0, tone: -15 },
    // The strap, told from the neckerchief (one yellow in the drawing) by where it is (`recolour`).
    { name: 'strap', color: '#ebe5d6' },
    // The toecaps.
    { name: 'grey', color: '#9a9894' },
    // A colourway is the gloves (VARIETY.palette): brown, black or tan leather.
    { name: 'brown', color: '#7a5236', alts: ['#45403c', '#a8794a'], vary: 6 },
    { name: 'white', color: '#fbf8f2' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'iris', color: '#3a9a46' },
    { name: 'sole', color: '#4c4236' },
    // The taped quill is the quills' colour, its wrap lines left to say tape.
    { name: 'tape', color: '#2f5bd0', on: 0, tone: 0 },
    { name: 'scuff', color: '#808080', on: 1, tone: 10 },
    { name: 'scorch', color: '#808080', on: 1, tone: -16 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 0, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // The strap: the drawing's yellow under the face; lying or spun, the yellow right of the neckerchief, less
  // the spin's streak of neckerchief on the right (2.7 world px², a strap at most 1.9, by the lying shoe's 3.9).
  recolour: [
    { from: 'scarf', to: 'strap', below: 7, lying: [0.5, -2] },
    { from: 'strap', to: 'scarf', below: 99, lying: [2.2, 1] },
  ],
  eyes: { role: 'iris', area: [0.05, 1.5], gap: [1, 4.5], specks: { dark: 1.6, white: 4, iris: 2 }, band: [0.1, 0.45] },
  wear: {
    on: ['peach'],
    chin: 3,
    // One quiet streak each on the belly: two, or a strong tone, read as a rash on the tan.
    marks: [[['scuff', 0.5, 0.62, 0.6]], [['scorch', 0.5, 0.62, 0.6]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2.2, 0.9] }],
  face: { r: 0.9, iris: '#3a9a46', mouth: [1.4, 2.7] },
  gait: { bounce: [0, 0.45], lean: [0.01, 0.06] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 48 },
    // The jump is the spin ball, all the way up and down, with no face; centred on itself, since its feet are
    // wherever the spin left them.
    air: { frames: ['air-1', 'air-1b'], loop: true, fps: 12, eyes: false, centre: 'box' },
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
