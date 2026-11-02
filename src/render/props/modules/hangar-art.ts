import { css, type HSL } from '../../../core/color';
import { line, type P } from '../../ink';
import { dot, glint, INK, part, path, pen, poly, tick, tone } from '../../ink-props';
import type { MetalPalette } from '../../kit';

/**
 * Budget Airline (docs/PARODY.md, hangar): a corrugated quonset hangar on the launcher's block, its arched
 * roof in the airline's livery, a dark arched door the paper planes roll out of, runway lights along the
 * apron and a windsock on a thin pole. Everything that looks solid stays inside the block's cell; only the
 * pole and the sock stand above it.
 */

/** The baked piece's box, in the launcher's own px. */
export const HANGAR_BOX = [-9.5, -17, 22, 26] as const;

function arch(x0: number, x1: number, yBase: number, yTop: number, n = 14): P[] {
  const pts: P[] = [];
  const cx = (x0 + x1) / 2;
  const rx = (x1 - x0) / 2;
  for (let i = 0; i <= n; i++) {
    const a = Math.PI + (i / n) * Math.PI;
    pts.push({ x: cx + Math.cos(a) * rx, y: yBase + Math.sin(a) * (yBase - yTop) });
  }
  return pts;
}

export function hangarLoft(g: CanvasRenderingContext2D, hue: HSL, pal: MetalPalette, seed: number) {
  const tin: HSL = { h: hue.h, s: 8, l: 82 };
  const livery: HSL = { h: hue.h, s: 72, l: 50 };
  // The shell: an arch springing from the block's sides, standing on a short wall.
  const shell = [...arch(-7.3, 7.3, -1.6, -7.6), { x: 7.3, y: 7.3 }, { x: -7.3, y: 7.3 }];
  tone(g, shell, tin, { depth: 1.2, shade: -20 });
  g.save();
  path(g, shell);
  g.clip();
  // Corrugations: ribs following the arch, lifted here and there.
  g.fillStyle = css(tin, -22, 0.9);
  for (let k = 1; k < 7; k++) {
    const x = -7.3 + k * 2.1;
    const top = -1.6 - Math.sqrt(Math.max(0, 1 - (x / 7.3) ** 2)) * 6;
    line(g, x, top + 0.6, x, k % 3 === 0 ? 2.6 : 6.6, { w: 0.4, seed: seed + k, taper: [0.2, 0.4], press: 0.4 });
  }
  // The livery: a band over the crown, with a white wing flash.
  g.fillStyle = css(livery);
  path(g, [...arch(-7.6, 7.6, -1.6, -7.9), ...arch(7.6, -7.6, -0.2, -5.3)]);
  g.fill();
  g.fillStyle = css(livery, -16);
  path(g, [...arch(-7.6, 7.6, -0.2, -5.3), ...arch(7.6, -7.6, 0.6, -4.5)]);
  g.fill();
  g.fillStyle = '#fbf6ee';
  path(g, poly(-2.4, -4.4, 2.8, -6, 1.2, -4.9, 3.4, -4.6, -1.2, -3.7));
  g.fill();
  g.restore();
  pen(g, shell, seed, 0.55, 1.6, 4);
  // The door: dark and arched, its frame a shade of steel, a stripe of light on the floor inside.
  const door = [...arch(-4.6, 4.6, 2, -1.4, 10), { x: 4.6, y: 7.3 }, { x: -4.6, y: 7.3 }];
  part(g, door, pal.base, seed + 2, { depth: 0.5, shade: -18, thin: 0.4, thick: 0.9 });
  const inside = [...arch(-3.7, 3.7, 2.2, -0.5, 10), { x: 3.7, y: 7.3 }, { x: -3.7, y: 7.3 }];
  g.fillStyle = '#17121c';
  path(g, inside);
  g.fill();
  g.fillStyle = 'rgba(255,226,150,0.55)';
  path(g, poly(-3.2, 7.2, 3.2, 7.2, 1.8, 5.4, -1.8, 5.4));
  g.fill();
  // A paper plane parked inside, nose out.
  g.fillStyle = '#f4efe4';
  path(g, poly(-2.4, 4.4, 2.6, 3.8, -1.2, 2.6));
  g.fill();
  g.fillStyle = '#c9c1b2';
  path(g, poly(-2.4, 4.4, 2.6, 3.8, -0.8, 5));
  g.fill();
  // Runway lights along the apron.
  for (const x of [-5.9, 5.9]) dot(g, x, 6.2, 0.55, x, '#9df7ff');
  // The windsock: a thin pole off the roof, the sock in hazard orange, filled with a breeze.
  g.fillStyle = INK;
  line(g, 5.6, -3.6, 5.8, -15.6, { w: 0.75, seed: seed + 4, taper: [0, 0.1], press: 0 });
  const sock = poly(5.9, -15.4, 6, -12.9, 10.8, -12.6, 11.2, -14.4);
  part(g, sock, { h: 22, s: 92, l: 56 }, seed + 5, { depth: 0.3, thin: 0.3, thick: 0.7 });
  g.fillStyle = '#fbf6ee';
  path(g, poly(7.4, -15, 8.6, -14.8, 8.6, -12.8, 7.4, -12.8));
  g.fill();
  glint(g, poly(-5.6, -3.2, -4.2, -5.4, -2, -6.6), 'rgba(255,255,255,0.85)', 0.55);
  tick(g, -7, 7.2, 7, 7.3, 0.9, seed + 6, INK);
}
