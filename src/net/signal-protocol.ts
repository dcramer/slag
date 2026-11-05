import { tidyName } from '../core/name';
import { nameBlocked } from '../core/name-filter';
import { MAX_PLAYERS } from '../sim/constants';

/**
 * Wire contract between browsers and the signaling API. Pure data and
 * validators, importable by the route handlers in app/api/net (and by a
 * packaged build's client) without pulling in anything from the game.
 *
 * The API finds peers and carries WebRTC handshakes; once data channels are up
 * it only sees a low-rate heartbeat, and the host's mailbox poll. See
 * docs/NETCODE.md for the command budget these numbers add up to.
 */

export const SIGNAL_OPS = ['join', 'beat', 'leave', 'gone', 'members', 'signal', 'poll', 'lobbies'] as const;
export type SignalOp = (typeof SIGNAL_OPS)[number];

/** Peers in one room: every player's machine plus a few spectators. The host uploads to each, so this stays small. */
export const MAX_PEERS = MAX_PLAYERS + 4;
/** One handshake blob (an SDP with its ICE candidates). */
export const MAX_SDP_CHARS = 16_000;
/** Whole request body. */
export const MAX_BODY_BYTES = 20_000;
/** Messages queued for one peer. Older ones are dropped. */
export const MAX_MAILBOX = 16;

/** A peer that hasn't sent a heartbeat for this long is gone. Must exceed a few BEAT_MS. */
export const PEER_TTL_S = 50;
/** The member set and join counter outlive their peers briefly; hosts renew them. */
export const ROOM_TTL_S = 300;
/** Unread handshakes are useless after this. */
export const MAILBOX_TTL_S = 30;

export const BEAT_MS = 20_000;

/**
 * A room with nobody in it, players or watchers, for this long is over: its link then starts a fresh room under
 * the same code (codes aren't retired: the code is only a name, and seeds the first level). This is what
 * "active" means everywhere, the resume save and a room list alike. Liveness (PEER_TTL_S) is shorter, so by
 * then the store has let go of everyone too.
 */
export const ROOM_EMPTY_MS = 60_000;

/**
 * The public lobby list. A host's beat writes its room there (unless the room is Private), so a room is listed for as
 * long as its host's liveness would last: one that stops beating falls out on its own, inside ROOM_EMPTY_MS.
 */
/** @alias */
export const LIST_TTL_S = PEER_TTL_S;
/** Rooms a list read returns at most, most recently beaten first. */
export const MAX_LISTED = 50;
/** How often an open list asks again. */
export const LIST_POLL_MS = 5000;

/** Phases a listing may name: Match's, restated so the server needs nothing from the game. */
export const LISTED_PHASES = ['lobby', 'pick', 'place', 'run', 'score', 'victory'] as const;
export type ListedPhase = (typeof LISTED_PHASES)[number];

/** What the list shows of a room. The host writes it; the API checks it, since anyone can claim to host. */
export interface RoomListing {
  /** Seats taken or owed, of `max`. */
  players: number;
  max: number;
  /** Peers here without a seat. */
  observers: number;
  /** The current level's theme id (src/themes.ts). */
  theme: string;
  phase: ListedPhase;
  /** The hosting player's name, whoever hosts now. Absent when it has none, or the API refused it. */
  host?: string;
  /** The match's playstyle mode id (game/modes.ts). Absent for a race, as every older host lists it. */
  mode?: string;
}

export interface ListedRoom extends RoomListing {
  room: string;
}

export interface LobbiesReply {
  rooms: ListedRoom[];
}

const count = (v: unknown, max: number) => Number.isSafeInteger(v) && (v as number) >= 0 && (v as number) <= max;

/** A listing off the wire or out of the store, or null: only these fields, in range, so a caller can't put anything else on everyone's list. */
export function cleanListing(v: unknown): RoomListing | null {
  if (typeof v !== 'object' || v === null) return null;
  const l = v as Record<string, unknown>;
  if (!count(l.max, MAX_PLAYERS) || (l.max as number) < 1 || !count(l.players, l.max as number) || !count(l.observers, MAX_PEERS)) return null;
  if (typeof l.theme !== 'string' || !/^[a-z]{1,16}$/.test(l.theme) || !LISTED_PHASES.includes(l.phase as ListedPhase)) return null;
  const out: RoomListing = {
    players: l.players as number,
    max: l.max as number,
    observers: l.observers as number,
    theme: l.theme,
    phase: l.phase as ListedPhase,
  };
  // Text from a stranger, shown to strangers: a bad or blocked name loses the name, not the room.
  const host = tidyName(l.host);
  if (host && !nameBlocked(host)) out.host = host;
  if (typeof l.mode === 'string' && /^[a-z]{1,16}$/.test(l.mode) && l.mode !== 'race') out.mode = l.mode;
  return out;
}

export interface MemberInfo {
  id: string;
  /** Join order from an atomic per-room counter: lower joined earlier. */
  order: number;
}

/** Same fields as the DOM's RTCIceServer, restated so the server needs no DOM types. */
export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/** A handshake message from one peer to another. `c` names the attempt, so stale answers are ignored. */
export type Signal =
  | { k: 'offer'; c: string; o: number; sdp: string }
  | { k: 'answer'; c: string; sdp: string }
  /** "I'm not the host, `to` is." Empty `to`: the host refused, the room is full. */
  | { k: 'redirect'; c: string; to: string };
export interface Mail {
  from: string;
  s: Signal;
}

export interface JoinReply {
  order: number;
  members: MemberInfo[];
  ice: IceServer[];
}
export interface BeatReply {
  /** False when the store no longer has this peer (expired or evicted): it must join again. */
  alive: boolean;
  /** Hosts only: the lowest-order member, which is how two peers that both think they host find out. */
  head?: string /**
   * A newer session of this peer id holds its place: another tab took the id (identity.ts gives it out once a
   * tab's lease lapses, and a hidden tab's timers can stall that long). This session must stop.
   */;
  replaced?: true;
}
export interface MembersReply {
  members: MemberInfo[];
}
export interface SignalReply {
  delivered: boolean;
  /** Undelivered because the store has no live session for the sender (`self`) or the target (`to`). */
  gone?: 'self' | 'to';
}

export interface PollReply {
  mail: Mail[];
}

/** `error` values the API returns; the client turns these into UI states. */
export type SignalErrorCode = 'unconfigured' | 'full' | 'bad-request' | 'forbidden' | 'too-large' | 'rate-limited' | 'store-failed';

/** Room codes are generated in src/game/room.ts; this also admits longer test codes. */
export const ROOM_RE = /^[A-Z0-9]{3,12}$/;
export const PEER_RE = /^[A-Za-z0-9_-]{4,40}$/;
const ATTEMPT_RE = /^[a-z0-9]{1,16}$/;

export function isSignal(v: unknown): v is Signal {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  if (typeof s.c !== 'string' || !ATTEMPT_RE.test(s.c)) return false;
  if (s.k === 'redirect') return s.to === '' || (typeof s.to === 'string' && PEER_RE.test(s.to));
  if (typeof s.sdp !== 'string' || s.sdp.length === 0 || s.sdp.length > MAX_SDP_CHARS) return false;
  if (s.k === 'answer') return true;
  return s.k === 'offer' && Number.isSafeInteger(s.o) && (s.o as number) >= 0;
}

/** Public STUN only. TURN comes from the server's `SLAG_ICE_SERVERS`. */
export const DEFAULT_ICE: IceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
