import { css } from '../../../core/color';
import { TILE } from '../../../sim/constants';
import { COAT_PX, dirOf, faceRect, type ModuleOf } from '../../../sim/props';
import { inkThorns } from '../../ink-parts';
import { circle, glowDot, type RC } from '../../kit';
import { defineArt } from '../common';

type Coat = ModuleOf<'coat'>;

/** Spikes protruding from each host face (local frame: face at x=8, tips toward +x). */
function drawSpikeStrip(rc: RC, m: Coat) {
  const s = rc.s;
  for (const [cx, cy] of m.cells) {
    s.save();
    s.translate((cx + 0.5) * TILE, (cy + 0.5) * TILE);
    s.rotate(m.angle);
    inkThorns(s, m.angle, cx * 31 + cy * 17);
    s.restore();
  }
}

function drawIce(rc: RC, m: Coat) {
  const s = rc.s;
  const [dx, dy] = dirOf(m.angle);
  for (const [cx, cy] of m.cells) {
    const r = faceRect(cx, cy, m.angle, COAT_PX + 0.5);
    const gr = s.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
    gr.addColorStop(0, 'hsl(195 90% 92% / 0.95)');
    gr.addColorStop(1, 'hsl(200 80% 72% / 0.9)');
    s.fillStyle = gr;
    s.fillRect(r.x, r.y, r.w, r.h);
    s.fillStyle = 'rgba(255,255,255,0.9)';
    if (dx === 0) s.fillRect(r.x + 2 + ((cx * 5) % 7), r.y + (dy < 0 ? 0.5 : r.h - 1.2), 4, 0.8);
    else s.fillRect(r.x + (dx > 0 ? r.w - 1.2 : 0.5), r.y + 3 + ((cy * 5) % 7), 0.8, 4);
    // Icicles hang from ceilings and drip off ledges.
    if (dy > 0) {
      s.fillStyle = 'hsl(198 85% 85% / 0.9)';
      for (let i = 0; i < 2; i++) {
        const ix = cx * TILE + 4 + i * 7 + ((cx + cy) % 3);
        s.beginPath();
        s.moveTo(ix - 1.4, r.y + r.h);
        s.lineTo(ix, r.y + r.h + 3 + ((cx * 7 + i) % 4));
        s.lineTo(ix + 1.4, r.y + r.h);
        s.fill();
      }
    }
    // Faint cold glint so ice reads in dark themes.
    const sweep = (rc.t * 0.6 + cx * 0.13 + cy * 0.07) % 1;
    if (sweep < 0.15) glowDot(rc.g, r.x + r.w / 2, r.y + r.h / 2, 6, { h: 195, s: 90, l: 85 }, 0.5 * (1 - sweep / 0.15));
  }
}

function drawSlime(rc: RC, m: Coat) {
  const s = rc.s;
  const [dx, dy] = dirOf(m.angle);
  const base = { h: 105, s: 80, l: 45 };
  for (const [cx, cy] of m.cells) {
    const wob = Math.sin(rc.t * 2.2 + cx * 1.3 + cy) * 0.6;
    const r = faceRect(cx, cy, m.angle, COAT_PX + 1 + wob);
    s.fillStyle = css(base, -12);
    s.beginPath();
    s.roundRect(r.x - 0.5, r.y - 0.5, r.w + 1, r.h + 1, 1.8);
    s.fill();
    s.fillStyle = css(base, 6);
    s.beginPath();
    s.roundRect(r.x, r.y, r.w, r.h, 1.5);
    s.fill();
    s.fillStyle = 'rgba(255,255,255,0.5)';
    if (dx === 0) s.fillRect(r.x + 3, r.y + 0.8, 4, 0.9);
    else s.fillRect(r.x + 0.8, r.y + 3, 0.9, 4);
    // Drips sag downward from side and bottom faces.
    if (dy >= 0) {
      const p = (rc.t * 0.45 + cx * 0.37 + cy * 0.21) % 1;
      const ox = dx > 0 ? r.x + r.w - 1 : dx < 0 ? r.x + 1 : cx * TILE + 5 + ((cx * 3) % 6);
      const oy = dy > 0 ? r.y + r.h : cy * TILE + TILE - 2;
      s.fillStyle = css(base, 4);
      s.beginPath();
      s.ellipse(ox, oy + p * 4, 1.2, 1 + p * 2.4, 0, 0, Math.PI * 2);
      s.fill();
      if (p > 0.85) circle(s, ox, oy + 6 + (p - 0.85) * 40, 0.9);
    }
    rc.g.fillStyle = css(base, 15, 0.18);
    rc.g.fillRect(r.x, r.y, r.w, r.h);
  }
}

defineArt<'coat'>({
  type: 'coat',
  layer: 2,
  draw: (rc, m) => (m.kind === 'spikes' ? drawSpikeStrip(rc, m) : m.kind === 'ice' ? drawIce(rc, m) : drawSlime(rc, m)),
});
