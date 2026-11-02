# Online play

A room is its URL, `/r/<CODE>`. Everyone who opens the same link is in the same match. There is no matchmaking and no room list.

Peers talk over **WebRTC data channels in a star around the host**. Everything stays on Vercel and on free tiers: small Next route handlers do signaling and presence on Redis from the Vercel Marketplace (Upstash), and local dev uses an in-memory store. Code: `src/net/`, `app/api/net/`.

## Setup

Env vars, set by the Vercel Marketplace integration when the Redis store is connected to the project. Either pair works; if both are present, the first wins.

| Variable | Purpose |
|---|---|
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Upstash REST endpoint and read/write token. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | The same, under the names some integrations use. |
| `SLAG_ICE_SERVERS` | Optional. JSON array of `RTCIceServer`, added to public STUN, e.g. `[{"urls":"turn:turn.example:3478","username":"u","credential":"c"}]`. This is how to add TURN. It reaches every browser, so use credentials meant for that. |
| `SLAG_SIGNAL_STORE` | Test only. `memory` forces the in-memory store under `next start`. Never set it on Vercel: instances share no memory, so rooms would silently split. |

To connect a store: Vercel → the project → **Storage** → connect the Redis store → enable **Production** and **Preview** → redeploy (functions read env vars at start). Nothing else is needed. Never commit these values.

Without credentials in production the API answers `503 {"error":"unconfigured"}`. The game keeps running locally and the lobby's online panel says `Online Not Set Up`.

In `pnpm dev` the in-memory store is used unless those variables are present (`vercel env pull` would put them in `.env.local`, which is gitignored, and dev would then spend the real budget).

URL params: `?net=off` is offline (implied by debug `?players=`/`?race=`). `?net=bc` uses BroadcastChannel between tabs of one browser, with no server.

## Architecture

```
browser ── WebRTC data channels ── host browser      inputs, bundles, snapshots
   └───── POST /api/net/<op> ── Redis                finding peers, handshakes, liveness
```

```
src/net/
  transport.ts          Transport interface; LoopbackHub (tests); BroadcastTransport
  webrtc-transport.ts   the star: roster, links, election, re-signaling, polling
  signal-client.ts      browser side of the API; the one place that knows where the API lives
  signal-protocol.ts    wire types and limits, shared with the routes; pure
  session.ts            NetSession: lockstep, prediction, sync, migration, desync detection
  actions.ts            host-sequenced match actions (join/leave/away/name/rules) + replicated NetState
  codec.ts              compact InputFrame encoding
  snapshot.ts           Match snapshot/restore/hash (exact through JSON: -0, NaN, ∞, Maps, typed arrays)
  predict.ts            cheap race-state copy for prediction
  identity.ts           peer id (survives refresh, distinct per tab) and the resume save
  client.ts             browser entry: transport choice, page lifecycle, the HUD's status
app/api/net/
  [op]/route.ts         HTTP edge: origin, rate limit, size limits
  _server/handlers.ts   one function per op
  _server/store.ts      Store interface; Upstash REST and in-memory implementations
  _server/guard.ts      request gates and ICE configuration
```

### Portability

`src/net` assumes nothing about Next. It reaches the API through one base URL (`setSignalBase` in `signal-client.ts`), empty by default, which means same origin. It imports nothing from `app/`; what the routes and the client share is the pure `signal-protocol.ts`.

A build served from another origin (a packaged app pointing at the hosted API) needs:

1. `setSignalBase('https://<hosted-app>')` before `bootGame`.
2. The API to accept its origin: `originAllowed` in `guard.ts` rejects a browser `Origin` that isn't the request's host, so add an allowlist there, and send `Access-Control-Allow-Origin` on replies. No preflight handling is needed: all requests are `text/plain` POSTs, which are CORS-simple by design. `sendBeacon` works the same way. Packaged origins can be `null` or a custom scheme (`capacitor://localhost`), so the allowlist has to match those literally.
3. A public origin for `inviteUrl` in `client.ts`, which uses `location.origin`.

## Signaling API

`POST /api/net/<op>`, JSON sent as `text/plain`. All ops take `room` and `peer`.

| Op | Does | Redis commands |
|---|---|---|
| `join` | Assign the next join order; returns the live members and ICE servers. | 6–7 |
| `beat` | Renew liveness. Hosts also renew the room and learn the room's lowest order. | guest 1, host 4 |
| `poll` | Drain this peer's mailbox. | 1 |
| `signal` | Put a handshake in another peer's mailbox. | 5 |
| `members` | Live members in order. | 2–3 |
| `gone` | Report a peer that failed to answer an offer. | 3–7 |
| `leave` | Remove self, sent by `sendBeacon` on pagehide. | 1–4 |

Keys, all with a TTL: `slag:<ROOM>:n` the join counter (`INCR`) and `slag:<ROOM>:m` the member sorted set (300 s, renewed by the host), `slag:<ROOM>:p:<peer>` liveness (50 s, renewed by `beat`), `slag:<ROOM>:b:<peer>` the mailbox (30 s).

### Abuse limits

The routes are public and unauthenticated: knowing a room code and a peer id is all a caller needs, so someone in a room can disrupt that room. Limits keep it to that:

- Room codes and peer ids are validated by regex before any Redis command runs.
- Bodies are capped at 20 KB, SDP at 16 KB, mailboxes at 16 messages, rooms at `MAX_PEERS` (`MAX_PLAYERS` + 4 spectators; the host also refuses offers past it).
- Handshakes go only between current members. `gone` needs a current member and the target's exact order.
- Browsers from other origins are refused. A per-client, per-instance limit (600 requests a minute) stops loops without spending Redis commands; it isn't protection against a determined caller, which is the Vercel Firewall's job.
- The free tier is a hard cap: running out stops online play, it doesn't bill. Already-linked games don't need the API and keep playing.

## Budget

Upstash's free tier is 500K commands a month and 250 MB. Blocking commands aren't available over REST, so everything is short polling. The store always POSTs command arrays to `/pipeline` with a bearer token, the form `@upstash/redis` uses, so the same code runs against Upstash and SRH. `tests/signal-handlers.test.ts` pins the cost of each op, and `tests/webrtc-transport.test.ts` measures a playing room.

**Commands per minute, steady state with links up:**

| Who | Polls | Heartbeats | Total |
|---|---|---|---|
| Guest | 0 (polling stops once linked) | 3 × 1 | **3** |
| Host | 12 (every 5 s, to admit newcomers) | 3 × 4 | **24** |
| Host, alone over 10 min | 4 | 12 | 16 |
| Host, alone and hidden over 10 min | 0 | 0 | **0** (leaves the room, rejoins when shown) |

So a 4-player room costs 33 commands a minute (about **8 per player per minute**) and an 8-player room 45 (about 6). Polling doubles its interval in a hidden tab.

**One-off costs:** a join is about 60 commands (the join, offer and answer, guest polling while waiting, and the host polling every second for the next 30 s, so friends arriving together connect fast). A migration in a 3-peer room is about 100.

**In practice:** 500K commands is about 250 hours of 4-player rooms a month, or 8 hours a day, ignoring joins. Storage is irrelevant: a room is under a kilobyte. Function invocations follow the same curve (24 requests a minute for a 4-player room).

To stretch it, raise `POLL_IDLE_MS` in `webrtc-transport.ts`: it's the main cost, and it only trades how long a late joiner waits.

## The star

Connections are vanilla ICE: gather candidates, then send one offer and one answer with everything in them, so a connection costs two mailbox writes. Each link has two channels: `rel` (ordered, reliable) for control frames, snapshots and actions, and `rt` (unordered, no retransmits) for inputs and bundles, which the session already re-sends. Messages over 16 KB are split on `rel`, the size every browser agrees on.

STUN is public (Google, Cloudflare). Pairs that can't connect directly need TURN (`SLAG_ICE_SERVERS`); about 10–20% of pairs are expected to. Without it, a guest that gets an answer but can't open a channel after two tries drops to local play, showing `Cannot Reach Host`. It never evicts the healthy host.

### Identity and devices

- Each tab has a **peer id** (8 chars). It lives in `sessionStorage` (a refresh keeps it) plus a lease table in `localStorage` (a new tab takes the most recently used free id, so closing and reopening the link gets your seat back; two live tabs never share one).
- Match devices are namespaced `<peer>:<local device>` (`k3j9x2ab:kb1`), so one machine can seat several local players. Offline sessions keep raw ids.

### Host election and migration

Join order comes from an atomic per-room `INCR`. The host is the lowest order present. A refresh or reconnect is a new join, so it gets a later order: the old host comes back as a guest.

The host owns the **roster** and pushes it to every guest. When the host dies the guests have no links to each other, so nobody can ask anyone anything. Each peer works it out alone:

1. **Detect.** A data channel closing, the connection failing, or 2.5 s without a heartbeat (sent every 500 ms on `rt`). A goodbye frame skips straight to step 3. If our own timers stalled over 2 s (a background tab, a laptop waking), we don't blame anyone.
2. **Check.** Polling wakes immediately, to every 400 ms. The peer re-offers to the old host and, at the same time, to the next in line. A live host answers: it noticed the same silence and woke its own polling, so a flaky guest reconnects without moving the room. The next in line holds off as a candidate, until the old host misses its 4 s window or until another peer's offer shows that it lost the host too, which is proof enough to take over at once.
3. **Agree.** Every peer takes the lowest order in its last roster that it doesn't believe dead. A candidate that doesn't answer inside 5 s of an offer landing is presumed dead too, and the walk continues, so a lower peer leaving at the same moment, or the new host dying straight after taking over, ends on the same peer for everyone. A peer that has it wrong answers an offer with a redirect.
4. **Resume.** The new host pauses and keeps the expected guests in the roster as `linking`, so nobody is marked away while they re-signal. Each guest's `hello` says the furthest frame it holds. The old host's last bundles may have reached only some peers, so the new host pulls a snapshot from the furthest one, then syncs everyone to it. Inputs that were in flight never made a bundle, so they never happened, on every peer alike: that can't desync. After 6 s it stops waiting for anyone missing.
5. **The old host's player** is treated like any dropped player: `away` mid-match, removed from the lobby.

Only peers that failed an offer get reported to the store, and a report names the exact session (`order`), so a late report can't remove someone who has already refreshed.

Both windows run from when the offer lands, not from when we started. A handshake can take several seconds (a poll interval, ICE gathering on both sides, store round trips), and calling a slow peer dead is how a second host appears.

If two peers end up hosting anyway (say one lost the API at the wrong moment and the other wrote it off), the store settles it within a heartbeat: `beat` tells a host the room's lowest order, a higher host hands its guests to the lower one, and a host the store forgot rejoins later in the order.

An empty room needs nothing: the next arrival is host. If this browser saved the room's state in the last 30 minutes it resumes it.

If signaling fails while links are up, nothing happens: only a host that has lost its guests too reports `reconnecting`, and it freezes rather than fork the room.

**Measured** on one machine with software GL and a loaded CPU, by `pnpm online-test`: see Testing.

## Netcode

The sim is a pure function of `(seed, per-frame inputs)`, so **inputs and host-sequenced actions are the only per-frame data on the wire**. Snapshots go out only for joins, resyncs and migration.

### Lockstep (host-sequenced)

- Ticks don't depend on animation frames. Online, a worker's timer drives them, because a page that's hidden or slow to draw would otherwise hold up everyone waiting on it.
- Every tick (60 Hz), each guest samples its devices, appends the frame to its *unacked* list, and sends **all** unacked frames to the host. Redundancy makes loss harmless.
- The host consumes one queued frame per guest per tick. If a guest's queue runs dry it repeats held buttons, with no edges. More than two frames waiting are folded together (edges OR-ed): the host only eats one a tick, so a queue left alone never drains, and each frame in it is 17 ms of lag for everyone.
- The host stamps `{frame, inputs, actions, ack deltas}` into a **bundle**, applies it, and broadcasts every tick, repeating the previous bundle so a lost packet costs nothing. Guests apply bundles strictly in frame order, the moment they arrive. A gap triggers `need`, and the host resends from its 10 s history or sends a snapshot.
- Discrete changes (seat a rejoiner, drop a leaver, mark away, rename, a saved look, rules, the crate salt) are **actions** in bundles, applied by everyone at the same frame.
- Sequence numbers start at wall-clock ms, so a refreshed page always counts higher than its old self.

### Prediction (races)

The host plays with zero input delay. A guest renders a predicted copy: the confirmed state stepped forward with its unacked inputs, others holding their last known buttons. New bundles rebuild it from the confirmed state (rollback + re-simulate, at most 24 frames). Events are emitted the first time a frame is simulated, never twice.

Prediction can't know a jump or a turn is coming, so remote runners are wrong for a round trip and then corrected. Drawn straight, a late jump teleports about 50 px at 100 ms. Instead each runner carries on from where it was drawn and the error bleeds away over a few frames, unless it's so large it must be a respawn. This only touches the view copy, which is rebuilt from confirmed state every update and never stepped, so it can't affect determinism.

### Pick and place

`Player.cursor`, `claim` and `rot` are match state, so every peer sees every cursor, card hover and ghost part, with its rotation and valid/invalid colour. Rendering isn't filtered to the local player.

- **Cursors are presentation-corrected, never predicted into the sim.** The view in pick and place is a copy of the confirmed match that is never stepped: a guest's own cursor runs ahead through its unacked inputs, so it doesn't lag a round trip, and remote cursors glide between bundles. Mouse positions cross the wire only when they move, keyboard and gamepad cursors as held buttons, so an idle peer costs nothing and a held direction keeps moving.
- **Claims are never predicted.** A click marks the card pending (`pendingCard`, a highlight only) until the host's bundle rules on it. The first click the host sequences wins; two in one frame go to the lower slot; everyone gets the same answer at the same frame, so a loser never sees a claim revoked. The timeout hand-out is seeded from the match, at a sequenced frame, so it agrees too.

### Joining and reconnecting

- **Join / reconnect**: a guest says `hello`; the host replies with a **snapshot**: the whole Match minus the level, which is regenerated from its seed with bomb craters patched on, plus ack state and last inputs. Bounded in size, and it also serves resync and migration.
- **Refresh mid-match**: the player stays seated but `away` (auto-picks, forfeits placement, pops at GO, so nobody waits); on return they get the same slot, character, name and score.
- **Refresh in the lobby**: the player is removed but parked with their character; on return they're re-seated with the same look.
- **Join mid-match**: spectate until the next round boundary, then the host seats the peer's main device.

### Seats and kicks

- Connecting is joining: a peer asks for a seat without any input, repeating until seated, and the host seats it through the sequenced `join` action within a few frames, so every peer rolls the same character at the same frame.
- Every player's name and color differ. Rolls skip a clash, deterministically, and the host refuses a saved look or name someone here already has. Two tabs of one browser share a saved profile, so this happens in ordinary testing, and a refused look isn't saved over the profile.
- `kick` is a `NetAction`, so it exists only inside a host's bundle. Guests apply bundles from the host alone, and the host refuses `kick` as a request from a guest. It applies in the lobby only. `NetState.kicked` is replicated and snapshotted, so a new host keeps refusing the same peers. A kicked peer's tab remembers (`sessionStorage`) and goes straight to the main menu on refresh; one that gets past that is refused on `hello`, and never seated.

### Desync detection

Every 60 frames each guest hashes its confirmed state (FNV-1a over the canonical snapshot) and reports it. On a mismatch the host sends that guest a snapshot.

### Cross-browser determinism

IEEE-754 `+ - * /` and `Math.sqrt` are exact everywhere, but `Math.sin/cos/atan2/exp/pow/hypot/…` and `**` are implementation-approximated. `src/core/dmath.ts` has fdlibm ports built from exact operations only. `src/sim`, `src/gen` and `src/game` use them. `.oxlintrc.json` bans the `Math` functions there, with a message naming the replacement, and `tests/determinism-ban.test.ts` bans `**`, which lint can't see.

## HUD

`RoomConnection.hudInfo()` is `renderer.hud.net`: the status line, peers (crown, ping) and invite link in the lobby's online panel. `toast()` covers the states that freeze a race, because the panel only shows in the lobby. A guest waiting for the host shows `Joining…`, and a host gathering the room shows `Migrating Host…`. This text stays short: state what happened, and don't explain what's clear from the screen.

## Monitoring

`src/net` reports through `src/telemetry.ts`, never the SDK: `desync` (error, from the host), `host-migration` (warning, from the new host, so one per migration), `net-unavailable` (warning), and breadcrumbs for peers joining and leaving and for link changes. Names are fixed and variables go in `data`; they carry frames, hashes and peer ids, never player names, which players type themselves. The routes run on the Node runtime. A store failure is answered as a 503, so the route reports it itself, at most once a minute per instance, because an exhausted free tier would otherwise report every poll.

## Testing

- `tests/signal-handlers.test.ts`: the store (reply shapes, Upstash request format, either env pair), handlers (join order, TTLs, caps, validation, command costs) and the HTTP edge.
- `tests/webrtc-transport.test.ts`: the real transport, handlers and store over a fake RTC network and clock: linking, polling stopping, the measured budget, crash and goodbye migrations, double failure, flaky guests, rival hosts, resuming from the furthest frame.
- `tests/net.test.ts`, `tests/net-pick.test.ts`: lockstep under latency and loss, desync recovery, refresh, late join; claim races, pending cards, remote cursors and ghosts, the input codec.
- `tests/snapshot.test.ts`: round trips with items in play, prediction isolation, and a guard that fails until any new `Match` or `RunWorld` field is snapshotted or declared derived. `tests/dmath.test.ts`.
- `pnpm test:store`: the real Upstash REST code against real Redis behind [Serverless Redis HTTP](https://upstash.com/docs/redis/sdks/ts/developing) (`compose.store.yml`, Redis 6.2.21 and SRH 0.0.10, on port 8079). Every command the handlers use, reply parity with the in-memory store, TTL expiry, the join counter under a stampede, the handlers end to end. `-- --browser pick,run,leave` adds real browsers on the same store, with the app configured through the production env vars. Needs Docker, so it's a CI job rather than part of `pnpm check`. SRH needs `Content-Type: application/json` and differs from Upstash in edge cases, so handlers stick to plain commands.
- `pnpm online-test`: real WebRTC between headless Chromium pages, one context per peer, against the real routes with the in-memory store. Hosts are killed with a renderer crash (no pagehide, no goodbye) in pick, place and run; also a graceful leave, and a new host dying straight after taking over. Each prints seconds to recovery and compares state hashes.
- `pnpm online-test -- --only latency,hidden`: input-to-screen delay between pages, bundle cadence, stalls and teleports, at 0 and 40 ms each way, and with the host's tab hidden. Drawing is stubbed, because software GL would measure this machine. The delay and the hidden tab are simulated in the page (a delayed `RTCDataChannel.send`; `document.hidden`, no rAF, timers clamped to 1 Hz), since headless pages can't truly go hidden. The budget is loose enough for a loaded box: it catches regressions, not jitter.

**Not exercised by any of this:** the real Upstash service (SRH stands in for it), real NAT traversal (all pages share a machine and connect over host candidates), TURN, browsers other than Chromium, and real phones.

## Next steps

- **Full rollback for everyone**: the host could run a few frames of input delay so guests' inputs land on time more often.
- **Spectator UX**: a banner, and a choice of which local devices join.
- **Hand off host** from a hidden tab: a hidden host keeps ticking via a worker timer, but browsers may throttle it.
- **Snapshot compression** if rooms with many placed props get large.
