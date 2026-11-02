import { css, type HSL, hsl3, shift } from '../core/color';
import type { DecorDef } from './decor';
import { blob, inkFor, line, type P, stroke } from './ink';
import { ball, bar, barLine, boxPts, dot, glint, part, path, poly, tick } from './ink-props';
import { circle, flutter, glowDot, light } from './kit';

/**
 * The mine's decor, inked like the rock it stands on: a heap of ore, a crate of dynamite, a canary in its
 * cage, a bucket on a rope, a buffer stop, a lamp on a post, stalagmites and stalactites, a stub of rail.
 * Small and cosmetic like all decor: nothing here reads as somewhere to stand or something to dodge.
 * Only a lamp glows (it's a light); ore glints are flat bright flecks, never a halo. What hangs sways only
 * when a gust really blows (`flutter`, 0 in still air).
 */

const k01 = (seed: number, n: number) => ((seed >>> n) % 1000) / 1000;
const sd = (seed: number) => seed & 0xffff;

const WOOD: HSL = hsl3(28, 36, 30);
const IRON: HSL = hsl3(220, 8, 24);
const ROPE: HSL = hsl3(38, 34, 50);
const RED: HSL = hsl3(4, 64, 42);
const CANARY: HSL = hsl3(50, 92, 58);

/** Points of a shape in decor space: (x, y) offsets from the foot, scaled by `k` and mirrored by `f`. */
const at = (x0: number, y0: number, k: number, f: number, ...xy: number[]) => {
  const out: P[] = [];
  for (let i = 0; i + 1 < xy.length; i += 2) out.push({ x: x0 + xy[i] * k * f, y: y0 + xy[i + 1] * k });
  return out;
};

/** A rope, fuse or rail: a bar of its colour in a thin rim of its own dark. */
function cord(s: CanvasRenderingContext2D, pts: readonly P[], w: number, c: HSL, seed: number) {
  // A bare pair of points gives the pen no length to swell over: draw it as a straight bar, sampled.
  if (pts.length === 2) barLine(s, pts[0].x, pts[0].y, pts[1].x, pts[1].y, w, c, seed);
  else bar(s, pts, w, c, seed);
}

/** A pointed rock spike from (x, y) along `dir` (-1 up, 1 down), `h` long and `w` wide at its root. */
function spike(s: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dir: number, c: HSL, seed: number) {
  const lean = (k01(seed, 3) - 0.5) * w * 0.6;
  part(s, poly(x - w / 2, y, x + lean, y + dir * h, x + w / 2, y), c, seed, { depth: 0.5, thin: 0.35, thick: 0.9 });
  tick(s, x - w * 0.15, y + dir * h * 0.3, x + lean * 0.6, y + dir * h * 0.75, 0.4, seed + 1, css(c, 14));
}

export const MINE_DECOR = {
  orepile: {
    color: (th) => th.terrain.vein,
    bake(s, d, th) {
      // A heap of broken ore: lumps of the level's rock with veins of its ore showing.
      const k = d.size;
      const rock = shift(th.terrain.base, -4);
      const lumps: [number, number, number][] = [
        [-4.5, -1.6, 2],
        [3.8, -1.5, 2.1],
        [-0.6, -2.2, 2.6],
        [-2.2, -5, 2],
        [1.8, -4.8, 1.9],
        [0, -7.2, 1.7],
      ];
      for (const [i, [x, y, r]] of lumps.entries()) ball(s, d.x + x * k, d.y + y * k, r * k, shift(rock, (i % 3) * 4), sd(d.seed) + i, css(rock, 26));
      for (let i = 0; i < 4; i++) {
        s.fillStyle = css(d.color, 8);
        const [x, y] = lumps[(i * 2 + (d.seed & 3)) % lumps.length];
        s.fillRect(d.x + (x + 0.4) * k, d.y + (y - 0.6) * k, 1.2 * k, 0.9 * k);
      }
    },
  },
  dynamite: {
    color: () => RED,
    bake(s, d) {
      // A wooden crate, lid off, sticks of dynamite standing in it, a coil of fuse over the edge.
      const k = d.size;
      const f = d.flip ? -1 : 1;
      for (let i = 0; i < 4; i++) {
        const x = d.x + (-3.2 + i * 2.1) * k;
        const h = (8.5 + k01(d.seed, i * 4) * 1.6) * k;
        part(s, boxPts(x - 0.8 * k, d.y - h, 1.7 * k, h - 3, 0.6, sd(d.seed) + i, 0.05), shift(d.color, (i % 2) * 5), i, { depth: 0.3, thin: 0.3, thick: 0.6 });
      }
      const crate = boxPts(d.x - 5 * k, d.y - 5.4 * k, 10 * k, 5.6 * k, 0.6, sd(d.seed) + 9, 0.12);
      part(s, crate, WOOD, sd(d.seed) + 9, { depth: 0.6, thin: 0.4, thick: 1 });
      tick(s, d.x - 4.4 * k, d.y - 2.8 * k, d.x + 4.4 * k, d.y - 2.8 * k, 0.5, 3, css(WOOD, -14));
      // The stencilled warning on its side: a red diamond, no words.
      s.fillStyle = css(RED, 6);
      path(s, poly(d.x, d.y - 4.6 * k, d.x + 1.8 * k, d.y - 2.8 * k, d.x, d.y - 1 * k, d.x - 1.8 * k, d.y - 2.8 * k));
      s.fill();
      const fuse: P[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        fuse.push({ x: d.x + f * (2 + t * 5) * k, y: d.y - (9 - Math.sin(t * Math.PI) * 4 - t * 8.6) * k });
      }
      cord(s, fuse, 0.5, hsl3(30, 20, 66), 7);
    },
  },
  canary: {
    color: () => CANARY,
    live(rc, d) {
      // A canary in a birdcage on a hook: the cage swings only when a gust blows, the bird hops on its perch.
      const s = rc.s;
      const k = d.size;
      const sw = flutter(rc, 1.1, d.seed) * 0.12;
      const len = (5 + (d.seed % 4)) * k;
      const cx = d.x + Math.sin(sw) * len;
      const cy = d.y + Math.cos(sw) * len;
      s.fillStyle = inkFor(IRON);
      line(s, d.x, d.y, cx, cy, { w: 0.5, seed: 2, taper: [0.02, 0.04], press: 0 });
      const w = 5.4 * k;
      const h = 6.4 * k;
      const dome: P[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        dome.push({ x: cx + Math.cos(a) * w * 0.5, y: cy + 2.2 * k + Math.sin(a) * 2.2 * k });
      }
      // The bird first, behind the bars: a round yellow body, a tail, a little beak. An animal, drawn as one.
      const hop = Math.max(0, Math.sin(rc.t * 2.3 + d.seed)) > 0.93 ? 0.8 : 0;
      const by = cy + h * 0.62 - hop;
      const dir = d.flip ? -1 : 1;
      s.fillStyle = inkFor(d.color);
      blob(s, cx, by, 1.6 * k, 3, 1.1, 0.06);
      s.fill();
      s.fillStyle = css(d.color);
      blob(s, cx, by, 1.35 * k, 3, 1.1, 0.06);
      s.fill();
      s.fillStyle = css(d.color, -14);
      path(s, poly(cx - dir * 1.2 * k, by + 0.2 * k, cx - dir * 2.7 * k, by + 1.4 * k, cx - dir * 1.3 * k, by + 1 * k));
      s.fill();
      s.fillStyle = css(hsl3(28, 90, 52));
      path(s, poly(cx + dir * 1.3 * k, by - 0.6 * k, cx + dir * 2.3 * k, by - 0.3 * k, cx + dir * 1.3 * k, by + 0.1 * k));
      s.fill();
      // The cage: a domed wire frame, its bars, its floor and its perch.
      s.fillStyle = css(IRON, 30);
      for (let i = 0; i <= 4; i++) {
        const x = cx - w / 2 + (i * w) / 4;
        line(s, x, cy + 2.2 * k - (i === 0 || i === 4 ? 0 : 1.6 * k), x, cy + h, { w: 0.45, seed: i, taper: [0, 0], press: 0 });
      }
      bar(s, dome, 0.5, shift(IRON, 22), 5, { taper: [0, 0], rim: 0.2 });
      barLine(s, cx - w / 2 - 0.4, cy + h, cx + w / 2 + 0.4, cy + h, 0.9, IRON, 6);
      s.fillStyle = css(WOOD, 8);
      line(s, cx - w / 2, cy + h * 0.78, cx + w / 2, cy + h * 0.78, { w: 0.5, seed: 7, taper: [0.02, 0.04], press: 0 });
      s.fillStyle = inkFor(IRON);
      circle(s, cx, cy - 0.6, 0.8);
    },
  },
  bucket: {
    color: () => hsl3(212, 10, 40),
    live(rc, d) {
      // A bucket on a rope off the roof, swinging only in a gust.
      const s = rc.s;
      const k = d.size;
      const len = (8 + (d.seed % 9)) * k;
      const sw = flutter(rc, 0.9, d.seed) * 0.1;
      const bx = d.x + Math.sin(sw) * len;
      const by = d.y + Math.cos(sw) * len;
      cord(
        s,
        [
          { x: d.x, y: d.y },
          { x: (d.x + bx) / 2 + sw * 2, y: (d.y + by) / 2 },
          { x: bx, y: by },
        ],
        0.6,
        ROPE,
        3,
      );
      s.fillStyle = inkFor(d.color);
      stroke(
        s,
        [
          { x: bx - 2.6 * k, y: by + 2 * k },
          { x: bx, y: by - 0.2 },
          { x: bx + 2.6 * k, y: by + 2 * k },
        ],
        { w: 0.5, seed: 4, taper: [0.02, 0.04], press: 0 },
      );
      const pail = poly(bx - 3 * k, by + 2 * k, bx + 3 * k, by + 2 * k, bx + 2.3 * k, by + 7 * k, bx - 2.3 * k, by + 7 * k);
      part(s, pail, d.color, sd(d.seed), { depth: 0.5, thin: 0.35, thick: 0.8 });
      tick(s, bx - 2.7 * k, by + 3.4 * k, bx + 2.7 * k, by + 3.4 * k, 0.5, 9, css(d.color, -16));
      glint(s, poly(bx - 1.6 * k, by + 3.8 * k, bx - 1.3 * k, by + 6.4 * k), css(d.color, 26), 0.5);
    },
  },
  buffer: {
    color: () => RED,
    bake(s, d) {
      // The end of the line: a timber buffer stop on a stub of rail, its beam painted.
      const k = d.size;
      const f = d.flip ? -1 : 1;
      cord(s, poly(d.x - 7 * k * f, d.y - 0.8, d.x + 2 * k * f, d.y - 0.8), 0.8, shift(IRON, 14), 2);
      for (const dx of [-5, -1.5])
        part(s, boxPts(d.x + dx * k * f - 0.8, d.y - 0.6, 1.6 * k, 1.2, 0.3, dx + 30, 0.1), WOOD, dx + 30, { depth: 0.2, thin: 0.3, thick: 0.5 });
      part(s, at(d.x, d.y, k, f, 0.5, 0, 3.5, 0, 3.5, -7, 2, -7), WOOD, sd(d.seed), { depth: 0.4, thin: 0.35, thick: 0.8 });
      part(s, at(d.x, d.y, k, f, -1.6, -2, 0.6, -2, 3.6, -6.4, 3.6, -5), shift(WOOD, -6), sd(d.seed) + 1, { depth: 0.3, thin: 0.3, thick: 0.7 });
      part(s, boxPts(d.x + (f > 0 ? -0.5 : -4.8) * k, d.y - 7.6 * k, 5.3 * k, 2.2 * k, 0.4, sd(d.seed) + 2, 0.1), d.color, 4, {
        depth: 0.3,
        thin: 0.3,
        thick: 0.7,
      });
      s.fillStyle = css(hsl3(42, 12, 86));
      s.fillRect(d.x + (f > 0 ? 1.4 : -2.9) * k, d.y - 7.3 * k, 1.5 * k, 1.6 * k);
    },
  },
  postlamp: {
    color: (th) => th.lamp,
    bake(s, d) {
      // A timber post with a crossarm, the lamp hung off its end.
      const k = d.size;
      const f = d.flip ? -1 : 1;
      const h = 22 * k;
      part(s, boxPts(d.x - 1.1 * k, d.y - h, 2.2 * k, h, 0.4, sd(d.seed), 0.06), WOOD, sd(d.seed), { depth: 0.4, thin: 0.35, thick: 0.8 });
      part(s, boxPts(d.x - 1.4 * k + (f > 0 ? 0 : -4.6 * k), d.y - h + 1.5 * k, 7.4 * k, 1.6 * k, 0.3, sd(d.seed) + 1, 0.06), WOOD, sd(d.seed) + 1, {
        depth: 0.3,
        thin: 0.3,
        thick: 0.7,
      });
      cord(s, poly(d.x + f * 1.4 * k, d.y - h + 6 * k, d.x + f * 4.8 * k, d.y - h + 2.4 * k), 0.6, shift(WOOD, -4), 3);
      dot(s, d.x, d.y - h + 2.3 * k, 0.4, 4, css(IRON, 30), inkFor(WOOD));
    },
    live(rc, d) {
      const k = d.size;
      const f = d.flip ? -1 : 1;
      const h = 22 * k;
      const lx = d.x + f * 4.6 * k;
      const ly = d.y - h + 3.2 * k;
      const s = rc.s;
      s.fillStyle = inkFor(IRON);
      line(s, lx, d.y - h + 1.6 * k, lx, ly, { w: 0.45, seed: 2, taper: [0.02, 0.04], press: 0 });
      part(s, boxPts(lx - 1.7 * k, ly + 0.8 * k, 3.4 * k, 3.6 * k, 0.4, 6, 0.05), d.color, 6, { depth: 0, thin: 0.3, thick: 0.6, ink: inkFor(IRON) });
      part(s, poly(lx - 2 * k, ly + 1 * k, lx, ly - 0.4 * k, lx + 2 * k, ly + 1 * k), IRON, 5, { depth: 0.2, thin: 0.3, thick: 0.6 });
      part(s, boxPts(lx - 1.9 * k, ly + 4.1 * k, 3.8 * k, 1 * k, 0.2, 7, 0.05), IRON, 7, { depth: 0.2, thin: 0.25, thick: 0.5 });
      s.fillStyle = css(IRON, 6);
      s.fillRect(lx - 0.25 * k, ly + 1 * k, 0.5 * k, 3.2 * k);
      const fl = 0.88 + Math.sin(rc.t * 8 + d.seed) * 0.08;
      rc.g.fillStyle = css(d.color, 12, 0.85 * fl);
      rc.g.fillRect(lx - 1.4 * k, ly + 1.1 * k, 2.8 * k, 3 * k);
      glowDot(rc.g, lx, ly + 2.6 * k, 7 * k, d.color, 0.35 * fl);
      light(rc, lx, ly + 2.6 * k, 86 * k, d.color, 0.85 * fl);
    },
  },
  stalagmite: {
    color: (th) => shift(th.terrain.base, 6),
    bake(s, d) {
      // A cluster of rock teeth grown up from the floor: one tall, a couple short.
      const k = d.size;
      const n = 2 + (d.seed % 2);
      for (let i = 0; i < n; i++) {
        const x = d.x + (i - (n - 1) / 2) * 3 * k * (d.flip ? -1 : 1);
        const h = (i === 0 ? 9 : 4 + k01(d.seed, i * 5) * 3) * k;
        spike(s, x, d.y + 0.5, (i === 0 ? 3.6 : 2.6) * k, h, -1, shift(d.color, -i * 4), sd(d.seed) + i);
      }
    },
  },
  stalactite: {
    color: (th) => shift(th.terrain.base, 2),
    bake(s, d) {
      // Rock teeth hanging off the roof, a drip on the longest one's tip.
      const k = d.size;
      const n = 1 + (d.seed % 3);
      let tip = { x: d.x, y: d.y };
      for (let i = 0; i < n; i++) {
        const x = d.x + (i - (n - 1) / 2) * 2.6 * k;
        const h = (i === 0 ? 8 + (d.seed % 4) : 3 + k01(d.seed, i * 3) * 3) * k;
        spike(s, x, d.y - 0.5, (i === 0 ? 3.2 : 2.2) * k, h, 1, shift(d.color, -i * 4), sd(d.seed) + i);
        if (i === 0) tip = { x, y: d.y + h };
      }
      ball(s, tip.x, tip.y + 1.2, 0.7, hsl3(200, 30, 70), 3, 'rgba(255,255,255,0.9)');
    },
  },
  rails: {
    color: () => IRON,
    bake(s, d) {
      // A stub of track nobody finished laying: sleepers, two rails, a spike or two left loose.
      const w = d.span * 16 - 2;
      for (let x = 1; x < w; x += 5) part(s, boxPts(d.x + x, d.y - 1.4, 3.2, 1.6, 0.3, x + 3, 0.1), WOOD, x + 3, { depth: 0.2, thin: 0.3, thick: 0.5 });
      cord(s, poly(d.x - 0.5, d.y - 1.8, d.x + w + 0.5, d.y - 1.8), 0.7, shift(d.color, 16), 4);
      s.fillStyle = css(d.color, 40);
      line(s, d.x, d.y - 2.1, d.x + w, d.y - 2.1, { w: 0.35, seed: 5, taper: [0, 0], press: 0 });
      if (d.seed % 2) {
        const x = d.x + w * k01(d.seed, 7);
        tick(s, x, d.y - 0.4, x + 2.6, d.y - 1.2, 0.6, 9, css(d.color, 20));
      }
    },
  },
} satisfies Record<'orepile' | 'dynamite' | 'canary' | 'bucket' | 'buffer' | 'postlamp' | 'stalagmite' | 'stalactite' | 'rails', DecorDef>;
