import type { Cmd } from './store';

/**
 * The places where presence and the lobby list must read and write as one step, as Lua scripts, which Redis runs atomically
 * (Upstash and SRH run the real Lua). Upstash bills a script as one command plus one per `redis.call`, so these
 * issue no more calls than the pipelines they replace.
 *
 * Each script has a TypeScript mirror that makes the same calls in the same order for MemoryStore, which has no Lua:
 * same replies, same command count. tests/store/srh.test.ts runs both against real Redis and compares.
 */

/** A store command run from inside a script. */
export type Call = (cmd: Cmd) => unknown;

export interface Script {
  lua: string;
  mirror(call: Call, keys: string[], args: string[]): unknown;
}

/** In the member set, the last order handed out: always the highest score, so the next join is one above it. */
export const LAST_ORDER = '#';

/** Join reply codes, first in the script's reply. */
export const JOINED = 0;
export const STALE = 1;
export const FULL = 2;

/**
 * Join. KEYS: the member set. ARGV: peer, stamp ('' from a client that sends none), max other peers, peer TTL,
 * room TTL, liveness key prefix.
 *
 * Reply: [JOINED, order, ...others as id, order] | [STALE, held order, ...live members] | [FULL].
 * - Orders only ever grow: one above every order still in the set, dead or not, and above LAST_ORDER, so a rejoin
 *   never wins the host seat back and two joins never share an order.
 * - A join older than the stamp held for this peer writes nothing: a closed session's join landing late must not
 *   replace the live session's entry.
 */
const JOIN_LUA = `
local m, peer, stamp, prefix = KEYS[1], ARGV[1], tonumber(ARGV[2]), ARGV[6]
local flat = redis.call('ZRANGE', m, 0, -1, 'WITHSCORES')
local ids, orders, top = {}, {}, 0
for i = 1, #flat, 2 do
  local o = tonumber(flat[i + 1])
  if o > top then top = o end
  if flat[i] ~= '${LAST_ORDER}' then
    ids[#ids + 1] = flat[i]
    orders[#orders + 1] = o
  end
end
local others, held, heldOrder = {}, nil, nil
if #ids > 0 then
  local keys = {}
  for i = 1, #ids do keys[i] = prefix .. ids[i] end
  local marks = redis.call('MGET', unpack(keys))
  local dead = {}
  for i = 1, #ids do
    if not marks[i] then
      dead[#dead + 1] = ids[i]
    elseif ids[i] == peer then
      held, heldOrder = tonumber(marks[i]), orders[i]
    else
      others[#others + 1] = ids[i]
      others[#others + 1] = orders[i]
    end
  end
  if #dead > 0 then redis.call('ZREM', m, unpack(dead)) end
end
if stamp and held and held > stamp then
  local reply = {${STALE}, heldOrder}
  for i = 1, #others do reply[#reply + 1] = others[i] end
  return reply
end
if #others / 2 >= tonumber(ARGV[3]) then return {${FULL}} end
local order = top + 1
redis.call('ZADD', m, order, peer, order, '${LAST_ORDER}')
redis.call('SET', prefix .. peer, ARGV[2] ~= '' and ARGV[2] or '1', 'EX', ARGV[4])
redis.call('EXPIRE', m, ARGV[5])
local reply = {${JOINED}, order}
for i = 1, #others do reply[#reply + 1] = others[i] end
return reply
`;

function joinMirror(call: Call, [m]: string[], [peer, stampArg, maxOthers, peerTtl, roomTtl, prefix]: string[]): unknown {
  const stamp = stampArg === '' ? undefined : Number(stampArg);
  const flat = call(['ZRANGE', m, 0, -1, 'WITHSCORES']) as string[];
  const ids: string[] = [];
  const orders: number[] = [];
  let top = 0;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const o = Number(flat[i + 1]);
    top = Math.max(top, o);
    if (flat[i] === LAST_ORDER) continue;
    ids.push(flat[i]);
    orders.push(o);
  }
  const others: (string | number)[] = [];
  let held: number | undefined;
  let heldOrder = 0;
  if (ids.length > 0) {
    const marks = call(['MGET', ...ids.map((id) => prefix + id)]) as (string | null)[];
    const dead: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      if (marks[i] === null) dead.push(ids[i]);
      else if (ids[i] === peer) {
        held = Number(marks[i]);
        heldOrder = orders[i];
      } else others.push(ids[i], orders[i]);
    }
    if (dead.length) call(['ZREM', m, ...dead]);
  }
  if (stamp !== undefined && held !== undefined && held > stamp) return [STALE, heldOrder, ...others];
  if (others.length / 2 >= Number(maxOthers)) return [FULL];
  const order = top + 1;
  call(['ZADD', m, order, peer, order, LAST_ORDER]);
  call(['SET', prefix + peer, stampArg === '' ? '1' : stampArg, 'EX', peerTtl]);
  call(['EXPIRE', m, roomTtl]);
  return [JOINED, order, ...others];
}

/**
 * Remove one session of a peer. KEYS: member set, liveness key, mailbox, and for a host that listed the room, the
 * lobby index and the room's listing. ARGV: peer, 'stamp' or 'order', value, and with the index, the room.
 * - 'stamp' (a session leaving): unless a newer session of the peer wrote the entry, whatever order the store holds.
 * - 'order' (a report that a peer failed, or a client that sends no stamp): only that exact session.
 * A listed host leaving takes the room off the list in the same step, so no reader sees a room nobody hosts; if
 * anyone is still there, the next host lists it again.
 * Reply: 1 removed, 0 not.
 */
const REMOVE_LUA = `
local ok
if ARGV[2] == 'stamp' then
  local mark = redis.call('GET', KEYS[2])
  ok = mark and tonumber(mark) <= tonumber(ARGV[3])
else
  local score = redis.call('ZSCORE', KEYS[1], ARGV[1])
  ok = score and tonumber(score) == tonumber(ARGV[3])
end
if not ok then return 0 end
redis.call('ZREM', KEYS[1], ARGV[1])
redis.call('DEL', KEYS[2], KEYS[3])
if KEYS[5] then
  redis.call('ZREM', KEYS[4], ARGV[4])
  redis.call('DEL', KEYS[5])
end
return 1
`;

function removeMirror(call: Call, [m, alive, box, index, listing]: string[], [peer, mode, value, room]: string[]): unknown {
  const ok =
    mode === 'stamp'
      ? ((mark) => mark !== null && Number(mark) <= Number(value))(call(['GET', alive]) as string | null)
      : ((score) => score !== null && Number(score) === Number(value))(call(['ZSCORE', m, peer]) as string | null);
  if (!ok) return 0;
  call(['ZREM', m, peer]);
  call(['DEL', alive, box]);
  if (listing !== undefined) {
    call(['ZREM', index, room]);
    call(['DEL', listing]);
  }
  return 1;
}

/**
 * A host's beat that lists its room. KEYS: liveness key, member set, lobby index, the room's listing. ARGV: peer TTL,
 * room TTL, now (ms), the listing (JSON), listing TTL, index TTL, the room.
 *
 * Reply: [1 if the host is still alive, the lowest-order member or nil, the stamp its liveness holds or nil], as the
 * plain beat's commands reply.
 * - Only a live session lists: a beat that lands after its own leave, or after the host was written off, must not
 *   put a room nobody hosts back on the list. That check is why this is a script and not pipelined commands.
 * - The index is scored by the beat's time and a reader takes only recent scores, so a room whose host stops beating
 *   falls off by itself. What such rooms leave behind is pruned whenever a room is newly listed, which is also when
 *   the index's TTL is renewed: a beat that only moves its score skips both, two calls cheaper. The index TTL is a
 *   day, so it lapses only if no room was newly listed for a day, and then every host lists again on its next beat.
 */
const LIST_BEAT_LUA = `
local held = redis.call('GETEX', KEYS[1], 'EX', ARGV[1])
local renewed = held and 1 or 0
redis.call('EXPIRE', KEYS[2], ARGV[2])
local head = redis.call('ZRANGE', KEYS[2], 0, 0)[1]
if renewed == 1 then
  if redis.call('ZADD', KEYS[3], ARGV[3], ARGV[7]) == 1 then
    redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', tonumber(ARGV[3]) - tonumber(ARGV[5]) * 1000)
    redis.call('EXPIRE', KEYS[3], ARGV[6])
  end
  redis.call('SET', KEYS[4], ARGV[4], 'EX', ARGV[5])
end
return {renewed, head or false, held or false}
`;

function listBeatMirror(call: Call, [alive, m, index, listing]: string[], [peerTtl, roomTtl, now, json, listTtl, indexTtl, room]: string[]): unknown {
  const held = call(['GETEX', alive, 'EX', peerTtl]) as string | null;
  const renewed = held === null ? 0 : 1;
  call(['EXPIRE', m, roomTtl]);
  const head = (call(['ZRANGE', m, 0, 0]) as string[])[0] ?? null;
  if (renewed === 1) {
    if (call(['ZADD', index, now, room]) === 1) {
      call(['ZREMRANGEBYSCORE', index, '-inf', Number(now) - Number(listTtl) * 1000]);
      call(['EXPIRE', index, indexTtl]);
    }
    call(['SET', listing, json, 'EX', listTtl]);
  }
  return [renewed, head, held];
}

export const JOIN: Script = { lua: JOIN_LUA, mirror: joinMirror };
export const REMOVE: Script = { lua: REMOVE_LUA, mirror: removeMirror };
export const LIST_BEAT: Script = { lua: LIST_BEAT_LUA, mirror: listBeatMirror };

/** Scripts by source, for MemoryStore's EVAL. */
export const SCRIPTS = new Map([JOIN, REMOVE, LIST_BEAT].map((s) => [s.lua, s]));

export function evalCmd(s: Script, keys: string[], args: (string | number)[]): Cmd {
  return ['EVAL', s.lua, keys.length, ...keys, ...args.map(String)];
}
