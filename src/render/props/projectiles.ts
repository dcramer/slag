import { css, type HSL } from '../../core/color';
import { TILE } from '../../sim/constants';
import { type Ammo, CLUSTER_FUSE, FACE, GLIDER_CRUISE, GLIDER_H, GLIDER_W, PATCH_FRAMES, PATCH_PX, patchRect } from '../../sim/props';
import type { Projectile } from '../../sim/run';
import { line, type P, stroke } from '../ink';
import { ball, boxPts, dot, glint, INK, ovalPts, part, path, pen, poly, type Sprite, sprite, stamp, tick } from '../ink-props';
import { circle, ellipse, flame, glowDot, light, type RC } from '../kit';
import { dazeStars, drawItemShot, stunnerang } from '../items';
import type { Emit } from './common';

/**
 * Everything a launcher throws, inked (docs/PARODY.md, Launchers): each round is a baked sprite drawn
 * along +x, stamped turned to its flight. Rounds that fly upright (anything with a top, a label or a stem) are
 * mirrored when they fly left, so their top stays on top and the light stays where it is.
 */

const STEEL: HSL = { h: 212, s: 9, l: 74 };
const WOOD: HSL = { h: 30, s: 52, l: 50 };
const BANANA: HSL = { h: 47, s: 88, l: 58 };

/** One banana along +x from its stem at the origin: a crescent with brown ends. */
function banana(g: CanvasRenderingContext2D, L: number, seed: number) {
  const top: P[] = [];
  const bot: P[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const x = t * L;
    const bend = Math.sin(t * Math.PI);
    top.push({ x, y: -bend * L * 0.3 - (1 - Math.abs(t * 2 - 1)) * L * 0.08 });
    bot.unshift({ x, y: -bend * L * 0.3 + Math.sin(t * Math.PI) * L * 0.2 });
  }
  const pts = [...top, ...bot];
  part(g, pts, BANANA, seed, { depth: L * 0.06, thin: 0.4, thick: 0.9 });
  g.fillStyle = css(BANANA, -30, 1, -30, -14);
  path(g, poly(-0.4, -0.5, 1.1, -0.9, 1.1, 0.6, -0.4, 0.3));
  g.fill();
  dot(g, L, -0.1, Math.max(0.35, L * 0.06), seed + 4);
}

/** The round art, baked: `key` → sprite. Kept here so launchers can show a loaded round with the same picture. */
const ROUNDS: Partial<Record<Ammo | 'arrowhead', () => Sprite>> = {
  bolt: () => sprite('ammo|bolt', -12, -3.4, 17, 6.8, (g) => bolt(g, false)),
  arrow: () => sprite('ammo|arrow', -12, -3.4, 17, 6.8, (g) => bolt(g, true)),
  cannonball: () => sprite('ammo|ball', -7, -7, 14, 14, (g) => ball(g, 0, 0, 5, { h: 225, s: 10, l: 26 })),
  // Heartburn: a chili, stem at the back.
  fireball: () =>
    sprite('ammo|chili', -8, -4.5, 15.5, 9, (g) => {
      const body = poly(-4.6, -2.2, -2, -3, 1.2, -2.6, 3.8, -1.2, 5.6, 0.8, 6.2, 2, 4.6, 1.4, 2, 0.8, -1, 1.3, -3.6, 1.6, -5, 0.4);
      part(g, body, { h: 3, s: 85, l: 47 }, 11, { depth: 0.8, thin: 0.5, thick: 1.1 });
      glint(g, poly(-3, -2.1, 0, -2.3, 2.6, -1.4), 'rgba(255,225,215,0.9)', 0.6);
      part(g, poly(-5.4, -1.8, -4, -2.6, -3.5, 0.9, -5, 0.9), { h: 105, s: 55, l: 38 }, 12, { depth: 0.3, thin: 0.35, thick: 0.7 });
      g.fillStyle = INK;
      stroke(g, poly(-5, -0.6, -6.2, -1.2, -7, -2.4), { w: 1.3, seed: 2, taper: [0, 0.3], press: 0 });
      g.fillStyle = css({ h: 105, s: 55, l: 42 });
      stroke(g, poly(-5, -0.6, -6.2, -1.2, -7, -2.4), { w: 0.6, seed: 2, taper: [0, 0.3], press: 0 });
    }),
  slug: () => sprite('ammo|slug', -3.4, -1.8, 7, 3.6, slug),
  // Sorry: every shot is a little speech bubble, trailing off.
  plasma: () =>
    sprite('ammo|bubble', -5.5, -4.5, 11, 9.5, (g) => {
      const b = boxPts(-4, -3.2, 8, 5.4, 2.2, 5);
      const tail = poly(-1.6, 1.9, -3, 4.2, 0.4, 2.1);
      g.fillStyle = '#f7f4ec';
      path(g, tail);
      g.fill();
      part(g, b, { h: 45, s: 30, l: 95 }, 6, { depth: 0.5, thin: 0.45, thick: 0.9, shade: -12 });
      g.fillStyle = '#f7f4ec';
      path(g, poly(-1.9, 1.4, -2.7, 3.6, 0.3, 1.4));
      g.fill();
      g.fillStyle = INK;
      stroke(g, poly(-1.6, 2.2, -2.9, 4, 0.4, 2.4), { w: 0.6, seed: 3, taper: [0.1, 0.1], press: 0 });
      for (const x of [-1.7, 0, 1.7]) dot(g, x, -0.5, 0.45, x * 3 + 9);
    }),
  shuriken: () =>
    sprite('ammo|star', -6, -6, 12, 12, (g) => {
      const pts: P[] = [];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.2;
        const r = i % 2 ? 1.5 : 4.8;
        pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
      }
      part(g, pts, STEEL, 21, { depth: 0.6, thin: 0.45, thick: 1 });
      dot(g, 0, 0, 0.95, 22);
    }),
  // Grudge: a missile with a red seeker lens in its nose cone and a chalk tally on its side.
  seeker: () =>
    sprite('ammo|grudge', -8.5, -5, 17, 10, (g) => {
      for (const sg of [-1, 1])
        part(g, poly(-3.8, sg * 1.8, -7.4, sg * 4, -6.6, sg * 1.2), { h: 2, s: 70, l: 46 }, 30 + sg, { depth: 0.3, thin: 0.35, thick: 0.7 });
      part(g, boxPts(-6, -2.1, 9.6, 4.2, 1.6, 31), { h: 220, s: 8, l: 86 }, 32, { depth: 0.6, thin: 0.45, thick: 1 });
      // A red band behind the nose, and the chalk tally of everyone it caught.
      tick(g, 1.6, -2, 1.6, 2, 0.9, 36, css({ h: 2, s: 70, l: 46 }));
      for (const x of [-3.6, -2.9, -2.2]) tick(g, x, -1.2, x - 0.1, 1, 0.3, x * 9, 'rgba(18,11,8,0.7)');
      part(g, poly(3.2, -2.1, 7.2, 0, 3.2, 2.1), { h: 2, s: 75, l: 48 }, 33, { depth: 0.4, thin: 0.4, thick: 0.9 });
      // The seeker: a dark glass dome on the cone's tip, its lit LED drawn live.
      g.fillStyle = INK;
      circle(g, 5.4, 0, 1.05);
      g.fillStyle = '#d0141f';
      circle(g, 5.45, 0, 0.6);
      g.fillStyle = 'rgba(255,220,215,0.9)';
      g.fillRect(5.05, -0.45, 0.35, 0.3);
    }),
  boomerang: () => sprite('ammo|rang', -6.5, -4, 13, 8.5, (g) => rang(g)),
  // Dodgeball: the red playground ball, seams and all.
  rubber: () =>
    sprite('ammo|dodge', -6, -6, 12, 12, (g) => {
      ball(g, 0, 0, 4.5, { h: 3, s: 70, l: 50 }, 41);
      g.fillStyle = css({ h: 3, s: 70, l: 32 });
      stroke(g, poly(-3.8, -1.6, -1, -0.4, 1.6, 0.2, 4, 1.8), { w: 0.6, seed: 42, taper: [0.2, 0.2], press: 0.1 });
      stroke(g, poly(-0.6, -4.2, 0.2, -1.6, 0.2, 1.4, -0.8, 4.2), { w: 0.6, seed: 43, taper: [0.2, 0.2], press: 0.1 });
    }),
  // A banana bunch: it splits into single bananas.
  cluster: () =>
    sprite('ammo|bunch', -6, -7, 13, 12, (g) => {
      for (const [a, L] of [
        [-0.95, 7.2],
        [-0.35, 7.8],
        [0.25, 7],
      ] as const) {
        g.save();
        g.translate(-3.6, 2.4);
        g.rotate(a);
        banana(g, L, 50 + a * 10);
        g.restore();
      }
      part(g, boxPts(-5, 1.2, 2.6, 2.6, 0.8, 51), { h: 30, s: 45, l: 30 }, 52, { depth: 0.3, thin: 0.35, thick: 0.7 });
    }),
  shrapnel: () =>
    sprite('ammo|banana', -3.5, -3.5, 7.5, 6, (g) => {
      g.translate(-2.6, 1.2);
      banana(g, 5.2, 61);
    }),
  // A sneeze, mostly.
  goo: () =>
    sprite('ammo|snot', -6, -5, 12, 10, (g) => {
      const blobP = ovalPts(0, 0, 4.2, 3.3, 71, 0.14);
      part(g, blobP, { h: 92, s: 62, l: 46 }, 72, { depth: 0.8, thin: 0.45, thick: 1 });
      glint(g, poly(-2.4, -1.4, -0.8, -2.2, 0.8, -2.1), 'rgba(235,255,200,0.9)', 0.7);
      g.fillStyle = css({ h: 92, s: 62, l: 62 });
      circle(g, 1.6, 0.6, 0.6);
    }),
  frost: () =>
    sprite('ammo|slush', -6, -3.6, 12, 7.2, (g) => {
      const top = poly(5.2, 0, 0.4, -2.8, -5, 0);
      const bot = poly(5.2, 0, -5, 0, 0.4, 2.8);
      g.fillStyle = '#e4f6ff';
      path(g, top);
      g.fill();
      g.fillStyle = '#86c8ea';
      path(g, bot);
      g.fill();
      pen(g, poly(5.2, 0, 0.4, -2.8, -5, 0, 0.4, 2.8), 81, 0.45, 1, 3, '#173c55');
      tick(g, -2, 0.1, 3, 0.1, 0.4, 82, 'rgba(255,255,255,0.9)');
    }),
};

/** A sentry's slug: a stubby brass round with a dark nose, drawn along +x. */
function slug(g: CanvasRenderingContext2D) {
  part(g, boxPts(-2.2, -0.9, 3.6, 1.8, 0.6, 41), { h: 42, s: 70, l: 58 }, 41, { depth: 0.25, thin: 0.25, thick: 0.5 });
  part(g, poly(1.2, -0.8, 2.6, 0, 1.2, 0.8), { h: 24, s: 30, l: 34 }, 42, { depth: 0.15, thin: 0.25, thick: 0.4 });
}

function bolt(g: CanvasRenderingContext2D, arrow: boolean) {
  g.fillStyle = INK;
  line(g, -10, 0, 1.6, 0, { w: 1.7, seed: 1, taper: [0.02, 0.02], press: 0 });
  g.fillStyle = arrow ? '#b9884f' : '#8a909b';
  line(g, -9.6, -0.15, 1.2, -0.15, { w: 0.7, seed: 1, taper: [0.02, 0.02], press: 0 });
  for (const sg of [-1, 1])
    part(g, poly(-11, 0, -7.6, 0, -9.4, sg * 2.4, -11.4, sg * 2.4), arrow ? { h: 40, s: 30, l: 88 } : { h: 2, s: 70, l: 48 }, 3 + sg, {
      depth: 0.3,
      thin: 0.3,
      thick: 0.6,
    });
  part(g, poly(0.6, -2, 4.4, 0, 0.6, 2, 1.5, 0), STEEL, 2, { depth: 0.4, thin: 0.4, thick: 0.8 });
}

/** The glaive's boomerang: a V of painted wood. */
export function rang(g: CanvasRenderingContext2D) {
  const pts = poly(-5.2, 3, -4.8, 1.6, -0.8, -2.7, 0.8, -2.7, 4.8, 1.6, 5.2, 3, 3.6, 3.4, 0, -0.4, -3.6, 3.4);
  part(g, pts, WOOD, 91, { depth: 0.6, thin: 0.45, thick: 1 });
  tick(g, -1.2, -1.6, 1.2, -1.6, 1, 92, '#d8402e');
  glint(g, poly(-4.4, 1.6, -2.4, -0.6, -0.8, -2), 'rgba(255,235,200,0.8)', 0.5);
}

export function roundSprite(ammo: Ammo): Sprite | undefined {
  return ROUNDS[ammo]?.();
}

/** Stamp a round at (x, y) turned to `a`; upright rounds mirror when they head left. */
export function stampRound(s: CanvasRenderingContext2D, sp: Sprite, x: number, y: number, a: number, upright = true, k = 1) {
  s.save();
  s.translate(x, y);
  s.rotate(a);
  if (upright && Math.cos(a) < 0) s.scale(k, -k);
  else if (k !== 1) s.scale(k, k);
  stamp(s, sp);
  s.restore();
}

function round(rc: RC, p: Projectile, a: number, upright = true) {
  const sp = ROUNDS[p.ammo]?.();
  if (sp) stampRound(rc.s, sp, p.x, p.y, a, upright);
}

function streak(g: CanvasRenderingContext2D, p: Projectile, k: number, col: string, w: number) {
  g.fillStyle = col;
  line(g, p.x, p.y, p.x - p.vx * k, p.y - p.vy * k, { w, seed: 5, taper: [0.1, 0.9], press: 0 });
}

function drawBolt(rc: RC, p: Projectile, a: number) {
  round(rc, p, a);
  streak(rc.bg, p, 0.06, 'rgba(255,255,255,0.22)', 1);
}

/** A slug flies too fast to read alone: a hard tracer streak behind it, hot at the round and cut off square. */
function drawSlug(rc: RC, p: Projectile, a: number) {
  const hot: HSL = { h: 44, s: 100, l: 66 };
  streak(rc.bg, p, 0.045, 'rgba(255,214,120,0.55)', 1.6);
  round(rc, p, a, false);
  glowDot(rc.g, p.x, p.y, 4, hot, 0.5);
}

function drawCannonball(rc: RC, p: Projectile, _a: number, emit?: Emit) {
  const sp = ROUNDS.cannonball!();
  stamp(rc.s, sp, p.x, p.y);
  if (emit && Math.random() < 0.5) emit('smoke', p.x, p.y, -p.vx * 0.1, -p.vy * 0.1);
}

function drawFireball(rc: RC, p: Projectile, a: number, emit?: Emit) {
  const g = rc.g;
  const col: HSL = { h: 8, s: 100, l: 55 };
  glowDot(g, p.x, p.y, 11, col, 0.6);
  flame(g, p.x - Math.cos(a) * 5, p.y - Math.sin(a) * 5, 3, 7, { h: 22, s: 100, l: 58 }, rc.t);
  round(rc, p, a);
  light(rc, p.x, p.y, 60, col, 0.9);
  if (emit && Math.random() < 0.6) emit('ember', p.x, p.y, -p.vx * 0.2 + (Math.random() - 0.5) * 30, -p.vy * 0.2 - 20, col);
}

function drawPlasma(rc: RC, p: Projectile) {
  const col: HSL = { h: 190, s: 100, l: 60 };
  glowDot(rc.g, p.x, p.y, 8, col, 0.65);
  stamp(rc.s, ROUNDS.plasma!(), p.x, p.y);
  light(rc, p.x, p.y, 45, col, 0.6);
}

function drawShuriken(rc: RC, p: Projectile) {
  round(rc, p, rc.t * 25, false);
}

function drawSeeker(rc: RC, p: Projectile, a: number, emit?: Emit) {
  const g = rc.g;
  const red: HSL = { h: 0, s: 100, l: 55 };
  flame(g, p.x - Math.cos(a) * 7, p.y - Math.sin(a) * 7, 1.6, 4, { h: 35, s: 100, l: 60 }, rc.t);
  round(rc, p, a);
  const up = Math.cos(a) < 0 ? 1 : -1;
  glowDot(g, p.x + Math.cos(a) * 5.4 + Math.sin(a) * up * 0.1, p.y + Math.sin(a) * 5.4, 5, red, 0.45 + Math.sin(rc.t * 20) * 0.2);
  light(rc, p.x, p.y, 40, red, 0.6);
  if (emit && Math.random() < 0.6) emit('smoke', p.x - Math.cos(a) * 7, p.y - Math.sin(a) * 7, -p.vx * 0.2, -p.vy * 0.2 - 10);
}

function boomerangShot(rc: RC, p: Projectile) {
  if (p.thrower < 0) return round(rc, p, rc.t * 22, false);
  // A thrown Stunnerang: the banana one, with stars circling it.
  stampRound(rc.s, stunnerang(), p.x, p.y, rc.t * 20, false);
  dazeStars(rc.g, p.x, p.y, rc.t * 1.6, 7, 4);
}

function drawRubber(rc: RC, p: Projectile) {
  // It rolls through the air as far as it has come: spin follows distance, not the clock.
  round(rc, p, (p.x + p.y * 0.3) / 4.5, false);
}

function drawCluster(rc: RC, p: Projectile, a: number) {
  const age = rc.frame - p.born;
  const blink = Math.floor(age / Math.max(2, 8 - (age / CLUSTER_FUSE) * 6)) % 2 === 0;
  // The bunch tumbles, and shakes harder as it's about to come apart.
  const shake = (age / CLUSTER_FUSE) * 0.35 * Math.sin(age * 1.7);
  round(rc, p, a * 0.25 + shake, false);
  if (blink) glowDot(rc.g, p.x, p.y - 1, 5, { h: 45, s: 100, l: 60 }, 0.8);
}

function drawShrapnel(rc: RC, p: Projectile) {
  glowDot(rc.g, p.x, p.y, 4, { h: 45, s: 100, l: 62 }, 0.5);
  round(rc, p, (rc.frame - p.born) * 0.5 + p.id, false);
}

function drawGoo(rc: RC, p: Projectile, a: number) {
  const st = 1 + Math.min(0.5, Math.hypot(p.vx, p.vy) / 600);
  const s = rc.s;
  s.save();
  s.translate(p.x, p.y);
  s.rotate(a);
  s.scale(st, 1 / st);
  stamp(s, ROUNDS.goo!());
  s.restore();
}

function drawFrost(rc: RC, p: Projectile, a: number, emit?: Emit) {
  const ice: HSL = { h: 195, s: 95, l: 72 };
  glowDot(rc.g, p.x, p.y, 6, ice, 0.35);
  round(rc, p, a, false);
  if (emit && Math.random() < 0.3) emit('spark', p.x, p.y, -p.vx * 0.1, -p.vy * 0.1, ice);
}

/** Where each trick shot has been, newest last: render-side memory, so the line follows its bounces. */
const trails = new Map<number, { pts: number[]; seen: number }>();

/** Trick shot: a glowing round that drags the dotted aim line of a replay behind it, round every bank. */
function drawRicochet(rc: RC, p: Projectile) {
  const g = rc.g;
  const col: HSL = { h: 300, s: 100, l: 65 };
  let tr = trails.get(p.id);
  if (!tr || tr.seen < rc.frame - 30 || p.born > tr.seen) {
    if (trails.size > 64) for (const [k, v] of trails) if (v.seen < rc.frame - 30) trails.delete(k);
    tr = { pts: [p.x, p.y], seen: rc.frame };
    trails.set(p.id, tr);
  }
  tr.seen = rc.frame;
  const n = tr.pts.length;
  if (Math.hypot(p.x - tr.pts[n - 2], p.y - tr.pts[n - 1]) > 3.5) {
    tr.pts.push(p.x, p.y);
    if (tr.pts.length > 28) tr.pts.splice(0, 2);
  }
  g.fillStyle = 'rgba(255,235,255,0.75)';
  const m = tr.pts.length / 2;
  for (let i = 0; i < m - 1; i++) circle(g, tr.pts[i * 2], tr.pts[i * 2 + 1], 0.35 + (0.6 * (i + 1)) / m);
  glowDot(g, p.x, p.y, 7, col, 0.9);
  g.fillStyle = '#fff';
  circle(g, p.x, p.y, 1.5);
  for (let i = 0; i < p.n; i++) {
    g.fillStyle = css(col, 20, 0.8);
    circle(g, p.x - 4 + i * 4, p.y - 6, 0.8);
  }
  light(rc, p.x, p.y, 40, col, 0.6);
}

function gliderShot(rc: RC, p: Projectile) {
  const age = rc.frame - p.born;
  // Tilt nose-down as it sinks; it shudders when it's about to go; riders bend the deck.
  const tilt = Math.max(-0.05, Math.min(0.3, p.vy / 250)) * Math.sign(p.vx || 1);
  drawGlider(rc.s, p.x, p.y, tilt, (p.owner * 70 + 30) % 360, rc.t, age > GLIDER_CRUISE, Math.min(4, p.n * 2.2), p.vx < 0 ? -1 : 1, p.id);
}

const AMMO_ART: Record<Ammo, (rc: RC, p: Projectile, angle: number, emit?: Emit) => void> = {
  bolt: drawBolt,
  arrow: drawBolt,
  cannonball: drawCannonball,
  fireball: drawFireball,
  plasma: drawPlasma,
  shuriken: drawShuriken,
  seeker: drawSeeker,
  boomerang: boomerangShot,
  rubber: drawRubber,
  cluster: drawCluster,
  shrapnel: drawShrapnel,
  goo: drawGoo,
  frost: drawFrost,
  ricochet: drawRicochet,
  glider: gliderShot,
  slug: drawSlug,
  puck: drawItemShot,
  smokebomb: drawItemShot,
};

export function drawProjectile(rc: RC, p: Projectile, emit?: Emit) {
  if (p.stuck >= 0) return drawPatch(rc, p);
  AMMO_ART[p.ammo](rc, p, Math.atan2(p.vy, p.vx), emit);
}

/**
 * Budget Airline: the rideable glider is a paper plane. The deck is exactly the GLIDER_W × GLIDER_H
 * solid, centered on x, y, folded paper with the nose cut back from its underside; the wing is a low
 * fold behind the rider with a seat number on it. `sag` px lifts the deck's tips: the middle stays where
 * the rider stands. `dir` is which way the nose points.
 */
export function drawGlider(s: CanvasRenderingContext2D, x: number, y: number, tilt: number, hue: number, t: number, tired = false, sag = 0, dir = 1, id = 0) {
  s.save();
  s.translate(x, y);
  s.rotate(tilt);
  if (tired) s.translate(0, Math.sin(t * 40) * 0.35);
  s.scale(dir, 1);
  const w = GLIDER_W / 2;
  const h = GLIDER_H / 2;
  const paper: HSL = { h: hue, s: 30, l: tired ? 80 : 90 };
  // Wing: a low fold rising toward the tail, behind the rider.
  const wing = poly(w - 1, -h - sag * 0.2, -w + 1, -h - 6.5 - sag, -w + 3.5, -h - sag);
  s.fillStyle = css(paper, -10, 1, 4);
  path(s, wing);
  s.fill();
  s.fillStyle = css(paper, -2);
  path(s, poly(w - 3, -h - sag * 0.2, -w + 1.5, -h - 5.6 - sag, -w + 4, -h - 1.4 - sag));
  s.fill();
  s.fillStyle = INK;
  stroke(s, poly(w - 1, -h - sag * 0.2, -w + 1, -h - 6.5 - sag, -w + 3.5, -h - sag), { w: 0.75, seed: 3, taper: [0.1, 0.1], press: 0.3 });
  // Seat row: the cheapest one, at the back.
  s.save();
  s.translate(-w + 8, -h - 3.1 - sag * 0.8);
  s.rotate(-0.2);
  if (dir < 0) s.scale(-1, 1);
  s.fillStyle = css({ h: hue, s: 60, l: 34 });
  s.font = 'bold 3.2px sans-serif';
  s.textAlign = 'center';
  s.textBaseline = 'middle';
  s.fillText(`${12 + (id % 30)}${'ABCDEF'[id % 6]}`, 0, 0);
  s.restore();
  // Deck: folded paper, crisp top where feet go, the nose cut away beneath.
  const deck = poly(-w, -h - sag, 0, -h, w, -h - sag, w - 4.5, h - sag * 0.5, 0, h, -w, h - sag);
  s.fillStyle = css(paper, -18, 1, 6);
  path(s, deck);
  s.fill();
  s.fillStyle = css(paper);
  path(s, poly(-w, -h - sag, 0, -h, w, -h - sag, w - 2.2, -h + 1.6 - sag * 0.6, 0, -h + 2.2, -w, -h + 2.2 - sag));
  s.fill();
  s.fillStyle = INK;
  stroke(s, poly(-w, -h - sag, 0, -h, w, -h - sag), { w: 0.7, seed: 6, taper: [0.05, 0.05], press: 0.2 });
  stroke(s, poly(w, -h - sag, w - 4.5, h - sag * 0.5, 0, h, -w, h - sag, -w, -h - sag), { w: 1.3, seed: 7, taper: [0.05, 0.05], press: 0.3 });
  s.fillStyle = css(paper, -30);
  line(s, -w + 1, -h + 2.3 - sag, w - 3, -h + 1.7 - sag * 0.6, { w: 0.45, seed: 8, taper: [0.2, 0.2], press: 0 });
  s.restore();
}

/** A goo/frost shot stuck to a terrain face: the coat the sim builds, fading out near the end. */
function drawPatch(rc: RC, p: Projectile) {
  const s = rc.s;
  const g = rc.g;
  const r = patchRect(p.hx, p.hy, p.stuck, PATCH_PX + 0.5);
  const left = p.until - rc.frame;
  const fade = Math.min(1, left / 40);
  const born = Math.min(1, (PATCH_FRAMES - left) / 6);
  const [dx, dy] = FACE[p.stuck];
  if (p.ammo === 'goo') {
    s.fillStyle = `rgba(80,170,40,${0.9 * fade})`;
    s.fillRect(r.x, r.y, r.w, r.h);
    s.fillStyle = `rgba(150,230,90,${0.6 * fade})`;
    for (let i = 0; i < 3; i++) {
      const u = (i + 0.5) / 3;
      const bx = dy !== 0 ? r.x + r.w * u : r.x + r.w / 2;
      const by = dx !== 0 ? r.y + r.h * u : r.y + r.h / 2;
      circle(s, bx, by, 1.6 * born);
    }
    if (dy >= 0) {
      // Drips hang off ceilings and walls.
      const k = (rc.t * 0.7 + p.id * 0.37) % 1;
      s.fillStyle = `rgba(80,170,40,${0.8 * fade})`;
      ellipse(s, r.x + r.w * 0.6, r.y + r.h + k * 3, 1, 1 + k * 2);
    }
  } else {
    s.fillStyle = `rgba(190,235,255,${0.85 * fade})`;
    s.fillRect(r.x, r.y, r.w, r.h);
    s.fillStyle = `rgba(255,255,255,${0.8 * fade})`;
    line(s, r.x + 1, r.y + r.h / 2, r.x + r.w - 1, r.y + r.h / 2, { w: 0.6, seed: p.id, taper: [0.2, 0.2], press: 0 });
    glowDot(g, r.x + r.w / 2, r.y + r.h / 2, TILE * 0.6, { h: 195, s: 90, l: 70 }, 0.18 * fade);
  }
}
