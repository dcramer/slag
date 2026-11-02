import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import { DROP_FALL, DROP_REST, DROP_WARN, dirOf, dropperPose, dropperRect, dropperTravel } from '../../../sim/props';
import { circle, glowDot, light, rrect } from '../../kit';
import { defineArt } from '../common';

/**
 * Proximity crusher: a carved stone block with a face. Idle it peers along
 * its lane (faint chevrons show the lane it watches); spotting someone, its
 * eyes flare red and it shakes for the whole telegraph; then it slams with
 * speed streaks. Drawn from the same pose the sim builds its solid from.
 */
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
      const travel = dropperTravel(d.o.level, m);
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
      s.strokeStyle = 'rgba(255,255,255,0.35)';
      s.lineWidth = 1;
      for (let i = 1; i < 4; i++) {
        const lx = x + (w * i) / 4;
        const ly = y + (h * i) / 4;
        s.beginPath();
        if (dy !== 0) {
          s.moveTo(lx, y - dy * 4);
          s.lineTo(lx, y - dy * 14);
        } else {
          s.moveTo(x - dx * 4, ly);
          s.lineTo(x - dx * 14, ly);
        }
        s.stroke();
      }
    }
    s.fillStyle = 'rgba(0,0,0,0.3)';
    s.fillRect(x + 1.5, y + 2.5, w, h);
    const gr = s.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, css(stone, 14));
    gr.addColorStop(1, css(stone, -16));
    s.fillStyle = gr;
    rrect(s, x, y, w, h, 3);
    s.fill();
    s.strokeStyle = css(stone, -32);
    s.lineWidth = 1.6;
    s.stroke();
    // Studs on the slamming face.
    s.fillStyle = css(d.pal.base);
    const n = Math.max(2, Math.round((dy !== 0 ? w : h) / 6));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const fx = dy !== 0 ? x + w * t : dx > 0 ? x + w - 1.5 : x + 1.5;
      const fy = dy !== 0 ? (dy > 0 ? y + h - 1.5 : y + 1.5) : y + h * t;
      circle(s, fx, fy, 1.3);
    }
    // Face: brow, eyes, gritted teeth.
    const cx = x + w / 2;
    const cy = y + h / 2;
    const k = Math.min(w, h) / TILE;
    const angry = warn || p.state === DROP_FALL;
    s.strokeStyle = css(stone, -40);
    s.lineWidth = 1.4;
    s.beginPath();
    s.moveTo(cx - 6 * k, cy - (angry ? 5 : 4) * k);
    s.lineTo(cx - 1.5 * k, cy - (angry ? 2.5 : 4) * k);
    s.moveTo(cx + 6 * k, cy - (angry ? 5 : 4) * k);
    s.lineTo(cx + 1.5 * k, cy - (angry ? 2.5 : 4) * k);
    s.stroke();
    const look = angry ? 0 : Math.sin(rc.t * 0.8 + d.r.pp.uid) * 1.2;
    for (const ex of [-3.6, 3.6]) {
      s.fillStyle = '#120c0c';
      circle(s, cx + ex * k, cy - 0.8 * k, 1.9 * k);
      g.fillStyle = css(eye, 15, angry ? 1 : 0.7);
      circle(g, cx + ex * k + look * k * 0.5, cy - 0.8 * k + dy * 0.6 * k, 1 * k);
    }
    s.fillStyle = '#1a1414';
    s.fillRect(cx - 4.5 * k, cy + 3 * k, 9 * k, 2.4 * k);
    s.fillStyle = css(stone, 30);
    for (let i = 0; i < 4; i++) s.fillRect(cx - 4 * k + i * 2.3 * k, cy + 3.2 * k, 1.4 * k, 2 * k);
    if (angry) {
      glowDot(g, cx, cy - 0.8 * k, 10 * k, eye, 0.35);
      light(rc, cx, cy, 40, eye, 0.5);
    }
  },
});
