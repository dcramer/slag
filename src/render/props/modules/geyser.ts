import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { dirOf, geyserColumn, geyserCycle, geyserWind, type GeyserLook, type ModuleOf } from '../../../sim/props';
import { windProfile, windSpeed } from '../../../sim/wind';
import { blob, inkFor, line, type P, stroke } from '../../ink';
import { boxPts, ovalPts, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { circle, ellipse, glowDot, light, type RC } from '../../kit';
import type { ThemeId } from '../../../themes';
import { beamOf, type DrawCtx, defineArt } from '../common';
import { themeOf } from '../skins';

/**
 * Geyser art: a vent, a rumbling telegraph, and the erupting column, drawn from geyserCycle /
 * geyserColumn / geyserWind, the sim's own cycle and shapes. Three readable phases, all on the sim frame:
 * dormant (still: nothing moves, nothing pushes), rumbling (shake, sputter and a growing plume: the
 * warning), erupting (the column; what rides it travels at the push's air speed).
 *
 * A geyser can aim any of the four ways: up from a vent mound, or sideways and down out of a mouth in
 * the rock (a wave along the ground, an avalanche, a waterfall). Everything is drawn in the column's own
 * frame (`Aim`), where it always rises along local -y from the vent.
 */

type Geyser = ModuleOf<'geyser'>;

/** What a vent erupts, by theme: the volcano's lava, the glacier's frost, a space station's solar flares. */
interface VentLook {
  rock: HSL;
  lava: HSL;
  hot: HSL;
  /** Steam puff color as "r,g,b". */
  steam: string;
  crust: Crust;
  /** A flare loop arcs off the top of the column. */
  loop?: boolean;
  /** Snowflakes ride the column. */
  flakes?: boolean;
}

type Crust = 'sulphur' | 'ice' | 'slime' | 'wet';

const VOLCANO: VentLook = {
  rock: { h: 30, s: 12, l: 40 },
  lava: { h: 22, s: 100, l: 52 },
  hot: { h: 42, s: 100, l: 66 },
  steam: '240,244,248',
  crust: 'sulphur',
};
const VENTS: Partial<Record<ThemeId, VentLook>> = {
  glacier: { ...VOLCANO, rock: { h: 200, s: 26, l: 70 }, steam: '228,242,255', crust: 'ice', flakes: true },
  space: { ...VOLCANO, lava: { h: 40, s: 100, l: 56 }, hot: { h: 52, s: 100, l: 84 }, loop: true },
};
const ventOf = (d: DrawCtx): VentLook => VENTS[themeOf(d) ?? 'farm'] ?? VOLCANO;

/**
 * The stage-concept columns: a body in flat bands (outer to core), what rides it, and the rock round
 * its vent. Water and toxic sludge are liquids that pour; snow is a billowing avalanche.
 */
interface Flow {
  /** Band widths (fractions of the column's width) and tones, outer first. */
  bands: readonly (readonly [number, string])[];
  ink: string;
  /** Edge ripple (px) and how lumpy the outline is: liquid ripples, snow billows. */
  ripple: number;
  billow: number;
  /** Streaks, bubbles or chunks carried along at the air speed. */
  rider: 'foam' | 'bubble' | 'chunk';
  /** Crown blobs at the tip, light and shade. */
  crest: readonly [string, string];
  rock: HSL;
  crust: Crust;
  /** Particle tint for spray and spatter. */
  spray: HSL;
}

const FLOWS: Partial<Record<GeyserLook, Flow>> = {
  water: {
    bands: [
      [0.62, 'hsl(212 62% 34%)'],
      [0.5, 'hsl(203 70% 48%)'],
      [0.3, 'hsl(196 76% 66%)'],
      [0.09, 'hsl(190 80% 90%)'],
    ],
    ink: inkFor({ h: 212, s: 62, l: 34 }),
    ripple: 1.1,
    billow: 0,
    rider: 'foam',
    crest: ['hsl(195 60% 96%)', 'hsl(200 45% 76%)'],
    rock: { h: 150, s: 10, l: 34 },
    crust: 'wet',
    spray: { h: 198, s: 70, l: 84 },
  },
  toxic: {
    bands: [
      [0.64, 'hsl(110 58% 20%)'],
      [0.52, 'hsl(96 70% 36%)'],
      [0.32, 'hsl(84 82% 52%)'],
      [0.1, 'hsl(72 90% 76%)'],
    ],
    ink: inkFor({ h: 110, s: 58, l: 20 }),
    ripple: 1.4,
    billow: 0.12,
    rider: 'bubble',
    crest: ['hsl(78 88% 62%)', 'hsl(98 62% 30%)'],
    rock: { h: 30, s: 22, l: 26 },
    crust: 'slime',
    spray: { h: 84, s: 80, l: 50 },
  },
  snow: {
    bands: [
      [0.7, 'hsl(214 26% 62%)'],
      [0.58, 'hsl(206 36% 82%)'],
      [0.34, 'hsl(200 40% 94%)'],
    ],
    ink: inkFor({ h: 214, s: 26, l: 62 }),
    ripple: 0.4,
    billow: 0.3,
    rider: 'chunk',
    crest: ['hsl(200 40% 97%)', 'hsl(210 30% 74%)'],
    rock: { h: 205, s: 18, l: 62 },
    crust: 'ice',
    spray: { h: 205, s: 40, l: 95 },
  },
};

/** The column's frame: the vent at the origin, the column rising along local -y however it's aimed. */
interface Aim {
  x: number;
  y: number;
  c: number;
  s: number;
  /** Aimed up, out of a vent mound (otherwise out of a mouth in a wall or ceiling). */
  up: boolean;
}

function aimOf(m: Geyser, x: number, y: number): Aim {
  const [dx, dy] = dirOf(m.angle);
  return { x, y, c: -dy, s: dx, up: dy < 0 };
}

function enter(g: CanvasRenderingContext2D, a: Aim) {
  g.save();
  g.transform(a.c, a.s, -a.s, a.c, a.x, a.y);
}

/** A point in the column's frame, in the world: for lights and particles, which don't go through the canvas. */
const wx = (a: Aim, u: number, v: number) => a.x + a.c * u - a.s * v;
const wy = (a: Aim, u: number, v: number) => a.y + a.s * u + a.c * v;
/** A velocity in the column's frame, in the world. */
const vx = (a: Aim, u: number, v: number) => a.c * u - a.s * v;
const vy = (a: Aim, u: number, v: number) => a.s * u + a.c * v;

function isPit(m: Geyser, d: DrawCtx): boolean {
  return !!d.o.level && m.at[1] >= d.o.level.h * TILE - 1;
}

/**
 * The vent: a fissure in the ground, not a mound you'd walk into. A spatter rim no taller than a fitting
 * (under 3 px, like the mouth) round a wide dark crater, cracks running off across the surface on both
 * sides, rubble on the lip and the look's crust in the cracks. Wide enough to read from across the level,
 * flat enough not to read as footing. Baked.
 */
function ventMound(w: number, rock: HSL, lava: boolean, crust: Crust) {
  const cr = Math.max(4.5, w * 0.55 + 2);
  const hw = cr + 7;
  return sprite(`gy|vent2|${w.toFixed(1)}|${rock.h},${rock.l}|${lava}|${crust}`, -hw - 12, -5, hw * 2 + 24, 9, (g) => {
    const crack = lava ? css({ h: 22, s: 100, l: 55 }) : css(rock, -30, 1, 4);
    // Cracks off across the ground, both ways, forking.
    for (const sx of [-1, 1]) {
      const x0 = sx * (cr + 1);
      const x1 = sx * (hw + 9);
      const run = poly(x0, 0.4, x0 + sx * 4, 1.2, x0 + sx * 8, 0.7, x1, 1.6);
      g.fillStyle = inkFor(rock);
      stroke(g, run, { w: 1.1, seed: sx + 3, taper: [0.1, 0.9], press: 0.3 });
      g.fillStyle = crack;
      stroke(g, run, { w: 0.55, seed: sx + 3, taper: [0.1, 0.9], press: 0.3 });
      g.fillStyle = inkFor(rock);
      stroke(g, poly(x0 + sx * 4, 1.2, x0 + sx * 6.5, 2.8, x0 + sx * 7.4, 3.6), { w: 0.7, seed: sx + 5, taper: [0.1, 0.9], press: 0.2 });
    }
    // The crater, dark, its back wall lit.
    g.fillStyle = lava ? css({ h: 12, s: 60, l: 14 }) : inkFor(rock);
    path(g, ovalPts(0, -0.9, cr + 0.6, 1.9, 4, 0.05, 18));
    g.fill();
    g.fillStyle = css(rock, -8);
    path(g, poly(-cr + 0.4, -1.6, -cr * 0.4, -2.5, cr * 0.5, -2.5, cr - 0.4, -1.6, cr * 0.4, -2, -cr * 0.4, -2));
    g.fill();
    // The spatter rim: two low lips, highest at the crater.
    const lipL = poly(-hw, 0.6, -hw + 2.4, -0.8, -cr - 2.6, -2.2, -cr - 0.4, -2.6, -cr + 0.6, -1.2, -cr + 0.2, 0.6);
    const lipR = poly(cr - 0.2, 0.6, cr - 0.6, -1.2, cr + 0.4, -2.7, cr + 2.8, -2.3, hw - 2.2, -0.9, hw, 0.6);
    part(g, lipL, rock, 3, { depth: 0.8, shade: -18, thin: 0.45, thick: 1.3 });
    part(g, lipR, { ...rock, l: rock.l + 4 }, 4, { depth: 0.8, shade: -20, thin: 0.45, thick: 1.3 });
    tick(g, -hw + 3, -0.6, -cr - 1.6, -1.8, 0.4, 9, css(rock, 16));
    tick(g, cr + 1.4, -2, hw - 3, -0.7, 0.4, 10, css(rock, 16));
    tick(g, -cr - 2.8, -1.8, -cr - 2.2, 0.4, 0.45, 11, crack);
    tick(g, cr + 3.2, -1.9, cr + 3.8, 0.4, 0.45, 12, crack);
    // Rubble thrown up on the lips.
    for (const [x, y, r] of [
      [-hw + 1.4, -0.6, 0.9],
      [-cr - 4.2, -1.9, 0.7],
      [cr + 5, -1.8, 0.8],
      [hw - 1, -0.5, 0.7],
    ])
      part(g, ovalPts(x, y, r * 1.2, r, x * 7, 0.15, 7), { ...rock, l: rock.l - 6 }, x + 20, { depth: 0.2, thin: 0.25, thick: 0.6 });
    if (lava) return;
    if (crust === 'ice') {
      for (const [dx, r] of [
        [-cr - 1.8, 1.5],
        [cr + 2, 1.3],
        [-hw + 3.4, 1],
        [hw - 4, 1.1],
      ])
        part(g, poly(dx, -2.2 - r * 1.4, dx + r * 0.7, -1.4, dx, -0.8, dx - r * 0.7, -1.4), { h: 195, s: 50, l: 94 }, dx, {
          depth: 0.2,
          thin: 0.25,
          thick: 0.5,
          ink: '#16364d',
        });
    } else if (crust === 'wet') {
      g.fillStyle = css(rock, -14);
      path(g, poly(-cr, -1.2, cr, -1.2, cr * 0.6, 0.6, -cr * 0.6, 0.6));
      g.fill();
      g.fillStyle = 'hsl(96 40% 34%)';
      blob(g, -cr - 3, -1.6, 1.3, 4, 0.6, 0.3);
      g.fill();
      blob(g, cr + 4, -1.4, 1.1, 5, 0.6, 0.3);
      g.fill();
    } else {
      const [lit, shade] = crust === 'slime' ? ['#9ad62e', '#3f6a12'] : ['#e6d25a', '#a8902a'];
      for (const [dx, dy, r] of [
        [-cr - 1.4, -2.4, 1.2],
        [cr + 1.8, -2.5, 1],
        [-hw + 4, -0.9, 0.8],
        [hw - 4.6, -0.9, 0.9],
      ]) {
        g.fillStyle = lit;
        blob(g, dx, dy, r, dx + 9, 1, 0.25);
        g.fill();
        g.fillStyle = shade;
        blob(g, dx + r * 0.3, dy + r * 0.35, r * 0.5, dx + 3, 1, 0.2);
        g.fill();
      }
    }
  });
}

/**
 * A mouth in a wall or a ceiling, for a column aimed sideways or down: a ring of hewn stone set flush in
 * the face round a dark hole, and the look's own crust on its lip. Drawn in the column's frame, so the
 * face is local y = 0 and the rock is +y; it stands out of the face by under 3 px, so it reads as a
 * fitting on the wall, not a ledge.
 */
function mouth(w: number, rock: HSL, crust: Crust) {
  const hw = Math.max(5, w * 0.5 + 2.6);
  return sprite(`gy|mouth|${hw.toFixed(1)}|${rock.h},${rock.l}|${crust}`, -hw - 2, -4, hw * 2 + 4, 10, (g) => {
    const rim = ovalPts(0, 1.2, hw, 3.6, 11, 0.06, 18);
    part(g, rim, rock, 6, { depth: 0.9, shade: -18, thin: 0.45, thick: 1.2 });
    // The hole, with the lit back of the bore inside it.
    const hole = ovalPts(0, 0.9, hw - 2, 2.1, 12, 0.05, 14);
    g.fillStyle = inkFor(rock);
    path(g, hole);
    g.fill();
    g.fillStyle = css(rock, -22);
    path(g, ovalPts(0, 1.8, hw - 3, 0.9, 13, 0.05, 12));
    g.fill();
    // Joints between the stones.
    for (const k of [-0.62, 0, 0.62]) tick(g, k * hw, -2.2, k * hw * 1.05, -1.2, 0.4, k * 10 + 20, css(rock, -26));
    if (crust === 'slime') {
      g.fillStyle = '#7fbf22';
      for (const k of [-0.5, 0.15, 0.6]) {
        blob(g, k * hw, -1.6, 0.9, k * 7 + 3, 0.7, 0.2);
        g.fill();
      }
      g.fillStyle = '#3f6a12';
      stroke(g, poly(-hw * 0.5, -1.2, -hw * 0.48, 0.6), { w: 0.8, seed: 2, taper: [0.1, 0.8], press: 0 });
    } else if (crust === 'ice') {
      // A snow cornice along the lip.
      const cap = poly(-hw - 1, -1.4, -hw * 0.5, -3.2, 0, -3.6, hw * 0.55, -3.1, hw + 1, -1.2, hw * 0.4, -1.8, -hw * 0.4, -1.9);
      part(g, cap, { h: 200, s: 40, l: 95 }, 9, { depth: 0.3, shade: -12, thin: 0.25, thick: 0.6, ink: '#24384f' });
    } else if (crust === 'wet') {
      g.fillStyle = 'hsl(96 40% 34%)';
      blob(g, -hw * 0.7, -1.8, 1.2, 4, 0.6, 0.3);
      g.fill();
      blob(g, hw * 0.55, -2.2, 0.9, 6, 0.6, 0.3);
      g.fill();
    }
  });
}

/**
 * The Floor Is Lava: a couch cushion beside the plume, half sunk, tilted and smoking. It's a joke, not a
 * step: it sits low in the lava with the lava lapping over it, so nothing about it reads as footing.
 */
function cushion() {
  return sprite('gy|cushion', -9, -6, 18, 11, (g) => {
    g.save();
    g.rotate(-0.32);
    const c: HSL = { h: 168, s: 40, l: 42 };
    part(g, boxPts(-7, -3.5, 14, 6, 2.6, 7), c, 7, { depth: 0.9, thin: 0.5, thick: 1.1 });
    tick(g, -6, -0.6, 6, -0.6, 0.45, 8, css(c, -20));
    g.fillStyle = inkFor(c);
    blob(g, -1, -1.6, 0.7, 9, 1, 0.1);
    g.fill();
    g.restore();
    // Lava lapping over its lower half.
    const lap = poly(-9, 1.2, -5, 0.4, -1, 1.4, 3, 0.2, 7, 1.2, 9, 0.6, 9, 5, -9, 5);
    g.fillStyle = css({ h: 18, s: 100, l: 50 });
    path(g, lap);
    g.fill();
    g.fillStyle = css({ h: 40, s: 100, l: 66 });
    for (const [lx, ly] of [
      [-6, 2],
      [1, 2.4],
      [6, 2],
    ])
      g.fillRect(lx, ly, 2.2, 0.6);
  });
}

function drawVent(rc: RC, m: Geyser, d: DrawCtx) {
  const up = dirOf(m.angle)[1] < 0;
  if (up && isPit(m, d)) {
    if (m.look === 'lava' && themeOf(d) === 'volcano') {
      const cx = m.at[0] + d.off[0] + m.width + 10;
      const cy = m.at[1] + d.off[1] - 5 + Math.sin(rc.t * 1.3 + d.r.pp.uid) * 0.4;
      stamp(rc.s, cushion(), cx, cy);
      if (d.o.emit && Math.random() < 0.04) d.o.emit('smoke', cx + 2, cy - 4, (Math.random() - 0.5) * 6, -16, { h: 0, s: 0, l: 40 });
    }
    return;
  }
  const s = rc.s;
  const g = rc.g;
  const c = geyserCycle(m, rc.frame, d.r.phase);
  const shake = c.seg === 1 ? Math.sin(rc.frame * 1.9) * (0.4 + (c.t / c.len) * 1.1) : 0;
  const a = aimOf(m, m.at[0] + d.off[0], m.at[1] + d.off[1]);
  const lava = m.look === 'lava';
  const v = ventOf(d);
  const flow = FLOWS[m.look];
  const rock: HSL = flow ? flow.rock : lava ? { h: 260, s: 10, l: 19 } : v.rock;
  const crust = flow ? flow.crust : v.crust;
  enter(s, a);
  if (up) stamp(s, ventMound(m.width, rock, lava, crust), shake, 0);
  else stamp(s, mouth(m.width, rock, crust), shake, 0);
  s.restore();
  const heat = c.seg === 1 ? c.t / c.len : c.seg === 2 ? 1 : 0;
  if (lava) {
    const lip = up ? -1.2 : -0.6;
    enter(g, a);
    g.fillStyle = css(v.lava, 10, 0.4 + heat * 0.6);
    ellipse(g, shake, lip, 3.8, 1.2);
    glowDot(g, shake, lip - 0.4, 6 + heat * 12, v.lava, 0.35 + heat * 0.5);
    g.restore();
    light(rc, wx(a, 0, lip - 1.4), wy(a, 0, lip - 1.4), 30 + heat * 50, v.lava, 0.25 + heat * 0.7);
  }
}

/** A column body in flat bands, its edges rippling: outer band first, each one narrower and lighter. */
function bands(s: CanvasRenderingContext2D, flow: Flow, len: number, w: number, k: number, from: number, t: number, f: number, step: number) {
  const n = Math.max(4, Math.ceil(len / (flow.billow ? 1.6 : 5)));
  // Billows: rounded lumps with a pinch between them, like a cloud's edge. They travel with the flow,
  // keyed to how far the stuff has come, not to where it is.
  const lump = (v: number, phase: number) => 1 + flow.billow * (Math.abs(Math.sin((-v - f * step) * 0.17 + phase)) * 2 - 1);
  for (const [wk, col] of flow.bands) {
    s.fillStyle = col;
    s.beginPath();
    for (let i = 0; i <= n; i++) {
      const v = from - (len * i) / n;
      s.lineTo(-w * wk * k * lump(v, 1.1) - Math.sin(t * 15 + v * 0.26) * flow.ripple * wk, v);
    }
    for (let i = n; i >= 0; i--) {
      const v = from - (len * i) / n;
      s.lineTo(w * wk * k * lump(v, 2.7) + Math.sin(t * 13 + v * 0.34) * flow.ripple * wk, v);
    }
    s.closePath();
    s.fill();
  }
}

/** Water, sludge or snow, erupting: the banded body, what it carries, a crest where it stops, and spray. */
function drawFlow(rc: RC, m: Geyser, d: DrawCtx, a: Aim, flow: Flow, len: number, k: number, from: number) {
  const s = rc.s;
  const f = rc.frame;
  const w = m.width;
  const step = (m.lethal ? 160 : windSpeed(m.strength)) / 60;
  const body = Math.max(1, len + from);
  const top = -len;
  enter(s, a);
  bands(s, flow, body, w, k, from, rc.t, f, step);
  // Its riders, carried at the air speed.
  const gap = flow.rider === 'foam' ? 7 : flow.rider === 'bubble' ? 9 : 8;
  for (let i = 0; i < body / gap; i++) {
    const along = (i * gap + f * step) % body;
    const v = from - along;
    const u = Math.sin(i * 2.3 + 0.7) * w * 0.32 * k;
    if (flow.rider === 'foam') {
      s.fillStyle = 'rgba(240,250,255,0.95)';
      line(s, u, v, u + Math.sin(i) * 0.4, v - 3.2, { w: 0.9, seed: i, taper: [0.3, 0.5], press: 0 });
    } else if (flow.rider === 'bubble') {
      const r = 0.7 + (i % 3) * 0.35;
      s.fillStyle = flow.ink;
      blob(s, u, v, r + 0.45, i, 1, 0.1);
      s.fill();
      s.fillStyle = flow.bands[2][1];
      blob(s, u, v, r, i + 1, 1, 0.1);
      s.fill();
      s.fillStyle = 'rgba(245,255,220,0.95)';
      s.fillRect(u - r * 0.5, v - r * 0.6, r * 0.5, r * 0.45);
    } else {
      // Snow: tumbling clods, shaded underneath, out past the body's edge.
      const cu = Math.sin(i * 1.7 + 0.3) * w * 0.55 * k;
      const r = 1 + (i % 3) * 0.45;
      s.fillStyle = flow.crest[1];
      blob(s, cu + 0.3, v + 0.4, r, i, 0.9, 0.25);
      s.fill();
      s.fillStyle = flow.crest[0];
      blob(s, cu, v, r * 0.8, i + 2, 0.9, 0.25);
      s.fill();
    }
  }
  // The crest where it stops: a crown of lumps, bobbing.
  for (let i = 0; i < 5; i++) {
    const u = (i - 2) * w * 0.26 * k;
    const r = (w * 0.24 + (i % 2) * 1.2) * k;
    const bob = Math.sin(rc.t * 9 + i * 1.9) * 1.1;
    const v = top + 1.5 + Math.abs(i - 2) * 1.3 + bob;
    s.fillStyle = flow.crest[1];
    blob(s, u + 0.4, v + 0.6, r, i + 5, 1, 0.25);
    s.fill();
    s.fillStyle = flow.crest[0];
    blob(s, u - 0.2, v - 0.2, r * 0.82, i + 9, 1, 0.25);
    s.fill();
  }
  s.restore();
  if (d.o.emit && Math.random() < 0.45) {
    const u = (Math.random() - 0.5) * w;
    d.o.emit(
      'debris',
      wx(a, u, top + 2),
      wy(a, u, top + 2),
      vx(a, (Math.random() - 0.5) * 90, -30 - Math.random() * 50),
      vy(a, (Math.random() - 0.5) * 90, -30 - Math.random() * 50),
      flow.spray,
    );
  }
  if (flow.rider === 'chunk') {
    // Flakes in the air round an avalanche, on the emissive-free background.
    rc.bg.fillStyle = 'rgba(245,250,255,0.85)';
    for (let i = 0; i < 8; i++) {
      const along = (i * 11 + f * step * 0.9) % (len + 6);
      const u = Math.sin(i * 2.9 + f * 0.06) * w * 0.9;
      rc.bg.fillRect(wx(a, u, -along) - 0.5, wy(a, u, -along) - 0.5, 1, 1);
    }
  }
}

/** Rumbling, for a flow: a swelling bulge at the vent that spits, faster as it nears the eruption. */
function flowWarn(rc: RC, m: Geyser, d: DrawCtx, a: Aim, flow: Flow, p: number, from: number) {
  const s = rc.s;
  const f = rc.frame;
  const pulse = 0.5 + 0.5 * Math.sin(f * (0.25 + p * 0.6));
  const r = (m.width * 0.25 + p * m.width * 0.3) * (0.8 + 0.2 * pulse);
  enter(s, a);
  if (flow.rider === 'chunk') {
    // Snow: a cornice that bulges and sheds clods before it lets go.
    for (let i = 0; i < 3; i++) {
      const u = (i - 1) * r * 0.9;
      s.fillStyle = flow.crest[1];
      blob(s, u + 0.3, from - r * 0.5 + 0.4, r * 0.7, i, 0.8, 0.25);
      s.fill();
      s.fillStyle = flow.crest[0];
      blob(s, u, from - r * 0.5, r * 0.58, i + 3, 0.8, 0.25);
      s.fill();
    }
  } else {
    const h = 1.5 + p * 7 * pulse;
    const blobPts = ovalPts(0, from - h * 0.5, r, Math.max(r * 0.6, h * 0.6), 7, 0.08, 14);
    s.fillStyle = flow.bands[1][1];
    path(s, blobPts);
    s.fill();
    s.fillStyle = flow.bands[2][1];
    path(s, ovalPts(-r * 0.2, from - h * 0.6, r * 0.55, Math.max(r * 0.3, h * 0.3), 8, 0.08, 12));
    s.fill();
    pen(s, blobPts, 3, 0.3, 0.7, 3, flow.ink);
  }
  s.restore();
  if (d.o.emit && Math.random() < 0.08 + p * 0.5) {
    const u = (Math.random() - 0.5) * m.width * 0.6;
    d.o.emit(
      'debris',
      wx(a, u, from - 2),
      wy(a, u, from - 2),
      vx(a, (Math.random() - 0.5) * 40, -40 - p * 80),
      vy(a, (Math.random() - 0.5) * 40, -40 - p * 80),
      flow.spray,
    );
  }
}

/**
 * The harbor's tentacle (look `tentacle`): an arm out of the water, no face. Rumbling, the surface rings and
 * bubbles where it'll come up; up, it stands in exactly its column, swaying inside it, suckers down one side,
 * tapering only over its last third into its tip, and wearing a wedding ring. In the column's frame.
 */
function drawTentacle(rc: RC, m: Geyser, d: DrawCtx, a: Aim, seg: number, p: number, base: number, len: number, k: number) {
  const s = rc.s;
  const w = m.width;
  const skin: HSL = { h: d.style.hue, s: 44, l: 36 };
  const belly: HSL = { h: d.style.hue + 12, s: 40, l: 68 };
  if (seg === 1) {
    // The surface rings out from where it'll rise, faster and wider as it comes.
    // Rings are thin and fade: the backdrop layer, where the cel pass leaves soft things soft.
    enter(rc.bg, a);
    for (let i = 0; i < 3; i++) {
      const u = ((rc.frame * (0.02 + p * 0.05) + i / 3) % 1) * (0.6 + p);
      const ring = ovalPts(0, base, w * (0.4 + u * 1.4), 1.2 + u * 1.6, 40 + i, 0.04, 20);
      rc.bg.fillStyle = `rgba(235,248,255,${(1 - u) * (0.4 + p * 0.5)})`;
      stroke(rc.bg, [...ring, ring[0]], { w: 0.9, seed: 40 + i, taper: [0, 0], press: 0.2 });
    }
    rc.bg.restore();
    enter(s, a);
    // A shadow under the water, and the tip breaking the surface at the end.
    s.fillStyle = css(skin, -14, 0.35 + p * 0.4);
    ellipse(s, 0, base + 2, w * 0.45, 1.6);
    if (p > 0.6) {
      const tip: P[] = [];
      for (let i = 0; i <= 6; i++) tip.push({ x: Math.sin(i * 0.9 + rc.t * 6) * 1.2, y: base - (i / 6) * (p - 0.6) * 18 });
      s.fillStyle = inkFor(skin);
      stroke(s, tip, { w: w * 0.3 + 0.6, seed: 3, taper: [0, 0.9], press: 0 });
      s.fillStyle = css(skin);
      stroke(s, tip, { w: w * 0.3, seed: 3, taper: [0, 0.9], press: 0 });
    }
    s.restore();
    if (d.o.emit && Math.random() < 0.1 + p * 0.4)
      d.o.emit('debris', wx(a, (Math.random() - 0.5) * w, base), wy(a, 0, base), (Math.random() - 0.5) * 40, -40 - p * 60, { h: 200, s: 40, l: 86 });
    return;
  }
  const n = 18;
  const left: P[] = [];
  const right: P[] = [];
  const mid: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const v = base - len * t;
    const half = (w / 2) * k * (t < 0.66 ? 1 : 1 - ((t - 0.66) / 0.34) * 0.8);
    const sway = Math.sin(rc.t * 3 + t * 4 + d.r.pp.uid) * w * 0.1 * t * (1 - t);
    left.push({ x: sway - half, y: v });
    right.unshift({ x: sway + half, y: v });
    mid.push({ x: sway, y: v });
  }
  enter(s, a);
  const body = [...left, ...right];
  tone(s, body, skin, { depth: 1, shade: -14 });
  // Its underside: a pale strip down one side, suckers along it.
  s.save();
  path(s, body);
  s.clip();
  s.fillStyle = css(belly);
  path(s, [...mid, ...right]);
  s.fill();
  for (let t = 0.08; t < 0.8; t += 0.11) {
    const i = Math.round(t * n);
    const half = right[n - i].x - mid[i].x;
    s.fillStyle = css(belly, -16);
    circle(s, mid[i].x + half * 0.5, mid[i].y, Math.max(0.8, half * 0.32));
  }
  // The ring, gold, on the thick of it.
  const ri = Math.round(n * 0.42);
  s.fillStyle = '#e8c04a';
  s.fillRect(-w, mid[ri].y - 1.2, w * 2, 2.2);
  s.fillStyle = '#fff3c0';
  s.fillRect(-w, mid[ri].y - 1.2, w * 2, 0.6);
  s.restore();
  pen(s, body, d.r.pp.uid, 0.5, 1.3, 3, inkFor(skin));
  // Water sheeting off where it leaves the sea.
  s.fillStyle = 'rgba(235,248,255,0.85)';
  for (let i = -1; i <= 1; i++) {
    blob(s, i * w * 0.4, base - 1, 1.6, i + 4, 1, 0.3);
    s.fill();
  }
  s.restore();
}

function drawColumn(rc: RC, m: Geyser, d: DrawCtx) {
  const s = rc.s;
  const g = rc.g;
  const f = rc.frame;
  const c = geyserCycle(m, f, d.r.phase);
  const a = aimOf(m, m.at[0] + d.off[0], m.at[1] + d.off[1]);
  const pit = a.up && isPit(m, d);
  // Where the column leaves its vent: the crater, the pit's surface, or the mouth's lip.
  const base = !a.up ? -1 : pit ? -6 : -1.6;
  const lava = m.look === 'lava';
  const flow = FLOWS[m.look];
  const v = ventOf(d);
  const LAVA = v.lava;
  const HOT = v.hot;
  const emit = d.o.emit;
  if (m.look === 'tentacle') {
    if (c.seg === 1) drawTentacle(rc, m, d, a, 1, c.t / c.len, base, 0, 1);
    else {
      const col = geyserColumn(m, f, d.r.phase, beamOf(d.o, d.r, d.mi)?.len ?? m.length, d.off[0], d.off[1]);
      if (col) drawTentacle(rc, m, d, a, 2, 1, base, col.len, col.k);
    }
    return;
  }
  if (c.seg === 1) {
    const p = c.t / c.len;
    if (flow) flowWarn(rc, m, d, a, flow, p, base);
    else if (lava) {
      // Telegraph: glowing upwell (pit) / sputter (vent).
      enter(g, a);
      glowDot(g, 0, base, 8 + p * 16, LAVA, 0.4 + p * 0.5);
      if (pit) {
        g.fillStyle = css(HOT, 0, 0.3 + p * 0.5);
        ellipse(g, 0, base + 2, 6 + p * 6, 2 + p);
      }
      g.restore();
      light(rc, wx(a, 0, base), wy(a, 0, base), 40 + p * 60, LAVA, 0.3 + p * 0.7);
      if (emit && Math.random() < 0.15 + p * 0.6) {
        const su = (Math.random() - 0.5) * 40;
        const sv = -60 - Math.random() * 120 * p;
        emit('ember', wx(a, (Math.random() - 0.5) * 8, base), wy(a, 0, base), vx(a, su, sv), vy(a, su, sv), HOT);
      }
    } else {
      // Steam warning: a sputtering hiss plume that grows (and pulses faster) until it erupts.
      const pulse = 0.5 + 0.5 * Math.sin(f * (0.25 + p * 0.5));
      const hgt = 5 + p * 20 * (0.6 + 0.4 * pulse);
      enter(rc.bg, a);
      for (let i = 0; i < 5; i++) {
        const u = (i + ((f * (1 + p * 2)) % 8) / 8) / 5;
        rc.bg.fillStyle = `rgba(${v.steam},${(0.35 + p * 0.45) * (1 - u)})`;
        circle(rc.bg, Math.sin(i * 2.1 + f * 0.3) * 1.5, base - u * hgt, 2 + u * 3 + p * 2);
      }
      rc.bg.restore();
      if (emit && Math.random() < 0.2 + p * 0.6) {
        const su = (Math.random() - 0.5) * 20;
        const sv = -40 - p * 60;
        emit('smoke', wx(a, (Math.random() - 0.5) * 6, base), wy(a, 0, base), vx(a, su, sv), vy(a, su, sv), { h: 0, s: 0, l: 85 });
      }
    }
    return;
  }
  const col = geyserColumn(m, f, d.r.phase, beamOf(d.o, d.r, d.mi)?.len ?? m.length, d.off[0], d.off[1]);
  if (!col) return;
  const len = col.len;
  const top = -len;
  const w = m.width;
  const k = col.k;
  if (flow) {
    drawFlow(rc, m, d, a, flow, len, k, Math.min(0, base));
    return;
  }
  if (lava) {
    // Albedo body so it reads in daylight: three flat tiers, licking at the edges, and a dark line round it.
    const n = Math.max(4, Math.ceil(len / 6));
    enter(s, a);
    const tier = (wk: number, cl: string) => {
      s.fillStyle = cl;
      s.beginPath();
      for (let i = 0; i <= n; i++) s.lineTo(-w * wk * k - Math.sin(rc.t * 18 + i * 1.3) * 1.4 * wk, -(len * i) / n);
      for (let i = n; i >= 0; i--) s.lineTo(w * wk * k + Math.sin(rc.t * 16 + i * 1.7) * 1.4 * wk, -(len * i) / n);
      s.closePath();
      s.fill();
    };
    tier(0.7, css(LAVA, -30, 1, 0, -6));
    tier(0.62, css(LAVA, -6));
    tier(0.38, css(HOT, 4));
    tier(0.16, css(HOT, 22));
    // Splash crown.
    for (let i = 0; i < 5; i++) {
      const an = -Math.PI / 2 + (i - 2) * 0.5 + Math.sin(rc.t * 7 + i) * 0.2;
      const r = 3 + (i % 2) * 2;
      s.fillStyle = css(LAVA, 0, 0.95);
      circle(s, Math.cos(an) * 6 * k, top + 2 + Math.sin(an) * 5 * k, r * 0.6 * k);
    }
    s.restore();
    enter(g, a);
    for (let yy = 0; yy > top; yy -= 7) glowDot(g, Math.sin(yy * 0.3 + rc.t * 9) * 1.5, yy, w * 0.95, LAVA, 0.55 * k, 0.4);
    // The white-hot core: a ribbon swaying with the column's glow, rounded off under the crown.
    const core: P[] = [];
    for (let yy = 0; yy > top + 4; yy -= 4) core.push({ x: Math.sin(yy * 0.3 + rc.t * 9) * 0.6, y: yy });
    core.push({ x: 0, y: top + 4 });
    g.fillStyle = css(HOT, 25, 0.9 * k);
    stroke(g, core, { w: w * 0.25, seed: 7, taper: [0, 0.06], press: 0.25 });
    circle(g, 0, top + 4 + w * 0.06, w * 0.11);
    for (let i = 0; i < 5; i++) {
      const an = -Math.PI / 2 + (i - 2) * 0.5 + Math.sin(rc.t * 7 + i) * 0.2;
      const r = 3 + (i % 2) * 2;
      glowDot(g, Math.cos(an) * 6 * k, top + 2 + Math.sin(an) * 5 * k, r * 2, HOT, 0.6 * k);
    }
    if (v.loop) {
      // A prominence: a loop of plasma arcing off the top and back down beside the column.
      const R = 7 + w * 0.4;
      const side = Math.sin(rc.t * 0.7 + d.r.pp.uid) > 0 ? 1 : -1;
      for (let i = 0; i <= 9; i++) {
        const an = Math.PI + (i / 9) * Math.PI;
        glowDot(g, side * (R + Math.cos(an) * R), top + 8 + Math.sin(an) * R * 1.2, 4.5, HOT, 0.55 * k);
      }
    }
    g.restore();
    for (let yy = 0; yy > top; yy -= 26) light(rc, wx(a, 0, yy), wy(a, 0, yy), 80, LAVA, 0.9 * k);
    light(rc, wx(a, 0, top), wy(a, 0, top), 70, HOT, 0.9 * k);
    if (emit && Math.random() < 0.8) {
      const su = (Math.random() - 0.5) * 120;
      const sv = -40 - Math.random() * 90;
      emit('ember', wx(a, (Math.random() - 0.5) * w, top + 4), wy(a, 0, top + 4), vx(a, su, sv), vy(a, su, sv), HOT);
    }
    if (emit && Math.random() < 0.25) emit('smoke', wx(a, 0, top), wy(a, 0, top), vx(a, 0, -30), vy(a, 0, -30), { h: 10, s: 10, l: 30 });
    return;
  }
  // Steam: billowing puffs travelling at the updraft's air speed, widening and thinning toward the tip
  // where the push tapers off (the same profile as the sim, measured back from the column's far end).
  const wind = geyserWind(m, col);
  const step = wind.speed / 60;
  const far = len + TILE * 0.5;
  enter(rc.bg, a);
  for (let i = 0; i < len / 5; i++) {
    const along = (i * 5 + f * step) % len;
    const u = along / len;
    const push = Math.max(0, windProfile(wind, far - along));
    const r = (w * 0.45 + u * w * 0.5) * k;
    rc.bg.fillStyle = `rgba(${v.steam},${0.55 * (1 - u * 0.5) * (0.35 + 0.65 * push)})`;
    circle(rc.bg, Math.sin(i * 2.3 + f * 0.1) * 2 * u, -along, r);
  }
  rc.bg.fillStyle = 'rgba(255,255,255,0.75)';
  circle(rc.bg, 0, -2, w * 0.4 * k);
  rc.bg.restore();
  if (v.flakes) {
    // Snow riding the updraft: little six-point flakes, on the sim's own clock.
    enter(g, a);
    g.fillStyle = 'rgba(245,250,255,0.9)';
    for (let i = 0; i < 6; i++) {
      const along = (i * 13 + f * step * 0.8) % len;
      const fx = Math.sin(i * 1.9 + f * 0.05) * w * 0.6;
      const fy = -along;
      for (let q = 0; q < 3; q++) {
        const ca = Math.cos((q * Math.PI) / 3) * 1.4;
        const sa = Math.sin((q * Math.PI) / 3) * 1.4;
        g.fillRect(fx - ca - 0.2, fy - sa - 0.2, 0.4, 0.4);
        g.fillRect(fx + ca - 0.2, fy + sa - 0.2, 0.4, 0.4);
      }
      g.fillRect(fx - 0.3, fy - 0.3, 0.6, 0.6);
    }
    g.restore();
  }
  if (emit && Math.random() < 0.6) {
    const su = (Math.random() - 0.5) * 50;
    const sv = -50 - Math.random() * 40;
    emit('smoke', wx(a, (Math.random() - 0.5) * w, top + 4), wy(a, 0, top + 4), vx(a, su, sv), vy(a, su, sv), { h: 0, s: 0, l: 92 });
  }
}

defineArt<'geyser'>({ type: 'geyser', layer: 1, draw: (rc, m, d) => drawVent(rc, m, d) });
defineArt<'geyser'>({ type: 'geyser', layer: 3, draw: (rc, m, d) => drawColumn(rc, m, d) });
