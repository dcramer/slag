import { css, type HSL } from '../core/color';
import type { Vec } from '../core/geom';
import { hash2 } from '../core/rng';
import { TILE } from '../sim/constants';
import type { Decor } from './decor';
import { blob, line, type P, shadeOf, sn, stroke } from './ink';
import type { MetalPalette, RC } from './kit';

/**
 * ART SPIKE: a saw, a spring, a wooden block and two farm props drawn the way the terrain is. Flat
 * tones, a hard shadow shape, and tapered strokes instead of gradients and even lines. The point is to
 * find out what a part costs in this style: each of these is a rewrite of that part's art, not a filter.
 */

const INK = '#1a0f0a';

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

const sawCache = new Map<string, P[]>();

function sawTeeth(R: number, teeth: number, seed: number): P[] {
  const key = `${R.toFixed(2)}:${teeth}:${seed}`;
  let pts = sawCache.get(key);
  if (pts) return pts;
  pts = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const step = (Math.PI * 2) / teeth;
    const tip = R * (0.98 + 0.08 * hash2(i, 1, seed));
    const root = R * (0.74 + 0.06 * hash2(i, 2, seed));
    // A real tooth: a long back rising to a hooked tip, then a short drop into the gullet.
    pts.push({ x: Math.cos(a) * root, y: Math.sin(a) * root });
    pts.push({ x: Math.cos(a + step * 0.42) * (root + (tip - root) * 0.55), y: Math.sin(a + step * 0.42) * (root + (tip - root) * 0.55) });
    pts.push({ x: Math.cos(a + step * 0.8) * tip, y: Math.sin(a + step * 0.8) * tip });
    pts.push({ x: Math.cos(a + step * 0.72) * ((root + tip) / 2), y: Math.sin(a + step * 0.72) * ((root + tip) / 2) });
  }
  sawCache.set(key, pts);
  return pts;
}

/** A saw blade with a chewed rim, a shadow fixed to the light rather than the spin, and speed strokes. */
export function inkSaw(rc: RC, x: number, y: number, R: number, rot: number, pal: MetalPalette, seed: number, stripes = false) {
  const s = rc.s;
  const teeth = Math.max(9, Math.round(R * 1.05));
  const pts = sawTeeth(R, teeth, seed);
  const fill = (ps: readonly P[]) => {
    s.beginPath();
    ps.forEach((p, i) => (i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y)));
    s.closePath();
  };
  s.save();
  s.translate(x, y);
  s.save();
  s.rotate(rot);
  s.fillStyle = '#cfd5dd';
  fill(pts);
  s.fill();
  s.restore();
  // The shadow stays put while the blade turns: that's what makes it read as a lit disc and not a sticker.
  s.save();
  s.rotate(rot);
  fill(pts);
  s.restore();
  s.save();
  s.clip();
  s.fillStyle = '#8c94a2';
  s.beginPath();
  s.arc(R * 0.3, R * 0.42, R * 1.05, 0, Math.PI * 2);
  s.arc(-R * 0.22, -R * 0.3, R * 1.08, 0, Math.PI * 2, true);
  s.fill('evenodd');
  s.restore();
  s.rotate(rot);
  s.fillStyle = INK;
  s.lineJoin = 'round';
  stroke(s, [...pts, pts[0], pts[1]], { w: 0.95, seed, taper: [0.01, 0.01], press: 0.35 });
  // Disc, holes and a bolt.
  s.fillStyle = css(pal.base, 8);
  blob(s, 0, 0, R * 0.5, seed + 1, 1, 0.05);
  s.fill();
  s.fillStyle = INK;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    blob(s, Math.cos(a) * R * 0.31, Math.sin(a) * R * 0.31, R * 0.1, seed + 2 + i, 1, 0.14);
    s.fill();
  }
  blob(s, 0, 0, R * 0.13, seed + 6, 1, 0.1);
  s.fill();
  const ring: P[] = [];
  for (let i = 0; i <= 20; i++) {
    const a = (i / 20) * 5.5;
    ring.push({ x: Math.cos(a) * R * 0.52, y: Math.sin(a) * R * 0.52 });
  }
  stroke(s, ring, { w: 0.85, seed: seed + 7, taper: [0.1, 0.5] });
  if (stripes) {
    s.fillStyle = 'rgb(250 200 40)';
    stroke(
      s,
      ring.map((p) => ({ x: p.x * 1.2, y: p.y * 1.2 })),
      { w: 1.3, seed: seed + 8, taper: [0.1, 0.1], press: 0.2 },
    );
  }
  s.rotate(-rot);
  // Speed strokes: they don't turn with the blade, they sit around it.
  const spin = (Math.floor(rc.frame / 3) % 3) * 2.1 + seed;
  for (let k = 0; k < 3; k++) {
    const a0 = spin + k * 2.09 + sn(k, spin, seed) * 0.4;
    const arc: P[] = [];
    for (let i = 0; i <= 8; i++) {
      const a = a0 + (i / 8) * 1.05;
      arc.push({ x: Math.cos(a) * (R + 2.4), y: Math.sin(a) * (R + 2.4) });
    }
    s.fillStyle = k === 1 ? INK : 'rgba(250,250,255,0.9)';
    stroke(s, arc, { w: 1.15, seed: seed + k, taper: [0.5, 0.5], press: 0.1 });
  }
  s.restore();
}

/** A spring as coils of drawn wire: the back of each coil is darker and thinner, the front leans on the pen. */
export function inkSpring(rc: RC, at: Vec, angle: number, hue: number, pop: number, seed: number) {
  const s = rc.s;
  s.save();
  s.translate(at[0], at[1]);
  s.rotate(angle + Math.PI / 2);
  const top = -1 - pop * 6;
  const foot = 5.5;
  const coils = 4;
  const hgt = foot - top;
  const pad: HSL = { h: hue, s: 80, l: 54 };
  // Base plate: a slightly bent bar.
  s.fillStyle = '#7d8592';
  const base: P[] = [];
  for (let i = 0; i <= 8; i++) base.push({ x: -7.2 + (14.4 * i) / 8, y: foot + 1.4 + sn(i * 0.7, 1, seed) * 0.25 });
  stroke(s, base, { w: 3.1, seed, taper: [0.02, 0.02], press: 0.1 });
  s.fillStyle = INK;
  stroke(
    s,
    base.map((p) => ({ x: p.x, y: p.y + 1.45 })),
    { w: 1.35, seed: seed + 1, taper: [0.05, 0.05], press: 0.4 },
  );
  const wire = (front: boolean) => {
    for (let c = 0; c < coils; c++) {
      const y0 = foot - (hgt * c) / coils;
      const y1 = foot - (hgt * (c + 0.5)) / coils;
      const y2 = foot - (hgt * (c + 1)) / coils;
      const pts: P[] = [];
      const a = front ? y0 : y1;
      const b = front ? y1 : y2;
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        const q = Math.cos(t * Math.PI);
        pts.push({ x: (front ? -q : q) * 5.4, y: a + (b - a) * t + Math.sin(t * Math.PI) * (front ? 1.3 : -0.8) });
      }
      s.fillStyle = INK;
      stroke(s, pts, { w: front ? 2.9 : 1.9, seed: seed + c, taper: [0.08, 0.08], press: 0.25 });
      s.fillStyle = front ? '#dfe3ea' : '#7f8794';
      stroke(s, pts, { w: front ? 1.6 : 0.9, seed: seed + c, taper: [0.12, 0.12], press: 0.25 });
    }
  };
  wire(false);
  wire(true);
  // Pad: a lump, lighter on top, a hard shadow below and one highlight stroke.
  const lump: P[] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const c = Math.cos(a);
    const q = Math.sin(a);
    lump.push({ x: Math.sign(c) * Math.pow(Math.abs(c), 0.55) * 8 + sn(i, 3, seed) * 0.3, y: top - 1.8 + Math.sign(q) * Math.pow(Math.abs(q), 0.7) * 2.3 });
  }
  const fill = (ps: readonly P[], c: string) => {
    s.fillStyle = c;
    s.beginPath();
    ps.forEach((p, i) => (i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y)));
    s.closePath();
    s.fill();
  };
  fill(lump, css(pad, -20, 1, 6));
  fill(
    lump.map((p) => ({ x: p.x - 0.4, y: p.y - (p.y > top - 1.8 ? 1.2 : 0) })),
    css(pad),
  );
  s.fillStyle = css(pad, 26, 1, -6);
  line(s, -5.2, top - 3, 1.6, top - 3.1, { w: 0.95, seed, taper: [0.2, 0.6] });
  s.fillStyle = INK;
  inkLoop(s, lump, 0, top - 1.8, seed + 8, 0.9, 1.9, 2);
  s.restore();
  if (pop > 0) {
    // A spring that's firing gets action lines, not a glow.
    s.fillStyle = INK;
    for (const k of [-1, 0, 1]) line(s, at[0] + k * 7, at[1] - 16 - pop * 2, at[0] + k * 10, at[1] - 22 - pop * 7, { w: 1.2, seed: k + 2, taper: [0.1, 0.8] });
  }
}

/** A plank or crate block: boards, grain, a brace, nails; the outline comes from `inkEdges`-style strokes. */
export function inkWood(s: CanvasRenderingContext2D, cells: readonly (readonly [number, number])[], O: Vec, hue: number, seed: number) {
  const base: HSL = { h: hue, s: 48, l: 42 };
  for (const [x, y] of cells) {
    const px = x * TILE + O[0];
    const py = y * TILE + O[1];
    const r = (k: number) => hash2(x, y + k * 37, seed);
    // Three boards, each its own tone.
    for (let b = 0; b < 3; b++) {
      s.fillStyle = css(base, (b === 1 ? -5 : b === 2 ? -11 : 3) + (r(b) - 0.5) * 8);
      s.fillRect(px, py + (b * TILE) / 3, TILE, TILE / 3 + 0.3);
    }
    s.fillStyle = INK;
    for (let b = 1; b < 3; b++)
      line(s, px + 0.5, py + (b * TILE) / 3, px + TILE - 0.5, py + (b * TILE) / 3 + (r(b + 3) - 0.5) * 1.2, { w: 1, seed: seed + b, taper: [0.1, 0.25] });
    s.fillStyle = css(base, -24, 1, 6);
    for (let k = 0; k < 4; k++) {
      const gx = px + 1.5 + r(k + 9) * 8;
      const gy = py + 2 + r(k + 13) * 12;
      line(s, gx, gy, gx + 3 + r(k + 17) * 3.5, gy + (r(k + 21) - 0.5), { w: 0.6, seed: seed + k, taper: [0.3, 0.6] });
    }
    // The cross brace is what says "crate" at this size.
    s.fillStyle = INK;
    line(s, px + 1.2, py + 1.6, px + TILE - 1.4, py + TILE - 1.6, { w: 3.6, seed: seed + 5, taper: [0.03, 0.03], press: 0.15 });
    s.fillStyle = css(base, 14);
    line(s, px + 1.2, py + 1.6, px + TILE - 1.4, py + TILE - 1.6, { w: 2, seed: seed + 6, taper: [0.03, 0.03], press: 0.15 });
    s.fillStyle = INK;
    for (const [nx, ny] of [
      [2.6, 2.6],
      [13.2, 2.8],
      [2.8, 13.2],
      [13.3, 13.4],
    ]) {
      blob(s, px + nx, py + ny, 0.62, seed + nx, 1, 0.2);
      s.fill();
    }
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
  g.fillStyle = INK;
  for (const f of [-0.2, 0.22]) {
    const tx = x + f * w;
    line(g, tx, y - h / 2 - 0.3, tx + sn(f * 9, 1, seed) * 0.8, y + h / 2 + 0.3, { w: 1.15, seed: seed + 30, taper: [0.03, 0.03], press: 0.2 });
  }
  g.restore();
  g.fillStyle = INK;
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
    g.fillStyle = INK;
    stroke(g, pts, { w: 3, seed: seed + 1, taper: [0.02, 0.02], press: 0.2 });
    g.fillStyle = css(c, 2);
    stroke(g, pts, { w: 1.7, seed: seed + 2, taper: [0.02, 0.02], press: 0.2 });
  }
  for (let i = 0; i <= d.span; i++) {
    const px = x0 + i * TILE - (i === d.span ? 2 : 0);
    const lean = (hash2(i, 3, seed) - 0.5) * 1.8;
    g.fillStyle = INK;
    line(g, px + 1 + lean, d.y - 11.6, px + 1, d.y + 1, { w: 3.9, seed: seed + i, taper: [0.03, 0], press: 0.15 });
    g.fillStyle = css(c, -6);
    line(g, px + 1 + lean, d.y - 11.2, px + 1, d.y + 1, { w: 2.5, seed: seed + i + 9, taper: [0.03, 0], press: 0.15 });
    g.fillStyle = css(c, 18);
    line(g, px + 0.4 + lean, d.y - 10.4, px + 0.4, d.y - 3, { w: 0.65, seed: seed + i, taper: [0.2, 0.5] });
  }
}

/**
 * A row of three thorns on one tile face, in a frame where the face is at x = 8 and the tips point to
 * +x (`angle` is that frame's rotation, so the shadow side stays away from the light). Each thorn is two
 * flat tones split down its spine, a pen line heavier on its dark side, and a red tip that says "ow".
 */
export function inkThorns(s: CanvasRenderingContext2D, angle: number, seed: number, rail = '#2c2f38') {
  // Which half of a thorn faces the light: the one on local -y, turned into the world.
  const upLit = shadeOf(Math.sin(angle), -Math.cos(angle)) < 0.5;
  s.fillStyle = INK;
  line(s, 7.6, -7.8, 7.6, 7.8, { w: 3.2, seed, taper: [0.05, 0.05], press: 0.2 });
  s.fillStyle = rail;
  line(s, 7.3, -7.2, 7.3, 7.2, { w: 1.5, seed: seed + 1, taper: [0.05, 0.05], press: 0.2 });
  for (let i = 0; i < 3; i++) {
    const y0 = -7.2 + i * 4.8;
    const len = 6.4 + hash2(i, 3, seed) * 1.6;
    const lean = (hash2(i, 4, seed) - 0.5) * 1.2;
    const tip = { x: 8.4 + len, y: y0 + 2.4 + lean };
    const a = { x: 8.4, y: y0 + 0.1 };
    const b = { x: 8.4, y: y0 + 4.7 };
    const mid = { x: 8.4, y: y0 + 2.4 };
    const tri = (p: P, q: P, r: P, fill: string) => {
      s.fillStyle = fill;
      s.beginPath();
      s.moveTo(p.x, p.y);
      s.lineTo(q.x, q.y);
      s.lineTo(r.x, r.y);
      s.closePath();
      s.fill();
    };
    tri(a, tip, mid, upLit ? '#eef1f6' : '#8a909c');
    tri(mid, tip, b, upLit ? '#8a909c' : '#eef1f6');
    tri({ x: tip.x - 2.6, y: tip.y - 0.75 }, tip, { x: tip.x - 2.6, y: tip.y + 0.75 }, '#c0182a');
    s.fillStyle = INK;
    stroke(s, [a, tip], { w: upLit ? 0.7 : 1.3, seed: seed + i, taper: [0.1, 0.6], press: 0.2 });
    stroke(s, [b, tip], { w: upLit ? 1.3 : 0.7, seed: seed + i + 5, taper: [0.1, 0.6], press: 0.2 });
  }
}
