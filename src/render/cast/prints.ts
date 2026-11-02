import { css, hsl3 } from '../../core/color';
import { hash2 } from '../../core/rng';
import type { Print } from '../../gen/cast';
import { type Art, type D, dome, ear, line, mark, oval, poly, ribbon, shadowFor, spot, stalk, sup, toned, tonedOval } from './draw';
import { antennae, muzzle, scatter, sideStripes, wings, Y } from './kit';

/**
 * Direction A: today's blob, wearing a creature print. The print is the identity: each one is a pattern
 * a child could name (bee, ladybug, cow, zebra), drawn as two or three big flat shapes, plus the one
 * accessory and body that belong to it (a bee's wings, a cow's horns, a mushroom's cap). The body stays
 * the player's color so the HUD still matches; the marks are a dark or a pale of it.
 */

const tabbyTail: Art['rope'] = {
  kind: 'tail',
  len: 7,
  draw: (s, pts, d) => {
    ribbon(s, pts, 2.6, 1.6, d.pal.base, d.pal.shade, d.pal.ink);
    // Rings down the tail, every other segment.
    for (let i = 2; i < pts.length - 1; i += 2) tonedOval(s, pts[i].x, pts[i].y, 1.4, 1.4, 8, d.pal.dark, d.pal.darkShade, d.pal.ink, 0.1, 0.2, 0.2);
  },
};

const leopardTail: Art['rope'] = {
  kind: 'tail',
  len: 7,
  draw: (s, pts, d) => {
    ribbon(s, pts, 2.4, 1.8, d.pal.base, d.pal.shade, d.pal.ink);
    for (let i = 1; i < pts.length; i += 2) spot(s, pts[i].x, pts[i].y, 0.9, 0.8, i + d.c.seed, d.pal.dark, 0.3);
  },
};

const scaleTail: Art['rope'] = {
  kind: 'tail',
  len: 7,
  draw: (s, pts, d) => {
    ribbon(s, pts, 3, 0.8, d.pal.base, d.pal.shade, d.pal.ink);
    const tip = pts[pts.length - 1];
    toned(
      s,
      [
        { x: tip.x - 2, y: tip.y - 0.5 },
        { x: tip.x + 0.3, y: tip.y - 3.4 },
        { x: tip.x + 2, y: tip.y - 0.4 },
        { x: tip.x, y: tip.y + 1.4 },
      ],
      d.pal.acc,
      d.pal.accShade,
      d.pal.ink,
      0.5,
      0.9,
      0.5,
    );
  },
};

function catEars(d: D, lean = 0.6) {
  for (const side of [-1, 1]) ear(d, side * d.W * 0.28, 5.4, 5.2 + d.v[3] * 1.4, side * lean, d.pal.base, d.pal.shade, d.pal.light);
}

export const PRINT_ART: Record<Print, Art> = {
  bee: {
    size: (v) => [1 + v[0] * 0.08, 0.98],
    shape: (W, H) => sup(W, H, 2.3, 0.94, 1.04, 0.08),
    pal: (c) => ({ dark: css({ h: c.body.h, s: 40, l: 13 }) }),
    print: (d) => {
      // Two fat bands and a dark seat: the read is "stripes", at any size.
      const n = d.v[1] < 0.5 ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const u = n === 2 ? 0.17 + i * 0.3 : 0.1 + i * 0.22;
        const y = Y(d, u);
        poly(
          d.s,
          [
            { x: -d.W, y: y - 1.9 },
            { x: d.W, y: y - 2.5 },
            { x: d.W, y: y + 1.6 },
            { x: -d.W, y: y + 2.1 },
          ],
          d.pal.dark,
        );
      }
    },
    back: (d) => wings(d),
    front: (d) => antennae(d, 5.2, 0.2, 1.3),
  },
  ladybug: {
    size: () => [1.12, 0.92],
    shape: (W, H) => dome(W, H, 2.6),
    feet: 'shoe',
    pal: (c) => ({ dark: css({ h: c.body.h, s: 30, l: 11 }), foot: '#1d1714', footShade: '#120e0c' }),
    print: (d) => {
      const { s, W } = d;
      // The head cap, then the split down the shell, then the spots: the three marks of a ladybug.
      poly(s, oval(0, d.top - 1, W * 0.62, d.H * 0.28, 16), d.pal.dark);
      mark(
        s,
        d.pal.dark,
        [
          { x: 0, y: d.top + 3 },
          { x: 0.3, y: Y(d, 0.4) },
          { x: 0, y: d.by + 1 },
        ],
        1.3,
        d.sd,
        [0, 0],
      );
      const n = 4 + Math.floor(d.v[1] * 3);
      for (let i = 0; i < n; i++) {
        const side = i % 2 ? 1 : -1;
        const u = 0.12 + ((i >> 1) / Math.ceil(n / 2)) * 0.45 + hash2(d.sd, i, 4) * 0.05;
        spot(s, side * W * (0.22 + hash2(d.sd, i, 5) * 0.14), Y(d, u), 1.6, 1.5, d.sd + i, d.pal.dark, 0.15);
      }
    },
    front: (d) => antennae(d, 3.6, 0.16, 1),
  },
  frog: {
    size: (v) => [1.2 + v[0] * 0.06, 0.84],
    shape: (W, H) => sup(W, H, 2.2, 0.86, 1.06, 0.12),
    feet: 'web',
    face: (c) => ({
      eyes: { count: 2, y: 0.84, spread: 0.27, size: Math.max(2.3, c.eyes.size), style: c.eyes.style === 'visor' ? 'ring' : c.eyes.style },
      mouth: 'grin',
    }),
    pal: (c) => ({ foot: css(c.body, 6), footShade: css(c.body, -14, 1, 8) }),
    print: (d) => {
      poly(d.s, oval(0, d.by + 1, d.W * 0.42, d.H * 0.32, 14), d.pal.light);
      scatter(d, 4, 1.5, d.pal.dark, 31, 0.45, 0.95);
    },
    front: (d) => {
      // The eyes sit on two bumps above the head line: the frog's whole silhouette.
      const ey = d.by - d.H * 0.84;
      for (const side of [-1, 1]) tonedOval(d.s, side * d.W * 0.27 + d.f * 0.8, ey, 3.6, 3.2, 12, d.pal.base, d.pal.shade, d.pal.ink, 0.6, 1.1 * d.k, 0.6);
    },
  },
  tabby: {
    shape: (W, H) => sup(W, H, 2.9, 0.98, 1.02),
    feet: 'paw',
    rope: tabbyTail,
    pal: (c) => ({ dark: css({ h: c.body.h, s: Math.min(60, c.body.s), l: 24 }), foot: css(c.belly), footShade: css(c.belly, -16) }),
    print: (d) => {
      sideStripes(d, 3, 0.36, 2, d.pal.dark, 11);
      // The forehead M.
      for (const dx of [-2.2, 0, 2.2])
        mark(
          d.s,
          d.pal.dark,
          [
            { x: dx * (d.W / 14), y: d.top + 0.5 },
            { x: dx * (d.W / 14) * 0.9, y: d.top + 3.6 + (dx ? 0 : 0.8) },
          ],
          1.6,
          d.sd + dx,
          [0, 0.7],
        );
      poly(d.s, oval(0, d.by + 0.6, d.W * 0.28, d.H * 0.22, 12), d.pal.light);
    },
    front: (d) => catEars(d),
  },
  zebra: {
    size: () => [0.92, 1.12],
    shape: (W, H) => sup(W, H, 2.8, 0.92, 1),
    pal: (c) => ({ dark: css({ h: c.body.h, s: 25, l: 10 }), foot: '#1b1613', footShade: '#100c0a' }),
    print: (d) => {
      // Many narrow stripes, all the way round: the density is what says zebra, not tabby.
      const n = 6 + Math.floor(d.v[1] * 2);
      for (let i = 0; i < n; i++) {
        const x = -d.W * 0.6 + (i / (n - 1)) * d.W * 1.2;
        const bend = (x / d.W) * 3;
        mark(
          d.s,
          d.pal.dark,
          [
            { x: x - bend, y: d.top - 1 },
            { x: x + 0.8 - bend * 0.5, y: Y(d, 0.6) },
            { x: x - 0.4, y: Y(d, 0.3) },
            { x: x + 0.3 + bend * 0.3, y: d.by + 1 },
          ],
          Math.abs(x) < d.W * 0.2 ? 1.2 : 1.6,
          d.sd + i,
          [0.1, 0.5],
        );
      }
      poly(d.s, oval(d.f * 1.5, Y(d, 0.22), d.W * 0.34, d.H * 0.17, 12), d.pal.light);
    },
    front: (d) => {
      // A short upright mane.
      const pts = [{ x: -4.6, y: d.top + 2.6 }];
      for (let i = -2; i <= 2; i++) {
        pts.push({ x: i * 1.9 - d.f * 0.6 + d.wob * 0.3, y: d.top - 4.6 + Math.abs(i) * 0.7 });
        pts.push({ x: i * 1.9 + 0.8, y: d.top - 1.2 });
      }
      pts.push({ x: 4.6, y: d.top + 2.6 });
      toned(d.s, pts, d.pal.dark, d.pal.darkShade, d.pal.ink, 0.6, 1 * d.k, 0.6);
    },
  },
  calico: {
    shape: (W, H) => sup(W, H, 2.4, 0.96, 1.04, 0.08),
    feet: 'paw',
    rope: { kind: 'tail', len: 6 },
    pal: (c) => ({ foot: css(c.belly), footShade: css(c.belly, -16), acc: css(hsl3(28, 85, 55)), accShade: css(hsl3(24, 85, 42)) }),
    print: (d) => {
      // Big patches, three tones, cut off by the body's edge.
      spot(d.s, -d.W * 0.42, Y(d, 0.72), d.W * 0.34, d.H * 0.3, d.sd + 1, d.pal.light, 0.3, 0.4);
      spot(d.s, d.W * 0.45, Y(d, 0.3), d.W * 0.3, d.H * 0.32, d.sd + 2, d.pal.dark, 0.3, -0.3);
      spot(d.s, -d.W * 0.3, Y(d, 0.08), d.W * 0.36, d.H * 0.22, d.sd + 3, d.pal.light, 0.3);
      spot(d.s, d.W * 0.36, Y(d, 0.9), d.W * 0.22, d.H * 0.2, d.sd + 4, d.pal.dark, 0.3);
    },
    front: (d) => {
      ear(d, -d.W * 0.28, 5.4, 5.4, -0.6, d.pal.light, d.pal.lightShade, d.pal.base);
      ear(d, d.W * 0.28, 5.4, 5.4, 0.6, d.pal.dark, d.pal.darkShade, d.pal.base);
    },
  },
  leopard: {
    shape: (W, H) => sup(W, H, 2.5, 0.95, 1.02),
    feet: 'paw',
    rope: leopardTail,
    pal: (c) => ({ dark: css({ h: c.body.h, s: 40, l: 14 }), acc: css(c.body, -12, 1, 6, 12), foot: css(c.body, -6), footShade: css(c.body, -22, 1, 8) }),
    print: (d) => {
      // Rosettes: broken rings around a darker heart.
      for (let i = 0; i < 7; i++) {
        const x = (hash2(d.sd, i, 41) - 0.5) * d.W * 1.05;
        const u = 0.08 + hash2(d.sd, i, 42) * 0.86;
        const face = Math.abs(x) < d.W * 0.28 && u > 0.38 && u < 0.72;
        if (face) continue;
        const y = Y(d, u);
        spot(d.s, x, y, 1.5, 1.4, d.sd + i, d.pal.acc, 0.2);
        for (let j = 0; j < 3; j++) {
          const a = j * 2.1 + hash2(d.sd, i, 43) * 6;
          const pts = [0, 0.5, 1].map((q) => ({ x: x + Math.cos(a + q * 1.3) * 2.5, y: y + Math.sin(a + q * 1.3) * 2.3 }));
          mark(d.s, d.pal.dark, pts, 1.5, d.sd + i * 3 + j, [0.2, 0.3]);
        }
      }
    },
    front: (d) => {
      for (const side of [-1, 1]) tonedOval(d.s, side * d.W * 0.3, d.top + 0.6, 2.4, 2.2, 9, d.pal.base, d.pal.shade, d.pal.ink, 0.6, 1 * d.k, 0.6);
    },
  },
  cow: {
    size: () => [1.08, 0.98],
    shape: (W, H) => sup(W, H, 3.4, 0.98, 1),
    pal: () => ({ foot: '#2a211c', footShade: '#18120f' }),
    print: (d) => {
      spot(d.s, -d.W * 0.4, Y(d, 0.78), d.W * 0.36, d.H * 0.28, d.sd + 1, d.pal.light, 0.35, 0.3);
      spot(d.s, d.W * 0.42, Y(d, 0.25), d.W * 0.32, d.H * 0.3, d.sd + 2, d.pal.light, 0.35, -0.5);
      if (d.v[1] > 0.4) spot(d.s, -d.W * 0.3, Y(d, 0.12), d.W * 0.2, d.H * 0.14, d.sd + 3, d.pal.light, 0.35);
    },
    front: (d) => {
      for (const side of [-1, 1]) {
        toned(
          d.s,
          [
            { x: side * d.W * 0.24, y: d.top + 2.6 },
            { x: side * d.W * 0.44, y: d.top - 1.4 },
            { x: side * d.W * 0.6, y: d.top - 3.4 },
            { x: side * d.W * 0.5, y: d.top + 0.6 },
            { x: side * d.W * 0.4, y: d.top + 3 },
          ],
          '#f1e6d2',
          '#c4b49a',
          d.pal.ink,
          0.7,
          1.1 * d.k,
          0.7,
        );
        tonedOval(d.s, side * d.W * 0.54, d.top + 2.6, 2.6, 1.4, 9, d.pal.base, d.pal.shade, d.pal.ink, 0.5, 0.9 * d.k, 0.5);
      }
      muzzle(d, '#f2a7b4', 0.4, 0.2);
    },
  },
  jelly: {
    size: () => [1.08, 0.86],
    shape: (W, H) => {
      // A bell with a frilled hem.
      const pts = dome(W, H * 0.92, 1, 1.04);
      return pts.map((p) => (p.y > -1.2 ? { x: p.x, y: p.y - 1.2 } : p));
    },
    feet: 'none',
    hop: false,
    pal: (c) => ({ light: css(c.body, 22, 1, -18) }),
    face: () => ({ eyes: { y: 0.42 } }),
    back: (d) => {
      // Tentacles hang off the hem and trail behind the way it moves.
      const n = 4;
      for (let i = 0; i < n; i++) {
        const x0 = -d.W * 0.36 + (i / (n - 1)) * d.W * 0.72;
        const sway = Math.sin(d.t * 5 + i * 1.3) * 1.1 - d.f * (Math.abs(d.p.vx) / 90);
        d.s.fillStyle = d.pal.ink;
        const pts = [
          { x: x0, y: d.by - 1 },
          { x: x0 + sway * 0.5, y: d.by + 1.6 },
          { x: x0 + sway, y: d.by + 3.2 - (d.p.grounded ? 1 : 0) },
        ];
        line(d.s, pts[0].x, pts[0].y, pts[2].x, pts[2].y, { w: 2.2 * d.k, seed: i, taper: [0, 0.6], press: 0 });
        d.s.fillStyle = d.pal.light;
        line(d.s, pts[0].x, pts[0].y, pts[2].x, pts[2].y - 0.4, { w: 1, seed: i, taper: [0, 0.6], press: 0 });
      }
    },
    print: (d) => {
      poly(d.s, oval(0, d.by - 0.2, d.W * 0.62, 2.4, 16), d.pal.light);
      scatter(d, 4, 0.9, d.pal.light, 51, 0.7, 0.98);
    },
  },
  mushroom: {
    size: () => [1.14, 1],
    shape: (W, H) => {
      // Cap over a stem: one closed outline.
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const a = Math.PI + (i / 16) * Math.PI;
        pts.push({ x: Math.cos(a) * W * 0.56, y: -H * 0.5 + Math.sin(a) * H * 0.5 });
      }
      pts.push({ x: W * 0.5, y: -H * 0.42 }, { x: W * 0.3, y: -H * 0.4 }, { x: W * 0.34, y: -H * 0.12 }, { x: W * 0.3, y: 0 });
      pts.push({ x: -W * 0.3, y: 0 }, { x: -W * 0.34, y: -H * 0.12 }, { x: -W * 0.3, y: -H * 0.4 }, { x: -W * 0.5, y: -H * 0.42 });
      return pts;
    },
    face: () => ({ eyes: { y: 0.3, spread: 0.18, size: 1.9, count: 2 }, mouth: 'smile' }),
    print: (d) => {
      poly(
        d.s,
        [
          { x: -d.W, y: Y(d, 0.47) },
          { x: d.W, y: Y(d, 0.47) },
          { x: d.W, y: d.by + 2 },
          { x: -d.W, y: d.by + 2 },
        ],
        d.pal.light,
      );
      const n = 3 + Math.floor(d.v[1] * 2);
      for (let i = 0; i < n; i++) {
        const a = Math.PI + ((i + 0.5) / n) * Math.PI;
        spot(d.s, Math.cos(a) * d.W * 0.34, Y(d, 0.6) + Math.sin(a) * d.H * 0.28, 1.8, 1.4, d.sd + i, '#fbf3e4', 0.2);
      }
    },
    over: (d) =>
      mark(
        d.s,
        d.pal.ink,
        [
          { x: -d.W * 0.52, y: Y(d, 0.49) },
          { x: 0, y: Y(d, 0.47) },
          { x: d.W * 0.52, y: Y(d, 0.49) },
        ],
        1.1,
        d.sd,
        [0.2, 0.2],
      ),
  },
  beetle: {
    size: () => [1.1, 0.98],
    shape: (W, H) => dome(W, H, 2.2, 1.02),
    pal: (c) => ({ dark: css({ h: c.body.h, s: 50, l: 15 }), foot: '#1b1613', footShade: '#100c0a' }),
    face: () => ({ eyes: { y: 0.36 } }),
    print: (d) => {
      // Shell over a dark underside, split down the middle, with one hard shine per wing case.
      poly(
        d.s,
        [
          { x: -d.W, y: Y(d, 0.52) },
          { x: d.W, y: Y(d, 0.52) },
          { x: d.W, y: d.by + 2 },
          { x: -d.W, y: d.by + 2 },
        ],
        d.pal.dark,
      );
      mark(
        d.s,
        d.pal.dark,
        [
          { x: 0, y: d.top },
          { x: 0, y: Y(d, 0.52) },
        ],
        1.2,
        d.sd,
        [0, 0],
      );
      for (const side of [-1, 1])
        mark(
          d.s,
          'rgba(255,255,255,0.75)',
          [
            { x: side * d.W * 0.2 - 1.4, y: d.top + 3.6 },
            { x: side * d.W * 0.26 - 0.8, y: d.top + 1.8 },
          ],
          1.3,
          d.sd + side,
          [0.3, 0.3],
        );
    },
    front: (d) => {
      // A rhino horn.
      toned(
        d.s,
        [
          { x: -1.6, y: d.top + 2 },
          { x: d.f * 1.2, y: d.top - 3.4 },
          { x: d.f * 3.2, y: d.top - 5.8 },
          { x: d.f * 2.6, y: d.top - 2.4 },
          { x: 1.8, y: d.top + 2 },
        ],
        d.pal.dark,
        d.pal.darkShade,
        d.pal.ink,
        0.6,
        1 * d.k,
        0.6,
      );
    },
  },
  patchwork: {
    shape: (W, H) => sup(W, H, 3.2, 0.96, 1.02),
    face: (c) => ({ eyes: { style: 'dot', count: c.eyes.count === 3 ? 2 : c.eyes.count }, mouth: 'flat' }),
    pal: (c) => ({ acc: css(c.body, 14, 1, -10, 25), accShade: css(c.body, -4, 1, -10, 25) }),
    print: (d) => {
      const { s, W } = d;
      // Three cloth panels and their stitches.
      poly(
        s,
        [
          { x: -W, y: d.top - 1 },
          { x: -W * 0.05, y: d.top - 1 },
          { x: -W * 0.1, y: Y(d, 0.45) },
          { x: -W, y: Y(d, 0.5) },
        ],
        d.pal.acc,
      );
      poly(
        s,
        [
          { x: W * 0.1, y: Y(d, 0.42) },
          { x: W, y: Y(d, 0.38) },
          { x: W, y: d.by + 2 },
          { x: W * 0.05, y: d.by + 2 },
        ],
        d.pal.light,
      );
      s.fillStyle = d.pal.ink;
      const stitch = (x0: number, y0: number, x1: number, y1: number, n: number) => {
        for (let i = 0; i <= n; i++) {
          const x = x0 + ((x1 - x0) * i) / n;
          const y = y0 + ((y1 - y0) * i) / n;
          line(s, x - 0.9, y - 0.9, x + 0.9, y + 0.9, { w: 0.8, seed: i, taper: [0.2, 0.2], press: 0 });
        }
      };
      stitch(-W * 0.07, d.top, -W * 0.1, Y(d, 0.45), 3);
      stitch(-W * 0.6, Y(d, 0.5), -W * 0.1, Y(d, 0.46), 3);
      stitch(W * 0.1, Y(d, 0.42), W * 0.6, Y(d, 0.38), 3);
      stitch(W * 0.08, Y(d, 0.42), W * 0.05, d.by, 3);
    },
    front: (d) => {
      // A big sewn-on button.
      const x = -d.f * d.W * 0.3;
      const y = Y(d, 0.22);
      tonedOval(d.s, x, y, 2.2, 2.2, 10, '#f2c94c', '#c99a1e', d.pal.ink, 0.5, 0.9 * d.k, 0.5);
      for (const dx of [-0.6, 0.6]) poly(d.s, oval(x + dx, y, 0.4, 0.4, 6), d.pal.ink);
    },
  },
  giraffe: {
    size: () => [0.9, 1.14],
    shape: (W, H) => sup(W, H, 2.6, 0.84, 1),
    feet: 'paw',
    pal: (c) => ({ foot: '#2a211c', footShade: '#18120f', dark: css(c.body, -14, 1, 6) }),
    print: (d) => {
      // Pale net, then the patches inside it in the body's own tone.
      const { s, W } = d;
      poly(
        s,
        [
          { x: -W, y: d.top - 2 },
          { x: W, y: d.top - 2 },
          { x: W, y: d.by + 2 },
          { x: -W, y: d.by + 2 },
        ],
        d.pal.light,
      );
      const rows = 4;
      for (let r = 0; r < rows; r++) {
        const cols = 3;
        for (let q = 0; q < cols; q++) {
          const cx = -W * 0.55 + ((q + (r % 2) * 0.5) / (cols - 1)) * W * 1.1;
          const cy = d.top + 1.5 + (r / (rows - 1)) * (d.H - 2);
          const pts = [];
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + hash2(d.sd, r * 7 + q, i) * 0.6;
            const rr = 2.6 + hash2(d.sd, r * 9 + q, i + 10) * 0.7;
            pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.95 });
          }
          poly(s, pts, d.pal.base);
        }
      }
    },
    front: (d) => {
      for (const side of [-1, 1]) {
        stalk(d, side * d.W * 0.16, d.top + 2, side * d.W * 0.2 + d.wob * 0.2, d.top - 3.6, 1.4, d.pal.dark, d.pal.darkShade);
        tonedOval(d.s, side * d.W * 0.5, d.top + 1.6, 2.6, 1.3, 9, d.pal.base, d.pal.shade, d.pal.ink, 0.5, 0.9 * d.k, 0.5);
      }
    },
  },
  clownfish: {
    size: () => [1.08, 0.96],
    shape: (W, H) => sup(W, H, 2.2, 1, 1),
    pal: (c) => ({ light: '#fbf6ee', dark: css({ h: c.body.h, s: 40, l: 12 }) }),
    face: () => ({ mouth: 'o' }),
    print: (d) => {
      // White bands with dark edges.
      const xs = d.v[1] < 0.5 ? [-0.32, 0.36] : [-0.42, 0.04, 0.46];
      for (const k of xs) {
        const x = k * d.W;
        const pts = [
          { x: x - 1.9, y: d.top - 1 },
          { x: x + 1.4, y: d.top - 1 },
          { x: x + 2.3, y: Y(d, 0.5) },
          { x: x + 1.4, y: d.by + 1 },
          { x: x - 1.9, y: d.by + 1 },
          { x: x - 1.1, y: Y(d, 0.5) },
        ];
        const edge = pts.map((p, i) => ({ x: p.x + (i < 3 && i > 0 ? 0.9 : -0.9), y: p.y }));
        poly(d.s, edge, d.pal.dark);
        poly(d.s, pts, d.pal.light);
      }
    },
    back: (d) => {
      // Dorsal fin over the back, tail fin behind.
      const flick = Math.sin(d.t * 9) * 0.6;
      toned(
        d.s,
        [
          { x: -d.W * 0.3, y: d.top + 2 },
          { x: -d.f * 1.6, y: d.top - 3.6 },
          { x: d.W * 0.24, y: d.top + 1.6 },
        ],
        d.pal.base,
        d.pal.shade,
        d.pal.ink,
        0.6,
        1 * d.k,
        0.6,
      );
      const bx = -d.f * d.W * 0.5;
      toned(
        d.s,
        [
          { x: bx, y: Y(d, 0.5) },
          { x: bx - d.f * 4.5, y: Y(d, 0.78) + flick },
          { x: bx - d.f * 3.6, y: Y(d, 0.5) },
          { x: bx - d.f * 4.5, y: Y(d, 0.2) - flick },
        ],
        d.pal.base,
        d.pal.shade,
        d.pal.ink,
        0.6,
        1 * d.k,
        0.6,
      );
    },
  },
  scales: {
    shape: (W, H) => sup(W, H, 2.3, 0.88, 1.06, 0.1),
    rope: scaleTail,
    pal: (c) => ({ dark: css(c.body, -18, 1, 6), acc: css(c.accent), accShade: css(c.accent, -18) }),
    print: (d) => {
      // Scallop rows, then pale belly plates.
      for (let r = 0; r < 4; r++) {
        const y = d.top + 2.4 + r * 3;
        for (let q = -3; q <= 3; q++) {
          const x = q * 2.6 + (r % 2) * 1.3;
          const arc = [0, 1, 2, 3, 4].map((i) => ({ x: x - 1.3 + i * 0.65, y: y + Math.sin((i / 4) * Math.PI) * 1.3 }));
          d.s.fillStyle = d.pal.dark;
          for (let i = 1; i < arc.length; i++) line(d.s, arc[i - 1].x, arc[i - 1].y, arc[i].x, arc[i].y, { w: 0.9, seed: i, taper: [0, 0], press: 0 });
        }
      }
      for (let i = 0; i < 3; i++) poly(d.s, oval(d.f * 0.8, Y(d, 0.08 + i * 0.12), d.W * (0.3 - i * 0.03), 1.1, 10), d.pal.light);
    },
    front: (d) => {
      // A dorsal ridge of little spikes.
      for (let i = -1; i <= 1; i++) {
        const x = i * 3 - d.f * 0.8;
        toned(
          d.s,
          [
            { x: x - 1.5, y: d.top + 1.8 },
            { x: x - d.f * 0.6, y: d.top - 2.6 + Math.abs(i) * 0.8 },
            { x: x + 1.5, y: d.top + 1.8 },
          ],
          d.pal.acc,
          d.pal.accShade,
          d.pal.ink,
          0.5,
          0.9 * d.k,
          0.5,
        );
      }
    },
  },
  dalmatian: {
    shape: (W, H) => sup(W, H, 2.4, 0.96, 1.04, 0.06),
    feet: 'paw',
    pal: (c) => ({ dark: css({ h: c.body.h, s: 30, l: 12 }), foot: css(c.body, 6), footShade: css(c.body, -14, 1, 8) }),
    print: (d) => {
      scatter(d, 8, 1.3, d.pal.dark, 61);
      // One eye patch: the dog's tell.
      spot(d.s, -d.f * d.W * 0.26, d.by - d.H * d.c.eyes.y, 3.4, 3, d.sd + 9, d.pal.dark, 0.25);
    },
    front: (d) => {
      // Floppy ears hang beside the head and swing with the run.
      for (const side of [-1, 1]) {
        const sw = d.wob * 0.08 * side;
        toned(d.s, oval(side * d.W * 0.5, d.top + 4.6, 2.4, 4.4, 10, side * 0.25 + sw), d.pal.dark, d.pal.darkShade, d.pal.ink, 0.6, 1.05 * d.k, 0.6);
      }
    },
  },
};

export { shadowFor };
