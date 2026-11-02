import { css, type HSL } from '../../../core/color';
import type { Rect } from '../../../core/geom';
import type { CannonLook, DecoKind, Module, ModuleOf, RotorArm, RotorLook } from '../../../sim/props';
import type { ThemeId } from '../../../themes';
import { line } from '../../ink';
import { boxPts, INK, tone } from '../../ink-props';
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

/** A tube drawn with the pen: an ink ribbon under a colored one, and a lit stripe along its top. */
export function tube(s: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, col: HSL, seed: number) {
  s.fillStyle = INK;
  line(s, ax, ay, bx, by, { w: w + 1.4, seed, taper: [0, 0], press: 0.05 });
  s.fillStyle = css(col);
  line(s, ax, ay, bx, by, { w, seed: seed + 1, taper: [0, 0], press: 0.05 });
  const d = Math.hypot(bx - ax, by - ay) || 1;
  const nx = (by - ay) / d;
  const ny = -(bx - ax) / d;
  const k = ny > 0 ? -1 : 1;
  s.fillStyle = css(col, 22);
  line(s, ax + nx * k * w * 0.25, ay + ny * k * w * 0.25, bx + nx * k * w * 0.25, by + ny * k * w * 0.25, {
    w: w * 0.22,
    seed: seed + 2,
    taper: [0.1, 0.1],
    press: 0,
  });
}

/** A rect platform inked with the pen, exactly on the rect the sim builds. */
export function slab(s: CanvasRenderingContext2D, p: Rect, base: HSL, seed: number) {
  const pts = boxPts(p.x, p.y, p.w, p.h, 1.6, seed, 0.12);
  tone(s, pts, base, { depth: Math.min(1.4, p.h * 0.2) });
  return pts;
}

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
