import { css, type HSL, hsl3, mixHsl, shift } from '../core/color';
import { hash2, Rng } from '../core/rng';
import type { SkyLayer, Theme } from '../gen/theme';
import { VIEW_H, VIEW_W } from '../sim/constants';
import type { Camera } from './camera';
import type { ViewFrame } from './frame';
import { circle, ellipse, flame, flutter, glowDot, light, type RC } from './kit';
import { type Feature, SKYLINES } from './skylines';

/**
 * Sky, horizon glow, celestial body, god rays, clouds, parallax skylines
 * (baked once per theme, with emissive windows/lava and a handful of animated
 * features), the liquid pool at the bottom, and ambient particles.
 *
 * Everything fills the window, not just the play view: layers are baked to
 * the window's shape (so they never stretch) and rebaked if it changes.
 *
 * Perf: everything heavy is baked into canvases when the theme changes; per
 * frame we draw ~10 images plus a few dozen small animated shapes.
 */

const PAD = 0.18; // extra width baked on each side for parallax travel

interface BakedLayer {
  c: HTMLCanvasElement;
  glow: HTMLCanvasElement | null;
  depth: number;
  haze: number;
  feats: Feature[];
}

interface Baked {
  key: string;
  layers: BakedLayer[];
  clouds: { c: HTMLCanvasElement; x: number; y: number; speed: number; w: number; h: number; depth: number }[];
  stars: { x: number; y: number; r: number; tw: number }[];
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  seed: number;
}

export class Backdrop {
  private baked: Baked | null = null;
  private motes: Mote[] = [];

  private ensure(th: Theme, kb: number, f: ViewFrame) {
    const key = `${th.seed}:${th.id}:${th.name}:${kb.toFixed(2)}:${f.w.toFixed(0)}x${f.h.toFixed(0)}`;
    if (this.baked?.key === key) return;
    const rng = new Rng(th.seed ^ 0xbac);
    const W = f.w * (1 + PAD * 2);
    // Layers run on down past the play view on a tall window, ground and all.
    const H = Math.max(VIEW_H, f.y1);
    const layers = th.layers.map((L, i) => bakeLayer(L, th, W, H, kb, i === 0 ? 1.1 : i === th.layers.length - 1 ? 0 : 0.5));
    const clouds = Array.from({ length: th.clouds }, () => {
      const wide = th.cloudStyle !== 'puffy';
      const w = wide ? rng.range(160, 320) : rng.range(70, 170);
      const h = w * (wide ? rng.range(0.12, 0.22) : rng.range(0.32, 0.45));
      return {
        c: bakeCloud(rng, w, h, th, kb),
        x: rng.range(f.x0 - 100, f.x1),
        y: rng.range(Math.min(6, f.y0 + 6), VIEW_H * 0.42),
        speed: rng.range(2, 8),
        w,
        h,
        depth: rng.range(0.03, 0.14),
      };
    });
    // A wider or taller window gets more sky, at the same density of stars.
    const starCount = Math.round((th.stars * f.w * (VIEW_H * 0.65 - f.y0)) / (VIEW_W * VIEW_H * 0.65));
    const stars = Array.from({ length: starCount }, () => ({
      x: rng.range(f.x0, f.x1),
      y: rng.range(f.y0, VIEW_H * 0.65),
      r: rng.range(0.4, 1.4),
      tw: rng.range(0.5, 3),
    }));
    this.baked = { key, layers, clouds, stars };
    this.motes = [];
  }

  /** Background in screen space (camera only drives parallax). */
  draw(rc: RC, th: Theme, cam: Camera, kb: number) {
    const f = cam.frame;
    this.ensure(th, kb, f);
    const b = this.baked!;
    const s = rc.s;
    const t = rc.t;
    // Parallax from the camera's offset within the level. Classic levels keep
    // the original travel; big levels compress it so the baked layers (PAD
    // wide each side) never run out. Vertical offsets are measured from the
    // bottom-most camera position, so climbing a tall level sinks the skyline.
    const MAX_D = 0.4;
    const halfX = Math.max(1, cam.ww / 2 - VIEW_W / (2 * 1.45));
    const kx = Math.min(1, (VIEW_W * PAD * 0.9) / (MAX_D * halfX));
    const refY = cam.wh - VIEW_H / 2;
    const spanY = Math.max(1, refY - VIEW_H / (2 * 1.45));
    const ky = Math.min(1, (VIEW_H * 0.45) / (MAX_D * 0.6 * spanY));
    const px = (depth: number) => -(cam.x - cam.ww / 2) * depth * kx;
    const py = (depth: number) => -(cam.y - refY) * depth * 0.6 * ky;

    const sky = s.createLinearGradient(0, f.y0, 0, f.y1);
    sky.addColorStop(0, css(th.skyTop));
    sky.addColorStop(0.55, css(th.skyMid));
    sky.addColorStop(1, css(th.skyBottom));
    s.fillStyle = sky;
    s.fillRect(f.x0 - 40, f.y0 - 40, f.w + 80, f.h + 80);

    // Horizon glow band.
    if (th.horizon.strength > 0) {
      const hy = th.horizon.y * VIEW_H + py(0.05);
      const hz = s.createLinearGradient(0, hy - VIEW_H * 0.35, 0, hy + VIEW_H * 0.2);
      hz.addColorStop(0, css(th.horizon.color, 0, 0));
      hz.addColorStop(0.65, css(th.horizon.color, 0, th.horizon.strength * 0.55));
      hz.addColorStop(1, css(th.horizon.color, 0, th.horizon.strength * 0.25));
      s.fillStyle = hz;
      s.fillRect(f.x0 - 40, hy - VIEW_H * 0.35, f.w + 80, VIEW_H * 0.55);
    }

    for (const st of b.stars) {
      const a = 0.4 + 0.6 * Math.abs(Math.sin(t * st.tw + st.x));
      rc.g.fillStyle = `rgba(255,255,255,${a * 0.9})`;
      rc.g.fillRect(st.x + px(0.02), st.y + py(0.02), st.r, st.r);
    }

    this.drawCelestial(rc, th, px(0.04), py(0.04));
    if (th.rays) this.drawRays(rc, th, px(0.04), py(0.04));

    for (const cl of b.clouds) {
      const span = f.w + cl.w * 2;
      const x = f.x0 + ((((cl.x - f.x0 + t * cl.speed + px(cl.depth)) % span) + span) % span) - cl.w;
      s.drawImage(cl.c, x, cl.y + py(cl.depth), cl.w, cl.h);
    }

    b.layers.forEach((L, i) => {
      const x = f.x0 - f.w * PAD + px(L.depth);
      const y = py(L.depth);
      const lw = f.w * (1 + PAD * 2);
      const lh = Math.max(VIEW_H, f.y1);
      s.drawImage(L.c, x, y, lw, lh);
      if (L.glow) {
        rc.g.globalAlpha = (0.85 + 0.15 * Math.sin(t * 0.7 + i)) * Math.max(0.25, 1 - L.haze * 1.3);
        rc.g.drawImage(L.glow, x, y, lw, lh);
        rc.g.globalAlpha = 1;
      }
      for (const ft of L.feats) drawFeature(rc, ft, x, y, L.haze, th, f);
    });
  }

  private drawCelestial(rc: RC, th: Theme, ox: number, oy: number) {
    const c = th.celestial;
    if (c.kind === 'none') return;
    const x = c.x * VIEW_W + ox;
    const y = c.y * VIEW_H + oy;
    const s = rc.s;
    const g = rc.g;
    switch (c.kind) {
      case 'sun':
        glowDot(g, x, y, c.r * (th.mood === 'day' ? 4.5 : 7), c.glow, th.mood === 'day' ? 0.22 : 0.35, 0.08);
        glowDot(g, x, y, c.r * 2, c.glow, 0.7, 0.4);
        g.fillStyle = css(c.color, 10);
        circle(g, x, y, c.r);
        break;
      case 'moon': {
        glowDot(g, x, y, c.r * 5, c.glow, 0.18, 0.1);
        s.fillStyle = css(c.color);
        circle(s, x, y, c.r);
        g.fillStyle = css(c.color, -10, 0.55);
        circle(g, x, y, c.r);
        const rng = new Rng(th.seed ^ 0x300);
        s.fillStyle = css(c.color, -18, 0.6);
        for (let i = 0; i < 6; i++) {
          const a = rng.range(0, 6.28);
          const d = rng.range(0, c.r * 0.7);
          circle(s, x + Math.cos(a) * d, y + Math.sin(a) * d, rng.range(c.r * 0.08, c.r * 0.22));
        }
        s.fillStyle = 'rgba(0,0,10,0.35)';
        s.beginPath();
        s.arc(x, y, c.r, -Math.PI / 2, Math.PI / 2);
        s.ellipse(x, y, c.r * 0.45, c.r, 0, Math.PI / 2, -Math.PI / 2, true);
        s.fill();
        break;
      }
      case 'planet': {
        glowDot(g, x, y, c.r * 2.4, c.glow, 0.2, 0.3);
        s.fillStyle = css(c.color);
        circle(s, x, y, c.r);
        break;
      }
      case 'eclipse':
        glowDot(g, x, y, c.r * 6, c.glow, 0.35, 0.15);
        glowDot(g, x, y, c.r * 1.6, c.glow, 0.95, 0.6);
        g.fillStyle = '#000';
        g.globalCompositeOperation = 'destination-out';
        circle(g, x, y, c.r * 0.97);
        g.globalCompositeOperation = 'lighter';
        s.fillStyle = '#050508';
        circle(s, x, y, c.r);
        break;
    }
    light(rc, x, y, 260, c.glow, c.kind === 'sun' ? 0.45 : 0.25);
  }

  private drawRays(rc: RC, th: Theme, ox: number, oy: number) {
    const c = th.celestial;
    const none = c.kind === 'none';
    const x = none ? VIEW_W * (0.3 + (th.seed % 40) / 100) : c.x * VIEW_W + ox;
    const y = none ? -40 : c.y * VIEW_H + oy;
    const col = none ? th.lamp : c.glow;
    const g = rc.g;
    for (let i = 0; i < 7; i++) {
      const a = Math.PI / 2 + (i - 3) * (none ? 0.12 : 0.24) + Math.sin(rc.t * 0.13 + i * 1.7) * 0.06 + (x - VIEW_W / 2) * -0.0009;
      const len = VIEW_H * 1.6;
      const w = 0.04 + hash2(i, 3, th.seed) * 0.05;
      const al = (0.04 + 0.03 * Math.sin(rc.t * 0.4 + i * 2.1)) * (th.night ? 0.6 : 0.7);
      const gr = g.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
      gr.addColorStop(0, css(col, 10, al));
      gr.addColorStop(1, css(col, 0, 0));
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a - w) * len, y + Math.sin(a - w) * len);
      g.lineTo(x + Math.cos(a + w) * len, y + Math.sin(a + w) * len);
      g.fill();
    }
  }

  /**
   * Liquid pool along the bottom of the world (drawn in world space, in front
   * of terrain). `ww`×`wh` is the world size; only the visible stretch (`view`)
   * is drawn. The pool isn't the world's: it carries on `margin` px past either
   * edge with the surroundings, and deepens below the world to the window's edge.
   */
  drawLiquid(rc: RC, th: Theme, ww: number, wh: number, view: { x: number; y: number; w: number; h: number }, margin = 0) {
    const L = th.liquid;
    const s = rc.s;
    const g = rc.g;
    const t = rc.t;
    const kind = L.kind;
    const xa = Math.floor((view.x - 20) / 6) * 6;
    const xb = view.x + view.w + 20;
    // Scattered details run over the pool's whole length, not just the world's.
    const reach = ww + margin * 2;
    const spots = Math.ceil(reach / VIEW_W);
    const below = Math.max(wh + 20, view.y + view.h + 40);
    const y0 = wh - (kind === 'sea' ? 11 : 9);
    const amp = kind === 'sea' ? 1.8 : kind === 'swamp' || kind === 'tar' ? 0.5 : kind === 'street' ? 0 : 1;
    const wave = (x: number) => y0 + (Math.sin(x * 0.045 + t * 1.6) * 1.6 + Math.sin(x * 0.11 - t * 2.4) * 0.9 + Math.sin(x * 0.023 + t * 0.6) * 1.2) * amp;
    const path = new Path2D();
    path.moveTo(xa, below);
    for (let x = xa; x <= xb + 6; x += 6) path.lineTo(x, wave(x));
    path.lineTo(xb + 6, below);
    path.closePath();
    // Heat haze / glow above emissive liquids.
    if (L.emissive) {
      const hz = g.createLinearGradient(0, y0 - 70, 0, y0);
      hz.addColorStop(0, css(L.glow, 0, 0));
      hz.addColorStop(1, css(L.glow, 0, (kind === 'street' ? 0.3 : 0.22) + Math.sin(t * 1.3) * 0.04));
      g.fillStyle = hz;
      g.fillRect(xa, y0 - 70, xb - xa + 6, 72);
    }
    const gr = s.createLinearGradient(0, y0 - 3, 0, wh);
    gr.addColorStop(0, css(L.color, kind === 'tar' ? 8 : 15));
    gr.addColorStop(1, css(L.color, -20));
    s.fillStyle = gr;
    s.fill(path);
    if (below > wh + 20) {
      // Below the world the pool falls away into its own depth, lit from within if it glows.
      const dp = s.createLinearGradient(0, wh, 0, below);
      dp.addColorStop(0, css(L.color, -20, 0));
      dp.addColorStop(1, css(L.color, -52, 0.95));
      s.fillStyle = dp;
      s.fillRect(xa, wh, xb - xa + 6, below - wh);
      if (L.emissive) {
        const hg = g.createLinearGradient(0, wh - 10, 0, below);
        hg.addColorStop(0, css(L.glow, 0, 0.5));
        hg.addColorStop(1, css(L.glow, -15, 0.04));
        g.fillStyle = hg;
        g.fillRect(xa, wh - 10, xb - xa + 6, below - wh + 10);
      }
    }
    switch (kind) {
      case 'slag':
      case 'lava':
      case 'acid':
      case 'void': {
        g.globalAlpha = kind === 'lava' ? 0.9 : 0.75;
        g.fillStyle = gr;
        g.fill(path);
        g.globalAlpha = 1;
        // Crust patches drifting on the surface.
        s.fillStyle = css(L.color, kind === 'acid' ? -18 : -30, 0.55);
        for (let i = 0; i < 14 * spots; i++) {
          const cx = ((i * 97.3 + t * (6 + (i % 3) * 3)) % (reach + 60)) - 30 - margin;
          ellipse(s, cx, wave(cx) + 4.5, 9 + (i % 4) * 4, 1.6);
        }
        if (kind === 'acid' || kind === 'lava') {
          for (let i = 0; i < 8 * spots; i++) {
            const p = (t * 0.7 + i * 0.37) % 1;
            const bx = ((i * 131.7 + Math.floor(t * 0.7 + i * 0.37) * 53) % reach) - margin;
            g.fillStyle = css(L.glow, 15, 0.6 * (1 - p));
            circle(g, bx, wave(bx) + 2 - p * 3, 0.8 + p * 1.6);
          }
        }
        for (let x = 32 + Math.floor((view.x - 100) / 72) * 72; x < view.x + view.w + 100; x += 72)
          light(rc, x, y0 + 4, 90, L.glow, 0.5 + Math.sin(t * 2 + x) * 0.08);
        break;
      }
      case 'street': {
        // A street far below: dark void with streaking car lights.
        for (let i = 0; i < 10 * spots; i++) {
          const dir = i % 2 ? 1 : -1;
          const sp = 60 + (i % 3) * 25;
          const cx = ((((i * 173 + t * sp * dir) % (reach + 80)) + reach + 80) % (reach + 80)) - 40 - margin;
          const cy = wh - 3 + (i % 2) * 1.5;
          const col = dir > 0 ? hsl3(45, 90, 75) : hsl3(0, 100, 55);
          const lg = g.createLinearGradient(cx - dir * 22, 0, cx, 0);
          lg.addColorStop(0, css(col, 0, 0));
          lg.addColorStop(1, css(col, 10, 0.8));
          g.fillStyle = lg;
          g.fillRect(Math.min(cx, cx - dir * 22), cy, 22, 1.2);
        }
        for (let x = 40 - margin; x < ww + margin; x += 110) if (x > view.x - 100 && x < view.x + view.w + 100) light(rc, x, wh, 90, L.glow, 0.5);
        break;
      }
      case 'water':
      case 'sea':
      case 'swamp': {
        // Reflections: drifting glints and darker ripple bands.
        for (let i = 0; i < 16 * spots; i++) {
          const gx = ((((i * 61.7 + t * (kind === 'sea' ? 14 : 5) * (i % 2 ? 1 : -1)) % (reach + 40)) + reach + 40) % (reach + 40)) - 20 - margin;
          const gy = wave(gx) + 2.5 + (i % 3) * 2;
          const a = 0.25 + 0.25 * Math.sin(t * 2 + i);
          s.fillStyle = css(L.glow, 10, a * (kind === 'swamp' ? 0.4 : 1));
          s.fillRect(gx, gy, 4 + (i % 4) * 2, 0.7);
        }
        if (kind === 'swamp') {
          const rr = new Rng(th.seed ^ 0x1e1);
          for (let i = 0; i < 9 * spots; i++) {
            const lx = rr.range(-margin, ww + margin);
            const ly = wave(lx) + 1;
            s.fillStyle = css(hsl3(105, 45, 30), 0, 0.95);
            s.beginPath();
            s.ellipse(lx, ly, rr.range(3, 5), 1.2, 0, 0.3, Math.PI * 2);
            s.lineTo(lx, ly);
            s.fill();
            if (rr.chance(0.3)) {
              s.fillStyle = css(hsl3(330, 70, 75));
              circle(s, lx + 1, ly - 0.8, 0.9);
            }
          }
        }
        if (kind === 'sea') {
          // Foam crests.
          s.strokeStyle = 'rgba(240,250,255,0.7)';
          s.lineWidth = 1;
          s.beginPath();
          for (let x = xa; x <= xb; x += 6) {
            const crest = Math.sin(x * 0.045 + t * 1.6);
            if (crest > 0.55) {
              s.moveTo(x, wave(x) + 0.3);
              s.lineTo(x + 5, wave(x + 5) + 0.3);
            }
          }
          s.stroke();
        }
        break;
      }
      case 'tar': {
        for (let i = 0; i < 6 * spots; i++) {
          const p = (t * 0.25 + i * 0.29) % 1;
          const bx = ((i * 151.3 + Math.floor(t * 0.25 + i * 0.29) * 71) % reach) - margin;
          s.strokeStyle = `rgba(150,140,170,${0.5 * (1 - p)})`;
          s.lineWidth = 0.6;
          s.beginPath();
          s.arc(bx, wave(bx) + 1, 1 + p * 3, Math.PI, 0);
          s.stroke();
        }
        break;
      }
    }
    // Bright surface line.
    if (kind !== 'street') {
      g.lineWidth = 1.4;
      g.strokeStyle = css(L.glow, 15, L.emissive ? 0.9 : 0.4);
      g.beginPath();
      for (let x = xa; x <= xb + 6; x += 6) (x === xa ? g.moveTo : g.lineTo).call(g, x, wave(x));
      g.stroke();
    }
  }

  /** Ambient particles (cosmetic, non-deterministic). On the background layer: with ink they read as stray projectiles. */
  drawMotes(rc: RC, th: Theme, dt: number, view: { x: number; y: number; w: number; h: number }) {
    const kind = th.ambient;
    // Motes live in world space around the visible rect; zoomed-out views get proportionally more (capped).
    // Nothing here falls or blows: what comes down the screen is weather (./weather.ts), and that always does something.
    const area = Math.max(1, Math.min(2.5, (view.w * view.h) / (VIEW_W * VIEW_H)));
    const target = Math.round((kind === 'dust' ? 50 : 60) * area);
    const vx0 = view.x;
    const vy0 = view.y;
    while (this.motes.length < target) {
      const fromBottom = kind === 'embers' || kind === 'bubbles';
      this.motes.push({
        x: vx0 + Math.random() * (view.w + 60) - 30,
        y: vy0 + (fromBottom ? view.h + Math.random() * 20 : Math.random() * view.h),
        vx: (Math.random() - 0.5) * 10,
        vy: kind === 'embers' ? -(15 + Math.random() * 30) : kind === 'bubbles' ? -(8 + Math.random() * 10) : (Math.random() - 0.5) * 6,
        life: 4 + Math.random() * 10,
        seed: Math.random() * 100,
      });
    }
    const t = rc.t;
    const col: HSL =
      kind === 'embers'
        ? th.liquid.emissive
          ? th.liquid.glow
          : th.lamp
        : kind === 'fireflies'
          ? hsl3(70, 100, 65)
          : kind === 'spores'
            ? shift(th.accent, 10)
            : kind === 'pollen'
              ? hsl3(50, 90, 75)
              : th.fog;
    this.motes = this.motes.filter((m) => {
      m.life -= dt;
      m.x += (m.vx + Math.sin(t * 0.8 + m.seed) * 8) * dt;
      m.y += m.vy * dt;
      if (m.life <= 0 || m.y < vy0 - 10 || m.y > vy0 + view.h + 25 || m.x < vx0 - 40 || m.x > vx0 + view.w + 40) return false;
      const fade = Math.min(1, m.life);
      switch (kind) {
        case 'embers': {
          const a = fade * (0.6 + 0.4 * Math.sin(t * 9 + m.seed));
          rc.g.fillStyle = css(col, 15, a);
          rc.g.fillRect(m.x, m.y, 1.4, 1.4);
          break;
        }
        case 'fireflies': {
          const a = fade * Math.max(0, Math.sin(t * 1.7 + m.seed));
          glowDot(rc.g, m.x, m.y, 4, col, a * 0.8);
          if (a > 0.6) light(rc, m.x, m.y, 26, col, a * 0.4);
          break;
        }
        case 'pollen':
          rc.g.fillStyle = css(col, 0, 0.5 * fade * (0.5 + 0.5 * Math.sin(t * 2 + m.seed)));
          circle(rc.g, m.x, m.y, 0.8);
          break;
        case 'spores':
          rc.g.fillStyle = css(col, 0, 0.45 * fade);
          circle(rc.g, m.x, m.y, 1);
          break;
        case 'dust':
          rc.bg.fillStyle = css(mixHsl(th.fog, hsl3(45, 60, 95), 0.6), 0, 0.3 * fade);
          rc.bg.fillRect(m.x, m.y, 1, 1);
          break;
        case 'bubbles':
          rc.bg.strokeStyle = `rgba(220,255,255,${0.5 * fade})`;
          rc.bg.lineWidth = 0.6;
          rc.bg.beginPath();
          rc.bg.arc(m.x, m.y, 1.4 + (m.seed % 1.5), 0, Math.PI * 2);
          rc.bg.stroke();
          break;
      }
      return true;
    });
  }
}

/** Animated skyline feature, drawn at the layer's current parallax offset. */
function drawFeature(rc: RC, f: Feature, ox: number, oy: number, haze: number, th: Theme, frame: ViewFrame) {
  const x = ox + f.x;
  const y = oy + f.y;
  if (x < frame.x0 - 60 || x > frame.x1 + 60) return;
  const s = rc.s;
  const g = rc.g;
  const t = rc.t + f.phase;
  const fade = 1 - haze * 0.6;
  switch (f.kind) {
    case 'smoke':
    case 'steam': {
      const n = f.kind === 'smoke' ? 7 : 4;
      for (let i = 0; i < n; i++) {
        const p = (t * (f.kind === 'smoke' ? 0.12 : 0.3) + i / n) % 1;
        const r = (2 + p * 10) * f.s * (f.kind === 'smoke' ? 1.6 : 0.8);
        s.fillStyle = css(f.color, -p * 10, (f.kind === 'smoke' ? 0.42 : 0.28) * (1 - p) * Math.min(1, p * 8));
        circle(s, x + p * 26 * f.s + Math.sin(p * 4 + f.phase) * 3, y - p * 60 * f.s - 2, r);
      }
      break;
    }
    case 'windmill': {
      const a0 = t * 0.9;
      s.strokeStyle = css(f.color, -20);
      s.fillStyle = css(f.color, 0, 0.9);
      s.lineWidth = 0.9;
      for (let i = 0; i < 4; i++) {
        const a = a0 + (i * Math.PI) / 2;
        const ex = x + Math.cos(a) * f.s;
        const ey = y + Math.sin(a) * f.s;
        s.beginPath();
        s.moveTo(x, y);
        s.lineTo(ex, ey);
        s.stroke();
        const nx = -Math.sin(a) * 2.6;
        const ny = Math.cos(a) * 2.6;
        s.beginPath();
        s.moveTo(x + Math.cos(a) * f.s * 0.25, y + Math.sin(a) * f.s * 0.25);
        s.lineTo(ex, ey);
        s.lineTo(ex + nx, ey + ny);
        s.lineTo(x + Math.cos(a) * f.s * 0.25 + nx, y + Math.sin(a) * f.s * 0.25 + ny);
        s.fill();
      }
      s.fillStyle = css(f.color, -25);
      circle(s, x, y, 1.6);
      break;
    }
    case 'beam': {
      // Lighthouse: a slow sweep; brightest when pointing at the viewer.
      const a = t * 0.9;
      const face = Math.cos(a);
      const len = VIEW_W * 0.75;
      const spread = 0.07;
      const dir = Math.sin(a) >= 0 ? 1 : -1;
      const reach = Math.abs(Math.sin(a));
      const strength = (th.night ? 0.32 : 0.14) * (0.35 + 0.65 * reach) * fade;
      const ex = x + dir * len * reach;
      const gr = g.createLinearGradient(x, y, ex, y);
      gr.addColorStop(0, css(f.color, 15, strength));
      gr.addColorStop(1, css(f.color, 0, 0));
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(ex, y - len * spread * reach);
      g.lineTo(ex, y + len * spread * reach * 0.8);
      g.fill();
      glowDot(g, x, y, 10 + Math.max(0, face) * 26, f.color, (0.5 + Math.max(0, face) * 0.5) * fade);
      break;
    }
    case 'blink': {
      const on = (t * 0.7) % 1 < 0.25 ? 1 : 0.15;
      glowDot(g, x, y, 5, f.color, on * fade);
      break;
    }
    case 'flicker': {
      const fl = Math.sin(t * 23) > 0.97 || t % 9 < 0.1 ? 0.3 : 0.85 + Math.sin(t * 7) * 0.08;
      const w = f.w ?? 3;
      const h = f.h ?? 3;
      g.fillStyle = css(f.color, 12, fl * fade);
      g.fillRect(x - w / 2, y - h / 2, w, h);
      glowDot(g, x, y, Math.max(w, h) * 1.1 + 6, f.color, 0.18 * fl * fade);
      break;
    }
    case 'torch': {
      const fl = 0.8 + Math.sin(t * 17) * 0.12 + Math.sin(t * 29) * 0.08;
      flame(g, x, y, 1.6 * fl, 4 * fl, f.color, t);
      glowDot(g, x, y - 1, 14 * fl, f.color, 0.35 * fade);
      break;
    }
    case 'flare': {
      const fl = 0.8 + Math.sin(t * 11) * 0.15;
      flame(g, x, y, 2.4 * fl, 9 * fl, f.color, t);
      glowDot(g, x, y - 3, 22 * fl, f.color, 0.4 * fade);
      break;
    }
    case 'plume': {
      // Volcanic ash column + pulsing crater glow.
      for (let i = 0; i < 10; i++) {
        const p = (t * 0.035 + i / 10) % 1;
        const r = (6 + p * 34) * f.s;
        s.fillStyle = css(f.color, -4 - p * 6, 0.55 * (1 - p) * Math.min(1, p * 6));
        circle(s, x + p * 70 * f.s + Math.sin(p * 5 + i) * 6, y - p * 150 * f.s - 4, r);
      }
      const pulse = 0.6 + 0.4 * Math.sin(t * 1.3);
      glowDot(g, x, y + 2, 40 * f.s, th.liquid.glow, 0.45 * pulse * fade);
      break;
    }
    case 'flag': {
      s.fillStyle = css(f.color, 6);
      s.beginPath();
      s.moveTo(x, y);
      for (let i = 0; i <= 4; i++) s.lineTo(x + i * 2 * f.s, y + flutter(rc, 5, -i) * (i / 4));
      for (let i = 4; i >= 0; i--) s.lineTo(x + i * 2 * f.s, y + 3 * f.s + flutter(rc, 5, -i) * (i / 4));
      s.fill();
      break;
    }
    case 'glint': {
      // Glitter path on water under the sun/moon.
      const h = f.h ?? 80;
      for (let i = 0; i < 26; i++) {
        const k = hash2(i, 7, 3);
        const yy = y + 2 + k * k * h;
        const spread = 6 + (yy - y) * 0.35;
        const xx = x + (hash2(i, Math.floor(t * 2 + i), 9) - 0.5) * spread * 2;
        const a = (0.35 + 0.65 * Math.abs(Math.sin(t * 3 + i * 1.7))) * 0.7 * f.s;
        g.fillStyle = css(f.color, 15, a);
        g.fillRect(xx, yy, 3 + k * 8, 0.8);
      }
      break;
    }
  }
}

function bakeLayer(L: SkyLayer, th: Theme, W: number, H: number, kb: number, blur: number): BakedLayer {
  const def = SKYLINES[L.kind];
  const c = document.createElement('canvas');
  c.width = Math.ceil(W * kb);
  c.height = Math.ceil(H * kb);
  const g = c.getContext('2d')!;
  g.scale(kb, kb);
  let glowC: HTMLCanvasElement | null = null;
  let e: CanvasRenderingContext2D | null = null;
  if (def.glow) {
    glowC = document.createElement('canvas');
    glowC.width = c.width;
    glowC.height = c.height;
    e = glowC.getContext('2d')!;
    e.scale(kb, kb);
  }
  // The silhouette keeps its place in the view however tall the layer is; only what's under it runs on.
  const ridge = (x: number) => {
    const u = x / VIEW_W;
    let h = L.base;
    L.freqs.forEach((f, i) => (h += Math.sin(u * f * Math.PI * 2 + L.phases[i]) * L.amp * (1 / (i + 1))));
    return h * VIEW_H;
  };
  const feats: Feature[] = [];
  def.bake({ g, e, L, th, W, H, rng: new Rng(L.seed), feats, ridge });
  // Atmospheric perspective: tint toward the fog, more so near the ground.
  if (L.haze > 0) {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    const hz = g.createLinearGradient(0, 0, 0, c.height);
    hz.addColorStop(0, css(th.fog, 0, Math.min(1, L.haze * 0.8)));
    hz.addColorStop(1, css(th.fog, 0, Math.min(1, L.haze * 1.15)));
    g.fillStyle = hz;
    g.fillRect(0, 0, c.width, c.height);
    g.restore();
  }
  // Depth of field: soften farther layers.
  if (blur > 0.2) {
    const blurred = (src: HTMLCanvasElement, r: number) => {
      const b = document.createElement('canvas');
      b.width = src.width;
      b.height = src.height;
      const bg = b.getContext('2d')!;
      bg.filter = `blur(${(r * kb).toFixed(1)}px)`;
      bg.drawImage(src, 0, 0);
      return b;
    };
    return { c: blurred(c, blur), glow: glowC ? blurred(glowC, blur * 0.6) : null, depth: L.depth, haze: L.haze, feats };
  }
  return { c, glow: glowC, depth: L.depth, haze: L.haze, feats };
}

function bakeCloud(rng: Rng, w: number, h: number, th: Theme, kb: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * kb);
  c.height = Math.ceil(h * kb);
  const g = c.getContext('2d')!;
  g.scale(kb, kb);
  const base = th.cloudColor;
  const under = mixHsl(base, th.horizon.color, 0.35);
  switch (th.cloudStyle) {
    case 'puffy': {
      const puffs = rng.int(5, 9);
      const dark = false;
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < puffs; i++) {
          const px = w * (0.15 + 0.7 * (i / (puffs - 1)));
          const r = h * rng.range(0.25, 0.45) * (1 - Math.abs(i / (puffs - 1) - 0.5));
          const py = Math.max(r * 1.1 + 1, h * 0.62 - r * 0.6); // Never over the top of the canvas.
          const gr = g.createRadialGradient(px - r * 0.3, py - r * 0.4, r * 0.1, px, py + r * 0.3, r * 1.1);
          gr.addColorStop(0, css(base, pass ? (dark ? 6 : 10) : 2, 0.97));
          gr.addColorStop(1, css(under, pass ? -6 : -14, 0.95));
          g.fillStyle = gr;
          circle(g, px, py + (pass ? 0 : 2), r * (pass ? 0.95 : 1.05) + 2);
        }
      }
      // Flat-ish base.
      g.globalCompositeOperation = 'destination-out';
      g.fillRect(0, h * 0.86, w, h);
      g.globalCompositeOperation = 'source-over';
      break;
    }
    case 'wispy':
    case 'ash': {
      const n = th.cloudStyle === 'ash' ? 10 : 7;
      const a = th.cloudStyle === 'ash' ? 0.6 : 0.55;
      for (let i = 0; i < n; i++) {
        const cx = rng.range(w * 0.15, w * 0.85);
        const cy = rng.range(h * 0.3, h * 0.7);
        // Radii stop at the canvas edge, or the bake would clip the puff to a hard line.
        const rx = Math.min(rng.range(w * 0.15, w * 0.4), cx, w - cx);
        const ry = Math.min(rng.range(h * 0.2, h * 0.45), cy * 0.75, (h - cy) * 0.75);
        const gr = g.createRadialGradient(cx, cy - ry * 0.3, 0, cx, cy, rx);
        gr.addColorStop(0, css(base, 6, a));
        gr.addColorStop(0.6, css(under, -2, a * 0.6));
        gr.addColorStop(1, css(under, -4, 0));
        g.fillStyle = gr;
        g.save();
        g.translate(cx, cy);
        g.scale(1, ry / rx);
        g.translate(-cx, -cy);
        circle(g, cx, cy, rx);
        g.restore();
      }
      break;
    }
  }
  return c;
}
