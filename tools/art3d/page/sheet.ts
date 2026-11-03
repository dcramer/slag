import type { HSL } from '../../../src/core/color';
import { type CharacterDef, type Kind, generateCharacter } from '../../../src/gen/character';
import { coloursOf, shadowOf } from '../../../src/render/cast/sprites';
import { drawFrame, paintOf } from '../../../src/render/cast/sprites/draw';
import type { FaceMood } from '../../../src/render/cast/sprites/face';
import { VARIETY, varietyOf } from '../../../src/render/cast/sprites/play';
import type { SpriteSet } from '../../../src/render/cast/sprites/types';

const MOODS: Record<string, FaceMood> = { idle: 'idle', walk: 'walk', run: 'run', air: 'up', wall: 'wall', cheer: 'cheer', death: 'dead' };

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
  const hsl = coloursOf(set);
  const paints = set.roles.map((_, i) => paintOf(hsl[i]));
  const main = mainOf(set, hsl);
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
        drawFrame(g, f, paints, body, shadowOf(main), 0.6, 7, j / 8, face, opts.pick);
      }
      g.restore();
    });
  });
  return c.toDataURL('image/png');
}

/** The colour the silhouette is inked from: the costume's, or the kind's own. */
const mainOf = (set: SpriteSet, hsl: HSL[]) =>
  hsl[[set.roles.findIndex((r) => r.slot === 'player'), set.roles.findIndex((r) => r.slot === 'paint')].find((i) => i >= 0) ?? 0];

/**
 * A kind's curated variety, drawn by the game's drawer: twelve characters standing in the idle they play
 * and cheering the cheer they play, in their own colours, palette, accessories and wear, then every
 * colourway and every wear option on their own. `zoom` px per world px.
 */
export function rolls(set: SpriteSet, zoom: number): string {
  const chars = Array.from({ length: 12 }, (_, i) => generateCharacter(i + 1, set.kind as Kind));
  // Every option alone: each colourway, then each wear, on one character with nothing else on.
  const bare = (over: Record<number, number>): CharacterDef => {
    const c = generateCharacter(1, set.kind as Kind);
    return { ...c, vary: c.vary.map((_, i) => over[i] ?? 0) };
  };
  const palettes = Math.max(1, ...set.roles.map((r) => (r.alts && (r.vary ?? VARIETY.palette) === VARIETY.palette ? r.alts.length + 1 : 1)));
  const wear = set.slots?.find((sl) => sl.name === 'wear');
  const options = [
    ...Array.from({ length: palettes }, (_, k) => [`palette ${k}`, bare({ [VARIETY.palette]: (k + 0.5) / palettes })] as const),
    ...Array.from({ length: wear?.options ?? 0 }, (_, k) => [`wear ${k}`, bare({ [wear!.vary]: (k + 0.5) / wear!.options })] as const),
  ];
  const cell = 30 * zoom;
  const rowH = 36 * zoom;
  const c = document.createElement('canvas');
  c.width = Math.max(chars.length, options.length) * cell + 20;
  c.height = rowH * 3 + 30;
  const g = c.getContext('2d')!;
  g.fillStyle = '#efe6d2';
  g.fillRect(0, 0, c.width, c.height);
  const figure = (ch: CharacterDef, clip: 'idle' | 'cheer', x: number, floor: number, label: string) => {
    const v = varietyOf(set, ch.vary);
    const name = v.clips[clip] ?? clip;
    const frames = (set.clips[name] ?? set.clips.idle).r;
    const hsl = coloursOf(set, ch);
    const main = mainOf(set, hsl);
    g.save();
    g.translate(x, floor);
    g.scale(zoom, zoom);
    const face = set.face ? { kit: set.face, mood: clip, facing: 1 } : undefined;
    drawFrame(g, frames[Math.floor(frames.length / 3)], hsl.map(paintOf), paintOf(main), shadowOf(main), 0.6, 7, 0, face, v.pick);
    g.restore();
    g.fillStyle = '#3d2e26';
    g.font = '600 13px sans-serif';
    g.fillText(label, x - cell / 2 + 4, floor - rowH * 0.86);
  };
  chars.forEach((ch, i) => {
    const v = varietyOf(set, ch.vary);
    const x = 10 + cell * (i + 0.5);
    figure(ch, 'idle', x, rowH * 0.92, `${i + 1} ${v.clips.idle ?? 'idle'} b${v.bounce.toFixed(1)} l${v.lean.toFixed(2)}`);
    figure(ch, 'cheer', x, rowH * 1.92, `${v.clips.cheer ?? 'cheer'} ${v.pick.join('')}`);
  });
  options.forEach(([label, ch], i) => figure(ch, 'idle', 10 + cell * (i + 0.5), rowH * 2.92, label));
  return c.toDataURL('image/png');
}
