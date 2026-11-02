/**
 * Dev-only asset prep: turns CC0 PBR materials from ambientCG into tiny
 * tileable grayscale "detail" maps for the terrain painter.
 *
 *   npx tsx tools/textures.ts --cache /path/to/scratch [--only brick,rock]
 *   (downloads into the cache dir, rebuilds public/textures/*.webp)
 *
 * For each material we download the 1K JPG zip (cached), then in headless
 * Chromium:
 *   - box-downsample color / normal / AO maps to 256² with wrap-around (stays seamless),
 *   - albedo detail = high-passed, percentile-normalized luminance × AO,
 *   - relief = normal map lit from the top-left (what the eye reads as depth),
 * and pack them side by side into one 512×256 grayscale WebP:
 *   left half = albedo detail, right half = relief (0.5 = flat).
 *
 * The game never needs this script at runtime; textures are optional and the
 * terrain falls back to its procedural material if they're missing.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

/** Our material name → ambientCG asset id. Keep in sync with public/ASSETS.md and DETAIL in src/render/terrain.ts. */
export const MATERIALS: Record<string, string> = {
  rock: 'Rock030',
  cave: 'Rock035',
  strata: 'Rock061',
  basalt: 'Rock058',
  mossrock: 'Rock064',
  dirt: 'Ground103',
  forest: 'Ground037',
  sand: 'Ground109',
  brick: 'Bricks085',
  stone: 'Bricks111A',
  cobble: 'PavingStones119',
  planks: 'Planks023A',
  metal: 'MetalPlates001',
  rustplate: 'MetalPlates011',
  concrete: 'Concrete031',
};

const argv = process.argv.slice(2);
const opt = (k: string, d: string) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const cache = resolve(opt('cache', join(tmpdir(), 'slag-textures')));
const out = resolve(opt('out', 'public/textures'));
const only = opt('only', '')
  .split(',')
  .filter((s) => s);
mkdirSync(cache, { recursive: true });
mkdirSync(out, { recursive: true });

function fetchMaps(id: string): Record<string, string> {
  const dir = join(cache, id);
  if (!existsSync(dir)) {
    const zip = join(cache, `${id}.zip`);
    if (!existsSync(zip)) {
      console.log(`download ${id}`);
      execFileSync('curl', ['-sSfL', '-o', zip, `https://ambientcg.com/get?file=${id}_1K-JPG.zip`], { stdio: 'inherit' });
    }
    mkdirSync(dir, { recursive: true });
    execFileSync('unzip', ['-o', '-q', zip, '*.jpg', '-d', dir], { stdio: 'inherit' });
  }
  const files = readdirSync(dir);
  const pick = (suffix: string) => {
    const f = files.find((n) => n.endsWith(`_${suffix}.jpg`));
    return f ? `data:image/jpeg;base64,${readFileSync(join(dir, f)).toString('base64')}` : '';
  };
  return { color: pick('Color'), normal: pick('NormalGL'), ao: pick('AmbientOcclusion') };
}

/** Runs in the page. Returns a WebP data URL (2W×H: albedo | relief). */
async function processInPage(maps: Record<string, string>): Promise<string> {
  const W = 256;
  let H = 256;
  const load = async (src: string): Promise<Float32Array | null> => {
    if (!src) return null;
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, c.width, c.height).data;
    // Box-downsample to W×H (keeping the source aspect), 3 channels.
    const k = c.width / W;
    H = Math.round(c.height / k);
    const d = new Float32Array(W * H * 3);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let r = 0;
        let gg = 0;
        let b = 0;
        let n = 0;
        for (let sy = Math.floor(y * k); sy < Math.min(c.height, Math.floor((y + 1) * k)); sy++)
          for (let sx = Math.floor(x * k); sx < Math.min(c.width, Math.floor((x + 1) * k)); sx++) {
            const i = (sy * c.width + sx) * 4;
            r += px[i];
            gg += px[i + 1];
            b += px[i + 2];
            n++;
          }
        const o = (y * W + x) * 3;
        d[o] = r / n / 255;
        d[o + 1] = gg / n / 255;
        d[o + 2] = b / n / 255;
      }
    return d;
  };
  const wrapBlur = (src: Float32Array, r: number) => {
    const a = src.slice();
    const tmp = new Float32Array(a.length);
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          let s = 0;
          for (let k = -r; k <= r; k++) s += a[y * W + ((x + k + W) % W)];
          tmp[y * W + x] = s / (2 * r + 1);
        }
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          let s = 0;
          for (let k = -r; k <= r; k++) s += tmp[((y + k + H) % H) * W + x];
          a[y * W + x] = s / (2 * r + 1);
        }
    }
    return a;
  };
  /** Center on the mean and map ±2σ to 0..1 (keeps relative contrast; avoids clipping flat materials). */
  const normalize = (a: Float32Array) => {
    let m = 0;
    for (const v of a) m += v;
    m /= a.length;
    let vr = 0;
    for (const v of a) vr += (v - m) * (v - m);
    const sd = Math.sqrt(vr / a.length) || 1;
    const out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = Math.max(0, Math.min(1, 0.5 + (a[i] - m) / (4 * sd)));
    return out;
  };
  const color = (await load(maps.color))!;
  const normal = await load(maps.normal);
  const ao = await load(maps.ao);
  const N = W * H;
  const lum = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const v = color[i * 3] * 0.299 + color[i * 3 + 1] * 0.587 + color[i * 3 + 2] * 0.114;
    lum[i] = v * (ao ? 0.55 + 0.45 * ao[i * 3] : 1);
  }
  // High-pass away the photo's large-scale lighting so the tile repeats evenly.
  const low = wrapBlur(lum, 12);
  let mean = 0;
  for (let i = 0; i < N; i++) mean += lum[i];
  mean /= N;
  const hp = new Float32Array(N);
  for (let i = 0; i < N; i++) hp[i] = lum[i] - low[i] * 0.85 + mean * 0.85;
  const albedo = normalize(hp);
  // Relief: light from the top-left on a y-up (GL) normal map; 0.5 = flat.
  const relief = new Float32Array(N).fill(0.5);
  if (normal) {
    const L = [-0.5, 0.62, 0.6];
    const ll = Math.hypot(L[0], L[1], L[2]);
    for (let i = 0; i < N; i++) {
      const nx = normal[i * 3] * 2 - 1;
      const ny = normal[i * 3 + 1] * 2 - 1;
      const nz = normal[i * 3 + 2] * 2 - 1;
      const nl = Math.hypot(nx, ny, nz) || 1;
      const ndl = (nx * L[0] + ny * L[1] + nz * L[2]) / nl / ll;
      relief[i] = 0.5 + (ndl - L[2] / ll) * 0.9;
    }
  }
  const c = document.createElement('canvas');
  c.width = W * 2;
  c.height = H;
  const g = c.getContext('2d')!;
  const img = g.createImageData(W * 2, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const a = Math.round(albedo[y * W + x] * 255);
      const r = Math.round(Math.max(0, Math.min(1, relief[y * W + x])) * 255);
      const i0 = (y * W * 2 + x) * 4;
      const i1 = (y * W * 2 + x + W) * 4;
      img.data[i0] = img.data[i0 + 1] = img.data[i0 + 2] = a;
      img.data[i1] = img.data[i1 + 1] = img.data[i1 + 2] = r;
      img.data[i0 + 3] = img.data[i1 + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return c.toDataURL('image/webp', 0.82);
}

const executablePath = process.env.PW_CHROMIUM ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  // tsx may wrap nested functions in a __name() helper; give the page a no-op one.
  await page.evaluate('window.__name = (f) => f');
  let total = 0;
  for (const [name, id] of Object.entries(MATERIALS)) {
    if (only.length && !only.includes(name)) continue;
    const maps = fetchMaps(id);
    if (!maps.color) throw new Error(`${id}: no color map`);
    const url = await page.evaluate(processInPage, maps);
    const file = join(out, `${name}.webp`);
    writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
    const size = statSync(file).size;
    total += size;
    console.log(`${name.padEnd(10)} ${id.padEnd(16)} ${(size / 1024).toFixed(1)} KB`);
  }
  console.log(`total ${(total / 1024).toFixed(1)} KB`);
} finally {
  await browser.close();
}
