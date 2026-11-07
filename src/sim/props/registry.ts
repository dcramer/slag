import { dhypot } from '../../core/dmath';
import { type Cell, overlaps, type Rect, rectCircle, type Vec } from '../../core/geom';
import type { ItemKind, ItemSpawn } from '../items/types';
import type { Level } from '../level';
import type { Body, Solid } from '../physics';
import type { GameEvent, InputFrame } from '../types';
import type { Wind } from '../wind';
import type { GrabInit, Grip, RunnerAttach } from './attach';
import type { RunnerStatus } from './status';
import type { Ammo, HitEffect, Module, PropState, Resolved } from './types';

/**
 * Plugin contract for prop modules. Each module type lives in
 * ./modules/<type>.ts and registers a ModuleSim. RunWorld knows nothing
 * about specific modules; it just asks each one for its contributions.
 *
 * Determinism rules: build/tick must be pure functions of (module, ctx,
 * state). No Math.random, no wall-clock time, no DOM.
 */

/**
 * `ignites`: fire, beams, arcs and blasts, which set off anything that burns (Fuse Crates).
 * `sink`: a liquid you drown in rather than burn in, so it takes you as the pit does (a fall).
 */
export type Hazard = { owner: number; ignites?: boolean; sink?: boolean } & (
  | { kind: 'rect'; r: Rect }
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'seg'; x1: number; y1: number; x2: number; y2: number; r: number }
);

export interface SpringTrigger {
  rect: Rect;
  angle: number;
  power: number;
  uid: number;
  /** Launch Plate: put the runner's feet at (x, y) and set this velocity, instead of the kick (`plateArc`). */
  set?: { x: number; y: number; vx: number; vy: number };
}

export type { Wind } from '../wind';

/**
 * A zone a runner can touch. While a runner overlaps it, RunWorld calls the
 * owning module's `touch` (pipes, bumpers, magnets, webs). `key`
 * is stable across frames so modules can tell a fresh entry from staying in.
 */
export interface Trigger {
  /** Bounding rect (px). */
  r: Rect;
  /** Optional circle test (px) on top of the rect test. */
  circle?: { x: number; y: number; r: number };
  uid: number;
  mi: number;
  key: number;
}

/**
 * How far something that travels through space reaches this frame (props/rays.ts).
 * The sim cuts its hazard or column to this and the art draws from it, so a beam
 * stops exactly where it stops hurting. Reported every frame, lit or not: telegraphs
 * draw it, and the renderer shows the frame after the last one built.
 */
export interface Beam {
  uid: number;
  mi: number;
  /** Reach (px). */
  len: number;
  /** Stopped short of its full length. */
  hit: boolean;
  /** Direction it was cast in, for emitters that sweep or track. */
  angle?: number;
}

/** What a module adds to the world for one frame. */
export interface Contrib {
  solids: Solid[];
  hazards: Hazard[];
  springs: SpringTrigger[];
  winds: Wind[];
  /** Touch zones (optional so older Contrib literals stay valid). */
  triggers?: Trigger[];
  /** Filled for whoever draws them; a caller that only wants hazards can leave it out. */
  beams?: Beam[];
}

export function addTrigger(out: Contrib, t: Trigger): void {
  (out.triggers ??= []).push(t);
}

/** Does a hazard reach into this rect? Beams are checked as a chain of circles every 4 px along them. */
export function touchesHazard(b: Rect, h: Hazard): boolean {
  switch (h.kind) {
    case 'rect':
      return overlaps(b, h.r);
    case 'circle':
      return rectCircle(b, h.x, h.y, h.r);
    case 'seg': {
      const len = dhypot(h.x2 - h.x1, h.y2 - h.y1);
      const n = Math.max(1, Math.ceil(len / 4));
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        if (rectCircle(b, h.x1 + (h.x2 - h.x1) * t, h.y1 + (h.y2 - h.y1) * t, h.r)) return true;
      }
      return false;
    }
  }
}

export function touchesTrigger(b: Rect, t: Trigger): boolean {
  if (!overlaps(b, t.r)) return false;
  return !t.circle || rectCircle(b, t.circle.x, t.circle.y, t.circle.r);
}

/** Mutable access to one runner for `touch` handlers. Everything here is plain data. */
export interface RunnerMut {
  body: Body;
  status: RunnerStatus;
  attach: RunnerAttach;
}

export interface TouchCtx extends TickCtx {
  /** Would a rect here overlap a solid tile or a prop solid? */
  blocked(r: Rect): boolean;
  /** Count trigger `key` as already entered by this runner, so it won't fire as a fresh entry. */
  mark(key: number): void;
  /** Ask to hold this runner. A contested part goes to the nearest runner once everyone has moved (props/attach.ts). */
  grab(g: GrabInit): void;
  /** This runner's input this frame, for parts you work with the controls (a pipe takes down). Optional so older callers stay valid. */
  inp?: InputFrame;
  /** Another part in this race by uid, for parts that work in pairs (warp pipes). Optional so older callers stay valid. */
  peer?(uid: number): Resolved | undefined;
}

export interface PropCtx {
  level: Level;
  frame: number;
  r: Resolved;
  /** Whole-prop motion offset this frame and last frame (px). */
  off: Vec;
  prev: Vec;
  state: PropState;
  /** Index of this module within r.mods. */
  mi: number;
  /** True once the countdown is over. */
  live: boolean;
}

/** What `sense` reads: the frame's context and its solids (a lane stops on whatever is in it). */
export interface SenseCtx extends PropCtx {
  solids?: readonly Solid[];
}

export interface RunnerView {
  x: number;
  y: number;
  w: number;
  h: number;
  active: boolean;
}

export interface ProjectileSpawn {
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: number;
  ammo: Ammo;
  /** Runner index that threw it (held items); omitted for prop shots. See THROW_GRACE and AmmoSim.caught in ./ammo.ts. */
  thrower?: number;
  /** Replaces the ammo's hit effect: a thrown boomerang bonks where a launched one kills. */
  effect?: HitEffect;
  /** Prop that fired it (uid), so leaving its own body doesn't stop it. Omitted for shots from a hand. */
  source?: number;
}

export interface TickCtx extends PropCtx {
  runners: readonly RunnerView[];
  spawn(p: ProjectileSpawn): void;
  emit(e: GameEvent): void;
  /** Drop a loose held item into the run (mystery crates). Optional so headless callers can omit it. */
  spawnItem?(s: ItemSpawn): void;
  /** Put an item straight into runner `i`'s hands (a loop's boxes); false, and nothing given, if they hold one already. */
  handItem?(i: number, kind: ItemKind): boolean;
  /** Give runner `i` a Leg Day's spring for `frames` (a climb's pickups); false, and nothing given, if they can't take one. */
  surge?(i: number, frames: number): boolean;
  /** Seed of this race's item rolls: differs per round, so a crate that survives a round doesn't repeat itself. */
  itemSeed?: number;
  /** The runner index that leads the race (sim/standing.ts), worked out when asked; -1 if nobody's racing. */
  leader?(): number;
  /** This frame's solids, for anything that looks or moves through the world. Optional so headless callers can omit them. */
  solids?: readonly Solid[];
  /** This frame's hazards, for parts set off by what touches them (Fuse Crates). Optional so headless callers can omit them. */
  hazards?: readonly Hazard[];
  /** Where shots struck a solid this frame (px), for parts set off by a hit. Optional so headless callers can omit them. */
  struck?: readonly Vec[];
}

/** Tile→world transform handed to `resolve`. */
export interface Xform {
  /** Prop-local tile point → world px. */
  P(p: Vec): Vec;
  /** Prop-local cells → world tile cells. */
  C(cells: readonly Cell[]): Cell[];
  /** Rotation to add to angles (radians). */
  da: number;
  /** Tile size in px, for converting lengths. */
  T: number;
  /**
   * P for things that stand upright on a footing (a machine on its block): a quarter turn turns them like
   * P, but a half turn mirrors them left to right instead of standing them on their heads, the way their
   * art is drawn. Only for points inside a footprint that is its own mirror image (a rect).
   */
  U(p: Vec): Vec;
  /** The angle that goes with U: `a + da`, except that a half turn mirrors it. */
  UA(a: number): number;
}

export interface ModuleSim<M extends Module = Module> {
  type: M['type'];
  /** Transform a def-space module into world space. */
  resolve(m: M, x: Xform): M;
  /** Prop-local cells this module occupies (used to build the placement footprint). */
  anchors(m: M): Cell[];
  /**
   * A part may ride a mover with this module (./ride.ts): it translates rigidly by `ctx.off` in the
   * sim and by `DrawCtx.off` in the art, and neither assumes a still mount.
   */
  rides?: boolean;
  /** This module's solids can carry parts stuck to them (./ride.ts). Absent for anything that doesn't move rigidly. */
  carrier?: CarrierSim<M>;
  /** Add solids/hazards/triggers for this frame. Runs before other props' solids are all in, so anything that travels belongs in `trace`. */
  build?(m: M, ctx: PropCtx, out: Contrib): void;
  /**
   * For a part that stops on what's in its way and is itself solid (a piston): runs
   * after every `build`, and whatever it adds still blocks rays. It stops on the
   * first `fixed` solids only, never on another settling part, which keeps it
   * independent of prop order.
   */
  settle?(m: M, ctx: PropCtx, out: Contrib, fixed: number): void;
  /** Cast rays and add what they carry (props/rays.ts). Runs last, when every solid of the frame is in `out.solids`. */
  trace?(m: M, ctx: PropCtx, out: Contrib): void;
  /**
   * Cells it holds for most of its cycle, worked out from the cycle rather than sampled: the
   * barrier (props/barrier.ts) samples a fixed span that a long cycle, like a flood's, outlasts.
   */
  holds?(m: M): Cell[];
  /** Advance timers, fire projectiles, emit events. Runs after runners move. */
  tick?(m: M, ctx: TickCtx): void;
  /**
   * For a part a runner sets off (a dropper's lane, a snapper's plate): where a runner on this
   * frame would set it off, given its state, or nothing while it isn't armed. Its `tick` reads the
   * same zones, so the two can't disagree. Bots foresee what their own approach sets off with it
   * (src/brain/foresight.ts): what such a part does next isn't a function of the frame alone.
   */
  sense?(m: M, ctx: SenseCtx): Rect[];
  /** A runner is standing on one of this module's solids. */
  onStand?(m: M, ctx: TickCtx): void;
  /** A runner overlaps one of this module's triggers. `first` is true on the frame they enter it. */
  touch?(m: M, ctx: TouchCtx, who: RunnerMut, t: Trigger, first: boolean): void;
  /**
   * A runner this module grabbed: move their body instead of the controller.
   * Writes position and velocity, and returns false to let go; the velocity
   * written is what they leave with. See props/attach.ts.
   */
  hold?(m: M, ctx: TouchCtx, who: RunnerMut, g: Grip, inp: InputFrame): boolean;
}

/** How a module's solids carry what's stuck to them. */
export interface CarrierSim<M extends Module = Module> {
  /**
   * Where solid `part` is at frame f relative to the prop's own offset (px), or null if it can't
   * carry (a block that crumbles). A pure function of the frame, so riders stay deterministic.
   */
  at(m: M, f: number, phase: number, part: number): Vec | null;
  /** The module moves its solids itself (a wheel, a cart); otherwise only the prop's motion moves them. */
  drives: boolean;
  /** Frames in one cycle of that movement (0 when it doesn't move by itself). */
  period(m: M): number;
}

// Heterogeneous registry: entries are keyed by module type.
const REGISTRY = new Map<string, ModuleSim<any>>();

export function defineModule<T extends Module['type']>(sim: ModuleSim<Extract<Module, { type: T }>>): ModuleSim<Extract<Module, { type: T }>> {
  REGISTRY.set(sim.type, sim);
  return sim;
}

export function moduleSim<M extends Module>(type: M['type']): ModuleSim<M> {
  const s = REGISTRY.get(type);
  if (!s) throw new Error(`prop module "${type}" is not registered (import src/sim/props/modules)`);
  return s as ModuleSim<M>;
}

/** Stable solid id for (prop uid, module index, part). Used for platform carry. */
export function solidId(uid: number, mi: number, part: number): number {
  return (uid * 16 + mi) * 64 + Math.min(part, 63);
}

/** Point → its cell. */
export const cellOf = (p: Vec): Cell => [Math.floor(p[0]), Math.floor(p[1])];
