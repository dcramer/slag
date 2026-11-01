import { frac, pingPong, type Cell, type Rect, type Vec } from '../core/geom';
import type { Module, Motion, PropDef } from '../gen/props';
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

/**
 * A placed prop with every module transformed into world space:
 * points/lengths in pixels, cells in world tile coords, angles rotated.
 */
export interface Resolved {
  pp: PlacedProp;
  mods: Module[];
  motion: Motion;
  phase: number;
}

export const SURFACES: Record<string, Surface> = {
  stone: DEFAULT_SURFACE,
  metal: DEFAULT_SURFACE,
  wood: DEFAULT_SURFACE,
  crumble: DEFAULT_SURFACE,
  ice: { friction: 0.12, conveyor: 0, speedMult: 1.15, jumpMult: 1, bounce: 0 },
  goo: { friction: 1.4, conveyor: 0, speedMult: 0.5, jumpMult: 0.72, bounce: 0 },
  jelly: { friction: 1, conveyor: 0, speedMult: 1, jumpMult: 1.05, bounce: 0.82 },
};

export function conveyorSurface(speed: number): Surface {
  return { ...DEFAULT_SURFACE, conveyor: speed };
}

/** Deterministic per-prop phase offset so identical props don't move in lockstep. */
export function propPhase(uid: number): number {
  return frac(uid * 0.6180339887);
}

function box(def: PropDef): { w: number; h: number } {
  let w = 1;
  let h = 1;
  for (const [x, y] of def.footprint) {
    w = Math.max(w, x + 1);
    h = Math.max(h, y + 1);
  }
  return { w, h };
}

/** Rotate a point (tile units, in the def's box) by quarter turns clockwise. */
function rotPoint(p: Vec, rot: number, w: number, h: number): Vec {
  let [x, y] = p;
  for (let i = 0; i < rot; i++) {
    [x, y] = [h - y, x];
    [w, h] = [h, w];
  }
  return [x, y];
}

function rotCell(c: Cell, rot: number, w: number, h: number): Cell {
  const [x, y] = rotPoint([c[0] + 0.5, c[1] + 0.5], rot, w, h);
  return [Math.floor(x), Math.floor(y)];
}

/** Cells (relative to the prop origin) the prop occupies for placement purposes. */
export function footprint(def: PropDef, rot: number): Cell[] {
  const { w, h } = box(def);
  return def.footprint.map((c) => rotCell(c, rot & 3, w, h));
}

export function footprintCells(pp: Pick<PlacedProp, 'def' | 'rot' | 'tx' | 'ty'>): Cell[] {
  return footprint(pp.def, pp.rot).map(([x, y]) => [x + pp.tx, y + pp.ty] as Cell);
}

export function resolveProp(pp: PlacedProp): Resolved {
  const { w, h } = box(pp.def);
  const rot = pp.rot & 3;
  const da = (rot * Math.PI) / 2;
  const P = (p: Vec): Vec => {
    const [x, y] = rotPoint(p, rot, w, h);
    return [(pp.tx + x) * TILE, (pp.ty + y) * TILE];
  };
  const C = (cs: Cell[]): Cell[] => cs.map((c) => {
    const [x, y] = rotCell(c, rot, w, h);
    return [x + pp.tx, y + pp.ty] as Cell;
  });
  const mods: Module[] = pp.def.modules.map((m): Module => {
    switch (m.type) {
      case 'body':
        return { ...m, cells: C(m.cells) };
      case 'spikes':
        return { ...m, cells: C(m.cells), angle: m.angle + da };
      case 'swinger':
        return { ...m, hub: P(m.hub), arm: m.arm * TILE, radius: m.radius * TILE, angle0: m.angle0 + da };
      case 'launcher':
        return { ...m, at: P(m.at), angle: m.angle + da };
      case 'flame':
        return { ...m, at: P(m.at), angle: m.angle + da, length: m.length * TILE };
      case 'laser':
        return { ...m, at: P(m.at), angle: m.angle + da };
      case 'tesla':
        return { ...m, a: P(m.a), b: P(m.b) };
      case 'piston':
        return { ...m, at: P(m.at), angle: m.angle + da, reach: m.reach * TILE, width: m.width * TILE };
      case 'spring':
        return { ...m, at: P(m.at), angle: m.angle + da };
      case 'fan':
        return { ...m, at: P(m.at), angle: m.angle + da };
      case 'bomb':
        return m;
    }
  });
  const mo = pp.def.motion;
  const motion: Motion = mo.type === 'rail' ? { ...mo, angle: mo.angle + da, range: mo.range * TILE } : mo.type === 'loop' ? { ...mo, radius: mo.radius * TILE } : mo;
  return { pp, mods, motion, phase: propPhase(pp.uid) };
}

/** Whole-prop translation (px) at frame f. */
export function motionOffset(r: Resolved, f: number): Vec {
  const m = r.motion;
  if (m.type === 'rail') {
    const d = pingPong(f / m.period + r.phase) * m.range;
    return [snap(Math.cos(m.angle)) * d, snap(Math.sin(m.angle)) * d];
  }
  if (m.type === 'loop') {
    const a = m.dir * Math.PI * 2 * (f / m.period + r.phase);
    return [(Math.cos(a) - 1) * m.radius, Math.sin(a) * m.radius];
  }
  return [0, 0];
}

/** Round tiny float noise from cos/sin of axis-aligned angles. */
export function snap(v: number): number {
  return Math.abs(v) < 1e-9 ? 0 : Math.abs(Math.abs(v) - 1) < 1e-9 ? Math.sign(v) : v;
}

export function dirOf(angle: number): Vec {
  return [snap(Math.cos(angle)), snap(Math.sin(angle))];
}

/** Angles of each swinger head at frame f. */
export function swingAngles(m: Extract<Module, { type: 'swinger' }>, f: number, phase: number): number[] {
  if (m.swing > 0) return [m.angle0 + m.swing * Math.sin(Math.PI * 2 * (f / m.period + phase))];
  const base = m.angle0 + m.dir * Math.PI * 2 * (f / m.period + phase);
  return Array.from({ length: m.count }, (_, i) => base + (i * Math.PI * 2) / m.count);
}

export function swingHeads(m: Extract<Module, { type: 'swinger' }>, f: number, phase: number, off: Vec): { x: number; y: number; a: number }[] {
  return swingAngles(m, f, phase).map((a) => ({ x: m.hub[0] + off[0] + Math.cos(a) * m.arm, y: m.hub[1] + off[1] + Math.sin(a) * m.arm, a }));
}

export interface CycleState {
  /** Index of the current segment. */
  seg: number;
  /** Frames into the segment. */
  t: number;
  len: number;
}

/** Position within a repeating sequence of segments, offset by the prop's phase. */
export function cycle(f: number, phase: number, lens: number[]): CycleState {
  const total = lens.reduce((a, b) => a + b, 0);
  let t = (((f + Math.floor(phase * total)) % total) + total) % total;
  for (let i = 0; i < lens.length; i++) {
    if (t < lens[i]) return { seg: i, t, len: lens[i] };
    t -= lens[i];
  }
  return { seg: lens.length - 1, t: 0, len: lens[lens.length - 1] };
}

export const flameCycle = (m: Extract<Module, { type: 'flame' }>, f: number, phase: number) => cycle(f, phase, [m.off, m.warn, m.on]);
export const laserCycle = (m: Extract<Module, { type: 'laser' }>, f: number, phase: number) => cycle(f, phase, [m.off, m.charge, m.fire]);
export const teslaCycle = (m: Extract<Module, { type: 'tesla' }>, f: number, phase: number) => cycle(f, phase, [m.off, m.warn, m.on]);

export function laserAngle(m: Extract<Module, { type: 'laser' }>, f: number, phase: number): number {
  return m.sweep ? m.angle + m.sweep * Math.sin(Math.PI * 2 * (f / m.sweepPeriod + phase)) : m.angle;
}

export function launcherAngle(m: Extract<Module, { type: 'launcher' }>, f: number, phase: number): number {
  return m.aim === 'sweep' ? m.angle + m.sweep * Math.sin(Math.PI * 2 * (f / m.sweepPeriod + phase)) : m.angle;
}

/** Piston extension 0..1 and whether it's currently slamming outward. */
export function pistonState(m: Extract<Module, { type: 'piston' }>, f: number, phase: number): { ext: number; slamming: boolean } {
  const t = frac(f / m.period + phase);
  if (t < 0.12) return { ext: (t / 0.12) ** 2, slamming: true };
  if (t < 0.45) return { ext: 1, slamming: false };
  if (t < 0.9) {
    const u = (t - 0.45) / 0.45;
    return { ext: 1 - u * u * (3 - 2 * u), slamming: false };
  }
  return { ext: 0, slamming: false };
}

export function pistonHead(m: Extract<Module, { type: 'piston' }>, ext: number, off: Vec): Rect {
  const [dx, dy] = dirOf(m.angle);
  const thick = TILE * 0.5;
  const d = TILE * 0.5 + thick / 2 + ext * m.reach;
  const cx = m.at[0] + off[0] + dx * d;
  const cy = m.at[1] + off[1] + dy * d;
  const w = dx !== 0 ? thick : m.width;
  const h = dx !== 0 ? m.width : thick;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

/** Distance (px) along a ray before it enters a solid tile. */
export function rayToWall(level: Level, x: number, y: number, angle: number, maxLen: number, skip = 6): number {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let d = skip; d < maxLen; d += 2) {
    const px = x + dx * d;
    const py = y + dy * d;
    if (px < 0 || px >= level.w * TILE || py >= level.h * TILE + 16 || py < -64) return d;
    if (tileAt(level, Math.floor(px / TILE), Math.floor(py / TILE))) return d;
  }
  return maxLen;
}

/** Wind zone of a fan, truncated at the first solid tile. */
export function fanZone(level: Level, m: Extract<Module, { type: 'fan' }>, off: Vec = [0, 0]): Rect & { ax: number; ay: number } {
  const [dx, dy] = dirOf(m.angle);
  const tx = Math.floor(m.at[0] / TILE);
  const ty = Math.floor(m.at[1] / TILE);
  let len = 0;
  while (len < m.length && !tileAt(level, tx + dx * (len + 1), ty + dy * (len + 1))) len++;
  const x0 = Math.min(tx, tx + dx * len) + (dx > 0 ? 1 : 0);
  const y0 = Math.min(ty, ty + dy * len) + (dy > 0 ? 1 : 0);
  const w = dx !== 0 ? len : 1;
  const h = dy !== 0 ? len : 1;
  return { x: x0 * TILE - 2 + off[0], y: y0 * TILE - 2 + off[1], w: w * TILE + 4, h: h * TILE + 4, ax: dx * m.strength, ay: dy * m.strength };
}

/** Can this prop go here? Bombs can go anywhere in-bounds; everything else needs free, unprotected cells. */
export function canPlace(level: Level, placed: readonly PlacedProp[], def: PropDef, rot: number, tx: number, ty: number): boolean {
  const cells = footprint(def, rot).map(([x, y]) => [x + tx, y + ty] as Cell);
  for (const [x, y] of cells) {
    if (x < 0 || y < 0 || x >= level.w || y >= level.h) return false;
  }
  if (def.archetype === 'bomb') return true;
  const taken = new Set<number>();
  for (const p of placed) for (const [x, y] of footprintCells(p)) taken.add(y * level.w + x);
  for (const [x, y] of cells) {
    if (tileAt(level, x, y) || isProtected(level, x, y) || taken.has(y * level.w + x)) return false;
  }
  return true;
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
