import { css, type HSL } from '../../../core/color';
import { HANGAR_APRON, HANGAR_ARCH, hangarRoof } from '../../../sim/props';
import { line, type P } from '../../ink';
import { boxPts, dot, glint, INK, part, path, pen, poly, tick, tone } from '../../ink-props';
import type { MetalPalette } from '../../kit';

/**
 * Budget Airline (docs/PARODY.md, hangar): a corrugated quonset hangar, its arched roof in the airline's
 * livery and a dark arched door the paper planes roll out of, with a runway apron running out of the door,
 * its lights and centre line, and a windsock at the far end. Two tiles long. The roof is the curve the sim
 * steps (`hangarRoof`), and the apron the slab it stands on, so what looks solid is solid.
 */

/** The baked piece's box, round the middle of the 32×16 frame. */
export const HANGAR_BOX = [-17.5, -9.5, 35, 19] as const;

/** Frame px (top-left origin, as the sim draws them up) to the art's px round the frame's middle. */
const X = (x: number) => x - 16;
const Y = (y: number) => y - 8;

/** The roof line from x0 to x1, in art px. */
function roof(x0: number, x1: number, dy = 0, n = 24): P[] {
  const pts: P[] = [];
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    pts.push({ x: X(x), y: Y(hangarRoof(x)) + dy });
  }
  return pts;
}

/** An arch standing on y = base (frame px), half-width hw round cx, its crown at `top`. */
function doorway(cx: number, hw: number, base: number, top: number, spring: number): P[] {
  const pts: P[] = [{ x: X(cx - hw), y: Y(base) }];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (i / 12) * Math.PI;
    pts.push({ x: X(cx + Math.cos(a) * hw), y: Y(spring + Math.sin(a) * (spring - top)) });
  }
  pts.push({ x: X(cx + hw), y: Y(base) });
  return pts;
}

export function hangarLoft(g: CanvasRenderingContext2D, hue: HSL, pal: MetalPalette, seed: number) {
  const tin: HSL = { h: hue.h, s: 8, l: 82 };
  const livery: HSL = { h: hue.h, s: 72, l: 50 };
  const tarmac: HSL = { h: 222, s: 7, l: 36 };
  // The runway apron: a low slab out of the door, its centre line dashed and its edge lights lit.
  const { x0: ax0, x1: ax1, top: aTop } = HANGAR_APRON;
  const apron = boxPts(X(ax0), Y(aTop), ax1 - ax0 - 0.3, 16 - aTop - 0.2, 0.7, seed + 8, 0.08);
  part(g, apron, tarmac, seed + 8, { depth: 0.6, thin: 0.5, thick: 1.3, shade: -12 });
  g.fillStyle = css(tarmac, 18);
  line(g, X(ax0 + 1), Y(aTop + 0.6), X(ax1 - 1), Y(aTop + 0.6), { w: 0.5, seed: seed + 9, taper: [0.1, 0.2], press: 0 });
  for (let x = ax0 + 3; x < ax1 - 2; x += 3.2) tick(g, X(x), Y(aTop + 1.9), X(x + 1.7), Y(aTop + 1.9), 0.55, x, '#f4efe4');
  for (const x of [ax0 + 4, ax0 + 8, ax1 - 2]) dot(g, X(x), Y(15), 0.6, x, '#9df7ff');
  // The windsock at the runway's end: a thin pole, the sock in hazard orange, filled with a breeze.
  const poleX = X(ax1 - 1.6);
  g.fillStyle = INK;
  line(g, poleX, Y(aTop), poleX + 0.1, Y(1.4), { w: 0.75, seed: seed + 4, taper: [0, 0.1], press: 0 });
  const sock = poly(poleX - 0.2, Y(1.3), poleX - 0.2, Y(3.5), poleX - 4.6, Y(3), poleX - 4.8, Y(1.7));
  part(g, sock, { h: 22, s: 92, l: 56 }, seed + 5, { depth: 0.3, thin: 0.3, thick: 0.7 });
  g.fillStyle = '#fbf6ee';
  path(g, poly(poleX - 1.6, Y(1.45), poleX - 2.6, Y(1.55), poleX - 2.6, Y(3.25), poleX - 1.6, Y(3.35)));
  g.fill();

  // The shell: the arch the sim steps, standing on its short wall.
  const { x0, x1 } = HANGAR_ARCH;
  const shell = [...roof(x0, x1), { x: X(x1), y: Y(16) }, { x: X(x0), y: Y(16) }];
  tone(g, shell, tin, { depth: 1.2, shade: -20 });
  g.save();
  path(g, shell);
  g.clip();
  // Corrugations: ribs down the curve, lifted here and there.
  g.fillStyle = css(tin, -22, 0.9);
  for (let k = 1; k < 9; k++) {
    const x = x0 + k * 2.2;
    line(g, X(x), Y(hangarRoof(x)) + 0.8, X(x), k % 3 === 0 ? Y(11) : Y(15.4), { w: 0.4, seed: seed + k, taper: [0.2, 0.4], press: 0.4 });
  }
  // The livery: a band over the crown, a darker one under it, and a white wing flash.
  g.fillStyle = css(livery);
  path(g, [...roof(x0 - 1, x1 + 1, -0.6), ...roof(x1 + 1, x0 - 1, 3.2)]);
  g.fill();
  g.fillStyle = css(livery, -16);
  path(g, [...roof(x0 - 1, x1 + 1, 3.2), ...roof(x1 + 1, x0 - 1, 4.4)]);
  g.fill();
  g.fillStyle = '#fbf6ee';
  path(g, poly(X(7), Y(4.4), X(12.6), Y(2.6), X(11), Y(3.8), X(13.6), Y(4), X(8.6), Y(5)));
  g.fill();
  g.restore();
  pen(g, shell, seed, 0.55, 1.6, 4);
  // The door: dark and arched, its frame a shade of steel, a stripe of light on the floor inside.
  const door = doorway(10, 5.4, 16, 6, 9.6);
  part(g, door, pal.base, seed + 2, { depth: 0.5, shade: -18, thin: 0.4, thick: 0.9 });
  g.fillStyle = '#17121c';
  path(g, doorway(10, 4.4, 16, 7.2, 10));
  g.fill();
  g.fillStyle = 'rgba(255,226,150,0.5)';
  path(g, poly(X(6.4), Y(15.8), X(13.6), Y(15.8), X(12.2), Y(13.8), X(7.8), Y(13.8)));
  g.fill();
  glint(g, poly(X(2.4), Y(7.6), X(4), Y(4.6), X(6.6), Y(2.8)), 'rgba(255,255,255,0.85)', 0.55);
  tick(g, X(0.4), Y(15.7), X(19.6), Y(15.8), 0.9, seed + 6, INK);
}
