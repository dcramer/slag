import type { HSL } from '../../core/color';
import { css } from '../../core/color';
import type { Cell, Vec } from '../../core/geom';
import { TILE } from '../../sim/constants';
import type { Level } from '../../sim/level';
import type { Module, PropState, PropStyle, Resolved } from '../../sim/props';
import { circle, type MetalPalette, metalFill, type RC, rrect } from '../kit';

export type Emit = (kind: 'spark' | 'smoke' | 'ember' | 'debris', x: number, y: number, vx: number, vy: number, color?: HSL) => void;

export interface PropDrawOpts {
  level: Level | null;
  state?: PropState;
  broken?: boolean;
  showPath?: boolean;
  emit?: Emit;
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

/**
 * Art plugin for one module type. `layer` orders drawing within a prop:
 * 0 behind bodies (shafts, rails), 1 bodies, 2 attachments, 3 effects.
 * A module type may register several arts on different layers.
 */
export interface ModuleArt<M extends Module = Module> {
  type: M['type'];
  layer: 0 | 1 | 2 | 3;
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

export function cornerRadii(set: Set<string>, x: number, y: number, R: number): number[] {
  const has = (dx: number, dy: number) => set.has(`${x + dx},${y + dy}`);
  const u = !has(0, -1);
  const d = !has(0, 1);
  const l = !has(-1, 0);
  const r = !has(1, 0);
  return [u && l ? R : 0, u && r ? R : 0, d && r ? R : 0, d && l ? R : 0];
}

export function bodyPath(cells: Cell[], off: Vec, R: number, inset = 0): Path2D {
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  const p = new Path2D();
  for (const [x, y] of cells) p.roundRect(x * TILE + off[0] + inset, y * TILE + off[1] + inset, TILE - inset * 2, TILE - inset * 2, cornerRadii(set, x, y, R));
  return p;
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

export function nozzle(s: CanvasRenderingContext2D, x: number, y: number, angle: number, pal: MetalPalette, w = 5, l = 9) {
  s.save();
  s.translate(x, y);
  s.rotate(angle);
  s.fillStyle = metalFill(s, pal, 0, -w / 2, l, w);
  rrect(s, 1, -w / 2, l, w, 1.2);
  s.fill();
  s.strokeStyle = css(pal.dark, -10);
  s.lineWidth = 0.8;
  s.stroke();
  s.fillStyle = css(pal.dark);
  s.fillRect(l - 1, -w / 2 - 0.8, 2, w + 1.6);
  s.restore();
}

export function drawStar(s: CanvasRenderingContext2D, x: number, y: number, R: number, pal: MetalPalette, base: number) {
  if (R <= 0) return;
  s.fillStyle = base ? css(pal.dark) : '#d7dbe3';
  s.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const rr = i % 2 ? R * 0.4 : R;
    s.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  s.closePath();
  s.fill();
  s.fillStyle = base ? css(pal.light) : '#7c818c';
  circle(s, x, y, R * 0.25);
}

export function drawBoltShape(s: CanvasRenderingContext2D, x: number, y: number, len: number, arrow: boolean) {
  s.strokeStyle = arrow ? '#8a6a3c' : '#5f646e';
  s.lineWidth = 1.1;
  s.beginPath();
  s.moveTo(x, y);
  s.lineTo(x + len, y);
  s.stroke();
  s.fillStyle = '#d9dde5';
  s.beginPath();
  s.moveTo(x + len + 2.5, y);
  s.lineTo(x + len - 0.5, y - 1.6);
  s.lineTo(x + len - 0.5, y + 1.6);
  s.fill();
  s.fillStyle = arrow ? '#e8e2d0' : '#c8312f';
  s.beginPath();
  s.moveTo(x, y);
  s.lineTo(x + 3, y - 1.8);
  s.lineTo(x + 3, y);
  s.moveTo(x, y);
  s.lineTo(x + 3, y + 1.8);
  s.lineTo(x + 3, y);
  s.fill();
}

/** A spinning V-shaped wooden boomerang. */
export function drawBoomerang(s: CanvasRenderingContext2D, x: number, y: number, rot: number, R: number) {
  s.save();
  s.translate(x, y);
  s.rotate(rot);
  s.strokeStyle = '#4a2f18';
  s.lineWidth = 3.4;
  s.lineCap = 'round';
  s.beginPath();
  s.moveTo(-R, R * 0.55);
  s.quadraticCurveTo(0, -R * 0.7, R, R * 0.55);
  s.stroke();
  s.strokeStyle = '#c89150';
  s.lineWidth = 2.2;
  s.stroke();
  s.strokeStyle = '#e6402f';
  s.lineWidth = 2.2;
  s.beginPath();
  s.moveTo(-R * 0.15, -R * 0.1);
  s.lineTo(R * 0.15, -R * 0.1);
  s.stroke();
  s.restore();
}
