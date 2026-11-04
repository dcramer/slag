import type { FlatKind } from '../kinds';

/**
 * The silhouette is the read: one crisp square-cornered box, side on, on two short crouched legs with a gap
 * between them, the bandana's two tails streaming out of a hand-hole behind. No head or arms show (the miner is
 * a cube head on a body with arms), and the box keeps its corners (the crewmate is a round bean). The eyes peer
 * out of a slot cut in its front. The first design, in three-quarter view with a crushed corner and flared
 * flaps, failed the blind read as a shaggy, hunched ape (2026-11-04); this one is side on.
 * Poses: three to a 16:9 image with the design as the reference, cut apart (`body` sizes them alike); cheer2 on
 * its own. In death the legs are lightened to a grey in the drawing: drawn, they were the tails' slate. Every
 * drawing with the slot has it painted flat skin with two pupils at fixed places across it: drawn, the pupils
 * touched the slot's dark cut end and traced as one blob, and the face kit found no pair.
 */
export const kind: FlatKind = {
  body: 216,
  map: {
    roles: ['box', 'boxside', 'tape', 'tail', 'stripe', 'suit', 'boot', 'skin', 'dark'],
    families: [
      ['box', [189, 147, 89]],
      ['box', [183, 139, 82]],
      ['box', [184, 148, 99]],
      ['box', [176, 131, 84]],
      // The box's back end, a face of its own: folded into the side, the box was a flat card, not a box.
      ['boxside', [157, 114, 70]],
      ['boxside', [154, 117, 75]],
      ['boxside', [150, 108, 66]],
      ['boxside', [140, 101, 62]],
      // The open flaps' insides.
      ['boxside', [162, 120, 77]],
      ['tape', [224, 203, 157]],
      ['tape', [213, 181, 139]],
      ['tape', [218, 185, 149]],
      ['tape', [132, 111, 87]],
      ['skin', [218, 163, 114]],
      ['skin', [182, 122, 85]],
      ['skin', [188, 135, 101]],
      // The tails and the suit are one slate in the drawing: told apart by where they are (`recolour`).
      ['tail', [60, 73, 87]],
      ['tail', [66, 80, 88]],
      ['tail', [44, 50, 59]],
      ['tail', [60, 69, 83]],
      ['tail', [46, 53, 63]],
      ['tail', [64, 71, 81]],
      ['suit', [97, 102, 104]],
      ['suit', [129, 147, 154]],
      ['suit', [87, 100, 109]],
      ['suit', [67, 77, 82]],
      // The tea-towel stripes, and the eyes' whites, which the face kit paints over (`specks`).
      ['stripe', [240, 242, 241]],
      ['stripe', [255, 255, 255]],
      ['boot', [41, 42, 48]],
      ['boot', [43, 42, 47]],
      ['dark', [26, 31, 40]],
      ['dark', [24, 23, 29]],
      // The box's own line is a dark brown, and so are the printed arrow and the hand-hole's inside: one ink,
      // the arrow told from it by where it is (`recolour`).
      ['dark', [60, 40, 17]],
      ['dark', [77, 49, 25]],
      ['dark', [81, 51, 24]],
      ['dark', [57, 37, 21]],
      ['dark', [66, 56, 49]],
    ],
    line: 'dark',
    thin: ['box', 'boxside', 'tape', 'tail', 'stripe', 'suit', 'boot', 'skin'],
    fringe: 5,
    stroke: 3.6,
    // No corner cutting: smoothed, the box traced as a rounded slab, and read as a bean.
    smooth: 0,
    feet: ['boot'],
    loose: ['tail', 'stripe'],
    min: { dark: 0.12 },
  },
  roles: [
    // The box is the costume, in the player's colour; its back end, the tape and the arrow tones of it.
    { name: 'box', color: '#c49a62', slot: 'player' },
    { name: 'boxside', color: '#808080', on: 0, tone: -18 },
    { name: 'tape', color: '#808080', on: 0, tone: 18 },
    { name: 'arrow', color: '#808080', on: 0, tone: -32 },
    // The bandana, a dark of it too: cloth off the box, and the player's colour from across a room.
    { name: 'tail', color: '#808080', on: 0, tone: -38 },
    { name: 'stripe', color: '#f4efe6' },
    // A colourway is the sneaking suit (VARIETY.palette), in cloth greys.
    { name: 'suit', color: '#6a7078', alts: ['#6e6c5e', '#858a90'], vary: 6 },
    { name: 'boot', color: '#3a3a40' },
    { name: 'skin', color: '#d9b08c' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear on the box, in tones of the player's colour: a scuffed patch, and soot.
    { name: 'scuff', color: '#808080', on: 0, tone: 12 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'sticker', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'sticker', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', from: 'map', area: [0.06, 1.6], band: [0.05, 0.5], gap: [1.1, 4], specks: { dark: 2.2, stripe: 2.5 } },
  // The slate under the box is the suit, and the dark fill on the box below the eyes is the printed arrow.
  recolour: [
    { from: 'tail', to: 'suit', below: 9.5, lying: [99, 0] },
    { from: 'dark', to: 'arrow', below: 2.5, lying: [99, 0] },
  ],
  wear: {
    on: ['box'],
    chin: 2.5,
    marks: [
      [
        ['scuff', 0.6, 0.7, 0.9],
        ['scuff', 0.35, 0.45, 0.7],
      ],
      [
        ['scorch', 0.55, 0.8, 0.9],
        ['scorch', 0.75, 0.5, 0.7],
      ],
    ],
  },
  accessories: [{ slot: 'sticker', role: 'sticker', at: 'cheek', size: [1.6, 1.2], offset: [0, 2] }],
  face: { r: 0.6, iris: '#2a1f1a', mark: 0.5 },
  gait: { bounce: [0.1, 0.6], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.2, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 26 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box', scale: 0.86 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.92 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Every pose keeps the box a crisp square-cornered box over him down to his knees, no arms and no head outside
  // it (but the laugh's), and the two striped tails out of the hand-hole behind. Drawn three to a 16:9 image with
  // the design as the reference, and cut apart: `body` sizes every pose alike.
  poses: {
    idle2: { pose: 'frozen stiff mid-step as if nobody saw him, one boot lifted, the box tipped back a little, the eyes darting sideways.' },
    'walk-1': { pose: 'sneaking to the right on tiptoe, mid-step, crouched low: the near boot forward, the far boot back.' },
    'walk-2': { pose: 'sneaking to the right on tiptoe, crouched low, the legs passing under the box: one boot planted, the other lifted a little.' },
    'run-1': { pose: 'scurrying fast to the right in a low crouch, the box tipped forward a little, the boots wide apart in a long stride.' },
    'run-2': { pose: 'scurrying fast to the right in a low crouch, the box tipped forward a little, both boots off the ground and gathered under it.' },
    'air-1': { pose: 'jumping straight up, both boots tucked up under the box, the tails streaming down behind.' },
    'air-2': { pose: 'falling, the box tipped back in alarm, both boots dangling apart below it, the tails flying up, the eyes wide.' },
    wall: {
      pose: 'sliding down a tall wall at the right edge of its space (do not draw the wall), the front of the box pressed flat against it, both boots braced flat on it, the tails hanging out behind, away from the wall.',
      far: true,
    },
    cheer: {
      pose: 'hopping for joy on the spot, both boots off the ground and kicked apart, the box tipped back happily, the tails flung up, the eyes squeezed happily shut.',
    },
    cheer2: {
      pose: 'laughing, his head has popped up out of the top of the box: a gruff soldier with his whole bare face showing, no mask, a stubble jaw, a big open laugh, the eyes squeezed shut, a dark navy bandana tied round his forehead only, its two striped tails streaming back from the knot; the eye slot on the box closed up and gone, the boots planted.',
    },
    death: {
      pose: 'knocked out: the box has toppled over and lies flat on its side on the floor, horizontal, the eye slot on the right with its eyes shut, both legs sticking out limp from its open end on the left, the tails lying limp.',
      far: true,
    },
  },
};
