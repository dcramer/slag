import { css, type HSL } from '../../../core/color';
import type { LauncherStyle, PropStyle } from '../../../sim/props';
import { circle, ellipse, glowDot, light, type MetalPalette, metalFill, type RC, rrect, sphereFill } from '../../kit';
import { drawBoomerang, drawGlider } from '../projectiles';

/**
 * Art for the newer launcher styles. Called by the launcher art with the
 * albedo context already translated to the mount; `angle` is the aim and
 * `reload` 0..1 how loaded it is (a round shows once it's past ~0.4).
 */
export function drawExtraLauncher(rc: RC, style: LauncherStyle, x: number, y: number, angle: number, reload: number, pal: MetalPalette, st: PropStyle): void {
  const s = rc.s;
  const g = rc.g;
  const glowC: HSL = { h: st.glowHue, s: 95, l: 60 };
  const wood: HSL = { h: st.woodHue, s: 45, l: 38 };
  const ready = reload > 0.4;
  switch (style) {
    case 'rocket': {
      s.rotate(angle);
      s.fillStyle = metalFill(s, pal, -6, -6, 13, 12);
      rrect(s, -6, -6, 13, 12, 2);
      s.fill();
      s.strokeStyle = css(pal.dark, -10);
      s.lineWidth = 0.8;
      s.stroke();
      for (const oy of [-3.5, 0, 3.5]) {
        s.fillStyle = '#121216';
        circle(s, 6.5, oy, 1.6);
        if (ready && oy === 0) {
          s.fillStyle = '#d33a2c';
          s.beginPath();
          s.moveTo(6, -1.4);
          s.lineTo(10, 0);
          s.lineTo(6, 1.4);
          s.fill();
        }
      }
      s.rotate(-angle);
      // Seeker eye: it hunts once fired.
      g.fillStyle = css({ h: 0, s: 100, l: 55 }, 10, 0.5 + reload * 0.5);
      circle(g, x, y - 1, 1.3);
      glowDot(g, x, y - 1, 5, { h: 0, s: 100, l: 55 }, 0.4 * reload);
      break;
    }
    case 'glaive': {
      s.rotate(angle);
      s.fillStyle = css(wood, -10);
      rrect(s, -6, -2, 12, 4, 1.5);
      s.fill();
      s.strokeStyle = css(wood, -28);
      s.lineWidth = 0.7;
      s.stroke();
      s.fillStyle = css(pal.dark);
      circle(s, -3, 0, 1.6);
      if (ready) drawBoomerang(s, 6, 0, rc.t * 2, 5);
      break;
    }
    case 'gumball': {
      s.fillStyle = css({ h: st.hue, s: 75, l: 42 });
      rrect(s, -6, 1, 12, 7, 2);
      s.fill();
      s.fillStyle = 'rgba(200,230,255,0.35)';
      circle(s, 0, -3, 6);
      const cols = [330, 50, 190, 120, 280];
      for (let i = 0; i < 5; i++) {
        s.fillStyle = css({ h: cols[i], s: 90, l: 60 });
        circle(s, -3 + (i % 3) * 3, -1 - Math.floor(i / 3) * 3 - (i === 4 ? 2 : 0), 1.6);
      }
      s.fillStyle = 'rgba(255,255,255,0.6)';
      ellipse(s, -2.5, -6, 1.8, 1);
      s.rotate(angle);
      s.fillStyle = css(pal.dark);
      s.fillRect(5, -2, 4, 4);
      break;
    }
    case 'mortar': {
      s.fillStyle = css(pal.dark);
      rrect(s, -7, 2, 14, 5, 1.5);
      s.fill();
      s.rotate(angle);
      s.fillStyle = metalFill(s, pal, -3, -5, 12, 10);
      rrect(s, -3, -5, 12, 10, 2);
      s.fill();
      s.fillStyle = css(pal.dark);
      s.fillRect(7.5, -5.5, 2, 11);
      s.fillStyle = '#0c0c10';
      ellipse(s, 9.5, 0, 1.2, 4);
      if (ready) {
        s.fillStyle = css({ h: 10, s: 80, l: 50 });
        circle(s, 9.5, 0, 2.2);
      }
      break;
    }
    case 'gooper': {
      const goo: HSL = { h: 105, s: 75, l: 45 };
      s.fillStyle = sphereFill(s, -1, 0, 6, goo, 25, 20);
      circle(s, -1, 0, 6);
      s.strokeStyle = css(pal.dark);
      s.lineWidth = 1.2;
      s.stroke();
      s.fillStyle = 'rgba(255,255,255,0.45)';
      ellipse(s, -3, -3, 1.8, 1);
      s.rotate(angle);
      s.fillStyle = metalFill(s, pal, 3, -2, 8, 4);
      s.fillRect(3, -2, 8, 4);
      if (ready) {
        s.fillStyle = css(goo, 10);
        ellipse(s, 11, 0.5, 1.6, 2.2);
      }
      break;
    }
    case 'cryo': {
      const ice: HSL = { h: 195, s: 90, l: 70 };
      s.rotate(angle);
      s.fillStyle = metalFill(s, pal, -5, -4.5, 15, 9);
      rrect(s, -5, -4.5, 15, 9, 3);
      s.fill();
      for (const cx of [-1, 2.5, 6]) {
        s.fillStyle = css(ice, -10);
        s.fillRect(cx, -5, 1.6, 10);
      }
      s.fillStyle = css(pal.dark);
      s.fillRect(9, -3.5, 2, 7);
      s.rotate(-angle);
      const mx = x + Math.cos(angle) * 11;
      const my = y + Math.sin(angle) * 11;
      glowDot(g, mx, my, 3 + reload * 4, ice, 0.4 + reload * 0.5);
      light(rc, mx, my, 30, ice, 0.3 + reload * 0.4);
      break;
    }
    case 'prism': {
      s.fillStyle = css(pal.dark);
      rrect(s, -6, 3, 12, 4, 1.5);
      s.fill();
      s.rotate(angle);
      const gr = s.createLinearGradient(-5, -6, 6, 6);
      gr.addColorStop(0, css(glowC, 30, 0.95));
      gr.addColorStop(1, css(glowC, -20, 0.9));
      s.fillStyle = gr;
      s.beginPath();
      s.moveTo(7, 0);
      s.lineTo(-4, -6);
      s.lineTo(-4, 6);
      s.closePath();
      s.fill();
      s.strokeStyle = 'rgba(255,255,255,0.7)';
      s.lineWidth = 0.6;
      s.stroke();
      s.rotate(-angle);
      glowDot(g, x + Math.cos(angle) * 6, y + Math.sin(angle) * 6, 4 + reload * 5, glowC, 0.5 + reload * 0.4);
      light(rc, x, y, 35, glowC, 0.4);
      break;
    }
    case 'hangar': {
      // A little shed with a launch rail; a glider waits on top when loaded.
      s.fillStyle = css(wood, -8);
      s.fillRect(-7, -3, 14, 10);
      s.fillStyle = css(wood, -25);
      s.beginPath();
      s.moveTo(-8, -3);
      s.lineTo(0, -7.5);
      s.lineTo(8, -3);
      s.fill();
      s.fillStyle = '#140e0a';
      s.fillRect(-4, 1, 8, 6);
      s.rotate(angle);
      s.fillStyle = css(pal.base);
      s.fillRect(4, 5.5, 6, 1.5);
      s.rotate(-angle);
      if (ready) {
        s.save();
        s.scale(0.45, 0.45);
        drawGlider(s, 0, -22, 0, st.hue, rc.t);
        s.restore();
      }
      break;
    }
    default:
      break;
  }
}

/**
 * Tracking sensor: a swivelling red eye on top of the mount that looks where
 * the launcher aims. Every tracker has one, so tracking reads at a glance.
 */
export function drawTrackerEye(rc: RC, x: number, y: number, angle: number, pal: MetalPalette): void {
  const s = rc.s;
  const g = rc.g;
  const ex = x - 4;
  const ey = y - 7.5;
  s.fillStyle = css(pal.dark, -10);
  s.fillRect(ex - 0.6, ey + 1.5, 1.2, 3);
  s.fillStyle = sphereFill(s, ex, ey, 2.6, pal.base, 30, 25);
  circle(s, ex, ey, 2.6);
  const px = ex + Math.cos(angle) * 1.1;
  const py = ey + Math.sin(angle) * 1.1;
  const red: HSL = { h: 0, s: 100, l: 55 };
  s.fillStyle = '#1a0606';
  circle(s, px, py, 1.3);
  g.fillStyle = css(red, 20, 0.95);
  circle(g, px, py, 0.8);
  glowDot(g, px, py, 4.5, red, 0.6 + Math.sin(rc.t * 6) * 0.15);
}
