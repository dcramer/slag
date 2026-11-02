import { RUN_POSE, type RunnerPose } from '../../ink-figure';
import type { SpriteClip, SpriteSet, VFrame } from './types';

/**
 * Which frame of which clip a runner shows, from the same pose the hand-drawn cast reads. Pure, so it's
 * tested without a canvas (tests/sprite-cast.test.ts).
 */

/** What a runner is doing, by the clip that shows it. */
export type ClipName = 'idle' | 'walk' | 'run' | 'air' | 'wall' | 'cheer' | 'death';

/** A clip a kind may lack, and what stands in for it. */
const STAND_IN: Partial<Record<ClipName, ClipName>> = { walk: 'run', run: 'idle', air: 'idle', wall: 'air', cheer: 'idle', death: 'air' };

export function clipFor(p: RunnerPose): ClipName {
  if (p.dead !== undefined) return 'death';
  if (p.celebrate) return 'cheer';
  if (!p.grounded) return p.wall ? 'wall' : 'air';
  const v = Math.abs(p.vx);
  return v > RUN_POSE ? 'run' : v > 10 ? 'walk' : 'idle';
}

/** The clip a set has for a name, through stand-ins; null when it has none. */
export function clipIn(set: SpriteSet, name: ClipName): { name: ClipName; clip: SpriteClip } | null {
  let n: ClipName | undefined = name;
  for (let i = 0; n && i < 8; i++) {
    const clip = set.clips[n];
    if (clip) return { name: n, clip };
    n = STAND_IN[n];
  }
  return null;
}

/**
 * The frame index. A clip with `vy` is posed by vertical speed (a jump's take-off to its fall, whatever
 * the jump's height); one with a `stride` follows distance (`x`, world px along the run, as the
 * hand-drawn stride does), so the feet keep pace at any speed; the rest follow time `t` (seconds), and
 * a clip that doesn't loop holds its last frame.
 */
export function frameAt(clip: SpriteClip, x: number, t: number, vy = 0): number {
  const n = clip.r.length;
  if (n <= 1) return 0;
  if (clip.vy) {
    const [a, b] = clip.vy;
    const u = Math.min(1, Math.max(0, (vy - a) / (b - a)));
    return Math.round(u * (n - 1));
  }
  let u: number;
  if (clip.stride) u = Math.abs(x) / clip.stride;
  else if (clip.holds) {
    const total = clip.holds.reduce((a, b) => a + b, 0);
    let at = clip.loop ? ((t % total) + total) % total : Math.min(t, total);
    for (let i = 0; i < n; i++) {
      at -= clip.holds[i] ?? 0;
      if (at < 0) return i;
    }
    return n - 1;
  } else u = (t * (clip.fps ?? 8)) / n;
  if (!clip.loop) return Math.min(n - 1, Math.max(0, Math.floor(u * n)));
  return Math.min(n - 1, Math.max(0, Math.floor((u - Math.floor(u)) * n)));
}

/** A roll in 0..1 picking one of `n`: the same for the same seed. */
export const roll = (r: number | undefined, n: number) => Math.min(n - 1, Math.floor((r ?? 0) * n));

/** The option each accessory slot shows for a character's `vary` rolls (src/gen/character.ts). */
export function picks(set: SpriteSet, vary: readonly number[]): number[] {
  return (set.slots ?? []).map((sl) => roll(vary[sl.vary], sl.options));
}

export interface Pick {
  clip: ClipName;
  frame: VFrame;
  /** The facing drawn: a runner on a wall faces it, hand to it. */
  facing: number;
}

/** Everything the drawer needs for one runner this frame. */
export function pick(set: SpriteSet, p: RunnerPose, x: number): Pick | null {
  const got = clipIn(set, clipFor(p));
  if (!got) return null;
  const facing = got.name === 'wall' && p.wall ? p.wall : p.facing < 0 ? -1 : 1;
  const frames = facing < 0 ? got.clip.l : got.clip.r;
  return { clip: got.name, frame: frames[frameAt(got.clip, x, p.dead ?? p.t, p.vy)], facing };
}
