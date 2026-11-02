import { css, shift } from '../core/color';
import { vgrad } from './kit';
import type { BakeCtx, SkylineDef } from './skylines';

/**
 * Skylines for the cold and the empty: a glacier's aurora, peaks and
 * icefall, and space's planet, orbital stations and drifting debris. Same
 * contract as the rest of `SKYLINES`: paint once into the layer (albedo `g`,
 * emissive `e` when `glow`), register the few things that move.
 */

function poly(g: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[]) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fill();
}

/** Curtains of light hanging in the sky: rays of glow standing on a wavy hem, brighter at the hem. */
const aurora: SkylineDef = {
  glow: true,
  bake(c) {
    const { e, L, W, H, rng } = c;
    if (!e) return;
    for (let band = 0; band < 3; band++) {
      const hem = H * (L.base + band * 0.05 + rng.range(-0.03, 0.03));
      const tall = H * rng.range(0.1, 0.2);
      const f1 = rng.range(0.004, 0.009);
      const f2 = rng.range(0.015, 0.03);
      const p1 = rng.range(0, 6.28);
      const p2 = rng.range(0, 6.28);
      const a0 = rng.range(0.2, 0.36);
      for (let x = 0; x < W; x += 2) {
        const y = hem + Math.sin(x * f1 + p1) * H * 0.05 + Math.sin(x * f2 + p2) * H * 0.012;
        const h = tall * (0.45 + 0.55 * Math.abs(Math.sin(x * f2 * 0.7 + p1 * 2)));
        const a = a0 * (0.4 + 0.6 * Math.abs(Math.sin(x * 0.05 + band)));
        const gr = e.createLinearGradient(0, y - h, 0, y);
        gr.addColorStop(0, css(L.detail, 0, 0));
        gr.addColorStop(0.7, css(L.glow, 0, a * 0.6));
        gr.addColorStop(1, css(L.glow, 12, a));
        e.fillStyle = gr;
        e.fillRect(x, y - h, 2, h + 1);
      }
    }
  },
};

/** Jagged peaks: snowfields on top with ragged lower edges, the side away from the sun in shadow. */
const peaks: SkylineDef = {
  glow: false,
  bake(c) {
    const { g, L, W, H, rng } = c;
    const pts: [number, number][] = [[-10, H]];
    const tops: [number, number][] = [];
    let x = -10;
    let up = true;
    while (x < W + 20) {
      const y = c.ridge(x) - (up ? rng.range(0.4, 1) * H * L.amp * 1.2 : rng.range(-0.1, 0.3) * H * L.amp);
      pts.push([x, y]);
      if (up) tops.push([x, y]);
      x += rng.range(14, 34);
      up = !up;
    }
    pts.push([W + 20, H]);
    g.fillStyle = vgrad(g, L.base * H - L.amp * H * 1.4, H, css(L.color, 4), css(L.color, -6));
    poly(g, pts);
    g.save();
    g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.closePath();
    g.clip();
    // Shadowed faces: from each top down its right flank.
    g.fillStyle = css(L.color, -7, 0.55);
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
    // Snow on every top, its lower edge torn.
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
      g.fillStyle = css(L.detail, -12, 0.6);
      poly(g, [
        [tx, ty - 1],
        [tx + half * 1.2, ty + depth * 0.6],
        [tx + half * 0.3, ty + depth * 0.9],
      ]);
    }
    g.restore();
  },
};

/** A glacier's tongue: a band of ice broken into seracs, crevasse lines, moraine either side, a lit camp. */
const icefall: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, e, L, W, H, rng, feats } = c;
    g.fillStyle = vgrad(g, L.base * H - L.amp * H, H, css(L.color, 3), css(L.color, -8));
    g.beginPath();
    g.moveTo(-2, H);
    for (let x = -2; x <= W + 6; x += 6) g.lineTo(x, c.ridge(x) + 8);
    g.lineTo(W + 2, H);
    g.fill();
    // Tongues of ice down the slope.
    let x = rng.range(-40, 40);
    while (x < W) {
      const w = rng.range(90, 170);
      const top = c.ridge(x + w / 2) + 6;
      const tongue: [number, number][] = [];
      for (let k = 0; k <= 10; k++) {
        const u = k / 10;
        const tooth = k % 2 ? rng.range(2, 7) : 0;
        tongue.push([x + w * u, top - tooth - Math.sin(u * Math.PI) * 8]);
      }
      tongue.push([x + w * 0.85, H], [x + w * 0.15, H]);
      g.fillStyle = css(L.detail, 6);
      poly(g, tongue);
      g.fillStyle = css(L.detail, -10, 0.7);
      for (let k = 0; k < 9; k++) {
        const cx = x + w * rng.range(0.15, 0.85);
        const cy = top + rng.range(8, H - top - 6);
        poly(g, [
          [cx - rng.range(5, 12), cy],
          [cx + rng.range(5, 12), cy + rng.range(-1, 1)],
          [cx + 1, cy + rng.range(1.2, 2.2)],
        ]);
      }
      x += w + rng.range(60, 160);
    }
    // Base camp: tents with a lamp in the door.
    for (let i = rng.int(1, 3); i > 0; i--) {
      const tx = rng.range(20, W - 20);
      const ty = c.ridge(tx) + 10;
      for (let k = 0; k < rng.int(2, 4); k++) {
        const px = tx + k * rng.range(9, 13);
        g.fillStyle = css(c.th.accent, -20);
        poly(g, [
          [px - 5, ty],
          [px, ty - 6],
          [px + 5, ty],
        ]);
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

/** A planet rising out of the bottom of the sky: banded, lit from one side, with a rim of air and a ring. */
const planet: SkylineDef = {
  glow: true,
  bake(c) {
    const { g, e, L, W, H, rng } = c;
    const R = W * rng.range(0.42, 0.6);
    const cx = W * rng.range(0.25, 0.75);
    const cy = H * L.base + R;
    g.save();
    g.beginPath();
    g.arc(cx, cy, R, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = css(L.color);
    g.fillRect(cx - R, cy - R, R * 2, R * 2);
    // Bands of weather, wavering.
    for (let y = cy - R; y < cy - R * 0.4; y += rng.range(5, 14)) {
      const h = rng.range(2, 7);
      g.fillStyle = rng.chance(0.5) ? css(L.detail, rng.range(-8, 4), 0.8) : css(L.color, rng.range(-8, 6), 0.9);
      g.beginPath();
      g.moveTo(cx - R, y);
      for (let x = cx - R; x <= cx + R; x += 16) g.lineTo(x, y + Math.sin(x * 0.02 + y) * 2);
      g.lineTo(cx + R, y + h);
      g.lineTo(cx - R, y + h);
      g.fill();
    }
    // A storm eye.
    g.fillStyle = css(L.detail, 10, 0.8);
    g.beginPath();
    g.ellipse(cx + R * rng.range(-0.3, 0.3), cy - R * 0.9, R * 0.05, R * 0.02, 0, 0, Math.PI * 2);
    g.fill();
    // Night side.
    const lit = rng.chance(0.5) ? 1 : -1;
    g.fillStyle = 'rgba(4,2,12,0.55)';
    g.beginPath();
    g.ellipse(cx - lit * R * 0.35, cy, R, R * 1.05, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    // A ring, crossing in front.
    if (rng.chance(0.6)) {
      g.strokeStyle = css(L.detail, 12, 0.7);
      g.lineWidth = rng.range(3, 6);
      g.beginPath();
      g.ellipse(cx, cy - R * 0.92, R * 1.5, R * 0.1, rng.range(-0.08, 0.08), Math.PI * 0.05, Math.PI * 0.95, true);
      g.stroke();
    }
    if (e) {
      // The rim of its atmosphere.
      e.strokeStyle = css(L.glow, 6, 0.55);
      e.lineWidth = 3;
      e.beginPath();
      e.arc(cx, cy, R + 1, Math.PI * 1.05, Math.PI * 1.95);
      e.stroke();
      e.strokeStyle = css(L.glow, 0, 0.18);
      e.lineWidth = 10;
      e.beginPath();
      e.arc(cx, cy, R + 5, Math.PI * 1.05, Math.PI * 1.95);
      e.stroke();
    }
    // A moon or two.
    for (let i = rng.int(0, 2); i > 0; i--) {
      const mx = rng.range(0, W);
      const my = H * rng.range(0.1, 0.35);
      const r = rng.range(4, 11);
      g.fillStyle = css(shift(L.detail, -10, -20));
      g.beginPath();
      g.arc(mx, my, r, 0, Math.PI * 2);
      g.fill();
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
    const { g, e, L, W, H, rng, feats } = c;
    let x = rng.range(10, 120);
    while (x < W) {
      const y = H * (L.base + rng.range(-0.12, 0.12));
      const len = rng.range(70, 150);
      g.fillStyle = css(L.color);
      g.fillRect(x, y - 1.5, len, 3);
      // Truss ticks.
      g.fillStyle = css(L.color, -6);
      for (let t = x; t < x + len; t += 6) g.fillRect(t, y - 2.5, 1, 5);
      // Modules along it.
      for (let m = x + rng.range(4, 14); m < x + len - 10; m += rng.range(14, 28)) {
        const mw = rng.range(8, 16);
        const mh = rng.range(5, 9);
        g.fillStyle = css(L.color, rng.range(-3, 5));
        g.fillRect(m, y - mh / 2, mw, mh);
        g.fillStyle = css(L.detail, 0, 0.5);
        g.fillRect(m, y - mh / 2, mw, 1);
        if (e) {
          for (let wx = m + 2; wx < m + mw - 2; wx += 3) {
            if (!rng.chance(L.lit * 0.6)) continue;
            e.fillStyle = css(L.glow, 10, rng.range(0.5, 0.9));
            e.fillRect(wx, y - 0.8, 1.4, 1.4);
          }
        }
      }
      // Panel wings at the ends.
      for (const end of [x - 2, x + len + 2]) {
        const pw = rng.range(12, 22);
        const ph = rng.range(16, 28);
        g.fillStyle = css(L.detail, -4);
        g.fillRect(end - pw / 2, y - ph / 2, pw, ph);
        g.fillStyle = css(L.color, -2, 0.8);
        for (let gy = y - ph / 2 + 4; gy < y + ph / 2; gy += 4) g.fillRect(end - pw / 2, gy, pw, 0.7);
        g.fillRect(end - 0.4, y - ph / 2, 0.8, ph);
      }
      feats.push({ kind: 'blink', x: x + len, y: y - 3, s: 1, color: L.glow, phase: rng.range(0, 6) });
      if (rng.chance(0.4)) {
        g.strokeStyle = css(L.color, 2);
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(x + len / 2, y, rng.range(18, 30), rng.range(6, 10), 0, 0, Math.PI * 2);
        g.stroke();
      }
      x += len + rng.range(140, 320);
    }
  },
};

/** Rocks adrift between here and the planet: chunky, faceted, lit along one side. */
const debris: SkylineDef = {
  glow: false,
  bake(c: BakeCtx) {
    const { g, L, W, H, rng } = c;
    const n = Math.round(W / 70);
    for (let i = 0; i < n; i++) {
      const x = rng.range(0, W);
      const y = H * (L.base + rng.range(-0.3, 0.25));
      const r = rng.range(5, 22) * (rng.chance(0.15) ? 2 : 1);
      const k = rng.int(6, 9);
      const pts: [number, number][] = [];
      for (let j = 0; j < k; j++) {
        const a = (j / k) * Math.PI * 2 + rng.range(-0.2, 0.2);
        const d = r * rng.range(0.7, 1.1);
        pts.push([x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8]);
      }
      g.fillStyle = css(L.color, rng.range(-2, 3));
      poly(g, pts);
      g.fillStyle = css(L.detail, 0, 0.6);
      poly(g, [pts[k - 1], pts[0], pts[1], [x + r * 0.2, y - r * 0.1]]);
      g.fillStyle = css(L.color, -6, 0.8);
      g.beginPath();
      g.ellipse(x + r * 0.1, y + r * 0.15, r * 0.2, r * 0.12, 0, 0, Math.PI * 2);
      g.fill();
    }
  },
};

export const FRONTIER_SKYLINES = { aurora, peaks, icefall, planet, orbital, debris };
