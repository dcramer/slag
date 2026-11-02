import { css, type HSL, shift } from '../core/color';
import { hash2 } from '../core/rng';
import type { Theme } from '../gen/theme';
import { TILE } from '../sim/constants';
import type { Level } from '../sim/level';
import { blob, sn } from './ink';

/**
 * ART SPIKE, STAND-IN: a painted terrain material made in code, NOT generated art. The Tripo login had
 * expired, so this exists only to answer the questions that don't depend on who painted the material:
 * does a painted fill feed the cel band pass or bypass it, and does ink sit on top of it. It says
 * nothing about how generated art would look or whether it holds a style.
 *
 * Gouache by stamping: overlapping opaque dabs from a small palette, each stamped at its wrapped
 * positions too, so the tile repeats without a seam.
 */

/** World px of one repeat. */
const REPEAT = 208;
/** Texture px per repeat: within the assets rule of 256 px tiles. */
const SIZE = 256;

const cache = new Map<string, HTMLCanvasElement>();

function paintedTile(T: { base: HSL; dark: HSL; light: HSL }, seed: number): HTMLCanvasElement {
  const key = `${seed}:${css(T.base)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d')!;
  g.fillStyle = css(T.base);
  g.fillRect(0, 0, SIZE, SIZE);
  const inks = [
    css(shift(T.dark, 2, 4, -6)),
    css(shift(T.dark, 9, 6, 4)),
    css(shift(T.base, -6, 4, -4)),
    css(shift(T.base, 2, 6, 6)),
    css(shift(T.base, 6, 2, -8)),
    css(shift(T.light, -6, -2, 4)),
    css(shift(T.light, 2, -6, -6)),
  ];
  // Big dark shapes first, then smaller and lighter on top: the order a painter works in.
  for (let i = 0; i < 1500; i++) {
    const t = i / 1500;
    const x = hash2(i, 1, seed) * SIZE;
    const y = hash2(i, 2, seed) * SIZE;
    const r = 26 - 21 * Math.pow(t, 0.6) + hash2(i, 3, seed) * 4;
    const ang = sn(x * 0.012, y * 0.012, seed) * 0.8;
    const idx = Math.floor(Math.min(0.999, t * 0.72 + hash2(i, 4, seed) * 0.42) * inks.length);
    g.fillStyle = inks[idx];
    for (const ox of [-SIZE, 0, SIZE]) {
      for (const oy of [-SIZE, 0, SIZE]) {
        if (x + ox < -r * 3 || x + ox > SIZE + r * 3 || y + oy < -r * 3 || y + oy > SIZE + r * 3) continue;
        g.save();
        g.translate(x + ox, y + oy);
        g.rotate(ang);
        g.globalAlpha = 0.72;
        blob(g, 0, 0, r, i % 512, 0.34, 0.26);
        g.fill();
        g.restore();
      }
    }
  }
  cache.set(key, c);
  return c;
}

/** The fill a painted material would take: a pattern, then one hard deep tone so a big face isn't one flat wash. */
export function paintedFill(g: CanvasRenderingContext2D, level: Level, th: Theme, seed: number, depth: (x: number, y: number) => number) {
  const tile = paintedTile(th.terrain, seed);
  const pat = g.createPattern(tile, 'repeat')!;
  pat.setTransform(new DOMMatrix().scale(REPEAT / SIZE, REPEAT / SIZE));
  g.fillStyle = pat;
  g.fillRect(0, 0, level.w * TILE, level.h * TILE);
  // One shape, multiplied once: stacking blobs one at a time would go black where they overlap.
  const k = g.getTransform().a;
  const layer = document.createElement('canvas');
  layer.width = g.canvas.width;
  layer.height = g.canvas.height;
  const lg = layer.getContext('2d')!;
  lg.setTransform(k, 0, 0, k, 0, 0);
  lg.fillStyle = css(shift(th.terrain.light, 4, -14));
  for (let y = 0; y < level.h; y++) {
    for (let x = 0; x < level.w; x++) {
      if (depth(x, y) < 3) continue;
      blob(lg, (x + 0.5) * TILE, (y + 0.5) * TILE, 14, x * 13 + y * 7 + seed, 1, 0.3);
      lg.fill();
    }
  }
  g.save();
  g.globalCompositeOperation = 'multiply';
  g.drawImage(layer, 0, 0, level.w * TILE, level.h * TILE);
  g.restore();
}
