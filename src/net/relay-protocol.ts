/**
 * Wire protocol between browsers and the room relay (relay/worker.ts on
 * Cloudflare, tools/relay-dev.ts locally). Kept tiny and dependency-free so
 * both sides share it.
 *
 *   connect  wss://<relay>/r/<ROOM>?peer=<peerId>
 *   server → { t:'welcome', self, members }   once, on connect
 *            { t:'join', m } / { t:'leave', id } presence changes
 *            { t:'msg', from, d }              a peer's payload
 *            { t:'pong', ts }                  reply to a ping
 *   client → { d, to? }                        payload to `to` or to everyone else
 *            { ping: ts }                      keepalive / RTT probe
 *
 * The relay is authoritative for presence: it assigns `order` from a
 * per-room counter, so every peer agrees on who joined first (host election).
 */
import type { Member } from './transport';

export type RelayServerMsg =
  | { t: 'welcome'; self: Member; members: Member[] }
  | { t: 'join'; m: Member }
  | { t: 'leave'; id: string }
  | { t: 'msg'; from: string; d: unknown }
  | { t: 'pong'; ts: number }
  | { t: 'error'; reason: string };

export type RelayClientMsg = { d: unknown; to?: string } | { ping: number };

export const ROOM_RE = /^[A-Z0-9]{3,12}$/;
export const PEER_RE = /^[A-Za-z0-9_-]{4,40}$/;
/** Hard caps per room (8 players' machines plus spectators) and per message (snapshots are ~10–60 KB). */
export const MAX_CONNS = 16;
export const MAX_MSG_BYTES = 512 * 1024;
/** WebSocket close code sent to an older connection when the same peer id connects again (refresh). */
export const CLOSE_REPLACED = 4001;
export const CLOSE_FULL = 4002;
export const CLOSE_BAD = 4003;
