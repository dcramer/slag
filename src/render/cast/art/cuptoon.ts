import { type D, type KindArt, band, mark, oval, poly, toned, tonedOval, Y } from '../kit';
import { tallEyes } from '../faces';
import type { P } from '../../ink';

/**
 * The cup-headed toon (docs/characters/cuptoon.md): a takeaway paper coffee cup for a head, wider at the top,
 * under a plastic lid, a cardboard sleeve round its foot, a mug's loop handle taped onto its back and a straw
 * stood up out of the lid, on a tiny body of high-waisted shorts, hose limbs, white gloves and big shoes. The
 * shorts are the player's colour; the sleeve and the straw are tones of it; the paper, the lid, the tape and
 * the shoes are neutrals. A rendered kind draws from its frames (src/render/cast/sprites/cuptoon/); this is
 * what shows before they load, and on the hand-drawn sheets.
 */

const MUG = '#f4f1ea';
const MUG_SH = '#d3cfc6';
const LID = '#5c5a62';
const TAPE = '#a9a8a4';
const HOSE = '#1c1a24';
const SHOE: [string, string] = ['#6b4a35', '#4d3426'];

/** The grey plastic lid, proud of the cup all round, seen a little from above. */
function lid(d: D) {
  const x = d.bx(0.96);
  const y = d.top + 0.6;
  tonedOval(d.s, x, y, d.W * 0.5, 1.2, 16, LID, LID, d.lk.ink, 0.3, 0.7 * d.k, 0.4);
}

/** The straw stood up out of the lid and kinked once at the top: a player-coloured stripe on an inked stick. */
function straw(d: D) {
  const x = d.bx(1) + d.f * d.W * 0.06;
  const y = d.top + 0.4;
  const pts = [
    { x, y },
    { x: x - d.f * d.W * 0.08, y: y - 5.2 + d.wob * 0.1 },
    { x: x - d.f * d.W * 0.34, y: y - 5.6 + d.wob * 0.2 },
  ];
  mark(d.s, d.lk.ink, pts, 2.1 * d.k, d.sd, [0, 0]);
  mark(d.s, d.lk.player, pts, 1.2, d.sd, [0, 0]);
  if (d.detail)
    for (const t of [0.25, 0.55, 0.85]) {
      const i = Math.min(1, Math.floor(t * 2));
      const a = pts[i];
      const b = pts[i + 1];
      const u = t * 2 - i;
      const px = a.x + (b.x - a.x) * u;
      const py = a.y + (b.y - a.y) * u;
      poly(d.s, oval(px, py, 0.45, 0.45, 6), MUG);
    }
}

export const art: KindArt = {
  size: [0.98, 1.04],
  // The cup under its lid, wider at the top than at its foot and wider than the body under it, over a short
  // black neck and the shorts.
  outline:
    'M -0.46 -0.97 C -0.15 -0.99 0.2 -0.99 0.51 -0.97 C 0.53 -0.94 0.52 -0.91 0.49 -0.89 C 0.46 -0.72 0.43 -0.55 0.4 -0.42 C 0.38 -0.38 0.3 -0.37 0.16 -0.36 C 0.3 -0.31 0.34 -0.2 0.32 -0.07 C 0.3 0 0.24 0 0.16 0 L -0.22 0 C -0.3 0 -0.34 -0.04 -0.34 -0.1 C -0.36 -0.2 -0.32 -0.31 -0.18 -0.36 C -0.28 -0.37 -0.33 -0.38 -0.34 -0.42 C -0.37 -0.55 -0.4 -0.72 -0.43 -0.89 C -0.47 -0.91 -0.48 -0.94 -0.46 -0.97 Z',
  lift: 2.8,
  feet: 'boot',
  boots: SHOE,
  arms: 'mitten',
  hands: 'glove',
  fill: 'player',
  faceX: 0.14,
  // The 1930s strut: a springy bounce on every step and a little swagger, upright.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 1.1, rot: Math.sin(g.ph) * 0.05, pivot: 0.3, upright: 0.7 } : {}),
  paintFace: (d) => tallEyes(d, 0.68, 0.13),
  back: (d) => {
    // The mug's loop handle taped onto the back of the paper cup, two strips of tape across it.
    const x = -d.f * d.W * 0.44;
    const y = Y(d, 0.66);
    const loop: P[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI;
      loop.push({ x: x - d.f * Math.cos(a) * 2.4, y: y + Math.sin(a) * 2.8 });
    }
    mark(d.s, d.lk.ink, loop, 2.2 * d.k, d.sd, [0, 0]);
    mark(d.s, MUG, loop, 1.2, d.sd, [0, 0]);
    for (const ty of [y - 2.4, y + 2.4])
      toned(
        d.s,
        [
          { x: x - d.f * 0.2, y: ty - 0.6 },
          { x: x - d.f * 1.6, y: ty - 0.6 },
          { x: x - d.f * 1.6, y: ty + 0.6 },
          { x: x - d.f * 0.2, y: ty + 0.6 },
        ],
        TAPE,
        TAPE,
        d.lk.ink,
        0.3,
        0.5 * d.k,
        0.3,
      );
  },
  print: (d) => {
    // The paper over the head and its shade on the back, the sleeve round its foot, the black neck between it
    // and the shorts.
    band(d, 0.39, 1.1, MUG);
    band(d, 0.42, 0.56, d.lk.playerHi);
    band(d, 0.36, 0.42, HOSE);
    poly(
      d.s,
      [
        { x: -d.f * d.W * 0.5, y: Y(d, 0.42) },
        { x: -d.f * d.W * 0.3, y: Y(d, 0.42) },
        { x: -d.f * d.W * 0.34, y: Y(d, 0.92) },
        { x: -d.f * d.W * 0.5, y: Y(d, 0.92) },
      ],
      MUG_SH,
    );
  },
  front: (d) => {
    lid(d);
    straw(d);
  },
  parts: ['shard', 'shard'],
};
