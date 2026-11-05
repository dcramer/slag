import { Rng } from '../core/rng';
import type { ViewXform } from '../game/view';
import { DIFFICULTIES, generateLevel } from '../gen/level';
import type { ProfileOverride } from '../gen/level/profile';
import { cycleFrames } from '../gen/setpieces/place';
import { SET_PIECES } from '../gen/setpieces';
import { ownPieces } from '../gen/stage';
import { RUN_COUNTDOWN, TILE, VIEW_H, VIEW_W } from '../sim/constants';
import type { Difficulty, Level, SizeClass, TileRect } from '../sim/level';
import { buildSolids, type Contrib, footprintCells, motionOffset, type PropCtx, type Resolved, traceRays } from '../sim/props';
import { RunWorld } from '../sim/run';
import type { ThemeId } from '../themes';

/**
 * The codex's map pictures, planned: which level each one shows, where the camera looks and at which frame
 * of a race. A pure function of the job, so the same picture comes back on every machine; it runs in a
 * worker (./map-worker.ts) and the renderer draws the result on the page (./map-view.ts).
 *
 * A theme shows a plain level of its own, whole. A landmark shows a level raised round it, framed on its box.
 * A hazard is placed alone on a plain level of its theme, framed on what it reaches and caught at the busiest
 * frame of its cycle: a cave-in mid-fall, a ladle mid-pour, a shot in flight.
 */

export type MapKind = 'theme' | 'landmark' | 'hazard';

export interface MapJob {
  kind: MapKind;
  theme: ThemeId;
  /** The concept id or the recipe name; the theme's id for the theme itself. */
  id: string;
}

export interface MapShot {
  level: Level;
  /** Where the camera looks: world px at the centre of the view, and view px per world px. */
  view: ViewXform;
  /** Race frame to show (counted from the countdown's start, as `RunWorld.frame`). */
  frame: number;
}

/** Seeds a picture is drawn from, first first: a landmark that doesn't stand up at one tries the next. */
export const SHOT_SEEDS = [1, 2, 3, 4, 5, 6];
/** Placements tried per terrain for a hazard (as tests/conformance/hazards does). */
const REROLLS = 12;
/** Pictures are clear: mist would veil a level with nobody on it. */
const CLEAR: ProfileOverride = { weather: 'clear' };
/** Frames into the race a still of a theme or a landmark shows: movers well under way. */
const SETTLE = 100;
/** Longest stretch of a cycle searched for its busiest frame (the page replays this many frames to show it). */
const MAX_SEARCH = 480;
/** Fewest tiles across a hazard's picture, so it stands in a place; and the closest zoom. */
const MIN_TILES = 22;
const MAX_ZOOM = 2;
/** Shots further than this from the piece (tiles) don't stretch its picture. */
const SHOT_REACH = 12;

/**
 * Plain levels made so far, by seed, theme, size and difficulty. Every hazard of a theme searches the same
 * terrains, and a level is what a picture costs, so each is generated once per page (or worker). A picture
 * gets its own copy: the race it is caught in, and the page that draws it, may change it.
 */
const plains = new Map<string, Level>();

const plain = (seed: number, theme: ThemeId, size: SizeClass = 'classic', difficulty?: Difficulty): Level => {
  const key = `${seed}|${theme}|${size}|${difficulty ?? ''}`;
  let level = plains.get(key);
  if (!level) plains.set(key, (level = generateLevel(seed, theme, { ...CLEAR, concept: 'plain', size, ...(difficulty ? { difficulty } : {}) })));
  return structuredClone(level);
};

/** The picture for a job, or null if its landmark never stands up or its hazard never places on the seeds tried. */
export function planShot(job: MapJob): MapShot | null {
  if (job.kind === 'theme') {
    const level = plain(SHOT_SEEDS[0], job.theme);
    return { level, view: frameRect(level, { x: 0, y: 0, w: level.w * TILE, h: level.h * TILE }, 0), frame: RUN_COUNTDOWN + SETTLE };
  }
  if (job.kind === 'landmark') {
    for (const seed of SHOT_SEEDS) {
      const level = generateLevel(seed, job.theme, { ...CLEAR, concept: job.id });
      const lm = level.landmark;
      if (lm?.concept !== job.id) continue;
      const uids = new Set(ownPieces(level).map((p) => p.uid));
      const { frame } = busiest(level, uids, SETTLE);
      return { level, view: frameRect(level, tileRect(lm.rect), 2), frame };
    }
    return null;
  }
  // The first placement clear of the level's edges, where the picture has room round it; else the first at all.
  // On classic levels, or on wide ones for a hazard that needs more flat ground than they have (a combine's field).
  for (const size of ['classic', 'wide'] as const) {
    let first: Level | null = null;
    for (let i = 0; i < SHOT_SEEDS.length; i++) {
      // Every difficulty in turn, as tests/conformance/hazards samples them: the terrain is the difficulty's.
      const terrain: Level = { ...plain(SHOT_SEEDS[i], job.theme, size, DIFFICULTIES[Math.floor(i / 2) % DIFFICULTIES.length]), setPieces: [] };
      for (let k = 0; k < REROLLS; k++) {
        const got = SET_PIECES[job.theme](new Rng(k * 7919 + i), terrain, { count: 1, family: [job.id] });
        if (!got.length) continue;
        const level = { ...terrain, setPieces: got };
        first ??= level;
        if (inside(level)) return hazardShot(level);
      }
    }
    if (first) return hazardShot(first);
  }
  return null;
}

/** Tiles a hazard's piece keeps from the level's sides to be pictured where it stands, with room round it. */
const EDGE = 4;

const inside = (level: Level) => footprintCells(level.setPieces[0]).every(([x]) => x >= EDGE && x < level.w - EDGE);

function hazardShot(level: Level): MapShot {
  const pp = level.setPieces[0];
  const { frame, box } = busiest(level, new Set([pp.uid]), cycleFrames(pp.def.modules, pp.def.motion));
  return { level, view: frameRect(level, box, 3, MIN_TILES), frame };
}

const tileRect = (r: TileRect) => ({ x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE });

/** The camera pose that shows `box` (world px) with `pad` tiles round it, at least `min` tiles across. */
function frameRect(level: Level, box: { x: number; y: number; w: number; h: number }, pad: number, min = 0): ViewXform {
  const w = Math.max(box.w + pad * 2 * TILE, min * TILE);
  const h = Math.max(box.h + pad * 2 * TILE, (min * TILE * VIEW_H) / VIEW_W);
  const zoom = Math.min(MAX_ZOOM, VIEW_W / w, VIEW_H / h);
  const cx = Math.max(0, Math.min(level.w * TILE, box.x + box.w / 2));
  const cy = Math.max(0, Math.min(level.h * TILE, box.y + box.h / 2));
  return { cx, cy, zoom: Math.round(zoom * 1000) / 1000 };
}

/**
 * Run a race with nobody in it and watch the pieces in `uids` for up to `span` frames after the countdown: the
 * frame where the most of them hurts (what they build, beams and shots near them), in the middle of the
 * longest such stretch, and the box everything they did covered.
 */
function busiest(level: Level, uids: ReadonlySet<number>, span: number): { frame: number; box: { x: number; y: number; w: number; h: number } } {
  const run = new RunWorld(level, [], []);
  while (run.frame < RUN_COUNTDOWN) run.step([]);
  const mine = run.resolved.filter((r) => uids.has(r.pp.uid));
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const grow = (ax: number, ay: number, bx = ax, by = ay) => {
    x0 = Math.min(x0, ax, bx);
    y0 = Math.min(y0, ay, by);
    x1 = Math.max(x1, ax, bx);
    y1 = Math.max(y1, ay, by);
  };
  for (const r of mine) for (const [cx, cy] of footprintCells(r.pp)) grow(cx * TILE, cy * TILE, (cx + 1) * TILE, (cy + 1) * TILE);
  const home = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
  const near = (x: number, y: number) => Math.hypot(x - home.x, y - home.y) < SHOT_REACH * TILE;
  const scores: number[] = [];
  const n = Math.min(span, MAX_SEARCH);
  for (let i = 0; i < n; i++) {
    const f = run.frame;
    let score = 0;
    const out: Contrib = { solids: [], hazards: [], springs: [], winds: [], beams: [] };
    // What the race built this frame, rebuilt for these pieces alone on a copy of their state.
    const ctx = (r: Resolved, mi: number): PropCtx => ({
      level,
      frame: f,
      r,
      off: motionOffset(r, f),
      prev: motionOffset(r, f - 1),
      state: structuredClone(run.propState.get(r.pp.uid)!),
      mi,
      live: true,
    });
    buildSolids(mine, ctx, out);
    traceRays(mine, ctx, out);
    for (const h of out.hazards) {
      score++;
      if (h.kind === 'rect') grow(h.r.x, h.r.y, h.r.x + h.r.w, h.r.y + h.r.h);
      else if (h.kind === 'circle') grow(h.x - h.r, h.y - h.r, h.x + h.r, h.y + h.r);
      else grow(h.x1, h.y1, h.x2, h.y2);
    }
    for (const p of run.projectiles)
      if (p.source !== undefined && uids.has(p.source) && near(p.x, p.y)) {
        score++;
        grow(p.x, p.y);
      }
    scores.push(score);
    run.step([]);
  }
  // The middle of the longest run of the top score.
  const top = Math.max(0, ...scores);
  let best = { at: 0, len: 0 };
  for (let i = 0; i < scores.length;) {
    if (scores[i] !== top) {
      i++;
      continue;
    }
    let j = i;
    while (j < scores.length && scores[j] === top) j++;
    if (j - i > best.len) best = { at: i, len: j - i };
    i = j;
  }
  const clamp = (v: number, hi: number) => Math.max(0, Math.min(hi, v));
  x0 = clamp(x0, level.w * TILE);
  x1 = clamp(x1, level.w * TILE);
  y0 = clamp(y0, level.h * TILE);
  y1 = clamp(y1, level.h * TILE);
  return { frame: RUN_COUNTDOWN + best.at + Math.floor(best.len / 2), box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
}
