import { brows, eye, mouthMark } from '../faces';
import { band, type D, type KindArt, oval, spot, toned, tonedOval, Y } from '../kit';

/**
 * The round Slavic warrior (docs/characters/warrior.md), side on: a huge round belly out in front on short legs,
 * a round bald head on top with a big nose and a bushy moustache sticking out, a small dented iron pot for a
 * helmet with a tall spike on top, and a broad straight sword held out level in front. A rendered kind draws from
 * its frames (src/render/cast/sprites/warrior/); this is what shows before they load, and on the hand-drawn sheets.
 */

const SKIN = '#efbb8b';
const SKIN_SH = '#d39a6c';
const IRON = '#8e949a';
const IRON_SH = '#6c7278';
const MOUS = '#5e4230';
const LEATHER = '#6e4628';
const LEATHER_SH = '#52331d';
const BLADE = '#d2d5da';
const BLADE_SH = '#a4a8ae';

/** The pot on his crown: a low dome narrower than the head, its rim a step, and a tall spike on top. */
function pot(d: D) {
  const W = d.W;
  const f = d.f;
  const x = d.bx(0.95) + f * W * 0.03;
  const at = (u: number, v: number) => ({ x: x + f * W * u, y: Y(d, v) });
  toned(d.s, [at(-0.03, 1.02), at(-0.015, 1.2), at(0.035, 1.02)], IRON, IRON_SH, d.lk.ink, 0.25, 0.5 * d.k, 0.2);
  toned(d.s, [at(-0.22, 0.9), at(-0.2, 0.97), at(-0.1, 1.03), at(0.04, 1.04), at(0.16, 0.99), at(0.22, 0.9)], IRON, IRON_SH, d.lk.ink, 0.3, 0.7 * d.k, 0.4);
  toned(d.s, [at(-0.25, 0.88), at(0.25, 0.88), at(0.25, 0.91), at(-0.25, 0.91)], IRON, IRON_SH, d.lk.ink, 0.25, 0.5 * d.k, 0.2);
}

/** The big round nose and the bushy moustache under it, both out past the face's line. */
function snout(d: D) {
  const W = d.W;
  const f = d.f;
  const x = d.bx(0.8) + f * W * 0.27;
  tonedOval(d.s, x, Y(d, 0.79), 1.1, 1, 10, SKIN, SKIN_SH, d.lk.ink, 0.25, 0.5 * d.k, 0.3);
  toned(d.s, oval(x - f * 0.6, Y(d, 0.73), 1.9, 0.75, 10, f * 0.25), MOUS, MOUS, d.lk.ink, 0.2, 0.45 * d.k, 0);
}

/** The sword: a broad straight blade held out level in front from the fist, a crossguard at the fist. */
function sword(d: D, hx: number, hy: number) {
  const f = d.f;
  const at = (u: number, v: number) => ({ x: hx + f * u, y: hy + v });
  toned(d.s, [at(0.6, -0.55), at(5.6, -0.55), at(6.6, 0), at(5.6, 0.55), at(0.6, 0.55)], BLADE, BLADE_SH, d.lk.ink, 0.25, 0.5 * d.k, 0.3);
  toned(d.s, [at(0.3, -1.5), at(0.9, -1.5), at(0.9, 1.5), at(0.3, 1.5)], BLADE, BLADE_SH, d.lk.ink, 0.25, 0.5 * d.k, 0.2);
}

export const art: KindArt = {
  size: [0.9, 1],
  // The belly is the outline: a ball bulging out in front, wider than the head standing on it.
  outline:
    'M 0.04 -1 C 0.2 -1 0.28 -0.9 0.28 -0.78 C 0.28 -0.7 0.24 -0.65 0.2 -0.62 C 0.42 -0.58 0.52 -0.44 0.52 -0.3 C 0.52 -0.12 0.4 0 0.18 0 L -0.26 0 C -0.4 0 -0.46 -0.14 -0.44 -0.3 C -0.42 -0.48 -0.34 -0.58 -0.18 -0.62 C -0.22 -0.66 -0.24 -0.72 -0.22 -0.8 C -0.2 -0.94 -0.1 -1 0.04 -1 Z',
  lift: 2.2,
  feet: 'boot',
  boots: [LEATHER, LEATHER_SH],
  arms: 'mitten',
  hands: 'body',
  fill: 'player',
  faceX: 0.1,
  // A heavy, proud waddle.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.5, upright: 0.6 } : {}),
  paintFace: (d) => {
    const x = d.bx(0.84) + d.f * d.W * 0.14;
    const y = Y(d, 0.85);
    eye(d, x, y, 0.75);
    brows(d, [x], y, 0.8);
    mouthMark(d, x + d.f * 0.6, Y(d, 0.68), 1.2, 'none');
  },
  print: (d) => {
    // The bald head in skin, the belt under the belly, a darker patch sewn on it.
    spot(d.s, d.bx(0.8) + d.f * d.W * 0.03, Y(d, 0.8), d.W * 0.25, d.H * 0.19, d.sd, SKIN, 0.05);
    band(d, 0.18, 0.24, LEATHER, 0.2);
    spot(d.s, d.f * d.W * 0.28, Y(d, 0.36), 1.3, 1.2, d.sd + 3, d.lk.playerDark, 0.1);
  },
  front: pot,
  snout,
  tool: sword,
  parts: ['shard', 'shard'],
};
