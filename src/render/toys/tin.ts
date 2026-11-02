import type { Toy } from '../../gen/character';
import type { P } from '../ink';
import {
  band,
  BRASS,
  BRASS_SH,
  dome,
  HOT_CSS,
  inkBox,
  IRON,
  IRON_SH,
  key,
  line,
  livery,
  mark,
  mouthX,
  mouthY,
  ORANGE,
  ORANGE_SH,
  oval,
  poly,
  rivet,
  rounded,
  stalk,
  sup,
  TIN,
  TIN_SH,
  type ToyArt,
  toned,
  tonedOval,
  WHITE_HOT,
  Y,
} from './kit';
import { beady, dots, porthole, slit, stamped } from './faces';

/**
 * The tin line: pressed-tin wind-ups and novelties. Each has its own silhouette at 16 px (a two-tier robot,
 * a tall can, a soldier under his shako, a round chick, a flat frog, a pointed rocket, a top on its point,
 * a head on a spring, a flat beetle on its legs), and the player's color is painted on big: a chest panel,
 * a label, a jacket, wings, a waistcoat, a nose cone and fins, a spinning cone, a jester's cap, a shell.
 */
export const TIN_TOYS: Partial<Record<Toy, ToyArt>> = {
  robot: {
    size: [0.86, 1.06],
    shine: true,
    shape: (W, H) =>
      rounded(
        [
          { x: -0.38 * W, y: -H },
          { x: 0.38 * W, y: -H },
          { x: 0.38 * W, y: -0.55 * H },
          { x: 0.5 * W, y: -0.52 * H },
          { x: 0.5 * W, y: 0 },
          { x: -0.5 * W, y: 0 },
          { x: -0.5 * W, y: -0.52 * H },
          { x: -0.38 * W, y: -0.55 * H },
        ],
        1.6,
      ),
    feet: 'peg',
    arms: 'mitten',
    waddle: true,
    hands: 'tin',
    paintFace: (d) => slit(d, 0.8),
    print: (d) => {
      livery(d, -0.1, 0.5);
      tonedOval(d.s, d.f * 0.8, Y(d, 0.24), 2.2, 2, 10, TIN, TIN_SH, d.lk.ink, 0.4, 0.7 * d.k, 0.4);
      mark(
        d.s,
        d.lk.ink,
        [
          { x: d.f * 0.8, y: Y(d, 0.24) },
          { x: d.f * 0.8 + 1.5 * Math.cos(d.t * 2), y: Y(d, 0.24) - 1.2 },
        ],
        0.7,
        d.sd,
        [0, 0.5],
      );
    },
    over: (d) => {
      for (const x of [-1, 1]) rivet(d, x * d.W * 0.3, Y(d, 0.92));
    },
    back: (d) => key(d, 0.28),
    front: (d) => stalk(d, 0, d.top + 1, d.wob * 0.5, d.top - 4.6, 1.5, d.lk.player, d.lk.playerShade),
    snout: (d) => {
      const x = mouthX(d) * 0.6;
      const y = Y(d, 0.6);
      inkBox(d, x - 2.6, y - 1.1, 5.2, 2.2, IRON);
      d.s.fillStyle = TIN;
      for (let i = -1; i <= 1; i++) d.s.fillRect(x + i * 1.6 - 0.3, y - 0.8, 0.6, 1.6);
    },
    parts: ['gear', 'spring', 'bolt', 'key'],
  },
  tincan: {
    size: [0.74, 1.12],
    shine: true,
    paintFace: (d) => dots(d, 0.6, 0.2, 0.9),
    shape: (W, H) => sup(W, H, 7, 1, 1),
    feet: 'peg',
    arms: 'mitten',
    waddle: true,
    hands: 'tin',
    print: (d) => {
      // The label is the player's: three quarters of the can.
      livery(d, 0.12, 0.86);
      for (const u of [0.93, 0.05])
        mark(
          d.s,
          d.lk.paintShade,
          [
            { x: -d.W * 0.62, y: Y(d, u) },
            { x: d.W * 0.62, y: Y(d, u) },
          ],
          0.7,
          d.sd + u,
          [0, 0],
        );
      // A stamped star on the label, in the tin's own color.
      const sx = -d.f * d.W * 0.24;
      const sy = Y(d, 0.24);
      const star: P[] = Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const r = i % 2 ? 0.8 : 1.9;
        return { x: sx + Math.cos(a) * r, y: sy + Math.sin(a) * r };
      });
      poly(d.s, star, d.lk.paint);
    },
    front: (d) => {
      const x = d.f * 1.2 + d.wob * 0.3;
      poly(d.s, oval(x, d.top - 1.4, 2.3, 1.3, 12), d.lk.ink);
      poly(d.s, oval(x, d.top - 1.4, 1.5, 0.75, 10), TIN);
      poly(d.s, oval(x, d.top - 1.4, 0.9, 0.3, 8), d.lk.paintShade);
    },
    parts: ['shard', 'shard', 'bolt', 'spring'],
  },
  soldier: {
    size: [0.74, 1.12],
    shape: (W, H) => sup(W, H, 3.6, 0.94, 1),
    feet: 'peg',
    arms: 'mitten',
    waddle: true,
    hands: 'tin',
    paintFace: (d) => stamped(d, 0.68, 0.2),
    print: (d) => {
      // The jacket is the player's color, crossed with tin belts.
      livery(d, -0.1, 0.46);
      mark(
        d.s,
        TIN,
        [
          { x: -d.W * 0.5, y: Y(d, 0.44) },
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
          { x: d.W * 0.5, y: Y(d, 0.44) },
          { x: -d.W * 0.5, y: d.by + 1 },
        ],
        1.4,
        d.sd + 1,
        [0, 0],
      );
      poly(d.s, oval(0, Y(d, 0.22), 0.8, 0.8, 6), BRASS);
    },
    back: (d) => key(d, 0.3),
    front: (d) => {
      // The tall shako, iron with a brass band, and a plume in the player's color.
      inkBox(d, -d.W * 0.4, d.top - 5.4, d.W * 0.8, 6.8, IRON);
      mark(
        d.s,
        BRASS,
        [
          { x: -d.W * 0.4, y: d.top + 0.6 },
          { x: d.W * 0.4, y: d.top + 0.6 },
        ],
        1.1,
        d.sd,
        [0, 0],
      );
      tonedOval(d.s, d.f * 0.8 + d.wob * 0.3, d.top - 6.6, 1.8, 2.6, 9, d.lk.player, d.lk.playerShade, d.lk.ink, 0.5, 0.9 * d.k, 0.5);
    },
    parts: ['gear', 'spring', 'key', 'shard'],
  },
  chick: {
    size: [0.86, 0.94],
    shape: (W, H) => sup(W, H, 2.1, 0.9, 1.06, 0.1),
    feet: 'web',
    arms: 'none',
    hop: true,
    waddle: true,
    paintFace: (d) => beady(d, 0.62, 0.17, 0.8),
    print: (d) => {
      // Painted wings down both sides, in the player's color.
      for (const side of [-1, 1]) {
        const flap = d.m === 'up' || d.m === 'fall' ? Math.sin(d.t * 30) * 0.25 : 0;
        toned(d.s, oval(side * d.W * 0.44, Y(d, 0.36), d.W * 0.3, d.H * 0.3, 14, side * (0.5 + flap)), d.lk.player, d.lk.playerShade, d.lk.ink, 0.1, 0.2, 0.6);
      }
    },
    back: (d) => {
      key(d, 0.62);
      const x = -d.f * d.W * 0.46;
      toned(
        d.s,
        [
          { x, y: Y(d, 0.42) },
          { x: x - d.f * 3, y: Y(d, 0.58) },
          { x, y: Y(d, 0.24) },
        ],
        d.lk.paint,
        d.lk.paintShade,
        d.lk.ink,
        0.5,
        0.9 * d.k,
        0.5,
      );
    },
    front: (d) => {
      for (const a of [-0.5, 0, 0.5])
        mark(
          d.s,
          d.lk.ink,
          [
            { x: 0, y: d.top + 1.4 },
            { x: a * 3 + d.wob * 0.3, y: d.top - 2.6 },
          ],
          1.5 * d.k,
          d.sd + a * 10,
          [0, 0.7],
        );
    },
    snout: (d) => {
      const x = mouthX(d);
      const y = mouthY(d) - 1.8;
      toned(
        d.s,
        [
          { x: x - d.f * 1.4, y: y - 1.3 },
          { x: x + d.f * 2.6, y },
          { x: x - d.f * 1.4, y: y + 1.3 },
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
  frog: {
    size: [1.3, 0.7],
    shape: (W, H) => sup(W, H, 2.4, 0.8, 1.06, 0.12),
    feet: 'web',
    arms: 'none',
    hop: true,
    waddle: true,
    face: (c) => ({ eyes: { count: 2, y: 0.86, spread: 0.27, size: Math.min(1.9, c.eyes.size), style: 'ring' }, mouth: 'none' }),
    print: (d) => {
      // A painted waistcoat in the player's color, two brass buttons.
      livery(d, -0.1, 0.5);
      for (const u of [0.16, 0.34]) poly(d.s, oval(d.f * 0.5, Y(d, u), 0.8, 0.8, 6), BRASS);
    },
    back: (d) => key(d, 0.6),
    front: (d) => {
      const ey = d.by - d.H * 0.86;
      for (const side of [-1, 1]) tonedOval(d.s, side * d.W * 0.27 + d.f * 0.8, ey, 3.6, 3.2, 12, d.lk.paint, d.lk.paintShade, d.lk.ink, 0.6, 1.1 * d.k, 0.6);
    },
    snout: (d) => {
      const y = Y(d, 0.6);
      mark(
        d.s,
        d.lk.ink,
        [
          { x: -d.W * 0.3, y: y - 0.6 },
          { x: d.f, y: y + 0.8 },
          { x: d.W * 0.3, y: y - 0.6 },
        ],
        1.2,
        d.sd,
        [0.15, 0.15],
      );
    },
    parts: ['spring', 'key', 'shard', 'gear'],
  },
  rocket: {
    size: [0.72, 1.14],
    shine: true,
    shape: (W, H) => {
      const pts: P[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8;
        pts.push({ x: Math.sin((t * Math.PI) / 2) * W * 0.48, y: -H + t * H * 0.42 });
      }
      pts.push({ x: W * 0.46, y: -1.2 }, { x: W * 0.36, y: 0 }, { x: -W * 0.36, y: 0 }, { x: -W * 0.46, y: -1.2 });
      for (let i = 8; i >= 1; i--) {
        const t = i / 8;
        pts.push({ x: -Math.sin((t * Math.PI) / 2) * W * 0.48, y: -H + t * H * 0.42 });
      }
      return pts;
    },
    feet: 'none',
    arms: 'none',
    hop: true,
    paintFace: (d) => porthole(d, 0.4),
    print: (d) => {
      // Nose cone and a belly stripe in the player's color.
      livery(d, 0.6, 1.1);
      band(d, 0.04, 0.16, d.lk.player);
    },
    over: (d) => {
      for (const side of [-1, 1]) rivet(d, side * d.W * 0.34, Y(d, 0.56));
    },
    back: (d) => {
      // Fins, in the player's color, and a flame when it's going up.
      for (const side of [-1, 1])
        toned(
          d.s,
          [
            { x: side * d.W * 0.4, y: Y(d, 0.42) },
            { x: side * (d.W * 0.5 + 3.4), y: d.by + 0.4 },
            { x: side * d.W * 0.3, y: d.by + 0.6 },
          ],
          d.lk.player,
          d.lk.playerShade,
          d.lk.ink,
          0.6,
          1 * d.k,
          0.6,
        );
      if (!d.p.grounded && d.p.vy < 0) {
        const len = 3 + Math.min(4, -d.p.vy / 100) + Math.sin(d.t * 40) * 0.8;
        poly(
          d.s,
          [
            { x: -2.4, y: d.by },
            { x: 0, y: d.by + len },
            { x: 2.4, y: d.by },
          ],
          HOT_CSS,
        );
        poly(
          d.s,
          [
            { x: -1.1, y: d.by },
            { x: 0, y: d.by + len * 0.55 },
            { x: 1.1, y: d.by },
          ],
          WHITE_HOT,
        );
      }
    },
    parts: ['shard', 'shard', 'bolt', 'spring'],
  },
  top: {
    size: [1.04, 1],
    shine: true,
    shape: (W, H) =>
      rounded(
        [
          { x: -0.12 * W, y: -H },
          { x: 0.12 * W, y: -H },
          { x: 0.13 * W, y: -0.84 * H },
          { x: 0.5 * W, y: -0.56 * H },
          { x: 0.42 * W, y: -0.4 * H },
          { x: 0.05 * W, y: -0.02 * H },
          { x: 0, y: 0 },
          { x: -0.05 * W, y: -0.02 * H },
          { x: -0.42 * W, y: -0.4 * H },
          { x: -0.5 * W, y: -0.56 * H },
          { x: -0.13 * W, y: -0.84 * H },
        ],
        1.4,
      ),
    feet: 'none',
    arms: 'none',
    lift: 2.2,
    spin: true,
    paintFace: (d) => dots(d, 0.68, 0.14, 0.85, 0.12),
    print: (d) => {
      // The cone is the player's color, and painted stripes scroll round it as it spins.
      livery(d, -0.2, 0.5);
      const n = 4;
      const per = (d.W * 1.2) / n;
      const off = (((d.ph * 1.6 + d.t * 4) % per) + per) % per;
      for (let i = -1; i <= n; i++) {
        const x = -d.W * 0.6 + i * per + off;
        if (Math.abs(x) > d.W * 0.55) continue;
        poly(
          d.s,
          [
            { x: x - per * 0.18, y: Y(d, 0.5) },
            { x: x + per * 0.18, y: Y(d, 0.5) },
            { x: x * 0.4 + per * 0.08, y: d.by + 1 },
            { x: x * 0.4 - per * 0.08, y: d.by + 1 },
          ],
          d.lk.playerDark,
        );
      }
      band(d, 0.84, 1.2, d.lk.player);
    },
    parts: ['shard', 'shard', 'bolt', 'spring'],
  },
  jackbox: {
    size: [0.86, 0.84],
    shape: (W, H) => sup(W, H, 2.2, 0.98, 1),
    feet: 'spring',
    arms: 'mitten',
    hop: true,
    hands: 'tin',
    face: (c) => ({ mouth: 'grin', eyes: { y: 0.46, count: 2, size: Math.min(2, c.eyes.size), style: c.eyes.style === 'visor' ? 'ring' : c.eyes.style } }),
    print: (d) => {
      for (const side of [-1, 1]) poly(d.s, oval(side * d.W * 0.36, Y(d, 0.26), 1.4, 1.1, 8), '#d9707f');
    },
    back: (d) => {
      // A ruff under the head.
      const pts: P[] = [];
      for (let i = 0; i <= 9; i++) pts.push({ x: -d.W * 0.6 + (i / 9) * d.W * 1.2, y: d.by + (i % 2 ? 2 : -0.6) });
      pts.push({ x: d.W * 0.5, y: d.by - 2.2 }, { x: -d.W * 0.5, y: d.by - 2.2 });
      toned(d.s, pts, TIN, TIN_SH, d.lk.ink, 0.5, 0.9 * d.k, 0.5);
    },
    front: (d) => {
      // The jester's cap, all of it in the player's color: half the toy.
      const brim = Y(d, 0.66);
      toned(
        d.s,
        [
          { x: -d.W * 0.56, y: brim + 0.8 },
          { x: -d.W * 0.72 + d.wob * 0.4, y: d.top - 3.6 },
          { x: -d.W * 0.18, y: d.top - 0.6 },
          { x: 0, y: d.top + 0.6 },
          { x: d.W * 0.18, y: d.top - 0.6 },
          { x: d.W * 0.72 + d.wob * 0.4, y: d.top - 3.6 },
          { x: d.W * 0.56, y: brim + 0.8 },
        ],
        d.lk.player,
        d.lk.playerShade,
        d.lk.ink,
        0.7,
        1.1 * d.k,
        0.8,
      );
      mark(
        d.s,
        d.lk.playerDark,
        [
          { x: -d.W * 0.5, y: brim },
          { x: d.W * 0.5, y: brim - 0.2 },
        ],
        1.3,
        d.sd,
        [0, 0],
      );
      for (const side of [-1, 1]) tonedOval(d.s, side * d.W * 0.72 + d.wob * 0.4, d.top - 3.6, 1.2, 1.2, 8, BRASS, BRASS_SH, d.lk.ink, 0.4, 0.8 * d.k, 0.4);
    },
    parts: ['spring', 'spring', 'shard', 'gear'],
  },
  beetle: {
    size: [1.2, 0.68],
    shape: (W, H) => dome(W, H, 1.6, 1.02),
    feet: 'none',
    arms: 'none',
    waddle: true,
    shine: true,
    faceX: 0.5,
    paintFace: (d) => beady(d, 0.3, 0.07, 0.6),
    print: (d) => {
      // The whole shell is painted in the player's color, split down the middle, over a tin rim.
      livery(d, 0.2, 1.2);
      mark(
        d.s,
        d.lk.playerDark,
        [
          { x: 0, y: d.top },
          { x: 0, y: Y(d, 0.2) },
        ],
        1,
        d.sd,
        [0, 0],
      );
      for (const side of [-1, 1]) poly(d.s, oval(side * d.W * 0.24, Y(d, 0.62), 1.3, 1.1, 8), d.lk.playerDark);
    },
    back: (d) => {
      key(d, 0.64);
      // Three legs a side, scuttling.
      for (const side of [-1, 1])
        for (let i = 0; i < 3; i++) {
          const ph = d.ph * 1.3 + i * 2.1 + (side > 0 ? 1 : 0);
          const lift = d.m === 'walk' || d.m === 'run' ? Math.max(0, Math.sin(ph)) * 1.3 : 0;
          const x0 = side * d.W * (0.16 + i * 0.12);
          d.s.fillStyle = d.lk.ink;
          line(d.s, x0, d.by - 1.2, x0 + side * 2.2, d.by - 0.8 - lift, { w: 1.4 * d.k, seed: i, taper: [0, 0], press: 0 });
          line(d.s, x0 + side * 2.2, d.by - 0.8 - lift, x0 + side * 2.8, -0.3 - lift * 0.4, { w: 1.4 * d.k, seed: i + 1, taper: [0, 0.6], press: 0 });
        }
    },
    front: (d) => {
      // An iron head poking out the front, with brass feelers.
      const hx = d.f * d.W * 0.5;
      const hy = Y(d, 0.3);
      for (const side of [-1, 1]) stalk(d, hx + d.f * 1, hy - 1.4, hx + d.f * 3.6 + side * 0.8 + d.wob * 0.3, hy - 4.6 + side * 0.6, 0.7, BRASS, BRASS_SH);
      tonedOval(d.s, hx, hy, 2.8, 2.3, 12, IRON, IRON_SH, d.lk.ink, 0.6, 1 * d.k, 0.6);
    },
    parts: ['gear', 'key', 'shard', 'bolt'],
  },
};
