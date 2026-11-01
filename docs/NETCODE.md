# Online play: design

Status: **planned**. Local multiplayer ships first. This document is the contract for the online work.

## Constraints

- Hosting is **Vercel**: a static Vite build plus, optionally, serverless functions. There are no long-lived servers or WebSockets on Vercel.
- Running costs should be about $0. No dedicated game servers.
- The game is 1–4 players, fast precision platforming, and short rounds.

## Topology: shareable room link, peer-to-peer

1. The host picks **Online → Create room**. The client generates a room code (for example `K7QX`, base32, 4–6 characters) and shows `https://<app>/r/K7QX`. `vercel.json` rewrites `/r/*` to `index.html`.
2. Guests open the link and join the room over WebRTC data channels. The connection is a star: every guest connects to the host. That's simpler than a full mesh, and with four players it costs the same.
3. **The host is authoritative for meta-state**: joins and leaves, the seed, phase changes, picks and placements, and scoring decisions. Every peer runs the same deterministic sim.

### Signaling (finding peers)

WebRTC needs a way to exchange connection details (SDP offers and answers). The options, in order of preference:

1. **Trystero** (npm `trystero`). Serverless signaling over public Nostr relays, MQTT, or BitTorrent trackers. Zero backend and zero cost. The risk is relying on third-party public infrastructure.
2. **A first-party fallback**: a Vercel function at `api/signal.ts` backed by Upstash Redis on the free tier. Peers POST their offers and answers under `room:<code>` with a 60 s TTL and poll every 500 ms during the handshake. This is a few dozen lines of code.
3. An optional public room list. This is the same Redis setup with a `rooms` sorted set kept alive by heartbeats every 15 s, where entries expire automatically. It's only needed if we want a "browse games" screen. Shared links cover the main use case.

### NAT traversal

- **STUN**: use public Google or Cloudflare STUN servers. They're free.
- **TURN**: roughly 10–20% of player pairs can't connect directly because of strict home or office networks, and a TURN relay fixes that. Cloudflare Realtime TURN has a free tier, and Metered.ca also offers free TURN. Load TURN credentials from an env var through a tiny Vercel function at `api/turn.ts` that mints short-lived credentials. The game works without TURN; only those strict-network pairs fail to connect.

## Netcode

The sim is a pure function of `(seed, per-frame inputs)`, so peers only exchange inputs.

- **Races use rollback** (GGPO-style):
  - Each peer predicts remote inputs by repeating the last known input. When the real input arrives, the peer restores a snapshot and re-simulates.
  - A local input delay of 1–2 frames plus up to about 8 frames of rollback.
  - This needs a cheap `RunWorld` snapshot and restore. The plan is to keep all race state in plain data (typed arrays or POJOs) behind `snapshot(): RunSnapshot` and `restore(s)`.
- **Pick, place, and score phases** send discrete actions (cursor positions at a low rate, plus `claim` and `place` actions). The host orders them and broadcasts the result. No rollback is needed for these phases.
- **Input packets**:
  - `{frame, bits}` with 9 buttons packed into an integer.
  - Each packet carries the last N frames, so a lost packet doesn't stall the game.
  - Data channels are unordered and unreliable for inputs, and reliable for meta messages.

### Cross-browser determinism

- IEEE-754 `+ - * /` and `Math.sqrt` behave the same everywhere. `Math.sin`, `cos`, `atan2`, `exp`, `pow`, and `hypot` are **not guaranteed** to match across JS engines (V8, SpiderMonkey, JavaScriptCore).
- **Before shipping online**, replace them in `src/sim/**` and in the generators with deterministic implementations in `src/core/dmath.ts` (polynomial or minimax approximations, and `hypot` written as `sqrt(x*x+y*y)`). Add a lint rule or test that bans `Math.sin`, `cos`, `atan2`, `exp`, `pow`, and `hypot` in `src/sim` and `src/gen`.
- **Desync guard**: every 60 frames each peer hashes the sim state (FNV over runner positions and velocities, prop state, and projectiles) and sends the hash. If a guest's hash differs from the host's, the host sends a full snapshot.

## Work breakdown

1. `dmath` swap plus a ban test. This is valuable even offline, because it makes replays deterministic.
2. `RunWorld` and `Match` snapshot and restore, with tests that snapshot → step N → restore → step N gives identical results.
3. A transport interface (`src/net/transport.ts`) with a Trystero implementation and an in-memory loopback for tests.
4. Lockstep and rollback session (`src/net/session.ts`), plus a headless two-peer test over loopback with injected latency and loss.
5. UI: the Online menu, room creation and join through `/r/<code>`, a ping display, and a "reconnecting…" state.
6. Optional extras: `api/signal.ts` (Upstash) as a fallback, `api/turn.ts`, and the public room list.
