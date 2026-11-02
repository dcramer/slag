import { DEFAULT_ICE, type IceServer } from '../../../../src/net/signal-protocol';

/**
 * Request gates in front of the handlers: cheap checks that run before any
 * Redis command, so junk traffic costs a function invocation at most.
 */

/**
 * Same-origin browsers only. Bodies are text/plain (so a non-same-origin
 * client would need no preflight) which also means a hostile page could POST
 * here cross-site; this is what stops that. Requests without an Origin header
 * pass: only non-browser clients omit it on a POST, and they can forge it.
 * docs/NETCODE.md says what opening this up for a packaged client takes.
 */
export function originAllowed(headers: Headers): boolean {
  const origin = headers.get('origin');
  if (!origin) return true;
  let host: string;
  try {
    host = new URL(origin).host;
  } catch {
    return false;
  }
  return host === headers.get('host') || host === headers.get('x-forwarded-host');
}

const WINDOW_MS = 60_000;
/** Far above what a NAT full of players needs (about 30 requests a minute each while connecting). */
const MAX_PER_WINDOW = 600;
const MAX_TRACKED = 5_000;

/**
 * Fixed-window limit per client, per function instance. Best effort: it blunts
 * a loop or a script without spending Redis commands on counting. Real
 * protection against a determined caller is the Vercel Firewall, and the free
 * tier's hard cap means the worst outcome is online play stopping, not a bill.
 */
export class RateLimiter {
  private hits = new Map<string, number>();
  private start = 0;

  constructor(
    private now: () => number = Date.now,
    private max = MAX_PER_WINDOW,
  ) {}

  allow(client: string): boolean {
    const t = this.now();
    if (t - this.start >= WINDOW_MS || this.hits.size >= MAX_TRACKED) {
      this.start = t;
      this.hits.clear();
    }
    const n = (this.hits.get(client) ?? 0) + 1;
    this.hits.set(client, n);
    return n <= this.max;
  }
}

export function clientKey(headers: Headers): string {
  return headers.get('x-real-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

/** STUN, plus TURN from `SLAG_ICE_SERVERS` (a JSON array of RTCIceServer) when set. A malformed value is ignored, not fatal. */
export function iceFromEnv(raw: string | undefined): IceServer[] {
  if (!raw) return DEFAULT_ICE;
  try {
    const parsed = JSON.parse(raw) as IceServer[];
    if (Array.isArray(parsed) && parsed.every((s) => typeof s?.urls === 'string' || Array.isArray(s?.urls))) return [...DEFAULT_ICE, ...parsed];
  } catch {
    // fall through
  }
  console.warn('SLAG_ICE_SERVERS is not a JSON array of ICE servers; using STUN only');
  return DEFAULT_ICE;
}
