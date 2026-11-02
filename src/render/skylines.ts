import { css, type HSL, hsl3, mixHsl, shift } from '../core/color';
import type { Rng } from '../core/rng';
import type { SkyLayer, SkylineKind, Theme } from '../gen/theme';
import { circle, ellipse } from './kit';

/**
 * Parallax skyline bakers, one per SkylineKind. Each paints a silhouette
 * layer once into an offscreen canvas (albedo `g` + optional emissive `e`)
 * and may register animated `features` (smoke, windmill blades, lighthouse
 * beam, blinking lights…) that the backdrop animates per frame cheaply.
 */

export type FeatureKind = 'smoke' | 'windmill' | 'beam' | 'blink' | 'flicker' | 'plume' | 'torch' | 'flag' | 'glint' | 'flare' | 'steam';

export interface Feature {
  kind: FeatureKind;
  /** Position in layer space (baked canvas coordinates, world px). */
  x: number;
  y: number;
  /** Size scale. */
  s: number;
  color: HSL;
  phase: number;
  /** Extra width/height (e.g. flicker rect). */
  w?: number;
  h?: number;
}

export interface BakeCtx {
  g: CanvasRenderingContext2D;
  /** Emissive layer, or null when this kind has no glow. */
  e: CanvasRenderingContext2D | null;
  L: SkyLayer;
  th: Theme;
  W: number;
  H: number;
  rng: Rng;
  feats: Feature[];
  /** Base ridge height (px from top) at x. */
  ridge(x: number): number;
}

interface SkylineDef {
  glow: boolean;
  bake(c: BakeCtx): void;
}

// ---------------------------------------------------------------------------
// Helpers

function vgrad(g: CanvasRenderingContext2D, y0: number, y1: number, c0: string, c1: string): CanvasGradient {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, c0);
  gr.addColorStop(1, c1);
  return gr;
}

/** Fill the area under a polyline ridge down to the bottom. */
function ground(c: BakeCtx, offset = 0, step = 6, color?: string | CanvasGradient) {
  const { g, W, H } = c;
  g.fillStyle = color ?? vgrad(g, c.L.base * H - c.L.amp * H, H, css(c.L.color, 5), css(c.L.color, -6));
  g.beginPath();
  g.moveTo(-2, H);
  for (let x = -2; x <= W + step; x += step) g.lineTo(x, c.ridge(x) + offset);
  g.lineTo(W + 2, H);
  g.fill();
}

function windows(c: BakeCtx, x: number, y: number, w: number, h: number, cw: number, ch: number, gx: number, gy: number, p: number, warm = true) {
  const { e, rng, L } = c;
  if (!e || p <= 0) return;
  for (let wy = y + gy; wy < y + h - ch - 1; wy += ch + gy) {
    for (let wx = x + gx; wx < x + w - cw - 1; wx += cw + gx) {
      if (!rng.chance(p)) continue;
      const col = warm ? shift(L.glow, rng.range(-8, 6), 0, rng.range(-8, 8)) : hsl3(rng.pick([45, 50, 190, 200, 30]), 80, 70);
      e.fillStyle = css(col, 0, rng.range(0.45, 0.95));
      e.fillRect(wx, wy, cw, ch);
    }
  }
}

function roundTree(g: CanvasRenderingContext2D, x: number, y: number, r: number, body: HSL, lit: HSL, rng: Rng) {
  g.fillStyle = css(body, -8);
  g.fillRect(x - r * 0.12, y - r * 0.4, r * 0.24, r * 1.4);
  const blobs = 4 + Math.floor(r / 4);
  for (let i = 0; i < blobs; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(0, r * 0.55);
    g.fillStyle = css(body, rng.range(-4, 3));
    circle(g, x + Math.cos(a) * d, y - r * 0.6 + Math.sin(a) * d * 0.7, r * rng.range(0.45, 0.7));
  }
  g.fillStyle = css(lit, 0, 0.35);
  circle(g, x - r * 0.25, y - r * 0.85, r * 0.38);
}

function crenellate(g: CanvasRenderingContext2D, x: number, y: number, w: number, mw = 4, mh = 3.5) {
  for (let cx = x; cx < x + w - 0.5; cx += mw * 2) g.fillRect(cx, y - mh, Math.min(mw, x + w - cx), mh + 0.5);
}

// ---------------------------------------------------------------------------
// Skylines

const mountains: SkylineDef = {
  glow: false,
  bake(c) {
    const { g, L, W, H } = c;
    const pts: [number, number][] = [];
    for (let x = -4; x <= W + 4; x += 4) {
      const r = Math.abs(Math.sin(x * 0.013 + L.phases[0]) * 0.5 + Math.sin(x * 0.031 + L.phases[1]) * 0.3);
      pts.push([x, c.ridge(x) - r * H * L.amp * 1.4]);
    }
    g.fillStyle = vgrad(g, L.base * H - L.amp * H * 2, H, css(L.color, 6), css(L.color, -6));
    g.beginPath();
    g.moveTo(-4, H);
    for (const [x, y] of pts) g.lineTo(x, y);
    g.lineTo(W + 4, H);
    g.fill();
    g.save();
    g.clip();
    // Lit faces and snow caps.
    for (let i = 1; i < pts.length; i++) {
      const [x, y] = pts[i];
      if (y - pts[i - 1][1] < 0) {
        g.fillStyle = css(L.color, 12, 0.35);
        g.fillRect(x - 4, y, 4, H - y);
      }
    }
    const minY = Math.min(...pts.map((p) => p[1]));
    g.fillStyle = css(hsl3(L.color.h, 15, Math.min(95, L.color.l + 42)), 0, 0.6);
    for (const [x, y] of pts) if (y < minY + H * 0.06) g.fillRect(x - 2, y, 4, (minY + H * 0.06 - y) * 0.8);
    g.restore();
  },
};

const hills: SkylineDef = {
  glow: false,
  bake(c) {
    const { g, L, W, H, rng } = c;
    for (let band = 0; band < 2; band++) {
      const off = band * H * 0.05;
      const col = shift(L.color, band ? -5 : 3);
      g.fillStyle = vgrad(g, L.base * H - L.amp * H + off, H, css(col, 4), css(col, -8));
      g.beginPath();
      g.moveTo(-2, H);
      for (let x = -2; x <= W + 6; x += 6) g.lineTo(x, c.ridge(x + band * 140) + off);
      g.lineTo(W + 2, H);
      g.fill();
      // Little trees on the crest.
      for (let x = rng.range(0, 30); x < W; x += rng.range(14, 50)) {
        const y = c.ridge(x + band * 140) + off;
        g.fillStyle = css(col, -6);
        circle(g, x, y - 1.5, rng.range(2, 4));
      }
    }
  },
};

const farmstead: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, rng, feats } = c;
    ground(c);
    const body = L.color;
    const lit = shift(L.color, 18);
    let x = rng.range(10, 60);
    while (x < W - 20) {
      const y = c.ridge(x) + 2;
      const kind = rng.weighted([
        ['barn', 1],
        ['silo', 1],
        ['windmill', 0.8],
        ['house', 1],
        ['trees', 3.5],
      ] as const);
      if (kind === 'barn') {
        const w = rng.range(26, 36);
        const h = w * 0.55;
        const red = L.detail;
        g.fillStyle = css(red, -6);
        g.fillRect(x, y - h, w, h);
        // Gambrel roof.
        g.fillStyle = css(red, -18);
        g.beginPath();
        g.moveTo(x - 2, y - h);
        g.lineTo(x + w * 0.15, y - h - w * 0.22);
        g.lineTo(x + w * 0.5, y - h - w * 0.36);
        g.lineTo(x + w * 0.85, y - h - w * 0.22);
        g.lineTo(x + w + 2, y - h);
        g.fill();
        g.strokeStyle = css(hsl3(40, 20, 85), -10, 0.8);
        g.lineWidth = 1;
        const dw = w * 0.32;
        const dx = x + w / 2 - dw / 2;
        g.strokeRect(dx, y - h * 0.7, dw, h * 0.7);
        g.beginPath();
        g.moveTo(dx, y - h * 0.7);
        g.lineTo(dx + dw, y);
        g.moveTo(dx + dw, y - h * 0.7);
        g.lineTo(dx, y);
        g.stroke();
        g.fillStyle = css(hsl3(40, 20, 85), -10, 0.8);
        g.fillRect(x + w / 2 - 2, y - h - w * 0.2, 4, 3);
        x += w + rng.range(8, 30);
      } else if (kind === 'silo') {
        const w = rng.range(8, 11);
        const h = rng.range(30, 44);
        const col = hsl3(210, 8, Math.max(20, body.l + 20));
        g.fillStyle = vgrad(g, 0, 1, css(col), css(col));
        const gr = g.createLinearGradient(x, 0, x + w, 0);
        gr.addColorStop(0, css(col, 10));
        gr.addColorStop(1, css(col, -10));
        g.fillStyle = gr;
        g.fillRect(x, y - h, w, h);
        g.beginPath();
        g.ellipse(x + w / 2, y - h, w / 2, w * 0.45, 0, Math.PI, 0);
        g.fill();
        g.fillStyle = css(col, -16);
        for (let i = 1; i < 5; i++) g.fillRect(x, y - (h * i) / 5, w, 0.7);
        if (rng.chance(0.6)) {
          g.fillStyle = css(L.detail, -10);
          g.fillRect(x - w * 0.9, y - h * 0.45, w * 0.9, h * 0.45);
        }
        x += w + rng.range(6, 26);
      } else if (kind === 'windmill') {
        const h = rng.range(36, 46);
        const col = hsl3(30, 15, Math.max(18, body.l + 22));
        g.fillStyle = css(col, -6);
        g.beginPath();
        g.moveTo(x - 6, y);
        g.lineTo(x - 3, y - h);
        g.lineTo(x + 3, y - h);
        g.lineTo(x + 6, y);
        g.fill();
        g.fillStyle = css(col, -16);
        g.beginPath();
        g.moveTo(x - 4.5, y - h);
        g.lineTo(x, y - h - 6);
        g.lineTo(x + 4.5, y - h);
        g.fill();
        feats.push({ kind: 'windmill', x, y: y - h - 1, s: h * 0.55, color: hsl3(40, 25, Math.min(90, body.l + 45)), phase: rng.range(0, 6) });
        x += rng.range(30, 50);
      } else if (kind === 'house') {
        const w = rng.range(18, 24);
        const h = w * 0.55;
        const col = shift(body, 10, -10);
        g.fillStyle = css(col);
        g.fillRect(x, y - h, w, h);
        g.fillStyle = css(L.detail, -22);
        g.beginPath();
        g.moveTo(x - 2, y - h);
        g.lineTo(x + w / 2, y - h - w * 0.35);
        g.lineTo(x + w + 2, y - h);
        g.fill();
        g.fillStyle = css(col, -10);
        g.fillRect(x + w * 0.72, y - h - w * 0.32, 3, 6);
        feats.push({ kind: 'smoke', x: x + w * 0.72 + 1.5, y: y - h - w * 0.32, s: 0.6, color: hsl3(30, 10, 80), phase: rng.range(0, 10) });
        windows(c, x, y - h, w, h, 2.5, 3, 3, 2.5, L.lit);
        x += w + rng.range(10, 30);
      } else {
        const n = rng.int(2, 5);
        for (let i = 0; i < n; i++) {
          if (rng.chance(0.3)) {
            // Poplar.
            const h = rng.range(16, 24);
            g.fillStyle = css(body, -8);
            ellipse(g, x, y - h / 2, 3, h / 2);
          } else roundTree(g, x, y, rng.range(6, 10), shift(body, -6), lit, rng);
          x += rng.range(6, 12);
        }
        x += rng.range(8, 24);
      }
    }
  },
};

const fields: SkylineDef = {
  glow: false,
  bake(c) {
    const { g, L, W, H, rng } = c;
    ground(c);
    g.save();
    g.beginPath();
    g.moveTo(-2, H);
    for (let x = -2; x <= W + 6; x += 6) g.lineTo(x, c.ridge(x));
    g.lineTo(W + 2, H);
    g.clip();
    // Patchwork of crop fields following the ridge, with faint furrows.
    let x = 0;
    while (x < W) {
      const w = rng.range(50, 130);
      const col = rng.chance(0.45) ? L.detail : shift(L.color, rng.range(-3, 7), 0, rng.range(-12, 12));
      g.fillStyle = css(col, 0, 0.9);
      g.beginPath();
      g.moveTo(x, c.ridge(x));
      for (let xx = x; xx <= x + w; xx += 8) g.lineTo(xx, c.ridge(xx));
      g.lineTo(x + w, H);
      g.lineTo(x, H);
      g.fill();
      g.strokeStyle = css(col, -9, 0.45);
      g.lineWidth = 0.6;
      for (let r = 0; r < 12; r++) {
        const yo = 3 + r * (3 + r * 0.6);
        g.beginPath();
        g.moveTo(x, c.ridge(x) + yo);
        for (let xx = x; xx <= x + w; xx += 8) g.lineTo(xx, c.ridge(xx) + yo);
        g.stroke();
      }
      // Hedgerow between fields, fading down the slope.
      for (let yy = 0; yy < 40; yy += 3) {
        g.fillStyle = css(L.color, -10, 1 - yy / 40);
        circle(g, x + w + Math.sin(yy) * 1.5, c.ridge(x + w) + yy, 2.6 - yy * 0.03);
      }
      x += w + 4;
    }
    g.restore();
    // Round hay bales and bushes along the crest.
    for (let x2 = rng.range(0, 40); x2 < W; x2 += rng.range(30, 90)) {
      const y = c.ridge(x2);
      if (rng.chance(0.55)) {
        for (let i = 0; i < rng.int(1, 3); i++) {
          const bx = x2 + i * 9;
          const by = c.ridge(bx);
          g.fillStyle = css(L.detail, -18);
          g.beginPath();
          g.roundRect(bx - 4, by - 6, 8, 6.5, 2.5);
          g.fill();
          g.fillStyle = css(L.detail, 4);
          ellipse(g, bx + 2.2, by - 2.8, 1.8, 3);
          g.strokeStyle = css(L.detail, -12);
          g.lineWidth = 0.5;
          g.beginPath();
          g.arc(bx + 2.2, by - 2.8, 1, 0, Math.PI * 2);
          g.stroke();
        }
      } else {
        g.fillStyle = css(L.color, -12);
        for (let i = 0; i < 4; i++) circle(g, x2 + i * 3, y - 1.5, 3.2 - Math.abs(i - 1.5) * 0.5);
      }
    }
  },
};

const industry: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, rng, feats } = c;
    const by = (x: number) => c.ridge(x) + 6;
    ground(c, 12, 6, css(L.color, -3));
    let x = rng.range(-10, 10);
    while (x < W) {
      const y = by(x);
      const kind = rng.weighted([
        ['shed', 3],
        ['stack', 2],
        ['tank', 1.5],
        ['block', 2],
      ] as const);
      if (kind === 'shed') {
        const w = rng.range(36, 70);
        const h = rng.range(14, 26);
        g.fillStyle = css(L.color);
        g.fillRect(x, y - h, w, h + 30);
        // Sawtooth roof.
        const tooth = rng.range(8, 12);
        g.beginPath();
        g.moveTo(x, y - h);
        for (let tx = x; tx < x + w - 0.1; tx += tooth) {
          g.lineTo(tx + tooth * 0.75, y - h - tooth * 0.55);
          g.lineTo(tx + tooth * 0.75, y - h);
          g.lineTo(Math.min(x + w, tx + tooth), y - h);
        }
        g.fill();
        if (c.e && L.lit > 0) {
          for (let tx = x; tx < x + w - 0.1; tx += tooth) {
            if (!rng.chance(L.lit)) continue;
            c.e.fillStyle = css(L.glow, rng.range(-8, 4), 0.55);
            c.e.beginPath();
            c.e.moveTo(tx + tooth * 0.75, y - h - tooth * 0.5);
            c.e.lineTo(tx + tooth * 0.75, y - h);
            c.e.lineTo(tx + tooth * 0.2, y - h);
            c.e.fill();
          }
        }
        windows(c, x, y - h, w, h, 3, 2, 3, 3, L.lit * 0.6);
        x += w + rng.range(2, 12);
      } else if (kind === 'stack') {
        const n = rng.int(1, 3);
        const h0 = rng.range(50, 90);
        for (let i = 0; i < n; i++) {
          const w = rng.range(5, 8);
          const h = h0 * rng.range(0.8, 1.05);
          const sx = x + i * (w + rng.range(3, 8));
          g.fillStyle = css(L.color);
          g.beginPath();
          g.moveTo(sx - 1, y);
          g.lineTo(sx + 0.6, y - h);
          g.lineTo(sx + w - 0.6, y - h);
          g.lineTo(sx + w + 1, y);
          g.fill();
          g.fillStyle = css(L.detail, 0, 0.8);
          g.fillRect(sx + 0.6, y - h, w - 1.2, 2);
          g.fillRect(sx + 0.4, y - h + 6, w - 0.8, 1.5);
          feats.push({
            kind: 'smoke',
            x: sx + w / 2,
            y: y - h,
            s: w / 5,
            color: mixHsl(hsl3(25, 8, c.th.night ? 30 : 46), c.th.horizon.color, 0.2),
            phase: rng.range(0, 10),
          });
          if (c.e && rng.chance(0.5)) {
            c.e.fillStyle = css(hsl3(0, 100, 55), 0, 0.9);
            c.e.fillRect(sx + w / 2 - 0.6, y - h - 2, 1.2, 1.2);
            feats.push({ kind: 'blink', x: sx + w / 2, y: y - h - 1.5, s: 1, color: hsl3(0, 100, 55), phase: rng.range(0, 6) });
          }
        }
        x += n * 12 + rng.range(4, 16);
      } else if (kind === 'tank') {
        const r = rng.range(10, 16);
        g.fillStyle = css(L.color, 2);
        g.fillRect(x, y - r * 1.2, r * 2, r * 1.2 + 30);
        g.beginPath();
        g.ellipse(x + r, y - r * 1.2, r, r * 0.4, 0, Math.PI, 0);
        g.fill();
        g.fillStyle = css(L.detail, 0, 0.5);
        g.fillRect(x, y - r * 0.6, r * 2, 1);
        g.strokeStyle = css(L.color, 4);
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(x + r * 2, y - r * 1.2);
        g.lineTo(x + r * 2 + 6, y - r * 1.4);
        g.lineTo(x + r * 2 + 6, y);
        g.stroke();
        x += r * 2 + rng.range(6, 14);
      } else {
        const w = rng.range(20, 34);
        const h = rng.range(26, 46);
        g.fillStyle = css(L.color, -2);
        g.fillRect(x, y - h, w, h + 30);
        g.fillStyle = css(L.detail, 0, 0.6);
        g.fillRect(x, y - h, w, 1.5);
        windows(c, x, y - h, w, h, 2.5, 3.5, 3, 3, L.lit);
        x += w + rng.range(2, 10);
      }
    }
  },
};

const refinery: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, rng, feats } = c;
    const by = (x: number) => c.ridge(x) + 8;
    ground(c, 14, 6, css(L.color, -2));
    // Long pipe runs.
    for (let i = 0; i < 3; i++) {
      const py = by(W / 2) - 6 - i * 7;
      g.fillStyle = css(L.color, 3 + i * 2);
      g.fillRect(0, py, W, 2.5);
    }
    let x = rng.range(0, 30);
    while (x < W) {
      const y = by(x);
      const kind = rng.weighted([
        ['tower', 2],
        ['gantry', 1.5],
        ['flare', 0.6],
        ['sphere', 1],
      ] as const);
      if (kind === 'tower') {
        const w = rng.range(6, 10);
        const h = rng.range(45, 80);
        g.fillStyle = css(L.color, 2);
        g.fillRect(x, y - h, w, h);
        g.beginPath();
        g.ellipse(x + w / 2, y - h, w / 2, 2.5, 0, Math.PI, 0);
        g.fill();
        g.fillStyle = css(L.detail, 0, 0.8);
        for (let ry = y - h + 8; ry < y - 4; ry += rng.range(8, 14)) g.fillRect(x - 2, ry, w + 4, 1.2);
        if (c.e) {
          for (let ry = y - h + 8; ry < y - 4; ry += 10)
            if (rng.chance(L.lit)) {
              c.e.fillStyle = css(L.glow, 0, 0.8);
              c.e.fillRect(x - 2 + rng.range(0, w + 2), ry - 1.2, 1.2, 1.2);
            }
        }
        x += w + rng.range(6, 18);
      } else if (kind === 'gantry') {
        const w = rng.range(30, 50);
        const h = rng.range(26, 44);
        g.strokeStyle = css(L.color, 4);
        g.lineWidth = 1.2;
        g.beginPath();
        for (const px of [x, x + w]) {
          g.moveTo(px, y);
          g.lineTo(px, y - h);
        }
        g.moveTo(x - 6, y - h);
        g.lineTo(x + w + 10, y - h);
        for (let k = 0; k < w; k += 6) {
          g.moveTo(x + k, y - h);
          g.lineTo(x + k + 6, y - h + 4);
        }
        g.stroke();
        g.lineWidth = 0.6;
        g.beginPath();
        g.moveTo(x + w * 0.6, y - h);
        g.lineTo(x + w * 0.6, y - h + 14);
        g.stroke();
        g.fillStyle = css(L.color, 4);
        g.fillRect(x + w * 0.6 - 3, y - h + 14, 6, 4);
        x += w + rng.range(10, 30);
      } else if (kind === 'flare') {
        const h = rng.range(60, 90);
        g.fillStyle = css(L.color, 2);
        g.fillRect(x, y - h, 2.5, h);
        g.strokeStyle = css(L.color, 2);
        g.lineWidth = 0.6;
        g.beginPath();
        g.moveTo(x - 6, y);
        g.lineTo(x + 1.2, y - h * 0.6);
        g.lineTo(x + 8, y);
        g.stroke();
        feats.push({ kind: 'flare', x: x + 1.2, y: y - h, s: 1.2, color: hsl3(28, 100, 60), phase: rng.range(0, 6) });
        x += rng.range(20, 40);
      } else {
        const r = rng.range(8, 12);
        g.fillStyle = css(L.color, 3);
        circle(g, x + r, y - r - 6, r);
        g.fillRect(x + 2, y - 8, 2, 8);
        g.fillRect(x + r * 2 - 4, y - 8, 2, 8);
        g.fillStyle = css(L.detail, 0, 0.35);
        circle(g, x + r * 0.7, y - r * 1.3 - 6, r * 0.4);
        x += r * 2 + rng.range(6, 16);
      }
    }
  },
};

const castle: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, rng, feats } = c;
    ground(c, 6);
    const stone = L.color;
    const roof = L.detail;
    // One or two castles across the wide layer.
    const count = rng.int(1, 2);
    for (let k = 0; k < count; k++) {
      const cx = W * (count === 1 ? rng.range(0.35, 0.65) : k === 0 ? rng.range(0.15, 0.35) : rng.range(0.6, 0.85));
      const y = c.ridge(cx) + 6;
      const span = rng.range(110, 170);
      const x0 = cx - span / 2;
      // Curtain wall.
      const wallH = rng.range(16, 22);
      g.fillStyle = css(stone, 2);
      g.fillRect(x0, y - wallH, span, wallH + 10);
      crenellate(g, x0, y - wallH, span);
      // Keep.
      const kw = rng.range(26, 36);
      const kh = rng.range(48, 64);
      g.fillStyle = css(stone, 4);
      g.fillRect(cx - kw / 2, y - kh, kw, kh);
      crenellate(g, cx - kw / 2, y - kh, kw, 3.5, 3.5);
      windows(c, cx - kw / 2, y - kh, kw, kh - 8, 1.8, 4, 4, 5, L.lit);
      // Towers.
      const tN = rng.int(3, 5);
      for (let i = 0; i < tN; i++) {
        const tx = x0 + (span * i) / (tN - 1) + rng.range(-4, 4);
        const tw = rng.range(10, 15);
        const th = rng.range(30, 50) * (i === 0 || i === tN - 1 ? 1 : 0.85);
        g.fillStyle = css(stone, 6);
        g.fillRect(tx - tw / 2, y - th, tw, th);
        if (rng.chance(0.65)) {
          const rh = tw * rng.range(1.1, 1.6);
          g.fillStyle = css(roof, -6);
          g.beginPath();
          g.moveTo(tx - tw / 2 - 2, y - th);
          g.lineTo(tx, y - th - rh);
          g.lineTo(tx + tw / 2 + 2, y - th);
          g.fill();
          g.fillStyle = css(roof, 10, 0.5);
          g.beginPath();
          g.moveTo(tx - tw / 2 - 2, y - th);
          g.lineTo(tx, y - th - rh);
          g.lineTo(tx - tw * 0.1, y - th);
          g.fill();
          g.fillStyle = css(stone, -10);
          g.fillRect(tx - 0.4, y - th - rh - 7, 0.8, 7);
          feats.push({ kind: 'flag', x: tx, y: y - th - rh - 7, s: 1, color: roof, phase: rng.range(0, 6) });
        } else crenellate(g, tx - tw / 2 - 1, y - th, tw + 2, 2.5, 3);
        windows(c, tx - tw / 2, y - th, tw, th - 4, 1.6, 3.5, 4, 6, L.lit);
      }
      // Gate.
      g.fillStyle = css(stone, -12);
      g.beginPath();
      g.moveTo(cx - 5, y + 4);
      g.lineTo(cx - 5, y - 8);
      g.arc(cx, y - 8, 5, Math.PI, 0);
      g.lineTo(cx + 5, y + 4);
      g.fill();
      if (c.e && L.lit > 0.2) {
        c.e.fillStyle = css(L.glow, -10, 0.35);
        c.e.fillRect(cx - 4, y - 8, 8, 12);
      }
    }
  },
};

const ramparts: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, H, rng, feats } = c;
    // Terraced wall segments (walls step, they don't undulate).
    const top = (x: number) => Math.round(c.ridge(Math.floor(x / 48) * 48) / 6) * 6 - 6;
    // Continuous wall with arches, merlons and towers.
    g.fillStyle = vgrad(g, L.base * H - 20, H, css(L.color, 4), css(L.color, -4));
    g.beginPath();
    g.moveTo(-2, H);
    for (let x = -2; x <= W + 6; x += 2) g.lineTo(x, top(x));
    g.lineTo(W + 2, H);
    g.fill();
    for (let x = 0; x < W; x += 10) {
      g.fillStyle = css(L.color, 4);
      g.fillRect(x, top(x) - 5, 5, 5.5);
    }
    // Block courses.
    g.fillStyle = css(L.color, -6, 0.6);
    for (let x = 0; x < W; x += 6) for (let yy = 6; yy < 60; yy += 6) g.fillRect(x + ((yy / 6) % 2) * 6, top(x) + yy, 5, 0.6);
    let x = rng.range(20, 80);
    while (x < W) {
      const y = top(x);
      if (rng.chance(0.45)) {
        const tw = rng.range(18, 26);
        const th = rng.range(18, 30);
        g.fillStyle = css(L.color, 2);
        g.fillRect(x - tw / 2, y - th, tw, th + 6);
        crenellate(g, x - tw / 2 - 1, y - th, tw + 2, 3.5, 4);
        g.fillStyle = css(L.color, -10);
        g.fillRect(x - 1, y - th + 7, 2, 6);
        feats.push({ kind: 'torch', x: x - tw / 2 - 2, y: y - th * 0.4, s: 1, color: L.glow, phase: rng.range(0, 6) });
        feats.push({ kind: 'torch', x: x + tw / 2 + 2, y: y - th * 0.4, s: 1, color: L.glow, phase: rng.range(0, 6) });
        // Hanging banner.
        g.fillStyle = css(L.detail, -4);
        g.beginPath();
        g.moveTo(x - 4, y - th + 15);
        g.lineTo(x + 4, y - th + 15);
        g.lineTo(x + 4, y - th + 30);
        g.lineTo(x, y - th + 27);
        g.lineTo(x - 4, y - th + 30);
        g.fill();
        x += tw + rng.range(50, 110);
      } else {
        // Arch with a torch.
        g.fillStyle = css(L.color, -12);
        g.beginPath();
        g.moveTo(x - 6, y + 40);
        g.lineTo(x - 6, y + 16);
        g.arc(x, y + 16, 6, Math.PI, 0);
        g.lineTo(x + 6, y + 40);
        g.fill();
        feats.push({ kind: 'torch', x: x + 10, y: y + 10, s: 0.9, color: L.glow, phase: rng.range(0, 6) });
        x += rng.range(40, 80);
      }
    }
  },
};

const karst: SkylineDef = {
  glow: false,
  bake(c) {
    const { g, L, W, rng } = c;
    ground(c, 18);
    let x = rng.range(-10, 20);
    while (x < W) {
      const w = rng.range(18, 40);
      const h = rng.range(50, 130);
      const y = c.ridge(x) + 20;
      g.fillStyle = vgrad(g, y - h, y, css(L.color, 5), css(L.color, -3));
      g.beginPath();
      g.moveTo(x, y);
      g.bezierCurveTo(x - w * 0.15, y - h * 0.6, x + w * 0.1, y - h, x + w * 0.45, y - h);
      g.bezierCurveTo(x + w * 0.9, y - h, x + w * 1.1, y - h * 0.5, x + w, y);
      g.fill();
      // Vegetation tufts on top.
      g.fillStyle = css(L.color, -6, 0.8);
      for (let i = 0; i < 4; i++) circle(g, x + w * (0.25 + i * 0.15), y - h + rng.range(0, 3), rng.range(2.5, 5));
      x += w * rng.range(0.6, 1.4) + rng.range(4, 40);
    }
  },
};

const canopy: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, H, rng } = c;
    const near = L.depth > 0.3;
    ground(c, 10);
    let x = rng.range(-10, 10);
    while (x < W + 10) {
      const y = c.ridge(x) + 12;
      if (rng.chance(0.18)) {
        // Palm.
        const h = rng.range(40, 70);
        const lean = rng.range(-8, 8);
        g.strokeStyle = css(L.color, -2);
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + lean * 0.3, y - h * 0.5, x + lean, y - h);
        g.stroke();
        g.fillStyle = css(L.color, 0);
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.48;
          const len = rng.range(12, 18);
          g.beginPath();
          g.moveTo(x + lean, y - h);
          g.quadraticCurveTo(
            x + lean + Math.cos(a) * len * 0.6,
            y - h + Math.sin(a) * len * 0.6 - 4,
            x + lean + Math.cos(a) * len,
            y - h + Math.sin(a) * len + len * 0.4,
          );
          g.quadraticCurveTo(x + lean + Math.cos(a) * len * 0.5, y - h + Math.sin(a) * len * 0.3, x + lean, y - h + 1.5);
          g.fill();
        }
        x += rng.range(12, 30);
      } else {
        const r = rng.range(12, 26) * (near ? 1.2 : 1);
        const top = y - r * rng.range(1.2, 2.2);
        g.fillStyle = css(L.color, -6);
        g.fillRect(x - r * 0.12, top, r * 0.24, y - top + 20);
        for (let i = 0; i < 7; i++) {
          g.fillStyle = css(L.color, rng.range(-4, 3));
          circle(g, x + rng.range(-r, r) * 0.8, top + rng.range(-r, r) * 0.45, r * rng.range(0.5, 0.75));
        }
        g.fillStyle = css(L.detail, 0, 0.55);
        for (let i = 0; i < 3; i++) circle(g, x - r * 0.3 + rng.range(-r, r) * 0.3, top - r * 0.35 + rng.range(-3, 3), r * rng.range(0.25, 0.4));
        x += r * rng.range(0.9, 1.5);
      }
    }
    // Lianas between trees.
    g.strokeStyle = css(L.color, -4, 0.8);
    g.lineWidth = 0.8;
    for (let i = 0; i < 10; i++) {
      const x0 = rng.range(0, W);
      const x1 = x0 + rng.range(30, 70);
      const y0 = c.ridge(x0) - rng.range(10, 40);
      g.beginPath();
      g.moveTo(x0, y0);
      g.quadraticCurveTo((x0 + x1) / 2, y0 + rng.range(15, 30), x1, y0 + rng.range(-8, 8));
      g.stroke();
    }
    if (near) {
      // Overhead canopy fringe with hanging vines framing the top of the view.
      for (let x2 = -10; x2 < W + 10; x2 += rng.range(10, 22)) {
        const r = rng.range(10, 22);
        g.fillStyle = css(L.color, rng.range(-5, 2));
        circle(g, x2, rng.range(-12, 4), r);
      }
      for (let i = 0; i < 26; i++) {
        const vx = rng.range(0, W);
        const len = rng.range(20, H * 0.32);
        g.strokeStyle = css(L.color, rng.range(-3, 4));
        g.lineWidth = rng.range(0.8, 1.6);
        g.beginPath();
        g.moveTo(vx, 0);
        g.quadraticCurveTo(vx + rng.range(-6, 6), len * 0.5, vx + rng.range(-3, 3), len);
        g.stroke();
        g.fillStyle = css(L.color, 2);
        for (let ly = 8; ly < len; ly += rng.range(5, 9)) ellipse(g, vx + rng.range(-2, 2), ly, 2, 1, rng.range(-1, 1));
      }
    }
    if (c.e && L.lit > 0) {
      for (let i = 0; i < 40 * L.lit; i++) {
        const fx = rng.range(0, W);
        const fy = c.ridge(fx) + rng.range(-40, 30);
        c.e.fillStyle = css(rng.chance(0.5) ? L.glow : hsl3(180, 90, 60), 0, rng.range(0.4, 0.9));
        circle(c.e, fx, fy, rng.range(0.6, 1.3));
      }
    }
  },
};

const volcano: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, e, L, W, H, rng, feats } = c;
    ground(c, 30);
    const cx = W * rng.range(0.38, 0.62);
    const peakY = H * (L.base - 0.1);
    const baseY = H * (L.base + 0.25);
    const half = rng.range(170, 230);
    const crater = rng.range(14, 20);
    // Secondary peaks behind.
    for (const side of [-1, 1]) {
      const px = cx + side * rng.range(half * 0.8, half * 1.3);
      const ph = H * rng.range(0.1, 0.17);
      g.fillStyle = css(L.color, -3);
      g.beginPath();
      g.moveTo(px - 110, baseY + 30);
      g.quadraticCurveTo(px - 30, baseY - ph * 0.6, px - 6, baseY - ph);
      g.lineTo(px + 8, baseY - ph + 5);
      g.quadraticCurveTo(px + 40, baseY - ph * 0.5, px + 120, baseY + 30);
      g.fill();
    }
    const cone = new Path2D();
    cone.moveTo(cx - half * 1.4, baseY + 40);
    cone.quadraticCurveTo(cx - half * 0.35, baseY - 10, cx - crater, peakY);
    cone.lineTo(cx - crater * 0.4, peakY + 4);
    cone.lineTo(cx + crater * 0.5, peakY + 3);
    cone.lineTo(cx + crater, peakY);
    cone.quadraticCurveTo(cx + half * 0.35, baseY - 10, cx + half * 1.4, baseY + 40);
    cone.closePath();
    g.fillStyle = vgrad(g, peakY, baseY, css(L.color, 7), css(L.color, -2));
    g.fill(cone);
    g.save();
    g.clip(cone);
    // Lit flank and erosion gullies.
    g.fillStyle = css(L.color, 12, 0.25);
    g.beginPath();
    g.moveTo(cx - crater, peakY);
    g.quadraticCurveTo(cx - half * 0.35, baseY - 10, cx - half * 1.4, baseY + 40);
    g.lineTo(cx - half * 0.2, baseY + 40);
    g.quadraticCurveTo(cx - crater * 2, peakY + 60, cx - crater * 0.3, peakY + 3);
    g.fill();
    g.strokeStyle = css(L.color, -6, 0.7);
    g.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      const sx = cx + rng.range(-crater, crater);
      g.beginPath();
      g.moveTo(sx, peakY + 4);
      g.quadraticCurveTo(sx + (sx - cx) * 3 + rng.range(-20, 20), peakY + 60, sx + (sx - cx) * 7 + rng.range(-60, 60), baseY + 20);
      g.stroke();
    }
    g.restore();
    if (e) {
      // Lava rivers: wiggly, tapering, brighter near the vent.
      for (let i = 0; i < rng.int(2, 4); i++) {
        let lx = cx + rng.range(-crater * 0.6, crater * 0.6);
        let ly = peakY + 3;
        const dir = lx < cx ? -1 : 1;
        const steps = rng.int(10, 16);
        for (let k = 0; k < steps; k++) {
          const nx = lx + dir * rng.range(1, 7) + rng.range(-2, 2);
          const ny = ly + rng.range(5, 9);
          e.strokeStyle = css(L.glow, 10 - k, 0.85 * (1 - k / steps) + 0.1);
          e.lineWidth = 2.6 * (1 - k / steps) + 0.5;
          e.lineCap = 'round';
          e.beginPath();
          e.moveTo(lx, ly);
          e.lineTo(nx, ny);
          e.stroke();
          lx = nx;
          ly = ny;
        }
      }
      e.fillStyle = css(L.glow, 20, 0.9);
      ellipse(e, cx, peakY + 1.5, crater * 0.9, 2.2);
      const gr = e.createRadialGradient(cx, peakY, 0, cx, peakY, crater * 1.6);
      gr.addColorStop(0, css(L.glow, 10, 0.55));
      gr.addColorStop(1, css(L.glow, 0, 0));
      e.fillStyle = gr;
      e.fillRect(cx - crater * 2, peakY - crater * 2, crater * 4, crater * 4);
    }
    feats.push({ kind: 'plume', x: cx, y: peakY, s: crater / 14, color: shift(c.th.cloudColor, 4), phase: rng.range(0, 6) });
  },
};

const crags: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, e, L, W, rng } = c;
    ground(c, 8);
    let x = rng.range(-10, 10);
    while (x < W) {
      const w = rng.range(26, 60);
      const h = rng.range(18, 55);
      const y = c.ridge(x) + 10;
      // Chunky basalt outcrop: irregular polygon with a few facets.
      const pts: [number, number][] = [[x - w / 2, y + 6]];
      const n = rng.int(4, 6);
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const peak = 1 - Math.abs(t - rng.range(0.35, 0.65)) * 1.6;
        pts.push([x - w / 2 + w * t + rng.range(-3, 3), y - h * Math.max(0.15, peak) - rng.range(0, 6)]);
      }
      pts.push([x + w / 2, y + 6]);
      g.fillStyle = css(L.color, rng.range(-2, 3));
      g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
      g.fill();
      // Lit facet.
      const top = pts.reduce((m, p) => (p[1] < m[1] ? p : m), pts[0]);
      g.fillStyle = css(L.color, 9, 0.35);
      g.beginPath();
      g.moveTo(x - w / 2, y + 6);
      for (const p of pts.slice(1)) {
        if (p[0] > top[0]) break;
        g.lineTo(p[0], p[1]);
      }
      g.lineTo(top[0], top[1]);
      g.lineTo(top[0] - w * 0.08, y + 6);
      g.fill();
      x += w * rng.range(0.6, 1.1) + rng.range(0, 20);
    }
    if (e) {
      // Magma pooled at the foot of the crags.
      for (let k = 0; k < 7; k++) {
        const px = rng.range(0, W);
        const py = c.ridge(px) + 18;
        const gr = e.createRadialGradient(px, py, 0, px, py, 46);
        gr.addColorStop(0, css(L.glow, 0, 0.2 * L.lit));
        gr.addColorStop(1, css(L.glow, 0, 0));
        e.fillStyle = gr;
        e.fillRect(px - 46, py - 46, 92, 92);
      }
    }
  },
};

const sea: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, e, L, W, H, rng, feats, th } = c;
    const hy = L.base * H;
    // Water plane from the horizon down.
    const gr = g.createLinearGradient(0, hy, 0, H);
    gr.addColorStop(0, css(mixHsl(L.color, th.skyBottom, 0.55), 4));
    gr.addColorStop(0.25, css(L.color, 2));
    gr.addColorStop(1, css(L.color, -12));
    g.fillStyle = gr;
    g.fillRect(0, hy, W, H - hy);
    // Swell lines.
    for (let y = hy + 2; y < H; y += 2 + (y - hy) * 0.06) {
      for (let x = rng.range(-20, 0); x < W; x += rng.range(10, 40) * (1 + (y - hy) * 0.01)) {
        g.fillStyle = css(L.color, rng.chance(0.5) ? 10 : -8, 0.35);
        g.fillRect(x, y, rng.range(4, 20) * (1 + (y - hy) * 0.02), 0.7);
      }
    }
    // Distant headland with a lighthouse.
    const side = rng.chance(0.5) ? 0 : 1;
    const hx0 = side ? W * rng.range(0.62, 0.75) : 0;
    const hx1 = side ? W : W * rng.range(0.25, 0.38);
    g.fillStyle = css(L.detail);
    g.beginPath();
    g.moveTo(hx0 - (side ? 30 : 0), hy + 1);
    for (let x = hx0; x <= hx1; x += 6) {
      const t = (x - hx0) / (hx1 - hx0);
      const k = side ? t : 1 - t;
      g.lineTo(x, hy - Math.min(1, k * 2.4) * 22 - Math.sin(x * 0.08) * 2);
    }
    g.lineTo(hx1 + (side ? 0 : 30), hy + 1);
    g.fill();
    const lx = side ? hx0 + (hx1 - hx0) * 0.55 : hx0 + (hx1 - hx0) * 0.45;
    const ly = hy - 22;
    g.fillStyle = css(hsl3(0, 0, 92), -15);
    g.beginPath();
    g.moveTo(lx - 3.5, ly);
    g.lineTo(lx - 2.2, ly - 22);
    g.lineTo(lx + 2.2, ly - 22);
    g.lineTo(lx + 3.5, ly);
    g.fill();
    g.fillStyle = css(hsl3(0, 70, 45), -10);
    g.fillRect(lx - 3, ly - 8, 6, 3);
    g.fillRect(lx - 2.5, ly - 16, 5, 3);
    g.fillStyle = css(L.detail, -10);
    g.fillRect(lx - 3, ly - 26, 6, 4);
    g.beginPath();
    g.moveTo(lx - 3.5, ly - 26);
    g.lineTo(lx, ly - 30);
    g.lineTo(lx + 3.5, ly - 26);
    g.fill();
    if (e) {
      e.fillStyle = css(L.glow, 10, 0.95);
      e.fillRect(lx - 2, ly - 25.5, 4, 3);
    }
    feats.push({ kind: 'beam', x: lx, y: ly - 24, s: 1, color: L.glow, phase: rng.range(0, 6) });
    // Sun/moon glitter path.
    if (th.celestial.kind === 'sun' || th.celestial.kind === 'moon') {
      feats.push({ kind: 'glint', x: th.celestial.x * W, y: hy, s: th.celestial.kind === 'sun' ? 1 : 0.6, color: th.celestial.glow, phase: 0, h: H - hy });
    }
    // Distant sails.
    for (let i = 0; i < rng.int(1, 3); i++) {
      const sx = rng.range(W * 0.1, W * 0.9);
      g.fillStyle = css(L.detail, -5);
      g.fillRect(sx - 4, hy - 1.5, 8, 1.5);
      g.fillStyle = css(mixHsl(L.detail, th.skyBottom, 0.4), 10);
      g.beginPath();
      g.moveTo(sx, hy - 1.5);
      g.lineTo(sx, hy - 9);
      g.lineTo(sx + 4, hy - 1.5);
      g.fill();
    }
  },
};

const ships: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, H, rng, feats, th } = c;
    const wy = L.base * H + 6;
    // Strip of harbor water under the hulls so parallax never shows a gap.
    const sea0 = th.layers[0]?.color ?? L.color;
    g.fillStyle = vgrad(g, wy, H, css(sea0, -2), css(sea0, -14));
    g.fillRect(0, wy, W, H - wy);
    let x = rng.range(10, 60);
    while (x < W - 30) {
      const big = rng.chance(0.55);
      const len = big ? rng.range(70, 100) : rng.range(26, 40);
      const hh = big ? 9 : 5;
      // Hull.
      g.fillStyle = css(L.color);
      g.beginPath();
      g.moveTo(x, wy - hh);
      g.lineTo(x + len, wy - hh - (big ? 4 : 1));
      g.quadraticCurveTo(x + len - 6, wy + 2, x + len * 0.75, wy + 2);
      g.lineTo(x + 8, wy + 2);
      g.quadraticCurveTo(x + 2, wy, x, wy - hh);
      g.fill();
      g.fillStyle = css(L.detail, -25, 0.8);
      g.fillRect(x + 4, wy - hh + 2, len - 10, 1);
      if (big) {
        // Masts, yards, sails & rigging.
        const masts = rng.int(2, 3);
        g.strokeStyle = css(L.color, 2);
        g.lineWidth = 0.6;
        for (let m = 0; m < masts; m++) {
          const mx = x + len * (0.25 + (m * 0.5) / Math.max(1, masts - 1));
          const mh = rng.range(48, 64) * (m === 1 ? 1.1 : 0.9);
          g.fillStyle = css(L.color);
          g.fillRect(mx - 0.8, wy - hh - mh, 1.6, mh);
          for (let s = 0; s < 3; s++) {
            const sy = wy - hh - mh + 6 + s * mh * 0.28;
            const sw = 18 - s * 2 - m;
            g.fillRect(mx - sw / 2, sy, sw, 1);
            if (rng.chance(0.7)) {
              g.fillStyle = css(L.detail, rng.range(-6, 6), 0.95);
              g.beginPath();
              g.moveTo(mx - sw / 2 + 1, sy + 1);
              g.quadraticCurveTo(mx, sy + mh * 0.22 + 3, mx + sw / 2 - 1, sy + 1);
              g.lineTo(mx + sw / 2 - 2, sy + mh * 0.2);
              g.lineTo(mx - sw / 2 + 2, sy + mh * 0.2);
              g.fill();
              g.fillStyle = css(L.color);
            }
          }
          g.beginPath();
          g.moveTo(mx, wy - hh - mh);
          g.lineTo(x + 2, wy - hh);
          g.moveTo(mx, wy - hh - mh);
          g.lineTo(x + len + 10, wy - hh - 6);
          g.stroke();
          if (m === 0) feats.push({ kind: 'flag', x: mx, y: wy - hh - mh, s: 0.8, color: hsl3(rng.pick([0, 210, 45]), 70, 45), phase: rng.range(0, 6) });
        }
        // Bowsprit.
        g.beginPath();
        g.moveTo(x + len - 2, wy - hh - 3);
        g.lineTo(x + len + 16, wy - hh - 10);
        g.stroke();
        windows(c, x + 6, wy - hh + 3, len - 16, 5, 1.6, 1.6, 4, 1, L.lit);
      } else {
        g.fillStyle = css(L.color);
        g.fillRect(x + len * 0.4, wy - hh - 20, 1.2, 20);
        g.fillStyle = css(L.detail, 0, 0.9);
        g.beginPath();
        g.moveTo(x + len * 0.4 + 1.5, wy - hh - 19);
        g.lineTo(x + len * 0.4 + 1.5, wy - hh - 1);
        g.lineTo(x + len * 0.85, wy - hh - 1);
        g.fill();
      }
      // Reflection.
      g.fillStyle = css(L.color, 0, 0.35);
      for (let r = 0; r < 5; r++) g.fillRect(x + 6 + r * 2, wy + 3 + r * 2.4, len - 16 - r * 4, 1);
      x += len + rng.range(20, 60);
    }
    // Buoys / posts.
    for (let i = 0; i < 6; i++) {
      const bx = rng.range(0, W);
      g.fillStyle = css(L.color, 4);
      g.fillRect(bx, wy - 5, 2, 8);
    }
  },
};

const docks: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, H, rng, feats } = c;
    const by = (x: number) => c.ridge(x) + 8;
    ground(c, 16, 6, css(L.color, -4));
    let x = rng.range(-10, 20);
    while (x < W) {
      const y = by(x);
      const kind = rng.weighted([
        ['warehouse', 3],
        ['crane', 1.2],
        ['stack', 1.5],
        ['lamp', 1],
      ] as const);
      if (kind === 'warehouse') {
        const w = rng.range(40, 70);
        const h = rng.range(22, 34);
        g.fillStyle = css(L.color);
        g.fillRect(x, y - h, w, h + 20);
        g.fillStyle = css(L.detail, -4);
        g.beginPath();
        g.moveTo(x - 3, y - h);
        g.lineTo(x + w / 2, y - h - w * 0.2);
        g.lineTo(x + w + 3, y - h);
        g.fill();
        g.fillStyle = css(L.color, -8);
        g.fillRect(x + w * 0.35, y - h * 0.65, w * 0.3, h * 0.65);
        windows(c, x, y - h, w, h * 0.6, 3, 2.5, 4, 3, L.lit);
        x += w + rng.range(4, 16);
      } else if (kind === 'crane') {
        const h = rng.range(60, 85);
        const dir = rng.sign();
        g.strokeStyle = css(L.color, 2);
        g.lineWidth = 1.1;
        g.beginPath();
        g.moveTo(x - 5, y);
        g.lineTo(x - 2, y - h);
        g.moveTo(x + 5, y);
        g.lineTo(x + 2, y - h);
        for (let k = 0; k < h; k += 7) {
          g.moveTo(x - 5 + (k / h) * 3, y - k);
          g.lineTo(x + 5 - ((k + 7) / h) * 3, y - k - 7);
        }
        g.moveTo(x - dir * 14, y - h + 2);
        g.lineTo(x + dir * 55, y - h - 8);
        g.lineTo(x, y - h - 14);
        g.lineTo(x - dir * 14, y - h + 2);
        g.stroke();
        g.lineWidth = 0.6;
        g.beginPath();
        g.moveTo(x + dir * 44, y - h - 6);
        g.lineTo(x + dir * 44, y - h + 24);
        g.stroke();
        g.fillStyle = css(L.detail, 0);
        g.fillRect(x + dir * 44 - 5, y - h + 24, 10, 6);
        feats.push({ kind: 'blink', x: x + dir * 55, y: y - h - 8, s: 1, color: hsl3(0, 100, 55), phase: rng.range(0, 6) });
        x += rng.range(40, 70);
      } else if (kind === 'stack') {
        for (let i = 0; i < rng.int(3, 6); i++) {
          const w = rng.range(8, 14);
          const h = rng.range(6, 9);
          const sx = x + (i % 3) * 10 + rng.range(-2, 2);
          const sy = y - h * (1 + Math.floor(i / 3));
          g.fillStyle = css(rng.chance(0.5) ? L.detail : L.color, rng.range(-6, 4));
          g.fillRect(sx, sy, w, h);
          g.fillStyle = css(L.color, -10, 0.5);
          g.fillRect(sx, sy, w, 0.6);
        }
        x += rng.range(34, 50);
      } else {
        g.fillStyle = css(L.color, 2);
        g.fillRect(x, y - 24, 1.4, 24);
        g.fillRect(x - 2, y - 25, 5.4, 1.4);
        feats.push({ kind: 'flicker', x: x + 0.7, y: y - 23, s: 1, color: L.glow, phase: rng.range(0, 6), w: 3, h: 2.5 });
        x += rng.range(20, 50);
      }
    }
    // Pier with posts in front.
    const py = H * (L.base + 0.06);
    g.fillStyle = css(L.color, -2);
    g.fillRect(0, py, W, 3);
    for (let px = 0; px < W; px += 18) g.fillRect(px, py, 2.5, H - py);
  },
};

const cave: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, e, L, W, H, rng } = c;
    const near = L.depth > 0.25;
    // Floor mounds with stalagmites.
    ground(c, 10);
    for (let x = rng.range(0, 20); x < W; x += rng.range(12, 40)) {
      const y = c.ridge(x) + 12;
      const h = rng.range(10, near ? 40 : 30);
      const w = h * rng.range(0.25, 0.4);
      g.fillStyle = css(L.color, rng.range(-3, 4));
      g.beginPath();
      g.moveTo(x - w, y + 4);
      g.quadraticCurveTo(x - w * 0.3, y - h * 0.4, x, y - h);
      g.quadraticCurveTo(x + w * 0.3, y - h * 0.4, x + w, y + 4);
      g.fill();
    }
    // Ceiling with stalactites.
    const ceil = (x: number) => H * (near ? 0.07 : 0.14) + Math.sin(x * 0.02 + L.phases[0]) * 10 + Math.sin(x * 0.07 + L.phases[1]) * 5;
    g.fillStyle = vgrad(g, 0, H * 0.25, css(L.color, -4), css(L.color, 3));
    g.beginPath();
    g.moveTo(-2, -2);
    for (let x = -2; x <= W + 6; x += 6) g.lineTo(x, ceil(x));
    g.lineTo(W + 2, -2);
    g.fill();
    for (let x = rng.range(0, 10); x < W; x += rng.range(6, 26)) {
      const y = ceil(x) - 2;
      const h = rng.range(6, near ? 46 : 32);
      const w = h * rng.range(0.15, 0.3);
      g.fillStyle = css(L.color, rng.range(-2, 4));
      g.beginPath();
      g.moveTo(x - w, y);
      g.quadraticCurveTo(x - w * 0.2, y + h * 0.5, x, y + h);
      g.quadraticCurveTo(x + w * 0.2, y + h * 0.5, x + w, y);
      g.fill();
    }
    // Crystal clusters.
    if (e) {
      for (let i = 0; i < 14; i++) {
        if (!rng.chance(L.lit)) continue;
        const onCeil = rng.chance(0.4);
        const x = rng.range(0, W);
        const y = onCeil ? ceil(x) : c.ridge(x) + 10;
        const n = rng.int(2, 4);
        for (let k = 0; k < n; k++) {
          const a = (onCeil ? Math.PI / 2 : -Math.PI / 2) + rng.range(-0.6, 0.6);
          const len = rng.range(4, near ? 12 : 8);
          const bx = x + rng.range(-3, 3);
          g.fillStyle = css(L.glow, -25);
          g.beginPath();
          g.moveTo(bx - 1.5, y);
          g.lineTo(bx + Math.cos(a) * len, y + Math.sin(a) * len);
          g.lineTo(bx + 1.5, y);
          g.fill();
          e.fillStyle = css(L.glow, 0, 0.75);
          e.beginPath();
          e.moveTo(bx - 1, y);
          e.lineTo(bx + Math.cos(a) * len, y + Math.sin(a) * len);
          e.lineTo(bx + 1, y);
          e.fill();
        }
        const gr = e.createRadialGradient(x, y, 0, x, y, 26);
        gr.addColorStop(0, css(L.glow, 0, 0.3));
        gr.addColorStop(1, css(L.glow, 0, 0));
        e.fillStyle = gr;
        e.fillRect(x - 26, y - 26, 52, 52);
      }
    }
  },
};

const mineshaft: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, rng, feats } = c;
    ground(c, 14);
    const wood = L.detail;
    let x = rng.range(0, 30);
    while (x < W) {
      const y = c.ridge(x) + 14;
      const kind = rng.weighted([
        ['trestle', 2],
        ['frame', 2],
        ['ladder', 1],
      ] as const);
      if (kind === 'trestle') {
        const w = rng.range(60, 110);
        const h = rng.range(28, 46);
        g.strokeStyle = css(wood, -6);
        g.lineWidth = 2;
        g.beginPath();
        for (let px = x; px <= x + w; px += 20) {
          g.moveTo(px, y);
          g.lineTo(px + 2, y - h);
        }
        g.stroke();
        g.lineWidth = 1;
        g.beginPath();
        for (let px = x; px < x + w; px += 20) {
          g.moveTo(px, y - 4);
          g.lineTo(px + 20, y - h + 4);
          g.moveTo(px + 20, y - 4);
          g.lineTo(px, y - h + 4);
        }
        g.stroke();
        g.fillStyle = css(wood, -2);
        g.fillRect(x - 4, y - h - 3, w + 8, 3);
        g.fillStyle = css(hsl3(220, 8, 40), 0, 0.9);
        g.fillRect(x - 4, y - h - 4, w + 8, 0.8);
        if (rng.chance(0.6)) {
          // Minecart silhouette.
          const mx = x + rng.range(10, w - 20);
          g.fillStyle = css(L.color, 4);
          g.fillRect(mx, y - h - 10, 12, 6);
          circle(g, mx + 3, y - h - 4, 1.6);
          circle(g, mx + 9, y - h - 4, 1.6);
        }
        x += w + rng.range(16, 40);
      } else if (kind === 'frame') {
        const w = rng.range(20, 30);
        const h = rng.range(26, 36);
        g.fillStyle = css(wood, -8);
        g.fillRect(x, y - h, 3, h);
        g.fillRect(x + w - 3, y - h, 3, h);
        g.fillStyle = css(wood, -4);
        g.fillRect(x - 3, y - h - 3, w + 6, 4);
        feats.push({ kind: 'flicker', x: x + w / 2, y: y - h + 6, s: 1, color: L.glow, phase: rng.range(0, 6), w: 2.5, h: 3.5 });
        g.strokeStyle = css(wood, -14);
        g.lineWidth = 0.5;
        g.beginPath();
        g.moveTo(x + w / 2, y - h + 1);
        g.lineTo(x + w / 2, y - h + 4.5);
        g.stroke();
        x += w + rng.range(30, 60);
      } else {
        const h = rng.range(40, 70);
        g.strokeStyle = css(wood, -6);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y - h);
        g.moveTo(x + 6, y);
        g.lineTo(x + 6, y - h);
        for (let k = 3; k < h; k += 4) {
          g.moveTo(x, y - k);
          g.lineTo(x + 6, y - k);
        }
        g.stroke();
        x += rng.range(30, 60);
      }
    }
  },
};

const skyscrapers: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, e, L, W, H, rng, feats } = c;
    const far = L.depth < 0.1;
    let x = rng.range(-10, 0);
    while (x < W) {
      const w = rng.range(far ? 14 : 18, far ? 34 : 44);
      const top = c.ridge(x) - rng.range(0, H * (far ? 0.18 : 0.22));
      g.fillStyle = vgrad(g, top, H, css(L.color, 4), css(L.color, -4));
      g.fillRect(x, top, w, H - top);
      // Stepped crown / spire.
      const crown = rng.int(0, 4);
      if (crown === 1) {
        g.fillRect(x + w * 0.15, top - 6, w * 0.7, 6);
        g.fillRect(x + w * 0.3, top - 11, w * 0.4, 5);
      } else if (crown === 2) {
        g.beginPath();
        g.moveTo(x, top);
        g.lineTo(x + w / 2, top - w * 0.5);
        g.lineTo(x + w, top);
        g.fill();
      } else if (crown === 3) {
        g.fillRect(x + w / 2 - 0.6, top - 22, 1.2, 22);
        feats.push({ kind: 'blink', x: x + w / 2, y: top - 22, s: 1, color: hsl3(0, 100, 55), phase: rng.range(0, 6) });
      }
      // Light edge.
      g.fillStyle = css(L.color, 8, 0.6);
      g.fillRect(x, top, 1, H - top);
      if (e) {
        const cw = far ? 1.5 : 2;
        const ch = far ? 2 : 2.5;
        windows(c, x, top, w, H - top, cw, ch, far ? 2 : 2.5, far ? 2 : 2.5, L.lit, false);
        if (!far && rng.chance(0.3)) {
          // Vertical neon sign.
          const sx = rng.chance(0.5) ? x - 3 : x + w - 1;
          const sy = top + rng.range(8, 30);
          const sh = rng.range(16, 34);
          const col = rng.chance(0.6) ? L.detail : hsl3(rng.pick([190, 320, 50, 140]), 100, 60);
          g.fillStyle = 'rgba(10,8,16,0.95)';
          g.fillRect(sx, sy, 4, sh);
          feats.push({ kind: 'flicker', x: sx + 2, y: sy + sh / 2, s: 1, color: col, phase: rng.range(0, 20), w: 3, h: sh - 2 });
        }
      }
      x += w + rng.range(far ? 0 : 1, far ? 4 : 8);
    }
  },
};

const rooftops: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, H, rng, feats } = c;
    let x = rng.range(-10, 0);
    while (x < W) {
      const w = rng.range(40, 90);
      const top = c.ridge(x) - rng.range(0, 24);
      g.fillStyle = css(L.color);
      g.fillRect(x, top, w, H - top);
      g.fillStyle = css(L.color, 6);
      g.fillRect(x - 1, top - 2, w + 2, 2);
      windows(c, x, top + 4, w, H - top, 3, 4, 4, 4, L.lit * 0.6);
      let rx = x + rng.range(2, 10);
      while (rx < x + w - 10) {
        const k = rng.weighted([
          ['tower', 1],
          ['ac', 2],
          ['sign', 0.8],
          ['antenna', 1],
          ['gap', 2],
        ] as const);
        if (k === 'tower') {
          // Water tower.
          g.fillStyle = css(L.color, 2);
          g.fillRect(rx + 1, top - 10, 1, 10);
          g.fillRect(rx + 9, top - 10, 1, 10);
          g.fillRect(rx, top - 22, 11, 12);
          g.beginPath();
          g.moveTo(rx - 1, top - 22);
          g.lineTo(rx + 5.5, top - 28);
          g.lineTo(rx + 12, top - 22);
          g.fill();
          rx += 16;
        } else if (k === 'ac') {
          g.fillStyle = css(L.color, 3);
          g.fillRect(rx, top - 6, 9, 6);
          if (rng.chance(0.4)) feats.push({ kind: 'steam', x: rx + 4, y: top - 6, s: 0.7, color: hsl3(0, 0, 80), phase: rng.range(0, 10) });
          rx += 12;
        } else if (k === 'sign') {
          const sw = rng.range(20, 34);
          g.fillStyle = css(L.color, 2);
          g.fillRect(rx + 3, top - 8, 1, 8);
          g.fillRect(rx + sw - 4, top - 8, 1, 8);
          g.fillStyle = 'rgba(8,6,14,0.95)';
          g.fillRect(rx, top - 20, sw, 12);
          feats.push({
            kind: 'flicker',
            x: rx + sw / 2,
            y: top - 14,
            s: 1,
            color: rng.chance(0.5) ? L.detail : hsl3(rng.pick([50, 190, 140]), 100, 60),
            phase: rng.range(0, 20),
            w: sw - 4,
            h: 8,
          });
          rx += sw + 4;
        } else if (k === 'antenna') {
          g.fillStyle = css(L.color, 2);
          g.fillRect(rx, top - 26, 1, 26);
          g.fillRect(rx - 3, top - 18, 7, 0.8);
          feats.push({ kind: 'blink', x: rx + 0.5, y: top - 26, s: 1, color: hsl3(0, 100, 55), phase: rng.range(0, 6) });
          rx += 8;
        } else rx += rng.range(6, 14);
      }
      x += w + rng.range(2, 14);
    }
  },
};

// ---- legacy generic kinds (kept for variety / other themes) ---------------

const spires: SkylineDef = {
  glow: false,
  bake(c) {
    const { g, L, W, H, rng } = c;
    g.fillStyle = vgrad(g, H * 0.3, H, css(L.color, 6), css(L.color, -8));
    let x = 0;
    while (x < W) {
      const w = rng.range(8, 26);
      const top = c.ridge(x) - rng.range(0, H * 0.18);
      g.beginPath();
      g.moveTo(x, H);
      g.lineTo(x, top + w);
      g.lineTo(x + w / 2, top - rng.range(4, 26));
      g.lineTo(x + w, top + w);
      g.lineTo(x + w, H);
      g.fill();
      x += w + rng.range(-4, 10);
    }
  },
};

const mesas: SkylineDef = {
  glow: false,
  bake(c) {
    const { g, L, W, H } = c;
    g.fillStyle = vgrad(g, H * 0.4, H, css(L.color, 6), css(L.color, -8));
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 6) g.lineTo(x, Math.round(c.ridge(x) / 14) * 14);
    g.lineTo(W, H);
    g.fill();
  },
};

const city: SkylineDef = { glow: true, bake: (c) => skyscrapers.bake(c) };
const forest: SkylineDef = { glow: false, bake: (c) => canopy.bake(c) };
const islands: SkylineDef = { glow: false, bake: (c) => karst.bake(c) };
const crystals: SkylineDef = { glow: true, bake: (c) => cave.bake(c) };

export const SKYLINES: Record<SkylineKind, SkylineDef> = {
  mountains,
  spires,
  mesas,
  city,
  forest,
  islands,
  crystals,
  hills,
  farmstead,
  fields,
  industry,
  refinery,
  castle,
  ramparts,
  karst,
  canopy,
  volcano,
  crags,
  sea,
  ships,
  docks,
  cave,
  mineshaft,
  skyscrapers,
  rooftops,
};
