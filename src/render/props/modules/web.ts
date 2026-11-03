import { css, type HSL } from '../../../core/color';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import type { ModuleOf } from '../../../sim/props';
import { blob, line, type P, stroke } from '../../ink';
import { path, poly, sprite, stamp } from '../../ink-props';
import { circle, flutter } from '../../kit';
import { defineArt } from '../common';

type Web = ModuleOf<'web'>;

const SILK = 'rgba(246,246,252,0.92)';
const SILK_FAINT = 'rgba(236,238,250,0.7)';
/** The pointer's rim, and the spider: darks with a colour of their own, not one black. */
const CURSOR: HSL = { h: 228, s: 22, l: 20 };
const SPIDER: HSL = { h: 272, s: 16, l: 19 };

/**
 * Sticky web, spun with the pen: one orb web strung across the cells it covers, its radials out to where
 * the sticky cells end and a sagging spiral round them, with a few drops of dew on the threads. A cell the
 * big orb can't reach gets a little orb of its own, so silk sits exactly where it slows you. It's baked
 * once and laid on the background layer, where thin silk stays silk instead of turning to ink scrub. A
 * strand trails off to a mouse cursor (docs/PARODY.md, web) and the spider that spun it hangs underneath.
 * It sways only in a real wind.
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
  return sprite(key, x0 * TILE - 12, y0 * TILE - 12, (x1 - x0) * TILE + 24, (y1 - y0) * TILE + 30, (g) => {
    const set = new Set(m.cells.map(([x, y]) => `${x},${y}`));
    const inside = (px: number, py: number) => set.has(`${Math.floor(px / TILE)},${Math.floor(py / TILE)}`);
    g.fillStyle = 'rgba(225,225,240,0.1)';
    for (const [x, y] of m.cells) g.fillRect(x * TILE, y * TILE, TILE, TILE);
    // The hub: the cell center nearest the middle of the patch.
    const mx = ((x0 + x1) / 2) * TILE;
    const my = ((y0 + y1) / 2) * TILE;
    let hub = m.cells[0];
    for (const c of m.cells)
      if (Math.hypot((c[0] + 0.5) * TILE - mx, (c[1] + 0.5) * TILE - my) < Math.hypot((hub[0] + 0.5) * TILE - mx, (hub[1] + 0.5) * TILE - my)) hub = c;
    const hx = (hub[0] + 0.5) * TILE + (hash2(hub[0], hub[1], uid) - 0.5) * 3;
    const hy = (hub[1] + 0.5) * TILE + (hash2(hub[1], hub[0], uid) - 0.5) * 3;
    const covered = new Set<string>();
    const orb = (cx: number, cy: number, n: number, maxR: number, seed: number, mark: boolean) => {
      // Radials, each out to where the sticky cells end.
      const ends: P[] = [];
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + (hash2(k, seed, 3) - 0.5) * 0.35;
        let r = 1;
        while (r < maxR && inside(cx + Math.cos(a) * (r + 1), cy + Math.sin(a) * (r + 1))) r += 1;
        r = Math.max(3, r - 0.5);
        ends.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
        if (mark) for (let t = 2; t < r; t += 3) covered.add(`${Math.floor((cx + Math.cos(a) * t) / TILE)},${Math.floor((cy + Math.sin(a) * t) / TILE)}`);
      }
      g.fillStyle = SILK;
      for (let k = 0; k < n; k++) line(g, cx, cy, ends[k].x, ends[k].y, { w: 1, seed: seed + k, taper: [0.05, 0.3], press: 0.25 });
      // The frame: threads between neighbouring radial ends.
      g.fillStyle = SILK_FAINT;
      for (let k = 0; k < n; k++) {
        const a = ends[k];
        const b = ends[(k + 1) % n];
        line(g, a.x, a.y, b.x, b.y, { w: 0.5, seed: seed + 40 + k, taper: [0.1, 0.1], press: 0.3 });
      }
      // The spiral: each turn a ring of threads that sag toward the hub between radials.
      g.fillStyle = SILK;
      const turns = 4;
      for (let ring = 1; ring <= turns; ring++) {
        for (let k = 0; k < n; k++) {
          const f0 = (ring - 0.5 + k / n) / (turns + 0.4);
          const f1 = (ring - 0.5 + (k + 1) / n) / (turns + 0.4);
          const a = ends[k];
          const b = ends[(k + 1) % n];
          const ax = cx + (a.x - cx) * f0;
          const ay = cy + (a.y - cy) * f0;
          const bx = cx + (b.x - cx) * f1;
          const by = cy + (b.y - cy) * f1;
          const sx = (ax + bx) / 2 + (cx - (ax + bx) / 2) * 0.12;
          const sy = (ay + by) / 2 + (cy - (ay + by) / 2) * 0.12 + 0.3;
          stroke(g, poly(ax, ay, sx, sy, bx, by), { w: 0.75, seed: seed + ring * 13 + k, taper: [0.1, 0.1], press: 0.3 });
          // Dew, here and there.
          if (hash2(ring, k, seed) > 0.86) {
            g.fillStyle = 'rgba(220,240,255,0.95)';
            blob(g, sx, sy + 0.3, 0.55, k, 1.2, 0.1);
            g.fill();
            g.fillStyle = SILK;
          }
        }
      }
      // A little matted pad at the hub.
      g.fillStyle = 'rgba(250,250,255,0.75)';
      blob(g, cx, cy, 1.1, seed, 1, 0.3);
      g.fill();
    };
    const span = Math.max(x1 - x0, y1 - y0) * TILE;
    orb(hx, hy, 11, span, uid & 0xffff, true);
    // Any cell the big orb missed gets a little web of its own.
    for (const [x, y] of m.cells) {
      if (covered.has(`${x},${y}`)) continue;
      orb((x + 0.5) * TILE, (y + 0.5) * TILE, 7, TILE * 0.62, x * 31 + y * 17, false);
    }
    // The loose strand: off a cell with open air beside it, ending in a cursor.
    const end = m.cells.find(([x, y]) => !set.has(`${x + 1},${y}`)) ?? m.cells[0];
    const sx = (end[0] + 1) * TILE - 2;
    const sy = (end[1] + 0.5) * TILE;
    g.fillStyle = SILK;
    stroke(g, poly(sx - 4, sy - 1, sx + 1, sy + 1.5, sx + 4.5, sy + 4.5), { w: 0.55, seed: 3, taper: [0.1, 0.1], press: 0.2 });
    // The pointer it's caught: big enough to read as one at play scale, white in its dark rim with a hard shadow.
    const ax = sx + 4.5;
    const ay = sy + 4.2;
    const arrow = poly(ax, ay, ax, ay + 8.2, ax + 2, ay + 6.4, ax + 3.4, ay + 9.4, ax + 4.8, ay + 8.7, ax + 3.4, ay + 5.8, ax + 6, ay + 5.8);
    g.fillStyle = css(CURSOR, 0, 0.45);
    g.save();
    g.translate(0.7, 0.9);
    path(g, arrow);
    g.fill();
    g.restore();
    g.fillStyle = css(CURSOR);
    path(g, arrow);
    g.fill();
    g.fillStyle = '#ffffff';
    g.save();
    g.translate(ax + 1.7, ay + 5.2);
    g.scale(0.7, 0.74);
    g.translate(-(ax + 1.7), -(ay + 5.2));
    path(g, arrow);
    g.fill();
    g.restore();
    // The spider, on a thread off the bottom of the hub's column.
    let by = hy;
    while (inside(hx, by + 1)) by += 1;
    spider(g, hx + 0.5, by + 6, uid);
    g.fillStyle = SILK;
    line(g, hx, hy, hx + 0.5, by + 4.4, { w: 0.4, seed: 5, taper: [0, 0], press: 0 });
  });
}

/** A small spider in silhouette: a round body, a head and eight bent legs, inked by hand. No face (docs/ART.md, Objects, not characters). */
function spider(g: CanvasRenderingContext2D, x: number, y: number, seed: number) {
  g.fillStyle = css(SPIDER);
  for (let i = 0; i < 4; i++) {
    for (const sg of [-1, 1]) {
      const a = -0.9 + i * 0.55;
      const kx = x + sg * Math.cos(a) * 2.6;
      const ky = y + Math.sin(a) * 2.2 - 0.6;
      stroke(g, poly(x, y, kx, ky, kx + sg * 0.9, ky + 1.6), { w: 0.55, seed: seed + i * 2 + (sg > 0 ? 1 : 0), taper: [0.05, 0.4], press: 0 });
    }
  }
  blob(g, x, y + 0.6, 2.1, seed, 1.1, 0.06);
  g.fill();
  blob(g, x, y - 1.6, 1.25, seed + 1, 1, 0.06);
  g.fill();
  g.fillStyle = css(SPIDER, 16);
  blob(g, x - 0.6, y, 0.8, seed + 2, 1.1, 0.1);
  g.fill();
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
    // Dew catching the light, twinkling.
    const g = rc.g;
    for (const [x, y] of m.cells) {
      const cx = (x + 0.5) * TILE + ox;
      const cy = (y + 0.5) * TILE + oy;
      const k = hash2(x, y, d.r.pp.uid);
      const a = k * Math.PI * 2;
      const rr = 3 + hash2(y, x, 7) * 4;
      g.fillStyle = `rgba(210,235,255,${0.3 + 0.3 * Math.sin(rc.t * 2 + k * 9)})`;
      circle(g, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0.6);
    }
  },
});
