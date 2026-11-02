import { css, type HSL } from '../core/color';
import type { MetalStyle } from '../gen/props';

export interface Light {
  x: number;
  y: number;
  r: number;
  color: HSL;
  /** 0..1+ */
  intensity: number;
}

/**
 * Everything a drawer needs: the albedo layer, the additive emissive layer,
 * and a list of lights to splat into the light map. All three share the
 * same world-space transform.
 */
export interface RC {
  /** Albedo. In the world pass this is the foreground layer, which the final pass inks along every edge. */
  s: CanvasRenderingContext2D;
  /** The background layer, which gets no ink: for thin or soft things that would turn into solid-looking shapes on `s`. */
  bg: CanvasRenderingContext2D;
  g: CanvasRenderingContext2D;
  lights: Light[] | null;
  /** Seconds. */
  t: number;
  /** Sim frame driving prop poses. */
  frame: number;
  /** How hard the wind shows right now (`gustShown`, -1..1): 0 in still air. */
  gust?: number;
}

/**
 * Sideways play of anything loose (banners, grass, vines, hanging things), in
 * px or radians at the caller's scale. Exactly 0 in still air: things only
 * move in a wind that's really there, leaning downwind and shaking as it blows.
 */
export function flutter(rc: RC, rate: number, phase: number): number {
  const g = rc.gust ?? 0;
  return g === 0 ? 0 : g * 1.4 + Math.abs(g) * Math.sin(rc.t * rate * 2.5 + phase) * 0.8;
}

export function light(rc: RC, x: number, y: number, r: number, color: HSL, intensity = 1) {
  rc.lights?.push({ x, y, r, color, intensity });
}

/** Soft additive glow blob on the emissive layer. */
export function glowDot(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: HSL, a = 1, core = 0.25) {
  if (r <= 0) return;
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, css(color, 25, a));
  gr.addColorStop(core, css(color, 5, a * 0.6));
  gr.addColorStop(1, css(color, 0, 0));
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

export function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  ctx.fill();
}

export function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, Math.PI * 2);
  ctx.fill();
}

export function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export interface MetalPalette {
  base: HSL;
  dark: HSL;
  light: HSL;
  spec: HSL;
}

export const METALS: Record<MetalStyle, MetalPalette> = {
  steel: { base: { h: 215, s: 10, l: 55 }, dark: { h: 220, s: 14, l: 24 }, light: { h: 210, s: 15, l: 80 }, spec: { h: 200, s: 30, l: 96 } },
  brass: { base: { h: 42, s: 55, l: 48 }, dark: { h: 35, s: 60, l: 20 }, light: { h: 48, s: 70, l: 72 }, spec: { h: 50, s: 90, l: 92 } },
  copper: { base: { h: 20, s: 55, l: 45 }, dark: { h: 12, s: 60, l: 20 }, light: { h: 25, s: 65, l: 68 }, spec: { h: 30, s: 90, l: 90 } },
  rust: { base: { h: 16, s: 45, l: 34 }, dark: { h: 10, s: 45, l: 16 }, light: { h: 25, s: 50, l: 50 }, spec: { h: 30, s: 40, l: 70 } },
  obsidian: { base: { h: 265, s: 20, l: 18 }, dark: { h: 265, s: 25, l: 7 }, light: { h: 270, s: 25, l: 40 }, spec: { h: 280, s: 60, l: 85 } },
  bone: { base: { h: 40, s: 30, l: 78 }, dark: { h: 35, s: 25, l: 40 }, light: { h: 45, s: 40, l: 90 }, spec: { h: 45, s: 50, l: 98 } },
  jade: { base: { h: 150, s: 40, l: 42 }, dark: { h: 160, s: 45, l: 18 }, light: { h: 145, s: 45, l: 65 }, spec: { h: 140, s: 60, l: 90 } },
  gold: { base: { h: 46, s: 85, l: 52 }, dark: { h: 36, s: 80, l: 24 }, light: { h: 50, s: 95, l: 74 }, spec: { h: 55, s: 100, l: 94 } },
};

/** Brushed-metal fill: vertical-ish gradient with a specular band. */
export function metalFill(ctx: CanvasRenderingContext2D, m: MetalPalette, x: number, y: number, w: number, h: number, angle = 0): CanvasGradient {
  const c = Math.cos(angle + Math.PI / 2);
  const s = Math.sin(angle + Math.PI / 2);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const L = Math.max(w, h) / 2;
  const g = ctx.createLinearGradient(cx - c * L, cy - s * L, cx + c * L, cy + s * L);
  g.addColorStop(0, css(m.light));
  g.addColorStop(0.18, css(m.spec));
  g.addColorStop(0.32, css(m.base));
  g.addColorStop(0.75, css(m.base, -6));
  g.addColorStop(1, css(m.dark));
  return g;
}

/** Spherical shading for balls, hubs, eyes. */
export function sphereFill(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, base: HSL, lift = 30, drop = 25): CanvasGradient {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  g.addColorStop(0, css(base, lift));
  g.addColorStop(0.45, css(base));
  g.addColorStop(1, css(base, -drop));
  return g;
}

export function rivet(ctx: CanvasRenderingContext2D, x: number, y: number, m: MetalPalette, r = 1.1) {
  ctx.fillStyle = css(m.dark);
  circle(ctx, x + 0.3, y + 0.4, r);
  ctx.fillStyle = css(m.light);
  circle(ctx, x - 0.2, y - 0.2, r * 0.8);
}

/** Yellow/black hazard stripes clipped to a rect. */
export function hazardStripes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a = 0.9) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = `rgba(20,20,20,${a})`;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = `rgba(250,200,40,${a})`;
  for (let i = -h; i < w + h; i += 6) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h);
    ctx.lineTo(x + i + 3, y + h);
    ctx.lineTo(x + i + 3 + h, y);
    ctx.lineTo(x + i + h, y);
    ctx.fill();
  }
  ctx.restore();
}

/** A tiny wobbly jagged polyline (lightning). Cosmetic randomness is fine here. */
export function lightning(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, jag: number, segs = 10) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const o = (Math.random() - 0.5) * jag * Math.sin(t * Math.PI) * 2;
    ctx.lineTo(x1 + dx * t + nx * o, y1 + dy * t + ny * o);
  }
  ctx.lineTo(x2, y2);
}

/** Tileable value noise generator for procedural textures. */
export function makeNoise(seed: number, period: number) {
  const N = period;
  const vals = new Float32Array(N * N);
  let s = seed >>> 0 || 1;
  for (let i = 0; i < vals.length; i++) {
    s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x9e3779b9) >>> 0;
    vals[i] = (s >>> 8) / 16777216;
  }
  const v = (x: number, y: number) => vals[(((y % N) + N) % N) * N + (((x % N) + N) % N)];
  const sm = (t: number) => t * t * (3 - 2 * t);
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = sm(x - xi);
    const fy = sm(y - yi);
    const a = v(xi, yi) + (v(xi + 1, yi) - v(xi, yi)) * fx;
    const b = v(xi, yi + 1) + (v(xi + 1, yi + 1) - v(xi, yi + 1)) * fx;
    return a + (b - a) * fy;
  };
  /** fbm in [0,1], tileable over `period` lattice cells at octave 0. */
  return (x: number, y: number, oct = 4) => {
    let amp = 0.5;
    let f = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < oct; o++) {
      sum += noise(x * f, y * f) * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  };
}

/** Layered flame shape on the emissive layer. */
export function flame(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: HSL, t: number) {
  const layers: [number, number, number][] = [
    [1, 0, 0.7],
    [0.7, 15, 0.8],
    [0.4, 35, 0.95],
  ];
  for (const [k, dl, a] of layers) {
    const ww = w * k;
    const hh = h * k;
    const wob = Math.sin(t * 13 + k * 5) * ww * 0.3;
    g.fillStyle = css(color, dl, a);
    g.beginPath();
    g.moveTo(x - ww, y);
    g.quadraticCurveTo(x - ww, y - hh * 0.6, x + wob, y - hh);
    g.quadraticCurveTo(x + ww, y - hh * 0.6, x + ww, y);
    g.quadraticCurveTo(x, y + ww * 0.8, x - ww, y);
    g.fill();
  }
}

/** Linear interpolation of two RGB triples (0..1). */
export function mixRgb(a: readonly number[], b: readonly number[], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const scratches = new Map<string, { n: number; cs: HTMLCanvasElement[] }>();

/**
 * A scratch canvas at least `w` x `h` px, reused across calls and only ever grown. Each key keeps two and
 * hands them out in turn: making a big canvas per call is a GC stall waiting to happen, and clearing one
 * the GPU still has a draw queued from stalls the page until that draw is done. Whatever the last user
 * left in it is still there: clear the part you use.
 */
export function scratch(key: string, w: number, h: number): HTMLCanvasElement {
  let e = scratches.get(key);
  if (!e) scratches.set(key, (e = { n: 0, cs: [] }));
  const i = (e.n = 1 - e.n);
  const c = (e.cs[i] ??= document.createElement('canvas'));
  if (c.width < w || c.height < h) {
    c.width = Math.max(c.width, w);
    c.height = Math.max(c.height, h);
  }
  return c;
}

/**
 * Erase everything in `a` (current transform units) outside the closed, non-overlapping loops of `mask`.
 * A destination-in fill should do this, but Chrome's GPU raster can bound it to part of the canvas and
 * leave what lies outside the path: a chunk of a progressive bake kept its material's flat fill wherever
 * the terrain's outline didn't reach, flat blocks of ground hanging in the sky. Cutting with the mask's
 * complement only ever erases what it covers, so it holds however the op is bounded.
 */
export function cutOutside(g: CanvasRenderingContext2D, mask: Path2D, a: { x0: number; y0: number; x1: number; y1: number }) {
  const inv = new Path2D();
  inv.rect(a.x0 - 2, a.y0 - 2, a.x1 - a.x0 + 4, a.y1 - a.y0 + 4);
  inv.addPath(mask);
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.fillStyle = '#000';
  g.fill(inv, 'evenodd');
  g.restore();
}

/**
 * Erase the px rect `r` of `g` outside `keep` (also px): what a bounded destination-in (see `cutOutside`)
 * may have left beyond the shapes it was given, when those shapes overlap and can't be cut by complement.
 */
export function clearAround(
  g: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  keep: { x: number; y: number; w: number; h: number },
) {
  const x0 = Math.max(r.x, keep.x);
  const y0 = Math.max(r.y, keep.y);
  const x1 = Math.min(r.x + r.w, keep.x + keep.w);
  const y1 = Math.min(r.y + r.h, keep.y + keep.h);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  if (x1 <= x0 || y1 <= y0) g.clearRect(r.x, r.y, r.w, r.h);
  else {
    g.clearRect(r.x, r.y, r.w, y0 - r.y);
    g.clearRect(r.x, y1, r.w, r.y + r.h - y1);
    g.clearRect(r.x, y0, x0 - r.x, y1 - y0);
    g.clearRect(x1, y0, r.x + r.w - x1, y1 - y0);
  }
  g.restore();
}

/** The px rect of `g` that world rect `a` covers under its current transform, clamped to the canvas. */
export function pxRect(g: CanvasRenderingContext2D, a: { x0: number; y0: number; x1: number; y1: number }): { x: number; y: number; w: number; h: number } {
  const m = g.getTransform();
  const x = Math.max(0, Math.floor(Math.min(a.x0 * m.a + m.e, a.x1 * m.a + m.e)) - 1);
  const y = Math.max(0, Math.floor(Math.min(a.y0 * m.d + m.f, a.y1 * m.d + m.f)) - 1);
  const x1 = Math.min(g.canvas.width, Math.ceil(Math.max(a.x0 * m.a + m.e, a.x1 * m.a + m.e)) + 1);
  const y1 = Math.min(g.canvas.height, Math.ceil(Math.max(a.y0 * m.d + m.f, a.y1 * m.d + m.f)) + 1);
  return { x, y, w: Math.max(0, x1 - x), h: Math.max(0, y1 - y) };
}

/** Fresh offscreen canvas with a 2D context pre-scaled by `k`. */
export function offscreen(w: number, h: number, k = 1): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * k));
  c.height = Math.max(1, Math.ceil(h * k));
  const g = c.getContext('2d')!;
  g.scale(k, k);
  return [c, g];
}
