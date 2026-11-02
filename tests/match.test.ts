import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { canPlace, footprint } from '../src/sim/props';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });

/** Drive a match with a simple scripted bot: picks the first free card, places anywhere legal, holds right + jumps. */
function playMatch(seed: number, devices: string[], maxFrames = 60 * 60 * 6) {
  const m = new Match(seed);
  // The dumb bot may never finish or find a spot: races and placement must end.
  m.rules = { ...m.rules, raceSeconds: 20, placeSeconds: 5 };
  const tick = (fn: (d: string) => InputFrame) => m.step(Object.fromEntries(devices.map((d) => [d, fn(d)])));
  tick(() => press({ confirmPressed: true })); // join
  tick(() => press({ confirmPressed: true })); // ready
  let f = 0;
  const searched = new Set<number>();
  while (m.phase !== 'victory' && f++ < maxFrames) {
    if (m.phase === 'pick' && m.phaseFrame > 12) {
      for (const p of m.players) {
        if (p.claim >= 0) continue;
        const free = m.crate.find((c) => c.claimedBy < 0)!;
        p.cursor = { x: free.rect.x + 5, y: free.rect.y + 5 };
      }
      tick(() => press({ confirmPressed: true }));
    } else if (m.phase === 'place' && m.phaseFrame > 12) {
      if (m.phaseFrame === 13) searched.clear();
      // Teleport each cursor to the first legal spot (any rotation) to keep the test fast; search once per player.
      for (const p of m.players) {
        if (p.placed || searched.has(p.slot)) continue;
        searched.add(p.slot);
        const def = m.crate[p.claim].def;
        outer: for (let rot = 0; rot < 4; rot++) {
          for (let ty = 2; ty < m.level.h - 2; ty++) {
            for (let tx = 2; tx < m.level.w - 2; tx++) {
              if (canPlace(m.level, m.placed, def, rot, tx, ty)) {
                const cells = footprint(def, rot);
                const w = Math.max(...cells.map((c) => c[0])) + 1;
                const h = Math.max(...cells.map((c) => c[1])) + 1;
                p.rot = rot;
                p.cursor = { x: (tx + (w - 1) / 2) * 16 + 8, y: (ty + (h - 1) / 2) * 16 + 8 };
                break outer;
              }
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
  it('cycles pick → place → run → score headlessly', () => {
    const m = playMatch(1234, ['kb1', 'kb2', 'pad0']);
    expect(m.round).toBeGreaterThan(2);
    expect(m.placed.length).toBeGreaterThan(0);
  }, 60_000);

  it('reaches victory when someone keeps winning', () => {
    const m = new Match(77);
    m.step({ kb1: press({ confirmPressed: true }) });
    m.step({ kb1: press({ confirmPressed: true }) });
    expect(m.phase).toBe('pick');
    m.players[0].score = 49;
    // Force a finish by teleporting the runner onto the flag once the race starts.
    let f = 0;
    while (m.phase !== 'victory' && f++ < 60 * 60) {
      if (m.phase === 'pick') m.players[0].cursor = { x: m.crate[0].rect.x + 4, y: m.crate[0].rect.y + 4 };
      if (m.phase === 'place') {
        const p = m.players[0];
        outer: for (let ty = 2; ty < m.level.h - 2; ty++)
          for (let tx = 6; tx < m.level.w - 6; tx++) {
            p.cursor = { x: tx * 16 + 8, y: ty * 16 + 8 };
            if (m.canPlaceFor(p)) break outer;
          }
      }
      if (m.phase === 'run' && m.run && m.run.frame > 61) {
        const b = m.run.runners[0].body;
        b.x = m.level.goal.tx * 16 + 3;
        b.y = m.level.goal.ty * 16 + 2;
      }
      m.step({ kb1: press({ confirmPressed: m.phaseFrame % 20 === 15 }) });
      m.drainEvents();
    }
    expect(m.phase).toBe('victory');
    expect(m.winners).toEqual([0]);
  }, 60_000);

  it('is deterministic for the same seed and inputs', () => {
    const a = playMatch(42, ['kb1', 'kb2']);
    const b = playMatch(42, ['kb1', 'kb2']);
    expect(a.round).toBe(b.round);
    expect(a.players.map((p) => p.score)).toEqual(b.players.map((p) => p.score));
    expect(a.frame).toBe(b.frame);
  }, 60_000);
});

describe('big lobbies', () => {
  it('supports 8 players: join cap, 10-card crate on screen, everyone spawns', () => {
    const m = new Match(9);
    const devs = ['kb1', 'kb2', 'pad0', 'pad1', 'pad2', 'pad3', 'pad4', 'pad5', 'pad6'];
    for (const d of devs) m.join(d);
    expect(m.players.length).toBe(8);
    m.startMatch();
    expect(m.crate.length).toBe(10);
    for (const c of m.crate) {
      expect(c.rect.x).toBeGreaterThanOrEqual(0);
      expect(c.rect.x + c.rect.w).toBeLessThanOrEqual(768);
      expect(c.rect.y + c.rect.h).toBeLessThanOrEqual(432);
    }
    m.startRun();
    expect(m.run!.runners.length).toBe(8);
    for (let i = 0; i < 70; i++) m.step({});
    expect(m.run!.runners.every((r) => r.alive)).toBe(true);
  });
});
