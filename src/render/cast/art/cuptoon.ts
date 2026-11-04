import { type D, type KindArt, band, mark, oval, poly, toned, tonedOval, Y } from '../kit';
import { tallEyes } from '../faces';
import type { P } from '../../ink';

/**
 * The cup-headed toon (docs/CHARACTERS.md → Roster): a white enamel camping mug for a head, its loop handle
 * out the back and a soggy straw flopped over out of the tea, on a tiny body of high-waisted shorts, hose
 * limbs, white gloves and big shoes. The shorts are the player's colour; the rim, the straw and the tea-bag
 * tag are tones of it; the enamel, the tea and the shoes are neutrals. A rendered kind draws from its frames
 * (src/render/cast/sprites/cuptoon/); this is what shows before they load, and on the hand-drawn sheets.
 */

const MUG = '#f4efe6';
const MUG_SH = '#cfc6b8';
const TEA = '#7a4e30';
const HOSE = '#1c1a24';
const SHOE: [string, string] = ['#6b4a35', '#4d3426'];

/** The top of the mug: the rim, a dark of the player's colour, round the tea, seen a little from above. */
function rim(d: D) {
  const x = d.bx(0.95);
  const y = d.top + 0.7;
  tonedOval(d.s, x, y, d.W * 0.47, 1.5, 16, d.lk.playerDark, d.lk.playerDark, d.lk.ink, 0.3, 0.7 * d.k, 0.4);
  poly(d.s, oval(x - d.f * 0.2, y + 0.15, d.W * 0.36, 0.8, 14), TEA);
}

/** The straw out of the tea, bent over backwards at the top: a player-coloured stripe on an inked stick. */
function straw(d: D) {
  const x = d.bx(1) - d.f * d.W * 0.08;
  const y = d.top + 0.4;
  const pts = [
    { x, y },
    { x: x - d.f * d.W * 0.12, y: y - 4.4 + d.wob * 0.1 },
    { x: x - d.f * d.W * 0.3, y: y - 5 + d.wob * 0.2 },
    { x: x - d.f * d.W * 0.36, y: y - 3.4 + d.wob * 0.3 },
  ];
  mark(d.s, d.lk.ink, pts, 2.1 * d.k, d.sd, [0, 0]);
  mark(d.s, d.lk.player, pts, 1.2, d.sd, [0, 0]);
  if (d.detail)
    for (const t of [0.25, 0.55, 0.85]) {
      const i = Math.min(2, Math.floor(t * 3));
      const a = pts[i];
      const b = pts[i + 1];
      const u = t * 3 - i;
      const px = a.x + (b.x - a.x) * u;
      const py = a.y + (b.y - a.y) * u;
      poly(d.s, oval(px, py, 0.45, 0.45, 6), MUG);
    }
}

export const art: KindArt = {
  size: [0.98, 1.04],
  // The mug, wider than the body under it and flat on top, over a short black neck and the shorts.
  outline:
    'M -0.4 -0.95 C -0.1 -0.97 0.2 -0.97 0.47 -0.95 C 0.5 -0.78 0.48 -0.56 0.42 -0.42 C 0.4 -0.38 0.3 -0.37 0.16 -0.36 C 0.3 -0.31 0.34 -0.2 0.32 -0.07 C 0.3 0 0.24 0 0.16 0 L -0.22 0 C -0.3 0 -0.34 -0.04 -0.34 -0.1 C -0.36 -0.2 -0.32 -0.31 -0.18 -0.36 C -0.3 -0.37 -0.36 -0.39 -0.38 -0.43 C -0.44 -0.6 -0.45 -0.8 -0.4 -0.95 Z',
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
    // The loop handle out of the back of the mug, and the tea-bag's tag hanging by it.
    const x = -d.f * d.W * 0.46;
    const y = Y(d, 0.68);
    const loop: P[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI;
      loop.push({ x: x - d.f * Math.cos(a) * 2.4, y: y + Math.sin(a) * 2.8 });
    }
    mark(d.s, d.lk.ink, loop, 2.2 * d.k, d.sd, [0, 0]);
    mark(d.s, MUG, loop, 1.2, d.sd, [0, 0]);
    const tx = x - d.f * 1.6 + d.wob * 0.2;
    const ty = y + 4;
    mark(
      d.s,
      d.lk.ink,
      [
        { x: x + d.f * 0.6, y: d.top + 1 },
        { x: tx, y: ty - 1.2 },
      ],
      0.35,
      d.sd,
      [0, 0],
    );
    toned(
      d.s,
      [
        { x: tx - 1, y: ty - 1.1 },
        { x: tx + 1, y: ty - 1.1 },
        { x: tx + 1.1, y: ty + 1.2 },
        { x: tx - 1.1, y: ty + 1.2 },
      ],
      d.lk.playerHi,
      d.lk.playerHi,
      d.lk.ink,
      0.3,
      0.6 * d.k,
      0.3,
    );
  },
  print: (d) => {
    // The enamel over the head and its shade on the back, the black neck between it and the shorts.
    band(d, 0.39, 1.1, MUG);
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
    rim(d);
    straw(d);
  },
  parts: ['shard', 'shard'],
};
