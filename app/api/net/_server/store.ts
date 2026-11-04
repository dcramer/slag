/**
 * The signaling API's only state: a sliver of Redis. Handlers speak plain Redis
 * commands, so production (Upstash REST) and dev (in memory) run the same code
 * and tests exercise what ships.
 *
 * Every command is billed, so handlers batch into a single `run` and the set
 * of commands stays small. No client library: this is one `fetch`.
 */
import { SCRIPTS } from './scripts';

export type Cmd = (string | number)[];

/** The store answered, but not with results: `status` is its HTTP status, absent when it rejected a command. */
export class StoreError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export interface Store {
  /** Run commands in order (not atomically) and return one result per command. Throws if the store can't be reached. */
  run(cmds: Cmd[]): Promise<unknown[]>;
}

/** Credentials as injected by the Vercel Marketplace; which pair depends on how the integration was set up. */
const ENV_PAIRS = [
  ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
  ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
] as const;

export function upstashStore(url: string, token: string, fetcher: typeof fetch = fetch): Store {
  return {
    async run(cmds) {
      const res = await fetcher(`${url.replace(/\/+$/, '')}/pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(cmds),
        cache: 'no-store',
      });
      // The token is in the request, never in this message.
      if (!res.ok) throw new StoreError(`store responded ${res.status}`, res.status);
      const out = (await res.json()) as { result?: unknown; error?: string }[];
      return out.map((r) => {
        if (r.error) throw new StoreError('store rejected a command');
        return r.result;
      });
    },
  };
}

interface Entry {
  v: string | string[] | Map<string, number>;
  /** ms epoch; undefined = no TTL. */
  until?: number;
}

/**
 * The subset of Redis the handlers use, replying in the shape Upstash's REST
 * API does (strings for scores, null for missing). A single process only:
 * fine for `next dev`, useless across serverless instances.
 */
export class MemoryStore implements Store {
  private keys = new Map<string, Entry>();
  /** Commands run, for budget tests. */
  count = 0;

  constructor(private now: () => number = Date.now) {}

  private live(key: string): Entry | undefined {
    const e = this.keys.get(key);
    if (e?.until !== undefined && e.until <= this.now()) {
      this.keys.delete(key);
      return undefined;
    }
    return e;
  }

  /** Every key currently without a TTL (must always be empty after a handler ran). */
  immortalKeys(): string[] {
    return [...this.keys.keys()].filter((k) => this.live(k) && this.live(k)!.until === undefined);
  }

  async run(cmds: Cmd[]): Promise<unknown[]> {
    return cmds.map((c) => this.exec(c));
  }

  /** Runs a script's TypeScript mirror (see scripts.ts): one command for the EVAL, then one per call it makes, as Upstash bills it. */
  private evalScript([, lua, numKeys, ...rest]: Cmd): unknown {
    const script = SCRIPTS.get(String(lua));
    if (!script) throw new Error('MemoryStore: unknown script. Scripts run here through their mirror: add it to SCRIPTS in scripts.ts.');
    const n = Number(numKeys);
    return script.mirror((c) => this.exec(c), rest.slice(0, n).map(String), rest.slice(n).map(String));
  }

  private exec(cmd: Cmd): unknown {
    this.count++;
    if (String(cmd[0]).toUpperCase() === 'EVAL') return this.evalScript(cmd);
    const [op, key, ...rest] = cmd.map(String);
    const e = this.live(key);
    switch (op.toUpperCase()) {
      case 'SET': {
        const ex = rest.findIndex((x) => x.toUpperCase() === 'EX');
        this.keys.set(key, { v: rest[0], until: ex < 0 ? undefined : this.now() + Number(rest[ex + 1]) * 1000 });
        return 'OK';
      }
      case 'INCR': {
        const n = Number(typeof e?.v === 'string' ? e.v : 0) + 1;
        if (e) e.v = String(n);
        else this.keys.set(key, { v: String(n) });
        return n;
      }
      case 'EXPIRE':
        if (!e) return 0;
        e.until = this.now() + Number(rest[0]) * 1000;
        return 1;
      case 'GETEX': {
        // Only the EX form: read the value and renew its TTL in one command.
        if (!e) return null;
        e.until = this.now() + Number(rest[1]) * 1000;
        return typeof e.v === 'string' ? e.v : null;
      }
      case 'EXISTS':
        return e ? 1 : 0;
      case 'DEL':
        return [key, ...rest].filter((k) => this.live(k) !== undefined && this.keys.delete(k)).length;
      case 'GET':
        return typeof e?.v === 'string' ? e.v : null;
      case 'MGET':
        return [key, ...rest].map((k) => {
          const x = this.live(k);
          return typeof x?.v === 'string' ? x.v : null;
        });
      case 'ZADD': {
        const z = (e?.v as Map<string, number> | undefined) ?? new Map<string, number>();
        let fresh = 0;
        for (let i = 0; i + 1 < rest.length; i += 2) {
          if (!z.has(rest[i + 1])) fresh++;
          z.set(rest[i + 1], Number(rest[i]));
        }
        if (!e) this.keys.set(key, { v: z });
        return fresh;
      }
      case 'ZREM': {
        if (!e) return 0;
        const z = e.v as Map<string, number>;
        const n = rest.filter((m) => z.delete(m)).length;
        if (z.size === 0) this.keys.delete(key);
        return n;
      }
      case 'ZSCORE': {
        const s = (e?.v as Map<string, number> | undefined)?.get(rest[0]);
        return s === undefined ? null : String(s);
      }
      case 'ZRANGE': {
        const z = (e?.v as Map<string, number> | undefined) ?? new Map<string, number>();
        const sorted = [...z.entries()].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
        const stop = Number(rest[1]);
        const window = sorted.slice(Number(rest[0]), stop < 0 ? sorted.length + stop + 1 : stop + 1);
        return rest.includes('WITHSCORES') ? window.flatMap(([m, s]) => [m, String(s)]) : window.map(([m]) => m);
      }
      case 'ZREMRANGEBYSCORE': {
        if (!e) return 0;
        const z = e.v as Map<string, number>;
        const [min, max] = [score(rest[0]), score(rest[1])];
        let n = 0;
        for (const [m, s] of z) if (s >= min && s <= max && z.delete(m)) n++;
        if (z.size === 0) this.keys.delete(key);
        return n;
      }
      case 'ZREVRANGEBYSCORE': {
        // max min [LIMIT offset count], highest score first, ties in reverse member order, as Redis has them.
        const z = (e?.v as Map<string, number> | undefined) ?? new Map<string, number>();
        const [max, min] = [score(rest[0]), score(rest[1])];
        const limit = rest.findIndex((x) => x.toUpperCase() === 'LIMIT');
        const sorted = [...z.entries()].filter(([, s]) => s >= min && s <= max).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1));
        const from = limit < 0 ? 0 : Number(rest[limit + 1]);
        const n = limit < 0 ? sorted.length : Number(rest[limit + 2]);
        return sorted.slice(from, from + n).map(([m]) => m);
      }
      case 'RPUSH': {
        const l = (e?.v as string[] | undefined) ?? [];
        l.push(...rest);
        if (!e) this.keys.set(key, { v: l });
        return l.length;
      }
      case 'LTRIM': {
        if (!e) return 'OK';
        const l = e.v as string[];
        const n = l.length;
        const at = (i: number) => (i < 0 ? n + i : i);
        e.v = l.slice(Math.max(0, at(Number(rest[0]))), at(Number(rest[1])) + 1);
        return 'OK';
      }
      case 'LPOP': {
        if (!e) return null;
        const l = e.v as string[];
        const out = l.splice(0, Number(rest[0]));
        if (l.length === 0) this.keys.delete(key);
        return out;
      }
      default:
        throw new Error(`MemoryStore: unsupported command ${op}`);
    }
  }
}

/** A sorted-set score bound as Redis reads one: a number, or ±inf. */
function score(v: string): number {
  const t = v.toLowerCase();
  if (t === '-inf') return -Infinity;
  if (t === '+inf' || t === 'inf') return Infinity;
  return Number(v);
}

/** Keeps one store across Next's per-route module instances and dev reloads. */
function sharedMemoryStore(): MemoryStore {
  const g = globalThis as { __slagSignalStore?: MemoryStore };
  return (g.__slagSignalStore ??= new MemoryStore());
}

/**
 * The store for this deployment, or null when production has no credentials
 * (the API then answers `unconfigured` and the game stays local).
 * `SLAG_SIGNAL_STORE=memory` forces the in-memory store for `next start` in
 * tests; it must never be set on Vercel, whose instances share no memory.
 */
export function storeFromEnv(env: Record<string, string | undefined>, fetcher: typeof fetch = fetch): Store | null {
  if (env.SLAG_SIGNAL_STORE === 'memory') return sharedMemoryStore();
  for (const [urlKey, tokenKey] of ENV_PAIRS) {
    const url = env[urlKey];
    const token = env[tokenKey];
    if (url && token) return upstashStore(url, token, fetcher);
  }
  return env.NODE_ENV === 'production' ? null : sharedMemoryStore();
}
