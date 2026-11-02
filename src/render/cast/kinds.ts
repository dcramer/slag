import type { Kind } from '../../gen/character';
import type { P } from '../ink';
import { eye, goggles, mask, mouthMark, pair, sideEye, slit, tallEyes } from './faces';
import {
  type D,
  IRON,
  type KindArt,
  line,
  livery,
  mark,
  ORANGE,
  ORANGE_SH,
  oval,
  poly,
  rivet,
  spot,
  stalk,
  STEEL,
  STEEL_SH,
  stroke,
  toned,
  tonedOval,
  Y,
} from './kit';

/**
 * The cast, one hand-designed character per kind (docs/CHARACTERS.md): six animals and six critters, some
 * of them homages to famous game characters in our own designs. Each is its own character the way a
 * barnyard party game's animals are: its own outline inked as curves, one signature part that breaks the
 * outline, and a way of moving that's its own. The seed only picks the kind, the natural colors and the
 * player's color; the design is fixed.
 *
 * Outlines are authored facing right in body units (x across -0.5..0.5 of the width, y up to -1); hooks
 * put a part on the front with `d.f`. Gaits are animation only: everyone's physics are the same.
 */

const S = Math.sin;
const abs = Math.abs;
const SKIN = '#efc9a4';
const SKIN_SH = '#cf9f7c';
const BONE = '#efe6d2';
const BONE_SH = '#c8bba0';
const BROWN = '#6b4a35';
const BROWN_SH = '#4d3426';
const DENIM = '#55606e';

/** A pointed ear standing on the head: base from x0 to x1, tip at (tx, ty). */
function ear(d: D, x0: number, x1: number, tx: number, ty: number, fill: string, shade: string, inner?: string) {
  toned(
    d.s,
    [
      { x: x0, y: ty + 5 },
      { x: tx, y: ty },
      { x: x1, y: ty + 5.4 },
    ],
    fill,
    shade,
    d.lk.ink,
    0.4,
    0.8 * d.k,
    0.5,
  );
  if (inner)
    poly(
      d.s,
      [
        { x: x0 + (x1 - x0) * 0.3, y: ty + 4.4 },
        { x: tx + (x0 - tx) * 0.1, y: ty + 1.4 },
        { x: x0 + (x1 - x0) * 0.75, y: ty + 4.6 },
      ],
      inner,
    );
}

/** A beak or bill out of the front of a head at (x, y). */
function beak(d: D, x: number, y: number, len: number, h: number, open = 0) {
  toned(
    d.s,
    [
      { x: x - d.f * 0.6, y: y - h },
      { x: x + d.f * len, y: y + 0.1 },
      { x: x - d.f * 0.6, y: y + h + open },
    ],
    ORANGE,
    ORANGE_SH,
    d.lk.ink,
    0.35,
    0.7 * d.k,
    0.4,
  );
}

const moving = (d: D) => d.m === 'walk' || d.m === 'run';

export const KINDS: Record<Kind, KindArt> = {
  // Long and low, a pointed snout well out in front, tall ears, a bushy tail streaming behind. Trots.
  fox: {
    size: [1.24, 0.8],
    outline:
      'M -0.46 -0.12 C -0.52 -0.38 -0.4 -0.56 -0.16 -0.6 C 0.02 -0.62 0.12 -0.66 0.18 -0.76 C 0.22 -0.9 0.3 -0.96 0.4 -0.94 C 0.5 -0.9 0.54 -0.82 0.68 -0.76 C 0.62 -0.68 0.52 -0.66 0.46 -0.6 C 0.44 -0.44 0.46 -0.24 0.38 -0.08 C 0.32 0 0.2 0 0.1 0 L -0.36 0 C -0.42 0 -0.46 -0.06 -0.46 -0.12 Z',
    lift: 2.4,
    feet: 'paw',
    arms: 'none',
    faceX: 0.34,
    rope: { kind: 'tail', len: 7 },
    gait: (g) => (g.moving ? { hop: abs(S(g.ph * 2)) * 0.9, rot: S(g.ph * 2) * 0.03, pivot: 0, upright: 0.6 } : {}),
    paintFace: (d) => {
      eye(d, d.f * 0.6, Y(d, 0.84), 0.75);
      poly(d.s, oval(d.f * d.W * 0.33, Y(d, 0.77), 0.8, 0.65, 7), d.lk.eye);
    },
    print: (d) => {
      // The pale chest and muzzle.
      spot(d.s, d.f * d.W * 0.38, Y(d, 0.42), d.W * 0.16, d.H * 0.34, d.sd, d.lk.paint, 0.15);
      spot(d.s, d.f * d.W * 0.5, Y(d, 0.7), d.W * 0.16, d.H * 0.08, d.sd + 1, d.lk.paint, 0.15);
    },
    front: (d) => {
      const x = d.bx(1);
      ear(d, x + d.f * d.W * 0.2, x + d.f * d.W * 0.32, x + d.f * d.W * 0.22, d.top - 4.4, d.lk.fill, d.lk.fillShade, d.lk.playerDark);
      ear(d, x + d.f * d.W * 0.32, x + d.f * d.W * 0.44, x + d.f * d.W * 0.38, d.top - 3.6, d.lk.fill, d.lk.fillShade, d.lk.playerDark);
    },
    parts: ['shard', 'shard'],
  },

  // Crouched flat, haunches high at the back, two eye bumps up front. Crouches and leaps.
  frog: {
    size: [1.3, 0.7],
    outline:
      'M -0.5 -0.1 C -0.56 -0.4 -0.4 -0.64 -0.18 -0.7 C -0.06 -0.74 0 -0.76 0.03 -0.8 C 0.06 -1 0.24 -1 0.26 -0.84 C 0.28 -0.78 0.31 -0.78 0.33 -0.84 C 0.37 -1 0.54 -0.96 0.52 -0.78 C 0.5 -0.6 0.56 -0.4 0.5 -0.24 C 0.46 -0.1 0.3 0 0.1 0 L -0.36 0 C -0.46 0 -0.5 -0.04 -0.5 -0.1 Z',
    lift: 2.3,
    feet: 'none',
    arms: 'none',
    shine: true,
    gait: (g) => {
      if (!g.grounded) return { k: 1, sy: 1.08, sx: 0.94 };
      if (!g.moving) return { k: 0 };
      const a = S(g.ph * 0.5);
      return a > 0 ? { hop: a * (2.4 + g.run * 1.6), k: a, sy: 1 + a * 0.1, sx: 1 - a * 0.06, rot: -0.12 * a } : { k: 0, sy: 1 + a * 0.14, sx: 1 - a * 0.1 };
    },
    paintFace: (d) => {
      for (const u of [0.145, 0.43]) {
        const x = d.f * d.W * u;
        const y = Y(d, 0.86);
        poly(d.s, oval(x, y, 1.4, 1.3, 10), '#f6f1e6');
        eye(d, x + d.f * 0.3, y + 0.1, 0.7, false);
      }
      const y = Y(d, 0.56);
      mark(
        d.s,
        d.lk.ink,
        [
          { x: d.f * d.W * 0.12, y: y - 0.4 },
          { x: d.f * d.W * 0.32, y: y + 0.6 },
          { x: d.f * d.W * 0.5, y: y - 0.5 },
        ],
        0.8,
        d.sd,
        [0.15, 0.15],
      );
    },
    print: (d) => spot(d.s, d.f * d.W * 0.14, Y(d, 0.12), d.W * 0.38, d.H * 0.3, d.sd, d.lk.paint, 0.1),
    back: (d) => {
      // The hind leg: folded under the haunch, kicked out long on the leap.
      const k = d.gait.k ?? 0;
      const hx = -d.f * d.W * 0.34;
      const knee = { x: hx - d.f * (2.4 + k * 1.6), y: d.by - 1.2 + k * 1.6 };
      const foot = { x: hx - d.f * (0.6 + k * 4.6), y: -0.4 + k * 2.2 };
      d.s.fillStyle = d.lk.ink;
      stroke(d.s, [{ x: hx, y: Y(d, 0.3) }, knee, foot], { w: 2.6 * d.k + 1, seed: 5, taper: [0, 0.3], press: 0 });
      d.s.fillStyle = d.lk.fill;
      stroke(d.s, [{ x: hx, y: Y(d, 0.3) }, knee, foot], { w: 1.6, seed: 5, taper: [0, 0.3], press: 0 });
      toned(
        d.s,
        [
          { x: foot.x - d.f * 0.6, y: foot.y - 1 },
          { x: foot.x - d.f * 3, y: foot.y + 0.4 },
          { x: foot.x + d.f * 0.8, y: foot.y + 0.8 },
        ],
        d.lk.fill,
        d.lk.fillShade,
        d.lk.ink,
        0.4,
        0.7 * d.k,
        0.4,
      );
    },
    parts: ['shard', 'shard'],
  },

  // A dome of spines, ragged along the back, a pointed snout. Scurries; curls into a spinning ball in the air.
  hedgehog: {
    size: [1.14, 0.84],
    outline:
      'M -0.44 -0.04 L -0.56 -0.24 L -0.46 -0.32 L -0.58 -0.5 L -0.42 -0.56 L -0.48 -0.76 L -0.3 -0.74 L -0.28 -0.94 L -0.12 -0.84 L -0.02 -1 L 0.1 -0.86 L 0.24 -0.96 L 0.28 -0.78 L 0.4 -0.8 C 0.42 -0.66 0.5 -0.52 0.64 -0.4 C 0.62 -0.32 0.54 -0.28 0.46 -0.26 C 0.42 -0.12 0.32 0 0.16 0 L -0.32 0 C -0.4 0 -0.44 -0.02 -0.44 -0.04 Z',
    lift: 2.2,
    feet: 'paw',
    arms: 'none',
    faceX: 0.34,
    gait: (g) => {
      if (!g.grounded && g.vy < 120) return { rot: (g.t * 16) % (Math.PI * 2), pivot: 0.5, sx: 0.92, sy: 0.92 };
      return g.moving ? { hop: abs(S(g.ph * 3)) * 0.4, rot: S(g.ph * 3) * 0.03, pivot: 0 } : {};
    },
    paintFace: (d) => {
      eye(d, d.f * 0.2, Y(d, 0.56), 0.7);
      poly(d.s, oval(d.f * d.W * 0.3, Y(d, 0.4), 0.7, 0.6, 7), d.lk.eye);
    },
    print: (d) => {
      // The bare face and belly, and a few spine strokes.
      spot(d.s, d.f * d.W * 0.4, Y(d, 0.32), d.W * 0.24, d.H * 0.34, d.sd, d.lk.paint, 0.1);
      for (let i = 0; i < 4; i++)
        mark(
          d.s,
          d.lk.fillShade,
          [
            { x: -d.W * (0.36 - i * 0.12), y: Y(d, 0.3 + i * 0.1) },
            { x: -d.W * (0.44 - i * 0.12), y: Y(d, 0.56 + i * 0.1) },
          ],
          0.7,
          d.sd + i,
          [0.1, 0.5],
        );
    },
    parts: ['shard', 'shard'],
  },

  // Squat and round-backed, a short snout, round ears, a masked face and a ringed tail. Sneaks, hunched.
  raccoon: {
    size: [1.1, 0.86],
    outline:
      'M -0.42 -0.06 C -0.52 -0.4 -0.36 -0.7 -0.06 -0.76 C -0.04 -0.92 0.06 -1 0.2 -0.98 C 0.36 -0.96 0.44 -0.86 0.46 -0.74 C 0.56 -0.68 0.6 -0.62 0.56 -0.56 C 0.5 -0.5 0.44 -0.5 0.42 -0.46 C 0.46 -0.3 0.42 -0.1 0.3 0 L -0.32 0 C -0.38 0 -0.42 -0.02 -0.42 -0.06 Z',
    lift: 2.4,
    feet: 'paw',
    arms: 'none',
    faceX: 0.2,
    rope: { kind: 'ringtail', len: 7 },
    gait: (g) => (g.moving ? { hop: abs(S(g.ph)) * 0.4, bend: 0.08, sy: 0.95, upright: 0.5 } : { bend: 0.03 }),
    paintFace: (d) => {
      mask(d, 0.76, 0.1);
      poly(d.s, oval(d.f * d.W * 0.34, Y(d, 0.56), 0.7, 0.6, 7), d.lk.eye);
    },
    print: (d) => {
      spot(d.s, d.f * d.W * 0.36, Y(d, 0.56), d.W * 0.18, d.H * 0.1, d.sd, d.lk.paint, 0.1);
      spot(d.s, d.f * d.W * 0.18, Y(d, 0.18), d.W * 0.24, d.H * 0.2, d.sd + 1, d.lk.paint, 0.1);
    },
    front: (d) => {
      for (const u of [0.06, 0.32]) {
        const x = d.bx(1) + d.f * d.W * u;
        tonedOval(d.s, x, d.top + 0.6, 1.8, 1.7, 10, d.lk.fill, d.lk.fillShade, d.lk.ink, 0.4, 0.8 * d.k, 0.5);
        poly(d.s, oval(x, d.top + 0.9, 0.9, 0.8, 8), d.lk.paint);
      }
    },
    parts: ['shard', 'shard'],
  },

  // Upright, a pale front, flippers, a little beak. Waddles side to side.
  penguin: {
    size: [0.84, 1],
    outline:
      'M 0.06 -1 C 0.3 -1 0.4 -0.86 0.38 -0.7 C 0.42 -0.6 0.44 -0.5 0.44 -0.34 C 0.44 -0.14 0.34 0 0.12 0 L -0.18 0 C -0.38 0 -0.48 -0.16 -0.46 -0.36 C -0.44 -0.62 -0.3 -0.98 0.06 -1 Z',
    lift: 2.4,
    feet: 'web',
    arms: 'flipper',
    hands: 'body',
    faceX: 0.1,
    gait: (g) => (g.moving ? { rot: S(g.ph) * 0.14, pivot: 0, upright: 0.3 } : { rot: S(g.t * 1.5) * 0.02, pivot: 0 }),
    paintFace: (d) => pair(d, 0.8, 0.12, 0.7, 0),
    print: (d) => {
      const pts: P[] = [];
      for (let i = 0; i <= 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        pts.push({ x: d.f * d.W * 0.1 + Math.cos(a) * d.W * 0.3, y: Y(d, 0.36) + Math.sin(a) * d.H * 0.4 });
      }
      poly(d.s, pts, d.lk.paint);
    },
    snout: (d) => beak(d, d.f * d.W * 0.22, Y(d, 0.72), 2.2, 0.8, d.m === 'cheer' ? 0.8 : 0),
    parts: ['shard', 'shard'],
  },

  // Tall and bottom-heavy on thin legs, a red comb, tail feathers up behind. Struts, head bobbing.
  chicken: {
    size: [0.9, 1.04],
    outline:
      'M 0.14 -1 C 0.3 -1 0.36 -0.9 0.34 -0.8 C 0.34 -0.72 0.3 -0.66 0.28 -0.6 C 0.44 -0.5 0.52 -0.3 0.44 -0.14 C 0.36 0 0.1 0 -0.1 0 C -0.36 0 -0.5 -0.14 -0.5 -0.3 C -0.5 -0.4 -0.56 -0.5 -0.64 -0.66 C -0.54 -0.64 -0.46 -0.58 -0.4 -0.5 C -0.3 -0.56 -0.1 -0.58 -0.04 -0.64 C -0.04 -0.8 0 -1 0.14 -1 Z',
    lift: 3.4,
    feet: 'stilt',
    arms: 'none',
    faceX: 0.18,
    gait: (g) => {
      if (!g.moving) return { rot: S(g.t * 2.2 + g.seed) > 0.85 ? 0.14 : 0, pivot: 0 };
      return { hop: abs(S(g.ph)) * 0.6, bend: S(g.ph * 2) * 0.08, upright: 0.4 };
    },
    paintFace: (d) => sideEye(d, 0.88, d.f * 0.2, 0.75),
    print: (d) =>
      toned(d.s, oval(-d.f * d.W * 0.08, Y(d, 0.32), d.W * 0.26, d.H * 0.16, 12, -d.f * 0.3), d.lk.fillShade, d.lk.playerDark, d.lk.ink, 0.05, 0.1, 0.4),
    front: (d) => {
      // The comb.
      const x = d.bx(1) + d.f * d.W * 0.16;
      for (let i = 0; i < 3; i++)
        tonedOval(d.s, x + d.f * (i - 1) * 1.3, d.top - 0.6 - (i === 1 ? 0.6 : 0), 1.1, 1.3, 8, d.lk.paint, d.lk.paintShade, d.lk.ink, 0.3, 0.6 * d.k, 0.4);
    },
    snout: (d) => {
      beak(d, d.f * d.W * 0.18, Y(d, 0.82), 2, 0.7, d.m === 'cheer' ? 0.7 : 0);
      tonedOval(d.s, d.f * d.W * 0.18, Y(d, 0.72), 0.7, 1.1, 8, d.lk.paint, d.lk.paintShade, d.lk.ink, 0.3, 0.6 * d.k, 0.4);
    },
    parts: ['shard', 'shard'],
  },

  // A jellyfish-brained floater: a domed membrane over glowing-looking nuclei (flat, not glowing), four
  // fangs hanging under it. Bobs in the air and chomps; never touches the floor.
  jelly: {
    size: [1.1, 1],
    outline:
      'M 0 -1 C 0.34 -1 0.52 -0.76 0.52 -0.5 C 0.52 -0.36 0.46 -0.3 0.4 -0.28 C 0.3 -0.3 0.24 -0.26 0.16 -0.28 C 0.06 -0.3 -0.06 -0.3 -0.16 -0.28 C -0.24 -0.26 -0.3 -0.3 -0.4 -0.28 C -0.46 -0.3 -0.52 -0.36 -0.52 -0.5 C -0.52 -0.76 -0.34 -1 0 -1 Z',
    lift: 1,
    feet: 'none',
    arms: 'none',
    shine: true,
    gait: (g) => {
      const b = S(g.t * 3 + g.seed);
      return { hop: 1.6 + b * 0.9 + (g.moving ? abs(S(g.ph)) * 0.6 : 0), sx: 1 + b * 0.04, sy: 1 - b * 0.04, upright: 0.4, k: S(g.t * (g.moving ? 9 : 4)) };
    },
    paintFace: () => {},
    print: (d) => {
      // The nuclei, and a pale rim inside the membrane's hem.
      livery(d, 0.28, 0.36);
      for (const [u, x, r] of [
        [0.66, -0.16, 2.2],
        [0.7, 0.14, 2],
        [0.5, 0, 1.8],
      ] as const)
        tonedOval(d.s, d.f * d.W * x, Y(d, u), r, r * 0.9, 10, d.lk.paint, d.lk.paintShade, d.lk.ink, 0.2, 0.4, 0.4);
      for (let i = 0; i < 3; i++) poly(d.s, oval(d.f * d.W * (-0.3 + i * 0.3), Y(d, 0.84 - (i % 2) * 0.04), 0.6, 0.5, 6), d.lk.playerHi);
    },
    back: (d) => {
      // Four fangs that chomp.
      const chomp = (d.gait.k ?? 0) * 0.25;
      for (const [x, sd] of [
        [-0.3, -1],
        [-0.1, -1],
        [0.1, 1],
        [0.3, 1],
      ] as const) {
        const x0 = d.W * x;
        const y0 = Y(d, 0.3);
        const a = Math.PI / 2 + sd * (0.25 + chomp);
        const tip = { x: x0 + Math.cos(a) * 4.6, y: y0 + Math.sin(a) * 4.6 };
        toned(
          d.s,
          [
            { x: x0 - 1, y: y0 },
            { x: (x0 + tip.x) / 2 - sd * 0.8, y: (y0 + tip.y) / 2 },
            tip,
            { x: (x0 + tip.x) / 2 + sd * 0.2, y: (y0 + tip.y) / 2 },
            { x: x0 + 1, y: y0 },
          ],
          BONE,
          BONE_SH,
          d.lk.ink,
          0.3,
          0.6 * d.k,
          0.3,
        );
      }
    },
    parts: ['shard', 'shard'],
  },

  // A mustached plumber: a cap with its bill out front, a big round nose, overalls, white gloves, boots.
  // Runs jaunty, arms pumping. His cap and overalls are the player's color.
  plumber: {
    size: [0.92, 1],
    outline:
      'M -0.02 -0.86 C 0.2 -0.88 0.36 -0.8 0.38 -0.66 C 0.5 -0.66 0.58 -0.6 0.54 -0.54 C 0.5 -0.5 0.42 -0.5 0.38 -0.48 C 0.4 -0.42 0.42 -0.36 0.42 -0.3 C 0.46 -0.14 0.4 0 0.24 0 L -0.3 0 C -0.42 0 -0.48 -0.14 -0.46 -0.3 C -0.44 -0.5 -0.3 -0.6 -0.32 -0.7 C -0.34 -0.82 -0.2 -0.86 -0.02 -0.86 Z',
    lift: 2.8,
    feet: 'boot',
    boots: [BROWN, BROWN_SH],
    arms: 'mitten',
    hands: 'glove',
    fill: 'paint',
    faceX: 0.1,
    gait: (g) => (g.moving ? { hop: abs(S(g.ph)) * 1, bend: 0.04, upright: 0.8 } : {}),
    paintFace: (d) => {
      for (const sd of [-1, 1]) {
        const x = sd * d.W * 0.1 + d.f * 0.8;
        if (d.m === 'cheer')
          mark(
            d.s,
            d.lk.eye,
            [
              { x: x - 0.8, y: Y(d, 0.7) + 0.3 },
              { x, y: Y(d, 0.7) - 0.5 },
              { x: x + 0.8, y: Y(d, 0.7) + 0.3 },
            ],
            0.8,
            sd,
            [0.2, 0.2],
          );
        else poly(d.s, oval(x, Y(d, 0.7), 0.6, d.m === 'fall' ? 1.3 : 1.05, 8), d.lk.eye);
      }
    },
    print: (d) => {
      // Skin for the face, the player's overalls up to two straps, two buttons.
      spot(d.s, d.f * d.W * 0.1, Y(d, 0.68), d.W * 0.42, d.H * 0.2, d.sd, SKIN, 0.05);
      livery(d, -0.2, 0.36);
      for (const sd of [-1, 1]) {
        mark(
          d.s,
          d.lk.player,
          [
            { x: sd * d.W * 0.2, y: Y(d, 0.34) },
            { x: sd * d.W * 0.18, y: Y(d, 0.5) },
          ],
          1.8,
          sd,
          [0, 0],
        );
        poly(d.s, oval(sd * d.W * 0.18, Y(d, 0.36), 0.6, 0.6, 6), '#f2d37a');
      }
    },
    front: (d) => {
      // The cap: a dome over the head, its bill out front, a pale badge.
      const x = d.bx(0.9);
      const brim = Y(d, 0.78);
      toned(
        d.s,
        [
          { x: x - d.W * 0.44, y: brim + 0.6 },
          { x: x - d.W * 0.36, y: d.top - 1.6 },
          { x: x + d.f * d.W * 0.06, y: d.top - 2.6 },
          { x: x + d.W * 0.36, y: d.top - 1.4 },
          { x: x + d.W * 0.44, y: brim + 0.6 },
        ],
        d.lk.player,
        d.lk.playerShade,
        d.lk.ink,
        0.4,
        0.8 * d.k,
        0.6,
      );
      toned(
        d.s,
        [
          { x: x + d.f * d.W * 0.2, y: brim - 0.6 },
          { x: x + d.f * d.W * 0.66, y: brim + 0.2 },
          { x: x + d.f * d.W * 0.6, y: brim + 1.2 },
          { x: x + d.f * d.W * 0.18, y: brim + 0.8 },
        ],
        d.lk.player,
        d.lk.playerShade,
        d.lk.ink,
        0.3,
        0.7 * d.k,
        0.4,
      );
      tonedOval(d.s, x + d.f * 0.6, Y(d, 0.9), 1.4, 1.3, 9, '#fbf6ee', '#d8d0c2', d.lk.ink, 0.25, 0.5, 0.4);
    },
    snout: (d) => {
      // The nose, and the mustache under it.
      const x = d.f * d.W * 0.36;
      const y = Y(d, 0.57);
      tonedOval(d.s, x, y - 0.6, 1.9, 1.6, 10, SKIN, SKIN_SH, d.lk.ink, 0.35, 0.7 * d.k, 0.5);
      const m: P[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * (i / 8);
        m.push({ x: x - d.f * 1 + Math.cos(a) * 3.2, y: y + 1.2 + Math.sin(a) * 1.4 - (i % 2) * 0.5 });
      }
      poly(d.s, m, BROWN_SH);
    },
    parts: ['coin', 'coin', 'shard'],
  },

  // A robot: a big TV-set head, dented on one corner, on a neck pinch and a barrel chest. Stomps, jerky.
  robot: {
    size: [0.9, 1.04],
    outline:
      'M -0.36 -1 L 0.36 -0.98 C 0.44 -0.98 0.46 -0.94 0.45 -0.86 L 0.42 -0.68 C 0.41 -0.63 0.3 -0.62 0.14 -0.6 C 0.4 -0.56 0.5 -0.42 0.48 -0.24 C 0.46 -0.06 0.3 0 0 0 C -0.3 0 -0.46 -0.06 -0.48 -0.24 C -0.5 -0.42 -0.4 -0.56 -0.14 -0.6 C -0.3 -0.62 -0.41 -0.63 -0.42 -0.68 L -0.44 -0.9 C -0.44 -0.97 -0.41 -1 -0.36 -1 Z',
    lift: 3.2,
    feet: 'peg',
    arms: 'mitten',
    hands: 'iron',
    fill: 'paint',
    shine: true,
    gait: (g) => (g.moving ? { hop: S(g.ph) > 0 ? 0.8 : 0, rot: (S(g.ph) > 0 ? 1 : -1) * 0.04, upright: 0.4 } : {}),
    paintFace: (d) => slit(d, 0.82),
    print: (d) => {
      livery(d, -0.2, 0.58);
      tonedOval(d.s, d.f * 0.6, Y(d, 0.3), 2, 1.8, 10, STEEL, STEEL_SH, d.lk.ink, 0.3, 0.5 * d.k, 0.4);
      mark(
        d.s,
        d.lk.eye,
        [
          { x: d.f * 0.6, y: Y(d, 0.3) },
          { x: d.f * 0.6 + 1.4 * Math.cos(d.t * 2), y: Y(d, 0.3) - 1.1 },
        ],
        0.6,
        d.sd,
        [0, 0.5],
      );
    },
    over: (d) => {
      for (const x of [-1, 1]) rivet(d, x * d.W * 0.32, Y(d, 0.94));
    },
    back: (d) => {
      for (const sd of [-1, 1]) tonedOval(d.s, sd * d.W * 0.47 + d.bx(0.8), Y(d, 0.8), 1, 1.5, 8, STEEL, STEEL_SH, d.lk.ink, 0.3, 0.6 * d.k, 0.4);
    },
    front: (d) => {
      const wob = S(d.t * 9) * (moving(d) ? 1.6 : 0.5) + d.wob * 0.4;
      stalk(d, d.bx(1) - d.f * 1.6, d.top + 1, d.bx(1) - d.f * 1.6 + wob, d.top - 4.6, 1.4, d.lk.player, d.lk.playerShade);
    },
    snout: (d) => {
      const y = Y(d, 0.68);
      poly(
        d.s,
        [
          { x: -2.2, y: y - 0.9 },
          { x: 2.2, y: y - 1 },
          { x: 2.2, y: y + 0.9 },
          { x: -2.2, y: y + 1 },
        ],
        IRON,
      );
      d.s.fillStyle = STEEL;
      for (let i = -1; i <= 1; i++) d.s.fillRect(i * 1.4 - 0.25, y - 0.6, 0.5, 1.2);
    },
    parts: ['gear', 'spring', 'bolt'],
  },

  // A goose up to no good: an S of a neck, a long body, a tail tipped up, an orange beak. Waddles, neck
  // thrust forward when it runs, wings out; honks on a cheer.
  goose: {
    size: [1.16, 1.06],
    outline:
      'M -0.56 -0.36 C -0.44 -0.32 -0.34 -0.34 -0.22 -0.38 C -0.02 -0.44 0.08 -0.44 0.12 -0.52 C 0.14 -0.64 0.06 -0.76 0.1 -0.88 C 0.12 -0.98 0.26 -1.02 0.3 -0.94 C 0.32 -0.9 0.28 -0.86 0.24 -0.84 C 0.2 -0.74 0.24 -0.62 0.3 -0.5 C 0.46 -0.4 0.5 -0.22 0.38 -0.1 C 0.26 0 -0.1 0 -0.3 -0.06 C -0.46 -0.14 -0.52 -0.24 -0.56 -0.36 Z',
    lift: 2.4,
    feet: 'web',
    arms: 'none',
    faceX: 0.2,
    gait: (g) => (g.moving ? { rot: S(g.ph) * 0.08, pivot: 0, bend: 0.06 + g.run * 0.08, upright: 0.4 } : { rot: S(g.t * 1.4) * 0.02, pivot: 0 }),
    paintFace: (d) => sideEye(d, 0.93, 0, 0.55),
    back: (d) => {
      // Wings: folded at a walk, flung up and out on the run.
      const out = d.m === 'run' || !d.p.grounded ? 1 : 0;
      const flap = out ? S(d.t * 22) * 0.2 : 0;
      for (const sd of [-1, 1]) {
        const x0 = -d.f * d.W * 0.06 + sd * 0.8;
        const y0 = Y(d, 0.42);
        const a = -Math.PI / 2 - d.f * (1.1 - out * 0.7 + flap) * (sd > 0 ? 1 : 0.85);
        const tip = { x: x0 + Math.cos(a) * 6.2, y: y0 + Math.sin(a) * (out ? 6.2 : 2.4) };
        toned(
          d.s,
          [{ x: x0 + d.f * 1.8, y: y0 + 0.4 }, { x: (x0 + tip.x) / 2, y: Math.min(y0, tip.y) - 1 }, tip, { x: x0 - d.f * 1.8, y: y0 + 1.4 }],
          d.lk.fillShade,
          d.lk.playerDark,
          d.lk.ink,
          0.35,
          0.7 * d.k,
          0.4,
        );
      }
    },
    snout: (d) => beak(d, d.f * d.W * 0.08, Y(d, 0.91), 3.2, 0.7, d.m === 'cheer' || d.m === 'fall' ? 1.2 : 0),
    parts: ['shard', 'shard'],
  },

  // A hard-hat engineer: a dome hat with a wide brim, welding goggles, a big square chin, a stocky build,
  // a wrench in his gloved hand. Trudges, heavy-stepped. His work shirt is the player's color.
  engineer: {
    size: [1, 0.98],
    outline:
      'M -0.04 -0.84 C 0.18 -0.86 0.34 -0.78 0.36 -0.64 C 0.4 -0.58 0.42 -0.5 0.4 -0.46 C 0.48 -0.42 0.5 -0.28 0.46 -0.12 C 0.44 -0.04 0.36 0 0.26 0 L -0.32 0 C -0.42 0 -0.48 -0.1 -0.48 -0.24 C -0.48 -0.44 -0.4 -0.56 -0.34 -0.6 C -0.36 -0.74 -0.24 -0.84 -0.04 -0.84 Z',
    lift: 2.8,
    feet: 'boot',
    boots: [BROWN, BROWN_SH],
    arms: 'mitten',
    hands: 'glove',
    faceX: 0.06,
    gait: (g) => (g.moving ? { hop: abs(S(g.ph)) * 0.5, sy: 1 - abs(S(g.ph)) * 0.05, upright: 0.6 } : {}),
    paintFace: (d) => {
      goggles(d, 0.72, 0.16);
      mouthMark(d, d.f * 1.2, Y(d, 0.52), 2.6);
    },
    print: (d) => {
      // The face and chin in skin, dark work overalls below the shirt.
      spot(d.s, d.f * d.W * 0.12, Y(d, 0.62), d.W * 0.36, d.H * 0.2, d.sd, SKIN, 0.05);
      band(d, -0.2, 0.22);
      for (const sd of [-1, 1])
        mark(
          d.s,
          DENIM,
          [
            { x: sd * d.W * 0.18, y: Y(d, 0.2) },
            { x: sd * d.W * 0.16, y: Y(d, 0.42) },
          ],
          1.6,
          sd,
          [0, 0],
        );
    },
    front: (d) => {
      // The hard hat: a dome with a wide brim, in its own yellow.
      const x = d.bx(0.95);
      const brim = Y(d, 0.82);
      toned(
        d.s,
        [
          { x: x - d.W * 0.4, y: brim },
          { x: x - d.W * 0.34, y: d.top - 2.8 },
          { x: x, y: d.top - 4 },
          { x: x + d.W * 0.34, y: d.top - 2.8 },
          { x: x + d.W * 0.4, y: brim },
        ],
        d.lk.paint,
        d.lk.paintShade,
        d.lk.ink,
        0.4,
        0.8 * d.k,
        0.6,
      );
      toned(
        d.s,
        [
          { x: x - d.W * 0.6, y: brim - 0.4 },
          { x: x + d.W * 0.6, y: brim - 0.6 },
          { x: x + d.W * 0.56, y: brim + 0.9 },
          { x: x - d.W * 0.56, y: brim + 1.1 },
        ],
        d.lk.paint,
        d.lk.paintShade,
        d.lk.ink,
        0.3,
        0.7 * d.k,
        0.4,
      );
    },
    tool: (d, hx, hy) => {
      // A wrench, jaw up, swinging with the arm.
      const a = -Math.PI / 2 + d.f * 0.5;
      const tx = hx + Math.cos(a) * 6;
      const ty = hy + Math.sin(a) * 6;
      d.s.fillStyle = d.lk.ink;
      line(d.s, hx, hy, tx, ty, { w: 2, seed: 2, taper: [0, 0], press: 0 });
      d.s.fillStyle = STEEL;
      line(d.s, hx, hy, tx, ty, { w: 1, seed: 2, taper: [0, 0], press: 0 });
      toned(
        d.s,
        [
          { x: tx - 1.6, y: ty + 0.6 },
          { x: tx - 1.8, y: ty - 1.6 },
          { x: tx - 0.4, y: ty - 0.6 },
          { x: tx + 0.4, y: ty - 0.6 },
          { x: tx + 1.8, y: ty - 1.6 },
          { x: tx + 1.6, y: ty + 0.6 },
        ],
        STEEL,
        STEEL_SH,
        d.lk.ink,
        0.3,
        0.6 * d.k,
        0.3,
      );
    },
    parts: ['gear', 'bolt', 'spring', 'shard'],
  },

  // A round puffball on big feet, stubby arms, tall eyes. Toddles; puffs up round in the air.
  puffball: {
    size: [0.96, 0.9],
    outline: 'M 0.02 -1 C 0.32 -1 0.5 -0.78 0.5 -0.5 C 0.5 -0.22 0.32 0 0.02 0 C -0.3 0 -0.5 -0.22 -0.5 -0.5 C -0.5 -0.78 -0.28 -1 0.02 -1 Z',
    lift: 2.6,
    feet: 'boot',
    arms: 'mitten',
    hands: 'body',
    gait: (g) => {
      if (!g.grounded && g.vy < 0) return { sx: 1.14, sy: 1.08 };
      return g.moving ? { hop: abs(S(g.ph * 1.4)) * 0.8, rot: S(g.ph * 1.4) * 0.05, pivot: 0 } : {};
    },
    paintFace: (d) => tallEyes(d, 0.6, 0.11),
    parts: ['shard', 'shard'],
  },
};

/** A level band across the body in the overalls' dark, cut by the outline. */
function band(d: D, u0: number, u1: number) {
  poly(
    d.s,
    [
      { x: -d.W * 0.62, y: Y(d, u1) },
      { x: d.W * 0.62, y: Y(d, u1) },
      { x: d.W * 0.62, y: Math.min(Y(d, u0), d.by + 0.4) },
      { x: -d.W * 0.62, y: Math.min(Y(d, u0), d.by + 0.4) },
    ],
    DENIM,
  );
}
