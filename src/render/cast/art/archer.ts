import { type D, type KindArt, Y, oval, poly, tonedOval } from '../kit';
import { sideEye } from '../faces';
import type { P } from '../../ink';

/**
 * The red-braided robot hunter (docs/characters/archer.md): side on in a low hunter's crouch, the bow held out level
 * ahead of her with background all round it, a huge bushy mane of red hair puffing out behind her head with two thick
 * braids flying off it, and a fur wrap over her shoulders. The leathers are the player's colour, the fur a light of
 * it; the hair, the curtain-rod bow and its knobs are neutrals. A rendered kind draws from its frames
 * (src/render/cast/sprites/archer/); this is what shows before they load, and on the hand-drawn sheets.
 */

const HAIR: [string, string] = ['#8d311b', '#601e15'];
const ROD: [string, string] = ['#a36b41', '#7b4a2c'];
const SKIN = '#da9e69';

/** The head's middle: the hair and the face hang off it. */
const head = (d: D) => ({ x: d.bx(0.82) + d.f * d.W * 0.1, y: Y(d, 0.82) });

/** The mane behind her head and the two braids flying off it, each a chain of plaits ending in a tuft. */
function mane(d: D) {
  const h = head(d);
  const sw = d.wob * 0.3;
  for (const [dy, n] of [
    [-1.2, 3],
    [1.6, 3],
  ] as const) {
    for (let i = n; i >= 1; i--) {
      const x = h.x - d.f * (3.6 + i * 1.15);
      const y = h.y + dy + i * 0.5 + sw * i * 0.3;
      tonedOval(d.s, x, y, i === n ? 1.25 : 1, i === n ? 1.15 : 0.9, 8, HAIR[0], HAIR[1], d.lk.ink, 0.3, 0.6 * d.k, 0.3);
    }
  }
  tonedOval(d.s, h.x - d.f * 2.2, h.y + 0.6, 4.2, 4.4, 14, HAIR[0], HAIR[1], d.lk.ink, 0.35, 0.7 * d.k, 0.4);
}

/** The bow: a tall bent rod with a knob on each end, strung, held upright out ahead of the front hand. */
function bow(d: D, hx: number, hy: number) {
  const top = { x: hx + d.f * 1.2, y: hy - d.H * 0.66 };
  const mid = { x: hx + d.f * 3, y: hy };
  const low = { x: hx + d.f * 1.2, y: hy + d.H * 0.32 };
  const arc: P[] = [];
  for (let j = 0; j <= 10; j++) {
    const t = j / 10;
    const u = 1 - t;
    arc.push({ x: u * u * top.x + 2 * u * t * (mid.x + d.f * 1.6) + t * t * low.x, y: u * u * top.y + 2 * u * t * mid.y + t * t * low.y });
  }
  const s = d.s;
  // The string, drawn back to her cheek.
  s.strokeStyle = d.lk.ink;
  s.lineWidth = 0.35;
  s.beginPath();
  s.moveTo(top.x, top.y);
  s.lineTo(hx - d.f * 2.6, hy - 1.2);
  s.lineTo(low.x, low.y);
  s.stroke();
  s.lineCap = 'round';
  s.lineJoin = 'round';
  for (const [w, c] of [
    [1.8, d.lk.ink],
    [1, ROD[0]],
  ] as const) {
    s.strokeStyle = c;
    s.lineWidth = w;
    s.beginPath();
    arc.forEach((p, i) => (i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y)));
    s.stroke();
  }
  for (const p of [top, low]) tonedOval(s, p.x, p.y, 0.75, 0.75, 8, ROD[0], ROD[1], d.lk.ink, 0.3, 0.5 * d.k, 0.2);
}

export const art: KindArt = {
  size: [0.86, 0.96],
  // Side on and crouched: a round head out front over a body leaning into the shot, the front knee bent forward and
  // the back one low behind.
  outline:
    'M 0.12 -1 C 0.3 -1 0.38 -0.9 0.36 -0.78 C 0.35 -0.68 0.28 -0.62 0.2 -0.6 L 0.24 -0.5 C 0.28 -0.4 0.24 -0.32 0.18 -0.3 L 0.36 -0.22 L 0.4 0 L 0.2 0 L 0.14 -0.14 L -0.06 -0.16 L -0.28 -0.06 L -0.32 0 L -0.48 0 L -0.42 -0.16 L -0.24 -0.28 C -0.26 -0.4 -0.24 -0.52 -0.16 -0.6 C -0.14 -0.66 -0.1 -0.7 -0.08 -0.76 C -0.08 -0.92 -0.02 -1 0.12 -1 Z',
  lift: 2.2,
  feet: 'boot',
  arms: 'mitten',
  hands: 'leather',
  fill: 'player',
  faceX: 0.16,
  // A light, low hunter's stalk: a small bob, the body kept low.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.4, rot: 0.06, pivot: 0.2, upright: 0.4 } : {}),
  paintFace: (d) => sideEye(d, 0.8, d.f * d.W * 0.24, 0.7),
  back: mane,
  print: (d) => {
    // The fur wrap over her shoulders and back, a light of the leathers.
    poly(d.s, oval(-d.f * d.W * 0.12, Y(d, 0.5), d.W * 0.3, d.H * 0.16, 12, -d.f * 0.3), d.lk.playerHi);
    // Her face, side on at the front of the head.
    poly(d.s, oval(d.bx(0.8) + d.f * d.W * 0.24, Y(d, 0.8), d.W * 0.16, d.H * 0.12, 10), SKIN);
  },
  tool: bow,
  parts: ['shard', 'shard'],
};
