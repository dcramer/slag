# TODO agenda

These are the open work items, ordered by priority. Each one is sized for one agent.

Limit agents by file overlap first. On a small machine, also run at most 3–4 at once. While iterating, run only the test files you touch (`pnpm vitest run tests/x.test.ts`) plus `pnpm check:fast`. Run the full `pnpm check` once, before committing. Test behavior and invariants, not every tunable.

Design intent for everything below is in `docs/DESIGN.md`.

---

## 27. AI players and player scripts (future)
Brains that fill seats by producing inputs, built in or written by players. Design: `docs/DESIGN.md` → AI players. Native AI first (phases 1–2); scripts after. Each phase is one agent, in order.

Phase 1 is in (`src/brain/`), with mistakes at every level: a bot alone with the plan built finishes (gentle, medium, hard level) Easy 73, 58, 58 of 100, Normal 93, 65, 60, Hard 93, 78, 88 (`tests/stats/bot-finish.test.ts`, targets in DESIGN.md → AI players). Left over from it, for phase 2: shots that steer or bounce and hazards set off by runners aren't forecast; a way the route counts on that's shut when the bot gets there (a door on its cycle) sends it on a leap of faith rather than waiting for it; a second bridge with the plan's spots taken goes anywhere legal rather than somewhere it helps; the host must be seated to add bots.

2. **Spite in the race.** Temperaments, grudges and spiteful picking and placing are in (`src/brain/temperament.ts`, `grudge.ts`, DESIGN.md → AI players → Temperaments and grudges). Against other bots a trap on the target's trail rarely kills: a bot routes round a hazard where it once stood (Hard, 4 bots, 10 matches: 1 kill in 16 spiteful placements), so check it on people first. Blocking is in too (DESIGN.md → AI players → Bots get in the way); a steady Hard bot over Hard bots' parts now dies mostly to hazards in the way (`tests/lib/hard-routes.ts`), which the motor could foresee better (farm/4 with three Hard placers is one). Left: shove a grudge target toward a hazard, perch on it, stand on a one-tile bridge; use held items on a target; a trap that turns the target's jump tight rather than standing in its way; avoid sealing its own way unless it holds a bomb; host-owned bot seats online, moving with host migration.
3. **Player scripts.** A Web Worker sandbox with a per-frame deadline, the published `brain-api.d.ts`, the Workshop screen (load, trial over seeds, report, replays) and `pnpm brain trial`.
4. **Copy for Your AI.** The prompt pack: API, current script, worst failures from the last trial.

- Decide with the owner: player scripts in online rooms and the lobby list, whether bots and scripts score (today a bot scores and can win like anyone), how far the lookahead sees, and whether senses name prop kinds.

## 2. Online follow-ups
Online play is on `main`, verified by real-browser checks in `pnpm online-test` and the Upstash-compatible `pnpm test:store`. See `docs/NETCODE.md`.

- **Owner:** connect `slag-upstash-kv` to the Vercel project for Production and Preview, then redeploy.
- **Not verified:** real Upstash, real NAT traversal, TURN, Firefox, Safari, real phones, and cross-engine determinism. dmath has only run on V8.
- **Decide:** two-peer host loss takes about 7.7 s, against about 4 s with three or more peers. Lowering `PROBE_MS` to about 3 s for two-peer rooms saves about 1 s but risks two hosts when the store is slow.
- Two guests that lose a live host at the same moment still move the room to the next peer, as if the host had died. The brief second host steps down within about 3 s.

## 3. Level follow-ups
- The winnability proof assumes timed hazards can be passed in their 30-frame openings, and only uses 2-bridge plans.
- Hard levels land in their band (two or more tight jumps on the more forgiving route) only about half the time, so bots finish them about as often as medium ones and miss their hard-level targets (DESIGN.md → AI players): a level has little room for tight jumps besides its part's crossing, and its second route walks round them. A layout family built for hard levels (islands and perches over the void) is the real fix. Static hazards hugging landings and jump arcs with proven clearance, and a wall-jump shaft the route needs now and then, would add to it.
- The castle chandelier and the volcano lava tube's drips are the same hazard (a dropper from the ceiling), so the chandelier's `unique` check is waived. Decide which keeps it.
- The canopy village, the gatehouse and the trestle line roll too few dials for their seeds to stay apart (waived in `tests/conformance/lib.ts`): give each more to vary.
- The rooftops falling sign rarely finds a spot on plain levels (a few in a hundred): it needs a ceiling or a wall over flat ground, and harder levels break the ground up.

## 6. Real phones
Phone support (follow camera, pinch, scaled HUD, settings sheet) is on `main` but has only run in Chromium emulation. Try iOS Safari and a real Android phone: `:has()` in the sheet CSS, safe-area insets, pinch feel, and frame rate.


**Regression to check first:** `pnpm shot mobile --device "iPhone SE landscape"` fails its two-runner camera check ("a live runner left the screen", `[true,false]`, the same on two runs) since the perch physics and pass-through landed (`src/sim/collide.ts`, `src/sim/physics.ts`). It passed before. The iPhone 13 run and the lobby part pass.
## 8. Render polish
- **Impact words** can hide a hazard for most of a second; `?lettering=0` turns them off. Decide whether they stay. Big plain walls are a taste call. Try a real phone.

## 10. Housekeeping
- Enable GitHub Actions and make `ci.yml` a required check. This must be done on GitHub by the repo owner.
- Consider stricter TS flags: `noUncheckedIndexedAccess` gives about 600 errors, so it's a project of its own.

## 13. Playtest and tune the new parts
Nothing from the content, held-items or grab-props work has been played by hand, so the tuning is test-level only: magnet drift, bumper power, slow and freeze durations, item strength. Gamepad `use` (Y and LT) hasn't been tried on a real pad, and item sounds borrow existing cues and haven't been heard. Trackers can no longer see runners through terrain, which changes how lobbed trackers feel.

Size tiers for parts are a mapping of the old rolled ranges, so check them too; bumper and spike strip changed most. Confirm the Match Length values (Short 30 points / 10 rounds, Normal 50 / 15, Long 80 / 25). They come from a Monte Carlo model of scoring with a fixed finish rate, and real finish rates probably fall as props pile up. The limit decides about 25% of 2-player Normal matches at typical finish rates and about 60% at very low or very high ones.

**Undecided: character height.** Characters fit a one-block gap today. The owner wondered about a 1.5- or 2-block gap, since one block feels less interesting, then leaned back toward one. Decide in playtest. Changing it means redoing level design and `reach.ts` tuning.

## 21. Ink art leftovers
- The geyser vent can't stand taller until the sim gives it a solid rim, and the reach proof and the set-piece placer both have to see that rim (`docs/ART-QA.md` → "Needs a sim change").
- The parts still under the bar are ranked in `docs/ART-QA.md` → "Next in the queue".

- **Round hulls:** Ring Station and the Planetoid (space) draw stair-stepped hull edges, because their collision is whole tiles. Following the curve needs sub-tile fairing solids in each step notch (a few hundred rects per landmark), which turns the stairs into walkable slopes, so it needs its own proof, `noFreeRide` and performance work.
- **Art that looks solid but isn't** (`pnpm shot fairplay`; the barn is fixed). Two lists wait: `PENDING_SHELLS`, 18 landmark backdrop shells that match their own walls through gaps (boiler house, starship, lavafall organ, gatehouse and more), each needing its own art pass; and `PENDING`, set-piece machines drawn in front with no collision (guns on ledges, rotor hubs, swinger hubs, ladles, carts, signs, posts, water before it floods), which the owner wants made solid ("Make them solid"): each gets a body solid matching what it draws, kept out of the solution's way and checked by `noFreeRide`, the static proof and conformance.
## 15. Parody names: decide on sound-alikes
Names now parody genre tropes (`docs/PARODY.md`). A few are deliberate sound-alikes of trademarked names: Chain Chump, Thwunk, the -omb suffix, Master Noodle, Yolo Blocks. Decide whether to keep them.

## 23. Check link previews on a deploy
Icons, manifest, Open Graph and Twitter tags, and oEmbed are on `main`, regenerated with `pnpm brand`. These need a deployed URL to check:

- Real unfurls in Slack, Discord, iMessage, X and LinkedIn.
- Add to Home Screen on iOS and Android.
- Whether a 16 px tab shows the pixel S.
- Vercel Deployment Protection blocks unfurl bots on preview URLs.

## 17. Finish Sentry setup
Some steps need the owner. Run after setting the Vercel env vars.

- Set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT` in Vercel (Production and Preview). An organization auth token is best.
- On the first deploy, confirm source maps upload and client frames resolve to source. Only the failure path has been tested.
- Install the Sentry GitHub integration for suspect commits. The build already associates each release with `VERCEL_GIT_COMMIT_SHA` in `VERCEL_GIT_REPO_OWNER/VERCEL_GIT_REPO_SLUG`; Sentry needs the repo linked under that name.
- On the first deploy, check one real event has the tags and contexts in `docs/TELEMETRY.md`, and that `host migration` logs and `/api/net/*` traces arrive.

## 22. Glacier and space follow-ups
Both themes are on `main`. Space has no weather. Ice skids and 0.55 space gravity are measured, not played by hand.

## 31. Playstyle modes
Modes are entries in `MODES` (`src/game/modes.ts`, DESIGN.md → Modes). Rising Slag is in. Next, one agent each:

1. **Rising Slag: playtest and tune.** The slag's floor pace, leash per lap and squeeze (`src/gen/level/tide.ts`) are fitted to bots, not played by hand: against the difficulty standard (`tests/stats/slag-climb.test.ts`, 32 seeds) Normal bots land within 7 points of their targets. Catch-up for the trailing pack is open (owner: rethink which items exist, and maybe mystery boxes in every loop, not only placed ones): today nothing reels a runaway leader back but the winged shell. Farm, harbor and space loop on first-pass tower kits (barn lofts, pier decks, a station shaft in `sculptors/tall.ts`): give them landmarks of their own for a shaft (a silo, a lighthouse or crane, a docking spine) once concepts can stand in a loop. On a phone the Race emblem (a chequered flag) sits beside Rules' flag icon and reads alike. The world is drawn once per copy of the loop the view sees, so render-side state in prop art (a rope's rig) can step twice near the seam; ragdolls, self-destruct rings and impact words of a runner a lap away aren't moved onto the leader's lap. No sound yet: a pour and a rising boil.
2. **Brawl.** Last one standing in an arena, knocked into hazards or the pit; the losers of a round pick and place parts into the arena. Needs spawn points for every player (`Level.spawns`, additive), an arena sculptor, items on spawners, and a fight brain. Decide with the owner first: one-hit lethal items, or knockback into the level only (today's rule: items never kill).
3. **Gauntlet.** Co-op: everyone must finish, and the crate deals hazards. Scoring flips Race's "everyone finished scores nothing".

## 32. Set kits and level builders
Owner direction (docs/DECISIONS.md → Levels): a level set is a kit of pieces with declared attributes, and the level builders compose any set's kit, so every set supports every mode. Every set has a tower kit now, so Rising Slag loops everywhere. Landmarks, set pieces and decor already declare contracts that conformance enforces; what's left is the shapes, which each set's sculptor writes by hand today. The tall builder over `TallKit` is the pattern: one builder, a few pieces per set. In order, one agent each:

1. **The kit contract, written down**: what a set provides (ground and floor profiles, connectors with their rise and reach, walls and shells, gap styles, its landmarks, hazards and decor) and what a builder may ask of them, as data in the registry, with a conformance check that every set provides every kind.
2. **Builders, one at a time**: the course (ltr, classic and wide), the climb and the descent, each moved off the per-set sculptors onto kits, holding the race's numbers as they go (`pnpm level --stats 50`: no fallbacks, needBridges, parts shares, open routes, precision bands). Then a Brawl arena is one new builder.

## 30. Native build
A real game binary that runs the same TypeScript in a native host (owner decision: no Electron). The sim and generators stay as they are, because lockstep crossplay with the web build needs the same code. Steps, one agent each:

1. **The DOM screens onto canvas.** Settings, Rules and the name screen are canvas on `src/ui/kit/`. Next: the main menu, the lobby list, About, 404 and the error screen, then the codex. `homeHTML()` stays as the web build's first paint.
2. **A version gate on join.** Peers from different builds desync today: `SNAP_VERSION` covers the snapshot format, not the generator. Join should refuse a peer whose build differs.
3. **The native host.** SDL3 for the window, input, pads and audio out, a JS engine for the game, and only the browser APIs the game uses: Canvas2D (Skia), WebGL2 (ANGLE), Web Audio, WebRTC data channels (libdatachannel), and the kit's `TextEntry` over SDL text input. Online play uses `setSignalBase` and an origin allowlist (`docs/NETCODE.md` → Portability).

## 25. Idea: switchable art styles
The owner called switching art styles "a fun gimmick" while making cel the only look (`docs/DECISIONS.md` → World art). It's not scheduled. If it comes back, cel stays the default and the switch is a novelty, never a setting players need.

