import type { Rect } from '../../core/geom';
import { PHYS, PLAYER_H, PLAYER_W, RUN_COUNTDOWN, TILE } from '../../sim/constants';
import { type Level, type Ride, T_EMPTY, tileAt } from '../../sim/level';
import { isStandable } from '../../sim/reach';
import { buildSolids, type Contrib, motionOffset, newPropState, type PlacedProp, type PropCtx, type Resolved, resolveProp, traceRays } from '../../sim/props';
import '../../sim/props/modules';
import { cycleFrames } from '../setpieces/place';
import { jumpProfile } from './probe';
import { BRIDGE_W } from './types';
import { MAX_BRIDGES } from './validate';

/**
 * Carrier landmarks (docs/SETPIECES.md, decision 1a): a contraption big
 * enough to carry you over a gap no part could, proven the only way a static
 * proof can be about something that moves. The carrier has to park: a stretch
 * of at least MIN_DWELL frames with every one of its solids still, at one
 * end and then at the other. A runner who walks onto its top while it's parked
 * at one end and stands still is carried, by the same rule the sim carries
 * every rider (physics.ts: stepBody rides `groundRef`), to the matching cell
 * at the other end, and walks off while it's parked there. That holds when:
 *
 * - the carrier never hurts, pushes, blows or catches (no hazards, springs,
 *   winds or triggers, ever);
 * - it parks tile-aligned at both ends, so the cells line up with the grid;
 * - the standing rider's box stays out of every non-empty tile and every
 *   other solid of the carrier the whole way;
 * - the cells you step on from and off to are standable without it, and
 *   outside everything it sweeps, so it can't shove you while you wait.
 *
 * Each such crossing is a `Ride` (sim/level.ts): reach.ts takes it as one
 * move while both ends stand and the rider's path is empty, which keeps it
 * sound as parts go in during a match (a placed block or another part's
 * barrier in the path closes it). A side wind closes every ride. Nothing
 * here models riding while you move; anything this can't prove keeps a
 * static way past, as every other concept does.
 */

/** Frames a carrier stays parked at each end: time to step on, or off. */
export const MIN_DWELL = 30;

/**
 * The smallest crossing a carrier may make, at this level's gravity: wider
 * (or taller) than MAX_BRIDGES parts could close, so it reads as a set piece
 * and not a cheat. `cols` counts the empty columns between the cell you board
 * from and the one you land on; `rows` the height between them.
 */
export function carrierReach(): { cols: number; rows: number } {
  const j = jumpProfile();
  return { cols: j.gap + MAX_BRIDGES * (BRIDGE_W + j.walkGap) + 1, rows: (MAX_BRIDGES + 1) * (j.rise + 1) + 1 };
}

/** Does this ride cross a carrier's gap: at least carrierReach() plus `extra`, across or up? */
export function rideSpans(w: number, r: Ride, extra = 0): boolean {
  const reach = carrierReach();
  const bx = r.board % w;
  const ax = r.alight % w;
  const rows = Math.abs((r.alight - ax) / w - (r.board - bx) / w);
  return Math.abs(ax - bx) - 1 >= reach.cols + extra || rows >= reach.rows + extra;
}

interface Snap {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

const EPS = 1e-6;
const aligned = (v: number) => Math.abs(v / TILE - Math.round(v / TILE)) < EPS;

/** Tiles a px rect overlaps, as cell keys. */
function cellsOf(level: Level, r: Rect, out: Set<number>): void {
  const x0 = Math.floor(r.x / TILE + EPS);
  const x1 = Math.ceil((r.x + r.w) / TILE - EPS) - 1;
  const y0 = Math.floor(r.y / TILE + EPS);
  const y1 = Math.ceil((r.y + r.h) / TILE - EPS) - 1;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.add(x < 0 || y < 0 || x >= level.w || y >= level.h ? -1 : y * level.w + x);
}

/**
 * The crossings `pp` is proven to carry a runner over in `level` (see above),
 * both ways, or [] if it can't be shown to carry anyone. Samples two of its
 * cycles from the race start, frame by frame.
 */
export function rideProof(level: Level, pp: PlacedProp): Ride[] {
  const r = resolveProp(pp);
  const P = cycleFrames(r.mods, r.motion);
  const state = newPropState();
  const out: Contrib = { solids: [], hazards: [], springs: [], winds: [], triggers: [] };
  const frames: Snap[][] = [];
  for (let f = RUN_COUNTDOWN; f < RUN_COUNTDOWN + 2 * P; f++) {
    out.solids.length = out.hazards.length = out.springs.length = out.winds.length = out.triggers!.length = 0;
    const ctx = (rr: Resolved, mi: number): PropCtx => ({
      level,
      frame: f,
      r: rr,
      off: motionOffset(rr, f),
      prev: motionOffset(rr, f - 1),
      state,
      mi,
      live: true,
    });
    buildSolids([r], ctx, out);
    traceRays([r], ctx, out);
    if (out.hazards.length || out.springs.length || out.winds.length || out.triggers!.length) return [];
    frames.push(out.solids.map((s) => ({ id: s.id, x: s.x, y: s.y, w: s.w, h: s.h })).sort((a, b) => a.id - b.id));
  }
  // Everything it ever sweeps: you can't wait there for it.
  const swept = new Set<number>();
  for (const fr of frames) for (const s of fr) cellsOf(level, s, swept);

  // Parked stretches, in time order.
  const same = (a: Snap[], b: Snap[]) =>
    a.length === b.length && a.every((s, i) => s.id === b[i].id && s.x === b[i].x && s.y === b[i].y && s.w === b[i].w && s.h === b[i].h);
  const parks: { from: number; to: number }[] = [];
  for (let i = 0; i < frames.length;) {
    let j = i;
    while (j + 1 < frames.length && same(frames[i], frames[j + 1])) j++;
    if (j - i + 1 >= MIN_DWELL) parks.push({ from: i, to: j });
    i = j + 1;
  }

  const rides = new Map<string, Ride>();
  for (let p = 0; p + 1 < parks.length; p++) {
    const A = frames[parks[p].from];
    const B = frames[parks[p + 1].from];
    if (same(A, B)) continue;
    // A rigid carrier: every solid parks on the grid at both ends, all moved the same whole tiles.
    if (A.length !== B.length || !A.every((a, i) => B[i].id === a.id && [a.x, a.y, a.w, B[i].x, B[i].y].every(aligned))) continue;
    const dx = Math.round((B[0].x - A[0].x) / TILE);
    const dy = Math.round((B[0].y - A[0].y) / TILE);
    if (!A.every((a, i) => B[i].x - a.x === dx * TILE && B[i].y - a.y === dy * TILE)) continue;
    const move = frames.slice(parks[p].to, parks[p + 1].from + 1);
    const dwell = Math.min(parks[p].to - parks[p].from, parks[p + 1].to - parks[p + 1].from) + 1;
    for (const deck of decks(A)) {
      // While parked you walk the deck to your spot, or off it: that has to fit in the stop.
      if (dwell < MIN_DWELL + (deck.x1 - deck.x0 + 1) * TILE_FRAMES) continue;
      const ty = deck.y;
      let ridden: Set<number> | null = null;
      for (let tx = deck.x0; tx <= deck.x1 && !ridden; tx++) ridden = riderPath(level, deck.solid[tx - deck.x0], tx, move);
      if (!ridden) continue;
      // The deck at both stops is walked on too.
      const path = new Set(ridden);
      for (let tx = deck.x0; tx <= deck.x1; tx++) {
        path.add(ty * level.w + tx);
        path.add((ty + dy) * level.w + tx + dx);
      }
      if ([...path].some((k) => k < 0 || k >= level.tiles.length || level.tiles[k] !== T_EMPTY)) continue;
      // Step on from beside it and off beside it: from the ground, never from the carrier.
      for (const bx of [deck.x0 - 1, deck.x1 + 1]) {
        for (const ux of [deck.x0 + dx - 1, deck.x1 + dx + 1]) {
          const board = ty * level.w + bx;
          const alight = (ty + dy) * level.w + ux;
          if (!isStandable(level, bx, ty) || !isStandable(level, ux, ty + dy) || swept.has(board) || swept.has(alight)) continue;
          rides.set(`${board}:${alight}`, { uid: pp.uid, board, alight, path: [...path].filter((k) => k !== board && k !== alight).sort((m, n) => m - n) });
        }
      }
    }
  }
  return [...rides.values()];
}

/** Frames a walk takes per tile (PHYS.walkSpeed), rounded up, with a frame to spare. */
const TILE_FRAMES = Math.ceil((TILE * 60) / PHYS.walkSpeed) + 1;

/** Runs of stand cells on top of a parked carrier, left to right per row, with the solid under each cell. */
function decks(A: Snap[]): { y: number; x0: number; x1: number; solid: Snap[] }[] {
  const tops = new Map<number, Snap>();
  for (const s of A) {
    const ty = Math.round(s.y / TILE) - 1;
    for (let tx = Math.round(s.x / TILE); tx < Math.round((s.x + s.w) / TILE); tx++) {
      // A cell another of its solids fills isn't a stand cell.
      const covered = A.some((o) => o !== s && o.x <= tx * TILE && o.x + o.w >= (tx + 1) * TILE && o.y <= ty * TILE && o.y + o.h >= (ty + 1) * TILE);
      if (!covered) tops.set(ty * 1e6 + tx, s);
    }
  }
  const out: { y: number; x0: number; x1: number; solid: Snap[] }[] = [];
  for (const k of [...tops.keys()].sort((a, b) => a - b)) {
    const y = Math.floor(k / 1e6);
    const x = k - y * 1e6;
    const last = out[out.length - 1];
    if (last && last.y === y && last.x1 === x - 1) {
      last.x1 = x;
      last.solid.push(tops.get(k)!);
    } else out.push({ y, x0: x, x1: x, solid: [tops.get(k)!] });
  }
  return out;
}

/**
 * Cells a runner standing still on solid `a`'s top, in column tx, passes
 * through over `move` (the frames from one park to the next), or null if
 * anything is in its way: a non-empty tile, or another of the carrier's solids.
 */
function riderPath(level: Level, a: Snap, tx: number, move: Snap[][]): Set<number> | null {
  const rel = tx * TILE - a.x + (TILE - PLAYER_W) / 2;
  const cells = new Set<number>();
  for (const fr of move) {
    const s = fr.find((q) => q.id === a.id);
    if (!s) return null;
    const box: Rect = { x: s.x + rel, y: s.y - PLAYER_H, w: PLAYER_W, h: PLAYER_H };
    if (box.x < s.x - EPS || box.x + box.w > s.x + s.w + EPS) return null;
    for (const o of fr) if (o.id !== a.id && box.x < o.x + o.w && box.x + box.w > o.x && box.y < o.y + o.h && box.y + box.h > o.y) return null;
    cellsOf(level, box, cells);
  }
  if (cells.has(-1)) return null;
  for (const k of cells) if (tileAt(level, k % level.w, Math.floor(k / level.w)) !== T_EMPTY) return null;
  return cells;
}
