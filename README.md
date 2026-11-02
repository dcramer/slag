# slag

A browser-based competitive party platformer. Each round, players pick a prop from a crate, place it somewhere in the level, then everyone races to the flag. Your props are meant to stop your rivals without making the level impossible for you. If everyone finishes, nobody scores. If nobody finishes, nobody scores.

The twist: **levels, props, and characters are all procedurally generated** from a seed.

## Running it

```sh
pnpm install
pnpm dev        # http://localhost:3000 → main menu; Play opens a new lobby /r/<code>  (?seed=… forces a level)
pnpm check      # typecheck + lint + fast tests
pnpm test:slow  # full generator sweeps (CI always runs these)
pnpm shot -- race --race all   # headless screenshots into shots/
pnpm level -- myseed           # ASCII level inspector
pnpm build         # production build (what Vercel runs)
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

- **Levels** (`src/gen/level/`): a critical path of platforms marches from a spawn on the left to a goal on the right. Then one of four style passes (islands, caverns, ruins, towers) adds decoration, avoiding a keep-clear mask over walkways and jump arcs. Every candidate is then **verified with the real player controller** (`src/sim/reach.ts`). Ghost players run scripted jumps from every standable cell, and a BFS over the landings must reach the goal. If a candidate fails, generation retries with a new sub-seed. In practice it averages about 1.05 attempts and about 15 ms per level. The theme comes from the seed too: mood (day, dusk, night, infernal, or toxic), sky, sun, moon, planet, or eclipse, skyline layers, terrain material, the liquid pool at the bottom, ambient particles, decor, and color grade.
- **Props** (`src/gen/props.ts`): props are assembled from **modules** by archetype recipes, and every parameter is rolled.
  - **Modules**: bodies (stone, metal, wood, ice, conveyor, goo, bouncy jelly, crumble), spike strips, swinging heads (saws, maces, axes on rods or chains; static, orbiting, or pendulum), launchers, flamethrowers, lasers (fixed or sweeping), tesla gates, crushers, springs, and fans. Whole props can also ride a rail or a loop.
  - **Launchers**: crossbow, ballista, cannon, fire totem, plasma turret, and star thrower. They fire bolts, arrows, cannonballs, fireballs, plasma, or shuriken. Aim can be fixed, sweeping, or tracking. Tracking launchers solve a ballistic arc when their ammo has gravity.
  - **Styling and names**: each prop also rolls cosmetic styling (metal type, trim, glow color). Names come from the rolled stats, so you get things like "Paranoid Arbalest", "Twin Orbit Saw", or "Hiccuping Dragon Vent Mk II".
  - **Crates**: every crate has at least one building piece and one hazard.
- **Characters** (`src/gen/character.ts`): body shape, palette, eyes (some glow in the dark), mouth, topper, pattern, a physics-driven scarf, tail, or cape, and the name are all generated. They are **cosmetic only**. Every character shares one hitbox and one physics model, so the game stays fair.

## Rendering

Canvas2D paints three world-space layers through a smoothed, zooming camera:

- **albedo**: sky, parallax skylines, terrain, props, and characters
- **emissive**: fire, lasers, crystals, sparks, and windows
- **light map**: ambient light plus about 100 dynamic point lights

A WebGL2 compositor (`src/render/post.ts`) multiplies the albedo by the light map and adds the emissive layer. It then applies two-level bloom, ACES tonemapping, a per-theme color grade, vignette, chromatic aberration (it pulses on deaths and explosions), and film grain. If WebGL2 isn't available, it falls back to plain Canvas2D blending. The HUD is drawn on its own 2D canvas.

Terrain uses a procedurally generated, tileable material texture (rock strata, bricks, riveted metal panels, crystal veins, roots, or sand). It's baked through a rounded-corner mask with an outline, depth shading, rim light, caps (grass, moss, snow, rust, or crystal), and a blurred drop shadow. Grass sways and parts around players. Gibs paint splat decals onto the terrain.

For a debug showcase, run `slagShowcase(['saw','launcher','laser','tesla'])` in the console during the pick phase. It drops those archetypes into the level.

## Architecture

See [AGENTS.md](AGENTS.md) for the full architecture, conventions, and extension points.

```
src/
  core/     rng, geometry helpers
  gen/      procedural generators (level, theme, props, characters, names)
  sim/      deterministic simulation: physics, level, prop runtime, run world, reachability
  game/     match state machine (lobby → pick → place → run → score → victory), scoring
  input/    keyboard + gamepad → per-device InputFrame
  render/   Canvas2D layers + WebGL2 post (reads sim state; owns only particles, rigs & caches)
  game-client.ts  bootGame(): fixed 60 Hz timestep loop (mounted by the Next.js route app/r/[room])
```

The sim is a pure function of `(seed, per-frame inputs)` and has no DOM access. A test plays two full headless matches and asserts they come out identical. That determinism is the foundation for online play, which can use lockstep or rollback netcode over WebRTC and only needs to send inputs.

## Roadmap ideas

- Online multiplayer (rollback netcode over WebRTC data channels)
- Audio
- More prop archetypes and modifiers (teleporters, gravity flippers, one-way platforms, magnets)
- Larger, scrolling levels and more level styles
- Placement rule that keeps at least one route solvable (`analyzeReach` already supports it)
- Bots for solo play
