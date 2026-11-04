import type { P } from '../../ink';
import { toonEyes } from '../faces';
import { type D, type KindArt, poly, spot, Y } from '../kit';

/**
 * The spiked turtle king (docs/CHARACTERS.md → The spiked turtle king): the bulkiest of the cast, upright,
 * a riveted shell humped behind him with bolt spikes standing out of it, two horns, a red mane, a snout out
 * front and a paper crown. The shell is the player's colour; the rest is his own. A rendered kind draws from
 * its frames (src/render/cast/sprites/king/); this is what shows before they load, and on the hand-drawn sheets.
 */

const SKIN = '#e8b23c';
const SKIN_SH = '#bb8a1c';
const BELLY = '#e9d29a';
const BONE = '#efe2c0';
const MANE = '#d9502e';

/** The shell's spikes, as the outline draws them: base, tip, base. */
const SPIKES: readonly (readonly [number, number])[][] = [
  [
    [-0.18, -0.86],
    [-0.32, -1.12],
    [-0.36, -0.84],
  ],
  [
    [-0.42, -0.82],
    [-0.7, -1],
    [-0.54, -0.68],
  ],
  [
    [-0.6, -0.6],
    [-0.86, -0.6],
    [-0.62, -0.44],
  ],
  [
    [-0.62, -0.36],
    [-0.86, -0.26],
    [-0.6, -0.2],
  ],
];

const at = (d: D, x: number, u: number): P => ({ x: d.bx(u) + d.f * d.W * x, y: Y(d, u) });

export const art: KindArt = {
  size: [0.96, 1.02],
  outline:
    'M 0.3 0 C 0.42 -0.02 0.46 -0.16 0.42 -0.3 C 0.4 -0.42 0.38 -0.5 0.36 -0.56 L 0.6 -0.58 C 0.68 -0.62 0.68 -0.74 0.6 -0.78 L 0.36 -0.8 L 0.34 -0.86 L 0.48 -1.14 L 0.24 -0.9 L 0.12 -0.96 L 0.06 -0.9 L -0.04 -1.12 L -0.08 -0.88 ' +
    'L -0.18 -0.86 L -0.32 -1.12 L -0.36 -0.84 L -0.42 -0.82 L -0.7 -1 L -0.54 -0.68 L -0.6 -0.6 L -0.86 -0.6 L -0.62 -0.44 L -0.62 -0.36 L -0.86 -0.26 L -0.6 -0.2 ' +
    'C -0.6 -0.12 -0.56 -0.1 -0.5 -0.08 L -0.72 -0.02 L -0.3 0 Z',
  lift: 2.2,
  feet: 'boot',
  boots: [SKIN, SKIN_SH],
  arms: 'mitten',
  hands: 'paint',
  fill: 'player',
  faceX: 0.22,
  // A heavy stomp: a small lift on each step and the shoulders rolling with it, upright.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.5, rot: Math.sin(g.ph) * 0.05, pivot: 0, upright: 0.5 } : {}),
  paintFace: (d) => toonEyes(d, 0.76, 0.07, 0.8, '#c9473f'),
  print: (d) => {
    // The front of him is skin, the shell humped behind it in the player's colour, the cream rim between.
    poly(d.s, [at(d, 0.02, 1.1), at(d, 0.9, 1.1), at(d, 0.9, -0.1), at(d, -0.36, -0.1), at(d, -0.3, 0.3), at(d, -0.16, 0.65)], SKIN);
    poly(
      d.s,
      [at(d, 0.02, 1.1), at(d, -0.16, 0.65), at(d, -0.3, 0.3), at(d, -0.36, -0.1), at(d, -0.27, -0.1), at(d, -0.21, 0.3), at(d, -0.07, 0.65), at(d, 0.11, 1.1)],
      BONE,
    );
    // The banded belly, and the mane on the back of his head.
    spot(d.s, d.bx(0.3) + d.f * d.W * 0.24, Y(d, 0.3), d.W * 0.15, d.H * 0.18, d.sd, BELLY, 0.08);
    spot(d.s, d.bx(0.9) + d.f * d.W * 0.02, Y(d, 0.88), d.W * 0.14, d.H * 0.12, d.sd + 1, MANE, 0.3);
    for (const [base0, tip, base1] of SPIKES) poly(d.s, [at(d, base0[0], -base0[1]), at(d, tip[0], -tip[1]), at(d, base1[0], -base1[1])], BONE);
    // The two horns.
    poly(d.s, [at(d, 0.34, 0.86), at(d, 0.48, 1.14), at(d, 0.26, 0.9)], BONE);
    poly(d.s, [at(d, -0.08, 0.88), at(d, -0.04, 1.12), at(d, 0.04, 0.9)], BONE);
  },
  front: (d) => {
    // The paper crown between his horns, in a light tone of the player's colour.
    const y0 = Y(d, 0.9);
    const pts: P[] = [];
    const xs = [0.06, 0.1, 0.14, 0.18, 0.22, 0.26];
    pts.push(at(d, 0.06, 0.88));
    xs.forEach((x, i) => pts.push({ x: d.bx(1) + d.f * d.W * x, y: i % 2 ? y0 - 1.1 : y0 - 3 }));
    pts.push(at(d, 0.26, 0.88));
    poly(d.s, pts, d.lk.playerHi);
  },
  snout: (d) => {
    // Two fangs out of the top jaw.
    for (const x of [0.46, 0.56]) poly(d.s, [at(d, x, 0.6), at(d, x + 0.04, 0.6), at(d, x + 0.02, 0.54)], '#fbf8f2');
  },
  parts: ['shard', 'shard', 'shard'],
};
