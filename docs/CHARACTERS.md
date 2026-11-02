# Characters: the foundry toys

Every runner is a toy out of the foundry's moulds: a painted tin wind-up or a cast-iron novelty. It fits ART.md's identity, a molten foundry that doubles as a toy box, and the joke is that every runner is a *thing*: a piggy bank racing a kettle.

`pnpm shot cast` shoots the sheet: the 8-player lineup at play scale on farm and mine, the race start, toys coming apart, a 3× close-up, the lobby cards and the catalog of every kind (`--only catalog` for the catalog alone). In the console, `slagDebug.toys.catalog()` draws the catalog and `slagDebug.toys.bench()` times one runner.

## Decisions

The owner picked direction C from the Phase 1 sheet (prints on the blob, a species cast and foundry toys), with these rules:

1. **Natural materials, worn player color.** Each toy keeps its own muted materials: tin paint, enamel, cast iron, bronze. The player's color is painted on big: a label, a jacket, a cab, a beanie, a shell, a cone and fins. It is the loudest saturated note on the toy, and it is the color the HUD, cursors, card strips and blood use (`character.body`).
2. **Random roll only.** New Look rolls everything, the kind included. There is no picker.
3. **One re-roll for everyone.** A look is a seed, and this cast made every old seed a different character. `LOOK_CAST` in `src/ui/profile.ts` drops a look saved from an older cast once and keeps the name; the next look is saved from the new cast. Bump it whenever a seed stops meaning the same character.
4. **Eight players, eight toys.** `Match.looksFree` refuses a taken kind, as it refuses a near-twin color, so a restored look that clashes falls back to a fresh roll. `rollCharacter` prefers a free kind among its rolls and gives the next free kind if none was.

## The cast, ranked by how instantly each reads at play scale

At 1080p a runner is about 16 world px tall, about 40 screen px. The order below comes from the lineups and the catalog's play-scale strip on dark and light ground.

| # | Toy | What reads at 16 px | Player color |
|---|---|---|---|
| 1 | rocket | pointed nose, fins, a flame going up | nose cone, fins, a belly stripe |
| 2 | soldier | tall and thin under an iron shako | jacket, plume |
| 3 | top | a diamond on its point, precessing | the cone, with stripes that scroll as it spins |
| 4 | jackbox | two-tipped jester cap, bouncing on a spring | the cap |
| 5 | train | long and low, smokestack, two wheels, pull string | the cab, half the engine |
| 6 | duck | a bill, two wheels, pull string | the painted lower half and a wing |
| 7 | bell | flared lip, hanging loop, swinging clapper | a sash round the waist |
| 8 | robot | a box head on a box body, antenna | chest panel, antenna bulb |
| 9 | frog | flat and wide, eye bumps, hops | waistcoat |
| 10 | chick | round, beak, tail tuft, hops | both wings |
| 11 | kettle | dome, spout, handle, hops | an enamel band, the lid knob |
| 12 | tincan | tall can, pull ring | the label, three quarters of the can |
| 13 | slagblob | lumpy, glowing cracks, a scarf | knitted beanie and long scarf |
| 14 | beetle | flat dome on six scuttling legs | the shell |
| 15 | crucible | tapered pot of glowing metal, long handle | a painted band on the iron |
| 16 | piggybank | round on pegs, coin in the slot, curly tail | the saddle cloth |

The bottom three still read as eight different players by color and size of shape, but not instantly as *what* they are: the beetle and the crucible are a dome and a pot, and at 16 px the piggy bank's ears and snout read closer to a cat. They are the first to improve or swap.

Ideas from the brief that didn't make the roster: a pull-string car (too close to the train), a bulldog bank (the piggy bank's silhouette), a drum (the tin can's), a dancing bear (it needs its ball or hat to read as a toy), a teapot (the kettle). The lantern is the best candidate for a 17th kind or a swap: tall frame, a ring on top, and a flame in a window, which is hot and so may glow.

## What every toy keeps

- **One hitbox, one physics.** Every kind is drawn around the same 14×15 world-px body, scaled 0.84–1.26 wide and 0.78–1.14 tall, the range the old blobs used. Hats, fins, spouts, keys and wheels are thin or behind the body. `tests/ink-character.test.ts` holds every kind inside one box around the hitbox, standing on the floor.
- **The key, quiet.** A small steel wind-up key turns in the back of the robot, soldier, chick, frog and beetle, faster as they run. It's never brass-bright: the player's color stays the loudest note.
- **Animation.** Squash and stretch, lean, stride, arms, the face's moods, the boil and the one hard shadow are the shared frame in `src/render/ink-character.ts`. Wind-ups waddle on the walk and run, hoppers bounce, wheels turn with the distance travelled, the top precesses, the jack-in-the-box rides its spring.
- **Death.** A toy comes apart into its own parts, a few per kind (gears, springs, its key, bolts, wheels, coins), plus tin shards in its paint and the player's color, with a clank under the death sound (`clank` in `src/audio/sfx.ts`).
- **Faces.** The rolled eyes and mouth from before; a kind may move them (the robot's are in its head, the train's on its front) or swap the mouth for a beak, bill or grille.
- **Determinism.** `generateCharacter(seed)` is a pure function of the seed, and the kind is one of its rolls.
- **Cost.** About 0.04–0.07 ms per runner on a software canvas (the bench swings with machine load), the same as the old blobs, so nothing is baked: everything on a toy moves (squash, boil, waddle, key, wheels). `pnpm perf --only race8` run against the parent commit back to back twice gave a frame p50 of 7.8 → 6.1 ms and 5.3 → 6.2 ms, with every section, the HUD included, moving together under a load average of 15–41: the difference is machine noise.

## Adding a toy

Add the id to `TOYS` and its muted paints to `PAINTS` (`src/gen/character.ts`), and its `ToyArt` to `TIN_TOYS` or `IRON_TOYS` (`src/render/toys/`). A kind needs its own silhouette at 16 px before anything else, the player's color on a big painted or worn part, and the parts it breaks into. Adding a kind changes which toy every seed rolls, so bump `LOOK_CAST` with it.

## Research behind it

From the Phase 1 proposal, the points that shaped the cast:

- **One trait per character, judged at real scale.** Clever Endeavour added Snake to *Ultimate Chicken Horse* for "a unique silhouette" and dropped a reskin that read in-game as "a beige Snake" ([Behind the scenes: Snake](https://cleverendeavourgames.com/blog/2020/9/21/behind-the-scenes-snake)). Every toy here was judged in the play-scale lineup, not the close-up.
- **Read it small, then add pattern.** Mediatonic asks *Fall Guys* designers to zoom out and check the main elements still read, then use color, pattern and texture to let players follow their own ([PlayStation Blog](https://blog.playstation.com/?p=224711)).
- **Color as the player, shape as the character.** Multiplayer Kirbys are told apart by color alone ([WiKirby: Color](https://www.wikirby.com/wiki/Color)), and Yoshi is one species in many colors ([MarioWiki](https://www.mariowiki.com/Yoshi_(species))). Here the kind is the shape and the painted part is the player.
- **Few parts, stretched.** The Mii editor gets its variety from adjusting a small set of parts ([Nintendo World Report](https://nintendoworldreport.com/feature/43032)); the faces still work that way.
