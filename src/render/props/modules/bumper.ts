import { css, type HSL } from '../../../core/color';
import { BUMPER_FLASH } from '../../../sim/props';
import { ball, INK, ovalPts, part, sprite, stamp } from '../../ink-props';
import { circle, glowDot, light, type MetalPalette } from '../../kit';
import { defineArt } from '../common';

/** Frames the score stays up after a kick. */
const SCORE = 40;

/** A casino bumper, baked: a dark skirt, a lit cap with a ring round its crown, and a jewel on top. */
function bumper(R: number, cap: HSL, pal: MetalPalette) {
  return sprite(`bu|${R.toFixed(2)}|${cap.h | 0}|${pal.dark.h},${pal.dark.l}`, -R - 2, -R - 2, R * 2 + 4, R * 2 + 4, (g) => {
    part(g, ovalPts(0, 0, R, R, 3, 0.02), { ...pal.dark, l: Math.max(18, pal.dark.l) }, 3, { depth: R * 0.1, thin: 0.5, thick: 1.3 });
    part(g, ovalPts(0, -0.2, R * 0.8, R * 0.8, 4, 0.02), cap, 4, { depth: R * 0.12, thin: 0.45, thick: 1 });
    g.fillStyle = css(cap, 22);
    const ring = ovalPts(-0.3, -0.5, R * 0.5, R * 0.5, 5, 0.02, 18);
    g.beginPath();
    ring.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
    g.fill();
    ball(g, -0.3, -0.5, R * 0.28, { h: (cap.h + 180) % 360, s: 70, l: 70 }, 6);
  });
}

/** Pinball bumper: a fat lit cap with a ring of rim lights; it punches out and flashes on a kick, and scores 100. Always 100. */
defineArt<'bumper'>({
  type: 'bumper',
  layer: 2,
  draw(rc, m, d) {
    const s = rc.s;
    const g = rc.g;
    const x = m.at[0] + d.off[0];
    const y = m.at[1] + d.off[1];
    const since = d.o.state ? rc.frame - d.o.state.lastFire : 999;
    const hit = since < BUMPER_FLASH ? 1 - since / BUMPER_FLASH : 0;
    const k = 1 + hit * 0.18;
    const cap: HSL = { h: d.style.hue, s: 80, l: 52 };
    const lit: HSL = { h: d.style.glowHue, s: 100, l: 64 };
    s.save();
    s.translate(x, y);
    s.scale(k, k);
    stamp(s, bumper(m.radius, cap, d.pal));
    s.restore();
    const R = m.radius * k;
    // Rim lights chase around; all blaze on a hit.
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const on = hit > 0 || (Math.floor(rc.t * 8) + i) % 4 === 0;
      g.fillStyle = css(lit, on ? 25 : -10, on ? 0.95 : 0.35);
      circle(g, x + Math.cos(a) * R * 0.9, y + Math.sin(a) * R * 0.9, 0.9);
    }
    glowDot(g, x, y, R * 1.8 + hit * 10, lit, 0.2 + hit * 0.7);
    light(rc, x, y, 30 + hit * 40, lit, 0.35 + hit * 0.8);
    if (since < SCORE) {
      const u = since / SCORE;
      const ty = y - R - 3 - u * 10;
      s.save();
      s.globalAlpha = Math.min(1, (1 - u) * 2.5);
      s.font = 'bold 6px sans-serif';
      s.textAlign = 'center';
      s.textBaseline = 'middle';
      s.fillStyle = INK;
      for (const [ox, oy] of [
        [-0.6, 0],
        [0.6, 0],
        [0, -0.6],
        [0, 0.9],
        [0.6, 0.9],
      ])
        s.fillText('100', x + ox, ty + oy);
      s.fillStyle = '#ffe04a';
      s.fillText('100', x, ty);
      s.restore();
    }
  },
});
