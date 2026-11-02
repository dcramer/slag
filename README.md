# slag

A browser-based competitive party platformer for 1–8 players, local or online. Each round, players pick a part from a crate, place it somewhere in the level, then everyone races to the flag. Your parts are meant to stop your rivals without making the level impossible for you. If everyone finishes, nobody scores. If nobody finishes, nobody scores.

The twist: **levels, parts, and characters are all procedurally generated** from a seed.

## Running it

```sh
pnpm install
pnpm dev                    # http://localhost:3000 → main menu; Play opens a new lobby /r/<code>  (?seed=… forces a level)
pnpm check                  # typecheck + lint + tests
pnpm test:stats             # distribution and balance over many seeds (CI always runs these)
pnpm shot race --race all   # headless screenshots into shots/
pnpm level myseed           # ASCII level inspector
pnpm build                  # production build (what Vercel runs)
```

[AGENTS.md](AGENTS.md) lists every command.

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

- **Levels** (`src/gen/level/`): each of the 10 themes has its own sculptor with several styles (a farm's orchards and fields, a mine's shafts and galleries, a space station or an asteroid field), at one of three sizes (classic 48×27, wide or tall). Every candidate is **verified with the real player controller** (`src/sim/reach.ts`): ghost players run scripted jumps from every standable cell, and a search over the landings must reach the goal. Almost no level is passable bare: each is proven solvable with one or two building parts, and that's what the crates guarantee. Set pieces, weather and a seeded look (sky, skyline, terrain material, decor, color grade) come from the seed too. `pnpm level --stats 30` reports about 30–80 ms and 1.4–3 attempts per level, depending on the theme.
- **Parts** (`src/gen/props.ts`): assembled from **modules** by archetype recipes, with every parameter rolled once per match: blocks of many materials, spikes, coats, swinging heads, launchers, flamers, lasers, tesla gates, crushers, springs, fans, bombs, portals, magnets, ropes, kegs and more, some riding a rail or a loop. Names come from the rolled stats and parody the genre's staples (`docs/PARODY.md`).
- **Characters** (`src/gen/character.ts`): body shape, palette, eyes, mouth, topper, pattern, a scarf, tail or cape, and the name are all generated. They are **cosmetic only**. Every character shares one hitbox and one physics model, so the game stays fair.

## Rendering

Canvas2D paints world-space layers through a smoothed, zooming camera: background (sky, parallax skylines, scenery), foreground (terrain, parts, characters), emissive (fire, lasers, sparks, windows) and a light map. A WebGL2 compositor (`src/render/post.ts`) runs them through a cel pass: flat tones, the light map cut into hard bands, ink along the foreground's edges, hard offset shadows and bloom, then a per-theme color grade. Without WebGL2 it falls back to plain Canvas2D blending. World art is drawn in ink (`docs/ART.md`). The HUD is its own 2D canvas.

In the browser console, `slagDebug` drives the game: `slagDebug.race(['saw', 'laser'])` drops those archetypes in and starts a race (`src/debug.ts`).

## Architecture

See [AGENTS.md](AGENTS.md) for the architecture, conventions, and extension points.

```
src/
  core/     rng, deterministic math, geometry and color helpers
  gen/      procedural generators (level, theme, set pieces, props, characters, names)
  sim/      deterministic simulation: physics, level, prop runtime, run world, reachability
  game/     match state machine (lobby → pick → place → run → score → victory), scoring
  net/      online play: WebRTC sessions, signaling client, snapshots
  input/    keyboard, gamepad and touch → per-device InputFrame
  render/   Canvas2D layers + WebGL2 post (reads sim state; owns only particles, rigs & caches)
  audio/    procedural sound effects and per-theme music
  ui/       menus and the DOM screens (main menu, 404, error)
  main.ts   mountGame(): every screen, moved between by router.ts without a reload (Next in app/ is one host)
  game-client.ts  the lobby screen and the fixed 60 Hz timestep loop
```

The sim is a pure function of `(seed, per-frame inputs)` and has no DOM access. Tests play two headless matches and assert they come out identical. Online play rests on that: peers send only inputs over WebRTC (`docs/NETCODE.md`).
