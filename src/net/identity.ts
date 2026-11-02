import { SNAP_VERSION, type MatchSnap } from './snapshot';
import type { NetState } from './actions';

/**
 * Peer identity and per-room local persistence.
 *
 * A peer id names this browser tab in a room. It must survive a refresh (so
 * the host hands the same player slots back), but two tabs open at once must
 * get different ids (local multi-tab play). So:
 *
 * - sessionStorage holds the tab's id: a refresh keeps it.
 * - localStorage holds a small lease table per room: id → { tab, at }. A
 *   live tab renews its lease every second and releases it on pagehide.
 *   A new tab (or a duplicated tab whose copied sessionStorage id is still
 *   leased by the original) takes the most recently used *free* id, so
 *   closing a tab and reopening the link also gets your seat back.
 */

/**
 * A lease not renewed for this long is free. Generous on purpose: a busy tab's
 * timers can stall for seconds, and stealing a live tab's id would make two
 * tabs one peer. A closing tab releases explicitly, so reopening is instant.
 */
const LEASE_MS = 15_000;
const keyLeases = (room: string) => `slag.peers.${room}`;
const keyResume = (room: string) => `slag.resume.${room}`;

interface Lease {
  tab: string;
  at: number;
  used: number;
}

function read<T>(store: Storage | undefined, key: string): T | null {
  try {
    const raw = store?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(store: Storage | undefined, key: string, v: unknown) {
  try {
    store?.setItem(key, JSON.stringify(v));
  } catch {
    // storage full or blocked: identity just won't persist
  }
}

function storage(kind: 'local' | 'session'): Storage | undefined {
  try {
    return kind === 'local' ? localStorage : sessionStorage;
  } catch {
    return undefined;
  }
}

export function randomPeerId(): string {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

export interface PeerIdentity {
  id: string;
  /** Stop renewing and release the lease (pagehide). */
  release(): void;
}

/** Claim this tab's peer id for `room` (see module doc). */
export function acquirePeerId(room: string): PeerIdentity {
  const ls = storage('local');
  const ss = storage('session');
  const tab = randomPeerId();
  const now = Date.now();
  const leases = read<Record<string, Lease>>(ls, keyLeases(room)) ?? {};
  const free = (id: string) => !leases[id] || leases[id].at === 0 || now - leases[id].at > LEASE_MS;
  const mine = read<string>(ss, `slag.peer.${room}`);
  let id = mine && free(mine) ? mine : '';
  if (!id) {
    const recent = Object.entries(leases)
      .filter(([k]) => free(k))
      .sort((a, b) => b[1].used - a[1].used);
    id = recent[0]?.[0] ?? randomPeerId();
  }
  // Keep the table small.
  const kept = Object.entries(leases)
    .sort((a, b) => b[1].used - a[1].used)
    .slice(0, 8);
  const table: Record<string, Lease> = Object.fromEntries(kept);
  table[id] = { tab, at: now, used: now };
  write(ls, keyLeases(room), table);
  write(ss, `slag.peer.${room}`, id);

  const renew = (at: number) => {
    const t = read<Record<string, Lease>>(ls, keyLeases(room)) ?? {};
    if (t[id] && t[id].tab !== tab && t[id].at !== 0 && Date.now() - t[id].at < LEASE_MS) return; // someone else holds it now
    t[id] = { tab, at, used: Date.now() };
    write(ls, keyLeases(room), t);
  };
  const timer = setInterval(() => renew(Date.now()), 1000);
  return {
    id,
    release() {
      clearInterval(timer);
      renew(0);
    },
  };
}

// ---------------------------------------------------------------- resume save

/** How long a room's last state stays resumable on this browser. */
const RESUME_MS = 30 * 60 * 1000;

export interface ResumeSave {
  at: number;
  snap: MatchSnap;
  ns: NetState;
}

export function saveResume(room: string, snap: MatchSnap, ns: NetState) {
  write(storage('local'), keyResume(room), { at: Date.now(), snap, ns } satisfies ResumeSave);
}

/** The last state this browser saw for `room`, if recent and compatible. */
export function loadResume(room: string): ResumeSave | null {
  const r = read<ResumeSave>(storage('local'), keyResume(room));
  if (!r || r.snap?.v !== SNAP_VERSION || Date.now() - r.at > RESUME_MS) return null;
  return r;
}
