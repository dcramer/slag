import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { type ModuleOf, SPARK_R, sparkAt, WIRE_RUN, WIRE_WARN, wireCycle, wirePoint } from '../../../sim/props';
import { blob, type P, stroke } from '../../ink';
import { bar, barLine, boxPts, ovalPts, part, sprite, stamp, tick } from '../../ink-props';
import { glowDot, light, type RC, zap } from '../../kit';
import { type DrawCtx, defineArt } from '../common';
import { type Level, T_EMPTY, tileAt } from '../../../sim/level';

/** Top (px) of whatever a pole stands on under (x, y): a roof, or a walkway of grating. */
function floorBelow(lv: Level | null, x: number, y: number): number {
  if (!lv) return y + TILE * 3;
  const tx = Math.floor(x / TILE);
  for (let ty = Math.max(0, Math.floor(y / TILE)); ty < lv.h; ty++) if (tileAt(lv, tx, ty) !== T_EMPTY) return ty * TILE;
  return lv.h * TILE + 8;
}

/**
 * A live wire (sim/props/modules/wire.ts): a power line strung between two wooden poles, sagging on the
 * very curve the spark runs along. The insulator at its start buzzes and crackles through the warning,
 * then the spark races down the line, a hot white point that lights the cable behind it, and spits off
 * the far insulator. The cable and the poles never hurt; the spark does, exactly where it's drawn.
 */

type Wire = ModuleOf<'wire'>;

const WOOD: HSL = { h: 24, s: 30, l: 30 };
const GLASS: HSL = { h: 160, s: 30, l: 62 };
const SPARK: HSL = { h: 200, s: 100, l: 78 };
const CABLE: HSL = { h: 220, s: 10, l: 26 };

/** A pole from its top (x, y) down to the ground at `gy`: a tarred post, a crossarm, a glass insulator on it. Baked per height. */
function pole(h: number, flip: boolean) {
  return sprite(`wire|pole|${Math.round(h)}|${flip}`, -6, -4, 12, h + 5, (g) => {
    part(g, boxPts(-1.3, 0, 2.6, h, 0.6, h, 0.06), WOOD, 3, { depth: 0.6, thin: 0.35, thick: 0.9 });
    // Grain down the post.
    tick(g, -0.3, 3, -0.2, h - 2, 0.35, 4, css(WOOD, -14));
    // The crossarm, and its brace.
    part(g, boxPts(-5.5, 1.2, 11, 1.8, 0.4, 5, 0.05), WOOD, 5, { depth: 0.4, thin: 0.3, thick: 0.8 });
    barLine(g, flip ? 1.2 : -1.2, 7, flip ? 4.4 : -4.4, 3, 0.7, WOOD, 6, { rim: 0.25 });
    // The insulators on the arm: the cable's on the near one.
    for (const ix of [-4, 4]) part(g, ovalPts(ix, 0.2, 1.3, 1.6, 7 + ix, 0.04, 10), GLASS, 8 + ix, { depth: 0.3, thin: 0.3, thick: 0.7 });
  });
}

/** The cable's curve, `n` points from `u0` to `u1` along it. */
function curve(m: Wire, d: DrawCtx, u0: number, u1: number, n: number): P[] {
  const out: P[] = [];
  for (let i = 0; i <= n; i++) {
    const [x, y] = wirePoint(m, u0 + ((u1 - u0) * i) / n, d.off[0], d.off[1]);
    out.push({ x, y });
  }
  return out;
}

/** A crackle at (x, y): a hot point and a few jagged threads, `k` 0..1 how fierce. */
function crackle(rc: RC, x: number, y: number, k: number) {
  glowDot(rc.g, x, y, 3 + 5 * k, SPARK, 0.25 + 0.55 * k);
  for (let i = 0; i < 3; i++) {
    if (Math.random() > 0.2 + 0.7 * k) continue;
    const a = Math.random() * Math.PI * 2;
    const r = 2.5 + Math.random() * 4 * (0.5 + k);
    zap(rc.g, x, y, x + Math.cos(a) * r, y + Math.sin(a) * r, 1.6, 3, SPARK, 0.55);
  }
}

function draw(rc: RC, m: Wire, d: DrawCtx) {
  const s = rc.s;
  const lv = d.o.level ?? null;
  const ends: [number, number][] = [
    [m.a[0] + d.off[0], m.a[1] + d.off[1]],
    [m.b[0] + d.off[0], m.b[1] + d.off[1]],
  ];
  // The poles, standing on whatever is under each end.
  for (const [i, [x, y]] of ends.entries()) {
    const gy = floorBelow(lv, x, y + 2);
    stamp(s, pole(Math.max(4, gy - y + 0.5), i === 1), x, y);
  }
  // The cable.
  const pts = curve(m, d, 0, 1, 18);
  bar(s, pts, 0.8, CABLE, m.seed, { rim: 0.25, taper: [0, 0], press: 0.05 });
  s.fillStyle = css(CABLE, 30, 0.6);
  stroke(
    s,
    pts.map((p) => ({ x: p.x, y: p.y - 0.25 })),
    { w: 0.35, seed: m.seed + 1, taper: [0.1, 0.1], press: 0 },
  );
  const c = wireCycle(m, rc.frame, d.r.phase);
  const [ax, ay] = ends[0];
  if (c.seg === WIRE_WARN) {
    // The insulator at the start buzzes: worse and worse, and the near stretch of cable glows.
    const u = c.t / Math.max(1, c.len);
    crackle(rc, ax, ay, u);
    s.fillStyle = css(SPARK, 0, 0.25 + 0.5 * u);
    stroke(s, curve(m, d, 0, 0.06 + 0.08 * u, 4), { w: 0.9, seed: 3, taper: [0, 0.6], press: 0 });
  }
  if (c.seg !== WIRE_RUN) return;
  const p = sparkAt(m, rc.frame, d.r.phase, d.off[0], d.off[1]);
  if (!p) return;
  const u = c.t / Math.max(1, c.len - 1);
  // The cable behind it, lit for a stretch and fading.
  s.fillStyle = css(SPARK, 6, 0.75);
  stroke(s, curve(m, d, Math.max(0, u - 0.18), u, 6), { w: 1.1, seed: 4, taper: [0.9, 0], press: 0 });
  // The spark: a hot core the size it hurts, a white heart, and threads jumping off it.
  const r = SPARK_R * TILE;
  glowDot(rc.g, p[0], p[1], r * 2.4, SPARK, 0.9);
  s.fillStyle = css(SPARK, 8);
  blob(s, p[0], p[1], r * 0.8, rc.frame, 1, 0.25);
  s.fill();
  s.fillStyle = '#ffffff';
  blob(s, p[0], p[1], r * 0.42, rc.frame + 1, 1, 0.2);
  s.fill();
  crackle(rc, p[0], p[1], 0.9);
  light(rc, p[0], p[1], 50, SPARK, 0.9);
  if (u > 0.92) crackle(rc, ends[1][0], ends[1][1], 1);
}

defineArt<'wire'>({ type: 'wire', layer: 2, draw });
