import { type CharacterDef, generateCharacter } from '../gen/character';
import type { Match } from '../game/match';
import { DEFAULT_RULES, type MatchRules, nearestLength, RULE_CHOICES, type TimerRule } from '../game/rules';
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
  | { t: 'kick'; peer: string };

/** Replicated session state that isn't part of the Match (kept identical on every peer by the same actions). */
export interface NetState {
  /** peer id → players removed from the lobby while that peer was away. */
  parked: Record<string, { dev: string; char: CharacterDef }[]>;
  /** Peers the host removed. Replicated, so a new host keeps refusing them. */
  kicked: Record<string, true>;
}

export function newNetState(): NetState {
  return { parked: {}, kicked: {} };
}

/** Peer id that owns a global device id (`<peer>:<local device>`), or '' for un-namespaced (offline/debug) devices. */
export function peerOf(dev: string): string {
  const i = dev.indexOf(':');
  return i < 0 ? '' : dev.slice(0, i);
}

const SEAT_PHASES = new Set(['lobby', 'score', 'victory']);

export function applyAction(m: Match, ns: NetState, a: NetAction): void {
  switch (a.t) {
    case 'join': {
      if (!SEAT_PHASES.has(m.phase) || m.players.length >= MAX_PLAYERS) return;
      m.join(a.dev, a.char);
      const peer = peerOf(a.dev);
      const parked = ns.parked[peer]?.filter((x) => x.dev !== a.dev);
      if (parked?.length) ns.parked[peer] = parked;
      else delete ns.parked[peer];
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
      const name = typeof a.name === 'string' ? a.name.slice(0, 12).trim() : ''; // wire data: don't trust the type
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
      if (m.phase === 'lobby') m.rules = sanitizeRules(a.rules);
      return;
    case 'kick':
      if (m.phase !== 'lobby' || typeof a.peer !== 'string') return;
      for (const p of m.players.filter((q) => peerOf(q.device) === a.peer)) m.leave(p.device);
      delete ns.parked[a.peer];
      ns.kicked[a.peer] = true;
      return;
  }
}

/** Clamp to allowed values so a bad packet can't break a match. */
export function sanitizeRules(r: Partial<MatchRules>): MatchRules {
  const out = { ...DEFAULT_RULES };
  for (const k of Object.keys(RULE_CHOICES) as TimerRule[]) {
    const v = r[k];
    if (typeof v === 'number' && RULE_CHOICES[k].includes(v)) out[k] = v;
  }
  // Points and rounds travel as a pair, so a packet can't invent a match that never ends.
  if (typeof r.targetScore === 'number') {
    const { targetScore, maxRounds } = nearestLength(r.targetScore);
    out.targetScore = targetScore;
    out.maxRounds = maxRounds;
  }
  return out;
}
