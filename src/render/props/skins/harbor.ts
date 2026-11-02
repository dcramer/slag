import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { type Level, T_EMPTY, T_ONEWAY, T_SOLID } from '../../../sim/level';
import { line, type P, stroke } from '../../ink';
import { ball, boxPts, dot, INK, ovalPts, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { circle, type RC } from '../../kit';
import { cannonTiming } from '../../../sim/props';
import type { DrawCtx } from '../common';
import { SHELLS } from '../modules/deco-shells';
import type { Cannon, CannonPose, Deco, DecoSkin, ThemeSkins } from './common';

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
function hz(d: DrawCtx) {
  const fog = d.o.level?.theme.fog;
  const k = fog ? `${fog.h | 0},${fog.l | 0}` : '-';
  const hsl = (c: HSL): HSL => (fog ? { h: c.h, s: c.s * (1 - HAZE), l: c.l + (fog.l - c.l) * HAZE } : c);
  return { k, hsl, c: (b: HSL, dl = 0, a = 1) => css(hsl(b), dl, a), ink: (b: HSL) => css({ h: b.h, s: b.s * 0.5, l: Math.max(5, hsl(b).l * 0.3) }) };
}
type Hz = ReturnType<typeof hz>;

function flat(g: CanvasRenderingContext2D, pts: readonly P[], base: HSL, t: Hz, seed: number, depth = 0.6) {
  tone(g, pts, t.hsl(base), { depth });
  pen(g, pts, seed, 0.3, 0.8, 3, t.ink(base));
}

/** A member with the backdrop pen: an ink ribbon with its tone over it. */
function spar(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, base: HSL, t: Hz, seed: number) {
  g.fillStyle = t.ink(base);
  line(g, ax, ay, bx, by, { w: w + 0.9, seed, taper: [0, 0], press: 0.05 });
  g.fillStyle = t.c(base);
  line(g, ax, ay, bx, by, { w, seed: seed + 1, taper: [0, 0], press: 0.05 });
}

const WOOD: HSL = { h: 26, s: 36, l: 30 };
const DARK: HSL = { h: 24, s: 30, l: 14 };
const CLOTH: HSL = { h: 40, s: 30, l: 78 };
const WASH: HSL = { h: 36, s: 18, l: 82 };
const BAND: HSL = { h: 2, s: 62, l: 42 };
const GLASS: HSL = { h: 196, s: 36, l: 30 };
const BRASS: HSL = { h: 42, s: 52, l: 46 };
const ROCK: HSL = { h: 210, s: 8, l: 18 };
const CRANE: HSL = { h: 40, s: 80, l: 50 };
const IRON: HSL = { h: 215, s: 10, l: 30 };

/** The level's tiles, read in tile coordinates (empty outside it). */
function tiles(level: Level | null | undefined) {
  return (x: number, y: number) => (!level || x < 0 || y < 0 || x >= level.w || y >= level.h ? T_EMPTY : level.tiles[y * level.w + x]);
}

/** A shell's box in tiles. */
function boxOf(m: Deco) {
  const x0 = Math.round(m.at[0] / TILE);
  const y0 = Math.round(m.at[1] / TILE);
  return { x0, y0, x1: x0 + Math.round(m.w / TILE) - 1, y1: y0 + Math.round(m.h / TILE) - 1 };
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

function galleonArt(m: Deco, d: DrawCtx, t: Hz) {
  const level = d.o.level;
  const at = tiles(level);
  const { x0, y0, x1, y1 } = boxOf(m);
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
    for (const [x, y] of inside) {
      g.fillStyle = t.c(DARK, (y & 1) * 3);
      g.fillRect(X(x) - 0.5, Y(y) - 0.5, TILE + 1, TILE + 1);
      g.fillStyle = t.ink(DARK);
      g.fillRect(X(x), Y(y) + TILE - 1, TILE, 0.6);
      if ((x - x0) % 3 === 0) g.fillRect(X(x) + 2, Y(y), 1.6, TILE);
      if (y === G + 2 && (x - x0) % 4 === 2) {
        flat(g, boxPts(X(x) + 3, Y(y) - 3, 10, 9, 0.6, x), { h: 210, s: 30, l: 40 }, t, x, 0.3);
        g.fillStyle = t.ink(IRON);
        circle(g, X(x) + 8, Y(y) + 1.5, 3);
        g.fillStyle = t.c(IRON, -8);
        circle(g, X(x) + 8, Y(y) + 1.5, 1.4);
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
      for (const s of [-1, 1]) {
        g.strokeStyle = t.ink(WOOD);
        g.lineWidth = 0.6;
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          g.moveTo(cx + s * k * 2, tip + 6 + k * 3);
          g.lineTo(cx + s * (2.5 * TILE + k * 4), Y(G));
          g.stroke();
        }
      }
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
    g.strokeStyle = t.ink(WOOD);
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(bx + s * 3.2 * TILE, by - 1.6 * TILE);
    const fore = [...masts.keys()].sort((a, b) => (bowNear ? a - b : b - a))[0];
    if (fore !== undefined) g.lineTo(X(fore) + TILE / 2, Y(masts.get(fore)!) - 2 * TILE);
    g.stroke();
    // The stern: lanterns at the taffrail's corners and windows down its face.
    const sx = bowNear ? X(x1 + 1) - 4 : X(x0) + 4;
    const sy = Y(bowNear ? farTop : nearTop);
    for (const k of [0, 1]) flat(g, boxPts(sx - 2.5 - s * k * 6, sy - 7, 5, 6, 1.2, k), BRASS, t, k + 40, 0.4);
  });
}

const hull: DecoSkin = (rc, m, d) => {
  if (d.o.level?.landmark?.concept !== 'galleon') return SHELLS.hull?.(rc, m, d);
  stamp(rc.s, galleonArt(m, d, hz(d)), m.at[0] + d.off[0], m.at[1] + d.off[1]);
};

// ---------------------------------------------------------------------------------------------- tidal pier

function pierArt(m: Deco, d: DrawCtx, t: Hz) {
  const level = d.o.level;
  const at = tiles(level);
  const { x0, y0, x1, y1 } = boxOf(m);
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
    // Trestles: a pair of legs every few columns from the boardwalk to the sand, braced crosswise.
    let prev: number | null = null;
    for (const [x, y] of walk) {
      if ((x - x0) % 4 !== 1) continue;
      const lx = X(x) + TILE / 2;
      const top = Y(y + 1);
      const bot = Y(sand.get(x)!);
      spar(g, lx, top, lx, bot, 2.4, WOOD, t, x);
      if (prev !== null && walk.has(prev)) {
        const px = X(prev) + TILE / 2;
        const pt = Y(walk.get(prev)! + 1);
        const pb = Y(sand.get(prev)!);
        spar(g, px, pt + 2, lx, bot - 2, 1, WOOD, t, x + 50);
        spar(g, px, pb - 2, lx, top + 2, 1, WOOD, t, x + 60);
      }
      prev = x;
    }
    // Railings along it, lamp posts every so often, bunting between their heads.
    const lamps: [number, number][] = [];
    for (const [x, y] of walk) {
      const ry = Y(y) - 7;
      g.fillStyle = t.ink(WOOD);
      g.fillRect(X(x) + 7, ry, 1.4, 7);
      g.fillStyle = t.c({ h: 40, s: 30, l: 90 });
      g.fillRect(X(x) - 0.5, ry - 0.6, TILE + 1, 1.4);
      if ((x - x0) % 7 === 3) lamps.push([X(x) + 8, Y(y)]);
    }
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

function lighthouseArt(m: Deco, t: Hz) {
  const { x0, y0, x1, y1 } = boxOf(m);
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
    g.fillStyle = t.c(WASH);
    g.fillRect(TILE * 0.5, roof + TILE, w - TILE, m.h - roof - TILE);
    const storey = Math.max(4, Math.round((y1 - y0 - 4) / 3)) * TILE;
    for (let y = roof + TILE + storey * 0.5, i = 0; y < m.h - TILE; y += storey, i++) {
      g.fillStyle = t.c(BAND, i % 2 ? -4 : 0);
      g.fillRect(TILE * 0.5, y, w - TILE, TILE * 0.9);
    }
    g.fillStyle = t.ink(WASH);
    for (let i = 0; i < 6; i++) {
      const fx = TILE + hash2(i, 3, m.seed) * (w - 2 * TILE);
      const fy = roof + TILE + hash2(i, 5, m.seed) * (m.h - roof - 2 * TILE);
      g.fillRect(fx, fy, 3, 0.7);
    }
  });
}

// -------------------------------------------------------------------------------------------- sea stack

function caveArt(m: Deco, t: Hz) {
  return sprite(`harbor|cave|${m.w}|${m.h}|${m.seed % 5}|${t.k}`, -2, -2, m.w + 4, m.h + 4, (g) => {
    // Only the mouth shows past the rock in front: dark inside, the light from the far side, weed hanging.
    const top = m.h - 3 * TILE;
    const mouth: P[] = [{ x: -1, y: m.h }];
    for (let i = 0; i <= 8; i++) mouth.push({ x: -1 + ((m.w + 2) * i) / 8, y: top + 2 - Math.sin((i / 8) * Math.PI) * 2 });
    mouth.push({ x: m.w + 1, y: m.h });
    flat(g, mouth, ROCK, t, 2, 0.4);
    g.fillStyle = t.c({ h: 200, s: 30, l: 50 }, 0, 0.45);
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
  const t = hz(d);
  const ox = m.at[0] + d.off[0];
  const oy = m.at[1] + d.off[1];
  if (concept === 'tidal-pier') stamp(rc.s, pierArt(m, d, t), ox, oy);
  else if (concept === 'lighthouse') stamp(rc.s, lighthouseArt(m, t), ox, oy);
  else if (concept === 'kraken-lagoon') stamp(rc.s, caveArt(m, t), ox, oy);
  else SHELLS.facade?.(rc, m, d);
};

// --------------------------------------------------------------------------------------------- the crane

function craneArt(m: Deco, d: DrawCtx, t: Hz) {
  const level = d.o.level;
  const at = tiles(level);
  const { x0, y0, x1, y1 } = boxOf(m);
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
      g.fillStyle = t.c(c, -10);
      for (let k = 2; k < TILE; k += 4) g.fillRect(X(x) + k, Y(y), 1.4, TILE);
    }
    for (const [x, y] of inside)
      for (const sgn of [-1, 1])
        if (!room.has(y * 4096 + x + sgn) && at(x + sgn, y) === T_EMPTY)
          flat(g, boxPts(sgn < 0 ? X(x) : X(x + 1) - 3, Y(y) - 1, 3, TILE + 2, 0.3, x + y), IRON, t, x + y, 0.3);
    // Legs at both ends: open lattice from the quay to the boom, hazard-striped feet.
    for (const lx of [TILE * 0.5, w - TILE * 0.5]) {
      for (const s of [-1, 1]) spar(g, lx + s * 5, boom, lx + s * 6.5, h, 2.2, CRANE, t, lx + s);
      for (let y = boom + 6, k = 0; y < h - 8; y += 12, k++) spar(g, lx - 5.5, y, lx + 5.5, y + 12, 0.9, CRANE, t, k + lx);
      g.fillStyle = t.c({ h: 0, s: 0, l: 12 });
      g.fillRect(lx - 9, h - 4, 18, 4);
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
    g.fillStyle = t.ink(IRON);
    g.fillRect(bx0, boom + 0.5, w - bx0, 1.2);
  });
}

const gantry: DecoSkin = (rc, m, d) => {
  if (d.o.level?.landmark?.concept !== 'container-terminal') return SHELLS.gantry?.(rc, m, d);
  stamp(rc.s, craneArt(m, d, hz(d)), m.at[0] + d.off[0], m.at[1] + d.off[1]);
};

// ------------------------------------------------------------------------------------------- harpoon gun

/** The harpoon itself, along +x from its butt: a shaft, a barbed iron head. */
function harpoon(g: CanvasRenderingContext2D, len: number) {
  g.fillStyle = INK;
  line(g, 0, 0, len, 0, { w: 2, seed: 3, taper: [0, 0], press: 0 });
  g.fillStyle = css(WOOD, 18);
  line(g, 0, 0, len, 0, { w: 1, seed: 3, taper: [0, 0], press: 0 });
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
  pen(s, body, 7, 0.5, 1.2);
  dot(s, -2, 0, 1.4, 8, css(d.pal.light));
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
