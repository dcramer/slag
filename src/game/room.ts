import { deriveSeed, hashString } from '../core/rng';

/**
 * Lobby/room codes. The URL is /r/<code>; the code identifies the match
 * (and, once online play lands, the WebRTC room). It also seeds the first
 * level so a fresh link always opens the same level.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const ROOM_LEN = 5;

export function newRoomCode(random: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < ROOM_LEN; i++) s += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return s;
}

/** Room code from a path like /r/k7qx2 (case-insensitive), or null. */
export function roomFromPath(path: string): string | null {
  const m = /^\/r\/([A-Za-z0-9]{3,12})\/?$/.exec(path);
  return m ? m[1].toUpperCase() : null;
}

export function roomSeed(code: string): number {
  return deriveSeed(hashString(code), 'room');
}
