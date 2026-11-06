import { css, type HSL } from '../core/color';
import { HOOK } from '../sim/items';
import type { Runner, RunWorld } from '../sim/run';
import { inkFor, type P, stroke } from './ink';
import { ball, boxPts, glint, ovalPts, part, poly, sprite, stamp, tick } from './ink-props';
import { glowDot, light, type RC } from './kit';

/**
 * Art for the climb's two items (docs/PARODY.md, Held items): the Queue Jumper, a brass queue-post hook on a red
 * velvet rope, and the Upper Hand, a boxing glove strapped to a firework. Icons are drawn around (0, 0) in a ~14 px
 * box facing +x, like the rest; the live pieces (a line reeling out, a glove going up) read sim state and never
 * write it.
 */

const BRASS: HSL = { h: 44, s: 78, l: 56 };
const VELVET: HSL = { h: 352, s: 62, l: 38 };
const GLOVE: HSL = { h: 4, s: 72, l: 50 };
const CUFF: HSL = { h: 40, s: 30, l: 90 };
const TUBE: HSL = { h: 210, s: 45, l: 46 };
const STICK: HSL = { h: 32, s: 45, l: 58 };
const SPARK: HSL = { h: 38, s: 100, l: 62 };

/** A pen-rimmed rope: a dark of its colour, then the colour inside it. */
function rope(g: CanvasRenderingContext2D, pts: readonly P[], w: number, col: HSL, seed: number) {
  g.fillStyle = inkFor(col);
  stroke(g, pts, { w: w + 0.7, seed, taper: [0, 0], press: 0 });
  g.fillStyle = css(col);
  stroke(g, pts, { w, seed, taper: [0, 0], press: 0 });
}

/** The brass hook, eye up at (0, -5): a shank down and a barb curling back up to the right. */
const hookSprite = () =>
  sprite('it|qhook', -3, -8, 9, 14, (g) => {
    rope(g, poly(0, -4, 0, 1.6, 0.6, 3.4, 2.2, 4.2, 3.8, 3.4, 4.3, 1.4), 1.3, BRASS, 61);
    part(g, poly(4.3, 0.2, 5.2, 1.9, 3.6, 1.6), BRASS, 62, { depth: 0.2, thin: 0.3, thick: 0.6 });
    ball(g, 0, -5.4, 1.5, BRASS, 63);
    ball(g, 0, -5.4, 0.55, { h: BRASS.h, s: 40, l: 24 }, 64);
    glint(g, poly(-0.4, -3, -0.4, 1), 'rgba(255,245,200,0.85)', 0.4);
  });

/** The glove, fist up at (0, -3), on its firework: cuff, a blue tube and a stick down to (0, 12). */
const gloveSprite = () =>
  sprite('it|upper', -6, -9, 12, 22, (g) => {
    rope(g, poly(0.4, 6, 0.6, 12), 0.7, STICK, 71);
    part(g, boxPts(-1.7, 3.6, 3.4, 4.6, 0.5, 72), TUBE, 72, { depth: 0.4, thin: 0.35, thick: 0.8 });
    tick(g, -1.6, 5.4, 1.6, 5, 0.35, 73, css(CUFF, -10));
    part(g, boxPts(-3.2, 1.6, 6.4, 2.4, 0.8, 74), CUFF, 74, { depth: 0.3, thin: 0.35, thick: 0.8 });
    part(g, ovalPts(-0.3, -2.4, 3.9, 4.4, 75, 0.05), GLOVE, 75, { depth: 0.7, thin: 0.45, thick: 1.1 });
    part(g, ovalPts(3.2, -0.6, 1.5, 2.2, 76, 0.05), GLOVE, 76, { depth: 0.4, thin: 0.35, thick: 0.8 });
    // The knuckle line across the top, and a shine.
    tick(g, -3, -4.2, 2.4, -4.6, 0.4, 77, css(GLOVE, -26));
    glint(g, poly(-2.6, -2, -2.2, -4.6, -0.8, -5.6), 'rgba(255,225,215,0.8)', 0.5);
  });

/** Icons for the two, keyed by kind. */
export const CLIMB_ICONS = {
  hook(s: CanvasRenderingContext2D) {
    // A coil of velvet off the eye, behind the hook.
    rope(s, poly(0.2, -5.2, -2.8, -4.6, -4.6, -2, -3.6, 1.2, -5.2, 3.6, -4.4, 5.8), 1.5, VELVET, 65);
    stamp(s, hookSprite());
  },
  upper(s: CanvasRenderingContext2D) {
    s.save();
    s.rotate(0.35);
    s.scale(0.72, 0.72);
    s.translate(0, -1.5);
    stamp(s, gloveSprite());
    s.restore();
  },
};

/**
 * Queue Jumper lines, drawn with the runners (`up` moves a runner onto the leader's lap): velvet rope paying out from
 * the thrower's hand toward whoever it's after, sagging until it's almost there, with the hook on its end.
 */
export function drawHooks(rc: RC, run: RunWorld, up: (r: Runner) => number) {
  const s = rc.s;
  for (const h of run.items.hooks) {
    const a = run.runners[h.owner];
    const b = run.runners[h.target];
    if (!a || !b) continue;
    const ax = a.body.x + a.body.w / 2 + a.body.facing * 5;
    const ay = a.body.y + 9 - up(a);
    const bx = b.body.x + b.body.w / 2;
    const by = b.body.y + b.body.h / 2 - up(b);
    const u = Math.min(1, (h.t + 1) / HOOK.reel);
    const k = 1 - (1 - u) * (1 - u);
    const tx = ax + (bx - ax) * k;
    const ty = ay + (by - ay) * k;
    const sag = 10 * (1 - k) + 3;
    const pts: P[] = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push({ x: ax + (tx - ax) * t, y: ay + (ty - ay) * t + Math.sin(t * Math.PI) * sag });
    }
    rope(s, pts, 1.2, VELVET, h.id);
    s.save();
    s.translate(tx, ty);
    s.rotate(Math.atan2(ty - ay, tx - ax) + Math.PI / 2);
    stamp(s, hookSprite());
    s.restore();
  }
}

/** Upper Hands going up: the glove on its firework, a hot spray off the tube and speed lines under it. */
export function drawFists(rc: RC, run: RunWorld) {
  const s = rc.s;
  for (const f of run.items.fists) {
    const wob = Math.sin(rc.t * 40 + f.id) * 0.6;
    s.fillStyle = inkFor(TUBE);
    for (const [ox, len] of [
      [-2.4, 10],
      [0, 16],
      [2.4, 9],
    ])
      stroke(s, poly(f.x + ox, f.y + 12, f.x + ox * 1.3, f.y + 12 + len), { w: 0.7, seed: ox + f.id, taper: [0.1, 0.85], press: 0 });
    s.save();
    s.translate(f.x + wob, f.y);
    stamp(s, gloveSprite());
    s.restore();
    for (let i = 0; i < 3; i++) glowDot(rc.g, f.x + Math.sin(rc.t * 50 + i * 2.1) * 1.6, f.y + 9 + i * 3, 3.4 - i * 0.8, SPARK, 0.9);
    light(rc, f.x, f.y + 8, 26, SPARK, 0.5);
  }
}
