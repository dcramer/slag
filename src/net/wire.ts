import { BOT_LEVELS } from '../game/match';
import { type CharacterDef, CAST } from '../gen/character';
import type { MatchRules } from '../game/rules';
import { THEME_IDS } from '../themes';
import { type DeviceId, type NetAction, type NetState, peerOf, localOf, type Watcher } from './actions';
import type { Enc, PeerFrame } from './codec';
import { MAX_PEERS } from './signal-protocol';
import type { MatchSnap } from './snapshot';

/**
 * The trust boundary: everything a peer sends comes in through `parseMsg`, which returns a message whose every
 * field has the type the session's code says it has, or null. Past here nothing checks a type again, and nothing
 * a peer can send throws. Game rules (who may do what, which values a rule allows) stay with the session and
 * applyAction; this only says what a well-formed message is.
 *
 * Parsed objects are built afresh from the known fields, so nothing a peer adds rides along into a bundle the
 * host relays. A character is the exception: it is stored as sent, so every peer stores the same object.
 */

export interface Bundle {
  f: number;
  /** Global device → input; devices with no buttons are omitted. */
  i?: Record<string, Enc>;
  a?: NetAction[];
  /** Ack deltas: peer → [last consumed input seq, last accepted action n]. */
  k?: Record<string, [number, number]>;
}

export type Msg =
  | { t: 'in'; s: number; f: PeerFrame[]; a?: [number, NetAction][]; c: number; h?: [number, number] }
  | { t: 'b'; b: Bundle[] }
  | { t: 'sync'; s: MatchSnap; k: Record<string, [number, number]>; ns: NetState; last: Record<string, Enc>; why: string }
  /** `f`: the furthest frame this peer holds, -1 if it never joined this room's timeline. */
  | { t: 'hello'; f: number; c?: string }
  | { t: 'need'; f: number }
  /** New host to the furthest guest: send me your state. */
  | { t: 'pull' }
  | { t: 'state'; s: MatchSnap; k: Record<string, [number, number]>; ns: NetState; last: Record<string, Enc> }
  | { t: 'ping'; ts: number }
  | { t: 'pong'; ts: number }
  | { t: 'pings'; p: Record<string, number> }
  /** Host to a peer it removed, or refuses: `left` ms until it may come back. */
  | { t: 'kicked'; left?: number };

/** Input frames one `in` carries: a guest folds older ones together past this. */
export const FRAMES_PER_MSG = 90;
/** Requests one `in` carries; the rest go in the next one, once these are acked. */
export const ACTS_PER_MSG = 32;
/** Actions one bundle carries; the host holds the rest for the next frame. */
export const ACTS_PER_BUNDLE = 128;
/** Bundles one `b` carries (a resend after a gap is split into messages of this many). */
export const BUNDLES_PER_MSG = 120;
/** Local devices one peer's frame names: keyboards, pads, touch, and the bots a host runs. */
const DEVICES_PER_PEER = 16;
const PEER_KEYS = 64;
const STATE_KEYS = 256;
const ID_CHARS = 64;
const TEXT_CHARS = 1024;

type Parse<T> = (v: unknown) => T | null;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown): v is number => Number.isSafeInteger(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const bool = (v: unknown): v is boolean => typeof v === 'boolean';
const str =
  (max: number) =>
  (v: unknown): v is string =>
    typeof v === 'string' && v.length <= max;
const id = str(ID_CHARS);
const text = str(TEXT_CHARS);
/** An optional field: absent, or the right type (JSON never carries `undefined`, and nothing sends `null` for one). */
const opt = <T>(v: unknown, ok: (v: unknown) => v is T): v is T | undefined => v === undefined || ok(v);
const oneOf =
  <T>(allowed: readonly T[]) =>
  (v: unknown): v is T =>
    allowed.includes(v as T);

function list<T>(v: unknown, max: number, item: Parse<T>): T[] | null {
  if (!Array.isArray(v) || v.length > max) return null;
  const out: T[] = [];
  for (const x of v) {
    const p = item(x);
    if (p === null) return null;
    out.push(p);
  }
  return out;
}

function record<T>(v: unknown, max: number, item: Parse<T>, key: (k: string) => boolean = id): Record<string, T> | null {
  if (!isObj(v)) return null;
  const entries = Object.entries(v);
  if (entries.length > max) return null;
  const out: Record<string, T> = {};
  for (const [k, x] of entries) {
    const p = item(x);
    if (p === null || !key(k)) return null;
    out[k] = p;
  }
  return out;
}

const ok =
  <T>(test: (v: unknown) => v is T): Parse<T> =>
  (v) =>
    test(v) ? v : null;

/** A global device id, `<peer>:<local>`, with neither half empty. */
export function parseDeviceId(v: unknown): DeviceId | null {
  return id(v) && peerOf(v) && localOf(v) ? (v as DeviceId) : null;
}

/** A local device name: no ':', so `<peer>:<local>` always splits back into the same two. */
const localDevice = (k: string) => k.length > 0 && k.length <= ID_CHARS && !k.includes(':');

const parseEnc: Parse<Enc> = (v) => {
  if (int(v) && v >= 0 && v <= 0xffff) return v;
  if (Array.isArray(v) && v.length === 3 && int(v[0]) && v[0] >= 0 && v[0] <= 0xffff && num(v[1]) && num(v[2])) return [v[0], v[1], v[2]];
  return null;
};
const parsePeerFrame: Parse<PeerFrame> = (v) => record(v, DEVICES_PER_PEER, parseEnc, localDevice);
const parseInputs = (v: unknown) => record(v, MAX_PEERS * DEVICES_PER_PEER, parseEnc);
const parsePair: Parse<[number, number]> = (v) => (Array.isArray(v) && v.length === 2 && num(v[0]) && num(v[1]) ? [v[0], v[1]] : null);
const parseAcks = (v: unknown) => record(v, PEER_KEYS, parsePair);

const hsl = (v: unknown) => isObj(v) && num(v.h) && num(v.s) && num(v.l);
const kind = oneOf(CAST);

/** A character as sent, if it has every field a look is drawn from. */
const parseCharacter: Parse<CharacterDef> = (c) => {
  if (!isObj(c) || !int(c.seed) || !text(c.name) || !num(c.hue) || !hsl(c.body) || !hsl(c.accent) || !hsl(c.paint)) return null;
  if (!opt(c.color, int) || !kind(c.kind) || !Array.isArray(c.vary) || c.vary.length > 64 || !c.vary.every(num)) return null;
  return c as unknown as CharacterDef;
};

/** One field-check per action, and the mapped type won't compile with one missing: a new action is unparseable until it has its checks. */
const ACTION_PARSERS: { [K in NetAction['t']]: (a: Record<string, unknown>) => Extract<NetAction, { t: K }> | null } = {
  join: (a) => {
    if (!id(a.dev)) return null;
    if (a.char === undefined) return { t: 'join', dev: a.dev };
    const char = parseCharacter(a.char);
    return char && { t: 'join', dev: a.dev, char };
  },
  leave: (a) => (id(a.dev) ? { t: 'leave', dev: a.dev } : null),
  away: (a) => (id(a.dev) && bool(a.on) ? { t: 'away', dev: a.dev, on: a.on } : null),
  name: (a) => (id(a.dev) && text(a.name) ? { t: 'name', dev: a.dev, name: a.name } : null),
  look: (a) => {
    if (!id(a.dev) || !int(a.seed) || !opt(a.color, int)) return null;
    return a.color === undefined ? { t: 'look', dev: a.dev, seed: a.seed } : { t: 'look', dev: a.dev, seed: a.seed, color: a.color };
  },
  color: (a) => (id(a.dev) && int(a.color) ? { t: 'color', dev: a.dev, color: a.color } : null),
  bot: (a) => (id(a.dev) && oneOf(BOT_LEVELS)(a.level) ? { t: 'bot', dev: a.dev, level: a.level } : null),
  adopt: (a) => {
    const to = parseDeviceId(a.to);
    return id(a.dev) && to ? { t: 'adopt', dev: a.dev, to } : null;
  },
  salt: (a) => (int(a.salt) ? { t: 'salt', salt: a.salt } : null),
  // Which values each rule allows is a game rule: applyAction clamps them (sanitizeRules).
  rules: (a) => (isObj(a.rules) ? { t: 'rules', rules: a.rules as unknown as MatchRules } : null),
  level: (a) => (int(a.seed) && (a.theme === null || oneOf(THEME_IDS)(a.theme)) ? { t: 'level', seed: a.seed, theme: a.theme } : null),
  kick: (a) => {
    if (!id(a.peer) || !opt(a.client, id) || !opt(a.until, int)) return null;
    const out: Extract<NetAction, { t: 'kick' }> = { t: 'kick', peer: a.peer };
    if (a.client !== undefined) out.client = a.client;
    if (a.until !== undefined) out.until = a.until;
    return out;
  },
  watch: (a) => {
    if (!id(a.dev) || !bool(a.on) || !opt(a.name, text) || !opt(a.afk, bool)) return null;
    const out: Extract<NetAction, { t: 'watch' }> = { t: 'watch', dev: a.dev, on: a.on };
    if (a.name !== undefined) out.name = a.name;
    if (a.afk !== undefined) out.afk = a.afk;
    return out;
  },
  seat: (a) => (id(a.dev) && bool(a.on) ? { t: 'seat', dev: a.dev, on: a.on } : null),
};

/** A match action off the wire, or null if it isn't one this build knows, whole. */
export function parseAction(v: unknown): NetAction | null {
  if (!isObj(v) || typeof v.t !== 'string' || !Object.hasOwn(ACTION_PARSERS, v.t)) return null;
  return ACTION_PARSERS[v.t as NetAction['t']](v);
}

const parseNumbered: Parse<[number, NetAction]> = (v) => {
  if (!Array.isArray(v) || v.length !== 2 || !int(v[0])) return null;
  const a = parseAction(v[1]);
  return a && [v[0], a];
};

const parseBundle: Parse<Bundle> = (v) => {
  if (!isObj(v) || !int(v.f)) return null;
  const b: Bundle = { f: v.f };
  if (v.i !== undefined) {
    const i = parseInputs(v.i);
    if (!i) return null;
    b.i = i;
  }
  if (v.a !== undefined) {
    const a = list(v.a, ACTS_PER_BUNDLE, parseAction);
    if (!a) return null;
    b.a = a;
  }
  if (v.k !== undefined) {
    const k = parseAcks(v.k);
    if (!k) return null;
    b.k = k;
  }
  return b;
};

/** Just enough of a snapshot for the session to look at it: restoreMatch checks the rest, and refuses what it can't load. */
const parseSnap: Parse<MatchSnap> = (v) => (isObj(v) && int(v.v) && int(v.frame) ? (v as unknown as MatchSnap) : null);

const parsePark: Parse<NetState['parked'][string][number]> = (v) => {
  if (!isObj(v) || !id(v.dev) || !opt(v.score, num)) return null;
  const char = parseCharacter(v.char);
  if (!char) return null;
  return v.score === undefined ? { dev: v.dev, char } : { dev: v.dev, char, score: v.score };
};
const parseWatcher: Parse<Watcher> = (v) => {
  if (!isObj(v) || !text(v.name) || (v.afk !== undefined && v.afk !== true)) return null;
  return v.afk ? { name: v.name, afk: true } : { name: v.name };
};
const parseQueued: Parse<NetState['queue'][number]> = (v) => (isObj(v) && id(v.peer) && id(v.dev) ? { peer: v.peer, dev: v.dev } : null);

function parseNetState(v: unknown): NetState | null {
  if (!isObj(v)) return null;
  const parked = record(v.parked, STATE_KEYS, (x) => list(x, 16, parsePark));
  const kicked = record(v.kicked, STATE_KEYS, ok(num));
  const banned = record(v.banned, STATE_KEYS, ok(num));
  const watching = record(v.watching, STATE_KEYS, parseWatcher);
  const queue = list(v.queue, STATE_KEYS, parseQueued);
  return parked && kicked && banned && watching && queue && { parked, kicked, banned, watching, queue };
}

/** A sync's or a state's body: the snapshot and the session state around it. */
function parseState(v: Record<string, unknown>) {
  const s = parseSnap(v.s);
  const k = parseAcks(v.k);
  const ns = parseNetState(v.ns);
  const last = parseInputs(v.last);
  return s && k && ns && last && { s, k, ns, last };
}

const MSG_PARSERS: { [K in Msg['t']]: (m: Record<string, unknown>) => Extract<Msg, { t: K }> | null } = {
  in: (m) => {
    if (!int(m.s) || !num(m.c)) return null;
    const f = list(m.f, FRAMES_PER_MSG, parsePeerFrame);
    if (!f) return null;
    const out: Extract<Msg, { t: 'in' }> = { t: 'in', s: m.s, f, c: m.c };
    if (m.a !== undefined) {
      const a = list(m.a, ACTS_PER_MSG, parseNumbered);
      if (!a) return null;
      out.a = a;
    }
    if (m.h !== undefined) {
      const h = parsePair(m.h);
      if (!h) return null;
      out.h = h;
    }
    return out;
  },
  b: (m) => {
    const b = list(m.b, BUNDLES_PER_MSG, parseBundle);
    return b && { t: 'b', b };
  },
  sync: (m) => {
    const st = parseState(m);
    return st && typeof m.why === 'string' ? { t: 'sync', ...st, why: m.why.slice(0, ID_CHARS) } : null;
  },
  hello: (m) => {
    if (!int(m.f) || !opt(m.c, id)) return null;
    return m.c === undefined ? { t: 'hello', f: m.f } : { t: 'hello', f: m.f, c: m.c };
  },
  need: (m) => (int(m.f) ? { t: 'need', f: m.f } : null),
  pull: () => ({ t: 'pull' }),
  state: (m) => {
    const st = parseState(m);
    return st && { t: 'state', ...st };
  },
  ping: (m) => (num(m.ts) ? { t: 'ping', ts: m.ts } : null),
  pong: (m) => (num(m.ts) ? { t: 'pong', ts: m.ts } : null),
  pings: (m) => {
    const p = record(m.p, PEER_KEYS, ok(num));
    return p && { t: 'pings', p };
  },
  kicked: (m) => {
    if (!opt(m.left, num)) return null;
    return m.left === undefined ? { t: 'kicked' } : { t: 'kicked', left: m.left };
  },
};

/** A session message off the wire, or null if any part of it is malformed. */
export function parseMsg(v: unknown): Msg | null {
  if (!isObj(v) || typeof v.t !== 'string' || !Object.hasOwn(MSG_PARSERS, v.t)) return null;
  return MSG_PARSERS[v.t as Msg['t']](v);
}
