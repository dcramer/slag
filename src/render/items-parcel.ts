import { css, type HSL } from '../core/color';
import { hash2 } from '../core/rng';
import { PARCEL_HALF } from '../sim/parcels';
import type { RunWorld } from '../sim/run';
import { line } from './ink';
import { bar, boxPts, ovalPts, part, poly, sprite, stamp, tick } from './ink-props';
import type { RC } from './kit';

/**
 * Hand-Me-Downs (sim/parcels.ts): a parcel in brown paper with an address label, tied with string in the colour of
 * whoever it's for and carried by a loop of it, dropping down the screen with speed lines over it, swaying a little.
 * A parcel, not a gift: no bow (the Sucker Punch is the gift box). Baked once a colour; the lines are live.
 */

const KRAFT: HSL = { h: 34, s: 46, l: 70 };
const LABEL: HSL = { h: 45, s: 30, l: 94 };

const parcelSprite = (string: HSL) =>
  sprite(`it|parcel|${css(string)}`, -10, -14, 20, 23, (g) => {
    const h = PARCEL_HALF;
    part(g, boxPts(-h - 0.6, -h, 2 * h + 1.2, 2 * h, 0.9, 201, 0.12), KRAFT, 201, { depth: 0.6, thin: 0.45, thick: 1.1 });
    tick(g, h - 1.6, -h + 1.8, h - 1.9, h - 1.6, 0.45, 202, css(KRAFT, -26));
    // The address label in the lower left, two lines written on it.
    part(g, boxPts(-h + 0.6, 1.8, 5.4, 3.8, 0.4, 203, 0.08), LABEL, 203, { depth: 0.2, thin: 0.3, thick: 0.6 });
    tick(g, -h + 1.5, 3.1, -h + 5, 3, 0.4, 204, css(LABEL, -40));
    tick(g, -h + 1.5, 4.4, -h + 4.2, 4.4, 0.4, 205, css(LABEL, -40));
    // The string round it both ways, knotted on top, and the loop it hangs by.
    bar(g, poly(-h - 0.5, 0.6, h + 0.5, 0.3), 1.5, string, 206);
    bar(g, poly(0.6, -h, 0.4, h), 1.5, string, 207);
    bar(g, poly(-0.6, -h, -2, -h - 3.6, 0.6, -h - 5, 3, -h - 3.4, 1.8, -h), 1.1, string, 208);
    part(g, ovalPts(0.6, -h, 1.3, 1.1, 209), string, 209, { depth: 0.2, thin: 0.3, thick: 0.6 });
  });

/** Every parcel on its way down, drawn on the leader's lap (`lapY`: the leader's laps in px), its string in `colour` of the one it's for. */
export function drawParcels(rc: RC, run: RunWorld, lapY: number, colour: (slot: number) => HSL | undefined) {
  if (!run.parcels?.falling.length) return;
  const s = rc.s;
  for (const p of run.parcels.falling) {
    const r = run.runners[p.target];
    if (!r) continue;
    const x = p.x;
    const y = p.y - PARCEL_HALF + lapY;
    const sway = Math.sin(rc.t * 7 + p.born) * 0.12;
    // Speed lines trailing up off it, on the layer that gets no ink, longer the faster it falls.
    const len = Math.min(26, 6 + p.vy * 0.03);
    rc.bg.fillStyle = css(KRAFT, 20, 0.7);
    for (let k = 0; k < 3; k++) {
      const lx = x - 4 + k * 4 + (hash2(k, p.born, 7) - 0.5) * 1.4;
      const top = y - PARCEL_HALF - 6 - len * (k === 1 ? 1 : 0.7);
      line(rc.bg, lx, top, lx, y - PARCEL_HALF - 5, { w: 0.8, seed: k + p.born, taper: [0.9, 0.1], press: 0 });
    }
    s.save();
    s.translate(x, y);
    s.rotate(sway);
    stamp(s, parcelSprite(colour(r.slot) ?? KRAFT));
    s.restore();
  }
}
