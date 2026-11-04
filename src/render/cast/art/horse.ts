import { brows, eye, mouthMark } from '../faces';
import { band, type D, type KindArt, mark, poly, spot, toned, Y } from '../kit';

/**
 * The barnyard party game's horse (docs/CHARACTERS.md → Roster): upright on two legs in a cheap horse
 * costume, a head a size too big with its long pale-nosed muzzle slanting down in front and two upright ears,
 * a dark mane flat down the neck and a narrow tail, a scarf in a dark of the costume wound round its throat,
 * and a zip up its belly. A rendered kind draws from its frames (src/render/cast/sprites/); this is what shows
 * before they load, and on the hand-drawn sheets.
 */

const MUZZLE = '#e6cfae';
const MUZZLE_SH = '#c9ae8a';
const MANE = '#4a3428';
const MANE_SH = '#33241b';
const ZIP = '#9a9c98';

/** The two upright ears from the crown, the far one a little behind and shorter. */
function ears(d: D) {
  const x = d.bx(0.98);
  const W = d.W;
  const f = d.f;
  const t = d.top;
  const sway = d.wob * 0.2;
  for (const [dx, h, fill, shade] of [
    [0.06, 3.2, d.lk.playerShade, d.lk.playerDark],
    [-0.12, 3.8, d.lk.player, d.lk.playerShade],
  ] as const)
    toned(
      d.s,
      [
        { x: x + f * W * (dx - 0.09), y: t + 1.2 },
        { x: x + f * W * dx + sway, y: t - h },
        { x: x + f * W * (dx + 0.09), y: t + 1 },
      ],
      fill,
      shade,
      d.lk.ink,
      0.3,
      0.7 * d.k,
      0.3,
    );
}

/** The mane lying flat down the back of the head and neck, and the narrow tail hanging behind. */
function mane(d: D) {
  const W = d.W;
  const f = d.f;
  const sway = d.wob * 0.4;
  toned(
    d.s,
    [
      { x: d.bx(0.98) - f * W * 0.04, y: d.top + 0.4 },
      { x: d.bx(0.9) - f * W * 0.4 - sway, y: Y(d, 0.82) },
      { x: d.bx(0.7) - f * W * 0.42 - sway, y: Y(d, 0.56) },
      { x: d.bx(0.7) - f * W * 0.2, y: Y(d, 0.6) },
      { x: d.bx(0.9) - f * W * 0.14, y: Y(d, 0.88) },
    ],
    MANE,
    MANE_SH,
    d.lk.ink,
    0.3,
    0.7 * d.k,
    0.4,
  );
  const tx = -f * W * 0.34 + d.bx(0.3);
  const ty = Y(d, 0.34);
  const swing = d.p.grounded && Math.abs(d.p.vx) < 1 ? 0 : -f * 2.6;
  toned(
    d.s,
    [
      { x: tx + f * 0.5, y: ty - 0.6 },
      { x: tx - f * 1.1 + swing * 0.5, y: ty + 2.2 },
      { x: tx - f * 1.4 + swing, y: ty + 5.4 + sway },
      { x: tx - f * 0.3 + swing * 0.7, y: ty + 3.6 },
      { x: tx + f * 0.5, y: ty + 1.2 },
    ],
    MANE,
    MANE_SH,
    d.lk.ink,
    0.3,
    0.6 * d.k,
    0.3,
  );
}

export const art: KindArt = {
  size: [0.92, 1.04],
  // A big head over a small upright body, its long muzzle slanting down in front over the scarf.
  outline:
    'M -0.12 -1 C 0.06 -1 0.16 -0.94 0.28 -0.86 C 0.4 -0.78 0.52 -0.72 0.56 -0.64 C 0.6 -0.56 0.56 -0.5 0.48 -0.5 C 0.4 -0.5 0.32 -0.54 0.22 -0.6 C 0.2 -0.56 0.26 -0.5 0.28 -0.42 C 0.32 -0.28 0.3 -0.12 0.24 -0.04 C 0.2 0 0.14 0 0.1 0 L -0.18 0 C -0.3 0 -0.36 -0.12 -0.36 -0.28 C -0.36 -0.44 -0.32 -0.56 -0.28 -0.64 C -0.32 -0.76 -0.3 -0.94 -0.12 -1 Z',
  lift: 2.4,
  feet: 'boot',
  boots: [MANE, MANE_SH],
  arms: 'mitten',
  hands: 'leather',
  fill: 'player',
  faceX: 0,
  // A high-stepping prance: a big hop on every step, upright.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * (0.7 + g.run * 0.3), upright: 0.6 } : {}),
  paintFace: (d) => {
    const y = Y(d, 0.88);
    const xs = [-d.W * 0.02, d.W * 0.12];
    for (const x of xs) eye(d, d.f * x, y, 0.7);
    brows(
      d,
      xs.map((x) => d.f * x),
      y,
      0.75,
    );
  },
  print: (d) => {
    // The pale nose on the end of the muzzle, and the scarf wound round the throat in a dark of the costume.
    spot(d.s, d.f * d.W * 0.44, Y(d, 0.6), d.W * 0.17, d.H * 0.1, d.sd, MUZZLE, 0.06, d.f * 0.5);
    spot(d.s, d.f * d.W * 0.4, Y(d, 0.53), d.W * 0.12, d.H * 0.035, d.sd + 1, MUZZLE_SH, 0.05);
    band(d, 0.46, 0.58, d.lk.playerDark, d.f * 0.6);
    // The scarf's end hanging down the chest.
    poly(
      d.s,
      [
        { x: d.f * d.W * 0.02, y: Y(d, 0.48) },
        { x: d.f * d.W * 0.16, y: Y(d, 0.48) },
        { x: d.f * d.W * 0.14, y: Y(d, 0.3) },
        { x: d.f * d.W * 0.02, y: Y(d, 0.32) },
      ],
      d.lk.playerDark,
    );
  },
  over: (d) => {
    // The zip up the belly, stuck open at the bottom.
    mark(
      d.s,
      ZIP,
      [
        { x: d.f * d.W * -0.04, y: Y(d, 0.44) },
        { x: d.f * d.W * -0.04, y: Y(d, 0.18) },
      ],
      0.5,
      d.sd,
      [0.1, 0.1],
    );
    mark(
      d.s,
      ZIP,
      [
        { x: d.f * d.W * -0.04, y: Y(d, 0.18) },
        { x: d.f * d.W * 0.08, y: Y(d, 0.26) },
      ],
      0.4,
      d.sd + 1,
      [0.1, 0.3],
    );
  },
  back: mane,
  front: ears,
  snout: (d) => {
    // Two big nostrils on the nose, and the goofy grin under them.
    for (const dx of [0.4, 0.52]) spot(d.s, d.f * d.W * dx, Y(d, 0.62), 0.45, 0.55, d.sd + dx * 10, d.lk.eye, 0.05);
    mouthMark(d, d.f * d.W * 0.4, Y(d, 0.54), 2.4, 'smile');
  },
  parts: ['shard', 'shard'],
};
