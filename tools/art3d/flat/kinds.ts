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
  /** `box`: centred on the figure, for a pose not standing on its feet (lying knocked out). */
  centre?: 'box';
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

export interface FlatKind {
  /** World px square of the body (every role but the tail) in every pose: the design's at 21 px tall. */
  body: number;
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
};
