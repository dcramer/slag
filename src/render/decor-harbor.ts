import { css, type HSL, hsl3, shift } from '../core/color';
import type { DecorDef } from './decor';
import { line, type P, stroke } from './ink';
import { ball, boxPts, dot, glint, INK, ovalPts, part, path, pen, poly, tick, tone } from './ink-props';

/**
 * The harbor's own decor, inked like the quays it stands on: a lobster pot, an anchor, a ship's wheel, a
 * beached buoy, a box of the catch, tarred pilings, an upturned rowboat and a life ring on its post. Small
 * and baked, so none of it reads as somewhere to stand or something to dodge (docs/ART.md).
 */

const WOOD: HSL = hsl3(28, 40, 34);
const TAR: HSL = hsl3(25, 20, 14);
const IRON: HSL = hsl3(215, 10, 24);
const ROPE: HSL = hsl3(38, 40, 58);
const RED: HSL = hsl3(4, 70, 46);
const WHITE: HSL = hsl3(40, 20, 88);
const sd = (seed: number) => seed & 0xffff;
const k01 = (seed: number, n: number) => ((seed >>> n) % 1000) / 1000;

/** A stroke with an ink edge: a rope, a spoke, a shank. */
function rod(s: CanvasRenderingContext2D, pts: readonly P[], w: number, c: string, seed: number) {
  s.fillStyle = INK;
  stroke(s, pts, { w: w + 1, seed, taper: [0.02, 0.1], press: 0.1 });
  s.fillStyle = c;
  stroke(s, pts, { w, seed, taper: [0.02, 0.2], press: 0.1 });
}

export const HARBOR_DECOR = {
  lobsterpot: {
    color: () => hsl3(30, 34, 46),
    bake(s, d) {
      const k = d.size;
      const w = 11 * k;
      const h = 7 * k;
      const x = d.x - w / 2;
      const y = d.y - h;
      // A half-barrel cage of slats over a flat base, netting showing through, a float tied on top.
      const arch: P[] = [{ x, y: d.y }];
      for (let i = 0; i <= 10; i++) arch.push({ x: x + (i / 10) * w, y: d.y - Math.sin((i / 10) * Math.PI) * h });
      tone(s, arch, hsl3(30, 18, 22), { depth: 0.6 });
      s.save();
      path(s, arch);
      s.clip();
      s.fillStyle = css(hsl3(40, 20, 60), 0, 0.5);
      for (let i = 1; i < 6; i++) line(s, x + (i * w) / 6 - 2, d.y, x + (i * w) / 6 + 2, y, { w: 0.35, seed: i, taper: [0, 0], press: 0 });
      s.restore();
      for (let i = 0; i <= 4; i++) {
        const a = (i / 4) * Math.PI;
        rod(s, poly(x + w / 2 - Math.cos(a) * w * 0.5, d.y, x + w / 2 - Math.cos(a) * w * 0.48, d.y - Math.sin(a) * h), 0.9, css(d.color), sd(d.seed) + i);
      }
      pen(s, arch, sd(d.seed), 0.4, 1);
      rod(s, poly(x, d.y - 0.6, x + w, d.y - 0.6), 1.2, css(d.color, -8), sd(d.seed) + 9);
      ball(s, x + w * 0.7, y - 1.4, 1.6 * k, k01(d.seed, 3) < 0.5 ? hsl3(30, 90, 52) : hsl3(196, 70, 48), sd(d.seed) + 4);
    },
  },
  anchor: {
    color: () => IRON,
    bake(s, d) {
      const k = d.size;
      const dir = d.flip ? -1 : 1;
      const lean = 0.25 * dir;
      const top = { x: d.x + lean * 11 * k, y: d.y - 12 * k };
      const foot = { x: d.x, y: d.y - 2 };
      const c = css(d.color, 8);
      // Shank, the ring at its head, the stock across it, the arms and their flukes.
      rod(s, [foot, top], 1.6 * k, c, sd(d.seed));
      s.fillStyle = INK;
      const ring = ovalPts(top.x, top.y - 1.4 * k, 1.6 * k, 1.6 * k, sd(d.seed), 0.02, 12);
      stroke(s, [...ring, ring[0]], { w: 1.4, seed: 3, taper: [0, 0], press: 0 });
      rod(s, poly(top.x - 3.4 * k, top.y + 2.4 * k, top.x + 3.4 * k, top.y + 1.6 * k), 1.1 * k, css(WOOD, 4), sd(d.seed) + 1);
      const arm: P[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * (0.15 + 0.7 * (i / 8));
        arm.push({ x: foot.x - Math.cos(a) * 5 * k, y: foot.y - 4.4 * k + Math.sin(a) * 4 * k });
      }
      rod(s, arm, 1.4 * k, c, sd(d.seed) + 2);
      for (const p of [arm[0], arm[arm.length - 1]])
        part(s, poly(p.x - 1.4, p.y + 0.6, p.x, p.y - 2.2, p.x + 1.4, p.y + 0.6), d.color, sd(d.seed) + 5, { depth: 0.3, thin: 0.3, thick: 0.7 });
      // A coil of chain at its foot.
      for (let i = 0; i < 4; i++) dot(s, d.x + dir * (2.4 + i * 1.6) * k, d.y - 0.9, 0.9 * k, i, css(IRON, 20));
    },
  },
  helm: {
    color: () => hsl3(26, 46, 34),
    bake(s, d) {
      const k = d.size;
      const r = 5.2 * k;
      const cx = d.x;
      const cy = d.y - r - 1.4;
      // Eight spokes with turned handles past the rim, the rim, the brass hub: stood on its edge against the wall.
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        rod(s, poly(cx, cy, cx + Math.cos(a) * (r + 2 * k), cy + Math.sin(a) * (r + 2 * k)), 0.8 * k, css(d.color, 6), sd(d.seed) + i);
      }
      const rim = ovalPts(cx, cy, r, r, sd(d.seed), 0.02, 20);
      s.fillStyle = INK;
      stroke(s, [...rim, rim[0]], { w: 2.6 * k, seed: 4, taper: [0, 0], press: 0 });
      s.fillStyle = css(d.color, 4);
      stroke(s, [...rim, rim[0]], { w: 1.5 * k, seed: 4, taper: [0, 0], press: 0 });
      ball(s, cx, cy, 1.5 * k, hsl3(44, 60, 52), sd(d.seed) + 9);
    },
  },
  buoy: {
    color: () => RED,
    bake(s, d) {
      const k = d.size;
      const w = 7 * k;
      const h = 8 * k;
      const body = poly(d.x - w / 2, d.y, d.x + w / 2, d.y, d.x + w * 0.3, d.y - h, d.x - w * 0.3, d.y - h);
      tone(s, body, d.color, { depth: 0.8 });
      s.save();
      path(s, body);
      s.clip();
      s.fillStyle = css(WHITE, -6);
      s.fillRect(d.x - w, d.y - h * 0.62, w * 2, h * 0.26);
      s.restore();
      pen(s, body, sd(d.seed), 0.45, 1.1);
      // The light cage on top, unlit: it's ashore.
      for (const dx of [-1.6, 1.6]) rod(s, poly(d.x + dx * k, d.y - h, d.x + dx * 0.4 * k, d.y - h - 4 * k), 0.5, css(IRON, 18), sd(d.seed) + dx);
      ball(s, d.x, d.y - h - 4.4 * k, 1.1 * k, hsl3(48, 30, 70), sd(d.seed) + 3);
      glint(s, poly(d.x - w * 0.28, d.y - 1.6, d.x - w * 0.2, d.y - h + 1.4), css(d.color, 24), 0.5);
    },
  },
  fishbox: {
    color: () => hsl3(32, 40, 50),
    bake(s, d) {
      const k = d.size;
      const w = 11 * k;
      const h = 4.6 * k;
      const x = d.x - w / 2;
      // The catch first, heaped over the rim: silver fish, a tail or two up.
      for (let i = 0; i < 5; i++) {
        const fx = x + 1.6 + (i * (w - 3)) / 4;
        const fy = d.y - h - 1 - (i % 2) * 0.8;
        const a = (k01(d.seed, i * 2) - 0.5) * 0.9;
        s.save();
        s.translate(fx, fy);
        s.rotate(a);
        part(s, poly(-2.6, 0, -1.2, -1.2, 1.8, -0.8, 2.6, 0, 1.8, 0.8, -1.2, 1.2), hsl3(205, 14, 70), i, { depth: 0.4, thin: 0.3, thick: 0.7 });
        part(s, poly(2.4, 0, 3.8, -1.3, 3.8, 1.3), hsl3(205, 14, 58), i + 7, { depth: 0.2, thin: 0.3, thick: 0.6 });
        s.restore();
      }
      const box = boxPts(x, d.y - h, w, h, 0.6, sd(d.seed), 0.1);
      tone(s, box, d.color, { depth: 0.8 });
      for (let i = 1; i < 3; i++) tick(s, x + 0.6, d.y - h + (i * h) / 3, x + w - 0.6, d.y - h + (i * h) / 3, 0.35, i, css(d.color, -22));
      pen(s, box, sd(d.seed) + 1, 0.45, 1.1);
    },
  },
  piling: {
    color: () => TAR,
    bake(s, d) {
      const k = d.size;
      const n = 2 + (d.seed % 2);
      // Tarred posts, leaning together, lashed with a turn of rope; their tops worn pale.
      for (let i = 0; i < n; i++) {
        const px = d.x + (i - (n - 1) / 2) * 3.4 * k;
        const ph = (8 + ((d.seed >> (i * 3)) % 5)) * k;
        const lean = (i - (n - 1) / 2) * 0.6;
        const post = poly(px - 1.6 * k, d.y, px + 1.6 * k, d.y, px + 1.5 * k + lean, d.y - ph, px - 1.5 * k + lean, d.y - ph);
        part(s, post, shift(d.color, i * 3), sd(d.seed) + i, { depth: 0.8, thin: 0.4, thick: 1 });
        s.fillStyle = css(WOOD, 18);
        path(s, ovalPts(px + lean, d.y - ph, 1.5 * k, 0.6 * k, i, 0.02, 10));
        s.fill();
      }
      const ry = d.y - 5 * k;
      rod(s, poly(d.x - (n * 1.7 + 0.8) * k, ry, d.x + (n * 1.7 + 0.8) * k, ry - 0.6), 1, css(ROPE), sd(d.seed) + 9);
    },
  },
  rowboat: {
    color: (_th, rng) => hsl3(rng.pick([200, 4, 140, 44]), 46, 42),
    bake(s, d) {
      const k = d.size;
      const w = 14 * k;
      const h = 5 * k;
      const dir = d.flip ? -1 : 1;
      // Upturned on the quay: its keel up, the bow raised on a block, the planks' seams along it.
      const hull: P[] = [{ x: d.x - (dir * w) / 2, y: d.y - 1.2 }];
      for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        hull.push({ x: d.x - (dir * w) / 2 + dir * w * t, y: d.y - 1.2 - t * 1.6 - Math.sin(t * Math.PI) * h });
      }
      tone(s, hull, d.color, { depth: 1 });
      s.save();
      path(s, hull);
      s.clip();
      for (let i = 1; i < 3; i++) {
        const seam: P[] = hull.slice(1).map((p) => ({ x: p.x, y: p.y + i * 1.6 }));
        s.fillStyle = css(d.color, -20);
        stroke(s, seam, { w: 0.4, seed: i, taper: [0.1, 0.1], press: 0 });
      }
      s.fillStyle = css(WHITE, -8);
      s.fillRect(d.x - w, d.y - 2.6, w * 2, 1.4);
      s.restore();
      pen(s, hull, sd(d.seed), 0.45, 1.1);
      part(s, boxPts(d.x + (dir * w) / 2 - 2, d.y - 2.4, 3, 2.4, 0.3, sd(d.seed) + 2), WOOD, sd(d.seed) + 3, { depth: 0.4, thin: 0.3, thick: 0.8 });
      rod(s, poly(d.x - dir * 2, d.y - 0.6, d.x + dir * 6 * k, d.y - 1.4), 0.8, css(WOOD, 10), sd(d.seed) + 4);
    },
  },
  lifering: {
    color: () => RED,
    bake(s, d) {
      const k = d.size;
      const ph = 11 * k;
      rod(s, poly(d.x, d.y, d.x, d.y - ph), 1.3 * k, css(WOOD, 6), sd(d.seed));
      const cy = d.y - ph + 4.4 * k;
      const r = 3.6 * k;
      // The ring in four quarters, red and white, on its hook, and a line coiled under it.
      for (let q = 0; q < 4; q++) {
        const arc: P[] = [];
        for (let i = 0; i <= 5; i++) {
          const a = ((q + i / 5) / 4) * Math.PI * 2 + 0.4;
          arc.push({ x: d.x + Math.cos(a) * r, y: cy + Math.sin(a) * r });
        }
        s.fillStyle = INK;
        stroke(s, arc, { w: 2.4 * k, seed: q, taper: [0, 0], press: 0 });
        s.fillStyle = css(q % 2 ? WHITE : d.color);
        stroke(s, arc, { w: 1.6 * k, seed: q, taper: [0, 0], press: 0 });
      }
      tick(s, d.x - 0.6, d.y - ph + 0.4, d.x + 0.8, d.y - ph + 1.4, 0.6, 2);
      const coil = ovalPts(d.x + 1.2 * k, d.y - 1.2, 2.8 * k, 0.9 * k, sd(d.seed), 0.05, 12);
      rod(s, [...coil, coil[0]], 0.6, css(ROPE), sd(d.seed) + 1);
    },
  },
} satisfies Record<'lobsterpot' | 'anchor' | 'helm' | 'buoy' | 'fishbox' | 'piling' | 'rowboat' | 'lifering', DecorDef>;
