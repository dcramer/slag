import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { DROP_FALL, DROP_REST, DROP_WARN, dirOf, dropperPose, dropperRect, dropperTravel } from '../../../sim/props';
import { blob, line, stroke } from '../../ink';
import { boxPts, dot, INK, part, path, poly, sprite, stamp, tick } from '../../ink-props';
import { circle, glowDot, light } from '../../kit';
import { beamOf, defineArt } from '../common';

/**
 * Proximity crusher: a carved stone block with a face. Idle it peers along
 * its lane (faint chevrons show the lane it watches); spotting someone, its
 * eyes flare red and it shakes for the whole telegraph; then it slams with
 * speed streaks. Drawn from the same pose the sim builds its solid from.
 */
/**
 * The block, baked: carved stone, a heavy brow (angry or just brooding), white eyes that the pupils are
 * drawn into live, gritted teeth, and a vein standing out on its brow.
 */
function grudge(w: number, h: number, stone: HSL, angry: boolean) {
  return sprite(`dr|${w}|${h}|${stone.h | 0}|${angry}`, -2, -2, w + 4, h + 4, (g) => {
    const body = boxPts(0, 0, w, h, 2.6, 5, 0.2);
    part(g, body, stone, 5, { depth: 1.4, thin: 0.6, thick: 1.6 });
    g.save();
    path(g, body);
    g.clip();
    for (let i = 0; i < 6; i++) {
      const tx = 2 + hash2(i, 1, w) * (w - 4);
      const ty = 2 + hash2(i, 2, h) * (h - 4);
      tick(g, tx, ty, tx + 1.6, ty + 0.8, 0.45, i, css(stone, -20, 1, 4));
    }
    g.restore();
    const cx = w / 2;
    const cy = h / 2;
    const k = Math.min(w, h) / TILE;
    for (const sg of [-1, 1]) {
      g.fillStyle = INK;
      blob(g, cx + sg * 3.6 * k, cy - 0.6 * k, 2.2 * k, 7 + sg, 0.85, 0.06);
      g.fill();
      g.fillStyle = '#f3ecdc';
      blob(g, cx + sg * 3.6 * k, cy - 0.6 * k, 1.6 * k, 9 + sg, 0.85, 0.06);
      g.fill();
      // The brow: knitted down to the middle when it's coming.
      g.fillStyle = INK;
      line(g, cx + sg * 6.2 * k, cy - (angry ? 5.2 : 4.2) * k, cx + sg * 1.2 * k, cy - (angry ? 2.4 : 3.8) * k, {
        w: 1.5 * k,
        seed: 11 + sg,
        taper: [0.1, 0.2],
        press: 0.2,
      });
    }
    // The vein: a forked purple line standing out on its forehead.
    g.fillStyle = '#8a2a6a';
    stroke(g, poly(cx + 3 * k, cy - 7.2 * k, cx + 3.9 * k, cy - 6.1 * k, cx + 3.4 * k, cy - 5.4 * k), { w: 0.7 * k, seed: 13, taper: [0.2, 0.3], press: 0.2 });
    stroke(g, poly(cx + 3.9 * k, cy - 6.1 * k, cx + 5 * k, cy - 6.4 * k), { w: 0.55 * k, seed: 14, taper: [0.1, 0.5], press: 0.2 });
    // Gritted teeth.
    g.fillStyle = INK;
    path(g, boxPts(cx - 4.8 * k, cy + 2.8 * k, 9.6 * k, 2.8 * k, 0.8, 15));
    g.fill();
    g.fillStyle = css(stone, 34);
    for (let i = 0; i < 4; i++) g.fillRect(cx - 4.2 * k + i * 2.3 * k, cy + 3.15 * k, 1.5 * k, 2.1 * k);
  });
}

defineArt<'dropper'>({
  type: 'dropper',
  layer: 1,
  draw(rc, m, d) {
    const s = rc.s;
    const g = rc.g;
    const p = dropperPose(d.o.state, d.mi, rc.frame);
    const [dx, dy] = dirOf(m.angle);
    const base = dropperRect(m, d.off[0], d.off[1]);
    const warn = p.state === DROP_WARN;
    const shake = warn ? (hash2(rc.frame, d.mi, d.r.pp.uid) - 0.5) * 2.4 : 0;
    const x = base.x + dx * p.d + shake;
    const y = base.y + dy * p.d;
    const { w, h } = base;
    const stone: HSL = { h: d.style.hue, s: 10, l: 46 };
    const eye: HSL = warn || p.state === DROP_FALL ? { h: 0, s: 100, l: 58 } : { h: 50, s: 90, l: 62 };
    // Lane chevrons (where it will land).
    if (p.state !== DROP_FALL && p.state !== DROP_REST) {
      const travel = beamOf(d.o, d.r, d.mi)?.len ?? dropperTravel(d.o.level, m);
      g.strokeStyle = css(eye, 0, warn ? 0.5 : 0.12);
      g.lineWidth = 1;
      for (let k = TILE * 0.8; k < travel; k += TILE) {
        const cx = base.x + base.w / 2 + dx * (k + (dx > 0 ? base.w / 2 : dx < 0 ? -base.w / 2 : 0));
        const cy = base.y + base.h / 2 + dy * (k + (dy > 0 ? base.h / 2 : dy < 0 ? -base.h / 2 : 0));
        g.beginPath();
        g.moveTo(cx - dy * 4 - dx * 2, cy - dx * 4 - dy * 2);
        g.lineTo(cx + dx * 2, cy + dy * 2);
        g.lineTo(cx + dy * 4 - dx * 2, cy + dx * 4 - dy * 2);
        g.stroke();
      }
    }
    if (p.state === DROP_FALL) {
      s.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 1; i < 4; i++) {
        const lx = x + (w * i) / 4;
        const ly = y + (h * i) / 4;
        if (dy !== 0) line(s, lx, y - dy * 4, lx, y - dy * 14, { w: 1, seed: i, taper: [0.1, 0.8], press: 0 });
        else line(s, x - dx * 4, ly, x - dx * 14, ly, { w: 1, seed: i, taper: [0.1, 0.8], press: 0 });
      }
    }
    const angry = warn || p.state === DROP_FALL;
    stamp(s, grudge(w, h, stone, angry), x, y);
    // Studs on the slamming face: that's the side that hurts.
    const n = Math.max(2, Math.round((dy !== 0 ? w : h) / 6));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const fx = dy !== 0 ? x + w * t : dx > 0 ? x + w - 1.6 : x + 1.6;
      const fy = dy !== 0 ? (dy > 0 ? y + h - 1.6 : y + 1.6) : y + h * t;
      dot(s, fx, fy, 1.05, i, css(d.pal.light));
    }
    // Its eyes follow whoever's nearest.
    const cx = x + w / 2;
    const cy = y + h / 2;
    const k = Math.min(w, h) / TILE;
    let lx = 0;
    let ly = 0;
    let best = Infinity;
    for (const r of d.o.runners ?? []) {
      const dd = (r.x - cx) ** 2 + (r.y - 6 - cy) ** 2;
      if (dd < best) {
        best = dd;
        lx = r.x - cx;
        ly = r.y - 6 - cy;
      }
    }
    const ll = Math.hypot(lx, ly) || 1;
    const px = best < Infinity ? (lx / ll) * 0.9 * k : Math.sin(rc.t * 0.8 + d.r.pp.uid) * 0.6 * k;
    const py = best < Infinity ? (ly / ll) * 0.7 * k : 0;
    s.fillStyle = angry ? '#d0141f' : INK;
    for (const ex of [-3.6, 3.6]) circle(s, cx + ex * k + px, cy - 0.6 * k + py, (angry ? 0.95 : 0.8) * k);
    if (angry) {
      g.fillStyle = css(eye, 15, 1);
      for (const ex of [-3.6, 3.6]) circle(g, cx + ex * k + px, cy - 0.6 * k + py, 0.6 * k);
      glowDot(g, cx, cy - 0.8 * k, 10 * k, eye, 0.35);
      light(rc, cx, cy, 40, eye, 0.5);
    }
  },
});
