import { TILE, VIEW_H, VIEW_W } from '../sim/constants';
import type { Level } from '../sim/level';

/**
 * Deterministic world ↔ view mappings. The logical view is always
 * VIEW_W×VIEW_H; levels can be any size, so something has to decide what
 * part of the world is on screen.
 *
 * During pick/place every player shares one screen, so the camera shows the
 * WHOLE level (`overview`): it is a pure function of the level, which lets
 * the match (sim side, deterministic) turn a pointer position into a world
 * position without asking the renderer. The renderer snaps its camera to the
 * same mapping in those phases, so ghosts land exactly under cursors.
 *
 * Classic 48×27 levels map 1:1 (zoom 1, no offset).
 */

export interface ViewXform {
  /** World px at the centre of the view. */
  cx: number;
  cy: number;
  /** View px per world px. */
  zoom: number;
}

/** Smallest overview zoom we allow (a 60-row level fits at 0.45); profile sizes stay above it. */
export const MIN_OVERVIEW_ZOOM = 0.4;

/** Whole level, centred both ways; never magnified above 1. */
export function overview(level: Level): ViewXform {
  const ww = level.w * TILE;
  const wh = level.h * TILE;
  const zoom = Math.max(MIN_OVERVIEW_ZOOM, Math.min(1, VIEW_W / ww, VIEW_H / wh));
  return { cx: ww / 2, cy: wh / 2, zoom };
}

/**
 * Lowest zoom a race may use: the whole level, and a little more, so a runner
 * at the map's edge still has a margin. Every live runner is always framed, so
 * this is the only limit on how far out the camera goes.
 */
export function raceFloor(level: Level): number {
  return overview(level).zoom * 0.92;
}

export function worldToView(v: ViewXform, x: number, y: number): { x: number; y: number } {
  return { x: (x - v.cx) * v.zoom + VIEW_W / 2, y: (y - v.cy) * v.zoom + VIEW_H / 2 };
}

export function viewToWorld(v: ViewXform, x: number, y: number): { x: number; y: number } {
  return { x: (x - VIEW_W / 2) / v.zoom + v.cx, y: (y - VIEW_H / 2) / v.zoom + v.cy };
}
