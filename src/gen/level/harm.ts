import type { Rect } from '../../core/geom';
import { RUN_COUNTDOWN, TILE } from '../../sim/constants';
import type { Level } from '../../sim/level';
import { footprintCells, markHazard, moduleSim, motionOffset, type PlacedProp } from '../../sim/props';
import { RunWorld } from '../../sim/run';
import { SET_PIECE_UID } from '../setpieces';
import { isBox } from './measure';

/**
 * Where a level's set pieces can get at someone: the cells they stand in, every cell their hazards touch and their
 * shots fly through over a few volleys of the slowest gun (the real sim, so a shot glancing off another piece goes
 * where it really goes), and the zones that set one off, each grown by a tile. A level's own pickups (boxes, stands)
 * keep out of it: nobody should have to stand in a cannon's line to take a weapon, nor see one drawn over a piece.
 */

/** Frames played: past every set piece's cycle, and a few volleys of the slowest gun (as `shotsIntoSpawns`). */
const HARM_FRAMES = 900;
/** Tiles of room kept round whatever a piece reaches. */
const ROOM = 1;

/** Cell keys (y * w + x) within `ROOM` of something `pieces` reach in `level` (its boxes and stands left out). */
export function harmReach(level: Level, pieces: readonly PlacedProp[]): Set<number> {
  const { w, h } = level;
  const hit = new Set<number>();
  const mark = (rc: Rect) => {
    const x0 = Math.max(0, Math.floor(rc.x / TILE));
    const x1 = Math.min(w - 1, Math.ceil((rc.x + rc.w) / TILE) - 1);
    const y0 = Math.max(0, Math.floor(rc.y / TILE));
    const y1 = Math.min(h - 1, Math.ceil((rc.y + rc.h) / TILE) - 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) hit.add(y * w + x);
  };
  // Numbered as the level will number them, so each plays as it will (its state is keyed by uid).
  const real = pieces.filter((p) => !isBox(p.def.key)).map((p, i) => ({ ...p, uid: SET_PIECE_UID + i }));
  for (const p of real) for (const [x, y] of footprintCells(p)) if (x >= 0 && y >= 0 && x < w && y < h) hit.add(y * w + x);
  if (real.length) {
    const run = new RunWorld({ ...level, setPieces: real }, [], []);
    for (let f = 0; f < RUN_COUNTDOWN + HARM_FRAMES; f++) {
      run.step([]);
      if (f < RUN_COUNTDOWN) continue;
      for (const hz of run.hazards) markHazard(hz, mark);
      for (const p of run.projectiles) mark({ x: p.x - 4, y: p.y - 4, w: 8, h: 8 });
      // What a runner would set off (a dropper's lane, a snapper's plate), as it stands armed.
      if (f === RUN_COUNTDOWN)
        for (const r of run.resolved)
          r.mods.forEach((m, mi) => {
            const ctx = {
              level: run.level,
              frame: f,
              r,
              off: motionOffset(r, f),
              prev: motionOffset(r, f - 1),
              state: run.propState.get(r.pp.uid)!,
              mi,
              live: true,
            };
            for (const z of moduleSim(m.type).sense?.(m, { ...ctx, solids: run.solids }) ?? []) mark(z);
          });
    }
  }
  const grown = new Set<number>();
  for (const k of hit) {
    const x = k % w;
    const y = (k - x) / w;
    for (let dy = -ROOM; dy <= ROOM; dy++)
      for (let dx = -ROOM; dx <= ROOM; dx++) {
        const cx = x + dx;
        const cy = y + dy;
        if (cx >= 0 && cy >= 0 && cx < w && cy < h) grown.add(cy * w + cx);
      }
  }
  return grown;
}

/** Where a stand at (x, y) is reached: its own cell or the one over it, where whoever takes from it stands. */
export const harmed = (reach: ReadonlySet<number>, w: number, x: number, y: number) => reach.has(y * w + x) || reach.has((y - 1) * w + x);
