import type { Cmd } from './store';

/**
 * The two places where presence must read and write as one step, as Lua scripts, which Redis runs atomically
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
 * Remove one session of a peer. KEYS: member set, liveness key, mailbox. ARGV: peer, 'stamp' or 'order', value.
 * - 'stamp' (a session leaving): unless a newer session of the peer wrote the entry, whatever order the store holds.
 * - 'order' (a report that a peer failed, or a client that sends no stamp): only that exact session.
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
return 1
`;

function removeMirror(call: Call, [m, alive, box]: string[], [peer, mode, value]: string[]): unknown {
  const ok =
    mode === 'stamp'
      ? ((mark) => mark !== null && Number(mark) <= Number(value))(call(['GET', alive]) as string | null)
      : ((score) => score !== null && Number(score) === Number(value))(call(['ZSCORE', m, peer]) as string | null);
  if (!ok) return 0;
  call(['ZREM', m, peer]);
  call(['DEL', alive, box]);
  return 1;
}

export const JOIN: Script = { lua: JOIN_LUA, mirror: joinMirror };
export const REMOVE: Script = { lua: REMOVE_LUA, mirror: removeMirror };

/** Scripts by source, for MemoryStore's EVAL. */
export const SCRIPTS = new Map([JOIN, REMOVE].map((s) => [s.lua, s]));

export function evalCmd(s: Script, keys: string[], args: (string | number)[]): Cmd {
  return ['EVAL', s.lua, keys.length, ...keys, ...args.map(String)];
}
