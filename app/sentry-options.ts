/**
 * Sentry settings shared by the client and server hosts
 * (`instrumentation-client.ts`, `instrumentation.ts`). Importing this pulls in
 * no SDK code. The game itself never sees any of this: it talks to
 * `src/telemetry.ts`.
 */

/** Public by design: a DSN can only submit events, so it is safe to commit. */
const DEFAULT_DSN = 'https://794a2e4b1199bd0053c4349ab7079d53@o172566.ingest.us.sentry.io/4512360042921984';

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
