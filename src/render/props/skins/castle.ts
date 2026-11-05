import type { HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { CEIL, HALL_AIR, MANOR_H, type Manor, manorWithin, throneDais, throneHallPlan, TOWER } from '../../../gen/stage/castle';
import { TILE } from '../../../sim/constants';
import { type Level, T_SOLID, tileAt } from '../../../sim/level';
import { line, type P } from '../../ink';
import { boxPts, ovalPts, path, poly, sprite, stamp, tick } from '../../ink-props';
import { circle, flame, glowDot, light, type RC } from '../../kit';
import type { DrawCtx } from '../common';
import { SHELLS } from '../modules/deco-shells';
import { castleStagePiece, castleStageShell } from './castle-stage';
import { BANNER, CANDLE, doorway, GILT, MOON, SHELL, STONE, WOOD } from './castle-ink';
import { type Deco, type DecoSkin, flat, type Haze, hazer, type ThemeSkins } from './common';

/**
 * Castle skins: the back walls of the Haunted Wing and the Throne Hall (docs/SETPIECES.md, Castle), drawn
 * as the deco `facade` behind the landmark's terrain. Only the rooms show through, so each is the rooms'
 * far wall. The Gatehouse, the Bell Tower and the Boss Bridge are drawn by ./castle-stage.ts.
 *
 * The Haunted Wing's is peeling wallpaper, a room to a paper, with a moonlit window in the hall, a
 * grandfather clock, candles that gutter, and the family portraits, whose eyes follow whoever is nearest.
 * The Throne Hall's is dressed stone with tall stained-glass windows, the house banners and the throne on
 * its dais. Both are flat tones sunk toward the sky's haze with a thin pen of their own dark: scenery,
 * never a slab to stand on (docs/ART.md, Fair play). Baked once; only flames and eyes are live.
 *
 * Each covers its landmark's every column down to the ground under it, so where a doorway is cut through a
 * wall the wall doesn't hang over open sky: behind the opening it draws the door's reveal and the dark
 * beyond, the threshold on the ground (docs/SETPIECES.md §4, Grounding).
 */

const PAPERS: HSL[] = [
  { h: 150, s: 22, l: 17 },
  { h: 300, s: 20, l: 18 },
  { h: 42, s: 26, l: 21 },
  { h: 210, s: 22, l: 18 },
];

// ------------------------------------------------------------------------------------------- haunted wing

interface Room {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** The manor's rooms, in px from its back wall's top-left, worked out from its box the way gen built it. */
function rooms(m: Deco): { rooms: Room[]; plan: Manor } {
  const L0 = Math.round(m.at[0] / TILE);
  const top = Math.round(m.at[1] / TILE);
  const p = manorWithin(L0, L0 + Math.round(m.w / TILE) - 1, top + MANOR_H);
  const X = (tx: number) => tx * TILE - m.at[0];
  const Y = (ty: number) => ty * TILE - m.at[1];
  const x0 = X(p.ix0);
  const x1 = X(p.ix1 + 1);
  return {
    plan: p,
    rooms: [
      { x0, x1, y0: Y(p.F1 + 1), y1: Y(p.G) },
      { x0, x1, y0: Y(p.F2 + 1), y1: Y(p.F1) },
      { x0, x1, y0: Y(p.RB + 1), y1: Y(p.F2) },
    ],
  };
}

/** Portrait spots per room (centers, in the back wall's px), past the shaft and the stairwell. */
function portraits(m: Deco): { x: number; y: number; r: number; seed: number }[] {
  const { rooms: rs, plan } = rooms(m);
  const clear = (plan.sw + 4) * TILE - m.at[0];
  const out: { x: number; y: number; r: number; seed: number }[] = [];
  rs.forEach((r, i) => {
    const spots = [clear + 1.2 * TILE, (clear + r.x1) / 2, r.x1 - 1.4 * TILE].filter((x) => x > clear + 10 && x < r.x1 - 12);
    const pick = spots.filter((_, k) => hash2(i, k, m.seed) < 0.75).slice(0, i === 0 ? 1 : 2);
    for (const x of pick) out.push({ x, y: r.y0 + Math.min(18, (r.y1 - r.y0) * 0.42), r: i === 0 ? 7.5 : 6, seed: i * 7 + out.length });
  });
  return out;
}

function manorWall(m: Deco, t: Haze) {
  return sprite(`castle|manor|${m.w}|${m.h}|${m.seed}|${t.k}`, -2, -2, m.w + 4, m.h + 4, (g) => {
    const { rooms: rs, plan } = rooms(m);
    rs.forEach((r, i) => {
      const paper = PAPERS[(i + m.seed) % PAPERS.length];
      g.fillStyle = t.c(paper);
      g.fillRect(r.x0 - 4, r.y0 - 2, r.x1 - r.x0 + 8, r.y1 - r.y0 + 4);
      // Damask stripes, and the paper peeling off in sheets to the plaster.
      g.fillStyle = t.c(paper, 5);
      for (let x = r.x0; x < r.x1; x += 7) g.fillRect(x, r.y0, 2.2, r.y1 - r.y0);
      g.fillStyle = t.c(paper, 9);
      for (let x = r.x0 + 3.5; x < r.x1; x += 7)
        for (let y = r.y0 + 4; y < r.y1 - 6; y += 9) {
          path(g, ovalPts(x, y, 1.1, 1.8, x + y, 0.1, 8));
          g.fill();
        }
      for (let k = 0; k < 2; k++) {
        const px = r.x0 + 8 + hash2(i, k, m.seed) * (r.x1 - r.x0 - 24);
        const py = r.y0 + 3;
        const ph = (r.y1 - r.y0) * (0.35 + hash2(k, i, m.seed) * 0.3);
        const sheet = poly(px, py, px + 9, py, px + 11, py + ph * 0.7, px + 6, py + ph, px + 1, py + ph * 0.8);
        g.fillStyle = t.c({ h: 36, s: 18, l: 40 });
        path(g, sheet);
        g.fill();
        // The curl of the torn strip.
        flat(g, poly(px + 9, py, px + 13, py + 3, px + 11, py + ph * 0.45), paper, t, k + i, 0.3);
      }
      // A dado rail and wainscot along the bottom: the rail a lighter tone over the panels, a panel joint every so often.
      g.fillStyle = t.c(WOOD, 4);
      g.fillRect(r.x0 - 4, r.y1 - 7, r.x1 - r.x0 + 8, 7);
      g.fillStyle = t.c(WOOD, 12);
      path(g, poly(r.x0 - 4, r.y1 - 8.4, r.x1 + 4, r.y1 - 8.2, r.x1 + 4, r.y1 - 7, r.x0 - 4, r.y1 - 7.1));
      g.fill();
      for (let x = r.x0 + 6, j = 0; x < r.x1; x += 12, j++)
        if (hash2(j, i, m.seed) < 0.6) tick(g, x, r.y1 - 6, x + 0.2, r.y1 - 1.5, 0.6, j + i * 13, t.c(WOOD, -8));
    });
    const hall = rs[0];
    // The hall's tall window, moonlit, past the stairwell.
    const wx = (plan.sw + 4) * TILE - m.at[0] + 6;
    if (wx + 14 < hall.x1 - 3 * TILE) {
      const top = hall.y0 + 6;
      const bot = hall.y1 - 12;
      const win: P[] = [{ x: wx, y: bot }];
      for (let i = 0; i <= 10; i++) win.push({ x: wx + 7 - Math.cos((i / 10) * Math.PI) * 7, y: top + 7 - Math.sin((i / 10) * Math.PI) * 7 });
      win.push({ x: wx + 14, y: bot });
      flat(g, win, { h: 226, s: 40, l: 22 }, t, 3, 0.2);
      g.fillStyle = t.c(MOON, -10);
      circle(g, wx + 9.5, top + 9, 2.6);
      g.fillStyle = t.ink(WOOD);
      line(g, wx + 7, top + 1, wx + 7, bot, { w: 0.9, seed: 4, taper: [0, 0], press: 0 });
      line(g, wx, top + 16, wx + 14, top + 16, { w: 0.9, seed: 5, taper: [0, 0], press: 0 });
      // One pane gone.
      g.fillStyle = t.c({ h: 226, s: 30, l: 10 });
      path(g, poly(wx + 8, top + 17, wx + 13, top + 17, wx + 13, top + 23, wx + 10, top + 20));
      g.fill();
    }
    // A grandfather clock in the hall's far corner, stopped at midnight.
    const cx = hall.x1 - 8;
    if (cx - hall.x0 > 3 * TILE) {
      const body = boxPts(cx - 5, hall.y1 - 34, 10, 34, 0.8, 6, 0.1);
      flat(g, body, WOOD, t, 6, 0.8);
      const face = ovalPts(cx, hall.y1 - 28, 3.6, 3.6, 7, 0.02, 14);
      flat(g, face, { h: 44, s: 30, l: 62 }, t, 7, 0.3);
      g.fillStyle = t.ink(WOOD);
      line(g, cx, hall.y1 - 28, cx, hall.y1 - 31, { w: 0.6, seed: 8, taper: [0, 0.3], press: 0 });
      line(g, cx, hall.y1 - 28, cx + 0.3, hall.y1 - 30.4, { w: 0.6, seed: 9, taper: [0, 0.3], press: 0 });
    }
    // The portraits' frames and canvases; their eyes are live.
    for (const p of portraits(m)) {
      const fr = boxPts(p.x - p.r - 3, p.y - p.r * 1.3 - 3, p.r * 2 + 6, p.r * 2.6 + 6, 0.8, p.seed, 0.1);
      flat(g, fr, GILT, t, p.seed, 0.8);
      g.fillStyle = t.c({ h: 24, s: 30, l: 12 });
      g.fillRect(p.x - p.r, p.y - p.r * 1.3, p.r * 2, p.r * 2.6);
      // A sitter: shoulders in a dark coat, a pale long face, a hat or a wig by the seed.
      const coat: HSL = hash2(p.seed, 1, m.seed) < 0.5 ? { h: 0, s: 40, l: 22 } : { h: 220, s: 30, l: 20 };
      path(g, poly(p.x - p.r, p.y + p.r * 1.3, p.x - p.r * 0.8, p.y + p.r * 0.5, p.x + p.r * 0.8, p.y + p.r * 0.5, p.x + p.r, p.y + p.r * 1.3));
      g.fillStyle = t.c(coat);
      g.fill();
      path(g, ovalPts(p.x, p.y - p.r * 0.1, p.r * 0.52, p.r * 0.72, p.seed, 0.05, 14));
      g.fillStyle = t.c({ h: 34, s: 22, l: 64 });
      g.fill();
      g.fillStyle = t.c({ h: 0, s: 0, l: 92 });
      for (const k of [-1, 1]) circle(g, p.x + k * p.r * 0.22, p.y - p.r * 0.2, p.r * 0.13);
      if (hash2(p.seed, 2, m.seed) < 0.5) {
        g.fillStyle = t.c({ h: 0, s: 0, l: 10 });
        path(
          g,
          poly(p.x - p.r * 0.55, p.y - p.r * 0.75, p.x + p.r * 0.55, p.y - p.r * 0.75, p.x + p.r * 0.38, p.y - p.r * 1.2, p.x - p.r * 0.38, p.y - p.r * 1.2),
        );
        g.fill();
      }
    }
    // Candle sconces, one a room, the brass baked and the flames live.
    for (const s of sconces(m)) {
      flat(g, boxPts(s.x - 2.5, s.y, 5, 2, 0.4, s.x | 0), GILT, t, 9, 0.3);
      g.fillStyle = t.c({ h: 48, s: 20, l: 80 });
      g.fillRect(s.x - 0.9, s.y - 5, 1.8, 5);
    }
    // The footing course under it all, down to the ground: the terrain hides it but for the cab's pit.
    const X = (tx: number) => tx * TILE - m.at[0];
    const Y = (ty: number) => ty * TILE - m.at[1];
    flat(g, boxPts(0, Y(plan.G), m.w, m.h - Y(plan.G), 0.4, 11, 0.05), { h: 30, s: 6, l: 30 }, t, 11, 0.4);
    g.fillStyle = t.c({ h: 240, s: 12, l: 8 });
    g.fillRect(X(plan.sx) + 1, Y(plan.G), plan.S * TILE - 2, m.h - Y(plan.G));
    // The doors: front and back on the hall, and the one off the top floor.
    const PLASTER: HSL = { h: 36, s: 16, l: 40 };
    doorway(g, t, X(plan.L0), Y(plan.G - 3), 2 * TILE, 3 * TILE, PLASTER, 31);
    doorway(g, t, X(plan.R1), Y(plan.G - 3), 2 * TILE, 3 * TILE, PLASTER, 37);
    doorway(g, t, X(plan.R1), Y(plan.F2 - 3), 2 * TILE, 3 * TILE, PLASTER, 41);
  });
}

function sconces(m: Deco): { x: number; y: number }[] {
  const { rooms: rs, plan } = rooms(m);
  const clear = (plan.sw + 4) * TILE - m.at[0];
  return rs.map((r, i) => ({ x: i === 1 ? r.x1 - 2.4 * TILE : clear + 0.4 * TILE, y: r.y0 + 12 }));
}

/** The eyes follow the nearest runner. */
function eyes(rc: RC, m: Deco, d: DrawCtx, t: Haze) {
  const runners = d.o.runners ?? [];
  for (const p of portraits(m)) {
    const ex = m.at[0] + d.off[0] + p.x;
    const ey = m.at[1] + d.off[1] + p.y - p.r * 0.2;
    let best: { x: number; y: number } | null = null;
    let bd = Infinity;
    for (const r of runners) {
      const dd = (r.x - ex) ** 2 + (r.y - 7 - ey) ** 2;
      if (dd < bd) {
        bd = dd;
        best = r;
      }
    }
    const a = best ? Math.atan2(best.y - 7 - ey, best.x - ex) : Math.PI / 2;
    rc.s.fillStyle = t.ink({ h: 24, s: 30, l: 40 });
    for (const k of [-1, 1]) circle(rc.s, ex + k * p.r * 0.22 + Math.cos(a) * p.r * 0.06, ey + Math.sin(a) * p.r * 0.06, p.r * 0.075);
  }
}

function candles(rc: RC, m: Deco, d: DrawCtx) {
  for (const [i, s] of sconces(m).entries()) {
    const x = m.at[0] + d.off[0] + s.x;
    const y = m.at[1] + d.off[1] + s.y - 5;
    const k = 0.75 + 0.25 * Math.sin(rc.t * 9 + i * 2.1) * Math.sin(rc.t * 3.7 + i);
    flame(rc.g, x, y, 3, 6 * k, CANDLE, rc.t + i);
    glowDot(rc.g, x, y - 2, 14 * k, CANDLE, 0.45);
    light(rc, x, y, 60, CANDLE, 0.55 * k);
  }
}

const manor: DecoSkin = (rc, m, d) => {
  const t = hazer(d, SHELL);
  stamp(rc.s, manorWall(m, t), m.at[0] + d.off[0], m.at[1] + d.off[1]);
  eyes(rc, m, d, t);
  candles(rc, m, d);
  // The hall's window lets the moon in.
  const { rooms: rs } = rooms(m);
  light(rc, m.at[0] + d.off[0] + (rs[0].x0 + rs[0].x1) / 2, m.at[1] + d.off[1] + rs[0].y0 + 20, 90, MOON, 0.35);
};

// -------------------------------------------------------------------------------------------- throne hall

function hallWall(m: Deco, t: Haze, level: Level | undefined) {
  return sprite(`castle|hall|${m.w}|${m.h}|${m.seed}|${t.k}`, -2, -2, m.w + 4, m.h + 4, (g) => {
    // The box runs tower to tower and down to the ground: the hall's air sits between the towers.
    const at = { x: Math.round(m.at[0] / TILE), y: 0, w: Math.round(m.w / TILE), h: 0 };
    const G = Math.round(m.at[1] / TILE) + CEIL + HALL_AIR;
    // The dais the seed built, read off the tiles as they were when the wall was baked.
    const p = throneHallPlan({ x: at.x, y: G - 1, w: at.w, h: 1 });
    const dais = level ? throneDais((x, y) => tileAt(level, x, y) === T_SOLID, p) : { dx0: p.x1 - TOWER - 3, steps: 2, ts: p.x1 - TOWER - 1 };
    const top = CEIL * TILE;
    const bot = G * TILE - m.at[1];
    const ix = TOWER * TILE;
    const iw = m.w - 2 * ix;
    // Dressed stone, coursed and jointed, down to the footing.
    g.fillStyle = t.c(STONE);
    g.fillRect(0, 0, m.w, m.h);
    // The towers' doors.
    doorway(g, t, 0, bot - 3 * TILE, TOWER * TILE, 3 * TILE, STONE, 51);
    doorway(g, t, m.w - TOWER * TILE, bot - (dais.steps + 3) * TILE, TOWER * TILE, 3 * TILE, STONE, 53);
    g.save();
    g.translate(ix, 0);
    // Coursed ashlar: blocks in two tones cut by hand, and a joint where one block meets the next, lifted often.
    for (let y = top, row = 0; y < bot; y += 10, row++) {
      for (let x = (row & 1) * 11 - 11, j = 0; x < iw; x += 22, j++) {
        const h = hash2(j, row, m.seed);
        if (h < 0.4) {
          g.fillStyle = t.c(STONE, h < 0.2 ? 3 : -3);
          path(g, boxPts(x + 0.6, y + 0.6, 21, 8.8, 1.2, j * 31 + row, 0.3));
          g.fill();
        }
        if (h > 0.25) tick(g, x, y + 1, x + 0.2, y + 9, 0.55, j * 7 + row, t.c(STONE, -10));
        if (hash2(row, j, m.seed + 5) < 0.6) tick(g, x + 1, y, x + 20, y + 0.3, 0.55, j * 11 + row, t.c(STONE, -10));
      }
    }
    // Tall arched stained-glass windows, banners between them.
    const n = Math.max(1, Math.floor(iw / 64));
    const step = iw / n;
    for (let i = 0; i < n; i++) {
      const cx = step * (i + 0.5) - 14;
      if (cx < 10 || cx > iw - 50) continue;
      const wt = top + 8;
      const wb = bot - 26;
      const win: P[] = [{ x: cx - 7, y: wb }];
      for (let k = 0; k <= 10; k++) win.push({ x: cx - Math.cos((k / 10) * Math.PI) * 7, y: wt + 7 - Math.sin((k / 10) * Math.PI) * 7 });
      win.push({ x: cx + 7, y: wb });
      flat(g, win, { h: 230, s: 38, l: 20 }, t, i, 0.2);
      for (let y = wt + 4, r = 0; y < wb - 2; y += 5, r++)
        for (const k of [-1, 1]) {
          g.fillStyle = t.c([BANNER, GILT, { h: 200, s: 50, l: 36 }, { h: 130, s: 36, l: 28 }][(r + (k > 0 ? 1 : 0) + i) % 4], 4);
          g.fillRect(cx + (k < 0 ? -6 : 0.5), y, 5.5, 4.2);
        }
      g.fillStyle = t.ink(STONE);
      line(g, cx, wt, cx, wb, { w: 0.9, seed: i, taper: [0, 0], press: 0 });
      // The banner beside it.
      const bx = cx + step / 2;
      if (bx > iw - 30) continue;
      const bn = poly(bx - 7, top + 2, bx + 7, top + 2, bx + 7, top + 40, bx, top + 34, bx - 7, top + 40);
      flat(g, bn, BANNER, t, i + 9, 0.6);
      g.fillStyle = t.c(GILT, 6);
      g.fillRect(bx - 7, top + 4, 14, 1.4);
      // The house crown.
      path(g, poly(bx - 4, top + 18, bx - 4, top + 12, bx - 2, top + 15, bx, top + 11, bx + 2, top + 15, bx + 4, top + 12, bx + 4, top + 18));
      g.fill();
      flat(g, boxPts(bx - 9, top, 18, 2.2, 0.3, i + 3), WOOD, t, i + 4, 0.3);
    }
    // The throne, on the dais's top step.
    const tx = (dais.ts + 1) * TILE - m.at[0] - ix;
    const ty = bot - dais.steps * TILE;
    const back = poly(tx - 9, ty, tx - 9, ty - 34, tx - 5, ty - 46, tx, ty - 52, tx + 5, ty - 46, tx + 9, ty - 34, tx + 9, ty);
    flat(g, back, { h: 354, s: 54, l: 28 }, t, 21, 0.8);
    flat(g, boxPts(tx - 11, ty - 14, 22, 4, 0.5, 22), GILT, t, 23, 0.5);
    for (const k of [-1, 1]) flat(g, boxPts(tx + k * 10 - 2, ty - 22, 4, 22, 0.4, 24 + k), GILT, t, 25 + k, 0.4);
    g.fillStyle = t.c(GILT, 8);
    path(g, poly(tx - 5, ty - 40, tx - 5, ty - 46, tx - 2.5, ty - 43, tx, ty - 48, tx + 2.5, ty - 43, tx + 5, ty - 46, tx + 5, ty - 40));
    g.fill();
    // A red carpet along the floor to the dais.
    const cx = dais.dx0 * TILE - m.at[0] - ix;
    g.fillStyle = t.c(BANNER, 4);
    g.fillRect(0, bot - 2.6, cx, 2.6);
    g.fillStyle = t.c(GILT);
    g.fillRect(0, bot - 2.8, cx, 0.7);
    g.restore();
  });
}

const hall: DecoSkin = (rc, m, d) => {
  const t = hazer(d, SHELL);
  stamp(rc.s, hallWall(m, t, d.o.level ?? undefined), m.at[0] + d.off[0], m.at[1] + d.off[1]);
  // Moonlight through the stained glass.
  const iw = m.w - 2 * TOWER * TILE;
  const n = Math.max(1, Math.floor(iw / 64));
  for (let i = 0; i < n; i++)
    light(rc, m.at[0] + d.off[0] + TOWER * TILE + (iw / n) * (i + 0.5) - 14, m.at[1] + d.off[1] + (CEIL + HALL_AIR / 2) * TILE, 60, MOON, 0.3);
};

const facade: DecoSkin = (rc, m, d) => {
  const concept = d.o.level?.landmark?.concept;
  if (concept === 'haunted-wing') return manor(rc, m, d);
  if (concept === 'throne-hall') return hall(rc, m, d);
  if (castleStageShell(rc, m, d)) return;
  SHELLS.facade?.(rc, m, d);
};

export const CASTLE: ThemeSkins = { deco: { facade }, piece: castleStagePiece };
