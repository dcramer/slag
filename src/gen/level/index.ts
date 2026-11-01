import { deriveSeed, Rng } from '../../core/rng';
import { LEVEL_H, LEVEL_W } from '../../sim/constants';
import type { Level } from '../../sim/level';
import { analyzeReach } from '../../sim/reach';
import { pickThemeId, type ThemeId } from '../../themes';
import { SET_PIECES } from '../setpieces';
import { generateTheme, type Theme } from '../theme';
import { SCULPTORS } from './sculptors';
import type { Shape } from './types';

export type { SculptCtx, Sculptor, Shape } from './types';

const MAX_ATTEMPTS = 60;

/** Attempts used by the last generateLevel call (for tools/tests). */
export let lastGenAttempts = 0;

/**
 * Level pipeline: pick theme → generate look → sculpt terrain (retrying
 * until it passes validation) → place theme set pieces.
 *
 * Validation today: the goal must be reachable without props, using the
 * real controller (src/sim/reach.ts). The worldgen owner may relax this to
 * "reachable after placing a couple of bridge props" — see AGENTS.md.
 */
export function generateLevel(seed: number, themeOverride?: ThemeId): Level {
  const themeId = themeOverride ?? pickThemeId(seed);
  const theme = generateTheme(seed, themeId);
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    lastGenAttempts = attempt + 1;
    const rng = new Rng(deriveSeed(seed, `level:${attempt}`));
    const shape = SCULPTORS[themeId]({ rng, themeId, theme, attempt });
    const level = toLevel(seed, shape, theme);
    if (!isAcceptable(level)) continue;
    level.setPieces = SET_PIECES[themeId](new Rng(deriveSeed(seed, `setpieces:${attempt}`)), level);
    return level;
  }
  return toLevel(seed, fallbackShape(), theme);
}

export function isAcceptable(level: Level): boolean {
  return analyzeReach(level).goalReached;
}

function toLevel(seed: number, s: Shape, theme: Theme): Level {
  return {
    seed,
    w: LEVEL_W,
    h: LEVEL_H,
    tiles: s.tiles,
    spawn: s.spawn,
    goal: s.goal,
    protectedRects: s.protectedRects,
    theme,
    style: s.style,
    version: 0,
    setPieces: [],
  };
}

/** Flat floor, always solvable. Only used if every candidate fails. */
function fallbackShape(): Shape {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  const row = LEVEL_H - 6;
  for (let y = row + 1; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
  return {
    tiles,
    spawn: { tx: 2, ty: row },
    goal: { tx: LEVEL_W - 3, ty: row },
    protectedRects: [
      { x: 0, y: row - 3, w: 5, h: 5 },
      { x: LEVEL_W - 5, y: row - 3, w: 5, h: 5 },
    ],
    style: 'fallback',
  };
}

export function cloneLevel(l: Level): Level {
  return { ...l, tiles: new Uint8Array(l.tiles), protectedRects: l.protectedRects.map((r) => ({ ...r })), setPieces: l.setPieces.slice() };
}
