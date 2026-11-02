import type { Rect, Vec } from '../../../core/geom';
import { TILE } from '../../constants';
import { type Body, type CollisionWorld, createBody, stepBody } from '../../physics';
import { NO_INPUT } from '../../types';
import { cellOf, defineModule } from '../registry';
import { dirOf } from '../transform';
import type { ModuleOf } from '../types';

type Spring = ModuleOf<'spring'>;

/** The touch pad on the face of a one-cell part (springs, plates, buttons): the half of the cell against its face, inset 2 px. */
export function padRect(at: Vec, angle: number, off: Vec): Rect {
  const [dx, dy] = dirOf(angle);
  const ox = at[0] + off[0] - TILE / 2;
  const oy = at[1] + off[1] - TILE / 2;
  const pad = { x: ox + 2, y: oy + 2, w: TILE - 4, h: TILE - 4 };
  if (dy < 0) pad.y = oy + TILE / 2;
  if (dy > 0) pad.h = TILE / 2;
  if (dx > 0) pad.w = TILE / 2;
  if (dx < 0) pad.x = ox + TILE / 2;
  return pad;
}

/** How a Launch Plate's odd turns change its throw: a higher, shorter lob. */
const LOB: Vec = [0.6, 1.2];

/** The velocity a plate sets at rotation `rot`: mirrored from rot 2, and a lob on odd turns. */
export function plateThrow(arc: Vec, rot: number): Vec {
  const r = rot & 3;
  const k = r & 1 ? LOB : ([1, 1] as Vec);
  return [arc[0] * k[0] * (r >= 2 ? -1 : 1), arc[1] * k[1]];
}

/** Where a plate puts your feet before it throws you: its center, on the floor it lies on. */
export function plateStart(m: Spring, off: Vec): Vec {
  return [m.at[0] + off[0], m.at[1] + off[1] + TILE / 2];
}

/** A flight from a plate: the feet's path frame by frame, and where it lands (null if it never does in time). */
export interface PlateArc {
  pts: Vec[];
  land: Vec | null;
}

/**
 * Fly a plate's throw through `world` with the real controller and no input,
 * exactly as a runner it launches does: the dotted arc and the landing X are
 * this, never a hand formula. `maxFrames` caps a throw into a pit.
 */
export function plateArc(world: CollisionWorld, start: Vec, v: Vec, maxFrames = 240, floorY = Infinity): PlateArc {
  const b: Body = createBody(start[0], start[1]);
  launchFrom(b, start, v);
  const pts: Vec[] = [[start[0], start[1]]];
  for (let f = 0; f < maxFrames; f++) {
    if (!stepBody(b, NO_INPUT, world)) break;
    const p: Vec = [b.x + b.w / 2, b.y + b.h];
    pts.push(p);
    if (b.onGround) return { pts, land: p };
    if (p[1] > floorY) break;
  }
  return { pts, land: null };
}

/** Feet at `start`, flying at `v`, with nothing left over from before (no jump, no wall, no lock). */
export function launchFrom(b: Body, start: Vec, v: Vec): void {
  b.x = start[0] - b.w / 2;
  b.y = start[1] - b.h;
  b.vx = v[0];
  b.vy = v[1];
  b.onGround = false;
  b.groundRef = -1;
  b.jumping = false;
  b.coyote = 0;
  b.jumpBuffer = 0;
  b.wallDir = 0;
  b.wallCoyote = 0;
  b.wallLock = 0;
  b.dropFrames = 0;
}

/** Launch pad; RunWorld applies the impulse (or a Launch Plate's set throw) when a runner overlaps the trigger. */
export const spring = defineModule<'spring'>({
  type: 'spring',
  resolve(m, x) {
    if (!m.exact || !m.arc) return { ...m, at: x.P(m.at), angle: m.angle + x.da };
    // A plate always lies on its floor: rotation only picks the throw.
    const rot = Math.round(x.da / (Math.PI / 2));
    return { ...m, at: x.P(m.at), arc: plateThrow(m.arc, rot) };
  },
  anchors: (m) => [cellOf(m.at)],
  build(m, ctx, out) {
    const rect = padRect(m.at, m.angle, ctx.off);
    const uid = ctx.r.pp.uid;
    if (m.exact && m.arc) {
      const [x, y] = plateStart(m, ctx.off);
      out.springs.push({ rect, angle: m.angle, power: m.power, uid, set: { x, y, vx: m.arc[0], vy: m.arc[1] } });
    } else out.springs.push({ rect, angle: m.angle, power: m.power, uid });
  },
});
