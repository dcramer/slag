import { isBotDevice } from '../brain/device';
import { tidyName } from '../core/name';
import { nameBlocked } from '../core/name-filter';
import { type CharacterDef, generateCharacter } from '../gen/character';
import { BOT_LEVELS, type BotLevel, type Match } from '../game/match';
import { BLOOD_CHOICES, DEFAULT_RULES, DIFFICULTY_CHOICES, GRAVITY_CHOICES, type MatchRules, nearestLength, PART_VARIETIES, RULE_CHOICES } from '../game/rules';
import { MAX_PLAYERS } from '../sim/constants';
import { THEME_IDS, type ThemeId } from '../themes';

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
  /** Restore a saved look (character seed) for one of the sender's players, in its saved swatch if it has one. */
  | { t: 'look'; dev: string; seed: number; color?: number }
  /** Wear swatch `color` (PLAYER_COLORS). The first to reach a free swatch gets it; a later ask finds it taken and does nothing. */
  | { t: 'color'; dev: string; color: number }
  /** How well a bot plays: its own machine's choice, shown on everyone's card. */
  | { t: 'bot'; dev: string; level: BotLevel }
  /**
   * Host only: a bot seat moves to the host as device `to` (`<host>:botN`), look, score and all. Bot seats are the
   * room's and the host runs them, so a new host takes over every one it finds under another peer's id.
   */
  | { t: 'adopt'; dev: string; to: string }
  /** Host only: the per-match salt (crate order) for the next match start. */
  | { t: 'salt'; salt: number }
  /** Host only, lobby only. */
  | { t: 'rules'; rules: MatchRules }
  /** Host only, lobby only: the lobby's level by seed, in `theme` or (null) the one the seed picks. */
  | { t: 'level'; seed: number; theme: ThemeId | null }
  /**
   * Host only, lobby only: out of the room, and refused until match frame `until` if it comes back, by its peer
   * id and by `client`, the browser's own id (identity.ts), which a new tab or a cleared session doesn't change.
   */
  | { t: 'kick'; peer: string; client?: string; until?: number }
  /**
   * A peer watches (`on`) or wants to play again. Watching gives up the peer's own seats (never the bots it runs,
   * which are the room's): at once in the lobby, at the round boundary mid-match. `name` labels its chip. `afk` is the host's: it saw the player idle.
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
  parked: Record<string, { dev: string; char: CharacterDef; score?: number }[]>;
  /** Peers the host removed. Replicated, so a new host keeps refusing them. */
  /** Peers the host removed → the match frame until which they're refused. Replicated, so a new host keeps refusing them. */
  kicked: Record<string, number>;
  /** The same, by client id (identity.ts): the browser, whatever tab or peer id it comes back with. */
  banned: Record<string, number>;
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

/** How long a kick keeps someone out by default, in sim frames: long enough that rejoining at once isn't worth it. */
export const KICK_BAN_FRAMES = 60 * 60;

/** Remembered watchers, oldest dropped first: entries outlive peers that never come back. */
const MAX_WATCHERS = 16;

export function newNetState(): NetState {
  return { parked: {}, kicked: {}, banned: {}, watching: {}, queue: [] };
}

/** Frames until a peer (or the browser it's in) may come back; 0 when it may. */
export function bannedFor(m: Match, ns: NetState, peer: string, client?: string): number {
  const until = Math.max(ns.kicked[peer] ?? 0, client ? (ns.banned[client] ?? 0) : 0);
  return Math.max(0, until - m.frame);
}

/** Seats nobody holds or is owed at the next round boundary: the seats a request can still win. */
export function freeSeats(m: Match, ns: NetState): number {
  return MAX_PLAYERS - m.players.filter((p) => !p.leaving).length - ns.queue.length;
}

/** Names come off the wire: the same limits as a player's, and '' for one the name filter refuses. */
export function cleanName(v: unknown): string {
  const name = tidyName(v);
  return nameBlocked(name) ? '' : name;
}

/** A character off the wire or out of a save, with its seed's own name in place of one the name filter refuses. */
export function cleanCharacter(c: CharacterDef): CharacterDef {
  return typeof c.name === 'string' && c.name && !nameBlocked(c.name) ? c : { ...c, name: generateCharacter(c.seed).name };
}

/**
 * A guest's action as the host passes it on to the room: a name the filter refuses goes out as the player's own
 * generated name (or none, for a watcher's label), so the room never carries it. A watch's `afk` is the host's call.
 */
export function relayAction(m: Match, a: NetAction): NetAction {
  if (a.t === 'watch') {
    const name = cleanName(a.name);
    return name ? { t: 'watch', dev: a.dev, on: a.on, name } : { t: 'watch', dev: a.dev, on: a.on };
  }
  if (a.t !== 'name' || !nameBlocked(tidyName(a.name))) return a;
  const p = m.players.find((q) => q.device === a.dev);
  return { ...a, name: p ? generateCharacter(p.character.seed).name : '' };
}

/** Peer id that owns a global device id (`<peer>:<local device>`), or '' for un-namespaced (offline/debug) devices. */
export function peerOf(dev: string): string {
  const i = dev.indexOf(':');
  return i < 0 ? '' : dev.slice(0, i);
}

/**
 * The peer whose person sits in this seat: its peer, or '' for a bot. A bot's device names the machine that runs
 * it, which is whoever hosts, so it never makes that peer seated, holds its place in line or follows it to watch.
 */
export function personOf(dev: string): string {
  return isBotDevice(dev) ? '' : peerOf(dev);
}

/** Where seats change hands: the lobby, and the round boundary (the score and victory screens). */
export const SEAT_PHASES = new Set(['lobby', 'score', 'victory']);

/**
 * What a watcher's Join opens. Mid-match, the join card: the toy, the name and color to settle before going in, and
 * how the ask went. In the lobby, nothing: the seat is taken the way arriving takes one, and the lobby card that
 * appears already changes all of that.
 */
export function joinOpensCard(phase: string): boolean {
  return phase !== 'lobby';
}

function seat(m: Match, ns: NetState, dev: string, char?: CharacterDef) {
  const peer = peerOf(dev);
  // Dropped mid-match for being gone too long and back: the same look, and the points they had.
  const park = ns.parked[peer]?.find((x) => x.dev === dev);
  const old = char ?? park?.char;
  const p = m.join(dev, old && cleanCharacter(old));
  if (p && park?.score && m.phase !== 'lobby') p.score = park.score;
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
      if (!peer || bannedFor(m, ns, peer) > 0) return;
      if (!a.on) {
        ns.queue = ns.queue.filter((q) => q.peer !== peer);
        return;
      }
      // Already in, or already owed one: a second click is the same request.
      if (m.players.some((p) => personOf(p.device) === peer && !p.leaving) || ns.queue.some((q) => q.peer === peer)) return;
      const mine = m.players.filter((p) => personOf(p.device) === peer);
      if (mine.length) {
        // On the way out and changed their mind: they keep the seat they have, unless someone has been promised it since
        // (a watcher's Join won it mid-round): then they lost the race like anyone.
        const back = mine.filter((p) => p.leaving);
        if (freeSeats(m, ns) < back.length) return;
        for (const p of back) delete p.leaving;
        // A park from being dropped mid-match is stale once the seat is kept: a later rejoin would restore it.
        const parked = ns.parked[peer]?.filter((x) => !back.some((p) => p.device === x.dev));
        if (parked?.length) ns.parked[peer] = parked;
        else delete ns.parked[peer];
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
      const peer = peerOf(a.dev);
      if (m.phase !== 'lobby') {
        // Mid-match: gone too long (see NetSession DROP_FRAMES). Out at the round boundary, its seat free from now.
        const p = m.players.find((q) => q.device === a.dev);
        if (!p || p.leaving) return;
        p.leaving = true;
        (ns.parked[peer] ??= []).push({ dev: a.dev, char: p.character, score: p.score });
      } else {
        const p = m.leave(a.dev);
        // A bot sent away is gone, not parked: a parked seat comes back the moment its peer is in the lobby.
        if (!p || isBotDevice(a.dev)) return;
        (ns.parked[peer] ??= []).push({ dev: a.dev, char: p.character });
      }
      if (ns.parked[peer].length > 4) ns.parked[peer].shift();
      return;
    }
    case 'away': {
      const p = m.players.find((q) => q.device === a.dev);
      if (!p) return;
      if (a.on) {
        p.away = true;
        p.awayAt = m.frame;
      } else {
        delete p.away; // keep snapshots canonical (no `away: false` vs missing)
        delete p.awayAt;
      }
      return;
    }
    case 'name': {
      const p = m.players.find((q) => q.device === a.dev);
      if (!p) return;
      const typed = tidyName(a.name); // wire data: don't trust the type
      // Refused by the name filter: the player goes by the name its look came with.
      const name = nameBlocked(typed) ? generateCharacter(p.character.seed).name : typed;
      if (name && !m.players.some((q) => q !== p && q.character.name === name)) m.setName(p.slot, name);
      return;
    }
    case 'look': {
      const p = m.players.find((q) => q.device === a.dev);
      // Two tabs of one browser share a saved look; the second one keeps the character it rolled.
      if (p && Number.isInteger(a.seed)) m.setLook(p.slot, a.seed >>> 0, a.color);
      return;
    }
    case 'bot': {
      const p = m.players.find((q) => q.device === a.dev);
      if (!p || !isBotDevice(a.dev) || !BOT_LEVELS.includes(a.level)) return; // wire data
      if (a.level === 'normal') delete p.bot; // keep snapshots canonical
      else p.bot = a.level;
      return;
    }
    case 'adopt': {
      const p = m.players.find((q) => q.device === a.dev);
      // Wire data: bot seats only, onto a bot device nobody holds.
      if (!p || typeof a.to !== 'string' || !isBotDevice(a.dev) || !isBotDevice(a.to) || !peerOf(a.to) || m.players.some((q) => q.device === a.to)) return;
      p.device = a.to;
      return;
    }
    case 'color': {
      const p = m.players.find((q) => q.device === a.dev);
      if (p) m.setColor(p.slot, a.color); // wire data: setColor checks it's a swatch
      return;
    }
    case 'salt':
      if (Number.isInteger(a.salt)) m.nextSalt = a.salt >>> 0;
      return;
    case 'rules':
      if (m.phase === 'lobby') m.setRules(sanitizeRules(a.rules));
      return;
    case 'level':
      // Wire data: a seed and a theme this build has, or nothing changes.
      if (Number.isInteger(a.seed) && (a.theme === null || (THEME_IDS as readonly unknown[]).includes(a.theme)))
        m.pickLevel(a.seed >>> 0, a.theme ?? undefined);
      return;
    case 'kick':
      if (m.phase !== 'lobby' || typeof a.peer !== 'string') return;
      for (const p of m.players.filter((q) => peerOf(q.device) === a.peer)) m.leave(p.device);
      delete ns.parked[a.peer];
      delete ns.watching[a.peer];
      ns.queue = ns.queue.filter((q) => q.peer !== a.peer);
      {
        const until = Number.isSafeInteger(a.until) ? (a.until as number) : m.frame + KICK_BAN_FRAMES;
        // Bans that ran out go, so the lists stay as short as the room's recent kicks.
        for (const list of [ns.kicked, ns.banned]) for (const [k, v] of Object.entries(list)) if (v <= m.frame) delete list[k];
        ns.kicked[a.peer] = until;
        if (typeof a.client === 'string' && a.client) ns.banned[a.client] = until;
      }
      return;
    case 'watch': {
      const peer = peerOf(a.dev);
      if (!peer || bannedFor(m, ns, peer) > 0) return;
      const mine = m.players.filter((q) => personOf(q.device) === peer);
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
      // Parked looks stay: a watcher's Join gets its look (and a dropped player its points) back; a join refuses watchers.
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
  difficulty: choice(DIFFICULTY_CHOICES),
  weather: (v) => (typeof v === 'boolean' ? v : undefined),
  bloodRounds: choice(BLOOD_CHOICES),
  secretParts: (v) => (typeof v === 'boolean' ? v : undefined),
  parts: choice(PART_VARIETIES),
  private: (v) => (typeof v === 'boolean' ? v : undefined),
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
