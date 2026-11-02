# Game design decisions

This is a concise log of decided rules. It's the source of truth for gameplay intent. When a decision changes, update this file in the same commit. Implementation details live in AGENTS.md and the code.

## Core loop
- Lobby → **Pick** (claim one prop from a crate) → **Place** (put it in the level) → **Race** to the flag → **Score**. Repeat until someone reaches the target score, then **Victory**.
- Matches have 1–8 players. Players can be local (any mix of keyboard, gamepads and touch) or online.
- Props persist for the whole match, so levels get more dangerous every round.

## Scoring
- Finishing earns +10 points. The first player to finish gets an extra +4.
- Each rival killed by your prop earns you +3, but only if someone finished that round.
- If everyone finishes, nobody scores ("too easy"). If nobody finishes, nobody scores either.
- Solo play just rewards finishing.

## Players
- Characters are generated per player (body, face, accessory and name) and are **cosmetic only**: every player has the same hitbox and the same physics.
- The local player's **name and look persist** across sessions (localStorage). On first join the game asks for a name, with the random one offered as the one-click default.
- **Spawn zone is safe**: while inside the starting zone you can't be killed.
- **Players nudge each other**: bodies softly push apart. You can shove someone slowly, but if they push back the shove nearly cancels out. There's no hard blocking and no stacking.

## Movement (precision-platformer feel)
- **Walk vs run.** Walking is slow and precise, about 6.6 tiles/s, with short jumps of about 4 tiles. Holding **Run** gives about 13.4 tiles/s and jumps of about 8 tiles, but run momentum builds over a beat, skids when you let go or turn, and carries you past ledges if you're careless.
- Variable jump height (hold to go higher), coyote time, jump buffering, a little hang at the apex, and fast-fall (hold down in the air).
- **Wall slide and wall jump.** Holding into the wall while mashing jump climbs it; holding away kicks off hard.
- **One-way platforms**: jump up through them; down + jump drops through.
- Forgiving corner correction on ceilings and ledge lips.
- **Gravity is a level setting**: Auto (rolled per level), Low, Normal or High. Levels are validated at their own gravity.

## Levels
- Every level has a **theme**: farm, factory, castle, jungle, volcano, harbor, mine or rooftops. The theme drives the terrain shapes, look, music and set pieces, so a farm reads as a farm.
- **Levels vary**: size and aspect (wide, classic, tall), sparse vs dense terrain, few vs many hazards, and route shape (sprawl, climb, descent, zig-zag).
- **Most levels need props.** Roughly 70–85% can't be finished bare. Every level must be finishable with **at most two small bridges**, verified with the real movement controller and never with hand-waved distances.
- The spawn and goal zones are protected: nothing can be built or bombed there.
- Set pieces are large, pre-placed theme props: tractor, windmill, foundry press, chandelier, minecart, geysers, crane and so on. They never block the known solution and keep their hazards away from spawn and goal. They are visible in every phase.

## Props
- Props are assembled from **parts**: blocks of various materials, spikes, swinging heads, launchers, emitters, motion, springs, fans and bombs. Every number is rolled, and names come from the rolled stats.
- Every crate contains at least one building piece and one hazard.
- **Attachments** (spike strips, ice coats, slime coats) must mount flush on an exposed face of a solid block, and rotation picks the face.
  - Ice makes floors slippery and walls slick (no wall jump).
  - Slime makes floors slow and walls sticky (you cling).
- Bombs clear terrain and/or props depending on their kind. Attachments fall off when their host block is destroyed.
- **Movers and traps with a catch.** Warp pads (keep your velocity; misdirection), bumpers (aimable kick), gravity wells / repulsors (bend jumps), webs (catch falls, slow you), launch barrels (grab you, fire you on jump), blink blocks (solid on a timer, pairs alternate, never reappear inside you), cog wheels (ride platforms), dropstones (slam when you pass under, ride them back up) and snap traps (face-mounted spikes that pop when you linger). Every timed or triggered part shows a tell first.
- **Status effects are plain, short and visible**: frozen (no control, ~0.8 s, ice block) and slowed (capped speed and jumps, ~2 s, goo drips).
- **Launchers mostly hold their aim.** Aim rolls fixed 7 : sweep 2 : track 1.5. Trackers only watch ±60° of their mount, always carry a tracking word in their name, show a red sensor eye, and crate cards tag the aim (FIXED / SWEEPS / TRACKS).
- **Projectiles vary**: true homing seekers (slow, red eye, rare), boomerangs, rubber balls (bounce; shove, don't kill), cluster shells (split at the top of the arc), goo and frost (non-lethal; slow or freeze you, coat terrain in slime or ice for a few seconds), ricochets (bank off walls) and **gliders** (a launcher fires rideable planks that fly level, then sink, faster under a rider).
- **Demolition variants**: bomb (disk, everything), EMP (props only), drill (terrain-only bore in the rotation direction), cross and ring charges, and time bombs (go off as the race starts, so they catch whatever was placed that round; a charge caught in an earlier blast is defused). The placement ghost shows every affected cell and outlines the props that will go.
- **Updrafts are steady**: inside a fan column you rise or are pushed at a constant speed, standing in a column never stops you from jumping, and the visuals match exactly when it pushes.

## Rules ("level settings", set by the host)
- Points to win: default 50.
- Pick timer: default 15 s. When it runs out, stragglers get a random leftover prop.
- Place timer: default off. When on, an unplaced prop is forfeited.
- Race timer: default off.
- Gravity: default Auto.

## Controls and UI
- On PC, keyboard and mouse both work. One keyboard player can use WASD *and* the arrows. A "Split keyboard" setting turns the keyboard into two local players. Everything can be remapped.
- The mouse drives the menu cursor: click to pick or place, right-click or the wheel to rotate.
- Touch controls on mobile.
- In the lobby, a stray click does nothing; only buttons act.
- UI copy is proper title case, with no twee lowercase taglines.
- Inputs are shown as **button prompts** (keycap, gamepad and mouse glyphs) in a footer, the way console games do it, and are never spelled out in prose.
- Empty lobby slots show **OPEN**.

## Online
- The URL `/r/<code>` identifies a lobby; the homepage is a normal main menu. There's no matchmaking, and you join only through a shared link.
- **Host = the earliest-joined connected player.** When the host leaves, the next player in join order takes over seamlessly. When everyone leaves, the next arrival becomes host. A refresh rejoins the same slot.
- Netcode sends inputs only over a deterministic simulation that must be bit-identical across browsers.

## Platform
- Built with Next.js on Vercel. All game logic runs client-side, and the server only renders thin route shells.
