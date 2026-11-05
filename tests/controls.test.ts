import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { DEFAULT_RULES } from '../src/game/rules';
import { defaultSettings, keyboardDevices } from '../src/input/bindings';
import { NO_INPUT } from '../src/sim/types';
import { sanitizeName } from '../src/ui/profile';

describe('bindings', () => {
  it('single keyboard player gets WASD and arrows by default', () => {
    const s = defaultSettings();
    const [kb] = keyboardDevices(s);
    expect(keyboardDevices(s).length).toBe(1);
    expect(kb.profile.left).toEqual(expect.arrayContaining(['KeyA', 'ArrowLeft']));
    expect(kb.profile.right).toEqual(expect.arrayContaining(['KeyD', 'ArrowRight']));
  });
  it('split keyboard yields two devices with disjoint keys', () => {
    const s = { ...defaultSettings(), splitKeyboard: true };
    const [a, b] = keyboardDevices(s);
    const keysA = new Set(Object.values(a.profile).flat());
    for (const k of Object.values(b.profile).flat()) expect(keysA.has(k)).toBe(false);
  });
});

describe('names', () => {
  it('sanitizes user names', () => {
    expect(sanitizeName('  Dave  the  Rave!!<script>  ')).toBe('Dave the Rav');
    expect(sanitizeName('🙂')).toBe('');
  });
});

describe('rules & pointer', () => {
  const lobbyTo = (m: Match) => {
    m.join('kb1');
    m.join('pad0');
    m.startMatch();
  };
  it('defaults: 15s pick timer, untimed place and race', () => {
    expect(DEFAULT_RULES).toMatchObject({ pickSeconds: 15, placeSeconds: 15, raceSeconds: 0 });
    const m = new Match(3);
    lobbyTo(m);
    expect(m.phaseTimeLeft).toBe(15 * 60);
  });
  it('pick timeout hands out leftovers deterministically', () => {
    const run = () => {
      const m = new Match(11);
      lobbyTo(m);
      for (let i = 0; i < 15 * 60 + 2; i++) m.step({});
      return m.players.map((p) => p.claim);
    };
    const a = run();
    expect(a.every((c) => c >= 0)).toBe(true);
    expect(new Set(a).size).toBe(a.length);
    expect(run()).toEqual(a);
  });
  it('mouse pointer snaps the cursor and a click picks the hovered card', () => {
    const m = new Match(5);
    lobbyTo(m);
    for (let i = 0; i < 12; i++) m.step({});
    const r = m.crate[2].rect;
    m.step({ kb1: { ...NO_INPUT, pointer: { x: r.x + 5, y: r.y + 5 }, confirmPressed: true } });
    expect(m.players[0].claim).toBe(2);
  });
  it('race has no time limit by default', () => {
    const m = new Match(5);
    lobbyTo(m);
    m.startRun();
    expect(m.run!.timeLeft).toBe(Infinity);
  });
  it('custom names stick', () => {
    const m = new Match(5);
    m.join('kb1');
    m.setName(0, 'Dave');
    expect(m.players[0].character.name).toBe('Dave');
  });
});

describe('rooms', async () => {
  const { newRoomCode, roomFromPath, roomSeed } = await import('../src/game/room');
  it('parses /r/<code> and seeds deterministically', () => {
    expect(roomFromPath('/r/k7qx2')).toBe('K7QX2');
    expect(roomFromPath('/')).toBeNull();
    expect(roomFromPath('/r/')).toBeNull();
    expect(roomSeed('K7QX2')).toBe(roomSeed('K7QX2'));
    expect(newRoomCode(Math.random)).toMatch(/^[A-Z2-9]{5}$/);
  });
});
