import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import type { ModuleOf } from '../../../sim/props';
import { line, type P, stroke } from '../../ink';
import { INK, path, poly, sprite, stamp } from '../../ink-props';
import { circle, flutter } from '../../kit';
import { defineArt } from '../common';

type Web = ModuleOf<'web'>;

const SILK = 'rgba(236,236,246,0.85)';

/**
 * Sticky web, spun with the pen: anchor threads between neighbouring cells and a little orb web in each,
 * baked once and laid on the background layer, where thin silk stays silk instead of turning to ink
 * scrub. One loose strand ends in a mouse cursor (docs/PARODY.md, web). It sways only in a real wind.
 */
function bake(m: Web, uid: number) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of m.cells) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x + 1);
    y1 = Math.max(y1, y + 1);
  }
  const key = `web|${uid}|${m.cells.map((c) => c.join(',')).join(';')}`;
  return sprite(key, x0 * TILE - 10, y0 * TILE - 10, (x1 - x0) * TILE + 20, (y1 - y0) * TILE + 20, (g) => {
    const set = new Set(m.cells.map(([x, y]) => `${x},${y}`));
    g.fillStyle = 'rgba(225,225,235,0.07)';
    for (const [x, y] of m.cells) g.fillRect(x * TILE, y * TILE, TILE, TILE);
    g.fillStyle = SILK;
    const thread = (pts: P[], seed: number) => stroke(g, pts, { w: 0.55, seed, taper: [0.15, 0.15], press: 0.35 });
    for (const [x, y] of m.cells) {
      const cx = (x + 0.5) * TILE;
      const cy = (y + 0.5) * TILE;
      const seed = x * 31 + y * 17;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + (hash2(x, y, k) - 0.5) * 0.2;
        const rr = (k % 2 ? TILE * 0.7 : TILE * 0.5) * 0.98;
        line(g, cx, cy, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, { w: 0.5, seed: seed + k, taper: [0.1, 0.4], press: 0.3 });
      }
      for (const r of [2.5, 4.8, 7]) {
        const ring: P[] = [];
        for (let k = 0; k <= 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          const sag = k % 2 ? 0.86 : 1;
          ring.push({ x: cx + Math.cos(a) * r * sag, y: cy + Math.sin(a) * r * sag + 0.4 });
        }
        thread(ring, seed + r * 7);
      }
      if (set.has(`${x + 1},${y}`)) thread(poly(cx, cy, cx + 8, cy + 1.6, cx + 16, cy), seed + 40);
      if (set.has(`${x},${y + 1}`)) thread(poly(cx, cy, cx + 1.2, cy + 8, cx, cy + 16), seed + 41);
    }
    // The loose strand: off the first cell with open air beside it, ending in a cursor.
    const end = m.cells.find(([x, y]) => !set.has(`${x + 1},${y}`)) ?? m.cells[0];
    const sx = (end[0] + 1) * TILE - 2;
    const sy = (end[1] + 0.5) * TILE;
    g.fillStyle = SILK;
    stroke(g, poly(sx - 4, sy - 1, sx + 1, sy + 1.5, sx + 4.5, sy + 4.5), { w: 0.55, seed: 3, taper: [0.1, 0.1], press: 0.2 });
    const arrow = poly(sx + 4.5, sy + 4.5, sx + 4.5, sy + 9.6, sx + 5.7, sy + 8.4, sx + 6.7, sy + 10.4, sx + 7.5, sy + 10, sx + 6.6, sy + 8, sx + 8.2, sy + 8);
    g.fillStyle = INK;
    path(g, arrow);
    g.save();
    g.translate(0.35, 0.35);
    g.fill();
    g.restore();
    g.fill();
    g.fillStyle = '#ffffff';
    g.save();
    g.translate(sx + 5.6, sy + 7.6);
    g.scale(0.62, 0.62);
    g.translate(-(sx + 5.6), -(sy + 7.6));
    path(g, arrow);
    g.fill();
    g.restore();
  });
}

defineArt<'web'>({
  type: 'web',
  layer: 2,
  draw(rc, m, d) {
    const bg = rc.bg;
    const ox = d.off[0];
    const oy = d.off[1];
    const sway = flutter(rc, 1.3, d.r.pp.uid) * 0.03;
    bg.save();
    bg.translate(ox, oy);
    if (sway) bg.transform(1, 0, sway, 1, 0, 0);
    stamp(bg, bake(m, d.r.pp.uid));
    bg.restore();
    const g = rc.g;
    for (const [x, y] of m.cells) {
      const cx = (x + 0.5) * TILE + ox;
      const cy = (y + 0.5) * TILE + oy;
      for (let i = 0; i < 3; i++) {
        const k = hash2(x * 3 + i, y, d.r.pp.uid);
        const a = k * Math.PI * 2;
        const rr = 2.5 + hash2(i, x, y) * 4.5;
        g.fillStyle = `rgba(210,235,255,${0.35 + 0.3 * Math.sin(rc.t * 2 + k * 9)})`;
        circle(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.6);
      }
    }
  },
});
