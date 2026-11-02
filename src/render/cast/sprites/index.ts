import { type HSL, shift } from '../../../core/color';
import type { CharacterDef, Kind } from '../../../gen/character';
import { inkOf, lookOf, moodOf, type RunnerPose, ratio } from '../../ink-figure';
import { drawFrame, hexHsl, type Paint, paintOf } from './draw';
import { pick } from './play';
import type { SpriteSet } from './types';

/**
 * Kinds rendered from 3D models (tools/art3d, docs/CHARACTERS.md → Rendered kinds), drawn in place of
 * their hand-drawn body only when asked: `?sprites=1` (src/debug.ts) or `slagDebug.sprites.use(true)`.
 * Each kind's frames are a chunk of their own, fetched on first use, so the game without the flag loads
 * and draws exactly what it did.
 */
const LOADERS: Partial<Record<Kind, () => Promise<{ sprites: SpriteSet }>>> = {
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
  body: Paint;
  shadow: string;
  k: number;
}

const dressed = new WeakMap<CharacterDef, Dressed>();

/** Each role's paint for this character: its slot's colour, or the roster's. Built once per character. */
function dress(set: SpriteSet, c: CharacterDef): Dressed {
  let d = dressed.get(c);
  if (!d) {
    const hsl = set.roles.map((r): HSL => (r.slot === 'paint' ? c.paint : r.slot === 'player' ? c.body : hexHsl(r.color)));
    const paints = set.roles.map((_, i) => paintOf(hsl[i]));
    // The silhouette is inked in a dark of the kind's own colour, as a hand-drawn homage's is.
    const main = hsl[set.roles.findIndex((r) => r.slot === 'paint')] ?? hsl[0];
    d = { paints, body: { ...paintOf(main), ink: inkOf(main) }, shadow: ratio(main, shift(main, -14, 6)), k: lookOf(c, false).weight };
    dressed.set(c, d);
  }
  return d;
}

/**
 * Draws the body with its feet at the origin of the current transform (the caller has applied the
 * runner's position, scale and squash). False when the kind has no frame for the pose.
 */
export function drawSprite(s: CanvasRenderingContext2D, set: SpriteSet, c: CharacterDef, p: RunnerPose, x: number): boolean {
  const got = pick(set, p, x);
  if (!got) return false;
  const d = dress(set, c);
  const face = set.face ? { kit: set.face, mood: p.dead !== undefined ? ('dead' as const) : moodOf(p), facing: got.facing } : undefined;
  drawFrame(s, got.frame, d.paints, d.body, d.shadow, d.k, c.seed & 0xffff, p.t, face);
  return true;
}

export { pick } from './play';
export type { SpriteSet } from './types';
