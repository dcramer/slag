import { css, type HSL } from '../core/color';
import { hash2 } from '../core/rng';
import { TILE } from '../sim/constants';
import { JOLT } from '../sim/items/climb';
import { T_EMPTY, T_SOLID } from '../sim/level';
import type { Runner, RunWorld } from '../sim/run';
import { inkFor, line, type P, stroke } from './ink';
import { ball, boxPts, glint, ovalPts, part, poly, sprite, stamp, tick } from './ink-props';
import { circle, ellipse, glowDot, light, type RC } from './kit';

/**
 * Art for the three items made for a shaft (docs/PARODY.md, Held items): Slippery Slope, a dented oil can with a long
 * spout, whose spill lies on the ledges under it as a black gloss with a petrol rainbow on top; Trickle-Down, a fat
 * money bag with a hole in its bottom, whose shudder pours down the shaft as a falling line of gold coins; and Social
 * Climber, a gold grapple on a string of pearls. Icons are drawn around (0, 0) in a ~14 px box facing +x, like the
 * rest; the live pieces read sim state and never write it.
 */

const CAN: HSL = { h: 4, s: 70, l: 46 };
const TIN: HSL = { h: 210, s: 10, l: 72 };
const OIL: HSL = { h: 260, s: 30, l: 9 };
const SACK: HSL = { h: 36, s: 42, l: 58 };
const TWINE: HSL = { h: 28, s: 40, l: 36 };
const COIN: HSL = { h: 46, s: 92, l: 58 };
const GILT: HSL = { h: 44, s: 86, l: 54 };
const PEARL: HSL = { h: 40, s: 30, l: 93 };

/** The can, spout toward +x: a squat drum with a dent, a ring handle on top, and the spout off its shoulder. */
const canSprite = () =>
  sprite('it|oilcan', -7, -8, 15, 15, (g) => {
    // The spout, long and thin, tipped with a drip.
    g.fillStyle = inkFor(TIN);
    stroke(g, poly(1.6, -1.8, 4.6, -4.2, 6.8, -6), { w: 1.6, seed: 91, taper: [0, 0.4], press: 0 });
    g.fillStyle = css(TIN);
    stroke(g, poly(1.6, -1.8, 4.6, -4.2, 6.8, -6), { w: 0.9, seed: 91, taper: [0, 0.4], press: 0 });
    part(g, ovalPts(-1.2, 1.6, 5, 4.6, 92, 0.06), CAN, 92, { depth: 0.6, thin: 0.45, thick: 1.1 });
    // The dent, and a band of tin round its middle.
    tick(g, -4.2, 0.4, -3, 2.6, 0.5, 93, css(CAN, -24));
    part(g, boxPts(-5.6, 1.4, 8.8, 1.4, 0.3, 94, 0.1), TIN, 94, { depth: 0.2, thin: 0.3, thick: 0.6 });
    // The handle ring on top.
    g.fillStyle = inkFor(TIN);
    stroke(g, poly(-3.6, -2.6, -2.8, -5.2, 0.4, -5.4, 1, -2.8), { w: 1.2, seed: 95, taper: [0, 0], press: 0 });
    glint(g, poly(-4.4, -0.6, -3.2, -2.2), 'rgba(255,220,210,0.85)', 0.5);
  });

/** The money bag: a sack cinched at the neck with twine, the hole in its bottom. */
const bagSprite = () =>
  sprite('it|moneybag', -7, -8, 14, 16, (g) => {
    part(g, poly(-1.6, -3.6, -5.4, 0.4, -5.2, 4.8, -1.4, 6.2, 2.6, 6, 5.4, 3.8, 5, -0.2, 1.8, -3.6), SACK, 101, { depth: 0.7, thin: 0.45, thick: 1.1 });
    // The ruff over the twine.
    part(g, poly(-2.6, -4, -3.4, -6.6, -1, -5.4, 0.2, -7.2, 1.4, -5.4, 3.4, -6.4, 2.8, -4), SACK, 102, { depth: 0.3, thin: 0.35, thick: 0.8 });
    g.fillStyle = css(TWINE);
    stroke(g, poly(-2.6, -3.8, 0.2, -3.2, 2.9, -3.8), { w: 0.9, seed: 103, taper: [0, 0], press: 0 });
    // A coin stamped on its face, and the hole a coin is slipping out of.
    ball(g, 0, 1.6, 2.1, COIN, 104);
    tick(g, -0.8, 1.6, 0.8, 1.6, 0.45, 105, css(COIN, -28));
    g.fillStyle = inkFor(SACK);
    ellipse(g, 1.4, 5.7, 1.1, 0.55);
    ball(g, 1.6, 7.2, 0.9, COIN, 106);
  });

/** The grapple: three gold tines curling up off a shank, an eye at its foot. */
const grappleSprite = () =>
  sprite('it|grapple', -6, -7, 12, 13, (g) => {
    g.fillStyle = inkFor(GILT);
    for (const pts of [poly(0, 4, 0, -4.6), poly(0, 0.6, -2.6, -0.6, -4, -3.4, -3.2, -4.8), poly(0, 0.6, 2.6, -0.6, 4, -3.4, 3.2, -4.8)])
      stroke(g, pts, { w: 1.7, seed: 111, taper: [0, 0.35], press: 0 });
    g.fillStyle = css(GILT);
    for (const pts of [poly(0, 4, 0, -4.6), poly(0, 0.6, -2.6, -0.6, -4, -3.4, -3.2, -4.8), poly(0, 0.6, 2.6, -0.6, 4, -3.4, 3.2, -4.8)])
      stroke(g, pts, { w: 0.95, seed: 111, taper: [0, 0.35], press: 0 });
    ball(g, 0, 4.8, 1.3, GILT, 112);
    glint(g, poly(-0.3, -3.6, -0.3, 0), 'rgba(255,250,215,0.9)', 0.4);
  });

/** A string of pearls through `pts`: a bead every couple of px. */
function pearls(g: CanvasRenderingContext2D, pts: readonly P[], seed: number) {
  let left = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    for (; left <= d; left += 2.1) {
      const u = d ? left / d : 0;
      const x = a.x + (b.x - a.x) * u;
      const y = a.y + (b.y - a.y) * u;
      g.fillStyle = inkFor(PEARL);
      circle(g, x, y, 1.05);
      g.fillStyle = css(PEARL, hash2(Math.round(x * 3), Math.round(y * 3), seed) * 6 - 3);
      circle(g, x - 0.12, y - 0.12, 0.72);
    }
    left -= d;
  }
}

/** Icons for the three, keyed by kind. */
export const SHAFT_ICONS = {
  slick(s: CanvasRenderingContext2D, t: number) {
    stamp(s, canSprite());
    // A drip at the spout's tip, swelling and letting go.
    const u = (t * 0.9) % 1;
    s.fillStyle = css(OIL, 8);
    ellipse(s, 6.9, -5.4 + u * 4, 0.7 + u * 0.3, 0.8 + u * 0.5);
  },
  jolt(s: CanvasRenderingContext2D) {
    stamp(s, bagSprite());
  },
  grapple(s: CanvasRenderingContext2D) {
    // A coil of pearls off its eye, behind it.
    pearls(s, poly(0.4, 5, -2.6, 5.6, -4.8, 3.6, -4.2, 0.6, -5.6, -2.4), 121);
    stamp(s, grappleSprite());
  },
};

/** The tile at (x, y), round a loop the row a lap up or down. */
function tileOf(run: RunWorld, x: number, y: number): number {
  const lv = run.level;
  if (x < 0 || x >= lv.w) return T_SOLID;
  const L = lv.loop ?? 0;
  const yy = L && y >= lv.h ? y - L : L && y < 0 ? y + L : y;
  return yy < 0 || yy >= lv.h ? T_EMPTY : lv.tiles[yy * lv.w + x];
}

/**
 * Slippery Slope spills: a black gloss on the top of every floor in the spill, a petrol rainbow sliding over it, and
 * slow drips off its lips. It seeps in from the user's row down and dries from the edges in its last second.
 */
export function drawSlicks(rc: RC, run: RunWorld) {
  const s = rc.s;
  for (const p of run.items.slicks) {
    const age = run.frame - p.born;
    const left = p.until - run.frame;
    const a = Math.min(1, left / 50);
    if (a <= 0) continue;
    // It runs down the shaft a few rows a frame, so the spill reads as poured from above.
    const reach = Math.min(p.y1, p.y0 + Math.floor(age / 2));
    for (let ty = p.y0; ty <= reach; ty++)
      for (let tx = p.x0; tx <= p.x1; tx++) {
        const t = tileOf(run, tx, ty);
        if (t === T_EMPTY || tileOf(run, tx, ty - 1) !== T_EMPTY) continue;
        const x = tx * TILE;
        const y = ty * TILE;
        const dry = hash2(tx, ty, p.id) > a * 1.15;
        if (dry) continue;
        // A thick black gloss pooled on the top, a hard white shine along it, and a petrol rainbow sliding over it.
        s.fillStyle = css(OIL, 0, 0.94 * a);
        s.fillRect(x, y - 1.6, TILE, 4.6);
        s.fillStyle = `rgba(255,255,255,${0.55 * a})`;
        s.fillRect(x + 1 + hash2(tx, ty, 3) * 4, y - 1.2, 5 + hash2(tx, ty, 4) * 5, 0.7);
        const ph = (rc.t * 0.6 + hash2(tx, ty, 7)) % 1;
        for (let k = 0; k < 3; k++) {
          s.fillStyle = `hsla(${(ph * 360 + k * 70) % 360} 95% 62% / ${0.8 * a})`;
          s.fillRect(x + ((ph * TILE + k * 4.5) % TILE), y + 0.2 + k * 0.8, 3.6, 0.7);
        }
        // A lip: a drip slowly letting go off the edge.
        for (const side of [-1, 1]) {
          if (tileOf(run, tx + side, ty) !== T_EMPTY || tileOf(run, tx + side, ty - 1) !== T_EMPTY) continue;
          const u = (rc.t * 0.5 + hash2(tx, side, p.id)) % 1;
          s.fillStyle = css(OIL, 6, a);
          const dx = side > 0 ? x + TILE - 1.2 : x + 1.2;
          ellipse(s, dx, y + 3.4 + u * 9, 1.2, 1.3 + u * 1.4);
        }
      }
  }
}

/**
 * Trickle-Down shudders: the stamp's ring at the user's feet, then a line of gold coins and speed streaks falling
 * down the whole shaft, fading as it nears the end of its pour.
 */
export function drawJolts(rc: RC, run: RunWorld) {
  const s = rc.s;
  const w = run.level.w * TILE;
  for (const j of run.items.jolts) {
    if (j.t <= JOLT.delay) {
      const u = j.t / JOLT.delay;
      s.fillStyle = css(COIN, 10, 0.8 * u);
      stroke(s, ovalPts(j.x, j.from, 4 + 10 * u, 2 + 3 * u, j.id, 0.03, 18).concat(ovalPts(j.x, j.from, 4 + 10 * u, 2 + 3 * u, j.id, 0.03, 18)[0]), {
        w: 1.2,
        seed: j.id,
        taper: [0, 0],
        press: 0,
      });
      continue;
    }
    const y = j.from + j.down;
    const a = 1 - (j.down / JOLT.depth) * 0.7;
    // Streaks trailing up from the front, and the shimmer line itself.
    s.fillStyle = css(COIN, 18, 0.35 * a);
    for (let x = 6; x < w; x += 11) {
      const len = 8 + hash2(x, j.id, 3) * 14;
      line(s, x + hash2(x, j.id, 5) * 4, y - len, x + hash2(x, j.id, 5) * 4, y - 1, { w: 0.8, seed: x, taper: [0.9, 0.1], press: 0 });
    }
    s.fillStyle = css(COIN, 12, 0.7 * a);
    const pts: P[] = [];
    for (let x = 0; x <= w; x += 6) pts.push({ x, y: y + Math.sin(x * 0.21 + rc.t * 18) * 1.4 });
    stroke(s, pts, { w: 1.4, seed: j.id, taper: [0, 0], press: 0 });
    for (let x = 10; x < w; x += 23) {
      const cx = x + hash2(x, j.id, 9) * 10;
      ball(s, cx, y + 1 + hash2(x, j.id, 11) * 3, 1.5, COIN, x + j.id);
    }
    light(rc, j.x, y, 60, COIN, 0.35 * a);
  }
}

/**
 * Social Climber lines, drawn with the runners (`up` moves a runner onto the leader's lap): the pearls from the
 * climber's hand to the grapple bitten into the ledge's lip, taut and shortening as it reels.
 */
export function drawClimbs(rc: RC, run: RunWorld, up: (r: Runner) => number) {
  const s = rc.s;
  for (const c of run.items.climbs) {
    const r = run.runners[c.owner];
    if (!r) continue;
    const dy = up(r);
    const b = r.body;
    const hx = c.ex + b.w / 2 + (c.ex >= c.sx ? 4 : -4);
    const hy = c.ey + b.h - 1 - dy;
    const ax = b.x + b.w / 2;
    const ay = b.y + 3 - dy;
    // Up first, it bends round the lip until the climber is level with it.
    const pts = c.up && b.y > c.ey + 1 ? poly(ax, ay, ax, hy, hx, hy) : poly(ax, ay, hx, hy);
    pearls(s, pts, c.id);
    s.save();
    s.translate(hx, hy);
    s.rotate(Math.atan2(hy - ay, hx - ax) + Math.PI / 2);
    stamp(s, grappleSprite());
    s.restore();
    glowDot(rc.g, hx, hy, 5, GILT, 0.5);
  }
}

/** A Leg Day's spring on a runner: gold chevrons pumping under its feet and a sweatband glint, fading in its last second. */
export function drawSurge(rc: RC, r: Runner) {
  const left = r.status.surge;
  if (left <= 0) return;
  const s = rc.s;
  const b = r.body;
  const a = Math.min(1, left / 40) * (left < 60 && Math.floor(left / 5) % 2 === 0 ? 0.4 : 1);
  const x = b.x + b.w / 2;
  const y = b.y + b.h;
  const pump = (rc.t * 3) % 1;
  s.fillStyle = css(COIN, 14, a);
  for (let k = 0; k < 2; k++) {
    const cy = y + 1 + k * 2.6 - pump * 2.6;
    stroke(s, poly(x - 3.4, cy + 1.6, x, cy, x + 3.4, cy + 1.6), { w: 0.9, seed: k + 3, taper: [0.2, 0.2], press: 0 });
  }
  s.fillStyle = `hsla(330 85% 66% / ${a})`;
  s.fillRect(b.x + 0.5, b.y + 2.2, b.w - 1, 1.3);
  if (b.vy < -60) for (let i = 0; i < 2; i++) glowDot(rc.g, x + (i ? 3 : -3), y + 3 + ((rc.t * 40 + i * 5) % 6), 2.2, COIN, 0.7 * a);
}
