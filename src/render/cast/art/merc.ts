import { brows, eye, mouthMark } from '../faces';
import { band, type D, type KindArt, mark, poly, rivet, spot, STEEL, STEEL_SH, TIN, toned, tonedOval, WOOD, WOOD_SH, Y } from '../kit';

/**
 * The spiky-haired mercenary (docs/characters/merc.md): a slim swordsman under a crown of big blond
 * spikes pointing up, a hubcap on one shoulder, and a giant serrated bread knife always in his hand, never
 * on his back (the plumber's plunger owns the back). A rendered kind draws from its frames
 * (src/render/cast/sprites/); this is what shows before they load, and on the hand-drawn sheets.
 */

const HAIR = '#f0d470';
const HAIR_SH = '#c9a84a';
const SINGE = '#3a2e28';
const SKIN = '#f0cfa8';
const LEATHER = '#6b4a35';
const LEATHER_SH = '#4d3426';
const BLADE = '#c9ccd2';
const BLADE_SH = '#8e9298';

/** The crown of spikes over the head: five, pointing up and back, the tallest part of him, their tips singed. */
function hair(d: D) {
  const x = d.bx(0.95);
  const W = d.W;
  const t = d.top;
  const f = d.f;
  const sway = d.wob * 0.3;
  const tips = [
    { x: x + f * W * 0.5, y: t + 0.2 },
    { x: x + f * W * 0.24, y: t - 4.4 + sway },
    { x: x - f * W * 0.12, y: t - 5.4 + sway },
    { x: x - f * W * 0.56, y: t - 3.2 + sway },
    { x: x - f * W * 0.7, y: Y(d, 0.7) },
  ];
  toned(
    d.s,
    [
      { x: x + f * W * 0.32, y: Y(d, 0.74) },
      tips[0],
      { x: x + f * W * 0.2, y: t + 0.8 },
      tips[1],
      { x: x + f * W * 0.04, y: t + 0.4 },
      tips[2],
      { x: x - f * W * 0.24, y: t + 0.8 },
      tips[3],
      { x: x - f * W * 0.38, y: Y(d, 0.86) },
      tips[4],
      { x: x - f * W * 0.34, y: Y(d, 0.64) },
      { x: x - f * W * 0.06, y: Y(d, 0.8) },
      { x: x + f * W * 0.12, y: Y(d, 0.76) },
    ],
    HAIR,
    HAIR_SH,
    d.lk.ink,
    0.4,
    0.8 * d.k,
    0.6,
  );
  // The singed tips: a dark nick at the end of the three tall spikes.
  for (const [i, tip] of [tips[1], tips[2], tips[3]].entries()) {
    const back = i === 2 ? -f : 0;
    mark(
      d.s,
      SINGE,
      [
        { x: tip.x + back * 0.2, y: tip.y + 0.1 },
        { x: tip.x - back * 0.9 + (i === 2 ? 0 : f * 0.3), y: tip.y + 1.3 },
      ],
      0.9,
      i,
      [0, 0.5],
    );
  }
}

/** The bread knife: a broad straight blade, saw teeth along its front edge, a rounded tip, no guard, a riveted wooden handle. */
function knife(d: D, hx: number, hy: number) {
  // Tip-down beside him at rest, its point on the floor and its handle up at his shoulder whatever his fist
  // does (he leans on it); slanting back behind him from the fist on the run and in the air.
  const rest = d.pose === 'rest';
  const a = rest ? Math.PI / 2 - d.f * 0.06 : Math.PI / 2 + d.f * (d.pose === 'run' ? 0.7 : 0.45);
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const oy = rest ? Math.min(hy, Y(d, 0.56)) : hy;
  // u along the blade from the handle's end toward the tip, v across it (its saw edge at +v, toward where he faces).
  const len = rest ? (-1.4 - oy) / sa : d.pose === 'run' ? Math.min(11, (-1.4 - oy) / sa) : 11;
  const at = (u: number, v: number) => ({ x: hx + ca * u + sa * v * d.f, y: oy + sa * u - ca * v * d.f });
  const w = 2.2;
  const teeth: { x: number; y: number }[] = [];
  const n = 6;
  const step = (len - 2.6) / n;
  // Tip end first, so the outline runs back up the saw edge.
  for (let i = n - 1; i >= 0; i--) teeth.push(at(1 + step * (i + 0.5), w + 0.7), at(1 + step * i, w));
  toned(d.s, [at(1, -w), at(len - 1, -w), at(len, -w * 0.2), at(len - 1.2, w), ...teeth], BLADE, BLADE_SH, d.lk.ink, 0.3, 0.6 * d.k, 0.5);
  toned(d.s, [at(-3.4, -0.9), at(1, -0.9), at(1, 0.9), at(-3.4, 0.9)], WOOD, WOOD_SH, d.lk.ink, 0.3, 0.6 * d.k, 0.3);
  rivet(d, at(-2.4, 0).x, at(-2.4, 0).y);
}

export const art: KindArt = {
  size: [0.84, 1.04],
  outline:
    'M 0.06 -0.98 C 0.28 -0.98 0.4 -0.86 0.38 -0.7 C 0.37 -0.62 0.32 -0.57 0.24 -0.55 C 0.3 -0.5 0.32 -0.4 0.3 -0.3 C 0.36 -0.2 0.42 -0.08 0.4 0 L -0.38 0 C -0.42 -0.1 -0.34 -0.22 -0.28 -0.3 C -0.3 -0.42 -0.28 -0.5 -0.22 -0.55 C -0.34 -0.6 -0.38 -0.72 -0.34 -0.82 C -0.28 -0.94 -0.14 -0.98 0.06 -0.98 Z',
  lift: 2.6,
  feet: 'boot',
  boots: [LEATHER, LEATHER_SH],
  arms: 'mitten',
  hands: 'leather',
  fill: 'player',
  faceX: 0.02,
  // A low, loping run.
  gait: (g) => (g.moving ? { hop: Math.abs(Math.sin(g.ph)) * 0.45, bend: 0.06 + g.run * 0.06, upright: 0.7 } : {}),
  paintFace: (d) => {
    const y = Y(d, 0.7);
    const xs = [-d.W * 0.1 + d.f * 0.5, d.W * 0.1 + d.f * 0.5];
    for (const x of xs) eye(d, x, y, 0.8);
    brows(d, xs, y, 0.85);
    mouthMark(d, d.f * 1.2, Y(d, 0.6), 1.8, 'flat');
  },
  print: (d) => {
    // The face in skin, the trousers a dark of the player's colour, two leather belts crossed at the hip.
    spot(d.s, d.f * d.W * 0.2, Y(d, 0.69), d.W * 0.42, d.H * 0.16, d.sd, SKIN, 0.05);
    band(d, -0.1, 0.3, d.lk.playerDark);
    band(d, 0.28, 0.33, LEATHER, 0.5);
    band(d, 0.24, 0.28, LEATHER_SH, -0.5);
  },
  back: (d) => {
    // The hubcap on the far shoulder, standing out behind him.
    const x = -d.f * d.W * 0.36 + d.bx(0.5);
    const y = Y(d, 0.47);
    tonedOval(d.s, x, y, 2.5, 2.4, 12, STEEL, STEEL_SH, d.lk.ink, 0.3, 0.7 * d.k, 0.5);
    poly(
      d.s,
      [
        { x: x - 0.5, y: y - 0.5 },
        { x: x + 0.5, y: y - 0.5 },
        { x: x + 0.5, y: y + 0.5 },
        { x: x - 0.5, y: y + 0.5 },
      ],
      TIN,
    );
  },
  front: hair,
  tool: knife,
  parts: ['shard', 'shard', 'bolt'],
};
