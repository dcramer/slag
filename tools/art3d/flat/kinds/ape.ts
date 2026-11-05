import type { FlatKind } from '../kinds';

// Every pose keeps what the read needs: the hunch, the arms longer than the legs, the tie on the bare chest, the
// taped fists and the banana behind the ear. Nothing is raised far over the head: the box is a brute's, wide.
const KEEP = 'The crooked torn necktie stays on his bare chest, both fists stay wrapped in grey tape, the peeled banana stays behind his ear.';

export const kind: FlatKind = {
  body: 237,
  map: {
    roles: ['fur', 'skin', 'tie', 'tape', 'banana', 'dark'],
    families: [
      ['fur', [120, 72, 32]],
      ['fur', [85, 47, 28]],
      ['fur', [80, 48, 32]],
      ['fur', [99, 59, 33]],
      ['fur', [57, 29, 21]],
      ['skin', [231, 181, 126]],
      ['skin', [184, 133, 95]],
      ['skin', [151, 102, 67]],
      ['tie', [189, 59, 46]],
      ['tie', [138, 64, 38]],
      ['tape', [150, 156, 159]],
      ['tape', [113, 99, 89]],
      ['tape', [165, 159, 149]],
      ['banana', [242, 208, 74]],
      ['banana', [237, 207, 124]],
      ['banana', [247, 228, 160]],
      ['dark', [30, 15, 16]],
      ['dark', [18, 8, 12]],
      // The eyes' glints, inside the eyes.
      ['dark', [255, 255, 255]],
    ],
    line: 'dark',
    thin: ['fur', 'skin', 'tie', 'tape', 'banana'],
    fringe: 5,
    stroke: 2.4,
    ink: 5,
    feet: ['skin', 'tape', 'fur'],
    min: { dark: 0.12 },
    // The background closed in between an arm and a leg (the gallop's, the walk's): traced, it was a white sliver.
    holes: 0.5,
  },
  roles: [
    // The fur is the costume, in the player's colour (Decisions 4: the region a stranger names him by).
    { name: 'fur', color: '#7a4e2c', slot: 'player' },
    { name: 'skin', color: '#e2b98a' },
    // The clip-on tie, a dark of the fur. At −10 it ran into the fur of the arm beside it and vanished at play
    // scale; lighter, the orange and yellow ties sank into the pale chest.
    { name: 'tie', color: '#808080', on: 0, tone: -24 },
    { name: 'tape', color: '#9aa0a8', alts: ['#b8b2a4', '#6f757c'], vary: 6 },
    // The banana, a light of the fur: a fixed yellow broke the neutral palette and vanished on yellow apes.
    { name: 'banana', color: '#808080', on: 0, tone: 30 },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'scuff', color: '#808080', on: 0, tone: 10 },
    { name: 'scorch', color: '#808080', on: 0, tone: -16 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', from: 'map', area: [0.03, 1.2], gap: [0.8, 3.5], specks: { dark: 2.4 } },
  wear: {
    on: ['fur'],
    chin: 3,
    marks: [
      [
        ['scuff', 0.25, 0.42, 0.75],
        ['scuff', 0.72, 0.6, 0.55],
      ],
      [
        ['scorch', 0.25, 0.42, 0.85],
        ['scorch', 0.72, 0.6, 0.6],
      ],
    ],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.8, 0.8] }],
  face: { r: 0.75, iris: '#5a3820' },
  gait: { bounce: [0.1, 0.6], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
    // The knuckle gallop: the arms reach and land, then the legs swing through between them.
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    // Centred and a little smaller: stood on its feet, the fists raised over the head reached out of the box.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box', scale: 0.93 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    // Beating his chest with both fists, and the second cheer.
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.35, 0.2] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  poses: {
    idle2: {
      pose: `standing hunched as in the reference, one long arm raised to scratch the top of his head, the other fist on the ground, looking bored. ${KEEP}`,
    },
    'walk-1': {
      pose: `knuckle-walking to the right on all fours, hunched: the near fist planted forward on its knuckles, the far fist lifted, the far foot forward and the near foot back. ${KEEP}`,
    },
    'walk-2': {
      pose: `knuckle-walking to the right on all fours, hunched: the far fist planted forward on its knuckles, the near fist lifted, the legs passing under the body. ${KEEP}`,
    },
    'run-1': {
      pose: `galloping fast to the right on all fours, the body low and compact: both long arms reaching far forward together, the taped fists about to land, the short legs pushing off behind. ${KEEP}`,
    },
    'run-2': {
      pose: `galloping fast to the right on all fours, the body low and compact: both taped fists planted on the ground under his shoulders, the body vaulting over them, both short legs swinging forward between the arms, the feet off the ground. ${KEEP}`,
    },
    'air-1': {
      pose: `leaping up, both long arms stretched up and forward, fists clenched just above his head, the short legs tucked up under him. ${KEEP}`,
    },
    'air-2': { pose: `falling, both long arms flung up and out to the sides, the legs dangling down, the mouth open in alarm. ${KEEP}` },
    wall: {
      pose: `seen from his side, he is sliding down a tall wall on the right edge of the picture (do not draw the wall), one taped fist and both feet braced flat on it, the other long arm hanging, his head turned to look back at us. ${KEEP}`,
      far: true,
    },
    cheer: { pose: `beating his chest with both taped fists, chest puffed out, mouth wide open in a happy roar, standing on his short legs. ${KEEP}` },
    cheer2: { pose: `both long arms thrown up high over his head, fists clenched, a big toothy grin, bouncing on his feet. ${KEEP}` },
    death: {
      pose: `he has been knocked out and lies flat on his back on the floor, the whole body horizontal across the picture, head on the left and feet on the right, long arms and short legs splayed limp, eyes shut, tongue out. Seen from the side. ${KEEP}`,
      far: true,
    },
  },
};
