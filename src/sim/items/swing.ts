import { dcos, dsin } from '../../core/dmath';
import type { Rect } from '../../core/geom';
import { firstOverlap, type Body, type CollisionWorld } from '../physics';
import { GLOVE, SWORD } from './roster';

/**
 * Where a swing hits is where it's drawn: the noodle's and the bat's blades sweep an arc (`ARCS`), the Sucker Punch's
 * glove springs straight out (`gloveFront`), and the art in src/render reads the same numbers, so what a player sees
 * swing is what connects. None of them hits through rock: each stops at the first solid in its way (one-way boards
 * don't stop it), and the glove is drawn stopping there too.
 */

/**
 * A blade's arc, facing +x with y down: it turns about a pivot (`px` ahead of the body's middle, `py` under its top)
 * from `from` to `to` radians off straight up, `rate` times as fast as the swing's own clock and then held there, and
 * it spans `rIn` to `r` px out from the pivot, `half` px either side of its line.
 */
interface Arc {
  px: number;
  py: number;
  from: number;
  to: number;
  rate: number;
  rIn: number;
  r: number;
  half: number;
}

type Blade = 'sword' | 'bat';

export const ARCS: Record<Blade, Arc> = {
  // The noodle's foam, 6.4 to 18.6 px from a pivot at the shoulder: from behind the head over the top to down in front.
  sword: { px: 3, py: 7, from: -1.1, to: 1.9, rate: 1.6, rIn: 6.4, r: 18.6, half: 2.5 },
  // The bat's barrel, from low behind round to down in front.
  bat: { px: -1, py: 7, from: -2, to: 1.9, rate: 1.5, rIn: 5, r: 22, half: 2.3 },
};

/** The blade's angle (radians off straight up, toward the facing) with `swing` frames of the swing left. */
export function swingAngle(blade: Blade, swing: number): number {
  const a = ARCS[blade];
  return a.from + Math.min(1, (1 - swing / SWORD.swing) * a.rate) * (a.to - a.from);
}

/** Radians of arc one rect covers at most: past it the box round a bend of the blade's sweep holds too much air. */
const CHUNK = 0.35;

/** The boxes round the blade sweeping from `a0` to `a1`, in arc space (pivot at 0, facing +x): two along its length per chunk of arc. */
function sweep(arc: Arc, a0: number, a1: number): Rect[] {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / CHUNK));
  const mid = (arc.rIn + arc.r) / 2;
  const out: Rect[] = [];
  for (let i = 0; i < n; i++) {
    const b0 = a0 + ((a1 - a0) * i) / n;
    const b1 = a0 + ((a1 - a0) * (i + 1)) / n;
    for (const [r0, r1] of [
      [arc.rIn, mid],
      [mid, arc.r],
    ]) {
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const a of [b0, b1])
        for (const rr of [r0, r1]) {
          const x = rr * dsin(a);
          const y = -rr * dcos(a);
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
        }
      out.push({ x: x0 - arc.half, y: y0 - arc.half, w: x1 - x0 + arc.half * 2, h: y1 - y0 + arc.half * 2 });
    }
  }
  return out;
}

/**
 * The blade's hit boxes for each frame it can hit (`swing` from `SWORD.activeHi` down to `activeLo`), in arc space:
 * what it swept since the frame before, and on the first of them everything since the swing began, as its smear shows.
 */
const BLADE_BOXES: Record<Blade, Rect[][]> = {
  sword: boxesOf('sword'),
  bat: boxesOf('bat'),
};

function boxesOf(blade: Blade): Rect[][] {
  const table: Rect[][] = [];
  const first: number = SWORD.activeHi;
  for (let s: number = SWORD.activeLo; s <= first; s++)
    table[s] = sweep(ARCS[blade], s === first ? ARCS[blade].from : swingAngle(blade, s + 1), swingAngle(blade, s));
  return table;
}

const probe: Rect = { x: 0, y: 0, w: 2, h: 2 };

/** Px from `x` along `dir`, up to `dist`, before a line at height `y` meets something solid. One-way boards don't stop it. */
function clearAlong(world: CollisionWorld, x: number, y: number, dir: -1 | 1, dist: number): number {
  probe.y = y - 1;
  for (let d = 0; d < dist; d += 2) {
    probe.x = dir > 0 ? x + d : x - d - 2;
    const s = firstOverlap(probe, world);
    if (s) return Math.min(dist, Math.max(0, dir > 0 ? s.x - x : x - s.x - s.w));
  }
  return dist;
}

/**
 * Where the blade of the swing `b` is making (`blade`, with `swing` frames left) can hit this frame, in world px: the
 * boxes of its sweep, each cut back to the first solid between the pivot and its far side at its own height, so a
 * blade swung over a low step still reaches past it and one swung at a wall stops there. Empty outside the hitting frames.
 */
export function bladeBoxes(world: CollisionWorld, b: Body, blade: Blade, swing: number): Rect[] {
  const local = BLADE_BOXES[blade][swing];
  if (!local) return [];
  const arc = ARCS[blade];
  const fc = b.facing;
  const px = b.x + b.w / 2 + fc * arc.px;
  const py = b.y + arc.py;
  const out: Rect[] = [];
  for (const r of local) {
    // To world, mirrored for a swing to the left; then the front and back edges cut at rock.
    let x0 = fc > 0 ? px + r.x : px - r.x - r.w;
    let x1 = x0 + r.w;
    const y = py + r.y + r.h / 2;
    if (x1 > px) x1 = Math.min(x1, px + clearAlong(world, px, y, 1, x1 - px));
    if (x0 < px) x0 = Math.max(x0, px - clearAlong(world, px, y, -1, px - x0));
    if (x1 > x0) out.push({ x: x0, y: py + r.y, w: x1 - x0, h: r.h });
  }
  return out;
}

/** How far out the glove is through a punch (0..1): it shoots out, holds while it connects, and springs back. */
function gloveStretch(swing: number): number {
  const u = 1 - swing / SWORD.swing;
  return u < 0.3 ? u / 0.3 : u < 0.75 ? 1 : Math.max(0, (1 - u) / 0.25);
}

/** The glove's line, px under the body's top, and how far ahead of the body's middle its fist reaches when it's in. */
export const GLOVE_LINE = { y: 6, base: 15 } as const;

/**
 * How far ahead of the puncher's middle the Sucker Punch's fist is, with `swing` frames of the punch left: out to
 * `GLOVE.reach` at full stretch, and never past the first solid on the glove's line (it's drawn stopping there too).
 */
export function gloveFront(world: CollisionWorld, b: Body, swing: number): number {
  const out = GLOVE_LINE.base + gloveStretch(swing) * (GLOVE.reach - GLOVE_LINE.base);
  return clearAlong(world, b.x + b.w / 2, b.y + GLOVE_LINE.y, b.facing, out);
}

/** The Sucker Punch's hit box: its glove's height, from the gift box to the fist (`gloveFront`). Null if rock leaves it no room. */
export function gloveBox(world: CollisionWorld, b: Body, swing: number): Rect | null {
  const front = gloveFront(world, b, swing);
  const back = 3;
  if (front <= back) return null;
  const cx = b.x + b.w / 2;
  return { x: b.facing > 0 ? cx + back : cx - front, y: b.y + GLOVE_LINE.y - 6.5, w: front - back, h: 13 };
}
