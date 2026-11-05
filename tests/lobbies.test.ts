import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { NetSession } from '../src/net/session';
import type { ListedRoom } from '../src/net/signal-protocol';
import { cleanListing } from '../src/net/signal-protocol';
import { LoopbackHub } from '../src/net/transport';
import { lobby, routePath, sameRoute } from '../src/routes';
import { lobbyRows, rowTitle, themeLabel } from '../src/ui/screens/lobby-list';
import { lobbiesHTML } from '../src/ui/screens/markup';

const room = (code: string, players: number, phase: ListedRoom['phase'] = 'lobby', observers = 0): ListedRoom => ({
  room: code,
  players,
  max: 8,
  observers,
  theme: 'farm',
  phase,
});

describe('the lobby list', () => {
  const rooms = [room('BBBB', 3, 'run'), room('FULL', 8, 'pick', 2), room('AAAA', 2), room('CCCC', 5), room('DONE', 8, 'lobby')];

  it('shows rooms with a seat under Join, lobbies first, then the busiest', () => {
    expect(lobbyRows(rooms, 'join').map((r) => r.room)).toEqual(['CCCC', 'AAAA', 'BBBB']);
  });

  it('shows only full rooms under Watch', () => {
    expect(lobbyRows(rooms, 'watch').map((r) => r.room)).toEqual(['DONE', 'FULL']);
  });

  it('keeps its order through a refresh that changes nothing', () => {
    expect(
      lobbyRows(
        rooms.slice().sort((a, b) => (a.room < b.room ? 1 : -1)),
        'join',
      ),
    ).toEqual(lobbyRows(rooms, 'join'));
  });

  it("names a theme this build doesn't know by its id", () => {
    expect(themeLabel('glacier')).toBe('Glacier');
    expect(themeLabel('moonbase')).toBe('Moonbase');
  });

  it("leads with the host's name, and with the theme when the host has none", () => {
    expect(rowTitle({ ...room('K7QX2', 3), host: 'Wobblesnout' })).toEqual({ title: 'Wobblesnout', sub: 'Farm · K7QX2' });
    expect(rowTitle(room('K7QX2', 3))).toEqual({ title: 'FARM', sub: 'K7QX2' });
  });

  it("says a room's mode when it isn't a race, and lists a race as every older host does", () => {
    expect(rowTitle({ ...room('K7QX2', 3), host: 'Wobblesnout', mode: 'slag' })).toEqual({ title: 'Wobblesnout', sub: 'Rising Slag · Farm · K7QX2' });
    expect(rowTitle({ ...room('K7QX2', 3), mode: 'brawl' })).toEqual({ title: 'FARM', sub: 'Brawl · K7QX2' });
    const listed = { players: 1, max: 8, observers: 0, theme: 'mine', phase: 'lobby' };
    expect(cleanListing({ ...listed, mode: 'slag' })).toEqual({ ...listed, mode: 'slag' });
    expect(cleanListing({ ...listed, mode: 'race' })).toEqual(listed);
    expect(cleanListing({ ...listed, mode: '<b>' })).toEqual(listed);
  });

  it('opens a room watching from Watch, the same screen at the same URL', () => {
    expect(routePath(lobby('FULL', { watch: true }))).toBe('/r/FULL');
    expect(sameRoute(lobby('FULL', { watch: true }), lobby('FULL'))).toBe(true);
    expect(lobbiesHTML()).toContain('data-screen="lobbies"');
  });
});

describe("a host's listing", () => {
  it('says what the list shows, and nothing once the room is Private', () => {
    const hub = new LoopbackHub();
    const s = new NetSession({ transport: hub.transport('aaaa'), match: new Match(3) });
    s.match.join('aaaa:kb1');
    const l = s.listing()!;
    expect(cleanListing(l)).toEqual(l);
    expect(l).toEqual({ players: 1, max: 8, observers: 0, theme: s.match.level.theme.id, phase: 'lobby', host: s.match.players[0].character.name });
    s.match.setName(s.match.players[0].slot, 'Grimble');
    expect(s.listing()!.host).toBe('Grimble');
    s.match.setRules({ ...s.match.rules, private: true });
    expect(s.listing()).toBeNull();
  });

  it('names the host as it watches when it holds no seat, and not at all when it has no name', () => {
    const hub = new LoopbackHub();
    const s = new NetSession({ transport: hub.transport('aaaa'), match: new Match(3) });
    expect(s.listing()!.host).toBeUndefined();
    s.ns.watching.aaaa = { name: 'Dot' };
    expect(s.listing()!.host).toBe('Dot');
  });
});

describe("a listing's host name, checked by the API", () => {
  const farm = { players: 3, max: 8, observers: 1, theme: 'farm', phase: 'run' } as const;
  const host = (v: unknown) => cleanListing({ ...farm, host: v })?.host;

  it('trims it, caps it at the name limit, and takes out control and format characters', () => {
    expect(host('  Grimble  ')).toBe('Grimble');
    expect(host('Wobblesnout the Third')).toBe('Wobblesnout');
    expect(host('Gr\u0000im\u0007ble')).toBe('Grimble');
    expect(host('Grim\u202Eelb')).toBe('Grimelb'); // a bidi override can't flip the row
    expect(host('Gr\u200Bim')).toBe('Grim');
    expect(host('Big\n\tMo')).toBe('Big Mo');
    expect(host('<b>Jo</b>')).toBe('<b>Jo</b>'); // markup is just text: the screen never parses it
    expect(host('abc😀😀😀😀😀')).toBe('abc😀😀😀😀'); // no half a character at the cut
  });

  it('drops a name that is junk, and keeps the room', () => {
    for (const junk of [42, null, {}, ['Jo'], '', '   ', '\u0000\u0001', '\u200B\u200D']) {
      const l = cleanListing({ ...farm, host: junk });
      expect(l).toEqual(farm);
    }
  });
});
