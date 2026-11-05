# Telemetry

What the game sends to Sentry, and why. The game reports through `src/telemetry.ts` and never imports an SDK; the host (`instrumentation-client.ts`, `instrumentation.ts`, `app/sentry-*.ts`) decides where it goes. Only Vercel deploys report (`app/sentry-options.ts`), so dev, tests and `pnpm shot` send nothing.

## The API

| Call | Sends | Use |
| --- | --- | --- |
| `reportError(e, data)` | an error event | A caught exception. Uncaught ones reach the SDK's global handlers on their own. `data.boundary` and `data.where` become tags. |
| `reportEvent(name, level, data, { group })` | a message event | A game-specific failure with no exception. Fixed `name`; variables in `data`; `group` only for a small fixed set of causes. At most 5 per name per page load. |
| `reportLog(message, level, data)` | a structured log | How something went when nothing broke. At most 30 per message per page load. |
| `reportMetric(type, name, value, { unit, attributes })` | a metric datapoint | How the game runs across every player: a `count`, `gauge` or `distribution`, already summarised by the caller. At most 500 per name per page load. |
| `addBreadcrumb(category, message, data)` | nothing on its own | A step in the trail sent with the next event. Never per frame. |
| `setTag(key, value)` | nothing on its own | A fact that holds until changed, on every event and log. |
| `setContext(name, data or reader)` | nothing on its own | A block of details on every event. A reader is called only when an event is built. |
| `setTelemetryContext(reader)` | nothing on its own | The screen's tags, read when an event is built. |

None of it is allowed in `sim/`, `gen/` or `game/` (lint). Something only the sim knows is exposed as a read-only diagnostic (`lastGenInfo`, `planMisses`) and reported from outside.

## Tags

On every event and log. Searchable, so low cardinality only.

| Tag | From | For |
| --- | --- | --- |
| `screen` | `src/main.ts`, `src/game-client.ts` | home, lobby, codex, missing. |
| `room` | game-client | Finding every peer's reports from one room. Never in a user field. |
| `match.phase`, `match.round` | game-client | Where in the match it broke. |
| `level.seed`, `level.theme`, `level.size`, `level.concept` | game-client | Reproducing the level: `pnpm level <seed> --theme <theme>`. |
| `players`, `observers` | game-client | Seated players, and peers in the room without a seat (watching, or owed a seat next round). |
| `net.role` | game-client | host, guest, or local (offline). |
| `net.transport` | game-client | webrtc, broadcast, or none. |
| `net.status` | game-client | `NetStatus`: online, connecting, reconnecting, unavailable, offline, kicked. |
| `net.snap` | game-client | `SNAP_VERSION`: which builds can share a room. |
| `input.mode` | game-client | keyboard, gamepad, touch. |
| `device.class` | `src/main.ts` | phone (touch-first) or desktop. |
| `render.quality` | game-client | high, mid, low (`src/ui/touch/device.ts`). |
| `render.webgl2` | `src/render/post.ts` | Whether the browser gave a WebGL2 context. |
| `boundary`, `where` | `reportError` data | Which mount, unmount or compositor step failed. |
| `event.group` | `reportEvent` | The cause an event was grouped by. |

## Contexts

On every event from a lobby, read when the event is built.

| Context | Holds |
| --- | --- |
| `level` | seed, theme, size in tiles, style, concept, weather, gravity, density, danger, route, set pieces. |
| `rules` | `MatchRules`: match length, timers, gravity, weather, blood rounds, secret parts. |
| `match` | frame, phase frame, placed props, crate size, winners. |
| `net` | own and host peer ids, the status detail, peers, synced, paused, refused, desync/sync/migration counts, and the render path (`webgl2:high`). |
| `details` | The `data` passed to `reportError` or `reportEvent`. |

## Events

Each is grouped by its fingerprint, `['slag-event', name]` plus the group if any, so a room, a frame or a peer never splits an issue.

| Name | Level | From | When |
| --- | --- | --- | --- |
| `desync` | error | `src/net/session.ts`, host | A guest's state hash differs from the host's. `data`: frame, peer, both hashes, phase. The guest is resynced. |
| `slow-host-migration` | warning | session, new host | A migration took over 20 s from noticing the host gone to playing again (`SLOW_MIGRATION_MS`; they normally take 4–8 s). |
| `net-unavailable` | warning | session | Online play gave up on this page. Grouped by why: `Cannot Reach Host` (no TURN), `WebRTC Unsupported`, `Signaling Unreachable`, an unconfigured store. |
| `snapshot-refused` | warning | session, guest | The host's snapshot is from another build. Once a page. |
| `level-fallback` | error / warning | `src/level-ahead.ts`, game-client (host) | The generator fell back: group `fallback` (flat floor or legacy sculptor, error) or `concept-fallback` (the concept's landmark failed and the level went plain, warning). `data`: seed, theme, profile. |
| `slow-frames` | warning | `src/render/renderer.ts` | A phone already on the `low` tier still ran under ~45 fps for 2 s: this device can't play the game as it is. `data`: tier. Once a page, since adapting stops there. |
| `plan-lost` | error | game-client, host | A round started with no proven way to the flag on a level nothing has touched yet (`planMisses`), a broken generation guarantee. Parts sealing a level is play and isn't reported. |

Errors (`reportError`):

| Data | From | When |
| --- | --- | --- |
| `boundary: 'screen'` | `src/main.ts` | A screen failed to mount; the player sees the error screen. |
| `boundary: 'screen-unmount'` | main.ts | A screen's teardown threw. |
| `boundary: 'global-error'` | `app/global-error.tsx` | The React shell itself failed. |
| `where: 'compositor-init'` | post.ts | The WebGL pass wouldn't build; the game draws without it. |
| `where: 'compositor-restore'` | post.ts | A restored GPU context couldn't rebuild the pass. |

Server (`app/api/net/[op]/route.ts`): a store failure answered with a 503 is captured with tags `area: signal-store`, `op` and `store.status` (the store's HTTP status, `rejected` or `network`), grouped by status, at most once a minute per instance with the number held back in `extra.suppressed`. Unhandled route errors reach Sentry through `onRequestError` in `instrumentation.ts`.

## Breadcrumbs

| Category | Message | From |
| --- | --- | --- |
| `screen` | the screen name | main.ts, on every screen change. |
| `page` | hidden, visible | main.ts, on visibility changes. |
| `game` | `phase <phase>` (with round), `level` (seed, theme) | game-client, when the phase or the level changes. |
| `room` | join, leave, away, back, kick | session, when a bundle applies a seat action. Device and peer ids only. |
| `room` | watch (a seat given up to watch), idle (the host moved an AFK player to the watchers) | session, when a bundle applies `watch`. Peer id and frame only. |
| `room` | rejoin refused (banned) | session, host: a kicked peer's `hello` inside its ban. Peer id and ms left. |
| `room` | join request, join won, join lost (another peer won the race for the seat), back from idle | session, on the asking peer: when it sends Join, when the host's answer is applied, and when an AFK watcher's input asks for its seat back. |
| `net` | peer joined, peer left | session, when the member list changes size. |
| `net` | every session log line: `link <status> (<detail>)`, `<peer> is host`, `host migrated <old> → me at frame <f>`, `resuming from <peer> at frame <f>`, `synced (<why>) at frame <f>`, `desync with <peer> at frame <f>: resync`, `snapshot refused: …`, `resumed saved room state …` | `src/net/client.ts` routes the session's log here. |
| `signal` | `<op> failed` (code, status) | `src/net/signal-client.ts`, once per run of the same failure. |
| `render` | webgl context lost, webgl context restored | post.ts. Routine on phones, so not an event. |
| `render` | `quality <from> → <to>` | renderer.ts, when a phone's frames ran slow long enough to drop a tier. |

The SDK adds `console` lines (minus the `[net]` ones, which are the `net` breadcrumbs above), navigation, and fetches, minus successful signaling calls: those are a poll every few seconds and would push the story out of the 100-breadcrumb trail (`keepBreadcrumb` in `app/sentry-filter.ts`). DOM clicks and keys are off: they are game input.

## Logs

Sentry structured logs (SDK 11 sends them without opting in), each with every tag above as attributes:

| Message | Level | From | Data |
| --- | --- | --- | --- |
| `host migration` | info | session, new host | ms from noticing the loss to playing again, from, to, peers, frame, phase. |
| `net resync` | info | session, guest | why (`desync`, `migrate`, `behind`), frame. A join's first sync isn't logged. |
| `signal store failed` | warning | the route | op, store status, suppressed. Same throttle as the event. |

These are logs rather than events because most of them are the system working: a migration that took 5 s is not an issue, but how long migrations take across real players is something only the field can tell, and nothing else records it. A handful per session costs bytes, not event quota.

## Metrics

Sentry metrics (SDK 11 sends them without opting in; the SDK flushes them when the tab hides). Each carries the game's tags as attributes, minus `room`, `level.seed` and `match.round`, which would split every series per room, plus `browser.name` (chrome, safari, firefox, edge, samsung, opera, other), `browser.version` (major) and `os.name` (windows, macos, ios, android, linux, chromeos, other), read from the user agent because Sentry does that only for errors (`metricAttributes` and `clientOf` in `app/sentry-filter.ts`). Numeric attributes (`players`, `observers`, `net.snap`) are queried typed: `tags[players,number]`.

| Name | Type | From | Value |
| --- | --- | --- | --- |
| `frame.total` | count | `src/frame-pacing.ts` | Frames drawn in one window. |
| `frame.slow` | count | frame-pacing | Of those, intervals over 20 ms: a missed refresh the player sees as stutter. |
| `frame.hitch` | count | frame-pacing | Intervals over 50 ms: a freeze. |
| `frame.p95` | distribution, ms | frame-pacing | The window's 95th percentile interval. |
| `frame.work.p95` | distribution, ms | frame-pacing | The window's 95th percentile of the game's own main-thread time per frame: input, sim steps and render, from the top of the frame callback to the end. |
| `render.downgrade` | count | renderer.ts | A phone dropped a quality tier. Attributes `from`, `to`. |

A window is one visit to the lobby, pick, place or run phase; score and victory screens aren't measured. It ends when the phase changes, the tab hides, or the lobby is left, and it is sent only if it held at least 2 s of drawn frames (time, not a frame count, so a device at 6 fps still reports). Its `match.phase` is the phase it measured, not the one the match has moved on to. Gaps over a second (hidden tab, debugger) are the page not drawing and aren't counted.

Counts add up across players, so the measure to watch is `sum(frame.slow) / sum(frame.total)` grouped by `device.class` and `render.quality`, per release: the share of slow frames on phones going from 2% to 6% is a regression, while a fixed fps threshold would fire forever on old phones. `frame.p95`'s own percentiles answer "how bad is a typical race", but a percentile of percentiles doesn't merge exactly, so use it for trends. Read it beside `frame.work.p95` to see where the time goes: frames 33 ms apart with 20 ms of work are our script, too slow there. With 5 ms of work the time is outside our script: the GPU, the compositor, or the browser capping the rate (Chrome's Energy Saver, Safari's Low Power Mode). The browser runs most GPU work after the frame callback returns, so it barely shows as work (SwiftShader frames 850 ms apart measured 13 ms); `browser.name` and `os.name` split a cap from a GPU, and `?debug=1&perfsync=1` on the device settles it: it reads back a pixel each frame, which charges the GPU's time to the overlay's `post`. A window is five datapoints at most, so an hour of play is about a thousand.

## Noise

Dropped before sending (`noiseReason` in `app/sentry-filter.ts`, plus the SDK's defaults: `Script error.`, the ResizeObserver notification warning):

| Case | Why it's safe |
| --- | --- |
| A stack frame from a browser extension | Not our code. |
| Every frame from another origin | An injected or third-party script. Frames with no file, and our worker's `blob:` URL, count as ours. |
| `ResizeObserver loop limit exceeded` | The old wording of a benign warning; `src/ui/home-stage.ts` is the only observer. |
| Network and chunk-load failures, and `AbortError`, after `pagehide` | The browser cancelling loads (the lazy screens, the home stage, settings) as the page goes. Before a page leave they are kept: a chunk that won't load is an error screen. |

Not filtered, on purpose: WebRTC and ICE failures, and failed signaling fetches. The transport and `HttpSignal` catch every one of them (they show up as `signal` breadcrumbs and `net-unavailable`), so one that reaches the global handler is a new bug.

Beyond that, a page sends at most 25 events in all (`MAX_EVENTS_PER_PAGE`), on top of the per-name caps, and Dedupe drops an error identical to the one before it, which covers a throw every tick.

## Releases and source maps

`next.config.ts` names the release after `VERCEL_GIT_COMMIT_SHA` and inlines it with `VERCEL_ENV` (production, preview, development) as the environment; anything not on Vercel is `local`. With `SENTRY_AUTH_TOKEN` set, the build creates the release, uploads source maps under it and deletes them from the output, so the deployed site never serves them. It also associates commits from `VERCEL_GIT_REPO_OWNER`/`VERCEL_GIT_REPO_SLUG` (Vercel builds have no `.git`, so the plugin can't find them itself), which needs the GitHub repo linked to the Sentry project for suspect commits, and records a deploy for the environment. Without the token there are no maps at all.

## Sampling

Quotas below are Sentry's free Developer plan; check the current numbers before relying on them.

| Signal | Setting | Why |
| --- | --- | --- |
| Errors | `sampleRate: 1` | Every error is wanted, and they are rare. The free plan's 5K errors a month is guarded by the per-name caps, the 25-a-page budget and the noise filters, not by dropping a share at random. |
| Browser tracing | off (no tracing integration) | One long-lived canvas page: a page-load trace says less than `pnpm perf`, and the integration would wrap every signaling poll. Frame pacing comes as metrics instead. |
| Metrics | always on, a few per phase, capped per name per page | See Metrics. |
| Server tracing | `tracesSampler` (`serverTraceRate`): `/api/net/*` only, 1% in production, 10% in preview, all locally | The signaling routes are the server's whole job and their time is the store's. A 4-player room makes about 33 requests a minute; a busy month of a few million is tens of thousands of traced requests at 1%, six spans each, well within the span quota. |
| Replay | off | The game is a canvas, which a DOM replay records as an empty box. |
| Logs | always on, capped per message per page | See Logs. |

## Checking it locally

`NEXT_PUBLIC_SENTRY_DSN` set at build time turns reporting on in a local production build. Point it at a local stand-in that answers `POST /api/<project>/envelope/` with CORS headers and records the bodies, then `next build` and `next start` with the same variable (and `SLAG_SIGNAL_STORE=memory` for online play). Errors arrive as `event` items, logs as `log`, metrics as `trace_metric`, server traces as `span`. That build keeps reporting wherever it is served, so rebuild without the variable afterwards (`pnpm shot` rebuilds on its own: a hand-made build has no harness stamp).
