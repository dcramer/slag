import { type D, type KindArt, poly, tonedOval, Y } from '../kit';
import { pair } from '../faces';
import { line } from '../../ink';

/**
 * The animatronic bear (docs/characters/bear.md): a stocky upright bear, a big round head with two round ears far out
 * on its sides and a top hat standing between them with background on each side, a big muzzle with the jaw hung open, a big bow tie, a big
 * round belly with a coin slot, and a shower head on its hose held up to his mouth like a microphone. The fur is the
 * player's colour, the belly and muzzle a light of it; the hat, bow tie and shower head are neutrals. A rendered kind
 * draws from its frames (src/render/cast/sprites/bear/); this is what shows before they load, and on the hand-drawn
 * sheets.
 */

const HAT = '#4a4652';
const METAL = '#a4a6a8';
const METAL_SH = '#7c828a';

/** The top hat's crown and brim, the big bow tie under the chin, and the small coin slot, over the fur. */
function costume(d: D) {
  const x = (u: number) => d.f * d.W * u;
  const crown = [
    { x: x(-0.07), y: Y(d, 0.81) },
    { x: x(0.17), y: Y(d, 0.81) },
    { x: x(0.17), y: Y(d, 0.84) },
    { x: x(0.13), y: Y(d, 0.84) },
    { x: x(0.13), y: Y(d, 1) },
    { x: x(-0.03), y: Y(d, 1) },
    { x: x(-0.03), y: Y(d, 0.84) },
    { x: x(-0.07), y: Y(d, 0.84) },
  ];
  poly(d.s, crown, HAT);
  const by = Y(d, 0.53);
  for (const sd of [-1, 1])
    poly(
      d.s,
      [
        { x: x(0.12), y: by },
        { x: x(0.12 + sd * 0.16), y: by - 1 },
        { x: x(0.12 + sd * 0.16), y: by + 1 },
      ],
      HAT,
    );
  poly(
    d.s,
    [
      { x: x(0.1), y: Y(d, 0.38) },
      { x: x(0.14), y: Y(d, 0.38) },
      { x: x(0.14), y: Y(d, 0.24) },
      { x: x(0.1), y: Y(d, 0.24) },
    ],
    METAL_SH,
  );
}

export const art: KindArt = {
  size: [1, 1],
  // The hat stands up out of the middle of the crown with a notch of background each side of it down to the head,
  // the round ears out on the corners; the muzzle bulges out front, the belly is big and round over two short legs.
  outline:
    'M -0.03 -1 L 0.13 -1 L 0.13 -0.84 L 0.17 -0.84 L 0.17 -0.81 C 0.2 -0.8 0.22 -0.8 0.24 -0.8 C 0.22 -0.88 0.3 -0.93 0.36 -0.91 C 0.43 -0.88 0.44 -0.81 0.38 -0.77 C 0.42 -0.72 0.44 -0.66 0.46 -0.62 C 0.48 -0.56 0.42 -0.52 0.34 -0.52 C 0.36 -0.48 0.4 -0.42 0.4 -0.34 C 0.42 -0.2 0.36 -0.12 0.28 -0.1 L 0.26 0 L 0.06 0 L 0.06 -0.08 L -0.04 -0.08 L -0.04 0 L -0.26 0 L -0.28 -0.12 C -0.4 -0.16 -0.44 -0.28 -0.42 -0.4 C -0.42 -0.48 -0.36 -0.52 -0.3 -0.54 C -0.38 -0.6 -0.38 -0.72 -0.32 -0.78 C -0.4 -0.8 -0.4 -0.9 -0.32 -0.92 C -0.24 -0.93 -0.18 -0.88 -0.18 -0.81 C -0.14 -0.81 -0.1 -0.81 -0.07 -0.81 L -0.07 -0.84 L -0.03 -0.84 Z',
  lift: 1,
  feet: 'paw',
  arms: 'mitten',
  hands: 'body',
  fill: 'player',
  faceX: 0.16,
  // The stiff toy's walk: no bounce in the knees, a jerky rock from side to side on each step.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.3, rot: Math.sign(Math.sin(g.ph)) * 0.04, pivot: 0.1, upright: 0.8 } : {}),
  paintFace: (d) => pair(d, 0.7, 0.09, 0.62),
  print: (d) => {
    // The belly, the muzzle and the ears' insides: a light of the fur.
    tonedOval(d.s, d.f * d.W * 0.06, Y(d, 0.3), d.W * 0.24, d.H * 0.17, 14, d.lk.playerHi, d.lk.playerHi, d.lk.ink, 0, 0, 0);
    tonedOval(d.s, d.f * d.W * 0.3, Y(d, 0.6), d.W * 0.14, d.H * 0.065, 12, d.lk.playerHi, d.lk.playerHi, d.lk.ink, 0, 0, 0);
    // The jaw hung open under the muzzle, the animatronic's dark mouth.
    tonedOval(d.s, d.f * d.W * 0.3, Y(d, 0.57), d.W * 0.09, d.H * 0.03, 10, d.lk.ink, d.lk.ink, d.lk.ink, 0, 0, 0);
    for (const u of [-0.32, 0.36]) tonedOval(d.s, d.f * d.W * u, Y(d, 0.84), d.W * 0.05, d.H * 0.04, 8, d.lk.playerHi, d.lk.playerHi, d.lk.ink, 0, 0, 0);
  },
  front: (d) => costume(d),
  tool: (d, hx, hy) => {
    // The shower head held up in his fist like a microphone, a short stub of hose under the fist.
    const tx = hx + d.f * 0.5;
    const ty = hy - 2.6;
    d.s.fillStyle = d.lk.ink;
    line(d.s, hx, hy + 0.6, hx + d.f * 0.2 + d.wob * 0.2, hy + 2, { w: 1.1, seed: 5, taper: [0, 0.3], press: 0 });
    line(d.s, hx, hy + 0.8, tx, ty, { w: 1.6, seed: 3, taper: [0, 0], press: 0 });
    d.s.fillStyle = METAL;
    line(d.s, hx, hy + 0.8, tx, ty, { w: 0.8, seed: 3, taper: [0, 0], press: 0 });
    tonedOval(d.s, tx, ty - 0.6, 1.2, 1.2, 9, METAL, METAL_SH, d.lk.ink, 0.3, 0.5 * d.k, 0.3);
  },
  parts: ['shard', 'shard'],
};
