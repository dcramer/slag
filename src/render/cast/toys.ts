import { css, hsl3 } from '../../core/color';
import { hash2 } from '../../core/rng';
import type { Toy } from '../../gen/cast';
import { glowDot } from '../kit';
import { type Art, type D, dome, line, mark, oval, poly, spot, stalk, sup, toned, tonedOval } from './draw';
import { mouthX, mouthY, Y } from './kit';

/**
 * Direction C: the foundry's toy line. SLAG melts junk down and recasts it, so the runners are what
 * comes out of the moulds: painted tin wind-ups and cast-iron novelties in the player's livery, with a
 * brass key turning in the back, rivets, a mould seam and paint chipped back to the iron, plus two
 * critters that crawled out of the slag itself and still glow in the cracks (the only hot things, so
 * the only glow). Every runner is a *thing*, which is the joke: a piggy bank racing a kettle.
 */

const IRON = '#4b403a';
const IRON_SH = '#2f2723';
const BRASS = '#e7ad3c';
const BRASS_SH = '#a8741c';
const TIN = '#d9d3c7';
const TIN_SH = '#a39b8e';
const HOT = hsl3(30, 100, 58);
const HOT_CSS = '#ffb02e';
const WHITE_HOT = '#fff1b8';

/** Two or three chips knocked out of the paint near the edges, down to the iron. */
function chips(d: D, n = 2) {
  for (let i = 0; i < n; i++) {
    const side = hash2(d.sd, i, 91) < 0.5 ? -1 : 1;
    const u = 0.12 + hash2(d.sd, i, 92) * 0.7;
    spot(d.s, side * d.W * 0.47, Y(d, u), 1.3, 0.9, d.sd + i * 5, IRON, 0.35, hash2(d.sd, i, 93) * 3);
  }
}

function rivet(d: D, x: number, y: number) {
  poly(d.s, oval(x, y, 0.75, 0.75, 6), IRON_SH);
  poly(d.s, oval(x - 0.2, y - 0.2, 0.35, 0.35, 5), TIN);
}

/** The mould's parting line, down the body's middle. */
function seam(d: D) {
  mark(
    d.s,
    d.pal.darkShade,
    [
      { x: 0.3, y: d.top - 1 },
      { x: 0, y: Y(d, 0.5) },
      { x: 0.3, y: d.by + 1 },
    ],
    0.7,
    d.sd,
    [0, 0],
  );
}

/**
 * The wind-up key in the back, turning: its bow foreshortens as it spins, faster when the toy runs.
 * Moving toys wind down; standing ones tick round slowly.
 */
function key(d: D, u = 0.52) {
  const speed = d.m === 'run' ? 14 : d.m === 'walk' ? 7 : d.m === 'idle' ? 1.2 : 9;
  const a = d.t * speed + d.sd;
  const x0 = -d.f * d.W * 0.46;
  const y0 = Y(d, u);
  const x1 = x0 - d.f * 3.4;
  d.s.fillStyle = d.pal.ink;
  line(d.s, x0 + d.f, y0, x1, y0, { w: 2.2 * d.k, seed: 1, taper: [0, 0], press: 0 });
  d.s.fillStyle = BRASS;
  line(d.s, x0 + d.f, y0 - 0.2, x1, y0 - 0.2, { w: 1, seed: 1, taper: [0, 0], press: 0 });
  // The bow: a flat butterfly of brass, edge-on as it turns, with a hole in each wing.
  const w = Math.max(0.7, Math.abs(Math.cos(a)) * 2.6);
  const cx = x1 - d.f * w * 0.55;
  const bow = [
    { x: cx, y: y0 },
    { x: cx - w, y: y0 - 2.4 },
    { x: cx - w * 0.6, y: y0 - 4.6 },
    { x: cx + w * 0.6, y: y0 - 4.6 },
    { x: cx + w, y: y0 - 2.4 },
    { x: cx, y: y0 },
    { x: cx + w, y: y0 + 2.4 },
    { x: cx + w * 0.6, y: y0 + 4.6 },
    { x: cx - w * 0.6, y: y0 + 4.6 },
    { x: cx - w, y: y0 + 2.4 },
  ];
  toned(d.s, bow, BRASS, BRASS_SH, d.pal.ink, 0.6, 1.05 * d.k, 0.5);
  if (w > 1.2) for (const sy of [-1, 1]) poly(d.s, oval(cx, y0 + sy * 2.6, w * 0.32, 0.9, 6), d.pal.ink);
}

/** A molten crack across the body, live on the emissive layer. */
function crack(d: D, pts: { x: number; y: number }[], seed: number) {
  mark(d.s, '#3a1a0c', pts, 1.9, seed, [0.1, 0.4]);
  mark(d.s, HOT_CSS, pts, 1, seed, [0.1, 0.4]);
  if (d.g) {
    const m = pts[pts.length >> 1];
    glowDot(d.g, d.wx + m.x * d.sc, d.wy + m.y * d.sc, 6 * d.sc, HOT, 0.28 + 0.06 * Math.sin(d.t * 3 + seed));
  }
}

const pegs = { foot: IRON, footShade: IRON_SH };

export const TOY_ART: Record<Toy, Art> = {
  robot: {
    shape: (W, H) => sup(W, H, 5, 0.96, 1),
    feet: 'peg',
    face: () => ({ eyes: { style: 'ring', count: 2 }, mouth: 'none' }),
    pal: () => ({ ...pegs, hand: TIN, handShade: TIN_SH }),
    print: (d) => {
      // A tin chest plate with a dial.
      poly(d.s, oval(d.f * 0.6, Y(d, 0.2), d.W * 0.3, d.H * 0.13, 10), TIN);
      mark(
        d.s,
        d.pal.ink,
        [
          { x: d.f * 0.6, y: Y(d, 0.2) },
          { x: d.f * 0.6 + 1.6 * Math.cos(d.t * 2), y: Y(d, 0.2) - 1.2 },
        ],
        0.8,
        d.sd,
        [0, 0.5],
      );
      chips(d);
    },
    over: (d) => {
      for (const x of [-1, 1]) for (const u of [0.1, 0.88]) rivet(d, x * d.W * 0.38, Y(d, u));
    },
    back: (d) => key(d),
    front: (d) => stalk(d, 0, d.top + 1, d.wob * 0.5, d.top - 5, 1.5, BRASS, BRASS_SH),
    snout: (d) => {
      // A grille for a mouth.
      const x = mouthX(d);
      const y = mouthY(d) - 0.6;
      inkBox(d, x - 3, y - 1.4, 6, 2.6, IRON);
      d.s.fillStyle = TIN;
      for (let i = -1; i <= 1; i++) d.s.fillRect(x + i * 1.8 - 0.35, y - 1, 0.7, 1.8);
    },
  },
  piggybank: {
    size: () => [1.12, 0.94],
    shape: (W, H) => sup(W, H, 2.2, 0.94, 1.04, 0.08),
    feet: 'peg',
    arms: 'none',
    pal: () => pegs,
    print: (d) => {
      // Painted flowers on the flank, chipped.
      for (let i = 0; i < 2; i++) {
        const x = -d.f * d.W * (0.24 + i * 0.12);
        const y = Y(d, 0.3 + i * 0.2);
        for (let j = 0; j < 5; j++) poly(d.s, oval(x + Math.cos(j * 1.26) * 1.1, y + Math.sin(j * 1.26) * 1.1, 0.8, 0.8, 6), TIN);
        poly(d.s, oval(x, y, 0.6, 0.6, 6), BRASS);
      }
      chips(d, 3);
    },
    over: (d) => seam(d),
    back: (d) => key(d, 0.45),
    front: (d) => {
      // The coin slot on top, with a coin stuck in it.
      inkBox(d, -2.6, d.top + 0.4, 5.2, 1.4, IRON_SH);
      const bob = d.m === 'run' ? Math.abs(Math.sin(d.ph)) * 0.8 : 0;
      tonedOval(d.s, 0.4, d.top - 1.4 - bob, 2.4, 2.4, 10, BRASS, BRASS_SH, d.pal.ink, 0.5, 0.9 * d.k, 0.5);
      for (const side of [-1, 1])
        toned(
          d.s,
          [
            { x: side * d.W * 0.2, y: d.top + 2.2 },
            { x: side * d.W * 0.42, y: d.top - 2.2 },
            { x: side * d.W * 0.46, y: d.top + 2.6 },
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
      const x = mouthX(d) + d.f * 2.6;
      const y = mouthY(d) - 2.6;
      tonedOval(d.s, x, y, 2, 2.3, 10, d.pal.base, d.pal.shade, d.pal.ink, 0.5, 0.9 * d.k, 0.5);
      for (const dy of [-0.8, 0.8]) poly(d.s, oval(x + d.f * 0.3, y + dy, 0.5, 0.45, 6), d.pal.ink);
    },
  },
  tincan: {
    size: () => [0.96, 1.08],
    shape: (W, H) => sup(W, H, 7, 1, 1),
    feet: 'peg',
    pal: () => ({ ...pegs, hand: TIN, handShade: TIN_SH }),
    print: (d) => {
      // Bare tin rims top and bottom, ridges, and a printed label in the livery.
      for (const [u0, u1] of [
        [0.86, 1.1],
        [-0.1, 0.12],
      ])
        poly(
          d.s,
          [
            { x: -d.W, y: Y(d, u1) },
            { x: d.W, y: Y(d, u1) },
            { x: d.W, y: Y(d, u0) },
            { x: -d.W, y: Y(d, u0) },
          ],
          TIN,
        );
      for (const u of [0.92, 0.06])
        mark(
          d.s,
          TIN_SH,
          [
            { x: -d.W, y: Y(d, u) },
            { x: d.W, y: Y(d, u) },
          ],
          0.7,
          d.sd + u,
          [0, 0],
        );
      // A stamped star on the label.
      const sx = -d.f * d.W * 0.26;
      const sy = Y(d, 0.28);
      const star = Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
        const r = i % 2 ? 0.9 : 2.1;
        return { x: sx + Math.cos(a) * r, y: sy + Math.sin(a) * r };
      });
      poly(d.s, star, d.pal.light);
      chips(d);
    },
    back: (d) => key(d, 0.5),
    front: (d) => {
      // The pull ring.
      poly(d.s, oval(d.f * 1.2 + d.wob * 0.3, d.top - 1.6, 2.4, 1.4, 12), d.pal.ink);
      poly(d.s, oval(d.f * 1.2 + d.wob * 0.3, d.top - 1.6, 1.6, 0.8, 10), TIN);
      poly(d.s, oval(d.f * 1.2 + d.wob * 0.3, d.top - 1.6, 1, 0.35, 8), d.pal.base);
    },
  },
  kettle: {
    size: () => [1.1, 0.96],
    shape: (W, H) => dome(W, H, 2.4, 1.08),
    feet: 'peg',
    arms: 'none',
    face: () => ({ eyes: { y: 0.46 } }),
    pal: () => pegs,
    print: (d) => {
      mark(
        d.s,
        TIN,
        [
          { x: -d.W, y: Y(d, 0.18) },
          { x: d.W, y: Y(d, 0.16) },
        ],
        1.6,
        d.sd,
        [0, 0],
      );
      chips(d);
    },
    back: (d) => {
      key(d, 0.36);
      // The handle arcs over the back.
      const pts = Array.from({ length: 8 }, (_, i) => {
        const a = Math.PI + (i / 7) * Math.PI;
        return { x: -d.f * 1 + Math.cos(a) * d.W * 0.36, y: d.top + 3 + Math.sin(a) * 4.6 };
      });
      mark(d.s, d.pal.ink, pts, 2.4 * d.k, d.sd, [0, 0]);
      mark(d.s, IRON, pts, 1.1, d.sd, [0, 0]);
    },
    front: (d) => {
      // Lid knob, and the spout out front.
      tonedOval(d.s, 0, d.top + 0.2, 1.7, 1.4, 8, IRON, IRON_SH, d.pal.ink, 0.5, 0.9 * d.k, 0.5);
      const x = d.f * d.W * 0.48;
      const y = Y(d, 0.32);
      toned(
        d.s,
        [
          { x: x - d.f * 1.6, y: y - 1.8 },
          { x: x + d.f * 3.4, y: y - 4.6 },
          { x: x + d.f * 4.4, y: y - 4 },
          { x: x + d.f * 1.6, y: y + 2.2 },
          { x: x - d.f * 1.6, y: y + 2.4 },
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
  bell: {
    size: () => [1.12, 1],
    shape: (W, H) => {
      // A cast bell: shoulder, waist, flared lip.
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI + (i / 10) * Math.PI;
        pts.push({ x: Math.cos(a) * W * 0.32, y: -H + 4 + Math.sin(a) * 4 });
      }
      pts.push({ x: W * 0.36, y: -H * 0.55 }, { x: W * 0.44, y: -H * 0.2 }, { x: W * 0.56, y: -1.2 }, { x: W * 0.5, y: 0 });
      pts.push({ x: -W * 0.5, y: 0 }, { x: -W * 0.56, y: -1.2 }, { x: -W * 0.44, y: -H * 0.2 }, { x: -W * 0.36, y: -H * 0.55 });
      return pts;
    },
    feet: 'none',
    face: () => ({ eyes: { y: 0.56, spread: 0.2 }, mouth: 'o' }),
    pal: () => ({ hand: BRASS, handShade: BRASS_SH }),
    print: (d) => {
      // A bronze lip band and a cast ring round the waist.
      poly(
        d.s,
        [
          { x: -d.W, y: Y(d, 0.14) },
          { x: d.W, y: Y(d, 0.14) },
          { x: d.W, y: d.by + 2 },
          { x: -d.W, y: d.by + 2 },
        ],
        BRASS,
      );
      mark(
        d.s,
        d.pal.darkShade,
        [
          { x: -d.W, y: Y(d, 0.3) },
          { x: d.W, y: Y(d, 0.3) },
        ],
        0.8,
        d.sd,
        [0, 0],
      );
      chips(d);
    },
    back: (d) => {
      // The clapper swings under the lip, behind the motion.
      const sw = Math.sin(d.t * 9) * 1.2 - d.f * Math.min(2, Math.abs(d.p.vx) / 80);
      tonedOval(d.s, sw, d.by + 0.6, 1.8, 1.8, 9, IRON, IRON_SH, d.pal.ink, 0.5, 0.9 * d.k, 0.5);
    },
    front: (d) => {
      // The hanging loop on the crown.
      const r = oval(0, d.top - 1.4, 2.2, 2, 12);
      inkLoop(d, r, IRON);
    },
  },
  crucible: {
    shape: (W, H) => {
      // A tapered pot, wider at the mouth.
      const pts = [
        { x: -W * 0.56, y: -H },
        { x: W * 0.56, y: -H },
        { x: W * 0.52, y: -H * 0.9 },
        { x: W * 0.42, y: -H * 0.25 },
        { x: W * 0.32, y: 0 },
        { x: -W * 0.32, y: 0 },
        { x: -W * 0.42, y: -H * 0.25 },
        { x: -W * 0.52, y: -H * 0.9 },
      ];
      return pts;
    },
    feet: 'peg',
    face: () => ({ eyes: { y: 0.5 } }),
    pal: () => ({ ...pegs, hand: IRON, handShade: IRON_SH }),
    print: (d) => {
      // Iron rim, a drip of metal down the side.
      poly(
        d.s,
        [
          { x: -d.W, y: d.top - 1 },
          { x: d.W, y: d.top - 1 },
          { x: d.W, y: Y(d, 0.88) },
          { x: -d.W, y: Y(d, 0.88) },
        ],
        IRON,
      );
      const x = -d.f * d.W * 0.36;
      mark(
        d.s,
        HOT_CSS,
        [
          { x, y: Y(d, 0.9) },
          { x: x + 0.2, y: Y(d, 0.72) },
          { x: x - 0.1, y: Y(d, 0.66) },
        ],
        1.5,
        d.sd,
        [0, 0.2],
      );
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
      if (d.g) glowDot(d.g, d.wx, d.wy + d.top * d.sc, 10 * d.sc, HOT, 0.4);
      // A long handle off the back.
      const x0 = -d.f * d.W * 0.5;
      mark(
        d.s,
        d.pal.ink,
        [
          { x: x0, y: Y(d, 0.8) },
          { x: x0 - d.f * 4.4, y: Y(d, 0.92) },
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
          { x: x0 - d.f * 4.2, y: Y(d, 0.92) },
        ],
        1.2,
        d.sd,
        [0, 0.1],
      );
    },
  },
  slagblob: {
    size: (v) => [1.06 + v[0] * 0.06, 0.94],
    shape: (W, H, v) => {
      // Lumpy, cooled in a heap.
      const p = sup(W, H, 2.1, 0.86, 1.08, 0.14, 30);
      return p.map((q, i) => {
        const k = 1 + (hash2(Math.floor(v[2] * 1e6), i, 5) - 0.5) * 0.12;
        return { x: q.x * k, y: q.y < -1 ? q.y * (1 + (k - 1) * 0.5) : q.y };
      });
    },
    feet: 'none',
    face: (c) => ({ eyes: { style: c.eyes.style === 'visor' ? 'dot' : c.eyes.style, glow: true } }),
    pal: (c) => ({ dark: css(c.body, -24, 1, 6) }),
    print: (d) => {
      // Crust plates, then the cracks between them.
      for (let i = 0; i < 4; i++) spot(d.s, (hash2(d.sd, i, 1) - 0.5) * d.W, Y(d, 0.15 + hash2(d.sd, i, 2) * 0.75), 2.4, 1.8, d.sd + i, d.pal.dark, 0.35);
    },
    over: (d) => {
      const x = -d.f * d.W * 0.3;
      crack(
        d,
        [
          { x: x - 2, y: Y(d, 0.85) },
          { x: x, y: Y(d, 0.6) },
          { x: x - 1.4, y: Y(d, 0.38) },
          { x: x + 0.6, y: Y(d, 0.1) },
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
      // A dribble of molten slag on the crown.
      mark(
        d.s,
        HOT_CSS,
        [
          { x: -1.6, y: d.top + 0.8 },
          { x: 0.6, y: d.top + 0.2 },
          { x: 1.8, y: d.top + 1.4 },
        ],
        1.6,
        d.sd,
        [0.2, 0.3],
      );
    },
  },
  soldier: {
    size: () => [0.92, 1.08],
    shape: (W, H) => sup(W, H, 3.6, 0.94, 1),
    feet: 'peg',
    face: (c) => ({ eyes: { style: 'dot', count: 2, size: Math.min(2.1, c.eyes.size), y: 0.62 }, mouth: c.mouth === 'none' ? 'flat' : c.mouth }),
    pal: () => ({ foot: '#1b1613', footShade: '#100c0a', hand: TIN, handShade: TIN_SH }),
    print: (d) => {
      // Painted face band, crossed belts, brass buttons.
      poly(
        d.s,
        [
          { x: -d.W, y: Y(d, 0.82) },
          { x: d.W, y: Y(d, 0.82) },
          { x: d.W, y: Y(d, 0.42) },
          { x: -d.W, y: Y(d, 0.42) },
        ],
        '#f0c9a6',
      );
      mark(
        d.s,
        TIN,
        [
          { x: -d.W * 0.5, y: Y(d, 0.42) },
          { x: d.W * 0.5, y: d.by + 1 },
        ],
        1.6,
        d.sd,
        [0, 0],
      );
      mark(
        d.s,
        TIN,
        [
          { x: d.W * 0.5, y: Y(d, 0.42) },
          { x: -d.W * 0.5, y: d.by + 1 },
        ],
        1.6,
        d.sd + 1,
        [0, 0],
      );
      chips(d);
    },
    back: (d) => key(d, 0.3),
    front: (d) => {
      // The tall shako and its plume.
      inkBox(d, -d.W * 0.38, d.top - 5.2, d.W * 0.76, 6.4, IRON);
      mark(
        d.s,
        BRASS,
        [
          { x: -d.W * 0.38, y: d.top + 0.6 },
          { x: d.W * 0.38, y: d.top + 0.6 },
        ],
        1.1,
        d.sd,
        [0, 0],
      );
      tonedOval(d.s, d.f * 0.6 + d.wob * 0.3, d.top - 6.4, 1.6, 2.2, 9, d.pal.acc, d.pal.accShade, d.pal.ink, 0.5, 0.9 * d.k, 0.5);
    },
  },
  beetle: {
    size: () => [1.14, 0.9],
    shape: (W, H) => dome(W, H, 2, 1.04),
    feet: 'peg',
    arms: 'none',
    face: () => ({ eyes: { y: 0.38, style: 'ring' } }),
    pal: () => pegs,
    print: (d) => {
      // Tin underside, a pressed seam and rivets down each wing case.
      poly(
        d.s,
        [
          { x: -d.W, y: Y(d, 0.5) },
          { x: d.W, y: Y(d, 0.5) },
          { x: d.W, y: d.by + 2 },
          { x: -d.W, y: d.by + 2 },
        ],
        TIN,
      );
      mark(
        d.s,
        d.pal.darkShade,
        [
          { x: 0, y: d.top },
          { x: 0, y: Y(d, 0.5) },
        ],
        0.9,
        d.sd,
        [0, 0],
      );
      for (const side of [-1, 1]) for (const u of [0.66, 0.84]) rivet(d, side * d.W * 0.24, Y(d, u));
    },
    back: (d) => key(d, 0.7),
    front: (d) => {
      for (const side of [-1, 1]) stalk(d, side * d.W * 0.12 + d.f * 2, Y(d, 0.52), side * 2 + d.f * 5 + d.wob * 0.3, Y(d, 0.72), 0.9, BRASS, BRASS_SH);
    },
  },
  jackbox: {
    size: () => [1, 0.88],
    shape: (W, H) => sup(W, H, 2.2, 0.98, 1),
    feet: 'spring',
    pal: () => ({ foot: IRON, footShade: IRON_SH, hand: '#f6ead8', handShade: '#c9b8a3' }),
    face: () => ({ mouth: 'grin' }),
    print: (d) => {
      // Cheek dots, painted on.
      for (const side of [-1, 1]) poly(d.s, oval(side * d.W * 0.36, Y(d, 0.3), 1.4, 1.1, 8), '#e8566b');
    },
    back: (d) => {
      // A ruff collar under the head.
      const n = 9;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const x = -d.W * 0.6 + (i / n) * d.W * 1.2;
        pts.push({ x, y: d.by + (i % 2 ? 2 : -0.6) });
      }
      pts.push({ x: d.W * 0.5, y: d.by - 2.2 }, { x: -d.W * 0.5, y: d.by - 2.2 });
      toned(d.s, pts, TIN, TIN_SH, d.pal.ink, 0.5, 0.9 * d.k, 0.5);
    },
    front: (d) => {
      // A jester's two-point cap.
      for (const side of [-1, 1]) {
        toned(
          d.s,
          [
            { x: 0, y: d.top + 2.4 },
            { x: side * d.W * 0.5 + d.wob * 0.4, y: d.top - 3.6 },
            { x: side * d.W * 0.46, y: d.top + 2.8 },
          ],
          side < 0 ? d.pal.acc : d.pal.base,
          side < 0 ? d.pal.accShade : d.pal.shade,
          d.pal.ink,
          0.6,
          1 * d.k,
          0.6,
        );
        tonedOval(d.s, side * d.W * 0.5 + d.wob * 0.4, d.top - 3.8, 1.3, 1.3, 8, BRASS, BRASS_SH, d.pal.ink, 0.4, 0.8 * d.k, 0.4);
      }
    },
  },
};

/** A small inked box: hats, slots, grilles. */
function inkBox(d: D, x: number, y: number, w: number, h: number, fill: string) {
  toned(
    d.s,
    [
      { x, y },
      { x: x + w, y: y - 0.2 },
      { x: x + w, y: y + h },
      { x, y: y + h + 0.1 },
    ],
    fill,
    IRON_SH,
    d.pal.ink,
    0.5,
    0.9 * d.k,
    0.5,
  );
}

/** An ink ring with an open middle. */
function inkLoop(d: D, pts: { x: number; y: number }[], fill: string) {
  d.s.fillStyle = d.pal.ink;
  const ring = [...pts, pts[0], pts[1]];
  for (let i = 1; i < ring.length; i++) line(d.s, ring[i - 1].x, ring[i - 1].y, ring[i].x, ring[i].y, { w: 2.2 * d.k, seed: i, taper: [0, 0], press: 0 });
  d.s.fillStyle = fill;
  for (let i = 1; i < ring.length; i++) line(d.s, ring[i - 1].x, ring[i - 1].y, ring[i].x, ring[i].y, { w: 1, seed: i, taper: [0, 0], press: 0 });
}
