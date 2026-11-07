import type { P } from '../../ink';
import { sideEye } from '../faces';
import { type D, type KindArt, poly, toned, tonedOval, Y } from '../kit';

/**
 * The red-haired mountain climber (docs/characters/climber.md): side on, a small girl leaning into the climb under a
 * big messy mop of red hair that floats up and streams back off her head, a puffy banded parka to her hips (a
 * sleeping bag with arms cut in), a lunchbox on a string on her back, slim legs in chunky boots. The parka is the
 * player's colour, its bands a light of it; the hair, skin and the tan lunchbox are neutrals. A rendered kind draws from its
 * frames (src/render/cast/sprites/climber/); this is what shows before they load, and on the hand-drawn sheets.
 */

const SKIN = '#f0d4c0';
const HAIR = '#ae2e22';
const HAIR_SH = '#86231b';
const TIN = '#966942';
const TIN_SH = '#6e4c30';

/** The head's middle: the hair and the face hang off it. */
const head = (d: D): P => ({ x: d.bx(0.8) + d.f * d.W * 0.1, y: Y(d, 0.8) });

/**
 * The mop: a crown of hair over the head and a big ragged plume streaming back off it. A dash or a run streams it
 * flatter and further back; a fall throws it up; the wall floats it up behind her.
 */
function mop(d: D) {
  const h = head(d);
  const b = -d.f;
  const sw = d.wob * 0.35;
  const lift = d.m === 'fall' || d.m === 'wall' ? -1.6 : d.m === 'up' || d.m === 'run' ? 0.8 : 0;
  const reach = d.m === 'up' || d.m === 'run' ? 1.2 : 1;
  // u back from the head's middle, v down from it; the far tips follow the lift and the sway.
  const at = (u: number, v: number): P => ({ x: h.x + b * u * reach, y: h.y + v + (lift + sw) * Math.max(0, u - 2) * 0.25 });
  const pts = [
    at(-3.1, -0.4),
    at(-2.6, -2.8),
    at(-0.8, -4.1),
    at(-0.2, -4.9),
    at(0.4, -4.2),
    at(2.4, -4.4),
    at(4.6, -4),
    at(6.4, -4.6),
    at(5.8, -3.1),
    at(7.6, -2.6),
    at(6.2, -1.6),
    at(7.4, -0.6),
    at(5.6, -0.2),
    at(6.4, 1.2),
    at(4.4, 0.9),
    at(3.6, 2.4),
    at(2, 1.6),
    at(0.8, 2.8),
    at(-0.6, 1.4),
    at(-1.8, -1.2),
  ];
  toned(d.s, pts, HAIR, HAIR_SH, d.lk.ink, 0.3, 0.7 * d.k, 0.35);
}

/** The lunchbox on her back, its lid hanging open. */
function lunchbox(d: D) {
  const b = -d.f;
  const cx = d.bx(0.5) + b * d.W * 0.5;
  const cy = Y(d, 0.52);
  const box: P[] = [
    { x: cx - b * 1.2, y: cy - 1.4 },
    { x: cx + b * 1.6, y: cy - 1.4 },
    { x: cx + b * 1.6, y: cy + 1.2 },
    { x: cx - b * 1.2, y: cy + 1.2 },
  ];
  toned(d.s, box, TIN, TIN_SH, d.lk.ink, 0.3, 0.5 * d.k, 0.3);
  const lid: P[] = [
    { x: cx + b * 1.6, y: cy + 1.2 },
    { x: cx + b * 3.6, y: cy + 0.6 },
    { x: cx + b * 3.6, y: cy + 1.5 },
    { x: cx + b * 1.6, y: cy + 2 },
  ];
  toned(d.s, lid, TIN, TIN_SH, d.lk.ink, 0.3, 0.5 * d.k, 0.3);
}

export const art: KindArt = {
  size: [0.84, 0.94],
  // A small round head on a puffy parka that swells to the hips, then the slim legs below it.
  outline:
    'M 0.12 -1 C 0.3 -1 0.38 -0.9 0.38 -0.8 C 0.38 -0.7 0.3 -0.62 0.2 -0.6 C 0.36 -0.56 0.46 -0.42 0.46 -0.24 C 0.46 -0.08 0.36 0 0.18 0 L -0.22 0 C -0.4 0 -0.48 -0.1 -0.48 -0.26 C -0.48 -0.44 -0.36 -0.56 -0.14 -0.6 C -0.2 -0.66 -0.22 -0.74 -0.2 -0.82 C -0.17 -0.94 -0.04 -1 0.12 -1 Z',
  lift: 2.4,
  feet: 'boot',
  arms: 'mitten',
  hands: 'body',
  fill: 'player',
  faceX: 0.16,
  boots: ['#72493f', '#4e332c'],
  // A quick, determined jog: a short hop and a lean into the climb.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.5, rot: 0.06, pivot: 0.2, upright: 0.6 } : {}),
  paintFace: (d) => sideEye(d, 0.8, d.f * d.W * 0.2, 0.6),
  back: (d) => {
    lunchbox(d);
    mop(d);
  },
  print: (d) => {
    // The puffy bands across the sleeping bag, a light of the costume.
    for (const [lo, hi] of [
      [0.16, 0.24],
      [0.36, 0.44],
    ] as const) {
      poly(
        d.s,
        [
          { x: -d.W * 0.6, y: Y(d, hi) },
          { x: d.W * 0.6, y: Y(d, hi) },
          { x: d.W * 0.6, y: Y(d, lo) },
          { x: -d.W * 0.6, y: Y(d, lo) },
        ],
        d.lk.playerHi,
      );
    }
    // The face side on at the front of the head, under the fringe.
    const h = head(d);
    tonedOval(d.s, h.x + d.f * d.W * 0.08, h.y + 0.4, d.W * 0.17, d.H * 0.15, 12, SKIN, SKIN, d.lk.ink, 0.3, 0.4 * d.k, 0);
    // The fringe over the brow.
    poly(d.s, tonedFringe(d), HAIR);
  },
  parts: ['shard', 'shard'],
};

/** The fringe across the top of her face. */
function tonedFringe(d: D): P[] {
  const h = head(d);
  const f = d.f;
  return [
    { x: h.x - f * 1.6, y: h.y - 3 },
    { x: h.x + f * 2.6, y: h.y - 2.6 },
    { x: h.x + f * 2.6, y: h.y - 1.4 },
    { x: h.x + f * 1.6, y: h.y - 1.9 },
    { x: h.x + f * 1.2, y: h.y - 1 },
    { x: h.x + f * 0.4, y: h.y - 1.7 },
    { x: h.x - f * 0.6, y: h.y - 0.6 },
  ];
}
