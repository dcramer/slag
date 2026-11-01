import { css, shift, type HSL } from '../core/color';
import { hash2, Rng } from '../core/rng';
import type { SkyLayer, Theme } from '../gen/theme';
import { VIEW_H, VIEW_W } from '../sim/constants';
import { circle, glowDot, light, type RC } from './kit';
import type { Camera } from './camera';

/**
 * Sky, celestial body, god rays, clouds, parallax silhouettes (with emissive
 * windows/crystal edges), the liquid pool at the bottom, and ambient motes.
 */

const PAD = 0.18; // extra width baked on each side for parallax travel

interface Baked {
  key: string;
  layers: { c: HTMLCanvasElement; glow: HTMLCanvasElement | null; depth: number }[];
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

  private ensure(th: Theme, kb: number) {
    const key = `${th.seed}:${th.name}:${kb.toFixed(2)}`;
    if (this.baked?.key === key) return;
    const rng = new Rng(th.seed ^ 0xbac);
    const W = VIEW_W * (1 + PAD * 2);
    const layers = th.layers.map((L, i) => bakeLayer(L, th, W, kb, (th.layers.length - 1 - i) * 0.9 + 0.4));
    const clouds = Array.from({ length: th.clouds }, () => {
      const w = rng.range(70, 180);
      const h = w * rng.range(0.3, 0.45);
      return { c: bakeCloud(rng, w, h, th, kb), x: rng.range(-100, VIEW_W), y: rng.range(10, VIEW_H * 0.45), speed: rng.range(2, 8), w, h, depth: rng.range(0.05, 0.25) };
    });
    const stars = th.night ? Array.from({ length: 140 }, () => ({ x: rng.range(0, VIEW_W), y: rng.range(0, VIEW_H * 0.7), r: rng.range(0.4, 1.3), tw: rng.range(0.5, 3) })) : [];
    this.baked = { key, layers, clouds, stars };
    this.motes = [];
  }

  /** Background in screen space (camera only drives parallax). */
  draw(rc: RC, th: Theme, cam: Camera, kb: number) {
    this.ensure(th, kb);
    const b = this.baked!;
    const s = rc.s;
    const t = rc.t;
    const px = (depth: number) => -(cam.x - VIEW_W / 2) * depth;
    const py = (depth: number) => -(cam.y - VIEW_H / 2) * depth * 0.6;

    const sky = s.createLinearGradient(0, 0, 0, VIEW_H);
    sky.addColorStop(0, css(th.skyTop));
    sky.addColorStop(0.55, css(th.skyMid));
    sky.addColorStop(1, css(th.skyBottom));
    s.fillStyle = sky;
    s.fillRect(-40, -40, VIEW_W + 80, VIEW_H + 80);

    for (const st of b.stars) {
      const a = 0.45 + 0.55 * Math.abs(Math.sin(t * st.tw + st.x));
      rc.g.fillStyle = `rgba(255,255,255,${a})`;
      rc.g.fillRect(st.x + px(0.02), st.y + py(0.02), st.r, st.r);
    }

    this.drawCelestial(rc, th, px(0.04), py(0.04));
    if (th.rays) this.drawRays(rc, th, px(0.04), py(0.04));

    for (const cl of b.clouds) {
      const x = ((((cl.x + t * cl.speed + px(cl.depth)) % (VIEW_W + cl.w * 2)) + VIEW_W + cl.w * 2) % (VIEW_W + cl.w * 2)) - cl.w;
      s.drawImage(cl.c, x, cl.y + py(cl.depth), cl.w, cl.h);
    }

    b.layers.forEach((L, i) => {
      const x = -VIEW_W * PAD + px(L.depth);
      const y = py(L.depth);
      s.drawImage(L.c, x, y, VIEW_W * (1 + PAD * 2), VIEW_H);
      if (L.glow) {
        rc.g.globalAlpha = 0.8 + 0.2 * Math.sin(t * 0.7 + i);
        rc.g.drawImage(L.glow, x, y, VIEW_W * (1 + PAD * 2), VIEW_H);
        rc.g.globalAlpha = 1;
      }
      // Atmospheric haze between layers.
      const fog = s.createLinearGradient(0, VIEW_H * 0.35, 0, VIEW_H);
      fog.addColorStop(0, css(th.fog, 0, 0));
      fog.addColorStop(1, css(th.fog, 0, 0.14 - i * 0.04));
      s.fillStyle = fog;
      s.fillRect(-40, -40, VIEW_W + 80, VIEW_H + 80);
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
        glowDot(g, x, y, c.r * (th.night ? 7 : 4.5), c.glow, th.night ? 0.35 : 0.22, 0.08);
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
        // Terminator shadow.
        s.fillStyle = 'rgba(0,0,10,0.35)';
        s.beginPath();
        s.arc(x, y, c.r, -Math.PI / 2, Math.PI / 2);
        s.ellipse(x, y, c.r * 0.45, c.r, 0, Math.PI / 2, -Math.PI / 2, true);
        s.fill();
        break;
      }
      case 'planet': {
        glowDot(g, x, y, c.r * 2.4, c.glow, 0.2, 0.3);
        const gr = s.createRadialGradient(x - c.r * 0.4, y - c.r * 0.4, c.r * 0.1, x, y, c.r);
        gr.addColorStop(0, css(c.color, 15));
        gr.addColorStop(0.7, css(c.color, -5));
        gr.addColorStop(1, css(c.color, -30));
        s.save();
        s.beginPath();
        s.arc(x, y, c.r, 0, Math.PI * 2);
        s.clip();
        s.fillStyle = gr;
        s.fillRect(x - c.r, y - c.r, c.r * 2, c.r * 2);
        for (let i = -3; i <= 3; i++) {
          s.fillStyle = css(c.color, i % 2 ? 10 : -10, 0.25);
          s.fillRect(x - c.r, y + i * c.r * 0.22 + Math.sin(rc.t * 0.1 + i) * 2, c.r * 2, c.r * 0.12);
        }
        s.restore();
        g.fillStyle = css(c.color, 0, 0.25);
        circle(g, x, y, c.r);
        s.strokeStyle = css(c.color, 25, 0.75);
        g.strokeStyle = css(c.color, 25, 0.35);
        for (const ctx of [s, g]) {
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(x, y, c.r * 1.9, c.r * 0.38, -0.3, 0.1, Math.PI - 0.1);
          ctx.stroke();
        }
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
    light(rc, x, y, 260, c.glow, c.kind === 'sun' ? 0.6 : 0.25);
  }

  private drawRays(rc: RC, th: Theme, ox: number, oy: number) {
    const c = th.celestial;
    const x = c.kind === 'none' ? VIEW_W * 0.5 : c.x * VIEW_W + ox;
    const y = c.kind === 'none' ? -40 : c.y * VIEW_H + oy;
    const g = rc.g;
    for (let i = 0; i < 7; i++) {
      const a = Math.PI / 2 + (i - 3) * 0.24 + Math.sin(rc.t * 0.13 + i * 1.7) * 0.06 + (x - VIEW_W / 2) * -0.0009;
      const len = VIEW_H * 1.6;
      const w = 0.05 + hash2(i, 3, th.seed) * 0.05;
      const al = (0.04 + 0.03 * Math.sin(rc.t * 0.4 + i * 2.1)) * (th.night ? 0.6 : 0.7);
      const gr = g.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
      gr.addColorStop(0, css(c.glow, 10, al));
      gr.addColorStop(1, css(c.glow, 0, 0));
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a - w) * len, y + Math.sin(a - w) * len);
      g.lineTo(x + Math.cos(a + w) * len, y + Math.sin(a + w) * len);
      g.fill();
    }
  }

  /** Liquid pool along the bottom of the world (drawn in world space, in front of terrain). */
  drawLiquid(rc: RC, th: Theme) {
    const L = th.liquid;
    const s = rc.s;
    const g = rc.g;
    const t = rc.t;
    const y0 = VIEW_H - 9;
    const wave = (x: number) => y0 + Math.sin(x * 0.045 + t * 1.6) * 1.6 + Math.sin(x * 0.11 - t * 2.4) * 0.9 + Math.sin(x * 0.023 + t * 0.6) * 1.2;
    const path = new Path2D();
    path.moveTo(-20, VIEW_H + 20);
    for (let x = -20; x <= VIEW_W + 20; x += 6) path.lineTo(x, wave(x));
    path.lineTo(VIEW_W + 20, VIEW_H + 20);
    path.closePath();
    // Heat haze above emissive liquids.
    if (L.emissive) {
      const hz = g.createLinearGradient(0, y0 - 70, 0, y0);
      hz.addColorStop(0, css(L.glow, 0, 0));
      hz.addColorStop(1, css(L.glow, 0, 0.22 + Math.sin(t * 1.3) * 0.04));
      g.fillStyle = hz;
      g.fillRect(-20, y0 - 70, VIEW_W + 40, 72);
    }
    const gr = s.createLinearGradient(0, y0 - 3, 0, VIEW_H);
    gr.addColorStop(0, css(L.color, 15));
    gr.addColorStop(1, css(L.color, -20));
    s.fillStyle = gr;
    s.fill(path);
    if (L.emissive) {
      g.globalAlpha = 0.75;
      g.fillStyle = gr;
      g.fill(path);
      g.globalAlpha = 1;
      // Molten crust patches drifting on the surface.
      s.fillStyle = css(L.color, -28, 0.55);
      for (let i = 0; i < 14; i++) {
        const cx = ((i * 97.3 + t * (6 + (i % 3) * 3)) % (VIEW_W + 60)) - 30;
        s.beginPath();
        s.ellipse(cx, wave(cx) + 4.5, 9 + (i % 4) * 4, 1.6, 0, 0, Math.PI * 2);
        s.fill();
      }
      for (let x = 32; x < VIEW_W; x += 72) light(rc, x, y0 + 4, 110, L.glow, 0.75 + Math.sin(t * 2 + x) * 0.1);
    }
    // Bright surface line.
    g.lineWidth = 1.6;
    g.strokeStyle = css(L.glow, 15, L.emissive ? 0.9 : 0.5);
    g.beginPath();
    for (let x = -20; x <= VIEW_W + 20; x += 6) (x === -20 ? g.moveTo : g.lineTo).call(g, x, wave(x));
    g.stroke();
  }

  /** Ambient motes: embers, fireflies, snow, spores, dust, bubbles (cosmetic, non-deterministic). */
  drawMotes(rc: RC, th: Theme, dt: number) {
    const kind = th.ambient;
    const target = kind === 'snow' ? 90 : kind === 'dust' ? 50 : 60;
    while (this.motes.length < target) {
      const spawnBottom = kind === 'embers' || kind === 'bubbles';
      this.motes.push({
        x: Math.random() * VIEW_W,
        y: spawnBottom ? VIEW_H + Math.random() * 20 : this.motes.length < target / 2 ? Math.random() * VIEW_H : -5,
        vx: (Math.random() - 0.5) * 10,
        vy: kind === 'snow' ? 12 + Math.random() * 14 : kind === 'embers' ? -(15 + Math.random() * 30) : kind === 'bubbles' ? -(8 + Math.random() * 10) : (Math.random() - 0.5) * 6,
        life: 4 + Math.random() * 10,
        seed: Math.random() * 100,
      });
    }
    const t = rc.t;
    const col = kind === 'embers' ? th.liquid.glow : kind === 'fireflies' ? ({ h: 70, s: 100, l: 65 } as HSL) : kind === 'spores' ? shift(th.accent, 10) : th.fog;
    this.motes = this.motes.filter((m) => {
      m.life -= dt;
      m.x += (m.vx + Math.sin(t * 0.8 + m.seed) * 8) * dt;
      m.y += m.vy * dt;
      if (m.life <= 0 || m.y < -10 || m.y > VIEW_H + 25 || m.x < -10 || m.x > VIEW_W + 10) return false;
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
        case 'snow':
          rc.s.fillStyle = `rgba(255,255,255,${0.85 * fade})`;
          circle(rc.s, m.x, m.y, 0.7 + (m.seed % 1) * 0.8);
          break;
        case 'spores':
          rc.g.fillStyle = css(col, 0, 0.45 * fade);
          circle(rc.g, m.x, m.y, 1);
          break;
        case 'dust':
          rc.s.fillStyle = `rgba(255,250,235,${0.3 * fade})`;
          rc.s.fillRect(m.x, m.y, 1, 1);
          break;
        case 'bubbles':
          rc.s.strokeStyle = `rgba(220,255,255,${0.5 * fade})`;
          rc.s.lineWidth = 0.6;
          rc.s.beginPath();
          rc.s.arc(m.x, m.y, 1.4 + (m.seed % 1.5), 0, Math.PI * 2);
          rc.s.stroke();
          break;
      }
      return true;
    });
  }
}

function bakeLayer(L: SkyLayer, th: Theme, W: number, kb: number, blur: number): { c: HTMLCanvasElement; glow: HTMLCanvasElement | null; depth: number } {
  const c = document.createElement('canvas');
  c.width = Math.ceil(W * kb);
  c.height = Math.ceil(VIEW_H * kb);
  const g = c.getContext('2d')!;
  g.scale(kb, kb);
  let glowC: HTMLCanvasElement | null = null;
  let gg: CanvasRenderingContext2D | null = null;
  const needGlow = L.kind === 'city' || L.kind === 'crystals' || L.kind === 'islands';
  if (needGlow) {
    glowC = document.createElement('canvas');
    glowC.width = c.width;
    glowC.height = c.height;
    gg = glowC.getContext('2d')!;
    gg.scale(kb, kb);
  }
  const rng = new Rng(L.seed);
  const H = VIEW_H;
  const height = (x: number) => {
    const u = x / VIEW_W;
    let h = L.base;
    L.freqs.forEach((f, i) => (h += Math.sin(u * f * Math.PI * 2 + L.phases[i]) * L.amp * (1 / (i + 1))));
    return h * H;
  };
  const col = L.color;
  const fill = (y0: number) => {
    const gr = g.createLinearGradient(0, y0, 0, H);
    gr.addColorStop(0, css(col, 6));
    gr.addColorStop(1, css(col, -8));
    return gr;
  };
  switch (L.kind) {
    case 'mountains': {
      g.fillStyle = fill(H * L.base - H * L.amp);
      g.beginPath();
      g.moveTo(0, H);
      const pts: [number, number][] = [];
      for (let x = 0; x <= W; x += 4) {
        const ridge = Math.abs(Math.sin(x * 0.013 + L.phases[0]) * 0.5 + Math.sin(x * 0.031 + L.phases[1]) * 0.3);
        const y = height(x) - ridge * H * L.amp * 1.2;
        pts.push([x, y]);
        g.lineTo(x, y);
      }
      g.lineTo(W, H);
      g.fill();
      // Lit faces & snowcaps.
      g.save();
      g.clip();
      for (let i = 1; i < pts.length; i++) {
        const [x, y] = pts[i];
        const slope = y - pts[i - 1][1];
        if (slope < 0) {
          g.fillStyle = css(col, 10, 0.35);
          g.fillRect(x - 4, y, 4, H - y);
        }
      }
      const minY = Math.min(...pts.map((p) => p[1]));
      g.fillStyle = css({ h: col.h, s: 15, l: Math.min(95, col.l + 40) }, 0, 0.55);
      for (const [x, y] of pts) if (y < minY + H * 0.05) g.fillRect(x - 2, y, 4, (minY + H * 0.05 - y) * 0.8);
      g.restore();
      break;
    }
    case 'spires': {
      g.fillStyle = fill(H * 0.3);
      let x = 0;
      while (x < W) {
        const w = rng.range(8, 26);
        const top = height(x) - rng.range(0, H * 0.18);
        g.beginPath();
        g.moveTo(x, H);
        g.lineTo(x, top + w);
        g.lineTo(x + w / 2, top - rng.range(4, 26));
        g.lineTo(x + w, top + w);
        g.lineTo(x + w, H);
        g.fill();
        x += w + rng.range(-4, 10);
      }
      break;
    }
    case 'mesas': {
      g.fillStyle = fill(H * 0.4);
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += 6) g.lineTo(x, Math.round(height(x) / 14) * 14);
      g.lineTo(W, H);
      g.fill();
      g.save();
      g.clip();
      for (let y = 0; y < H; y += 7) {
        g.fillStyle = css(col, (y / 7) % 2 ? 4 : -4, 0.5);
        g.fillRect(0, y, W, 3);
      }
      g.restore();
      break;
    }
    case 'city': {
      let x = 0;
      while (x < W) {
        const w = rng.range(14, 40);
        const top = height(x) - rng.range(0, H * 0.15);
        g.fillStyle = fill(top);
        g.fillRect(x, top, w, H - top);
        if (rng.chance(0.3)) g.fillRect(x + w / 2 - 1, top - rng.range(6, 20), 2, 20);
        if (gg) {
          for (let wy = top + 4; wy < H - 4; wy += 6) {
            for (let wx = x + 3; wx < x + w - 3; wx += 5) {
              if (rng.chance(th.night ? 0.28 : 0.08)) {
                gg.fillStyle = css({ h: rng.pick([45, 50, 190, 330]), s: 90, l: 70 }, 0, rng.range(0.4, 0.9));
                gg.fillRect(wx, wy, 2, 2.5);
              }
            }
          }
        }
        x += w + rng.range(1, 6);
      }
      break;
    }
    case 'forest': {
      g.fillStyle = fill(H * 0.4);
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) g.lineTo(x, height(x) + 14);
      g.lineTo(W, H);
      g.fill();
      for (let x = 0; x < W; x += rng.range(4, 9)) {
        const base = height(x) + 16;
        const h = rng.range(18, 44);
        const w = h * rng.range(0.28, 0.38);
        g.beginPath();
        g.moveTo(x, base - h);
        for (let k = 1; k <= 4; k++) {
          g.lineTo(x + (w * k) / 4, base - h + (h * k) / 4);
          g.lineTo(x + (w * k) / 8, base - h + (h * k) / 4);
        }
        g.lineTo(x, base);
        for (let k = 4; k >= 1; k--) {
          g.lineTo(x - (w * k) / 8, base - h + (h * k) / 4);
          g.lineTo(x - (w * k) / 4, base - h + (h * k) / 4);
        }
        g.closePath();
        g.fill();
      }
      break;
    }
    case 'islands': {
      g.fillStyle = fill(H * 0.5);
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) g.lineTo(x, height(x) + 40);
      g.lineTo(W, H);
      g.fill();
      const n = rng.int(4, 8);
      for (let i = 0; i < n; i++) {
        const x = rng.range(0, W);
        const y = rng.range(H * 0.15, H * 0.5);
        const w = rng.range(20, 60);
        const d = w * rng.range(0.6, 1.1);
        g.fillStyle = css(col, 4);
        g.beginPath();
        g.moveTo(x - w / 2, y);
        g.quadraticCurveTo(x - w / 3, y + d * 0.7, x, y + d);
        g.quadraticCurveTo(x + w / 3, y + d * 0.7, x + w / 2, y);
        g.closePath();
        g.fill();
        g.fillStyle = css(col, 12);
        g.fillRect(x - w / 2, y - 2, w, 3);
        if (gg && rng.chance(0.5)) {
          // Waterfall / glowing drip.
          const fx = x + rng.range(-w / 4, w / 4);
          const gr = gg.createLinearGradient(0, y, 0, y + 120);
          gr.addColorStop(0, css(th.accent, 20, 0.45));
          gr.addColorStop(1, css(th.accent, 0, 0));
          gg.fillStyle = gr;
          gg.fillRect(fx, y, 2.5, 120);
        }
      }
      break;
    }
    case 'crystals': {
      g.fillStyle = fill(H * 0.5);
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) g.lineTo(x, height(x) + 20);
      g.lineTo(W, H);
      g.fill();
      for (let x = 0; x < W; x += rng.range(15, 40)) {
        const base = height(x) + 22;
        const h = rng.range(25, 80);
        const w = rng.range(6, 14);
        const lean = rng.range(-0.3, 0.3);
        const tipX = x + lean * h;
        g.fillStyle = css(col, 8);
        g.beginPath();
        g.moveTo(x - w / 2, base);
        g.lineTo(tipX - w / 2, base - h);
        g.lineTo(tipX, base - h - w);
        g.lineTo(tipX + w / 2, base - h);
        g.lineTo(x + w / 2, base);
        g.fill();
        if (gg) {
          gg.strokeStyle = css(th.terrain.vein, 10, 0.35);
          gg.lineWidth = 1;
          gg.beginPath();
          gg.moveTo(x, base);
          gg.lineTo(tipX, base - h - w);
          gg.stroke();
        }
      }
      break;
    }
  }
  // Depth of field: soften farther layers.
  if (blur > 0.2) {
    const b = document.createElement('canvas');
    b.width = c.width;
    b.height = c.height;
    const bg = b.getContext('2d')!;
    bg.filter = `blur(${(blur * kb).toFixed(1)}px)`;
    bg.drawImage(c, 0, 0);
    if (glowC) {
      const gb = document.createElement('canvas');
      gb.width = glowC.width;
      gb.height = glowC.height;
      const gbg = gb.getContext('2d')!;
      gbg.filter = `blur(${(blur * kb * 0.6).toFixed(1)}px)`;
      gbg.drawImage(glowC, 0, 0);
      glowC = gb;
    }
    return { c: b, glow: glowC, depth: L.depth };
  }
  return { c, glow: glowC, depth: L.depth };
}

function bakeCloud(rng: Rng, w: number, h: number, th: Theme, kb: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * kb);
  c.height = Math.ceil(h * kb);
  const g = c.getContext('2d')!;
  g.scale(kb, kb);
  const base = th.night ? shift(th.skyMid, 8) : shift(th.skyBottom, 6, -20);
  const puffs = rng.int(5, 9);
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < puffs; i++) {
      const px = w * (0.15 + 0.7 * (i / (puffs - 1)));
      const r = h * rng.range(0.25, 0.45) * (1 - Math.abs(i / (puffs - 1) - 0.5));
      const py = h * 0.62 - r * 0.6;
      const gr = g.createRadialGradient(px - r * 0.3, py - r * 0.4, r * 0.1, px, py, r);
      gr.addColorStop(0, css(base, pass ? 18 : 8, 0.95));
      gr.addColorStop(1, css(base, pass ? 2 : -8, 0.9));
      g.fillStyle = gr;
      circle(g, px, py + (pass ? 0 : 2), r * (pass ? 0.95 : 1.05) + 2);
    }
  }
  return c;
}
