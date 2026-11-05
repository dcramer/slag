import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { type Level, T_EMPTY, T_ONEWAY, T_SOLID } from '../../../sim/level';
import { inkFor, line, type P, stroke } from '../../ink';
import { ball, barLine, boxPts, dot, glint, ovalPts, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import type { RC } from '../../kit';
import { cannonTiming } from '../../../sim/props';
import type { DrawCtx } from '../common';
import { SHELLS } from '../modules/deco-shells';
import { boxOf, type Cannon, type CannonPose, type Deco, type DecoSkin, flat, type Haze, hazer, type HazeSpec, type ThemeSkins } from './common';

/**
 * Harbor skins (docs/SETPIECES.md, Harbor): the backdrops behind its landmarks and its harpoon gun.
 *
 * Every backdrop reads its landmark off the level's own tiles inside the shell's box, so it fits whatever
 * the seed built: the galleon's masts stand where its yards are, its gun deck and great cabin are planked
 * where their rooms are; the pier's trestles stand under its boardwalk; the lighthouse is whitewashed and
 * banded inside, its lantern room on its roof; a sea stack's cave is dark rock behind its mouth; the crane's
 * legs stand on the quay at both ends of its boom. All of it is flat tones pulled toward the sky's haze
 * with a thin pen of their own dark: scenery, never a slab to stand on (docs/ART.md, Fair play).
 */

const HAZE = 0.26;
const SHELL: HazeSpec = { haze: HAZE, pen: { dark: 0.3, floor: 5 }, depth: 0.6 };

/** A member with the backdrop pen: its hazed tone in a thin rim of its own dark. */
function spar(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, base: HSL, t: Haze, seed: number) {
  barLine(g, ax, ay, bx, by, w, t.hsl(base), seed, { ink: t.ink(base), rim: 0.25, press: 0.05 });
}

/** A rope or stay in the backdrop: one tapered pen line in a dark of what it's made of, no rim. */
function stay(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, base: HSL, t: Haze, seed: number) {
  g.fillStyle = t.ink(base);
  line(g, ax, ay, bx, by, { w: 0.9, seed, taper: [0.05, 0.12], press: 0.25 });
}

const WOOD: HSL = { h: 26, s: 36, l: 30 };
/** The hold's planking in shadow: dark, but a dark of the wood, never black. */
const HOLD: HSL = { h: 26, s: 32, l: 29 };
const TAR: HSL = { h: 24, s: 18, l: 30 };
const CLOTH: HSL = { h: 40, s: 30, l: 78 };
const WASH: HSL = { h: 36, s: 18, l: 82 };
const BAND: HSL = { h: 2, s: 62, l: 42 };
const GLASS: HSL = { h: 196, s: 36, l: 30 };
const BRASS: HSL = { h: 42, s: 52, l: 46 };
const ROCK: HSL = { h: 210, s: 8, l: 25 };
const CRANE: HSL = { h: 40, s: 80, l: 50 };
const IRON: HSL = { h: 215, s: 10, l: 30 };

/** The level's tiles, read in tile coordinates (empty outside it). */
function tiles(level: Level | null | undefined) {
  return (x: number, y: number) => (!level || x < 0 || y < 0 || x >= level.w || y >= level.h ? T_EMPTY : level.tiles[y * level.w + x]);
}

/** A shell's box in tiles, as its first and last column and row. */
function cornersOf(m: Deco) {
  const { x, y, w, h } = boxOf(m);
  return { x0: x, y0: y, x1: x + w - 1, y1: y + h - 1 };
}

/**
 * Cells inside a box that are rooms: empty, under a solid roof within a few rows, over a solid floor within a
 * few rows. A doorway at either end of a room is still room: its posts are drawn at the run's ends.
 */
function rooms(at: (x: number, y: number) => number, x0: number, x1: number, y0: number, y1: number, reach = 5): [number, number][] {
  const out: [number, number][] = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (at(x, y) !== T_EMPTY) continue;
      let u = false;
      let f = false;
      for (let k = y - 1; k >= Math.max(y0 - 1, y - reach) && !u; k--) u = at(x, k) === T_SOLID;
      for (let k = y + 1; k <= Math.min(y1 + 1, y + reach) && !f; k++) f = at(x, k) === T_SOLID;
      if (u && f) out.push([x, y]);
    }
  return out;
}

// ------------------------------------------------------------------------------------------------- galleon

function galleonArt(m: Deco, d: DrawCtx, t: Haze) {
  const level = d.o.level;
  const at = tiles(level);
  const { x0, y0, x1, y1 } = cornersOf(m);
  const key = `harbor|galleon|${level?.seed}|${x0},${y0},${x1},${y1}|${t.k}`;
  return sprite(key, -4 * TILE, -2 * TILE, m.w + 8 * TILE, m.h + 2 * TILE, (g) => {
    const X = (tx: number) => tx * TILE - m.at[0];
    const Y = (ty: number) => ty * TILE - m.at[1];
    let G = y0;
    while (G < y1 && at(x0, G) !== T_SOLID) G++;
    // The rooms: the gun deck under the main deck and the great cabin under the quarterdeck, planked dark,
    // ribs every few columns, gunports with a gun's muzzle in each down the gun deck.
    const inside = rooms(at, x0, x1, y0, y1);
    const room = new Set(inside.map(([x, y]) => y * 4096 + x));
    // Each row of the hold a plank course in one of two tones; a seam here and there, never ruled.
    for (const [x, y] of inside) {
      g.fillStyle = t.c(HOLD, (y & 1) * 3);
      g.fillRect(X(x) - 0.5, Y(y) - 0.5, TILE + 1, TILE + 1);
    }
    for (const [x, y] of inside) {
      if (hash2(x, y, m.seed) < 0.45) {
        const sx = X(x) + 2 + hash2(y, x, m.seed) * 6;
        tick(g, sx, Y(y) + TILE - 1, sx + 5 + hash2(x, y, 3) * 4, Y(y) + TILE - 0.8, 0.45, x * 31 + y, t.ink(HOLD));
      }
      // Ribs: a lighter frame every third column, its shadow side cut in a darker tone.
      if ((x - x0) % 3 === 0) {
        g.fillStyle = t.c(HOLD, 7);
        g.fillRect(X(x) + 2, Y(y) - 0.5, 2.4, TILE + 1);
        g.fillStyle = t.c(HOLD, -4);
        g.fillRect(X(x) + 4.4, Y(y) - 0.5, 0.8, TILE + 1);
      }
      if (y === G + 2 && (x - x0) % 4 === 2) {
        flat(g, boxPts(X(x) + 3, Y(y) - 3, 10, 9, 0.6, x), { h: 210, s: 24, l: 40 }, t, x, 0.3);
        flat(g, ovalPts(X(x) + 8, Y(y) + 1.5, 2.6, 2.6, x, 0.04, 12), IRON, t, x + 1, 0.4);
        g.fillStyle = t.c(IRON, -12);
        path(g, ovalPts(X(x) + 8.2, Y(y) + 1.7, 1.3, 1.3, x + 2, 0.04, 10));
        g.fill();
      }
    }
    for (const [x, y] of inside) {
      // Door posts where a room opens onto the deck: the cutaway's frame, so its roof stands on something.
      for (const s of [-1, 1])
        if (!room.has(y * 4096 + x + s) && at(x + s, y) === T_EMPTY) {
          const px = s < 0 ? X(x) - 1 : X(x + 1) - 3;
          flat(g, boxPts(px, Y(y) - 1, 4, TILE + 2, 0.4, x + y), WOOD, t, x + y, 0.3);
        }
    }
    // Masts where the yards are: one-way runs above the deck, grouped by their middles.
    const masts = new Map<number, number>();
    for (let y = y0; y < G; y++) {
      for (let x = x0; x <= x1; x++) {
        if (at(x, y) !== T_ONEWAY || at(x - 1, y) === T_ONEWAY) continue;
        let e = x;
        while (at(e + 1, y) === T_ONEWAY) e++;
        if (e - x < 2) continue;
        const mx = Math.round((x + e) / 2);
        const near = [...masts.keys()].find((k) => Math.abs(k - mx) <= 1);
        const k = near ?? mx;
        masts.set(k, Math.min(masts.get(k) ?? y, y));
      }
    }
    for (const [mx, top] of masts) {
      const cx = X(mx) + TILE / 2;
      const tip = Y(top) - 2.4 * TILE;
      // Shrouds to the rails first, so the mast stands over them.
      for (const s of [-1, 1])
        for (let k = 0; k < 3; k++) stay(g, cx + s * k * 2, tip + 6 + k * 3, cx + s * (2.5 * TILE + k * 4), Y(G), WOOD, t, mx * 7 + k * s);
      spar(g, cx, Y(G), cx, tip, 3.2, WOOD, t, mx);
      spar(g, cx, tip, cx, tip - 10, 1.6, WOOD, t, mx + 3);
      // Sails furled on every yard down the mast.
      for (let y = top; y < G; y++) {
        let l = mx;
        let r = mx;
        if (at(mx, y) !== T_ONEWAY) continue;
        while (at(l - 1, y) === T_ONEWAY) l--;
        while (at(r + 1, y) === T_ONEWAY) r++;
        const bundle = boxPts(X(l) + 2, Y(y) + TILE - 2, (r - l + 1) * TILE - 4, 4.4, 2, y + mx, 0.3);
        flat(g, bundle, CLOTH, t, y, 0.5);
        for (let k = X(l) + 6; k < X(r + 1) - 4; k += 7) tick(g, k, Y(y) + TILE - 2, k + 1, Y(y) + TILE + 2.2, 0.5, k, t.ink(CLOTH));
      }
      // A pennant off the masthead.
      const pc = hash2(mx, 1, m.seed) < 0.5 ? BAND : { h: 214, s: 52, l: 40 };
      flat(g, poly(cx, tip - 10, cx + 13, tip - 7.5, cx, tip - 5), pc, t, mx + 9, 0.3);
    }
    // The bow: the end whose castle is lower carries the bowsprit, raking out and up past the hull.
    const topAt = (x: number) => {
      let y = y0;
      while (y < y1 && at(x, y) !== T_SOLID) y++;
      return y;
    };
    const nearTop = topAt(x0 + 3);
    const farTop = topAt(x1);
    const bowNear = nearTop > farTop;
    const bx = bowNear ? X(x0) : X(x1 + 1);
    const by = Y(bowNear ? nearTop : farTop) + 3;
    const s = bowNear ? -1 : 1;
    spar(g, bx - s * 6, by, bx + s * 3.2 * TILE, by - 1.6 * TILE, 2.6, WOOD, t, 77);
    // The forestay, from the bowsprit's tip to the foremast's head.
    const fore = [...masts.keys()].sort((a, b) => (bowNear ? a - b : b - a))[0];
    if (fore !== undefined) stay(g, bx + s * 3.2 * TILE, by - 1.6 * TILE, X(fore) + TILE / 2, Y(masts.get(fore)!) - 2 * TILE, WOOD, t, 78);
    // The stern: lanterns at the taffrail's corners and windows down its face.
    const sx = bowNear ? X(x1 + 1) - 4 : X(x0) + 4;
    const sy = Y(bowNear ? farTop : nearTop);
    for (const k of [0, 1]) flat(g, boxPts(sx - 2.5 - s * k * 6, sy - 7, 5, 6, 1.2, k), BRASS, t, k + 40, 0.4);
  });
}

const hull: DecoSkin = (rc, m, d) => {
  if (d.o.level?.landmark?.concept !== 'galleon') return SHELLS.hull?.(rc, m, d);
  stamp(rc.s, galleonArt(m, d, hazer(d, SHELL)), m.at[0] + d.off[0], m.at[1] + d.off[1]);
};

// ---------------------------------------------------------------------------------------------- tidal pier

function pierArt(m: Deco, d: DrawCtx, t: Haze) {
  const level = d.o.level;
  const at = tiles(level);
  const { x0, y0, x1, y1 } = cornersOf(m);
  return sprite(`harbor|pier|${level?.seed}|${x0},${y0},${x1},${y1}|${t.k}`, -4, -3 * TILE, m.w + 8, m.h + 3 * TILE + 4, (g) => {
    const X = (tx: number) => tx * TILE - m.at[0];
    const Y = (ty: number) => ty * TILE - m.at[1];
    // Where the boardwalk is over each column, and where the sand or the landing stage under it is.
    const walk = new Map<number, number>();
    const sand = new Map<number, number>();
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1 + 1; y++)
        if (at(x, y) === T_ONEWAY && at(x, y - 1) === T_EMPTY && !walk.has(x)) {
          walk.set(x, y);
          let b = y + 1;
          while (b < y1 + 2 && at(x, b) !== T_SOLID) b++;
          sand.set(x, b);
          break;
        }
    }
    // The waterline over the flat: wet sand darkening where the tide goes out, a lace of foam along its edge.
    const tideFlat = Math.max(...sand.values());
    for (const [x, y] of sand) {
      if (y !== tideFlat || at(x, y - 1) !== T_EMPTY) continue;
      // Opaque: a wash on the play layer inks into scrub.
      g.fillStyle = t.c({ h: 196, s: 30, l: 40 });
      g.fillRect(X(x) - 0.5, Y(y) - 2.2, TILE + 1, 2.2);
      if (hash2(x, 2, m.seed) < 0.6)
        glint(g, poly(X(x) + 2 + ((x * 3) % 5), Y(y) - 2.4, X(x) + 7 + ((x * 3) % 5), Y(y) - 2.6), t.c({ h: 196, s: 30, l: 86 }), 0.7, x);
    }
    // Pilings: tarred piles in pairs every few columns, driven into the sand under the boardwalk, braced
    // crosswise, a turn of rope round each a little over the sand.
    let prev: number | null = null;
    for (const [x, y] of walk) {
      if ((x - x0) % 4 !== 1) continue;
      const top = Y(y + 1);
      const bot = Y(sand.get(x)!) + 2;
      for (const dx of [3, 13]) {
        const lx = X(x) + dx;
        spar(g, lx, top, lx, bot, 3.4, TAR, t, x + dx);
        barLine(g, lx - 2.1, bot - 8.2, lx + 2.1, bot - 7.8, 1.4, t.hsl({ h: 38, s: 36, l: 56 }), x + dx + 5, { ink: t.ink(TAR), rim: 0.2 });
      }
      if (prev !== null && walk.has(prev)) {
        const px = X(prev) + 13;
        const pt = Y(walk.get(prev)! + 1);
        const pb = Y(sand.get(prev)!);
        spar(g, px, pt + 2, X(x) + 3, bot - 4, 1.2, WOOD, t, x + 50);
        spar(g, px, pb - 4, X(x) + 3, top + 2, 1.2, WOOD, t, x + 60);
      }
      prev = x;
    }
    // Railings along it, lamp posts every so often, bunting between their heads.
    const lamps: [number, number][] = [];
    const RAIL: HSL = { h: 40, s: 24, l: 78 };
    let r0: number | null = null;
    let rl = 0;
    const rail = (a: number, b: number, y: number) =>
      barLine(g, X(a) - 0.5, y, X(b + 1) + 0.5, y, 1.1, t.hsl(RAIL), a, { ink: t.ink(WOOD), rim: 0.25, lit: 8 });
    for (const [x, y] of walk) {
      const ry = Y(y) - 7;
      if (x % 2 === 0) spar(g, X(x) + 7, Y(y), X(x) + 7, ry, 1.2, RAIL, t, x);
      if ((x - x0) % 7 === 3) lamps.push([X(x) + 8, Y(y)]);
      // One rail per straight run of boardwalk at one height.
      if (r0 !== null && (walk.get(x - 1) !== y || x - 1 !== rl)) {
        rail(r0, rl, Y(walk.get(rl)!) - 7.3);
        r0 = null;
      }
      if (r0 === null) r0 = x;
      rl = x;
    }
    if (r0 !== null) rail(r0, rl, Y(walk.get(rl)!) - 7.3);
    for (const [lx, ly] of lamps) {
      spar(g, lx, ly, lx, ly - 2.6 * TILE, 1.4, IRON, t, lx | 0);
      flat(g, boxPts(lx - 3, ly - 2.6 * TILE - 6, 6, 6, 1, lx | 0), { h: 44, s: 60, l: 70 }, t, lx | 0, 0.3);
    }
    for (let i = 1; i < lamps.length; i++) {
      const [ax, ay] = lamps[i - 1];
      const [bx, by] = lamps[i];
      const a = { x: ax, y: ay - 2.6 * TILE + 1 };
      const b = { x: bx, y: by - 2.6 * TILE + 1 };
      const n = Math.max(3, Math.round((b.x - a.x) / 9));
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) / n;
        const px = a.x + (b.x - a.x) * u;
        const py = a.y + (b.y - a.y) * u + Math.sin(u * Math.PI) * 6;
        const c: HSL = [BAND, { h: 50, s: 80, l: 56 }, { h: 200, s: 60, l: 48 }][k % 3];
        flat(g, poly(px - 2.5, py, px + 2.5, py, px, py + 4.5), c, t, k, 0.2);
      }
    }
  });
}

// --------------------------------------------------------------------------------------------- lighthouse

function lighthouseArt(m: Deco, t: Haze) {
  const { x0, y0, x1, y1 } = cornersOf(m);
  return sprite(`harbor|light|${x0},${y0},${x1},${y1}|${m.seed}|${t.k}`, -6, -6, m.w + 12, m.h + 8, (g) => {
    const w = m.w;
    const roof = 4 * TILE;
    // The lantern room on the roof: brass-framed panes, a red dome with a ball on it.
    flat(g, boxPts(4, roof - 2.6 * TILE, w - 8, 2.6 * TILE, 1, 3), GLASS, t, 3, 0.3);
    for (let x = 4; x <= w - 4; x += (w - 8) / 3) spar(g, x, roof - 2.6 * TILE, x, roof, 1, BRASS, t, x | 0);
    const dome: P[] = [];
    for (let i = 0; i <= 10; i++) dome.push({ x: 2 + ((w - 4) * i) / 10, y: roof - 2.6 * TILE - Math.sin((i / 10) * Math.PI) * 12 });
    flat(g, dome, BAND, t, 4, 0.8);
    ball(g, w / 2, roof - 2.6 * TILE - 14, 2.2, t.hsl(BRASS), 5);
    // The tower inside: whitewash with a red band each storey, the plaster flaking at the seams.
    const tower = boxPts(TILE * 0.5, roof + TILE, w - TILE, m.h - roof - TILE, 1, 6, 0.3);
    tone(g, tower, t.hsl(WASH), { depth: 1.2 });
    g.save();
    path(g, tower);
    g.clip();
    const storey = Math.max(4, Math.round((y1 - y0 - 4) / 3)) * TILE;
    for (let y = roof + TILE + storey * 0.5, i = 0; y < m.h - TILE; y += storey, i++) {
      g.fillStyle = t.c(BAND, i % 2 ? -4 : 0);
      path(g, boxPts(0, y, w, TILE * 0.9, 0.3, i + 11, 0.5));
      g.fill();
    }
    // The tower's round: its far third in shade, cut with a hand's edge, the bands darker inside it.
    const sx = w * 0.68;
    const side: P[] = [{ x: sx, y: roof + TILE }];
    for (let y = roof + TILE; y <= m.h; y += 12) side.push({ x: sx + Math.sin(y * 0.11 + m.seed) * 0.8, y });
    side.push({ x: w, y: m.h }, { x: w, y: roof + TILE });
    g.save();
    path(g, side);
    g.clip();
    g.fillStyle = t.c(WASH, -12);
    g.fillRect(sx - 2, roof + TILE, w - sx + 2, m.h - roof);
    for (let y = roof + TILE + storey * 0.5, i = 0; y < m.h - TILE; y += storey, i++) {
      g.fillStyle = t.c(BAND, (i % 2 ? -4 : 0) - 10);
      path(g, boxPts(0, y, w, TILE * 0.9, 0.3, i + 11, 0.5));
      g.fill();
    }
    g.restore();
    for (let i = 0; i < 3; i++) {
      const fx = TILE + hash2(i, 3, m.seed) * (w - 2 * TILE);
      const fy = roof + TILE + hash2(i, 5, m.seed) * (m.h - roof - 2 * TILE);
      tick(g, fx, fy, fx + 3, fy + 0.4, 0.45, i, t.ink(WASH));
    }
    g.restore();
    pen(g, tower, 7, 0.3, 0.8, 3, t.ink(WASH));
  });
}

// -------------------------------------------------------------------------------------------- sea stack

function caveArt(m: Deco, t: Haze) {
  return sprite(`harbor|cave|${m.w}|${m.h}|${m.seed % 5}|${t.k}`, -2, -2, m.w + 4, m.h + 4, (g) => {
    // Only the mouth shows past the rock in front: dark inside, the light from the far side, weed hanging.
    const top = m.h - 3 * TILE;
    const mouth: P[] = [{ x: -1, y: m.h }];
    for (let i = 0; i <= 8; i++) mouth.push({ x: -1 + ((m.w + 2) * i) / 8, y: top + 2 - Math.sin((i / 8) * Math.PI) * 2 });
    mouth.push({ x: m.w + 1, y: m.h });
    flat(g, mouth, ROCK, t, 2, 0.4);
    g.fillStyle = t.c({ h: 200, s: 18, l: 30 });
    path(g, ovalPts(m.w / 2, m.h - TILE, m.w * 0.32, TILE * 0.9, m.seed, 0.1, 12));
    g.fill();
    for (let i = 0; i < 4; i++) {
      const wx = 3 + ((m.w - 6) * i) / 3;
      const len = 6 + ((m.seed >> i) % 7);
      g.fillStyle = t.c({ h: 120, s: 30, l: 28 });
      stroke(
        g,
        [
          { x: wx, y: top + 2 },
          { x: wx + Math.sin(i) * 1.5, y: top + 2 + len * 0.5 },
          { x: wx - 0.5, y: top + 2 + len },
        ],
        { w: 1.2, seed: i, taper: [0.1, 0.8], press: 0 },
      );
    }
  });
}

const facade: DecoSkin = (rc, m, d) => {
  const concept = d.o.level?.landmark?.concept;
  const t = hazer(d, SHELL);
  const ox = m.at[0] + d.off[0];
  const oy = m.at[1] + d.off[1];
  if (concept === 'tidal-pier') stamp(rc.s, pierArt(m, d, t), ox, oy);
  else if (concept === 'lighthouse') stamp(rc.s, lighthouseArt(m, t), ox, oy);
  else if (concept === 'kraken-lagoon') stamp(rc.s, caveArt(m, t), ox, oy);
  else SHELLS.facade?.(rc, m, d);
};

// --------------------------------------------------------------------------------------------- the crane

function craneArt(m: Deco, d: DrawCtx, t: Haze) {
  const level = d.o.level;
  const at = tiles(level);
  const { x0, y0, x1, y1 } = cornersOf(m);
  const reach = 5 * TILE;
  return sprite(`harbor|crane|${level?.seed}|${x0},${y0},${x1},${y1}|${m.seed % 4}|${t.k}`, -reach - 4, -4, m.w + reach + 8, m.h + 6, (g) => {
    const w = m.w;
    const h = m.h;
    const boom = 1.6 * TILE;
    // The open containers at the foot of the stacks: their far walls corrugated, a corner post at each end,
    // so a stack stands on its open box rather than over air.
    const X = (tx: number) => tx * TILE - m.at[0];
    const Y = (ty: number) => ty * TILE - m.at[1];
    const inside = rooms(at, x0, x1, y0, y1, 3);
    const room = new Set(inside.map(([x, y]) => y * 4096 + x));
    for (const [x, y] of inside) {
      const c: HSL = { h: [8, 206, 140, 36][(x0 + Math.floor((x - x0) / 5)) % 4], s: 40, l: 30 };
      g.fillStyle = t.c(c);
      g.fillRect(X(x) - 0.5, Y(y) - 0.5, TILE + 1, TILE + 1);
      // Corrugation as a second tone, not lines: two shadowed flutes a tile.
      g.fillStyle = t.c(c, -6);
      for (let k = 3; k < TILE; k += 8) g.fillRect(X(x) + k, Y(y) - 0.5, 3, TILE + 1);
    }
    for (const [x, y] of inside)
      for (const sgn of [-1, 1])
        if (!room.has(y * 4096 + x + sgn) && at(x + sgn, y) === T_EMPTY)
          flat(g, boxPts(sgn < 0 ? X(x) : X(x + 1) - 3, Y(y) - 1, 3, TILE + 2, 0.3, x + y), IRON, t, x + y, 0.3);
    // Legs at both ends: open lattice from the quay to the boom, hazard-striped feet.
    for (const lx of [TILE * 0.5, w - TILE * 0.5]) {
      for (const s of [-1, 1]) spar(g, lx + s * 5, boom, lx + s * 6.5, h, 2.2, CRANE, t, lx + s);
      for (let y = boom + 6, k = 0; y < h - 8; y += 12, k++) spar(g, lx - 5.5, y, lx + 5.5, y + 12, 0.9, CRANE, t, k + lx);
      flat(g, boxPts(lx - 9, h - 4, 18, 4, 0.5, lx | 0), { h: 30, s: 14, l: 24 }, t, lx | 0, 0.3);
      g.fillStyle = t.c(CRANE, 6);
      for (let k = -8; k < 9; k += 4) {
        path(g, poly(lx + k, h, lx + k + 2, h, lx + k + 4, h - 4, lx + k + 2, h - 4));
        g.fill();
      }
    }
    // The boom: a truss over the whole yard, out over the berth past the near leg.
    const bx0 = -reach;
    for (const y of [3, boom - 2]) spar(g, bx0, y, w, y, 2, CRANE, t, y);
    for (let x = bx0, k = 0; x < w; x += 10, k++) spar(g, x, k % 2 ? 3 : boom - 2, x + 10, k % 2 ? boom - 2 : 3, 0.9, CRANE, t, k + 9);
    // The machinery house over the far leg, its cab hanging under the boom.
    flat(g, boxPts(w - 3 * TILE, -TILE * 0.6, 2.4 * TILE, TILE * 0.9, 1, 4), CRANE, t, 4, 0.6);
    flat(g, boxPts(w - 2.4 * TILE, boom, 1.4 * TILE, TILE * 1.1, 1, 5), { h: 210, s: 10, l: 82 }, t, 5, 0.5);
    flat(g, boxPts(w - 2.2 * TILE, boom + 3, 1 * TILE, TILE * 0.5, 0.6, 6), GLASS, t, 6, 0.2);
    // The trolley's rails under the boom.
    spar(g, bx0, boom + 1.1, w, boom + 1.1, 1.2, IRON, t, 91);
  });
}

const gantry: DecoSkin = (rc, m, d) => {
  if (d.o.level?.landmark?.concept !== 'container-terminal') return SHELLS.gantry?.(rc, m, d);
  stamp(rc.s, craneArt(m, d, hazer(d, SHELL)), m.at[0] + d.off[0], m.at[1] + d.off[1]);
};

// ------------------------------------------------------------------------------------------- harpoon gun

/** The harpoon itself, along +x from its butt: a shaft, a barbed iron head. */
function harpoon(g: CanvasRenderingContext2D, len: number) {
  barLine(g, 0, 0, len, 0, 1.1, { ...WOOD, l: WOOD.l + 18 }, 3, { press: 0 });
  part(g, poly(len - 1, -1.2, len + 5, 0, len - 1, 1.2), { h: 210, s: 8, l: 70 }, 4, { depth: 0.3, thin: 0.35, thick: 0.7 });
  part(g, poly(len - 1, -1, len + 1.4, -3.4, len + 0.6, -0.4), { h: 210, s: 8, l: 60 }, 5, { depth: 0.2, thin: 0.3, thick: 0.6 });
  part(g, poly(len - 1, 1, len + 1.4, 3.4, len + 0.6, 0.4), { h: 210, s: 8, l: 60 }, 6, { depth: 0.2, thin: 0.3, thick: 0.6 });
}

/**
 * A whaler's harpoon gun: a swivel post on a timber block, the gun on its yoke, the line coiled in a tub. It
 * shows the harpoon in its muzzle while loaded; before it fires the line pays out of the tub and the barb
 * shivers, and for a while after it's fired the muzzle is empty.
 */
function harpoonGun(rc: RC, m: Cannon, d: DrawCtx, q: CannonPose) {
  const s = rc.s;
  const wood: HSL = { h: d.style.woodHue, s: 40, l: 34 };
  s.save();
  s.translate(q.x, q.gy);
  s.scale(q.dir, 1);
  part(s, boxPts(-6, -4, 12, 4, 0.8, 1), wood, 1, { depth: 0.6, thin: 0.45, thick: 1 });
  part(s, boxPts(-1.6, -9, 3.2, 5.4, 0.6, 2), d.pal.base, 2, { depth: 0.5, thin: 0.4, thick: 0.9 });
  // The line tub behind it, the coil showing.
  part(s, boxPts(-13, -6, 6, 6, 1.2, 3), wood, 3, { depth: 0.5, thin: 0.4, thick: 0.9 });
  s.fillStyle = css({ h: 38, s: 40, l: 62 });
  path(s, ovalPts(-10, -6, 2.6, 0.9, 4, 0.05, 10));
  s.fill();
  s.restore();
  s.save();
  s.translate(q.x, q.y);
  s.rotate(m.angle);
  if (Math.cos(m.angle) < 0) s.scale(1, -1);
  s.translate(-q.recoil * 0.6, 0);
  const L = m.length;
  // The gun: a short heavy barrel on its yoke, a stock and a grip behind.
  const body = poly(-8, -2.2, L - 6, -2.6, L - 4, -3, L - 4, 3, L - 6, 2.6, -8, 2.2, -11, 3.6, -12, 0, -11, -3.6);
  tone(s, body, d.pal.base, { depth: 1 });
  pen(s, body, 7, 0.45, 1.1, 3, inkFor(d.pal.base));
  dot(s, -2, 0, 1.2, 8, css(d.pal.light), inkFor(d.pal.base));
  const loaded = cannonTiming(m, rc.frame, d.r.phase).since > 40 || q.warn > 0;
  if (loaded) {
    s.save();
    s.translate(L - 8, 0);
    if (q.warn > 0) s.translate(Math.sin(rc.frame * 1.7) * q.warn * 0.8, 0);
    harpoon(s, 8);
    s.restore();
  }
  s.restore();
  if (q.warn > 0) {
    // The line paying out of the tub: the tell.
    s.fillStyle = css({ h: 38, s: 40, l: 70 });
    const tx = q.x - q.dir * 10;
    const ty = q.gy - 6;
    stroke(
      s,
      [
        { x: tx, y: ty },
        { x: (tx + q.mx) / 2, y: ty - 3 - q.warn * 2 },
        { x: q.mx, y: q.my },
      ],
      { w: 0.8, seed: 9, taper: [0, 0], press: 0 },
    );
  }
}

export const HARBOR: ThemeSkins = {
  deco: { hull, facade, gantry },
  cannon: { harpoon: harpoonGun },
};
