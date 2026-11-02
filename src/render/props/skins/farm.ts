import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { type Level, T_ONEWAY, T_SOLID, tileAt } from '../../../sim/level';
import { geyserColumn, geyserCycle, type Module, type ModuleOf, rotorAngles, type RotorArm, swingHeads, teslaCycle } from '../../../sim/props';
import { blob, line, type P, stroke } from '../../ink';
import { ball, boxPts, dot, glint, INK, ovalPts, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { bulb, circle, glowDot, light, lightning, type RC } from '../../kit';
import { BACKDROP, beamOf, type DrawCtx } from '../common';
import type { CannonPose, Deco, DecoSkin, PieceSkin, Rotor, RotorSkin, ThemeSkins } from './common';

/**
 * Farm skins: the farm's stage concepts (gen/stage/farm.ts) and its own hazards, drawn at landmark scale.
 *
 * Behind the terrain, hazed toward the sky so none of it reads as somewhere to stand (docs/ART.md, Fair
 * play): the windmill's tapered tower and cap over its mill house's back wall; the grain elevator's
 * headhouse on its leg; the barn's back wall following its own roof line, its doors, rafters and hay;
 * the water mill's stone back wall with the pit wheel, the axle out to the water wheel, its A-frame and the
 * flume's trough; the farm track's trestle bents and rail.
 *
 * In front, exactly on what the sim moves and hurts with: the water wheel's floats on its turning rim, the
 * combine harvester over its body's cells with its reel's bats on the swinger's heads, the live fence's
 * wire where its beam runs (crackling when it's on, ticking as it warns), the hay hook's block on its chain
 * from a jib or a ridge beam, the grain chute's pour, the muck spreader and the pumpkin catapult.
 */

type Swinger = ModuleOf<'swinger'>;
type Tesla = ModuleOf<'tesla'>;
type Geyser = ModuleOf<'geyser'>;
type Body = ModuleOf<'body'>;
type Cannon = ModuleOf<'cannon'>;

const HAZE = 0.3;
/** A hazed tone: toward the level's fog in lightness and saturation, never in hue. */
function hz(d: DrawCtx) {
  const fog = d.o.level?.theme.fog;
  const k = fog ? `${fog.h | 0},${fog.l | 0}` : '-';
  const hsl = (c: HSL): HSL => (fog ? { h: c.h, s: c.s * (1 - HAZE), l: c.l + (fog.l - c.l) * HAZE } : c);
  return { k, hsl, c: (b: HSL, dl = 0, a = 1) => css(hsl(b), dl, a), ink: (b: HSL) => css({ h: b.h, s: b.s * 0.5, l: Math.max(5, hsl(b).l * 0.3) }) };
}
type Hz = ReturnType<typeof hz>;

/** A flat backdrop shape: its hazed tone and a thin pen of its own dark. */
function flat(g: CanvasRenderingContext2D, pts: readonly P[], base: HSL, t: Hz, seed: number, depth = 0.6) {
  tone(g, pts, t.hsl(base), { depth });
  pen(g, pts, seed, 0.3, 0.8, 3, t.ink(base));
}

/** A backdrop beam: a dark ribbon with its hazed tone over it. */
function beam(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, base: HSL, t: Hz, seed: number) {
  g.fillStyle = t.ink(base);
  line(g, ax, ay, bx, by, { w: w + 1.2, seed, taper: [0, 0], press: 0.05 });
  g.fillStyle = t.c(base);
  line(g, ax, ay, bx, by, { w, seed: seed + 1, taper: [0, 0], press: 0.05 });
}

/** A front pole: ink under its tone. */
function pole(g: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w: number, c: HSL, seed: number) {
  g.fillStyle = INK;
  line(g, ax, ay, bx, by, { w: w + 1.3, seed, taper: [0, 0], press: 0.1 });
  g.fillStyle = css(c);
  line(g, ax, ay, bx, by, { w, seed: seed + 1, taper: [0, 0], press: 0.1 });
}

const WOOD: HSL = { h: 28, s: 36, l: 34 };
const LIGHTWOOD: HSL = { h: 34, s: 30, l: 52 };
const BARNRED: HSL = { h: 4, s: 46, l: 30 };
const WHITE: HSL = { h: 40, s: 18, l: 86 };
const STONE: HSL = { h: 32, s: 9, l: 46 };
const IRON: HSL = { h: 215, s: 8, l: 28 };
const HAY: HSL = { h: 46, s: 64, l: 58 };
const STEEL: HSL = { h: 210, s: 8, l: 62 };
const WATER: HSL = { h: 198, s: 52, l: 56 };

const solidAt = (lv: Level | null | undefined, x: number, y: number) => !!lv && tileAt(lv, x, y) === T_SOLID;
const onewayAt = (lv: Level | null | undefined, x: number, y: number) => !!lv && tileAt(lv, x, y) === T_ONEWAY;

// ------------------------------------------------------------------------------------------------ windmill

const TOWERS: HSL[] = [WHITE, { h: 30, s: 14, l: 50 }, { h: 6, s: 40, l: 44 }];
const CAPS: HSL[] = [
  { h: 4, s: 46, l: 36 },
  { h: 150, s: 26, l: 30 },
  { h: 220, s: 10, l: 30 },
];

/**
 * The mill's back wall from its roof to the ground, the tower rising from behind the roof to the cap, and
 * the cap on the hub. Local px from the deco's top-left; `hx`, `hy` the hub, `R` the roof's top.
 */
function windmillShell(m: Deco, t: Hz, hx: number, hy: number, R: number) {
  const seed = m.seed;
  const tower = TOWERS[seed % 3];
  const cap = CAPS[(seed >> 3) % 3];
  const top = hy - 34;
  return sprite(`farm|mill|${m.w}|${m.h}|${hx | 0}|${hy | 0}|${R | 0}|${seed}|${t.k}`, -30, top, m.w + 60, m.h - top + 2, (g) => {
    // The mill house's back wall: boards, a window, flour sacks and a pair of millstones on the floor.
    const wall = boxPts(0, R, m.w, m.h - R, 0.4, seed, 0.1);
    flat(g, wall, { h: 30, s: 30, l: 34 }, t, seed, 0.3);
    g.fillStyle = t.ink(WOOD);
    for (let x = 5; x < m.w; x += 6) g.fillRect(x, R + 2, 0.6, m.h - R - 2);
    const wx = m.w * (0.3 + 0.4 * hash2(1, 2, seed));
    flat(g, boxPts(wx - 6, R + 8, 12, 10, 1, seed + 1), { h: 210, s: 30, l: 24 }, t, seed + 2, 0.2);
    g.fillStyle = t.c(WHITE);
    g.fillRect(wx - 0.5, R + 8, 1, 10);
    g.fillRect(wx - 6, R + 12.5, 12, 1);
    for (let i = 0; i < 3; i++) {
      const sx = 10 + i * 7;
      flat(g, ovalPts(sx, m.h - 4, 4, 4.5, seed + i, 0.12, 10), { h: 40, s: 20, l: 80 }, t, seed + 3 + i, 0.4);
    }
    for (let i = 0; i < 2; i++) flat(g, boxPts(m.w - 26, m.h - 4 - i * 4, 18, 3.6, 1.6, seed + 6 + i), STONE, t, seed + 7 + i, 0.3);
    // The tower: tapered, clapboarded, a window and a door onto its gallery.
    const bw = Math.min(m.w * 0.46, 72);
    const tw = 18;
    const body = poly(hx - bw, R + 1, hx - tw, top + 26, hx + tw, top + 26, hx + bw, R + 1);
    flat(g, body, tower, t, seed + 10, 1.2);
    g.save();
    path(g, body);
    g.clip();
    g.fillStyle = t.ink(tower);
    for (let y = top + 30; y < R; y += 6) g.fillRect(hx - bw, y, bw * 2, 0.6);
    g.restore();
    const gy = R - (R - top - 26) * 0.42;
    const gw = tw + (bw - tw) * 0.58 + 10;
    flat(g, boxPts(hx - 5, gy - 13, 10, 13, 4, seed + 11), { h: 20, s: 30, l: 22 }, t, seed + 12, 0.3);
    flat(g, boxPts(hx - 4, top + 40, 8, 9, 3, seed + 13), { h: 210, s: 30, l: 24 }, t, seed + 14, 0.2);
    // The gallery round the tower: a plank deck and a railing, scenery only.
    beam(g, hx - gw, gy, hx + gw, gy, 2.4, WOOD, t, seed + 15);
    beam(g, hx - gw, gy - 8, hx + gw, gy - 8, 1, WOOD, t, seed + 16);
    for (let x = -gw; x <= gw; x += 6) beam(g, hx + x, gy, hx + x, gy - 8, 0.7, WOOD, t, seed + 17 + x);
    for (const k of [-1, 1]) beam(g, hx + k * gw, gy, hx + k * (gw - 10), gy + 12, 1.2, WOOD, t, seed + 18 + k);
    // The cap: a boat-shaped hood over the windshaft, a finial on top.
    const capPts: P[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      capPts.push({ x: hx + Math.cos(a) * (tw + 10), y: top + 28 + Math.sin(a) * 26 });
    }
    flat(g, capPts, cap, t, seed + 20, 1);
    g.fillStyle = t.ink(cap);
    for (let i = 1; i < 4; i++) g.fillRect(hx - tw - 10 + i * 2, top + 28 - i * 6, (tw + 10 - i * 2) * 2, 0.6);
    beam(g, hx, top + 2, hx, top - 4, 1.2, IRON, t, seed + 21);
    flat(g, ovalPts(hx, top - 5, 2, 2, seed + 22, 0.02, 8), { h: 44, s: 60, l: 50 }, t, seed + 23, 0.2);
  });
}

const windmill: DecoSkin = (rc, m, d) => {
  const rotor = d.r.mods.find((x): x is Rotor => x.type === 'rotor');
  if (!rotor) return;
  const t = hz(d);
  const ox = m.at[0] + d.off[0];
  const oy = m.at[1] + d.off[1];
  const R = rotor.hub[1] + rotor.arm + 1.5 * TILE;
  stamp(rc.s, windmillShell(m, t, rotor.hub[0] - m.at[0], rotor.hub[1] - m.at[1], R - m.at[1]), ox, oy);
};

// ------------------------------------------------------------------------------------------------ grain elevator

/** The leg's casing behind the cab from the boot to the bin tops, and the headhouse on top with its pulley and spout. */
function headhouseShell(m: Deco, t: Hz) {
  const seed = m.seed;
  const paint: HSL = [
    { h: 4, s: 46, l: 42 },
    { h: 205, s: 30, l: 44 },
    { h: 46, s: 50, l: 50 },
  ][seed % 3];
  return sprite(`farm|head|${m.w}|${m.h}|${seed}|${t.k}`, -4, -8, m.w + 60, m.h + 10, (g) => {
    const W = m.w;
    const top = 6 * TILE;
    // The leg: a corrugated trunk with guide rails either side of the shaft.
    const leg = boxPts(TILE - 3, top - 4, W - 2 * TILE + 6, m.h - top + 4, 0.5, seed, 0.1);
    flat(g, leg, STEEL, t, seed, 0.3);
    g.fillStyle = t.ink(STEEL);
    for (let x = TILE; x < W - TILE; x += 4) g.fillRect(x, top, 0.5, m.h - top);
    for (const x of [TILE - 2, W - TILE + 2]) beam(g, x, top - 4, x, m.h, 1.4, IRON, t, seed + x);
    // The headhouse: a tall shed with a gable roof, a stripe in the co-op's colour and the head pulley in its window.
    const shed = boxPts(-2, 22, W + 4, top - 22, 0.6, seed + 1, 0.15);
    flat(g, shed, { h: 200, s: 6, l: 70 }, t, seed + 1, 0.6);
    g.fillStyle = t.ink(STEEL);
    for (let x = 2; x < W; x += 5) g.fillRect(x, 24, 0.5, top - 24);
    g.fillStyle = t.c(paint);
    g.fillRect(-2, top - 22, W + 4, 5);
    flat(g, poly(-6, 23, W / 2, 0, W + 6, 23), paint, t, seed + 2, 0.6);
    flat(g, ovalPts(W / 2, 40, 9, 9, seed + 3, 0.02, 16), { h: 210, s: 30, l: 20 }, t, seed + 4, 0.2);
    g.fillStyle = t.c(STEEL, 10);
    circle(g, W / 2, 40, 6);
    g.fillStyle = t.ink(STEEL);
    circle(g, W / 2, 40, 1.6);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.fillRect(W / 2 + Math.cos(a) * 3.5 - 0.4, 40 + Math.sin(a) * 3.5 - 0.4, 0.8, 0.8);
    }
    // The spout pipe off the head, down to the bins beside it.
    beam(g, W + 1, top - 30, W + 44, top + 4, 4, STEEL, t, seed + 5);
    beam(g, W + 44, top + 4, W + 46, top + 12, 3.2, STEEL, t, seed + 6);
  });
}

const headhouse: DecoSkin = (rc, m, d) => {
  const t = hz(d);
  stamp(rc.s, headhouseShell(m, t), m.at[0] + d.off[0], m.at[1] + d.off[1]);
};

// ------------------------------------------------------------------------------------------------ barn

/** The barn's inside from its own tiles: per column, the first row under the roof, and the loft floor's row. */
function barnInside(lv: Level, m: Deco) {
  const x0 = Math.round(m.at[0] / TILE);
  const y0 = Math.round(m.at[1] / TILE);
  const w = Math.round(m.w / TILE);
  const G = y0 + Math.round(m.h / TILE);
  const roof: number[] = [];
  for (let i = 0; i < w; i++) {
    let y = y0;
    while (y < G && !solidAt(lv, x0 + i, y)) y++;
    while (y < G && solidAt(lv, x0 + i, y)) y++;
    roof.push(y);
  }
  let loft = -1;
  let best = 0;
  for (let y = y0; y < G; y++) {
    let n = 0;
    for (let i = 0; i < w; i++) if (onewayAt(lv, x0 + i, y)) n++;
    if (n > best) {
      best = n;
      loft = y;
    }
  }
  return { x0, y0, w, G, roof, loft };
}

function barnShell(lv: Level, m: Deco, t: Hz) {
  const inside = barnInside(lv, m);
  const { w, roof, loft, y0 } = inside;
  const seed = m.seed;
  return sprite(`farm|barn|${m.w}|${m.h}|${roof.join(',')}|${loft}|${seed}|${t.k}`, -2, -2, m.w + 4, m.h + 4, (g) => {
    const py = (row: number) => (row - y0) * TILE;
    const H = m.h;
    // The back wall under the roof line, boards running up it.
    const pts: P[] = [{ x: TILE, y: H }];
    for (let i = 1; i < w - 1; i++) pts.push({ x: i * TILE, y: py(roof[i]) }, { x: (i + 1) * TILE, y: py(roof[i]) });
    pts.push({ x: (w - 1) * TILE, y: H });
    flat(g, pts, BARNRED, t, seed, 0.2);
    g.save();
    path(g, pts);
    g.clip();
    g.fillStyle = t.ink(BARNRED);
    for (let x = TILE + 4; x < (w - 1) * TILE; x += 6) g.fillRect(x, 0, 0.6, H);
    // Rafters under the roof line, a tie beam, and the loft beam.
    for (let i = 1; i < w - 2; i++) beam(g, i * TILE + 8, py(roof[i]) + 3, (i + 1) * TILE + 8, py(roof[i + 1]) + 3, 2.2, WOOD, t, seed + i);
    if (loft > 0) beam(g, TILE, py(loft) + 2, (w - 1) * TILE, py(loft) + 2, 3, WOOD, t, seed + 40);
    const tie = loft > 0 ? py(loft) - 4.5 * TILE : H * 0.3;
    beam(g, TILE, tie, (w - 1) * TILE, tie, 2.2, WOOD, t, seed + 41);
    // The big back doors behind the middle of the ground floor, braced in white.
    const mid = (w * TILE) / 2;
    const dw = Math.min(3.2 * TILE, (w - 4) * TILE * 0.3);
    const dt = loft > 0 ? py(loft) + 10 : H - 4 * TILE;
    for (const k of [-1, 1]) {
      const a = mid + (k < 0 ? -dw : 0);
      flat(g, boxPts(a, dt, dw, H - dt, 0.3, seed + 50 + k), { h: 4, s: 42, l: 34 }, t, seed + 51 + k, 0.2);
      for (const [ax, ay, bx, by] of [
        [a + 1, dt + 1, a + dw - 1, H - 1],
        [a + dw - 1, dt + 1, a + 1, H - 1],
        [a + 1, dt + 1, a + dw - 1, dt + 1],
        [a + 1, H - 1, a + dw - 1, H - 1],
      ])
        beam(g, ax, ay, bx, by, 1.4, WHITE, t, seed + ax + ay);
    }
    // Hay heaped on the lofts, stall partitions and a lantern below, a pitchfork and a rake on the wall.
    if (loft > 0) {
      for (const [cx, rx] of [
        [w * 0.24, w * 0.16],
        [w * 0.78, w * 0.14],
      ]) {
        const hay = ovalPts(cx * TILE, py(loft), rx * TILE, 1.6 * TILE, seed + cx, 0.1, 18).filter((p) => p.y <= py(loft));
        flat(g, hay, HAY, t, seed + 60 + cx, 0.6);
        g.fillStyle = t.c(HAY, 16);
        for (let i = 0; i < 10; i++) {
          const sx = (cx - rx * 0.8) * TILE + hash2(i, 1, seed) * rx * 1.6 * TILE;
          const sy = py(loft) - hash2(i, 2, seed) * 1.2 * TILE;
          line(g, sx, sy, sx + 4, sy - 1, { w: 0.6, seed: seed + i, taper: [0.3, 0.6] });
        }
      }
    }
    for (let x = 2 * TILE + 8; x < (w - 2) * TILE; x += 4 * TILE) {
      if (Math.abs(x - mid) < dw + 8) continue;
      beam(g, x, H, x, H - 1.8 * TILE, 2.4, WOOD, t, seed + x);
      beam(g, x - 1.5 * TILE, H - 1.6 * TILE, x + 1.5 * TILE, H - 1.6 * TILE, 1.6, WOOD, t, seed + x + 1);
    }
    const tx = 2 * TILE;
    beam(g, tx, H - 2.6 * TILE, tx + 4, H - 0.4 * TILE, 1, LIGHTWOOD, t, seed + 70);
    for (let k = -1; k <= 1; k++) beam(g, tx + k * 2, H - 2.6 * TILE, tx + k * 2.4, H - 3.3 * TILE, 0.6, IRON, t, seed + 71 + k);
    g.restore();
    // Corner posts under the eaves: white trim down to the ground.
    for (const x of [TILE / 2, (w - 0.5) * TILE]) beam(g, x, py(roof[x < TILE ? 0 : w - 1] - 1) + TILE, x, H, 2.6, WHITE, t, seed + x);
  });
}

const barn: DecoSkin = (rc, m, d) => {
  const lv = d.o.level;
  if (!lv) return;
  const t = hz(d);
  stamp(rc.s, barnShell(lv, m, t), m.at[0] + d.off[0], m.at[1] + d.off[1]);
  const inside = barnInside(lv, m);
  if (inside.loft > 0) light(rc, m.at[0] + m.w / 2, inside.loft * TILE + 20, 70, { h: 40, s: 80, l: 70 }, 0.25);
};

// ------------------------------------------------------------------------------------------------ water mill

/** The mill's stone back wall and pit wheel, the axle out to the water wheel, its A-frame, and the flume's trough. */
function flumeShell(lv: Level, m: Deco, t: Hz, rotor: Rotor) {
  const x0 = Math.round(m.at[0] / TILE);
  const R = Math.round(m.at[1] / TILE);
  const mw = Math.round(m.w / TILE);
  let fx = x0 + mw;
  while (onewayAt(lv, fx, R)) fx++;
  const hx = rotor.hub[0] - m.at[0];
  const hy = rotor.hub[1] - m.at[1];
  const arm = rotor.arm;
  const seed = m.seed;
  const ex = (fx - x0) * TILE;
  return sprite(`farm|flume|${m.w}|${m.h}|${fx}|${hx | 0}|${hy | 0}|${arm | 0}|${seed}|${t.k}`, -4, -8, Math.max(ex, hx + arm) + 40, m.h + 10, (g) => {
    const H = m.h;
    // Coursed stone behind the rooms, a window to each storey.
    const wall = boxPts(0, 0, m.w, H, 0.4, seed, 0.1);
    flat(g, wall, { h: 30, s: 10, l: 36 }, t, seed, 0.3);
    g.fillStyle = t.ink(STONE);
    for (let y = 0, row = 0; y < H; y += 7, row++) {
      g.fillRect(0, y, m.w, 0.6);
      for (let x = (row & 1) * 6; x < m.w; x += 12) g.fillRect(x, y, 0.6, 7);
    }
    for (let y = 2 * TILE; y < H - 3 * TILE; y += 4 * TILE)
      flat(g, boxPts(m.w / 2 - 5, y, 10, 12, 4, seed + y), { h: 210, s: 30, l: 22 }, t, seed + y + 1, 0.2);
    // The pit wheel in the hall, geared to the axle.
    const gx = m.w / 2;
    const gy = H - 2.4 * TILE;
    const gr = Math.min(m.w * 0.36, 2 * TILE);
    flat(g, ovalPts(gx, gy, gr, gr, seed + 2, 0.02, 24), WOOD, t, seed + 3, 0.6);
    g.fillStyle = t.ink(WOOD);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      g.fillRect(gx + Math.cos(a) * gr - 1, gy + Math.sin(a) * gr - 1, 2, 2);
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      beam(
        g,
        gx - Math.cos(a) * gr * 0.85,
        gy - Math.sin(a) * gr * 0.85,
        gx + Math.cos(a) * gr * 0.85,
        gy + Math.sin(a) * gr * 0.85,
        1.4,
        WOOD,
        t,
        seed + 4 + i,
      );
    }
    // The axle out through the back wall to the wheel, and the A-frame it turns on, down to the ground.
    beam(g, m.w - 4, hy, hx, hy, 5, WOOD, t, seed + 10);
    for (const k of [-1, 1]) beam(g, hx, hy + 2, hx + k * arm * 0.55, H, 3, WOOD, t, seed + 11 + k);
    beam(g, hx - arm * 0.35, hy + (H - hy) * 0.62, hx + arm * 0.35, hy + (H - hy) * 0.62, 2, WOOD, t, seed + 14);
    flat(g, boxPts(hx - 6, hy - 5, 12, 10, 2, seed + 15), IRON, t, seed + 16, 0.4);
    // The flume's trough under its walkway, on brackets off the wall, water running in it.
    if (ex > m.w) {
      flat(g, boxPts(m.w, TILE, ex - m.w, 7, 0.4, seed + 20, 0.1), WOOD, t, seed + 21, 0.4);
      g.fillStyle = t.c(WATER, 8);
      g.fillRect(m.w + 1, TILE + 1, ex - m.w - 2, 2);
      for (let x = m.w + 10; x < ex - 4; x += 3 * TILE) beam(g, m.w, TILE + 4 * TILE, x, TILE + 7, 1.6, WOOD, t, seed + x);
    }
  });
}

const flume: DecoSkin = (rc, m, d) => {
  const lv = d.o.level;
  const rotor = d.r.mods.find((x): x is Rotor => x.type === 'rotor');
  if (!lv || !rotor) return;
  stamp(rc.s, flumeShell(lv, m, hz(d), rotor), m.at[0] + d.off[0], m.at[1] + d.off[1]);
};

// ------------------------------------------------------------------------------------------------ farm track

/** Trestle bents under the farm track every few tiles, X-braced, and a handrail along it. */
function trestleShell(m: Deco, t: Hz) {
  return sprite(`farm|trestle|${m.w}|${m.h}|${m.seed}|${t.k}`, -4, -18, m.w + 8, m.h + 20, (g) => {
    const n = Math.max(2, Math.round(m.w / (5 * TILE)));
    for (let i = 0; i <= n; i++) {
      const x = 4 + ((m.w - 8) * i) / n;
      for (const k of [-5, 5]) beam(g, x + k, TILE, x + k * 1.6, m.h, 2, WOOD, t, m.seed + i * 3 + k);
      beam(g, x - 8, m.h - 4, x + 8, TILE + 4, 1.2, WOOD, t, m.seed + i * 5);
      beam(g, x + 8, m.h - 4, x - 8, TILE + 4, 1.2, WOOD, t, m.seed + i * 7);
      beam(g, x - 9, TILE + 2, x + 9, TILE + 2, 2.4, WOOD, t, m.seed + i * 11);
    }
    beam(g, 0, -12, m.w, -12, 1.4, LIGHTWOOD, t, m.seed + 99);
    for (let x = 2; x < m.w; x += 2 * TILE) beam(g, x, 0, x, -13, 1.2, LIGHTWOOD, t, m.seed + x);
  });
}

const trestle: DecoSkin = (rc, m, d) => stamp(rc.s, trestleShell(m, hz(d)), m.at[0] + d.off[0], m.at[1] + d.off[1]);

// ------------------------------------------------------------------------------------------------ water wheel

/** The wheel's rim, two rings on spokes, turning with the floats (behind the terrain: the race's banks stand in front). */
const waterwheel: RotorSkin = {
  support(rc, m, d) {
    const g = rc.s;
    const hx = m.hub[0] + d.off[0];
    const hy = m.hub[1] + d.off[1];
    const a0 = rotorAngles(m, rc.frame, d.r.phase)[0];
    const t = hz(d);
    for (const r of [m.arm + 3, m.arm - 7]) {
      const ring = ovalPts(hx, hy, r, r, 3, 0, 40);
      g.fillStyle = t.ink(WOOD);
      stroke(g, [...ring, ring[0]], { w: 4.6, seed: 4, taper: [0, 0], press: 0 });
      g.fillStyle = t.c(WOOD);
      stroke(g, [...ring, ring[0]], { w: 3, seed: 5, taper: [0, 0], press: 0 });
    }
    const n = m.count;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2 + Math.PI / n;
      beam(g, hx, hy, hx + Math.cos(a) * (m.arm + 3), hy + Math.sin(a) * (m.arm + 3), 2.4, WOOD, t, 20 + i);
    }
  },
  link(rc, m, d, a) {
    const hx = m.hub[0] + d.off[0];
    const hy = m.hub[1] + d.off[1];
    pole(rc.s, hx, hy, a.x, a.y, 2.2, { h: 26, s: 34, l: 30 }, 7);
  },
  platform(rc, m, d, a: RotorArm, p) {
    // A float: a plank between two cleats, wet along its top.
    const s = rc.s;
    part(s, boxPts(p.x, p.y, p.w, p.h + 1, 0.6, 31, 0.1), { h: 28, s: 38, l: 40 }, 31, { depth: 0.6, thin: 0.45, thick: 1.1 });
    for (const x of [p.x + 2, p.x + p.w - 4])
      part(s, boxPts(x, p.y - 2.4, 2, p.h + 3.4, 0.3, 32), { h: 26, s: 30, l: 30 }, 32, { depth: 0.3, thin: 0.3, thick: 0.7 });
    s.fillStyle = css(WATER, 18, 0.9);
    s.fillRect(p.x + 4, p.y + 0.4, p.w - 8, 0.8);
    // Water still running off the floats on the way up.
    if (a.y < m.hub[1] + d.off[1]) glint(s, poly(p.x + 6, p.y + 0.6, p.x + 12, p.y + 0.5), 'rgba(235,245,255,0.85)', 0.5);
  },
  hub(rc, m, d) {
    const hx = m.hub[0] + d.off[0];
    const hy = m.hub[1] + d.off[1];
    ball(rc.s, hx, hy, 6, IRON, 41);
    const a0 = rotorAngles(m, rc.frame, d.r.phase)[0];
    for (let i = 0; i < 4; i++)
      dot(rc.s, hx + Math.cos(a0 + (i * Math.PI) / 2) * 3.6, hy + Math.sin(a0 + (i * Math.PI) / 2) * 3.6, 0.8, 42 + i, css(STEEL, 10));
  },
};

// ------------------------------------------------------------------------------------------------ live fence

/** Where the fence's wire runs: from post to post, cut short where a placed block shorts it (the sim's beam). */
function wireOf(m: Tesla, d: DrawCtx) {
  const ax = m.a[0] + d.off[0];
  const ay = m.a[1] + d.off[1];
  const bx = m.b[0] + d.off[0];
  const by = m.b[1] + d.off[1];
  const b = beamOf(d.o, d.r, d.mi);
  const span = Math.hypot(bx - ax, by - ay) || 1;
  const len = b ? Math.min(span, b.len) : span;
  return { ax, ay, bx, by, ex: ax + ((bx - ax) * len) / span, ey: ay + ((by - ay) * len) / span, hit: !!b?.hit };
}

function fencePosts(rc: RC, m: Tesla, d: DrawCtx) {
  const { ax, ay, bx, by } = wireOf(m, d);
  for (const [x, y] of [
    [ax, ay],
    [bx, by],
  ]) {
    const foot = Math.floor(y / TILE + 1) * TILE;
    pole(rc.s, x, foot + 0.5, x, y - 6, 2.2, LIGHTWOOD, x);
    for (const iy of [y - 3, y + 1]) ball(rc.s, x, iy, 1.3, { h: 40, s: 10, l: 90 }, x + iy);
  }
}

function fenceWire(rc: RC, m: Tesla, d: DrawCtx) {
  const s = rc.s;
  const g = rc.g;
  const w = wireOf(m, d);
  const c = teslaCycle(m, rc.frame, d.r.phase);
  const live: HSL = { h: 54, s: 100, l: 66 };
  // Two strands, sagging a little, dull until it's live.
  for (const off of [-3, 1]) {
    const pts: P[] = [];
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      pts.push({ x: w.ax + (w.bx - w.ax) * u, y: w.ay + off + (w.by - w.ay) * u + Math.sin(u * Math.PI) * 1.2 });
    }
    s.fillStyle = INK;
    stroke(s, pts, { w: 1, seed: off + 9, taper: [0, 0], press: 0 });
    s.fillStyle = c.seg === 2 && !w.hit ? css(live, 0, 0.9) : css(STEEL, 10);
    stroke(s, pts, { w: 0.45, seed: off + 10, taper: [0, 0], press: 0 });
  }
  // A warning sign on the first post, and the ticker's lamp blinking faster as it comes on.
  const p = c.seg === 1 ? c.t / c.len : c.seg === 2 ? 1 : 0;
  const blink = c.seg === 2 || (c.seg === 1 && Math.floor(rc.frame / Math.max(2, 8 - p * 6)) % 2 === 0);
  bulb(s, w.ax, w.ay - 7.5, 1.6, blink ? live : { h: 54, s: 30, l: 30 }, 1);
  if (c.seg === 1 && Math.random() < p * 0.5) {
    g.strokeStyle = css(live, 20, 0.6);
    g.lineWidth = 0.6;
    const u = Math.random();
    lightning(g, w.ax + (w.ex - w.ax) * u, w.ay - 1 + (w.ey - w.ay) * u, w.ax + (w.ex - w.ax) * u + 3, w.ay - 4 + (w.ey - w.ay) * u, 2, 3);
    g.stroke();
  }
  if (c.seg !== 2 || w.hit) return;
  for (let k = 0; k < 2; k++) {
    lightning(g, w.ax, w.ay - 1, w.ex, w.ey - 1, 4, 10);
    g.strokeStyle = css(live, 0, 0.35);
    g.lineWidth = 3;
    g.stroke();
    g.strokeStyle = css(live, 30, 0.95);
    g.lineWidth = 0.9;
    g.stroke();
  }
  glowDot(g, (w.ax + w.ex) / 2, (w.ay + w.ey) / 2, 10, live, 0.5);
  light(rc, (w.ax + w.ex) / 2, (w.ay + w.ey) / 2, Math.hypot(w.ex - w.ax, w.ey - w.ay) * 0.7 + 30, live, 0.8);
  if (d.o.emit && Math.random() < 0.3) d.o.emit('spark', w.ex, w.ey, (Math.random() - 0.5) * 120, -Math.random() * 120, live);
}

// ------------------------------------------------------------------------------------------------ hay hook

/** Does a hook hang from a beam (a solid tile within a couple of rows over its pivot)? Otherwise a jib holds it. */
function hungFromBeam(m: Swinger, d: DrawCtx): number | null {
  const lv = d.o.level;
  const x = Math.floor(m.hub[0] / TILE);
  const y = Math.floor(m.hub[1] / TILE);
  for (let k = 0; k <= 2; k++) if (solidAt(lv, x, y - k)) return (y - k + 1) * TILE;
  return null;
}

/** The jib that holds a hook out in the open: a post on the ground beside its swing, an arm out over the pivot, a brace. */
function hookJib(rc: RC, m: Swinger, d: DrawCtx) {
  const lv = d.o.level;
  if (!lv || hungFromBeam(m, d) !== null) return;
  const t = hz(d);
  const hx = m.hub[0] + d.off[0];
  const hy = m.hub[1] + d.off[1];
  const run = Math.floor(hy / TILE + m.arm / TILE);
  const reach = Math.ceil((m.arm / TILE) * Math.sin(m.swing) + m.radius / TILE + 1);
  const tx = Math.floor(hx / TILE);
  const side = tx - reach >= 1 && tileAt(lv, tx - reach, run + 1) !== 0 ? -1 : 1;
  const px = (tx + side * reach + 0.5) * TILE;
  const foot = (run + 1) * TILE;
  beam(rc.s, px, foot, px, hy - 6, 3.4, WOOD, t, 3);
  beam(rc.s, px, hy - 4, hx, hy - 4, 2.6, WOOD, t, 4);
  beam(rc.s, px, hy + 14, px + (hx - px) * 0.5, hy - 4, 1.6, WOOD, t, 5);
}

/** The hook block: a chain from the pivot (and on up to its beam), the pulley block, and a big iron hook under it. */
function hayHook(rc: RC, m: Swinger, d: DrawCtx) {
  const s = rc.s;
  const hx = m.hub[0] + d.off[0];
  const hy = m.hub[1] + d.off[1];
  const top = hungFromBeam(m, d);
  if (top !== null) pole(s, hx, top, hx, hy, 1.2, IRON, 1);
  ball(s, hx, hy, 2.2, IRON, 2);
  for (const h of swingHeads(m, rc.frame, d.r.phase, d.off)) {
    const n = Math.max(3, Math.round(m.arm / 4));
    for (let i = 0; i < n; i++) {
      const u0 = i / n;
      const u1 = (i + 0.7) / n;
      pole(s, hx + (h.x - hx) * u0, hy + (h.y - hy) * u0, hx + (h.x - hx) * u1, hy + (h.y - hy) * u1, 1.1, IRON, 10 + i);
    }
    s.save();
    s.translate(h.x, h.y);
    s.rotate(h.a - Math.PI / 2);
    const r = m.radius;
    part(s, boxPts(-r * 0.75, -r * 0.95, r * 1.5, r * 1.05, r * 0.3, 3), { h: 20, s: 40, l: 34 }, 3, { depth: 0.8, thin: 0.5, thick: 1.2 });
    ball(s, 0, -r * 0.45, r * 0.32, STEEL, 4);
    // The hook: a thick curl of iron with its point turned up.
    s.fillStyle = INK;
    stroke(s, poly(0, r * 0.05, 0.4, r * 0.55, -r * 0.1, r * 0.95, -r * 0.6, r * 0.75, -r * 0.62, r * 0.4), { w: 3.4, seed: 5, taper: [0, 0.4], press: 0.1 });
    s.fillStyle = css(STEEL, -6);
    stroke(s, poly(0, r * 0.05, 0.4, r * 0.55, -r * 0.1, r * 0.95, -r * 0.6, r * 0.75, -r * 0.62, r * 0.4), { w: 1.8, seed: 6, taper: [0, 0.5], press: 0.1 });
    glint(s, poly(0.6, r * 0.2, 0.9, r * 0.5), 'rgba(255,255,255,0.8)', 0.5);
    s.restore();
  }
}

// ------------------------------------------------------------------------------------------------ combine

const PAINTS: HSL[] = [
  { h: 4, s: 62, l: 44 },
  { h: 120, s: 46, l: 32 },
  { h: 46, s: 82, l: 50 },
  { h: 205, s: 50, l: 40 },
];

/** The combine over its body's cells: chassis, cab, grain tank, wheels and the header out front to the reel. */
function combine(rc: RC, m: Body, d: DrawCtx) {
  const s = rc.s;
  const xs = m.cells.map(([x]) => x * TILE + d.off[0]);
  const ys = m.cells.map(([, y]) => y * TILE + d.off[1]);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs) + TILE;
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys) + TILE;
  const paint = PAINTS[Math.floor(d.style.woodHue) % PAINTS.length];
  const deck = y1 - 2 * TILE;
  const reel = d.r.mods.find((x): x is Swinger => x.type === 'swinger');
  // The header: arms out to the reel and the cutter bar under it.
  if (reel) {
    const rx = reel.hub[0] + d.off[0];
    const ry = reel.hub[1] + d.off[1];
    pole(s, x0 + 4, deck + 6, rx, ry, 2.2, paint, 1);
    const bar = boxPts(rx - reel.arm - 3, y1 - 6, x0 + 6 - (rx - reel.arm - 3), 4, 0.6, 2);
    part(s, bar, { h: 210, s: 10, l: 40 }, 2, { depth: 0.4, thin: 0.4, thick: 1 });
    s.fillStyle = css(STEEL, 14);
    for (let x = rx - reel.arm - 2; x < x0; x += 3) {
      path(s, poly(x, y1 - 2, x + 1.5, y1 + 0.4, x + 3, y1 - 2));
      s.fill();
    }
  }
  // Chassis, the cab at the front, the grain tank behind it, the unloading auger folded along it.
  const body = boxPts(x0, deck, x1 - x0, 2 * TILE - 7, 2, 3, 0.2);
  part(s, body, paint, 3, { depth: 1.2, thin: 0.6, thick: 1.5 });
  s.fillStyle = css(paint, -18);
  s.fillRect(x0 + 2, deck + 9, x1 - x0 - 4, 1.4);
  const cabX = x0 + TILE;
  part(s, boxPts(cabX - 1, y0, TILE + 2, deck - y0 + 2, 1.2, 4), { h: 200, s: 30, l: 70 }, 4, { depth: 0.6, thin: 0.5, thick: 1.2 });
  s.fillStyle = css({ h: 200, s: 40, l: 82 });
  s.fillRect(cabX + 2, y0 + 3, TILE - 4, 7);
  glint(s, poly(cabX + 3, y0 + 9, cabX + 7, y0 + 4), 'rgba(255,255,255,0.85)', 0.6);
  const tank = boxPts(x1 - 2 * TILE, y0 + 1, 2 * TILE, deck - y0, 2, 5, 0.2);
  part(s, tank, paint, 5, { depth: 0.9, thin: 0.5, thick: 1.3 });
  // Grain heaped in the tank.
  s.fillStyle = css(HAY, 6);
  path(
    s,
    ovalPts(x1 - TILE, y0 + 2, TILE - 3, 3, 6, 0.1, 12).filter((p) => p.y <= y0 + 2),
  );
  s.fill();
  pole(s, x1 - 2, y0 + 4, x0 + TILE * 2.6, y0 + 2, 2.4, { h: 210, s: 10, l: 46 }, 7);
  pole(s, x1 - TILE * 2.2, y0, x1 - TILE * 2.2, y0 - 7, 1.6, IRON, 8);
  // Wheels: a big drive wheel under the cab, a smaller one at the back.
  for (const [wx, r] of [
    [x0 + TILE * 1.3, 8.5],
    [x1 - TILE * 0.9, 6],
  ] as const) {
    s.fillStyle = INK;
    blob(s, wx, y1 - r + 0.5, r + 1, wx, 1, 0.04);
    s.fill();
    ball(s, wx, y1 - r + 0.5, r, { h: 220, s: 8, l: 18 }, wx | 0);
    ball(s, wx, y1 - r + 0.5, r * 0.45, { h: 46, s: 70, l: 50 }, (wx | 0) + 1);
    const a = (d.off[0] / r) % (Math.PI * 2);
    for (let i = 0; i < 4; i++) dot(s, wx + Math.cos(a + (i * Math.PI) / 2) * r * 0.25, y1 - r + 0.5 + Math.sin(a + (i * Math.PI) / 2) * r * 0.25, 0.6, i);
  }
}

/** The reel: bats on arms, turning on the swinger's heads (the blades the sim hurts with), tines raking down. */
function combineReel(rc: RC, m: Swinger, d: DrawCtx) {
  const s = rc.s;
  const hx = m.hub[0] + d.off[0];
  const hy = m.hub[1] + d.off[1];
  const heads = swingHeads(m, rc.frame, d.r.phase, d.off);
  for (const h of heads) pole(s, hx, hy, h.x, h.y, 1.2, { h: 46, s: 70, l: 50 }, 3);
  for (const h of heads) {
    const tx = -Math.sin(h.a);
    const ty = Math.cos(h.a);
    const L = m.radius * 1.4;
    pole(s, h.x - tx * L, h.y - ty * L, h.x + tx * L, h.y + ty * L, 2, { h: 210, s: 12, l: 56 }, 4);
    s.fillStyle = INK;
    for (let k = -1; k <= 1; k++)
      line(s, h.x + tx * k * L * 0.7, h.y + ty * k * L * 0.7, h.x + tx * k * L * 0.7 + Math.cos(h.a) * 4, h.y + ty * k * L * 0.7 + Math.sin(h.a) * 4, {
        w: 0.6,
        seed: k,
        taper: [0, 0.6],
      });
  }
  ball(s, hx, hy, 3, { h: 46, s: 70, l: 50 }, 5);
}

// ------------------------------------------------------------------------------------------------ grain chute

function chuteSpout(rc: RC, m: Geyser, d: DrawCtx) {
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const w = m.width;
  part(rc.s, poly(x - w * 0.7, y - 1, x + w * 0.7, y - 1, x + w * 0.45, y + 5, x - w * 0.45, y + 5), STEEL, 1, { depth: 0.6, thin: 0.5, thick: 1.1 });
}

function chutePour(rc: RC, m: Geyser, d: DrawCtx) {
  const c = geyserCycle(m, rc.frame, d.r.phase);
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1] + 5;
  const w = m.width;
  const f = rc.frame;
  if (c.seg === 1) {
    // A trickle of kernels and a puff of dust: it's about to come.
    const p = c.t / c.len;
    for (let i = 0; i < 3 + p * 6; i++) {
      const u = ((f * 2 + i * 7) % 24) / 24;
      rc.s.fillStyle = css(HAY, 10);
      rc.s.fillRect(x + (hash2(i, f >> 3, 9) - 0.5) * w * 0.5, y + u * 24 * p, 1, 1.4);
    }
    rc.bg.fillStyle = `rgba(230,215,170,${0.25 * p})`;
    circle(rc.bg, x, y + 3, 4 + p * 6);
    return;
  }
  const full = beamOf(d.o, d.r, d.mi)?.len ?? m.length;
  const col = geyserColumn(m, f, d.r.phase, full, d.off[0], d.off[1]);
  if (!col) return;
  const len = col.len - 5;
  const s = rc.s;
  const body = boxPts(x - w * 0.42, y, w * 0.84, len, 1, 3, 0.4);
  s.fillStyle = css(HAY, -8, 0.95);
  path(s, body);
  s.fill();
  for (let i = 0; i < len / 3; i++) {
    const u = ((i * 3 + f * 4) % len) / len;
    s.fillStyle = css(HAY, i % 2 ? 18 : -18);
    s.fillRect(x + (hash2(i, 3, 7) - 0.5) * w * 0.7, y + u * len, 1.2, 1.8);
  }
  rc.bg.fillStyle = 'rgba(230,215,170,0.35)';
  for (let i = 0; i < 3; i++) circle(rc.bg, x + (i - 1) * w * 0.4, y + len - 2 + Math.sin(f * 0.2 + i) * 2, 5 + i * 2);
}

// ------------------------------------------------------------------------------------------------ cannons

/** The muck spreader: a cart heaped with muck on two wheels, its beaters at the back spinning up as it's about to fling. */
function muckSpreader(rc: RC, m: Cannon, _d: DrawCtx, q: CannonPose) {
  const s = rc.s;
  const { x, gy, dir, warn, recoil } = q;
  const paint = PAINTS[(m.seed >> 2) % PAINTS.length];
  const shake = warn > 0 ? Math.sin(rc.frame * 1.7) * warn * 0.8 : 0;
  const bx = x - dir * 4 + shake;
  pole(s, bx - dir * 12, gy - 6, bx - dir * 20, gy - 2, 1.4, IRON, 1);
  const cart = poly(bx - 10, gy - 15, bx + 10, gy - 15, bx + 9, gy - 6, bx - 9, gy - 6);
  part(s, cart, paint, 2, { depth: 0.8, thin: 0.5, thick: 1.3 });
  s.fillStyle = css({ h: 28, s: 40, l: 22 });
  path(
    s,
    ovalPts(bx, gy - 15, 9, 3.6, 3, 0.25, 14).filter((p) => p.y <= gy - 15),
  );
  s.fill();
  for (const wx of [bx - 5, bx + 5]) {
    ball(s, wx, gy - 4, 4, { h: 220, s: 8, l: 18 }, wx | 0);
    ball(s, wx, gy - 4, 1.6, { h: 46, s: 60, l: 50 }, (wx | 0) + 1);
  }
  // The beaters at the flinging end, a drum of tines turning faster as it winds up and after it throws.
  const drumX = bx + dir * 11;
  const spin = rc.frame * (0.1 + warn * 0.6 + recoil * 0.05);
  ball(s, drumX, gy - 11, 3.4, IRON, 4);
  s.fillStyle = INK;
  for (let i = 0; i < 4; i++) {
    const a = spin + (i * Math.PI) / 2;
    line(s, drumX, gy - 11, drumX + Math.cos(a) * 5.5, gy - 11 + Math.sin(a) * 5.5, { w: 1, seed: i, taper: [0, 0.6] });
  }
}

/** The pumpkin catapult: a timber frame, its arm winding back as it's about to throw and a pumpkin in the bucket until it does. */
function pumpkinCatapult(rc: RC, m: Cannon, d: DrawCtx, q: CannonPose) {
  const s = rc.s;
  const { x, gy, dir, warn, recoil } = q;
  void m;
  void d;
  part(s, boxPts(x - 12, gy - 4, 24, 4, 0.6, 1), WOOD, 1, { depth: 0.4, thin: 0.4, thick: 1 });
  for (const k of [-1, 1]) pole(s, x + k * 5, gy - 3, x, gy - 15, 2, WOOD, 2 + k);
  // The arm: wound back as it warns, flung up just after the shot, back at rest between.
  const rest = -0.35;
  const a = recoil > 0.2 ? -1.4 * Math.min(1, recoil) : rest + warn * 0.9;
  const px = x;
  const py = gy - 14;
  const L = 18;
  const tx = px - dir * Math.cos(a) * L;
  const ty = py + Math.sin(a) * L;
  pole(s, px + dir * Math.cos(a) * 6, py - Math.sin(a) * 6, tx, ty, 2.2, LIGHTWOOD, 5);
  ball(s, px, py, 1.6, IRON, 6);
  part(s, ovalPts(tx, ty - 1, 3.6, 2.2, 7, 0.05, 10), WOOD, 7, { depth: 0.4, thin: 0.4, thick: 0.9 });
  if (recoil < 0.2) {
    ball(s, tx, ty - 4, 4, { h: 26, s: 90, l: 50 }, 8);
    tick(s, tx, ty - 8, tx + 1, ty - 10, 0.9, 9, css({ h: 100, s: 50, l: 30 }));
  }
  // A counterweight crate on the short end.
  const cx = px + dir * Math.cos(a) * 7;
  const cy = py - Math.sin(a) * 7;
  part(s, boxPts(cx - 3.5, cy, 7, 6, 0.6, 10), { h: 30, s: 10, l: 40 }, 10, { depth: 0.4, thin: 0.4, thick: 0.9 });
}

// ------------------------------------------------------------------------------------------------ registry

/** The farm's own set pieces, module by module: the live fence, hay hooks and sack hoists, the combine and its reel, the grain chute. */
const piece: PieceSkin = (rc, layer, m: Module, d) => {
  switch (m.type) {
    case 'tesla':
      if (layer === 1) fencePosts(rc, m, d);
      if (layer === 3) fenceWire(rc, m, d);
      return layer === 1 || layer === 3;
    case 'swinger':
      if (m.head === 'mace') {
        if (layer === BACKDROP) hookJib(rc, m, d);
        if (layer === 2) hayHook(rc, m, d);
        return layer === BACKDROP || layer === 2;
      }
      if (layer === 2 && d.r.mods.some((x) => x.type === 'body')) {
        combineReel(rc, m, d);
        return true;
      }
      return false;
    case 'body':
      if (layer === 1 && d.r.mods.some((x) => x.type === 'swinger')) {
        combine(rc, m, d);
        return true;
      }
      return false;
    case 'geyser':
      if (m.look !== 'snow') return false;
      if (layer === 1) chuteSpout(rc, m, d);
      if (layer === 3) chutePour(rc, m, d);
      return layer === 1 || layer === 3;
    default:
      return false;
  }
};

export const FARM: ThemeSkins = {
  deco: { windmill, headhouse, barn, flume, trestle },
  rotor: { flywheel: waterwheel },
  cannon: { spitter: muckSpreader, totem: pumpkinCatapult },
  piece,
};
