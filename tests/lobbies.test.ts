import { describe, expect, it } from 'vitest';
import { Match } from '../src/game/match';
import { NetSession } from '../src/net/session';
import type { ListedRoom } from '../src/net/signal-protocol';
import { cleanListing } from '../src/net/signal-protocol';
import { LoopbackHub } from '../src/net/transport';
import { lobby, routePath, sameRoute } from '../src/routes';
import { lobbyRows, themeLabel } from '../src/ui/screens/lobby-list';
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
    expect(l).toEqual({ players: 1, max: 8, observers: 0, theme: s.match.level.theme.id, phase: 'lobby' });
    s.match.setRules({ ...s.match.rules, private: true });
    expect(s.listing()).toBeNull();
  });
});
