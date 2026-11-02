import type { Instrumentation } from 'next';
import { sentryOptions } from './app/sentry-options';

/**
 * Server side of the Sentry host, for both Node and Edge routes. The SDK loads
 * only when Sentry is on, and a failure here must never stop the server, since
 * Next awaits `register` before it serves anything.
 */
export async function register(): Promise<void> {
  if (!sentryOptions.dsn) return;
  try {
    const { init } = await import('@sentry/nextjs');
    init({ ...sentryOptions, serverName: 'slag' }); // the default is the machine's hostname
  } catch (e) {
    console.warn('Sentry failed to start', e);
  }
}

/** Next calls this for errors from route handlers, server components and actions, so new `app/api/` routes are covered with no extra setup. */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (!sentryOptions.dsn) return;
  try {
    const { captureRequestError } = await import('@sentry/nextjs');
    captureRequestError(error, request, context);
  } catch (e) {
    console.warn('Sentry failed to report a request error', e);
  }
};
