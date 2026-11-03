import { css, type HSL } from '../../../core/color';
import { BUMPER_FLASH } from '../../../sim/props';
import { inkFor, type P, stroke } from '../../ink';
import { ovalPts, part, path, sprite, stamp } from '../../ink-props';
import { circle, light, type MetalPalette } from '../../kit';
import { defineArt } from '../common';

/** Frames the score stays up after a kick. */
const SCORE = 40;
/** The score's gold, outlined in a dark of itself. */
const SCORE_GOLD: HSL = { h: 50, s: 100, l: 65 };

/**
 * A pinball pop bumper, baked: a dark skirt, a white rubber ring round it, a lit cap with a crown ring,
 * and the star on top that every table has.
 */
function bumper(R: number, cap: HSL, pal: MetalPalette) {
  return sprite(`bu|${R.toFixed(2)}|${cap.h | 0}|${pal.dark.h},${pal.dark.l}`, -R - 2, -R - 2, R * 2 + 4, R * 2 + 4, (g) => {
    part(g, ovalPts(0, 0, R, R, 3, 0.02), { ...pal.dark, l: Math.max(18, pal.dark.l) }, 3, { depth: R * 0.1, thin: 0.5, thick: 1.3 });
    // The rubber: a pale band just inside the skirt's rim.
    g.fillStyle = 'rgb(236 230 218)';
    stroke(g, ovalPts(-0.2, -0.2, R * 0.86, R * 0.86, 8, 0.02, 28), { w: Math.max(0.9, R * 0.12), seed: 8, taper: [0, 0], press: 0.15 });
    part(g, ovalPts(0, -0.2, R * 0.72, R * 0.72, 4, 0.02), cap, 4, { depth: R * 0.12, thin: 0.45, thick: 1 });
    g.fillStyle = css(cap, 22);
    path(g, ovalPts(-0.3, -0.5, R * 0.5, R * 0.5, 5, 0.02, 18));
    g.fill();
    // The star, a dark of the cap under it so it reads as a decal and not a hole.
    const star: P[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = (i % 2 ? 0.17 : 0.4) * R;
      star.push({ x: -0.3 + Math.cos(a) * r, y: -0.5 + Math.sin(a) * r });
    }
    g.fillStyle = inkFor(cap);
    path(
      g,
      star.map((p) => ({ x: p.x + 0.35, y: p.y + 0.4 })),
    );
    g.fill();
    g.fillStyle = css({ h: (cap.h + 180) % 360, s: 80, l: 72 });
    path(g, star);
    g.fill();
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
    light(rc, x, y, 24 + hit * 36, lit, 0.25 + hit * 0.8);
    if (since < SCORE) {
      const u = since / SCORE;
      const ty = y - R - 3 - u * 10;
      s.save();
      s.globalAlpha = Math.min(1, (1 - u) * 2.5);
      s.font = 'bold 6px sans-serif';
      s.textAlign = 'center';
      s.textBaseline = 'middle';
      s.fillStyle = inkFor(SCORE_GOLD);
      for (const [ox, oy] of [
        [-0.6, 0],
        [0.6, 0],
        [0, -0.6],
        [0, 0.9],
        [0.6, 0.9],
      ])
        s.fillText('100', x + ox, ty + oy);
      s.fillStyle = css(SCORE_GOLD);
      s.fillText('100', x, ty);
      s.restore();
    }
  },
});
