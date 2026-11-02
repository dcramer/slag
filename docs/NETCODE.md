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
  actions.ts            host-sequenced match actions (join/leave/away/name/look/salt/rules/kick) + replicated NetState
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

1. `setSignalBase('https://<hosted-app>')` before `mountGame`.
2. The API to accept its origin: `originAllowed` in `guard.ts` rejects a browser `Origin` that isn't the request's host, so add an allowlist there, and send `Access-Control-Allow-Origin` on replies. No preflight handling is needed: all requests are `text/plain` POSTs, which are CORS-simple by design. `sendBeacon` works the same way. Packaged origins can be `null` or a custom scheme (`capacitor://localhost`), so the allowlist has to match those literally.
3. A public origin for `inviteUrl` in `client.ts`, which uses `location.origin`.

## Signaling API

`POST /api/net/<op>`, JSON sent as `text/plain`. All ops take `room` and `peer`.

| Op | Does | Redis commands |
|---|---|---|
| `join` | Assign the next join order; returns the live members and ICE servers. One script. | 5–7 (an outdated session: 3) |
| `beat` | Renew liveness. Hosts also renew the room and learn the room's lowest order. | guest 1, host 3 |
| `poll` | Drain this peer's mailbox. | 1 |
| `signal` | Put a handshake in another peer's mailbox. | 5 |
| `members` | Live members in order. | 2–3 |
| `gone` | Report a peer that failed to answer an offer. | 5–8 |
| `leave` | Remove self, sent by `sendBeacon` on pagehide. One script. | 2–4 |

Keys, all with a TTL: `slag:<ROOM>:m` the member sorted set (300 s, renewed by the host), which also holds `#` scored with the last order handed out, `slag:<ROOM>:p:<peer>` liveness (50 s, renewed by `beat`), `slag:<ROOM>:b:<peer>` the mailbox (30 s).

The liveness value is the joining session's `since` stamp (ms, increasing per tab). One peer id can have two sessions in flight: a lobby that remounts, or a page reloaded while its join was on the way. A join older than the stamp held writes nothing, and a `leave` removes the entry only if no newer session wrote it, whatever order the store holds. A session closed before its join reply arrives sends a `leave` when the reply lands.

Joining and removing are Lua scripts (`app/api/net/_server/scripts.ts`), so each check and its write are one atomic step: plain commands would let the other session's write land in between. Scripts also serialize joins, so the next order is simply one above everything in the set, `#` included; no counter is needed. Upstash bills a script as one command plus one per call it makes, so the scripts cost no more than the pipelines they replaced. MemoryStore runs a TypeScript mirror of each script, making the same calls, and `pnpm test:store` checks the mirrors against the real Lua.

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
| Host | 12 (every 5 s, to admit newcomers) | 3 × 3 | **21** |
| Host, alone over 10 min | 4 | 9 | 13 |
| Host, alone and hidden over 10 min | 0 | 0 | **0** (leaves the room, rejoins when shown) |

So a 4-player room costs 30 commands a minute (about **8 per player per minute**) and an 8-player room 42 (about 5). Polling doubles its interval in a hidden tab.

**One-off costs:** a watcher stepping behind a player in the line (see Host election) is one more `join`, 5–7 commands. A join is about 60 commands (the join, offer and answer, guest polling while waiting, and the host polling every second for the next 30 s, so friends arriving together connect fast). A migration in a 3-peer room is about 125, a quarter of it the new host's rival checks (see Host election).

**In practice:** 500K commands is about 275 hours of 4-player rooms a month, or 9 hours a day, ignoring joins. Storage is irrelevant: a room is under a kilobyte. Function invocations follow the same curve (24 requests a minute for a 4-player room).

To stretch it, raise `POLL_IDLE_MS` in `webrtc-transport.ts`: it's the main cost, and it only trades how long a late joiner waits.

## The star

Connections are vanilla ICE: gather candidates, then send one offer and one answer with everything in them, so a connection costs two mailbox writes. Each link has two channels: `rel` (ordered, reliable) for control frames, snapshots and actions, and `rt` (unordered, no retransmits) for inputs and bundles, which the session already re-sends. Messages over 16 KB are split on `rel`, the size every browser agrees on.

STUN is public (Google, Cloudflare). Pairs that can't connect directly need TURN (`SLAG_ICE_SERVERS`); about 10–20% of pairs are expected to. Without it, a guest that gets an answer but can't open a channel after two tries drops to local play, showing `Cannot Reach Host`. It never evicts the healthy host.

### Identity and devices

- Each tab has a **peer id** (8 chars). It lives in `sessionStorage` (a refresh keeps it) plus a lease table in `localStorage` (a new tab takes the most recently used free id, so closing and reopening the link gets your seat back; two live tabs never share one).
- Match devices are namespaced `<peer>:<local device>` (`k3j9x2ab:kb1`), so one machine can seat several local players. Offline sessions keep raw ids.

### Host election and migration

Join order comes from the atomic join script: one above every order the room has handed out. The host is the lowest order present. A refresh or reconnect is a new join, so it gets a later order: the old host comes back as a guest.

**Watchers step behind players.** Everyone (the store's `head`, a newcomer's first offer, every election walk) agrees on "lowest order" without asking anyone, so the order itself must never put a watcher ahead of a player. A peer with no seat that has had a seated peer behind it for 2 s rejoins the order at the back (`NetSession.maybeReorder` → `Transport.reorder`): one `join` op for a later order, keeping every link. A guest sends the host an `o<order>` frame and the host pushes the roster, so every peer's next election skips it. A host doing it is no longer first, so it hands the room to the new head the way a host that finds a lower rival does (`yieldTo`), which is a migration. With only watchers left, the earliest of them hosts; once someone is seated behind it, it steps back and hands the room over. At most once per 10 s per peer.

The host owns the **roster** and pushes it to every guest. When the host dies the guests have no links to each other, so nobody can ask anyone anything. Each peer works it out alone:

1. **Detect.** A data channel closing, the connection failing, or 2.5 s without a heartbeat (sent every 500 ms on `rt`). A goodbye frame skips straight to step 3. If our own timers stalled over 2 s (a background tab, a laptop waking), we don't blame anyone.
2. **Check.** Polling wakes immediately, to every 400 ms. The peer re-offers to the old host and, at the same time, to the next in line. A live host answers: it noticed the same silence and woke its own polling, so a flaky guest reconnects without moving the room. The next in line holds off as a candidate, until the old host misses its 4 s window or until another peer's offer shows that it lost the host too, which is proof enough to take over at once.
3. **Agree.** Every peer takes the lowest order in its last roster that it doesn't believe dead. A candidate that doesn't answer inside 5 s of an offer landing is presumed dead too, and the walk continues, so a lower peer leaving at the same moment, or the new host dying straight after taking over, ends on the same peer for everyone. A peer that has it wrong answers an offer with a redirect.
   - **Proof works both ways.** A peer with no host that gets an offer from someone behind it in the roster takes over at once: the sender only offers there once it can't reach anyone ahead, and neither can we. Without this, a peer still waiting out its own handshake (one that was answered and then never opened costs 6 s and a retry) can't answer in time, the one behind writes it off and hosts, and the room splits. That was the double-failure split brain.
   - **A handshake that stalls mid-migration** (answered, not open after 2 s, or answered and then failed) may be with a peer that died right after answering, so the peer also offers to whoever is next, the same way a probe does. Two peers stuck on the same dead host find each other this way in a couple of seconds instead of 12.
4. **Resume.** The new host pauses and keeps the expected guests in the roster as `linking`, so nobody is marked away while they re-signal. Each guest's `hello` says the furthest frame it holds. The old host's last bundles may have reached only some peers, so the new host pulls a snapshot from the furthest one, then syncs everyone to it. Inputs that were in flight never made a bundle, so they never happened, on every peer alike: that can't desync. After 6 s it stops waiting for anyone missing.
5. **The old host's player** is treated like any dropped player: `away` mid-match, removed from the lobby.

Only peers that failed an offer get reported to the store, and a report names the exact session (`order`), so a late report can't remove someone who has already refreshed.

Both windows run from when the offer lands, not from when we started. A handshake can take several seconds (a poll interval, ICE gathering on both sides, store round trips), and calling a slow peer dead is how a second host appears.

If two peers end up hosting anyway (say one lost the API at the wrong moment and the other wrote it off, or two guests lost a live host at once, which looks exactly like it dying), the store settles it, deterministically and within seconds: the lowest order the store still holds wins. A host that was written off is gone from the store, so `beat` tells it so and it rejoins later in the order; `beat` also tells a host the room's lowest order. Either way the higher host hands its guests to the lower one at once. A host normally beats every 20 s, which is too slow for this, so for 12 s after taking over, after losing a guest without a goodbye, or after its API comes back, it beats every 2 s (about 18 commands each time).

An empty room needs nothing: the next arrival is host. If this browser saved the room's state in the last 30 minutes, on an earlier visit, it resumes it (never a save from this visit: a page saves while its join is in flight, and resuming that would rewind its own lobby), unless a generator change since then means this build can't rebuild that level, in which case the room starts fresh.

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

Prediction can't know a jump or a turn is coming, so remote runners are wrong for a round trip and then corrected. Drawn straight, a late jump teleports about 50 px at 100 ms. Instead each runner carries on from where it was drawn and the error bleeds away over a few frames, unless it's so large it must be a respawn. "Carries on" means at the speed it really moves, not the speed it's trying to: a runner held up by bodies barely moves however hard it walks, and a rider moves with its base (`drawnVelocity`), or pushers would be drawn inside who they push and riders behind their base. This only touches the view copy, which is rebuilt from confirmed state every update and never stepped, so it can't affect determinism.

### Pick and place

`Player.cursor`, `claim` and `rot` are match state, so every peer sees every cursor, card hover and ghost part, with its rotation and valid/invalid colour. Rendering isn't filtered to the local player.

- **Cursors are presentation-corrected, never predicted into the sim.** The view in pick and place is a copy of the confirmed match that is never stepped: a guest's own cursor runs ahead through its unacked inputs, so it doesn't lag a round trip, and remote cursors glide between bundles. Mouse positions cross the wire only when they move, keyboard and gamepad cursors as held buttons, so an idle peer costs nothing and a held direction keeps moving.
- **Claims are never predicted.** A click marks the card pending (`pendingCard`, a highlight only) until the host's bundle rules on it. The first click the host sequences wins; two in one frame go to the lower slot; everyone gets the same answer at the same frame, so a loser never sees a claim revoked. The timeout hand-out is seeded from the match, at a sequenced frame, so it agrees too.

### Joining and reconnecting

- **Join / reconnect**: a guest says `hello`; the host replies with a **snapshot**: the whole Match minus the level, which is regenerated from its seed and profile with bomb craters patched on, plus ack state and last inputs. Bounded in size, and it also serves resync and migration. Spawn, goal and set pieces come from that regeneration, so a peer refuses a snapshot whose tiles aren't its own level plus craters: tiles from another build's generator would put the ring and flag on terrain the runners aren't on.
- **Refresh mid-match**: the player stays seated but `away` (auto-picks, holds up nobody, pops at GO); on return they get the same slot, character, name and score.
- **Refresh in the lobby**: the player is removed but parked with their character; on return they're re-seated with the same look.
- **Join mid-match**: watch (see Seats and observers), and Join for a seat at the next round boundary.

### Seats and observers

A peer with no seat is an **observer**. It holds the whole match like anyone and renders it, and it sends **no input**: a guest without a seat puts nothing in its unacked list and sends an `in` message only to carry a request or its state hash. The host drops any frames one sends anyway and keeps no queue for it, so the lockstep can't wait on it and its keys can't seat it. Snapshots, resyncs and desync hashes work for it as for anyone.

- `NetState.watching` (replicated, snapshotted with the rest of `NetState`) is who watches: peer → `{name, afk?}`. The `watch` action adds a peer (its seats go at once in the lobby, or are marked `Player.leaving` mid-match and dropped as the round is scored, or as the next round deals if chosen on the score screen) or removes it. A watch link (`?watch`), a peer arriving mid-match, and an arrival to a full lobby send `watch` themselves; the host sends it for an idle player (`afk`). A refresh keeps it, since the peer id survives one. Entries outlive peers that never come back, so the oldest past 16 are dropped.
- **Join is a `seat` action**, sequenced by the host like any other, so a race for the last seat is decided by the host's order and every peer applies the same answer at the same frame. With a seat free (`freeSeats`: 8 minus players not leaving, minus `NetState.queue`) it seats the peer at once in a seat phase (lobby, score, victory) or appends it to `NetState.queue` mid-round; with none it does nothing. The asker reads the answer from its own state once the request is acked (acks ride in the bundle that applied it): seated or queued is `won`, otherwise `taken`, which puts it back to watching. A second request from a peer seated or queued is a no-op. A request is resent until acked, to whichever host there is, so one in flight across a migration is decided by the new host, and one the old host's last bundle already applied is acked by the state the new host resumes from: never twice. At the round boundary the host seats `queue` in order (host-issued `join` actions); a queued peer that left is dropped with `seat {on: false}`.
- An arrival in the lobby is still seated without asking (`wants`, reconciled every 6 ticks), the only seating that isn't a request.
- `kick` removes watchers as well as players (lobby only), and drops them from `watching` and `queue`.

### Idle players and soft disconnects

The host never waits for input: a guest's empty queue repeats its held buttons for a hiccup. After 60 host ticks (1 s) with nothing queued, the peer is **soft-disconnected**: the host lets go of its buttons, so a frozen tab, a phone the OS paused or a link that hasn't timed out yet doesn't keep running its runner into whatever is ahead. Nothing else changes until the link itself drops (2.5 s of silence, then 5 s of grace, then `away`), or until the idle rules below take over.

Idleness is in the sim, from inputs alone, so every peer agrees: `Player.lastInput` is the frame of the player's last input (any button, or the pointer moving), and `Match.idleFrames` counts from it or from the phase's start, whichever is later. 30 s of that in an untimed pick, an untimed place or a race with no timer (60 s in the lobby) sets `Player.afk`, which is treated like `away` (auto-pick, not waited for, popped at GO, not blocking Ready) until the next input clears it. Online, the host moves a peer whose every player is AFK to the watchers (`watch` with `afk`): at once in the lobby, mid-match once `Player.afkRounds` (rounds in a row ended AFK) reaches 2, and that peer's next local input sends Join itself (`settleIntent`). A tab that comes back after a long freeze asks for the bundles it missed, or a snapshot past the host's 10 s history.

### Brief drops

A guest whose link drops without a goodbye keeps its seat for 5 s, `linking`, while it re-offers: a stalled tab or a Wi-Fi blip shouldn't cost anyone anything. Past that it's `away`. Being away doesn't forfeit a placement, it only stops the phase waiting: a player who returns in time can still place. A goodbye skips the grace.

### Seats and kicks

- Connecting is joining: a peer asks for a seat without any input, repeating until seated, and the host seats it through the sequenced `join` action within a few frames, so every peer rolls the same character at the same frame. The seat is for the device in hand when the peer asks (`primaryDevice` is read then): a phone only knows touch is its input once the page is up.
- Every player's name and color differ. Rolls skip a clash, deterministically, and the host refuses a saved look or name someone here already has. Two tabs of one browser share a saved profile, so this happens in ordinary testing, and a refused look isn't saved over the profile.
- `kick` is a `NetAction`, so it exists only inside a host's bundle. Guests apply bundles from the host alone, and the host refuses `kick` as a request from a guest. It applies in the lobby only. `NetState.kicked` is replicated and snapshotted, so a new host keeps refusing the same peers. A kicked peer's tab remembers (`sessionStorage`) and goes straight to the main menu on refresh; one that gets past that is refused on `hello`, and never seated.

### Desync detection

Every 60 frames each guest hashes its confirmed state (FNV-1a over the canonical snapshot) and reports it. On a mismatch the host sends that guest a snapshot.

### Cross-browser determinism

IEEE-754 `+ - * /` and `Math.sqrt` are exact everywhere, but `Math.sin/cos/atan2/exp/pow/hypot/…` and `**` are implementation-approximated. `src/core/dmath.ts` has fdlibm ports built from exact operations only. `src/sim`, `src/gen` and `src/game` use them. `.oxlintrc.json` bans the `Math` functions there, with a message naming the replacement, and `tests/determinism-ban.test.ts` bans `**`, which lint can't see.

## HUD

`RoomConnection.hudInfo()` is `renderer.hud.net`: the status line, peers (crown, ping) and invite link in the lobby's online panel, the watcher chips, this peer's seat (`seated`, `leaving`, `queued`, `watching`), the free seats, and `arrival`: the joining screen while a page that has never been in the room connects (after 350 ms, so a fresh room of our own doesn't flash it), or the failed room (`cutOff`). The join card's state is the game client's; only its Join reaches the session. `toast()` covers the states that freeze a race, because the panel only shows in the lobby. Every one is bad news, so it's drawn amber with a warning glyph, never the success check. A guest waiting for the host shows `Joining…`, and a host gathering the room shows `Migrating Host…`. A guest that can't load the host's snapshot (another build: `SNAP_VERSION`, or terrain its generator doesn't make) shows `Different Version · Reload`, goes `OFFLINE` in the panel with no seats drawn (its lobby is its own, and nothing pressed there reaches anyone), and asks again only every 10 s, since each ask costs the host a whole snapshot. This text stays short: state what happened, and don't explain what's clear from the screen.

## Monitoring

`src/net` reports through `src/telemetry.ts`, never the SDK: `desync` (error, from the host), `host-migration` (warning, from the new host, so one per migration), `net-unavailable` (warning), `snapshot-refused` (warning, once a page, from a guest on another build), and breadcrumbs for peers joining and leaving and for link changes. Names are fixed and variables go in `data`; they carry frames, hashes and peer ids, never player names, which players type themselves. The routes run on the Node runtime. A store failure is answered as a 503, so the route reports it itself, at most once a minute per instance, because an exhausted free tier would otherwise report every poll.

## Testing

- `tests/signal-handlers.test.ts`: the store (reply shapes, Upstash request format, either env pair), handlers (join order, TTLs, caps, validation, command costs) and the HTTP edge.
- `tests/webrtc-transport.test.ts`: the real transport, handlers and store over a fake RTC network and clock: linking, polling stopping, the measured budget, crash and goodbye migrations, double failure (including a candidate still settling its own stalled handshake, and a dead peer's handshake hanging as it does in a browser), flaky guests, rival hosts stepping down within seconds, resuming from the furthest frame. Seeded runs over API latency, handshake behaviour and crash timing check that a double failure always lands on the third peer with never two hosts, and that a split caused by flaky guests is over within 5 s.
- `tests/net.test.ts`, `tests/net-pick.test.ts`: lockstep under latency and loss, rough play (four peers, three rounds through weather, deaths, grabs and contact, the host's link cut mid-race), desync recovery, seats, kicks, refresh, late join, a guest on another build; claim races, pending cards, remote cursors and ghosts, the input codec.
- `tests/net-seats.test.ts`: a watch-link observer never seated, sending nothing, frozen without holding the room up, with the same state; Watch in the lobby and mid-match (out at the boundary); a full lobby making watchers, and Join answered `taken` while full; two watchers racing for the last seat; a request in flight across a migration; watchers stepping behind players so a migration skips them, and one hosting when only watchers are left; an idle lobby player moved to the watchers and back by input; a frozen guest's held buttons let go, its runner giving up, and its state agreeing after. `tests/idle.test.ts`: every wait point of the idle rules in the sim. `tests/webrtc-transport.test.ts` adds the reorder over the real transport: a crash skips the watcher, and a host who starts watching hands the room on.
- `tests/snapshot.test.ts`: round trips with items in play, prediction isolation, and a guard that fails until any new `Match` or `RunWorld` field is snapshotted or declared derived. `tests/dmath.test.ts`.
- `pnpm test:store`: the real Upstash REST code against real Redis behind [Serverless Redis HTTP](https://upstash.com/docs/redis/sdks/ts/developing) (`compose.store.yml`, Redis 6.2.21 and SRH 0.0.10, on port 8079). Every command the handlers use, reply parity with the in-memory store, the presence scripts as real Lua against their mirrors, TTL expiry, join order under a stampede, two sessions of one peer racing, the handlers end to end. `-- --browser pick,run,leave` adds real browsers on the same store, with the app configured through the production env vars. Needs Docker, so it's a CI job rather than part of `pnpm check`. SRH needs `Content-Type: application/json` and differs from Upstash in edge cases, so handlers stick to plain commands and plain Lua (`EVAL`, no `EVALSHA` or functions).
- `pnpm online-test`: real WebRTC between headless Chromium pages, one context per peer, against the real routes with the in-memory store. Hosts are killed with a renderer crash (no pagehide, no goodbye) in pick, place and run, and in a race with no third peer (`duo`); also a graceful leave, and a new host dying straight after taking over (`twice`: about 8 s from the first crash, 4 s from the second). Each prints seconds to recovery and compares state hashes. With a third peer a crash recovers in about 4 s, since its offer proves the host is gone; alone, the guest waits out the old host's whole answer window, about 7.5 s (2.5 s of silence, the offer landing, then `PROBE_MS`).
- `pnpm online-test -- --only view`: real mouse events at four window shapes on classic, wide and tall levels. The card under the pointer is the one taken, and the cursor and ghost sit under it on both peers. Cursors are view px in `pick` and world px in `place`, mapped through `overview`, so a test or HUD that treats them alike is wrong on anything but a 1:1 level.
- `pnpm online-test -- --only seats`: `observe` (host, guest, a desktop and a phone watcher through a round; a frozen watcher; then a late joiner mid-race clicks Join and the card's Join and is seated at the boundary), `seatrace` (seven seated, two watchers Join for the last seat at once; then a player leaves and the loser's Join works), `idle` (a guest's tab hidden through an untimed pick and race: handed a card, its runner gives up, it agrees once shown).
- Groups, each runnable alone on a loaded machine: `--only lobby`, `migration`, `feel`, `misc`, `seats`. The other scenarios (`flow`, `kick`, `refused`, `play`, `bc`, `unset`) are listed at the top of `tools/online-test.ts`. Scenarios that don't check pixels stub their drawing, since software GL otherwise measures the machine.
- `pnpm online-test -- --only contact`: two runners out of the spawn zone, one shoving the other and then one riding the other, at 40 ms each way: the guest must draw no teleport, no pusher inside who it pushes, and no rider sliding on its base.
- `pnpm online-test -- --only latency,hidden`: input-to-screen delay between pages, bundle cadence, stalls and teleports, at 0 and 40 ms each way, and with the host's tab hidden. The delay and the hidden tab are simulated in the page (a delayed `RTCDataChannel.send`; `document.hidden`, no rAF, timers clamped to 1 Hz), since headless pages can't truly go hidden. The budget is loose enough for a loaded box: it catches regressions, not jitter.

**Not exercised by any of this:** the real Upstash service (SRH stands in for it), real NAT traversal (all pages share a machine and connect over host candidates), TURN, browsers other than Chromium, and real phones.

## Next steps

- **Full rollback for everyone**: the host could run a few frames of input delay so guests' inputs land on time more often.
- **Local devices for a Join**: a watcher's Join seats its main device; a second local player joins once seated, in the lobby.
- **Hand off host** from a hidden tab: a hidden host keeps ticking via a worker timer, but browsers may throttle it.
- **Snapshot compression** if rooms with many placed props get large.
