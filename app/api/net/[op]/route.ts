import { captureException, logger } from '@sentry/nextjs';
import { MAX_BODY_BYTES, SIGNAL_OPS, type SignalErrorCode, type SignalOp } from '../../../../src/net/signal-protocol';
import { ReplyCache } from '../_server/cache';
import { clientKey, iceFromEnv, originAllowed, RateLimiter } from '../_server/guard';
import { ApiError, handleOp } from '../_server/handlers';
import { StoreFailureThrottle } from '../_server/report';
import { storeFromEnv } from '../_server/store';

/**
 * Signaling and presence for online play: POST /api/net/<op> with a JSON body
 * sent as text/plain. Logic is in ../_server; this is the HTTP edge.
 */

const limiter = new RateLimiter();
const throttle = new StoreFailureThrottle();
/** The lobby list, read once per instance per LIST_CACHE_MS however many people browse. */
const lists = new ReplyCache<unknown>();

/** Handled (the caller gets a 503), so nothing reports it automatically. See ../_server/report.ts for the throttle. */
function reportStoreFailure(e: unknown, op: SignalOp) {
  console.error('signal store failed:', e instanceof Error ? e.message : 'unknown');
  const r = throttle.next(e, op);
  if (!r) return;
  captureException(e, { tags: r.tags, fingerprint: r.fingerprint, extra: { suppressed: r.suppressed } });
  logger.warn('signal store failed', { ...r.tags, suppressed: r.suppressed });
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
    const ctx = { store, ice: iceFromEnv(process.env.SLAG_ICE_SERVERS) };
    const reply = op === 'lobbies' ? await lists.get(() => handleOp(op, body, ctx)) : await handleOp(op as SignalOp, body, ctx);
    return Response.json(reply, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof ApiError) return fail(e.code, e.status);
    reportStoreFailure(e, op as SignalOp);
    return fail('store-failed', 503);
  }
}
