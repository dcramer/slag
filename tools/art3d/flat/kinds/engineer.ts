import type { FlatKind } from '../kinds';

export const kind: FlatKind = {
  body: 177,
  map: {
    roles: ['skin', 'shirt', 'khaki', 'tan', 'grey', 'yellow', 'strap', 'lens', 'mouth', 'dark'],
    // Sampled from the design (the lantern-jaw redraw). The belt is the trousers' own shade, so it folds into
    // them: as a role of its own, every fold of the trousers came out in it.
    families: [
      ['skin', [244, 163, 115]],
      ['skin', [240, 150, 102]],
      ['skin', [189, 98, 68]],
      // The open mouth and its tongue: as the shirt's shade (the colour they're closest to), a grin went the player's colour.
      ['mouth', [100, 36, 40]],
      ['mouth', [230, 102, 96]],
      ['shirt', [145, 36, 24]],
      ['shirt', [138, 33, 22]],
      ['shirt', [118, 29, 23]],
      ['shirt', [106, 25, 21]],
      ['shirt', [149, 57, 40]],
      ['khaki', [122, 86, 62]],
      ['khaki', [127, 90, 62]],
      ['khaki', [123, 100, 81]],
      ['khaki', [88, 55, 38]],
      ['tan', [166, 114, 42]],
      ['tan', [150, 100, 36]],
      ['tan', [130, 84, 30]],
      ['yellow', [232, 168, 22]],
      ['yellow', [241, 180, 55]],
      ['yellow', [186, 126, 28]],
      // The spanner, its shade (as strap, a dark blotch on it) and its highlight.
      ['grey', [148, 146, 136]],
      ['grey', [136, 130, 122]],
      ['grey', [105, 100, 90]],
      ['grey', [198, 198, 192]],
      ['strap', [66, 72, 72]],
      ['lens', [122, 148, 154]],
      // White inside the figure is the background through a gap (between arm, hip and spanner; between the
      // legs; the slot in the spanner's handle): ink, which is what the silhouette fills a gap with. A grin's
      // teeth go the same way, under the smallest part worth a shape.
      ['dark', [255, 255, 255]],
      ['dark', [17, 2, 2]],
      ['dark', [35, 3, 2]],
      ['dark', [53, 3, 2]],
      ['dark', [39, 20, 17]],
    ],
    line: 'dark',
    thin: ['skin', 'shirt', 'khaki', 'tan', 'grey', 'yellow', 'strap', 'lens', 'mouth'],
    fringe: 5,
    stroke: 2.4,
    ink: 7,
    // The gaps between arm and body and between the legs, and the wrench's eye, cut through: inked, they read as dirt
    // (the laugh's, by the hip, is 0.76: inked, a hole under the shirt). The grin's teeth (0.44) stay.
    holes: 0.6,
    feet: ['khaki'],
    // Skin: the torn knees (0.6 to 1.2 world px²) go, a tan speck with a pen at play size; every other skin part is over 4.
    min: { dark: 0.03, grey: 0.25, lens: 0.2, mouth: 0.2, skin: 1.5 },
  },
  roles: [
    { name: 'skin', color: '#efc9a4' },
    // The work shirt is the costume, in the player's colour.
    { name: 'shirt', color: '#b8433c', slot: 'player' },
    // A colourway is the trousers (VARIETY.palette); the boots are drawn in them.
    { name: 'khaki', color: '#8c7a58', alts: ['#6b7178', '#5e5f3c'], vary: 6 },
    { name: 'tan', color: '#b08454' },
    { name: 'grey', color: '#8e8a84' },
    { name: 'yellow', color: '#e9b730' },
    { name: 'strap', color: '#3a4246' },
    { name: 'lens', color: '#5fb0c8' },
    { name: 'mouth', color: '#6a2826' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear, in tones of the shirt (the player's colour) and the trousers it's on: a faded patch, and soot.
    { name: 'scuff', color: '#808080', on: 1, tone: 12 },
    { name: 'scuff2', color: '#808080', on: 2, tone: 14 },
    { name: 'scorch', color: '#808080', on: 1, tone: -18 },
    { name: 'scorch2', color: '#808080', on: 2, tone: -22 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // The drawn eyes sit about 1.4 apart under the brim. Wider, a scrap of the brim's ink on the face's left
  // outline paired with the right eye, and the near eye sat on the outline over the wrench.
  // Found in the role map: his small eyes don't survive the tracer's smoothing. Above the goggles' white gaps.
  eyes: { role: 'dark', from: 'map', area: [0.06, 0.4], band: [0.185, 0.55], gap: [1.0, 2.2], specks: { dark: 2.8 }, drop: 1 },
  wear: {
    on: ['shirt', 'khaki'],
    chin: 3,
    marks: [
      [
        ['scuff', 0.55, 0.3, 1.0],
        // The trousers' marks on the thighs: on the thin shins, by the boots, they read as blotches.
        ['scuff2', 0.42, 0.62, 0.45],
      ],
      [
        ['scorch', 0.5, 0.3, 1.1],
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
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box' },
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    // The fist-up grin sits higher on his face, its top 0.8 under the dropped eyes: dropped as far, the shut
    // eyes lay on the mouth's top edge, one dark blob with it. Halfway between brim and grin.
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25], shift: [0, -0.6] },
    // The laugh's eyes are shut, which is what the kit's cheer draws: shut out, the face had no eyes at all.
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  // Every pose keeps the spanner as the design holds it, its open jaw up beside his shoulder and clear of the
  // hat, and nothing raised over the hat: a fist or the spanner held up read as spikes off it (blind read).
  poses: {
    idle2: {
      pose: 'standing with his chest puffed out and the bare hand on his hip, the huge one-jawed spanner held as in the reference, gripped by its end in the gloved hand at his hip and slanting up past his shoulder, its big open jaw up beside his shoulder and clear of his hat, nothing of it below his hip, looking pleased with himself. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
    },
    'walk-1': {
      pose: 'trudging to the right with a heavy step, mid-step: the near boot forward, the far boot back, the huge one-jawed spanner held as in the reference, gripped by its end in the gloved hand at his hip and slanting up past his shoulder, its big open jaw up beside his shoulder and clear of his hat, nothing of it below his hip. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
    },
    'walk-2': {
      pose: 'trudging to the right, the legs passing under the body: one boot planted flat, the other lifted a little, the huge one-jawed spanner held as in the reference, gripped by its end in the gloved hand at his hip and slanting up past his shoulder, its big open jaw up beside his shoulder and clear of his hat, nothing of it below his hip. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
    },
    'run-1': {
      pose: 'running hard to the right, leaning forward, one knee high and the other leg pushing off, the bare fist pumping low, the huge one-jawed spanner held as in the reference, gripped by its end in the gloved hand at his hip and slanting up past his shoulder, its big open jaw up beside his shoulder and clear of his hat, nothing of it below his hip. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
    },
    'run-2': {
      pose: 'running hard to the right, leaning forward, both boots off the ground with the legs gathered under him, the bare fist pumping low, the huge one-jawed spanner held as in the reference, gripped by its end in the gloved hand at his hip and slanting up past his shoulder, its big open jaw up beside his shoulder and clear of his hat, nothing of it below his hip. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
    },
    'air-1': {
      pose: 'jumping up, the knees tucked up under him, the bare fist clenched at his chest, the huge one-jawed spanner held as in the reference, gripped by its end in the gloved hand at his hip and slanting up past his shoulder, its big open jaw up beside his shoulder and clear of his hat, nothing of it below his hip; nothing raised above his hat. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
    },
    'air-2': {
      pose: 'falling, the legs reaching down, the bare arm flung out to the side, the mouth open in alarm, the huge one-jawed spanner held as in the reference, gripped by its end in the gloved hand at his hip and slanting up past his shoulder, its big open jaw up beside his shoulder and clear of his hat, nothing of it below his hip; nothing raised above his hat. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
    },
    wall: {
      pose: 'seen from his side, he is sliding down a tall wall on the right edge of the picture (do not draw the wall), the bare hand flat against it and both boots braced on it, the huge one-jawed spanner gripped by its end in the gloved hand and slanting up behind him, its big open jaw clear of his hat, his head turned to look back at us. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
      far: true,
    },
    cheer: {
      pose: 'cheering, the bare fist punched up beside his hat, a big grin, up on his toes, the huge one-jawed spanner held as in the reference, gripped by its end in the gloved hand at his hip and slanting up past his shoulder, its big open jaw up beside his shoulder and clear of his hat, nothing of it below his hip. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
    },
    cheer2: {
      pose: 'leaning back laughing, turned a little toward us, the bare hand on his belly, the huge one-jawed spanner held as in the reference, gripped by its end in the gloved hand at his hip and slanting up past his shoulder, its big open jaw up beside his shoulder and clear of his hat, nothing of it below his hip. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
    },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal across the picture, head on the left and boots on the right, arms and legs splayed limp, eyes shut, the round hard hat still on his head, the one huge one-jawed spanner dropped beside him. One figure only, seen from the side. His huge square lantern jaw, flat-bottomed with hard corners, juts out as in the reference.',
      far: true,
    },
  },
};
