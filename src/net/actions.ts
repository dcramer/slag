import type { CharacterDef } from '../gen/character';
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
  | { t: 'rules'; rules: MatchRules };

/** Replicated session state that isn't part of the Match (kept identical on every peer by the same actions). */
export interface NetState {
  /** peer id → players removed from the lobby while that peer was away. */
  parked: Record<string, { dev: string; char: CharacterDef }[]>;
}

export function newNetState(): NetState {
  return { parked: {} };
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
      if (p && name) m.setName(p.slot, name);
      return;
    }
    case 'look': {
      const p = m.players.find((q) => q.device === a.dev);
      if (p && Number.isInteger(a.seed)) m.setLook(p.slot, a.seed >>> 0);
      return;
    }
    case 'salt':
      if (Number.isInteger(a.salt)) m.nextSalt = a.salt >>> 0;
      return;
    case 'rules':
      if (m.phase === 'lobby') m.setRules(sanitizeRules(a.rules));
      return;
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
