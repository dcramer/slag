import { css } from '../core/color';
import { clamp } from '../core/geom';
import type { CharacterDef } from '../gen/character';
import { CAST_ART } from './cast';
import {
  type Anchor,
  type D,
  type Feet,
  type GaitIn,
  IRON,
  inked,
  type KindArt,
  ORANGE,
  ORANGE_SH,
  outlinePts,
  type Part,
  ribbon,
  type Rope,
  STEEL,
  STEEL_SH,
} from './cast/kit';
import { drawSprite, type SpriteSet, spritesOf } from './cast/sprites';
import type { Rig } from './character';
import { line, type P, sn } from './ink';
import { arm, contour, eyes, hand, type InkTarget, type Look, lookOf, moodOf, mouth, path, type RunnerPose, STRIDE, toned, tonedOval } from './ink-figure';

/**
 * A runner, inked: one of the cast (docs/CHARACTERS.md), animals and critters. Players watch these more
 * than anything else, and in a race they're about 40 screen px tall, so the drawing is silhouette and
 * clean shapes: a light pen in a dark of the body's own color, one soft shadow shape, the player's color
 * as the loudest note, and eyes and a mouth that mean it.
 *
 * This is the frame every kind shares: squash, stretch and bend, the kind's own gait, arms, face, the
 * boil and the shadow. A kind's `KindArt` (`cast/kinds.ts`) fills in its outline and parts. Everything
 * distinct comes from the character's seed, so the same runner draws the same in the world, on a lobby
 * card, in a HUD chip and on the main menu. Purely cosmetic: all runners share one hitbox.
 */

export type { InkTarget, RunnerPose };

const artOf = (c: CharacterDef): KindArt => CAST_ART[c.kind];
const look = (c: CharacterDef, art: KindArt): Look => lookOf(c, art.fill !== 'paint');

/** The tail the renderer's rig should trail for this character, if any. */
export function ropeOf(c: CharacterDef): Rope | null {
  return artOf(c).rope ?? null;
}

/** Where the rig hangs this character's tail from, in world px from its feet, for its facing. */
export function ropeAnchor(c: CharacterDef, facing: number): Anchor {
  const art = artOf(c);
  return { x: -facing * 14 * art.size[0] * 0.42, y: -(art.lift + 15 * art.size[1] * 0.3) };
}

/** What this character bursts into when it dies. */
export function partsOf(c: CharacterDef): readonly Part[] {
  return artOf(c).parts;
}

const faces = new WeakMap<CharacterDef, CharacterDef>();

/** The character with its kind's face overrides on top of its rolled face. */
function faceOf(c: CharacterDef, art: KindArt): CharacterDef {
  let fc = faces.get(c);
  if (!fc) {
    const o = art.face?.(c);
    fc = o ? { ...c, eyes: { ...c.eyes, ...o.eyes }, mouth: o.mouth ?? c.mouth } : c;
    faces.set(c, fc);
  }
  return fc;
}

/** Each kind's outline (and its pose variants) at its size, facing right: authored once, sampled once. */
const shapes = new Map<string, P[]>();

function shapeOf(art: KindArt, pose: 'rest' | 'run' | 'air' = 'rest'): P[] {
  const spec = (pose !== 'rest' && art.poses?.[pose]) || art.outline;
  let pts = shapes.get(spec);
  if (!pts) {
    pts = outlinePts(spec, 14 * art.size[0], 15 * art.size[1]);
    shapes.set(spec, pts);
  }
  return pts;
}

const gaitIn: GaitIn = { m: 'idle', ph: 0, t: 0, vx: 0, vy: 0, grounded: true, moving: false, run: 0, seed: 0 };

/** Hands per material, so the per-frame draw builds no objects. */
const hands = new WeakMap<CharacterDef, Look>();

function handLook(c: CharacterDef, art: KindArt, lk: Look): Look {
  let h = hands.get(c);
  if (!h) {
    const m = art.hands ?? 'body';
    const [hd, sh] =
      m === 'glove'
        ? ['#f4efe6', '#cfc6b8']
        : m === 'leather'
          ? ['#a8794a', '#7d5634']
          : m === 'iron'
            ? [STEEL, STEEL_SH]
            : m === 'paint'
              ? [lk.paint, lk.paintShade]
              : [lk.fill, lk.fillShade];
    h = { ...lk, hand: hd, handShade: sh };
    hands.set(c, h);
  }
  return h;
}

const GLINT = '#fffaf0';
/** Screened over the lit rim at card scale: lifts every color under it by the same flat step. */
const RIM = 'rgb(52 46 38)';

/** A flat ring round the feet, as an even-odd pair of ellipses `w` wide outside and `t` thick. */
function ringPath(s: CanvasRenderingContext2D, rx: number, t: number, y: number) {
  s.beginPath();
  s.ellipse(0, y, rx, rx * 0.22 + t * 0.5, 0, 0, Math.PI * 2);
  s.ellipse(0, y, Math.max(0.1, rx - t), Math.max(0.1, rx * 0.22 - t * 0.3), 0, 0, Math.PI * 2);
}

const glassFills = new WeakMap<Look, string>();

/** The body's fill as glass: the same color at `a` opacity, so what's behind shows through. */
function glassOf(lk: Look, a: number): string {
  let g = glassFills.get(lk);
  if (!g) {
    g = lk.fill.replace(')', ` / ${a})`);
    glassFills.set(lk, g);
  }
  return g;
}

/** A flipper or a wing: a blade off the shoulder that flaps instead of reaching. */
function flipper(d: D, lk: Look, sx: number, sy: number, h: P, side: number) {
  const hx = sx + h.x * 0.8;
  const hy = sy + h.y * 0.8;
  const dx = hx - sx;
  const dy = hy - sy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * side;
  const ny = (dx / len) * side;
  toned(
    d.s,
    [
      { x: sx + nx * 1.4, y: sy + ny * 1.4 },
      { x: hx + dx * 0.2, y: hy + dy * 0.2 },
      { x: sx - nx * 1.2, y: sy - ny * 1.2 },
    ],
    lk.hand,
    lk.handShade,
    lk.ink,
    0.4,
    0.8 * d.k,
    0.5,
  );
}

function feet(d: D, kind: Feet) {
  const { s, lk, m, f, ph, p, W, k } = d;
  if (kind === 'none') return;
  for (const side of [-1, 1]) {
    let fx = side * W * 0.22;
    let fy = -1.6;
    const step = kind === 'paw' ? 1.6 : 1;
    if (m === 'walk' || m === 'run') {
      const sw = Math.sin(ph * step) * side;
      fx += f * sw * (m === 'run' ? 2.6 : 1.7);
      fy -= Math.max(0, Math.cos(ph * step) * side) * (m === 'run' ? 1.8 : 1.1);
    } else if (m === 'up' || m === 'wall') {
      fx = side * W * 0.16;
      fy = -2.6 + (side === f ? -0.6 : 0);
    } else if (m === 'fall') {
      fx = side * W * 0.3 + Math.sin(p.t * 25 + side) * 0.5;
      fy = -1;
    }
    if (kind === 'web' || kind === 'stilt') {
      // Thin legs down from the body, and orange feet: a bird's.
      s.fillStyle = kind === 'stilt' ? ORANGE_SH : lk.ink;
      line(s, side * W * 0.12, d.by + 0.5, fx, fy, { w: kind === 'stilt' ? 0.9 : 0.7, seed: side, taper: [0, 0], press: 0 });
      toned(
        s,
        [
          { x: fx - f * 0.6, y: fy - 0.8 },
          { x: fx + f * 2.8, y: fy + 0.6 },
          { x: fx + f * 1.8, y: fy + 1.2 },
          { x: fx - f * 1.2, y: fy + 1.1 },
        ],
        ORANGE,
        ORANGE_SH,
        lk.ink,
        0.35,
        0.6 * k,
        0.4,
      );
    } else if (kind === 'paw') {
      tonedOval(s, fx + f * 0.6, fy + 0.2, 1.8, 1.2, 9, lk.fillShade, lk.ink, lk.ink, 0.3, 0.6 * k, 0.4);
    } else if (kind === 'boot' || kind === 'sneaker') {
      if (kind === 'sneaker') {
        // A thin leg down to a sneaker with a white strap, the speedster's.
        s.fillStyle = lk.ink;
        line(s, side * W * 0.1, d.by + 0.5, fx, fy - 0.8, { w: 1.5, seed: side, taper: [0, 0], press: 0 });
        s.fillStyle = lk.fill;
        line(s, side * W * 0.1, d.by + 0.5, fx, fy - 0.8, { w: 0.8, seed: side, taper: [0, 0], press: 0 });
      }
      tonedOval(s, fx + f * 0.8, fy, 2.6, 1.7, 10, d.boot[0], d.boot[1], lk.ink, 0.4, 0.7 * k, 0.5);
      if (kind === 'sneaker') {
        s.fillStyle = '#fbf6ee';
        line(s, fx + f * 0.4, fy - 1.4, fx + f * 0.9, fy + 1.4, { w: 0.9, seed: side, taper: [0, 0], press: 0 });
      }
    } else {
      // peg: a stub leg and a flat steel foot, a robot's.
      s.fillStyle = lk.ink;
      line(s, fx, fy - 2.4, fx, fy, { w: 1.6 * k, seed: side, taper: [0, 0], press: 0 });
      inked(
        s,
        [
          { x: fx - 1.6, y: fy - 0.5 },
          { x: fx + f * 2.6, y: fy - 0.6 },
          { x: fx + f * 2.6, y: fy + 1.1 },
          { x: fx - 1.6, y: fy + 1.1 },
        ],
        IRON,
        lk.ink,
        0.4,
        0.7 * k,
      );
    }
  }
}

/** The player's ring round the feet, for a kind in its own palette. */
function ring(s: CanvasRenderingContext2D, lk: Look, W: number) {
  s.fillStyle = lk.ink;
  ringPath(s, W * 0.56 + 0.7, 2.2, -0.6);
  s.fill('evenodd');
  s.fillStyle = lk.player;
  ringPath(s, W * 0.56, 1.6, -0.6);
  s.fill('evenodd');
}

/**
 * A kind rendered from its 3D model (`cast/sprites`): the same ring and the same squash and stretch about
 * the feet as the hand-drawn body, with the model's own clip for the pose. False while its sheet loads.
 */
function drawSpriteRunner(rc: InkTarget, c: CharacterDef, art: KindArt, lk: Look, set: SpriteSet, x: number, y: number, p: RunnerPose, sx: number, sy: number) {
  const s = rc.s;
  const sc = p.scale ?? 1;
  s.save();
  s.translate(x, y);
  s.scale(sc, sc);
  if (art.ring) ring(s, lk, 14 * art.size[0]);
  s.scale(sx, sy);
  const ok = drawSprite(s, set, c, p, x / sc);
  s.restore();
  return ok;
}

/** Draw a runner with feet centered at (x, y). */
export function drawInkRunner(rc: InkTarget, c: CharacterDef, x: number, y: number, p: RunnerPose) {
  const s = rc.s;
  const art = artOf(c);
  const lk = look(c, art);
  const fc = faceOf(c, art);
  const W = 14 * art.size[0];
  const H = 15 * art.size[1];
  const f = p.facing < 0 ? -1 : 1;
  const m = moodOf(p);
  const sc = p.scale ?? 1;
  const k = lk.weight;
  const ph = x / (STRIDE * sc);
  const moving = m === 'walk' || m === 'run';
  let sx = 1;
  let sy = 1;
  if (!p.grounded) {
    const q = clamp(-p.vy / 900, -0.2, 0.25);
    sy = 1 + q;
    sx = 1 - q * 0.6;
  } else if (m === 'run') {
    sy = 0.96 + Math.abs(Math.cos(ph)) * 0.04;
    sx = 1.04;
  } else {
    const b = Math.sin(p.t * (3.2 + lk.fidget * 2) + c.seed) * 0.03;
    sy = 1 + b;
    sx = 1 - b;
  }
  const sprite = spritesOf(c);
  if (sprite && drawSpriteRunner(rc, c, art, lk, sprite, x, y, p, sx, sy)) return;
  // The kind's own way of moving: a hop, a rock, a spin, a waddle, on top of the shared squash.
  gaitIn.m = m;
  gaitIn.ph = ph;
  gaitIn.t = p.t;
  gaitIn.vx = p.vx;
  gaitIn.vy = p.vy;
  gaitIn.grounded = p.grounded;
  gaitIn.moving = moving && p.grounded;
  gaitIn.run = clamp((Math.abs(p.vx) - 100) / 160, 0, 1);
  gaitIn.seed = c.seed;
  const g = art.gait(gaitIn);
  sx *= g.sx ?? 1;
  sy *= g.sy ?? 1;
  const hop = ((p.celebrate ? Math.abs(Math.sin(p.t * 9)) * 5 : 0) + (g.hop ?? 0)) * sc;
  const lean =
    (m === 'run'
      ? clamp(p.vx / 215, -1, 1) * 0.2
      : p.grounded
        ? clamp(p.vx / 140, -1, 1) * 0.08
        : m === 'wall'
          ? -(p.wall ?? 0) * 0.1
          : clamp(p.vx / 200, -1, 1) * 0.12) * (g.upright ?? 1);
  const by = -art.lift;
  const top = by - H;
  // The body bends toward where it goes instead of tipping over as a box: its top carries furthest.
  const bend = (lean * 0.9 + (g.bend ?? 0) * f) * H;
  // A squash on landing bulges the bottom of the outline more than the top.
  const bulge = sy < 1 ? (1 - sy) * 1.4 : 0;
  const pivot = by - H * (g.pivot ?? 0);
  s.save();
  s.translate(x, y - hop);
  s.scale(sc, sc);
  s.translate(0, pivot);
  s.rotate((g.rot ?? 0) * f);
  s.translate(0, -pivot);
  s.scale(sx, sy);

  const wob = Math.sin(p.t * 6) * 1.1 - clamp(p.vx / 110, -2, 2) - clamp(p.vy / 300, -1, 1) * 0.5;
  const sd = c.seed & 0xffff;
  const bx = (u: number) => bend * u * u;
  const d: D = {
    s,
    g: rc.g,
    c: fc,
    lk,
    W,
    H,
    by,
    top,
    f,
    m,
    p,
    t: p.t,
    wob,
    k,
    v: c.vary,
    ph,
    wx: x,
    wy: y - hop,
    sc,
    sd,
    bx,
    gait: g,
    boot: art.boots ?? [lk.paint, lk.paintShade],
    detail: sc >= 2,
    pose: m === 'run' && p.grounded ? 'run' : p.grounded ? 'rest' : 'air',
  };
  const shoulderY = by - H * 0.42;
  const shoulderX = W * 0.42;
  const L = lk.arm;
  const wall = p.wall ?? 0;
  const backSide = -f;
  const hl = art.arms !== 'none' ? handLook(c, art, lk) : lk;

  if (art.arms === 'mitten') arm(s, hl, backSide * shoulderX + bx(0.58), shoulderY, hand(m, backSide, f, ph, p.t, L, wall), backSide, k);
  else if (art.arms === 'flipper') flipper(d, hl, backSide * shoulderX + bx(0.58), shoulderY, hand(m, backSide, f, ph, p.t, L, wall), backSide);
  // The player's color on a homage in its own palette: a flat ring round its feet, no glow.
  if (art.ring) ring(s, lk, W);
  feet(d, art.feet);
  art.back?.(d);

  // A slow boil on threes: the drawing is alive even when the character stands still.
  const boil = Math.floor(p.t * 8) % 3;
  const src = shapeOf(art, d.pose);
  const pts: P[] = new Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const q = src[i];
    const u = -q.y / H;
    pts[i] = {
      x: q.x * f * (1 + bulge * Math.max(0, 1 - u)) + bend * u * u + sn(i * 0.45, boil * 3.1, sd) * 0.2,
      y: q.y + by + sn(i * 0.45 + 9, boil * 3.1, sd) * 0.2,
    };
  }
  contour(s, pts, art.glass ? glassOf(lk, art.glass) : lk.fill, lk.ink, k, sd, !!art.glass);
  s.save();
  path(s, pts);
  s.clip();
  art.print?.(d);
  // One hard shadow shape: the body less itself pulled up-left, a crescent below and right. It goes on
  // after the print and multiplies, so a band or panel sits in the same light as the body.
  path(s, pts);
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i];
    if (i) s.lineTo(q.x - W * 0.16, q.y - H * 0.13);
    else s.moveTo(q.x - W * 0.16, q.y - H * 0.13);
  }
  s.closePath();
  s.globalCompositeOperation = 'multiply';
  s.fillStyle = lk.shadow;
  s.fill('evenodd');
  if (d.detail) {
    // At card and menu scale a third tone: a rim of light up the lit side, screened over whatever's
    // painted there, flat. At play scale it would be noise.
    path(s, pts);
    for (let i = 0; i < pts.length; i++) {
      const q = pts[i];
      if (i) s.lineTo(q.x + W * 0.07, q.y + H * 0.06);
      else s.moveTo(q.x + W * 0.07, q.y + H * 0.06);
    }
    s.closePath();
    s.globalCompositeOperation = 'screen';
    s.fillStyle = RIM;
    s.fill('evenodd');
  }
  s.globalCompositeOperation = 'source-over';
  if (art.shine) {
    // One hard glint where shiny metal or a wet skin catches the light; fur and feathers get none.
    s.fillStyle = GLINT;
    line(s, -W * 0.26 + bx(0.7), by - H * 0.66, -W * 0.14 + bx(0.8), by - H * 0.78, { w: 1.1, seed: sd, taper: [0.3, 0.4], press: 0.1 });
  }
  art.over?.(d);
  s.restore();

  art.front?.(d);
  s.save();
  // The face rides the body's lean toward where it's going.
  s.translate(f * W * (art.faceX ?? 0) + bx(0.7), 0);
  if (art.paintFace) art.paintFace(d);
  else {
    eyes(s, fc, lk, W, H, by, p, m);
    mouth(s, fc, lk, W, H, by, p, m);
  }
  art.snout?.(d);
  s.restore();

  const fh = hand(m, f, f, ph, p.t, L, wall);
  if (art.arms === 'mitten') {
    // A tool rides in the front hand, under the mitten.
    art.tool?.(d, f * shoulderX + bx(0.58) + fh.x, shoulderY + fh.y);
    arm(s, hl, f * shoulderX + bx(0.58), shoulderY, fh, f, k);
  } else if (art.arms === 'flipper') flipper(d, hl, f * shoulderX + bx(0.58), shoulderY, fh, f);
  s.restore();
}

/**
 * The tail, in world space behind the body: a bushy one in the body's color with a pale tip, or a ringed
 * one banded in the body's dark.
 */
export function drawInkAccessory(s: CanvasRenderingContext2D, c: CharacterDef, rig: Rig) {
  const art = artOf(c);
  const rope = art.rope;
  if (!rope || rig.rope.length < 2) return;
  const lk = look(c, art);
  const pts = rig.rope;
  const n = pts.length;
  if (rope.kind === 'tail') {
    ribbon(s, pts, 2.4, 4.6, lk.fill, lk.fillShade, lk.ink);
    ribbon(s, pts.slice(n - 3), 4.2, 2.2, lk.paint, lk.paintShade, lk.ink);
    return;
  }
  ribbon(s, pts, 2.8, 2.2, lk.fill, lk.fillShade, lk.ink);
  for (let i = 1; i < n; i += 2) tonedOval(s, pts[i].x, pts[i].y, 1.3, 1.3, 8, lk.playerDark, lk.ink, lk.ink, 0.1, 0.2, 0.2);
}

/** A flat ghost of the body for the fast-motion trail, on the background layer. */
export function drawInkAfterimage(s: CanvasRenderingContext2D, c: CharacterDef, x: number, y: number, alpha: number) {
  const art = artOf(c);
  s.save();
  s.translate(x, y - art.lift);
  s.globalAlpha = alpha;
  s.fillStyle = css(art.fill === 'paint' ? c.paint : c.body);
  path(s, shapeOf(art));
  s.fill();
  s.restore();
}
