/**
 * A kind's render settings, `art/sprites/<kind>/sprite.json`: everything that turns its checked-in model
 * into sprites. Shared by the command (tools/art3d/sprites.ts) and the page that renders
 * (tools/art3d/page/), so the two can't disagree.
 */

/** One material of the model as the game paints it: a flat colour with a shading ramp and a pen. */
export interface Role {
  /** The flat colour, from the kind's palette in docs/CHARACTERS.md. */
  color: string;
  /**
   * Colours this role shows as in the model's texture. Every texel goes to the role of its nearest
   * swatch (in Lab), so the model's painted colour picks the role and never reaches the sprite.
   */
  swatches: string[];
  /** Where two roles meet at one depth, the pen belongs to the one on top (the higher number). */
  over?: number;
  /** The game recolours this role: the kind's own colour (`paint`) or the player's (`player`). */
  slot?: 'paint' | 'player';
  /** One tone, unshaded (pupils, a badge). */
  flat?: boolean;
  /** No pen of its own where it meets another role (a mouth line inside the mustache, say). */
  quiet?: boolean;
}

/** A clip the game plays, cut from one of the model's animations. */
export interface Clip {
  /** The animation in the model it's cut from (as named in the GLB). */
  src: string;
  /** The part of the source to sample, as fractions of its length. */
  from?: number;
  to?: number;
  /** Frames to sample, evenly across `from`..`to` (the end is left out of a loop, since it's the start). */
  frames: number;
  loop: boolean;
  /** Plays at this many frames per second... */
  fps?: number;
  /** ...or advances with distance run: world px of travel per loop, so the feet keep pace with the body. */
  stride?: number;
  /** ...or is posed by vertical speed: the first frame at `vy[0]` px/s (up is negative), the last at `vy[1]`. */
  vy?: [number, number];
  /** Also rendered at card scale (the lobby, score and victory screens). */
  card?: boolean;
  /** Turn the figure back to its facing when the motion spins it round about the vertical. */
  face?: boolean;
  /** `hips`: hold the hips at their rest height (a jump's own lift is the sim's job). */
  pin?: 'hips';
  /** Seconds held on each frame instead of an even rate (a hold at an apex, a beat on a landing). */
  holds?: number[];
}

/** Weight on bones matching `from` (a RegExp) held farther than `max` × height from their joint moves to `to`. */
export interface Rebind {
  from: string;
  max: number;
  to: string;
}

export interface Settings {
  /** Weight fixes for the auto-rig, applied in order. */
  rebind?: Rebind[];
  /** The rigged, animated model, relative to the settings file. */
  model: string;
  /** World px from the soles to the top of the head, standing in the rest pose. */
  height: number;
  /** Degrees the figure turns toward the camera from a pure profile, and the camera looks down. */
  yaw: number;
  pitch: number;
  /** Direction the light comes from, in view space (x right, y up, z toward the camera). */
  light: [number, number, number];
  /** N·L above `bands[0]` is the lit tone; above `bands[1]` the base; below it the shade. */
  bands: [number, number];
  /** Each tone as a multiple of the role's colour: lit, base, shade. Scalars, so a recolour is exact. */
  tones: [number, number, number];
  /** The pen, in world px: silhouette width toward the light and away from it, and interior lines. */
  ink: { lit: number; shadow: number; interior: number; mix: number };
  /** Shading normals are smoothed over this share of the height, so the bands follow the big forms. */
  smooth: number;
  /** Depth step (world px) that counts as one part passing in front of another. */
  step: number;
  roles: Record<string, Role>;
  clips: Record<string, Clip>;
  /** Sprite px per world px: in a race, and on cards. */
  scales: { play: number; card: number };
  /** Supersampling per axis before the downsample. */
  ss: number;
}

/** The frame box every sprite is cut from, in world px about the feet (x right, y up). */
export const BOX = { x0: -20, x1: 20, y0: -3, y1: 33 };

/** Near-black ink for marks with no one colour under them (docs/ART.md, `INK` in src/render/ink.ts). */
export const INK = '#2a1c15';
