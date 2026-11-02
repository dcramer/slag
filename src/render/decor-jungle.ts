import { css, type HSL, hsl3, shift } from '../core/color';
import { hash2 } from '../core/rng';
import type { Decor, DecorDef } from './decor';
import { blob, line, type P, stroke } from './ink';
import { boxPts, INK, ovalPts, part, path, poly, tick, tone } from './ink-props';

/**
 * The jungle's decor, inked like the ground it grows from: a broken ruin pillar, a glyph stone (a carved
 * spiral, no face), a mossy fallen log, a banana plant with its bunch, a termite mound, an orchid, a rope
 * bridge's post with its frayed end, a statue's fallen hand, a shed snake skin, a pitcher plant, a stand of
 * bamboo and looping lianas. Small and cosmetic like all decor: nothing here reads as somewhere to stand
 * or something to dodge. All of it holds still and bakes with the terrain.
 */

const STONE: HSL = hsl3(42, 14, 54);
const MOSS: HSL = hsl3(96, 44, 34);
const BARK: HSL = hsl3(26, 32, 28);
const ROPE: HSL = hsl3(38, 36, 52);
const BANANA: HSL = hsl3(52, 86, 58);
const MOUND: HSL = hsl3(24, 36, 40);
const BAMBOO: HSL = hsl3(62, 46, 52);

const sd = (d: Decor) => d.seed & 0xffff;
const k01 = (d: Decor, n: number) => hash2(n, 7, sd(d));
/** Mirror about the piece's foot when it's flipped. */
const fx = (d: Decor) => (d.flip ? -1 : 1);

/** Points from (x, y) offsets about the foot, scaled by the piece's size and mirrored by its flip. */
const at = (d: Decor, ...xy: number[]) => {
  const out: P[] = [];
  for (let i = 0; i + 1 < xy.length; i += 2) out.push({ x: d.x + xy[i] * d.size * fx(d), y: d.y + 0.5 + xy[i + 1] * d.size });
  return out;
};

/** A stem or stalk: an ink ribbon with its colour over it. */
function stem(s: CanvasRenderingContext2D, pts: readonly P[], w: number, c: HSL, seed: number) {
  s.fillStyle = INK;
  stroke(s, pts, { w: w + 0.9, seed, taper: [0.02, 0.3], press: 0.1 });
  s.fillStyle = css(c);
  stroke(s, pts, { w, seed: seed + 1, taper: [0.02, 0.4], press: 0.1 });
}

/** A leaf from its base along angle `a`: a pointed oval split down its vein into two greens. */
function leaf(s: CanvasRenderingContext2D, x: number, y: number, a: number, L: number, W: number, c: HSL) {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const tip = { x: x + ca * L, y: y + sa * L };
  const mx = x + ca * L * 0.45;
  const my = y + sa * L * 0.45;
  const up = { x: mx - sa * W, y: my + ca * W };
  const dn = { x: mx + sa * W, y: my - ca * W };
  s.fillStyle = INK;
  path(s, [
    { x: x - ca * 0.4, y: y - sa * 0.4 },
    { x: up.x - sa * 0.5, y: up.y + ca * 0.5 },
    { x: tip.x + ca * 0.6, y: tip.y + sa * 0.6 },
    { x: dn.x + sa * 0.5, y: dn.y - ca * 0.5 },
  ]);
  s.fill();
  s.fillStyle = css(c, 8);
  path(s, [{ x, y }, dn, tip]);
  s.fill();
  s.fillStyle = css(c, -8);
  path(s, [{ x, y }, up, tip]);
  s.fill();
}

/** A tuft of moss lumps along a top edge. */
function moss(s: CanvasRenderingContext2D, x0: number, x1: number, y: number, seed: number) {
  s.fillStyle = css(MOSS);
  for (let x = x0; x < x1; x += 2.2) {
    blob(s, x, y, 1.4 + hash2(x | 0, 1, seed) * 0.8, (x | 0) + seed, 1, 0.3);
    s.fill();
  }
}

export const JUNGLE_DECOR = {
  ruinpillar: {
    color: (th) => shift(th.terrain.base, 0, -10, 18),
    bake(s, d) {
      // A column snapped off a few drums up, its break jagged, moss on the stub, a drum fallen beside it.
      const top = -18 - k01(d, 1) * 8;
      part(s, at(d, -3.6, 0, -3.6, top + 2, -1.4, top - 1, 0.8, top + 1.6, 3.6, top - 0.4, 3.6, 0), STONE, sd(d), { depth: 1, thin: 0.45, thick: 1.1 });
      for (let y = -6; y > top + 3; y -= 6) tick(s, d.x - 3.4 * d.size, d.y + y * d.size, d.x + 3.4 * d.size, d.y + y * d.size, 0.5, y, css(STONE, -24));
      for (const x of [-1.6, 1.4]) tick(s, d.x + x * d.size * fx(d), d.y - 1, d.x + x * d.size * fx(d), d.y + (top + 3) * d.size, 0.4, x * 9, css(STONE, -14));
      moss(s, d.x - 3.4 * d.size, d.x + 3.4 * d.size, d.y + (top + 1) * d.size, sd(d));
      part(s, ovalPts(d.x + 7 * d.size * fx(d), d.y - 2.2 * d.size, 3 * d.size, 2.2 * d.size, sd(d) + 3, 0.06), STONE, sd(d) + 3, { depth: 0.6, thin: 0.4 });
    },
  },
  glyphstone: {
    color: () => STONE,
    bake(s, d) {
      // A standing stone with a spiral cut in its face: a carving, not a face.
      const pts = at(d, -5, 0, -5.4, -12, -3, -17, 3, -17.6, 5.2, -12.6, 5, 0);
      part(s, pts, shift(STONE, -4), sd(d), { depth: 1.1, thin: 0.45, thick: 1.2 });
      const cx = d.x;
      const cy = d.y - 9 * d.size;
      const spiral: P[] = [];
      for (let i = 0; i <= 30; i++) {
        const a = (i / 30) * Math.PI * 4.2;
        const r = (i / 30) * 3.8 * d.size;
        spiral.push({ x: cx + Math.cos(a) * r * fx(d), y: cy + Math.sin(a) * r });
      }
      s.fillStyle = css(STONE, -30);
      stroke(s, spiral, { w: 0.9, seed: 3, taper: [0.05, 0.1], press: 0.1 });
      tick(s, cx - 3.6 * d.size, d.y - 3 * d.size, cx + 3.6 * d.size, d.y - 3 * d.size, 0.6, 4, css(STONE, -26));
      moss(s, d.x - 3 * d.size, d.x + 3 * d.size, d.y - 16.8 * d.size, sd(d));
    },
  },
  mossylog: {
    color: () => BARK,
    bake(s, d) {
      // A fallen trunk along the ground, its cut end showing rings, moss down its back.
      const w = d.span * 16 - 3;
      const x0 = d.x + 1;
      const h = 7 * d.size;
      const body = boxPts(x0, d.y - h, w, h, h * 0.45, sd(d), 0.3);
      part(s, body, BARK, sd(d), { depth: 0.9, thin: 0.45, thick: 1.1 });
      const ex = d.flip ? x0 + 1.5 : x0 + w - 1.5;
      s.fillStyle = css(hsl3(34, 40, 56));
      path(s, ovalPts(ex, d.y - h / 2, 2, h / 2 - 0.6, sd(d) + 1, 0.05, 12));
      s.fill();
      s.fillStyle = css(BARK, -6);
      const ring = ovalPts(ex, d.y - h / 2, 1, h / 4, sd(d) + 2, 0.05, 10);
      stroke(s, [...ring, ring[0]], { w: 0.4, seed: 2, taper: [0, 0], press: 0 });
      for (let i = 0; i < 3; i++) tick(s, x0 + 4 + i * (w / 3), d.y - h * 0.55, x0 + 4 + i * (w / 3) + w * 0.2, d.y - h * 0.5, 0.4, i, css(BARK, -12));
      moss(s, x0 + 2, x0 + w - 2, d.y - h + 0.6, sd(d));
    },
  },
  bananas: {
    color: (th) => shift(th.terrain.capColor, 6, 0, 4),
    bake(s, d) {
      // A banana plant: a short fat stem, big ragged leaves arching out, a bunch hanging under them.
      const k = d.size;
      stem(s, at(d, 0, 0, 0.6, -8, 0.2, -16), 2.2 * k, hsl3(80, 30, 40), sd(d));
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + (i - 1.5) * 0.7 + (k01(d, i) - 0.5) * 0.2;
        const L = (11 + k01(d, i + 4) * 4) * k;
        leaf(s, d.x + 0.2 * k * fx(d), d.y - 16 * k, a + (a < -Math.PI / 2 ? -0.3 : 0.3), L, 3 * k, shift(d.color, i * 3 - 4));
      }
      const bx = d.x + 3 * k * fx(d);
      const by = d.y - 12 * k;
      for (let i = 0; i < 5; i++) {
        const row = Math.floor(i / 2);
        const x = bx + ((i % 2) - 0.5) * 2.4 * k;
        const y = by + row * 2.2 * k;
        const pts = poly(x - 0.8, y, x + 0.8, y - 0.4, x + 1.4, y + 3.2 * k, x, y + 3.6 * k);
        part(s, pts, BANANA, i + sd(d), { depth: 0.3, thin: 0.3, thick: 0.6 });
      }
    },
  },
  termites: {
    color: () => MOUND,
    bake(s, d) {
      // A termite mound: a lumpy spire of baked earth, its vents dark, two lesser spires leaning on it.
      const k = d.size;
      part(s, at(d, -6, 0, -5.4, -4, -3.6, -9, -2.6, -16, -0.6, -24, 1.4, -21, 2.6, -14, 4.6, -8, 6, 0), MOUND, sd(d), { depth: 1.1, thin: 0.45, thick: 1.2 });
      part(s, at(d, 3.4, 0, 4.4, -7, 5.6, -12, 7, -6, 8, 0), shift(MOUND, 4), sd(d) + 1, { depth: 0.6, thin: 0.4 });
      s.fillStyle = css(MOUND, -24);
      for (let i = 0; i < 4; i++) {
        const y = d.y - (4 + i * 4.5) * k;
        path(s, ovalPts(d.x + (k01(d, i) - 0.5) * 3 * k, y, 0.8 * k, 0.6 * k, i, 0.1, 8));
        s.fill();
      }
      for (let i = 0; i < 3; i++) tick(s, d.x - 3 * k, d.y - (6 + i * 5) * k, d.x + 2 * k, d.y - (6.4 + i * 5) * k, 0.4, i, css(MOUND, -14));
    },
  },
  orchid: {
    color: (_th, rng) => hsl3(rng.pick([300, 320, 280, 20]), 70, 66),
    bake(s, d) {
      // An arching stem of orchid blooms over two broad leaves.
      const k = d.size;
      leaf(s, d.x, d.y, -Math.PI + 0.4, 7 * k, 2.2 * k, hsl3(110, 40, 34));
      leaf(s, d.x, d.y, -0.4, 7 * k, 2.2 * k, hsl3(110, 40, 30));
      const pts: P[] = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        pts.push({ x: d.x + Math.sin(t * 1.6) * 6 * k * fx(d), y: d.y - t * 13 * k });
      }
      stem(s, pts, 0.6, hsl3(90, 30, 34), sd(d));
      for (const i of [3, 4, 5, 6]) {
        const p = pts[i];
        for (let j = 0; j < 5; j++) {
          const a = (j / 5) * Math.PI * 2 + i;
          s.fillStyle = css(d.color, j % 2 ? -8 : 6);
          blob(s, p.x + Math.cos(a) * 1.3 * k, p.y + Math.sin(a) * 1.3 * k, 1.1 * k, j + i, 1, 0.2);
          s.fill();
        }
        s.fillStyle = css(hsl3(48, 90, 62));
        blob(s, p.x, p.y, 0.6, i, 1, 0.1);
        s.fill();
      }
    },
  },
  ropepost: {
    color: () => BARK,
    bake(s, d) {
      // A rope bridge's post, leaning, its lashing still on and the rope's frayed end trailing in the grass.
      const k = d.size;
      const f = fx(d);
      part(s, at(d, -1.6, 0, -1.2, -20, 0.6, -21, 1.8, -20, 1.6, 0), BARK, sd(d), { depth: 0.6, thin: 0.4, thick: 1 });
      s.fillStyle = css(ROPE);
      for (let i = 0; i < 3; i++)
        line(s, d.x - 1.8 * k, d.y - (15 + i * 1.3) * k, d.x + 1.8 * k, d.y - (14.4 + i * 1.3) * k, { w: 0.8, seed: i, taper: [0, 0], press: 0 });
      const end: P[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        end.push({ x: d.x + (1.6 + t * 9) * k * f, y: d.y - 15 * k + Math.sin(t * Math.PI) * 4 * k + t * 14 * k });
      }
      s.fillStyle = INK;
      stroke(s, end, { w: 1.6, seed: 4, taper: [0, 0.3], press: 0.1 });
      s.fillStyle = css(ROPE);
      stroke(s, end, { w: 0.9, seed: 5, taper: [0, 0.4], press: 0.1 });
      const tip = end[end.length - 1];
      for (let i = -1; i <= 1; i++) tick(s, tip.x, tip.y - 0.4, tip.x + (1.4 + i * 0.3) * k * f, tip.y - 1 + i * 0.8, 0.4, i, css(ROPE, -10));
    },
  },
  statuehand: {
    color: () => STONE,
    bake(s, d) {
      // A statue's stone hand, broken at the wrist and half sunk, its fingers curled up out of the ground.
      const k = d.size;
      part(s, at(d, -7, 0, -7.4, -3.6, -4, -5.4, 0, -5, 0.6, 0), shift(STONE, -2), sd(d), { depth: 0.8, thin: 0.45 });
      for (let i = 0; i < 4; i++) {
        const x = -1.6 + i * 2.2;
        const h = 5 + (i === 1 || i === 2 ? 2.4 : 1) + k01(d, i);
        part(s, at(d, x - 1, -2, x - 1.1, -h, x, -h - 1, x + 1, -h, x + 1, -2), STONE, sd(d) + i, { depth: 0.4, thin: 0.35, thick: 0.8 });
      }
      part(s, at(d, -3.4, -2, -5.6, -6, -4.6, -7, -2.6, -4), shift(STONE, 2), sd(d) + 7, { depth: 0.4, thin: 0.35, thick: 0.8 });
      tick(s, d.x - 6.4 * k * fx(d), d.y - 1.4 * k, d.x - 5 * k * fx(d), d.y - 4.2 * k, 0.5, 8, css(STONE, -22));
      moss(s, d.x - 6 * k, d.x - 2 * k, d.y - 0.5, sd(d));
    },
  },
  snakeskin: {
    color: () => hsl3(46, 26, 76),
    bake(s, d) {
      // A shed snake skin in a loose S along the ground, papery, its scales drawn in a few cross ticks.
      const k = d.size;
      const pts: P[] = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        pts.push({ x: d.x + (t - 0.5) * 18 * k * fx(d), y: d.y - 1.2 * k - Math.sin(t * Math.PI * 2 + k01(d, 1) * 2) * 1.6 * k });
      }
      s.fillStyle = INK;
      stroke(s, pts, { w: 3.2 * k, seed: sd(d), taper: [0.15, 0.4], press: 0 });
      s.fillStyle = css(d.color);
      stroke(s, pts, { w: 2.2 * k, seed: sd(d) + 1, taper: [0.15, 0.45], press: 0 });
      for (let i = 2; i < pts.length - 2; i += 2) tick(s, pts[i].x - 0.6, pts[i].y - 0.8 * k, pts[i].x + 0.6, pts[i].y + 0.8 * k, 0.35, i, css(d.color, -22));
    },
  },
  pitcher: {
    color: (_th, rng) => hsl3(rng.pick([10, 350, 80]), 56, 42),
    bake(s, d) {
      // A pitcher plant: a tall jug of a leaf with a lid held over its mouth, a smaller one beside it.
      const k = d.size;
      const jug = (ox: number, h: number, seed: number) => {
        const pts = at(
          d,
          ox - 1.6,
          0,
          ox - 3.2,
          -h * 0.35,
          ox - 2.4,
          -h * 0.85,
          ox - 1.8,
          -h,
          ox + 1.8,
          -h,
          ox + 2.4,
          -h * 0.85,
          ox + 3.2,
          -h * 0.35,
          ox + 1.6,
          0,
        );
        part(s, pts, d.color, seed, { depth: 0.7, thin: 0.4, thick: 0.9 });
        s.fillStyle = css(d.color, -26);
        path(s, ovalPts(d.x + ox * k * fx(d), d.y - h * k, 1.8 * k, 0.6 * k, seed, 0.05, 10));
        s.fill();
        // The lid, tilted up off the mouth.
        part(s, at(d, ox - 0.4, -h - 0.4, ox + 0.4, -h - 3.2, ox + 3, -h - 2.4), shift(d.color, 6), seed + 1, { depth: 0.3, thin: 0.3, thick: 0.6 });
        tick(s, d.x + (ox - 2) * k * fx(d), d.y - h * 0.6 * k, d.x + (ox + 2) * k * fx(d), d.y - h * 0.62 * k, 0.4, seed, css(d.color, 18));
      };
      jug(3, 7, sd(d) + 2);
      jug(-1, 11, sd(d));
    },
  },
  bamboo: {
    color: () => BAMBOO,
    bake(s, d) {
      // A stand of bamboo: three or four canes, jointed, leaning a little apart, sprays of leaves at the tops.
      const k = d.size;
      const n = 3 + (d.seed % 2);
      for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 2.6;
        const h = 28 + k01(d, i) * 14;
        const lean = (i - (n - 1) / 2) * 1.6;
        const pts = at(d, x, 0, x + lean * 0.5, -h * 0.5, x + lean, -h);
        stem(s, pts, 1.7 * k, shift(d.color, i * 4 - 4), sd(d) + i);
        for (let y = 6; y < h; y += 6 + k01(d, i + y) * 3) {
          const u = y / h;
          const jx = d.x + (x + lean * u) * k * fx(d);
          tick(s, jx - 1.2 * k, d.y - y * k, jx + 1.2 * k, d.y - y * k, 0.5, y + i, css(d.color, -26));
        }
        const tx = d.x + (x + lean) * k * fx(d);
        const ty = d.y - h * k;
        for (let j = 0; j < 3; j++) leaf(s, tx, ty + j * 2, -Math.PI / 2 + (j - 1) * 0.9 + lean * 0.05, 5 * k, 1.1 * k, hsl3(100, 44, 36 + j * 3));
      }
    },
  },
  lianas: {
    color: (th) => shift(th.terrain.capColor, -6, -10, -4),
    bake(s, d) {
      // Lianas looping down from the ceiling and back up, a leaf here and there.
      const k = d.size;
      for (let i = 0; i < 2; i++) {
        const ax = d.x - (3 + i * 2) * k;
        const bx = d.x + (4 + i * 3) * k * fx(d);
        const sag = (14 + i * 9 + k01(d, i) * 6) * k;
        const pts: P[] = [];
        for (let j = 0; j <= 12; j++) {
          const t = j / 12;
          pts.push({ x: ax + (bx - ax) * t, y: d.y + Math.sin(t * Math.PI) * sag });
        }
        stem(s, pts, 0.9, shift(d.color, -14), sd(d) + i);
        for (let j = 3; j < 12; j += 4) leaf(s, pts[j].x, pts[j].y, Math.PI / 2 + (j % 8 ? 0.6 : -0.6), 3.4 * k, 1.1 * k, d.color);
      }
      tone(s, ovalPts(d.x, d.y + 1, 3 * k, 1.4 * k, sd(d), 0.2, 10), shift(d.color, -10), { depth: 0.3 });
    },
  },
} satisfies Record<string, DecorDef>;
