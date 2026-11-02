# TODO agenda

These are the open work items, ordered by priority. Each one is sized for one agent. Several have unfinished work on a `wip/*` branch: those agents were stopped mid-task, and their work was saved as-is, **unreviewed**. Read the branch diff before reusing it. Every `wip/*` branch is behind `main`, so merge `origin/main` first.

Limit agents by file overlap first. On a small machine, also run at most 3–4 at once. While iterating, run only the test files you touch (`pnpm vitest run tests/x.test.ts`) plus `pnpm check:fast`. Run the full `pnpm check` once, before committing. Test behavior and invariants, not every tunable.

Design intent for everything below is in `docs/DESIGN.md`.

---

## 2. Online follow-ups
Online play is on `main`; see `docs/NETCODE.md`.

- **Host label and kick:** someone is clearly labeled `Host` in the lobby, and the host can kick players there. The label follows host migration.
- Owner: connect `slag-upstash-kv` to the Vercel project for Production and Preview, then redeploy.
- Not verified yet: real Upstash, real NAT traversal, TURN, Firefox, Safari, real phones. Cross-engine determinism has never run; dmath has only been exercised on V8.
- A guest whose link drops for 2.5 s is marked away, which pops their runner mid-race. Decide if that's right.
- Measure recovery in a 2-peer room, where no third peer confirms the loss (about 7 s expected).

## 3. Level follow-ups
Level profiles, gravity, variable size, full-window background, the open-levels rule, the parts-needed targets and the crate guarantee are on `main`.

- **Generation time:** about 237 ms per level, up 4x, and about 2.5 s at worst on one wide level. That's a visible hitch at level load. Move it off the main thread or cut retries.
- **Placed parts can block a level:** after 5 rounds of random legal placements, the judge couldn't prove 4–5 of 40 levels still solvable. They aren't proven unsolvable, but nothing proves such a match stays winnable.
- **Shares by theme:** 98.3% of levels need parts and 29% need two. Mine is 48% two-part; jungle and castle are 16–18%. `TWO_PARTS` in gen tunes it.
- **Visible edge:** block themes (harbor, castle, factory) show a straight wall line where the map meets the scenery.
- `pnpm online-test --only play,bc` failed once after a clean gate and passed on rerun. Find the flake.

## 6. Mobile, round 2
**Branch:** `wip/mobile-2` (~1k lines, unreviewed). Round 1 (touch controls) is merged.

The user's feedback on a real phone: "almost playable but not quite; resolution is tough; settings is bad; probably needs zoomed in more."

- **Phone follow camera:** render-only, a tile at least ~24 CSS px, look-ahead, a vertical dead zone, clamped to the level. Pick and place start zoomed out, with pinch-zoom, two-finger pan and auto-pan near the edges. With more than one player in the match, local or remote, it frames everyone: the camera always keeps all live players on screen, which wins over the tile-size target. `?zoom=1` forces it on desktop. Keep it in its own module, because item 3 also changes the camera. Cursors must stay in world coordinates, so other players' cursors and ghost parts land in the right place whatever each player's zoom.
- `pnpm shot mobile` fails on `main`, timing out in the lobby flow. Fix that first.
- The touch tag `MOVE · push far = RUN` breaks the never-explain-the-obvious rule. Cut it.
- **HUD readability:** scale HUD text, pills and crate cards up on small screens, with tap targets of at least 44 CSS px.
- **Settings:** a full-screen sheet on phones with big rows that scrolls.
- **Verify:** `pnpm shot mobile` on iPhone SE, iPhone 13 and Pixel 7 in landscape. Nothing has been tested on real hardware yet.

## 8. Render polish
- **Liquid draw order:** `drawLiquid` still paints after players and effects, while `docs/DESIGN.md` lists liquids behind terrain.
- **`pnpm shot race` without `--race`** never starts a race: it stays in pick at frame 0.
- **Impact words** can hide a hazard for most of a second; `?lettering=0` turns them off. Decide whether they stay. Mine is the weakest theme in cel (band arcs on rock walls), and big plain walls are a taste call. Try a real phone.

## 9. Weather (new)
A per-level random variable:
- wind gusts that push runners and projectiles (reuse `src/sim/wind.ts`);
- mist that limits sight distance;
- rain or snow that changes footing.

It's always telegraphed, weighted per theme, and must be deterministic from the level seed.

## 10. Housekeeping
- Enable GitHub Actions and make `ci.yml` a required check. This must be done on GitHub by the repo owner.
- Delete the old remote branch `claude/scaffold-procgen-platformer`, and the `wip/*` branches once they're merged.
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
Nothing from the content, held-items or grab-props work has been played by hand, so the tuning is test-level only: magnet drift, bumper power, slow and freeze durations, item strength. Gamepad `use` (Y and LT) hasn't been tried on a real pad, and item sounds borrow existing cues and haven't been heard. Trackers can no longer see runners through terrain, which changes how lobbed trackers feel.

Also confirm the Match Length values (Short 30 points / 10 rounds, Normal 50 / 15, Long 80 / 25). They come from a Monte Carlo model of scoring with a fixed finish rate, and real finish rates probably fall as props pile up. The limit decides about 25% of 2-player Normal matches at typical finish rates and about 60% at very low or very high ones.

## 16. Fix WebGL failure paths
Both are now visible in Sentry.

- There's no WebGL context-restore handling, so a lost context stays lost for that session.

## 14. Clear the lint warnings
`pnpm check` prints 7 warnings, in `src/ui/touch/overlay.ts`, `src/ui/touch/device.ts`, `src/input/input.ts`, `src/render/props/modules/vehicle.ts` and `src/audio/system.ts`. AGENTS.md treats warnings as real findings. Do it with or after item 6, which also touches the touch code.

## 15. Parody pass on items and parts
The game's goal is to parody other games, especially with items (`docs/DESIGN.md` → Parody). The current items and parts were written to be neutral, so they don't do that yet: Foam Sword, Ricochet Puck, Boomerang, Pop Shield, Pocket Rocket, Smoke Bomb, and the parts from the content work.

- Rework names, art and twists so each one mocks something recognizable.
- Our own names and art only.
- No explaining the joke.

## 17. Finish Sentry setup
Some steps need the owner. Run after setting the Vercel env vars.

- Set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` in Vercel (Production and Preview). An organization auth token is best.
- On the first deploy, confirm source maps upload and client frames resolve to source. Only the failure path has been tested.
- Install the Sentry GitHub integration for suspect commits.
- Move `app/global-error.tsx` into `src/` with item 11.

## 18. Fewer, clearer parts per match
There's too much variety in the crate, and it's confusing. **Next up once item 3 lands**, because that changes `generateCrate`.

- Each match picks N unique parts, from the seed, and every crate that match draws only from those. Players learn a small set.
- A part's variants differ in size only. No other rolled differences in a match, so a part always behaves the way you remember.
- The roster must always include enough building and demolition parts for item 3's crate guarantee and dry-round weighting.
- Pick N from how it plays, per player count, and consider per-Match-Length if it helps.
- Names stay stable across a match. Do this before item 15's parody pass.

## 19. Secret parts mode
A mode where you don't see what a part is. You choose a type (hazard, utility, build, whatever the roles are) and get one at random from what's allowed. A lobby rule, with the roll deterministic from the seed and the same on every peer. The first time anyone sees the part is when it lands.
