# Characters: homages and animals

The runners are a cast of thirty homages to famous game characters, in our own designs. In the lore (DESIGN.md) they're the characters who never made the cut, from stray animals to knock-off heroes who almost got their own game. Each kind is a character design of its own, the way the barnyard party game's animals are: its own outline, its signature props, and a way of moving.

`pnpm shot cast` shoots the sheet: the 8-player lineup at play scale on farm and mine, the race start, deaths, a 3× close-up, the lobby cards, the "is it the homage?" sheet (`cast-recognise.png`), the silhouette test (`cast-silhouettes.png`) and the catalog of every kind (`--only catalog` for the last three). In the console, `slagDebug.cast` has `catalog()`, `silhouettes()`, `recognise()` and `bench()`.

## Decisions

From the owner (logged in [DECISIONS.md](DECISIONS.md) → Characters):

1. **Every character is a homage.** The lore makes the runners the knock-off heroes who almost got their own game, so the whole cast parodies famous game characters (see Roster). The four plain animals from round 5 left the cast when the last nine homages came in (2026-11-04).
2. **Recognisability comes first.** A stranger should name each homage at a glance. For each one we list the three or four traits people actually know it by and make every one of them unmistakable at play scale.
3. **Homages, never copies.** Each is our own design, read from its silhouette and one or two signature props, never the original's exact design or its real name. Sound-alike names are data (`KIND_NAMES` in `src/gen/character.ts`) and appear nowhere else. Player characters may have faces and personas; parts and machines stay faceless (DESIGN.md → Parody).
4. **A neutral palette, and the colour is the player's.** Each kind's own colours are neutrals: skin, eyes, hair, metal, wood, bone, cloth greys and the ink. Nearly every coloured part takes the player's colour: the costume in it, every other coloured part in a lighter or darker tone of it (the plumber's cap and overalls, the engineer's hat and shirt). The shape carries the read, not the original's hues. It's that player's HUD color, and with eight different kinds per lobby, eight players stay told apart. (Owner, 2026-11-04; before, a homage kept its iconic hues and the player's colour went on one costume region.)
5. **Random roll only.** New Look rolls everything, the kind included. A lobby never seats two of the same kind (`Match.looksFree`).
6. **Saved looks re-roll once** whenever the cast changes what a seed means: `LOOK_CAST` in `src/ui/profile.ts` (now 9).
7. **Clean, light, hand-drawn.** A thin pen that varies along the line, in a dark of the body's own color; two or three flat tones per surface; one soft, hard-edged shadow shape; calm color; no glow.
8. **The roster is the twenty greatest characters to parody**, each with a clear twist of its own, because the homages had looked too much like the originals (Roster).
9. **Designed at game size, and worn.** The concept sheets were too detailed for our resolution, so a kind is designed to read as a 24 px sprite: one silhouette idea, about three big shapes, four flat colours plus ink, one signature prop, the eyes. Every kind is a little disheveled, because of the lore, and the grunge is worn shape, never grime: a bent and taped ear, a dented head, a sagging, lopsided body, a bent prop, one foot bigger than the other. Colours stay clean and bright, and the line stays the cast's pen. A rough line and colour grime were tested on the zapmouse and lost: the line vanishes at play scale, and dull colour sinks into the darker themes (`shots/styletest/`, 2026-11-02).

## The bar

What polished small-character games do, and what we hold the cast to:

- **Silhouette first, judged at real size.** Clever Endeavour judges *Ultimate Chicken Horse* art in the game at actual scale, added Snake for "a unique silhouette", and dropped a reskin that read in-game as "a beige Snake" ([Behind the scenes: Snake](https://cleverendeavourgames.com/blog/2020/9/21/behind-the-scenes-snake)). Mediatonic tells *Fall Guys* designers to zoom out and check the main elements still read ([PlayStation Blog](https://blog.playstation.com/?p=224711)).
- **Few colors, chosen hard.** Yacht Club holds *Shovel Knight* characters to about five colors each, inside an NES-like palette, and iterated the Hengineer's silhouette and attitude until both were solid ([Kotaku](https://kotaku.com/how-a-shovel-knight-npc-gets-made-1842271950); [Shovel Knight: Official Design Works](https://shovelknight.fandom.com/wiki/Shovel_Knight:_Official_Design_Works)). A grayscale check of contrast is a standard test ([80.lv](https://80.lv/articles/celeste-fan-art-highlighting-character-with-texturing-pose)).
- **One trait carries identity; color tells players apart.** Multiplayer Kirbys differ by color alone ([WiKirby: Color](https://www.wikirby.com/wiki/Color)); a fighter's icon is its silhouette plus one prop.
- **Readability and juice in motion.** *Celeste*'s tiny protagonist reads through pose and a strong line of action more than through detail ([review notes](https://www.sonicstadium.org/blogs/entry/384-spoilers-brief-thoughts-on-celeste/)).

So each kind has: a clear head-to-body ratio, a readable expression, a line of action in its run and jump poses, secondary motion on its garments, ears and tails, brows that react, and more detail at card and menu scale (a third, lit tone) than at play scale.

## The cast

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
| [rapper](characters/rapper.md) | the rapping paper puppy | side on, a chubby flat card cut-out with its edge down his back: a tall thumb of a knit beanie standing straight up, a long floppy ear hanging behind, a round nose on a snout low on his face, a baggy tee and shorts, big trainers, a cordless mic held out in front | costume: the beanie and tee, the shorts a dark of it |
| [limbless](characters/limbless.md) | the limbless hero | no arms or legs: white gloves and big shoes floating clear of a small round body with background all round each, a huge nose, a spiky hair tuft standing up, a neckerchief | costume: the top, the shoes a light tone of it |
| [worm](characters/worm.md) | the worm in the super suit | side on, a super suit with big round shoulder pads, a broad chest, a narrow belted waist, slim legs and big boots; a thin pink worm neck out of the collar arcing forward to a head wider than it, huge bulging eyes standing up and a wide grin; a small hair dryer held out at arm's length like a raygun | costume: the suit, the gloves, boots and belt a dark of it |
| [dragon](characters/dragon.md) | the little purple dragon | small and low on four stubby legs, side on: a big round head with two long horns swept straight back, stubby umbrella-cloth wings on bent spokes, a pale belly, a ridge of small spines, a tail ending in a taped arrowhead with a firefly jar hanging from it | costume: the scales; the wing cloth a light of it, the far legs a dark |
| [hopper](characters/hopper.md) | the snouted cube hopper | a round ball with no arms on two short legs in worn trainers, two big eyes standing up out of its crown, a long tube snout sticking straight out front and flared at its open end, a party blower; hops both feet together | costume: the ball and legs; the snout and the blower's streamer lights of it |
| [warrior](characters/warrior.md) | the round Slavic warrior | a huge round belly on short legs, a big round bald head, a small iron pot of a helmet with a knob on top and its handle out behind, a big round nose over a short bushy moustache, a short belted tunic, thick bare arms, a sword at his belt, a half-eaten roast leg held out like a club | costume: the tunic |
| [slayer](characters/slayer.md) | the white-haired monster slayer | broad-shouldered in a wide stance, a short coat over two legs in tall boots, white hair tied tight back, a long sword held low in hand and two hilts side by side above his back shoulder (one an umbrella's), a bottle-cap wolf medallion, yellow cat's eyes, a scar | costume: the coat; the gloves and boots a dark of it |
| [raider](characters/raider.md) | the braided tomb raider | a long single braid swinging behind her head, a tank top and shorts, twin pistols in thigh holsters, a small backpack, boots | costume: the tank top |
| [fighter](characters/fighter.md) | the bun-haired street fighter | two round hair buns either side of her head like ox horns, a high-collared qipao with puffed shoulders, spiked bracelets, thick strong legs, a kicking stance | costume: the qipao |
| [stinger](characters/stinger.md) | the horned bug with the needle | a small bug with a white mask face and two long curved horns, a red cloak hanging from the shoulders like a bell, thin dark legs, a long needle on a thread | costume: the cloak |

**Is it the homage?** `cast-recognise.png` puts each kind close up beside "This is ___", in its roster colour. Every sheet waits for the rendered kinds' frames (`slagDebug.sprites.ready()`), so it shows what ships; before 2026-11-02 the catalog, recognise and silhouette sheets drew those kinds hand-drawn, so the reads below were judged on the old bodies. As of this round, every homage reads as its caption to us: the plumber, speedster, elf, mouse, impostor, puffball, jelly and goose at once; the bounty hunter and the engineer a beat slower, because their reads lean on props (the shoulder pads and cannon, the hat and wrench) more than on a silhouette nobody else shares. The silhouette test still separates every kind, though the plumber and the hunter are the closest pair of stout shapes.

## Roster (all homages)

The cast this is heading to: **twenty kinds, the greatest game characters to parody**, every one a homage, because the lore makes the runners the characters who never made the cut, the knock-off heroes who almost got their own game. The ten homages from round 5 stay, and so do five of the six round-6 picks. The four plain animals (fox, frog, penguin, chicken) go. Round 10 (owner, 2026-11-04) adds five retro picks past the twenty: the rapping paper puppy, the limbless hero, the worm in the super suit, the little purple dragon and the snouted cube hopper. Round 11 (owner, 2026-11-04) adds a comics hero and a game hero: the round Slavic warrior and the white-haired monster slayer. Round 12 (owner, 2026-11-04) adds three iconic heroines from franchises the cast hadn't touched, because it had almost none: the braided tomb raider, the bun-haired street fighter and the horned bug with the needle.

This spec feeds the art pipeline (Rendered kinds below): a design at game size, worn in an edit and drawn in each pose, traced flat into the cast's own shapes. Each entry is written to be used as prompt material, so it describes traits only and never names a real character. Every kind is our own design: it must read as the homage from its silhouette and props, never copy the original's exact design, and never carry its name or logo. Sound-alike names stay in data (`KIND_NAMES`). **The nod is the silhouette; the rest is ours.** A concept that looks like the original redrawn is rejected, however good it looks.

### How the twenty were picked

Each candidate was scored on four things:

- **Reach.** How many strangers know it: the published polls and rankings (BAFTA's 2024 poll of 4,000 players, the Guinness Gamer's Edition top 50 voted by 13,000 fans, the GamesRadar and Destructoid lists), recognition surveys (the Guinness record for the most recognisable game character at 94%, a 2021 survey of 1,800 young adults), best-selling franchises, and the crossover brawler's roster.
- **The 20 px read.** Whether the silhouette alone, in profile at play scale, names it. A generic soldier, a space marine or an adventurer in a tank top fails; a cap and a mustache, swept quills, a wedge mouth or a cube head passes.
- **Fit.** The parody targets are Nintendo's franchises, the crossover brawler's roster and the barnyard party game, plus the owner's own picks (the jellyfish parasite, the goose, the team shooter's engineer, a robot). All twenty are in at least one.
- **Variety and rig.** No two may rhyme, so the twenty spread across stout, slim, hulking and tiny humans, robots, mammals, a bird, a dinosaur, a bean, a ball, a wedge and a floating dome. A humanoid rig is easiest; a quadruped, a bird or a body with no limbs is keyed by hand from the pose sheet.

What came out of it:

- **In:** the voxel miner, the spiky-haired mercenary, the sneaking soldier, the blue robot boy and the spiked turtle king. Each is on the crossover brawler's roster, the first four sit in the top tier of every poll, and each has a silhouette nobody else in the cast shares (a cube head, a sword taller than he is, a box on legs, a round helmet with an arm cannon, a spiked shell with horns). The robot boy is the owner's "robot".
- **Out:** the horned bug knight (round 6) moves to the reserves. It's on none of the polls, it's in neither the brawler's roster nor Nintendo's, and with the elf and the mercenary already carrying blades it was a third sword.
- **Reserves,** if one of the twenty won't read: the horned bug knight, the spinning bandicoot (its tuft and grin rhyme with the speedster), the shovel-wielding knight, the red-haired mountain climber, the falling-block party bean (rhymes with the crewmate).
- **Passed over:** the space marine in green armour and the tomb-raiding adventurer top their polls but read as a generic soldier and a generic adventurer at 20 px. The plumber's tall brother, the ape's red-capped nephew and the king's turtle foot soldiers rhyme with kinds already in.

### Rules for every kind

- **Size.** About 16 world px tall at play scale, inside the shared 14×15 body envelope. One hitbox for everyone. Big props stay thin or behind the body.
- **Style.** Clean, confident curves; few shapes; smooth tapered lines in a dark of each part's own color; two or three flat tones per surface; one soft, hard-edged shadow shape; calm color; no glow, no gradients.
- **Facing.** Drawn facing right, standing on the floor.
- **Player's color.** Decisions 4: the kind's palette is neutral, and nearly every colour on it is the player's. The region a stranger would name the character's colour by wears the player's colour (`slot: 'player'` in its entry, `tools/art3d/flat/kinds.ts`); every other coloured part is a tone of it (`on` that role, `tone` lighter or darker), far enough apart that the parts stay separate shapes; the rest is neutral (skin, eyes, hair, metal, wood, bone, cloth greys, ink). No ring. Nothing that a stranger reads as skin, eyes or a face takes it. This holds even where a colour is the original's identity (the dot-eater's ball, the plumber's blue overalls): the shape carries the read.
- **Faces.** Expressive eyes with highlights, and brows that react to running, jumping, falling and cheering. The face is the kind's, never rolled: eye count, style, iris, place and mouth are part of its design (`paintFace` in `KINDS`, `face` in a rendered kind's entry), so every character of a kind has the same face and only its expression changes. A rendered kind's eyes are found in every pose (`tools/art3d/README.md` → Face, variety, frames).
- **The nod and the twist.** The nod is the three or four traits a stranger names it by, and each entry says why each one is needed. The twist is ours: a foundry, scrapyard or knock-off flavour, a changed signature prop, and one joke. A twist never moves or hides a trait the nod needs.
- **Swaps.** Small accessories inside the outline, rolled per look from `vary`: they never change the silhouette.
- **Disheveled.** Two or three worn tells per kind, each a change to the outline or a big flat shape that reads at play scale (Decisions 9). They are the design, not a roll: every look of a kind is battered the same way.
- **Variety.** Every look of a kind is the same character by the same hand, so variety is curated, never rolled freely: the face, the proportions and the silhouette are fixed per kind. Besides the costume colour and the swaps, each kind designs three layers, each picked from the look seed (`VARIETY` in `src/render/cast/sprites/play.ts`) and render only:
  - **Palette alts:** 2–3 designed colourways for one neutral region, in neutrals (a steel, a bone, a worn leather; the hair's shade), never the costume, its tones, skin, eyes or face. Parts that belong together (a shoe and its sole) change together.
  - **Idles and cheers:** two of each, the second keyed from the pose sheet or cut from another clip, plus a gait range: how much extra bounce on each step and how far forward it leans, small enough to stay in the shared box.
  - **Wear:** clean, scuffed and scorched. A few small marks on the body, the limbs or the shoes in a tone of the surface they sit on (a faded patch, a scuff, a soot streak), never on the face, and too few to read as noise at play scale.

  Done when the variety sheet (`pnpm shot variety --kinds K`) shows twelve looks that all read as the same character, and the play-scale row reads as clean as one look does.
- **No letters or logos** on anything, at any scale: a badge carries a small mark of ours.

**The concept prompt.** Every entry ends with a prompt of traits only. Append the house style to each one:

> Clean hand-inked 2D game character, full body, facing right, standing on the ground. Flat colour in two or three tones per surface, a thin tapered outline in a dark of each part's own colour, one hard-edged shadow shape, calm colour, no gradients, no glow, no text or logos, plain white background. Proportions pushed so it reads at 20 pixels tall.

Each kind's entry is a file of its own in [characters/](characters/), named for the kind and linked from the table in The cast above: what a stranger should say, the silhouette, traits, palette, gait, the nod, our twist, swaps, how it was drawn and every blind read (its Rig line), and the concept prompt.

### Production order

The strongest reads first. **Keyed** marks the non-humanoids, the riskiest: their poses are keyed by hand from the pose sheet, which is fine but costs more.

| # | Kind | Name | Rig | Risk |
|---|---|---|---|---|
| 1 | plumber | Plumbo | humanoid | done (round 2) |
| 2 | hedgehog | Sanic | humanoid, spin keyed | done (round 2) |
| 3 | chomper | Snack-Man | generated, no limbs | done (round 3) |
| 4 | zapmouse | Pikachew | **keyed**, quadruped | medium: the scamper |
| 5 | elf | Lonk | humanoid | low |
| 6 | puffball | Kurby | **keyed**, ball and feet | done (generated body) |
| 7 | miner | Stove | humanoid, stiff | low: the simplest model |
| 8 | impostor | Sussy | **keyed**, legs only | low |
| 9 | ape | Dankey Kang | humanoid, gallop keyed | medium |
| 10 | merc | Clod | humanoid + blade prop | medium: the blade's size against the envelope |
| 11 | king | Browser | humanoid + shell prop | medium: bulk inside the envelope |
| 12 | dino | Yoshee | humanoid + tail | low |
| 13 | robot | Meh Man | humanoid + can prop | low |
| 14 | sneak | Snek | humanoid + box prop, keyed | medium: the box poses |
| 15 | cuptoon | Mughead | humanoid, rubber hose keyed | medium |
| 16 | hunter | Sammus | humanoid, ball tuck keyed | low |
| 17 | engineer | Engie | humanoid | low |
| 18 | goose | Honkers | **keyed**, bird | high: wings and neck |
| 19 | horse | Hoarse | **keyed**, quadruped | done (on four legs) |
| 20 | jelly | Meltroid | **keyed**, no limbs | high: translucency |
| 21 | rapper | Parapper | humanoid, flat card | low |
| 22 | limbless | Raymond | **keyed**, floating hands and feet | done (drawn flat, the pieces spread apart) |
| 23 | worm | Earthworm Gym | humanoid + head stalk | medium: the neck |
| 24 | dragon | Spiro | **keyed**, quadruped | medium: wings and tail |
| 25 | hopper | Kewbert | **keyed**, legs only | low |
| 26 | warrior | Kakosh | humanoid, round | drawn flat; the blind read fails (the head and helmet close into one mound) |
| 27 | slayer | Gerald | humanoid | drawn flat, redrawn broad with a sword in hand; the blind read not passed (unpaired, but the two hilts read as rabbit ears) |
| 28 | raider | Laura Craft | humanoid | medium: the braid against the slayer's tail and the elf's cap |
| 29 | fighter | Chun-Lee | humanoid | low: the buns |
| 30 | stinger | Hornette | **keyed**, bug | medium: the horns against the king's and the hedgehog's spikes |

The hunter and the engineer sit late although they're easy to rig: their hand-drawn versions read a beat slower than the rest, so they gain least from going first.

**What to check.** No two kinds may rhyme. Watch these pairs:

- **The puffball and the dot-eater:** feet, arms and a mouth against a wedge and no limbs.
- **The goose and the horse:** two farmyard homages, but white versus brown and an S-neck versus a long muzzle.
- **The hunter and the robot boy:** both carry an arm cannon. The hunter is the tallest kind, long-legged, the cannon straight out from the shoulder; the robot boy is small with a round helmet and ear discs, the can at arm's length. Two blind reads took the old, stocky hunter for the robot boy.
- **The speedster and the robot boy:** both blue. Quills swept back against a round helmet.
- **The miner and the sneaking soldier:** both boxy. A cube head on a body with arms against one box on two legs.
- **The ape and the turtle king:** the two brutes. Hunched, brown and long-armed against upright, side on under a smooth shell dome with three big spikes, horned, the jaw open.
- **The mercenary and the plumber:** both carry a huge prop. The plunger is strapped to the plumber's back; the blade is always in the mercenary's hand, trailing low or leaning on the floor.
- **The mercenary and the elf:** both carry a blade, but a poker on the elf's back against a blade bigger than the mercenary.
- **The crewmate and the sneaking soldier:** both a body on two stubby legs. A rounded bean with a visor against a square box with an eye slot.

Every kind must also pass the silhouette sheet, the blind read and the "is it the homage?" sheet before it ships.

## Rendered kinds

How a kind's entry (`docs/characters/<kind>.md`) becomes a kind the game draws from art. The entry is the one source for the design (nod, twist, swaps, palette); this is the pipeline. A kind with rendered frames is always drawn from them (no option); a kind without keeps its hand-drawn body until it is produced. Production steps and the done list: [tools/art3d](../tools/art3d/README.md) and its [checklist](../tools/art3d/CHECKLIST.md). Every rendered kind is a flat kind since 2026-11-03; the 3D route before it (a Tripo model rigged, posed, rendered and traced) is retired: at play size its kinds read rough and blobby, too detailed and lit by a render ([tools/art3d/3D.md](../tools/art3d/3D.md)).

- **Drawn, at game size.** One design made to read as a 24 px sprite (Decision 9), worn in an edit, then drawn in a dozen poses by the image model with the design as its reference: it copies a reference closely, which holds the character from pose to pose. Where the image model draws the original whatever the brief says (the hedgehog), the kind's approved concept is the reference instead.
- **Flat, in the drawing's own shapes.** Each drawing is traced at one body size into its own flat colours, every shade folded in, under a light pen with no ink mass or shade sliver (`flat`), plus its long interior lines (`lines`: an arm over the body, the gap between the legs). A shade that carries a shape is a dark of the costume (the plumber's cap shadow and plunger cup).
- **The cast's face** takes over from the drawing's eyes and mouth, specks at play size: eyes found per pose (a pair, or one and the far one set from it), brows set into the run, wide on a fall, squinting on a cheer, crossed out on a death. The mug is the bar (owner, 2026-11-04): its kit eye is the original's own, one bold two-tone shape big enough to survive play scale, so the drawing, the homage and the acting agree. So each kind wears its homage's eye from the kit's registry (`EYES` in `src/render/cast/sprites/face.ts`), sized to its drawing:
  - `tall`: a black oval twice as tall as wide with one big glint, no white (the mug, the puffball). `dot`: a small black eye with a glint (the electric mouse, the dot-eater, the goose, the engineer's under his goggles).
  - `round`: a white and one big pupil (the hopper, the limbless hero, the robot boy, the speedster, the sneak in his slot). `pill`: a tall white with a tall pupil (the plumber, the dino, whose two touch).
  - `profile`: a side-on head's one eye, the pupil pressed to its front rim (the horse, the dragon). `scowl`: an almond under a hard lid slanting down to the front, round a slit (the turtle king).
  - `heavy`: a round white half under a flat lid (the ape, the mercenary's brood, the puppy's eyes under the beanie). `anime`: a big iris under a thick lash (the elf). `square`: a white block and an iris block (the miner).
  - A coloured iris shows only on a pupil big enough to carry it (the speedster's green, the robot boy's and the plumber's blue, the elf's, the miner's blocks); smaller, it read as a grey smudge, so it's ink.
  - A head side on (a face found with one eye and a `pair`) shows its far eye as a sliver tucked behind the near one, or none (the horse, the dragon, the king, the puppy): two full eyes side by side read as goggles stuck on the side of the head. The eyes are drawn inside the figure's outline, so one set near the edge never pokes past the line; the brows may stand clear of it.
  - Every style acts every mood: the blink, the cheer's arcs and the death's crosses are the kit's for all; the run, the way up and the fall are each style's own (a lid drops into the run and lifts on the way up, a pupil shrinks on a fall), and the brows act over every style but the black ones, whose act is in the eye. `pnpm shot cast --only faces` shows every kind's face through the moods, close up and at play scale px for px.
- **What a 20 px read can't take** is drawn otherwise: anything dark under the face reads as a mouth (the zapmouse's black cord belt is brown), a long line across a ball reads as a mouth (the puffball's seam isn't drawn), a cross beside an eye reads as an eye (the puffball's tape is gone), and a colourway that lands on another role's colour loses the colour block (the plumber's brown-canvas overalls are navy).
- **What the blind reads taught**, across every kind's rounds (each kind's Rig line has its readers' words). A reader names a silhouette by its outline alone, so:
  - **Profile beats three-quarter** for a kind read by its snout, jaw, shell, box or four legs: in three-quarter its parts merge into one round mass (the king, the sneak, the rapper; the horse upright read as a fox until it stood on four legs).
  - **A part inside the outline isn't there.** A prop held across the chest or raised overhead vanishes (the hunter's cannon, the robot's can); held out level with background all round it, it reads. A visor, ear disc or pack that doesn't stand proud of the body is lost (the impostor, the robot).
  - **Parts that touch become one shape.** A cup above a cap, buoys beside a helmet, a can against a back, a beanie against the head: each pair read as one lobed blob. A gap the read needs must be about 2 world px of background, or the pen closes it (the limbless hero).
  - **Small shapes read as other features.** A coiled cord or a second wrench jaw by the boots reads as a tail; a brimmed or leaning hat as a gnome's or wizard's; a snout level with a hat's band as its bill; flaps on a box as ears; long bandana tails as an ape's arms (and those just above).
  - **Some outlines belong to another kind.** Arms flung up overhead read as the ape; spikes all round as the hedgehog; a round helmet over a level cannon on short legs in big boots as the robot boy; a wide brim on a stocky man as the plumber's rival. Check the pair list below before picking a pose.
  - **Widening a signature part can turn it into the head** (the rapper's beanie): push a part taller or further out before wider.
  - **Edits that only move the misread** (a gnome, then a mouse, then a monkey) mean the silhouette has no shape nobody else's has; a new design idea is cheaper than a fifth edit (the rapper's seven rounds).
- **Motion** is a few drawings per clip: a two-frame walk and run, a jump and a fall (the hedgehog's a looping spin ball), a wall slide, two cheers, a second idle, the knocked-out pose; the shared squash and the kind's gait move on top.
- **Variety** (Rules for every kind → Variety) is data and marks on every pose: a colourway (`alts` on `vary` 6), an accessory (a strip on the crown or the cheek), `idle2` and `cheer2`, a `gait` range, and the `wear` slot: clean, scuffed and scorched, marks on bare surface below the face (one quiet one on a smooth ball, where a ring of blobs reads as a rash).
- **Out of the light bands.** Every rendered figure marks its shape in the light map's alpha (`Renderer.markFigures`), and the cel pass lights it evenly, dimmed less with the theme than the world (`figAmbient`), with no band or light tint across it: a band's edge cut across a 20 px body and blew light colours (the tin tail) out to white. The world round it still bands. The hand-drawn kinds don't mark, so they still band.
- **Cost.** About 0.003 ms per runner drawn from the frame-bitmap cache. Frame data is about 80–220 KB per kind, a chunk fetched on first use. Images: tools/art3d/README.md.
- **Checks:** `tests/sprite-cast.test.ts` (every clip, the shared hitbox box pen and all, at least 18 px tall, every eye on its head, a side-on head's far eye a sliver or none, the variety layers), and `pnpm shot sprites --kind K` and `pnpm shot variety --kinds K` (the run cycle, the six-rolls lobby, twelve looks, the draw cost, and `sprites-blind.png`, every kind as a shuffled, unnamed play-scale silhouette for fresh readers).

**Blind reads of the flat kinds** (2026-11-03, two fresh readers, silhouettes only): the plumber, the speedster and the elf are named by both at high confidence (the elf up from medium as a 3D kind); the electric mouse by both, medium-high and high, from the ears and the zigzag tail; the puffball by both at medium. The dot-eater fails: "a plain round ball with a small tuft or bow on top, no mouth wedge visible" (unsure; a low "Ms. Pac-Man-style dot-eater with a bow"), and a low "Jigglypuff". Drawn flat, its mouth was a dark fill inside the figure, so the silhouette was a plain circle, and the tape cross on its crown read as a bow. With the mouth cut out of the figure (`cut`) and the tape moved to its cheek, two more fresh readers name it at high confidence: "a circle with a wedge mouth cut out, and the wedge is still visible in every pose". They read the other five as the first two did.

**The second batch** (2026-11-03, the impostor, hunter, engineer, goose and jelly drawn flat; two fresh readers): the first eleven hold (the plumber, speedster, mouse, elf and dot-eater medium to high), and the goose reads at medium as before. Three fall back: the impostor ("a squarish rounded blob with small nubs", "a boxy, heavy blob", unsure twice; its jerrycan merges into its back and its visor doesn't stand proud of the bean), the jelly (low twice, "a dome with a fringed or legged bottom edge"), and the puffball (unsure and low, "the small bumps on top make it less clear": its plaster cross on the crown). The hunter and the engineer still aren't named, as before they were drawn flat.

**After the redraws** (two more fresh readers): the impostor is back, high twice ("bean body, visor bump out front, backpack slab on the back"); the goose holds at medium. The hunter is named for the first time, by one ("armored bounty hunter, medium: round helmet, wide shoulder pads, one arm a thick cannon held out level"), and taken for the blue robot boy by the other: the pair the Production order warns of. The jelly is named by one at medium; the other saw "an octopus/tentacle alien, medium… might be" it: its long hooks curl like tentacles. The puffball is named by both, medium and low. The engineer fails: "Wario, low" from both, the wide brim and the jaw on a stocky body rhyming with the plumber. Redrawn a third time (a tall dome hat with the goggles as a band, one big open-jawed wrench clear of it, a clean jaw), he no longer rhymes with the plumber, but three fresh readers still read only "a mechanic or engineer, but I can't name the source": his homage carries no silhouette nobody else shares, as his hand-drawn version didn't either.

**Blind reads of the 3D-traced kinds** (before 2026-11-03): the speedster is named every time, medium-high to high. The plumber went from low to split (one reader "the plumber, medium", one unsure) after his cap, nose and girth were pushed and his plunger carried lower; in colour he reads at once. With the cup above his head the cup and the cap merged into one shape, so the plunger is carried low for good (owner, 2026-11-02). Both readers name the dot-eater at high confidence, from the circle with its wedge mouth and the speed lines of its run. The electric mouse is named by both, medium and medium-high, from the tall pointed ears and the jagged zigzag tail raised behind; one reader also saw a rabbit holding something. The elf read as the plumber ("a cap with a forward brim") while his cap's tail stuck straight back level with the crown; drooped from the crown, with the ears up behind it and turned nearer profile, he reads as the elf hero to both fresh readers, one at medium.

## What every kind keeps

- **One hitbox, one physics.** Every kind is drawn around the same 14×15 world-px body, inside the range the old blobs used. Hats, ears, tails, shields and wrenches are thin or behind the body. `tests/ink-character.test.ts` holds every kind inside one box around the hitbox, standing on the floor.
- **Outlines as data.** Each silhouette is authored as curves, facing right, in body units (`outline` in `src/render/cast/kinds.ts`), with variants where the line of action changes the shape (the goose's run). Sampled once per kind and pose.
- **The body bends.** Squash and stretch bend the outline; each kind's `gait` adds its own hop, rock, spin or waddle about its own pivot. Caps, ears and tails sway on their own.
- **Faces belong to the kind** (`src/render/cast/faces.ts`): cartoon eyes with irises, highlights and brows that set on a run, lift on a jump and worry on a fall; a visor, goggles or a side eye where that's the character.
- **Glass.** The jelly's dome is translucent (no ink mass under it), the one see-through body.
- **Death.** Shards of the character's colors, and a few kinds' own bits (the plumber's coins, the engineer's bolts and springs).
- **Determinism.** `generateCharacter(seed)` is a pure function of the seed, and the kind is one of its rolls.
- **Cost.** About 0.04–0.07 ms per runner on a software canvas; outlines are sampled once per kind and pose, and nothing needs baking.

## Adding a kind

Add the id to `CAST`, its sound-alike name to `KIND_NAMES` and its own colors to `PAINTS` (`src/gen/character.ts`), and a `KindArt` to `KINDS` (`src/render/cast/kinds.ts`): an outline inked as curves facing right, the three or four traits people recognise, a gait, a face, the player's color on the body or a `ring`, and the parts it breaks into. Add its caption to `READS_AS` in `src/render/cast/sheet.ts`. Then run `pnpm shot cast` and look at `cast-recognise.png` and `cast-silhouettes.png`: if a stranger wouldn't name it, or its silhouette could be mistaken for another kind's, it isn't done. A new kind changes which kind every seed rolls, so bump `LOOK_CAST` with it, and update the kinds and paints `tests/gen.test.ts` pins per seed (and the `LOOK_CAST` its comment names). Its entry is `docs/characters/<kind>.md`, linked from the table in The cast. A kind drawn from art goes on through the pipeline in Rendered kinds.

## History

- **Phase 1** proposed three directions; the owner picked foundry toys.
- **Rounds 1–3** built the toys and the hand-authored outline, gait and silhouette-test system.
- **Round 4** swapped the toys for animals and a few parody critters, drawn lighter.
- **Round 5** made the cast mostly homages, put recognisability first (iconic palettes, the player's color on a ring), and raised the craft: proportions, reacting faces, pose outlines, a card-scale rim tone.
- **Round 6** wrote the all-homage roster as prompt material for the art pipeline (generated concept, traced into rigged vector parts); hand-drawn art work stopped to wait for it.
- **Round 7 (spike)** rendered the plumber and the speedster from Tripo 3D models through a toon pipeline into sprite atlases, and gave both a clear twist of ours on top of the nod. The owner found the look rendered, not inked, and the parody off.
- **Round 8 (spike)** traced the renders into flat parts inked at runtime by the cast's own pen, pushed the proportions, built the plumber's plunger as a prop, keyed the poses the motion generator couldn't make from pose sheets, and added the blind silhouette read (Rendered kinds above).
- **Round 9** set the roster at twenty, the greatest game characters to parody, ranked on reach, the 20 px read, fit and rig: five in (the voxel miner, the spiky-haired mercenary, the sneaking soldier, the blue robot boy, the spiked turtle king), the bug knight to the reserves, and a nod, a twist, swaps and a concept prompt for every kind.
- **Round 10** drew the rendered kinds flat, from a game-size design and pose drawings, and took the cel pass's light bands off them: the 3D-traced kinds read rough, blobby and too detailed at play size (tools/art3d/README.md).
