import { css, type HSL } from '../../../core/color';
import type { ModuleOf } from '../../../sim/props';
import { motionOffset } from '../../../sim/props/transform';
import { inkFor, line } from '../../ink';
import { ball, barLine, boxPts, ovalPts, part, path, pen, sprite, stamp, tone } from '../../ink-props';
import { glowDot, light, type RC } from '../../kit';
import { BACKDROP, type DrawCtx, defineArt } from '../common';
import { ceilingAbovePx } from './setpiece';

/**
 * A lift's cab (deco kind `cab`), riding with its floor: the manor's dumbwaiter. Behind the terrain, the
 * hoist cable up to its sheave under the ceiling and the cage's back screen; in front, a thin open cage
 * (you stand on the floor, never on the cage) with a service bell on top that rings before every move
 * and a lamp that's lit while it travels.
 */

type Deco = ModuleOf<'deco'>;

const IRON: HSL = { h: 220, s: 8, l: 26 };
const BRASS: HSL = { h: 42, s: 62, l: 50 };
const LAMP: HSL = { h: 38, s: 100, l: 60 };

/** Frames of warning the bell gives before the cab moves off. */
const BELL = 42;

/** Parked now, and leaving within the bell's warning? Moving now? Read off the sim's own motion. */
function phase(rc: RC, d: DrawCtx): { ring: number; moving: boolean } {
  const now = motionOffset(d.r, rc.frame);
  const moving = motionOffset(d.r, rc.frame - 1)[1] !== now[1];
  if (moving) return { ring: 0, moving };
  for (let k = 3; k <= BELL; k += 3) if (motionOffset(d.r, rc.frame + k)[1] !== now[1]) return { ring: 1 - k / BELL, moving };
  return { ring: 0, moving };
}

/** The cage's back screen: a lattice of thin iron, hazed back. Baked per size. */
function screen(w: number, h: number) {
  return sprite(`cab|screen|${w}|${h}`, 0, 0, w, h, (g) => {
    // The shaft behind it, a deep dark of the iron, and a few bars, lifting where the hand did.
    g.fillStyle = css(IRON, -12);
    g.fillRect(2, 2, w - 4, h - 2);
    g.fillStyle = css(IRON, 10);
    for (let x = 6; x < w - 3; x += 7) line(g, x, 3 + (x % 3), x + 0.2, h - (x % 4), { w: 0.6, seed: x, taper: [0.06, 0.12], press: 0.2 });
    line(g, 2, h * 0.45, w - 2, h * 0.45 + 0.3, { w: 0.7, seed: 3, taper: [0.04, 0.08], press: 0.2 });
  });
}

function back(rc: RC, m: Deco, d: DrawCtx) {
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  stamp(rc.s, screen(m.w, m.h), x, y);
  // The hoist cable to its sheave under whatever's above the shaft.
  const cx = x + m.w / 2;
  const top = Math.max(0, ceilingAbovePx(d.o.level, cx, m.at[1] + 1));
  barLine(rc.s, cx, top + 5, cx, y + 1, 0.7, { ...IRON, l: IRON.l + 14 }, 4);
  const wheel = ovalPts(cx, top + 5, 4.5, 4.5, 7, 0.03, 16);
  part(rc.s, wheel, IRON, 7, { depth: 0.6, thin: 0.3, thick: 0.8 });
}

/** The cage's front: corner posts, a crown rail, a little gate, all thin. Baked per size. */
function cage(w: number, h: number) {
  return sprite(`cab|cage|${w}|${h}`, -3, -9, w + 6, h + 10, (g) => {
    for (const px of [1, w - 1]) barLine(g, px, -1, px, h, 1.1, { ...IRON, l: IRON.l + 10 }, px, { lit: 12 });
    const crown = boxPts(-1.5, -3, w + 3, 3.2, 0.6, 2, 0.1);
    part(g, crown, IRON, 2, { depth: 0.5, thin: 0.3, thick: 0.8 });
    // Scrollwork across the crown, and a brass plate.
    g.fillStyle = css(BRASS);
    path(g, ovalPts(w / 2, -1.4, 3.4, 1.1, 3, 0.05, 12));
    g.fill();
    g.fillStyle = css(IRON, 18, 0.9);
    for (let x = 4; x < w - 3; x += 4) line(g, x, h - 4, x + 2, h - 8, { w: 0.5, seed: x, taper: [0.2, 0.2], press: 0 });
  });
}

/** The service bell on the crown: still when parked, swinging and ringing before it moves off. */
function bell(rc: RC, x: number, y: number, ring: number) {
  const a = ring ? Math.sin(rc.frame * 0.9) * 0.45 * Math.min(1, ring * 2 + 0.3) : 0;
  const s = rc.s;
  s.save();
  s.translate(x, y - 3);
  s.rotate(a);
  const dome = [
    { x: -3.2, y: 0 },
    { x: -2.6, y: -3 },
    { x: -1, y: -4.4 },
    { x: 1, y: -4.4 },
    { x: 2.6, y: -3 },
    { x: 3.2, y: 0 },
  ];
  tone(s, dome, BRASS, { depth: 0.5 });
  pen(s, dome, 11, 0.3, 0.8, 2, inkFor(BRASS));
  ball(s, 0, -5, 0.9, BRASS, 12);
  s.restore();
  if (!ring) return;
  // The ring: short strokes either side, and a warm flash.
  s.fillStyle = css(BRASS, 20);
  const r = 5 + (rc.frame % 10) * 0.35;
  for (const k of [-1, 1]) {
    line(s, x + k * r, y - 7, x + k * (r + 2.5), y - 9, { w: 0.6, seed: 13, taper: [0.3, 0.3], press: 0 });
    line(s, x + k * r, y - 4, x + k * (r + 3), y - 4, { w: 0.6, seed: 14, taper: [0.3, 0.3], press: 0 });
  }
  glowDot(rc.g, x, y - 5, 9, BRASS, 0.5 * ring + 0.2);
}

function front(rc: RC, m: Deco, d: DrawCtx) {
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const { ring, moving } = phase(rc, d);
  stamp(rc.s, cage(m.w, m.h), x, y);
  // The lamp on the crown: lit while it travels.
  const lx = x + 4;
  part(rc.s, boxPts(lx - 1.6, y - 6, 3.2, 3, 0.4, 5), IRON, 5, { depth: 0.2, thin: 0.3, thick: 0.6 });
  ball(rc.s, lx, y - 7, 1.5, moving ? LAMP : { h: 30, s: 40, l: 26 }, 6);
  if (moving) {
    glowDot(rc.g, lx, y - 7, 8, LAMP, 0.9);
    light(rc, lx, y - 7, 40, LAMP, 0.6);
  }
  bell(rc, x + m.w - 6, y - 3, ring);
}

defineArt<'deco'>({ type: 'deco', layer: BACKDROP, draw: (rc, m, d) => m.kind === 'cab' && back(rc, m, d) });
defineArt<'deco'>({ type: 'deco', layer: 2, draw: (rc, m, d) => m.kind === 'cab' && front(rc, m, d) });
