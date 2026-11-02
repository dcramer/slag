import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { type ModuleOf, THAW_OPEN, THAW_WARN, thawCycle, thawSolid, thawWater, WATERLINE } from '../../../sim/props';
import { line } from '../../ink';
import { boxPts, glint, pen, poly, tick, tone } from '../../ink-props';
import type { RC } from '../../kit';
import { type DrawCtx, defineArt } from '../common';

/**
 * Thin ice (sim/props/modules/thaw.ts), drawn from the sim's own cycle on exactly the cells it holds and the
 * water it drowns in. Frozen: a pale sheet flush with the floor, the dark water showing under it. Through the
 * warning the cracks run out across it from a few points, longer and darker toward the end, and it judders.
 * Open: the hole is water to the waterline, broken plates of the old ice bobbing in it and shrinking; near the
 * end a skin of new ice creeps in from the edges, the moment before it holds again.
 */

type Thaw = ModuleOf<'thaw'>;

const ICE: HSL = { h: 196, s: 50, l: 84 };
const ICE_INK = '#1d4660';

const waterOf = (d: DrawCtx): HSL => {
  const c = d.o.level?.theme.liquid.color;
  return c ? { ...c, l: Math.min(c.l, 34) } : { h: 200, s: 50, l: 28 };
};

/** The run of ice cells, in px: left, right, top (each module's cells are one row). */
function span(m: Thaw, d: DrawCtx) {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y = Infinity;
  for (const [cx, cy] of m.cells) {
    x0 = Math.min(x0, cx);
    x1 = Math.max(x1, cx + 1);
    y = Math.min(y, cy);
  }
  return { x0: x0 * TILE + d.off[0], x1: x1 * TILE + d.off[0], y: y * TILE + d.off[1] };
}

/** The water under the ice, from `top` down the hole: flat bands, darker with depth. */
function water(rc: RC, m: Thaw, d: DrawCtx, top: number) {
  const w = thawWater(m);
  const x = w.x + d.off[0];
  const bottom = w.y + d.off[1] + w.h;
  const col = waterOf(d);
  const s = rc.s;
  s.fillStyle = css(col);
  s.fillRect(x, top, w.w, bottom - top);
  s.fillStyle = css(col, -8);
  s.fillRect(x, top + (bottom - top) * 0.45, w.w, (bottom - top) * 0.55);
}

/** Cracks from a few points of the sheet, `k` 0..1 of the way out (the warning), every one on the same lines each cycle. */
function cracks(rc: RC, m: Thaw, x0: number, x1: number, y: number, k: number) {
  const s = rc.s;
  const n = Math.max(2, Math.round((x1 - x0) / 20));
  for (let i = 0; i < n; i++) {
    const cx = x0 + ((i + 0.5) / n) * (x1 - x0) + (hash2(i, 1, m.seed) - 0.5) * 8;
    const cy = y + 3 + hash2(i, 2, m.seed) * 4;
    for (let j = 0; j < 4; j++) {
      const a = j * 1.6 + hash2(i, j + 3, m.seed) * 1.2;
      const len = (4 + hash2(i, j + 8, m.seed) * 9) * k;
      const ex = Math.max(x0 + 0.5, Math.min(x1 - 0.5, cx + Math.cos(a) * len));
      const ey = Math.max(y + 0.6, Math.min(y + TILE - 0.6, cy + Math.sin(a) * len * 0.45));
      s.fillStyle = k > 0.6 ? '#0e2a3c' : ICE_INK;
      line(s, cx, cy, ex, ey, { w: 0.35 + 0.35 * k, seed: i * 7 + j, taper: [0.1, 0.7], press: 0.2 });
    }
  }
}

/** The sheet itself on the cells that hold this frame, judder `dx` px; marks `k` along its cracks. */
function sheet(rc: RC, m: Thaw, d: DrawCtx, k: number) {
  const s = rc.s;
  const { x0, x1, y } = span(m, d);
  const dx = k > 0 ? Math.sin(rc.frame * 1.9) * 0.35 * k : 0;
  // Only the cells that hold (one held open over a runner stays water).
  const held = m.cells.every((_, ci) => thawSolid(m, rc.frame, d.r.phase, d.o.state, d.mi, ci));
  if (!held) return open(rc, m, d, 0);
  water(rc, m, d, y + TILE);
  const pts = boxPts(x0 + dx, y, x1 - x0, TILE, 1.2, m.seed, 0.06);
  tone(s, pts, ICE, { depth: 1.1 });
  // The water's dark seen through the ice, low in the sheet.
  s.fillStyle = css(waterOf(d), 10, 0.35);
  s.fillRect(x0 + 1.5 + dx, y + TILE * 0.55, x1 - x0 - 3, TILE * 0.4);
  glint(s, poly(x0 + 3 + dx, y + 1.6, x0 + (x1 - x0) * 0.35 + dx, y + 1.2), 'rgba(255,255,255,0.9)', 0.7, m.seed);
  // A few old hairlines, always there: this is the ice that goes.
  for (let i = 0; i < 2; i++) {
    const cx = x0 + 4 + hash2(i, 20, m.seed) * (x1 - x0 - 8);
    tick(s, cx + dx, y + 2, cx + 3 + dx, y + 6, 0.35, i, css(ICE, -28));
  }
  if (k > 0) cracks(rc, m, x0 + dx, x1 + dx, y, k);
  pen(s, pts, m.seed + 3, 0.4, 1, 3, ICE_INK);
}

/** Open water: its surface at the sim's waterline, plates of broken ice bobbing and melting, new ice creeping in at the end (`k` 0..1 through the open spell). */
function open(rc: RC, m: Thaw, d: DrawCtx, k: number) {
  const s = rc.s;
  const { x0, x1, y } = span(m, d);
  const top = y + WATERLINE;
  water(rc, m, d, top);
  s.fillStyle = css(waterOf(d), 26);
  line(s, x0 + 0.5, top, x1 - 0.5, top, { w: 0.9, seed: m.seed, taper: [0.05, 0.05], press: 0.1 });
  const n = Math.max(2, Math.round((x1 - x0) / 9));
  for (let i = 0; i < n; i++) {
    const size = (3.5 + hash2(i, 30, m.seed) * 3) * (1 - 0.6 * k);
    const fx = x0 + 3 + ((i + 0.5) / n) * (x1 - x0 - 6) + Math.sin(rc.frame * 0.05 + i) * 1.4;
    const fy = top - 0.6 + Math.sin(rc.frame * 0.09 + i * 2) * 0.5;
    const plate = poly(fx - size, fy, fx + size * 0.8, fy - 0.4, fx + size, fy + 1.6, fx - size * 0.7, fy + 1.8);
    tone(s, plate, ICE, { depth: 0.4 });
    pen(s, plate, i + m.seed, 0.3, 0.6, 2, ICE_INK);
  }
  if (k > 0.7) {
    // The new skin, from both edges in.
    const reach = ((k - 0.7) / 0.3) * (x1 - x0) * 0.5;
    s.fillStyle = 'rgba(214,236,248,0.75)';
    s.fillRect(x0, top - 0.6, reach, 2.2);
    s.fillRect(x1 - reach, top - 0.6, reach, 2.2);
  }
}

defineArt<'thaw'>({
  type: 'thaw',
  layer: 1,
  draw(rc, m, d) {
    const c = thawCycle(m, rc.frame, d.r.phase);
    if (c.seg === THAW_OPEN) open(rc, m, d, c.t / Math.max(1, c.len));
    else sheet(rc, m, d, c.seg === THAW_WARN ? (c.t + 1) / Math.max(1, c.len) : 0);
  },
});
