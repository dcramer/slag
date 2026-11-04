import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 293,
  map: {
    roles: ['yellow', 'dark', 'grey', 'check'],
    families: [
      ['yellow', [244, 203, 33]],
      ['yellow', [187, 144, 32]],
      ['yellow', [245, 208, 57]],
      ['dark', [41, 28, 20]],
      ['grey', [154, 154, 153]],
      // The napkin's white goes into its check: its gingham traced as a coloured wedge spotted with white
      // dashes, a rash at play size. The napkin is one flat linen.
      ['check', [248, 243, 230]],
      ['check', [166, 61, 39]],
      ['check', [179, 103, 59]],
    ],
    line: 'dark',
    thin: ['yellow', 'grey', 'check'],
    fringe: 5,
    // No interior lines: the crack on the crown traced as a stray tick beside the mouth's top corner, and the
    // rest were the outline's thick ink walked as lines just inside the edge, a second jagged rim round the
    // napkin and down the seam between it and the ball.
    stroke: 99,
    // Its open mouth is a gap, not a dark fill: the wedge is the read, in the silhouette above all.
    cut: { role: 'dark', area: 2 },
    feet: ['yellow'],
    // Ink scraps along the rim stay fills and dot the outline: under 1.2 px² they fold into the yellow.
    min: { dark: 1.2, check: 0.15 },
  },
  roles: [
    { name: 'yellow', color: '#f6d02a', slot: 'player' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'grey', color: '#9aa0a8' },
    // A colourway is the napkin (VARIETY.palette), one flat linen: white, bone or grey. Neutral: a wash of its
    // check in a colour took a colour of its own off the player's, and its pen, a dark of it, tinted the rim.
    { name: 'check', color: '#f2ede2', alts: ['#e0d2b6', '#c8cac6'], vary: 6 },
    { name: 'scuff', color: '#808080', on: 0, tone: 8 },
    // One quiet mark a wear: on a smooth ball, a loud blob reads as a spot.
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // The drawn eye is 1.4 to 3.1 px² (the scowl's brow joins it); a crack's speck is under 0.5, and took the kit's eye.
  // The eye's glint is the napkin's white: kept, it showed under the kit's blink as a pale dot.
  eyes: { role: 'dark', area: [0.6, 4], gap: [1, 4], specks: { dark: 4, check: 0.5 }, count: 1 },
  wear: {
    on: ['yellow'],
    chin: 2,
    marks: [[['scuff', 0.25, 0.8, 0.9]], [['scorch', 0.22, 0.72, 1.1]]],
  },
  // On the crown, a cross reads as a bow and a ball with a bow as another kind: across the cheek.
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2.2, 0.8] }],
  face: { r: 0.8, iris: '#14121a', eye: 'dot' },
  gait: { bounce: [0, 0.7], lean: [0, 0.04] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    // Its own shut-mouth drawing taped the napkin to its cheek and drew a big white eye: the walk's shut mouth is the look.
    idle2: { frames: ['walk-2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 24 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 36 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200] },
    // Its wall drawing grew a slab pressed to the wall, taller than the box: a ball slides in its fall.
    wall: { frames: ['air-2'], loop: true, fps: 1 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.7, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.9 },
  },
  poses: {
    'walk-1': { pose: 'moving to the right with the mouth half open.' },
    'walk-2': { pose: 'moving to the right with the mouth shut to a thin line.' },
    'run-1': { pose: 'racing to the right, tipped forward, the mouth thrown wide open.' },
    'run-2': { pose: 'racing to the right, tipped forward, the mouth snapped shut to a thin line.' },
    // Asked for no more, the hop grew legs and the fall a big white eye.
    'air-1': { pose: 'hopping up into the air, the mouth wide open, still only a ball with no legs, arms or feet.' },
    'air-2': { pose: 'falling, tipped back, the mouth open in alarm, the eye still the same small black dot.' },
    cheer: { pose: 'hopping on the spot with joy, the mouth wide open in a grin.' },
    // Rolled right over, it turned its tape to a strip down one side and threw its napkin clear of the jaw.
    cheer2: {
      pose: 'tipped back a little, laughing, the mouth thrown wide open, the eye still open as the same small black dot, the grey tape still across the top of its head and the napkin still tucked into the lower jaw.',
    },
    death: {
      pose: 'knocked out and squashed flat as a pancake on the floor, an oval much wider than it is tall, the mouth a limp line, the eye shut. Seen from the side.',
      far: true,
    },
  },
};
