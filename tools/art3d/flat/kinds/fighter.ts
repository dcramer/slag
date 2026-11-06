import type { FlatKind } from '../kinds';

// Every pose keeps what carries her (art/sprites/fighter/design.prompt.txt): her pose and outfit before her hair. A
// small head on a strong body, the huge round puffed shoulders wider than her head, the short skirt flaring out over
// thick bent thighs in a deep wide fighting stance (or a kick), the spiked dog collars on both wrists; then the two
// sock-covered buns up and out on the head's top corners, both showing. Round buns on a big round head read as a
// bear's ears (art/sprites/fighter/r1/, r2/); snug on the corners of a small one, with ribbons under them, head and
// buns traced as one flat-topped block, a headband (r3/). So the drawings in drawn/ are made ready in flat/ by
// art/sprites/fighter/prep.py: the buns pushed out on a knot of hair, her crown round between them, and the eyes
// repainted apart from the brows they touch (the `eye` role).
const KEEP =
  'always both round white sock-covered hair buns showing on her small head, the huge round puffed shoulders, the short skirt flaring out over her thick thighs, the spiked collars on both wrists';

export const kind: FlatKind = {
  body: 184,
  map: {
    roles: ['dress', 'trim', 'skin', 'hair', 'white', 'collar', 'eye', 'dark'],
    // Sampled from the design (art/sprites/fighter/design.png, `swatch.py` and by hand).
    families: [
      // The dress, its cel shade and highlight.
      ['dress', [67, 108, 172]],
      ['dress', [65, 105, 166]],
      ['dress', [69, 107, 170]],
      ['dress', [89, 119, 167]],
      ['dress', [43, 72, 125]],
      ['dress', [44, 67, 116]],
      ['dress', [48, 79, 135]],
      // The pale piping along the collar, sleeves and hem.
      ['trim', [178, 204, 228]],
      ['trim', [184, 208, 224]],
      ['trim', [168, 200, 224]],
      // Skin and its shade.
      ['skin', [249, 199, 158]],
      ['skin', [250, 204, 165]],
      ['skin', [239, 199, 165]],
      ['skin', [190, 122, 108]],
      ['skin', [186, 143, 134]],
      ['skin', [218, 192, 173]],
      // The hair.
      ['hair', [52, 37, 34]],
      ['hair', [60, 42, 36]],
      ['hair', [36, 24, 18]],
      // The socks over the buns and their ribbons, the dressing-gown cord, the boots and the collars' spikes, and
      // their shade.
      ['white', [250, 250, 250]],
      ['white', [240, 240, 240]],
      ['white', [206, 208, 211]],
      ['white', [163, 178, 196]],
      // The dog collars.
      ['collar', [36, 36, 44]],
      ['collar', [70, 66, 76]],
      ['collar', [85, 86, 104]],
      // Her eyes, painted apart from the brows they touch (art/sprites/fighter/eyes.py).
      ['eye', [96, 16, 72]],
      // The ink.
      ['dark', [21, 6, 6]],
      ['dark', [8, 3, 9]],
      ['dark', [25, 17, 24]],
    ],
    line: 'dark',
    thin: ['dress', 'trim', 'skin', 'hair', 'white', 'collar'],
    fringe: 5,
    stroke: 2.4,
    // The notch between each bun and her crown is the read: rounded, it closed.
    smooth: 0,
    feet: ['white'],
    // The eyes are found in the map and never traced (`eye` folds into the skin): traced, each was a few pixels,
    // and painting one over as a speck took the skin round it for its colour and flooded her face away.
    min: { dark: 0.4, trim: 0.3, eye: 5 },
  },
  roles: [
    // The costume: the dress in the player's colour, its piping a light of it.
    { name: 'dress', color: '#4370ac', slot: 'player' },
    { name: 'trim', color: '#808080', on: 0, tone: 34 },
    { name: 'skin', color: '#f8c69e' },
    { name: 'hair', color: '#3a2a20' },
    // A colourway is the socks, cord and boots (VARIETY.palette): white, a cream or a pale grey. Neutrals only.
    { name: 'white', color: '#f4f2ee', alts: ['#ece0c4', '#d8d8dc'], vary: 6 },
    { name: 'collar', color: '#34323c' },
    { name: 'eye', color: '#24141a' },
    { name: 'dark', color: '#24141a' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // Her eyes are a few map pixels across, smoothed away by the tracer: found in the map (the engineer's).
  eyes: { role: 'eye', from: 'map', area: [0.1, 1.5], gap: [0.8, 3], band: [0.05, 0.35], edge: 0.2, specks: { eye: 2, dark: 1.5 } },
  wear: {
    on: ['dress'],
    chin: 6,
    marks: [[['scuff', 0.35, 0.55, 0.28]], [['scorch', 0.6, 0.6, 0.26]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.2, 0.5] }],
  // Her drawing's eyes are small black ovals, no white: the kit's `dot`, small, and the far one turned, or the two
  // close together read as sunglasses.
  face: { r: 0.5, iris: '#24141a', eye: 'dot', far: 'turned' },
  gait: { bounce: [0.3, 0.8], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28 },
    // Smaller on the run: the split legs reach past the box's sides.
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40, scale: 0.92 },
    // Smaller in the air: the flying kick's leg reaches past the box's side.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.78 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.9 },
    // The high kick, one boot straight up over her head.
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.6, 0.3] },
    // Her eyes are squeezed shut in the grin.
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.5, 0.25], eyes: false },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.8 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/fighter/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `a deep wide fighting stance, knees bent far apart, the back fist forward in guard and the front fist at her hip, ${KEEP}.` },
    'walk-1': { pose: `walking to the right in a low wide crouch, the near boot stepping forward, fists up in guard, ${KEEP}.` },
    'walk-2': { pose: `walking to the right, the legs passing under her, one boot planted and the other lifted behind, ${KEEP}.` },
    'run-1': {
      pose: `running low and fast to the right, leaning forward, the near knee raised high in front and the far leg pushing off far behind, fists pumping, ${KEEP}.`,
    },
    'run-2': { pose: `running to the right mid-stride, both boots off the ground, the legs split wide front and back, ${KEEP}.` },
    'air-1': {
      pose: `a flying kick in the air, her front leg kicked straight out forward level at hip height, the other knee tucked up under her, fists up, ${KEEP}.`,
    },
    'air-2': { pose: `falling, both boots reaching down and apart, both arms out to the sides for balance, eyes wide, ${KEEP}.` },
    wall: {
      pose: 'seen from her side: she is sliding down a tall wall that is just to her right (do not draw the wall), one palm and both white boots braced flat against it, knees bent, her other fist out, her head turned to look back at us, eyes open.',
      far: true,
    },
    cheer: {
      pose: `a high kick, standing on one bent leg, the other leg kicked straight up beside her head, the boot pointing at the sky, her arms out in guard, ${KEEP}.`,
    },
    cheer2: { pose: `a victory pose, standing tall, one fist on her hip and the other making a peace sign beside her cheek, a big grin, ${KEEP}.` },
    death: {
      pose: 'she has been knocked out and lies flat on her back on the floor, the whole body horizontal, her head on the left and her boots on the right, arms and legs splayed limp, her eyes shut. Seen from the side.',
      far: true,
    },
  },
};
