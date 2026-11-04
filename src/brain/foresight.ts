import { overlaps, type Rect } from '../core/geom';
import { RUN_COUNTDOWN } from '../sim/constants';
import { buildSolids, type Contrib, type Hazard, moduleSim, motionOffset, type PropState, type Resolved, type RunnerView, traceRays } from '../sim/props';
import type { RunWorld } from '../sim/run';
import type { RaceMap } from './route';

/**
 * Parts a runner sets off (a dropper, a snapper: those with a `sense`), seen
 * coming. The race map plays every part from a fresh state, where these
 * always sit idle, so on its own the motor walks under a dropper it has just
 * set shaking and jumps into the slam. Here each such part is played forward
 * from its live state, alone among the others' solids as the map has them,
 * and a sequence of boxes (a move, standing still) sets one off on the
 * frame a box enters the zone it watches, as the runner's own approach
 * would. Played without anyone else: a part another runner sets off shows
 * up once it has been, in its live state.
 */
export interface Foresight {
  /** A fresh look along one sequence: `at` must be called frame by frame, in order, with where the body is on each. */
  watch(): Watch;
}

export interface Watch {
  /** What the parts set off hurt with, and their solids that stand elsewhere than the map says, on race frame `f`, with the body's box there. */
  at(f: number, box: Rect): Seen;
}

export interface Seen {
  hazards: readonly Hazard[];
  moved: readonly Rect[];
}

interface Frame extends Seen {
  /** Where a runner would set it off on this frame. */
  zones: Rect[];
}

const EMPTY: Seen = { hazards: [], moved: [] };
const NO_ZONES: Frame = { hazards: [], moved: [], zones: [] };
const noop = () => {};

/** Frames a played-forward part may run ahead of the race before it starts over from the live state, which bounds what it keeps. */
const KEEP = 400;

/** One part played forward from `state`, frame by frame, from race frame `start`; `trigger` stands in its zone on that first frame only. */
class Track {
  readonly frames: Frame[] = [];
  /** Its state before each frame's build, kept on the untriggered track so a trigger can branch off it. */
  readonly before: PropState[] | null;

  constructor(
    private readonly run: RunWorld,
    private readonly map: RaceMap,
    readonly r: Resolved,
    readonly start: number,
    private readonly state: PropState,
    private readonly trigger: RunnerView | null,
  ) {
    this.before = trigger ? null : [];
  }

  at(f: number): Frame {
    while (this.start + this.frames.length <= f) this.step();
    return this.frames[f - this.start] ?? NO_ZONES;
  }

  stateAt(f: number): PropState {
    this.at(f);
    return this.before![f - this.start];
  }

  private step(): void {
    const { r, state, run } = this;
    const f = this.start + this.frames.length;
    this.before?.push(cloneState(state));
    const mapped = this.map.solids(f);
    const out: Contrib = { solids: mapped.filter((s) => s.propUid !== r.pp.uid), hazards: [], springs: [], winds: [], triggers: [], beams: [] };
    const others = out.solids.length;
    const off = motionOffset(r, f);
    const prev = motionOffset(r, f - 1);
    const ctx = (_: Resolved, mi: number) => ({ level: run.level, frame: f, r, off, prev, state, mi, live: f >= RUN_COUNTDOWN });
    buildSolids([r], ctx, out);
    traceRays([r], ctx, out);
    const moved: Rect[] = [];
    for (let i = others; i < out.solids.length; i++) {
      const s = out.solids[i];
      if (s.oneWay || s.film) continue;
      const o = mapped.find((m) => m.id === s.id);
      if (!o || o.x !== s.x || o.y !== s.y || o.w !== s.w || o.h !== s.h) moved.push(s);
    }
    const zones: Rect[] = [];
    const runners = this.trigger && f === this.start ? [this.trigger] : [];
    r.mods.forEach((m, mi) => {
      const sim = moduleSim(m.type);
      const c = ctx(r, mi);
      if (sim.sense) zones.push(...sim.sense(m, { ...c, solids: out.solids }));
      sim.tick?.(m, { ...c, runners, spawn: noop, emit: noop, solids: out.solids, hazards: out.hazards, struck: [] });
    });
    this.frames.push({ hazards: out.hazards, moved, zones });
  }
}

/** A part a runner sets off: its track from the live state, and the tracks where a runner sets it off on a given frame. */
interface Part {
  r: Resolved;
  base: Track;
  fired: Map<number, Track>;
}

class Sight implements Foresight {
  private frame = -1;
  private readonly parts: Part[];

  constructor(
    private readonly run: RunWorld,
    private readonly map: RaceMap,
  ) {
    this.parts = run.resolved.filter((r) => r.mods.some((m) => moduleSim(m.type).sense)).map((r) => ({ r, base: this.track(r), fired: new Map() }));
  }

  private track(r: Resolved): Track {
    return new Track(this.run, this.map, r, this.run.frame, cloneState(this.run.propState.get(r.pp.uid)!), null);
  }

  /** Starts a part over from its live state wherever the race went another way than its track (someone set it off). */
  sync(): void {
    const f = this.run.frame;
    if (f === this.frame) return;
    this.frame = f;
    for (const p of this.parts) {
      const i = f - p.base.start;
      const before = p.base.before!;
      if (i < before.length && i < KEEP && sameState(before[i], this.run.propState.get(p.r.pp.uid)!)) {
        for (const k of p.fired.keys()) if (k < f) p.fired.delete(k);
        continue;
      }
      p.base = this.track(p.r);
      p.fired.clear();
    }
  }

  watch(): Watch {
    if (!this.parts.length) return { at: () => EMPTY };
    const set = new Map<Part, Track>();
    return {
      at: (f, box) => {
        const hazards: Hazard[] = [];
        const moved: Rect[] = [];
        for (const p of this.parts) {
          let t = set.get(p);
          if (!t) {
            const seen = p.base.at(f);
            if (seen.zones.some((z) => overlaps(box, z))) {
              t = this.fire(p, f, box);
              set.set(p, t);
            }
          }
          const seen = (t ?? p.base).at(f);
          hazards.push(...seen.hazards);
          moved.push(...seen.moved);
        }
        return hazards.length || moved.length ? { hazards, moved } : EMPTY;
      },
    };
  }

  /** The part as it goes if a runner enters its zone on race frame `f` (the first box to do so stands for every one). */
  private fire(p: Part, f: number, box: Rect): Track {
    let t = p.fired.get(f);
    if (!t) {
      t = new Track(this.run, this.map, p.r, f, cloneState(p.base.stateAt(f)), { x: box.x, y: box.y, w: box.w, h: box.h, active: true });
      p.fired.set(f, t);
    }
    return t;
  }
}

const sights = new WeakMap<RunWorld, Sight>();

/** The foresight of `run` as it stands now, shared by every bot on this machine. */
export function foresight(run: RunWorld, map: RaceMap): Foresight {
  let s = sights.get(run);
  if (!s) {
    s = new Sight(run, map);
    sights.set(run, s);
  }
  s.sync();
  return s;
}

function cloneState(s: PropState): PropState {
  return { triggerFrame: s.triggerFrame, brokenUntil: s.brokenUntil, lastFire: s.lastFire, aim: new Map(s.aim), vars: new Map(s.vars) };
}

function sameMap(a: ReadonlyMap<unknown, number>, b: ReadonlyMap<unknown, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

function sameState(a: PropState, b: PropState): boolean {
  return a.triggerFrame === b.triggerFrame && a.brokenUntil === b.brokenUntil && a.lastFire === b.lastFire && sameMap(a.aim, b.aim) && sameMap(a.vars, b.vars);
}
