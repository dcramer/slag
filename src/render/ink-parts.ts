import { css } from '../core/color';
import { hash2 } from '../core/rng';
import { TILE } from '../sim/constants';
import type { Decor } from './decor';
import { blob, inkFor, line, type P, shadeOf, sn, stroke } from './ink';

/**
 * ART SPIKE: a saw, a spring, a wooden block and two farm props drawn the way the terrain is. Flat
 * tones, a hard shadow shape, and tapered strokes instead of gradients and even lines. The point is to
 * find out what a part costs in this style: each of these is a rewrite of that part's art, not a filter.
 */

/** Stroke round a closed shape in `n` overlapping pieces, heavier where it faces away from the light. */
export function inkLoop(g: CanvasRenderingContext2D, pts: readonly P[], cx: number, cy: number, seed: number, thin: number, thick: number, pieces = 3) {
  const n = pts.length;
  const span = Math.ceil(n / pieces);
  const lead = Math.floor(n * 0.82);
  for (let k = 0; k < pieces; k++) {
    const part: P[] = [];
    for (let i = 0; i <= span + 1; i++) part.push(pts[(lead + k * span + i) % n]);
    const m = part[part.length >> 1];
    const d = Math.hypot(m.x - cx, m.y - cy) || 1;
    const sh = shadeOf((m.x - cx) / d, (m.y - cy) / d);
    stroke(g, part, { w: thin + (thick - thin) * sh * sh, seed: seed + k, taper: [0.14, 0.22], press: 0.4 });
  }
}

/** A hay bale: a lump of straw strokes, bound in two turns of twine. */
export function inkHay(g: CanvasRenderingContext2D, d: Decor) {
  const k = d.size;
  const w = 12 * k;
  const h = 8.5 * k;
  const x = d.x;
  const y = d.y - h / 2;
  const seed = d.seed & 0xffff;
  const pts: P[] = [];
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const c = Math.cos(a);
    const q = Math.sin(a);
    const b = 1 + 0.07 * sn(c * 2 + 3, q * 2, seed);
    pts.push({ x: x + Math.sign(c) * Math.pow(Math.abs(c), 0.62) * (w / 2) * b, y: y + Math.sign(q) * Math.pow(Math.abs(q), 0.68) * (h / 2) * b });
  }
  const shape = () => {
    g.beginPath();
    pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
  };
  g.fillStyle = css(d.color, -16, 1, 2, -4);
  shape();
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = css(d.color, 6);
  blob(g, x - w * 0.08, y - h * 0.16, w * 0.52, seed + 1, h / w, 0.1);
  g.fill();
  g.fillStyle = css(d.color, 22, 1, 4);
  for (let i = 0; i < 7; i++) {
    const sx = x - w / 2 + hash2(i, 1, seed) * w;
    const sy = y - h / 2 + hash2(i, 2, seed) * h * 0.6;
    line(g, sx, sy, sx + 3 + hash2(i, 3, seed) * 3, sy + (hash2(i, 4, seed) - 0.5) * 1.6, { w: 0.6, seed: seed + i, taper: [0.3, 0.6] });
  }
  g.fillStyle = css(d.color, -34, 1, 6, -8);
  for (let i = 0; i < 9; i++) {
    const sx = x - w / 2 + hash2(i, 5, seed) * w;
    const sy = y - h * 0.1 + hash2(i, 6, seed) * h * 0.6;
    line(g, sx, sy, sx + 2 + hash2(i, 7, seed) * 3, sy + (hash2(i, 8, seed) - 0.5) * 1.6, { w: 0.55, seed: seed + i + 20, taper: [0.3, 0.6] });
  }
  g.fillStyle = inkFor(d.color);
  for (const f of [-0.2, 0.22]) {
    const tx = x + f * w;
    line(g, tx, y - h / 2 - 0.3, tx + sn(f * 9, 1, seed) * 0.8, y + h / 2 + 0.3, { w: 0.8, seed: seed + 30, taper: [0.03, 0.03], press: 0.2 });
  }
  g.restore();
  g.fillStyle = inkFor(d.color);
  inkLoop(g, pts, x, y, seed + 40, 0.85, 1.7, 3);
}

/** A fence that a farmer built: leaning posts, sagging rails, ink only where it counts. */
export function inkFence(g: CanvasRenderingContext2D, d: Decor) {
  const w = d.span * TILE;
  const x0 = d.x;
  const c = d.color;
  const seed = d.seed & 0xffff;
  for (const ry of [-8, -4.3]) {
    const a = ry + sn(ry, 1, seed) * 0.7;
    const b = ry + sn(ry, 2, seed) * 0.7;
    const pts: P[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push({ x: x0 - 2 + (w + 4) * t, y: d.y + a + (b - a) * t + Math.sin(t * Math.PI) * 0.5 });
    }
    g.fillStyle = inkFor(c);
    stroke(g, pts, { w: 2.48, seed: seed + 1, taper: [0.02, 0.02], press: 0.2 });
    g.fillStyle = css(c, 2);
    stroke(g, pts, { w: 1.7, seed: seed + 2, taper: [0.02, 0.02], press: 0.2 });
  }
  for (let i = 0; i <= d.span; i++) {
    const px = x0 + i * TILE - (i === d.span ? 2 : 0);
    const lean = (hash2(i, 3, seed) - 0.5) * 1.8;
    g.fillStyle = inkFor(c);
    line(g, px + 1 + lean, d.y - 11.6, px + 1, d.y + 1, { w: 3.34, seed: seed + i, taper: [0.03, 0], press: 0.15 });
    g.fillStyle = css(c, -6);
    line(g, px + 1 + lean, d.y - 11.2, px + 1, d.y + 1, { w: 2.5, seed: seed + i + 9, taper: [0.03, 0], press: 0.15 });
    g.fillStyle = css(c, 18);
    line(g, px + 0.4 + lean, d.y - 10.4, px + 0.4, d.y - 3, { w: 0.65, seed: seed + i, taper: [0.2, 0.5] });
  }
}
