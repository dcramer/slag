import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { DROP_FALL, DROP_REST, DROP_WARN, dirOf, dropperPose, dropperRect, dropperTravel } from '../../../sim/props';
import { blob, line, stroke } from '../../ink';
import { boxPts, dot, INK, part, path, pen, poly, sprite, stamp, tick, tone } from '../../ink-props';
import { circle, glowDot, light } from '../../kit';
import { beamOf, defineArt } from '../common';
import { bevel } from '../machine';

/**
 * Proximity crusher: a carved stone block with a face. Idle it peers along
 * its lane (faint chevrons show the lane it watches); spotting someone, its
 * eyes flare red and it shakes for the whole telegraph; then it slams with
 * speed streaks. Drawn from the same pose the sim builds its solid from.
 */
/**
 * The block, baked: a dressed stone with chiselled bevels round a raised face, so it reads as a carved
 * mass and not a tile. On the face, a heavy brow cut as its own stone (knitted down when it's coming),
 * white eyes that the pupils are drawn into live, gritted teeth, a chipped corner and a vein standing out.
 */
function grudge(w: number, h: number, stone: HSL, angry: boolean) {
  return sprite(`dr|${w}|${h}|${stone.h | 0}|${angry}`, -2, -2, w + 4, h + 4, (g) => {
    const body = boxPts(0, 0, w, h, 2.6, 5, 0.2);
    tone(g, body, stone, { depth: 1, shade: -14 });
    const k = Math.min(w, h) / TILE;
    const b = 2.7 * k;
    g.save();
    path(g, body);
    g.clip();
    bevel(g, 0, 0, w, h, b, stone);
    // A rim of stone teeth round the face: the angry crushing block's spiked edge, cut inside its own
    // outline so the hitbox stays the block. Each tooth is lit on the side facing the light.
    const teeth = (ax: number, ay: number, bx: number, by: number, nx: number, ny: number, lit: number) => {
      const len = Math.hypot(bx - ax, by - ay);
      const n = Math.max(2, Math.round(len / (4.2 * k)));
      const ux = (bx - ax) / n;
      const uy = (by - ay) / n;
      for (let i = 0; i < n; i++) {
        const x0 = ax + ux * i;
        const y0 = ay + uy * i;
        const tip = { x: x0 + ux / 2 + nx * b * 0.9, y: y0 + uy / 2 + ny * b * 0.9 };
        const mid = { x: x0 + ux / 2, y: y0 + uy / 2 };
        g.fillStyle = css(stone, lit + 8);
        path(g, [{ x: x0, y: y0 }, tip, mid]);
        g.fill();
        g.fillStyle = css(stone, lit - 14, 1, 4);
        path(g, [mid, tip, { x: x0 + ux, y: y0 + uy }]);
        g.fill();
        g.fillStyle = INK;
        stroke(g, [{ x: x0, y: y0 }, tip, { x: x0 + ux, y: y0 + uy }], { w: 0.4 * k + 0.15, seed: i + nx * 3 + ny * 7, taper: [0.1, 0.1], press: 0.2 });
      }
    };
    teeth(b, b, w - b, b, 0, -1, 10);
    teeth(w - b, h - b, b, h - b, 0, 1, -14);
    teeth(b, h - b, b, b, -1, 0, 4);
    teeth(w - b, b, w - b, h - b, 1, 0, -8);
    // A chipped corner, top right.
    g.fillStyle = css(stone, -26, 1, 6);
    path(g, poly(w - 4.2 * k, -1, w + 1, -1, w + 1, 3.6 * k, w - 1.4 * k, 1.4 * k));
    g.fill();
    for (let i = 0; i < 4; i++) {
      const tx = b + 1 + hash2(i, 1, w) * (w - b * 2 - 2);
      const ty = b + 1 + hash2(i, 2, h) * (h - b * 2 - 2);
      if (Math.abs(tx - w / 2) < 6 * k && Math.abs(ty - h / 2) < 5 * k) continue;
      tick(g, tx, ty, tx + 1.4, ty + 0.7, 0.45, i, css(stone, -22, 1, 4));
    }
    g.restore();
    pen(g, body, 5, 0.6, 1.7);
    const cx = w / 2;
    const cy = h / 2;
    for (const sg of [-1, 1]) {
      g.fillStyle = INK;
      blob(g, cx + sg * 3.6 * k, cy - 0.4 * k, 2.3 * k, 7 + sg, 0.85, 0.06);
      g.fill();
      g.fillStyle = '#f3ecdc';
      blob(g, cx + sg * 3.6 * k, cy - 0.4 * k, 1.7 * k, 9 + sg, 0.85, 0.06);
      g.fill();
    }
    // The brow: one heavy stone across both eyes, knitted down to the middle when it's coming.
    const drop = angry ? 2.6 : 0.6;
    const brow = poly(
      cx - 6.8 * k,
      cy - 4.4 * k,
      cx - 1.2 * k,
      cy - (3.6 - drop) * k,
      cx,
      cy - (3.1 - drop) * k,
      cx + 1.2 * k,
      cy - (3.6 - drop) * k,
      cx + 6.8 * k,
      cy - 4.4 * k,
      cx + 6.6 * k,
      cy - 6 * k,
      cx,
      cy - (5.6 - drop * 0.7) * k,
      cx - 6.6 * k,
      cy - 6 * k,
    );
    part(g, brow, { ...stone, l: stone.l + 6 }, 12, { depth: 0.7, thin: 0.6, thick: 1.4, shade: -22 });
    // The vein: a forked purple line standing out on its forehead.
    g.fillStyle = '#8a2a6a';
    stroke(g, poly(cx + 3 * k, cy - 7.6 * k, cx + 3.9 * k, cy - 6.9 * k, cx + 3.4 * k, cy - 6.3 * k), { w: 0.7 * k, seed: 13, taper: [0.2, 0.3], press: 0.2 });
    stroke(g, poly(cx + 3.9 * k, cy - 6.9 * k, cx + 5 * k, cy - 7.2 * k), { w: 0.55 * k, seed: 14, taper: [0.1, 0.5], press: 0.2 });
    // Gritted teeth.
    g.fillStyle = INK;
    path(g, boxPts(cx - 4.6 * k, cy + 2.6 * k, 9.2 * k, 3 * k, 0.9, 15));
    g.fill();
    g.fillStyle = css(stone, 36);
    for (let i = 0; i < 4; i++) g.fillRect(cx - 4 * k + i * 2.2 * k, cy + 3 * k, 1.5 * k, 2.2 * k);
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
    for (const ex of [-3.6, 3.6]) circle(s, cx + ex * k + px, cy - 0.4 * k + py, (angry ? 0.95 : 0.8) * k);
    if (angry) {
      g.fillStyle = css(eye, 15, 1);
      for (const ex of [-3.6, 3.6]) circle(g, cx + ex * k + px, cy - 0.4 * k + py, 0.6 * k);
      glowDot(g, cx, cy - 0.8 * k, 10 * k, eye, 0.35);
      light(rc, cx, cy, 40, eye, 0.5);
    }
  },
});
