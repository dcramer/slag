import { css, type HSL } from '../core/color';
import { GLOVE, SWORD } from '../sim/items';
import type { Runner } from '../sim/run';
import { inkFor, type P, stroke } from './ink';
import { boxPts, glint, ovalPts, part, poly, sprite, stamp, tick } from './ink-props';
import type { RC } from './kit';

/**
 * Art for the brawl's own item (docs/PARODY.md, Held items): the Sucker Punch, a boxing glove on a spring inside a
 * gift box, the prank that punches whoever opens it. The icon is the box with the glove peeking out of its lid, drawn
 * around (0, 0) in a ~14 px box facing +x like the rest; the punch reads the runner's swing and never writes it.
 */

const BOX: HSL = { h: 200, s: 55, l: 52 };
const BOW: HSL = { h: 350, s: 70, l: 56 };
const MITT: HSL = { h: 4, s: 72, l: 50 };
const CUFF: HSL = { h: 40, s: 30, l: 90 };
const SPRING: HSL = { h: 210, s: 8, l: 70 };

/** The glove, fist toward +x at (5, 0), its cuff at the back round (-1, 0). */
const mittSprite = () =>
  sprite('it|mitt', -3, -6, 12, 12, (g) => {
    part(g, boxPts(-2.2, -3, 2.4, 6, 0.8, 81), CUFF, 81, { depth: 0.3, thin: 0.35, thick: 0.8 });
    part(g, ovalPts(2.6, -0.2, 4.4, 3.9, 82, 0.05), MITT, 82, { depth: 0.7, thin: 0.45, thick: 1.1 });
    part(g, ovalPts(1.2, 3, 2.2, 1.5, 83, 0.05), MITT, 83, { depth: 0.4, thin: 0.35, thick: 0.8 });
    tick(g, 4.6, -2.8, 5, 2.2, 0.4, 84, css(MITT, -26));
    glint(g, poly(1, -3.2, 3.6, -3.4, 5.6, -2.2), 'rgba(255,225,215,0.8)', 0.5);
  });

/** The gift box, its lid ajar, with a bow on it. */
const boxSprite = () =>
  sprite('it|giftbox', -6, -6, 12, 13, (g) => {
    part(g, boxPts(-4.6, -1.6, 9.2, 7.4, 0.6, 85), BOX, 85, { depth: 0.5, thin: 0.4, thick: 1 });
    part(g, boxPts(-1, -1.6, 2, 7.4, 0.2, 86), BOW, 86, { depth: 0.2, thin: 0.3, thick: 0.6 });
    part(g, poly(-5.2, -2.8, 4.4, -4.6, 4.8, -3, -5, -1.2), BOX, 87, { depth: 0.3, thin: 0.35, thick: 0.8 });
    part(g, ovalPts(-1.6, -4.6, 1.6, 1, 88, 0.06), BOW, 88, { depth: 0.2, thin: 0.3, thick: 0.6 });
    part(g, ovalPts(1.2, -5, 1.6, 1, 89, 0.06), BOW, 89, { depth: 0.2, thin: 0.3, thick: 0.6 });
  });

/** Icons for the brawl's items, keyed by kind. */
export const BRAWL_ICONS = {
  glove(s: CanvasRenderingContext2D) {
    stamp(s, boxSprite());
    // The glove peeking out from under the lid.
    s.save();
    s.translate(1, -3.4);
    s.rotate(-0.7);
    s.scale(0.55, 0.55);
    stamp(s, mittSprite());
    s.restore();
  },
};

/** How far out the glove is through a swing (0..1): it shoots out, holds while it connects, and springs back. */
function reachOf(swing: number): number {
  const u = 1 - swing / SWORD.swing;
  return u < 0.3 ? u / 0.3 : u < 0.75 ? 1 : Math.max(0, (1 - u) / 0.25);
}

/**
 * A Sucker Punch going off: the box held out in front, a coiled spring out of it to the glove at the end of its
 * reach (the sim's `GLOVE.reach`, so the glove is drawn where it hits).
 */
export function drawPunch(rc: RC, r: Runner, x: number) {
  const s = rc.s;
  const b = r.body;
  const out = reachOf(r.items.swing) * (GLOVE.reach - 10);
  s.save();
  s.translate(x + b.facing * 4, b.y + 7);
  s.scale(b.facing, 1);
  s.save();
  s.scale(0.7, 0.7);
  stamp(s, boxSprite());
  s.restore();
  // The spring: a zigzag from the box to the glove's cuff.
  const pts: P[] = [{ x: 3, y: -1 }];
  const coils = 7;
  for (let i = 1; i <= coils; i++) pts.push({ x: 3 + (out * i) / coils, y: -1 + (i % 2 ? -1.6 : 1.6) * (i === coils ? 0 : 1) });
  s.fillStyle = inkFor(SPRING);
  stroke(s, pts, { w: 1.1, seed: 90, taper: [0, 0], press: 0 });
  s.fillStyle = css(SPRING);
  stroke(s, pts, { w: 0.6, seed: 90, taper: [0, 0], press: 0 });
  s.translate(4 + out, -1);
  stamp(s, mittSprite());
  s.restore();
}
