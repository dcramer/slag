import { css, type HSL } from '../../../core/color';
import { line, type P, stroke } from '../../ink';
import { ball, dot, INK, ovalPts, part, path, poly, tick } from '../../ink-props';
import type { MetalPalette } from '../../kit';
import { disc, iron } from '../machine';

/**
 * The pieces a launcher's body is built from (props/machine.ts): wheels, legs, a stand. Each style builds
 * its own body out of them, so its outline is the machine's shape (a cannon on its carriage, a turret on
 * a tripod, a blaster on its pedestal), never the square of the tile it stands in. Upright always, in the
 * launcher's own px round the cell's center; the barrel pivots at (0, 0).
 */

/** A spoked cart wheel: tyre, hub, four spokes. */
export function cartWheel(g: CanvasRenderingContext2D, x: number, y: number, r: number, wood: HSL, pal: MetalPalette, seed: number) {
  g.fillStyle = INK;
  disc(g, x + 0.2, y + 0.25, r + 0.7, seed);
  g.fill();
  g.fillStyle = css(wood, -8);
  disc(g, x, y, r, seed + 1);
  g.fill();
  g.fillStyle = css(wood, -26, 1, 6);
  disc(g, x + 0.1, y + 0.1, r - 1, seed + 2);
  g.fill();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI + 0.4;
    g.fillStyle = css(wood, 4);
    line(g, x - Math.cos(a) * (r - 0.8), y - Math.sin(a) * (r - 0.8), x + Math.cos(a) * (r - 0.8), y + Math.sin(a) * (r - 0.8), {
      w: 0.6,
      seed: seed + i,
      taper: [0, 0],
      press: 0,
    });
  }
  dot(g, x, y, Math.max(0.6, r * 0.28), seed + 5, css(iron(pal, 50), 20));
}

/** A small solid wheel, for a cart: a dark tyre and a lit hub. */
export function wheel(g: CanvasRenderingContext2D, x: number, y: number, r: number, pal: MetalPalette, seed: number) {
  ball(g, x, y, r, { h: 220, s: 8, l: 22 }, seed);
  dot(g, x, y, r * 0.4, seed + 1, css(iron(pal, 50), 18));
}

/** Legs splayed from a hub to the ground: a dark ink stroke under a lit one, a foot pad at each end. */
export function legs(g: CanvasRenderingContext2D, hx: number, hy: number, feet: readonly number[], col: HSL, seed: number) {
  for (let i = 0; i + 1 < feet.length; i += 2) {
    const pts: P[] = [
      { x: hx, y: hy },
      { x: (hx + feet[i]) / 2, y: (hy + feet[i + 1]) / 2 },
      { x: feet[i], y: feet[i + 1] },
    ];
    g.fillStyle = INK;
    stroke(g, pts, { w: 2.2, seed: seed + i, taper: [0, 0], press: 0.1 });
    g.fillStyle = css(col, feet[i] < hx ? 10 : -8);
    stroke(g, pts, { w: 1.1, seed: seed + i + 1, taper: [0, 0], press: 0.1 });
    g.fillStyle = INK;
    path(g, ovalPts(feet[i], feet[i + 1] - 0.2, 1.5, 0.75, seed + i + 2, 0.05, 12));
    g.fill();
  }
}

/** A hub where legs or a barrel meet a body: a dark disc with a lit cap. */
export function hub(g: CanvasRenderingContext2D, x: number, y: number, r: number, pal: MetalPalette, seed: number) {
  ball(g, x, y, r, iron(pal, 46), seed);
}

/**
 * A clay-pigeon trap's housing: a squat riveted box on a skid, a post under the pivot, hazard stripes,
 * and a returns-desk receipt curling out of a slot in its side. A machine, not a body.
 */
export function trapBox(g: CanvasRenderingContext2D, col: HSL, pal: MetalPalette, seed: number) {
  part(g, poly(-8, 8, 8, 8, 7.4, 6.4, -7.4, 6.4), iron(pal, 34), seed, { depth: 0.4, thin: 0.45, thick: 1.2, shade: -10 });
  part(g, poly(-1.6, 1.4, 1.6, 1.4, 1.2, -0.4, -1.2, -0.4), iron(pal, 44), seed + 1, { depth: 0.3, thin: 0.35, thick: 0.8 });
  const body = poly(-7, 6.6, 7, 6.6, 6.6, 1.2, -6.6, 1.2);
  part(g, body, col, seed + 2, { depth: 1, thin: 0.55, thick: 1.5, shade: -18 });
  g.save();
  path(g, body);
  g.clip();
  g.fillStyle = '#f2b705';
  path(g, poly(-7, 6.6, 7, 6.6, 7, 5.2, -7, 5.2));
  g.fill();
  g.fillStyle = INK;
  for (let x = -7; x < 8; x += 2.4) {
    path(g, poly(x, 6.6, x + 1.1, 6.6, x + 2.1, 5.2, x + 1, 5.2));
    g.fill();
  }
  g.restore();
  for (const x of [-5.4, 5.4]) dot(g, x, 2.6, 0.45, seed + x, css(pal.light));
  // The slot, and the receipt curling out of it and down past the skid.
  tick(g, -6.2, 2.3, -6.2, 4.4, 0.55, seed + 3);
  const tape = poly(-6.4, 2.6, -8.2, 3.4, -8.8, 5.4, -8.2, 7.4, -7.2, 8.4);
  g.fillStyle = INK;
  stroke(g, tape, { w: 1.9, seed: seed + 4, taper: [0, 0.2], press: 0 });
  g.fillStyle = '#f6f1e4';
  stroke(g, tape, { w: 1.1, seed: seed + 4, taper: [0, 0.3], press: 0 });
  for (const y of [4.2, 5.4, 6.6]) tick(g, -8.9, y, -8.3, y + 0.1, 0.25, seed + y, 'rgba(18,11,8,0.55)');
}

/** A mortar's baseplate: a heavy dished disc seen edge-on, with a lip and two bolts. */
export function baseplate(g: CanvasRenderingContext2D, pal: MetalPalette, seed: number) {
  const pts = poly(-7.8, 7.9, 7.8, 7.9, 7.2, 5.8, 3, 5, -3, 5, -7.2, 5.8);
  part(g, pts, iron(pal, 40), seed, { depth: 0.6, thin: 0.5, thick: 1.4, shade: -16 });
  for (const x of [-5, 5]) dot(g, x, 6.8, 0.6, seed + x, css(pal.light));
}

/**
 * A bullet blaster's pedestal: a tapered black column on a stepped foot, bolted round its base.
 * The drum it fires from is the barrel, turning on top of it, and it wears the roundel.
 */
export function pedestal(g: CanvasRenderingContext2D, seed: number) {
  const black: HSL = { h: 220, s: 10, l: 20 };
  const foot = poly(-7.6, 8, 7.6, 8, 7.6, 6.2, 6.4, 5.4, -6.4, 5.4, -7.6, 6.2);
  part(g, foot, black, seed, { depth: 0.6, thin: 0.5, thick: 1.4, shade: -8 });
  const col = poly(-5.6, 5.6, 5.6, 5.6, 4.6, 1, -4.6, 1);
  part(g, col, black, seed + 1, { depth: 0.8, thin: 0.5, thick: 1.4, shade: -8 });
  g.fillStyle = css(black, 22);
  line(g, -4.8, 1.6, -5.3, 5, { w: 0.6, seed: seed + 2, taper: [0.2, 0.3], press: 0 });
  for (const x of [-3.4, 0, 3.4]) dot(g, x, 6.8, 0.55, seed + 3 + x, css(black, 40));
}

/** A blaster's badge: a crosshair roundel on a white disc. A mark, never a face. */
export function roundel(g: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  g.fillStyle = INK;
  disc(g, x + 0.15, y + 0.15, 2.5, seed);
  g.fill();
  g.fillStyle = '#f2ecdf';
  disc(g, x, y, 2.05, seed + 1);
  g.fill();
  g.fillStyle = '#c0182a';
  disc(g, x, y, 1.15, seed + 2);
  g.fill();
  g.fillStyle = '#f2ecdf';
  disc(g, x, y, 0.62, seed + 3);
  g.fill();
  for (const [ax, ay, bx, by] of [
    [0, -2, 0, -0.9],
    [0, 0.9, 0, 2],
    [-2, 0, -0.9, 0],
    [0.9, 0, 2, 0],
  ])
    tick(g, x + ax, y + ay, x + bx, y + by, 0.32, seed + 4 + ax + ay * 3);
}
