import { brows, eye, mouthMark } from '../faces';
import { type D, type KindArt, mark, poly, spot, toned, Y } from '../kit';

/**
 * The little purple dragon (docs/characters/dragon.md): small and low on four stubby legs, side on, a big round
 * head with two long horns swept straight back off it, stubby wings of umbrella cloth on bent spokes standing up
 * off the shoulders, a pale belly, a ridge of small spines, and a tail out behind ending in an arrowhead, a firefly
 * in a jam jar tied to it. A rendered kind draws from its frames (src/render/cast/sprites/); this is what shows
 * before they load, and on the hand-drawn sheets.
 */

const BONE = '#ecdcb8';
const BONE_SH = '#c9b48e';
const GLASS = '#d8e6e8';
const GLASS_SH = '#a9bcc0';
const TAPE = '#9a9c98';

/** Where the tail ends (world px, facing right): the arrowhead and the jar hang from it. */
function tailEnd(d: D, swing: number) {
  return { x: -d.f * (d.W * 0.5 + 3.2) + swing, y: Y(d, 0.66) };
}

/** The tail curving out behind from the rump, its arrowhead tip taped, and the firefly jar swinging under it. */
function tail(d: D) {
  const W = d.W;
  const f = d.f;
  const swing = d.p.grounded && Math.abs(d.p.vx) < 1 ? 0 : -f * 0.8;
  const sway = d.wob * 0.3;
  const end = tailEnd(d, swing);
  toned(
    d.s,
    [
      { x: -f * W * 0.34, y: Y(d, 0.56) },
      { x: -f * W * 0.5 + swing * 0.5, y: Y(d, 0.5) },
      { x: end.x - f * 0.2, y: end.y - 0.4 },
      { x: end.x + f * 0.5, y: end.y + 0.5 },
      { x: -f * W * 0.48 + swing * 0.5, y: Y(d, 0.32) },
      { x: -f * W * 0.36, y: Y(d, 0.3) },
    ],
    d.lk.fill,
    d.lk.fillShade,
    d.lk.ink,
    0.3,
    0.6 * d.k,
    0.3,
  );
  // The arrowhead, pointing up and back, with a band of grey tape round its base.
  toned(
    d.s,
    [
      { x: end.x + f * 0.9, y: end.y - 0.2 },
      { x: end.x - f * 1.4, y: end.y - 3 },
      { x: end.x - f * 1.7, y: end.y + 0.3 },
    ],
    BONE,
    BONE_SH,
    d.lk.ink,
    0.3,
    0.6 * d.k,
    0.3,
  );
  mark(
    d.s,
    TAPE,
    [
      { x: end.x - f * 0.2, y: end.y - 1.3 },
      { x: end.x + f * 0.5, y: end.y - 0.5 },
    ],
    0.7,
    d.sd + 2,
    [0.1, 0.1],
  );
  // The jam jar on its string, a pale glow inside.
  const jx = end.x + f * 0.4 + sway;
  const jy = end.y + 2.6;
  mark(
    d.s,
    d.lk.ink,
    [
      { x: end.x + f * 0.4, y: end.y + 0.3 },
      { x: jx, y: jy - 0.9 },
    ],
    0.25,
    d.sd + 3,
    [0.1, 0.1],
  );
  toned(
    d.s,
    [
      { x: jx - 0.8, y: jy - 0.9 },
      { x: jx + 0.8, y: jy - 0.9 },
      { x: jx + 0.8, y: jy + 1.1 },
      { x: jx - 0.8, y: jy + 1.1 },
    ],
    GLASS,
    GLASS_SH,
    d.lk.ink,
    0.25,
    0.5 * d.k,
    0.3,
  );
  spot(d.s, jx, jy + 0.2, 0.35, 0.35, d.sd + 4, '#f4f0c8', 0.05);
}

/** One umbrella wing: three bent spokes fanned up and back from the shoulder, the cloth scalloped between their knobs. */
function wing(d: D, rx: number, ry: number, fill: string, shade: string, lift: number) {
  const f = d.f;
  const tips = [
    { x: rx - f * 1.6, y: ry - 5.2 - lift },
    { x: rx - f * 4.2, y: ry - 4 - lift },
    { x: rx - f * 5.4, y: ry - 1.6 - lift * 0.5 },
  ];
  const scallop = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2 + f * 0.5,
    y: (a.y + b.y) / 2 + 0.7,
  });
  toned(
    d.s,
    [{ x: rx, y: ry }, tips[0], scallop(tips[0], tips[1]), tips[1], scallop(tips[1], tips[2]), tips[2], { x: rx - f * 2, y: ry + 0.6 }],
    fill,
    shade,
    d.lk.ink,
    0.3,
    0.5 * d.k,
    0.3,
  );
  for (const t of tips) {
    mark(d.s, d.lk.ink, [{ x: rx, y: ry }, { x: (rx + t.x) / 2 - f * 0.3, y: (ry + t.y) / 2 - 0.3 }, t], 0.3, d.sd + 5, [0.2, 0.2]);
    spot(d.s, t.x, t.y, 0.35, 0.35, d.sd + 6, d.lk.ink, 0.05);
  }
}

/** Both wings standing up off the shoulders, flicking on the trot and flung up in the air. */
function wings(d: D) {
  const lift = d.p.grounded ? Math.abs(Math.sin(d.ph)) * 0.8 : 1.4;
  wing(d, d.f * d.W * 0.12, Y(d, 0.6), d.lk.playerShade, d.lk.playerDark, lift * 0.8);
  wing(d, d.f * d.W * 0.02, Y(d, 0.58), d.lk.playerHi, d.lk.player, lift);
}

/** The two long horns swept straight back off the top of the head, longer than the head. */
function horns(d: D) {
  const W = d.W;
  const f = d.f;
  for (const [x, y, len] of [
    [0.3, 0.97, 6.4],
    [0.36, 0.95, 5.6],
  ] as const) {
    const rx = f * W * x;
    const ry = Y(d, y);
    toned(
      d.s,
      [
        { x: rx - f * 0.7, y: ry + 0.5 },
        { x: rx + f * 0.7, y: ry },
        { x: rx - f * len, y: ry - 2.6 },
      ],
      BONE,
      BONE_SH,
      d.lk.ink,
      0.3,
      0.6 * d.k,
      0.3,
    );
  }
}

/** The ridge of small bone spines along the top of the back. */
function spines(d: D) {
  const f = d.f;
  for (const u of [-0.3, -0.18, -0.06, 0.06])
    poly(
      d.s,
      [
        { x: f * d.W * (u - 0.04), y: Y(d, 0.57) + 0.3 },
        { x: f * d.W * (u - 0.02), y: Y(d, 0.57) - 1.3 },
        { x: f * d.W * (u + 0.04), y: Y(d, 0.57) + 0.3 },
      ],
      BONE,
    );
}

export const art: KindArt = {
  size: [1.3, 0.95],
  // Side on: a low barrel body on four stubby legs, and a big round head up front with a short blunt snout.
  outline:
    'M -0.38 -0.52 C -0.2 -0.6 0 -0.6 0.12 -0.62 C 0.14 -0.8 0.2 -0.98 0.32 -1 C 0.42 -1 0.46 -0.9 0.47 -0.82 L 0.52 -0.78 C 0.55 -0.74 0.54 -0.66 0.5 -0.64 C 0.42 -0.6 0.34 -0.6 0.3 -0.56 C 0.3 -0.48 0.3 -0.4 0.29 -0.32 L 0.29 0 L 0.18 0 L 0.18 -0.24 L 0.14 -0.24 L 0.14 0 L 0.05 0 L 0.05 -0.28 C -0.06 -0.26 -0.14 -0.26 -0.2 -0.28 L -0.2 0 L -0.29 0 L -0.29 -0.24 L -0.33 -0.24 L -0.33 0 L -0.42 0 L -0.42 -0.3 C -0.46 -0.38 -0.45 -0.48 -0.38 -0.52 Z',
  lift: 0.1,
  feet: 'none',
  arms: 'none',
  fill: 'player',
  faceX: 0,
  // A quick scampering trot: a hop on every step, rocking a little nose to tail.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * (0.5 + g.run * 0.4), rot: Math.sin(g.ph) * 0.04 * g.run, pivot: 0.3, upright: 0.6 } : {}),
  paintFace: (d) => {
    const y = Y(d, 0.82);
    const xs = [d.f * d.W * 0.36, d.f * d.W * 0.43];
    eye(d, xs[0], y, 0.75);
    eye(d, xs[1], y - 0.2, 0.5);
    brows(d, xs, y, 0.75);
  },
  print: (d) => {
    // The pale belly from the throat back under the body.
    poly(
      d.s,
      [
        { x: d.f * d.W * 0.29, y: Y(d, 0.58) },
        { x: d.f * d.W * 0.29, y: Y(d, 0.34) },
        { x: d.f * d.W * 0.05, y: Y(d, 0.28) },
        { x: -d.f * d.W * 0.2, y: Y(d, 0.29) },
        { x: -d.f * d.W * 0.08, y: Y(d, 0.36) },
        { x: d.f * d.W * 0.2, y: Y(d, 0.42) },
      ],
      BONE,
    );
  },
  back: (d) => {
    tail(d);
    wings(d);
  },
  front: (d) => {
    spines(d);
    horns(d);
  },
  snout: (d) => {
    spot(d.s, d.f * d.W * 0.51, Y(d, 0.75), 0.25, 0.3, d.sd + 3, d.lk.eye, 0.05);
    mouthMark(d, d.f * d.W * 0.45, Y(d, 0.66), 1.4, 'smile');
  },
  parts: ['shard', 'shard'],
};
