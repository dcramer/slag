import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { launcherAngle, type Module, type ModuleOf, type PropStyle, type Resolved, rayToWall } from '../../../sim/props';
import { circle, ellipse, glowDot, light, type MetalPalette, metalFill, type RC, rrect, sphereFill } from '../../kit';
import { defineArt, drawBoltShape, drawStar, type PropDrawOpts } from '../common';

type M<T extends Module['type']> = ModuleOf<T>;

function drawLauncher(rc: RC, m: M<'launcher'>, r: Resolved, off: Vec, pal: MetalPalette, st: PropStyle, o: PropDrawOpts) {
  const s = rc.s;
  const g = rc.g;
  const f = rc.frame;
  const x = m.at[0] + off[0];
  const y = m.at[1] + off[1];
  const mi = r.mods.indexOf(m);
  const angle = m.aim === 'track' ? (o.state?.aim.get(mi) ?? m.angle) : launcherAngle(m, f, r.phase);
  const since = o.state ? f - o.state.lastFire : 999;
  const reload = Math.min(1, since / Math.max(1, m.interval * 0.6));
  const glowC: HSL = { h: st.glowHue, s: 95, l: 60 };
  const wood: HSL = { h: st.woodHue, s: 45, l: 38 };
  const recoil = since < 8 ? (8 - since) * 0.5 : 0;

  if (m.aim === 'track' && o.state) {
    // Targeting laser sight.
    const len = o.level ? rayToWall(o.level, x, y, angle, 600, 8) : 60;
    g.strokeStyle = 'rgba(255,40,40,0.35)';
    g.lineWidth = 0.7;
    g.beginPath();
    g.moveTo(x + Math.cos(angle) * 8, y + Math.sin(angle) * 8);
    g.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    g.stroke();
    glowDot(g, x + Math.cos(angle) * len, y + Math.sin(angle) * len, 4, { h: 0, s: 100, l: 55 }, 0.8);
  }

  s.save();
  s.translate(x, y);
  switch (m.style) {
    case 'crossbow':
    case 'ballista': {
      const big = m.style === 'ballista' ? 1.35 : 1;
      s.rotate(angle);
      s.translate(-recoil, 0);
      // Stock.
      s.fillStyle = m.style === 'ballista' ? metalFill(s, pal, -7, -2, 16, 4) : css(wood);
      rrect(s, -7 * big, -1.8 * big, 16 * big, 3.6 * big, 1.2);
      s.fill();
      s.strokeStyle = css(wood, -22);
      s.lineWidth = 0.8;
      s.stroke();
      // Limbs.
      const pull = reload < 1 ? 1 - reload : 0;
      const nock = -2 * big - (1 - pull) * 4 * big;
      s.strokeStyle = m.style === 'ballista' ? css(pal.dark) : css(wood, -10);
      s.lineWidth = 2 * big;
      s.lineCap = 'round';
      s.beginPath();
      s.moveTo(4 * big, -9 * big);
      s.quadraticCurveTo(9 * big, 0, 4 * big, 9 * big);
      s.stroke();
      s.strokeStyle = css(pal.light);
      s.lineWidth = 0.6;
      s.stroke();
      // String.
      s.strokeStyle = 'rgba(235,230,215,0.9)';
      s.lineWidth = 0.6;
      s.beginPath();
      s.moveTo(4 * big, -9 * big);
      s.lineTo(nock, 0);
      s.lineTo(4 * big, 9 * big);
      s.stroke();
      // Loaded bolt.
      if (reload > 0.35) drawBoltShape(s, nock + 1, 0, 12 * big, m.ammo === 'arrow');
      s.fillStyle = css(pal.dark);
      circle(s, 0, 0, 1.6 * big);
      break;
    }
    case 'cannon': {
      // Trunnion base doesn't rotate.
      s.fillStyle = css(pal.dark);
      rrect(s, -6, -1, 12, 7, 2);
      s.fill();
      s.rotate(angle);
      s.translate(-recoil, 0);
      s.fillStyle = metalFill(s, pal, -4, -4.5, 16, 9);
      rrect(s, -4, -4.5, 16, 9, 3);
      s.fill();
      s.strokeStyle = css(pal.dark, -10);
      s.lineWidth = 0.9;
      s.stroke();
      s.fillStyle = css(pal.dark);
      s.fillRect(3, -4.8, 1.6, 9.6);
      s.fillRect(9.5, -5.2, 2.5, 10.4);
      s.fillStyle = '#0c0c10';
      ellipse(s, 12, 0, 1.2, 3.4);
      s.fillStyle = sphereFill(s, -4, 0, 4, pal.base);
      circle(s, -4, 0, 4);
      break;
    }
    case 'totem': {
      // Face carved into the mount; a charging orb hovers at the muzzle.
      s.fillStyle = css(wood, -18);
      rrect(s, -6.5, -7, 13, 3, 1);
      s.fill();
      s.fillStyle = '#120c08';
      s.fillRect(-4.5, -2.5, 3, 2);
      s.fillRect(1.5, -2.5, 3, 2);
      g.fillStyle = css(glowC, 15, 0.4 + reload * 0.6);
      g.save();
      g.translate(x, y);
      g.fillRect(-4.5, -2.5, 3, 2);
      g.fillRect(1.5, -2.5, 3, 2);
      g.restore();
      s.fillStyle = '#120c08';
      rrect(s, -3, 2, 6, 3, 1);
      s.fill();
      const ox = Math.cos(angle) * 11;
      const oy = Math.sin(angle) * 11;
      const orb = 1 + reload * 2.4 + Math.sin(rc.t * 12) * 0.3;
      glowDot(g, x + ox, y + oy, orb * 4, glowC, 0.8 * reload);
      g.fillStyle = css(glowC, 30, reload);
      circle(g, x + ox, y + oy, orb);
      light(rc, x + ox, y + oy, 50, glowC, 0.3 + reload * 0.5);
      break;
    }
    case 'turret': {
      s.fillStyle = sphereFill(s, 0, 0, 6.5, pal.base);
      s.beginPath();
      s.arc(0, 0, 6.5, 0, Math.PI * 2);
      s.fill();
      s.strokeStyle = css(pal.dark);
      s.lineWidth = 0.9;
      s.stroke();
      s.rotate(angle);
      s.translate(-recoil * 0.6, 0);
      for (const dy of [-2, 2]) {
        s.fillStyle = metalFill(s, pal, 2, dy - 1.2, 9, 2.4);
        s.fillRect(3, dy - 1.1, 9, 2.2);
      }
      g.save();
      g.translate(x, y);
      g.rotate(angle);
      g.fillStyle = css(glowC, 10, 0.85);
      circle(g, 1.5, 0, 2);
      g.restore();
      light(rc, x, y, 30, glowC, 0.35);
      break;
    }
    case 'thrower': {
      s.rotate(rc.t * 0.5);
      drawStar(s, 0, 0, 5.5, pal, 1);
      s.rotate(-rc.t * 0.5);
      s.rotate(angle);
      s.fillStyle = css(pal.dark);
      s.fillRect(6, -2.5, 3, 5);
      if (reload > 0.4) {
        s.translate(11, 0);
        s.rotate(rc.t * 18);
        drawStar(s, 0, 0, 3.2, pal, 0);
      }
      break;
    }
  }
  s.restore();
  if (since < 5) {
    const mx = x + Math.cos(angle) * 13;
    const my = y + Math.sin(angle) * 13;
    const fc: HSL = m.style === 'totem' || m.style === 'turret' ? glowC : { h: 40, s: 100, l: 65 };
    glowDot(g, mx, my, 14 - since * 2, fc, 0.9);
    light(rc, mx, my, 80, fc, 1 - since / 5);
  }
}

defineArt<'launcher'>({ type: 'launcher', layer: 2, draw: (rc, m, d) => drawLauncher(rc, m, d.r, d.off, d.pal, d.style, d.o) });
