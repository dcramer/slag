import { dcos, dsin, sq } from '../../core/dmath';
import { type Cell, frac, pingPong, type Vec } from '../../core/geom';
import { TILE } from '../constants';
import { isProtected, type Level, T_EMPTY, T_SOLID, tileAt } from '../level';
import type { GameEvent } from '../types';
import { moduleSim, type Xform } from './registry';
import type { BlastShape, BlastTarget, ModuleOf, Motion, PlacedProp, PropDef, PropState, Resolved } from './types';

/** Deterministic per-prop phase offset so identical props don't move in lockstep. */
export function propPhase(uid: number): number {
  return frac(uid * 0.6180339887);
}

export function newPropState(): PropState {
  return { triggerFrame: -1, brokenUntil: -1, lastFire: -999, aim: new Map(), vars: new Map() };
}

function box(def: PropDef): { w: number; h: number } {
  if (def.box) return { w: def.box[0], h: def.box[1] };
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
  const turn = turnOf(def, rot);
  return def.footprint.map((c) => rotCell(c, turn, w, h));
}

/** Quarter turns a def really takes: anything hanging keeps pointing down. */
function turnOf(def: PropDef, rot: number): number {
  return def.mount === 'hang' ? 0 : rot & 3;
}

export function footprintCells(pp: Pick<PlacedProp, 'def' | 'rot' | 'tx' | 'ty'>): Cell[] {
  return footprint(pp.def, pp.rot).map(([x, y]) => [x + pp.tx, y + pp.ty] as Cell);
}

export function resolveProp(pp: PlacedProp): Resolved {
  const { w, h } = box(pp.def);
  const rot = turnOf(pp.def, pp.rot);
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
  return [snap(dcos(angle)), snap(dsin(angle))];
}

/** Whole-prop translation (px) at frame f. */
export function motionOffset(r: Resolved, f: number): Vec {
  const m = r.motion;
  if (m.type === 'rail') {
    const d = pingPong(f / m.period + r.phase) * m.range;
    return [snap(dcos(m.angle)) * d, snap(dsin(m.angle)) * d];
  }
  if (m.type === 'loop') {
    const a = m.dir * Math.PI * 2 * (f / m.period + r.phase);
    return [(dcos(a) - 1) * m.radius, dsin(a) * m.radius];
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
  const dx = dcos(angle);
  const dy = dsin(angle);
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
  if (def.mount === 'face') return mountCells(level, placed, def, rot, tx, ty).length > 0;
  const cells = footprint(def, rot).map(([x, y]) => [x + tx, y + ty] as Cell);
  for (const [x, y] of cells) {
    if (x < 0 || y < 0 || x >= level.w || y >= level.h) return false;
  }
  if (def.modules.some((m) => m.type === 'bomb')) return true;
  const taken = new Set<number>();
  for (const p of [...level.setPieces, ...placed]) for (const [x, y] of footprintCells(p)) taken.add(y * level.w + x);
  for (const [x, y] of cells) {
    if (tileAt(level, x, y) || isProtected(level, x, y) || taken.has(y * level.w + x)) return false;
  }
  if (def.mount !== 'hang') return true;
  const top = Math.min(...cells.map((c) => c[1]));
  return hasHook(level, placed, cells[0][0], top) || openSky(level, placed, cells[0][0], top);
}

/** A cell something can hang from: solid terrain or a static placed block. */
function holdsHook(level: Level, placed: readonly PlacedProp[], x: number, y: number): boolean {
  return tileAt(level, x, y) === T_SOLID || staticBodyCells(placed, level.w).has(y * level.w + x);
}

/** Is something fixed right above cell (x, y)? */
function hasHook(level: Level, placed: readonly PlacedProp[], x: number, y: number): boolean {
  return y > 0 && holdsHook(level, placed, x, y - 1);
}

/**
 * Is it clear all the way up from cell (x, y)? Then a hanging prop is lowered
 * in on a string instead. Open levels (farms, rooftops) can go without a single
 * ceiling, and a part nobody can place would stall the place phase.
 */
export function openSky(level: Level, placed: readonly PlacedProp[], x: number, y: number): boolean {
  for (let up = y - 1; up >= 0; up--) if (holdsHook(level, placed, x, up)) return false;
  return true;
}

/** Rows a hanging prop may slide to reach a ceiling. */
const HANG_SNAP = 4;

/** The row a hanging prop drops into near `ty`: the nearest with a ceiling over it, or `ty` when there's none. Shared by the ghost and placing. */
export function hangRow(level: Level, placed: readonly PlacedProp[], def: PropDef, tx: number, ty: number): number {
  for (let d = 0; d <= HANG_SNAP; d++) {
    if (canPlace(level, placed, def, 0, tx, ty - d)) return ty - d;
    if (canPlace(level, placed, def, 0, tx, ty + d)) return ty + d;
  }
  return ty;
}

/** Outward face direction of a face-mounted def at a rotation. */
export function mountAngle(def: PropDef, rot: number): number {
  const m = def.modules.find((x) => x.type === 'coat' || x.type === 'snapper');
  return (m && (m.type === 'coat' || m.type === 'snapper') ? m.angle : -Math.PI / 2) + ((rot & 3) * Math.PI) / 2;
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
 * Attachment rule, cell by cell: a cell mounts if it's an in-bounds host (solid
 * terrain or a static placed block), unprotected, with its face (in the mount
 * direction) exposed to an empty, unclaimed cell, and that face isn't coated
 * yet. Returns the def's own rot 0 cells that mount, in footprint order.
 * An attachment places when any cell mounts (`canPlace`) and keeps only those
 * (`landedDef`): this is the one rule behind both.
 */
export function mountCells(level: Level, placed: readonly PlacedProp[], def: PropDef, rot: number, tx: number, ty: number): Cell[] {
  const angle = mountAngle(def, rot);
  const [dx, dy] = dirOf(angle);
  const face = Math.round(angle / (Math.PI / 2)) & 3;
  const blocks = staticBodyCells(placed, level.w);
  const taken = new Set<number>();
  for (const p of level.setPieces) for (const [x, y] of footprintCells(p)) taken.add(y * level.w + x);
  const coated = new Set<string>();
  for (const p of placed) {
    if (p.def.mount !== 'face') {
      for (const [x, y] of footprintCells(p)) taken.add(y * level.w + x);
      continue;
    }
    const a = mountAngle(p.def, p.rot);
    for (const [x, y] of footprintCells(p)) coated.add(`${x},${y},${Math.round(a / (Math.PI / 2)) & 3}`);
  }
  const cells = footprint(def, rot);
  return def.footprint.filter((_, i) => {
    const x = cells[i][0] + tx;
    const y = cells[i][1] + ty;
    if (x < 0 || y < 0 || x >= level.w || y >= level.h) return false;
    const host = tileAt(level, x, y) === T_SOLID || blocks.has(y * level.w + x);
    if (!host || isProtected(level, x, y)) return false;
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= level.w || ny >= level.h) return false;
    if (tileAt(level, nx, ny) !== T_EMPTY || blocks.has(ny * level.w + nx) || taken.has(ny * level.w + nx)) return false;
    return !coated.has(`${x},${y},${face}`);
  });
}

/**
 * The def that really lands at this spot: an attachment trimmed to the cells
 * that mount, so what's dropped is gone for good and nothing has to re-check
 * it later. The ghost draws this and placing stores it. It keeps its full
 * rotation box, so the cells stay where they were whatever got dropped. A
 * spot where nothing mounts returns the def whole, for the refused ghost.
 */
export function landedDef(level: Level, placed: readonly PlacedProp[], def: PropDef, rot: number, tx: number, ty: number): PropDef {
  if (def.mount !== 'face') return def;
  const kept = mountCells(level, placed, def, rot, tx, ty);
  if (kept.length === 0 || kept.length === def.footprint.length) return def;
  const keep = new Set(kept.map(([x, y]) => `${x},${y}`));
  const { w, h } = box(def);
  return {
    ...def,
    box: [w, h],
    footprint: kept,
    modules: def.modules.map((m) => ('cells' in m ? { ...m, cells: m.cells.filter(([x, y]) => keep.has(`${x},${y}`)) } : m)),
  };
}

export interface BlastSpec {
  shape: BlastShape;
  target: BlastTarget;
  /** Disk/ring radius, or line/cross arm length (tiles). */
  radius: number;
  /** Line/cross thickness, or ring thickness (tiles). */
  width: number;
}

/** The blast a bomb module describes (defaults: a disk that hits everything). */
export function blastSpec(m: Pick<ModuleOf<'bomb'>, 'radius' | 'shape' | 'target' | 'width'>): BlastSpec {
  return { shape: m.shape ?? 'disk', target: m.target ?? 'all', radius: m.radius, width: m.width ?? 1 };
}

/** Quarter-turn directions for line blasts: rot 0 right, 1 down, 2 left, 3 up. */
const ROT_DIR: readonly Cell[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/** Filled disk, or hollow ring when `inner` ≥ 0: cells by squared center-to-center distance. */
function roundBlast(b: BlastSpec, tx: number, ty: number, inner: number): Cell[] {
  const out: Cell[] = [];
  const r = Math.ceil(b.radius);
  const outer = b.radius * b.radius;
  for (let y = ty - r; y <= ty + r; y++)
    for (let x = tx - r; x <= tx + r; x++) {
      const d = sq(x - tx) + sq(y - ty);
      if (d <= outer && d > inner) out.push([x, y]);
    }
  return out;
}

/** Arm thickness as (first offset, count): even widths lean to the positive side. */
function armSpan(b: BlastSpec): [number, number] {
  const thick = Math.max(1, Math.round(b.width));
  return [-Math.floor((thick - 1) / 2), thick];
}

/**
 * Cells (world tiles, unclipped) of a blast centered on cell (tx, ty), per
 * shape. Disks and rings are measured cell-center to cell-center; lines start
 * at the charge and bore `radius` cells in the rotation direction; crosses
 * run `radius` cells out each way. Integer math only: deterministic.
 */
const BLAST_SHAPES: Record<BlastShape, (b: BlastSpec, tx: number, ty: number, rot: number) => Cell[]> = {
  disk: (b, tx, ty) => roundBlast(b, tx, ty, -1),
  ring: (b, tx, ty) => roundBlast(b, tx, ty, sq(Math.max(0, b.radius - b.width))),
  line(b, tx, ty, rot) {
    const out: Cell[] = [];
    const [dx, dy] = ROT_DIR[rot & 3];
    const [o0, thick] = armSpan(b);
    for (let k = 0; k < Math.round(b.radius); k++) for (let o = o0; o < o0 + thick; o++) out.push([tx + dx * k + dy * o, ty + dy * k + dx * o]);
    return out;
  },
  cross(b, tx, ty) {
    const seen = new Map<string, Cell>();
    const [o0, thick] = armSpan(b);
    for (const [dx, dy] of ROT_DIR)
      for (let k = 0; k <= Math.round(b.radius); k++)
        for (let o = o0; o < o0 + thick; o++) {
          const c: Cell = [tx + dx * k + dy * o, ty + dy * k + dx * o];
          seen.set(`${c[0]},${c[1]}`, c);
        }
    return [...seen.values()];
  },
};

export function blastCells(b: BlastSpec, tx: number, ty: number, rot = 0): Cell[] {
  return BLAST_SHAPES[b.shape](b, tx, ty, rot);
}

/** What a blast would do here: the terrain tiles it clears and the props/set pieces it removes (also the place-phase preview). */
export function blastHits(
  level: Level,
  placed: readonly PlacedProp[],
  b: BlastSpec,
  tx: number,
  ty: number,
  rot = 0,
): { cells: Cell[]; tiles: Cell[]; props: PlacedProp[]; setPieces: PlacedProp[] } {
  const cells = blastCells(b, tx, ty, rot).filter(([x, y]) => x >= 0 && y >= 0 && x < level.w && y < level.h);
  const hit = new Set(cells.map(([x, y]) => y * level.w + x));
  const inBlast = (p: PlacedProp) => footprintCells(p).some(([x, y]) => hit.has(y * level.w + x));
  const tiles = b.target === 'props' ? [] : cells.filter(([x, y]) => tileAt(level, x, y) !== T_EMPTY && !isProtected(level, x, y));
  // Attachments go when their host goes (handled in detonate); an EMP also fries them directly.
  const props = b.target === 'terrain' ? [] : placed.filter((p) => (p.def.mount !== 'face' || b.target === 'props') && inBlast(p));
  const setPieces = b.target === 'terrain' ? [] : level.setPieces.filter(inBlast);
  return { cells, tiles, props, setPieces };
}

/** The fx/audio event for a blast: a fireball for anything that breaks terrain, an EMP pulse for props-only charges. */
export function blastEvent(b: BlastSpec, tx: number, ty: number, rot = 0): GameEvent {
  const cells = blastCells(b, tx, ty, rot);
  const x = (cells.reduce((a, c) => a + c[0], 0) / cells.length + 0.5) * TILE;
  const y = (cells.reduce((a, c) => a + c[1], 0) / cells.length + 0.5) * TILE;
  if (b.target === 'props') return { type: 'prop', kind: 'emp', x, y, r: b.radius * TILE };
  if (b.shape === 'line')
    return { type: 'prop', kind: 'drill', x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE, x2: x * 2 - (tx + 0.5) * TILE, y2: y * 2 - (ty + 0.5) * TILE };
  return { type: 'explosion', x, y, r: (b.shape === 'cross' ? b.radius * 0.7 : b.radius) * TILE };
}

/**
 * Bomb: apply a blast at cell (tx, ty). Clears unprotected terrain and/or
 * placed props and set pieces according to the spec (a bare number is the
 * classic disk of that radius). Attachments whose host block or tile is gone
 * fall off. Returns the surviving props.
 */
export function detonate(level: Level, placed: PlacedProp[], blast: number | BlastSpec, tx: number, ty: number, rot = 0): PlacedProp[] {
  const b: BlastSpec = typeof blast === 'number' ? { shape: 'disk', target: 'all', radius: blast, width: 1 } : blast;
  const hits = blastHits(level, placed, b, tx, ty, rot);
  const hooked = new Set(placed.filter((p) => p.def.mount === 'hang' && hasHook(level, placed, p.tx, p.ty)));
  for (const [x, y] of hits.tiles) level.tiles[y * level.w + x] = 0;
  const gone = new Set([...hits.props, ...hits.setPieces]);
  level.setPieces = level.setPieces.filter((p) => !gone.has(p));
  level.version++;
  const survivors = placed.filter((p) => !gone.has(p));
  // Attachments fall off when their host is gone, and hanging props drop with their ceiling.
  const blocks = staticBodyCells(survivors, level.w);
  return survivors.filter((p) => {
    if (hooked.has(p)) return hasHook(level, survivors, p.tx, p.ty);
    return p.def.mount !== 'face' || footprintCells(p).every(([x, y]) => tileAt(level, x, y) === T_SOLID || blocks.has(y * level.w + x));
  });
}
