import type { FlatKind } from '../kinds';

// Every pose keeps the twist as the design carries it: the plunger on his shoulder like a greatsword, its cup a
// shape of its own far out behind his head, on a handle long enough to leave a wide gap. Slung low on his back it
// was lost behind him (the original redrawn, 2026-11-06); above his head the cup and the cap merged into one shape;
// close behind his head, the cup made the head one big lump ("big hair or ears", Amy Rose's hammer).
const KEEP =
  'the huge plunger always resting on his near shoulder like a greatsword, his gauntlet on the right of the picture gripping its long straight copper handle in front of his chest, the handle running back over his shoulder far behind him, and the big dark-red rubber cup far out behind his head at the end of it, with a wide gap of white background between the cup and his head';

export const kind: FlatKind = {
  body: 216,
  map: {
    roles: ['skin', 'red', 'redshade', 'blue', 'patch', 'brown', 'handle', 'tan', 'tanshade', 'grey', 'lens', 'dark', 'mouth'],
    families: [
      ['skin', [240, 185, 149]],
      ['skin', [254, 206, 170]],
      ['skin', [234, 187, 155]],
      ['skin', [227, 194, 172]],
      ['skin', [252, 185, 140]],
      ['red', [181, 58, 49]],
      ['red', [187, 70, 58]],
      ['redshade', [126, 28, 31]],
      ['redshade', [107, 28, 26]],
      ['redshade', [133, 35, 43]],
      ['redshade', [119, 32, 26]],
      ['redshade', [72, 21, 23]],
      // The cup's highlights, nearer the copper than the cap: they folded into the handle's tan.
      ['redshade', [182, 88, 78]],
      ['blue', [68, 89, 149]],
      ['blue', [68, 90, 154]],
      ['blue', [52, 62, 83]],
      ['blue', [50, 52, 81]],
      ['patch', [165, 188, 210]],
      ['patch', [150, 170, 195]],
      ['brown', [60, 40, 27]],
      ['brown', [64, 41, 28]],
      ['brown', [45, 31, 34]],
      ['brown', [113, 75, 65]],
      // The gloves, and their shade as a shape of its own: folded into the tan, the fist and its curled
      // fingers drew as one shapeless lump at the hip.
      ['tan', [200, 147, 82]],
      ['tan', [215, 164, 118]],
      ['tan', [187, 133, 87]],
      ['tanshade', [136, 99, 73]],
      ['tanshade', [152, 101, 56]],
      // The copper handle, its shadow and its shine: a role of its own, or it was the gloves' tan, and the
      // gloves and handle drew as one shapeless mass. Nearer the cap's red, it drew in the player's colour.
      ['handle', [199, 105, 71]],
      ['handle', [201, 118, 90]],
      ['handle', [156, 76, 60]],
      ['handle', [174, 80, 62]],
      ['handle', [232, 153, 109]],
      ['grey', [123, 119, 108]],
      ['grey', [150, 151, 145]],
      ['grey', [141, 125, 103]],
      ['grey', [200, 192, 188]],
      ['lens', [48, 62, 49]],
      ['lens', [30, 45, 38]],
      ['lens', [65, 72, 79]],
      ['dark', [10, 4, 4]],
      // The tongue of an open mouth (the cheers, the fall): red, it was drawn in the player's colour.
      ['mouth', [192, 84, 82]],
      ['mouth', [208, 92, 96]],
      // The eyes' glints, inside the eyes.
      ['dark', [255, 255, 255]],
    ],
    line: 'dark',
    thin: ['skin', 'red', 'redshade', 'blue', 'patch', 'brown', 'handle', 'tan', 'tanshade', 'grey', 'lens', 'mouth'],
    fringe: 5,
    stroke: 2.4,
    feet: ['brown'],
    // The overalls' own colour in the goggles' lens shading: specks that stretched the overalls' box up to the cap.
    min: { dark: 0.12, grey: 0.25, tanshade: 0.3, blue: 0.6 },
    // The gaps under the back arm (run-1, 3 world px²), between the waving glove and the brim (air-2) and
    // behind the handle (run-2): traced, they were dark blobs. Over the open grin's teeth (0.27) and the
    // white the cup's neck closes in by the hair (0.3 to 0.45), which stays a dark speck.
    holes: 0.5,
  },
  roles: [
    { name: 'skin', color: '#efc9a4' },
    { name: 'red', color: '#c9473f', slot: 'player' },
    // The drawing's own shadow on the cap and shirt, and the plunger's cup: a dark of the player's colour.
    { name: 'redshade', color: '#808080', on: 1, tone: -22 },
    // The overalls: a dark of the cap and shirt, so the bib over the shirt is the player's colour block. Darker
    // still, on a dark ground the bib and the boots sank into one mass (a navy cloth did).
    { name: 'blue', color: '#808080', on: 1, tone: -20 },
    // The boots, hair and mustache: one colour in the drawing, so one role. Lighter than the drawing's: on a
    // dark ground the boots sank into it.
    // The patches on the bib and the knee: a light of the overalls, so they show as cloth sewn on, on every colour.
    { name: 'patch', color: '#808080', on: 3, tone: 26 },
    { name: 'brown', color: '#5e412d' },
    { name: 'handle', color: '#a65f38' },
    // A colourway is the gauntlets (VARIETY.palette), in neutrals: tan leather, buff suede, dark leather. Never a
    // pale canvas: off-white, they were the original's white gloves again.
    { name: 'tan', color: '#b08454', alts: ['#d2b27a', '#76583f'], vary: 6 },
    { name: 'tanshade', color: '#7f5c39', alts: ['#a3854f', '#523d2c'], vary: 6 },
    { name: 'grey', color: '#8e8a84' },
    // The welding goggles' lenses: a smoked green-grey, neutral, darker than their rims.
    { name: 'lens', color: '#3e4c45' },
    { name: 'dark', color: '#2a1f1a' },
    { name: 'mouth', color: '#9a3d36' },
    // Wear on the overalls: a faded streak, and soot, 10 over and 16 under the overalls' tone. Quiet tones:
    // louder, a mark on the flat bib read as a spot.
    { name: 'scuff', color: '#808080', on: 1, tone: -10 },
    { name: 'scorch', color: '#808080', on: 1, tone: -36 },
    { name: 'plaster', color: '#e9d3b0' },
  ],
  slots: [
    { name: 'plaster', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // Down to 0.06 for the laughing arcs of cheer2 (0.51 and 0.07: the far one traces thin), so the kit draws its
  // cheer arcs there; shut to the kit, the near arc stayed as a lone dash.
  eyes: { role: 'dark', area: [0.06, 2.6], gap: [1.4, 4.5], specks: { dark: 2.8 } },
  wear: {
    on: ['blue'],
    chin: 3,
    marks: [
      [
        ['scuff', 0.5, 0.35, 0.5],
        ['scuff', 0.3, 0.85, 0.4],
      ],
      [
        ['scorch', 0.55, 0.4, 0.5],
        ['scorch', 0.3, 0.82, 0.4],
      ],
    ],
  },
  // Up and back from the cheek's place: there its low edge ran into the moustache's.
  accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2.2, 0.9], offset: [-0.3, -0.6] }],
  // The blink's dashes and the cheer's arcs at a width of their own: at the eye's (0.54) a blink was a pale brown
  // hairline, nearly eyeless at play scale.
  face: { r: 0.95, iris: '#3c6fd0', mark: 1.1, eye: 'pill' },
  gait: { bounce: [0.15, 0.85], lean: [0, 0.035] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 44 },
    // Centred on its box: the cup behind and the fist flung out drew him past the cast's box, centred on his feet.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], centre: 'box' },
    // Centred on its box: side on, the cup out behind him put him past the cast's box, centred on his boots.
    wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    // Laughing with his eyes shut: drawn as thin arcs, they trace as lines, and the kit finds no eyes to act on.
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3], eyes: false },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box', scale: 0.9 },
  },
  poses: {
    idle2: { pose: `standing proudly with his chest puffed out, his free gauntlet fist on his hip, ${KEEP}.` },
    'walk-1': {
      pose: `walking to the right with a jaunty bouncing step, mid-step, the near boot forward and the far boot back, his free gauntlet swinging, ${KEEP}.`,
    },
    'walk-2': { pose: `walking to the right, the legs passing under the body, one boot planted flat and the other lifted a little behind it, ${KEEP}.` },
    'run-1': { pose: `running fast to the right, leaning forward, one knee high and the other leg pushing off behind, his free gauntlet pumping, ${KEEP}.` },
    'run-2': { pose: `running fast to the right, leaning forward, both boots off the ground with the legs gathered under him, ${KEEP}.` },
    'air-1': { pose: `jumping straight up, his free gauntlet fist punched high over his head, the legs tucked under him, ${KEEP}.` },
    'air-2': { pose: `falling, the legs reaching down, his free gauntlet flung out to the side, his mouth open in alarm, ${KEEP}.` },
    wall: {
      pose: 'seen from his side, he is sliding down a tall wall that is just to his right (do not draw the wall), one gauntlet flat against it and both boots braced on it, his head turned to look back at us, the huge plunger on his back, its long straight handle slanting up behind him and the big dark-red cup far out behind his head with a wide gap of white background between them.',
      far: true,
    },
    cheer: { pose: `cheering with a big grin under the mustache, up on his toes, his free gauntlet fist pumped high over his head, ${KEEP}.` },
    cheer2: { pose: `leaning back laughing, his eyes shut, his free gauntlet on his belly, ${KEEP}.` },
    death: {
      pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal, head on the left and boots on the right, arms and legs splayed limp, eyes shut, the cap still on his head, the huge plunger dropped flat on the floor just below him, its cup by his boots.',
      far: true,
    },
  },
};
