# TODO agenda

These are the open work items, ordered by priority. Each one is sized for one agent. Several have unfinished work on a `wip/*` branch: those agents were stopped mid-task, and their work was saved as-is, **unreviewed**. Read the branch diff before reusing it. Every `wip/*` branch is behind `main`, so merge `origin/main` first.

Limit agents by file overlap first. On a small machine, also run at most 3–4 at once. While iterating, run only the test files you touch (`pnpm vitest run tests/x.test.ts`) plus `pnpm check:fast`. Run the full `pnpm check` once, before committing. Test behavior and invariants, not every tunable.

Design intent for everything below is in `docs/DESIGN.md`.

---

## 2. Online play on Vercel (decision needed)
**Branch:** `wip/netcode-cloudflare` (+5 commits). It contains:
- host-sequenced lockstep, presence-based host election and migration, refresh/rejoin, late join, desync detection and resync, and prediction;
- `src/net/`, `dmath`, snapshots, a BroadcastChannel transport and `pnpm online-test`;
- a **Cloudflare Durable Object relay** (`relay/`, wrangler). That relay contradicts our plan, because we host only on Vercel.

Vercel functions can't hold a WebSocket open, so something else has to carry the messages. Options:

| Option | What it is | Trade-off |
|---|---|---|
| **A (recommended)** | WebRTC data channels in a star around the host. Signaling and presence use small Next route handlers (`app/api/`) that short- or long-poll Redis from the Vercel Marketplace (Upstash free tier, REST via `fetch`). Local dev uses an in-memory store. On host migration, everyone re-signals to the new host. Public STUN, plus optional TURN from an env var. | Everything stays on Vercel and on free tiers. About 10–20% of player pairs can't connect without a TURN server. |
| B | Keep the Cloudflare relay. | Most robust, with no NAT problems, but needs a second platform and account. |
| C | A hosted realtime service (Ably or Pusher free tier). | Adds a third-party dependency and its limits. |

Whichever option is chosen, keep the transport abstraction, the election logic, snapshots and dmath, and swap only the transport. Then update `docs/NETCODE.md`, which is stale and still mentions Vite.

**Required online:** everyone sees each other's cursors and ghost parts live during pick and place. It matters most in pick, because the first player to pick a part gets it. A claim race has one winner on every peer, and nobody sees a claim that then gets revoked.

## 3. Level variety, gravity and the "mostly open" rule
**Branches:**
- `wip/level-variety`: the agent's raw work (+4).
- `wip/level-variety-merge`: that work merged with `main` around 38abff9, with conflicts resolved. **6 generator tests fail**: levelgen, profile ×2, worldgen castle/volcano/bridge share.

**Contents:**
- level profiles: size and aspect (wide, classic, tall), density, hazard count, route shape (sprawl, climb, descent, zig-zag);
- variable world size across sim, gen, render and camera;
- a tall sculptor;
- the gravity world setting (a rule; `Level.gravity` is used by physics, reach and projectiles).

**Still to do:**
- Fix the failing tests.
- Run `pnpm level --stats 50` on this branch and on its parent commit, and compare.
- **Full-window background:** canvases fill the window while the play-area aspect and scale stay the same; background layers fill the extra space instead of black bars. Check at 16:9, 21:9, 4:3 and phone sizes.
- **New rule: levels are mostly open.** There must always be more than one route to the goal: corridors are fine in places, but never a single narrow path. Enforce it in the judge, for example by checking that the reachable stand-cell graph has at least two disjoint-ish routes, or with a minimum openness ratio.
- Retune the sculptors for walk vs run and the lower jump.

## 5. Mystery crate and held items
**Branch:** `wip/held-items` (~2k lines across 27 files, unreviewed).

- A Mystery Crate prop that pops out a random held item, plus a held-item system with a `use` input action.
- Original items only: a sword that bonks, a kickable puck that ricochets, a boomerang, a shield, …
- Keep runner state additive, beside `RunnerStatus` (`src/sim/props/status.ts`). Item 7 also adds "runner attached to a prop" state.
- The branch edits the old projectile loop, which has since moved into `stepProjectile` (`src/sim/props/ammo.ts`), so port those edits.

## 6. Mobile, round 2
**Branch:** `wip/mobile-2` (~1k lines, unreviewed). Round 1 (touch controls) is merged.

The user's feedback on a real phone: "almost playable but not quite; resolution is tough; settings is bad; probably needs zoomed in more."

- **Phone follow camera:** render-only, a tile at least ~24 CSS px, look-ahead, a vertical dead zone, clamped to the level. Pick and place start zoomed out, with pinch-zoom, two-finger pan and auto-pan near the edges. Multiple local players fall back to framing everyone. `?zoom=1` forces it on desktop. Keep it in its own module, because item 3 also changes the camera. Cursors must stay in world coordinates, so other players' cursors and ghost parts land in the right place whatever each player's zoom.
- **HUD readability:** scale HUD text, pills and crate cards up on small screens, with tap targets of at least 44 CSS px.
- **Settings:** a full-screen sheet on phones with big rows that scrolls.
- **Verify:** `pnpm shot mobile` on iPhone SE, iPhone 13 and Pixel 7 in landscape. Nothing has been tested on real hardware yet.

## 7. Grab props: rope and blast barrel
No branch yet. `origin/wip/content` has a dropped launch barrel (module and art) worth reading for the blast barrel, but its name and `status.hold` must not be reused.

- **Rope:** hangs from a ceiling. You grab it automatically when you touch it in the air, with a short re-grab cooldown. Left and right pump the swing; jump lets go and keeps the swing's momentum.
- **Blast barrel:** it pulls you in on contact and rotates (or holds a fixed aim). Jump fires you out along its direction after a short delay. It must be an original design, not a copy.
- Both put the runner in an "attached" state inside `RunWorld`. That state must stay snapshot-friendly and deterministic.
- Add both to `reach.ts` only if worldgen ever relies on them. For now it shouldn't.

## 8. Render polish
- **Set-piece layering:** scenery halves draw *behind* the terrain (the windmill tower, crane mast, press gantry, antenna masts). Moving and solid parts stay in front (the blades, platforms). Layer order is in `docs/DESIGN.md` → Levels. This is probably a `backdrop` art layer drawn before terrain in `src/render/renderer.ts` and the `defineArt` layers.
- **The player's glowing trail is too strong.** Tone it down.
- **Comic-book style experiment:** `wip/comic-style` (~560 lines, unreviewed). Add `?style=comic`, `renderer.setStyle`, and a Settings toggle.

## 9. Weather (new)
A per-level random variable:
- wind gusts that push runners and projectiles (reuse `src/sim/wind.ts`);
- mist that limits sight distance;
- rain or snow that changes footing.

It's always telegraphed, weighted per theme, and must be deterministic from the level seed.

## 10. Housekeeping
- Enable GitHub Actions and make `ci.yml` a required check. This must be done on GitHub by the repo owner.
- Delete the old remote branch `claude/scaffold-procgen-platformer`, and the `wip/*` branches once they're merged.
- Swap the sim and gen transcendentals (`Math.sin`, `cos`, `atan2`, …) to `core/dmath.ts`. It lands with the netcode work.
- Add the run controls to the README.
- Consider stricter TS flags: `noUncheckedIndexedAccess` gives about 600 errors, so it's a project of its own.

## 11. Make every screen part of the game, so it's portable
**Goal: the game is portable.** Every screen lives in `src/` and runs without Next or React, so the game could be packaged somewhere else. Next is just one host: thin pages that mount it at different URLs. Different URLs are fine; a different UI stack per screen is not.

- That covers the home screen, lobby, settings and codex, plus the 404 and any error screens. Each one is a game screen, reached in-game and by URL.
- A small router in `src/` maps paths to screens with the History API. `/`, `/r/<code>` and `/codex` stay deep links, and moving between screens needs no page reload. Don't assume a URL bar exists, so a packaged build still has a way to reach every screen.
- `app/` shrinks to server metadata plus one shared mount. Add the rule to AGENTS.md and `app/AGENTS.md` when it lands.

The rest of this item is the home screen, the first and biggest piece of it. The home screen and the lobby are two different UIs. `/` is React and CSS (`app/page.tsx`, `app/MainMenu.tsx`, `app/HomeStage.tsx`, `app/HomeSettings.tsx`, `app/globals.css`), and the game only boots at `/r/<code>`. The lobby is drawn on canvas (`src/render/hud.ts`, `src/ui/menus.ts`). So there are two logos, two settings UIs, and a visible jump between them.

- Boot the game on `/` and render the main menu in-game, with the same renderer, menus and input (keyboard, gamepad and touch) as the lobby. The page stays a thin shell, per `app/AGENTS.md`.
- Play goes to the lobby without a page reload. `/r/<code>` stays a shareable deep link, and `?seed`/`?theme` still pass through.
- One logo and one settings UI, used everywhere. This replaces the lobby logo's separate treatment, which looks worse than the home-screen logo today (same treatment, scale and crispness).
- **The home screen is the quality bar for the whole game.** The owner loves how it looks and that it fills the full window height. Keep its look exactly (drips, embers, character stage), and bring the lobby, menus and in-game screens up to it, not the other way round. Record that bar in `docs/ART.md`.
- Do this after items 2 and 3, which both change `src/game-client.ts`.

## 13. Playtest and tune the new parts
Nothing from item 4 has been played by hand, so the tuning is test-level only: magnet drift, bumper power, slow and freeze durations. Dropstones and crushers stop only on terrain, so they pass through placed blocks; decide whether that's right.

Also confirm the round limit default of 40. It comes from a Monte Carlo model of scoring with a fixed finish rate, and real finish rates probably fall as props pile up. An unwinnable match takes all 40 rounds to end.

## 14. Clear the lint warnings
`pnpm check` prints 7 warnings, in `src/ui/touch/overlay.ts`, `src/ui/touch/device.ts`, `src/input/input.ts`, `src/render/props/modules/vehicle.ts` and `src/audio/system.ts`. AGENTS.md treats warnings as real findings. Do it with or after item 6, which also touches the touch code.
