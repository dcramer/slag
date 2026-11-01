import { css } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { TILE } from '../../../sim/constants';
import { tileAt } from '../../../sim/level';
import { type Module, type ModuleOf, type PropStyle, type Resolved, swingHeads } from '../../../sim/props';
import { circle, ellipse, light, type MetalPalette, metalFill, type RC, rrect, sphereFill } from '../../kit';
import { defineArt, type PropDrawOpts } from '../common';

type M<T extends Module['type']> = ModuleOf<T>;

function drawSwinger(rc: RC, m: M<'swinger'>, r: Resolved, off: Vec, pal: MetalPalette, st: PropStyle, o: PropDrawOpts) {
  const s = rc.s;
  const f = rc.frame;
  const heads = swingHeads(m, f, r.phase, off);
  const hx = m.hub[0] + off[0];
  const hy = m.hub[1] + off[1];
  for (const h of heads) {
    if (m.arm <= 0) continue;
    if (m.link === 'chain') {
      const n = Math.max(3, Math.floor(m.arm / 4));
      for (let i = 0; i < n; i++) {
        const t0 = (i + 0.5) / n;
        const x = hx + (h.x - hx) * t0;
        const y = hy + (h.y - hy) * t0;
        s.save();
        s.translate(x, y);
        s.rotate(h.a + (i % 2 ? Math.PI / 2 : 0));
        s.strokeStyle = css(pal.dark);
        s.lineWidth = 1.6;
        s.beginPath();
        s.ellipse(0, 0, 2.6, i % 2 ? 1.2 : 1.6, 0, 0, Math.PI * 2);
        s.stroke();
        s.strokeStyle = css(pal.light);
        s.lineWidth = 0.7;
        s.stroke();
        s.restore();
      }
    } else {
      s.lineCap = 'round';
      s.strokeStyle = css(pal.dark, -10);
      s.lineWidth = 4.2;
      s.beginPath();
      s.moveTo(hx, hy);
      s.lineTo(h.x, h.y);
      s.stroke();
      s.strokeStyle = css(pal.base);
      s.lineWidth = 2.4;
      s.stroke();
      s.strokeStyle = css(pal.spec, 0, 0.7);
      s.lineWidth = 0.8;
      s.beginPath();
      s.moveTo(hx, hy - 0.6);
      s.lineTo(h.x, h.y - 0.6);
      s.stroke();
    }
  }
  // Hub.
  s.fillStyle = sphereFill(s, hx, hy, 4.5, pal.base);
  circle(s, hx, hy, 4.5);
  s.strokeStyle = css(pal.dark, -10);
  s.lineWidth = 1;
  s.stroke();
  s.fillStyle = css(pal.dark);
  circle(s, hx, hy, 1.4);

  for (const h of heads) {
    if (m.head === 'saw') drawSaw(rc, h.x, h.y, m.radius, f * 0.45 * m.dir + r.pp.uid, pal, st, o);
    else if (m.head === 'mace') drawMace(rc, h.x, h.y, m.radius, f * 0.03 * m.dir, pal);
    else drawAxe(rc, h.x, h.y, m.radius, h.a, pal);
  }
}

function drawSaw(rc: RC, x: number, y: number, R: number, rot: number, pal: MetalPalette, st: PropStyle, o: PropDrawOpts) {
  const s = rc.s;
  s.save();
  s.translate(x, y);
  // Motion blur ring.
  s.fillStyle = css(pal.light, 0, 0.25);
  circle(s, 0, 0, R + 0.6);
  s.rotate(rot);
  const teeth = Math.max(10, Math.round(R * 1.1));
  s.beginPath();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.55) / teeth) * Math.PI * 2;
    const a2 = ((i + 1) / teeth) * Math.PI * 2;
    s.lineTo(Math.cos(a0) * R * 0.8, Math.sin(a0) * R * 0.8);
    s.lineTo(Math.cos(a1) * R, Math.sin(a1) * R);
    s.lineTo(Math.cos(a2) * R * 0.8, Math.sin(a2) * R * 0.8);
  }
  s.closePath();
  const gr = s.createRadialGradient(-R * 0.3, -R * 0.3, R * 0.1, 0, 0, R);
  gr.addColorStop(0, '#f4f6fa');
  gr.addColorStop(0.6, '#a9afbb');
  gr.addColorStop(1, '#5b616d');
  s.fillStyle = gr;
  s.fill();
  s.strokeStyle = '#3a3e48';
  s.lineWidth = 0.8;
  s.stroke();
  // Inner disc & lightening holes.
  s.fillStyle = metalFill(s, pal, -R * 0.55, -R * 0.55, R * 1.1, R * 1.1, rot);
  circle(s, 0, 0, R * 0.55);
  s.fillStyle = 'rgba(15,15,20,0.75)';
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    circle(s, Math.cos(a) * R * 0.33, Math.sin(a) * R * 0.33, R * 0.11);
  }
  s.fillStyle = css(pal.dark);
  circle(s, 0, 0, R * 0.14);
  if (st.trim === 'stripes') {
    s.strokeStyle = 'rgba(250,200,40,0.9)';
    s.lineWidth = 1.2;
    s.beginPath();
    s.arc(0, 0, R * 0.62, 0, Math.PI * 2);
    s.stroke();
  }
  s.restore();
  // Sparks when the blade grinds terrain.
  if (o.emit && o.level) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = x + Math.cos(a) * (R + 1);
      const py = y + Math.sin(a) * (R + 1);
      if (tileAt(o.level, Math.floor(px / TILE), Math.floor(py / TILE)) && Math.random() < 0.5) {
        const ta = a + Math.PI / 2;
        o.emit('spark', px, py, Math.cos(ta) * 160 + (Math.random() - 0.5) * 60, Math.sin(ta) * 160 - 40, { h: 40, s: 100, l: 65 });
        light(rc, px, py, 30, { h: 35, s: 100, l: 60 }, 0.6);
      }
    }
  }
}

function drawMace(rc: RC, x: number, y: number, R: number, rot: number, pal: MetalPalette) {
  const s = rc.s;
  s.save();
  s.translate(x, y);
  s.rotate(rot);
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    s.fillStyle = i % 2 ? '#c9ced8' : '#9aa1ad';
    s.beginPath();
    s.moveTo(Math.cos(a - 0.22) * R * 0.75, Math.sin(a - 0.22) * R * 0.75);
    s.lineTo(Math.cos(a) * R * 1.32, Math.sin(a) * R * 1.32);
    s.lineTo(Math.cos(a + 0.22) * R * 0.75, Math.sin(a + 0.22) * R * 0.75);
    s.fill();
  }
  s.restore();
  s.fillStyle = sphereFill(s, x, y, R * 0.85, pal.dark.l < 15 ? pal.base : { ...pal.dark, l: pal.dark.l + 10 }, 35, 15);
  circle(s, x, y, R * 0.85);
  s.strokeStyle = 'rgba(0,0,0,0.5)';
  s.lineWidth = 0.8;
  s.stroke();
  s.fillStyle = 'rgba(255,255,255,0.55)';
  ellipse(s, x - R * 0.3, y - R * 0.35, R * 0.22, R * 0.14, -0.6);
}

function drawAxe(rc: RC, x: number, y: number, R: number, a: number, pal: MetalPalette) {
  const s = rc.s;
  s.save();
  s.translate(x, y);
  s.rotate(a);
  // Local: arm points +x; blade is a crescent across the arm end.
  const gr = s.createLinearGradient(-R * 0.3, 0, R * 0.9, 0);
  gr.addColorStop(0, css(pal.dark));
  gr.addColorStop(0.5, '#b8bec9');
  gr.addColorStop(0.85, '#eef1f6');
  gr.addColorStop(1, '#ffffff');
  s.fillStyle = gr;
  s.beginPath();
  s.moveTo(-R * 0.2, -R * 0.35);
  s.quadraticCurveTo(R * 0.4, -R * 1.3, R * 0.95, -R * 1.05);
  s.quadraticCurveTo(R * 1.35, 0, R * 0.95, R * 1.05);
  s.quadraticCurveTo(R * 0.4, R * 1.3, -R * 0.2, R * 0.35);
  s.closePath();
  s.fill();
  s.strokeStyle = '#3b3f49';
  s.lineWidth = 0.9;
  s.stroke();
  s.strokeStyle = 'rgba(255,255,255,0.9)';
  s.lineWidth = 0.7;
  s.beginPath();
  s.moveTo(R * 0.95, -R * 1.0);
  s.quadraticCurveTo(R * 1.3, 0, R * 0.95, R * 1.0);
  s.stroke();
  s.fillStyle = css(pal.dark);
  rrect(s, -R * 0.35, -R * 0.4, R * 0.5, R * 0.8, 1.5);
  s.fill();
  s.restore();
}

defineArt<'swinger'>({ type: 'swinger', layer: 2, draw: (rc, m, d) => drawSwinger(rc, m, d.r, d.off, d.pal, d.style, d.o) });
