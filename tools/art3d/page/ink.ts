import { BOX, INK, type Role, type Settings } from '../settings';
import { hex } from './roles';

/**
 * The compositor: turns one supersampled render of role numbers, light and depth into a finished sprite
 * frame, the way docs/ART.md inks the world.
 *
 * - **Tone.** Each role is one flat colour cut into two or three hard bands by N·L; a band is the role's
 *   colour times a scalar (`tones`), so the game can recolour a role exactly (see the mask below).
 * - **Pen.** A contour round the silhouette, thin toward the light and heaviest away from it, and finer
 *   interior lines where one part passes in front of another or one material meets another. A line is a
 *   dark of what it outlines: the role's colour pulled `ink.mix` of the way to near-black `INK`.
 * - **Masks.** For every recolourable slot, how much of each pixel's colour is that slot's colour (`T`):
 *   the sprite's colour is linear in the slot colour B, so the game recolours with `c' = c + (B' - B) T`.
 *
 * Distances come from a vector distance transform (8SSEDT), so a pen of any width costs the same.
 */

export interface Layer {
  w: number;
  h: number;
  /** Straight (not premultiplied) RGBA. */
  rgba: Uint8ClampedArray;
  /** Per recolourable slot, T × 200 per pixel. */
  masks: Record<'paint' | 'player', Uint8ClampedArray>;
}

/** Nearest seed for every pixel: two raster passes of vector propagation (Danielsson / 8SSEDT). */
function nearest(seed: Uint8Array, w: number, h: number): Int32Array {
  const BIG = 1 << 14;
  const near = new Int32Array(w * h * 2);
  for (let i = 0; i < w * h; i++) {
    if (seed[i]) {
      near[i * 2] = i % w;
      near[i * 2 + 1] = (i / w) | 0;
    } else {
      near[i * 2] = -BIG;
      near[i * 2 + 1] = -BIG;
    }
  }
  const d2 = (i: number, x: number, y: number) => (near[i * 2] - x) ** 2 + (near[i * 2 + 1] - y) ** 2;
  const look = (i: number, j: number, x: number, y: number) => {
    if (near[j * 2] === -BIG) return;
    if (near[i * 2] === -BIG || d2(j, x, y) < d2(i, x, y)) {
      near[i * 2] = near[j * 2];
      near[i * 2 + 1] = near[j * 2 + 1];
    }
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x > 0) look(i, i - 1, x, y);
      if (y > 0) {
        look(i, i - w, x, y);
        if (x > 0) look(i, i - w - 1, x, y);
        if (x < w - 1) look(i, i - w + 1, x, y);
      }
    }
    for (let x = w - 1; x >= 0; x--) if (x < w - 1) look(y * w + x, y * w + x + 1, x, y);
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (x < w - 1) look(i, i + 1, x, y);
      if (y < h - 1) {
        look(i, i + w, x, y);
        if (x < w - 1) look(i, i + w + 1, x, y);
        if (x > 0) look(i, i + w - 1, x, y);
      }
    }
    for (let x = 0; x < w; x++) if (x > 0) look(y * w + x, y * w + x - 1, x, y);
  }
  return near;
}

export interface Palette {
  names: string[];
  roles: Role[];
  base: [number, number, number][];
  ink: [number, number, number][];
}

export function palette(s: Settings): Palette {
  const names = Object.keys(s.roles);
  const roles = names.map((n) => s.roles[n]);
  const K = hex(INK);
  const a = 1 - s.ink.mix;
  const base = roles.map((r) => hex(r.color));
  return { names, roles, base, ink: base.map((b) => [b[0] * a + K[0] * (1 - a), b[1] * a + K[1] * (1 - a), b[2] * a + K[2] * (1 - a)]) };
}

/**
 * One frame. `px` is the render read back (bottom row first, as WebGL reads): R the role + 1 (0 is
 * empty), G the light (N·L mapped to 0..255), B and A the depth in 16 bits (farther is larger).
 * `scale` is sprite px per world px; the render is `ss` times that.
 */
export function compose(px: Uint8Array, W: number, H: number, s: Settings, pal: Palette, scale: number): Layer {
  const ss = s.ss;
  const n = W * H;
  const role = new Int16Array(n);
  const ndl = new Float32Array(n);
  const depth = new Float32Array(n);
  for (let y = 0; y < H; y++) {
    const src = (H - 1 - y) * W;
    for (let x = 0; x < W; x++) {
      const j = (src + x) * 4;
      const i = y * W + x;
      role[i] = px[j] - 1;
      ndl[i] = (px[j + 1] / 255) * 2 - 1;
      // Depth in world px across the camera's 200-unit range.
      depth[i] = ((px[j + 2] * 256 + px[j + 3]) / 65535) * 200;
    }
  }
  const unit = scale * ss;
  // Which way is away from the light, on screen (y down).
  const L = s.light;
  const ll = Math.hypot(L[0], L[1]) || 1;
  const awayX = -L[0] / ll;
  const awayY = L[1] / ll;
  const width = (ox: number, oy: number, lit: number, shadow: number) => {
    const d = Math.hypot(ox, oy) || 1;
    const k = Math.max(0, ((ox / d) * awayX + (oy / d) * awayY + 1) / 2);
    return (lit + (shadow - lit) * k * k) * unit;
  };

  // The silhouette: distance to the nearest empty pixel.
  const empty = new Uint8Array(n);
  for (let i = 0; i < n; i++) empty[i] = role[i] < 0 ? 1 : 0;
  const outside = nearest(empty, W, H);

  // Interior edges: pixels behind a neighbour, or under a role drawn on top of theirs, seed the lines
  // their neighbour gets.
  const step = s.step;
  const over = (r: number) => pal.roles[r].over ?? 0;
  const front = (p: number, q: number) => {
    if (role[q] < 0) return false;
    const dz = depth[q] - depth[p];
    if (dz > step) return true;
    if (dz < -step) return false;
    const rp = role[p];
    const rq = role[q];
    return rp !== rq && !pal.roles[rp].quiet && over(rp) > over(rq);
  };
  const behind = new Uint8Array(n);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const q = y * W + x;
      if (role[q] < 0) continue;
      if (front(q - 1, q) || front(q + 1, q) || front(q - W, q) || front(q + W, q)) behind[q] = 1;
    }
  }
  const inner = nearest(behind, W, H);

  const tones = s.tones;
  const out = new Float32Array(n * 3);
  const tPaint = new Float32Array(n);
  const tPlayer = new Float32Array(n);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const r = role[i];
      if (r < 0) continue;
      const R = pal.roles[r];
      let inked = false;
      const ox = outside[i * 2] - x;
      const oy = outside[i * 2 + 1] - y;
      if (Math.hypot(ox, oy) - 0.5 <= width(ox, oy, s.ink.lit, s.ink.shadow)) inked = true;
      if (!inked && inner[i * 2] > -1000) {
        const sx = inner[i * 2];
        const sy = inner[i * 2 + 1];
        const ix = sx - x;
        const iy = sy - y;
        if (Math.hypot(ix, iy) - 0.5 <= width(ix, iy, s.ink.interior, s.ink.interior * 1.6) && front(i, sy * W + sx)) inked = true;
      }
      let c: [number, number, number];
      let t: number;
      if (inked) {
        c = pal.ink[r];
        t = 1 - s.ink.mix;
      } else {
        const band = R.flat ? 1 : ndl[i] > s.bands[0] ? 0 : ndl[i] > s.bands[1] ? 1 : 2;
        t = tones[band];
        const b = pal.base[r];
        c = [b[0] * t, b[1] * t, b[2] * t];
      }
      out[i * 3] = c[0];
      out[i * 3 + 1] = c[1];
      out[i * 3 + 2] = c[2];
      if (R.slot === 'paint') tPaint[i] = t;
      else if (R.slot === 'player') tPlayer[i] = t;
    }
  }

  // Box-filter down to sprite pixels: colour averaged over the covered samples, coverage as alpha.
  const w = W / ss;
  const h = H / ss;
  const rgba = new Uint8ClampedArray(w * h * 4);
  const mp = new Uint8ClampedArray(w * h);
  const ml = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let cnt = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let p = 0;
      for (let dy = 0; dy < ss; dy++) {
        for (let dx = 0; dx < ss; dx++) {
          const i = (y * ss + dy) * W + x * ss + dx;
          if (role[i] < 0) continue;
          cnt++;
          r += out[i * 3];
          g += out[i * 3 + 1];
          b += out[i * 3 + 2];
          a += tPaint[i];
          p += tPlayer[i];
        }
      }
      if (!cnt) continue;
      const o = (y * w + x) * 4;
      rgba[o] = r / cnt;
      rgba[o + 1] = g / cnt;
      rgba[o + 2] = b / cnt;
      rgba[o + 3] = (cnt / (ss * ss)) * 255;
      mp[y * w + x] = (a / cnt) * 200;
      ml[y * w + x] = (p / cnt) * 200;
    }
  }
  return { w, h, rgba, masks: { paint: mp, player: ml } };
}

/** The frame box in sprite px for a scale, and where the feet are in it. */
export function frameBox(scale: number) {
  return { w: (BOX.x1 - BOX.x0) * scale, h: (BOX.y1 - BOX.y0) * scale, ax: -BOX.x0 * scale, ay: BOX.y1 * scale };
}
