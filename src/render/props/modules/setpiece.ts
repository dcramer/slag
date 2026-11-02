import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { type Level, tileAt } from '../../../sim/level';
import { circle, type MetalPalette, metalFill } from '../../kit';

/**
 * Shared drawing helpers for set-piece art (rotors, vehicles, cannons,
 * geysers, deco). Pure presentation: reads the level, never writes.
 */

/** Top (px) of the first solid tile at or below y in the column under x; level bottom (+8) if none. */
export function groundBelowPx(level: Level | null, x: number, y: number, fallback = 64): number {
  if (!level) return y + fallback;
  const tx = Math.floor(x / TILE);
  for (let ty = Math.max(0, Math.floor(y / TILE)); ty < level.h; ty++) if (tileAt(level, tx, ty) === 1) return ty * TILE;
  return level.h * TILE + 8;
}

/** Bottom (px) of the first solid tile above y in the column over x; above the view if none. */
export function ceilingAbovePx(level: Level | null, x: number, y: number, fallback = 48): number {
  if (!level) return y - fallback;
  const tx = Math.floor(x / TILE);
  for (let ty = Math.floor(y / TILE) - 1; ty >= 0; ty--) if (tileAt(level, tx, ty) === 1) return (ty + 1) * TILE;
  return -24;
}

/** A sagging rope or vine. */
export function rope(s: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: HSL, w = 1.4, sag = 2) {
  s.lineCap = 'round';
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + sag;
  s.strokeStyle = css(color, -18);
  s.lineWidth = w + 0.8;
  s.beginPath();
  s.moveTo(x1, y1);
  s.quadraticCurveTo(mx, my, x2, y2);
  s.stroke();
  s.strokeStyle = css(color);
  s.lineWidth = w;
  s.stroke();
  // Twist highlights.
  const len = Math.hypot(x2 - x1, y2 - y1);
  s.strokeStyle = css(color, 18, 0.6);
  s.lineWidth = 0.6;
  s.setLineDash([1.2, 2.2]);
  s.stroke();
  s.setLineDash([]);
  void len;
}

/** Iron chain of alternating links. */
export function chain(s: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, pal: MetalPalette, link = 3.2) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const a = Math.atan2(y2 - y1, x2 - x1);
  const n = Math.max(2, Math.round(len / link));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    s.save();
    s.translate(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
    s.rotate(a);
    s.strokeStyle = css(pal.dark, -6);
    s.lineWidth = 1.5;
    s.beginPath();
    s.ellipse(0, 0, link * 0.62, i % 2 ? 0.7 : 1.5, 0, 0, Math.PI * 2);
    s.stroke();
    if (i % 2 === 0) {
      s.strokeStyle = css(pal.light, 0, 0.8);
      s.lineWidth = 0.6;
      s.beginPath();
      s.ellipse(0, -0.3, link * 0.5, 1.1, 0, Math.PI, Math.PI * 2);
      s.stroke();
    }
    s.restore();
  }
}

/** Wooden plank(s) with grain, end shading and nails. */
export function plank(s: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, woodHue: number, seed = 0, l = 40) {
  const base: HSL = { h: woodHue, s: 48, l };
  s.fillStyle = 'rgba(0,0,0,0.28)';
  s.beginPath();
  s.roundRect(x + 1, y + 2, w, h, 2);
  s.fill();
  const g = s.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, css(base, 16));
  g.addColorStop(0.35, css(base, 4));
  g.addColorStop(1, css(base, -14));
  s.fillStyle = g;
  s.beginPath();
  s.roundRect(x, y, w, h, 2);
  s.fill();
  s.strokeStyle = css(base, -26);
  s.lineWidth = 1;
  s.stroke();
  s.save();
  s.clip();
  s.strokeStyle = css(base, -12, 0.55);
  s.lineWidth = 0.6;
  const rows = Math.max(1, Math.round(h / 4));
  for (let i = 1; i <= rows; i++) {
    const yy = y + (h * i) / (rows + 1);
    s.beginPath();
    s.moveTo(x, yy);
    for (let xx = x; xx <= x + w; xx += 6) s.lineTo(xx, yy + Math.sin(xx * 0.3 + seed + i) * 0.5);
    s.stroke();
  }
  // Board seams.
  s.strokeStyle = css(base, -30, 0.8);
  s.lineWidth = 0.8;
  for (let xx = x + TILE; xx < x + w - 2; xx += TILE) {
    s.beginPath();
    s.moveTo(xx, y);
    s.lineTo(xx, y + h);
    s.stroke();
  }
  s.restore();
  s.fillStyle = css(base, 30, 0.5);
  s.fillRect(x + 1.5, y + 0.8, w - 3, 0.8);
  s.fillStyle = '#2b2622';
  for (let xx = x + 3; xx < x + w - 1; xx += TILE) {
    circle(s, xx, y + h / 2, 0.8);
    circle(s, Math.min(x + w - 3, xx + TILE - 6), y + h / 2, 0.8);
  }
}

/** Spoked wheel with tyre. `rot` turns spokes; `tyre` = rubber thickness. */
export function wheel(
  s: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rot: number,
  o: { hub: HSL; rim: HSL; tyre?: number; spokes?: number; tread?: boolean; wood?: boolean },
) {
  const tyre = o.tyre ?? r * 0.32;
  s.fillStyle = 'rgba(0,0,0,0.3)';
  s.beginPath();
  s.ellipse(x, y + r - 0.5, r * 0.95, 1.6, 0, 0, Math.PI * 2);
  s.fill();
  if (tyre > 0) {
    s.fillStyle = o.wood ? css(o.rim, -18) : '#1d1d22';
    circle(s, x, y, r);
    if (o.tread) {
      s.fillStyle = o.wood ? css(o.rim, -30) : '#0d0d10';
      const n = Math.max(8, Math.round(r * 1.6));
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * Math.PI * 2;
        s.save();
        s.translate(x + Math.cos(a) * (r - 0.6), y + Math.sin(a) * (r - 0.6));
        s.rotate(a);
        s.fillRect(-1, -1.2, 2.2, 2.4);
        s.restore();
      }
    }
    s.strokeStyle = 'rgba(255,255,255,0.12)';
    s.lineWidth = 0.8;
    s.beginPath();
    s.arc(x, y, r - 1, Math.PI * 1.1, Math.PI * 1.6);
    s.stroke();
  }
  const ri = r - tyre;
  const g = s.createRadialGradient(x - ri * 0.3, y - ri * 0.3, 0, x, y, ri);
  g.addColorStop(0, css(o.rim, 20));
  g.addColorStop(1, css(o.rim, -12));
  s.fillStyle = g;
  circle(s, x, y, ri);
  s.strokeStyle = css(o.rim, -30);
  s.lineWidth = 0.8;
  s.stroke();
  const n = o.spokes ?? 5;
  s.strokeStyle = css(o.rim, -24);
  s.lineWidth = Math.max(0.8, ri * 0.16);
  s.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    s.moveTo(x + Math.cos(a) * ri * 0.25, y + Math.sin(a) * ri * 0.25);
    s.lineTo(x + Math.cos(a) * ri * 0.85, y + Math.sin(a) * ri * 0.85);
  }
  s.stroke();
  s.fillStyle = css(o.hub);
  circle(s, x, y, Math.max(1.2, ri * 0.3));
  s.fillStyle = css(o.hub, 25);
  circle(s, x - 0.4, y - 0.4, Math.max(0.5, ri * 0.12));
}

/** Steel lattice column from y0 (top) down to y1, `w` wide. */
export function lattice(s: CanvasRenderingContext2D, x: number, y0: number, y1: number, w: number, pal: MetalPalette, paint?: HSL) {
  const c = paint ? css(paint) : css(pal.base);
  const d = paint ? css(paint, -25) : css(pal.dark);
  s.strokeStyle = d;
  s.lineWidth = 2.6;
  s.beginPath();
  s.moveTo(x - w / 2, y0);
  s.lineTo(x - w / 2, y1);
  s.moveTo(x + w / 2, y0);
  s.lineTo(x + w / 2, y1);
  s.stroke();
  s.strokeStyle = c;
  s.lineWidth = 1.5;
  s.stroke();
  s.lineWidth = 0.9;
  s.beginPath();
  const step = w * 1.1;
  let flip = false;
  for (let y = y0; y < y1 - 0.5; y += step) {
    const yb = Math.min(y1, y + step);
    s.moveTo(x + (flip ? w / 2 : -w / 2), y);
    s.lineTo(x + (flip ? -w / 2 : w / 2), yb);
    s.moveTo(x - w / 2, yb);
    s.lineTo(x + w / 2, yb);
    flip = !flip;
  }
  s.strokeStyle = c;
  s.stroke();
}

/** Bright metal bar (rods, spars, booms). */
export function bar(s: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, pal: MetalPalette) {
  s.save();
  s.translate(x1, y1);
  const a = Math.atan2(y2 - y1, x2 - x1);
  const len = Math.hypot(x2 - x1, y2 - y1);
  s.rotate(a);
  s.fillStyle = metalFill(s, pal, 0, -w / 2, len, w, Math.PI / 2);
  s.beginPath();
  s.roundRect(0, -w / 2, len, w, w / 2);
  s.fill();
  s.strokeStyle = css(pal.dark, -8);
  s.lineWidth = 0.7;
  s.stroke();
  s.restore();
}
