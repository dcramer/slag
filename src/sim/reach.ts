import { TILE } from './constants';
import { type Level, tileAt } from './level';
import { bodyAtCell, type CollisionWorld, stepBody } from './physics';

/**
 * Reachability analysis that uses the *real* player controller: from every
 * standable cell we simulate a fixed set of input scripts (jumps of varying
 * height, with varying air control) and record where the ghost lands. BFS
 * over that graph tells us whether the goal is reachable from spawn.
 *
 * It's conservative: wall-jumps and fancy air reversals aren't scripted, so
 * a level that passes is definitely beatable; a few beatable levels fail.
 */

interface Script {
  dir: -1 | 0 | 1;
  /** Frames the jump button is held (0 = walk off a ledge). */
  jumpFrames: number;
  /** Frames the direction is held before releasing. */
  dirFrames: number;
}

const SCRIPTS: Script[] = (() => {
  const out: Script[] = [];
  for (const dir of [-1, 1] as const) {
    for (const jumpFrames of [0, 5, 99]) {
      for (const dirFrames of [99, 10, 20]) {
        if (jumpFrames === 0 && dirFrames !== 99) continue;
        out.push({ dir, jumpFrames, dirFrames });
      }
    }
  }
  out.push({ dir: 0, jumpFrames: 99, dirFrames: 0 });
  return out;
})();

const MAX_FRAMES = 110;

export function isStandable(level: Level, tx: number, ty: number): boolean {
  return tx >= 0 && tx < level.w && ty >= 0 && ty < level.h - 1 && !tileAt(level, tx, ty) && !!tileAt(level, tx, ty + 1);
}

export interface ReachResult {
  goalReached: boolean;
  reachable: Set<number>;
}

export function analyzeReach(level: Level, stopAtGoal = true): ReachResult {
  const world: CollisionWorld = { tileAt: (x, y) => tileAt(level, x, y), solids: [] };
  const key = (x: number, y: number) => y * level.w + x;
  const goalKey = key(level.goal.tx, level.goal.ty);
  const seen = new Set<number>();
  const queue: number[] = [];
  const push = (x: number, y: number) => {
    const k = key(x, y);
    if (!seen.has(k)) {
      seen.add(k);
      queue.push(k);
    }
  };
  if (!isStandable(level, level.spawn.tx, level.spawn.ty)) return { goalReached: false, reachable: seen };
  push(level.spawn.tx, level.spawn.ty);

  while (queue.length) {
    const k = queue.shift()!;
    if (k === goalKey && stopAtGoal) return { goalReached: true, reachable: seen };
    const tx = k % level.w;
    const ty = (k - tx) / level.w;
    for (const nx of [tx - 1, tx + 1]) if (isStandable(level, nx, ty)) push(nx, ty);
    for (const s of SCRIPTS) {
      const land = simulate(level, world, tx, ty, s);
      if (land) push(land[0], land[1]);
    }
  }
  return { goalReached: seen.has(goalKey), reachable: seen };
}

function simulate(level: Level, world: CollisionWorld, tx: number, ty: number, s: Script): [number, number] | null {
  const b = bodyAtCell(tx, ty);
  let airborne = false;
  for (let f = 0; f < MAX_FRAMES; f++) {
    const holdDir = f < s.dirFrames;
    stepBody(
      b,
      {
        left: holdDir && s.dir < 0,
        right: holdDir && s.dir > 0,
        jump: f < s.jumpFrames,
        jumpPressed: f === 0 && s.jumpFrames > 0,
      },
      world,
    );
    if (b.y > level.h * TILE) return null;
    if (!b.onGround) airborne = true;
    else if (airborne) {
      const fy = Math.floor((b.y + b.h - 1) / TILE);
      for (const fx of [Math.floor((b.x + b.w / 2) / TILE), Math.floor(b.x / TILE), Math.floor((b.x + b.w - 1) / TILE)]) {
        if (isStandable(level, fx, fy)) return [fx, fy];
      }
      return null;
    } else if (f > 30) return null; // walked along flat ground; neighbor edges cover that
  }
  return null;
}
