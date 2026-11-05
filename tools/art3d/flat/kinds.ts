import type { FaceKit } from '../../../src/render/cast/sprites/types';
import { readdirSync } from 'node:fs';

/**
 * The flat kinds (docs/CHARACTERS.md → Rendered kinds): for each, its roles in the order
 * they're painted, back to front, the poses its clips are traced from (`art/sprites/<kind>/flat/<name>.png`,
 * `idle` being the design itself), and its variety as data, each in `kinds/<kind>.ts`. `build.ts` reads them.
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
  /**
   * Moves the kit's eyes (world px, x then y) on this clip's frames, after `eyes.drop`: a head tilted in one pose
   * puts the shut eyes on the mouth or the crown's outline.
   */
  shift?: readonly [number, number];
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

type Recolour = { from: string; to: string; below: number; lying: readonly [number, number] };

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
    /**
     * Rounds of corner cutting on every traced outline (default 2): each cuts a quarter off both edges at a
     * corner, which makes a pixel step one confident curve and a cube a ball. 0 for a kind drawn in boxes.
     */
    smooth?: number;
    /** Image px, odd: how thick the ink must be to stay a fill and not a line (default 9; a thin iron poker needs less). */
    ink?: number;
    /** A drawn hole cut out of the figure: each patch of `role` over `area` world px² open to the outside. */
    cut?: { role: string; area: number };
    /**
     * Holes cut through the figure: the drawing's background closed in by it (between an arm and the body,
     * a handle's eye), each patch over this many world px². Off by default: a white body is closed in too.
     */
    holes?: number;
    /**
     * How light (the least of r, g and b) a hole's pixel may be and still count as the background's white (default
     * 228, the border's own test). Lower takes in the antialiased rim round each hole, and the ink beside it goes to
     * the figure instead of leaving a white sliver inside the hole: the cuptoon's white body. A patch is a hole only
     * if most of it passes 228, so a white body, all of it darker, never is.
     */
    white?: number;
  };
  /**
   * Where the face kit goes: the eyes are the pair of `role` specks `area` big (world px²) and `gap` apart,
   * and the specks it draws over (eyes, nose, a drawn mouth) are each role's parts smaller than its number.
   * `count: 1` for one eye (the dot-eater). An eye is never on the outline, where a speck is a scrap of ink.
   * None for a kind without a face (with no `face`).
   */
  eyes?: {
    role: string;
    area: readonly [number, number];
    gap: readonly [number, number];
    specks: Readonly<Record<string, number>>;
    count?: 1;
    /** Where on the figure an eye can be, as fractions of its height from the top (default 0 to 0.5). */
    band?: readonly [number, number];
    /** With `count: 1`, a far eye set this far (world px) from the near one, for a face turned nearly side on. */
    pair?: readonly [number, number];
    /**
     * Moves the kit's eyes this far down (world px) from the drawn ones, after the drawn face is painted over.
     * Eyes drawn tucked under a brim put the kit's shut eyes on the brim's ink, where they vanish.
     */
    drop?: number;
    /**
     * `map`: find the eyes in the role map, before tracing. An eye a few map pixels across (a small face's) is
     * smoothed away by the tracer, so on traced parts only one merged into the ink round it survives.
     */
    from?: 'map';
    /**
     * Pupils drawn as an ink ring round a white glint: the ring is thin, so the map took it for line and the pupil
     * went. Each patch closed in by ink alone, no bigger than this (world px²) and in the `band`, is filled with ink
     * first, and every round lone speck of ink there up to `area`'s top is kept a fill, so a pupil narrower than
     * `map.ink` stays one speck too. Keep it well under an eye white's size.
     */
    glint?: number;
  };
  /**
   * A colour drawn in another role by its place: `below` the eyes (world px), or a lying pose's by size and x
   * (the zapmouse's black cord, which reads as a frown; the plumber's boots apart from his hair). One rule
   * or several, applied in order.
   */
  recolour?: Recolour | readonly Recolour[];
  /**
   * The wear's marks (option 1 scuffed, option 2 scorched), each a role, a spot as fractions of the
   * surface's box, and a radius, on the bare `on` roles below `chin` (world px under the eyes).
   */
  wear: { on: readonly string[]; chin: number; marks: readonly (readonly (readonly [string, number, number, number])[])[] };
  /**
   * On-off accessories drawn as strips from the near eye: a cross on the crown, a plaster across the cheek.
   * `offset` (world px) moves one off its usual place: on a small face the cheek's lands on the jaw or a blush.
   */
  accessories: readonly { slot: string; role: string; at: 'crown' | 'cheek'; size: readonly [number, number]; offset?: readonly [number, number] }[];
  roles: readonly FlatRole[];
  slots: readonly { name: string; vary: number; options: number }[];
  /**
   * The cast's face kit (`FaceKit`); none for a kind with no face to draw (a visor, a jelly). `mark` is the least
   * width of its shut eyes and cheer arcs (world px), for a small eye whose marks would otherwise be a hairline.
   * A face found with `count: 1` and a `pair` is side on, and its far eye is a sliver unless `far` says `none`.
   */
  face?: FaceKit;
  gait: { bounce: readonly [number, number]; lean: readonly [number, number] };
  clips: Readonly<Record<string, FlatClip>>;
  /** Each pose drawing's pose, for `posePrompt` (`far` for one far from the design's). */
  poses: Readonly<Record<string, { pose: string; far?: true }>>;
}

/**
 * Every flat kind, one file a kind in `kinds/` (`kinds/<kind>.ts` exporting `kind`), so kinds made side by
 * side never touch one file.
 */
export const FLAT_KINDS: Record<string, FlatKind> = Object.fromEntries(
  await Promise.all(
    readdirSync(new URL('./kinds/', import.meta.url))
      .filter((f) => f.endsWith('.ts'))
      .map(async (f) => [f.slice(0, -3), ((await import(`./kinds/${f}`)) as { kind: FlatKind }).kind] as const),
  ),
);

/**
 * The face the build ships for a kind: its `face`, with a head found side on (`eyes.count` 1 and a `pair`)
 * drawing its far eye as a sliver unless the kind says otherwise, never as a second full eye beside the near one.
 */
export function kitFace(k: FlatKind): FaceKit | undefined {
  if (!k.face) return undefined;
  return k.eyes?.count === 1 && k.eyes.pair && !k.face.far ? { ...k.face, far: 'sliver' } : k.face;
}
