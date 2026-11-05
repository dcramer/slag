import { describe, expect, it } from 'vitest';
import { castEntries } from '../src/codex/cast';
import { CAST_ORDER, KIND_NAMES } from '../src/gen/character';

/** The codex's cast is the whole cast: every kind once, by its sound-alike name, with a line of its own. */
describe('codex cast', () => {
  it('shows every kind', () => {
    const entries = castEntries();
    expect(entries.map((e) => e.kind)).toEqual([...CAST_ORDER]);
    for (const e of entries) {
      expect(e.title).toBe(KIND_NAMES[e.kind]);
      expect(e.def.kind).toBe(e.kind);
      expect(e.note.length, `${e.kind} has no codex line`).toBeGreaterThan(0);
    }
    expect(new Set(entries.map((e) => e.note)).size).toBe(entries.length);
  });
});
