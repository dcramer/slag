import { shift } from '../../../src/core/color';
import { type Kind, generateCharacter } from '../../../src/gen/character';
import { drawFrame, hexHsl, paintOf } from '../../../src/render/cast/sprites/draw';
import { picks, roll } from '../../../src/render/cast/sprites/play';
import type { FaceMood } from '../../../src/render/cast/sprites/face';
import type { SpriteSet } from '../../../src/render/cast/sprites/types';

const MOODS: Record<string, FaceMood> = { idle: 'idle', walk: 'walk', run: 'run', air: 'up', wall: 'wall', cheer: 'cheer', death: 'dead' };
import { inkOf, ratio } from '../../../src/render/ink-figure';

/**
 * A contact sheet of a kind's frames, drawn by the game's own drawer (`src/render/cast/sprites/draw.ts`)
 * in the roster's colours: one row per clip and facing, every frame on a common floor line at `zoom` px
 * per world px, on the game's light paper. With `silhouette`, every frame is solid ink: the read test.
 */
export function contact(set: SpriteSet, zoom: number, opts: { facings?: ('r' | 'l')[]; silhouette?: boolean; only?: string[]; pick?: number[] } = {}): string {
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
      else {
        // The face acts as it would in that clip.
        const name = r.label.split(' ')[0];
        const mood = MOODS[name] ?? 'idle';
        const face = set.face
          ? { kit: set.face, mood: mood === 'up' && j >= r.frames.length / 2 ? ('fall' as const) : mood, facing: r.label.endsWith(' l') ? -1 : 1 }
          : undefined;
        drawFrame(g, f, paints, body, ratio(main, shift(main, -14, 6)), 0.6, 7, j / 8, face, opts.pick);
      }
      g.restore();
    });
  });
  return c.toDataURL('image/png');
}

/**
 * Six rolls of a kind: its standing frame as six characters of that kind wear it (the player's colour on
 * the costume, a secondary region's alternate colour and their accessories, all from their own rolls, as
 * the game dresses them), and the roster's colours with every accessory on, at `zoom` px per world px.
 */
export function rolls(set: SpriteSet, zoom: number): string {
  const idle = set.clips.idle ?? Object.values(set.clips)[0];
  const chars = [1, 2, 3, 4, 5, 6].map((seed) => generateCharacter(seed, set.kind as Kind));
  const looks = chars.map((ch) => picks(set, ch.vary));
  looks.push((set.slots ?? []).map((sl) => sl.options - 1));
  const cell = 30 * zoom;
  const c = document.createElement('canvas');
  c.width = looks.length * cell + 20;
  c.height = 34 * zoom;
  const g = c.getContext('2d')!;
  g.fillStyle = '#efe6d2';
  g.fillRect(0, 0, c.width, c.height);
  looks.forEach((pick, i) => {
    const ch = chars[i];
    const hsl = set.roles.map((r) =>
      ch === undefined
        ? hexHsl(r.color)
        : r.slot === 'player'
          ? ch.body
          : r.slot === 'paint'
            ? ch.paint
            : hexHsl(r.alts ? [r.color, ...r.alts][roll(ch.vary[r.vary ?? 0], r.alts.length + 1)] : r.color),
    );
    const paints = set.roles.map((_, k) => paintOf(hsl[k]));
    const main = hsl[[set.roles.findIndex((r) => r.slot === 'player'), set.roles.findIndex((r) => r.slot === 'paint')].find((k) => k >= 0) ?? 0];
    g.save();
    g.translate(10 + cell * (i + 0.5), 31 * zoom);
    g.scale(zoom, zoom);
    const face = set.face ? { kit: set.face, mood: 'idle' as const, facing: 1 } : undefined;
    drawFrame(g, idle.r[0], paints, { ...paintOf(main), ink: inkOf(main) }, ratio(main, shift(main, -14, 6)), 0.6, 7, 0, face, pick);
    g.restore();
    g.fillStyle = '#3d2e26';
    g.font = '600 14px sans-serif';
    g.fillText(i < 6 ? `seed ${i + 1}` : 'all on', 14 + cell * i, 18);
  });
  return c.toDataURL('image/png');
}
