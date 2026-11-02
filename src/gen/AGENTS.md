# src/gen: procedural generators

Every generator is deterministic given its seed: same seed (and theme), same output, on every machine.

- Randomness only from a seeded `Rng`; derive independent streams with `deriveSeed(seed, 'label')` so adding a roll in one place doesn't shift every other stream. No `Math.random`, wall clock, DOM, or imports from `render/`, `input/`, `audio/`, `ui/` (lint enforces this).
- Level pipeline (`level/index.ts`): pick theme → `generateTheme` look → theme sculptor (`level/sculptors/<theme>.ts`, registered in `SCULPTORS`) retried until `level/validate.ts` accepts it → set pieces. Falling back to the legacy sculptor or the flat floor counts as `fallback`, and tests assert it never happens.
- Solvability policy: the goal is reachable bare, or with at most two small bridges (`MAX_BRIDGES`, `BRIDGE_W`). Ask `src/sim/reach.ts`; never hardcode jump distances. Size jumps with `probe.ts`: `easyGap` where the ledge can be run on, `hopGap` from anything shorter.
- Mostly open: `level/routes.ts` scores how much of the fastest route has no alternative lane (`MAX_SHARED`), on the graph `reach.ts` produces. `judge` reports it, the pipeline enforces it, and `level/lanes.ts` adds a second route to a sculpt that lacks one. Give it a head start: record hard crossings with `hintGap` so lanes stay off them, set `g.carve` in solid rock, and leave air above the ground route.
- Decide "does this level get a challenge" with `rollChallenges`, which is fixed per level. A per-attempt roll is silently undone by retries, because harder shapes get rejected more.
- Set pieces (`setpieces/`): per-theme `Recipe` lists (`<theme>.ts`, in `SET_PIECE_RECIPES`) built from `builders.ts` and validated by simulation in `place.ts`. They are ordinary `PlacedProp`s with `owner = -1` and uids from `SET_PIECE_UID`, stored on `level.setPieces`, avoid protected rects, and must not cut the path.
- Looks (`theme/presets.ts`, `RECIPES`): palette, sky, skyline, terrain material, liquid, decor, grade per theme. A theme must read as itself at a glance.
- Player prop archetypes (`props.ts`): `RECIPES` + `ARCHETYPE_WEIGHTS`. Every crate has at least one building piece and one hazard.

Verify: `pnpm level <seed> --theme <t>` for the ASCII map, `pnpm level --stats 50` for fallbacks, timing and `needBridges`, and `pnpm shot levels --themes all` to look at the result.
