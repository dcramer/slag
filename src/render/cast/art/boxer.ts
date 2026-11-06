import { type D, type KindArt, Y, oval, poly, tonedOval } from '../kit';
import { sideEye } from '../faces';
import { line } from '../../ink';

/**
 * The tiny boxer (docs/characters/boxer.md): side on, small and wiry, upright on his toes, two huge round oven-mitt
 * gloves held out ahead of his face in a high guard, one above the other, with background between them and his face;
 * spiky dark hair, a tank top and baggy shorts, a tea towel round his neck. The gloves are the player's colour; the
 * hair, top and shorts a charcoal, the tape grey, the towel pale. A rendered kind draws from its frames
 * (src/render/cast/sprites/boxer/); this is what shows before they load, and on the hand-drawn sheets.
 */

const CLOTH: [string, string] = ['#3c3c42', '#2c2c32'];
const SKIN: [string, string] = ['#e3a773', '#c3865a'];
const TAPE = '#8c8e8a';
const TOWEL = '#ece6c8';

/** Hair, face, tank top and shorts over the body's fill, so the only colour on him is the gloves'. */
function costume(d: D) {
  const x = (u: number) => d.f * d.W * u;
  // Tank top and shorts, one charcoal from the neck down.
  poly(
    d.s,
    [
      { x: x(-0.2), y: Y(d, 0.6) },
      { x: x(0.06), y: Y(d, 0.6) },
      { x: x(0.09), y: Y(d, 0.4) },
      { x: x(0.14), y: Y(d, 0.06) },
      { x: x(-0.3), y: Y(d, 0.06) },
      { x: x(-0.25), y: Y(d, 0.38) },
    ],
    CLOTH[0],
  );
  // The face, then the spiky hair over the crown and the back of the head.
  tonedOval(d.s, x(-0.04), Y(d, 0.77), d.W * 0.16, d.H * 0.14, 12, SKIN[0], SKIN[1], d.lk.ink, 0, 0, 0);
  poly(
    d.s,
    [
      { x: x(-0.3), y: Y(d, 0.92) },
      { x: x(-0.22), y: Y(d, 0.96) },
      { x: x(-0.06), y: Y(d, 1) },
      { x: x(0.08), y: Y(d, 0.97) },
      { x: x(0.16), y: Y(d, 0.88) },
      { x: x(0.06), y: Y(d, 0.86) },
      { x: x(-0.12), y: Y(d, 0.83) },
      { x: x(-0.16), y: Y(d, 0.66) },
      { x: x(-0.3), y: Y(d, 0.7) },
    ],
    CLOTH[0],
  );
  // The tea towel knotted at the back of his neck.
  poly(d.s, oval(x(-0.12), Y(d, 0.6), d.W * 0.16, d.H * 0.035, 10), TOWEL);
}

/** The two gloves out ahead of his face, one above the other, each on a short arm taped at the wrist. */
function gloves(d: D) {
  const x = (u: number) => d.f * d.W * u;
  const r = d.H * 0.13;
  const sh = { x: x(-0.02), y: Y(d, 0.56) };
  for (const [u, v, k] of [
    [0.38, 0.56, 1],
    [0.42, 0.8, 0],
  ] as const) {
    const g = { x: x(u), y: Y(d, v) };
    const wr = { x: g.x - d.f * r * 0.9, y: g.y + r * 0.2 };
    d.s.fillStyle = d.lk.ink;
    line(d.s, sh.x, sh.y, wr.x, wr.y, { w: 1.5, seed: 4 + k, taper: [0, 0], press: 0 });
    d.s.fillStyle = SKIN[0];
    line(d.s, sh.x, sh.y, wr.x, wr.y, { w: 0.8, seed: 4 + k, taper: [0, 0], press: 0 });
    poly(d.s, oval(wr.x, wr.y, 0.6, 0.8, 8), TAPE);
    tonedOval(d.s, g.x, g.y, r, r * 0.95, 14, d.lk.player, d.lk.playerShade, d.lk.ink, 0.35, 0.7 * d.k, 0.4);
  }
}

export const art: KindArt = {
  size: [0.82, 0.92],
  // A round head with spikes over a narrow torso and baggy shorts; the gloves stand clear of it, ahead of the face.
  outline:
    'M -0.06 -1 L 0.02 -0.95 L 0.1 -0.99 L 0.11 -0.91 L 0.19 -0.9 L 0.13 -0.84 C 0.15 -0.74 0.12 -0.66 0.05 -0.63 L 0.06 -0.6 C 0.1 -0.54 0.1 -0.44 0.08 -0.4 C 0.14 -0.3 0.16 -0.16 0.14 -0.06 L -0.04 -0.04 L -0.08 -0.1 L -0.14 -0.04 L -0.3 -0.06 C -0.32 -0.18 -0.3 -0.3 -0.24 -0.38 C -0.26 -0.46 -0.26 -0.56 -0.2 -0.62 C -0.3 -0.64 -0.34 -0.74 -0.32 -0.84 L -0.38 -0.87 L -0.3 -0.92 L -0.31 -0.99 L -0.2 -0.96 Z',
  lift: 2.6,
  feet: 'boot',
  arms: 'none',
  fill: 'player',
  faceX: 0.06,
  // Always bouncing on his toes, and a jog with the guard up.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.6, upright: 0.8 } : { hop: Math.abs(Math.sin(g.t * 7)) * 0.35 }),
  paintFace: (d) => sideEye(d, 0.78, d.f * d.W * 0.04, 0.6),
  print: (d) => costume(d),
  boots: ['#8c8e8a', '#6e706c'],
  front: (d) => gloves(d),
  parts: ['shard', 'shard'],
};
