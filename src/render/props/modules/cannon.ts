import { css, type HSL } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { cannonMuzzle, cannonTiming, type ModuleOf } from '../../../sim/props';
import { circle, ellipse, glowDot, light, METALS, metalFill, type RC, rrect, sphereFill } from '../../kit';
import { type DrawCtx, defineArt } from '../common';
import { wheel } from './setpiece';

/**
 * Set-piece guns. The fuse/eye/maw telegraph follows cannonTiming (the
 * sim's own schedule), so the glow peaks exactly when the shot leaves.
 */

type Cannon = ModuleOf<'cannon'>;

/** Frames of visible warning before each volley. */
const FUSE = 48;

function drawCannon(rc: RC, m: Cannon, d: DrawCtx) {
  const s = rc.s;
  const g = rc.g;
  const t = cannonTiming(m, rc.frame, d.r.phase);
  const x = m.at[0] + d.off[0];
  const y = m.at[1] + d.off[1];
  const gy = (Math.floor(m.at[1] / TILE) + 1) * TILE + d.off[1];
  const dir = Math.cos(m.angle) >= 0 ? 1 : -1;
  const warn = t.until <= FUSE && rc.frame >= 30 ? 1 - t.until / FUSE : 0;
  const recoil = t.since < 14 ? (14 - t.since) * 0.35 : 0;
  const [mx, my] = cannonMuzzle(m, d.off[0], d.off[1]);
  const st = d.style;
  const wood: HSL = { h: st.woodHue, s: 42, l: 34 };

  if (m.look === 'castle' || m.look === 'ship') {
    const ship = m.look === 'ship';
    // Carriage.
    s.save();
    s.translate(x, gy);
    s.scale(dir, 1);
    s.fillStyle = 'rgba(0,0,0,0.3)';
    ellipse(s, -6, -0.5, 16, 2);
    s.fillStyle = css(wood);
    s.beginPath();
    s.moveTo(-20, 0);
    s.lineTo(-20, -6);
    s.lineTo(-8, -13);
    s.lineTo(4, -13);
    s.lineTo(6, -4);
    s.lineTo(4, 0);
    s.closePath();
    s.fill();
    s.strokeStyle = css(wood, -20);
    s.lineWidth = 1;
    s.stroke();
    s.strokeStyle = css(wood, -10, 0.7);
    s.lineWidth = 0.6;
    for (let k = 1; k < 4; k++) {
      s.beginPath();
      s.moveTo(-20 + k * 2, -k * 3);
      s.lineTo(5, -k * 3);
      s.stroke();
    }
    // Cannonball pyramid behind (castle) / rope coil (ship).
    if (!ship) {
      for (const [bx, by] of [
        [-17, -2.6],
        [-22, -2.6],
        [-19.5, -6.8],
      ]) {
        s.fillStyle = sphereFill(s, bx, by, 2.6, METALS.obsidian.light, 30, 20);
        circle(s, bx, by, 2.6);
      }
    } else {
      s.strokeStyle = css({ h: 38, s: 35, l: 52 });
      s.lineWidth = 1.2;
      for (let r = 1.5; r < 5; r += 1.3) {
        s.beginPath();
        s.ellipse(-19, -2, r + 1, r * 0.5, 0, 0, Math.PI * 2);
        s.stroke();
      }
    }
    s.restore();
    // Barrel.
    s.save();
    s.translate(x, y);
    s.rotate(m.angle);
    s.translate(-recoil, 0);
    const L = m.length + 2;
    const pal = d.pal;
    s.fillStyle = metalFill(s, pal, -12, -6, L + 12, 12);
    s.beginPath();
    s.moveTo(-11, -5.5);
    s.lineTo(L - 3, -4);
    s.lineTo(L - 3, 4);
    s.lineTo(-11, 5.5);
    s.quadraticCurveTo(-16, 0, -11, -5.5);
    s.fill();
    s.strokeStyle = css(pal.dark, -10);
    s.lineWidth = 1;
    s.stroke();
    for (const bx of [-6, 2, L - 7]) {
      s.fillStyle = css(pal.dark, 4);
      s.fillRect(bx, -5.6, 2.2, 11.2);
      s.fillStyle = css(pal.light, 0, 0.6);
      s.fillRect(bx, -5.6, 2.2, 1.2);
    }
    // Muzzle ring + bore.
    s.fillStyle = metalFill(s, pal, L - 4, -6, 4, 12);
    rrect(s, L - 4, -5.5, 4.5, 11, 1.5);
    s.fill();
    s.fillStyle = '#0b0b0e';
    ellipse(s, L + 0.4, 0, 1.3, 3.6);
    s.fillStyle = sphereFill(s, -15, 0, 3, pal.base);
    circle(s, -15, 0, 3);
    if (ship) {
      s.strokeStyle = css({ h: 38, s: 35, l: 52 });
      s.lineWidth = 0.8;
      s.beginPath();
      s.moveTo(-15, 0);
      s.lineTo(-22, 8);
      s.stroke();
    }
    s.restore();
    // Wheels.
    const wx = x + dir * (ship ? 0 : -1);
    if (ship) {
      for (const k of [-12, 0]) wheel(s, x + dir * k, gy - 3.5, 3.5, 0, { hub: METALS.steel.base, rim: { ...wood, l: 30 }, spokes: 0, tyre: 0, wood: true });
    } else
      wheel(s, wx, gy - 7, 7, Math.sin(t.since * 0.3) * (recoil * 0.05), { hub: METALS.steel.base, rim: { ...wood, l: 40 }, spokes: 8, tyre: 1.4, wood: true });
    // Fuse at the touch hole.
    if (warn > 0) {
      const fx = x - Math.cos(m.angle) * 10;
      const fy = y - 6;
      const fl: HSL = { h: 40, s: 100, l: 62 };
      glowDot(g, fx, fy, 4 + warn * 7, fl, 0.6 + warn * 0.4);
      light(rc, fx, fy, 30 + warn * 30, fl, 0.4 + warn * 0.6);
      if (d.o.emit && Math.random() < 0.3 + warn * 0.5) d.o.emit('spark', fx, fy, (Math.random() - 0.5) * 70, -40 - Math.random() * 50, fl);
    }
  } else if (m.look === 'totem') {
    // Carved idol head; the dart leaves its mouth.
    const stone: HSL = { h: st.hue, s: 22, l: 42 };
    const glowC: HSL = { h: st.glowHue, s: 95, l: 58 };
    const hx = x - dir * 4;
    const top = gy - 27;
    s.fillStyle = 'rgba(0,0,0,0.3)';
    ellipse(s, hx, gy - 0.5, 15, 2);
    s.fillStyle = sphereFill(s, hx + dir * 3, top + 8, 18, stone, 20, 28);
    rrect(s, hx - 12, top, 24, 27, [8, 8, 3, 3]);
    s.fill();
    s.strokeStyle = css(stone, -30);
    s.lineWidth = 1;
    s.stroke();
    // Headdress feathers.
    for (let k = -2; k <= 2; k++) {
      s.save();
      s.translate(hx + k * 4.5, top + 2);
      s.rotate(k * 0.25);
      s.fillStyle = css({ h: [0, 40, 130, 190, 300][(k + 2 + d.r.pp.uid) % 5], s: 75, l: 50 });
      ellipse(s, 0, -6, 2.2, 6.5);
      s.restore();
    }
    s.save();
    s.translate(hx, 0);
    s.scale(dir, 1);
    s.fillStyle = css(stone, -18);
    s.fillRect(-10, top + 6, 20, 2);
    // Brow, eyes, nose, mouth (facing +x).
    s.fillStyle = '#140e0a';
    rrect(s, -3, top + 10, 5, 4, 1);
    s.fill();
    rrect(s, 5, top + 10, 5, 4, 1);
    s.fill();
    s.fillStyle = css(stone, -10);
    rrect(s, 9, top + 13, 4, 6, 1);
    s.fill();
    s.fillStyle = '#140e0a';
    rrect(s, 4, top + 19.5, 9, 4 + warn * 1.5, 1.5);
    s.fill();
    s.fillStyle = css({ h: 45, s: 15, l: 80 });
    for (let k = 0; k < 3; k++) s.fillRect(5 + k * 3, top + 19.5, 1.6, 1.4);
    s.strokeStyle = css(stone, -26, 0.7);
    s.lineWidth = 0.7;
    s.beginPath();
    s.moveTo(-10, top + 17);
    s.lineTo(-4, top + 20);
    s.moveTo(-9, top + 22);
    s.lineTo(-3, top + 24);
    s.stroke();
    s.restore();
    const k = 0.25 + warn * 0.75;
    for (const ex of [-0.5, 7.5]) {
      const px = hx + dir * ex;
      g.fillStyle = css(glowC, 15, k);
      g.fillRect(px - 2, top + 11, 4, 2.4);
      glowDot(g, px, top + 12, 5 + warn * 6, glowC, 0.4 * k + 0.2);
    }
    light(rc, hx + dir * 4, top + 12, 40 + warn * 30, glowC, 0.25 + warn * 0.6);
  } else {
    // Magma spitter: a lumpy basalt mound with a glowing maw.
    const rock: HSL = { h: 260, s: 10, l: 18 };
    const hot: HSL = { h: st.glowHue, s: 100, l: 55 };
    const hx = x - dir * 4;
    s.fillStyle = sphereFill(s, hx - 3, gy - 12, 18, rock, 14, 8);
    s.beginPath();
    s.moveTo(hx - 15, gy);
    s.quadraticCurveTo(hx - 16, gy - 12, hx - 6, gy - 17);
    s.quadraticCurveTo(hx + 2, gy - 22, hx + 9, gy - 14);
    s.quadraticCurveTo(hx + 15, gy - 8, hx + 14, gy);
    s.closePath();
    s.fill();
    s.strokeStyle = css(rock, -8);
    s.lineWidth = 1;
    s.stroke();
    const pulse = 0.3 + warn * 0.7 + Math.sin(rc.t * 5 + d.r.pp.uid) * 0.08;
    g.strokeStyle = css(hot, 0, 0.6 * pulse);
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(hx - 10, gy - 3);
    g.lineTo(hx - 5, gy - 10);
    g.lineTo(hx - 7, gy - 14);
    g.moveTo(hx + 2, gy - 2);
    g.lineTo(hx + 5, gy - 9);
    g.stroke();
    s.fillStyle = '#1a0805';
    ellipse(s, mx - Math.cos(m.angle) * 2, my, 4.2, 3.4 + warn);
    g.fillStyle = css(hot, 10, 0.5 + warn * 0.5);
    ellipse(g, mx - Math.cos(m.angle) * 2, my, 3 + warn, 2.4 + warn);
    glowDot(g, mx, my, 8 + warn * 10, hot, 0.5 + warn * 0.5);
    light(rc, mx, my, 50 + warn * 40, hot, 0.4 + warn * 0.7);
    if (d.o.emit && Math.random() < 0.05 + warn * 0.4) d.o.emit('ember', mx, my, dir * (10 + Math.random() * 30), -30 - Math.random() * 30, hot);
  }
  // Muzzle flash.
  if (t.since < 6) {
    const fc: HSL = m.look === 'totem' ? { h: st.glowHue, s: 95, l: 60 } : { h: 38, s: 100, l: 62 };
    glowDot(g, mx, my, 16 - t.since * 2, fc, 0.95);
    light(rc, mx, my, 90, fc, 1 - t.since / 6);
  }
}

defineArt<'cannon'>({ type: 'cannon', layer: 2, draw: (rc, m, d) => drawCannon(rc, m, d) });
