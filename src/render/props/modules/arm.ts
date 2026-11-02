import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { ARM_BACK, ARM_STRIKE, ARM_WARN, ARM_WELD, armCycle, armJoints, HEAD_R } from '../../../sim/props';
import { inkFor, line } from '../../ink';
import { ball, boxPts, ovalPts, part, poly, sprite, stamp, tick } from '../../ink-props';
import { bulb, glowDot, light } from '../../kit';
import { defineArt } from '../common';

/**
 * An assembly-line robot arm (sim/props/modules/arm.ts) on the pedestal its piece stands it on: a turntable
 * base drawn exactly over the pedestal's block, a painted upper arm and forearm from joint to joint where
 * the sim puts them, and a welding head with its torch, the circle that kills. Its lamp is a flat bulb: off
 * at rest, blinking amber through the warning, red while it strikes and welds. Sparks fly only while it
 * welds; they're the one hot thing about it. Paint is a calm machine orange: the runners stay the loudest
 * colour on screen.
 */

const PAINT: HSL = { h: 30, s: 62, l: 50 };
const JOINT: HSL = { h: 215, s: 8, l: 36 };
const BASE: HSL = { h: 215, s: 9, l: 30 };
const AMBER: HSL = { h: 40, s: 100, l: 58 };
const RED: HSL = { h: 4, s: 90, l: 54 };
const SPARK: HSL = { h: 46, s: 100, l: 68 };

/** The pedestal under the shoulder, baked: a plinth two tiles tall, a turntable on it, bolted down. Its outline is the block's. */
function pedestal(dir: 1 | -1) {
  return sprite(`arm|base|${dir}`, -TILE / 2 - 2, -2, TILE + 4, 2 * TILE + 4, (g) => {
    const w = TILE;
    part(g, boxPts(-w / 2, 3, w, 2 * TILE - 3, 1.2, 3, 0.08), BASE, 3, { depth: 1.2, thin: 0.5, thick: 1.2 });
    // A hazard band round its foot, a hatch on its face.
    g.fillStyle = css({ h: 46, s: 72, l: 50 });
    g.fillRect(-w / 2 + 1, 2 * TILE - 4.5, w - 2, 2.2);
    g.fillStyle = inkFor(BASE);
    for (let x = -w / 2 + 2; x < w / 2 - 1; x += 3.4) g.fillRect(x, 2 * TILE - 4.5, 1.2, 2.2);
    part(g, boxPts(-4 * dir - 2, 10, 6, 9, 0.6, 5, 0.1), { ...BASE, l: 36 }, 5, { depth: 0.4, thin: 0.3, thick: 0.6 });
    // The turntable the shoulder turns on.
    part(g, boxPts(-w / 2 + 1, 0, w - 2, 4, 1.4, 7, 0.1), JOINT, 7, { depth: 0.6, thin: 0.4, thick: 0.9 });
  });
}

/** One link of the arm, joint to joint: a tapered painted housing with a seam down it. */
function link(s: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, w0: number, w1: number, seed: number) {
  const L = Math.hypot(bx - ax, by - ay) || 1;
  const nx = -(by - ay) / L;
  const ny = (bx - ax) / L;
  const pts = poly(ax + nx * w0, ay + ny * w0, bx + nx * w1, by + ny * w1, bx - nx * w1, by - ny * w1, ax - nx * w0, ay - ny * w0);
  part(s, pts, PAINT, seed, { depth: 0.9, thin: 0.45, thick: 1.1 });
  tick(s, ax + (bx - ax) * 0.2, ay + (by - ay) * 0.2, ax + (bx - ax) * 0.8, ay + (by - ay) * 0.8, 0.4, seed + 1, css(PAINT, -14));
}

defineArt<'arm'>({
  type: 'arm',
  layer: 2,
  draw: (rc, m, d) => {
    const s = rc.s;
    const c = armCycle(m, rc.frame, d.r.phase);
    const j = armJoints(m, rc.frame, d.r.phase, d.off[0], d.off[1]);
    // In the warning it twitches on its turntable.
    const tw = c.seg === ARM_WARN ? Math.sin(rc.frame * 1.7) * 0.6 : 0;
    stamp(s, pedestal(m.dir), j.sx, j.sy);
    // The shoulder housing, the upper arm, the elbow, the forearm.
    part(s, ovalPts(j.sx, j.sy + 0.5, 6, 5, 11, 0.03, 14), PAINT, 11, { depth: 0.8, thin: 0.4, thick: 1 });
    link(s, j.sx, j.sy, j.ex + tw, j.ey, 4.2, 3.2, 21);
    ball(s, j.ex + tw, j.ey, 3.4, JOINT, 23, css(JOINT, 30), inkFor(JOINT));
    link(s, j.ex + tw, j.ey, j.hx + tw, j.hy, 3, 2.2, 31);
    ball(s, j.sx, j.sy, 3, JOINT, 25, css(JOINT, 30), inkFor(JOINT));
    // The welding head: a squat housing on the wrist, the torch's nozzle bent down out of it.
    const hx = j.hx + tw;
    const hy = j.hy;
    const r = HEAD_R * TILE;
    part(s, ovalPts(hx, hy, r * 0.95, r * 0.8, 41, 0.04, 14), JOINT, 41, { depth: 0.6, thin: 0.4, thick: 0.9 });
    s.fillStyle = inkFor(JOINT);
    line(s, hx + m.dir * r * 0.5, hy + r * 0.2, hx + m.dir * r * 1.05, hy + r * 1.1, { w: 2, seed: 43, taper: [0, 0], press: 0 });
    s.fillStyle = css({ h: 30, s: 30, l: 60 });
    line(s, hx + m.dir * r * 0.5, hy + r * 0.2, hx + m.dir * r * 1.05, hy + r * 1.1, { w: 1.1, seed: 44, taper: [0, 0], press: 0 });
    // The lamp on the shoulder: dark at rest, amber blinking in the warning, red while it's hot.
    const lx = j.sx - m.dir * 2.5;
    const ly = j.sy - 4.5;
    part(s, ovalPts(lx, ly, 1.9, 1.9, 51, 0.02, 10), BASE, 51, { depth: 0.3, thin: 0.3, thick: 0.6 });
    const hot = c.seg === ARM_STRIKE || c.seg === ARM_WELD;
    if (c.seg === ARM_WARN && Math.floor(c.t / 6) % 2 === 0) bulb(rc.g, lx, ly, 1.3, AMBER);
    else if (hot) bulb(rc.g, lx, ly, 1.3, RED);
    // Striking: the head's path behind it, a few quick marks.
    if (c.seg === ARM_STRIKE) {
      const p = armJoints(m, rc.frame - 3, d.r.phase, d.off[0], d.off[1]);
      for (let k = -1; k <= 1; k++) tick(s, p.hx + k * 2, p.hy - k * 2, hx + k * 1.4, hy - k * 1.4, 0.45, k + 60, css(PAINT, -20, 0.6));
    }
    // Welding: the arc at the nozzle's tip, and sparks spraying off it, hot.
    if (c.seg === ARM_WELD) {
      const tx = hx + m.dir * r * 1.1;
      const ty = hy + r * 1.2;
      glowDot(rc.g, tx, ty, 10, SPARK, 0.8);
      light(rc, tx, ty, 50, { h: 200, s: 60, l: 80 }, 0.7);
      for (let k = 0; k < 6; k++) {
        const u = (rc.frame * 0.07 + k / 6) % 1;
        const ang = -Math.PI / 2 + (k - 2.5) * 0.45 + m.dir * 0.4;
        const sx = tx + Math.cos(ang) * u * 14;
        const sy = ty + Math.sin(ang) * u * 14 + u * u * 10;
        tick(rc.g, sx, sy, sx - Math.cos(ang) * 2, sy - Math.sin(ang) * 2, 0.6, k, css(SPARK, 10, 1 - u));
      }
    }
    // Folding back: a little hiss of the hydraulics, nothing hot.
    if (c.seg === ARM_BACK && c.t < 10) glowDot(rc.g, hx + m.dir * r, hy + r, 6, SPARK, 0.4 * (1 - c.t / 10));
  },
});
