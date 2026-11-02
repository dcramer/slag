/**
 * Sentry settings shared by the client and server hosts
 * (`instrumentation-client.ts`, `instrumentation.ts`). Importing this pulls in
 * no SDK code. The game itself never sees any of this: it talks to
 * `src/telemetry.ts`. docs/TELEMETRY.md says what is sent and why.
 */

/** Public by design: a DSN can only submit events, so it is safe to commit. */
const DEFAULT_DSN = 'https://794a2e4b1199bd0053c4349ab7079d53@o172566.ingest.us.sentry.io/4512360042921984';

/** Vercel's `VERCEL_ENV` (production, preview, development), inlined by next.config.ts; `local` anywhere else. */
const environment = process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? 'local';
const deployed = environment === 'production' || environment === 'preview';

export const sentryOptions = {
  /**
   * Empty means Sentry stays off. Only Vercel deploys report by default, so
   * `pnpm dev`, tests and local production builds (`pnpm shot`) stay silent.
   * Setting `NEXT_PUBLIC_SENTRY_DSN` wins either way, and setting it empty
   * turns reporting off on a deploy.
   */
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? (deployed ? DEFAULT_DSN : ''),
  environment,
  /** The commit SHA (next.config.ts), the same name the source maps are uploaded under. */
  release: process.env.NEXT_PUBLIC_SENTRY_RELEASE || undefined,
  // SDK 11 replaced `sendDefaultPii` with this, and its defaults collect a lot,
  // so opt out explicitly. `userInfo: false` also makes ingest skip IP inference
  // and allowlisting headers keeps out Vercel's forwarded-IP and geo headers.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: { request: { allow: ['user-agent'] }, response: false },
    httpBodies: [],
    urlQueryParams: false,
    stackFrameVariables: false,
  },
};

/**
 * Share of server requests traced, by environment. Only the signaling routes
 * are traced at all: they are the server's whole job, and their time is mostly
 * the Redis store's. A 4-player room makes about 33 of them a minute, so even
 * a busy month is a few million requests; 1% of that is tens of thousands of
 * transactions, a small slice of the free plan's span quota. Preview deploys
 * see little traffic and are where a change is checked, so they keep more.
 * Local runs only report with a DSN set by hand, to test, so they keep all.
 */
const TRACE_RATE: Record<string, number> = { production: 0.01, preview: 0.1, local: 1 };

/** Where a traced request is going, from whatever the sampling context carries. */
export interface TraceTarget {
  name?: string;
  attributes?: Record<string, unknown>;
  normalizedRequest?: { url?: string };
}

/** The `tracesSampler` for the server: signaling at the rate above, nothing else. */
export function serverTraceRate(t: TraceTarget, env = environment): number {
  const a = t.attributes ?? {};
  const where = [t.name, t.normalizedRequest?.url, a['url.path'], a['http.target'], a['http.route'], a['next.route']]
    .filter((x) => typeof x === 'string')
    .join(' ');
  return where.includes('/api/net/') ? (TRACE_RATE[env] ?? 0) : 0;
}
