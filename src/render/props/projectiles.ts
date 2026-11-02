import { css, type HSL } from '../../core/color';
import { TILE } from '../../sim/constants';
import { AMMO, CLUSTER_FUSE, FACE, GLIDER_CRUISE, GLIDER_H, GLIDER_W, PATCH_FRAMES, PATCH_PX, patchRect } from '../../sim/props';
import type { Projectile } from '../../sim/run';
import { circle, ellipse, glowDot, light, METALS, type RC, rrect, sphereFill } from '../kit';
import { flame } from '../terrain';
import { drawBoltShape, drawStar, type Emit } from './common';

export function drawProjectile(rc: RC, p: Projectile, emit?: Emit) {
  const s = rc.s;
  const g = rc.g;
  const spec = AMMO[p.ammo];
  const a = Math.atan2(p.vy, p.vx);
  if (p.stuck >= 0) return drawPatch(rc, p);
  switch (p.ammo) {
    case 'bolt':
    case 'arrow':
      s.save();
      s.translate(p.x, p.y);
      s.rotate(a);
      drawBoltShape(s, -10, 0, 10, p.ammo === 'arrow');
      s.restore();
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06);
      g.stroke();
      break;
    case 'cannonball':
      s.fillStyle = sphereFill(s, p.x, p.y, spec.radius, { h: 230, s: 10, l: 22 }, 40, 10);
      circle(s, p.x, p.y, spec.radius);
      if (emit && Math.random() < 0.5) emit('smoke', p.x, p.y, -p.vx * 0.1, -p.vy * 0.1);
      break;
    case 'fireball': {
      const col: HSL = { h: 25, s: 100, l: 58 };
      glowDot(g, p.x, p.y, 12, col, 0.7);
      g.fillStyle = 'rgba(255,250,220,0.95)';
      circle(g, p.x, p.y, 2.5);
      flame(g, p.x - p.vx * 0.02, p.y - p.vy * 0.02, 3, 7, col, rc.t);
      light(rc, p.x, p.y, 60, col, 0.9);
      if (emit && Math.random() < 0.6) emit('ember', p.x, p.y, -p.vx * 0.2 + (Math.random() - 0.5) * 30, -p.vy * 0.2 - 20, col);
      break;
    }
    case 'plasma': {
      const col: HSL = { h: 190, s: 100, l: 60 };
      g.strokeStyle = css(col, 0, 0.5);
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05);
      g.stroke();
      glowDot(g, p.x, p.y, 8, col, 0.9);
      g.fillStyle = '#fff';
      circle(g, p.x, p.y, 1.8);
      light(rc, p.x, p.y, 45, col, 0.7);
      break;
    }
    case 'shuriken':
      s.save();
      s.translate(p.x, p.y);
      s.rotate(rc.t * 25);
      drawStar(s, 0, 0, 4.5, METALS.steel, 0);
      s.restore();
      g.strokeStyle = 'rgba(255,255,255,0.15)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(p.x, p.y, 4, 0, Math.PI * 2);
      g.stroke();
      break;
    case 'seeker': {
      // Slow missile with a hunting red eye and a smoky exhaust: dodge it, lure it into walls.
      s.save();
      s.translate(p.x, p.y);
      s.rotate(a);
      s.fillStyle = '#d9dde5';
      rrect(s, -6, -2, 9, 4, 1.5);
      s.fill();
      s.fillStyle = '#c8312f';
      s.beginPath();
      s.moveTo(3, -2);
      s.lineTo(6.5, 0);
      s.lineTo(3, 2);
      s.fill();
      s.fillStyle = '#5f646e';
      s.fillRect(-6, -3.4, 2.5, 6.8);
      s.restore();
      const red: HSL = { h: 0, s: 100, l: 55 };
      glowDot(g, p.x + Math.cos(a) * 4, p.y + Math.sin(a) * 4, 6, red, 0.55 + Math.sin(rc.t * 20) * 0.25);
      flame(g, p.x - Math.cos(a) * 7, p.y - Math.sin(a) * 7, 1.6, 4, { h: 35, s: 100, l: 60 }, rc.t);
      light(rc, p.x, p.y, 40, red, 0.6);
      if (emit && Math.random() < 0.6) emit('smoke', p.x - Math.cos(a) * 7, p.y - Math.sin(a) * 7, -p.vx * 0.2, -p.vy * 0.2 - 10);
      break;
    }
    case 'boomerang':
      drawBoomerang(s, p.x, p.y, rc.t * 22, 5.5);
      g.strokeStyle = 'rgba(255,255,255,0.14)';
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
      g.stroke();
      break;
    case 'rubber':
      s.fillStyle = sphereFill(s, p.x, p.y, spec.radius, { h: 330, s: 85, l: 58 }, 30, 25);
      circle(s, p.x, p.y, spec.radius);
      s.strokeStyle = 'rgba(255,255,255,0.5)';
      s.lineWidth = 0.8;
      s.beginPath();
      s.arc(p.x, p.y, spec.radius * 0.6, -2.4, -1.2);
      s.stroke();
      break;
    case 'cluster': {
      const age = rc.frame - p.born;
      const blink = Math.floor(age / Math.max(2, 8 - (age / CLUSTER_FUSE) * 6)) % 2 === 0;
      s.save();
      s.translate(p.x, p.y);
      s.rotate(a);
      s.fillStyle = sphereFill(s, 0, 0, spec.radius, { h: 90, s: 15, l: 30 }, 30, 20);
      ellipse(s, 0, 0, spec.radius + 1.5, spec.radius);
      s.strokeStyle = '#1b1d18';
      s.lineWidth = 0.7;
      s.beginPath();
      s.moveTo(-1.5, -spec.radius);
      s.lineTo(-1.5, spec.radius);
      s.moveTo(1.5, -spec.radius);
      s.lineTo(1.5, spec.radius);
      s.stroke();
      s.restore();
      if (blink) glowDot(g, p.x, p.y - 1, 5, { h: 10, s: 100, l: 55 }, 0.9);
      break;
    }
    case 'shrapnel': {
      const col: HSL = { h: 35, s: 100, l: 62 };
      g.strokeStyle = css(col, 10, 0.8);
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      g.stroke();
      glowDot(g, p.x, p.y, 4, col, 0.8);
      break;
    }
    case 'goo': {
      const goo: HSL = { h: 105, s: 75, l: 45 };
      const st = 1 + Math.min(0.5, Math.hypot(p.vx, p.vy) / 600);
      s.save();
      s.translate(p.x, p.y);
      s.rotate(a);
      s.fillStyle = sphereFill(s, 0, 0, spec.radius, goo, 25, 20);
      ellipse(s, -1, 0, spec.radius * st, spec.radius / st);
      s.restore();
      s.fillStyle = 'rgba(255,255,255,0.5)';
      circle(s, p.x - 1, p.y - 1.5, 1);
      break;
    }
    case 'frost': {
      const ice: HSL = { h: 195, s: 95, l: 72 };
      s.save();
      s.translate(p.x, p.y);
      s.rotate(a);
      s.fillStyle = css(ice, 10, 0.95);
      s.beginPath();
      s.moveTo(5, 0);
      s.lineTo(0, -2.4);
      s.lineTo(-5, 0);
      s.lineTo(0, 2.4);
      s.closePath();
      s.fill();
      s.strokeStyle = 'rgba(255,255,255,0.8)';
      s.lineWidth = 0.6;
      s.stroke();
      s.restore();
      glowDot(g, p.x, p.y, 8, ice, 0.6);
      light(rc, p.x, p.y, 40, ice, 0.5);
      if (emit && Math.random() < 0.4) emit('spark', p.x, p.y, -p.vx * 0.1, -p.vy * 0.1, ice);
      break;
    }
    case 'ricochet': {
      const col: HSL = { h: 300, s: 100, l: 65 };
      g.strokeStyle = css(col, 0, 0.55);
      g.lineWidth = 2.5;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(p.x, p.y);
      g.lineTo(p.x - p.vx * 0.06, p.y - p.vy * 0.06);
      g.stroke();
      glowDot(g, p.x, p.y, 7, col, 0.9);
      g.fillStyle = '#fff';
      circle(g, p.x, p.y, 1.5);
      // Pips: bounces left.
      for (let i = 0; i < p.n; i++) {
        g.fillStyle = css(col, 20, 0.8);
        circle(g, p.x - 4 + i * 4, p.y - 6, 0.8);
      }
      light(rc, p.x, p.y, 40, col, 0.6);
      break;
    }
    case 'glider': {
      const age = rc.frame - p.born;
      // Tilt nose-down as it sinks; streamers flutter when it's about to go.
      const tilt = Math.max(-0.05, Math.min(0.3, p.vy / 250)) * Math.sign(p.vx || 1);
      drawGlider(s, p.x, p.y, tilt, (p.owner * 70 + 30) % 360, rc.t, age > GLIDER_CRUISE);
      void GLIDER_H;
      break;
    }
  }
}

/** A spinning V-shaped wooden boomerang. */
export function drawBoomerang(s: CanvasRenderingContext2D, x: number, y: number, rot: number, R: number) {
  s.save();
  s.translate(x, y);
  s.rotate(rot);
  s.strokeStyle = '#4a2f18';
  s.lineWidth = 3.4;
  s.lineCap = 'round';
  s.beginPath();
  s.moveTo(-R, R * 0.55);
  s.quadraticCurveTo(0, -R * 0.7, R, R * 0.55);
  s.stroke();
  s.strokeStyle = '#c89150';
  s.lineWidth = 2.2;
  s.stroke();
  s.strokeStyle = '#e6402f';
  s.lineWidth = 2.2;
  s.beginPath();
  s.moveTo(-R * 0.15, -R * 0.1);
  s.lineTo(R * 0.15, -R * 0.1);
  s.stroke();
  s.restore();
}

/**
 * Rideable glider: a plank deck (exactly the GLIDER_W × GLIDER_H solid,
 * centered on x, y) under a striped canvas wing, with a tail streamer.
 */
export function drawGlider(s: CanvasRenderingContext2D, x: number, y: number, tilt: number, hue: number, t: number, tired = false) {
  s.save();
  s.translate(x, y);
  s.rotate(tilt);
  const w = GLIDER_W;
  const h = GLIDER_H;
  // Wing (behind and above the deck).
  s.fillStyle = `hsla(${hue},70%,${tired ? 45 : 58}%,0.95)`;
  s.beginPath();
  s.moveTo(-w / 2 - 2, -h / 2);
  s.quadraticCurveTo(0, -h / 2 - 10, w / 2 + 3, -h / 2 - 1);
  s.lineTo(w / 2 - 4, -h / 2);
  s.closePath();
  s.fill();
  s.strokeStyle = 'rgba(255,255,255,0.6)';
  s.lineWidth = 0.7;
  for (const k of [-0.25, 0.1, 0.4]) {
    s.beginPath();
    s.moveTo(k * w, -h / 2);
    s.lineTo(k * w + 2, -h / 2 - 7 + Math.abs(k) * 6);
    s.stroke();
  }
  // Deck.
  s.fillStyle = '#7a5130';
  rrect(s, -w / 2, -h / 2, w, h, 1.5);
  s.fill();
  s.fillStyle = 'rgba(255,230,190,0.35)';
  s.fillRect(-w / 2 + 1, -h / 2 + 0.6, w - 2, 1);
  s.strokeStyle = '#3e2714';
  s.lineWidth = 0.8;
  s.strokeRect(-w / 2, -h / 2, w, h);
  // Tail streamer.
  s.strokeStyle = `hsla(${(hue + 40) % 360},90%,60%,0.9)`;
  s.lineWidth = 1.2;
  s.beginPath();
  s.moveTo(-w / 2, 0);
  for (let i = 1; i <= 4; i++) s.lineTo(-w / 2 - i * 3, Math.sin(t * (tired ? 20 : 10) + i) * (tired ? 2.4 : 1.2));
  s.stroke();
  s.restore();
}

/** A goo/frost shot stuck to a terrain face: the coat the sim builds, fading out near the end. */
function drawPatch(rc: RC, p: Projectile) {
  const s = rc.s;
  const g = rc.g;
  const r = patchRect(p.hx, p.hy, p.stuck, PATCH_PX + 0.5);
  const left = p.until - rc.frame;
  const fade = Math.min(1, left / 40);
  const born = Math.min(1, (PATCH_FRAMES - left) / 6);
  const [dx, dy] = FACE[p.stuck];
  if (p.ammo === 'goo') {
    s.fillStyle = `rgba(80,170,40,${0.9 * fade})`;
    s.fillRect(r.x, r.y, r.w, r.h);
    s.fillStyle = `rgba(150,230,90,${0.6 * fade})`;
    for (let i = 0; i < 3; i++) {
      const u = (i + 0.5) / 3;
      const bx = dy !== 0 ? r.x + r.w * u : r.x + r.w / 2;
      const by = dx !== 0 ? r.y + r.h * u : r.y + r.h / 2;
      circle(s, bx, by, 1.6 * born);
    }
    if (dy >= 0) {
      // Drips hang off ceilings and walls.
      const k = (rc.t * 0.7 + p.id * 0.37) % 1;
      s.fillStyle = `rgba(80,170,40,${0.8 * fade})`;
      ellipse(s, r.x + r.w * 0.6, r.y + r.h + k * 3, 1, 1 + k * 2);
    }
  } else {
    s.fillStyle = `rgba(190,235,255,${0.85 * fade})`;
    s.fillRect(r.x, r.y, r.w, r.h);
    s.strokeStyle = `rgba(255,255,255,${0.8 * fade})`;
    s.lineWidth = 0.6;
    s.beginPath();
    s.moveTo(r.x + 1, r.y + r.h / 2);
    s.lineTo(r.x + r.w - 1, r.y + r.h / 2);
    s.stroke();
    glowDot(g, r.x + r.w / 2, r.y + r.h / 2, TILE * 0.6, { h: 195, s: 90, l: 70 }, 0.18 * fade);
  }
}
