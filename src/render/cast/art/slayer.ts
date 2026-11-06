import type { KindArt, D } from '../kit';
import { STEEL, STEEL_SH, toned, WOOD, WOOD_SH, Y } from '../kit';
import { pair } from '../faces';

/**
 * The white-haired monster slayer (docs/characters/slayer.md): heavy-set and hunched low in a wide guard, his head
 * forward of his shoulders, a long straight sword held level out ahead of him, and two blades crossed on his back.
 * A rendered kind draws from its frames (src/render/cast/sprites/); this is what shows before they load, and on the
 * hand-drawn sheets.
 */

const GRIP = '#6a4428';

/** A straight bar from (x0, y0) to (x1, y1), `w` wide, in two tones. */
function bar(d: D, x0: number, y0: number, x1: number, y1: number, w: number, lit: string, sh: string) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * (w / 2);
  const ny = (dx / l) * (w / 2);
  toned(
    d.s,
    [
      { x: x0 + nx, y: y0 + ny },
      { x: x1 + nx, y: y1 + ny },
      { x: x1 - nx, y: y1 - ny },
      { x: x0 - nx, y: y0 - ny },
    ],
    lit,
    sh,
    d.lk.ink,
    0.3,
    0.55 * d.k,
    0.3,
  );
}

/**
 * The two blades on his back, crossed in an X behind his back shoulder: the steel sword's hilt leaning back, the
 * umbrella's wooden one leaning toward his head and stopping short of it, each a bold cross. Side by side they read
 * as horns or a headband's tails.
 */
function hilts(d: D) {
  const f = d.f;
  const x = d.bx(0.86) - f * d.W * 0.2;
  const y = Y(d, 0.78);
  for (const [lean, lit, sh] of [
    [-0.55, STEEL, STEEL_SH],
    [0.4, WOOD, WOOD_SH],
  ] as const) {
    const tx = x + f * lean * 7;
    const ty = y - 7.6;
    bar(d, x - f * lean * 3, y + 4, tx, ty, 0.9, lit, sh);
    // The cross-guard, square across the hilt two thirds of the way up.
    const cx = x + f * lean * 4.6;
    const cy = y - 5;
    const ux = (f * lean * 7) / 12.6;
    const uy = -7.6 / 12.6;
    bar(d, cx + uy * 1.4, cy - ux * 1.4, cx - uy * 1.4, cy + ux * 1.4, 0.7, lit, sh);
  }
}

/** The long sword, level out ahead of him from both fists, its point forward. */
function sword(d: D, hx: number, hy: number) {
  const f = d.f;
  const len = d.pose === 'air' ? 5.4 : 7.6;
  bar(d, hx - f * 2.2, hy, hx, hy, 1, GRIP, GRIP);
  bar(d, hx, hy - 1.4, hx, hy + 1.4, 0.7, STEEL, STEEL_SH);
  toned(
    d.s,
    [
      { x: hx, y: hy - 0.6 },
      { x: hx + f * (len - 1.2), y: hy - 0.6 },
      { x: hx + f * len, y: hy },
      { x: hx + f * (len - 1.2), y: hy + 0.6 },
      { x: hx, y: hy + 0.6 },
    ],
    STEEL,
    STEEL_SH,
    d.lk.ink,
    0.3,
    0.55 * d.k,
    0.3,
  );
}

export const art: KindArt = {
  size: [1.04, 0.9],
  // Hunched: a broad back high behind, the head low and forward of the shoulders, wide at the hips over the crouch.
  outline:
    'M 0.22 -0.98 C 0.4 -0.98 0.48 -0.86 0.46 -0.72 C 0.44 -0.62 0.36 -0.58 0.3 -0.56 C 0.4 -0.46 0.46 -0.3 0.44 -0.14 C 0.42 -0.04 0.34 0 0.2 0 L -0.3 0 C -0.44 0 -0.5 -0.12 -0.5 -0.3 C -0.5 -0.58 -0.4 -0.86 -0.14 -0.9 C -0.02 -0.92 0.06 -0.98 0.22 -0.98 Z',
  lift: 2.4,
  feet: 'boot',
  arms: 'mitten',
  hands: 'leather',
  fill: 'player',
  faceX: 0.24,
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.4, bend: 0.08 + g.run * 0.06, upright: 0.6 } : {}),
  paintFace: (d) => pair(d, 0.8, 0.12, 0.7),
  back: hilts,
  tool: sword,
  parts: ['shard', 'shard'],
};
