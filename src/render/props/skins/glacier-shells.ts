import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { type Level, T_SOLID, tileAt } from '../../../sim/level';
import { line } from '../../ink';
import { boxPts, path, pen, poly, sprite, stamp, tone } from '../../ink-props';
import type { RC } from '../../kit';
import type { DrawCtx } from '../common';
import { SHELLS } from '../modules/deco-shells';
import type { Deco, DecoSkin, ThemeSkins } from './common';

/**
 * The backdrop shells of the glacier's stage concepts (src/gen/stage/glacier.ts), drawn as the deco `facade`
 * behind each landmark's terrain and chosen by the level's concept:
 *
 * - The Ice Palace: the great hall's back wall of ice block, tall arched windows, a spire over every tower.
 * - The Summit: the ice cave through its foot.
 * - The Frozen Shipwreck: masts, yards and the sails frozen stiff on them, the stays, a bowsprit, a crow's
 *   nest, and the hold's ribs through the breach.
 * - The Frozen Falls: the river frozen on the clifftop out to the lip, and the ice cave behind the falls with
 *   a fish caught in its wall.
 * - The Ski Jump: the trestle under the inrun, the start hut on the tower, the judges' box past the take-off.
 *
 * Shells are flat tones sunk toward the sky's haze with a thin pen of their own dark: scenery, never a slab
 * to stand on (docs/ART.md, Fair play). Each reads the landmark's tiles from the level and is baked once.
 */

export const SNOW: HSL = { h: 205, s: 22, l: 94 };
const PALE: HSL = { h: 198, s: 46, l: 82 };
const DEEP: HSL = { h: 214, s: 42, l: 18 };
const WOOD: HSL = { h: 28, s: 34, l: 32 };
const CLOTH: HSL = { h: 40, s: 16, l: 78 };
const STEEL: HSL = { h: 212, s: 8, l: 66 };

const HAZE = 0.32;
function hz(d: DrawCtx) {
  const fog = d.o.level?.theme.fog;
  const k = fog ? `${fog.h | 0},${fog.l | 0}` : '-';
  const hsl = (c: HSL): HSL => (fog ? { h: c.h, s: c.s * (1 - HAZE), l: c.l + (fog.l - c.l) * HAZE } : c);
  return { k, hsl, c: (b: HSL, dl = 0, a = 1) => css(hsl(b), dl, a), ink: (b: HSL) => css({ h: b.h, s: b.s * 0.5, l: Math.max(4, hsl(b).l * 0.3) }) };
}
type Hz = ReturnType<typeof hz>;

/** The shell's box, in tiles. */
const boxOf = (m: Deco) => ({ x: Math.round(m.at[0] / TILE), y: Math.round(m.at[1] / TILE), w: Math.round(m.w / TILE), h: Math.round(m.h / TILE) });

/** The first solid row in column x from row y0 down to y1 (y1 when none). */
function topOf(lv: Level, x: number, y0: number, y1: number): number {
  for (let y = y0; y < y1; y++) if (tileAt(lv, x, y) === T_SOLID) return y;
  return y1;
}

/** The roof over an open floor at column x: the row under the solid that caps the air above row G - 1. */
function roofOver(lv: Level, x: number, top: number, G: number): number {
  let r = G - 1;
  while (r > top && tileAt(lv, x, r - 1) !== T_SOLID) r--;
  return r;
}

/** A thick stroke inked: an ink ribbon, the colour over it. */
function beam(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, col: string, ink: string, seed: number) {
  g.fillStyle = ink;
  line(g, ax, ay, bx, by, { w: w + 1.1, seed, taper: [0.02, 0.02], press: 0.05 });
  g.fillStyle = col;
  line(g, ax, ay, bx, by, { w, seed: seed + 1, taper: [0.02, 0.02], press: 0.05 });
}

/** An ice cave's inside over `w`×`h` px: deep blue, faceted walls lighter toward the floor, icicles off its roof. */
function iceInside(g: CanvasRenderingContext2D, w: number, h: number, t: Hz, seed: number) {
  g.fillStyle = t.c(DEEP);
  g.fillRect(0, 0, w, h);
  for (let x = -6; x < w; x += 11) {
    const k = hash2(x, 1, seed);
    const fx = x + k * 5;
    g.fillStyle = t.c({ ...DEEP, l: DEEP.l + 8 + k * 8 });
    path(g, poly(fx, h, fx + 4 + k * 4, h * (0.25 + k * 0.3), fx + 12, h * (0.4 + hash2(x, 2, seed) * 0.3), fx + 14, h));
    g.fill();
  }
  g.fillStyle = t.c(PALE, -26);
  for (let x = 3; x < w - 2; x += 7 + hash2(x | 0, 3, seed) * 6) {
    const len = 3 + hash2(x | 0, 4, seed) * Math.min(9, h * 0.3);
    path(g, poly(x - 1.6, 0, x + 1.6, 0, x + 0.2, len));
    g.fill();
  }
  g.fillStyle = t.c(PALE, -8, 0.6);
  g.fillRect(0, h - 1.6, w, 1.6);
}

/** A spire of ice over a tower `w` px wide whose top is at y: a cone, a band of windows, a pennant. */
function spire(g: CanvasRenderingContext2D, cx: number, y: number, w: number, t: Hz, seed: number) {
  const hgt = w * 1.6 + 10;
  const cone = poly(cx - w / 2 - 1, y, cx - w * 0.22, y - hgt * 0.55, cx, y - hgt, cx + w * 0.22, y - hgt * 0.55, cx + w / 2 + 1, y);
  tone(g, cone, t.hsl(PALE), { depth: 1 });
  g.fillStyle = t.c(PALE, 10);
  path(g, poly(cx - w * 0.3, y - 1, cx - 1, y - hgt + 3, cx - w * 0.05, y - 1));
  g.fill();
  pen(g, cone, seed, 0.3, 0.8, 3, t.ink(PALE));
  g.fillStyle = t.c(DEEP, 10);
  for (let k = -1; k <= 1; k++) g.fillRect(cx + k * (w * 0.25) - 1, y - hgt * 0.3, 2, 4);
  beam(g, cx, y - hgt, cx, y - hgt - 7, 0.6, t.c(STEEL), t.ink(STEEL), seed + 2);
  g.fillStyle = t.c({ h: 205, s: 60, l: 50 });
  path(g, poly(cx, y - hgt - 7, cx + 6, y - hgt - 5.6, cx, y - hgt - 4.2));
  g.fill();
}

/** The Ice Palace: its hall's back wall of ice block with tall arched windows, and a spire over every tower and the keep. */
function palace(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return;
  const t = hz(d);
  const b = boxOf(m);
  const G = b.y + b.h;
  const tops = Array.from({ length: b.w }, (_, i) => topOf(lv, b.x + i, b.y, G));
  const sp = sprite(`glacier|palace|${b.x},${b.y},${b.w},${b.h}|${m.seed}|${t.k}|${lv.version}`, -TILE, -TILE * 6, m.w + TILE * 2, m.h + TILE * 6, (g) => {
    const X = (tx: number) => (tx - b.x) * TILE;
    const Y = (ty: number) => (ty - b.y) * TILE;
    for (let i = 0; i < b.w; i++) {
      const x = b.x + i;
      if (tileAt(lv, x, G - 1) === T_SOLID) continue;
      const r = roofOver(lv, x, tops[i], G);
      g.fillStyle = t.c(PALE, -22);
      g.fillRect(X(x), Y(r), TILE, Y(G) - Y(r));
      for (let y = r; y < G; y++) {
        const pts = boxPts(X(x) + 0.8 + (y & 1 ? -TILE / 2 : 0), Y(y) + 0.8, TILE - 1.6, TILE - 1.6, 1, x * 31 + y, 0.2);
        g.fillStyle = t.c(PALE, -16 + hash2(x, y, m.seed) * 8);
        path(g, pts);
        g.fill();
      }
      // A window every third column, where the hall is tall enough.
      if (i % 3 === 1 && G - r >= 4) {
        const wx = X(x) + 3;
        const wy = Y(r) + 6;
        const wh = Y(G) - wy - 10;
        const arch = poly(wx, wy + wh, wx, wy + 4, wx + 5, wy, wx + 10, wy + 4, wx + 10, wy + wh);
        tone(g, arch, t.hsl({ h: 196, s: 60, l: 70 }), { depth: 0.4 });
        g.fillStyle = t.c(PALE, 14);
        g.fillRect(wx + 4.4, wy + 1, 1.2, wh - 1);
        g.fillRect(wx, wy + wh * 0.5, 10, 1.1);
        pen(g, arch, x, 0.25, 0.6, 3, t.ink(PALE));
      }
    }
    // Spires over the high runs of the roofline: the towers and the keep.
    for (let i = 0; i < b.w;) {
      let j = i;
      while (j + 1 < b.w && tops[j + 1] === tops[i]) j++;
      const left = i > 0 ? tops[i - 1] : G;
      const right = j + 1 < b.w ? tops[j + 1] : G;
      if (tops[i] < G && tops[i] < left && tops[i] < right) spire(g, X(b.x + i) + ((j - i + 1) * TILE) / 2, Y(tops[i]), (j - i + 1) * TILE, t, m.seed + i);
      i = j + 1;
    }
  });
  stamp(rc.s, sp, m.at[0] + d.off[0], m.at[1] + d.off[1]);
}

/** The Summit's ice cave through its foot. */
function summitCave(rc: RC, m: Deco, d: DrawCtx) {
  const t = hz(d);
  const sp = sprite(`glacier|cave|${m.w}|${m.h}|${m.seed}|${t.k}`, 0, 0, m.w, m.h, (g) => iceInside(g, m.w, m.h, t, m.seed));
  stamp(rc.s, sp, m.at[0] + d.off[0], m.at[1] + d.off[1]);
}

/**
 * The Frozen Shipwreck: two or three masts standing up off her deck with their yards and the sails frozen
 * stiff on them, icicles off every yard, the stays down to her ends, a bowsprit, and the hold's dark ribs
 * through the breach under the deck.
 */
function wreck(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return;
  const t = hz(d);
  const b = boxOf(m);
  const G = b.y + b.h;
  const tops = Array.from({ length: b.w }, (_, i) => topOf(lv, b.x + i, b.y, G));
  const sp = sprite(`glacier|wreck|${b.x},${b.y},${b.w},${b.h}|${m.seed}|${t.k}|${lv.version}`, -TILE * 3, -TILE * 5, m.w + TILE * 6, m.h + TILE * 5, (g) => {
    const X = (tx: number) => (tx - b.x) * TILE;
    const Y = (ty: number) => (ty - b.y) * TILE;
    // The hold, wherever the floor is open under the deck: dark, with her ribs.
    for (let i = 0; i < b.w; i++) {
      const x = b.x + i;
      if (tileAt(lv, x, G - 1) === T_SOLID) continue;
      const r = roofOver(lv, x, tops[i], G);
      g.fillStyle = t.c({ h: 24, s: 30, l: 12 });
      g.fillRect(X(x), Y(r), TILE, Y(G) - Y(r));
      if (i % 2 === 0) beam(g, X(x) + 4, Y(r), X(x) + 6, Y(G), 1.8, t.c(WOOD, -8), t.ink(WOOD), x);
    }
    // The stern is her higher end, the bow the other.
    const sternLeft = tops[0] <= tops[b.w - 1];
    const n = b.w >= 20 ? 3 : 2;
    const masts: { x: number; deck: number; top: number }[] = [];
    for (let k = 0; k < n; k++) {
      const i = Math.min(b.w - 1, Math.round(((k + 1) * b.w) / (n + 1)));
      masts.push({ x: X(b.x + i) + TILE / 2, deck: Y(tops[i]), top: -TILE * (k === Math.floor(n / 2) ? 4.6 : 3.6) });
    }
    const bowX = sternLeft ? m.w : 0;
    const bowDeck = Y(tops[sternLeft ? b.w - 1 : 0]);
    const sprit = { x: bowX + (sternLeft ? 1 : -1) * TILE * 2.6, y: bowDeck - TILE * 1.4 };
    beam(g, bowX, bowDeck - 2, sprit.x, sprit.y, 1.8, t.c(WOOD, 4), t.ink(WOOD), 9);
    // Stays from each mast's top to her ends.
    g.fillStyle = t.c(CLOTH, -34);
    for (const ms of masts) {
      line(g, ms.x, ms.top, sprit.x, sprit.y, { w: 0.35, seed: ms.x, taper: [0, 0], press: 0 });
      line(g, ms.x, ms.top, sternLeft ? 2 : m.w - 2, Y(tops[sternLeft ? 0 : b.w - 1]) - 1, { w: 0.35, seed: ms.x + 1, taper: [0, 0], press: 0 });
    }
    for (const [k, ms] of masts.entries()) {
      beam(g, ms.x, ms.deck, ms.x, ms.top, 2.2, t.c(WOOD, 2), t.ink(WOOD), k * 5);
      // Two yards, each with its sail frozen in a sag, torn on some, icicles all along its foot.
      for (const [yi, yy] of [ms.top + TILE * 1.4, ms.top + TILE * 3.4].entries()) {
        const half = TILE * (yi ? 2.6 : 1.9);
        beam(g, ms.x - half, yy, ms.x + half, yy + 1, 1.3, t.c(WOOD, 6), t.ink(WOOD), k * 9 + yi);
        const drop = TILE * (yi ? 1.6 : 1.3);
        const torn = hash2(k, yi, m.seed) < 0.4;
        const sail = poly(
          ms.x - half + 1,
          yy + 1.5,
          ms.x + half - 1,
          yy + 2.5,
          ms.x + half - 3,
          yy + drop,
          ms.x + (torn ? 3 : 0),
          yy + drop - (torn ? 4 : 1),
          ms.x - (torn ? 2 : 0),
          yy + drop * (torn ? 0.6 : 1) + 2,
          ms.x - half + 2,
          yy + drop,
        );
        tone(g, sail, t.hsl(CLOTH), { depth: 0.6 });
        pen(g, sail, k * 7 + yi, 0.25, 0.6, 3, t.ink(CLOTH));
        g.fillStyle = t.c(PALE, 6);
        for (let ix = ms.x - half + 3; ix < ms.x + half - 2; ix += 4 + hash2(ix | 0, yi, m.seed) * 3) {
          const len = 2 + hash2(ix | 0, k, m.seed) * 4;
          path(g, poly(ix - 0.8, yy + drop - 0.5, ix + 0.8, yy + drop - 0.5, ix, yy + drop + len));
          g.fill();
        }
      }
      if (k === Math.floor(n / 2)) {
        const nest = boxPts(ms.x - 5, ms.top + 2, 10, 4, 1, k, 0.2);
        tone(g, nest, t.hsl(WOOD), { depth: 0.5 });
        pen(g, nest, k + 3, 0.25, 0.6, 3, t.ink(WOOD));
      }
    }
  });
  stamp(rc.s, sp, m.at[0] + d.off[0], m.at[1] + d.off[1]);
}

/** The Frozen Falls: the river frozen on the clifftop out to the lip, and the ice cave behind the falls with a fish caught in its wall. */
function falls(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return;
  const t = hz(d);
  const b = boxOf(m);
  // The cave: from its floor (two rows up from the box's foot, over the pool's bed) up to its roof.
  const floor = b.y + b.h - 2;
  const roof = roofOver(lv, b.x + 1, b.y, floor);
  // The clifftop: the columns from the lip level with it.
  const lipRow = topOf(lv, b.x, b.y, floor);
  let run = 1;
  while (run < b.w && topOf(lv, b.x + run, b.y, floor) === lipRow) run++;
  const sp = sprite(`glacier|falls|${b.x},${b.y},${b.w},${b.h}|${m.seed}|${t.k}|${lv.version}`, 0, -TILE, m.w, m.h + TILE, (g) => {
    const cy = (roof - b.y) * TILE;
    const ch = (b.y + b.h - roof) * TILE;
    g.save();
    g.translate(0, cy);
    iceInside(g, m.w, ch, t, m.seed);
    const fx = m.w * (0.3 + hash2(1, 2, m.seed) * 0.4);
    const fy = ch * 0.3;
    const fish = poly(fx - 6, fy, fx - 2, fy - 2.6, fx + 3, fy - 2, fx + 5, fy, fx + 3, fy + 2, fx - 2, fy + 2.4);
    tone(g, fish, t.hsl({ h: 30, s: 30, l: 60 }), { depth: 0.4 });
    g.fillStyle = t.c({ h: 30, s: 30, l: 54 });
    path(g, poly(fx + 5, fy, fx + 8.5, fy - 2.6, fx + 8.5, fy + 2.6));
    g.fill();
    pen(g, fish, 4, 0.25, 0.5, 3, t.ink(PALE));
    g.restore();
    // The river frozen on the clifftop, out to the lip: a low hump of ice along it.
    const lip = (lipRow - b.y) * TILE;
    const rw = run * TILE;
    g.fillStyle = t.c(PALE, 4);
    path(g, poly(1, lip + 1, TILE * 0.6, lip - 3, rw * 0.6, lip - 4, rw - 2, lip - 2.5, rw - 1, lip + 1));
    g.fill();
    g.fillStyle = t.c(PALE, 18);
    for (let i = 0; i < rw / 16 - 1; i++) g.fillRect(6 + i * 16 + hash2(i, 5, m.seed) * 6, lip - 2.4, 5, 0.8);
  });
  stamp(rc.s, sp, m.at[0] + d.off[0], m.at[1] + d.off[1]);
}

/** The Ski Jump: the timber trestle the inrun stands on, the start hut on its tower, and past the take-off the judges' box holding up its scores. */
function skiJump(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return;
  const t = hz(d);
  const b = boxOf(m);
  const G = b.y + b.h;
  const tops = Array.from({ length: b.w }, (_, i) => topOf(lv, b.x + i, b.y, G));
  const sp = sprite(`glacier|jump|${b.x},${b.y},${b.w},${b.h}|${m.seed}|${t.k}|${lv.version}`, -TILE, -TILE * 4, m.w + TILE * 6, m.h + TILE * 4, (g) => {
    const X = (tx: number) => (tx - b.x) * TILE;
    const Y = (ty: number) => (ty - b.y) * TILE;
    const foot = Y(G);
    // Posts every other column under the deck, braced crosswise to the next.
    const posts: { x: number; y: number }[] = [];
    for (let i = 2; i < b.w; i += 2) if (tileAt(lv, b.x + i, G - 1) !== T_SOLID) posts.push({ x: X(b.x + i) + TILE / 2, y: Y(tops[i]) + TILE });
    for (let k = 0; k + 1 < posts.length; k++) {
      const a = posts[k];
      const c = posts[k + 1];
      beam(g, a.x, a.y + 2, c.x, foot - 2, 0.9, t.c(WOOD, 8), t.ink(WOOD), k * 3);
      beam(g, c.x, c.y + 2, a.x, foot - 2, 0.9, t.c(WOOD, 8), t.ink(WOOD), k * 3 + 1);
    }
    for (const [k, p] of posts.entries()) beam(g, p.x, p.y, p.x, foot, 1.6, t.c(WOOD, 2), t.ink(WOOD), k * 7);
    // The tower's doorway: its dark inside and a timber frame down to the ground.
    let door = 0;
    while (door < b.w && tileAt(lv, b.x + door, G - 1) !== T_SOLID && tileAt(lv, b.x + door, G - 4) === T_SOLID && tileAt(lv, b.x + door, G - 5) === T_SOLID)
      door++;
    if (door > 0) {
      const dy = Y(G - 3) - 2;
      g.fillStyle = t.c(DEEP, -4);
      g.fillRect(0, dy, door * TILE, foot - dy);
      for (const px of [1.5, door * TILE - 1.5]) beam(g, px, dy, px, foot, 1.8, t.c(WOOD, 2), t.ink(WOOD), px | 0);
      beam(g, 0, dy, door * TILE, dy, 1.8, t.c(WOOD, 6), t.ink(WOOD), 40);
    }
    // The start hut on the tower: red boards, a dark window, a snowy pitched roof, a flag.
    const hy = Y(tops[0]);
    const hut = boxPts(1, hy - TILE * 1.7, TILE * 2 - 2, TILE * 1.7, 1, m.seed, 0.2);
    tone(g, hut, t.hsl({ h: 4, s: 46, l: 44 }), { depth: 0.6 });
    pen(g, hut, 3, 0.3, 0.7, 3, t.ink(WOOD));
    g.fillStyle = t.c(DEEP);
    g.fillRect(9, hy - TILE * 1.3, 8, 6);
    const roof = poly(-2, hy - TILE * 1.6, TILE, hy - TILE * 2.6, TILE * 2 + 2, hy - TILE * 1.6);
    tone(g, roof, t.hsl(SNOW), { depth: 0.5 });
    pen(g, roof, 5, 0.3, 0.7, 3, t.ink(PALE));
    beam(g, TILE, hy - TILE * 2.6, TILE, hy - TILE * 3.6, 0.5, t.c(STEEL), t.ink(STEEL), 6);
    g.fillStyle = t.c({ h: 4, s: 70, l: 52 });
    path(g, poly(TILE, hy - TILE * 3.6, TILE + 7, hy - TILE * 3.3, TILE, hy - TILE * 3));
    g.fill();
    // The judges' box past the take-off, on legs, its scores held up in the window.
    const jx = m.w + TILE * 1.2;
    const jy = foot - TILE * 3.4;
    beam(g, jx + 4, jy + TILE * 1.4, jx + 4, foot, 1.2, t.c(WOOD), t.ink(WOOD), 11);
    beam(g, jx + TILE * 3 - 4, jy + TILE * 1.4, jx + TILE * 3 - 4, foot, 1.2, t.c(WOOD), t.ink(WOOD), 12);
    const booth = boxPts(jx, jy, TILE * 3, TILE * 1.4, 1, m.seed + 1, 0.2);
    tone(g, booth, t.hsl({ h: 210, s: 20, l: 60 }), { depth: 0.6 });
    pen(g, booth, 13, 0.3, 0.7, 3, t.ink(STEEL));
    g.font = 'bold 5px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    ['5.9', '6.0', '5.8'].forEach((sc, i) => {
      const cx = jx + 8 + i * 16;
      g.fillStyle = t.c({ h: 50, s: 20, l: 94 });
      g.fillRect(cx - 6, jy + 4, 12, 9);
      g.fillStyle = t.ink(STEEL);
      g.fillText(sc, cx, jy + 8.7);
    });
  });
  stamp(rc.s, sp, m.at[0] + d.off[0], m.at[1] + d.off[1]);
}

const facade: DecoSkin = (rc, m, d) => {
  const concept = d.o.level?.landmark?.concept;
  if (concept === 'ice-palace') return palace(rc, m, d);
  if (concept === 'summit') return summitCave(rc, m, d);
  if (concept === 'frozen-wreck') return wreck(rc, m, d);
  if (concept === 'frozen-falls') return falls(rc, m, d);
  if (concept === 'ski-jump') return skiJump(rc, m, d);
  SHELLS.facade?.(rc, m, d);
};

export const GLACIER_SHELLS: NonNullable<ThemeSkins['deco']> = { facade };
