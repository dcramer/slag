import { css, hsl3 } from '../../core/color';
import { hash2 } from '../../core/rng';
import type { Species } from '../../gen/cast';
import { type Art, type D, dome, ear, line, mark, oval, poly, ribbon, spot, stalk, sup, toned, tonedOval } from './draw';
import { airborne, antennae, mouthX, mouthY, muzzle, scatter, sideStripes, spiral, wings, Y } from './kit';

/**
 * Direction B: a cast of species, the way a barnyard party game casts animals. Each species owns one
 * silhouette trait you can read at 16 px (a frog's eye bumps, a bunny's ears, a snail's shell, a crab's
 * claws), then its face, feet and markings. The body is always the player's color, Yoshi-style, so the
 * HUD still matches; the species' fixed colors are the small parts (beaks, bills, gills, a fox's tip).
 * Inside a species the seed varies markings and ear set.
 */

const ORANGE = css(hsl3(32, 92, 56));
const ORANGE_SH = css(hsl3(24, 88, 42));
const PINK = css(hsl3(345, 80, 74));
const PINK_SH = css(hsl3(345, 60, 58));
const CREAM = '#fbf3e4';
const CREAM_SH = '#d9c9ae';

function beak(d: D, len: number, h: number, fill = ORANGE, shade = ORANGE_SH, flat = false) {
  const x = mouthX(d);
  const y = mouthY(d) - (flat ? 0.4 : 1.6);
  const open = d.m === 'fall' || d.m === 'cheer' ? 1.3 : 0;
  toned(
    d.s,
    [
      { x: x - d.f * 1.8, y: y - h },
      { x: x + d.f * len, y: y - (flat ? h * 0.4 : 0) },
      { x: x + d.f * (len - 0.4), y: y + (flat ? h * 0.5 : 0.3) + open },
      { x: x - d.f * 1.8, y: y + h * 0.7 + open },
    ],
    fill,
    shade,
    d.pal.ink,
    0.5,
    0.9 * d.k,
    0.5,
  );
}

const bushy: Art['rope'] = {
  kind: 'tail',
  len: 7,
  draw: (s, pts, d) => {
    ribbon(s, pts, 3.4, 5.2, d.pal.base, d.pal.shade, d.pal.ink);
    // A pale tip, the fox's flag.
    const n = pts.length;
    ribbon(s, pts.slice(n - 3), 4.2, 3, CREAM, CREAM_SH, d.pal.ink);
  },
};

const lizardTail: Art['rope'] = {
  kind: 'tail',
  len: 6,
  draw: (s, pts, d) => ribbon(s, pts, 3.2, 0.9, d.pal.base, d.pal.shade, d.pal.ink),
};

const catTail: Art['rope'] = {
  kind: 'tail',
  len: 7,
  draw: (s, pts, d) => {
    ribbon(s, pts, 2.2, 1.9, d.pal.base, d.pal.shade, d.pal.ink);
    if (d.v[1] > 0.66) ribbon(s, pts.slice(pts.length - 2), 2, 1.8, CREAM, CREAM_SH, d.pal.ink);
  },
};

export const SPECIES_ART: Record<Species, Art> = {
  bee: {
    shape: (W, H) => sup(W, H, 2.2, 0.92, 1.06, 0.1),
    feet: 'paw',
    pal: (c) => ({ dark: css({ h: c.body.h, s: 40, l: 12 }), foot: css({ h: c.body.h, s: 40, l: 14 }), footShade: '#100c0a' }),
    print: (d) => {
      for (const u of d.v[1] < 0.5 ? [0.14, 0.4] : [0.1, 0.3]) {
        const y = Y(d, u);
        poly(
          d.s,
          [
            { x: -d.W, y: y - 1.2 },
            { x: d.W, y: y - 1.6 },
            { x: d.W, y: y + 1 },
            { x: -d.W, y: y + 1.4 },
          ],
          d.pal.dark,
        );
      }
      // Fuzz on the crown.
      for (let i = -2; i <= 2; i++)
        mark(
          d.s,
          d.pal.light,
          [
            { x: i * 1.8, y: d.top + 0.4 },
            { x: i * 1.8 + 0.4, y: d.top + 1.8 },
          ],
          0.9,
          d.sd + i,
          [0.2, 0.6],
        );
    },
    back: (d) => {
      wings(d, 3.3, 5);
      // The stinger.
      const x = -d.f * d.W * 0.48;
      toned(
        d.s,
        [
          { x, y: Y(d, 0.3) },
          { x: x - d.f * 3.2, y: Y(d, 0.18) },
          { x, y: Y(d, 0.1) },
        ],
        d.pal.dark,
        d.pal.darkShade,
        d.pal.ink,
        0.5,
        0.9 * d.k,
        0.4,
      );
    },
    front: (d) => antennae(d, 5.4, 0.2, 1.4),
  },
  frog: {
    size: (v) => [1.2 + v[0] * 0.08, 0.82],
    shape: (W, H) => sup(W, H, 2.1, 0.84, 1.08, 0.12),
    feet: 'web',
    arms: 'paw',
    face: (c) => ({
      eyes: { count: 2, y: 0.86, spread: 0.28, size: Math.max(2.4, c.eyes.size), style: c.eyes.style === 'visor' ? 'ring' : c.eyes.style },
      mouth: 'flat',
    }),
    pal: (c) => ({ foot: css(c.body, 4), footShade: css(c.body, -14, 1, 8), hand: css(c.body, 4), handShade: css(c.body, -14, 1, 8) }),
    print: (d) => {
      poly(d.s, oval(0, d.by + 1.5, d.W * 0.44, d.H * 0.36, 14), d.pal.light);
      if (d.v[1] < 0.4) scatter(d, 4, 1.5, d.pal.dark, 31, 0.5, 0.95);
      else if (d.v[1] < 0.7)
        mark(
          d.s,
          d.pal.light,
          [
            { x: -d.W * 0.6, y: Y(d, 0.62) },
            { x: 0, y: Y(d, 0.56) },
            { x: d.W * 0.6, y: Y(d, 0.62) },
          ],
          1.6,
          d.sd,
        );
    },
    front: (d) => {
      const ey = d.by - d.H * 0.86;
      for (const side of [-1, 1]) tonedOval(d.s, side * d.W * 0.28 + d.f * 0.8, ey, 3.8, 3.4, 12, d.pal.base, d.pal.shade, d.pal.ink, 0.6, 1.1 * d.k, 0.6);
    },
    snout: (d) => {
      // The wide frog mouth, ear to ear.
      const y = mouthY(d) - 1;
      mark(
        d.s,
        d.pal.ink,
        [
          { x: -d.W * 0.36, y: y - 0.8 },
          { x: 0, y: y + 0.8 },
          { x: d.W * 0.36, y: y - 0.8 },
        ],
        1.3,
        d.sd,
        [0.15, 0.15],
      );
    },
  },
  cat: {
    shape: (W, H) => sup(W, H, 2.7, 0.96, 1.02),
    feet: 'paw',
    arms: 'paw',
    rope: catTail,
    pal: (c, v) => {
      const sock = v[1] > 0.33;
      return {
        dark: css(c.body, -22, 1, 6),
        foot: sock ? CREAM : css(c.body, -6),
        footShade: sock ? CREAM_SH : css(c.body, -22),
        hand: sock ? CREAM : css(c.body),
        handShade: sock ? CREAM_SH : css(c.body, -20, 1, 8),
      };
    },
    print: (d) => {
      if (d.v[1] < 0.33) sideStripes(d, 3, 0.32, 1.9, d.pal.dark, 12);
      else poly(d.s, oval(0, d.by + 0.5, d.W * 0.3, d.H * 0.3, 12), CREAM);
    },
    front: (d) => {
      for (const side of [-1, 1]) ear(d, side * d.W * 0.3, 5.8, 5.6, side * 0.7, d.pal.base, d.pal.shade, PINK);
      muzzle(d, CREAM, 0.3, 0.14, CREAM_SH);
    },
    snout: (d) => {
      const x = mouthX(d);
      const y = mouthY(d) - 1.2;
      poly(d.s, oval(x, y - 1.3, 0.9, 0.6, 6), PINK_SH);
      d.s.fillStyle = d.pal.ink;
      for (const side of [-1, 1])
        for (const dy of [-0.6, 0.7]) line(d.s, x + side * 2.6, y + dy, x + side * 6, y + dy * 1.8, { w: 0.6, seed: dy * 10, taper: [0.1, 0.6], press: 0 });
    },
  },
  bunny: {
    shape: (W, H) => sup(W, H, 2.3, 0.9, 1.06, 0.1),
    feet: 'paw',
    arms: 'paw',
    face: () => ({ mouth: 'teeth' }),
    pal: () => ({ foot: CREAM, footShade: CREAM_SH, hand: CREAM, handShade: CREAM_SH }),
    print: (d) => poly(d.s, oval(0, d.by + 0.5, d.W * 0.32, d.H * 0.32, 12), CREAM),
    back: (d) => tonedOval(d.s, -d.f * d.W * 0.52, Y(d, 0.18), 2.6, 2.4, 9, CREAM, CREAM_SH, d.pal.ink, 0.5, 0.9 * d.k, 0.5),
    front: (d) => {
      // Long ears: the silhouette. One may flop.
      const flop = d.v[2] > 0.55;
      for (const side of [-1, 1]) {
        const x = side * d.W * 0.2;
        const tilt = side * 0.12 + (flop && side === d.f ? 1.25 : 0) - d.wob * 0.03;
        const cx = x + Math.sin(tilt) * 4.2;
        const cy = d.top - Math.cos(tilt) * 4.2 + 0.6;
        toned(d.s, oval(cx, cy, 2.1, 5.4, 12, tilt), d.pal.base, d.pal.shade, d.pal.ink, 0.6, 1.05 * d.k, 0.6);
        poly(d.s, oval(cx, cy + 0.6 * Math.cos(tilt), 0.9, 3.6, 8, tilt), PINK);
      }
    },
  },
  owl: {
    size: () => [1.04, 1.04],
    shape: (W, H) => {
      // Ear tufts are in the outline: the owl's head line is its read.
      const p = sup(W, H, 2.8, 1, 1.02);
      return p.map((q) => (q.y < -H * 0.9 && Math.abs(q.x) > W * 0.22 ? { x: q.x * 1.05, y: q.y - 3.2 * (Math.abs(q.x) / (W / 2)) } : q));
    },
    feet: 'web',
    arms: 'flipper',
    face: (c) => ({ eyes: { count: 2, style: 'ring', size: Math.max(2.4, c.eyes.size), spread: 0.25, y: 0.64 }, mouth: 'none' }),
    pal: (c) => ({ foot: ORANGE, footShade: ORANGE_SH, hand: css(c.body, -6), handShade: css(c.body, -22, 1, 8) }),
    print: (d) => {
      // The facial disc, two pale rings, and chevrons down the chest.
      const ey = d.by - d.H * 0.64;
      for (const side of [-1, 1]) poly(d.s, oval(side * d.W * 0.25 + d.f * 0.5, ey, 4, 3.9, 12), d.pal.light);
      for (let r = 0; r < 2; r++)
        for (const x of [-2.6, 0, 2.6])
          mark(
            d.s,
            d.pal.dark,
            [
              { x: x - 1, y: Y(d, 0.22 - r * 0.12) },
              { x, y: Y(d, 0.18 - r * 0.12) },
              { x: x + 1, y: Y(d, 0.22 - r * 0.12) },
            ],
            0.9,
            d.sd + x + r,
          );
    },
    snout: (d) => beak(d, 1.6, 1.4),
  },
  duck: {
    shape: (W, H) => sup(W, H, 2.2, 0.92, 1.08, 0.12),
    feet: 'web',
    arms: 'flipper',
    face: () => ({ mouth: 'none' }),
    pal: (c) => ({ foot: ORANGE, footShade: ORANGE_SH, hand: css(c.body, -4), handShade: css(c.body, -20, 1, 8) }),
    print: (d) => poly(d.s, oval(0, d.by + 1, d.W * 0.4, d.H * 0.28, 12), d.pal.light),
    back: (d) => {
      // A tail flick.
      const x = -d.f * d.W * 0.46;
      toned(
        d.s,
        [
          { x, y: Y(d, 0.42) },
          { x: x - d.f * 3.4, y: Y(d, 0.6) },
          { x, y: Y(d, 0.18) },
        ],
        d.pal.base,
        d.pal.shade,
        d.pal.ink,
        0.6,
        1 * d.k,
        0.6,
      );
    },
    front: (d) => {
      // Crest curl.
      mark(
        d.s,
        d.pal.ink,
        [
          { x: 0, y: d.top + 1.6 },
          { x: d.wob * 0.4 - d.f, y: d.top - 2.6 },
          { x: -d.f * 2.4, y: d.top - 3.4 },
        ],
        2.2 * d.k,
        d.sd,
        [0, 0.5],
      );
      mark(
        d.s,
        d.pal.base,
        [
          { x: 0, y: d.top + 1.6 },
          { x: d.wob * 0.4 - d.f, y: d.top - 2.3 },
          { x: -d.f * 2, y: d.top - 2.9 },
        ],
        1,
        d.sd,
        [0, 0.5],
      );
    },
    snout: (d) => beak(d, 6.4, 1.6, ORANGE, ORANGE_SH, true),
  },
  fox: {
    shape: (W, H) => sup(W, H, 2.4, 0.86, 1.04),
    feet: 'paw',
    arms: 'paw',
    rope: bushy,
    pal: (c) => ({
      dark: css({ h: c.body.h, s: 30, l: 14 }),
      foot: css({ h: c.body.h, s: 30, l: 16 }),
      footShade: '#100c0a',
      hand: css({ h: c.body.h, s: 30, l: 16 }),
      handShade: '#100c0a',
    }),
    print: (d) => {
      // A pale cheek-and-chest blaze cut to a point.
      const ey = d.by - d.H * d.c.eyes.y;
      poly(
        d.s,
        [
          { x: -d.W * 0.6, y: ey + 0.6 },
          { x: -d.W * 0.12, y: ey + 2.4 },
          { x: d.f * 1.2, y: ey + 0.2 },
          { x: d.W * 0.12, y: ey + 2.4 },
          { x: d.W * 0.6, y: ey + 0.6 },
          { x: d.W * 0.3, y: d.by + 1 },
          { x: -d.W * 0.3, y: d.by + 1 },
        ],
        CREAM,
      );
    },
    front: (d) => {
      for (const side of [-1, 1]) {
        ear(d, side * d.W * 0.27, 6, 6.6, side * 0.5, d.pal.base, d.pal.shade, d.pal.dark);
      }
    },
    snout: (d) => poly(d.s, oval(mouthX(d) + d.f * 0.6, mouthY(d) - 2.2, 1.2, 0.9, 7), d.pal.ink),
  },
  hedgehog: {
    size: () => [1.08, 0.92],
    shape: (W, H) => sup(W, H, 2.2, 0.9, 1.06, 0.08),
    feet: 'paw',
    arms: 'paw',
    pal: (c) => ({ dark: css(c.body, -26, 1, 8), foot: css({ h: 25, s: 30, l: 30 }), footShade: '#2a1a12', hand: CREAM, handShade: CREAM_SH }),
    back: (d) => {
      // Spines fan over the back and crown: the hedgehog's outline is all spikes.
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI * 0.92 + (i / (n - 1)) * Math.PI * 0.9;
        const aa = d.f > 0 ? a : -Math.PI - a;
        const r0 = d.W * 0.42;
        const cx = -d.f * 1;
        const cy = Y(d, 0.5);
        const bx = cx + Math.cos(aa) * r0;
        const by = cy + Math.sin(aa) * d.H * 0.46;
        const len = 3.6 + hash2(d.sd, i, 3) * 1.2;
        const tx = bx + Math.cos(aa - d.f * 0.35) * len;
        const ty = by + Math.sin(aa - d.f * 0.35) * len;
        const px = -Math.sin(aa) * 1.8;
        const py = Math.cos(aa) * 1.8;
        toned(
          d.s,
          [
            { x: bx + px, y: by + py },
            { x: tx, y: ty },
            { x: bx - px, y: by - py },
          ],
          d.pal.dark,
          d.pal.darkShade,
          d.pal.ink,
          0.5,
          0.9 * d.k,
          0.4,
        );
      }
    },
    print: (d) => {
      // The face and belly are bare: a pale mask on the facing side.
      poly(d.s, oval(d.f * d.W * 0.18, Y(d, 0.4), d.W * 0.42, d.H * 0.44, 14), CREAM);
    },
    snout: (d) => poly(d.s, oval(mouthX(d) + d.f * 2.2, mouthY(d) - 2.4, 1.3, 1, 7), d.pal.ink),
  },
  penguin: {
    size: () => [0.98, 1.08],
    shape: (W, H) => sup(W, H, 2.2, 0.84, 1.06, 0.1),
    feet: 'web',
    arms: 'flipper',
    face: () => ({ mouth: 'none' }),
    pal: (c) => ({ foot: ORANGE, footShade: ORANGE_SH, hand: css(c.body, -6), handShade: css(c.body, -22, 1, 8) }),
    print: (d) => {
      // The white front, from under the eyes to the feet.
      const ey = d.by - d.H * d.c.eyes.y;
      poly(
        d.s,
        [
          { x: -d.W * 0.34, y: ey - 2.4 },
          { x: d.f * 0.6, y: ey + 1.2 },
          { x: d.W * 0.34, y: ey - 2.4 },
          { x: d.W * 0.44, y: d.by - 2 },
          { x: d.W * 0.26, y: d.by + 1 },
          { x: -d.W * 0.26, y: d.by + 1 },
          { x: -d.W * 0.44, y: d.by - 2 },
        ],
        CREAM,
      );
      if (d.v[1] > 0.6) poly(d.s, oval(0, ey + 4, 2.4, 1, 8), '#f2c94c');
    },
    snout: (d) => beak(d, 2.6, 1.1),
  },
  snail: {
    size: () => [1.12, 0.84],
    shape: (W, H) => sup(W, H, 2.6, 0.82, 1.06),
    feet: 'none',
    hop: false,
    arms: 'none',
    pal: (c, v) => {
      const h = c.body.h + 30 + v[1] * 40;
      return { acc: css(hsl3(h, 45, 70)), accShade: css(hsl3(h, 45, 52)) };
    },
    back: (d) => {
      // The shell on the back: a big spiral, the snail's one shape.
      const cx = -d.f * d.W * 0.24;
      const cy = Y(d, 0.66);
      tonedOval(d.s, cx, cy, 6.4, 6, 18, d.pal.acc, d.pal.accShade, d.pal.ink, 0.8, 1.4 * d.k, 0.9);
      const sp = spiral(cx, cy, 5, 1.6).map((p) => ({ x: cx + (p.x - cx) * -d.f, y: p.y }));
      d.s.fillStyle = d.pal.ink;
      for (let i = 1; i < sp.length; i++) line(d.s, sp[i - 1].x, sp[i - 1].y, sp[i].x, sp[i].y, { w: 1.1, seed: i, taper: [0, 0], press: 0 });
    },
    front: (d) => {
      for (const side of [0.2, 1]) {
        const x0 = d.f * d.W * (0.18 + side * 0.12);
        stalk(d, x0, d.top + 3, x0 + d.f * 1.4 + d.wob * 0.4, d.top - 4.2 - side, 1.3, d.pal.base, d.pal.shade);
      }
    },
  },
  crab: {
    size: () => [1.24, 0.8],
    shape: (W, H) => sup(W, H, 2.3, 0.92, 1, 0.06),
    feet: 'none',
    hop: false,
    arms: 'claw',
    face: (c) => ({ eyes: { count: 2, y: 0.98, spread: 0.2, size: Math.min(2.1, c.eyes.size), style: c.eyes.style === 'visor' ? 'dot' : c.eyes.style } }),
    pal: (c) => ({ hand: css(c.body, 4), handShade: css(c.body, -16, 1, 8) }),
    back: (d) => {
      // Three legs a side, scuttling.
      d.s.fillStyle = d.pal.ink;
      for (const side of [-1, 1])
        for (let i = 0; i < 3; i++) {
          const ph = d.ph * 1.3 + i * 2.1 + (side > 0 ? 1 : 0);
          const lift = d.m === 'walk' || d.m === 'run' ? Math.max(0, Math.sin(ph)) * 1.4 : 0;
          const x0 = side * d.W * (0.24 + i * 0.1);
          d.s.fillStyle = d.pal.ink;
          const pts = [
            { x: x0, y: d.by - 2.4 },
            { x: x0 + side * 3.6, y: d.by - 2.6 - lift },
            { x: x0 + side * 4.4, y: -0.3 - lift * 0.5 },
          ];
          for (let j = 1; j < 3; j++)
            line(d.s, pts[j - 1].x, pts[j - 1].y, pts[j].x, pts[j].y, { w: 1.5 * d.k, seed: i + j, taper: [0, j === 2 ? 0.6 : 0], press: 0 });
        }
    },
    front: (d) => {
      // Eyes on stalks.
      for (const side of [-1, 1]) {
        const x = side * d.W * 0.2 + d.f * 0.8;
        d.s.fillStyle = d.pal.ink;
        line(d.s, x, d.top + 2, x + d.wob * 0.2, d.top - 2.4, { w: 1.6 * d.k, seed: side, taper: [0, 0], press: 0 });
      }
    },
  },
  axolotl: {
    size: () => [1.14, 0.9],
    shape: (W, H) => sup(W, H, 2.2, 1, 1.02, 0.06),
    feet: 'paw',
    arms: 'paw',
    rope: lizardTail,
    face: (c) => ({ eyes: { style: 'dot', count: 2, spread: 0.3, size: Math.min(2.2, c.eyes.size) }, mouth: 'smile' }),
    pal: (c, v) => {
      const gill = v[1] < 0.5 ? hsl3(345, 85, 62) : hsl3(c.body.h + 160, 75, 60);
      return {
        acc: css(gill),
        accShade: css(gill, -16, 1, 4),
        hand: css(c.body, 6),
        handShade: css(c.body, -14, 1, 8),
        foot: css(c.body, 6),
        footShade: css(c.body, -14, 1, 8),
      };
    },
    print: (d) => scatter(d, 5, 0.8, d.pal.light, 71, 0.6, 0.95),
    front: (d) => {
      // Three frilled gills a side: the axolotl's crown.
      for (const side of [-1, 1])
        for (let i = 0; i < 3; i++) {
          const a = side * (0.5 + i * 0.45) - Math.PI / 2 + Math.sin(d.t * 4 + i) * 0.08;
          const x0 = side * d.W * 0.44;
          const y0 = Y(d, 0.72 - i * 0.08);
          const len = 4.4 - Math.abs(i - 1) * 0.6;
          const tip = { x: x0 + Math.cos(a) * len, y: y0 + Math.sin(a) * len };
          toned(
            d.s,
            [
              { x: x0 - Math.sin(a) * 1.1, y: y0 + Math.cos(a) * 1.1 },
              { x: tip.x - Math.sin(a) * 0.9, y: tip.y + Math.cos(a) * 0.9 },
              { x: tip.x + Math.cos(a) * 0.8, y: tip.y + Math.sin(a) * 0.8 },
              { x: tip.x + Math.sin(a) * 0.9, y: tip.y - Math.cos(a) * 0.9 },
              { x: x0 + Math.sin(a) * 1.1, y: y0 - Math.cos(a) * 1.1 },
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
  pig: {
    shape: (W, H) => sup(W, H, 2.3, 0.94, 1.06, 0.1),
    feet: 'paw',
    arms: 'paw',
    face: () => ({ mouth: 'smile' }),
    pal: (c) => ({
      dark: css(c.body, -20, 1, 6),
      foot: css({ h: c.body.h, s: 30, l: 22 }),
      footShade: '#1a120e',
      hand: css(c.body, 4),
      handShade: css(c.body, -16, 1, 8),
    }),
    print: (d) => {
      if (d.v[1] > 0.6) spot(d.s, -d.f * d.W * 0.3, Y(d, 0.3), d.W * 0.26, d.H * 0.2, d.sd, d.pal.dark, 0.3);
    },
    back: (d) => {
      // A curly tail.
      const x = -d.f * d.W * 0.5;
      const sp = spiral(x - d.f * 1.6, Y(d, 0.4), 1.8, 1.4, 12).map((p) => ({ x: p.x, y: p.y }));
      mark(d.s, d.pal.ink, [{ x, y: Y(d, 0.36) }, ...sp], 2 * d.k, d.sd, [0, 0.3]);
      mark(d.s, d.pal.base, [{ x, y: Y(d, 0.36) }, ...sp], 0.9, d.sd, [0, 0.3]);
    },
    front: (d) => {
      // Ears that fold forward.
      for (const side of [-1, 1])
        toned(
          d.s,
          [
            { x: side * d.W * 0.14, y: d.top + 2.4 },
            { x: side * d.W * 0.5, y: d.top - 2.8 },
            { x: side * d.W * 0.5 + d.f * 1.8, y: d.top + 1.6 },
          ],
          d.pal.base,
          d.pal.shade,
          d.pal.ink,
          0.6,
          1 * d.k,
          0.6,
        );
    },
    snout: (d) => {
      const x = mouthX(d) + d.f * 1.2;
      const y = mouthY(d) - 3;
      tonedOval(d.s, x, y, 2.8, 2, 12, css(d.c.body, 12, 1, -10), css(d.c.body, -6, 1, -4), d.pal.ink, 0.5, 0.9 * d.k, 0.5);
      for (const dx of [-0.9, 0.9]) poly(d.s, oval(x + dx, y + 0.1, 0.45, 0.7, 6), d.pal.ink);
    },
  },
  bear: {
    size: () => [1.06, 1],
    shape: (W, H) => sup(W, H, 2.5, 0.96, 1.04, 0.08),
    feet: 'paw',
    arms: 'paw',
    pal: (c) => ({ foot: css(c.body, -8), footShade: css(c.body, -24, 1, 8), hand: css(c.body, -2), handShade: css(c.body, -20, 1, 8) }),
    print: (d) => {
      if (d.v[1] > 0.5) poly(d.s, oval(0, Y(d, 0.32), 2.8, 1.4, 10), CREAM);
    },
    front: (d) => {
      for (const side of [-1, 1]) {
        tonedOval(d.s, side * d.W * 0.36, d.top + 1, 3, 2.9, 11, d.pal.base, d.pal.shade, d.pal.ink, 0.6, 1.05 * d.k, 0.6);
        poly(d.s, oval(side * d.W * 0.36, d.top + 1.4, 1.5, 1.4, 8), d.pal.dark);
      }
      muzzle(d, CREAM, 0.3, 0.17, CREAM_SH);
    },
    snout: (d) => poly(d.s, oval(mouthX(d) + d.f * 0.3, mouthY(d) - 2.4, 1.4, 1, 8), d.pal.ink),
  },
};

export { airborne, dome };
