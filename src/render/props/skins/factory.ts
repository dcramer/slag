import { css, type HSL } from '../../../core/color';
import { frac, type Rect } from '../../../core/geom';
import { TILE } from '../../../sim/constants';
import { type ModuleOf, pistonHead, pistonState, type RotorArm, rotorAngles, swingHeads } from '../../../sim/props';
import { blob, inkFor, line, type P, stroke } from '../../ink';
import { ball, bar, barLine, boxPts, dot, glint, ovalPts, part, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { light, type RC, poseFrame } from '../../kit';
import { beamOf, type DrawCtx } from '../common';
import { SHELLS } from '../modules/deco-shells';
import { groundBelowPx } from '../modules/setpiece';
import type { Deco, Rotor, ThemeSkins } from './common';
import { bands, CONCRETE, flat, FRAME, type Haze, HAZARD, hazer, IRON, member, PAINT, rivets, STEEL } from './factory-ink';
import { boilerStack, factoryFacade, factoryPiece } from './factory-works';

/**
 * Factory skins: the stage concepts' landmarks (gen/stage/factory.ts), drawn at landmark scale.
 *
 * **The Great Wheel.** Behind the terrain (the deco's shell): a riveted A-frame on concrete plinths holding
 * the axle in a pillow block, a motor in the pit driving it by a belt, a "days without incident" board on
 * the cross-tie, and the flywheel itself, a lattice rim on I-beam spokes baked once and turned with the
 * wheel. All of that is hazed toward the sky and open, so none of it reads as somewhere to stand. In front:
 * the rim cars, exactly on the decks the sim carries (steel, hazard edge, rails), and over them the saw
 * spokes, heavy riveted I-beams out to the blades, a glint running up each, and the hub boss.
 *
 * **The Stamping Line.** Behind the girder (the gantry shell): a press frame round every ram, each with its
 * crown standing up behind the walkway (twin cylinders, a gauge whose needle climbs as the ram winds up, a
 * stencilled number), hazard-banded posts down to the floor, and the conveyor's drive drums at both ends.
 * The rams, heads and belt are the modules' own art.
 */

type Swinger = ModuleOf<'swinger'>;
type Piston = ModuleOf<'piston'>;

const ringPts = (r: number, n = 64): P[] =>
  Array.from({ length: n + 1 }, (_, i) => ({ x: Math.cos((i / n) * Math.PI * 2) * r, y: Math.sin((i / n) * Math.PI * 2) * r }));

/** A closed ring of girder: its hazed tone in a thin rim of its own dark. */
function hoop(g: CanvasRenderingContext2D, r: number, w: number, base: HSL, t: Haze, seed: number, dl = 0) {
  bar(g, ringPts(r), w, t.hsl({ ...base, l: base.l + dl }), seed, { ink: t.ink(base), rim: 0.3, taper: [0, 0], press: 0 });
}

// ---------------------------------------------------------------------------
// The Great Wheel: shell.

const wheelOf = (d: DrawCtx) => d.r.mods.find((x): x is Rotor => x.type === 'rotor' && x.look === 'flywheel');
const sawsOf = (d: DrawCtx) => d.r.mods.find((x): x is Swinger => x.type === 'swinger');

/**
 * The flywheel, centred on the axle, car 0 out along +x: a lattice rim (two flanges and the web between them)
 * that the cars ride on, an inner ring, an I-beam spoke to every car and a counter-spoke between, all bolted.
 */
function flywheel(R: number, cars: number, t: Haze) {
  const pad = 10;
  return sprite(`gw|rim|${R | 0}|${cars}|${t.key}`, -R - pad, -R - pad, 2 * (R + pad), 2 * (R + pad), (g) => {
    const outer = R + 5;
    const inner = R - 8;
    // Spokes first, under the rims: a heavy one to every car, a light one between.
    for (let i = 0; i < cars * 2; i++) {
      const a = (i / (cars * 2)) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const heavy = i % 2 === 0;
      const w = heavy ? 4.2 : 2;
      member(g, c * 22, s * 22, c * inner, s * inner, w, STEEL, t, i * 13);
      if (heavy) {
        // Lightening holes down the web, so the spoke reads as open steel.
        g.fillStyle = t.ink(STEEL);
        for (let k = 0.35; k < 0.9; k += 0.18) {
          blob(g, c * inner * k, s * inner * k, 1.1, i * 7 + k * 10, 1, 0.1);
          g.fill();
        }
      }
    }
    // The inner ring, where the spokes are braced.
    const mid = R * 0.56;
    hoop(g, mid, 2, IRON, t, 3, 6);
    // The rim: two flanges and a zigzag web, open lattice all the way round.
    const n = Math.max(24, Math.round((Math.PI * 2 * R) / 11));
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const [ra, rb] = i & 1 ? [outer, inner] : [inner, outer];
      member(g, Math.cos(a0) * ra, Math.sin(a0) * ra, Math.cos(a1) * rb, Math.sin(a1) * rb, 1.1, STEEL, t, 200 + i);
    }
    for (const [r, w, sd] of [
      [outer, 3.4, 7],
      [inner, 3.8, 9],
    ] as const) {
      hoop(g, r, w, PAINT, t, sd);
    }
    // Bolts round both flanges at every third joint, and a bolted plate where each car's pin meets the rim.
    g.fillStyle = t.ink(STEEL);
    for (let i = 0; i < n; i += 3) {
      const a = ((i + 0.5) / n) * Math.PI * 2;
      for (const r of [outer, inner]) {
        blob(g, Math.cos(a) * r, Math.sin(a) * r, 0.75, i * 3 + r, 1, 0.1);
        g.fill();
      }
    }
    for (let i = 0; i < cars; i++) {
      const a = (i / cars) * Math.PI * 2;
      flat(g, ovalPts(Math.cos(a) * (R - 1.5), Math.sin(a) * (R - 1.5), 6.5, 6.5, i + 40, 0.05, 12), IRON, t, i + 41, 0.8);
    }
    // The hub disc behind the boss.
    flat(g, ovalPts(0, 0, 25, 25, 50, 0.02, 24), IRON, t, 51, 1.2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      if (i % 2) continue;
      dot(g, Math.cos(a) * 20, Math.sin(a) * 20, 0.9, i + 60, undefined, t.ink(IRON));
    }
  });
}

/**
 * The stand: an A-frame of riveted box girders from the axle's pillow block down to plinths on the ground,
 * a cross-tie with the safety board on two chains, and the drive motor between the feet. Relative to the axle.
 */
function aFrame(spread: number, drop: number, R: number, t: Haze) {
  return sprite(`gw|frame|${spread | 0}|${drop | 0}|${R | 0}|${t.key}`, -spread - 30, -24, 2 * spread + 60, drop + 26, (g) => {
    for (const k of [-1, 1]) {
      const fx = k * spread;
      // The leg: two chords and a web, a box girder you can see through.
      const ax = k * 7;
      const w = 11;
      const L = Math.hypot(fx - ax, drop);
      const nx = (drop / L) * (w / 2);
      const ny = (-(fx - ax) / L) * (w / 2);
      const steps = Math.max(4, Math.round(L / 13));
      for (let i = 0; i < steps; i++) {
        const u0 = i / steps;
        const u1 = (i + 1) / steps;
        const s0 = i & 1 ? 1 : -1;
        member(
          g,
          ax + (fx - ax) * u0 + nx * s0,
          (drop - 6) * u0 + ny * s0,
          ax + (fx - ax) * u1 - nx * s0,
          (drop - 6) * u1 - ny * s0,
          1.3,
          PAINT,
          t,
          i + k * 50,
        );
      }
      for (const s of [-1, 1]) member(g, ax + nx * s, ny * s, fx + nx * s, drop - 6 + ny * s, 3, PAINT, t, k * 9 + s);
      rivets(g, ax + nx, ny, fx + nx, drop - 6 + ny, 9, 0.7, t.ink(PAINT), k * 31);
      // Foot plate on a concrete plinth.
      flat(g, boxPts(fx - 14, drop - 9, 28, 9, 1, k * 3 + 70), CONCRETE, t, k * 3 + 71, 0.8);
      flat(g, boxPts(fx - 10, drop - 12, 20, 4, 0.6, k * 3 + 72), IRON, t, k * 3 + 73, 0.5);
      for (const ox of [-6, 6]) dot(g, fx + ox, drop - 10, 0.8, ox + k, undefined, t.ink(IRON));
    }
    // The cross-tie, at the height the rim's bottom cars pass well above.
    const ty = drop * 0.4;
    const tx = spread * 0.4 + 7;
    member(g, -tx, ty, tx, ty, 4, FRAME, t, 90);
    rivets(g, -tx + 3, ty, tx - 3, ty, 8, 0.7, t.ink(FRAME), 91);
    // The board on two chains under it: 0 days, and counting.
    const by = ty + 12;
    for (const cx of [-12, 12]) {
      g.fillStyle = t.ink(IRON);
      for (let y = ty + 2; y < by; y += 2.6) {
        blob(g, cx, y, 0.8, y * 3 + cx, 1, 0.2);
        g.fill();
      }
    }
    const board = boxPts(-19, by, 38, 21, 1.2, 95, 0.08);
    tone(g, board, t.hsl({ h: 50, s: 70, l: 74 }), { depth: 0.8 });
    pen(g, board, 96, 0.5, 1.2, 3, t.ink(HAZARD));
    g.fillStyle = t.ink(HAZARD);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 3.6px sans-serif';
    g.fillText('DAYS WITHOUT', 0, by + 4.2);
    g.fillText('INCIDENT', 0, by + 8);
    g.fillStyle = css({ h: 4, s: 80, l: 42 });
    g.font = 'bold 10px sans-serif';
    g.fillText('0', 0, by + 15.4);
    // The pillow block the axle turns in, bolted across the apex.
    flat(g, boxPts(-22, -12, 44, 22, 3, 80), IRON, t, 81, 1.4);
    flat(g, boxPts(-27, 7, 54, 7, 1, 82), PAINT, t, 83, 0.8);
    for (const ox of [-18, 18]) dot(g, ox, -6, 1, ox + 84, undefined, t.ink(IRON));
    // The drive: a motor between the feet, its pulley belted up to the axle.
    const mx = R * 0.42;
    const my = drop - 26;
    flat(g, boxPts(mx - 18, my - 4, 36, 22, 3, 100), { h: 150, s: 20, l: 34 }, t, 101, 1.2);
    for (let x = mx - 10; x < mx + 13; x += 7) tick(g, x, my + 1, x, my + 12, 0.6, x, t.ink(IRON));
    flat(g, boxPts(mx - 22, my + 16, 44, 6, 1, 102), CONCRETE, t, 103, 0.6);
  });
}

/** The belt from the motor's pulley up to the axle's: two runs, their teeth moving with the wheel. */
function belt(rc: RC, ax: number, ay: number, bx: number, by: number, ra: number, rb: number, t: Haze, shift: number) {
  const g = rc.s;
  const L = Math.hypot(bx - ax, by - ay) || 1;
  const nx = (by - ay) / L;
  const ny = -(bx - ax) / L;
  for (const [k, dir] of [
    [1, 1],
    [-1, -1],
  ] as const) {
    const x0 = ax + nx * ra * k;
    const y0 = ay + ny * ra * k;
    const x1 = bx + nx * rb * k;
    const y1 = by + ny * rb * k;
    barLine(g, x0, y0, x1, y1, 1.8, t.hsl({ h: 25, s: 25, l: 30 }), 5 + k, { ink: t.ink(IRON), rim: 0.3, taper: [0, 0], press: 0 });
    // Lugs on the belt, carried along it.
    const seg = Math.hypot(x1 - x0, y1 - y0);
    const off = frac((shift * dir) / 9) * 9;
    g.fillStyle = t.c({ h: 25, s: 20, l: 46 });
    for (let s = off; s < seg; s += 9) g.fillRect(x0 + ((x1 - x0) * s) / seg - 0.6, y0 + ((y1 - y0) * s) / seg - 0.6, 1.2, 1.2);
  }
  for (const [x, y, r] of [
    [ax, ay, ra],
    [bx, by, rb],
  ] as const) {
    g.fillStyle = t.ink(IRON);
    blob(g, x, y, r + 1, r, 1, 0.03);
    g.fill();
    g.fillStyle = t.c(IRON, 8);
    blob(g, x, y, r - 0.6, r + 1, 1, 0.03);
    g.fill();
  }
}

const greatWheelShell = (rc: RC, m: Deco, d: DrawCtx) => {
  const w = wheelOf(d);
  if (!w) return SHELLS.flywheel?.(rc, m, d);
  const t = hazer(d);
  const hx = w.hub[0] + d.off[0];
  const hy = w.hub[1] + d.off[1];
  const R = w.arm;
  // Feet where gen/stage/factory.ts put them (wheelFeet): inside the rim, on the first solid ground below.
  const spread = Math.floor((R / TILE) * 0.78) * TILE;
  const lv = d.o.level ?? null;
  const drop = Math.max(groundBelowPx(lv, hx - spread, hy + R * 0.4), groundBelowPx(lv, hx + spread, hy + R * 0.4)) - hy;
  const a = rotorAngles(w, poseFrame(rc), d.r.phase)[0];
  rc.s.save();
  rc.s.translate(hx, hy);
  rc.s.rotate(a);
  stamp(rc.s, flywheel(R, w.count, t));
  rc.s.restore();
  // The motor's pulley, then the belt to the axle, turning as fast as the rim; the near A-frame over it all.
  const mx = hx + R * 0.42;
  const my = hy + drop - 20;
  belt(rc, mx, my, hx, hy, 5, 15, t, a * R * w.dir);
  stamp(rc.s, aFrame(spread, drop, R, t), hx, hy);
  // A beacon on the pillow block, turning: the machine is running.
  const on = frac(rc.t * 0.8) < 0.5;
  const bx = hx;
  const by = hy - 25;
  member(rc.s, bx, hy - 12, bx, by + 2, 2, IRON, t, 77);
  rc.s.fillStyle = t.ink(IRON);
  blob(rc.s, bx, by, 3.4, 3, 1, 0.05);
  rc.s.fill();
  rc.s.fillStyle = on ? '#ffb02e' : '#7a4a14';
  blob(rc.s, bx, by - 0.4, 2.4, 4, 1, 0.05);
  rc.s.fill();
  if (on) light(rc, bx, by, 70, { h: 36, s: 100, l: 58 }, 0.55);
};

// ---------------------------------------------------------------------------
// The Great Wheel: in front.

/** A rim car exactly on the deck the sim carries: a steel tread, a hazard skirt, end rails (thin, they hang past) and the rim pin. */
function car(w: number, h: number, base: HSL, key: string) {
  return sprite(`gw|car|${w | 0}|${h | 0}|${key}`, -2, -12, w + 4, h + 15, (g) => {
    // Rails: two posts and a top bar, thin enough to read as fencing, not floor.
    for (const x of [2.5, w - 2.5]) barLine(g, x, 0, x, -9, 0.7, STEEL, x, { rim: 0.25 });
    barLine(g, 2, -9, w - 2, -9, 0.7, HAZARD, 4, { rim: 0.25, taper: [0, 0], press: 0.1 });
    const deck = boxPts(0, 0, w, h, 1, 7, 0.08);
    tone(g, deck, base, { depth: 0.8 });
    bands(g, 1, h * 0.45, w - 2, h * 0.5);
    glint(g, poly(1.4, 0.9, w - 1.8, 0.8), css(base, 18), 0.9, 6);
    pen(g, deck, 8, 0.45, 1.2, 3, inkFor(base));
    for (const x of [4, w - 4]) dot(g, x, 1.8, 0.5, x, css(base, 30), inkFor(base));
  });
}

/** A saw spoke: a heavy riveted I-beam from the hub out to a blade, a hazard collar short of it. */
function sawSpoke(s: CanvasRenderingContext2D, hx: number, hy: number, x: number, y: number, R: number, base: HSL, seed: number) {
  const dx = x - hx;
  const dy = y - hy;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L;
  const uy = dy / L;
  const ex = x - ux * R * 0.4;
  const ey = y - uy * R * 0.4;
  barLine(s, hx, hy, ex, ey, 6, { ...base, l: base.l - 14 }, seed, { rim: 0.45, taper: [0, 0.05], press: 0.1 });
  const k = -uy > 0 || (uy === 0 && ux < 0) ? 1 : -1;
  s.fillStyle = css(base, 14);
  line(s, hx - uy * k * 2.1, hy + ux * k * 2.1, ex - uy * k * 2.1, ey + ux * k * 2.1, { w: 1.4, seed: seed + 2, taper: [0.05, 0.1], press: 0 });
  s.fillStyle = inkFor(base);
  for (let u = 0.25; u < 0.82; u += 0.18) {
    blob(s, hx + dx * u + uy * k * 1.6, hy + dy * u - ux * k * 1.6, 0.7, seed + u * 10, 1, 0.1);
    s.fill();
  }
  // The collar: a band of hazard paint where the arm meets the blade's guard.
  const cx = x - ux * (R + 4);
  const cy = y - uy * (R + 4);
  s.save();
  s.translate(cx, cy);
  s.rotate(Math.atan2(uy, ux));
  const collar = boxPts(-3.5, -5.5, 7, 11, 1, seed + 3, 0.1);
  tone(s, collar, HAZARD, { depth: 0.5 });
  bands(s, -3.5, -5.5, 7, 11);
  pen(s, collar, seed + 4, 0.5, 1.2, 3, inkFor(HAZARD));
  s.restore();
}

/** A glint running out along a spoke to the blade every couple of seconds: the saws are always out. */
function spokeGlint(s: CanvasRenderingContext2D, hx: number, hy: number, x: number, y: number, u: number) {
  if (u > 0.85) return;
  const px = hx + (x - hx) * u;
  const py = hy + (y - hy) * u;
  const L = Math.hypot(x - hx, y - hy) || 1;
  const tx = ((x - hx) / L) * 6;
  const ty = ((y - hy) / L) * 6;
  glint(s, poly(px - tx, py - ty, px, py, px + tx, py + ty), 'rgba(255,250,235,0.9)', 1.3, 7);
}

const greatWheel = {
  // The shell is the deco's; the rotor's own support stays out of the way.
  support: () => undefined,
  link: () => undefined,
  platform(rc: RC, m: Rotor, d: DrawCtx, _a: RotorArm, p: Rect) {
    stamp(rc.s, car(p.w, p.h, d.pal.base, `${d.pal.base.h},${d.pal.base.l}`), p.x, p.y);
    ball(rc.s, p.x + p.w / 2, p.y + p.h / 2, 2.4, d.pal.dark, 9);
    void m;
  },
  hub(rc: RC, m: Rotor, d: DrawCtx) {
    const s = rc.s;
    const hx = m.hub[0] + d.off[0];
    const hy = m.hub[1] + d.off[1];
    const saws = sawsOf(d);
    if (saws) {
      const heads = swingHeads(saws, poseFrame(rc), d.r.phase, d.off);
      heads.forEach((h, i) => sawSpoke(s, hx, hy, h.x, h.y, saws.radius, d.pal.base, 300 + i * 7));
      const u = frac(rc.t * 0.45);
      for (const h of heads) spokeGlint(s, hx, hy, h.x, h.y, u * 1.3);
    }
    // The boss: a domed cap with a bolt circle that turns with the wheel, and the axle nut.
    const a = rotorAngles(m, poseFrame(rc), d.r.phase)[0];
    const R = 15;
    ball(s, hx, hy, R, d.pal.base, 131);
    s.fillStyle = css(d.pal.dark, 4, 0.9);
    stroke(
      s,
      ringPts(R * 0.72, 32).map((q) => ({ x: q.x + hx, y: q.y + hy })),
      { w: 0.9, seed: 3, taper: [0.12, 0.2], press: 0.3 },
    );
    for (let i = 0; i < 8; i++) {
      const b = a + (i / 8) * Math.PI * 2;
      dot(s, hx + Math.cos(b) * R * 0.72, hy + Math.sin(b) * R * 0.72, 1.3, 140 + i, css(d.pal.spec, -6), inkFor(d.pal.base));
    }
    part(s, ovalPts(hx, hy, 5, 5, 7, 0.02, 6), { h: 44, s: 60, l: 50 }, 8, { depth: 0.6, thin: 0.5, thick: 1 });
  },
};

// ---------------------------------------------------------------------------
// The Stamping Line: shell.

/**
 * One press's frame, from the girder's top (y 0) to the floor (`down`), `w` wide round its ram: the crown
 * standing up behind the walkway, posts down each side with hazard feet, and the press's number.
 */
function pressFrame(w: number, down: number, crown: number, n: number, t: Haze) {
  return sprite(`sl|frame|${w | 0}|${down | 0}|${crown | 0}|${n}|${t.key}`, -w / 2 - 14, -crown - 6, w + 28, down + crown + 8, (g) => {
    const half = w / 2 + 6;
    for (const k of [-1, 1]) {
      const x = k * half;
      member(g, x, -crown + 8, x, down - 2, 5, PAINT, t, k * 5 + n);
      rivets(g, x, -crown + 12, x, down - 10, 9, 0.7, t.ink(PAINT), k * 9 + n);
      bands(g, x - 3.5, down - 13, 7, 11, t);
      flat(g, boxPts(x - 7, down - 3, 14, 3, 0.5, k + n), IRON, t, k + n + 1, 0.5);
    }
    // The crown: a housing over both posts, two cylinders on it, a gauge and the number.
    const cw = w + 22;
    flat(g, boxPts(-cw / 2, -crown + 6, cw, crown - 4, 4, n + 10), PAINT, t, n + 11, 1.4);
    for (const k of [-1, 1]) {
      const cx = k * w * 0.24;
      flat(g, boxPts(cx - 5, -crown - 4, 10, 14, 4, n + k + 20), STEEL, t, n + k + 21, 1);
      g.fillStyle = t.ink(STEEL);
      line(g, cx + k * 5, -crown + 2, cx + k * 12, -crown + 16, { w: 1.2, seed: n + k, taper: [0.05, 0.05], press: 0.1 });
    }
    bands(g, -cw / 2 + 2, -4, cw - 4, 4, t);
    g.fillStyle = t.c({ h: 48, s: 30, l: 86 });
    g.font = 'bold 9px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(n), -w * 0.14, -crown * 0.45);
    // The gauge's face; its needle is drawn live.
    flat(g, ovalPts(w * 0.22, -crown * 0.45, 5, 5, n + 30, 0.02, 14), { h: 45, s: 20, l: 82 }, t, n + 31, 0.5);
  });
}

/** The conveyor's drive drum at one end of the line, behind the belt. */
function drum(t: Haze) {
  return sprite(`sl|drum|${t.key}`, -12, -12, 24, 24, (g) => {
    flat(g, ovalPts(0, 0, 10, 10, 3, 0.02, 20), IRON, t, 4, 1.2);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      member(g, 0, 0, Math.cos(a) * 8, Math.sin(a) * 8, 1, STEEL, t, i);
    }
  });
}

const stampingLineShell = (rc: RC, m: Deco, d: DrawCtx) => {
  const presses = d.r.mods.filter((x): x is Piston => x.type === 'piston');
  if (!presses.length) return SHELLS.gantry?.(rc, m, d);
  const t = hazer(d);
  const s = rc.s;
  const x0 = m.at[0] + d.off[0];
  const top = m.at[1] + d.off[1] - TILE;
  const floor = m.at[1] + d.off[1] + m.h + TILE;
  const crown = 2.4 * TILE;
  // Drive drums at both ends of the bed.
  for (const x of [x0 - 4, x0 + m.w + 4]) stamp(s, drum(t), x, floor - TILE * 0.5);
  presses
    .slice()
    .sort((a, b) => a.at[0] - b.at[0])
    .forEach((p, i) => {
      const cx = p.at[0] + d.off[0];
      stamp(s, pressFrame(p.width, floor - top, crown, i + 1, t), cx, top);
      // The ram's bulk behind its rod, down to the head wherever the stroke has it.
      const st = pistonState(p, poseFrame(rc), d.r.phase);
      const head = pistonHead(p, st.ext, d.off, beamOf(d.o, d.r, d.r.mods.indexOf(p))?.len);
      const rw = p.width * 0.46;
      const ram = boxPts(cx - rw / 2, m.at[1] + d.off[1] - 2, rw, Math.max(4, head.y - (m.at[1] + d.off[1]) + 2), 1.2, 7 + i, 0.05);
      tone(s, ram, t.hsl(STEEL), { depth: 1.2 });
      s.fillStyle = t.c(STEEL, 22);
      s.fillRect(cx - rw / 2 + 2, m.at[1] + d.off[1], 1.4, Math.max(0, head.y - (m.at[1] + d.off[1]) - 2));
      pen(s, ram, 9 + i, 0.4, 1.1, 3, t.ink(STEEL));
      // The gauge's needle climbs through the stroke and falls back as the ram rests: the press's own clock.
      const a = Math.PI * (0.8 + 1.4 * st.ext);
      const gx = cx + p.width * 0.22;
      const gy = top - crown * 0.45;
      s.fillStyle = t.ink(HAZARD);
      line(s, gx, gy, gx + Math.cos(a) * 4, gy + Math.sin(a) * 4, { w: 0.8, seed: i, taper: [0, 0.4], press: 0 });
      if (st.slamming) light(rc, cx, floor - TILE, 40, { h: 30, s: 90, l: 60 }, 0.35);
    });
};

/** Factory skins: the great wheel's rim cars and hub, and the shells behind the great wheel and the stamping line. */
export const FACTORY: ThemeSkins = {
  rotor: { flywheel: greatWheel },
  deco: { flywheel: greatWheelShell, gantry: stampingLineShell, facade: factoryFacade, smokestack: boilerStack },
  piece: factoryPiece,
};
