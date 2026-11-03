# src/brain: bots

A brain is an input device (docs/DESIGN.md → AI players): it fills a seat and produces that seat's `InputFrame`s, and nothing else crosses into the match. Only the machine that runs a bot runs its brain; every other peer just sees its inputs, so nothing here has to be deterministic across browsers. Built-in brains still take a seed and draw from `Rng`, so a headless trial replays exactly.

- **Senses** (`view.ts`, `types.ts`): `BrainView` is versioned (`BRAIN_VIEW_VERSION`) and rounded on purpose: positions in quarter tiles, speeds as words, parts as the cells they hold (`barrierOf`), never names or sim objects. A brain reads only the view. Bump the version when its shape changes.
- **Mind** (`brains/`, listed in `BRAINS` in `registry.ts`): `think(view)` returns an `Intent` (`ready`, `pick`, `place`, `goTo`, `giveUp`, `wait`). A new brain is a `BrainDef` there.
- **Motor** (`motor.ts`): turns intents into buttons. It may read the real match, as a player's hands act on the real game, but it only presses buttons: cursors move with the arrows and click, and a race plays the controller's own recorded moves (`movesFrom` in `src/sim/reach.ts`) toward the route's distance field (`route.ts`, which reads the race the way the solvability proof does, `fieldOf`). It drops a move that meets a hazard on the parts' cycles or a shot in flight, and picks again whenever the body leaves its recording.
- **Seats** (`bots.ts`, `device.ts`): a bot is a local device of its machine (`bot1`, online `<peer>:bot1`), seated with a `join` action; `BotSeats.frames` is merged with the keyboards' before `net.tick`. Only the lobby's seated host (or an offline game) adds bots.

Nothing in `sim/`, `gen/` or `game/` may import from here (lint enforces it). Check a change with `pnpm vitest run tests/brain.test.ts`; when you change the motor or the route, run `pnpm test:stats bot-finish` and compare the finish rate with the one in that file.
