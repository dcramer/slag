import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateCharacter, hueApart, MIN_HUE_APART, PLAYER_COLORS, withColor } from '../src/gen/character';
import { Match } from '../src/game/match';
import { roomSeed } from '../src/game/room';
import { joinOpensCard } from '../src/net/actions';
import { NetSession } from '../src/net/session';
import { hashMatch } from '../src/net/snapshot';
import { LoopbackHub } from '../src/net/transport';
import { type InputFrame, NO_INPUT } from '../src/sim/types';
import { loadProfile, saveProfile } from '../src/ui/profile';

/** The player picks their color from the palette (DESIGN.md → Players). */

const TICK = 1000 / 60;
const press = (k: Partial<InputFrame>): InputFrame => ({ ...NO_INPUT, ...k });

describe('the player palette', () => {
  it('keeps every pair of swatches at least MIN_HUE_APART apart, so no two count as one color', () => {
    for (let i = 0; i < PLAYER_COLORS.length; i++)
      for (let j = i + 1; j < PLAYER_COLORS.length; j++) expect(hueApart(PLAYER_COLORS[i].h, PLAYER_COLORS[j].h)).toBeGreaterThanOrEqual(MIN_HUE_APART);
    expect(PLAYER_COLORS.length).toBeGreaterThan(8); // a full lobby still has a choice
  });
});

describe('colors in a match', () => {
  const lobby = (n: number) => {
    const m = new Match(roomSeed('COLOR'));
    for (let i = 0; i < n; i++) m.join(`kb${i}`);
    return m;
  };

  it('seats every newcomer in a swatch nobody else wears', () => {
    const m = lobby(8);
    const colors = m.players.map((p) => p.character.color);
    expect(colors.every((c) => c !== undefined)).toBe(true);
    expect(new Set(colors).size).toBe(8);
    for (const p of m.players) expect(p.character.body).toEqual(PLAYER_COLORS[p.character.color!]);
  });

  it('a swatch someone wears is taken for everyone else, and free again for its wearer', () => {
    const m = lobby(3);
    const [a, b] = m.players;
    const ai = a.character.color!;
    expect(m.colorFree(ai, a)).toBe(true);
    expect(m.colorFree(ai, b)).toBe(false);
    expect(m.colorFree(ai)).toBe(false);
    expect(m.setColor(b.slot, ai)).toBe(false);
    const free = PLAYER_COLORS.findIndex((_, i) => m.colorFree(i, b));
    expect(m.setColor(b.slot, free)).toBe(true);
    expect(b.character.color).toBe(free);
    // An old rolled hue takes the swatches it sits too close to.
    const old = generateCharacter(7);
    a.character = { ...old, name: a.character.name };
    for (let i = 0; i < PLAYER_COLORS.length; i++) expect(m.colorFree(i, b)).toBe(hueApart(PLAYER_COLORS[i].h, old.hue) >= MIN_HUE_APART);
  });

  it('refuses what is not a swatch', () => {
    const m = lobby(1);
    const before = m.players[0].character;
    for (const bad of [-1, PLAYER_COLORS.length, 1.5, NaN]) expect(m.setColor(0, bad)).toBe(false);
    expect(m.players[0].character).toBe(before);
  });

  it('a new look keeps the color, whether picked or rolled before swatches', () => {
    const m = lobby(2);
    const p = m.players[0];
    m.setColor(
      p.slot,
      PLAYER_COLORS.findIndex((_, i) => m.colorFree(i, p)),
    );
    const color = p.character.color;
    m.step({ kb0: press({ altPressed: true }) });
    expect(p.character.color).toBe(color);
    expect(p.character.body).toEqual(PLAYER_COLORS[color!]);
    const old = generateCharacter(424242);
    p.character = { ...old, name: p.character.name };
    m.step({ kb0: press({ altPressed: true }) });
    expect(p.character.seed).not.toBe(old.seed);
    expect(p.character.body).toEqual(old.body);
    expect(p.character.color).toBeUndefined();
  });

  it('restores a saved look in its saved swatch, the nearest free one if that is worn, and an old look in its own hue', () => {
    const m = lobby(2);
    const [a, b] = m.players;
    const seed = 99173;
    expect(m.setLook(a.slot, seed, b.character.color)).toBe(true);
    expect(a.character.seed).toBe(seed);
    expect(a.character.color).not.toBe(b.character.color);
    expect(hueApart(a.character.hue, b.character.hue)).toBeGreaterThanOrEqual(MIN_HUE_APART);
    const free = PLAYER_COLORS.findIndex((_, i) => m.colorFree(i, a) && i !== a.character.color);
    expect(m.setLook(a.slot, seed, free)).toBe(true);
    expect(a.character.color).toBe(free);
    const own = generateCharacter(seed);
    if (hueApart(own.hue, b.character.hue) >= MIN_HUE_APART) {
      expect(m.setLook(a.slot, seed)).toBe(true);
      expect(a.character.body).toEqual(own.body);
      expect(a.character.color).toBeUndefined();
    }
  });
});

class Room {
  hub = new LoopbackHub({ latency: 30, jitter: 10, seed: 5 });
  peers = new Map<string, NetSession>();
  join(id: string, watch = false): NetSession {
    const s = new NetSession({ transport: this.hub.transport(id), match: new Match(roomSeed('HUES')), now: () => this.hub.now, watch });
    this.peers.set(id, s);
    return s;
  }
  run(ticks: number) {
    for (let i = 0; i < ticks; i++) {
      this.hub.advance(TICK);
      for (const s of this.peers.values()) {
        s.tick({});
        void s.view;
        s.drainEvents();
      }
    }
  }
  until(what: () => boolean, max: number) {
    for (let i = 0; i < max && !what(); i++) this.run(1);
    expect(what()).toBe(true);
  }
  hashes(): Set<number> {
    const h = [...this.peers.values()].find((s) => s.isHost)!;
    for (let i = 0; i < 120; i++) {
      if (i % 20 === 0) h.flush();
      this.hub.advance(TICK);
      for (const s of this.peers.values()) if (s !== h) s.tick({});
    }
    return new Set([...this.peers.values()].map((s) => s.match.frame * 1e10 + hashMatch(s.match)));
  }
}

const mine = (s: NetSession, peer: string) => s.match.players.find((p) => p.device === `${peer}:kb1`)!;

describe('colors online', () => {
  it('a picked color reaches every peer; two reaching for one swatch at once, the host’s order gives it to one', () => {
    const r = new Room();
    const a = r.join('aaaa');
    r.run(5);
    const b = r.join('bbbb');
    const c = r.join('cccc');
    r.until(() => a.match.players.length === 3 && b.synced && c.synced, 400);
    r.run(20);
    const want = PLAYER_COLORS.findIndex((_, i) => a.match.colorFree(i));
    b.act({ t: 'color', dev: 'bbbb:kb1', color: want });
    c.act({ t: 'color', dev: 'cccc:kb1', color: want });
    r.run(40);
    const wearing = [mine(a, 'bbbb'), mine(a, 'cccc')].filter((p) => p.character.color === want);
    expect(wearing).toHaveLength(1);
    for (const s of [b, c]) expect(s.match.players.map((p) => p.character.color)).toEqual(a.match.players.map((p) => p.character.color));
    expect(r.hashes().size).toBe(1);
    // A look restored with its swatch: the same everywhere too.
    const free = PLAYER_COLORS.findIndex((_, i) => a.match.colorFree(i));
    b.act({ t: 'look', dev: 'bbbb:kb1', seed: 31337, color: free });
    r.run(40);
    expect(mine(c, 'bbbb').character.color).toBe(mine(a, 'bbbb').character.color);
    expect(r.hashes().size).toBe(1);
  });
});

describe('Join from watching, by phase', () => {
  it('opens the join card mid-match only', () => {
    expect(joinOpensCard('lobby')).toBe(false);
    for (const ph of ['pick', 'place', 'run', 'score', 'victory']) expect(joinOpensCard(ph)).toBe(true);
  });

  it('in the lobby, seats the watcher at once, the same on every peer', () => {
    const r = new Room();
    const a = r.join('aaaa');
    r.run(5);
    const w = r.join('wwww', true);
    r.until(() => w.synced && !!a.ns.watching.wwww, 400);
    expect(w.seated).toBe(false);
    w.play();
    r.until(() => w.seatAsk !== 'asking', 200);
    expect(w.seatAsk).toBe('won');
    expect(w.seated && !w.queued).toBe(true);
    expect(a.match.phase).toBe('lobby');
    expect(a.match.players.some((p) => p.device.startsWith('wwww:'))).toBe(true);
    expect(r.hashes().size).toBe(1);
  });
});

describe('the saved profile', () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = () => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) });
    return data;
  };

  it('keeps the color through a save and a load', () => {
    stub();
    saveProfile({ ...loadProfile(), look: 5, color: 3 });
    expect(loadProfile()).toMatchObject({ look: 5, color: 3 });
  });

  it('an old profile, saved before swatches, loads with no color: its look keeps its own hue', () => {
    const data = stub();
    saveProfile({ version: 1, name: 'Ada', prompted: true, look: 77 });
    const raw = JSON.parse(data.get('slag.profile.v1')!);
    delete raw.color;
    data.set('slag.profile.v1', JSON.stringify(raw));
    const p = loadProfile();
    expect(p.look).toBe(77);
    expect(p.color).toBeUndefined();
  });

  it('drops a color that is not a swatch', () => {
    const data = stub();
    saveProfile({ version: 1, name: null, prompted: false, look: 1 });
    for (const bad of [99, -1, 'red', 2.5]) {
      data.set('slag.profile.v1', JSON.stringify({ ...JSON.parse(data.get('slag.profile.v1')!), color: bad }));
      expect(loadProfile().color).toBeUndefined();
    }
  });

  it('a swatch recolors the character and keeps its kind, face and name', () => {
    const c = generateCharacter(12345);
    const d = withColor(c, 4);
    expect(d.body).toEqual(PLAYER_COLORS[4]);
    expect({ ...d, body: c.body, hue: c.hue, accent: c.accent, color: undefined }).toEqual({ ...c, color: undefined });
  });
});
