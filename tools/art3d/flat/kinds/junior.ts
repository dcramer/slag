import type { FlatKind } from '../kinds';

// Junior, Sentry's own robot (docs/characters/junior.md): no homage and no twist, so the design is the reference
// redrawn flat (art/sprites/junior/design.prompt.txt) and every pose keeps all of it. Drawn three to a 16:9 image and
// cut apart.
const KEEP =
  'always his square yellow box head with its one huge eye and big toothy grin, the cap on backwards with its long bill out behind, the three steel zigzag antennae with big ball tips standing clear of his head, the big open pincer claw held out clear of his body, the big phone in his other hand, the roller skates with their steel wheels showing';

export const kind: FlatKind = {
  body: 142,
  map: {
    roles: ['hoodie', 'cap', 'skate', 'antenna', 'yellow', 'grey', 'tape', 'white', 'eyewhite', 'dark'],
    // Sampled from the design (art/sprites/junior/design.png, `swatch.py` and by hand): it came back nearly flat.
    families: [
      // The hoodie.
      ['hoodie', [237, 70, 144]],
      ['hoodie', [154, 52, 112]],
      // The cap and the underside of its bill.
      ['cap', [145, 62, 134]],
      ['cap', [143, 60, 131]],
      ['cap', [107, 38, 85]],
      // The roller skates and their wheels.
      ['skate', [103, 55, 104]],
      // The antennae, rods and ball tips, and the skates' wheels: a light steel.
      ['antenna', [163, 166, 183]],
      // The head, the arms, the claw and the ankle bands.
      ['yellow', [250, 178, 18]],
      ['yellow', [248, 182, 34]],
      // The legs, the shoulder and wrist joints, the headphones and the phone.
      ['grey', [78, 68, 92]],
      ['grey', [75, 66, 87]],
      // The tape round the elbow.
      ['tape', [150, 151, 148]],
      // The teeth, the socks and the phone's screen, as drawn and as art/sprites/junior/prep.py tints them so `holes`
      // leaves them.
      ['white', [237, 243, 243]],
      ['white', [224, 230, 230]],
      // The eye's white, tinted apart by prep.py: the face kit paints it over and draws its own eye.
      ['eyewhite', [200, 230, 250]],
      // The ink.
      ['dark', [31, 24, 42]],
      ['dark', [19, 10, 23]],
      ['dark', [56, 29, 47]],
    ],
    line: 'dark',
    thin: ['hoodie', 'cap', 'skate', 'antenna', 'yellow', 'grey', 'tape', 'white', 'eyewhite'],
    fringe: 5,
    stroke: 2.4,
    // A box head: rounded, it traced a ball.
    smooth: 0,
    // The skates and their steel wheels, the lowest thing drawn (the soles are looked for only low down, so the antennae,
    // the same steel, never count).
    feet: ['skate', 'grey', 'antenna'],
    // The background between the legs and inside the arms, cut through the frame.
    holes: 0.8,
    min: { dark: 0.2, tape: 0.3 },
  },
  roles: [
    // The costume: the hoodie in the player's colour, the cap and the skates darks of it.
    { name: 'hoodie', color: '#ee4d9b', slot: 'player' },
    { name: 'cap', color: '#808080', on: 0, tone: -24 },
    { name: 'skate', color: '#808080', on: 0, tone: -36 },
    // The antennae a light steel: in the headphones' grey they joined them, and a reader comparing the sprite with the
    // reference saw dog bones beside the head; in the cap's tone (the reference's purple) they joined the cap in a splat.
    { name: 'antenna', color: '#aaa6b4' },
    // Junior's own yellow is its skin, a neutral like any skin (docs/characters/junior.md → Palette).
    { name: 'yellow', color: '#fab214' },
    // A colourway is the legs, joints and headphones: a purple-grey, a steel or a warm grey. Neutrals only.
    { name: 'grey', color: '#4e445c', alts: ['#454b56', '#55493f'], vary: 6 },
    { name: 'tape', color: '#9a9c98' },
    { name: 'white', color: '#eef3f3' },
    { name: 'eyewhite', color: '#fab214' },
    { name: 'dark', color: '#1f182a' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#d6d8d4' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // One eye: the whole drawn eye, pupil and all, tinted one speck by prep.py and found in the map; it goes, and the pink
  // tongue of the fall's open mouth with it (nothing on a face takes the player's colour). No dark speck is painted over,
  // so the grin under it keeps its ink.
  eyes: { role: 'eyewhite', from: 'map', area: [2, 24], gap: [99, 99], specks: { eyewhite: 24, hoodie: 1 }, count: 1, band: [0.1, 0.55] },
  wear: {
    on: ['hoodie'],
    chin: 4,
    marks: [[['scuff', 0.4, 0.72, 0.24]], [['scorch', 0.6, 0.75, 0.24]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.4, 0.6] }],
  // The one huge eye: a white and a big pupil, as big as the drawing's.
  face: { r: 1.4, iris: '#1f182a', eye: 'round' },
  gait: { bounce: [0, 0.5], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 44, scale: 0.92 },
    // The jump keeps the antennae out to the sides: a first drawing sprang all three straight up, and in black a blind
    // reader saw long ears and paired him with the rapper (docs/characters/junior.md → Rig).
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.9 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Each pose alone, for a redraw; the sheets' prompts are in art/sprites/junior/design.prompt.txt.
  poses: {
    idle2: { pose: `standing, holding the big phone up beside his head to look at it, the claw hanging open at his side, ${KEEP}.` },
    'walk-1': { pose: `skating to the right, gliding on the near skate, the far skate pushing off out behind, ${KEEP}.` },
    'walk-2': { pose: `skating to the right, both skates together under him, gliding, knees a little bent, ${KEEP}.` },
    'run-1': { pose: `skating fast to the right, crouched low and leaning far forward, the far skate kicked out far behind, ${KEEP}.` },
    'run-2': { pose: `skating fast to the right, leaning forward, one skate pushing off out to the side behind and the other gliding ahead, ${KEEP}.` },
    'air-1': { pose: `jumping up, both skates tucked up under him, the antennae standing out to the sides as always, ${KEEP}.` },
    'air-2': { pose: `falling, both skates reaching down and apart, the pincer claw flung out to the side, his eye wide, ${KEEP}.` },
    wall: {
      pose: 'seen from his side, he is sliding down a tall wall that is just to his right (do not draw the wall), both roller skates braced flat against it, knees bent, the pincer claw held out away from the wall, the phone in the other hand, his head turned to look back over his shoulder, his one eye open.',
      far: true,
    },
    cheer: {
      pose: `cheering, the open pincer claw held up out to the side at head height, the big phone held up high in the other hand filming, a huge grin, ${KEEP}.`,
    },
    cheer2: {
      pose: `a happy little hop, both skates off the ground, holding the big phone out at arm's length to take a selfie, the open pincer claw out to the other side, ${KEEP}.`,
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, his box head on the left and his roller skates on the right, arms and legs splayed limp, his eye shut, the cap still on, the phone fallen beside his hand.',
      far: true,
    },
  },
};
