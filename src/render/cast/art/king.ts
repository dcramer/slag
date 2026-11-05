import { css, shift } from '../../../core/color';
import type { P } from '../../ink';
import { toonEyes } from '../faces';
import { type D, type KindArt, poly, spot, Y } from '../kit';

/**
 * The spiked turtle king (docs/CHARACTERS.md → The spiked turtle king), hand-inked from his drawn design:
 * side on, two shapes carry him, a smooth shell dome on his back with its rim and only three big spikes along
 * its top, and a big horned head out front with a heavy open jaw. Spikes all round read as a porcupine. His
 * skin is the player's colour, the shell a dark of it, the mane and the paper crown lights. A rendered kind draws
 * from its frames (src/render/cast/sprites/king/); this is what shows before they load, and on the hand-drawn
 * sheets.
 */

const BELLY = '#e9d29a';
const BONE = '#efe2c0';
const MOUTH = '#9a3d36';
const PLATE = '#9aa0a8';

/** The shell's spikes, as the outline draws them: base, tip, base (body units, y up negative). */
const SPIKES: readonly (readonly [number, number])[][] = [
  [
    [-0.1, -0.92],
    [-0.14, -1.08],
    [-0.24, -0.9],
  ],
  [
    [-0.28, -0.88],
    [-0.42, -1.02],
    [-0.46, -0.8],
  ],
  [
    [-0.5, -0.76],
    [-0.66, -0.82],
    [-0.6, -0.66],
  ],
];

const at = (d: D, x: number, u: number): P => ({ x: d.bx(u) + d.f * d.W * x, y: Y(d, u) });
const tri = (d: D, [a, b, c]: readonly (readonly [number, number])[], fill: string) =>
  poly(d.s, [at(d, a[0], -a[1]), at(d, b[0], -b[1]), at(d, c[0], -c[1])], fill);

export const art: KindArt = {
  size: [0.96, 1.02],
  // From the front foot: the fist, the open jaw (a notch in the outline), the snout, the two horns, the three
  // spikes on the dome, the dome down to its rim, the tail, the back foot.
  outline:
    'M 0.34 0 C 0.42 -0.04 0.42 -0.16 0.38 -0.26 C 0.44 -0.3 0.5 -0.32 0.52 -0.4 C 0.54 -0.48 0.46 -0.52 0.4 -0.5 L 0.42 -0.56 ' +
    'C 0.5 -0.56 0.6 -0.56 0.62 -0.62 L 0.46 -0.7 L 0.66 -0.74 C 0.72 -0.76 0.72 -0.86 0.62 -0.86 L 0.42 -0.88 L 0.4 -0.94 L 0.48 -1.14 L 0.3 -0.96 ' +
    'L 0.22 -1 L 0.14 -0.98 L 0.16 -1.12 L 0.04 -0.94 C -0.02 -0.92 -0.06 -0.9 -0.1 -0.92 L -0.14 -1.08 L -0.24 -0.9 L -0.28 -0.88 L -0.42 -1.02 L -0.46 -0.8 ' +
    'L -0.5 -0.76 L -0.66 -0.82 L -0.6 -0.66 C -0.72 -0.54 -0.76 -0.34 -0.7 -0.22 L -0.74 -0.16 L -0.58 -0.14 L -0.86 -0.04 L -0.5 -0.04 ' +
    'C -0.46 -0.02 -0.4 0 -0.34 0 L -0.06 0 L 0 -0.12 L 0.06 0 Z',
  lift: 2.2,
  feet: 'paw',
  arms: 'mitten',
  hands: 'body',
  fill: 'player',
  faceX: 0.36,
  // A heavy stomp: a small lift on each step and the shoulders rolling with it, upright.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.5, rot: Math.sin(g.ph) * 0.05, pivot: 0, upright: 0.5 } : {}),
  paintFace: (d) => toonEyes(d, 0.82, 0.06, 0.7, '#c9473f'),
  print: (d) => {
    // The shell dome on his back, a dark of his skin, with its patch plate; its bone rim between it and him.
    poly(
      d.s,
      [at(d, -0.02, 0.92), at(d, -1, 1.2), at(d, -1, 0.14), at(d, -0.58, 0.14), at(d, -0.3, 0.3), at(d, -0.12, 0.6), at(d, -0.04, 0.8)],
      css(shift(d.c.body, -20)),
    );
    poly(d.s, [at(d, -0.6, 0.6), at(d, -0.36, 0.7), at(d, -0.3, 0.48), at(d, -0.52, 0.4)], PLATE);
    poly(
      d.s,
      [
        at(d, -0.76, 0.2),
        at(d, -0.58, 0.14),
        at(d, -0.3, 0.3),
        at(d, -0.12, 0.6),
        at(d, -0.04, 0.8),
        at(d, -0.02, 0.92),
        at(d, 0.06, 0.9),
        at(d, 0.04, 0.78),
        at(d, -0.04, 0.58),
        at(d, -0.22, 0.24),
        at(d, -0.5, 0.08),
        at(d, -0.76, 0.12),
      ],
      BONE,
    );
    // The banded belly, the mane swept back over the top of the shell, the open jaw's mouth.
    spot(d.s, d.bx(0.3) + d.f * d.W * 0.24, Y(d, 0.3), d.W * 0.14, d.H * 0.18, d.sd, BELLY, 0.08);
    spot(d.s, d.bx(0.92) + d.f * d.W * 0.02, Y(d, 0.93), d.W * 0.12, d.H * 0.06, d.sd + 1, css(shift(d.c.body, 20)), 0.3);
    poly(d.s, [at(d, 0.62, 0.62), at(d, 0.46, 0.7), at(d, 0.66, 0.74), at(d, 0.6, 0.71), at(d, 0.5, 0.7), at(d, 0.58, 0.65)], MOUTH);
    for (const s of SPIKES) tri(d, s, BONE);
    // The two horns.
    poly(d.s, [at(d, 0.4, 0.94), at(d, 0.48, 1.14), at(d, 0.3, 0.96)], BONE);
    poly(d.s, [at(d, 0.14, 0.98), at(d, 0.16, 1.12), at(d, 0.04, 0.94)], BONE);
  },
  front: (d) => {
    // The paper crown between his horns, in a light tone of the player's colour.
    const y0 = Y(d, 0.96);
    const xs = [0.18, 0.22, 0.26, 0.3, 0.34];
    const pts: P[] = [at(d, 0.18, 0.93)];
    xs.forEach((x, i) => pts.push({ x: d.bx(1) + d.f * d.W * x, y: i % 2 ? y0 - 0.8 : y0 - 2.4 }));
    pts.push(at(d, 0.34, 0.93));
    poly(d.s, pts, d.lk.playerHi);
  },
  snout: (d) => {
    // Two fangs down from the top jaw, one up from the bottom.
    for (const x of [0.56, 0.63]) poly(d.s, [at(d, x, 0.74), at(d, x + 0.04, 0.74), at(d, x + 0.02, 0.69)], '#fbf8f2');
    poly(d.s, [at(d, 0.54, 0.64), at(d, 0.58, 0.64), at(d, 0.56, 0.69)], '#fbf8f2');
  },
  parts: ['shard', 'shard', 'shard'],
};
