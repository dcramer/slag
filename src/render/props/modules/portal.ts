import { css, type HSL } from '../../../core/color';
import { portalPads } from '../../../sim/props';
import { ellipse, glowDot, light, metalFill, rrect } from '../../kit';
import { defineArt } from '../common';

/**
 * Warp pads: two standing rings with a swirling core, joined by a faint
 * dotted tether so you can always read where a pad goes. Both flare when
 * someone goes through (state.lastFire).
 */
defineArt<'portal'>({
  type: 'portal',
  layer: 2,
  draw(rc, m, d) {
    const s = rc.s;
    const g = rc.g;
    const pads = portalPads(m, d.off);
    const col: HSL = { h: d.style.glowHue, s: 95, l: 62 };
    const since = d.o.state ? rc.frame - d.o.state.lastFire : 999;
    const flare = since < 18 ? 1 - since / 18 : 0;
    // Tether: which pad leads where.
    g.save();
    g.strokeStyle = css(col, 10, d.o.showPath ? 0.55 : 0.14 + flare * 0.5);
    g.lineWidth = d.o.showPath ? 1.2 : 0.8;
    g.setLineDash([2, 4]);
    g.lineDashOffset = -rc.t * 12;
    g.beginPath();
    g.moveTo(pads[0][0], pads[0][1]);
    g.lineTo(pads[1][0], pads[1][1]);
    g.stroke();
    g.restore();
    pads.forEach(([x, y], i) => {
      // Base plate.
      s.fillStyle = metalFill(s, d.pal, x - 7, y + 5, 14, 3);
      rrect(s, x - 7, y + 5, 14, 3, 1);
      s.fill();
      // Ring.
      s.strokeStyle = css(d.pal.dark, -5);
      s.lineWidth = 3;
      s.beginPath();
      s.ellipse(x, y - 0.5, 5.2, 7, 0, 0, Math.PI * 2);
      s.stroke();
      s.strokeStyle = css(d.pal.light);
      s.lineWidth = 1;
      s.stroke();
      // Swirl (opposite spin per pad).
      s.fillStyle = 'rgba(8,6,16,0.85)';
      ellipse(s, x, y - 0.5, 4, 5.8);
      const dir = i === 0 ? 1 : -1;
      g.save();
      g.translate(x, y - 0.5);
      g.scale(1, 1.4);
      for (let k = 0; k < 3; k++) {
        g.strokeStyle = css(col, 15 + k * 10, 0.75 - k * 0.15);
        g.lineWidth = 1;
        g.beginPath();
        g.arc(0, 0, 3.4 - k, rc.t * 5 * dir + k * 2, rc.t * 5 * dir + k * 2 + 3.6);
        g.stroke();
      }
      g.restore();
      glowDot(g, x, y, 9 + flare * 10, col, 0.35 + flare * 0.6);
      light(rc, x, y, 34 + flare * 30, col, 0.5 + flare * 0.6);
      if (flare > 0.5 && d.o.emit) d.o.emit('spark', x, y, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120, col);
    });
  },
});
