import type { FlatKind } from '../kinds';

// A chunky little swordswoman, a white bob with a straight fringe over a black satin sleep mask tied behind her head,
// a short dress flaring at the hem over thigh-high boots, the giant letter opener held low in front of her pointing
// forward and down (never tip-down beside her, the mercenary's, nor on her shoulder, the plumber's), and a dented
// cardboard box hung on a string from a stick over her shoulder for a drone. Drawn three to a 16:9 image with the
// design as the reference and cut apart (art/sprites/android/design.prompt.txt).
const KEEP =
  'the white bob, the black sleep mask with its knot tails, the long letter opener held low in her hand clear of her legs and of the box, and the cardboard box hanging from the stick over her shoulder';

export const kind: FlatKind = {
  body: 115,
  map: {
    roles: ['dress', 'trim', 'skin', 'hair', 'steel', 'box', 'dark'],
    // Sampled from the design (art/sprites/android/design.png, `swatch.py` and by region).
    families: [
      // The dress and boots, one blue, and its cel shade.
      ['dress', [66, 94, 160]],
      ['dress', [65, 94, 159]],
      ['dress', [69, 94, 158]],
      ['dress', [77, 84, 125]],
      ['dress', [91, 99, 134]],
      // The dark hem and the inside of the skirt.
      ['trim', [44, 66, 126]],
      ['trim', [44, 57, 102]],
      ['trim', [32, 37, 57]],
      ['skin', [242, 212, 189]],
      ['skin', [244, 218, 196]],
      ['skin', [203, 149, 130]],
      ['skin', [196, 166, 150]],
      // The bob and its grey cel shade, a step darker than the blade's steel.
      ['hair', [239, 235, 225]],
      ['hair', [240, 236, 227]],
      ['hair', [242, 236, 228]],
      ['hair', [237, 232, 226]],
      ['hair', [180, 180, 186]],
      ['hair', [186, 180, 186]],
      ['steel', [194, 196, 202]],
      ['steel', [192, 198, 204]],
      ['steel', [202, 200, 204]],
      ['steel', [198, 198, 204]],
      // The cardboard box and the stick, one brown; the tape on the box folded in.
      ['box', [192, 150, 102]],
      ['box', [150, 108, 72]],
      ['box', [144, 102, 72]],
      ['box', [126, 84, 60]],
      ['box', [158, 158, 152]],
      // The ink, and the sleep mask and its tails, drawn in it.
      ['dark', [37, 34, 42]],
      ['dark', [29, 19, 37]],
      ['dark', [15, 9, 28]],
      ['dark', [26, 12, 27]],
      ['dark', [42, 35, 45]],
    ],
    line: 'dark',
    thin: ['dress', 'trim', 'skin', 'hair', 'steel', 'box'],
    fringe: 5,
    stroke: 2.4,
    feet: ['dress'],
    // The letter opener and the box hang off her: the body's size is her alone, alike in every pose.
    loose: ['steel', 'box'],
    min: { dark: 0.3, box: 0.2 },
    // No corner-cutting: rounded, the cardboard box traced as a sack.
    smooth: 0,
  },
  roles: [
    // The costume: the dress and boots in the player's colour, the hem and the skirt's inside a dark of it.
    { name: 'dress', color: '#3f5fa8', slot: 'player' },
    { name: 'trim', color: '#808080', on: 0, tone: -30 },
    { name: 'skin', color: '#f2d6c0' },
    // The bob is always white: a silver or a cool white read as a helmet's metal and a cream as blonde.
    { name: 'hair', color: '#efebe2' },
    { name: 'steel', color: '#c4c7ce' },
    // A colourway is the cardboard drone (VARIETY.palette), neutrals all: brown kraft, a grey board, a pale tan.
    { name: 'box', color: '#b98c5c', alts: ['#a39279', '#d2ad7e'], vary: 6 },
    { name: 'dark', color: '#25202a' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // Her eyes are under the mask, drawn in thick ink: found whole in the map, the strip it is once prep.py has cut its
  // tails and narrowed it, whose middle sits over her near eye. The kit draws one printed eye there and no far one:
  // two pale marks side by side on a black strip read as goggles.
  eyes: { role: 'dark', from: 'map', area: [3, 12], gap: [1, 3], specks: { dark: 0.5 }, band: [0.1, 0.4], count: 1 },
  wear: {
    on: ['dress'],
    chin: 5,
    marks: [[['scuff', 0.45, 0.4, 0.22]], [['scorch', 0.55, 0.5, 0.26]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.2, 0.5] }],
  // The pale sleepy eyes printed on the mask (the twist), and the kit's mouth under it: the one feature of hers that shows.
  face: { r: 0.6, iris: '#bdb7c4', eye: 'printed', far: 'none', mouth: [1.3, 1.3] },
  gait: { bounce: [0.2, 0.6], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box', scale: 0.86 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.9 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/android/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: {
      pose: `standing calm, head tilted, her free hand raised to steady the hanging cardboard box beside her shoulder, the letter opener held low in front pointing forward and down; ${KEEP}.`,
    },
    'walk-1': {
      pose: `walking to the right, mid-step, the near boot forward and the far boot back, the letter opener held low in front pointing forward and down; ${KEEP}.`,
    },
    'walk-2': {
      pose: `walking, the legs passing under her, one boot planted and the other lifted a little behind, the letter opener held low in front; ${KEEP}.`,
    },
    'run-1': {
      pose: `running fast to the right, leaning forward, the near knee raised high and the far leg pushing off behind, the letter opener held low pointing forward and down; ${KEEP}.`,
    },
    'run-2': { pose: `running, both boots off the ground, legs split wide front and back, the letter opener held low pointing forward and down; ${KEEP}.` },
    'air-1': { pose: `jumping up, both knees tucked up under her, the letter opener held low pointing forward and down below her knees; ${KEEP}.` },
    'air-2': {
      pose: `falling, both boots reaching down and apart, the free arm out to the side, the letter opener pointing down and forward below her; ${KEEP}.`,
    },
    wall: {
      pose: 'seen from her side: she is sliding down a tall wall that is just to her right (do not draw the wall), one palm and both boots braced flat against it, knees bent, the letter opener hanging down below her in her other hand, the cardboard box on its stick behind her, her head turned to look back at us.',
      far: true,
    },
    cheer: {
      pose: `cheering, one boot kicked up behind her, the free hand on her hip, the letter opener held out forward pointing up at a slant in front of her face, clear of it, an open happy mouth; ${KEEP}.`,
    },
    cheer2: {
      pose: `a little curtsy, knees bent, the free hand holding out the hem of her dress, the letter opener held low out to the side pointing down; ${KEEP}.`,
    },
    death: {
      pose: 'seen from the side: she has been knocked out and lies flat on her back on the floor, the whole body horizontal, head on the left and boots on the right, arms and legs splayed limp, the letter opener dropped flat on the floor below her, the box fallen beside her.',
      far: true,
    },
  },
};
