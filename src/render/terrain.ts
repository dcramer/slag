import { css, type HSL, toRgb } from '../core/color';
import { hash2, Rng } from '../core/rng';
import type { TerrainKind, TerrainLook, Theme } from '../gen/theme';
import { TILE } from '../sim/constants';
import { type Level, T_ONEWAY, tileAt, type TileRect } from '../sim/level';
import type { ThemeId } from '../themes';
import { DECOR, type Decor } from './decor';
import { flattenMaterial } from './cel-terrain';
import { inkFence, inkHay } from './ink-parts';
import { drawTufts, inkContours, inkEdges, inkGrass, inkHatch, inkMaterial, inkPlatforms, makeTufts, type Tuft } from './ink-terrain';
import { circle, makeNoise, mixRgb, type RC } from './kit';

export { flame } from './kit';

/**
 * Terrain: a tileable material per theme, flattened for the cel pass, baked
 * through a rounded-corner mask with depth shading, rim light, caps, ceiling
 * details, jump-through platforms and static decor. The pass inks silhouettes
 * and casts the shadow, so the bake has neither. Animated bits (grass, live decor, glowing
 * veins) are drawn per frame on top.
 *
 * Materials are procedural, theme-colored gradients modulated by small CC0
 * grayscale detail textures (public/textures, see public/ASSETS.md): the
 * left half of each file is albedo detail, the right half is relief shading.
 * Textures load asynchronously; until they arrive (or if they fail) the
 * purely procedural material is used and the bake is redone once they land.
 */

// ---------------------------------------------------------------------------
// Detail textures

interface Detail {
  w: number;
  h: number;
  alb: Float32Array;
  rel: Float32Array;
}

type ProcKind = 'rock' | 'brick' | 'metal' | 'crystal' | 'organic' | 'sand' | 'planks';

interface MaterialSpec {
  /** File in public/textures (without extension). */
  tex: string;
  /** World px covered by one repeat of the texture's width. */
  size: number;
  /** Albedo detail contrast. */
  contrast: number;
  /** Relief (normal-map shading) strength. */
  relief: number;
  /** Procedural fallback / base pattern. */
  proc: ProcKind;
}

const MATERIALS: Record<TerrainKind, MaterialSpec> = {
  rock: { tex: 'rock', size: 224, contrast: 0.75, relief: 0.9, proc: 'rock' },
  cave: { tex: 'cave', size: 224, contrast: 0.75, relief: 0.9, proc: 'rock' },
  strata: { tex: 'strata', size: 224, contrast: 0.75, relief: 0.9, proc: 'rock' },
  basalt: { tex: 'basalt', size: 176, contrast: 0.6, relief: 1.0, proc: 'rock' },
  crystal: { tex: 'cave', size: 224, contrast: 0.7, relief: 0.8, proc: 'crystal' },
  organic: { tex: 'mossrock', size: 160, contrast: 0.7, relief: 1.0, proc: 'organic' },
  loam: { tex: 'forest', size: 160, contrast: 0.7, relief: 0.8, proc: 'organic' },
  dirt: { tex: 'dirt', size: 160, contrast: 0.75, relief: 0.9, proc: 'organic' },
  sand: { tex: 'sand', size: 160, contrast: 0.6, relief: 0.8, proc: 'sand' },
  brick: { tex: 'brick', size: 224, contrast: 0.85, relief: 1.2, proc: 'brick' },
  stone: { tex: 'stone', size: 192, contrast: 0.6, relief: 1.2, proc: 'brick' },
  cobble: { tex: 'cobble', size: 160, contrast: 0.75, relief: 1.1, proc: 'brick' },
  planks: { tex: 'planks', size: 176, contrast: 0.75, relief: 1.2, proc: 'planks' },
  metal: { tex: 'metal', size: 128, contrast: 0.55, relief: 1.6, proc: 'metal' },
  rustplate: { tex: 'rustplate', size: 160, contrast: 0.7, relief: 1.2, proc: 'metal' },
  concrete: { tex: 'concrete', size: 192, contrast: 0.45, relief: 1.2, proc: 'sand' },
};

const detailCache = new Map<string, Detail | null | 'loading'>();

function textureUrl(name: string): string {
  const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './';
  return `${base}textures/${name}.webp`;
}

/** Detail texture if loaded; kicks off an async load otherwise (null until ready or on failure). */
function getDetail(name: string): Detail | null {
  const d = detailCache.get(name);
  if (d === undefined) {
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      detailCache.set(name, null);
      return null;
    }
    detailCache.set(name, 'loading');
    const img = new Image();
    img.src = textureUrl(name);
    img
      .decode()
      .then(() => {
        const w = Math.floor(img.naturalWidth / 2);
        const h = img.naturalHeight;
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = h;
        const g = c.getContext('2d', { willReadFrequently: true })!;
        g.drawImage(img, 0, 0);
        const px = g.getImageData(0, 0, c.width, h).data;
        const alb = new Float32Array(w * h);
        const rel = new Float32Array(w * h);
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            alb[y * w + x] = px[(y * c.width + x) * 4] / 255;
            rel[y * w + x] = px[(y * c.width + x + w) * 4] / 255;
          }
        }
        detailCache.set(name, { w, h, alb, rel });
      })
      .catch(() => detailCache.set(name, null));
    return null;
  }
  return d === 'loading' ? null : d;
}

/** Bilinear, wrapping sample of a detail channel at texel coords. */
function sampleWrap(a: Float32Array, w: number, h: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const xa = ((x0 % w) + w) % w;
  const ya = ((y0 % h) + h) % h;
  const xb = (xa + 1) % w;
  const yb = (ya + 1) % h;
  const p = a[ya * w + xa] + (a[ya * w + xb] - a[ya * w + xa]) * fx;
  const q = a[yb * w + xa] + (a[yb * w + xb] - a[yb * w + xa]) * fx;
  return p + (q - p) * fy;
}

// ---------------------------------------------------------------------------

interface Blade {
  x: number;
  y: number;
  h: number;
  lean: number;
  color: string;
  tx: number;
  ty: number;
}

interface MatTex {
  tex: HTMLCanvasElement;
  vein: HTMLCanvasElement | null;
  /** World size of one repeat. */
  w: number;
  h: number;
}

/** Themes whose terrain is an ink drawing (`ink-terrain.ts`). The rest keep flat materials until they're ported. */
const INK_THEMES: ReadonlySet<ThemeId> = new Set<ThemeId>(['farm']);

export class TerrainPainter {
  private texKey = '';
  private main: MatTex | null = null;
  private sub: MatTex | null = null;
  private bakeKey = '';
  bake: HTMLCanvasElement | null = null;
  /** Emissive veins, when the material has them. */
  glowBake: HTMLCanvasElement | null = null;
  private decorKey = '';
  private decor: Decor[] = [];
  private live: Decor[] = [];
  private blades: Blade[] = [];
  private kb = 1;
  /** World size in px of the baked level. */
  private ww = 0;
  private wh = 0;
  private tufts: Tuft[] = [];
  private inkLayer: HTMLCanvasElement | null = null;

  /**
   * Bake `level` if anything changed; true if it did. `skip` leaves decor out
   * of a tile rect (the surroundings' hole where the real level goes).
   */
  ensure(level: Level, kb: number, skip?: TileRect): boolean {
    const th = level.theme;
    const T = th.terrain;
    const ink = INK_THEMES.has(th.id);
    // Re-bake only when this theme's own textures change state (not when other themes' load). Ink uses none.
    const ready = ink ? '' : `${!!getDetail(MATERIALS[T.kind].tex)}${T.sub ? !!getDetail(MATERIALS[T.sub.kind].tex) : ''}`;
    const tk = `${th.seed}:${th.id}:${th.name}:${kb.toFixed(2)}:${ready}`;
    if (tk !== this.texKey && ink) this.texKey = tk;
    else if (tk !== this.texKey) {
      this.texKey = tk;
      const built = (k: TerrainKind) => ['brick', 'planks', 'metal'].includes(MATERIALS[k].proc);
      this.main = makeTexture(T, T.veins, th, kb, 0x1234);
      this.main.tex = flattenMaterial(this.main.tex, this.main.w, T, built(T.kind));
      this.sub = T.sub ? makeTexture({ ...T.sub, vein: T.vein }, T.veins, th, kb, 0x4321) : null;
      if (this.sub && T.sub) this.sub.tex = flattenMaterial(this.sub.tex, this.sub.w, T.sub, built(T.sub.kind));
    }
    const dk = `${level.seed}:${th.seed}:${th.id}:${level.w}x${level.h}`;
    if (dk !== this.decorKey) {
      this.decorKey = dk;
      this.makeDecor(level, skip);
      this.bakeKey = '';
    }
    const bk = `${tk}:${level.seed}:${level.version}:${level.w}x${level.h}`;
    if (bk === this.bakeKey) return false;
    this.bakeKey = bk;
    this.kb = kb;
    this.bakeTerrain(level, kb);
    return true;
  }

  private bakeTerrain(level: Level, kb: number) {
    const th = level.theme;
    const T = th.terrain;
    this.ww = level.w * TILE;
    this.wh = level.h * TILE;
    const worldW = this.ww;
    const worldH = this.wh;
    const W = Math.ceil(worldW * kb);
    const H = Math.ceil(worldH * kb);
    const c = (this.bake ??= document.createElement('canvas'));
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.setTransform(kb, 0, 0, kb, 0, 0);
    g.clearRect(0, 0, worldW, worldH);
    const solid = (x: number, y: number) => tileAt(level, x, y) !== 0 && tileAt(level, x, y) !== T_ONEWAY && y < level.h;
    if (INK_THEMES.has(th.id)) {
      this.bakeInk(g, level, kb, solid);
      return;
    }
    const mask = new Path2D();
    const R = 5;
    for (let ty = 0; ty < level.h; ty++) {
      for (let tx = 0; tx < level.w; tx++) {
        if (!solid(tx, ty)) continue;
        const u = !solid(tx, ty - 1) && ty > 0;
        const d = !solid(tx, ty + 1) && ty < level.h - 1;
        const l = !solid(tx - 1, ty);
        const r = !solid(tx + 1, ty);
        mask.roundRect(tx * TILE, ty * TILE, TILE, TILE, [u && l ? R : 0, u && r ? R : 0, d && r ? R : 0, d && l ? R : 0]);
      }
    }
    g.lineJoin = 'round';
    // Material.
    const fillMat = (ctx: CanvasRenderingContext2D, m: MatTex) => {
      const pat = ctx.createPattern(m.tex, 'repeat')!;
      pat.setTransform(new DOMMatrix().scale(m.w / m.tex.width, m.h / m.tex.height));
      ctx.fillStyle = pat;
    };
    fillMat(g, this.main!);
    g.fill(mask);

    const dist = distanceToAir(level, solid);
    g.save();
    g.clip(mask);
    if (T.sub && this.sub) {
      // Sub-material by depth below the surface (topsoil over rock, planks over a stone quay).
      const below = new Float32Array(level.w * level.h);
      for (let tx = 0; tx < level.w; tx++) {
        let d = 0;
        for (let ty = 0; ty < level.h; ty++) {
          d = solid(tx, ty) ? d + 1 : 0;
          below[ty * level.w + tx] = d;
        }
      }
      this.paintSub(g, level, below, T.sub.depth, fillMat, kb);
    }

    // Depth: darken with distance from air (smooth via upscaled tiny canvas).
    const tiny = document.createElement('canvas');
    tiny.width = level.w;
    tiny.height = level.h;
    const tg = tiny.getContext('2d')!;
    const img = tg.createImageData(level.w, level.h);
    // Gentle: this becomes one hard band, and at full strength that band is a huge dark shape.
    for (let i = 0; i < dist.length; i++) img.data[i * 4 + 3] = Math.min(62, Math.max(0, (dist[i] - 1) * 20));
    tg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.globalAlpha = 0.85;
    g.drawImage(tiny, 0, 0, worldW, worldH);
    g.globalAlpha = 1;

    // Rim light on top faces, shadow on undersides, side edges.
    for (let ty = 0; ty < level.h; ty++) {
      for (let tx = 0; tx < level.w; tx++) {
        if (!solid(tx, ty)) continue;
        const x = tx * TILE;
        const y = ty * TILE;
        if (ty > 0 && !solid(tx, ty - 1)) {
          const gr = g.createLinearGradient(0, y, 0, y + 8);
          gr.addColorStop(0, css(T.light, 12, 0.7));
          gr.addColorStop(1, css(T.light, 0, 0));
          g.fillStyle = gr;
          g.fillRect(x, y, TILE, 8);
        }
        if (ty < level.h - 1 && !solid(tx, ty + 1)) {
          const gr = g.createLinearGradient(0, y + TILE - 7, 0, y + TILE);
          gr.addColorStop(0, 'rgba(0,0,0,0)');
          gr.addColorStop(1, 'rgba(0,0,0,0.5)');
          g.fillStyle = gr;
          g.fillRect(x, y + TILE - 7, TILE, 7);
        }
        if (!solid(tx - 1, ty)) {
          const gr = g.createLinearGradient(x, 0, x + 4, 0);
          gr.addColorStop(0, css(T.light, 5, 0.32));
          gr.addColorStop(1, css(T.light, 0, 0));
          g.fillStyle = gr;
          g.fillRect(x, y, 4, TILE);
        }
        if (!solid(tx + 1, ty)) {
          const gr = g.createLinearGradient(x + TILE - 4, 0, x + TILE, 0);
          gr.addColorStop(0, 'rgba(0,0,0,0)');
          gr.addColorStop(1, 'rgba(0,0,0,0.3)');
          g.fillStyle = gr;
          g.fillRect(x + TILE - 4, y, 4, TILE);
        }
      }
    }
    g.restore();

    // Caps & hangers (may spill outside the mask).
    const rng = new Rng(level.seed ^ 0x5eed);
    for (let ty = 0; ty < level.h; ty++) {
      for (let tx = 0; tx < level.w; tx++) {
        if (!solid(tx, ty)) continue;
        if (ty > 0 && !solid(tx, ty - 1)) {
          const jl = solid(tx - 1, ty) && !solid(tx - 1, ty - 1);
          const jr = solid(tx + 1, ty) && !solid(tx + 1, ty - 1);
          drawCap(g, th, tx, ty, rng, jl, jr);
        }
        if (ty < level.h - 1 && !solid(tx, ty + 1)) drawUnder(g, th, tx, ty, rng);
      }
    }

    // Jump-through platforms.
    for (let ty = 0; ty < level.h; ty++) {
      for (let tx = 0; tx < level.w; tx++) {
        if (tileAt(level, tx, ty) !== T_ONEWAY) continue;
        const ow = (x: number) => tileAt(level, x, ty) === T_ONEWAY || solid(x, ty);
        drawPlatform(g, th, tx, ty, !ow(tx - 1), !ow(tx + 1), solid(tx - 1, ty) || solid(tx + 1, ty));
      }
    }

    // Static decor.
    for (const d of this.decor) {
      if (!tileAt(level, d.tx, d.ty)) continue;
      const def = DECOR[d.kind];
      if (def.bake) {
        g.save();
        def.bake(g, d, th);
        g.restore();
      }
    }

    // Emissive veins (+ glowing ember specks in ash caps).
    if (T.veins && this.main?.vein) {
      const gc = (this.glowBake ??= document.createElement('canvas'));
      gc.width = W;
      gc.height = H;
      const gg = gc.getContext('2d')!;
      gg.setTransform(kb, 0, 0, kb, 0, 0);
      gg.clearRect(0, 0, worldW, worldH);
      const vp = gg.createPattern(this.main.vein, 'repeat')!;
      vp.setTransform(new DOMMatrix().scale(this.main.w / this.main.vein.width, this.main.h / this.main.vein.height));
      gg.fillStyle = vp;
      gg.fill(mask);
      if (T.cap === 'ash') {
        const er = new Rng(level.seed ^ 0xa5);
        for (let ty = 1; ty < level.h; ty++)
          for (let tx = 0; tx < level.w; tx++) {
            if (!solid(tx, ty) || solid(tx, ty - 1)) continue;
            for (let i = 0; i < 2; i++) {
              gg.fillStyle = css(T.vein, 15, er.range(0.4, 0.9));
              gg.fillRect(tx * TILE + er.range(1, 15), ty * TILE + er.range(-0.5, 2), 1, 1);
            }
          }
      }
    } else this.glowBake = null;
  }

  /** Second material for deep tiles, with a noisy boundary. */
  private paintSub(
    g: CanvasRenderingContext2D,
    level: Level,
    dist: Float32Array,
    depth: number,
    fillMat: (ctx: CanvasRenderingContext2D, m: MatTex) => void,
    kb: number,
  ) {
    const worldW = level.w * TILE;
    const worldH = level.h * TILE;
    const C = 4; // mask cell size in world px
    const mw = Math.ceil(worldW / C);
    const mh = Math.ceil(worldH / C);
    const m = document.createElement('canvas');
    m.width = mw;
    m.height = mh;
    const mg = m.getContext('2d')!;
    const img = mg.createImageData(mw, mh);
    const noise = makeNoise(level.seed ^ 0x5b5b, 16);
    const D = (tx: number, ty: number) => dist[Math.max(0, Math.min(level.h - 1, ty)) * level.w + Math.max(0, Math.min(level.w - 1, tx))];
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        // Bilinear distance at this cell (tile centers), plus fbm wobble.
        const fx = ((x + 0.5) * C) / TILE - 0.5;
        const fy = ((y + 0.5) * C) / TILE - 0.5;
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const ax = fx - x0;
        const ay = fy - y0;
        const dd = (D(x0, y0) * (1 - ax) + D(x0 + 1, y0) * ax) * (1 - ay) + (D(x0, y0 + 1) * (1 - ax) + D(x0 + 1, y0 + 1) * ax) * ay;
        const v = dd + (noise((x / mw) * 16, (y / mh) * 16, 3) - 0.5) * 1.6;
        // A clean boundary between materials, not a soft smear.
        const a = Math.max(0, Math.min(1, (v - depth - 0.3) * 16));
        img.data[(y * mw + x) * 4 + 3] = a * 255;
      }
    }
    mg.putImageData(img, 0, 0);
    const W = Math.ceil(worldW * kb);
    const H = Math.ceil(worldH * kb);
    const layer = document.createElement('canvas');
    layer.width = W;
    layer.height = H;
    const lg = layer.getContext('2d')!;
    lg.setTransform(kb, 0, 0, kb, 0, 0);
    fillMat(lg, this.sub!);
    lg.fillRect(0, 0, worldW, worldH);
    lg.globalCompositeOperation = 'destination-in';
    lg.imageSmoothingEnabled = true;
    lg.drawImage(m, 0, 0, mw * C, mh * C);
    g.drawImage(layer, 0, 0, worldW, worldH);
  }

  /** The terrain as an ink drawing (`ink-terrain.ts`). */
  private bakeInk(g: CanvasRenderingContext2D, level: Level, kb: number, solid: (x: number, y: number) => boolean) {
    const th = level.theme;
    const seed = th.seed ^ 0x1a4c;
    const { mask, loops } = inkContours(level, seed, solid);
    // Paint on a layer and cut it once: thousands of small fills under a clip this complex take seconds.
    const layer = (this.inkLayer ??= document.createElement('canvas'));
    layer.width = g.canvas.width;
    layer.height = g.canvas.height;
    const lg = layer.getContext('2d')!;
    lg.setTransform(kb, 0, 0, kb, 0, 0);
    inkMaterial(lg, level, th, seed, solid);
    inkHatch(lg, loops, th, seed);
    lg.globalCompositeOperation = 'destination-in';
    lg.fillStyle = '#000';
    lg.fill(mask);
    g.drawImage(layer, 0, 0, level.w * TILE, level.h * TILE);
    inkEdges(g, loops, th, seed);
    inkGrass(g, loops, th.terrain.capColor, seed);
    inkPlatforms(g, level, th, seed, solid);
    this.tufts = makeTufts(loops, seed, this.decor);
    for (const d of this.decor) {
      if (!tileAt(level, d.tx, d.ty)) continue;
      const def = DECOR[d.kind];
      if (def.bake) {
        g.save();
        if (d.kind === 'haybale') inkHay(g, d);
        else if (d.kind === 'fence') inkFence(g, d);
        else def.bake(g, d, th);
        g.restore();
      }
    }
    this.glowBake = null;
  }

  private makeDecor(level: Level, skip?: TileRect) {
    const th = level.theme;
    const rng = new Rng(level.seed ^ 0xdec0);
    this.decor = [];
    this.blades = [];
    const solid = (x: number, y: number) => tileAt(level, x, y) !== 0 && tileAt(level, x, y) !== T_ONEWAY;
    const air = (x: number, y: number) => tileAt(level, x, y) === 0 && x >= 0 && x < level.w;
    const capCol = th.terrain.capColor;
    const near = (tx: number, ty: number, p: { tx: number; ty: number }) => Math.abs(tx - p.tx) <= 1 && ty >= p.ty && ty <= p.ty + 2;
    const tops = th.decor.filter((k) => DECOR[k].place === 'top');
    const unders = th.decor.filter((k) => DECOR[k].place === 'under');
    const pick = (list: typeof th.decor) => {
      let total = 0;
      for (const k of list) total += DECOR[k].weight;
      let r = rng.next() * total;
      for (const k of list) {
        r -= DECOR[k].weight;
        if (r < 0) return k;
      }
      return list[list.length - 1];
    };
    const taken = new Set<number>();
    for (let ty = 1; ty < level.h; ty++) {
      for (let tx = 0; tx < level.w; tx++) {
        if (!solid(tx, ty)) continue;
        if (skip && tx >= skip.x && tx < skip.x + skip.w && ty >= skip.y && ty < skip.y + skip.h) continue;
        const top = air(tx, ty - 1);
        const under = ty < level.h - 1 && air(tx, ty + 1);
        if (top && (th.terrain.cap === 'grass' || th.terrain.cap === 'moss')) {
          const n = th.terrain.cap === 'grass' ? rng.int(4, 7) : rng.int(2, 4);
          for (let i = 0; i < n; i++) {
            this.blades.push({
              x: tx * TILE + rng.range(0.5, TILE - 0.5),
              y: ty * TILE + 1.5,
              h: th.terrain.cap === 'grass' ? rng.range(3, 8) : rng.range(2, 5),
              lean: rng.range(-0.4, 0.4),
              color: css(capCol, rng.range(-10, 16), 1, 0, rng.range(-10, 10)),
              tx,
              ty,
            });
          }
        }
        const roll = rng.next();
        const spot = near(tx, ty - 1, level.spawn) || near(tx, ty - 1, level.goal);
        if (top && tops.length && roll < th.decorDensity && !spot && !taken.has(ty * level.w + tx)) {
          const kind = pick(tops);
          const def = DECOR[kind];
          let ok = true;
          for (let k = 1; k <= def.clear; k++) if (!air(tx, ty - k)) ok = false;
          if (ok) {
            let span = 1;
            if (kind === 'fence') {
              while (span < 4 && solid(tx + span, ty) && air(tx + span, ty - 1) && !taken.has(ty * level.w + tx + span)) span++;
              if (span < 2) ok = false;
            }
            if (ok) {
              for (let k = 0; k < span; k++) taken.add(ty * level.w + tx + k);
              this.decor.push({
                kind,
                x: kind === 'fence' ? tx * TILE + 1 : tx * TILE + rng.range(4, 12),
                y: ty * TILE,
                tx,
                ty,
                seed: rng.int(0, 1e9),
                size: rng.range(0.85, 1.25),
                span,
                color: def.color(th, rng),
                flip: rng.chance(0.5),
              });
            }
          }
        }
        if (under && unders.length && rng.chance(th.decorDensity * 0.9)) {
          const kind = pick(unders);
          const def = DECOR[kind];
          let ok = true;
          for (let k = 1; k <= def.clear; k++) if (!air(tx, ty + k)) ok = false;
          if (ok)
            this.decor.push({
              kind,
              x: tx * TILE + rng.range(3, 13),
              y: (ty + 1) * TILE,
              tx,
              ty,
              seed: rng.int(0, 1e9),
              size: rng.range(0.85, 1.3),
              span: 1,
              color: def.color(th, rng),
              flip: rng.chance(0.5),
            });
        }
      }
    }
    this.live = this.decor.filter((d) => DECOR[d.kind].live);
  }

  draw(rc: RC) {
    if (!this.bake) return;
    rc.s.drawImage(this.bake, 0, 0, this.ww, this.wh);
    // Terrain occludes background emissives (skyline windows, lava glow) drawn earlier.
    rc.g.globalCompositeOperation = 'destination-out';
    rc.g.drawImage(this.bake, 0, 0, this.ww, this.wh);
    rc.g.globalCompositeOperation = 'lighter';
    if (this.glowBake) {
      rc.g.globalAlpha = 0.5 + Math.sin(rc.t * 1.7) * 0.15;
      rc.g.drawImage(this.glowBake, 0, 0, this.ww, this.wh);
      rc.g.globalAlpha = 1;
    }
  }

  /** Per-frame: swaying grass (parted by players), decor with animated/emissive bits. */
  drawLive(rc: RC, level: Level, pushers: { x: number; y: number }[]) {
    // Grass goes on the background layer: an outline per blade turns it into black scrub.
    const s = rc.bg;
    const t = rc.t;
    if (INK_THEMES.has(level.theme.id)) drawTufts(rc.s, this.tufts, level, level.theme.terrain.capColor, t, pushers);
    s.lineCap = 'round';
    s.lineWidth = 1.1;
    for (const b of INK_THEMES.has(level.theme.id) ? [] : this.blades) {
      if (!tileAt(level, b.tx, b.ty) || tileAt(level, b.tx, b.ty - 1)) continue;
      let sway = Math.sin(t * 2.1 + b.x * 0.15) * 0.25 + Math.sin(t * 0.7 + b.x * 0.03) * 0.2 + b.lean;
      for (const p of pushers) {
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        if (Math.abs(dx) < 10 && Math.abs(dy) < 12) sway += Math.sign(dx || 1) * (1 - Math.abs(dx) / 10) * 1.1;
      }
      s.strokeStyle = b.color;
      s.beginPath();
      s.moveTo(b.x, b.y);
      s.quadraticCurveTo(b.x + sway * b.h * 0.3, b.y - b.h * 0.6, b.x + sway * b.h, b.y - b.h * Math.cos(Math.min(1.2, Math.abs(sway) * 0.6)));
      s.stroke();
    }
    const th = level.theme;
    for (const d of this.live) {
      if (!tileAt(level, d.tx, d.ty)) continue;
      rc.s.save();
      DECOR[d.kind].live!(rc, d, th);
      rc.s.restore();
    }
  }

  /** Paint a splat decal onto the terrain (only lands on solid pixels). */
  splat(x: number, y: number, r: number, color: HSL) {
    if (!this.bake) return;
    const g = this.bake.getContext('2d')!;
    g.save();
    g.setTransform(this.kb, 0, 0, this.kb, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = css(color, -5, 0.85);
    const n = 5 + Math.floor(Math.random() * 5);
    circle(g, x, y, r);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = r * (0.8 + Math.random() * 1.4);
      circle(g, x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.15 + Math.random() * 0.35));
    }
    g.fillStyle = css(color, 20, 0.5);
    circle(g, x - r * 0.3, y - r * 0.3, r * 0.35);
    g.restore();
  }
}

// ---------------------------------------------------------------------------
// Caps, ceilings, platforms

function drawCap(g: CanvasRenderingContext2D, th: Theme, tx: number, ty: number, rng: Rng, joinL: boolean, joinR: boolean) {
  const T = th.terrain;
  const x = tx * TILE;
  const y = ty * TILE;
  const x0 = joinL ? x : x + 1;
  const x1 = joinR ? x + TILE : x + TILE - 1;
  switch (T.cap) {
    case 'grass':
    case 'moss': {
      const depth = T.cap === 'grass' ? 4 : 3.5;
      g.fillStyle = css(T.capColor, -16);
      g.beginPath();
      g.moveTo(x0 - (joinL ? 0 : 1), y - 1);
      g.lineTo(x1 + (joinR ? 0 : 1), y - 1);
      for (let i = 0; i <= 5; i++) {
        const px = x1 - ((x1 - x0) * i) / 5;
        g.lineTo(px, y + depth + rng.range(0, 3) + (i % 2) * 1.5);
      }
      g.closePath();
      g.fill();
      const gr = g.createLinearGradient(0, y - 1.5, 0, y + depth);
      gr.addColorStop(0, css(T.capColor, 16));
      gr.addColorStop(1, css(T.capColor, -4));
      g.fillStyle = gr;
      g.beginPath();
      g.roundRect(x0 - (joinL ? 0 : 0.8), y - 1.5, x1 - x0 + (joinL ? 0 : 0.8) + (joinR ? 0 : 0.8), depth, [joinL ? 0 : 2, joinR ? 0 : 2, 0, 0]);
      g.fill();
      g.fillStyle = css(T.capColor, 26);
      for (let i = 0; i < 4; i++) g.fillRect(x0 + rng.range(0, x1 - x0 - 1), y + rng.range(-1, 1), 1, 0.8);
      // Moss drips over exposed edges.
      if (T.cap === 'moss') {
        for (const [edge, ex] of [
          [!joinL, x0],
          [!joinR, x1 - 2],
        ] as const) {
          if (!edge) continue;
          g.fillStyle = css(T.capColor, -10);
          g.beginPath();
          g.roundRect(ex - 0.5, y, 2.5, rng.range(4, 9), 1.2);
          g.fill();
        }
      }
      break;
    }
    case 'snow': {
      g.fillStyle = css({ h: 215, s: 30, l: 72 });
      g.beginPath();
      g.roundRect(x0 - 0.5, y - 2.5, x1 - x0 + 1, 5.5, 2.5);
      g.fill();
      g.fillStyle = css(T.capColor);
      g.beginPath();
      g.roundRect(x0 - 0.5, y - 3, x1 - x0 + 1, 4.5, 2.5);
      g.fill();
      g.fillStyle = '#fff';
      g.fillRect(x0 + 2, y - 2.5, x1 - x0 - 5, 1);
      break;
    }
    case 'rust': {
      g.fillStyle = css(T.capColor, -5, 0.9);
      g.fillRect(x0, y, x1 - x0, 2);
      for (let i = 0; i < 2; i++) {
        const sx = x0 + rng.range(1, x1 - x0 - 2);
        const gr = g.createLinearGradient(0, y, 0, y + 10);
        gr.addColorStop(0, css(T.capColor, 0, 0.8));
        gr.addColorStop(1, css(T.capColor, 0, 0));
        g.fillStyle = gr;
        g.fillRect(sx, y, rng.range(1, 2.5), rng.range(5, 10));
      }
      break;
    }
    case 'crystal': {
      g.fillStyle = css(T.vein, 10, 0.9);
      for (let i = 0; i < 2; i++) {
        if (rng.chance(0.4)) continue;
        const cx = x0 + rng.range(2, x1 - x0 - 2);
        const h = rng.range(2, 5);
        g.beginPath();
        g.moveTo(cx - 1.5, y + 0.5);
        g.lineTo(cx + rng.range(-0.8, 0.8), y - h);
        g.lineTo(cx + 1.5, y + 0.5);
        g.fill();
      }
      gravel(g, x0, x1, y, rng, T.light, 3);
      break;
    }
    case 'gravel':
      gravel(g, x0, x1, y, rng, T.light, 6);
      break;
    case 'ledge': {
      // Concrete / stone coping with seams; overhangs the wall a little.
      const l = joinL ? x : x - 1.5;
      const r = joinR ? x + TILE : x + TILE + 1.5;
      g.fillStyle = css(T.outline);
      g.fillRect(l - 0.6, y - 2.6, r - l + 1.2, 6.2);
      g.fillStyle = css(T.capColor, -14);
      g.fillRect(l, y - 2, r - l, 5);
      g.fillStyle = css(T.capColor);
      g.fillRect(l, y - 2, r - l, 3.4);
      g.fillStyle = css(T.capColor, 14);
      g.fillRect(l, y - 2, r - l, 0.9);
      g.fillStyle = css(T.capColor, -26);
      if ((tx + ty) % 2 === 0) g.fillRect(x + 0.2, y - 2, 0.7, 5);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(x, y + 3, TILE, 1.5);
      break;
    }
    case 'trim': {
      // Steel edge band with rivets and a painted safety line.
      g.fillStyle = css(T.outline);
      g.fillRect(x0 - 0.5, y - 1.6, x1 - x0 + 1, 5.2);
      const gr = g.createLinearGradient(0, y - 1.2, 0, y + 3);
      gr.addColorStop(0, css(T.light, 18));
      gr.addColorStop(0.4, css(T.base, 6));
      gr.addColorStop(1, css(T.dark, 0));
      g.fillStyle = gr;
      g.fillRect(x0, y - 1.2, x1 - x0, 4.2);
      g.fillStyle = css(T.dark, -10);
      for (let rx = x + 3; rx < x + TILE; rx += 5) if (rx > x0 && rx < x1) circle(g, rx, y + 1, 0.6);
      g.fillStyle = css(T.capColor, 0, 0.9);
      g.fillRect(x0, y + 3, x1 - x0, 0.9);
      break;
    }
    case 'ash': {
      g.fillStyle = css(T.capColor, -18);
      g.beginPath();
      g.moveTo(x0, y - 0.5);
      for (let i = 0; i <= 4; i++) g.lineTo(x0 + ((x1 - x0) * i) / 4, y - 1.5 - rng.range(0, 1.2));
      g.lineTo(x1, y + 2.5);
      for (let i = 4; i >= 0; i--) g.lineTo(x0 + ((x1 - x0) * i) / 4, y + 2 + rng.range(0, 1.8));
      g.closePath();
      g.fill();
      g.fillStyle = css(T.capColor, 0);
      g.fillRect(x0, y - 1.2, x1 - x0, 1.6);
      g.fillStyle = css(T.capColor, 16, 0.7);
      for (let i = 0; i < 3; i++) g.fillRect(x0 + rng.range(0, x1 - x0 - 1), y - 1.4 + rng.range(0, 1), 1, 0.7);
      break;
    }
    case 'beam': {
      // Wooden quay beam with nail heads; end grain at run ends.
      g.fillStyle = css(T.outline);
      g.fillRect(x0 - 0.5, y - 2, x1 - x0 + 1, 6);
      g.fillStyle = css(T.capColor, -6);
      g.fillRect(x0, y - 1.5, x1 - x0, 5);
      g.fillStyle = css(T.capColor, 10);
      g.fillRect(x0, y - 1.5, x1 - x0, 1);
      g.strokeStyle = css(T.capColor, -18, 0.6);
      g.lineWidth = 0.5;
      g.beginPath();
      g.moveTo(x0, y + 1 + rng.range(-0.5, 0.5));
      g.lineTo(x1, y + 1 + rng.range(-0.5, 0.5));
      g.stroke();
      g.fillStyle = css(hsl(220, 10, 25));
      if (tx % 2 === 0) {
        circle(g, x + 3, y + 1.2, 0.6);
        circle(g, x + 13, y + 1.2, 0.6);
      }
      if (!joinL || !joinR) {
        const ex = !joinL ? x0 : x1 - 3;
        g.fillStyle = css(T.capColor, 4);
        g.fillRect(ex, y - 1.5, 3, 5);
        g.strokeStyle = css(T.capColor, -20, 0.8);
        g.beginPath();
        g.arc(ex + 1.5, y + 1, 1, 0, Math.PI * 2);
        g.stroke();
      }
      break;
    }
    case 'none':
      break;
  }
}

const hsl = (h: number, s: number, l: number): HSL => ({ h, s, l });

function gravel(g: CanvasRenderingContext2D, x0: number, x1: number, y: number, rng: Rng, c: HSL, n: number) {
  for (let i = 0; i < n; i++) {
    const px = x0 + rng.range(0.5, x1 - x0 - 0.5);
    const r = rng.range(0.6, 1.4);
    g.fillStyle = css(c, rng.range(-25, 0));
    g.beginPath();
    g.ellipse(px, y + 0.2, r * 1.3, r, 0, Math.PI, 0);
    g.fill();
  }
}

function drawUnder(g: CanvasRenderingContext2D, th: Theme, tx: number, ty: number, rng: Rng) {
  const T = th.terrain;
  const x = tx * TILE;
  const y = (ty + 1) * TILE;
  if (T.cap === 'snow' && rng.chance(0.35)) {
    g.fillStyle = 'rgba(220,240,255,0.85)';
    const ix = x + rng.range(3, 13);
    g.beginPath();
    g.moveTo(ix - 1.5, y - 0.5);
    g.lineTo(ix, y + rng.range(3, 7));
    g.lineTo(ix + 1.5, y - 0.5);
    g.fill();
  } else if ((T.kind === 'cave' || T.kind === 'basalt' || T.kind === 'rock') && rng.chance(0.35)) {
    // Stalactite.
    const ix = x + rng.range(3, 13);
    const h = rng.range(3, 8);
    g.fillStyle = css(T.outline);
    g.beginPath();
    g.moveTo(ix - 2.6, y - 1);
    g.lineTo(ix, y + h + 0.8);
    g.lineTo(ix + 2.6, y - 1);
    g.fill();
    g.fillStyle = css(T.base, -4);
    g.beginPath();
    g.moveTo(ix - 2, y - 1);
    g.lineTo(ix, y + h);
    g.lineTo(ix + 2, y - 1);
    g.fill();
    g.fillStyle = css(T.light, 0, 0.5);
    g.beginPath();
    g.moveTo(ix - 2, y - 1);
    g.lineTo(ix, y + h);
    g.lineTo(ix - 0.6, y - 1);
    g.fill();
  } else if (T.cap === 'moss' && rng.chance(0.4)) {
    g.fillStyle = css(T.capColor, -14);
    const ix = x + rng.range(2, 12);
    g.beginPath();
    g.roundRect(ix, y - 1, rng.range(2, 4), rng.range(3, 7), 1.5);
    g.fill();
  } else if ((T.kind === 'organic' || T.kind === 'dirt') && rng.chance(0.3)) {
    g.strokeStyle = css(T.dark, -5, 0.9);
    g.lineWidth = 0.9;
    g.beginPath();
    const rx = x + rng.range(2, 14);
    g.moveTo(rx, y - 1);
    g.quadraticCurveTo(rx + rng.range(-3, 3), y + 3, rx + rng.range(-2, 2), y + rng.range(3, 7));
    g.stroke();
  } else if (T.kind === 'crystal' && rng.chance(0.3)) {
    g.fillStyle = css(T.vein, 0, 0.8);
    const ix = x + rng.range(3, 13);
    g.beginPath();
    g.moveTo(ix - 2, y - 0.5);
    g.lineTo(ix, y + rng.range(3, 6));
    g.lineTo(ix + 2, y - 0.5);
    g.fill();
  }
}

/** Jump-through platform: a thin ledge in the theme's platform style. */
function drawPlatform(g: CanvasRenderingContext2D, th: Theme, tx: number, ty: number, endL: boolean, endR: boolean, anchored: boolean) {
  const P = th.terrain.platform;
  const c = P.color;
  const x = tx * TILE;
  const y = ty * TILE;
  const o = th.terrain.outline;
  switch (P.kind) {
    case 'wood': {
      g.fillStyle = css(o);
      g.fillRect(x - (endL ? 0.6 : 0), y - 0.6, TILE + (endL ? 0.6 : 0) + (endR ? 0.6 : 0), 5.8);
      g.fillStyle = css(c);
      g.fillRect(x, y, TILE, 4.6);
      g.fillStyle = css(c, 14);
      g.fillRect(x, y, TILE, 1);
      g.fillStyle = css(c, -14);
      g.fillRect(x, y + 3.6, TILE, 1);
      g.fillStyle = css(o, 0, 0.7);
      if (tx % 2) g.fillRect(x + TILE - 0.6, y, 0.6, 4.6);
      g.fillStyle = css(hsl(220, 10, 30));
      circle(g, x + 2, y + 2.3, 0.5);
      circle(g, x + 14, y + 2.3, 0.5);
      if (!anchored && (endL || endR)) {
        // Little brace underneath.
        const bx = endL ? x + 3 : x + TILE - 3;
        g.strokeStyle = css(c, -18);
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(bx, y + 4.6);
        g.lineTo(bx + (endL ? 5 : -5), y + 9);
        g.stroke();
      }
      break;
    }
    case 'grate': {
      g.fillStyle = css(o);
      g.fillRect(x, y - 0.6, TILE, 5.4);
      g.fillStyle = css(c, 10);
      g.fillRect(x, y, TILE, 1.6);
      g.fillStyle = css(c, -12);
      g.fillRect(x, y + 3.4, TILE, 1);
      g.strokeStyle = css(c, -4);
      g.lineWidth = 0.7;
      g.beginPath();
      for (let i = 0; i < TILE; i += 2.5) {
        g.moveTo(x + i, y + 1.6);
        g.lineTo(x + i + 1.6, y + 3.4);
      }
      g.stroke();
      if (endL || endR) {
        g.fillStyle = css(c, -6);
        g.fillRect(endL ? x : x + TILE - 1.5, y, 1.5, 4.4);
      }
      break;
    }
    case 'bamboo': {
      g.fillStyle = css(o);
      g.fillRect(x, y - 0.6, TILE, 5.4);
      for (const [yy, dl] of [
        [0, 6],
        [2.3, -6],
      ] as const) {
        const gr = g.createLinearGradient(0, y + yy, 0, y + yy + 2.2);
        gr.addColorStop(0, css(c, dl + 12));
        gr.addColorStop(1, css(c, dl - 10));
        g.fillStyle = gr;
        g.fillRect(x, y + yy, TILE, 2.2);
      }
      g.fillStyle = css(c, -22);
      g.fillRect(x + ((tx * 7) % 9) + 2, y, 0.8, 4.5);
      if (tx % 2 === 0) {
        g.fillStyle = css(hsl(35, 40, 40));
        g.fillRect(x + 7, y - 0.4, 1.4, 5.2);
      }
      break;
    }
    case 'stone': {
      g.fillStyle = css(o);
      g.fillRect(x - (endL ? 0.6 : 0), y - 0.6, TILE + (endL ? 0.6 : 0) + (endR ? 0.6 : 0), 6.4);
      g.fillStyle = css(c);
      g.fillRect(x, y, TILE, 5.2);
      g.fillStyle = css(c, 12);
      g.fillRect(x, y, TILE, 1);
      g.fillStyle = css(c, -12);
      g.fillRect(x, y + 4.2, TILE, 1);
      g.fillStyle = css(th.terrain.vein, 0, 0.5);
      if (tx % 3 === 0) g.fillRect(x + 6, y + 2, 4, 0.8);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Material texture

/** Manhattan-ish distance (in tiles) from each solid tile to the nearest air. */
function distanceToAir(level: Level, solid: (x: number, y: number) => boolean): Float32Array {
  const { w, h } = level;
  const d = new Float32Array(w * h).fill(1e9);
  const q: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid(x, y)) {
        d[y * w + x] = 0;
        q.push(y * w + x);
      }
    }
  }
  let qi = 0;
  while (qi < q.length) {
    const i = q[qi++];
    const x = i % w;
    const y = (i - x) / w;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (d[j] > d[i] + 1) {
        d[j] = d[i] + 1;
        q.push(j);
      }
    }
  }
  for (let i = 0; i < d.length; i++) if (d[i] > 1e8) d[i] = 6;
  return d;
}

/**
 * Tileable material texture for one terrain look: procedural pattern in the
 * theme's dark/base/light ramp, modulated by the detail texture (albedo +
 * relief) when it's loaded. Also returns an emissive vein mask if requested.
 */
function makeTexture(T: Pick<TerrainLook, 'kind' | 'base' | 'dark' | 'light' | 'vein'>, veins: boolean, th: Theme, kb: number, salt: number): MatTex {
  const spec = MATERIALS[T.kind];
  const det = getDetail(spec.tex);
  const ww = spec.size;
  const wh = det ? Math.round((spec.size * det.h) / det.w) : spec.size;
  // The detail source is 256 px wide, so more than ~512 px per repeat adds cost, not detail.
  const kt = Math.min(kb, 512 / ww);
  const SX = Math.max(32, Math.round(ww * kt));
  const SY = Math.max(32, Math.round(wh * kt));
  const c = document.createElement('canvas');
  c.width = SX;
  c.height = SY;
  const g = c.getContext('2d')!;
  const img = g.createImageData(SX, SY);
  const n1 = makeNoise(th.seed ^ salt, 8);
  const n2 = makeNoise(th.seed ^ (salt * 7), 16);
  const base = toRgb(T.base);
  const dark = toRgb(T.dark);
  const lite = toRgb(T.light);
  const veinMask = veins ? new Float32Array(SX * SY) : null;
  const ramp = (t: number) => (t < 0.5 ? mixRgb(dark, base, Math.max(0, t) * 2) : mixRgb(base, lite, Math.min(1, (t - 0.5) * 2)));
  const strength = th.terrain.detail;
  for (let py = 0; py < SY; py++) {
    for (let px = 0; px < SX; px++) {
      const u = (px / SX) * 8; // lattice units (period 8)
      const v = (py / SY) * 8;
      const wx = (px / SX) * ww; // world px within texture
      const wy = (py / SY) * wh;
      const n = n1(u, v, 5);
      const m = n2(u * 2, v * 2, 3);
      // With a detail texture the procedural pattern is replaced by a cheap noise ramp.
      let col = det ? ramp(0.5 + (n - 0.5) * 0.6) : proc(spec.proc, wx, wy, u, v, n, m, n2, dark, base, lite, th.seed, px, py);
      let a = 0.5;
      if (det) {
        const tx = (px / SX) * det.w;
        const ty = (py / SY) * det.h;
        a = sampleWrap(det.alb, det.w, det.h, tx, ty);
        const r = sampleWrap(det.rel, det.w, det.h, tx, ty);
        const t = 0.5 + (a - 0.5) * spec.contrast * 1.3 + (n - 0.5) * 0.45;
        let dc = ramp(t);
        const shade = 1 + (r - 0.5) * spec.relief * 1.1;
        dc = [dc[0] * shade, dc[1] * shade, dc[2] * shade];
        col = mixRgb(col, dc, strength);
      }
      if (veinMask) {
        let vm = 0;
        if (spec.proc === 'crystal') {
          const ridge = 1 - Math.abs(n2(u, v, 4) * 2 - 1);
          if (ridge > 0.93) vm = (ridge - 0.93) / 0.07;
        } else {
          const ridge = 1 - Math.abs(n2(u * 0.75 + 3, v * 0.75, 4) * 2 - 1);
          const th0 = T.kind === 'basalt' ? 0.986 : 0.982;
          if (ridge > th0) vm = (ridge - th0) / (1 - th0);
          // Magma pooling in the dark crevices of the detail texture.
          if (det && T.kind === 'basalt' && a < 0.2 && n > 0.56) vm = Math.max(vm, Math.min(1, ((0.2 - a) / 0.12) * (n - 0.56) * 6));
        }
        veinMask[py * SX + px] = vm;
      }
      const grain = (hash2(px, py, 7) - 0.5) * 0.04;
      const i = (py * SX + px) * 4;
      img.data[i] = Math.max(0, Math.min(255, (col[0] + grain) * 255));
      img.data[i + 1] = Math.max(0, Math.min(255, (col[1] + grain) * 255));
      img.data[i + 2] = Math.max(0, Math.min(255, (col[2] + grain) * 255));
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  let vc: HTMLCanvasElement | null = null;
  if (veinMask) {
    vc = document.createElement('canvas');
    vc.width = SX;
    vc.height = SY;
    const vg = vc.getContext('2d')!;
    const vi = vg.createImageData(SX, SY);
    const vr = toRgb(T.vein);
    for (let i = 0; i < veinMask.length; i++) {
      const a = Math.min(1, veinMask[i] * 1.5);
      vi.data[i * 4] = vr[0] * 255;
      vi.data[i * 4 + 1] = vr[1] * 255;
      vi.data[i * 4 + 2] = vr[2] * 255;
      vi.data[i * 4 + 3] = a * 255;
    }
    vg.putImageData(vi, 0, 0);
    // Also tint the albedo where veins run so they read even when dim.
    g.globalAlpha = 0.6;
    g.drawImage(vc, 0, 0);
    g.globalAlpha = 1;
  }
  return { tex: c, vein: vc, w: ww, h: wh };
}

/** Procedural base pattern (also the full fallback when no detail texture is available). */
function proc(
  kind: ProcKind,
  wx: number,
  wy: number,
  u: number,
  v: number,
  n: number,
  m: number,
  n2: (x: number, y: number, o?: number) => number,
  dark: number[],
  base: number[],
  lite: number[],
  seed: number,
  px: number,
  py: number,
): number[] {
  switch (kind) {
    case 'rock': {
      const strata = Math.sin((wy + n * 26) * 0.35) * 0.5 + 0.5;
      let col = mixRgb(dark, base, Math.min(1, n * 1.3));
      col = mixRgb(col, lite, strata * 0.25 * m);
      if (Math.abs(n2(u * 1.5, v * 1.5, 4) - 0.5) < 0.018) col = mixRgb(col, dark, 0.7);
      return col;
    }
    case 'brick': {
      const bh = 8;
      const bw = 16;
      const row = Math.floor(wy / bh);
      const bx = wx + (row % 2) * (bw / 2);
      const inX = bx % bw;
      const inY = wy % bh;
      const id = hash2(Math.floor(bx / bw), row, seed);
      const mortar = inX < 1.1 || inY < 1.1;
      let col = mortar ? mixRgb(dark, base, 0.25) : mixRgb(base, id > 0.5 ? lite : dark, Math.abs(id - 0.5) * 0.5 + n * 0.25);
      if (!mortar && inY < 2.2) col = mixRgb(col, lite, 0.25);
      if (!mortar && inY > bh - 2) col = mixRgb(col, dark, 0.25);
      return col;
    }
    case 'planks': {
      const ph = 12;
      const row = Math.floor(wy / ph);
      const inY = wy % ph;
      const off = hash2(row, 3, seed) * 64;
      const inX = (wx + off) % 64;
      const id = hash2(Math.floor((wx + off) / 64), row, seed);
      let col = mixRgb(dark, base, 0.55 + id * 0.35 + (Math.sin(wx * 0.6 + n * 12) * 0.5 + 0.5) * 0.12);
      if (inY < 1 || inX < 0.9) col = mixRgb(col, dark, 0.8);
      else if (inY < 2) col = mixRgb(col, lite, 0.3);
      return col;
    }
    case 'metal': {
      const P = 32;
      const ix = wx % P;
      const iy = wy % P;
      let col = mixRgb(base, lite, n * 0.25);
      if (ix < 1.2 || iy < 1.2) col = mixRgb(col, dark, 0.7);
      else if (ix < 2.4 || iy < 2.4) col = mixRgb(col, lite, 0.35);
      else if (ix > P - 2.4 || iy > P - 2.4) col = mixRgb(col, dark, 0.35);
      const near = (a: number, b: number) => Math.abs(ix - a) < 1.4 && Math.abs(iy - b) < 1.4;
      if (near(5, 5) || near(P - 5, 5) || near(5, P - 5) || near(P - 5, P - 5)) col = mixRgb(lite, dark, (ix % 1) * 0.5);
      if (m > 0.62) col = mixRgb(col, [0.45, 0.22, 0.1], (m - 0.62) * 1.6);
      return col;
    }
    case 'crystal': {
      const ridge = 1 - Math.abs(n2(u, v, 4) * 2 - 1);
      return mixRgb(mixRgb(dark, base, n), lite, Math.max(0, ridge - 0.8) * 2);
    }
    case 'organic': {
      let col = mixRgb(dark, base, Math.min(1, n * 1.2));
      const root = Math.abs(Math.sin(wx * 0.12 + n * 9) * Math.cos(wy * 0.05 + m * 4));
      if (root < 0.04) col = mixRgb(col, lite, 0.45);
      if (hash2(Math.floor(wx / 3), Math.floor(wy / 3), seed) > 0.985) col = mixRgb(col, lite, 0.6);
      return col;
    }
    case 'sand': {
      const rip = Math.sin(wy * 0.6 + Math.sin(wx * 0.08) * 3 + n * 4) * 0.5 + 0.5;
      let col = mixRgb(base, lite, rip * 0.2 + n * 0.2);
      if (hash2(px, py, seed) > 0.97) col = mixRgb(col, dark, 0.4);
      return col;
    }
  }
}
