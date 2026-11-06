import { type D, type KindArt, band, poly, toned, tonedOval, Y } from '../kit';
import { pair } from '../faces';
import type { P } from '../../ink';

/**
 * The town assistant dog (docs/characters/assistant.md): a small upright dog girl with a huge round head, a tall
 * tuft of fur standing straight up off her crown, pinched at its base by a cat's collar with a big jingle bell on
 * it, two floppy ears hanging down beside her face, a vest over a white shirt, a short flared skirt, and a clipboard
 * held out in front of her. The fur is the player's colour, the vest a dark of it; the shirt, skirt, collar, bell
 * and clipboard are neutrals. A rendered kind draws from its frames (src/render/cast/sprites/assistant/); this is
 * what shows before they load, and on the hand-drawn sheets.
 */

const SHIRT = '#f6f2ea';
const SKIRT = '#5e6470';
const COLLAR = '#5a3a26';
const BELL: [string, string] = ['#c4c8cc', '#8e9298'];
const WOOD: [string, string] = ['#c8955a', '#9a6c3c'];

/** The tuft: a fan of fur standing straight up off the crown, pinched at its base, splayed into points at its tip. */
function tuft(d: D) {
  const x = d.bx(1) - d.f * 0.2;
  const y = d.top + 0.6;
  const sw = d.wob * 0.15;
  const F = (dx: number, dy: number): P => ({ x: x + d.f * dx + sw * (-dy / 7), y: y + dy });
  // A short bushy fan bursting out of the collar with no stem: a stalk under a fan read blind as a leaf on a sprout.
  const pts = [
    F(-0.9, 0),
    F(-1.6, -1.4),
    F(-3.6, -2.6),
    F(-2.4, -3),
    F(-3.4, -4.6),
    F(-1.6, -4),
    F(-1.6, -6),
    F(-0.4, -4.6),
    F(0.4, -6.4),
    F(0.9, -4.6),
    F(2.4, -5.8),
    F(2, -4),
    F(3.8, -4.4),
    F(2.4, -2.6),
    F(3.6, -2),
    F(1.6, -1.2),
    F(0.9, 0),
  ];
  toned(d.s, pts, d.lk.player, d.lk.playerShade, d.lk.ink, 0.35, 0.7 * d.k, 0.4);
  // The cat's collar round its base, and the bell hanging off its front.
  poly(d.s, [F(-1.1, -0.2), F(1.1, -0.2), F(1.1, -1.2), F(-1.1, -1.2)], COLLAR);
  tonedOval(d.s, x + d.f * 1.8, y - 0.3, 1.5, 1.5, 10, BELL[0], BELL[1], d.lk.ink, 0.35, 0.6 * d.k, 0.4);
}

/** The floppy ears: a long flap of fur down each side of the head, past the chin, flicked out at the tip. */
function ears(d: D) {
  for (const sd of [-1, 1]) {
    const x = d.bx(0.75) + sd * d.W * 0.46;
    const y = Y(d, 0.82);
    const sw = d.wob * 0.25;
    const pts: P[] = [
      { x: x - sd * 0.6, y },
      { x: x + sd * 1.2, y: y + 0.6 },
      { x: x + sd * 1.6 + sw, y: y + 5 },
      { x: x + sd * 2.4 + sw, y: y + 6.4 },
      { x: x + sd * 0.4 + sw, y: y + 6.6 },
      { x: x - sd * 0.8, y: y + 4.6 },
    ];
    toned(d.s, pts, d.lk.player, d.lk.playerShade, d.lk.ink, 0.35, 0.7 * d.k, 0.4);
  }
}

export const art: KindArt = {
  size: [0.9, 0.92],
  // A huge round head over a small body in a vest, flaring out into a short skirt at the bottom.
  outline:
    'M 0 -1 C 0.32 -1 0.48 -0.86 0.48 -0.7 C 0.48 -0.56 0.36 -0.48 0.22 -0.46 L 0.2 -0.38 C 0.24 -0.3 0.26 -0.22 0.3 -0.16 C 0.4 -0.1 0.46 -0.04 0.44 0 L -0.44 0 C -0.46 -0.04 -0.4 -0.1 -0.3 -0.16 C -0.26 -0.22 -0.24 -0.3 -0.2 -0.38 L -0.22 -0.46 C -0.36 -0.48 -0.48 -0.56 -0.48 -0.7 C -0.48 -0.86 -0.32 -1 0 -1 Z',
  lift: 2.4,
  feet: 'paw',
  arms: 'mitten',
  hands: 'body',
  fill: 'player',
  faceX: 0.1,
  // A quick, eager trot: a springy bob on each short step, the head bouncing with it.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph * 1.3)) * 0.8, rot: Math.sin(g.ph * 1.3) * 0.03, pivot: 0.2, upright: 0.7 } : {}),
  paintFace: (d) => pair(d, 0.7, 0.13, 0.6, 'smile', 0.12),
  print: (d) => {
    // The skirt, the vest a dark of the fur, and the white shirt's collar between the vest and the head.
    band(d, -0.1, 0.17, SKIRT);
    band(d, 0.17, 0.46, d.lk.playerDark);
    poly(
      d.s,
      [
        { x: -d.W * 0.18, y: Y(d, 0.47) },
        { x: d.W * 0.18, y: Y(d, 0.47) },
        { x: 0, y: Y(d, 0.36) },
      ],
      SHIRT,
    );
  },
  front: (d) => {
    ears(d);
    tuft(d);
  },
  tool: (d, hx, hy) => {
    // The clipboard held out in front of her, its paper white on the wood.
    const x = hx + d.f * 0.3;
    const r: P[] = [
      { x, y: hy - 3 },
      { x: x + d.f * 3.6, y: hy - 3 },
      { x: x + d.f * 3.6, y: hy + 1.6 },
      { x, y: hy + 1.6 },
    ];
    toned(d.s, r, WOOD[0], WOOD[1], d.lk.ink, 0.3, 0.6 * d.k, 0.3);
    poly(
      d.s,
      [
        { x: x + d.f * 0.5, y: hy - 2.3 },
        { x: x + d.f * 3.1, y: hy - 2.3 },
        { x: x + d.f * 3.1, y: hy + 1.1 },
        { x: x + d.f * 0.5, y: hy + 1.1 },
      ],
      SHIRT,
    );
  },
  parts: ['shard', 'shard'],
};
