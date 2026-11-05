import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { type Level, T_SOLID, tileAt } from '../../../sim/level';
import { type Module, type ModuleOf, swingHeads } from '../../../sim/props';
import { blob, inkFor, line, type P } from '../../ink';
import { bar, barLine, boxPts, dot, ovalPts, part, path, poly, sprite, stamp, tick } from '../../ink-props';
import { circle, flame, flutter, glowDot, light, type RC } from '../../kit';
import type { DrawCtx } from '../common';
import { ashlar, BANNER, doorway, GILT, SHELL, STONE, WOOD } from './castle-ink';
import { type Deco, flat, type Haze, hazer } from './common';

/**
 * The castle's newer stage concepts, drawn (gen/stage/castle-keep.ts): the backdrop shell behind each
 * landmark (the deco `facade`, chosen by the level's concept), and the pieces the castle draws its own way.
 *
 * - The Gatehouse: the back parapet behind its wall-walk, pennants on its towers, the vaulted passage
 *   through it with a torch either end; and in the moat, the drawbridge hanging broken off its hinge on one
 *   chain, the other snapped.
 * - The Bell Tower: the belfry's back wall and its louvred arches, a weathervane on the spire, the nave's
 *   lancet windows and its altar, the dark of the arch through the tower's foot.
 * - The Boss Bridge: the hall between the keeps lit from below, chains off the walkway and the big lever
 *   that ought to drop the bridge, the trench's piers going down into the lava, the keeps' gates.
 * - The bell itself on its rod, and the firebars: an iron bar on a pin with its fireballs, exactly the
 *   circles the sim burns with.
 *
 * Every shell reads the landmark's tiles off the level once, when it's baked; it's scenery in hazed flat
 * tones with a light pen in its own dark, never a slab to stand on (docs/ART.md, Fair play). Only fire glows.
 */

/** Stone in the shade of a hall or passage: dark enough to sit back, light enough to show its courses. */
const SHADE: HSL = { h: 32, s: 8, l: 21 };
const IRON: HSL = { h: 222, s: 9, l: 30 };
/** Iron in front of a dark wall: lit enough to read against it. */
const BRIGHT_IRON: HSL = { h: 220, s: 8, l: 52 };
const BRONZE: HSL = { h: 36, s: 52, l: 46 };
const LAVA: HSL = { h: 20, s: 100, l: 54 };
const GLASS: HSL[] = [
  { h: 354, s: 50, l: 34 },
  { h: 214, s: 46, l: 34 },
  { h: 44, s: 60, l: 46 },
  { h: 140, s: 34, l: 30 },
];

const solidOf = (lv: Level) => (x: number, y: number) => tileAt(lv, x, y) === T_SOLID;
/** The first solid row at or below `from` in column x (the level's height if none). */
function down(sol: (x: number, y: number) => boolean, x: number, from: number, h: number): number {
  let y = from;
  while (y < h && !sol(x, y)) y++;
  return y;
}
/** The first empty row at or below `from` in column x. */
function downEmpty(sol: (x: number, y: number) => boolean, x: number, from: number, h: number): number {
  let y = from;
  while (y < h && sol(x, y)) y++;
  return y;
}

/** The shell's own frame: tile column/row to px within its sprite. */
const frameOf = (m: Deco) => {
  const tx0 = Math.round(m.at[0] / TILE);
  const ty0 = Math.round(m.at[1] / TILE);
  return { tx0, ty0, tx1: tx0 + Math.round(m.w / TILE) - 1, X: (tx: number) => tx * TILE - m.at[0], Y: (ty: number) => ty * TILE - m.at[1] };
};

/** An interior seen through a passage: coursed stone in shadow, vault ribs every few tiles, a lit sill. */
function vault(g: CanvasRenderingContext2D, t: Haze, x: number, y: number, w: number, h: number, seed: number) {
  ashlar(g, t, x, y, w, h, SHADE, seed, 8);
  for (let xx = x + 22 + (seed % 9); xx < x + w - 10; xx += 46) {
    const rib = poly(
      xx,
      y + h,
      xx,
      y + 9,
      xx + 4,
      y + 3,
      xx + 9,
      y + 9,
      xx + 9,
      y + h,
      xx + 6.5,
      y + h,
      xx + 6.5,
      y + 10,
      xx + 4,
      y + 6.5,
      xx + 2.5,
      y + 10,
      xx + 2.5,
      y + h,
    );
    flat(g, rib, { ...STONE, l: STONE.l - 2 }, t, xx | 0, 0.5);
  }
  flat(g, boxPts(x, y + h - 2.4, w, 2.4, 0.3, seed + 3, 0.1), { ...STONE, l: STONE.l + 4 }, t, seed + 3, 0.3);
}

/** A wall torch on its bracket: the iron baked, the flame live. */
function bracket(g: CanvasRenderingContext2D, t: Haze, x: number, y: number, seed: number) {
  flat(g, poly(x - 1.6, y + 6, x + 1.6, y + 6, x + 1, y + 1, x - 1, y + 1), IRON, t, seed, 0.3);
  flat(g, poly(x - 2.4, y + 1.4, x + 2.4, y + 1.4, x + 1.6, y - 1.4, x - 1.6, y - 1.4), WOOD, t, seed + 1, 0.3);
}
function torchFlame(rc: RC, x: number, y: number, i: number) {
  const k = 0.8 + Math.sin(rc.t * 13 + i * 2.7) * 0.12 + Math.sin(rc.t * 23 + i) * 0.08;
  flame(rc.g, x, y - 1.4, 2.4 * k, 5 * k, { h: 32, s: 100, l: 60 }, rc.t + i);
  glowDot(rc.g, x, y - 3, 12 * k, { h: 32, s: 100, l: 60 }, 0.3);
  light(rc, x, y - 2, 64, { h: 32, s: 100, l: 60 }, 0.75 * k);
}

/** A pennant on a pole, hanging still in still air and streaming out in a gust (`flutter`). */
function pennant(rc: RC, x: number, y: number, col: HSL, seed: number) {
  const s = rc.s;
  const f = flutter(rc, 2.2, seed);
  // Stiff cloth: even in still air it stands a little off the pole, so it reads as a flag and not a sliver.
  const lift = 0.4 + 0.6 * Math.min(1, Math.abs(f) * 0.5);
  const dir = f < 0 ? -1 : 1;
  const L = 22;
  const H = 9;
  const tipX = x + dir * L * (0.3 + 0.7 * lift);
  const tipY = y + 4 + (1 - lift) * 14;
  const wave = Math.sin(rc.t * 7 + seed) * f * 0.8;
  const cloth = [
    { x, y },
    { x: (x + tipX) / 2, y: y + (tipY - y) * 0.45 + wave },
    { x: tipX, y: tipY },
    { x: (x + tipX) / 2 - dir * 1.2, y: y + (tipY - y) * 0.55 + H * 0.55 + wave },
    { x, y: y + H },
  ];
  part(s, cloth, col, seed, { depth: 0.8, thin: 0.35, thick: 0.8 });
  // A gilt stripe down the hoist, and the finial on the pole.
  s.fillStyle = css(GILT, 6);
  path(s, [
    { x: x + dir * 0.6, y: y + 0.8 },
    { x: x + dir * 2.6, y: y + 1.2 },
    { x: x + dir * 2.6, y: y + H - 1.2 },
    { x: x + dir * 0.6, y: y + H - 0.8 },
  ]);
  s.fill();
  part(s, ovalPts(x, y - 1.4, 1.5, 1.5, seed + 1, 0.04, 10), GILT, seed + 1, { depth: 0.4, thin: 0.25, thick: 0.5 });
}

/** An iron rod or a wooden pole: a ribbon in a dark of its colour under the colour. */
function rodPts(g: CanvasRenderingContext2D, pts: readonly P[], w: number, c: HSL, seed: number, ink = inkFor(c)) {
  bar(g, pts, w, c, seed, { ink, rim: 0.35, taper: [0.02, 0.02], press: 0 });
}

// ------------------------------------------------------------------------------------------- gatehouse

interface Gate {
  G: number;
  f0: number;
  s1: number;
  Ft: number;
  Bt: number;
  Gt: number;
}

function gateOf(m: Deco, lv: Level): Gate {
  const { tx0, tx1, ty0 } = frameOf(m);
  const r = lv.landmark!.rect;
  const sol = solidOf(lv);
  const G = r.y + r.h;
  return {
    G,
    f0: tx0,
    s1: tx1,
    Ft: down(sol, tx0 + 1, ty0, G),
    Bt: down(sol, tx1 - 1, ty0, G),
    Gt: Math.max(down(sol, tx0 + 3, ty0, G), down(sol, tx0 + 4, ty0, G)),
  };
}

function gateBack(m: Deco, t: Haze, lv: Level) {
  return sprite(`castle|gate|${m.w}|${m.h}|${m.seed}|${t.k}|${lv.seed}`, -2, -2, m.w + 4, m.h + 4, (g) => {
    const { X, Y } = frameOf(m);
    const q = gateOf(m, lv);
    // The back parapet over the wall-walk, its crenels out of step with the front's.
    const px0 = X(q.f0 + 3);
    const px1 = X(q.s1 - 2);
    const top = Y(q.Gt) - 17;
    const back: P[] = [{ x: px0, y: Y(q.Gt) + 2 }];
    for (let x = px0; x < px1; x += 16) back.push({ x, y: top }, { x: x + 8, y: top }, { x: x + 8, y: top + 5 }, { x: x + 16, y: top + 5 });
    back.push({ x: px1, y: top }, { x: px1, y: Y(q.Gt) + 2 });
    flat(g, back, { ...STONE, l: STONE.l + 4 }, t, 3, 0.5);
    for (let x = px0 + 8; x < px1; x += 32) tick(g, x, top + 7, x + 0.2, top + 11.5, 0.5, x | 0, t.c(STONE, -12));
    // Pennant poles on both towers.
    for (const [x, y] of [
      [X(q.f0) + 1.5 * TILE, Y(q.Ft)],
      [X(q.s1 + 1) - 1.5 * TILE, Y(q.Bt)],
    ])
      rodPts(
        g,
        [
          { x, y },
          { x, y: y - 44 },
        ],
        1.3,
        { h: 26, s: 30, l: 40 },
        x | 0,
        t.ink(WOOD),
      );
    // The passage: the vault, a torch on its wall at either end.
    const pw = X(q.s1 + 1) - X(q.f0);
    vault(g, t, X(q.f0), Y(q.G - 3), pw, 3 * TILE, m.seed);
    for (const x of gateTorches(m, q)) bracket(g, t, x, Y(q.G - 3) + 18, x | 0);
    // The footing course under it, down to the ground: hidden by the terrain but where the ground drops.
    flat(g, boxPts(0, Y(q.G), m.w, m.h - Y(q.G), 0.4, 11, 0.05), { h: 30, s: 6, l: 30 }, t, 11, 0.4);
  });
}

const gateTorches = (m: Deco, q: Gate) => [frameOf(m).X(q.f0) + 2 * TILE, frameOf(m).X(q.s1 + 1) - 2 * TILE];

function gatehouse(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level!;
  const t = hazer(d, SHELL);
  const ox = m.at[0] + d.off[0];
  const oy = m.at[1] + d.off[1];
  stamp(rc.s, gateBack(m, t, lv), ox, oy);
  const q = gateOf(m, lv);
  const { X, Y } = frameOf(m);
  const col: HSL = { ...BANNER, s: BANNER.s - 6, l: BANNER.l + 14 };
  pennant(rc, ox + X(q.f0) + 1.5 * TILE + 0.5, oy + Y(q.Ft) - 43, col, m.seed);
  pennant(rc, ox + X(q.s1 + 1) - 1.5 * TILE + 0.5, oy + Y(q.Bt) - 43, col, m.seed + 5);
  for (const [i, x] of gateTorches(m, q).entries()) torchFlame(rc, ox + x, oy + Y(q.G - 3) + 18, i + m.seed);
}

/** The drawbridge, off its hinge at the gate's bank and hanging into the moat, one chain holding and one snapped. */
function drawbridge(m: Deco, t: Haze, lv: Level) {
  return sprite(`castle|bridge|${m.w}|${m.h}|${m.seed}|${t.k}|${lv.seed}`, -4, -4, m.w + 8, m.h + 8, (g) => {
    const { tx0, tx1, X, Y } = frameOf(m);
    const r = lv.landmark!.rect;
    const G = r.y + r.h;
    const f0 = tx1 + 1;
    const bank = f0 - 3;
    const hx = X(bank);
    const hy = Y(G) + 1;
    const moat = (bank - tx0) * TILE;
    // Hanging off its hinge, swung most of the way down: long enough to have spanned the moat, never across it.
    const a = Math.PI / 2 + 0.28 + hash2(m.seed, 1, 3) * 0.3;
    const L = Math.min(moat * 0.95, (lv.h - G) * TILE + 6);
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const nx = -uy;
    const ny = ux;
    const T = 10;
    const DECK: HSL = { h: 26, s: 34, l: 40 };
    const at = (k: number, n: number) => ({ x: hx + ux * k + nx * n, y: hy + uy * k + ny * n });
    // Its broken end: the boards snapped off ragged, each at its own length.
    const boards = 3;
    const deck: P[] = [at(0, 0)];
    for (let b = 0; b <= boards; b++) {
      const n = (T * b) / boards;
      const cut = L - 2 - hash2(b, 4, m.seed) * 7;
      if (b > 0) deck.push(at(cut - 2 - hash2(b, 5, m.seed) * 3, n - T / boards / 2));
      deck.push(at(cut, n));
    }
    deck.push(at(0, T));
    // The deck's thickness, the edge of its boards seen under it, then its face.
    flat(
      g,
      deck.map((p) => ({ x: p.x + 1.6, y: p.y + 2.2 })),
      { ...DECK, l: DECK.l - 14 },
      t,
      m.seed + 1,
      0.3,
    );
    flat(g, deck, DECK, t, m.seed, 0.8);
    // The boards along it, joints lifted, the odd knot.
    for (let b = 1; b < boards; b++) {
      const n = (T * b) / boards;
      tick(g, at(3, n).x, at(3, n).y, at(L - 10, n).x, at(L - 10, n).y, 0.5, b, t.c(DECK, -16));
    }
    dot(g, at(L * 0.4, T * 0.5).x, at(L * 0.4, T * 0.5).y, 0.6, 3, undefined, t.c(DECK, -18));
    // Iron straps across it, bolted, the hinge's knuckles at its foot.
    for (const k of [6, L * 0.5, L - 16]) {
      const strap = [at(k, -0.4), at(k + 3.4, -0.4), at(k + 3.4, T + 0.4), at(k, T + 0.4)];
      flat(g, strap, BRIGHT_IRON, t, k | 0, 0.4);
      for (const n of [2, T - 2]) dot(g, at(k + 1.7, n).x, at(k + 1.7, n).y, 0.55, (k + n) | 0, t.c(BRIGHT_IRON, 18), t.ink(IRON));
    }
    for (const n of [1.5, T - 3.5]) flat(g, ovalPts(at(0, n + 1).x, at(0, n + 1).y, 2.2, 2.2, n | 0, 0.04, 10), BRIGHT_IRON, t, (n * 3) | 0, 0.3);
    // The chains from the tower's face: one still holding the end, the other snapped and hanging.
    const cx = X(f0);
    const cy = Y(G - 5);
    const links = (x0: number, y0: number, x1: number, y1: number, seed: number) => {
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const n = Math.max(2, Math.round(len / 3.2));
      const ex = (x1 - x0) / len;
      const ey = (y1 - y0) / len;
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n;
        const lx = x0 + (x1 - x0) * k;
        const ly = y0 + (y1 - y0) * k;
        // Links alternate face on and edge on.
        if (i % 2) barLine(g, lx - ex * 1.5, ly - ey * 1.5, lx + ex * 1.5, ly + ey * 1.5, 0.9, t.hsl(BRIGHT_IRON), seed + i, { ink: t.ink(IRON), rim: 0.3 });
        else {
          const ring = ovalPts(lx, ly, Math.abs(ex) * 2.1 + Math.abs(ey) * 1.3, Math.abs(ey) * 2.1 + Math.abs(ex) * 1.3, seed + i, 0.03, 10);
          bar(g, [...ring, ring[0]], 0.8, t.hsl(BRIGHT_IRON), seed + i, { ink: t.ink(IRON), rim: 0.3, taper: [0, 0] });
        }
      }
    };
    links(cx, cy, at(L - 12, T * 0.5).x, at(L - 12, T * 0.5).y, 5);
    links(cx, cy + 3, cx - 5, cy + 19, 9);
    flat(g, boxPts(cx - 2.6, cy - 2.6, 5.2, 5.2, 0.6, 13, 0.1), IRON, t, 13, 0.3);
  });
}

// ------------------------------------------------------------------------------------------- bell tower

interface Chapel {
  G: number;
  t0: number;
  t1: number;
  s1: number;
  /** The belfry's roof row, the tower's body top, the spire's top row, the nave's roof. */
  R: number;
  Tb: number;
  st: number;
  Nr: number;
}

function chapelOf(m: Deco, lv: Level): Chapel {
  const { tx0, tx1, ty0 } = frameOf(m);
  const r = lv.landmark!.rect;
  const sol = solidOf(lv);
  const G = r.y + r.h;
  const R = down(sol, tx0, ty0, G);
  let t1 = tx0;
  while (t1 < tx1 && sol(t1 + 1, R)) t1++;
  return { G, t0: tx0, t1, s1: tx1, R, Tb: down(sol, tx0, R + 1, G), st: down(sol, Math.floor((tx0 + t1) / 2), ty0, G), Nr: down(sol, tx1, ty0, G) };
}

function chapelBack(m: Deco, t: Haze, lv: Level) {
  return sprite(`castle|chapel|${m.w}|${m.h}|${m.seed}|${t.k}|${lv.seed}`, -4, -4, m.w + 8, m.h + 8, (g) => {
    const { X, Y } = frameOf(m);
    const q = chapelOf(m, lv);
    // The belfry's back wall, its corner piers proud, two louvred arches through it.
    const bx = X(q.t0);
    const bw = X(q.t1 + 1) - bx;
    const by = Y(q.R + 1);
    const bh = Y(q.Tb) - by;
    flat(g, boxPts(bx, by, bw, bh, 0.4, 3, 0.05), { ...STONE, l: STONE.l + 2 }, t, 3, 0.5);
    for (const x of [bx, bx + bw - 4]) flat(g, boxPts(x, by, 4, bh, 0.3, x | 0, 0.05), { ...STONE, l: STONE.l + 8 }, t, x | 0, 0.4);
    const aw = (bw - 14) / 2;
    for (const [i, ax] of [bx + 5, bx + 9 + aw].entries()) {
      const arch: P[] = [{ x: ax, y: by + bh }];
      for (let k = 0; k <= 8; k++)
        arch.push({ x: ax + aw / 2 - Math.cos((k / 8) * Math.PI) * (aw / 2), y: by + 6 + aw / 2 - Math.sin((k / 8) * Math.PI) * (aw / 2) });
      arch.push({ x: ax + aw, y: by + bh });
      flat(g, arch, { ...SHADE, l: SHADE.l - 8 }, t, 7 + i, 0.2);
      // The louvres: slanted boards across the arch, each a lit top edge over its shadow.
      for (let y = by + 10 + aw / 2, k = 0; y < by + bh - 3; y += 6, k++) {
        const slat = poly(ax + 0.8, y, ax + aw - 0.8, y - 0.4, ax + aw - 0.8, y + 2.4, ax + 0.8, y + 2.8);
        flat(g, slat, { ...WOOD, l: WOOD.l + 12 }, t, (y * 3 + i) | 0, 0.5);
      }
    }
    // A weathervane on the spire's tip: a rod, a ball and an arrow.
    const vx = (X(q.t0) + X(q.t1 + 1)) / 2;
    const vy = Y(q.st);
    rodPts(
      g,
      [
        { x: vx, y: vy },
        { x: vx, y: vy - 13 },
      ],
      0.6,
      IRON,
      4,
      t.ink(IRON),
    );
    flat(g, ovalPts(vx, vy - 5, 1.4, 1.4, 5, 0.05, 10), GILT, t, 5, 0.3);
    const dir = hash2(m.seed, 2, 1) < 0.5 ? -1 : 1;
    rodPts(
      g,
      [
        { x: vx - dir * 5, y: vy - 11 },
        { x: vx + dir * 5, y: vy - 11 },
      ],
      0.5,
      IRON,
      6,
      t.ink(IRON),
    );
    flat(g, poly(vx + dir * 7, vy - 11, vx + dir * 4, vy - 13, vx + dir * 4, vy - 9), IRON, t, 7, 0.3);
    // The nave: its back wall, lancet windows of stained glass, an altar at the far end.
    const nx = X(q.t1 + 1);
    const nw = X(q.s1) - nx;
    const ny = Y(q.Nr + 1);
    const nh = Y(q.G) - ny;
    ashlar(g, t, nx, ny, nw, nh, { ...STONE, l: STONE.l - 4 }, 9, 9);
    const n = Math.max(1, Math.floor((nw - 28) / 26));
    for (let i = 0; i < n; i++) {
      const wx = nx + 10 + i * 26;
      const wt = ny + 6;
      const wb = ny + nh - 14;
      if (wb - wt < 14) break;
      const win: P[] = [
        { x: wx, y: wb },
        { x: wx, y: wt + 6 },
        { x: wx + 4, y: wt },
        { x: wx + 8, y: wt + 6 },
        { x: wx + 8, y: wb },
      ];
      flat(g, win, GILT, t, 20 + i, 0.2);
      // The glass in three big panes leaded together, each its own colour, lit from inside.
      const panes = 3;
      for (let r = 0; r < panes; r++) {
        const y0 = wt + 6 + ((wb - wt - 7) * r) / panes;
        const y1 = wt + 6 + ((wb - wt - 7) * (r + 1)) / panes;
        const c = GLASS[(r + i) % GLASS.length];
        const pane =
          r === 0
            ? poly(wx + 1.1, y1 - 0.6, wx + 1.1, y0, wx + 4, wt + 1.6, wx + 6.9, y0, wx + 6.9, y1 - 0.6)
            : boxPts(wx + 1.1, y0 + 0.3, 5.8, y1 - y0 - 0.9, 0.3, r + i * 5, 0.05);
        g.fillStyle = t.c({ ...c, l: c.l + 12 });
        path(g, pane);
        g.fill();
        g.fillStyle = t.c({ ...c, l: c.l + 26 });
        path(g, poly(wx + 1.6, y1 - 1.2, wx + 1.6, y0 + 1, wx + 3.2, y0 + 0.6, wx + 2.6, y1 - 1.6));
        g.fill();
      }
    }
    // The altar: a table under its cloth, two candlesticks and a plain gilt cross, against the back wall.
    const ax = X(q.s1) - 20;
    const ay = ny + nh;
    if (ax > nx + 16) {
      flat(g, boxPts(ax, ay - 11, 15, 11, 0.4, 30, 0.1), { h: 30, s: 16, l: 30 }, t, 30, 0.6);
      flat(g, poly(ax - 1, ay - 11.5, ax + 16, ay - 11.5, ax + 14, ay - 4, ax + 1, ay - 4), { h: 44, s: 20, l: 70 }, t, 31, 0.4);
      for (const cx of [ax + 2.5, ax + 12.5]) flat(g, boxPts(cx - 0.8, ay - 17, 1.6, 5.4, 0.2, cx | 0), GILT, t, cx | 0, 0.3);
      flat(
        g,
        poly(
          ax + 6.8,
          ay - 21,
          ax + 8.2,
          ay - 21,
          ax + 8.2,
          ay - 18.6,
          ax + 10,
          ay - 18.6,
          ax + 10,
          ay - 17.4,
          ax + 8.2,
          ay - 17.4,
          ax + 8.2,
          ay - 12,
          ax + 6.8,
          ay - 12,
          ax + 6.8,
          ay - 17.4,
          ax + 5,
          ay - 17.4,
          ax + 5,
          ay - 18.6,
          ax + 6.8,
          ay - 18.6,
        ),
        GILT,
        t,
        32,
        0.3,
      );
    }
    // The arch through the tower's foot.
    vault(g, t, X(q.t0), Y(q.G - 3), X(q.t1 + 1) - X(q.t0), 3 * TILE, m.seed);
    flat(g, boxPts(0, Y(q.G), m.w, m.h - Y(q.G), 0.4, 11, 0.05), { h: 30, s: 6, l: 30 }, t, 11, 0.4);
  });
}

function chapel(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level!;
  const t = hazer(d, SHELL);
  stamp(rc.s, chapelBack(m, t, lv), m.at[0] + d.off[0], m.at[1] + d.off[1]);
}

// ------------------------------------------------------------------------------------------- boss bridge

interface Keep {
  G: number;
  f0: number;
  s1: number;
  t0: number;
  t1: number;
  U: number;
}

function keepOf(m: Deco, lv: Level): Keep {
  const { tx0, tx1, ty0 } = frameOf(m);
  const sol = solidOf(lv);
  // Down the front keep: its body, the gate under it, the floor.
  const body = down(sol, tx0, ty0, lv.h);
  const gate = downEmpty(sol, tx0, body, lv.h);
  const G = down(sol, tx0, gate, lv.h);
  let t0 = tx0;
  while (t0 < tx1 && sol(t0, G - 4)) t0++;
  let t1 = tx1;
  while (t1 > t0 && sol(t1, G - 4)) t1--;
  return { G, f0: tx0, s1: tx1, t0, t1, U: down(sol, t0, ty0, G) };
}

function keepBack(m: Deco, t: Haze, lv: Level) {
  return sprite(`castle|keep|${m.w}|${m.h}|${m.seed}|${t.k}|${lv.seed}`, -2, -2, m.w + 4, m.h + 4, (g) => {
    const { X, Y } = frameOf(m);
    const q = keepOf(m, lv);
    const sol = solidOf(lv);
    const hx = X(q.t0);
    const hw = X(q.t1 + 1) - hx;
    // The hall's back wall: coursed stone in shadow, the bottom courses warmed by the lava under the bridge.
    const hy = Y(q.U + 1);
    const hh = Y(q.G) - hy;
    ashlar(g, t, hx, hy, hw, hh, { ...STONE, l: STONE.l - 3 }, 3, 9);
    // The lowest courses warmed by the lava's light: a flat warm tone with a hand's edge, not a wash.
    const warm: P[] = [{ x: hx, y: hy + hh }];
    for (let x = hx; x <= hx + hw; x += 8) warm.push({ x, y: hy + hh - 13 - Math.sin(x * 0.21 + m.seed) * 2.2 });
    warm.push({ x: hx + hw, y: hy + hh });
    g.fillStyle = t.c({ h: 18, s: 34, l: 30 });
    path(g, warm);
    g.fill();
    // The walkway's soffit: a shallow arch spring to spring.
    const soffit: P[] = [{ x: hx, y: hy }];
    for (let k = 0; k <= 10; k++) soffit.push({ x: hx + (hw * k) / 10, y: hy + 5 - Math.sin((k / 10) * Math.PI) * 4 });
    soffit.push({ x: hx + hw, y: hy });
    flat(g, soffit, { ...STONE, l: STONE.l - 2 }, t, 4, 0.4);
    // Chains hanging off the walkway between the firebars' reach and the wall.
    for (const x of [hx + 4, hx + hw - 4])
      for (let y = hy + 6, i = 0; y < hy + 6 + 18; y += 2.8, i++)
        if (i % 2) barLine(g, x, y - 1.3, x, y + 1.3, 0.8, t.hsl(BRIGHT_IRON), (y * 3) | 0, { ink: t.ink(IRON), rim: 0.3 });
        else {
          const ring = ovalPts(x, y, 1.1, 1.8, (y * 3) | 0, 0.03, 10);
          bar(g, [...ring, ring[0]], 0.7, t.hsl(BRIGHT_IRON), (y * 5) | 0, { ink: t.ink(IRON), rim: 0.3, taper: [0, 0] });
        }
    // The lever by the far gate: the one that ought to drop the bridge, rusted solid.
    const lx = hx + hw - 10;
    const ly = hy + hh - 26;
    flat(g, boxPts(lx - 4, ly, 8, 10, 0.3, 40, 0.1), IRON, t, 40, 0.5);
    flat(g, poly(lx - 0.8, ly + 4, lx + 0.8, ly + 4, lx - 4.2, ly - 6, lx - 5.6, ly - 5.4), { h: 26, s: 30, l: 34 }, t, 41, 0.3);
    flat(g, ovalPts(lx - 5, ly - 6.4, 2, 2, 42, 0.05, 10), { h: 0, s: 60, l: 40 }, t, 42, 0.3);
    // The trench: its rock walls, the bridge's piers and arches going down into the lava.
    const ty = Y(q.G + 1);
    const th = m.h - ty;
    // Lit only by what the lava throws up under the bridge, so it's drawn lighter than the hall to read as much.
    const ROCK: HSL = { h: 16, s: 20, l: 36 };
    flat(g, boxPts(hx, ty, hw, th, 0.3, 50, 0.05), ROCK, t, 50, 0.4);
    for (let i = 0; i < hw / 14; i++) {
      const x = hx + 4 + hash2(i, 9, m.seed) * (hw - 8);
      const y = ty + 6 + hash2(i, 10, m.seed) * (th - 10);
      tick(g, x, y, x + 3 + hash2(i, 11, m.seed) * 4, y + 2 + hash2(i, 12, m.seed) * 3, 0.5, i, t.c(ROCK, -9));
    }
    const piers: number[] = [q.t0];
    for (let x = q.t0 + 3; x < q.t1 - 1; x += 3 + (hash2(x, 3, m.seed) < 0.5 ? 1 : 0)) piers.push(x);
    piers.push(q.t1);
    for (const [i, x] of piers.entries()) {
      const px = X(x) + 4;
      const broken = !sol(x, q.G) || (i > 0 && !sol(piers[i - 1], q.G));
      flat(g, boxPts(px, ty - 2, 8, th + 2, 0.5, x, 0.1), { ...STONE, l: STONE.l + 22 }, t, x, 0.9);
      // Its lit face toward the lava, and the courses down it.
      g.fillStyle = t.c({ h: 22, s: 34, l: 60 });
      path(g, poly(px + 0.8, ty + th, px + 0.8, ty + th * 0.45, px + 2.2, ty + th * 0.5, px + 2.2, ty + th));
      g.fill();
      for (let y = ty + 7; y < ty + th - 2; y += 9) tick(g, px + 1, y, px + 7, y + 0.2, 0.45, (x * 7 + y) | 0, t.c(STONE, -6));
      if (i === 0 || broken) continue;
      // The arch from the last pier to this one, under the bridge.
      const ax0 = X(piers[i - 1]) + 12;
      const ax1 = px;
      const arch: P[] = [{ x: ax0, y: ty - 2 }];
      for (let k = 0; k <= 8; k++) arch.push({ x: ax0 + ((ax1 - ax0) * k) / 8, y: ty + 1 + Math.sin((k / 8) * Math.PI) * 6 });
      arch.push({ x: ax1, y: ty - 2 });
      flat(g, arch, { ...STONE, l: STONE.l + 16 }, t, x + 7, 0.6);
    }
    // The keeps' gates: the dark through each.
    for (const [x0, x1] of [
      [q.f0, q.t0 - 1],
      [q.t1 + 1, q.s1],
    ])
      doorway(g, t, X(x0), Y(q.G - 3), X(x1 + 1) - X(x0), 3 * TILE, STONE, x0);
  });
}

function lavaKeep(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level!;
  const t = hazer(d, SHELL);
  const ox = m.at[0] + d.off[0];
  const oy = m.at[1] + d.off[1];
  stamp(rc.s, keepBack(m, t, lv), ox, oy);
  const q = keepOf(m, lv);
  const { X, Y } = frameOf(m);
  // The lava's light up the hall from below.
  const mid = ox + (X(q.t0) + X(q.t1 + 1)) / 2;
  light(rc, mid, oy + Y(q.G) + 8, (q.t1 - q.t0 + 3) * TILE * 0.8, LAVA, 0.7 + 0.08 * Math.sin(rc.t * 1.7));
}

// ------------------------------------------------------------------------------------------- registry

/** The newer concepts' shells, by the level's concept; false when the shell isn't one of theirs. */
export function castleStageShell(rc: RC, m: Deco, d: DrawCtx): boolean {
  const lv = d.o.level;
  const concept = lv?.landmark?.concept;
  if (!lv || !concept) return false;
  if (concept === 'gatehouse') {
    if (Math.round(m.at[0] / TILE) < lv.landmark!.rect.x) stamp(rc.s, drawbridge(m, hazer(d, SHELL), lv), m.at[0] + d.off[0], m.at[1] + d.off[1]);
    else gatehouse(rc, m, d);
    return true;
  }
  if (concept === 'bell-tower') {
    chapel(rc, m, d);
    return true;
  }
  if (concept === 'boss-bridge') {
    lavaKeep(rc, m, d);
    return true;
  }
  return false;
}

type Swinger = ModuleOf<'swinger'>;

/** The great bell on its rod: a headstock at the pin, the bronze bell turned with its swing, the clapper inside. */
function bell(rc: RC, m: Swinger, d: DrawCtx) {
  const s = rc.s;
  const hx = m.hub[0] + d.off[0];
  const hy = m.hub[1] + d.off[1];
  const [h] = swingHeads(m, rc.frame, d.r.phase, d.off);
  const a = h.a - Math.PI / 2;
  // The headstock: a timber beam across the pin, the rod down to the crown.
  part(s, boxPts(hx - 9, hy - 2.6, 18, 4.4, 0.6, 3, 0.1), { h: 24, s: 34, l: 26 }, 3, { depth: 0.5, thin: 0.3, thick: 0.8 });
  rodPts(
    s,
    [
      { x: hx, y: hy },
      { x: h.x - Math.cos(h.a) * 8, y: h.y - Math.sin(h.a) * 8 },
    ],
    1.4,
    BRIGHT_IRON,
    4,
  );
  s.save();
  s.translate(h.x, h.y);
  s.rotate(a);
  // In the swing's frame, crown up (-y), mouth down: inside the circle the sim hurts with.
  const R = m.radius * 0.8;
  const shapePts = poly(
    -R * 0.42,
    -R * 0.82,
    R * 0.42,
    -R * 0.82,
    R * 0.55,
    -R * 0.2,
    R * 0.66,
    R * 0.42,
    R * 0.86,
    R * 0.62,
    -R * 0.86,
    R * 0.62,
    -R * 0.66,
    R * 0.42,
    -R * 0.55,
    -R * 0.2,
  );
  part(s, shapePts, BRONZE, 7, { depth: 0.9, shade: -12, thin: 0.35, thick: 1 });
  // The lip band and a lit stripe down the shoulder.
  s.fillStyle = css(BRONZE, -14);
  path(s, poly(-R * 0.84, R * 0.44, R * 0.84, R * 0.44, R * 0.86, R * 0.62, -R * 0.86, R * 0.62));
  s.fill();
  s.fillStyle = css(BRONZE, 24);
  line(s, -R * 0.3, -R * 0.7, -R * 0.52, R * 0.3, { w: 0.9, seed: 9, taper: [0.2, 0.4], press: 0 });
  // The clapper, just showing under the mouth, swinging a little behind the bell.
  const lag = Math.sin(rc.t * 3 + d.mi) * 1.2;
  s.fillStyle = inkFor(IRON);
  circle(s, lag, R * 0.7, 1.4);
  s.restore();
  return true;
}

/** A firebar: an iron bar on its pin out to the last fireball, and each fireball exactly the circle the sim burns with. */
function firebar(rc: RC, m: Swinger, d: DrawCtx) {
  const s = rc.s;
  const hx = m.hub[0] + d.off[0];
  const hy = m.hub[1] + d.off[1];
  const [h] = swingHeads(m, rc.frame, d.r.phase, d.off);
  const mods = d.r.mods;
  // The innermost ball's module draws the bar and the pin, once per bar.
  const inner = mods.every((o) => o.type !== 'swinger' || o.hub[0] !== m.hub[0] || o.hub[1] !== m.hub[1] || o.arm >= m.arm);
  if (inner) {
    const outer = Math.max(...mods.map((o) => (o.type === 'swinger' && o.hub[0] === m.hub[0] && o.hub[1] === m.hub[1] ? o.arm : 0)));
    // The pin's iron plate bolted to the wall, so the bar reads as fixed to something even on a dark wall.
    part(s, boxPts(hx - 5, hy - 5, 10, 10, 1.2, 5, 0.15), IRON, 5, { depth: 0.8, thin: 0.35, thick: 0.9 });
    for (const [bx, by] of [
      [-3.2, -3.2],
      [3.2, -3.2],
      [-3.2, 3.2],
      [3.2, 3.2],
    ])
      dot(s, hx + bx, hy + by, 0.6, bx * 3 + by, css(IRON, 30), inkFor(IRON));
    rodPts(
      s,
      [
        { x: hx, y: hy },
        { x: hx + Math.cos(h.a) * outer, y: hy + Math.sin(h.a) * outer },
      ],
      2.2,
      BRIGHT_IRON,
      2,
    );
    part(s, ovalPts(hx, hy, 3, 3, 3, 0.05, 12), BRIGHT_IRON, 3, { depth: 0.6, thin: 0.3, thick: 0.8 });
    s.fillStyle = css(BRIGHT_IRON, 24);
    circle(s, hx - 0.6, hy - 0.6, 0.9);
  }
  const r = m.radius * 0.85;
  const flick = 0.85 + Math.sin(rc.t * 19 + m.arm * 5) * 0.15;
  glowDot(rc.g, h.x, h.y, r * 2.6 * flick, LAVA, 0.5);
  s.fillStyle = css(LAVA, -6);
  blob(s, h.x, h.y, r, (m.arm * 10) | 0, 1, 0.08);
  s.fill();
  s.fillStyle = css({ h: 44, s: 100, l: 70 });
  blob(s, h.x - r * 0.2, h.y - r * 0.2, r * 0.5, (m.arm * 10 + 1) | 0, 1, 0.1);
  s.fill();
  if (inner) light(rc, hx, hy, 60, LAVA, 0.6);
  return true;
}

/** The newer concepts' own pieces, module by module: the bell, the firebars. */
export function castleStagePiece(rc: RC, layer: number, m: Module, d: DrawCtx): boolean {
  if (m.type !== 'swinger') return false;
  const key = d.r.pp.def.key;
  if (key === 'setpiece:castle:bell-tower') return layer === 2 ? bell(rc, m, d) : true;
  if (key === 'setpiece:castle:boss-bridge') return layer === 2 ? firebar(rc, m, d) : true;
  return false;
}
