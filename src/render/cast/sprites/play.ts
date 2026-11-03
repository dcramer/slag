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

/**
 * The `vary` rolls behind a rendered kind's curated variety (docs/CHARACTERS.md → Variety): its alternate
 * palette, which idle and which cheer it plays, its gait's bounce and lean, and its wear. Every kind reads
 * the same ones, past the six the hand-drawn cast and the accessories use.
 */
export const VARIETY = { palette: 6, idle: 7, cheer: 8, bounce: 9, lean: 10, wear: 11 } as const;

/** No kind's gait goes past these, so every variant stays inside the shared envelope (tests/sprite-cast.test.ts). */
export const GAIT_MAX = { bounce: 0.9, lean: 0.06 } as const;

/** The clips with alternates, and the roll that picks one. */
const VARIANT_ROLL: Partial<Record<ClipName, number>> = { idle: VARIETY.idle, cheer: VARIETY.cheer };

/** A clip's name and its alternates' (`idle`, `idle2`, `idle3`…), in order. */
export function variantsOf(set: SpriteSet, name: ClipName): string[] {
  const out: string[] = set.clips[name] ? [name] : [];
  for (let i = 2; set.clips[`${name}${i}`]; i++) out.push(`${name}${i}`);
  return out;
}

/** Everything a character's rolls pick from its kind's variety: one per character, kept by the drawer. */
export interface Variety {
  /** The option each accessory slot shows (the wear slot among them). */
  pick: number[];
  /** The clip each clip with alternates plays. */
  clips: Partial<Record<ClipName, string>>;
  /** World px of extra bounce on each step, and the forward lean. */
  bounce: number;
  lean: number;
}

const between = (b: readonly [number, number] | undefined, u: number | undefined, max: number) =>
  b ? Math.min(max, Math.max(0, b[0] + (b[1] - b[0]) * (u ?? 0))) : 0;

/** A character's variety, from its `vary` rolls: pure, so the same seed always looks and moves the same. */
export function varietyOf(set: SpriteSet, vary: readonly number[]): Variety {
  const clips: Partial<Record<ClipName, string>> = {};
  for (const [name, at] of Object.entries(VARIANT_ROLL) as [ClipName, number][]) {
    const vs = variantsOf(set, name);
    if (vs.length > 1) clips[name] = vs[roll(vary[at], vs.length)];
  }
  return {
    pick: picks(set, vary),
    clips,
    bounce: between(set.gait?.bounce, vary[VARIETY.bounce], GAIT_MAX.bounce),
    lean: between(set.gait?.lean, vary[VARIETY.lean], GAIT_MAX.lean),
  };
}

/**
 * The gait's own offset this frame: a lift on each step (two a stride loop) and a lean forward, in full on
 * the run and less on the walk. `dy` is world px (up negative), `lean` the skew about the feet.
 */
export function gaitAt(set: SpriteSet, v: Variety, clip: ClipName, x: number): { dy: number; lean: number } {
  const k = clip === 'run' ? 1 : clip === 'walk' ? 0.5 : 0;
  const stride = set.clips[clip]?.stride;
  if (!k || !stride) return { dy: 0, lean: 0 };
  return { dy: -v.bounce * k * Math.abs(Math.sin((Math.PI * 2 * Math.abs(x)) / stride)), lean: v.lean * k };
}

export interface Pick {
  clip: ClipName;
  frame: VFrame;
  /** The facing drawn: a runner on a wall faces it, hand to it. */
  facing: number;
}

/** Everything the drawer needs for one runner this frame; `v` plays the character's own idle and cheer. */
export function pick(set: SpriteSet, p: RunnerPose, x: number, v?: Variety): Pick | null {
  const got = clipIn(set, clipFor(p));
  if (!got) return null;
  const alt = v?.clips[got.name];
  if (alt && set.clips[alt]) got.clip = set.clips[alt];
  const facing = got.name === 'wall' && p.wall ? p.wall : p.facing < 0 ? -1 : 1;
  const frames = facing < 0 ? got.clip.l : got.clip.r;
  return { clip: got.name, frame: frames[frameAt(got.clip, x, p.dead ?? p.t, p.vy)], facing };
}
