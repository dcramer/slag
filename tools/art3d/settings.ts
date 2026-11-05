/**
 * A kind's render settings, `art/sprites/<kind>/sprite.json`: everything that turns its checked-in model
 * into the game's traced frames. Shared by the command (tools/art3d/sprites.ts) and the page that renders
 * (tools/art3d/page/), so the two can't disagree.
 */

/** One material of the model as the game paints it. */
export interface Role {
  /** The flat colour, from the kind's palette in docs/characters/<kind>.md. */
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
  /** Its parts are the eyes the face kit draws on (the two biggest). */
  glint?: boolean;
  /** Where on the figure an eye can be, as fractions of its height from the top (default 0 to 0.4): below a cap's goggles. */
  band?: [number, number];
  /**
   * Drawn bigger than the model, about the part's back edge (x) and middle (y): a caricature of the trait
   * that carries the read (the plumber's cap bill and nose).
   */
  grow?: [number, number];
  /**
   * Other colours this role may take, one rolled per character from \`vary[vary]\` (src/gen/character.ts),
   * so the same seed always wears the same. The kind's alternate palette is 2–3 designed colourways on one
   * secondary region (never the costume, skin, eyes or face), on \`vary\` 6 (\`VARIETY.palette\`, the
   * default); roles sharing it with as many alts change together (a shoe and its sole). An accessory's
   * colour takes its own roll.
   */
  alts?: string[];
  vary?: number;
  /**
   * A wear mark's paint: the colour role \`on\` wears on this character (its alternate palette too),
   * \`tone\` lighter or, negative, darker. A scuff is a pale tone of the cloth it's on; soot a dark one.
   */
  on?: string;
  tone?: number;
  /** Not part of the silhouette: a swappable prop's own role, inked on its own. */
  free?: boolean;
}

/** A clip the game plays, cut from one of the model's animations or keyed from poses. */
export interface Clip {
  /** The animation in the model it's cut from (as named in the GLB)... */
  src?: string;
  /** ...or the keyed poses (`keys`) it runs through, in order. */
  keys?: string[];
  /** ...or is the kind's spin ball (`ball`), turned through its frames. */
  ball?: boolean;
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
  /** This clip's girth, if not the kind's (a figure lying down is long enough already). */
  girth?: number;
  /** Centre each frame on the spot (a figure lying down). */
  center?: boolean;
  /** Seconds held on each frame instead of an even rate. */
  holds?: number[];
}

/**
 * An aim: where a bone points (from its joint to the next), in degrees in the figure's space, the same on
 * either side of the figure (page/keys.ts), whatever the base pose and the bones above it do: `raise` up
 * from straight down (90 level, 180 overhead), in the plane `out` round from straight ahead toward its own
 * side (0 in front, 90 out to its side, 180 behind, negative across the body), then `twist` about its own
 * length, turning its front out.
 */
export interface Limb {
  raise?: number;
  out?: number;
  twist?: number;
}

/** A bone's entry in a key: a turn, `[x, y, z]` degrees about the figure's own axes, or an aim. */
export type Turn = [number, number, number] | Limb;

/**
 * A pose keyed by hand from the pose sheet: a base (a moment of a model animation, `clip@fraction`, or
 * `rest`), with bones turned about the figure's own axes (page/keys.ts: x to its left, y up, z forward;
 * a negative turn about x swings a hanging limb forward), and the whole figure rolled about the screen
 * (a spin ball).
 */
export interface Key {
  from: string;
  bones?: Record<string, Turn>;
  roll?: number;
  /** Degrees turned further toward the camera for this pose. */
  yaw?: number;
  /** Bones stretched for this pose (an arm reaching past the head), on top of the caricature. */
  scale?: Record<string, number>;
  /**
   * The key to pose instead facing left, for a rig whose sides differ, where facing left can't be this
   * pose's mirror image (the plumber's left hand joint sits mid-forearm, so his right arm raises the fist
   * on both facings).
   */
  l?: string;
}

/**
 * A spin ball drawn as the genre draws it (page/ball.ts): `r` world px round, centred `at` px above the
 * feet, `quills` swept back, reaching `reach` × r; painted in the `body`, `belly` and `shoe` roles.
 */
export interface Ball {
  r: number;
  at: number;
  quills: number;
  reach: number;
  body: string;
  belly: string;
  shoe: string;
}

/**
 * The cast's face kit drawn over the eyes (src/render/cast/sprites/face.ts): eye size in world px, the
 * iris colour, and where the mouth sits from the near eye (world px, facing right, head upright), if it
 * shows. The eyes are found once on the rest pose and ride the head bone through every frame (render.ts).
 */
export interface Face {
  r: number;
  iris: string;
  mouth?: [number, number];
  /** `tall`: tall black ovals with a shine at the top and no whites (the puffball's); `dot`: small round black eyes with a shine (the electric mouse's). Either replaces the cartoon eyes. */
  eye?: 'tall' | 'dot';
  /**
   * Where the eyes go when the model's own are too small to find: from the biggest part of `role` (the
   * nose), the near eye's offset in world px on the rest pose facing right. The far eye is its mirror
   * across the head; `far` is used only by a kind with no head bone.
   */
  anchor?: { role: string; near: [number, number]; far?: [number, number] };
  /**
   * The model's own eye roles the drawn face replaces, each with the role it's drawn as instead (the
   * skin it sits on): the rest pose still traces them, to find where the eyes are.
   */
  covers?: Record<string, string>;
  /** The eyes' distance from the head's middle, as a multiple of the model's own (default 1). */
  spread?: number;
  /** The bone the face rides (default `head`, else the first bone named like it). */
  bone?: string;
}

/**
 * A role split by place: texels of role `from` inside `box` (fractions of the bind pose's bounds: x to the
 * figure's left, y up, z forward) are drawn as role `to`. The plumber's nose and cap are the shirt's red;
 * a region makes them parts of their own, so they can be drawn bigger (`grow`).
 */
export interface Region {
  from: string;
  to: string;
  box: [number, number, number, number, number, number];
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
  parts: {
    shape: 'cylinder' | 'cup' | 'sphere' | 'box' | 'prism';
    role: string;
    size: [number, number, number];
    /**
     * A `prism`'s outline in the figure's side plane (z forward, y up, world px), extruded `size[0]` across
     * x: a flat cut shape whose corners must stay sharp (the electric mouse's tin bolt).
     */
    points?: [number, number][];
    at?: [number, number, number];
    rot?: [number, number, number];
    /**
     * On this bone instead of the prop's, placed from its joint in the figure's axes (not the prop's
     * \`at\` and \`rot\`): one wear option's marks on the knee, the boot and the sleeve.
     */
    bone?: string;
    /**
     * A wear mark stuck on the skin: from \`at\` (a point inside the limb) out along this direction to the
     * model's surface, flat against it; \`size\` is its width, height and thickness, and \`rot\`'s third
     * angle spins it. Marks go on the body, the limbs and the shoes, never the head.
     */
    face?: [number, number, number];
  }[];
  /**
   * A swappable accessory: props sharing a \`slot\` are its options, one rolled per character from
   * \`vary[slots[slot]]\`. Each option renders in a pass of its own and its parts are tagged, so the game
   * draws the one the character rolled. Their roles are their own, and \`free\` (off the silhouette).
   */
  slot?: string;
}

/**
 * A limbless kind has no model (README → Non-humanoid kinds): `by` names its generator in page/shapes.ts,
 * which draws every clip as shapes in the roles' colours, `r` world px round.
 */
export interface Shape {
  by: string;
  r: number;
}

export interface Settings {
  /** The rigged, animated model, relative to the settings file: none for a kind drawn by a `shape` generator. */
  model?: string;
  shape?: Shape;
  /** World px from the soles to the top of the head, standing in the rest pose. */
  height: number;
  /** Degrees the figure turns toward the camera from a pure profile, and the camera looks down. */
  yaw: number;
  pitch: number;
  /** Depth step (world px) that splits one part from another. */
  step: number;
  /** Tracing: px per world px rendered, the smallest part kept (world px²), simplification (world px), smoothing passes. */
  trace: { res: number; min: number; eps: number; smooth: number };
  /** Drawn this much wider than the model, about the feet: a 2D caricature of a stout build. */
  girth?: number;
  /** Caricature: bones scaled about their joints (head, hands, feet), for a read at race size. */
  scale?: Record<string, number>;
  /** Weight fixes for the auto-rig, applied in order. */
  rebind?: Rebind[];
  props?: Prop[];
  /**
   * Each accessory slot's roll: an index into the character's \`vary\`. The slot \`wear\` (on \`vary\`
   * 11, \`VARIETY.wear\`) is the kind's wear, three props: clean (empty), scuffed and scorched, small
   * marks on the body and never on the face.
   */
  slots?: Record<string, number>;
  /**
   * How far one character's gait may differ from another's (\`SpriteGait\` in
   * src/render/cast/sprites/types.ts): the extra bounce on each step in world px and the forward lean as
   * a skew, each a [low, high] range rolled per character, under \`GAIT_MAX\`.
   */
  gait?: { bounce: [number, number]; lean: [number, number] };
  keys?: Record<string, Key>;
  regions?: Region[];
  ball?: Ball;
  face?: Face;
  roles: Record<string, Role>;
  clips: Record<string, Clip>;
}

/** The frame box every pose is rendered in, in world px about the feet (x right, y up). */
export const BOX = { x0: -20, x1: 20, y0: -3, y1: 33 };
