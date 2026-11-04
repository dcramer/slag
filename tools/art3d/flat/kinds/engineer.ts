import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 144,
  map: {
    roles: ['skin', 'shirt', 'hat', 'khaki', 'glove', 'grey', 'strap', 'box', 'mouth', 'dark'],
    // Sampled from the design (the toolbox redraw). The belt and boots are the trousers' own shades, so they fold
    // into them: as a role of their own, every fold of the trousers came out in it.
    families: [
      ['skin', [244, 159, 107]],
      ['skin', [245, 160, 113]],
      ['skin', [240, 144, 99]],
      ['skin', [225, 160, 84]],
      ['skin', [187, 98, 71]],
      ['mouth', [100, 36, 40]],
      ['mouth', [230, 102, 96]],
      ['shirt', [137, 32, 20]],
      ['shirt', [104, 21, 17]],
      ['shirt', [141, 47, 34]],
      ['shirt', [119, 28, 21]],
      ['hat', [239, 170, 43]],
      ['hat', [228, 162, 29]],
      ['hat', [240, 200, 112]],
      ['hat', [213, 170, 71]],
      ['hat', [196, 136, 65]],
      ['hat', [171, 131, 67]],
      // The hat's shade and the gloves are one ochre in the drawing: both are the hat here, and the parts under
      // the face are the gloves again (recolour).
      ['hat', [182, 126, 35]],
      ['hat', [151, 104, 33]],
      ['hat', [166, 115, 44]],
      ['hat', [155, 108, 46]],
      ['hat', [135, 91, 46]],
      ['hat', [121, 118, 70]],
      ['khaki', [122, 85, 60]],
      ['khaki', [128, 89, 59]],
      ['khaki', [110, 76, 55]],
      ['khaki', [104, 57, 41]],
      ['khaki', [80, 54, 40]],
      ['khaki', [87, 55, 38]],
      ['khaki', [62, 34, 24]],
      ['khaki', [150, 116, 94]],
      ['box', [76, 120, 88]],
      ['box', [57, 93, 70]],
      ['box', [83, 128, 97]],
      ['box', [55, 76, 62]],
      ['box', [115, 137, 118]],
      ['box', [138, 170, 144]],
      ['box', [92, 104, 92]],
      ['box', [78, 90, 78]],
      ['grey', [147, 146, 138]],
      ['grey', [161, 158, 148]],
      ['grey', [107, 108, 99]],
      ['grey', [198, 198, 192]],
      ['grey', [130, 145, 150]],
      // The groove down the spanner's handle: as the toolbox's dark green, a green stripe on it.
      ['grey', [128, 122, 112]],
      ['grey', [84, 74, 79]],
      ['strap', [66, 72, 72]],
      ['strap', [70, 59, 59]],
      ['dark', [255, 255, 255]],
      ['dark', [10, 2, 1]],
      ['dark', [24, 3, 2]],
      ['dark', [35, 4, 2]],
      ['dark', [53, 3, 2]],
      ['dark', [29, 19, 14]],
    ],
    line: 'dark',
    thin: ['skin', 'shirt', 'hat', 'khaki', 'glove', 'grey', 'strap', 'box', 'mouth'],
    fringe: 5,
    stroke: 2.4,
    ink: 7,
    // The gaps between arm and body and between the legs, and the toolbox's and the spanner's eyes, cut through.
    holes: 0.6,
    feet: ['khaki'],
    // The kit is carried, so the body's size is the man's, alike in every pose whatever the kit does.
    loose: ['grey', 'box'],
    // Skin: the torn knee's flecks go, a tan speck with a pen at play size; every other skin part is over 4.
    min: { dark: 0.03, grey: 0.25, mouth: 0.2, skin: 1.5 },
  },
  roles: [
    { name: 'skin', color: '#efc9a4' },
    // The work shirt is the costume, in the player's colour; the hard hat a light tone of it, the toolbox a dark one.
    { name: 'shirt', color: '#b8433c', slot: 'player' },
    { name: 'hat', color: '#808080', on: 1, tone: 20 },
    // A colourway is the trousers (VARIETY.palette), neutrals all: khaki, slate, charcoal; the boots are drawn in them.
    { name: 'khaki', color: '#8c7a58', alts: ['#6b7178', '#5b5955'], vary: 6 },
    { name: 'glove', color: '#a8794a' },
    { name: 'grey', color: '#8e8a84' },
    { name: 'strap', color: '#3a4246' },
    { name: 'box', color: '#808080', on: 1, tone: -16 },
    { name: 'mouth', color: '#6a2826' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear, in tones of the shirt and the trousers it's on: a faded patch, and soot.
    { name: 'scuff', color: '#808080', on: 1, tone: 12 },
    { name: 'scuff2', color: '#808080', on: 3, tone: 14 },
    { name: 'scorch', color: '#808080', on: 1, tone: -18 },
    { name: 'scorch2', color: '#808080', on: 3, tone: -22 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // The gloves: the hat's ochre below the face, and in the knockout the parts right of the hat.
  recolour: { from: 'hat', to: 'glove', below: 3, lying: [0.3, -3] },
  // Found in the role map: his small eyes don't survive the tracer's smoothing. The band stops above the shirt:
  // to 0.55, the arm gaps' dark specks at the hip paired up as eyes. Dropped off the brim's ink.
  eyes: { role: 'dark', from: 'map', area: [0.06, 0.4], band: [0.15, 0.4], gap: [1.0, 2.2], specks: { dark: 2.8 }, drop: 1 },
  wear: {
    on: ['shirt', 'khaki'],
    chin: 3,
    marks: [
      [
        ['scuff', 0.5, 0.3, 0.9],
        ['scuff2', 0.42, 0.62, 0.45],
      ],
      [
        ['scorch', 0.55, 0.3, 1.0],
        ['scorch2', 0.58, 0.62, 0.45],
      ],
    ],
  },
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.5, 0.7] }],
  // Off the brim and thicker than the floor: his shut eyes and laugh were hairlines on the brim's ink line.
  face: { r: 0.62, iris: '#3c6fd0', mark: 0.6 },
  gait: { bounce: [0.1, 0.6], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 28 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    // One jump drawing, rising and falling: knees up, the kit held low.
    air: { frames: ['air-1'], loop: false, fps: 1, centre: 'box' },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    // The laugh's eyes are shut, which is what the kit's cheer draws.
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Every pose keeps his kit as the design carries it, low and clear of the body: the toolbox hanging by its handle
  // from the hand on the left of the picture, the spanner held low and forward in the gloved hand on the right, its
  // open jaw out in front of his knees. Nothing beside or above his head: carried up by his shoulder, the spanner's
  // jaw read as ears (blind read).
  poses: {
    idle2: {
      pose: 'standing with his chest puffed out, looking pleased with himself, the big green toolbox hanging by its handle from his hand on the left of the picture beside his knee, the giant spanner held low in his gloved hand on the right of the picture, slanting forward and down, its open jaw out in front of his knees. Nothing raised above his shoulders.',
    },
    'walk-1': {
      pose: 'trudging to the right with a heavy step, mid-step: the near boot forward, the far boot back, the big green toolbox hanging by its handle from his hand on the left of the picture, the giant spanner held low in his gloved hand on the right of the picture, slanting forward and down, its open jaw out in front of his knees. Nothing raised above his shoulders.',
    },
    'walk-2': {
      pose: 'trudging to the right, the legs passing under the body: one boot planted flat, the other lifted a little, the big green toolbox hanging by its handle from his hand on the left of the picture, the giant spanner held low in his gloved hand on the right of the picture, slanting forward and down, its open jaw out in front of his knees. Nothing raised above his shoulders.',
    },
    'run-1': {
      pose: 'running hard to the right, leaning forward, one knee high and the other leg pushing off, the big green toolbox swinging back by its handle from his hand on the left of the picture, the giant spanner held low and forward in his gloved hand on the right of the picture, its open jaw out in front. Nothing raised above his shoulders.',
    },
    'run-2': {
      pose: 'running hard to the right, leaning forward, both boots off the ground with the legs gathered under him, the big green toolbox swinging back by its handle from his hand on the left of the picture, the giant spanner held low and forward in his gloved hand on the right of the picture, its open jaw out in front. Nothing raised above his shoulders.',
    },
    'air-1': {
      pose: 'jumping up, the knees tucked up under him, the big green toolbox hanging by its handle from his hand on the left of the picture, the giant spanner held low and forward in his gloved hand on the right of the picture, its open jaw out in front of his knees. Nothing raised above his hat.',
    },
    wall: {
      pose: 'seen from his side, he is sliding down a tall wall on the right edge of the picture (do not draw the wall), both boots braced on it, his head turned to look back at us, the big green toolbox hanging by its handle from his hand behind him, the giant spanner held low in his gloved hand, its open jaw down by his knees. Nothing raised above his hat.',
      far: true,
    },
    cheer: {
      pose: 'cheering with a big open grin, up on his toes, holding the big green toolbox up proudly in front of his chest with the hand on the left of the picture, the giant spanner held low in his gloved hand on the right of the picture, its open jaw out in front of his knees. Nothing raised above his hat.',
    },
    cheer2: {
      pose: 'leaning back laughing, his eyes shut, the big green toolbox hanging by its handle from his hand on the left of the picture, the giant spanner held low in his gloved hand on the right of the picture, slanting forward and down, its open jaw out in front of his knees. Nothing raised above his shoulders.',
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal across the picture, head on the left and boots on the right, arms and legs splayed limp, eyes shut, the hard hat still on his head, the big green toolbox and the giant spanner dropped on the floor beside him. One figure only, seen from the side.',
      far: true,
    },
  },
};
