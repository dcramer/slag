import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { generateLevel } from '../src/gen/level';
import { buildLevel, hasLevel, levelKey, offerLevel } from '../src/gen/level/pregen';
import { hashMatch } from '../src/net/snapshot';
import { type InputFrame, NO_INPUT } from '../src/sim/types';
import { THEME_IDS } from '../src/themes';

/** What a worker's postMessage does to a level. */
const overTheWire = <T>(v: T): T => structuredClone(v);

describe('levels built ahead', () => {
  it('survive the trip from a worker unchanged', { timeout: 30_000 }, () => {
    for (const theme of THEME_IDS) {
      const level = generateLevel(123, theme);
      expect(overTheWire(level), theme).toEqual(level);
    }
  });

  it("don't depend on what was generated before them", () => {
    const first = generateLevel(77, 'mine', { gravity: 1.35 });
    generateLevel(5, 'harbor', { gravity: 0.7, size: 'wide' });
    generateLevel(6, 'castle', { size: 'tall' });
    expect(generateLevel(77, 'mine', { gravity: 1.35 })).toEqual(first);
  });

  it('are handed over once, and generated as usual after that', () => {
    const req = { seed: 991, theme: 'farm' as const, profile: {} };
    const key = levelKey(req);
    const level = overTheWire(generateLevel(req.seed, req.theme, req.profile));
    offerLevel(key, level);
    expect(hasLevel(key)).toBe(true);
    expect(buildLevel(req.seed, req.theme, req.profile)).toBe(level);
    expect(hasLevel(key)).toBe(false);
    const again = buildLevel(req.seed, req.theme, req.profile);
    expect(again).not.toBe(level);
    expect(again).toEqual(level);
  });

  it('cover every level change a lobby or a finished match can make', () => {
    const down: Record<string, InputFrame> = { kb1: { ...NO_INPUT, downPressed: true } };
    const m = new Match(42);
    m.join('kb1');
    for (let press = 0; press < 3; press++) {
      const ahead = m.upcoming();
      m.step(down);
      expect(levelKey(ahead[0])).toBe(levelKey({ seed: m.seed, theme: m.themeOverride, profile: m.profileOverride() }));
    }
    const ahead = m.upcoming().map(levelKey);
    m.setRules({ ...m.rules, gravity: 'high' });
    expect(ahead).toContain(levelKey({ seed: m.seed, theme: m.themeOverride, profile: m.profileOverride() }));
  });

  it('leave a match identical to one that generated them itself', { timeout: 30_000 }, () => {
    const plain = new Match(9001);
    const ahead = new Match(9001);
    const [next] = ahead.upcoming();
    offerLevel(levelKey(next), overTheWire(generateLevel(next.seed, next.theme, next.profile)));
    const down: Record<string, InputFrame> = { kb1: { ...NO_INPUT, downPressed: true } };
    for (const m of [plain, ahead]) {
      m.join('kb1');
      m.step(down);
    }
    expect(hashMatch(ahead)).toBe(hashMatch(plain));
  });
});
