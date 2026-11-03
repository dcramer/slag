import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The mechanical half of docs/ART.md → World art, checked over src/render. Theme art (landmark skins and shells, set pieces,
 * decor) and crate-part art (every prop module's art, the part kit, held items) are held to all of it: they share a screen
 * with the terrain and must look drawn by the same hand. How to draw one is in src/render/AGENTS.md → Drawing a landmark,
 * hazard or decor piece; `pnpm shot artqa --theme T` and `pnpm shot cards --arch a,b` are how to see it.
 */

const RENDER = 'src/render';

/** Theme art: every decor file, every theme skin, and the module arts only set pieces use. A new theme's files match by name. */
const THEME_ART = [
  /^src\/render\/decor(-[a-z]+)?\.ts$/,
  /^src\/render\/props\/skins\/[a-z-]+\.ts$/,
  /^src\/render\/props\/modules\/(arm|cannon|cart|cavein|deco|deco-cab|deco-shells|flood|geyser|ladle|lob|neon|rotor|setpiece|sign|swinger|thaw|vehicle|wire)\.ts$/,
];

/** Crate-part art: every module's art (a new module's file matches by name), the part kit and the held items. */
const PART_ART = [/^src\/render\/props\/modules\/[a-z-]+\.ts$/, /^src\/render\/ink-parts\.ts$/, /^src\/render\/items(-[a-z]+)?\.ts$/];

/**
 * Files where a raw canvas stroke is light or a telegraph, not ink: the HUD, weather and the backdrop's bubbles, the cel pass,
 * and parts whose tell is a beam, an arc, a field or a dashed path. Theme art never goes on this list: it calls `zap` (kit.ts)
 * for an arc and `stroke`/`line` (ink.ts) for everything else.
 */
const RAW_STROKE_OK: Record<string, string> = {
  'src/render/kit.ts': 'zap: electric arcs on the glow layer',
  'src/render/hud.ts': 'HUD',
  'src/render/hud-kit.ts': 'HUD plates',
  'src/render/renderer.ts': 'debug overlay and place-phase guides',
  'src/render/cel.ts': 'Canvas2D fallback of the cel pass',
  'src/render/weather.ts': 'rain streaks on the backdrop',
  'src/render/background.ts': 'bubbles on the backdrop',
  'src/render/ink-container.ts': 'the place ghost of a container',
  'src/render/props/index.ts': "a place ghost's motion path",
  'src/render/props/ride.ts': "a place ghost's ride loop and link mark",
  'src/render/props/status.ts': "a frozen runner's ice shell",
  'src/render/props/modules/tesla.ts': 'arcs',
  'src/render/props/modules/laser.ts': 'the beam and its aim line',
  'src/render/props/modules/magnet.ts': "the field's reach",
  'src/render/props/modules/fan.ts': 'wind streaks',
  'src/render/props/modules/flame.ts': "the jet's hot core",
  'src/render/props/modules/pipe.ts': "a pipe pair's tether while placing",
  'src/render/props/modules/dropper.ts': 'the drop telegraph',
  'src/render/props/modules/bomb.ts': "the blast's reach",
  'src/render/items-extra.ts': 'held-item effects',
};

function files(p: string): string[] {
  if (statSync(p).isFile()) return [p];
  return readdirSync(p).flatMap((e) => files(join(p, e)));
}

/** Source with comments blanked (same length, same lines), so prose and doc comments can't match. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, ' '));
}

const lineOf = (src: string, at: number) => src.slice(0, at).split('\n').length;
const all = files(RENDER).filter((f) => f.endsWith('.ts'));
const themeArt = all.filter((f) => THEME_ART.some((r) => r.test(f)));
const partArt = all.filter((f) => PART_ART.some((r) => r.test(f)));
/** Everything held to the ink rules below. */
const held = [...new Set([...themeArt, ...partArt])];

/** Every `re` match in the files, as `file:line: text`. */
function hits(list: readonly string[], re: RegExp, keep: (m: RegExpMatchArray, src: string) => boolean = () => true): string[] {
  const out: string[] = [];
  for (const f of list) {
    const src = code(readFileSync(f, 'utf8'));
    for (const m of src.matchAll(re)) if (keep(m, src)) out.push(`${f}:${lineOf(src, m.index!)}: ${src.split('\n')[lineOf(src, m.index!) - 1].trim()}`);
  }
  return out;
}

/** The arguments of the call whose `(` is at `open`, split at top-level commas. */
function args(src: string, open: number): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = open + 1;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') {
      depth--;
      if (depth === 0) {
        if (src.slice(start, i).trim()) out.push(src.slice(start, i));
        return out;
      }
    } else if (c === ',' && depth === 1) {
      out.push(src.slice(start, i));
      start = i + 1;
    }
  }
  return out;
}

/** Lightness (0..1) of a CSS colour literal, or null for anything that isn't one. */
function lightness(lit: string): number | null {
  let rgb: number[] | null = null;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(lit);
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].replace(/./g, '$&$&') : hex[1];
    rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  const fn = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(lit);
  if (fn) rgb = [Number(fn[1]), Number(fn[2]), Number(fn[3])];
  const hsl = /^hsla?\(\s*[\d.]+(?:deg)?[\s,]+[\d.]+%?[\s,]+([\d.]+)%/i.exec(lit);
  if (hsl) return Number(hsl[1]) / 100;
  if (lit === 'black') return 0;
  if (!rgb) return null;
  return (Math.max(...rgb) + Math.min(...rgb)) / 2 / 255;
}

describe('ink rules (docs/ART.md → World art)', () => {
  it('finds the theme and part art it checks', () => {
    expect(themeArt.length).toBeGreaterThan(20);
    expect(themeArt).toContain('src/render/props/modules/deco-shells.ts');
    expect(partArt.length).toBeGreaterThan(40);
    for (const f of ['src/render/props/modules/launcher.ts', 'src/render/ink-parts.ts', 'src/render/items.ts', 'src/render/items-extra.ts'])
      expect(partArt).toContain(f);
  });

  it('no raw canvas strokes in world art', () => {
    const bad = hits(
      all.filter((f) => !(f in RAW_STROKE_OK) && !f.startsWith('src/render/hud/') && !f.startsWith('src/render/cast/')),
      /\.(stroke|strokeRect)\(\s*\)?/g,
    );
    expect(
      bad,
      `A canvas stroke is an even, ruled line: it reads as a vector diagram next to inked art. Draw lines with stroke() or line() from src/render/ink.ts (a bar with an ink rim: bar()/barLine() from ink-props.ts), and an electric arc with zap() from kit.ts:\n${bad.join('\n')}`,
    ).toEqual([]);
  });

  it('theme and part art never ink in near-black INK', () => {
    const bad = hits(held, /\bINK\b/g);
    expect(
      bad,
      `A line is a dark of what it outlines, never one black (docs/ART.md, The line). Outline with part() or pen(..., inkFor(base)), rim a bar with bar()/barLine() (ink-props.ts), and mark a surface with tick(..., css(surface, -30)). INK is for marks with no one colour under them, and a theme piece or a part always has one:\n${bad.join('\n')}`,
    ).toEqual([]);
  });

  it('theme and part art pass their colour to the pen helpers that default to INK', () => {
    // Argument counts at which pen, tick and dot stop falling back to their near-black default.
    const need: Record<string, number> = { pen: 7, tick: 8, dot: 7 };
    const bad = hits(held, /(?<![.\w])(pen|tick|dot)\(/g, (m, src) => args(src, m.index! + m[0].length - 1).length < need[m[1]]);
    expect(
      bad,
      `pen(), tick() and dot() fall back to near-black INK when no colour is passed. Pass a dark of the surface: pen(g, pts, seed, thin, thick, 3, inkFor(base)), tick(..., w, seed, css(surface, -30)), dot(..., fleck, inkFor(plate)):\n${bad.join('\n')}`,
    ).toEqual([]);
  });

  it('theme and part art have no hard-coded near-black colours', () => {
    const bad = hits(held, /'(#[0-9a-fA-F]{3,6}|rgba?\([^']*\)|hsla?\([^']*\)|black)'|`(rgba?\([^`$]*)/g, (m) => {
      const l = lightness(m[1] ?? m[2]);
      return l !== null && l < 0.16;
    });
    expect(
      bad,
      `A hard-coded near-black is the one black docs/ART.md bans: it won't recolour with the seed and reads as a hole punched in the page. Use a dark of the colour under it, css(base, -30) or inkFor(base), or a theme palette colour:\n${bad.join('\n')}`,
    ).toEqual([]);
  });

  it('theme and part art shade with flat tones, not gradients', () => {
    const bad = hits(held, /\b(createLinearGradient|createRadialGradient|createConicGradient|vgrad)\(/g);
    expect(
      bad,
      `World art is flat tones cut as shapes (docs/ART.md, Tone): no gradients. Use tone() or part() from ink-props.ts for two tones and a hard shadow, and glowDot() on rc.g only for something hot:\n${bad.join('\n')}`,
    ).toEqual([]);
  });
});
