import { css, type HSL } from '../../../core/color';
import type { Rect } from '../../../core/geom';
import { TILE } from '../../../sim/constants';
import type { CannonLook, DecoKind, Module, ModuleOf, RotorArm, RotorLook } from '../../../sim/props';
import type { ThemeId } from '../../../themes';
import { inkFor, type P } from '../../ink';
import { barLine, boxPts, pen, tone } from '../../ink-props';
import type { RC } from '../../kit';
import type { DrawCtx } from '../common';

/**
 * What a theme skin is, and the pen helpers the theme files share. Each theme's skins live in
 * ./<theme>.ts so per-theme art can be written in parallel; ./index.ts collects them.
 */

export type Rotor = ModuleOf<'rotor'>;
export type Cannon = ModuleOf<'cannon'>;
export type Deco = ModuleOf<'deco'>;

export const themeOf = (d: DrawCtx): ThemeId | undefined => d.o.level?.theme.id;

/** A tube drawn with the pen: the colour inside a rim that's a dark of it, and a lit stripe along its top. */
export function tube(s: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, col: HSL, seed: number) {
  barLine(s, ax, ay, bx, by, w, col, seed, { taper: [0, 0], press: 0.05, lit: 22 });
}

/** A rect platform inked with the pen, exactly on the rect the sim builds. */
export function slab(s: CanvasRenderingContext2D, p: Rect, base: HSL, seed: number) {
  const pts = boxPts(p.x, p.y, p.w, p.h, 1.6, seed, 0.12);
  tone(s, pts, base, { depth: Math.min(1.4, p.h * 0.2) });
  return pts;
}

/**
 * How a theme draws its backdrop shells under the level's sky. Shells stand behind the play, so their tones
 * go part of the way toward the fog, and their pen is a dark of each tone, never black. Each theme picks its
 * own numbers (how far back its shells sit, how much colour the haze takes) and keeps them.
 */
export interface HazeSpec {
  /** Share of the way a tone's lightness goes toward the fog's. */
  haze: number;
  /** Saturation lost, as a multiple of `haze` (1 by default; more where the haze should take more colour than light). */
  desat?: number;
  /** The pen: `inkFor` the hazed tone, or a dark of it, `dark` × its lightness and never under `floor`. */
  pen: 'ink' | { dark: number; floor: number };
  /** `flat`'s depth when it isn't given one (1 by default). */
  depth?: number;
  /** `flat`'s pen weights, thin and thick (0.3, 0.8 by default). */
  weights?: readonly [number, number];
}

/** A theme's shell tones under this level's sky (`HazeSpec`): `k` keys a baked sprite to the sky it was hazed for. */
export function hazer(d: DrawCtx, spec: HazeSpec) {
  const fog = d.o.level?.theme.fog;
  const { haze } = spec;
  const desat = spec.desat ?? 1;
  const ink = spec.pen;
  /** A tone `k` of the way toward the fog. */
  const sink = (c: HSL, k: number): HSL => (fog ? { h: c.h, s: c.s * (1 - k * desat), l: c.l + (fog.l - c.l) * k } : c);
  const hsl = (c: HSL): HSL => sink(c, haze);
  return {
    k: fog ? `${fog.h | 0},${fog.s | 0},${fog.l | 0},${haze}` : '-',
    hsl,
    sink,
    c: (b: HSL, dl = 0, a = 1) => css(hsl(b), dl, a),
    ink: ink === 'ink' ? (b: HSL) => inkFor(hsl(b)) : (b: HSL) => css({ h: b.h, s: b.s * 0.5, l: Math.max(ink.floor, hsl(b).l * ink.dark) }),
    depth: spec.depth ?? 1,
    weights: spec.weights ?? ([0.3, 0.8] as const),
  };
}
export type Haze = ReturnType<typeof hazer>;

/** A flat shape in a hazed tone, penned in a dark of itself. */
export function flat(g: CanvasRenderingContext2D, pts: readonly P[], base: HSL, t: Haze, seed: number, depth = t.depth) {
  tone(g, pts, t.hsl(base), { depth });
  pen(g, pts, seed, t.weights[0], t.weights[1], 3, t.ink(base));
}

/** A shell's box in tiles: its top-left column and row, and how many columns and rows it spans. */
export const boxOf = (m: Deco) => ({ x: Math.round(m.at[0] / TILE), y: Math.round(m.at[1] / TILE), w: Math.round(m.w / TILE), h: Math.round(m.h / TILE) });

export interface RotorSkin {
  /** Scenery behind the terrain (BACKDROP). */
  support?(rc: RC, m: Rotor, d: DrawCtx): void;
  /** What hangs a platform from the hub, per arm. */
  link?(rc: RC, m: Rotor, d: DrawCtx, a: RotorArm, p: Rect): void;
  /** In place of a wheel's cog. */
  wheel?(rc: RC, m: Rotor, d: DrawCtx, arms: readonly RotorArm[], hx: number, hy: number): void;
  platform?(rc: RC, m: Rotor, d: DrawCtx, a: RotorArm, p: Rect, i: number): void;
  /** Drawn over the look's own platform. */
  over?(rc: RC, m: Rotor, d: DrawCtx, a: RotorArm, p: Rect, i: number): void;
  hub?(rc: RC, m: Rotor, d: DrawCtx): void;
}

export const STEEL: HSL = { h: 212, s: 8, l: 66 };
export const ICE: HSL = { h: 196, s: 60, l: 80 };
export const WHITE: HSL = { h: 210, s: 10, l: 88 };

/** What a cannon skin gets: the sim's pose and timing for this frame. */
export interface CannonPose {
  x: number;
  y: number;
  /** Ground under the carriage. */
  gy: number;
  dir: 1 | -1;
  /** 0..1 through the warning before a shot. */
  warn: number;
  recoil: number;
  /** Muzzle, where the shot leaves. */
  mx: number;
  my: number;
}

export type CannonSkin = (rc: RC, m: Cannon, d: DrawCtx, q: CannonPose) => void;
export type DecoSkin = (rc: RC, m: Deco, d: DrawCtx) => void;

/**
 * A theme's own art for one of its set pieces, module by module: called on every layer for every module
 * of a piece from that theme's recipes or concepts; true when it drew that module on that layer in place
 * of the module's own art. A world-only hazard a theme has and no other (a farm's live fence is a tesla
 * strung between fence posts) is drawn this way, on exactly the shapes the sim hurts with.
 */
export type PieceSkin = (rc: RC, layer: number, m: Module, d: DrawCtx) => boolean;

/** Everything one theme draws its own way: by rotor look, cannon look and deco kind, and its own set pieces. */
export interface ThemeSkins {
  rotor?: Partial<Record<RotorLook, RotorSkin>>;
  cannon?: Partial<Record<CannonLook, CannonSkin>>;
  deco?: Partial<Record<DecoKind, DecoSkin>>;
  piece?: PieceSkin;
}
