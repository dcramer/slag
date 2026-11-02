import { css, type HSL, hsl3, shift } from '../core/color';
import type { DecorDef } from './decor';
import { blob, line, type P, stroke } from './ink';
import { ball, boxPts, glint, INK, ovalPts, part, path, poly, tick } from './ink-props';
import { circle, glowDot, light } from './kit';

/**
 * The volcano's decor, inked like the ground it stands on: basalt columns, lava pillows, sulphur vents, a
 * charred stump, a pile of bones, ember rocks, a broken cauldron, a skull-shaped rock (a rock: no face), an
 * ash drift, a toppled idol (blank-faced: just its carved bands), a rope-bridge post and a spatter cone.
 * Small and cosmetic like all decor: nothing here reads as somewhere to stand or something to dodge. Only
 * what's hot glows: embers, the spatter cone's mouth, cracks in the ember rock and the pillows' seams.
 */

const k01 = (seed: number, n: number) => ((seed >>> n) % 1000) / 1000;
const sd = (seed: number) => seed & 0xffff;

const BASALT: HSL = hsl3(20, 9, 20);
const CHAR: HSL = hsl3(18, 18, 13);
const BONE: HSL = hsl3(42, 26, 74);
const SULPHUR: HSL = hsl3(54, 88, 58);
const ASH: HSL = hsl3(20, 6, 46);
const IRON: HSL = hsl3(220, 8, 22);
const WOOD: HSL = hsl3(26, 30, 26);
const ROPE: HSL = hsl3(38, 36, 52);

/** Points of a shape in decor space: (x, y) offsets from the foot, scaled by `k` and mirrored by `f`. */
const at = (x0: number, y0: number, k: number, f: number, ...xy: number[]) => {
  const out: P[] = [];
  for (let i = 0; i + 1 < xy.length; i += 2) out.push({ x: x0 + xy[i] * k * f, y: y0 + xy[i + 1] * k });
  return out;
};

/** A hot crack: a lava line on the glow layer. */
function hotLine(g: CanvasRenderingContext2D, pts: readonly P[], col: HSL, a: number) {
  g.fillStyle = css(col, 8, a);
  stroke(g, pts, { w: 0.9, seed: 3, taper: [0.2, 0.3], press: 0 });
}

export const VOLCANO_DECOR = {
  basaltcols: {
    color: (th) => shift(th.terrain.dark, -2),
    bake(s, d) {
      // Hexagonal columns of cooled lava, each a different height, flat-topped.
      const n = 3 + (d.seed % 2);
      for (let i = 0; i < n; i++) {
        const w = 3.2 * d.size;
        const x = d.x - (n * w) / 2 + i * w;
        const h = (5 + k01(d.seed, i * 3) * 7) * d.size;
        part(s, poly(x, d.y + 0.5, x, d.y - h + 1, x + w / 2, d.y - h, x + w, d.y - h + 1, x + w, d.y + 0.5), shift(d.color, i % 2 ? 4 : 0), sd(d.seed) + i, {
          depth: 0.5,
          thin: 0.4,
          thick: 0.9,
        });
        tick(s, x + 0.6, d.y - h + 3, x + w - 0.6, d.y - h + 3, 0.5, i);
      }
    },
  },
  pillow: {
    color: (th) => th.terrain.vein,
    bake(s, d) {
      // Lava pillows: round lobes of crust, piled where a flow cooled.
      const k = d.size;
      const lobes: [number, number, number][] = [
        [-3.5, -2.4, 3],
        [2.6, -2.2, 2.8],
        [-0.4, -5.6, 2.6],
      ];
      for (const [i, [x, y, r]] of lobes.entries())
        part(s, ovalPts(d.x + x * k, d.y + y * k, r * k * 1.2, r * k, sd(d.seed) + i, 0.08), CHAR, i, { depth: 0.8, thin: 0.45 });
    },
    live(rc, d) {
      // The seams between the lobes still glow, dimly.
      const k = d.size;
      const a = 0.35 + 0.25 * Math.sin(rc.t * 1.4 + d.seed);
      hotLine(
        rc.g,
        [
          { x: d.x - 1 * k, y: d.y - 1 * k },
          { x: d.x, y: d.y - 3.2 * k },
          { x: d.x + 0.8 * k, y: d.y - 1.4 * k },
        ],
        d.color,
        a,
      );
    },
  },
  sulphur: {
    color: () => SULPHUR,
    bake(s, d) {
      const k = d.size;
      part(s, at(d.x, d.y + 0.5, k, 1, -5.5, 0, -3, -2.6, -1.4, -3.2, 1.4, -3.2, 3, -2.6, 5.5, 0), shift(BASALT, 4), sd(d.seed), { depth: 0.6, thin: 0.4 });
      // A crust of sulphur round the mouth, crystals in flat yellow.
      s.fillStyle = css(d.color);
      path(s, ovalPts(d.x, d.y - 3 * k, 3.2 * k, 1 * k, sd(d.seed) + 2, 0.15, 12));
      s.fill();
      for (let i = 0; i < 4; i++) {
        const cx = d.x + (i - 1.5) * 1.8 * k;
        s.fillStyle = css(d.color, 10 - i * 3);
        path(s, poly(cx - 0.7, d.y - 3.2 * k, cx, d.y - (4.4 + (i % 2)) * k, cx + 0.7, d.y - 3.2 * k));
        s.fill();
      }
      s.fillStyle = INK;
      path(s, ovalPts(d.x, d.y - 3.1 * k, 1.4 * k, 0.5 * k, sd(d.seed) + 3, 0.05, 8));
      s.fill();
    },
    live(rc, d) {
      // Thin yellow-white fumes, soft, on the background.
      for (let i = 0; i < 3; i++) {
        const p = (rc.t * 0.4 + i / 3 + (d.seed % 5) / 5) % 1;
        rc.bg.fillStyle = `rgba(232,226,170,${0.22 * (1 - p) * Math.min(1, p * 5)})`;
        circle(rc.bg, d.x + Math.sin(p * 4 + i) * 2, d.y - 5 - p * 18, 1.5 + p * 4);
      }
    },
  },
  stump: {
    color: (th) => th.terrain.vein,
    bake(s, d) {
      const k = d.size;
      const f = d.flip ? -1 : 1;
      part(s, at(d.x, d.y + 0.5, k, f, -3.4, 0, -2.4, -6, -3.4, -8, -1, -7, 0.4, -12, 1.6, -7.5, 2.6, -5, 3.6, 0), CHAR, sd(d.seed), {
        depth: 0.7,
        thin: 0.45,
      });
      // Roots, and the charcoal checks across the trunk.
      tick(s, d.x - 3.4 * k * f, d.y, d.x - 5.6 * k * f, d.y + 0.4, 0.8, 1);
      tick(s, d.x + 3.4 * k * f, d.y, d.x + 5 * k * f, d.y + 0.4, 0.8, 2);
      for (let i = 0; i < 3; i++)
        tick(s, d.x - 2 * k * f, d.y - (2 + i * 1.8) * k, d.x + 1.8 * k * f, d.y - (2.4 + i * 1.8) * k, 0.45, 3 + i, css(shift(CHAR, -6)));
    },
    live(rc, d) {
      const k = d.size;
      const f = d.flip ? -1 : 1;
      const a = 0.5 + 0.3 * Math.sin(rc.t * 2.2 + d.seed);
      rc.g.fillStyle = css(d.color, 6, a);
      circle(rc.g, d.x + 0.4 * k * f, d.y - 11.4 * k, 0.9);
      glowDot(rc.g, d.x + 0.4 * k * f, d.y - 11.4 * k, 6, d.color, 0.35 * a);
    },
  },
  bonepile: {
    color: () => BONE,
    bake(s, d) {
      const k = d.size;
      // A long bone across the pile, two crossed under it, a curved rib on top.
      const bone = (ax: number, ay: number, bx: number, by: number, w: number, seed: number) => {
        s.fillStyle = INK;
        line(s, ax, ay, bx, by, { w: w + 1.1, seed, taper: [0, 0], press: 0 });
        s.fillStyle = css(d.color);
        line(s, ax, ay, bx, by, { w, seed: seed + 1, taper: [0, 0], press: 0 });
        for (const [x, y] of [
          [ax, ay],
          [bx, by],
        ]) {
          s.fillStyle = INK;
          circle(s, x, y, w * 0.85 + 0.5);
          s.fillStyle = css(d.color, 4);
          circle(s, x, y, w * 0.85);
        }
      };
      bone(d.x - 4 * k, d.y - 1, d.x + 3 * k, d.y - 2.6 * k, 1.3 * k, 1);
      bone(d.x - 2 * k, d.y - 3.6 * k, d.x + 4.4 * k, d.y - 0.8, 1.1 * k, 4);
      s.fillStyle = INK;
      stroke(
        s,
        [
          { x: d.x - 3 * k, y: d.y - 3 * k },
          { x: d.x - 1 * k, y: d.y - 6 * k },
          { x: d.x + 2.4 * k, y: d.y - 5.4 * k },
        ],
        { w: 1.8, seed: 7, taper: [0.2, 0.4], press: 0 },
      );
      s.fillStyle = css(d.color, 6);
      stroke(
        s,
        [
          { x: d.x - 3 * k, y: d.y - 3 * k },
          { x: d.x - 1 * k, y: d.y - 6 * k },
          { x: d.x + 2.4 * k, y: d.y - 5.4 * k },
        ],
        { w: 0.9, seed: 8, taper: [0.2, 0.4], press: 0 },
      );
    },
  },
  emberrock: {
    color: (th) => th.terrain.vein,
    bake(s, d) {
      const k = d.size;
      part(s, at(d.x, d.y + 0.5, k, d.flip ? -1 : 1, -5, 0, -4, -4, -1, -6.2, 3, -5, 5, -1.6, 5, 0), BASALT, sd(d.seed), { depth: 0.8, thin: 0.45 });
    },
    live(rc, d) {
      const k = d.size;
      const f = d.flip ? -1 : 1;
      const a = 0.55 + 0.35 * Math.sin(rc.t * 1.8 + d.seed);
      hotLine(rc.g, at(d.x, d.y, k, f, -3.4, -1, -1.6, -3.6, 0.6, -2.6, 2.6, -4.6), d.color, a);
      hotLine(rc.g, at(d.x, d.y, k, f, 0.6, -2.6, 1.6, -0.6), d.color, a * 0.8);
      glowDot(rc.g, d.x, d.y - 3 * k, 9 * k, d.color, 0.3 * a);
      light(rc, d.x, d.y - 3, 26, d.color, 0.3 * a);
    },
  },
  cauldron: {
    color: (th) => shift(th.terrain.dark, -4),
    bake(s, d) {
      const k = d.size;
      const f = d.flip ? -1 : 1;
      // Tipped on its side, a piece broken out of its rim, a cold puddle of what was in it.
      s.fillStyle = css(CHAR, -2);
      path(s, ovalPts(d.x + 4 * k * f, d.y - 0.4, 4 * k, 1 * k, sd(d.seed) + 5, 0.15, 12));
      s.fill();
      const body = at(d.x, d.y + 0.4, k, f, -5, -0.4, -6, -3.6, -4.6, -7.2, -1, -8.4, 1.6, -7.6, 2.6, -5.2, 0.8, -4.2, 2.6, -2.2, 1.4, 0);
      part(s, body, IRON, sd(d.seed), { depth: 0.9, thin: 0.45 });
      // Its mouth, and a stubby leg in the air.
      s.fillStyle = INK;
      path(s, at(d.x, d.y, k, f, 1.6, -7.4, 2.8, -5, 1.2, -4.4, 0.4, -6.6));
      s.fill();
      tick(s, d.x - 4.6 * k * f, d.y - 7.2 * k, d.x - 6.2 * k * f, d.y - 8.6 * k, 1.1, 2);
      glint(s, at(d.x, d.y, k, f, -4.6, -6, -2.2, -7.6), 'rgba(220,226,240,0.6)', 0.6);
    },
  },
  skullrock: {
    color: (th) => shift(th.terrain.base, 4),
    bake(s, d) {
      const k = d.size;
      const f = d.flip ? -1 : 1;
      // A boulder weathered round on top and notched under the brow: skull-shaped from a distance. Just rock.
      const pts = at(d.x, d.y + 0.5, k, f, -5, 0, -5.6, -4, -4, -8, 0, -9.4, 4, -8, 5.4, -4.4, 4.2, -2.4, 4.8, 0);
      part(s, pts, d.color, sd(d.seed), { depth: 1, thin: 0.45, thick: 1.2 });
      tick(s, d.x + 4.2 * k * f, d.y - 2.4 * k, d.x + 2.4 * k * f, d.y - 2.2 * k, 0.8, 4);
      s.fillStyle = css(shift(d.color, -10));
      path(s, at(d.x, d.y, k, f, -3, -1, -2, -3.2, 1, -2.6, 0.4, -0.6));
      s.fill();
    },
  },
  ashdrift: {
    color: () => ASH,
    bake(s, d) {
      const k = d.size;
      const f = d.flip ? -1 : 1;
      // A low drift of ash banked against the wind, streaked along its back.
      const pts = at(d.x, d.y + 0.6, k, f, -7, 0, -4, -2, 0, -3.4, 3.6, -2.8, 6.8, -0.8, 7.4, 0);
      part(s, pts, d.color, sd(d.seed), { depth: 0.5, thin: 0.35, thick: 0.8 });
      for (let i = 0; i < 3; i++)
        tick(s, d.x + (-4 + i * 3) * k * f, d.y - (1.6 + (i % 2)) * k, d.x + (-2 + i * 3) * k * f, d.y - (2.2 + (i % 2)) * k, 0.4, i, css(shift(d.color, 14)));
    },
  },
  idol: {
    color: (th) => shift(th.terrain.base, 8),
    bake(s, d) {
      const k = d.size;
      const f = d.flip ? -1 : 1;
      // Toppled on its back, its broken stump still standing: a blank carved stone with bands and a crest.
      part(s, at(d.x, d.y + 0.5, k, f, 5, 0, 5, -3.4, 7.4, -3, 7.6, 0), d.color, sd(d.seed) + 1, { depth: 0.6, thin: 0.4 });
      const body = boxPts(d.x - 8 * k, d.y - 4.6 * k, 12 * k, 4.6 * k, 1, sd(d.seed), 0.1);
      part(s, body, d.color, sd(d.seed), { depth: 0.8, thin: 0.45 });
      for (let i = 1; i < 4; i++) tick(s, d.x + (-8 + i * 3) * k, d.y - 4.4 * k, d.x + (-8 + i * 3) * k, d.y - 0.4, 0.5, i);
      part(s, at(d.x, d.y, k, f, -8, -1, -10.4, -2.2, -10.6, -3.6, -8, -4.4), shift(d.color, -6), sd(d.seed) + 2, { depth: 0.5, thin: 0.35 });
    },
  },
  bridgepost: {
    color: () => WOOD,
    bake(s, d) {
      const k = d.size;
      const f = d.flip ? -1 : 1;
      // A rope bridge's anchor post, the bridge long gone: a stake lashed round, the frayed rope trailing off.
      part(s, at(d.x, d.y + 0.5, k, f, -1.4, 0, -1.6, -11, 0, -12.2, 1.4, -11, 1.2, 0), d.color, sd(d.seed), { depth: 0.6, thin: 0.4 });
      for (let i = 0; i < 3; i++) tick(s, d.x - 1.6 * k, d.y - (8.4 + i * 1.1) * k, d.x + 1.4 * k, d.y - (8 + i * 1.1) * k, 0.9, i, css(ROPE));
      s.fillStyle = INK;
      const rope = at(d.x, d.y, k, f, 1.4, -9, 4, -6, 5.6, -2.6, 7.6, -1.2);
      stroke(s, rope, { w: 1.6, seed: 3, taper: [0.05, 0.6], press: 0 });
      s.fillStyle = css(ROPE);
      stroke(s, rope, { w: 0.8, seed: 4, taper: [0.05, 0.7], press: 0 });
    },
  },
  spattercone: {
    color: (th) => th.terrain.vein,
    bake(s, d) {
      const k = d.size;
      // A hornito: lava spat up into a little chimney of clots around a mouth that's still hot.
      part(s, at(d.x, d.y + 0.5, k, 1, -5, 0, -3, -4, -1.8, -8, -0.6, -8.4, 0.8, -8.2, 2, -7.4, 3, -3.6, 5, 0), BASALT, sd(d.seed), { depth: 0.7, thin: 0.45 });
      for (let i = 0; i < 4; i++) {
        s.fillStyle = css(BASALT, 6 - i * 2);
        blob(s, d.x + (k01(d.seed, i * 4) - 0.5) * 5 * k, d.y - (2 + i * 1.6) * k, 1.1 * k, i, 1, 0.3);
        s.fill();
      }
      ball(s, d.x + 5.6 * k, d.y - 1, 1.2 * k, BASALT, 9);
    },
    live(rc, d) {
      const k = d.size;
      const a = 0.6 + 0.4 * Math.sin(rc.t * 3.1 + d.seed);
      rc.g.fillStyle = css(d.color, 10, a);
      path(rc.g, ovalPts(d.x - 0.4 * k, d.y - 8.2 * k, 1.3 * k, 0.5 * k, 3, 0.05, 8));
      rc.g.fill();
      glowDot(rc.g, d.x - 0.4 * k, d.y - 9 * k, 10 * k, d.color, 0.4 * a);
      light(rc, d.x, d.y - 9, 34, d.color, 0.4 * a);
    },
  },
} satisfies Record<'basaltcols' | 'pillow' | 'sulphur' | 'stump' | 'bonepile' | 'emberrock' | 'cauldron' | 'skullrock' | 'ashdrift' | 'idol' | 'bridgepost' | 'spattercone', DecorDef>;


