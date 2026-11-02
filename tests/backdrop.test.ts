import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { generateTheme } from '../src/gen/theme';
import type { SkylineKind } from '../src/gen/theme/types';
import { type Feature, ridgeOf, SKYLINES } from '../src/render/skylines';
import { VIEW_H, VIEW_W } from '../src/sim/constants';
import { THEME_IDS } from '../src/themes';

/**
 * Backdrop landmarks stand on the ground: a lighthouse, a windmill, a crane or a castle with air under it
 * reads as a mistake at once. Each skyline layer is baked into a recording context that rasterizes every
 * opaque fill, and every sizeable shape it painted must be connected to the bottom of the layer (or the
 * top, for things that hang: a cave's ceiling, a jungle's canopy). Layers of things that really float
 * (the aurora, the planet, stations and rocks in orbit) are not checked.
 */

const FLOATS: ReadonlySet<SkylineKind> = new Set<SkylineKind>(['aurora', 'planet', 'orbital', 'debris']);
/** Smaller than this (in px) is a mark or a light, not a landmark. */
const MIN_CELLS = 24;

/** Opacity of a fill style, from the forms css() and the bakers write. */
function alphaOf(style: string): number {
  const slash = /\/\s*([\d.]+)\)$/.exec(style);
  if (slash) return Number(slash[1]);
  const rgba = /^rgba\([^)]*,\s*([\d.]+)\)$/.exec(style);
  if (rgba) return Number(rgba[1]);
  return 1;
}

/** Just enough of a 2D context to rasterize what the skyline bakers fill, into a coverage grid. */
function recorder(w: number, h: number) {
  const cover = new Uint8Array(w * h);
  let subs: { x: number; y: number }[][] = [];
  let cur: { x: number; y: number }[] | null = null;
  const pt = (x: number, y: number) => {
    if (!cur) subs.push((cur = []));
    cur.push({ x, y });
  };
  const arcPts = (cx: number, cy: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw: boolean) => {
    let span = a1 - a0;
    if (ccw && span > 0) span -= Math.PI * 2;
    if (!ccw && span < 0) span += Math.PI * 2;
    if (Math.abs(a1 - a0) >= Math.PI * 2) span = ccw ? -Math.PI * 2 : Math.PI * 2;
    const n = Math.max(6, Math.ceil(Math.abs(span) * 4));
    for (let i = 0; i <= n; i++) {
      const a = a0 + (span * i) / n;
      const x = Math.cos(a) * rx;
      const y = Math.sin(a) * ry;
      pt(cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot));
    }
  };
  let clip: Uint8Array | null = null;
  const clips: (Uint8Array | null)[] = [];
  const raster = (poly: readonly { x: number; y: number }[], into = cover, mask = clip) => {
    if (poly.length < 3) return;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of poly) {
      y0 = Math.min(y0, p.y);
      y1 = Math.max(y1, p.y);
    }
    const xs: number[] = [];
    for (let row = Math.max(0, Math.floor(y0)); row < Math.min(h, Math.ceil(y1)); row++) {
      for (const sy of [row + 0.25, row + 0.75]) {
        xs.length = 0;
        for (let i = 0; i < poly.length; i++) {
          const a = poly[i];
          const b = poly[(i + 1) % poly.length];
          if (a.y <= sy !== b.y <= sy) xs.push(a.x + ((sy - a.y) / (b.y - a.y)) * (b.x - a.x));
        }
        xs.sort((p, q) => p - q);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          // Any cell the span touches: a thin leg still joins what it holds up.
          for (let x = Math.max(0, Math.floor(xs[k])); x < Math.min(w, Math.ceil(xs[k + 1])); x++) if (!mask || mask[row * w + x]) into[row * w + x] = 1;
        }
      }
    }
  };
  const state = { fillStyle: '#000' as string, globalCompositeOperation: 'source-over', globalAlpha: 1 };
  const solid = () => state.globalCompositeOperation === 'source-over' && state.globalAlpha >= 0.95 && alphaOf(state.fillStyle) >= 0.95;
  const api: Record<string, unknown> = {
    beginPath: () => {
      subs = [];
      cur = null;
    },
    moveTo: (x: number, y: number) => {
      subs.push((cur = [{ x, y }]));
    },
    lineTo: pt,
    closePath: () => {
      cur = null;
    },
    rect: (x: number, y: number, rw: number, rh: number) => {
      subs.push([
        { x, y },
        { x: x + rw, y },
        { x: x + rw, y: y + rh },
        { x, y: y + rh },
      ]);
      cur = null;
    },
    arc: (x: number, y: number, r: number, a0: number, a1: number, ccw = false) => arcPts(x, y, r, r, 0, a0, a1, ccw),
    ellipse: (x: number, y: number, rx: number, ry: number, rot: number, a0: number, a1: number, ccw = false) => arcPts(x, y, rx, ry, rot, a0, a1, ccw),
    quadraticCurveTo: (cx: number, cy: number, x: number, y: number) => {
      const p = cur?.[cur.length - 1] ?? { x, y };
      for (let i = 1; i <= 8; i++) {
        const t = i / 8;
        pt((1 - t) * (1 - t) * p.x + 2 * (1 - t) * t * cx + t * t * x, (1 - t) * (1 - t) * p.y + 2 * (1 - t) * t * cy + t * t * y);
      }
    },
    fill: () => {
      if (solid()) for (const s of subs) raster(s);
    },
    save: () => clips.push(clip),
    restore: () => {
      clip = clips.pop() ?? null;
    },
    clip: () => {
      const m = new Uint8Array(w * h);
      for (const s of subs) raster(s, m, null);
      if (clip) for (let i = 0; i < m.length; i++) m[i] &= clip[i];
      clip = m;
    },
    fillRect: (x: number, y: number, rw: number, rh: number) => {
      if (solid())
        raster([
          { x, y },
          { x: x + rw, y },
          { x: x + rw, y: y + rh },
          { x, y: y + rh },
        ]);
    },
  };
  const g = new Proxy(state as unknown as CanvasRenderingContext2D, {
    get: (_t, k: string) => (k in api ? api[k] : k in state ? (state as Record<string, unknown>)[k] : () => {}),
    set: (_t, k: string, v) => {
      (state as Record<string, unknown>)[k] = v;
      return true;
    },
  });
  return { g, cover };
}

/** Sizeable opaque shapes that touch neither the bottom of the layer nor its top. */
function floaters(cover: Uint8Array, w: number, h: number): { box: string; n: number }[] {
  const seen = new Uint8Array(w * h);
  const out: { box: string; n: number }[] = [];
  const stack: number[] = [];
  for (let i = 0; i < w * h; i++) {
    if (!cover[i] || seen[i]) continue;
    let n = 0;
    let grounded = false;
    let x0 = w;
    let y0 = h;
    let x1 = 0;
    let y1 = 0;
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const j = stack.pop()!;
      n++;
      const x = j % w;
      const y = (j - x) / w;
      // The top and bottom are ground and ceiling; the sides are only where the bake stops, past what parallax ever shows.
      if (y === 0 || y === h - 1 || x === 0 || x === w - 1) grounded = true;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      // Eight ways round: a thin diagonal (a stay, a brace) steps corner to corner.
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          const k = ny * w + nx;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h && cover[k] && !seen[k]) {
            seen[k] = 1;
            stack.push(k);
          }
        }
      }
    }
    if (!grounded && n >= MIN_CELLS) out.push({ box: `${x0},${y0}..${x1},${y1}`, n });
  }
  return out;
}

describe('backdrop skylines', () => {
  // A 16:9 window's bake, and a tall one (a phone held upright) where the layer runs on below the view.
  for (const [label, H, seeds] of [
    ['16:9', VIEW_H, [2, 6, 0x5eed]],
    ['tall', Math.round(VIEW_H * 1.5), [3]],
  ] as const) {
    it(`never leaves a landmark floating (${label} window)`, () => {
      const W = Math.ceil(VIEW_W * 1.36);
      const bad: string[] = [];
      for (const id of THEME_IDS) {
        for (const seed of seeds) {
          const th = generateTheme(seed, id);
          for (const L of th.layers) {
            if (FLOATS.has(L.kind)) continue;
            const { g, cover } = recorder(W, H);
            const feats: Feature[] = [];
            SKYLINES[L.kind].bake({ g, e: SKYLINES[L.kind].glow ? recorder(1, 1).g : null, L, th, W, H, rng: new Rng(L.seed), feats, ridge: ridgeOf(L) });
            for (const f of floaters(cover, W, H)) bad.push(`${id} seed ${seed} ${L.kind}: ${f.n} px floating in ${f.box}`);
          }
        }
      }
      expect(bad).toEqual([]);
    });
  }
});
