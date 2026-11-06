import type { P } from '../../ink';
import { sideEye } from '../faces';
import { type D, type KindArt, mark, oval, poly, toned, tonedOval, Y } from '../kit';

/**
 * The half-genie who whips her ponytail (docs/characters/genie.md), a bathroom genie: side on, a chunky little
 * dancer, her purple ponytail as long as she is springing up from her crown and streaming out level behind her with
 * background under it (the read: the raider's braid hangs from the nape, the archer's braids bush out of a mane), a
 * white shower-curtain ring at its root and a tin-foil tiara on her brow, a cropped top, a bare midriff over a dark
 * sash, two big balloon harem trousers gathered at the ankles, arms out. The top and trousers are the player's
 * colour, the sash a dark of it; the hair, skin, ring and foil are neutrals. A rendered kind draws from its frames
 * (src/render/cast/sprites/genie/); this is what shows before they load, and on the hand-drawn sheets.
 */

const SKIN = '#dea36b';
const HAIR = '#7c49a5';
const HAIR_SH = '#5b3184';
const RING = '#eceff6';
const FOIL = '#c4c8cc';

/**
 * The ponytail: a straight tight rope from the ring on her crown, out level behind her to a split tip, with
 * background above and below it all along (a plume swept down to the back of her head read as a squirrel's tail).
 */
function ponytail(d: D) {
  const b = -d.f;
  // A jump flicks it up behind her, a fall throws it higher; on the run it streams flat.
  const lift = d.m === 'up' ? -2.6 : d.m === 'fall' ? -4 : 0;
  const sw = d.wob * 0.4;
  const root: P = { x: d.bx(1) - d.f * d.W * 0.06, y: Y(d, 0.98) };
  const at = (u: number, v: number): P => ({ x: root.x + b * u, y: root.y + v + (lift + sw) * (u / 10) });
  const pts = [at(-0.4, -0.75), at(8.4, -0.75), at(10.4, -1.9), at(9.4, 0), at(10.4, 1.9), at(8.4, 0.75), at(-0.4, 0.75)];
  toned(d.s, pts, HAIR, HAIR_SH, d.lk.ink, 0.3, 0.7 * d.k, 0.3);
  // The tape where it was mended.
  if (d.detail) mark(d.s, FOIL, [at(4.4, -0.8), at(4.4, 0.8)], 0.7, 3, [0.1, 0.1]);
}

/** An arm held out to the side, bare, from the shoulder: `side` 1 ahead of her, -1 behind. */
function arm(d: D, side: number) {
  const f = d.f * side;
  const swing = d.m === 'walk' || d.m === 'run' ? Math.sin(d.ph) * 0.6 * side : 0;
  const sh: P = { x: d.bx(0.58) + f * d.W * 0.12, y: Y(d, 0.58) };
  const hand: P = { x: sh.x + f * 4, y: sh.y + 0.6 + swing };
  mark(d.s, d.lk.ink, [sh, hand], 1.5, side + 2, [0.1, 0.1]);
  mark(d.s, SKIN, [sh, hand], 1, side + 4, [0.1, 0.1]);
  tonedOval(d.s, hand.x + f * 0.3, hand.y, 0.65, 0.55, 8, SKIN, SKIN, d.lk.ink, 0.3, 0.5 * d.k, 0);
}

export const art: KindArt = {
  size: [0.9, 1],
  // A round head on a small body, the cropped top, the waist, then two big balloon trousers wider than her
  // shoulders, gathered at the ankles with background between them.
  outline:
    'M 0.05 -1 C 0.2 -1 0.27 -0.92 0.27 -0.82 C 0.27 -0.72 0.2 -0.65 0.12 -0.64 L 0.16 -0.6 L 0.18 -0.46 C 0.4 -0.42 0.48 -0.3 0.46 -0.18 C 0.44 -0.08 0.36 -0.05 0.3 -0.05 L 0.3 0 L 0.1 0 L 0.08 -0.06 L 0 -0.1 L -0.1 -0.06 L -0.12 0 L -0.32 0 L -0.32 -0.05 C -0.4 -0.06 -0.5 -0.12 -0.48 -0.22 C -0.46 -0.34 -0.36 -0.42 -0.16 -0.46 L -0.14 -0.6 L -0.08 -0.64 C -0.16 -0.68 -0.19 -0.76 -0.18 -0.84 C -0.17 -0.94 -0.08 -1 0.05 -1 Z',
  lift: 0,
  feet: 'none',
  arms: 'none',
  fill: 'player',
  faceX: 0.14,
  // A bouncy dancer's skip: a springy hop and a sway of the hips.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.7, rot: Math.sin(g.ph) * 0.03, pivot: 0.3, upright: 0.7 } : {}),
  paintFace: (d) => sideEye(d, 0.83, d.f * d.W * 0.16, 0.7),
  back: (d) => {
    ponytail(d);
    arm(d, -1);
  },
  print: (d) => {
    // The bare midriff between the cropped top and the sash, the sash a dark of the costume.
    poly(
      d.s,
      [
        { x: -d.W * 0.6, y: Y(d, 0.53) },
        { x: d.W * 0.6, y: Y(d, 0.53) },
        { x: d.W * 0.6, y: Y(d, 0.46) },
        { x: -d.W * 0.6, y: Y(d, 0.46) },
      ],
      SKIN,
    );
    poly(
      d.s,
      [
        { x: -d.W * 0.6, y: Y(d, 0.47) },
        { x: d.W * 0.6, y: Y(d, 0.47) },
        { x: d.W * 0.6, y: Y(d, 0.42) },
        { x: -d.W * 0.6, y: Y(d, 0.42) },
      ],
      d.lk.playerDark,
    );
    // The head: purple hair over its back and top, her face side on at the front, the neck below.
    poly(d.s, oval(d.bx(0.82) + d.f * d.W * 0.04, Y(d, 0.82), d.W * 0.25, d.H * 0.2, 14), HAIR);
    poly(d.s, oval(d.bx(0.8) + d.f * d.W * 0.14, Y(d, 0.79), d.W * 0.15, d.H * 0.14, 12), SKIN);
    poly(d.s, oval(d.bx(0.62) + d.f * d.W * 0.03, Y(d, 0.63), d.W * 0.08, d.H * 0.04, 8), SKIN);
  },
  front: (d) => {
    arm(d, 1);
    // The shower-curtain ring at the ponytail's root, and the tin-foil tiara on her brow, its point bent over.
    tonedOval(d.s, d.bx(1) - d.f * d.W * 0.05, Y(d, 1), 1.1, 0.75, 10, RING, RING, d.lk.ink, 0.3, 0.6 * d.k, 0);
    const t = (u: number, v: number): P => ({ x: d.bx(0.96) + d.f * (d.W * 0.05 + u), y: Y(d, 0.96) + v });
    poly(d.s, [t(0, 0.4), t(0.6, -0.9), t(1.1, -0.3), t(1.7, -1.3), t(2.5, -1), t(2.1, 0.2)], FOIL);
    // Bare feet out of the gathered ankles.
    for (const u of [-0.22, 0.2]) poly(d.s, oval(d.f * (d.W * u + 0.8), -0.5, 1.2, 0.5, 8), SKIN);
  },
  parts: ['shard', 'shard'],
};
