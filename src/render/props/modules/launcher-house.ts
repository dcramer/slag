import { css, type HSL } from '../../../core/color';
import { line } from '../../ink';
import { boxPts, dot, glint, INK, ovalPts, part, path, pen, poly, tick, tone } from '../../ink-props';
import type { MetalPalette } from '../../kit';
import { backplate, flange, iron } from '../machine';

/**
 * What a launcher stands in: the whole cell under its barrel, drawn as the machine and not as a block
 * (props/machine.ts). Upright always, in the launcher's own px round the cell's center; the barrel pivots
 * at (0, 0). A style whose mount already fills the cell (a carved trap, a tower, an idol, a vending
 * machine) needs none of these.
 */

/**
 * A gun mount: a bolted turntable and two forked cheeks standing up either side of the pivot, with a pin
 * through each, painted in the part's color. The barrel swings between the cheeks.
 */
export function yoke(g: CanvasRenderingContext2D, pal: MetalPalette, hue: HSL, seed: number) {
  backplate(g, -8, -8, 16, 16, pal, seed);
  flange(g, 0, -8, 8, 4.6, pal, seed + 1);
  // The turntable ring the cheeks stand on.
  g.fillStyle = INK;
  path(g, ovalPts(0, 4.4, 5.4, 1.5, seed + 2, 0.03, 16));
  g.fill();
  const metal = iron(pal, 44);
  for (const sg of [-1, 1]) {
    const cheek = poly(sg * 7.9, 4.9, sg * 7.9, -4.2, sg * 7.2, -6.6, sg * 5.6, -7.4, sg * 4.2, -6, sg * 4.1, 4.9);
    tone(g, cheek, metal, { depth: 0.9, shade: -18 });
    g.save();
    path(g, cheek);
    g.clip();
    g.fillStyle = css(hue, -4);
    g.fillRect(sg * 8.5 - 4, 1.2, 8, 2.2);
    g.fillStyle = INK;
    line(g, sg * 3.6, 3.6, sg * 8.4, 3.6, { w: 0.6, seed: seed + sg, taper: [0, 0], press: 0.2 });
    g.restore();
    pen(g, cheek, seed + 3 + sg, 0.5, 1.4);
    // The pin the barrel turns on.
    dot(g, sg * 6.1, -0.6, 1.25, seed + 5 + sg, css(pal.spec, -10));
  }
  glint(g, poly(-7.2, 0.4, -7.1, -3.8, -6, -6.2), css(pal.spec, -12), 0.6);
}

/**
 * A section of ship's hull: tarred planks pegged at the joints, an open gun port in the middle with its
 * lid propped up over it (`port`), or plain planks for a shed wall.
 */
export function hull(g: CanvasRenderingContext2D, wood: HSL, pal: MetalPalette, seed: number, port: boolean) {
  const body = boxPts(-8, -8, 16, 16, 2.4, seed, 0.25);
  tone(g, body, wood, { depth: 1.2, shade: -16 });
  g.save();
  path(g, body);
  g.clip();
  const seam = css(wood, -26, 1, 6);
  for (const [i, y] of [-4.6, -1.4, 1.8, 5].entries()) {
    g.fillStyle = seam;
    line(g, -9, y, 9, y + 0.15, { w: 0.75, seed: seed + i, taper: [0, 0], press: 0.3 });
    g.fillStyle = css(wood, 12);
    line(g, -9, y + 0.65, 9, y + 0.75, { w: 0.4, seed: seed + i + 9, taper: [0, 0], press: 0.3 });
    const jx = i % 2 ? -3.4 : 3;
    tick(g, jx, y - 3, jx, y, 0.6, seed + i * 3, seam);
    dot(g, jx - 1.1, y - 1.6, 0.4, seed + i * 5);
  }
  g.restore();
  pen(g, body, seed + 1, 0.55, 1.5);
  if (!port) return;
  // The port: a dark square hole with an iron frame, and the lid hinged open above it.
  const frame = boxPts(-5.6, -4.2, 11.2, 10, 1.6, seed + 2);
  part(g, frame, iron(pal, 34), seed + 2, { depth: 0.5, thin: 0.45, thick: 1.1 });
  g.fillStyle = '#120c09';
  path(g, boxPts(-4.3, -3, 8.6, 7.6, 1.2, seed + 3));
  g.fill();
  const lid = poly(-5.4, -4.5, 5.4, -4.5, 6.4, -7.9, -6.4, -7.9);
  part(g, lid, { ...wood, l: wood.l - 6 }, seed + 4, { depth: 0.5, thin: 0.45, thick: 1.1 });
  for (const x of [-3.2, 3.2]) tick(g, x, -4.6, x * 1.12, -7.7, 0.9, seed + x, css(pal.dark, 8));
}

/** A cast cabinet in one color: rounded, two screws, a seam round its face and a dark plinth along its foot. */
export function cabinet(g: CanvasRenderingContext2D, col: HSL, pal: MetalPalette, seed: number) {
  const body = boxPts(-8, -8, 16, 16, 2.8, seed, 0.25);
  tone(g, body, col, { depth: 1.3, shade: -18 });
  g.save();
  path(g, body);
  g.clip();
  g.fillStyle = css(col, -32, 1, 4);
  g.fillRect(-9, 5, 18, 4);
  g.fillStyle = INK;
  line(g, -9, 5, 9, 5, { w: 0.7, seed, taper: [0, 0], press: 0.3 });
  g.fillStyle = css(col, 16);
  line(g, -6.6, -6.4, -6.6, 3, { w: 0.8, seed: seed + 1, taper: [0.2, 0.4], press: 0.1 });
  g.restore();
  pen(g, body, seed + 2, 0.55, 1.6);
  for (const x of [-5.8, 5.8]) dot(g, x, 6.6, 0.6, seed + x, css(pal.light));
}
