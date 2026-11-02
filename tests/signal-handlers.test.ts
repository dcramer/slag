import { describe, expect, it } from 'vitest';
import { POST } from '../app/api/net/[op]/route';
import { clientKey, iceFromEnv, originAllowed, RateLimiter } from '../app/api/net/_server/guard';
import { ApiError, handleOp } from '../app/api/net/_server/handlers';
import { MemoryStore, storeFromEnv, upstashStore } from '../app/api/net/_server/store';
import { DEFAULT_ICE, MAX_MAILBOX, MAX_PEERS, MAX_SDP_CHARS, PEER_TTL_S } from '../src/net/signal-protocol';
import { MAX_PLAYERS } from '../src/sim/constants';

function world() {
  let t = 1_000_000;
  const store = new MemoryStore(() => t);
  const ctx = { store, ice: DEFAULT_ICE };
  return {
    store,
    tick: (s: number) => (t += s * 1000),
    op: (op: Parameters<typeof handleOp>[0], body: Record<string, unknown>) => handleOp(op, { room: 'ROOM1', ...body }, ctx) as Promise<any>,
  };
}

const offer = { k: 'offer', c: 'abc', o: 1, sdp: 'v=0' };

describe('memory store', () => {
  it('expires keys and matches the reply shapes of the REST API', async () => {
    let t = 0;
    const s = new MemoryStore(() => t);
    const [ok, ttl, gone] = await s.run([
      ['SET', 'a', 1, 'EX', 5],
      ['EXPIRE', 'a', 2],
      ['EXPIRE', 'missing', 2],
    ]);
    expect([ok, ttl, gone]).toEqual(['OK', 1, 0]);
    t = 3000;
    expect(await s.run([['EXISTS', 'a']])).toEqual([0]);
    await s.run([
      ['ZADD', 'z', 2, 'b'],
      ['ZADD', 'z', 1, 'a'],
    ]);
    expect(await s.run([['ZRANGE', 'z', 0, -1, 'WITHSCORES']])).toEqual([['a', '1', 'b', '2']]);
    expect(await s.run([['ZRANGE', 'z', 0, 0]])).toEqual([['a']]);
    expect(
      await s.run([
        ['ZSCORE', 'z', 'a'],
        ['ZSCORE', 'z', 'nope'],
      ]),
    ).toEqual(['1', null]);
    expect(
      await s.run([
        ['RPUSH', 'l', 'a'],
        ['RPUSH', 'l', 'b'],
        ['RPUSH', 'l', 'c'],
        ['LTRIM', 'l', -2, -1],
        ['LPOP', 'l', 5],
        ['LPOP', 'l', 5],
      ]),
    ).toEqual([1, 2, 3, 'OK', ['b', 'c'], null]);
    expect(
      await s.run([
        ['INCR', 'n'],
        ['INCR', 'n'],
      ]),
    ).toEqual([1, 2]);
    expect(
      await s.run([
        ['SET', 'x', 1],
        ['SET', 'y', 2],
        ['MGET', 'x', 'nope', 'y'],
      ]),
    ).toEqual(['OK', 'OK', ['1', null, '2']]);
  });
});

describe('upstash store', () => {
  it('pipelines commands with the bearer token and unwraps results', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify([{ result: 'OK' }, { result: 7 }]));
    }) as unknown as typeof fetch;
    const s = upstashStore('https://x.upstash.io/', 'tok', fake);
    expect(
      await s.run([
        ['SET', 'a', 1],
        ['INCR', 'n'],
      ]),
    ).toEqual(['OK', 7]);
    expect(calls[0].url).toBe('https://x.upstash.io/pipeline');
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(calls[0].init.body as string)).toEqual([
      ['SET', 'a', 1],
      ['INCR', 'n'],
    ]);
  });

  it('turns store failures into errors that never carry the token', async () => {
    const down = (async () => new Response('nope', { status: 401 })) as unknown as typeof fetch;
    await expect(upstashStore('https://x', 'secret-token', down).run([['INCR', 'n']])).rejects.toThrow(/^store responded 401$/);
    const bad = (async () => new Response(JSON.stringify([{ error: 'ERR max requests limit exceeded' }]))) as unknown as typeof fetch;
    await expect(upstashStore('https://x', 'secret-token', bad).run([['INCR', 'n']])).rejects.toThrow('store rejected a command');
  });
});

describe('storeFromEnv', () => {
  const kv = { KV_REST_API_URL: 'https://kv', KV_REST_API_TOKEN: 't' };
  const up = { UPSTASH_REDIS_REST_URL: 'https://up', UPSTASH_REDIS_REST_TOKEN: 't' };
  async function urlUsed(env: Record<string, string>) {
    let used = '';
    const fake = (async (url: string) => {
      used = url;
      return new Response('[]');
    }) as unknown as typeof fetch;
    await storeFromEnv(env, fake)!.run([]);
    return used;
  }

  it('accepts either credential pair the Marketplace injects', async () => {
    expect(await urlUsed({ ...kv, NODE_ENV: 'production' })).toBe('https://kv/pipeline');
    expect(await urlUsed({ ...up, NODE_ENV: 'production' })).toBe('https://up/pipeline');
  });

  it('has no store in production without a complete pair, and memory everywhere else', () => {
    expect(storeFromEnv({ NODE_ENV: 'production' })).toBeNull();
    expect(storeFromEnv({ NODE_ENV: 'production', KV_REST_API_URL: 'https://kv' })).toBeNull();
    expect(storeFromEnv({ NODE_ENV: 'development' })).toBeInstanceOf(MemoryStore);
    expect(storeFromEnv({ NODE_ENV: 'production', SLAG_SIGNAL_STORE: 'memory' })).toBeInstanceOf(MemoryStore);
  });
});

describe('presence', () => {
  it('orders joins by an atomic counter, also when they race', async () => {
    const w = world();
    const replies = await Promise.all(['aaaa', 'bbbb', 'cccc', 'dddd'].map((peer) => w.op('join', { peer })));
    expect(new Set(replies.map((r) => r.order)).size).toBe(4);
    const { members } = await w.op('members', { peer: 'aaaa' });
    const orders: number[] = members.map((m: any) => m.order);
    expect(orders).toEqual(orders.slice().sort((a, b) => a - b));
  });

  it('never lets a rejoin win back the lowest order, even after it was written off', async () => {
    const w = world();
    await w.op('join', { peer: 'aaaa' });
    const b = await w.op('join', { peer: 'bbbb' });
    await w.store.run([['ZREM', 'slag:ROOM1:m', 'aaaa']]);
    const a2 = await w.op('join', { peer: 'aaaa' });
    expect(a2.order).toBeGreaterThan(b.order);
    expect(a2.members.map((m: any) => m.id)).toEqual(['bbbb', 'aaaa']);
  });

  it('forgets peers whose heartbeat lapsed; a beat keeps them', async () => {
    const w = world();
    await w.op('join', { peer: 'aaaa' });
    await w.op('join', { peer: 'bbbb' });
    w.tick(PEER_TTL_S - 5);
    expect((await w.op('beat', { peer: 'aaaa' })).alive).toBe(true);
    w.tick(10);
    expect((await w.op('beat', { peer: 'bbbb' })).alive).toBe(false);
    expect((await w.op('members', { peer: 'aaaa' })).members.map((m: any) => m.id)).toEqual(['aaaa']);
  });

  it('caps a room at MAX_PEERS, with room for a full lobby plus spectators', async () => {
    expect(MAX_PEERS).toBeGreaterThanOrEqual(MAX_PLAYERS);
    const w = world();
    for (let i = 0; i < MAX_PEERS; i++) await w.op('join', { peer: `peer${i}` });
    await expect(w.op('join', { peer: 'late1' })).rejects.toMatchObject({ code: 'full' });
    await w.op('join', { peer: 'peer0' }); // a member refreshing still fits
  });

  it('gives every key a TTL, whatever ran', async () => {
    const w = world();
    await w.op('join', { peer: 'aaaa' });
    await w.op('join', { peer: 'bbbb' });
    await w.op('signal', { peer: 'aaaa', to: 'bbbb', signal: offer });
    await w.op('beat', { peer: 'aaaa', host: true });
    expect(w.store.immortalKeys()).toEqual([]);
    w.tick(3600);
    expect(w.store.immortalKeys()).toEqual([]);
    expect(await w.store.run([['EXISTS', 'slag:ROOM1:m']])).toEqual([0]);
  });

  it('removes a peer on leave or report only for the session named', async () => {
    const w = world();
    const a = await w.op('join', { peer: 'aaaa' });
    await w.op('join', { peer: 'bbbb' });
    await w.op('join', { peer: 'cccc' });
    // A stale report about a session that has since refreshed changes nothing.
    await w.op('join', { peer: 'aaaa' });
    await w.op('gone', { peer: 'bbbb', gone: 'aaaa', order: a.order });
    expect((await w.op('members', { peer: 'bbbb' })).members.map((m: any) => m.id)).toContain('aaaa');
    const fresh = (await w.op('members', { peer: 'bbbb' })).members.find((m: any) => m.id === 'aaaa');
    const after = await w.op('gone', { peer: 'bbbb', gone: 'aaaa', order: fresh.order });
    expect(after.members.map((m: any) => m.id)).toEqual(['bbbb', 'cccc']);
    // Non-members can't report anyone.
    await w.op('gone', { peer: 'xxxx', gone: 'bbbb', order: 2 });
    expect((await w.op('members', { peer: 'bbbb' })).members.map((m: any) => m.id)).toEqual(['bbbb', 'cccc']);
  });

  it('lets the newest session of a peer own its entry, whichever join lands last', async () => {
    const w = world();
    const ids = async () => (await w.op('members', { peer: 'bbbb' })).members.map((m: any) => `${m.id}#${m.order}`);
    await w.op('join', { peer: 'bbbb' });
    // The lobby remounted: the new session's join lands first, the old one's (closed meanwhile) after it.
    const fresh = await w.op('join', { peer: 'aaaa', since: 200 });
    const late = await w.op('join', { peer: 'aaaa', since: 100 });
    expect(late.order).toBe(fresh.order);
    expect(await ids()).toEqual(['bbbb#1', `aaaa#${fresh.order}`]);
    // The old session takes back the seat it got: the newer session's entry stays.
    await w.op('leave', { peer: 'aaaa', order: late.order, since: 100 });
    expect(await ids()).toEqual(['bbbb#1', `aaaa#${fresh.order}`]);
    await w.op('leave', { peer: 'aaaa', order: fresh.order, since: 200 });
    expect(await ids()).toEqual(['bbbb#1']);
  });

  it("matches a session's leave on its stamp, not its order, and never a refreshed page's late one", async () => {
    const w = world();
    const ids = async () => (await w.op('members', { peer: 'bbbb' })).members.map((m: any) => m.id);
    await w.op('join', { peer: 'bbbb' });
    const live = await w.op('join', { peer: 'aaaa', since: 200 });
    // An entry holding an older session's stamp under another order (as a join from before the scripts could leave).
    await w.store.run([
      ['ZADD', 'slag:ROOM1:m', live.order + 5, 'aaaa'],
      ['SET', 'slag:ROOM1:p:aaaa', 100, 'EX', PEER_TTL_S],
    ]);
    await w.op('leave', { peer: 'aaaa', order: live.order, since: 200 });
    expect(await ids()).toEqual(['bbbb']);
    // A refresh: the old page's goodbye arrives after the new page joined, and must not remove it.
    const old = await w.op('join', { peer: 'aaaa', since: 300 });
    const next = await w.op('join', { peer: 'aaaa', since: 400 });
    await w.op('leave', { peer: 'aaaa', order: old.order, since: 300 });
    expect(await ids()).toEqual(['bbbb', 'aaaa']);
    await w.op('leave', { peer: 'aaaa', order: next.order, since: 400 });
    expect(await ids()).toEqual(['bbbb']);
  });

  it('tells a host the lowest order, which is how rival hosts find out', async () => {
    const w = world();
    await w.op('join', { peer: 'aaaa' });
    await w.op('join', { peer: 'bbbb' });
    expect((await w.op('beat', { peer: 'bbbb', host: true })).head).toBe('aaaa');
  });
});

describe('mailboxes', () => {
  it('delivers in order, once, and only between members', async () => {
    const w = world();
    await w.op('join', { peer: 'aaaa' });
    await w.op('join', { peer: 'bbbb' });
    expect((await w.op('signal', { peer: 'aaaa', to: 'bbbb', signal: offer })).delivered).toBe(true);
    expect((await w.op('signal', { peer: 'aaaa', to: 'bbbb', signal: { k: 'answer', c: 'def', sdp: 'x' } })).delivered).toBe(true);
    expect((await w.op('poll', { peer: 'bbbb' })).mail.map((m: any) => m.s.c)).toEqual(['abc', 'def']);
    expect((await w.op('poll', { peer: 'bbbb' })).mail).toEqual([]);
    expect((await w.op('signal', { peer: 'aaaa', to: 'cccc', signal: offer })).delivered).toBe(false);
    expect((await w.op('signal', { peer: 'zzzz', to: 'bbbb', signal: offer })).delivered).toBe(false);
  });

  it('bounds a mailbox and expires what nobody read', async () => {
    const w = world();
    await w.op('join', { peer: 'aaaa' });
    await w.op('join', { peer: 'bbbb' });
    for (let i = 0; i < MAX_MAILBOX + 10; i++) await w.op('signal', { peer: 'aaaa', to: 'bbbb', signal: { ...offer, c: `c${i}` } });
    const { mail } = await w.op('poll', { peer: 'bbbb' });
    expect(mail).toHaveLength(MAX_MAILBOX);
    expect(mail.at(-1).s.c).toBe(`c${MAX_MAILBOX + 9}`);
    await w.op('signal', { peer: 'aaaa', to: 'bbbb', signal: offer });
    w.tick(31);
    expect((await w.op('poll', { peer: 'bbbb' })).mail).toEqual([]);
  });

  it('rejects junk before it reaches the store', async () => {
    const w = world();
    await w.op('join', { peer: 'aaaa' });
    const before = w.store.count;
    for (const body of [
      { room: 'no spaces', peer: 'aaaa' },
      { room: 'lower', peer: 'aaaa' },
      { room: 'ROOM1', peer: 'a' },
      { room: 'ROOM1', peer: '../etc/passwd' },
      { room: 7, peer: 'aaaa' },
    ]) {
      await expect(w.op('poll', body)).rejects.toBeInstanceOf(ApiError);
    }
    await expect(w.op('signal', { peer: 'aaaa', to: 'bbbb', signal: { k: 'offer', c: 'a', o: 1, sdp: 'x'.repeat(MAX_SDP_CHARS + 1) } })).rejects.toBeInstanceOf(
      ApiError,
    );
    await expect(w.op('signal', { peer: 'aaaa', to: 'bbbb', signal: { k: 'nonsense', c: 'a' } })).rejects.toBeInstanceOf(ApiError);
    await expect(w.op('signal', { peer: 'aaaa', to: 'bbbb', signal: 'hi' })).rejects.toBeInstanceOf(ApiError);
    await expect(w.op('leave', { peer: 'aaaa' })).rejects.toBeInstanceOf(ApiError);
    expect(w.store.count).toBe(before);
  });
});

/** The budget in docs/NETCODE.md. If this moves, update the doc. */
describe('command costs', () => {
  it('stays at the documented cost per op', async () => {
    const w = world();
    const cost = async (fn: () => Promise<unknown>) => {
      const before = w.store.count;
      await fn();
      return w.store.count - before;
    };
    // A script costs one command plus one per call it makes, as Upstash bills it (MemoryStore counts the same way).
    expect(await cost(() => w.op('join', { peer: 'aaaa', since: 10 }))).toBe(5); // empty room
    expect(await cost(() => w.op('join', { peer: 'bbbb', since: 10 }))).toBe(6);
    expect(await cost(() => w.op('join', { peer: 'bbbb', since: 5 }))).toBe(3); // an older session of bbbb: writes nothing
    expect(await cost(() => w.op('poll', { peer: 'aaaa' }))).toBe(1);
    expect(await cost(() => w.op('beat', { peer: 'bbbb' }))).toBe(1);
    expect(await cost(() => w.op('beat', { peer: 'aaaa', host: true }))).toBe(3);
    expect(await cost(() => w.op('signal', { peer: 'aaaa', to: 'bbbb', signal: offer }))).toBe(5);
    expect(await cost(() => w.op('members', { peer: 'aaaa' }))).toBe(2);
    expect(await cost(() => w.op('leave', { peer: 'bbbb', order: 2, since: 5 }))).toBe(2); // refused: a newer session holds it
    expect(await cost(() => w.op('leave', { peer: 'bbbb', order: 2, since: 10 }))).toBe(4);
    await w.op('join', { peer: 'cccc' });
    expect(await cost(() => w.op('gone', { peer: 'aaaa', gone: 'cccc', order: 99 }))).toBe(5); // wrong session: nothing removed
    expect(await cost(() => w.op('gone', { peer: 'aaaa', gone: 'cccc', order: 3 }))).toBe(7);
    expect(await cost(() => w.op('leave', { peer: 'aaaa', order: 1 }))).toBe(4); // a client that sends no stamp
  });
});

describe('http edge', () => {
  const post = (op: string, body: string, headers: Record<string, string> = {}) =>
    POST(new Request(`http://localhost/api/net/${op}`, { method: 'POST', body, headers }), { params: Promise.resolve({ op }) });

  it('runs an op end to end from a text/plain body', async () => {
    const r = await post('join', JSON.stringify({ room: 'HTTPA', peer: 'aaaa' }), { 'content-type': 'text/plain' });
    expect(r.status).toBe(200);
    expect((await r.json()).members[0].id).toBe('aaaa');
  });

  it('answers bad requests without crashing', async () => {
    expect((await post('nope', '{}')).status).toBe(404);
    expect((await post('join', 'not json')).status).toBe(400);
    expect((await post('join', '{"room":"bad room"}')).status).toBe(400);
    expect((await post('join', JSON.stringify({ room: 'HTTPA', peer: 'aaaa', x: 'y'.repeat(30_000) }))).status).toBe(413);
    expect((await post('join', '{}', { origin: 'https://evil.example', host: 'slag.example' })).status).toBe(403);
  });

  it('says unconfigured, not 500, when production has no store', async () => {
    const env = process.env as Record<string, string | undefined>;
    const keep = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      const r = await post('join', JSON.stringify({ room: 'HTTPA', peer: 'aaaa' }));
      expect(r.status).toBe(503);
      expect(await r.json()).toEqual({ error: 'unconfigured' });
    } finally {
      env.NODE_ENV = keep;
    }
  });
});

describe('guards', () => {
  it('accepts same-origin and originless requests, and leaves room for an allowlist later', () => {
    const h = (o: Record<string, string>) => new Headers(o);
    expect(originAllowed(h({}))).toBe(true);
    expect(originAllowed(h({ origin: 'https://slag.example', host: 'slag.example' }))).toBe(true);
    expect(originAllowed(h({ origin: 'https://slag.example', host: 'internal', 'x-forwarded-host': 'slag.example' }))).toBe(true);
    expect(originAllowed(h({ origin: 'https://evil.example', host: 'slag.example' }))).toBe(false);
    expect(originAllowed(h({ origin: 'null', host: 'slag.example' }))).toBe(false);
  });

  it('limits per client within a window', () => {
    let t = 100_000;
    const l = new RateLimiter(() => t, 3);
    expect([l.allow('a'), l.allow('a'), l.allow('a'), l.allow('a'), l.allow('b')]).toEqual([true, true, true, false, true]);
    t += 60_001;
    expect(l.allow('a')).toBe(true);
    expect(clientKey(new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
  });

  it('adds TURN from the env and survives a malformed value', () => {
    expect(iceFromEnv(undefined)).toEqual(DEFAULT_ICE);
    expect(iceFromEnv('[{"urls":"turn:t.example","username":"u","credential":"c"}]')).toHaveLength(DEFAULT_ICE.length + 1);
    expect(iceFromEnv('not json')).toEqual(DEFAULT_ICE);
    expect(iceFromEnv('{"urls":"turn:x"}')).toEqual(DEFAULT_ICE);
  });
});
