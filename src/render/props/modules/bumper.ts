import { css, type HSL } from '../../../core/color';
import { BUMPER_FLASH } from '../../../sim/props';
import { circle, glowDot, light, sphereFill } from '../../kit';
import { defineArt } from '../common';

/** Pinball bumper: a fat lit mushroom cap with a ring of rim lights; it punches out and flashes on a kick. */
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
    const R = m.radius * (1 + hit * 0.18);
    const cap: HSL = { h: d.style.hue, s: 80, l: 52 };
    const lit: HSL = { h: d.style.glowHue, s: 100, l: 64 };
    s.fillStyle = 'rgba(0,0,0,0.3)';
    circle(s, x + 1, y + 1.5, R);
    s.fillStyle = css(d.pal.dark);
    circle(s, x, y, R);
    s.fillStyle = sphereFill(s, x, y, R * 0.82, cap, 30 + hit * 30, 20);
    circle(s, x, y, R * 0.82);
    s.fillStyle = css(cap, 35);
    circle(s, x, y, R * 0.34);
    // Rim lights chase around; all blaze on a hit.
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const on = hit > 0 || (Math.floor(rc.t * 8) + i) % 4 === 0;
      const lx = x + Math.cos(a) * R * 0.92;
      const ly = y + Math.sin(a) * R * 0.92;
      g.fillStyle = css(lit, on ? 25 : -10, on ? 0.95 : 0.35);
      circle(g, lx, ly, 0.9);
    }
    glowDot(g, x, y, R * 1.8 + hit * 10, lit, 0.2 + hit * 0.7);
    light(rc, x, y, 30 + hit * 40, lit, 0.35 + hit * 0.8);
  },
});
