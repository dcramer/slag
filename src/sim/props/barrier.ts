import type { Rect } from '../../core/geom';
import { RUN_COUNTDOWN, TILE } from '../constants';
import type { Level } from '../level';
import { DEFAULT_SURFACE } from '../physics';
import { SURFACES } from './modules/body';
import { buildSolids, traceRays } from './rays';
import { type Contrib, type Hazard, moduleSim } from './registry';
import { motionOffset, newPropState, resolveProp } from './transform';
import type { PlacedProp, Resolved } from './types';

/**
 * What a part means for a route that has to stay finishable
 * (gen/level/winnable.ts), found by running the part's own modules over a
 * stretch of frames rather than by a rule per module type, so a new module
 * is covered the day it lands:
 *
 * - `ground`: plain static blocks (stone, metal, wood; no motion, no
 *   crumbling, no belt, not riding a mover, whole tiles rather than a
 *   sub-tile shape). The real controller stands on them like terrain.
 * - `noGo`: cells something holds for most of the time: a block of any other
 *   kind (ice, goo, jelly, a conveyor, a crumbling block), a spike strip, a
 *   coat, a spring pad, a fan's column, a trigger zone (pipe mouth, bumper, web,
 *   magnet core, rope), a hazard that never leaves long enough to slip past,
 *   and the rows a flood holds for most of its cycle (a module's `holds`).
 *   A proven route keeps clear of all of them, so it never relies on a
 *   surface or a push the proof doesn't model.
 *
 * A cell that's clear for at least MIN_OPENING frames in a row is passable by
 * timing and isn't a barrier. That's the one assumption the proof makes about
 * hazards: several timed hazards whose openings never line up could still
 * close a corridor between them.
 */
export interface Barrier {
  /** Cell keys (y * w + x), ascending. */
  ground: number[];
  noGo: number[];
}

/** Frames sampled, from the race start: longer than every module's cycle but the slowest. */
const SPAN = 720;
const STEP = 6;
/** A cell clear for this many frames in a row can be slipped through. Anything that hurts in bursts (a sentry) holds fire at least this long between them. */
export const MIN_OPENING = 30;

const cache = new WeakMap<PlacedProp, { tiles: Uint8Array; w: number; barrier: Barrier }>();

/**
 * The part's barrier in `level`, cached per part and terrain (rays stop at
 * terrain). Terrain is compared by content, so a copy of the level with the
 * same tiles, like the one a proof settles time bombs on, still hits.
 */
export function barrierOf(level: Level, pp: PlacedProp): Barrier {
  const hit = cache.get(pp);
  if (hit && hit.w === level.w && sameTiles(hit.tiles, level.tiles)) return hit.barrier;
  const barrier = sample(level, resolveProp(pp));
  cache.set(pp, { tiles: level.tiles.slice(), w: level.w, barrier });
  return barrier;
}

function sameTiles(a: Uint8Array, b: Uint8Array): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** A module is ground if the controller can stand on it exactly as on terrain. */
function groundModules(r: Resolved): Set<number> {
  const out = new Set<number>();
  if (r.motion.type !== 'none' || r.carry) return out;
  r.mods.forEach((m, mi) => {
    if (m.type === 'body' && !m.shape && m.breakFrames === 0 && m.conveyor === 0 && m.material !== 'crumble' && SURFACES[m.material] === DEFAULT_SURFACE)
      out.add(mi);
  });
  return out;
}

function sample(level: Level, r: Resolved): Barrier {
  const { w, h } = level;
  const grounded = groundModules(r);
  const ground = new Set<number>();
  for (const mi of grounded) {
    const m = r.mods[mi];
    if (m.type === 'body') for (const [x, y] of m.cells) if (x >= 0 && y >= 0 && x < w && y < h) ground.add(y * w + x);
  }
  /** Per cell: [last sample it was held, longest opening so far (samples)]. */
  const held = new Map<number, [number, number]>();
  const state = newPropState();
  const out: Contrib = { solids: [], hazards: [], springs: [], winds: [], triggers: [] };
  const here = new Set<number>();
  const mark = (rc: Rect) => {
    const x0 = Math.max(0, Math.floor(rc.x / TILE + 1e-6));
    const x1 = Math.min(w - 1, Math.ceil((rc.x + rc.w) / TILE - 1e-6) - 1);
    const y0 = Math.max(0, Math.floor(rc.y / TILE + 1e-6));
    const y1 = Math.min(h - 1, Math.ceil((rc.y + rc.h) / TILE - 1e-6) - 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) here.add(y * w + x);
  };
  let n = 0;
  for (let f = RUN_COUNTDOWN; f < RUN_COUNTDOWN + SPAN; f += STEP, n++) {
    out.solids.length = out.hazards.length = out.springs.length = out.winds.length = out.triggers!.length = 0;
    here.clear();
    const ctx = (rr: Resolved, mi: number) => ({ level, frame: f, r: rr, off: motionOffset(rr, f), prev: motionOffset(rr, f - 1), state, mi, live: true });
    buildSolids([r], ctx, out);
    traceRays([r], ctx, out);
    for (const s of out.solids) if (!(s.propUid === r.pp.uid && grounded.has(s.mi)) && !s.oneWay && !s.film) mark(s);
    for (const hz of out.hazards) markHazard(hz, mark);
    for (const s of out.springs) mark(s.rect);
    for (const wd of out.winds) mark(wd);
    for (const t of out.triggers!) mark(t.r);
    for (const k of here) {
      const c = held.get(k);
      if (c) {
        c[1] = Math.max(c[1], n - c[0] - 1);
        c[0] = n;
      } else held.set(k, [n, n]);
    }
  }
  const noGo = new Set<number>();
  const need = Math.ceil(MIN_OPENING / STEP);
  for (const [k, [last, open]] of held) if (Math.max(open, n - last - 1) < need && !ground.has(k)) noGo.add(k);
  // What a module knows it holds from its own cycle, which may be longer than the span sampled.
  for (const m of r.mods)
    for (const [x, y] of moduleSim(m.type).holds?.(m) ?? []) if (x >= 0 && y >= 0 && x < w && y < h && !ground.has(y * w + x)) noGo.add(y * w + x);
  return { ground: [...ground].sort((a, b) => a - b), noGo: [...noGo].sort((a, b) => a - b) };
}

/** Cells a hazard covers: boxes for rects and circles, a chain of boxes along a beam. Generous edges only make the proof stricter. */
function markHazard(hz: Hazard, mark: (r: Rect) => void): void {
  if (hz.kind === 'rect') return mark(hz.r);
  if (hz.kind === 'circle') return mark({ x: hz.x - hz.r, y: hz.y - hz.r, w: hz.r * 2, h: hz.r * 2 });
  const dx = hz.x2 - hz.x1;
  const dy = hz.y2 - hz.y1;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (TILE / 4)));
  for (let i = 0; i <= steps; i++) {
    const x = hz.x1 + (dx * i) / steps;
    const y = hz.y1 + (dy * i) / steps;
    mark({ x: x - hz.r, y: y - hz.r, w: hz.r * 2, h: hz.r * 2 });
  }
}
