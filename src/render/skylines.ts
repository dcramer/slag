import { css, type HSL, hsl3, mixHsl, shift } from '../core/color';
import type { Rng } from '../core/rng';
import type { SkyLayer, SkylineKind, Theme } from '../gen/theme';
import { VIEW_H, VIEW_W } from '../sim/constants';
import { line, type P, stroke } from './ink';
import { circle, ellipse } from './kit';
import {
  along,
  backward,
  crenPts,
  SINK,
  cubic,
  fillPts,
  inkOf,
  mark,
  penPath,
  penW,
  type Puff,
  puffs,
  quad,
  ridgeGround,
  shape,
  slab,
  slabPts,
  ticks,
} from './skyline-ink';
import { FRONTIER_SKYLINES } from './skylines-frontier';

/**
 * Parallax skyline bakers, one per SkylineKind. Each paints a silhouette layer once into an offscreen
 * canvas (albedo `g` + optional emissive `e`) and may register animated `features` (smoke, windmill
 * blades, lighthouse beam, blinking lights…) that the backdrop animates per frame cheaply.
 *
 * They draw in the play layer's ink (docs/ART.md, World art), turned down for distance: flat tones with
 * the shadow side cut as a shape, a pen whose weight comes from the layer's depth (`penW`), and few
 * marks. Lit windows come in runs along a floor, not as a field of dots: the backdrop must never
 * sparkle louder than the parts and runners in front of it.
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

/** A layer's ridge: px from the top at x. It keeps its place in the view however tall the layer is; only what's under it runs on. */
export function ridgeOf(L: SkyLayer): (x: number) => number {
  return (x) => {
    const u = x / VIEW_W;
    let h = L.base;
    L.freqs.forEach((f, i) => (h += Math.sin(u * f * Math.PI * 2 + L.phases[i]) * L.amp * (1 / (i + 1))));
    return h * VIEW_H;
  };
}

export interface SkylineDef {
  glow: boolean;
  bake(c: BakeCtx): void;
}

// ---------------------------------------------------------------------------
// Helpers

/**
 * Heights are measured against the play view, never the bake: on a tall window the layer runs on down
 * (`H` grows) but its horizon, ridge and landmarks keep their place, like `ridge` does.
 */
const V = VIEW_H;

/**
 * The layer's ground under its ridge (plus `offset`): flat, a cut shade band, the pen on the crest. A layer
 * with things standing on it draws this last, over their feet (which run `SINK` deep): whatever the slope
 * or the offset, nothing can stand above its ground.
 */
function ground(c: BakeCtx, offset = 0, band = 12, color?: HSL) {
  ridgeGround(c.g, c.W, c.H, (x) => c.ridge(x) + offset, color ?? c.L.color, penW(c.L.depth), c.L.seed, band);
}

/**
 * Lit windows on a facade: a floor lights up as a run of a few windows, never as scattered dots, and
 * each pane sits a hair off the grid. `p` is the chance a floor has a lit run.
 */
function windows(c: BakeCtx, x: number, y: number, w: number, h: number, cw: number, ch: number, gx: number, gy: number, p: number, warm = true) {
  const { e, rng, L } = c;
  if (!e || p <= 0) return;
  const cols = Math.floor((w - gx) / (cw + gx));
  if (cols < 1) return;
  for (let wy = y + gy; wy < y + h - ch - 1; wy += ch + gy) {
    if (!rng.chance(p)) continue;
    const run = Math.min(cols, rng.int(1, 3));
    const at = rng.int(0, cols - run);
    const col = warm ? shift(L.glow, rng.range(-8, 6), 0, rng.range(-8, 8)) : hsl3(rng.pick([45, 50, 190, 40]), 75, 66);
    e.fillStyle = css(col, 0, rng.range(0.55, 0.9));
    for (let k = 0; k < run; k++) {
      const wx = x + gx + (at + k) * (cw + gx);
      e.fillRect(wx + rng.range(-0.25, 0.25), wy + rng.range(-0.2, 0.2), cw * rng.range(0.85, 1), ch);
    }
  }
}

/** A round tree: a crown of puffs on a trunk. */
function tree(c: BakeCtx, x: number, y: number, r: number, body: HSL, lit: HSL, pen: number) {
  const { g, rng } = c;
  g.fillStyle = css(body, -10);
  line(g, x, y + 12, x + rng.range(-0.6, 0.6), y - r * 0.5, { w: Math.max(1, r * 0.22), seed: rng.int(0, 999), taper: [0, 0.4], press: 0.2 });
  const ps: Puff[] = [];
  const n = 3 + Math.floor(r / 4);
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(0, r * 0.5);
    ps.push({ x: x + Math.cos(a) * d, y: y - r * 0.75 + Math.sin(a) * d * 0.6, r: r * rng.range(0.42, 0.62) });
  }
  puffs(g, ps, shift(body, -4), lit, pen * 0.8, rng.int(0, 1e6));
}

/** A pitched roof over `x..x+w` from `y`, rising `rise`: lit on the left slope, shade on the right. */
function roof(c: BakeCtx, x: number, y: number, w: number, rise: number, col: HSL, pen: number, over = 2) {
  const pts: P[] = [
    { x: x - over, y: y + 0.5 },
    { x: x + w / 2, y: y - rise },
    { x: x + w + over, y: y + 0.5 },
  ];
  shape(c.g, pts, col, pen, c.rng.int(0, 1e6), { shade: -8, cut: 0.5 });
}

/** A straight member (a pipe, a beam, a leg) as a pen ribbon in `col`. */
function bar(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, col: string, seed: number) {
  g.fillStyle = col;
  line(g, ax, ay, bx, by, { w, seed, taper: [0.04, 0.08], press: 0.15 });
}

// ---------------------------------------------------------------------------
// Skylines

/** Peaks down a crest: each right flank cut into shade, snow on the highest tops, the pen along the line. */
function peaksOn(c: BakeCtx, crest: P[], snowAbove: number | null) {
  const { g, L, H } = c;
  const pen = penW(L.depth);
  fillPts(g, [...crest, { x: crest[crest.length - 1].x, y: H + 2 }, { x: crest[0].x, y: H + 2 }], css(L.color));
  g.save();
  g.beginPath();
  crest.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.lineTo(crest[crest.length - 1].x, H + 2);
  g.lineTo(crest[0].x, H + 2);
  g.closePath();
  g.clip();
  // Find each top and the valley after it: the flank between them is in shade.
  for (let i = 1; i < crest.length - 1; i++) {
    if (!(crest[i].y <= crest[i - 1].y && crest[i].y < crest[i + 1].y)) continue;
    let j = i + 1;
    while (j < crest.length - 1 && crest[j + 1].y >= crest[j].y) j++;
    const top = crest[i];
    const low = crest[j];
    fillPts(g, [...crest.slice(i, j + 1), { x: low.x - (low.x - top.x) * 0.25, y: H + 2 }, { x: top.x + 2, y: H + 2 }], css(L.color, -6));
    if (snowAbove !== null && top.y < snowAbove) {
      const depth = (snowAbove - top.y) * 0.9 + 3;
      const half = depth * 1.4;
      const snow: P[] = [];
      for (let k = 0; k <= 6; k++) {
        const u = k / 6;
        const x = top.x - half + half * 2 * u;
        let y = top.y;
        for (const p of crest) if (Math.abs(p.x - x) < 2.5) y = Math.max(y, p.y);
        snow.push({ x, y: y - 1 });
      }
      for (let k = 6; k >= 0; k--) {
        const u = k / 6;
        const x = top.x - half + half * 2 * u;
        snow.push({ x, y: top.y + depth * (1 - Math.abs(u - 0.5) * 1.6) + c.rng.range(-2.5, 2.5) });
      }
      fillPts(g, snow, css(hsl3(L.color.h, 15, Math.min(95, L.color.l + 42))));
    }
  }
  g.restore();
  penPath(g, crest, false, { w: pen, col: inkOf(L.color), seed: L.seed, run: 36, lift: 0.3 });
}

const mountains: SkylineDef = {
  glow: false,
  bake(c) {
    const { L, W } = c;
    const crest = along(-4, W + 4, 4, (x) => {
      const r = Math.abs(Math.sin(x * 0.013 + L.phases[0]) * 0.5 + Math.sin(x * 0.031 + L.phases[1]) * 0.3);
      return c.ridge(x) - r * V * L.amp * 1.4;
    });
    const minY = Math.min(...crest.map((p) => p.y));
    peaksOn(c, crest, minY + V * 0.06);
  },
};

const hills: SkylineDef = {
  glow: false,
  bake(c) {
    const { g, L, W, rng } = c;
    const pen = penW(L.depth);
    for (let band = 0; band < 2; band++) {
      const off = band * V * 0.05;
      const col = shift(L.color, band ? -5 : 3);
      const f = (x: number) => c.ridge(x + band * 140) + off;
      ridgeGround(g, W, c.H, f, col, pen, L.seed + band, 9);
      // A few little trees on the crest.
      for (let x = rng.range(0, 30); x < W; x += rng.range(18, 60)) {
        const y = f(x);
        const r = rng.range(2.2, 4);
        puffs(g, [{ x, y: y - r * 0.6, r }], shift(col, -6), shift(col, -2), 0, 0);
      }
    }
  },
};

const farmstead: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, rng, feats } = c;
    const pen = penW(L.depth);
    const body = L.color;
    const lit = shift(L.color, 14);
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
        slab(g, x, y - h, w, y, shift(red, -6), pen, rng.int(0, 1e6));
        // Gambrel roof.
        shape(
          g,
          [
            { x: x - 2, y: y - h + 0.5 },
            { x: x + w * 0.15, y: y - h - w * 0.22 },
            { x: x + w * 0.5, y: y - h - w * 0.36 },
            { x: x + w * 0.85, y: y - h - w * 0.22 },
            { x: x + w + 2, y: y - h + 0.5 },
          ],
          shift(red, -18),
          pen,
          rng.int(0, 1e6),
          { shade: -7, cut: 0.5 },
        );
        // The door's frame and brace, in paint.
        const paint = css(hsl3(40, 20, 80), -10, 0.85);
        const dw = w * 0.32;
        const dx = x + w / 2 - dw / 2;
        for (const [ax, ay, bx, by] of [
          [dx, y, dx, y - h * 0.7],
          [dx, y - h * 0.7, dx + dw, y - h * 0.7],
          [dx + dw, y - h * 0.7, dx + dw, y],
          [dx, y - h * 0.7, dx + dw, y],
          [dx + dw, y - h * 0.7, dx, y],
        ])
          bar(g, ax, ay, bx, by, 0.8, paint, rng.int(0, 999));
        x += w + rng.range(8, 30);
      } else if (kind === 'silo') {
        const w = rng.range(8, 11);
        const h = rng.range(30, 44);
        const col = hsl3(210, 8, Math.max(20, body.l + 20));
        if (rng.chance(0.6)) slab(g, x - w * 0.9, y - h * 0.45, w * 0.9, y, shift(L.detail, -10), pen, rng.int(0, 1e6));
        const pts = slabPts(x, y - h, w, y + 30, rng.int(0, 1e6));
        quad(pts, x + w, y - h + 1, x + w / 2, y - h - w * 0.95, x, y - h + 1, 6);
        shape(g, pts, col, pen, rng.int(0, 1e6), { shade: -9, cut: 0.6, foot: y });
        for (let i = 1; i < 5; i++)
          mark(
            g,
            along(x + 0.8, x + w - 0.8, 2, () => y - (h * i) / 5),
            css(col, -18),
            0.55,
            i,
          );
        x += w + rng.range(6, 26);
      } else if (kind === 'windmill') {
        const h = rng.range(36, 46);
        const col = hsl3(30, 15, Math.max(18, body.l + 22));
        shape(
          g,
          [
            { x: x - 6.5, y: y + SINK },
            { x: x - 3, y: y - h },
            { x: x + 3, y: y - h },
            { x: x + 6.5, y: y + SINK },
          ],
          shift(col, -6),
          pen,
          rng.int(0, 1e6),
          { shade: -8, foot: y },
        );
        shape(
          g,
          [
            { x: x - 4.5, y: y - h + 0.5 },
            { x, y: y - h - 6 },
            { x: x + 4.5, y: y - h + 0.5 },
          ],
          shift(col, -16),
          pen * 0.8,
          rng.int(0, 1e6),
        );
        feats.push({ kind: 'windmill', x, y: y - h - 1, s: h * 0.55, color: hsl3(40, 25, Math.min(90, body.l + 45)), phase: rng.range(0, 6) });
        x += rng.range(30, 50);
      } else if (kind === 'house') {
        const w = rng.range(18, 24);
        const h = w * 0.55;
        const col = shift(body, 10, -10);
        slab(g, x + w * 0.68, y - h - w * 0.36, 3.2, y - h, shift(col, -10), pen * 0.7, rng.int(0, 1e6), -7, 4);
        slab(g, x, y - h, w, y, col, pen, rng.int(0, 1e6));
        roof(c, x, y - h, w, w * 0.35, shift(L.detail, -22), pen);
        feats.push({ kind: 'smoke', x: x + w * 0.68 + 1.6, y: y - h - w * 0.36, s: 0.6, color: hsl3(30, 10, 80), phase: rng.range(0, 10) });
        windows(c, x, y - h, w, h, 2.8, 3.2, 3, 2.5, L.lit);
        x += w + rng.range(10, 30);
      } else {
        const n = rng.int(2, 5);
        for (let i = 0; i < n; i++) {
          // Each tree stands where the ground is under it, not where its clump began.
          const ty = c.ridge(x) + 2;
          if (rng.chance(0.3)) {
            // Poplar: a column of puffs close enough to touch, from the ground up.
            const h = rng.range(16, 24);
            const col: Puff[] = [];
            for (let k = 0; k <= 5; k++)
              col.push({ x: x + (k === 5 ? 0.3 : 0), y: ty - 1 - (h - 3) * (k / 5), r: k === 5 ? 2.4 : 2.6 + Math.sin((k / 5) * Math.PI) * 0.8 });
            puffs(g, col, shift(body, -12), shift(body, -4), pen * 0.8, rng.int(0, 1e6));
          } else tree(c, x, ty, rng.range(6, 10), shift(body, -6), lit, pen);
          x += rng.range(6, 12);
        }
        x += rng.range(8, 24);
      }
    }
    ground(c, 0, 10);
  },
};

const fields: SkylineDef = {
  glow: false,
  bake(c) {
    const { g, L, W, H, rng } = c;
    const pen = penW(L.depth);
    ground(c, 0, 0);
    g.save();
    g.beginPath();
    g.moveTo(-2, H);
    for (let x = -2; x <= W + 6; x += 6) g.lineTo(x, c.ridge(x));
    g.lineTo(W + 2, H);
    g.clip();
    // Patchwork of crop fields following the ridge, a few furrows each, a hedge between.
    let x = 0;
    while (x < W) {
      const w = rng.range(50, 130);
      const col = rng.chance(0.45) ? L.detail : shift(L.color, rng.range(-3, 7), 0, rng.range(-12, 12));
      fillPts(g, [...along(x, x + w, 8, c.ridge), { x: x + w, y: H }, { x, y: H }], css(col));
      // Far half of the field in a second tone, cut along a furrow.
      const cut = 6 + rng.range(4, 10);
      fillPts(g, [...along(x, x + w, 8, (xx) => c.ridge(xx) + cut), { x: x + w, y: H }, { x, y: H }], css(col, -4));
      for (let r = 0; r < 5; r++) {
        const yo = 3 + r * (4 + r * 1.6);
        const a = x + rng.range(2, 14);
        const b = x + w - rng.range(2, 14);
        if (b > a + 6)
          mark(
            g,
            along(a, b, 6, (xx) => c.ridge(xx) + yo),
            css(col, -12, 0.8),
            0.45,
            rng.int(0, 999),
          );
      }
      // Hedgerow: a column of bushes down the slope, smaller as it goes.
      const hp: Puff[] = [];
      for (let yy = 0; yy < 28; yy += 5) hp.push({ x: x + w + rng.range(-1, 1), y: c.ridge(x + w) + yy, r: 3 - yy * 0.06 });
      puffs(g, hp, shift(L.color, -12), shift(L.color, -6), pen * 0.6, rng.int(0, 1e6));
      x += w + 4;
    }
    g.restore();
    // Round hay bales and bushes along the crest.
    for (let x2 = rng.range(0, 40); x2 < W; x2 += rng.range(30, 90)) {
      const y = c.ridge(x2);
      if (rng.chance(0.55)) {
        for (let i = 0; i < rng.int(1, 3); i++) {
          const bx = x2 + i * 9;
          const by = Math.max(c.ridge(bx - 4), c.ridge(bx), c.ridge(bx + 4));
          slab(g, bx - 4, by - 6.5, 8, by + 0.5, shift(L.detail, -14), pen * 0.8, rng.int(0, 1e6), -8, 1);
          const face: P[] = [];
          for (let k = 0; k < 10; k++) face.push({ x: bx + 2.4 + Math.cos((k / 10) * Math.PI * 2) * 1.8, y: by - 3 + Math.sin((k / 10) * Math.PI * 2) * 2.8 });
          fillPts(g, face, css(L.detail, 4));
          mark(g, [face[2], face[5], face[8]], css(L.detail, -16), 0.4, i);
        }
      } else {
        const bp: Puff[] = [];
        for (let i = 0; i < 4; i++) bp.push({ x: x2 + i * 3, y: y - 1.5, r: 3.2 - Math.abs(i - 1.5) * 0.5 });
        puffs(g, bp, shift(L.color, -14), shift(L.color, -7), pen * 0.7, rng.int(0, 1e6));
      }
    }
  },
};

const industry: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, rng, feats } = c;
    const pen = penW(L.depth);
    const by = (x: number) => c.ridge(x) + 6;
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
        // Sawtooth roof as one outline with the walls.
        const tooth = rng.range(8, 12);
        const pts: P[] = [
          { x, y: y + 30 },
          { x, y: y - h },
        ];
        for (let tx = x; tx < x + w - 0.1; tx += tooth) {
          pts.push({ x: tx + tooth * 0.75, y: y - h - tooth * 0.55 }, { x: tx + tooth * 0.75 + 0.3, y: y - h }, { x: Math.min(x + w, tx + tooth), y: y - h });
        }
        pts.push({ x: x + w, y: y + 30 });
        shape(g, pts, L.color, pen, rng.int(0, 1e6), { shade: -6, foot: y + 10 });
        if (c.e && L.lit > 0) {
          for (let tx = x; tx < x + w - 0.1; tx += tooth) {
            if (!rng.chance(L.lit)) continue;
            fillPts(
              c.e,
              [
                { x: tx + tooth * 0.75, y: y - h - tooth * 0.45 },
                { x: tx + tooth * 0.75, y: y - h },
                { x: tx + tooth * 0.25, y: y - h },
              ],
              css(L.glow, rng.range(-8, 4), 0.55),
            );
          }
        }
        windows(c, x, y - h, w, h, 4, 2.5, 3, 3, L.lit * 0.5);
        x += w + rng.range(2, 12);
      } else if (kind === 'stack') {
        const n = rng.int(1, 3);
        const h0 = rng.range(50, 90);
        for (let i = 0; i < n; i++) {
          const w = rng.range(5, 8);
          const h = h0 * rng.range(0.8, 1.05);
          const sx = x + i * (w + rng.range(3, 8));
          shape(
            g,
            [
              { x: sx - 1.2, y: y + SINK },
              { x: sx + 0.6, y: y - h },
              { x: sx + w - 0.6, y: y - h },
              { x: sx + w + 1.2, y: y + SINK },
            ],
            L.color,
            pen,
            rng.int(0, 1e6),
            { shade: -6, cut: 0.55, foot: y + 6 },
          );
          mark(
            g,
            along(sx + 0.8, sx + w - 0.8, 2, () => y - h + 1.2),
            css(L.detail, 0, 0.9),
            1.6,
            i,
          );
          mark(
            g,
            along(sx + 0.6, sx + w - 0.6, 2, () => y - h + 7),
            css(L.detail, 0, 0.8),
            1,
            i + 3,
          );
          feats.push({
            kind: 'smoke',
            x: sx + w / 2,
            y: y - h,
            s: w / 5,
            color: mixHsl(hsl3(25, 8, c.th.night ? 30 : 46), c.th.horizon.color, 0.2),
            phase: rng.range(0, 10),
          });
          if (c.e && rng.chance(0.35)) feats.push({ kind: 'blink', x: sx + w / 2, y: y - h - 1.5, s: 1, color: hsl3(0, 100, 55), phase: rng.range(0, 6) });
        }
        x += n * 12 + rng.range(4, 16);
      } else if (kind === 'tank') {
        const r = rng.range(10, 16);
        const pts = slabPts(x, y - r * 1.2, r * 2, y + 30, rng.int(0, 1e6));
        quad(pts, x + r * 2, y - r * 1.2 + 0.5, x + r, y - r * 2, x, y - r * 1.2 + 0.5, 8);
        shape(g, pts, shift(L.color, 2), pen, rng.int(0, 1e6), { shade: -7, cut: 0.6, foot: y + 8 });
        mark(
          g,
          along(x + 1, x + r * 2 - 1, 3, () => y - r * 0.6),
          css(L.detail, 0, 0.6),
          0.9,
          1,
        );
        bar(g, x + r * 2, y - r * 1.2, x + r * 2 + 6, y - r * 1.4, 0.8, css(L.color, 4), 2);
        bar(g, x + r * 2 + 6, y - r * 1.4, x + r * 2 + 6, y + SINK, 0.8, css(L.color, 4), 3);
        x += r * 2 + rng.range(6, 14);
      } else {
        const w = rng.range(20, 34);
        const h = rng.range(26, 46);
        slab(g, x, y - h, w, y + 8, shift(L.color, -2), pen, rng.int(0, 1e6));
        mark(
          g,
          along(x + 1, x + w - 1, 3, () => y - h + 1),
          css(L.detail, 0, 0.7),
          1.1,
          2,
        );
        windows(c, x, y - h, w, h, 3, 4, 3, 3.5, L.lit * 0.8);
        x += w + rng.range(2, 10);
      }
    }
    ground(c, 12, 10, shift(L.color, -3));
  },
};

const refinery: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, rng, feats } = c;
    const pen = penW(L.depth);
    const by = (x: number) => c.ridge(x) + 8;
    // Long pipe runs on a rack, each a ribbon with its pen underneath, its posts down into the ground.
    const rack = by(W / 2) - 6;
    for (let px = rng.range(0, 40); px < W; px += rng.range(50, 90)) bar(g, px, rack - 15, px, Math.max(rack, by(px)) + SINK, 1.4, css(L.color, 1), px);
    for (let i = 0; i < 3; i++) {
      const py = rack - i * 7;
      bar(g, -2, py + 1.6, W + 2, py + 1.6, 1.2, inkOf(L.color), 10 + i);
      bar(g, -2, py, W + 2, py, 2.4, css(L.color, 3 + i * 2), 20 + i);
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
        const pts = slabPts(x, y - h, w, y + 30, rng.int(0, 1e6));
        quad(pts, x + w, y - h + 0.5, x + w / 2, y - h - 5, x, y - h + 0.5, 4);
        shape(g, pts, shift(L.color, 2), pen, rng.int(0, 1e6), { shade: -7, cut: 0.6, foot: y + 4 });
        for (let ry = y - h + 8; ry < y - 4; ry += rng.range(10, 16))
          mark(
            g,
            along(x - 2, x + w + 2, 2, () => ry),
            css(L.detail, 0, 0.85),
            1,
            ry,
          );
        if (c.e)
          for (let ry = y - h + 8; ry < y - 4; ry += 14)
            if (rng.chance(L.lit * 0.6)) {
              c.e.fillStyle = css(L.glow, 0, 0.8);
              c.e.fillRect(x - 2 + rng.range(0, w + 2), ry - 1.4, 1.6, 1.6);
            }
        x += w + rng.range(6, 18);
      } else if (kind === 'gantry') {
        const w = rng.range(30, 50);
        const h = rng.range(26, 44);
        const col = css(L.color, 4);
        const s = rng.int(0, 999);
        bar(g, x, y + SINK, x, y - h, 1.3, col, s);
        bar(g, x + w, y + SINK, x + w, y - h, 1.3, col, s + 1);
        bar(g, x - 6, y - h, x + w + 10, y - h, 1.4, col, s + 2);
        for (let k = 0; k < w; k += 8) bar(g, x + k, y - h, x + k + 6, y - h + 4, 0.6, col, s + k);
        bar(g, x + w * 0.6, y - h, x + w * 0.6, y - h + 16, 0.6, col, s + 3);
        slab(g, x + w * 0.6 - 3, y - h + 14, 6, y - h + 18, shift(L.color, 4), pen * 0.7, s, -7, 1);
        x += w + rng.range(10, 30);
      } else if (kind === 'flare') {
        const h = rng.range(60, 90);
        const col = css(L.color, 2);
        const s = rng.int(0, 999);
        bar(g, x + 1.2, y + SINK, x + 1.2, y - h, 2.4, col, s);
        // Guy wires run on past the foot, under the ground drawn over them.
        bar(g, x - 6 - (7.2 * 12) / (h * 0.6), y + 12, x + 1.2, y - h * 0.6, 0.6, col, s + 1);
        bar(g, x + 8 + (6.8 * 12) / (h * 0.6), y + 12, x + 1.2, y - h * 0.6, 0.6, col, s + 2);
        feats.push({ kind: 'flare', x: x + 1.2, y: y - h, s: 1.2, color: hsl3(28, 100, 60), phase: rng.range(0, 6) });
        x += rng.range(20, 40);
      } else {
        const r = rng.range(8, 12);
        const col = css(L.color, 3);
        bar(g, x + 3, y + SINK, x + 3, y - r, 1.6, col, 1);
        bar(g, x + r * 2 - 3, y + SINK, x + r * 2 - 3, y - r, 1.6, col, 2);
        const ball: P[] = [];
        for (let k = 0; k < 20; k++) ball.push({ x: x + r + Math.cos((k / 20) * Math.PI * 2) * r, y: y - r - 6 + Math.sin((k / 20) * Math.PI * 2) * r });
        shape(g, ball, shift(L.color, 3), pen, rng.int(0, 1e6), { shade: -8, cut: 0.55 });
        fillPts(
          g,
          ball.map((p) => ({ x: x + r * 0.7 + (p.x - x - r) * 0.35, y: y - r * 1.3 - 6 + (p.y - (y - r - 6)) * 0.3 })),
          css(L.detail, 0, 0.4),
        );
        x += r * 2 + rng.range(6, 16);
      }
    }
    ground(c, 14, 10, shift(L.color, -2));
  },
};

const castle: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, rng, feats } = c;
    const pen = penW(L.depth);
    const stone = L.color;
    const roofCol = L.detail;
    // One or two castles across the wide layer.
    const count = rng.int(1, 2);
    for (let k = 0; k < count; k++) {
      const cx = W * (count === 1 ? rng.range(0.35, 0.65) : k === 0 ? rng.range(0.15, 0.35) : rng.range(0.6, 0.85));
      const y = c.ridge(cx) + 6;
      const span = rng.range(110, 170);
      const x0 = cx - span / 2;
      // Curtain wall.
      const wallH = rng.range(16, 22);
      // A wall that long crosses the ridge: it runs down to the lowest ground under it.
      const deep = Math.max(...[0, 0.25, 0.5, 0.75, 1].map((u) => c.ridge(x0 + span * u) + 6)) + SINK;
      shape(g, crenPts(x0, y - wallH, span, deep, 4, 3.5, rng.int(0, 999)), shift(stone, 2), pen, rng.int(0, 1e6), { foot: y + 4 });
      // Keep.
      const kw = rng.range(26, 36);
      const kh = rng.range(48, 64);
      shape(g, crenPts(cx - kw / 2, y - kh, kw, deep, 3.5, 3.5, rng.int(0, 999)), shift(stone, 4), pen, rng.int(0, 1e6), { shade: -7, foot: y });
      windows(c, cx - kw / 2, y - kh, kw, kh - 8, 2, 4, 4, 5, L.lit);
      // Towers.
      const tN = rng.int(3, 5);
      for (let i = 0; i < tN; i++) {
        const tx = x0 + (span * i) / (tN - 1) + rng.range(-4, 4);
        const tw = rng.range(10, 15);
        const th = rng.range(30, 50) * (i === 0 || i === tN - 1 ? 1 : 0.85);
        if (rng.chance(0.65)) {
          slab(g, tx - tw / 2, y - th, tw, y, shift(stone, 6), pen, rng.int(0, 1e6), -7, deep - y);
          const rh = tw * rng.range(1.1, 1.6);
          roof(c, tx - tw / 2, y - th, tw, rh, shift(roofCol, -6), pen);
          bar(g, tx, y - th - rh, tx, y - th - rh - 7, 0.8, css(stone, -10), i);
          feats.push({ kind: 'flag', x: tx, y: y - th - rh - 7, s: 1, color: roofCol, phase: rng.range(0, 6) });
        } else shape(g, crenPts(tx - tw / 2 - 1, y - th, tw + 2, deep, 2.5, 3, rng.int(0, 999)), shift(stone, 6), pen, rng.int(0, 1e6), { shade: -7, foot: y });
        windows(c, tx - tw / 2, y - th, tw, th - 4, 1.8, 3.5, 4, 6, L.lit);
      }
      // Gate.
      const gate: P[] = [
        { x: cx - 5, y: y + 4 },
        { x: cx - 5, y: y - 8 },
      ];
      quad(gate, cx - 5, y - 8, cx, y - 15, cx + 5, y - 8, 6);
      gate.push({ x: cx + 5, y: y + 4 });
      fillPts(g, gate, css(stone, -14));
      if (c.e && L.lit > 0.2) fillPts(c.e, gate, css(L.glow, -10, 0.3));
    }
    ground(c, 6, 10);
  },
};

const ramparts: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, H, rng, feats } = c;
    const pen = penW(L.depth);
    // Terraced wall segments (walls step, they don't undulate), merlons along the top.
    const top = (x: number) => Math.round(c.ridge(Math.floor(x / 48) * 48) / 6) * 6 - 6;
    const crest: P[] = [];
    for (let x = -2; x <= W + 10; x += 5) {
      const up = Math.floor(x / 5) % 2 === 0;
      const y = top(x) - (up ? 5 : 0);
      crest.push({ x, y }, { x: x + 4.8, y });
    }
    fillPts(g, [...crest, { x: W + 12, y: H + 2 }, { x: -2, y: H + 2 }], css(L.color));
    fillPts(g, [...along(-2, W + 12, 6, (x) => top(x) + 12 + Math.sin(x * 0.05) * 2), { x: W + 12, y: H + 2 }, { x: -2, y: H + 2 }], css(L.color, -5));
    penPath(g, crest, false, { w: pen, col: inkOf(L.color), seed: L.seed, run: 30, lift: 0.3 });
    // A few block courses, not a grid of them.
    for (let x = rng.range(0, 20); x < W; x += rng.range(18, 40)) {
      const yy = top(x) + 6 * rng.int(1, 6);
      mark(
        g,
        along(x, x + rng.range(4, 9), 2, () => yy),
        css(L.color, -9),
        0.5,
        x,
      );
    }
    let x = rng.range(20, 80);
    while (x < W) {
      const y = top(x);
      if (rng.chance(0.45)) {
        const tw = rng.range(18, 26);
        const th = rng.range(18, 30);
        shape(g, crenPts(x - tw / 2 - 1, y - th, tw + 2, y + 10, 3.5, 4, rng.int(0, 999)), shift(L.color, 2), pen, rng.int(0, 1e6), { shade: -7, foot: y + 2 });
        fillPts(g, slabPts(x - 1, y - th + 7, 2, y - th + 13, 1), css(L.color, -12));
        feats.push({ kind: 'torch', x: x - tw / 2 - 2, y: y - th * 0.4, s: 1, color: L.glow, phase: rng.range(0, 6) });
        feats.push({ kind: 'torch', x: x + tw / 2 + 2, y: y - th * 0.4, s: 1, color: L.glow, phase: rng.range(0, 6) });
        // Hanging banner.
        shape(
          g,
          [
            { x: x - 4, y: y - th + 15 },
            { x: x + 4, y: y - th + 15 },
            { x: x + 4, y: y - th + 30 },
            { x, y: y - th + 27 },
            { x: x - 4, y: y - th + 30 },
          ],
          shift(L.detail, -4),
          pen * 0.7,
          rng.int(0, 1e6),
          { shade: -8, cut: 0.5 },
        );
        x += tw + rng.range(50, 110);
      } else {
        // Arch with a torch.
        const arch: P[] = [
          { x: x - 6, y: y + 40 },
          { x: x - 6, y: y + 16 },
        ];
        quad(arch, x - 6, y + 16, x, y + 6, x + 6, y + 16, 6);
        arch.push({ x: x + 6, y: y + 40 });
        fillPts(g, arch, css(L.color, -14));
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
    const pen = penW(L.depth);
    let x = rng.range(-10, 20);
    while (x < W) {
      const w = rng.range(18, 40);
      const h = rng.range(50, 130);
      const y = c.ridge(x) + 20;
      const pts: P[] = [{ x, y: y + SINK }];
      cubic(pts, { x, y }, { x: x - w * 0.15, y: y - h * 0.6 }, { x: x + w * 0.1, y: y - h }, { x: x + w * 0.45, y: y - h }, 10);
      cubic(pts, { x: x + w * 0.45, y: y - h }, { x: x + w * 0.9, y: y - h }, { x: x + w * 1.1, y: y - h * 0.5 }, { x: x + w, y }, 10);
      pts.push({ x: x + w, y: y + SINK });
      shape(g, pts, L.color, pen, rng.int(0, 1e6), { shade: -6, cut: 0.58, foot: y });
      // Vegetation tufts on top.
      const tp: Puff[] = [];
      for (let i = 0; i < 4; i++) tp.push({ x: x + w * (0.25 + i * 0.15), y: y - h + rng.range(0, 3), r: rng.range(2.5, 5) });
      puffs(g, tp, shift(L.color, -7), shift(L.color, -2), pen * 0.7, rng.int(0, 1e6));
      x += w * rng.range(0.6, 1.4) + rng.range(4, 40);
    }
    ground(c, 18, 10);
  },
};

const canopy: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, rng } = c;
    const near = L.depth > 0.3;
    const pen = penW(L.depth);
    let x = rng.range(-10, 10);
    while (x < W + 10) {
      const y = c.ridge(x) + 12;
      if (rng.chance(0.18)) {
        // Palm.
        const h = rng.range(40, 70);
        const lean = rng.range(-8, 8);
        const trunk = quad([], x, y, x + lean * 0.3, y - h * 0.5, x + lean, y - h, 8, false);
        g.fillStyle = inkOf(L.color);
        stroke(g, trunk, { w: 3, seed: rng.int(0, 999), taper: [0, 0.5], press: 0.2 });
        g.fillStyle = css(L.color, -2);
        stroke(g, trunk, { w: 2, seed: rng.int(0, 999), taper: [0, 0.5], press: 0.2 });
        for (let i = 0; i < 7; i++) {
          const a = -Math.PI / 2 + (i - 3) * 0.48;
          const len = rng.range(12, 18);
          const tx = x + lean;
          const ty = y - h;
          const frond: P[] = [{ x: tx, y: ty }];
          quad(frond, tx, ty, tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.6 - 4, tx + Math.cos(a) * len, ty + Math.sin(a) * len + len * 0.4, 5);
          quad(frond, tx + Math.cos(a) * len, ty + Math.sin(a) * len + len * 0.4, tx + Math.cos(a) * len * 0.5, ty + Math.sin(a) * len * 0.3, tx, ty + 1.5, 4);
          fillPts(g, frond, css(L.color, i < 3 ? 2 : -3));
          penPath(g, frond.slice(0, 6), false, { w: pen * 0.6, col: inkOf(L.color), seed: i, run: 30, lift: 0 });
        }
        x += rng.range(12, 30);
      } else {
        const r = rng.range(12, 26) * (near ? 1.2 : 1);
        const top = y - r * rng.range(1.2, 2.2);
        slab(g, x - r * 0.12, top, r * 0.24, y + 6, shift(L.color, -6), pen * 0.6, rng.int(0, 1e6), -4);
        const ps: Puff[] = [];
        for (let i = 0; i < 6; i++) ps.push({ x: x + rng.range(-r, r) * 0.75, y: top + rng.range(-r, r) * 0.4, r: r * rng.range(0.5, 0.72) });
        puffs(g, ps, shift(L.color, -4), mixHsl(shift(L.color, 6), L.detail, 0.35), pen, rng.int(0, 1e6));
        x += r * rng.range(0.9, 1.5);
      }
    }
    ground(c, 10, 10);
    // Lianas between trees.
    g.fillStyle = css(L.color, -6, 0.9);
    for (let i = 0; i < 8; i++) {
      const x0 = rng.range(0, W);
      const x1 = x0 + rng.range(30, 70);
      const y0 = c.ridge(x0) - rng.range(10, 40);
      stroke(g, quad([], x0, y0, (x0 + x1) / 2, y0 + rng.range(15, 30), x1, y0 + rng.range(-8, 8), 10, false), {
        w: 0.8,
        seed: i,
        taper: [0.1, 0.1],
        press: 0.3,
      });
    }
    if (near) {
      // Overhead canopy fringe with hanging vines framing the top of the view.
      const fp: Puff[] = [];
      for (let x2 = -10; x2 < W + 10; x2 += rng.range(10, 22)) fp.push({ x: x2, y: rng.range(-12, 4), r: rng.range(10, 22) });
      puffs(g, fp, shift(L.color, -3), shift(L.color, 2), pen, rng.int(0, 1e6), true);
      for (let i = 0; i < 20; i++) {
        const vx = rng.range(0, W);
        const len = rng.range(20, V * 0.3);
        const vine = quad([], vx, 0, vx + rng.range(-6, 6), len * 0.5, vx + rng.range(-3, 3), len, 8, false);
        g.fillStyle = inkOf(L.color, 0.6);
        stroke(g, vine, { w: rng.range(1, 1.6), seed: i, taper: [0, 0.5], press: 0.3 });
        g.fillStyle = css(L.color, 2);
        for (let ly = 8; ly < len; ly += rng.range(6, 11)) ellipse(g, vx + rng.range(-2, 2), ly, 2, 1, rng.range(-1, 1));
      }
    }
    if (c.e && L.lit > 0) {
      for (let i = 0; i < 30 * L.lit; i++) {
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
    const { g, e, L, W, rng, feats } = c;
    const pen = penW(L.depth) * 1.2;
    ground(c, 30, 12);
    const cx = W * rng.range(0.38, 0.62);
    const peakY = V * (L.base - 0.1);
    const baseY = V * (L.base + 0.25);
    const half = rng.range(170, 230);
    const crater = rng.range(14, 20);
    // Secondary peaks behind.
    for (const side of [-1, 1]) {
      const px = cx + side * rng.range(half * 0.8, half * 1.3);
      const ph = V * rng.range(0.1, 0.17);
      const pts: P[] = [{ x: px - 110, y: baseY + 30 }];
      quad(pts, px - 110, baseY + 30, px - 30, baseY - ph * 0.6, px - 6, baseY - ph, 8);
      pts.push({ x: px + 8, y: baseY - ph + 5 });
      quad(pts, px + 8, baseY - ph + 5, px + 40, baseY - ph * 0.5, px + 120, baseY + 30, 8);
      shape(g, pts, shift(L.color, -3), pen * 0.8, rng.int(0, 1e6), { shade: -4, cut: 0.5, foot: baseY + 20 });
    }
    const cone: P[] = [{ x: cx - half * 1.4, y: baseY + 40 }];
    quad(cone, cx - half * 1.4, baseY + 40, cx - half * 0.35, baseY - 10, cx - crater, peakY, 14);
    cone.push({ x: cx - crater * 0.4, y: peakY + 4 }, { x: cx + crater * 0.5, y: peakY + 3 }, { x: cx + crater, y: peakY });
    quad(cone, cx + crater, peakY, cx + half * 0.35, baseY - 10, cx + half * 1.4, baseY + 40, 14);
    fillPts(g, cone, css(L.color, 3));
    g.save();
    g.beginPath();
    cone.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
    g.clip();
    // The shaded flank, cut down from the crater; the lit one keeps the body tone.
    const shade: P[] = [{ x: cx + crater * 0.2, y: peakY + 2 }];
    quad(shade, cx + crater * 0.2, peakY + 2, cx + crater * 2.5, peakY + 70, cx + half * 0.15, baseY + 40, 10);
    shade.push({ x: cx + half * 1.5, y: baseY + 40 }, { x: cx + half * 1.5, y: peakY - 4 });
    fillPts(g, shade, css(L.color, -5));
    // Erosion gullies, a few pen strokes down from the rim.
    for (let i = 0; i < 9; i++) {
      const sx = cx + rng.range(-crater, crater);
      const gully = quad(
        [],
        sx,
        peakY + 6,
        sx + (sx - cx) * 3 + rng.range(-20, 20),
        peakY + 60,
        sx + (sx - cx) * 7 + rng.range(-60, 60),
        baseY + 20,
        10,
        false,
      );
      mark(g, gully.slice(0, rng.int(5, 11)), inkOf(L.color, 0.6), pen * 0.55, i);
    }
    g.restore();
    penPath(g, cone, true, { w: pen, col: inkOf(L.color, 0.5), seed: L.seed, run: 40, lift: 0.25, inside: { x: cx, y: baseY + 60 } });
    if (e) {
      // Lava rivers: tapering ribbons, wandering down from the vent.
      for (let i = 0; i < rng.int(2, 4); i++) {
        let lx = cx + rng.range(-crater * 0.6, crater * 0.6);
        let ly = peakY + 3;
        const dir = lx < cx ? -1 : 1;
        const pts: P[] = [{ x: lx, y: ly }];
        const steps = rng.int(10, 16);
        for (let k = 0; k < steps; k++) {
          lx += dir * rng.range(1, 7) + rng.range(-2, 2);
          ly += rng.range(5, 9);
          pts.push({ x: lx, y: ly });
        }
        e.fillStyle = css(L.glow, 4, 0.8);
        stroke(e, pts, { w: 3.2, seed: i, taper: [0, 0.95], press: 0.5, wobble: 0.6 });
        e.fillStyle = css(L.glow, 22, 0.9);
        stroke(e, pts.slice(0, Math.ceil(pts.length * 0.6)), { w: 1.3, seed: i + 9, taper: [0, 0.9], press: 0.4 });
      }
      e.fillStyle = css(L.glow, 20, 0.9);
      ellipse(e, cx, peakY + 1.5, crater * 0.9, 2.2);
      e.fillStyle = css(L.glow, 8, 0.28);
      ellipse(e, cx, peakY + 1, crater * 1.5, crater * 0.7);
    }
    feats.push({ kind: 'plume', x: cx, y: peakY, s: crater / 14, color: shift(c.th.cloudColor, 4), phase: rng.range(0, 6) });
  },
};

const crags: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, rng } = c;
    const pen = penW(L.depth);
    let x = rng.range(-10, 10);
    while (x < W) {
      const w = rng.range(26, 60);
      const h = rng.range(18, 55);
      const y = c.ridge(x) + 10;
      // Chunky basalt outcrop: irregular polygon with a few facets.
      const pts: P[] = [{ x: x - w / 2, y: y + SINK }];
      const n = rng.int(4, 6);
      const peakAt = rng.range(0.35, 0.65);
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const peak = 1 - Math.abs(t - peakAt) * 1.6;
        pts.push({ x: x - w / 2 + w * t + rng.range(-3, 3), y: y - h * Math.max(0.15, peak) - rng.range(0, 6) });
      }
      pts.push({ x: x + w / 2, y: y + SINK });
      shape(g, pts, shift(L.color, rng.range(-1, 3)), pen, rng.int(0, 1e6), { shade: -4, cut: peakAt, foot: y + 4 });
      // Lit facet: from the left foot up to the top.
      const top = pts.reduce((m, p) => (p.y < m.y ? p : m), pts[0]);
      const facet: P[] = [{ x: x - w / 2, y: y + 6 }];
      for (const p of pts.slice(1)) {
        if (p.x > top.x) break;
        facet.push(p);
      }
      facet.push(top, { x: top.x - w * 0.08, y: y + 6 });
      // Lit by the lava below as much as the sky: the facet warms toward the glow.
      fillPts(g, facet, css(mixHsl(shift(L.color, 7), L.glow, 0.12 * L.lit)));
      x += w * rng.range(0.6, 1.1) + rng.range(0, 20);
    }
    ground(c, 8, 10);
  },
};

const sea: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, e, L, W, H, rng, feats, th } = c;
    const pen = penW(L.depth);
    const hy = L.base * V;
    // Water plane from the horizon down, in three flat bands.
    fillPts(
      g,
      [
        { x: 0, y: hy },
        { x: W, y: hy },
        { x: W, y: H },
        { x: 0, y: H },
      ],
      css(L.color, 9),
    );
    fillPts(g, [...along(0, W, 10, (x) => hy + 6 + Math.sin(x * 0.02 + L.phases[0]) * 1.2), { x: W, y: H }, { x: 0, y: H }], css(L.color, 2));
    fillPts(g, [...along(0, W, 10, (x) => hy + (H - hy) * 0.45 + Math.sin(x * 0.015 + L.phases[1]) * 2), { x: W, y: H }, { x: 0, y: H }], css(L.color, -8));
    // A few swell marks, more of them nearer.
    for (let y = hy + 4; y < H; y += 5 + (y - hy) * 0.12) {
      for (let x = rng.range(-20, 0); x < W; x += rng.range(40, 110) * (1 + (y - hy) * 0.01)) {
        const len = rng.range(5, 16) * (1 + (y - hy) * 0.02);
        mark(
          g,
          along(x, x + len, 2, () => y),
          css(L.color, rng.chance(0.5) ? 12 : -12, 0.6),
          0.6,
          x,
        );
      }
    }
    // Distant headland with a lighthouse.
    const side = rng.chance(0.5) ? 0 : 1;
    const hx0 = side ? W * rng.range(0.62, 0.75) : 0;
    const hx1 = side ? W : W * rng.range(0.25, 0.38);
    const landY = (x: number) => {
      const t = Math.max(0, Math.min(1, (x - hx0) / (hx1 - hx0)));
      return hy - Math.min(1, (side ? t : 1 - t) * 2.4) * 22 - Math.sin(x * 0.08) * 2;
    };
    const land: P[] = [{ x: hx0 - (side ? 30 : 0), y: hy + 1 }];
    for (let x = hx0; x <= hx1; x += 6) land.push({ x, y: landY(x) });
    land.push({ x: hx1 + (side ? 0 : 30), y: hy + 1 });
    // The headland must stand off the sky behind it, or what stands on it seems to hang in the air.
    const rock = Math.abs(L.detail.l - th.skyBottom.l) < 18 ? hsl3(L.detail.h, L.detail.s, Math.max(4, th.skyBottom.l - 20)) : L.detail;
    shape(g, land, rock, pen, rng.int(0, 1e6), { shade: -5, foot: hy });
    // The lighthouse stands on the lowest rock under its foot, sunk into a plinth of rocks that runs on
    // down to the waterline: whatever the headland does under it, there is no air beneath it.
    const lx = side ? hx0 + (hx1 - hx0) * 0.55 : hx0 + (hx1 - hx0) * 0.45;
    const ly = Math.max(landY(lx - 6), landY(lx), landY(lx + 6)) + 1;
    const plinth: P[] = [{ x: lx - 9, y: hy + 1 }];
    for (let k = 0; k <= 6; k++) {
      const u = k / 6;
      plinth.push({ x: lx - 8 + 16 * u + rng.range(-0.8, 0.8), y: ly - 2.5 - Math.sin(u * Math.PI) * 2 + rng.range(-0.8, 0.8) });
    }
    plinth.push({ x: lx + 9, y: hy + 1 });
    shape(
      g,
      [
        { x: lx - 3.5, y: ly + 2 },
        { x: lx - 2.2, y: ly - 22 },
        { x: lx + 2.2, y: ly - 22 },
        { x: lx + 3.5, y: ly + 2 },
      ],
      shift(hsl3(0, 0, 92), -15),
      pen * 0.8,
      7,
      { shade: -14, cut: 0.6, foot: ly - 3 },
    );
    shape(g, plinth, shift(rock, -4), pen * 0.8, 9, { shade: -6, cut: 0.55, foot: hy });
    g.fillStyle = css(hsl3(0, 70, 45), -10);
    g.fillRect(lx - 3, ly - 8, 6, 3);
    g.fillRect(lx - 2.5, ly - 16, 5, 3);
    shape(
      g,
      [
        { x: lx - 3, y: ly - 22 },
        { x: lx - 3, y: ly - 26 },
        { x: lx, y: ly - 30 },
        { x: lx + 3, y: ly - 26 },
        { x: lx + 3, y: ly - 22 },
      ],
      shift(L.detail, -10),
      pen * 0.7,
      8,
    );
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
      fillPts(g, slabPts(sx - 4, hy - 1.5, 8, hy, i), css(L.detail, -5));
      fillPts(
        g,
        [
          { x: sx, y: hy - 1.5 },
          { x: sx, y: hy - 9 },
          { x: sx + 4, y: hy - 1.5 },
        ],
        css(mixHsl(L.detail, th.skyBottom, 0.4), 10),
      );
    }
  },
};

const ships: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, H, rng, feats, th } = c;
    const pen = penW(L.depth);
    const wy = L.base * V + 6;
    // Strip of harbor water under the hulls so parallax never shows a gap.
    const sea0 = th.layers[0]?.color ?? L.color;
    fillPts(
      g,
      [
        { x: 0, y: wy },
        { x: W, y: wy },
        { x: W, y: H },
        { x: 0, y: H },
      ],
      css(sea0, -2),
    );
    fillPts(g, [...along(0, W, 10, (x) => wy + 14 + Math.sin(x * 0.02) * 2), { x: W, y: H }, { x: 0, y: H }], css(sea0, -10));
    const ink = inkOf(L.color);
    let x = rng.range(10, 60);
    while (x < W - 30) {
      const big = rng.chance(0.55);
      const len = big ? rng.range(70, 100) : rng.range(26, 40);
      const hh = big ? 9 : 5;
      if (big) {
        // Masts, yards, sails and rigging, behind the hull.
        const masts = rng.int(2, 3);
        for (let m = 0; m < masts; m++) {
          const mx = x + len * (0.25 + (m * 0.5) / Math.max(1, masts - 1));
          const mh = rng.range(48, 64) * (m === 1 ? 1.1 : 0.9);
          bar(g, mx, wy - hh, mx, wy - hh - mh, 1.6, css(L.color), m);
          for (let s = 0; s < 3; s++) {
            const sy = wy - hh - mh + 6 + s * mh * 0.28;
            const sw = 18 - s * 2 - m;
            if (rng.chance(0.7)) {
              const sail: P[] = [{ x: mx - sw / 2 + 1, y: sy + 1 }];
              quad(sail, mx - sw / 2 + 1, sy + 1, mx, sy + mh * 0.22 + 3, mx + sw / 2 - 1, sy + 1, 6);
              sail.push({ x: mx + sw / 2 - 2, y: sy + mh * 0.2 }, { x: mx - sw / 2 + 2, y: sy + mh * 0.2 });
              shape(g, sail, shift(L.detail, rng.range(-6, 6)), pen * 0.7, rng.int(0, 1e6), { shade: -9, cut: 0.55 });
            }
            bar(g, mx - sw / 2, sy, mx + sw / 2, sy, 1, css(L.color), s);
          }
          bar(g, mx, wy - hh - mh, x + 2, wy - hh, 0.4, ink, m + 5);
          bar(g, mx, wy - hh - mh, x + len + 10, wy - hh - 6, 0.4, ink, m + 6);
          if (m === 0) feats.push({ kind: 'flag', x: mx, y: wy - hh - mh, s: 0.8, color: hsl3(rng.pick([0, 210, 45]), 70, 45), phase: rng.range(0, 6) });
        }
        bar(g, x + len - 2, wy - hh - 3, x + len + 16, wy - hh - 10, 0.9, css(L.color), 9);
      } else {
        bar(g, x + len * 0.4, wy - hh, x + len * 0.4, wy - hh - 20, 1.2, css(L.color), 1);
        shape(
          g,
          [
            { x: x + len * 0.4 + 0.4, y: wy - hh - 19 },
            { x: x + len * 0.4 + 0.4, y: wy - hh - 1 },
            { x: x + len * 0.85, y: wy - hh - 1 },
          ],
          L.detail,
          pen * 0.6,
          rng.int(0, 1e6),
        );
      }
      // Hull.
      const hull: P[] = [
        { x, y: wy - hh },
        { x: x + len, y: wy - hh - (big ? 4 : 1) },
      ];
      quad(hull, x + len, wy - hh - (big ? 4 : 1), x + len - 6, wy + 2, x + len * 0.75, wy + 2, 5);
      hull.push({ x: x + 8, y: wy + 2 });
      quad(hull, x + 8, wy + 2, x + 2, wy, x, wy - hh, 4);
      shape(g, hull, L.color, pen, rng.int(0, 1e6), { shade: -5 });
      mark(
        g,
        along(x + 4, x + len - 6, 3, (xx) => wy - hh + 2 - ((xx - x) / len) * (big ? 4 : 1)),
        css(L.detail, -25, 0.8),
        0.9,
        4,
      );
      if (big) windows(c, x + 6, wy - hh + 3, len - 16, 5, 1.8, 1.8, 4, 1, L.lit);
      // Reflection: a few broken strokes.
      for (let r = 0; r < 3; r++)
        mark(
          g,
          along(x + 6 + r * 3, x + len - 10 - r * 6, 3, () => wy + 4 + r * 3),
          css(L.color, 0, 0.4),
          0.9,
          r,
        );
      x += len + rng.range(20, 60);
    }
    // Buoys / posts.
    for (let i = 0; i < 6; i++) slab(g, rng.range(0, W), wy - 5, 2, wy + 2, shift(L.color, 4), pen * 0.5, i, -7, 2);
  },
};

const docks: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, H, rng, feats } = c;
    const pen = penW(L.depth);
    const by = (x: number) => c.ridge(x) + 8;
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
        slab(g, x, y - h, w, y + 8, L.color, pen, rng.int(0, 1e6));
        roof(c, x, y - h, w, w * 0.2, shift(L.detail, -4), pen, 3);
        fillPts(g, slabPts(x + w * 0.35, y - h * 0.65, w * 0.3, y + SINK, 3), css(L.color, -9));
        windows(c, x, y - h, w, h * 0.6, 3.5, 2.5, 4, 3, L.lit);
        x += w + rng.range(4, 16);
      } else if (kind === 'crane') {
        const h = rng.range(60, 85);
        const dir = rng.sign();
        const col = css(L.color, 2);
        const s = rng.int(0, 999);
        bar(g, x - 5.4, y + SINK, x - 2, y - h, 1.2, col, s);
        bar(g, x + 5.4, y + SINK, x + 2, y - h, 1.2, col, s + 1);
        for (let k = 0; k < h; k += 9) bar(g, x - 5 + (k / h) * 3, y - k, x + 5 - ((k + 9) / h) * 3, y - k - 9, 0.6, col, s + k);
        bar(g, x - dir * 14, y - h + 2, x + dir * 55, y - h - 8, 1.3, col, s + 2);
        bar(g, x + dir * 55, y - h - 8, x, y - h - 14, 0.7, col, s + 3);
        bar(g, x, y - h - 14, x - dir * 14, y - h + 2, 0.7, col, s + 4);
        bar(g, x + dir * 44, y - h - 6, x + dir * 44, y - h + 27, 0.6, col, s + 5);
        slab(g, x + dir * 44 - 5, y - h + 24, 10, y - h + 30, L.detail, pen * 0.7, s, -7, 1);
        feats.push({ kind: 'blink', x: x + dir * 55, y: y - h - 8, s: 1, color: hsl3(0, 100, 55), phase: rng.range(0, 6) });
        x += rng.range(40, 70);
      } else if (kind === 'stack') {
        // Containers in three columns, each set down on the one under it.
        const tops = [y, y, y];
        for (let i = 0; i < rng.int(3, 6); i++) {
          const w = rng.range(8, 14);
          const h = rng.range(6, 9);
          const sx = x + (i % 3) * 10 + rng.range(-2, 2);
          const sy = tops[i % 3] - h;
          tops[i % 3] = sy;
          shape(
            g,
            slabPts(sx, sy, w, i < 3 ? y + SINK : sy + h + 0.5, i),
            shift(rng.chance(0.5) ? L.detail : L.color, rng.range(-6, 4)),
            pen * 0.7,
            rng.int(0, 1e6),
            { shade: -7 },
          );
        }
        x += rng.range(34, 50);
      } else {
        bar(g, x + 0.7, y + SINK, x + 0.7, y - 24, 1.4, css(L.color, 2), 1);
        bar(g, x - 2, y - 24.3, x + 3.4, y - 24.3, 1.4, css(L.color, 2), 2);
        feats.push({ kind: 'flicker', x: x + 0.7, y: y - 23, s: 1, color: L.glow, phase: rng.range(0, 6), w: 3, h: 2.5 });
        x += rng.range(20, 50);
      }
    }
    ground(c, 16, 10, shift(L.color, -4));
    // The quay ends in a pier over the harbor: dark water under the deck, pilings standing in it with a
    // brace here and there, a few seams on the deck. It turns the band under the sheds into things
    // without filling it with marks.
    const py = V * (L.base + 0.06);
    const water = mixHsl(shift(c.th.layers[0]?.color ?? L.color, -4), L.color, 0.3);
    fillPts(
      g,
      [
        { x: -2, y: py + 2 },
        { x: W + 4, y: py + 2 },
        { x: W + 4, y: H + 2 },
        { x: -2, y: H + 2 },
      ],
      css(water),
    );
    for (let k = 0; k < W / 70; k++) {
      const x = rng.range(0, W);
      const y = py + rng.range(10, 40);
      mark(
        g,
        along(x, x + rng.range(6, 14), 2, () => y),
        css(water, 7, 0.8),
        0.7,
        k,
      );
    }
    for (let px = 0; px < W; px += 18) {
      slab(g, px, py + 3, 2.6, H, shift(L.color, 5), pen * 0.6, px, -6);
      if (Math.floor(px / 18) % 3 === 1) bar(g, px + 2.4, py + 4, px + 18, py + 16, 0.8, css(L.color, 3), px);
    }
    fillPts(g, slabPts(-2, py - 1, W + 4, py + 3.5, 9), css(L.color, 4));
    for (let x = rng.range(0, 20); x < W; x += rng.range(16, 34))
      mark(
        g,
        [
          { x, y: py - 0.4 },
          { x: x + 0.2, y: py + 3 },
        ],
        inkOf(L.color, 0.7),
        0.5,
        x,
      );
    penPath(
      g,
      along(-2, W + 2, 6, () => py - 1),
      false,
      { w: pen, col: inkOf(L.color), seed: 4, run: 40 },
    );
  },
};

const cave: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, e, L, W, rng } = c;
    const near = L.depth > 0.25;
    const pen = penW(L.depth);
    // Floor mounds with stalagmites.
    for (let x = rng.range(0, 20); x < W; x += rng.range(12, 40)) {
      const y = c.ridge(x) + 12;
      const h = rng.range(10, near ? 40 : 30);
      const w = h * rng.range(0.25, 0.4);
      const pts: P[] = [{ x: x - w, y: y + 4 }];
      quad(pts, x - w, y + 4, x - w * 0.3, y - h * 0.4, x, y - h, 6);
      quad(pts, x, y - h, x + w * 0.3, y - h * 0.4, x + w, y + 4, 6);
      shape(g, pts, shift(L.color, rng.range(-2, 4)), pen, rng.int(0, 1e6), { shade: -6, cut: 0.5, foot: y + 2 });
    }
    ground(c, 10, 10);
    // Ceiling with stalactites.
    const ceil = (x: number) => V * (near ? 0.07 : 0.14) + Math.sin(x * 0.02 + L.phases[0]) * 10 + Math.sin(x * 0.07 + L.phases[1]) * 5;
    for (let x = rng.range(0, 10); x < W; x += rng.range(8, 30)) {
      const y = ceil(x) - 2;
      const h = rng.range(6, near ? 46 : 32);
      const w = h * rng.range(0.15, 0.3);
      const pts: P[] = [{ x: x - w, y }];
      quad(pts, x - w, y, x - w * 0.2, y + h * 0.5, x, y + h, 6);
      quad(pts, x, y + h, x + w * 0.2, y + h * 0.5, x + w, y, 6);
      shape(g, pts, shift(L.color, rng.range(-2, 4)), pen * 0.85, rng.int(0, 1e6), { shade: -6, cut: 0.5, foot: y + h + 1 });
    }
    const roofLine = along(-2, W + 6, 6, ceil);
    fillPts(g, [{ x: -2, y: -2 }, ...roofLine, { x: W + 6, y: -2 }], css(L.color, -2));
    fillPts(g, [{ x: -2, y: -2 }, ...along(-2, W + 6, 6, (x) => ceil(x) - 8 - Math.sin(x * 0.04) * 3), { x: W + 6, y: -2 }], css(L.color, -6));
    penPath(g, backward(roofLine), false, { w: pen, col: inkOf(L.color), seed: L.seed + 1, run: 36 });
    // Crystal clusters: their glow is the emissive layer's to bloom, not a gradient here.
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
          const shard: P[] = [
            { x: bx - 1.5, y },
            { x: bx + Math.cos(a) * len, y: y + Math.sin(a) * len },
            { x: bx + 1.5, y },
          ];
          fillPts(g, shard, css(L.glow, -25));
          fillPts(
            e,
            shard.map((p) => ({ x: bx + (p.x - bx) * 0.7, y: y + (p.y - y) * 0.95 })),
            css(L.glow, 0, 0.75),
          );
        }
        e.fillStyle = css(L.glow, 0, 0.12);
        ellipse(e, x, y, 14, 9);
      }
    }
  },
};

const mineshaft: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, rng, feats } = c;
    const pen = penW(L.depth);
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
        const col = css(wood, -6);
        for (let px = x; px <= x + w; px += 20) bar(g, px - 0.2, y + SINK, px + 2, y - h, 2, col, px);
        for (let px = x; px < x + w; px += 20) {
          bar(g, px, y - 4, px + 20, y - h + 4, 0.9, col, px + 1);
          bar(g, px + 20, y - 4, px, y - h + 4, 0.9, col, px + 2);
        }
        slab(g, x - 4, y - h - 3, w + 8, y - h, shift(wood, -2), pen, rng.int(0, 1e6), -5, 1);
        mark(
          g,
          along(x - 4, x + w + 4, 4, () => y - h - 3.6),
          css(hsl3(220, 8, 40), 0, 0.9),
          0.8,
          1,
        );
        if (rng.chance(0.6)) {
          // Minecart.
          const mx = x + rng.range(10, w - 20);
          slab(g, mx, y - h - 10, 12, y - h - 4, shift(L.color, 4), pen * 0.8, rng.int(0, 1e6), -7, 1);
          g.fillStyle = inkOf(L.color);
          circle(g, mx + 3, y - h - 4, 1.6);
          circle(g, mx + 9, y - h - 4, 1.6);
        }
        x += w + rng.range(16, 40);
      } else if (kind === 'frame') {
        const w = rng.range(20, 30);
        const h = rng.range(26, 36);
        slab(g, x, y - h, 3, y, shift(wood, -8), pen * 0.8, rng.int(0, 1e6), -4);
        slab(g, x + w - 3, y - h, 3, y, shift(wood, -8), pen * 0.8, rng.int(0, 1e6), -4);
        slab(g, x - 3, y - h - 3, w + 6, y - h + 1, shift(wood, -4), pen, rng.int(0, 1e6), -5, 1);
        feats.push({ kind: 'flicker', x: x + w / 2, y: y - h + 6, s: 1, color: L.glow, phase: rng.range(0, 6), w: 2.5, h: 3.5 });
        bar(g, x + w / 2, y - h + 1, x + w / 2, y - h + 4.5, 0.5, css(wood, -14), 1);
        x += w + rng.range(30, 60);
      } else {
        const h = rng.range(40, 70);
        const col = css(wood, -6);
        bar(g, x, y + SINK, x, y - h, 1, col, 1);
        bar(g, x + 6, y + SINK, x + 6, y - h, 1, col, 2);
        for (let k = 3; k < h; k += 5) bar(g, x, y - k, x + 6, y - k, 0.7, col, k);
        x += rng.range(30, 60);
      }
    }
    ground(c, 14, 10);
  },
};

/**
 * Towers: hand-cut slabs with their shade side cut, a crown on some. The far layer is pure silhouette;
 * nearer, a few floors are lit in runs. Neon is rare: one sign is a city, a dozen is noise.
 */
const skyscrapers: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, L, W, H, rng, feats } = c;
    const far = L.depth < 0.1;
    const pen = penW(L.depth);
    let x = rng.range(-10, 0);
    while (x < W) {
      const w = rng.range(far ? 16 : 20, far ? 36 : 46);
      const top = c.ridge(x) - rng.range(0, V * (far ? 0.18 : 0.22));
      const col = shift(L.color, rng.range(-1.5, 1.5));
      // Crown first, so the body's pen runs over its foot.
      const crown = rng.int(0, 4);
      if (crown === 1) {
        slab(g, x + w * 0.3, top - 11, w * 0.4, top, col, pen * 0.8, rng.int(0, 1e6));
        slab(g, x + w * 0.15, top - 6, w * 0.7, top, col, pen * 0.8, rng.int(0, 1e6));
      } else if (crown === 2) {
        shape(
          g,
          [
            { x, y: top + 1 },
            { x: x + w / 2, y: top - w * 0.5 },
            { x: x + w, y: top + 1 },
          ],
          col,
          pen * 0.8,
          rng.int(0, 1e6),
          { shade: -6, cut: 0.5 },
        );
      } else if (crown === 3) {
        bar(g, x + w / 2, top, x + w / 2, top - 22, 1.1, css(col), 1);
        if (!far) feats.push({ kind: 'blink', x: x + w / 2, y: top - 22, s: 1, color: hsl3(0, 100, 55), phase: rng.range(0, 6) });
      }
      slab(g, x, top, w, H, col, pen, rng.int(0, 1e6), -5);
      if (!far) {
        windows(c, x + 1, top + 3, w - 2, H - top - 3, 3.2, 4, 3, 4.5, L.lit, false);
        if (c.e && rng.chance(0.12)) {
          // Vertical neon sign.
          const sx = rng.chance(0.5) ? x - 3 : x + w - 1;
          const sy = top + rng.range(8, 30);
          const sh = rng.range(16, 34);
          const nc = rng.chance(0.6) ? L.detail : hsl3(rng.pick([190, 320, 50, 140]), 100, 60);
          fillPts(g, slabPts(sx, sy, 4, sy + sh, 2), 'rgba(10,8,16,0.95)');
          feats.push({ kind: 'flicker', x: sx + 2, y: sy + sh / 2, s: 1, color: nc, phase: rng.range(0, 20), w: 3, h: sh - 2 });
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
    const pen = penW(L.depth);
    let x = rng.range(-10, 0);
    while (x < W) {
      const w = rng.range(40, 90);
      const top = c.ridge(x) - rng.range(0, 24);
      let rx = x + rng.range(2, 10);
      while (rx < x + w - 10) {
        const k = rng.weighted([
          ['tower', 1],
          ['ac', 2],
          ['sign', 0.5],
          ['antenna', 0.6],
          ['gap', 2.5],
        ] as const);
        if (k === 'tower') {
          // Water tower.
          const col = css(L.color, 2);
          bar(g, rx + 1.5, top, rx + 1.5, top - 10, 1, col, 1);
          bar(g, rx + 9.5, top, rx + 9.5, top - 10, 1, col, 2);
          slab(g, rx, top - 22, 11, top - 10, shift(L.color, 2), pen * 0.8, rng.int(0, 1e6), -6, 1);
          roof(c, rx, top - 22, 11, 6, shift(L.color, 2), pen * 0.8, 1);
          rx += 16;
        } else if (k === 'ac') {
          slab(g, rx, top - 6, 9, top, shift(L.color, 3), pen * 0.7, rng.int(0, 1e6), -6);
          if (rng.chance(0.3)) feats.push({ kind: 'steam', x: rx + 4, y: top - 6, s: 0.7, color: hsl3(0, 0, 70), phase: rng.range(0, 10) });
          rx += 12;
        } else if (k === 'sign') {
          const sw = rng.range(20, 34);
          const col = css(L.color, 2);
          bar(g, rx + 3.5, top, rx + 3.5, top - 8, 1, col, 1);
          bar(g, rx + sw - 3.5, top, rx + sw - 3.5, top - 8, 1, col, 2);
          fillPts(g, slabPts(rx, top - 20, sw, top - 8, 4), 'rgba(8,6,14,0.95)');
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
          bar(g, rx + 0.5, top, rx + 0.5, top - 26, 1, css(L.color, 2), 1);
          bar(g, rx - 3, top - 18, rx + 4, top - 18, 0.8, css(L.color, 2), 2);
          if (rng.chance(0.4)) feats.push({ kind: 'blink', x: rx + 0.5, y: top - 26, s: 1, color: hsl3(0, 100, 55), phase: rng.range(0, 6) });
          rx += 8;
        } else rx += rng.range(6, 14);
      }
      slab(g, x, top, w, H, L.color, pen, rng.int(0, 1e6), -5);
      // The parapet's lip catches the light: one flat strip, the pen under it.
      fillPts(g, slabPts(x - 1, top - 2, w + 2, top + 0.5, 5), css(L.color, 5));
      windows(c, x + 2, top + 6, w - 4, H - top - 6, 4.5, 5.5, 5, 6, L.lit * 0.55);
      x += w + rng.range(2, 14);
    }
  },
};

// ---- legacy generic kinds (kept for variety / other themes) ---------------

const spires: SkylineDef = {
  glow: false,
  bake(c) {
    const { g, L, W, H, rng } = c;
    const pen = penW(L.depth);
    let x = 0;
    while (x < W) {
      const w = rng.range(8, 26);
      const top = c.ridge(x) - rng.range(0, V * 0.18);
      shape(
        g,
        [
          { x, y: H },
          { x, y: top + w },
          { x: x + w / 2, y: top - rng.range(4, 26) },
          { x: x + w, y: top + w },
          { x: x + w, y: H },
        ],
        L.color,
        pen,
        rng.int(0, 1e6),
        { shade: -6, cut: 0.5, foot: H - 2 },
      );
      x += w + rng.range(-4, 10);
    }
  },
};

const mesas: SkylineDef = {
  glow: false,
  bake(c) {
    const { g, L, W, H } = c;
    const crest = along(0, W, 6, (x) => Math.round(c.ridge(x) / 14) * 14);
    fillPts(g, [...crest, { x: W, y: H }, { x: 0, y: H }], css(L.color));
    ticks(g, crest, inkOf(L.color, 0.6), 0.5, L.seed, 30, 6);
    penPath(g, crest, false, { w: penW(L.depth), col: inkOf(L.color), seed: L.seed, run: 30 });
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
  ...FRONTIER_SKYLINES,
};
