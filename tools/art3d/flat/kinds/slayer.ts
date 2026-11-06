import type { FlatKind } from '../kinds';

// Every pose keeps the outline nobody else in the cast has (art/sprites/slayer/design.prompt.txt): a heavy-set
// swordsman crouched low in a wide fencing guard, the long straight sword held level in both hands with its point
// forward, a straight line out ahead of him as long as he is (the elf carries a poker on his back and stands up, the
// merc's blade is huge and trails); and the two blades on his back crossed in an X, their hilts behind his back
// shoulder clear of his head, which sits forward of the shoulders with his white tail sticking out behind. Side by
// side, the two hilts read as horns standing straight up and as a ninja's headband tails slanting back; crossed,
// as "two sword hilts crossed over the back". Two earlier versions, upright with the hilts over his shoulder, are in
// r1/ and r2/: a princess in a gown, the elf, a ranger, a wizard and a rabbit.
const KEEP =
  'always crouched low with the long notched sword held level in both hands pointing straight forward ahead of him, clear of his legs, the two hilts crossing in an X behind his back shoulder clear of his head, his white hair tail sticking out behind, his eyes open';

export const kind: FlatKind = {
  body: 158,
  map: {
    roles: ['black', 'trousers', 'leather', 'wood', 'steel', 'hair', 'coat', 'skin', 'eye', 'dark'],
    // Sampled from the design (art/sprites/slayer/design.png, sample by region), shades folded in.
    families: [
      // The jacket and its cel shade.
      ['coat', [68, 96, 48]],
      ['coat', [72, 100, 52]],
      ['coat', [90, 110, 79]],
      ['coat', [81, 91, 60]],
      ['coat', [58, 81, 47]],
      ['coat', [46, 61, 41]],
      ['coat', [44, 64, 36]],
      // The trousers, a green-black.
      ['trousers', [40, 48, 40]],
      ['trousers', [38, 51, 39]],
      ['trousers', [25, 33, 31]],
      ['trousers', [20, 28, 28]],
      // The gloves, the boots and the sword's grip: one brown leather.
      ['leather', [100, 62, 34]],
      ['leather', [104, 64, 37]],
      ['leather', [108, 72, 46]],
      ['leather', [64, 36, 24]],
      ['leather', [68, 40, 28]],
      ['leather', [75, 48, 34]],
      ['leather', [55, 36, 27]],
      ['leather', [86, 64, 50]],
      // The umbrella's wooden handle and crossbar.
      ['wood', [156, 108, 64]],
      ['wood', [148, 104, 64]],
      ['wood', [130, 90, 56]],
      ['wood', [176, 128, 72]],
      ['wood', [168, 124, 76]],
      // The umbrella's furled cloth and the soles.
      ['black', [48, 48, 52]],
      ['black', [26, 30, 34]],
      ['black', [50, 47, 41]],
      // The blades, cross-guards, pommels and the bottle cap.
      ['steel', [132, 136, 140]],
      ['steel', [172, 180, 180]],
      ['steel', [125, 135, 128]],
      ['steel', [148, 142, 142]],
      ['steel', [158, 164, 168]],
      ['steel', [196, 204, 206]],
      ['hair', [224, 224, 224]],
      ['hair', [220, 220, 218]],
      ['hair', [232, 232, 232]],
      ['hair', [170, 168, 166]],
      ['skin', [228, 184, 164]],
      ['skin', [213, 188, 175]],
      ['skin', [172, 134, 126]],
      ['skin', [194, 180, 172]],
      ['skin', [161, 127, 113]],
      // The yellow of the cat's eye, a role of its own: the landmark the face kit finds it by.
      ['eye', [228, 186, 60]],
      ['eye', [200, 156, 48]],
      ['dark', [255, 255, 255]],
      ['dark', [3, 1, 0]],
    ],
    line: 'dark',
    thin: ['black', 'trousers', 'leather', 'wood', 'steel', 'hair', 'coat', 'skin'],
    fringe: 5,
    stroke: 2.4,
    ink: 5,
    feet: ['leather', 'black'],
    // The swords and the umbrella's handle are carried: the body's size is the man's, alike in every pose.
    loose: ['steel', 'wood'],
    min: { dark: 0.1, steel: 0.2, leather: 0.2, eye: 0.01 },
    holes: 0.6,
  },
  roles: [
    { name: 'black', color: '#3e3e44' },
    // The trousers a dark of the jacket, far enough under it to stay their own shape below the hem.
    { name: 'trousers', color: '#808080', on: 6, tone: -30 },
    // Leather and wood: neutral browns.
    { name: 'leather', color: '#6a4428' },
    { name: 'wood', color: '#9c6c40' },
    // A colourway is the steel: the blades, the cross-guards and the bottle cap (VARIETY.palette): bright steel, old
    // iron or a blued steel. Neutrals only, and no brass: a brass blade read as the wooden handle.
    { name: 'steel', color: '#b4bac2', alts: ['#8c8e92', '#9aa4b4'], vary: 6 },
    { name: 'hair', color: '#eceae6' },
    // The jacket is the costume, in the player's colour.
    { name: 'coat', color: '#4a6432', slot: 'player' },
    { name: 'skin', color: '#e8bca4' },
    { name: 'eye', color: '#e0c850' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'scuff', color: '#808080', on: 6, tone: 14 },
    { name: 'scorch', color: '#808080', on: 6, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // One eye by its yellow: his head is near side on, and the drawings show the near eye only.
  eyes: {
    role: 'eye',
    from: 'map',
    area: [0.01, 1.4],
    gap: [0.8, 2.6],
    band: [0.1, 0.5],
    edge: 0.6,
    count: 1,
    pair: [1.1, 0],
    // The first run drawing's eye is drawn in the skin's colour, with no yellow to find it by.
    at: { 'run-1': [0.684, 0.268] },
    specks: { eye: 1.6, dark: 0.6 },
  },
  wear: {
    on: ['coat'],
    chin: 3,
    marks: [
      [
        ['scuff', 0.55, 0.45, 0.4],
        ['scuff', 0.35, 0.6, 0.32],
      ],
      [
        ['scorch', 0.55, 0.45, 0.4],
        ['scorch', 0.35, 0.6, 0.32],
      ],
    ],
  },
  // The plaster goes over the scar on his cheek.
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.6, 0.7] }],
  // Cat's eyes: a yellow almond round a slit (`cat` in the face kit's EYES), the far one a sliver behind it.
  face: { r: 0.55, iris: '#e0b830', mark: 0.5, eye: 'cat' },
  gait: { bounce: [0.1, 0.5], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1, centre: 'box' },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4], centre: 'box' },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30, centre: 'box' },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 44, centre: 'box' },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box', scale: 0.88 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.9 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25], centre: 'box' },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3], centre: 'box' },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.85 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/slayer/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: {
      pose: `crouched in his guard, his back hand resting on the bottle cap on his chest, the sword held level forward in his front hand alone; ${KEEP}.`,
    },
    'walk-1': { pose: `prowling to the right in a low crouch, mid-step, the front boot reaching forward and the back boot far back; ${KEEP}.` },
    'walk-2': { pose: `prowling to the right, crouched, the legs passing under him, one boot planted and the other just lifted; ${KEEP}.` },
    'run-1': { pose: `charging to the right, leaning far forward, one knee high and the other leg pushing off far back; ${KEEP}.` },
    'run-2': { pose: `charging to the right, leaning far forward, both boots off the ground, the legs gathered under him; ${KEEP}.` },
    'air-1': { pose: `leaping up, both knees tucked up high under him; ${KEEP}.` },
    'air-2': {
      pose: 'falling, both legs reaching straight down, the long notched sword still held out level in both hands pointing straight forward, clear of his body, his eyes wide and mouth open in alarm, the two hilts crossing in an X behind his back shoulder.',
    },
    wall: {
      pose: 'seen from his side, facing right, he is sliding down a tall wall at the right edge of his space (do not draw the wall), one gloved hand flat against it and both boots braced on it, the long sword held down in his other hand, the two hilts crossed on his back, his head turned to look back at us, his eyes open.',
      far: true,
    },
    cheer: {
      pose: 'cheering with a grim grin, his free fist punched straight forward at shoulder height, never above his head, the sword held level pointing forward in his other hand, the two hilts crossing in an X behind his back shoulder.',
    },
    cheer2: {
      pose: 'standing in a wide stance, the flat of the sword resting on his front shoulder, its blade pointing up and back, his other hand on his hip, a smirk.',
    },
    death: {
      pose: 'knocked out, lying flat on his back on the floor, the whole body horizontal, his head on the left and his boots on the right, arms and legs splayed limp, the sword dropped flat beside him, his eyes shut, seen from the side.',
      far: true,
    },
  },
};
