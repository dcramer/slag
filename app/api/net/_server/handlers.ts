import {
  type BeatReply,
  type IceServer,
  isSignal,
  type JoinReply,
  type Mail,
  MAILBOX_TTL_S,
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
import type { Store } from './store';

/**
 * Room presence and handshake mailboxes, one function per API op. Stateless:
 * everything lives in the store under keys that always carry a TTL.
 *
 *   slag:<ROOM>:n          join counter (INCR): the atomic source of join order
 *   slag:<ROOM>:m          sorted set of peers, scored by join order
 *   slag:<ROOM>:p:<peer>   liveness marker; a heartbeat renews it
 *   slag:<ROOM>:b:<peer>   list of handshakes waiting for that peer
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

const counter = (room: string) => `slag:${room}:n`;
const members = (room: string) => `slag:${room}:m`;
const alive = (room: string, peer: string) => `slag:${room}:p:${peer}`;
const box = (room: string, peer: string) => `slag:${room}:b:${peer}`;

interface Ctx {
  store: Store;
  ice: IceServer[];
}

function str(v: unknown, re: RegExp): string {
  if (typeof v !== 'string' || !re.test(v)) throw new ApiError('bad-request', 400);
  return v;
}

function order(v: unknown): number {
  if (!Number.isSafeInteger(v) || (v as number) < 0) throw new ApiError('bad-request', 400);
  return v as number;
}

/** Live members in join order, forgetting any whose heartbeat lapsed. */
async function readMembers(store: Store, room: string): Promise<MemberInfo[]> {
  const [reply] = (await store.run([['ZRANGE', members(room), 0, -1, 'WITHSCORES']])) as [string[] | null];
  const flat = reply ?? [];
  const list: MemberInfo[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) list.push({ id: flat[i], order: Number(flat[i + 1]) });
  if (list.length === 0) return list;
  const [marks] = (await store.run([['MGET', ...list.map((m) => alive(room, m.id))]])) as [(string | null)[]];
  const dead = list.filter((_, i) => marks[i] === null);
  if (dead.length) await store.run([['ZREM', members(room), ...dead.map((m) => m.id)]]);
  return list.filter((_, i) => marks[i] !== null);
}

async function join(ctx: Ctx, room: string, peer: string): Promise<JoinReply> {
  const list = await readMembers(ctx.store, room);
  const others = list.filter((m) => m.id !== peer);
  if (others.length >= MAX_PEERS) throw new ApiError('full', 409);
  const [next] = (await ctx.store.run([
    ['INCR', counter(room)],
    ['EXPIRE', counter(room), ROOM_TTL_S],
  ])) as [number];
  // INCR makes concurrent joins distinct. The max covers a counter that expired under a live room: rejoining never wins the host seat back.
  const mine = Math.max(next, ...list.map((m) => m.order + 1));
  await ctx.store.run([
    ['ZADD', members(room), mine, peer],
    ['SET', alive(room, peer), 1, 'EX', PEER_TTL_S],
    ['EXPIRE', members(room), ROOM_TTL_S],
  ]);
  return { order: mine, members: [...others, { id: peer, order: mine }], ice: ctx.ice };
}

async function beat(ctx: Ctx, room: string, peer: string, host: boolean): Promise<BeatReply> {
  if (!host) {
    const [renewed] = await ctx.store.run([['EXPIRE', alive(room, peer), PEER_TTL_S]]);
    return { alive: renewed === 1 };
  }
  const [renewed, , , first] = (await ctx.store.run([
    ['EXPIRE', alive(room, peer), PEER_TTL_S],
    ['EXPIRE', members(room), ROOM_TTL_S],
    ['EXPIRE', counter(room), ROOM_TTL_S],
    ['ZRANGE', members(room), 0, 0],
  ])) as [number, number, number, string[] | null];
  return { alive: renewed === 1, head: first?.[0] };
}

/** Remove `peer`, unless it has rejoined since (a newer order means a newer session of the same id). */
async function remove(store: Store, room: string, peer: string, seen: number) {
  const [score] = (await store.run([['ZSCORE', members(room), peer]])) as [string | null];
  if (score === null || Number(score) !== seen) return;
  await store.run([
    ['ZREM', members(room), peer],
    ['DEL', alive(room, peer)],
    ['DEL', box(room, peer)],
  ]);
}

async function deliver(ctx: Ctx, room: string, peer: string, to: string, signal: unknown) {
  if (!isSignal(signal)) throw new ApiError('bad-request', 400);
  const [fromOk, toOk] = await ctx.store.run([
    ['EXISTS', alive(room, peer)],
    ['EXISTS', alive(room, to)],
  ]);
  if (fromOk !== 1 || toOk !== 1) return { delivered: false };
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
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const room = str(b.room, ROOM_RE);
  const peer = str(b.peer, PEER_RE);
  switch (op) {
    case 'join':
      return join(ctx, room, peer);
    case 'beat':
      return beat(ctx, room, peer, b.host === true);
    case 'leave':
      await remove(ctx.store, room, peer, order(b.order));
      return {};
    case 'gone': {
      // A peer that failed to answer an offer. Only members may report, and the report names the session it means.
      const target = str(b.gone, PEER_RE);
      const [reporter] = await ctx.store.run([['EXISTS', alive(room, peer)]]);
      if (reporter !== 1) return { members: await readMembers(ctx.store, room) } satisfies MembersReply;
      await remove(ctx.store, room, target, order(b.order));
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
