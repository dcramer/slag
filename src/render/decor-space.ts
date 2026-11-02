import { css, type HSL, hsl3 } from '../core/color';
import type { DecorDef } from './decor';
import { blob, inkFor, type P, stroke } from './ink';
import { boxPts, glint, ovalPts, part, path, poly, tick } from './ink-props';
import { bulb, light } from './kit';

/**
 * Space's decor, small and cosmetic like all decor: on a station, cargo pods, a solar panel on its stand,
 * a warning lamp, a wrench someone let go of; out on the rocks, moon rock, a planted flag, a dented little
 * satellite that came down here, and a helmet with nobody in it. Every line is a dark of what it outlines
 * (`inkFor`), every surface two flat hand-cut tones. A lamp's lens is a flat bulb, never a halo; the wrench
 * hangs a hair above the ground in the low gravity and turns, slowly.
 */

const k01 = (seed: number, n: number) => ((seed >>> n) % 1000) / 1000;
const sd = (seed: number) => seed & 0xffff;

const STEEL: HSL = hsl3(212, 8, 62);
const DARK: HSL = hsl3(220, 14, 26);
const WHITE: HSL = hsl3(210, 8, 86);
const STRIPE: HSL = hsl3(46, 80, 52);
const CELL: HSL = hsl3(222, 45, 34);
const GOLD: HSL = hsl3(44, 64, 56);

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

/** The wrench's shape, about its middle, turned by `a`. */
function wrenchPts(x: number, y: number, a: number): { handle: P[]; jaw: P[] } {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const r = (u: number, v: number): P => ({ x: x + u * ca - v * sa, y: y + u * sa + v * ca });
  return {
    handle: [r(-5, -0.9), r(3, -1), r(3, 1), r(-5, 0.9)],
    jaw: [r(3, -2.4), r(6.4, -2.6), r(6.6, -0.8), r(5, -0.8), r(5, 0.8), r(6.6, 0.8), r(6.4, 2.6), r(3, 2.4)],
  };
}

export const SPACE_DECOR = {
  cargopod: {
    color: (_th, rng) => hsl3(rng.pick([14, 46, 200, 120]), 42, 50),
    bake(s, d) {
      // A stack of one or two cargo pods: rounded drums on their sides, banded, a stencilled tick.
      const f = d.flip ? -1 : 1;
      const pod = (cx: number, cy: number, w: number, seed: number) => {
        part(s, boxPts(cx - w / 2, cy - 3.6, w, 7.2, 3.2, seed, 0.12), d.color, seed, { depth: 0.8, thin: 0.4, thick: 0.9 });
        for (const bx of [cx - w / 2 + 2.6, cx + w / 2 - 2.6]) mark(s, bx, cy - 3, bx, cy + 3, d.color, seed + bx, 0.7);
        tick(s, cx - 1.5, cy - 0.6, cx + 1.5, cy - 0.6, 0.45, seed + 1, css(WHITE, -8));
      };
      pod(d.x, d.y - 3.6, 12, sd(d.seed));
      if (k01(d.seed, 2) < 0.4) pod(d.x + f * 2, d.y - 10.8, 10, sd(d.seed) + 3);
    },
  },
  solarpanel: {
    color: () => CELL,
    bake(s, d) {
      // A panel tilted on a post, cut into cells, the sun catching one corner.
      const f = d.flip ? -1 : 1;
      rod(s, at(d.x, d.y, f, 0, 0, 0, -7), 0.9, STEEL, sd(d.seed));
      const panel = at(d.x, d.y, f, -7, -6, 7, -10, 8, -7.5, -6, -3.5);
      part(s, panel, d.color, sd(d.seed) + 1, { depth: 0.4, thin: 0.4, thick: 0.85 });
      for (const u of [0.33, 0.66]) {
        const a = { x: panel[0].x + (panel[1].x - panel[0].x) * u, y: panel[0].y + (panel[1].y - panel[0].y) * u };
        const b = { x: panel[3].x + (panel[2].x - panel[3].x) * u, y: panel[3].y + (panel[2].y - panel[3].y) * u };
        tick(s, a.x, a.y, b.x, b.y, 0.4, u * 10, css(d.color, 20));
      }
      glint(s, at(d.x, d.y, f, -5, -6.2, -2, -7.2), 'rgba(220,235,255,0.85)', 0.5);
    },
  },
  warnlamp: {
    color: (_th, rng) => (rng.chance(0.6) ? hsl3(40, 100, 58) : hsl3(2, 100, 55)),
    bake(s, d) {
      // A squat lamp housing on a hazard-striped base.
      part(s, boxPts(d.x - 4, d.y - 3, 8, 3, 0.6, sd(d.seed), 0.12), STRIPE, sd(d.seed), { depth: 0.3, thin: 0.4, thick: 0.85 });
      for (let k = -3; k <= 2; k += 2) mark(s, d.x + k, d.y - 0.3, d.x + k + 1.3, d.y - 2.7, STRIPE, k, 0.6);
      part(s, boxPts(d.x - 2.6, d.y - 7.6, 5.2, 4.8, 2, sd(d.seed) + 1, 0.12), DARK, sd(d.seed) + 1, { depth: 0.4, thin: 0.4, thick: 0.85 });
    },
    live(rc, d) {
      // It turns: on for a beat in every turn, a flat lens.
      const on = Math.sin(rc.t * 4 + (d.seed % 7)) > 0.2;
      const x = d.x;
      const y = d.y - 5.2;
      if (on) {
        bulb(rc.g, x, y, 1.7, d.color, 1);
        light(rc, x, y, 34, d.color, 0.45);
      } else bulb(rc.s, x, y, 1.7, { ...d.color, l: d.color.l * 0.45 }, 1);
    },
  },
  wrench: {
    color: () => STEEL,
    live(rc, d) {
      // Let go of in low gravity: it hangs a little off the ground and turns over, very slowly.
      const y = d.y - 4.5 - Math.sin(rc.t * 0.9 + (d.seed % 11)) * 1.2;
      const a = rc.t * 0.35 + (d.seed % 13);
      const { handle, jaw } = wrenchPts(d.x, y, a);
      part(rc.s, handle, d.color, sd(d.seed), { depth: 0.3, thin: 0.4, thick: 0.75 });
      part(rc.s, jaw, d.color, sd(d.seed) + 1, { depth: 0.3, thin: 0.4, thick: 0.75 });
      // Its shadow on the ground, which is how you can tell it isn't standing on it.
      rc.bg.fillStyle = 'rgba(10,8,20,0.3)';
      path(rc.bg, ovalPts(d.x, d.y - 0.3, 5, 0.9, 1, 0.02, 10));
      rc.bg.fill();
    },
  },
  helmet: {
    color: (_th, rng) => (rng.chance(0.7) ? WHITE : hsl3(24, 62, 56)),
    bake(s, d) {
      // A space helmet left on its side: a round shell, a gold visor, the collar ring under it.
      const f = d.flip ? -1 : 1;
      part(s, boxPts(d.x - f * 5 - 1.4, d.y - 3.8, 2.8, 3.8, 0.8, sd(d.seed) + 2, 0.15), DARK, sd(d.seed) + 2, { depth: 0.3, thin: 0.35, thick: 0.7 });
      part(s, ovalPts(d.x, d.y - 5, 5.6, 5, sd(d.seed), 0.02, 18), d.color, sd(d.seed), { depth: 0.9, thin: 0.4, thick: 0.9 });
      part(s, ovalPts(d.x + f * 1.8, d.y - 5.4, 3, 2.8, sd(d.seed) + 1, 0.02, 14), GOLD, sd(d.seed) + 1, { depth: 0.5, thin: 0.35, thick: 0.75 });
      glint(s, poly(d.x + f * 0.4, d.y - 7, d.x + f * 1.8, d.y - 7.8), 'rgba(255,250,220,0.9)', 0.5);
    },
  },
  moonrock: {
    color: (th) => th.terrain.light,
    bake(s, d) {
      // A pitted lump of the rock it sits on, and a smaller one beside it.
      const f = d.flip ? -1 : 1;
      for (const [ox, r, k] of [
        [0, 4, 0],
        [f * 5.5, 2.2, 1],
      ] as const) {
        const c: HSL = { ...d.color, l: d.color.l - 6 + k * 4 };
        s.fillStyle = inkFor(c);
        blob(s, d.x + ox, d.y - r * 0.7, r + 0.45, d.seed + k, 0.7, 0.25);
        s.fill();
        s.fillStyle = css(c);
        blob(s, d.x + ox, d.y - r * 0.7, r, d.seed + k, 0.68, 0.25);
        s.fill();
        s.fillStyle = css(c, -16);
        blob(s, d.x + ox + r * 0.25, d.y - r * 0.45, r * 0.55, d.seed + k + 7, 0.5, 0.3);
        s.fill();
        s.fillStyle = css(c, -22);
        blob(s, d.x + ox - r * 0.3, d.y - r * 0.85, r * 0.22, d.seed + k + 9, 1, 0.2);
        s.fill();
      }
    },
  },
  moonflag: {
    color: (_th, rng) => hsl3(rng.pick([2, 210, 48]), 62, 50),
    bake(s, d) {
      // Planted and stiff: there's no wind to fly it, so a rod along its top holds it out.
      const f = d.flip ? -1 : 1;
      const h = 17 + (d.seed % 5);
      rod(s, at(d.x, d.y, f, 0, 0, 0, -h), 0.7, WHITE, sd(d.seed));
      const cloth = at(d.x, d.y, f, 0, -h + 0.5, 10, -h + 0.7, 9.8, -h + 6.6, 0, -h + 6.4);
      part(s, cloth, d.color, sd(d.seed) + 1, { depth: 0.3, thin: 0.35, thick: 0.75 });
      for (const y of [-h + 2.6, -h + 4.6]) tick(s, d.x + f * 1, d.y + y, d.x + f * 9, d.y + y, 0.6, y, css(WHITE, -4));
    },
  },
  minisat: {
    color: () => GOLD,
    bake(s, d) {
      // A little satellite that came down here: a foil body on its side, one wing snapped, a bent antenna.
      const f = d.flip ? -1 : 1;
      part(s, at(d.x, d.y, f, 3.5, -4, 10, -2.5, 9.5, 0, 3.5, -1.5), CELL, sd(d.seed) + 1, { depth: 0.3, thin: 0.35, thick: 0.75 });
      part(s, boxPts(d.x - 3.5, d.y - 6, 7, 6, 0.8, sd(d.seed), 0.15), d.color, sd(d.seed), { depth: 0.6, thin: 0.4, thick: 0.85 });
      for (const u of [-1.5, 1.5]) mark(s, d.x + u, d.y - 5.4, d.x + u, d.y - 0.8, d.color, u, 0.45);
      part(s, at(d.x, d.y, f, -3.5, -4, -6, -4.6, -6, -2.6, -3.5, -2.4), CELL, sd(d.seed) + 2, { depth: 0.2, thin: 0.35, thick: 0.7 });
      rod(s, at(d.x, d.y, f, 0, -6, 1, -9, 3.5, -10.5), 0.4, STEEL, sd(d.seed) + 3);
      s.fillStyle = inkFor(STEEL);
      blob(s, d.x + f * 3.5, d.y - 10.5, 0.8, sd(d.seed) + 4, 1, 0.1);
      s.fill();
    },
  },
} satisfies Record<'cargopod' | 'solarpanel' | 'warnlamp' | 'wrench' | 'helmet' | 'moonrock' | 'moonflag' | 'minisat', DecorDef>;
