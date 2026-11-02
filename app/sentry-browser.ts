import {
  addBreadcrumb,
  breadcrumbsIntegration,
  captureException,
  captureMessage,
  dedupeIntegration,
  eventFiltersIntegration,
  globalHandlersIntegration,
  httpContextIntegration,
  init,
  linkedErrorsIntegration,
  logger,
  withScope,
} from '@sentry/browser';
import { telemetryScope, type TelemetryData, type TelemetryLevel, type TelemetryReporter } from '../src/telemetry';
import { EventBudget, eventFingerprint, keepBreadcrumb, noiseReason, type PageState, stampScope } from './sentry-filter';
import { sentryOptions } from './sentry-options';

/**
 * The browser Sentry SDK, in its own lazy chunk (see `instrumentation-client.ts`).
 * Named imports matter here: `import('@sentry/browser')` as a namespace keeps
 * replay and feedback in the bundle, while this keeps it about a third the size.
 * It is `@sentry/browser` rather than `@sentry/nextjs` because the latter always
 * brings tracing and React, which an errors-only canvas game doesn't use.
 *
 * No tracing and no replay here, on purpose (docs/TELEMETRY.md → Sampling):
 * the game is one long-lived canvas page, so a replay records an empty canvas
 * and a page-load trace says less than `pnpm perf`.
 */

/** Details passed with `reportError` that are worth filtering issues by. */
const ERROR_TAGS = ['boundary', 'where'] as const;

const LOG: Record<TelemetryLevel, (message: string, attributes?: Record<string, unknown>) => void> = {
  info: (m, a) => logger.info(m, a),
  warning: (m, a) => logger.warn(m, a),
  error: (m, a) => logger.error(m, a),
};

/** Start the SDK and return the reporter that feeds it. */
export function startSentry(): TelemetryReporter {
  const page: PageState = { origin: location.origin, leaving: false };
  addEventListener('pagehide', () => (page.leaving = true));
  addEventListener('pageshow', () => (page.leaving = false));
  const budget = new EventBudget();
  init({
    ...sentryOptions,
    // Errors are rare and every one is wanted; the caps in src/telemetry.ts and the page budget bound them instead.
    sampleRate: 1,
    beforeSend: (event) => (noiseReason(event, page) || !budget.take() ? null : stampScope(event, telemetryScope())),
    beforeBreadcrumb: (b) => (keepBreadcrumb(b) ? b : null),
    // Logs carry the game's tags too, so one can be filtered like an issue.
    beforeSendLog: (log) => ({ ...log, attributes: { ...telemetryScope().tags, ...log.attributes } }),
    // Spelled out to leave out BrowserApiErrors, which would wrap the game loop's
    // requestAnimationFrame for nothing (uncaught errors reach globalHandlers
    // anyway), and sessions. `dom: false`: keystrokes and clicks are game input.
    defaultIntegrations: [
      eventFiltersIntegration(),
      breadcrumbsIntegration({ dom: false }),
      globalHandlersIntegration(),
      linkedErrorsIntegration(),
      dedupeIntegration(),
      httpContextIntegration(),
    ],
  });
  const details = (data?: TelemetryData) => (data ? Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) : undefined);
  return {
    error(error, data) {
      withScope((scope) => {
        if (data) scope.setContext('details', details(data)!);
        for (const k of ERROR_TAGS) if (typeof data?.[k] === 'string') scope.setTag(k, data[k]);
        captureException(error);
      });
    },
    event(name, level, data, opts) {
      withScope((scope) => {
        if (data) scope.setContext('details', details(data)!);
        if (opts?.group) scope.setTag('event.group', opts.group);
        scope.setFingerprint(eventFingerprint(name, opts?.group));
        captureMessage(name, level);
      });
    },
    breadcrumb(category, message, data) {
      addBreadcrumb({ category, message, data: details(data) });
    },
    log(level, message, data) {
      LOG[level](message, details(data));
    },
  };
}
