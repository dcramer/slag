import {
  addBreadcrumb,
  breadcrumbsIntegration,
  captureException,
  captureMessage,
  dedupeIntegration,
  type ErrorEvent,
  eventFiltersIntegration,
  globalHandlersIntegration,
  httpContextIntegration,
  init,
  linkedErrorsIntegration,
  withScope,
} from '@sentry/browser';
import { telemetryContext, type TelemetryReporter } from '../src/telemetry';
import { sentryOptions } from './sentry-options';

/**
 * The browser Sentry SDK, in its own lazy chunk (see `instrumentation-client.ts`).
 * Named imports matter here: `import('@sentry/browser')` as a namespace keeps
 * replay and feedback in the bundle, while this keeps it about a third the size.
 * It is `@sentry/browser` rather than `@sentry/nextjs` because the latter always
 * brings tracing and React, which an errors-only canvas game doesn't use.
 */

/** Stamp every event, automatic ones included, with what the game is doing right now. */
function withGameContext(event: ErrorEvent): ErrorEvent {
  event.tags = { ...telemetryContext(), ...event.tags };
  return event;
}

/** Start the SDK and return the reporter that feeds it. */
export function startSentry(): TelemetryReporter {
  init({
    ...sentryOptions,
    beforeSend: withGameContext,
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
  return {
    error(error, data) {
      withScope((scope) => {
        if (data) scope.setContext('telemetry', data);
        captureException(error);
      });
    },
    event(name, level, data) {
      withScope((scope) => {
        if (data) scope.setContext('telemetry', data);
        scope.setFingerprint(['slag-event', name]);
        captureMessage(name, level);
      });
    },
    breadcrumb(category, message, data) {
      addBreadcrumb({ category, message, data });
    },
  };
}
