import { type CharacterDef, generateCharacter } from '../gen/character';
import type { Match } from '../game/match';
import { BLOOD_CHOICES, DEFAULT_RULES, GRAVITY_CHOICES, type MatchRules, nearestLength, RULE_CHOICES } from '../game/rules';
import { MAX_PLAYERS } from '../sim/constants';

/**
 * Discrete, host-sequenced match actions. They ride in input bundles and are
 * applied by every peer at the same frame, before that frame's step, so they
 * are as deterministic as inputs. Anything that changes the Match outside of
 * per-device input goes through here.
 */
export type NetAction =
  /** Seat a device (rejoin with its old look, or a spectator promoted between rounds). */
  | { t: 'join'; dev: string; char?: CharacterDef }
  /** Lobby only: a peer left; its players are parked so a rejoin gets the same look back. */
  | { t: 'leave'; dev: string }
  /** Mid-match: the device's peer disconnected (or came back). */
  | { t: 'away'; dev: string; on: boolean }
  | { t: 'name'; dev: string; name: string }
  /** Restore a saved look (character seed) for one of the sender's players. */
  | { t: 'look'; dev: string; seed: number }
  /** Host only: the per-match salt (crate order) for the next match start. */
  | { t: 'salt'; salt: number }
  /** Host only, lobby only. */
  | { t: 'rules'; rules: MatchRules }
  /** Host only, lobby only: out of the room, and refused if it comes back. */
  | { t: 'kick'; peer: string }
  /**
   * A peer watches (`on`) or wants to play again. Watching gives up the peer's seats: at once in the lobby,
   * at the round boundary mid-match. `name` labels its chip. `afk` is the host's: it saw the player idle.
   */
  | { t: 'watch'; dev: string; on: boolean; name?: string; afk?: boolean }
  /**
   * A watcher asks for a seat (`on`), or the host drops a request whose peer left. The host's order decides a
   * race for the last seat: a request that finds no seat free does nothing, so its sender knows it lost. In
   * the lobby and between rounds the seat is taken at once; mid-round the request queues for the boundary.
   */
  | { t: 'seat'; dev: string; on: boolean };

/** Replicated session state that isn't part of the Match (kept identical on every peer by the same actions). */
export interface NetState {
  /** peer id → players removed from the lobby while that peer was away. */
  parked: Record<string, { dev: string; char: CharacterDef }[]>;
  /** Peers the host removed. Replicated, so a new host keeps refusing them. */
  kicked: Record<string, true>;
  /** Peers watching rather than playing, by choice or for being idle. A refresh keeps it: the peer id survives one. */
  watching: Record<string, Watcher>;
  /** Seats won mid-round, taken at the next round boundary in this order. */
  queue: { peer: string; dev: string }[];
}

export interface Watcher {
  name: string;
  /** Moved here by the host for being idle, not by choice: any input asks for the seat back. */
  afk?: true;
}

/** Remembered watchers, oldest dropped first: entries outlive peers that never come back. */
const MAX_WATCHERS = 16;

export function newNetState(): NetState {
  return { parked: {}, kicked: {}, watching: {}, queue: [] };
}

/** Seats nobody holds or is owed at the next round boundary: the seats a request can still win. */
export function freeSeats(m: Match, ns: NetState): number {
  return MAX_PLAYERS - m.players.filter((p) => !p.leaving).length - ns.queue.length;
}

/** Names come off the wire: the same limits as a player's. */
export function cleanName(v: unknown): string {
  return typeof v === 'string' ? v.slice(0, 12).trim() : '';
}

/** Peer id that owns a global device id (`<peer>:<local device>`), or '' for un-namespaced (offline/debug) devices. */
export function peerOf(dev: string): string {
  const i = dev.indexOf(':');
  return i < 0 ? '' : dev.slice(0, i);
}

/** Where seats change hands: the lobby, and the round boundary (the score and victory screens). */
export const SEAT_PHASES = new Set(['lobby', 'score', 'victory']);

function seat(m: Match, ns: NetState, dev: string, char?: CharacterDef) {
  const peer = peerOf(dev);
  m.join(dev, char);
  ns.queue = ns.queue.filter((q) => q.peer !== peer);
  const parked = ns.parked[peer]?.filter((x) => x.dev !== dev);
  if (parked?.length) ns.parked[peer] = parked;
  else delete ns.parked[peer];
}

export function applyAction(m: Match, ns: NetState, a: NetAction): void {
  switch (a.t) {
    case 'join': {
      const peer = peerOf(a.dev);
      if (!SEAT_PHASES.has(m.phase) || m.players.length >= MAX_PLAYERS || ns.watching[peer]) return;
      seat(m, ns, a.dev, a.char);
      return;
    }
    case 'seat': {
      const peer = peerOf(a.dev);
      if (!peer || ns.kicked[peer]) return;
      if (!a.on) {
        ns.queue = ns.queue.filter((q) => q.peer !== peer);
        return;
      }
      // Already in, or already owed one: a second click is the same request.
      if (m.players.some((p) => peerOf(p.device) === peer && !p.leaving) || ns.queue.some((q) => q.peer === peer)) return;
      const mine = m.players.filter((p) => peerOf(p.device) === peer);
      if (mine.length) {
        // On the way out and changed their mind: they keep the seat they have.
        for (const p of mine) delete p.leaving;
        delete ns.watching[peer];
        return;
      }
      if (freeSeats(m, ns) <= 0) return; // lost the race: still watching
      delete ns.watching[peer];
      if (SEAT_PHASES.has(m.phase)) seat(m, ns, a.dev);
      else ns.queue.push({ peer, dev: a.dev });
      return;
    }
    case 'leave': {
      const p = m.leave(a.dev);
      if (!p) return;
      const peer = peerOf(a.dev);
      (ns.parked[peer] ??= []).push({ dev: a.dev, char: p.character });
      if (ns.parked[peer].length > 4) ns.parked[peer].shift();
      return;
    }
    case 'away': {
      const p = m.players.find((q) => q.device === a.dev);
      if (!p) return;
      if (a.on) p.away = true;
      else delete p.away; // keep snapshots canonical (no `away: false` vs missing)
      return;
    }
    case 'name': {
      const p = m.players.find((q) => q.device === a.dev);
      const name = cleanName(a.name); // wire data: don't trust the type
      if (p && name && !m.players.some((q) => q !== p && q.character.name === name)) m.setName(p.slot, name);
      return;
    }
    case 'look': {
      const p = m.players.find((q) => q.device === a.dev);
      // Two tabs of one browser share a saved look; the second one keeps the character it rolled.
      if (p && Number.isInteger(a.seed) && m.looksFree({ ...generateCharacter(a.seed >>> 0), name: p.character.name }, p)) m.setLook(p.slot, a.seed >>> 0);
      return;
    }
    case 'salt':
      if (Number.isInteger(a.salt)) m.nextSalt = a.salt >>> 0;
      return;
    case 'rules':
      if (m.phase === 'lobby') m.setRules(sanitizeRules(a.rules));
      return;
    case 'kick':
      if (m.phase !== 'lobby' || typeof a.peer !== 'string') return;
      for (const p of m.players.filter((q) => peerOf(q.device) === a.peer)) m.leave(p.device);
      delete ns.parked[a.peer];
      delete ns.watching[a.peer];
      ns.queue = ns.queue.filter((q) => q.peer !== a.peer);
      ns.kicked[a.peer] = true;
      return;
    case 'watch': {
      const peer = peerOf(a.dev);
      if (!peer || ns.kicked[peer]) return;
      const mine = m.players.filter((q) => peerOf(q.device) === peer);
      if (!a.on) {
        delete ns.watching[peer];
        for (const p of mine) delete p.leaving; // changed their mind before the boundary: they stay
        return;
      }
      const name = cleanName(a.name) || mine[0]?.character.name || '';
      for (const p of mine) {
        if (m.phase === 'lobby') m.leave(p.device);
        else p.leaving = true;
      }
      delete ns.parked[peer];
      ns.queue = ns.queue.filter((q) => q.peer !== peer);
      delete ns.watching[peer]; // re-inserted last: the oldest entries go first
      ns.watching[peer] = a.afk ? { name, afk: true } : { name };
      const keys = Object.keys(ns.watching);
      for (const k of keys.slice(0, Math.max(0, keys.length - MAX_WATCHERS))) delete ns.watching[k];
      return;
    }
  }
}

const choice =
  <T>(allowed: readonly T[]) =>
  (v: unknown): T | undefined =>
    allowed.includes(v as T) ? (v as T) : undefined;

/**
 * One check per rule, and the mapped type won't compile with one missing: a
 * field left out here would silently reset to its default on every change.
 * Points and rounds travel as a pair, so a packet can't invent a match that never ends.
 */
const RULE_CHECKS: { [K in keyof MatchRules]: (v: unknown, r: Partial<MatchRules>) => MatchRules[K] | undefined } = {
  targetScore: (v) => (typeof v === 'number' ? nearestLength(v).targetScore : undefined),
  maxRounds: (_v, r) => (typeof r.targetScore === 'number' ? nearestLength(r.targetScore).maxRounds : undefined),
  pickSeconds: choice(RULE_CHOICES.pickSeconds),
  placeSeconds: choice(RULE_CHOICES.placeSeconds),
  raceSeconds: choice(RULE_CHOICES.raceSeconds),
  gravity: choice(GRAVITY_CHOICES),
  weather: (v) => (typeof v === 'boolean' ? v : undefined),
  bloodRounds: choice(BLOOD_CHOICES),
  secretParts: (v) => (typeof v === 'boolean' ? v : undefined),
};

/** Clamp to allowed values so a bad packet can't break a match. */
export function sanitizeRules(r: Partial<MatchRules>): MatchRules {
  const out: Record<string, unknown> = { ...DEFAULT_RULES };
  for (const [k, check] of Object.entries(RULE_CHECKS)) {
    const v = check(r[k as keyof MatchRules], r);
    if (v !== undefined) out[k] = v;
  }
  return out as unknown as MatchRules;
}
