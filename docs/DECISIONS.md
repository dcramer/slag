# Owner decisions

Every game design decision, preference and direction the owner has given, grouped by topic. Compiled 2026-11-02. [DESIGN.md](DESIGN.md) holds the rules as they stand; this is the log behind them. A decision that was replaced or no longer applies is pruned: the one that replaced it says what it replaced in its Changed note.

**Sources.** Every Claude Code transcript for this project on this machine (the coordinating session of 2026-11-02 and a short pnpm-config session the same day): the owner's own messages and their answers to questions, never subagent output. Earlier sessions ran on other machines and their transcripts are gone, so they're covered only through git history: commit messages and the history of `DESIGN.md`, `ART.md` and `TODO.md`. A decision taken from git cites its commit; one from a transcript cites its time (UTC). All dates are UTC.

**Each entry** is the decision in one sentence, then its date, source, status and where it lives.

- `done`: on `main`.
- `in progress`: an agent is building it now.
- `planned`: scheduled in [TODO.md](TODO.md), [SETPIECES.md](SETPIECES.md) or [PARODY-BACKLOG.md](PARODY-BACKLOG.md).
- `open`: decided but not scheduled, or still undecided.

**Changed** notes record what a decision replaced.

## Vision and direction

- **slag is a browser party platformer: pick a part from a crate, place it in the level, race to the flag, with levels, parts, characters and names all generated from a seed.**
  2026-11-01 · git `dfa1697` · `done` · AGENTS.md intro, DESIGN.md → Core loop
- **The goal is to parody other games, especially with items.** "as part of game design: our goal is to parody other games (especially when it comes to our items)"
  2026-11-02 03:44Z · `done` · DESIGN.md → Parody, PARODY.md
- **The parody wells are the build-then-race party platformer (core gameplay), Nintendo's games (homages across many franchises) and the crossover brawler (lots of items and levels).**
  2026-11-02 16:03Z · `done` · DESIGN.md → Parody
- **Beyond those, take inspiration from iconic pop-culture games in general, starting with the team shooter's sentry turret, and make a list of candidates.** "we should be inspired by other pop culture video games. might be worth making a list"
  2026-11-02 16:55Z · `done` for the sentry gun and the ranked list; the rest is `planned` · DESIGN.md → Parody, PARODY-BACKLOG.md
- **A parody is ours: our own name and art, never the original's real name, art, characters or level designs.**
  2026-11-02 · git `647392d` · `done` · DESIGN.md → Parody, AGENTS.md intro
- **Whether to keep the deliberate sound-alike names (Chain Chump, Thwunk, the -omb suffix, Master Noodle, Yolo Blocks) is undecided.**
  2026-11-02 · git `d42c085` · `open` · TODO.md → 15
- **Never explain the obvious, in the game, the docs and agents' replies: no sub lines, hints or notes that restate the screen or spell out a rule.** "you have this habit of 'expalining the obvious'. never 'explain the obvious' - put it in AGENTS.md, but its also part of the game design"
  2026-11-02 03:36Z · `done` · DESIGN.md → Discovery, ART.md → Casing, AGENTS.md → Conventions
  Changed: verdict lines such as "Everyone made it, so nobody scores." and the lobby's "First to 50" sub line were cut (`82da079`).
- **Part of the joy of the game is the unknown.** "part of the joy of the game is the unknown"
  2026-11-02 03:36Z · `done` · DESIGN.md → Discovery
- **Items are part of the unknown too: no tutorial text, and the codex doesn't explain them.**
  2026-11-02 · git `5bbf24c` · `done` · DESIGN.md → Discovery
- **The main menu's short sub lines are the one exception to the no-sub-lines rule.**
  2026-11-02 · git `d67a7e0` · `done` · DESIGN.md → Discovery
- **Not everything is death: most parts have an upside and a side effect, and disruption is the norm.**
  2026-11-02 · git `7b4a0d2` · `done` · DESIGN.md → Props
- **Every game design decision is written down, even as endless lists; one that was replaced or no longer applies is pruned, and what replaced it keeps a Changed note.** "make sure all of my game design things are documented. even if its just like infinite listicles somewhere" / "old decisions that are no longer relevant should also be cleaned up"
  2026-11-02 17:52Z, 2026-11-04 · `done` · this file
  Changed: the log kept every decision for all of time, reversals included ("i kind of want decisions for all of time").
- **A really short lore guides design: Slag is the runoff of the Great Foundry, a scrap world of melted-down levels and characters who never made the cut, racing for the one mould that casts the winner into a real game.** "we might want in our game design a REALLY short piece of lore that explains the world of slag, who the characters are, why they're trying to get to the goal"
  2026-11-02 · `done` · DESIGN.md → Lore

## Match flow and rules

- **A match starts from a Start button, not by itself: once everyone is ready and the mode has enough players, Start appears and someone presses it.** "i think when everyones ready, there should still be a start button (when conditions are met) somehow"
  2026-11-06 · `done` (a host-only `start` action online, anyone seated offline; a lobby of bots alone still starts itself; `SNAP_VERSION` 59) · DESIGN.md → Lobby, NETCODE.md · Replaced: the match starting the moment everyone is ready.
- **A round is lobby, pick, place, race, score; parts stay for the whole match, so levels get more dangerous every round.**
  2026-11-01 · git `dfa1697` · `done` · DESIGN.md → Core loop
- **Matches take 1–8 players.**
  2026-11-01 · git `a8f55f9` · `done` · DESIGN.md → Core loop, `MAX_PLAYERS`
  Changed: the scaffold was 1–4 local players.
- **A match also ends at a round limit, in case nobody can win.** "its not just first to 50 points. there will be a max number of rounds too in case the game is just unwinnable"
  2026-11-02 03:12Z · `done` · DESIGN.md → Scoring
- **One Match Length setting sets both limits: Short, Normal (50 points or 15 rounds, the default) and Long.** "40 rounds is WAY too many... i was thinking 15? ... you can also have a setting for match length, short/normal/long?"
  2026-11-02 03:26Z · `done` · DESIGN.md → Scoring, Rules; `src/game/rules.ts`
  Changed: the round limit was its own setting, defaulting to 40 (`203e3b1`).
- **The round limit has no "off": scoreless rounds could run forever.**
  2026-11-02 · git `203e3b1` · `done` · DESIGN.md → Scoring
- **The Match Length values still need confirming in a playtest.**
  2026-11-02 · git `d8000bb` · `open` · TODO.md → 13
- **An unfinishable round 1 is expected, and the design says so.** "that totally makes sense for round one, and you can put that in our design that its expected"
  2026-11-02 04:15Z · `done` · DESIGN.md → Core loop
- **The place timer defaults to 15 seconds.** "for part placement, it should have a default timer on, of 15s i think"
  2026-11-02 06:30Z · `done` · DESIGN.md → Rules
  Changed: the place timer was off by default (`54c9529`).
- **The pick timer defaults to 15 seconds and hands stragglers a random leftover; the race timer defaults to off.**
  2026-11-02 · git `54c9529` · `done` · DESIGN.md → Rules
- **Weather is a level rule: on or off.** "Weather should also be a level option. On and off I guess"
  2026-11-02 06:58Z · `done` · DESIGN.md → Rules
- **How long blood lasts is a rule.** "This should be a config setting probably"
  2026-11-02 06:57Z · `done` · DESIGN.md → Rules (Blood rounds)
- **Secret Parts mode: you pick a role (build, hazard, utility, demolish) without knowing the part, and get one at random from the match's parts.** "a mode thats like secret blocks, where you dont know what it is, but you choose hazard/utility/block"
  2026-11-02 04:56Z · `done` · DESIGN.md → Props (Secret Parts), Rules
- **Add alternative playstyle modes that keep the game's graphics and reuse its parts where they make sense; Rising Slag first, with Brawl (a Duck Game-like knock-them-off mode) and a co-op Gauntlet to follow.** "what would it look like to add alternative playstyle modes? id want graphics to be the same, sometimes we'd reuse props when they made sense" / "Rising Slag first" / "gauntlet and brawl are also great"
  2026-11-04 · `done` for the mode registry and Rising Slag; Brawl and Gauntlet are `planned` · DESIGN.md → Modes, `src/game/modes.ts`, TODO.md → 31
- **A race's comeback bonus is bigger: +8, most of a finish, as the reference game pays its comeback.** "we should def do the bigger comeback on race"
  2026-11-06 · `done` (`POINTS.underdog`; Rising Slag and Brawl keep +3, `POINTS.survivor`) · DESIGN.md → Scoring, MODES.md → Race · Replaced: +3.
- **In a brawl, items knock back and never kill; a hit keeps its half-second daze.** "its a knockback, not a knockout, to be clear. in brawl we dont want items that kill the other person, only ones that push/knock them" / "Keep the daze"
  2026-11-06 · `done` (as built: items shove and daze, the level kills) · DESIGN.md → Modes · Considered: a pure shove with no daze.
- **A brawl's items are ones that bop people into things, and not ones that only move you.** "we probably want more items that will like bop people (like the sword) to push them in this mode, and less of the items that are movement based?"
  2026-11-06 · `done` (the brawl's boxes deal swings, throws and slams only, and a new Sucker Punch, a long swing that throws sideways) · DESIGN.md → Parts, Modes · Replaced: smoke and Bubble Wrap in the brawl's deal.
- **A brawl plays several bouts on one placement: N fights in the same arena with the same parts, then pick and place again. N is a lobby rule.** Picked so picking and placing (up to 30 s) don't outlast the fighting (about 28 s a bout with bots). "we could def do like N rounds per placement and have that be a configurable thing"
  2026-11-06 · `done` (Bouts per Pick: 1, 2, 3 or 5, Brawl's own 3, every other mode 1; `MatchRules.bouts`, `ModeDef.bouts`; bots fight 80% of a match, from 68%) · DESIGN.md → Core loop, Modes, Rules, MODES.md → Brawl
- **A brawl never mists.** Mist hides about 40% of a one-screen arena, the edges that kill in it included. "No mist in Brawl"
  2026-11-06 · `done` (`noWeather: ['mist']` in its profile) · DESIGN.md → Modes, `src/game/modes.ts`
- **A mode can need more than one player to start, and Brawl needs two; bots count.** "also some play styles require more than one player before you can start (brawl is one)"
  2026-11-06 · `done` (`ModeDef.minPlayers`; the lobby's count reads `1/2 Players` while short) · DESIGN.md → Modes, MODES.md → Brawl
- **Brawl bots are semi-aggressive: they press the fight rather than run away or turtle.** "in brawl the AI needs to be semi aggressive too idk it feels a little slow and it likes to run away or turtle"
  2026-11-06 · `done` (a `press` trait by level and temperament; bots fight on until the slag is near, swing within about a second, dodge only a hit that's coming; first bonk 4.5 → 3.5 s, item uses 6.6 → 11.5 a round, knocked share 36 → 49%) · MODES.md → Brawl, `src/brain/strategies/brawl.ts`
- **Brawl bots don't stand about: the motor's caution that buys a fight nothing goes.** "Fix the motor"
  2026-11-06 · `done` (a fight's moves carry `haste`: re-pick when the target moves, read the landing in the air, line up only where it pays; still 22 → 11% bare, 26 → 15% placed; races unchanged) · `src/brain/motor.ts`, src/brain/AGENTS.md
- **Brawl gets arenas of its own, built for knocking people off things: tiers of ledges up the whole screen, edges with drops beside them, sides open to the drop, two mirrored ends.** "the brawl elvel designs might need more edges and stuff?"
  2026-11-06 · `done` (the `arena` builder; each spawn pocket keeps a two-row lip so nobody walks off at GO; deaths off the sides 13 → 41 in 48 bare rounds, knocked share 53 → 66%, draws 8 → 0%) · MODES.md → Brawl, DESIGN.md → Modes, `src/gen/level/builders/arena.ts`
- **The start's safe zone shields you for 5 s from GO, in every mode, then it's gone.** "in brawl, the 'safe zone' of your start lasts forever.. that should time out in all modes after 5s"
  2026-11-06 · `done` (`SHIELD_FRAMES`; each bout's own GO; the shield blinks through its last second; placement's protected rects unchanged) · AGENTS.md → Game rules, DESIGN.md, `src/sim/run.ts`
- **Brawl has no safe areas and knocks throw people off ledges: bots don't pause, nearly everywhere to stand has a way to die next to it, and a hit near an edge sends you over.** "also the ai pauses too much on brawl" / "theres too many safe areas, and its hard to push people off ledges etc"
  2026-11-06 · `done` (pauses of 30+ frames 1.9 → 0.3 a bot-minute; a body check in `BRAWL_SHOVE` and bots that charge it; stand cells with no way to die near 52 → 14%) · MODES.md → Brawl
- **A brawl round aims for 15–30 s (from 20–40), and item use counts per minute of fighting, not per round.** "Yes, 15–30 s"
  2026-11-06 · `done` (bare 16.5 s, placed 18.2 s; uses 24.1 / 20.5 a minute) · MODES.md → Brawl, `BRAWL_ROUNDS` (src/game/expectations.ts)
- **Each mode may change mechanics to play well: Brawl leans on items with hazards built into its arenas (still placed procedurally), and Rising Slag may get mechanics of its own.** "Its ok if each gamestyle slightly changes mechanics. Like brawl is more item focus, maybe hazards are more baked in (but still prcoedurally placed). Rising Slag could also have its own variants to mechanics to ensure gameplay is fun and competitive"
  2026-11-07 · `in progress` · DESIGN.md → Modes
- **Brawl: weapons on mirrored stands that respawn, everyone starts a bout armed, arenas built around one or two centrepiece hazards, and the slag only ends a stalemate.** "Yeah lets work through that"
  2026-11-07 · `done` (Prize Podium stands, `RunRules.armed`, the arena's centre room of pit, halls or arch with `clearWay` keeping a way round its hazards, the slag `deep`; bots wait a step short of a hazard for its gap, lone crossings 7 of 100) · MODES.md → Brawl
- **Rising Slag: fall off the bottom of the leader's screen and you're out, in place of the regroup gates; climb items made for a shaft; boosts on the hard lines.** "Yeah lets work through that"
  2026-11-07 · `done` (`RunRules.screen`, gates deleted; Social Climber, Trickle-Down, Slippery Slope; Leg Day boosts) · MODES.md → Rising Slag
- **Rising Slag's leader runs free: no solid top on the screen holding them; catch-up comes from items and the rank-based deal instead.** "Let leader run free"
  2026-11-07 · `done` (the box deal grades by rows behind, `ItemDeal.behind`; 15 s leader 47% over 512 seeds) · MODES.md → Rising Slag, `src/sim/screen.ts`
- **A leader never gets more than a tile or two past the top of the screen, and bots see only what's on screen: they never know more of the level than a player can see.** "the AI leaders shouldnt go far beyond the top tho.. like 1-2 blocks might be ok (sort of luck) but they shouldn't be able to see things players cant"
  2026-11-07 · `done` (`BrainView.sight`, `T_UNKNOWN` above it; the leader's head never past the top) · MODES.md → Rising Slag, src/brain/AGENTS.md
- **Rising Slag hands items to climbers far behind the leader without a box, so catch-up doesn't wait on reaching one.** Asked after the graded box deal topped out at 47% for the 15 s leader and 2.4 lead changes, with only one or two boxed items a round reaching anyone. "Add items, no boxes"
  2026-11-07 · `done` (Hand-Me-Downs, `RunRules.parcels`, `src/sim/parcels.ts`: 15 s leader 40%, 2.97 lead changes over 512 seeds) · MODES.md → Rising Slag
- **Brawl is won by knocking people out, not by hiding: knockouts pay, each hit you take throws you farther (fresh each bout), and a couple of weapons reach from range.** "you shouldn't be able to win by just standing around" / "maybe just make it easier to get knocked out" / "or we need more weapons or something?" / "Yes, all three"
  2026-11-06 · `in progress`: knockouts pay 5 and the last one standing 5 (`scoreKnockouts`; a still seat wins 0 of 6 matches, from 2) `done`; hits build up a quarter each, up to six (`RunRules.buildup`) `done`; two ranged weapons `done` (Rude Awakening, a lobbed alarm clock that blasts rivals outward; Catch of the Day, a rod that reels one in; brawl boxes only). An earlier slag waits on these · MODES.md → Brawl
- **Brawl's hazards are amped up: its set pieces are things that kill or knock, more of them, near the ledges.** "we may need to amp up the hazards in brawl"
  2026-11-06 · `done` (`setPieceRoles`: hazards and utility only; arenas stand 5.8 of 6, factory 2.6 → 5.5; stand cells with no way to die within 3 tiles 52 → 14%; nothing shoots into a spawn) · MODES.md → Brawl, `src/gen/level/builders/arena.ts`
- **A brawl's arena is deadly by default.** "also the arena could be a little deadly by default, thats a thing we can tweak"
  2026-11-06 · `done` (up to six set pieces from the nastiest mix) · DESIGN.md → Modes, MODES.md · Replaced: four of the usual mix.
- **In a brawl, if everyone left goes out at once, nobody wins the round.** "Highest one wins" / "actually if you all die no winners maybe?"
  2026-11-06 · `done` (as built: a draw scores nothing) · DESIGN.md → Modes · Considered: the one standing highest wins.
- **Brawl is the next mode, as knocking each other into things: hazards, the edge, your own mistakes. Items bump, bodies push on the race's physics, and parts are still placed every round.** "yeah knockback seems fun" / "maybe the whole thing is knocking people into things more like duck game less knocking off (which is also an option tho)" / "hazards exist, you get items that bump people or you can kind of push them (ideally same physics as race etc)" / "push people into a hazard to elim, push them off the edge, accidentally fall off, etc"
  2026-11-06 · `done` (first pass) · DESIGN.md → Modes, MODES.md · Considered: Gauntlet (co-op, but teamwork the solver must prove), Fall Guys-style rounds (they need arenas our levels aren't), one-hit kills.
- **Jumping up into a runner from below bumps them, in the air as well as on a ledge, instead of lifting them.** In a climb, catching up to someone's heels used to boost them. "Yes, bump in the air"
  2026-11-05 · `done` · DESIGN.md → Players · Replaced: a rising head bucked whoever it met up and off.
- **Rising Slag levels keep their theme: a mode asks for the level it needs, and each theme builds it in its own shape.** "keep in mind rising slag still needs the thematic level stuff. they might just have to support additional annotations for it?"
  2026-11-04 · `done` (a climbing profile in every theme, the slag carried on the level as `Level.tide`); themes that never build towers climb only 7–15 rows, `planned` · DESIGN.md → Modes, TODO.md → 31
- **Rising Slag towers get a difficulty curve, and difficulty expectations are standardized across modes as bot pass rates, the way the race's finish rates were set.** "these levels will also need a difficultly curve, which might mean we have to clea up the way we analyze things? we should standardize the expectations around difficulty (% win etc)" / "Yes, build it"
  2026-11-04 · `done` · DESIGN.md → Difficulty, Modes; `src/game/expectations.ts`, `TOWER_CURVE`, `tests/stats/slag-climb.test.ts`
  Changed: the race's targets lived only in its stats suite.
- **Rising Slag plays in the style of SpeedRunners: the slag follows the leader like its camera, so falling behind the pack is falling off the screen.** "speedrunners i think is what we want like that style" (after a survey of how other games pace a shared hazard)
  2026-11-04 · `done` · DESIGN.md → Modes; `src/sim/tide.ts`, `src/gen/level/tide.ts`, `src/render/camera-follow.ts`
  Changed: a fixed slag pace (2.6 tiles/s gaining 0.12), which only punished slowness: Easy bots got through 8% of medium stretches, now 43%.
- **Rising Slag is a looping shaft: climb out of the top and carry on from the bottom, so the map fits the screen and every part placed is met once a lap.** "i can see the whole map... while item placement is fine its not super useful if its randomly in the middle of a huge map?... it could be more like a map that scrolls infinitely so when you place you're in a loop?" / "yeah rising slag as a looping shaft is more interesting"
  2026-11-04 · `done` · DESIGN.md → Modes; `Level.loop`, `closeLoop` in `src/gen/level/sculptors/tall.ts`, `lapShift` in `src/sim/level.ts`
  Changed: a 200-row tower with a difficulty curve up its height. The curve now runs lap by lap through the slag's leash. Also takes in the level-edge feedback relayed from another session: walled sides, 48+ columns wide.
- **Switching modes needs a better home than the Rules card: the mode leads the lobby on a plate of its own, opening a Mode card of big tiles.** "one thing i know we need is a better way to switch modes.. the level settin gis awkward for that" / "lets do it"
  2026-11-04 · `done` · DESIGN.md → Modes; `src/ui/menus/mode.ts`, `src/render/mode-emblem.ts`
  Changed: Mode was a row on the Rules card.
- **Rising Slag scores by placement (10, 6, 3 for outlasting the slag), deals its own crate mix, and its winged shell hunts the highest climber.** (agreed with "lets do it", after a review that winner-take-all scoring, race crates and a flag-seeking shell would make the mode feel unfair)
  2026-11-04 · `done` · DESIGN.md → Modes; `SURVIVE_PLACES`, `ModeDef.crate`
- **Level sets should be fully interchangeable across modes, since the engine builds the level; until they are, a set may show which modes it supports.** "its totally ok if level sets show which modes they support while they're wip" / "tho ideally the level sets are fully interchangeable since the main engine should build the level."
  2026-11-04 · `done` for the marker (`ModeDef.builds`, the Level card); interchangeable sets `planned` · DESIGN.md → Modes, TODO.md → 31
- **A level set is a kit of pieces with declared sizes and attributes (landmarks, hazards, decor, floors, connectors, walls), and the level builders, one per shape or mode, are set-agnostic and compose any set's kit, so every set supports every mode.** "i guess really all level sets should support all modes right because isnt it just retyling stuff etc?" / "i was thinking the landmarks etc are part of the set kit and the level builders just know how to use them (because tey know their sizes/attributes/etc)"
  2026-11-04 · `done` (`SET_KITS`, `KIT_KINDS`, `BUILDERS`, `src/gen/level/sets/`, `builders/`; tower kits in every set, so Rising Slag loops everywhere; the course, climb and descent builders, levels unchanged); an arena builder `planned` · DESIGN.md → Levels, TODO.md → 32
- **Rising Slag's leash is set the way SpeedRunners' camera is, in seconds behind the leader (about 3–4 s): 4.5, 3.75 and 3 s of climb by lap, squeezing from 30 s.** "hows our difficulty vs speedrunners" / "Lets do it"
  2026-11-04 · `done` · DESIGN.md → Modes; `TIER_LEASH_SECONDS`, `SQUEEZE` in `src/gen/level/tide.ts`
  Changed: 18, 15 and 8 rows (the hard laps about 2 s), squeezing from 45 s.
- **Catch-up for the trailing pack: rethink which items exist, and maybe give loops mystery boxes of their own rather than only placed ones.** "im not sure on (2) we might wanna rethink which items exist, and/or add mystery boxes by default maybe? not just placed ones?" / "Boxes first"
  2026-11-04 · `done` for the boxes (every loop places its own, dealing by rank: `src/gen/level/loop-boxes.ts`, `CATCH_UP`); which items exist is `open` (a grapple, a shot that hits whoever is above you) · DESIGN.md → Modes, TODO.md → 31
- **Each mode's targets come from the game it imitates, and every mode, the planned ones too, gets a list of its key mechanics, attributes and measurements against that game's.** "for the target it really should be similar to speedrunners i imagine? like each game mode we're using another game as inspo which helps us with mechanics" / "its probably worth evaluating that for both modes, plus the future modes, and making a list of the key mechanics and attributes and measurements and where they should be based on the games we're imitating" / "might be our level design? idk how ours looks vs speedrunners"
  2026-11-04 · `done` · DESIGN.md → Modes, MODES.md; catch-up's fixes are `planned` · TODO.md → 31
- **Catch-up items for a climb: a swap with the runner above and a shot straight up.** "Upward items"
  2026-11-05 · `done` (the Queue Jumper and the Upper Hand, dealt only by a loop's boxes, to whoever is behind) · DESIGN.md → Parts, PARODY.md · Replaced: the boomerang in the chasers' deal.
- **Rising Slag stays vertical; its level design is most of what keeps it from being fun.** The shaft is floors with two holes each, so the climb runs single file. "so maybe we keep vertical and try to figure out how to make it a more fun game?" / "yeah i think level design is a huge part of the problem, agreed"
  2026-11-05 · `done` for the open shaft and a wall-jump chimney (`src/gen/level/builders/shaft.ts`) and bumping the runner above from below (`BUMP`, src/sim/collide.ts: "Build the bump next"); catch-up again `planned` · DESIGN.md → Modes, TODO.md → 31 · Replaced: storeys with two ways up each, and perch flights on harder shafts. Considered: a horizontal looping track like the lead-camera racer's.
- **Rising Slag catches the pack up with a regroup gate: a hatch across the shaft on a cycle that the leader has to wait at, so the ones behind close in.** Picked over items that cost the leader seconds, after bots of equal skill with no items kept the 15 s leader on top 64% of the time. "Pack-regroup gate"
  2026-11-06 · `done` (two gates a lap, shut 4 s and open 2 s on one clock, the slag's floor pace waiting while the leader is under a shut one: `src/gen/level/loop-gates.ts`, the `phase` module's `clock` and `look: 'gate'`; the early leader wins 50 / 47 / 54% with boxes / items / bare, from 64 / 59 / 66%) · MODES.md → Rising Slag, DESIGN.md → Modes
- **A rule the level is built from (gravity, weather) rebuilds the lobby's level for everyone at once.**
  2026-11-02 · git `e64c3e5` · `done` · DESIGN.md → Rules

## Scoring

- **Finishing earns 10 points and the first finisher 4 more; everyone finishing or nobody finishing scores nothing.**
  2026-11-02 · git `8b3e385` (first DESIGN.md) · `done` · DESIGN.md → Scoring, `src/game/scoring.ts`
- **A finisher earns a small bonus for each rival their parts killed: +2 per kill, and traps alone don't pay.** "if you win, and you kill someone along the way, you bonus points (small amounts per kill)"
  2026-11-02 04:37Z · `done` · DESIGN.md → Scoring
  Changed: kills paid +3 to anyone as long as somebody finished (`01a6726`).
- **There's an underdog bonus for a player who hasn't scored in N rounds and is trailing: +3 after 2 scoreless rounds.** "underdog should probably be like you havent scored in N rounds, and are trailing"
  2026-11-02 04:51Z, 04:54Z · `done` · DESIGN.md → Scoring
  Changed: the first version paid +1 per 10 points behind, up to +5 (`d4302ba`, replaced by `709cbfd`).
- **The scoreboard lists the most points first.** "the scoreboard should also show the order from most points to least"
  2026-11-02 03:26Z · `done` · DESIGN.md → Scoring
- **At the limit the top score wins, ties are joint winners, and with nobody on the board there's no winner.**
  2026-11-02 · git `203e3b1` · `done` · DESIGN.md → Scoring
- **The score screen gets a redesign: no gold "50" post, a finish line, award segments.** "also i wanna improve this screen / the 50 thing looks silly tbqh..."
  2026-11-02 17:49Z · `done` · DESIGN.md → Scoring

## Movement and physics

- **Movement is a tight precision platformer: variable jumps, wall slide and wall jump, coyote time, jump buffering, corner correction.**
  2026-11-01 · git `c5715ab` · `done` · DESIGN.md → Movement
- **Wall jumps follow the held direction, and wall slides are faster (playtest feedback).**
  2026-11-02 · git `45e64b2` · `done` · DESIGN.md → Movement
- **Walking is slow and precise; holding Run gives speed and long jumps with momentum.**
  2026-11-02 · git `66ae3f0` · `done` · DESIGN.md → Movement
- **The left and right edges of a level are open air, and going all the way off one kills, as the pit does. They used to be invisible walls you could wall-jump up.** "you can currently jump up the side of the screen even if theres no block" / "a better answer would be if most levels had a left/right that was just... death" / "Hold for death edges"
  2026-11-04 · `done` · DESIGN.md → Movement, AGENTS.md → Game rules, src/sim/level.ts `offMap`
  Changed: the screen edges were solid walls you could wall-slide and wall-jump on, and the generator's proofs used them.
- **Every spawn pocket has a terrain wall at the level's left edge, a row taller than a jump, so holding left at GO doesn't walk you off the level. Walls are only ever terrain you can see.** "Build both"
  2026-11-04 · `done` · DESIGN.md → Movement, src/gen/level/kit.ts `finish`
- **A full jump is about 3.7 tiles high.**
  2026-11-02 · git `0cdb23a` · `done` · DESIGN.md → Movement
  Changed: it was about 4.5 tiles (`c5715ab`).
- **One-way platforms: jump up through them, down + jump drops through.**
  2026-11-01 · git `c5715ab`, `9c405ad` · `done` · DESIGN.md → Movement
- **Gravity is a level setting (Auto, Low, Normal, High), and levels are proven at their own gravity.**
  2026-11-02 · git `8ffd480` · `done` · DESIGN.md → Movement
- **Fans and updrafts push at a steady speed and never stop you jumping.**
  2026-11-02 · git `e8cfee9` · `done` · DESIGN.md → Props
- **Character height: whether runners need a 1.5- or 2-block gap is undecided; the owner leaned back to one block.** "I think characters should need a two block high gap ... Or maybe it's 1.5" then "maybe one block high is ok"
  2026-11-02 06:52Z, 06:53Z · `open` · TODO.md → 13

## Players

- **Characters are cosmetic only: one hitbox and one physics for everyone.**
  2026-11-01 · git `dfa1697` · `done` · DESIGN.md → Players, AGENTS.md → Fairness
- **Your name and look persist across sessions, and the first join asks for a name with the random one as the default.**
  2026-11-02 · git `54c9529`, `8b3e385` · `done` · DESIGN.md → Players
- **Players are fully solid: you can stand on someone's head, ride them and shove them.** "players are fully collidable so you can jump on top of them not just pass through"
  2026-11-02 06:30Z · `done` · DESIGN.md → Players
  Changed: bodies only nudged each other softly, with no stacking (`ec85347`).
- **A head is its own physics, an unstable perch rather than ground: nobody carries a rider, a rounded slick top slides it off, a jump underneath bucks it off and a hard stop, turn or shove knocks it off, harmlessly; you can still jump off a head.** "also when you're on someone's back, you should kind of get knocked off like slide/etc its separate physics"
  2026-11-02 · `done` · DESIGN.md → Players
  Changed: the runner underneath carried whoever stood on it and a rising runner lifted them; a stack stood for as long as its base did.
- **The spawn zone is safe: nothing hurts you while you touch it.**
  2026-11-02 · git `ec85347` · `done` · DESIGN.md → Players
- **Players in one lobby always look different.** "also our two dudes look the same"
  2026-11-02 04:36Z · `done` · DESIGN.md → Players, NETCODE.md → Seats and kicks
- **The New Look dice rerolls the look and keeps the name, without flicker.** "when i click roill the dice it flickers a bit.. and the player name ... also flickers"
  2026-11-02 15:50Z · `done` · DESIGN.md → Players
- **The player picks their colour, on the name screen and the join card: swatches from the player palette, shown live on the character, saved with the profile, kept by New Look, and synced like the name.** "make it so the edit name screen also lets you pick a color? or something? somehow we gotta make it so the color is changeable"
  2026-11-02 · `done` · DESIGN.md → Players
  Changed: the colour changed only with a New Look roll.
- **One player per swatch: a swatch someone seated wears shows as taken and can't be picked, and when two reach for the same free one at once the host's order gives it to the first.** The agent's pick for the clash rule the owner left open; deterministic, and the HUD keeps telling players apart by colour. Profiles saved before swatches keep their rolled colour until they pick one.
  2026-11-02 · `done` · DESIGN.md → Players
- **Player names are filtered, so nobody puts a slur on everyone's screen or on the public lobby list.** "we also need some kind of word filter for names so people dont put racial slurs/etc"
  2026-11-02 23:11Z · `done` · DESIGN.md → Players, NETCODE.md → Seats and kicks, public/ASSETS.md → Word lists

## Bots

- **AI is built so players can one day script their own player, and prompt an LLM to improve it: a brain is an input device for a seat, with standard built-in brains first.** "something that'd be cool is letting people actually 'script' the a player... that means they could also prompt an LLM to improve their character controller" · "lets design an AI system that can work with its own standard brains/etc and have the future potentially to allow player scripts"; the owner approved the write-up.
  2026-11-02 23:13Z · `planned` · DESIGN.md → AI players, TODO.md → 27
- **Bots can play online, but native AI comes first; player scripts come after.** "bots can be in online play, but the focus is on native AI first"
  2026-11-02 23:20Z · `planned` · DESIGN.md → AI players, TODO.md → 27
- **Leaning: scripts sense an idea of values, not the literal values (rounded positions, speed bands, outcomes from the lookahead).** "i think scripts should maybe get an idea for values but not literal values?"
  2026-11-02 23:22Z · `open` · DESIGN.md → AI players
- **A bot with no real way on jumps for it anyway, and self-destructs when that gets it nowhere.** "their brain should have them kill themselves if theres no real option or somethig idk ("try to jump anyways")"
  2026-11-03 · `in progress` · DESIGN.md → AI players, src/brain/brains/runner.ts
- **Bots take their time picking a card (read the crate, point at one or two), unless they're on a harder setting.** "their item selection should maybe slow down unless they're on a harder setting?"
  2026-11-03 02:50Z · `in progress` · `TEMPO` in src/brain/brains/runner.ts, scaled by each bot's pace
- **Bots play with some variety, and have a difficulty.** "yeah make it a little bit of variability, and we could have difficulty tuning too for future? idk or for now tbqh"
  2026-11-03 · `in progress` · DESIGN.md → AI players, src/brain/personality.ts
- **Each bot's difficulty is set on its own card, not for the room.** "each bot should let you tweak its difficulty somehow on the character panel"
  2026-11-03 · `in progress` · DESIGN.md → AI players; `Player.bot`, the `bot` action
  Changed: a room-wide Bots rule in the Rules menu, replaced before it landed.
- **No bot level is unbeatable: every level fumbles, chokes on tight jumps and randomly stops to think; harder bots are harder mostly by sabotage, not perfect hands.** "for our AI difficulty i dont want them to be unbeatable, harder difficulties probably should have more sabotage type behavior and they should still randomly have to stop and think idk" / "tl;dr im not sure hard bots ever make mistakes?"
  2026-11-04 · `done` (mistakes and pauses; sabotage in pick and place); sabotage in the race `planned` (TODO.md → 27) · DESIGN.md → AI players, src/brain/personality.ts
  Changed: Hard bots reacted in 0–1 frames and fumbled about one jump in a hundred, only ever coming up short.
- **Bots have temperaments, brain personalities apart from their level, and are vindictive sometimes: against a player whose part hurt them, or one who's winning.** "i just want bots to be more interesting to play with, and have different "brain" personality type things if that makes sense? and to be vindictive sometimes (say a player placed something to mess w/ them, or a player is winning? idk)". The proposal taken with "Yes, start it": five temperaments (builder, gremlin, grudger, sheriff, speedrunner) rolled from the bot's seed, hidden and found out by play; grudges only from what a player could see; a bot's level sets how often it acts on one and how well.
  2026-11-04 · `done` (pick and place); spite in the race and with held items `planned` (TODO.md → 27) · DESIGN.md → AI players, src/brain/temperament.ts, src/brain/grudge.ts
- **Normal and Hard bots always try to block the others, grudge or none, to make the run harder.** "one thing important for the AI, espcially on medium/hard, it needs to try to block other people to make it harder, and im not sure it always does that"
  2026-11-04 · `done` · DESIGN.md → AI players → Bots get in the way, `block` and `weigh` in src/brain/personality.ts
  Changed: with no grudge, a bot put its part on a random legal spot.
- **Bot finish targets, alone with the plan built (gentle, medium, hard level): Easy 75, 50, 30 in a hundred; Normal 90, 70, 50; Hard 95, 85, 70.** Proposed and taken with "Yes, start part 1".
  2026-11-04 · `in progress` (gentle and medium are there; hard levels play little harder than medium ones until more of them land in their band) · DESIGN.md → AI players, tests/stats/bot-finish.test.ts

## Characters

- **Every character is a homage, which fits the lore (the cast is knock-off heroes who almost got their own game).** "tbqh EVERY character can be an homage so it fits our story design"
  2026-11-02 · `done` · CHARACTERS.md → Decisions 1
  Changed: the cast was foundry toys, then animals and parody critters, then mostly homages with four plain animals (fox, frog, penguin, chicken) for contrast.
- **The roster is the twenty greatest characters to parody, worth the credits it takes to get them right.** "you can spend the credits you need to get the greatest 20 parodies of all time to exist"
  2026-11-02 · `done` · CHARACTERS.md → Decisions 8
  Changed: the roster was sixteen kinds; five join (the voxel miner, the spiky-haired mercenary, the sneaking soldier, the blue robot boy, the spiked turtle king) and the horned bug knight goes to the reserves.
- **Recognisability is the top criterion: each homage must read as its original at a glance.** "the only thing that remotely resembles the thing its mimicking is the puff ball (kirby)"
  2026-11-02 · `done` · CHARACTERS.md → Decisions 2
- **Player characters may parody famous characters under our own designs and sound-alike names; parts and machines stay faceless.**
  2026-11-02 · `done` · DESIGN.md → Parody, CHARACTERS.md
- **Characters are drawn cleaner, lighter and more hand-drawn: thinner, varied lines in a dark of the body color, calmer color, fewer bold outlines.** "i want more cleanly designed art that isnt so loud/bold lines etc and more visually hand draw"
  2026-11-02 · `done` · CHARACTERS.md → Decisions 7, ART.md → World art
- **Each kind is a distinct character design (its own outline, signature part and gait), and fewer strong kinds beat many similar ones.** "ultimate chicken horse doesnt have this issue because the characters are clearly unique looking"
  2026-11-02 · `done` · CHARACTERS.md
- **New characters come from a random roll only; players don't choose a kind.**
  2026-11-02 17:16Z (answer) · `done` · CHARACTERS.md
- **Everyone's saved look is re-rolled once, and again whenever the cast changes what a seed means.**
  2026-11-02 17:16Z (answer) · `done` · CHARACTERS.md
- **Characters and the menu crowd take the art style, but stay as clean as they are.** "i like how they look right now so make sure ou keep it clean like it is and dont break it"
  2026-11-02 15:49Z · `done` · git `a6963c8`, `3eb7c44`; ART.md → World art
- **The traced homages look too much like the originals: every kind needs a clear twist of its own on top of the recognisable silhouette.** "they look TOO much like the things were trying to parody... so we'd need to spice it up too"
  2026-11-02 · `done` · CHARACTERS.md → Decisions 8, Rules for every kind → The nod and the twist
- **The plumber carries his plunger low, its cup behind his shoulder, so the cap, bill and nose own his silhouette.** (answer: "Carry it lower")
  2026-11-02 · `done` · docs/characters/plumber.md
- **Character source art (models and sheets) lives in Git LFS; builds skip it and use the generated frames.** (answer: "Git LFS")
  2026-11-02 · `done` · `.gitattributes`, `tools/art3d/README.md`
- **The player's colour is the character's main costume colour (an alternate costume), not a foot ring.** "the sprites seem to always be the same color? like they're not re-coloring their primary based on the player color?" / "ok well thats wrong"
  2026-11-02 · `done` · CHARACTERS.md → Decisions 4
  Changed: iconic palettes with the player's colour on a foot ring.
- **Characters vary only in curated ways that keep the art: costume colour, accessory swaps, designed alternate palettes on one secondary region, pose personality (two idles, two cheers, a little gait), and wear. Faces, proportions and silhouettes are never rolled; random eyes and mouths go.** "idk if theres ways we can make it a little more procedural without losing our art work" / "'random eyeballs' dont work with the art style as an example of something that likely needs to go away" / "Yes, add it"
  2026-11-02 · `done` · CHARACTERS.md → Rules for every kind → Variety, `VARIETY` in `src/render/cast/sprites/play.ts`
  Changed: every character rolled an eye count, style, iris, spread and height, and a mouth, under its kind's face.
- **The costume-colour rule holds even where a colour is the character's identity: the dot-eater's whole ball takes the player's colour, not only his napkin.** (answer: "Keep player colour")
  2026-11-02 · `done` · CHARACTERS.md → Rules for every kind → Player's color
- **Rendered kinds are the only way they draw: no `?sprites=1` option; a kind without frames stays hand-drawn until produced.** "Make sprites the only way it works now, so no option at all"
  2026-11-02 · `done` · `src/render/cast/sprites/index.ts`
- **Every character is a little disheveled and grungier, because of the lore, and simpler than the concept sheets, which are too complicated for the game's art style; the art style itself may change to fit.** "all the characters need to be a little disheveled because of slag's lore" / "yeah they're fine but i worry those are just too complicated for our game art style (and we might need to tweak our art style). and i want them grungier as a thematic thing because of the game's lore"
  2026-11-02 · `done` · CHARACTERS.md → Decisions 9, ART.md
  Changed: the cast was clean, light and calm in colour.
- **The grunge is worn shape: battered, lopsided, bent and taped, with clean bright colours; not grimy colour, not a rough line.** (picked from the zapmouse style test: "Worn, like worn-2")
  2026-11-02 · `done` · CHARACTERS.md → Decisions 9, `tools/art3d/style.ts`
- **Rendered figures take no light bands.** "Yes, build it out" (after the flat zapmouse test in game, cel bands off characters)
  2026-11-03 · `done` · CHARACTERS.md → Rendered kinds → Out of the light bands
- **The plumber's plunger cup stays a dark of the player's colour, as the flat pass draws it.** "Leave it" (asked: back to its own red?)
  2026-11-03 · `done` · docs/characters/plumber.md → Palette; replaces the cup's own red `#b8433c`
- **Every rendered kind is drawn flat; the 3D route is retired.** "Lets try to work through the remaining sprites. Make sure our pipeline documentation is correct from our learnings"
  2026-11-03 · `done` · CHARACTERS.md → Rendered kinds, `tools/art3d/README.md`, `tools/art3d/3D.md`; replaces the 3D-traced kinds
- **Every kind's own palette is neutral, and nearly every colour on it is the player's: the costume in the player's colour, every other coloured part in a lighter or darker tone of it (the engineer's hat too); skin, eyes, hair, metal, wood, cloth greys and ink stay neutral. The swatches stay as they are: no kind skips one.** "The colors have been fine and things like eng hat can be color coded.. mostly the palette of the characters should be neutral and then pretty much all colors should be the player color"
  2026-11-04 · `done` · CHARACTERS.md → Decisions 4, Rules for every kind → Player's color and Variety; replaces each homage's own hues on its secondary parts (the plumber's blue overalls, the speedster's red shoes, the engineer's yellow hat) and the coloured palette alts
- **Spend Tripo Studio credits to finish the cast's images once the free allowance runs out.** "Spend the credits" (asked: about 1,500–3,500 credits; images turned out to cost 2 each)
  2026-11-04 · `done` · `tools/art3d/README.md`
- **Agents may run Tripo image calls without a prompt: allowed in the owner's user settings, since each worktree reads its own project settings.** "Add the rule" · "Add to user settings"
  2026-11-04 · `done` · `~/.claude/settings.json` (`tripo.ts image`, `balance`)
- **The cast grows past twenty with retro picks: the rapping paper puppy (the owner's example), the limbless hero, the worm in a super suit, the little purple dragon and the snouted cube hopper. The weak reads and audit leftovers get fixed in the same push.** "Ok lets continue working through. Something akin to some old timey characters would be good to add to our list too. Parapa the Rapper for example" (asked which to add beside him: all four offered)
  2026-11-04 · `done` (all five drawn flat; the rapper's blind read is open, TODO.md → 31) · CHARACTERS.md → The cast, Roster; `LOOK_CAST` 9
- **Two more picks past the retro five: the round Slavic warrior from the Polish comic (its big round half; the comic gives "at least some recognizable character") and the white-haired monster slayer. The sneaking soldier already stands for the stealth game's hero.** "add kajko & kokosz to our list - at least some recognizable character from it" · "witcher is another good one, snake from metal gear solid"
  2026-11-04 · `done` (both drawn flat; their blind reads are open, TODO.md → 31) · CHARACTERS.md → The cast, Roster; `LOOK_CAST` 10
- **The cast needs iconic women, from franchises it doesn't touch yet: the braided tomb raider, the bun-haired street fighter and the horned bug with the needle.** "we def need a few female characters that are iconic, ideally from new sets, but in generally we're lacking some there" (asked which: the three offered beside a platformer heroine)
  2026-11-04 · `in progress` · CHARACTERS.md → The cast, Roster; `LOOK_CAST` 11
- **The sneaking soldier stays drawn inside his cardboard box, not redrawn as the soldier out of it.** "Keep the box" (asked, after "i think you lost the snake character?": he reads as a box on legs, so whether to draw him out of it)
  2026-11-04 · `done` · docs/characters/sneak.md
- **The cast may grow to about 100 kinds, from every genre (shooters, fighting, RPG, horror, puzzle, sims, sandbox, sports, stealth, point and click, rhythm, indie), with more iconic women.** "also adding more characters to the TODO would be nice that come from diff genres etc.. we've done a bit (like cloud) but im ok having e.g. 100 characters"
  2026-11-04 · `in progress` (2026-11-05: the first four from the list, the black mage, the green block creeper, the top-hat girl and the triangle-helmeted executioner, drawn at `LOOK_CAST` 12, the executioner under the blind-read bar, TODO.md → 31; the owner asked for "a few at a time"); the second four, the pixel crab, the giant vampire lady, the town assistant dog and the lady with the green diamond, seated at `LOOK_CAST` 13; the crab, the vampire and the diamond lady pass the blind read, the dog doesn't; 2026-11-06: the third four, the succubus, the robot-hunter archer, the blue slime and the animatronic bear, seated at `LOOK_CAST` 14; all four pass the blind read; the fourth four, the washing-machine mech pilot, the hair-whip half-genie, the mushroom retainer and the tiny boxer, seated at `LOOK_CAST` 15; 2026-11-07: the fifth four, the round-helmet bomber, the punny skeleton, the blindfolded android and the red-haired climber, seated at `LOOK_CAST` 16; the bald hitman, asked for by name ("can we add another character? agent 47 or whatever from hitman?"), seated at `LOOK_CAST` 17 · TODO.md → 32
- **A kind known by one colour (the yellow mouse, the blue hedgehog) keeps no signature colour: the costume is the player's colour like every kind's, and the kind must read by its shape.** "Player colour only" (asked after the colour audit read the zapmouse as "a purple cat" and the hedgehog as "an orange spiky creature")
  2026-11-06 · `done` · CHARACTERS.md → Decisions 4, TODO.md → 31
- **The blind read that decides whether a kind ships is the clean colour read: two fresh readers outside the repository, the cast in colour at play scale, both naming the homage and one at medium, no pairs. The black sheet stays as a diagnostic.** "Clean colour read" (asked after the clean audit: about 20 of 46 kinds named in black, about 33 in colour, the plumber's homage not named in black)
  2026-11-06 · `done` · tools/art3d/CHECKLIST.md, CHARACTERS.md → Rendered kinds, TODO.md → 31 · Changed: the black-silhouette read was the bar, read by subagents who could see the commit log.
- **Junior's yellow head and arms are its skin, so they stay yellow under the player-colour rule: skin is a neutral, and the hoodie carries the player's colour.** "yellow is fine here its just the skin"
  2026-11-06 · `done` · docs/characters/junior.md → Palette
- **Junior, Sentry's robot (the owner's team made it), joins the cast as an easter egg: its own name and look, rolled for about one look in a hundred, never forced onto anyone.** "can you also add this robot from sentry (we made it) as a kind of easter egg character https://junior.sentry.dev/junior-character.png"
  2026-11-06 · `in progress` · docs/characters/junior.md, `EGGS` in `src/gen/character.ts`, public/ASSETS.md
- **A kind's id names no real game or character either: it is the codex's URL (`/codex/cast/<id>`), so the bald hitman is `cleaner`, and the creeper, impostor, sim and invader are `hisser`, `visor`, `neighbour` and `marcher`.** "the slug shouldn't be hitman btw in the url?", then "Yes, rename them"
  2026-11-07 · `done` · AGENTS.md → Extension points (Character kind)
- **A drawn kind must not look like the original redrawn: its twist has to show at play size, the face included (the puffball, whose seam and tape were dropped as misreads, was left with the original's exact face).** "kirby looks.. too much like kirby right now"
  2026-11-06 · `in progress` (the puffball being redrawn) · CHARACTERS.md → The nod and the twist, docs/characters/puffball.md
- **The android ships as it is: her white bob reads as a helmet at play size, and the black dress that carries the original takes the player's colour.** "Accept as colour read" (asked after seven rounds read her as "a white round helmet with a visor")
  2026-11-07 · `done` · CHARACTERS.md → Production order, TODO.md → 32
- **The warrior, the slayer and the assistant dog ship as colour reads: in colour they read as their homages, in black they don't, and they pair with no other kind.** "Keep as colour reads" (asked, after their retries stopped under the two-round rule: keep them or swap them for other kinds)
  2026-11-06 · `done` · CHARACTERS.md → Production order, TODO.md → 31, tools/art3d/CHECKLIST.md → Done when
- **A kind's name is never a respelling of the original's (one letter off, or the same sound): it is a looser sound-alike, ideally carrying the kind's own joke (Zoomic, Kilowatchu, Clara Loft, Space Evader).** "we also might need to make the parody's SLIGHTLY less obvious for a few" (asked names or drawings, and which: "The names", "Every one-letter-off")
  2026-11-06 · `done` · CHARACTERS.md → Decisions 3, `KIND_NAMES` in `src/gen/character.ts` · Changed: Sanic, Lonk, Sammus, Pikachew, Kurby, Meltroid, Engie, Stove, Dankey Kang, Clod, Browser, Yoshee, Snek, Parapper, Earthworm Gym, Spiro, Kewbert, Kakosh, Gerald, Laura Craft, Chun-Lee, Hornette, Vivvy, Creepah, Hat Kidd, Pyramid Ted, Invayda, Lady Dimitreskew and Izzabelle.
- **Every drawn kind's eyes work the way the cup-headed toon's do: each kind's kit eye is its homage's own eye design, drawn by the face kit so it acts, and bold enough to read at play scale.** "seems like we want mughead approach so the eyes are animated/drawn correctly" (after "some have issues w/ their eyes")
  2026-11-04 · `done` (but for the worm, the warrior and the slayer, being drawn) · CHARACTERS.md → Rendered kinds → The cast's face, `EYES` in `src/render/cast/sprites/face.ts`, `tools/art3d/README.md` → 5
  Changed: every kind but the mug, the puffball, the dino and the three dot-eyed kinds wore one generic round eye (a white, a rim, a coloured iris, a pupil and a glint), and a head side on wore its far eye as a second full circle beside the near one.
- **Tripo output is licensed for the game: the owner pays for Tripo.** "our license here is fine as we pay for tripo"
  2026-11-02 · `done` · public/ASSETS.md

## Parts and the crate

- **Parts are built from modules; a part's numbers are rolled once per match and its name comes from them.**
  2026-11-01 · git `552ac6a`, `908b1c2` · `done` · DESIGN.md → Props
- **Each match uses a few parts, which vary only in size.** "1) we should select N unique items per match 2) the items can still have variants (just in size)"
  2026-11-02 04:56Z · `done` · DESIGN.md → Props (roster, variants)
  Changed: every card rolled a fresh random part (`908b1c2`).
- **After rounds nobody finishes, crates lean toward bombs and building parts.** "handicap the rng on item selection so if conseuctive rounds people cant finish, you add more weight to a bomb or platforms"
  2026-11-02 04:42Z · `done` · DESIGN.md → Props (A match can always be finished)
- **Parts pass through each other: a mover's path or a set piece's swing doesn't stop a part being placed there, and the mover runs through it.** "you should be able to let some parts go through each other. your barn one. its ok to allow placement there, and the items will just move through each other..."
  2026-11-02 · `done` · DESIGN.md → Props (Parts pass through each other), `occupiedCells` in `src/sim/props/transform.ts`, `passThrough` in `src/sim/physics.ts`
  Changed: a part took every tile it would ever be in (a mover's path, a rider's path, a set piece's sweep and headroom), and placing there was refused.
- **Parts can seal a level; a bomb is the way out. Nothing is refused for leaving no way to the flag, and a sealed level's crate deals a demolition part that clears placed parts.** "also parts CAN seal it.. it can be unwinnable and require a bomb"
  2026-11-02 · `done` · DESIGN.md → Props (A fresh level can always be finished), `generateCrate` in `src/gen/props.ts`
  Changed: a match kept a plan of at most `MAX_BRIDGES` bridges and refused a placement that left none (`3628776`, `fbee7a6`).
- **A fresh level can always be finished: crates always offer what the level still needs.**
  2026-11-02 · git `3628776`, `fbee7a6` · `done` · DESIGN.md → Props
- **Crate contents follow the level seed and round, and the card order is shuffled per match by the host.**
  2026-11-02 · git `0cdb23a` · `done` · DESIGN.md → Props
- **A picked card leaves the crate entirely.** "dont just disable the selection, remove the card entirely"
  2026-11-02 04:40Z · `done` · DESIGN.md → Controls and UI
  Changed: picked cards were dimmed.
- **An attachment too long for its spot places the cells that fit.** "you should be able to play e.g. the spikes that are 2 wide on a 1 wide and itll only place one"
  2026-11-02 04:47Z · `done` · DESIGN.md → Props (Attachments), `mountCells` in `src/sim/props/transform.ts`
- **Blocks stop what travels: a block over a flame or in a projectile's path blocks it.** "blocks above e.g. a projectile or flame should probably block it?"
  2026-11-02 04:41Z · `done` · DESIGN.md → Props (Solids stop whatever travels)
- **Shields were too strong, so the shield item was weakened.** "the shields are too strong"
  2026-11-02 04:51Z · `done` · DESIGN.md → Props (Bubble Wrap)
- **Every part can always be placed somewhere.**
  2026-11-02 · git `ec44feb` · `done` · DESIGN.md → Props
- **Some projectiles are platforms (rideable gliders), and demolition comes in kinds.**
  2026-11-02 · git `7b4a0d2` · `done` · DESIGN.md → Props
- **Launcher aim is legible: most launchers hold still, and trackers say so.**
  2026-11-02 · git `e778ace` · `done` · DESIGN.md → Props
- **Grab props: a swinging rope and a barrel cannon, as parodies.**
  2026-11-02 · git `e778ace` (planned), `ec44feb` (built) · `done` · DESIGN.md → Props (Sausage Vine, Kegapult)
- **The portal becomes a warp pipe that needs a partner: two pipes, go in on top by pressing down; one pipe part per match, its material varies, and a lone pipe raises the odds of another.** "maybe instead of a portal we could have a pipe like in mario? it'd require two of them"
  2026-11-02 16:33Z · `done` · DESIGN.md → Props (Warped pipes)
  Changed: warp pads that kept your velocity (`fd46c51`).
- **A part's solid shape can be finer than the tile grid (a pipe's lip), while placement stays on the grid.** "it might be nice if they were actually 0.5m placeable increments ... the warp pipe should have an obvious lip"
  2026-11-02 16:58Z and answer "Sub-tile shapes" · `done` · DESIGN.md → Props (Placement)
- **Rounded shapes are allowed: the pipe top got a rolled rim.** "can we not have anything rounded? the pipe top is blocky"
  2026-11-02 17:10Z · `done` · DESIGN.md → Props (Placement), ART.md → Fair play
  Changed: corners could round by at most 3 px (`82e28d0`).
- **No part, item, projectile or set piece has a face or a persona; only runners have faces.** "for our props, i dont think any should be persona-like ... i dont want them to have faces/etc"
  2026-11-02 16:55Z · `done` · DESIGN.md → Parody, ART.md → Objects, not characters, PARODY.md
  Changed: faced parts were redrawn and renamed (Coil Pup → Bedspring, Angry Brick → Ton of Bricks, and others) (`dc9e6d7`).
- **Decor that depicts people may show faces: portraits on a wall, a statue's painted likeness.** Paintings on a wall can have faces; the Haunted Wing's portraits keep theirs, eyes following the nearest runner. Parts, items, projectiles and machines still never do.
  2026-11-02 · `done` · ART.md → Objects, not characters
- **Add a sentry turret, after the team shooter's.** "we need a 'sentry turret' type thing"
  2026-11-02 16:55Z · `done` · DESIGN.md → Props (Sentry guns)
- **Coats and blocks stick to moving parts and ride them, as honey rides a turning conveyor.** "if you had honey on something like a conveyor (that rotated around), the honey would rotate with it, and then you could also stick another block on it"
  2026-11-02 17:36Z · `done` · DESIGN.md → Props, "Parts ride what they're stuck to"; `src/sim/props/ride.ts`
- **Demolition parts rarely change terrain: the drill digs, plus one rare small bomb; the rest clear placed parts only.** "it should be RARE that they can change terrain.. so the drill is fine.. and maybe one other small one, but i think they commonly change terrain right now". Changed: bombs, charges and time bombs used to blast terrain too, and every roster held a terrain breaker.
  2026-11-02 · `done` · DESIGN.md → Props, `src/gen/props.ts`
- **Conveyors rotate: the rotation picks the belt's face.** A side belt grips and carries a clinging runner (an escalator when it runs up), a bottom belt shoves a head that bonks it. "you cant rotate conveyors.. the conveyor always stays on the top"
  2026-11-02 · `done` · DESIGN.md → Props, Conveyors
- **The parody first batch: Walk-Off Bat, Tremor Brick, Front-Runner Tax, Pocket Block, Launch Plate, Four-Square, Boost Strip, Panic Button, Fuse Crate, Y-Fling.**
  2026-11-02 · items `done` (DESIGN.md → held items), parts `in progress` · PARODY-BACKLOG.md → 3
- **Backlog questions settled by the coordinator** (the owner may override): items may make solids mid-race (Pocket Block; no proof counts on them); Front-Runner Tax measures "first" by real route distance (`goalField` in `src/sim/reach.ts`); the noodle pogo is dropped, since down + Use already tosses.
  2026-11-02 · `done`
- **The rest of the parody backlog.**
  2026-11-02 · `planned` · PARODY-BACKLOG.md → 1
- **A fire hydrant part: a plug you stand on whose jet of water shoves runners.** "we need a fire hydrant type item"
  2026-11-03 · `done` · DESIGN.md → Props (Fire Hydrant), `hydrant` in `src/gen/props.ts`
- **More parts per match, set by a Parts rule (Few, Some, Many, All), default Many.** "the number of items per round seems a LITTLe limited.. like you mostly see the same items so we should up that, and maybe make it a level config?"
  2026-11-03 · `done` · DESIGN.md → Props (roster), Rules; `rosterSize` in `src/gen/props.ts`
  Changed: every match had the short roster, 8 to 14 parts (now Few).
- **Small parts still draw small on crate cards: the part fills the card.**
  2026-11-02 · git `00e3dc2f` · `done`

## Held items and the loot box

- **A mystery crate pops held items that players carry and use.**
  2026-11-02 · git `7b4a0d2` (planned), `51d6549` (built) · `done` · DESIGN.md → Props
- **Items never kill on their own: they bonk.**
  2026-11-02 · git `51d6549` · `done` · DESIGN.md → Props (Held items)
- **Using an item has a visible button: a Use prompt in the footer, and right-click is not self-destruct.** "i think right click is self destruct? thats a bad shortcut... also idk what the button is to use an item"
  2026-11-02 04:49Z · `done` · ART.md → Input prompts, DESIGN.md → Controls and UI
- **One loot box, not three: a cube inspired by the plumber's question block that you jump into to get the item.** "the loot boxes idk if we need 3? just a mario-inspired cube that you have to jump into"
  2026-11-02 16:02Z · `done` · DESIGN.md → Props (The loot box)
  Changed: crate, chest and gift looks with mixed, shots and gadgets pools (`c0570b2`).
- **The question block belongs to the loot box alone; the blink blocks' second set is an exclamation switch block.**
  2026-11-02 · git `fe35243` · `done` · PARODY.md → Parts (blinker)
- **Items carry parody names (Master Noodle, Evicted Shell, Stunnerang, Bubble Wrap, Free-Trial Jetpack, Fog of War).**
  2026-11-02 · git `d42c085` · `done` · DESIGN.md → Props, PARODY.md
  Changed: Foam Sword, Ricochet Puck, Boomerang, Pop Shield, Pocket Rocket, Smoke Bomb.
- **Item strength and the gamepad Use button still need playtesting.**
  2026-11-02 · `open` · TODO.md → 13

## Levels

- **Every level is proven finishable with the real movement controller, never hand-waved distances.**
  2026-11-01 · git `dfa1697` · `done` · DESIGN.md → Levels, AGENTS.md → Game rules
- **About 99% of levels can't be finished bare and 20–30% need two parts.** "every single level (so like 99%) should not be passable by default without placing objects, and 20%-30% should require multiple objects"
  2026-11-02 03:59Z · `done` · DESIGN.md → Levels
  Changed: about 80% needed parts (`6fcda7b`).
- **What stops a bare run is a gap or wall a part solves, never a sealed level, with at most two small bridges.**
  2026-11-02 · git `3628776` · `done` · DESIGN.md → Levels
- **Levels ask for precision: jumps reach the edge of your range, footholds are small, and every level has a run of them.** "[the build-then-race party platformer] is about precision platforming and this needs more of that" (a playtester's feedback) / "i think this is broad feedback not a tweak per level?"
  2026-11-03 · `done` · DESIGN.md → Levels (Precision is the point); hazards hugging the line is `open` · TODO.md → 3
- **Levels come in three difficulties, a fifth gentle, half medium and the rest hard, so a match deals a spread of levels instead of one flat mix.** "i think the difficulty curve is there are too many easy levels, vs too many hard levels" / "Yes, 20/50/30"
  2026-11-04 · `done` · DESIGN.md → Levels, src/gen/level/difficulty.ts
  Changed: one precision baseline for every level (2026-11-03).
- **A level's difficulty is picked by measuring it: the generator draws layouts until the tight jumps on its more forgiving route fit its difficulty.** "Pick levels by score" (asked: pick by score, a layout family built for hard levels, or playtest first)
  2026-11-04 · `done` for gentle and medium; hard lands in its band about half the time · DESIGN.md → Levels, src/gen/level/precision.ts, TODO.md → 3
  Changed: "Run is a choice": most gaps were walking hops, none was the longest running jump, and a level had under one jumpable death gap.
- **Levels are mostly open, with route options, never one narrow way.**
  2026-11-02 · git `0464596`, `d125b8b` · `done` · DESIGN.md → Levels
- **Levels vary in size, aspect, density and route shape.**
  2026-11-02 · git `8ffd480` · `done` · DESIGN.md → Levels
- **Spawn and goal are protected from building and bombs; the flag is generous.**
  2026-11-02 · git `ec85347` · `done` · DESIGN.md → Levels
- **The spawn ring and flag always stand on the terrain.** "the spawn point is _under_ the terrain..." / "the flag is floating..."
  2026-11-02 05:49Z · `done` · `tests/spawn-goal.test.ts`
- **The winnability proof assumes timed hazards pass in 30-frame openings and plans with at most 2 bridges.**
  2026-11-02 · `open` · TODO.md → 3

## Themes

- **Every level has a theme that drives terrain, look, music and set pieces, and a farm reads as a farm.**
  2026-11-01 · git `5ab1cde` · `done` · DESIGN.md → Levels, AGENTS.md → Theme
- **Add glacier and space themes: glacier with naturally slippery beds, space with lower gravity.** "For our todo let's add a glacier and space levels" / "Glacier should have naturally slippery beds and space will have lower gravity maybe?"
  2026-11-02 07:18Z · `done` · DESIGN.md → Levels
- **A theme may change generation, and weather may be theme-specific.** "Those two levels might require tweaks to our generation ... Or weather will become level specific"
  2026-11-02 07:21Z · `done` · DESIGN.md → Levels (A theme may change how you move), Weather
- **Space has bigger gaps and fewer blocks to suit its low gravity.** "more gaps and less blocks in general?"
  2026-11-02 15:57Z · `done` · DESIGN.md → Levels (Space)
- **Ice must be clearly slippery.** "the ice blocks arent slippery enough on glacier"
  2026-11-02 15:58Z · `done` · DESIGN.md → Levels (Glacier)
- **Adding a theme moves no existing seed to another theme.**
  2026-11-02 · git `ced9fff` · `done` · DESIGN.md → Levels, AGENTS.md → Theme
- **The music must be good, not merely present.** "the music is awful. lets make that no longer true."
  2026-11-02 · `done` · DESIGN.md → Controls and UI (Music), `src/audio/music/`
- **Acoustic instruments in the music are CC0 recordings, chosen over modeling them in code.** "the music doesnt really fit with the level themes" / "CC0 samples"
  2026-11-02 · `done` · DESIGN.md → Controls and UI (Music), public/ASSETS.md → Music samples, `tools/samples.ts`
  Changed: every instrument was a synth patch, under the "prefer procedural" asset rule.
- **The music is darker, the title tune most of all.** "ideally the music would be a bit darker, especially on the title"
  2026-11-02 · `done` · DESIGN.md → Controls and UI (Music), `TITLE_STYLE` in `src/audio/music/styles.ts`
  Changed: a bright major title tune and major modes on farm, harbor, jungle, glacier and space.
- **Each level's music fits its theme, with variety between levels of the same theme.** "music should fit thematically per level and maybe have some variety idk?"
  2026-11-02 · `done` · DESIGN.md → Controls and UI (Music), `arrangements` in `src/audio/music/styles.ts`
- **Glacier and space feel hasn't been played by hand.**
  2026-11-02 · `open` · TODO.md → 22

## Stage concepts and set pieces

- **Set pieces are large, pre-placed theme props that never block the known solution and show in every phase.**
  2026-11-02 · git `3408c46`, `8b3e385` · `done` · DESIGN.md → Levels
- **Levels need much more variety: large, theme-specific landmarks instead of minor tweaks, researched from other games first.** "id like to have a lot more variety vs right now the generation feels like minor tweaks ... its important to do some research here vs just yolo'ing it"
  2026-11-02 16:18Z · `done` (research and plan), waves under way · SETPIECES.md, DESIGN.md → Stage concepts
- **No set piece floats: the lighthouse stands on rock.** "the lighthouse is sometimes floating which is a problem"
  2026-11-02 16:18Z · `done` · ART.md → The backdrop
- **A landmark reaches the ground all the way down, its backdrop too: no wall hangs over a doorway's open sky.** "that has the same issue as we had in the past where in the backdrop the thing needs to go all the way down (its floating on one tile...)"
  2026-11-02 · `done` · SETPIECES.md → 4 (Grounding), tests/landmark-grounding.test.ts
- **Moving landmarks are optional routes, never the only way through.**
  2026-11-02 16:40Z (answer) · `done` · DESIGN.md → Stage concepts, SETPIECES.md → 6
- **A giant contraption may carry you over a gap, but then the gap and the contraption are both large.** "A giant contraption could help you get past gaps fwiw so sometimes that's ok but if it's true the gap and contraption should be large"
  2026-11-02 16:44Z · `done` · DESIGN.md → Stage concepts (carriers), SETPIECES.md → 6
- **About 20% of levels stay plain, with no landmark.**
  2026-11-02 16:40Z (answer) · `done` · DESIGN.md → Stage concepts
- **A level with a landmark is named after it.**
  2026-11-02 16:40Z (answer) · `done` · DESIGN.md → Stage concepts
- **The haunted manor (an elevator, glass on each side) is a castle concept, not a new theme.**
  2026-11-02 16:40Z (answer) · `in progress` · SETPIECES.md → 6, Wave 2
- **World-only theme props can be much bigger and more unusual than placeable parts; the broken glass is a giant world prop you can't place.** "the broken glass could be an in-world prop that we cant place and be much larger"
  2026-11-02 17:48Z · `in progress` (Haunted Wing) · SETPIECES.md
- **A combine harvester with spinning reel blades is a regular farm hazard, not only the Combine Run's: it drives a field on ordinary farm levels, classic ones included, and revs its reel before it pulls away.** "a combine with blades is a good farm prop as it adds a cool hazard"
  2026-11-02 · `in progress` · SETPIECES.md → What Wave 3 (farm) landed, `src/gen/setpieces/farm.ts`
  Changed: the bladed combine only drove the Combine Run, a wide-only landmark.
- **Triggers between pieces and changes between rounds are out of scope for now.**
  2026-11-02 · `open` · DESIGN.md → Stage concepts
- **Set-piece machines that look solid are made solid: guns on ledges, wheel and swing hubs, ladles, carts, signs, posts.** "Make them solid" (asked: make them solid, or draw them as not-ground)
  2026-11-02 · `open` · TODO.md → 21, `pnpm shot fairplay` (`PENDING`)
- **Landmarks offer several ways through, so blocking one with a part forces rivals another way.** "the nice thing about level design like this: you could block off one exit and forces players to go a diff way (with a beam, as a player)"
  2026-11-02 · `done` · DESIGN.md → Stage concepts
- **At least 5 landmarks per theme; all large, some grand, every one with randomness in its layout.** "things like the haunted wing are cool. i'd want no less than 5 landmarks per theme, all should be at least large on scale, some _grand_ all should have a little bit of randomness built into them in terms of layout/etc as well"
  2026-11-02 · `in progress` · SETPIECES.md → 3, DESIGN.md → Stage concepts
- **Every theme has at least 12 decor pieces and at least 3 hazards unique to it.** "similarly we probably want no less than a dozen 'decor' pieces that can exist in each theme? and maybe no less than 3 unique hazards per theme?"
  2026-11-02 · `in progress` · DESIGN.md → Stage concepts
- **Each theme has at least 1 and at most 3 grand landmarks among its 5+.** "id like at least one grand landmark, no more than 3 (in the min 5 landmarks)"
  2026-11-02 · `done` (enforced) · `GRAND_LANDMARKS` in src/gen/kinds.ts, tests/conformance/themes.test.ts

## Weather and blood

- **Weather is one random kind per level, set by the seed and weighted per theme: wind, mist, rain or snow.**
  2026-11-02 · git `e778ace` (planned), `2e110fd` (built) · `done` · DESIGN.md → Levels (Weather)
- **Weather has real impact whenever you can see it: snow makes everything a little slippery, wind pushes.** "Snow should make everything a little slippery. Wind pushes. Weather should have real impact when visible"
  2026-11-02 06:54Z · `done` · DESIGN.md → Levels (Weather)
  Changed: rain and snow only changed the terrain, and placed parts kept their own surfaces (`071dddb`).
- **Nothing cosmetic pretends to be weather.**
  2026-11-02 · git `071dddb` · `done` · DESIGN.md → Levels (Weather)
- **Weather never changes what a level needs.**
  2026-11-02 · git `2e110fd` · `done` · DESIGN.md → Levels (Weather)
- **About 75% of levels are clear, and space never has weather.**
  2026-11-02 · git `071dddb`, `ced9fff` · `done` · DESIGN.md → Levels (Weather)
  Changed: about 70% clear.
- **Blood is slippery: a runner who dies oozes their own colour, slick for everyone.** "when someone dies they ooze out their color blood and its slippery for other players"
  2026-11-02 06:29Z · `done` · DESIGN.md → Props (Blood)
- **Blood lasts one extra round by default, and a rule sets it.** "let's have bloodnonly last one additional round"
  2026-11-02 06:57Z · `done` · DESIGN.md → Props (Blood), Rules
  Changed: "it goes away at the end of 3 rounds" (06:29Z, `8c47f1c`).
- **Blood is the only stain, and it clears; there are no permanent gore decals.**
  2026-11-02 · git `ec73190` · `done` · DESIGN.md → Props (Blood)
  Changed: gibs left splat decals (`552ac6a`).

## World art

- **The world is cel shaded: flat tones, hard light bands, ink outlines.** "when i said comic book i meant cel shaded btw"
  2026-11-02 03:53Z · `done` · DESIGN.md → Levels (Cel shading), ART.md → World art
  Changed: a first comic-book pass was "too bright and e.g. some of the texture are too think" (03:51Z).
- **Cel is the only look, not a setting.** "i dont want art style to be a selection. we can go with cel"
  2026-11-02 05:34Z · `done` · DESIGN.md → Levels
  Changed: comic was a Settings toggle beside Classic (`20bb347`, removed in `fc4a465`).
- **Switching art styles could be a fun gimmick some day, never the default.** "tho the idea that you can change art style is a fun gimmick"
  2026-11-02 03:53Z · `open` · TODO.md → 25
- **Do better than junk geometry: the world is hand-inked in code.** "ok our art is still an issue.. how do we do better than junk geometry?" then "ok thats way better!"
  2026-11-02 05:33Z, 06:22Z · `done` · ART.md → World art
  Changed: a lit, post-processed renderer with bloom and CC0 photo textures (`552ac6a`, `1974f09`).
- **Generated 3D models (Tripo) were considered; ink in code won.** "geometry is a little limited in terms of artstyle..."
  2026-11-02 03:45Z · `done` · ART.md → World art
- **Item blocks are drawn properly, as built objects.** "are you also going to be able to draw better blcoks for our items"
  2026-11-02 06:29Z · `done` · PARODY.md → Parts
- **All of the art should be drawn well, not left as bad geometry.** "The art is still mostly the same as before ... a lot is still bad geometry" / "im just not sure 100% is drawn wlel"
  2026-11-02 15:29Z, 16:02Z · `done` (full ink pass), polish ongoing · ART.md → World art
- **Theme art (landmarks, hazards, decor) must match the main ink style, and agents get concrete guidance and checks for it.** "the artwork rendering may need some guidance on e.g. black lines and stuff idk. they look just like wack compared to the main stuff right now for a lot of them"
  2026-11-02 · `in progress` · ART.md → World art, `src/render/AGENTS.md`
- **A launcher is its own machine, not "an image slapped on a square block."**
  2026-11-02 16:08Z · `done` · `src/render/AGENTS.md`
- **The conveyor and the warp pipe are redrawn as built things.** "idk if conveyer is stil in the TODO on blocks but it looks dumb" / "that warp pipe also looks visually pretty bad..."
  2026-11-02 16:57Z · `done` · PARODY.md → Parts
- **The city theme's background is too noisy, so busy themes keep far layers as silhouettes.**
  2026-11-02 16:03Z · `done` · ART.md → The backdrop
- **Art must not lie about the hitbox.**
  2026-11-02 · git `5103888` · `done` · ART.md → Fair play
- **Render order is fixed: sky, set-piece backdrops, liquids, terrain and parts, players, effects.**
  2026-11-02 · git `e778ace` · `done` · DESIGN.md → Levels
- **Whether impact words stay is undecided.**
  2026-11-02 · `open` · TODO.md → 8
- **Art everywhere is cleaner, lighter and more hand-drawn: thinner, varied lines, less loud colour.** "i want more cleanly designed art that isnt so loud/bold lines etc and more visually hand draw"; applies to characters, parts, terrain, landmarks and UI.
  2026-11-02 · `in progress` · ART.md → World art

## UI, menus and copy

- **The lobby has a Level card to pick the level: its theme and seed, each with a dice, and the difficulty, with no dice; difficulty can stay variable (each level rolls its own).** "can we make it so the level options allows you to select difficulty? ... a dialog to select it? or to rng it? it'd let you pick theme, seed, and difficulty? and have a dice roll for ... each of them?" / "well maybe not dice on difficulty" / "difficulty could be variable? so it doesnt force one"
  2026-11-04 · `done` · DESIGN.md → Rules (the Level card), `src/ui/menus/level.ts`
- **The theme is chosen by turning left and right through pictures of the level, with its title under it, not from a list of names; the difficulties have names with personality.** "we want like an image of the theme or something? kind of like on codex? ... instead of choosing the named level its a left/right kind of arrow with the visual and title of it?" / "put some personality into the difficulty levels (for their labels)"
  2026-11-04 · `done` · DESIGN.md → Rules (the Level card): Grab Bag, Sunday Stroll, Fair Fight, Pain Train
- **The menus have music too, from the same audio as the game.** "we still have no music on like the title screen and stuff which is a little odd"
  2026-11-02 · `done` · DESIGN.md → Controls and UI (Music), `src/audio/page.ts`
- **The UI is a molten foundry that doubles as a toy box: cast-iron plates, hazard tape, molten metal.**
  2026-11-02 · git `9af0a03` · `done` · ART.md → Identity
- **The main menu is the quality bar, full window height included; everything else rises to it.** "i love the way the home screen looks btw, and the fact that its full height/etc. so hoping we can make the game just as good"
  2026-11-02 02:51Z · `done` · ART.md → The bar
- **The ink reaches the menu: the logo itself and the heap, not just the bucket.** "i dont see the ink on 'slag' itself just like.. the bucket"
  2026-11-02 16:12Z · `done` · ART.md → The bar
- **The menu's slag heap reads as a natural mound.** "the rock heap looks a little unnatural"
  2026-11-02 16:53Z · `done` · ART.md → The bar
- **No tagline under the logo; "1–8 Players" goes in the footer; the lobby code row has room for its outline.** "remove the party platform ... we dont need to show 1-8 players here.. maybe in the footer area?"
  2026-11-02 16:36Z · `done` · ART.md → The bar
- **The site has a plain description, free of jargon, with a little personality, and no tagline.** "maybe we dont need a tag, but we will need a simple description thats not jargon fileld" / "add a little personality to the description"
  2026-11-02 16:38Z · `done` · ART.md → The bar, `DESCRIPTION` in `app/site.ts`
  Changed: the first ask was a "zoomer-esque tag line" for the metadata (16:36Z).
- **Inputs show as button glyphs in a footer bar, never in prose.**
  2026-11-02 · git `9af0a03` · `done` · ART.md → Input prompts
- **UI copy is title case, with no twee lowercase taglines.**
  2026-11-02 · git `9af0a03` · `done` · DESIGN.md → Controls and UI, ART.md → Casing
- **The lobby has no scoring or rules text.**
  2026-11-02 · git `f5fdc1a` · `done` · DESIGN.md → Discovery
- **In the lobby a stray click does nothing; only buttons act.**
  2026-11-02 · git `ee4411b` · `done` · DESIGN.md → Controls and UI
- **The lobby doesn't repeat its players in a list at the bottom.** "do we even need the players listed at the bottom of the lobby?"
  2026-11-02 15:50Z · `done` · DESIGN.md → Online
- **The host is clearly labelled "Host" and can kick players in the lobby.** "we'll need someone to be clearly labeled 'Host', and they should be able to kick people in the lobby"
  2026-11-02 04:26Z · `done` · DESIGN.md → Online
- **Settings are split into tabs that each fit one screen.** "the settings creen is way too large. make it multiple screens (tabs or something similar? idk)"
  2026-11-02 04:56Z · `done` · DESIGN.md → Controls and UI
- **The codex is the global parts catalog, subtitled "Spoilers!".**
  2026-11-02 · git `cf6c496`, `0464596` · `done` · `src/codex/`
- **The codex talks about maps too: every theme, its landmarks and its own hazards, pictured by the game's renderer.** "the codex needs to talk about maps"
  2026-11-02 · `done` · DESIGN.md → Discovery, `src/codex/maps.ts`, TODO.md → 28
- **The codex shows every character: the whole cast, by its sound-alike names, between the parts and the maps.** "make sure our codex shows all the characters"
  2026-11-04 · `done` · DESIGN.md → Discovery, `src/codex/cast.ts`
- **Every codex card is linkable, so one character or item can be shared: opening a card puts it in the URL, and back and forward open and close cards.**
  2026-11-07 · `done` · DESIGN.md → Discovery, `src/codex/links.ts`
- **The main menu ends with About, after Settings: who made it, its inspiration, credits, the license and a link to the source on GitHub.** "Need an About thing after settings, which includes license, inspiration, github link etc"
  2026-11-02 · `done` · `src/ui/screens/about.ts`, `/about`
- **About credits Ultimate Chicken Horse by name for the core concept, the one place a real game is named; every credit says what it is (display font, name filter), not just its name. No flavor prose on the page.** "those credits are weak, credit ultimate chicken horse for core concept" / "idk what lilita one etc even are..." / "i dont want ai slop for the description there either"
  2026-11-02 · `done` · DESIGN.md → Parody, `src/ui/screens/markup.ts`
- **About says first that the game is entirely AI-generated: David Cramer directed; Claude (Anthropic) wrote the code, art and sound; Tripo made the character models.** "make sure its clear this was entirely AI generated"
  2026-11-02 · `done` · `src/ui/screens/markup.ts`
- **On About, David Cramer's role reads "Head of Slop".** "for 'Direction' have it say 'Head of Slop' and be me"
  2026-11-02 · `done` · `src/ui/screens/markup.ts`
- **The game has a favicon, app icons, Open Graph and oEmbed previews.** "Also need a favicon, oembed metadata and image, and apple icon etc"
  2026-11-02 07:06Z · `done`; checking them on a deploy is `open` · `pnpm brand`, TODO.md → 23

## Controls and input

- **On PC, one keyboard player gets WASD and the arrows; a split keyboard makes two players; everything is remappable.**
  2026-11-02 · git `54c9529` · `done` · DESIGN.md → Controls and UI
- **Right-click and the wheel only rotate, and only while placing, so a stray click can't self-destruct.** "i think right click is self destruct? thats a bad shortcut"
  2026-11-02 04:49Z · `done` · DESIGN.md → Controls and UI
- **The gamepad cursor ramps up: precise taps, fast crossings.** "controller movement with the 'mouse cursor' is quite slow"
  2026-11-02 03:58Z · `done` · DESIGN.md → Controls and UI
- **Touch controls: a floating stick with a run zone, hold-to-jump, held self-destruct, landscape first.**
  2026-11-02 · git `bb00a8e`, `c6a37ab` · `done` · DESIGN.md → Controls and UI, MOBILE.md
- **Self-destruct is a deliberate hold on every input, counted by the sim from a fresh press, with a ring around the runner everyone sees; letting go, steering, jumping or using an item cancels it. On touch it moves to its own small button under Settings.** "also the default self destruct behavior should probably be a bit less accidental both for mobile and the hotkey"
  2026-11-02 · `done` · DESIGN.md → Controls and UI, MOBILE.md, ART.md → Input prompts
  Changed: one press of alt popped you on keyboard and pad, and touch popped after a 0.35 s hold on ALT, the button that rotates during place.
- **The self-destruct hold is 3 s, and your own charge counts down 3, 2, 1 in the middle of the screen.** "self destruct could probably be more like a 3 second hold" / "and show in the center of the screen as like a countdown so you dont miss it?"
  2026-11-02 · `done` · DESIGN.md → Controls and UI, MOBILE.md
  Changed: the hold was 1.25 s, with only the ring around the runner.
- **The Y-Fling aims where the stick points, like every other control: the pouch draws back the other way on its own, jump fires, letting go of the stick keeps the aim and the pull, and the keys you ran in with don't aim until you press a direction afresh.** "the slingshot controls are also weird seems hard to use", then chose "point where you go" from three options
  2026-11-03 · `done` · DESIGN.md → Props (Y-Fling)
  Changed: you pulled the stick away from the target and the pull built only while held; running in turned the aim backwards, letting go leaked the pull, and the pull still held after firing steered and fast-fell against the shot.
- **Phones haven't been tried on real devices.**
  2026-11-02 · `open` · TODO.md → 6

## Camera and view

- **The camera always zooms out to keep every player on screen.** "the camera also needs to zoom out always to encompass ALL players on the screen"
  2026-11-02 04:39Z · `done` · DESIGN.md → Levels (camera), Controls and UI (phones)
- **The map sits centered, and the level carries on above and below instead of the picture being bottom-aligned.** "i dont like how our screen is like.. bottom aligned" / "we can probalby just draw whatever is at the bottom and extend it down farther?"
  2026-11-02 05:58Z, 06:01Z · `done` · DESIGN.md → Levels (The picture fills the window)
  Changed: shorter levels stood on the view's bottom with sky above (`3254ddd`).
- **The picture fills the window with no bars, and nobody sees more by resizing.**
  2026-11-02 · git `d367e5e` · `done` · DESIGN.md → Levels
- **Past the map's left and right edges, nothing is drawn but sky, skyline and pool, so it reads as a drop; the screen edge is the map edge wherever the camera can manage it, and the rest reads as out of bounds.** "step back and figure out what the ideal setup is for our game (that will be flexible with our work going on w/ other playstyles)" / "Build both"
  2026-11-04 · `done` · DESIGN.md → Levels (The picture fills the window), src/render/surround.ts
  Changed: the level carried on past its sides as hazy scenery in its own theme (farmland, curtain walls, a harbor shed, moraine, bodies adrift in space), which looked like ground once the edges killed.

## Online play and netcode

- **No matchmaking: you join through a shared link.**
  2026-11-01 · git `3c8d279` · `done` · DESIGN.md → Online
- **The host acts as the server, decides when a client's data mismatches, and migrates automatically if it drops.** "whoever the host is acts as the server? and the host should auto migrate somehow if they drop" / "the host would be like the 'decider' in case a client had mismatched data?"
  2026-11-02 03:00Z, 03:01Z · `done` · DESIGN.md → Online, NETCODE.md
- **Netcode sends inputs over a deterministic simulation.**
  2026-11-02 · git `e7b56b4` · `done` · DESIGN.md → Online, AGENTS.md → Determinism
- **Peers connect over WebRTC with serverless signaling on Vercel, backed by the owner's Upstash store.** "fyi i created slag-upstash-kv in vercel"
  2026-11-02 02:49Z · `done`; connecting the store in Vercel is the owner's `open` step · NETCODE.md → Setup, TODO.md → 2
  Changed: a Durable Object relay (`e7b56b4`).
- **In pick and place everyone sees everyone's cursor and ghost part live, because the first pick wins.** "its important in multiplayer that we can see other players ghost parts/etc when placing them"
  2026-11-02 02:59Z · `done` · DESIGN.md → Online
- **Remote players move smoothly.** "the movement is REALLY laggyg when showing a remote player"
  2026-11-02 04:36Z · `done` · NETCODE.md
- **Everyone connected gets a seat without pressing anything, including the host.** "its not showing filled slots?" / "maybe when you join as a host it should auto select an open slot? or maybe in general it should do that?"
  2026-11-02 04:35Z, 15:45Z · `done` · DESIGN.md → Online
- **A new lobby never shows someone else as host (seen on a phone).** "I see a host in a lobby when I join but it's not me and it's a new lobby" / "that host bug was on mobile btw"
  2026-11-02 15:28Z, 15:45Z · `done` · NETCODE.md
- **You can join a lobby as an observer.** "you should be able to join a lobby and just be an 'observer'"
  2026-11-02 17:50Z · `done` · DESIGN.md → Online, NETCODE.md → Seats and observers
- **Observers send no input and are never waited on; a watch link (`?watch`) arrives watching; a full lobby makes arrivals watchers; Watch is on your lobby card and in Settings, freeing the seat at once in the lobby and at the round boundary mid-match; watchers are chips in the lobby's online panel and the host can kick them there.**
  2026-11-02 · `done` · DESIGN.md → Online
- **Host migration never picks a watcher while a player is present: a watcher steps to the back of the join order. When only watchers are left, the earliest of them hosts until someone takes a seat.** (The owner's call on the all-watchers case; this is the simplest rule, picked for now.)
  2026-11-02 · `done` · DESIGN.md → Online, NETCODE.md → Host election
- **Opening a room shows a joining screen (code, who's there, connecting) and each failure with a way out, as part of the game.** "when joining a lobby we probably need an interstitial for joining"
  2026-11-02 · `done` · DESIGN.md → Online (Arriving)
- **Join is a clear button in the corner for anyone watching, in every phase, clickable at any time; disabled as Match Full with no seat; the host's order decides a race for the last seat and the loser is told (Taken).** "join should be a clear CTA in the corner or something that you can click at any time. it gets disabled if 'Match Full', and it should gracefully handle a race to join where the host decides who won"
  2026-11-02 · `done` · DESIGN.md → Online, NETCODE.md → Seats and observers
- **A kick keeps the player out for 60 s, whatever tab or link they come back through, with a countdown and Rejoin.** "when you kick someone as host, it should stop them from joining for at least 30 seconds so they cant just insta rejoin"
  2026-11-02 · `done` · DESIGN.md → Online, NETCODE.md → Seats and kicks
  Changed: a kick sent you to the main menu for good (per tab).
- **An empty room is over after 60 s: its link then starts a fresh room under the same code.** "if the host and players leave the game for idk more than 30? 60 seconds? it should probably no longer be an active session"
  2026-11-02 · `done` · DESIGN.md → Online (Rooms end), NETCODE.md → Host election
  Changed: a browser resumed a room it had saved up to 30 minutes before.
- **A player gone without a goodbye for 40 s mid-match is dropped (seat freed, parts kept, look and points back if they rejoin); until then everyone sees an unplugged icon on their chip, score row and card.** "when players close their browser at some point they need to truly timeout or something vs just self destruct? ... their character card at the top should show some kind of disconnect icon"
  2026-11-02 · `done` · DESIGN.md → Online (Gone players), NETCODE.md → Joining and reconnecting
- **Idle players are detected (a soft disconnect), so the game doesn't wait on them forever.** "we should also detect idles (soft disconnect) so the game doesnt wait on an idle player forever"
  2026-11-02 17:52Z · `done` · DESIGN.md → Players (Nobody waits), NETCODE.md → Idle players and soft disconnects
- **The idle timeouts: 30 s without input in an untimed pick, place or race (from the phase's start; a timed one just runs out), 60 s in the lobby; after that a player is AFK until their next input. Online an AFK player moves to the watchers: in the lobby when it's full and someone is watching, mid-match after two rounds in a row ended AFK. A guest sending nothing for 1 s has its held buttons let go.**
  2026-11-02 · `done` · DESIGN.md → Players, NETCODE.md
- **Test the Upstash path locally with a compatible service.** "add to the TODO to have a compatible service locally for testing it? thats compat with upstash redis remote and their lib?"
  2026-11-02 03:46Z · `done` · AGENTS.md → `pnpm test:store`
- **Whether to shorten two-peer host loss with a lower `PROBE_MS` is undecided.**
  2026-11-02 · `open` · TODO.md → 2
- **Arriving mid-match puts you in as an observer; choosing Join opens a small lobby-style card (your toy with the New Look dice, your name) and seats you next round.** "when you join a match you'll default to observer fwiw, and then you can somehow choose to join, and if you do you might get a little screen to select your character/name almost like the lobby does"
  2026-11-02 · `done` · DESIGN.md → Online (Seats, Join)
  Changed: an up-front Join-or-Watch choice on arrival.
- **Characters on the join card stay random-roll only: the New Look dice, no picker.**
  2026-11-02 · `done` · DESIGN.md → Online (Join)
  Changed: the colour is picked now (Players, above); the toy itself is still the dice's.
- **A watcher's Join in the lobby seats them straight in, the way arriving does (their card appears among the players); the join card and its "You're In" are for joining mid-match.** "when you join the game on the lobby screen (like if i click the eyeball to observe, then i click to join) it says 'you're in' but that screen is just weirdly out of place in that scenario"
  2026-11-02 · `done` · DESIGN.md → Online (Join)
  Changed: Join opened the join card in every phase.
- **Lobby browser: a list of lobbies, showing only ones that aren't full by default.** Lobbies are public by default with a Private option. "lets make lobbies public by default with a private option"
  2026-11-02 · `done` · DESIGN.md → Online, Rules; NETCODE.md → Lobby list
- **Each listed lobby shows its host's name, leading the row; after a host migration it's the new host's.** "i want each lobby to show the host's name"
  2026-11-02 · `done` · NETCODE.md → Lobby list, `src/ui/screens/lobbies.ts`

## Platform and hosting

- **Next.js on Vercel as a thin shell; the whole game runs client-side.**
  2026-11-02 · git `166310c` · `done` · DESIGN.md → Platform, AGENTS.md → Hosting
  Changed: the scaffold was a Vite app.
- **The home screen is part of the game, not a separate React page.** "i find it odd our home screen is diff than our lobby.. like our home screen is react or some shit?"
  2026-11-02 02:50Z · `done` · DESIGN.md → Platform, AGENTS.md → Every screen is part of the game
- **Every screen (codex included) is part of the game, even at its own URL, so the game is portable.** "mostly because i want the game to be portable"
  2026-11-02 02:52Z · `done` · DESIGN.md → Platform, AGENTS.md → Hosting
- **Sentry error monitoring, in the host layer only.** "another agent: add sentry support"
  2026-11-02 03:28Z · `done`; the owner's env vars and GitHub integration are `open` · AGENTS.md → Hosting, TODO.md → 17
- **Sentry should be useful for this game: logs, errors and context that fit how it fails.** "make sure sentry is configured from a useful point of view for logs/errors/etc in a way that makes sense for our game"
  2026-11-02 · `done` · docs/TELEMETRY.md, AGENTS.md → Hosting
- **Production reports how the game runs, not only how it fails: frame pacing per phase as Sentry metrics, sliced by device and tier, compared release to release.** "do we have the right level of monitoring to know if our game continues to perform at desired fps in prod?", "lets go ahead and do it"
  2026-11-05 02:29Z · `done` · docs/TELEMETRY.md → Metrics
- **pnpm is the package manager and Node 24 the runtime; pnpm settings live in `pnpm-workspace.yaml`.** "get this fixed up"
  2026-11-02 02:46Z · `done` · AGENTS.md → Commands
  Changed: npm, then Node 22 (`6ebfbd4`).
- **A standalone build is a native game binary, not the web page in a bundled browser: Electron is out.** "lol electron is not a good solution", "thats not how you package games tho"
  2026-11-02 · `open` · TODO.md → 30
- **The menus move onto the game's own canvas renderer, so a native host needs no DOM for them: first a widget kit and Settings, with the Name and Rules menus.** "we can redo the menus using the same renderer?", "Yes, start there"
  2026-11-02 · `in progress` · AGENTS.md → Where things live, ART.md → UI, TODO.md → 30

## Tooling and process

- **After a stretch of work, look at what was inefficient (playbooks, tools, code) and improve the systems.** "its worth looking at whats been inefficient in building these levels. playbooks, tools, code. and then improving the systems"
  2026-11-06 · `done` (level inspection and builder contracts, whole-level shots with one seed meaning one level, a snapshot shape fingerprint, stats baselines; test, theme and scratchpad rules in AGENTS.md) · AGENTS.md
- **One coordinator hands tasks to subagents.** "you're the coordinator, use subagents for tasks"
  2026-11-02 02:48Z · `done` · AGENTS.md → Git workflow
- **Worktrees install their own dependencies through a SessionStart hook.** "also make sure our worktree scripts are good here" / "Yes, add the hook"
  2026-11-02 02:46Z, 02:50Z · `done` · CLAUDE.md
- **The main session pushes to `main`.** "Yes, push to main"
  2026-11-02 02:53Z · `done` · AGENTS.md → Git workflow
- **Agents may add linters and ast-grep rules, and every rule's message must steer whoever hits it: why, and what to do instead.** "you can add linters/ast-grep as needed" / "make sure the error message is _steerable_ so the agent knows why"
  2026-11-02 03:12Z, 03:16Z · `done` · AGENTS.md → Conventions
- **Test suites are organized by function, not speed, and agents don't routinely run the heavy ones.** "the test suites should be functional, not 'fast vs slow' - like we dont always have to run benchmarks"
  2026-11-02 03:35Z · `done` · AGENTS.md → Commands, Definition of done
  Changed: a fast tier and a `test:slow` tier (`8e0704f`).
- **Unused code is part of the gate: knip runs in `pnpm check` and CI, and what it finds is deleted, not ignored.** "add knip if it snot there too"
  2026-11-04 · `done` · AGENTS.md → Commands
- **Full sweeps move out of `pnpm test`: it runs a rotation of each sweep and `tests/stats/` runs the whole product, through one helper in `tests/lib/`.** "some of our tests could maybe be a dedicated suite or benchmark or something else thats not run on every change?"
  2026-11-04 · `done` · AGENTS.md → Definition of done
- **Keep what an audit or a fix teaches, in short docs: a line in the owning AGENTS.md for a rule, a TODO item for open work, no long write-ups.** "we dont need crazy docs but i wanna make sure we keep learnings"
  2026-11-04 · `done` · AGENTS.md, TODO.md → 33
- **Tighten lint where the audit found gaps: one generated config, the determinism rules over all deterministic code, exhaustive switches, no import cycles, no focused tests or bare numeric sorts, and tools that fail on an option nothing read.** "Yes, start them"
  2026-11-05 · `done` · AGENTS.md → Commands (Lint), `tools/lint/config.ts`
- **Make the GitHub Actions check required (an owner step).**
  2026-11-02 · `open` · TODO.md → 10
- **Apply the quick wins from the transcript review: guard-safe commands for worktree agents, one `pnpm land` per batch instead of a merge and a gate per branch, and `SNAP_VERSION` bumped once at landing, never in a branch.** "Apply quick wins"
  2026-11-02 · `done` · AGENTS.md → Git workflow, `tools/land.ts`, `src/net/snapshot.ts`
