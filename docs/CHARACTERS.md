# Characters: the foundry toys

Every runner is a toy out of the foundry's moulds: a painted tin wind-up or a cast-iron novelty. It fits ART.md's identity, a molten foundry that doubles as a toy box, and the joke is that every runner is a *thing*: a piggy bank racing a kettle.

`pnpm shot cast` shoots the sheet: the 8-player lineup at play scale on farm and mine, the race start, toys coming apart, a 3× close-up, the lobby cards and the catalog of every kind (`--only catalog` for the catalog alone). In the console, `slagDebug.toys.catalog()` draws the catalog and `slagDebug.toys.bench()` times one runner.

## Decisions

The owner picked direction C from the Phase 1 sheet (prints on the blob, a species cast and foundry toys), with these rules:

1. **Natural materials, worn player color.** Each toy keeps its own muted materials: tin paint, enamel, cast iron, bronze. The player's color is painted on big: a label, a jacket, a cab, a beanie, a shell, a cone and fins. It is the loudest saturated note on the toy, and it is the color the HUD, cursors, card strips and blood use (`character.body`).
2. **Random roll only.** New Look rolls everything, the kind included. There is no picker.
3. **One re-roll for everyone.** A look is a seed, and this cast made every old seed a different character. `LOOK_CAST` in `src/ui/profile.ts` drops a look saved from an older cast once and keeps the name; the next look is saved from the new cast. Bump it whenever a seed stops meaning the same character.
4. **Eight players, eight toys.** `Match.looksFree` refuses a taken kind, as it refuses a near-twin color, so a restored look that clashes falls back to a fresh roll. `rollCharacter` prefers a free kind among its rolls and gives the next free kind if none was.

## Round two: slimmer, their own faces, no glow

The owner found the first toys good but too alike and too glowy. So:

- **Proportions pulled apart.** The soldier, rocket, bell and tin can are tall and narrow; the train, duck, beetle and frog are low and long; the rest are trimmed to hug the hitbox's width instead of overfilling it.
- **A face per object.** One shared sticker of big white eyes made every toy look alike. Now: painted dots on the tin can, the top and the lantern's glass; a visor slit on the robot; a headlamp on the train; eyes stamped into the soldier's tin, with painted cheeks; a porthole on the rocket; lines cut into the bell; slits of slag on the slag blob; beady eyes on the piggy bank, chick and beetle; one eye in profile on the duck. The jack-in-the-box (a clown), the kettle (painted enamel) and the frog (eyes on its bumps) keep smaller cartoon eyes. Every face still blinks, squints on a cheer and goes wide on a fall.
- **Nothing on a runner glows.** No emissive eyes, cracks, flames or pours, and no light in the player's color round each toy. Molten things are flat hot color in a dark rim. One hard glint sits on shiny metal and enamel (robot, tin can, rocket, top, kettle, bell, train, beetle, piggy bank's glaze, lantern); matte paint, wood and slag get none.
- **The bottom three.** The crucible is gone, swapped for a lantern: an iron roof, a frame in the player's color, and a lit pane with a flame in it, in flat tones. The beetle got an iron head and feelers out front and a shell all in the player's color. The piggy bank is low and long, with a snout disc that sticks out of its front, tiny eyes and ears folded forward.

## The cast, ranked by how instantly each reads at play scale

At 1080p a runner is about 16 world px tall, about 40 screen px. The order below comes from the lineups and the catalog's play-scale strip on dark and light ground.

| # | Toy | What reads at 16 px | Player color |
|---|---|---|---|
| 1 | rocket | tall, pointed nose, fins, a porthole, a flame going up | nose cone, fins, a belly stripe |
| 2 | soldier | tall and thin under an iron shako | jacket, plume |
| 3 | top | a diamond on its point, precessing | the cone, with stripes that scroll as it spins |
| 4 | train | long and low, smokestack, headlamp, two wheels, pull string | the cab, half the engine |
| 5 | duck | long and low, a bill, two wheels, pull string | the painted lower half and a wing |
| 6 | jackbox | two-tipped jester cap, bouncing on a spring | the cap |
| 7 | bell | tall flared bell, hanging loop, swinging clapper | a sash round the waist |
| 8 | lantern | tall frame, roof and ring, a lit pane with a flame | the frame |
| 9 | robot | a box head with a visor on a box body, antenna | chest panel, antenna bulb |
| 10 | frog | flat and long, eye bumps, hops | waistcoat |
| 11 | tincan | tall narrow can, pull ring, painted face | the label, three quarters of the can |
| 12 | beetle | flat dome, iron head and feelers, six scuttling legs | the whole shell |
| 13 | chick | egg-round, beak, tail tuft, hops | both wings |
| 14 | piggybank | low and long, snout disc out front, curly tail, coin | the saddle cloth |
| 15 | kettle | dome, spout, handle, hops | an enamel band, the lid knob |
| 16 | slagblob | a dark lump with slag eyes under a beanie, a scarf | knitted beanie and long scarf |

Every kind now has an outline of its own, and eight of them in a lobby read as eight different things. The weakest are the kettle and the slag blob: at 16 px the kettle is a dome with a spout, and the slag blob reads as its beanie more than as slag, especially on dark ground. They are the next to improve.

Ideas from the brief that didn't make the roster: a pull-string car (too close to the train), a bulldog bank (the piggy bank's silhouette), a drum (the tin can's), a dancing bear (it needs its ball or hat to read as a toy), a teapot (the kettle).

## What every toy keeps

- **One hitbox, one physics.** Every kind is drawn around the same 14×15 world-px body, scaled 0.72–1.3 wide and 0.68–1.14 tall, inside the range the old blobs used. Hats, fins, spouts, keys and wheels are thin or behind the body. `tests/ink-character.test.ts` holds every kind inside one box around the hitbox, standing on the floor.
- **The key, quiet.** A small steel wind-up key turns in the back of the robot, soldier, chick, frog and beetle, faster as they run. It's never brass-bright: the player's color stays the loudest note.
- **Animation.** Squash and stretch, lean, stride, arms, the face's moods, the boil and the one hard shadow are the shared frame in `src/render/ink-character.ts`. Wind-ups waddle on the walk and run, hoppers bounce, wheels turn with the distance travelled, the top precesses, the jack-in-the-box rides its spring.
- **Death.** A toy comes apart into its own parts, a few per kind (gears, springs, its key, bolts, wheels, coins), plus tin shards in its paint and the player's color, with a clank under the death sound (`clank` in `src/audio/sfx.ts`).
- **Faces.** Each kind paints its own (`src/render/toys/faces.ts`), from the character's rolled mouth and eye size where it has a say.
- **Determinism.** `generateCharacter(seed)` is a pure function of the seed, and the kind is one of its rolls.
- **Cost.** About 0.04–0.07 ms per runner on a software canvas (the bench swings with machine load), the same as the old blobs, so nothing is baked: everything on a toy moves (squash, boil, waddle, key, wheels). `pnpm perf --only race8`, parent and branch back to back under a load average of 15–45, has never shown a difference above the noise; the last pair (round two) gave a frame p50 of 6.0 → 5.0 ms.

## Adding a toy

Add the id to `TOYS` and its muted paints to `PAINTS` (`src/gen/character.ts`), and its `ToyArt` to `TIN_TOYS` or `IRON_TOYS` (`src/render/toys/`). A kind needs its own silhouette at 16 px before anything else, the player's color on a big painted or worn part, and the parts it breaks into. Adding a kind changes which toy every seed rolls, so bump `LOOK_CAST` with it.

## Research behind it

From the Phase 1 proposal, the points that shaped the cast:

- **One trait per character, judged at real scale.** Clever Endeavour added Snake to *Ultimate Chicken Horse* for "a unique silhouette" and dropped a reskin that read in-game as "a beige Snake" ([Behind the scenes: Snake](https://cleverendeavourgames.com/blog/2020/9/21/behind-the-scenes-snake)). Every toy here was judged in the play-scale lineup, not the close-up.
- **Read it small, then add pattern.** Mediatonic asks *Fall Guys* designers to zoom out and check the main elements still read, then use color, pattern and texture to let players follow their own ([PlayStation Blog](https://blog.playstation.com/?p=224711)).
- **Color as the player, shape as the character.** Multiplayer Kirbys are told apart by color alone ([WiKirby: Color](https://www.wikirby.com/wiki/Color)), and Yoshi is one species in many colors ([MarioWiki](https://www.mariowiki.com/Yoshi_(species))). Here the kind is the shape and the painted part is the player.
- **Few parts, stretched.** The Mii editor gets its variety from adjusting a small set of parts ([Nintendo World Report](https://nintendoworldreport.com/feature/43032)); the faces still work that way.
