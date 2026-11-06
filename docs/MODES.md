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
| Comeback (behind for 2+ rounds, then finish) | +4/5 [UCH-rules] | underdog +3/10 after 2 scoreless rounds | consider raising toward +8 |
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
| Round length | not documented | four Normal bots: 25 s median, 8% over by 15 s (was 16 s and 41%) | 20–40 s (estimate: "short") |
| Late squeeze | after the first elimination, or after a set time with none [SR-wiki] (time not documented) | from the first one out, or 30 s, 0.3 rows a second | keep |
| No weapons at the start | first 1.5 s [SR-patch] | the slag boils 3 s; items come from boxes later | keep |
| Items | 8 kinds, from orbs on the track [SR-pickups] | 10 kinds, from the loop's boxes and placed boxes | rethink for a climb (below) |
| How boxes deal | weighted random [SR-patch]; players say by rank: drills to the back, crates to the front [SR-odds] | by rank: catch-up to the pack, defence to the leader (Rising Slag's `boxes` table, `src/game/modes.ts`) | by rank |
| Strongest catch-up | Golden Hook: swap places with the runner ahead [SR-pickups] | Queue Jumper: trade places with the runner just above | keep |
| Movement tools | grapple at 45° onto white ceilings; a boost meter [SR-controls] | walk, run, jumps, wall jumps; no grapple or boost | a grapple item |
| Early leader wins (leader at 15 s) | not documented | 56% as built, 57% with items in every hand, 64% with none (128 seeds, about 115 judged each, so ±5; 512 seeds: 64, 59, 66). Was 66, 50, 69 (512: 69, 58, 66) with a third of rounds over by 15 s | about half (estimate) |
| Lone bot gets through a lap (laps 1–3) | n/a | Easy 91/86/80, Normal 94/83/100, Hard 100/84/96 (32 seeds; was 81/81/76, 91/86/92, 100/81/92): a bot seldom falls further than a rise on bricks, short of even the hard lap's leash | `PASS_TARGETS` |

### Why catch-up isn't working yet: level design and mechanics

| | The lead-camera racer | Rising Slag today |
| --- | --- | --- |
| Track | handmade horizontal loops, everyone on the same line at about the same speed, with high and low routes (grapple ceilings over the ground) | a vertical shaft, generated per match: open air, ledges staggered like bricks with several lines up every height, a wall-jump chimney up one side (until 2026-11-05: storeys with two ways up each) |
| Pace | running speed; a lap is a stretch of screens | climbing, about 5 rows a second; a 48-row lap is about 10 s |
| Overtaking | constant: shortcuts, boosts and stuns reorder the pack | rare with bots: about 1.5 lead changes a round (leader on top a second straight), 2 with items in every hand |
| Where the leader is | ahead, on your line | above you; most of our items fire or swing sideways |
| What a hit costs | a stun: seconds of position | a bonk; on a perch, a storey, which is strong but only if you can reach the leader |
| Catch-up items | the Golden Hook swaps you with the one ahead; missiles, crates and freeze aim ahead | the Queue Jumper swaps you with the one above, the Upper Hand punches up through floors, the winged shell hunts the leader |

So the shape works against catch-up: a lead holds even between equals. Four bots with the same hands and no items still keep the 15 s leader on top 62% of the time (512 seeds); a lead of under 3 rows at 15 s wins 41%, 6–8 rows 71%, 12 or more 86–88%. A longer leash, so rounds last longer after 15 s, is what moved it most.

Tried, in order:

1. **Items that work upward** (built: the Queue Jumper and the Upper Hand). In every hand they move the early leader's wins about 5 points: trading places with one rival or punching one down rarely reorders the pack.
2. **The squeeze from the first elimination** (built): as the reference does. It shortens rounds, so the leash opens long at GO (built) to keep them at 20–40 s.
3. **Bots that get what a box deals** (built): braking at a walk, their hop under a box turned back and forth every frame and never jumped. Box uses doubled; errands are now short (3 tiles), since a detour behind the leader is climb lost.
4. **A start line** (built): four bots in one pocket jammed for seconds.
5. No effect, or worse, at 512 seeds: twice the boxes, solid floors with holes every fourth row, narrower ledges and more wells, no chimney, a lead deal of only Bubble Wrap, bots holding the Queue Jumper for the swap into the lead, bots climbing under whoever is just above (more bumps), lanes near a bot's own column (70%: the pack stops crossing).

Next: something in the level that pulls a pack back together (a lift or a gate on a cycle, which the leader waits for), or items that cost the leader seconds, not a bonk. Both are owner calls.

---

## Brawl: the party brawler (Duck Game), killing by knockback into the level as the crossover brawler does (Smash)

What we borrow: short rounds, last one standing, items from boxes knocked from below, a draw scores nothing. What's ours: nothing kills on its own (items knock, bodies shove, on the race's physics), the level does: its hazards, the parts placed in it every round (so the arena gets nastier through a match), the drop, and late in a round slag pouring in from below.

| Attribute | Reference | Ours | Target |
| --- | --- | --- | --- |
| Players | 2–8 [DG-steam] | 1–8 | 2–8 |
| Kill | one hit [DG-steam]; or knockback past a blast line, further the more damage you've taken [Smash-kb] | knockback into a hazard or off the edge; items and bumps knock, bodies shove (owner decision) | the same |
| Round won by | last standing, who must stay alive a moment; a draw scores nothing [DG-mp] | last standing (10), and a kill credited by a bonk (2); a draw (everyone out at once, or the time out) scores nothing | the same |
| Round length | 8–10 s, rarely more (a review); under a minute (another) [DG-reviews] | 40 s on average with bots, round 1 (no parts placed yet); 60 s at most | 20–40 s |
| Draws | rare (not documented) | about half of round-1 bot rounds: the slag takes the last ones together | rare |
| Match won by | 10 wins by default, checked at intermission every 10 rounds [DG-mp] | 50 points (Normal): 5 wins | the same |
| Weapons | spawners on a timer, boxes bumped from below, a mystery gun at the start [DG-spawns] | 3 boxes in every arena, handing over what they deal | the same |
| Item frequency | crossover brawler: one every 8–13 s on medium [Smash-items] | boxes refill every 5 s | one every 5–10 s |
| Catch-up | none found | none | none at first (the crossover brawler has an optional underdog boost [Smash-rules]) |
| Sudden death | crossover brawler: 300% damage, a shrinking blast zone [Smash-sd] | slag pours in from below 25 s in | the same |

The arena is a classic one-screen level that owes no part (`bare`), everyone starting from its two ends (`ends`), deadly by default: up to six set pieces from the nastiest of its set's mix (`hazards: 6`, `danger: 0.9`; about 4.7 fit), against 4 of the usual mix, runners out before the slag in round 1 went from 0.54 a round to 0.75. Bots go for the nearest rival and shove, use what the boxes hand them, and climb out of the slag; they rarely knock anyone into a hazard yet: 8 credited kills in 24 round-1 rounds of four, from 4 before the boxes dealt only knockers and the Sucker Punch.

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
| Round winner changes, item frequency | Brawl | to come with the mode |
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
