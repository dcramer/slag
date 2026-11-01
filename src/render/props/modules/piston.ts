import { css } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { TILE } from '../../../sim/constants';
import { dirOf, type Module, type ModuleOf, pistonHead, pistonState, type Resolved } from '../../../sim/props';
import { hazardStripes, METALS, type MetalPalette, metalFill, type RC, rrect } from '../../kit';
import { defineArt } from '../common';

type M<T extends Module['type']> = ModuleOf<T>;

function drawPistonShaft(rc: RC, m: M<'piston'>, r: Resolved, off: Vec, pal: MetalPalette) {
  const st = pistonState(m, rc.frame, r.phase);
  const head = pistonHead(m, st.ext, off);
  const [dx, dy] = dirOf(m.angle);
  const s = rc.s;
  const fx = m.at[0] + off[0] + dx * TILE * 0.5;
  const fy = m.at[1] + off[1] + dy * TILE * 0.5;
  const hx = head.x + head.w / 2;
  const hy = head.y + head.h / 2;
  const w = 4;
  s.save();
  s.translate(fx, fy);
  s.rotate(m.angle);
  const len = Math.hypot(hx - fx, hy - fy);
  s.fillStyle = metalFill(s, METALS.steel, 0, -w / 2, len, w, Math.PI / 2);
  s.fillRect(0, -w / 2, len, w);
  s.fillStyle = 'rgba(255,255,255,0.35)';
  s.fillRect(0, -w / 2 + 0.6, len, 0.8);
  s.restore();
  void pal;
}

function drawPistonHead(rc: RC, m: M<'piston'>, r: Resolved, off: Vec, pal: MetalPalette) {
  const st = pistonState(m, rc.frame, r.phase);
  const head = pistonHead(m, st.ext, off);
  const s = rc.s;
  const [dx, dy] = dirOf(m.angle);
  if (st.slamming) {
    s.fillStyle = 'rgba(255,255,255,0.12)';
    s.fillRect(head.x - dx * 10, head.y - dy * 10, head.w + Math.abs(dx) * 10, head.h + Math.abs(dy) * 10);
  }
  s.fillStyle = metalFill(s, pal, head.x, head.y, head.w, head.h, dx !== 0 ? Math.PI / 2 : 0);
  rrect(s, head.x, head.y, head.w, head.h, 1.5);
  s.fill();
  s.strokeStyle = css(pal.dark, -10);
  s.lineWidth = 1;
  s.stroke();
  // Teeth on the striking face.
  s.fillStyle = '#c3c8d2';
  const n = Math.max(2, Math.round(Math.max(head.w, head.h) / 4));
  for (let i = 0; i < n; i++) {
    const t0 = (i + 0.5) / n;
    s.beginPath();
    if (dy !== 0) {
      const bx = head.x + head.w * t0;
      const by = dy > 0 ? head.y + head.h : head.y;
      s.moveTo(bx - 1.8, by);
      s.lineTo(bx, by + dy * 3);
      s.lineTo(bx + 1.8, by);
    } else {
      const by = head.y + head.h * t0;
      const bx = dx > 0 ? head.x + head.w : head.x;
      s.moveTo(bx, by - 1.8);
      s.lineTo(bx + dx * 3, by);
      s.lineTo(bx, by + 1.8);
    }
    s.fill();
  }
  hazardStripes(
    s,
    dy !== 0 ? head.x + 1 : head.x + head.w / 2 - 1.5,
    dy !== 0 ? head.y + head.h / 2 - 1.5 : head.y + 1,
    dy !== 0 ? head.w - 2 : 3,
    dy !== 0 ? 3 : head.h - 2,
    0.8,
  );
}

defineArt<'piston'>({ type: 'piston', layer: 0, draw: (rc, m, d) => drawPistonShaft(rc, m, d.r, d.off, d.pal) });
defineArt<'piston'>({ type: 'piston', layer: 2, draw: (rc, m, d) => drawPistonHead(rc, m, d.r, d.off, d.pal) });
