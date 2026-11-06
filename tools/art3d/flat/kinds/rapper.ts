import type { FlatKind } from '../kinds';

// Redrawn 2026-11-05 (round 8) as a dog's head side on: seven rounds of a chubby puppy under the beanie read as a
// gnome, a mouse, a monkey, a plumber, a princess or a "thin figure with a tuft". The new idea is the head: a big
// head on a skinny body, a long snout jutting far forward from the lower half of the face with a big round nose on
// its tip, the jaw dropped open rapping (the mouth cut through, so the muzzle reads as an upper snout and a jaw), the
// short floppy ear hanging straight down behind the head (long and flying up or back, beside the beanie it read as a
// rabbit's two ears), the tall thumb of a beanie straight up with no brim and no pompom, and the cordless mic held out
// in his fist below the snout. He is still a card standee come loose: the card's brown edge round his outline and torn
// bites out of his shorts. Every pose keeps those shapes (KEEP); the sheets' prompts are in
// art/sprites/rapper/design.prompt.txt.
const KEEP =
  'in every one the tall orange thumb beanie standing straight up, the long snout with the big round nose out in front, the short floppy ear hanging limp straight down behind his head, never flying up or back, the black mic in his fist held out in front clear of his face, both eyes open';

export const kind: FlatKind = {
  body: 173,
  map: {
    roles: ['card', 'fur', 'tee', 'shorts', 'shoe', 'mic', 'nose', 'mouth', 'dark'],
    // Sampled from the design (art/sprites/rapper/design.png, `swatch.py`).
    families: [
      // The card's edge round his outline and the rough card in the torn bites.
      ['card', [174, 127, 77]],
      ['card', [191, 134, 72]],
      ['card', [160, 120, 88]],
      ['card', [150, 110, 75]],
      ['card', [175, 158, 136]],
      // The fur, and the fold crease drawn across it.
      ['fur', [238, 204, 139]],
      ['fur', [244, 209, 145]],
      ['fur', [244, 218, 167]],
      ['fur', [233, 203, 143]],
      ['fur', [208, 188, 150]],
      // The beanie and the tee: one orange in the drawing, so one role, the player's colour.
      ['tee', [230, 127, 21]],
      ['tee', [229, 122, 16]],
      ['tee', [222, 127, 35]],
      ['tee', [240, 150, 60]],
      ['shorts', [198, 65, 0]],
      ['shorts', [185, 62, 2]],
      ['shorts', [188, 93, 30]],
      ['shoe', [146, 143, 141]],
      ['shoe', [141, 140, 135]],
      ['shoe', [120, 120, 122]],
      ['shoe', [170, 170, 172]],
      ['mic', [41, 40, 37]],
      ['mic', [62, 62, 64]],
      ['mic', [90, 90, 95]],
      ['nose', [59, 44, 34]],
      ['nose', [52, 30, 20]],
      ['nose', [100, 80, 65]],
      ['nose', [124, 78, 62]],
      // The tongue in the open mouth.
      ['mouth', [127, 31, 45]],
      ['mouth', [160, 60, 70]],
      ['dark', [0, 0, 0]],
      ['dark', [13, 0, 0]],
      ['dark', [15, 8, 4]],
    ],
    line: 'dark',
    thin: ['card', 'fur', 'tee', 'shorts', 'shoe', 'mic', 'nose', 'mouth'],
    fringe: 5,
    stroke: 2.4,
    ink: 15,
    // The white between the mic arm and the body, between the legs, and between the ear and his back, cut through.
    holes: 0.25,
    // The open mouth, a dark wedge under the snout, is cut through: filled, the snout and jaw were one lump.
    cut: { role: 'dark', area: 1.2 },
    feet: ['shoe'],
    // The mic is carried, so the body's size is the puppy's whatever his arm does.
    loose: ['mic'],
    min: { dark: 0.05, mouth: 0.2, nose: 0.3, card: 0.15, mic: 0.5 },
  },
  roles: [
    { name: 'card', color: '#b8946a' },
    { name: 'fur', color: '#f1dfb8' },
    // The beanie and the tee are the costume, in the player's colour; the shorts a dark of it.
    { name: 'tee', color: '#e8922e', slot: 'player' },
    { name: 'shorts', color: '#808080', on: 2, tone: -26 },
    // A colourway is the trainers (VARIETY.palette), neutrals all: grey, white canvas, black.
    { name: 'shoe', color: '#9aa0a8', alts: ['#d8d4cc', '#4f5359'], vary: 6 },
    { name: 'mic', color: '#5a5e66' },
    { name: 'nose', color: '#4a3428' },
    { name: 'mouth', color: '#9a3d36' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear on the costume, in tones of the player's colour: a faded patch, and soot.
    { name: 'scuff', color: '#808080', on: 2, tone: 12 },
    { name: 'scorch', color: '#808080', on: 2, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: {
    role: 'dark',
    from: 'map',
    area: [0.05, 0.9],
    gap: [0.5, 3],
    band: [0.15, 0.42],
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
    idle2: { pose: `standing, nodding to the beat, his free hand on his hip, leaning back a little; ${KEEP}.` },
    'walk-1': { pose: `strutting to the right mid-step, the near trainer forward and the far trainer back; ${KEEP}.` },
    'walk-2': { pose: `strutting, one trainer planted and the other lifted behind, his head bobbed down on the beat; ${KEEP}.` },
    'run-1': {
      pose: `running fast to the right, leaning forward, a long stride, one knee high and the other leg pushing off behind; ${KEEP}.`,
    },
    'run-2': { pose: `running fast, both trainers off the ground, the knees tucked under him; ${KEEP}.` },
    'air-1': { pose: `jumping up, his knees tucked, the mic arm thrust forward level, the free arm out behind; ${KEEP}.` },
    'air-2': {
      pose: `falling, the trainers reaching down, the mic arm out forward and the free arm out back, eyes wide and mouth open in alarm; ${KEEP}.`,
    },
    wall: {
      pose: 'seen from his side, facing right, he slides down a tall wall just to his right (do not draw the wall), his free palm and one trainer sole flat against it, the other leg hanging, the black mic still in his other fist, his head turned to look back at us, the tall thumb beanie upright, the short ear hanging down behind, both eyes open.',
      far: true,
    },
    cheer: { pose: `cheering, up on his toes, the mic arm thrust straight up high in his fist, the free arm out to the side, a big open grin; ${KEEP}.` },
    cheer2: { pose: `rapping hard, the mic held out in front of his snout, leaning back, the free arm flung out behind, one knee kicked up; ${KEEP}.` },
    death: {
      pose: 'knocked out, lying flat on his back on the floor, the whole body horizontal, head on the left and trainers on the right, arms and legs limp, eyes shut, the tall beanie still on his head, the black mic dropped flat beside his hand.',
      far: true,
    },
  },
};
