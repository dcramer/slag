import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { T_EMPTY } from '../../../sim/level';
import { motionOffset, resolveProp } from '../../../sim/props';
import { line, type P, stroke } from '../../ink';
import { boxPts, ovalPts, pen, poly, sprite, stamp, tone } from '../../ink-props';
import { light } from '../../kit';
import type { DrawCtx } from '../common';
import { SHELLS } from '../modules/deco-shells';
import type { Deco, DecoSkin, ThemeSkins } from './common';

/**
 * Mine skins: the backdrop shells of its stage concepts (docs/SETPIECES.md, Mine), behind the landmark's
 * tiles on BACKDROP.
 *
 * - The Headframe's tower: timber legs and X-bracing down to the floor, an A-frame over the deck and the
 *   winding wheel at its top, turning as the cage travels, its rope running down to the shaft.
 * - The Trestle Line's bents: X-braced timber legs under the deck every few tiles, footed on sills.
 * - The Ore Crusher's works: the toothed crusher rolls turning behind the tunnel, the chute down to them,
 *   and the stack and headgear over the roof.
 * - The Crystal Geode's inside: a lining of crystal points, flat facets in the geode's own hue (nothing
 *   here is hot, so nothing glows).
 * - The Flooded Gallery's timbering: posts and caps along the back wall, the pump's pipe along the roof
 *   and its tide marks.
 *
 * All flat tones sunk toward the cave's haze with a thin pen of their own dark: scenery, never a slab to
 * stand on (docs/ART.md, Fair play). Baked once; only what turns is drawn live.
 */

const HAZE = 0.14;
function hz(d: DrawCtx) {
  const fog = d.o.level?.theme.fog;
  const k = fog ? `${fog.h | 0},${fog.l | 0}` : '-';
  const hsl = (c: HSL): HSL => (fog ? { h: c.h, s: c.s * (1 - HAZE), l: c.l + (fog.l - c.l) * HAZE } : c);
  return { k, hsl, c: (b: HSL, dl = 0, a = 1) => css(hsl(b), dl, a), ink: (b: HSL) => css({ h: b.h, s: b.s * 0.5, l: Math.max(5, hsl(b).l * 0.3) }) };
}
type Hz = ReturnType<typeof hz>;

const WOOD: HSL = { h: 28, s: 36, l: 36 };
const DARKWOOD: HSL = { h: 24, s: 30, l: 24 };
const IRON: HSL = { h: 214, s: 9, l: 40 };
const RUST: HSL = { h: 18, s: 40, l: 34 };
const DARK: HSL = { h: 26, s: 18, l: 11 };

/** A backdrop beam: a dark ribbon with its hazed tone over it. */
function beam(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, base: HSL, t: Hz, seed: number) {
  g.fillStyle = t.ink(base);
  line(g, ax, ay, bx, by, { w: w + 0.9, seed, taper: [0, 0], press: 0.05 });
  g.fillStyle = t.c(base);
  line(g, ax, ay, bx, by, { w, seed: seed + 1, taper: [0, 0], press: 0.05 });
}

/** A flat backdrop shape: its hazed tone and a thin pen of its own dark. */
function flat(g: CanvasRenderingContext2D, pts: readonly P[], base: HSL, t: Hz, seed: number, depth = 0.8) {
  tone(g, pts, t.hsl(base), { depth });
  pen(g, pts, seed, 0.3, 0.8, 3, t.ink(base));
}

/** A spoked wheel of radius `r`, baked once and turned live: rim, hub and spokes. */
function wheel(key: string, r: number, spokes: number, base: HSL, t: Hz, teeth = 0) {
  return sprite(`mine|wheel|${key}|${r}|${spokes}|${teeth}|${t.k}`, -r - 4, -r - 4, 2 * r + 8, 2 * r + 8, (g) => {
    const rim: P[] = [];
    const n = Math.max(24, teeth * 2);
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = teeth && i % 2 ? r + 2.4 : r;
      rim.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr });
    }
    if (teeth) flat(g, rim, base, t, 3, 0.6);
    else {
      g.fillStyle = t.ink(base);
      stroke(g, rim, { w: 3.2, seed: 4, taper: [0, 0], press: 0 });
      g.fillStyle = t.c(base, 4);
      stroke(g, rim, { w: 2, seed: 5, taper: [0, 0], press: 0 });
    }
    for (let i = 0; i < spokes; i++) {
      const a = (i / spokes) * Math.PI * 2;
      beam(g, 0, 0, Math.cos(a) * (r - 1), Math.sin(a) * (r - 1), teeth ? 1.6 : 0.9, teeth ? DARK : base, t, 9 + i);
    }
    flat(g, ovalPts(0, 0, r * 0.22 + 1, r * 0.22 + 1, 7, 0.02, 10), IRON, t, 7, 0.3);
  });
}

/** Turn and stamp a wheel sprite at (x, y). */
function turn(s: CanvasRenderingContext2D, sp: ReturnType<typeof wheel>, x: number, y: number, a: number) {
  s.save();
  s.translate(x, y);
  s.rotate(a);
  stamp(s, sp);
  s.restore();
}

// ------------------------------------------------------------------------------------------- headframe

/** Rows of A-frame over the deck (gen/stage/mine.ts FRAME). */
const FRAME = 6;

/** The tower: legs and bracing from the deck to the floor, the A-frame over it, the deck's bearers. */
function tower(m: Deco, t: Hz, shaft: number) {
  return sprite(`mine|headframe|${m.w}|${m.h}|${shaft}|${m.seed}|${t.k}`, -10, -6, m.w + 20, m.h + 8, (g) => {
    const deck = FRAME * TILE;
    const foot = m.h - TILE * 0.2;
    // Back legs under the deck, splayed a little, and X-bracing between them in panels.
    const L = TILE * 0.5;
    const R = m.w - TILE * 0.5;
    beam(g, L, deck, L - 4, foot, 2.6, WOOD, t, 1);
    beam(g, R, deck, R + 4, foot, 2.6, WOOD, t, 2);
    const panels = Math.max(2, Math.round((foot - deck) / (2.5 * TILE)));
    for (let i = 0; i < panels; i++) {
      const y0 = deck + ((foot - deck) * i) / panels;
      const y1 = deck + ((foot - deck) * (i + 1)) / panels;
      const lx = (y: number) => L - (4 * (y - deck)) / (foot - deck);
      const rx = (y: number) => R + (4 * (y - deck)) / (foot - deck);
      beam(g, lx(y0), y0, rx(y1), y1, 1.1, DARKWOOD, t, 10 + i);
      beam(g, rx(y0), y0, lx(y1), y1, 1.1, DARKWOOD, t, 20 + i);
      beam(g, lx(y1), y1, rx(y1), y1, 1.6, WOOD, t, 30 + i);
    }
    // The shaft's guides: two rails down from the deck to the floor either side of the cage.
    for (const x of [shaft - 1, shaft + 2 * TILE + 1]) beam(g, x, deck, x, foot, 1, IRON, t, 40 + x);
    // The A-frame over the deck, up to the wheel's bearing, and its back stay.
    const cx = shaft + TILE;
    const top = TILE * 1.2;
    beam(g, L + 6, deck, cx - 2, top, 2.4, WOOD, t, 50);
    beam(g, R - 6, deck, cx + 2, top, 2.4, WOOD, t, 51);
    beam(g, cx + 2, top, Math.min(R + 8, cx + 4.5 * TILE), deck, 2, DARKWOOD, t, 52);
    beam(g, (L + 6 + cx) / 2, (deck + top) / 2, (R - 6 + cx) / 2, (deck + top) / 2, 1.4, WOOD, t, 53);
    flat(g, boxPts(cx - 6, top - 1, 12, 3, 0.4, 54), DARKWOOD, t, 54, 0.4);
    for (const x of [L - 4, R + 4]) flat(g, boxPts(x - 4, foot - 2.5, 8, 2.5, 0.4, 55 + x), IRON, t, 55, 0.3);
  });
}

/** The shaft's left column: the gap in the deck under the shell's frame. */
function shaftOf(m: Deco, d: DrawCtx): number {
  const lv = d.o.level;
  const x0 = Math.round(m.at[0] / TILE);
  const deck = Math.round(m.at[1] / TILE) + FRAME;
  if (lv) for (let x = x0 + 1; x < x0 + Math.round(m.w / TILE) - 1; x++) if (lv.tiles[deck * lv.w + x] === T_EMPTY) return (x - x0) * TILE;
  return m.w / 2 - TILE;
}

const headframe: DecoSkin = (rc, m, d) => {
  const t = hz(d);
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const shaft = shaftOf(m, d);
  stamp(rc.s, tower(m, t, shaft), x, y);
  // The winding wheel turns with the cage: read the cage's height off its rail, so the wheel and the rope agree.
  const cage = d.o.level?.setPieces.find((p) => p.def.motion.type === 'rail' && p.def.key.endsWith(':headframe'));
  const r = TILE * 1.15;
  const cx = x + shaft + TILE;
  const cy = y + TILE * 1.2 - r * 0.3;
  const travel = cage ? -motionOffset(resolveProp(cage), rc.frame)[1] : 0;
  rc.s.fillStyle = t.ink(IRON);
  line(rc.s, cx + r, cy, cx + r, y + FRAME * TILE + 2, { w: 0.9, seed: 3, taper: [0, 0], press: 0 });
  turn(rc.s, wheel('sheave', r, 6, IRON, t), cx, cy, (travel / r) % (Math.PI * 2));
};

// ------------------------------------------------------------------------------------------- trestle

/** Bents under the deck every few tiles: two legs splayed onto a sill, X-braced, a cap under the deck. */
function bents(m: Deco, t: Hz) {
  return sprite(`mine|trestle|${m.w}|${m.h}|${m.seed}|${t.k}`, -8, -2, m.w + 16, m.h + 4, (g) => {
    const n = Math.max(2, Math.round(m.w / (4 * TILE)));
    const foot = m.h - 2;
    for (let i = 0; i <= n; i++) {
      const x = TILE * 0.5 + ((m.w - TILE) * i) / n + (hash2(i, 1, m.seed) - 0.5) * 4;
      for (const k of [-4, 4]) beam(g, x + k * 0.6, TILE, x + k * 1.5, foot, 2, WOOD, t, m.seed + i * 3 + k);
      beam(g, x - 6, foot - 3, x + 4, TILE + 4, 1, DARKWOOD, t, m.seed + i * 5);
      beam(g, x + 6, foot - 3, x - 4, TILE + 4, 1, DARKWOOD, t, m.seed + i * 7);
      beam(g, x - 7, TILE + 1.5, x + 7, TILE + 1.5, 2.2, WOOD, t, m.seed + i * 11);
      flat(g, boxPts(x - 8, foot - 1.5, 16, 2.5, 0.4, m.seed + i), DARKWOOD, t, m.seed + i, 0.3);
    }
    // A stringer along under the deck, tying the bents together.
    beam(g, 0, TILE * 2.4, m.w, TILE * 2.4, 1.2, DARKWOOD, t, m.seed + 99);
  });
}

const trestle: DecoSkin = (rc, m, d) => stamp(rc.s, bents(m, hz(d)), m.at[0] + d.off[0], m.at[1] + d.off[1]);

// ------------------------------------------------------------------------------------------- ore crusher

/** The works behind the house: the back wall in panels, the chute, the stack and headgear over the roof. */
function works(m: Deco, t: Hz) {
  return sprite(`mine|works|${m.w}|${m.h}|${m.seed}|${t.k}`, -6, -TILE * 3, m.w + 12, m.h + TILE * 3 + 2, (g) => {
    const roof = 4 * TILE;
    // The tunnel's back wall: riveted plates, dark.
    for (let x = 0; x < m.w; x += 2 * TILE) flat(g, boxPts(x + 0.5, m.h - 3.6 * TILE, 2 * TILE - 1, 3.6 * TILE - 2, 0.6, x), DARK, t, x, 0.6);
    // The stack over the roof, with a band, and a little headgear beside it.
    const sx = m.w * (0.7 + 0.15 * hash2(1, 2, m.seed));
    flat(g, boxPts(sx - 6, -TILE * 3, 12, roof + TILE * 3, 0.8, 3), RUST, t, 3, 1);
    flat(g, boxPts(sx - 7, -TILE * 2, 14, 3, 0.4, 4), IRON, t, 4, 0.4);
    const hx = m.w * 0.18;
    beam(g, hx - 10, roof, hx, roof - 2.4 * TILE, 1.6, IRON, t, 5);
    beam(g, hx + 10, roof, hx, roof - 2.4 * TILE, 1.6, IRON, t, 6);
    beam(g, hx - 5, roof - 1.2 * TILE, hx + 5, roof - 1.2 * TILE, 1, IRON, t, 7);
  });
}

const crusher: DecoSkin = (rc, m, d) => {
  const t = hz(d);
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  stamp(rc.s, works(m, t), x, y);
  // The rolls behind the tunnel, under the hopper: a pair of toothed drums turning into each other.
  const lv = d.o.level;
  let hop = m.w / 2;
  if (lv) {
    const roof = Math.round(m.at[1] / TILE) + 4;
    const x0 = Math.round(m.at[0] / TILE);
    for (let c = x0 + 1; c < x0 + Math.round(m.w / TILE) - 1; c++)
      if (lv.tiles[roof * lv.w + c] === T_EMPTY) {
        hop = (c - x0 + 1) * TILE;
        break;
      }
  }
  const r = TILE * 0.95;
  // In the hopper's throat, just over the tunnel: the house hides all but their bite.
  const cy = y + m.h - 4.5 * TILE;
  const a = rc.frame * 0.05;
  const roll = wheel('roll', r, 4, RUST, t, 10);
  turn(rc.s, roll, x + hop - r - 1, cy, a);
  turn(rc.s, roll, x + hop + r + 1, cy, -a + 0.3);
  light(rc, x + hop, y + m.h - TILE, 60, { h: 36, s: 80, l: 55 }, 0.25);
};

// ------------------------------------------------------------------------------------------- crystal geode

/**
 * The geode's inside: bands of agate following the dome in from its wall, darkening toward the hollow, and
 * a few clusters of crystal lying in the bottom corners. Nothing points out at you: the only spikes in a
 * geode are the ones that kill, on its floor.
 */
function lining(m: Deco, t: Hz, hue: HSL) {
  return sprite(`mine|geode|${m.w}|${m.h}|${m.seed}|${hue.h | 0}|${t.k}`, 0, 0, m.w, m.h, (g) => {
    const cx = m.w / 2;
    const base = m.h * 0.78;
    const bands = 5;
    for (let i = 0; i < bands; i++) {
      const k = 1 - i / bands;
      const rx = (m.w / 2) * k;
      const ry = m.h * 0.78 * k + TILE;
      const pts: P[] = [{ x: cx - rx, y: m.h }];
      for (let j = 0; j <= 24; j++) {
        const a = Math.PI + (j / 24) * Math.PI;
        pts.push({ x: cx + Math.cos(a) * rx, y: Math.min(m.h, base + Math.sin(a) * ry + Math.sin(j * 1.7 + i + m.seed) * 1.2) });
      }
      pts.push({ x: cx + rx, y: m.h });
      const c = i % 2 ? { ...hue, s: hue.s * 0.5, l: 22 + i * 2 } : { h: hue.h, s: hue.s * 0.25, l: 16 - i };
      tone(g, pts, t.hsl(c), { depth: 0.5 });
    }
    // Crystal lying in the bottom corners: low, blunt facets.
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++) {
        const bx = cx + side * (m.w * 0.3 + hash2(i, side + 2, m.seed) * m.w * 0.12);
        const by = m.h - 1;
        const h = 5 + hash2(i, 9, m.seed) * 6;
        const w = 3 + hash2(i, 8, m.seed) * 2;
        const lean = side * (1 + hash2(i, 7, m.seed) * 3);
        const pts = poly(bx - w, by, bx - w * 0.6 + lean, by - h, bx + w * 0.4 + lean, by - h - 1, bx + w, by);
        const c = { ...hue, l: hue.l - 14 + hash2(i, 5, m.seed) * 10 };
        tone(g, pts, t.hsl(c), { depth: 0.8 });
        pen(g, pts, i, 0.25, 0.6, 2, t.ink(c));
      }
  });
}

const geode: DecoSkin = (rc, m, d) => {
  const hue = d.o.level?.theme.terrain.vein ?? { h: 284, s: 60, l: 60 };
  stamp(rc.s, lining(m, hz(d), hue), m.at[0] + d.off[0], m.at[1] + d.off[1]);
};

// ------------------------------------------------------------------------------------------- flooded gallery

/** Timber sets along the gallery's back wall, the pump's pipe under its roof, a tide line on the posts. */
function timbering(m: Deco, t: Hz) {
  return sprite(`mine|gallery|${m.w}|${m.h}|${m.seed}|${t.k}`, -2, -2, m.w + 4, m.h + 4, (g) => {
    g.fillStyle = t.c(DARK, 1);
    g.fillRect(0, 0, m.w, m.h);
    for (let x = TILE * (1 + (m.seed % 2)); x < m.w - TILE; x += 3 * TILE) {
      beam(g, x - 6, m.h, x - 5, TILE * 0.6, 2.4, WOOD, t, x);
      beam(g, x + 6, m.h, x + 5, TILE * 0.6, 2.4, WOOD, t, x + 1);
      beam(g, x - 9, TILE * 0.6, x + 9, TILE * 0.6, 2.6, DARKWOOD, t, x + 2);
      // Where the water reaches: a stain across the posts.
      g.fillStyle = t.c(DARK, -3, 0.8);
      g.fillRect(x - 8, m.h - 2.2 * TILE, 16, 1.5);
    }
    beam(g, 0, TILE * 1.4, m.w, TILE * 1.4, 2, RUST, t, m.seed + 5);
    for (let x = TILE * 2; x < m.w; x += 4 * TILE) flat(g, boxPts(x - 2, TILE * 1.4 - 2.6, 4, 5.2, 0.4, x), IRON, t, x, 0.3);
  });
}

const gallery: DecoSkin = (rc, m, d) => stamp(rc.s, timbering(m, hz(d)), m.at[0] + d.off[0], m.at[1] + d.off[1]);

// ------------------------------------------------------------------------------------------- registry

const facade: DecoSkin = (rc, m, d) => {
  const concept = d.o.level?.landmark?.concept;
  if (concept === 'ore-crusher') return crusher(rc, m, d);
  if (concept === 'crystal-geode') return geode(rc, m, d);
  if (concept === 'flooded-gallery') return gallery(rc, m, d);
  SHELLS.facade?.(rc, m, d);
};

export const MINE: ThemeSkins = { deco: { headframe, trestle, facade } };
