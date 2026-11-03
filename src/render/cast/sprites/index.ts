import { type HSL, shift } from '../../../core/color';
import type { CharacterDef, Kind } from '../../../gen/character';
import { inkOf, lookOf, moodOf, type RunnerPose, ratio } from '../../ink-figure';
import { drawFrame, hexHsl, type Paint, paintOf } from './draw';
import { pick, picks, roll } from './play';
import type { SpriteSet } from './types';

/**
 * Kinds rendered from 3D models (tools/art3d, docs/CHARACTERS.md → Rendered kinds), drawn in place of
 * their hand-drawn body only when asked: `?sprites=1` (src/debug.ts) or `slagDebug.sprites.use(true)`.
 * Each kind's frames are a chunk of their own, fetched on first use, so the game without the flag loads
 * and draws exactly what it did.
 */
export const LOADERS: Partial<Record<Kind, () => Promise<{ sprites: SpriteSet }>>> = {
  plumber: () => import('./plumber/frames'),
  hedgehog: () => import('./hedgehog/frames'),
};

const loaded: Partial<Record<Kind, SpriteSet>> = {};
let on = false;

export function useSprites(v: boolean) {
  on = v;
  if (v)
    for (const [kind, load] of Object.entries(LOADERS) as [Kind, () => Promise<{ sprites: SpriteSet }>][])
      if (!loaded[kind])
        void load().then((m) => {
          loaded[kind] = m.sprites;
        });
}

export const spritesOn = () => on;

/** The kinds that have rendered frames. */
export const SPRITE_KINDS = Object.keys(LOADERS) as Kind[];

/** This character's rendered frames, when the flag is on and its kind's have loaded. */
export function spritesOf(c: CharacterDef): SpriteSet | null {
  return on ? (loaded[c.kind] ?? null) : null;
}

interface Dressed {
  paints: Paint[];
  /** The accessory option each slot shows, from the character's rolls. */
  pick: number[];
  body: Paint;
  shadow: string;
  k: number;
}

const dressed = new WeakMap<CharacterDef, Dressed>();

/** Each role's paint for this character: its slot's colour, or the roster's. Built once per character. */
function dress(set: SpriteSet, c: CharacterDef): Dressed {
  let d = dressed.get(c);
  if (!d) {
    const colour = (r: SpriteSet['roles'][number]) => (r.alts ? [r.color, ...r.alts][roll(c.vary[r.vary ?? 0], r.alts.length + 1)] : r.color);
    const hsl = set.roles.map((r): HSL => (r.slot === 'paint' ? c.paint : r.slot === 'player' ? c.body : hexHsl(colour(r))));
    const pick = picks(set, c.vary);
    const paints = set.roles.map((_, i) => paintOf(hsl[i]));
    // The silhouette is inked in a dark of its main colour: the player's, where the costume wears it (an
    // alternate costume, as a fighting game's roster does), else the kind's own.
    const main = hsl[[set.roles.findIndex((r) => r.slot === 'player'), set.roles.findIndex((r) => r.slot === 'paint')].find((i) => i >= 0) ?? 0];
    d = { paints, pick, body: { ...paintOf(main), ink: inkOf(main) }, shadow: ratio(main, shift(main, -14, 6)), k: lookOf(c, false).weight };
    dressed.set(c, d);
  }
  return d;
}

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
 * frame's bitmap is drawn at. False when the kind has no frame for the pose.
 */
export function drawSprite(s: CanvasRenderingContext2D, set: SpriteSet, c: CharacterDef, p: RunnerPose, x: number, px?: number): boolean {
  const got = pick(set, p, x);
  if (!got) return false;
  const d = dress(set, c);
  const mood = p.dead !== undefined ? ('dead' as const) : moodOf(p);
  const face = set.face ? { kit: set.face, mood, facing: got.facing } : undefined;
  const t = p.t;
  const seed = c.seed & 0xffff;
  const draw = (g: CanvasRenderingContext2D) => drawFrame(g, got.frame, d.paints, d.body, d.shadow, d.k, seed, t, face, d.pick);
  if (!px || px > 24) {
    draw(s);
    return true;
  }
  // The things that change a frame's drawing: its boil step, the face's mood and a blink.
  const boil = Math.floor(t * 8) % 3;
  const blink = mood === 'idle' && Math.sin(t * 1.3 + seed * 7) > 0.985;
  const bucket = 2 ** (Math.ceil(Math.log2(px) * 4) / 4);
  const key = `${idOf(d)}:${idOf(got.frame)}:${boil}:${mood}:${blink ? 1 : 0}:${bucket}`;
  const b = bitmap(key, bucket, draw);
  s.drawImage(b.cv, -b.ax / b.px, -b.ay / b.px, b.cv.width / b.px, b.cv.height / b.px);
  return true;
}

export { pick } from './play';
export type { SpriteSet } from './types';
