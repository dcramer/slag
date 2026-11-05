import type { FlatKind } from '../kinds';

// Every pose keeps the three shapes that carry him (art/sprites/mage/design.prompt.txt): the huge straw hat, its brim
// wider than his shoulders and its crown bent over into a point flopping back (the read in black: nobody else in the
// cast wears a brim that wide); the dark face under it with only two round glowing eyes (the read in colour); the robe
// a wide flared bell to his ankles; and the broom-handle staff held upright, clear of his body (held across him, a
// prop vanishes into the outline).
const KEEP =
  'the huge battered straw hat always on his head, its round brim much wider than his shoulders and its tall crown bent over into a point flopping back, the clothes peg on it, under the brim always the black face with its two round glowing yellow eyes, the blue robe always a wide flared bell to his ankles, the broom handle with the light bulb taped to its top always held upright in one hand, clear of his body with white background round it';

export const kind: FlatKind = {
  body: 231,
  map: {
    roles: ['robe', 'straw', 'wood', 'grey', 'bulb', 'glow', 'dark'],
    // Sampled from the design (art/sprites/mage/design.png, `swatch.py`).
    families: [
      // The robe and its cel shade, the shade folded in.
      ['robe', [70, 93, 161]],
      ['robe', [69, 95, 161]],
      ['robe', [73, 92, 156]],
      ['robe', [75, 94, 154]],
      ['robe', [58, 81, 142]],
      ['robe', [44, 68, 124]],
      ['robe', [79, 86, 124]],
      // The straw hat, its shade and its loose ends.
      ['straw', [221, 181, 100]],
      ['straw', [217, 181, 103]],
      ['straw', [235, 210, 136]],
      ['straw', [194, 156, 88]],
      ['straw', [187, 143, 72]],
      ['straw', [185, 143, 73]],
      // The broom handle and the clothes peg.
      ['wood', [170, 129, 78]],
      ['wood', [176, 149, 103]],
      ['wood', [186, 153, 118]],
      // The patch and the tape: one grey.
      ['grey', [162, 156, 144]],
      ['grey', [99, 104, 131]],
      ['grey', [165, 164, 162]],
      // The bulb.
      ['bulb', [236, 223, 179]],
      // The eyes' glow.
      ['glow', [255, 213, 65]],
      ['glow', [252, 212, 65]],
      // The ink, the dark face, the belt and the feet.
      ['dark', [25, 22, 31]],
      ['dark', [28, 23, 30]],
      ['dark', [15, 9, 14]],
      ['dark', [22, 20, 32]],
      ['dark', [28, 18, 19]],
      ['dark', [43, 51, 83]],
    ],
    line: 'dark',
    thin: ['robe', 'straw', 'wood', 'grey', 'bulb', 'glow'],
    fringe: 5,
    stroke: 2.4,
    holes: 0.6,
    feet: ['dark'],
    // The broom is carried, so the body's size is the mage in his hat, alike in every pose.
    loose: ['wood', 'bulb'],
    min: { dark: 0.1, grey: 0.4, wood: 0.3, straw: 0.6, robe: 0.8 },
  },
  roles: [
    // The costume: the robe, in the player's colour.
    { name: 'robe', color: '#4a5fa8', slot: 'player' },
    // A colourway is the hat's straw (VARIETY.palette), neutrals all: straw, bleached, toasted.
    { name: 'straw', color: '#dcb66a', alts: ['#e2cc92', '#c99c52'], vary: 6 },
    { name: 'wood', color: '#94683e' },
    { name: 'grey', color: '#a4a09a' },
    { name: 'bulb', color: '#f0e6c0' },
    // The eyes' glow: a face mark, so neutral; the kit draws its own over it.
    { name: 'glow', color: '#ffd23c' },
    // The ink and the dark face: neutral.
    { name: 'dark', color: '#1e1a24' },
    { name: 'scuff', color: '#808080', on: 0, tone: 14 },
    { name: 'scorch', color: '#808080', on: 0, tone: -18 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // The two glowing eyes: the pair of yellow specks in the dark under the brim.
  eyes: { role: 'glow', area: [0.2, 6], gap: [1, 4.5], band: [0.2, 0.6], specks: { glow: 6 }, from: 'map' },
  wear: {
    on: ['robe'],
    chin: 4,
    marks: [[['scuff', 0.62, 0.6, 0.3]], [['scorch', 0.35, 0.82, 0.4]]],
  },
  // A plaster on the hat's crown: the face is only darkness and eyes.
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'crown', size: [1.6, 0.7] }],
  face: { r: 0.9, iris: '#ffd23c', eye: 'glow' },
  gait: { bounce: [0.2, 0.8], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 22 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 36 },
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.85 },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box', scale: 0.9 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.7 },
  },
  // Drawn three to a 16:9 image and cut apart (README → 3. Poses); the sheets' prompts are in
  // art/sprites/mage/design.prompt.txt. These are each pose alone, for a redraw.
  poses: {
    idle2: {
      pose: `standing shyly, both hands holding the broom handle upright in front of him, his hat tipped forward a little, ${KEEP}.`,
    },
    'walk-1': { pose: `walking to the right with small timid shuffling steps, mid-step, the near foot forward under the robe's hem, ${KEEP}.` },
    'walk-2': { pose: `walking to the right with small shuffling steps, the feet together under the robe, the hat bobbing down a little, ${KEEP}.` },
    'run-1': {
      pose: `running to the right in a hurry, leaning forward, one foot kicked out in front from under the robe and the other behind, the robe's hem flaring back, ${KEEP}.`,
    },
    'run-2': {
      pose: `running to the right, mid-stride, both feet off the ground, the robe's hem flaring back, the hat's brim bent back by the wind, ${KEEP}.`,
    },
    'air-1': {
      pose: `hopping up, both feet tucked up under the robe, the broom handle held up high in one hand, upright, its bulb far above the hat's point, ${KEEP}.`,
    },
    'air-2': { pose: `falling, both feet reaching down from under the robe, the free arm out to the side, the hat lifting off his head a little, ${KEEP}.` },
    wall: {
      pose: 'seen from his side, facing right: he is clinging to a tall wall on the right edge of his space (do not draw the wall), both feet and one hand braced flat against it, the huge straw hat with its bent point on his head, the black face with two glowing yellow eyes turned to look back at us, the broom handle held upright away from the wall to the left.',
      far: true,
    },
    cheer: {
      pose: `cheering, up on his toes, the broom handle thrust up and forward at a slant, its bulb far out in front of the hat's brim, clear of his head, ${KEEP}.`,
    },
    cheer2: { pose: `a shy little bow, bending forward at the waist, one hand holding the brim of his hat, the broom handle upright in the other, ${KEEP}.` },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, the huge straw hat on the left, squashed flat, and his feet on the right, the robe spread flat, the broom handle dropped flat on the floor beside him.',
      far: true,
    },
  },
};
