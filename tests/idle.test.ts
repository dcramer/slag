import { describe, expect, it } from 'vitest';
import { IDLE_FRAMES, LOBBY_IDLE_FRAMES, Match } from '../src/game/match';
import { POP_HOLD } from '../src/sim/constants';
import { DEFAULT_RULES } from '../src/game/rules';
import { type InputFrame, NO_INPUT } from '../src/sim/types';

/** The idle rules (docs/DESIGN.md → Players): every place the game waits on a player stops waiting on one who isn't there. */

const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });
const UNTIMED = { ...DEFAULT_RULES, pickSeconds: 0, placeSeconds: 0, raceSeconds: 0 };

/** Two players, 'a' active (a pointer that moves), 'b' who never touches anything after joining. */
function pair(): Match {
  const m = new Match(777, undefined, UNTIMED);
  m.join('a');
  m.join('b');
  return m;
}

const busy = (f: number): Record<string, InputFrame> => ({ a: press({ pointer: { x: 100 + (f % 7), y: 100 } }) });

function stepUntil(m: Match, done: () => boolean, inputs: (f: number) => Record<string, InputFrame>, max: number): number {
  for (let f = 0; f < max; f++) {
    if (done()) return f;
    m.step(inputs(f));
  }
  return -1;
}

describe('idle players', () => {
  it('the lobby starts without someone idle for a minute, and never on idle players alone', () => {
    const m = pair();
    m.step({ a: press({ confirmPressed: true }) });
    expect(m.phase).toBe('lobby');
    const waited = stepUntil(m, () => m.phase !== 'lobby', busy, LOBBY_IDLE_FRAMES + 10);
    expect(waited).toBeGreaterThan(LOBBY_IDLE_FRAMES - 10);
    expect(m.phase).toBe('pick');

    const alone = new Match(778);
    alone.join('x');
    for (let f = 0; f < LOBBY_IDLE_FRAMES + 30; f++) alone.step({});
    expect(alone.player(0)!.afk).toBe(true);
    expect(alone.phase).toBe('lobby');
  });

  it('untimed pick, place and race each stop waiting after IDLE_FRAMES, and input brings the player back', () => {
    const m = pair();
    m.startMatch();
    const b = m.player(1)!;
    // Pick: 'a' picks at once; 'b' is handed a card once idle.
    const pickA = m.crateItemAt(m.crate[0].rect.x + 4, m.crate[0].rect.y + 4);
    for (let f = 0; f < 12; f++) m.step({ a: press({ pointer: { x: m.crate[pickA].rect.x + 4, y: m.crate[pickA].rect.y + 4 }, confirmPressed: f === 11 }) });
    expect(m.player(0)!.claim).toBe(pickA);
    const toPlace = stepUntil(m, () => m.phase === 'place', busy, IDLE_FRAMES + 60);
    expect(toPlace).toBeGreaterThan(IDLE_FRAMES - 60);
    expect(b.afk).toBe(true);
    expect(b.claim).toBeGreaterThanOrEqual(0);
    // Any input clears it.
    m.step({ b: press({ left: true }) });
    expect(b.afk).toBeUndefined();
    // Place: 'a' has placed; 'b' never does, and the race starts once 'b' has been idle for the phase.
    m.player(0)!.placed = true;
    const toRun = stepUntil(m, () => m.phase === 'run', busy, IDLE_FRAMES + 60);
    expect(toRun).toBeGreaterThan(IDLE_FRAMES - 60);
    expect(m.player(1)!.afk).toBe(true);
    // Race with no timer: 'b' wakes up (an AFK runner would pop at GO), then stands still; 'a' holds a key, which is input.
    m.step({ b: press({ left: true }) });
    const hold = () => ({ a: press({ down: true }) });
    for (let f = 0; f < IDLE_FRAMES / 2; f++) m.step(hold());
    expect(m.run!.runners.find((r) => r.slot === 1)!.alive).toBe(true);
    expect(stepUntil(m, () => !m.run!.runners.find((r) => r.slot === 1)!.alive, hold, IDLE_FRAMES)).toBeGreaterThan(0);
    // 'a' stops touching anything: gone too, and the round ends.
    expect(
      stepUntil(
        m,
        () => m.phase === 'score',
        () => ({}),
        IDLE_FRAMES + POP_HOLD + 120, // an idle runner gives up through the self-destruct hold
      ),
    ).toBeGreaterThan(0);
    // Both ended the round AFK: one round counted towards losing the seat online, and any input wipes it.
    expect(m.players.map((p) => p.afkRounds)).toEqual([1, 1]);
    m.step({ a: press({ left: true }) });
    expect(m.player(0)!.afkRounds).toBeUndefined();
  });

  it('a finished runner may watch the rest of the race as long as it likes', () => {
    const m = pair();
    m.startMatch();
    m.startRun();
    const a = m.run!.runners.find((r) => r.slot === 0)!;
    a.finished = true; // as if at the flag
    for (let f = 0; f < IDLE_FRAMES + 30; f++) m.step({ b: press({ right: f % 2 === 0 }) });
    expect(m.player(0)!.afk).toBeUndefined();
  });

  it('a player watching leaves at the round boundary, after playing the round out', () => {
    const m = pair();
    m.startMatch();
    m.player(1)!.leaving = true;
    m.startRun();
    expect(m.players.length).toBe(2);
    expect(m.run!.runners.length).toBe(2);
    expect(
      stepUntil(
        m,
        () => m.phase === 'score',
        // Self-destruct is a hold that needs a fresh press in the race: hold alt, pressing again now and then.
        (f) => ({ a: press({ alt: true, altPressed: f % 400 === 0 }), b: press({ alt: true, altPressed: f % 400 === 0 }) }),
        4000,
      ),
    ).toBeGreaterThan(0);
    expect(m.players.map((p) => p.device)).toEqual(['a']);
    // A newcomer between rounds doesn't take a slot that still owns the leaver's parts or blood.
    m.blood.push({ tx: 1, ty: 1, face: 0, slot: 1, age: 0, at: 0 });
    expect(m.join('c')!.slot).toBe(2);
  });
});
