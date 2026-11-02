# Online play

Status: **shipped (v1)**: host-sequenced lockstep with presence-based host election, seamless host migration, refresh/reconnect, late join, desync detection with automatic resync, and client-side prediction in races. Code: `src/net/`, `relay/`.

A room is its URL, `/r/<CODE>`. Everyone who opens the same link is in the same match. There is no matchmaking and no room list.

## Setup (one time, ~5 minutes)

Online play needs a tiny relay on Cloudflare's free plan. Until it's configured, the game still works: local multiplayer is unaffected, and a shared link only connects tabs of the same browser (the status badge says so).

1. Create a free Cloudflare account (https://dash.cloudflare.com/sign-up). Workers Free includes Durable Objects.
2. Deploy the relay:
   ```sh
   cd relay
   npx wrangler@4 login
   npx wrangler@4 deploy
   ```
   Wrangler prints the URL, e.g. `https://slag-relay.<you>.workers.dev`.
3. In Vercel → Project → Settings → Environment Variables, add
   `NEXT_PUBLIC_SLAG_RELAY_URL = wss://slag-relay.<you>.workers.dev` (Production and Preview), then redeploy (the value is inlined at build time).
4. Optional hardening: in `relay/wrangler.toml`, set `ALLOWED_ORIGINS = "https://<your-app>.vercel.app"` and deploy again.

To smoke-test any relay (local, `wrangler dev`, or deployed): `pnpm tsx tools/relay-probe.ts wss://slag-relay.<you>.workers.dev`.

Local development: `pnpm relay` starts the same relay logic on `ws://127.0.0.1:8787`; open `http://localhost:3000/r/ABCDE?relay=ws://127.0.0.1:8787` in two browsers. `?net=bc` uses BroadcastChannel (tabs of one browser), `?net=off` is offline. Debug params `?players=` / `?race=` imply offline.

Cost at hobby scale: $0. Workers Free allows 100k requests/day; incoming WebSocket messages count 1/20 of a request, outgoing are free. A 4-peer room sends ~120 messages/s (each peer 30 Hz), so ~4.5 hours of 4-player play per day before the daily limit. Durable Object duration (13,000 GB-s/day free) covers ~28 room-hours per day. Raise `sendEvery` in `src/net/session.ts` to trade a little latency for headroom.

## Why a Cloudflare Durable Object relay

What host election needs is **authoritative presence**: every peer must agree on who is in the room and in what order they joined. We evaluated:

| Option | Presence / join order | Works on every network | Cost / setup | Verdict |
|---|---|---|---|---|
| Trystero (WebRTC over public Nostr/MQTT/torrent signaling) | None: peers gossip, so views diverge under partial connectivity (split brain) | No: ~10–20% of pairs need TURN | Free, zero setup, but depends on volunteer relays (a Nostr relay timed out from our test container) | Rejected |
| PeerJS cloud broker | None (only ID registration) | No (WebRTC, no TURN) | Free, zero setup | Rejected |
| Supabase Realtime | CRDT presence, no join order; client clocks for ordering | Yes (WebSocket) | Free tier pauses projects after 7 idle days; 2M msgs/month counted per delivery | Rejected |
| Ably / Pusher / Liveblocks | Authoritative presence (Ably) | Yes | Free tiers count every delivery (6M/month Ably, 200k/day Pusher): a few hundred races per month; needs an SDK and a token endpoint | Runner-up |
| **Cloudflare Worker + Durable Object** | **One single-threaded object per room: one member list, server-assigned join order, one total message order per receiver** | **Yes: WSS on 443** | **Free plan; outgoing messages free; ~150 lines we own; no client SDK** | **Chosen** |
| PartyKit | Same as DO (it is built on them) | Yes | Adds a framework and its deploy flow | Equivalent; not needed |

WebSockets work through the outbound proxy of our build container (verified: `101 Switching Protocols`), while WebRTC/UDP generally doesn't; the relay also avoids NAT/TURN issues for players. The cost of relaying instead of peer-to-peer is one extra hop of latency, which prediction hides for the local player (see Next steps for a WebRTC upgrade path).

## Architecture

```
browser ──wss──▶ Cloudflare Worker ──▶ Durable Object "SlagRoom" (one per room code)
                 relay/worker.ts         relay/room.ts: presence (join order) + fan-out
src/net/
  transport.ts       Transport interface; LoopbackHub (tests: latency/jitter/loss, manual clock); BroadcastTransport
  relay-transport.ts RelayTransport: WebSocket client with reconnect/backoff and keepalive
  relay-protocol.ts  wire format shared with the relay
  session.ts         NetSession: election, lockstep, prediction, sync, desync detection
  actions.ts         host-sequenced match actions (join/leave/away/name/rules) + replicated NetState
  codec.ts           compact InputFrame encoding (9 bits + optional pointer), merge/held helpers
  snapshot.ts        Match snapshot/restore/hash (exact through JSON: -0, NaN, ∞, Maps, typed arrays)
  predict.ts         cheap race-state copy for prediction
  identity.ts        peer id (survives refresh, distinct per tab) and the resume save
  client.ts          browser entry: transport choice, page lifecycle, NetHudInfo for the HUD
  badge.ts           interim DOM status badge until the HUD draws NetHudInfo
tools/relay-dev.ts   the relay logic on a local Node WebSocket server
tools/online-test.ts headless Chromium end-to-end test (BroadcastChannel and relay)
```

### Identity and devices

- Each tab has a **peer id** (8 chars). It lives in `sessionStorage` (a refresh keeps it) plus a lease table in `localStorage` (a newly opened tab takes the most recently used free id, so closing and reopening the link also gets your seat back; two live tabs never share an id).
- Match devices are namespaced `<peer>:<local device>` (`k3j9x2ab:kb1`, `k3j9x2ab:pad0`), so one machine can seat several local players (split keyboard, gamepads, touch). Offline sessions keep raw ids.

### Host election

- The relay assigns each connection a join `order` from a per-room counter (reset when the room empties). The **host is the connected member with the lowest order**. Everyone computes it from the same list, so no voting is needed.
- Host leaves (close, crash, network loss) → the relay broadcasts `leave` → every peer re-elects the next-earliest member. Because the relay delivers everything to a receiver in one ordered stream, the `leave` always arrives before the new host's first bundle.
- A refresh or reconnect is a new connection, so it joins **later** in order: the old host comes back as a guest (that's what "you leave, somebody else is now the host" means).
- Empty room → the next arrival is host. If this browser saved the room's state in the last 30 minutes (`identity.ts`, every 2 s and on pagehide), it **resumes** it; otherwise it starts fresh. Players of absent peers are dropped (lobby) or marked away (mid-match).
- BroadcastChannel has no server, so tabs report their own join time (one clock within a browser) and heartbeat; messages from a peer that claims host before presence agrees are stashed and replayed.

### Lockstep (host-sequenced)

- Every tick (60 Hz), each guest samples its local devices, appends the frame to its *unacked* list with a sequence number, and every `sendEvery` ticks (default 2, immediately on button presses) sends **all** unacked frames to the host. Redundancy makes loss harmless.
- The host consumes one queued frame per guest per tick. If a guest's queue runs dry it repeats the guest's held buttons (no edges); if a burst piles up (more than 6), the oldest frames are folded together (edges OR-ed), bounding latency.
- The host stamps `{frame, inputs, actions, ack deltas}` into a **bundle**, applies it, and broadcasts bundles every `sendEvery` ticks. Guests apply bundles strictly in frame order; a gap triggers `need` and the host resends from its 10 s history (or sends a snapshot).
- Discrete changes (seat a rejoiner, drop a leaver, mark away, rename, restore a saved look, the host's rules and per-match crate salt) are **actions** carried in bundles and applied by everyone at the same frame (`actions.ts`).
- Sequence numbers start at wall-clock ms, so a refreshed page always counts higher than its previous self.

### Prediction (races)

The host plays with zero input delay. A guest in a race renders a predicted copy (`predict.ts`): the confirmed state stepped forward with its own unacked inputs, other players holding their last known buttons. When new bundles arrive, the copy is rebuilt from the confirmed state (rollback + re-simulate, ≤ 24 frames). Events (sounds/fx) are emitted the first time a frame is simulated, predicted or confirmed, never twice. Lobby, pick and place use confirmed state only (they're latency tolerant).

### Joining, reconnecting, migrating

- **Join / reconnect**: a guest says `hello`; the host replies with a **snapshot** (`snapshot.ts`: the whole Match minus the level, which is regenerated from its seed with bomb craters patched on), ack state, last inputs and replicated NetState. Snapshots are ~10–60 KB. Chosen over replaying the input log because they're bounded in size and also serve resync and migration.
- **Refresh mid-match**: the player stays seated but `away` (auto-picks, forfeits placement, pops at GO, so nobody waits); on return the host clears `away`: same slot, character, name and score.
- **Refresh in the lobby**: the player is removed but parked with their character; on return they're re-seated with the same look.
- **Join mid-match**: spectate (synced, no slot) until the next round boundary (score/victory/lobby), then the host seats the peer's main device.
- **Migration**: the new host continues from its last confirmed frame using the ack/last-input state every peer tracks from bundles, and broadcasts a snapshot so anyone who was a frame ahead or behind lines up. No state is lost; at worst a few frames of the old host's last unsent inputs.
- **Lost link**: a host whose link drops freezes if other machines' players are in the match (resuming alone would fork the room) and shows "reconnecting"; when it's back it follows whoever is host now.

### Desync detection

Every 60 frames each guest hashes its confirmed state (FNV-1a over the canonical snapshot) and reports it; on mismatch the host sends that guest a snapshot. Tests assert zero desyncs in normal play.

### Cross-browser determinism

IEEE-754 `+ - * /` and `Math.sqrt` are exact everywhere, but `Math.sin/cos/atan2/exp/pow/hypot/…` (and `**`) are implementation-approximated. `src/core/dmath.ts` provides fdlibm ports (`dsin`, `dcos`, `datan`, `datan2`, `dhypot`, `dexp`, `dlog`, `dpow`) built from exact operations only; `tests/determinism-ban.test.ts` fails if banned calls (or `Math.random`) appear in `src/sim`, `src/game`, `src/core`, `src/gen/{props,character,names}.ts`, `src/gen/setpieces`, `src/gen/theme`, `src/themes.ts`.

**Pending**: `src/gen/level/**` (worldgen, being rewritten) still uses `Math.*` (currently `src/gen/level/kit.ts`). Swap and add it to `ROOTS` in the ban test. Until then, levels are generated identically only if every browser's libm agrees for those calls, which is very likely for the few calls involved but not guaranteed.

## HUD interface

`src/net/client.ts` exports `NetHudInfo`, attached as `renderer.hud.net` (declare `net?: NetHudInfo` on the HUD class):

- `status`: `'offline' | 'connecting' | 'online' | 'reconnecting' | 'unavailable'`; `transport`: `'relay' | 'broadcast' | null`
- `notice`: one-line explanation when limited ("Online play is not set up…", "Reconnecting…", "Joining…"), `''` otherwise
- `isHost`, `selfId`, `paused` (guest waiting for snapshot / host frozen while reconnecting), `inviteUrl`
- `peers()`: `PeerInfo[]` (`id, order, isHost, isSelf, ping (ms to host), quality ('good'|'ok'|'bad'|'unknown'), slots, name`)
- `isLocal(device)`, `peerOf(device)`: which players belong to this machine
- A HUD button with `action: 'invite'` is already handled by `game-client.ts` (copies the link).

## Testing

- `tests/net.test.ts`: election and migration (join order, leave, rejoin, empty room), 4 peers with latency/jitter/5% loss playing full rounds to identical hashes, desync detection and resync, refresh restores slot (mid-match and lobby), late join mid-race (identical state, seated next round), host leaving mid-race.
- `tests/relay.test.ts`: relay room logic. `tests/snapshot.test.ts`: snapshot round trips per phase. `tests/dmath.test.ts`, `tests/determinism-ban.test.ts`.
- `pnpm online-test`: headless Chromium, three pages on one room over BroadcastChannel and over the WebSocket relay: join, ready, race, close the host (abruptly, for the relay), verify takeover, identical hashes, refresh → same slot, next round.

## Next steps

- **Full rollback for everyone**: prediction already re-simulates races on guests; the host could also run a few frames of input delay so guests' inputs land on time more often (fewer corrections).
- **WebRTC data channels** for the hot path, keeping the Durable Object for presence and signaling (it already provides an ordered, authoritative channel for SDP exchange). Saves relay messages and a hop of latency for pairs that can connect directly; fall back to the relay otherwise.
- **Spectator UX**: a "spectating, you'll join next round" banner; let spectators pick which local devices join.
- **Snapshot compression** (delta against the last snapshot) if rooms with many placed props get large.
- **Host prefers visible tabs**: a hidden host keeps ticking via a worker timer, but browsers may throttle it; a "hand off host" action could help.
