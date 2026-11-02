# Owner decisions

Every game design decision, preference and direction the owner has given, grouped by topic. Compiled 2026-11-02. [DESIGN.md](DESIGN.md) holds the rules as they stand; this is the full log behind them, reversals included.

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
- **Standing goal: finish the TODO, make the art exceptional, make the netcode bug-free.** "/goal Complete our TODO, make sure the art is exceptional, netcode is bug free."
  2026-11-02 06:33Z · `in progress` · TODO.md
- **Every game design decision is written down, even as endless lists, covering the project's whole history.** "make sure all of my game design things are documented. even if its just like infinite listicles somewhere" / "i kind of want decisions for all of time"
  2026-11-02 17:52Z · `done` · this file

## Match flow and rules

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
  2026-11-02 17:49Z · `in progress` · DESIGN.md → Scoring

## Movement and physics

- **Movement is a tight precision platformer: variable jumps, wall slide and wall jump, coyote time, jump buffering, corner correction.**
  2026-11-01 · git `c5715ab` · `done` · DESIGN.md → Movement
- **Wall jumps follow the held direction, and wall slides are faster (playtest feedback).**
  2026-11-02 · git `45e64b2` · `done` · DESIGN.md → Movement
- **Walking is slow and precise; holding Run gives speed and long jumps with momentum.**
  2026-11-02 · git `66ae3f0` · `done` · DESIGN.md → Movement
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
- **The spawn zone is safe: nothing hurts you while you touch it.**
  2026-11-02 · git `ec85347` · `done` · DESIGN.md → Players
- **Players in one lobby always look different.** "also our two dudes look the same"
  2026-11-02 04:36Z · `done` · DESIGN.md → Players, NETCODE.md → Seats and kicks
- **The New Look dice rerolls the look and keeps the name, without flicker.** "when i click roill the dice it flickers a bit.. and the player name ... also flickers"
  2026-11-02 15:50Z · `done` · DESIGN.md → Players

## Characters

- **Runners should have more identity and variety (a bumblebee pattern, say), maybe themed bodies instead of heads, the way the barnyard game uses animals.** "they're a little generic now and while they're cute and fun id love to see more interesting textures/variety"
  2026-11-02 16:30Z · `done` as a proposal · CHARACTERS.md
- **Direction C, foundry toys.**
  2026-11-02 17:16Z (answer) · `done`, then replaced · CHARACTERS.md
- **The cast is a mix of animals and invented critters, and the critters may parody famous characters (a fake jellyfish-brain floater, a mustached plumber, a robot, a goose, a hard-hat engineer).** "idk how we ended up with toys. that wasnt the original goal, and its not on theme" · "critters could include other parody things... like a fake metroid, a fake mario, a robot, a goose, etc. a fake engineer from tf2 etc"
  2026-11-02 · `in progress` · CHARACTERS.md, DESIGN.md → Players and Parody
  Changed: toys replaced by animals plus parody critters.
- **The cast is mostly homages: about two thirds parody famous game characters, with a few plain animals for contrast, and the art is raised further.** "its better but you still need more parody and the art needs to be better yet..."
  2026-11-02 · `in progress` · CHARACTERS.md, DESIGN.md → Players
- **Recognisability is the top criterion: each homage must read as its original at a glance, so its iconic palette wins and the player's colour moves to a secondary slot (a ring at its feet).** "the only thing that remotely resembles the thing its mimicking is the puff ball (kirby)"
  2026-11-02 · `in progress` · CHARACTERS.md
  Changed: the player's colour was always the body or a big worn piece.
- **Player characters may parody famous characters under our own designs and sound-alike names; parts and machines stay faceless.**
  2026-11-02 · `in progress` · DESIGN.md → Parody, CHARACTERS.md
- **Characters are drawn cleaner, lighter and more hand-drawn: thinner, varied lines in a dark of the body color, calmer color, fewer bold outlines.** "i want more cleanly designed art that isnt so loud/bold lines etc and more visually hand draw"
  2026-11-02 · `in progress` · CHARACTERS.md, ART.md → World art
- **Each kind is a distinct character design (its own outline, signature part and gait), and fewer strong kinds beat many similar ones.** "ultimate chicken horse doesnt have this issue because the characters are clearly unique looking"
  2026-11-02 · `done` · CHARACTERS.md
- **The player's colour is the loudest note: the body, or a big worn piece for a kind whose palette is its identity.**
  2026-11-02 17:16Z (answer) · `in progress` · CHARACTERS.md
  Changed: on the toys it was always a worn or painted part, never the body.
- **New characters come from a random roll only; players don't choose a kind.**
  2026-11-02 17:16Z (answer) · `done` · CHARACTERS.md
- **Everyone's saved look is re-rolled once, and again whenever the cast changes what a seed means.**
  2026-11-02 17:16Z (answer) · `done` · CHARACTERS.md
- **Characters and the menu crowd take the art style, but stay as clean as they are.** "i like how they look right now so make sure ou keep it clean like it is and dont break it"
  2026-11-02 15:49Z · `done` · git `a6963c8`, `3eb7c44`; ART.md → World art

## Parts and the crate

- **Parts are built from modules; a part's numbers are rolled once per match and its name comes from them.**
  2026-11-01 · git `552ac6a`, `908b1c2` · `done` · DESIGN.md → Props
- **Each match uses a few parts, which vary only in size.** "1) we should select N unique items per match 2) the items can still have variants (just in size)"
  2026-11-02 04:56Z · `done` · DESIGN.md → Props (roster, variants)
  Changed: every card rolled a fresh random part (`908b1c2`).
- **After rounds nobody finishes, crates lean toward bombs and building parts.** "handicap the rng on item selection so if conseuctive rounds people cant finish, you add more weight to a bomb or platforms"
  2026-11-02 04:42Z · `done` · DESIGN.md → Props (A match can always be finished)
- **A match can always be finished: crates always offer what the level still needs, and placements that leave no plan are refused.**
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
- **Conveyors must rotate like any part: a belt on the side drags wall-sliders, and one underneath shoves you when you bonk your head.** "you cant rotate conveyros.. the conveyor always stays on the top"
  2026-11-02 17:51Z · `in progress`
- **Coats and blocks stick to moving parts and ride them, as honey rides a turning conveyor.** "if you had honey on something like a conveyor (that rotated around), the honey would rotate with it, and then you could also stick another block on it"
  2026-11-02 17:36Z · `done` · DESIGN.md → Props, "Parts ride what they're stuck to"; `src/sim/props/ride.ts`
- **Arriving mid-match puts you in as an observer; choosing Join opens a small lobby-style card (your toy with the New Look dice, your name) and seats you next round.** "when you join a match you'll default to observer fwiw, and then you can somehow choose to join, and if you do you might get a little screen to select your character/name almost like the lobby does"
  2026-11-02 · `done` · DESIGN.md → Online (Seats, Join)
  Changed: an up-front Join-or-Watch choice on arrival.
- **Characters on the join card stay random-roll only: the New Look dice, no picker.**
  2026-11-02 · `done` · DESIGN.md → Online (Join)
- **Landmarks offer several ways through, so blocking one with a part forces rivals another way.** "the nice thing about level design like this: you could block off one exit and forces players to go a diff way (with a beam, as a player)"
  2026-11-02 · `done` · DESIGN.md → Stage concepts
- **At least 5 landmarks per theme; all large, some grand, every one with randomness in its layout.** "things like the haunted wing are cool. i'd want no less than 5 landmarks per theme, all should be at least large on scale, some _grand_ all should have a little bit of randomness built into them in terms of layout/etc as well"
  2026-11-02 · `in progress` · SETPIECES.md → 3, DESIGN.md → Stage concepts
- **Every theme has at least 12 decor pieces and at least 3 hazards unique to it.** "similarly we probably want no less than a dozen 'decor' pieces that can exist in each theme? and maybe no less than 3 unique hazards per theme?"
  2026-11-02 · `in progress` · DESIGN.md → Stage concepts
- **The cast is animals plus parody critters, not toys.** Toys (foundry wind-ups) are dropped: "idk how we ended up with toys. that wasnt the original goal, and its not on theme". Critters may parody famous characters with our own design and a sound-alike name: "critters could include other parody things... like a fake metroid, a fake mario, a robot, a goose, etc. a fake engineer from tf2 etc". Changed: replaces direction C (foundry toys).
  2026-11-02 · `in progress` · CHARACTERS.md, DESIGN.md → Players
- **Art everywhere is cleaner, lighter and more hand-drawn: thinner, varied lines, less loud colour.** "i want more cleanly designed art that isnt so loud/bold lines etc and more visually hand draw"; applies to characters, parts, terrain, landmarks and UI.
  2026-11-02 · `in progress` · ART.md → World art
- **A really short lore guides design: Slag is the runoff of the Great Foundry, a scrap world of melted-down levels and characters who never made the cut, racing for the one mould that casts the winner into a real game.** "we might want in our game design a REALLY short piece of lore that explains the world of slag, who the characters are, why they're trying to get to the goal"
  2026-11-02 · `done` · DESIGN.md → Lore
- **AI players are a future TODO.** "another future TODO: AI"
  2026-11-02 · `planned` · TODO.md → 27
- **Each theme has at least 1 and at most 3 grand landmarks among its 5+.** "id like at least one grand landmark, no more than 3 (in the min 5 landmarks)"
  2026-11-02 · `done` (enforced) · `GRAND_LANDMARKS` in src/gen/kinds.ts, tests/conformance/themes.test.ts
- **Lobby browser: a list of lobbies, showing only ones that aren't full by default.** Lobbies are public by default with a Private option. "lets make lobbies public by default with a private option"
  2026-11-02 · `planned` · TODO.md → 26
- **Conveyors rotate: the rotation picks the belt's face.** A side belt grips and carries a clinging runner (an escalator when it runs up), a bottom belt shoves a head that bonks it. "you cant rotate conveyors.. the conveyor always stays on the top"
  2026-11-02 · `done` · DESIGN.md → Props, Conveyors
- **The parody first batch: Walk-Off Bat, Tremor Brick, Front-Runner Tax, Pocket Block, Launch Plate, Four-Square, Boost Strip, Panic Button, Fuse Crate, Y-Fling.**
  2026-11-02 · items `done` (DESIGN.md → held items), parts `in progress` · PARODY-BACKLOG.md → 3
- **Backlog questions settled by the coordinator** (the owner may override): items may make solids mid-race (Pocket Block; no proof counts on them); Front-Runner Tax measures "first" by real route distance (`goalField` in `src/sim/reach.ts`); the noodle pogo is dropped, since down + Use already tosses.
  2026-11-02 · `done`
- **The rest of the parody backlog.**
  2026-11-02 · `planned` · PARODY-BACKLOG.md → 1
- **Small parts still draw small on crate cards.**
  2026-11-02 · `open` · TODO.md → 21

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
- **Wave 2: the factory's Great Wheel and the castle's Haunted Wing.** "in a factory level it had a HUGE wheel (not just a small thing)"
  2026-11-02 16:18Z · `in progress` · SETPIECES.md → 5
- **World-only theme props can be much bigger and more unusual than placeable parts; the broken glass is a giant world prop you can't place.** "the broken glass could be an in-world prop that we cant place and be much larger"
  2026-11-02 17:48Z · `in progress` (Haunted Wing) · SETPIECES.md
- **Waves 3–5: concepts for every theme.**
  2026-11-02 · `planned` · SETPIECES.md → 5
- **Triggers between pieces and changes between rounds are out of scope for now.**
  2026-11-02 · `open` · DESIGN.md → Stage concepts

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

## UI, menus and copy

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
- **Self-destruct is a deliberate 1.25 s hold on every input, counted by the sim from a fresh press, with a ring around the runner everyone sees; letting go, steering, jumping or using an item cancels it. On touch it moves to its own small button under Settings.** "also the default self destruct behavior should probably be a bit less accidental both for mobile and the hotkey"
  2026-11-02 · `done` · DESIGN.md → Controls and UI, MOBILE.md, ART.md → Input prompts
  Changed: one press of alt popped you on keyboard and pad, and touch popped after a 0.35 s hold on ALT, the button that rotates during place.
- **The self-destruct hold is 3 s, and your own charge counts down 3, 2, 1 in the middle of the screen.** "self destruct could probably be more like a 3 second hold" / "and show in the center of the screen as like a countdown so you dont miss it?"
  2026-11-02 · `done` · DESIGN.md → Controls and UI, MOBILE.md
  Changed: the hold was 1.25 s, with only the ring around the runner.
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
- **The idle timeouts: 30 s without input in a pick, place or race (from the phase's start), 60 s in the lobby; after that a player is AFK until their next input. Online an AFK player moves to the watchers: at once in the lobby, mid-match after two rounds in a row ended AFK. A guest sending nothing for 1 s has its held buttons let go.**
  2026-11-02 · `done` · DESIGN.md → Players, NETCODE.md
- **Test the Upstash path locally with a compatible service.** "add to the TODO to have a compatible service locally for testing it? thats compat with upstash redis remote and their lib?"
  2026-11-02 03:46Z · `done` · AGENTS.md → `pnpm test:store`
- **Whether to shorten two-peer host loss with a lower `PROBE_MS` is undecided.**
  2026-11-02 · `open` · TODO.md → 2

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
- **pnpm is the package manager and Node 24 the runtime; pnpm settings live in `pnpm-workspace.yaml`.** "get this fixed up"
  2026-11-02 02:46Z · `done` · AGENTS.md → Commands
  Changed: npm, then Node 22 (`6ebfbd4`).

## Tooling and process

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
- **Do a cleanup pass of the repo, docs and code.** "we'll want a cleanup pass of the repo, docs, code, etc soon"
  2026-11-02 06:17Z · `done` · git `2ffff9d`–`d67a7e0`
- **Delete merged and superseded branches.** "Yes"
  2026-11-02 15:27Z · `done` · git `8b1ea2e`
- **Resume interrupted agents, and resume merging.** "Resume all" / "Yes, resume merging"
  2026-11-02 07:22Z, 16:20Z · `done`
- **Make the GitHub Actions check required (an owner step).**
  2026-11-02 · `open` · TODO.md → 10
- **Apply the quick wins from the transcript review: guard-safe commands for worktree agents, one `pnpm land` per batch instead of a merge and a gate per branch, and `SNAP_VERSION` bumped once at landing, never in a branch.** "Apply quick wins"
  2026-11-02 · `done` · AGENTS.md → Git workflow, `tools/land.ts`, `src/net/snapshot.ts`
