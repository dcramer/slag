import { TILE } from '../../constants';
import { cellOf, defineModule } from '../registry';
import { cycle } from '../transform';
import type { ModuleOf } from '../types';

type Cavein = ModuleOf<'cavein'>;

/** Segments of a cave-in's cycle. */
export const CAVE_OFF = 0;
export const CAVE_WARN = 1;
export const CAVE_ON = 2;

/** A boulder's radius as a share of a tile: big enough to read, small enough to stay in its column. */
export const ROCK_R = 0.42;

/** Where the cave-in is in its cycle on frame `f`: a pure function of the frame, so a snapshot carries nothing for it. */
export const caveCycle = (m: Cavein, f: number, phase: number) => cycle(f, phase, [m.off, m.warn, m.on]);

/** Boulders in a box `w` px wide: one per column. */
export const rockCount = (m: Cavein) => Math.max(1, Math.round(m.w / TILE));

/** A tiny integer hash in [0, 1): the same boulder breaks loose at the same moment and spot every time. */
function h01(seed: number, i: number, k: number): number {
  let x = (seed * 374761393 + i * 668265263 + k * 2147483647) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Frames boulder `i` waits after the roof gives before it drops: a ripple, not a slab. */
export const rockLag = (m: Cavein, i: number) => Math.floor(h01(m.seed, i, 1) * m.on * 0.3);

/** Frames a boulder takes to fall the box's height: everything that's left of the cycle after the last one lets go. */
export const rockFall = (m: Cavein) => Math.max(8, Math.ceil(m.on * 0.7));

/** One boulder in the air: where it is (px, with the prop's offset) and its radius. */
export interface Rock {
  i: number;
  x: number;
  y: number;
  r: number;
  /** 0..1 down the fall. */
  u: number;
}

/**
 * The boulders falling on frame `f`, a quarter-tile jitter apart from their columns' middles, dropping
 * from the roof to the floor faster and faster. Empty off the fall.
 */
export function rocksAt(m: Cavein, f: number, phase: number, ox = 0, oy = 0): Rock[] {
  const c = caveCycle(m, f, phase);
  if (m.kind !== 'rocks' || c.seg !== CAVE_ON) return [];
  const n = rockCount(m);
  const cw = m.w / n;
  const r = Math.min(cw, TILE) * ROCK_R;
  const fall = rockFall(m);
  const out: Rock[] = [];
  for (let i = 0; i < n; i++) {
    const u = (c.t - rockLag(m, i)) / fall;
    if (u < 0 || u > 1) continue;
    const x = m.at[0] + ox + (i + 0.5) * cw + (h01(m.seed, i, 2) - 0.5) * cw * 0.25;
    const y = m.at[1] + oy + r + (m.h - 2 * r) * u * u;
    out.push({ i, x, y, r, u });
  }
  return out;
}

/**
 * Mine-only, world-only hazard (docs/SETPIECES.md, Mine): a span of cave roof that comes down on a cycle.
 * It warns first, and the warning is drawn and never felt (grit sifting out of the cracks and the timbers
 * creaking; firedamp seeping out of the rock and pooling under the roof), then it hurts: a curtain of
 * boulders falls roof to floor, each killing where it is, or the gas catches and the whole pocket is
 * fire. Nothing about it is solid, so nobody rides it, and it's over in `on` frames, so a route under it
 * is passable by timing (barrier.ts MIN_OPENING).
 */
export const cavein = defineModule<'cavein'>({
  type: 'cavein',
  resolve: (m, x) => ({ ...m, at: x.P(m.at), w: m.w * x.T, h: m.h * x.T }),
  // The floor's middle: where the rubble lands.
  anchors: (m) => [cellOf([m.at[0] + m.w / 2, m.at[1] + m.h - 0.5])],
  build(m, ctx, out) {
    const owner = ctx.r.pp.owner;
    if (m.kind === 'gas') {
      if (caveCycle(m, ctx.frame, ctx.r.phase).seg !== CAVE_ON) return;
      const pad = 1;
      out.hazards.push({ owner, kind: 'rect', r: { x: m.at[0] + ctx.off[0] + pad, y: m.at[1] + ctx.off[1] + pad, w: m.w - 2 * pad, h: m.h - 2 * pad } });
      return;
    }
    for (const r of rocksAt(m, ctx.frame, ctx.r.phase, ctx.off[0], ctx.off[1])) out.hazards.push({ owner, kind: 'circle', x: r.x, y: r.y, r: r.r });
  },
});
