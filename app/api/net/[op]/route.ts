import { captureException } from '@sentry/nextjs';
import { MAX_BODY_BYTES, SIGNAL_OPS, type SignalErrorCode, type SignalOp } from '../../../../src/net/signal-protocol';
import { clientKey, iceFromEnv, originAllowed, RateLimiter } from '../_server/guard';
import { ApiError, handleOp } from '../_server/handlers';
import { storeFromEnv } from '../_server/store';

/**
 * Signaling and presence for online play: POST /api/net/<op> with a JSON body
 * sent as text/plain. Logic is in ../_server; this is the HTTP edge.
 */

const limiter = new RateLimiter();

/** Handled, so nothing reports it automatically. An exhausted free tier fails every poll in the world, hence the throttle. */
const REPORT_EVERY_MS = 60_000;
let lastReport = 0;
function reportStoreFailure(e: unknown) {
  console.error('signal store failed:', e instanceof Error ? e.message : 'unknown');
  if (Date.now() - lastReport < REPORT_EVERY_MS) return;
  lastReport = Date.now();
  captureException(e, { tags: { area: 'signal-store' } });
}

const fail = (error: SignalErrorCode, status: number) => Response.json({ error }, { status });

export async function POST(req: Request, ctx: { params: Promise<{ op: string }> }) {
  const { op } = await ctx.params;
  if (!SIGNAL_OPS.includes(op as SignalOp)) return fail('bad-request', 404);
  if (!originAllowed(req.headers)) return fail('forbidden', 403);
  if (!limiter.allow(clientKey(req.headers))) return fail('rate-limited', 429);
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return fail('too-large', 413);

  const store = storeFromEnv(process.env);
  if (!store) return fail('unconfigured', 503);

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return fail('too-large', 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail('bad-request', 400);
  }

  try {
    const reply = await handleOp(op as SignalOp, body, { store, ice: iceFromEnv(process.env.SLAG_ICE_SERVERS) });
    return Response.json(reply, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.status);
    reportStoreFailure(e);
    return fail('store-failed', 503);
  }
}
