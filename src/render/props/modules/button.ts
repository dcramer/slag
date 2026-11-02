import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { buttonOn, buttonSolid, buttonUntil, dirOf } from '../../../sim/props';
import { line } from '../../ink';
import { boxPts, dot, glint, ovalPts, part, pen, poly, sprite, stamp, tone } from '../../ink-props';
import { glowDot, light } from '../../kit';
import { defineArt } from '../common';

const STEEL: HSL = { h: 215, s: 10, l: 50 };
const COVER = 'rgba(205,232,245,0.55)';
const TAPE: HSL = { h: 48, s: 30, l: 80 };

/** The plate, the cover flipped up behind the dome and the tape holding it open, in a frame with the face at y = 0 and out toward -y. */
function mount() {
  return sprite('btn', -9, -12, 18, 13, (g) => {
    // The safety cover, flipped open on its hinge and taped there.
    const cover = poly(-6.4, -1.5, -7.6, -10.6, -2.4, -11.2, -1.4, -2);
    g.fillStyle = COVER;
    g.beginPath();
    for (let i = 0; i < cover.length; i++) (i ? g.lineTo : g.moveTo).call(g, cover[i].x, cover[i].y);
    g.closePath();
    g.fill();
    pen(g, cover, 4, 0.3, 0.7, 3, '#1d3a4a');
    glint(
      g,
      [
        { x: -6.6, y: -4 },
        { x: -6.9, y: -9 },
      ],
      'rgba(255,255,255,0.85)',
      0.5,
    );
    const tape = poly(-8.8, -6.4, -3.8, -5.6, -3.9, -4.1, -8.9, -4.9);
    part(g, tape, TAPE, 7, { depth: 0.2, shade: -10, thin: 0.25, thick: 0.6 });
    // The plate it all sits on, bolted down.
    const plate = boxPts(-7.6, -2.4, 15.2, 2.6, 0.8, 2, 0.15);
    part(g, plate, STEEL, 2, { depth: 0.5, shade: -18, thin: 0.4, thick: 1 });
    for (const x of [-5.8, 5.8]) dot(g, x, -1.1, 0.45, x, '#e6e8ee');
  });
}

/** The dome, sunk by `press` (0 up, 1 down). */
function dome(s: CanvasRenderingContext2D, hue: number, press: number) {
  const h = 4.2 - press * 2.4;
  const pts = ovalPts(0.6, -2.4, 4.6, h, 3, 0.02, 16).filter((p) => p.y <= -2.2);
  pts.push({ x: 5.2, y: -2.2 }, { x: -4, y: -2.2 });
  part(s, pts, { h: hue, s: 80, l: 50 }, 3, { depth: 0.6, shade: -18, thin: 0.4, thick: 1.1 });
  glint(
    s,
    [
      { x: -1.6, y: -2.6 - h * 0.7 },
      { x: 1.2, y: -2.4 - h * 0.95 },
    ],
    'rgba(255,255,255,0.8)',
    0.55,
  );
}

/** A block the button holds up: the button's colour, bevelled, a little dome stencilled on it so you know whose it is. */
function block(hue: number, v: number) {
  return sprite(`btnblk|${hue | 0}|${v}`, -1, -1, TILE + 2, TILE + 2, (g) => {
    const body = boxPts(0.4, 0.4, TILE - 0.8, TILE - 0.8, 1.6, v + 11, 0.1);
    tone(g, body, { h: hue, s: 55, l: 48 }, { depth: 1, shade: -16 });
    const inner = boxPts(3, 3, TILE - 6, TILE - 6, 1, v + 12, 0.1);
    tone(g, inner, { h: hue, s: 60, l: 56 }, { depth: 0.5, shade: -10 });
    g.fillStyle = css({ h: hue, s: 60, l: 26 }, 0, 0.8);
    g.beginPath();
    g.ellipse(TILE / 2, TILE / 2 + 1.6, 3.2, 2.6, 0, Math.PI, 0);
    g.closePath();
    g.fill();
    g.fillRect(TILE / 2 - 4, TILE / 2 + 1.6, 8, 1.3);
    pen(g, body, v + 13, 0.5, 1.2, 3);
  });
}

/** Where a held-up block goes: its outline in dashes. */
function dashed(s: CanvasRenderingContext2D, x: number, y: number, col: string, seed: number) {
  s.fillStyle = col;
  const o = { w: 1, taper: [0.15, 0.15] as [number, number], press: 0.2 };
  for (let k = 0; k < 4; k++) {
    const a = 1.5 + k * 3.6;
    const b = a + 2;
    line(s, x + a, y + 1.5, x + b, y + 1.5, { ...o, seed: seed + k });
    line(s, x + a, y + TILE - 1.5, x + b, y + TILE - 1.5, { ...o, seed: seed + k + 4 });
    line(s, x + 1.5, y + a, x + 1.5, y + b, { ...o, seed: seed + k + 8 });
    line(s, x + TILE - 1.5, y + a, x + TILE - 1.5, y + b, { ...o, seed: seed + k + 12 });
  }
}

/**
 * Panic Button (docs/PARODY.md, panic): a dome button on a plate, its safety cover taped open, and
 * a dashed outline of blocks somewhere near it. Pressed, the dome stays down, the blocks are there,
 * and in the last `warn` frames they blink faster and faster until they're dashes again. A card
 * shows the blocks, which is what you're buying.
 */
defineArt<'button'>({
  type: 'button',
  layer: 1,
  draw(rc, m, d) {
    const s = rc.s;
    const hue = d.style.hue;
    const st = d.o.state;
    const on = !!st && buttonOn(st, d.mi, rc.frame);
    const left = on ? buttonUntil(st, d.mi) - rc.frame : 0;
    const warn = on && left <= m.warn;
    const col: HSL = { h: hue, s: 80, l: 55 };
    const [ox, oy] = d.off;
    m.cells.forEach(([cx, cy], ci) => {
      const x = cx * TILE + ox;
      const y = cy * TILE + oy;
      if (d.o.card || (on && buttonSolid(st, d.mi, rc.frame, ci))) {
        const blink = warn && Math.floor(rc.frame / (left < 20 ? 2 : 5)) % 2 === 0;
        const a0 = s.globalAlpha;
        s.globalAlpha = a0 * (blink ? 0.4 : 1);
        stamp(s, block(hue, (cx * 7 + cy) % 3), x, y);
        s.globalAlpha = a0;
      } else dashed(rc.bg, x, y, css(col, 10, 0.75), cx * 13 + cy);
    });
    // The button, in a frame turned to its face.
    const [fx, fy] = dirOf(m.angle);
    const bx = m.at[0] + ox + fx * (TILE / 2);
    const by = m.at[1] + oy + fy * (TILE / 2);
    const since = st ? rc.frame - st.lastFire : 99;
    const press = on ? 1 : since < 8 ? 1 - since / 8 : 0;
    s.save();
    s.translate(bx, by);
    s.rotate(m.angle + Math.PI / 2);
    stamp(s, mount());
    dome(s, hue, press);
    s.restore();
    if (on) {
      glowDot(rc.g, bx - fx * 3, by - fy * 3, 8, col, warn ? 0.6 : 0.35);
      light(rc, bx - fx * 4, by - fy * 4, 30, col, 0.4);
    }
  },
});
