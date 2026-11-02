import { type Cell, frac, pingPong, type Vec } from '../../core/geom';
import { TILE } from '../constants';
import { isProtected, type Level, T_EMPTY, T_SOLID, tileAt } from '../level';
import { moduleSim, type Xform } from './registry';
import type { Motion, PlacedProp, PropDef, PropState, Resolved } from './types';

/** Deterministic per-prop phase offset so identical props don't move in lockstep. */
export function propPhase(uid: number): number {
  return frac(uid * 0.6180339887);
}

export function newPropState(): PropState {
  return { triggerFrame: -1, brokenUntil: -1, lastFire: -999, aim: new Map(), vars: new Map() };
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
  const x: Xform = {
    P: (p) => {
      const [px, py] = rotPoint(p, rot, w, h);
      return [(pp.tx + px) * TILE, (pp.ty + py) * TILE];
    },
    C: (cs) =>
      cs.map((c) => {
        const [cx, cy] = rotCell(c, rot, w, h);
        return [cx + pp.tx, cy + pp.ty] as Cell;
      }),
    da: (rot * Math.PI) / 2,
    T: TILE,
  };
  const mods = pp.def.modules.map((m) => moduleSim(m.type).resolve(m, x));
  const mo = pp.def.motion;
  const motion: Motion =
    mo.type === 'rail' ? { ...mo, angle: mo.angle + x.da, range: mo.range * TILE } : mo.type === 'loop' ? { ...mo, radius: mo.radius * TILE } : mo;
  return { pp, mods, motion, phase: propPhase(pp.uid) };
}

/** Round tiny float noise from cos/sin of axis-aligned angles. */
export function snap(v: number): number {
  return Math.abs(v) < 1e-9 ? 0 : Math.abs(Math.abs(v) - 1) < 1e-9 ? Math.sign(v) : v;
}

export function dirOf(angle: number): Vec {
  return [snap(Math.cos(angle)), snap(Math.sin(angle))];
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

/** Distance (px) along a ray before it enters a solid tile. */
export function rayToWall(level: Level, x: number, y: number, angle: number, maxLen: number, skip = 6): number {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let d = skip; d < maxLen; d += 2) {
    const px = x + dx * d;
    const py = y + dy * d;
    if (px < 0 || px >= level.w * TILE || py >= level.h * TILE + 16 || py < -64) return d;
    if (tileAt(level, Math.floor(px / TILE), Math.floor(py / TILE)) === 1) return d;
  }
  return maxLen;
}

/** Can this prop go here? Bombs can go anywhere in-bounds; everything else needs free, unprotected cells. */
export function canPlace(level: Level, placed: readonly PlacedProp[], def: PropDef, rot: number, tx: number, ty: number): boolean {
  const cells = footprint(def, rot).map(([x, y]) => [x + tx, y + ty] as Cell);
  for (const [x, y] of cells) {
    if (x < 0 || y < 0 || x >= level.w || y >= level.h) return false;
  }
  if (def.archetype === 'bomb') return true;
  const taken = new Set<number>();
  const others = [...level.setPieces, ...(def.mount === 'face' ? placed.filter((p) => p.def.mount !== 'face') : placed)];
  for (const p of others) for (const [x, y] of footprintCells(p)) taken.add(y * level.w + x);
  if (def.mount === 'face') return canMount(level, placed, def, rot, cells, taken);
  for (const [x, y] of cells) {
    if (tileAt(level, x, y) || isProtected(level, x, y) || taken.has(y * level.w + x)) return false;
  }
  return true;
}

/** Outward face direction of a face-mounted def at a rotation. */
export function mountAngle(def: PropDef, rot: number): number {
  const m = def.modules.find((x) => x.type === 'coat');
  return (m && m.type === 'coat' ? m.angle : -Math.PI / 2) + ((rot & 3) * Math.PI) / 2;
}

const bodyCache = new WeakMap<readonly PlacedProp[], { n: number; last: PlacedProp | undefined; cells: Set<number> }>();

/** Cells of static placed blocks that attachments may mount on (cached per placed-list contents). */
function staticBodyCells(placed: readonly PlacedProp[], w: number): Set<number> {
  const hit = bodyCache.get(placed);
  if (hit && hit.n === placed.length && hit.last === placed[placed.length - 1]) return hit.cells;
  const out = new Set<number>();
  bodyCache.set(placed, { n: placed.length, last: placed[placed.length - 1], cells: out });
  for (const p of placed) {
    if (p.def.motion.type !== 'none') continue;
    for (const m of resolveProp(p).mods) {
      if (m.type === 'body' && m.material !== 'crumble') for (const [x, y] of m.cells) out.add(y * w + x);
    }
  }
  return out;
}

/**
 * Attachment rule: every cell must be a host (solid terrain or a static placed
 * block), unprotected, with its face (in the mount direction) exposed to an
 * empty, unclaimed cell that isn't already coated on that face.
 */
function canMount(level: Level, placed: readonly PlacedProp[], def: PropDef, rot: number, cells: Cell[], taken: Set<number>): boolean {
  const [dx, dy] = dirOf(mountAngle(def, rot));
  const blocks = staticBodyCells(placed, level.w);
  const coated = new Set<string>();
  for (const p of placed) {
    if (p.def.mount !== 'face') continue;
    const a = mountAngle(p.def, p.rot);
    for (const [x, y] of footprintCells(p)) coated.add(`${x},${y},${Math.round(a / (Math.PI / 2)) & 3}`);
  }
  const face = Math.round(mountAngle(def, rot) / (Math.PI / 2)) & 3;
  for (const [x, y] of cells) {
    const k = y * level.w + x;
    const host = tileAt(level, x, y) === T_SOLID || blocks.has(k);
    if (!host || isProtected(level, x, y)) return false;
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= level.w || ny >= level.h) return false;
    if (tileAt(level, nx, ny) !== T_EMPTY || blocks.has(ny * level.w + nx) || taken.has(ny * level.w + nx)) return false;
    if (coated.has(`${x},${y},${face}`)) return false;
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
  level.setPieces = level.setPieces.filter((p) => !footprintCells(p).some(([x, y]) => within(x, y)));
  level.version++;
  const survivors = placed.filter((p) => p.def.mount === 'face' || !footprintCells(p).some(([x, y]) => within(x, y)));
  // Attachments fall off when their host is gone.
  const blocks = staticBodyCells(survivors, level.w);
  return survivors.filter((p) => p.def.mount !== 'face' || footprintCells(p).every(([x, y]) => tileAt(level, x, y) === T_SOLID || blocks.has(y * level.w + x)));
}
