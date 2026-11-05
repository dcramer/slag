import type { FlatKind } from '../kinds';

// Athletic, in a tank top and shorts with her two legs apart, the one thick braid swinging out behind her head clear of
// her back, and a chunky toy water pistol in each hand at her thighs (the twist: bright plastic, a round tank on top).
// The braid is the read: nobody else in the cast has a rope of hair, and kept clear of the back it stays a shape of its
// own. Every pose keeps it out behind her. Drawn three to a 16:9 image with the design as the reference and cut apart
// (art/sprites/raider/design.prompt.txt).
const KEEP =
  'her one long thick braid always swinging out behind her head in a big curve, clear of her back with white background between it and her, the white shoelace bow at its end, an orange water pistol in each gloved hand, the satchel at her hip, her two legs apart in shorts';
// The stance and the run: the braid level behind her head, so nothing of it is near her hips (a curl there read as a tail).
const LEVEL =
  'her one long thick braid always streaming straight out behind her head, level with her head and as long as her torso, its tuft and white shoelace bow far out behind her head, nothing behind her back or hips, an orange water pistol in each gloved hand, her two legs apart in shorts';

export const kind: FlatKind = {
  body: 169,
  map: {
    roles: ['top', 'pistol', 'shorts', 'skin', 'hair', 'satchel', 'tape', 'dark'],
    // Sampled from the design (art/sprites/raider/design.png, `swatch.py`).
    families: [
      // The tank top and its cel shade.
      ['top', [52, 129, 135]],
      ['top', [44, 124, 131]],
      ['top', [59, 85, 84]],
      // The water pistols, lit and shaded.
      ['pistol', [218, 115, 51]],
      ['pistol', [198, 100, 54]],
      ['shorts', [99, 68, 44]],
      ['shorts', [82, 53, 35]],
      // The braid and the hair, and the boots, gloves and holsters: one dark brown in the drawing, so one role.
      ['hair', [62, 40, 26]],
      ['hair', [64, 41, 28]],
      ['hair', [65, 43, 29]],
      ['hair', [64, 40, 27]],
      ['hair', [63, 42, 28]],
      ['hair', [57, 42, 32]],
      ['hair', [51, 35, 26]],
      ['hair', [64, 38, 25]],
      ['skin', [226, 162, 111]],
      ['skin', [223, 161, 110]],
      ['skin', [226, 160, 110]],
      ['skin', [221, 158, 110]],
      ['skin', [227, 170, 123]],
      ['skin', [176, 122, 87]],
      ['skin', [170, 100, 69]],
      ['skin', [216, 172, 135]],
      // The satchel, its strap and the knot.
      ['satchel', [172, 146, 103]],
      // The tape round the near pistol's cracked tank.
      ['tape', [146, 146, 146]],
      ['tape', [156, 156, 150]],
      ['tape', [130, 130, 130]],
      ['tape', [170, 170, 170]],
      ['dark', [4, 2, 2]],
      ['dark', [16, 4, 2]],
      ['dark', [11, 12, 11]],
      ['dark', [29, 17, 11]],
    ],
    line: 'dark',
    thin: ['top', 'pistol', 'shorts', 'skin', 'hair', 'satchel', 'tape'],
    fringe: 5,
    stroke: 2.4,
    feet: ['hair'],
    // The pistols are carried, so the body's size is her alone, alike in every pose.
    loose: ['pistol', 'tape'],
    min: { dark: 0.3, tape: 0.4, satchel: 0.4 },
    // The background closed in between an arm and the body, and in the braid's curve.
    holes: 0.8,
  },
  roles: [
    // The costume: the tank top, in the player's colour.
    { name: 'top', color: '#3f9ea6', slot: 'player' },
    // The water pistols: bright plastic, a light of the top.
    { name: 'pistol', color: '#808080', on: 0, tone: 20 },
    { name: 'shorts', color: '#6e5440' },
    { name: 'skin', color: '#e2a87e' },
    { name: 'hair', color: '#4a3226' },
    // A colourway is the satchel (VARIETY.palette): tan canvas, olive or grey, neutrals all.
    { name: 'satchel', color: '#b8a074', alts: ['#8e8a64', '#9a968e'], vary: 6 },
    { name: 'tape', color: '#9a9c98' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', from: 'map', area: [0.1, 2], gap: [0.8, 3.5], specks: { dark: 2.4 }, band: [0, 0.45] },
  wear: {
    on: ['top'],
    chin: 4,
    marks: [[['scuff', 0.5, 0.5, 0.4]], [['scorch', 0.5, 0.55, 0.35]]],
  },
  // Up off the jaw, where a small face's cheek lands.
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.2, 0.5], offset: [0, -0.7] }],
  // Her drawn eyes are small black ovals with no whites: the kit's `dot`. Set 1.3 world px apart, they'd touch any bigger.
  face: { r: 0.65, iris: '#2a1f1a', eye: 'dot' },
  gait: { bounce: [0.2, 0.8], lean: [0, 0.04] },
  clips: {
    // She stands in the aiming stance, a pistol out each side and the braid level behind her head: standing in the
    // design's pose, the braid's curl ended at her hip and read as a monkey's tail in the first blind read.
    idle: { frames: ['stance'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'stance'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28 },
    // A touch smaller: the braid streaming out behind and the pistol out front reach past the box's width.
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 42, scale: 0.96 },
    // Smaller in the air: the pistols held out each side, and the fall's braid flung up over her head, reach past the box.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box', scale: 0.8 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    // Her eyes are squeezed shut in the cheer; smaller, or the pistol punched up reaches past the box's top.
    cheer: { frames: ['cheer'], loop: true, fps: 1, eyes: false, scale: 0.95 },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/raider/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    stance: {
      pose: `standing in a wide stance, legs well apart, both arms stretched straight out level, one forward and one back, each aiming a water pistol, a determined look, her eyes open, her braid streaming straight out behind her head, level with her head, its tuft and bow far out behind it, nothing behind her back or hips.`,
    },
    idle2: {
      pose: `standing with her weight on one hip, one water pistol held up beside her shoulder pointing at the sky, the other fist on her hip, a cocky grin, her eyes open; ${LEVEL}.`,
    },
    'walk-1': {
      pose: `walking briskly to the right, mid-step, the near boot forward and the far boot back, the pistols held low at her thighs, her eyes open; ${KEEP}.`,
    },
    'walk-2': {
      pose: `walking to the right, the legs passing under the body, one boot planted and the other just lifted behind, the pistols low at her thighs, her eyes open; ${KEEP}.`,
    },
    'run-1': {
      pose: `running fast to the right, leaning forward, the near knee raised high in front and the far leg pushing off far behind, the arms pumping, her eyes open; ${LEVEL}.`,
    },
    'run-2': { pose: `running fast to the right, mid-stride, both boots off the ground, the legs split wide apart front and back, her eyes open; ${LEVEL}.` },
    'air-1': {
      pose: `leaping up and forward, both knees tucked up, both arms stretched straight out in front of her aiming the two water pistols forward, clear of her body, her eyes open; ${LEVEL}.`,
    },
    'air-2': {
      pose: `falling, both boots reaching down and apart, both arms out to the sides holding the pistols, the braid flung up and back behind her head, her eyes wide and her mouth open; ${KEEP}.`,
    },
    wall: {
      pose: 'seen from her side, facing right: she is sliding down a tall wall on the right edge of her space (do not draw the wall), one gloved hand flat against it and both boots braced on it, knees bent, the other hand holding a water pistol out to the left, the braid swinging out behind her to the left, her head turned to look back at us, her eyes open.',
      far: true,
    },
    cheer: {
      pose: `cheering, up on her toes, one fist with its water pistol punched up high in the air, the other pistol at her thigh, a big open grin, her eyes open; ${KEEP}.`,
    },
    cheer2: {
      pose: `standing with her weight on one hip, one water pistol held up beside her shoulder pointing at the sky, the other fist on her hip, a cocky grin, her eyes open; ${KEEP}.`,
    },
    death: {
      pose: 'seen from the side: she has been knocked out and lies flat on her back on the floor, the whole body horizontal, her head on the left and her boots on the right, the braid lying out along the floor past her head, arms and legs splayed limp, the pistols dropped beside her, her eyes shut.',
      far: true,
    },
  },
};
