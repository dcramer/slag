import { css, type HSL, hsl3, shift } from '../core/color';
import { hash2 } from '../core/rng';
import type { Decor, DecorDef } from './decor';
import { blob, inkFor, line, type P } from './ink';
import { ball, bar, boxPts, glint, ovalPts, part, path, poly, tick, tone } from './ink-props';
import { hashKnobs, low16 } from './decor-kit';

/**
 * The glacier's decor, inked like the ice it stands on: a snow drift, a snowman (sticks and stones, no
 * face), a pair of skis and poles stood in the snow, a sled, a fish frozen in a block of ice, an
 * ice-fishing hole with its tip-up flag, a pine under snow, a dropped supply crate, a signpost pointing
 * every way at once, and a cluster of ice crystals. Small and cosmetic like all decor: nothing here reads
 * as somewhere to stand or something to dodge. All of it holds still and bakes with the terrain.
 */

const SNOW: HSL = hsl3(205, 22, 94);
const ICE: HSL = hsl3(196, 52, 80);
const WOOD: HSL = hsl3(28, 38, 36);
/** Light enough to hold its shape against a night sky: the boughs are the tree, the snow only loads them. */
const PINE: HSL = hsl3(150, 26, 34);
const RED: HSL = hsl3(4, 64, 48);
const STEEL: HSL = hsl3(212, 8, 62);
const OLIVE: HSL = hsl3(70, 22, 36);

const knob = hashKnobs(11);
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

/** A stick, pole or post: a bar of its colour in a thin rim of its own dark, lit along its top when it's broad. */
function stick(s: CanvasRenderingContext2D, pts: readonly P[], w: number, c: HSL, seed: number) {
  bar(s, pts, w, c, seed, { taper: [0.02, 0.08], lit: w >= 1.2 ? 14 : 0 });
}

/** Snow heaped along a top edge from x0 to x1 at y: soft lumps, lit on top. */
function snowCap(s: CanvasRenderingContext2D, x0: number, x1: number, y: number, seed: number, r = 1.4) {
  s.fillStyle = css(SNOW, -10);
  for (let x = x0; x <= x1; x += r * 1.4) {
    blob(s, x, y + 0.3, r + hash2(x | 0, 1, seed) * 0.5, (x | 0) + seed, 0.8, 0.25);
    s.fill();
  }
  s.fillStyle = css(SNOW);
  for (let x = x0; x <= x1; x += r * 1.4) {
    blob(s, x - 0.2, y - 0.2, r * 0.8, (x | 0) + seed + 3, 0.8, 0.25);
    s.fill();
  }
}

export const GLACIER_DECOR = {
  snowdrift: {
    color: () => SNOW,
    bake(s, d) {
      // A drift banked along the ground, its crest wind-curled one way.
      const w = d.span * 16 - 2;
      const x0 = d.x;
      const h = (3.4 + knob(d, 1) * 2) * d.size;
      const crest = d.flip ? 0.3 : 0.7;
      const pts: P[] = [{ x: x0, y: d.y + 0.5 }];
      for (let i = 1; i < 10; i++) {
        const t = i / 10;
        const bump = Math.sin(t * Math.PI) * (t < crest ? t / crest : (1 - t) / (1 - crest));
        pts.push({ x: x0 + t * w, y: d.y + 0.5 - h * Math.sqrt(Math.max(0, bump)) });
      }
      pts.push({ x: x0 + w, y: d.y + 0.5 });
      part(s, pts, SNOW, low16(d.seed), { depth: 0.8, thin: 0.3, thick: 0.8 });
      glint(s, pts.slice(2, 6), 'rgba(255,255,255,0.95)', 0.6, low16(d.seed));
    },
  },
  snowman: {
    color: () => SNOW,
    bake(s, d) {
      // Three balls of snow, a stick for each arm and a pail for a hat: no face.
      const k = d.size;
      ball(s, d.x, Y(d, -4.6), 5 * k, SNOW, low16(d.seed), undefined, inkFor(SNOW));
      ball(s, d.x + 0.4 * fx(d), Y(d, -12), 3.8 * k, SNOW, low16(d.seed) + 1, undefined, inkFor(SNOW));
      ball(s, d.x - 0.2 * fx(d), Y(d, -17.6), 2.9 * k, SNOW, low16(d.seed) + 2, undefined, inkFor(SNOW));
      for (const side of [-1, 1])
        stick(
          s,
          [
            { x: d.x + side * 3.2 * k, y: Y(d, -12.5) },
            { x: d.x + side * 7.5 * k, y: Y(d, -16 + side) },
          ],
          0.5,
          WOOD,
          side + 5,
        );
      part(s, at(d, -2.4, -19.6, -1.9, -23, 1.9, -23, 2.4, -19.6), shift(RED, 0, -10, -4), low16(d.seed) + 3, { depth: 0.5, thin: 0.3, thick: 0.7 });
      // Pebble buttons down its front.
      s.fillStyle = css(hsl3(215, 10, 26));
      for (let i = 0; i < 2; i++) {
        blob(s, X(d, 0.4), Y(d, -10.8 - i * 2.4), 0.55, i, 1, 0.1);
        s.fill();
      }
    },
  },
  skis: {
    color: (_th, rng) => hsl3(rng.pick([4, 46, 205, 300]), 46, 50),
    bake(s, d) {
      // A pair of skis stood tips-up in the snow, two poles crossed beside them.
      for (const [i, x] of [-2.2, 0.4].entries()) {
        const ski = at(d, x - 0.9, 0, x - 0.9, -17, x + 0.2, -19.5, x + 1.1, -17, x + 1.1, 0);
        part(s, ski, i ? d.color : shift(d.color, 0, 0, -8), low16(d.seed) + i, { depth: 0.4, thin: 0.3, thick: 0.7 });
      }
      for (const [i, lean] of [3, 6].entries()) {
        stick(
          s,
          [
            { x: X(d, 3.4), y: Y(d, 0) },
            { x: X(d, lean), y: Y(d, -14) },
          ],
          0.45,
          STEEL,
          i + 9,
        );
        s.fillStyle = inkFor(STEEL);
        path(s, poly(X(d, 3.4) - 1.6, Y(d, -2), X(d, 3.4) + 1.6, Y(d, -2), X(d, 3.4), Y(d, -1.2)));
        s.fill();
      }
      snowCap(s, X(d, -3.6), X(d, 4.4), Y(d, -0.4), low16(d.seed), 1.1);
    },
  },
  sled: {
    color: (_th, rng) => hsl3(rng.pick([4, 20]), 50, 42),
    bake(s, d) {
      // A wooden sled: slats on two runners curling up at the front, a coil of rope on it.
      const k = d.size;
      const runner = at(d, -8, -0.4, 6, -0.4, 8.4, -1.6, 9.2, -4.2);
      bar(s, runner, 0.8, shift(STEEL, 10), low16(d.seed), { taper: [0, 0.1] });
      for (const x of [-6, 3]) tick(s, X(d, x), Y(d, -0.6), X(d, x), Y(d, -2.6), 0.7, x, css(WOOD, -12));
      part(s, at(d, -8.6, -2.6, 6.4, -2.6, 6.4, -4.4, -8.6, -4.4), d.color, low16(d.seed) + 2, { depth: 0.5, thin: 0.3, thick: 0.8 });
      for (let i = 1; i < 4; i++) tick(s, X(d, -8.6 + i * 3.8), Y(d, -2.8), X(d, -8.6 + i * 3.8), Y(d, -4.2), 0.35, i, css(d.color, -20));
      const coil = ovalPts(X(d, -2), Y(d, -5.4), 2.4 * k, 1 * k, low16(d.seed) + 4, 0.05, 12);
      bar(s, [...coil, coil[0]], 0.6, hsl3(38, 36, 58), 4, { taper: [0, 0], rim: 0.2 });
    },
  },
  frozenfish: {
    color: (_th, rng) => hsl3(rng.pick([24, 200, 340]), 30, 56),
    bake(s, d) {
      // A fish caught in a block of ice, its tail just out of it.
      const k = d.size;
      const blk = boxPts(d.x - 5 * k, Y(d, -7.6), 10 * k, 7.6 * k, 1.2, low16(d.seed), 0.2);
      const fish = at(d, -3.6, -3.8, -1.4, -5.6, 2, -5.2, 3.4, -3.8, 2, -2.4, -1.4, -2);
      tone(s, fish, d.color, { depth: 0.4 });
      s.fillStyle = css(d.color, -8);
      path(s, at(d, 3.2, -3.8, 6.4, -6, 6.4, -1.6));
      s.fill();
      s.fillStyle = 'rgba(214,236,248,0.6)';
      path(s, blk);
      s.fill();
      part(s, blk, ICE, low16(d.seed) + 1, { depth: 0.2, thin: 0.3, thick: 0.7 });
      glint(s, at(d, -4, -6.6, -1, -6.9), 'rgba(255,255,255,0.95)', 0.6, low16(d.seed));
    },
  },
  fishhole: {
    color: () => RED,
    bake(s, d) {
      // A hole augered in the ice, dark water in it, a tip-up's little flag on a spring over it.
      const k = d.size;
      tone(s, ovalPts(d.x, d.y + 0.2, 4.6 * k, 1.5 * k, low16(d.seed), 0.04, 14), SNOW, { depth: 0.3 });
      // Dark water in the hole: a deep of the ice it's cut through.
      s.fillStyle = css(ICE, -60);
      path(s, ovalPts(d.x, d.y + 0.3, 3 * k, 0.9 * k, low16(d.seed) + 1, 0.04, 12));
      s.fill();
      stick(s, at(d, -4, 0, -4, -6), 0.4, WOOD, 3);
      const spring = at(d, -4, -6, -2.6, -9.4, -2, -12.4);
      bar(s, spring, 0.4, STEEL, 4, { rim: 0.2, taper: [0, 0] });
      part(s, at(d, -2, -12.4, 2.4, -11.6, -2, -10), d.color, low16(d.seed) + 2, { depth: 0.3, thin: 0.25, thick: 0.6 });
      s.fillStyle = inkFor(STEEL);
      line(s, X(d, -3.6), Y(d, -5.6), X(d, 0), Y(d, 0), { w: 0.3, seed: 5, taper: [0.04, 0.08], press: 0 });
    },
  },
  snowpine: {
    color: (th) => shift(PINE, th.night ? 4 : 0),
    bake(s, d) {
      // A small pine: three tiers of boughs, each loaded with snow along its top.
      const k = d.size;
      const h = (26 + knob(d, 2) * 8) * k;
      stick(
        s,
        [
          { x: d.x, y: d.y + 0.5 },
          { x: d.x, y: d.y - 4 * k },
        ],
        1.6,
        shift(WOOD, 8),
        low16(d.seed),
      );
      for (let i = 0; i < 3; i++) {
        const y0 = d.y - 3 * k - (i * h) / 3.6;
        const half = (8 - i * 2.2) * k;
        const top = y0 - (h / 3) * 0.95;
        const th = y0 - top;
        // A tier of boughs: a broad cone, its hem drooping in two scallops.
        const tier = poly(
          d.x - half,
          y0,
          d.x - half * 0.55,
          y0 - th * 0.42,
          d.x,
          top,
          d.x + half * 0.55,
          y0 - th * 0.42,
          d.x + half,
          y0,
          d.x + half * 0.45,
          y0 - 0.9,
          d.x,
          y0 + 0.4,
          d.x - half * 0.45,
          y0 - 0.9,
        );
        part(s, tier, shift(d.color, i * 3), low16(d.seed) + i, { depth: 0.9, thin: 0.35, thick: 0.9 });
        tick(s, d.x - half * 0.15, y0 - th * 0.15, d.x - half * 0.7, y0 - 0.4, 0.35, low16(d.seed) + i * 3, css(d.color, -14));
        // The snow it's loaded with: a crust along its upper slopes, the green showing under it.
        s.fillStyle = css(SNOW);
        path(
          s,
          poly(
            d.x - half * 0.85,
            y0 - th * 0.12,
            d.x - half * 0.5,
            y0 - th * 0.46,
            d.x,
            top + 0.2,
            d.x + half * 0.5,
            y0 - th * 0.46,
            d.x + half * 0.8,
            y0 - th * 0.14,
            d.x + half * 0.35,
            y0 - th * 0.36,
            d.x,
            y0 - th * 0.62,
            d.x - half * 0.4,
            y0 - th * 0.34,
          ),
        );
        s.fill();
      }
    },
  },
  supplycrate: {
    color: () => OLIVE,
    bake(s, d) {
      // An airdropped crate half sunk in snow, stencilled, its chute collapsed beside it.
      const k = d.size;
      const box = boxPts(d.x - 5 * k, Y(d, -8.6), 10 * k, 8.6 * k, 0.8, low16(d.seed), 0.15);
      part(s, box, d.color, low16(d.seed), { depth: 0.9, thin: 0.4, thick: 1 });
      tick(s, X(d, -5), Y(d, -4.3), X(d, 5), Y(d, -4.3), 0.5, 2, css(d.color, -16));
      s.fillStyle = css(SNOW, -6, 0.9);
      s.fillRect(Math.min(X(d, -2.6), X(d, 2.6)), Y(d, -7.2), 5.2 * k, 1.6 * k);
      s.fillStyle = css(RED, 0);
      s.fillRect(Math.min(X(d, -0.6), X(d, 0.6)), Y(d, -8), 1.2 * k, 3.2 * k);
      s.fillRect(Math.min(X(d, -1.6), X(d, 1.6)), Y(d, -7), 3.2 * k, 1.2 * k);
      tone(s, at(d, 5.4, 0, 6, -2.2, 9, -3, 11.6, -1.4, 12, 0), hsl3(30, 30, 82), { depth: 0.4 });
      snowCap(s, X(d, -5.4), X(d, 5.4), Y(d, -0.2), low16(d.seed), 1.2);
      snowCap(s, X(d, -4.6), X(d, 4.6), Y(d, -8.8), low16(d.seed) + 9, 0.9);
    },
  },
  signpost: {
    color: () => WOOD,
    bake(s, d) {
      // A post with boards pointing every which way, the snow piled at its foot and along each board.
      stick(s, at(d, 0, 0, 0, -22), 2, shift(d.color, 14), low16(d.seed));
      for (let i = 0; i < 3; i++) {
        const y = -20 + i * 5;
        const dir = (i + (d.flip ? 1 : 0)) % 2 ? -1 : 1;
        const tilt = (knob(d, i) - 0.5) * 1.6;
        const L = 8 + knob(d, i + 4) * 3;
        const board = [
          { x: d.x, y: Y(d, y) },
          { x: d.x + dir * L * d.size, y: Y(d, y + tilt) },
          { x: d.x + dir * (L + 2) * d.size, y: Y(d, y + 1.6 + tilt) },
          { x: d.x + dir * L * d.size, y: Y(d, y + 3.2 + tilt) },
          { x: d.x, y: Y(d, y + 3.2) },
        ];
        part(s, board, shift(d.color, 12 - i * 4), low16(d.seed) + i, { depth: 0.4, thin: 0.3, thick: 0.7 });
        snowCap(s, Math.min(d.x, d.x + dir * L * d.size), Math.max(d.x, d.x + dir * L * d.size), Y(d, y - 0.2), low16(d.seed) + i, 0.6);
      }
      snowCap(s, X(d, -3), X(d, 3), Y(d, -0.3), low16(d.seed), 1.3);
    },
  },
  icecrystal: {
    color: (th) => th.terrain.ice?.light ?? ICE,
    bake(s, d) {
      // A cluster of clear ice crystals growing out of the ground at angles.
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i - 1) * 0.45 + (knob(d, i) - 0.5) * 0.2;
        const L = (7 + knob(d, i + 3) * 6) * d.size * (i === 1 ? 1.3 : 1);
        const w = 1.6 * d.size;
        const bx = d.x + (i - 1) * 2.2 * fx(d);
        const ca = Math.cos(a) * fx(d);
        const sa = Math.sin(a);
        const shard = [
          { x: bx - sa * w, y: d.y + 0.5 + ca * w * 0.3 },
          { x: bx + ca * L * 0.8 - sa * w, y: d.y + sa * L * 0.8 },
          { x: bx + ca * L, y: d.y + sa * L },
          { x: bx + ca * L * 0.8 + sa * w, y: d.y + sa * L * 0.8 },
          { x: bx + sa * w, y: d.y + 0.5 },
        ];
        part(s, shard, d.color, low16(d.seed) + i, { depth: 0.6, thin: 0.3, thick: 0.7 });
        glint(s, [shard[0], shard[1]], 'rgba(255,255,255,0.9)', 0.4, i);
      }
    },
  },
} satisfies Record<string, DecorDef>;
