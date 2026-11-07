import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { type ModuleOf, mysteryState, surgeFill } from '../../../sim/props';
import { line } from '../../ink';
import { boxPts, glint, part, poly, sprite, stamp, tick } from '../../ink-props';
import { twinkle } from '../../items';
import { circle, type RC } from '../../kit';
import { defineArt, type DrawCtx } from '../common';

type Surge = ModuleOf<'surge'>;

/**
 * Leg Day (docs/PARODY.md, Leg Day): the kart racer's speed mushroom and the platformer's power-up, as a gym protein
 * shaker floating over a lip. A clear cup with a black screw lid and a flip spout, strawberry shake inside, a pink
 * sweatband round its middle. It bobs in a ring of shine like any pick-up. Taken, the cup is empty and fills back up
 * from the bottom as it refills; full, the shake froths.
 */

const T = TILE;
const CUP: HSL = { h: 200, s: 25, l: 88 };
const LID: HSL = { h: 220, s: 12, l: 18 };
const SHAKE: HSL = { h: 340, s: 75, l: 66 };
const BAND: HSL = { h: 330, s: 85, l: 56 };
const SHINE: HSL = { h: 335, s: 90, l: 78 };
/** Px over the cell's middle it floats, and frames a take's flash lasts. */
const FLOAT = -2;
const FLASH = 18;

/** The cup's outline points (around its middle), tapering a touch toward the foot. */
const cupPts = () => poly(-3.6, -3.2, 3.6, -3.2, 3.1, 5.4, -3.1, 5.4);

/** The lid and spout, baked once. */
const lidSprite = () =>
  sprite('surge|lid', -6, -9, 12, 7, (g) => {
    part(g, boxPts(-4.2, -5.2, 8.4, 2.4, 0.6, 131, 0.1), LID, 131, { depth: 0.3, thin: 0.35, thick: 0.8 });
    part(g, boxPts(-1.6, -7.4, 2.6, 2.4, 0.4, 132, 0.1), LID, 132, { depth: 0.2, thin: 0.3, thick: 0.6 });
    glint(g, poly(-3.4, -4.6, 2, -4.6), 'rgba(220,230,255,0.6)', 0.4);
  });

function drawSurge(rc: RC, m: Surge, d: DrawCtx) {
  const s = rc.s;
  const f = rc.frame;
  const st = d.o.state;
  const fill = d.o.itemSeed === undefined ? 1 : surgeFill(m, st, d.mi, f);
  const popAt = mysteryState(st, d.mi).popAt;
  for (const [cx, cy] of m.cells) {
    const x = cx * T + d.off[0] + T / 2;
    const bob = fill >= 1 ? Math.sin(rc.t * 3.4 + cx) * 1.1 : 0;
    const y = cy * T + d.off[1] + T / 2 + FLOAT + bob;
    if (fill >= 1) {
      // The shine ring, on the background as a loose item's is.
      rc.bg.save();
      rc.bg.translate(x, y);
      rc.bg.rotate(rc.t * 0.8 + cx);
      rc.bg.fillStyle = css(SHINE, 0, 0.9);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r0 = i % 2 ? 9 : 8;
        const r1 = i % 2 ? 11.2 : 12.4;
        line(rc.bg, Math.cos(a) * r0, Math.sin(a) * r0, Math.cos(a) * r1, Math.sin(a) * r1, { w: 2, seed: i, taper: [0.15, 0.7], press: 0 });
      }
      rc.bg.restore();
    }
    s.save();
    s.translate(x, y);
    s.scale(1.25, 1.25);
    // The cup, its shake up to how far it has refilled, and the band round it.
    part(s, cupPts(), CUP, 133, { depth: 0.4, thin: 0.4, thick: 0.9 });
    const top = 5 - 8.2 * fill;
    s.fillStyle = css(SHAKE, 0, 0.95);
    s.beginPath();
    s.moveTo(-3.2, Math.max(-2.9, top));
    s.lineTo(3.2, Math.max(-2.9, top));
    s.lineTo(2.8, 5);
    s.lineTo(-2.8, 5);
    s.fill();
    if (fill >= 1) {
      s.fillStyle = css(SHAKE, 22);
      for (let i = 0; i < 3; i++) circle(s, -2 + i * 2, -2.6 + Math.sin(rc.t * 9 + i) * 0.4, 0.75);
    }
    part(s, boxPts(-3.5, 0.4, 7, 1.8, 0.2, 134, 0.1), BAND, 134, { depth: 0.2, thin: 0.3, thick: 0.6 });
    tick(s, -2.4, -2.2, -2.2, 4, 0.45, 135, 'rgba(255,255,255,0.55)');
    stamp(s, lidSprite());
    s.restore();
    const since = f - popAt;
    if (since >= 0 && since < FLASH) {
      // Taken: pink sparkles off it.
      const u = since / FLASH;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.6;
        twinkle(s, x + Math.cos(a) * (3 + u * 10), y + Math.sin(a) * (3 + u * 10), 1.8 * (1 - u) + 0.3, css(SHINE, 10, 1 - u));
      }
    }
  }
}

defineArt<'surge'>({ type: 'surge', layer: 1, draw: drawSurge });
