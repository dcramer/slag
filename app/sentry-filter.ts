import type { Breadcrumb, ErrorEvent, StackFrame } from '@sentry/browser';
import type { TelemetryScope } from '../src/telemetry';

/**
 * What the browser host (`app/sentry-browser.ts`) keeps out of Sentry and adds
 * to what goes in, as plain functions so tests can pin them without the SDK.
 * Every filter here names a case checked against the game's code: noise is
 * dropped only where the game already handles the failure or can't cause it.
 */

/**
 * Most events one page load sends, errors and `reportEvent`s together. The
 * per-name caps in src/telemetry.ts stop one loop; this stops a page that is
 * failing in many ways at once from spending the month's quota alone.
 */
export const MAX_EVENTS_PER_PAGE = 25;

/** Counts sends for one page load. */
export class EventBudget {
  private used = 0;
  constructor(readonly limit = MAX_EVENTS_PER_PAGE) {}
  /** True while there is budget left, spending one. */
  take(): boolean {
    if (this.used >= this.limit) return false;
    this.used++;
    return true;
  }
}

/** Scripts a browser extension injected. They share our page and window.onerror, not our code. */
const EXTENSION_URL = /^(?:chrome|moz|safari|safari-web|ms-browser)-extension:\/\/|^webkit-masked-url:/;

/**
 * Failures of the network or of a lazy chunk's download. While the page is
 * being left the browser cancels whatever was loading (a screen's chunk, the
 * home stage, the settings menu), and those rejections say nothing about the
 * game. Away from a page leave they stay: a chunk that won't load is an error
 * screen in front of a player.
 */
const LEAVE_NOISE =
  /Failed to fetch|NetworkError when attempting to fetch|^Load failed$|dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk .* failed/;

/** Older Chrome's wording; the SDK's defaults already cover "ResizeObserver loop completed with undelivered notifications". */
const RESIZE_OBSERVER = /^ResizeObserver loop limit exceeded$/;

function framesOf(event: ErrorEvent): StackFrame[] {
  return (event.exception?.values ?? []).flatMap((v) => v.stacktrace?.frames ?? []);
}

export interface PageState {
  /** This page's origin: frames from anywhere else are someone else's script. */
  origin: string;
  /** `pagehide` has fired and no `pageshow` since: the page is going away. */
  leaving: boolean;
}

/** Why `event` is noise, or null to send it. */
export function noiseReason(event: ErrorEvent, page: PageState): string | null {
  const frames = framesOf(event);
  const files = frames.map((f) => f.filename ?? '').filter((f) => f && f !== '<anonymous>' && f !== 'native');
  if (files.some((f) => EXTENSION_URL.test(f))) return 'extension';
  // Every frame with a URL is from another origin: an ad, a translation widget, an injected script.
  const remote = files.filter((f) => /^https?:\/\//.test(f));
  if (remote.length && remote.length === files.length && !remote.some((f) => f.startsWith(page.origin))) return 'third-party';
  const ex = event.exception?.values?.[0];
  const message = ex?.value ?? event.message ?? '';
  if (RESIZE_OBSERVER.test(message)) return 'resize-observer';
  if (page.leaving && (ex?.type === 'AbortError' || LEAVE_NOISE.test(message))) return 'page-leave';
  return null;
}

/**
 * Stamp the game's tags and contexts onto an event, automatic ones included.
 * What the event already carries wins: a report's own details beat the ambient state.
 */
export function stampScope(event: ErrorEvent, scope: TelemetryScope): ErrorEvent {
  const tags: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(scope.tags)) if (v !== undefined) tags[k] = v;
  event.tags = { ...tags, ...event.tags };
  event.contexts = { ...scope.contexts, ...event.contexts };
  return event;
}

/**
 * Tags that name one room, level or round. Fine on an issue, where they find the
 * reports to read; on a metric they split every series into one per room.
 */
const PER_ROOM_TAGS: ReadonlySet<string> = new Set(['room', 'level.seed', 'match.round']);

/**
 * A metric's attributes: the game's tags minus the per-room ones, under what the
 * metric was given (a window's `match.phase` beats the phase the match moved on to).
 */
export function metricAttributes(tags: TelemetryScope['tags'], own?: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(tags)) if (v !== undefined && !PER_ROOM_TAGS.has(k)) out[k] = v;
  return { ...out, ...own };
}

/**
 * Fetch breadcrumbs from the signaling API are a poll every few seconds: left
 * in, they push everything else out of the trail. Failed ones stay, and so
 * does every other request. Console lines from the net session (`[net] …`)
 * are dropped because the session sends the same lines as `net` breadcrumbs.
 */
export function keepBreadcrumb(b: Breadcrumb): boolean {
  if (b.category === 'fetch' || b.category === 'xhr') {
    const url = String(b.data?.url ?? '');
    const status = Number(b.data?.status_code ?? 0);
    return !(url.includes('/api/net/') && status > 0 && status < 400);
  }
  if (b.category === 'console' && typeof b.message === 'string' && b.message.startsWith('[net]')) return false;
  return true;
}

/** Events group by name (and a cause where one name has several), never by room, frame or peer. */
export function eventFingerprint(name: string, group?: string): string[] {
  return group ? ['slag-event', name, group] : ['slag-event', name];
}
