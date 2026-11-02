import type { Cell, Vec } from '../../core/geom';
import { TILE } from '../constants';
import type { LauncherStyle, Material, ModuleOf, TileBox } from './types';

/**
 * How much room a launcher takes, by style: the cells it places on, where it fires from (`at`) and, when
 * the machine doesn't fill its cells, the sub-tile solids it stands as (docs/DESIGN.md, Props: placement is
 * on the grid, a solid shape needn't be). Most styles are a one-tile machine; the ones whose object is
 * long or tall take two tiles. Everything here is in the def's frame at rot 0, facing right; the art draws
 * the same outlines (src/render/props/modules/launcher-frames.ts) and fires from the same point.
 */
export interface LauncherFrame {
  cells: Cell[];
  /** Where shots leave from (tiles). */
  at: Vec;
  /** Sub-tile solids (tiles), when the machine doesn't fill its cells. */
  shape?: TileBox[];
}

const ONE: LauncherFrame = { cells: [[0, 0]], at: [0.5, 0.5] };

/** px → tiles, for frames drawn up in pixels. */
const t = (px: number) => px / TILE;
const box = (x: number, y: number, w: number, h: number): TileBox => [t(x), t(y), t(w), t(h)];

/**
 * Stepped solids under a curved top, `top(x)` px down from the frame's top, from x0 to x1 and down to
 * `bottom`. A new step starts wherever the curve has moved more than `2 * tol` px, and each step stands at
 * the curve's height at its middle, so every step's top stays within about `tol` px of the curve. No step
 * is narrower than a pixel, which is where a wall-steep curve is a wall.
 */
export function stepsUnder(top: (x: number) => number, x0: number, x1: number, bottom: number, tol = 1): TileBox[] {
  const cuts = [x0];
  let from = x0;
  for (let x = x0 + 0.25; x < x1; x += 0.25) {
    if (x - from >= 1 && Math.abs(top(x) - top(from)) > 2 * tol) {
      cuts.push(x);
      from = x;
    }
  }
  if (x1 - cuts[cuts.length - 1] < 1 && cuts.length > 1) cuts.pop();
  cuts.push(x1);
  const out: TileBox[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const y = top((cuts[i] + cuts[i + 1]) / 2);
    out.push(box(cuts[i], y, cuts[i + 1] - cuts[i], bottom - y));
  }
  return out;
}

/** Stepped solids for a round thing: rows across a disc of radius `r` px at (cx, cy), within about `tol` px. */
export function stepsRound(cx: number, cy: number, r: number, tol = 1): TileBox[] {
  const half = (y: number) => Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)));
  const cuts = [cy - r];
  let from = cy - r;
  for (let y = cy - r + 0.25; y < cy + r; y += 0.25) {
    if (y - from >= 1 && Math.abs(half(y) - half(from)) > 2 * tol) {
      cuts.push(y);
      from = y;
    }
  }
  if (cy + r - cuts[cuts.length - 1] < 1) cuts.pop();
  cuts.push(cy + r);
  const out: TileBox[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const w = half((cuts[i] + cuts[i + 1]) / 2);
    out.push(box(cx - w, cuts[i], w * 2, cuts[i + 1] - cuts[i]));
  }
  return out;
}

/**
 * Budget Airline's hangar: a quonset arch on a short wall, its roof `HANGAR_ARCH`, with a runway apron
 * running out of it. Px in the 32×16 frame.
 */
export const HANGAR_ARCH = { x0: 0, x1: 20, wall: 13, top: 1 } as const;
/** The arch's roof line: px down from the frame's top at x. */
export function hangarRoof(x: number): number {
  const { x0, x1, wall, top } = HANGAR_ARCH;
  const u = (x - (x0 + x1) / 2) / ((x1 - x0) / 2);
  return wall - (wall - top) * Math.sqrt(Math.max(0, 1 - u * u));
}
/** The runway apron (px): a low slab out of the door. */
export const HANGAR_APRON = { x0: 18, x1: 32, top: 12 } as const;

/** The pirate cannon's carriage (px, 32×16): a bed on its trucks, a step at the back, the cheeks the barrel rests in. */
export const CANNON_CARRIAGE = {
  bed: [2, 11, 28, 5],
  step: [4, 8, 9, 3],
  cheek: [13, 5, 12, 6],
} as const;

/** The gumball machine (px, 16×32): a globe on a neck, a cast body and a foot. */
export const GUMBALL = { globe: [8, 9, 7.2], cap: [6, 0.6, 4, 1.4], neck: [5, 16, 6, 3], body: [3, 19, 10, 10], foot: [1.5, 29, 13, 3] } as const;

/** The heartburn idol (px, 16×32): a fire cup (a rolled rim over a bowl) on a carved post, flared at the foot. */
export const TOTEM = { rim: [0, 3, 16, 2.5], bowl: [1, 5.5, 14, 2.5], post: [1.5, 8, 13, 21], foot: [0.5, 29, 15, 3] } as const;

/** The tower-defense tower under the ballista (px, 16×32): the ballista turns on its top. */
export const BALLISTA_TOWER = [1.5, 14, 13, 18] as const;

const rect = (r: readonly [number, number, number, number]) => box(r[0], r[1], r[2], r[3]);

export const LAUNCHER_FRAMES: Partial<Record<LauncherStyle, LauncherFrame>> = {
  // A hangar and the runway its planes roll out along.
  hangar: {
    cells: [
      [0, 0],
      [1, 0],
    ],
    at: [t(12), t(9)],
    shape: [
      ...stepsUnder(hangarRoof, HANGAR_ARCH.x0, HANGAR_ARCH.x1, 16),
      box(HANGAR_APRON.x0, HANGAR_APRON.top, HANGAR_APRON.x1 - HANGAR_APRON.x0, 16 - HANGAR_APRON.top),
    ],
  },
  // A ship's gun on its carriage: long, not tall.
  cannon: {
    cells: [
      [0, 0],
      [1, 0],
    ],
    at: [t(17), t(5)],
    shape: [rect(CANNON_CARRIAGE.bed), rect(CANNON_CARRIAGE.step), rect(CANNON_CARRIAGE.cheek)],
  },
  // A ballista on a tiny tower: the tower is a tile, the ballista another on top.
  ballista: {
    cells: [
      [0, 0],
      [0, 1],
    ],
    at: [t(7), t(10)],
    shape: [rect(BALLISTA_TOWER)],
  },
  // A vending machine: a tall cabinet, the stars coming out of the tray.
  thrower: {
    cells: [
      [0, 0],
      [0, 1],
    ],
    at: [t(8), t(21)],
  },
  // A tiki torch: a post with the fire on top.
  totem: {
    cells: [
      [0, 0],
      [0, 1],
    ],
    at: [t(8), t(4)],
    shape: [rect(TOTEM.rim), rect(TOTEM.bowl), rect(TOTEM.post), rect(TOTEM.foot)],
  },
  // A gumball machine: the globe on its stand, the chute between.
  gumball: {
    cells: [
      [0, 0],
      [0, 1],
    ],
    at: [t(8), t(21)],
    shape: [rect(GUMBALL.cap), ...stepsRound(GUMBALL.globe[0], GUMBALL.globe[1], GUMBALL.globe[2]), rect(GUMBALL.neck), rect(GUMBALL.body), rect(GUMBALL.foot)],
  },
};

/** The frame a launcher of this style stands in: one tile unless it's listed. */
export const launcherFrame = (style: LauncherStyle): LauncherFrame => LAUNCHER_FRAMES[style] ?? ONE;

/** The block a launcher stands on: its style's cells, and its sub-tile shape when the machine doesn't fill them. */
export function launcherBody(style: LauncherStyle, material: Material): ModuleOf<'body'> {
  const { cells, shape } = launcherFrame(style);
  return { type: 'body', cells: cells.slice(), material, conveyor: 0, breakFrames: 0, respawnFrames: 0, ...(shape ? { shape: shape.slice() } : {}) };
}
