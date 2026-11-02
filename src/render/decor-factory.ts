import { css, type HSL, hsl3 } from '../core/color';
import type { DecorDef } from './decor';
import { blob, inkFor, line, type P, stroke } from './ink';
import { boxPts, glint, ovalPts, part, path, poly, tick } from './ink-props';
import { flutter } from './kit';

/**
 * The factory's decor, small and cosmetic like all decor: a pressure gauge on its riser, the time clock
 * with its rack of cards, a fire extinguisher on its stand, traffic cones, a pallet of boxes under shrink
 * wrap, and a crane hook hanging off its chain. Every line is a dark of what it outlines (`inkFor`), every
 * surface two flat hand-cut tones, at most a mark or two inside. Nothing glows; the hook swings only when a
 * gust really blows (`flutter`, 0 in still air).
 */

const k01 = (seed: number, n: number) => ((seed >>> n) % 1000) / 1000;
const sd = (seed: number) => seed & 0xffff;

const STEEL: HSL = hsl3(212, 8, 56);
const IRON: HSL = hsl3(215, 9, 32);
const FACE: HSL = hsl3(44, 24, 86);
const RED: HSL = hsl3(4, 62, 46);
const CONE: HSL = hsl3(22, 76, 52);
const WOOD: HSL = hsl3(32, 34, 50);
const CARD: HSL = hsl3(46, 30, 80);
const HAZARD: HSL = hsl3(46, 72, 52);
/** Shrink wrap where it catches the light. */
const FILM: HSL = hsl3(205, 30, 90);

/** Points in decor space: (x, y) offsets from the foot, mirrored by `f`. */
const at = (x0: number, y0: number, f: number, ...xy: number[]) => {
  const out: P[] = [];
  for (let i = 0; i + 1 < xy.length; i += 2) out.push({ x: x0 + xy[i] * f, y: y0 + xy[i + 1] });
  return out;
};

/** A rod: a rim in a dark of its colour, the colour over it. */
function rod(s: CanvasRenderingContext2D, pts: readonly P[], w: number, c: HSL, seed: number) {
  s.fillStyle = inkFor(c);
  stroke(s, pts, { w: w + 0.6, seed, taper: [0, 0], press: 0.05 });
  s.fillStyle = css(c);
  stroke(s, pts, { w, seed, taper: [0, 0], press: 0.05 });
}

/** A small mark in a dark of the colour it sits on. */
const mark = (s: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, on: HSL, seed: number, w = 0.5) =>
  tick(s, ax, ay, bx, by, w, seed, inkFor(on));

export const FACTORY_DECOR = {
  gauge: {
    color: (_th, rng) => (rng.chance(0.5) ? STEEL : hsl3(150, 16, 40)),
    bake(s, d) {
      // A pressure gauge on a riser out of the floor: a hand wheel on the valve, the dial on top.
      const f = d.flip ? -1 : 1;
      rod(s, at(d.x, d.y, f, 0, 0, 0, -9), 1.6, d.color, sd(d.seed));
      part(s, boxPts(d.x - 2.6, d.y - 1.6, 5.2, 1.6, 0.4, sd(d.seed) + 1, 0.1), d.color, sd(d.seed) + 1, { depth: 0.3, thin: 0.3, thick: 0.6 });
      // The valve's hand wheel, seen edge on: a red bar across the riser.
      rod(s, at(d.x, d.y, f, -2.6, -4.6, 2.6, -4.2), 0.9, RED, sd(d.seed) + 2);
      const r = 3.4 * d.size;
      const cy = d.y - 9 - r * 0.7;
      part(s, ovalPts(d.x, cy, r + 0.8, r + 0.8, sd(d.seed) + 3, 0.02, 14), IRON, sd(d.seed) + 3, { depth: 0.5, thin: 0.35, thick: 0.8 });
      s.fillStyle = css(FACE);
      path(s, ovalPts(d.x, cy, r, r, sd(d.seed) + 4, 0.02, 14));
      s.fill();
      // The red zone, two ticks, and the needle, past the middle.
      s.fillStyle = css(RED, 4);
      path(s, poly(d.x + r * 0.55, cy - r * 0.55, d.x + r * 0.9, cy - r * 0.1, d.x + r * 0.62, cy - r * 0.05, d.x + r * 0.4, cy - r * 0.38));
      s.fill();
      for (const a of [-2.4, -0.7])
        mark(s, d.x + Math.cos(a) * r * 0.75, cy + Math.sin(a) * r * 0.75, d.x + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95, FACE, a * 10, 0.4);
      const n = -1.2 + k01(d.seed, 3) * 1.1;
      tick(s, d.x, cy, d.x + Math.cos(n) * r * 0.85, cy + Math.sin(n) * r * 0.85, 0.5, sd(d.seed) + 5, inkFor(IRON));
    },
  },
  timeclock: {
    color: () => hsl3(200, 14, 52),
    bake(s, d) {
      // The time clock on its post, a rack of cards beside it with one sticking out: punch in, run.
      const f = d.flip ? -1 : 1;
      const k = d.size;
      rod(s, at(d.x, d.y, f, 0, 0, 0, -16 * k), 1.3, IRON, sd(d.seed));
      part(s, boxPts(d.x - 4.5, d.y - 25 * k, 9, 9 * k, 1.2, sd(d.seed) + 1, 0.12), d.color, sd(d.seed) + 1, { depth: 0.8, thin: 0.4, thick: 0.9 });
      // Its face: a small round clock, hands at a time nobody wants to be at work.
      const cx = d.x;
      const cy = d.y - 21.5 * k;
      s.fillStyle = css(FACE);
      path(s, ovalPts(cx, cy, 2.6, 2.6, sd(d.seed) + 2, 0.02, 12));
      s.fill();
      mark(s, cx, cy, cx, cy - 2, FACE, 3, 0.45);
      mark(s, cx, cy, cx + f * 1.5, cy + 0.6, FACE, 4, 0.45);
      // The card slot under it.
      s.fillStyle = inkFor(d.color);
      s.fillRect(cx - 2.2, d.y - 17.5 * k, 4.4, 0.9);
      // The rack on the post, its cards.
      const rx = d.x + f * 4.5;
      part(s, poly(rx - 2.2 * f, d.y - 14 * k, rx + 2.4 * f, d.y - 14 * k, rx + 2.4 * f, d.y - 6 * k, rx - 2.2 * f, d.y - 6 * k), IRON, sd(d.seed) + 5, {
        depth: 0.3,
        thin: 0.3,
        thick: 0.6,
      });
      for (let i = 0; i < 3; i++) {
        const y = d.y - (13 - i * 2.6) * k;
        const up = i === Math.floor(k01(d.seed, 5) * 3) ? 1.6 : 0;
        part(s, boxPts(rx - 1.6, y - up, 3.2, 2.4 + up, 0.2, sd(d.seed) + 6 + i, 0.05), CARD, sd(d.seed) + 6 + i, { depth: 0.2, thin: 0.25, thick: 0.5 });
      }
    },
  },
  extinguisher: {
    color: () => RED,
    bake(s, d) {
      // A fire extinguisher on a little stand: the red bottle, its hose curled round, a sign above it.
      const f = d.flip ? -1 : 1;
      const k = d.size;
      const h = 9 * k;
      part(s, boxPts(d.x - 2.4, d.y - h, 4.8, h, 2, sd(d.seed), 0.1), d.color, sd(d.seed), { depth: 0.7, thin: 0.4, thick: 0.9 });
      glint(s, poly(d.x - 1.4, d.y - h + 2, d.x - 1.5, d.y - 2.5), css(d.color, 22), 0.6);
      // The neck and handle, the hose down its side.
      part(s, boxPts(d.x - 1, d.y - h - 1.8, 2, 2, 0.4, sd(d.seed) + 1, 0.05), IRON, sd(d.seed) + 1, { depth: 0.2, thin: 0.25, thick: 0.5 });
      rod(s, at(d.x, d.y, f, -0.5, -h - 1.8, 2.8, -h - 2.4), 0.7, IRON, sd(d.seed) + 2);
      const hose: P[] = [];
      for (let i = 0; i <= 6; i++) {
        const u = i / 6;
        hose.push({ x: d.x + f * (1.2 + Math.sin(u * Math.PI) * 2.2), y: d.y - h - 1 + u * (h * 0.7) });
      }
      rod(s, hose, 0.6, hsl3(220, 10, 20), sd(d.seed) + 3);
      // A white label band.
      s.fillStyle = css(FACE, -4);
      s.fillRect(d.x - 2.1, d.y - h * 0.55, 4.2, 1.6);
    },
  },
  cone: {
    color: () => CONE,
    bake(s, d) {
      // One or two traffic cones on their square feet, a white band round each.
      const f = d.flip ? -1 : 1;
      const one = (cx: number, h: number, seed: number) => {
        part(s, boxPts(cx - 3.4, d.y - 1.3, 6.8, 1.3, 0.3, seed, 0.05), d.color, seed, { depth: 0.2, thin: 0.3, thick: 0.6 });
        const body = poly(cx - 2.6, d.y - 1.2, cx - 0.6, d.y - h, cx + 0.6, d.y - h, cx + 2.6, d.y - 1.2);
        part(s, body, d.color, seed + 1, { depth: 0.6, thin: 0.35, thick: 0.85 });
        const band = (u0: number, u1: number) => {
          const w0 = 2.6 - 2 * u0;
          const w1 = 2.6 - 2 * u1;
          const y0 = d.y - 1.2 - (h - 1.2) * u0;
          const y1 = d.y - 1.2 - (h - 1.2) * u1;
          s.fillStyle = css(FACE);
          path(s, poly(cx - w0, y0, cx - w1, y1, cx + w1, y1, cx + w0, y0));
          s.fill();
        };
        band(0.42, 0.62);
      };
      one(d.x, 8 * d.size, sd(d.seed));
      if (k01(d.seed, 2) < 0.45) one(d.x + f * 6.5, 6.5 * d.size, sd(d.seed) + 7);
    },
  },
  pallet: {
    color: (_th, rng) => hsl3(rng.range(28, 36), 30, 56),
    bake(s, d) {
      // A pallet of boxes under shrink wrap: the slats and blocks, the boxes, a band of wrap round them.
      const k = d.size;
      const w = 12 * k;
      const x = d.x - w / 2;
      for (const bx of [x + 0.4, d.x - 1.2, x + w - 2.8])
        part(s, boxPts(bx, d.y - 1.8, 2.4, 1.8, 0.2, sd(d.seed) + bx, 0.05), WOOD, bx, { depth: 0.2, thin: 0.25, thick: 0.5 });
      part(s, boxPts(x, d.y - 2.8, w, 1.1, 0.2, sd(d.seed) + 1, 0.05), WOOD, sd(d.seed) + 1, { depth: 0.2, thin: 0.3, thick: 0.6 });
      const rows = k01(d.seed, 3) < 0.5 ? 2 : 1;
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < 2; c++) {
          const bw = w / 2 - 0.4 - r * 0.6;
          const by = d.y - 2.8 - (r + 1) * 4.4;
          part(s, boxPts(x + 0.2 + c * (w / 2) + r * 0.6, by, bw, 4.4, 0.3, sd(d.seed) + r * 2 + c + 2, 0.08), d.color, sd(d.seed) + r * 2 + c + 2, {
            depth: 0.4,
            thin: 0.3,
            thick: 0.7,
          });
          mark(s, x + c * (w / 2) + bw * 0.3, by + 1.6, x + c * (w / 2) + bw * 0.7, by + 1.6, d.color, r + c, 0.45);
        }
      // The wrap: film pulled taut over the stack, read by where it catches the light: hard pale slivers across
      // the boxes, its gathered edge along the top and a pucker at each corner. Clear film, so no wash over it.
      const top = d.y - 2.8 - rows * 4.4;
      const film = css(FILM);
      s.fillStyle = film;
      path(s, poly(x + 1.2, d.y - 3.6, x + 2.4, d.y - 3.6, x + w * 0.55, top + 1.4, x + w * 0.55 - 1, top + 1.4));
      s.fill();
      path(s, poly(x + w * 0.62, d.y - 3.6, x + w * 0.62 + 0.8, d.y - 3.6, x + w - 0.8, top + 3.6, x + w - 0.8, top + 2.6));
      s.fill();
      s.fillStyle = film;
      stroke(s, poly(x - 0.2, top + 0.9, x + w * 0.5, top + 0.5, x + w + 0.2, top + 1), { w: 0.9, seed: sd(d.seed) + 9, taper: [0.1, 0.2], press: 0.3 });
      for (const cx of [x + 0.6, x + w - 0.6]) tick(s, cx, top + 1, cx - Math.sign(cx - d.x) * 1.4, top + 2.6, 0.45, cx | 0, css(FILM, -14));
      glint(s, poly(x + w * 0.2, top + 2.4, x + w * 0.38, top + 1.6), css(FILM, 6), 0.5);
    },
  },
  hook: {
    color: () => HAZARD,
    live(rc, d) {
      // A crane hook on a chain off the ceiling: a yellow block, the hook under it, a latch.
      const s = rc.s;
      const sw = flutter(rc, 0.9, d.seed) * 0.08;
      const len = (8 + (d.seed % 6)) * d.size;
      const hx = d.x + Math.sin(sw) * len;
      const hy = d.y + Math.cos(sw) * len;
      const ink = inkFor(IRON);
      for (let i = 0, y = 0; y < len - 1; y += 2.6, i++) {
        const u = y / len;
        const cx = d.x + (hx - d.x) * u;
        const cy = d.y + (hy - d.y) * u;
        s.fillStyle = ink;
        if (i % 2) line(s, cx, cy, cx + (hx - d.x) / len, cy + 2.8, { w: 1.1, seed: i, taper: [0, 0], press: 0 });
        else {
          blob(s, cx, cy + 1.3, 1.2, i, 1.6, 0.05);
          s.fill();
        }
      }
      part(s, boxPts(hx - 3, hy, 6, 4.5, 0.8, sd(d.seed), 0.1), d.color, sd(d.seed), { depth: 0.5, thin: 0.35, thick: 0.8 });
      mark(s, hx - 1.8, hy + 1.2, hx - 0.4, hy + 3.4, d.color, 3, 0.6);
      mark(s, hx + 0.4, hy + 1.2, hx + 1.8, hy + 3.4, d.color, 4, 0.6);
      const f = d.flip ? -1 : 1;
      const hk: P[] = [];
      for (let i = 0; i <= 10; i++) {
        const a = (i / 10) * Math.PI * 1.35 - Math.PI * 0.1;
        hk.push({ x: hx + f * Math.cos(a) * 2.6 - f * 0.4, y: hy + 7.6 + Math.sin(a) * 2.6 });
      }
      rod(s, [{ x: hx, y: hy + 4.5 }, { x: hx, y: hy + 6 }, ...hk.slice(0, 1)], 1.4, STEEL, 7);
      rod(s, hk, 1.4, STEEL, 8);
    },
  },
} satisfies Record<string, DecorDef>;
