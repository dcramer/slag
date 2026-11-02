# AGENTS.md

**slag** is a browser party platformer: each round players **pick** a prop from a crate, **place** it in the level, then **run** to the flag (1–8 players, `MAX_PLAYERS`). Levels, props, characters, names and visuals are all procedurally generated from a seed. Movement is a tight precision platformer: walk by default, hold **run** for speed and long jumps, variable jumps, wall slide/jump, coyote time, jump buffering. Use the genre's mechanics, never another game's names, art, characters or level designs.

Game design decisions live in [docs/DESIGN.md](docs/DESIGN.md): follow it, and update it in the same commit when a decision changes. Open work, with its `wip/*` branches, is in [docs/TODO.md](docs/TODO.md); remove items when they land. UI art direction (palette, type, casing, input prompts) is in [docs/ART.md](docs/ART.md). Folders with their own rules have a nested `AGENTS.md`: `src/sim/`, `src/gen/`, `src/render/`, `app/`. Read it before editing there.

## Commands

Package manager is **pnpm** (`packageManager` in package.json). Never use npm or commit a `package-lock.json`. pnpm settings live in `pnpm-workspace.yaml`, not `package.json`. Node 24 (`.nvmrc`, `engines`).

| Command | Use |
| --- | --- |
| `pnpm install` | First thing in a fresh checkout or worktree (`node_modules` is not shared). |
| `pnpm check` | The gate: typecheck + lint + format check + all tests (~2 min). Must pass before every commit. |
| `pnpm check:fast` | Typecheck + lint + format check (~15 s). Use while iterating. |
| `pnpm vitest run tests/foo.test.ts` | One test file. Add `-t "name"` for one test. |
| `pnpm format` | `oxlint --fix` then `oxfmt`: fixes formatting and safe lint issues. |
| `pnpm build` | Production build into `.next/`, exactly what Vercel runs. |
| `pnpm shot <scenario> [opts]` | Headless screenshots into `shots/` (gitignored). See "Verify visually". |
| `pnpm level <seed> [--theme farm]` | ASCII level dump: `#` solid, `=` one-way, `S`/`G` spawn/goal, `·` reachable stand cell, `P` set piece. |
| `pnpm level --stats 50` | Per-theme stats over N seeds: ms/level, styles, `needBridges`, `fallbacks` (~2 min at 50). |
| `pnpm dev` | Dev server at http://localhost:3000; `/` is the main menu (Play opens a fresh lobby `/r/<code>`, passing `?seed`/`?theme` through). |

Lint: `oxlint` (type-aware, `.oxlintrc.json`). Errors fail CI; warnings are real findings to fix, not noise. Format: `oxfmt` (`.oxfmtrc.json`: 2 spaces, single quotes, 160 columns). Don't add `oxlint-disable` comments to get green; fix the code or change the rule in `.oxlintrc.json` with a reason.

## Definition of done

1. `pnpm check` passes, run **once before committing**. While iterating, run only the test files you touch (`pnpm vitest run tests/x.test.ts`) plus `pnpm check:fast`. Never skip, delete or weaken a test to get there.
2. `pnpm build` passes if you touched `app/`, `next.config.ts`, `package.json`, or what `app/` imports from `src/`.
3. Visual change: you took a screenshot and looked at it (see below). Typechecking says nothing about pixels.
4. Generator change: `pnpm level --stats 50` shows `fallbacks: 0` and no unexplained jump in ms/level or `needBridges`; compare against a run on the parent commit.
5. Behavior change: a test covers it (generator invariants, prop module runtime behavior, physics feel regressions). Test behavior and invariants, not every tunable or weight. Keep tests cheap, because every second is paid on every iteration by every agent; sample a few seeds rather than hundreds unless the invariant needs more.
6. In your final message, show evidence: the commands you ran with their result, and screenshot paths.

### Verify visually

`pnpm shot` builds a production server (`next build` if sources changed since `.next/BUILD_ID`, then `next start`; `SHOT_DEV=1` uses `next dev`). It pauses the real-time loop and advances the sim with `slagDebug.step(n)`, so shots are deterministic, and it exits non-zero if the page logged errors. Open the PNG it prints and inspect it.

- `race --seed S --race saw,laser,launcher --frames 200` (`--race all` = one of every archetype)
- `lobby` | `pick` | `place` with `--seed S --players N`
- `levels --count 9`, `--seeds a,b,c` or `--themes all` → contact sheet `shots/levels.png`
- `props --count 24` (crate cards), `codex` (the `/codex` page)
- Options: `--theme farm`, `--noui` (hide HUD), `--size 1280x720`, `--out shots`

Dev URL params (`src/debug.ts`, `src/game-client.ts`): `?seed=abc`, `?theme=farm`, `?players=2` (auto-join and start), `?race=saw,laser` or `?race=all`, `?propseed=3`, `?ui=0`. In the console, `slagDebug` has `quickStart`, `race`, `addProps`, `loadLevel`, `phase`, `pause`, `step`, `render`.

## Git workflow

- Main session: work on `main`. `git pull --rebase origin main`, make small focused commits, and `git push origin main` after every green change. Dev containers are ephemeral, so unpushed work is lost. No feature branches or PRs unless the user asks.
- Subagents in worktrees: run `pnpm install` first, edit only the files your brief assigns, commit to your worktree branch, and **do not push or touch `main`**; the orchestrator merges, re-runs `pnpm check`, and pushes. Never use bare `git stash` (the stash is shared across worktrees).
- If you must change a shared contract (`src/sim/props/types.ts`, `src/sim/props/registry.ts`, `src/themes.ts`, `src/sim/types.ts`), keep it additive and call it out in your report.
- Orchestrators define contracts (types, registries) and commit them to `main` before fanning out.
- Commit messages: imperative summary line saying what changed and why it matters.

## Invariants

- **Determinism.** The sim is a pure function of `(seed, per-frame inputs)`; tests run two identical headless matches and compare. In `src/sim`, `src/gen`, `src/game`, `src/themes.ts`, all randomness comes from `Rng` (`src/core/rng.ts`) with sub-streams from `deriveSeed(seed, 'label')`: no `Math.random`, no wall clock, no DOM. Lint enforces this.
- **Layering.** `sim/`, `gen/`, `game/` never import `render/`, `input/`, `audio/`, `ui/`. `render/` reads sim state and never writes it. Lint enforces the imports.
- **Client-only game.** Everything in `src/` runs in the browser; Next.js pages are thin shells (see `app/AGENTS.md`). No React or Next imports in `src/` (lint enforces).
- **Netcode-ready state** (plan: `docs/NETCODE.md`): sim state is plain, snapshot-friendly data (no closures or class instances holding hidden state, no order-dependent `Map` iteration). Inputs are the only per-frame data that crosses the network.
- **Fairness.** Characters are cosmetic. Every player shares one hitbox and one physics model.
- **Registries over switches.** Extend a subsystem through its registry, not with a new `switch` elsewhere.

## Where things live

- `src/game-client.ts`: `bootGame(container, room)`: canvases, input, menus, fixed 60 Hz loop. Each step: input → `Match.step` → `RunWorld.step` (props `build` solids/hazards → `stepBody` → hazards/springs/goal → props `tick`) → events queue → `Renderer.render`.
- `src/sim/`: deterministic simulation (physics, level, reachability, run world, prop modules). `src/gen/`: generators (levels, set pieces, props, theme looks, characters, names). `src/game/`: match state machine (lobby → pick → place → run → score → victory) and `scoring.ts`. `src/render/`: Canvas2D layers + WebGL2 post. `src/input/`: keyboard/gamepad → `InputFrame` (bindings in `bindings.ts`). `src/audio/`: procedural SFX and per-theme music. `src/ui/`: menus. `src/codex/`: the `/codex` parts catalog.
- `tools/`: `shot.ts`, `level.ts`. `tests/`: vitest, one file per subsystem.

## Extension points

- **Prop module type**: add the variant to `Module` in `src/sim/props/types.ts`; implement `ModuleSim` in `src/sim/props/modules/<type>.ts` and export it from `modules/index.ts`; add art in `src/render/props/modules/<type>.ts` and import it from that `index.ts`; add tests.
- **Player prop archetype**: a recipe in `src/gen/props.ts` (`RECIPES`, `ARCHETYPE_WEIGHTS`). Names come from rolled params.
- **Theme**: add the id to `THEME_IDS` and `THEME_LABELS` in `src/themes.ts`, then `tsc` lists every `Record<ThemeId, …>` to fill: `SCULPTORS`, `SET_PIECE_RECIPES`, the look `RECIPES` in `src/gen/theme/presets.ts`, music `STYLES`, `GROUND_TONE`. A farm must read as a farm at a glance.
- **Set pieces**: per-theme recipes in `src/gen/setpieces/<theme>.ts` (see `src/gen/AGENTS.md`).

## Game rules

- World: `LEVEL_W × LEVEL_H` = 48×27 tiles of 16 px (768×432). Tiles: `T_SOLID`, `T_ONEWAY` (jump through from below; drop with down + jump), `T_EMPTY`. Spawn left, goal right; protected rects around both can't be built on or bombed; the bottom pit kills.
- Solvability: the goal is reachable bare, or after placing at most two small building props. Aim for about half of levels needing props. Always check with `src/sim/reach.ts` (the real controller), never hand-waved jump distances.
- Placement validity lives in `canPlace` (`src/sim/props/transform.ts`). **Attachments** (spikes, ice coat, slime coat) mount flush on a solid face (terrain or placed block); the player's rotation picks the face. Spikes add a hazard strip. Coats change the surface: on floors ice is slippery and slime slow and sticky; on walls ice blocks wall slide/jump and slime makes a sticky cling.
- Scoring: `src/game/scoring.ts`. Everyone finishing or nobody finishing scores nothing.
- Units: world pixels and sim frames (60/s); tile coordinates in `TILE` units; angles in radians, screen space (+y down).

## Hosting

Vercel, Next.js App Router. Server code is limited to small, stateless route handlers and server components in `app/`; no long-lived servers, nothing that costs money at our scale. Online play will be peer-to-peer WebRTC with serverless signaling (`docs/NETCODE.md`).

## Conventions

- TypeScript strict, ES modules. Runtime deps are only `next`, `react`, `react-dom` (for the shell) and `client-only`; the game itself uses none. Don't add runtime dependencies without asking.
- Doc comments explain *why*, on modules and exported functions. Small functions; data plus registries over sprawling `switch`es.
- Assets: prefer procedural art. Third-party assets only if CC0 or free for commercial use without attribution traps; record each in `public/ASSETS.md` with source URL and license. Keep them small (≤256 px tiles, compressed).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
