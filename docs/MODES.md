# Modes and their reference games

Every playstyle mode (`src/game/modes.ts`) borrows its mechanics from a game that already plays well, and takes its targets from how that game plays. This page lists, per mode, the reference game, what we borrow from it, the attributes and measurements that define the mode, where the reference sits, and where we sit today. [DESIGN.md](DESIGN.md) → Modes holds the rules as they stand; [DECISIONS.md](DECISIONS.md) logs the calls.

Reading the tables:

- **Reference** is the reference game's number, with its source under Sources. "Not documented" means the research found no source; an estimate is marked as one.
- **Ours** is measured with bots unless it's a tuning constant. The match numbers come from six four-bot matches per mode (seeds 1–6, Normal bots, default rules; bots pick and place in a few seconds, so a human round adds most of the pick and place timers, about 20 s).
- **Target** is what we aim for. It's the owner's call where it differs from the reference.

---

## Race: the build-then-race party platformer (Ultimate Chicken Horse)

What we borrow: the pick, place, run loop; parts persist; scoring that punishes a level everyone finishes or nobody does.

| Attribute | Reference | Ours | Target |
| --- | --- | --- | --- |
| Players | 1–4 | 1–8 | 1–8 |
| Points to win | 5, at 1 a finish [UCH-rules] | 50, at 10 a finish (Normal): also 5 finishes | 5 finishes |
| Round limit | 12 by default, 2–50 [UCH-rules] | 15 (Normal) | 12–15 |
| Rounds a match takes | not documented | 8 (6–10) | 8–12 |
| Round length | "about a minute" [UCH-wiki] | 25 s pick to score with bots (about 45 s with human timers); race 15.5 s median | about a minute |
| Everyone or nobody finishes | no points [UCH-rules] | no points | the same |
| Rounds that score | not documented | 71% | 65–80% |
| Finishers per round, 4 players | not documented | 1.85 | 1.5–2.5 |
| First to finish | +1/5 of a finish [UCH-rules] | +4/10 | keep |
| Trap kill | +1/5 a victim [UCH-rules] | +2/10, finishers only | keep |
| Comeback (behind for 2+ rounds, then finish) | +4/5 [UCH-rules] | underdog +8/10 after 2 scoreless rounds (owner decision; was +3) | keep |
| Only finisher (3–4 players) | Solo +3/5 [UCH-rules] | none | consider adding (+6) |
| Crate size, 4 players | "4–6 items", a review's estimate [UCH-box] | players + 2: 6 | the same |
| Lone bot's finish rate by tier (gentle, medium, hard) | n/a | Easy 73/58/58, Normal 93/65/60, Hard 93/78/88 | Easy 75/50/30, Normal 90/70/50, Hard 95/85/70 (`PASS_TARGETS`) |

Gaps: the hard column plays little harder than medium (TODO 3). We have no Solo bonus, and the reference values a lone finisher among three or four at three fifths of a finish; it's what makes a trap that catches everyone but you worth building.

---

## Rising Slag: the lead-camera racer (SpeedRunners), as a climb

What we borrow: the camera that follows the leader, out when you fall off it; the round goes to the last one standing; the screen tightens late; items that hit whoever is ahead. A close relative: the rising-slime round of the knockout show (Fall Guys' Slime Climb), where slime chases a course from below on a 2:20 limit.

| Attribute | Reference | Ours | Target |
| --- | --- | --- | --- |
| Players | 4 [SR-steam] | 1–8 | 2–8 |
| Out when | off the leader's screen [SR-wiki] | the slag's leash below the leader: 4.5, 3.5, 2.5 s of climb by lap (25, 19, 14 rows), 16 rows longer at GO, fading over 25 s | a screen behind, about 3–4 s (estimate) |
| Round won by | last standing [SR-wiki] | last standing (10), then 6 and 3 for outlasting | keep the places: they pay more than the winner, as a race does |
| Match won by | first to 3 round wins (4 in teams) [SR-wiki] | 50 points (Normal): 7 rounds (4–8) | 5–7 rounds |
| Start | side by side on a start line | a start line across the shaft's floor, four cells apart | keep |
| Round length | not documented | four Normal bots: 29 s median, 4% over by 15 s (25 s and 7% before the gates; 16 s and 41% before the long opening) | 20–40 s (estimate: "short") |
| Late squeeze | after the first elimination, or after a set time with none [SR-wiki] (time not documented) | from the first one out, or 30 s, 0.3 rows a second | keep |
| No weapons at the start | first 1.5 s [SR-patch] | the slag boils 3 s; items come from boxes later | keep |
| Items | 8 kinds, from orbs on the track [SR-pickups] | 10 kinds, from the loop's boxes and placed boxes | rethink for a climb (below) |
| How boxes deal | weighted random [SR-patch]; players say by rank: drills to the back, crates to the front [SR-odds] | by rank: catch-up to the pack, defence to the leader (Rising Slag's `boxes` table, `src/game/modes.ts`) | by rank |
| Strongest catch-up | Golden Hook: swap places with the runner ahead [SR-pickups] | Queue Jumper: trade places with the runner just above | keep |
| Movement tools | grapple at 45° onto white ceilings; a boost meter [SR-controls] | walk, run, jumps, wall jumps; no grapple or boost | a grapple item |
| Early leader wins (leader at 15 s) | not documented | 512 seeds, about 480 judged each (±5): 50% as built, 47% with items in every hand, 54% with none, since the regroup gates (were 64, 59, 66; before that 69, 58, 66 with a third of rounds over by 15 s) | about half (estimate) |
| Regroup | the leader camera's screen holds the pack together by itself | two gates a lap across the shaft, shut 4 s then open 2 s on one clock; the slag waits while the leader waits under one. Lead changes 3.1 a round (were 1.5; 3.2 with items in every hand, were 2.0) | keep |
| Lone bot gets through a lap (laps 1–3) | n/a | Easy 91/83/58, Normal 97/87/81, Hard 97/71/77 with the gates (32 seeds; before them 91/86/80, 94/83/100, 100/84/96): a bot seldom falls further than a rise on bricks, short of even the hard lap's leash; a lone bot waits at each gate while the squeeze runs on, so the hard lap comes later and tighter | `PASS_TARGETS` |

### How catch-up got to half: level design and mechanics

| | The lead-camera racer | Rising Slag today |
| --- | --- | --- |
| Track | handmade horizontal loops, everyone on the same line at about the same speed, with high and low routes (grapple ceilings over the ground) | a vertical shaft, generated per match: open air, ledges staggered like bricks with several lines up every height, a wall-jump chimney up one side, two gates across it a lap (until 2026-11-05: storeys with two ways up each) |
| Pace | running speed; a lap is a stretch of screens | climbing, about 5 rows a second; a 48-row lap is about 10 s |
| Overtaking | constant: shortcuts, boosts and stuns reorder the pack | about 3 lead changes a round with the gates (leader on top a second straight), from 1.5: the pack comes through a gate together |
| Where the leader is | ahead, on your line | above you; most of our items fire or swing sideways |
| What a hit costs | a stun: seconds of position | a bonk; on a perch, a storey, which is strong but only if you can reach the leader |
| Catch-up items | the Golden Hook swaps you with the one ahead; missiles, crates and freeze aim ahead | the Queue Jumper swaps you with the one above, the Upper Hand punches up through floors, the winged shell hunts the leader |

So the open shaft alone works against catch-up: a lead holds even between equals. Before the gates, four bots with the same hands and no items still keep the 15 s leader on top 62% of the time (512 seeds); a lead of under 3 rows at 15 s wins 41%, 6–8 rows 71%, 12 or more 86–88%. A longer leash, so rounds last longer after 15 s, is what moved it most.

Tried, in order:

1. **Items that work upward** (built: the Queue Jumper and the Upper Hand). In every hand they move the early leader's wins about 5 points: trading places with one rival or punching one down rarely reorders the pack.
2. **The squeeze from the first elimination** (built): as the reference does. It shortens rounds, so the leash opens long at GO (built) to keep them at 20–40 s.
3. **Bots that get what a box deals** (built): braking at a walk, their hop under a box turned back and forth every frame and never jumped. Box uses doubled; errands are now short (3 tiles), since a detour behind the leader is climb lost.
4. **A start line** (built): four bots in one pocket jammed for seconds.
5. No effect, or worse, at 512 seeds: twice the boxes, solid floors with holes every fourth row, narrower ledges and more wells, no chimney, a lead deal of only Bubble Wrap, bots holding the Queue Jumper for the swap into the lead, bots climbing under whoever is just above (more bumps), lanes near a bot's own column (70%: the pack stops crossing).

6. **Regroup gates** (built, the owner's pick over items that cost the leader seconds): a shutter across the whole shaft, wall to wall, that shuts and opens on the race clock (`src/gen/level/loop-gates.ts`). Whoever reaches it shut waits under it while the pack climbs up, and the slag's floor pace waits while the leader does (`Tide.hold`), so a pack under a shut gate isn't eaten for the leader's wait. Every gate runs one cycle, so a leader who slips through one as it shuts meets the next one shut. Measured with the gate right over its ledges, at 512 seeds (boxes, bare): one gate a lap at mid-height 57% and 56%; two, a third and two thirds up, 51% and 53%; three 54% and 55%; two shut 5 s 49% and 49% with rounds 2 s longer; one shut 3 s 63% and 58%, 5.5 s 55% and 57% with 12% of rounds over by 15 s; one with the slag never waiting 57% and 58%, with more rounds over early; the slag waiting for anyone under a shut gate, not just the leader, the same as the leader alone. Kept: two gates, 4 s shut and 2 s open. A gate right over its ledges meant a jump onto them met it shut, so a pack waited a ledge lower with two jumps to make in the 2 s; it now goes a row higher where the shaft has room (50, 47 and 54 from 51, 51 and 53, and lone Easy bots through the first lap 91% again, from 78%). About half the runners who go out go out under a shut gate the leader got through: the gate splits a pack as well as gathering it.

Next: nothing for catch-up itself. Whether a gate that splits the pack that often feels fair is a playtest question.

---

## Brawl: the party brawler (Duck Game), killing by knockback into the level as the crossover brawler does (Smash)

What we borrow: short rounds, last one standing, items from boxes knocked from below, a draw scores nothing. What's ours: nothing kills on its own (items knock, bodies shove, on the race's physics), the level does: its hazards, the parts placed in it every three bouts (so the arena gets nastier through a match), the drop, and late in a round slag pouring in from below.

| Attribute | Reference | Ours | Target |
| --- | --- | --- | --- |
| Players | 2–8 [DG-steam] | 1–8 | 2–8 |
| Kill | one hit [DG-steam]; or knockback past a blast line, further the more damage you've taken [Smash-kb] | knockback into a hazard or off the edge; items and bumps knock, bodies shove (owner decision) | the same |
| Round won by | last standing, who must stay alive a moment; a draw scores nothing [DG-mp] | last standing (10), and a kill credited by a bonk (2); a draw (everyone out at once, or the time out) scores nothing | the same |
| Round length | 8–10 s, rarely more (a review); under a minute (another) [DG-reviews] | 27.6 s on average with bots on the bare arena, 24.5 s with parts placed (from 30.1 and 28.1 before bots pressed the fight, and 39.6 and 38.1 before that): 28 of 48 bare rounds land in 20–40 s and 5 run under 10 s, 34 and 7 of 64 with parts placed, every one of those a fight (someone knocked or shoved in); 60 s at most | 20–40 s |
| Draws | rare (not documented) | 13% of bot rounds on the bare arena, 13% with parts placed (from 13% and 16%, and 63% and 59% before bots lined rivals up): the slag takes the last ones together | rare |
| Match won by | 10 wins by default, checked at intermission every 10 rounds [DG-mp] | 50 points (Normal): 5 wins, checked after every bout; 15 bouts at most | the same |
| Rounds between intermissions | an intermission every 10 rounds [DG-mp] | 3 bouts on each placement (Bouts per Pick: 1, 2, 3 or 5), then pick and place: four Normal bots fight 80% of a match (68% at one bout a placement), picking and placing 9% (22%; about 9 s each time), 5.6 min a match (6.3), 9 rounds either way | most of a match spent fighting |
| Weapons | spawners on a timer, boxes bumped from below, a mystery gun at the start [DG-spawns] | 3 boxes in every arena, handing over what they deal | the same |
| Item frequency | crossover brawler: one every 8–13 s on medium [Smash-items] | boxes refill every 5 s | one every 5–10 s |
| Catch-up | none found | none | none at first (the crossover brawler has an optional underdog boost [Smash-rules]) |
| Sudden death | crossover brawler: 300% damage, a shrinking blast zone [Smash-sd] | slag pours in from below 25 s in | the same |

The arena is a classic one-screen level that owes no part (`bare`), everyone starting from its two ends (`ends`), deadly by default: up to six set pieces from the nastiest of its set's mix (`hazards: 6`, `danger: 0.9`; about 4.7 fit), against 4 of the usual mix, runners out before the slag in round 1 went from 0.54 a round to 0.75. Bots press the fight, as the reference game's players rush the first weapon and each other. They close on the nearest rival and would rather hit from the side that throws them into an edge, a drop, a hazard or the slag (they follow the flight a hit would give a dazed body: `knockedInto`, src/brain/tactics.ts), but a line-up is a preference, not a gate: with a rival in reach about a second (`press`, a trait: a Hard bot sooner, an Easy one slower) they take the hit they have, and at once when cornered or with the slag close. Empty-handed they fetch from a box within 14 tiles unless a rival they could shove into something is right there; they dodge only a hit that's coming and go straight back at them, get over a shove that goes nowhere (onto the rival's head and down the far side) instead of walking away, and climb from the slag only once it pours and comes close (before, they read the view's rounding as the slag moving and climbed from GO, a third of their time). There's no route to block, so they put their hazards where a knock throws someone and they'd still come down safe (`knockLanes`, the cells nobody ran through last round first), turning that knock into a kill, and no part near the two ends, where it would catch the field walking off at GO; a hop under a box or a leap is played out before it's taken, as a walking move is, and a bot stops rather than coasts on where it meant to stand. Of deaths on the bare arena 49% come with a rival's knock credited (from 36%, 31%, and 11% before bots lined rivals up), with parts placed 43% (from 32%, 24% and 9%). The fight itself (`Fight` in tests/lib/bot-race.ts), bare and placed: the first bonk 3.5 s and 4.0 s after GO (from 4.5 and 5.5), 11.5 and 8.4 items used a round (6.6 and 6.1), 16% and 14% of the time moving away from the nearest rival (19% and 17%), 4.2 and 4.8 tiles from them (5.6 and 5.6). Standing still stays at 22% and 26%: most of it is the motor's own care (a beat after a landing or a bump, lining up in a cell, waiting a hazard out). Four Normal bots, `tests/stats/brawl.test.ts`, bands in `BRAWL_ROUNDS`. Pouring earlier or faster (20 s in, or gaining 0.07 tiles/s²) cut the rounds over 40 s but added draws, so the pour stays 25 s in at 0.4 tiles/s gaining 0.04.

---

## Gauntlet (planned): the co-op puzzle platformer (PICO PARK)

What we'd borrow: everyone has to reach the goal; levels scale to the number of players; failure is shared.

| Attribute | Reference | Target |
| --- | --- | --- |
| Players | 2–8 (10 in Classic) [PP-steam] | 2–8 |
| Clear | the key opens the door, and every player must reach it [PP-steam] | every runner reaches the flag |
| Scaling | each level adjusts its terrain to the player count [PP-site] | the crate and the level's asks scale with players |
| Failure | one death and everyone restarts (a review; not official) [PP-review] | one death and the team's run ends; the round scores what the team got |
| Scoring | no per-level scores documented; a shared high score in Endless [PP-wiki] | rounds cleared in a row, against a target |
| Parts | n/a | the crate deals hazards; the team builds the level against itself |

What it needs from us: Race's "everyone finished scores nothing" flipped, team scoring, and a crate mix (`ModeDef.crate`).

---

## What we measure, and where

| Measure | Modes | Where |
| --- | --- | --- |
| A lone bot's pass rate per stretch and tier | Race, Rising Slag | `tests/stats/bot-finish.test.ts`, `tests/stats/slag-climb.test.ts`; `PASS_TARGETS`, `PASS_BANDS` |
| Early leader wins | Rising Slag | `tests/stats/slag-catch-up.test.ts`; `LEAD_HOLDS` |
| Round and match length, rounds that score, finishers per round | all | not yet a suite: measured once with a probe for this page |
| Draws, round length, deaths knocked into the level, how hard bots fight (first contact and bonk, items used, still, retreating, distance to the nearest rival) | Brawl | `tests/stats/brawl.test.ts`; `BRAWL_ROUNDS` |
| Share of a match spent fighting, by bouts per placement | Brawl | `tests/stats/brawl-bouts.test.ts` |
| Team clear rate | Gauntlet | to come with the mode |

## Sources

- [UCH-rules] https://ultimate-chicken-horse.fandom.com/wiki/Rules
- [UCH-wiki] https://en.wikipedia.org/wiki/Ultimate_Chicken_Horse
- [UCH-box] https://switchplayer.net/2018/10/17/ultimate-chicken-horse-review/ (an estimate)
- [SR-steam] https://store.steampowered.com/app/207140/SpeedRunners/
- [SR-wiki] https://en.wikipedia.org/wiki/SpeedRunners
- [SR-patch] https://steamcommunity.com/sharedfiles/filedetails/?id=184417021 (patch notes quoted in a guide)
- [SR-pickups] https://speedrunners.fandom.com/wiki/Pickups
- [SR-odds] https://steamcommunity.com/app/207140/discussions/2/624075482723437167 and https://steamcommunity.com/sharedfiles/filedetails/?id=1437919832 (players' claims)
- [SR-controls] https://speedrunners.fandom.com/wiki/Controls
- [DG-steam] https://store.steampowered.com/app/312530/Duck_Game/
- [DG-mp] https://duckgame.fandom.com/wiki/Multiplayer
- [DG-spawns] https://duckgame.fandom.com/wiki/Spawns
- [DG-reviews] https://gamegrin.com/reviews/duck-game-review and https://gamingtrend.com/feature/reviews/insert-ducking-awesome-pun-here-duck-game-review/
- [Smash-kb] https://www.ssbwiki.com/Knockback
- [Smash-items] https://www.ssbwiki.com/Item_Switch
- [Smash-rules] https://www.ssbwiki.com/Rules
- [Smash-sd] https://www.ssbwiki.com/Sudden_Death
- [PP-steam] https://store.steampowered.com/app/1509960/PICO_PARK/
- [PP-site] https://picoparkgame.com/en/pp1
- [PP-review] https://catholicgamereviews.com/pico-park/
- [PP-wiki] https://en.wikipedia.org/wiki/Pico_Park
- Slime Climb: https://fallguysultimateknockout.fandom.com/wiki/Slime_Climb
