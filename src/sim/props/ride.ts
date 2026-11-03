import { type Cell, overlaps, type Rect, type Vec } from '../../core/geom';
import { TILE } from '../constants';
import { isProtected, type Level, T_SOLID, tileAt } from '../level';
import type { Solid } from '../physics';
import { COAT_PX, faceRect, SPIKE_PX } from './modules/coat';
import { buildSolids } from './rays';
import { type Contrib, moduleSim, solidId } from './registry';
import {
  canPlace,
  carrierPos,
  occupiedCells,
  dirOf,
  footprint,
  footprintCells,
  landedDef,
  motionOffset,
  mountAngle,
  mountCells,
  moves,
  newPropState,
  resolveProp,
  rideSpan,
} from './transform';
import type { PlacedProp, PropDef, Resolved, Ride } from './types';

/**
 * Parts ride what they're stuck to (docs/DESIGN.md, Props). Placed flush
 * against a moving solid, a block, a mystery box or a coat becomes that
 * mover's child and follows it for the rest of the match: translation only,
 * since physics is axis-aligned, so a coat on a wheel's car keeps its face
 * as the car goes round. Chains work because a parent's offset already
 * includes whatever it rides.
 *
 * A mover is a solid of a module with a `carrier` (blocks on a moving part,
 * a wheel's platforms, a cart's body), placed in a prop that really moves.
 * Movers animate during place, so a part attaches to where its mover is on
 * the frame it goes in: it snaps up to RIDE_SNAP px to sit flush, the ghost
 * shows it riding, and `Ride.base` keeps that spot relative to the mover
 * for good. The match is the same pure function of the frame everywhere:
 * `motionOffset` adds `carryAt`, which the sim, the proof and the art all use.
 *
 * A part that touches a mover rides it, or doesn't go there: one that would
 * meet terrain, the level's edge or a protected zone anywhere on the mover's
 * cycle is refused, so a rider never grinds through rock.
 */

/** How far (px) a part snaps to sit flush on a moving face. Over half a tile, so some row always meets a passing mover. */
export const RIDE_SNAP = TILE * 0.75;
/** px a part must share with a moving face to count as touching it. */
const MIN_TOUCH = 4;
/** Frames between samples of a ride's sweep: no mover gets half a tile in that. */
const SWEEP_STEP = 2;

/** Can this part ride a mover? Every module must move rigidly with the prop, and it has no motion of its own. */
export function canRide(def: PropDef): boolean {
  return def.motion.type === 'none' && def.mount !== 'hang' && def.modules.length > 0 && def.modules.every((m) => moduleSim(m.type).rides === true);
}

/** Where a part lands at a frame, and whether it may. `ride` is set when it sticks to a mover. */
export interface Spot {
  def: PropDef;
  ok: boolean;
  ride?: Ride;
}

interface Mover {
  s: Solid;
  r: Resolved;
  part: number;
}

interface World {
  props: Resolved[];
  solids: Solid[];
  movers: Mover[];
  /** Cell key → the placed part in it on this frame (`occupiedCells`); set pieces are in `solids`. */
  claims: Map<number, PlacedProp>;
}

let lastWorld: { key: unknown[]; world: World } | null = null;
let lastSpot: { key: unknown[]; spot: Spot } | null = null;

const same = (a: readonly unknown[], b: readonly unknown[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Every part's solids at frame f, which of them carry, and what's claimed. Cached for the frame: the ghost asks several times. */
function worldAt(level: Level, placed: readonly PlacedProp[], f: number): World {
  const key = [level, level.version, level.setPieces, placed, placed.length, placed[placed.length - 1], f];
  if (lastWorld && same(lastWorld.key, key)) return lastWorld.world;
  const props = [...level.setPieces, ...placed].map(resolveProp);
  const out: Contrib = { solids: [], hazards: [], springs: [], winds: [], triggers: [] };
  const state = newPropState();
  buildSolids(props, (r, mi) => ({ level, frame: f, r, off: motionOffset(r, f), prev: motionOffset(r, f - 1), state, mi, live: false }), out);
  const solids = out.solids.filter((s) => !s.film);
  const movers: Mover[] = [];
  for (const s of solids) {
    if (s.propUid < 0 || s.mi < 0 || s.oneWay) continue;
    const r = props.find((p) => p.pp.uid === s.propUid);
    const m = r?.mods[s.mi];
    const c = m && moduleSim(m.type).carrier;
    if (!r || !m || !c || !(c.drives || moves(r.pp))) continue;
    const part = s.id - solidId(s.propUid, s.mi, 0);
    if (c.at(m, f, r.phase, part)) movers.push({ s, r, part });
  }
  const claims = new Map<number, PlacedProp>();
  for (const [k, p] of occupiedCells(level, placed, f)) if (!level.setPieces.includes(p)) claims.set(k, p);
  const world = { props, solids, movers, claims };
  lastWorld = { key, world };
  return world;
}

/**
 * Where `def` lands at (tx, ty) on frame `f` of the place phase: stuck to a
 * mover it touches, or by the static rules (`canPlace`, `landedDef`). Shared
 * by the match, which places it, and the ghost, which shows it.
 */
export function spotAt(level: Level, placed: readonly PlacedProp[], def: PropDef, rot: number, tx: number, ty: number, f: number): Spot {
  const key = [level, level.version, level.setPieces, placed, placed.length, placed[placed.length - 1], def, rot, tx, ty, f];
  if (lastSpot && same(lastSpot.key, key)) return lastSpot.spot;
  const plain = (): Spot => ({ def: landedDef(level, placed, def, rot, tx, ty, f), ok: canPlace(level, placed, def, rot, tx, ty, f) });
  let spot: Spot;
  if (!canRide(def)) spot = plain();
  else {
    const w = worldAt(level, placed, f);
    const stuck = def.mount === 'face' ? coatRide(level, placed, w, def, rot, tx, ty, f) : blockRide(level, w, def, rot, tx, ty, f);
    spot = stuck ?? plain();
  }
  lastSpot = { key, spot };
  return spot;
}

/** The ride a part gets from mover `mv` when it sits `d` px off its grid cells on frame f. */
function rideFrom(mv: Mover, d: Vec, f: number): Ride {
  const [px, py] = carrierPos(mv.r, mv.s.mi, mv.part, f);
  return { uid: mv.r.pp.uid, mi: mv.s.mi, part: mv.part, base: [px - d[0], py - d[1]], parent: mv.r.pp };
}

/** Offset of a grid edge at `v` px to the nearest tile line. */
const toGrid = (v: number) => v - Math.round(v / TILE) * TILE;

/** px two spans share. */
const shared = (a: number, aw: number, b: number, bw: number) => Math.min(a + aw, b + bw) - Math.max(a, b);

/**
 * A block (anything that isn't a coat) touching a mover: the nearest snap
 * across all its cells and the mover's faces, so it sits flush on top, under,
 * or beside it, lined up with a block's cells or a car's near edge.
 */
function blockRide(level: Level, w: World, def: PropDef, rot: number, tx: number, ty: number, f: number): Spot | null {
  const cells = footprint(def, rot).map(([x, y]) => [x + tx, y + ty] as Cell);
  let best: { mv: Mover; d: Vec; g: number } | null = null;
  const consider = (mv: Mover, d: Vec, g: number, touch: number) => {
    if (Math.abs(g) > RIDE_SNAP || touch < MIN_TOUCH) return;
    if (!best || Math.abs(g) < Math.abs(best.g) - 1e-9) best = { mv, d, g };
  };
  for (const mv of w.movers) {
    const { s } = mv;
    const ax = toGrid(s.x);
    const ay = toGrid(s.y);
    for (const [cx, cy] of cells) {
      const x = cx * TILE;
      const y = cy * TILE;
      const across = shared(x + ax, TILE, s.x, s.w);
      const along = shared(y + ay, TILE, s.y, s.h);
      consider(mv, [ax, s.y - (y + TILE)], s.y - (y + TILE), across); // on top of it
      consider(mv, [ax, s.y + s.h - y], s.y + s.h - y, across); // hanging under it
      consider(mv, [s.x + s.w - x, ay], s.x + s.w - x, along); // right of it
      consider(mv, [s.x - (x + TILE), ay], s.x - (x + TILE), along); // left of it
    }
  }
  if (!best) return null;
  const { mv, d } = best as { mv: Mover; d: Vec };
  const ride = rideFrom(mv, d, f);
  const rects = cells.map(([cx, cy]) => ({ x: cx * TILE, y: cy * TILE, w: TILE, h: TILE }));
  const ok =
    cells.every(([x, y]) => x >= 0 && y >= 0 && x < level.w && y < level.h && !isProtected(level, x, y)) &&
    clearAt(level, w, rects, d, ride) &&
    sweepClear(level, rects, ride);
  return { def, ok, ride };
}

/**
 * A coat whose host cells lie on a moving face. Each host cell mounts where
 * its face lies on a mover's face of the same direction with open air off it;
 * the mover with the most such cells wins, and only if it beats what would
 * mount on still faces. The rest of the strip is dropped, as on still faces.
 */
function coatRide(level: Level, placed: readonly PlacedProp[], w: World, def: PropDef, rot: number, tx: number, ty: number, f: number): Spot | null {
  const angle = mountAngle(def, rot);
  const [nx, ny] = dirOf(angle);
  const face = Math.round(angle / (Math.PI / 2)) & 3;
  const cells = footprint(def, rot).map(([x, y]) => [x + tx, y + ty] as Cell);
  const coats = coatedFaces(level, placed, f);
  const groups: { mv: Mover; d: Vec; g: number; idx: number[] }[] = [];
  for (const mv of w.movers) {
    const { s } = mv;
    const ax = toGrid(s.x);
    const ay = toGrid(s.y);
    cells.forEach(([cx, cy], i) => {
      if (cx < 0 || cy < 0 || cx >= level.w || cy >= level.h || isProtected(level, cx, cy)) return;
      const x = cx * TILE;
      const y = cy * TILE;
      let d: Vec;
      let mid: number;
      let lo: number;
      let hi: number;
      if (ny !== 0) {
        d = [ax, ny < 0 ? s.y - y : s.y + s.h - (y + TILE)];
        [mid, lo, hi] = [x + ax + TILE / 2, s.x, s.x + s.w];
      } else {
        d = [nx < 0 ? s.x - x : s.x + s.w - (x + TILE), ay];
        [mid, lo, hi] = [y + ay + TILE / 2, s.y, s.y + s.h];
      }
      const g = ny !== 0 ? d[1] : d[0];
      if (Math.abs(g) > RIDE_SNAP || mid <= lo || mid >= hi) return;
      // Open air off the face: no solid there (the mover's own next cell, anyone else's), no rock, no coat already on it.
      const out = shrink({ x: x + nx * TILE + d[0], y: y + ny * TILE + d[1], w: TILE, h: TILE }, 1);
      if (w.solids.some((o) => overlaps(o, out)) || hitsRock(level, out)) return;
      if (coats.some((c) => c.face === face && Math.abs(c.x - (x + d[0])) < 0.5 && Math.abs(c.y - (y + d[1])) < 0.5)) return;
      let grp = groups.find((q) => q.mv.r === mv.r && q.mv.s.mi === s.mi && Math.abs(q.d[0] - d[0]) < 1e-6 && Math.abs(q.d[1] - d[1]) < 1e-6);
      if (!grp) groups.push((grp = { mv, d, g, idx: [] }));
      if (!grp.idx.includes(i)) grp.idx.push(i);
    });
  }
  let best = groups[0];
  for (const q of groups) if (q.idx.length > best.idx.length || (q.idx.length === best.idx.length && Math.abs(q.g) < Math.abs(best.g) - 1e-9)) best = q;
  if (!best || best.idx.length <= mountCells(level, placed, def, rot, tx, ty, f).length) return null;
  const keep = new Set(best.idx.map((i) => `${def.footprint[i][0]},${def.footprint[i][1]}`));
  const landed = trimmed(def, keep);
  const ride = rideFrom(best.mv, best.d, f);
  const depth = def.modules.some((m) => m.type === 'coat' && m.kind === 'spikes') ? SPIKE_PX : COAT_PX;
  const rects = best.idx.map((i) => faceRect(cells[i][0], cells[i][1], angle, depth));
  return { def: landed, ok: sweepClear(level, rects, ride), ride };
}

/** `def` keeping only the footprint cells in `keep` (rot 0 keys), as `landedDef` trims a strip. */
function trimmed(def: PropDef, keep: Set<string>): PropDef {
  if (keep.size === def.footprint.length) return def;
  let w = 1;
  let h = 1;
  for (const [x, y] of def.footprint) {
    w = Math.max(w, x + 1);
    h = Math.max(h, y + 1);
  }
  return {
    ...def,
    box: def.box ?? [w, h],
    footprint: def.footprint.filter(([x, y]) => keep.has(`${x},${y}`)),
    modules: def.modules.map((m) => ('cells' in m ? { ...m, cells: m.cells.filter(([x, y]) => keep.has(`${x},${y}`)) } : m)),
  };
}

/** Every coated face where it is on frame f: host cell corner (px) and face. */
function coatedFaces(level: Level, placed: readonly PlacedProp[], f: number): { x: number; y: number; face: number }[] {
  const out: { x: number; y: number; face: number }[] = [];
  for (const p of [...level.setPieces, ...placed]) {
    if (p.def.mount !== 'face') continue;
    const face = Math.round(mountAngle(p.def, p.rot) / (Math.PI / 2)) & 3;
    const [ox, oy] = p.ride ? motionOffset(resolveProp(p), f) : [0, 0];
    for (const [x, y] of footprintCells(p)) out.push({ x: x * TILE + ox, y: y * TILE + oy, face });
  }
  return out;
}

const shrink = (r: Rect, k: number): Rect => ({ x: r.x + k, y: r.y + k, w: r.w - 2 * k, h: r.h - 2 * k });

/** Tiles under a px rect. */
function tilesUnder(r: Rect, visit: (x: number, y: number) => boolean | void): boolean {
  const x0 = Math.floor(r.x / TILE);
  const x1 = Math.floor((r.x + r.w) / TILE);
  const y0 = Math.floor(r.y / TILE);
  const y1 = Math.floor((r.y + r.h) / TILE);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (visit(x, y)) return true;
  return false;
}

const hitsRock = (level: Level, r: Rect) => tilesUnder(r, (x, y) => tileAt(level, x, y) === T_SOLID);

/** Is a part's spot on frame f, `d` px off its cells, free of every solid and of what other parts claim? Its own chain of carriers may claim it. */
function clearAt(level: Level, w: World, rects: readonly Rect[], d: Vec, ride: Ride): boolean {
  const chain = new Set<number>();
  for (let r: Ride | undefined = ride; r; r = r.parent.ride) chain.add(r.uid);
  return rects.every((rc) => {
    const at = shrink({ ...rc, x: rc.x + d[0], y: rc.y + d[1] }, 0.5);
    if (w.solids.some((s) => overlaps(s, at))) return false;
    return !tilesUnder(shrink(at, 0.5), (x, y) => {
      const p = w.claims.get(y * level.w + x);
      return !!p && !chain.has(p.uid);
    });
  });
}

/**
 * Does a rider stay clear of rock, the level's sides and protected zones over
 * its carrier's whole cycle? `rects` are where it sits at zero offset.
 */
function sweepClear(level: Level, rects: readonly Rect[], ride: Ride): boolean {
  const pp: PlacedProp = { uid: -1, def: { ...ride.parent.def, motion: { type: 'none' }, modules: [] }, owner: -1, tx: 0, ty: 0, rot: 0, ride };
  const r = resolveProp(pp);
  const span = rideSpan(r);
  for (let f = 0; f < span; f += SWEEP_STEP) {
    const [ox, oy] = motionOffset(r, f);
    for (const rc of rects) {
      const at = shrink({ ...rc, x: rc.x + ox, y: rc.y + oy }, 0.5);
      if (tilesUnder(at, (x, y) => tileAt(level, x, y) === T_SOLID || isProtected(level, x, y))) return false;
    }
  }
  return true;
}
