import { footprintCells } from '../../sim/props';
import { BRIDGE_W } from './validate';
import { deriveSeed, Rng } from '../../core/rng';
import type { Level, LevelProfile } from '../../sim/level';
import { pickThemeId, type ThemeId } from '../../themes';
import { SET_PIECE_UID, SET_PIECES } from '../setpieces';
import { generateTheme, type Theme } from '../theme';
import { setProbeGravity } from './probe';
import { type ProfileOverride, rollProfile } from './profile';
import { FALLBACK_SCULPTOR, SCULPTORS } from './sculptors';
import type { Shape } from './types';
import { type Bridge, judge } from './validate';

export type { BridgeHint, SculptCtx, Sculptor, Shape } from './types';
export { describeProfile, GRAVITY, type GravityClass, gravityClass, type ProfileOverride, rollProfile } from './profile';
export { BRIDGE_W, type Bridge, canPlaceBridge, isAcceptable, judge, MAX_BRIDGES, withBridges } from './validate';

const MAX_ATTEMPTS = 30;
const LEGACY_ATTEMPTS = 20;

/** Diagnostics about the last generateLevel call (for tools/tests). */
export interface GenInfo {
  attempts: number;
  /** A bridge solution (left cells) when the level needs props; [] if solvable bare. */
  bridges: Bridge[];
  fallback: boolean;
}

export let lastGenInfo: GenInfo = { attempts: 0, bridges: [], fallback: false };
/** Attempts used by the last generateLevel call (kept for older callers). */
export let lastGenAttempts = 0;

/**
 * Level pipeline: pick theme → roll the variety profile (size, density,
 * route, hazards; ./profile.ts) → generate look → sculpt terrain (retrying
 * until it passes the solvability policy in ./validate.ts) → place theme
 * set pieces. If the theme sculptor keeps failing, the legacy sculptor gets
 * a few tries before the flat floor; both count as `fallback` in
 * lastGenInfo (tests assert neither happens).
 */
export function generateLevel(seed: number, themeOverride?: ThemeId, profileOverride?: ProfileOverride): Level {
  const themeId = themeOverride ?? pickThemeId(seed);
  const theme = generateTheme(seed, themeId);
  const profile = rollProfile(seed, themeId, profileOverride);
  // Sculptor helpers size gaps/steps from jumps measured at this level's gravity.
  setProbeGravity(profile.gravity);
  for (let attempt = 0; attempt < MAX_ATTEMPTS + LEGACY_ATTEMPTS; attempt++) {
    const rng = new Rng(deriveSeed(seed, `level:${attempt}`));
    const sculptor = attempt < MAX_ATTEMPTS ? SCULPTORS[themeId] : FALLBACK_SCULPTOR;
    const shape = sculptor({ rng, themeId, theme, attempt, profile });
    const level = toLevel(seed, shape, theme, profile);
    const v = judge(level, shape.bridgeHints);
    if (!v.ok) continue;
    // A crossing meant to need props that turned out jumpable: re-roll (late attempts accept anything valid).
    // Big levels are costly to re-sculpt and judge, so they get fewer of these rerolls.
    const rerolls = profile.size === 'classic' ? MAX_ATTEMPTS - 10 : 4;
    if (shape.wantsProps && v.bridges.length === 0 && attempt < rerolls) continue;
    lastGenAttempts = attempt + 1;
    lastGenInfo = { attempts: attempt + 1, bridges: v.bridges, fallback: attempt >= MAX_ATTEMPTS };
    level.solution = v.bridges;
    // Set pieces must never block the known prop solution: drop any that reserve one of its cells.
    const pieces = SET_PIECES[themeId](new Rng(deriveSeed(seed, `setpieces:${attempt}`)), level, { count: profile.hazards, danger: profile.danger });
    const needed = new Set(v.bridges.flatMap((b) => Array.from({ length: BRIDGE_W }, (_, i) => b.y * level.w + b.x + i)));
    // (The placer already avoids these cells; this is a safety net. Keep uids contiguous.)
    level.setPieces = pieces.filter((p) => !footprintCells(p).some(([x, y]) => needed.has(y * level.w + x))).map((p, i) => ({ ...p, uid: SET_PIECE_UID + i }));
    return level;
  }
  lastGenAttempts = MAX_ATTEMPTS + LEGACY_ATTEMPTS;
  lastGenInfo = { attempts: lastGenAttempts, bridges: [], fallback: true };
  return toLevel(seed, fallbackShape(profile.w, profile.h), theme, profile);
}

function toLevel(seed: number, s: Shape, theme: Theme, profile: LevelProfile): Level {
  if (s.tiles.length !== s.w * s.h) throw new Error(`shape ${s.style}: tiles ${s.tiles.length} != ${s.w}×${s.h}`);
  return {
    seed,
    w: s.w,
    h: s.h,
    gravity: profile.gravity,
    profile,
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
function fallbackShape(LEVEL_W: number, LEVEL_H: number): Shape {
  const tiles = new Uint8Array(LEVEL_W * LEVEL_H);
  const row = LEVEL_H - 6;
  for (let y = row + 1; y < LEVEL_H; y++) for (let x = 0; x < LEVEL_W; x++) tiles[y * LEVEL_W + x] = 1;
  return {
    w: LEVEL_W,
    h: LEVEL_H,
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
