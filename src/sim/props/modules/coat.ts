import type { Rect, Vec } from '../../../core/geom';
import { PHYS, TILE } from '../../constants';
import { ICE_SURFACE } from '../../ground';
import { DEFAULT_SURFACE, type Surface } from '../../physics';
import { addTrigger, defineModule, solidId } from '../registry';
import { dirOf } from '../transform';
import type { ModuleOf } from '../types';

/** Coat thickness (px): thin enough to step onto, thick enough to be the surface you touch. */
export const COAT_PX = 3;
/** How far a spike coat's points stand off its face (px). */
export const SPIKE_PX = 7;

/**
 * Boost Strip: touching it holds you at `speed` along its arrow for `frames` frames, with no skid. A
 * strip on a wall moves you up or down the face at `speed` for as long as you touch it.
 */
export const BOOST = {
  speed: Math.round(PHYS.runSpeed * 1.6),
  frames: 30,
  /** How far past the coat (px) touching still counts: standing on it, or flush against it on a wall. */
  reach: 2,
} as const;

/** The way a strip's arrow points: along its face, a quarter turn clockwise from the way out, so rot 0 on a floor runs right. */
export function boostDir(angle: number): Vec {
  const [nx, ny] = dirOf(angle);
  return [-ny || 0, nx || 0];
}

export const COAT_SURFACES: Record<'ice' | 'slime' | 'boost', Surface> = {
  ice: ICE_SURFACE,
  slime: { ...DEFAULT_SURFACE, friction: 1.5, speedMult: 0.45, jumpMult: 0.7, wall: 'sticky' },
  boost: DEFAULT_SURFACE,
};

/** The strip just outside a host cell's face, `depth` px thick. */
export function faceRect(cx: number, cy: number, angle: number, depth: number, inset = 0): Rect {
  const [dx, dy] = dirOf(angle);
  const x = cx * TILE;
  const y = cy * TILE;
  if (dx > 0) return { x: x + TILE, y: y + inset, w: depth, h: TILE - inset * 2 };
  if (dx < 0) return { x: x - depth, y: y + inset, w: depth, h: TILE - inset * 2 };
  if (dy > 0) return { x: x + inset, y: y + TILE, w: TILE - inset * 2, h: depth };
  return { x: x + inset, y: y - depth, w: TILE - inset * 2, h: depth };
}

/** Spike strips and ice/slime/boost coats mounted on faces of existing solids. */
defineModule<'coat'>({
  type: 'coat',
  resolve: (m, x) => ({ ...m, cells: x.C(m.cells), angle: m.angle + x.da }),
  anchors: (m) => m.cells.slice(),
  rides: true,
  build(m: ModuleOf<'coat'>, ctx, out) {
    const uid = ctx.r.pp.uid;
    // Still unless it rides a mover (../ride.ts); then it's carried like the face it's on.
    const { off, prev } = ctx;
    m.cells.forEach(([cx, cy], i) => {
      if (m.kind === 'spikes') {
        const r = faceRect(cx, cy, m.angle, SPIKE_PX, 2);
        out.hazards.push({ owner: ctx.r.pp.owner, kind: 'rect', r: { ...r, x: r.x + off[0], y: r.y + off[1] } });
      } else {
        const r = faceRect(cx, cy, m.angle, COAT_PX);
        out.solids.push({
          ...r,
          x: r.x + off[0],
          y: r.y + off[1],
          id: solidId(uid, ctx.mi, i),
          dx: off[0] - prev[0],
          dy: off[1] - prev[1],
          surface: COAT_SURFACES[m.kind],
          propUid: uid,
          mi: ctx.mi,
        });
        if (m.kind === 'boost') {
          const t = faceRect(cx, cy, m.angle, COAT_PX + BOOST.reach);
          addTrigger(out, { r: { ...t, x: t.x + off[0], y: t.y + off[1] }, uid, mi: ctx.mi, key: solidId(uid, ctx.mi, i) });
        }
      }
    });
  },
  touch(m, ctx, who, _t, first) {
    if (m.kind !== 'boost' || !ctx.live) return;
    const [ax, ay] = boostDir(m.angle);
    const b = who.body;
    if (ax !== 0) {
      who.status.boost = BOOST.frames;
      who.status.boostVx = ax * BOOST.speed;
      b.vx = who.status.boostVx;
    } else {
      b.vy = ay * BOOST.speed;
      b.onGround = false;
      b.groundRef = -1;
      b.jumping = false;
    }
    if (first) ctx.emit({ type: 'prop', kind: 'boost', x: b.x + b.w / 2, y: b.y + b.h / 2, x2: b.x + b.w / 2 + ax * 24, y2: b.y + b.h / 2 + ay * 24 });
  },
});
