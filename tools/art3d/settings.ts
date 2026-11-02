/**
 * A kind's render settings, `art/sprites/<kind>/sprite.json`: everything that turns its checked-in model
 * into the game's traced frames. Shared by the command (tools/art3d/sprites.ts) and the page that renders
 * (tools/art3d/page/), so the two can't disagree.
 */

/** One material of the model as the game paints it. */
export interface Role {
  /** The flat colour, from the kind's palette in docs/CHARACTERS.md. */
  color: string;
  /**
   * Colours this role shows as in the model's texture. Every texel goes to the role of its nearest
   * swatch (in Lab), so the model's painted colour picks the role and never reaches the game.
   */
  swatches: string[];
  /** The game recolours this role: the kind's own colour (`paint`) or the player's (`player`). */
  slot?: 'paint' | 'player';
  /** Drawn as part of another role: a detail too fine to read at race size. */
  into?: string;
  /** The smallest part of this role worth a shape of its own, in world px² (default `trace.min`). */
  min?: number;
  /** A catch-light: an eye. */
  glint?: boolean;
}

/** A clip the game plays, cut from one of the model's animations or keyed from poses. */
export interface Clip {
  /** The animation in the model it's cut from (as named in the GLB)... */
  src?: string;
  /** ...or the keyed poses (`keys`) it runs through, in order. */
  keys?: string[];
  /** The part of the source to sample, as fractions of its length. */
  from?: number;
  to?: number;
  /** Frames to sample, evenly (the end is left out of a loop, since it's the start). */
  frames: number;
  loop: boolean;
  /** Plays at this many frames per second... */
  fps?: number;
  /** ...or advances with distance run: world px of travel per loop, so the feet keep pace with the body. */
  stride?: number;
  /** ...or is posed by vertical speed: the first frame at `vy[0]` px/s (up is negative), the last at `vy[1]`. */
  vy?: [number, number];
  /** Turn the figure back to its facing when the motion spins it round about the vertical. */
  face?: boolean;
  /** `hips`: hold the hips at their rest height (a jump's own lift is the sim's job). */
  pin?: 'hips';
  /** Centre each frame on the spot (a figure lying down). */
  center?: boolean;
  /** Seconds held on each frame instead of an even rate. */
  holds?: number[];
}

/**
 * A pose keyed by hand from the pose sheet: a base (a moment of a model animation, `clip@fraction`, or
 * `rest`), with bones turned about the figure's own axes (degrees: x to its left, so a turn about x swings
 * a limb forward or back; y up; z forward), and the whole figure rolled about the screen (a spin ball).
 */
export interface Key {
  from: string;
  bones?: Record<string, [number, number, number]>;
  roll?: number;
  /** Degrees turned further toward the camera for this pose. */
  yaw?: number;
  /** Bones stretched for this pose (an arm reaching past the head), on top of the caricature. */
  scale?: Record<string, number>;
}

/** Weight on bones matching `from` (a RegExp) held farther than `max` × height from their joint moves to `to`. */
export interface Rebind {
  from: string;
  max: number;
  to: string;
}

/**
 * A signature prop built from primitives and carried by a bone, so its size and place are a setting:
 * the plumber's oversized plunger. Positions and sizes in world px, in the figure's axes at rest.
 */
export interface Prop {
  bone: string;
  at: [number, number, number];
  /** Degrees about the figure's x, y, z. */
  rot: [number, number, number];
  parts: { shape: 'cylinder' | 'cup' | 'sphere'; role: string; size: [number, number, number]; at?: [number, number, number] }[];
}

export interface Settings {
  /** The rigged, animated model, relative to the settings file. */
  model: string;
  /** World px from the soles to the top of the head, standing in the rest pose. */
  height: number;
  /** Degrees the figure turns toward the camera from a pure profile, and the camera looks down. */
  yaw: number;
  pitch: number;
  /** Depth step (world px) that splits one part from another. */
  step: number;
  /** Tracing: px per world px rendered, the smallest part kept (world px²), simplification (world px), smoothing passes. */
  trace: { res: number; min: number; eps: number; smooth: number };
  /** Caricature: bones scaled about their joints (head, hands, feet), for a read at race size. */
  scale?: Record<string, number>;
  /** Weight fixes for the auto-rig, applied in order. */
  rebind?: Rebind[];
  props?: Prop[];
  keys?: Record<string, Key>;
  roles: Record<string, Role>;
  clips: Record<string, Clip>;
}

/** The frame box every pose is rendered in, in world px about the feet (x right, y up). */
export const BOX = { x0: -20, x1: 20, y0: -3, y1: 33 };
