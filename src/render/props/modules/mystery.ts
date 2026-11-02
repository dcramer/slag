import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { type ModuleOf, mysterySpent, mysteryState } from '../../../sim/props';
import { blob, line, type P, stroke } from '../../ink';
import { boxPts, dot, glint, INK, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { bulb, light, type RC } from '../../kit';
import { defineArt, type DrawCtx } from '../common';

type Mystery = ModuleOf<'mystery'>;

/**
 * The Lucky Block (docs/PARODY.md, mystery crate): the platformer's floating question block, as a loot box.
 * A chunky gold cube with a bevelled frame, a bolt in each corner and a coin slot on top, and on its face a
 * fat, leaning hook of a glyph of our own whose dot is a four-point star. Hit it from below and it jumps
 * and squashes and spits a sparkle after the item. While it waits on its timer the glyph is hollow and
 * fills from the bottom; spent, it's a dull dented block with its glyph knocked out.
 */

const T = TILE;
const GOLD: HSL = { h: 40, s: 92, l: 54 };
const DULL: HSL = { h: 28, s: 30, l: 32 };
const CREAM = '#fff5d6';

/** The glyph's hook and star, centered on the face. */
const HOOK: P[] = (() => {
  const pts: P[] = [];
  // The bowl: round over the top from the left, then a swan neck down to the stem.
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * 1.08 + (i / 12) * Math.PI * 1.25;
    pts.push({ x: Math.cos(a) * 2.9, y: -2.7 + Math.sin(a) * 2.6 });
  }
  pts.push({ x: 1.2, y: -0.4 }, { x: 0.45, y: 0.5 }, { x: 0.25, y: 1.9 });
  return pts;
})();

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  const pts: P[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.42 : r;
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  path(g, pts);
  g.fill();
}

/** The glyph in one fill: `lit` cream with its hard drop, or hollow (just the drop and the ink) while it refills. */
function glyph(lit: boolean) {
  return sprite(`mystery|glyph|${lit}`, -6, -8, 12, 16, (g) => {
    g.save();
    g.translate(0.2, 0.4);
    g.transform(1, 0, -0.12, 1, 0, 0);
    // Ink first, fat, then the hard drop shadow down and right, then the face.
    g.fillStyle = INK;
    stroke(g, HOOK, { w: 3.72, seed: 3, taper: [0.06, 0.04], press: 0.1 });
    star(g, 0.25, 4.5, 2.5);
    g.fillStyle = lit ? css(GOLD, -26, 1, 6) : css(GOLD, -34, 1, -10);
    g.save();
    g.translate(0.55, 0.6);
    stroke(g, HOOK, { w: 2.7, seed: 3, taper: [0.06, 0.04], press: 0.1 });
    star(g, 0.25, 4.5, 1.6);
    g.restore();
    g.fillStyle = lit ? CREAM : css(GOLD, -22, 1, -10);
    stroke(g, HOOK, { w: 2.7, seed: 3, taper: [0.06, 0.04], press: 0.1 });
    star(g, 0.25, 4.5, 1.6);
    g.restore();
  });
}

/** The cube: bevelled frame, sunk face, corner bolts, coin slot. `spent` is dull and dented, its glyph gone. */
function cube(spent: boolean) {
  return sprite(`mystery|cube|${spent}`, -3, -3, T + 6, T + 6, (g) => {
    const c = spent ? DULL : GOLD;
    const body = boxPts(0, 0, T, T, 2.2, 7, 0.22);
    tone(g, body, c, { depth: 1.6, shade: -24 });
    g.save();
    path(g, body);
    g.clip();
    const b = 2.7;
    // Bevels: the lit top and left, the dark bottom and right, mitred at the corners.
    g.fillStyle = css(c, spent ? 8 : 20, 1, -8);
    path(g, poly(-1, -1, T + 1, -1, T - b, b, b, b, b, T - b, -1, T + 1));
    g.fill();
    g.fillStyle = css(c, spent ? -10 : -20, 1, 6);
    path(g, poly(T + 1, -1, T + 1, T + 1, -1, T + 1, b, T - b, T - b, T - b, T - b, b));
    g.fill();
    // The face sits a shade back from the frame: a crease along its top and left.
    g.fillStyle = css(c, -38, 0.8);
    line(g, b, b, T - b, b, { w: 0.55, seed: 1, taper: [0.1, 0.2], press: 0.3 });
    line(g, b, b, b, T - b, { w: 0.55, seed: 2, taper: [0.1, 0.2], press: 0.3 });
    if (spent) {
      // Dents where it was punched, and a crack off the worst one.
      for (const [x, y, r] of [
        [T * 0.55, T - 3.6, 1.8],
        [T * 0.3, T * 0.42, 1.2],
      ]) {
        g.fillStyle = css(c, -14);
        blob(g, x, y, r, x, 1, 0.25);
        g.fill();
        g.fillStyle = css(c, 12);
        stroke(g, poly(x + r * 0.2, y + r * 0.9, x + r, y + r * 0.1, x + r * 0.6, y - r * 0.7), { w: 0.45, seed: x, taper: [0.2, 0.3], press: 0 });
      }
      tick(g, T * 0.55 - 1, T - 4.6, T * 0.4, T * 0.5, 0.45, 9, INK);
      tick(g, T * 0.4, T * 0.5, T * 0.46, T * 0.36, 0.35, 10, INK);
    } else {
      // A sheen across the frame's top edge.
      glint(g, poly(2.4, 1.1, 6, 0.9, 10, 1.1), 'rgba(255,252,230,0.9)', 0.6);
    }
    g.restore();
    for (const [x, y] of [
      [1.45, 1.45],
      [T - 1.45, 1.45],
      [1.45, T - 1.45],
      [T - 1.45, T - 1.45],
    ])
      dot(g, x, y, 0.72, x * 3 + y, spent ? css(c, 20) : CREAM);
    pen(g, body, 7, 0.6, 1.9, 4);
    // The coin slot on top: the loot-box gag.
    part(g, boxPts(T / 2 - 3, -0.8, 6, 1.7, 0.4, 8, 0), { h: 220, s: 8, l: spent ? 34 : 56 }, 8, { depth: 0.3, thin: 0.3, thick: 0.6 });
    g.fillStyle = INK;
    line(g, T / 2 - 2, 0.05, T / 2 + 2, 0.05, { w: 0.52, seed: 4, taper: [0, 0], press: 0 });
  });
}

/** Frames a bump lasts: up, a squash on landing, settle. */
const BUMP = 14;

function drawMystery(rc: RC, m: Mystery, d: DrawCtx) {
  const s = rc.s;
  const g = rc.g;
  const f = rc.frame;
  const st = mysteryState(d.o.state, d.mi);
  const spent = mysterySpent(m, st.pops);
  const since = f - st.popAt;
  const ready = !spent && f >= st.ready;
  for (const [cx, cy] of m.cells) {
    const x = cx * TILE + d.off[0];
    const y = cy * TILE + d.off[1];
    // The bump: a jump up, then a squash as it lands, then still.
    let lift = 0;
    let sx = 1;
    let sy = 1;
    if (since >= 0 && since < BUMP) {
      const u = since / BUMP;
      if (u < 0.45) lift = Math.sin((u / 0.45) * Math.PI) * 4;
      else {
        const k = Math.sin(((u - 0.45) / 0.55) * Math.PI) * (1 - u);
        sx = 1 + k * 0.42;
        sy = 1 - k * 0.36;
      }
    }
    s.save();
    // Squash from the bottom edge, so it flattens onto where it sits.
    s.translate(x + T / 2, y + T - lift);
    s.scale(sx, sy);
    s.translate(-T / 2, -T);
    stamp(s, cube(spent));
    if (!spent) {
      if (ready) stamp(s, glyph(true), T / 2, T / 2 + 0.3);
      else {
        // Refilling: the glyph hollow, filling from the bottom as its timer runs.
        const u = 1 - Math.max(0, st.ready - f) / Math.max(1, m.refill);
        stamp(s, glyph(false), T / 2, T / 2 + 0.3);
        s.save();
        s.beginPath();
        s.rect(0, T - 2.5 - u * (T - 5), T, u * (T - 5) + 2.5);
        s.clip();
        stamp(s, glyph(true), T / 2, T / 2 + 0.3);
        s.restore();
      }
    }
    s.restore();
    const px = x + T / 2;
    const py = y + T / 2 - lift;
    if (since >= 0 && since < 22) {
      // The pop: a flash off the top and sparkles flung up after the item.
      const u = since / 22;
      bulb(g, px, y - 2, 3.5 * (1 - u), GOLD, 1 - u);
      g.fillStyle = css(GOLD, 30, 1 - u);
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * 0.5;
        const r = 4 + u * 16;
        star(g, px + Math.cos(a) * r, y - 2 + Math.sin(a) * r - u * 4, 1.6 * (1 - u) + 0.4);
      }
    }
    if (ready) {
      const pulse = 0.75 + Math.sin(rc.t * 4 + m.seed) * 0.25;
      light(rc, px, py, 24, GOLD, 0.4 * pulse);
      // Now and then a shine sweeps across the face.
      const cyc = (f + m.seed) % 150;
      if (cyc < 12) {
        const u = cyc / 12;
        const sx0 = x - 4 + u * (T + 8);
        s.save();
        path(s, boxPts(x + 1, y - lift + 1, T - 2, T - 2, 1.8, 7, 0));
        s.clip();
        s.fillStyle = 'rgba(255,253,236,0.55)';
        path(s, poly(sx0, y - lift, sx0 + 3, y - lift, sx0 - 2, y - lift + T, sx0 - 5, y - lift + T));
        s.fill();
        s.restore();
      }
    }
  }
}

defineArt<'mystery'>({ type: 'mystery', layer: 1, draw: drawMystery });
