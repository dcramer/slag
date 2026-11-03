import { dcos, dhypot, dsin, sq } from '../../core/dmath';
import { type Cell, cellsBounds, frac, pingPong, type Vec } from '../../core/geom';
import { TILE } from '../constants';
import { isProtected, type Level, T_EMPTY, T_SOLID, tileAt } from '../level';
import type { GameEvent } from '../types';
import { previewProps } from './rays';
import { moduleSim, type Xform } from './registry';
import type { BlastShape, BlastTarget, Carry, ModuleOf, Motion, PlacedProp, PropDef, PropState, Resolved } from './types';

/** Deterministic per-prop phase offset so identical props don't move in lockstep. */
function propPhase(uid: number): number {
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

/** Tiles a crate card must fit for this def: its footprint plus whatever reaches past it. A hung part only shows its top links. */
export function cardExtent(def: PropDef): number {
  const { w, h } = cellsBounds(def.mount === 'hang' ? def.footprint.slice(0, 4) : def.footprint);
  let reachX = 0;
  let reachY = 0;
  for (const m of def.modules) {
    if (m.type === 'swinger') {
      reachX = Math.max(reachX, m.arm + m.radius);
      reachY = Math.max(reachY, m.arm + m.radius);
    }
    if (m.type === 'piston') reachY = Math.max(reachY, m.reach * 0.6 + 1);
    if (m.type === 'flame') reachY = Math.max(reachY, m.length * 0.7);
    if (m.type === 'magnet') {
      reachX = Math.max(reachX, m.radius - 0.5);
      reachY = Math.max(reachY, m.radius - 0.5);
    }
    if (m.type === 'keg' && m.aim !== 'player') {
      reachX = Math.max(reachX, 0.8);
      reachY = Math.max(reachY, 0.8);
    }
  }
  return Math.max(w + reachX * 2, h + reachY * 2, 2);
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

/** A tile offset turned the way rotPoint turns the prop, in px (track motion's points). */
function turnOffset(p: Vec, rot: number): Vec {
  let [x, y] = p;
  for (let i = 0; i < rot; i++) [x, y] = [-y, x];
  return [x * TILE, y * TILE];
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
    U: (p) => (rot === 2 ? [(pp.tx + w - p[0]) * TILE, (pp.ty + p[1]) * TILE] : x.P(p)),
    UA: (a) => (rot === 2 ? Math.PI - a : a + x.da),
  };
  const mods = pp.def.modules.map((m) => moduleSim(m.type).resolve(m, x));
  const mo = pp.def.motion;
  const motion: Motion =
    mo.type === 'rail'
      ? { ...mo, angle: mo.angle + x.da, range: mo.range * TILE, ...(mo.stops ? { stops: mo.stops.map((s) => s * TILE) } : {}) }
      : mo.type === 'loop'
        ? { ...mo, radius: mo.radius * TILE }
        : mo.type === 'track'
          ? { ...mo, pts: mo.pts.map((p) => turnOffset(p, rot)) }
          : mo;
  const ride = pp.ride;
  const carry = ride && { by: resolveProp(ride.parent), mi: ride.mi, part: ride.part, base: ride.base };
  return carry ? { pp, mods, motion, phase: propPhase(pp.uid), carry } : { pp, mods, motion, phase: propPhase(pp.uid) };
}

/** Does this placed part move: by its own motion, or riding something that does? */
export function moves(pp: Pick<PlacedProp, 'def' | 'ride'>): boolean {
  return pp.def.motion.type !== 'none' || !!pp.ride;
}

/** Round tiny float noise from cos/sin of axis-aligned angles. */
export function snap(v: number): number {
  return Math.abs(v) < 1e-9 ? 0 : Math.abs(Math.abs(v) - 1) < 1e-9 ? Math.sign(v) : v;
}

export function dirOf(angle: number): Vec {
  return [snap(dcos(angle)), snap(dsin(angle))];
}

/** Whole-prop translation (px) at frame f: its own motion, plus the travel of whatever it rides (./ride.ts). */
export function motionOffset(r: Resolved, f: number): Vec {
  const own = ownOffset(r, f);
  if (!r.carry) return own;
  const [cx, cy] = carryAt(r.carry, f);
  return [own[0] + cx, own[1] + cy];
}

/**
 * How far a carrier has moved a rider at frame f (px): the carrying solid's
 * position less the stored base. One function for the sim, the proof and the
 * art, so a rider is drawn exactly where it stands.
 */
export function carryAt(c: Carry, f: number): Vec {
  const [px, py] = carrierPos(c.by, c.mi, c.part, f);
  return [px - c.base[0], py - c.base[1]];
}

/** Where solid `part` of module `mi` sits at frame f (px), relative to an arbitrary fixed origin of its own: the prop's offset plus what the module adds. */
export function carrierPos(r: Resolved, mi: number, part: number, f: number): Vec {
  const [ox, oy] = motionOffset(r, f);
  const m = r.mods[mi];
  const at = m && moduleSim(m.type).carrier?.at(m, f, r.phase, part);
  return at ? [ox + at[0], oy + at[1]] : [ox, oy];
}

function ownOffset(r: Resolved, f: number): Vec {
  const m = r.motion;
  if (m.type === 'rail') {
    const d = m.stops?.length
      ? stopsAt(f, m.period, m.dwell ?? 0, m.range, m.stops, r.phase)
      : (m.dwell ? liftAt(f, m.period, m.dwell, r.phase) : pingPong(f / m.period + r.phase)) * m.range;
    return [snap(dcos(m.angle)) * d, snap(dsin(m.angle)) * d];
  }
  if (m.type === 'loop') {
    const a = m.dir * Math.PI * 2 * (f / m.period + r.phase);
    return [(dcos(a) - 1) * m.radius, dsin(a) * m.radius];
  }
  if (m.type === 'track') return trackAt(m.pts, m.closed, frac(f / m.period + r.phase));
  return [0, 0];
}

/**
 * A rail with stops, 0 → 1 → 0 over `period + 2 * dwell` frames: parked at 0
 * for `dwell` frames, eased out over half the period, parked at 1 for `dwell`,
 * eased back. Counted in whole frames, so every stop lasts exactly as long and
 * parks exactly at its end: a lift's floor lines up with the tiles it serves,
 * which is what the carrier ride proof needs (gen/level/ride.ts).
 */
function liftAt(f: number, period: number, dwell: number, phase: number): number {
  const total = period + 2 * dwell;
  const half = period / 2;
  let t = (((f + Math.floor(phase * total)) % total) + total) % total;
  if (t < dwell) return 0;
  t -= dwell;
  if (t < half) return (1 - dcos((Math.PI * t) / half)) / 2;
  t -= half;
  if (t < dwell) return 1;
  t -= dwell;
  return (1 + dcos((Math.PI * t) / half)) / 2;
}

/**
 * A rail lift that also parks at `stops` on the way (a manor's floors), in px
 * along the rail: parked at 0, eased up leg by leg with a `dwell` at every
 * stop, parked at `range`, and back down the same way. Each leg takes its
 * share of half the period by its length, so the cab keeps one pace; every
 * park returns its stop exactly, so the cab's floor lines up with the tiles.
 */
function stopsAt(f: number, period: number, dwell: number, range: number, stops: readonly number[], phase: number): number {
  const legs = stops.length + 1;
  const total = period + dwell * 2 * legs;
  let t = (((f + Math.floor(phase * total)) % total) + total) % total;
  const at = (i: number) => (i <= 0 ? 0 : i > stops.length ? range : stops[i - 1]);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < legs; i++) {
      // Up: stop i to stop i + 1; down: the same legs from the top.
      const a = pass === 0 ? at(i) : at(legs - i);
      const b = pass === 0 ? at(i + 1) : at(legs - i - 1);
      if (t < dwell) return a;
      t -= dwell;
      const span = (period / 2) * (Math.abs(b - a) / range);
      if (t < span) return a + ((b - a) * (1 - dcos((Math.PI * t) / span))) / 2;
      t -= span;
    }
  }
  return 0;
}

/**
 * Where a track puts its body at lap fraction `u`, in px: constant speed along
 * the polyline. A closed track runs pts[0] → … → pts[n-1] → pts[0], one way
 * round; an open one runs out to its last point and back the way it came, so a
 * lap is twice its length and it turns round only at its ends. Arithmetic and
 * square roots only (both exact across browsers), and nothing allocated: this
 * runs for every module of every moving prop, every frame.
 */
function trackAt(pts: readonly Vec[], closed: boolean, u: number): Vec {
  const n = pts.length;
  if (n < 2) return n ? [pts[0][0], pts[0][1]] : [0, 0];
  const segs = closed ? n : n - 1;
  let len = 0;
  for (let i = 0; i < segs; i++) len += segLen(pts, i);
  if (len === 0) return [pts[0][0], pts[0][1]];
  let s = u * (closed ? len : 2 * len);
  if (!closed && s > len) s = 2 * len - s;
  for (let i = 0; i < segs; i++) {
    const l = segLen(pts, i);
    if (s <= l || i === segs - 1) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      const k = l ? Math.min(1, s / l) : 0;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
    s -= l;
  }
  return [pts[0][0], pts[0][1]];
}

function segLen(pts: readonly Vec[], i: number): number {
  const a = pts[i];
  const b = pts[(i + 1) % pts.length];
  return dhypot(b[0] - a[0], b[1] - a[1]);
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

/** Longest sweep looked at (frames): chains of movers with unrelated periods stop here. */
const MAX_SWEEP = 2400;
/** Frames between samples of a sweep: no mover gets half a tile in that. */
export const SWEEP_STEP = 2;

/** Frames in one cycle of a whole-prop motion: a rail with stops parks at every one of them on the way up and down. */
export function motionPeriod(m: Motion): number {
  if (m.type === 'rail') return m.period + 2 * (m.dwell ?? 0) * (1 + (m.stops?.length ?? 0));
  if (m.type === 'loop' || m.type === 'track') return m.period;
  return 0;
}

/** Frames until a part's own motion and its whole chain of carriers are back where they started (capped). */
export function rideSpan(r: Resolved): number {
  let span = 1;
  const own = motionPeriod(r.motion);
  if (own > 0) span = Math.min(MAX_SWEEP, Math.round(own));
  for (let c = r.carry; c; c = c.by.carry) {
    const m = c.by.mods[c.mi];
    for (const p of [motionPeriod(c.by.motion), m ? (moduleSim(m.type).carrier?.period(m) ?? 0) : 0])
      if (p > 0) span = Math.min(MAX_SWEEP, lcm(span, Math.round(p)));
  }
  return span;
}

function lcm(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y) [x, y] = [y, x % y];
  return (a / x) * b;
}

/**
 * Every cell a part's cycle takes it through: its footprint where it holds
 * still, and every cell its footprint passes through where it moves (on a rail
 * or loop of its own, or riding a mover). A mover's path must keep out of rock
 * and protected zones; other parts it passes through. Unclipped: a path off
 * the level's side reaches cells outside it.
 */
export function sweptCells(pp: PlacedProp): Cell[] {
  const home = footprintCells(pp);
  if (!moves(pp)) return home;
  const r = resolveProp(pp);
  const span = rideSpan(r);
  const out = new Map<string, Cell>();
  for (const c of home) out.set(`${c[0]},${c[1]}`, c);
  for (let f = 0; f < span; f += SWEEP_STEP) {
    const [ox, oy] = motionOffset(r, f);
    for (const [cx, cy] of home)
      for (const c of cellsUnder(cx * TILE + ox, cy * TILE + oy, TILE, TILE)) if (!out.has(`${c[0]},${c[1]}`)) out.set(`${c[0]},${c[1]}`, c);
  }
  return [...out.values()];
}

/** Tiles under a px rect, half a px in from each edge so a rect flush with a tile line doesn't reach over it. */
function cellsUnder(x: number, y: number, w: number, h: number): Cell[] {
  const out: Cell[] = [];
  for (let ty = Math.floor((y + 0.5) / TILE); ty <= Math.floor((y + h - 0.5) / TILE); ty++)
    for (let tx = Math.floor((x + 0.5) / TILE); tx <= Math.floor((x + w - 0.5) / TILE); tx++) out.push([tx, ty]);
  return out;
}

let lastOccupied: { key: unknown[]; cells: Map<number, PlacedProp> } | null = null;

/**
 * Cell → the part that's in it on frame f, for placing. A placed part is
 * where its footprint is now: where it went in if it holds still, wherever its
 * motion or its mover has taken it if not. A set piece is where its solids are
 * now. Paths and swings take nothing: movers pass through whatever stands in
 * their way (the owner, 2026-11-02), so a part may go anywhere a set piece or
 * mover only passes. Attachments take nothing: they lie on a face. Cached for
 * the frame: the ghost asks several times.
 */
export function occupiedCells(level: Level, placed: readonly PlacedProp[], f = 0): Map<number, PlacedProp> {
  const key = [level, level.version, level.setPieces, placed, placed.length, placed[placed.length - 1], f];
  if (lastOccupied && lastOccupied.key.length === key.length && lastOccupied.key.every((k, i) => k === key[i])) return lastOccupied.cells;
  const cells = new Map<number, PlacedProp>();
  const take = (p: PlacedProp, cs: readonly Cell[]) => {
    for (const [x, y] of cs) if (x >= 0 && y >= 0 && x < level.w && y < level.h && !cells.has(y * level.w + x)) cells.set(y * level.w + x, p);
  };
  if (level.setPieces.length) {
    const byUid = new Map(level.setPieces.map((p) => [p.uid, p]));
    for (const s of previewProps(level, level.setPieces.map(resolveProp), f).solids) {
      const p = byUid.get(s.propUid);
      if (p && !s.film) take(p, cellsUnder(s.x, s.y, s.w, s.h));
    }
  }
  for (const p of placed) {
    if (p.def.mount === 'face') continue;
    if (!moves(p)) take(p, footprintCells(p));
    else {
      const [ox, oy] = motionOffset(resolveProp(p), f);
      for (const [cx, cy] of footprintCells(p)) take(p, cellsUnder(cx * TILE + ox, cy * TILE + oy, TILE, TILE));
    }
  }
  lastOccupied = { key, cells };
  return cells;
}

/** Why a part can't go at a spot: the world cells that refuse it, and the parts in those cells. */
export interface PlaceFaults {
  cells: Cell[];
  by: PlacedProp[];
}

/**
 * Why this prop can't go here on frame f, cell by cell: the one rule behind
 * `canPlace` and the red crosses on a refused ghost, so the ghost marks
 * exactly the cells that refuse it. Bombs need only be in bounds. A part needs
 * its footprint in bounds, empty, unprotected and free of other parts where
 * they are now (`occupiedCells`), and a part that moves needs its whole path
 * (`sweptCells`) out of rock, protected zones and off the level's sides. An
 * attachment is refused only where no cell mounts (`mountCells`), and a hung
 * part where nothing above holds it and the sky isn't clear.
 */
export function placeFaults(level: Level, placed: readonly PlacedProp[], def: PropDef, rot: number, tx: number, ty: number, f = 0): PlaceFaults {
  const cells = footprint(def, rot).map(([x, y]) => [x + tx, y + ty] as Cell);
  const none: PlaceFaults = { cells: [], by: [] };
  if (def.mount === 'face') return mountCells(level, placed, def, rot, tx, ty, f).length > 0 ? none : { cells, by: [] };
  const out = (x: number, y: number) => x < 0 || y < 0 || x >= level.w || y >= level.h;
  if (def.modules.some((m) => m.type === 'bomb')) return { cells: cells.filter(([x, y]) => out(x, y)), by: [] };
  const taken = occupiedCells(level, placed, f);
  const bad: Cell[] = [];
  const by = new Set<PlacedProp>();
  const home = new Set(cells.map(([x, y]) => `${x},${y}`));
  for (const [x, y] of cells) {
    if (out(x, y) || tileAt(level, x, y) || isProtected(level, x, y)) bad.push([x, y]);
    else {
      const owner = taken.get(y * level.w + x);
      if (!owner) continue;
      bad.push([x, y]);
      by.add(owner);
    }
  }
  if (def.motion.type !== 'none')
    for (const [x, y] of sweptCells({ uid: 0, def, owner: -1, tx, ty, rot }))
      if (!home.has(`${x},${y}`) && (out(x, y) || tileAt(level, x, y) === T_SOLID || isProtected(level, x, y))) bad.push([x, y]);
  if (bad.length || def.mount !== 'hang') return { cells: bad, by: [...by] };
  const top = Math.min(...cells.map((c) => c[1]));
  return hasHook(level, placed, cells[0][0], top) || openSky(level, placed, cells[0][0], top) ? none : { cells, by: [] };
}

/** Can this prop go here on frame f? Bombs can go anywhere in-bounds; everything else by `placeFaults`. */
export function canPlace(level: Level, placed: readonly PlacedProp[], def: PropDef, rot: number, tx: number, ty: number, f = 0): boolean {
  return placeFaults(level, placed, def, rot, tx, ty, f).cells.length === 0;
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
export function hangRow(level: Level, placed: readonly PlacedProp[], def: PropDef, tx: number, ty: number, f = 0): number {
  for (let d = 0; d <= HANG_SNAP; d++) {
    if (canPlace(level, placed, def, 0, tx, ty - d, f)) return ty - d;
    if (canPlace(level, placed, def, 0, tx, ty + d, f)) return ty + d;
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
    if (moves(p)) continue;
    for (const m of resolveProp(p).mods) {
      // A sub-tile shape has no flush face to mount on.
      if (m.type === 'body' && m.material !== 'crumble' && !m.shape) for (const [x, y] of m.cells) out.add(y * w + x);
    }
  }
  return out;
}

/**
 * Attachment rule, cell by cell: a cell mounts if it's an in-bounds host (solid
 * terrain or a static placed block), unprotected, with its face (in the mount
 * direction) exposed to an empty cell no part is in on frame f
 * (`occupiedCells`), and that face isn't coated yet. Returns the def's own rot 0 cells that mount, in footprint order.
 * An attachment places when any cell mounts (`canPlace`) and keeps only those
 * (`landedDef`): this is the one rule behind both.
 */
export function mountCells(level: Level, placed: readonly PlacedProp[], def: PropDef, rot: number, tx: number, ty: number, f = 0): Cell[] {
  const angle = mountAngle(def, rot);
  const [dx, dy] = dirOf(angle);
  const face = Math.round(angle / (Math.PI / 2)) & 3;
  const blocks = staticBodyCells(placed, level.w);
  const taken = occupiedCells(level, placed, f);
  const coated = new Set<string>();
  for (const p of placed) {
    if (p.ride || p.def.mount !== 'face') continue;
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
export function landedDef(level: Level, placed: readonly PlacedProp[], def: PropDef, rot: number, tx: number, ty: number, f = 0): PropDef {
  if (def.mount !== 'face') return def;
  const kept = mountCells(level, placed, def, rot, tx, ty, f);
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
  /** Frame it goes off on: a rider is hit where its mover has taken it by then. */
  frame = 0,
): { cells: Cell[]; tiles: Cell[]; props: PlacedProp[]; setPieces: PlacedProp[] } {
  const cells = blastCells(b, tx, ty, rot).filter(([x, y]) => x >= 0 && y >= 0 && x < level.w && y < level.h);
  const hit = new Set(cells.map(([x, y]) => y * level.w + x));
  const inBlast = (p: PlacedProp) => cellsAt(p, frame).some(([x, y]) => hit.has(y * level.w + x));
  const tiles = b.target === 'props' ? [] : cells.filter(([x, y]) => tileAt(level, x, y) !== T_EMPTY && !isProtected(level, x, y));
  // Attachments go when their host goes (handled in detonate); an EMP also fries them directly.
  const direct = b.target === 'terrain' ? [] : placed.filter((p) => (p.def.mount !== 'face' || b.target === 'props') && inBlast(p));
  const setPieces = b.target === 'terrain' ? [] : level.setPieces.filter(inBlast);
  // Riders go with what they ride, chains included.
  const gone = new Set([...direct, ...setPieces].map((p) => p.uid));
  const props = direct.slice();
  for (let more = true; more;) {
    more = false;
    for (const p of placed)
      if (p.ride && gone.has(p.ride.uid) && !gone.has(p.uid)) {
        gone.add(p.uid);
        props.push(p);
        more = true;
      }
  }
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
export function detonate(level: Level, placed: PlacedProp[], blast: number | BlastSpec, tx: number, ty: number, rot = 0, frame = 0): PlacedProp[] {
  const b: BlastSpec = typeof blast === 'number' ? { shape: 'disk', target: 'all', radius: blast, width: 1 } : blast;
  const hits = blastHits(level, placed, b, tx, ty, rot, frame);
  const hooked = new Set(placed.filter((p) => p.def.mount === 'hang' && hasHook(level, placed, p.tx, p.ty)));
  for (const [x, y] of hits.tiles) level.tiles[y * level.w + x] = 0;
  const gone = new Set([...hits.props, ...hits.setPieces]);
  level.setPieces = level.setPieces.filter((p) => !gone.has(p));
  level.version++;
  const survivors = placed.filter((p) => !gone.has(p));
  // Attachments fall off when their host is gone, and hanging props drop with their ceiling.
  const blocks = staticBodyCells(survivors, level.w);
  const kept = survivors.filter((p) => {
    if (p.ride) return true;
    if (hooked.has(p)) return hasHook(level, survivors, p.tx, p.ty);
    return p.def.mount !== 'face' || footprintCells(p).every(([x, y]) => tileAt(level, x, y) === T_SOLID || blocks.has(y * level.w + x));
  });
  return dropOrphans(level, kept);
}

/**
 * Riders go with what they ride: a part whose parent is gone goes too, and so
 * does anything riding it. Nothing falls and nothing is left floating where it
 * was, so a blast's result is plain to see and the same on every peer.
 */
export function dropOrphans(level: Level, placed: PlacedProp[]): PlacedProp[] {
  const live = new Set<number>([...level.setPieces, ...placed].map((p) => p.uid));
  let out = placed;
  for (;;) {
    const next = out.filter((p) => !p.ride || live.has(p.ride.uid));
    if (next.length === out.length) return out;
    for (const p of out) if (!next.includes(p)) live.delete(p.uid);
    out = next;
  }
}

/** The cells a part covers at frame f: its footprint, moved to the nearest whole tile of where it rides. */
export function cellsAt(pp: PlacedProp, f: number): Cell[] {
  const cells = footprintCells(pp);
  if (!pp.ride) return cells;
  const [ox, oy] = motionOffset(resolveProp(pp), f);
  const dx = Math.round(ox / TILE);
  const dy = Math.round(oy / TILE);
  return cells.map(([x, y]) => [x + dx, y + dy] as Cell);
}

/**
 * Delayed charges (time bombs) go off as the race starts, in the order they
 * were placed, each catching whatever still stands; a charge caught in an
 * earlier blast is defused. Mutates `level` and returns what's left, so the
 * match and the winnability proof (on a copy) settle a round the same way.
 */
export function detonateCharges(level: Level, placed: PlacedProp[], onBlast?: (spec: BlastSpec, tx: number, ty: number, rot: number) => void): PlacedProp[] {
  let left = placed;
  for (const c of placed) {
    const m = c.def.modules.find((x) => x.type === 'bomb');
    if (!m || m.type !== 'bomb' || !m.delay || !left.includes(c)) continue;
    const spec = blastSpec(m);
    left = detonate(
      level,
      left.filter((p) => p !== c),
      spec,
      c.tx,
      c.ty,
      c.rot,
    );
    onBlast?.(spec, c.tx, c.ty, c.rot);
  }
  return left;
}
