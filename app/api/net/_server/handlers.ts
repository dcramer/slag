import {
  type BeatReply,
  cleanListing,
  type IceServer,
  isSignal,
  type JoinReply,
  LIST_TTL_S,
  type ListedRoom,
  type LobbiesReply,
  type Mail,
  MAILBOX_TTL_S,
  MAX_LISTED,
  MAX_MAILBOX,
  MAX_PEERS,
  type MemberInfo,
  type MembersReply,
  PEER_RE,
  PEER_TTL_S,
  type PollReply,
  ROOM_RE,
  ROOM_TTL_S,
  type SignalErrorCode,
  type SignalOp,
} from '../../../../src/net/signal-protocol';
import { evalCmd, FULL, JOIN, LAST_ORDER, LIST_BEAT, REMOVE } from './scripts';
import type { Store } from './store';

/**
 * Room presence, handshake mailboxes and the public lobby list, one function per API op. Stateless:
 * everything lives in the store under keys that always carry a TTL.
 *
 *   slag:<ROOM>:m          sorted set of peers, scored by join order, plus LAST_ORDER (the last order handed out)
 *   slag:<ROOM>:p:<peer>   liveness marker, holding the joining session's stamp; a heartbeat renews it
 *   slag:<ROOM>:b:<peer>   list of handshakes waiting for that peer
 *   slag:<ROOM>:l          the room's listing (players, observers, max, theme, phase, host name as JSON), written by its host's beat
 *   slag:lobbies           the lobby index: sorted set of listed rooms, scored by their host's last beat (ms)
 *
 * Joining and removing a session read and write as one step, in Lua scripts (scripts.ts): one peer id can have two
 * sessions in flight, and plain commands would let one's write land between the other's check and write.
 *
 * The API is public and unauthenticated, so the room code and peer id are all
 * a caller needs. Worst case someone in a room disrupts that room; inputs and
 * sizes are bounded so nobody can do more than that. Commands per op are in
 * docs/NETCODE.md and pinned by tests/signal-handlers.test.ts.
 */

export class ApiError extends Error {
  constructor(
    readonly code: SignalErrorCode,
    readonly status: number,
  ) {
    super(code);
  }
}

const members = (room: string) => `slag:${room}:m`;
const alivePrefix = (room: string) => `slag:${room}:p:`;
const alive = (room: string, peer: string) => alivePrefix(room) + peer;
const box = (room: string, peer: string) => `slag:${room}:b:${peer}`;
const listing = (room: string) => `slag:${room}:l`;
const LOBBIES = 'slag:lobbies';
/** The index's own TTL, renewed whenever a room is newly listed (see LIST_BEAT in scripts.ts). */
const INDEX_TTL_S = 86_400;

interface Ctx {
  store: Store;
  ice: IceServer[];
  /** The clock beats are scored by (ms). Default: Date.now. */
  now?: () => number;
}

function str(v: unknown, re: RegExp): string {
  if (typeof v !== 'string' || !re.test(v)) throw new ApiError('bad-request', 400);
  return v;
}

function order(v: unknown): number {
  if (!Number.isSafeInteger(v) || (v as number) < 0) throw new ApiError('bad-request', 400);
  return v as number;
}

function since(v: unknown): number | undefined {
  if (v === undefined) return undefined;
  if (!Number.isSafeInteger(v) || (v as number) <= 0) throw new ApiError('bad-request', 400);
  return v as number;
}

/**
 * Live members in join order, leaving out any whose heartbeat lapsed. It never prunes them: a ZREM after the MGET
 * would race a rejoin landing in between and drop a live peer for good. The join script prunes, atomically.
 */
async function readMembers(store: Store, room: string): Promise<MemberInfo[]> {
  const [reply] = (await store.run([['ZRANGE', members(room), 0, -1, 'WITHSCORES']])) as [string[] | null];
  const flat = reply ?? [];
  const list: MemberInfo[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) if (flat[i] !== LAST_ORDER) list.push({ id: flat[i], order: Number(flat[i + 1]) });
  if (list.length === 0) return list;
  const [marks] = (await store.run([['MGET', ...list.map((m) => alive(room, m.id))]])) as [(string | null)[]];
  return list.filter((_, i) => marks[i] !== null);
}

/** Pairs of id, order, as the join script lists members. */
function pairs(flat: unknown[]): MemberInfo[] {
  const list: MemberInfo[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) list.push({ id: String(flat[i]), order: Number(flat[i + 1]) });
  return list;
}

/**
 * `stamp` is when the joining session started, increasing per tab. A tab can have two sessions of one peer id in
 * flight (the lobby remounted, or the page reloaded while its join was still on the way), and their joins can land
 * in either order: the older one writes nothing once the newer one is in.
 */
async function join(ctx: Ctx, room: string, peer: string, stamp?: number): Promise<JoinReply> {
  const script = evalCmd(JOIN, [members(room)], [peer, stamp ?? '', MAX_PEERS, PEER_TTL_S, ROOM_TTL_S, alivePrefix(room)]);
  const [reply] = (await ctx.store.run([script])) as [unknown[]];
  const [code, mine, ...rest] = reply;
  if (code === FULL) throw new ApiError('full', 409);
  const others = pairs(rest);
  return { order: Number(mine), members: [...others, { id: peer, order: Number(mine) }].sort((a, b) => a.order - b.order), ice: ctx.ice };
}

/**
 * Remove one session of `peer`. A session leaving names itself by stamp: its entry goes unless a newer session of the
 * peer wrote it, whatever order the store holds, so a refreshed page's goodbye arriving after the new page joined
 * changes nothing. A report (or a client that sends no stamp) names the session by its exact order.
 */
async function remove(store: Store, room: string, peer: string, by: { stamp: number } | { order: number }, unlist = false) {
  const [mode, value] = 'stamp' in by ? ['stamp', by.stamp] : ['order', by.order];
  const keys = [members(room), alive(room, peer), box(room, peer)];
  const args: (string | number)[] = [peer, mode, value];
  if (unlist) {
    keys.push(LOBBIES, listing(room));
    args.push(room);
  }
  await store.run([evalCmd(REMOVE, keys, args)]);
}

/**
 * A heartbeat. A host also renews the room and learns its lowest order, and with `list` puts the room on the lobby
 * list (in one script, only while its session is alive); `list: false` takes it off, for a room just made Private.
 * A listing that fails `cleanListing` is ignored rather than failing the beat: liveness matters more than the list.
 * `stamp` names the beating session: a newer one holding the peer's liveness (the id taken by another tab) makes it
 * `replaced`. The renewal reads the stamp back (GETEX), so knowing costs no command.
 */
async function beat(ctx: Ctx, room: string, peer: string, host: boolean, list: unknown, stamp?: number): Promise<BeatReply> {
  const reply = (renewed: boolean, held: unknown, head?: string): BeatReply => {
    const r: BeatReply = { alive: renewed };
    if (head !== undefined) r.head = head;
    if (renewed && stamp !== undefined && Number(held) > stamp) r.replaced = true;
    return r;
  };
  if (!host) {
    const [held] = await ctx.store.run([['GETEX', alive(room, peer), 'EX', PEER_TTL_S]]);
    return reply(held !== null, held);
  }
  const shown = list === false ? null : cleanListing(list);
  const base = [
    ['GETEX', alive(room, peer), 'EX', PEER_TTL_S],
    ['EXPIRE', members(room), ROOM_TTL_S],
    ['ZRANGE', members(room), 0, 0],
  ];
  let renewed: number;
  let held: unknown;
  let head: string | null | undefined;
  if (shown) {
    const now = (ctx.now ?? Date.now)();
    const script = evalCmd(
      LIST_BEAT,
      [alive(room, peer), members(room), LOBBIES, listing(room)],
      [PEER_TTL_S, ROOM_TTL_S, now, JSON.stringify(shown), LIST_TTL_S, INDEX_TTL_S, room],
    );
    [[renewed, head, held]] = (await ctx.store.run([script])) as [[number, string | null, string | null]];
  } else {
    const unlist =
      list === false
        ? [
            ['ZREM', LOBBIES, room],
            ['DEL', listing(room)],
          ]
        : [];
    const [r, , first] = (await ctx.store.run([...base, ...unlist])) as [string | null, number, string[] | null];
    renewed = r === null ? 0 : 1;
    held = r;
    head = first?.[0];
  }
  return reply(renewed === 1, held, head === LAST_ORDER || head === null ? undefined : head);
}

/**
 * The lobby list: rooms whose host beat within LIST_TTL_S, most recent first. One range, then one fetch of their
 * listings; a room made Private or ended between the two has no listing and is left out.
 */
async function lobbies(ctx: Ctx): Promise<LobbiesReply> {
  const since = (ctx.now ?? Date.now)() - LIST_TTL_S * 1000;
  const [codes] = (await ctx.store.run([['ZREVRANGEBYSCORE', LOBBIES, '+inf', since, 'LIMIT', 0, MAX_LISTED]])) as [string[] | null];
  const rooms = (codes ?? []).filter((c) => ROOM_RE.test(c));
  if (rooms.length === 0) return { rooms: [] };
  const [raw] = (await ctx.store.run([['MGET', ...rooms.map(listing)]])) as [(string | null)[]];
  const out: ListedRoom[] = [];
  rooms.forEach((room, i) => {
    let l: ReturnType<typeof cleanListing> = null;
    try {
      l = raw[i] === null ? null : cleanListing(JSON.parse(raw[i]!));
    } catch {
      // Only beats write here, checked; a bad entry is left out, never fatal.
    }
    if (l) out.push({ room, ...l });
  });
  return { rooms: out };
}

async function deliver(ctx: Ctx, room: string, peer: string, to: string, signal: unknown) {
  if (!isSignal(signal)) throw new ApiError('bad-request', 400);
  const [fromOk, toOk] = await ctx.store.run([
    ['EXISTS', alive(room, peer)],
    ['EXISTS', alive(room, to)],
  ]);
  // Which side is missing matters: a sender the store forgot (liveness lapsed while its phone slept) must rejoin,
  // not take the target for dead.
  if (fromOk !== 1) return { delivered: false, gone: 'self' };
  if (toOk !== 1) return { delivered: false, gone: 'to' };
  const mail: Mail = { from: peer, s: signal };
  await ctx.store.run([
    ['RPUSH', box(room, to), JSON.stringify(mail)],
    ['LTRIM', box(room, to), -MAX_MAILBOX, -1],
    ['EXPIRE', box(room, to), MAILBOX_TTL_S],
  ]);
  return { delivered: true };
}

async function poll(ctx: Ctx, room: string, peer: string): Promise<PollReply> {
  const [raw] = (await ctx.store.run([['LPOP', box(room, peer), MAX_MAILBOX]])) as [string[] | null];
  const mail: Mail[] = [];
  for (const m of raw ?? []) {
    try {
      mail.push(JSON.parse(m) as Mail);
    } catch {
      // Only this module writes here; a bad entry is dropped, never fatal.
    }
  }
  return { mail };
}

/** Run one API op for a parsed JSON body. Throws ApiError for anything the caller got wrong. */
export async function handleOp(op: SignalOp, body: unknown, ctx: Ctx): Promise<unknown> {
  // The list belongs to no room: anyone may read it.
  if (op === 'lobbies') return lobbies(ctx);
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const room = str(b.room, ROOM_RE);
  const peer = str(b.peer, PEER_RE);
  switch (op) {
    case 'join':
      return join(ctx, room, peer, since(b.since));
    case 'beat':
      return beat(ctx, room, peer, b.host === true, b.list, since(b.since));
    case 'leave': {
      const seen = order(b.order);
      const stamp = since(b.since);
      // A listed host leaving takes its room off the list (see REMOVE).
      await remove(ctx.store, room, peer, stamp === undefined ? { order: seen } : { stamp }, b.unlist === true);
      return {};
    }
    case 'gone': {
      // A peer that failed to answer an offer. Only members may report, and the report names the session it means.
      const target = str(b.gone, PEER_RE);
      const [reporter] = await ctx.store.run([['EXISTS', alive(room, peer)]]);
      if (reporter !== 1) return { members: await readMembers(ctx.store, room) } satisfies MembersReply;
      await remove(ctx.store, room, target, { order: order(b.order) });
      return { members: await readMembers(ctx.store, room) } satisfies MembersReply;
    }
    case 'members':
      return { members: await readMembers(ctx.store, room) } satisfies MembersReply;
    case 'signal':
      return deliver(ctx, room, peer, str(b.to, PEER_RE), b.signal);
    case 'poll':
      return poll(ctx, room, peer);
  }
}
