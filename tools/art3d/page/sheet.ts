import { shift } from '../../../src/core/color';
import { drawFrame, hexHsl, paintOf } from '../../../src/render/cast/sprites/draw';
import type { SpriteSet } from '../../../src/render/cast/sprites/types';
import { ratio } from '../../../src/render/ink-figure';

/**
 * A contact sheet of a kind's frames, drawn by the game's own drawer (`src/render/cast/sprites/draw.ts`)
 * in the roster's colours: one row per clip and facing, every frame on a common floor line at `zoom` px
 * per world px, on the game's light paper. With `silhouette`, every frame is solid ink: the read test.
 */
export function contact(set: SpriteSet, zoom: number, opts: { facings?: ('r' | 'l')[]; silhouette?: boolean; only?: string[] } = {}): string {
  const facings = opts.facings ?? ['r', 'l'];
  const rows: { label: string; frames: SpriteSet['clips'][string]['r'] }[] = [];
  for (const [name, c] of Object.entries(set.clips)) {
    if (opts.only && !opts.only.includes(name)) continue;
    for (const side of facings) rows.push({ label: `${name} ${side}`, frames: c[side] });
  }
  const cellW = Math.ceil(30 * zoom);
  const cellH = Math.ceil(36 * zoom);
  const labelW = 110;
  const cols = Math.max(...rows.map((r) => r.frames.length));
  const c = document.createElement('canvas');
  c.width = labelW + cols * cellW;
  c.height = rows.length * cellH;
  const g = c.getContext('2d')!;
  g.fillStyle = '#efe6d2';
  g.fillRect(0, 0, c.width, c.height);
  const hsl = set.roles.map((r) => hexHsl(r.color));
  const paints = set.roles.map((_, i) => paintOf(hsl[i]));
  const main = hsl[set.roles.findIndex((r) => r.slot === 'paint')] ?? hsl[0];
  const body = paintOf(main);
  const black = { fill: '#120b08', shade: '#120b08', ink: '#120b08' };
  rows.forEach((r, i) => {
    const floor = i * cellH + cellH * 0.88;
    g.fillStyle = '#2a1c15';
    g.font = '600 14px sans-serif';
    g.fillText(r.label, 8, floor - cellH * 0.4);
    g.fillStyle = '#c8bba0';
    g.fillRect(labelW, floor, cols * cellW, 2);
    r.frames.forEach((f, j) => {
      g.save();
      g.translate(labelW + j * cellW + cellW / 2, floor);
      g.scale(zoom, zoom);
      if (opts.silhouette)
        drawFrame(
          g,
          f,
          paints.map(() => black),
          black,
          '#120b08',
          0.6,
          7,
          0,
        );
      else drawFrame(g, f, paints, body, ratio(main, shift(main, -14, 6)), 0.6, 7, j / 8);
      g.restore();
    });
  });
  return c.toDataURL('image/png');
}
