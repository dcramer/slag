import { RUN_POSE, type RunnerPose } from '../../ink-figure';
import type { FrameRect, SpriteClip, SpriteSet, SpriteSheet } from './types';

/**
 * Which frame of which clip a runner shows, from the same pose the hand-drawn cast reads. Pure, so it's
 * tested without a canvas (tests/sprite-cast.test.ts).
 */

/** What a runner is doing, by the clip that shows it. */
export type ClipName = 'idle' | 'walk' | 'run' | 'air' | 'wall' | 'cheer' | 'death';

/** A pose, plus seconds since death for a runner coming apart. */
export type SpritePose = RunnerPose;

/** A clip a kind may lack, and what stands in for it. */
const STAND_IN: Partial<Record<ClipName, ClipName>> = { walk: 'run', run: 'idle', air: 'idle', wall: 'air', cheer: 'idle', death: 'air' };

export function clipFor(p: SpritePose): ClipName {
  if (p.dead !== undefined) return 'death';
  if (p.celebrate) return 'cheer';
  if (!p.grounded) return p.wall ? 'wall' : 'air';
  const v = Math.abs(p.vx);
  return v > RUN_POSE ? 'run' : v > 10 ? 'walk' : 'idle';
}

/** The clip a sheet has for a name, through stand-ins; null when it has none. */
export function clipIn(sheet: SpriteSheet, name: ClipName): { name: ClipName; clip: SpriteClip } | null {
  let n: ClipName | undefined = name;
  for (let i = 0; n && i < 8; i++) {
    const clip = sheet.clips[n];
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

/**
 * The sheet to draw from at `px` screen px per world px: the race sheet, unless the figure is shown so
 * big the race sheet would be blown up and the card sheet has the same clip.
 */
export function sheetFor(set: SpriteSet, name: ClipName, px: number): SpriteSheet {
  if (set.card && px > set.play.scale * 1.3 && clipIn(set.card, name)?.name === clipIn(set.play, name)?.name) return set.card;
  return set.play;
}

/** The colours a character puts in each recolourable slot, 0–255 RGB. */
export interface Wears {
  paint: readonly [number, number, number];
  player: readonly [number, number, number];
}

const hexRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/**
 * Recolours an atlas in place for a character. The renderer makes every pixel linear in each slot's
 * colour B (flat tones are B times a scalar, the pen is B pulled toward ink), and the mask holds that
 * scalar T (× 200, R for `paint`, G for `player`), so `c' = c + (B' - B) T` is exact.
 */
export function tint(rgba: Uint8ClampedArray, mask: Uint8ClampedArray, slots: SpriteSet['slots'], w: Wears) {
  const deltas: [number, number, number, number][] = [];
  if (slots.paint) deltas.push([0, ...(hexRgb(slots.paint).map((v, i) => w.paint[i] - v) as [number, number, number])]);
  if (slots.player) deltas.push([1, ...(hexRgb(slots.player).map((v, i) => w.player[i] - v) as [number, number, number])]);
  if (!deltas.length) return;
  for (let i = 0; i < rgba.length; i += 4) {
    if (!rgba[i + 3]) continue;
    for (const [ch, dr, dg, db] of deltas) {
      const t = mask[i + ch] / 200;
      if (!t) continue;
      rgba[i] += dr * t;
      rgba[i + 1] += dg * t;
      rgba[i + 2] += db * t;
    }
  }
}

export interface Pick {
  sheet: SpriteSheet;
  clip: ClipName;
  frame: FrameRect;
}

/** Everything the drawer needs for one runner this frame. A runner on a wall faces it, hand to it. */
export function pick(set: SpriteSet, p: SpritePose, x: number, px: number): Pick | null {
  const want = clipFor(p);
  const sheet = sheetFor(set, want, px);
  const got = clipIn(sheet, want);
  if (!got) return null;
  const facing = got.name === 'wall' && p.wall ? p.wall : p.facing;
  const frames = facing < 0 ? got.clip.l : got.clip.r;
  return { sheet, clip: got.name, frame: frames[frameAt(got.clip, x, p.dead ?? p.t, p.vy)] };
}
