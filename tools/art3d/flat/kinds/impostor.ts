import type { FlatKind } from '../kinds';

/**
 * The silhouette is the read: a bean, a visor bump out of its front, a slab on its back with background
 * between. The image model draws the can flush on the bean and the visor inside its outline whatever the
 * brief says, so design.png is the worn drawing edited by hand (a PIL script): the visor moved 45 px out past
 * the front, the can taken off the back, widened 1.6×, moved 55 px back and 30 down, and joined by a short
 * strap. The poses, drawn with it as the reference, kept both. In run-1 and run-2 the swung leg touched the
 * can's foot and closed a pocket of background, which would trace as a white patch: a white channel opens it again.
 * The visor's crack is painted out of every drawing (its dark lines filled with the glass round them, leaving
 * only the crack's pale edge, which folds into the glass): traced, its zigzag under the glint read as a frown.
 */
export const kind: FlatKind = {
  body: 241,
  map: {
    roles: ['can', 'cap', 'body', 'tan', 'visor', 'vshade', 'glint', 'dark'],
    families: [
      ['body', [87, 167, 73]],
      ['body', [50, 131, 64]],
      ['body', [98, 155, 86]],
      // The hammered dent's pale patch folds into the suit: drawn flat, it would be a second colour on it.
      ['body', [149, 190, 119]],
      ['body', [184, 198, 163]],
      ['visor', [172, 218, 229]],
      ['vshade', [120, 172, 193]],
      ['vshade', [135, 177, 173]],
      ['glint', [252, 253, 253]],
      ['can', [175, 64, 56]],
      ['can', [140, 45, 40]],
      ['cap', [236, 196, 81]],
      ['tan', [226, 190, 138]],
      ['dark', [29, 21, 16]],
      ['dark', [60, 30, 25]],
    ],
    line: 'dark',
    thin: ['can', 'cap', 'body', 'tan', 'visor', 'vshade', 'glint'],
    fringe: 5,
    stroke: 2.4,
    // No eyes or other dark fills: every dark is the line, even the thick seam between the suit and the can.
    ink: 21,
    feet: ['body'],
    // The can's handle hole and the loop of its spout are white like the visor's glint, and read as a second
    // face's eye on the pack: the hole is cut through where it's open to the outside, and what's left of
    // them (the spout's loop, the hole closed in by the bean on the floor) is smaller than the glint and folds
    // into the can.
    cut: { role: 'glint', area: 0.4 },
    // The glint folds into the glass: a small white part inked round in the dark of white is an eye, and its
    // pen beside the tape was its pupil. The crack's pale edge, as a sliver of shade, folds in too.
    min: { dark: 0.12, glint: 99, vshade: 0.8 },
  },
  roles: [
    // A colourway is the jerrycan (VARIETY.palette): fuel red, army olive or bare steel.
    { name: 'can', color: '#c9473f', alts: ['#6b7340', '#8e949a'], vary: 6 },
    { name: 'cap', color: '#e8c24a' },
    { name: 'body', color: '#5aa84a', slot: 'player' },
    // The tape over the visor's crack, as silver duct tape: in the strap's pale tan it was the farm's own
    // colour, and read as the background cutting a notch into the visor; as brown packing tape, a brow.
    { name: 'tan', color: '#d3d8dc' },
    // The strap, drawn in the tape's colour and told from it by where it is (`recolour`): pale, so the pack
    // still stands off the bean with background between.
    { name: 'strap', color: '#d9c79a' },
    { name: 'visor', color: '#a9dbe8' },
    { name: 'vshade', color: '#6aa6ba' },
    { name: 'glint', color: '#ffffff' },
    { name: 'dark', color: '#2a1f1a' },
    // Wear on the suit, in tones of the player's colour: a rubbed patch, and soot. One quiet mark a wear: on a
    // smooth bean two dark blobs read as spots.
    { name: 'scuff', color: '#808080', on: 2, tone: 10 },
    { name: 'scorch', color: '#808080', on: 2, tone: -16 },
    { name: 'note', color: '#f4e38a' },
  ],
  slots: [
    { name: 'note', vary: 1, options: 2 },
    { name: 'wear', vary: 11, options: 3 },
  ],
  // No face: the visor is its face, drawn as it is, and no face kit draws over it. The tape is found as the
  // one "eye" only so the build has a place to set the sticky note from and the wear's chin; with no `face`,
  // nothing is drawn on it.
  eyes: { role: 'tan', area: [0.3, 8], gap: [99, 99], specks: {}, count: 1, band: [0.17, 0.6] },
  wear: {
    on: ['body'],
    chin: 2.5,
    marks: [[['scuff', 0.6, 0.62, 1.1]], [['scorch', 0.62, 0.7, 1.0]]],
  },
  // The tan below the visor is the strap.
  recolour: { from: 'tan', to: 'strap', below: 3, lying: [99, 0] },
  // A sticky note on the visor, small enough to leave the visor its read.
  accessories: [{ slot: 'note', role: 'note', at: 'cheek', size: [1.5, 1.3] }],
  gait: { bounce: [0.1, 0.6], lean: [0, 0.03] },
  clips: {
    idle: { frames: ['idle'], loop: true, fps: 1 },
    // The image model won't move a bean off the design's stance (four tries came back as the idle): its second idle
    // is the design rocked back 8° on its rear heel (a PIL rotate about that heel), an impatient rock looking up.
    idle2: { frames: ['idle2', 'idle'], loop: true, holds: [0.9, 2.4] },
    walk: { frames: ['walk-1', 'walk-2'], loop: true, stride: 26 },
    run: { frames: ['run-1', 'run-2'], loop: true, stride: 40 },
    // The can held off its back makes it wide: in the air, where the drawer stretches it most, a touch smaller.
    air: { frames: ['air-1', 'air-2'], loop: false, vy: [-200, 200], scale: 0.96 },
    wall: { frames: ['wall'], loop: true, fps: 1 },
    cheer: { frames: ['cheer', 'idle'], loop: true, holds: [0.5, 0.25] },
    cheer2: { frames: ['cheer2', 'idle'], loop: true, holds: [0.6, 0.3] },
    death: { frames: ['death'], loop: false, fps: 1, eyes: false, centre: 'box' },
  },
  poses: {
    'walk-1': { pose: 'waddling to the right, mid-step: the near stubby leg forward, the far leg back, the whole bean rocking forward onto the front leg.' },
    'walk-2': { pose: 'waddling to the right, the legs passing under the bean: one stubby leg planted, the other lifted a little, the bean rocking back.' },
    'run-1': { pose: 'running fast to the right, the whole bean leaning well forward, the stubby legs wide apart in a long stride.' },
    'run-2': { pose: 'running fast to the right, the whole bean leaning well forward, both stubby legs off the ground and gathered under it.' },
    'air-1': { pose: 'jumping straight up, the bean stretched a little tall, both stubby legs tucked up under it.' },
    'air-2': { pose: 'falling, the bean tipped back a little in alarm, both stubby legs dangling apart.' },
    wall: {
      pose: 'seen from its side, it is sliding down a tall wall on the right edge of the picture (do not draw the wall), the front of the bean and its visor pressed against it, both stubby feet braced flat on it, the jerrycan on its back away from the wall.',
      far: true,
    },
    cheer: { pose: 'hopping for joy on the spot, both stubby legs off the ground, the bean tipped back happily.' },
    cheer2: { pose: 'hopping on one stubby leg, the whole bean leaning far back and over with glee, the other leg kicked high up in front of it.' },
    death: {
      pose: 'it has been knocked out and lies flat on its side on the floor, the whole bean horizontal across the picture, the visor on the right and the stubby legs limp on the left, the jerrycan still strapped on its back. Seen from the side.',
      far: true,
    },
  },
};
