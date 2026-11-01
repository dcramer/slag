# slag

A browser-based competitive party platformer. Each round, players pick a prop from a crate, place it somewhere in the level, then everyone races to the flag. Your props are meant to stop your rivals without making the level impossible for you. If everyone finishes, nobody scores. If nobody finishes, nobody scores.

The twist: **levels, props, and characters are all procedurally generated** from a seed.

## Running it

```sh
npm install
npm run dev        # http://localhost:5173  (add ?seed=anything for a specific level)
npm test           # vitest
npm run build      # static bundle in dist/, deployable anywhere
```

## Controls (local multiplayer, up to 4 players)

| | P1 keyboard | P2 keyboard | Gamepad |
|---|---|---|---|
| move / cursor | WASD | arrows | stick / d-pad |
| jump | Space / W | ↑ / Enter | A |
| confirm (join, ready, pick, place) | Space | Enter | A |
| alt (rotate prop, new look, give up mid-run) | Q / E | . / Right Shift | B / X / LB / RB |
| new level (lobby) | S | ↓ | down |

## Rules

- **Pick**: the crate holds `players + 2` generated props. Each player claims one.
- **Place**: put it anywhere that's free (the spawn and goal zones are off-limits). Bombs dig out terrain and props instead. Props stay in the level for the rest of the match.
- **Run**: race to the flag. You have 45 seconds.
- **Score**: finishing earns +10 and the first finisher gets +4. Each rival killed by your prop earns +3, but only if somebody finished. If everyone finishes, the round is "too easy" and nobody scores. First to 50 wins.

## Procedural generation

Everything is derived from a 32-bit seed with a deterministic PRNG (`src/core/rng.ts`). Sim code never calls `Math.random`.

- **Levels** (`src/gen/level.ts`): a critical path of platforms marches from a spawn on the left to a goal on the right. Then one of four style passes (islands, caverns, ruins, towers) adds decoration, avoiding a keep-clear mask over walkways and jump arcs. Every candidate is then **verified with the real player controller** (`src/sim/reach.ts`). Ghost players run scripted jumps from every standable cell, and a BFS over the landings must reach the goal. If a candidate fails, generation retries with a new sub-seed. In practice it averages about 1.05 attempts and about 15 ms per level. The theme (palette, skyline, name) comes from the seed too.
- **Props** (`src/gen/props.ts`): there are nine archetypes: block (stone, ice, conveyor, or sticky), spikes, crumble, moving platform, saw, spring, turret, fan, and bomb. Each one rolls its own parameters: polyomino shapes, speeds, ranges, radii, fire rates. Names come from the rolled parameters, so a big saw might be called a "Mega Buzzsaw" from "Quoxglenk Works". Every crate is guaranteed at least one building piece and one hazard.
- **Characters** (`src/gen/character.ts`): body shape, palette, eyes, mouth, topper, pattern, and name are all generated. They are **cosmetic only**. Every character shares one hitbox and one physics model, so the game stays fair.

## Architecture

```
src/
  core/     rng, geometry helpers
  gen/      procedural generators (level, theme, props, characters, names)
  sim/      deterministic simulation: physics, level, prop runtime, run world, reachability
  game/     match state machine (lobby → pick → place → run → score → victory), scoring
  input/    keyboard + gamepad → per-device InputFrame
  render/   Canvas2D renderer (reads sim state; owns only particles & caches)
  main.ts   fixed 60 Hz timestep loop
```

The sim is a pure function of `(seed, per-frame inputs)` and has no DOM access. A test plays two full headless matches and asserts they come out identical. That determinism is the foundation for online play, which can use lockstep or rollback netcode over WebRTC and only needs to send inputs.

## Roadmap ideas

- Online multiplayer (rollback netcode over WebRTC data channels)
- Audio
- More prop archetypes and modifiers (teleporters, gravity flippers, one-way platforms, magnets)
- Larger, scrolling levels and more level styles
- Placement rule that keeps at least one route solvable (`analyzeReach` already supports it)
- Bots for solo play
