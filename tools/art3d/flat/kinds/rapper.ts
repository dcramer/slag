import type { FlatKind } from '../kinds';

// Drawn side on, a chubby puppy under a tall thumb of a beanie, the mic held out in front of him at arm's length. In
// the three-quarter view his beanie, head, ears and mic made one tall pill in silhouette (read as the worm or a
// monkey); a brimmed beanie leaning back read as a wizard's hat; a snout level with the band read as a cap's bill
// (the plumber); and the mic's coiled cord, hanging below his arm, read as a monkey's curly tail. So every pose keeps
// the beanie standing straight up, round on top; the snout and its round nose low on his face; the long ear hanging
// behind his head; and a cordless mic held out clear of his face. The poses were drawn three to a 16:9 image with the
// design as the reference and cut apart (art/sprites/rapper/design.prompt.txt).
const KEEP =
  'the tall rounded orange beanie always standing up on his head, the snout with its round nose always out in front, the long floppy ear always hanging behind his head, the black cordless microphone always held out in front of him in his fist, clear of his face, both eyes open';

export const kind: FlatKind = {
  body: 187,
  map: {
    roles: ['card', 'fur', 'tee', 'shorts', 'shoe', 'mic', 'nose', 'mouth', 'dark'],
    // Sampled from the design (art/sprites/rapper/design.png, `swatch.py`).
    families: [
      // The card's edge down his back and the rough card in the torn bite.
      ['card', [152, 112, 80]],
      ['card', [160, 120, 88]],
      ['card', [144, 104, 72]],
      ['card', [156, 97, 61]],
      ['card', [151, 98, 64]],
      ['card', [166, 121, 74]],
      ['card', [172, 138, 106]],
      ['card', [179, 126, 68]],
      // The fur, its cel shade under the beanie's band, and the trainers' pale soles.
      ['fur', [245, 219, 161]],
      ['fur', [244, 225, 177]],
      ['fur', [237, 216, 166]],
      ['fur', [202, 159, 112]],
      ['fur', [204, 168, 127]],
      ['fur', [240, 210, 148]],
      // The beanie and the tee: one orange in the drawing, so one role, the player's colour.
      ['tee', [233, 131, 24]],
      ['tee', [228, 130, 27]],
      ['tee', [197, 92, 24]],
      ['tee', [204, 133, 59]],
      ['tee', [198, 78, 6]],
      ['tee', [207, 93, 17]],
      ['tee', [216, 140, 59]],
      ['tee', [228, 123, 11]],
      ['tee', [201, 75, 7]],
      ['tee', [192, 90, 23]],
      ['shorts', [150, 60, 0]],
      ['shorts', [152, 58, 1]],
      ['shorts', [147, 56, 3]],
      ['shorts', [177, 61, 3]],
      ['shorts', [140, 58, 6]],
      ['shorts', [114, 30, 0]],
      ['shoe', [136, 138, 141]],
      ['shoe', [123, 106, 94]],
      ['shoe', [134, 126, 118]],
      ['mic', [96, 96, 102]],
      ['mic', [94, 88, 89]],
      // The design's mic is a near-black, a little warmer and lighter than the ink.
      ['mic', [39, 35, 33]],
      ['mic', [70, 70, 78]],
      ['nose', [66, 44, 31]],
      ['nose', [72, 47, 32]],
      ['nose', [89, 38, 18]],
      ['nose', [94, 71, 57]],
      ['nose', [111, 74, 52]],
      // The open mouth's pink, kept clear of the shorts' shade.
      ['mouth', [216, 96, 88]],
      ['mouth', [190, 70, 70]],
      ['dark', [0, 0, 0]],
      ['dark', [18, 6, 4]],
      ['dark', [35, 4, 2]],
      // The eyes: a dark brown with a glint.
      ['dark', [48, 16, 16]],
    ],
    line: 'dark',
    thin: ['card', 'fur', 'tee', 'shorts', 'shoe', 'mic', 'nose', 'mouth'],
    fringe: 5,
    stroke: 2.4,
    // The side-on drawings' outline is a thick black, up to 14 image px: at the default 9 its thick runs stayed dark
    // fills, a speckled outline.
    ink: 15,
    // The white between the mic arm and the body, and between the legs, cut through.
    holes: 0.25,
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
  // The drawn eyes are dark ovals with a glint, narrower than the thick outline's ink, so they are kept as lone round
  // specks (`glint`) and found in the role map. Side on, the far eye is often hard against the beanie's band or lost
  // in the outline, so the near one is the biggest speck and the far one is set from it.
  eyes: {
    role: 'dark',
    from: 'map',
    glint: 0.25,
    area: [0.05, 0.9],
    gap: [0.8, 3],
    band: [0.2, 0.55],
    count: 1,
    pair: [1.4, -0.15],
    specks: { dark: 0.6, nose: 0.2 },
  },
  wear: {
    on: ['tee'],
    chin: 4,
    marks: [[['scuff', 0.42, 0.8, 0.24]], [['scorch', 0.42, 0.8, 0.26]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.6, 0.7] }],
  face: { r: 0.6, iris: '#2a1f1a' },
  gait: { bounce: [0.2, 0.9], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 42 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.94 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.86 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.85 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/rapper/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing and nodding to the beat, his free hand on his hip, leaning back a little, pleased with himself; ${KEEP}.` },
    'walk-1': { pose: `strutting to the right on the beat, mid-step, the near trainer forward and the far trainer back, his free arm swinging; ${KEEP}.` },
    'walk-2': {
      pose: `strutting to the right, the legs passing under the body, one trainer planted flat and the other just lifted behind it, his head bobbed down on the beat; ${KEEP}.`,
    },
    'run-1': {
      pose: `running fast to the right, leaning forward, a long stride with one knee high and the other leg pushing off behind, the mic held out forward, the free arm pumping, the ear flying back; ${KEEP}.`,
    },
    'run-2': {
      pose: `running fast to the right, leaning forward, both trainers off the ground with the knees tucked up under him, the mic held out forward; ${KEEP}.`,
    },
    'air-1': { pose: `jumping up, his knees tucked up under him, the mic hand thrust up high over his head, the free arm out; ${KEEP}.` },
    'air-2': {
      pose: `falling, the trainers reaching down, both arms flung up and out, the mic still in his hand, his eyes wide and his mouth open in alarm; ${KEEP}.`,
    },
    wall: {
      pose: 'seen from his side, facing right, he is sliding down a tall wall that is just to his right (do not draw the wall), his free palm and one trainer sole flat against it, the other leg hanging, the black cordless mic still in his other fist, his head turned to look back at us, both eyes open.',
      far: true,
    },
    cheer: { pose: `cheering, up on his toes, both arms thrown high over his head, the mic held high in one fist, a big open grin; ${KEEP}.` },
    cheer2: {
      pose: `rapping hard, the mic held out in front of his snout, leaning back, his free arm thrown out wide behind him with the hand open, one knee kicked up on the beat, a big grin; ${KEEP}.`,
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, head on the left and trainers on the right, arms and legs splayed limp, eyes shut, the tall beanie still on his head, the black cordless mic dropped flat on the floor just beside his hand. Seen from the side.',
      far: true,
    },
  },
};
