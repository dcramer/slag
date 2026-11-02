import * as THREE from 'three';
import type { Role } from '../settings';
import { texturePixels } from './load';

/**
 * Roles from the model's texture. Tripo paints a model with baked light, soft edges and noise; none of
 * that may reach a sprite. Each texel is sorted into the role of its nearest swatch, in Lab, and the
 * result is cleaned with a majority filter, so the renderer paints flat palette colours with crisp
 * borders between materials, and knows which material every pixel is (the masks the game recolours by).
 */

export const hex = (s: string): [number, number, number] => {
  const n = parseInt(s.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

function lab(r: number, g: number, b: number): [number, number, number] {
  const lin = (v: number) => {
    v /= 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** A fixed little generator, so the same model always samples the same texels. */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

/**
 * The colours the texture is painted in, for writing a kind's swatches: texels sampled over the model's
 * own triangles (the gutters between UV islands never count), clustered with k-means in Lab.
 */
export function swatches(tex: THREE.Texture, k: number, uv?: THREE.BufferAttribute, index?: THREE.BufferAttribute | null): { color: string; share: number }[] {
  const px = texturePixels(tex);
  const rnd = lcg(7);
  const pts: [number, number, number][] = [];
  const rgb: [number, number, number][] = [];
  const take = (u: number, v: number) => {
    const x = Math.min(px.width - 1, Math.max(0, Math.floor(u * px.width)));
    const y = Math.min(px.height - 1, Math.max(0, Math.floor(v * px.height)));
    const i = (y * px.width + x) * 4;
    rgb.push([px.data[i], px.data[i + 1], px.data[i + 2]]);
    pts.push(lab(px.data[i], px.data[i + 1], px.data[i + 2]));
  };
  if (uv) {
    const tri = index ? index.count / 3 : uv.count / 3;
    const at = (t: number, c: number) => (index ? index.getX(t * 3 + c) : t * 3 + c);
    for (let n = 0; n < 60000; n++) {
      const t = Math.floor(rnd() * tri);
      let a = rnd();
      let b = rnd();
      if (a + b > 1) {
        a = 1 - a;
        b = 1 - b;
      }
      const [i0, i1, i2] = [at(t, 0), at(t, 1), at(t, 2)];
      take(
        uv.getX(i0) + a * (uv.getX(i1) - uv.getX(i0)) + b * (uv.getX(i2) - uv.getX(i0)),
        uv.getY(i0) + a * (uv.getY(i1) - uv.getY(i0)) + b * (uv.getY(i2) - uv.getY(i0)),
      );
    }
  } else for (let n = 0; n < 60000; n++) take(rnd(), rnd());
  // k-means++ seeding, then Lloyd's iterations.
  const cs: [number, number, number][] = [pts[0]];
  const d2 = (a: number[], b: number[]) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  while (cs.length < k) {
    const ds = pts.map((p) => Math.min(...cs.map((c) => d2(p, c))));
    const sum = ds.reduce((a, b) => a + b, 0);
    let r = rnd() * sum;
    let i = 0;
    while ((r -= ds[i]) > 0 && i < ds.length - 1) i++;
    cs.push(pts[i]);
  }
  const of = new Int32Array(pts.length);
  for (let it = 0; it < 30; it++) {
    const acc = cs.map(() => [0, 0, 0, 0]);
    pts.forEach((p, i) => {
      let best = 0;
      for (let c = 1; c < cs.length; c++) if (d2(p, cs[c]) < d2(p, cs[best])) best = c;
      of[i] = best;
      acc[best][0] += p[0];
      acc[best][1] += p[1];
      acc[best][2] += p[2];
      acc[best][3]++;
    });
    acc.forEach((a, c) => a[3] && (cs[c] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]));
  }
  // Report each cluster by its median texel colour, as it is in the texture.
  return cs
    .map((_, c) => {
      const mine = rgb.filter((_, i) => of[i] === c);
      const med = (j: number) => mine.map((m) => m[j]).sort((a, b) => a - b)[mine.length >> 1] ?? 0;
      return { color: toHex(med(0), med(1), med(2)), share: mine.length / rgb.length };
    })
    .filter((s) => s.share > 0)
    .sort((a, b) => b.share - a.share);
}

/**
 * The role of every texel, as a texture of role numbers (the index into `names`), read with nearest
 * filtering so a border between two roles never blends into a third.
 */
export function classify(tex: THREE.Texture, roles: Record<string, Role>, names: string[]): THREE.DataTexture {
  const px = texturePixels(tex);
  const sw: { role: number; lab: [number, number, number] }[] = [];
  names.forEach((n, i) => roles[n].swatches.forEach((s) => sw.push({ role: i, lab: lab(...hex(s)) })));
  const W = px.width;
  const H = px.height;
  let ids = new Uint8Array(W * H);
  const cache = new Map<number, number>();
  for (let i = 0; i < W * H; i++) {
    const r = px.data[i * 4];
    const g = px.data[i * 4 + 1];
    const b = px.data[i * 4 + 2];
    const key = (r << 16) | (g << 8) | b;
    let id = cache.get(key);
    if (id === undefined) {
      const l = lab(r, g, b);
      let best = 0;
      let bd = Infinity;
      for (const s of sw) {
        const d = (l[0] - s.lab[0]) ** 2 + (l[1] - s.lab[1]) ** 2 + (l[2] - s.lab[2]) ** 2;
        if (d < bd) {
          bd = d;
          best = s.role;
        }
      }
      id = best;
      cache.set(key, id);
    }
    ids[i] = id;
  }
  // Two passes of a 5×5 majority filter: speckle from texture noise goes, borders stay put.
  const n = names.length;
  for (let pass = 0; pass < 2; pass++) {
    const out = new Uint8Array(W * H);
    const count = new Int32Array(n);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        count.fill(0);
        for (let dy = -2; dy <= 2; dy++) {
          const yy = Math.min(H - 1, Math.max(0, y + dy));
          for (let dx = -2; dx <= 2; dx++) {
            const xx = Math.min(W - 1, Math.max(0, x + dx));
            count[ids[yy * W + xx]]++;
          }
        }
        let best = ids[y * W + x];
        for (let c = 0; c < n; c++) if (count[c] > count[best]) best = c;
        out[y * W + x] = best;
      }
    }
    ids = out;
  }
  const t = new THREE.DataTexture(ids, W, H, THREE.RedIntegerFormat, THREE.UnsignedByteType);
  t.internalFormat = 'R8UI';
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  t.needsUpdate = true;
  return t;
}
