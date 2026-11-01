import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { NO_INPUT, type InputFrame } from '../src/sim/types';
import { canPlace, footprint } from '../src/sim/props';

const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });

/** Drive a match with a simple scripted bot: picks the first free card, places anywhere legal, holds right + jumps. */
function playMatch(seed: number, devices: string[], maxFrames = 60 * 60 * 20) {
  const m = new Match(seed);
  const tick = (fn: (d: string) => InputFrame) => m.step(Object.fromEntries(devices.map((d) => [d, fn(d)])));
  tick(() => press({ confirmPressed: true })); // join
  tick(() => press({ confirmPressed: true })); // ready
  let f = 0;
  while (m.phase !== 'victory' && f++ < maxFrames) {
    if (m.phase === 'pick' && m.phaseFrame > 12) {
      for (const p of m.players) {
        if (p.claim >= 0) continue;
        const free = m.crate.find((c) => c.claimedBy < 0)!;
        p.cursor = { x: free.rect.x + 5, y: free.rect.y + 5 };
      }
      tick(() => press({ confirmPressed: true }));
    } else if (m.phase === 'place' && m.phaseFrame > 12) {
      // Teleport each cursor to the first legal spot to keep the test fast.
      for (const p of m.players) {
        if (p.placed) continue;
        const def = m.crate[p.claim].def;
        outer: for (let ty = 2; ty < m.level.h - 2; ty++) {
          for (let tx = 6; tx < m.level.w - 6; tx++) {
            if (canPlace(m.level, m.placed, def, 0, tx, ty)) {
              const cells = footprint(def, 0);
              const w = Math.max(...cells.map((c) => c[0])) + 1;
              const h = Math.max(...cells.map((c) => c[1])) + 1;
              p.cursor = { x: (tx + (w - 1) / 2) * 16 + 8, y: (ty + (h - 1) / 2) * 16 + 8 };
              break outer;
            }
          }
        }
      }
      tick(() => press({ confirmPressed: true }));
    } else if (m.phase === 'run') {
      tick(() => press({ right: true, jump: m.frame % 40 < 20, jumpPressed: m.frame % 40 === 0 }));
    } else if (m.phase === 'score' && m.phaseFrame > 95) {
      tick(() => press({ confirmPressed: true }));
    } else tick(() => NO_INPUT);
    m.drainEvents();
  }
  return m;
}

describe('match flow', () => {
  it('runs a full multiplayer match headlessly to victory', () => {
    const m = playMatch(1234, ['kb1', 'kb2', 'pad0']);
    expect(m.phase).toBe('victory');
    expect(m.round).toBeGreaterThan(1);
    expect(m.winners.length).toBeGreaterThan(0);
    expect(m.placed.length).toBeGreaterThan(0);
  }, 60_000);

  it('is deterministic for the same seed and inputs', () => {
    const a = playMatch(42, ['kb1', 'kb2']);
    const b = playMatch(42, ['kb1', 'kb2']);
    expect(a.round).toBe(b.round);
    expect(a.players.map((p) => p.score)).toEqual(b.players.map((p) => p.score));
    expect(a.frame).toBe(b.frame);
  }, 60_000);
});
