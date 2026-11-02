# Characters: the foundry toys

Every runner is a toy out of the foundry's moulds: a painted tin wind-up or a cast-iron novelty. It fits ART.md's identity, a molten foundry that doubles as a toy box, and the joke is that every runner is a *thing*: a piggy bank racing a kettle.

`pnpm shot cast` shoots the sheet: the 8-player lineup at play scale on farm and mine, the race start, toys coming apart, a 3× close-up, the lobby cards and the catalog of every kind (`--only catalog` for the catalog alone). In the console, `slagDebug.toys.catalog()` draws the catalog and `slagDebug.toys.bench()` times one runner.

## Decisions

The owner picked direction C from the Phase 1 sheet (prints on the blob, a species cast and foundry toys), with these rules:

1. **Natural materials, worn player color.** Each toy keeps its own muted materials: tin paint, enamel, cast iron, bronze. The player's color is painted on big: a label, a jacket, a cab, a beanie, a shell, a cone and fins. It is the loudest saturated note on the toy, and it is the color the HUD, cursors, card strips and blood use (`character.body`).
2. **Random roll only.** New Look rolls everything, the kind included. There is no picker.
3. **One re-roll for everyone.** A look is a seed, and this cast made every old seed a different character. `LOOK_CAST` in `src/ui/profile.ts` drops a look saved from an older cast once and keeps the name; the next look is saved from the new cast. Bump it whenever a seed stops meaning the same character.
4. **Eight players, eight toys.** `Match.looksFree` refuses a taken kind, as it refuses a near-twin color, so a restored look that clashes falls back to a fresh roll. `rollCharacter` prefers a free kind among its rolls and gives the next free kind if none was.

## Round three: twelve hand-designed toys

The owner found round two still too geometric and too alike, and pointed at the barnyard party game whose animals are each clearly their own design. Every toy was a box or blob made of primitives with features stuck on, so they rhymed. Now each kind is a design, not a variation on a template:

- **A hand-inked outline per kind.** Each silhouette is authored as curves (`outline` in `src/render/toys/kinds.ts`): bulges, pinched waists, flared feet, a lean, concave edges, and protrusions that break the outline. The seed picks the kind, the paint and the player's color; it no longer shapes anything.
- **A signature appendage and a gait of its own.** Animation and pose only, everyone's physics are the same:

| Toy | Outline | Signature | Gait |
|---|---|---|---|
| soldier | tall, chest out, coat-tails flared behind | a towering shako with a plume | marches stiff-legged, upright |
| robot | a TV-set head on a neck pinch and a barrel chest | antenna, ear bolts, visor slit | stomps, jerky, antenna wobbling |
| rocket | narrow body, ogive nose, pinched over a flared nozzle | wide swept fins, a porthole | hops on its fins, flame going up |
| top | wide shoulders, concave flanks, a point | the handle stub, scrolling stripes | spins and precesses on its point |
| train | tall cab behind, round-nosed boiler, cowcatcher | flared smokestack, headlamp, pull string | chugs: a quick double bounce on its wheels |
| duck | tail up, back dipped, neck to a round head | a long bill, a wheeled board, pull string | waddles side to side on its wheels |
| bell | round crown, concave waist, wide lip | hanging loop, swinging clapper | rocks from its crown and clangs |
| jackbox | a clown's head on a ruff | jester's cap, spring out of its box | springs: the box stays, the head bounces |
| frog | crouched flat, haunches high, two eye bumps | a hind leg that folds and kicks | crouches and leaps |
| lantern | peaked roof with curled eaves, flared base | wire handle, lit pane with a flame | swings from its handle |
| kettle | lid and knob over a low round belly | curling spout, loop handle | hops and tips forward to pour, lid rattling |
| chick | an egg leaning forward, head bump, tail tuft | beak, painted wing, legs | pecks and hops |

- **The body bends.** Squash and stretch now bend the outline instead of scaling a box: the top of the body carries the lean furthest, a landing bulges the bottom more than the top, and hats, heads and antennae ride the bend. Secondary motion is per kind: the bell's clapper swings against the rock, the kettle's lid lifts on the hop, the jester's tips droop, the robot's antenna wobbles, the smokestack jumps on each chug.
- **Twelve, not sixteen.** Cut because they couldn't be made their own design: the tin can (a box, rhyming with the lantern and the robot), the piggy bank (it read as a cat or a blob at play scale), the slag blob (a blob under a hat) and the beetle (a dome, rhyming with the frog and the duck). Eight per lobby from twelve still leaves every lobby a fresh mix.
- **The silhouette test.** `pnpm shot cast` writes `cast-silhouettes.png`: every kind solid black at rest and mid-run, at 1 px per world px and at play scale, then mid-run in color on light and dark ground. Each is nameable from its shape. The closest pair is the rocket and the bell at 1 px per world px, where both are small cones; at play scale the rocket's fins and the bell's loop and lip part them.

## The cast, ranked by how instantly each reads at play scale

1. train, 2. duck, 3. soldier, 4. jackbox, 5. kettle, 6. rocket, 7. top, 8. bell, 9. lantern, 10. robot, 11. chick, 12. frog. The frog and the chick are the softest outlines, but neither reads as anything else.

## What every toy keeps

- **One hitbox, one physics.** Every kind is drawn around the same 14×15 world-px body, scaled 0.7–1.3 wide and 0.72–1.12 tall, inside the range the old blobs used. Hats, fins, spouts, keys and wheels are thin or behind the body. `tests/ink-character.test.ts` holds every kind inside one box around the hitbox, standing on the floor.
- **The key, quiet.** A small steel wind-up key turns in the back of the robot, soldier, chick and frog, faster as they run. It's never brass-bright: the player's color stays the loudest note.
- **Animation.** Squash, stretch and bend, arms, the face's moods, the boil and the one hard shadow are the shared frame in `src/render/ink-character.ts`; each kind's `gait` adds its own hop, rock, spin or waddle about its own pivot, and wheels turn with the distance travelled.
- **Death.** A toy comes apart into its own parts, a few per kind (gears, springs, its key, bolts, wheels), plus tin shards in its paint and the player's color, with a clank under the death sound (`clank` in `src/audio/sfx.ts`).
- **Faces.** Each kind paints its own (`src/render/toys/faces.ts`), from the character's rolled mouth and eye size where it has a say.
- **Determinism.** `generateCharacter(seed)` is a pure function of the seed, and the kind is one of its rolls.
- **Cost.** About 0.04–0.07 ms per runner on a software canvas (the bench swings with machine load), the same as the old blobs, so nothing is baked: everything on a toy moves (squash, boil, waddle, key, wheels). `pnpm perf --only race8`, parent and branch back to back under a load average of 15–45, has never shown a difference above the noise; the round-three pair, run back to back under the same load, gave a frame p50 of 7.5 → 7.7 ms and render p50 7.0 → 7.1 ms. Outlines are sampled once per kind; nothing per pose needed baking.

## Adding a toy

Add the id to `TOYS` and its muted paints to `PAINTS` (`src/gen/character.ts`), and a `ToyArt` to `KINDS` (`src/render/toys/kinds.ts`): an outline inked as curves, facing right, a signature appendage, a gait, the player's color on a big painted or worn part, and the parts it breaks into. Then run `pnpm shot cast` and look at `cast-silhouettes.png`: if its silhouette could be mistaken for another kind's, it isn't done. Adding a kind changes which toy every seed rolls, so bump `LOOK_CAST` with it.

## Research behind it

From the Phase 1 proposal, the points that shaped the cast:

- **One trait per character, judged at real scale.** Clever Endeavour added Snake to *Ultimate Chicken Horse* for "a unique silhouette" and dropped a reskin that read in-game as "a beige Snake" ([Behind the scenes: Snake](https://cleverendeavourgames.com/blog/2020/9/21/behind-the-scenes-snake)). Every toy here was judged in the play-scale lineup, not the close-up.
- **Read it small, then add pattern.** Mediatonic asks *Fall Guys* designers to zoom out and check the main elements still read, then use color, pattern and texture to let players follow their own ([PlayStation Blog](https://blog.playstation.com/?p=224711)).
- **Color as the player, shape as the character.** Multiplayer Kirbys are told apart by color alone ([WiKirby: Color](https://www.wikirby.com/wiki/Color)), and Yoshi is one species in many colors ([MarioWiki](https://www.mariowiki.com/Yoshi_(species))). Here the kind is the shape and the painted part is the player.
- **Few parts, stretched.** The Mii editor gets its variety from adjusting a small set of parts ([Nintendo World Report](https://nintendoworldreport.com/feature/43032)); the faces still work that way.
