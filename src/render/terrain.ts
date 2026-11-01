import { css, shift, toRgb, type HSL } from '../core/color';
import { hash2, Rng } from '../core/rng';
import type { Theme } from '../gen/theme';
import { TILE, VIEW_H, VIEW_W } from '../sim/constants';
import { tileAt, type Level } from '../sim/level';
import { circle, ellipse, glowDot, light, makeNoise, type RC } from './kit';

/**
 * Procedural terrain: a tileable material texture generated per theme, baked
 * through a rounded-corner mask with outline, depth shading, rim light,
 * caps (grass/moss/snow/rust/crystal) and hanging details. Animated bits
 * (grass, vines, decor, emissive veins) are drawn per frame on top.
 */

const TEX = 128;

interface Decor {
  kind: 'crystal' | 'mushroom' | 'lantern' | 'vine' | 'bones' | 'torch' | 'flower' | 'pipe';
  x: number;
  y: number;
  /** Tile that must stay solid for this decor to exist. */
  tx: number;
  ty: number;
  seed: number;
  size: number;
  color: HSL;
}

interface Blade {
  x: number;
  y: number;
  h: number;
  lean: number;
  color: string;
  tx: number;
  ty: number;
}

export class TerrainPainter {
  private texKey = '';
  private tex: HTMLCanvasElement | null = null;
  private veinTex: HTMLCanvasElement | null = null;
  private bakeKey = '';
  bake: HTMLCanvasElement | null = null;
  private glowBake: HTMLCanvasElement | null = null;
  private shadow: HTMLCanvasElement | null = null;
  private decorKey = '';
  private decor: Decor[] = [];
  private blades: Blade[] = [];
  private kb = 1;

  ensure(level: Level, kb: number) {
    const th = level.theme;
    const tk = `${th.seed}:${th.name}:${kb.toFixed(2)}`;
    if (tk !== this.texKey) {
      this.texKey = tk;
      [this.tex, this.veinTex] = makeTexture(th, kb);
    }
    const bk = `${tk}:${level.seed}:${level.version}`;
    if (bk !== this.bakeKey) {
      this.bakeKey = bk;
      this.kb = kb;
      this.bakeTerrain(level, kb);
    }
    const dk = `${level.seed}:${th.seed}`;
    if (dk !== this.decorKey) {
      this.decorKey = dk;
      this.makeDecor(level);
    }
  }

  private bakeTerrain(level: Level, kb: number) {
    const th = level.theme;
    const T = th.terrain;
    const W = Math.ceil(VIEW_W * kb);
    const H = Math.ceil(VIEW_H * kb);
    const c = (this.bake ??= document.createElement('canvas'));
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.setTransform(kb, 0, 0, kb, 0, 0);
    g.clearRect(0, 0, VIEW_W, VIEW_H);
    const solid = (x: number, y: number) => !!tileAt(level, x, y) && y < level.h;
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
    // Outline (internal strokes get covered by the fill below).
    g.lineJoin = 'round';
    g.strokeStyle = css(T.dark, -12);
    g.lineWidth = 3;
    g.stroke(mask);
    // Material.
    const pat = g.createPattern(this.tex!, 'repeat')!;
    pat.setTransform(new DOMMatrix().scale(1 / kb));
    g.fillStyle = pat;
    g.fill(mask);

    g.save();
    g.clip(mask);
    // Depth: darken with distance from air (smooth via upscaled tiny canvas).
    const dist = distanceToAir(level);
    const tiny = document.createElement('canvas');
    tiny.width = level.w;
    tiny.height = level.h;
    const tg = tiny.getContext('2d')!;
    const img = tg.createImageData(level.w, level.h);
    for (let i = 0; i < dist.length; i++) {
      img.data[i * 4 + 3] = Math.min(200, Math.max(0, (dist[i] - 0.6) * 60));
    }
    tg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.globalAlpha = 0.85;
    g.drawImage(tiny, 0, 0, VIEW_W, VIEW_H);
    g.globalAlpha = 1;

    // Rim light on top faces, shadow on undersides, side edges.
    for (let ty = 0; ty < level.h; ty++) {
      for (let tx = 0; tx < level.w; tx++) {
        if (!solid(tx, ty)) continue;
        const x = tx * TILE;
        const y = ty * TILE;
        if (ty > 0 && !solid(tx, ty - 1)) {
          const gr = g.createLinearGradient(0, y, 0, y + 7);
          gr.addColorStop(0, css(T.light, 10, 0.75));
          gr.addColorStop(1, css(T.light, 0, 0));
          g.fillStyle = gr;
          g.fillRect(x, y, TILE, 7);
        }
        if (ty < level.h - 1 && !solid(tx, ty + 1)) {
          const gr = g.createLinearGradient(0, y + TILE - 6, 0, y + TILE);
          gr.addColorStop(0, 'rgba(0,0,0,0)');
          gr.addColorStop(1, 'rgba(0,0,0,0.45)');
          g.fillStyle = gr;
          g.fillRect(x, y + TILE - 6, TILE, 6);
        }
        if (!solid(tx - 1, ty)) {
          g.fillStyle = css(T.light, 0, 0.18);
          g.fillRect(x, y, 2, TILE);
        }
        if (!solid(tx + 1, ty)) {
          g.fillStyle = 'rgba(0,0,0,0.22)';
          g.fillRect(x + TILE - 2.5, y, 2.5, TILE);
        }
      }
    }
    g.restore();

    // Caps & hangers (may spill outside the mask).
    const rng = new Rng(level.seed ^ 0x5eed);
    for (let ty = 0; ty < level.h; ty++) {
      for (let tx = 0; tx < level.w; tx++) {
        if (!solid(tx, ty)) continue;
        if (ty > 0 && !solid(tx, ty - 1)) drawCap(g, th, tx, ty, rng, solid(tx - 1, ty) && !solid(tx - 1, ty - 1), solid(tx + 1, ty) && !solid(tx + 1, ty - 1));
        if (ty < level.h - 1 && !solid(tx, ty + 1)) drawUnder(g, th, tx, ty, rng);
      }
    }

    // Emissive veins.
    if (T.veins && this.veinTex) {
      const gc = (this.glowBake ??= document.createElement('canvas'));
      gc.width = W;
      gc.height = H;
      const gg = gc.getContext('2d')!;
      gg.setTransform(kb, 0, 0, kb, 0, 0);
      gg.clearRect(0, 0, VIEW_W, VIEW_H);
      const vp = gg.createPattern(this.veinTex, 'repeat')!;
      vp.setTransform(new DOMMatrix().scale(1 / kb));
      gg.fillStyle = vp;
      gg.fill(mask);
    } else this.glowBake = null;

    // Drop shadow cast onto the background.
    const sc = (this.shadow ??= document.createElement('canvas'));
    const sk = Math.min(kb, 1);
    sc.width = Math.ceil(VIEW_W * sk);
    sc.height = Math.ceil(VIEW_H * sk);
    const sg = sc.getContext('2d')!;
    sg.setTransform(sk, 0, 0, sk, 0, 0);
    sg.clearRect(0, 0, VIEW_W, VIEW_H);
    sg.filter = 'blur(5px)';
    sg.fillStyle = 'rgba(0,0,0,0.55)';
    sg.fill(mask);
    sg.filter = 'none';
  }

  private makeDecor(level: Level) {
    const th = level.theme;
    const rng = new Rng(level.seed ^ 0xdec0);
    this.decor = [];
    this.blades = [];
    const solid = (x: number, y: number) => !!tileAt(level, x, y);
    const capCol = th.terrain.capColor;
    for (let ty = 1; ty < level.h; ty++) {
      for (let tx = 0; tx < level.w; tx++) {
        if (!solid(tx, ty)) continue;
        const top = !solid(tx, ty - 1);
        const under = ty < level.h - 1 && !solid(tx, ty + 1);
        if (top && (th.terrain.cap === 'grass' || th.terrain.cap === 'moss')) {
          const n = th.terrain.cap === 'grass' ? rng.int(3, 6) : rng.int(1, 3);
          for (let i = 0; i < n; i++) {
            this.blades.push({
              x: tx * TILE + rng.range(1, TILE - 1),
              y: ty * TILE + 1.5,
              h: th.terrain.cap === 'grass' ? rng.range(3, 8) : rng.range(2, 4),
              lean: rng.range(-0.4, 0.4),
              color: css(capCol, rng.range(-12, 14), 1, 0, rng.range(-12, 12)),
              tx,
              ty,
            });
          }
        }
        if (top && rng.chance(0.13)) {
          const kind = rng.pick(th.decor.filter((k) => k !== 'lantern' && k !== 'vine'));
          if (kind) this.decor.push({ kind, x: tx * TILE + rng.range(4, 12), y: ty * TILE, tx, ty, seed: rng.int(0, 1e9), size: rng.range(0.8, 1.4), color: decorColor(th, kind, rng) });
        }
        if (under && rng.chance(0.12)) {
          const kind = th.decor.includes('lantern') && rng.chance(0.4) ? 'lantern' : th.decor.includes('vine') || th.terrain.cap === 'moss' || th.terrain.cap === 'grass' ? 'vine' : null;
          if (kind) this.decor.push({ kind, x: tx * TILE + rng.range(3, 13), y: (ty + 1) * TILE, tx, ty, seed: rng.int(0, 1e9), size: rng.range(0.8, 1.5), color: decorColor(th, kind, rng) });
        }
      }
    }
  }

  drawShadow(rc: RC) {
    if (!this.shadow) return;
    rc.s.drawImage(this.shadow, 3, 5, VIEW_W, VIEW_H);
  }

  draw(rc: RC) {
    if (!this.bake) return;
    rc.s.drawImage(this.bake, 0, 0, VIEW_W, VIEW_H);
    if (this.glowBake) {
      rc.g.globalAlpha = 0.55 + Math.sin(rc.t * 1.7) * 0.2;
      rc.g.drawImage(this.glowBake, 0, 0, VIEW_W, VIEW_H);
      rc.g.globalAlpha = 1;
    }
  }

  /** Per-frame: swaying grass (parted by players), decor with emissive bits. */
  drawLive(rc: RC, level: Level, pushers: { x: number; y: number }[]) {
    const s = rc.s;
    const t = rc.t;
    s.lineCap = 'round';
    s.lineWidth = 1.1;
    for (const b of this.blades) {
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
    for (const d of this.decor) {
      if (!tileAt(level, d.tx, d.ty)) continue;
      drawDecor(rc, d, level.theme);
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

function decorColor(th: Theme, kind: Decor['kind'], rng: Rng): HSL {
  switch (kind) {
    case 'crystal':
      return rng.chance(0.6) ? th.terrain.vein : { h: rng.range(0, 360), s: 85, l: 62 };
    case 'mushroom':
      return { h: rng.pick([190, 280, 320, 100, 40]), s: 90, l: 60 };
    case 'flower':
      return { h: rng.range(0, 360), s: 80, l: 65 };
    case 'lantern':
    case 'torch':
      return { h: rng.range(25, 45), s: 100, l: 60 };
    case 'vine':
      return shift(th.terrain.capColor, -8);
    default:
      return th.terrain.light;
  }
}

function drawDecor(rc: RC, d: Decor, th: Theme) {
  const s = rc.s;
  const t = rc.t;
  const k = d.size;
  switch (d.kind) {
    case 'crystal': {
      const n = 2 + (d.seed % 3);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.45 + ((d.seed >> (i * 3)) % 7) * 0.03;
        const len = (5 + ((d.seed >> (i * 5)) % 5)) * k;
        const w = 1.8 * k;
        const bx = d.x + (i - (n - 1) / 2) * 2;
        const by = d.y + 1;
        const tx = bx + Math.cos(a) * len;
        const ty = by + Math.sin(a) * len;
        const nx = -Math.sin(a) * w;
        const ny = Math.cos(a) * w;
        s.fillStyle = css(d.color, -10);
        s.beginPath();
        s.moveTo(bx - nx, by - ny);
        s.lineTo(tx, ty);
        s.lineTo(bx + nx, by + ny);
        s.fill();
        s.fillStyle = css(d.color, 20);
        s.beginPath();
        s.moveTo(bx, by);
        s.lineTo(tx, ty);
        s.lineTo(bx + nx, by + ny);
        s.fill();
        rc.g.strokeStyle = css(d.color, 15, 0.8);
        rc.g.lineWidth = 1;
        rc.g.beginPath();
        rc.g.moveTo(bx, by);
        rc.g.lineTo(tx, ty);
        rc.g.stroke();
      }
      const pulse = 0.6 + Math.sin(t * 2 + d.seed) * 0.25;
      glowDot(rc.g, d.x, d.y - 4 * k, 12 * k, d.color, 0.35 * pulse);
      light(rc, d.x, d.y - 4, 55 * k, d.color, 0.55 * pulse);
      break;
    }
    case 'mushroom': {
      const h = 5 * k;
      s.fillStyle = css(th.terrain.light, 25);
      s.fillRect(d.x - 0.8, d.y - h, 1.6, h);
      s.fillStyle = css(d.color, -15);
      s.beginPath();
      s.ellipse(d.x, d.y - h, 3.5 * k, 2.4 * k, 0, Math.PI, 0);
      s.fill();
      const pulse = 0.65 + Math.sin(t * 1.5 + d.seed) * 0.35;
      rc.g.fillStyle = css(d.color, 10, 0.7 * pulse);
      rc.g.beginPath();
      rc.g.ellipse(d.x, d.y - h, 3.5 * k, 2.4 * k, 0, Math.PI, 0);
      rc.g.fill();
      rc.g.fillStyle = css(d.color, 35, pulse);
      circle(rc.g, d.x - 1.2 * k, d.y - h - 1 * k, 0.6 * k);
      circle(rc.g, d.x + 1.3 * k, d.y - h - 0.6 * k, 0.5 * k);
      glowDot(rc.g, d.x, d.y - h, 9 * k, d.color, 0.3 * pulse);
      light(rc, d.x, d.y - h, 40 * k, d.color, 0.5 * pulse);
      break;
    }
    case 'flower': {
      const h = 6 * k;
      const sw = Math.sin(t * 2 + d.seed) * 1.2;
      s.strokeStyle = css(th.terrain.capColor, -10);
      s.lineWidth = 0.9;
      s.beginPath();
      s.moveTo(d.x, d.y);
      s.quadraticCurveTo(d.x + sw * 0.5, d.y - h / 2, d.x + sw, d.y - h);
      s.stroke();
      s.fillStyle = css(d.color);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + t * 0.2;
        circle(s, d.x + sw + Math.cos(a) * 1.6 * k, d.y - h + Math.sin(a) * 1.6 * k, 1.2 * k);
      }
      s.fillStyle = '#ffe680';
      circle(s, d.x + sw, d.y - h, 0.9 * k);
      break;
    }
    case 'torch': {
      s.fillStyle = css(th.terrain.dark, -5);
      s.fillRect(d.x - 1, d.y - 8 * k, 2, 8 * k);
      s.fillStyle = css(th.terrain.light, -10);
      s.fillRect(d.x - 2, d.y - 9 * k, 4, 2);
      const fl = 0.8 + Math.sin(t * 17 + d.seed) * 0.12 + Math.sin(t * 29 + d.seed * 2) * 0.08;
      const fy = d.y - 10 * k;
      flame(rc.g, d.x, fy, 3 * k * fl, 6 * k * fl, d.color, t + d.seed);
      glowDot(rc.g, d.x, fy - 2, 18 * k, d.color, 0.35 * fl);
      light(rc, d.x, fy, 80 * k, d.color, 0.9 * fl);
      break;
    }
    case 'lantern': {
      const len = 6 * k + (d.seed % 6);
      const sw = Math.sin(t * 1.3 + d.seed) * 0.12;
      const lx = d.x + Math.sin(sw) * len;
      const ly = d.y + Math.cos(sw) * len;
      s.strokeStyle = 'rgba(30,30,30,0.9)';
      s.lineWidth = 0.7;
      s.beginPath();
      s.moveTo(d.x, d.y);
      s.lineTo(lx, ly);
      s.stroke();
      s.fillStyle = '#2b2b33';
      s.fillRect(lx - 2.5, ly, 5, 1.2);
      s.fillRect(lx - 2.5, ly + 6, 5, 1.2);
      rc.g.fillStyle = css(d.color, 10, 0.95);
      rc.g.fillRect(lx - 2, ly + 1.2, 4, 4.8);
      s.fillStyle = css(d.color, 20, 0.6);
      s.fillRect(lx - 2, ly + 1.2, 4, 4.8);
      const fl = 0.85 + Math.sin(t * 9 + d.seed) * 0.08;
      glowDot(rc.g, lx, ly + 3.5, 14 * k, d.color, 0.4 * fl);
      light(rc, lx, ly + 3.5, 75 * k, d.color, 0.85 * fl);
      break;
    }
    case 'vine': {
      const segs = 4 + (d.seed % 6);
      s.strokeStyle = css(d.color);
      s.lineWidth = 1.2;
      s.beginPath();
      s.moveTo(d.x, d.y);
      let x = d.x;
      let y = d.y;
      for (let i = 1; i <= segs; i++) {
        x = d.x + Math.sin(t * 1.2 + i * 0.6 + d.seed) * i * 0.35;
        y = d.y + i * 2.6 * k;
        s.lineTo(x, y);
      }
      s.stroke();
      s.fillStyle = css(d.color, 8);
      for (let i = 2; i <= segs; i += 2) {
        const lx = d.x + Math.sin(t * 1.2 + i * 0.6 + d.seed) * i * 0.35;
        ellipse(s, lx + (i % 4 ? 1.5 : -1.5), d.y + i * 2.6 * k, 1.6, 0.9, i % 4 ? 0.5 : -0.5);
      }
      break;
    }
    case 'bones': {
      s.fillStyle = css({ h: 40, s: 25, l: 82 });
      circle(s, d.x, d.y - 2.5 * k, 2.5 * k);
      s.fillRect(d.x - 1.5 * k, d.y - 1.5 * k, 3 * k, 1.5 * k);
      s.fillStyle = '#1b1b22';
      circle(s, d.x - 0.9 * k, d.y - 2.8 * k, 0.6 * k);
      circle(s, d.x + 0.9 * k, d.y - 2.8 * k, 0.6 * k);
      s.strokeStyle = css({ h: 40, s: 25, l: 78 });
      s.lineWidth = 1;
      s.beginPath();
      s.moveTo(d.x + 3, d.y - 0.5);
      s.lineTo(d.x + 8 * k, d.y - 1.5);
      s.stroke();
      break;
    }
    case 'pipe': {
      s.fillStyle = css({ h: 25, s: 30, l: 35 });
      s.fillRect(d.x - 1.5, d.y - 9 * k, 3, 9 * k);
      s.fillStyle = css({ h: 25, s: 30, l: 50 });
      s.fillRect(d.x - 2.5, d.y - 10 * k, 5, 2);
      // Steam puffs.
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.6 + i / 3 + (d.seed % 10) / 10) % 1;
        s.fillStyle = `rgba(230,230,240,${0.25 * (1 - p)})`;
        circle(s, d.x + Math.sin(p * 6 + i) * 2, d.y - 10 * k - p * 14, 1.5 + p * 3);
      }
      break;
    }
  }
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

function drawCap(g: CanvasRenderingContext2D, th: Theme, tx: number, ty: number, rng: Rng, joinL: boolean, joinR: boolean) {
  const T = th.terrain;
  const x = tx * TILE;
  const y = ty * TILE;
  const x0 = joinL ? x : x + 1;
  const x1 = joinR ? x + TILE : x + TILE - 1;
  switch (T.cap) {
    case 'grass':
    case 'moss': {
      const depth = T.cap === 'grass' ? 4 : 3;
      g.fillStyle = css(T.capColor, -14);
      g.beginPath();
      g.moveTo(x0, y - 1);
      g.lineTo(x1, y - 1);
      for (let i = 0; i <= 4; i++) {
        const px = x1 - ((x1 - x0) * i) / 4;
        g.lineTo(px, y + depth + rng.range(0, 3) + (i % 2) * 1.5);
      }
      g.closePath();
      g.fill();
      const gr = g.createLinearGradient(0, y - 1, 0, y + depth);
      gr.addColorStop(0, css(T.capColor, 14));
      gr.addColorStop(1, css(T.capColor, -4));
      g.fillStyle = gr;
      g.fillRect(x0, y - 1, x1 - x0, depth - 0.5);
      // Specks.
      g.fillStyle = css(T.capColor, 22);
      for (let i = 0; i < 3; i++) g.fillRect(x0 + rng.range(0, x1 - x0 - 1), y + rng.range(-0.5, 1.5), 1, 1);
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
        const cx = x0 + rng.range(2, x1 - x0 - 2);
        const h = rng.range(2, 5);
        g.beginPath();
        g.moveTo(cx - 1.5, y + 0.5);
        g.lineTo(cx + rng.range(-0.8, 0.8), y - h);
        g.lineTo(cx + 1.5, y + 0.5);
        g.fill();
      }
      break;
    }
    case 'none':
      break;
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
  } else if ((T.kind === 'organic' || T.kind === 'rock') && rng.chance(0.3)) {
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

/** Manhattan-ish distance (in tiles) from each solid tile to the nearest air. */
function distanceToAir(level: Level): Float32Array {
  const { w, h } = level;
  const d = new Float32Array(w * h).fill(1e9);
  const q: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!tileAt(level, x, y)) {
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

/** Generate the theme's tileable material texture (and vein emissive mask). */
function makeTexture(th: Theme, kb: number): [HTMLCanvasElement, HTMLCanvasElement | null] {
  const T = th.terrain;
  const S = Math.max(32, Math.round(TEX * kb));
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const img = g.createImageData(S, S);
  const n1 = makeNoise(th.seed ^ 0x1234, 8);
  const n2 = makeNoise(th.seed ^ 0x9876, 16);
  const base = toRgb(T.base);
  const dark = toRgb(T.dark);
  const lite = toRgb(T.light);
  const veinMask = new Float32Array(S * S);
  const mix = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const u = (px / S) * 8; // lattice units (period 8)
      const v = (py / S) * 8;
      const wx = (px / S) * TEX; // world px within texture
      const wy = (py / S) * TEX;
      const n = n1(u, v, 5);
      const m = n2(u * 2, v * 2, 3);
      let col: number[];
      switch (T.kind) {
        case 'rock': {
          const strata = Math.sin((wy + n * 26) * 0.35) * 0.5 + 0.5;
          col = mix(dark, base, Math.min(1, n * 1.3));
          col = mix(col, lite, strata * 0.25 * m);
          if (Math.abs(n2(u * 1.5, v * 1.5, 4) - 0.5) < 0.018) col = mix(col, dark, 0.7);
          break;
        }
        case 'brick': {
          const bh = 8;
          const bw = 16;
          const row = Math.floor(wy / bh);
          const bx = wx + (row % 2) * (bw / 2);
          const inX = bx % bw;
          const inY = wy % bh;
          const id = hash2(Math.floor(bx / bw), row, th.seed);
          const mortar = inX < 1.1 || inY < 1.1;
          col = mortar ? mix(dark, base, 0.25) : mix(base, id > 0.5 ? lite : dark, Math.abs(id - 0.5) * 0.5 + n * 0.25);
          if (!mortar && inY < 2.2) col = mix(col, lite, 0.25);
          if (!mortar && inY > bh - 2) col = mix(col, dark, 0.25);
          break;
        }
        case 'metal': {
          const P = 32;
          const ix = wx % P;
          const iy = wy % P;
          col = mix(base, lite, n * 0.25);
          if (ix < 1.2 || iy < 1.2) col = mix(col, dark, 0.7);
          else if (ix < 2.4 || iy < 2.4) col = mix(col, lite, 0.35);
          else if (ix > P - 2.4 || iy > P - 2.4) col = mix(col, dark, 0.35);
          const rv = (Math.abs(ix - 5) < 1.4 && Math.abs(iy - 5) < 1.4) || (Math.abs(ix - P + 5) < 1.4 && Math.abs(iy - 5) < 1.4) || (Math.abs(ix - 5) < 1.4 && Math.abs(iy - P + 5) < 1.4) || (Math.abs(ix - P + 5) < 1.4 && Math.abs(iy - P + 5) < 1.4);
          if (rv) col = mix(lite, dark, (ix % 1) * 0.5);
          if (Math.abs(Math.sin(wx * 0.9 + wy * 0.25 + n * 8)) > 0.995) col = mix(col, lite, 0.4);
          if (m > 0.62) col = mix(col, [0.45, 0.22, 0.1], (m - 0.62) * 1.6);
          break;
        }
        case 'crystal': {
          col = mix(dark, base, n);
          const ridge = 1 - Math.abs(n2(u, v, 4) * 2 - 1);
          if (ridge > 0.93) veinMask[py * S + px] = (ridge - 0.93) / 0.07;
          col = mix(col, lite, Math.max(0, ridge - 0.8) * 2);
          break;
        }
        case 'organic': {
          col = mix(dark, base, n * 1.2);
          const root = Math.abs(Math.sin(wx * 0.12 + n * 9) * Math.cos(wy * 0.05 + m * 4));
          if (root < 0.04) col = mix(col, lite, 0.45);
          if (hash2(Math.floor(wx / 3), Math.floor(wy / 3), th.seed) > 0.985) col = mix(col, lite, 0.6);
          break;
        }
        case 'sand': {
          const rip = Math.sin(wy * 0.6 + Math.sin(wx * 0.08) * 3 + n * 4) * 0.5 + 0.5;
          col = mix(base, lite, rip * 0.35 + n * 0.2);
          if (hash2(px, py, th.seed) > 0.97) col = mix(col, dark, 0.4);
          break;
        }
      }
      if (T.veins && T.kind !== 'crystal') {
        const ridge = 1 - Math.abs(n2(u * 0.5 + 3, v * 0.5, 4) * 2 - 1);
        if (ridge > 0.965) veinMask[py * S + px] = (ridge - 0.965) / 0.035;
      }
      const grain = (hash2(px, py, 7) - 0.5) * 0.05;
      const i = (py * S + px) * 4;
      img.data[i] = Math.max(0, Math.min(255, (col[0] + grain) * 255));
      img.data[i + 1] = Math.max(0, Math.min(255, (col[1] + grain) * 255));
      img.data[i + 2] = Math.max(0, Math.min(255, (col[2] + grain) * 255));
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  let vc: HTMLCanvasElement | null = null;
  if (T.veins) {
    vc = document.createElement('canvas');
    vc.width = vc.height = S;
    const vg = vc.getContext('2d')!;
    const vi = vg.createImageData(S, S);
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
  return [c, vc];
}
