import { describe, expect, it } from 'vitest';
import { hashString, parseSeed } from '../src/core/rng';
import { Match } from '../src/game/match';
import { DEFAULT_RULES } from '../src/game/rules';
import { generateLevel, type ProfileOverride } from '../src/gen/level';
import type { Level } from '../src/sim/level';
import type { ThemeId } from '../src/themes';
import { levelRequest } from '../tools/lib/level-request';
import type { ModeId } from '../src/game/modes';

/** What tells two levels apart: their tiles, ends, set pieces and profile. */
function levelHash(l: Level): number {
  const pieces = l.setPieces.map((p) => `${p.def.name}@${p.tx},${p.ty}/${p.rot}`);
  return hashString(`${l.w}x${l.h}|${l.tiles.join('')}|${JSON.stringify([l.spawn, l.spawns, l.goal, pieces, l.profile])}`);
}

/**
 * The level `pnpm shot levels` shows: the page's match, its mode set from `?mode=` and its knobs from the URL
 * (src/debug.ts), then `slagDebug.loadLevel(typed, theme)`.
 */
function shotLevel(typed: string, theme: ThemeId, mode: ModeId, force: ProfileOverride): Level {
  const m = new Match(parseSeed(typed), theme, { ...DEFAULT_RULES, mode });
  if (Object.keys(force).length) {
    m.forceProfile = force;
    m.newLevel(parseSeed(typed), theme);
  }
  return m.level;
}

describe('one seed, one level', () => {
  // The seeds the shot of a brawl's mine and volcano and `pnpm level` once disagreed on, a seed past base 36's digits, and each mode.
  const cases: [string, ThemeId, ModeId, ProfileOverride][] = [
    ['17', 'mine', 'brawl', {}],
    ['15', 'volcano', 'brawl', { difficulty: 'hard' }],
    ['lv0', 'farm', 'race', {}],
    ['a-long-seed', 'harbor', 'race', { difficulty: 'gentle' }],
    ['3', 'castle', 'slag', {}],
  ];
  it.each(cases)('seed %s in %s, %s: pnpm level builds the level the shot shows', (typed, theme, mode, force) => {
    const req = levelRequest(typed, theme, force, mode);
    expect(levelHash(generateLevel(req.seed, req.theme, req.profile))).toBe(levelHash(shotLevel(typed, theme, mode, force)));
  });
});
