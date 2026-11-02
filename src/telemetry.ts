/**
 * Host-agnostic error telemetry. The game reports here and never learns who is
 * listening: a host (Next today, a packaged build later) calls
 * `installTelemetry` with whatever backend it has, and with none installed
 * every call is a cheap no-op.
 *
 * This is read-only observation from outside the sim: `src/sim`, `src/gen` and
 * `src/game` never import it (lint enforces), so nothing here can change sim
 * state or run order. Every call swallows reporter failures, because a broken
 * monitoring backend must not be able to break the game it is watching.
 */

export type TelemetryLevel = 'info' | 'warning' | 'error';

/** Flat, JSON-safe details attached to a single report. */
export type TelemetryData = Record<string, string | number | boolean | undefined>;

/** What the game is doing right now; attached to every report as searchable tags. */
export interface TelemetryContext {
  room?: string;
  seed?: number;
  theme?: string;
  phase?: string;
  round?: number;
  players?: number;
  renderStyle?: string;
  inputDevice?: string;
}

/** Implemented by the host. Methods may throw; callers here are protected. */
export interface TelemetryReporter {
  error(error: unknown, data?: TelemetryData): void;
  event(name: string, level: TelemetryLevel, data?: TelemetryData): void;
  breadcrumb(category: string, message: string, data?: TelemetryData): void;
}

/**
 * Per-name cap on `reportEvent` for one page load. A desync or context-loss
 * loop can fire every frame, and monitoring it must not burn the event quota.
 */
const MAX_EVENTS_PER_NAME = 20;

let reporter: TelemetryReporter | null = null;
let readContext: (() => TelemetryContext) | null = null;
const eventCounts = new Map<string, number>();

/** Called by the host once at startup; `null` removes the reporter. */
export function installTelemetry(next: TelemetryReporter | null): void {
  reporter = next;
  eventCounts.clear();
}

/**
 * Register how to read the current game context. It is pulled only when a
 * report is built, so an idle game pays nothing per frame. The reader must only
 * read; a later call replaces the previous one.
 */
export function setTelemetryContext(read: (() => TelemetryContext) | null): void {
  readContext = read;
}

/** The current game context, or `{}` if the reader is missing or throws. */
export function telemetryContext(): TelemetryContext {
  try {
    return readContext?.() ?? {};
  } catch {
    return {};
  }
}

/** Run `send` against the reporter, containing anything it throws. */
function guarded(send: (r: TelemetryReporter) => void): void {
  if (!reporter) return;
  try {
    send(reporter);
  } catch {
    // Monitoring failed; the game carries on.
  }
}

/** A caught exception worth seeing. Uncaught ones reach the host on their own. */
export function reportError(error: unknown, data?: TelemetryData): void {
  guarded((r) => r.error(error, data));
}

/**
 * A notable non-exception event, grouped by `name`: keep the name a fixed
 * string and put variable details in `data`.
 */
export function reportEvent(name: string, level: TelemetryLevel = 'warning', data?: TelemetryData): void {
  if (!reporter) return;
  const count = eventCounts.get(name) ?? 0;
  if (count >= MAX_EVENTS_PER_NAME) return;
  eventCounts.set(name, count + 1);
  guarded((r) => r.event(name, level, data));
}

/** A trail marker that shows up on the next report; sends nothing itself. */
export function addBreadcrumb(category: string, message: string, data?: TelemetryData): void {
  guarded((r) => r.breadcrumb(category, message, data));
}
