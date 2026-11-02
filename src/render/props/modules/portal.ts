import { css, type HSL } from '../../../core/color';
import { portalPads } from '../../../sim/props';
import { hash2 } from '../../../core/rng';
import { type P, stroke } from '../../ink';
import { part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { glowDot, light } from '../../kit';
import { defineArt } from '../common';

/**
 * A hole torn in the page (docs/PARODY.md, portal): a ragged paper lip round a dark void, a flap curling
 * off one side. Nothing here is solid, so nothing is drawn under it.
 */
function hole(i: number) {
  return sprite(`pt|${i}`, -9, -11, 18, 22, (g) => {
    const seed = 11 + i * 7;
    const rim: P[] = [];
    const lip: P[] = [];
    const n = 26;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      // Torn: every other point bites in or juts out.
      const tear = (k % 2 ? 0.75 : 1.25) + (hash2(k, 1, seed) - 0.5) * 0.9;
      rim.push({ x: Math.cos(a) * (6.2 + tear), y: Math.sin(a) * (8.2 + tear * 1.2) });
      lip.push({ x: Math.cos(a) * (4.2 + (hash2(k, 2, seed) - 0.5) * 0.6), y: Math.sin(a) * (6 + (hash2(k, 3, seed) - 0.5) * 0.8) });
    }
    const paper: HSL = { h: 42, s: 35, l: 90 };
    tone(g, rim, paper, { depth: 0.8, shade: -14 });
    // Ruled lines on the page, the margin in red.
    g.save();
    path(g, rim);
    g.clip();
    for (let ly = -9; ly < 10; ly += 3) tick(g, -9, ly, 9, ly + 0.1, 0.35, ly + seed, 'rgba(90,140,200,0.55)');
    tick(g, -5.6, -10, -5.4, 10, 0.4, seed, 'rgba(210,70,70,0.6)');
    g.restore();
    pen(g, rim, seed, 0.45, 1.1);
    g.fillStyle = '#0c0a14';
    path(g, lip);
    g.fill();
    // The fibrous lip: a paler ring just inside the tear, then ink.
    g.fillStyle = 'rgba(255,250,236,0.9)';
    stroke(g, [...lip.slice(14), ...lip.slice(0, 4)], { w: 0.7, seed, taper: [0.2, 0.2], press: 0.3 });
    pen(g, lip, seed + 3, 0.4, 0.9);
    // A flap of page curling back off the tear.
    const fx = i === 0 ? 5.6 : -5.6;
    part(g, poly(fx, -3, fx + (i === 0 ? 3.4 : -3.4), -4.6, fx + (i === 0 ? 2.2 : -2.2), -0.2), { h: 42, s: 30, l: 80 }, seed + 5, {
      depth: 0.3,
      thin: 0.35,
      thick: 0.7,
    });
  });
}

/**
 * Plot holes: two torn holes with a swirling core, joined by a faint
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
      // The void first, so the paper's torn lip sits over it.
      stamp(s, hole(i), x, y - 0.5);
      // Swirl (opposite spin per pad).
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
