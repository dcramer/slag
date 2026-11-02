import { hash2 } from '../../core/rng';
import type { Toy } from '../../gen/character';
import type { P } from '../ink';
import { beady, dots, ember, engraved, lamp, side } from './faces';
import {
  BRASS,
  BRASS_SH,
  crack,
  dome,
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
  rounded,
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
 * The cast-iron and enamel line, and the two that roll: a piggy bank, a kettle, a bell, a lantern, a
 * critter crawled out of the slag, a train engine and a duck on wheels. The player's color is a painted
 * saddle, an enamel band, a sash, a painted lantern frame, a knitted beanie and scarf, a cab, a painted
 * base.
 */
/** Lantern glass, lit from inside: a flat warm pane, not a glow. */
const GLASS = '#f1dd9c';

export const IRON_TOYS: Partial<Record<Toy, ToyArt>> = {
  piggybank: {
    size: [1.2, 0.76],
    shape: (W, H) => sup(W, H, 2.3, 0.92, 1.04, 0.08),
    feet: 'peg',
    arms: 'none',
    faceX: 0.2,
    shine: true,
    paintFace: (d) => beady(d, 0.6, 0.1, 0.65),
    print: (d) => {
      // A painted saddle cloth with a scalloped hem, over the back half.
      const x0 = -d.f * d.W * 0.62;
      const x1 = d.f * d.W * 0.12;
      const pts: P[] = [
        { x: x0, y: Y(d, 1.1) },
        { x: x1, y: Y(d, 1.1) },
      ];
      for (let i = 0; i <= 6; i++) pts.push({ x: x1 + (x0 - x1) * (i / 6), y: Y(d, 0.22) + (i % 2 ? 1.2 : 0) });
      poly(d.s, pts, d.lk.player);
      for (let i = 0; i < 2; i++) poly(d.s, oval(-d.f * d.W * (0.36 - i * 0.24), Y(d, 0.52 + i * 0.12), 0.9, 0.9, 6), d.lk.playerHi);
    },
    back: (d) => {
      // A curly tail.
      const x = -d.f * d.W * 0.5;
      const pts: P[] = [{ x, y: Y(d, 0.5) }];
      for (let i = 0; i <= 10; i++) {
        const a = (i / 10) * Math.PI * 2.6;
        const r = 1.8 * (1 - i / 14);
        pts.push({ x: x - d.f * (1.8 + Math.cos(a) * r), y: Y(d, 0.6) + Math.sin(a) * r });
      }
      mark(d.s, d.lk.ink, pts, 2 * d.k, d.sd, [0, 0.3]);
      mark(d.s, d.lk.paint, pts, 0.9, d.sd, [0, 0.3]);
    },
    front: (d) => {
      // The coin slot with a coin stuck in it, and ears folded forward over the head end.
      inkBox(d, -d.f * 2.4 - 2.2, d.top + 0.4, 4.4, 1.2, IRON_SH);
      const bob = d.m === 'run' ? Math.abs(Math.sin(d.ph)) * 0.8 : 0;
      tonedOval(d.s, -d.f * 2.4, d.top - 1 - bob, 1.9, 1.9, 10, BRASS, BRASS_SH, d.lk.ink, 0.5, 0.9 * d.k, 0.5);
      // Ears are flaps folded forward over the head end, not points: points read as a cat's.
      for (const k of [0.1, 0.28])
        toned(
          d.s,
          [
            { x: d.f * d.W * (k - 0.06), y: d.top + 2.2 },
            { x: d.f * d.W * (k + 0.04), y: d.top - 1.4 },
            { x: d.f * d.W * (k + 0.22), y: d.top + 1.4 },
            { x: d.f * d.W * (k + 0.12), y: d.top + 2.6 },
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
      // A flat snout disc sticking out of the front: the pig's whole read.
      const x = d.f * d.W * 0.34;
      const y = Y(d, 0.36);
      tonedOval(d.s, x, y, 1.7, 2.4, 10, d.lk.paint, d.lk.paintShade, d.lk.ink, 0.5, 0.95 * d.k, 0.5);
      for (const dy of [-0.8, 0.8]) poly(d.s, oval(x + d.f * 0.3, y + dy, 0.45, 0.55, 6), d.lk.ink);
    },
    parts: ['shard', 'shard', 'coin', 'coin'],
  },
  kettle: {
    size: [1, 0.88],
    shine: true,
    shape: (W, H) => dome(W, H, 2.4, 1.08),
    feet: 'none',
    arms: 'none',
    hop: true,
    face: (c) => ({ eyes: { y: 0.6, count: 2, size: Math.min(1.7, c.eyes.size), spread: 0.2, style: c.eyes.style === 'visor' ? 'ring' : c.eyes.style } }),
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
    size: [0.9, 1.1],
    shine: true,
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
    paintFace: (d) => engraved(d, 0.66, 0.16),
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
  lantern: {
    size: [0.84, 1.1],
    shape: (W, H) =>
      rounded(
        [
          { x: -0.2 * W, y: -H },
          { x: 0.2 * W, y: -H },
          { x: 0.5 * W, y: -0.8 * H },
          { x: 0.4 * W, y: -0.74 * H },
          { x: 0.4 * W, y: -0.14 * H },
          { x: 0.5 * W, y: -0.08 * H },
          { x: 0.5 * W, y: 0 },
          { x: -0.5 * W, y: 0 },
          { x: -0.5 * W, y: -0.08 * H },
          { x: -0.4 * W, y: -0.14 * H },
          { x: -0.4 * W, y: -0.74 * H },
          { x: -0.5 * W, y: -0.8 * H },
        ],
        1,
      ),
    feet: 'none',
    arms: 'none',
    hop: true,
    shine: true,
    paintFace: (d) => dots(d, 0.56, 0.13, 0.8, 0.0),
    print: (d) => {
      // The frame is painted in the player's color under an iron roof; the glass is lit by a flame, in flat tones.
      livery(d, -0.2, 0.76);
      poly(
        d.s,
        [
          { x: -d.W * 0.28, y: Y(d, 0.7) },
          { x: d.W * 0.28, y: Y(d, 0.7) },
          { x: d.W * 0.28, y: Y(d, 0.18) },
          { x: -d.W * 0.28, y: Y(d, 0.18) },
        ],
        GLASS,
      );
      const lick = Math.sin(d.t * 9) * 0.4 - d.f * Math.min(1, Math.abs(d.p.vx) / 160);
      poly(
        d.s,
        [
          { x: -1.3, y: Y(d, 0.2) },
          { x: lick, y: Y(d, 0.42) },
          { x: 1.3, y: Y(d, 0.2) },
        ],
        HOT_CSS,
      );
      poly(d.s, oval(lick * 0.3, Y(d, 0.25), 0.6, 0.9, 6), WHITE_HOT);
      for (const side of [-1, 1])
        mark(
          d.s,
          d.lk.playerDark,
          [
            { x: side * d.W * 0.28, y: Y(d, 0.7) },
            { x: side * d.W * 0.28, y: Y(d, 0.18) },
          ],
          0.9,
          side,
          [0, 0],
        );
    },
    front: (d) => inkLoop(d, oval(d.wob * 0.2, d.top - 1.6, 2, 1.8, 12), IRON),
    parts: ['shard', 'shard', 'bolt', 'spring'],
  },
  slagblob: {
    size: [1, 0.86],
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
    paintFace: (d) => ember(d, 0.5, 0.2),
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
    size: [1.3, 0.7],
    shine: true,
    shape: (W, H) => sup(W, H, 5, 1, 1),
    feet: 'wheels',
    arms: 'none',
    faceX: 0.2,
    rope: { kind: 'string', len: 6 },
    paintFace: (d) => lamp(d, 0.56, 0, 2.5),
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
    size: [1.24, 0.74],
    shape: (W, H) => sup(W, H, 2.2, 0.9, 1.04, 0.08),
    feet: 'wheels',
    arms: 'none',
    faceX: 0.12,
    rope: { kind: 'string', len: 6 },
    paintFace: (d) => side(d, 0.66, d.f * 1.2),
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
