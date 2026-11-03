/**
 * The flat kinds (docs/CHARACTERS.md → Rendered kinds → Flat kinds): for each, its roles in the order
 * they're painted, back to front, the poses its clips are traced from (`art/sprites/<kind>/flat/<name>.png`,
 * `idle` being the design itself), and its variety as data. `build.ts` reads it.
 */

export interface FlatRole {
  /** The role map's name for it (`rolemap.py`), or a mark's own. */
  name: string;
  color: string;
  slot?: 'paint' | 'player';
  alts?: readonly string[];
  vary?: number;
  on?: number;
  tone?: number;
}

export interface FlatClip {
  /** The pose drawings, in order. */
  frames: readonly string[];
  loop: boolean;
  fps?: number;
  stride?: number;
  vy?: readonly [number, number];
  holds?: readonly number[];
  /** False when the drawing's eyes are shut: no face is drawn. */
  eyes?: false;
  /** `box`: centred on the figure, for a pose not standing on its feet (lying knocked out), or one too wide about them (a wall slide). */
  centre?: 'box';
  /** Drawn this much smaller (or bigger) about the feet than the body size gives: a pose too wide for the box. */
  scale?: number;
}

/**
 * A pose drawing's prompt, with the design as the reference: the image model copies a reference closely,
 * which is what holds the character from pose to pose. A pose far from the design's (lying down, side on
 * to a wall) needs `far`, which lets go of the view, or the model hands back the design's own stance.
 */
export function posePrompt(pose: string, far = false): string {
  return far
    ? `The same character as in the reference image: the same design, proportions, colours, wear and tear, line and flat white background, drawn at the same size. New pose: ${pose} No ground, no shadow, no other figures.`
    : `The same character exactly as in the reference image: the same design, proportions, colours, wear and tear, line and flat white background, drawn at the same size and in the same three-quarter view facing right. Only its pose changes, to this: ${pose} Nothing else changes: no ground, no shadow on the ground, no motion lines, no other figures.`;
}

type RGB = readonly [number, number, number];

export interface FlatKind {
  /** World px square of the body (every role but the loose ones) in every pose: the design's at its height. */
  body: number;
  /**
   * How `rolemap.py` reads the drawings: its roles, the colour families each folds (sampled from the design,
   * shades included), the ink's role, roles whose thin edges are only the line's fringe (antialiased dots of a
   * colour along the ink), the roles it stands
   * on, the loose ones left out of its size, and the smallest part of a role worth a shape (world px²).
   */
  map: {
    roles: readonly string[];
    families: readonly (readonly [string, RGB])[];
    line: string;
    thin?: readonly string[];
    feet: readonly string[];
    loose?: readonly string[];
    min?: Readonly<Record<string, number>>;
    /** Image px: how thin a `thin` role's shape may be and still be only the line's fringe (default 7). */
    fringe?: number;
    /** The shortest interior line kept as a stroke, world px (default 1.4). */
    stroke?: number;
    /** Image px: how thick the ink must be to stay a fill and not a line (default 9; a thin iron poker needs less). */
    ink?: number;
    /** A drawn hole cut out of the figure: each patch of `role` over `area` world px² open to the outside. */
    cut?: { role: string; area: number };
  };
  /**
   * Where the face kit goes: the eyes are the pair of `role` specks `area` big (world px²) and `gap` apart,
   * and the specks it draws over (eyes, nose, a drawn mouth) are each role's parts smaller than its number.
   * `count: 1` for one eye (the dot-eater). An eye is never on the outline, where a speck is a scrap of ink.
   */
  eyes: {
    role: string;
    area: readonly [number, number];
    gap: readonly [number, number];
    specks: Readonly<Record<string, number>>;
    count?: 1;
    /** Where on the figure an eye can be, as fractions of its height from the top (default 0 to 0.5). */
    band?: readonly [number, number];
    /** With `count: 1`, a far eye set this far (world px) from the near one, for a face turned nearly side on. */
    pair?: readonly [number, number];
  };
  /** A dark under the face drawn in another role (`below` the eyes, world px; a lying pose's by size and x). */
  recolour?: { from: string; to: string; below: number; lying: readonly [number, number] };
  /**
   * The wear's marks (option 1 scuffed, option 2 scorched), each a role, a spot as fractions of the
   * surface's box, and a radius, on the bare `on` roles below `chin` (world px under the eyes).
   */
  wear: { on: readonly string[]; chin: number; marks: readonly (readonly (readonly [string, number, number, number])[])[] };
  /** On-off accessories drawn as strips from the near eye: a cross on the crown, a plaster across the cheek. */
  accessories: readonly { slot: string; role: string; at: 'crown' | 'cheek'; size: readonly [number, number] }[];
  roles: readonly FlatRole[];
  slots: readonly { name: string; vary: number; options: number }[];
  face: { r: number; iris: string; mouth?: readonly [number, number]; eye?: 'tall' | 'dot' };
  gait: { bounce: readonly [number, number]; lean: readonly [number, number] };
  clips: Readonly<Record<string, FlatClip>>;
  /** Each pose drawing's pose, for `posePrompt` (`far` for one far from the design's). */
  poses: Readonly<Record<string, { pose: string; far?: true }>>;
}

export const FLAT_KINDS: Record<string, FlatKind> = {
  zapmouse: {
    body: 157,
    map: {
      roles: ['fur', 'dark', 'cheek', 'tin', 'plug'],
      families: [
        ['fur', [240, 196, 40]],
        ['fur', [186, 124, 30]],
        ['fur', [222, 170, 30]],
        ['tin', [170, 186, 188]],
        ['tin', [126, 140, 142]],
        ['tin', [192, 192, 196]],
        ['cheek', [216, 76, 54]],
        ['plug', [236, 230, 218]],
        ['dark', [30, 20, 16]],
      ],
      line: 'dark',
      thin: ['tin'],
      feet: ['fur'],
      loose: ['tin'],
      min: { dark: 0.12, cheek: 0.3, plug: 0.35 },
    },
    eyes: { role: 'dark', area: [0.06, 0.7], gap: [2, 5.5], specks: { dark: 1.2, cheek: 0.35 } },
    recolour: { from: 'dark', to: 'cord', below: 2.5, lying: [0.4, -4] },
    wear: {
      on: ['fur'],
      chin: 4.5,
      marks: [
        [
          ['scuff', 0.32, 0.8, 1.1],
          ['scuff2', 0.68, 0.7, 0.8],
        ],
        [
          ['scorch', 0.38, 0.78, 1.4],
          ['scuff2', 0.7, 0.72, 0.75],
        ],
      ],
    },
    accessories: [{ slot: 'tape', role: 'tape', at: 'crown', size: [2.9, 0.85] }],
    roles: [
      { name: 'tin', color: '#a9afb7' },
      { name: 'fur', color: '#f2c62a', slot: 'player' },
      // A colourway is the cord and its plug together (VARIETY.palette).
      { name: 'plug', color: '#e8e2d4', alts: ['#d9622b', '#e8e2d4'], vary: 6 },
      { name: 'cord', color: '#7a5236', alts: ['#4b5560', '#9a3b2a'], vary: 6 },
      { name: 'cheek', color: '#e0473b' },
      { name: 'dark', color: '#2a1f1a' },
      // Wear, in tones of the fur it's on: rubbed pale, and burnt.
      { name: 'scuff', color: '#808080', on: 1, tone: 9 },
      { name: 'scuff2', color: '#808080', on: 1, tone: 13 },
      { name: 'scorch', color: '#808080', on: 1, tone: -24 },
      { name: 'tape', color: '#c9c6bd' },
    ],
    slots: [
      { name: 'tape', vary: 1, options: 2 },
      { name: 'wear', vary: 11, options: 3 },
    ],
    face: { r: 0.85, iris: '#2a1f1a', mouth: [1.8, 1.6], eye: 'dot' },
    gait: { bounce: [0.15, 0.75], lean: [0, 0.04] },
    clips: {
      idle: { frames: ['idle'], loop: true, fps: 1 },
      idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.6, 2.4] },
      walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
      run: { frames: ['run-1', 'run-2'], loop: true, stride: 44 },
      air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200] },
      wall: { frames: ['wall'], loop: true, fps: 1 },
      cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
      cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.45, 0.3] },
      death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
    },
    poses: {
      idle2: { pose: 'standing, looking back over its shoulder at its tin tail, one hand raised to scratch its taped ear.' },
      'walk-1': { pose: 'walking to the right, mid-step: the near foot forward, the far foot back, the arms swinging the other way.' },
      'walk-2': { pose: 'walking to the right, the legs passing under the body: one foot planted, the other lifted a little.' },
      'run-1': {
        pose: 'running fast to the right, leaning well forward, the legs wide apart in a long stride, the arms pumping, the tail streaming out behind.',
      },
      'run-2': {
        pose: 'running fast to the right, leaning well forward, both feet off the ground with the legs gathered under the body, the tail streaming out behind.',
      },
      'air-1': { pose: 'jumping straight up, both arms raised over its head, the legs tucked under it.' },
      'air-2': { pose: 'falling, both arms flung up and out, the legs dangling, the mouth open in alarm.' },
      wall: {
        pose: 'seen from its side, it is sliding down a tall wall on the right edge of the picture (do not draw the wall), its front pressed against it, both palms and one sole flat on it, the other leg hanging, its head turned to look back at us.',
        far: true,
      },
      cheer: { pose: 'cheering, both arms thrown high over its head, up on its toes, a big open grin.' },
      cheer2: { pose: 'jumping for joy with one fist punched straight up into the air, the other arm swinging back.' },
      death: {
        pose: 'it has been knocked out and lies flat on its back on the floor, the whole body horizontal across the picture, head on the left and feet on the right, arms and legs splayed limp, eyes shut. Seen from the side.',
        far: true,
      },
    },
  },

  plumber: {
    body: 223,
    map: {
      roles: ['skin', 'red', 'redshade', 'blue', 'brown', 'tan', 'grey', 'dark'],
      families: [
        ['skin', [253, 195, 153]],
        ['skin', [250, 217, 192]],
        ['skin', [216, 170, 124]],
        ['red', [187, 70, 58]],
        ['redshade', [134, 42, 40]],
        ['redshade', [107, 31, 31]],
        ['redshade', [75, 32, 28]],
        ['blue', [67, 95, 164]],
        ['blue', [54, 68, 108]],
        ['brown', [66, 45, 31]],
        ['brown', [49, 34, 34]],
        ['brown', [70, 47, 33]],
        ['tan', [208, 141, 97]],
        ['tan', [161, 117, 89]],
        ['tan', [139, 85, 64]],
        ['grey', [150, 155, 160]],
        ['grey', [110, 115, 120]],
        ['dark', [10, 4, 4]],
        // The eyes' glints, inside the eyes.
        ['dark', [255, 255, 255]],
      ],
      line: 'dark',
      thin: ['skin', 'red', 'redshade', 'blue', 'brown', 'tan', 'grey'],
      fringe: 5,
      stroke: 2.4,
      feet: ['brown'],
      min: { dark: 0.12, grey: 0.25 },
    },
    roles: [
      { name: 'skin', color: '#efc9a4' },
      { name: 'red', color: '#c9473f', slot: 'player' },
      // The drawing's own shadow on the cap and shirt, and the plunger's cup: a dark of the player's colour.
      { name: 'redshade', color: '#808080', on: 1, tone: -22 },
      // A colourway is the overalls (VARIETY.palette).
      { name: 'blue', color: '#3f62b4', alts: ['#7e848a', '#2f3b5c'], vary: 6 },
      { name: 'brown', color: '#4d3426' },
      { name: 'tan', color: '#b08454' },
      { name: 'grey', color: '#8e8a84' },
      { name: 'dark', color: '#2a1f1a' },
      // Wear on the overalls: a faded patch, and soot.
      { name: 'scuff', color: '#808080', on: 3, tone: 14 },
      { name: 'scorch', color: '#808080', on: 3, tone: -24 },
      { name: 'plaster', color: '#e9d3b0' },
    ],
    slots: [
      { name: 'plaster', vary: 1, options: 2 },
      { name: 'wear', vary: 11, options: 3 },
    ],
    eyes: { role: 'dark', area: [0.2, 2.6], gap: [1.4, 4.5], specks: { dark: 2.8 } },
    wear: {
      on: ['blue'],
      chin: 3,
      marks: [
        [
          ['scuff', 0.5, 0.35, 1.0],
          ['scuff', 0.3, 0.85, 0.8],
        ],
        [
          ['scorch', 0.55, 0.4, 1.1],
          ['scorch', 0.3, 0.82, 0.8],
        ],
      ],
    },
    accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2.2, 0.9] }],
    face: { r: 0.9, iris: '#3c6fd0' },
    gait: { bounce: [0.15, 0.85], lean: [0, 0.035] },
    clips: {
      idle: { frames: ['idle'], loop: true, fps: 1 },
      idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
      walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
      run: { frames: ['run-1', 'run-2'], loop: true, stride: 44 },
      air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200] },
      wall: { frames: ['wall'], loop: true, fps: 1 },
      cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
      cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
      death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
    },
    poses: {
      idle2: { pose: 'standing with his arms folded across his chest, chest puffed out, the plunger leaning against his shoulder.' },
      'walk-1': { pose: 'walking to the right, mid-step: the near boot forward, the far boot back, the plunger over his shoulder.' },
      'walk-2': { pose: 'walking to the right, the legs passing under the body: one boot planted, the other lifted a little, the plunger over his shoulder.' },
      'run-1': {
        pose: 'running fast to the right, leaning forward, one knee high and the other leg pushing off, the free arm pumping, the plunger over his shoulder.',
      },
      'run-2': {
        pose: 'running fast to the right, leaning forward, both boots off the ground with the legs gathered under him, the plunger over his shoulder.',
      },
      'air-1': { pose: 'jumping straight up, one fist punched high over his head, the other hand gripping the plunger, the legs tucked under him.' },
      'air-2': { pose: 'falling, both arms flung up, the plunger still in one hand, the legs reaching down, the mouth open in alarm.' },
      wall: {
        pose: 'seen from his side, he is sliding down a tall wall on the right edge of the picture (do not draw the wall), one glove flat against it and both boots braced on it, the plunger on his back, his head turned to look back at us.',
        far: true,
      },
      cheer: { pose: 'cheering, both fists thrown high over his head, the plunger held up in one of them, up on his toes, a big grin under the mustache.' },
      cheer2: { pose: 'leaning back laughing, turned a little toward us, one hand on his belly, the plunger over his shoulder.' },
      death: {
        pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal across the picture, head on the left and boots on the right, arms and legs splayed limp, eyes shut, the plunger dropped beside him. Seen from the side.',
        far: true,
      },
    },
  },
  hedgehog: {
    body: 229,
    map: {
      roles: ['blue', 'peach', 'red', 'yellow', 'grey', 'brown', 'white', 'dark'],
      families: [
        ['blue', [60, 98, 181]],
        ['blue', [45, 72, 134]],
        ['blue', [47, 63, 107]],
        ['blue', [82, 102, 156]],
        ['blue', [62, 92, 167]],
        ['peach', [247, 188, 131]],
        ['peach', [223, 188, 148]],
        ['peach', [194, 159, 125]],
        ['peach', [239, 191, 125]],
        ['red', [192, 54, 39]],
        ['red', [101, 39, 29]],
        ['yellow', [237, 201, 97]],
        ['grey', [141, 142, 134]],
        ['grey', [70, 67, 72]],
        ['brown', [137, 86, 59]],
        ['brown', [105, 74, 53]],
        ['white', [255, 255, 252]],
        ['dark', [42, 16, 10]],
        ['dark', [59, 31, 23]],
      ],
      line: 'dark',
      thin: ['blue', 'peach', 'red', 'yellow', 'grey', 'brown', 'white'],
      fringe: 5,
      stroke: 2.4,
      feet: ['red', 'grey'],
      min: { dark: 0.12, white: 0.1 },
    },
    roles: [
      { name: 'blue', color: '#2f5bd0', slot: 'player' },
      { name: 'peach', color: '#f0c99c' },
      // A colourway is the sneakers (VARIETY.palette): red, racing green or cream.
      { name: 'red', color: '#d8382f', alts: ['#2f8a57', '#ebe5d6'], vary: 6 },
      { name: 'yellow', color: '#e8c24a' },
      { name: 'grey', color: '#9a9894' },
      { name: 'brown', color: '#7a5236' },
      { name: 'white', color: '#fbf8f2' },
      { name: 'dark', color: '#2a1f1a' },
      { name: 'scuff', color: '#808080', on: 1, tone: 12 },
      { name: 'scorch', color: '#808080', on: 1, tone: -26 },
      { name: 'plaster', color: '#e9d3b0' },
    ],
    slots: [
      { name: 'plaster', vary: 0, options: 2 },
      { name: 'wear', vary: 11, options: 3 },
    ],
    eyes: { role: 'dark', area: [0.08, 1.5], gap: [1, 4.5], specks: { dark: 1.6, white: 4 }, band: [0.1, 0.45], count: 1, pair: [1.8, -0.3] },
    wear: {
      on: ['peach'],
      chin: 3,
      marks: [
        [
          ['scuff', 0.45, 0.55, 0.6],
          ['scuff', 0.55, 0.8, 0.5],
        ],
        [
          ['scorch', 0.45, 0.6, 0.7],
          ['scorch', 0.55, 0.82, 0.5],
        ],
      ],
    },
    accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [2.2, 0.9] }],
    face: { r: 1, iris: '#3a9a46', mouth: [1.4, 2.7] },
    gait: { bounce: [0, 0.45], lean: [0.01, 0.06] },
    clips: {
      idle: { frames: ['idle'], loop: true, fps: 1 },
      idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
      walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
      run: { frames: ['run-1', 'run-2'], loop: true, stride: 48 },
      // The jump is the spin ball, all the way up and down.
      air: { frames: ['air-1', 'air-1b'], loop: true, fps: 12 },
      wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
      cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
      cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.7, 0.3] },
      death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
    },
    poses: {
      idle2: { pose: 'standing with his arms folded across his chest, tapping one toe, smirking.' },
      'walk-1': { pose: 'walking to the right, mid-step: the near sneaker forward, the far one back, the arms swinging the other way.' },
      'walk-2': { pose: 'walking to the right, the legs passing under the body: one sneaker planted, the other lifted a little.' },
      'run-1': {
        pose: 'running flat out to the right, leaning hard forward, the legs a long blur of a stride, the arms swept back, the quills streaming behind.',
      },
      'run-2': {
        pose: 'running flat out to the right, leaning hard forward, both sneakers off the ground with the legs gathered under him, the arms swept back.',
      },
      'air-1': { pose: 'curled up tight into a spinning ball in mid-air, the quills all round the outside, no face showing.', far: true },
      wall: {
        pose: 'seen from his side, he is sliding down a tall wall on the right edge of the picture (do not draw the wall), one glove flat against it and both sneakers braced on it, his head turned to look back at us.',
        far: true,
      },
      cheer: { pose: 'cheering, one fist punched high over his head, a big grin.' },
      cheer2: { pose: 'stretching with both fists high over his head, up on his toes, eyes shut, grinning.' },
      death: {
        pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal across the picture, head on the left and sneakers on the right, arms and legs splayed limp, eyes shut. Seen from the side.',
        far: true,
      },
      'air-1b': { pose: 'curled up tight into a spinning ball in mid-air, the quills all round the outside, no face showing.', far: true },
    },
  },
  elf: {
    body: 144,
    map: {
      roles: ['green', 'darn', 'skin', 'hair', 'brown', 'lid', 'iron', 'dark'],
      families: [
        ['green', [71, 124, 56]],
        ['green', [48, 87, 60]],
        ['green', [68, 118, 58]],
        ['green', [95, 131, 85]],
        ['darn', [169, 193, 119]],
        ['skin', [246, 199, 160]],
        ['skin', [238, 205, 179]],
        ['skin', [181, 130, 99]],
        ['hair', [228, 187, 82]],
        ['hair', [237, 193, 117]],
        ['brown', [107, 70, 52]],
        ['brown', [69, 45, 36]],
        ['brown', [125, 92, 73]],
        ['brown', [77, 57, 50]],
        ['lid', [157, 162, 168]],
        ['lid', [170, 169, 166]],
        ['lid', [121, 110, 109]],
        ['lid', [167, 153, 135]],
        ['dark', [255, 255, 255]],
        ['iron', [40, 44, 46]],
        ['iron', [60, 62, 66]],
        ['dark', [12, 13, 17]],
      ],
      line: 'dark',
      thin: ['green', 'darn', 'skin', 'hair', 'brown', 'lid', 'iron'],
      fringe: 5,
      stroke: 2.4,
      feet: ['brown'],
      loose: ['iron'],
      ink: 5,
      min: { dark: 0.1 },
    },
    roles: [
      { name: 'green', color: '#3f7a34', slot: 'player' },
      { name: 'darn', color: '#5a9a4a' },
      { name: 'skin', color: '#efc9a4' },
      { name: 'hair', color: '#e6c25a' },
      { name: 'brown', color: '#6b4a35' },
      // A colourway is the dustbin lid (VARIETY.palette): galvanised, recycling blue or black plastic.
      { name: 'lid', color: '#a8adb4', alts: ['#5f80a8', '#5a5e66'], vary: 6 },
      { name: 'iron', color: '#4a4a52' },
      { name: 'dark', color: '#2a1f1a' },
      { name: 'scuff', color: '#808080', on: 0, tone: 14 },
      { name: 'scorch', color: '#808080', on: 0, tone: -24 },
      { name: 'plaster', color: '#e9d3b0' },
    ],
    slots: [
      { name: 'plaster', vary: 1, options: 2 },
      { name: 'wear', vary: 11, options: 3 },
    ],
    eyes: { role: 'dark', area: [0.12, 1.8], gap: [1.2, 4.5], specks: { dark: 2 }, band: [0.1, 0.45], count: 1, pair: [1.7, 0] },
    wear: {
      on: ['green'],
      chin: 3,
      marks: [
        [
          ['scuff', 0.6, 0.6, 0.55],
          ['scuff', 0.5, 0.85, 0.45],
        ],
        [
          ['scorch', 0.55, 0.65, 0.6],
          ['scorch', 0.45, 0.88, 0.45],
        ],
      ],
    },
    accessories: [{ slot: 'plaster', role: 'plaster', at: 'cheek', size: [1.9, 0.8] }],
    face: { r: 0.9, iris: '#3c78c8' },
    gait: { bounce: [0.2, 0.8], lean: [0, 0.04] },
    clips: {
      idle: { frames: ['idle'], loop: true, fps: 1 },
      idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
      walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 30 },
      run: { frames: ['run-1', 'run-2'], loop: true, stride: 46 },
      // One jump drawing up and down: his falling ones lost the cap.
      air: { frames: ['air-1'], loop: true, fps: 1 },
      wall: { frames: ['wall'], loop: true, fps: 1, centre: 'box' },
      cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
      cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.7, 0.3] },
      death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
    },
    poses: {
      idle2: { pose: 'standing alert with one hand on his belt, looking off to the side.' },
      'walk-1': { pose: 'walking to the right, mid-step: the near boot forward, the far boot back, the poker in his hand, the arms swinging the other way.' },
      'walk-2': { pose: 'walking to the right, the legs passing under the body: one boot planted, the other lifted a little, the poker in his hand.' },
      'run-1': { pose: 'running fast to the right, striding out long, leaning forward, the poker in his hand, the sock cap streaming out behind.' },
      'run-2': {
        pose: 'running fast to the right, leaning forward, both boots off the ground with the legs gathered under him, the sock cap streaming out behind.',
      },
      'air-1': { pose: 'jumping up with his knees tucked, the poker raised over his head, the sock cap flung up behind.' },
      wall: {
        pose: 'seen from his side, he is sliding down a tall wall on the right edge of the picture (do not draw the wall), one glove flat against it and both boots braced on it, the lid on his back, his head turned to look back at us.',
        far: true,
      },
      cheer: { pose: 'cheering with the poker raised high over his head in one fist, a big grin.' },
      cheer2: { pose: 'holding the dustbin lid up high over his head in both hands like a trophy, grinning.' },
      death: {
        pose: 'he has been knocked out and lies flat on his back on the floor, the whole body horizontal across the picture, head on the left and boots on the right, arms and legs splayed limp, eyes shut, the poker and the lid dropped beside him. Seen from the side.',
        far: true,
      },
    },
  },
  chomper: {
    body: 293,
    map: {
      roles: ['yellow', 'dark', 'grey', 'napkin', 'check'],
      families: [
        ['yellow', [244, 203, 33]],
        ['yellow', [187, 144, 32]],
        ['yellow', [245, 208, 57]],
        ['dark', [41, 28, 20]],
        ['grey', [154, 154, 153]],
        ['napkin', [248, 243, 230]],
        ['check', [166, 61, 39]],
        ['check', [179, 103, 59]],
      ],
      line: 'dark',
      thin: ['yellow', 'grey', 'napkin', 'check'],
      fringe: 5,
      stroke: 2.4,
      // Its open mouth is a gap, not a dark fill: the wedge is the read, in the silhouette above all.
      cut: { role: 'dark', area: 2 },
      feet: ['yellow'],
      min: { dark: 0.1, check: 0.15 },
    },
    roles: [
      { name: 'yellow', color: '#f6d02a', slot: 'player' },
      { name: 'dark', color: '#2a1f1a' },
      { name: 'grey', color: '#9aa0a8' },
      { name: 'napkin', color: '#fbf6ee' },
      // A colourway is the napkin's check (VARIETY.palette): red, blue or green.
      { name: 'check', color: '#c9473f', alts: ['#3f62b4', '#3f8a3a'], vary: 6 },
      { name: 'scuff', color: '#808080', on: 0, tone: 8 },
      // One quiet mark a wear: on a smooth ball, a loud blob reads as a spot.
      { name: 'scorch', color: '#808080', on: 0, tone: -18 },
      { name: 'plaster', color: '#e9d3b0' },
    ],
    slots: [
      { name: 'plaster', vary: 1, options: 2 },
      { name: 'wear', vary: 11, options: 3 },
    ],
    eyes: { role: 'dark', area: [0.08, 1.5], gap: [1, 4], specks: { dark: 0.9 }, count: 1 },
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
      idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
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
      idle2: { pose: 'mouth shut tight into a full round ball with only a line for the mouth, eyeing the floor.' },
      'walk-1': { pose: 'moving to the right with the mouth half open.' },
      'walk-2': { pose: 'moving to the right with the mouth shut to a thin line.' },
      'run-1': { pose: 'racing to the right, tipped forward, the mouth thrown wide open.' },
      'run-2': { pose: 'racing to the right, tipped forward, the mouth snapped shut to a thin line.' },
      'air-1': { pose: 'hopping up into the air, the mouth wide open.' },
      'air-2': { pose: 'falling, tipped back, the mouth open in alarm and the eye wide.' },
      cheer: { pose: 'hopping on the spot with joy, the mouth wide open in a grin.' },
      cheer2: { pose: 'rolling back on itself, tipped over backwards, the mouth thrown wide open, laughing.' },
      death: {
        pose: 'knocked out and squashed flat as a pancake on the floor, an oval much wider than it is tall, the mouth a limp line, the eye shut. Seen from the side.',
        far: true,
      },
    },
  },
  puffball: {
    body: 279,
    // Its seam traced as one long stroke across the ball and its pale highlight as a strip, a mouth at play
    // size; its tape cross beside the eyes read as a third eye: no interior lines, and tape and highlight are the ball.
    map: {
      roles: ['pink', 'red', 'dark'],
      families: [
        ['pink', [244, 154, 179]],
        ['pink', [203, 98, 122]],
        ['pink', [222, 112, 142]],
        ['pink', [179, 105, 124]],
        ['pink', [211, 168, 180]],
        ['red', [190, 64, 57]],
        ['red', [149, 43, 47]],
        ['pink', [184, 176, 178]],
        ['pink', [234, 200, 203]],
        ['dark', [71, 20, 40]],
        ['dark', [33, 4, 15]],
        ['dark', [255, 255, 255]],
      ],
      line: 'dark',
      thin: ['pink', 'red'],
      fringe: 5,
      stroke: 99,
      feet: ['red'],
      min: { dark: 0.35 },
    },
    roles: [
      { name: 'pink', color: '#f2a0bc', slot: 'player' },
      // A colourway is the feet (VARIETY.palette): red, orange or yellow.
      { name: 'red', color: '#c9473f', alts: ['#e07b2c', '#e8b23a'], vary: 6 },
      { name: 'white', color: '#f4efe6' },
      { name: 'dark', color: '#2a1f1a' },
      { name: 'scuff', color: '#808080', on: 0, tone: 8 },
      // One quiet mark a wear: on a smooth ball, a loud blob reads as a spot.
      { name: 'scorch', color: '#808080', on: 0, tone: -18 },
      { name: 'plaster', color: '#e9d3b0' },
    ],
    slots: [
      { name: 'plaster', vary: 0, options: 2 },
      { name: 'wear', vary: 11, options: 3 },
    ],
    eyes: { role: 'dark', area: [0.2, 6], gap: [1.5, 5.5], specks: { dark: 6 } },
    wear: {
      on: ['pink'],
      chin: 3.5,
      marks: [[['scuff', 0.68, 0.78, 1.0]], [['scorch', 0.7, 0.75, 1.1]]],
    },
    accessories: [{ slot: 'plaster', role: 'plaster', at: 'crown', size: [2.4, 0.85] }],
    face: { r: 1, iris: '#2a1f1a', mouth: [2, 2.6], eye: 'tall' },
    gait: { bounce: [0.1, 0.8], lean: [0, 0.03] },
    clips: {
      idle: { frames: ['idle'], loop: true, fps: 1 },
      idle2: { frames: ['idle2', 'idle'], loop: true, holds: [1.8, 2.4] },
      walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 26 },
      run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
      air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200] },
      wall: { frames: ['wall'], loop: true, fps: 1 },
      cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
      cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.7, 0.3] },
      death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
    },
    poses: {
      idle2: { pose: 'looking up, both stubby arms tucked behind it, tapping one foot.' },
      'walk-1': { pose: 'waddling to the right, mid-step: the near foot forward, the far foot back.' },
      'walk-2': { pose: 'waddling to the right, one foot planted, the other lifted a little.' },
      'run-1': { pose: 'running fast to the right, leaning forward, the feet in a long stride, the arms swept back.' },
      'run-2': { pose: 'running fast to the right, leaning forward, both feet off the ground tucked under it.' },
      'air-1': { pose: 'jumping up, both arms raised, the feet tucked under.' },
      'air-2': { pose: 'falling, both arms flung up, the feet dangling, the mouth open in alarm.' },
      wall: {
        pose: 'seen from its side, it is sliding down a tall wall on the right edge of the picture (do not draw the wall), one arm and one foot pressed flat against it, looking back at us.',
        far: true,
      },
      cheer: { pose: 'cheering with both arms thrown up, up on its toes, a big open smile.' },
      cheer2: { pose: 'puffed up even rounder, waving one arm high, a big open smile.' },
      death: { pose: 'knocked out and lying flat on its back on the floor, feet in the air, eyes shut. Seen from the side.', far: true },
    },
  },
};
