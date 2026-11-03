import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleOp } from '../app/api/net/_server/handlers';
import { MemoryStore } from '../app/api/net/_server/store';
import { NAME_MAX } from '../src/core/name';
import { listedEntries, nameBlocked } from '../src/core/name-filter';
import { generateCharacter } from '../src/gen/character';
import { Match } from '../src/game/match';
import { roomSeed } from '../src/game/room';
import { applyAction, newNetState, relayAction } from '../src/net/actions';
import { NetSession } from '../src/net/session';
import { cleanListing, DEFAULT_ICE, type LobbiesReply } from '../src/net/signal-protocol';
import { hashMatch, restoreMatch, snapshotMatch } from '../src/net/snapshot';
import { LoopbackHub, type TransportHandlers } from '../src/net/transport';
import type { InputManager } from '../src/input/input';
import { NamePrompt } from '../src/ui/menus/name';
import { loadProfile } from '../src/ui/profile';

// No word from the lists is spelled out here: every blocked case is built from the lists' own entries.
const plain = (e: string) => e.replaceAll('*', '');
const single = listedEntries()
  .map((e) => ({ ...e, text: plain(e.text) }))
  .filter((e) => /^[a-z]{3,}$/.test(e.text));
const anywhere = single.filter((e) => e.anywhere);
/** Every slur matched anywhere, and an even spread of the rest. */
const sample = [...anywhere, ...single.filter((e, i) => !e.anywhere && i % 6 === 0)];
/** A short slur that fits a name, for the wire tests. */
const slur = anywhere.find((e) => e.text.length <= NAME_MAX - 2)!.text;

const title = (w: string) => w[0].toUpperCase() + w.slice(1);
/** Entries in the sample are plain a-z, so splitting into code units is splitting into letters. */
const letters = (w: string) => w.split('');
const swap = (map: Record<string, string>) => (w: string) =>
  letters(w)
    .map((c) => map[c] ?? c)
    .join('');
const GREEK_CAPS: Record<string, string> = { A: 'Α', B: 'Β', E: 'Ε', H: 'Η', I: 'Ι', K: 'Κ', M: 'Μ', N: 'Ν', O: 'Ο', P: 'Ρ', T: 'Τ', X: 'Χ', Y: 'Υ', Z: 'Ζ' };
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const ACUTE = String.fromCharCode(0x301);

/** Ways people dress a word up to slip it past a filter. */
const EVASIONS: Record<string, (w: string) => string> = {
  upper: (w) => w.toUpperCase(),
  title,
  leet: swap({ a: '4', e: '3', o: '0', s: '$', t: '7', i: '1', l: '|', g: '9', b: '8' }),
  stretched: (w) => w.replace(/[aeiou]/g, (v) => v.repeat(3)),
  spaced: (w) => letters(w).join(' '),
  dotted: (w) => letters(w).join('.'),
  zeroWidth: (w) => letters(w).join(ZERO_WIDTH_SPACE),
  cyrillic: swap({ a: 'а', e: 'е', o: 'о', c: 'с', p: 'р', x: 'х', y: 'у', i: 'і', s: 'ѕ' }),
  greek: (w) => swap(GREEK_CAPS)(w.toUpperCase()),
  accented: (w) => w.replace(/[aeiou]/g, (v) => v + ACUTE),
  fullwidth: (w) => String.fromCharCode(...letters(w).map((c) => c.charCodeAt(0) + 0xfee0)),
  numbered: (w) => `${w}99`,
  shouted: (w) => `${title(w)}!!`,
  camel: (w) => `Big${title(w)}`,
};

describe('the name filter', () => {
  it('refuses list entries however they are dressed up', () => {
    expect(sample.length).toBeGreaterThan(60);
    const missed = sample.flatMap((e) =>
      Object.entries(EVASIONS).flatMap(([how, f]) => (nameBlocked(f(e.text)) ? [] : [`${how} of entry ${e.text.length} letters`])),
    );
    expect(missed).toEqual([]);
  });

  it('refuses slurs inside other letters, and keeps milder words to whole words', () => {
    for (const e of anywhere) expect(nameBlocked(`zz${e.text}zz`)).toBe(true);
    const mild = single.filter((e) => !e.anywhere && !nameBlocked(`zz${e.text}zz`));
    expect(mild.length).toBeGreaterThan(single.length / 2);
  });

  it('allows towns, mushrooms, novelists and ordinary names with a listed word inside', () => {
    const fine = [
      ...'Scunthorpe class assassin therapist Shitake Dickens Cockburn grape Essex Sussex Penistone cocktail analysis title'.split(' '),
      ...'Alice Bob Mohammed Priya Nigel Hancock Cassandra Montenegro Spice Raccoon Tycoon Spikey DarkEyes FragHead'.split(' '),
      ...'Jesus Shell Japan Pakistan XxSlayerxX S.M. Dot Bob! Wobblesnout'.split(' '),
      'Mr Handsome',
      'Big Mo',
      'Lil Al',
      ...Array.from({ length: 40 }, (_, i) => generateCharacter(i).name),
    ];
    expect(fine.filter(nameBlocked)).toEqual([]);
  });

  it('gives the same answer every time, from no state of its own', () => {
    const cases = sample.slice(0, 20).flatMap((e) => [e.text, EVASIONS.leet(e.text), `Dot${e.text}`, 'Scunthorpe']);
    const first = cases.map(nameBlocked);
    const again: boolean[] = [];
    for (let i = cases.length - 1; i >= 0; i--) again[i] = nameBlocked(cases[i]); // in the other order
    expect(again).toEqual(first);
  });
});

describe('name entry', () => {
  afterEach(() => vi.unstubAllGlobals());

  /** Just enough DOM for an overlay: elements are plain objects, and every one made is kept to find later. */
  function stubDom() {
    const made: Record<string, unknown>[] = [];
    const node = () => ({
      append() {},
      appendChild() {},
      remove() {},
      setAttribute() {},
      getAttribute() {},
      addEventListener() {},
      focus() {},
      select() {},
      getContext: () => null,
      style: {},
    });
    // The name screen also polls the pads and paints its preview every frame: none of that runs here.
    vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {} });
    vi.stubGlobal('requestAnimationFrame', () => 0);
    vi.stubGlobal('cancelAnimationFrame', () => {});
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        const e = { tag, ...node() };
        made.push(e);
        return e;
      },
      head: node(),
      body: node(),
    });
    return made;
  }

  it('refuses a listed name and keeps the one you had, with nothing said', () => {
    const made = stubDom();
    const done: (string | null)[] = [];
    const prompt = new NamePrompt({ captured: false, capturePads() {} } as unknown as InputManager);
    const ch = generateCharacter(3);
    prompt.open({ randomName: 'Grimble', current: 'Dot', preview: () => ch, free: () => true, onColor() {}, onDone: (n) => done.push(n) });
    const input = made.find((e) => e.tag === 'input') as { value: string };
    const save = made.find((e) => e.textContent === 'Save') as { onclick: () => void };
    input.value = EVASIONS.title(slur);
    const before = made.length;
    save.onclick();
    expect(done).toEqual([]);
    expect(input.value).toBe('Dot');
    expect(prompt.isOpen).toBe(true);
    expect(made.length).toBe(before); // no message put up
    input.value = 'Ada';
    save.onclick();
    expect(done).toEqual(['Ada']);
  });

  it('forgets a saved name the filter refuses', () => {
    const data = new Map([['slag.profile.v1', JSON.stringify({ version: 1, name: slur, prompted: true, look: 4 })]]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) });
    expect(loadProfile()).toMatchObject({ name: null, prompted: true });
  });
});

describe('names from peers', () => {
  it('shows a refused name as the generated name of the look, the same on every peer', () => {
    const run = () => {
      const m = new Match(7);
      const ns = newNetState();
      applyAction(m, ns, { t: 'join', dev: 'aaaa:kb1' });
      applyAction(m, ns, { t: 'join', dev: 'bbbb:kb1' });
      applyAction(m, ns, { t: 'name', dev: 'aaaa:kb1', name: 'Dot' });
      applyAction(m, ns, { t: 'name', dev: 'aaaa:kb1', name: EVASIONS.leet(slur) });
      applyAction(m, ns, { t: 'name', dev: 'bbbb:kb1', name: 'Mo' });
      applyAction(m, ns, { t: 'watch', dev: 'bbbb:kb1', on: true, name: slur });
      return { m, ns };
    };
    const a = run();
    const b = run();
    const p = a.m.players.find((q) => q.device === 'aaaa:kb1')!;
    expect(p.character.name).toBe(generateCharacter(p.character.seed).name);
    expect(a.ns.watching.bbbb.name).toBe('Mo'); // a refused label falls back to the player's own name
    expect(hashMatch(a.m)).toBe(hashMatch(b.m));
  });

  it('refuses a name in a snapshot or a save, the same on every peer', () => {
    const m = new Match(7);
    m.join('aaaa:kb1');
    const snap = snapshotMatch(m);
    (snap.players as { character: { name: string } }[])[0].character.name = slur;
    const [a, b] = [new Match(7), new Match(7)];
    restoreMatch(a, structuredClone(snap));
    restoreMatch(b, structuredClone(snap));
    expect(a.players[0].character.name).toBe(generateCharacter(a.players[0].character.seed).name);
    expect(hashMatch(a)).toBe(hashMatch(b));
  });

  it('never relays a refused name: the host sends the generated one', () => {
    const m = new Match(7);
    m.join('bbbb:kb1');
    const seed = m.players[0].character.seed;
    expect(relayAction(m, { t: 'name', dev: 'bbbb:kb1', name: slur })).toEqual({ t: 'name', dev: 'bbbb:kb1', name: generateCharacter(seed).name });
    expect(relayAction(m, { t: 'watch', dev: 'bbbb:kb1', on: true, name: slur, afk: true })).toEqual({ t: 'watch', dev: 'bbbb:kb1', on: true });
    expect(relayAction(m, { t: 'name', dev: 'bbbb:kb1', name: 'Dot' })).toEqual({ t: 'name', dev: 'bbbb:kb1', name: 'Dot' });
  });

  it('keeps a refused name off the wire between peers', () => {
    const hub = new LoopbackHub({ latency: 20 });
    const heard: string[] = [];
    const session = (id: string) => {
      const transport = hub.transport(id);
      if (id === 'cccc') {
        const start = transport.start.bind(transport);
        transport.start = (h: TransportHandlers) =>
          start({
            ...h,
            message: (from, d) => {
              heard.push(JSON.stringify(d));
              h.message(from, d);
            },
          });
      }
      return new NetSession({ transport, match: new Match(roomSeed('NAME')), now: () => hub.now });
    };
    const peers = [session('aaaa'), session('bbbb'), session('cccc')];
    const run = (n: number) => {
      for (let i = 0; i < n; i++) {
        hub.advance(1000 / 60);
        for (const s of peers) s.tick({});
      }
    };
    run(60);
    const b = peers[1];
    b.act({ t: 'name', dev: 'bbbb:kb1', name: slur });
    run(60);
    const shown = peers.map((s) => s.match.players.find((p) => p.device === 'bbbb:kb1')?.character);
    expect(shown[0]?.name).toBe(generateCharacter(shown[0]!.seed).name);
    expect(shown.map((c) => c?.name)).toEqual([shown[0]?.name, shown[0]?.name, shown[0]?.name]);
    expect(heard.length).toBeGreaterThan(0);
    expect(heard.filter((d) => d.includes(slur))).toEqual([]);
  });
});

describe('the lobby list', () => {
  const farm = { players: 3, max: 8, observers: 1, theme: 'farm', phase: 'run' } as const;

  it('drops a refused host name and keeps the room', async () => {
    expect(cleanListing({ ...farm, host: EVASIONS.title(slur) })).toEqual(farm);
    expect(cleanListing({ ...farm, host: 'Scunthorpe' })).toEqual({ ...farm, host: 'Scunthorpe' });
    const store = new MemoryStore(() => 1_000_000);
    const ctx = { store, ice: DEFAULT_ICE, now: () => 1_000_000 };
    await handleOp('join', { room: 'ROOMA', peer: 'aaaa', since: 10 }, ctx);
    await handleOp('beat', { room: 'ROOMA', peer: 'aaaa', host: true, list: { ...farm, host: EVASIONS.leet(slur) } }, ctx);
    expect(((await handleOp('lobbies', {}, ctx)) as LobbiesReply).rooms).toEqual([{ room: 'ROOMA', ...farm }]);
  });
});
