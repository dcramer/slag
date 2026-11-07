import { css, type HSL } from '../core/color';
import { CLOCK } from '../sim/items';
import type { Runner, RunWorld } from '../sim/run';
import { inkFor, line, type P, stroke } from './ink';
import { ball, bar, barLine, boxPts, glint, ovalPts, part, poly, sprite, stamp, tick } from './ink-props';
import type { RC } from './kit';

/**
 * Art for the brawl's two reaching items (docs/PARODY.md, Held items). Rude Awakening: a twin-bell alarm clock, lobbed;
 * once down it rattles on its base, bells hammering, while a flat dial sweeps over the top of the reach of its blast (the tell).
 * Catch of the Day: a fishing rod with a reel and a red-and-white float on the end of its line. Icons are drawn around
 * (0, 0) in a ~14 px box facing +x; the live pieces read sim state and never write it.
 */

const CASE: HSL = { h: 4, s: 70, l: 50 };
const DIAL: HSL = { h: 42, s: 35, l: 92 };
const BRASS: HSL = { h: 44, s: 78, l: 56 };
const HANDS: HSL = { h: 4, s: 30, l: 22 };
const ALARM: HSL = { h: 4, s: 90, l: 58 };
const ROD_C: HSL = { h: 28, s: 48, l: 46 };
const CORK: HSL = { h: 34, s: 42, l: 66 };
const REEL: HSL = { h: 205, s: 12, l: 62 };
const LINE: HSL = { h: 190, s: 20, l: 86 };
/** The dial's hand and minute marks round a ringing clock. */
const FACE: HSL = { h: 42, s: 60, l: 90 };
const FLOAT_TOP: HSL = { h: 356, s: 78, l: 54 };
const FLOAT_LOW: HSL = { h: 40, s: 30, l: 94 };

/** The clock, its middle at (0, 1): a round red case on a flat foot, a cream dial set to an early hour, two brass bells and the hammer between them. */
const clockSprite = () =>
  sprite('it|clock', -7, -8, 14, 15, (g) => {
    part(g, boxPts(-3.2, 4.6, 6.4, 1.6, 0.5, 91), BRASS, 91, { depth: 0.3, thin: 0.3, thick: 0.7 });
    for (const s of [-1, 1]) {
      // A bell: a brass dome tipped out from the top of the case.
      g.save();
      g.translate(s * 3.3, -3.7);
      g.rotate(s * 0.55);
      part(g, poly(-2.3, 0.8, -2, -1, -1, -2.1, 1, -2.1, 2, -1, 2.3, 0.8), BRASS, 92 + s, { depth: 0.4, thin: 0.3, thick: 0.8 });
      g.restore();
    }
    tick(g, 0, -3.6, 0, -6, 0.6, 94, inkFor(BRASS));
    ball(g, 0, -6.2, 0.9, BRASS, 95);
    part(g, ovalPts(0, 1, 5, 4.9, 96, 0.03), CASE, 96, { depth: 0.6, thin: 0.45, thick: 1.1 });
    part(g, ovalPts(0, 1, 3.6, 3.5, 97, 0.03), DIAL, 97, { depth: 0.15, thin: 0.25, thick: 0.5 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      tick(g, Math.cos(a) * 2.7, 1 + Math.sin(a) * 2.7, Math.cos(a) * 3.2, 1 + Math.sin(a) * 3.2, 0.35, 98 + i, inkFor(DIAL));
    }
    // Ten to six: far too early.
    tick(g, 0, 1, 0.1, -1.7, 0.45, 102, css(HANDS));
    tick(g, 0, 1, -1.5, 2.2, 0.5, 103, css(HANDS));
    glint(g, poly(-3.6, -0.6, -2.6, -2.6, -0.8, -3.4), 'rgba(255,225,215,0.8)', 0.5);
  });

/** The rod, butt at (-6, 5.5) and tip at (6.5, -6): a cork grip, a reel under it, a tapering cane with its guides. */
const rodSprite = () =>
  sprite('it|rod', -8, -8, 16, 16, (g) => {
    const cane = poly(-3.4, 3, 0.6, -1, 3.8, -3.9, 6.5, -6);
    g.fillStyle = inkFor(ROD_C);
    stroke(g, cane, { w: 1.6, seed: 111, taper: [0, 0.75], press: 0 });
    g.fillStyle = css(ROD_C);
    stroke(g, cane, { w: 0.9, seed: 111, taper: [0, 0.75], press: 0 });
    for (const [x, y] of [
      [1.6, -1.9],
      [4.4, -4.4],
    ])
      ball(g, x, y, 0.5, REEL, 112 + x);
    g.save();
    g.translate(-4.7, 4.2);
    g.rotate(-0.78);
    part(g, boxPts(-2.6, -1, 5.2, 2, 0.8, 113), CORK, 113, { depth: 0.3, thin: 0.3, thick: 0.7 });
    g.restore();
    ball(g, -2.6, 4.8, 1.9, REEL, 114);
    ball(g, -2.6, 4.8, 0.6, { h: REEL.h, s: 10, l: 34 }, 115);
  });

/** The float, its middle at (0, 0): red over white, a stub on top and the hook under it. */
const floatSprite = () =>
  sprite('it|float', -3, -4, 6, 8.5, (g) => {
    tick(g, 0, 1.5, 0, 3.3, 0.4, 121, inkFor(REEL));
    g.fillStyle = inkFor(REEL);
    stroke(g, poly(0, 3.3, 0.2, 4, 1, 3.9, 1.2, 3.1), { w: 0.4, seed: 122, taper: [0, 0.6], press: 0 });
    part(g, ovalPts(0, 0, 1.9, 1.9, 123, 0.03), FLOAT_LOW, 123, { depth: 0.3, thin: 0.3, thick: 0.6 });
    part(g, poly(-1.9, 0, -1.6, -1.1, -0.8, -1.8, 0.8, -1.8, 1.6, -1.1, 1.9, 0), FLOAT_TOP, 124, { depth: 0.3, thin: 0.3, thick: 0.6 });
    tick(g, 0, -1.8, 0, -3.2, 0.5, 125, css(FLOAT_TOP, -20));
  });

/** Icons for the two, keyed by kind. */
export const REACH_ICONS = {
  clock(s: CanvasRenderingContext2D) {
    stamp(s, clockSprite());
  },
  rod(s: CanvasRenderingContext2D) {
    const ln = poly(6.5, -6, 6.9, -2, 6.6, 1.6);
    s.fillStyle = css(LINE, -30);
    stroke(s, ln, { w: 0.35, seed: 126, taper: [0, 0], press: 0 });
    stamp(s, rodSprite());
    stamp(s, floatSprite(), 6.6, 3.2);
  },
};

/** The fishing line: a thin bar of the kit, rimmed in a dark of its colour. */
const fishLine = (g: CanvasRenderingContext2D, pts: readonly P[], seed: number) => bar(g, pts, 0.45, LINE, seed, { rim: 0.3, taper: [0, 0], press: 0 });

/** The rod's tip as drawn: held up at rest, whipped out level while a cast goes out. */
function tipOf(r: Runner): P {
  const b = r.body;
  const f = b.facing;
  return r.items.cast > 0 ? { x: b.x + b.w / 2 + f * 13, y: b.y + 4 } : { x: b.x + b.w / 2 + f * 13, y: b.y - 6 };
}

/** The rod in hand: from the grip at the runner's front to its tip (`tipOf`). */
export function drawRod(rc: RC, r: Runner, x: number) {
  const s = rc.s;
  const b = r.body;
  const tip = tipOf(r);
  const gx = x + b.facing * 2;
  const gy = b.y + 10;
  // Lay the sprite's butt-to-tip span along grip to tip.
  const ang = Math.atan2(tip.y - gy, (tip.x - gx) * b.facing) - Math.atan2(-11.5, 12.5);
  const k = Math.hypot(tip.x - gx, tip.y - gy) / Math.hypot(12.5, 11.5);
  s.save();
  s.translate(gx, gy);
  s.scale(b.facing, 1);
  s.rotate(ang);
  s.scale(k, k);
  s.translate(6, -5.5);
  stamp(s, rodSprite());
  s.restore();
}

/**
 * Lines out, from the rod's tip to the float, near taut on the way out and sagging as it reels back in; with no line
 * out, the float dangles from a held rod's tip.
 */
export function drawLines(rc: RC, run: RunWorld) {
  const s = rc.s;
  for (const l of run.items.lines) {
    const r = run.runners[l.owner];
    if (!r?.alive) continue;
    const tip = tipOf(r);
    const sag = l.back ? 6 : 1.5;
    const pts: P[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push({ x: tip.x + (l.x - tip.x) * t, y: tip.y + (l.y - tip.y) * t + Math.sin(t * Math.PI) * sag });
    }
    fishLine(s, pts, l.id);
    stamp(s, floatSprite(), l.x, l.y);
  }
  run.runners.forEach((r, i) => {
    if (!r.alive || r.finished || r.items.held?.kind !== 'rod' || run.items.lines.some((l) => l.owner === i)) return;
    const tip = tipOf(r);
    const sway = Math.sin(rc.t * 3 + r.slot) * 0.8;
    fishLine(s, poly(tip.x, tip.y, tip.x + sway, tip.y + 4), 127);
    stamp(s, floatSprite(), tip.x + sway, tip.y + 6);
  });
}

/** Clocks in the air and ringing. A ringing one rattles on its base, and a flat dial round it, as wide as its blast, sweeps toward going off. */
export function drawClocks(rc: RC, run: RunWorld) {
  const s = rc.s;
  for (const c of run.items.clocks) {
    const u = c.fuse ? c.ring / c.fuse : 0;
    if (c.fuse > 0) {
      const bg = rc.bg;
      const R = CLOCK.radius;
      // The sweep: a flat wedge over the top half of the dial, nine o'clock round through twelve to three as the
      // countdown runs (the lower half is in the floor the clock stands on), bright enough to read on
      // any ground, and the hand at its leading edge, inked so it holds on red rock and ice alike.
      const end = Math.PI + u * Math.PI;
      bg.fillStyle = css(ALARM, 10, 0.6 + 0.2 * u);
      bg.beginPath();
      bg.moveTo(c.x, c.y);
      bg.arc(c.x, c.y, R, Math.PI, end);
      bg.closePath();
      bg.fill();
      barLine(bg, c.x - R, c.y, c.x, c.y, 1.4, FACE, 130, { rim: 0.6 });
      barLine(bg, c.x, c.y, c.x + Math.cos(end) * R, c.y + Math.sin(end) * R, 1.6, FACE, 131, { rim: 0.6 });
      // The swept rim, solid: the countdown as a ring filling, which reads on red rock where the wedge's red can't.
      const n = Math.max(2, Math.ceil(u * 16));
      const arc: P[] = [];
      for (let i = 0; i <= n; i++) {
        const a = Math.PI + (u * Math.PI * i) / n;
        arc.push({ x: c.x + Math.cos(a) * R, y: c.y + Math.sin(a) * R });
      }
      bar(bg, arc, 2, FACE, 133, { rim: 0.6 });
      // The rim, dashed like a dial's minutes, cream rimmed in ink.
      for (let i = 0; i < 24; i++) {
        const a0 = (i / 24) * Math.PI * 2;
        const a1 = a0 + (Math.PI * 2) / 48;
        barLine(bg, c.x + Math.cos(a0) * R, c.y + Math.sin(a0) * R, c.x + Math.cos(a1) * R, c.y + Math.sin(a1) * R, i % 6 ? 1.1 : 1.8, FACE, 132 + i, {
          rim: 0.5,
        });
      }
    }
    const rattle = c.fuse > 0 ? Math.sin(rc.t * 95 + c.id) * (0.14 + 0.12 * u) : 0;
    const spin = c.fuse > 0 || c.onGround ? 0 : (run.frame - c.born) * 0.22 * (c.vx < 0 ? -1 : 1);
    s.save();
    s.translate(c.x, c.y - 1 + (c.fuse > 0 ? Math.abs(Math.sin(rc.t * 95 + c.id)) * -0.8 : 0));
    s.rotate(rattle + spin);
    s.scale(0.85, 0.85);
    stamp(s, clockSprite());
    s.restore();
    if (c.fuse > 0) {
      // Ringing: strokes flicking off both bells, behind the ink pass so it can't scrub them.
      const bg = rc.bg;
      bg.fillStyle = css(BRASS, 22);
      const on = Math.floor(rc.t * 24) % 2;
      for (const side of [-1, 1]) {
        const bx = c.x + side * 4;
        const by = c.y - 5;
        for (let k = 0; k < 2; k++) {
          const a = -Math.PI / 2 + side * (0.6 + k * 0.5 + on * 0.15);
          line(bg, bx + Math.cos(a) * 2.8, by + Math.sin(a) * 2.8, bx + Math.cos(a) * (5 + u * 2), by + Math.sin(a) * (5 + u * 2), {
            w: 1.3,
            seed: k + side,
            taper: [0.15, 0.5],
            press: 0,
          });
        }
      }
    }
  }
}
