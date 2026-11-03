import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { type Level, T_EMPTY, T_ONEWAY, T_SOLID, tileAt } from '../../../sim/level';
import { FUSE_BLAST, fuseState, magnetCycle, type Module, type ModuleOf, swingAngles } from '../../../sim/props';
import { finTop, NOSE_ROWS, noseHalf } from '../../../gen/stage/space';
import { blob, inkFor, line, type P, stroke } from '../../ink';
import { barLine, boxPts, glint, ovalPts, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { bulb, circle, glowDot, light, type RC } from '../../kit';
import type { DrawCtx } from '../common';
import { SHELLS } from '../modules/deco-shells';
import { rope } from '../modules/setpiece';
import type { Cannon, CannonPose, Deco, DecoSkin, PieceSkin, RotorSkin } from './common';

/**
 * Space's stage concepts (gen/stage/space.ts), drawn: the backdrop shell behind each landmark (the deco
 * `facade`, chosen by the level's concept), the livery a few of them wear over their own tiles, and
 * space's own pieces drawn their own way on the shapes the sim moves and hurts with.
 *
 * - The Starship: its hangar bay through the hull, the bridge tower over its island (with the dice in the
 *   window), engine bells at the stern, nav lights, its registry on the flight deck's band.
 * - The Ring Station: the habitat ring rounded out behind its plating, the hub and spokes, the windows and
 *   the lettuce patch inside.
 * - The Planetoid: its moon's orbit, a thin atmosphere, the magma-lit tunnel, a flag and a rose under glass.
 * - The Launch Gantry: the service tower, umbilicals, the launch clamps and flame trench, and the rocket's
 *   paint over its tiles.
 * - The Mining Rig: the derrick over the drill shaft and the ribbed bore; the drill bit itself.
 * - The moon (a `rotor` look), the meteor glint (a `cannon` look), the airlock hatch (a pushing `magnet`) and
 *   the fuel cells (`fuse`).
 *
 * Shells are flat tones sunk toward the sky's haze with a thin pen of their own dark: scenery, never a slab
 * to stand on. Baked once; only what moves, warns or burns is live.
 */

const HAZE = 0.32;
function hz(d: DrawCtx) {
  const fog = d.o.level?.theme.fog;
  const k = fog ? `${fog.h | 0},${fog.l | 0}` : '-';
  const hsl = (c: HSL): HSL => (fog ? { h: c.h, s: c.s * (1 - HAZE), l: c.l + (fog.l - c.l) * HAZE } : c);
  return { k, hsl, c: (b: HSL, dl = 0, a = 1) => css(hsl(b), dl, a), ink: (b: HSL) => css({ h: b.h, s: b.s * 0.5, l: Math.max(4, hsl(b).l * 0.3) }) };
}
type Hz = ReturnType<typeof hz>;

const HULL: HSL = { h: 212, s: 10, l: 70 };
const PANEL: HSL = { h: 214, s: 12, l: 46 };
const DARK: HSL = { h: 232, s: 20, l: 19 };
const STRIPE: HSL = { h: 46, s: 88, l: 50 };
const RED: HSL = { h: 4, s: 68, l: 46 };
const GLASS: HSL = { h: 198, s: 46, l: 66 };
const LAMP: HSL = { h: 48, s: 90, l: 70 };
const MAGMA: HSL = { h: 20, s: 100, l: 55 };
const MOON: HSL = { h: 40, s: 6, l: 64 };
const WHITE: HSL = { h: 210, s: 8, l: 90 };

/** The shell's box in tiles. */
const boxOf = (m: Deco) => ({ x: Math.round(m.at[0] / TILE), y: Math.round(m.at[1] / TILE), w: Math.round(m.w / TILE), h: Math.round(m.h / TILE) });
const solid = (lv: Level, x: number, y: number) => tileAt(lv, x, y) === T_SOLID;

/** A member drawn with the backdrop pen: its hazed tone in a thin rim of its own dark. */
function member(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, base: HSL, t: Hz, seed: number) {
  barLine(g, ax, ay, bx, by, w, t.hsl(base), seed, { ink: t.ink(base), rim: 0.3, press: 0.05 });
}

/** The convex hull of a set of points (monotone chain), counter-clockwise. */
function hullOf(pts: P[]): P[] {
  const q = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: P, a: P, b: P) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: P[] = [];
  for (const p of q) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  const up: P[] = [];
  for (let i = q.length - 1; i >= 0; i--) {
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q[i]) <= 0) up.pop();
    up.push(q[i]);
  }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

/** A closed outline with its corners cut round (Chaikin), `n` times. */
function round(pts: readonly P[], n = 2): P[] {
  let r = pts.slice();
  for (let k = 0; k < n; k++) {
    const o: P[] = [];
    for (let i = 0; i < r.length; i++) {
      const a = r[i];
      const b = r[(i + 1) % r.length];
      o.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    r = o;
  }
  return r;
}

/** A vertical lattice mast: two chords and a zigzag of web. */
function mast(g: CanvasRenderingContext2D, x: number, y0: number, y1: number, w: number, base: HSL, t: Hz, seed: number) {
  for (const ox of [-w / 2, w / 2]) member(g, x + ox, y0, x + ox, y1, 1.3, base, t, seed + ox);
  let flip = false;
  for (let y = y1; y > y0 + 0.5; y -= w * 1.1) {
    const ya = Math.max(y0, y - w * 1.1);
    member(g, x + (flip ? w / 2 : -w / 2), y, x + (flip ? -w / 2 : w / 2), ya, 0.6, base, t, seed + y);
    member(g, x - w / 2, ya, x + w / 2, ya, 0.6, base, t, seed + y + 3);
    flip = !flip;
  }
}

/** A flat block of tone, hand-cut (its sides bow a little), no outline: a band, a window, an interior. */
function cut(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, r = 0.6) {
  path(g, boxPts(x, y, w, h, Math.min(r, w / 2, h / 2), seed, 0.15));
  g.fill();
}

/** A flat shape in a hazed tone, penned thin. */
function flat(g: CanvasRenderingContext2D, pts: readonly P[], base: HSL, t: Hz, seed: number, depth = 0.8) {
  tone(g, pts, t.hsl(base), { depth });
  pen(g, pts, seed, 0.3, 0.8, 3, t.ink(base));
}

/** Blinking nav light, red or green: a flat bulb, on half the time. */
function nav(rc: RC, x: number, y: number, col: HSL, phase: number) {
  const on = Math.floor(rc.t * 1.3 + phase) % 2 === 0;
  rc.s.fillStyle = inkFor(col);
  circle(rc.s, x, y, 1.5);
  rc.s.fillStyle = css(col, on ? 10 : -28);
  circle(rc.s, x, y, 1.05);
  if (on) {
    bulb(rc.g, x, y, 1.05, col, 1);
    light(rc, x, y, 26, col, 0.35);
  }
}

// ------------------------------------------------------------------------------------------------ starship

/** What the starship's tiles say about it: the deck row, the hangar's columns, the roof, the island. */
function shipPlan(lv: Level, b: ReturnType<typeof boxOf>) {
  let D = b.y;
  let most = -1;
  for (let y = b.y; y < b.y + b.h; y++) {
    let n = 0;
    for (let x = b.x; x < b.x + b.w; x++) if (solid(lv, x, y)) n++;
    if (n > most) {
      most = n;
      D = y;
    }
  }
  let h0 = -1;
  let h1 = -1;
  for (let x = b.x; x < b.x + b.w; x++) {
    const bay = !solid(lv, x, D - 1) && !solid(lv, x, D - 2) && !solid(lv, x, D - 3) && solid(lv, x, D - 4);
    if (bay && h0 < 0) h0 = x;
    if (bay) h1 = x;
  }
  const mid = Math.floor((h0 + h1) / 2);
  let roof = D - 4;
  while (roof > b.y && solid(lv, mid, roof - 1)) roof--;
  let i0 = -1;
  let i1 = -1;
  for (let x = h0; x <= h1; x++)
    if (solid(lv, x, roof - 1)) {
      if (i0 < 0) i0 = x;
      i1 = x;
    }
  let itop = roof;
  if (i0 >= 0) while (itop > b.y && solid(lv, i0, itop - 1)) itop--;
  return { D, h0, h1, roof, i0, i1, itop };
}

function shipBack(m: Deco, lv: Level, t: Hz) {
  const b = boxOf(m);
  const p = shipPlan(lv, b);
  return sprite(`space|ship|${b.x},${b.y},${b.w},${b.h}|${m.seed}|${t.k}|${p.h0},${p.h1},${p.i0},${p.roof}`, -TILE, 0, m.w + TILE * 3, m.h + TILE, (g) => {
    const X = (x: number) => (x - b.x) * TILE;
    const Y = (y: number) => (y - b.y) * TILE;
    if (p.h0 < 0) return;
    // The hull's belly behind its plating: the stepped tiles from the flight deck down, wrapped in one
    // rounded sweep a touch outside their corners, so the ship reads as a hull and not a stack of blocks.
    const corners: P[] = [];
    for (let y = p.D; y < b.y + b.h; y++)
      for (let x = b.x; x < b.x + b.w; x++)
        if (solid(lv, x, y)) corners.push({ x: X(x), y: Y(y) }, { x: X(x + 1), y: Y(y) }, { x: X(x), y: Y(y + 1) }, { x: X(x + 1), y: Y(y + 1) });
    if (corners.length > 2) {
      // A raked prow past the flight deck's bow end, under the deck, toward the green nav light.
      let bow = p.h1 + 1;
      while (bow < b.x + b.w && solid(lv, bow, p.D)) bow++;
      corners.push({ x: X(bow) + TILE * 0.9, y: Y(p.D) + TILE * 0.55 });
      const belly = round(hullOf(corners), 3).map((q) => ({ x: q.x, y: Math.max(q.y, Y(p.D) + 3) }));
      tone(g, belly, t.hsl({ ...HULL, l: HULL.l + 4 }), { depth: 2.2 });
      pen(g, belly, m.seed + 30, 0.3, 0.8, 4, t.ink(HULL));
    }
    // The bridge tower, standing up behind the island: a tall hull block, a band of windows, a mast.
    if (p.i0 >= 0) {
      const tx0 = X(p.i0) - 3;
      const tx1 = X(p.i1 + 1) + 3;
      const ty = Y(p.itop) - TILE * 3.2;
      const tower = boxPts(tx0, ty, tx1 - tx0, Y(p.roof) - ty, 2, m.seed, 0.1);
      flat(g, tower, HULL, t, m.seed + 1);
      const wy = ty + 5;
      g.fillStyle = t.c(DARK, 6);
      cut(g, tx0 + 3, wy, tx1 - tx0 - 6, 6, m.seed + 2);
      g.fillStyle = t.c(GLASS, 0);
      for (let x = tx0 + 4; x < tx1 - 5; x += 5) cut(g, x, wy + 1, 3.4, 4, x);
      // The fuzzy dice, hanging in the bridge window.
      g.fillStyle = t.ink(HULL);
      line(g, tx0 + 7, wy, tx0 + 7, wy + 3.2, { w: 0.4, seed: 4, taper: [0, 0], press: 0 });
      for (const [dx, dy] of [
        [-1.3, 3.4],
        [1, 4],
      ]) {
        g.fillStyle = '#f2efe6';
        g.fillRect(tx0 + 7 + dx - 1.1, wy + dy - 0.4, 2.2, 2.2);
        g.fillStyle = inkFor(WHITE);
        g.fillRect(tx0 + 7 + dx - 0.25, wy + dy + 0.45, 0.5, 0.5);
      }
      // The registry, stencilled under the windows.
      g.fillStyle = t.c(STRIPE, -4);
      cut(g, tx0 + 2, wy + 9, tx1 - tx0 - 4, 2.4, m.seed + 4);
      g.fillStyle = t.ink(HULL);
      g.font = 'bold 4px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(`SLG-${(m.seed % 90) + 10}`, (tx0 + tx1) / 2, wy + 15);
      // The mast.
      member(g, (tx0 + tx1) / 2 + 3, ty, (tx0 + tx1) / 2 + 3, ty - TILE * 1.4, 0.7, PANEL, t, 9);
      member(g, (tx0 + tx1) / 2 + 0.5, ty - TILE * 0.9, (tx0 + tx1) / 2 + 5.5, ty - TILE * 0.9, 0.5, PANEL, t, 10);
    }
    // The hangar bay through the hull: a dark interior, ribs on its back wall, a light strip, a parked
    // shuttle in shadow and hazard stripes along its floor.
    const bx0 = X(p.h0);
    const bx1 = X(p.h1 + 1);
    const by0 = Y(p.D - 3);
    const by1 = Y(p.D);
    g.fillStyle = t.c(DARK);
    cut(g, bx0, by0, bx1 - bx0, by1 - by0, m.seed + 5, 1.5);
    for (let x = bx0 + 10; x < bx1 - 4; x += 2 * TILE) {
      g.fillStyle = t.c(PANEL, -24);
      cut(g, x, by0, 4, by1 - by0, x);
    }
    g.fillStyle = t.c(LAMP, -10);
    for (let x = bx0 + 6; x < bx1 - 4; x += 3 * TILE) cut(g, x, by0 + 1, 7, 1.6, x + 1);
    const sx = (bx0 + bx1) / 2 + ((m.seed % 7) - 3) * 4;
    const shuttle = poly(sx - 14, by1 - 3, sx - 12, by1 - 12, sx + 2, by1 - 15, sx + 14, by1 - 9, sx + 15, by1 - 3);
    tone(g, shuttle, t.hsl({ ...PANEL, l: 22 }), { depth: 0.6 });
    for (let x = bx0; x < bx1; x += 6) {
      g.fillStyle = t.c(STRIPE, -14);
      path(g, poly(x, by1 - 2.4, x + 3, by1 - 2.4, x + 1.5, by1, x - 1.5, by1));
      g.fill();
    }
    // Engine bells at the stern, one per engine row, mouths aft.
    for (let r = p.roof; r < p.D - 3; r++) {
      const cy = Y(r) + TILE / 2;
      const ex = bx0;
      const bell = poly(ex, cy - 5, ex - 9, cy - 7.5, ex - 9, cy + 7.5, ex, cy + 5);
      flat(g, bell, PANEL, t, r);
      g.fillStyle = t.c(DARK, 4);
      path(g, ovalPts(ex - 9, cy, 1.6, 6.8, r, 0.02, 12));
      g.fill();
    }
  });
}

function shipLive(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return;
  const b = boxOf(m);
  const p = shipPlan(lv, b);
  if (p.h0 < 0) return;
  // Nav lights: red at the stern's top corner, green at the bow; a radar dish turning on the tower.
  nav(rc, p.h0 * TILE + 1, p.roof * TILE - 1, { h: 2, s: 100, l: 55 }, 0);
  nav(rc, (p.h1 + 1) * TILE - 2, p.roof * TILE + 1, { h: 130, s: 90, l: 48 }, 0.5);
  if (p.i0 >= 0) {
    const t = hz(d);
    const x = ((p.i0 + p.i1 + 1) / 2) * TILE - 4;
    const y = p.itop * TILE - TILE * 3.2 - 2;
    const w = 6 * Math.abs(Math.cos(rc.t * 1.2 + m.seed));
    rc.s.fillStyle = t.ink(HULL);
    path(rc.s, ovalPts(x, y, w + 0.6, 2.6, 3, 0.02, 12));
    rc.s.fill();
    rc.s.fillStyle = t.c(WHITE, -6);
    path(rc.s, ovalPts(x, y, w, 2, 3, 0.02, 12));
    rc.s.fill();
  }
}

/** The starship's flight deck band: its livery stripe and registry over the tiles of the hangar's roof. */
function shipLivery(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return;
  const p = shipPlan(lv, boxOf(m));
  if (p.h0 < 0) return;
  const s = rc.s;
  const y = (p.D - 4) * TILE + 4;
  const x0 = p.h0 * TILE + 3;
  const x1 = (p.h1 + 1) * TILE - 6;
  const col: HSL = { h: d.style.glowHue, s: 60, l: 48 };
  s.fillStyle = css(col);
  cut(s, x0, y + 2, x1 - x0, 3, m.seed + 6);
  s.fillStyle = css(col, -20);
  cut(s, x0, y + 5, x1 - x0, 1, m.seed + 7);
  s.fillStyle = css(WHITE, -4);
  s.font = 'bold 6px sans-serif';
  s.textAlign = 'left';
  s.textBaseline = 'middle';
  s.fillText(`SLG-${(m.seed % 90) + 10}`, x0 + 4, y + 9.5);
}

// ------------------------------------------------------------------------------------------------ ring station

function ringBack(m: Deco, t: Hz) {
  const b = boxOf(m);
  const Ro = (b.w - 5) / 2;
  const Ri = Ro - 2;
  return sprite(`space|ring|${b.w}|${b.h}|${m.seed}|${t.k}`, 0, 0, m.w, m.h, (g) => {
    const cx = (Ro + 2.5) * TILE;
    const cy = (Ro + 2.5) * TILE;
    // The ring rounded out: a band of hull a touch outside the plating, so its stepped edge reads round.
    const outer = ovalPts(cx, cy, (Ro + 0.62) * TILE, (Ro + 0.62) * TILE, m.seed, 0.004, 72);
    const inner = ovalPts(cx, cy, (Ri + 0.3) * TILE, (Ri + 0.3) * TILE, m.seed + 1, 0.004, 60);
    tone(g, outer, t.hsl({ ...HULL, l: HULL.l - 4 }), { depth: 2.4 });
    pen(g, outer, m.seed, 0.3, 0.8, 4, t.ink(HULL));
    // The ring's own plate seams, running round it: the stepped plating reads as bolted onto a round hull.
    g.fillStyle = t.c(HULL, -22);
    for (let i = 0; i < 20; i++) {
      if (hash2(i, 7, m.seed) < 0.3) continue;
      const a = (i / 20) * Math.PI * 2 + 0.08;
      const r0 = (Ri + 0.4) * TILE;
      const r1 = (Ro + 0.5) * TILE;
      line(g, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, {
        w: 0.6,
        seed: i + m.seed,
        taper: [0.2, 0.3],
        press: 0.3,
      });
    }
    // A lit rim along the crown, toward the light.
    g.fillStyle = t.c(HULL, 16);
    const lit: P[] = [];
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * (1.05 + (i / 14) * 0.6);
      lit.push({ x: cx + Math.cos(a) * (Ro + 0.42) * TILE, y: cy + Math.sin(a) * (Ro + 0.42) * TILE });
    }
    stroke(g, lit, { w: 1.1, seed: m.seed + 2, taper: [0.25, 0.35], press: 0.3 });
    // The habitat inside: dark, a band of windows round it, a lettuce patch by the floor.
    g.fillStyle = t.c(DARK, 2);
    path(g, inner);
    g.fill();
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const r = (Ri - 0.55) * TILE;
      g.fillStyle = hash2(i, 1, m.seed) < 0.7 ? t.c(LAMP, -18) : t.c(DARK, 10);
      cut(g, cx + Math.cos(a) * r - 1.4, cy + Math.sin(a) * r - 1.4, 2.8, 2.8, i);
    }
    const ga = Math.PI * (0.62 + (m.seed % 5) * 0.03);
    const gr = (Ri - 1.3) * TILE;
    const gx = cx + Math.cos(ga) * gr;
    const gy = cy + Math.sin(ga) * gr;
    const pane = boxPts(gx - 9, gy - 5, 18, 9, 2, m.seed + 3, 0.1);
    flat(g, pane, { h: 150, s: 30, l: 26 }, t, m.seed + 3, 0.4);
    for (let k = 0; k < 4; k++) {
      g.fillStyle = t.c({ h: 96, s: 55, l: 44 }, k % 2 ? 6 : -4);
      blob(g, gx - 6 + k * 4, gy + 1.5, 2.2, k + m.seed, 0.8, 0.35);
      g.fill();
    }
    // Spokes from the hub to the ring, and the hub, all behind the saws' rods.
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      member(g, cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, cx + Math.cos(a) * (Ri + 0.3) * TILE, cy + Math.sin(a) * (Ri + 0.3) * TILE, 1.6, PANEL, t, i + 20);
    }
    const hub = ovalPts(cx, cy, 8, 8, m.seed + 5, 0.01, 20);
    flat(g, hub, HULL, t, m.seed + 5);
    g.fillStyle = t.c(PANEL, -10);
    path(g, ovalPts(cx, cy, 4.2, 4.2, m.seed + 6, 0.01, 14));
    g.fill();
  });
}

function ringLive(rc: RC, m: Deco) {
  const b = boxOf(m);
  const Ro = (b.w - 5) / 2;
  const cx = (b.x + Ro + 2.5) * TILE;
  const cy = (b.y + Ro + 2.5) * TILE;
  // A docking beacon on the crown, and nav lights at the ring's widest.
  const on = Math.floor(rc.t * 2 + m.seed) % 3 === 0;
  bulb(rc.g, cx, cy - (Ro + 0.9) * TILE, 1.3, { h: 48, s: 100, l: 60 }, on ? 1 : 0.25);
  nav(rc, cx - (Ro + 0.8) * TILE, cy, { h: 2, s: 100, l: 55 }, 0);
  nav(rc, cx + (Ro + 0.8) * TILE, cy, { h: 130, s: 90, l: 48 }, 0.5);
}

// ------------------------------------------------------------------------------------------------ planetoid

function planetBack(m: Deco, lv: Level, t: Hz) {
  const b = boxOf(m);
  const Rm = (b.w - 3) / 2;
  const Rp = Rm - 3;
  const cxT = b.x + Rm + 1;
  const cyT = b.y + Rm + 1;
  let top = cyT - Rp - 2;
  while (top < cyT && !solid(lv, cxT, top)) top++;
  const rock = lv.theme.terrain.kind === 'regolith' ? lv.theme.terrain.base : { h: 32, s: 10, l: 40 };
  return sprite(`space|planet|${b.x},${b.y},${b.w}|${m.seed}|${t.k}|${top}`, 0, 0, m.w, m.h, (g) => {
    const cx = (Rm + 1.5) * TILE;
    const cy = (Rm + 1.5) * TILE;
    // Its atmosphere: one flat veil round it.
    g.fillStyle = t.c({ h: (rock.h + 180) % 360, s: 40, l: 60 }, 0, 0.22);
    path(g, ovalPts(cx, cy, (Rp + 1.3) * TILE, (Rp + 1.3) * TILE, m.seed, 0.01, 48));
    g.fill();
    // The moon's orbit, dotted.
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      g.fillStyle = t.c(WHITE, -6, 0.7);
      circle(g, cx + Math.cos(a) * Rm * TILE, cy + Math.sin(a) * Rm * TILE, 1.1);
    }
    // The world's body behind its rock, rounding off its stepped edge and showing as the tunnel's back
    // wall: one planet, not two slabs.
    const disk = ovalPts(cx, cy, (Rp + 0.75) * TILE, (Rp + 0.75) * TILE, m.seed + 2, 0.01, 56);
    tone(g, disk, t.hsl({ ...rock, l: Math.max(20, rock.l - 9) }), { depth: 1.4 });
    pen(g, disk, m.seed + 2, 0.3, 0.8, 4, t.ink(rock));
    // The tunnel through its equator: deeper rock, magma showing in its cracks.
    const ty0 = (cyT - 2 - b.y) * TILE;
    const tx0 = (cxT - Rp - b.x) * TILE;
    const tw = (2 * Rp + 1) * TILE;
    g.save();
    path(g, disk);
    g.clip();
    g.fillStyle = t.c({ ...rock, l: rock.l - 2 });
    cut(g, tx0 - TILE, ty0, tw + 2 * TILE, 3 * TILE, m.seed + 8);
    g.restore();
    for (let k = 0; k < Rp; k++) {
      const x = tx0 + hash2(k, 2, m.seed) * tw;
      g.fillStyle = css(MAGMA, -6, 0.7);
      line(g, x, ty0 + 3 + hash2(k, 3, m.seed) * 10, x + 4 + hash2(k, 4, m.seed) * 6, ty0 + 14 + hash2(k, 5, m.seed) * 20, {
        w: 0.8,
        seed: k,
        taper: [0.3, 0.3],
        press: 0,
      });
    }
    // A flag on the summit, and a rose under a glass dome beside it.
    const fx = (cxT - b.x) * TILE + 6;
    const fy = (top - b.y) * TILE;
    member(g, fx, fy, fx, fy - 26, 0.6, WHITE, t, 31);
    const cloth = poly(fx, fy - 26, fx + 12, fy - 23.5, fx + 11, fy - 18.5, fx, fy - 20);
    flat(g, cloth, RED, t, 32, 0.3);
    g.fillStyle = t.c(WHITE, 0);
    blob(g, fx + 5.5, fy - 22, 1.4, 33, 1, 0.2);
    g.fill();
    const dx = fx - 16;
    let dyT = top;
    while (dyT < cyT && !solid(lv, cxT - 1, dyT)) dyT++;
    const dy = (dyT - b.y) * TILE;
    member(g, dx, dy, dx, dy - 5, 0.3, { h: 120, s: 40, l: 34 }, t, 34);
    g.fillStyle = t.c(RED, 8);
    blob(g, dx, dy - 6, 1.6, 35, 1, 0.3);
    g.fill();
    const dome = poly(dx - 4.5, dy, dx - 4.5, dy - 6, dx - 3, dy - 9, dx, dy - 10, dx + 3, dy - 9, dx + 4.5, dy - 6, dx + 4.5, dy);
    g.fillStyle = t.c(GLASS, 10, 0.35);
    path(g, dome);
    g.fill();
    pen(g, dome, 36, 0.3, 0.6, 3, t.ink(GLASS));
  });
}

// ------------------------------------------------------------------------------------------------ launch gantry

/** The gantry's layout from its tiles: the pad, the rocket's columns and top, whether the tower has a lift shaft. */
function gantryPlan(lv: Level, b: ReturnType<typeof boxOf>) {
  const rt = b.y + 4;
  const D = b.y + b.h - 2;
  let rx0 = -1;
  for (let x = b.x; x < b.x + b.w; x++)
    if (solid(lv, x, rt) && solid(lv, x + 1, rt) && solid(lv, x + 2, rt)) {
      rx0 = x;
      break;
    }
  const shaft = tileAt(lv, b.x + 2, rt) === T_EMPTY && tileAt(lv, b.x + 4, rt) === T_ONEWAY;
  return { rt, D, rx0, rx1: rx0 + 2, s0: b.x, shaft };
}

function gantryBack(m: Deco, lv: Level, t: Hz) {
  const b = boxOf(m);
  const p = gantryPlan(lv, b);
  return sprite(`space|gantry|${b.x},${b.y},${b.w},${b.h}|${m.seed}|${t.k}|${p.rx0}|${p.shaft}`, 0, 0, m.w, m.h, (g) => {
    if (p.rx0 < 0) return;
    const X = (x: number) => (x - b.x) * TILE;
    const Y = (y: number) => (y - b.y) * TILE;
    const paint: HSL = { h: 8, s: 62, l: 48 };
    // The service tower: red lattice from the pad to over the access arm, a lightning mast on its top.
    const tw = p.shaft ? 4 : 2;
    const tx = X(p.s0) + (tw * TILE) / 2;
    const top = Y(p.rt) - TILE * 2;
    mast(g, X(p.s0) + 3, top, Y(p.D), 5, paint, t, 40);
    mast(g, X(p.s0 + tw) - 3, top, Y(p.D), 5, paint, t, 41);
    for (let y = Y(p.D) - TILE; y > top; y -= TILE * 2) member(g, X(p.s0) + 3, y, X(p.s0 + tw) - 3, y, 1, paint, t, y);
    member(g, tx, top, tx, top - TILE * 2.2, 0.6, PANEL, t, 42);
    // Umbilicals sagging from the tower to the rocket's flank.
    const ux = X(p.s0 + tw) - 2;
    for (const [k, r] of [
      [0, p.rt + 2],
      [1, p.rt + 4],
    ] as const)
      rope(g, ux, Y(r), X(p.rx0) + 1, Y(r) + 6 + k * 3, t.hsl({ h: 40, s: 10, l: 30 }), 1.4, 4);
    // The flame trench under the rocket: its dark, a deflector wedge, the launch clamps either side.
    const fx0 = X(p.rx0 - 1);
    const fx1 = X(p.rx1 + 2);
    g.fillStyle = t.c(DARK);
    cut(g, fx0, Y(p.D - 3), fx1 - fx0, 3 * TILE, m.seed + 9, 1.5);
    const mid = (fx0 + fx1) / 2;
    flat(g, poly(mid - 12, Y(p.D), mid, Y(p.D) - 9, mid + 12, Y(p.D)), { h: 30, s: 12, l: 30 }, t, 43, 0.4);
    for (const x of [fx0 + 3, fx1 - 3]) {
      member(g, x, Y(p.D), x, Y(p.D - 4) + 4, 2, PANEL, t, x);
      member(g, x, Y(p.D - 4) + 6, x + (x < mid ? 6 : -6), Y(p.D - 4) + 2, 1.2, PANEL, t, x + 1);
    }
  });
}

/** The rocket's paint over its own tiles: white, a roll pattern, the name down its side. Its nose and fins are `rocketTrim`. */
function rocketLivery(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return;
  const p = gantryPlan(lv, boxOf(m));
  if (p.rx0 < 0) return;
  const s = rc.s;
  const x0 = p.rx0 * TILE;
  const w = 3 * TILE;
  const y0 = p.rt * TILE;
  const y1 = (p.D - 3) * TILE;
  const body = boxPts(x0, y0, w, y1 - y0, 1.5, m.seed, 0.05);
  const paint: HSL = { ...WHITE, l: WHITE.l - 6 };
  tone(s, body, paint, { depth: 1.2 });
  // Round, not a slab: its far third in shade, cut by hand, and one lit stripe down the near side.
  s.save();
  path(s, body);
  s.clip();
  s.fillStyle = css(paint, -16);
  path(s, boxPts(x0 + w * 0.7, y0 - 2, w * 0.4, y1 - y0 + 4, 0.5, m.seed + 7, 0.6));
  s.fill();
  glint(s, poly(x0 + w * 0.22, y0 + 4, x0 + w * 0.2, (y0 + y1) / 2, x0 + w * 0.23, y1 - 6), css(paint, 10), 1.6, m.seed + 8);
  s.restore();
  // The roll pattern: black and white quarters in a band near the top.
  const by = y0 + TILE * 1.2;
  s.fillStyle = css({ h: 220, s: 12, l: 30 });
  cut(s, x0 + 1, by, w / 2 - 1, TILE * 0.8, 11);
  cut(s, x0 + w / 2, by + TILE * 0.8, w / 2 - 1, TILE * 0.8, 12);
  // The name, down its side.
  s.fillStyle = css(RED, -6);
  s.font = 'bold 7px sans-serif';
  s.textAlign = 'center';
  s.textBaseline = 'middle';
  const name = 'SLAG';
  for (let i = 0; i < name.length; i++) {
    const ly = by + TILE * 2.4 + i * 8;
    if (ly < y1 - 10) s.fillText(name[i], x0 + w / 2, ly);
  }
  s.fillStyle = css(RED, -2);
  cut(s, x0 + 1, y1 - 7, w - 2, 4, 13);
  pen(s, body, m.seed + 9, 0.45, 1.1, 3, inkFor(paint));
}

const TOWER: HSL = { h: 210, s: 8, l: 60 };

/**
 * The rocket's nose, fins and escape tower (`rocketTrim` in gen/stage/space.ts): the same curves its sub-tile
 * solids step along, so what you see is what you land on. The nose an ogive in red with its far side in shade,
 * the fins swept wedges, the tower a lattice mast.
 */
function rocketTrim(rc: RC, m: ModuleOf<'body'>, d: DrawCtx) {
  const s = rc.s;
  const rects = m.shape!;
  const [ox, oy] = d.off;
  const xs = rects.map((r) => r[0] + ox);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...rects.map((r) => r[0] + r[2] + ox));
  const y0 = Math.min(...rects.map((r) => r[1] + oy));
  const y1 = Math.max(...rects.map((r) => r[1] + r[3] + oy));
  const seed = (m.cells[0][0] * 31 + m.cells[0][1] * 7) | 0;
  if (m.cells.length > 1) {
    // The nose: its foot the body's width, its tip on the cells' top.
    const cx = (x0 + x1) / 2;
    const H = NOSE_ROWS * TILE;
    const at = (dir: number, v: number) => ({ x: cx + dir * noseHalf(v) * TILE, y: y1 - v * H });
    // Up the near side to the tip, then down the far one.
    const outline = Array.from({ length: 33 }, (_, i) => (i <= 16 ? at(-1, i / 16) : at(1, (32 - i) / 16)));
    part(s, outline, RED, seed, { depth: 0.9, thin: 0.4, thick: 1 });
    s.save();
    path(s, outline);
    s.clip();
    s.fillStyle = css(RED, -14);
    path(s, poly(cx + 3, y1 + 1, cx + 2, y1 - H * 0.55, cx + 30, y1 - H, cx + 30, y1 + 1));
    s.fill();
    s.restore();
    glint(s, poly(cx - 7.5, y1 - 3, cx - 5.5, y1 - H * 0.42, cx - 2.6, y1 - H * 0.72), css(RED, 22), 1.1, seed + 1);
    tick(s, cx - noseHalf(0.3) * TILE + 1.5, y1 - H * 0.3, cx + noseHalf(0.3) * TILE - 1.5, y1 - H * 0.3, 0.45, seed + 2, css(RED, -24));
    return;
  }
  if (x1 - x0 < TILE / 2) {
    // The escape tower: a mast on the tip, cross-braced, a cap.
    const cx = (x0 + x1) / 2;
    barLine(s, cx, y1 + 0.5, cx, y0 + 2.5, 1.6, TOWER, seed);
    tick(s, cx - 2.2, y1 - 2, cx + 2.2, y0 + 6, 0.45, seed + 1, inkFor(TOWER));
    tick(s, cx + 2.2, y1 - 2, cx - 2.2, y0 + 6, 0.45, seed + 2, inkFor(TOWER));
    part(s, poly(cx - 2.6, y0 + 3.2, cx, y0, cx + 2.6, y0 + 3.2), TOWER, seed + 3, { depth: 0.4, thin: 0.35, thick: 0.8 });
    return;
  }
  // A fin: against the body on the side its tallest step is, swept down and out.
  const left = rects[0][0] + ox > x0 + TILE / 2;
  const bodyX = left ? x1 : x0;
  const tipX = left ? x0 : x1;
  const top = y1 - TILE;
  const fin = poly(bodyX, top + finTop(0) * TILE, tipX, top + finTop(1) * TILE, tipX, y1, bodyX, y1);
  part(s, fin, RED, seed, { depth: 0.6, thin: 0.4, thick: 0.95 });
  tick(s, bodyX + (tipX - bodyX) * 0.2, y1 - 2.4, bodyX + (tipX - bodyX) * 0.85, y1 - 2.2, 0.4, seed + 1, css(RED, -24));
}

// ------------------------------------------------------------------------------------------------ mining rig

function rigPlan(lv: Level, b: ReturnType<typeof boxOf>) {
  const surf = b.y + 7;
  const D = b.y + b.h - 1;
  let dx = -1;
  for (let x = b.x + 2; x < b.x + b.w - 1; x++)
    if (!solid(lv, x, D - 4) && !solid(lv, x + 1, D - 4) && solid(lv, x - 1, D - 4)) {
      dx = x;
      break;
    }
  return { surf, D, dx, c0: b.x + 2, s1: b.x + b.w - 1 };
}

function rigBack(m: Deco, lv: Level, t: Hz) {
  const b = boxOf(m);
  const p = rigPlan(lv, b);
  return sprite(`space|rig|${b.x},${b.y},${b.w},${b.h}|${m.seed}|${t.k}|${p.dx}`, 0, 0, m.w, m.h, (g) => {
    const X = (x: number) => (x - b.x) * TILE;
    const Y = (y: number) => (y - b.y) * TILE;
    const rock = lv.theme.terrain.kind === 'regolith' ? lv.theme.terrain.base : { h: 32, s: 10, l: 40 };
    // The asteroid's body behind its rock, rounding off its stepped edge and showing as the bore's back
    // wall, so the rock above the bore and under it read as one lump.
    let topRow = p.D;
    for (let x = p.c0; x <= p.s1; x++) for (let y = p.surf - 2; y < topRow; y++) if (solid(lv, x, y)) topRow = y;
    // The lump wraps every rock tile of the rig, rounded, a few px proud of their stepped corners.
    const corners: P[] = [];
    for (let y = topRow; y <= p.D + 1; y++)
      for (let x = p.c0 - 2; x <= p.s1 + 1; x++)
        if (solid(lv, x, y)) corners.push({ x: X(x), y: Y(y) }, { x: X(x + 1), y: Y(y) }, { x: X(x), y: Y(y + 1) }, { x: X(x + 1), y: Y(y + 1) });
    const bx = (X(p.c0) + X(p.s1 + 1)) / 2;
    const by = (Y(topRow) + Y(p.D + 2)) / 2;
    const wrap =
      corners.length > 2 ? round(hullOf(corners), 3) : ovalPts(bx, by, (X(p.s1 + 1) - X(p.c0)) / 2, (Y(p.D + 2) - Y(topRow)) / 2, m.seed + 11, 0.05, 40);
    const body = wrap.map((q, i) => {
      const d = Math.hypot(q.x - bx, q.y - by) || 1;
      const k = 3 + 1.5 * hash2(i, 3, m.seed);
      return { x: q.x + ((q.x - bx) / d) * k, y: Math.max(Y(topRow) + 2, q.y + ((q.y - by) / d) * k) };
    });
    tone(g, body, t.hsl({ ...rock, l: rock.l + 8 }), { depth: 2 });
    pen(g, body, m.seed + 11, 0.3, 0.8, 4, t.ink(rock));
    // The bore: deeper rock, steel ribs holding its roof up, a lamp now and then.
    g.save();
    path(g, body);
    g.clip();
    g.fillStyle = t.c({ ...rock, l: rock.l - 2 });
    cut(g, X(p.c0) - TILE, Y(p.D - 3), X(p.s1 + 1) - X(p.c0) + 2 * TILE, 3 * TILE, m.seed + 10, 1.5);
    g.restore();
    for (let x = p.c0 + 1; x <= p.s1 - 1; x += 3) {
      member(g, X(x) + 8, Y(p.D), X(x) + 8, Y(p.D - 3) + 2, 1.6, PANEL, t, x);
      member(g, X(x) + 2, Y(p.D - 3) + 2, X(x) + 14, Y(p.D - 3) + 2, 1.4, PANEL, t, x + 50);
      g.fillStyle = t.c(LAMP, -6);
      circle(g, X(x) + 8, Y(p.D - 3) + 5, 1.1);
    }
    if (p.dx < 0) return;
    // The derrick: an A-frame over the shaft, its crown block at the top.
    const cx = X(p.dx + 1);
    const apex = Y(p.surf - 6);
    const footL = X(p.dx) - 9;
    const footR = X(p.dx + 2) + 9;
    let gl = p.surf - 1;
    while (gl < p.D && !solid(lv, p.dx - 1, gl)) gl++;
    let gr = p.surf - 1;
    while (gr < p.D && !solid(lv, p.dx + 2, gr)) gr++;
    const paint: HSL = { h: 44, s: 70, l: 46 };
    member(g, footL, Y(gl), cx - 2, apex, 1.6, paint, t, 60);
    member(g, footR, Y(gr), cx + 2, apex, 1.6, paint, t, 61);
    for (let k = 1; k < 4; k++) {
      const u = k / 4;
      const yl = Y(gl) + (apex - Y(gl)) * u;
      const yr = Y(gr) + (apex - Y(gr)) * u;
      member(g, footL + (cx - 2 - footL) * u, yl, footR + (cx + 2 - footR) * u, yr, 0.7, paint, t, 62 + k);
    }
    flat(g, ovalPts(cx, apex, 4, 4, m.seed, 0.02, 14), PANEL, t, 66);
    flat(g, boxPts(cx - 7, apex - 6, 14, 4, 1, 67), paint, t, 67, 0.4);
  });
}

function rigLive(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return;
  const p = rigPlan(lv, boxOf(m));
  if (p.dx < 0) return;
  // A floodlight on the derrick, aimed down the shaft.
  const x = (p.dx + 2) * TILE + 3;
  const y = (p.surf - 3) * TILE;
  bulb(rc.g, x, y, 1.6, LAMP, 1);
  light(rc, x - 6, y + 20, 60, LAMP, 0.4);
}

// ------------------------------------------------------------------------------------------------ the shell

/** Space's landmark shells: by the level's concept. */
export const spaceFacade: DecoSkin = (rc, m, d) => {
  const lv = d.o.level;
  const concept = lv?.landmark?.concept;
  const t = hz(d);
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  if (!lv) return SHELLS.facade?.(rc, m, d);
  if (concept === 'starship') {
    stamp(rc.s, shipBack(m, lv, t), x, y);
    return shipLive(rc, m, d);
  }
  if (concept === 'ring-station') {
    stamp(rc.s, ringBack(m, t), x, y);
    return ringLive(rc, m);
  }
  if (concept === 'planetoid') return stamp(rc.s, planetBack(m, lv, t), x, y);
  if (concept === 'launch-gantry') return stamp(rc.s, gantryBack(m, lv, t), x, y);
  if (concept === 'mining-rig') {
    stamp(rc.s, rigBack(m, lv, t), x, y);
    return rigLive(rc, m, d);
  }
  SHELLS.facade?.(rc, m, d);
};

// ------------------------------------------------------------------------------------------------ the moon

/** The planetoid's moon: a slab of grey moon rock exactly on the platform, cratered, lit along its top. */
export const moonSkin: RotorSkin = {
  support() {},
  link() {},
  hub() {},
  platform(rc, _m, d, _a, p, i) {
    const s = rc.s;
    const pts = boxPts(p.x, p.y, p.w, p.h, 3, d.r.pp.uid + i, 0.12);
    tone(s, pts, MOON, { depth: 1.2 });
    for (const [fx, fy, r] of [
      [0.28, 0.55, 2.2],
      [0.66, 0.4, 1.6],
      [0.85, 0.7, 1.1],
    ] as const) {
      s.fillStyle = css(MOON, -18);
      path(s, ovalPts(p.x + p.w * fx, p.y + p.h * fy, r, r * 0.7, i + r, 0.05, 10));
      s.fill();
    }
    glint(s, poly(p.x + 3, p.y + 1.2, p.x + p.w - 4, p.y + 1.2), 'rgba(255,255,255,0.7)', 0.6, i);
    pen(s, pts, 71 + i, 0.4, 1, 4, inkFor(MOON));
  },
};

// ------------------------------------------------------------------------------------------------ the meteor's glint

/** Where a meteor falls from: a glint in the sky that swells and sparks before each one. */
export function meteorRift(rc: RC, _m: Cannon, _d: DrawCtx, q: CannonPose) {
  const g = rc.g;
  const hot: HSL = { h: 34, s: 100, l: 66 };
  const r = 2 + q.warn * 5;
  const a = rc.t * 2;
  g.fillStyle = css(hot, 20, 0.5 + q.warn * 0.5);
  for (let k = 0; k < 2; k++) {
    const b = a + (k * Math.PI) / 2;
    const ca = Math.cos(b);
    const sa = Math.sin(b);
    path(
      g,
      poly(q.x - ca * r * 1.6, q.y - sa * r * 1.6, q.x - sa * 0.7, q.y + ca * 0.7, q.x + ca * r * 1.6, q.y + sa * r * 1.6, q.x + sa * 0.7, q.y - ca * 0.7),
    );
    g.fill();
  }
  if (q.warn > 0) glowDot(g, q.x, q.y, 4 + q.warn * 8, hot, 0.3 + q.warn * 0.5);
}

// ------------------------------------------------------------------------------------------------ pieces

type Magnet = ModuleOf<'magnet'>;
type Fuse = ModuleOf<'fuse'>;

/** An airlock hatch flush in the deck, a beacon post beside it; when it blows, the hatch is open and the air rushes out. */
function airlock(rc: RC, layer: number, m: Magnet, d: DrawCtx): boolean {
  const x = m.at[0] + d.off[0];
  const y = Math.round(m.at[1] / TILE) * TILE + d.off[1];
  const c = magnetCycle(m, rc.frame, d.r.phase);
  const on = c.seg === 2;
  const charge = c.seg === 1 ? c.t / c.len : 0;
  if (layer === 1) {
    const s = rc.s;
    const hatch = ovalPts(x, y - 0.6, 10, 2.6, d.r.pp.uid, 0.01, 18);
    part(s, hatch, { h: 214, s: 10, l: 52 }, 81, { depth: 0.5, thin: 0.4, thick: 0.9 });
    s.fillStyle = on ? css(DARK) : css(STRIPE, -8);
    path(s, ovalPts(x, y - 0.6, 7, 1.6, d.r.pp.uid + 1, 0.01, 14));
    s.fill();
    if (!on) for (const k of [-4, 0, 4]) tick(s, x + k - 1, y - 1.6, x + k + 1, y + 0.4, 0.6, k, inkFor(STRIPE));
    // The beacon post: amber, spinning while it warns, red while it blows.
    const bx = x + 13;
    tick(s, bx, y, bx, y - 7, 1.2, 82, css({ h: 214, s: 8, l: 40 }));
    const col: HSL = on ? { h: 2, s: 100, l: 55 } : { h: 40, s: 100, l: 58 };
    const lit = on || (c.seg === 1 && Math.sin(rc.t * 18) > 0);
    s.fillStyle = inkFor(col);
    circle(s, bx, y - 8.5, 1.9);
    s.fillStyle = css(col, lit ? 10 : -30);
    circle(s, bx, y - 8.5, 1.4);
    if (lit) {
      bulb(rc.g, bx, y - 8.5, 1.4, col, 1);
      light(rc, bx, y - 8.5, 30, col, 0.5);
    }
    return true;
  }
  if (layer === 3) {
    const g = rc.g;
    const R = m.radius;
    if (c.seg === 1) {
      // The tell: a dashed ring closing round the hatch at the radius it will throw from.
      g.fillStyle = css({ h: 40, s: 100, l: 60 }, 0, 0.3 + charge * 0.5);
      const n = Math.max(1, Math.round(12 * charge));
      for (let k = 0; k < n; k++)
        for (const side of [-1, 1]) {
          const a0 = side < 0 ? Math.PI + (k / 12) * Math.PI : -(k / 12) * Math.PI;
          const a1 = a0 + side * (Math.PI / 12) * 0.6;
          line(g, x + Math.cos(a0) * R, y + Math.sin(a0) * R, x + Math.cos(a1) * R, y + Math.sin(a1) * R, { w: 1.1, seed: k, taper: [0.2, 0.2], press: 0 });
        }
    }
    if (on) {
      const bg = rc.bg;
      for (let k = 0; k < 9; k++) {
        const a = Math.PI + (k / 8) * Math.PI;
        const u = (rc.t * 2.2 + k * 0.37) % 1;
        const r0 = 4 + u * R * 0.8;
        bg.fillStyle = `rgba(235,240,250,${0.45 * (1 - u)})`;
        line(bg, x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * (r0 + 9), y + Math.sin(a) * (r0 + 9), {
          w: 1.4,
          seed: k,
          taper: [0.2, 0.8],
          press: 0,
        });
      }
    }
    return true;
  }
  return false;
}

/** A fuel cell: a pressure tank filling its tile, white with a red band and a stencil; lit, its band flashes and it shakes. */
function fuelCell(rc: RC, m: Fuse, d: DrawCtx): boolean {
  const s = rc.s;
  const st = d.o.level ? fuseState(m, d.o.state, d.mi, rc.frame) : ({ mode: 'idle' } as const);
  const [ox, oy] = d.off;
  if (st.mode === 'gone') {
    for (const [cx, cy] of m.cells) {
      const x = cx * TILE + ox;
      const y = cy * TILE + oy;
      // Soot where it stood: a dark of the deck under it.
      rc.bg.fillStyle = css(d.o.level?.theme.terrain.dark ?? { h: 220, s: 12, l: 24 }, -8, 0.55);
      rc.bg.beginPath();
      rc.bg.ellipse(x + TILE / 2, y + TILE, 9, 2, 0, 0, Math.PI * 2);
      rc.bg.fill();
      rc.bg.fillStyle = 'rgba(235,240,250,0.3)';
      for (const yy of [y + 1.5, y + TILE - 1.5])
        for (let k = 0; k < 4; k++) line(rc.bg, x + 2 + k * 3.5, yy, x + 3.8 + k * 3.5, yy, { w: 0.8, seed: k, taper: [0.2, 0.2], press: 0 });
    }
    if (st.since < FUSE_BLAST * 2) {
      const [cx, cy] = m.cells[0];
      glowDot(rc.g, (cx + 0.5) * TILE + ox, (cy + 0.5) * TILE + oy, m.radius * TILE, { h: 36, s: 100, l: 62 }, 1 - st.since / (FUSE_BLAST * 2));
    }
    return true;
  }
  const lit = st.mode === 'lit';
  const through = lit ? 1 - st.left / m.count : 0;
  const shake = lit ? 0.3 + through * 1.1 : 0;
  const jx = lit ? (rc.frame & 1 ? shake : -shake) : 0;
  for (const [cx, cy] of m.cells) {
    const x = cx * TILE + ox + jx;
    const y = cy * TILE + oy;
    const tank = boxPts(x, y, TILE, TILE, 3, cx * 7 + cy, 0.06);
    part(s, tank, WHITE, cx + cy, { depth: 1, thin: 0.45, thick: 1 });
    const flash = lit && Math.sin(rc.t * (14 + through * 30)) > 0;
    s.fillStyle = css(RED, flash ? 18 : 0);
    cut(s, x + 1, y + 6, TILE - 2, 3.4, cx);
    s.fillStyle = inkFor(WHITE);
    s.font = 'bold 4.4px sans-serif';
    s.textAlign = 'center';
    s.textBaseline = 'middle';
    s.fillText('H2', x + TILE / 2, y + 12.2);
    // The valve on its top.
    cut(s, x + TILE / 2 - 1.5, y + 1, 3, 2, cy);
    if (flash) {
      bulb(rc.g, x + TILE / 2, y + 7.7, 2, RED, 0.8);
      light(rc, x + TILE / 2, y + 8, 24 + through * 20, RED, 0.4 + through * 0.4);
    }
    if (lit && rc.frame % 4 === 0) d.o.emit?.('spark', x + TILE / 2, y, (Math.random() - 0.5) * 40, -30 - Math.random() * 30, { h: 40, s: 100, l: 70 });
  }
  return true;
}

/** The mining rig's bit: an auger turning on the hazard's own circle, its cable up to the derrick's crown. */
function drillBit(rc: RC, m: ModuleOf<'swinger'>, d: DrawCtx): boolean {
  const s = rc.s;
  const x = m.hub[0] + d.off[0];
  const y = m.hub[1] + d.off[1];
  const R = m.radius;
  const crown = m.hub[1] - TILE * 1.5;
  const steel: HSL = { h: 210, s: 8, l: 62 };
  s.fillStyle = inkFor(steel);
  line(s, x, crown, x, y - R * 0.7, { w: 0.8, seed: 1, taper: [0, 0], press: 0 });
  part(s, boxPts(x - R * 0.55, y - R, R * 1.1, R * 0.5, 1, 2), { h: 44, s: 70, l: 46 }, 2, { depth: 0.5, thin: 0.4, thick: 0.9 });
  const cone = poly(x - R * 0.85, y - R * 0.5, x + R * 0.85, y - R * 0.5, x, y + R);
  part(s, cone, steel, 3, { depth: 0.8, thin: 0.45, thick: 1 });
  const turn = swingAngles(m, rc.frame, d.r.phase)[0];
  s.fillStyle = css(steel, -26);
  for (let k = 0; k < 3; k++) {
    const u = (((turn / (Math.PI * 2) + k / 3) % 1) + 1) % 1;
    const yy = y - R * 0.5 + u * R * 1.4;
    const half = R * 0.85 * (1 - u);
    line(s, x - half, yy, x + half, yy + R * 0.25, { w: 0.9, seed: k, taper: [0.2, 0.2], press: 0 });
  }
  s.fillStyle = inkFor(steel);
  blob(s, x, y + R - 1.2, 0.7, 4, 1, 0.1);
  s.fill();
  return true;
}

/** Space's own set pieces and landmark pieces, module by module. */
export const spacePiece: PieceSkin = (rc, layer, m: Module, d) => {
  const concept = d.o.level?.landmark?.concept;
  switch (m.type) {
    case 'magnet':
      return m.polarity < 0 && (layer === 1 || layer === 3) ? airlock(rc, layer, m, d) : false;
    case 'fuse':
      return layer === 1 ? fuelCell(rc, m, d) : false;
    case 'swinger':
      if (concept === 'mining-rig' && m.arm === 0) return layer === 2 ? drillBit(rc, m, d) : layer >= 0 && layer <= 3;
      return false;
    case 'body':
      if (concept !== 'launch-gantry' || !m.shape || d.r.pp.def.modules.some((x) => x.type !== 'body')) return false;
      if (layer === 1) rocketTrim(rc, m, d);
      return layer === 1;
    case 'deco':
      if (m.kind !== 'facade' || layer !== 0) return false;
      if (concept === 'launch-gantry') rocketLivery(rc, m, d);
      else if (concept === 'starship') shipLivery(rc, m, d);
      else return false;
      return true;
    default:
      return false;
  }
};
