# Online play

A room is its URL, `/r/<CODE>`. Everyone who opens the same link is in the same match. There is no matchmaking; public rooms are on the lobby list (see Lobby list), Private ones only reach people through their link.

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
  _server/report.ts     store-failure reports: tags and the once-a-minute throttle
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
| `beat` | Renew liveness. Hosts also renew the room and learn the room's lowest order, and list the room (see Lobby list). | guest 1, host 3; listing 6 (8 when newly listed); going Private 5 |
| `poll` | Drain this peer's mailbox. | 1 |
| `signal` | Put a handshake in another peer's mailbox. | 5 |
| `members` | Live members in order. It never prunes: a prune after reading liveness could drop a peer rejoining in between; `join` prunes, inside its script. | 2 |
| `gone` | Report a peer that failed to answer an offer. | 5–8 |
| `leave` | Remove self, sent by `sendBeacon` on pagehide. One script; a listed host's also takes the room off the list. | 2–4; a listed host 6 |
| `lobbies` | The lobby list. Takes no room or peer. | 1–2 |

Keys, all with a TTL: `slag:<ROOM>:m` the member sorted set (300 s, renewed by the host), which also holds `#` scored with the last order handed out, `slag:<ROOM>:p:<peer>` liveness (50 s, renewed by `beat`), `slag:<ROOM>:b:<peer>` the mailbox (30 s), `slag:<ROOM>:l` the room's listing (50 s, renewed by the host's beat), and one key for every room, `slag:lobbies`, the lobby index (a day, renewed whenever a room is newly listed).

The liveness value is the joining session's `since` stamp (ms, increasing per tab). One peer id can have two sessions in flight: a lobby that remounts, or a page reloaded while its join was on the way. A join older than the stamp held writes nothing, and a `leave` removes the entry only if no newer session wrote it, whatever order the store holds. A session closed before its join reply arrives sends a `leave` when the reply lands.

Joining and removing are Lua scripts (`app/api/net/_server/scripts.ts`), so each check and its write are one atomic step: plain commands would let the other session's write land in between. Scripts also serialize joins, so the next order is simply one above everything in the set, `#` included; no counter is needed. Upstash bills a script as one command plus one per call it makes, so the scripts cost no more than the pipelines they replaced. MemoryStore runs a TypeScript mirror of each script, making the same calls, and `pnpm test:store` checks the mirrors against the real Lua.

### Lobby list

The Lobbies screen (main menu → Lobbies, `src/ui/screens/lobbies.ts`) lists public rooms. Lobbies are public by default; the host's **Private** rule (the rules card's Lobby row, a `MatchRules` field synced by the `rules` action like the others, never saved with the host's preferences) keeps a room off it.

- **Written by the host's beat.** A host's `beat` carries the room's listing (`NetSession.listing()`: seats taken of `max`, peers watching, the level's theme, the phase, and the host's name: its first player's, or the one it watches under), and the beat becomes one script (`LIST_BEAT` in `scripts.ts`): renew as before, then, only if the session is still alive, score the room in `slag:lobbies` with the time and write its listing to `slag:<ROOM>:l`. The alive check is why it's a script: a beat landing after its own leave, or after the host was written off, must not list a room nobody hosts. The API checks every listing (`cleanListing`); one that fails is ignored, not the beat. The host's name is a stranger's text shown to strangers: the API tidies it (`tidyName` in `src/core/name.ts`: control and format characters out, whitespace collapsed, trimmed, capped at `NAME_MAX`) and drops just the name when nothing is left or the name filter refuses it (`nameBlocked`), and the screen only ever sets it as text. It rides in the same JSON, so it costs no command.
- **Kept fresh between beats.** The transport lists again within `LIST_NUDGE_MS` (5 s) when what a browser would see changes (seats, watchers, theme, the host's name, lobby or match), so a seat filling shows in seconds. A new host lists the room at once, under its own name. Going Private beats at once with `list: false`, which takes the room off; Private beats never list it.
- **Off the list.** A listed host's `leave` takes the room off in the same script that removes it (`REMOVE` with the index keys); if anyone is left, the next host lists it again at once. A room whose host stops beating falls out by itself: readers take only rooms beaten within `LIST_TTL_S` (50 s, the host's own liveness), well inside `ROOM_EMPTY_MS`, and the listing key expires with it. Index entries such rooms leave are pruned whenever a room is newly listed.
- **Read.** `lobbies` is one range (`ZREVRANGEBYSCORE`, newest first, at most `MAX_LISTED`) and one `MGET` of the listings. Each function instance answers it from one read for 2 s (`_server/cache.ts`), so the store pays per instance, not per browser. The screen polls every `LIST_POLL_MS` (5 s) while shown and not at all while hidden.
- **Joining** from the list is the invite link's way in, through the joining screen. Join lists rooms with a seat (seated at once in a lobby, watching with Join mid-match); Watch lists full rooms and arrives watching, as `?watch` does.

### Abuse limits

The routes are public and unauthenticated: knowing a room code and a peer id is all a caller needs, so someone in a room can disrupt that room. Limits keep it to that:

- Room codes and peer ids are validated by regex before any Redis command runs.
- Bodies are capped at 20 KB, SDP at 16 KB, mailboxes at 16 messages, rooms at `MAX_PEERS` (`MAX_PLAYERS` + 4 spectators; the host also refuses offers past it).
- Handshakes go only between current members. `gone` needs a current member and the target's exact order.
- Browsers from other origins are refused. A per-client, per-instance limit (600 requests a minute) stops loops without spending Redis commands; it isn't protection against a determined caller, which is the Vercel Firewall's job.
- The free tier is a hard cap: running out stops online play, it doesn't bill. Already-linked games don't need the API and keep playing.

## Budget

Upstash's free tier is 500K commands a month and 250 MB. Blocking commands aren't available over REST, so everything is short polling. The store always POSTs command arrays to `/pipeline` with a bearer token, the form `@upstash/redis` uses, so the same code runs against Upstash and SRH. `tests/signal-handlers.test.ts` pins the cost of each op, and `tests/webrtc-transport.test.ts` measures a playing room.

**Commands per minute, steady state with links up** (a Private room; a public one adds the listing below):

| Who | Polls | Heartbeats | Total |
|---|---|---|---|
| Guest | 0 (polling stops once linked) | 3 × 1 | **3** |
| Host | 12 (every 5 s, to admit newcomers) | 3 × 3 | **21** |
| Host, alone over 10 min | 4 | 9 | 13 |
| Host, alone and hidden over 10 min | 0 | 0 | **0** (leaves the room, rejoins when shown) |

So a Private 4-player room costs 30 commands a minute (about **8 per player per minute**) and an 8-player room 42 (about 5). Polling doubles its interval in a hidden tab.

**The lobby list:** listing a room costs 3 more commands a host beat (6 instead of 3), 9 a minute, so a public 4-player room costs 39 (about 10 per player per minute); a change worth showing between beats costs one more beat (6), at most every 5 s. Reading the list costs 2 commands a poll (1 when nothing is listed), at most once per function instance every 2 s however many people browse, so one person browsing costs at most 24 a minute. The read path never writes.

**One-off costs:** a watcher stepping behind a player in the line (see Host election) is one more `join`, 5–7 commands. A join is about 60 commands (the join, offer and answer, guest polling while waiting, and the host polling every second for the next 30 s, so friends arriving together connect fast). A migration in a 3-peer room is about 125, a quarter of it the new host's rival checks (see Host election).

**In practice:** 500K commands is about 275 hours of Private 4-player rooms a month, or 9 hours a day, ignoring joins; listed, about 215 hours, or 7 a day. Storage is irrelevant: a room is under a kilobyte. Function invocations follow the same curve (24 requests a minute for a 4-player room).

To stretch it, raise `POLL_IDLE_MS` in `webrtc-transport.ts`: it's the main cost, and it only trades how long a late joiner waits.

## The star

Connections are vanilla ICE: gather candidates, then send one offer and one answer with everything in them, so a connection costs two mailbox writes. Each link has two channels: `rel` (ordered, reliable) for control frames, snapshots and actions, and `rt` (unordered, no retransmits) for inputs and bundles, which the session already re-sends. Messages over 16 KB are split on `rel`, the size every browser agrees on.

STUN is public (Google, Cloudflare). Pairs that can't connect directly need TURN (`SLAG_ICE_SERVERS`); about 10–20% of pairs are expected to. Without it, a guest that gets an answer but can't open a channel after two tries drops to local play, showing `Cannot Reach Host`. It never evicts the healthy host.

### Identity and devices

- Each tab has a **peer id** (8 chars). It lives in `sessionStorage` (a refresh keeps it) plus a lease table in `localStorage` (a new tab takes the most recently used free id, so closing and reopening the link gets your seat back; two live tabs never share one).
- Match devices are namespaced `<peer>:<local device>` (`k3j9x2ab:kb1`), so one machine can seat several local players. Offline sessions keep raw ids.

### Host election and migration

Join order comes from the atomic join script: one above every order the room has handed out. The host is the lowest order present. A refresh or reconnect is a new join, so it gets a later order: the old host comes back as a guest.

**Watchers step behind players.** Everyone (the store's `head`, a newcomer's first offer, every election walk) agrees on "lowest order" without asking anyone, so the order itself must never put a watcher ahead of a player. A peer with no seat that has had a seated peer behind it for 2 s rejoins the order at the back (`NetSession.maybeReorder` → `Transport.reorder`): one `join` op for a later order, keeping every link. A guest sends the host an `o<order>` frame and the host pushes the roster, so every peer's next election skips it. A host doing it is no longer first, so it hands the room to the first guest in its roster (`handOn` → `yieldTo`), which is a migration. It waits while the room is settling: a guest in its grace may be alive and next in line (passing it over left it hosting alone), and a newcomer mid-handshake should land first and move with everyone. Never to the store's lowest order: that may be a guest that died without a goodbye, which the store lists until its liveness runs out. The handover frame (`m<id>`) gets a second before the old links close, since `RTCPeerConnection.close()` can drop what it hasn't sent; if it's lost anyway, the old host's offer from behind the next in line is taken as the handover it is (never as proof it died, and the guests who reach the new host don't write it off), and offers that reached the old host while it had no host are redirected on once it links. With only watchers left, the earliest of them hosts; once someone is seated behind it, it steps back and hands the room over. At most once per 10 s per peer.

The host owns the **roster** and pushes it to every guest. When the host dies the guests have no links to each other, so nobody can ask anyone anything. Each peer works it out alone:

1. **Detect.** A data channel closing, the connection failing, or 2.5 s without a heartbeat (sent every 500 ms on `rt`). A goodbye frame skips straight to step 3. If our own timers stalled over 2 s (a background tab, a laptop waking), we don't blame anyone.
2. **Check.** Polling wakes immediately, to every 400 ms. The peer re-offers to the old host and, at the same time, to the next in line. A live host answers: it noticed the same silence and woke its own polling, so a flaky guest reconnects without moving the room. The next in line holds off as a candidate, until the old host misses its 4 s window or until another peer's offer shows that it lost the host too, which is proof enough to take over at once.
3. **Agree.** Every peer takes the lowest order in its last roster that it doesn't believe dead. A candidate that doesn't answer inside 5 s of an offer landing is presumed dead too, and the walk continues, so a lower peer leaving at the same moment, or the new host dying straight after taking over, ends on the same peer for everyone. A peer that has it wrong answers an offer with a redirect.
   - **Proof works both ways.** A peer with no host that gets an offer from someone behind it in the roster takes over at once: the sender only offers there once it can't reach anyone ahead, and neither can we. Without this, a peer still waiting out its own handshake (one that was answered and then never opened costs 6 s and a retry) can't answer in time, the one behind writes it off and hosts, and the room splits. That was the double-failure split brain.
   - **A handshake that stalls mid-migration** (answered, not open after 2 s, or answered and then failed) may be with a peer that died right after answering, so the peer also offers to whoever is next, the same way a probe does. Two peers stuck on the same dead host find each other this way in a couple of seconds instead of 12.
4. **Resume.** The new host pauses and keeps the expected guests in the roster as `linking`, so nobody is marked away while they re-signal. Each guest's `hello` says the furthest frame it holds. The old host's last bundles may have reached only some peers, so the new host pulls a snapshot from the furthest one, then syncs everyone to it; if that peer leaves or doesn't answer within 1.5 s, the next furthest, so nobody ahead of the new host is rewound. A peer that has hosted others counts as on the timeline, so a host that steps aside reports its own frame (it's usually the furthest). A peer already on the timeline doesn't emit again the events of frames it simulated, predicted ones included. Inputs that were in flight never made a bundle, so they never happened, on every peer alike: that can't desync. After 6 s it stops waiting for anyone missing.
5. **The old host's player** is treated like any dropped player: `away` mid-match, removed from the lobby.

Only peers that failed an offer get reported to the store. An offer that never reached the store (our API was out) is sent again every second, and one whose window ran out while we couldn't read our mail is asked again: neither says anything about the peer. The store says which side is missing when it can't deliver: a sender it forgot (liveness lapsed while a phone slept) rejoins and resends, rather than take its healthy host for dead. A report names the exact session (`order`), so a late report can't remove someone who has already refreshed.

Both windows run from when the offer lands, not from when we started. A handshake can take several seconds (a poll interval, ICE gathering on both sides, store round trips), and calling a slow peer dead is how a second host appears.

**The old host fences itself.** Two guests that lose a live host at once (its network blinked, its tab stalled) see exactly what they would if it had died: one's offer is the other's proof, and they elect a new host. So a host that hasn't heard from two or more of its guests for `QUIET_MS` (1.8 s), or has lost them, freezes: `Reconnecting…`, no frames, but still answering offers. Every live guest speaks at least once a second, and 1.8 s plus a watch tick is under the 2.5 s of silence a guest waits, so the host is frozen before any guest can suspect it. It plays on once each of those guests is heard again or relinks; one that never comes back is waited on for `FENCE_HOLD_MS` (7 s, past the point where a guest that wrote it off has told the store), and then the host plays on only if a beat begun after that says it still holds the room. Written off, it steps down as below. So two peers can each think they host for a few seconds, but only one ever advances the sim, and the frozen one adopts the room's state when it joins. A host with one guest never fences: a lone guest needs the host to miss a whole probe window before it takes over.

If two peers end up hosting anyway (say one lost the API at the wrong moment and the other wrote it off, or the fenced host above was written off), the store settles it, deterministically and within seconds. Every takeover writes off the peers ahead of it, so one of the two hosts is gone from the store: `beat` tells it so, it rejoins later in the order, and it hands its guests to the lowest order the store holds. A host the store still holds doesn't yield to a lower order on the store's word alone: a guest that crashed (a phone killed in the background) stays listed for up to 50 s, and following it moved the room to nobody, through two more migrations. It yields at once only with nobody linked or expected (nothing to lose), and otherwise once that order has stayed listed past a ghost's liveness (`RIVAL_PROVEN_MS`, 60 s), which only a live peer does: a backstop for a split nothing wrote off. A host normally beats every 20 s, which is too slow for this, so for 12 s after taking over, after losing a guest without a goodbye, or after its API comes back, it beats every 2 s (about 18 commands each time).

An empty room needs nothing: the next arrival is host. If this browser saved the room's state within `ROOM_EMPTY_MS` (60 s, `signal-protocol.ts`: the one definition of a room being over, for the resume and any room list), on an earlier visit, it resumes it (never a save from this visit: a page saves while its join is in flight, and resuming that would rewind its own lobby), unless a generator change since then means this build can't rebuild that level, in which case the room starts fresh.

If signaling fails while links are up, nothing happens: only a host that has lost its guests too reports `reconnecting`, and it freezes rather than fork the room.

**Measured** on one machine with software GL and a loaded CPU, by `pnpm online-test`: see Testing.

## Netcode

The sim is a pure function of `(seed, per-frame inputs)`, so **inputs and host-sequenced actions are the only per-frame data on the wire**. Snapshots go out only for joins, resyncs and migration.

### Lockstep (host-sequenced)

- Ticks don't depend on animation frames. Online, a worker's timer drives them, because a page that's hidden or slow to draw would otherwise hold up everyone waiting on it.
- A snapshot acks only actions a bundle has applied: one sequenced since isn't in the state it carries, and acking it would have the asker read its answer from a state without it.
- Every tick (60 Hz), each guest samples its devices, appends the frame to its *unacked* list, and sends **all** unacked frames to the host. Redundancy makes loss harmless.
- The host consumes one queued frame per guest per tick. If a guest's queue runs dry it repeats held buttons, with no edges. More than two frames waiting are folded together (edges OR-ed): the host only eats one a tick, so a queue left alone never drains, and each frame in it is 17 ms of lag for everyone.
- The host stamps `{frame, inputs, actions, ack deltas}` into a **bundle**, applies it, and broadcasts every tick, repeating the previous bundle so a lost packet costs nothing. Guests apply bundles strictly in frame order, the moment they arrive. A gap triggers `need`, and the host resends from its 10 s history or sends a snapshot.
- Discrete changes (seat a rejoiner, drop a leaver, mark away, rename, a saved look, rules, the crate salt) are **actions** in bundles, applied by everyone at the same frame.
- Sequence numbers start at wall-clock ms, so a refreshed page always counts higher than its old self.

### Prediction (races)

The host plays with zero input delay. A guest renders a predicted copy: the confirmed state stepped forward with its unacked inputs, others holding their last known buttons. New bundles rebuild it from the confirmed state (rollback + re-simulate, at most 24 frames). Events are emitted the first time a frame is simulated, never twice.

Prediction can't know a jump or a turn is coming, so remote runners are wrong for a round trip and then corrected. Drawn straight, a late jump teleports about 50 px at 100 ms. Instead each runner carries on from where it was drawn and the error bleeds away over a few frames, unless it's so large it must be a respawn. "Carries on" means at the speed it really moves, not the speed it's trying to: a runner held up by bodies barely moves however hard it walks (`drawnVelocity`), or pushers would be drawn inside who they push. A head is a perch, not ground, so a rider isn't carried and is drawn by its own speed alone. This only touches the view copy, which is rebuilt from confirmed state every update and never stepped, so it can't affect determinism.

### Pick and place

`Player.cursor`, `claim` and `rot` are match state, so every peer sees every cursor, card hover and ghost part, with its rotation and valid/invalid colour. Rendering isn't filtered to the local player.

- **Cursors are presentation-corrected, never predicted into the sim.** The view in pick and place is a copy of the confirmed match that is never stepped: a guest's own cursor runs ahead through its unacked inputs, so it doesn't lag a round trip, and remote cursors glide between bundles. Mouse positions cross the wire only when they move, keyboard and gamepad cursors as held buttons, so an idle peer costs nothing and a held direction keeps moving.
- **Claims are never predicted.** A click marks the card pending (`pendingCard`, a highlight only) until the host's bundle rules on it. The first click the host sequences wins; two in one frame go to the lower slot; everyone gets the same answer at the same frame, so a loser never sees a claim revoked. The timeout hand-out is seeded from the match, at a sequenced frame, so it agrees too.

### Joining and reconnecting

- **Join / reconnect**: a guest says `hello`; the host replies with a **snapshot**: the whole Match minus the level, which is regenerated from its seed and profile with bomb craters patched on, plus ack state and last inputs. Bounded in size, and it also serves resync and migration. Spawn, goal and set pieces come from that regeneration, so a peer refuses a snapshot whose tiles aren't its own level plus craters: tiles from another build's generator would put the ring and flag on terrain the runners aren't on.
- **Refresh mid-match**: the player stays seated but `away` (auto-picks, holds up nobody, pops at GO); on return they get the same slot, character, name and score.
- **Gone for good**: `Player.awayAt` is the frame `away` was set. A player away for `DROP_FRAMES` (40 s) mid-match whose peer isn't present is dropped by the host with a mid-match `leave`: `Player.leaving` (its seat counts as free for a Join from then), parked with its look and score, removed at the round boundary. A peer that comes back later watches; its Join re-seats it from the park with the same look and points. `away` is host-sequenced, so every peer draws the same unplugged icon.
- **Refresh in the lobby**: the player is removed but parked with their character; on return they're re-seated with the same look.
- **Join mid-match**: watch (see Seats and observers), and Join for a seat at the next round boundary.

### Seats and observers

A peer with no seat is an **observer**. It holds the whole match like anyone and renders it, and it sends **no input**: a guest without a seat puts nothing in its unacked list and sends an `in` message only to carry a request or its state hash. The host drops any frames one sends anyway and keeps no queue for it, so the lockstep can't wait on it and its keys can't seat it. Snapshots, resyncs and desync hashes work for it as for anyone.

- `NetState.watching` (replicated, snapshotted with the rest of `NetState`) is who watches: peer → `{name, afk?}`. The `watch` action adds a peer (its seats go at once in the lobby, or are marked `Player.leaving` mid-match and dropped as the round is scored, or as the next round deals if chosen on the score screen) or removes it. A watch link (`?watch`), a peer arriving mid-match, and an arrival to a full lobby send `watch` themselves; the host sends it for an idle player (`afk`). A refresh keeps it, since the peer id survives one. Entries outlive peers that never come back, so the oldest past 16 are dropped.
- **Join is a `seat` action**, sequenced by the host like any other, so a race for the last seat is decided by the host's order and every peer applies the same answer at the same frame. With a seat free (`freeSeats`: 8 minus players not leaving, minus `NetState.queue`) it seats the peer at once in a seat phase (lobby, score, victory) or appends it to `NetState.queue` mid-round; with none it does nothing. The asker reads the answer from its own state once the request is acked (acks ride in the bundle that applied it): seated or queued is `won`, otherwise `taken`, which puts it back to watching. A second request from a peer seated or queued is a no-op. One whose seat is `leaving` keeps it only if a seat is still free: once a watcher has been promised it, the request loses like any other (so seats plus the queue never pass 8), and keeping it drops the park its drop left, so a later rejoin can't restore old points. A peer that refreshes while queued keeps its place. A request is resent until acked, to whichever host there is, so one in flight across a migration is decided by the new host, and one the old host's last bundle already applied is acked by the state the new host resumes from: never twice. At the round boundary the host seats `queue` in order (host-issued `join` actions); a queued peer that left is dropped with `seat {on: false}`.
- An arrival in the lobby is still seated without asking (`wants`, reconciled every 6 ticks), the only seating that isn't a request.
- `kick` removes watchers as well as players (lobby only), and drops them from `watching` and `queue`.
- **Bot seats are the room's.** A bot is a device of the machine that runs it (`<peer>:bot1`), and that machine is the host. Whenever a host finds a bot seat under another peer's id (it took over, or the old host stepped back to watch) it takes it with an `adopt` action, renaming the device to one of its own (`<host>:botN`) with the look, score and level kept, and starts a fresh brain for it (`BotSeats.frames`). So a bot is never `away` or dropped with a peer. A bot seat doesn't seat its peer (`personOf`): Watch gives up only the person's seat, a watcher running bots can Join, and it still steps behind the players. The host ignores input for a bot device nobody holds, so the old host's last presses can't seat its bot again under the old id.

### Idle players and soft disconnects

The host never waits for input: a guest's empty queue repeats its held buttons for a hiccup. After 60 host ticks (1 s) with nothing queued, the peer is **soft-disconnected**: the host lets go of its buttons, so a frozen tab, a phone the OS paused or a link that hasn't timed out yet doesn't keep running its runner into whatever is ahead. Nothing else changes until the link itself drops (2.5 s of silence, then 5 s of grace, then `away`), or until the idle rules below take over.

Idleness is in the sim, from inputs alone, so every peer agrees: `Player.lastInput` is the frame of the player's last input (any button, or the pointer moving), and `Match.idleFrames` counts from it or from the phase's start, whichever is later. 30 s of that in an untimed pick, an untimed place or a race with no timer (60 s in the lobby) sets `Player.afk`, which is treated like `away` (auto-pick, not waited for, popped at GO, not blocking Ready) until the next input clears it. Online, the host moves a peer whose every player is AFK to the watchers (`watch` with `afk`): in the lobby only when it's full and a watcher is present (an idle lobby holds nobody up, and people wait there for friends), mid-match once `Player.afkRounds` (rounds in a row ended AFK) reaches 2, and that peer's next local input sends Join itself (`settleIntent`). A tab that comes back after a long freeze asks for the bundles it missed, or a snapshot past the host's 10 s history.

### Brief drops

A guest whose link drops without a goodbye keeps its seat for 5 s, `linking`, while it re-offers: a stalled tab or a Wi-Fi blip shouldn't cost anyone anything. Past that it's `away`. Being away doesn't forfeit a placement, it only stops the phase waiting: a player who returns in time can still place. A goodbye skips the grace.

### Seats and kicks

- Connecting is joining: a peer asks for a seat without any input, repeating until seated, and the host seats it through the sequenced `join` action within a few frames, so every peer rolls the same character at the same frame. The seat is for the device in hand when the peer asks (`primaryDevice` is read then): a phone only knows touch is its input once the page is up.
- Every player's name and color differ. Rolls skip a clash, deterministically, and the host refuses a saved look or name someone here already has. Two tabs of one browser share a saved profile, so this happens in ordinary testing, and a refused look isn't saved over the profile.
- A picked color is a `color` action naming a swatch (`PLAYER_COLORS`), sequenced like a name: applied only if no one else seated wears it (`Match.colorFree`), so two picks of one swatch go to whichever the host heard first, on every peer. A saved look is restored with its swatch (`look.color`); if that's worn, with the free swatch nearest it, and the client asks for its own swatch again once it frees.
- **Names go through the name filter** (`nameBlocked`, `src/core/name-filter/`) wherever they arrive: the host relays a `name` action carrying a refused name as the player's generated one and drops a refused `watch` label (`relayAction`), `applyAction` refuses it again on every peer, and `restoreMatch` and the adopted `NetState` swap one in a snapshot or a save for the look's generated name (`cleanCharacter`). Names are synced state, so the filter is a pure function of the string, with its patterns built from the committed lists: every peer gives the same answer and the hashes agree.
- `kick` is a `NetAction`, so it exists only inside a host's bundle. Guests apply bundles from the host alone, and the host refuses `kick` as a request from a guest. It applies in the lobby only.
- **A kick is a ban until a match frame** (`KICK_BAN_FRAMES`, 60 s), by peer id (`NetState.kicked`) and by **client id** (`NetState.banned`). A peer id is per tab and a new tab or a cleared session gets another; the client id (`clientId` in `identity.ts`) is random, anonymous and in `localStorage`, so every tab and visit of a browser shares it. Each `hello` carries it; the host keeps peer → client from hellos (a new host learns them as everyone says hello again) and puts the kicked peer's client in the `kick` action, never its own browser's. Both lists are replicated `NetState`, so a new host keeps refusing; expiry is in match frames, so every peer agrees, and expired entries go at the next kick. A refused `hello` gets `kicked` with the ms left, and a `room` breadcrumb, `rejoin refused (banned)`. The kicked tab remembers its ban's end (`sessionStorage`) and on a reload shows the countdown without connecting at all. A private window is a new browser: that gets in.
- The store doesn't refuse a banned id's `join`: that would cost a write per kick and a read per join, for a peer that holds a presence slot only until the host's refusal reaches it.

### Desync detection

Every 60 frames each guest hashes its confirmed state (FNV-1a over the canonical snapshot) and reports it. On a mismatch the host sends that guest a snapshot.

### Cross-browser determinism

IEEE-754 `+ - * /` and `Math.sqrt` are exact everywhere, but `Math.sin/cos/atan2/exp/pow/hypot/…` and `**` are implementation-approximated. `src/core/dmath.ts` has fdlibm ports built from exact operations only. `src/sim`, `src/gen` and `src/game` use them. `.oxlintrc.json` bans the `Math` functions there, with a message naming the replacement, and `tests/determinism-ban.test.ts` bans `**`, which lint can't see. The rest the sim leans on is exact by spec in every engine: stable `sort` (every comparator there is consistent), insertion-ordered `Map`, `Set` and string keys, shortest round-trip number formatting, typed arrays.

The state hash treats every NaN alike: a NaN's bits are up to the engine (V8 keeps a computed NaN's sign and payload through a `Float64Array`), and a NaN that crossed the wire comes back as the literal one, so hashing raw bits could call two peers in sync a desync.

`pnpm determinism` checks it: the production build in Chromium, Firefox and WebKit, every theme and level size generated (tiles, set pieces, look, crate), races with one of every archetype under rotated weather, held items, low, high and space gravity, and a four-player match through several rounds of pick, place and race, all on scripted inputs, with every frame's hash compared against Chromium's. A mismatch prints the first frame and the snapshot fields that differ there.

## HUD

`RoomConnection.hudInfo()` is `renderer.hud.net`: the status line, peers (crown, ping) and invite link in the lobby's online panel, the watcher chips, this peer's seat (`seated`, `leaving`, `queued`, `watching`), the free seats, and `arrival`: the joining screen while a page that has never been in the room connects (after 350 ms, so a fresh room of our own doesn't flash it), or the failed room (`cutOff`). The join card's state is the game client's; only its Join reaches the session. `toast()` covers the states that freeze a race, because the panel only shows in the lobby. Every one is bad news, so it's drawn amber with a warning glyph, never the success check. A guest waiting for the host shows `Joining…`, and a host gathering the room shows `Migrating Host…`. A guest that can't load the host's snapshot (another build: `SNAP_VERSION`, or terrain its generator doesn't make) shows `Different Version · Reload`, goes `OFFLINE` in the panel with no seats drawn (its lobby is its own, and nothing pressed there reaches anyone), and asks again only every 10 s, since each ask costs the host a whole snapshot. This text stays short: state what happened, and don't explain what's clear from the screen.

## Monitoring

`src/net` reports through `src/telemetry.ts`, never the SDK; [TELEMETRY.md](TELEMETRY.md) has the full list. Events: `desync` (error, from the host), `slow-host-migration` (warning, from the new host, over 20 s), `net-unavailable` (warning, grouped by why), `snapshot-refused` (warning, once a page, from a guest on another build). Every session log line (links, host changes, syncs, desyncs) is a `net` breadcrumb, seat actions are `room` breadcrumbs, and failed signaling calls are `signal` breadcrumbs. A finished migration is a `host migration` log with its duration from the new host, and a resync other than a join's is a `net resync` log: that is how migration times in the field are seen without an issue for each. Names are fixed and variables go in `data`; they carry frames, hashes and peer ids, never player names, which players type themselves. The routes run on the Node runtime. A store failure is answered as a 503, so the route reports it itself, tagged with the op and the store's status, at most once a minute per instance (`_server/report.ts`), because an exhausted free tier would otherwise report every poll.

## Testing

- `tests/signal-handlers.test.ts`: the store (reply shapes, Upstash request format, either env pair), handlers (join order, TTLs, caps, validation, command costs), the lobby list (only a live host lists, junk listings, Private, a listed host's leave, falling off, pruning, the cap, its costs), the reply cache and the HTTP edge. `tests/webrtc-transport.test.ts` lists rooms over the real transport: at once for a new host, a seat filling within the nudge, Private off at once and back, the next host relisting, the last goodbye unlisting, a crashed host falling off; and the budget with and without the listing. `tests/lobbies.test.ts`: the screen's filters and order, and a host's listing.
- `tests/webrtc-transport.test.ts`: the real transport, handlers and store over a fake RTC network and clock: linking, polling stopping, the measured budget, crash and goodbye migrations, double failure (including a candidate still settling its own stalled handshake, and a dead peer's handshake hanging as it does in a browser), flaky guests, two guests losing a live host at once (the host frozen before either takes over), rival hosts stepping down within seconds, resuming from the furthest frame. Seeded runs over API latency, handshake behaviour and crash timing check that a double failure always lands on the third peer with never two hosts, and that with flaky guests only one host ever runs, any split is over within 5 s, and everyone ends identical.
- `tests/net.test.ts`, `tests/net-pick.test.ts`: lockstep under latency and loss, rough play (four peers, three rounds through weather, deaths, grabs and contact, the host's link cut mid-race), desync recovery, seats, kicks, refresh, late join, a guest on another build; claim races, pending cards, remote cursors and ghosts, the input codec.
- `tests/net-bots.test.ts`: bot seats moving to the new host when the host leaves the lobby or crashes mid-race, and staying seated through the host starting to watch and the handover after; stale input for a bot seat that moved; a watching host with bots taking a seat again. `tests/webrtc-transport.test.ts` adds a host who starts watching, and a crash migration, with a crashed guest still listed: the room lands on a live peer once.
- `tests/net-seats.test.ts`: a watch-link observer never seated, sending nothing, frozen without holding the room up, with the same state; Watch in the lobby and mid-match (out at the boundary); a full lobby making watchers, and Join answered `taken` while full; two watchers racing for the last seat; a request in flight across a migration; watchers stepping behind players so a migration skips them, and one hosting when only watchers are left; an idle lobby player moved to the watchers and back by input; a frozen guest's held buttons let go, its runner giving up, and its state agreeing after. `tests/idle.test.ts`: every wait point of the idle rules in the sim. `tests/webrtc-transport.test.ts` adds the reorder over the real transport: a crash skips the watcher, and a host who starts watching hands the room on.
- `tests/snapshot.test.ts`: round trips with items in play, prediction isolation, and a guard that fails until any new `Match` or `RunWorld` field is snapshotted or declared derived. `tests/dmath.test.ts`.
- `pnpm test:store`: the real Upstash REST code against real Redis behind [Serverless Redis HTTP](https://upstash.com/docs/redis/sdks/ts/developing) (`compose.store.yml`, Redis 6.2.21 and SRH 0.0.10, on port 8079). Every command the handlers use, reply parity with the in-memory store, the presence and listing scripts as real Lua against their mirrors, the lobby list end to end, TTL expiry, join order under a stampede, two sessions of one peer racing, the handlers end to end. `-- --browser pick,run,leave` adds real browsers on the same store, with the app configured through the production env vars. Needs Docker, so it's a CI job rather than part of `pnpm check`. SRH needs `Content-Type: application/json` and differs from Upstash in edge cases, so handlers stick to plain commands and plain Lua (`EVAL`, no `EVALSHA` or functions).
- `pnpm online-test`: real WebRTC between headless Chromium pages, one context per peer, against the real routes with the in-memory store. Hosts are killed with a renderer crash (no pagehide, no goodbye) in pick, place and run, and in a race with no third peer (`duo`); also a graceful leave, a new host dying straight after taking over (`twice`: about 8 s from the first crash, 4 s from the second), and every data channel going silent at once with signaling up (`double`: both guests lose a live host; never two hosts playing, everyone identical after). `pick` runs with a bot, which must play on from the new host. `hostwatch` (and `hostwatch-match`, mid-match) is the host clicking Watch: it steps behind the players and hands the room, and its bot, to the next in line, with nobody frozen for long.
- `pnpm online-test -- --engines chromium,firefox,webkit`: the same with mixed engines in one room. Each scenario's peers take the engines in turn, so the first named hosts; phones skip Firefox, which Playwright can't make a phone. Only Chromium can crash a page on demand, so another engine's "crash" hangs its main thread for good, which looks the same from every other peer. WebKit needs `pnpm exec playwright install webkit` and its system libraries. Each prints seconds to recovery and compares state hashes. With a third peer a crash recovers in about 4 s, since its offer proves the host is gone; alone, the guest waits out the old host's whole answer window, about 7.5 s (2.5 s of silence, the offer landing, then `PROBE_MS`).
- `pnpm online-test -- --only view`: real mouse events at four window shapes on classic, wide and tall levels. The card under the pointer is the one taken, and the cursor and ghost sit under it on both peers. Cursors are view px in `pick` and world px in `place`, mapped through `overview`, so a test or HUD that treats them alike is wrong on anything but a 1:1 level.
- `pnpm online-test -- --only seats`: `observe` (host, guest, a desktop and a phone watcher through a round; a frozen watcher; then a late joiner mid-race clicks Join and the card's Join and is seated at the boundary), `seatrace` (seven seated, two watchers Join for the last seat at once; then a player leaves and the loser's Join works), `idle` (a guest's tab hidden through an untimed pick and race: handed a card, its runner gives up, it agrees once shown).
- `pnpm online-test -- --only browse` (in the `lobby` group): a host shows on another browser's Lobbies screen, a guest joins it from there and is seated, the count follows, the host's rules card makes it Private and it leaves the list, public again it's back, and once everyone has left it's gone.
- Groups, each runnable alone on a loaded machine: `--only lobby`, `migration`, `feel`, `misc`, `seats`. The other scenarios (`flow`, `kick`, `refused`, `play`, `bc`, `unset`) are listed at the top of `tools/online-test.ts`. Scenarios that don't check pixels stub their drawing, since software GL otherwise measures the machine.
- `pnpm online-test -- --only contact`: two runners out of the spawn zone, one shoving the other, then the guest landing on the host's head and thrown off it (the host walks off, then jumps), at 40 ms each way: the guest must draw no teleport and no pusher inside who it pushes, the walk must leave the guest behind, and the jump must pop it clear of the host's head.
- `pnpm online-test -- --only latency,hidden`: input-to-screen delay between pages, bundle cadence, stalls and teleports, at 0 and 40 ms each way, and with the host's tab hidden. The delay and the hidden tab are simulated in the page (a delayed `RTCDataChannel.send`; `document.hidden`, no rAF, timers clamped to 1 Hz), since headless pages can't truly go hidden. The budget is loose enough for a loaded box: it catches regressions, not jitter.

**Not exercised by any of this:** the real Upstash service (SRH stands in for it), real NAT traversal (all pages share a machine and connect over host candidates), TURN, real Safari and real phones (WebKit on Linux with an iPhone profile stands in: `pnpm shot mobile --engine webkit`).

## Next steps

- **Full rollback for everyone**: the host could run a few frames of input delay so guests' inputs land on time more often.
- **Local devices for a Join**: a watcher's Join seats its main device; a second local player joins once seated, in the lobby.
- **Hand off host** from a hidden tab: a hidden host keeps ticking via a worker timer, but browsers may throttle it.
- **Snapshot compression** if rooms with many placed props get large.
