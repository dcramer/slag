import type { FlatKind } from '../kinds';

// Every pose keeps the shapes that carry him (art/sprites/bear/design.prompt.txt): the tiny black top hat upright on
// top of his head with background between it and each round ear (the read: hat and ears touching trace as one
// crown); the shower head held up in front of his mouth like a microphone, clear of his face, its hose hanging short
// (coiled by the feet, a cord reads as a tail); the big round belly with the coin jammed in its slot and the stiff
// jointed limbs, so he is an upright stiff toy, never the ape's hunch.
const KEEP =
  'the tiny black top hat always upright on top of his head with white gaps between it and both round ears, the shower head on its short hose always held up in front of his mouth like a microphone, clear of his face with white background round it, the big round tan belly with the coin, the stiff jointed limbs';

export const kind: FlatKind = {
  body: 173,
  map: {
    roles: ['fur', 'belly', 'tear', 'hat', 'metal', 'glow', 'dark'],
    // Sampled from the design (art/sprites/bear/design.png, `swatch.py` and by hand).
    families: [
      // The fur, its cel shade and the eyes' warm halo, folded in.
      ['fur', [166, 95, 35]],
      ['fur', [164, 94, 33]],
      ['fur', [169, 96, 37]],
      ['fur', [101, 49, 35]],
      ['fur', [101, 46, 30]],
      ['fur', [128, 68, 37]],
      ['fur', [151, 95, 51]],
      ['fur', [169, 111, 62]],
      ['fur', [183, 127, 66]],
      ['fur', [94, 56, 46]],
      // The belly, the muzzle and the ears' insides.
      ['belly', [244, 197, 128]],
      ['belly', [242, 211, 153]],
      ['belly', [240, 203, 150]],
      ['belly', [241, 197, 130]],
      // The torn fur's dark inside at the joints.
      ['tear', [71, 35, 24]],
      ['tear', [62, 32, 20]],
      ['tear', [76, 37, 27]],
      // The top hat and the bow tie.
      ['hat', [21, 20, 24]],
      ['hat', [22, 20, 25]],
      // The shower head, its hose, the coin and the metal at the torn joints.
      ['metal', [166, 165, 162]],
      ['metal', [152, 156, 158]],
      ['metal', [120, 119, 118]],
      ['metal', [98, 102, 113]],
      ['metal', [57, 58, 63]],
      // The glowing eyes.
      ['glow', [252, 251, 189]],
      ['glow', [254, 254, 195]],
      // The ink and the nose.
      ['dark', [12, 1, 1]],
      ['dark', [36, 10, 7]],
      ['dark', [13, 8, 8]],
      ['dark', [50, 24, 12]],
    ],
    line: 'dark',
    thin: ['fur', 'belly', 'tear', 'hat', 'metal', 'glow'],
    fringe: 5,
    stroke: 2.4,
    // The notches between the hat and the ears are the read: rounded, they close.
    smooth: 0,
    // The background closed in by the hose and the arm cut through.
    holes: 0.8,
    // Knocked out, the hat and the shower head lie on the floor beside him.
    feet: ['fur', 'metal', 'hat'],
    min: { dark: 0.3, tear: 0.4, metal: 0.3, hat: 0.3, belly: 0.4 },
  },
  roles: [
    // The costume: the fur suit in the player's colour, the belly, muzzle and ears' insides a light of it.
    { name: 'fur', color: '#a05c26', slot: 'player' },
    { name: 'belly', color: '#808080', on: 0, tone: 34 },
    // The torn fur's inside, a dark of it round the metal: drawn in the ink, the tears were black blotches.
    { name: 'tear', color: '#808080', on: 0, tone: -30 },
    // The hat and bow tie: a charcoal, light enough to stay a shape on a dark theme (black, the hat sank into the
    // mine's dark). A colourway is the metal (VARIETY.palette): steel, chrome, gunmetal.
    { name: 'hat', color: '#4a4652' },
    { name: 'metal', color: '#a4a6a8', alts: ['#c8ccd0', '#7c828a'], vary: 6 },
    // The eyes' glow: a face mark, so neutral; the kit draws its own over it.
    { name: 'glow', color: '#f6f2b8' },
    { name: 'dark', color: '#1e1614' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'glow', from: 'map', area: [0.15, 4], gap: [1, 4], band: [0.1, 0.4], specks: { glow: 4, dark: 1.5, tear: 1 } },
  wear: {
    on: ['fur'],
    chin: 6,
    marks: [[['scuff', 0.3, 0.78, 0.26]], [['scorch', 0.62, 0.86, 0.24]]],
  },
  // On the cheek: on the crown it lands on the hat, and the hat stops reading as a top hat.
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.2, 0.5] }],
  // The drawing's eyes are lit bulbs with no pupil: the kit's `bulb`, inked in its socket so it stays a shape on a
  // light fur, where the mage's `glow` sank.
  face: { r: 0.62, iris: '#f6f2b8', eye: 'bulb' },
  gait: { bounce: [0.1, 0.5], lean: [0, 0.02] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 22 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 34 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.9 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.9 },
    // Singing into the shower head, his eyes squeezed shut.
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.6, 0.3], eyes: false },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.5, 0.25] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.7 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/bear/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing stiffly, his head snapped round to stare straight at us, the free arm hanging straight down, ${KEEP}.` },
    'walk-1': { pose: `walking stiffly to the right like a robot, mid-step, the near leg stepping forward with its knee straight, ${KEEP}.` },
    'walk-2': { pose: `walking stiffly to the right, the legs passing under him, one foot planted and the other lifted behind, his body upright, ${KEEP}.` },
    'run-1': {
      pose: `running fast to the right with stiff strides, leaning forward, the near knee raised in front and the far leg pushing off behind, the free arm held straight back, ${KEEP}.`,
    },
    'run-2': { pose: `running to the right, mid-stride, both feet off the ground, the legs wide apart front and back, ${KEEP}.` },
    'air-1': { pose: `jumping up in a stiff hop, both legs straight together under him, the free arm straight down at his side, ${KEEP}.` },
    'air-2': { pose: `falling, both legs reaching down stiffly and apart, the free arm thrown out straight to the side, eyes wide, ${KEEP}.` },
    wall: {
      pose: 'seen from his side, facing right: he is clinging to a tall wall on the right edge of his space (do not draw the wall), both feet and his free hand braced flat against it, knees bent, the tiny black top hat upright on his head with white gaps between it and his round ears, the shower head held out away from the wall to the left, his face turned to look back at us, eyes open.',
      far: true,
    },
    cheer: { pose: `singing loudly into the shower head, leaning back, his free arm flung straight out level to the side, ${KEEP}.` },
    cheer2: { pose: `a stiff little dance step, one leg kicked out to the side, the free arm held out level, ${KEEP}.` },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, his head on the left and his feet on the right, arms and legs splayed out stiff, the tiny top hat knocked off and lying on its side on the floor beside his head, the shower head dropped on the floor beside him.',
      far: true,
    },
  },
};
