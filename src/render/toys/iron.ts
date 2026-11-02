import { hash2 } from '../../core/rng';
import type { Toy } from '../../gen/character';
import type { P } from '../ink';
import { glowDot } from '../kit';
import {
  BRASS,
  BRASS_SH,
  crack,
  dome,
  HOT,
  HOT_CSS,
  inkBox,
  inkLoop,
  IRON,
  IRON_SH,
  livery,
  mark,
  mouthX,
  mouthY,
  ORANGE,
  ORANGE_SH,
  oval,
  poly,
  rivet,
  spot,
  sup,
  TIN,
  type ToyArt,
  toned,
  tonedOval,
  WHITE_HOT,
  Y,
} from './kit';

/**
 * The cast-iron and enamel line, and the two that roll: a piggy bank, a kettle, a bell, a crucible of
 * molten metal, a critter crawled out of the slag, a train engine and a duck on wheels. The player's
 * color is a painted saddle, an enamel band, a sash, a painted band on the iron, a knitted beanie and
 * scarf, a cab, a painted base.
 */
export const IRON_TOYS: Partial<Record<Toy, ToyArt>> = {
  piggybank: {
    size: [1.22, 0.84],
    shape: (W, H) => sup(W, H, 2.2, 0.94, 1.04, 0.08),
    feet: 'peg',
    arms: 'none',
    print: (d) => {
      // A painted saddle cloth with a scalloped hem.
      const pts: P[] = [
        { x: -d.W * 0.62, y: Y(d, 0.72) },
        { x: d.W * 0.62, y: Y(d, 0.72) },
      ];
      for (let i = 0; i <= 8; i++) pts.push({ x: d.W * (0.6 - i * 0.15), y: Y(d, 0.3) + (i % 2 ? 1.2 : 0) });
      poly(d.s, pts, d.lk.player);
      for (let i = 0; i < 3; i++) poly(d.s, oval(-d.f * d.W * (0.3 - i * 0.24), Y(d, 0.5 + (i % 2) * 0.1), 0.9, 0.9, 6), d.lk.playerHi);
    },
    back: (d) => {
      // A curly tail.
      const x = -d.f * d.W * 0.5;
      const pts: P[] = [{ x, y: Y(d, 0.42) }];
      for (let i = 0; i <= 10; i++) {
        const a = (i / 10) * Math.PI * 2.6;
        const r = 1.8 * (1 - i / 14);
        pts.push({ x: x - d.f * (1.8 + Math.cos(a) * r), y: Y(d, 0.5) + Math.sin(a) * r });
      }
      mark(d.s, d.lk.ink, pts, 2 * d.k, d.sd, [0, 0.3]);
      mark(d.s, d.lk.paint, pts, 0.9, d.sd, [0, 0.3]);
    },
    over: (d) =>
      mark(
        d.s,
        d.lk.paintShade,
        [
          { x: 0.3, y: d.top - 1 },
          { x: 0, y: d.by + 1 },
        ],
        0.7,
        d.sd,
        [0, 0],
      ),
    front: (d) => {
      // The coin slot with a coin stuck in it, and the ears.
      inkBox(d, -2.4, d.top + 0.4, 4.8, 1.3, IRON_SH);
      const bob = d.m === 'run' ? Math.abs(Math.sin(d.ph)) * 0.8 : 0;
      tonedOval(d.s, 0.4, d.top - 1.2 - bob, 2.1, 2.1, 10, BRASS, BRASS_SH, d.lk.ink, 0.5, 0.9 * d.k, 0.5);
      for (const side of [-1, 1])
        toned(
          d.s,
          [
            { x: side * d.W * 0.2, y: d.top + 2.2 },
            { x: side * d.W * 0.42, y: d.top - 2.2 },
            { x: side * d.W * 0.46, y: d.top + 2.6 },
          ],
          d.lk.paint,
          d.lk.paintShade,
          d.lk.ink,
          0.6,
          1 * d.k,
          0.6,
        );
    },
    snout: (d) => {
      const x = mouthX(d) + d.f * 2.6;
      const y = mouthY(d) - 2.6;
      tonedOval(d.s, x, y, 2, 2.3, 10, d.lk.paint, d.lk.paintShade, d.lk.ink, 0.5, 0.9 * d.k, 0.5);
      for (const dy of [-0.8, 0.8]) poly(d.s, oval(x + d.f * 0.3, y + dy, 0.5, 0.45, 6), d.lk.ink);
    },
    parts: ['shard', 'shard', 'coin', 'coin'],
  },
  kettle: {
    size: [1.14, 0.9],
    shape: (W, H) => dome(W, H, 2.4, 1.08),
    feet: 'none',
    arms: 'none',
    hop: true,
    face: () => ({ eyes: { y: 0.6 } }),
    print: (d) => livery(d, 0.1, 0.48),
    back: (d) => {
      const pts: P[] = Array.from({ length: 8 }, (_, i) => {
        const a = Math.PI + (i / 7) * Math.PI;
        return { x: -d.f * 1 + Math.cos(a) * d.W * 0.36, y: d.top + 3 + Math.sin(a) * 4.4 };
      });
      mark(d.s, d.lk.ink, pts, 2.4 * d.k, d.sd, [0, 0]);
      mark(d.s, IRON, pts, 1.1, d.sd, [0, 0]);
    },
    front: (d) => {
      tonedOval(d.s, 0, d.top + 0.2, 1.8, 1.5, 8, d.lk.player, d.lk.playerShade, d.lk.ink, 0.5, 0.9 * d.k, 0.5);
      const x = d.f * d.W * 0.48;
      const y = Y(d, 0.3);
      toned(
        d.s,
        [
          { x: x - d.f * 1.6, y: y - 1.8 },
          { x: x + d.f * 3.4, y: y - 4.6 },
          { x: x + d.f * 4.4, y: y - 4 },
          { x: x + d.f * 1.6, y: y + 2.2 },
          { x: x - d.f * 1.6, y: y + 2.4 },
        ],
        d.lk.paint,
        d.lk.paintShade,
        d.lk.ink,
        0.6,
        1 * d.k,
        0.6,
      );
    },
    parts: ['shard', 'shard', 'bolt', 'spring'],
  },
  bell: {
    size: [1.12, 1],
    shape: (W, H) => {
      const pts: P[] = [];
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI + (i / 10) * Math.PI;
        pts.push({ x: Math.cos(a) * W * 0.32, y: -H + 4 + Math.sin(a) * 4 });
      }
      pts.push({ x: W * 0.36, y: -H * 0.55 }, { x: W * 0.44, y: -H * 0.2 }, { x: W * 0.56, y: -1.2 }, { x: W * 0.5, y: 0 });
      pts.push({ x: -W * 0.5, y: 0 }, { x: -W * 0.56, y: -1.2 }, { x: -W * 0.44, y: -H * 0.2 }, { x: -W * 0.36, y: -H * 0.55 });
      return pts;
    },
    feet: 'none',
    arms: 'none',
    hop: true,
    face: () => ({ eyes: { y: 0.66, spread: 0.2 }, mouth: 'o' }),
    print: (d) => {
      // A painted sash round the waist, in the player's color.
      livery(d, 0.12, 0.56);
      mark(
        d.s,
        d.lk.paintShade,
        [
          { x: -d.W * 0.62, y: Y(d, 0.08) },
          { x: d.W * 0.62, y: Y(d, 0.08) },
        ],
        0.8,
        d.sd,
        [0, 0],
      );
    },
    back: (d) => {
      const sw = Math.sin(d.t * 9) * 1.2 - d.f * Math.min(2, Math.abs(d.p.vx) / 80);
      tonedOval(d.s, sw, d.by - 0.2, 1.6, 1.6, 9, IRON, IRON_SH, d.lk.ink, 0.5, 0.9 * d.k, 0.5);
    },
    front: (d) => inkLoop(d, oval(0, d.top - 1.4, 2.2, 2, 12), IRON),
    parts: ['shard', 'bolt', 'gear', 'shard'],
  },
  crucible: {
    size: [1.04, 0.98],
    shape: (W, H) => [
      { x: -W * 0.56, y: -H },
      { x: W * 0.56, y: -H },
      { x: W * 0.52, y: -H * 0.9 },
      { x: W * 0.42, y: -H * 0.25 },
      { x: W * 0.32, y: 0 },
      { x: -W * 0.32, y: 0 },
      { x: -W * 0.42, y: -H * 0.25 },
      { x: -W * 0.52, y: -H * 0.9 },
    ],
    feet: 'peg',
    arms: 'mitten',
    hands: 'iron',
    face: () => ({ eyes: { y: 0.7 } }),
    print: (d) => {
      livery(d, 0.04, 0.48);
      const x = -d.f * d.W * 0.34;
      mark(
        d.s,
        HOT_CSS,
        [
          { x, y: Y(d, 0.9) },
          { x: x + 0.2, y: Y(d, 0.66) },
          { x: x - 0.1, y: Y(d, 0.56) },
        ],
        1.4,
        d.sd,
        [0, 0.2],
      );
    },
    over: (d) => {
      for (const side of [-1, 1]) rivet(d, side * d.W * 0.3, Y(d, 0.3));
    },
    front: (d) => {
      // The pour: molten metal sloshing in the mouth. Hot, so it glows.
      const slosh = Math.sin(d.t * 5) * 0.6 + (d.m === 'run' ? -d.f * 0.8 : 0);
      poly(
        d.s,
        [
          { x: -d.W * 0.48, y: d.top + 0.6 - slosh },
          { x: 0, y: d.top - 0.8 },
          { x: d.W * 0.48, y: d.top + 0.6 + slosh },
          { x: d.W * 0.4, y: d.top + 1.8 },
          { x: -d.W * 0.4, y: d.top + 1.8 },
        ],
        HOT_CSS,
      );
      poly(d.s, oval(-1.4, d.top + 0.4, 2.2, 0.6, 8), WHITE_HOT);
      if (d.g) glowDot(d.g, d.wx, d.wy + d.top * d.sc, 9 * d.sc, HOT, 0.4);
      const x0 = -d.f * d.W * 0.5;
      mark(
        d.s,
        d.lk.ink,
        [
          { x: x0, y: Y(d, 0.8) },
          { x: x0 - d.f * 4.4, y: Y(d, 0.94) },
        ],
        2.6 * d.k,
        d.sd,
        [0, 0.1],
      );
      mark(
        d.s,
        IRON,
        [
          { x: x0, y: Y(d, 0.8) },
          { x: x0 - d.f * 4.2, y: Y(d, 0.94) },
        ],
        1.2,
        d.sd,
        [0, 0.1],
      );
    },
    parts: ['shard', 'bolt', 'bolt', 'gear'],
  },
  slagblob: {
    size: [1.12, 0.9],
    shape: (W, H, v) => {
      // Lumpy, cooled in a heap.
      const p = sup(W, H, 2.1, 0.86, 1.08, 0.14, 30);
      const sd = Math.floor(v[0] * 1e6);
      return p.map((q, i) => {
        const k = 1 + (hash2(sd, i, 5) - 0.5) * 0.1;
        return { x: q.x * k, y: q.y < -1 ? q.y * (1 + (k - 1) * 0.5) : q.y };
      });
    },
    feet: 'none',
    arms: 'mitten',
    hands: 'paint',
    rope: { kind: 'scarf', len: 7 },
    face: (c) => ({ eyes: { glow: true, y: Math.min(0.56, c.eyes.y) } }),
    print: (d) => {
      for (let i = 0; i < 3; i++) spot(d.s, (hash2(d.sd, i, 1) - 0.5) * d.W, Y(d, 0.1 + hash2(d.sd, i, 2) * 0.4), 2.2, 1.6, d.sd + i, d.lk.paintShade, 0.35);
    },
    over: (d) => {
      const x = -d.f * d.W * 0.3;
      crack(
        d,
        [
          { x: x - 1.4, y: Y(d, 0.5) },
          { x, y: Y(d, 0.32) },
          { x: x + 0.6, y: Y(d, 0.08) },
        ],
        d.sd,
      );
      crack(
        d,
        [
          { x: d.f * d.W * 0.3, y: Y(d, 0.25) },
          { x: d.f * d.W * 0.45, y: Y(d, 0.12) },
        ],
        d.sd + 1,
      );
    },
    front: (d) => {
      // A knitted beanie in the player's color, rolled brim and a pompom.
      const brim = Y(d, 0.6);
      const cap: P[] = [];
      for (let i = 0; i <= 12; i++) {
        const a = Math.PI + (i / 12) * Math.PI;
        cap.push({ x: Math.cos(a) * d.W * 0.54, y: brim + Math.sin(a) * (brim - d.top + 1.6) });
      }
      toned(d.s, cap, d.lk.player, d.lk.playerShade, d.lk.ink, 0.7, 1.1 * d.k, 0.8);
      toned(
        d.s,
        [
          { x: -d.W * 0.58, y: brim - 1.4 },
          { x: d.W * 0.58, y: brim - 1.6 },
          { x: d.W * 0.56, y: brim + 1.2 },
          { x: -d.W * 0.56, y: brim + 1.4 },
        ],
        d.lk.playerShade,
        d.lk.playerDark,
        d.lk.ink,
        0.5,
        0.9 * d.k,
        0.5,
      );
      tonedOval(d.s, d.wob * 0.4, d.top - 1.6, 1.9, 1.9, 9, d.lk.accent, d.lk.accentShade, d.lk.ink, 0.5, 0.9 * d.k, 0.5);
    },
    parts: ['shard', 'shard', 'shard', 'bolt'],
  },
  train: {
    size: [1.26, 0.78],
    shape: (W, H) => sup(W, H, 5, 1, 1),
    feet: 'wheels',
    arms: 'none',
    faceX: 0.2,
    rope: { kind: 'string', len: 6 },
    face: (c) => ({ eyes: { y: 0.6, spread: 0.18, count: c.eyes.count === 3 ? 2 : c.eyes.count } }),
    print: (d) => {
      // The cab, at the back, is the player's: half the engine.
      const x0 = -d.f * d.W * 0.6;
      const x1 = -d.f * d.W * 0.02;
      poly(
        d.s,
        [
          { x: x0, y: d.top - 2 },
          { x: x1, y: d.top - 2 },
          { x: x1, y: d.by + 2 },
          { x: x0, y: d.by + 2 },
        ],
        d.lk.player,
      );
      tonedOval(d.s, -d.f * d.W * 0.3, Y(d, 0.66), 1.8, 1.5, 8, TIN, d.lk.playerShade, d.lk.ink, 0.3, 0.6, 0.3);
      mark(
        d.s,
        BRASS,
        [
          { x: -d.W * 0.62, y: Y(d, 0.12) },
          { x: d.W * 0.62, y: Y(d, 0.12) },
        ],
        1,
        d.sd,
        [0, 0],
      );
    },
    front: (d) => {
      // Cab roof over the back, smokestack up front.
      inkBox(d, Math.min(-d.f * d.W * 0.64, d.f * d.W * 0.02), d.top - 2.4, d.W * 0.66, 1.8, IRON);
      const sx = d.f * d.W * 0.3;
      toned(
        d.s,
        [
          { x: sx - 1.6, y: d.top + 1 },
          { x: sx - 2.2, y: d.top - 3.8 },
          { x: sx + 2.2, y: d.top - 3.8 },
          { x: sx + 1.6, y: d.top + 1 },
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
  duck: {
    size: [1.1, 0.88],
    shape: (W, H) => sup(W, H, 2.2, 0.9, 1.04, 0.08),
    feet: 'wheels',
    arms: 'none',
    faceX: 0.12,
    rope: { kind: 'string', len: 6 },
    face: () => ({ mouth: 'none' }),
    print: (d) => {
      // A painted lower half and a painted wing, both the player's.
      livery(d, -0.1, 0.36);
      toned(d.s, oval(-d.f * d.W * 0.12, Y(d, 0.42), d.W * 0.3, d.H * 0.2, 12, -d.f * 0.3), d.lk.player, d.lk.playerShade, d.lk.ink, 0.1, 0.2, 0.5);
    },
    back: (d) => {
      const x = -d.f * d.W * 0.46;
      toned(
        d.s,
        [
          { x, y: Y(d, 0.5) },
          { x: x - d.f * 3.2, y: Y(d, 0.74) },
          { x, y: Y(d, 0.28) },
        ],
        d.lk.paint,
        d.lk.paintShade,
        d.lk.ink,
        0.6,
        1 * d.k,
        0.6,
      );
    },
    snout: (d) => {
      const x = mouthX(d);
      const y = mouthY(d) - 0.8;
      const open = d.m === 'fall' || d.m === 'cheer' ? 1.1 : 0;
      toned(
        d.s,
        [
          { x: x - d.f * 1.8, y: y - 1.5 },
          { x: x + d.f * 5.4, y: y - 0.6 },
          { x: x + d.f * 5, y: y + 0.8 + open },
          { x: x - d.f * 1.8, y: y + 1.2 + open },
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
};
