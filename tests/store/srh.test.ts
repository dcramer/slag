import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { handleOp } from '../../app/api/net/_server/handlers';
import { type Cmd, MemoryStore, storeFromEnv, upstashStore } from '../../app/api/net/_server/store';
import { DEFAULT_ICE, MAX_MAILBOX, MAX_PEERS, MAILBOX_TTL_S, PEER_TTL_S, ROOM_TTL_S } from '../../src/net/signal-protocol';

/**
 * The production store code against a real Redis behind SRH, Upstash's REST
 * API locally. Run with `pnpm test:store`, which starts the containers.
 */
const url = process.env.SRH_URL ?? 'http://127.0.0.1:8079';
const token = process.env.SRH_TOKEN ?? 'slag_local_token';
const store = upstashStore(url, token);
const ctx = { store, ice: DEFAULT_ICE };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A fresh room per test: the Redis outlives the run, and keys only go by TTL. */
const room = () => `S${randomBytes(4).toString('hex').toUpperCase()}`;
const keys = async (r: string) => (await store.run([['KEYS', `slag:${r}:*`]]))[0] as string[];

describe('dev store and production store agree', () => {
  /** Every command the handlers issue, with every reply shape they depend on. */
  const script = (k: string): Cmd[] => [
    ['SET', `${k}:s`, 1, 'EX', 60],
    ['EXPIRE', `${k}:s`, 30],
    ['EXPIRE', `${k}:missing`, 30],
    ['EXISTS', `${k}:s`],
    ['EXISTS', `${k}:missing`],
    ['MGET', `${k}:s`, `${k}:missing`],
    ['INCR', `${k}:n`],
    ['INCR', `${k}:n`],
    ['ZADD', `${k}:z`, 2, 'b'],
    ['ZADD', `${k}:z`, 1, 'a'],
    ['ZADD', `${k}:z`, 3, 'a'],
    ['ZRANGE', `${k}:z`, 0, -1, 'WITHSCORES'],
    ['ZRANGE', `${k}:z`, 0, 0],
    ['ZRANGE', `${k}:missing`, 0, -1, 'WITHSCORES'],
    ['ZRANGE', `${k}:missing`, 0, 0],
    ['ZSCORE', `${k}:z`, 'a'],
    ['ZSCORE', `${k}:z`, 'nope'],
    ['ZREM', `${k}:z`, 'a', 'nope'],
    ['ZREM', `${k}:missing`, 'a'],
    ['RPUSH', `${k}:l`, '{"a":1}'],
    ['RPUSH', `${k}:l`, 'two'],
    ['RPUSH', `${k}:l`, 'three'],
    ['LTRIM', `${k}:l`, -2, -1],
    ['LPOP', `${k}:l`, 16],
    ['LPOP', `${k}:l`, 16],
    ['DEL', `${k}:s`],
    ['DEL', `${k}:missing`],
  ];

  it('replies identically, command by command', async () => {
    const real = await store.run(script(`slag:parity:${room()}`));
    const memory = await new MemoryStore().run(script('x'));
    const named = script('x').map((c) => c[0]);
    expect(real.map((r, i) => [named[i], r])).toEqual(memory.map((r, i) => [named[i], r]));
  });
});

describe('upstash REST', () => {
  it('reaches the store through the production env vars, in either naming', async () => {
    for (const env of [
      { NODE_ENV: 'production', KV_REST_API_URL: url, KV_REST_API_TOKEN: token },
      { NODE_ENV: 'production', UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token },
    ]) {
      expect(await storeFromEnv(env)!.run([['EXISTS', 'slag:none']])).toEqual([0]);
    }
  });

  it('fails without leaking the token', async () => {
    await expect(upstashStore(url, 'wrong-secret').run([['EXISTS', 'x']])).rejects.toThrow(/^store responded 401$/);
    await expect(store.run([['NOSUCHCOMMAND', 'x']])).rejects.toThrow(/store/);
  });
});

describe('expiry', () => {
  it('really expires keys', async () => {
    const k = `slag:ttl:${room()}`;
    await store.run([['SET', k, 1, 'EX', 1]]);
    expect(await store.run([['EXISTS', k]])).toEqual([1]);
    await wait(1200);
    expect(await store.run([['EXISTS', k]])).toEqual([0]);
  });

  it('drops a peer whose heartbeat lapses, and a beat says so', async () => {
    const r = room();
    await handleOp('join', { room: r, peer: 'aaaa' }, ctx);
    await handleOp('join', { room: r, peer: 'bbbb' }, ctx);
    await store.run([['EXPIRE', `slag:${r}:p:bbbb`, 1]]);
    await wait(1200);
    expect(await handleOp('beat', { room: r, peer: 'bbbb' }, ctx)).toEqual({ alive: false });
    const { members } = (await handleOp('members', { room: r, peer: 'aaaa' }, ctx)) as { members: { id: string }[] };
    expect(members.map((m) => m.id)).toEqual(['aaaa']);
  });

  it('expires an unread mailbox', async () => {
    const r = room();
    await handleOp('join', { room: r, peer: 'aaaa' }, ctx);
    await handleOp('join', { room: r, peer: 'bbbb' }, ctx);
    await handleOp('signal', { room: r, peer: 'aaaa', to: 'bbbb', signal: { k: 'answer', c: 'a', sdp: 'x' } }, ctx);
    await store.run([['EXPIRE', `slag:${r}:b:bbbb`, 1]]);
    await wait(1200);
    expect(await handleOp('poll', { room: r, peer: 'bbbb' }, ctx)).toEqual({ mail: [] });
  });

  it('leaves no key without a TTL, at the TTLs it promises', async () => {
    const r = room();
    await handleOp('join', { room: r, peer: 'aaaa' }, ctx);
    await handleOp('join', { room: r, peer: 'bbbb' }, ctx);
    await handleOp('signal', { room: r, peer: 'aaaa', to: 'bbbb', signal: { k: 'answer', c: 'a', sdp: 'x' } }, ctx);
    await handleOp('beat', { room: r, peer: 'aaaa', host: true }, ctx);
    const all = await keys(r);
    expect(all.toSorted()).toEqual([`slag:${r}:b:bbbb`, `slag:${r}:m`, `slag:${r}:n`, `slag:${r}:p:aaaa`, `slag:${r}:p:bbbb`].toSorted());
    const ttls = await store.run(all.map((k) => ['TTL', k]));
    const ttl = (k: string) => ttls[all.indexOf(k)] as number;
    expect(ttl(`slag:${r}:m`)).toBeGreaterThan(ROOM_TTL_S - 10);
    expect(ttl(`slag:${r}:n`)).toBeGreaterThan(ROOM_TTL_S - 10);
    expect(ttl(`slag:${r}:p:aaaa`)).toBeGreaterThan(PEER_TTL_S - 10);
    expect(ttl(`slag:${r}:b:bbbb`)).toBeGreaterThan(MAILBOX_TTL_S - 10);
    expect(ttls.every((t) => (t as number) > 0)).toBe(true);
  });
});

describe('join order', () => {
  it('stays unique and total under a stampede, with INCR the only coordination', async () => {
    const r = room();
    const peers = Array.from({ length: MAX_PEERS }, (_, i) => `peer${i}`);
    const replies = (await Promise.all(peers.map((peer) => handleOp('join', { room: r, peer }, ctx)))) as { order: number }[];
    const orders = replies.map((x) => x.order);
    expect(new Set(orders).size).toBe(peers.length);
    const { members } = (await handleOp('members', { room: r, peer: 'peer0' }, ctx)) as { members: { id: string; order: number }[] };
    expect(members).toHaveLength(peers.length);
    const sorted = members.map((m) => m.order);
    expect(sorted).toEqual(sorted.toSorted((a, b) => a - b));
  });

  it('never lets a rejoin win back the host seat', async () => {
    const r = room();
    await handleOp('join', { room: r, peer: 'aaaa' }, ctx);
    await handleOp('join', { room: r, peer: 'bbbb' }, ctx);
    const again = (await handleOp('join', { room: r, peer: 'aaaa' }, ctx)) as { members: { id: string }[] };
    expect(again.members.map((m) => m.id)).toEqual(['bbbb', 'aaaa']);
  });
});

describe('every op, end to end', () => {
  it('walks a handshake, a report and a leave', async () => {
    const r = room();
    const a = (await handleOp('join', { room: r, peer: 'aaaa' }, ctx)) as { order: number };
    const b = (await handleOp('join', { room: r, peer: 'bbbb' }, ctx)) as { order: number; ice: unknown[] };
    expect(b.ice).toEqual(DEFAULT_ICE);
    expect(await handleOp('beat', { room: r, peer: 'bbbb' }, ctx)).toEqual({ alive: true });
    expect(await handleOp('beat', { room: r, peer: 'bbbb', host: true }, ctx)).toEqual({ alive: true, head: 'aaaa' });

    const offer = { k: 'offer', c: 'abc', o: b.order, sdp: 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n"quotes" and ünicode' };
    expect(await handleOp('signal', { room: r, peer: 'bbbb', to: 'aaaa', signal: offer }, ctx)).toEqual({ delivered: true });
    expect(await handleOp('signal', { room: r, peer: 'bbbb', to: 'nobody', signal: offer }, ctx)).toEqual({ delivered: false });
    expect(await handleOp('poll', { room: r, peer: 'aaaa' }, ctx)).toEqual({ mail: [{ from: 'bbbb', s: offer }] });
    expect(await handleOp('poll', { room: r, peer: 'aaaa' }, ctx)).toEqual({ mail: [] });

    await handleOp('gone', { room: r, peer: 'bbbb', gone: 'aaaa', order: a.order + 99 }, ctx);
    let list = (await handleOp('members', { room: r, peer: 'bbbb' }, ctx)) as { members: { id: string }[] };
    expect(list.members.map((m) => m.id)).toEqual(['aaaa', 'bbbb']);
    await handleOp('gone', { room: r, peer: 'bbbb', gone: 'aaaa', order: a.order }, ctx);
    list = (await handleOp('members', { room: r, peer: 'bbbb' }, ctx)) as { members: { id: string }[] };
    expect(list.members.map((m) => m.id)).toEqual(['bbbb']);

    await handleOp('leave', { room: r, peer: 'bbbb', order: b.order }, ctx);
    expect((await keys(r)).filter((k) => k.includes(':p:') || k.endsWith(':m'))).toEqual([]);
  });

  it('caps a room and a mailbox', async () => {
    const r = room();
    for (let i = 0; i < MAX_PEERS; i++) await handleOp('join', { room: r, peer: `peer${i}` }, ctx);
    await expect(handleOp('join', { room: r, peer: 'late' + '1' }, ctx)).rejects.toMatchObject({ code: 'full' });
    for (let i = 0; i < MAX_MAILBOX + 4; i++)
      await handleOp('signal', { room: r, peer: 'peer1', to: 'peer0', signal: { k: 'answer', c: `c${i}`, sdp: 'x' } }, ctx);
    const { mail } = (await handleOp('poll', { room: r, peer: 'peer0' }, ctx)) as { mail: { s: { c: string } }[] };
    expect(mail).toHaveLength(MAX_MAILBOX);
    expect(mail.at(-1)!.s.c).toBe(`c${MAX_MAILBOX + 3}`);
  });
});
