import { type HSL, toRgb } from '../core/color';
import { mixRgb } from './kit';

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
 * Turn a terrain material into one flat base color. Cel shading can't start from photo-detail
 * textures: quantizing them gives blotches, so form has to come from light and depth instead. The
 * only detail kept is the material's thin dark lines, found by comparing it against a blurred copy,
 * so all 16 terrain kinds keep their identity with no per-kind art: `built` materials (bricks,
 * planks, panels) keep strong joints, natural ones a few faint cracks. Runs once per bake, so it
 * costs no frame time.
 */
export function flattenMaterial(tex: HTMLCanvasElement, worldW: number, T: { base: HSL; dark: HSL }, built: boolean): HTMLCanvasElement {
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
  const soft = blur(luma, w, h, Math.max(2, Math.round((w / worldW) * 4)));
  const line = Float32Array.from(blur(luma, w, h, 1), (v, i) => v - soft[i]);
  const edge = percentile(line, built ? 0.1 : 0.025);
  const base = toRgb(T.base);
  const crack = mixRgb(base, toRgb(T.dark), built ? 0.6 : 0.3);
  for (let i = 0; i < line.length; i++) {
    // A short ramp instead of a hard threshold: the bake scales this, and a hard edge would shimmer.
    const c = mixRgb(base, crack, Math.min(1, Math.max(0, (edge - line[i]) / 6 + 0.5)));
    px[i * 4] = c[0] * 255;
    px[i * 4 + 1] = c[1] * 255;
    px[i * 4 + 2] = c[2] * 255;
    px[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return out;
}
