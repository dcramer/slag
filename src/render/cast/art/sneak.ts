import type { P } from '../../ink';
import { eye } from '../faces';
import { type KindArt, mark, poly, Y } from '../kit';
import { oval } from '../../ink-figure';

const SKIN = '#d9b08c';
const STRIPE = '#f4efe6';

/**
 * The sneaking soldier, side on: one crisp square-cornered cardboard box worn over him to the knees, its
 * back end a darker face, on two short crouched legs; the bandana's two tails stream out of a hand-hole at its
 * back, and his eyes peer out of a slot hacked near its front. No head or arms show (the miner is a cube head on
 * a body with arms), and the box keeps its corners (the crewmate is a round bean). The box is the player's
 * colour, its side panel and the bandana darks of it.
 */
export const art: KindArt = {
  size: [0.95, 0.95],
  outline: 'M -0.46 0 L -0.47 -0.93 L -0.22 -1 L 0.46 -0.97 L 0.45 0 Z',
  lift: 3.4,
  feet: 'boot',
  arms: 'none',
  fill: 'player',
  faceX: 0.16,
  // A crouched shuffle: the box bobs on every step and stays upright, never leaning into the run.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * (0.4 + 0.3 * g.run), rot: Math.sin(g.ph) * 0.03, pivot: 0, upright: 1 } : {}),
  // The back end, a dark of the box, so it reads as a box and not a card.
  print: (d) => {
    const f = d.f;
    const x = -0.22 * d.W;
    poly(
      d.s,
      [
        { x: f * -0.6 * d.W, y: Y(d, -0.05) },
        { x: f * -0.6 * d.W, y: Y(d, 1.05) },
        { x: f * x, y: Y(d, 1.05) },
        { x: f * x, y: Y(d, -0.05) },
      ],
      d.lk.fillShade,
    );
    mark(
      d.s,
      d.lk.ink,
      [
        { x: f * x, y: Y(d, 0.99) },
        { x: f * x, y: Y(d, 0.02) },
      ],
      0.45 * d.k,
      3,
    );
  },
  // The hand-hole the tails come out of.
  over: (d) => poly(d.s, oval(-d.f * d.W * 0.34, Y(d, 0.76), 0.8, 0.95, 9), d.lk.ink),
  // The bandana's two tails, streaming back and fluttering with speed, a pale tea-towel stripe near each end.
  back: (d) => {
    const f = d.f;
    const x0 = -f * d.W * 0.34;
    const y0 = Y(d, 0.76);
    const run = d.gait.k ?? 0;
    for (const [i, dy] of [
      [0, -0.6],
      [1, 1.6],
    ] as const) {
      const len = 5.2 + i * 0.6;
      const pts: P[] = [];
      for (let j = 0; j <= 6; j++) {
        const u = j / 6;
        pts.push({ x: x0 - f * (1 + u * len), y: y0 + dy * u + Math.sin(d.t * 9 + u * 4 + i) * (0.35 + d.wob * 0.3) * u - run * u });
      }
      mark(d.s, d.lk.playerDark, pts, 1.1, 11 + i, [0.1, 0.5]);
      const s = pts[5];
      mark(
        d.s,
        STRIPE,
        [
          { x: s.x, y: s.y - 0.5 },
          { x: s.x, y: s.y + 0.5 },
        ],
        0.45,
        13 + i,
        [0, 0],
      );
    }
  },
  // The eye slot: a strip of his face through a rough cut in the front, two small eyes peering out.
  paintFace: (d) => {
    const y = Y(d, 0.76);
    const w = d.W * 0.2;
    const slot: P[] = [
      { x: -w, y: y - 1.2 },
      { x: w, y: y - 1.35 },
      { x: w + 0.2, y: y + 1.2 },
      { x: -w, y: y + 1.25 },
    ];
    poly(d.s, slot, d.lk.ink);
    poly(
      d.s,
      slot.map((p) => ({ x: p.x * 0.88, y: y + (p.y - y) * 0.6 })),
      SKIN,
    );
    for (const sd of [-1, 1]) eye(d, sd * w * 0.42 + d.f * 0.3, y, 0.5);
  },
  parts: ['shard', 'shard'],
};
