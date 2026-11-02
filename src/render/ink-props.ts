import { css, type HSL } from '../core/color';
import { hash2 } from '../core/rng';
import { blob, line, type P, sn, stroke } from './ink';
import { inkLoop } from './ink-parts';

/**
 * The pen for hazards, launchers and gadgets: hand-cut shapes in two flat tones with a hard shadow,
 * outlined in tapered strokes (docs/ART.md, World art). A part's still pieces are drawn once into a
 * small bitmap (`sprite`) and stamped every frame, so the pen costs nothing at race time; only what moves
 * or glows is drawn live.
 */

export const INK = '#1a0f0a';

/** Bake resolution, px per world px: a close race camera or a crate card on a big screen stays crisp. */
const K = 6;
const MAX = 220;

export interface Sprite {
  c: HTMLCanvasElement;
  /** Where the bitmap's corner sits in the art's own px. */
  x: number;
  y: number;
  w: number;
  h: number;
}

const sprites = new Map<string, Sprite>();

/** A baked piece of art covering (x, y, w, h) in its own px. `key` must name everything `draw` reads. */
export function sprite(key: string, x: number, y: number, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Sprite {
  const hit = sprites.get(key);
  if (hit) return hit;
  // Oldest first: a long match with many hues sheds what it drew first, not everything at once.
  if (sprites.size >= MAX) sprites.delete(sprites.keys().next().value!);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * K));
  c.height = Math.max(1, Math.ceil(h * K));
  const g = c.getContext('2d')!;
  g.setTransform(K, 0, 0, K, -x * K, -y * K);
  g.lineJoin = 'round';
  draw(g);
  const sp = { c, x, y, w, h };
  sprites.set(key, sp);
  return sp;
}

/** Stamp a sprite with its origin at (dx, dy) in the current transform. */
export function stamp(s: CanvasRenderingContext2D, sp: Sprite, dx = 0, dy = 0) {
  s.drawImage(sp.c, sp.x + dx, sp.y + dy, sp.w, sp.h);
}

export function path(g: CanvasRenderingContext2D, pts: readonly P[]) {
  g.beginPath();
  for (let i = 0; i < pts.length; i++) {
    if (i) g.lineTo(pts[i].x, pts[i].y);
    else g.moveTo(pts[i].x, pts[i].y);
  }
  g.closePath();
}

/** A box cut by hand: each corner its own radius, each side bowed a touch. */
export function boxPts(x: number, y: number, w: number, h: number, r: number, seed: number, bow = 0.25): P[] {
  const pts: P[] = [];
  const cs = [
    [x + w, y, -Math.PI / 2],
    [x + w, y + h, 0],
    [x, y + h, Math.PI / 2],
    [x, y, Math.PI],
  ] as const;
  for (let k = 0; k < 4; k++) {
    const [cx, cy, a0] = cs[k];
    const rr = Math.min(w / 2, h / 2, r * (0.65 + 0.35 * hash2(k, 1, seed)));
    const ox = cx - Math.sign(cx - x - w / 2) * rr;
    const oy = cy - Math.sign(cy - y - h / 2) * rr;
    for (let i = 0; i <= 3; i++) {
      const a = a0 + (i / 3) * (Math.PI / 2);
      pts.push({ x: ox + Math.cos(a) * rr, y: oy + Math.sin(a) * rr });
    }
    // Midpoint of the side that follows, bowed out or in.
    const [nx, ny] = cs[(k + 1) % 4];
    const mx = (cx + nx) / 2;
    const my = (cy + ny) / 2;
    const b = sn(k * 1.7, 2.3, seed) * bow;
    const out = k === 0 ? [1, 0] : k === 1 ? [0, 1] : k === 2 ? [-1, 0] : [0, -1];
    pts.push({ x: mx + out[0] * b, y: my + out[1] * b });
  }
  // Start on the top side so the pen's lead lands on a straight run, not a corner.
  return pts;
}

/** An oval with a little lump to it: never a compass circle. */
export function ovalPts(cx: number, cy: number, rx: number, ry: number, seed: number, lump = 0.04, n = 0): P[] {
  const m = n || Math.max(12, Math.round((rx + ry) * 2.2));
  const pts: P[] = [];
  for (let i = 0; i < m; i++) {
    const a = (i / m) * Math.PI * 2;
    const k = 1 + lump * sn(Math.cos(a) * 1.4 + seed * 0.31, Math.sin(a) * 1.4, seed);
    pts.push({ x: cx + Math.cos(a) * rx * k, y: cy + Math.sin(a) * ry * k });
  }
  return pts;
}

/** Points along a polyline given as flat [x, y, x, y, ...]. */
export function poly(...xy: number[]): P[] {
  const pts: P[] = [];
  for (let i = 0; i + 1 < xy.length; i += 2) pts.push({ x: xy[i], y: xy[i + 1] });
  return pts;
}

function centroid(pts: readonly P[]): P {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

export interface ToneOpts {
  /** How far the lit shape is pulled up-left, leaving a shadow on the far side. */
  depth?: number;
  /** Lightness shift of the shadow tone. */
  shade?: number;
  /** A thin highlight stroke along the lit edge, as a lightness shift; 0 for none. */
  lit?: number;
}

/** Two flat tones and a hard shadow: the shape in its shadow tone, the lit body pulled up-left over it. */
export function tone(g: CanvasRenderingContext2D, pts: readonly P[], base: HSL, o: ToneOpts = {}) {
  const d = o.depth ?? 1.4;
  g.fillStyle = css(base, o.shade ?? -16, 1, 6);
  path(g, pts);
  g.fill();
  g.save();
  g.clip();
  g.translate(-d, -d * 1.1);
  g.fillStyle = css(base);
  path(g, pts);
  g.fill();
  g.restore();
}

/** Pen round a closed shape: thin toward the light, heavier away from it. */
export function pen(g: CanvasRenderingContext2D, pts: readonly P[], seed: number, thin = 0.6, thick = 1.5, pieces = 3, ink = INK) {
  const c = centroid(pts);
  g.fillStyle = ink;
  inkLoop(g, pts, c.x, c.y, seed, thin, thick, pieces);
}

/** A whole inked shape: toned and penned. */
export function part(
  g: CanvasRenderingContext2D,
  pts: readonly P[],
  base: HSL,
  seed: number,
  o: ToneOpts & { thin?: number; thick?: number; ink?: string } = {},
) {
  tone(g, pts, base, o);
  pen(g, pts, seed, o.thin ?? 0.6, o.thick ?? 1.4, 3, o.ink ?? INK);
}

/** One highlight: a short tapered stroke in a lighter tone. */
export function glint(g: CanvasRenderingContext2D, pts: readonly P[], col: string, w = 0.7, seed = 3) {
  g.fillStyle = col;
  stroke(g, pts, { w, seed, taper: [0.25, 0.4], press: 0.1 });
}

/** A short pen line. */
export function tick(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w = 0.7, seed = 1, col = INK) {
  g.fillStyle = col;
  line(g, ax, ay, bx, by, { w, seed, taper: [0.15, 0.3], press: 0.2 });
}

/** A rivet: an ink dot with a light fleck. */
export function dot(g: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, fleck?: string) {
  g.fillStyle = INK;
  blob(g, x, y, r, seed, 1, 0.12);
  g.fill();
  if (fleck) {
    g.fillStyle = fleck;
    g.fillRect(x - r * 0.55, y - r * 0.65, r * 0.6, r * 0.55);
  }
}

/** A ball: two tones cut toward the light, a pen round it and one hard glint. */
export function ball(g: CanvasRenderingContext2D, x: number, y: number, r: number, base: HSL, seed = 2, glintCol = 'rgba(255,255,255,0.85)') {
  g.fillStyle = INK;
  blob(g, x + 0.25, y + 0.3, r + Math.min(1.1, r * 0.22), seed, 1, 0.04);
  g.fill();
  g.fillStyle = css(base, -12, 1, 4);
  blob(g, x, y, r, seed + 1, 1, 0.03);
  g.fill();
  g.save();
  blob(g, x, y, r, seed + 1, 1, 0.03);
  g.clip();
  g.fillStyle = css(base);
  blob(g, x - r * 0.22, y - r * 0.25, r * 0.88, seed + 2, 1, 0.03);
  g.fill();
  g.restore();
  if (r > 1.6) glint(g, poly(x - r * 0.6, y - r * 0.05, x - r * 0.48, y - r * 0.45, x - r * 0.15, y - r * 0.62), glintCol, Math.max(0.5, r * 0.22), seed);
}
