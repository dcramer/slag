import { css, type HSL, hsl3 } from '../core/color';
import type { DecorDef } from './decor';
import { blob, inkFor, line, type P, stroke } from './ink';
import { barLine, boxPts, part } from './ink-props';
import { light } from './kit';
import { bits01 } from './decor-kit';

/**
 * Decor for the glacier and for space, inked: a cairn, an expedition
 * pennant, icicles under ledges, and a little lander left on a rock. Small
 * and cosmetic like all decor, so none of it reads as something to stand on
 * or dodge.
 */

/** A pennant's cloth, flapping with time `t` (0 when baked still). */
function pennantCloth(s: CanvasRenderingContext2D, x: number, top: number, len: number, color: HSL, t: number, dir: number) {
  const flap = (u: number) => Math.sin(t * 6 + u * 4) * 1.2 * u;
  const tip: P = { x: x + dir * len, y: top + 2.8 + flap(1) };
  s.fillStyle = css(color);
  s.beginPath();
  s.moveTo(x, top);
  s.quadraticCurveTo(x + dir * len * 0.5, top + flap(0.5), tip.x, tip.y);
  s.quadraticCurveTo(x + dir * len * 0.5, top + 5.6 + flap(0.5), x, top + 5.6);
  s.closePath();
  s.fill();
  // The pen along its shadowed lower edge only, in a dark of the cloth.
  s.fillStyle = inkFor(color);
  stroke(s, [{ x, y: top + 5.6 }, { x: x + dir * len * 0.5, y: top + 4.6 + flap(0.5) }, tip], { w: 0.8, seed: (x * 3) | 0, taper: [0.2, 0.6] });
}

export const FRONTIER_DECOR = {
  cairn: {
    color: (th) => th.terrain.light,
    bake(s, d) {
      // Stones stacked smaller as they go up, each sat a little off the last.
      let y = d.y + 0.6;
      let r = 3.4 * d.size;
      const n = 3 + (d.seed % 2);
      for (let i = 0; i < n; i++) {
        const x = d.x + (bits01(d.seed, i * 3) - 0.5) * 2;
        s.fillStyle = inkFor(d.color);
        blob(s, x, y - r * 0.7, r + 0.4, d.seed + i, 0.66, 0.2);
        s.fill();
        s.fillStyle = css(d.color, -10 + i * 4);
        blob(s, x, y - r * 0.7, r, d.seed + i, 0.62, 0.2);
        s.fill();
        s.fillStyle = css(d.color, 14, 0.8);
        line(s, x - r * 0.5, y - r * 1.05, x + r * 0.2, y - r * 1.15, { w: 0.8, seed: d.seed + i, taper: [0.2, 0.5] });
        y -= r * 1.2;
        r *= 0.74;
      }
    },
  },
  pennant: {
    color: (th, rng) => (rng.chance(0.6) ? th.accent : hsl3(rng.pick([0, 48, 210]), 85, 52)),
    bake(s, d) {
      const h = 18 + (d.seed % 6);
      barLine(s, d.x, d.y + 0.5, d.x + 0.3, d.y - h, 0.8, hsl3(30, 20, 66), d.seed, { taper: [0.02, 0.06] });
    },
    live(rc, d) {
      const h = 18 + (d.seed % 6);
      pennantCloth(rc.s, d.x + 0.4, d.y - h, 9 * d.size, d.color, rc.t + (d.seed % 7), d.flip ? -1 : 1);
    },
  },
  icicles: {
    color: () => hsl3(195, 55, 86),
    bake(s, d) {
      const n = 2 + (d.seed % 3);
      for (let i = 0; i < n; i++) {
        const x = d.x + (i - (n - 1) / 2) * 3 + (bits01(d.seed, i * 2) - 0.5) * 1.5;
        const len = (3 + bits01(d.seed, i * 4) * 7) * d.size;
        s.fillStyle = inkFor(d.color);
        line(s, x, d.y - 0.6, x, d.y + len + 0.5, { w: 2.6, seed: d.seed + i, taper: [0, 0.95], press: 0 });
        s.fillStyle = css(d.color);
        line(s, x, d.y - 0.6, x, d.y + len, { w: 2, seed: d.seed + i, taper: [0, 0.95], press: 0 });
        s.fillStyle = '#fff';
        line(s, x - 0.4, d.y, x - 0.3, d.y + len * 0.5, { w: 0.5, seed: d.seed + i, taper: [0.1, 0.9] });
      }
    },
  },
  lander: {
    color: () => hsl3(45, 70, 60),
    bake(s, d) {
      const x = d.x;
      const y = d.y;
      const dir = d.flip ? -1 : 1;
      // Three splayed legs with pads, a foil-wrapped body, a dish.
      const leg = hsl3(220, 8, 36);
      for (const [fx, tx] of [
        [-5, -2],
        [5, 2],
        [0, 0],
      ]) {
        barLine(s, x + fx, y, x + tx, y - 5, 0.6, leg, d.seed + fx, { taper: [0.04, 0.04] });
        barLine(s, x + fx - 1.4, y - 0.2, x + fx + 1.4, y - 0.2, 0.6, leg, d.seed + fx + 9, { taper: [0.04, 0.04] });
      }
      part(s, boxPts(x - 4.1, y - 10.1, 8.2, 5.6, 0.5, d.seed, 0.05), d.color, d.seed, { depth: 0.4, thin: 0.4, thick: 0.9 });
      s.fillStyle = css(d.color, -16);
      s.fillRect(x - 3.6, y - 6.6, 7.2, 1.6);
      s.fillStyle = css(d.color, 18);
      s.fillRect(x - 3, y - 9.2, 2.2, 1);
      barLine(s, x + dir * 2, y - 10, x + dir * 4, y - 13.5, 0.5, leg, d.seed, { rim: 0.2 });
      s.fillStyle = css(hsl3(210, 10, 86));
      blob(s, x + dir * 4.6, y - 14, 2.2, d.seed, 0.5, 0.05);
      s.fill();
    },
    live(rc, d) {
      const on = (rc.t * 0.7 + (d.seed % 10) / 10) % 1 < 0.2 ? 1 : 0.15;
      const c = hsl3(0, 100, 58);
      rc.g.fillStyle = css(c, 10, on);
      rc.g.fillRect(d.x - (d.flip ? -2 : 2) - 0.6, d.y - 11.4, 1.3, 1.3);
      if (on > 0.5) light(rc, d.x, d.y - 11, 24, c, 0.3);
    },
  },
} satisfies Record<'cairn' | 'pennant' | 'icicles' | 'lander', DecorDef>;
