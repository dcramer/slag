import type { ListedPhase, ListedRoom } from '../../net/signal-protocol';
import { THEME_IDS, THEME_LABELS, type ThemeId } from '../../themes';

/**
 * What the Lobbies screen shows of the public lobby list, apart from the DOM so the rules can be tested: which rooms
 * each filter holds, in what order, and how a row reads. The list itself comes from the signaling API
 * (`fetchLobbies`); docs/NETCODE.md → Lobby list says how it's kept.
 */

/** Join: rooms with a seat. Watch: full rooms, which you can only watch (observer mode). */
export type LobbyFilter = 'join' | 'watch';
export const LOBBY_FILTERS: readonly LobbyFilter[] = ['join', 'watch'];
export const isFull = (r: ListedRoom) => r.players >= r.max;

/**
 * The rooms under a filter. Rooms still in their lobby come first (a seat there plays the next match from its start),
 * then the busiest, then by code, so a refresh that changes nothing moves nothing.
 */
export function lobbyRows(rooms: readonly ListedRoom[], filter: LobbyFilter): ListedRoom[] {
  return rooms
    .filter((r) => isFull(r) === (filter === 'watch'))
    .sort((a, b) => Number(b.phase === 'lobby') - Number(a.phase === 'lobby') || b.players - a.players || (a.room < b.room ? -1 : a.room > b.room ? 1 : 0));
}

/** The stamped tag for where a room is: still gathering, or which part of a round it's in. */
export const PHASE_TAGS: Record<ListedPhase, string> = {
  lobby: 'LOBBY',
  pick: 'PICKING',
  place: 'PLACING',
  run: 'RACING',
  score: 'SCORING',
  victory: 'VICTORY',
};

/** A theme's name; one this build doesn't know yet (a newer host) by its id. */
export function themeLabel(id: string): string {
  return THEME_IDS.includes(id as ThemeId) ? THEME_LABELS[id as ThemeId] : id.charAt(0).toUpperCase() + id.slice(1);
}

/**
 * A row's two lines. The host's name leads, since a name is what people recognise, over the theme and the code;
 * a room whose host has no name leads with its theme, as a stamped heading.
 */
export function rowTitle(r: ListedRoom): { title: string; sub: string } {
  const theme = themeLabel(r.theme);
  return r.host ? { title: r.host, sub: `${theme} · ${r.room}` } : { title: theme.toUpperCase(), sub: r.room };
}
