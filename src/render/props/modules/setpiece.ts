import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { type Level, tileAt } from '../../../sim/level';
import { hash2 } from '../../../core/rng';
import { line, type P, stroke } from '../../ink';
import { boxPts, dot, INK, ovalPts, path, pen, sprite, stamp, tick, tone } from '../../ink-props';
import { circle, type MetalPalette } from '../../kit';

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

/** A sagging rope or vine: an ink ribbon under a colored one, with the twist ticked along it. */
export function rope(s: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: HSL, w = 1.4, sag = 2) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + sag;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.max(3, Math.ceil(len / 3));
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    pts.push({ x: u * u * x1 + 2 * u * t * mx + t * t * x2, y: u * u * y1 + 2 * u * t * my + t * t * y2 });
  }
  s.fillStyle = css(color, -34, 1, 6);
  stroke(s, pts, { w: w + 0.9, seed: 3, taper: [0, 0], press: 0.1 });
  s.fillStyle = css(color);
  stroke(s, pts, { w, seed: 4, taper: [0, 0], press: 0.1 });
  // Twist: short lit ticks across the lay of the rope.
  s.fillStyle = css(color, 18);
  for (let i = 1; i < n; i += 1) {
    const p = pts[i];
    const q = pts[i + 1];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    s.fillRect(p.x - (dy / d) * w * 0.3 - 0.25, p.y + (dx / d) * w * 0.3 - 0.25, 0.5, 0.5);
  }
}

/** A chain link along +x, `link` px long: a ring face on, or a bar edge on. Baked once per palette and size. */
function linkSprite(pal: MetalPalette, link: number, edge: boolean) {
  const L = link * 0.62;
  return sprite(`sp|link|${edge}|${link.toFixed(1)}|${pal.base.h},${pal.base.l},${pal.dark.l}`, -L - 1, -2.2, L * 2 + 2, 4.4, (g) => {
    if (edge) {
      g.fillStyle = INK;
      path(g, boxPts(-L, -0.8, L * 2, 1.6, 0.8, 3));
      g.fill();
      g.fillStyle = css(pal.base, -6);
      path(g, boxPts(-L + 0.3, -0.45, L * 2 - 0.6, 0.9, 0.45, 3));
      g.fill();
      return;
    }
    g.fillStyle = INK;
    path(g, ovalPts(0.1, 0.15, L + 0.4, 1.95, 4, 0.03, 14));
    g.fill();
    g.fillStyle = css(pal.base);
    path(g, ovalPts(0, 0, L, 1.55, 4, 0.03, 14));
    g.fill();
    g.fillStyle = css(pal.light, -4);
    g.fillRect(-L * 0.6, -1.3, L * 1.1, 0.45);
    g.globalCompositeOperation = 'destination-out';
    path(g, ovalPts(0, 0, L * 0.55, 0.55, 5, 0.03, 10));
    g.fill();
    g.globalCompositeOperation = 'source-over';
  });
}

/** Iron chain of alternating links. */
export function chain(s: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, pal: MetalPalette, link = 3.2) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const a = Math.atan2(y2 - y1, x2 - x1);
  const n = Math.max(2, Math.round(len / link));
  const face = linkSprite(pal, link, false);
  const edge = linkSprite(pal, link, true);
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    s.save();
    s.translate(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
    s.rotate(a);
    stamp(s, i % 2 ? edge : face);
    s.restore();
  }
}

/** Wooden plank(s), inked: hand-cut, two tones, grain, board seams and nails. Baked per size. */
export function plank(s: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, woodHue: number, seed = 0, l = 40) {
  const key = `sp|plank|${w.toFixed(1)}|${h.toFixed(1)}|${woodHue | 0}|${l}|${seed % 4}`;
  stamp(
    s,
    sprite(key, -2, -2, w + 4, h + 4, (g) => {
      const base: HSL = { h: woodHue, s: 48, l };
      const pts = boxPts(0, 0, w, h, 1.6, seed, 0.12);
      tone(g, pts, base, { depth: Math.min(1.3, h * 0.22) });
      g.save();
      path(g, pts);
      g.clip();
      const grain = css(base, -16, 1, 6);
      const rows = Math.max(1, Math.round(h / 4));
      for (let i = 1; i <= rows; i++) {
        const yy = (h * i) / (rows + 1);
        for (let xx = 2 + hash2(i, seed, 1) * 4; xx < w - 3; xx += 7 + hash2(i, xx, seed) * 5)
          tick(g, xx, yy, xx + 3.5, yy + (hash2(xx, i, seed) - 0.5) * 0.6, 0.45, xx + i, grain);
      }
      for (let xx = TILE; xx < w - 2; xx += TILE) tick(g, xx, 0, xx + 0.3, h, 0.7, xx, INK);
      g.restore();
      pen(g, pts, seed + 1, 0.5, Math.min(1.3, 0.6 + h * 0.08));
      for (let xx = 3; xx < w - 1; xx += TILE) {
        dot(g, xx, h / 2, 0.55, xx);
        dot(g, Math.min(w - 3, xx + TILE - 6), h / 2, 0.55, xx + 1);
      }
    }),
    x,
    y,
  );
}

/** Spoked wheel with tyre, inked. `rot` turns spokes and tread; `tyre` = rubber thickness. */
export function wheel(
  s: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rot: number,
  o: { hub: HSL; rim: HSL; tyre?: number; spokes?: number; tread?: boolean; wood?: boolean },
) {
  const tyre = o.tyre ?? r * 0.32;
  s.fillStyle = INK;
  circle(s, x + 0.3, y + 0.35, r + 0.9);
  if (tyre > 0) {
    s.fillStyle = o.wood ? css(o.rim, -18) : '#24242a';
    circle(s, x, y, r);
    if (o.tread) {
      s.fillStyle = o.wood ? css(o.rim, -32) : '#101013';
      const n = Math.max(8, Math.round(r * 1.6));
      for (let i = 0; i < n; i++) {
        const a = rot + (i / n) * Math.PI * 2;
        const c = Math.cos(a);
        const q = Math.sin(a);
        s.beginPath();
        s.moveTo(x + c * (r + 0.6) - q * 1, y + q * (r + 0.6) + c * 1);
        s.lineTo(x + c * (r + 0.6) + q * 1, y + q * (r + 0.6) - c * 1);
        s.lineTo(x + c * (r - 1.4) + q * 0.8, y + q * (r - 1.4) - c * 0.8);
        s.lineTo(x + c * (r - 1.4) - q * 0.8, y + q * (r - 1.4) + c * 0.8);
        s.fill();
      }
    }
    // A hard lit crescent, fixed to the light, not the spin.
    s.fillStyle = o.wood ? css(o.rim, -4) : '#3c3c44';
    s.beginPath();
    s.arc(x, y, r - 0.6, Math.PI * 1.05, Math.PI * 1.55);
    s.arc(x, y, r - tyre * 0.55, Math.PI * 1.55, Math.PI * 1.05, true);
    s.fill();
  }
  const ri = r - tyre;
  s.fillStyle = INK;
  circle(s, x, y, ri + 0.35);
  s.fillStyle = css(o.rim, -12, 1, 4);
  circle(s, x, y, ri);
  s.save();
  s.beginPath();
  s.arc(x, y, ri, 0, Math.PI * 2);
  s.clip();
  s.fillStyle = css(o.rim, 6);
  circle(s, x - ri * 0.2, y - ri * 0.22, ri * 0.9);
  s.restore();
  const n = o.spokes ?? 5;
  s.fillStyle = css(o.rim, -34, 1, 6);
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    line(s, x + Math.cos(a) * ri * 0.25, y + Math.sin(a) * ri * 0.25, x + Math.cos(a) * ri * 0.86, y + Math.sin(a) * ri * 0.86, {
      w: Math.max(0.7, ri * 0.15),
      seed: i,
      taper: [0.05, 0.3],
      press: 0,
    });
  }
  s.fillStyle = INK;
  circle(s, x, y, Math.max(1.4, ri * 0.34));
  s.fillStyle = css(o.hub);
  circle(s, x, y, Math.max(1.1, ri * 0.28));
  s.fillStyle = css(o.hub, 28);
  circle(s, x - 0.4, y - 0.4, Math.max(0.45, ri * 0.11));
}

/** Steel lattice column from y0 (top) down to y1, `w` wide: two penned rails and a zigzag of braces. */
export function lattice(s: CanvasRenderingContext2D, x: number, y0: number, y1: number, w: number, pal: MetalPalette, paint?: HSL) {
  const c = paint ?? pal.base;
  for (const ox of [-w / 2, w / 2]) {
    s.fillStyle = INK;
    line(s, x + ox, y0, x + ox, y1, { w: 2.8, seed: ox, taper: [0, 0], press: 0.1 });
    s.fillStyle = css(c, ox < 0 ? 6 : -10);
    line(s, x + ox, y0, x + ox, y1, { w: 1.5, seed: ox + 1, taper: [0, 0], press: 0.1 });
  }
  const step = w * 1.1;
  let flip = false;
  for (let y = y0; y < y1 - 0.5; y += step) {
    const yb = Math.min(y1, y + step);
    s.fillStyle = INK;
    line(s, x + (flip ? w / 2 : -w / 2), y, x + (flip ? -w / 2 : w / 2), yb, { w: 1.5, seed: y, taper: [0, 0], press: 0 });
    line(s, x - w / 2, yb, x + w / 2, yb, { w: 1.5, seed: y + 1, taper: [0, 0], press: 0 });
    s.fillStyle = css(c, -4);
    line(s, x + (flip ? w / 2 : -w / 2), y, x + (flip ? -w / 2 : w / 2), yb, { w: 0.7, seed: y, taper: [0, 0], press: 0 });
    line(s, x - w / 2, yb, x + w / 2, yb, { w: 0.7, seed: y + 1, taper: [0, 0], press: 0 });
    flip = !flip;
  }
}

/** A metal bar (rods, spars, booms): an ink ribbon, the metal over it, a lit stripe along the top. */
export function bar(s: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, pal: MetalPalette) {
  s.fillStyle = INK;
  line(s, x1, y1, x2, y2, { w: w + 1.3, seed: 1, taper: [0, 0], press: 0.05 });
  s.fillStyle = css(pal.base);
  line(s, x1, y1, x2, y2, { w, seed: 2, taper: [0, 0], press: 0.05 });
  const d = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = (y2 - y1) / d;
  const ny = -(x2 - x1) / d;
  const k = (ny > 0 ? -1 : 1) * w * 0.25;
  s.fillStyle = css(pal.light, 0, 0.85);
  line(s, x1 + nx * k, y1 + ny * k, x2 + nx * k, y2 + ny * k, { w: w * 0.25, seed: 3, taper: [0.1, 0.1], press: 0 });
}
