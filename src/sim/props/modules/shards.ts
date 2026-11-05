import type { Cell, Rect, Vec } from '../../../core/geom';
import { Rng } from '../../../core/rng';
import { TILE } from '../../constants';
import { defineModule } from '../registry';
import type { ModuleOf } from '../types';

type Shards = ModuleOf<'shards'>;

/**
 * A broken window's glass (docs/SETPIECES.md, Castle): a world-only set piece, much bigger than a spike
 * strip. Its shards are triangles rolled from the module's seed; the art draws those triangles and the
 * sim hurts with rects that follow them to within about a pixel (docs/DESIGN.md, Props: sub-tile steps),
 * so a shard kills exactly where it's drawn and nowhere else. Both read `shardSet`.
 */

/** Shards and the hazard that follows them, in px from the box's top-left. */
export interface ShardSet {
  /** Triangles: base corner, tip, base corner. */
  polys: Vec[][];
  rects: Rect[];
  /** Px of the box that sit in the frame's recess, measured from the wall. */
  inset: number;
}

/** How far a hazard rect may stand past its shard's edge (px). */
export const SHARD_FIT = 1;

const cache = new Map<string, ShardSet>();

/** The shards of a module (def or resolved: only its size, direction, inset and seed matter). Same answer every call. */
export function shardSet(m: Pick<Shards, 'w' | 'h' | 'dir' | 'inset' | 'seed'>): ShardSet {
  const key = `${m.w},${m.h},${m.dir},${m.inset},${m.seed}`;
  let s = cache.get(key);
  if (!s) {
    s = makeShards(m.w, m.h, m.dir, m.inset, m.seed);
    cache.set(key, s);
  }
  return s;
}

/**
 * Roll the shards in wall space (u out of the wall, v down), then turn them to face `dir`. Shards stand
 * out of the back of the frame all the way down, with a gap or two where the pane fell out; a frame
 * cut into the wall also keeps splinters hanging from its lintel and standing on its sill.
 */
function makeShards(w: number, h: number, dir: 1 | -1, inset: number, seed: number): ShardSet {
  const rng = new Rng(seed);
  const W = w * TILE;
  const H = h * TILE;
  const R = Math.min(W, inset * TILE);
  const tris: Vec[][] = [];
  let v = 0;
  let longest = -1;
  let far = 0;
  for (let i = 0; v < H - 4; i++) {
    let len = rng.range(8, 16);
    if (H - v - len < 7) len = H - v;
    // A hole where the pane fell out, never at the ends, so the frame always looks glazed.
    if (i > 0 && v + len < H - 8 && rng.chance(0.2)) {
      v += Math.min(len, 9);
      continue;
    }
    const reach = rng.range(0.42, 0.98) * (W - 2);
    const tip = v + len * rng.range(0.2, 0.8);
    tris.push([
      [0, v],
      [reach, tip],
      [0, v + len],
    ]);
    if (reach > far) {
      far = reach;
      longest = tris.length - 1;
    }
    v += len;
  }
  // One shard always reaches all the way out: the window's silhouette is its longest spike.
  if (longest >= 0) tris[longest][1] = [W - 1.5, tris[longest][1][1]];
  if (R > 0) {
    for (const top of [true, false]) {
      const n = rng.int(1, 2);
      for (let k = 0; k < n; k++) {
        const a = rng.range(1, Math.max(1.5, R - 7));
        const b = Math.min(R - 0.5, a + rng.range(4, 8));
        const tu = Math.min(W - 2, rng.range(a + 1, b + 7));
        const depth = rng.range(0.22, 0.42) * H;
        const y = top ? 0 : H;
        tris.push([
          [a, y],
          [tu, top ? depth : H - depth],
          [b, y],
        ]);
      }
    }
  }
  const turn = (p: Vec): Vec => [dir > 0 ? p[0] : W - p[0], p[1]];
  const rects: Rect[] = [];
  for (const t of tris) slice(t, rects);
  return {
    polys: tris.map((t) => t.map(turn)),
    rects: rects.map((r) => (dir > 0 ? r : { x: W - r.x - r.w, y: r.y, w: r.w, h: r.h })),
    inset: R,
  };
}

/**
 * Cut a triangle into rects across its base: bands along the axis the shard points, each as wide as the
 * triangle is across that band. A band overshoots the slanted edges by their slope times its width, so
 * the band is as wide as keeps that within SHARD_FIT.
 */
function slice(t: Vec[], out: Rect[]): void {
  const [a, tip, b] = t;
  // A base on the back of the frame (u = 0) points along u; one on the lintel or sill, along v.
  const alongU = a[0] === b[0];
  const A = alongU ? 0 : 1;
  const O = 1 - A;
  let slope = 0;
  for (const e of [a, b]) slope = Math.max(slope, Math.abs(tip[O] - e[O]) / Math.max(1e-6, Math.abs(tip[A] - e[A])));
  const band = slope <= SHARD_FIT / 4 ? 4 : slope <= SHARD_FIT / 2 ? 2 : slope <= SHARD_FIT ? 1 : 0.5;
  const lo = Math.min(a[A], tip[A], b[A]);
  const hi = Math.max(a[A], tip[A], b[A]);
  for (let s0 = lo; s0 < hi - 1e-9; s0 += band) {
    const s1 = Math.min(hi, s0 + band);
    let mn = Infinity;
    let mx = -Infinity;
    const take = (o: number) => {
      mn = Math.min(mn, o);
      mx = Math.max(mx, o);
    };
    for (const p of t) if (p[A] >= s0 && p[A] <= s1) take(p[O]);
    for (let i = 0; i < 3; i++) {
      const p = t[i];
      const q = t[(i + 1) % 3];
      for (const c of [s0, s1]) {
        if ((p[A] - c) * (q[A] - c) > 0 || p[A] === q[A]) continue;
        take(p[O] + ((q[O] - p[O]) * (c - p[A])) / (q[A] - p[A]));
      }
    }
    if (mx - mn < 0.05) continue;
    out.push(alongU ? { x: s0, y: mn, w: s1 - s0, h: mx - mn } : { x: mn, y: s0, w: mx - mn, h: s1 - s0 });
  }
}

/** Every cell of the box: the shards claim them all, and the barrier keeps the plan out of the ones they cut. */
function boxCells(m: Shards): Cell[] {
  const out: Cell[] = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) out.push([Math.floor(m.at[0]) + x, Math.floor(m.at[1]) + y]);
  return out;
}

defineModule<'shards'>({
  type: 'shards',
  resolve: (m, x) => ({ ...m, at: x.P(m.at) }),
  anchors: boxCells,
  build(m, ctx, out) {
    const owner = ctx.r.pp.owner;
    const x0 = m.at[0] + ctx.off[0];
    const y0 = m.at[1] + ctx.off[1];
    for (const r of shardSet(m).rects) out.hazards.push({ owner, kind: 'rect', r: { x: x0 + r.x, y: y0 + r.y, w: r.w, h: r.h } });
  },
});
