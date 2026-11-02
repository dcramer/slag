import { css } from '../core/color';
import { clamp } from '../core/geom';
import type { CharacterDef } from '../gen/character';
import type { Rig } from './character';
import { line, type P, sn, stroke } from './ink';
import { arm, contour, eyes, hand, type InkTarget, type Look, lookOf, moodOf, mouth, path, type RunnerPose, STRIDE, toned, tonedOval } from './ink-figure';
import { TOY_ART } from './toys';
import { type D, type Feet, IRON, IRON_SH, inked, ORANGE, ORANGE_SH, type Part, ribbon, TIN, TIN_SH, type ToyArt, wheel } from './toys/kit';

/**
 * A runner, inked: a toy out of the foundry's moulds (docs/CHARACTERS.md). Players watch these more than
 * anything else, and in a race they're about 40 screen px tall, so the drawing is all silhouette and big
 * shapes: one heavy ink mass, one hard shadow shape, the toy's own materials, the player's color painted
 * on big, mitten arms that act out what the body is doing, and eyes and a mouth that mean it.
 *
 * This is the frame every kind shares: squash and stretch, lean, stride, waddle, arms, face, the boil
 * and the shadow. A kind's `ToyArt` (`toys/`) fills in its shape and parts. Everything distinct comes
 * from the character's seed, so the same runner draws the same in the world, on a lobby card, in a HUD
 * chip and on the main menu. Purely cosmetic: all runners share one hitbox.
 */

export type { InkTarget, RunnerPose };

const artOf = (c: CharacterDef): ToyArt => TOY_ART[c.toy];

/** The ribbon the renderer's rig should trail for this character, if any. */
export function ropeOf(c: CharacterDef): { kind: 'string' | 'scarf'; len: number } | null {
  return artOf(c).rope ?? null;
}

/** What this character bursts into when it dies. */
export function partsOf(c: CharacterDef): readonly Part[] {
  return artOf(c).parts;
}

const faces = new WeakMap<CharacterDef, CharacterDef>();

/** The character with its kind's face overrides on top of its rolled face. */
function faceOf(c: CharacterDef, art: ToyArt): CharacterDef {
  let fc = faces.get(c);
  if (!fc) {
    const o = art.face?.(c);
    fc = o ? { ...c, eyes: { ...c.eyes, ...o.eyes }, mouth: o.mouth ?? c.mouth } : c;
    faces.set(c, fc);
  }
  return fc;
}

const shapes = new WeakMap<CharacterDef, P[]>();

function shapeOf(c: CharacterDef, art: ToyArt): P[] {
  let pts = shapes.get(c);
  if (!pts) {
    pts = art.shape(14 * art.size[0], 15 * art.size[1], c.vary);
    shapes.set(c, pts);
  }
  return pts;
}

/** Hands per material, so the per-frame draw builds no objects. */
const hands = new WeakMap<CharacterDef, Look>();

function handLook(c: CharacterDef, art: ToyArt, lk: Look): Look {
  let h = hands.get(c);
  if (!h) {
    const m = art.hands ?? 'tin';
    h = { ...lk, hand: m === 'iron' ? IRON : m === 'paint' ? lk.paint : TIN, handShade: m === 'iron' ? IRON_SH : m === 'paint' ? lk.paintShade : TIN_SH };
    hands.set(c, h);
  }
  return h;
}

const BY: Record<Feet, number> = { peg: -3.2, web: -2.8, wheels: -4.9, spring: -6, none: -2.3 };

function feet(d: D, kind: Feet, sx: number) {
  const { s, lk, m, f, ph, p, W, k } = d;
  if (kind === 'none') return;
  if (kind === 'spring') {
    // A coil from the floor to the body: it bounces along on it.
    const lift = -d.by;
    const pts: P[] = [];
    for (let i = 0; i <= 8; i++) pts.push({ x: (i % 2 ? 2.2 : -2.2) * (0.6 + 0.4 * sx), y: -(i / 8) * lift });
    s.fillStyle = lk.ink;
    stroke(s, pts, { w: 1.6 * k, seed: 3, taper: [0, 0], press: 0 });
    s.fillStyle = '#c9c1b4';
    stroke(s, pts, { w: 0.7, seed: 3, taper: [0, 0], press: 0 });
    tonedOval(s, 0, -1.4, 3, 1, 8, IRON, IRON_SH, lk.ink, 0.5, 0.9 * k, 0.4);
    return;
  }
  if (kind === 'wheels') {
    // A chassis bar and two wheels turning with the distance travelled.
    s.fillStyle = lk.ink;
    line(s, -W * 0.4, d.by + 0.4, W * 0.4, d.by + 0.4, { w: 2 * k, seed: 2, taper: [0, 0], press: 0 });
    for (const side of [-1, 1]) wheel(d, side * W * 0.3, -2.8, 2.2);
    return;
  }
  for (const side of [-1, 1]) {
    let fx = side * W * 0.24;
    let fy = -2.2;
    if (m === 'walk' || m === 'run') {
      const sw = Math.sin(ph) * side;
      fx += f * sw * (m === 'run' ? 2.8 : 1.8);
      fy -= Math.max(0, Math.cos(ph) * side) * (m === 'run' ? 2 : 1.2);
    } else if (m === 'up' || m === 'wall') {
      fx = side * W * 0.17;
      fy = -3.2 + (side === f ? -0.8 : 0);
    } else if (m === 'fall') {
      fx = side * W * 0.33 + Math.sin(p.t * 25 + side) * 0.6;
      fy = -1.2;
    }
    if (kind === 'web')
      toned(
        s,
        [
          { x: fx - f * 0.6, y: fy - 1.4 },
          { x: fx + f * 3.4, y: fy + 0.9 },
          { x: fx + f * 2.2, y: fy + 1.6 },
          { x: fx + f * 0.8, y: fy + 1 },
          { x: fx - f * 1.4, y: fy + 1.5 },
        ],
        ORANGE,
        ORANGE_SH,
        lk.ink,
        0.5,
        0.9 * k,
        0.5,
      );
    else {
      // peg: a cast stub leg and a flat iron foot, the way a tin toy stands.
      s.fillStyle = lk.ink;
      line(s, fx, fy - 2.4, fx, fy, { w: 2.2 * k, seed: side, taper: [0, 0], press: 0 });
      inked(
        s,
        [
          { x: fx - 1.8, y: fy - 0.6 },
          { x: fx + f * 3, y: fy - 0.7 },
          { x: fx + f * 3, y: fy + 1.2 },
          { x: fx - 1.8, y: fy + 1.2 },
        ],
        IRON,
        lk.ink,
        0.5,
        0.9 * k,
      );
    }
  }
}

/** Draw a runner with feet centered at (x, y). */
export function drawInkRunner(rc: InkTarget, c: CharacterDef, x: number, y: number, p: RunnerPose) {
  const s = rc.s;
  const art = artOf(c);
  const lk = lookOf(c);
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
  const boing = art.hop && moving ? Math.abs(Math.sin(ph)) * (m === 'run' ? 2.2 : 1.4) : 0;
  const hop = ((p.celebrate ? Math.abs(Math.sin(p.t * 9)) * 5 : 0) + boing) * sc;
  // A wind-up waddles side to side with its stride; a top precesses all the time.
  const waddle = art.waddle && moving && p.grounded ? Math.sin(ph) * 0.08 : 0;
  const spin = art.spin ? Math.sin(p.t * 7 + c.seed) * 0.06 : 0;
  const lean =
    waddle +
    spin +
    (m === 'run'
      ? clamp(p.vx / 215, -1, 1) * 0.2
      : p.grounded
        ? clamp(p.vx / 140, -1, 1) * 0.08
        : m === 'wall'
          ? -(p.wall ?? 0) * 0.1
          : clamp(p.vx / 200, -1, 1) * 0.12);
  s.save();
  s.translate(x, y - hop);
  s.scale(sx * sc, sy * sc);
  s.rotate(lean);

  const by = art.lift !== undefined ? -art.lift : BY[art.feet];
  const top = by - H;
  const wob = Math.sin(p.t * 6) * 1.1 - clamp(p.vx / 110, -2, 2) - clamp(p.vy / 300, -1, 1) * 0.5;
  const sd = c.seed & 0xffff;
  const d: D = { s, g: rc.g, c: fc, lk, W, H, by, top, f, m, p, t: p.t, wob, k, v: c.vary, ph, wx: x, wy: y - hop, sc, sd };
  const shoulderY = by - H * 0.38;
  const shoulderX = W * 0.46;
  const L = lk.arm;
  const wall = p.wall ?? 0;
  const backSide = -f;
  const hl = art.arms === 'mitten' ? handLook(c, art, lk) : lk;

  if (art.arms === 'mitten') arm(s, hl, backSide * shoulderX, shoulderY, hand(m, backSide, f, ph, p.t, L, wall), backSide, k);
  feet(d, art.feet, sx);
  art.back?.(d);

  // A slow boil on threes: the drawing is alive even when the toy stands still.
  const boil = Math.floor(p.t * 8) % 3;
  const src = shapeOf(c, art);
  const pts: P[] = new Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const q = src[i];
    const u = -q.y / H;
    pts[i] = { x: q.x + f * lk.skew * u + sn(i * 0.45, boil * 3.1, sd) * 0.2, y: q.y + by + sn(i * 0.45 + 9, boil * 3.1, sd) * 0.2 };
  }
  contour(s, pts, lk.paint, lk.ink, k, sd);
  s.save();
  path(s, pts);
  s.clip();
  s.save();
  s.translate(f * lk.skew * 0.4, 0);
  art.print?.(d);
  s.restore();
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
  s.globalCompositeOperation = 'source-over';
  s.fillStyle = lk.paintHi;
  line(s, -W * 0.36 + f * lk.skew * 0.7, by - H * 0.72, -W * 0.14 + f * lk.skew * 0.85, by - H * 0.88, { w: 1.6, seed: sd, taper: [0.22, 0.45], press: 0.1 });
  art.over?.(d);
  s.restore();

  art.front?.(d);
  s.save();
  // The face rides the body's lean toward where it's going.
  s.translate(f * (lk.skew * 0.55 + W * (art.faceX ?? 0)), 0);
  eyes(rc, s, fc, lk, W, H, by, p, m, x, y - hop, sc);
  mouth(s, fc, lk, W, H, by, p, m);
  art.snout?.(d);
  s.restore();

  if (art.arms === 'mitten') arm(s, hl, f * shoulderX, shoulderY, hand(m, f, f, ph, p.t, L, wall), f, k);
  s.restore();
}

/**
 * The trailing ribbon, in world space behind the body: a pull string with a wooden bead on the end, or
 * a long knitted scarf in the player's color.
 */
export function drawInkAccessory(s: CanvasRenderingContext2D, c: CharacterDef, rig: Rig) {
  const rope = ropeOf(c);
  if (!rope || rig.rope.length < 2) return;
  const lk = lookOf(c);
  const pts = rig.rope;
  if (rope.kind === 'scarf') {
    ribbon(s, pts, 2.6, 2.2, lk.player, lk.playerShade, lk.ink);
    for (let i = 2; i < pts.length; i += 2) {
      s.fillStyle = lk.playerHi;
      line(s, pts[i].x - 0.8, pts[i].y - 0.8, pts[i].x + 0.8, pts[i].y + 0.8, { w: 0.8, seed: i, taper: [0, 0], press: 0 });
    }
    return;
  }
  s.fillStyle = lk.ink;
  stroke(s, pts, { w: 1, seed: 7, taper: [0, 0], press: 0 });
  const end = pts[pts.length - 1];
  tonedOval(s, end.x, end.y, 1.5, 1.5, 8, lk.player, lk.playerShade, lk.ink, 0.5, 0.9, 0.5);
}

/** A flat ghost of the body for the fast-motion trail, on the background layer. */
export function drawInkAfterimage(s: CanvasRenderingContext2D, c: CharacterDef, x: number, y: number, alpha: number) {
  const art = artOf(c);
  const pts = shapeOf(c, art);
  const by = art.lift !== undefined ? -art.lift : BY[art.feet];
  s.save();
  s.translate(x, y + by);
  s.globalAlpha = alpha;
  s.fillStyle = css(c.body);
  path(s, pts);
  s.fill();
  s.restore();
}
