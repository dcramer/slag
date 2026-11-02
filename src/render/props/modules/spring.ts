import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { TILE } from '../../../sim/constants';
import { type Level, tileAt } from '../../../sim/level';
import type { Solid } from '../../../sim/physics';
import { type Module, type ModuleOf, type PlateArc, plateArc, plateStart, type PropStyle } from '../../../sim/props';
import { line } from '../../ink';
import { inkSpring } from '../../ink-parts';
import { boxPts, dot, ovalPts, part, path, poly, sprite, stamp, tick } from '../../ink-props';
import { glowDot, light, type RC } from '../../kit';
import { type DrawCtx, defineArt, type PropDrawOpts } from '../common';

type M<T extends Module['type']> = ModuleOf<T>;

const TICKING: HSL = { h: 40, s: 30, l: 90 };

/** The Bedspring's top: a scrap of striped mattress ticking over the plate, tufted with one button. */
function ticking(s: CanvasRenderingContext2D, top: number) {
  const pad = boxPts(-7.6, top - 4.4, 15.2, 3.8, 1.4, 7, 0.3);
  part(s, pad, TICKING, 7, { depth: 0.5, thin: 0.4, thick: 1, shade: -14 });
  s.save();
  path(s, pad);
  s.clip();
  for (let x = -7; x < 8; x += 2.4) tick(s, x, top - 4.6, x - 0.3, top - 0.4, 0.55, x * 3, '#3d64a8');
  s.restore();
  // The button pulls the ticking in: two creases into it.
  tick(s, -2.2, top - 3.4, -0.5, top - 2.6, 0.35, 8, 'rgba(18,11,8,0.6)');
  tick(s, 2.2, top - 3.4, 0.5, top - 2.6, 0.35, 9, 'rgba(18,11,8,0.6)');
  dot(s, 0, top - 2.5, 0.65, 10, '#e8e2d4');
}

function drawSpring(rc: RC, m: M<'spring'>, off: Vec, st: PropStyle, o: PropDrawOpts, bed: boolean) {
  const since = o.state ? rc.frame - o.state.lastFire : 99;
  const pop = since < 10 ? Math.sin((since / 10) * Math.PI) : 0;
  inkSpring(rc, [m.at[0] + off[0], m.at[1] + off[1]], m.angle, st.hue, pop, 11);
  if (bed) {
    const s = rc.s;
    s.save();
    s.translate(m.at[0] + off[0], m.at[1] + off[1]);
    s.rotate(m.angle + Math.PI / 2);
    ticking(s, -1 - pop * 6);
    s.restore();
  }
}

const STEEL: HSL = { h: 215, s: 10, l: 52 };
const CHALK = 'rgba(250,248,238,0.92)';
const STAMP: HSL = { h: 356, s: 70, l: 44 };

/** The Launch Plate's still parts, facing right: a bolted base and a round plate on a hinge at its back, with an arrow on it. */
function plateSprite(hue: number) {
  return sprite(`plate|${hue | 0}`, -9, -8, 18, 9, (g) => {
    const base = boxPts(-7.6, -2.6, 15.2, 2.8, 0.8, 3, 0.15);
    part(g, base, STEEL, 3, { depth: 0.5, shade: -18, thin: 0.4, thick: 1 });
    for (const x of [-5.6, 5.6]) dot(g, x, -1.2, 0.45, x, '#e6e8ee');
    // The NO REFUNDS stamp on the base's front: a red box of illegible ink.
    g.fillStyle = css(STAMP, 0, 0.85);
    g.fillRect(-2.6, -2, 5.2, 1.5);
    tick(g, -2.2, -1.25, 2.2, -1.25, 0.3, 4, 'rgba(255,235,230,0.9)');
  });
}

/** The plate itself, tipped up about its hinge by `lift` (0 flat, 1 sprung): drawn live, since it moves. */
function plateTop(s: CanvasRenderingContext2D, hue: number, lift: number) {
  s.save();
  s.translate(-6.5, -2.6);
  s.rotate(-lift * 0.75);
  const disk = ovalPts(6.5, -1.1, 6.6, 1.9, 5, 0.02, 18);
  part(s, disk, { h: hue, s: 70, l: 52 }, 5, { depth: 0.5, shade: -16, thin: 0.4, thick: 1.1 });
  // The arrow painted across it, pointing the way it throws.
  s.fillStyle = 'rgba(255,250,235,0.95)';
  const a = poly(2.6, -1.6, 8, -1.6, 8, -2.5, 10.6, -1.1, 8, 0.3, 8, -0.6, 2.6, -0.6);
  path(s, a);
  s.fill();
  // The hinge pin at the back.
  dot(s, 0.2, -0.3, 0.8, 9, '#e6e8ee');
  s.restore();
}

const arcs = new Map<string, PlateArc>();

/** A plate's flight in the world it's drawn in, flown by the sim's own controller (cached while nothing it could hit has changed). */
function arcOf(m: ModuleOf<'spring'>, d: DrawCtx, rc: RC, level: Level, solids: readonly Solid[]): PlateArc {
  const start = plateStart(m, d.off);
  // A race moves things through the flight path: refresh a few times a second there, never in the still phases.
  const key = `${start[0]},${start[1]}|${m.arc![0]},${m.arc![1]}|${level.seed},${level.version}|${solids.length}|${d.o.emit ? rc.frame >> 3 : 0}`;
  let a = arcs.get(key);
  if (!a) {
    const world = { tileAt: (x: number, y: number) => tileAt(level, x, y), solids, gravity: level.gravity ?? 1 };
    a = plateArc(world, start, m.arc!, 240, level.h * TILE);
    if (arcs.size > 64) arcs.clear();
    arcs.set(key, a);
  }
  return a;
}

/** The chalk X where the plate lands you: a squashed bullseye lying on the floor, crossed. */
function landingX(rc: RC, x: number, y: number) {
  const g = rc.bg;
  g.fillStyle = 'rgba(30,20,14,0.55)';
  for (const [ax, ay, bx, by] of [
    [-4.6, -3.9, 4.6, -0.3],
    [4.6, -3.9, -4.6, -0.3],
  ])
    line(g, x + ax, y + ay + 0.6, x + bx, y + by + 0.6, { w: 2.2, seed: ax, taper: [0.2, 0.2], press: 0.2 });
  g.fillStyle = CHALK;
  for (const [ax, ay, bx, by] of [
    [-4.6, -3.9, 4.6, -0.3],
    [4.6, -3.9, -4.6, -0.3],
  ])
    line(g, x + ax, y + ay, x + bx, y + by, { w: 1.3, seed: ax + 1, taper: [0.25, 0.25], press: 0.3 });
  g.strokeStyle = CHALK;
  g.lineWidth = 0.8;
  g.beginPath();
  g.ellipse(x, y - 2.1, 7, 2.1, 0, 0, Math.PI * 2);
  g.stroke();
  // Grass stands in front of the ground layer: the X glows a little on the emissive one, so it reads through.
  const e = rc.g;
  e.fillStyle = 'rgba(255,250,225,0.55)';
  for (const [ax, ay, bx, by] of [
    [-4.6, -3.9, 4.6, -0.3],
    [4.6, -3.9, -4.6, -0.3],
  ])
    line(e, x + ax, y + ay - 1, x + bx, y + by - 1, { w: 1.1, seed: ax + 2, taper: [0.25, 0.25], press: 0.3 });
}

/** The flight as dots, every few frames of it: the dotted arc the place phase shows. */
function dottedArc(rc: RC, pts: readonly Vec[]) {
  const g = rc.bg;
  for (let i = 3; i < pts.length - 1; i += 3) {
    const [x, y] = pts[i];
    g.fillStyle = 'rgba(30,20,14,0.6)';
    g.beginPath();
    g.arc(x, y - 7, 1.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = CHALK;
    g.beginPath();
    g.arc(x, y - 7, 0.9, 0, Math.PI * 2);
    g.fill();
  }
}

/**
 * The Launch Plate (docs/PARODY.md): a round plate on a hinge with an arrow
 * across it, and a chalk X where it puts you down. The X is wherever the sim's
 * own controller lands from the plate's throw in this world, so it moves when
 * something is built in the way. The place phase dots the whole flight in.
 */
function drawPlate(rc: RC, m: ModuleOf<'spring'>, d: DrawCtx) {
  const s = rc.s;
  const [x, y] = plateStart(m, d.off);
  const dir = (m.arc?.[0] ?? 1) < 0 ? -1 : 1;
  const since = d.o.state ? rc.frame - d.o.state.lastFire : 99;
  const lift = since < 14 ? Math.sin((since / 14) * Math.PI) : 0;
  s.save();
  s.translate(x, y);
  s.scale(dir, 1);
  stamp(s, plateSprite(d.style.hue));
  plateTop(s, d.style.hue, lift);
  s.restore();
  if (lift > 0) glowDot(rc.g, x, y - 4, 12, { h: d.style.hue, s: 80, l: 60 }, lift * 0.5);
  const level = d.o.level;
  if (!level || d.o.card || !m.arc) return;
  const arc = arcOf(m, d, rc, level, d.o.solids ?? []);
  if (d.o.showPath) dottedArc(rc, arc.pts);
  if (arc.land) {
    landingX(rc, arc.land[0], arc.land[1]);
    light(rc, arc.land[0], arc.land[1] - 3, 18, { h: 50, s: 30, l: 90 }, 0.25);
  }
}

defineArt<'spring'>({
  type: 'spring',
  layer: 2,
  draw: (rc, m, d) => (m.exact ? drawPlate(rc, m, d) : drawSpring(rc, m, d.off, d.style, d.o, d.r.pp.def.name.includes('Bedspring'))),
});
