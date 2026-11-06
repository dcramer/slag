# TODO agenda

These are the open work items, ordered by priority. Each one is sized for one agent.

Limit agents by file overlap first. On a small machine, also run at most 3–4 at once. While iterating, run only the test files you touch (`pnpm vitest run tests/x.test.ts`) plus `pnpm check:fast`. Run the full `pnpm check` once, before committing. Test behavior and invariants, not every tunable.

Design intent for everything below is in `docs/DESIGN.md`.

---

## 27. AI players and player scripts (future)
Brains that fill seats by producing inputs, built in or written by players. Design: `docs/DESIGN.md` → AI players. Native AI first (phases 1–2); scripts after. Each phase is one agent, in order.

Phase 1 is in (`src/brain/`), with mistakes at every level: a bot alone with the plan built finishes (gentle, medium, hard level) Easy 73, 58, 58 of 100, Normal 93, 65, 60, Hard 93, 78, 88 (`tests/stats/bot-finish.test.ts`, targets in DESIGN.md → AI players). Left over from it, for phase 2: shots that steer or bounce and hazards set off by runners aren't forecast; a way the route counts on that's shut when the bot gets there (a door on its cycle) sends it on a leap of faith rather than waiting for it; a second bridge with the plan's spots taken goes anywhere legal rather than somewhere it helps; the host must be seated to add bots.

2. **Spite in the race.** Temperaments, grudges and spiteful picking and placing are in (`src/brain/temperament.ts`, `grudge.ts`, DESIGN.md → AI players → Temperaments and grudges). Against other bots a trap on the target's trail rarely kills: a bot routes round a hazard where it once stood (Hard, 4 bots, 10 matches: 1 kill in 16 spiteful placements), so check it on people first. Blocking is in too (DESIGN.md → AI players → Bots get in the way); a steady Hard bot over Hard bots' parts now dies mostly to hazards in the way (`tests/lib/hard-routes.ts`), which the motor could foresee better (farm/4 with three Hard placers is one). Left: shove a grudge target toward a hazard, perch on it, stand on a one-tile bridge; use held items on its grudge target first (they use them on whoever is in range: `src/brain/tactics.ts`); a trap that turns the target's jump tight rather than standing in its way; avoid sealing its own way unless it holds a bomb; host-owned bot seats online, moving with host migration.
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
- Race scoring against its reference (docs/MODES.md → Race): we have no Solo bonus (the reference pays a lone finisher among three or four three fifths of a finish). Owner call.
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

## 31. Kinds under the colour bar
The bar is the clean colour read (owner, 2026-11-06; tools/art3d/CHECKLIST.md). A clean audit that day, three readers outside the repository on `sprites-blind-colour.png`, left these unnamed or named only at low:
- **Never named:** the engineer (paired with the plumber), the warrior (paired with the slayer, "Shovel Knight, low"), the assistant dog ("Amy Rose, low"), the top-hat girl, the dragon, the rapper, the horse ("Epona, low") and the slayer ("a viking, low").
- **Redrawn to pass:** the sneak (a cardboard box with the "!"), the zapmouse (black ear tips, red cheeks, the bolt tail: "Pikachu, high" in cyan and in purple), the elf (a cap on a band: "Link, high" in blue) and the creeper (a square box with the frowning face).
- **Pairs readers keep naming in colour:** two Kirby-like blobs (the puffball and whichever round stand-in or kind rolls near it), and the hunter with the robot boy ("both blue armour with an arm cannon").
- **Only at low:** the bear, the pyramid and the vampire (one reader at medium each), the hedgehog and the worm (likewise), the archer.
- The warrior, the slayer and the assistant are accepted as colour reads by the owner. That was before the colour read was the bar, and they fail it too.
- **The player's colour hides the homage:** the hedgehog read as "an orange spiky creature" in the colour it rolled (the zapmouse's read as "a purple cat" until its redraw). The owner keeps the rule (2026-11-06: player colour only, no signature colour kept), so these kinds must read by shape in any colour: push the outline (the zapmouse's ears and bolt tail, the hedgehog's quills and shoes) until the colour read passes in a colour that isn't theirs.

The black read (`sprites-blind.png`) named about 20 of 46 cleanly. It's the harsher diagnostic now, not the bar.

A full-cast read (2026-11-04, every kind drawn, cells wide enough for a held prop; two fresh readers) agrees: the warrior "King Dedede, low" twice (a round body under a tall headpiece); the slayer "Princess Peach or Zelda, low" twice (his long coat reads as a gown, his hair as a princess's). The worm passed at medium twice. Both readers also paired the plumber with the engineer (4 and 22, capped and moustached), the robot with the hunter (the arm cannons) and the hopper with the dino (a round head with a long snout); the merc read as "Crash Bandicoot or Tails, low" twice.

Pipeline bugs the redraws worked around: `paintOver` (`tools/art3d/flat/build.ts`) paints a speck over in its majority colour, so an eye traced to a few pixels floods the face with skin (the fighter set `min.eye: 5`); paint a speck by its own role, or skip specks under a few pixels. And `pnpm shot variety --theme mine` came out byte-identical to the light theme for the slayer's agent; check `--theme` reaches the scene.

Tools that would have saved their agents turns: a design read from a quick trace of the design at blind-sheet size (a design read from the drawing passed the slayer at medium while the traced sheet failed); a `keep` list of white roles exempt from `holes` (the hopper's and the slayer's tint scripts); keeping a design prompt under about 900 characters, since the image model drops what comes last.

## 32. Grow the cast toward 100
Tripo's `403: Your project has been banned due to violation of our policy` refuses that one prompt (it flags what reads as copyright), not the account: README → Tripo's refusals.

The owner is happy with about 100 kinds, from every genre, with more iconic women. Candidates the cast doesn't have yet, each with the one shape that would carry it in black at play size (★ a woman). Pick by that shape first: a kind needs an outline nobody else in the cast has, so check the pairs listed against what's there (the elf and the merc are already two slim swordsmen, and the slayer a heavy-set third). Seat a batch through the contract step (`CAST`, names, `PAINTS`, `READS_AS`, `CAST_NOTES`, a `docs/characters/<kind>.md` entry, `LOOK_CAST`), then one agent a kind (tools/art3d/CHECKLIST.md).

Drawn (2026-11-05): at `LOOK_CAST` 12, `mage`, `creeper` and `tophat` pass the blind read and `pyramid` doesn't; at 13, `invader`, `vampire` and `sim` pass and `assistant` doesn't (31). Redrawn (2026-11-06): `rapper`, `fighter` and `pyramid` now pass. At 14 (2026-11-06): `succubus`, `archer`, `slime` and `bear` all pass on their first blind round, at 24–30 credits each. Being drawn (seated 2026-11-06, `LOOK_CAST` 15): `mech`, `genie`, `mushroom`, `boxer`; and the puffball, redrawn with a stronger twist (the owner: "kirby looks.. too much like kirby right now").

- **Platformers:** Crash Bandicoot (spiky fur tuft, huge grin, spin); Banjo and Kazooie (a bear with a bird out of his backpack); Ratchet (big lombax ears and a wrench); Sly Cooper (raccoon mask, a hooked cane); Klonoa (huge floppy ears, a cap); Sackboy (a knitted doll with a zip); Shovel Knight (horned helmet, a shovel); Super Meat Boy (a red cube with legs); Madeline ★ (hair streaming, red then blue); the Knight from the bug kingdom (a horned white mask, a cloak: beside the stinger, a pair to watch).
- **Shooters:** the space marine in the green visor helmet (bulky, a visor); the doom marine (helmet, a shotgun); the physicist with the crowbar and glasses; the time-blinking pilot ★ (spiky hair, goggles, the glowing disc on her chest).
- **Fighting:** the headbanded wanderer in a torn gi (a fireball pose); the yellow ninja with the rope spear; the stretching yogi (limbs that reach); the scarf-and-leotard commando ★ (twin braids, a beret).
- **RPG and action:** the moogle (a red pom-pom on a stalk, tiny wings); the yellow riding bird; the keyblade boy (spiky hair, giant shoes, a key for a sword); the bald god-killer (a red stripe, chained blades); the punny skeleton (a hoodie, a wide grin); the bob-haired swordswoman ★ (a blindfold, a long blade).
- **Horror:** the miner in the segmented suit (a spine of lights).
- **Puzzle and arcade:** the green-haired lemming in a blue robe (falls with an umbrella: a natural for a platformer); the bomber (a round white helmet with an antenna ball: readers already guessed it); the frog crossing the road; the digger with the pump; the T-tetromino with legs; Ms. dot-eater ★ (the bow; beside the chomper, a pair to watch).
- **Life sims and strategy:** the shopkeeper raccoon in an apron; the villager kid; the "work work" peon (green, tusks, an axe); the red-cloaked settler with a torch.
- **Sandbox and online:** the noob avatar (a yellow block head, blue torso); the jelly-bean contestant (a bean in a onesie); the cloaked lamb cult leader (a red crown, a wool face); the yordle scout (a mushroom-pointed hat).
- **Racing and sports:** the skateboarder (a beanie, the board under his arm); the baseball-capped golf pro.
- **Stealth and spy:** the bald hitman with the barcode (a suit and red tie); the operative with three green lights on his goggles; the parkour runner ★ (a red-tattooed arm, a sprinting lean).
- **Point and click:** the mighty pirate (a ponytail, a puffy white shirt); the dog detective and his rabbit (a fedora, long ears).
- **Rhythm and music:** the guitar hero (a mohawk, a guitar); the crypt dancer (a dagger, a beat in every step).
- **Indie mixed:** the crying bald kid (tears for a weapon); the god-blooded prince with a laurel (a flaming foot, a sword); the masked rooster in a letterman jacket; the spelunker in a pith helmet with a whip; the fez wearer; the wandering cloaked traveller with a scarf (Journey's red robe, a long scarf).

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

1. **Rising Slag: playtest and tune.** The slag's floor pace, leash per lap and squeeze (`src/gen/level/tide.ts`) are fitted to bots, not played by hand. Rounds now last (docs/MODES.md → Rising Slag, `SLAG_ROUNDS`): the field starts spread over four spawn cells, the leash opens 16 rows longer at GO, and the squeeze starts from the first one out (or 30 s); 8% of four-bot rounds are over by 15 s (from 41%), median 25.6 s. **Catch-up still doesn't work** (`tests/stats/slag-catch-up.test.ts`, 512 seeds): the leader at 15 s wins 64% with boxes, 59% with items in every hand, 66% bare, against about half; bots with equal skill and no items keep it, so the shaft's shape holds the lead. Tried without a gain: twice the boxes, holed floors, narrower ledges, deeper wells, no chimney, more passing ledges, the leader dealt only the shield. Owner call: something that regroups the pack (a lift or gate on a cycle the leader waits for), or items that cost the leader seconds rather than a bonk. A lone climber's laps don't harden toward `PASS_TARGETS`: a slip costs a row, rarely a lap, and a shorter hard-lap leash only spoils four-bot rounds. Owner call: bigger falls, or a pace-driven difficulty. The leash opens 16 rows past the leader camera's 25 (`LEAD_VIEW_DOWN`), so for the first ~13 s the slag is off the bottom of the screen: frame down to it, or shorten the opening, after a playtest. Which items exist is open (owner: rethink them): the shell and the smoke do little in a shaft. Farm, harbor and space loop on first-pass tower kits (barn lofts, pier decks, a station shaft in `sculptors/tall.ts`): give them landmarks of their own for a shaft (a silo, a lighthouse or crane, a docking spine) once concepts can stand in a loop. On a phone the Race emblem (a chequered flag) sits beside Rules' flag icon and reads alike. The world is drawn once per copy of the loop the view sees, so render-side state in prop art (a rope's rig) can step twice near the seam. The slag's boil and pour aren't balanced by ear yet.
2. **Brawl: playtest and tune** (docs/MODES.md → Brawl, `BRAWL_ROUNDS`). Bots line rivals up with what kills them (`knockedInto`): 6% draws bare and 17% with parts placed (near the band's 18%), rounds about 28 s, four Normal bots. Half the deaths with parts placed are bots walking into parts unknocked, some placed right by a spawn by the shared placement brain. The motor's `leap` and `hop` don't check hazards or the map's open sides (the brawl no longer leaps); bots crowd one box and pop about 3 of the ~15 a round could give. With `placeSeconds: 0` a bot that finds no legal spot hangs the place phase (seed 30). Owner calls: a third of bare rounds run under 20 s (the reference game's are 8–10 s); whether to play quick bouts between placements. The Mode card isn't checked at phone size (`pnpm shot mode` clicks fixed 16:9 points).
3. **Gauntlet.** Co-op: everyone must finish, and the crate deals hazards. Scoring flips Race's "everyone finished scores nothing".

## 32. Set kits and level builders
Owner direction (docs/DECISIONS.md → Levels): a level set is a kit of pieces with declared attributes, and the level builders compose any set's kit, so every set supports every mode. The contract is in (`SET_KITS`, `KIT_KINDS`, `src/gen/AGENTS.md` → Set kits and level builders), every set has a tower kit (Rising Slag loops everywhere), and every set's course, climb and descent come from builders (`src/gen/level/builders/`), levels unchanged. Next, one agent each:

1. **Landmark levels onto the plans.** Harbor, space, rooftops and mine still lay out a level round a landmark their own way (each kit's `stage`), and mine's has a loop that re-rolls its own length every pass. Move them onto the chain and carved plans, holding `pnpm level --stats 50`. The two-part ask share is still keyed by theme in `TWO_PART_ASK` (`sculptors/common.ts`); it belongs on the kit.

## 33. Audit leftovers (2026-11-04)
An audit of the loop, sim, netcode, generator and renderer found the core sound. Landed since: render interpolation, a bot time budget, a guest jitter buffer, reuse of repeated reach proofs, a late joiner waiting on the level worker, and camera culling plus fixed layer storage in the renderer (lights, the HUD and the place-phase previews measured 0.1–0.5 ms and stay). Reusing proofs saved about 6% of a level's time, not the 40% estimated: profile `pnpm level` before another pass at generation speed. The rest is here, one agent each.

1. **Difficulty by redraw.** 35–49% of gentle and hard levels use every draw and ship outside their band anyway (see 3 above), then the nearest draw is sculpted again from scratch (`level/index.ts`, after `keepIf`). Keep the best draw's state instead of rebuilding it; sizing crossings toward the target as they're laid is the real fix.
2. **Generation context.** `setProbeGravity` and `setLevelDifficulty` are module globals read from 34 places through `jumpProfile()` and `difficultyKnobs()`, so `generateLevel` can't be re-entered and a helper called later sees the previous level's gravity. Pass a context down.
3. **Prop sprite cache** (`ink-props.ts`): FIFO at 220 entries re-bakes pieces still in use, every stamp bakes at a fixed 6× density (aliases at 1080p, blurry at 4K), and keys are strings built per draw. The runner cache (scale buckets, LRU, byte budget) already does this right.
4. **Who hosts.** The first to join hosts, phone or not, and a host's hitch stalls everyone. Prefer a desktop on a good link, or let the host hand over (`handOn` exists). Further out: a standby link to the next host in line so migration skips signaling (4–8 s today).

## 30. Native build
A real game binary that runs the same TypeScript in a native host (owner decision: no Electron). The sim and generators stay as they are, because lockstep crossplay with the web build needs the same code. Steps, one agent each:

1. **The DOM screens onto canvas.** Settings, Rules and the name screen are canvas on `src/ui/kit/`. Next: the main menu, the lobby list, About, 404 and the error screen, then the codex. `homeHTML()` stays as the web build's first paint.
2. **A version gate on join.** Peers from different builds desync today: `SNAP_VERSION` covers the snapshot format, not the generator. Join should refuse a peer whose build differs.
3. **The native host.** SDL3 for the window, input, pads and audio out, a JS engine for the game, and only the browser APIs the game uses: Canvas2D (Skia), WebGL2 (ANGLE), Web Audio, WebRTC data channels (libdatachannel), and the kit's `TextEntry` over SDL text input. Online play uses `setSignalBase` and an origin allowlist (`docs/NETCODE.md` → Portability).

## 25. Idea: switchable art styles
The owner called switching art styles "a fun gimmick" while making cel the only look (`docs/DECISIONS.md` → World art). It's not scheduled. If it comes back, cel stays the default and the switch is a novelty, never a setting players need.

