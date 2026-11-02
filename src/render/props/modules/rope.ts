import { clamp } from '../../../core/geom';
import { css, type HSL, mixHsl } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { openSky, ropeStrain } from '../../../sim/props';
import { circle, glowDot, light, type RC } from '../../kit';
import { defineArt, gripOf } from '../common';

const LINK = 9;
const MEAT: HSL = { h: 12, s: 62, l: 33 };
const SEARED: HSL = { h: 4, s: 92, l: 52 };
const TWINE = '#e6d6b4';
const INK = '#120b08';

/** One sausage: a fat round-capped stroke, an ink edge and a shine down its side. */
function sausage(s: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number, c: HSL) {
  s.lineCap = 'round';
  s.strokeStyle = INK;
  s.lineWidth = w + 1.2;
  s.beginPath();
  s.moveTo(x0, y0);
  s.lineTo(x1, y1);
  s.stroke();
  s.strokeStyle = css(c);
  s.lineWidth = w;
  s.stroke();
  s.strokeStyle = css(c, 20, 0.8);
  s.lineWidth = 1;
  s.beginPath();
  s.moveTo(x0 - w * 0.18, y0);
  s.lineTo(x1 - w * 0.18, y1);
  s.stroke();
}

/** The butcher's hook it hangs from: a plate on a ceiling, or a string running up out of the level under open sky. */
function hook(rc: RC, x: number, y: number, sky: boolean) {
  const s = rc.s;
  if (sky) {
    s.lineCap = 'butt';
    for (const [style, width] of [
      [INK, 1.8],
      [TWINE, 0.8],
    ] as const) {
      s.strokeStyle = style;
      s.lineWidth = width;
      s.beginPath();
      s.moveTo(x, y + 1);
      s.lineTo(x, 0);
      s.stroke();
    }
  } else {
    s.fillStyle = INK;
    s.fillRect(x - 4.5, y - 1, 9, 2.6);
    s.fillStyle = '#8d8a92';
    s.fillRect(x - 3.5, y - 0.6, 7, 1.5);
  }
  s.lineCap = 'round';
  s.strokeStyle = INK;
  s.lineWidth = 2.6;
  s.beginPath();
  s.arc(x + 1.5, y + 3.6, 1.8, Math.PI, Math.PI * 2.4);
  s.stroke();
  s.strokeStyle = '#c9c6cc';
  s.lineWidth = 1.3;
  s.stroke();
}

/**
 * A rope of sausages on a butcher's hook. Idle it sways a touch; held it goes
 * taut to the rider and the rest trails behind. Strain thins the links and
 * sears them until it snaps, and a snapped rope grows back link by link.
 */
defineArt<'rope'>({
  type: 'rope',
  layer: 2,
  draw(rc, m, d) {
    const s = rc.s;
    const g = rc.g;
    const ax = m.at[0] + d.off[0];
    const ay = m.at[1] + d.off[1];
    const grip = gripOf(d);
    const sway = grip ? 0 : Math.sin(rc.t * 1.4 + d.r.phase * 6.28) * 1.8;
    const n = Math.max(2, Math.round(m.length / LINK));
    const left = d.o.broken && d.o.state ? d.o.state.brokenUntil - rc.frame : 0;
    const shown = left > 0 ? clamp(Math.ceil(n * (1 - left / m.regrow)), 1, n) : n;
    const heat = grip ? ropeStrain(m.strain, grip.t) : 0;
    const w = 5.6 - heat * 2.2;
    const c = mixHsl(MEAT, SEARED, heat);
    const k = grip ? Math.min(1, grip.len / m.length) : 1;
    const pt = (u: number): [number, number] => {
      if (!grip) return [ax + sway * u * u, ay + m.length * u];
      if (u <= k) return [ax + grip.x * (u / k), ay + grip.y * (u / k)];
      // Past the rider the end trails, hanging back from the way they're going.
      const tail = (u - k) * m.length;
      return [ax + grip.x - grip.s * 0.03 * (tail / 8), ay + grip.y + tail];
    };
    const sky = !!d.o.level && openSky(d.o.level, d.o.placed ?? [], Math.floor(ax / TILE), Math.floor(ay / TILE));
    hook(rc, ax, ay, sky);
    for (let i = 0; i < shown; i++) {
      const [x0, y0] = pt((i + 0.24) / n);
      const [x1, y1] = pt((i + 0.76) / n);
      sausage(s, x0, y0, x1, y1, w, c);
      const [tx, ty] = pt((i + 1) / n);
      if (i < shown - 1) {
        s.fillStyle = INK;
        circle(s, tx, ty, 1.5);
        s.fillStyle = TWINE;
        circle(s, tx, ty, 0.9);
      }
    }
    if (heat > 0) {
      const [x, y] = pt(k * 0.5);
      glowDot(g, x, y, 10 + heat * 8, SEARED, 0.2 + heat * 0.5);
      light(rc, x, y, 26, SEARED, heat * 0.7);
    }
  },
});
