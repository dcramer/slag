import type { FlatKind } from '../kinds';

// Every pose keeps what carries him (art/sprites/bomber/design.prompt.txt): the huge round white bucket helmet with
// the spring and its orange ball standing up off the crown (the one bump on the outline, his alone); the dark face
// slot; the bowling ball held low ahead at the hip with background round it (out level at shoulder height, a round
// helmet over a held-out arm on big boots is the robot boy's outline; against the body it is lost in it).
const KEEP =
  'always the huge round white paint-bucket helmet the same size as in the reference, the coiled spring with the orange ping-pong ball standing straight up from its crown, the dark face slot with two white oval eyes, the blue paint drips and the crack on the helmet, the charcoal bowling ball with its lit shoelace fuse held in his front mitt low ahead of him at hip height, clear of his body with white background round it, the blue suit with its dark belt, the big pale grey mitts and boots';

export const kind: FlatKind = {
  body: 193,
  map: {
    roles: ['white', 'suit', 'belt', 'grey', 'steel', 'slot', 'ball', 'orange', 'spark', 'eye', 'dark'],
    // Sampled from the design (art/sprites/bomber/design.png, `swatch.py` and by hand).
    families: [
      // The bucket, its cel shade, the shoelace fuse.
      ['white', [236, 236, 222]],
      ['white', [234, 235, 221]],
      ['white', [232, 233, 222]],
      ['white', [222, 221, 202]],
      ['white', [184, 183, 166]],
      ['white', [193, 194, 184]],
      // The suit and its shade, and the paint drips down the bucket, his own paint.
      ['suit', [68, 119, 198]],
      ['suit', [71, 121, 197]],
      ['suit', [48, 91, 159]],
      ['suit', [53, 103, 176]],
      ['suit', [64, 96, 148]],
      ['belt', [30, 49, 89]],
      ['belt', [45, 50, 66]],
      // The mitts and boots, and their shade.
      ['grey', [203, 204, 196]],
      ['grey', [145, 149, 144]],
      // The spring, the bucket's handle and the crack's chipped edge.
      ['steel', [142, 144, 131]],
      ['steel', [154, 159, 153]],
      ['steel', [101, 102, 88]],
      ['steel', [96, 90, 91]],
      ['slot', [52, 53, 58]],
      ['slot', [49, 52, 60]],
      ['slot', [36, 38, 43]],
      ['ball', [68, 69, 73]],
      ['ball', [68, 73, 85]],
      ['orange', [244, 138, 60]],
      ['orange', [220, 150, 86]],
      ['spark', [249, 226, 58]],
      ['eye', [247, 248, 243]],
      ['dark', [9, 10, 10]],
      ['dark', [2, 4, 6]],
    ],
    line: 'dark',
    thin: ['white', 'suit', 'belt', 'grey', 'steel', 'slot', 'ball', 'orange', 'spark', 'eye'],
    fringe: 5,
    stroke: 2.4,
    feet: ['grey'],
    min: { dark: 0.4, steel: 0.3, spark: 0.2, belt: 0.3 },
  },
  roles: [
    // The bucket stays white in every look: it is the read. A cream one on an orange suit read as a bare head.
    { name: 'white', color: '#f2f0e6' },
    // The costume: the suit and the paint dripped down the bucket in the player's colour, the belt a dark of it.
    { name: 'suit', color: '#3a6fd0', slot: 'player' },
    { name: 'belt', color: '#808080', on: 1, tone: -30 },
    // A colourway is the mitts and boots together (VARIETY.palette): a pale grey rubber, a tan suede, a steel grey.
    { name: 'grey', color: '#cfcdc8', alts: ['#dcc9a6', '#b3b7bd'], vary: 6 },
    { name: 'steel', color: '#9a9e98' },
    { name: 'slot', color: '#33343b' },
    // The bowling ball: a charcoal lighter than the ink and the slot, so it stays a ball on a dark theme.
    { name: 'ball', color: '#4c4e58' },
    // The ping-pong ball: a fixed warm mark, like a blush.
    { name: 'orange', color: '#f08a3c' },
    { name: 'spark', color: '#f8d848' },
    { name: 'eye', color: '#f6f4ec' },
    { name: 'dark', color: '#1c1c22' },
    // The wear is on the suit: tones of it.
    { name: 'scuff', color: '#808080', on: 1, tone: 14 },
    { name: 'scorch', color: '#808080', on: 1, tone: -34 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'eye', from: 'map', area: [0.1, 4], gap: [0.8, 4], band: [0.1, 0.6], edge: 0.2, specks: { eye: 4 } },
  wear: {
    on: ['suit'],
    chin: 5,
    marks: [[['scuff', 0.35, 0.4, 0.25]], [['scorch', 0.6, 0.45, 0.25]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'crown', size: [1.6, 0.5] }],
  // The drawing's eyes are white ovals in a dark slot, no pupil: the kit's `glow`, in white, whose marks are lit.
  face: { r: 0.7, iris: '#f6f4ec', eye: 'glow' },
  gait: { bounce: [0.4, 0.9], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 20 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 30 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200] },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.9 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.6, 0.3] },
    // Arms out wide, his eyes squeezed into happy arcs: drawn white, the drawing keeps them.
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.7, 0.3], eyes: false },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.8 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/bomber/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: { pose: `standing, tossing the bowling ball a little way up out of his front mitt, the free mitt on his hip, ${KEEP}.` },
    'walk-1': { pose: `trotting to the right in quick bouncy steps, the near boot stepping forward, ${KEEP}.` },
    'walk-2': { pose: `trotting to the right, the legs passing under him, one boot planted and the other lifted behind, ${KEEP}.` },
    'run-1': { pose: `running fast to the right, leaning forward, the near knee raised in front and the far leg pushing off behind, ${KEEP}.` },
    'run-2': { pose: `running to the right mid-stride, both boots off the ground, the legs wide apart front and back, ${KEEP}.` },
    'air-1': { pose: `jumping straight up, both boots tucked up under him, the free mitt flung out to the side, ${KEEP}.` },
    'air-2': { pose: `falling, both boots reaching down and apart, the free mitt thrown up beside the helmet, ${KEEP}.` },
    wall: {
      pose: 'seen from his side, facing right: he is sliding down a tall wall on the right edge of his space (do not draw the wall), both boots and his free mitt braced flat against it, knees bent, the huge round white bucket helmet with its spring and orange ball on his head, the bowling ball held out away from the wall to the left, his face slot turned to look back at us.',
      far: true,
    },
    cheer: { pose: `cheering, a happy hop with both boots kicked up behind him, the free mitt punched up beside the helmet, ${KEEP}.` },
    cheer2: {
      pose: `cheering, the bowling ball set on the floor in front of his boots with its fuse fizzing, both mitts thrown out wide to the sides, ${KEEP}.`,
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, his helmet on the left and his boots on the right, arms and legs splayed limp, the white bucket helmet with its spring and orange ball still on his head, the bowling ball dropped on the floor beside him, its fuse out. Seen from the side.',
      far: true,
    },
  },
};
