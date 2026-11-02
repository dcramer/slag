import { type Cell, overlaps, type Rect, rectCircle, type Vec } from '../../core/geom';
import type { ItemSpawn } from '../items/types';
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

/** `sink`: a liquid you drown in rather than burn in, so it takes you as the pit does (a fall). */
export type Hazard = { owner: number; sink?: boolean } & (
  | { kind: 'rect'; r: Rect }
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'seg'; x1: number; y1: number; x2: number; y2: number; r: number }
);

export interface SpringTrigger {
  rect: Rect;
  angle: number;
  power: number;
  uid: number;
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
  /** Seed of this race's item rolls: differs per round, so a crate that survives a round doesn't repeat itself. */
  itemSeed?: number;
  /** This frame's solids, for anything that looks or moves through the world. Optional so headless callers can omit them. */
  solids?: readonly Solid[];
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
}

export interface ModuleSim<M extends Module = Module> {
  type: M['type'];
  /** Transform a def-space module into world space. */
  resolve(m: M, x: Xform): M;
  /** Prop-local cells this module occupies (used to build the placement footprint). */
  anchors(m: M): Cell[];
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
