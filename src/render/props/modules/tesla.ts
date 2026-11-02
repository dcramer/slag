import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { type Module, type ModuleOf, type PropStyle, type Resolved, teslaCycle } from '../../../sim/props';
import { blob, inkFor, line, stroke } from '../../ink';
import { ball, bar, boxPts, dot, glint, ovalPts, part, path, poly, sprite, stamp, tick } from '../../ink-props';
import { glowDot, light, lightning, type MetalPalette, type RC } from '../../kit';
import { beamOf, defineArt, type PropDrawOpts } from '../common';
import { housed, iron } from '../machine';

type M<T extends Module['type']> = ModuleOf<T>;

const CERAMIC: HSL = { h: 34, s: 22, l: 86 };
const COPPER: HSL = { h: 24, s: 58, l: 52 };
const MOTH: HSL = { h: 28, s: 16, l: 30 };
const HAZARD: HSL = { h: 48, s: 88, l: 58 };

/** The cage's frame in local px: a housed zapper fills its cell, a set piece's pylon is narrower. */
interface Cage {
  /** Half the cage's width. */
  hw: number;
  /** Where the tubes stand, x. */
  tubes: readonly number[];
}

const WIDE: Cage = { hw: 6.3, tubes: [-2.5, 2.5] };
const SLIM: Cage = { hw: 4.4, tubes: [0] };
const TOP = -4.8;
const BOT = 4.4;

/**
 * The back of a bug zapper: the dark well of the housing and the tubes standing in it, unlit. The lit tubes
 * are drawn live over this, and the grid goes on top (`zapperFront`), so the light is behind its wires.
 */
function zapperBack(pal: MetalPalette, cage: Cage) {
  return sprite(`ts|back|${pal.base.h},${pal.base.l}|${cage.hw}`, -8, -6, 16, 12, (g) => {
    const shell = iron(pal, 34);
    g.fillStyle = css(shell, -24, 1, -4);
    path(g, boxPts(-cage.hw, TOP, cage.hw * 2, BOT - TOP, 0.6, 4, 0.1));
    g.fill();
  });
}

/** A UV tube standing in the cage, lit by `k` (0 dull, 1 full) in five steps: flat tones, no halo (it isn't hot). */
function tube(s: CanvasRenderingContext2D, x: number, y: number, col: HSL, k: number) {
  const q = Math.round(Math.min(1, k) * 4);
  const sp = sprite(`ts|tube|${col.h | 0}|${q}`, -1.6, TOP, 3.2, BOT - TOP, (g) => {
    const glass: HSL = { h: col.h, s: 40 + q * 7, l: 40 + q * 8.5 };
    part(g, boxPts(-1, TOP + 0.6, 2, BOT - TOP - 1.2, 0.9, 11, 0.05), glass, 11, { depth: 0.4, shade: -14, thin: 0.25, thick: 0.5 });
    g.fillStyle = css(glass, 22 + q * 2.5);
    line(g, -0.35, TOP + 1.4, -0.35, BOT - 1.4, { w: 0.45, seed: 12, taper: [0.2, 0.3], press: 0.1 });
  });
  stamp(s, sp, x, y);
}

/**
 * The front of a bug zapper (docs/PARODY.md, tesla), the whole cell when housed: a peaked cap with a
 * stack of ceramic insulators up to the brass terminal the arc jumps from, a grid of fat wires over the
 * tubes, a deep tray bolted below with a yellow high-voltage sticker, and on the first one a scorched moth.
 */
function zapperFront(pal: MetalPalette, cage: Cage, moth: boolean) {
  return sprite(`ts|front|${pal.base.h},${pal.base.l}|${cage.hw}|${moth}`, -10, -14, 20, 24, (g) => {
    const shell = iron(pal, 34);
    const wire: HSL = { ...pal.light, s: Math.min(pal.light.s, 20), l: Math.max(70, pal.light.l) };
    const hw = cage.hw;
    // The insulator stack and the terminal on it.
    for (const [i, yy] of [-6.6, -7.8, -9].entries())
      part(g, ovalPts(0, yy, 1.7 - i * 0.15, 0.62, 20 + i, 0.03, 12), CERAMIC, 20 + i, { depth: 0.25, shade: -18, thin: 0.25, thick: 0.55 });
    ball(g, 0, -10.4, 1.7, COPPER, 3);
    // The grid: fat wires, each lit down one side, two rings across them.
    for (let bx = -hw + 1.25; bx <= hw - 1.2; bx += hw > 5 ? 1.9 : 1.75) bar(g, poly(bx, TOP + 0.2, bx, BOT - 0.2), 0.42, wire, bx * 5, { rim: 0.2 });
    for (const by of [-1.4, 1.6]) bar(g, poly(-hw + 0.2, by, hw - 0.2, by - 0.1), 0.5, wire, by * 7, { rim: 0.22 });
    // The sides of the cage, posts in the housing's metal.
    for (const sx of [-1, 1]) bar(g, poly(sx * (hw - 0.1), TOP, sx * (hw - 0.1), BOT), 1.1, shell, 30 + sx, { lit: 14 });
    // The peaked cap.
    const cap = poly(-hw - 1.2, TOP + 0.6, -hw + 0.6, TOP - 1.4, -1.6, TOP - 2.2, 1.6, TOP - 2.2, hw - 0.6, TOP - 1.4, hw + 1.2, TOP + 0.6);
    part(g, cap, shell, 7, { depth: 0.6, shade: -16, thin: 0.45, thick: 1.2 });
    glint(g, poly(-hw + 0.4, TOP - 0.2, -hw + 1.6, TOP - 1.3, -1.8, TOP - 1.8), css(shell, 30), 0.5);
    // The tray it all sits in, bolted, and the sticker on its front.
    const tray = boxPts(-hw - 1, BOT - 0.3, hw * 2 + 2, 7.6 - BOT + 0.3, 0.8, 8, 0.12);
    part(g, tray, shell, 8, { depth: 0.6, shade: -16, thin: 0.45, thick: 1.2 });
    for (const x of [-hw + 0.6, hw - 0.6]) dot(g, x, BOT + 1.6, 0.42, 9 + x, css(pal.light), inkFor(shell));
    if (hw > 5) {
      const tri = poly(2.6, 7, 4.3, 4.6, 6, 7);
      part(g, tri, HAZARD, 10, { depth: 0.2, shade: -12, thin: 0.25, thick: 0.5 });
      g.fillStyle = inkFor(HAZARD);
      path(g, poly(4.5, 5.2, 3.8, 6.1, 4.4, 6.1, 4, 6.9, 4.9, 5.8, 4.3, 5.8));
      g.fill();
    }
    if (moth) {
      // Scorched, on its back on the tray, with a last curl of smoke.
      const mx = hw > 5 ? -2.4 : 0;
      g.fillStyle = css(MOTH, -6);
      path(g, poly(mx - 1.6, BOT, mx - 0.4, BOT - 1.7, mx + 0.4, BOT - 0.1));
      g.fill();
      path(g, poly(mx - 0.4, BOT, mx + 1.2, BOT - 1.6, mx + 1.6, BOT - 0.1));
      g.fill();
      g.fillStyle = inkFor(MOTH);
      blob(g, mx, BOT - 0.1, 0.75, 8, 0.6, 0.1);
      g.fill();
      g.fillStyle = 'rgba(210,205,200,0.8)';
      stroke(g, poly(mx, BOT - 2.2, mx - 0.6, BOT - 3.6, mx + 0.4, BOT - 4.8, mx - 0.2, BOT - 6.2), { w: 0.45, seed: 9, taper: [0.2, 0.8], press: 0 });
    }
    tick(g, -hw + 0.6, BOT + 2.8, hw - 0.6, BOT + 2.9, 0.4, 12, css(shell, -30));
  });
}

function drawTesla(rc: RC, m: M<'tesla'>, r: Resolved, mi: number, off: Vec, pal: MetalPalette, st: PropStyle, o: PropDrawOpts) {
  const s = rc.s;
  const g = rc.g;
  const c = teslaCycle(m, rc.frame, r.phase);
  const col: HSL = { h: st.glowHue, s: 100, l: 65 };
  const tops: [number, number][] = [];
  const idle = c.seg === 1 ? c.t / c.len : c.seg === 2 ? 1 : 0.15;
  const cage = housed(r) ? WIDE : SLIM;
  [m.a, m.b].forEach((p, i) => {
    const x = p[0] + off[0];
    const y = p[1] + off[1];
    // The well, the tubes lighting as it charges, and the grid over them.
    stamp(s, zapperBack(pal, cage), x, y);
    for (const tx of cage.tubes) tube(s, x + tx, y, col, idle);
    stamp(s, zapperFront(pal, cage, i === 0), x, y);
    tops.push([x, y - 10]);
    glowDot(g, x, y - 10.4, 4 + idle * 6, col, 0.3 + idle * 0.6);
    if (Math.random() < 0.1 + idle * 0.5) {
      g.strokeStyle = css(col, 20, 0.7);
      g.lineWidth = 0.7;
      const ra = Math.random() * Math.PI * 2;
      lightning(g, x, y - 10, x + Math.cos(ra) * 7, y - 10 + Math.sin(ra) * 7, 3, 4);
      g.stroke();
    }
  });
  const [a, b] = tops;
  if (beamOf(o, r, mi)?.hit) return; // Shorted: the coils charge, and nothing crosses.
  if (c.seg === 1 && Math.random() < c.t / c.len) {
    g.strokeStyle = css(col, 20, 0.35);
    g.lineWidth = 0.8;
    lightning(g, a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + (Math.random() - 0.5) * 10, 6, 5);
    g.stroke();
  }
  if (c.seg === 2) {
    const ax = m.a[0] + off[0];
    const ay = m.a[1] + off[1];
    const bx = m.b[0] + off[0];
    const by = m.b[1] + off[1];
    for (let k = 0; k < 3; k++) {
      lightning(g, ax, ay - 2, bx, by - 2, 7, 12);
      g.strokeStyle = css(col, 0, 0.4);
      g.lineWidth = 4;
      g.stroke();
      g.strokeStyle = css(col, 30, 0.95);
      g.lineWidth = 1.2;
      g.stroke();
    }
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    light(rc, mx, my, Math.hypot(bx - ax, by - ay) * 0.8 + 40, col, 1.1);
    if (o.emit && Math.random() < 0.5) o.emit('spark', mx, my, (Math.random() - 0.5) * 200, (Math.random() - 0.5) * 200, col);
  }
}

defineArt<'tesla'>({ type: 'tesla', layer: 3, draw: (rc, m, d) => drawTesla(rc, m, d.r, d.mi, d.off, d.pal, d.style, d.o) });
