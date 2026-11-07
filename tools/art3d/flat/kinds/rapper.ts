import type { FlatKind } from '../kinds';

// Redrawn 2026-11-06 for the clean colour read, where the round-8 head read as "a dog under a pointed green cap" and
// never the rapping puppy. The head is now half his height, the dog read first: a long thick snout with a big brown
// nose on its tip, the jaw open rapping, and one big floppy ear in a brown of its own (neutral), hanging straight down
// to the shoulder, a shape of its own where a cream ear sank into the head. The beanie is a tall soft dome with a thick
// ribbed cuff in a dark of the costume, never a point (a point read as a gnome's, a wizard's or an elf's cap). The mic
// is a grey stick with a light ball head, held up to his mouth; a black mic was cut through with the open mouth and
// read as a glove. He is a card standee come loose: the card's brown edge all round his outline, a fold crease and a
// torn bite at his shorts. Every pose keeps those shapes (KEEP); the sheets' prompts are in
// art/sprites/rapper/design.prompt.txt.
const KEEP =
  'in every one the tall rounded orange beanie with its thick dark ribbed cuff standing straight up on his big head, the long snout with the big brown nose out in front, the big floppy brown ear hanging straight down behind his head, never flying up or back, the grey microphone with its round light grey ball head always in his fist, the brown card edge all round him, both eyes open';

export const kind: FlatKind = {
  body: 187,
  map: {
    roles: ['card', 'fur', 'tee', 'shorts', 'shoe', 'mic', 'nose', 'mouth', 'dark', 'ear', 'mesh'],
    // Sampled from the design (art/sprites/rapper/design.png, `swatch.py`).
    // Sampled from the design (art/sprites/rapper/design.png, `swatch.py`).
    families: [
      // The card's edge all round his outline and the rough card in the torn bite.
      ['card', [178, 142, 98]],
      ['card', [175, 142, 101]],
      ['card', [153, 126, 94]],
      ['card', [198, 139, 71]],
      ['card', [187, 143, 91]],
      // The fur, and the fold crease's shade across it.
      ['fur', [237, 219, 169]],
      ['fur', [223, 207, 165]],
      ['fur', [233, 214, 165]],
      ['fur', [235, 222, 183]],
      ['fur', [203, 189, 161]],
      // The beanie's dome and the tee: one orange, the player's colour.
      ['tee', [226, 140, 39]],
      ['tee', [217, 141, 48]],
      // The cuff and the shorts: one dark orange, a dark of it.
      ['shorts', [192, 97, 7]],
      ['shorts', [191, 111, 33]],
      ['shoe', [235, 229, 213]],
      ['ear', [136, 94, 60]],
      ['ear', [131, 90, 54]],
      ['ear', [131, 98, 66]],
      ['nose', [85, 60, 39]],
      ['mic', [113, 106, 101]],
      ['mic', [90, 94, 102]],
      ['mesh', [200, 204, 210]],
      ['mouth', [225, 135, 130]],
      ['mouth', [190, 90, 90]],
      ['dark', [40, 28, 17]],
      ['dark', [0, 0, 0]],
      ['dark', [10, 1, 1]],
    ],
    line: 'dark',
    thin: ['card', 'fur', 'tee', 'shorts', 'shoe', 'mic', 'nose', 'mouth', 'ear', 'mesh'],
    fringe: 5,
    stroke: 2.4,
    ink: 15,
    // The white between the mic arm and the body, between the legs, and between the ear and his back, cut through.
    holes: 0.25,
    // The open mouth, a dark wedge under the snout, is cut through: filled, the snout and jaw were one lump.
    cut: { role: 'dark', area: 1.2 },
    feet: ['shoe'],
    // The mic is carried, so the body's size is the puppy's whatever his arm does.
    loose: ['mic', 'mesh'],
    min: { dark: 0.05, mouth: 0.2, nose: 0.3, card: 0.15, mic: 0.5 },
  },
  roles: [
    { name: 'card', color: '#b8946a' },
    { name: 'fur', color: '#f1dfb8' },
    // The beanie and the tee are the costume, in the player's colour; the beanie's cuff and the shorts a dark of it.
    { name: 'tee', color: '#e8922e', slot: 'player' },
    { name: 'shorts', color: '#808080', on: 2, tone: -26 },
    // A colourway is the trainers (VARIETY.palette), neutrals all: white canvas, grey, black.
    { name: 'shoe', color: '#e4e0d6', alts: ['#9aa0a8', '#4f5359'], vary: 6 },
    { name: 'mic', color: '#5a5e66' },
    { name: 'nose', color: '#4a3428' },
    { name: 'mouth', color: '#9a3d36' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear on the costume, in tones of the player's colour: a faded patch, and soot.
    { name: 'scuff', color: '#808080', on: 2, tone: 12 },
    { name: 'scorch', color: '#808080', on: 2, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
    // The ear's own brown, a neutral: a cream ear sank into the head at play size.
    { name: 'ear', color: '#8a6448' },
    // The mic's ball head, light against its grey handle.
    { name: 'mesh', color: '#c4c8ce' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: {
    role: 'dark',
    from: 'map',
    area: [0.05, 1.4],
    edge: 0.6,
    gap: [0.5, 3],
    band: [0.15, 0.47],
    specks: { dark: 0.9 },
  },
  wear: {
    on: ['tee'],
    chin: 4,
    marks: [[['scuff', 0.42, 0.8, 0.24]], [['scorch', 0.42, 0.8, 0.26]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.6, 0.7] }],
  face: { r: 0.7, iris: '#2a1f1a', eye: 'dot', far: 'turned' },
  gait: { bounce: [0.2, 0.9], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 42 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.9 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.86 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.85 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/rapper/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing and nodding to the beat, his free hand on his hip, leaning back a little, the mic up to his mouth; ${KEEP}.` },
    'walk-1': { pose: `strutting to the right on the beat, mid-step, the near trainer forward and the far trainer back, the mic up to his mouth; ${KEEP}.` },
    'walk-2': {
      pose: `strutting to the right, the legs passing under the body, one trainer planted flat and the other just lifted behind it, his head bobbed down on the beat; ${KEEP}.`,
    },
    'run-1': {
      pose: `running fast to the right, leaning forward, a long stride with one knee high and the other leg pushing off behind, the mic held up to his open mouth, the free arm swinging back; ${KEEP}.`,
    },
    'run-2': {
      pose: `running fast to the right, leaning forward, both trainers off the ground with the knees tucked up under him, the mic held up to his open mouth; ${KEEP}.`,
    },
    'air-1': {
      pose: `jumping up, his knees tucked up under him, the mic arm thrust straight up high over his head with the mic in his fist, the free arm out to the side; ${KEEP}.`,
    },
    'air-2': {
      pose: `falling, the trainers reaching down, the mic arm out forward and the free arm flung out back, his eyes wide and his mouth open in alarm; ${KEEP}.`,
    },
    wall: {
      pose: 'seen from his side, facing right, he slides down a tall wall just to his right (do not draw the wall), his free palm and one trainer sole flat against it, the other leg hanging, the grey microphone still in his other fist, his head turned to look back at us, the tall rounded beanie upright, the big brown ear hanging down behind, both eyes open.',
      far: true,
    },
    // The rap pose: knees bent, leaning in, rapping into the mic, the free arm thrust forward pointing.
    cheer: {
      pose: `a rap pose, knees bent and leaning into it, rapping into the mic held up to his open mouth, his free arm thrust straight forward pointing with one finger; ${KEEP}.`,
    },
    cheer2: {
      pose: `rapping hard, the mic arm thrust straight up high over his head with the mic in his fist, his free arm flung out wide behind him with the hand open, one knee kicked up on the beat, a big open grin; ${KEEP}.`,
    },
    death: {
      pose: 'knocked out, lying flat on his back on the floor, the whole body horizontal, head on the left and trainers on the right, arms and legs limp, eyes shut, the tall beanie still on his head, the grey mic dropped flat on the floor just beside his hand.',
      far: true,
    },
  },
};
