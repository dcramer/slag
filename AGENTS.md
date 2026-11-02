# AGENTS.md

Guidance for AI agents (and humans) working on **slag**. Read this before you change anything.

## What this is

slag is a browser-based competitive party platformer in the genre of party trap-builders. Each round:

1. **Pick**: players pick props from a crate.
2. **Place**: they place the props in the level.
3. **Run**: everyone races to the flag.

Matches have 1–8 players (`MAX_PLAYERS`). Scoring rewards levels that are hard but not impossible. If everyone finishes, nobody scores. If nobody finishes, nobody scores.

The differentiator is **procedural generation everywhere**:

- themed levels (farm, factory, castle, …) with set pieces
- props assembled from modules
- characters
- names
- visuals

The movement should feel **fast and tight**, like a precision platformer: fast run, variable jumps, wall slides and wall jumps, coyote time, and jump buffering.

Build original content. Use the genre's mechanics, but never copy another game's names, characters, art, or level designs.

## Ground rules

- **Commit to `main` and push. Always.**
  - Pull first: `git pull --rebase origin main`.
  - Make small, focused commits.
  - After every meaningful, green change, push: `git push origin main`. Don't leave work uncommitted, because the dev containers are ephemeral.
  - Never create feature branches or PRs unless the user asks. The one exception is parallel subagents in worktrees (see below).
- **Keep it green.** Run `npm run check` (typecheck + lint + tests) before every commit. Don't skip, disable, or weaken tests to get green.
- **Look at what you render.** Any visual change must be verified with `npm run shot` and inspected. Typechecking isn't enough.
- **Determinism is sacred** (see below).
- **Stay in your lane.** Each subsystem has an owner module and an extension point. Extend through the registry instead of adding `switch` statements elsewhere.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server (http://localhost:3000). `/` redirects to a new lobby `/r/<code>`. URL params are listed below. |
| `npm run check` | `tsc` + `oxlint` + `oxfmt --check` + `vitest run`. Must pass before you commit. |
| `npm run format` | `oxfmt` (format) + `oxlint --fix` (safe lint fixes). |
| `npm test` | Vitest only. Run one file with `npx vitest run tests/foo.test.ts`. |
| `npm run level -- <seed>` | ASCII dump of a generated level, plus stats: `#` solid, `=` one-way, `S`/`G` spawn/goal, `·` reachable stand cell, `P` set piece. |
| `npm run level -- --stats 200` | Generation stats across many seeds: time, styles, how often a level is solvable without props. |
| `npm run shot -- <scenario> [opts]` | Headless screenshots into `shots/` (gitignored). Boots `next dev` itself; the first page compile takes a while. |
| `npm run build` | Production bundle in `dist/`, which Vercel serves. |

Screenshot scenarios (`tools/shot.ts`):

- `race --seed S --race saw,laser,launcher --frames 200` plays a race with those prop archetypes. `--race all` uses one of everything.
- `lobby`, `pick`, `place` with `--seed S --players N`.
- `levels --count 9` or `--seeds a,b,c` renders a contact sheet of levels to `shots/levels.png`.
- `props` produces crate-card galleries.

The harness pauses the real-time loop and advances the sim with `slagDebug.step(n)`, so shots are deterministic even on slow software GL. It exits non-zero if the page logged errors.

Dev URL params (`src/debug.ts`):

- `?seed=abc`
- `?players=2` auto-joins and starts.
- `?race=saw,laser` or `?race=all` jumps straight into a race with those props.
- `?propseed=3`

In the console, `slagDebug` exposes `quickStart`, `race`, `addProps`, `loadLevel`, `pause`, `step`, and `render`.

## Architecture

```
app/             Next.js routes: / (redirect), r/[room] (game shell), codex, not-found
src/
  game-client.ts bootGame(container, room): canvases, input, menus, fixed-step loop
  core/          pure utils: rng (seeded, deterministic), geom, color
  themes.ts      ThemeId list + pickThemeId(seed)  ← theme registry root
  sim/           deterministic simulation. NO DOM, NO Math.random, NO wall clock
    constants.ts   world size, tile size, PHYS tuning, match constants
    physics.ts     player controller + collision (stepBody)
    level.ts       Level type, tile kinds (T_EMPTY/T_SOLID/T_ONEWAY), tileAt
    reach.ts       reachability analysis using the real controller (used by worldgen)
    run.ts         RunWorld: one race. Delegates all prop behavior to modules
    props/         prop data model + module plugins
      types.ts       Module union, PropDef, PlacedProp, Resolved, PropState
      registry.ts    ModuleSim contract (resolve/anchors/build/tick/onStand), Hazard/Contrib types
      transform.ts   rotation/resolve, footprint, canPlace, detonate, motion, cycles, raycasts
      modules/*.ts   one file per module type (body, spikes, swinger, launcher, flame, laser, …)
  gen/           procedural generators (deterministic given seed)
    level/         level pipeline (index.ts) + per-theme sculptors (sculptors/*.ts)
    setpieces/     per-theme set-piece placers (pre-placed level props)
    props.ts       archetype recipes → PropDefs; crate generation
    theme.ts       look generation (palette, sky, terrain material, liquid, decor, grade)
    character.ts   cosmetic characters
    names.ts       word/name generators
  game/          match state machine (lobby → pick → place → run → score → victory), scoring
  input/         keyboard + gamepad → per-device InputFrame
  render/        presentation only (reads sim state, never mutates it)
    renderer.ts    frame orchestration: layers, camera, events → fx
    post.ts        WebGL2 compositor (lighting, bloom, tonemap, grade) + Canvas2D fallback
    kit.ts         drawing helpers, materials, lights
    background.ts  sky, celestial, skylines, liquid, ambient motes
    terrain.ts     terrain texture/bake, caps, decor, grass, splats
    character.ts   character art + cosmetic verlet rig
    props/         prop art: common.ts (ModuleArt registry), modules/*.ts (one per module type), projectiles.ts
    fx.ts camera.ts hud.ts
  debug.ts       window.slagDebug + URL params
tools/           shot.ts (screenshots), level.ts (ASCII/stats)
tests/           vitest
```

### Data flow per frame

1. `game-client.ts` (`bootGame`) samples input once per fixed 60 Hz step and calls `Match.step(inputs)`.
2. During a race, `Match` calls `RunWorld.step`, which:
   - asks every prop module to `build` this frame's solids, hazards, and triggers;
   - steps the runners with `stepBody`;
   - resolves hazards, springs, and the goal;
   - runs each module's `tick` (timers, projectiles).
3. Events go into a queue that the renderer drains for effects. The sim never reads them back.
4. `Renderer.render` paints three Canvas2D layers in world space through a camera:
   - **albedo**
   - **emissive** (additive)
   - **light map** (0.5 means neutral)

   `post.ts` composites them in WebGL2. The HUD is drawn on its own canvas.

### Determinism (non-negotiable)

- All randomness in `sim/`, `gen/`, `game/`, and `themes.ts` comes from `Rng` (`src/core/rng.ts`). Derive sub-seeds with `deriveSeed(seed, 'label')`, which keeps streams independent and stable.
- The sim is a pure function of `(seed, per-frame inputs)`. Tests assert that two identical headless matches produce identical results. This is what makes future lockstep or rollback netcode possible.
- `render/` and `fx` can use `Math.random`, because it's cosmetic. They must never write to sim state.

### Extension points

- **New prop module type** (for example a rotating platform):
  1. Add the variant to the `Module` union in `sim/props/types.ts`.
  2. Implement `ModuleSim` in `sim/props/modules/<type>.ts` and export it from `modules/index.ts`.
  3. Add art in `render/props/modules/<type>.ts` and import it in its `index.ts`.
  4. Add tests.
- **New player prop archetype**: add a recipe in `gen/props.ts` (`RECIPES`, `ARCHETYPE_WEIGHTS`). Names come from rolled params.
- **New theme**: add the id to `THEME_IDS`, then entries in `SCULPTORS`, `SET_PIECES`, and the look generator. `Record<ThemeId, …>` makes the compiler list them for you.
- **Set pieces**: these are `PlacedProp`s with `owner = -1` and uids starting at `SET_PIECE_UID`, stored on `level.setPieces`. `RunWorld` simulates them like any other prop.

## Game design rules

- **The world** is `LEVEL_W × LEVEL_H` tiles = 48×27 tiles of 16 px (768×432 logical px). Tile kinds:
  - `T_SOLID`
  - `T_ONEWAY` (jump-through from below; drop through with down + jump)
  - `T_EMPTY`
- **Fairness**: characters are cosmetic only. Every player shares one hitbox and one physics model.
- **Levels**:
  - The spawn is on the left and the goal on the right.
  - Protected rects around both can't be built on or bombed.
  - The pit at the bottom kills.
- **Solvability policy**:
  - A level must be completable. Either the goal is reachable without props, or it becomes reachable after placing at most two small building props (for example a 3-wide platform) somewhere in the level.
  - Aim for roughly half of levels requiring props, as in the genre.
  - Always verify with `sim/reach.ts`, which uses the real controller. Never use hand-waved jump distances.
- **Themes**: each map has a coherent theme. The theme affects terrain shapes, palette, skyline, decor, liquid, and set pieces. A farm should read as a farm at a glance.
- **Placement rules**:
  - Most props occupy free cells.
  - **Attachments** (spikes, ice coat, slime coat, and similar surface modifiers) must sit flush against a solid face, either terrain or a placed block. The player's rotation picks which face they attach to.
  - Spikes add a hazard strip on that face. Coats change the surface: on floors, ice is slippery and slime is slow and sticky; on walls, ice means no wall slide or wall jump and slime means a sticky wall cling.
  - Placement validity lives in `sim/props/transform.ts` (`canPlace`) and must stay deterministic.
- **Scoring**: see `game/scoring.ts`.
- **Movement feel targets**:
  - fast ground speed with quick acceleration
  - variable jump height
  - coyote time and jump buffering
  - wall slide and wall jump with a kick-away
  - fast-fall on down
  - forgiving corner correction

  Tune numbers in `sim/constants.ts` (`PHYS`). Worldgen must not hardcode jump distances. It must ask `reach.ts`.

## Deployment and online play

- **Hosting is Vercel.**
  - The app is **Next.js (App Router)** so routes are server-rendered: `/` redirects to a fresh `/r/<code>`; `/r/[room]` renders the lobby shell (per-lobby metadata) and mounts the game client-side; `/codex` is the parts catalog.
  - **Game logic stays client-side.** Next pages are thin: they validate params, render a shell, and call `bootGame(container, room)` / `mountCodex()` from `src/` in a `'use client'` component. Don't import React into `src/`.
  - Server code is limited to route handlers / server components in `app/`; keep it small and free.
  - Any server-side code must be small Vercel functions in `api/`. No long-lived servers, and nothing that costs money at our scale.
- **Online play** is peer-to-peer over WebRTC with a host-authoritative star, input-only netcode (lockstep plus rollback in races), and serverless signaling. The full plan is in **docs/NETCODE.md**. Consequences for all code today:
  - Keep sim state snapshot-friendly: plain data, no closures or class instances holding hidden state, no `Map` iteration-order dependence that isn't deterministic.
  - Don't add new uses of `Math.sin`, `cos`, `atan2`, `exp`, `pow`, or `hypot` in `src/sim` or `src/gen` without a note. They will be replaced by deterministic `core/dmath.ts` versions, because those functions aren't bit-identical across browsers.
  - Inputs are the only per-frame data that crosses the network. Never let render-side state influence the sim.

## Code conventions

- TypeScript strict mode, ES modules. Runtime deps are only next/react/react-dom (for routing and the shell); the game itself uses none. Dev tooling: vitest, oxlint, oxfmt, tsx, playwright.
- oxfmt formats with 2-space indentation, single quotes, and 160-column lines (`.oxfmtrc.json`); oxlint config is `.oxlintrc.json`. Run `npm run format` before committing.
- Write doc comments on modules and exported functions that explain *why*. Keep functions small. Prefer data plus registries over sprawling `switch` statements.
- Units: world pixels and sim frames (60 per second). Tile coordinates are in `TILE` units. Angles are radians in screen space, so +y points down and +π/2 points down.
- Write tests for every generator invariant (determinism, validity), for every prop module's runtime behavior, and for physics feel regressions.

## Parallel subagents

When work is split across subagents:

- The orchestrator defines the contracts (types and registries) first and commits them to `main`.
- Each subagent works in its own git worktree or branch, owns a disjoint set of files (listed in its brief), and **commits but does not push**. The orchestrator merges into `main`, runs `npm run check`, and pushes.
- If a subagent truly needs to change a shared contract (for example `sim/props/types.ts` or `themes.ts`), keep the change additive and minimal, and call it out in its final report.
- Each subagent must finish with a green `npm run check` in its worktree and attach screenshot paths for any visual work.

## Assets

- Prefer procedural art. Third-party assets are fine only if they're CC0 or otherwise free for commercial use with no attribution traps. Record every asset in `public/ASSETS.md` with its source URL and license.
- Keep shipped assets small (downscale textures to ≤256 px tiles and compress them).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
