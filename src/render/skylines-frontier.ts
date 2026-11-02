import { css, mixHsl, shift } from '../core/color';
import { VIEW_H } from '../sim/constants';
import { type P, stroke } from './ink';
import { along, backward, fillPts, inkOf, mark, penPath, penW, ridgeGround, shape, slab, slabPts } from './skyline-ink';
import type { BakeCtx, SkylineDef } from './skylines';

/**
 * Skylines for the cold and the empty: a glacier's aurora, peaks and icefall, and space's nebula,
 * planet, orbital stations and drifting debris. Same contract and the same quiet ink as the rest of
 * `SKYLINES`: paint once into the layer (albedo `g`, emissive `e` when `glow`), register the few
 * things that move.
 */

/** Heights against the play view, not the bake (see `V` in ./skylines.ts). */
const V = VIEW_H;

function poly(g: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[]) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
}

const ring = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 48, rot = 0): P[] => {
  const pts: P[] = [];
  const cr = Math.cos(rot);
  const sr = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    pts.push({ x: cx + x * cr - y * sr, y: cy + x * sr + y * cr });
  }
  return pts;
};

/**
 * Curtains of light hanging in the sky: rays standing on a wavy hem, cut into three flat steps of
 * brightness instead of fading, brightest at the hem.
 */
const aurora: SkylineDef = {
  glow: true,
  bake(c) {
    const { e, L, W, rng } = c;
    if (!e) return;
    for (let band = 0; band < 3; band++) {
      const hem = V * (L.base + band * 0.05 + rng.range(-0.03, 0.03));
      const tall = V * rng.range(0.1, 0.2);
      const f1 = rng.range(0.004, 0.009);
      const f2 = rng.range(0.015, 0.03);
      const p1 = rng.range(0, 6.28);
      const p2 = rng.range(0, 6.28);
      const a0 = rng.range(0.2, 0.36);
      for (let x = 0; x < W; x += 2) {
        const y = hem + Math.sin(x * f1 + p1) * V * 0.05 + Math.sin(x * f2 + p2) * V * 0.012;
        const h = tall * (0.45 + 0.55 * Math.abs(Math.sin(x * f2 * 0.7 + p1 * 2)));
        const a = a0 * (0.4 + 0.6 * Math.abs(Math.sin(x * 0.05 + band)));
        e.fillStyle = css(L.detail, 0, a * 0.22);
        e.fillRect(x, y - h, 2, h * 0.45);
        e.fillStyle = css(L.glow, 0, a * 0.5);
        e.fillRect(x, y - h * 0.55, 2, h * 0.4);
        e.fillStyle = css(L.glow, 12, a);
        e.fillRect(x, y - h * 0.15, 2, h * 0.15 + 1);
      }
    }
  },
};

/** Jagged peaks: snowfields on top with ragged lower edges, the side away from the sun in shadow. */
const peaks: SkylineDef = {
  glow: false,
  bake(c) {
    const { g, L, W, H, rng } = c;
    const pen = penW(L.depth);
    const pts: [number, number][] = [[-10, H]];
    const tops: [number, number][] = [];
    let x = -10;
    let up = true;
    while (x < W + 20) {
      const y = c.ridge(x) - (up ? rng.range(0.4, 1) * V * L.amp * 1.2 : rng.range(-0.1, 0.3) * V * L.amp);
      pts.push([x, y]);
      if (up) tops.push([x, y]);
      x += rng.range(14, 34);
      up = !up;
    }
    pts.push([W + 20, H]);
    g.fillStyle = css(L.color);
    poly(g, pts);
    g.save();
    g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.closePath();
    g.clip();
    // Shadowed faces: from each top down its right flank.
    g.fillStyle = css(L.color, -7);
    for (let i = 1; i < pts.length - 2; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      if (by <= ay) continue;
      poly(g, [
        [ax, ay],
        [bx, by],
        [bx - (bx - ax) * 0.3, H],
        [ax + 2, H],
      ]);
    }
    // Snow on every top, its lower edge torn, its far side in shade.
    const ink = inkOf(L.detail, 0.55);
    for (const [tx, ty] of tops) {
      const depth = rng.range(14, 30);
      const half = rng.range(12, 24);
      const snow: [number, number][] = [[tx, ty - 1]];
      for (let k = 0; k <= 6; k++) {
        const u = k / 6;
        snow.push([tx + half * (u * 2 - 1) * 1.2, ty + depth * (0.5 + 0.5 * Math.sin(u * Math.PI)) + rng.range(-6, 4) + Math.abs(u - 0.5) * -depth]);
      }
      g.fillStyle = css(L.detail);
      poly(g, snow);
      g.fillStyle = css(L.detail, -12);
      poly(g, [
        [tx, ty - 1],
        [tx + half * 1.2, ty + depth * 0.6],
        [tx + half * 0.3, ty + depth * 0.9],
      ]);
      const hem = snow.slice(1).map(([sx, sy]) => ({ x: sx, y: sy }));
      penPath(g, backward(hem), false, { w: pen * 0.45, col: ink, seed: Math.round(tx), run: 14, lift: 0.6, facing: 0 });
    }
    g.restore();
    const crest = pts.slice(1, -1).map(([px, py]) => ({ x: px, y: py }));
    penPath(g, crest, false, { w: pen, col: inkOf(L.color), seed: L.seed, run: 30, lift: 0.25 });
  },
};

/** A glacier's tongue: a band of ice broken into seracs, crevasse lines, moraine either side, a lit camp. */
const icefall: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, e, L, W, H, rng, feats } = c;
    const pen = penW(L.depth);
    ridgeGround(g, W, H, (x) => c.ridge(x) + 8, L.color, pen, L.seed, 12);
    // Tongues of ice down the slope.
    let x = rng.range(-40, 40);
    while (x < W) {
      const w = rng.range(90, 170);
      const top = c.ridge(x + w / 2) + 6;
      const tongue: P[] = [];
      for (let k = 0; k <= 10; k++) {
        const u = k / 10;
        const tooth = k % 2 ? rng.range(2, 7) : 0;
        tongue.push({ x: x + w * u, y: top - tooth - Math.sin(u * Math.PI) * 8 });
      }
      tongue.push({ x: x + w * 0.85, y: H + 2 }, { x: x + w * 0.15, y: H + 2 });
      shape(g, tongue, shift(L.detail, 6), pen, rng.int(0, 1e6), { shade: -8, cut: 0.62, foot: H - 4 });
      for (let k = 0; k < 7; k++) {
        const cx = x + w * rng.range(0.15, 0.85);
        const cy = top + rng.range(8, Math.max(10, H - top - 6));
        mark(
          g,
          along(cx - rng.range(5, 12), cx + rng.range(5, 12), 2, (xx) => cy + Math.sin(xx * 0.4) * 0.5),
          css(L.detail, -22, 0.8),
          0.8,
          k,
        );
      }
      x += w + rng.range(60, 160);
    }
    // Base camp: tents with a lamp in the door.
    for (let i = rng.int(1, 3); i > 0; i--) {
      const tx = rng.range(20, W - 20);
      const ty = c.ridge(tx) + 10;
      for (let k = 0; k < rng.int(2, 4); k++) {
        const px = tx + k * rng.range(9, 13);
        // Each tent stands where the ground under it is, not where the camp started.
        const ty = Math.max(c.ridge(px - 5), c.ridge(px + 5)) + 10;
        shape(
          g,
          [
            { x: px - 5, y: ty },
            { x: px, y: ty - 6 },
            { x: px + 5, y: ty },
          ],
          shift(c.th.accent, -20),
          pen * 0.7,
          rng.int(0, 1e6),
          { shade: -10, cut: 0.5 },
        );
        if (e && rng.chance(L.lit)) {
          e.fillStyle = css(L.glow, 0, 0.9);
          poly(e, [
            [px - 1.2, ty],
            [px, ty - 3],
            [px + 1.2, ty],
          ]);
        }
      }
      feats.push({ kind: 'flicker', x: tx, y: ty - 3, s: 0.6, color: L.glow, phase: rng.range(0, 20), w: 3, h: 2 });
    }
  },
};

/**
 * A planet rising out of the bottom of the sky: banded, lit from one side, with a rim of air and a ring.
 * Behind it, far off, banks of nebula cut as flat cel clouds: the deepest layer of space.
 */
const planet: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, e, L, W, rng } = c;
    const R = W * rng.range(0.42, 0.6);
    const cx = W * rng.range(0.25, 0.75);
    const cy = V * L.base + R;
    const pen = penW(L.depth);
    // Nebula: long flat banks in two steps of the sky's own hue, behind everything.
    const neb = mixHsl(c.th.fog, L.glow, 0.25);
    for (let i = 0; i < 4; i++) {
      const a = rng.range(-W * 0.1, W * 0.7);
      const b = a + rng.range(W * 0.3, W * 0.6);
      const my = V * rng.range(0.12, 0.55);
      const tk = V * rng.range(0.05, 0.12);
      const sw = (x: number) => Math.max(0, Math.sin((Math.PI * (x - a)) / (b - a)));
      const lump = (x: number) => 1 + 0.35 * Math.sin(x * 0.03 + i * 2) + 0.2 * Math.sin(x * 0.081 + i);
      const crest = along(a, b, 6, (x) => my - tk * Math.pow(sw(x), 0.6) * lump(x));
      const belly = backward(along(a, b, 6, (x) => my + tk * 0.6 * sw(x) * lump(x + 40)));
      fillPts(g, [...crest, ...belly], css(neb, 2, 0.38));
      const inner = along(a + (b - a) * 0.15, b - (b - a) * 0.2, 6, (x) => my - tk * 0.55 * Math.pow(sw(x), 0.6) * lump(x));
      const innerLow = backward(along(a + (b - a) * 0.15, b - (b - a) * 0.2, 6, (x) => my + tk * 0.2 * sw(x)));
      fillPts(g, [...inner, ...innerLow], css(neb, 8, 0.32));
    }
    const lit = rng.chance(0.5) ? 1 : -1;
    g.save();
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = css(L.color);
    g.fillRect(cx - R, cy - R, R * 2, R * 2);
    // Bands of weather, wavering.
    for (let y = cy - R; y < cy - R * 0.4; y += rng.range(6, 16)) {
      const h = rng.range(2, 7);
      g.fillStyle = rng.chance(0.5) ? css(L.detail, rng.range(-8, 4), 0.85) : css(L.color, rng.range(-8, 6));
      g.beginPath();
      g.moveTo(cx - R, y);
      for (let x = cx - R; x <= cx + R; x += 16) g.lineTo(x, y + Math.sin(x * 0.02 + y) * 2);
      g.lineTo(cx + R, y + h);
      g.lineTo(cx - R, y + h);
      g.fill();
    }
    // A storm eye.
    g.fillStyle = css(L.detail, 10, 0.85);
    g.beginPath();
    g.ellipse(cx + R * rng.range(-0.3, 0.3), cy - R * 0.9, R * 0.05, R * 0.02, 0, 0, Math.PI * 2);
    g.fill();
    // Night side: one hard cut.
    g.fillStyle = 'rgba(4,2,12,0.55)';
    g.beginPath();
    g.ellipse(cx - lit * R * 0.35, cy, R, R * 1.05, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // The limb in pen, heavier on the night side.
    penPath(g, ring(cx, cy, R, R, Math.PI * 1.02, Math.PI * 1.98, 90), false, {
      w: pen * 1.2,
      col: inkOf(L.color, 0.4),
      seed: L.seed,
      run: 60,
      lift: 0.2,
      inside: { x: cx + lit * R * 0.6, y: cy },
    });
    // A ring, crossing in front: a flat band in two tones with a pen under it.
    if (rng.chance(0.6)) {
      const tilt = rng.range(-0.08, 0.08);
      const band = ring(cx, cy - R * 0.92, R * 1.5, R * 0.1, Math.PI * 0.95, Math.PI * 0.05, 80, tilt);
      const w = rng.range(3, 6);
      g.fillStyle = inkOf(L.detail, 0.5);
      stroke(
        g,
        band.map((p) => ({ x: p.x, y: p.y + w * 0.3 })),
        { w: w + 1, seed: 3, taper: [0.08, 0.08], press: 0.2 },
      );
      g.fillStyle = css(L.detail, 6);
      stroke(g, band, { w, seed: 4, taper: [0.08, 0.08], press: 0.15 });
      g.fillStyle = css(L.detail, 18);
      stroke(
        g,
        band.map((p) => ({ x: p.x, y: p.y - w * 0.22 })),
        { w: w * 0.35, seed: 5, taper: [0.1, 0.1], press: 0.2 },
      );
    }
    if (e) {
      // The rim of its atmosphere: two flat crescents, a bright edge inside a faint one.
      e.fillStyle = css(L.glow, 6, 0.55);
      stroke(e, ring(cx, cy, R + 1, R + 1, Math.PI * 1.05, Math.PI * 1.95, 90), { w: 2.6, seed: 1, taper: [0.25, 0.25], press: 0.1 });
      e.fillStyle = css(L.glow, 0, 0.16);
      stroke(e, ring(cx, cy, R + 5, R + 5, Math.PI * 1.08, Math.PI * 1.92, 90), { w: 8, seed: 2, taper: [0.3, 0.3], press: 0.1 });
    }
    // A moon or two.
    for (let i = rng.int(0, 2); i > 0; i--) {
      const mx = rng.range(0, W);
      const my = V * rng.range(0.1, 0.35);
      const r = rng.range(4, 11);
      const disc = ring(mx, my, r, r, 0, Math.PI * 2, 24).slice(0, -1);
      shape(g, disc, shift(L.detail, -10, -20), pen, i, {});
      g.fillStyle = 'rgba(4,2,12,0.5)';
      g.beginPath();
      g.arc(mx - lit * r * 0.4, my, r, 0, Math.PI * 2);
      g.fill();
    }
  },
};

/** Stations far off: trusses with modules and panel wings, a ring or two, windows lit and beacons blinking. */
const orbital: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, e, L, W, rng, feats } = c;
    const pen = penW(L.depth);
    let x = rng.range(10, 120);
    while (x < W) {
      const y = V * (L.base + rng.range(-0.12, 0.12));
      const len = rng.range(70, 150);
      // Panel wings at the ends, behind the truss.
      for (const end of [x - 2, x + len + 2]) {
        const pw = rng.range(12, 22);
        const ph = rng.range(16, 28);
        shape(g, slabPts(end - pw / 2, y - ph / 2, pw, y + ph / 2, rng.int(0, 999), 0.2), shift(L.detail, -4), pen * 0.8, rng.int(0, 1e6), { shade: -6 });
        for (let gy = y - ph / 2 + 5; gy < y + ph / 2 - 1; gy += 5)
          mark(
            g,
            along(end - pw / 2 + 1, end + pw / 2 - 1, 3, () => gy),
            css(L.color, -2, 0.9),
            0.5,
            gy,
          );
      }
      if (rng.chance(0.4)) {
        const rx = rng.range(18, 30);
        const ry = rng.range(6, 10);
        g.fillStyle = inkOf(L.color, 0.6);
        stroke(g, ring(x + len / 2, y + 0.8, rx, ry, 0, Math.PI * 2, 40), { w: 3.6, seed: 2, taper: [0, 0], press: 0.1 });
        g.fillStyle = css(L.color, 3);
        stroke(g, ring(x + len / 2, y, rx, ry, 0, Math.PI * 2, 40), { w: 2.6, seed: 3, taper: [0, 0], press: 0.1 });
      }
      slab(g, x, y - 1.5, len, y + 1.5, L.color, pen * 0.7, rng.int(0, 1e6), -4, 0.5);
      for (let t = x + 3; t < x + len; t += 8)
        mark(
          g,
          [
            { x: t, y: y - 2.5 },
            { x: t + 0.2, y: y + 2.5 },
          ],
          css(L.color, -8),
          0.6,
          t,
        );
      // Modules along it.
      for (let m = x + rng.range(4, 14); m < x + len - 10; m += rng.range(14, 28)) {
        const mw = rng.range(8, 16);
        const mh = rng.range(5, 9);
        shape(g, slabPts(m, y - mh / 2, mw, y + mh / 2, rng.int(0, 999), 0.2), shift(L.color, rng.range(-2, 5)), pen, rng.int(0, 1e6), { shade: -6 });
        mark(
          g,
          along(m + 1, m + mw - 1, 2, () => y - mh / 2 + 0.8),
          css(L.detail, 0, 0.6),
          0.7,
          m,
        );
        if (e) {
          for (let wx = m + 2; wx < m + mw - 2; wx += 4) {
            if (!rng.chance(L.lit * 0.45)) continue;
            e.fillStyle = css(L.glow, 10, rng.range(0.5, 0.9));
            e.fillRect(wx, y - 1, 1.8, 1.8);
          }
        }
      }
      feats.push({ kind: 'blink', x: x + len, y: y - 3, s: 1, color: L.glow, phase: rng.range(0, 6) });
      x += len + rng.range(140, 320);
    }
  },
};

/** Rocks adrift between here and the planet: chunky, faceted, a lit facet and a shadow side. */
const debris: SkylineDef = {
  glow: false,
  bake(c: BakeCtx) {
    const { g, L, W, rng } = c;
    const pen = penW(L.depth);
    const n = Math.round(W / 70);
    for (let i = 0; i < n; i++) {
      const x = rng.range(0, W);
      const y = V * (L.base + rng.range(-0.3, 0.25));
      const r = rng.range(5, 22) * (rng.chance(0.15) ? 2 : 1);
      const k = rng.int(6, 9);
      const pts: P[] = [];
      for (let j = 0; j < k; j++) {
        const a = (j / k) * Math.PI * 2 + rng.range(-0.2, 0.2);
        const d = r * rng.range(0.7, 1.1);
        pts.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.8 });
      }
      shape(g, pts, shift(L.color, rng.range(-2, 3)), pen, rng.int(0, 1e6), { shade: -5, cut: 0.55 });
      fillPts(g, [pts[k - 1], pts[0], pts[1], { x: x + r * 0.2, y: y - r * 0.1 }], css(L.detail, 0, 0.8));
      fillPts(g, ring(x + r * 0.1, y + r * 0.15, r * 0.2, r * 0.12, 0, Math.PI * 2, 12), css(L.color, -7));
    }
  },
};

export const FRONTIER_SKYLINES = { aurora, peaks, icefall, planet, orbital, debris };
