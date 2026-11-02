import { css, type HSL } from '../../../core/color';
import { barrelAim, DIR8, dirDelta } from '../../../sim/props';
import { circle, glowDot, light, type RC, rrect } from '../../kit';
import { defineArt } from '../common';

/** Smoothstep-eased angle (radians) the barrel shows; it's settled (and can fire) exactly when the sim's turn reaches 1. */
function shownAngle(from: number, dir: number, turn: number): number {
  const u = turn * turn * (3 - 2 * turn);
  return ((from + dirDelta(from, dir) * u) * Math.PI) / 4;
}

/**
 * Launch barrel: a banded wooden cask on a pivot pointing the way it'll
 * fire, with a dotted aim line once it's settled. Pipes (one direction)
 * are drawn as an iron tube.
 */
defineArt<'barrel'>({
  type: 'barrel',
  layer: 2,
  draw(rc: RC, m, d) {
    const s = rc.s;
    const g = rc.g;
    const x = m.at[0] + d.off[0];
    const y = m.at[1] + d.off[1];
    const aim = barrelAim(m, rc.frame, d.r.phase);
    const a = shownAngle(aim.from, aim.dir, aim.turn);
    const since = d.o.state ? rc.frame - d.o.state.lastFire : 999;
    const kick = since < 8 ? (8 - since) * 0.5 : 0;
    const pipe = m.dirs.length <= 1;
    const wood: HSL = { h: d.style.woodHue, s: 50, l: 36 };
    const glow: HSL = { h: 45, s: 100, l: 62 };
    if (aim.turn >= 1) {
      const [dx, dy] = DIR8[aim.dir];
      g.strokeStyle = css(glow, 10, 0.35);
      g.lineWidth = 1;
      g.setLineDash([2, 3]);
      g.beginPath();
      g.moveTo(x + dx * 10, y + dy * 10);
      g.lineTo(x + dx * 30, y + dy * 30);
      g.stroke();
      g.setLineDash([]);
    }
    // Pivot.
    s.fillStyle = css(d.pal.dark);
    circle(s, x, y, 3);
    s.save();
    s.translate(x, y);
    s.rotate(a);
    s.translate(-kick, 0);
    if (pipe) {
      s.fillStyle = css(d.pal.base, -6);
      rrect(s, -7, -5.5, 15, 11, 2);
      s.fill();
      s.fillStyle = css(d.pal.light, 0, 0.5);
      s.fillRect(-6, -4.5, 13, 1.5);
      s.fillStyle = css(d.pal.dark);
      s.fillRect(6, -6.5, 3, 13);
    } else {
      s.fillStyle = css(wood);
      rrect(s, -7.5, -6.5, 15, 13, 4);
      s.fill();
      s.strokeStyle = css(wood, -22);
      s.lineWidth = 0.8;
      s.stroke();
      for (const k of [-2.5, 0, 2.5]) {
        s.strokeStyle = css(wood, -14, 0.7);
        s.lineWidth = 0.5;
        s.beginPath();
        s.moveTo(-7, k);
        s.lineTo(7, k);
        s.stroke();
      }
      s.fillStyle = css(d.pal.base);
      s.fillRect(-4.5, -6.8, 1.6, 13.6);
      s.fillRect(3, -6.8, 1.6, 13.6);
      s.fillStyle = css(d.pal.dark, -8);
      rrect(s, 6.5, -5, 2.5, 10, 1);
      s.fill();
    }
    s.fillStyle = '#0a0806';
    s.beginPath();
    s.ellipse(8.2, 0, 1.2, 4, 0, 0, Math.PI * 2);
    s.fill();
    s.restore();
    // Ready light: lit while settled.
    glowDot(g, x, y, aim.turn >= 1 ? 6 : 3, glow, aim.turn >= 1 ? 0.5 : 0.15);
    if (since < 6) {
      const [dx, dy] = DIR8[aim.dir];
      glowDot(g, x + dx * 12, y + dy * 12, 14 - since * 2, glow, 0.9);
      light(rc, x + dx * 12, y + dy * 12, 70, glow, 1 - since / 6);
    }
  },
});
