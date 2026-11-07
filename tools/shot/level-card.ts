/**
 * `pnpm shot levels`, one level at a time: load it in the page and prove it's the level `pnpm level` builds for the
 * same seed, pin the camera on all of it, mark its spawns and goal, and write the numbers a reviewer can't read off
 * the PNG (seed, set pieces, loot boxes) to a JSON card beside it.
 */
import { overview } from '../../src/game/view';
import { generateLevel } from '../../src/gen/level';
import type { LevelRequest } from '../../src/gen/level/pregen';
import { TILE, VIEW_W } from '../../src/sim/constants';
import { type Level, spawnsOf } from '../../src/sim/level';
import { footprintCells } from '../../src/sim/props';
import type { ThemeId } from '../../src/themes';
import { levelRequest, modeNamed } from '../lib/level-request';
import { game, levelForce, page } from './ctx';

/** A level on screen and what asked for it. */
export interface Shown {
  typed: string;
  /** The theme asked for; none lets the seed pick. */
  theme?: ThemeId;
  req: LevelRequest;
  level: Level;
}

/** The `pnpm level` command that dumps this level. */
function levelCommand({ typed, theme }: Shown): string {
  const knobs = Object.entries({
    theme,
    mode: game,
    size: levelForce.size,
    weather: levelForce.weather,
    concept: levelForce.concept,
    difficulty: levelForce.difficulty,
  });
  return ['pnpm level', typed, ...knobs.filter(([, v]) => v !== undefined).map(([k, v]) => `--${k} ${v}`)].join(' ');
}

/** `slagDebug.loadLevel(typed, theme)` with the camera pinned on the whole level; fails if the page built another level than the CLI would. */
export async function loadLevel(typed: string, theme: ThemeId | undefined): Promise<Shown> {
  const req = levelRequest(typed, theme, levelForce, game);
  const level = generateLevel(req.seed, req.theme, req.profile);
  const shown = { typed, theme, req, level };
  const got = await page.evaluate(
    ([x, t, pin]) => {
      const d = (window as any).slagDebug;
      d.loadLevel(x, t || undefined);
      d.renderer.pin = pin;
      const lv = d.match.level;
      return {
        seed: d.match.seed as number,
        tiles: (Array.from(lv.tiles) as number[]).join(''),
        pieces: (lv.setPieces as any[]).map((p) => p.def.name).join(),
      };
    },
    [typed, theme ?? '', overview(level)] as const,
  );
  if (got.seed !== req.seed || got.tiles !== level.tiles.join('') || got.pieces !== level.setPieces.map((p) => p.def.name).join())
    throw new Error(`levels: the page built another level for seed ${typed} (${got.seed}) than \`${levelCommand(shown)}\` (${req.seed})`);
  return shown;
}

/** Mark the spawns (S1…) and the goal (G) over the page, and return the level's box on screen, to shoot that and no more. */
export async function markLevel({ level }: Shown) {
  const cells = spawnsOf(level).map((c, i) => ({ ...c, label: `S${i + 1}`, color: '#3fe0ff' }));
  if (!spawnsOf(level).some((c) => c.tx === level.goal.tx && c.ty === level.goal.ty)) cells.push({ ...level.goal, label: 'G', color: '#ffd23f' });
  return page.evaluate(
    ([marks, ww, wh, tile, viewW]) => {
      const r = (window as any).slagDebug.renderer;
      const f = r.frameBox;
      const k = f.width / viewW;
      // An arrow in an array: the bundler wraps a named one in a __name the page doesn't have.
      const css = [
        (x: number, y: number) => {
          const v = r.worldToScreen(x, y);
          return { x: f.left + v.x * k, y: f.top + v.y * k };
        },
      ][0];
      document.getElementById('shot-marks')?.remove();
      const layer = document.createElement('div');
      layer.id = 'shot-marks';
      layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999';
      for (const m of marks) {
        const a = css(m.tx * tile, m.ty * tile);
        const b = css((m.tx + 1) * tile, (m.ty + 1) * tile);
        const el = document.createElement('div');
        el.style.cssText = `position:absolute;left:${a.x}px;top:${a.y}px;width:${b.x - a.x}px;height:${b.y - a.y}px;box-sizing:border-box;border:2px solid ${m.color}`;
        const tag = document.createElement('span');
        tag.textContent = m.label;
        tag.style.cssText = `position:absolute;left:50%;bottom:100%;transform:translateX(-50%);color:${m.color};font:bold 12px monospace;text-shadow:0 0 3px #000,0 0 3px #000`;
        el.append(tag);
        layer.append(el);
      }
      document.body.append(layer);
      const a = css(0, 0);
      const b = css(ww, wh);
      const x = Math.max(0, Math.round(a.x));
      const y = Math.max(0, Math.round(a.y));
      return { x, y, width: Math.min(innerWidth, Math.round(b.x)) - x, height: Math.min(innerHeight, Math.round(b.y)) - y };
    },
    [cells, level.w * TILE, level.h * TILE, TILE, VIEW_W] as const,
  );
}

/**
 * What a reviewer counts: the seed both ways, the level's make, and each set piece and loot box at the top-left
 * cell of its footprint (the `P` cells of `pnpm level`; a loot box's cells are absolute, its anchor 0,0).
 */
export function levelCard(shown: Shown, png: string) {
  const { typed, req, level } = shown;
  const p = level.profile!;
  const pieces = level.setPieces.map((s) => {
    const cells = footprintCells(s);
    if (!cells.length) cells.push([s.tx, s.ty]);
    const tx = Math.min(...cells.map(([x]) => x));
    const ty = Math.min(...cells.map(([, y]) => y));
    return { name: s.def.name, archetype: s.def.archetype, role: s.def.role, tx, ty };
  });
  return {
    png,
    seed: typed,
    seedNumber: req.seed,
    command: levelCommand(shown),
    theme: level.theme.id,
    mode: modeNamed(game),
    size: p.size,
    tiles: `${level.w}x${level.h}`,
    difficulty: p.difficulty,
    route: p.route,
    gravity: p.gravity,
    style: level.style,
    weather: level.weather?.kind ?? 'clear',
    landmark: level.landmark?.concept ?? null,
    spawns: spawnsOf(level),
    goal: level.goal,
    setPieces: pieces.filter((s) => s.archetype !== 'mystery'),
    boxes: pieces.filter((s) => s.archetype === 'mystery').map(({ tx, ty }) => ({ tx, ty })),
  };
}
