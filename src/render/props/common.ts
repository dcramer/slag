import type { HSL } from '../../core/color';
import type { Cell, Vec } from '../../core/geom';
import type { CharacterDef } from '../../gen/character';
import { TILE } from '../../sim/constants';
import type { Level } from '../../sim/level';
import type { Solid } from '../../sim/physics';
import type { Beam, Grip, Module, PlacedProp, PropState, PropStyle, Resolved } from '../../sim/props';
import type { Runner, RunWorld } from '../../sim/run';
import type { MetalPalette, RC } from '../kit';

export type Emit = (kind: 'spark' | 'smoke' | 'ember' | 'debris', x: number, y: number, vx: number, vy: number, color?: HSL) => void;

export interface PropDrawOpts {
  level: Level | null;
  state?: PropState;
  broken?: boolean;
  showPath?: boolean;
  emit?: Emit;
  /** Everyone held by a part this frame (ropes bend to their rider, kegs lock their aim). */
  grips?: readonly Grip[];
  /** Placed props, for art that depends on what's around it. */
  placed?: readonly PlacedProp[];
  /** How far everything that travels reaches. Art draws from these and never casts its own rays. */
  beams?: readonly Beam[];
  /** This frame's solids (the race's, or the still ones outside a race): what a Launch Plate's flight is flown against. */
  solids?: readonly Solid[];
  /** Where the live runners stand (feet), and how fast they fall, for art that watches them. */
  runners?: readonly { x: number; y: number; vy?: number }[];
  /**
   * A crate card: a still picture a few tiles across, judged at a glance. Art may pose itself, draw a
   * thin part bolder and add the motion lines a still can't otherwise show; nothing here is a hitbox.
   */
  card?: boolean;
  /** The race's item seed (`RunWorld.itemSeed`), from which a stand's item is rolled; absent outside a race, where it holds nothing yet. */
  itemSeed?: number;
}

/** Everything a module's art function gets. */
export interface DrawCtx {
  r: Resolved;
  /** Whole-prop motion offset (px) this frame. */
  off: Vec;
  /** Index of the module within r.mods. */
  mi: number;
  style: PropStyle;
  pal: MetalPalette;
  o: PropDrawOpts;
}

/** What the sim resolved for this module, or undefined with no world to resolve it in (crate cards, the codex). */
export function beamOf(o: PropDrawOpts, r: Resolved, mi: number): Beam | undefined {
  return o.beams?.find((b) => b.uid === r.pp.uid && b.mi === mi);
}

/** The runner held by this very module, if any. */
export function gripOf(d: DrawCtx): Grip | undefined {
  return d.o.grips?.find((g) => g.uid === d.r.pp.uid && g.mi === d.mi);
}

/**
 * Layer for the scenery half of a set piece (towers, masts, gantries). It paints
 * before the terrain, so the level stands in front of it (docs/DESIGN.md, render
 * layers). Only static parts nobody can touch belong here: platforms, hazards and
 * their tells stay on the front layers, where terrain can never hide them.
 */
export const BACKDROP = -1;

/**
 * Art plugin for one module type. `layer` orders drawing within a prop:
 * BACKDROP behind the terrain, 0 behind bodies (shafts, rails), 1 bodies,
 * 2 attachments, 3 effects. A module type may register several arts on
 * different layers.
 */
export interface ModuleArt<M extends Module = Module> {
  type: M['type'];
  layer: typeof BACKDROP | 0 | 1 | 2 | 3;
  draw(rc: RC, m: M, d: DrawCtx): void;
}

// Heterogeneous registry: entries are keyed by module type.
const ART = new Map<string, ModuleArt<any>[]>();

export function defineArt<T extends Module['type']>(art: ModuleArt<Extract<Module, { type: T }>>) {
  const list = ART.get(art.type) ?? [];
  list.push(art);
  ART.set(art.type, list);
  return art;
}

export function moduleArt(type: string): readonly ModuleArt[] {
  return ART.get(type) ?? [];
}

/** How a part draws a runner it holds sealed inside it (`Grip.sealed`): poking out of a keg, sliding through a pipe. */
export type HeldArt = (rc: RC, run: RunWorld, r: Runner, c: CharacterDef) => void;
const HELD = new Map<string, HeldArt>();

export function defineHeld(type: Module['type'], art: HeldArt): void {
  HELD.set(type, art);
}

/** Draw a runner held sealed by a part, through that part's own art. */
export function drawHeld(rc: RC, run: RunWorld, r: Runner, c: CharacterDef): void {
  const g = r.attach.grip;
  const m = g && run.resolved.find((x) => x.pp.uid === g.uid)?.mods[g.mi];
  if (m) HELD.get(m.type)?.(rc, run, r, c);
}

export function bbox(cells: Cell[], off: Vec) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of cells) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + 1);
    y1 = Math.max(y1, y + 1);
  }
  return { x: x0 * TILE + off[0], y: y0 * TILE + off[1], w: (x1 - x0) * TILE, h: (y1 - y0) * TILE };
}
