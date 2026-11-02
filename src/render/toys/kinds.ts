import type { Toy } from '../../gen/character';
import type { P } from '../ink';
import { beady, dots, engraved, lamp, porthole, side, slit, stamped } from './faces';
import {
  band,
  BRASS,
  BRASS_SH,
  type D,
  HOT_CSS,
  inkBox,
  inkLoop,
  IRON,
  IRON_SH,
  key,
  line,
  livery,
  mark,
  mouthY,
  ORANGE,
  ORANGE_SH,
  oval,
  poly,
  rivet,
  stalk,
  stroke,
  TIN,
  TIN_SH,
  type ToyArt,
  toned,
  tonedOval,
  WHITE_HOT,
  WOOD,
  WOOD_SH,
  Y,
} from './kit';

/**
 * The cast, one hand-designed toy per kind (docs/CHARACTERS.md). Each is its own character the way a
 * barnyard party game's animals are: its own outline inked as curves (bulges, pinched waists, flared
 * feet, a lean), one signature appendage that breaks the outline, and a way of moving that's its own.
 * The seed only picks the kind, the paint and the player's color; the design is fixed.
 *
 * Outlines are authored facing right in body units (x across -0.5..0.5 of the width, y up to -1); hooks
 * put a part on the front with `d.f`. Gaits are animation only: everyone's physics are the same.
 */

const S = Math.sin;
const abs = Math.abs;
const GLASS = '#f1dd9c';

/** Two stiff legs that swing from the hips like a toy soldier's, booted in iron. */
function stiffLegs(d: D, spread: number, swing: number) {
  for (const sd of [-1, 1]) {
    const hx = sd * d.W * spread;
    const a = d.m === 'walk' || d.m === 'run' ? S(d.ph) * sd * swing : d.m === 'up' || d.m === 'wall' ? sd * 0.18 : d.m === 'fall' ? sd * 0.35 : 0;
    const fx = hx + S(a) * -d.by * d.f;
    const fy = -1.2 + (1 - Math.cos(a)) * 1.5;
    d.s.fillStyle = d.lk.ink;
    line(d.s, hx, d.by + 0.5, fx, fy, { w: 2.6 * d.k, seed: sd, taper: [0, 0], press: 0 });
    d.s.fillStyle = TIN_SH;
    line(d.s, hx, d.by + 0.5, fx, fy - 0.4, { w: 1.2, seed: sd, taper: [0, 0], press: 0 });
    toned(
      d.s,
      [
        { x: fx - d.f * 1.4, y: fy - 0.8 },
        { x: fx + d.f * 2.6, y: fy - 0.6 },
        { x: fx + d.f * 2.8, y: fy + 1.1 },
        { x: fx - d.f * 1.6, y: fy + 1.1 },
      ],
      IRON,
      IRON_SH,
      d.lk.ink,
      0.5,
      0.9 * d.k,
      0.4,
    );
  }
}

export const KINDS: Record<Toy, ToyArt> = {
  // Tall and narrow, chest out, coat-tails flaring behind, under a towering shako. Marches stiff-legged.
  soldier: {
    size: [0.74, 1.04],
    outline:
      'M 0.02 -1 C 0.3 -1 0.36 -0.9 0.34 -0.74 C 0.33 -0.66 0.3 -0.63 0.34 -0.58 C 0.52 -0.48 0.5 -0.3 0.36 -0.22 C 0.3 -0.18 0.32 -0.08 0.4 0 L -0.5 0 C -0.4 -0.1 -0.32 -0.2 -0.34 -0.34 C -0.38 -0.5 -0.36 -0.58 -0.32 -0.62 C -0.38 -0.72 -0.32 -0.98 0.02 -1 Z',
    lift: 3.8,
    feet: 'none',
    arms: 'mitten',
    hands: 'tin',
    faceX: 0.06,
    gait: (g) => (g.moving ? { hop: abs(S(g.ph)) * 0.7, upright: 0.15 } : { upright: 0.4 }),
    paintFace: (d) => stamped(d, 0.78, 0.15),
    print: (d) => {
      livery(d, -0.2, 0.6);
      mark(
        d.s,
        TIN,
        [
          { x: -d.W * 0.5, y: Y(d, 0.56) },
          { x: d.W * 0.5, y: d.by + 1 },
        ],
        1.4,
        d.sd,
        [0, 0],
      );
      mark(
        d.s,
        TIN,
        [
          { x: d.W * 0.5, y: Y(d, 0.56) },
          { x: -d.W * 0.5, y: d.by + 1 },
        ],
        1.4,
        d.sd + 1,
        [0, 0],
      );
      poly(d.s, oval(d.f * 0.6, Y(d, 0.3), 0.8, 0.8, 6), BRASS);
    },
    back: (d) => {
      stiffLegs(d, 0.18, 0.45);
      key(d, 0.36, 0.4);
    },
    front: (d) => {
      // The shako: a tall iron drum that leans back a touch, a brass band, a plume in the player's color.
      const x = d.bx(1.2);
      const t = d.top;
      toned(
        d.s,
        [
          { x: x - d.W * 0.36, y: t + 1.6 },
          { x: x - d.W * 0.42 - d.f * 0.6, y: t - 6.2 },
          { x: x + d.W * 0.4 - d.f * 0.6, y: t - 6.6 },
          { x: x + d.W * 0.36, y: t + 1.4 },
        ],
        IRON,
        IRON_SH,
        d.lk.ink,
        0.6,
        1 * d.k,
        0.6,
      );
      mark(
        d.s,
        BRASS,
        [
          { x: x - d.W * 0.38, y: t + 0.4 },
          { x: x + d.W * 0.38, y: t + 0.2 },
        ],
        1.1,
        d.sd,
        [0, 0],
      );
      const sway = d.m === 'walk' || d.m === 'run' ? S(d.ph * 2) * 0.8 : 0;
      tonedOval(d.s, x - d.f * 0.4 + sway, t - 7.6, 1.6, 2.6, 9, d.lk.player, d.lk.playerShade, d.lk.ink, 0.5, 0.9 * d.k, 0.5);
    },
    parts: ['gear', 'spring', 'key', 'shard'],
  },

  // A big TV-set head, dented on one corner, on a neck pinch and a barrel chest. Stomps, jerky.
  robot: {
    size: [0.9, 1.04],
    outline:
      'M -0.36 -1 L 0.36 -0.98 C 0.44 -0.98 0.46 -0.94 0.45 -0.86 L 0.42 -0.68 C 0.41 -0.63 0.3 -0.62 0.14 -0.6 C 0.4 -0.56 0.5 -0.42 0.48 -0.24 C 0.46 -0.06 0.3 0 0 0 C -0.3 0 -0.46 -0.06 -0.48 -0.24 C -0.5 -0.42 -0.4 -0.56 -0.14 -0.6 C -0.3 -0.62 -0.41 -0.63 -0.42 -0.68 L -0.44 -0.9 C -0.44 -0.97 -0.41 -1 -0.36 -1 Z',
    lift: 3.2,
    feet: 'peg',
    arms: 'mitten',
    hands: 'tin',
    shine: true,
    gait: (g) => (g.moving ? { hop: S(g.ph) > 0 ? 0.8 : 0, rot: (S(g.ph) > 0 ? 1 : -1) * 0.04, upright: 0.4 } : {}),
    paintFace: (d) => slit(d, 0.82),
    print: (d) => {
      livery(d, -0.2, 0.58);
      tonedOval(d.s, d.f * 0.6, Y(d, 0.3), 2.1, 1.9, 10, TIN, TIN_SH, d.lk.ink, 0.4, 0.7 * d.k, 0.4);
      mark(
        d.s,
        d.lk.ink,
        [
          { x: d.f * 0.6, y: Y(d, 0.3) },
          { x: d.f * 0.6 + 1.5 * Math.cos(d.t * 2), y: Y(d, 0.3) - 1.2 },
        ],
        0.7,
        d.sd,
        [0, 0.5],
      );
    },
    over: (d) => {
      for (const x of [-1, 1]) rivet(d, x * d.W * 0.32, Y(d, 0.94));
    },
    back: (d) => {
      key(d, 0.3, 0.48);
      // Ear bolts.
      for (const sd of [-1, 1]) tonedOval(d.s, sd * d.W * 0.47 + d.bx(0.8), Y(d, 0.8), 1.1, 1.6, 8, TIN, TIN_SH, d.lk.ink, 0.4, 0.8 * d.k, 0.4);
    },
    front: (d) => {
      // The antenna wobbles on its own spring with every stomp.
      const wob = S(d.t * 9) * (d.m === 'walk' || d.m === 'run' ? 1.6 : 0.5) + d.wob * 0.4;
      stalk(d, d.bx(1) - d.f * 1.6, d.top + 1, d.bx(1) - d.f * 1.6 + wob, d.top - 4.6, 1.5, d.lk.player, d.lk.playerShade);
    },
    snout: (d) => {
      const y = Y(d, 0.68);
      inkBox(d, -2.4, y - 1, 4.8, 2, IRON);
      d.s.fillStyle = TIN;
      for (let i = -1; i <= 1; i++) d.s.fillRect(i * 1.5 - 0.3, y - 0.7, 0.6, 1.4);
    },
    parts: ['gear', 'spring', 'bolt', 'key'],
  },

  // A pointed nose, a swollen middle, a pinched waist over a flared nozzle, swept fins. Hops on its fins.
  rocket: {
    size: [0.7, 1.12],
    outline:
      'M 0.04 -1 C 0.22 -0.9 0.32 -0.74 0.32 -0.56 L 0.3 -0.16 C 0.3 -0.1 0.36 -0.05 0.38 0 L -0.38 0 C -0.36 -0.05 -0.3 -0.1 -0.3 -0.16 L -0.32 -0.56 C -0.32 -0.74 -0.18 -0.9 0.04 -1 Z',
    lift: 2.4,
    feet: 'none',
    arms: 'none',
    shine: true,
    gait: (g) => {
      if (!g.grounded) return { bend: 0.05 };
      if (!g.moving) return {};
      const a = abs(S(g.ph * 0.6));
      return { hop: a * (2.2 + g.run * 1.4), sy: a < 0.25 ? 0.9 : 1.04, sx: a < 0.25 ? 1.08 : 0.97, bend: 0.06 * a };
    },
    paintFace: (d) => porthole(d, 0.46),
    print: (d) => {
      livery(d, 0.7, 1.2);
      band(d, 0.04, 0.16, d.lk.player);
    },
    back: (d) => {
      for (const sd of [-1, 1])
        toned(
          d.s,
          [
            { x: sd * d.W * 0.3, y: Y(d, 0.5) },
            { x: sd * (d.W * 0.5 + 4.6), y: Y(d, 0.02) },
            { x: sd * (d.W * 0.5 + 4.4), y: d.by + 1.6 },
            { x: sd * d.W * 0.28, y: Y(d, 0.04) },
          ],
          d.lk.player,
          d.lk.playerShade,
          d.lk.ink,
          0.6,
          1 * d.k,
          0.6,
        );
      if (!d.p.grounded && d.p.vy < 0) {
        // Flat flame, no glow: a hot shape in its own two tones.
        const len = 3 + Math.min(4, -d.p.vy / 100) + S(d.t * 40) * 0.8;
        poly(
          d.s,
          [
            { x: -2.2, y: d.by },
            { x: 0, y: d.by + len },
            { x: 2.2, y: d.by },
          ],
          HOT_CSS,
        );
        poly(
          d.s,
          [
            { x: -1, y: d.by },
            { x: 0, y: d.by + len * 0.55 },
            { x: 1, y: d.by },
          ],
          WHITE_HOT,
        );
      }
    },
    parts: ['shard', 'shard', 'bolt', 'spring'],
  },

  // A wide-shouldered top with concave flanks running down to its point. Spins and precesses as it goes.
  top: {
    size: [1.1, 0.96],
    outline:
      'M -0.07 -1 L 0.07 -1 L 0.09 -0.88 C 0.34 -0.86 0.52 -0.72 0.5 -0.58 C 0.48 -0.46 0.24 -0.34 0.07 -0.06 Q 0 0.03 -0.07 -0.06 C -0.24 -0.34 -0.48 -0.46 -0.5 -0.58 C -0.52 -0.72 -0.34 -0.86 -0.09 -0.88 Z',
    lift: 1.8,
    feet: 'none',
    arms: 'none',
    shine: true,
    gait: (g) => ({ rot: S(g.t * 8 + g.seed) * 0.07 + (g.moving ? S(g.ph * 2) * 0.05 : 0), pivot: 0, upright: 0.5 }),
    paintFace: (d) => dots(d, 0.7, 0.13, 0.85, 0.11),
    print: (d) => {
      // The cone is the player's color; painted stripes scroll round it as it spins.
      livery(d, -0.2, 0.56);
      const n = 4;
      const per = (d.W * 1.2) / n;
      const off = (((d.ph * 1.6 + d.t * 6) % per) + per) % per;
      for (let i = -1; i <= n; i++) {
        const x = -d.W * 0.6 + i * per + off;
        if (abs(x) > d.W * 0.55) continue;
        poly(
          d.s,
          [
            { x: x - per * 0.16, y: Y(d, 0.56) },
            { x: x + per * 0.16, y: Y(d, 0.56) },
            { x: x * 0.3 + per * 0.06, y: d.by },
            { x: x * 0.3 - per * 0.06, y: d.by },
          ],
          d.lk.playerDark,
        );
      }
      band(d, 0.86, 1.2, d.lk.player);
    },
    parts: ['shard', 'shard', 'bolt', 'spring'],
  },

  // Long and low: a tall cab at the back, a round-nosed boiler, a cowcatcher, a flared smokestack, two
  // wheels and a pull string. Chugs: a quick double bounce on its wheels.
  train: {
    size: [1.3, 0.72],
    outline:
      'M -0.48 0 L -0.48 -0.9 L -0.54 -0.92 L -0.52 -1 L 0.02 -1 L 0.04 -0.92 L -0.04 -0.9 L -0.04 -0.64 C 0.18 -0.68 0.4 -0.66 0.46 -0.54 C 0.52 -0.42 0.5 -0.28 0.44 -0.24 L 0.58 0 Z',
    lift: 4.9,
    feet: 'wheels',
    arms: 'none',
    shine: true,
    faceX: 0.3,
    rope: { kind: 'string', len: 6 },
    gait: (g) => (g.moving ? { hop: abs(S(g.ph * 2)) * 0.7, rot: S(g.ph * 2) * 0.025, pivot: 0, upright: 0.15 } : { upright: 0.2 }),
    paintFace: (d) => lamp(d, 0.38, 0, 2.2),
    print: (d) => {
      // The cab is the player's.
      poly(
        d.s,
        [
          { x: -d.f * d.W * 0.6, y: d.top - 2 },
          { x: -d.f * d.W * 0.04, y: d.top - 2 },
          { x: -d.f * d.W * 0.04, y: d.by + 2 },
          { x: -d.f * d.W * 0.6, y: d.by + 2 },
        ],
        d.lk.player,
      );
      tonedOval(d.s, -d.f * d.W * 0.28, Y(d, 0.66), 1.6, 1.4, 8, TIN, d.lk.playerShade, d.lk.ink, 0.3, 0.6, 0.3);
      mark(
        d.s,
        BRASS,
        [
          { x: 0, y: Y(d, 0.44) },
          { x: d.f * d.W * 0.5, y: Y(d, 0.44) },
        ],
        0.9,
        d.sd,
        [0, 0],
      );
    },
    front: (d) => {
      // A flared smokestack that jumps with each chug.
      const jump = d.m === 'walk' || d.m === 'run' ? abs(S(d.ph * 2)) * 0.6 : 0;
      const sx = d.f * d.W * 0.26;
      const t = Y(d, 0.6) - jump;
      toned(
        d.s,
        [
          { x: sx - 1.3, y: t + 1.4 },
          { x: sx - 1.1, y: t - 2.6 },
          { x: sx - 2.4, y: t - 4.4 },
          { x: sx + 2.4, y: t - 4.4 },
          { x: sx + 1.1, y: t - 2.6 },
          { x: sx + 1.3, y: t + 1.4 },
        ],
        IRON,
        IRON_SH,
        d.lk.ink,
        0.6,
        1 * d.k,
        0.6,
      );
    },
    parts: ['wheel', 'wheel', 'bolt', 'gear'],
  },

  // A duck on a wheeled board: tail up, back dipped, neck rising to a round head, a long bill. Waddles.
  duck: {
    size: [1.2, 0.84],
    outline:
      'M -0.54 -0.68 C -0.42 -0.5 -0.3 -0.5 -0.1 -0.52 C 0.04 -0.54 0.06 -0.72 0.1 -0.86 C 0.14 -1.02 0.4 -1.04 0.42 -0.86 C 0.44 -0.74 0.34 -0.66 0.3 -0.6 C 0.46 -0.52 0.5 -0.3 0.4 -0.16 C 0.3 -0.04 -0.3 -0.02 -0.42 -0.14 C -0.5 -0.24 -0.5 -0.42 -0.54 -0.68 Z',
    lift: 4.9,
    feet: 'wheels',
    arms: 'none',
    faceX: 0.27,
    rope: { kind: 'string', len: 6 },
    gait: (g) => (g.moving ? { rot: S(g.ph) * 0.12, pivot: 0, upright: 0.4 } : { rot: S(g.t * 2) * 0.02, pivot: 0 }),
    paintFace: (d) => side(d, 0.86, d.f * 0.6),
    print: (d) => {
      livery(d, -0.2, 0.3);
      toned(d.s, oval(-d.f * d.W * 0.14, Y(d, 0.38), d.W * 0.24, d.H * 0.16, 12, -d.f * 0.35), d.lk.player, d.lk.playerShade, d.lk.ink, 0.1, 0.2, 0.5);
    },
    back: (d) => {
      // The board it rides on.
      inkBox(d, -d.W * 0.5, d.by - 0.2, d.W, 2, WOOD, WOOD_SH);
    },
    snout: (d) => {
      const x = d.f * d.W * 0.12;
      const y = Y(d, 0.82);
      const open = d.m === 'fall' || d.m === 'cheer' ? 1 : 0;
      toned(
        d.s,
        [
          { x: x - d.f * 0.8, y: y - 1.3 },
          { x: x + d.f * 4.6, y: y - 0.4 },
          { x: x + d.f * 4.2, y: y + 0.9 + open },
          { x: x - d.f * 0.8, y: y + 1.2 + open },
        ],
        ORANGE,
        ORANGE_SH,
        d.lk.ink,
        0.5,
        0.9 * d.k,
        0.5,
      );
    },
    parts: ['wheel', 'wheel', 'shard', 'bolt'],
  },

  // A bell: round crown, concave waist, a lip that flares wide. Rocks from its crown and clangs.
  bell: {
    size: [1.02, 1],
    outline:
      'M 0 -1 C 0.22 -1 0.3 -0.9 0.29 -0.74 C 0.28 -0.54 0.3 -0.36 0.38 -0.22 C 0.45 -0.1 0.6 -0.08 0.6 0 L -0.6 0 C -0.6 -0.08 -0.45 -0.1 -0.38 -0.22 C -0.3 -0.36 -0.28 -0.54 -0.29 -0.74 C -0.3 -0.9 -0.22 -1 0 -1 Z',
    lift: 2.4,
    feet: 'none',
    arms: 'none',
    shine: true,
    gait: (g) =>
      g.moving ? { rot: S(g.ph * 0.8) * 0.22, pivot: 1.15, hop: abs(S(g.ph * 0.8)) * 0.6, upright: 0.3 } : { rot: S(g.t * 1.6) * 0.04, pivot: 1.15 },
    paintFace: (d) => engraved(d, 0.68, 0.14),
    print: (d) => {
      livery(d, 0.16, 0.5);
      mark(
        d.s,
        d.lk.paintShade,
        [
          { x: -d.W * 0.6, y: Y(d, 0.08) },
          { x: d.W * 0.6, y: Y(d, 0.08) },
        ],
        0.8,
        d.sd,
        [0, 0],
      );
    },
    back: (d) => {
      // The clapper swings against the rock.
      const sw = -(d.gait.rot ?? 0) * d.f * 14 + S(d.t * 9) * 0.4;
      d.s.fillStyle = d.lk.ink;
      line(d.s, 0, d.by - 3, sw, d.by, { w: 1.2, seed: 1, taper: [0, 0], press: 0 });
      tonedOval(d.s, sw, d.by + 0.2, 1.5, 1.5, 9, IRON, IRON_SH, d.lk.ink, 0.5, 0.9 * d.k, 0.5);
    },
    front: (d) => inkLoop(d, oval(0, d.top - 2, 2.6, 2.4, 12), IRON),
    parts: ['shard', 'bolt', 'gear', 'shard'],
  },

  // A clown's head with a jester's cap and a ruff, on a spring out of its box. Springs along.
  jackbox: {
    size: [0.84, 0.74],
    outline:
      'M 0.02 -1 C 0.34 -1 0.5 -0.8 0.48 -0.56 C 0.46 -0.36 0.36 -0.2 0.18 -0.16 C 0.08 -0.14 -0.1 -0.14 -0.22 -0.18 C -0.4 -0.24 -0.5 -0.42 -0.48 -0.6 C -0.46 -0.84 -0.3 -1 0.02 -1 Z',
    lift: 7.2,
    feet: 'none',
    arms: 'mitten',
    hands: 'tin',
    gait: (g) => {
      if (!g.moving) return { k: 0.5 + S(g.t * 3) * 0.1 };
      const a = abs(S(g.ph * 0.5));
      return { hop: a * 3, k: a, sy: a < 0.2 ? 0.9 : 1.05, upright: 0.6 };
    },
    face: (c) => ({ mouth: 'grin', eyes: { y: 0.56, count: 2, size: Math.min(1.9, c.eyes.size), style: c.eyes.style === 'visor' ? 'ring' : c.eyes.style } }),
    print: (d) => {
      for (const sd of [-1, 1]) poly(d.s, oval(sd * d.W * 0.34, Y(d, 0.36), 1.3, 1, 8), '#d9707f');
    },
    back: (d) => {
      // The box stays on the floor while the head springs: the floor sits below the hop.
      const floor = d.p.grounded ? (d.gait.hop ?? 0) : 0;
      const boxTop = floor - 3.2;
      inkBox(d, -d.W * 0.46, boxTop, d.W * 0.92, 3.2, d.lk.player, d.lk.playerShade);
      mark(
        d.s,
        d.lk.playerHi,
        [
          { x: -d.W * 0.46, y: boxTop + 0.6 },
          { x: d.W * 0.46, y: boxTop + 0.6 },
        ],
        0.7,
        d.sd,
        [0, 0],
      );
      const pts: P[] = [];
      for (let i = 0; i <= 8; i++) pts.push({ x: i % 2 ? 2 : -2, y: boxTop + (d.by + 1 - boxTop) * (i / 8) });
      d.s.fillStyle = d.lk.ink;
      stroke(d.s, pts, { w: 1.6 * d.k, seed: 3, taper: [0, 0], press: 0 });
      d.s.fillStyle = '#c9c1b4';
      stroke(d.s, pts, { w: 0.7, seed: 3, taper: [0, 0], press: 0 });
      // The ruff.
      const ruff: P[] = [];
      for (let i = 0; i <= 9; i++) ruff.push({ x: -d.W * 0.6 + (i / 9) * d.W * 1.2, y: d.by + (i % 2 ? 1.8 : -0.6) });
      ruff.push({ x: d.W * 0.5, y: d.by - 2.2 }, { x: -d.W * 0.5, y: d.by - 2.2 });
      toned(d.s, ruff, TIN, TIN_SH, d.lk.ink, 0.5, 0.9 * d.k, 0.5);
    },
    front: (d) => {
      const brim = Y(d, 0.7);
      const x = d.bx(1);
      const droop = d.m === 'walk' || d.m === 'run' ? S(d.ph * 0.5) * 1.2 : S(d.t * 3) * 0.4;
      toned(
        d.s,
        [
          { x: x - d.W * 0.56, y: brim + 0.8 },
          { x: x - d.W * 0.78 - droop * 0.3, y: d.top - 2.4 + droop },
          { x: x - d.W * 0.18, y: d.top - 0.6 },
          { x, y: d.top + 0.6 },
          { x: x + d.W * 0.18, y: d.top - 0.6 },
          { x: x + d.W * 0.78 + droop * 0.3, y: d.top - 2.4 - droop },
          { x: x + d.W * 0.56, y: brim + 0.8 },
        ],
        d.lk.player,
        d.lk.playerShade,
        d.lk.ink,
        0.7,
        1.1 * d.k,
        0.8,
      );
      for (const sd of [-1, 1])
        tonedOval(d.s, x + sd * (d.W * 0.78 + droop * 0.3), d.top - 2.4 + sd * -droop, 1.1, 1.1, 8, BRASS, BRASS_SH, d.lk.ink, 0.4, 0.8 * d.k, 0.4);
    },
    parts: ['spring', 'spring', 'shard', 'gear'],
  },

  // Crouched flat, haunches high at the back, two eye bumps up front. Crouches and leaps.
  frog: {
    size: [1.3, 0.7],
    outline:
      'M -0.5 -0.1 C -0.56 -0.4 -0.4 -0.64 -0.18 -0.7 C -0.06 -0.74 0 -0.76 0.03 -0.8 C 0.06 -1 0.24 -1 0.26 -0.84 C 0.28 -0.78 0.31 -0.78 0.33 -0.84 C 0.37 -1 0.54 -0.96 0.52 -0.78 C 0.5 -0.6 0.56 -0.4 0.5 -0.24 C 0.46 -0.1 0.3 0 0.1 0 L -0.36 0 C -0.46 0 -0.5 -0.04 -0.5 -0.1 Z',
    lift: 2.3,
    feet: 'none',
    arms: 'none',
    gait: (g) => {
      if (!g.grounded) return { k: 1, sy: 1.08, sx: 0.94 };
      if (!g.moving) return { k: 0 };
      const a = S(g.ph * 0.5);
      return a > 0 ? { hop: a * (2.4 + g.run * 1.6), k: a, sy: 1 + a * 0.1, sx: 1 - a * 0.06, rot: -0.12 * a } : { k: 0, sy: 1 + a * 0.14, sx: 1 - a * 0.1 };
    },
    paintFace: (d) => {
      // Painted eyes on the bumps.
      for (const u of [0.145, 0.43]) {
        const x = d.f * d.W * u;
        const y = Y(d, 0.86);
        if (d.m === 'cheer') {
          mark(
            d.s,
            d.lk.ink,
            [
              { x: x - 1.2, y: y + 0.4 },
              { x, y: y - 0.7 },
              { x: x + 1.2, y: y + 0.4 },
            ],
            1.1,
            u * 10,
            [0.2, 0.2],
          );
          continue;
        }
        poly(d.s, oval(x, y, 1.6, 1.5, 10), '#f6f1e6');
        poly(d.s, oval(x + d.f * 0.4, y + 0.1, 1.1, d.m === 'fall' ? 0.9 : 0.45, 8), d.lk.ink);
      }
      const y = Y(d, 0.56);
      mark(
        d.s,
        d.lk.ink,
        [
          { x: d.f * d.W * 0.12, y: y - 0.4 },
          { x: d.f * d.W * 0.32, y: y + 0.7 },
          { x: d.f * d.W * 0.5, y: y - 0.6 },
        ],
        1.1,
        d.sd,
        [0.15, 0.15],
      );
    },
    print: (d) => {
      livery(d, -0.2, 0.42);
      for (const u of [0.14, 0.3]) poly(d.s, oval(d.f * d.W * 0.2, Y(d, u), 0.7, 0.7, 6), BRASS);
    },
    back: (d) => {
      key(d, 0.56, 0.5);
      // The hind leg: folded under the haunch, kicked out long on the leap.
      const k = d.gait.k ?? 0;
      const hx = -d.f * d.W * 0.34;
      const knee = { x: hx - d.f * (2.4 + k * 1.6), y: d.by - 1.2 + k * 1.6 };
      const foot = { x: hx - d.f * (0.6 + k * 4.6), y: -0.4 + k * 2.2 };
      d.s.fillStyle = d.lk.ink;
      stroke(d.s, [{ x: hx, y: Y(d, 0.3) }, knee, foot], { w: 3.2 * d.k, seed: 5, taper: [0, 0.3], press: 0 });
      d.s.fillStyle = d.lk.paint;
      stroke(d.s, [{ x: hx, y: Y(d, 0.3) }, knee, foot], { w: 1.8, seed: 5, taper: [0, 0.3], press: 0 });
      toned(
        d.s,
        [
          { x: foot.x - d.f * 0.6, y: foot.y - 1 },
          { x: foot.x - d.f * 3, y: foot.y + 0.4 },
          { x: foot.x + d.f * 0.8, y: foot.y + 0.8 },
        ],
        d.lk.paint,
        d.lk.paintShade,
        d.lk.ink,
        0.5,
        0.9 * d.k,
        0.4,
      );
    },
    parts: ['spring', 'key', 'shard', 'gear'],
  },

  // A peaked roof with curled eaves and a finial, a frame round a lit pane, a flared base, a handle on
  // top. Swings from its handle as it goes.
  lantern: {
    size: [0.84, 1.02],
    outline:
      'M 0 -1 C 0.04 -0.96 0.06 -0.92 0.1 -0.9 C 0.3 -0.86 0.5 -0.82 0.54 -0.72 C 0.46 -0.72 0.4 -0.72 0.38 -0.7 L 0.35 -0.18 C 0.42 -0.13 0.5 -0.07 0.5 0 L -0.5 0 C -0.5 -0.07 -0.42 -0.13 -0.35 -0.18 L -0.38 -0.7 C -0.4 -0.72 -0.46 -0.72 -0.54 -0.72 C -0.5 -0.82 -0.3 -0.86 -0.1 -0.9 C -0.06 -0.92 -0.04 -0.96 0 -1 Z',
    lift: 2.3,
    feet: 'none',
    arms: 'none',
    shine: true,
    gait: (g) => (g.moving ? { rot: S(g.ph * 0.7) * 0.18, pivot: 1.3, hop: abs(S(g.ph * 0.7)) * 0.8, upright: 0.3 } : { rot: S(g.t * 1.3) * 0.05, pivot: 1.3 }),
    paintFace: (d) => dots(d, 0.56, 0.12, 0.8, 0),
    print: (d) => {
      livery(d, -0.2, 0.72);
      poly(
        d.s,
        [
          { x: -d.W * 0.26, y: Y(d, 0.66) },
          { x: d.W * 0.26, y: Y(d, 0.66) },
          { x: d.W * 0.25, y: Y(d, 0.2) },
          { x: -d.W * 0.25, y: Y(d, 0.2) },
        ],
        GLASS,
      );
      const lick = S(d.t * 9) * 0.4 - d.f * Math.min(1, abs(d.p.vx) / 160);
      poly(
        d.s,
        [
          { x: -1.2, y: Y(d, 0.22) },
          { x: lick, y: Y(d, 0.42) },
          { x: 1.2, y: Y(d, 0.22) },
        ],
        HOT_CSS,
      );
      poly(d.s, oval(lick * 0.3, Y(d, 0.26), 0.55, 0.85, 6), WHITE_HOT);
    },
    front: (d) => {
      // The handle: a wire bail over the roof.
      const pts: P[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        pts.push({ x: d.bx(1) + Math.cos(a) * d.W * 0.34, y: Y(d, 0.84) + Math.sin(a) * 4.6 });
      }
      mark(d.s, d.lk.ink, pts, 2 * d.k, d.sd, [0, 0]);
      mark(d.s, IRON, pts, 0.9, d.sd, [0, 0]);
    },
    parts: ['shard', 'shard', 'bolt', 'spring'],
  },

  // A teapot: lid and knob, a round belly sat low, a spout curling up in front, a loop handle behind.
  // Hops and tips forward as if pouring; the lid rattles on the hop.
  kettle: {
    size: [1.08, 0.78],
    outline:
      'M -0.16 -0.86 C -0.12 -0.9 0.12 -0.9 0.16 -0.86 C 0.44 -0.8 0.56 -0.54 0.5 -0.3 C 0.46 -0.1 0.3 0 0.18 0 L -0.18 0 C -0.3 0 -0.46 -0.1 -0.5 -0.3 C -0.56 -0.54 -0.44 -0.8 -0.16 -0.86 Z',
    lift: 2.3,
    feet: 'none',
    arms: 'none',
    shine: true,
    faceX: 0.04,
    gait: (g) => {
      if (!g.moving) return {};
      const a = abs(S(g.ph));
      return { hop: a * 1.6, rot: 0.08 + g.run * 0.06, pivot: 0, k: a };
    },
    face: (c) => ({ eyes: { y: 0.52, count: 2, size: Math.min(1.6, c.eyes.size), spread: 0.18, style: c.eyes.style === 'visor' ? 'ring' : c.eyes.style } }),
    print: (d) => livery(d, 0.06, 0.34),
    back: (d) => {
      // The loop handle.
      const pts: P[] = [];
      for (let i = 0; i <= 9; i++) {
        const a = -Math.PI / 2 + (i / 9) * Math.PI;
        pts.push({ x: -d.f * (d.W * 0.44 + Math.cos(a) * 3.4), y: Y(d, 0.5) + Math.sin(a) * 3.4 });
      }
      mark(d.s, d.lk.ink, pts, 2.6 * d.k, d.sd, [0, 0]);
      mark(d.s, d.lk.paint, pts, 1.2, d.sd, [0, 0]);
    },
    front: (d) => {
      // The spout curls up out of the belly, and the lid lifts on every hop.
      const x = d.f * d.W * 0.44;
      const y = Y(d, 0.32);
      toned(
        d.s,
        [
          { x: x - d.f * 1.2, y: y - 2 },
          { x: x + d.f * 2.4, y: y - 3.6 },
          { x: x + d.f * 3.8, y: y - 8.2 },
          { x: x + d.f * 5, y: y - 8 },
          { x: x + d.f * 3.8, y: y - 1.6 },
          { x: x - d.f * 0.6, y: y + 2.4 },
        ],
        d.lk.paint,
        d.lk.paintShade,
        d.lk.ink,
        0.6,
        1 * d.k,
        0.6,
      );
      const lift = (d.gait.k ?? 0) * 1.6;
      const lx = d.bx(0.9);
      toned(
        d.s,
        [
          { x: lx - d.W * 0.24, y: Y(d, 0.86) - lift },
          { x: lx - d.W * 0.12, y: Y(d, 1.02) - lift },
          { x: lx + d.W * 0.12, y: Y(d, 1.02) - lift },
          { x: lx + d.W * 0.24, y: Y(d, 0.86) - lift },
        ],
        d.lk.paint,
        d.lk.paintShade,
        d.lk.ink,
        0.6,
        1 * d.k,
        0.6,
      );
      tonedOval(d.s, lx, Y(d, 1.08) - lift, 1.5, 1.3, 8, d.lk.player, d.lk.playerShade, d.lk.ink, 0.5, 0.9 * d.k, 0.5);
    },
    parts: ['shard', 'shard', 'bolt', 'spring'],
  },

  // An egg leaning forward, a head bump with a beak, a tail tuft swept up behind. Pecks and hops.
  chick: {
    size: [0.78, 0.94],
    outline:
      'M 0.1 -1 C 0.36 -1 0.46 -0.8 0.42 -0.64 C 0.4 -0.56 0.44 -0.5 0.48 -0.38 C 0.52 -0.12 0.3 0 0.04 0 C -0.3 0 -0.46 -0.14 -0.48 -0.3 C -0.5 -0.42 -0.56 -0.5 -0.64 -0.6 C -0.5 -0.6 -0.42 -0.62 -0.38 -0.68 C -0.34 -0.88 -0.16 -1 0.1 -1 Z',
    lift: 3.6,
    feet: 'web',
    arms: 'none',
    faceX: 0.16,
    gait: (g) => {
      if (!g.moving) return { rot: S(g.t * 2.2 + g.seed) > 0.85 ? 0.16 : 0, pivot: 0 };
      return { hop: abs(S(g.ph * 1.2)) * 1.8, rot: 0.05 + S(g.ph * 2.4) * 0.07, pivot: 0 };
    },
    paintFace: (d) => beady(d, 0.74, 0.08, 0.8),
    print: (d) => {
      // A painted wing down the side, in the player's color.
      const flap = d.m === 'up' || d.m === 'fall' ? S(d.t * 30) * 0.3 : 0;
      toned(d.s, oval(-d.f * d.W * 0.06, Y(d, 0.36), d.W * 0.34, d.H * 0.24, 14, -d.f * (0.4 + flap)), d.lk.player, d.lk.playerShade, d.lk.ink, 0.1, 0.2, 0.6);
      livery(d, -0.2, 0.08);
    },
    back: (d) => key(d, 0.52, 0.46),
    front: (d) => {
      for (const a of [-0.4, 0.1, 0.6])
        mark(
          d.s,
          d.lk.ink,
          [
            { x: d.bx(1) + d.f * 0.6, y: d.top + 1.2 },
            { x: d.bx(1) + d.f * 0.6 + a * 2.6 + d.wob * 0.3, y: d.top - 2.2 },
          ],
          1.3 * d.k,
          d.sd + a * 10,
          [0, 0.7],
        );
    },
    snout: (d) => {
      const x = d.f * d.W * 0.2;
      const y = Y(d, 0.66);
      toned(
        d.s,
        [
          { x: x - d.f * 0.6, y: y - 1.2 },
          { x: x + d.f * 2.8, y: y + 0.2 },
          { x: x - d.f * 0.6, y: y + 1.3 },
        ],
        ORANGE,
        ORANGE_SH,
        d.lk.ink,
        0.5,
        0.9 * d.k,
        0.4,
      );
    },
    parts: ['spring', 'key', 'shard', 'gear'],
  },
};

export { mouthY };
