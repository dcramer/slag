import { toRgb } from '../../../core/color';
import type { CharacterDef, Kind } from '../../../gen/character';
import type { RunnerPose } from '../../ink-figure';
import { sprites as plumber } from './plumber/frames';
import { pick, tint, type Wears } from './play';
import type { SpriteSet, SpriteSheet } from './types';

/**
 * Kinds rendered from 3D models (tools/art3d, docs/CHARACTERS.md → Rendered kinds), drawn in place of
 * their hand-drawn body only when asked: `?sprites=1` (src/debug.ts) or `slagDebug.sprites.use(true)`.
 * Nothing here loads until then, so the game without the flag fetches and draws exactly what it did.
 *
 * A sheet is recoloured once per character and kept: the atlas is linear in each slot's colour (the
 * renderer makes it so), so `c' = c + (B' - B) T` with T from the mask gives the player's colour exactly.
 */
export const SPRITES: Partial<Record<Kind, SpriteSet>> = { plumber };

let on = false;

export function useSprites(v: boolean) {
  on = v;
  if (v) for (const set of Object.values(SPRITES)) for (const sh of [set.play, set.card]) if (sh) void source(sh);
}

export const spritesOn = () => on;

interface Source {
  img: ImageData | null;
  mask: ImageData | null;
}
const sources = new Map<SpriteSheet, Source>();

async function pixels(url: string): Promise<ImageData> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  return g.getImageData(0, 0, c.width, c.height);
}

/** A sheet's atlas and mask, fetched once (on first use, never at import). */
function source(sh: SpriteSheet): Source {
  let s = sources.get(sh);
  if (!s) {
    const got: Source = { img: null, mask: null };
    s = got;
    sources.set(sh, s);
    void Promise.all([pixels(sh.png), pixels(sh.mask)]).then(([a, b]) => {
      got.img = a;
      got.mask = b;
    });
  }
  return s;
}

/** The slot colours a character wears, as 0–255 RGB. */
function wears(c: CharacterDef): Wears {
  const k = (v: [number, number, number]) => v.map((x) => Math.round(x * 255)) as [number, number, number];
  return { paint: k(toRgb(c.paint)), player: k(toRgb(c.body)) };
}

const tinted = new Map<string, HTMLCanvasElement>();

/** The sheet in this character's colours, or null until the sheet has loaded. */
function sheetFor(set: SpriteSet, sh: SpriteSheet, c: CharacterDef): HTMLCanvasElement | null {
  const w = wears(c);
  const key = `${sh.png}|${w.paint.join()}|${w.player.join()}`;
  const done = tinted.get(key);
  if (done) return done;
  const src = source(sh);
  if (!src.img || !src.mask) return null;
  const out = new ImageData(new Uint8ClampedArray(src.img.data), src.img.width, src.img.height);
  tint(out.data, src.mask.data, set.slots, w);
  const cv = document.createElement('canvas');
  cv.width = out.width;
  cv.height = out.height;
  cv.getContext('2d')!.putImageData(out, 0, 0);
  tinted.set(key, cv);
  return cv;
}

/** This character's rendered sprites, when the flag is on and its kind has some. */
export function spritesOf(c: CharacterDef): SpriteSet | null {
  return on ? (SPRITES[c.kind] ?? null) : null;
}

/**
 * Draws the body with its feet at the origin of the current transform (the caller has applied the
 * runner's position, scale and squash). False when the sheet isn't loaded yet, so the caller can draw
 * the hand-drawn body for those few frames instead.
 */
export function drawSprite(s: CanvasRenderingContext2D, set: SpriteSet, c: CharacterDef, p: RunnerPose, x: number): boolean {
  const tf = s.getTransform();
  const px = Math.hypot(tf.a, tf.b);
  const got = pick(set, p, x, px);
  if (!got) return false;
  const img = sheetFor(set, got.sheet, c);
  if (!img) return false;
  const [fx, fy, fw, fh, ax, ay] = got.frame;
  const k = 1 / got.sheet.scale;
  s.imageSmoothingEnabled = true;
  s.imageSmoothingQuality = 'high';
  s.drawImage(img, fx, fy, fw, fh, -ax * k, -ay * k, fw * k, fh * k);
  return true;
}

export { pick } from './play';
export type { SpriteSet } from './types';
