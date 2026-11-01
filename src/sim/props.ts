import { frac, pingPong, rotateCells, rotateVec, type Cell, type Rect, type Vec } from '../core/geom';
import type { PropDef } from '../gen/props';
import { TILE } from './constants';
import { isProtected, tileAt, type Level } from './level';
import { DEFAULT_SURFACE, type Surface } from './physics';

export interface PlacedProp {
  uid: number;
  def: PropDef;
  /** Player slot that placed it (for trap credit). */
  owner: number;
  tx: number;
  ty: number;
  rot: number;
}

export const SURFACES: Record<string, Surface> = {
  stone: DEFAULT_SURFACE,
  ice: { friction: 0.12, conveyor: 0, speedMult: 1.15, jumpMult: 1 },
  sticky: { friction: 1.4, conveyor: 0, speedMult: 0.5, jumpMult: 0.72 },
};

export function conveyorSurface(speed: number): Surface {
  return { friction: 1, conveyor: speed, speedMult: 1, jumpMult: 1 };
}

/** Base direction each directional prop faces at rot 0. */
const BASE_DIR: Partial<Record<PropDef['kind'], Vec>> = {
  spring: [0, -1],
  fan: [0, -1],
  turret: [1, 0],
};

export function propDir(def: PropDef, rot: number): Vec {
  return rotateVec(BASE_DIR[def.kind] ?? [1, 0], rot);
}

/** Cells (relative to the prop origin) the prop occupies for placement purposes. */
export function footprint(def: PropDef, rot: number): Cell[] {
  switch (def.kind) {
    case 'block':
    case 'spikes':
    case 'crumble':
      return rotateCells(def.cells, rot);
    case 'mover':
      return Array.from({ length: def.length }, (_, i) => [i, 0] as Cell);
    default:
      return [[0, 0]];
  }
}

export function footprintCells(pp: Pick<PlacedProp, 'def' | 'rot' | 'tx' | 'ty'>): Cell[] {
  return footprint(pp.def, pp.rot).map(([x, y]) => [x + pp.tx, y + pp.ty] as Cell);
}

/** Can this prop go here? Bombs can go anywhere in-bounds; everything else needs free, unprotected cells. */
export function canPlace(level: Level, placed: readonly PlacedProp[], def: PropDef, rot: number, tx: number, ty: number): boolean {
  const cells = footprint(def, rot).map(([x, y]) => [x + tx, y + ty] as Cell);
  for (const [x, y] of cells) {
    if (x < 0 || y < 0 || x >= level.w || y >= level.h) return false;
  }
  if (def.kind === 'bomb') return true;
  const taken = new Set<number>();
  for (const p of placed) for (const [x, y] of footprintCells(p)) taken.add(y * level.w + x);
  for (const [x, y] of cells) {
    if (tileAt(level, x, y) || isProtected(level, x, y) || taken.has(y * level.w + x)) return false;
  }
  return true;
}

/** Deterministic per-prop phase offset so identical props don't move in lockstep. */
export function propPhase(uid: number): number {
  return frac(uid * 0.6180339887);
}

/** Unit axis of travel for movers/saws, after rotation. */
export function travelAxis(axis: 'h' | 'v', rot: number): Vec {
  return rotateVec(axis === 'h' ? [1, 0] : [0, -1], rot);
}

export function moverRect(pp: PlacedProp, frame: number): Rect {
  if (pp.def.kind !== 'mover') throw new Error('not a mover');
  const d = pp.def;
  const [ax, ay] = travelAxis(d.axis, pp.rot);
  const t = pingPong(frame / d.period + propPhase(pp.uid)) * d.range * TILE;
  return { x: pp.tx * TILE + ax * t, y: pp.ty * TILE + ay * t, w: d.length * TILE, h: TILE / 2 };
}

export function sawCircle(pp: PlacedProp, frame: number): { x: number; y: number; r: number } {
  if (pp.def.kind !== 'saw') throw new Error('not a saw');
  const d = pp.def;
  const [ax, ay] = travelAxis(d.axis, pp.rot);
  const t = d.range ? pingPong(frame / d.period + propPhase(pp.uid)) * d.range * TILE : 0;
  return { x: (pp.tx + 0.5) * TILE + ax * t, y: (pp.ty + 0.5) * TILE + ay * t, r: d.radius * TILE * 0.85 };
}

/** Wind zone of a fan, truncated at the first solid tile. */
export function fanZone(level: Level, pp: PlacedProp): Rect & { ax: number; ay: number } {
  if (pp.def.kind !== 'fan') throw new Error('not a fan');
  const [dx, dy] = propDir(pp.def, pp.rot);
  let len = 0;
  while (len < pp.def.length && !tileAt(level, pp.tx + dx * (len + 1), pp.ty + dy * (len + 1))) len++;
  const x0 = Math.min(pp.tx, pp.tx + dx * len) + (dx > 0 ? 1 : 0);
  const y0 = Math.min(pp.ty, pp.ty + dy * len) + (dy > 0 ? 1 : 0);
  const w = dx !== 0 ? len : 1;
  const h = dy !== 0 ? len : 1;
  return { x: x0 * TILE - 2, y: y0 * TILE - 2, w: w * TILE + 4, h: h * TILE + 4, ax: dx * pp.def.strength, ay: dy * pp.def.strength };
}

/** Bomb: clear unprotected tiles and placed props within radius. Returns the surviving props. */
export function detonate(level: Level, placed: PlacedProp[], radius: number, tx: number, ty: number): PlacedProp[] {
  const cx = tx + 0.5;
  const cy = ty + 0.5;
  const within = (x: number, y: number) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= radius * radius;
  const r = Math.ceil(radius);
  for (let y = ty - r; y <= ty + r; y++) {
    for (let x = tx - r; x <= tx + r; x++) {
      if (x < 0 || y < 0 || x >= level.w || y >= level.h) continue;
      if (within(x, y) && !isProtected(level, x, y)) level.tiles[y * level.w + x] = 0;
    }
  }
  level.version++;
  return placed.filter((p) => !footprintCells(p).some(([x, y]) => within(x, y)));
}
