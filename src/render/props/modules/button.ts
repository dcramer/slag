import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { buttonOn, buttonSolid, buttonUntil, dirOf } from '../../../sim/props';
import { line } from '../../ink';
import { boxPts, dot, glint, ovalPts, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { bulb, light } from '../../kit';
import { defineArt } from '../common';

const STEEL: HSL = { h: 215, s: 10, l: 50 };
const COVER = 'rgba(205,232,245,0.55)';
const TAPE: HSL = { h: 48, s: 30, l: 80 };

const HAZARD = '#f2b705';

/**
 * The still parts, in a frame with the face at y = 0 and out toward -y: a bolted plate with hazard stripes
 * down its front, the steel collar the dome sits in, and the clear safety cover flipped back on its hinge
 * and taped open.
 */
function mount() {
  return sprite('btn2', -10.5, -16, 21, 17, (g) => {
    // The cover, flipped back: a clear box on its hinge behind the dome, a strip of tape holding it.
    const cover = poly(-6.6, -4.4, -9, -13.8, -3.4, -15.2, -1.4, -5.6);
    g.fillStyle = COVER;
    path(g, cover);
    g.fill();
    g.fillStyle = 'rgba(160,200,220,0.5)';
    path(g, poly(-3.4, -15.2, -1.4, -5.6, -2.4, -5.4, -4.3, -14.6));
    g.fill();
    pen(g, cover, 4, 0.35, 0.8, 3, '#1d3a4a');
    glint(g, poly(-7.2, -6.4, -8.3, -12.4), 'rgba(255,255,255,0.9)', 0.55);
    part(g, poly(-9.8, -10.6, -2.6, -9, -2.8, -7.3, -10, -8.9), TAPE, 7, { depth: 0.2, shade: -10, thin: 0.25, thick: 0.6 });
    tick(g, -8.6, -9.6, -4, -8.7, 0.25, 8, 'rgba(120,100,60,0.6)');
    // The plate, bolted down, hazard stripes down its front edge.
    const plate = boxPts(-7.8, -2.8, 15.6, 3, 0.8, 2, 0.12);
    part(g, plate, STEEL, 2, { depth: 0.5, shade: -18, thin: 0.45, thick: 1.2 });
    g.save();
    path(g, plate);
    g.clip();
    g.fillStyle = HAZARD;
    for (let x = -9; x < 9; x += 3) {
      path(g, poly(x, 0.4, x + 1.5, 0.4, x + 2.6, -1.6, x + 1.1, -1.6));
      g.fill();
    }
    g.restore();
    for (const x of [-6.3, 6.3]) dot(g, x, -1.9, 0.5, x, '#e6e8ee');
    // The collar the dome sits in.
    part(g, boxPts(-6.2, -4.8, 12.4, 2.3, 0.7, 5, 0.1), { ...STEEL, l: 34 }, 5, { depth: 0.4, shade: -12, thin: 0.4, thick: 1.1 });
    g.fillStyle = css(STEEL, 24);
    line(g, -5.2, -4.2, 4.4, -4.25, { w: 0.45, seed: 6, taper: [0.2, 0.4], press: 0.1 });
  });
}

/** The dome, sunk into its collar by `press` (0 up, 1 down). */
function dome(s: CanvasRenderingContext2D, hue: number, press: number) {
  const h = 5.2 - press * 3.4;
  const pts = ovalPts(0, -4.6, 5.3, h, 3, 0.02, 18).filter((p) => p.y <= -4.4);
  pts.push({ x: 5.3, y: -4.4 }, { x: -5.3, y: -4.4 });
  part(s, pts, { h: hue, s: 82, l: 50 }, 3, { depth: 0.9, shade: -20, thin: 0.45, thick: 1.4 });
  glint(s, poly(-3.2, -5.2 - h * 0.45, -1.6, -4.6 - h * 0.85, 0.8, -4.6 - h * 0.95), 'rgba(255,255,255,0.85)', 0.7);
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
    // On a card the button shares the frame with the blocks it buys, and at true size it vanishes beside them.
    if (d.o.card) s.scale(1.8, 1.8);
    stamp(s, mount());
    dome(s, hue, press);
    s.restore();
    if (on) {
      // Pressed, the dome is lit: a flat lamp, not a halo (it isn't hot).
      bulb(rc.g, bx - fx * 5.4, by - fy * 5.4, 1.9, col, warn ? 0.9 : 0.6);
      light(rc, bx - fx * 4, by - fy * 4, 30, col, 0.4);
    }
  },
});
