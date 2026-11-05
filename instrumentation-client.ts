import { sentryOptions } from './app/sentry-options';
import { installTelemetry, type TelemetryReporter } from './src/telemetry';

/**
 * Client side of the Sentry host. Next runs this before hydration on every page.
 *
 * The SDK (`app/sentry-browser.ts`) is lazy-loaded while the browser is idle, so
 * it adds nothing to game start. Until it arrives, reports queue here so a boot
 * failure still gets out. If it never arrives (ad blocker, offline) the queue
 * is dropped and the game plays on unreported.
 */

const MAX_QUEUED = 30;
/** Latest the SDK may start loading, however busy the main thread is. */
const LOAD_TIMEOUT_MS = 3000;

let queue: ((r: TelemetryReporter) => void)[] = [];

function enqueue(send: (r: TelemetryReporter) => void): void {
  if (queue.length < MAX_QUEUED) queue.push(send);
}

const buffer: TelemetryReporter = {
  error: (error, data) => enqueue((r) => r.error(error, data)),
  event: (name, level, data, opts) => enqueue((r) => r.event(name, level, data, opts)),
  breadcrumb: (category, message, data) => enqueue((r) => r.breadcrumb(category, message, data)),
  log: (level, message, data) => enqueue((r) => r.log?.(level, message, data)),
  metric: (type, name, value, opts) => enqueue((r) => r.metric?.(type, name, value, opts)),
};

const onWindowError = (e: ErrorEvent) => buffer.error(e.error ?? e.message);
const onRejection = (e: PromiseRejectionEvent) => buffer.error(e.reason);

async function loadSentry(): Promise<void> {
  try {
    const { startSentry } = await import('./app/sentry-browser');
    const reporter = startSentry();
    installTelemetry(reporter);
    for (const send of queue) send(reporter);
  } catch {
    installTelemetry(null);
  }
  queue = [];
  // From here on the SDK's own global handlers do this job.
  window.removeEventListener('error', onWindowError);
  window.removeEventListener('unhandledrejection', onRejection);
}

if (sentryOptions.dsn) {
  installTelemetry(buffer);
  window.addEventListener('error', onWindowError);
  window.addEventListener('unhandledrejection', onRejection);
  const start = () => void loadSentry();
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: LOAD_TIMEOUT_MS });
  else setTimeout(start, LOAD_TIMEOUT_MS);
}
