import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { type Level, T_SOLID, tileAt } from '../../../sim/level';
import type { Module } from '../../../sim/props';
import { blob, inkFor, type P, sn, stroke } from '../../ink';
import { boxPts, dot, ovalPts, part, path, poly, sprite, stamp, tick } from '../../ink-props';
import { bulb, glowDot, light, type RC } from '../../kit';
import type { DrawCtx } from '../common';
import { SHELLS } from '../modules/deco-shells';
import { type Deco, type DecoSkin, flat, type Haze, hazer, type PieceSkin } from './common';
import { bands, brickwork, FRAME, IRON, member, rivets, SHELL, STEEL } from './factory-ink';

/**
 * Factory skins for the Foundry, the Boiler House and the Robot Line (gen/stage/factory-works.ts). Their
 * backdrop shells are the deco `facade` (chosen by the level's concept) and the boiler house's
 * `smokestack`: open steel and hazed brick behind the terrain, never a slab that reads as somewhere to
 * stand. In front, on the boiler house's own tiles, each boiler's steel drum and firebox door.
 *
 * - **The Foundry**: the crane runway's lattice legs and knee braces down to the casting floor, the bay's
 *   tall windows between them, and inside the cupola's tapping passage its fire-brick lining and the tap
 *   hole, glowing.
 * - **The Boiler House**: the boiler room's back wall in brick, arched windows, the steam main along it with
 *   drops to the boilers; on the roof the stack, tapering, banded, a ladder up it, smoke off its top and a
 *   lamp blinking on its cap.
 * - **The Robot Line**: the deck's legs and cross braces down to the floor (or the trench), the robot
 *   cells' mesh fences behind the arms, and car bodies going by on the overhead line.
 */

const BRICK: HSL = { h: 10, s: 40, l: 38 };
/** A boiler's steel drum: dark, so it reads as iron in its brick and not as a pale tank. */
const DRUM: HSL = { h: 205, s: 10, l: 40 };
const WINDOW: HSL = { h: 205, s: 22, l: 30 };
const FIREBRICK: HSL = { h: 16, s: 30, l: 20 };
const GLASS: HSL = { h: 200, s: 18, l: 70 };
const SLAG: HSL = { h: 24, s: 100, l: 54 };
const MESH: HSL = { h: 46, s: 60, l: 50 };
const SMOKE: HSL = { h: 25, s: 6, l: 40 };

const solid = (lv: Level | null | undefined, x: number, y: number) => !!lv && tileAt(lv, x, y) === T_SOLID;

/** A frame of windows: grimy glass in two flat tones, a few glazing bars, in the backdrop's haze. */
function windows(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: Haze, seed: number, arch = false) {
  const pane = poly(x, y + (arch ? w * 0.35 : 0), x + w * 0.5, y, x + w, y + (arch ? w * 0.35 : 0), x + w, y + h, x, y + h);
  g.fillStyle = t.c(GLASS, -18);
  path(g, pane);
  g.fill();
  // The light on the glass: a long sliver and a short one, hand-cut.
  g.fillStyle = t.c(GLASS, 4);
  path(g, poly(x + w * 0.18, y + h * 0.9, x + w * 0.18, y + h * 0.35, x + w * 0.42, y + h * 0.22, x + w * 0.42, y + h * 0.7));
  g.fill();
  const cols = Math.max(2, Math.round(w / 9));
  const rows = Math.max(2, Math.round(h / 12));
  for (let i = 1; i < cols; i++) member(g, x + (w * i) / cols, y + (arch ? w * 0.18 : 0), x + (w * i) / cols, y + h, 0.6, IRON, t, seed + i);
  for (let j = 1; j < rows; j++) member(g, x, y + (h * j) / rows, x + w, y + (h * j) / rows, 0.6, IRON, t, seed + 20 + j);
  for (let i = 0; i + 1 < pane.length; i++) member(g, pane[i].x, pane[i].y, pane[i + 1].x, pane[i + 1].y, 1.4, IRON, t, seed + 40 + i);
  member(g, pane[pane.length - 1].x, pane[pane.length - 1].y, pane[0].x, pane[0].y, 1.4, IRON, t, seed + 50);
}

/** A lattice leg from (x, y0) down to y1: two chords and a zigzag web between them, `w` across. */
function leg(g: CanvasRenderingContext2D, x: number, y0: number, y1: number, w: number, base: HSL, t: Haze, seed: number) {
  for (const k of [-1, 1]) member(g, x + (k * w) / 2, y0, x + (k * w) / 2, y1, 1.5, base, t, seed + k);
  const n = Math.max(2, Math.round((y1 - y0) / (w * 1.2)));
  for (let i = 0; i < n; i++) {
    const a = y0 + ((y1 - y0) * i) / n;
    const b = y0 + ((y1 - y0) * (i + 1)) / n;
    const s = i % 2 ? 1 : -1;
    member(g, x + (s * w) / 2, a, x - (s * w) / 2, b, 0.6, base, t, seed + 10 + i);
  }
}

// ----------------------------------------------------------------------------------------------- the foundry

/** The casting bay, baked: the runway's lattice legs at its ends and about every five tiles, knee braces up to it. */
function foundryBay(w: number, floor: number, t: Haze) {
  return sprite(`fw|bay|${w | 0}|${floor | 0}|${t.k}`, -8, -4, w + 16, floor + 8, (g) => {
    const n = Math.max(1, Math.round((w - TILE) / (5 * TILE)));
    const xs = Array.from({ length: n + 1 }, (_, i) => TILE * 0.5 + ((w - TILE) * i) / n);
    xs.forEach((x, i) => {
      leg(g, x, 0, floor, 6, FRAME, t, i * 17);
      flat(g, boxPts(x - 6, floor - 3, 12, 3, 0.4, i, 0.05), IRON, t, i + 5, 0.4);
      for (const k of [-1, 1]) if ((k < 0 && i > 0) || (k > 0 && i < n)) member(g, x + k * 3, TILE * 1.6, x + k * TILE * 1.2, 1, 1.2, FRAME, t, i * 7 + k);
    });
    // The runway's rail under the girder, riveted.
    member(g, 0, 1.5, w, 1.5, 1.6, STEEL, t, 3);
    rivets(g, 4, 1.5, w - 4, 1.5, 9, 0.5, t.ink(STEEL), 9);
  });
}

/**
 * The cupola behind its own tower, baked: the furnace's shell and its refractory lining, so through the
 * charging door and the tapping passage you see the inside of a tower that runs on down to the floor, not
 * sky between blocks. Bands of the shell show where the tiles leave it open.
 */
function cupolaLining(w: number, h: number, t: Haze) {
  return sprite(`fw|cupola|${w | 0}|${h | 0}|${t.k}`, -2, -2, w + 4, h + 4, (g) => {
    flat(g, boxPts(0, 0, w, h, 0.5, 5, 0.04), FIREBRICK, t, 6, 0.4);
    for (let y = 5; y < h - 2; y += 6) for (let x = (y / 6) % 2 ? 3 : 8; x < w - 3; x += 10) tick(g, x, y, x + 4, y, 0.4, x + y, t.ink(FIREBRICK));
    // Its shell's ribs, down both sides.
    for (const x of [1.5, w - 1.5]) member(g, x, 0, x, h, 2.2, IRON, t, x);
  });
}

/** The tap hole low in the passage's back wall: an arch of hot iron, flickering. */
function tapHole(rc: RC, x: number, floor: number) {
  const ty = floor - TILE * 1.2;
  const fl = 0.85 + Math.sin(rc.t * 9 + x) * 0.08;
  rc.s.fillStyle = css(FIREBRICK, -8);
  path(rc.s, poly(x - 5, ty + 5, x - 5, ty - 1, x, ty - 5, x + 5, ty - 1, x + 5, ty + 5));
  rc.s.fill();
  rc.s.fillStyle = css(SLAG, 6 * fl);
  path(rc.s, poly(x - 3, ty + 5, x - 3, ty, x, ty - 2.8, x + 3, ty, x + 3, ty + 5));
  rc.s.fill();
  glowDot(rc.g, x, ty + 1, 14, SLAG, 0.6 * fl);
  light(rc, x, ty, 60, SLAG, 0.5 * fl);
}

/** The foundry's shells: the cupola's lining (its top row is the tower's own) or the casting bay under the runway. */
function foundryHall(rc: RC, m: Deco, d: DrawCtx) {
  const t = hazer(d, SHELL);
  const x0 = m.at[0] + d.off[0];
  const y0 = m.at[1] + d.off[1];
  if (solid(d.o.level, Math.floor(x0 / TILE), Math.round(y0 / TILE))) {
    stamp(rc.s, cupolaLining(m.w, m.h, t), x0, y0);
    tapHole(rc, x0 + m.w / 2, y0 + m.h);
    return;
  }
  // The floor under the bay's near end: a casting pit a row deep runs the bay's middle.
  const tx = Math.floor(x0 / TILE);
  const g = solid(d.o.level, tx, Math.round((y0 + m.h) / TILE) - 1) ? Math.round((y0 + m.h) / TILE) - 1 : Math.round((y0 + m.h) / TILE);
  stamp(rc.s, foundryBay(m.w, g * TILE - y0, t), x0, y0);
}

// ------------------------------------------------------------------------------------------ the boiler house

/** The boiler room's back wall, baked: brick with a few courses marked, arched windows, the steam main and its drops. */
function boilerWall(w: number, h: number, t: Haze, seed: number) {
  return sprite(`fw|boil|${w | 0}|${h | 0}|${seed % 5}|${t.k}`, -2, -2, w + 4, h + 4, (g) => {
    flat(g, boxPts(0, 0, w, h, 0.4, seed, 0.04), BRICK, t, seed + 1, 0.5);
    brickwork(g, 1, 1, w - 2, h - 2, BRICK, t, seed);
    const n = Math.max(2, Math.round(w / (5 * TILE)));
    for (let i = 0; i < n; i++) {
      const cx = (w * (i + 0.5)) / n;
      windows(g, cx - 9, h * 0.12, 18, h * 0.42, t, seed + i * 13, true);
    }
    // The steam main along the wall, flanged, and a drop down to each boiler's place.
    const py = h * 0.66;
    member(g, 0, py, w, py, 3.2, STEEL, t, seed + 70);
    for (let x = 12; x < w - 6; x += 2 * TILE) flat(g, boxPts(x - 1.6, py - 3, 3.2, 6, 0.3, x, 0.05), IRON, t, x + 1, 0.3);
    for (let i = 0; i < n; i++) member(g, (w * (i + 0.5)) / n + 12, py, (w * (i + 0.5)) / n + 12, h, 2.2, STEEL, t, seed + 80 + i);
    // A gauge board by the near door.
    flat(g, boxPts(TILE * 1.4, h * 0.2, 12, 9, 0.6, seed + 90, 0.05), IRON, t, seed + 91, 0.5);
    for (const gx of [TILE * 1.4 + 3.5, TILE * 1.4 + 8.5]) flat(g, ovalPts(gx, h * 0.2 + 4.5, 2.2, 2.2, gx, 0.02, 10), { h: 44, s: 20, l: 80 }, t, gx + 1, 0.2);
  });
}

function boilerHall(rc: RC, m: Deco, d: DrawCtx) {
  stamp(rc.s, boilerWall(m.w, m.h, hazer(d, SHELL), m.seed), m.at[0] + d.off[0], m.at[1] + d.off[1]);
}

/** What a stack is built of: a boiler house's brick, a cupola's riveted steel. */
const STACK_STEEL: HSL = { h: 18, s: 26, l: 34 };

/** The stack, baked: a chimney tapering up from what it stands on, banded, its cap corbelled out, a ladder up its side. */
function stack(w: number, h: number, t: Haze, seed: number, base: HSL) {
  return sprite(`fw|stack|${w | 0}|${h | 0}|${base.h}|${t.k}`, -w * 0.3 - 4, -10, w * 1.6 + 8, h + 12, (g) => {
    const top = w * 0.78;
    const body = poly((w - top) / 2, 4, (w + top) / 2, 4, w, h, 0, h);
    flat(g, body, base, t, seed, 0.9);
    // Bands every few tiles: a darker course, and the odd brick.
    for (let y = 3 * TILE; y < h - 4; y += 3 * TILE) {
      const k = y / h;
      const half = (top + (w - top) * k) / 2;
      member(g, w / 2 - half, y, w / 2 + half, y, 1.4, { ...base, l: base.l - 8 }, t, seed + y);
    }
    g.save();
    path(g, body);
    g.clip();
    brickwork(g, 0, 4, w, h - 4, base, t, seed + 2);
    // The shade down its far side: a stack is round.
    g.fillStyle = t.c(base, -7);
    path(g, poly(w * 0.66, 4, w, 4, w, h, w * 0.7, h));
    g.fill();
    g.restore();
    // The cap.
    flat(g, boxPts((w - top) / 2 - 2, 0, top + 4, 5, 0.6, seed + 3, 0.05), { ...base, l: base.l - 6 }, t, seed + 4, 0.6);
    // A ladder of thin rungs up the side away from the light.
    const lx = (w + top) / 2 - 3;
    member(g, lx - 2, 6, w - 3, h - 1, 0.5, IRON, t, seed + 5);
    member(g, lx + 1.5, 6, w + 0.5, h - 1, 0.5, IRON, t, seed + 6);
    for (let y = 9; y < h - 2; y += 6) {
      const k = y / h;
      const xa = lx - 2 + (w - 3 - (lx - 2)) * k;
      member(g, xa, y, xa + 3.5, y, 0.35, IRON, t, seed + y * 2);
    }
    // The lightning rod.
    member(g, w / 2, 0, w / 2, -8, 0.4, IRON, t, seed + 9);
  });
}

export const boilerStack: DecoSkin = (rc, m, d) => {
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  stamp(rc.s, stack(m.w, m.h, hazer(d, SHELL), m.seed % 97, d.o.level?.landmark?.concept === 'foundry' ? STACK_STEEL : BRICK), x, y);
  // Smoke off the top, soft, on the background layer; a lamp on the cap, blinking.
  for (let i = 0; i < 4; i++) {
    const u = (rc.t * 0.12 + i / 4 + (m.seed % 10) / 10) % 1;
    rc.bg.fillStyle = css(SMOKE, 0, 0.3 * (1 - u) * Math.min(1, u * 5));
    blob(rc.bg, x + m.w / 2 + u * 14 + Math.sin(u * 4 + i) * 3, y - 4 - u * 26, 3 + u * 7, i + 3, 1, 0.3);
    rc.bg.fill();
  }
  if (Math.floor(rc.t * 1.2) % 2 === 0) bulb(rc.g, x + m.w / 2 + m.w * 0.3, y + 2, 1.2, { h: 4, s: 90, l: 52 });
};

/** A boiler's block (tiles) from its firebox flame: the column at its face, its floor row, how wide and tall it is. */
function boilerBlock(lv: Level, m: Extract<Module, { type: 'flame' }>, ox: number, oy: number) {
  const x = Math.ceil((m.at[0] + ox) / TILE);
  const y = Math.floor((m.at[1] + oy) / TILE);
  let w = 0;
  while (solid(lv, x + w, y) && w < 8) w++;
  let h = 0;
  while (solid(lv, x, y - h) && h < 4) h++;
  return { x, y, w, h };
}

/**
 * A boiler drawn on its own tiles: a riveted steel drum lying in its brick setting, the firebox door low on
 * its near end where the flame comes out, a safety valve on top. All inside the block, so it's the shape
 * you stand on.
 */
function boiler(s: CanvasRenderingContext2D, g: CanvasRenderingContext2D, bx: number, by: number, bw: number, bh: number, t: number, seed: number) {
  const px = bx * TILE;
  const top = (by - bh + 1) * TILE;
  const W = bw * TILE;
  const H = bh * TILE;
  // The drum lies along the block over its brick setting: a long cylinder side on, its silhouette the block's
  // (that's what you stand on), its roundness all in the tones: a lit band high, the shade low, and seams that
  // bow round it like the near end's plate.
  const dh = H - 6;
  const drum = boxPts(px + 1, top + 1, W - 2, dh, 3, seed, 0.05);
  part(s, drum, DRUM, seed, { depth: 0.6, thin: 0.45, thick: 1.1 });
  const band = (u0: number, u1: number, dl: number, k: number) => {
    const pts: P[] = [];
    for (let i = 0; i <= 8; i++) pts.push({ x: px + (W * i) / 8, y: top + 1 + dh * u0 + sn(i, 1, seed + k) * 0.5 });
    for (let i = 8; i >= 0; i--) pts.push({ x: px + (W * i) / 8, y: top + 1 + dh * u1 + sn(i, 2, seed + k) * 0.5 });
    s.fillStyle = css(DRUM, dl);
    path(s, pts);
    s.fill();
  };
  s.save();
  path(s, drum);
  s.clip();
  band(0.1, 0.34, 12, 1);
  band(0.16, 0.24, 22, 2);
  band(0.66, 0.86, -9, 3);
  band(0.86, 1.05, -17, 4);
  s.restore();
  // Seams round it, bowed as the end plate is, a few rivets along each, and one along the top.
  const ry = dh / 2 - 0.5;
  const cy = top + 1 + dh / 2;
  for (let x = px + 15; x < px + W - 8; x += 16) {
    const seam: P[] = [];
    for (let i = 0; i <= 8; i++) {
      const a = -Math.PI / 2 + (i / 8) * Math.PI;
      seam.push({ x: x + Math.cos(a) * 2.6, y: cy + Math.sin(a) * (ry - 0.6) });
    }
    s.fillStyle = inkFor(DRUM);
    stroke(s, seam, { w: 0.6, seed: x, taper: [0.15, 0.25], press: 0.3 });
    for (const u of [0.25, 0.5, 0.75])
      dot(s, x + 2.6 * Math.cos(Math.asin(u * 2 - 1)) - 1.2, cy + (u * 2 - 1) * (ry - 1.6), 0.4, x + u * 9, css(DRUM, 26), inkFor(DRUM));
  }
  // The near end, seen a little round the corner: the boiler's end plate, the firebox door low in it.
  part(s, ovalPts(px + 5, cy, 4, ry, seed + 1, 0.02, 14), { ...DRUM, l: DRUM.l - 6 }, seed + 1, { depth: 0.4, thin: 0.3, thick: 0.8 });
  part(s, boxPts(px + 2.5, top + dh - 8.5, 5, 6, 0.8, seed + 3, 0.05), IRON, seed + 3, { depth: 0.4, thin: 0.3, thick: 0.7 });
  s.fillStyle = css(SLAG, -4 + Math.sin(t * 7 + seed) * 4);
  s.fillRect(px + 3.4, top + dh - 5.6, 3.2, 1.1);
  glowDot(g, px + 5, top + dh - 5, 7, SLAG, 0.35);
  // A safety valve and a pipe stub on its back, inside the block's top row.
  part(s, boxPts(px + W * 0.6, top + 1.4, 3, 2.4, 0.5, seed + 4, 0.05), { ...DRUM, l: DRUM.l + 14 }, seed + 4, { depth: 0.3, thin: 0.25, thick: 0.6 });
}

/** Paints a car body on the line comes off in: calm, so the runners stay the loudest colour. */
const CAR_PAINT: HSL[] = [
  { h: 4, s: 42, l: 44 },
  { h: 208, s: 36, l: 44 },
  { h: 152, s: 26, l: 38 },
  { h: 40, s: 48, l: 50 },
];

/**
 * A car body on the line, drawn on its own cells (`carCells`): a painted sedan whose outline is the cells (the
 * cabin's two over the body's three) and whose shape is all inside them: a glasshouse with raked screens, bumpers,
 * wheels in their arches on the jig, a headlamp at the bonnet's end and a tail lamp at the boot's.
 */
function carBody(s: CanvasRenderingContext2D, cells: readonly (readonly [number, number])[], ox: number, oy: number, seed: number) {
  const by = Math.max(...cells.map(([, y]) => y));
  const xs = cells.filter(([, y]) => y === by).map(([x]) => x);
  const cab = cells.filter(([, y]) => y < by).map(([x]) => x);
  const x0 = Math.min(...xs) * TILE + ox;
  const y0 = by * TILE + oy;
  const W = xs.length * TILE;
  const c0 = Math.min(...cab) * TILE + ox;
  const CW = cab.length * TILE;
  const hood = c0 > x0 ? -1 : 1;
  const paint = CAR_PAINT[seed % CAR_PAINT.length];
  // The cabin first, so the body's top edge overlaps its foot; its glass raked at both ends.
  part(s, boxPts(c0, y0 - TILE, CW, TILE + 2, 3, seed, 0.06), paint, seed, { depth: 0.8, thin: 0.4, thick: 1 });
  const gy0 = y0 - TILE + 3;
  const gy1 = y0 - 1;
  const mid = c0 + CW / 2;
  // One side's glass, from the B-pillar (`inner`) out to its end pillar (`outer`), the end raked by `rake` at the roof.
  const glass = (inner: number, outer: number, rake: number) => {
    const k = Math.sign(outer - inner);
    s.fillStyle = css(WINDOW, 4);
    path(s, poly(inner, gy0, outer - k * rake, gy0, outer, gy1, inner, gy1));
    s.fill();
    const sx = inner + (outer - inner) * 0.35;
    s.fillStyle = css(WINDOW, 22);
    path(s, poly(sx, gy1 - 0.8, sx + 1.2, gy0 + 1, sx + 2.4, gy0 + 1, sx + 1.2, gy1 - 0.8));
    s.fill();
  };
  glass(mid + hood * 1, (hood > 0 ? c0 + CW : c0) - hood * 2, 6);
  glass(mid - hood * 1, (hood > 0 ? c0 : c0 + CW) + hood * 2, 4);
  // The body: painted, a darker sill under the doors, a lit shoulder line.
  part(s, boxPts(x0, y0, W, TILE, 2.8, seed + 1, 0.06), paint, seed + 1, { depth: 0.8, thin: 0.4, thick: 1.1 });
  s.fillStyle = css(paint, -12);
  path(s, poly(x0 + 1, y0 + TILE - 4.5, x0 + W - 1, y0 + TILE - 4.5, x0 + W - 1, y0 + TILE - 1, x0 + 1, y0 + TILE - 1));
  s.fill();
  s.fillStyle = css(paint, 16);
  path(s, poly(x0 + 3, y0 + 2.2, x0 + W - 3, y0 + 2.2, x0 + W - 3, y0 + 3.2, x0 + 3, y0 + 3.4));
  s.fill();
  // Door shuts and a handle, under the cabin.
  for (const x of [c0 + 1.5, mid, c0 + CW - 1.5]) tick(s, x, y0 + 1.5, x + 0.2, y0 + TILE - 5, 0.4, (x * 3) | 0, inkFor(paint));
  tick(s, mid + hood * 4, y0 + 5, mid + hood * 6.5, y0 + 5, 0.6, seed + 5, css(paint, -24));
  // Bumpers at both ends.
  for (const bx of [x0 - 0.6, x0 + W - 2.6])
    part(s, boxPts(bx, y0 + TILE - 6.5, 3.2, 3, 0.8, (bx * 3) | 0, 0.05), STEEL, (bx * 3) | 0, { depth: 0.3, thin: 0.25, thick: 0.5 });
  // Wheels in their arches, sat on the jig.
  for (const ax of [x0 + 9, x0 + W - 9]) {
    s.fillStyle = css(paint, -30);
    path(s, poly(ax - 6, y0 + TILE, ax - 5.4, y0 + 9.6, ax, y0 + 7.6, ax + 5.4, y0 + 9.6, ax + 6, y0 + TILE));
    s.fill();
    part(s, ovalPts(ax, y0 + TILE - 3.6, 4.4, 3.6, (ax * 7) | 0, 0.03, 14), { h: 220, s: 6, l: 20 }, (ax * 7) | 0, { depth: 0.4, thin: 0.3, thick: 0.7 });
    part(s, ovalPts(ax, y0 + TILE - 3.6, 2, 1.7, (ax * 7 + 1) | 0, 0.03, 10), STEEL, (ax * 7 + 1) | 0, { depth: 0.2, thin: 0.2, thick: 0.4 });
  }
  // A headlamp at the bonnet's end, a tail lamp at the boot's.
  const hx = hood > 0 ? x0 + W - 3.4 : x0 + 3.4;
  const tx = hood > 0 ? x0 + 3 : x0 + W - 3;
  part(s, ovalPts(hx, y0 + 5, 1.8, 1.4, seed + 3, 0.02, 8), { h: 48, s: 40, l: 82 }, seed + 3, { depth: 0.2, thin: 0.25, thick: 0.5 });
  part(s, boxPts(tx - 1.2, y0 + 4, 2.4, 2, 0.4, seed + 4, 0.05), { h: 2, s: 60, l: 42 }, seed + 4, { depth: 0.2, thin: 0.25, thick: 0.5 });
}

/**
 * The factory's own pieces drawn its way: the boiler house's boilers on the tiles each firebox's flame
 * comes out of, the robot line's car bodies on their cells, and no block under a robot arm's pedestal
 * (the arm draws its pedestal on that block).
 */
export const factoryPiece: PieceSkin = (rc, layer, m, d) => {
  const lv = d.o.level;
  if (m.type === 'flame') {
    if (layer !== 1 || !lv || lv.landmark?.concept !== 'boiler-house') return false;
    const b = boilerBlock(lv, m, d.off[0], d.off[1]);
    if (b.w >= 2 && b.h >= 1) boiler(rc.s, rc.g, b.x, b.y, b.w, b.h, rc.t, (b.x * 7 + b.y) & 0xffff);
    return false;
  }
  if (m.type !== 'body') return false;
  if (m.cells.length === 2 && d.r.mods.some((x) => x.type === 'arm')) return true;
  if (m.cells.length === 5 && lv?.landmark?.concept === 'robot-line') {
    if (layer === 1) carBody(rc.s, m.cells, d.off[0], d.off[1], d.r.pp.uid);
    return true;
  }
  return false;
};

// -------------------------------------------------------------------------------------------- the robot line

/** The line, baked: legs and cross braces under the deck, the robot cells' mesh fences behind the arms on it. */
function lineBay(w: number, deck: number, floor: number, t: Haze, seed: number) {
  return sprite(`fw|line|${w | 0}|${deck | 0}|${floor | 0}|${t.k}`, -4, -4, w + 8, floor + 8, (g) => {
    // Fences: yellow posts every couple of tiles, a mesh between them, two tiles tall on the deck.
    const fy = deck - TILE * 2.2;
    for (let x = TILE; x < w - 4; x += 2 * TILE) {
      const b = Math.min(w - 4, x + 2 * TILE);
      for (let k = 1; k < 3; k++) member(g, x, fy + ((deck - fy) * k) / 3, b, fy + ((deck - fy) * k) / 3, 0.35, IRON, t, x + k);
      for (let xx = x + 10; xx < b - 2; xx += 10) member(g, xx, fy, xx, deck, 0.35, IRON, t, xx + seed);
      member(g, x, fy - 1, x, deck, 1.4, MESH, t, x * 3);
    }
    // Under the deck: legs about every four tiles, crossed between.
    const n = Math.max(1, Math.round(w / (4 * TILE)));
    const xs = Array.from({ length: n + 1 }, (_, i) => 3 + ((w - 6) * i) / n);
    xs.forEach((x, i) => {
      member(g, x, deck + 1, x, floor, 2.4, STEEL, t, i * 9);
      flat(g, boxPts(x - 4, floor - 2.5, 8, 2.5, 0.3, i, 0.05), IRON, t, i + 3, 0.3);
      if (i < n) {
        member(g, x, deck + 3, xs[i + 1], floor - 3, 0.6, STEEL, t, i * 9 + 4);
        member(g, xs[i + 1], deck + 3, x, floor - 3, 0.6, STEEL, t, i * 9 + 5);
      }
    });
    bands(g, 0, deck + 0.5, w, 2.2, t);
  });
}

/** One car body on the overhead line: a hazed shell of a sedan on a C-hanger. */
function hungCar(g: CanvasRenderingContext2D, x0: number, y0: number, t: Haze, hue: number, seed: number) {
  g.save();
  g.translate(x0, y0);
  g.scale(1.35, 1.35);
  const x = 0;
  const y = 0;
  member(g, x, y, x, y + 7, 0.8, IRON, t, seed);
  member(g, x, y + 7, x - 9, y + 7, 0.8, IRON, t, seed + 1);
  member(g, x - 9, y + 7, x - 9, y + 13, 0.8, IRON, t, seed + 2);
  const c: HSL = { h: hue, s: 30, l: 52 };
  const body = poly(x - 22, y + 21, x - 22, y + 16, x - 13, y + 15, x - 8, y + 10, x + 6, y + 10, x + 11, y + 15, x + 20, y + 16, x + 20, y + 21);
  flat(g, body, c, t, seed + 3, 0.6);
  g.fillStyle = t.c(WINDOW, 6);
  path(g, poly(x - 7, y + 11.5, x - 0.5, y + 11.5, x - 0.5, y + 15, x - 11, y + 15));
  g.fill();
  path(g, poly(x + 0.5, y + 11.5, x + 5.5, y + 11.5, x + 9.5, y + 15, x + 0.5, y + 15));
  g.fill();
  g.restore();
}

function robotHall(rc: RC, m: Deco, d: DrawCtx) {
  const t = hazer(d, SHELL);
  const x0 = m.at[0] + d.off[0];
  const y0 = m.at[1] + d.off[1];
  const lv = d.o.level;
  // The deck is the first solid row under the shell's top at its near column.
  const tx = Math.floor(x0 / TILE) + 1;
  let deck = Math.floor(y0 / TILE);
  while (deck < Math.floor((y0 + m.h) / TILE) && !solid(lv, tx, deck)) deck++;
  const dy = deck * TILE - y0;
  stamp(rc.s, lineBay(m.w, dy, m.h, t, m.seed % 13), x0, y0);
  // The overhead line along the top, and car bodies going by on it, slowly, wrapping round the bay.
  const ry = y0 + 2;
  member(rc.s, x0, ry, x0 + m.w, ry, 2.2, IRON, t, 7);
  const gap = 6 * TILE;
  const shift = ((rc.frame * 0.25) % gap) - gap;
  rc.s.save();
  rc.s.beginPath();
  rc.s.rect(x0, y0 - 2, m.w, dy - TILE * 2.4);
  rc.s.clip();
  for (let x = x0 + shift; x < x0 + m.w + gap; x += gap)
    hungCar(rc.s, x, ry, t, [6, 210, 46, 150][Math.abs(Math.round((x - shift - x0) / gap)) % 4], Math.round(x - shift));
  rc.s.restore();
  // The line's stack light at its near end: green while it runs.
  bulb(rc.g, x0 + 6, y0 + dy - TILE * 2.6, 1.3, { h: 130, s: 70, l: 50 });
  member(rc.s, x0 + 6, y0 + dy - TILE * 2.4, x0 + 6, y0 + dy, 0.6, IRON, t, 3);
}

/** The factory's `facade` shells, by the level's concept; any other concept's facade is the shared one. */
export const factoryFacade: DecoSkin = (rc, m, d) => {
  const c = d.o.level?.landmark?.concept;
  if (c === 'foundry') return foundryHall(rc, m, d);
  if (c === 'boiler-house') return boilerHall(rc, m, d);
  if (c === 'robot-line') return robotHall(rc, m, d);
  SHELLS.facade?.(rc, m, d);
};
