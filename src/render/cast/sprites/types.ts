/**
 * The shape of a kind's rendered sprites (tools/art3d): generated `frames.ts` modules fill it, and
 * `src/render/cast/sprites` plays it.
 */

/** A frame in its atlas: x, y, w, h, then where the feet are inside that rect (sprite px). */
export type FrameRect = readonly [number, number, number, number, number, number];

export interface SpriteClip {
  loop: boolean;
  /** Plays at this rate... */
  fps?: number;
  /** ...or advances with distance: world px of travel per loop, so the feet keep pace. */
  stride?: number;
  /** ...or is posed by vertical speed: the first frame at `vy[0]` px/s, the last at `vy[1]`. */
  vy?: readonly [number, number];
  /** Seconds on each frame, instead of an even rate. */
  holds?: readonly number[];
  /** Facing right and facing left: each facing is rendered from the model, so the light stays up-left. */
  r: readonly FrameRect[];
  l: readonly FrameRect[];
}

/** One atlas at one scale. */
export interface SpriteSheet {
  /** Sprite px per world px. */
  scale: number;
  w: number;
  h: number;
  /** The toned, inked colour atlas. */
  png: string;
  /** Same layout, opaque: R is how much of each pixel is the `paint` slot's colour, G the `player` slot's (× 200). */
  mask: string;
  clips: Readonly<Record<string, SpriteClip>>;
}

export interface SpriteSet {
  kind: string;
  /** World px from soles to the top of the head at rest. */
  height: number;
  /** The colour each recolourable slot was rendered in (hex). */
  slots: Readonly<Partial<Record<'paint' | 'player', string>>>;
  /** Every clip, at race scale. */
  play: SpriteSheet;
  /** The clips the lobby, score and victory screens show, at card scale. */
  card: SpriteSheet | null;
}
