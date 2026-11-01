import { css, type HSL } from '../../core/color';
import { AMMO } from '../../sim/props';
import type { Projectile } from '../../sim/run';
import { circle, glowDot, light, METALS, type RC, sphereFill } from '../kit';
import { flame } from '../terrain';
import { drawBoltShape, drawStar, type Emit } from './common';

export function drawProjectile(rc: RC, p: Projectile, emit?: Emit) {
  const s = rc.s;
  const g = rc.g;
  const spec = AMMO[p.ammo];
  const a = Math.atan2(p.vy, p.vx);
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
  }
}
