import { css, shift } from '../core/color';
import { hash2 } from '../core/rng';
import type { Theme } from '../gen/theme';
import { TILE } from '../sim/constants';
import { GROUND_ICE } from '../sim/ground';
import type { Level } from '../sim/level';
import { type EdgeP, line } from './ink';
import { INK_MATERIALS, type Tones } from './ink-material';
import type { Area } from './ink-terrain';

/**
 * A theme's own ground (sim/ground.ts) drawn into the terrain: glacier ice
 * as its own material, laid over the rock where the ice is, with no snow on
 * it and a hard glint along its top. Ice is the one thing on a glacier that
 * changes how you move, so it must never be mistaken for rock or snow: it
 * gets the 'ice' material, cut to its tiles with a hand's edge that stays
 * within a couple of px of them.
 *
 * Marks are keyed to world tiles like everything else in the bake, so a
 * crater redraws only what it touched.
 */

/** Default ice tones, for a level that has ice but a look that didn't say. */
const ICE: Tones = { base: { h: 194, s: 60, l: 72 }, dark: { h: 206, s: 58, l: 50 }, light: { h: 186, s: 70, l: 92 } };

const iceAt = (level: Level, x: number, y: number) =>
  !!level.ground && level.ground.length === level.w * level.h && x >= 0 && y >= 0 && x < level.w && y < level.h && level.ground[y * level.w + x] === GROUND_ICE;

/** Paint the ice material over its tiles, on the layer the terrain material went to (before hatching and the mask cut). */
export function inkIce(g: CanvasRenderingContext2D, level: Level, th: Theme, seed: number, solid: (x: number, y: number) => boolean, area: Area) {
  if (!level.ground) return;
  const span = {
    tx0: Math.max(0, Math.floor(area.x0 / TILE) - 2),
    ty0: Math.max(0, Math.floor(area.y0 / TILE) - 2),
    tx1: Math.min(level.w - 1, Math.ceil(area.x1 / TILE) + 2),
    ty1: Math.min(level.h - 1, Math.ceil(area.y1 / TILE) + 2),
  };
  const inside = (x: number, y: number) => solid(x, y) && iceAt(level, x, y);
  let any = false;
  for (let y = span.ty0; y <= span.ty1 && !any; y++) for (let x = span.tx0; x <= span.tx1 && !any; x++) any = inside(x, y);
  if (!any) return;
  // Depth from the ice's own edge, so a thick sheet darkens inside like any material does.
  const depth = (x: number, y: number) => {
    let d = 0;
    while (d < 4 && inside(x - d - 1, y) && inside(x + d + 1, y) && inside(x, y - d - 1) && inside(x, y + d + 1)) d++;
    return d + 1;
  };
  const layer = document.createElement('canvas');
  layer.width = g.canvas.width;
  layer.height = g.canvas.height;
  const lg = layer.getContext('2d')!;
  lg.setTransform(g.getTransform());
  const ink = css(shift(th.terrain.outline, -4, 6));
  INK_MATERIALS.ice({ g: lg, seed: seed + 2000, T: th.terrain.ice ?? ICE, ink, span, area, inside, depth });
  // Cut to the ice tiles: ice breaks in straight planes, so each tile is a slab whose corners stray a
  // little (keyed to the corner, so neighbours agree), never more than about a px past the tile.
  lg.globalCompositeOperation = 'destination-in';
  lg.fillStyle = '#000';
  lg.beginPath();
  const corner = (cx: number, cy: number): [number, number] => [
    cx * TILE + (hash2(cx, cy, seed + 31) - 0.5) * 2.2,
    cy * TILE + (hash2(cy, cx, seed + 32) - 0.5) * 2.2,
  ];
  for (let y = span.ty0; y <= span.ty1; y++) {
    for (let x = span.tx0; x <= span.tx1; x++) {
      if (!inside(x, y)) continue;
      const pts = [corner(x, y), corner(x + 1, y), corner(x + 1, y + 1), corner(x, y + 1)];
      // Edges against rock bulge out a hair so slabs overlap their neighbours instead of leaving seams.
      lg.moveTo(pts[0][0] - 0.4, pts[0][1] - 0.4);
      lg.lineTo(pts[1][0] + 0.4, pts[1][1] - 0.4);
      lg.lineTo(pts[2][0] + 0.4, pts[2][1] + 0.4);
      lg.lineTo(pts[3][0] - 0.4, pts[3][1] + 0.4);
      lg.closePath();
    }
  }
  lg.fill();
  // A seam of ink where ice meets rock inside the terrain, broken like every other line.
  const rockSide = (x: number, y: number) => solid(x, y) && !iceAt(level, x, y);
  lg.globalCompositeOperation = 'source-over';
  lg.fillStyle = css(shift(th.terrain.dark, -6, 4));
  for (let y = span.ty0; y <= span.ty1; y++) {
    for (let x = span.tx0; x <= span.tx1; x++) {
      if (!inside(x, y)) continue;
      const sd = x * 131 + y * 977 + seed;
      for (const [dx, dy] of [
        [0, 1],
        [1, 0],
        [-1, 0],
      ] as const) {
        if (!rockSide(x + dx, y + dy) || hash2(sd, dx + 2, dy + 5) < 0.25) continue;
        const a = dy ? corner(x, y + 1) : dx > 0 ? corner(x + 1, y) : corner(x, y);
        const b = dy ? corner(x + 1, y + 1) : dx > 0 ? corner(x + 1, y + 1) : corner(x, y + 1);
        line(lg, a[0], a[1], b[0], b[1], { w: 1.1, seed: sd + dx, taper: [0.15, 0.3], press: 0.5 });
      }
    }
  }
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(layer, 0, 0);
  g.restore();
}

/** Is this contour point the top of an ice tile? */
function overIce(level: Level, p: EdgeP): boolean {
  return p.ny < -0.3 && iceAt(level, Math.floor(p.x / TILE), Math.floor((p.y + 1) / TILE));
}

/** The contour as the cap should see it: ice tops hidden, so no snow or grass grows on the ice. */
export function capLoops(level: Level, loops: readonly EdgeP[][]): readonly EdgeP[][] {
  if (!level.ground) return loops;
  return loops.map((l) => l.map((p) => (overIce(level, p) ? { ...p, hidden: true } : p)));
}

/** Along the top of the ice: a bright lip with breaks in it, and a glint here and there. */
export function inkIceTops(g: CanvasRenderingContext2D, level: Level, th: Theme, seed: number, loops: readonly EdgeP[][], area: Area) {
  if (!level.ground) return;
  const T = th.terrain.ice ?? ICE;
  const lip = css(shift(T.light, 4, -10));
  const glint = css({ h: T.light.h, s: 30, l: 98 });
  for (const loop of loops) {
    for (let i = 0; i < loop.length; i++) {
      const p = loop[i];
      const q = loop[(i + 1) % loop.length];
      if (!overIce(level, p) || !overIce(level, q) || Math.abs(q.y - p.y) > 3) continue;
      if (p.x < area.x0 - 20 || p.x > area.x1 + 20 || p.y < area.y0 - 20 || p.y > area.y1 + 20) continue;
      const cell = Math.floor(Math.min(p.x, q.x) / 8);
      if (hash2(cell, 3, seed) < 0.18) continue;
      g.fillStyle = lip;
      line(g, p.x, p.y + 1.1, q.x, q.y + 1.1, { w: 1.4, seed: cell + seed, taper: [0.15, 0.15], press: 0.6 });
      if (hash2(cell, 4, seed) > 0.86) {
        const x = (p.x + q.x) / 2;
        const y = (p.y + q.y) / 2 + 3;
        g.fillStyle = glint;
        line(g, x - 2.2, y, x + 2.2, y, { w: 0.9, seed: cell, taper: [0.3, 0.3] });
        line(g, x, y - 2.2, x, y + 2.2, { w: 0.9, seed: cell + 1, taper: [0.3, 0.3] });
      }
    }
  }
}
