import { css, type HSL } from '../../../core/color';
import type { Vec } from '../../../core/geom';
import { hash2 } from '../../../core/rng';
import { TILE } from '../../../sim/constants';
import type { ModuleOf } from '../../../sim/props';
import { line, type P, stroke } from '../../ink';
import { boxPts, glint, path, pen, poly, sprite, stamp } from '../../ink-props';
import { glowDot, light, type RC } from '../../kit';
import type { PropDrawOpts } from '../common';

/**
 * The volcano's obsidian bridge (body look 'obsidian', a crumbling block): slabs of black volcanic glass laid
 * over the lava. Still, each slab is baked once: glass-black with a violet sheen, a hard glint and the pen
 * round it. When someone stands on it, it shakes and glowing cracks run through it as it gives (the tell,
 * so it glows: the lava is showing through); once it's gone, a dotted outline marks where it comes back.
 */

type Body = ModuleOf<'body'>;

const GLASS: HSL = { h: 268, s: 22, l: 11 };
const SHEEN: HSL = { h: 262, s: 34, l: 36 };
const LAVA: HSL = { h: 22, s: 100, l: 55 };

/** One slab, baked: a variant per cell, keyed to the world so it never reshuffles. */
function slab(v: number) {
  return sprite(`obsidian-slab|${v}`, -1, -1, TILE + 2, TILE + 2, (g) => {
    const pts = boxPts(0.4, 0.6, TILE - 0.8, TILE - 1.2, 1.2, v + 11, 0.1);
    g.fillStyle = css(GLASS);
    path(g, pts);
    g.fill();
    // A conchoidal facet catching the sky, and a darker one beside it.
    const a = 3 + (v % 3) * 2;
    g.fillStyle = css(SHEEN, -4);
    path(g, poly(a, 1.5, TILE - 2, 2, TILE - 4 - (v % 2) * 3, 7, a + 2, 6));
    g.fill();
    g.fillStyle = css(GLASS, -5);
    path(g, poly(2, TILE - 3, 7 + v, 8, TILE - 2, TILE - 2.5));
    g.fill();
    glint(g, poly(a + 1, 2.4, TILE - 4, 2.8), 'rgba(226,214,255,0.85)', 0.7, v);
    // The glass is near black already: its pen goes a step deeper so the slab's edge still reads.
    pen(g, pts, v + 3, 0.55, 1.3, 4, css(GLASS, -6, 1, 4));
  });
}

/** The glass slabs over the lava; cracks glowing through as it gives, its outline when it's gone. */
export function drawObsidian(rc: RC, m: Body, off: Vec, o: PropDrawOpts) {
  const s = rc.s;
  if (o.broken) {
    s.fillStyle = 'rgba(255,190,150,0.35)';
    for (const [x, y] of m.cells) {
      const px = x * TILE + off[0];
      const py = y * TILE + off[1];
      for (let i = 0; i < 4; i++) line(s, px + 1 + i * 4, py + 0.5, px + 3 + i * 4, py + 0.5, { w: 0.9, seed: i, taper: [0.2, 0.2], press: 0 });
    }
    return;
  }
  const f = rc.frame;
  const trig = o.state && o.state.triggerFrame >= 0 ? Math.min(1, (f - o.state.triggerFrame) / Math.max(1, m.breakFrames)) : 0;
  const shake = trig ? Math.sin(f * 2.9) * trig * 1.4 : 0;
  for (const [x, y] of m.cells) stamp(s, slab(Math.floor(hash2(x, y, 7) * 6)), x * TILE + off[0] + shake, y * TILE + off[1]);
  if (!trig) return;
  // Cracks run in from the seams, wider and hotter as it gives.
  for (const [x, y] of m.cells) {
    const px = x * TILE + off[0] + shake;
    const py = y * TILE + off[1];
    const pts: P[] = [{ x: px + 2 + hash2(x, y, 1) * 12, y: py + 1 }];
    const steps = Math.ceil(trig * 5);
    for (let i = 1; i <= steps; i++) pts.push({ x: pts[i - 1].x + (hash2(x, y + i, 2) - 0.5) * 7, y: py + 1 + i * 2.8 });
    s.fillStyle = css(LAVA, 8);
    stroke(s, pts, { w: 0.8 + trig * 1.2, seed: x * 7 + y, taper: [0.05, 0.5], press: 0.2 });
    const end = pts[pts.length - 1];
    glowDot(rc.g, end.x, end.y, 6 + 8 * trig, LAVA, 0.6 * trig);
  }
  const c = m.cells[0];
  light(rc, (c[0] + 0.5) * TILE + off[0], c[1] * TILE + off[1], 40 + 30 * trig, LAVA, 0.5 * trig);
}
