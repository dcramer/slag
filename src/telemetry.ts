/**
 * Host-agnostic telemetry. The game reports here and never learns who is
 * listening: a host (Next today, a packaged build later) calls
 * `installTelemetry` with whatever backend it has, and with none installed
 * every call is a cheap no-op. docs/TELEMETRY.md lists every name in use.
 *
 * This is read-only observation from outside the sim: `src/sim`, `src/gen` and
 * `src/game` never import it (lint enforces), so nothing here can change sim
 * state or run order. Every call swallows reporter failures, because a broken
 * monitoring backend must not be able to break the game it is watching.
 *
 * What the game is doing (tags, contexts) is kept here and read only when a
 * report is built, so it works before a lazily loaded backend arrives and an
 * idle game pays nothing per frame.
 */

export type TelemetryLevel = 'info' | 'warning' | 'error';

/** Flat, JSON-safe details attached to a single report. */
export type TelemetryData = Record<string, string | number | boolean | undefined>;

/**
 * Searchable tags on every report: low-cardinality facts to filter and group by.
 * Keys are namespaced so they can't collide with the backend's own (`level`, `device`).
 */
export interface TelemetryTags {
  /** Which screen is up (src/routes.ts): home, lobby, codex, missing. */
  screen?: string;
  room?: string;
  'match.phase'?: string;
  'match.round'?: number;
  'level.seed'?: number;
  'level.theme'?: string;
  /** Size class: classic, wide, tall… */
  'level.size'?: string;
  /** Stage concept id, or 'none' for a plain level. */
  'level.concept'?: string;
  players?: number;
  /** Peers in the room without a seat. */
  observers?: number;
  'net.role'?: 'host' | 'guest' | 'local';
  'net.transport'?: 'webrtc' | 'broadcast' | 'loopback' | 'none';
  'net.status'?: string;
  /** SNAP_VERSION: which builds can share a room. */
  'net.snap'?: number;
  /** Latest input: keyboard, gamepad, touch. */
  'input.mode'?: string;
  'device.class'?: 'phone' | 'desktop';
  'render.quality'?: string;
  'render.webgl2'?: boolean;
}

/** What the game is doing right now, as tags. Kept under its old name for the screens that set it. */
export type TelemetryContext = TelemetryTags;

/** A structured context: fixed data, or a reader called only when a report is built. */
export type ContextSource = TelemetryData | (() => TelemetryData | undefined);

/** Everything known about the game at report time. */
export interface TelemetryScope {
  tags: TelemetryTags;
  contexts: Record<string, TelemetryData>;
}

export interface EventOptions {
  /**
   * Splits one event name into separate issues by a small fixed set of causes
   * (`net-unavailable` by why). Never a frame, a seed or an id.
   */
  group?: string;
}

/** Implemented by the host. Methods may throw; callers here are protected. */
export interface TelemetryReporter {
  error(error: unknown, data?: TelemetryData): void;
  event(name: string, level: TelemetryLevel, data?: TelemetryData, opts?: EventOptions): void;
  breadcrumb(category: string, message: string, data?: TelemetryData): void;
  /** A structured log line, searchable on its own without an error around it. Optional: a backend without logs drops them. */
  log?(level: TelemetryLevel, message: string, data?: TelemetryData): void;
}

/**
 * Per-name cap on `reportEvent` for one page load. A desync or context-loss
 * loop can fire every frame, and a handful of reports says all one session can.
 */
export const MAX_EVENTS_PER_NAME = 5;
/** Per-message cap on `reportLog` for one page load. */
export const MAX_LOGS_PER_MESSAGE = 30;

let reporter: TelemetryReporter | null = null;
let readContext: (() => TelemetryContext) | null = null;
const tags = new Map<string, string | number | boolean>();
const contexts = new Map<string, ContextSource>();
const eventCounts = new Map<string, number>();
const logCounts = new Map<string, number>();

/** Called by the host once at startup; `null` removes the reporter. */
export function installTelemetry(next: TelemetryReporter | null): void {
  reporter = next;
  eventCounts.clear();
  logCounts.clear();
}

/**
 * Register how to read the current game state as tags. It is pulled only when
 * a report is built. The reader must only read; a later call replaces the
 * previous one, and its tags win over `setTag`'s.
 */
export function setTelemetryContext(read: (() => TelemetryContext) | null): void {
  readContext = read;
}

/** A tag that holds until changed, for facts a subsystem learns once (WebGL2 or not). `undefined` removes it. */
export function setTag<K extends keyof TelemetryTags>(key: K, value: TelemetryTags[K]): void {
  if (value === undefined) tags.delete(key);
  else tags.set(key, value);
}

/** A named block of details on every report (`level`, `rules`, `net`). A function is read at report time; `null` removes it. */
export function setContext(name: string, source: ContextSource | null): void {
  if (source === null) contexts.delete(name);
  else contexts.set(name, source);
}

/** The current game tags, or `{}` if the reader is missing or throws. */
export function telemetryContext(): TelemetryContext {
  try {
    return readContext?.() ?? {};
  } catch {
    return {};
  }
}

/** Tags and contexts as of now, for the host to stamp on a report. Readers that throw are left out. */
export function telemetryScope(): TelemetryScope {
  const out: TelemetryScope = { tags: Object.fromEntries(tags), contexts: {} };
  for (const [k, v] of Object.entries(telemetryContext())) if (v !== undefined) (out.tags as Record<string, unknown>)[k] = v;
  for (const [name, source] of contexts) {
    try {
      const data = typeof source === 'function' ? source() : source;
      if (data) out.contexts[name] = data;
    } catch {
      // A context that can't be read right now (mid-teardown) is left out, not the report.
    }
  }
  return out;
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

/** True the first `cap` times `key` is counted. */
function underCap(counts: Map<string, number>, key: string, cap: number): boolean {
  const n = counts.get(key) ?? 0;
  if (n >= cap) return false;
  counts.set(key, n + 1);
  return true;
}

/** A caught exception worth seeing. Uncaught ones reach the host on their own. */
export function reportError(error: unknown, data?: TelemetryData): void {
  guarded((r) => r.error(error, data));
}

/**
 * A notable non-exception event, grouped by `name` (plus `opts.group`): keep
 * the name a fixed string and put variable details in `data`.
 */
export function reportEvent(name: string, level: TelemetryLevel = 'warning', data?: TelemetryData, opts?: EventOptions): void {
  if (!reporter || !underCap(eventCounts, name, MAX_EVENTS_PER_NAME)) return;
  guarded((r) => r.event(name, level, data, opts));
}

/** A trail marker that shows up on the next report; sends nothing itself. Never call it per frame. */
export function addBreadcrumb(category: string, message: string, data?: TelemetryData): void {
  guarded((r) => r.breadcrumb(category, message, data));
}

/**
 * A structured log line that is sent on its own: how things went when nothing
 * broke (a migration's timeline). Fixed `message`, variables in `data`.
 */
export function reportLog(message: string, level: TelemetryLevel = 'info', data?: TelemetryData): void {
  if (!reporter?.log || !underCap(logCounts, message, MAX_LOGS_PER_MESSAGE)) return;
  guarded((r) => r.log?.(level, message, data));
}
