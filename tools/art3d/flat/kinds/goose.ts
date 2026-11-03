import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 172,
  map: {
    roles: ['white', 'vest', 'stripe', 'orange', 'steel', 'dark'],
    families: [
      ['white', [241, 237, 226]],
      ['white', [190, 174, 161]],
      ['white', [196, 184, 174]],
      ['white', [194, 181, 156]],
      ['white', [237, 230, 213]],
      ['vest', [225, 203, 58]],
      ['vest', [185, 149, 86]],
      ['vest', [216, 201, 110]],
      ['stripe', [191, 193, 198]],
      ['orange', [213, 132, 69]],
      ['orange', [151, 124, 106]],
      ['stripe', [136, 136, 144]],
      ['steel', [152, 158, 164]],
      ['steel', [104, 112, 120]],
      ['orange', [97, 71, 58]],
      ['dark', [51, 29, 29]],
      ['dark', [38, 20, 21]],
    ],
    line: 'dark',
    thin: ['white', 'vest', 'stripe', 'orange', 'steel'],
    fringe: 5,
    stroke: 2.4,
    feet: ['orange'],
    loose: ['steel'],
    // Only the vest's big reflective bands: the scraps of its arcs round the wing are noise at play size.
    min: { dark: 0.04, stripe: 2.5 },
  },
  roles: [
    { name: 'white', color: '#f3f0ea' },
    { name: 'vest', color: '#e8d23a', slot: 'player' },
    { name: 'stripe', color: '#b3b9c3' },
    { name: 'orange', color: '#d9894a' },
    // A colourway is the loot in its beak (VARIETY.palette): bare steel, blued or green-painted. Never red or
    // brass: a red spanner in an open beak reads as a tongue, and brass as the beak.
    { name: 'steel', color: '#9aa0a8', alts: ['#5d6d86', '#4f8a5a'], vary: 6 },
    { name: 'dark', color: '#2a1f1a' },
    // One quiet mark a wear, low on the rump: the vest has no room between its bands, and a loud mark on the
    // white reads as a button or a hole.
    { name: 'scuff', color: '#808080', on: 0, tone: -7 },
    { name: 'scorch', color: '#808080', on: 0, tone: -20 },
    // A darker tan than the cast's plaster: a pale one is lost on the white neck.
    { name: 'plaster', color: '#c99a6a' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  eyes: { role: 'dark', area: [0.03, 1.2], gap: [1, 4], specks: { dark: 1.2 }, band: [0, 0.55], count: 1 },
  wear: {
    on: ['white'],
    chin: 4,
    marks: [[['scuff', 0.25, 0.82, 0.65]], [['scorch', 0.25, 0.8, 0.75]]],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.9, 0.8] }],
  face: { r: 0.7, iris: '#2a1f1a', eye: 'dot' },
  gait: { bounce: [0.1, 0.6], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 26 },
    // The honk charge is long, neck and loot thrust out in front: centred on itself, or the beak leaves the box.
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 42, centre: 'box' },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200] },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.9 },
  },
  poses: {
    idle2: {
      pose: 'standing up tall on its toes, the neck stretched straight up, peering round for something else to steal, the spanner still clamped in its beak.',
    },
    'walk-1': {
      pose: 'waddling to the right, mid-step: the near webbed foot forward, the far foot back, the body rocking to one side, the spanner still in its beak.',
    },
    'walk-2': {
      pose: 'waddling to the right, one webbed foot planted, the other lifted a little, the body rocking the other way, the spanner still in its beak.',
    },
    'run-1': {
      pose: 'charging fast to the right in a furious honk: the long neck thrust straight out in front, flat and level, the head low, both wings flung up high and spread wide above its back, the legs in a long stride, the spanner still clamped in its beak.',
    },
    'run-2': {
      pose: 'charging fast to the right in a furious honk: the long neck thrust straight out in front, flat and level, the head low, both wings flung up high and spread wide above its back, both feet off the ground tucked under it, the spanner still clamped in its beak.',
    },
    'air-1': { pose: 'jumping up, both wings flapping up high and spread wide, the webbed feet tucked under it, the spanner still in its beak.' },
    'air-2': {
      pose: 'falling, both wings flung up and out, the webbed feet dangling and spread, the neck stretched up in alarm, the spanner still in its beak.',
    },
    wall: {
      pose: 'seen from its side, it is sliding down a tall wall on the right edge of the picture (do not draw the wall), its chest and one spread wing pressed flat against it, both webbed feet braced on it, its long neck bent round to look back at us, the spanner still in its beak.',
      far: true,
    },
    cheer: { pose: 'honking in triumph, both wings flung up high and spread wide, the neck stretched up tall, the spanner still clamped in its beak.' },
    cheer2: {
      pose: 'strutting proudly on the spot, the chest puffed right out, the neck arched back, one wing lifted in a wave, the spanner still in its beak.',
    },
    death: {
      pose: 'it has been knocked out and lies flat on its back on the floor, the whole body horizontal across the picture, the long neck flopped limp along the floor with the head on the left, the webbed feet sticking up in the air on the right, the spanner lying beside its beak, eyes shut. Seen from the side.',
      far: true,
    },
  },
};
