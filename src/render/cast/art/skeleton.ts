import { type D, type KindArt, mark, oval, poly, tonedOval, Y } from '../kit';
import { squint } from '../faces';

/**
 * The punny skeleton in the hoodie (docs/characters/skeleton.md): short and stocky, a huge round bone skull with a
 * fixed wide grin and two black sockets, the far one lit, a moulding seam over the crown (he's a plastic Halloween
 * decoration come loose), a thick grey fur hood down round his neck, a baggy hoodie with a ragged hem and his hands
 * in its pockets, dark shorts, thin bone legs and fluffy slippers. The hoodie is the player's colour; bone, fur,
 * shorts and slippers are neutrals. A rendered kind draws from its frames (src/render/cast/sprites/skeleton/); this
 * is what shows before they load, and on the hand-drawn sheets.
 */

const BONE: [string, string] = ['#e6dcc2', '#c4b498'];
const TEETH = '#fdfbf4';
const FUR: [string, string] = ['#b6b4ae', '#8e8b84'];
const SHORTS = '#4a4e56';
const GLOW = '#a6ecdc';
const INK = '#1c1620';

/** The fur hood round his neck, the skull over it, the grin, and the shorts under the hem. */
function costume(d: D) {
  const x = (u: number) => d.f * d.W * u;
  poly(
    d.s,
    [
      { x: x(-0.4), y: Y(d, 0.11) },
      { x: x(0.36), y: Y(d, 0.11) },
      { x: x(0.34), y: Y(d, 0) },
      { x: x(-0.36), y: Y(d, 0) },
    ],
    SHORTS,
  );
  tonedOval(d.s, x(-0.04), Y(d, 0.5), d.W * 0.44, d.H * 0.07, 14, FUR[0], FUR[1], d.lk.ink, 0, 0, 0);
  tonedOval(d.s, x(0.02), Y(d, 0.75), d.W * 0.4, d.H * 0.21, 16, BONE[0], BONE[1], d.lk.ink, 0.3, 0.6 * d.k, 0.4);
  // The moulding seam over the crown, where the plastic halves meet.
  mark(
    d.s,
    d.lk.ink,
    [
      { x: x(0.04), y: Y(d, 0.96) },
      { x: x(-0.12), y: Y(d, 0.9) },
      { x: x(-0.22), y: Y(d, 0.8) },
    ],
    0.35,
    d.sd,
    [0.2, 0.2],
  );
  // The grin: a wide white band across the front of the skull, a tooth line or two at card scale.
  const gx = x(0.1);
  const gy = Y(d, 0.63);
  const band = oval(gx, gy, d.W * 0.24, d.H * 0.045, 12);
  // A dark rim round the teeth: a thin line round them was lost at play scale.
  poly(d.s, oval(gx, gy, d.W * 0.24 + 0.5, d.H * 0.045 + 0.5, 12), INK);
  poly(d.s, band, TEETH);
  if (d.detail)
    for (const u of [-0.1, 0.02, 0.14])
      mark(
        d.s,
        d.lk.ink,
        [
          { x: gx + x(u), y: gy - d.H * 0.04 },
          { x: gx + x(u), y: gy + d.H * 0.04 },
        ],
        0.3,
        d.sd,
        [0, 0],
      );
}

/** Two black sockets, a pinprick of light in the near one and a cool glow in the far one; a wink on a blink. */
function sockets(d: D) {
  const y = Y(d, 0.76);
  const near = d.f * d.W * -0.06;
  const far = d.f * d.W * 0.22;
  if (d.m === 'cheer') {
    squint(d, near, y, 1.2);
    squint(d, far, y, 0.9);
    return;
  }
  const wide = d.m === 'fall' ? 1.15 : 1;
  const tall = d.m === 'run' ? 0.85 : wide;
  poly(d.s, oval(near, y, 1.35 * wide, 1.4 * tall, 10), INK);
  poly(d.s, oval(far, y, 0.95 * wide, 1.3 * tall, 10), INK);
  const p = d.m === 'fall' ? 0.25 : 0.38;
  poly(d.s, oval(near + d.f * 0.2, y, p, p, 6), TEETH);
  poly(d.s, oval(far + d.f * 0.1, y, p * 1.4, p * 1.4, 7), GLOW);
  // The nose's dark triangle, point up, between and under them.
  const nx = (near + far) / 2;
  poly(
    d.s,
    [
      { x: nx, y: y + 0.9 },
      { x: nx + 0.55, y: y + 2 },
      { x: nx - 0.55, y: y + 2 },
    ],
    INK,
  );
}

export const art: KindArt = {
  size: [0.94, 0.98],
  // A huge round skull, wider than the hood under it; the fur collar standing out
  // at the neck; a baggy hoodie with a ragged hem, no arms out (his hands are in its pockets); the shorts.
  outline:
    'M 0.03 -1 C 0.3 -0.99 0.45 -0.82 0.43 -0.66 C 0.42 -0.58 0.35 -0.54 0.26 -0.53 L 0.36 -0.52 C 0.43 -0.47 0.43 -0.4 0.38 -0.36 C 0.45 -0.28 0.45 -0.18 0.38 -0.13 L 0.3 -0.09 L 0.36 0 L -0.36 0 L -0.32 -0.09 L -0.4 -0.13 C -0.48 -0.2 -0.48 -0.32 -0.42 -0.4 C -0.5 -0.46 -0.48 -0.54 -0.36 -0.57 C -0.44 -0.68 -0.42 -0.86 -0.2 -0.95 C -0.13 -0.99 -0.05 -1 0.03 -1 Z',
  lift: 2.4,
  feet: 'boot',
  boots: ['#c8c6c0', '#a09d96'],
  arms: 'none',
  fill: 'player',
  faceX: 0.1,
  // A lazy shuffle: a little bounce, a slouch that hardly leans into the run.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.35, rot: Math.sin(g.ph) * 0.03, pivot: 0.2, upright: 0.7 } : {}),
  paintFace: (d) => sockets(d),
  print: (d) => costume(d),
  parts: ['shard', 'shard'],
};
