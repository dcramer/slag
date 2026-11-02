import { css, type HSL } from '../../core/color';
import { overlaps, type Rect } from '../../core/geom';
import { TILE } from '../../sim/constants';
import type { Solid } from '../../sim/physics';
import { footprintCells, motionOffset, type Resolved, rideSpan } from '../../sim/props';
import type { RC } from '../kit';

/**
 * The place-phase cue for a part that will ride a mover (sim/props/ride.ts):
 * the loop it will travel, dotted, with a bead running round it, and a chain
 * link where it touches what carries it. Drawn on the glow layer like the
 * ghost's outline, from the same offset the sim uses.
 */

/** Points sampled along a ride's loop. */
const LOOP_POINTS = 64;
/** Longest stretch of a ride drawn (frames): a chain of movers can take ages to repeat. */
const LOOP_FRAMES = 900;

export function drawRideCue(rc: RC, ghost: Resolved, solids: readonly Solid[], color: HSL): void {
  const c = ghost.carry;
  if (!c) return;
  const g = rc.g;
  const cells = footprintCells(ghost.pp);
  if (!cells.length) return;
  const cx = (cells.reduce((a, q) => a + q[0], 0) / cells.length + 0.5) * TILE;
  const cy = (cells.reduce((a, q) => a + q[1], 0) / cells.length + 0.5) * TILE;
  const span = Math.min(LOOP_FRAMES, rideSpan(ghost));
  g.save();
  g.strokeStyle = css(color, 12, 0.7);
  g.lineWidth = 1.1;
  g.setLineDash([2, 4]);
  g.beginPath();
  for (let i = 0; i <= LOOP_POINTS; i++) {
    const [ox, oy] = motionOffset(ghost, rc.frame + Math.round((i * span) / LOOP_POINTS));
    if (i) g.lineTo(cx + ox, cy + oy);
    else g.moveTo(cx + ox, cy + oy);
  }
  g.stroke();
  g.setLineDash([]);
  // A bead running the loop ahead of it, so it reads as "this goes round", not as a fence.
  const ahead = Math.floor(((rc.t * 0.6) % 1) * span);
  const [bx, by] = motionOffset(ghost, rc.frame + ahead);
  g.fillStyle = css(color, 20, 0.9);
  g.beginPath();
  g.arc(cx + bx, cy + by, 1.8, 0, Math.PI * 2);
  g.fill();
  const at = contact(rc, ghost, cells, solids);
  if (at) link(g, at[0], at[1], color);
  g.restore();
}

/** Where the part meets its carrier on this frame: the middle of the first face they share, or of where a coat's host lies in it. */
function contact(rc: RC, ghost: Resolved, cells: readonly (readonly [number, number])[], solids: readonly Solid[]): [number, number] | null {
  const c = ghost.carry!;
  const [ox, oy] = motionOffset(ghost, rc.frame);
  const near = (a: number, b: number) => Math.abs(a - b) < 1;
  for (const s of solids) {
    if (s.propUid !== c.by.pp.uid || s.mi !== c.mi) continue;
    for (const [x, y] of cells) {
      const a: Rect = { x: x * TILE + ox, y: y * TILE + oy, w: TILE, h: TILE };
      const mx = (Math.max(a.x, s.x) + Math.min(a.x + a.w, s.x + s.w)) / 2;
      const my = (Math.max(a.y, s.y) + Math.min(a.y + a.h, s.y + s.h)) / 2;
      const acrossX = Math.min(a.x + a.w, s.x + s.w) - Math.max(a.x, s.x) > 0;
      const acrossY = Math.min(a.y + a.h, s.y + s.h) - Math.max(a.y, s.y) > 0;
      if (acrossX && near(a.y + a.h, s.y)) return [mx, s.y];
      if (acrossX && near(a.y, s.y + s.h)) return [mx, s.y + s.h];
      if (acrossY && near(a.x + a.w, s.x)) return [s.x, my];
      if (acrossY && near(a.x, s.x + s.w)) return [s.x + s.w, my];
      if (overlaps(a, s)) return [mx, my];
    }
  }
  return null;
}

/** A chain link: two interlocked rings, tilted, a few px across. */
function link(g: CanvasRenderingContext2D, x: number, y: number, color: HSL): void {
  g.save();
  g.translate(x, y);
  g.rotate(-Math.PI / 4);
  g.lineWidth = 1.3;
  g.strokeStyle = css(color, 25, 0.95);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(s * 2, 0, 3.2, 1.9, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}
