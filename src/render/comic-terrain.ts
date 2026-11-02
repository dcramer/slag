import { type HSL, toRgb } from '../core/color';
import { mixRgb } from './kit';

/** Ink for baked terrain outlines; matches PAL.ink. */
export const TERRAIN_INK = '#120b08';

const INK_RGB = [0.0706, 0.0431, 0.0314];

/** Value at fraction `q` of a sorted copy of `a`. */
function percentile(a: Float32Array, q: number): number {
  const s = a.slice().sort();
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
}

/** Wrapping box blur, so the flattened material still tiles. */
function blur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const out = new Float32Array(src.length);
  const n = r * 2 + 1;
  const wrap = (i: number, m: number) => ((i % m) + m) % m;
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += src[y * w + wrap(x, w)];
    for (let x = 0; x < w; x++) {
      out[y * w + x] = sum / n;
      sum += src[y * w + wrap(x + r + 1, w)] - src[y * w + wrap(x - r, w)];
    }
  }
  const res = new Float32Array(src.length);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += out[wrap(y, h) * w + x];
    for (let y = 0; y < h; y++) {
      res[y * w + x] = sum / n;
      sum += out[wrap(y + r + 1, h) * w + x] - out[wrap(y - r, h) * w + x];
    }
  }
  return res;
}

/**
 * Flatten a terrain material into four theme tones. Ink lines over photo-detail textures read as
 * noise, so the comic look can't come from a screen filter; it starts here. Thresholding a blurred
 * copy keeps each material's own shapes as flat cel regions, in all 16 terrain kinds, with no
 * per-kind art; `joints` also keeps fine dark lines, for bricks, planks and panels. Runs once per bake, so it costs no frame time.
 */
export function flattenMaterial(tex: HTMLCanvasElement, worldW: number, T: { base: HSL; dark: HSL; light: HSL }, joints: boolean): HTMLCanvasElement {
  const w = tex.width;
  const h = tex.height;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const g = out.getContext('2d')!;
  g.drawImage(tex, 0, 0);
  const img = g.getImageData(0, 0, w, h);
  const px = img.data;
  const luma = new Float32Array(w * h);
  for (let i = 0; i < luma.length; i++) luma[i] = px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114;
  // A couple of world pixels of blur: drops grain, keeps the shapes.
  const soft = blur(luma, w, h, Math.max(1, Math.round((w / worldW) * 2)));
  const pit = percentile(soft, 0.025);
  // Built materials keep their joints as thin dark lines: a castle has to stay masonry, not become rock.
  const fine = blur(luma, w, h, 1);
  const gap = joints
    ? percentile(
        Float32Array.from(soft, (v, i) => fine[i] - v),
        0.12,
      )
    : -Infinity;
  const low = percentile(soft, 0.2);
  const high = percentile(soft, 0.88);
  const base = toRgb(T.base);
  const dark = toRgb(T.dark);
  const lite = toRgb(T.light);
  // Natural rock only drops to a soft shade: full dark there prints as loud blotches over the whole mass.
  const deep = joints ? mixRgb(dark, INK_RGB, 0.25) : mixRgb(base, dark, 0.55);
  const tones = [deep, mixRgb(base, dark, 0.3), base, mixRgb(base, lite, 0.28)].map((c) => c.map((v) => Math.round(v * 255)));
  for (let i = 0; i < soft.length; i++) {
    const v = soft[i];
    const c = tones[v < pit || fine[i] - v < gap ? 0 : v < low ? 1 : v < high ? 2 : 3];
    px[i * 4] = c[0];
    px[i * 4 + 1] = c[1];
    px[i * 4 + 2] = c[2];
    px[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return out;
}
