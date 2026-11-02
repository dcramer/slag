# src/sim: deterministic simulation

Everything here must be a pure function of `(seed, per-frame InputFrame)` and run headless (tests and `tools/` import it under Node).

- Randomness only from `Rng` (`../core/rng.ts`). No `Math.random`, `Date.now`, `performance`, timers, DOM, or imports from `render/`, `input/`, `audio/`, `ui/`. `.oxlintrc.json` enforces this; don't disable it.
- Transcendental math comes from `core/dmath.ts` (`dsin`, `dcos`, `datan2`, `dhypot`, `dexp`, `dlog`, `dpow`, `sq`): `Math.sin` and friends aren't bit-identical across browsers, and lint bans them here. So is `**`, because it's `Math.pow`; a test catches that one.
- State is plain snapshot-friendly data: no closures or class instances holding hidden state, no order-dependent `Map` iteration.
- Events go out through the run's event queue for render/audio; the sim never reads them back.
- Movement tuning lives in `PHYS` (`constants.ts`), including walk vs run speeds. After changing it, run `pnpm vitest run tests/physics.test.ts tests/reach.test.ts tests/controls.test.ts`. `reach.ts` uses the real controller, so level solvability moves with it.
- Prop behavior belongs to modules: `RunWorld` (`run.ts`) knows nothing about specific module types. Implement `ModuleSim` (`resolve`, `anchors`, optional `build`/`trace`/`tick`/`onStand`) in `props/modules/<type>.ts` via `defineModule`, export it from `props/modules/index.ts`, and pair it with art in `src/render/props/modules/<type>.ts`.
- Anything that travels through space (rays, columns, lanes) resolves in `trace`, after every module's `build`, through `props/rays.ts`: terrain and solids stop it, whatever order the props came in. It reports a `Beam`, and the sim and the art both read that one result. Casting from `build` misses later props' solids.
- A module that holds a runner (rope, keg) asks through `ctx.grab` in `touch` and implements `hold`; `props/attach.ts` owns the state and every way a hold ends. While held, `hold` writes the body instead of `stepBody`, and the velocity it writes is what the runner leaves with.
- Placement validity (`canPlace` in `props/transform.ts`) is deterministic and shared by the match, the renderer's placement preview and worldgen's bridge check. Attachments mount flush on a solid face.
- Shared contracts: `props/types.ts`, `props/registry.ts`, `types.ts`. Changes there are additive and must be called out in your report.
- Every module needs a runtime test in `tests/props-sim.test.ts` (or a sibling); physics feel regressions go in `tests/physics.test.ts`.
