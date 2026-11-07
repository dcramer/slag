import { css, type HSL } from '../core/color';
import { hash2 } from '../core/rng';
import type { Runner } from '../sim/run';
import { glowDot, poseFrame, type RC } from './kit';

/**
 * A brawl's build-up (`RunRules.buildup`, `RunnerItems.hits`) read without a number: whoever has taken hits smoulders,
 * the way a platform fighter's damage runs from white to red. One hit, a wisp off the head; two, a plume and the odd
 * spark; three, sparks and embers; four and on, a dark plume, sparks crackling off them and a body glowing with it:
 * someone a tap sends flying. Heat, so the sparks, embers and glow go emissive (docs/ART.md: glow is for hot things) and
 * the smoke is cut-out puffs on the background, as the particles' are. Stateless, a function of the frame, so a paused
 * picture shows it too; reads the runner only, and a race, which counts no hits, never smokes.
 */

/** Per stage (hits, up to the last): puffs in the plume, how high it rises (px), its lightness, sparks and embers in the air. */
const STAGES = [
  { puffs: 0, rise: 0, l: 0, sparks: 0, embers: 0 },
  { puffs: 3, rise: 12, l: 90, sparks: 0, embers: 0 },
  { puffs: 4, rise: 16, l: 84, sparks: 1, embers: 0 },
  { puffs: 5, rise: 20, l: 77, sparks: 2, embers: 1 },
  { puffs: 6, rise: 24, l: 70, sparks: 4, embers: 2 },
  { puffs: 7, rise: 28, l: 63, sparks: 6, embers: 3 },
] as const;

/** Frames a puff takes to rise and shrink away, and a spark or an ember to fly. */
const PUFF_LIFE = 50;
const SPARK_LIFE = 20;
const EMBER_LIFE = 44;

const SPARK: HSL = { h: 40, s: 100, l: 64 };
const EMBER: HSL = { h: 20, s: 100, l: 56 };
const HEAT: HSL = { h: 16, s: 100, l: 50 };

const frac = (v: number) => v - Math.floor(v);
const SPARK_CORE = css(SPARK, 22);

/** A spark as a pen flick along its flight (as the particles' are): fat at the head, trailing to a point behind it. */
function streak(g: CanvasRenderingContext2D, x: number, y: number, vx: number, vy: number, w: number) {
  const tx = x - vx * 0.035;
  const ty = y - vy * 0.035;
  const len = Math.hypot(x - tx, y - ty) || 1;
  const nx = (-(y - ty) / len) * w * 0.5;
  const ny = ((x - tx) / len) * w * 0.5;
  g.fillStyle = SPARK_CORE;
  g.beginPath();
  g.moveTo(x + nx, y + ny);
  g.lineTo(x + (x - tx) * 0.12, y + (y - ty) * 0.12);
  g.lineTo(x - nx, y - ny);
  g.lineTo(tx, ty);
  g.closePath();
  g.fill();
}

/** One live runner's build-up: the plume behind it on the background, the sparks, embers and glow on the emissive layer. */
export function drawBuildUp(rc: RC, r: Runner): void {
  const hits = r.items.hits;
  if (hits <= 0) return;
  const st = STAGES[Math.min(hits, STAGES.length - 1)];
  const b = r.body;
  const f = poseFrame(rc);
  const x = b.x + b.w / 2;
  // Over the head, hats and all: a plume that starts inside the figure is hidden behind it.
  const head = b.y - 5;
  plume(rc.bg, x, head, f, r.slot, st);
  for (let i = 0; i < st.sparks; i++) {
    const u = frac(f / SPARK_LIFE + i / st.sparks + r.slot * 0.29);
    const n = Math.floor(f / SPARK_LIFE + i / st.sparks + r.slot * 0.29);
    const side = hash2(i, n, 91) < 0.5 ? -1 : 1;
    const t = u * (SPARK_LIFE / 60);
    const vx = side * (60 + 70 * hash2(i, n, 92));
    const vy = -(110 + 60 * hash2(i, n, 94)) + 520 * t;
    const sx = x + side * b.w * 0.45 + vx * t;
    const sy = b.y + 6 + 7 * hash2(i, n, 93) - (110 + 60 * hash2(i, n, 94)) * t + 260 * t * t;
    streak(rc.g, sx, sy, vx, vy, 1.3 * (1 - u * 0.5));
    glowDot(rc.g, sx, sy, 3 * (1 - u * 0.5), SPARK, 0.7, 0.3);
  }
  for (let i = 0; i < st.embers; i++) {
    const u = frac(f / EMBER_LIFE + i / st.embers + r.slot * 0.41);
    const n = Math.floor(f / EMBER_LIFE + i / st.embers + r.slot * 0.41);
    const ex = x + (hash2(i, n, 95) - 0.5) * b.w * 1.4 + Math.sin(u * 7 + i) * 2;
    glowDot(rc.g, ex, head + 4 - u * (st.rise + 6), 2 * (1 - u * 0.7), EMBER, 0.9, 0.4);
  }
  if (hits >= 4) {
    // Running hot: a low glow through the body that flickers, brighter with every hit past four.
    const a = Math.min(0.55, 0.32 + (hits - 4) * 0.08) * (0.85 + 0.15 * Math.sin(f * 0.22 + r.slot));
    glowDot(rc.g, x, b.y + b.h * 0.55, 13 + Math.min(hits, 6), HEAT, a, 0.3);
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
 * The smoke off a runner's head: scalloped puffs that swell as they rise and lean off, then shrink away (comic puffs
 * never fade through alpha), drawn in three passes over every puff at once (a rim in a dark of the smoke, its shadow,
 * its lit face up-left) so they merge into one cut-out plume.
 */
function plume(g: CanvasRenderingContext2D, x: number, y: number, f: number, slot: number, st: (typeof STAGES)[number]) {
  const smoke: HSL = { h: 24, s: 6, l: st.l };
  const puffs: [number, number, number][] = [];
  const lean = slot & 1 ? 1 : -1;
  for (let i = 0; i < st.puffs; i++) {
    const v = f / PUFF_LIFE + i / st.puffs + slot * 0.37;
    const u = frac(v);
    const n = Math.floor(v);
    const r = (1.5 + st.puffs * 0.28) * (0.55 + u * 1.1) * Math.min(1, (1 - u) * 4);
    const drift = (hash2(i, n, 96) - 0.5) * 3 + lean * u * u * 7;
    puffs.push([x + drift, y - u * st.rise, r]);
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
