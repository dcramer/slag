import { TILE } from '../../../sim/constants';
import { circle, glowDot, type RC, sphereFill } from '../../kit';
import { defineArt } from '../common';

function drawBomb(rc: RC, x: number, y: number, radius: number) {
  const s = rc.s;
  s.fillStyle = sphereFill(s, x, y + 1, 6.5, { h: 230, s: 15, l: 18 }, 35, 10);
  circle(s, x, y + 1, 6.5);
  s.fillStyle = '#444a55';
  s.fillRect(x + 1.5, y - 6.5, 3.5, 3);
  s.strokeStyle = '#a07040';
  s.lineWidth = 1.2;
  s.beginPath();
  s.moveTo(x + 3.2, y - 6);
  s.quadraticCurveTo(x + 6, y - 11, x + 8.5, y - 8.5);
  s.stroke();
  const fl = 0.7 + Math.sin(rc.t * 30) * 0.3;
  glowDot(rc.g, x + 8.5, y - 8.5, 5 * fl, { h: 40, s: 100, l: 60 }, 1);
  void radius;
}

defineArt<'bomb'>({ type: 'bomb', layer: 2, draw: (rc, m, d) => drawBomb(rc, d.r.pp.tx * TILE + TILE / 2, d.r.pp.ty * TILE + TILE / 2, m.radius) });
