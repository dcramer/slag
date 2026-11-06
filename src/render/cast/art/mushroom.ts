import { type D, type KindArt, band, line, poly, spot, Y } from '../kit';
import { pair } from '../faces';

/**
 * The mushroom retainer from the pit crew (docs/characters/mushroom.md): a huge round lampshade cap, a dome with a
 * rolled lip much wider than him, sitting low over a small round face; a short vest over a round belly, puffy
 * trousers, and a chequered flag on a sawn-off broom handle held out ahead. The spots and the vest are the player's
 * colour; the dome, the trousers and the face are neutrals. A rendered kind draws from its frames
 * (src/render/cast/sprites/mushroom/); this is what shows before they load, and on the hand-drawn sheets.
 */

const SHADE = '#f4f0e8';
const LIP = '#d6ccc4';
const SKIN = '#f8cfa8';
const WOOD = '#b48a56';
const CHECK = '#4a4450';

/** Inside the outline: the white dome and its spots, the shade under its lip, the face, the race plate, the trousers. */
function print(d: D) {
  const x = (u: number) => d.f * d.W * u;
  band(d, 0.5, 1.1, SHADE);
  band(d, 0.46, 0.5, LIP);
  for (const [u, v, r, seed] of [
    [-0.3, 0.68, 0.11, 1],
    [0.04, 0.86, 0.12, 2],
    [0.3, 0.66, 0.1, 3],
    [0.42, 0.82, 0.06, 4],
  ] as const)
    spot(d.s, x(u), Y(d, v), d.W * r, d.W * r * 0.9, seed, d.lk.player, 0.12);
  band(d, 0.33, 0.46, SKIN);
  band(d, 0, 0.13, SHADE);
  // The race plate, pinned on crooked.
  const px = x(0.1);
  const py = Y(d, 0.22);
  poly(
    d.s,
    [
      { x: px - d.f * 1.1, y: py - 0.9 },
      { x: px + d.f * 0.7, y: py - 1.3 },
      { x: px + d.f * 1.1, y: py + 0.5 },
      { x: px - d.f * 0.7, y: py + 0.9 },
    ],
    SHADE,
  );
}

export const art: KindArt = {
  size: [1.1, 0.96],
  // The dome rises from a rim far out on both sides, its lip rolled under; under it the small face, then the vest
  // over a round belly and the puffy trousers, much narrower than the cap.
  outline:
    'M -0.5 -0.52 C -0.54 -0.8 -0.3 -1 0.02 -1 C 0.34 -1 0.56 -0.8 0.52 -0.52 C 0.52 -0.47 0.46 -0.45 0.4 -0.46 L 0.26 -0.47 C 0.28 -0.42 0.28 -0.36 0.24 -0.33 C 0.32 -0.3 0.34 -0.16 0.28 -0.08 C 0.26 -0.02 0.2 0 0.14 0 L -0.16 0 C -0.24 0 -0.3 -0.06 -0.3 -0.14 C -0.32 -0.24 -0.28 -0.3 -0.22 -0.34 C -0.26 -0.38 -0.26 -0.43 -0.24 -0.47 L -0.42 -0.46 C -0.48 -0.45 -0.52 -0.48 -0.5 -0.52 Z',
  lift: 1.6,
  feet: 'paw',
  arms: 'mitten',
  hands: 'glove',
  fill: 'player',
  faceX: 0.12,
  // A quick scurrying shuffle: small fast hops, upright.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph * 1.4)) * 0.4, upright: 0.7 } : {}),
  paintFace: (d) => pair(d, 0.4, 0.07, 0.55),
  print,
  tool: (d, hx, hy) => {
    // The flag on its sawn-off broom handle, held out ahead, its chequers in two neutrals.
    const tx = hx + d.f * 3.2;
    const ty = hy - 1.4;
    d.s.fillStyle = d.lk.ink;
    line(d.s, hx, hy, tx, ty, { w: 1.1, seed: 4, taper: [0, 0], press: 0 });
    d.s.fillStyle = WOOD;
    line(d.s, hx, hy, tx, ty, { w: 0.55, seed: 4, taper: [0, 0], press: 0 });
    const sway = d.wob * 0.4;
    const q = (i: number, j: number) => [
      { x: tx + d.f * i * 1.1, y: ty + j * 1.1 + sway * i },
      { x: tx + d.f * (i + 1) * 1.1, y: ty + j * 1.1 + sway * (i + 1) },
      { x: tx + d.f * (i + 1) * 1.1, y: ty + (j + 1) * 1.1 + sway * (i + 1) },
      { x: tx + d.f * i * 1.1, y: ty + (j + 1) * 1.1 + sway * i },
    ];
    poly(
      d.s,
      [
        { x: tx - d.f * 0.3, y: ty - 0.3 },
        { x: tx + d.f * 2.5, y: ty - 0.3 + sway * 2 },
        { x: tx + d.f * 2.5, y: ty + 2.5 + sway * 2 },
        { x: tx - d.f * 0.3, y: ty + 2.5 },
      ],
      d.lk.ink,
    );
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) poly(d.s, q(i, j), (i + j) % 2 ? CHECK : SHADE);
  },
  parts: ['shard', 'shard'],
};
