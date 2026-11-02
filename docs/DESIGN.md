# Game design decisions

This is a concise log of decided rules. It's the source of truth for gameplay intent. When a decision changes, update this file in the same commit. Implementation details live in AGENTS.md and the code.

## Core loop
- Lobby → **Pick** (claim one prop from a crate) → **Place** (put it in the level) → **Race** to the flag → **Score**. Repeat until someone reaches the target score or the round limit, whichever comes first, then **Victory**.
- Matches have 1–8 players. Players can be local (any mix of keyboard, gamepads and touch) or online.
- Props persist for the whole match, so levels get more dangerous every round.
- Round 1 is often unfinishable, especially with few players. That's expected: nearly every level needs parts, and parts build up over the match.

## Discovery
- Part of the joy of the game is the unknown. Players learn parts, rules and tricks by playing and by watching each other.
- The game never explains the obvious: no sub lines, hints or notes that restate what's on screen or spell out a rule. If the screen can show it, don't say it.

## Parody
- Our goal is to parody other games, especially with items. Players should recognize what's being mocked and laugh at the twist.
- A parody is ours: our own name, our own art and a comic twist on the idea. Never the original's real name, art, characters or level designs.

## Scoring
- Finishing earns +10 points. The first player to finish gets an extra +4.
- If you finish, each rival killed by your prop, or by the level right after your bonk, earns you +2. Traps alone don't pay: you have to reach the flag too.
- If you finish while trailing the leader, after 2 or more rounds in a row without a point, you earn an underdog bonus of +3.
- If everyone finishes, nobody scores ("too easy"). If nobody finishes, nobody scores either.
- Solo play just rewards finishing.
- A match always ends: scoreless rounds can run forever, so the round limit has no "off" setting.
- The lobby sets both win conditions with one **Match Length**: Short (30 points or 10 rounds), Normal (50 points or 15 rounds, the default) or Long (80 points or 25 rounds). The limit is meant to decide some matches, mostly with 2 players, where a round only scores if exactly one player finishes.
- At the end of a match the top score wins and ties are joint winners. If the round limit hits with nobody on the board, there is no winner.
- Anything that lists scores shows the most points first, with ties in slot order. This is display only: player order in the sim never changes. On the score screen, rows slide to their new rank as the bars fill.

## Players
- Characters are generated per player (body, face, accessory and name) and are **cosmetic only**: every player has the same hitbox and the same physics.
- The local player's **name and look persist** across sessions (localStorage). On first join the game asks for a name, with the random one offered as the one-click default.
- **Spawn zone is safe**: the starting zone is the protected rect around the spawn (the start pocket), shown during races as a faint shimmer. While your body touches it, props and items can't hurt you: hazards don't kill, projectiles that reach you pop harmlessly, bonks and smoke don't reach you, and moving solids can't crush you. A faint bubble marks protected runners. The pit, giving up and the race timer still apply (the pit can't be reached from inside the zone anyway).
- **Players nudge each other**: side-by-side bodies resist each other instead of passing through. Walking into someone standing still shoves you both along at about an eighth of walking speed (a run-up shoves a little harder). If they push back, it nearly cancels: only the difference in effort leaks through as a tiny drift. Being rear-ended never slows you down. Nudges never push anyone into terrain; someone pinned against a wall just lets you squeeze into them. There's no hard blocking and no stacking: jumping onto or over someone passes through them (no head bonks). Finished and dead runners don't push.

## Movement (precision-platformer feel)
- **Walk vs run.** Walking is slow and precise, about 6.6 tiles/s, with short jumps of about 4 tiles. Holding **Run** gives about 13.4 tiles/s and jumps of about 8 tiles, but run momentum builds over a beat, skids when you let go or turn, and carries you past ledges if you're careless.
- A full jump is about 3.7 tiles high and a tap about 1.3. Variable jump height (hold to go higher), coyote time, jump buffering, a little hang at the apex, and fast-fall (hold down in the air).
- **Wall slide and wall jump.** Holding into the wall while mashing jump climbs it; holding away kicks off hard.
- **One-way platforms**: jump up through them; down + jump drops through.
- Forgiving corner correction on ceilings and ledge lips.
- **Gravity is a level setting**: Auto (rolled per level), Low, Normal or High. Levels are validated at their own gravity.

## Levels
- Every level has a **theme**: farm, factory, castle, jungle, volcano, harbor, mine or rooftops. The theme drives the terrain shapes, look, music and set pieces, so a farm reads as a farm.
- **Levels vary**: size and aspect (wide, classic, tall), sparse vs dense terrain, few vs many hazards, and route shape (sprawl, climb, descent, zig-zag).
- **Levels are mostly open.** Corridors are fine in places, but there's never only one narrow way to the goal: there are always route options, with hazards and choices along them. Measured on the real controller's routes with a level's required parts in place: take the fastest route and widen it by 2 tiles either side; a second route must stay out of that lane for at least 40% of the way. The spawn and goal pockets and the span of a bridge don't count, since nobody has a choice there. A level short of that gets raised lanes of jump-through platforms (carved galleries in a mine), and towers get two connectors between every pair of storeys. A tower's parts go on moats every route has to cross, on the goal storey and, for a second part, the spawn storey.
- **Run is a choice.** Most gaps can be walked across and some take a run-up; platforms too short to run on are always a walking hop apart.
- **Levels need parts.** About 99% can't be finished bare, and 20–30% need two parts; the rest need one. What stops a bare run is a gap or a wall a part solves, never a sealed level. Every level must be finishable with **at most two small bridges**, verified with the real movement controller and never with hand-waved distances.
- The spawn and goal zones are protected: nothing can be built or bombed there.
- **The flag is generous**: its finish trigger is a bit wider than the flag and reaches 4 tiles up, so jumping clear over it still counts. Touching it ends your control: you drop, land and ride platforms with normal physics, and nothing can hurt you anymore.
- **Weather (planned)** is a per-level random variable: wind gusts that push runners and projectiles, mist that limits sight distance, rain or snow that changes footing. It's always telegraphed and it's tuned per theme.
- **The picture fills the window.** The play view keeps one aspect and scale, so nobody sees more of a level by resizing, and there are no bars or visible edge around it. The sky and skyline run to the window's edges, levels stand on the ground with the sky above them, and past the map's edge the level carries on as hazy scenery in its own theme: farmland, curtain walls, a harbor shed and open water, solid rock. The scenery can't be reached, and corner UI stays in the window's corners.
- **The camera always frames every live runner**, local or remote, with a margin: it zooms out as far as it takes, down to the whole level, and catches up instantly if smoothing would let anyone leave the screen. Finished and dead runners drop out of the framing.
- **Render layers, back to front:** sky and skyline; background halves of set pieces (a windmill's tower, a crane's mast); liquids (water and lava); terrain, props and the moving parts of set pieces (the windmill's blades); players; effects. Scenery that you can't touch sits behind the terrain.
- Set pieces are large, pre-placed theme props: tractor, windmill, foundry press, chandelier, minecart, geysers, crane and so on. They never block the known solution and keep their hazards away from spawn and goal. They are visible in every phase.

## Props
- **Not everything is death.** Most parts have an upside *and* a side effect you have to worry about: knockback, slow, freeze, sticky, misdirection, or a platform that sinks. Lethal parts exist, but disruption is the norm.
- **Some projectiles are platforms.** For example, gliders fired from a launcher can be ridden, but they sag and sink under weight or over time.
- **Demolition comes in variants:** prop-only charges that leave terrain, terrain drills or tunnelers, and different blast shapes and sizes. All respect spawn and goal protection.
- **Mystery crates** are solid one-tile blocks. Hit one from below or bump its side and a random *held item* from its pool pops out of the top (out of the bottom under a low roof). Standing on it does nothing. Crates roll their pool (mixed, shots or gadgets, hinted by the spark color), and either refill on a timer or run out and go dark. Which item pops is seeded per race, so a crate that survives a round doesn't repeat itself, and it's the same on every peer.
- **Held items** are carried one at a time, grabbed by touching them (contested items go to the nearest runner). The Use button fires them; down + Use tosses them. Loose items fizzle out after 10 s. Runners who die or finish drop theirs, except into the pit. Nothing carries over between rounds. **Items never kill on their own**: they bonk (a shove plus ~0.5 s of seeing stars, with no control), and a death soon after a bonk credits the bonker, like any trap kill. Every item has a catch:
  - **Foam Sword** (4 swings): bonks rivals and swats shots back, which makes them yours (rideable gliders and stuck patches are left alone). You crawl while you swing.
  - **Ricochet Puck**: slides along floors and banks off walls, and can come back to bonk its kicker.
  - **Boomerang**: bonks the first rival it meets and curves back to your hand, wherever you've run to. If it hits anything else it clatters down for anyone to grab. A launcher's boomerang stays lethal.
  - **Pop Shield**: soaks one lethal hit and pops you upward, with a short guard after. It doesn't stop falls or crushes, and carrying it lowers your jumps. Use drops it.
  - **Pocket Rocket**: one huge steerable burst upward, then the fumes daze you.
  - **Smoke Bomb** (2 bombs): a thick cloud that hides the ground and slows everyone inside, you included.
- **Grab props** hold you and move your body in place of the controller; your hitbox doesn't change. A part holds one runner at a time, and a contested grab goes to the nearest runner, then the lower slot. There's a short cooldown before you can re-grab the part you just left, but any other part is fair game at once, so they chain. While held, fields, springs, wind and kickers skip you and nobody nudges you. Hazards, the pit, the flag and self-destruct all still apply. If the part goes away, a solid moves into you, or anything shoves you (a knock, a shield pop, a rocket), it lets go and you keep your speed.
  - **Sausage Vine** (the jungle-vine swing, on a butcher's hook): hangs from a ceiling or a placed block. Where there's no ceiling at all above it, it's lowered in on a string from open sky, so it can always be placed; it drops rows to reach a ceiling, and rotation does nothing. It falls with the ceiling it hangs from. You grab it automatically when you touch it in the air, wherever you touch it, and your speed becomes swing speed. Left and right pump the swing; jump lets go along the swing with a little extra fling, enough that a good release beats a running jump. **The catch:** it snaps if you hang on too long and grows back later. The links sear and thin first. Held items work on it.
  - **Kegapult** (the barrel cannon, as a moonshine keg): pulls you in on contact, on foot or in the air. Some hold a fixed aim and some tip between stops. Jump locks the aim and fires you after a short delay. **The catch:** a fuse burns down while you sit inside, and if it runs out the keg backfires, out of the rear and slower, and leaves you sooty. Held items stay in your pocket inside a keg. A shot that falls back into its own keg gets caught again.
- Props are assembled from **parts**: blocks of various materials, spikes, swinging heads, launchers, emitters, motion, springs, fans and bombs. Every number is rolled, and names come from the rolled stats.
- Every crate contains at least one hazard and enough plain building parts for what the level still needs, counting what's already placed, so a match can always be finished. After rounds where nobody finishes, crates quietly lean toward bombs and building parts, gently after one dry round and more from the second, up to a cap. Crate contents are tied to the level seed and round, but the card order is shuffled with a per-match salt the host rolls, so it differs every game.
- **Every part can always be placed somewhere**, or a pick could stall the place phase on a level without the right surface.
- **Attachments** (spike strips, ice coats, slime coats, snap traps) must mount flush on an exposed face of a solid block, and rotation picks the face.
  - A strip too long for its spot still places: only the cells that can mount land, the rest are gone for good, and the ghost shows exactly what lands.
  - Ice makes floors slippery and walls slick (no wall jump).
  - Slime makes floors slow and walls sticky (you cling).
- Bombs clear terrain and/or props depending on their kind. Attachments fall off when their host block is destroyed.
- **Movers and traps with a catch.** Warp pads (keep your velocity; misdirection), bumpers (aimable kick), gravity wells / repulsors (bend jumps and drag you along the ground), webs (catch falls, slow you), blink blocks (solid on a timer, pairs alternate, never reappear inside you), cog wheels (ride platforms), dropstones (slam when you pass under, ride them back up) and snap traps (face-mounted spikes that pop when you linger). Every timed or triggered part shows a tell first.
- **Status effects are plain, short and visible**: frozen (no control, ~0.8 s, ice block) and slowed (capped speed and jumps, ~2 s, goo drips). The spawn zone shields you from them, and from fields and kicks, as it does from hazards.
- **Launcher aim is legible.** Aim rolls fixed 7 : sweep 2 : track 1.5, so most launchers hold a fixed direction. Trackers only watch ±60° of their mount, always carry a tracking word in their name, show a red sensor eye, and crate cards and the codex state the aim (Fixed, Sweeps, Tracks).
- **Projectiles vary.** Only one kind homes: the seeker, which is rare, slower than a run, has a blinking red eye and is tagged HOMING on its card. The rest: boomerangs, rubber balls (bounce; shove, don't kill), cluster shells (split at the top of the arc), goo and frost (non-lethal; slow or freeze you, coat open terrain in slime or ice for a few seconds, never inside a protected zone or a one-tile gap), ricochets (bank off walls) and **gliders** (a launcher fires one-way planks you can ride: they fly level, then sink, faster the more riders they carry, and can never pin you).
- **Demolition variants**: bomb (disk, everything), EMP (props only), drill (terrain-only bore in the rotation direction, leaving props alone), cross and ring charges, and time bombs (go off as the race starts, so they catch whatever was placed that round; a charge caught in an earlier blast is defused). The placement ghost shows every affected cell and outlines the props that will go.
- **Solids stop whatever travels.** Flames, lasers, geysers, fan columns, shots, crushers and tracker sight stop at terrain and at any block that's solid on that frame, so a block is a shield; a tesla arc needs a clear line between its coils. One-way platforms, gliders and a part's own body don't stop them, and runners never do: a beam goes through everyone in it.
- **Updrafts are steady**: inside a fan column you rise or are pushed at a constant speed, standing in a column never stops you from jumping, and the visuals match exactly when it pushes.

## Rules ("level settings", set by the host)
- Points to win: default 50.
- Pick timer: default 15 s. When it runs out, stragglers get a random leftover prop.
- Place timer: default off. When on, an unplaced prop is forfeited.
- Race timer: default off.
- Gravity: default Auto.

## Controls and UI
- A picked part's card leaves the crate entirely. The other cards stay where they are.
- On PC, keyboard and mouse both work. One keyboard player can use WASD *and* the arrows. A "Split keyboard" setting turns the keyboard into two local players. Everything can be remapped.
- The mouse drives the menu cursor: click to pick or place, right-click or the wheel to rotate. They do nothing else, so a stray click can't self-destruct.
- **Touch (mobile)**: left half is a floating stick (push past ~70% to run), right half is jump (hold for height), self-destruct needs a short hold, and a Use button appears above jump while you hold an item. Pick by tapping a card; place by dragging a ghost that floats above your finger, with ROTATE and PLACE buttons. Landscape first.
- In the lobby, a stray click does nothing; only buttons act.
- UI copy is proper title case, with no twee lowercase taglines.
- Inputs are shown as **button prompts** (keycap, gamepad and mouse glyphs) in a footer, the way console games do it, and are never spelled out in prose.
- Settings are tabs, one screen each with no scrolling at 720p: Audio, Video, Keyboard, Mouse, Gamepad (Touch replaces the last three under touch). The same menu opens on the home screen and in-game, and works with mouse, touch, keyboard (Q/E tabs, arrows) and gamepad (LB/RB tabs, Start opens, B closes). It reopens on the last tab of that page load. Reset Controls shows on the Keyboard tab only, since nothing else it resets is on screen.
- Empty lobby slots show **OPEN**.

## Online
- The URL `/r/<code>` identifies a lobby; the homepage is a normal main menu. There's no matchmaking, and you join only through a shared link.
- Everyone connected has a seat in the lobby without pressing anything, up to 8 players. Past that they spectate.
- The host wears a `HOST` label in the lobby, and it moves with the host. The host can kick a player from the lobby only, by mouse, or with Use, then Confirm on keyboard or gamepad. A kicked player lands on the main menu and can't refresh back in.
- **Host = the earliest-joined connected player.** When the host leaves, the next player in join order takes over seamlessly. When everyone leaves, the next arrival becomes host. A refresh rejoins the same slot.
- Netcode sends inputs only over a deterministic simulation that must be bit-identical across browsers.
- Peers connect over WebRTC in a star around the host, so a pair that can't connect directly drops to local play. Details: `docs/NETCODE.md`.
- In pick and place everyone sees everyone's cursor and held part live. A card belongs to whoever the host hears first; nobody sees a claim that gets taken back.

## Platform
- Built with Next.js on Vercel. All game logic runs client-side. The server renders thin route shells and runs small, stateless signaling routes for online play.
