import type { FlatKind } from '../kinds';

// Every pose keeps the three shapes that carry her (art/sprites/tophat/design.prompt.txt): the tin-can top hat as
// tall as the rest of her, standing straight up off her head on its wide flat brim with background above and beside
// it (the read: nobody else in the cast wears one; tipped or pressed to the head it becomes the plumber's cap or a
// wizard's hat); the short cape flaring off her shoulders over a small girl's legs; and the huge paper cocktail
// umbrella held out low at arm's length, clear of her and the hat (raised beside the hat, the two read as one lump).
const KEEP =
  "the tall tin-can top hat always standing straight up off her head, as tall as the rest of her, its wide flat brim level, with white background above it and beside it, the short torn cape flaring off her shoulders, the short ponytail, and the huge open paper cocktail umbrella always held out low at arm's length in front of her, clear of her body and well below the hat's brim, with white background all round it";

export const kind: FlatKind = {
  body: 179,
  map: {
    roles: ['hat', 'band', 'tin', 'hair', 'skin', 'shorts', 'paper', 'white', 'dark'],
    // Sampled from the design (art/sprites/tophat/design.png, `swatch.py` and by hand: the median cut drops the hair).
    families: [
      // The hat and cape, their cel shade and the dent's, folded in.
      ['hat', [153, 60, 125]],
      ['hat', [155, 60, 126]],
      ['hat', [146, 60, 120]],
      ['hat', [142, 54, 116]],
      ['hat', [132, 57, 112]],
      ['hat', [104, 39, 92]],
      ['hat', [103, 46, 75]],
      ['hat', [143, 65, 103]],
      // The hair-tie band and bow, and the cape's lining.
      ['band', [221, 175, 218]],
      ['band', [217, 161, 171]],
      ['band', [193, 150, 190]],
      // The tin's ridged rims and the socks: one grey.
      ['tin', [131, 120, 129]],
      ['tin', [158, 150, 153]],
      ['tin', [193, 179, 185]],
      ['tin', [111, 100, 116]],
      ['tin', [204, 205, 207]],
      // The hair.
      ['hair', [122, 68, 37]],
      ['hair', [89, 41, 19]],
      ['hair', [137, 79, 88]],
      // The skin and its shade.
      ['skin', [251, 196, 155]],
      ['skin', [251, 199, 164]],
      ['skin', [239, 217, 191]],
      ['skin', [220, 140, 113]],
      ['skin', [201, 135, 150]],
      ['skin', [237, 186, 185]],
      // The shorts and boots.
      ['shorts', [78, 66, 73]],
      ['shorts', [74, 69, 76]],
      ['shorts', [86, 76, 83]],
      ['shorts', [57, 46, 57]],
      // The cocktail umbrella's paper and its toothpick.
      ['paper', [243, 230, 195]],
      ['paper', [245, 231, 196]],
      ['paper', [247, 235, 205]],
      ['paper', [239, 200, 158]],
      ['paper', [241, 210, 182]],
      ['paper', [234, 194, 146]],
      ['paper', [228, 186, 138]],
      ['paper', [240, 224, 192]],
      // The eyes' whites and the grin's teeth.
      ['white', [254, 250, 254]],
      // The ink.
      ['dark', [25, 7, 24]],
      ['dark', [45, 20, 41]],
      ['dark', [34, 18, 36]],
      ['dark', [39, 10, 34]],
      ['dark', [56, 30, 48]],
      ['dark', [73, 47, 51]],
    ],
    line: 'dark',
    thin: ['hat', 'band', 'tin', 'hair', 'skin', 'shorts', 'paper', 'white'],
    fringe: 5,
    stroke: 2.4,
    // The background the figure closes in (between the umbrella's ribs, the arm and the cape) cut through.
    holes: 0.8,
    feet: ['shorts'],
    // The umbrella is carried, so the body's size is the girl in her hat, alike in every pose.
    loose: ['paper'],
    min: { dark: 0.3, band: 0.5, tin: 0.4, hair: 0.5, white: 0.2 },
  },
  roles: [
    // The costume: the hat and cape, in the player's colour; the hair tie and the cape's lining a light of it.
    { name: 'hat', color: '#963c8f', slot: 'player' },
    { name: 'band', color: '#808080', on: 0, tone: 30 },
    // A colourway is the tin's rims and the socks (VARIETY.palette), neutrals all: tin, steel blue-grey, brass.
    { name: 'tin', color: '#a09aa0', alts: ['#8c96a0', '#b8a47c'], vary: 6 },
    { name: 'hair', color: '#7a4426' },
    // The face: neutral.
    { name: 'skin', color: '#f8c8a0' },
    { name: 'shorts', color: '#4a4650' },
    { name: 'paper', color: '#f2e6c4' },
    { name: 'white', color: '#fbfaf6' },
    { name: 'dark', color: '#2a1426' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', area: [0.1, 3], gap: [1.4, 2.8], band: [0.4, 0.7], specks: { dark: 4, white: 3 } },
  wear: {
    on: ['hat'],
    chin: 3,
    marks: [[['scuff', 0.35, 0.86, 0.24]], [['scorch', 0.55, 0.88, 0.2]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.4, 0.6] }],
  // The grin: the drawing's teeth go with the face's specks, so the kit draws it, a grin on the cheer, an O on the fall.
  face: { r: 0.85, iris: '#2a1426', eye: 'anime', mouth: [1.1, 1.6] },
  gait: { bounce: [0.2, 0.8], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 24 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 36 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.88 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.9 },
    // The cheer's eyes are drawn shut in a laugh: no face.
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25], eyes: false },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.7 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/tophat/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: {
      pose: `standing with a cheeky grin, her free fist on her hip, swinging the open umbrella low beside her knee like a parasol, her head tilted a little, ${KEEP}.`,
    },
    'walk-1': { pose: `skipping to the right with a bouncy, confident step, mid-step, the near leg forward and the far leg back, ${KEEP}.` },
    'walk-2': { pose: `skipping to the right, the legs passing under her, one boot planted and the other lifted behind, ${KEEP}.` },
    'run-1': {
      pose: `running fast to the right, leaning forward, the near knee raised high in front and the far leg pushing off far behind, the cape flying out behind her, ${KEEP}.`,
    },
    'run-2': {
      pose: `running to the right, mid-stride, both boots off the ground, the legs split wide apart front and back, the cape flying out behind, ${KEEP}.`,
    },
    'air-1': { pose: `jumping up, both knees tucked up under her, the cape flaring out below, her eyes open, ${KEEP}.` },
    'air-2': { pose: `falling, both legs reaching straight down and apart, the cape blown up a little at its hem, her eyes wide, ${KEEP}.` },
    wall: {
      pose: 'seen from her side, facing right: she is clinging to a tall wall on the right edge of her space (do not draw the wall), both boots and her free hand braced flat against it, knees bent, the tall tin-can top hat still standing straight up off her head, the open umbrella held out low away from the wall to the left, her face turned to look back at us, eyes open.',
      far: true,
    },
    cheer: {
      pose: `cheering, up on her toes, the open umbrella thrust forward and up at a slant like a sword, its canopy far out in front of her, clear of the hat, a huge open grin, ${KEEP}.`,
    },
    cheer2: { pose: `a cheeky twirl on one foot, the cape flaring out wide round her, the umbrella held out level, a big grin, ${KEEP}.` },
    death: {
      pose: 'she has been knocked out and lies flat on her back on the floor, the whole body horizontal, her head on the left and her boots on the right, the tall tin-can top hat knocked off and lying on its side on the floor beside her head, the cape spread flat, the open umbrella dropped on the floor beside her, eyes shut.',
      far: true,
    },
  },
};
