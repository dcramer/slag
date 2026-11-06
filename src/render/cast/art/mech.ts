import type { P } from '../../ink';
import { pair } from '../faces';
import { type D, inked, type KindArt, line, poly, tonedOval, Y } from '../kit';
import { oval } from '../../ink-figure';

const METAL = '#a4abaf';
const METAL_SH = '#77747f';
const GLASS = '#8fa6b8';
const SKIN = '#f5c7a5';
const HAIR = '#5f4235';
const WHITE = '#f6f4f0';

/**
 * The girl gamer's washing-machine mech (docs/characters/mech.md): a squat round body much wider than tall, the
 * porthole door on its front, on two thick mech legs bent back at the knee, two stubby dryer-duct cannons jutting
 * level out ahead with background between them, and her small head in big headphones peeking over its top, her
 * hair down its back. The shell is the player's colour, the front a light of it; the legs, ducts and rim are metal.
 * A rendered kind draws from its frames (src/render/cast/sprites/mech/); this is what shows before they load, and
 * on the hand-drawn sheets.
 */

/** Where each foot is this frame: a heavy stomp on the ground, tucked up on the way up. */
function foot(d: D, side: number): P {
  let fx = side * d.W * 0.24;
  let fy = -0.9;
  if (d.m === 'walk' || d.m === 'run') {
    const sw = Math.sin(d.ph) * side;
    fx += d.f * sw * (d.m === 'run' ? 2.6 : 1.6);
    fy -= Math.max(0, Math.cos(d.ph) * side) * (d.m === 'run' ? 1.8 : 1.2);
  } else if (d.m === 'up' || d.m === 'wall') {
    fx = side * d.W * 0.18;
    fy = -2.4;
  } else if (d.m === 'fall') {
    fx = side * d.W * 0.3;
    fy = -0.6;
  }
  return { x: fx, y: fy };
}

/** A leg from the hull to its foot, the knee kicked back like a bird's, and a wide flat foot. */
function leg(d: D, side: number) {
  const ft = foot(d, side);
  const hx = side * d.W * 0.2;
  const hy = d.by + 0.4;
  const kx = (hx + ft.x) / 2 - d.f * 1.6;
  const ky = (hy + ft.y) / 2;
  const seg = (ax: number, ay: number, bx: number, by: number) => {
    d.s.fillStyle = d.lk.ink;
    line(d.s, ax, ay, bx, by, { w: 3.8, seed: side, taper: [0, 0], press: 0 });
    d.s.fillStyle = side === d.f ? METAL : METAL_SH;
    line(d.s, ax, ay, bx, by, { w: 2.7, seed: side, taper: [0, 0], press: 0 });
  };
  seg(hx, hy, kx, ky);
  seg(kx, ky, ft.x, ft.y);
  inked(
    d.s,
    [
      { x: ft.x - d.f * 1.6, y: ft.y - 0.9 },
      { x: ft.x + d.f * 2.4, y: ft.y - 0.7 },
      { x: ft.x + d.f * 2.8, y: ft.y + 0.9 },
      { x: ft.x - d.f * 1.8, y: ft.y + 0.9 },
    ],
    side === d.f ? METAL : METAL_SH,
    d.lk.ink,
    0.4,
    0.7 * d.k,
  );
}

/** The two dryer-duct cannons, level out ahead of the front with a gap between them. */
function ducts(d: D) {
  const x0 = d.f * d.W * 0.22;
  const x1 = d.f * d.W * 0.66;
  for (const u of [0.5, 0.18]) {
    const y = Y(d, u);
    const h = d.H * 0.055;
    inked(
      d.s,
      [
        { x: x0, y: y - h },
        { x: x1, y: y - h },
        { x: x1, y: y + h },
        { x: x0, y: y + h },
      ],
      METAL,
      d.lk.ink,
      0.4,
      0.7 * d.k,
    );
    poly(d.s, oval(x1 - d.f * 0.2, y, 0.35, h * 0.8, 8), METAL_SH);
  }
}

export const art: KindArt = {
  size: [1.15, 0.95],
  // The hull a fat flattened egg, its front flatter; her head over its top, the hair down its back.
  outline:
    'M 0.36 -0.16 C 0.38 -0.32 0.34 -0.5 0.22 -0.56 C 0.18 -0.58 0.15 -0.59 0.13 -0.59 L 0.14 -0.7 C 0.16 -0.82 0.14 -0.95 0.06 -0.99 C 0 -1.01 -0.08 -1 -0.12 -0.95 C -0.16 -0.88 -0.17 -0.78 -0.18 -0.7 C -0.24 -0.66 -0.3 -0.64 -0.34 -0.6 C -0.46 -0.54 -0.5 -0.44 -0.5 -0.3 C -0.5 -0.12 -0.4 0 -0.2 0 L 0.2 0 C 0.3 0 0.34 -0.06 0.36 -0.16 Z',
  lift: 5,
  feet: 'none',
  arms: 'none',
  fill: 'player',
  faceX: 0.05,
  // A heavy, bobbing stomp, upright on its legs.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * (0.5 + 0.3 * g.run), rot: Math.sin(g.ph) * 0.02, pivot: 0, upright: 0.8 } : {}),
  back: (d) => {
    leg(d, -d.f);
    leg(d, d.f);
  },
  print: (d) => {
    const f = d.f;
    // The front, a light of the shell, with the porthole door on it.
    poly(
      d.s,
      [
        { x: f * d.W * 0.04, y: Y(d, 0.6) },
        { x: f * d.W * 0.42, y: Y(d, 0.6) },
        { x: f * d.W * 0.42, y: Y(d, -0.05) },
        { x: f * d.W * 0.04, y: Y(d, -0.05) },
      ],
      d.lk.playerHi,
    );
    tonedOval(d.s, f * d.W * 0.22, Y(d, 0.3), d.W * 0.11, d.H * 0.15, 12, GLASS, GLASS, METAL_SH, 0.5, 0.9 * d.k, 0);
    // Her head over the top: hair behind, the face in front.
    poly(d.s, oval(-f * d.W * 0.05, Y(d, 0.8), d.W * 0.17, d.H * 0.21, 12), HAIR);
    poly(d.s, oval(f * d.W * 0.04, Y(d, 0.77), d.W * 0.12, d.H * 0.15, 12), SKIN);
  },
  // The headphones' band over her crown and the near cup on the side of her head; the ducts out front.
  front: (d) => {
    const f = d.f;
    d.s.fillStyle = d.lk.ink;
    line(d.s, -f * d.W * 0.1, Y(d, 0.8), f * d.W * 0.04, Y(d, 1.01), { w: 0.9, seed: 3, taper: [0, 0], press: 0 });
    tonedOval(d.s, -f * d.W * 0.09, Y(d, 0.78), 1.1, 1.4, 10, WHITE, WHITE, d.lk.ink, 0.4, 0.7 * d.k, 0);
    ducts(d);
  },
  paintFace: (d) => pair(d, 0.78, 0.045, 0.5),
  parts: ['shard', 'shard', 'bolt'],
};
