import { type HSL, shift } from '../../../core/color';
import type { CharacterDef, Kind } from '../../../gen/character';
import { type Figure, inkOf, lookOf, moodOf, type RunnerPose, ratio } from '../../ink-figure';
import { drawFrame, hexHsl, type Paint, paintOf } from './draw';
import { gaitAt, pick, roll, type Variety, varietyOf } from './play';
import type { SpriteSet } from './types';

/**
 * Kinds drawn from art (tools/art3d, docs/CHARACTERS.md → Rendered kinds): a kind with frames is
 * always drawn from them, and one without keeps its hand-drawn body. Each kind's frames are a chunk of
 * their own, fetched the first time a character of that kind is drawn, which draws hand-drawn for the
 * few frames until it arrives. `slagDebug.sprites.use(false)` draws the hand-drawn bodies instead, for
 * the comparison sheets in `pnpm shot sprites` only.
 */
export const LOADERS: Partial<Record<Kind, () => Promise<{ sprites: SpriteSet }>>> = {
  plumber: () => import('./plumber/frames'),
  impostor: () => import('./impostor/frames'),
  hedgehog: () => import('./hedgehog/frames'),
  jelly: () => import('./jelly/frames'),
  chomper: () => import('./chomper/frames'),
  puffball: () => import('./puffball/frames'),
  zapmouse: () => import('./zapmouse/frames'),
  elf: () => import('./elf/frames'),
  goose: () => import('./goose/frames'),
};

const loaded: Partial<Record<Kind, SpriteSet>> = {};
const asked: Partial<Record<Kind, Promise<void>>> = {};
let on = true;

/** Fetches a kind's frames once; until they arrive, its characters draw hand-drawn. */
function request(kind: Kind): Promise<void> {
  const load = LOADERS[kind];
  if (!load) return Promise.resolve();
  return (asked[kind] ??= load().then((m) => {
    loaded[kind] = m.sprites;
  }));
}

/** Debug only (shots): resolves once every rendered kind's frames are in, so a sheet drawn after it shows none of them hand-drawn. */
export function spritesReady(): Promise<void> {
  return Promise.all(SPRITE_KINDS.map(request)).then(() => {});
}

/** Debug only (comparison sheets): false draws every kind hand-drawn. Loads every kind's frames when on. */
export function useSprites(v: boolean) {
  on = v;
  if (v) for (const kind of SPRITE_KINDS) void request(kind);
}

export const spritesOn = () => on;

/** The kinds that have rendered frames. */
export const SPRITE_KINDS = Object.keys(LOADERS) as Kind[];

/** This character's rendered frames, once its kind's have loaded (asking for them the first time). */
export function spritesOf(c: CharacterDef): SpriteSet | null {
  if (!on) return null;
  const set = loaded[c.kind];
  if (!set) void request(c.kind);
  return set ?? null;
}

interface Dressed {
  paints: Paint[];
  /** What the character's rolls pick from its kind's variety: accessories, wear, idle, cheer, gait. */
  v: Variety;
  body: Paint;
  shadow: string;
  k: number;
}

const dressed = new WeakMap<CharacterDef, Dressed>();

/**
 * Each role's colour on a character: its slot's colour, its rolled palette, or the roster's; a wear mark
 * in a tone of the role it sits on. Without a character, the roster's colours (the art3d sheets).
 */
export function coloursOf(set: SpriteSet, c?: CharacterDef): HSL[] {
  const colour = (r: SpriteSet['roles'][number]) => (r.alts && c ? [r.color, ...r.alts][roll(c.vary[r.vary ?? 0], r.alts.length + 1)] : r.color);
  const hsl = set.roles.map((r): HSL => (c && r.slot === 'paint' ? c.paint : c && r.slot === 'player' ? c.body : hexHsl(colour(r))));
  set.roles.forEach((r, i) => {
    if (r.on !== undefined) hsl[i] = shift(hsl[r.on], r.tone ?? 0);
  });
  return hsl;
}

/**
 * The hard shadow's multiply, from the main colour. It falls across every part, shoes and gloves too, so
 * it darkens them without the main colour's hue, which would tint a white sole the player's colour.
 */
export function shadowOf(main: HSL): string {
  const grey = { h: main.h, s: Math.min(main.s, 8), l: main.l };
  return ratio(grey, shift(grey, -14));
}

/** Each role's paint for this character, and its variety. Built once per character. */
function dress(set: SpriteSet, c: CharacterDef): Dressed {
  let d = dressed.get(c);
  if (!d) {
    const hsl = coloursOf(set, c);
    const paints = set.roles.map((_, i) => paintOf(hsl[i]));
    // The silhouette is inked in a dark of its main colour: the player's, where the costume wears it (an
    // alternate costume, as a fighting game's roster does), else the kind's own.
    const main = hsl[[set.roles.findIndex((r) => r.slot === 'player'), set.roles.findIndex((r) => r.slot === 'paint')].find((i) => i >= 0) ?? 0];
    d = {
      paints,
      v: varietyOf(set, c.vary),
      body: { ...paintOf(main), ink: inkOf(main) },
      shadow: shadowOf(main),
      k: lookOf(c, false).weight,
    };
    dressed.set(c, d);
  }
  return d;
}

/**
 * The character in its kind's roster colour, where the costume otherwise wears the player's: the look a
 * stranger should name, for the "is it the homage?" sheet. Unchanged until the kind's frames are in.
 */
export function rosterLook(c: CharacterDef): CharacterDef {
  const role = loaded[c.kind]?.roles.find((r) => r.slot === 'player');
  return role ? { ...c, body: hexHsl(role.color) } : c;
}

/** A character's variety, as the drawer picks it (the shot sheets label it). */
export const varietyFor = (set: SpriteSet, c: CharacterDef): Variety => dress(set, c).v;

/**
 * Draws the body with its feet at the origin of the current transform (the caller has applied the
 * runner's position, scale and squash). False when the kind has no frame for the pose.
 */
/**
 * Each drawn frame is kept as a bitmap, per character, boil step, mood and scale: drawing the shapes with
 * the pen is several times a hand-drawn runner's cost, and a runner shows the same few frames over and
 * over. The scale is bucketed to quarter octaves, so a zoom draws fresh only when it changes a step; the
 * squash and stretch are applied to the bitmap as a transform. Bitmaps are kept up to a pixel budget,
 * oldest first out.
 */
interface Cached {
  cv: HTMLCanvasElement;
  /** Where the feet are in it, and its px per world px. */
  ax: number;
  ay: number;
  px: number;
}

const cache = new Map<string, Cached>();
const ids = new WeakMap<object, number>();
let nextId = 1;
const idOf = (o: object) => {
  let i = ids.get(o);
  if (i === undefined) ids.set(o, (i = nextId++));
  return i;
};
let cachedPixels = 0;
/** About 24 MB of bitmaps. */
const PIXEL_BUDGET = 6_000_000;
/** World px the frame box reaches from the feet, pen included. */
const REACH = { x0: -19, x1: 19, y0: -34, y1: 3 };

function bitmap(key: string, px: number, paint: (g: CanvasRenderingContext2D) => void): Cached {
  const got = cache.get(key);
  if (got) {
    // Most recently used goes to the back of the line.
    cache.delete(key);
    cache.set(key, got);
    return got;
  }
  const w = Math.ceil((REACH.x1 - REACH.x0) * px);
  const h = Math.ceil((REACH.y1 - REACH.y0) * px);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  g.translate(-REACH.x0 * px, -REACH.y0 * px);
  g.scale(px, px);
  paint(g);
  const made = { cv, ax: -REACH.x0 * px, ay: -REACH.y0 * px, px };
  cache.set(key, made);
  cachedPixels += w * h;
  for (const [k, v] of cache) {
    if (cachedPixels <= PIXEL_BUDGET) break;
    cache.delete(k);
    cachedPixels -= v.cv.width * v.cv.height;
  }
  return made;
}

/**
 * Draws the body with its feet at the origin of the current transform (the caller has applied the
 * runner's position, scale and squash). `px` is screen px per world px before the squash: the scale the
 * frame's bitmap is drawn at. `figures`, if given, gets the bitmap as drawn. False when the kind has no
 * frame for the pose.
 */
export function drawSprite(s: CanvasRenderingContext2D, set: SpriteSet, c: CharacterDef, p: RunnerPose, x: number, px?: number, figures?: Figure[]): boolean {
  const d = dress(set, c);
  const got = pick(set, p, x, d.v);
  if (!got) return false;
  const mood = p.dead !== undefined ? ('dead' as const) : moodOf(p);
  const face = set.face ? { kit: set.face, mood, facing: got.facing } : undefined;
  const t = p.t;
  const seed = c.seed & 0xffff;
  const draw = (g: CanvasRenderingContext2D) => drawFrame(g, got.frame, d.paints, d.body, d.shadow, d.k, seed, t, face, d.v.pick, set.flat);
  // The character's own gait: a lift on each step and a lean, a skew about the feet the way it faces.
  const gait = gaitAt(set, d.v, got.clip, x);
  const moved = gait.dy !== 0 || gait.lean !== 0;
  if (moved) {
    s.save();
    s.transform(1, 0, -gait.lean * got.facing, 1, 0, gait.dy);
  }
  if (!px || px > 24) draw(s);
  else {
    // The things that change a frame's drawing: its boil step, the face's mood and a blink.
    const boil = Math.floor(t * 8) % 3;
    const blink = mood === 'idle' && Math.sin(t * 1.3 + seed * 7) > 0.985;
    const bucket = 2 ** (Math.ceil(Math.log2(px) * 4) / 4);
    const key = `${idOf(d)}:${idOf(got.frame)}:${boil}:${mood}:${blink ? 1 : 0}:${bucket}`;
    const b = bitmap(key, bucket, draw);
    s.drawImage(b.cv, -b.ax / b.px, -b.ay / b.px, b.cv.width / b.px, b.cv.height / b.px);
    figures?.push({ cv: b.cv, m: s.getTransform(), x: -b.ax / b.px, y: -b.ay / b.px, w: b.cv.width / b.px, h: b.cv.height / b.px });
  }
  if (moved) s.restore();
  return true;
}

export { pick, type Variety } from './play';
export type { SpriteSet } from './types';
