import { css, type HSL, hsl3, shift } from '../core/color';
import { hash2 } from '../core/rng';
import type { Decor, DecorDef } from './decor';
import { inkFor, line, type P, stroke } from './ink';
import { boxPts, glint, ovalPts, part, path, pen, poly, tick, tone } from './ink-props';
import { bulb, circle, flutter, light } from './kit';

/**
 * The city roofs' own decor, inked like the brick and concrete they stand on: pigeons on the parapet, a
 * chimney stack with its pots, a skylight, a planter of tomato plants, a rain barrel, the stairwell's door
 * out onto the roof, a washing line, a turbine vent and a fire escape's drop ladder hanging under a ledge.
 * Small and mostly baked, so nothing here reads as somewhere to stand or something to dodge (docs/ART.md);
 * the washing and the vent only move when a gust really blows (`flutter`).
 */

const BRICK: HSL = hsl3(10, 40, 38);
const IRON: HSL = hsl3(220, 8, 24);
const TERRA: HSL = hsl3(18, 52, 44);
const WOOD: HSL = hsl3(28, 34, 36);
const GLASS: HSL = hsl3(214, 30, 30);
const TIN: HSL = hsl3(205, 8, 62);
const PIGEON: HSL = hsl3(222, 10, 50);
const LEAF: HSL = hsl3(110, 36, 34);

const sd = (d: Decor) => d.seed & 0xffff;
const k01 = (d: Decor, n: number) => hash2(n, 11, sd(d));
const fx = (d: Decor) => (d.flip ? -1 : 1);

/** Points from (x, y) offsets about the foot, scaled by the piece's size and mirrored by its flip. */
const at = (d: Decor, ...xy: number[]) => {
  const out: P[] = [];
  for (let i = 0; i + 1 < xy.length; i += 2) out.push({ x: d.x + xy[i] * d.size * fx(d), y: d.y + 0.5 + xy[i + 1] * d.size });
  return out;
};

/** A stroke with an ink edge: a post, a rail, a pipe. */
function rod(s: CanvasRenderingContext2D, pts: readonly P[], w: number, base: HSL, seed: number) {
  s.fillStyle = inkFor(base);
  stroke(s, pts, { w: w + 0.7, seed, taper: [0.02, 0.1], press: 0.1 });
  s.fillStyle = css(base);
  stroke(s, pts, { w, seed, taper: [0.02, 0.2], press: 0.1 });
}

/** A pigeon at (x, y) facing `dir`, its head down `peck` px: a grey body, a sheen at the neck, a bar on the wing. */
function pigeon(s: CanvasRenderingContext2D, x: number, y: number, dir: number, k: number, peck: number, seed: number) {
  s.fillStyle = css(hsl3(350, 50, 60));
  s.fillRect(x - 0.6 * k, y - 1.6 * k, 0.6, 1.6 * k);
  s.fillRect(x + 0.8 * k, y - 1.6 * k, 0.6, 1.6 * k);
  const body = ovalPts(x, y - 3.4 * k, 3.6 * k, 2.2 * k, seed, 0.05, 14);
  part(s, body, PIGEON, seed, { depth: 0.5, thin: 0.3, thick: 0.7 });
  // The tail, out behind.
  s.fillStyle = css(PIGEON, -18);
  path(s, poly(x - dir * 3 * k, y - 3.6 * k, x - dir * 5.6 * k, y - 4.4 * k, x - dir * 5.2 * k, y - 2.8 * k));
  s.fill();
  // Wing bars.
  tick(s, x - dir * 1.6 * k, y - 3.6 * k, x + dir * 0.4 * k, y - 3.2 * k, 0.4, seed, css(PIGEON, -26));
  tick(s, x - dir * 1.2 * k, y - 2.8 * k, x + dir * 0.8 * k, y - 2.5 * k, 0.4, seed + 1, css(PIGEON, -26));
  // Head and neck, the sheen of green and violet.
  const hx = x + dir * 2.8 * k;
  const hy = y - 5.2 * k + peck;
  s.fillStyle = css(hsl3(160, 30, 42));
  circle(s, x + dir * 2 * k, y - 4.4 * k + peck * 0.5, 1.5 * k);
  s.fillStyle = inkFor(PIGEON);
  circle(s, hx, hy, 1.45 * k);
  s.fillStyle = css(PIGEON, -6);
  circle(s, hx, hy, 1.1 * k);
  s.fillStyle = css(hsl3(30, 20, 30));
  s.fillRect(hx + dir * 1 * k - (dir < 0 ? 1.2 : 0), hy - 0.1, 1.2, 0.5);
  s.fillStyle = '#ff9a3c';
  s.fillRect(hx + dir * 0.3 * k, hy - 0.5, 0.45, 0.45);
}

/** A garment on the line at (x, y): a shirt, a sock pair, a towel or overalls, swinging `sw` with the wind. */
function garment(s: CanvasRenderingContext2D, x: number, y: number, kind: number, c: HSL, sw: number, seed: number) {
  s.save();
  s.translate(x, y);
  s.rotate(sw);
  let pts: P[];
  if (kind === 0) pts = poly(-4, 0, 4, 0, 5.5, 2.4, 3.6, 3.2, 3.2, 8.5, -3.2, 8.5, -3.6, 3.2, -5.5, 2.4);
  else if (kind === 1) pts = poly(-1.8, 0, 1.6, 0, 1.4, 5, 3.4, 6.6, 2.4, 7.8, -1.6, 6.2);
  else if (kind === 2) pts = poly(-3.4, 0, 3.4, 0, 3.6, 9.5, -3.2, 9.8);
  else pts = poly(-3.4, 0, 3.4, 0, 3.4, 5, 2, 10, 0.6, 10, 0, 5.5, -0.6, 10, -2, 10, -3.4, 5);
  part(s, pts, c, seed, { depth: 0.5, thin: 0.3, thick: 0.7 });
  if (kind === 2) for (const yy of [2, 7.5]) tick(s, -3.2, yy, 3.3, yy, 0.6, seed + yy, css(c, 20));
  // The peg.
  s.fillStyle = css(WOOD, 14);
  s.fillRect(-0.5, -1, 1, 1.8);
  s.restore();
}

export const ROOFTOPS_DECOR = {
  pigeons: {
    color: () => PIGEON,
    live(rc, d) {
      // Two or three on the roof, a beat apart; now and then one pecks at the gravel.
      const n = 1 + (d.seed % 2);
      for (let i = 0; i < n; i++) {
        const dir = (i + (d.flip ? 1 : 0)) % 2 ? -1 : 1;
        const t = rc.t * 1.1 + i * 1.7 + (d.seed % 13);
        const peck = Math.sin(t) > 0.9 ? 1.6 : 0;
        pigeon(rc.s, d.x + (i - (n - 1) / 2) * 9, d.y + 0.5, dir, 1.2 * d.size, peck, sd(d) + i);
      }
    },
  },
  chimneypot: {
    color: () => BRICK,
    bake(s, d) {
      // A brick stack, its coping slab and one or two clay pots on top.
      const w = 8;
      const h = 13 * d.size;
      const pts = boxPts(d.x - w / 2, d.y - h, w, h + 0.5, 0.6, sd(d), 0.08);
      part(s, pts, shift(BRICK, 0, 0, (k01(d, 1) - 0.5) * 8), sd(d), { depth: 1, thin: 0.4, thick: 1 });
      for (let y = d.y - 3; y > d.y - h + 2; y -= 3) tick(s, d.x - w / 2 + 0.6, y, d.x + w / 2 - 0.6, y, 0.35, y, css(BRICK, -18));
      for (let y = d.y - 3, i = 0; y > d.y - h + 2; y -= 3, i++)
        tick(s, d.x + (i % 2 ? -1 : 1.4), y, d.x + (i % 2 ? -1 : 1.4), y - 3, 0.3, y + 3, css(BRICK, -18));
      part(s, boxPts(d.x - w / 2 - 1, d.y - h - 1.6, w + 2, 2, 0.4, sd(d) + 1, 0.05), hsl3(30, 6, 62), sd(d) + 1, { depth: 0.4, thin: 0.3, thick: 0.8 });
      const pots = 1 + (d.seed % 2);
      for (let i = 0; i < pots; i++) {
        const px = d.x + (pots === 1 ? 0 : (i - 0.5) * 3.8);
        const ph = 4 + k01(d, i + 2) * 2;
        part(s, poly(px - 1.6, d.y - h - 1.6, px - 1.1, d.y - h - 1.6 - ph, px + 1.1, d.y - h - 1.6 - ph, px + 1.6, d.y - h - 1.6), TERRA, sd(d) + 3 + i, {
          depth: 0.4,
          thin: 0.3,
          thick: 0.7,
        });
        s.fillStyle = inkFor(TERRA);
        s.fillRect(px - 1, d.y - h - 1.8 - ph, 2, 0.8);
      }
    },
  },
  skylight: {
    color: () => GLASS,
    bake(s, d) {
      // A low pitched light on a curb: two glass slopes in a metal frame, the glazing bars over them.
      const w = 14 * d.size;
      const curb = 2.4;
      part(s, boxPts(d.x - w / 2, d.y - curb, w, curb + 0.5, 0.4, sd(d), 0.06), hsl3(30, 6, 54), sd(d), { depth: 0.4, thin: 0.3, thick: 0.8 });
      const top = d.y - curb - 5 * d.size;
      const roof = poly(d.x - w / 2 + 0.6, d.y - curb, d.x - 1.5, top, d.x + 1.5, top, d.x + w / 2 - 0.6, d.y - curb);
      tone(s, roof, GLASS, { depth: 0.6 });
      s.fillStyle = css(TIN, -10);
      for (let i = 1; i < 4; i++) {
        const u = i / 4;
        line(s, d.x - w / 2 + 0.6 + (w - 1.2) * u, d.y - curb, d.x - 1.5 + 3 * u, top, { w: 0.45, seed: i, taper: [0, 0], press: 0 });
      }
      glint(s, poly(d.x - w / 2 + 2.4, d.y - curb - 0.8, d.x - 3.4, top + 1.6), 'rgba(220,235,255,0.6)', 0.6);
      pen(s, roof, sd(d) + 1, 0.3, 0.8, 3, inkFor(GLASS));
    },
    live(rc, d) {
      // Someone's home: a warm lamp under the glass at night.
      if ((d.seed >> 4) % 3 === 0) return;
      light(rc, d.x, d.y - 4, 26, hsl3(40, 90, 66), 0.35);
    },
  },
  planter: {
    color: () => LEAF,
    bake(s, d) {
      // A timber planter of tomato plants up canes, or a row of terracotta pots of herbs.
      if (d.seed % 2) {
        const w = 13 * d.size;
        const h = 4.4;
        for (let i = 0; i < 3; i++) {
          const px = d.x - w / 2 + 2.2 + i * ((w - 4.4) / 2);
          tick(s, px, d.y - h, px + (k01(d, i) - 0.5) * 1.2, d.y - h - 9 * d.size, 0.5, i, css(WOOD, 12));
          for (let j = 0; j < 4; j++) {
            s.fillStyle = css(LEAF, j % 2 ? 6 : -4);
            const ly = d.y - h - 2 - j * 2.2 * d.size;
            path(s, ovalPts(px + (j % 2 ? 1.6 : -1.6), ly, 2, 1.1, i * 9 + j, 0.1, 8));
            s.fill();
          }
          if (k01(d, i + 5) < 0.6) {
            s.fillStyle = inkFor(hsl3(6, 70, 50));
            circle(s, px + 1.2, d.y - h - 3.6, 1.25);
            s.fillStyle = css(hsl3(6, 70, 50));
            circle(s, px + 1.2, d.y - h - 3.6, 0.9);
          }
        }
        part(s, boxPts(d.x - w / 2, d.y - h, w, h + 0.5, 0.5, sd(d), 0.06), WOOD, sd(d), { depth: 0.6, thin: 0.35, thick: 0.9 });
        for (const x of [d.x - w / 4, d.x + w / 4]) tick(s, x, d.y - h + 0.6, x, d.y - 0.2, 0.35, x, css(WOOD, -16));
      } else {
        for (let i = 0; i < 3; i++) {
          const px = d.x + (i - 1) * 5;
          const ph = 4 + k01(d, i) * 1.6;
          s.fillStyle = css(LEAF, i * 4 - 4);
          for (let j = 0; j < 3; j++) {
            path(s, ovalPts(px + (j - 1) * 1.4, d.y - ph - 1.8 - (j % 2) * 1.2, 1.4, 1.9, i * 7 + j, 0.1, 8));
            s.fill();
          }
          part(s, poly(px - 2.2, d.y - ph, px + 2.2, d.y - ph, px + 1.6, d.y + 0.4, px - 1.6, d.y + 0.4), TERRA, sd(d) + i, {
            depth: 0.4,
            thin: 0.3,
            thick: 0.7,
          });
        }
      }
    },
  },
  rainbarrel: {
    color: (_th, rng) => (rng.chance(0.5) ? hsl3(208, 46, 40) : hsl3(28, 36, 34)),
    bake(s, d) {
      // A drum on two bricks, its hoops, and the downpipe's elbow over its lid.
      const w = 7.5 * d.size;
      const h = 10 * d.size;
      for (const x of [-2.2, 2.2])
        part(s, boxPts(d.x + x - 1.6, d.y - 1.6, 3.2, 2.1, 0.3, sd(d) + x, 0.05), BRICK, sd(d) + x, { depth: 0.3, thin: 0.3, thick: 0.7 });
      const body = boxPts(d.x - w / 2, d.y - 1.6 - h, w, h, 1.4, sd(d), 0.3);
      part(s, body, d.color, sd(d), { depth: 0.9, thin: 0.4, thick: 1 });
      for (const u of [0.22, 0.78]) tick(s, d.x - w / 2 + 0.4, d.y - 1.6 - h * u, d.x + w / 2 - 0.4, d.y - 1.6 - h * u, 0.55, u * 10, css(d.color, -22));
      rod(s, at(d, 1.5, -12.6, 1.5, -14.5, 4, -14.5), 1, shift(TIN, -6), sd(d) + 4);
    },
  },
  roofdoor: {
    color: () => hsl3(30, 8, 52),
    bake(s, d) {
      // The stairwell's way out onto the roof: a narrow doorway in its frame under a little tin hood.
      const w = 9;
      const h = 19 * Math.min(1.1, d.size);
      const frame = boxPts(d.x - w / 2, d.y - h, w, h + 0.5, 0.5, sd(d), 0.05);
      part(s, frame, d.color, sd(d), { depth: 0.6, thin: 0.35, thick: 0.9 });
      const door = boxPts(d.x - w / 2 + 1.6, d.y - h + 3.4, w - 3.2, h - 3.4, 0.3, sd(d) + 1, 0.04);
      part(s, door, hsl3(k01(d, 3) < 0.5 ? 150 : 8, 30, 32), sd(d) + 1, { depth: 0.5, thin: 0.3, thick: 0.7 });
      // The bar, the knob, and the hood over it all.
      tick(s, d.x - w / 2 + 2.2, d.y - h * 0.48, d.x + w / 2 - 2.2, d.y - h * 0.48, 0.6, 2, css(TIN, 6));
      tick(s, d.x + w / 2 - 2.9, d.y - h * 0.4, d.x + w / 2 - 2.3, d.y - h * 0.4, 0.9, 3, css(TIN, 10));
      part(
        s,
        poly(d.x - w / 2 - 1.6, d.y - h + 0.2, d.x - w / 2 - 0.6, d.y - h - 1.8, d.x + w / 2 + 0.6, d.y - h - 1.8, d.x + w / 2 + 1.6, d.y - h + 0.2),
        TIN,
        sd(d) + 2,
        {
          depth: 0.3,
          thin: 0.3,
          thick: 0.7,
        },
      );
    },
    live(rc, d) {
      // The caged lamp over the door.
      const h = 19 * Math.min(1.1, d.size);
      bulb(rc.g, d.x, d.y - h + 1.6, 0.9, hsl3(44, 90, 70), 0.9);
      light(rc, d.x, d.y - h + 2, 30, hsl3(44, 90, 66), 0.45);
    },
  },
  laundry: {
    color: (_th, rng) => hsl3(rng.range(0, 360), 30, 62),
    bake(s, d) {
      // The two posts at the ends of the line.
      const x0 = d.x + 1;
      const x1 = d.x + d.span * 16 - 3;
      for (const x of [x0, x1]) {
        rod(s, poly(x, d.y + 0.5, x, d.y - 19), 0.9, shift(TIN, -14), x);
        rod(s, poly(x - 2.4, d.y - 18, x + 2.4, d.y - 18), 0.6, shift(TIN, -14), x + 1);
      }
    },
    live(rc, d) {
      const s = rc.s;
      const x0 = d.x + 1;
      const x1 = d.x + d.span * 16 - 3;
      const y = d.y - 18;
      const sag = 2.6;
      // The line, and what's on it: swinging only with a real gust.
      const pts: P[] = [];
      for (let i = 0; i <= 8; i++) {
        const u = i / 8;
        pts.push({ x: x0 + (x1 - x0) * u, y: y + sag * 4 * u * (1 - u) });
      }
      s.fillStyle = inkFor(TIN);
      stroke(s, pts, { w: 0.5, seed: sd(d), taper: [0, 0], press: 0 });
      const n = Math.max(2, Math.floor((x1 - x0) / 7));
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n;
        const gx = x0 + (x1 - x0) * u;
        const gy = y + sag * 4 * u * (1 - u);
        const sw = flutter(rc, 1.6, i * 1.3 + (d.seed % 7)) * 0.22;
        const c = shift(d.color, (hash2(i, 5, sd(d)) - 0.5) * 20, 0, (hash2(i, 4, sd(d)) - 0.5) * 220);
        garment(s, gx, gy, Math.floor(hash2(i, 6, sd(d)) * 4), c, sw, sd(d) + i);
      }
    },
  },
  whirlybird: {
    color: () => TIN,
    bake(s, d) {
      // A turbine vent: a short stack under a dome of curved vanes.
      const k = d.size;
      part(s, boxPts(d.x - 2, d.y - 4 * k, 4, 4 * k + 0.5, 0.3, sd(d), 0.05), shift(TIN, -10), sd(d), { depth: 0.4, thin: 0.3, thick: 0.8 });
      const dome: P[] = [];
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI + (i / 10) * Math.PI;
        dome.push({ x: d.x + Math.cos(a) * 4.6 * k, y: d.y - 4 * k + Math.sin(a) * 6 * k });
      }
      part(s, dome, TIN, sd(d) + 1, { depth: 0.6, thin: 0.35, thick: 0.9 });
      tick(s, d.x, d.y - 10 * k, d.x, d.y - 11.4 * k, 0.8, 2, inkFor(TIN));
    },
    live(rc, d) {
      // The vanes: they turn in a gust and sit still in calm air.
      const k = d.size;
      const spin = (rc.t * 3 * Math.abs(flutter(rc, 1, d.seed % 5))) % 1;
      rc.s.fillStyle = css(TIN, -24);
      for (let i = 0; i < 4; i++) {
        const u = ((i + spin) / 4) * 2 - 1;
        const x = d.x + u * 4 * k;
        line(rc.s, x * 0.7 + d.x * 0.3, d.y - 9.4 * k, x, d.y - 4.6 * k, { w: 0.45, seed: i, taper: [0.2, 0.2], press: 0 });
      }
    },
  },
  dropladder: {
    color: () => IRON,
    bake(s, d) {
      // A fire escape's drop ladder hanging under a ledge on its hooks: two rails and the rungs between.
      const h = 24 * Math.min(1.1, d.size);
      const w = 6;
      for (const x of [-w / 2, w / 2]) rod(s, poly(d.x + x, d.y - 0.5, d.x + x, d.y + h), 0.8, shift(IRON, 10), x);
      for (let y = d.y + 3; y < d.y + h - 1; y += 3.4) tick(s, d.x - w / 2, y, d.x + w / 2, y, 0.6, y, css(IRON, 16));
      for (const x of [-w / 2 - 1, w / 2 + 1]) {
        s.fillStyle = inkFor(IRON);
        line(s, d.x + x, d.y - 0.2, d.x + x * 0.6, d.y + 2.2, { w: 0.9, seed: x, taper: [0, 0.3], press: 0 });
      }
    },
  },
} satisfies Record<'pigeons' | 'chimneypot' | 'skylight' | 'planter' | 'rainbarrel' | 'roofdoor' | 'laundry' | 'whirlybird' | 'dropladder', DecorDef>;
