import { describe, expect, it, vi } from 'vitest';
import { Match } from '../src/game/match';
import { DEFAULT_RULES, type MatchRules } from '../src/game/rules';
import { rollKind } from '../src/gen/level/weather';
import { applyAction, newNetState, sanitizeRules } from '../src/net/actions';
import { cloneSnap, hashMatch, restoreMatch, snapshotMatch } from '../src/net/snapshot';
import { NetSession } from '../src/net/session';
import { LoopbackHub } from '../src/net/transport';
import { parseAction } from '../src/net/wire';
import { levelKey } from '../src/sim/level';
import { loadRules, saveRules } from '../src/ui/rule-prefs';

/** A legal value other than the default for every rule. Add a rule and this test fails until it says so. */
const CHANGED: MatchRules = {
  mode: 'slag',
  targetScore: 80,
  maxRounds: 25,
  pickSeconds: 20,
  placeSeconds: 30,
  raceSeconds: 60,
  gravity: 'low',
  weather: false,
  difficulty: 'hard',
  bloodRounds: 3,
  secretParts: true,
  parts: 'all',
  private: true,
};

/** A seed whose farm level rolls weather, so turning the rule off changes something. */
function weatherySeed(): number {
  for (let s = 1; ; s++) if (rollKind(s, 'farm') === 'mist') return s;
}

const rulesAct = (m: Match, rules: MatchRules) => applyAction(m, newNetState(), { t: 'rules', rules });

describe('sanitizeRules', () => {
  it('keeps every rule', () => {
    expect(Object.keys(CHANGED).sort()).toEqual(Object.keys(DEFAULT_RULES).sort());
    expect(sanitizeRules(CHANGED)).toEqual(CHANGED);
    for (const k of Object.keys(CHANGED) as (keyof MatchRules)[]) {
      if (k === 'maxRounds') continue; // Travels with targetScore: see below.
      const one = { ...DEFAULT_RULES, [k]: CHANGED[k] };
      expect(sanitizeRules(one)[k], k).toBe(CHANGED[k]);
    }
  });

  it('turns junk into defaults, whatever the field', () => {
    const junk = {
      pickSeconds: 7,
      placeSeconds: -1,
      raceSeconds: 'x',
      gravity: 'sideways',
      weather: 'maybe',
      bloodRounds: 99,
      secretParts: 1,
      parts: 'heaps',
    } as unknown as Partial<MatchRules>;
    expect(sanitizeRules(junk)).toEqual(DEFAULT_RULES);
  });

  it('never lets rounds drift away from points', () => {
    expect(sanitizeRules({ targetScore: 30, maxRounds: 1e9 }).maxRounds).toBe(10);
  });
});

describe('Private', () => {
  it('starts every lobby public, whatever the host chose last time', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
    try {
      saveRules(CHANGED);
      expect(loadRules()).toEqual({ ...CHANGED, private: false });
      expect(JSON.parse([...store.values()][0])).not.toHaveProperty('private');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('changes nothing in the match: no rebuild, the same level', () => {
    const m = new Match(7);
    const key = levelKey(m.level);
    rulesAct(m, { ...m.rules, private: true });
    expect(m.rules.private).toBe(true);
    expect(levelKey(m.level)).toBe(key);
  });
});

describe('level-shaping rules in the lobby', () => {
  it('a gravity change through the rules action rebuilds the level', () => {
    const m = new Match(4242);
    const before = m.level;
    rulesAct(m, { ...m.rules, gravity: 'high' });
    expect(m.level).not.toBe(before);
    expect(m.level.gravity).toBe(1.35);
  });

  it('turning weather off clears the level at once, and back on brings it back', () => {
    const m = new Match(weatherySeed(), 'farm');
    expect(m.level.weather?.kind).toBe('mist');
    rulesAct(m, { ...m.rules, weather: false });
    expect(m.level.weather?.kind).toBe('clear');
    rulesAct(m, { ...m.rules, weather: true });
    expect(m.level.weather?.kind).toBe('mist');
  });

  it('rebuilds for exactly the rules the level is built from', () => {
    const seed = weatherySeed();
    const rebuilt = (Object.keys(CHANGED) as (keyof MatchRules)[])
      .filter((k) => k !== 'maxRounds')
      .filter((k) => {
        const m = new Match(seed, 'farm');
        const before = m.level;
        rulesAct(m, { ...m.rules, [k]: CHANGED[k], ...(k === 'targetScore' ? { maxRounds: CHANGED.maxRounds } : {}) });
        expect(m.rules[k], k).toBe(CHANGED[k]);
        return m.level !== before;
      });
    expect(rebuilt.sort()).toEqual(['difficulty', 'gravity', 'mode', 'weather']);
  });

  it('a difficulty rebuilds the level at it, and Varies gives the seed its own back', () => {
    const m = new Match(4242);
    const own = m.level;
    for (const d of ['gentle', 'medium', 'hard'] as const) {
      rulesAct(m, { ...m.rules, difficulty: d });
      expect(m.level.profile?.difficulty).toBe(d);
    }
    rulesAct(m, { ...m.rules, difficulty: 'varies' });
    expect(m.level.profile).toEqual(own.profile);
    expect([...m.level.tiles]).toEqual([...own.tiles]);
  });

  it('survives a change to some other rule, without a rebuild', () => {
    const m = new Match(4242);
    rulesAct(m, { ...m.rules, gravity: 'low', weather: false });
    const level = m.level;
    rulesAct(m, { ...m.rules, pickSeconds: 20 });
    expect(m.rules).toMatchObject({ gravity: 'low', weather: false, pickSeconds: 20 });
    expect(m.level).toBe(level);
  });

  it('leaves the level alone once the match is under way', () => {
    const m = new Match(4242);
    m.join('a:kb1');
    m.startMatch();
    const level = m.level;
    const rules = m.rules;
    rulesAct(m, { ...m.rules, gravity: 'high' });
    expect(m.level).toBe(level);
    expect(m.rules).toBe(rules);
  });

  it('tells the renderer caches it is another level, at the same seed, size and version', () => {
    const m = new Match(weatherySeed(), 'farm');
    const a = levelKey(m.level);
    rulesAct(m, { ...m.rules, weather: false });
    const b = levelKey(m.level);
    expect(b).not.toBe(a);
    rulesAct(m, { ...m.rules, gravity: 'low' });
    expect(levelKey(m.level)).not.toBe(b);
    // A crater is the same level: it only bumps the version, which the bake keys on as well.
    const key = levelKey(m.level);
    m.level.version++;
    expect(levelKey(m.level)).toBe(key);
  });

  it('a joining guest gets the same level and rules, whatever it had', () => {
    const host = new Match(weatherySeed(), 'farm');
    rulesAct(host, { ...host.rules, gravity: 'low', weather: false, bloodRounds: 0 });
    const guest = new Match(host.seed, 'farm');
    expect(guest.level.weather?.kind).toBe('mist');
    restoreMatch(guest, cloneSnap(snapshotMatch(host)));
    expect(guest.rules).toEqual(host.rules);
    expect(guest.level.weather).toEqual(host.level.weather);
    expect(guest.level.gravity).toBe(host.level.gravity);
    expect([...guest.level.tiles]).toEqual([...host.level.tiles]);
    expect(hashMatch(guest)).toBe(hashMatch(host));
  });

  it('reaches every peer in the room at once, and a late joiner', () => {
    const TICK = 1000 / 60;
    const hub = new LoopbackHub({ latency: 40, jitter: 10, seed: 5 });
    const peers: NetSession[] = [];
    const join = (id: string) => {
      const s = new NetSession({ transport: hub.transport(id), match: new Match(weatherySeed(), 'farm'), now: () => hub.now });
      peers.push(s);
      return s;
    };
    const run = (n: number) => {
      for (let i = 0; i < n; i++) {
        hub.advance(TICK);
        for (const s of peers) {
          s.tick({});
          s.drainEvents();
        }
      }
    };
    const a = join('aaaa');
    run(5);
    const b = join('bbbb');
    run(40);
    expect(b.match.level.weather?.kind).toBe('mist');
    a.act({ t: 'rules', rules: { ...a.match.rules, gravity: 'low', weather: false } });
    run(40);
    join('cccc');
    run(60);
    for (const s of peers) {
      expect(s.match.phase).toBe('lobby');
      expect(s.match.rules).toMatchObject({ gravity: 'low', weather: false });
      expect(s.match.level.weather?.kind ?? 'clear').toBe('clear');
      expect(s.match.level.gravity).toBe(0.7);
      expect(levelKey(s.match.level)).toBe(levelKey(a.match.level));
      expect([...s.match.level.tiles]).toEqual([...a.match.level.tiles]);
    }
    // Freeze the host and let the guests catch up, so every hash is taken at the same frame.
    const host = peers.find((s) => s.isHost)!;
    host.flush();
    for (let i = 0; i < 200; i++) {
      hub.advance(TICK);
      for (const s of peers) if (s !== host) s.tick({});
    }
    for (const s of peers) expect(hashMatch(s.match)).toBe(hashMatch(host.match));
  });
});

/** A level action as it comes off the wire: what doesn't parse never reaches the match. */
const levelAct = (m: Match, seed: number, theme: unknown) => {
  const a = parseAction({ t: 'level', seed, theme });
  if (a) applyAction(m, newNetState(), a);
};

describe('choosing the lobby level', () => {
  it('builds the chosen seed in the chosen theme, and everyone readies again', () => {
    const m = new Match(4242);
    m.join('a:kb1');
    m.players[0].ready = true;
    levelAct(m, 777, 'glacier');
    expect(m.seed).toBe(777);
    expect(m.level.theme.id).toBe('glacier');
    expect(m.players[0].ready).toBe(false);
    // A chosen theme stays for the next level; none gives the seed its own.
    m.pickLevel(778, m.themeOverride);
    expect(m.level.theme.id).toBe('glacier');
    levelAct(m, 777, null);
    expect(m.themeOverride).toBeUndefined();
    expect(m.level.theme.id).toBe(new Match(777).level.theme.id);
  });

  it('ignores a theme this build lacks, a seed that is not one, and any change once the match is under way', () => {
    const m = new Match(4242);
    const level = m.level;
    levelAct(m, 777, 'atlantis');
    levelAct(m, 1.5, null);
    expect(m.level).toBe(level);
    m.join('a:kb1');
    m.startMatch();
    const playing = m.level;
    levelAct(m, 777, 'farm');
    expect(m.level).toBe(playing);
  });

  it('is the host’s: a guest’s choice never reaches the room, the host’s reaches everyone', () => {
    const TICK = 1000 / 60;
    const hub = new LoopbackHub({ latency: 40, jitter: 10, seed: 6 });
    const peers = ['aaaa', 'bbbb'].map((id) => new NetSession({ transport: hub.transport(id), match: new Match(4242), now: () => hub.now }));
    const run = (n: number) => {
      for (let i = 0; i < n; i++) {
        hub.advance(TICK);
        for (const s of peers) {
          s.tick({});
          s.drainEvents();
        }
      }
    };
    run(60);
    const host = peers.find((s) => s.isHost)!;
    const guest = peers.find((s) => !s.isHost)!;
    guest.act({ t: 'level', seed: 999, theme: 'space' });
    run(40);
    for (const s of peers) expect(s.match.seed).toBe(4242);
    host.act({ t: 'level', seed: 999, theme: 'space' });
    run(40);
    for (const s of peers) {
      expect(s.match.seed).toBe(999);
      expect(s.match.level.theme.id).toBe('space');
      expect([...s.match.level.tiles]).toEqual([...host.match.level.tiles]);
    }
  });
});
