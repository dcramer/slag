import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { TILE } from '../../../sim/constants';
import { dirOf, geyserCycle, type ModuleOf, type Resolved } from '../../../sim/props';
import { inkFor } from '../../ink';
import { boxPts, dot, ovalPts, part, poly, sprite, stamp, tick } from '../../ink-props';
import type { RC } from '../../kit';

/**
 * The fire hydrant (body look 'hydrant'): a squat cast-iron plug standing in its cell, bonnet on top,
 * a flange at its foot and a capped outlet on each side. Wherever one of the part's geysers jets, that
 * outlet stands open, a dark mouth with its cap gone, so you can see which way it'll blow. While a jet
 * rumbles the whole plug rattles on its bolts (the tell, on the sim's cycle); the water is the geyser's.
 * Drawn upright whatever the part's turn: a hydrant never lies on its side.
 */

type Body = ModuleOf<'body'>;

/** Which outlets are open, as bits: 1 right, 2 left, 4 up. */
function openOutlets(r: Resolved): number {
  let bits = 0;
  for (const m of r.mods) {
    if (m.type !== 'geyser' || m.look !== 'hydrant') continue;
    const [dx, dy] = dirOf(m.angle);
    bits |= dx > 0.5 ? 1 : dx < -0.5 ? 2 : dy < -0.5 ? 4 : 0;
  }
  return bits;
}

/** How hard the plug rattles this frame: the strongest of its jets' rumbles, growing toward the blast. */
function rattle(rc: RC, r: Resolved): number {
  let k = 0;
  for (const m of r.mods) {
    if (m.type !== 'geyser') continue;
    const c = geyserCycle(m, rc.frame, r.phase);
    if (c.seg === 1) k = Math.max(k, 0.3 + (c.t / c.len) * 0.9);
  }
  return k;
}

/** One side outlet: a collar, and either its cap with a nut and a chain to the barrel, or the open mouth. */
function outlet(g: CanvasRenderingContext2D, side: 1 | -1, open: boolean, paint: HSL, trim: HSL, seed: number) {
  const x0 = side > 0 ? 11.6 : 1.2;
  part(g, boxPts(x0, 7.2, 3.2, 4.2, 0.8, seed), trim, seed, { depth: 0.5, thin: 0.4, thick: 0.9 });
  const mx = x0 + (side > 0 ? 2.6 : 0.6);
  if (open) {
    dot(g, mx, 9.3, 1.4, seed + 1, undefined, inkFor(trim));
    return;
  }
  part(g, boxPts(side > 0 ? x0 + 2.4 : x0 - 0.8, 7.6, 1.6, 3.4, 0.5, seed + 2), paint, seed + 2, { depth: 0.3, thin: 0.35, thick: 0.8 });
  tick(g, mx - side * 2.4, 11.6, mx - side * 0.6, 12.4, 0.4, seed + 3, css(trim, -30));
}

function plug(hue: number, bits: number) {
  return sprite(`hydrant|${hue | 0}|${bits}`, -2, -2, TILE + 4, TILE + 4, (g) => {
    const paint: HSL = { h: hue, s: 62, l: 46 };
    const trim: HSL = { h: hue, s: 30, l: 70 };
    // Foot flange, barrel, the bonnet's rim and its dome.
    part(g, boxPts(1.8, 13.4, 12.4, 2.4, 0.8, 3), paint, 3, { depth: 0.5, thin: 0.4, thick: 1 });
    part(g, poly(4, 13.6, 3.6, 6.4, 12.4, 6.4, 12, 13.6), paint, 5, { depth: 1, thin: 0.45, thick: 1.1 });
    outlet(g, 1, (bits & 1) !== 0, paint, trim, 11);
    outlet(g, -1, (bits & 2) !== 0, paint, trim, 17);
    part(g, ovalPts(8, 4.4, 5.2, 3, 7), trim, 7, { depth: 0.7, thin: 0.4, thick: 1 });
    part(g, boxPts(2.4, 5, 11.2, 1.8, 0.6, 9), paint, 9, { depth: 0.4, thin: 0.4, thick: 0.9 });
    // The operating nut on top, or an open riser when the jet goes up.
    if (bits & 4) {
      part(g, boxPts(5.8, -0.2, 4.4, 2.6, 0.6, 23), trim, 23, { depth: 0.4, thin: 0.4, thick: 0.9 });
      dot(g, 8, 0.6, 1.3, 24, undefined, inkFor(trim));
    } else part(g, poly(6.4, 2, 6.8, 0.2, 9.2, 0.2, 9.6, 2), paint, 23, { depth: 0.3, thin: 0.35, thick: 0.8 });
    // The pumper nozzle on the front, its pentagon nut, and two marks of wear on the barrel.
    part(g, ovalPts(8, 10, 2.4, 2.2, 13), trim, 13, { depth: 0.5, thin: 0.4, thick: 0.9 });
    part(g, poly(8, 8.7, 9.3, 9.6, 8.8, 11.2, 7.2, 11.2, 6.7, 9.6), paint, 14, { depth: 0.2, thin: 0.3, thick: 0.6 });
    tick(g, 4.6, 7.8, 4.8, 12.6, 0.4, 15, css(paint, 18));
    tick(g, 10.8, 12.4, 11.2, 13, 0.35, 16, css(paint, -26));
  });
}

/** Draw every cell of a hydrant body (a hydrant takes one), rattling while a jet rumbles. */
export function drawHydrant(rc: RC, m: Body, off: Vec, r: Resolved) {
  const sp = plug(m.hue ?? 4, openOutlets(r));
  const k = rattle(rc, r);
  const jx = k ? Math.sin(rc.frame * 2.1) * k * 0.7 : 0;
  const jy = k ? -Math.abs(Math.sin(rc.frame * 1.3)) * k * 0.5 : 0;
  for (const [x, y] of m.cells) stamp(rc.s, sp, x * TILE + off[0] + jx, y * TILE + off[1] + jy);
}
