import { css, type HSL, hsl3, shift } from '../core/color';
import { hash2 } from '../core/rng';
import type { Decor, DecorDef } from './decor';
import { blob, inkFor, line, type P, stroke } from './ink';
import { boxPts, glint, ovalPts, part, path, tick } from './ink-props';
import { flame, flutter, glowDot, light } from './kit';

/**
 * The castle's decor, inked like the stone it stands on: a suit of armour with nobody in it, a brazier on
 * its tripod, a rack of polearms, a cluster of candles, the stocks, fallen masonry; cobwebs and a gibbet
 * cage hanging from a ceiling. Small and cosmetic like all decor: nothing here reads as somewhere to stand
 * or something to dodge. Every line is a dark of what it outlines (`inkFor`); only fire glows, and only the
 * flame. What hangs sways only when a gust really blows (`flutter`, 0 in still air).
 */

const STEEL: HSL = hsl3(214, 10, 62);
const IRON: HSL = hsl3(222, 9, 30);
const WOOD: HSL = hsl3(26, 36, 32);
const WAX: HSL = hsl3(44, 34, 84);
const FIRE: HSL = hsl3(30, 100, 58);
const CLOTH: HSL = hsl3(352, 48, 36);

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
const X = (d: Decor, x: number) => d.x + x * d.size * fx(d);
const Y = (d: Decor, y: number) => d.y + 0.5 + y * d.size;

/** A rod, haft or rope: a ribbon in a dark of its colour with the colour over it. */
function rod(s: CanvasRenderingContext2D, pts: readonly P[], w: number, c: HSL, seed: number) {
  s.fillStyle = inkFor(c);
  stroke(s, pts, { w: w + 0.8, seed, taper: [0.02, 0.15], press: 0.1 });
  s.fillStyle = css(c);
  stroke(s, pts, { w, seed: seed + 1, taper: [0.02, 0.25], press: 0.1 });
}

/** Flat shapes in two tones with the light pen round them. */
const shape = (s: CanvasRenderingContext2D, pts: readonly P[], c: HSL, seed: number, depth = 0.6) => part(s, pts, c, seed, { depth, thin: 0.3, thick: 0.8 });

export const CASTLE_DECOR = {
  armour: {
    color: (_th, rng) => shift(STEEL, rng.range(-6, 6), 0, rng.range(-6, 4)),
    bake(s, d) {
      // A suit of armour on its plinth, gauntlets on the pommel of a sword stood point-down: a closed helm
      // with a breathing grille and a plume, nobody inside.
      const c = d.color;
      shape(s, at(d, -5.5, 0, 5.5, 0, 5, -2.4, -5, -2.4), shift(IRON, 0, 0, 14), sd(d), 0.5);
      // Legs: greaves and sabatons.
      for (const side of [-1, 1])
        shape(s, at(d, side * 0.6, -2.4, side * 3.4, -2.4, side * 3, -11, side * 0.9, -11), shift(c, 0, 0, side > 0 ? -8 : 0), sd(d) + side, 0.4);
      // The cuirass, broad at the shoulder, a tasset skirt under it.
      shape(s, at(d, -3.8, -10.4, 3.8, -10.4, 4.4, -12.6, 4.2, -18.4, -4.2, -18.4, -4.4, -12.6), c, sd(d) + 3, 0.8);
      tick(s, X(d, -3.4), Y(d, -12.6), X(d, 3.4), Y(d, -12.6), 0.4, 4, inkFor(c));
      glint(s, at(d, -2.4, -17.4, -1.8, -14.2), css(c, 26), 0.6, sd(d));
      // Pauldrons, and the arms down to the hands on the pommel.
      for (const side of [-1, 1]) {
        shape(s, ovalPts(X(d, side * 4.4), Y(d, -17.6), 2.2 * d.size, 1.6 * d.size, sd(d) + side * 5, 0.06, 12), shift(c, 0, 0, 4), sd(d) + side * 5, 0.4);
        rod(s, at(d, side * 4.6, -16.6, side * 4.2, -12.6, side * 1.4, -9.6), 1.5, shift(c, 0, 0, -6), sd(d) + side * 7);
      }
      // The sword: blade down past the hands to the plinth, a crossguard under the gauntlets.
      rod(s, at(d, 0, -9.2, 0, -2.6), 1.1, STEEL, sd(d) + 9);
      rod(s, at(d, -2.4, -9.4, 2.4, -9.4), 0.7, shift(IRON, 0, 0, 10), sd(d) + 10);
      // The great helm: a pot with a ridge down its face and a grille of breathing holes, never eyes.
      const helm = at(d, -2.8, -18.6, 2.8, -18.6, 3, -22.6, 2, -24.6, -2, -24.6, -3, -22.6);
      shape(s, helm, c, sd(d) + 11, 0.6);
      tick(s, X(d, 0.4), Y(d, -24.2), X(d, 0.4), Y(d, -19.2), 0.4, 12, inkFor(c));
      for (let i = 0; i < 3; i++) tick(s, X(d, 1.4), Y(d, -20 - i * 0.9), X(d, 2.2), Y(d, -20 - i * 0.9), 0.3, 13 + i, inkFor(c));
      // The plume, its colour the house's.
      shape(s, at(d, 0, -24.4, -1.4, -27.6, -4.6, -28.4, -2.6, -26.6, -1.2, -24.4), CLOTH, sd(d) + 14, 0.4);
    },
  },
  brazier: {
    color: () => FIRE,
    bake(s, d) {
      // An iron bowl on three splayed legs, coals heaped in it.
      for (const lx of [-4, 0.4, 4]) rod(s, at(d, lx, 0, lx * 0.35, -7.4), 0.8, IRON, sd(d) + lx);
      rod(s, at(d, -3, -3.2, 3, -3.2), 0.5, IRON, sd(d) + 7);
      shape(s, at(d, -5.4, -11, 5.4, -11, 3.8, -7, -3.8, -7), IRON, sd(d), 0.5);
      for (const x of [-3.6, 3.6]) tick(s, X(d, x), Y(d, -10.6), X(d, x * 0.8), Y(d, -7.4), 0.35, x, css(IRON, 18));
      // Coals: dark lumps with the hot cracks between them.
      for (let i = 0; i < 4; i++) {
        s.fillStyle = css(hsl3(14, 30, 16));
        blob(s, X(d, -3 + i * 2), Y(d, -11.2 - (i % 2) * 0.6), 1.2 * d.size, sd(d) + i, 1, 0.15);
        s.fill();
      }
      s.fillStyle = css(FIRE, -6);
      for (let i = 0; i < 3; i++) s.fillRect(Math.min(X(d, -2 + i * 2), X(d, -1.4 + i * 2)), Y(d, -11.4), 0.7 * d.size, 0.5 * d.size);
    },
    live(rc, d) {
      const k = d.size;
      const fl = 0.85 + Math.sin(rc.t * 15 + d.seed) * 0.1 + Math.sin(rc.t * 27 + d.seed * 3) * 0.06;
      const fy = Y(d, -11.6);
      flame(rc.g, d.x, fy, 3.6 * k * fl, 7 * k * fl, d.color, rc.t + d.seed);
      glowDot(rc.g, d.x, fy - 2.4, 18 * k, d.color, 0.32 * fl);
      light(rc, d.x, fy - 3, 84 * k, d.color, 0.9 * fl);
    },
  },
  weaponrack: {
    color: () => WOOD,
    bake(s, d) {
      // A rack of polearms: a spear, a halberd and a pike stood in a wooden frame, leaning a little.
      const hafts: [number, number, 'spear' | 'halberd' | 'pike'][] = [
        [-3.4, -24, 'spear'],
        [0, -27, 'halberd'],
        [3.4, -25, 'pike'],
      ];
      for (const [i, [x, top, kind]] of hafts.entries()) {
        const lean = (k01(d, i) - 0.5) * 1.6;
        rod(s, at(d, x, -0.4, x + lean, top), 0.7, shift(WOOD, 0, 0, 8), sd(d) + i);
        const tx = x + lean;
        if (kind === 'halberd') {
          shape(s, at(d, tx, top - 3.4, tx + 0.8, top - 0.6, tx - 0.8, top - 0.6), STEEL, sd(d) + i + 3, 0.3);
          shape(s, at(d, tx + 0.4, top + 0.2, tx + 4, top - 0.6, tx + 4.4, top + 3, tx + 0.4, top + 2.2), STEEL, sd(d) + i + 4, 0.4);
        } else shape(s, at(d, tx, top - (kind === 'pike' ? 3 : 4.2), tx + 1, top + 0.4, tx - 1, top + 0.4), STEEL, sd(d) + i + 3, 0.3);
      }
      // The frame: two uprights and the rails the hafts rest in.
      for (const x of [-5.4, 5.4]) rod(s, at(d, x, 0, x, -12), 1.1, WOOD, sd(d) + x);
      for (const y of [-2.2, -10.4]) rod(s, at(d, -6, y, 6, y), 0.9, shift(WOOD, 0, 0, -4), sd(d) + y);
    },
  },
  candles: {
    color: () => FIRE,
    bake(s, d) {
      // A cluster of candles burnt to different heights, wax run down them into a pool on the floor.
      s.fillStyle = css(WAX, -6);
      path(s, ovalPts(d.x, d.y + 0.2, 5.4 * d.size, 1.1 * d.size, sd(d), 0.1, 14));
      s.fill();
      for (const [i, c] of candleSet(d).entries()) {
        const pts = boxPts(c.x - c.w / 2, c.y, c.w, d.y + 0.5 - c.y, 0.4, sd(d) + i, 0.1);
        part(s, pts, WAX, sd(d) + i, { depth: 0.5, shade: -14, thin: 0.25, thick: 0.6 });
        s.fillStyle = css(WAX, 10);
        line(s, c.x + c.w * 0.25, c.y + 0.4, c.x + c.w * 0.3, c.y + 2.6, { w: 0.7, seed: i, taper: [0.1, 0.6], press: 0 });
        tick(s, c.x, c.y, c.x, c.y - 0.9, 0.35, i, inkFor(WAX));
      }
    },
    live(rc, d) {
      for (const [i, c] of candleSet(d).entries()) {
        const fl = 0.85 + Math.sin(rc.t * 11 + i * 2.3 + d.seed) * 0.15;
        flame(rc.g, c.x, c.y - 0.8, 1.1 * fl, 2.8 * fl, d.color, rc.t + i);
      }
      light(rc, d.x, d.y - 4, 40, d.color, 0.45);
    },
  },
  stocks: {
    color: () => WOOD,
    bake(s, d) {
      // The stocks: two posts and a board with a hole for a head and two for hands, nobody in them.
      for (const x of [-6, 6]) rod(s, at(d, x, 0, x, -14), 1.4, WOOD, sd(d) + x);
      const board = at(d, -7.4, -14.6, 7.4, -14.6, 7.4, -9.4, -7.4, -9.4);
      shape(s, board, shift(WOOD, 0, 0, 8), sd(d), 0.6);
      tick(s, X(d, -7.2), Y(d, -12), X(d, 7.2), Y(d, -12), 0.45, 3, inkFor(WOOD));
      for (const [x, r] of [
        [-4.4, 1.1],
        [0, 1.7],
        [4.4, 1.1],
      ]) {
        s.fillStyle = css(hsl3(24, 30, 12));
        path(s, ovalPts(X(d, x), Y(d, -12), r * d.size, r * d.size, (x * 9) | 0, 0.05, 12));
        s.fill();
      }
      // A rusty padlock on its hasp.
      shape(s, boxPts(X(d, 6.8) - 1.1, Y(d, -11.4), 2.2 * d.size, 2.2 * d.size, 0.4, sd(d) + 5), hsl3(20, 40, 34), sd(d) + 5, 0.3);
    },
  },
  rubble: {
    color: (th) => th.terrain.base,
    bake(s, d) {
      // Fallen masonry: dressed blocks tumbled off a wall, one cracked, one on its corner.
      const c = d.color;
      shape(s, at(d, -6.6, 0, -1.2, 0, -1.4, -3.4, -6.4, -3.6), shift(c, 0, 0, -4), sd(d), 0.6);
      shape(s, at(d, -0.6, 0, 5.4, 0, 5.6, -3, -0.4, -3.2), c, sd(d) + 1, 0.6);
      shape(s, at(d, -3.6, -3.4, 0.4, -6.8, 3.8, -3.2), shift(c, 0, 0, 6), sd(d) + 2, 0.5);
      tick(s, X(d, 1.6), Y(d, -0.4), X(d, 2.6), Y(d, -2.4), 0.35, 3, inkFor(c));
      for (let i = 0; i < 3; i++) {
        s.fillStyle = css(c, -6);
        blob(s, X(d, 6.8 + i * 1.4), Y(d, -0.5), 0.6 * d.size, sd(d) + i, 1, 0.2);
        s.fill();
      }
    },
  },
  cobweb: {
    color: () => hsl3(40, 8, 82),
    live(rc, d) {
      // A web in the angle of a ceiling: spokes out from the corner and threads sagging between them, on
      // the background where something this fine stays fine.
      const g = rc.bg;
      const k = d.size;
      const dir = fx(d);
      const R = 10 * k;
      const spokes = 4;
      g.fillStyle = css(d.color, 0, 0.55);
      const ends: P[] = [];
      for (let i = 0; i <= spokes; i++) {
        const a = (i / spokes) * (Math.PI / 2);
        const e = { x: d.x + dir * Math.cos(a) * R, y: d.y + Math.sin(a) * R * 0.9 };
        ends.push(e);
        line(g, d.x, d.y, e.x, e.y, { w: 0.35, seed: i, taper: [0, 0.4], press: 0 });
      }
      for (let r = 0.35; r < 1; r += 0.3)
        for (let i = 0; i < spokes; i++) {
          const a = ends[i];
          const b = ends[i + 1];
          const p0 = { x: d.x + (a.x - d.x) * r, y: d.y + (a.y - d.y) * r };
          const p1 = { x: d.x + (b.x - d.x) * r, y: d.y + (b.y - d.y) * r };
          const mid = { x: (p0.x + p1.x) / 2 - dir * 0.8 * r, y: (p0.y + p1.y) / 2 + 0.9 * r };
          stroke(g, [p0, mid, p1], { w: 0.3, seed: i * 7 + r * 10, taper: [0, 0], press: 0 });
        }
    },
  },
  gibbet: {
    color: () => IRON,
    live(rc, d) {
      // An iron gibbet cage on a chain, empty but for a bone, swinging only in a gust.
      const s = rc.s;
      const k = d.size;
      const len = (6 + (d.seed % 5)) * k;
      const sw = flutter(rc, 0.8, d.seed) * 0.08;
      const cx = d.x + Math.sin(sw) * len;
      const cy = d.y + Math.cos(sw) * len;
      for (let y = 1; y < len; y += 2.4) {
        s.fillStyle = inkFor(IRON);
        blob(s, d.x + Math.sin(sw) * y, d.y + Math.cos(sw) * y, 0.9, (y * 3) | 0, 1.5, 0.05);
        s.fill();
      }
      const w = 5.2 * k;
      const h = 13 * k;
      // The bone first, behind the bars.
      rod(
        s,
        [
          { x: cx - w * 0.5, y: cy + h - 1.6 },
          { x: cx + w * 0.4, y: cy + h - 2.6 },
        ],
        0.8,
        hsl3(40, 22, 78),
        sd(d),
      );
      // Bars round a dome top and a pointed foot, banded twice.
      s.fillStyle = inkFor(IRON);
      for (const t of [-1, -0.33, 0.33, 1]) {
        const bx = cx + (t * w) / 2;
        stroke(
          s,
          [
            { x: cx + t * 1.2, y: cy + 0.4 },
            { x: bx, y: cy + 2.8 },
            { x: bx, y: cy + h - 2.4 },
            { x: cx + t * 0.6, y: cy + h },
          ],
          { w: 0.75, seed: (t * 10) | 0, taper: [0.05, 0.05], press: 0 },
        );
      }
      for (const by of [cy + 3, cy + h - 3]) line(s, cx - w / 2, by, cx + w / 2, by, { w: 0.8, seed: by | 0, taper: [0, 0], press: 0 });
      s.fillStyle = css(d.color, 18);
      line(s, cx - w / 2 + 0.3, cy + 3.3, cx - w / 2 + 0.3, cy + h - 3.6, { w: 0.35, seed: 3, taper: [0.1, 0.1], press: 0 });
    },
  },
} satisfies Record<string, DecorDef>;

/** The candles of a cluster: where each stands and how far it's burnt down. */
function candleSet(d: Decor): { x: number; y: number; w: number }[] {
  const n = 3 + (d.seed % 3);
  return Array.from({ length: n }, (_, i) => {
    const x = d.x + (i - (n - 1) / 2) * 2.6 * d.size * fx(d) + (k01(d, i + 9) - 0.5) * 0.8;
    const tall = (3 + k01(d, i) * 7) * d.size;
    return { x, y: d.y + 0.5 - tall, w: 1.8 * d.size };
  });
}
