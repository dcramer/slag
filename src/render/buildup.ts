import { css, type HSL } from '../core/color';
import { hash2 } from '../core/rng';
import type { Runner } from '../sim/run';
import { glowDot, poseFrame, type RC } from './kit';

/**
 * A brawl's build-up (`RunRules.buildup`, `RunnerItems.hits`) read without a number: whoever has taken hits smoulders,
 * the way a platform fighter's damage runs from white to red, in three steps that each read on their own at play scale.
 * One or two hits, a pale wisp off the head; three or four, a grey plume with sparks spitting off the body and embers
 * at the feet; five and on, a black plume, sparks crackling and the feet glowing: someone a tap sends flying. The plume
 * is the loud tell, so it rises straight from its own runner and never fuses with a neighbour's; sparks stay within a
 * body of it, and the heat sits at the feet so the player's colour stays the loudest note on the body (docs/ART.md).
 * Heat goes emissive (glow is for hot things); the smoke is cut-out puffs on the background, as the particles' are.
 * Stateless, a function of the frame, so a paused picture shows it too; a race, which counts no hits, never smokes.
 */

interface Tier {
  /** Puffs in the plume, how high it rises (px), their size, and the smoke's lightness. */
  puffs: number;
  rise: number;
  size: number;
  l: number;
  /** Sparks off the body and embers at the feet at a time, and how hot the feet glow (0: not at all). */
  sparks: number;
  embers: number;
  heat: number;
}

/** By hits: none, 1–2, 3–4, 5 and on. */
const TIERS: readonly Tier[] = [
  { puffs: 0, rise: 0, size: 0, l: 0, sparks: 0, embers: 0, heat: 0 },
  { puffs: 4, rise: 14, size: 2.2, l: 90, sparks: 0, embers: 0, heat: 0 },
  { puffs: 5, rise: 20, size: 2.4, l: 54, sparks: 3, embers: 2, heat: 0.34 },
  { puffs: 6, rise: 26, size: 2.8, l: 26, sparks: 5, embers: 3, heat: 0.5 },
];

const tierOf = (hits: number) => (hits >= 5 ? 3 : hits >= 3 ? 2 : hits >= 1 ? 1 : 0);

/** Frames a puff takes to rise and shrink away, a spark to spit off and fall, an ember to wink at the feet. */
const PUFF_LIFE = 50;
const SPARK_LIFE = 12;
const EMBER_LIFE = 30;

const SPARK: HSL = { h: 40, s: 100, l: 62 };
const EMBER: HSL = { h: 22, s: 100, l: 55 };
const HEAT: HSL = { h: 18, s: 100, l: 50 };

const frac = (v: number) => v - Math.floor(v);
const SPARK_CORE = css(SPARK, 14);

/** A spark as a short pen flick along its flight (as the particles' are): fat at the head, trailing to a point behind it. */
function streak(g: CanvasRenderingContext2D, x: number, y: number, vx: number, vy: number, w: number) {
  const tx = x - vx * 0.03;
  const ty = y - vy * 0.03;
  const len = Math.hypot(x - tx, y - ty) || 1;
  const nx = (-(y - ty) / len) * w * 0.5;
  const ny = ((x - tx) / len) * w * 0.5;
  g.fillStyle = SPARK_CORE;
  g.beginPath();
  g.moveTo(x + nx, y + ny);
  g.lineTo(x + (x - tx) * 0.15, y + (y - ty) * 0.15);
  g.lineTo(x - nx, y - ny);
  g.lineTo(tx, ty);
  g.closePath();
  g.fill();
}

/** One live runner's build-up: the plume over it on the background, sparks, embers and heat on the emissive layer. */
export function drawBuildUp(rc: RC, r: Runner): void {
  const tier = TIERS[tierOf(r.items.hits)];
  if (!tier.puffs) return;
  const b = r.body;
  const f = poseFrame(rc);
  const x = b.x + b.w / 2;
  const feet = b.y + b.h;
  // Over the head, hats and all: a plume that starts inside the figure is hidden behind it.
  plume(rc.bg, x, b.y - 5, f, r.slot, tier);
  // Sparks spit off the body's sides and fall back within a body's height of it.
  for (let i = 0; i < tier.sparks; i++) {
    const v = f / SPARK_LIFE + i / tier.sparks + r.slot * 0.29;
    const u = frac(v);
    const n = Math.floor(v);
    const side = hash2(i, n, 91) < 0.5 ? -1 : 1;
    const t = u * (SPARK_LIFE / 60);
    const vx = side * (40 + 30 * hash2(i, n, 92));
    const vy = -(70 + 40 * hash2(i, n, 94));
    const sx = x + side * b.w * 0.45 + vx * t;
    const sy = b.y + 6 + 8 * hash2(i, n, 93) + vy * t + 300 * t * t;
    streak(rc.g, sx, sy, vx, vy + 600 * t, 1.1 * (1 - u * 0.5));
    glowDot(rc.g, sx, sy, 1.8, SPARK, 0.6, 0.3);
  }
  // Embers wink on and off at the feet, where the heat is.
  for (let i = 0; i < tier.embers; i++) {
    const v = f / EMBER_LIFE + i / tier.embers + r.slot * 0.41;
    const u = frac(v);
    const n = Math.floor(v);
    const ex = x + (hash2(i, n, 95) - 0.5) * b.w * 1.1;
    glowDot(rc.g, ex, feet - 1 - u * 5, 1.7 * Math.sin(u * Math.PI), EMBER, 0.9, 0.4);
  }
  if (tier.heat) {
    // The feet run hot: a low glow under the body that flickers, never over the player's colour.
    const a = tier.heat * (0.85 + 0.15 * Math.sin(f * 0.22 + r.slot));
    glowDot(rc.g, x, feet - 1, 7 + tier.heat * 6, HEAT, a, 0.3);
  }
}

/** Lobes of a puff (offset across and up, and radius, as shares of the puff's): a scalloped cloud, not a ball. */
const LOBES = [
  [0, 0, 1],
  [-0.62, 0.18, 0.72],
  [0.6, 0.22, 0.68],
  [0.1, -0.5, 0.7],
] as const;

/**
 * The smoke off a runner's head: scalloped puffs that swell as they rise straight up, then shrink away (comic puffs
 * never fade through alpha), drawn in three passes over every puff at once (a rim in a dark of the smoke, its shadow,
 * its lit face up-left) so they merge into one cut-out plume.
 */
function plume(g: CanvasRenderingContext2D, x: number, y: number, f: number, slot: number, t: Tier) {
  const smoke: HSL = { h: 24, s: 6, l: t.l };
  const puffs: [number, number, number][] = [];
  for (let i = 0; i < t.puffs; i++) {
    const v = f / PUFF_LIFE + i / t.puffs + slot * 0.37;
    const u = frac(v);
    const n = Math.floor(v);
    const r = t.size * (0.6 + u * 0.7) * Math.min(1, (1 - u) * 4);
    // Straight up from its own head, a little wobble and no lean, so two plumes side by side stay two.
    const drift = (hash2(i, n, 96) - 0.5) * 1.6 + Math.sin(u * 6 + i * 2) * 0.8;
    puffs.push([x + drift, y - u * t.rise, r]);
  }
  const pass = (color: string, grow: number, dx: number, dy: number, shrink: number) => {
    g.fillStyle = color;
    g.beginPath();
    for (const [px, py, r] of puffs)
      for (const [ox, oy, k] of LOBES) {
        const cx = px + (ox + dx) * r;
        const cy = py + (oy + dy) * r;
        const rr = r * k * shrink + grow;
        g.moveTo(cx + rr, cy);
        g.arc(cx, cy, rr, 0, Math.PI * 2);
      }
    g.fill();
  };
  pass(css(smoke, -Math.min(smoke.l * 0.62, 40), 1, 6), 0.6, 0, 0, 1);
  pass(css(smoke, -11, 1, -4), 0, 0, 0, 1);
  pass(css(smoke, 7), 0, -0.2, -0.22, 0.6);
}
