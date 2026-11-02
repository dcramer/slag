import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { type Level, T_EMPTY, T_ONEWAY, T_SOLID, tileAt } from '../../../sim/level';
import { geyserColumn, geyserCycle, type Module, type ModuleOf, swingHeads, vehicleCols, vehiclePose } from '../../../sim/props';
import { blob, inkFor, line, type P, stroke } from '../../ink';
import { barLine, boxPts, glint, ovalPts, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { bulb, glowDot, light, type RC } from '../../kit';
import { beamOf, type DrawCtx } from '../common';
import { letterPts } from '../modules/neon';
import { SHELLS } from '../modules/deco-shells';
import type { Deco, DecoSkin, PieceSkin, ThemeSkins } from './common';

/**
 * Rooftops skins (docs/SETPIECES.md, Rooftops): the backdrop shells of the city's stage concepts, drawn as
 * the deco `facade` behind each landmark's tiles and chosen by the level's concept, and the city's own set
 * pieces drawn their own way on the shapes the sim moves and hurts with.
 *
 * - The Girder Works: the steel skeleton's columns and bracing down to the roof, the hoist's mast and a
 *   tower crane over it all, its trolley over the wrecking ball. The ball itself, on its chain.
 * - The Neon Billboard: the board's legs and bracing and its catwalk rail behind; in front, the ad pasted
 *   over the board's face and the spotlights under it.
 * - The Water Tower Row: steel legs and bracing under each tank, a ladder up the first; in front, the hoops
 *   round the tanks and the valve that bursts.
 * - The Clock Tower: the clockwork in the dark of the arch, the belfry frame on top; in front, the dial on
 *   the tower's face (it keeps the race's time), the brass pendulum and the bell.
 * - The El Station: the viaduct's steel bents down to the street and the station's canopy; the train.
 *
 * Shells are flat tones sunk toward the night's haze with a thin pen of their own dark, open lattice where
 * they're big: scenery, never a slab to stand on (docs/ART.md, Fair play), and calm, so the city behind
 * stays quiet. Baked once; only what moves, warns or lights up is live.
 */

const HAZE = 0.3;
function hz(d: DrawCtx, haze = HAZE) {
  const fog = d.o.level?.theme.fog;
  const k = fog ? `${fog.h | 0},${fog.l | 0},${haze}` : '-';
  const hsl = (c: HSL): HSL => (fog ? { h: c.h, s: c.s * (1 - haze), l: c.l + (fog.l - c.l) * haze } : c);
  return { k, hsl, c: (b: HSL, dl = 0, a = 1) => css(hsl(b), dl, a), ink: (b: HSL) => css({ h: b.h, s: b.s * 0.5, l: Math.max(4, hsl(b).l * 0.3) }) };
}
type Hz = ReturnType<typeof hz>;

const OXIDE: HSL = { h: 10, s: 44, l: 36 };
/** The site's red-oxide primer, a shade lighter than the decks so the frame behind them still reads. */
const PRIMER: HSL = { h: 10, s: 40, l: 42 };
const STEEL: HSL = { h: 212, s: 10, l: 44 };
const GREEN: HSL = { h: 150, s: 22, l: 30 };
const DARK: HSL = { h: 250, s: 18, l: 8 };
const BRASS: HSL = { h: 42, s: 56, l: 48 };
const BRONZE: HSL = { h: 30, s: 46, l: 36 };
const CREAM: HSL = { h: 42, s: 36, l: 84 };
const STONE: HSL = { h: 34, s: 9, l: 54 };
const WATER: HSL = { h: 200, s: 50, l: 60 };
const LAMP: HSL = { h: 44, s: 90, l: 68 };
const CONCRETE: HSL = { h: 30, s: 5, l: 50 };

/** A member drawn with the backdrop pen: its hazed tone in a thin rim of its own dark, a lit flange on a heavy one. */
function member(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, base: HSL, t: Hz, seed: number) {
  barLine(g, ax, ay, bx, by, w, t.hsl(base), seed, { ink: t.ink(base), rim: 0.3, press: 0.05, lit: w > 1.5 ? 12 : 0 });
}

/** An open lattice between two points: two chords and a zigzag of web. */
function truss(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, width: number, base: HSL, t: Hz, seed: number) {
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const nx = (-(by - ay) / len) * (width / 2);
  const ny = ((bx - ax) / len) * (width / 2);
  const n = Math.max(1, Math.round(len / (width * 1.15)));
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const k = i & 1 ? 1 : -1;
    member(g, ax + (bx - ax) * t0 + nx * k, ay + (by - ay) * t0 + ny * k, ax + (bx - ax) * t1 - nx * k, ay + (by - ay) * t1 - ny * k, 0.6, base, t, seed + i);
  }
  for (const k of [-1, 1]) member(g, ax + nx * k, ay + ny * k, bx + nx * k, by + ny * k, 1.2, base, t, seed + 50 + k);
}

/** A flat shape in a hazed tone, penned thin. */
function flat(g: CanvasRenderingContext2D, pts: readonly P[], base: HSL, t: Hz, seed: number, depth = 0.8) {
  tone(g, pts, t.hsl(base), { depth });
  pen(g, pts, seed, 0.3, 0.8, 3, t.ink(base));
}

/** Rows and columns of a shell's box, in tiles. */
const boxOf = (m: Deco) => ({ x: Math.round(m.at[0] / TILE), y: Math.round(m.at[1] / TILE), w: Math.round(m.w / TILE), h: Math.round(m.h / TILE) });

/** The roof row under column x: the first solid tile at or below `from`. */
function roofRow(lv: Level, x: number, from: number): number {
  for (let y = Math.max(0, from); y < lv.h; y++) if (tileAt(lv, x, y) === T_SOLID) return y;
  return lv.h;
}

// ------------------------------------------------------------------------------------------- girder works

/** The site's decks, read off the level: rows of girder across most of the box, with their extent. */
function decksOf(lv: Level, b: ReturnType<typeof boxOf>): { y: number; x0: number; x1: number }[] {
  const out: { y: number; x0: number; x1: number }[] = [];
  for (let y = b.y; y < b.y + b.h; y++) {
    let x0 = -1;
    let x1 = -1;
    let n = 0;
    for (let x = b.x; x < b.x + b.w; x++)
      if (tileAt(lv, x, y) === T_ONEWAY && tileAt(lv, x + 1, y) === T_ONEWAY) {
        n++;
        if (x0 < 0) x0 = x;
        x1 = x + 1;
      }
    if (n >= 5) out.push({ y, x0, x1 });
  }
  return out;
}

/**
 * The building going up: I-beam columns every few tiles from the roof to the top deck, bracing crossed in
 * some bays, the hoist's lattice mast up its shaft, and a tower crane, its mast at the end away from the
 * ball and its jib out over it, the trolley parked where the ball's chain hangs from.
 */
function girders(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return SHELLS.facade?.(rc, m, d);
  // The steel stands nearer than the city behind it: hazed less, so the frame reads at night.
  const t = hz(d, 0.16);
  const b = boxOf(m);
  const decks = decksOf(lv, b);
  if (!decks.length) return;
  const mid = b.x + Math.floor(b.w / 2);
  const G = roofRow(lv, decks[0].x0 + 2, decks[0].y + 1);
  const top = decks[decks.length - 1].y;
  const ball = d.r.mods.find((x): x is ModuleOf<'swinger'> => x.type === 'swinger');
  const hubX = ball ? ball.hub[0] : (mid + 0.5) * TILE;
  const hubY = ball ? ball.hub[1] : (top - 4) * TILE;
  // The hoist's shaft: the end with a slot in the roof.
  let shaft = -1;
  for (const x of [b.x, b.x + b.w - 2]) if (tileAt(lv, x, G) === T_EMPTY && tileAt(lv, x + 1, G) === T_EMPTY) shaft = x;
  const x0 = Math.min(...decks.map((k) => k.x0));
  const x1 = Math.max(...decks.map((k) => k.x1));
  const left = hubX / TILE > (x0 + x1) / 2;
  const key = `roof|girders|${b.x},${b.y},${b.w},${b.h}|${decks.map((k) => `${k.y}:${k.x0}-${k.x1}`).join(',')}|${shaft}|${hubX | 0},${hubY | 0}|${m.seed}|${t.k}`;
  const ox = b.x * TILE;
  const oy = b.y * TILE;
  const sp = sprite(key, -TILE * 3, -TILE * 2, m.w + TILE * 6, m.h + TILE * 2, (g) => {
    const X = (tx: number) => tx * TILE - ox;
    const Y = (ty: number) => ty * TILE - oy;
    const floor = Y(G);
    const deckTop = Y(top);
    // The tower crane: a lattice mast up past the top deck, the jib out over the ball, the counter-jib and
    // its weights back the other way, the operator's cab at the slewing ring.
    const mastX = left ? X(x0) + 6 : X(x1 + 1) - 6;
    const jibY = hubY - oy - 7;
    const peak = jibY - TILE * 1.6;
    const tip = left ? Math.max(hubX - ox + TILE * 2.5, mastX + TILE * 4) : Math.min(hubX - ox - TILE * 2.5, mastX - TILE * 4);
    const back = mastX + (left ? -1 : 1) * TILE * 2.6;
    truss(g, mastX, floor, mastX, jibY + 3, 9, OXIDE, t, 1);
    member(g, mastX - 4.5, jibY + 3, mastX, peak, 1, OXIDE, t, 3);
    member(g, mastX + 4.5, jibY + 3, mastX, peak, 1, OXIDE, t, 4);
    truss(g, back, jibY + 1, tip, jibY + 1, 5, { h: 46, s: 70, l: 46 }, t, 5);
    member(g, mastX, peak, tip - (tip - mastX) * 0.15, jibY - 1.5, 0.5, STEEL, t, 6);
    member(g, mastX, peak, back, jibY - 1.5, 0.5, STEEL, t, 7);
    flat(g, boxPts(back - (left ? 2 : 6), jibY + 3, 8, 6, 0.6, 8), CONCRETE, t, 8, 0.6);
    flat(g, boxPts(mastX - 5, jibY + 3, 10, 6, 0.8, 9), { h: 46, s: 60, l: 50 }, t, 9, 0.6);
    flat(g, boxPts(mastX - 3.5, jibY + 4.4, 7, 2.8, 0.4, 12), { h: 200, s: 20, l: 30 }, t, 12, 0.3);
    // The trolley on the jib, over where the chain hangs.
    flat(g, boxPts(hubX - ox - 4, jibY - 0.5, 8, 3.5, 0.5, 10), STEEL, t, 10, 0.4);
    member(g, hubX - ox, jibY + 3, hubX - ox, hubY - oy - 1, 0.5, STEEL, t, 11);
    // Columns every three tiles and at the ends, roof to top deck, a bolted splice plate at each deck.
    const cols: number[] = [];
    for (let x = x0; x <= x1 + 1; x += 3) cols.push(X(x));
    if (cols[cols.length - 1] < X(x1 + 1) - 8) cols.push(X(x1 + 1));
    for (const [i, cx] of cols.entries()) {
      member(g, cx, floor, cx, deckTop - 3, 3.4, PRIMER, t, 20 + i);
      for (const k of decks) flat(g, boxPts(cx - 2.6, Y(k.y) + 5, 5.2, 3.2, 0.4, 60 + i * 7 + k.y), PRIMER, t, 60 + i * 7 + k.y, 0.4);
    }
    // Bracing crossed in most bays of each storey, a beam under every deck between the columns.
    const levels = [G, ...decks.map((k) => k.y)];
    for (let s = 0; s + 1 < levels.length; s++)
      for (let i = 0; i + 1 < cols.length; i++) {
        const ya = Y(levels[s]);
        const yb = Y(levels[s + 1]) + 6;
        if (s) member(g, cols[i], ya + 6, cols[i + 1], ya + 6, 1.6, PRIMER, t, s * 40 + i + 30);
        if (hash2(i, s, m.seed) < 0.2) continue;
        member(g, cols[i] + 1.5, ya, cols[i + 1] - 1.5, yb, 0.9, PRIMER, t, s * 40 + i);
        member(g, cols[i] + 1.5, yb, cols[i + 1] - 1.5, ya, 0.9, PRIMER, t, s * 40 + i + 20);
      }
    // The hoist's mast up its shaft, past the top deck.
    if (shaft >= 0) truss(g, X(shaft) + TILE, floor, X(shaft) + TILE, deckTop - TILE * 2, TILE * 1.6, { h: 46, s: 50, l: 42 }, t, 30);
    // A plywood hoarding round the foot of it all, with a lamp or two on it.
    const hoard = boxPts(X(x0) - 2, floor - 7, X(x1 + 1) - X(x0) + 4, 7, 0.4, 40, 0.04);
    flat(g, hoard, { h: 38, s: 30, l: 46 }, t, 40, 0.4);
    for (let x = X(x0) + 12; x < X(x1 + 1) - 2; x += 24) tick(g, x, floor - 6.4, x + 0.3, floor - 0.6, 0.45, x, t.c({ h: 38, s: 30, l: 46 }, -16));
  });
  stamp(rc.s, sp, ox, oy);
  // Work lights on the crane's mast and the hoist, and the beacon on the jib's tip.
  const blink = Math.floor(rc.frame / 40) % 2 === 0;
  const mastX = left ? x0 * TILE + 6 : (x1 + 1) * TILE - 6;
  bulb(rc.g, mastX, hubY - 7 - TILE * 1.6, 1.1, { h: 4, s: 90, l: 55 }, blink ? 1 : 0.25);
  light(rc, mastX, G * TILE - 8, 50, LAMP, 0.5);
}

/** The wrecking ball: a lifting eye on a great dark iron ball, a hook block at the hub, the chain between. */
function wreckingBall(rc: RC, m: ModuleOf<'swinger'>, d: DrawCtx) {
  const s = rc.s;
  const hx = m.hub[0] + d.off[0];
  const hy = m.hub[1] + d.off[1];
  const [h] = swingHeads(m, rc.frame, d.r.phase, d.off);
  // The chain: links along the arm, alternately face on and edge on.
  const n = Math.max(4, Math.round(m.arm / 3.2));
  barLine(s, hx, hy, h.x, h.y, 0.6, { ...STEEL, l: STEEL.l - 14 }, 1, { rim: 0.4, taper: [0, 0], press: 0 });
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const x = hx + (h.x - hx) * u;
    const y = hy + (h.y - hy) * u;
    // Links alternately face on (a ring) and edge on (a bar), on the chain's own dark.
    if (i % 2) ring(s, x, y, 1.2, STEEL, i);
    else {
      s.fillStyle = css(STEEL, 4);
      line(s, x - Math.cos(h.a) * 1.4, y - Math.sin(h.a) * 1.4, x + Math.cos(h.a) * 1.4, y + Math.sin(h.a) * 1.4, { w: 0.7, seed: i, taper: [0, 0], press: 0 });
    }
  }
  // The hook block.
  part(s, boxPts(hx - 3, hy - 3.5, 6, 6, 1, 3, 0.15), { h: 46, s: 64, l: 46 }, 3, { depth: 0.5, thin: 0.35, thick: 0.9 });
  // The ball, its eye toward the chain.
  const R = m.radius * 0.85;
  ring(s, h.x - Math.cos(h.a) * (R + 1), h.y - Math.sin(h.a) * (R + 1), 1.6, STEEL, 5);
  orb(s, h.x, h.y, R, { h: 220, s: 8, l: 26 }, 7);
}

/** A round thing in two hand-cut tones, penned in a dark of itself, one glint on its lit side. */
function orb(g: CanvasRenderingContext2D, x: number, y: number, r: number, base: HSL, seed: number) {
  part(g, ovalPts(x, y, r, r, seed, 0.03, Math.max(10, Math.round(r * 2))), base, seed, { depth: Math.min(1.4, r * 0.25), thin: 0.4, thick: 1.1 });
  if (r > 2)
    glint(g, poly(x - r * 0.62, y - r * 0.05, x - r * 0.45, y - r * 0.48, x - r * 0.1, y - r * 0.64), css(base, 34, 0.7), Math.max(0.5, r * 0.12), seed);
}

/** A ring of iron (a link face on, a lifting eye). */
function ring(g: CanvasRenderingContext2D, x: number, y: number, r: number, base: HSL, seed: number) {
  const pts = ovalPts(x, y, r, r, seed, 0.03, 10);
  g.fillStyle = inkFor(base);
  stroke(g, [...pts, pts[0]], { w: 1.1, seed, taper: [0, 0], press: 0 });
  g.fillStyle = css(base, 10);
  stroke(g, [...pts, pts[0]], { w: 0.5, seed: seed + 1, taper: [0, 0], press: 0 });
}

/** A small filled spot: a rivet, a drip, a knob. */
function pip(g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, seed: number) {
  g.fillStyle = col;
  blob(g, x, y, r, seed, 1, 0.12);
  g.fill();
}

// ------------------------------------------------------------------------------------------- neon billboard

/** Behind the board: its legs, cross-braced, down to the roof, and the catwalk's guard rail under it. */
function billboardBack(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return SHELLS.billboard?.(rc, m, d);
  const t = hz(d);
  const b = boxOf(m);
  // The board's bottom row: the lowest solid row in the box's middle column.
  const mx = b.x + Math.floor(b.w / 2);
  let bb = b.y;
  while (bb + 1 < b.y + b.h && tileAt(lv, mx, bb + 1) === T_SOLID) bb++;
  const G = roofRow(lv, mx, bb + 1);
  const sp = sprite(`roof|bill|${b.x},${b.y},${b.w},${b.h}|${bb},${G}|${m.seed}|${t.k}`, -4, 0, m.w + 8, m.h + 2, (g) => {
    const Y = (ty: number) => (ty - b.y) * TILE;
    const legs = Math.max(2, Math.round(b.w / 6) + 1);
    const xs = Array.from({ length: legs }, (_, i) => 6 + ((m.w - 12) * i) / (legs - 1));
    for (const [i, x] of xs.entries()) {
      truss(g, x, Y(G), x, Y(bb + 1), 6, STEEL, t, i * 7);
      flat(g, boxPts(x - 4, Y(G) - 2, 8, 2.5, 0.4, i), CONCRETE, t, i, 0.3);
    }
    for (let i = 0; i + 1 < xs.length; i++) {
      member(g, xs[i], Y(G) - 3, xs[i + 1], Y(bb + 1) + 2, 0.6, STEEL, t, 40 + i);
      member(g, xs[i], Y(bb + 1) + 2, xs[i + 1], Y(G) - 3, 0.6, STEEL, t, 50 + i);
    }
    // The catwalk's rail along the board's foot.
    member(g, 0, Y(bb + 1) + 5, m.w, Y(bb + 1) + 5, 0.7, STEEL, t, 60);
    for (let x = 4; x < m.w; x += 10) member(g, x, Y(bb + 1), x, Y(bb + 1) + 5, 0.5, STEEL, t, 61 + x);
  });
  stamp(rc.s, sp, b.x * TILE, b.y * TILE);
}

/** An ad's paint, by the seed: a ground, a big shape, a headline. Calm colours a city sign would fade to. */
const ADS: readonly { ground: HSL; ink: HSL; accent: HSL; kind: number }[] = [
  { ground: { h: 46, s: 70, l: 52 }, ink: { h: 6, s: 60, l: 40 }, accent: { h: 4, s: 70, l: 48 }, kind: 0 },
  { ground: { h: 198, s: 40, l: 46 }, ink: { h: 40, s: 40, l: 90 }, accent: { h: 30, s: 70, l: 52 }, kind: 1 },
  { ground: { h: 350, s: 44, l: 44 }, ink: { h: 44, s: 60, l: 86 }, accent: { h: 44, s: 80, l: 60 }, kind: 2 },
  { ground: { h: 40, s: 26, l: 70 }, ink: { h: 220, s: 30, l: 22 }, accent: { h: 150, s: 40, l: 38 }, kind: 3 },
];

/** Each ad's headline, by its product: crate, soda, duck, burger. Generic goods, never a brand. */
const HEADLINES = ['CRATES', 'SODA', 'DUCKS', 'BURGER'];

/**
 * The ad pasted over the board's face (in front of its tiles, inside them): a ground, a seam or two where
 * the sheets meet, a big product shape (a crate, a cola bottle, a rubber duck, a burger) and a headline
 * of one hand-painted word, with a starburst for the price. No real brand: scrap sold back to the scrap.
 */
function billboardAd(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return;
  const b = boxOf(m);
  const mx = b.x + Math.floor(b.w / 2);
  let bb = b.y;
  while (bb + 1 < b.y + b.h && tileAt(lv, mx, bb + 1) === T_SOLID) bb++;
  let bt = bb;
  while (tileAt(lv, mx, bt - 1) === T_SOLID) bt--;
  let x0 = mx;
  while (tileAt(lv, x0 - 1, bb) === T_SOLID) x0--;
  let x1 = mx;
  while (tileAt(lv, x1 + 1, bb) === T_SOLID) x1++;
  const w = (x1 - x0 + 1) * TILE;
  const h = (bb - bt + 1) * TILE;
  const ad = ADS[m.seed % ADS.length];
  const sp = sprite(`roof|ad|${w}|${h}|${m.seed}`, 0, 0, w, h, (g) => {
    // The ground, inside the board's steel frame.
    const face = boxPts(2.5, 3, w - 5, h - 5.5, 0.6, m.seed, 0.05);
    tone(g, face, ad.ground, { depth: 0.8 });
    g.save();
    path(g, face);
    g.clip();
    // Paste seams.
    for (let x = 22 + (m.seed % 9); x < w - 6; x += 30) tick(g, x, 4, x + 0.4, h - 3, 0.45, x, css(ad.ground, -12));
    // The product, at one end.
    const px = ad.kind % 2 ? w - h * 0.62 : h * 0.62;
    const py = h * 0.55;
    const r = h * 0.34;
    if (ad.kind === 0) {
      // A crate, cartoon-big.
      const c = boxPts(px - r, py - r * 0.9, r * 2, r * 1.8, 1, 3, 0.1);
      part(g, c, { h: 30, s: 50, l: 48 }, 3, { depth: 1, thin: 0.4, thick: 1 });
      tick(g, px - r + 1, py - r * 0.9 + 1, px + r - 1, py + r * 0.9 - 1, 1, 4, css({ h: 30, s: 50, l: 30 }));
      tick(g, px - r, py, px + r, py, 0.8, 5, css({ h: 30, s: 50, l: 30 }));
    } else if (ad.kind === 1) {
      // A cola bottle, tilted.
      g.save();
      g.translate(px, py);
      g.rotate(0.35);
      const bottle = poly(
        -r * 0.32,
        r,
        -r * 0.4,
        -r * 0.1,
        -r * 0.14,
        -r * 0.5,
        -r * 0.12,
        -r * 1.05,
        r * 0.12,
        -r * 1.05,
        r * 0.14,
        -r * 0.5,
        r * 0.4,
        -r * 0.1,
        r * 0.32,
        r,
      );
      part(g, bottle, { h: 18, s: 50, l: 30 }, 6, { depth: 0.8, thin: 0.4, thick: 1 });
      g.fillStyle = css(ad.ink);
      g.fillRect(-r * 0.4, r * 0.05, r * 0.8, r * 0.3);
      glint(g, poly(-r * 0.22, r * 0.8, -r * 0.26, -r * 0.05), 'rgba(255,255,255,0.6)', 0.8);
      g.restore();
    } else if (ad.kind === 2) {
      // A rubber duck.
      part(g, ovalPts(px, py + r * 0.3, r, r * 0.62, 7, 0.04, 20), { h: 50, s: 90, l: 58 }, 7, { depth: 0.8, thin: 0.4, thick: 1 });
      part(g, ovalPts(px + r * 0.4, py - r * 0.4, r * 0.48, r * 0.46, 8, 0.04, 16), { h: 50, s: 90, l: 60 }, 8, { depth: 0.6, thin: 0.4, thick: 1 });
      part(g, poly(px + r * 0.8, py - r * 0.42, px + r * 1.25, py - r * 0.3, px + r * 0.8, py - r * 0.2), { h: 24, s: 90, l: 52 }, 9, {
        depth: 0.3,
        thin: 0.3,
        thick: 0.7,
      });
    } else {
      // A burger, stacked.
      const layers: [number, HSL][] = [
        [-0.55, { h: 34, s: 60, l: 56 }],
        [-0.05, { h: 110, s: 50, l: 40 }],
        [0.18, { h: 18, s: 40, l: 30 }],
        [0.5, { h: 34, s: 60, l: 52 }],
      ];
      for (const [i, [dy, c]] of layers.entries())
        part(g, ovalPts(px, py + dy * r, r, r * (i === 0 ? 0.45 : 0.22), 10 + i, 0.05, 18), c, 10 + i, { depth: 0.5, thin: 0.35, thick: 0.9 });
    }
    // The headline: one hand-painted word for what's sold, sized to the space beside the product.
    const word = HEADLINES[ad.kind];
    const hx0 = ad.kind % 2 ? 6 : h * 1.25;
    const room = (ad.kind % 2 ? w - h * 1.3 : w - 6) - hx0;
    const gh = Math.min(10, h * 0.28, room / (word.length * 0.84));
    const pitch = gh * 0.84;
    const hx1 = hx0 + word.length * pitch;
    g.fillStyle = css(ad.ink);
    for (let i = 0; i < word.length; i++)
      for (const [k, pts] of letterPts(word[i], hx0 + i * pitch, h * 0.28, gh * 0.62, gh).entries())
        stroke(g, pts, { w: Math.max(1, gh * 0.2), seed: m.seed + i * 5 + k, taper: [0.1, 0.16], press: 0.3 });
    if (h >= TILE * 3) {
      const sx = (hx0 + hx1) / 2;
      const sy = h * 0.72;
      const star: P[] = [];
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const rr = i % 2 ? gh * 0.6 : gh;
        star.push({ x: sx + Math.cos(a) * rr * 1.3, y: sy + Math.sin(a) * rr * 0.8 });
      }
      part(g, star, ad.accent, 12, { depth: 0.5, thin: 0.35, thick: 0.9 });
    }
    g.restore();
  });
  stamp(rc.s, sp, x0 * TILE + d.off[0], bt * TILE + d.off[1]);
}

/** The spotlights under the board: lamp heads on short arms off the catwalk, throwing light up the face. */
function spotlights(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return;
  const b = boxOf(m);
  const mx = b.x + Math.floor(b.w / 2);
  let bb = b.y;
  while (bb + 1 < b.y + b.h && tileAt(lv, mx, bb + 1) === T_SOLID) bb++;
  const y = (bb + 1) * TILE + 2;
  const n = Math.max(2, Math.round(b.w / 5));
  for (let i = 0; i < n; i++) {
    const x = b.x * TILE + ((i + 0.5) * m.w) / n;
    barLine(rc.s, x, y - 2, x, y + 3, 0.6, STEEL, i, { rim: 0.25 });
    part(rc.s, poly(x - 2.4, y + 3.4, x + 2.4, y + 3.4, x + 1.6, y + 0.6, x - 1.6, y + 0.6), { h: 210, s: 8, l: 30 }, i, { depth: 0.3, thin: 0.3, thick: 0.6 });
    bulb(rc.g, x, y + 0.8, 1.1, LAMP, 0.9);
    light(rc, x, y - TILE, 44, LAMP, 0.45);
  }
}

// ------------------------------------------------------------------------------------------- water towers

/** The tanks in the box, read off the level: each a run of solid columns hung over open air. */
function tanksOf(lv: Level, b: ReturnType<typeof boxOf>, G: number): { x0: number; x1: number; top: number; bot: number }[] {
  const out: { x0: number; x1: number; top: number; bot: number }[] = [];
  for (let x = b.x; x < b.x + b.w; x++) {
    let bot = G - 1;
    while (bot > b.y && tileAt(lv, x, bot) !== T_SOLID) bot--;
    if (bot <= b.y || bot >= G - 1 || tileAt(lv, x, G - 1) === T_SOLID) continue;
    let top = bot;
    while (tileAt(lv, x, top - 1) === T_SOLID) top--;
    const last = out[out.length - 1];
    if (last && last.x1 === x - 1 && last.bot === bot) {
      last.x1 = x;
      last.top = Math.min(last.top, top);
    } else out.push({ x0: x, x1: x, top, bot });
  }
  return out.filter((k) => k.x1 > k.x0);
}

/** Under each tank: four steel legs cross-braced down to the roof, a ladder up the first, an outflow pipe down. */
function towersBack(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return SHELLS.facade?.(rc, m, d);
  const t = hz(d);
  const b = boxOf(m);
  const G = b.y + b.h;
  const tanks = tanksOf(lv, b, G);
  const sp = sprite(
    `roof|towers|${b.x},${b.y},${b.w},${b.h}|${tanks.map((k) => `${k.x0}-${k.x1}:${k.bot}`).join(',')}|${t.k}`,
    -4,
    0,
    m.w + 8,
    m.h + 2,
    (g) => {
      const X = (tx: number) => (tx - b.x) * TILE;
      const Y = (ty: number) => (ty - b.y) * TILE;
      for (const [i, k] of tanks.entries()) {
        const a = X(k.x0) + 2.5;
        const z = X(k.x1 + 1) - 2.5;
        const under = Y(k.bot + 1);
        const floor = Y(G);
        // Inner legs behind, hazed further; outer legs splayed a little.
        for (const [x, y] of [
          [a + 4, under],
          [z - 4, under],
        ])
          member(g, x, y, x, floor, 1.1, STEEL, t, i * 9 + x);
        member(g, a, under, a - 2, floor, 1.6, STEEL, t, i * 9 + 1);
        member(g, z, under, z + 2, floor, 1.6, STEEL, t, i * 9 + 2);
        // Bracing: a tie rod across under the tank and an X between the outer legs.
        const midY = (under + floor) / 2;
        member(g, a - 1, midY, z + 1, midY, 0.6, STEEL, t, i * 9 + 3);
        member(g, a, under + 2, z + 1.4, floor - 3, 0.45, STEEL, t, i * 9 + 4);
        member(g, z, under + 2, a - 1.4, floor - 3, 0.45, STEEL, t, i * 9 + 5);
        // The outflow pipe, down the middle.
        member(g, (a + z) / 2, under, (a + z) / 2, floor - 1, 1.4, { h: 200, s: 6, l: 36 }, t, i * 9 + 6);
        for (const x of [a - 2, z + 2]) flat(g, boxPts(x - 2.5, floor - 2, 5, 2.4, 0.3, i * 9 + x), CONCRETE, t, i + x, 0.3);
      }
    },
  );
  stamp(rc.s, sp, b.x * TILE, b.y * TILE);
}

const STAVE: HSL = { h: 26, s: 30, l: 38 };
const HOOP: HSL = { h: 212, s: 8, l: 34 };

/**
 * Each tank drawn over its own tiles: upright staves, darker toward both sides so it reads round, three
 * iron hoops, and its lid a short drum of shingles on the narrower top row, exactly the shape you stand on.
 */
function tankBodies(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return;
  const b = boxOf(m);
  const tanks = tanksOf(lv, b, b.y + b.h);
  for (const [i, k] of tanks.entries()) {
    const w = (k.x1 - k.x0 + 1) * TILE;
    const h = (k.bot - k.top + 1) * TILE;
    const sp = sprite(`roof|tank|${w}|${h}|${i % 3}`, -1, -1, w + 2, h + 2, (g) => {
      // The lid: the top row, a tile in from each side.
      const LID: HSL = { h: 200, s: 12, l: 38 };
      const lid = boxPts(TILE + 0.4, 0.3, w - 2 * TILE - 0.8, TILE + 1, 1.4, i + 1, 0.2);
      part(g, lid, LID, i + 1, { depth: 0.7, thin: 0.35, thick: 0.9 });
      // Its shingles: a course line and a few lifted joints, not a ruled field.
      tick(g, TILE + 2, TILE * 0.45, w - TILE - 2, TILE * 0.5, 0.4, i + 3, css(LID, -16));
      for (let x = TILE + 5 + (i % 3) * 2; x < w - TILE - 3; x += 9) tick(g, x, 2.5, x + 0.3, TILE * 0.42, 0.35, x + i, css(LID, -16));
      // The barrel: staves under hoops.
      const body = boxPts(0.4, TILE, w - 0.8, h - TILE - 0.4, 1.2, i + 2, 0.15);
      part(g, body, STAVE, i + 2, { depth: 1.2, thin: 0.4, thick: 1.1 });
      g.save();
      path(g, body);
      g.clip();
      // It reads round: a shade cut down the far side and a lit band down the near one, two flat tones.
      g.fillStyle = css(STAVE, -10);
      path(g, poly(w * 0.78, TILE, w + 1, TILE, w + 1, h, w * 0.8, h));
      g.fill();
      g.fillStyle = css(STAVE, 7);
      path(g, poly(w * 0.14, TILE, w * 0.24, TILE, w * 0.23, h, w * 0.13, h));
      g.fill();
      // A few stave seams, lifted between the hoops, closer together toward the sides as a barrel's are.
      const n = Math.max(3, Math.round(w / 9));
      for (let j = 1; j < n; j++) {
        const u = j / n;
        const x = (0.5 - 0.5 * Math.cos(u * Math.PI)) * w;
        for (const [ya, yb] of [
          [TILE + 4.5, TILE + (h - TILE) * 0.5 - 1.5],
          [TILE + (h - TILE) * 0.5 + 1.5, h - 4.5],
        ])
          if (hash2(j, ya, i + 7) > 0.35) tick(g, x, ya, x + 0.2, yb, 0.4, j + ya, css(STAVE, -18));
      }
      for (const y of [TILE + 3, TILE + (h - TILE) * 0.5, h - 3]) barLine(g, -1, y, w + 1, y + 0.3, 0.9, HOOP, y, { rim: 0.3, lit: 16 });
      g.restore();
    });
    stamp(rc.s, sp, k.x0 * TILE + d.off[0], k.top * TILE + d.off[1]);
  }
}

/**
 * The burst valve's spray: a jet of water out of the stub, exactly the column the sim pushes with (`beamOf`), broken
 * into pulses along its length, fraying at its tip, and drops falling off its underside on the backdrop.
 */
function spray(rc: RC, m: ModuleOf<'geyser'>, d: DrawCtx) {
  const col = geyserColumn(m, rc.frame, d.r.phase, beamOf(d.o, d.r, d.mi)?.len ?? m.length, d.off[0], d.off[1]);
  if (!col || col.len < 1) return;
  const s = rc.s;
  const hw = m.width / 2;
  const nx = -col.dy;
  const ny = col.dx;
  // The solid jet runs four fifths of the way; past that it has broken up into flying blobs.
  const body = col.len * 0.8;
  const n = Math.max(4, Math.ceil(body / 4));
  const top: P[] = [];
  const bot: P[] = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const along = body * u;
    // Narrow at the stub, full where it spreads; a pulse running out along it, ragged toward the tip.
    const pulse = 0.5 * Math.sin(rc.t * 22 - along * 0.45) * Math.min(1, u * 3);
    // Its end tapers to a ragged lip where it breaks up.
    const half = hw * col.k * (0.55 + 0.45 * Math.min(1, u * 2.5)) * (u > 0.85 ? 1 - (u - 0.85) * 2.4 : 1) + pulse;
    const x = col.x + col.dx * along;
    const y = col.y + col.dy * along;
    top.push({ x: x + nx * half, y: y + ny * half });
    bot.push({ x: x - nx * half, y: y - ny * half });
  }
  const jet = [...top];
  for (let i = bot.length - 1; i >= 0; i--) jet.push(bot[i]);
  tone(s, jet, WATER, { depth: 0.6, shade: -12 });
  // The jet's core: a lighter streak, broken where the pulses are.
  for (let k = 0; k < 3; k++) {
    const u0 = (rc.t * 2.2 + k / 3) % 1;
    const a = Math.max(0, u0 - 0.18) * col.len;
    const b = u0 * col.len;
    glint(
      s,
      [
        { x: col.x + col.dx * a, y: col.y + col.dy * a - 0.4 },
        { x: col.x + col.dx * b, y: col.y + col.dy * b - 0.4 },
      ],
      css(WATER, 26, 0.9),
      0.8,
      k,
    );
  }
  pen(s, jet, 7, 0.3, 0.8, 3, inkFor(WATER));
  // The broken end: blobs of water flung on across the rest of the column, wobbling as they fly.
  for (let k = 0; k < 5; k++) {
    const u = 0.78 + 0.22 * ((k * 0.37 + rc.t * 1.9) % 1);
    const along = col.len * u;
    const off = hw * col.k * 0.7 * Math.sin(k * 2.3 + rc.t * 9);
    const r = hw * col.k * (0.45 - (0.25 * (u - 0.78)) / 0.22);
    if (r < 0.4) continue;
    const blobPts = ovalPts(col.x + col.dx * along + nx * off, col.y + col.dy * along + ny * off, r * 1.3, r, k + 11, 0.12, 9);
    tone(s, blobPts, WATER, { depth: 0.3, shade: -12 });
    pen(s, blobPts, k + 13, 0.25, 0.6, 2, inkFor(WATER));
  }
  // Drops off its underside and its tip, falling away on the backdrop where soft things stay soft.
  for (let k = 0; k < 7; k++) {
    const u = (rc.t * 1.4 + k / 7) % 1;
    const at = col.len * (0.25 + 0.75 * hash2(k, Math.floor(rc.t * 1.4 + k / 7), 3));
    const x = col.x + col.dx * at + col.dx * u * 6;
    const y = col.y + col.dy * at + hw * 0.6 + u * u * 20;
    rc.bg.fillStyle = css(WATER, 18, 0.7 * (1 - u));
    path(rc.bg, ovalPts(x, y, 0.7, 1.1, k, 0.05, 6));
    rc.bg.fill();
  }
}

/** The burst valve on a tank's rim: a pipe stub and a wheel, the wheel spinning loose while it sprays. */
function valve(rc: RC, m: ModuleOf<'geyser'>, d: DrawCtx) {
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const c = geyserCycle(m, rc.frame, d.r.phase);
  const s = rc.s;
  barLine(s, x + 3, y + 3, x + 3, y - 1.5, 1.6, { ...STEEL, l: STEEL.l + 2 }, 1, { rim: 0.35, lit: 14 });
  part(s, boxPts(x - 1, y - 1.8, 5, 2.6, 0.5, 3, 0.1), STEEL, 3, { depth: 0.3, thin: 0.3, thick: 0.7 });
  const spin = c.seg === 2 ? rc.frame * 0.4 : c.seg === 1 ? Math.sin(rc.frame * 0.9) * 0.3 : 0;
  const wx = x + 3;
  const wy = y - 3.6;
  s.fillStyle = inkFor({ h: 4, s: 60, l: 44 });
  for (let i = 0; i < 3; i++) {
    const a = spin + (i * Math.PI) / 3;
    line(s, wx - Math.cos(a) * 2.4, wy - Math.sin(a) * 0.9, wx + Math.cos(a) * 2.4, wy + Math.sin(a) * 0.9, { w: 0.6, seed: i, taper: [0, 0], press: 0 });
  }
  s.fillStyle = css({ h: 4, s: 60, l: 44 });
  path(s, ovalPts(wx, wy, 2.6, 1, 4, 0.02, 12));
  s.fill();
  if (c.seg === 1) {
    // Drips and a hiss while it warns.
    s.fillStyle = css(WATER, 10, 0.8);
    for (let i = 0; i < 2; i++) pip(s, x - 1 - Math.random() * 3, y + Math.random() * 4, 0.6, css(WATER, 10, 0.8), rc.frame + i);
  }
}

// ------------------------------------------------------------------------------------------- clock tower

/** The tower under a belfry shell: its columns and rows, read off the level. */
function towerOf(lv: Level, b: ReturnType<typeof boxOf>): { x0: number; x1: number; top: number; arch: number } {
  const tt = b.y + b.h;
  let arch = tt;
  const mx = b.x + Math.floor(b.w / 2);
  while (arch < lv.h && tileAt(lv, mx, arch) === T_SOLID) arch++;
  return { x0: b.x, x1: b.x + b.w - 1, top: tt, arch };
}

/** The belfry frame on the tower's top: two posts, a beam the bell hangs from, a pitched roof and a weathervane, hazed back. */
function belfry(m: Deco, t: Hz) {
  return sprite(`roof|belfry|${m.w}|${m.h}|${m.seed}|${t.k}`, -6, -TILE * 2, m.w + 12, m.h + TILE * 2, (g) => {
    const w = m.w;
    const h = m.h;
    const p0 = w * 0.18;
    const p1 = w * 0.82;
    const beam = TILE * 1.4;
    for (const x of [p0, p1]) member(g, x, h, x, beam, 2, BRONZE, t, x);
    member(g, p0 - 4, beam, p1 + 4, beam, 2.4, BRONZE, t, 3);
    member(g, p0, h - 6, p0 + 10, beam + 2, 0.6, BRONZE, t, 4);
    member(g, p1, h - 6, p1 - 10, beam + 2, 0.6, BRONZE, t, 5);
    const roof = poly(p0 - 8, beam - 1, w / 2, -TILE * 0.8, p1 + 8, beam - 1);
    flat(g, roof, { h: 200, s: 20, l: 30 }, t, 6, 1);
    for (let i = 1; i < 4; i++)
      tick(
        g,
        w / 2 - (w / 2 - p0 + 8) * (i / 4) + 1,
        -TILE * 0.8 + (beam + TILE * 0.8) * (i / 4),
        w / 2 + (p1 + 8 - w / 2) * (i / 4) - 1 - (i % 2) * 4,
        -TILE * 0.8 + (beam + TILE * 0.8) * (i / 4),
        0.4,
        i,
        t.c({ h: 200, s: 20, l: 30 }, -14),
      );
    // The weathervane on its spike.
    member(g, w / 2, -TILE * 0.8, w / 2, -TILE * 1.8, 0.6, BRONZE, t, 7);
    flat(g, poly(w / 2 - 5, -TILE * 1.6, w / 2 + 5, -TILE * 1.6, w / 2 + 3, -TILE * 1.4), BRONZE, t, 8, 0.3);
  });
}

/** The clockwork in the arch's dark: big toothed wheels turning slowly behind the pendulum. */
function clockwork(rc: RC, m: Deco, d: DrawCtx) {
  const t = hz(d);
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const s = rc.s;
  const sp = sprite(`roof|arch|${m.w}|${m.h}|${t.k}`, 0, 0, m.w, m.h, (g) => {
    // The passage's back wall in shadow: coursed stone, piers at both mouths and an arch sprung between them.
    g.fillStyle = t.c(DARK, 2);
    g.fillRect(0, 0, m.w, m.h);
    for (let y = 2, r = 0; y < m.h - 2; y += 6, r++)
      for (let x = r % 2 ? -5 : 0; x < m.w; x += 10) {
        g.fillStyle = t.c(STONE, -36 + hash2(x, y, 3) * 4);
        path(g, boxPts(x + 0.6, y + 0.6, 8.8, 4.8, 0.8, x * 3 + y, 0.2));
        g.fill();
      }
    const arch: P[] = [{ x: 0, y: m.h }];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      arch.push({ x: m.w / 2 + Math.cos(a) * (m.w / 2 - 5), y: 9 + (Math.sin(a) + 1) * 6 - 6 });
    }
    arch.push({ x: m.w, y: m.h }, { x: m.w, y: 0 }, { x: 0, y: 0 });
    flat(g, arch, { ...STONE, l: STONE.l - 18 }, t, 2, 0.5);
    for (const x of [0, m.w - 5]) flat(g, boxPts(x, 0, 5, m.h, 0.6, x + 4, 0.1), { ...STONE, l: STONE.l - 10 }, t, x + 4, 0.6);
    g.fillStyle = t.c(STONE, -30);
    g.fillRect(0, m.h - 2, m.w, 2);
  });
  stamp(s, sp, x, y);
  // Two wheels meshing, turning with the race's clock.
  const wheels: [number, number, number, number][] = [
    [x + m.w * 0.28, y + m.h * 0.45, m.h * 0.42, 1],
    [x + m.w * 0.72, y + m.h * 0.38, m.h * 0.3, -1.4],
  ];
  for (const [i, [cx, cy, r, sp2]] of wheels.entries()) {
    const a0 = (rc.frame / 240) * sp2;
    s.fillStyle = t.c(BRASS, -24);
    path(s, ovalPts(cx, cy, r, r, i, 0.01, 28));
    s.fill();
    s.fillStyle = t.c(BRASS, -14);
    for (let k = 0; k < 12; k++) {
      const a = a0 + (k / 12) * Math.PI * 2;
      s.fillRect(cx + Math.cos(a) * r - 1, cy + Math.sin(a) * r - 1, 2, 2);
    }
    s.fillStyle = t.c(DARK, 4);
    path(s, ovalPts(cx, cy, r * 0.62, r * 0.62, i + 3, 0.01, 20));
    s.fill();
    s.fillStyle = t.c(BRASS, -18);
    for (let k = 0; k < 4; k++) {
      const a = a0 + (k / 4) * Math.PI * 2;
      line(s, cx, cy, cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62, { w: 1, seed: k, taper: [0, 0], press: 0 });
    }
  }
}

/**
 * The dial on the tower's face, in front of its stone: a cream face in a bronze ring, twelve ticks and two
 * hands. The minute hand creeps round with the race's frames; the hour hand is the level's own hour.
 */
function dial(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return;
  const b = boxOf(m);
  const tw = towerOf(lv, b);
  const cx = ((tw.x0 + tw.x1 + 1) / 2) * TILE;
  const R = Math.min(((tw.x1 - tw.x0 + 1) * TILE) / 2 - 7, ((tw.arch - tw.top) * TILE) / 2 - 10, TILE * 2.6);
  if (R < 8) return;
  const cy = tw.top * TILE + Math.max(R + 9, (tw.arch - tw.top) * TILE * 0.38);
  const sp = sprite(`roof|dial|${R | 0}`, -R - 4, -R - 4, R * 2 + 8, R * 2 + 8, (g) => {
    part(g, ovalPts(0, 0, R + 2.4, R + 2.4, 1, 0.01, 30), BRONZE, 1, { depth: 0.6, thin: 0.4, thick: 1 });
    tone(g, ovalPts(0, 0, R, R, 2, 0.01, 30), CREAM, { depth: 0.8 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const L = i % 3 ? R * 0.12 : R * 0.22;
      tick(g, Math.cos(a) * (R - 1.5), Math.sin(a) * (R - 1.5), Math.cos(a) * (R - 1.5 - L), Math.sin(a) * (R - 1.5 - L), i % 3 ? 0.5 : 0.9, i, inkFor(CREAM));
    }
  });
  stamp(rc.s, sp, cx, cy);
  const minute = (rc.frame / 3600) * Math.PI * 2 - Math.PI / 2;
  const hour = ((lv.seed % 12) / 12) * Math.PI * 2 - Math.PI / 2 + minute / 12;
  rc.s.fillStyle = css(HAND);
  line(rc.s, cx, cy, cx + Math.cos(hour) * R * 0.5, cy + Math.sin(hour) * R * 0.5, { w: 1.4, seed: 1, taper: [0, 0.4], press: 0 });
  line(rc.s, cx, cy, cx + Math.cos(minute) * R * 0.82, cy + Math.sin(minute) * R * 0.82, { w: 0.9, seed: 2, taper: [0, 0.5], press: 0 });
  pip(rc.s, cx, cy, 1.1, css(HAND), 3);
  // Lit from inside at night, softly.
  if (lv.theme.night) light(rc, cx, cy, R * 1.8, CREAM, 0.18);
}

const HAND: HSL = { h: 30, s: 24, l: 16 };

/** The clock's pendulum: a brass rod and a great brass disc, catching the light as it swings. */
function pendulum(rc: RC, m: ModuleOf<'swinger'>, d: DrawCtx) {
  const s = rc.s;
  const hx = m.hub[0] + d.off[0];
  const hy = m.hub[1] + d.off[1];
  const [h] = swingHeads(m, rc.frame, d.r.phase, d.off);
  barLine(s, hx, hy, h.x, h.y, 1.2, { ...BRASS, l: BRASS.l + 4 }, 1, { rim: 0.3, taper: [0, 0], press: 0, lit: 16 });
  const R = m.radius * 0.85;
  orb(s, hx, hy, 1.8, BRASS, 3);
  part(s, ovalPts(h.x, h.y, R, R, 4, 0.01, 22), BRASS, 4, { depth: 0.8, thin: 0.4, thick: 1 });
  s.fillStyle = css(BRASS, -16);
  path(s, ovalPts(h.x, h.y, R * 0.55, R * 0.55, 5, 0.01, 16));
  s.fill();
  glint(s, poly(h.x - R * 0.6, h.y - R * 0.1, h.x - R * 0.3, h.y - R * 0.6), 'rgba(255,240,200,0.7)', 0.7);
}

/** The bell: a bronze bell on its yoke, swinging from the beam, mouth down to the swing, its clapper inside. */
function bell(rc: RC, m: ModuleOf<'swinger'>, d: DrawCtx) {
  const s = rc.s;
  const hx = m.hub[0] + d.off[0];
  const hy = m.hub[1] + d.off[1];
  const [h] = swingHeads(m, rc.frame, d.r.phase, d.off);
  const R = m.radius * 0.85;
  barLine(s, hx, hy, h.x, h.y, 0.9, { ...STEEL, l: STEEL.l - 6 }, 1, { rim: 0.3, taper: [0, 0], press: 0 });
  orb(s, hx, hy, 1.6, STEEL, 3);
  s.save();
  s.translate(h.x, h.y);
  s.rotate(h.a - Math.PI / 2);
  // A bell's flared outline: crown, waist, lip.
  const body = poly(
    -R * 0.5,
    -R * 0.95,
    R * 0.5,
    -R * 0.95,
    R * 0.62,
    -R * 0.2,
    R * 0.82,
    R * 0.55,
    R * 1.02,
    R * 0.85,
    -R * 1.02,
    R * 0.85,
    -R * 0.82,
    R * 0.55,
    -R * 0.62,
    -R * 0.2,
  );
  part(s, body, BRONZE, 5, { depth: 1, thin: 0.4, thick: 1.1 });
  tick(s, -R * 0.84, R * 0.62, R * 0.84, R * 0.62, 0.7, 6, css(BRONZE, -18));
  glint(s, poly(-R * 0.36, -R * 0.7, -R * 0.5, R * 0.3), 'rgba(255,230,180,0.6)', 0.8);
  pip(s, Math.sin(rc.frame * 0.05) * R * 0.3, R * 0.95, R * 0.22, inkFor(BRONZE), 7);
  s.restore();
}

// ------------------------------------------------------------------------------------------- el station

/**
 * The viaduct's bents down to the street, each a pair of riveted legs and a cross-brace; the deck's
 * lattice girder face hung under the track; the station's canopy over the near end on its posts.
 */
function elBack(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return SHELLS.facade?.(rc, m, d);
  const t = hz(d);
  const b = boxOf(m);
  const G = b.y + b.h;
  // The deck: the solid row in the box with the street open under it.
  let V = -1;
  let v0 = -1;
  let v1 = -1;
  for (let y = G - 2; y > b.y && V < 0; y--)
    for (let x = b.x; x < b.x + b.w; x++)
      if (tileAt(lv, x, y) === T_SOLID && tileAt(lv, x, y + 1) === T_EMPTY) {
        V = y;
        v0 = x;
        while (tileAt(lv, v0 - 1, y) === T_SOLID) v0--;
        v1 = x;
        while (tileAt(lv, v1 + 1, y) === T_SOLID) v1++;
        break;
      }
  if (V < 0) return;
  const sp = sprite(`roof|el|${b.x},${b.y},${b.w},${b.h}|${V},${v0},${v1}|${m.seed}|${t.k}`, -4, 0, m.w + 8, m.h + 2, (g) => {
    const X = (tx: number) => (tx - b.x) * TILE;
    const Y = (ty: number) => (ty - b.y) * TILE;
    const under = Y(V + 1);
    const floor = Y(G);
    // The bents, every four or five tiles.
    const n = Math.max(2, Math.round((v1 - v0 + 1) / 4.5));
    // The girder under the track: a lattice face hung the length of it.
    truss(g, X(v0), under + 2.5, X(v1 + 1), under + 2.5, 5, GREEN, t, 70);
    for (let i = 0; i <= n; i++) {
      const x = X(v0) + 4 + ((X(v1 + 1) - X(v0) - 8) * i) / n;
      // Two riveted plate legs splaying to the street, a knee brace each, an X between them.
      for (const k of [-1, 1]) {
        const leg = poly(x + k * 2, under, x + k * 4.6, under, x + k * 6, floor, x + k * 2.6, floor);
        flat(g, leg, GREEN, t, i * 5 + k, 0.6);
        member(g, x + k * 4.4, under + 5, x + k * 9, under + 0.5, 0.6, GREEN, t, i * 5 + k + 9);
      }
      member(g, x - 2.6, under + 6, x + 2.6, floor - 4, 0.45, GREEN, t, i * 5 + 3);
      member(g, x + 2.6, under + 6, x - 2.6, floor - 4, 0.45, GREEN, t, i * 5 + 4);
      g.fillStyle = t.c(GREEN, 14);
      for (let y = under + 5; y < floor - 3; y += 11) for (const k of [-1, 1]) g.fillRect(x + k * 3.6 - 0.4, y, 0.8, 0.8);
      flat(g, boxPts(x - 7.5, floor - 2, 15, 2.4, 0.4, i), CONCRETE, t, i, 0.3);
    }
    // The signal bridge's posts down to the track, and its signal head, where the track has one.
    for (let y = b.y; y < V - 1; y++)
      for (let x = v0; x <= v1; x++) {
        if (tileAt(lv, x, y) !== T_ONEWAY || tileAt(lv, x - 1, y) === T_ONEWAY) continue;
        let e = x;
        while (tileAt(lv, e + 1, y) === T_ONEWAY) e++;
        for (const px of [X(x) + 2, X(e + 1) - 2]) member(g, px, Y(y) + 4, px, Y(V), 1.1, GREEN, t, px + y);
        flat(g, boxPts((X(x) + X(e + 1)) / 2 - 2.5, Y(y) + 5, 5, 8, 0.8, x + 30, 0.1), { h: 220, s: 10, l: 16 }, t, x + 30, 0.4);
        x = e;
      }
    // The station's canopy over the near end: two posts and a shallow roof, a name board under it.
    const c0 = X(v0) + 2;
    const c1 = Math.min(X(v1 + 1) - 2, c0 + TILE * 5);
    const roofY = Y(V) - TILE * 4.2;
    for (const x of [c0 + 3, c1 - 3]) member(g, x, Y(V), x, roofY, 1, GREEN, t, x);
    flat(g, poly(c0 - 4, roofY + 2, c0 + 2, roofY - 3, c1 - 2, roofY - 3, c1 + 4, roofY + 2), GREEN, t, 9, 0.6);
    tick(g, c0, roofY + 3, c1 - 1, roofY + 3.2, 0.45, 13, t.c(GREEN, -14));
    flat(g, boxPts((c0 + c1) / 2 - 12, roofY + 5, 24, 6, 0.4, 11), { h: 210, s: 40, l: 30 }, t, 11, 0.3);
    g.fillStyle = t.c(CREAM, -10);
    for (let x = (c0 + c1) / 2 - 9; x < (c0 + c1) / 2 + 9; x += 3.5) g.fillRect(x, roofY + 6.6, 2, 2.8);
  });
  stamp(rc.s, sp, b.x * TILE, b.y * TILE);
  // The canopy's lamps.
  const c0 = v0 * TILE + 2;
  light(rc, c0 + TILE * 2.5, V * TILE - TILE * 3, 50, LAMP, 0.45);
}

/** The train: a steel car with its windows lit, doors, a roof vent and the destination board, faceless. */
function train(rc: RC, m: ModuleOf<'vehicle'>, d: DrawCtx) {
  const p = vehiclePose(m, rc.frame, d.r.phase);
  const cols = vehicleCols(m, p.x, d.off);
  const x0 = cols[0].x;
  const x1 = cols[cols.length - 1].x + cols[cols.length - 1].w;
  const yb = m.at[1] + d.off[1];
  const h = Math.max(...cols.map((c) => c.h));
  const w = x1 - x0;
  const body: HSL = { h: d.style.hue, s: 18, l: 52 };
  const sp = sprite(`roof|train|${w | 0}|${h | 0}|${d.style.hue | 0}`, -2, -2, w + 4, h + 4, (g) => {
    // The car: the end columns are lower, so its nose and tail round off inside the hitbox.
    const e = h - cols[0].h;
    const car = poly(0.4, h, 0.4, e + 3, 4, 0.4, w - 4, 0.4, w - 0.4, e + 3, w - 0.4, h);
    part(g, car, body, 3, { depth: 1, thin: 0.45, thick: 1.1 });
    // A stripe, the windows, the doors.
    g.fillStyle = css({ h: d.style.glowHue, s: 60, l: 46 });
    g.fillRect(1, h * 0.62, w - 2, 2);
    const nw = Math.max(2, Math.floor((w - 10) / 9));
    for (let i = 0; i < nw; i++) {
      const wx = 5 + i * ((w - 10) / nw);
      const pane = boxPts(wx, h * 0.2, 6, h * 0.3, 1, i + 4, 0.15);
      part(g, pane, { h: 46, s: 60, l: 66 }, i + 4, { depth: 0.4, thin: 0.3, thick: 0.7, ink: inkFor(body) });
    }
    for (const dx of [w * 0.33, w * 0.67]) tick(g, dx, h * 0.18, dx, h - 1, 0.45, dx, css(body, -24));
    // The destination board at the nose.
    part(g, boxPts(w - 9, 2.4, 6, 3, 0.6, 9, 0.1), { h: 30, s: 80, l: 56 }, 9, { depth: 0.3, thin: 0.3, thick: 0.6, ink: inkFor(body) });
  });
  const s = rc.s;
  s.save();
  if (m.flip) {
    s.translate(x0 + w / 2, 0);
    s.scale(-1, 1);
    s.translate(-(x0 + w / 2), 0);
  }
  stamp(s, sp, x0, yb - h);
  s.restore();
  // Its headlamp, and the light from its windows on the track.
  const front = p.dir > 0 !== m.flip ? x1 - 1 : x0 + 1;
  bulb(rc.g, front, yb - h * 0.45, 1.1, LAMP, p.moving ? 1 : 0.5);
  light(rc, x0 + w / 2, yb - h / 2, 40, LAMP, 0.35);
  if (p.moving && Math.random() < 0.3) glowDot(rc.g, x0 + Math.random() * w, yb + 1, 2.4, { h: 200, s: 90, l: 80 }, 0.7);
}

// ------------------------------------------------------------------------------------------- dispatch

const facade: DecoSkin = (rc, m, d) => {
  const concept = d.o.level?.landmark?.concept;
  const t = hz(d);
  if (concept === 'girder-works') girders(rc, m, d);
  else if (concept === 'neon-billboard') billboardBack(rc, m, d);
  else if (concept === 'water-towers') towersBack(rc, m, d);
  else if (concept === 'clock-tower') {
    if (m.h <= 4 * TILE + 0.5) clockwork(rc, m, d);
    else stamp(rc.s, belfry(m, t), m.at[0] + d.off[0], m.at[1] + d.off[1]);
  } else if (concept === 'el-station') elBack(rc, m, d);
  else return SHELLS.facade?.(rc, m, d);
  rails(rc, m, d, t);
};

/**
 * The rails behind a stack of rungs near a shell that reaches the roof, so the rungs read as a ladder (or a
 * stair's stringers) fixed to something, not slats hung in the air. Rungs are two-wide one-way rows; one
 * alone (low gravity's tall step) gets its rails too.
 */
function rails(rc: RC, m: Deco, d: DrawCtx, t: Hz) {
  const lv = d.o.level;
  if (!lv) return;
  const b = boxOf(m);
  const bottom = b.y + b.h;
  const rung = (x: number, y: number) =>
    tileAt(lv, x, y) === T_ONEWAY && tileAt(lv, x + 1, y) === T_ONEWAY && tileAt(lv, x - 1, y) !== T_ONEWAY && tileAt(lv, x + 2, y) !== T_ONEWAY;
  for (let x = b.x - 3; x < b.x + b.w + 2; x++) {
    const ys: number[] = [];
    for (let y = 1; y < lv.h - 1; y++) if (rung(x, y)) ys.push(y);
    if (!ys.length) continue;
    const top = Math.min(...ys);
    const roof = roofRow(lv, x, Math.max(...ys) + 1);
    if (bottom < roof - 1) continue;
    for (const rx of [x * TILE + 3, (x + 2) * TILE - 3]) member(rc.s, rx, top * TILE - 5, rx, roof * TILE, 1, STEEL, t, rx);
    x++;
  }
}

/** The construction hoist's cable, up its mast to the head sheave over the top deck. */
function hoistCable(rc: RC, m: Deco, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv) return;
  const cx = Math.floor(m.at[0] / TILE);
  let top = lv.h;
  for (let y = 0; y < lv.h && top === lv.h; y++) for (let x = cx - 1; x <= cx + 2; x++) if (tileAt(lv, x, y) === T_ONEWAY) top = y;
  const x = m.at[0] + d.off[0] + m.w / 2;
  const y = m.at[1] + d.off[1];
  const head = top * TILE - TILE * 2 + 3;
  barLine(rc.s, x, head, x, y + 1, 0.55, { ...STEEL, l: STEEL.l + 12 }, 4, { rim: 0.25, taper: [0, 0], press: 0 });
  orb(rc.s, x, head, 3.6, { h: 46, s: 50, l: 42 }, 6);
}

/** The city's own set pieces, module by module. */
const piece: PieceSkin = (rc, layer, m: Module, d) => {
  const concept = d.o.level?.landmark?.concept;
  switch (m.type) {
    case 'deco':
      // The hoist's cab: its cable runs up the mast, not into the sky.
      if (m.kind === 'cab' && concept === 'girder-works' && layer < 0) {
        hoistCable(rc, m, d);
        return true;
      }
      if (m.kind !== 'facade' || layer !== 0) return false;
      if (concept === 'neon-billboard') {
        billboardAd(rc, m, d);
        spotlights(rc, m, d);
      } else if (concept === 'water-towers') tankBodies(rc, m, d);
      else if (concept === 'clock-tower' && m.h > 4 * TILE + 0.5) dial(rc, m, d);
      return false;
    case 'swinger': {
      if (m.head !== 'weight' || layer !== 1) return m.head === 'weight' && layer >= 0;
      const lv = d.o.level;
      // A pendulum hangs in an arch (stone right over its hub), a bell from a frame (open sky over it).
      const inArch = !!lv && tileAt(lv, Math.floor(m.hub[0] / TILE), Math.floor(m.hub[1] / TILE) - 1) === T_SOLID;
      if (concept === 'clock-tower') (inArch ? pendulum : bell)(rc, m, d);
      else wreckingBall(rc, m, d);
      return true;
    }
    case 'vehicle':
      if (concept !== 'el-station' || layer !== 1) return false;
      train(rc, m, d);
      return true;
    case 'geyser': {
      // The burst valve: its wheel and stub on the vent's layer, its spray on the column's, both in place of the geyser's own.
      if (m.look !== 'water' || Math.abs(m.angle - Math.PI) > 0.1) return false;
      if (layer === 1) valve(rc, m, d);
      else if (layer === 3) spray(rc, m, d);
      return layer === 1 || layer === 3;
    }
    default:
      return false;
  }
};

export const ROOFTOPS: ThemeSkins = { deco: { facade }, piece };
