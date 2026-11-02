# slag

A browser-based competitive party platformer. Each round, players pick a prop from a crate, place it somewhere in the level, then everyone races to the flag. Your props are meant to stop your rivals without making the level impossible for you. If everyone finishes, nobody scores. If nobody finishes, nobody scores.

The twist: **levels, props, and characters are all procedurally generated** from a seed.

## Running it

```sh
pnpm install
pnpm dev        # http://localhost:3000 → main menu; Play opens a new lobby /r/<code>  (?seed=… forces a level)
pnpm check      # typecheck + lint + behavior tests
pnpm test:stats # distribution and balance over many seeds (CI always runs these)
pnpm shot -- race --race all   # headless screenshots into shots/
pnpm level -- myseed           # ASCII level inspector
pnpm build         # production build (what Vercel runs)
```

## Controls

One keyboard player can use WASD and the arrows together. Settings → Keyboard splits the keyboard for two players and rebinds keys. Gamepads and touch work too, and the mouse drives the menu cursor.

| | Keyboard | Split: left | Split: right | Gamepad |
|---|---|---|---|---|
| move / cursor | WASD or arrows | WASD | arrows | stick / d-pad |
| jump | Space / K | Space / W | ↑ / / | A |
| run (hold) | Left Shift / J | Left Shift / F | Right Shift / ' | X / RB / RT |
| use item | E / L | G / C | ; / Right Ctrl | Y / LT |
| confirm (ready, pick, place) | Enter / Space | Space | Enter / / | A |
| rotate / self-destruct | R / Q | Q / E | . / , | B / LB |
| settings | Esc | Esc | Esc | Start |

Down + jump drops through one-way platforms. During place, right-click or the mouse wheel rotates.

## Rules

- **Pick**: claim one part from the crate. Each match draws from a short roster of parts.
- **Place**: put it anywhere free; spawn and goal are off-limits. Bombs dig out terrain and parts instead. Parts stay for the rest of the match.
- **Run**: race to the flag.
- **Score**: see `docs/DESIGN.md` → Scoring.

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

- **background**: sky, parallax skylines, and scenery
- **foreground**: terrain, props, and characters
- **emissive**: fire, lasers, crystals, sparks, and windows
- **light map**: ambient light plus about 100 dynamic point lights

A WebGL2 compositor (`src/render/post.ts`) runs them through a cel pass: flat tones, the light map cut into hard bands, ink from the foreground's silhouettes, hard offset shadows, and solid emissive shapes with a bloom halo, then a per-theme color grade and vignette. If WebGL2 isn't available, it falls back to plain Canvas2D blending. The HUD is drawn on its own 2D canvas.

Terrain uses a procedurally generated, tileable material texture (rock strata, bricks, riveted metal panels, crystal veins, roots, or sand). It's flattened to a base color and its thin dark lines, then baked through a rounded-corner mask with depth shading, rim light, and caps (grass, moss, snow, rust, or crystal). Grass sways and parts around players. Gibs paint splat decals onto the terrain.

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
  ui/       menus and the DOM screens (main menu, 404, error)
  main.ts   mountGame(): every screen, moved between by router.ts without a reload (Next in app/ is one host)
  game-client.ts  the lobby screen and the fixed 60 Hz timestep loop
```

The sim is a pure function of `(seed, per-frame inputs)` and has no DOM access. A test plays two full headless matches and asserts they come out identical. That determinism is the foundation for online play, which can use lockstep or rollback netcode over WebRTC and only needs to send inputs.

## Roadmap ideas

- Audio
- More prop archetypes and modifiers (teleporters, gravity flippers, one-way platforms, magnets)
- Larger, scrolling levels and more level styles
- Placement rule that keeps at least one route solvable (`analyzeReach` already supports it)
- Bots for solo play
