import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import type { Module, ModuleOf, PropStyle, Resolved } from '../../../sim/props';
import { hand } from '../../ink';
import { inkWood } from '../../ink-parts';
import { circle, ellipse, glowDot, hazardStripes, light, type MetalPalette, metalFill, type RC, rivet, sphereFill } from '../../kit';
import { bbox, bodyPath, cornerRadii, defineArt, type PropDrawOpts } from '../common';

type M<T extends Module['type']> = ModuleOf<T>;

function drawBody(rc: RC, m: M<'body'>, st: PropStyle, pal: MetalPalette, off: Vec, r: Resolved, o: PropDrawOpts) {
  const s = rc.s;
  const g = rc.g;
  const t = rc.t;
  const f = rc.frame;
  const set = new Set(m.cells.map(([x, y]) => `${x},${y}`));
  let shake = 0;
  if (m.material === 'crumble') {
    if (o.broken) {
      s.save();
      s.strokeStyle = 'rgba(255,255,255,0.18)';
      s.setLineDash([2, 3]);
      s.stroke(bodyPath(m.cells, off, 3, 1.5));
      s.restore();
      return;
    }
    const trig = o.state && o.state.triggerFrame >= 0 ? (f - o.state.triggerFrame) / Math.max(1, m.breakFrames) : 0;
    shake = trig ? Math.sin(f * 2.7) * trig * 1.6 : 0;
    if (trig && o.emit && Math.random() < 0.3) {
      const c = m.cells[Math.floor(Math.random() * m.cells.length)];
      o.emit('debris', (c[0] + Math.random()) * TILE + off[0], (c[1] + 1) * TILE + off[1], (Math.random() - 0.5) * 20, 10, { h: 32, s: 45, l: 50 });
    }
  }
  const O: Vec = [off[0] + shake, off[1]];
  const path = bodyPath(m.cells, O, 4);
  const bb = bbox(m.cells, O);
  // Contact shadow.
  s.fillStyle = 'rgba(0,0,0,0.25)';
  s.save();
  s.translate(1.5, 2.5);
  s.fill(path);
  s.restore();

  const outline = (c: string, w = 2.4) => {
    s.lineJoin = 'round';
    s.strokeStyle = c;
    s.lineWidth = w;
    s.stroke(path);
  };

  switch (m.material) {
    case 'metal': {
      outline(css(pal.dark, -8));
      s.fillStyle = metalFill(s, pal, bb.x, bb.y, bb.w, bb.h);
      s.fill(path);
      s.save();
      s.clip(path);
      // Panel seams + bevels.
      for (const [x, y] of m.cells) {
        const px = x * TILE + O[0];
        const py = y * TILE + O[1];
        s.fillStyle = css(pal.light, 0, 0.35);
        s.fillRect(px + 1, py + 1, TILE - 2, 1);
        s.fillStyle = css(pal.dark, 0, 0.5);
        s.fillRect(px + 1, py + TILE - 2, TILE - 2, 1);
        if (st.trim === 'rivets' || st.trim === 'gems') {
          rivet(s, px + 3, py + 3, pal);
          rivet(s, px + TILE - 3, py + 3, pal);
          rivet(s, px + 3, py + TILE - 3, pal);
          rivet(s, px + TILE - 3, py + TILE - 3, pal);
        }
        if (st.trim === 'stripes' && !set.has(`${x},${y - 1}`)) hazardStripes(s, px, py + 1, TILE, 3.5);
      }
      s.restore();
      if (st.trim === 'gems' || st.trim === 'runes') {
        const glowC: HSL = { h: st.glowHue, s: 95, l: 60 };
        const pulse = 0.7 + 0.3 * Math.sin(t * 3 + r.pp.uid);
        for (const [x, y] of m.cells) {
          const cx = (x + 0.5) * TILE + O[0];
          const cy = (y + 0.5) * TILE + O[1];
          if (st.trim === 'gems') {
            s.fillStyle = css(glowC, -25);
            s.beginPath();
            s.moveTo(cx, cy - 3.5);
            s.lineTo(cx + 3, cy);
            s.lineTo(cx, cy + 3.5);
            s.lineTo(cx - 3, cy);
            s.fill();
            g.fillStyle = css(glowC, 10, 0.8 * pulse);
            g.beginPath();
            g.moveTo(cx, cy - 3);
            g.lineTo(cx + 2.4, cy);
            g.lineTo(cx, cy + 3);
            g.lineTo(cx - 2.4, cy);
            g.fill();
          } else {
            g.strokeStyle = css(glowC, 10, 0.75 * pulse);
            g.lineWidth = 1;
            g.beginPath();
            const k = hash2(x, y, r.pp.uid);
            g.moveTo(cx - 3, cy - 3);
            g.lineTo(cx + (k > 0.5 ? 3 : 0), cy);
            g.lineTo(cx - 3, cy + 3);
            g.moveTo(cx + 2, cy - 3.5);
            g.lineTo(cx + 2, cy + 3.5);
            g.stroke();
          }
          glowDot(g, cx, cy, 8, glowC, 0.25 * pulse);
        }
        const c = bb;
        light(rc, c.x + c.w / 2, c.y + c.h / 2, 45, glowC, 0.4 * pulse);
      }
      break;
    }
    case 'stone': {
      const base: HSL = { h: st.hue, s: 12, l: 48 };
      outline(css(base, -30));
      const gr = s.createLinearGradient(0, bb.y, 0, bb.y + bb.h);
      gr.addColorStop(0, css(base, 14));
      gr.addColorStop(1, css(base, -14));
      s.fillStyle = gr;
      s.fill(path);
      s.save();
      s.clip(path);
      for (const [x, y] of m.cells) {
        for (let i = 0; i < 6; i++) {
          const k = hash2(x * 7 + i, y * 13, r.pp.uid);
          s.fillStyle = css(base, k > 0.5 ? 10 : -12, 0.6);
          circle(s, x * TILE + O[0] + 2 + hash2(i, x, y) * 12, y * TILE + O[1] + 2 + hash2(y, i, x) * 12, 0.6 + k);
        }
        if (!set.has(`${x},${y - 1}`)) {
          s.fillStyle = css(base, 22, 0.6);
          s.fillRect(x * TILE + O[0], y * TILE + O[1], TILE, 2);
        }
      }
      s.restore();
      break;
    }
    case 'wood': {
      const base: HSL = { h: st.woodHue, s: 45, l: 38 };
      outline(css(base, -24));
      s.fillStyle = css(base);
      s.fill(path);
      s.save();
      s.clip(path);
      if (hand.on) {
        inkWood(s, m.cells, O, st.woodHue, r.pp.uid + 3);
        s.restore();
        break;
      }
      for (let y = bb.y; y < bb.y + bb.h; y += 5.33) {
        const gr = s.createLinearGradient(0, y, 0, y + 5.33);
        gr.addColorStop(0, css(base, 10));
        gr.addColorStop(0.7, css(base, 0));
        gr.addColorStop(1, css(base, -15));
        s.fillStyle = gr;
        s.fillRect(bb.x, y, bb.w, 5.33);
        s.strokeStyle = css(base, -10, 0.5);
        s.lineWidth = 0.5;
        s.beginPath();
        for (let x = bb.x; x <= bb.x + bb.w; x += 3) s.lineTo(x, y + 2.6 + Math.sin(x * 0.4 + y) * 0.8);
        s.stroke();
      }
      s.fillStyle = css(pal.dark);
      for (const [x, y] of m.cells) {
        circle(s, x * TILE + O[0] + 3, y * TILE + O[1] + 3, 0.8);
        circle(s, x * TILE + O[0] + 13, y * TILE + O[1] + 13, 0.8);
      }
      s.restore();
      break;
    }
    case 'ice': {
      const base: HSL = { h: 195, s: 80, l: 78 };
      outline(css(base, -30, 0.9), 2);
      const gr = s.createLinearGradient(bb.x, bb.y, bb.x + bb.w, bb.y + bb.h);
      gr.addColorStop(0, css(base, 15, 0.95));
      gr.addColorStop(1, css(base, -15, 0.85));
      s.fillStyle = gr;
      s.fill(path);
      s.save();
      s.clip(path);
      s.strokeStyle = 'rgba(255,255,255,0.55)';
      s.lineWidth = 0.8;
      for (const [x, y] of m.cells) {
        const px = x * TILE + O[0];
        const py = y * TILE + O[1];
        s.beginPath();
        s.moveTo(px + 2, py + 12);
        s.lineTo(px + 7, py + 6);
        s.lineTo(px + 14, py + 9);
        s.stroke();
      }
      const sweep = ((t * 40 + r.pp.uid * 30) % (bb.w + 60)) - 30;
      g.save();
      g.clip(path);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.beginPath();
      g.moveTo(bb.x + sweep, bb.y);
      g.lineTo(bb.x + sweep + 6, bb.y);
      g.lineTo(bb.x + sweep - 6, bb.y + bb.h);
      g.lineTo(bb.x + sweep - 12, bb.y + bb.h);
      g.fill();
      g.restore();
      s.restore();
      break;
    }
    case 'conveyor': {
      outline('#0b0b0f');
      s.fillStyle = '#26262e';
      s.fill(path);
      s.save();
      s.clip(path);
      const dir = Math.sign(r.pp.rot >= 2 ? -m.conveyor : m.conveyor) || 1;
      const offx = ((f * Math.abs(m.conveyor)) / 60) % 8;
      for (const [x, y] of m.cells) {
        const px = x * TILE + O[0];
        const py = y * TILE + O[1];
        if (!set.has(`${x},${y - 1}`)) {
          for (let i = -1; i < 3; i++) {
            const bx = px + ((((i * 8 + dir * offx) % 16) + 16) % 16);
            s.fillStyle = '#3a3a44';
            s.fillRect(bx, py, 2, 3);
            g.strokeStyle = 'rgba(255,190,60,0.85)';
            g.lineWidth = 1.2;
            g.beginPath();
            g.moveTo(bx - dir * 2 + 1, py + 5);
            g.lineTo(bx + dir * 1 + 1, py + 7.5);
            g.lineTo(bx - dir * 2 + 1, py + 10);
            g.stroke();
          }
        }
        // Rollers.
        const rx = px + TILE / 2;
        const ry = py + TILE - 4;
        s.fillStyle = sphereFill(s, rx, ry, 3, { h: 220, s: 8, l: 55 });
        circle(s, rx, ry, 3);
        s.strokeStyle = '#111';
        s.lineWidth = 0.8;
        const a = (f * m.conveyor) / 180;
        s.beginPath();
        s.moveTo(rx + Math.cos(a) * 2.5, ry + Math.sin(a) * 2.5);
        s.lineTo(rx - Math.cos(a) * 2.5, ry - Math.sin(a) * 2.5);
        s.stroke();
      }
      s.restore();
      break;
    }
    case 'goo':
    case 'jelly': {
      const jelly = m.material === 'jelly';
      const base: HSL = jelly ? { h: (st.hue + 300) % 360, s: 85, l: 62 } : { h: st.hue, s: 75, l: 42 };
      const wob = (x: number, y: number) => Math.sin(t * (jelly ? 6 : 2) + x * 0.6 + y) * (jelly ? 0.9 : 0.5);
      const wpath = new Path2D();
      for (const [x, y] of m.cells)
        wpath.roundRect(x * TILE + O[0] - wob(x, y) * 0.5, y * TILE + O[1] + wob(y, x), TILE + wob(x, y), TILE - wob(y, x), cornerRadii(set, x, y, 6));
      s.lineJoin = 'round';
      s.strokeStyle = css(base, -28, 0.9);
      s.lineWidth = 2.4;
      s.stroke(wpath);
      const gr = s.createLinearGradient(0, bb.y, 0, bb.y + bb.h);
      gr.addColorStop(0, css(base, 18, jelly ? 0.85 : 1));
      gr.addColorStop(1, css(base, -10, jelly ? 0.8 : 1));
      s.fillStyle = gr;
      s.fill(wpath);
      g.globalAlpha = jelly ? 0.35 : 0.2;
      g.fillStyle = css(base, 10);
      g.fill(wpath);
      g.globalAlpha = 1;
      s.fillStyle = 'rgba(255,255,255,0.55)';
      for (const [x, y] of m.cells) {
        if (!set.has(`${x},${y - 1}`)) ellipse(s, x * TILE + O[0] + 5, y * TILE + O[1] + 3.5, 3, 1.2);
        if (jelly) {
          s.fillStyle = 'rgba(255,255,255,0.3)';
          circle(s, x * TILE + O[0] + 10 + Math.sin(t + x) * 2, y * TILE + O[1] + 10 + Math.cos(t * 1.3 + y) * 2, 1.4);
          s.fillStyle = 'rgba(255,255,255,0.55)';
        } else if (!set.has(`${x},${y + 1}`)) {
          const dp = (t * 0.5 + hash2(x, y, 3)) % 1;
          s.fillStyle = css(base, 0);
          ellipse(s, x * TILE + O[0] + 4 + hash2(x, y, 9) * 8, (y + 1) * TILE + O[1] + dp * 4, 1.4, 1 + dp * 2.5);
          s.fillStyle = 'rgba(255,255,255,0.55)';
        }
      }
      break;
    }
    case 'crumble': {
      const base: HSL = { h: 32, s: 42, l: 54 };
      outline(css(base, -30));
      const gr = s.createLinearGradient(0, bb.y, 0, bb.y + bb.h);
      gr.addColorStop(0, css(base, 10));
      gr.addColorStop(1, css(base, -12));
      s.fillStyle = gr;
      s.fill(path);
      s.save();
      s.clip(path);
      s.strokeStyle = css(base, -32);
      s.lineWidth = 0.9;
      for (const [x, y] of m.cells) {
        const px = x * TILE + O[0];
        const py = y * TILE + O[1];
        s.beginPath();
        s.moveTo(px + 3, py);
        s.lineTo(px + 7, py + 6);
        s.lineTo(px + 5, py + 11);
        s.lineTo(px + 8, py + TILE);
        s.moveTo(px + 7, py + 6);
        s.lineTo(px + TILE, py + 8);
        s.stroke();
        s.fillStyle = css(base, 18, 0.7);
        s.fillRect(px + 1, py + 1, TILE - 2, 1.5);
      }
      s.restore();
      break;
    }
  }
}

defineArt<'body'>({ type: 'body', layer: 1, draw: (rc, m, d) => drawBody(rc, m, d.style, d.pal, d.off, d.r, d.o) });
