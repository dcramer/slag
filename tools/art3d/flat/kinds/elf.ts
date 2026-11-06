import type { FlatKind } from '../kinds';

// Every pose keeps what the colour read needs, whatever the player's colour: the cap on its band with a point,
// never a hanging tail (in blue the old sock cap read as a tentacle ponytail), the ear clear of it, and the lid
// and the sword held out clear of the body (the bent poker read as a hook, the lid on his back as nothing).
const KEEP =
  'the pointed cap on its ribbed band always running back from his crown and flopping down to its darned point behind his head, his long pointed ear sticking out backwards clear of it, the round dustbin lid always held out on his far arm on the left of the picture, well clear of his body, and the straight dark poker always in his near glove like a sword, clear of his body, never across his chest';

export const kind: FlatKind = {
  body: 152,
  map: {
    roles: ['green', 'darn', 'skin', 'hair', 'brown', 'lid', 'iron', 'dark', 'rim'],
    // Sampled from the design (2026-11-06: the pointed cap on its ribbed band, the lid held out, the straight poker).
    families: [
      ['green', [75, 121, 54]],
      ['green', [66, 114, 50]],
      ['green', [48, 85, 55]],
      ['green', [44, 80, 52]],
      ['green', [72, 116, 54]],
      ['green', [84, 121, 69]],
      // The cap's ribbed band and the darn on its tip.
      ['darn', [154, 186, 108]],
      ['darn', [146, 178, 106]],
      ['darn', [164, 194, 116]],
      ['darn', [182, 186, 116]],
      ['skin', [250, 195, 155]],
      ['skin', [244, 188, 146]],
      ['skin', [234, 204, 174]],
      ['skin', [182, 143, 111]],
      ['hair', [226, 180, 68]],
      ['hair', [212, 178, 103]],
      ['hair', [240, 188, 124]],
      ['brown', [100, 64, 46]],
      ['brown', [62, 42, 34]],
      ['brown', [76, 54, 46]],
      ['brown', [138, 92, 58]],
      ['brown', [126, 96, 79]],
      ['lid', [154, 164, 170]],
      // The lid's rim and its shaded side, a dark of the lid, so it reads as a lid and not a sack.
      ['rim', [112, 116, 128]],
      ['rim', [104, 112, 122]],
      ['lid', [164, 170, 178]],
      ['lid', [128, 140, 125]],
      // The rust round the hole.
      ['lid', [178, 122, 106]],
      ['dark', [255, 255, 255]],
      // The poker, a shade off the ink.
      ['iron', [45, 45, 51]],
      ['iron', [69, 66, 72]],
      ['dark', [12, 12, 16]],
      ['dark', [24, 22, 26]],
    ],
    line: 'dark',
    thin: ['green', 'darn', 'skin', 'hair', 'brown', 'lid', 'iron', 'rim'],
    fringe: 5,
    stroke: 6,
    feet: ['brown'],
    loose: ['iron'],
    ink: 5,
    // Grey scraps of the line's fringe by the chin and the knees, too small to be the lid or its rim.
    min: { dark: 0.1, lid: 1.5, rim: 0.8 },
  },
  roles: [
    { name: 'green', color: '#3f7a34', slot: 'player' },
    // The cap's band and its darned tip are a light of the costume, far enough off it to stay a band on any colour.
    { name: 'darn', color: '#8fb86a', on: 0, tone: 30 },
    { name: 'skin', color: '#efc9a4' },
    { name: 'hair', color: '#e6c25a' },
    { name: 'brown', color: '#6b4a35' },
    // A colourway is the dustbin lid (VARIETY.palette), in neutrals: galvanised, black plastic or white enamel.
    { name: 'lid', color: '#a8adb4', alts: ['#5a5e66', '#d2ccc0'], vary: 6 },
    { name: 'iron', color: '#4a4a52' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -16 },
    { name: 'plaster', color: '#e9d3b0' },
    { name: 'rim', color: '#7c828a', on: 5, tone: -22 },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // What's left of the drawing's eyes once its specks are painted over (a rim the traced speck missed), and the
  // dark scraps under the face, drawn as skin: under the kit's thin cheer arcs and blink the rim read as a
  // black eye.
  recolour: { from: 'dark', to: 'skin', below: -0.8, lying: [99, 0] },
  eyes: { role: 'dark', area: [0.12, 1.8], gap: [1.2, 4.5], specks: { dark: 2 }, band: [0.1, 0.45], count: 1, pair: [1.7, 0] },
  wear: {
    on: ['green'],
    chin: 3,
    marks: [
      [
        ['scuff', 0.6, 0.6, 0.5],
        ['scuff', 0.45, 0.76, 0.4],
      ],
      // Off the jagged hem and quiet: a dark mark down there read as a hole or a blotch.
      [
        ['scorch', 0.55, 0.62, 0.5],
        ['scorch', 0.42, 0.76, 0.4],
      ],
    ],
  },
  // A cross of plaster on his crown, a bonk on the head. On the cheek his small face put it on the jawline, and
  // its edge drew a dark line across the jaw that read as a scar or stubble.
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'crown', size: [2.2, 0.75] }],
  // The blink's dashes and the cheer's arcs at a width of their own: at the small eye's (0.39 and 0.33) they were
  // pale brown hairlines, and the face read as eyeless.
  face: { r: 0.72, iris: '#3c78c8', mark: 0.6, eye: 'anime' },
  gait: { bounce: [0.2, 0.8], lean: [0, 0.04] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 46 },
    // The jump and the fall, the cap on in both (the first round's falls threw it off).
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box' },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.7, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  poses: {
    idle2: { pose: `standing on guard, knees a little bent, the lid raised beside him and the sword held up and forward, looking ahead, ${KEEP}.` },
    'walk-1': { pose: `walking to the right, mid-step: the near boot forward, the far boot back, ${KEEP}.` },
    'walk-2': { pose: `walking to the right, the legs passing under the body: one boot planted, the other lifted a little, ${KEEP}.` },
    'run-1': { pose: `running fast to the right, striding out long, leaning forward, the sword pointing forward, ${KEEP}.` },
    'run-2': { pose: `running fast to the right, leaning forward, both boots off the ground with the legs gathered under him, ${KEEP}.` },
    'air-1': { pose: `jumping up with his knees tucked, the sword pointing up and forward, ${KEEP}.` },
    'air-2': { pose: `falling, his legs reaching down, his arms out a little to the sides, ${KEEP}.` },
    wall: {
      pose: `seen from his side, he is sliding down a tall wall on the right edge of the picture (do not draw the wall), one glove flat against it and both boots braced on it, his head turned to look back at us, the pointed cap flopping down behind his head, his long ear sticking out clear of it, the lid held out on his other arm and the sword hanging from that glove.`,
      far: true,
    },
    cheer: { pose: `cheering with the sword raised high over his head in one fist, his eyes wide open and looking ahead, a big open grin, ${KEEP}.` },
    cheer2: {
      pose: `holding the dustbin lid up high in one hand like a trophy, the arm stretched out to the side so the lid is well clear of his head and cap, the sword held low in the other hand, his eyes wide open, grinning.`,
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal across the picture, head on the left and boots on the right, arms and legs splayed limp, eyes shut, his pointed cap still on his head, the sword and the dustbin lid dropped beside him. Seen from the side.',
      far: true,
    },
  },
};
