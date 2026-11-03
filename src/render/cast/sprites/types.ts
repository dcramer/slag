/**
 * The shape of a kind rendered from 3D (tools/art3d): generated `frames.ts` modules fill it, and
 * `src/render/cast/sprites` draws it. A frame is the figure cut into flat parts, traced and simplified,
 * so the game fills and inks it with the cast's own pen at whatever size it's shown.
 */

/**
 * An outline: x, y pairs in eighths of a world px about the feet (y down), as little-endian int16s in
 * base64, so a kind's frames are one compact string per shape (`ringPoints` decodes it).
 */
export type Ring = string;

export interface VFrame {
  /** The silhouette's outer outlines. */
  sil: readonly Ring[];
  /** Parts back to front: the role and its outline, then, for an accessory, its slot and option. */
  parts: readonly (readonly [number, Ring] | readonly [number, Ring, number, number])[];
  /** The eyes the face is drawn on: x, y, radius in eighths of a world px, the near eye first. */
  eyes?: readonly number[];
  /**
   * The head the eyes ride: its middle and radius in eighths of a world px, and its tilt in degrees
   * (clockwise on screen), so brows, crosses and the mouth turn with it.
   */
  head?: readonly number[];
  /** Open pen strokes drawn over the figure (a spin ball's motion marks). */
  marks?: readonly Ring[];
  /**
   * The drawing's own interior lines, where one form overlaps another of the same colour (an arm over the
   * body, the gap between the legs, a mouth): open strokes, each with the role it lies on, inked in that
   * role's pen. Without them a figure in one colour is one shape.
   */
  lines?: readonly (readonly [number, Ring])[];
}

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
  r: readonly VFrame[];
  l: readonly VFrame[];
}

/** One material, as the game paints it. */
export interface SpriteRole {
  /** The roster's flat colour (hex), unless a slot moves it. */
  color: string;
  /** Drawn in the kind's own colour (`paint`) or the player's (`player`). */
  slot?: 'paint' | 'player';
  /**
   * Other colours it may take, rolled per character from \`vary[vary]\`: a designed alternate palette
   * (`VARIETY.palette` in play.ts) or an accessory's colour. Roles that share a roll and have as many
   * alts move together, so a colourway (a shoe and its sole) is picked whole.
   */
  alts?: readonly string[];
  vary?: number;
  /** Painted as role \`on\` is on this character, \`tone\` lighter (or darker, negative): a wear mark on its surface. */
  on?: number;
  tone?: number;
}

/**
 * A swappable accessory: \`options\` props, one rolled per character from \`vary[vary]\`. The slot named
 * \`wear\` is the kind's wear: clean, scuffed and scorched.
 */
export interface SpriteSlot {
  vary: number;
  options: number;
  name?: string;
}

/**
 * How far a character's gait may differ from its kind's, rolled per character: the extra bounce on each
 * step (world px) and the forward lean (a skew about the feet, x per px of height), each from its low to
 * its high bound. Held under `GAIT_MAX` in play.ts.
 */
export interface SpriteGait {
  bounce: readonly [number, number];
  lean: readonly [number, number];
}

export interface SpriteSet {
  kind: string;
  /** World px from soles to the top of the head at rest. */
  height: number;
  roles: readonly SpriteRole[];
  slots?: readonly SpriteSlot[];
  /** The cast's face kit over the traced eyes: eye size (world px), iris, and the mouth's place from the near eye. */
  face?: { r: number; iris: string; mouth?: readonly [number, number]; eye?: 'tall' | 'dot' };
  gait?: SpriteGait;
  /**
   * Traced from a flat illustration rather than a 3D render: its parts are the drawing's own shapes, so
   * they're filled flat under a light pen, with no ink mass or shade sliver of their own.
   */
  flat?: boolean;
  /** By the name `play.ts` reads (`idle`, `run`, …); `idle2`, `cheer2` are a clip's alternates, one picked per character. */
  clips: Readonly<Record<string, SpriteClip>>;
}
