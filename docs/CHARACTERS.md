# Characters

The runners are a cast of forty-two homages to famous game characters, in our own designs. In the lore (DESIGN.md) they're the knock-off heroes who almost got their own game. Each kind is a character design of its own, the way the barnyard party game's animals are: its own outline, its signature props, and a way of moving.

`pnpm shot cast` shoots the sheet: the 8-player lineup at play scale on farm and mine, the race start, deaths, a 3× close-up, the lobby cards, the "is it the homage?" sheet (`cast-recognise.png`: each kind close up beside "This is ___"), the silhouette test (`cast-silhouettes.png`) and the catalog of every kind (`--only catalog` for the last three). Every sheet waits for the rendered kinds' frames (`slagDebug.sprites.ready()`), so it shows what ships. In the console, `slagDebug.cast` has `catalog()`, `silhouettes()`, `recognise()` and `bench()`.

## Decisions

From the owner (logged in [DECISIONS.md](DECISIONS.md) → Characters):

1. **Every character is a homage**, because the lore makes the runners the knock-off heroes who almost got their own game.
2. **Recognisability comes first.** A stranger should name each homage at a glance. For each one we list the three or four traits people actually know it by and make every one of them unmistakable at play scale.
3. **Homages, never copies.** Each is our own design, read from its silhouette and one or two signature props, never the original's exact design or its real name, nor a respelling of it (one letter off, or the same sound): the name is a looser sound-alike, ideally with the kind's own joke in it (Kilowatchu, Clara Loft). Sound-alike names are data (`KIND_NAMES` in `src/gen/character.ts`) and appear nowhere else. Player characters may have faces and personas; parts and machines stay faceless (DESIGN.md → Parody).
4. **A neutral palette, and the colour is the player's.** Each kind's own colours are neutrals: skin, eyes, hair, metal, wood, bone, cloth greys and the ink. Nearly every coloured part takes the player's colour: the costume in it, every other coloured part in a lighter or darker tone of it (the plumber's cap and overalls, the engineer's hat and shirt). The shape carries the read, not the original's hues. It's that player's HUD color, and with eight different kinds per lobby, eight players stay told apart.
5. **Random roll only.** New Look rolls everything, the kind included. A lobby never seats two of the same kind (`Match.looksFree`).
6. **Saved looks re-roll once** whenever the cast changes what a seed means: bump `LOOK_CAST` in `src/ui/profile.ts`.
7. **Clean, light, hand-drawn.** A thin pen that varies along the line, in a dark of the body's own color; two or three flat tones per surface; one soft, hard-edged shadow shape; calm color; no glow.
8. **The greatest characters to parody**, each with a clear twist of its own, because the first homages looked too much like the originals.
9. **Designed at game size, and worn.** A kind is designed to read as a 24 px sprite: one silhouette idea, about three big shapes, four flat colours plus ink, one signature prop, the eyes. Every kind is a little disheveled, because of the lore, and the grunge is worn shape, never grime: a bent and taped ear, a dented head, a sagging, lopsided body, a bent prop, one foot bigger than the other. Colours stay clean and bright, and the line stays the cast's pen. A rough line and colour grime were tested on the zapmouse and lost: the line vanishes at play scale, and dull colour sinks into the darker themes (`shots/styletest/`).

## The bar

What polished small-character games do, and what we hold the cast to:

- **Silhouette first, judged at real size.** Clever Endeavour judges *Ultimate Chicken Horse* art in the game at actual scale, added Snake for "a unique silhouette", and dropped a reskin that read in-game as "a beige Snake" ([Behind the scenes: Snake](https://cleverendeavourgames.com/blog/2020/9/21/behind-the-scenes-snake)). Mediatonic tells *Fall Guys* designers to zoom out and check the main elements still read ([PlayStation Blog](https://blog.playstation.com/?p=224711)).
- **Few colors, chosen hard.** Yacht Club holds *Shovel Knight* characters to about five colors each, inside an NES-like palette, and iterated the Hengineer's silhouette and attitude until both were solid ([Kotaku](https://kotaku.com/how-a-shovel-knight-npc-gets-made-1842271950); [Shovel Knight: Official Design Works](https://shovelknight.fandom.com/wiki/Shovel_Knight:_Official_Design_Works)). A grayscale check of contrast is a standard test ([80.lv](https://80.lv/articles/celeste-fan-art-highlighting-character-with-texturing-pose)).
- **One trait carries identity; color tells players apart.** Multiplayer Kirbys differ by color alone ([WiKirby: Color](https://www.wikirby.com/wiki/Color)); a fighter's icon is its silhouette plus one prop.
- **Readability and juice in motion.** *Celeste*'s tiny protagonist reads through pose and a strong line of action more than through detail ([review notes](https://www.sonicstadium.org/blogs/entry/384-spoilers-brief-thoughts-on-celeste/)).

So each kind has: a clear head-to-body ratio, a readable expression, a line of action in its run and jump poses, secondary motion on its garments, ears and tails, brows that react, and more detail at card and menu scale (a third, lit tone) than at play scale.

## The cast

Each kind's entry is its own file in [characters/](characters/): what a stranger should say, the silhouette, traits, palette, gait, the nod, our twist, swaps, the variety layers, how it was drawn with every blind read in the readers' own words (its Rig line), and the concept prompt.

| Kind | Homage (what a stranger should say) | Signature traits | Player's color |
|---|---|---|---|
| [plumber](characters/plumber.md) | the mustached plumber | a cap with its bill out front and a round badge (our own mark, a little wrench, never the letter), big round nose, thick mustache, bib overalls over the shirt with two buttons, gauntlets, boots; big head, stout | costume: cap and shirt; overalls and plunger cup a dark of it |
| [hedgehog](characters/hedgehog.md) | the blue speedster | spikes swept straight back, joined eyes with green irises, peach muzzle and belly, a one-sided grin, big sneakers with a pale strap; runs leaning hard, spins in the air | costume: the quills; sneakers and neckerchief darks of it |
| [elf](characters/elf.md) | the green-tunic elf hero | long cap flopping back, pointed ear, blond fringe, flared tunic with a belt, a shield and a sword hilt on the back | costume: cap and tunic; the darned toe a light of it |
| [hunter](characters/hunter.md) | the armored bounty hunter | tall and long-legged, huge round shoulder pads wider than anything else, a helmet with a wide visor band, the forearm a cannon held straight out from the shoulder; tucks into a ball | costume: the suit, the buoys a dark of it, the cannon a light |
| [zapmouse](characters/zapmouse.md) | the yellow electric mouse | yellow, long ears with black tips, red cheeks, a lightning-bolt tail | costume: the fur; the cheeks keep their red (a face mark), the tin tail and the cord are neutral |
| [impostor](characters/impostor.md) | the impostor crewmate | a bean on stubby legs, a wide pale visor standing proud, a backpack | costume: the bean, and the pack a dark of it |
| [puffball](characters/puffball.md) | the pink puffball | a ball on big feet, stubby arms, tall eyes with a shine, blush; puffs up in the air | costume: the ball, and the feet a dark of it |
| [jelly](characters/jelly.md) | the jellyfish parasite | a dome, three nuclei inside, four fangs under it (two big ones a pincer), a hovering bob | costume: the dome, the nuclei and rim in tones of it |
| [goose](characters/goose.md) | the goose up to no good | white, a tan beak and feet, an S of a neck; on the run the honk pose, neck flat out and wings up | costume: the vest; the beak and feet a neutral tan |
| [engineer](characters/engineer.md) | the team shooter's engineer | tall and square with a small head; a hard rectangular toolbox in one hand and a huge wrench held low in the other, a dome hard hat with a rim all round and goggles on it, a square jaw, a work shirt, khaki trousers, leather gloves | costume: the shirt, the hat and toolbox in tones of it |
| [chomper](characters/chomper.md) | the round dot-eater | a circle with a wedge mouth that chomps, one small eye, a scalloped bite out of its back, a linen napkin tucked into its lower lip | costume: the whole ball |
| [miner](characters/miner.md) | the voxel miner | a cube head as wide as the body, square stiff limbs, a taped toy pickaxe; carved from wood | costume: the shirt, the trousers a dark of it |
| [ape](characters/ape.md) | the necktie ape | hunched, long arms, a necktie | costume: the fur, the tie a shade of it |
| [merc](characters/merc.md) | the spiky-haired mercenary | a crown of big blond spikes singed at the tips, a giant serrated bread knife always in hand, a hubcap on one shoulder | costume: the top, the trousers a dark of it |
| [king](characters/king.md) | the spiked turtle king | side on, a smooth shell dome on his back with its cream rim and three big spikes along its top, a big horned head out front with an open crocodile jaw, a swept-back mane, a paper crown, a heavy low stance | costume: the skin; the shell and mane darks of it, the crown a light |
| [dino](characters/dino.md) | the green saddled dino | a huge round snout out front, eyes on top of the head, white belly and cheeks, a torn black bicycle seat strapped low on its back, a long tail straight out behind, wellies, a carrier bag with its own spotted egg | costume: the skin (the head spikes a light of it, the wellies a dark) |
| [robot](characters/robot.md) | the blue robot boy | a big round helmet with a ridge down it and an ear disc standing proud, the pale face in a grey rim in its opening, a small light suit in a wide stance on huge flared boots, the forearm a thick taped tin can held out level; small | costume: helmet, mitten and near boot; the suit and ridge a light tone, the far boot a shade off, the can and ear disc darks |
| [sneak](characters/sneak.md) | the sneaking soldier | side on, a square cardboard box on two crouched legs, his eyes in a slot, a striped bandana's two tails out of a hand-hole behind | costume: the box (its back end, tape, arrow and bandana tones of it) |
| [cuptoon](characters/cuptoon.md) | the cup-headed toon | a white enamel mug for a head, its handle out the back and a straw bent over out of the tea, black rubber-hose limbs, white gloves, high-waisted shorts, big round shoes | costume: the shorts |
| [horse](characters/horse.md) | the barnyard party game's horse | on all four legs, side on: a long neck with the mane standing up along it as a crest, a long blunt head with a pale nose and buck teeth, a long straight tail hanging to the heels, flat hooves; a scarf and a zip (a costume) | costume: the coat, the far legs and the scarf darks of it |
| [rapper](characters/rapper.md) | the rapping paper puppy | side on, a big dog's head on a skinny card cut-out with its brown edge showing: a tall thumb of a knit beanie standing straight up, a long snout jutting far forward with a big round nose on its tip and the jaw dropped open rapping, a short floppy ear hanging down behind, a tee and shorts, big trainers, a cordless mic held out in front | costume: the beanie and tee, the shorts a dark of it |
| [limbless](characters/limbless.md) | the limbless hero | no arms or legs: white gloves and big shoes floating clear of a small round body with background all round each, a huge nose, a spiky hair tuft standing up, a neckerchief | costume: the top, the shoes a light tone of it |
| [worm](characters/worm.md) | the worm in the super suit | side on, a super suit with big round shoulder pads, a broad chest, a narrow belted waist, slim legs and big boots; a thin pink worm neck out of the collar arcing forward to a head wider than it, huge bulging eyes standing up and a wide grin; a small hair dryer held out at arm's length like a raygun | costume: the suit, the gloves, boots and belt a dark of it |
| [dragon](characters/dragon.md) | the little purple dragon | small and low on four stubby legs, side on: a big round head with two long horns swept straight back, stubby umbrella-cloth wings on bent spokes, a pale belly, a ridge of small spines, a tail ending in a taped arrowhead with a firefly jar hanging from it | costume: the scales; the wing cloth a light of it, the far legs a dark |
| [hopper](characters/hopper.md) | the snouted cube hopper | a round ball with no arms on two short legs in worn trainers, two big eyes standing up out of its crown, a long tube snout sticking straight out front and flared at its open end, a party blower; hops both feet together | costume: the ball and legs; the snout and the blower's streamer lights of it |
| [warrior](characters/warrior.md) | the round Slavic warrior | a huge round belly on short legs, a big round bald head, side on: a small iron pot of a helmet with a tall spike on top, narrower than the head, a big round nose and a bushy moustache sticking out, a short belted tunic, thick bare arms, a broad sword held out level in front | costume: the tunic |
| [slayer](characters/slayer.md) | the white-haired monster slayer | heavy-set and crouched low in a wide fencing guard, a long sword held level out ahead in both hands, two blades crossed on his back (one an umbrella), a short tight jacket and tall boots, white hair tied back, a bottle-cap wolf medallion, yellow cat's eyes, a scar | costume: the jacket; the trousers a dark of it |
| [raider](characters/raider.md) | the braided tomb raider | a long single braid swinging behind her head, a tank top and shorts, twin pistols in thigh holsters, a small backpack, boots | costume: the tank top |
| [fighter](characters/fighter.md) | the bun-haired street fighter | always in a deep, wide fighting stance or a kick, a high-collared qipao with huge puffed shoulders and a skirt flaring over thick strong thighs, two round hair buns up and out on the top corners of a small head, spiked bracelets | costume: the qipao |
| [stinger](characters/stinger.md) | the horned bug with the needle | a small bug with a white mask face and two long crescent horns hooking back, a red dishcloth cloak hanging from the shoulders in a short bell, thin dark legs under it, a thick knitting needle held level with yarn off its knob | costume: the cloak; the stripes a light of it |
| [mage](characters/mage.md) | the black mage with the glowing eyes | a huge straw hat with a brim wider than his shoulders and a bent point, no face under it but two glowing eyes in the dark, a long robe with flared cuffs, a broom-handle staff with a bulb | costume: the robe; the belt and face a neutral dark |
| [creeper](characters/creeper.md) | the green block creeper | a tall block body with a square head the same width, four stubby block legs, no arms, a frowning face of square holes cut through him, a birthday candle burnt to a stub for a fuse | costume: the body; its painted squares a light and a dark of it |
| [tophat](characters/tophat.md) | the little girl in the tall top hat | a tin-can top hat as tall as the rest of her, a short cape with a high collar, a ponytail out the back, a huge cocktail umbrella | costume: the hat and cape; the hair tie and the lining a light of it |
| [pyramid](characters/pyramid.md) | the triangle-helmeted executioner | one tall upright rusty pyramid for a head, sitting straight on his square shoulders and narrower than them, no face, a butcher's apron with a pig on it, thick bare arms, a long cheese slicer dragged steeply behind | costume: the apron, the pig a light of it |
| [invader](characters/invader.md) | the pixel crab from space | wider than tall and cut from square pixels, two antennae, side claws raised, stubby legs that shuffle in and out, two square eye holes | costume: the whole crab; the tape a neutral |
| [vampire](characters/vampire.md) | the giant vampire lady in the big hat | the tallest and slimmest of the cast, a wide flat-crowned sun hat drooping at the back over a small head, a long gown to the floor hiding her feet, one hand raised clear of her with long false nails, pearls | costume: the gown; the hat a dark neutral |
| [assistant](characters/assistant.md) | the town assistant dog with the bell in her hair | a small dog upright with a big round head, floppy ears hanging down, a short bushy top-knot pinched by a cat's collar with a big jingle bell on it, a vest over a white shirt, a short flared skirt, a cracked clipboard held out in front | costume: the fur; the vest a dark of it, the ears' tips a light |
| [sim](characters/sim.md) | the lady with the green diamond over her head | a little woman with a round black bob in a bell of a dress, a green double-pointed diamond floating clear above her head | costume: the dress; the diamond keeps its green |
| [succubus](characters/succubus.md) | the succubus with bat wings on her head | slim and long-legged, bat wings spread up and out from her head, a bigger pair at her back, big long hair, a strapless bodysuit, thigh-high boots | costume: the bodysuit; the wings a dark of it |
| [archer](characters/archer.md) | the red-braided girl with the bow who hunts robot beasts | side on in a hunter's crouch, a bow drawn and held out level ahead, thick braids bushing out behind, a quiver, a fur shoulder wrap | costume: the leathers; the fur a light of it |
| [slime](characters/slime.md) | the blue teardrop slime with the grin | a limbless teardrop of goo with a curled tip, two big eyes and a huge grin | costume: the goo; the shine a light of it |
| [bear](characters/bear.md) | the animatronic bear in the little top hat | a stocky bear with round ears, a tiny top hat between them, a bow tie, a mic held up, stiff jointed limbs | costume: the fur suit; the belly and muzzle a light of it |

**Reserves**, if a kind won't read: the spinning bandicoot (its tuft and grin rhyme with the speedster), the shovel-wielding knight, the red-haired mountain climber, the falling-block party bean (rhymes with the crewmate). The space marine in green armour reads as a generic soldier at 20 px; the plumber's tall brother, the ape's red-capped nephew and the king's turtle foot soldiers rhyme with kinds already in.

## Roster

Every entry feeds the art pipeline (Rendered kinds below) and is written as prompt material, so it describes traits only and never names a real character. **The nod is the silhouette; the rest is ours.** A concept that looks like the original redrawn is rejected, however good it looks.

### Rules for every kind

- **Size.** About 16 world px tall at play scale, inside the shared 14×15 body envelope. One hitbox for everyone. Big props stay thin or behind the body.
- **Style.** Decisions 7, with few shapes and no gradients.
- **Facing.** Drawn facing right, standing on the floor.
- **Player's color.** Decisions 4. The region a stranger would name the character's colour by wears the player's colour (`slot: 'player'` in its entry, `tools/art3d/flat/kinds.ts`); every other coloured part is a tone of it (`on` that role, `tone` lighter or darker), far enough apart that the parts stay separate shapes; the rest is neutral (skin, eyes, hair, metal, wood, bone, cloth greys, ink). No ring. Nothing that a stranger reads as skin, eyes or a face takes it. This holds even where a colour is the original's identity (the dot-eater's ball, the plumber's blue overalls): the shape carries the read.
- **Faces.** Expressive eyes with highlights, and brows that react to running, jumping, falling and cheering. The face is the kind's, never rolled: eye count, style, iris, place and mouth are part of its design (`paintFace` in `KINDS`, `face` in a rendered kind's entry), so every character of a kind has the same face and only its expression changes. A rendered kind's eyes are found in every pose (`tools/art3d/README.md` → Face, variety, frames).
- **The nod and the twist.** The nod is the three or four traits a stranger names it by, and each entry says why each one is needed. The twist is ours: a foundry, scrapyard or knock-off flavour, a changed signature prop, and one joke. A twist never moves or hides a trait the nod needs.
- **Swaps.** Small accessories inside the outline, rolled per look from `vary`: they never change the silhouette. A rendered kind draws one, a strip on the crown or the cheek (`accessories` in its entry).
- **Disheveled.** Two or three worn tells per kind, each a change to the outline or a big flat shape that reads at play scale (Decisions 9). They are the design, not a roll: every look of a kind is battered the same way.
- **Variety.** Every look of a kind is the same character by the same hand, so variety is curated, never rolled freely: the face, the proportions and the silhouette are fixed per kind. Besides the costume colour and the swaps, each kind designs three layers, each picked from the look seed (`VARIETY` in `src/render/cast/sprites/play.ts`) and render only:
  - **Palette alts:** 2–3 designed colourways for one neutral region, in neutrals (a steel, a bone, a worn leather; the hair's shade), never the costume, its tones, skin, eyes or face. Parts that belong together (a shoe and its sole) change together.
  - **Idles and cheers:** two of each, the second keyed from the pose sheet or cut from another clip, plus a gait range: how much extra bounce on each step and how far forward it leans, small enough to stay in the shared box.
  - **Wear:** clean, scuffed and scorched. A few small marks on the body, the limbs or the shoes in a tone of the surface they sit on (a faded patch, a scuff, a soot streak), never on the face, and too few to read as noise at play scale.

  Done when the variety sheet (`pnpm shot variety --kinds K`) shows twelve looks that all read as the same character, and the play-scale row reads as clean as one look does.
- **No letters or logos** on anything, at any scale: a badge carries a small mark of ours.

**The concept prompt.** Every entry ends with a prompt of traits only. Append the house style to each one:

> Clean hand-inked 2D game character, full body, facing right, standing on the ground. Flat colour in two or three tones per surface, a thin tapered outline in a dark of each part's own colour, one hard-edged shadow shape, calm colour, no gradients, no glow, no text or logos, plain white background. Proportions pushed so it reads at 20 pixels tall.

### Production order

The strongest reads first. **Keyed** marks the non-humanoids, the riskiest to draw.

| # | Kind | Name | Rig | Status or risk |
|---|---|---|---|---|
| 1 | plumber | Plumbo | humanoid | drawn flat |
| 2 | hedgehog | Zoomic | humanoid, spin keyed | drawn flat |
| 3 | chomper | Snack-Man | generated, no limbs | drawn flat |
| 4 | zapmouse | Kilowatchu | **keyed**, quadruped | drawn flat |
| 5 | elf | Sir Clinkalot | humanoid | drawn flat |
| 6 | puffball | Squirby | **keyed**, ball and feet | drawn flat |
| 7 | miner | Treeve | humanoid, stiff | drawn flat |
| 8 | impostor | Sussy | **keyed**, legs only | drawn flat |
| 9 | ape | Clonkey Kang | humanoid, gallop keyed | drawn flat |
| 10 | merc | Crumbcloud | humanoid + blade prop | drawn flat |
| 11 | king | Grouser | humanoid + shell prop | drawn flat |
| 12 | dino | Noshasaurus | humanoid + tail | drawn flat |
| 13 | robot | Meh Man | humanoid + can prop | drawn flat |
| 14 | sneak | Soggy Snake | humanoid + box prop, keyed | drawn flat |
| 15 | cuptoon | Mughead | humanoid, rubber hose keyed | drawn flat |
| 16 | hunter | Samosa | humanoid, ball tuck keyed | drawn flat |
| 17 | engineer | Wrenchie | humanoid | drawn flat |
| 18 | goose | Honkers | **keyed**, bird | drawn flat |
| 19 | horse | Hoarse | **keyed**, quadruped | drawn flat |
| 20 | jelly | Wobbletroid | **keyed**, no limbs | drawn flat |
| 21 | rapper | Paperappa | humanoid, flat card | drawn flat |
| 22 | limbless | Raymond | **keyed**, floating hands and feet | drawn flat |
| 23 | worm | Mudworm Slim | humanoid + head stalk | drawn flat |
| 24 | dragon | Spyrella | **keyed**, quadruped | drawn flat |
| 25 | hopper | Tootbert | **keyed**, legs only | drawn flat |
| 26 | warrior | Potkosz | humanoid, round | drawn flat side on (round 5, the sword out level); the blind read fails: "a stout knight in a pointed helmet", no name and no pairs; accepted as a colour read (2026-11-06) |
| 27 | slayer | Gerry Drizzle | humanoid | drawn flat, redrawn a third time crouched side on with the sword level out ahead; the blind read not passed (unpaired, read as a ninja: the hilts above his shoulders read as horns or a headband's tails; with nothing on his back, in design reads, a ninja paired with the fighter, or holding a trophy an axe or a torch); accepted as a colour read (2026-11-06) |
| 28 | raider | Clara Loft | humanoid | drawn flat; named by both blind readers at medium, one still pairing her with the puppy (long hair behind a slim figure) |
| 29 | fighter | Bun-Li | humanoid | drawn flat, redrawn in a deep wide stance with a small head; the blind read passes (both readers named her at medium, unpaired, once the buns stood up and out with her crown round between them: snug on its corners, head and buns were a headband, and readers saw the other fighter) |
| 30 | stinger | Hornknit | humanoid, cloaked | drawn flat; the blind read passes (straight horns read as rabbit ears until they curved into crescents) |
| 31 | mage | Dimmy | humanoid, robed | drawn flat; the blind read passes (both readers named him at medium, unpaired) |
| 32 | creeper | Creepbox | **keyed**, four legs, no arms | drawn flat; the blind read passes (named at medium by both once the face was cut through him and the candle burnt to a stub) |
| 33 | tophat | Can Kid | humanoid, small | drawn flat; the blind read passes (the hat, a clean tin cylinder on a wide brim, with the umbrella held out low, clear of it) |
| 34 | pyramid | Pyramid Fred | humanoid, big + blade | drawn flat, no face; the blind read passes (both readers named him at medium once the wedge, a brim over his shoulders and the mage's hat, became an upright pyramid on them, the slicer long and steep behind him) |
| 35 | invader | Space Evader | **keyed**, legs only, pixel edge | drawn flat, front on, the eye holes cut through; the blind read passes (both readers named it at high, unpaired) |
| 36 | vampire | Lady Dimistretch | humanoid, tall, gowned | drawn flat; the blind read passes (named at medium by both on the first sheet: the height under the wide flat hat, the gown to the floor) |
| 37 | assistant | Jinglebelle | humanoid, small, dog | drawn flat; the blind read not passed (unpaired as "Pikmin" while the tuft stood on a stalk, then a nameless small figure with a tuft or hat; a side-on redraw with a snout, round 3, read the same and worse in colour, not shipped): in black her head is a hat; accepted as a colour read (2026-11-06) |
| 38 | sim | Bella Gauche | humanoid + floating diamond | drawn flat; the blind read passes (both readers named her at high once the diamond's points survived the tracer: rounded, it was a Pikmin's leaf) |
| 39 | succubus | Moribund | humanoid, winged head | medium: the head wings, only standing clear of the hair; the stinger's horns and the vampire to watch |
| 40 | archer | Aloof | humanoid, side on | medium: the bow drawn ahead; the raider and the elf to watch |
| 41 | slime | Slimple | **keyed**, limbless | drawn flat; the blind read passes (both readers named it at medium-high or better, unpaired: the onion with its tip a point, kept by `smooth: 0`; a big hooked tip read as a witch's hat) |
| 42 | bear | Creaky Buzzbear | humanoid, stocky | medium: the tiny hat between round ears; the top-hat girl and the ape to watch |

**What to check.** No two kinds may rhyme. Watch these pairs:

- **The puffball and the dot-eater:** feet, arms and a mouth against a wedge and no limbs.
- **The goose and the horse:** two farmyard homages, but a bird with an S-neck against four legs and a long muzzle.
- **The hunter and the robot boy:** both carry an arm cannon. The hunter is the tallest kind, long-legged, the cannon straight out from the shoulder; the robot boy is small with a round helmet and ear discs, the can at arm's length. Two blind reads took the old, stocky hunter for the robot boy.
- **The speedster and the robot boy:** the two blue originals. Quills swept back against a round helmet.
- **The miner and the sneaking soldier:** both boxy. A cube head on a body with arms against one box on two legs.
- **The ape and the turtle king:** the two brutes. Hunched and long-armed against upright, side on under a smooth shell dome with three big spikes, horned, the jaw open.
- **The mercenary and the plumber:** both carry a huge prop. The plunger is strapped to the plumber's back; the blade is always in the mercenary's hand, trailing low or leaning on the floor.
- **The mercenary and the elf:** both carry a blade, but a poker on the elf's back against a blade bigger than the mercenary.
- **The crewmate and the sneaking soldier:** both a body on two stubby legs. A rounded bean with a visor against a square box with an eye slot.

Every kind must also pass the silhouette sheet, the blind read and the "is it the homage?" sheet before it ships.

## Rendered kinds

How a kind's entry becomes a kind the game draws from art. The entry is the one source for the design; this is the pipeline. A kind with rendered frames is always drawn from them; a kind without keeps its hand-drawn body until it is produced. Production steps and the done list: [tools/art3d](../tools/art3d/README.md) and its [checklist](../tools/art3d/CHECKLIST.md). Every rendered kind is drawn flat; the retired 3D route read rough and blobby at play size ([tools/art3d/3D.md](../tools/art3d/3D.md)).

- **Drawn, at game size.** One design made to read as a 24 px sprite (Decision 9), worn in an edit, then drawn in a dozen poses by the image model with the design as its reference: it copies a reference closely, which holds the character from pose to pose. Where the image model draws the original whatever the brief says (the hedgehog), the kind's approved concept is the reference instead.
- **Flat, in the drawing's own shapes.** Each drawing is traced at one body size into its own flat colours, every shade folded in, under a light pen with no ink mass or shade sliver (`flat`), plus its long interior lines (`lines`: an arm over the body, the gap between the legs). A shade that carries a shape is a dark of the costume (the plumber's cap shadow and plunger cup).
- **The cast's face** takes over from the drawing's eyes and mouth, specks at play size: eyes found per pose (a pair, or one and the far one set from it), brows set into the run, wide on a fall, squinting on a cheer, crossed out on a death. The mug is the bar (owner, 2026-11-04): its kit eye is the original's own, one bold two-tone shape big enough to survive play scale, so the drawing, the homage and the acting agree. So each kind wears its homage's eye from the kit's registry (`EYES` in `src/render/cast/sprites/face.ts`), sized to its drawing:
  - `tall`: a black oval twice as tall as wide with one big glint, no white (the mug, the puffball). `dot`: a small black eye with a glint (the electric mouse, the dot-eater, the goose, the engineer's under his goggles). `hole`: a mask's eye hole, a big black oval with a small glint and no blush (the horned bug; the `tall` eye's blush read as cheeks painted on her mask). `glow`: a round all yellow glow with a paler core and no white or pupil, in a dark face, its shut eyes and arcs glowing too, since ink is lost there (the black mage).
  - `round`: a white and one big pupil (the hopper, the limbless hero, the robot boy, the speedster, the sneak in his slot). `pill`: a tall white with a tall pupil (the plumber, the dino, whose two touch).
  - `profile`: a side-on head's one eye, the pupil pressed to its front rim (the horse, the dragon). `scowl`: an almond under a hard lid slanting down to the front, round a slit (the turtle king).
  - `heavy`: a round white half under a flat lid (the ape, the mercenary's brood, the puppy's eyes under the beanie). `anime`: a big iris under a thick lash (the elf). `square`: a white block and an iris block (the miner). `cutout`: the figure's own hole, the level showing through, which the kit only shuts and acts round (the box creeper, whose outline alone is a post).
  - A coloured iris shows only on a pupil big enough to carry it (the speedster's green, the robot boy's and the plumber's blue, the elf's, the miner's blocks); smaller, it read as a grey smudge, so it's ink.
  - A head side on (a face found with one eye and a `pair`) shows its far eye as a sliver tucked behind the near one, or none (the horse, the dragon, the king, the puppy): two full eyes side by side read as goggles stuck on the side of the head. A three-quarter face that draws both (the slayer) keeps its far eye where it's drawn, foreshortened (`far: 'turned'`). The eyes are drawn inside the figure's outline, so one set near the edge never pokes past the line; the brows may stand clear of it.
  - Every style acts every mood: the blink, the cheer's arcs and the death's crosses are the kit's for all; the run, the way up and the fall are each style's own (a lid drops into the run and lifts on the way up, a pupil shrinks on a fall), and the brows act over every style but the black ones, whose act is in the eye. `pnpm shot cast --only faces` shows every kind's face through the moods, close up and at play scale px for px.
- **What a 20 px read can't take** is drawn otherwise: anything dark under the face reads as a mouth (the zapmouse's black cord belt is brown), a long line across a ball reads as a mouth (the puffball's seam isn't drawn), a cross beside an eye reads as an eye (the puffball's tape is gone), and a colourway that lands on another role's colour loses the colour block (the plumber's brown-canvas overalls are navy).
- **What the blind reads taught**, across every kind's rounds (each kind's Rig line has its readers' words). A reader names a silhouette by its outline alone, so:
  - **Profile beats three-quarter** for a kind read by its snout, jaw, shell, box or four legs: in three-quarter its parts merge into one round mass (the king, the sneak, the rapper; the horse upright read as a fox until it stood on four legs).
  - **A part inside the outline isn't there.** A prop held across the chest or raised overhead vanishes (the hunter's cannon, the robot's can); held out level with background all round it, it reads. A visor, ear disc or pack that doesn't stand proud of the body is lost (the impostor, the robot).
  - **Parts that touch become one shape.** A cup above a cap, buoys beside a helmet, a can against a back, a beanie against the head: each pair read as one lobed blob. A gap the read needs must be about 2 world px of background, or the pen closes it (the limbless hero).
  - **Small shapes read as other features.** A coiled cord or a second wrench jaw by the boots reads as a tail; a brimmed or leaning hat as a gnome's or wizard's; a snout level with a hat's band as its bill; flaps on a box as ears; long bandana tails as an ape's arms; a dark fill inside the figure is no mouth at all (the dot-eater's wedge is cut out, `cut`).
  - **Some outlines belong to another kind.** Arms flung up overhead read as the ape; spikes all round as the hedgehog; a round helmet over a level cannon on short legs in big boots as the robot boy; a wide brim on a stocky man as the plumber's rival. Check the pairs in What to check before picking a pose.
  - **Widening a signature part can turn it into the head** (the rapper's beanie): push a part taller or further out before wider.
  - **A prop that belongs to the homage can carry the read when the head can't.** A triangle on a body is a cone hat until a long blade drags steeply behind it (the executioner).
  - **A long ear flying up beside a tall hat reads as rabbit ears** (the rapper, until his ear hung short and limp under a side-on dog head with a long snout).
  - **A low lunge with a blade reads as a ninja or a martial artist, whatever it carries; a trophy held out reads as a weapon** (the slayer).
  - **Lobes hanging beside a small head read as shoulders or a cape**, not ears (the assistant dog, whose head is about 6 world px wide).
  - **Background between a part and the head makes it a part.** Buns snug on the crown, at the temples or on its corners read as a headband's knot; pushed up and out with a gap round each and a thin join, they read as the fighter's buns.
  - **Edits that only move the misread** (a gnome, then a mouse, then a monkey) mean the silhouette has no shape nobody else's has; a new design idea is cheaper than a fifth edit (the rapper's seven rounds).
- **Motion** is a few drawings per clip: a two-frame walk and run, a jump and a fall (the hedgehog's a looping spin ball), a wall slide, two cheers, a second idle, the knocked-out pose; the shared squash and the kind's gait move on top.
- **Variety** (Rules for every kind → Variety) is data and marks on every pose: a colourway (`alts` on `vary` 6), an accessory (a strip on the crown or the cheek), `idle2` and `cheer2`, a `gait` range, and the `wear` slot: clean, scuffed and scorched, marks on bare surface below the face (one quiet one on a smooth ball, where a ring of blobs reads as a rash).
- **Out of the light bands.** Every rendered figure marks its shape in the light map's alpha (`Renderer.markFigures`), and the cel pass lights it evenly, dimmed less with the theme than the world (`figAmbient`), with no band or light tint across it: a band's edge cut across a 20 px body and blew light colours (the tin tail) out to white. The world round it still bands. The hand-drawn kinds don't mark, so they still band.
- **Cost.** About 0.003 ms per runner drawn from the frame-bitmap cache. Frame data is about 80–220 KB per kind, a chunk fetched on first use. Images: tools/art3d/README.md.
- **Checks:** `tests/sprite-cast.test.ts` (every clip, the shared hitbox box pen and all, at least 18 px tall, every eye on its head, a side-on head's far eye a sliver or none, the variety layers), and `pnpm shot sprites --kind K` and `pnpm shot variety --kinds K` (the run cycle, the six-rolls lobby, twelve looks, the draw cost, and `sprites-blind.png`, every kind as a shuffled, unnamed play-scale silhouette for fresh readers).

## Hand-drawn kinds

Every kind also has a hand-drawn body (`KINDS` in `src/render/cast/kinds.ts`), drawn until its frames load and for a kind not yet produced.

- **One hitbox, one physics.** Every kind is drawn around the same 14×15 world-px body. Hats, ears, tails, shields and wrenches are thin or behind the body. `tests/ink-character.test.ts` holds every kind inside one box around the hitbox, standing on the floor.
- **Outlines as data.** Each silhouette is authored as curves, facing right, in body units (`outline`), with variants where the line of action changes the shape (the goose's run). Sampled once per kind and pose.
- **The body bends.** Squash and stretch bend the outline; each kind's `gait` adds its own hop, rock, spin or waddle about its own pivot. Caps, ears and tails sway on their own.
- **Faces belong to the kind** (`src/render/cast/faces.ts`): cartoon eyes with irises, highlights and brows that set on a run, lift on a jump and worry on a fall; a visor, goggles or a side eye where that's the character.
- **Glass.** The jelly's dome is translucent (no ink mass under it), the one see-through body.
- **Death.** Shards of the character's colors, and a few kinds' own bits (the plumber's coins, the engineer's bolts and springs).
- **Determinism.** `generateCharacter(seed)` is a pure function of the seed, and the kind is one of its rolls.
- **Cost.** About 0.04–0.07 ms per runner on a software canvas; nothing needs baking.

## Adding a kind

AGENTS.md → Extension points → Character kind has the steps. Also update the kinds and paints `tests/gen.test.ts` pins per seed (and the `LOOK_CAST` its comment names), write its entry in `docs/characters/<kind>.md`, add its rows to The cast and Production order, and take it through Rendered kinds.
