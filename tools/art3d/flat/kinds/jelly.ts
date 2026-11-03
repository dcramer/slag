import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 279,
  // No face: the three cherries are the read, in the drawing's own shapes. Its ribs are the mould's flutes.
  map: {
    roles: ['green', 'rim', 'red', 'fang', 'doily', 'dark'],
    families: [
      ['green', [143, 214, 91]],
      ['green', [172, 234, 98]],
      ['green', [108, 186, 79]],
      ['green', [68, 132, 50]],
      ['green', [194, 240, 148]],
      ['green', [120, 194, 86]],
      ['green', [155, 210, 109]],
      ['rim', [216, 244, 206]],
      ['rim', [232, 246, 218]],
      ['red', [187, 64, 56]],
      ['red', [170, 48, 42]],
      ['red', [182, 98, 83]],
      ['fang', [235, 232, 208]],
      ['fang', [214, 204, 177]],
      ['doily', [250, 248, 242]],
      ['dark', [54, 89, 40]],
      ['dark', [81, 38, 23]],
    ],
    line: 'dark',
    thin: ['green', 'rim', 'red', 'fang', 'doily'],
    // The mould's ribs run in front of the cherries as green bands about 10 image px wide: as fringe, they
    // fold into the cherry either side, or each cherry traces in halves.
    fringe: 13,
    // Only the long rib lines: the short ones, and a rib's run across a cherry, are flecks at play size.
    stroke: 5,
    // No doily at play size: between the fangs it merges the four hooks into one pale skirt (cut out), and a
    // patch held between clapped fangs reads as a grin (folded into them).
    cut: { role: 'doily', area: 0.3 },
    feet: ['fang'],
    min: { doily: 12 },
  },
  roles: [
    { name: 'green', color: '#9ee38a', slot: 'player' },
    // The rim is a light of the dome, so it follows the player's colour.
    { name: 'rim', color: '#808080', on: 0, tone: 14 },
    // The roster's cherry shade, not its red: on a red or pink dome the red cherries vanish, and with the mint on top
    // a red jelly reads as a strawberry.
    { name: 'red', color: '#9c3530' },
    // A colourway is the sugared almonds (VARIETY.palette): ivory, pink or pale blue.
    { name: 'fang', color: '#efe6d2', alts: ['#f2c6cc', '#c8dcee'], vary: 6 },
    { name: 'doily', color: '#fbf6ee' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'scuff', color: '#808080', on: 0, tone: 8 },
    // One quiet mark a wear: on a smooth dome, a loud blob reads as a spot.
    { name: 'scorch', color: '#808080', on: 0, tone: -12 },
    { name: 'mint', color: '#4ca04a' },
  ],
  slots: [
    { name: 'mint', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // No face to draw (no `face`): the top cherry is only the anchor the accessory is placed from, and nothing goes.
  eyes: { role: 'red', area: [3, 40], gap: [1, 4], specks: {}, count: 1, band: [0.15, 0.42] },
  wear: {
    on: ['green'],
    chin: 0,
    marks: [[['scuff', 0.32, 0.72, 0.9]], [['scorch', 0.68, 0.74, 1.0]]],
  },
  // A sprig of mint crossed on its crown, a dessert's garnish.
  accessories: [{ slot: 'mint', role: 'mint', at: 'crown', size: [2.4, 0.9] }],
  gait: { bounce: [0.2, 0.9], lean: [0, 0.04] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.4, 1.8] },
    // The chomp: fangs open, fangs shut. The image model wouldn't tip the dome, so `run-2` is the walk's
    // second drawing of fangs snapped shut (its own came back with splashes and a cherry out of the dome).
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 24 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 34 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200] },
    // Nothing to press to a wall: it slides in its fall.
    wall: { frames: ['air-2'], loop: true, fps: 1 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, centre: 'box' },
  },
  poses: {
    idle2: { pose: 'settling like a jelly on a plate: squashed a little lower and wider, wobbling, the four fangs curled in close together under it.' },
    'walk-1': { pose: 'gliding through the air to the right, tipped forward a little, the four fangs spread wide open.' },
    'walk-2': { pose: 'gliding through the air to the right, upright and a little taller, the four fangs snapped shut together.' },
    'run-1': { pose: 'darting fast to the right, the whole dome tipped well forward and leaning into it, the four fangs spread wide open.' },
    'run-2': { pose: 'darting fast to the right, the whole dome tipped well forward and leaning into it, the four fangs snapped shut together.' },
    'air-1': { pose: 'shooting upwards, the jelly stretched taller and narrower as it wobbles, the four fangs drawn together under it.' },
    'air-2': { pose: 'dropping down, the jelly squashed wider and lower as it wobbles, the four fangs flung wide open.' },
    cheer: { pose: 'bouncing up with joy, stretched tall, the four fangs flung wide open, the cherries jiggling.' },
    cheer2: {
      pose: 'jiggling for joy, bobbed up high and squashed a little wider, the two front fangs raised up and curled outwards like waving arms, the two back fangs hanging down.',
    },
    death: {
      pose: 'melted into a low flat puddle of green jelly on the floor, much wider than it is tall, the three cherries sitting in it and the four fangs lying loose round it. Seen from the side.',
      far: true,
    },
  },
};
