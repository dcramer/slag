import { css, type HSL } from '../core/color';
import { hash2 } from '../core/rng';
import { TILE } from '../sim/constants';
import { ARCS, BAT, POCKET, swingAngle, TAX, TREMOR } from '../sim/items';
import { T_EMPTY, tileAt } from '../sim/level';
import type { Runner, RunWorld } from '../sim/run';
import { inkFor, line, type P, stroke } from './ink';
import { ball, boxPts, glint, part, path, pen, poly, sprite, stamp, tick } from './ink-props';
import { ellipse, light, type RC } from './kit';

/**
 * Art for the catch-up batch of held items (docs/PARODY.md, Held items): the Walk-Off Bat, the Tremor
 * Brick, the Front-Runner Tax and the Pocket Block. Icons are drawn around (0, 0) in a ~14 px box facing
 * +x, like the rest in items.ts; the live pieces (a wind-up, a raised brick, a shell in the air, a block
 * in the level) read sim state and never write it. Objects only: nothing here has a face.
 */

const WOOD: HSL = { h: 32, s: 58, l: 62 };
const TAPE: HSL = { h: 40, s: 15, l: 90 };

/** The bat, knob down at (0, 4) and barrel up to (0, -17): a slugger's long taper, tape on the grip. */
const batSprite = () =>
  sprite('it|bat', -4, -19, 8, 25, (g) => {
    const half = (y: number) => (y > -2 ? 0.95 : y > -12 ? 0.95 + ((-2 - y) / 10) * 1.35 : 2.3);
    const right: P[] = [];
    const left: P[] = [];
    for (let i = 0; i <= 12; i++) {
      const y = 3 - (i / 12) * 18;
      right.push({ x: half(y), y });
      left.unshift({ x: -half(y), y });
    }
    // The rounded end of the barrel.
    const cap: P[] = [];
    for (let i = 1; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      cap.push({ x: Math.cos(a) * 2.3, y: -15 - Math.sin(a) * 1.9 });
    }
    part(g, [...right, ...cap, ...left], WOOD, 21, { depth: 0.5, thin: 0.4, thick: 0.95 });
    // Grain down the barrel.
    for (const [x, y0, y1] of [
      [-0.9, -14.5, -8],
      [0.7, -13, -6.5],
    ])
      tick(g, x, y0, x * 0.6, y1, 0.3, x * 7, css(WOOD, -20));
    glint(g, poly(-1.4, -14.5, -1.2, -10, -0.7, -5), 'rgba(255,240,215,0.85)', 0.5);
    // Grip tape, wound on a slant.
    part(g, boxPts(-1.15, -1.6, 2.3, 4.6, 0.4, 22), TAPE, 22, { depth: 0.3, thin: 0.3, thick: 0.6 });
    for (const y of [-0.8, 0.5, 1.8]) tick(g, -1.1, y + 0.5, 1.1, y - 0.3, 0.3, y * 5, css(TAPE, -40));
    ball(g, 0, 4, 1.45, { h: 30, s: 50, l: 48 }, 23);
  });

/**
 * How far out from the hands the sprite's barrel ends (its cap, 3 px past the pivot it's drawn from), and the stretch
 * along its length that puts that end at the arc's reach: the bat is drawn as long as it hits (sim/items/swing.ts `ARCS`).
 */
const BAT_TIP = 19.9;
const BAT_LONG = ARCS.bat.r / BAT_TIP;

/** The noodle's swing smear, in the bat's colors and reach. */
const BAT_SMEAR = { r: ARCS.bat.r, cuts: [[9, css(WOOD, 18, 1, -10)] as const, [3.4, css(WOOD, 32, 1, -30)] as const], line: css(WOOD, -32) };

/** Icons for the four, keyed by kind. */
export const EXTRA_ICONS = {
  bat(s: CanvasRenderingContext2D) {
    s.save();
    s.rotate(0.75);
    s.translate(0, 5.5);
    s.scale(0.72, 0.72);
    stamp(s, batSprite());
    s.restore();
  },
  tremor(s: CanvasRenderingContext2D) {
    stamp(s, brickSprite());
  },
  tax(s: CanvasRenderingContext2D, t: number) {
    s.save();
    s.translate(0, 2);
    s.scale(0.6, 0.6);
    taxShell(s, Math.sin(t * 9) * 0.3, false);
    s.restore();
  },
  block(s: CanvasRenderingContext2D) {
    stamp(s, lunchbox());
  },
};

/**
 * The bat in hand: over the shoulder at rest, cocked further back and shaking as the wind-up charges, then
 * one long arc. `sweep` draws the smear (the swing itself lives in items.ts's swing code).
 */
export function drawBat(
  rc: RC,
  r: Runner,
  x: number,
  sweep: (s: CanvasRenderingContext2D, a0: number, a1: number, smear: typeof BAT_SMEAR) => void,
  swingU: number,
  active: boolean,
) {
  const s = rc.s;
  const b = r.body;
  const it = r.items;
  const fc = b.facing;
  const charge = it.windup > 0 ? Math.min(1, (it.windup - 1) / BAT.windup) : 0;
  let ang: number;
  if (swingU >= 0) ang = swingAngle('bat', it.swing);
  else ang = -0.9 - charge * 0.9 + (charge > 0.6 ? Math.sin(rc.t * 70) * 0.06 * charge : 0);
  s.save();
  s.translate(x - fc, b.y + 7);
  s.scale(fc, 1);
  if (active) sweep(s, -Math.PI / 2 + ARCS.bat.from, -Math.PI / 2 + ang, BAT_SMEAR);
  s.rotate(ang);
  // Stretched from the hands, so the grip stays put and the barrel's end is where the swing reaches.
  s.scale(1, BAT_LONG);
  s.translate(0, -3);
  stamp(s, batSprite());
  s.restore();
  if (charge >= 1 || (it.windup > 0 && charge > 0.98)) {
    // Full: a hard twinkle at the barrel's end, the cue to let go.
    const tip = ARCS.bat.r - 2;
    const tipX = x - fc + Math.sin(ang) * tip * fc;
    const tipY = b.y + 7 - Math.cos(ang) * tip;
    twinkle(s, tipX, tipY, 3.2 + Math.sin(rc.t * 40), '#fff3c4');
    light(rc, tipX, tipY, 24, { h: 48, s: 100, l: 70 }, 0.6);
  } else if (charge > 0) {
    // Charging: pen ticks crowd the swinger's back, more of them as it builds, in a dark of the bat.
    s.fillStyle = inkFor(WOOD);
    const n = 1 + Math.floor(charge * 3);
    for (let i = 0; i < n; i++) {
      const y = b.y + 3 + i * 3.6;
      const x0 = x - fc * (7 + (i % 2) * 1.5);
      line(s, x0, y, x0 - fc * (2.5 + charge * 2.5), y - 0.6, { w: 0.6, seed: i, taper: [0.1, 0.8], press: 0 });
    }
  }
}

/** A four-point twinkle: two crossed pen flicks. */
function twinkle(c: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  if (r < 0.4) return;
  c.fillStyle = col;
  line(c, x - r, y, x + r, y, { w: r * 0.45, seed: 1, taper: [0.5, 0.5], press: 0 });
  line(c, x, y - r, x, y + r, { w: r * 0.45, seed: 2, taper: [0.5, 0.5], press: 0 });
}

const BRICK: HSL = { h: 14, s: 58, l: 47 };

/** Tremor Brick: a chunky block with a seismograph strip on its face, its trace scribbled off the scale. */
const brickSprite = () =>
  sprite('it|brick', -7.5, -7, 15, 13.5, (g) => {
    part(g, boxPts(-6.4, -5.6, 12.8, 10.8, 1.6, 31), BRICK, 31, { depth: 0.8, thin: 0.5, thick: 1.15 });
    // Chipped corners and the mortar-dust bevel.
    tick(g, -5.6, -4.6, 5.4, -4.6, 0.35, 32, css(BRICK, 18));
    tick(g, -5.6, 3.9, 5.6, 3.9, 0.35, 33, css(BRICK, -18));
    // The paper strip, ruled, with the trace on it.
    part(g, boxPts(-4.8, -2.6, 9.6, 5.2, 0.3, 34), { h: 48, s: 35, l: 92 }, 34, { depth: 0.2, thin: 0.25, thick: 0.55 });
    for (const y of [-1.4, 0, 1.4]) tick(g, -4.4, y, 4.4, y, 0.18, y * 3 + 35, 'rgba(70,110,150,0.45)');
    const trace = poly(-4.4, 0, -3.2, 0, -2.6, -1.9, -1.9, 2, -1.1, -2.3, -0.4, 2.2, 0.4, -2.2, 1.1, 1.6, 1.8, -1, 2.6, 0.4, 4.4, 0.1);
    g.fillStyle = '#c62424';
    stroke(g, trace, { w: 0.42, seed: 36, taper: [0.1, 0.1], press: 0 });
  });

/** The brick held up over the head, shaking harder as it's about to come down. */
export function drawRaisedBrick(rc: RC, r: Runner, x: number) {
  const b = r.body;
  const u = 1 - r.items.slam / TREMOR.delay;
  const shake = Math.sin(rc.t * 90) * 0.7 * u;
  const y = b.y - 7 - 3 * Math.sin(Math.min(1, u * 1.4) * Math.PI * 0.5);
  stamp(rc.s, brickSprite(), x + shake, y);
  // Strain ticks either side, the way a comic shows something heavy about to drop.
  rc.s.fillStyle = inkFor(BRICK);
  for (const d of [-1, 1]) {
    line(rc.s, x + d * 9, y - 3, x + d * 11.5, y - 4.5, { w: 0.6, seed: d + 2, taper: [0.1, 0.8], press: 0 });
    line(rc.s, x + d * 9.5, y + 1, x + d * 12.5, y + 1, { w: 0.6, seed: d + 5, taper: [0.1, 0.8], press: 0 });
  }
}

const DOME: HSL = { h: 222, s: 40, l: 40 };
const SPIKE: HSL = { h: 45, s: 30, l: 88 };
const PAPER_HSL: HSL = { h: 44, s: 48, l: 92 };
const PAPER = css(PAPER_HSL);
/** The hard shadow a shell casts: a dark of its dome. */
const SHADOW = inkFor(DOME);

/** The spiked dome, rim down at y 1.2. */
const domeSprite = () =>
  sprite('it|taxdome', -7, -9, 14, 11.5, (g) => {
    for (const [a, l] of [
      [-2.5, 2.6],
      [-1.9, 3],
      [-1.25, 3.2],
      [-0.65, 2.9],
    ]) {
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const bx = ca * 4.6;
      const by = 1.2 + sa * 4.2;
      const nx = -sa;
      const ny = ca;
      part(g, poly(bx + nx * 1.1, by + ny * 1.1, bx + ca * l, by + sa * l, bx - nx * 1.1, by - ny * 1.1), SPIKE, 41 + a, { depth: 0.2, thin: 0.3, thick: 0.6 });
    }
    const dome: P[] = [];
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + (i / 12) * Math.PI;
      dome.push({ x: Math.cos(a) * 5.2, y: 1.2 + Math.sin(a) * 4.6 });
    }
    part(g, dome, DOME, 42, { depth: 0.7, thin: 0.45, thick: 1.1 });
    glint(g, poly(-3.4, -0.6, -2.4, -2.4, -0.8, -3.1), 'rgba(220,230,255,0.8)', 0.5);
    part(g, boxPts(-5.8, 0.6, 11.6, 1.8, 0.8, 43), SPIKE, 43, { depth: 0.2, thin: 0.35, thick: 0.8 });
  });

/** One folded-paper wing from the shoulder at (0, 0), out along `d`, its tip lifted by `flap`. */
function wing(s: CanvasRenderingContext2D, d: number, flap: number, mark: boolean) {
  const tipY = -5.5 - flap * 4.5;
  const pts = poly(d * 3, -2.6, d * 11.5, tipY, d * 12.8, tipY + 2.8, d * 4.4, 1);
  s.fillStyle = PAPER;
  path(s, pts);
  s.fill();
  pen(s, pts, 44 + d, 0.4, 0.9, 2, inkFor(PAPER_HSL));
  // The fold down its middle, and on one wing the circled "1ST" marked up in red.
  tick(s, d * 3.8, -0.8, d * 12, tipY + 1.4, 0.3, 45 + d, 'rgba(90,80,70,0.7)');
  if (!mark) return;
  s.save();
  s.translate(d * 8.2, (tipY + 1.4 - 0.8) * 0.5 + 1.1);
  s.rotate(Math.atan2(tipY + 1.4 + 0.8, d * 8.2) * 0.6);
  s.fillStyle = '#c62424';
  s.font = 'bold 2.1px sans-serif';
  s.textAlign = 'center';
  s.textBaseline = 'middle';
  s.fillText('1ST', 0, 0.1);
  s.strokeStyle = '#c62424';
  s.lineWidth = 0.4;
  s.beginPath();
  s.ellipse(0, 0, 2.5, 1.55, 0, 0, Math.PI * 2);
  s.stroke();
  s.restore();
}

/** The whole shell: two paper wings off a spiked dome. `flap` -1..1; `dive` turns it spikes-first. */
function taxShell(s: CanvasRenderingContext2D, flap: number, dive: boolean) {
  s.save();
  if (dive) s.rotate(Math.PI);
  wing(s, -1, dive ? -0.6 : flap, false);
  wing(s, 1, dive ? -0.6 : flap, true);
  stamp(s, domeSprite());
  s.restore();
}

/** Where the ground is straight below (x, y), in px, or null over the pit. */
function groundBelow(run: RunWorld, x: number, y: number): number | null {
  const L = run.level;
  const tx = Math.floor(x / TILE);
  for (let ty = Math.max(0, Math.floor(y / TILE)); ty < L.h; ty++) if (tileAt(L, tx, ty) !== T_EMPTY) return ty * TILE;
  return null;
}

/** The tell under a hovering or diving shell: a hard, flat shadow on the ground, swelling as the dive nears. Drawn under the runners. */
export function drawShellShadows(rc: RC, run: RunWorld) {
  const s = rc.s;
  for (const sh of run.items.shells) {
    if (sh.phase === 'fly') continue;
    const v = run.runners[sh.target];
    const tx = sh.phase === 'dive' ? sh.dx : v ? v.body.x + v.body.w / 2 : sh.x;
    const gy = groundBelow(run, tx, sh.phase === 'dive' ? sh.dy : v ? v.body.y : sh.y);
    if (gy === null) continue;
    const u = sh.phase === 'dive' ? 1 : Math.min(1, sh.t / TAX.hover);
    s.fillStyle = SHADOW;
    ellipse(s, tx, gy - 0.6, 6 + u * (TAX.radius * 0.75 - 6), 1.4 + u * 1.8);
  }
}

/**
 * Front-Runner Tax shells. Cruising they flap and trail speed lines; over their mark they wobble in place
 * while their shadow swells on the ground (drawShellShadows), then fold their wings and drop spikes first.
 */
export function drawShells(rc: RC, run: RunWorld) {
  const s = rc.s;
  for (const sh of run.items.shells) {
    const flap = Math.sin(rc.t * 22 + sh.id);
    s.save();
    const wob = sh.phase === 'hover' ? Math.sin(rc.t * 9) * 2.4 : 0;
    s.translate(sh.x + wob, sh.y + (sh.phase === 'hover' ? Math.cos(rc.t * 9) * 1.2 : 0));
    if (sh.phase === 'dive') {
      s.fillStyle = inkFor(DOME);
      for (const ox of [-3.5, 0, 3.5]) line(s, ox, -7, ox, -16 - Math.abs(ox), { w: 0.8, seed: ox + 9, taper: [0.8, 0.1], press: 0 });
    } else if (sh.phase === 'fly') {
      s.fillStyle = inkFor(DOME);
      for (let i = 0; i < 2; i++) line(s, -8, -1 + i * 3, -14 - i * 2, -1 + i * 3, { w: 0.7, seed: i + 3, taper: [0.1, 0.8], press: 0 });
    }
    taxShell(s, flap, sh.phase === 'dive');
    s.restore();
    light(rc, sh.x, sh.y, 22, { h: 0, s: 80, l: 60 }, 0.3);
  }
}

const DIRT: HSL = { h: 26, s: 42, l: 36 };
const GRASS: HSL = { h: 98, s: 52, l: 44 };
const STICKER: HSL = { h: 50, s: 15, l: 96 };
const HANDLE: HSL = { h: 0, s: 0, l: 54 };

/** A turf cube a tile across, with the assembly-instructions sticker slapped on its face. */
const turfSprite = () =>
  sprite('it|turf', -1, -1, 18, 18, (g) => {
    part(g, boxPts(0.4, 0.4, 15.2, 15.2, 1.4, 51), DIRT, 51, { depth: 0.8, thin: 0.5, thick: 1.2 });
    for (let i = 0; i < 5; i++) {
      const px = 2.5 + hash2(i, 1, 52) * 11;
      const py = 7 + hash2(i, 2, 52) * 7;
      ball(g, px, py, 0.6 + hash2(i, 3, 52) * 0.4, { h: 30, s: 15, l: 55 }, 53 + i);
    }
    // A grass lid with a ragged lower edge.
    const lid: P[] = [
      { x: 0.6, y: 0.6 },
      { x: 15.4, y: 0.6 },
    ];
    for (let i = 0; i <= 10; i++) lid.push({ x: 15.4 - i * 1.48, y: 4 + (i % 2 ? 1.4 : 0) + hash2(i, 4, 52) * 0.6 });
    part(g, lid, GRASS, 54, { depth: 0.4, thin: 0.4, thick: 0.9 });
    // The sticker: step 1, a cube with an arrow dropping it into place.
    g.save();
    g.translate(9.6, 9.2);
    g.rotate(-0.12);
    part(g, boxPts(-3, -2.4, 6, 4.8, 0.2, 55), STICKER, 55, { depth: 0.15, thin: 0.25, thick: 0.5 });
    g.fillStyle = inkFor(STICKER);
    g.font = 'bold 1.6px sans-serif';
    g.textBaseline = 'middle';
    g.fillText('1', -2.6, -1.2);
    g.strokeStyle = inkFor(STICKER, 0.85);
    g.lineWidth = 0.22;
    g.strokeRect(-0.2, -0.2, 1.8, 1.6);
    g.beginPath();
    g.moveTo(0.7, -2);
    g.lineTo(0.7, -0.6);
    g.moveTo(0.2, -1.1);
    g.lineTo(0.7, -0.5);
    g.lineTo(1.2, -1.1);
    g.stroke();
    for (const y of [1.8, 2.3]) tick(g, -2.5, y - 0.4, 2.3, y - 0.4, 0.15, y * 9, 'rgba(60,60,60,0.5)');
    g.restore();
  });

/** The icon: a small turf cube carried by a handle, like a lunchbox. */
const lunchbox = () =>
  sprite('it|lunch', -7, -8, 14, 15, (g) => {
    g.fillStyle = inkFor(HANDLE);
    stroke(g, poly(-2.6, -2.6, -2.2, -5.6, 2.2, -5.6, 2.6, -2.6), { w: 0.98, seed: 56, taper: [0, 0], press: 0 });
    g.fillStyle = css(HANDLE);
    stroke(g, poly(-2.6, -2.6, -2.2, -5.4, 2.2, -5.4, 2.6, -2.6), { w: 0.5, seed: 56, taper: [0, 0], press: 0 });
    g.save();
    g.translate(-5.4, -3);
    g.scale(0.68, 0.62);
    stamp(g, turfSprite());
    g.restore();
  });

/** Jagged cracks from each corner toward the middle, as flat [x, y, ...] from the corner in. */
const CRACKS = [
  [-7, -7, -3.5, -4.2, -3.9, -1.6, -1, 0.4],
  [7, 7, 3.2, 4.6, 3.8, 1.4, 0.8, -0.6],
  [7, -7, 4.1, -3.6, 1.8, -3.9, 0.6, -1.2],
  [-7, 7, -4.4, 3.4, -1.6, 3.8, -0.5, 1.1],
];
const crackPts: P[] = Array.from({ length: 4 }, () => ({ x: 0, y: 0 }));

/** Pocket Blocks in the level: popping in, then jittering and cracking before they crumble. */
export function drawPocketBlocks(rc: RC, run: RunWorld) {
  const s = rc.s;
  for (const k of run.items.blocks) {
    const age = run.frame - k.born;
    const left = k.until - run.frame;
    const pop = age < 5 ? 0.7 + (age / 5) * 0.3 : 1;
    const warn = left < POCKET.warn ? 1 - left / POCKET.warn : 0;
    const jx = warn > 0 ? Math.sin(rc.t * 80 + k.tx) * 0.5 * warn : 0;
    const x = k.tx * TILE;
    const y = k.ty * TILE;
    s.save();
    s.translate(x + 8 + jx, y + 8);
    s.scale(pop, pop);
    stamp(s, turfSprite(), -8, -8);
    if (warn > 0) {
      // Cracks spread from the corners as it gives out.
      s.fillStyle = inkFor(DIRT);
      const n = Math.ceil(warn * 4);
      const reach = 0.35 + warn * 0.55;
      for (let i = 0; i < n; i++) {
        const ex = CRACKS[i];
        for (let j = 0; j < 4; j++) {
          crackPts[j].x = ex[0] + (ex[j * 2] - ex[0]) * reach;
          crackPts[j].y = ex[1] + (ex[j * 2 + 1] - ex[1]) * reach;
        }
        stroke(s, crackPts, { w: 0.9, seed: i + k.tx, taper: [0.1, 0.9], press: 0 });
      }
    }
    s.restore();
  }
}
