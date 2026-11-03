# Characters: homages and animals

The runners are a cast of fourteen: ten homages to famous game characters in our own designs, and four plain animals for contrast. In the lore (DESIGN.md) they're the characters who never made the cut, from stray animals to knock-off heroes who almost got their own game. Each kind is a character design of its own, the way the barnyard party game's animals are: its own outline, its signature props, and a way of moving.

`pnpm shot cast` shoots the sheet: the 8-player lineup at play scale on farm and mine, the race start, deaths, a 3× close-up, the lobby cards, the "is it the homage?" sheet (`cast-recognise.png`), the silhouette test (`cast-silhouettes.png`) and the catalog of every kind (`--only catalog` for the last three). In the console, `slagDebug.cast` has `catalog()`, `silhouettes()`, `recognise()` and `bench()`.

## Decisions

From the owner (logged in [DECISIONS.md](DECISIONS.md) → Characters):

1. **Every character is a homage.** The lore makes the runners the knock-off heroes who almost got their own game, so the whole cast parodies famous game characters (see Roster). Until the art pipeline lands, four plain animals from round 5 are still in the game.
2. **Recognisability comes first.** A stranger should name each homage at a glance. For each one we list the three or four traits people actually know it by and make every one of them unmistakable at play scale.
3. **Homages, never copies.** Each is our own design, read from its silhouette and one or two signature props, never the original's exact design or its real name. Sound-alike names are data (`KIND_NAMES` in `src/gen/character.ts`) and appear nowhere else. Player characters may have faces and personas; parts and machines stay faceless (DESIGN.md → Parody).
4. **The iconic palette wins, and the player's color moves.** A homage keeps the colors it's known by (the plumber's red cap and blue overalls, the speedster's cobalt, the mouse's yellow). The player's color goes on a secondary but always-visible slot: a flat ring at its feet, no glow. A plain animal, or a homage that comes in every color anyway (the impostor crewmate, the puffball), is drawn in the player's color. Either way it's that player's HUD color, and with eight different kinds per lobby plus the ring, eight players stay told apart.
5. **Random roll only.** New Look rolls everything, the kind included. A lobby never seats two of the same kind (`Match.looksFree`).
6. **Saved looks re-roll once** whenever the cast changes what a seed means: `LOOK_CAST` in `src/ui/profile.ts` (now 6).
7. **Clean, light, hand-drawn.** A thin pen that varies along the line, in a dark of the body's own color; two or three flat tones per surface; one soft, hard-edged shadow shape; calm color; no glow.
8. **The roster is the twenty greatest characters to parody**, each with a clear twist of its own, because the homages had looked too much like the originals (Roster).

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
| plumber | the mustached plumber | red cap with a round white badge (our own mark, a little wrench, never the letter), big round nose, thick mustache, blue overalls with two gold buttons, white gloves, brown shoes; big head, stout | ring at the feet |
| hedgehog | the blue speedster | cobalt, spikes swept straight back, joined eyes with green irises, peach muzzle and belly, a one-sided grin, red sneakers with a white strap; runs leaning hard, spins in the air | ring |
| elf | the green-tunic elf hero | long green cap flopping back, pointed ear, blond fringe, flared green tunic with a belt, a kite shield and a sword hilt on the back | ring |
| hunter | the armored bounty hunter | orange armor, huge round red shoulder pads, a round helmet with a green visor, an arm cannon held out | ring |
| zapmouse | the yellow electric mouse | yellow, long ears with black tips, red cheeks, a lightning-bolt tail, brown back stripes | ring |
| impostor | the impostor crewmate | a bean on stubby legs, a wide pale visor standing proud, a backpack | body |
| puffball | the pink puffball | a ball on big red feet, stubby arms, tall eyes with a shine, blush; puffs up in the air | body |
| jelly | the jellyfish parasite | a translucent green dome, three red nuclei inside, four ivory fangs, a hovering bob | ring |
| goose | the goose up to no good | white, orange beak and feet, an S of a neck; on the run the honk pose, neck flat out and wings up | ring |
| engineer | the team shooter's engineer | yellow hard hat with dark goggles on it, a square jaw, a red or blue work shirt, khaki trousers, a leather glove, a huge wrench | ring |
| fox | — | long and low, snout out front, tall ears, bushy tail carried up | body |
| frog | — | crouched flat, two eye bumps; crouches and leaps | body |
| penguin | — | upright egg, pale front, flippers; waddles | body |
| chicken | — | tall and bottom-heavy on thin legs, red comb; struts | body |

**Is it the homage?** `cast-recognise.png` puts each kind close up beside "This is ___". As of this round, every homage reads as its caption to us: the plumber, speedster, elf, mouse, impostor, puffball, jelly and goose at once; the bounty hunter and the engineer a beat slower, because their reads lean on props (the shoulder pads and cannon, the hat and wrench) more than on a silhouette nobody else shares. The silhouette test still separates every kind, though the plumber and the hunter are the closest pair of stout shapes.

## Roster (all homages)

The cast this is heading to: **twenty kinds, the greatest game characters to parody**, every one a homage, because the lore makes the runners the characters who never made the cut, the knock-off heroes who almost got their own game. The ten homages from round 5 stay, and so do five of the six round-6 picks. The four plain animals (fox, frog, penguin, chicken) go.

This spec feeds the art pipeline (Rendered kinds below): a concept and a model sheet, a 3D model rigged and posed, traced into flat parts inked by the cast's own pen. Each entry is written to be used as prompt material, so it describes traits only and never names a real character. Every kind is our own design: it must read as the homage from its silhouette and props, never copy the original's exact design, and never carry its name or logo. Sound-alike names stay in data (`KIND_NAMES`). **The nod is the silhouette; the rest is ours.** A concept that looks like the original redrawn is rejected, however good it looks.

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
- **Player's color.** The kind's main costume colour, like a fighting game's alternate costumes: the region a stranger would name the character's colour by wears the player's colour, its shade cut from it, and the rest of the palette stays the roster's. Two players of one kind are told apart by it at a glance. A rendered kind marks that role `slot: "player"` in `sprite.json` and draws no ring. Nothing that a stranger reads as skin, eyes or a face takes it.
- **Faces.** Expressive eyes with highlights, and brows that react to running, jumping, falling and cheering.
- **The nod and the twist.** The nod is the three or four traits a stranger names it by, and each entry says why each one is needed. The twist is ours: a foundry, scrapyard or knock-off flavour, a changed signature prop, and one joke. A twist never moves or hides a trait the nod needs.
- **Swaps.** Small accessories inside the outline, rolled per look from `vary`: they never change the silhouette.
- **No letters or logos** on anything, at any scale: a badge carries a small mark of ours.

**The concept prompt.** Every entry ends with a prompt of traits only. Append the house style to each one:

> Clean hand-inked 2D game character, full body, facing right, standing on the ground. Flat colour in two or three tones per surface, a thin tapered outline in a dark of each part's own colour, one hard-edged shadow shape, calm colour, no gradients, no glow, no text or logos, plain white background. Proportions pushed so it reads at 20 pixels tall.

### The mustached plumber
- **Kind:** `plumber` · **Name:** Plumbo
- **A stranger should say:** "that's the plumber with the mustache."
- **Silhouette:** stout and big-headed, about 45% head. A round cap with its bill sticking out front, a big round nose that breaks the profile, and a huge plunger slung low across his back, its cup behind his shoulder so the cap, bill and nose own the head's outline.
- **Traits:** red cap with a riveted brass badge carrying a small wrench (never a letter); a big round nose; a thick dark-brown mustache; blue bib overalls over a red shirt; leather gauntlets; steel-toe boots.
- **Palette:** cap and shirt `#c9473f` (shade `#9c3530`); overalls `#3f62b4` (shade `#2e4a8c`); skin `#efc9a4`; mustache and hair `#4d3426`; badge `#c99a4a`; bolts `#9aa0a8`; gauntlets `#b08454`; boots `#6b4a35`; plunger cup `#b8433c` on a copper handle `#c27a45`.
- **Color slot:** costume: the cap and shirt (the overalls stay blue).
- **Gait:** a jaunty run with a bounce on every step and arms pumping; one fist high on the jump.
- **The nod:** the red cap with its bill out front (the first shape anyone names); the big round nose (it breaks the profile at 20 px, where no face detail survives); the thick mustache (the face, at any size); blue bib overalls over red (the colour block people know from across a room); the stout, big-headed build (it separates him from every slim hero).
- **Our twist:** a foundry hand, not a castle plumber. The joke is an absurdly big rubber plunger on a copper handle strapped to his back like a greatsword. Welding goggles on the cap, hex-bolt overall buttons, a patched knee, tan gauntlets for the white gloves.
- **Swaps:** a pencil behind the ear; a sticking plaster on one cheek; a roll of thread-seal tape on a belt loop; a pressure gauge in the bib pocket.
- **Rig:** humanoid. Rendered (round 2).
- **Concept prompt:** A stout, big-headed foundry handyman: a red cap with its bill out front, dark welding goggles strapped round it and a riveted brass badge stamped with a small wrench; a big round nose; a thick dark-brown mustache; blue bib overalls with steel hex-bolt buttons over a red shirt, one knee patched; big tan leather gauntlets; steel-toe boots. An absurdly big red rubber plunger on a copper handle is strapped across his back like a greatsword, slung low, its cup behind his shoulder.

### The blue speedster
- **Kind:** `hedgehog` · **Name:** Sanic
- **A stranger should say:** "the fast blue hedgehog."
- **Silhouette:** a big head with three or four long spikes swept straight back, a small body, thin legs, big shoes.
- **Traits:** cobalt quills swept back; green eyes; a peach muzzle and belly; a cocky one-sided grin; big red shoes with a strap.
- **Palette:** quills `#2f5bd0` (shade `#2346a6`); muzzle and belly `#f0c99c`; irises `#3a9a46`; shoes `#d8382f` (shade `#a8281f`); strap `#e8c24a`; toecaps `#9aa0a8`; gloves `#7a5236`; neckerchief `#e8c24a` and `#2a2a30`.
- **Color slot:** costume: the quills.
- **Gait:** runs leaning hard forward, legs a blur; curls into a spinning ball in the air.
- **The nod:** the cobalt quills swept straight back (they are the whole silhouette); the big red shoes (the second thing anyone draws); the peach muzzle and belly (they tell a hedgehog from a blue blob); green eyes and the cocky grin (the attitude); the forward-leaning run and the spin-ball jump (the speedster in motion, readable when the shape blurs).
- **Our twist:** a stubby scrapyard runner, chunky as a toy. Two separate eyes under heavy brows instead of the joined eye shape, a chipped tooth, soot-scorched quill tips, a hazard-striped neckerchief, brown fingerless gloves, red work high-tops with steel toecaps and a hazard-yellow strap.
- **Swaps:** a sticking plaster across the nose; a sweatband on one wrist; a ring-pull hanging off the neckerchief; one shoelace undone.
- **Rig:** humanoid; the spin ball keyed. Rendered (round 2).
- **Concept prompt:** A stubby, toy-chunky cobalt-blue hedgehog with long quills swept straight back, their tips soot-scorched; two separate green eyes under heavy brows; a peach muzzle and belly; a cocky one-sided grin with a chipped tooth; a hazard-striped neckerchief; brown fingerless leather gloves; big red work high-tops with steel toecaps and a hazard-yellow strap.

### The round dot-eater
- **Kind:** `chomper` · **Name:** Snack-Man
- **A stranger should say:** "the yellow ball that eats dots."
- **Silhouette:** a yellow circle with a wedge-shaped mouth cut into its front. The smallest kind, and the only one with no limbs.
- **Traits:** pure yellow; a wedge mouth that opens and shuts; one small eye above the mouth.
- **Palette:** body `#f6d02a` (shade `#cba214`); mouth interior `#2a1f1a`; eye `#14121a`; bite edge `#e8b81c`; napkin `#fbf6ee` with a check `#c9473f`.
- **Color slot:** costume.
- **Gait:** bounces along, chomping with every stride; spins once on the jump.
- **The nod:** the circle with a wedge cut out (the most recognised shape in games, and it needs nothing else); pure yellow (half the read); the chomp (it is a mouth, not a pie chart, only when it moves).
- **Our twist:** someone got to him first: a neat bite is missing from the back of his circle, the joke being that the eater got eaten. A checked napkin is tucked under the mouth like a bib.
- **Swaps:** a crumb on the lip; a toothpick in the corner of the mouth; a paper party hat; a fork-tine scratch.
- **Rig:** **keyed**, no limbs: the mouth open and shut, squash on landing, a spin. Low risk: two shapes.
- **Concept prompt:** A perfect yellow ball with a wedge-shaped mouth cut into its front, wide open, and one small black eye above it; a neat round bite missing from the back of the circle; a red-and-white checked napkin tucked under the mouth like a bib. No arms, no legs.

### The yellow electric mouse
- **Kind:** `zapmouse` · **Name:** Pikachew
- **A stranger should say:** "the yellow electric mouse."
- **Silhouette:** chubby and round, with two long pointed ears and a zigzag tail that breaks the outline behind.
- **Traits:** yellow; long ears tipped black; round red cheeks; a lightning-bolt tail; two brown stripes across the back; small black eyes with a white glint.
- **Palette:** body `#f2c62a` (shade `#c99c14`); ear tips `#2a1f1a`; cheeks `#e0473b`; stripes `#6b4a35`; tail `#c4c8ce` (shade `#8e9298`) with rivets `#6b6f76`; cord `#2a2a30`, plug `#d9d4c8`.
- **Color slot:** costume.
- **Gait:** a quick scamper on all fours at a run, ears streaming back.
- **The nod:** the long black-tipped ears (the outline, at any size); the zigzag tail (the one shape no other mouse has); the red cheeks (the face, at 20 px); the yellow (what everyone remembers first).
- **Our twist:** a scrapyard knock-off wired up by hand. The bolt tail is a zigzag cut from sheet tin and riveted on at the root; a frayed power cord is knotted round its middle like a belt, the plug dangling; one ear is bent and taped.
- **Swaps:** a chewed-through bit of cable in its paw; a sticking plaster on one ear; a spark-scorch on the tail tip; a fuse tucked behind an ear.
- **Rig:** **keyed**, quadruped: the scamper on all fours, the stand on two legs at idle.
- **Concept prompt:** A chubby, round yellow mouse with two long pointed ears tipped black, one ear bent and taped; round red cheeks; small black eyes with a white glint; two brown stripes across its back; a zigzag lightning-bolt tail cut from sheet tin and riveted on at the root; a frayed black power cord knotted round its middle like a belt, the plug dangling.

### The green-tunic elf hero
- **Kind:** `elf` · **Name:** Lonk
- **A stranger should say:** "the elf hero with the green cap."
- **Silhouette:** slim. A long green cap flopping back like a tail, a pointed ear sticking out, a tunic flared at the hem, and a round shield on the back.
- **Traits:** a long floppy green cap; blond fringe; a long pointed ear; a green tunic with a brown belt; a shield and a sword hilt on the back; brown boots.
- **Palette:** cap and tunic `#3f7a34` (shade `#2c5a25`); darn `#5a9a4a`; hair `#e6c25a`; skin `#efc9a4`; belt, boots and gloves `#6b4a35`; lid `#a8adb4` (shade `#7a7f86`); poker `#4a4a52`.
- **Color slot:** costume.
- **Gait:** strides out with the cap tip swinging; a forward somersault on the jump.
- **The nod:** the long green cap flopping back (the silhouette people draw); the pointed ear (it makes him an elf and not a gnome); the flared green tunic with its belt (the colour and the hero's cut); something to fight with on his back (a hero, not a shepherd).
- **Our twist:** a hero kitted out from the bins. The cap is a long green woolly sock with a darned heel; the shield is a dented dustbin lid with its handle; the sword is a fireplace poker.
- **Swaps:** a sprig of grass in the cap; a sticking plaster on the ear; a coil of string on the belt; a bottle cork on a cord.
- **Rig:** humanoid.
- **Concept prompt:** A slim young elf hero with a long pointed ear and a blond fringe, wearing a long green woolly sock as a floppy cap, its darned heel showing, flopping back behind his head; a green tunic flared at the hem with a brown belt; brown boots and gloves; a dented metal dustbin lid slung on his back as a shield and a fireplace poker in place of a sword.

### The pink puffball
- **Kind:** `puffball` · **Name:** Kurby
- **A stranger should say:** "the little pink puffball."
- **Silhouette:** a near-perfect ball on two big oval feet, with stubby round arms.
- **Traits:** tall oval eyes with a shine at the top; blush marks; a tiny mouth; big red feet.
- **Palette:** body is the player's color, pink by default; feet `#c9473f`, or one of two designed alternatives (`#e07b2c`, `#e8b23a`) rolled per look; eyes `#2a1f1a`; blush `rgba(232,96,120,0.55)`; seam the body's colour, inked; valve `#f4efe6`.
- **Color slot:** costume: the ball, its arms and its seam, because the original comes in every color.
- **Gait:** toddles on its big feet; puffs up round and floats in the air.
- **The nod:** the ball (the whole body); the big red feet (they make it a creature, and part it from the dot-eater); the tall oval eyes with a shine (the face); the blush (the sweetness).
- **Our twist:** a cheap vinyl squeeze toy. A moulding seam runs round its middle between the front and back halves, a squeaker valve pokes out high on its back (the one bump on the ball's outline), a mould number is stamped on the sole of one foot, and it squeaks when it lands.
- **Swaps:** a price sticker on its side; a scuff of shelf dust; a tiny bow; a bite mark from a dog.
- **Rig:** **keyed**: a ball with feet and stubs, the puff in the air. Rendered: the body is generated, not modelled (`tools/art3d/page/puffball.ts`), and the face kit's tall eyes and blush are set by its painted smile; the mould number never shows at play scale and is left off.
- **Concept prompt:** A near-perfect round ball creature on two big oval red feet, with stubby round arms; tall oval black eyes with a shine at the top, blush marks and a tiny mouth. It is a cheap vinyl squeeze toy: a moulding seam runs round its middle, a little white squeaker valve pokes out of its back, and a mould number is stamped under one foot.

### The voxel miner (new)
- **Kind:** `miner` · **Name:** Stove
- **A stranger should say:** "the blocky guy from the block-building game."
- **Silhouette:** every part a box: a cube head as wide as the body, a rectangular torso, square arms and legs, and a pickaxe. No curve anywhere, which no other kind has.
- **Traits:** a cube head with a flat square face; short square-cut brown hair; a cyan T-shirt; blue trousers; grey shoes; a square pickaxe.
- **Palette:** shirt `#3fb0b0` (shade `#2b8686`); trousers `#3d4fa8` (shade `#2c3a80`); skin `#c9946a` (shade `#a07250`); hair `#4a3020`; eyes `#f4efe6` and `#4a3cae`; shoes `#6b6b72`; wood grain a dark of each paint; pick head `#8e9298`, handle `#8a5c34`.
- **Color slot:** costume.
- **Gait:** stiff-limbed: arms and legs swing straight from the shoulder and hip with no bend, the head rocking; the pick swings on the jump.
- **The nod:** the cube head (the only square head in games anyone knows); the boxy, unbending limbs (it's the shape language, not a costume); cyan over blue (the outfit read across a room); the pickaxe (what he does).
- **Our twist:** a wooden toy knock-off. He's carved from wooden blocks with the grain showing on every face and a dowel peg at each joint; the paint is chipped at the corners; his pickaxe is a painted wooden toy with a price sticker still on it.
- **Swaps:** a square sticking plaster on the head; a block of turf under one arm; a chip out of one corner; a pencil-drawn tally on his arm.
- **Rig:** humanoid with stiff limbs (no elbow or knee bend). The easiest model in the set.
- **Concept prompt:** A blocky man made entirely of boxes, carved from wooden blocks: a cube head as wide as his body with a flat square face, square white-and-blue eyes and short square-cut brown hair; a cyan T-shirt, blue trousers and grey shoes painted on, the paint chipped at the corners, the wood grain showing on every face and a dowel peg at each joint. He holds a square painted wooden toy pickaxe with a price sticker on the handle.

### The impostor crewmate
- **Kind:** `impostor` · **Name:** Sussy
- **A stranger should say:** "the crewmate from the impostor game."
- **Silhouette:** a bean on two stubby legs, a wide visor standing proud of the front, and a pack behind.
- **Traits:** a smooth bean body; a pale-blue visor with a white glint; a backpack; no arms.
- **Palette:** body is the player's color; visor `#a9dbe8` (shade `#6aa6ba`); glint `#ffffff`; tape `#d9c79a`; can `#c9473f` (shade `#9c3530`) with cap `#e8c24a`.
- **Color slot:** body, because the original comes in every color.
- **Gait:** a waddling shuffle on its stubby legs.
- **The nod:** the bean on stubby legs (the whole silhouette); the wide pale visor (the face; without it it's a jelly bean); the pack on its back (it breaks the outline behind, and is half the bean's read in profile).
- **Our twist:** a crew issued from the scrapyard. The pack is a red jerrycan with a spout, strapped on; a crack across the visor is taped over; a dent in its side has been knocked out with a hammer.
- **Swaps:** a sprout growing from the head; a sticky note on the visor; a paper sailor hat; a bandage round one leg.
- **Rig:** **keyed**: two legs and a body, no arms.
- **Concept prompt:** A smooth bean-shaped spacesuit body on two stubby legs, no arms; a wide pale-blue visor with a white glint standing proud of its front, a crack across it taped over; a red jerrycan with a yellow-capped spout strapped to its back as a backpack; a hammered-out dent in its side.

### The necktie ape (new)
- **Kind:** `ape` · **Name:** Dankey Kang
- **A stranger should say:** "the big ape with the red tie."
- **Silhouette:** hunched, with huge shoulders and long arms, a small head low and forward, and a protruding muzzle.
- **Traits:** brown fur; a tan face, muzzle and chest; a red necktie; big knuckles.
- **Palette:** fur `#7a4e2c` (shade `#5a3820`); face and chest `#e2b98a`; tie `#d03a30` (shade `#a02a22`) with a clip `#c9ccd2`; tape `#9aa0a8`; banana `#f2d04a`.
- **Color slot:** costume.
- **Gait:** knuckle-gallops on all fours at a run, arms leading; beats its chest on a cheer.
- **The nod:** the hunched gorilla shape with arms longer than its legs (the brute, from across the screen); the red necktie (the one thing that makes it this ape and not any ape); the tan face and muzzle (the cartoon face).
- **Our twist:** a foundry barrel-hauler on his lunch break. The tie is a clip-on, worn crooked on a bare chest; his knuckles are wrapped in grey duct tape; a banana is tucked behind one ear like a pencil.
- **Swaps:** a hard-hat sticker on the chest; a sweat drop; a staple-gun ID badge on the tie; a bruise on one knuckle.
- **Rig:** humanoid; the knuckle gallop is keyed by hand.
- **Concept prompt:** A big hunched cartoon gorilla with huge shoulders, arms longer than its legs and a small head set low and forward; brown fur; a tan face, protruding muzzle and chest; a red clip-on necktie worn crooked on its bare chest; knuckles wrapped in grey duct tape; a banana tucked behind one ear like a pencil.

### The spiky-haired mercenary (new)
- **Kind:** `merc` · **Name:** Clod
- **A stranger should say:** "the spiky-haired guy with the giant sword."
- **Silhouette:** a crown of big blond spikes and a blade as tall as he is, held low and trailing behind at a run, its point on the floor at idle as he leans on it. Slim, one big shoulder piece. The blade is always in hand, never strapped to his back (the plumber's plunger owns that).
- **Traits:** spiky blond hair; a sleeveless dark knit top; baggy dark trousers; two belts crossed at the hip; one metal shoulder piece; heavy boots; a huge, broad blade.
- **Palette:** hair `#f0d470` (shade `#c9a84a`); top `#3a3f5c` (shade `#2a2e44`); trousers `#4a4060`; belts and boots `#6b4a35`; pauldron `#9aa0a8`; skin `#f0cfa8`; eyes `#6ec8e0`; blade `#c9ccd2` (shade `#8e9298`), teeth `#a8adb4`; handle `#7a5232`.
- **Color slot:** costume.
- **Gait:** a low, loping run with the blade dragging behind; a spinning slash on the jump; at idle he leans on the blade with one hand.
- **The nod:** the spiky blond hair (the head shape, sharper than the speedster's quills and pointing up); the blade bigger than he is (the read: no other character carries one); the single big shoulder piece and the slim dark outfit (the brooding mercenary).
- **Our twist:** the legendary oversized blade is a giant serrated bread knife with a riveted wooden handle. His shoulder piece is a hubcap, and the spikes of his hair are singed at the tips.
- **Swaps:** a crumb on the blade; a sticking plaster on the cheek; a grey feather in the belt; a price sticker on the hubcap.
- **Rig:** humanoid; the blade a prop on the hand bone, sized as caricature like the plumber's plunger.
- **Concept prompt:** A slim brooding young mercenary with a crown of big spiky blond hair singed at the tips and pale blue eyes; a sleeveless dark knit top, baggy dark trousers, two brown belts crossed at the hip, heavy boots; a car hubcap strapped on as a single shoulder piece. He grips a giant serrated bread knife as tall as he is, with a riveted wooden handle, its point resting on the ground.

### The spiked turtle king (new)
- **Kind:** `king` · **Name:** Browser
- **A stranger should say:** "the big spiky turtle king."
- **Silhouette:** the bulkiest kind: a hulking upright turtle with a spiked shell humped behind, two horns, a wild mane, a big jaw, and spiked cuffs. It fills the envelope's width.
- **Traits:** a green shell with a cream rim and spikes; yellow-orange skin; a pale banded belly; two cream horns; a red-orange mane and brows; spiked black cuffs; a toothy snout.
- **Palette:** shell `#3f8a3a` (shade `#2c6a2a`); rim, spikes and horns `#efe2c0` (shade `#c9b890`); bolts `#9aa0a8`; skin `#e8b23c` (shade `#bb8a1c`); belly `#e9d29a`; mane `#d9502e`; cuffs `#2a2a30`; crown `#f0cf4a`.
- **Color slot:** costume.
- **Gait:** a heavy stomp, shoulders rolling; on a long fall he tucks into his shell and spins.
- **The nod:** the spiked shell (it breaks the outline behind and above; the read in profile); the horns and the red mane (they mark the king and not a foot soldier); the hulking upright build (the boss in a cast of heroes).
- **Our twist:** a knock-off boss who never got his castle. His shell is riveted boiler plate with the spikes welded-on bolts; a paper party crown sits between his horns; when he's angry a puff of soot comes out of his nostrils instead of fire.
- **Swaps:** a dented spike; a party blower in his teeth; a sticking plaster on the snout; a chain cuff for a spiked one.
- **Rig:** humanoid; the shell a prop on the spine. Medium risk: a big body inside the shared envelope.
- **Concept prompt:** A hulking upright turtle king with yellow-orange skin, a big toothy snout, a pale banded belly, two cream horns and a wild red-orange mane; his green shell, humped behind him, is made of riveted boiler plate, with welded-on steel bolts for spikes round a cream rim; black spiked cuffs on his wrists; a paper party crown between his horns; a small puff of soot from his nostrils.

### The green saddled dino (new)
- **Kind:** `dino` · **Name:** Yoshee
- **A stranger should say:** "the green dinosaur with the saddle."
- **Silhouette:** upright, with a big round snout well out in front, eyes high on top of the head, a short tail, a saddle on its back, and big boots.
- **Traits:** green skin; a bulbous round snout; a white belly and cheeks; a red saddle; orange spikes down the back of the head; red boots; big eyes on top of the head.
- **Palette:** skin `#4cbf4a` (shade `#35913a`); belly and cheeks `#f6f2e8`; saddle `#d8382f` (shade `#a8281f`) with a chrome stem `#c9ccd2`; spikes `#e8853a`; wellies `#d8442f` (shade `#a83222`).
- **Color slot:** costume.
- **Gait:** a happy trot, head bobbing; on the jump, legs paddling in the air.
- **The nod:** the big round snout out front (the profile); the eyes on top of the head (the face, from the side); the saddle (it says "ridden by a hero" without the hero); green with a white belly and red boots (the colour block).
- **Our twist:** a hand-me-down mount. The saddle is a red bicycle seat strapped on with a belt, its chrome stem sticking out; the boots are red rubber wellies; it has a spotted egg of its own in a carrier bag.
- **Swaps:** a bike bell on the belt; a reflector on the tail; a sticking plaster on the snout; a dangling price tag on one welly.
- **Rig:** humanoid with a tail.
- **Concept prompt:** A cheerful upright green dinosaur with a big round bulbous snout well out in front, big eyes set high on top of its head, a white belly and cheeks, orange spikes down the back of its head and a short tail; a red bicycle seat strapped on its back with a belt as a saddle, its chrome stem sticking out; red rubber wellington boots; a spotted egg in a carrier bag hanging from one hand.

### The blue robot boy (new)
- **Kind:** `robot` · **Name:** Meh Man
- **A stranger should say:** "the little blue robot with the arm cannon."
- **Silhouette:** small and boyish: a round helmet with round ear discs, big chunky boots, and one forearm that ends in a cylinder cannon held out. Smaller than the hunter, with no shoulders to speak of.
- **Traits:** a blue helmet with a light-blue stripe and round ear discs; a face in the helmet's opening; a light-blue suit; darker blue gloves and boots; the arm cannon.
- **Palette:** helmet, gloves and boots `#2a5fc4` (shade `#1e4592`); suit and stripe `#4fb8ec` (shade `#3a8cbc`); skin `#f3d0aa`; eyes `#2a5fc4`; can `#c9ccd2` with a label `#d8382f` and `#f4efe6`; battery `#2a2a30` with a band `#c99a4a`.
- **Color slot:** costume.
- **Gait:** a bouncy run on the big boots; the cannon arm up and out on the jump.
- **The nod:** the round helmet with ear discs (the head nobody else has); the two blues (the robot read from across a room); the big boots on a small body (the proportions); the arm cannon (what he does).
- **Our twist:** a robot boy from the parts bin. His cannon is a tin can with both ends cut out, its label still on; a big battery is strapped to his back; one boot was repainted a shade off.
- **Swaps:** a dent in the helmet; a screw loose on the ear disc; a strip of tape on a knee; a little puff of steam from the cannon.
- **Rig:** humanoid; the can a prop on the forearm.
- **Concept prompt:** A small, boyish blue robot with a round helmet carrying a light-blue stripe and round ear discs, a cheerful face in the helmet opening, a light-blue suit, darker blue gloves and big chunky boots, one boot repainted a slightly different blue. One forearm ends in an arm cannon that is a tin can with both ends cut out and its red-and-white label still on; a big battery is strapped to his back.

### The sneaking soldier (new)
- **Kind:** `sneak` · **Name:** Snek
- **A stranger should say:** "the soldier hiding in a cardboard box."
- **Silhouette:** a cardboard box on two legs, with a bandana's long tails streaming out of a hand-hole. At idle the box drops over him, one eye in a slot; on the jump his head pops out, bandana and all.
- **Traits:** a cardboard box worn over the body; a head with a dark bandana and long tails; a grey-blue sneaking suit; a stubble jaw; boots.
- **Palette:** box `#c49a62` (shade `#9a7444`); tape `#d9c79a`; arrow `#2a1f1a`; suit `#4d5a66` (shade `#36414c`); bandana `#3a4a5c` with stripes `#f4efe6`; skin `#d9b08c`; hair and stubble `#4a3a2c`; boots `#2a2a30`.
- **Color slot:** costume.
- **Gait:** a fast, crouched shuffle with the box bobbing; freezes for a beat on landing, as if nobody saw.
- **The nod:** the box (the joke everyone knows him by, and the only box with legs in the cast); the bandana with long tails (the soldier inside, at 20 px); the low, crouched sneak (the stealth read in motion).
- **Our twist:** the box is badly made for the job. Its "this way up" arrow points down, it's patched with packing tape, and the eye slot is cut with a kitchen knife; his bandana is a striped tea towel.
- **Swaps:** a sticker of ours on the box; a fragile-glass icon; a string handle; a coffee ring stain.
- **Rig:** humanoid; the box a prop on the spine. Medium risk: the box and the pop-out are keyed.
- **Concept prompt:** A gruff stubble-jawed soldier in a grey-blue sneaking suit and boots, crouched and running inside a cardboard box worn over his body, only his legs showing below it; his head pokes out of a hand-hole wearing a striped tea towel tied as a bandana with long tails streaming behind. The box is patched with packing tape, its printed "this way up" arrow pointing down, a rough eye slot cut in its side.

### The cup-headed toon (new)
- **Kind:** `cuptoon` · **Name:** Mughead
- **A stranger should say:** "the cartoon guy with a cup for a head."
- **Silhouette:** a white cup for a head with a handle on the side and a striped straw sticking up out of the top; a small rubber-hose body.
- **Traits:** a cup head with liquid at the rim; a striped straw; pie-cut black eyes; a small red nose; white gloves; red shorts; brown shoes; drawn in a 1930s cartoon spirit.
- **Palette:** mug `#f4efe6` (shade `#cfc6b8`) with chips `#2a3a5c` and a blue rim `#3a5a8c`; tea `#8a5a3a`; tag `#e8c24a`; straw `#d8382f` and `#fbf6ee`; eyes `#14121a`; nose `#d8382f`; shorts `#c9473f`; gloves `#fbf6ee`; shoes `#6b4a35`.
- **Color slot:** costume.
- **Gait:** a bouncy rubber-hose strut with arms swinging in loops; the straw wobbles.
- **The nod:** the cup head with its handle (the one head nobody else has); the striped straw (it breaks the top of the outline); pie-cut eyes, rubber-hose limbs and a red nose (the 1930s cartoon read, which is half the joke); red shorts and white gloves (the toon costume).
- **Our twist:** a camping mug, not fine china: white enamel with a blue rim and black chips where it's been dropped; a paper straw going soggy and bent; a tea-bag string hanging over the rim with its tag.
- **Swaps:** a sugar cube on the rim; a steam curl; a sticking plaster on a chip; a biscuit in one glove.
- **Rig:** humanoid. Medium risk: rubber-hose limbs bend in arcs, not at elbows, so the run and cheer are keyed.
- **Concept prompt:** A 1930s rubber-hose cartoon character whose head is a white enamel camping mug with a blue rim, black chips where it's been dropped, a handle on its side and tea at the rim; a red-and-white striped paper straw bent and going soggy sticks up from the top, and a tea-bag string with its yellow tag hangs over the rim; pie-cut black eyes, a small red nose, white gloves, red shorts and brown shoes on noodle limbs.

### The armored bounty hunter
- **Kind:** `hunter` · **Name:** Sammus
- **A stranger should say:** "the bounty hunter in the orange power suit."
- **Silhouette:** a round helmet, two huge round shoulder pads wider than the body, a narrow waist, chunky legs, and an arm cannon held out front. Taller and broader than the robot boy.
- **Traits:** orange armor; red spherical shoulder pads; a green visor across the helmet; an arm cannon; green lights on the chest.
- **Palette:** armor `#d9661f` (shade `#a84b14`); shoulders `#c9473f` with stripes `#f4efe6`; visor `#2f7a3c` with glint `#9fe08a`; drainpipe `#8e9298` (shade `#5c5852`); lights `#7fd06a`; waist `#4a4a52`.
- **Color slot:** costume.
- **Gait:** heavy, steady strides; raises the cannon on the jump; tucks into a ball on a long fall.
- **The nod:** the two huge round shoulder pads (the silhouette: nobody else is wider at the top); the orange with red (the suit, from across a room); the green visor (the face); the arm cannon (the hunter, and the ball tuck says the rest).
- **Our twist:** a power suit welded together in the scrapyard. The torso is a cut-down water heater, the shoulder pads are two red-and-white fishing buoys, the arm cannon is a length of drainpipe with an elbow joint, and the visor is green bottle glass.
- **Swaps:** a rope coiled at the waist; a hand-painted stencil of ours on a buoy; a hazard sticker on the drainpipe; a dent in the helmet.
- **Rig:** humanoid; the ball tuck keyed.
- **Concept prompt:** A bounty hunter in a power suit welded together from scrap: an orange suit whose torso is a cut-down water heater, two huge round red-and-white fishing buoys as shoulder pads wider than the body, a round helmet with a green bottle-glass visor, green lights on the chest, a narrow dark waist and chunky legs. One arm ends in a cannon made from a length of grey drainpipe with an elbow joint, held out front.

### The team shooter's engineer
- **Kind:** `engineer` · **Name:** Engie
- **A stranger should say:** "the engineer with the hard hat and the wrench."
- **Silhouette:** stocky, with a square jaw, a domed hard hat with a wide brim, and a huge wrench over the shoulder.
- **Traits:** a yellow hard hat; dark goggles strapped around it; a square jaw; a red or blue work shirt; khaki trousers with a belt; a leather work glove; a huge wrench.
- **Palette:** bowl `#e9b730` (shade `#bb8a1c`); goggles `#3a4246` with lenses `#5fb0c8`; shirt `#b8433c` or `#3f62a8`; trousers `#8c7a58`; belt `#6b4a35`; glove `#a8794a`; wrench `#8e8a84` (shade `#5c5852`); broom handle `#c49a62`; skin `#efc9a4`.
- **Color slot:** costume.
- **Gait:** trudges, heavy-stepped, the wrench swinging.
- **The nod:** the domed hard hat with goggles on it (the head shape and the trade); the square jaw (the gruff Texan, at 20 px); the huge wrench over the shoulder (the read in profile); the work shirt and khakis (the colour block).
- **Our twist:** a backyard engineer. The hard hat is an upturned yellow mixing bowl with a chin strap, the goggles are swimming goggles, and the wrench is a giant adjustable spanner taped to a broom handle; a kid's toy turret is clipped to his belt.
- **Swaps:** a pencil behind the ear; a tape measure on the belt; a toothpick; a grease smear on the cheek.
- **Rig:** humanoid.
- **Concept prompt:** A stocky, square-jawed engineer with a yellow mixing bowl worn upside down as a hard hat with a chin strap, swimming goggles pushed up on it, a red work shirt, khaki trousers with a belt and one leather work glove; a giant adjustable spanner taped to a broom handle rests over his shoulder, and a small kid's toy turret is clipped to his belt.

### The goose up to no good
- **Kind:** `goose` · **Name:** Honkers
- **A stranger should say:** "the troublemaking goose."
- **Silhouette:** a long body, an S-shaped neck and a tail tipped up. On the run it takes the honk pose: neck thrust out flat, wings flung up.
- **Traits:** white feathers; an orange beak and webbed feet; a small black eye; the honk with its beak wide open.
- **Palette:** body `#f3f0ea` (shade `#bdb5a8`); beak and feet `#d9894a` (shade `#a35f2b`); eye `#2a1f1a`; vest `#e8d23a` with stripes `#c9ccd2`.
- **Color slot:** costume.
- **Gait:** a waddle; when running, the honk charge with neck out and wings up.
- **The nod:** the S of a neck (the goose, not a duck or a chicken); white with an orange beak and feet (the farmyard goose); the honk pose with wings flung up (the troublemaker, which is the whole character).
- **Our twist:** a site goose. It wears a stolen hi-vis vest put on back to front, and always has something nicked in its beak: whatever the roll gives (see Swaps).
- **Swaps** (the loot in its beak): a spanner; a plunger cup; a single sock; a rubber duck.
- **Rig:** **keyed**, bird: the waddle, the honk charge, the wing flap on the jump.
- **Concept prompt:** A mischievous white farmyard goose with a long S-shaped neck, a tail tipped up, an orange beak and orange webbed feet and a small black eye; it wears a stolen yellow hi-vis vest on back to front and holds a stolen spanner in its beak.

### The barnyard party game's horse (new)
- **Kind:** `horse` · **Name:** Hoarse
- **A stranger should say:** "the horse from the chicken-horse game."
- **Silhouette:** upright on two legs, with a long head and muzzle out in front, two upright ears, a mane down the neck, and a tail behind.
- **Traits:** a brown coat; a dark mane and tail; a pale muzzle with nostrils; hooves; a goofy grin.
- **Palette:** coat `#9a6a40` (shade `#734e2e`); mane and tail `#3a2a20`; muzzle `#e6cfae`; hooves `#2a1f1a`; zip `#c9ccd2`; scarf `#c9473f` and `#f4efe6`.
- **Color slot:** costume.
- **Gait:** a high-stepping prance, mane bouncing; kicks its heels on the jump.
- **The nod:** the long muzzle out front and the upright ears (the horse, in profile); standing on two legs (the party game's horse, not a farm horse); the goofy grin (its personality).
- **Our twist:** it's a costume. A zip runs up its belly, the head is a size too big for the neck, and it's lost its voice: a knitted scarf wound round its throat.
- **Swaps:** a lozenge tin in one hoof; a hand-sewn patch; a party horn; a sticking plaster on the muzzle.
- **Rig:** humanoid with a long head. Medium risk: the big head must stay inside the envelope.
- **Concept prompt:** A goofy upright cartoon horse standing on two legs, with a long head and muzzle out in front, two upright ears, a pale muzzle with nostrils, a dark mane and tail and a big grin; it is clearly a costume, with a zip running up its brown belly and a head a size too big for its neck, and a red-and-white knitted scarf wound round its throat.

### The jellyfish parasite
- **Kind:** `jelly` · **Name:** Meltroid
- **A stranger should say:** "the floating jellyfish thing from the space game."
- **Silhouette:** a translucent dome with four fangs hooked underneath; it floats and never touches the floor.
- **Traits:** a see-through green membrane; three red nuclei inside it; a pale rim; four ivory fangs.
- **Palette:** membrane `#9ee38a` at 60% opacity; cherries `#c9473f` (shade `#9c3530`); rim `#d8f2c8`; fangs `#efe6d2` (shade `#c8bba0`); doily `#fbf6ee`; mint `#4ca04a`.
- **Color slot:** costume.
- **Gait:** hovers with a slow bob and chomps its fangs, faster when moving.
- **The nod:** the translucent green dome (the only see-through body in the cast); the three red nuclei (they make it this parasite, not a jellyfish); the four fangs hooked underneath (the menace); floating (it never walks).
- **Our twist:** a lime jelly dessert that got ideas. The dome wobbles like set gelatine, the nuclei are three glacé cherries, the fangs are sugared almonds, and a paper doily is stuck to its underside.
- **Swaps:** a cocktail umbrella stuck in the top; a sprig of mint; a spoon-dent; a wafer fan.
- **Rig:** **keyed**, no limbs: the bob, the wobble and the chomp. Highest risk: the translucent dome needs its own glass pass through the tracer.
- **Concept prompt:** A floating translucent lime-green jelly dome that wobbles like set gelatine, with three glacé cherries suspended inside it like nuclei, a pale rim, and four ivory sugared-almond fangs hooked underneath; a paper doily stuck to its underside. It hovers above the ground and never touches it.

### Production order

The strongest reads first. **Keyed** marks the non-humanoids, the riskiest: their poses are keyed by hand from the pose sheet, which is fine but costs more.

| # | Kind | Name | Rig | Risk |
|---|---|---|---|---|
| 1 | plumber | Plumbo | humanoid | done (round 2) |
| 2 | hedgehog | Sanic | humanoid, spin keyed | done (round 2) |
| 3 | chomper | Snack-Man | **keyed**, no limbs | low: two shapes and a chomp |
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
| 19 | horse | Hoarse | humanoid, long head | medium |
| 20 | jelly | Meltroid | **keyed**, no limbs | high: translucency |

The hunter and the engineer sit late although they're easy to rig: their hand-drawn versions read a beat slower than the rest, so they gain least from going first.

**What to check.** No two kinds may rhyme. Watch these pairs:

- **The puffball and the dot-eater:** feet, arms and a mouth against a wedge and no limbs.
- **The goose and the horse:** two farmyard homages, but white versus brown and an S-neck versus a long muzzle.
- **The hunter and the robot boy:** both carry an arm cannon. The hunter is bigger, orange and wider at the shoulders than anywhere; the robot boy is small and blue with a round helmet and ear discs.
- **The speedster and the robot boy:** both blue. Quills swept back against a round helmet.
- **The miner and the sneaking soldier:** both boxy. A cube head on a body with arms against one box on two legs.
- **The ape and the turtle king:** the two brutes. Hunched, brown and long-armed against upright, green-shelled, spiked and horned.
- **The mercenary and the plumber:** both carry a huge prop. The plunger is strapped to the plumber's back; the blade is always in the mercenary's hand, trailing low or leaning on the floor.
- **The mercenary and the elf:** both carry a blade, but a poker on the elf's back against a blade bigger than the mercenary.
- **The crewmate and the sneaking soldier:** both a body on two stubby legs. A rounded bean with a visor against a square box with an eye slot.

Every kind must also pass the silhouette sheet, the blind read and the "is it the homage?" sheet before it ships.

## Rendered kinds (spike)

How a Roster entry becomes a kind drawn from 3D. The entry is the one source for the design (nod, twist, swaps, palette); this is the pipeline. The plumber and the speedster are done, behind `?sprites=1` (`slagDebug.sprites.use(true)`); without it the game loads and draws only the hand-drawn cast. Production steps and the done list: [tools/art3d](../tools/art3d/README.md) and its [checklist](../tools/art3d/CHECKLIST.md).

- **Sheets first:** a concept, a model sheet pushed for a 20 px read, and a pose sheet. Tripo models, rigs and animates the model sheet; poses its motions can't make are keyed by hand from the pose sheet; a jump that is a shape of its own (the spin ball) is generated as one.
- **The game's own hand.** The render is cut into flat parts, traced into a few clean curves, and inked at draw time by the cast's `contour` and `toned`, with the boil on threes. Outlines are resampled from a fixed start and held across frames when a part only moved, so lines move only with the boil.
- **The cast's face** is drawn on the traced eyes (or set by the nose when the model's are too small): whites, iris and glint, brows set into the run, wide on a fall, squinting on a cheer, crossed out on a death.
- **Caricature is a setting:** bone scales (head, hands, feet), `girth` (drawn wider than the model), region roles that split a trait from its colour so it can be drawn bigger (the plumber's cap and nose), and props built from primitives (the plunger).
- **Swaps** are the entry's accessories, each an on/off prop rolled from the character's `vary`, rendered in a pass of its own so it can't change the silhouette.
- **Cost.** About 0.005 ms per runner drawn from the frame-bitmap cache (the hand-drawn cast takes about 0.08–0.1), and about 0.4 ms for a frame the first time it's drawn at a scale. Frame data is about 350–400 KB per kind, a chunk fetched only with the flag on.
- **Checks:** `tests/sprite-cast.test.ts` (every clip, the shared hitbox box pen and all, at least 18 px tall, rolls), and `pnpm shot sprites --kind K` (the comparison sheets, the six-rolls lobby, the draw cost, and `sprites-blind.png`, every kind as a shuffled, unnamed play-scale silhouette for fresh readers).

**Blind reads so far** (fresh readers, silhouettes only): the speedster is named every time, medium-high to high. The plumber went from low to split (one reader "the plumber, medium", one unsure) after his cap, nose and girth were pushed and his plunger carried lower; in colour he reads at once. With the cup above his head the cup and the cap merged into one shape, so the plunger is carried low for good (owner, 2026-11-02).

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

Add the id to `CAST`, its sound-alike name to `KIND_NAMES` and its own colors to `PAINTS` (`src/gen/character.ts`), and a `KindArt` to `KINDS` (`src/render/cast/kinds.ts`): an outline inked as curves facing right, the three or four traits people recognise, a gait, a face, the player's color on the body or a `ring`, and the parts it breaks into. Add its caption to `READS_AS` in `src/render/cast/sheet.ts`. Then run `pnpm shot cast` and look at `cast-recognise.png` and `cast-silhouettes.png`: if a stranger wouldn't name it, or its silhouette could be mistaken for another kind's, it isn't done. A new kind changes which kind every seed rolls, so bump `LOOK_CAST` with it.

## History

- **Phase 1** proposed three directions; the owner picked foundry toys.
- **Rounds 1–3** built the toys and the hand-authored outline, gait and silhouette-test system.
- **Round 4** swapped the toys for animals and a few parody critters, drawn lighter.
- **Round 5** made the cast mostly homages, put recognisability first (iconic palettes, the player's color on a ring), and raised the craft: proportions, reacting faces, pose outlines, a card-scale rim tone.
- **Round 6** wrote the all-homage roster as prompt material for the art pipeline (generated concept, traced into rigged vector parts); hand-drawn art work stopped to wait for it.
- **Round 7 (spike)** rendered the plumber and the speedster from Tripo 3D models through a toon pipeline into sprite atlases, and gave both a clear twist of ours on top of the nod. The owner found the look rendered, not inked, and the parody off.
- **Round 8 (spike)** traced the renders into flat parts inked at runtime by the cast's own pen, pushed the proportions, built the plumber's plunger as a prop, keyed the poses the motion generator couldn't make from pose sheets, and added the blind silhouette read (Rendered kinds above).
- **Round 9** set the roster at twenty, the greatest game characters to parody, ranked on reach, the 20 px read, fit and rig: five in (the voxel miner, the spiky-haired mercenary, the sneaking soldier, the blue robot boy, the spiked turtle king), the bug knight to the reserves, and a nod, a twist, swaps and a concept prompt for every kind.
