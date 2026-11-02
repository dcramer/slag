# Characters: animals and critters

The runners are a cast of twelve: six animals and six invented critters, most of the critters homages to famous game characters in our own designs. In the lore (DESIGN.md) they're the characters who never made the cut, from stray animals to knock-off heroes who almost got their own game. Each kind is a character design of its own, the way the barnyard party game's animals are: its own outline, one signature part, and a way of moving.

`pnpm shot cast` shoots the sheet: the 8-player lineup at play scale on farm and mine, the race start, deaths, a 3× close-up, the lobby cards, the silhouette test (`cast-silhouettes.png`) and the catalog of every kind (`--only catalog` for the last two). In the console, `slagDebug.cast` has `catalog()`, `silhouettes()` and `bench()`.

## Decisions

From the owner (logged in [DECISIONS.md](DECISIONS.md) → Characters):

1. **Animals and critters, not toys.** The foundry toys of the earlier rounds were off theme. The cast mixes animals with invented critters.
2. **Critters may parody famous characters.** A jellyfish-brained floater, a mustached plumber, a goose up to no good, a hard-hat engineer: each is our own design under a sound-alike name, recognisable at a glance as the homage, never the real character, its real name or its art. This is the one exception to "props are objects, not characters" (DESIGN.md → Parody): player characters have faces and personas; parts and machines stay faceless.
3. **Each kind is a design, not a variation.** A hand-inked outline, a signature part that breaks it, and a gait of its own. Fewer strong kinds beat many similar ones.
4. **The player's color is the loudest note**: the body for most kinds; for a kind whose palette is its identity, a big worn piece (the plumber's cap and overalls, the engineer's work shirt). It's the HUD color too.
5. **Random roll only.** New Look rolls everything, the kind included. A lobby never seats two of the same kind (`Match.looksFree`).
6. **Saved looks re-roll once** whenever the cast changes what a seed means: `LOOK_CAST` in `src/ui/profile.ts` (now 5).
7. **Clean, light, hand-drawn.** A thin pen that varies along the line, in a dark of the body's own color rather than near-black; calm color; one soft shadow shape; no glow.

## The cast

| Kind | Homage | Silhouette | Signature | Gait | Player's color |
|---|---|---|---|---|---|
| fox | — | long and low, snout well out in front | tall ears, a bushy tail carried up | trots | body |
| frog | — | crouched flat, haunches high, two eye bumps | a hind leg that folds and kicks | crouches and leaps | body |
| hedgehog | the blue speedster, a little | a ragged dome of spines, a pointed snout | the spines | scurries; curls into a spinning ball in the air | body |
| raccoon | — | squat and round-backed, short snout | masked face, round ears, a ringed tail | sneaks, hunched | body |
| penguin | — | upright egg, pale front | flippers, a little beak | waddles side to side | body |
| chicken | the barnyard game's chicken | tall and bottom-heavy on thin legs | red comb, tail feathers up | struts, head bobbing | body |
| jelly | the space bounty hunter's jellyfish parasite | a domed membrane over three nuclei | four fangs under it | floats, bobs and chomps | body |
| plumber | the mustached plumber | round and stout, a big nose out front | a cap with its bill forward, the mustache | runs jaunty, arms pumping | cap and overalls |
| robot | — | a TV-set head on a neck pinch and a barrel chest | antenna, visor slit, ear bolts | stomps, jerky, antenna wobbling | chest panel, antenna bulb |
| goose | the goose up to no good | long body, an S of a neck, tail tipped up | the neck and beak; wings flung out | waddles, neck thrust forward; honks on a cheer | body |
| engineer | the team shooter's engineer | stocky, square-chinned | a dome hard hat with a wide brim, goggles, a wrench | trudges, heavy-stepped | work shirt |
| puffball | the pink puffball | round on big feet | stubby arms, tall eyes | toddles; puffs up round in the air | body |

The silhouette test renders all twelve solid black, at rest and mid-run, at 1 px per world px and at play scale: each is nameable from its shape, and no two share one. The closest are the plumber and the engineer, both stout figures in hats; at play scale the plumber's forward bill and nose and the engineer's wide brim and wrench part them.

## What every kind keeps

- **One hitbox, one physics.** Every kind is drawn around the same 14×15 world-px body, scaled 0.84–1.3 wide and 0.7–1.06 tall, inside the range the old blobs used. Ears, hats, tails and fins are thin or behind the body. `tests/ink-character.test.ts` holds every kind inside one box around the hitbox, standing on the floor.
- **Outlines as data.** Each silhouette is authored as curves, facing right, in body units (`outline` in `src/render/cast/kinds.ts`), sampled once per kind. The seed picks the kind, the natural colors and the player's color; it doesn't shape anything.
- **The body bends.** Squash and stretch bend the outline: the top carries the lean furthest, a landing bulges the bottom. Ears, hats and antennae ride the bend; each kind's `gait` adds its own hop, rock, spin or waddle about its own pivot.
- **Faces belong to the kind** (`src/render/cast/faces.ts`): small hand-drawn eyes in a warm dark, a side eye on the birds, a visor on the robot, goggles on the engineer, a mask on the raccoon, tall eyes on the puffball, a nose and mustache on the plumber. They blink, squint on a cheer and go wide on a fall.
- **Death.** Shards of the body's and the kind's colors, and a few kinds' own bits (the robot's gears and springs, the engineer's bolts, the plumber's coins).
- **Determinism.** `generateCharacter(seed)` is a pure function of the seed, and the kind is one of its rolls.
- **Cost.** About 0.04 ms per runner on a software canvas; outlines are sampled once per kind and nothing needs baking.

## Adding a kind

Add the id to `CAST` and its natural colors to `PAINTS` (`src/gen/character.ts`), and a `KindArt` to `KINDS` (`src/render/cast/kinds.ts`): an outline inked as curves facing right, a signature part, a gait, a face, the player's color on the body or a big worn piece, and the parts it breaks into. A homage gets our own design and a sound-alike name, never the original's. Then run `pnpm shot cast` and look at `cast-silhouettes.png`: if its silhouette could be mistaken for another kind's, it isn't done. A new kind changes which kind every seed rolls, so bump `LOOK_CAST` with it.

## History

- **Phase 1** proposed three directions (creature prints on the blob, a species cast, foundry toys) with in-engine prototypes; the owner picked the toys.
- **Rounds 1–3** built and refined the foundry toys: worn player color, per-object faces, no glow, then twelve hand-designed outlines with their own gaits.
- **Round 4** replaced the toys with this cast, kept the outline, gait and silhouette-test system, and lightened the pen.

## Research behind it

- **One trait per character, judged at real scale.** Clever Endeavour added Snake to *Ultimate Chicken Horse* for "a unique silhouette" and dropped a reskin that read in-game as "a beige Snake" ([Behind the scenes: Snake](https://cleverendeavourgames.com/blog/2020/9/21/behind-the-scenes-snake)).
- **Read it small, then add pattern.** Mediatonic asks *Fall Guys* designers to zoom out and check the main elements still read ([PlayStation Blog](https://blog.playstation.com/?p=224711)).
- **Color as the player, shape as the character.** Multiplayer Kirbys are told apart by color alone ([WiKirby: Color](https://www.wikirby.com/wiki/Color)), and Yoshi is one species in many colors ([MarioWiki](https://www.mariowiki.com/Yoshi_(species))).
