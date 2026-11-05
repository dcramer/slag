# Characters: homages and animals

The runners are a cast of fifteen: eleven homages to famous game characters in our own designs, and four plain animals for contrast. In the lore (DESIGN.md) they're the characters who never made the cut, from stray animals to knock-off heroes who almost got their own game. Each kind is a character design of its own, the way the barnyard party game's animals are: its own outline, its signature props, and a way of moving.

`pnpm shot cast` shoots the sheet: the 8-player lineup at play scale on farm and mine, the race start, deaths, a 3× close-up, the lobby cards, the "is it the homage?" sheet (`cast-recognise.png`), the silhouette test (`cast-silhouettes.png`) and the catalog of every kind (`--only catalog` for the last three). In the console, `slagDebug.cast` has `catalog()`, `silhouettes()`, `recognise()` and `bench()`.

## Decisions

From the owner (logged in [DECISIONS.md](DECISIONS.md) → Characters):

1. **Every character is a homage.** The lore makes the runners the knock-off heroes who almost got their own game, so the whole cast parodies famous game characters (see Roster). The four plain animals from round 5 left the cast when the last nine homages came in (2026-11-04).
2. **Recognisability comes first.** A stranger should name each homage at a glance. For each one we list the three or four traits people actually know it by and make every one of them unmistakable at play scale.
3. **Homages, never copies.** Each is our own design, read from its silhouette and one or two signature props, never the original's exact design or its real name. Sound-alike names are data (`KIND_NAMES` in `src/gen/character.ts`) and appear nowhere else. Player characters may have faces and personas; parts and machines stay faceless (DESIGN.md → Parody).
4. **A neutral palette, and the colour is the player's.** Each kind's own colours are neutrals: skin, eyes, hair, metal, wood, bone, cloth greys and the ink. Nearly every coloured part takes the player's colour: the costume in it, every other coloured part in a lighter or darker tone of it (the plumber's cap and overalls, the engineer's hat and shirt). The shape carries the read, not the original's hues. It's that player's HUD color, and with eight different kinds per lobby, eight players stay told apart. (Owner, 2026-11-04; before, a homage kept its iconic hues and the player's colour went on one costume region.)
5. **Random roll only.** New Look rolls everything, the kind included. A lobby never seats two of the same kind (`Match.looksFree`).
6. **Saved looks re-roll once** whenever the cast changes what a seed means: `LOOK_CAST` in `src/ui/profile.ts` (now 7).
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
| plumber | the mustached plumber | a cap with its bill out front and a round badge (our own mark, a little wrench, never the letter), big round nose, thick mustache, bib overalls over the shirt with two buttons, gauntlets, boots; big head, stout | costume: cap and shirt; overalls and plunger cup a dark of it |
| hedgehog | the blue speedster | spikes swept straight back, joined eyes with green irises, peach muzzle and belly, a one-sided grin, big sneakers with a pale strap; runs leaning hard, spins in the air | costume: the quills; sneakers and neckerchief darks of it |
| elf | the green-tunic elf hero | long cap flopping back, pointed ear, blond fringe, flared tunic with a belt, a shield and a sword hilt on the back | costume: cap and tunic; the darned toe a light of it |
| hunter | the armored bounty hunter | tall and long-legged, huge round shoulder pads wider than anything else, a helmet with a wide visor band, the forearm a cannon held straight out from the shoulder; tucks into a ball | costume: the suit, the buoys a dark of it, the cannon a light |
| zapmouse | the yellow electric mouse | yellow, long ears with black tips, red cheeks, a lightning-bolt tail | costume: the fur; the cheeks keep their red (a face mark), the tin tail and the cord are neutral |
| impostor | the impostor crewmate | a bean on stubby legs, a wide pale visor standing proud, a backpack | costume: the bean, and the pack a dark of it |
| puffball | the pink puffball | a ball on big feet, stubby arms, tall eyes with a shine, blush; puffs up in the air | costume: the ball, and the feet a dark of it |
| jelly | the jellyfish parasite | a dome, three nuclei inside, four fangs under it (two big ones a pincer), a hovering bob | costume: the dome, the nuclei and rim in tones of it |
| goose | the goose up to no good | white, a tan beak and feet, an S of a neck; on the run the honk pose, neck flat out and wings up | costume: the vest; the beak and feet a neutral tan |
| engineer | the team shooter's engineer | tall and square with a small head; a hard rectangular toolbox in one hand and a huge wrench held low in the other, a dome hard hat with a rim all round and goggles on it, a square jaw, a work shirt, khaki trousers, leather gloves | costume: the shirt, the hat and toolbox in tones of it |
| chomper | the round dot-eater | a circle with a wedge mouth that chomps, one small eye, a scalloped bite out of its back, a linen napkin tucked into its lower lip | costume: the whole ball |
| miner | the voxel miner | a cube head as wide as the body, square stiff limbs, a taped toy pickaxe; carved from wood | costume: the shirt, the trousers a dark of it |
| ape | the necktie ape | hunched, long arms, a necktie | costume: the fur, the tie a shade of it |
| merc | the spiky-haired mercenary | a crown of big blond spikes singed at the tips, a giant serrated bread knife always in hand, a hubcap on one shoulder | costume: the top, the trousers a dark of it |
| king | the spiked turtle king | side on, a smooth shell dome on his back with its cream rim and three big spikes along its top, a big horned head out front with an open crocodile jaw, a swept-back mane, a paper crown, a heavy low stance | costume: the skin; the shell and mane darks of it, the crown a light |
| dino | the green saddled dino | a huge round snout out front, eyes on top of the head, white belly and cheeks, a torn black bicycle seat strapped low on its back, a long tail straight out behind, wellies, a carrier bag with its own spotted egg | costume: the skin (the head spikes a light of it, the wellies a dark) |
| robot | the blue robot boy | a big round helmet with a ridge down it and an ear disc standing proud, the pale face in a grey rim in its opening, a small light suit in a wide stance on huge flared boots, the forearm a thick taped tin can held out level; small | costume: helmet, mitten and near boot; the suit and ridge a light tone, the far boot a shade off, the can and ear disc darks |
| sneak | the sneaking soldier | side on, a square cardboard box on two crouched legs, his eyes in a slot, a striped bandana's two tails out of a hand-hole behind | costume: the box (its back end, tape, arrow and bandana tones of it) |
| cuptoon | the cup-headed toon | a white enamel mug for a head, its handle out the back and a straw bent over out of the tea, black rubber-hose limbs, white gloves, high-waisted shorts, big round shoes | costume: the shorts |
| horse | the barnyard party game's horse | on all four legs, side on: a long neck with the mane standing up along it as a crest, a long blunt head with a pale nose and buck teeth, a long straight tail hanging to the heels, flat hooves; a scarf and a zip (a costume) | costume: the coat, the far legs and the scarf darks of it |
| rapper | the rapping paper puppy | paper-thin, a flat cut-out with an edge: a tall knit beanie, long floppy ears under it, a round nose, a baggy tee and shorts, big trainers, a microphone | costume: the beanie and tee, the shorts a dark of it |
| limbless | the limbless hero | no arms or legs: white gloves and big shoes floating clear of a small round body, a big nose, a spiky hair tuft standing up, a neckerchief | costume: the top, the shoes a tone of it |
| worm | the worm in the super suit | a bulky suit with huge shoulders, a worm's head on a long bendy neck rising out of the collar with bulging eyes, a big chunky pistol in one hand | costume: the suit, the boots and gloves a dark of it |
| dragon | the little purple dragon | small, on four legs: horns swept back, stubby wings, a pale belly, a tail ending in an arrowhead | costume: the scales, the wings a light of it |
| hopper | the snouted cube hopper | a round ball on two big feet, no arms, big eyes, a long tube snout sticking straight out front; hops | costume: the ball, the snout a tone of it |

**Is it the homage?** `cast-recognise.png` puts each kind close up beside "This is ___", in its roster colour. Every sheet waits for the rendered kinds' frames (`slagDebug.sprites.ready()`), so it shows what ships; before 2026-11-02 the catalog, recognise and silhouette sheets drew those kinds hand-drawn, so the reads below were judged on the old bodies. As of this round, every homage reads as its caption to us: the plumber, speedster, elf, mouse, impostor, puffball, jelly and goose at once; the bounty hunter and the engineer a beat slower, because their reads lean on props (the shoulder pads and cannon, the hat and wrench) more than on a silhouette nobody else shares. The silhouette test still separates every kind, though the plumber and the hunter are the closest pair of stout shapes.

## Roster (all homages)

The cast this is heading to: **twenty kinds, the greatest game characters to parody**, every one a homage, because the lore makes the runners the characters who never made the cut, the knock-off heroes who almost got their own game. The ten homages from round 5 stay, and so do five of the six round-6 picks. The four plain animals (fox, frog, penguin, chicken) go. Round 10 (owner, 2026-11-04) adds five retro picks past the twenty: the rapping paper puppy, the limbless hero, the worm in the super suit, the little purple dragon and the snouted cube hopper.

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

### The mustached plumber
- **Kind:** `plumber` · **Name:** Plumbo
- **A stranger should say:** "that's the plumber with the mustache."
- **Silhouette:** stout and big-headed, about 45% head. A round cap with its bill sticking out front, a big round nose that breaks the profile, and a huge plunger slung low across his back, its cup behind his shoulder so the cap, bill and nose own the head's outline.
- **Traits:** red cap with a riveted brass badge carrying a small wrench (never a letter); a big round nose; a thick dark-brown mustache; bib overalls over a shirt, a dark of its colour; leather gauntlets; steel-toe boots.
- **Palette:** cap and shirt the player's colour (roster `#c9473f`); their shade and the plunger cup 22 darker (the cup since owner 2026-11-03); the overalls and their knee patch 20 darker, so the bib still reads as its own block over the shirt (darker, on a dark ground the bib and the boots sank into one mass); skin `#efc9a4`; mustache, hair and boots `#5e412d`; bolts and goggles `#8e8a84`; gauntlets `#b08454` (shade `#7f5c39`); copper handle `#a65f38`.
- **Color slot:** costume: the cap and shirt, and in tones of it the overalls and the cup (owner, 2026-11-04: the overalls were blue).
- **Gait:** a jaunty run with a bounce on every step and arms pumping; one fist high on the jump.
- **The nod:** the red cap with its bill out front (the first shape anyone names); the big round nose (it breaks the profile at 20 px, where no face detail survives); the thick mustache (the face, at any size); bib overalls over the shirt (the colour block people know from across a room, now a dark over a light of the player's colour); the stout, big-headed build (it separates him from every slim hero).
- **Our twist:** a foundry hand, not a castle plumber. The joke is an absurdly big rubber plunger on a copper handle strapped to his back like a greatsword. Welding goggles on the cap, hex-bolt overall buttons, a patched knee, tan gauntlets for the white gloves.
- **Swaps:** a pencil behind the ear; a sticking plaster on one cheek; a roll of thread-seal tape on a belt loop; a pressure gauge in the bib pocket.
- **Palette alts:** the gauntlets in tan leather `#b08454`, pale canvas `#cdc4b2` (the original's white gloves, as work gloves) or dark leather `#76583f`, each with its shade. The overalls' colourways (denim, grey work cloth, washed denim) went with the neutral palette (2026-11-04). The knee patch is the overalls' own cloth, outlined: in the shirt's tone it was a fleck on the leg at every step.
- **Idles and cheers:** the idle from the model; arms folded, chest out, breathing. The fist-pump cheer; leaning back laughing, turned to us.
- **Gait range:** a jaunty bounce of 0.15–0.85 px on each step, a lean of up to 0.035.
- **Wear:** scuffed is a faded patch on the bib and one on a thigh, pale scuffs on both boot toes; scorched is two soot streaks down the bib, one on the sleeve, one on the gauntlet and the far boot's toe.
- **Rig:** drawn flat (2026-11-03): a new game-size design worn with welding goggles on the cap, a cracked bill, a knotted strap, a knee patch and a bent, taped plunger (the first designs read as the original redrawn); eleven poses.
- **Concept prompt:** A stout, big-headed foundry handyman: a red cap with its bill out front, dark welding goggles strapped round it and a riveted brass badge stamped with a small wrench; a big round nose; a thick dark-brown mustache; blue bib overalls with steel hex-bolt buttons over a red shirt, one knee patched; big tan leather gauntlets; steel-toe boots. An absurdly big red rubber plunger on a copper handle is strapped across his back like a greatsword, slung low, its cup behind his shoulder.

### The blue speedster
- **Kind:** `hedgehog` · **Name:** Sanic
- **A stranger should say:** "the fast blue hedgehog."
- **Silhouette:** a big head with three or four long spikes swept straight back, a small body, thin legs, big shoes.
- **Traits:** cobalt quills swept back; green eyes; a peach muzzle and belly; a cocky one-sided grin; big red shoes with a strap.
- **Palette:** quills the player's colour (`#2f5bd0` on the sheets), the taped quill with them; sneakers a dark of it (tone −22); neckerchief a dark of it (tone −15), drawn as one clean cloth (a light of it was the muzzle's peach on an orange hedgehog); muzzle and belly `#f0c99c`; irises `#3a9a46`; strap `#ebe5d6`; toecaps `#9a9894`; sole `#4c4236`; gloves `#7a5236`.
- **Color slot:** costume: the quills; the sneakers and the neckerchief are darks of it.
- **Gait:** runs leaning hard forward, legs a blur; curls into a spinning ball in the air.
- **The nod:** the cobalt quills swept straight back (they are the whole silhouette); the big red shoes (the second thing anyone draws); the peach muzzle and belly (they tell a hedgehog from a blue blob); green eyes and the cocky grin (the attitude); the forward-leaning run and the spin-ball jump (the speedster in motion, readable when the shape blurs).
- **Our twist:** a stubby scrapyard runner, chunky as a toy. Two separate eyes under heavy brows instead of the joined eye shape, a chipped tooth, soot-scorched quill tips, a hazard-striped neckerchief, brown fingerless gloves, red work high-tops with steel toecaps and a hazard-yellow strap.
- **Swaps:** a sticking plaster across the nose; a sweatband on one wrist; a ring-pull hanging off the neckerchief; one shoelace undone.
- **Palette alts:** the gloves in brown `#7a5236`, black `#45403c` or tan `#a8794a` leather (the shoes are the player's now).
- **Idles and cheers:** the idle from the model; arms folded, tapping one toe. The model's cheer, and its later both-fists-up stretch.
- **Gait range:** a bounce of up to 0.45 px and a lean of 0.01–0.06 on top of the hard forward lean he already runs with.
- **Wear:** scuffed is a scuff on the belly; scorched is a scorch there, and soot on the quill tips in every look (two marks or a strong tone on the belly read as a rash).
- **Rig:** drawn flat (2026-11-03), from the round-2 concept as the reference (without it the image model drew the original's joined eyes): a taped quill stump, scorched tips, a torn neckerchief and a flapping sole; the jump a looping spin ball, with no face. The irises are a role of their own: as the ink, the face kit put its eyes on a quill's soot. The neckerchief's hazard stripes fold into its cloth: at play size they were a dark mottle across the chest, never stripes; its knot, stripes in shade wrapped in thick ink, is the line's (`ink: 19`), or it was a black blob behind the neck. The strap is told from the neckerchief, one yellow in the drawing, by where it is (`recolour`). The taped quill is drawn in the quills' colour with its wrap lines: grey, it was a lump behind the head. The face's stray white and dark specks (a gap by the glove, scraps of the grin) fold away (`min`). The stretch was redrawn with its eyes open (shut, the kit had nothing to ride).
- **Concept prompt:** A stubby, toy-chunky cobalt-blue hedgehog with long quills swept straight back, their tips soot-scorched; two separate green eyes under heavy brows; a peach muzzle and belly; a cocky one-sided grin with a chipped tooth; a hazard-striped neckerchief; brown fingerless leather gloves; big red work high-tops with steel toecaps and a hazard-yellow strap.

### The round dot-eater
- **Kind:** `chomper` · **Name:** Snack-Man
- **A stranger should say:** "the yellow ball that eats dots."
- **Silhouette:** a yellow circle with a wedge-shaped mouth cut into its front. The smallest kind, and the only one with no limbs.
- **Traits:** pure yellow; a wedge mouth that opens and shuts; one small eye above the mouth.
- **Palette:** body the player's colour (`#f6d02a` on the sheets), its bitten edge with it; eye `#14121a`; tape `#9aa0a8`; plaster `#e9d3b0`; napkin one flat linen, `#f2ede2` (its check drawn flat was a rash, and a coloured wash took a colour of its own off the player's).
- **Color slot:** costume: the whole ball, its bitten edge with it. The napkin is a neutral linen.
- **Gait:** bounces along, chomping with every stride; spins once on the jump.
- **The nod:** the circle with a wedge cut out (the most recognised shape in games, and it needs nothing else); pure yellow (half the read); the chomp (it is a mouth, not a pie chart, only when it moves).
- **Our twist:** someone got to him first: a neat bite is missing from the back of his circle, the joke being that the eater got eaten. A checked napkin is tucked under the mouth like a bib.
- **Swaps:** a crumb on the lip; a toothpick in the corner of the mouth; a fork-tine scratch. (A paper party hat would break the outline, so it isn't one.)
- **Palette alts:** the napkin in white `#f2ede2`, bone `#e0d2b6` or grey `#c8cac6` linen.
- **Idles and cheers:** the breathing idle with a chomp at nothing; the mouth snapping shut and open again. The hop on the spot; tipped back, mouth thrown wide, laughing.
- **Gait range:** up to 0.7 px of extra bounce on each hop, a lean of up to 0.04.
- **Wear:** scuffed is two pale scuffs and two crumbs stuck low on the back; scorched is two soot streaks up the back and the napkin's tip singed.
- **Rig:** none: drawn flat (2026-11-03), its open mouth cut out of the figure so the wedge is a gap, worn with a taped crack across the top, a chipped lip and a torn napkin drawn flat (its gingham traced as white dashes on a coloured wedge, a rash at play size; the crown's crack isn't drawn, a stray tick by the mouth): the mouth open and shut on the walk and run, a hop, an alarmed fall (its wall slide too), and the pancake death.
- **Concept prompt:** A perfect yellow ball with a wedge-shaped mouth cut into its front, wide open, and one small black eye above it; a neat round bite missing from the back of the circle; a red-and-white checked napkin tucked under the mouth like a bib. No arms, no legs.

### The yellow electric mouse
- **Kind:** `zapmouse` · **Name:** Pikachew
- **A stranger should say:** "the yellow electric mouse."
- **Silhouette:** chubby and round, with two long pointed ears and a zigzag tail that breaks the outline behind.
- **Traits:** yellow; long ears tipped black; round red cheeks; a lightning-bolt tail; small black eyes with a white glint.
- **Palette:** fur the player's colour (`#f2c62a` in the roster); ear tips the ink `#2a1f1a`; cheeks `#e0473b`, a face mark; tail tin `#a9afb7`; tape `#c9c6bd`; cord brown `#7a5236`, slate `#4b5560` or taupe `#857a6e`, with its plug in steel `#7c848d`, pale grey `#b3aa9b` or black plastic `#5a5e66`. The drawing's back stripes fold into the fur.
- **Color slot:** costume: the fur (body, head, arms, legs; the `fur` role). Everything else is neutral: the ear tips, the tin tail, the tape, the cord and its plug; the cheeks keep their warm red as a face mark.
- **Gait:** a quick scamper, ears streaming back: upright since it was drawn flat (2026-11-03); the 3D one ran on all fours.
- **The nod:** the long black-tipped ears (the outline, at any size); the zigzag tail (the one shape no other mouse has); the red cheeks (the face, at 20 px); the yellow (what everyone remembers first).
- **Our twist:** a scrapyard knock-off wired up by hand. The bolt tail is a zigzag cut from sheet tin and riveted on at the root; a frayed power cord is knotted round its middle like a belt, the plug dangling; one ear is bent and taped.
- **Swaps:** a chewed-through bit of cable in its paw; a sticking plaster on one ear; a spark-scorch on the tail tip; a fuse tucked behind an ear.
- **Rig:** drawn flat (2026-11-03): the worn design (the shorter ear bent and taped, a dented head, a bent tin tail) upright in every pose; the cord belt in brown, slate or taupe, the plug steel, pale grey or black (2026-11-04, Decisions 4: before, a rust cord and an orange plug); a tape cross on the crown.
- **Concept prompt:** A chubby, round yellow mouse with two long pointed ears tipped black, one ear bent and taped; round red cheeks; small black eyes with a white glint; two brown stripes across its back; a zigzag lightning-bolt tail cut from sheet tin and riveted on at the root; a frayed black power cord knotted round its middle like a belt, the plug dangling.

### The green-tunic elf hero
- **Kind:** `elf` · **Name:** Lonk
- **A stranger should say:** "the elf hero with the green cap."
- **Silhouette:** slim. A long green cap flopping back like a tail, a pointed ear sticking out, a tunic flared at the hem, and a round shield on the back.
- **Traits:** a long floppy green cap; blond fringe; a long pointed ear; a green tunic with a brown belt; a shield and a sword hilt on the back; brown boots.
- **Palette:** cap and tunic the player's colour (roster `#3f7a34`); the darned toe 18 lighter; hair `#e6c25a`; skin `#efc9a4`; belt, boots and gloves `#6b4a35`; lid galvanised `#a8adb4`, black plastic `#5a5e66` or white enamel `#d2ccc0` (a recycling-blue lid went with the neutral palette, 2026-11-04); poker `#4a4a52`.
- **Color slot:** costume: the sock cap and the tunic.
- **Gait:** strides out with the cap tip swinging; a forward somersault on the jump.
- **The nod:** the long green cap flopping back (the silhouette people draw); the pointed ear (it makes him an elf and not a gnome); the flared green tunic with its belt (the colour and the hero's cut); something to fight with on his back (a hero, not a shepherd).
- **Our twist:** a hero kitted out from the bins. The cap is a long green woolly sock with a darned toe; the shield is a dented dustbin lid with its handle; the sword is a fireplace poker.
- **Swaps:** a sprig of grass in the cap; a cross of sticking plaster on the crown; a coil of string on the belt; a bottle cork on a cord.
- **Rig:** drawn flat (2026-11-03): the sock cap's toe darned, the lid dented and holed, the poker bent, the hem torn; his falls lost the cap, so one jump drawing is his whole air. Both cheers are drawn with his eyes open, so the face kit has eyes to find: the lid held up overhead sat on his head like a cap and hid the hood, so the second cheer holds it out to the side. The lid's handle and dents are no lines (a stroke under 6 px), which at play size were black squiggles on it. His eyes are kit-sized at 0.65: bigger, the two shut arcs of a cheer or a blink ran together into one black bar. What the painted-over drawn eyes leave (a rim the traced speck misses) is drawn as skin, or it showed as a black eye under the cheer's arcs.
- **Concept prompt:** A slim young elf hero with a long pointed ear and a blond fringe, wearing a long green woolly sock as a floppy cap, its darned heel showing, flopping back behind his head; a green tunic flared at the hem with a brown belt; brown boots and gloves; a dented metal dustbin lid slung on his back as a shield and a fireplace poker in place of a sword.

### The pink puffball
- **Kind:** `puffball` · **Name:** Kurby
- **A stranger should say:** "the little pink puffball."
- **Silhouette:** a near-perfect ball on two big oval feet, with stubby round arms.
- **Traits:** tall oval eyes with a shine at the top; blush marks; a tiny mouth; big feet.
- **Palette:** body is the player's color, pink by default; feet a dark of it (tone −18), the toe scuffed through a step lighter (−8); eyes `#2a1f1a`; blush `#ec7a94`; seam and valve folded into the ball; plaster fabric `#e9d3b0`, gauze `#f1ede4` or grey tape `#b9bcbf`.
- **Color slot:** costume: the ball, its arms and its seam, because the original comes in every color; the feet in a dark of it.
- **Gait:** toddles on its big feet; puffs up round and floats in the air.
- **The nod:** the ball (the whole body); the big feet, darker than the ball (they make it a creature, and part it from the dot-eater); the tall oval eyes with a shine (the face); the blush (the sweetness).
- **Our twist:** a cheap vinyl squeeze toy. A moulding seam runs round its middle between the front and back halves, a squeaker valve pokes out high on its back (the one bump on the ball's outline), a mould number is stamped on the sole of one foot, and it squeaks when it lands.
- **Swaps:** a price sticker on its side; a scuff of shelf dust; a tiny bow; a bite mark from a dog.
- **Palette alts:** the plaster in fabric tan `#e9d3b0`, gauze `#f1ede4` or grey tape `#b9bcbf`. The feet were red, orange or yellow until 2026-11-04 (Decisions 4).
- **Idles and cheers:** the idle's sway of the arms; looking up, arms behind it, tapping one toe. Both arms up, eyes shut; puffed up round, waving one arm.
- **Gait range:** a toddle's bounce of 0.1–0.8 px on each step, a lean of up to 0.03.
- **Wear:** scuffed is a shelf-worn toy: two pale scuffs on the ball, grime on the near toe, and a kid's marker X low on its side; scorched is soot on the ball's side and front, the near arm and the near toe.
- **Rig:** drawn flat (2026-11-03): a bent valve, a bitten arm and a toe scuffed pale, a step lighter than the shoe and darker than the ball (in its cream padding it was the farm's ground and read as a hole); the valve in its own cream (as the eyes' white it went to the ink, a dark knot on the crown); the blush one solid pink (see-through, it went grey on a green or teal ball); its seam and its tape cross aren't drawn (at play size one read as a mouth, the other as a third eye, and the cross's last specks of ink as a second face).
- **Concept prompt:** A near-perfect round ball creature on two big oval red feet, with stubby round arms; tall oval black eyes with a shine at the top, blush marks and a tiny mouth. It is a cheap vinyl squeeze toy: a moulding seam runs round its middle, a little white squeaker valve pokes out of its back, and a mould number is stamped under one foot.

### The voxel miner
- **Kind:** `miner` · **Name:** Stove
- **A stranger should say:** "the blocky guy from the block-building game."
- **Silhouette:** every part a box: a cube head as wide as the body, a rectangular torso, square arms and legs, and a pickaxe. No curve anywhere, which no other kind has.
- **Traits:** a cube head with a flat square face; short square-cut brown hair; a cyan T-shirt; blue trousers; grey shoes; a square pickaxe.
- **Palette:** shirt `#3fb0b0`, the player's; trousers a dark of it (tone −22); skin bare birch `#e8c89c`, the cube's side face a darker grain `#c49a6c`, the flaked corner `#f2dcb8`; hair `#4a3020`; irises `#4a3cae`; shoes, pick head and tape one grey `#8a8c92`; handle `#8a5c34`. The birch is paler than the roster's `#c9946a`: in it a yellow or orange shirt ran into the face.
- **Color slot:** costume: the shirt, the trousers a dark of it (Decisions 4).
- **Gait:** stiff-limbed: arms and legs swing straight from the shoulder and hip with no bend, a small hop and almost no lean; the pick goes up on the jump.
- **Palette alts:** the hair in dark brown `#4a3020`, chestnut `#6b4426` or ash `#5c5650`.
- **Idles and cheers:** the idle from the model; standing to attention, feet together, the pick upright by his shoulder. The pick thrust up high, the free arm out behind; tipped back on his heel laughing.
- **Gait range:** a bounce of 0.1–0.55 px on each step, a lean of up to 0.02.
- **Wear:** scuffed is a faded patch on the shirt and one on the trousers; scorched is soot on each.
- **The nod:** the cube head (the only square head in games anyone knows); the boxy, unbending limbs (it's the shape language, not a costume); cyan over blue (the outfit read across a room); the pickaxe (what he does).
- **Our twist:** a wooden toy knock-off. He's carved from wooden blocks with the grain showing on every face and a dowel peg at each joint; the paint is chipped at the corners; his pickaxe is a painted wooden toy with a price sticker still on it.
- **Swaps:** a square sticking plaster on the head; a block of turf under one arm; a chip out of one corner; a pencil-drawn tally on his arm.
- **Rig:** drawn flat (2026-11-04): worn with a flaked shirt corner showing bare wood, a taped, cracked handle and a snapped pick point (the edit's chip out of the crown sat mid-crown and read as two ears, so it was filled back in by hand). Traced with no corner cutting (`map.smooth: 0`): rounded like every other kind, the cube head was a ball under a mop of hair. The image model's walk drawings came back as the design again, so every pose is the design's own blocks turned about their joints, the way a wooden toy moves (`art/sprites/miner/design.prompt.txt`). A raised arm goes out behind him and a raised pick slides up beside his head: over the cube's side face an arm read as a hand on the brow, and a pick turned up behind the cube as a horn. Blind read (two fresh readers): "blocky miner, high: square head and body, and a pickaxe raised in one hand"; "medium: square blocky head and boxy body, swinging a pickaxe or hammer".
- **Concept prompt:** A blocky man made entirely of boxes, carved from wooden blocks: a cube head as wide as his body with a flat square face, square white-and-blue eyes and short square-cut brown hair; a cyan T-shirt, blue trousers and grey shoes painted on, the paint chipped at the corners, the wood grain showing on every face and a dowel peg at each joint. He holds a square painted wooden toy pickaxe with a price sticker on the handle.

### The impostor crewmate
- **Kind:** `impostor` · **Name:** Sussy
- **A stranger should say:** "the crewmate from the impostor game."
- **Silhouette:** a bean on two stubby legs, a wide visor standing proud of the front, and a pack behind.
- **Traits:** a smooth bean body; a pale-blue visor; a backpack; no arms.
- **Palette:** body is the player's color; the can a dark of it (tone −16); visor `#a9dbe8` (shade `#6aa6ba`), a neutral pale glass; tape `#d3d8dc` (silver duct tape: in the strap's pale tan it was the farm's own colour, and read as a notch cut in the visor; in brown packing tape, a brow); strap `#d9c79a`; the sticky note `#f4e38a`.
- **Color slot:** body, because the original comes in every color, and the pack in a dark of it.
- **Gait:** a waddling shuffle on its stubby legs.
- **The nod:** the bean on stubby legs (the whole silhouette); the wide pale visor (the face; without it it's a jelly bean); the pack on its back (it breaks the outline behind, and is half the bean's read in profile).
- **Our twist:** a crew issued from the scrapyard. The pack is a jerrycan with a spout, strapped on; a crack across the visor is taped over; a dent in its side has been knocked out with a hammer.
- **Swaps:** a sprout growing from the head; a sticky note on the visor; a paper sailor hat; a bandage round one leg.
- **Palette alts:** the strap in tan webbing `#d9c79a`, grey webbing `#b4b9bf` or bone `#ece4d2`. The jerrycan was fuel red, olive or steel until 2026-11-04 (Decisions 4).
- **Rig:** drawn flat (2026-11-03), side on: a tape strip across the visor's crack, a hammered dent in its side, a crumpled can and a bent spout; ten poses drawn, and a second idle cut from the design rocked back on its heel (the image model held the bean to the design's stance). No face kit: the visor is drawn as it is. The first round failed the blind read as "a squarish blob": the can stood as tall as the bean and fused with its back, and the visor sat inside the outline. In the design the visor was moved out past the front and the can moved back off the bean onto a short strap, by hand, and the poses copied both. The can's handle hole is cut through, and its spout's white loop folded into the can: white like the visor's glint, they read as an eye on the pack. The visor is blank glass: the crack is painted out of the drawings and the glint folded into the glass, since the crack's zigzag read as a frown and the small white glint, inked round, as an eye.
- **Concept prompt:** A smooth bean-shaped spacesuit body on two stubby legs, no arms; a wide pale-blue visor with a white glint standing proud of its front, a crack across it taped over; a red jerrycan with a yellow-capped spout strapped to its back as a backpack; a hammered-out dent in its side.

### The necktie ape (new)
- **Kind:** `ape` · **Name:** Dankey Kang
- **A stranger should say:** "the big ape with the red tie."
- **Silhouette:** hunched, with huge shoulders and long arms, a small head low and forward, and a protruding muzzle.
- **Traits:** brown fur; a tan face, muzzle and chest; a red necktie; big knuckles.
- **Palette:** the fur in the player's colour (drawn `#7a4e2c`), the tie a shade of it (tone −10); the rest neutral: face and chest `#e2b98a`, tape `#9aa0a8`, ink. The banana is a light of the fur (tone +30, 2026-11-04): the fixed yellow it had broke the neutral palette and vanished on yellow apes.
- **Color slot:** costume: the fur, and the tie in a shade of it. A darker tie (tone −18), on the pale chest right under the muzzle, read as a gaping mouth; a lighter one sank into the chest on the orange and yellow swatches.
- **Palette alts:** the duct tape in grey `#9aa0a8`, a pale cloth tape `#b8b2a4` or a dark gaffer `#6f757c`.
- **Gait:** knuckle-gallops on all fours at a run, arms leading; beats its chest on a cheer.
- **Idles and cheers:** the idle hunched on his knuckles; scratching his crown, bored. Beating his chest with a roar; both fists thrown up with a grin.
- **Gait range:** a bounce of 0.1–0.6 px and a lean of up to 0.03.
- **Wear:** drawn in, the tie torn ragged at the tip, the tape on one fist come loose and trailing, the banana half peeled. Scuffed is a faded patch on the shoulder and one on the far arm; scorched, soot in the same places.
- **The nod:** the hunched gorilla shape with arms longer than its legs (the brute, from across the screen); the red necktie (the one thing that makes it this ape and not any ape); the tan face and muzzle (the cartoon face).
- **Our twist:** a foundry barrel-hauler on his lunch break. The tie is a clip-on, worn crooked on a bare chest; his knuckles are wrapped in grey duct tape; a banana is tucked behind one ear like a pencil.
- **Swaps:** a hard-hat sticker on the chest; a sweat drop; a staple-gun ID badge on the tie; a bruise on one knuckle. Drawn flat he rolls a sticking plaster across the cheek, the strip the flat route draws; the others need marks it has no slot for.
- **Rig:** drawn flat (2026-11-04): a game-size design (two drawn, the one with the clearer tie and tape picked) worn with the torn tie, the trailing tape and the peeled banana; the eleven poses drawn three to a 16:9 sheet and cut apart (`art/sprites/ape/design.prompt.txt`). Walk and run are on all fours, the run a knuckle gallop (the arms reaching, then the legs swinging through). The air clip is centred and drawn a little smaller: his fists raised over his head left the shared box. His small eyes, tight under the brow, are found in the role map with a thin ink cut (`ink: 5`); the half-shut, shut and passing eyes of three poses were dotted in by hand for the face kit to find. Blind read: both fresh readers name him at medium ("hunched gorilla with a big back, long arms, knuckle-walking run").
- **Concept prompt:** A big hunched cartoon gorilla with huge shoulders, arms longer than its legs and a small head set low and forward; brown fur; a tan face, protruding muzzle and chest; a red clip-on necktie worn crooked on its bare chest; knuckles wrapped in grey duct tape; a banana tucked behind one ear like a pencil.

### The spiky-haired mercenary (new)
- **Kind:** `merc` · **Name:** Clod
- **A stranger should say:** "the spiky-haired guy with the giant sword."
- **Silhouette:** a crown of big blond spikes and a blade as tall as he is, held low and trailing behind at a run, its point on the floor at idle as he leans on it. Slim, one big shoulder piece. The blade is always in hand, never strapped to his back (the plumber's plunger owns that).
- **Traits:** spiky blond hair; a sleeveless dark knit top; baggy dark trousers; two belts crossed at the hip; one metal shoulder piece; heavy boots; a huge, broad blade.
- **Palette:** the sleeveless knit top in the player's colour (drawn `#4a5ab0`), the trousers a dark of it (tone −24); the rest neutral: hair `#f0d470`, its singed tips `#3e3834`; belts, boots and the knife's handle `#6b4a35`; hubcap `#9aa0a8`; blade `#c9ccd2`; skin `#f0cfa8`; eyes `#4fa8c8`.
- **Color slot:** costume: the top, and the trousers in a dark of it.
- **Palette alts:** the hubcap in chrome `#9aa0a8`, gunmetal `#6b7078` or a gold-painted cap `#b8a070`.
- **Gait:** a low, loping run with the blade dragging behind; a spinning slash on the jump; at idle he leans on the blade with one hand.
- **The nod:** the spiky blond hair (the head shape, sharper than the speedster's quills and pointing up); the blade bigger than he is (the read: no other character carries one); the single big shoulder piece and the slim dark outfit (the brooding mercenary).
- **Our twist:** the legendary oversized blade is a giant serrated bread knife with a riveted wooden handle. His shoulder piece is a hubcap, and the spikes of his hair are singed at the tips.
- **Swaps:** a crumb on the blade; a sticking plaster on the cheek; a grey feather in the belt; a price sticker on the hubcap.
- **Rig:** drawn flat (2026-11-04): a game-size design worn with the hubcap, a notch snapped out of the saw edge, singed spike tips and a torn shin (the designs drew no hubcap, so the wear edit added it), then edited twice more: at the design's size, two fresh readers saw only "a thin figure with pointed ears or spiky hair and a long thin blade" (unsure twice), so the spikes are twice as big, out to both sides, and the knife stands as tall as he is without his hair, and he is drawn 24 px tall. Two more fresh readers name him then, both at medium: "spiky-haired swordsman… tall spiky hair, slim body, long blade upright beside him". Eleven poses, drawn three to an image and cut apart. The knife is a `loose` role, left out of his size, and stays tip-down beside him or trailing behind, never raised over the spikes; drawn across his shins on the run it merged with his legs, so it trails behind his hip. His air and wall slide are drawn a little smaller (`scale`), or the spikes over a raised arm left the box. The singed tips are a role of their own: as ink or the boots' brown, every tip had specks. His eyes come from the role map with a lower `ink`, or the sheets' small pupils traced as lines.
- **Concept prompt:** A slim brooding young mercenary with a crown of big spiky blond hair singed at the tips and pale blue eyes; a sleeveless dark knit top, baggy dark trousers, two brown belts crossed at the hip, heavy boots; a car hubcap strapped on as a single shoulder piece. He grips a giant serrated bread knife as tall as he is, with a riveted wooden handle, its point resting on the ground.

### The spiked turtle king
- **Kind:** `king` · **Name:** Browser
- **A stranger should say:** "the big spiky turtle king."
- **Silhouette:** the bulkiest kind, seen side on and carried by two shapes: behind, a smooth shell dome from his shoulders to his hips with its cream rim standing out at the bottom and only three big spikes along its top (one bent); in front, a big horned head reaching forward on a thick neck, its long blunt snout out past his fists and its heavy jaw open, so the jaw is a notch in the outline. A thick tail and wide-planted legs under the dome. Spikes all round, a tufted mane, studded cuffs, a spiked tail and a many-pointed crown each broke the outline, and readers saw a porcupine; in a three-quarter view the head sat inside one round mass with the shell.
- **Traits:** a smooth shell dome with a cream rim and three big cream spikes; skin the player's colour; a pale banded belly; two long cream horns; a mane and brows swept back; an open jaw with white fangs; clawed feet; a thick tail.
- **Palette:** skin the player's colour (2026-11-04: it is most of him, and in a fixed gold every king was the same king); the shell a dark of it (tone −22), the mane darker (−36), the paper crown a light (+26); rim, spikes, horns and fangs `#efe2c0`; patch plate `#9aa0a8`; belly `#e9d29a`; the inside of the jaw `#9a3d36`. The cuffs went with the side-on design, which hides them behind his fists.
- **Color slot:** costume: the skin. The shell, mane and crown are tones of it; rim, spikes, horns, belly and plate are his own.
- **Gait:** a heavy stomp, shoulders rolling; on a fall near its top speed he tucks into his shell.
- **The nod:** the turtle shell seen as a shell, a smooth dome with its rim and a few big spikes on top (the read behind him, and what tells it from a hedgehog's quills); the big horned head with its open jaw out front (the king and not a foot soldier, and the read in front); the heavy, wide, low stance and the plated belly (the boss in a cast of heroes, upright against the ape's hunch).
- **Our twist:** a knock-off boss who never got his castle. A riveted grey patch plate is bolted onto his shell, a chunk is broken out of its rim, and a paper party crown sits crooked between his horns. The soot puff from his nostrils is left out: anything dark under the face reads as a mouth at play size.
- **Swaps:** a sticking plaster on the snout.
- **Palette alts:** the patch plate in steel `#9aa0a8`, black iron `#5d6168` or tin `#bdb6a6`.
- **Idles and cheers:** the idle from the design, roaring; arms folded, smug, a toothy smirk. Both fists thrown up beside his horns, roaring; laughing, a hand on his belly.
- **Gait range:** a bounce of 0.1–0.5 px on each step, a lean of up to 0.025: he stays upright, against the ape's hunch.
- **Wear:** scuffed is two faded patches low on the shell; scorched is two soot streaks there. Only the shell takes marks (the skin is the face's colour).
- **Rig:** drawn flat (2026-11-04): the design worn with the crown and a bolted patch plate, then edited for huge spikes, long horns and a small crown, then for the clean outline (Silhouette). With the first design's spikes two blind readers saw "a bulky body with a spiky, bumpy outline" and named the king or the ape, low; with the second, "maybe Bowser (low). Round body covered in spikes, could equally be a hedgehog or porcupine". Twelve poses drawn three to an image and cut apart (`art/sprites/king/r2/poses.prompt.txt`), every one with his head level and both eyes open (chin up, narrowed or side on, the face kit found no pair), the jump with his fists at his chest (arms flung up, it read as the ape), the falling tuck into the shell a third air drawing, and the knocked-out pose flipped on his back like an upturned turtle. The third round (2026-11-04) redrew him side on (art/sprites/king/design.prompt.txt): a smooth dome with three big spikes along its top and the head out in front with an open crocodile jaw, so the snout and the jaw's notch stand out of the outline. Drawn in the shared three-quarter view, the same shapes sat in one round mass, and two quick readers of the designs' silhouettes named it low or not at all; side on, both named it at medium. Twelve drawings, three to an image and cut apart: the jump with his fists at his chest and the shell behind him, the tuck the head and jaw out of the front of the dome, the knockout on his back. Each drawing's eye is inked solid before tracing, since the drawn eye's white and the fangs are the same white (the fangs trace as bone), and the face kit's band keeps the eye from the jaw's dark throat just below it, where the kit's eyes first landed. Two fresh blind readers then named him at medium, both: "Bowser, medium. Spiky shell on a bulky back, horns or spiky crest, broad squat body" and "spiked-shell turtle king (Bowser parody), medium. Bulky body, spiky shell, horns, wide stance"; asked whether any two figures could be the same character, neither paired him with anyone ("none for certain. The closest pair is 10 and 18"; "No two are clear duplicates. 2 and 20…").
- **Concept prompt:** A hulking turtle king seen side on, wide, heavy and low, with yellow-orange skin; on his back a huge smooth half-dome turtle shell with a thick cream rim standing out like a lip and only three big cream cone spikes along its top, a bolted grey patch plate on it; out front, on a thick neck, a huge head with a long blunt snout, a heavy jaw wide open like a crocodile's with four white fangs, two long cream horns swept back and a smooth red-orange mane swept back behind them; a pale banded belly, huge thick arms, legs planted wide apart, a thick tail; a small paper party crown between his horns.

### The green saddled dino
- **Kind:** `dino` · **Name:** Yoshee
- **A stranger should say:** "the green dinosaur with the saddle."
- **Silhouette:** upright, with a huge round snout well out in front, eyes high on top of the head, a long tail straight out behind at the hips, a saddle low on its back, and big boots. The tail is what tells the head and snout from a cap and its bill: with a short tail and the seat up behind the head, a blind reader saw "a capped hero" (2026-11-04).
- **Traits:** a bulbous round snout; a white belly and cheeks; a saddle; spikes down the back of the head; boots; big eyes on top of the head.
- **Palette:** neutral but for the player's colour (Decisions 4): the skin is the player's, the head spikes a light of it (+16) and the wellies a dark (−22); belly, cheeks and eye whites cream `#f6f2e8`; seat `#3d3d42` with its torn foam `#e2c88a` on a chrome stem `#c9ccd2`; belt `#6b4a35`; carrier bag `#c9c6bd`; the open mouth `#9a3d36` (as the wellies' red, a grin took the player's colour).
- **Color slot:** costume: the skin.
- **Gait:** a happy trot, head bobbing; on the fall, legs paddling in the air.
- **The nod:** the big round snout out front (the profile); the eyes on top of the head (the face, from the side); the saddle (it says "ridden by a hero" without the hero); the long tail on an upright body (a dinosaur that walks like a person, and not a capped hero in silhouette); a white belly under a coloured skin, boots a dark of it (the colour block).
- **Our twist:** a hand-me-down mount. The saddle is a black bicycle seat strapped on with a belt, torn open in a ragged flap, its chrome stem bent and sticking out; the boots are rubber wellies, one folded down; it carries a spotted egg of its own in a torn carrier bag.
- **Swaps:** a sticking plaster on the cheek (a bike bell, a reflector on the tail and a price tag on a welly are ideas for later: each needs a slot the flat kinds don't have yet).
- **Palette alts:** the bicycle seat in black `#3d3d42`, brown leather `#6e4a32` or grey `#7e848a`.
- **Idles and cheers:** the idle from the design; a hand on its hip, head tilted. The cheer: one fist and the bag thrown up; the second: hopping on one welly, a fist punched up.
- **Gait range:** a bounce of 0.2–0.9 px on each step, a lean of up to 0.03.
- **Wear:** in the drawing, the torn seat, the bent stem, a snapped head spike, a welly folded down and a hole in the bag; scuffed is two faded patches on the skin, scorched two soot streaks, below the face.
- **Rig:** drawn flat (2026-11-04): a game-size design worn in an edit, then edited again for the long tail and the low seat; eleven poses drawn three to a 16:9 image and cut apart (art/sprites/dino/design.prompt.txt).
- **Concept prompt:** A cheerful upright green dinosaur with a big round bulbous snout well out in front, big eyes set high on top of its head, a white belly and cheeks, orange spikes down the back of its head and a long tail sticking straight out behind; a torn black bicycle seat strapped low on its back with a belt as a saddle, its bent chrome stem sticking out; red rubber wellington boots; a spotted egg in a carrier bag hanging from one hand.

### The blue robot boy (new)
- **Kind:** `robot` · **Name:** Meh Man
- **A stranger should say:** "the little blue robot with the arm cannon."
- **Silhouette:** small and boyish, 21 world px: a big round helmet with a ridge down its middle and an ear disc standing proud of its back, a small body in a wide stance (the legs an upside-down V), huge flared boots a third of his height, and the forearm itself the cannon, a thick cylinder with no hand, held straight out level at shoulder height and clear of the helmet. Smaller and rounder than the hunter, with no shoulders to speak of.
- **Traits:** a blue helmet with a light ridge and a square on the brow, and round ear discs; a pale face in the helmet's opening inside a grey rim; a light suit; a blue mitten; big flared boots; the arm cannon.
- **Palette:** helmet, mitten and near boot in the player's colour (`#2a5fc4` on the sheets); suit and ridge a light tone of it (+20); the repainted far boot a shade off it (+9); the can a dark of it (−12) and the ear disc a darker one (−24); the face's rim `#4a4c55`; skin `#f7e7d6`, paler than any suit tone, since a peach face sank into an orange or a gold helmet; irises `#2a5fc4`; tape `#c9ccd2`.
- **Color slot:** costume: the helmet, mitten and near boot (the suit is its light tone).
- **Palette alts:** the tape in grey `#c9ccd2`, masking tan `#d8cfb8` or duct grey `#9aa0a8`.
- **Idles and cheers:** the idle from the model; leaning back pleased, a mitten on his hip. A fist punched up over the helmet; a little hop, waving.
- **Gait range:** a bounce of 0.2–0.9 px on each step, a lean of up to 0.03.
- **Wear:** scuffed is a pale scuff on the suit's chest, scorched a soot mark there (tones of the suit).
- **Gait:** a bouncy run on the big boots, the far leg kicked back; the free fist punched up on the jump, the cannon still out level.
- **The nod:** the round helmet with its ridge and ear disc (the head nobody else has); the small body in a wide stance on huge flared boots (the proportions, and the outline the original is known by); the forearm cannon held out level (what he does); the two tones of one colour (the robot read from across a room).
- **Our twist:** a robot boy from the parts bin. His cannon is a ribbed tin can slid over his forearm and taped on, its muzzle rim crumpled; his helmet is dented behind the ridge; one boot was repainted a shade off and is a size bigger.
- **Swaps:** a dent in the helmet; a screw loose on the ear disc; a strip of tape on a knee; a little puff of steam from the cannon.
- **Rig:** drawn flat (2026-11-04): a design with the can held out level in front at chest height (the hunter's lesson: raised or across the chest, a cannon vanishes into the outline), worn in one edit that also made the suit light blue and added the battery, which no design drew (`art/sprites/robot/worn.prompt.txt`): a dent knocked into the helmet's crown, the can's rim crumpled and its label torn and flapping, the far boot repainted paler and bigger, the battery taped on. The near ear disc's face is a role of its own: folded into the helmet, the disc was lost in its round. Eleven poses, the can held out level in all but the knockout. In colour he reads at once; the first blind read failed ("small narrow rounded blob with little legs, nothing distinctive", "small oval body with a little bump on top", unsure twice), and both readers took the hunter for him: held close at the chest, the can barely clears the helmet, the battery fills the notch under it, and the near ear disc is inside the outline. Redrawn with the arm straight out (`reach.prompt.txt` asked only for that and barely moved it; `reach2.prompt.txt`, as a new pose, put the can at full arm length with background all round it and the battery slimmer and lower), and the eleven poses drawn from it three to an image and cut apart (`art/sprites/robot/trios/`). Two more fresh readers then named him, but only at low ("unsure (low: blaster robot boy). Large round head, one arm held out holding a block-like object"; "unsure (low: blue robot with arm cannon)"), and both still took the hunter's silhouette for him, medium and medium-high. At play size the can reads as a block. With the hunter redrawn tall and long-legged, two more readers named the hunter as the hunter, and the robot at low again ("Mega Man, low (big round head, one arm held straight out like a cannon)"; "maybe the robot with an arm cannon, low… holding something blocky"). A can twice as fat (`fat.png`, its poses in `art/sprites/robot/fat/`) was worse: it sat against the helmet and two more readers were unsure ("big round head with something sticking out to the right; maybe a mushroom-capped figure"). A muzzle notch carved into the can's end of the arm-length drawings read no better ("possibly Mega Man (low)"; "could be Mega Man or Toad, can't tell"). Now drawn from `disc.png`: both ear discs stand proud of the helmet, bumps nobody else's silhouette has, and the forearm is one short round tin-can barrel with a dark round muzzle, held level at full arm length (a long barrel from the shoulder is the hunter's silhouette, so not that); its poses are cut from `art/sprites/robot/disc/` along a seam through the ink where the figures touch (`cut.py`). The best read yet, but under the bar: "Mega Man parody, low-medium. Round helmeted head, one arm held straight out like an arm cannon", and "unsure. Big round head on a small body, holding something stubby out in front". He shipped drawn from those frames for a day: in colour he read at once, and the frames beat the hand-drawn kit. The sixth round (2026-11-04, `art/sprites/robot/design.prompt.txt`) stopped nudging the can and drew the outline the original is known by: a wide stance with the legs an upside-down V on huge flared bucket boots, a small body, a ridge down the helmet and the ear disc standing far out of its back like a headphone, and the forearm itself a thick taped tin can with no hand, held level at full arm length. The run kicks the far leg back and the jump punches the free fist up over the helmet, with the cannon still out level. The battery went, since it filled his back. The face is pale `#f7e7d6` inside a grey rim, so on an orange or a gold helmet it stays a shape of its own. He stands 21 world px (the run at 0.92 and the air clip at 0.88, inside the shared box), below the hunter's 25. Two fresh readers then named him, at high and at medium-high ("blue robot with an arm cannon (Mega Man parody), high: round helmet, one thick blaster arm held forward, compact running pose"; "blue robot boy (Mega Man), medium-high: round helmet, arm cannon held forward, chunky boots"). Asked whether any two figures could be the same character, the first said "5 and 16 are closer than I'd like, because both have an arm cannon, but 16 is clearly taller and more armored", and the second didn't pair him with anyone.
- **Concept prompt:** A small chunky robot boy in a wide action stance, his short legs planted far apart on huge flared blue bucket boots a third of his height. A big round blue helmet, much wider than his body, with a raised light-blue ridge down its middle and round ear discs standing far out from its sides; a pale face in a thick dark grey rim in its opening; a tiny light-blue body and a blue mitten. His front forearm is the cannon: a thick ribbed tin can, painted dark blue and taped on, slid over the forearm like a sleeve, no hand, held straight out level at shoulder height. One boot repainted a lighter blue.

### The sneaking soldier
- **Kind:** `sneak` · **Name:** Snek
- **A stranger should say:** "the soldier hiding in a cardboard box."
- **Silhouette:** side on, a crisp square-cornered cardboard box worn over him to the knees, level along the bottom, on two short crouched legs with a gap between them; a striped bandana's two long tails stream out of a torn hand-hole behind. His eyes peer out of a slot near the front. On the laugh his head pops out of the top, bandana and all.
- **Traits:** a cardboard box worn over the body; a dark bandana with long tails; a grey sneaking suit; boots; on the laugh, a gruff stubble jaw.
- **Palette:** the box is the player's colour; its back end a dark of it (tone −18), the packing tape a light of it (+18), the printed arrow a darker one (−32), the bandana darker again (−38) with neutral stripes `#f4efe6`; suit `#6a7078`; boots `#3a3a40`; skin `#d9b08c`; ink `#2a1f1a`.
- **Color slot:** costume: the box.
- **Gait:** a fast, crouched shuffle with the box bobbing and staying upright.
- **The nod:** the box (the joke everyone knows him by, and the only box with legs in the cast); the bandana with long tails (the soldier inside, at 20 px); his eyes in the slot (somebody's in there); the low, crouched sneak (the stealth read in motion).
- **Our twist:** the box is badly made for the job. Its printed arrow points down, a split corner is patched with crossed packing tape, the hand-hole is torn ragged and the eye slot hacked out; his bandana is a striped tea towel, one tail frayed.
- **Swaps:** a sticker on the box (`sticker`).
- **Palette alts:** the suit in grey `#6a7078`, olive grey `#6e6c5e` or a light grey `#858a90`.
- **Idles and cheers:** the idle crouch; frozen mid-step as if nobody saw. A hop for joy with the eyes shut; the laugh, his head popped out of the top.
- **Gait range:** a bounce of 0.1–0.6 px on each step, a lean of up to 0.03.
- **Wear:** scuffed is two pale scuffs on the box, scorched two soot streaks, both tones of the box.
- **Rig:** drawn flat (2026-11-04), side on: twelve drawings, three or two to a 16:9 image cut apart, the laugh on its own. Each drawing's eye slot is painted flat and given two pupils at fixed places, so the face kit finds the same eyes in every pose (drawn, the pupils touched the slot's dark cut end and traced as one blob). The first design, in three-quarter view with a crushed top corner and flared flaps, failed the blind read as "a shaggy, hunched" ape; side on, it reads as "a square blocky body on short legs", but neither of two fresh readers names the homage (a low "meat cube" each). Open top flaps and longer tails were tried and went: at play scale the flaps read as ears and the tails as an ape's long arms. Traced with no corner cutting (`smooth: 0`) the box kept its corners, but two more fresh readers still saw "Super Meat Boy, medium: square block body with short limbs". So the eye slot is cut through the box (each drawing's slot painted white round its two pupils, `holes`): in silhouette a box with a slit, in play the eyes peer out of a gap. Two more fresh readers name it: "stealth soldier in a cardboard box (Snake), medium: a box body with legs sticking out under it, crouched and sneaking even mid-jump" and "Solid Snake hiding in a cardboard box, low-medium".
- **Concept prompt:** Seen from the side, a soldier hiding inside a big plain cardboard box worn upside down over his whole head and body down to his knees, a crisp upright box with square corners; two short legs in a grey sneaking suit and big dark boots, crouched mid-step; his eyes peer out of a rough slot near the box's front, and the two long tails of a striped tea-towel bandana stream out of a torn hand-hole at its back. The box's printed arrow points down, and crossed packing tape patches a split corner.

### The cup-headed toon
- **Kind:** `cuptoon` · **Name:** Mughead
- **A stranger should say:** "the cartoon guy with a cup for a head."
- **Silhouette:** a white mug for a head, a squat cylinder wider than the body under it, with a loop handle out the back and a striped straw flopped over out of the top; a tiny rubber-hose body under it.
- **Traits:** a mug head with tea at the rim; a striped straw; big black pie-cut eyes; white gloves; high-waisted shorts; big round shoes; black hose limbs that bend in curves; drawn in a 1930s cartoon spirit.
- **Palette:** mug `#f4efe6` (shade `#cfc6b8`), tea `#7a4e30`, gloves `#f4efe6`, hose limbs and neck `#1c1a24`, shoes `#6b4a35`: neutrals. The shorts are the player's colour; the straw's stripes are drawn in it, the rim a dark of it, the tea-bag tag a light of it.
- **Color slot:** costume: the shorts.
- **Gait:** a bouncy rubber-hose strut with arms swinging in loops; a jig for a second cheer.
- **The nod:** the mug head with its handle (the one head nobody else has); the straw (it breaks the top of the outline); big pie-cut eyes, black hose limbs and white gloves (the 1930s cartoon read, which is half the joke); the high-waisted shorts (the toon costume, and the colour block).
- **Our twist:** a camping mug, not fine china: white enamel with a thick rim chipped at the front, a paper straw gone soggy and bent over, a tea-bag string hung over the rim with its tag dangling by the handle, one shoe's sole flapping.
- **Swaps:** a sticking plaster on one cheek.
- **Palette alts:** the shoes in brown leather `#6b4a35`, tan `#9a7448` or grey `#6e6a66`.
- **Idles and cheers:** the idle from the model; gloves on his hips, rocking on his heels. Both gloves thrown up; a jig with one leg kicked high.
- **Gait range:** a bounce of 0.2–0.85 px on each step, a lean of up to 0.03.
- **Wear:** scuffed is a faded streak on the shorts, scorched a soot streak there; the mug, the face, stays clean.
- **Rig:** drawn flat (2026-11-04): a design worn with the chipped rim, the bent straw, the tea-bag tag and the flapping sole, and a black chip on the mug's side painted back out in an edit (dark beside the face reads as a mouth); eleven poses, drawn two and three to a sheet and cut apart. The drawn red nose goes with the drawn face: the face kit has no nose, and red, it was the player's colour.
- **Concept prompt:** A 1930s rubber-hose cartoon character whose head is a white enamel camping mug with a thick rim, a chip broken out of it, a loop handle on its back and tea at the rim; a striped paper straw bent over and going soggy sticks up from the top, and a tea-bag string with its paper tag hangs over the rim by the handle; big black pie-cut eyes, white gloves, high-waisted shorts and big round shoes on black noodle limbs.

### The armored bounty hunter
- **Kind:** `hunter` · **Name:** Sammus
- **A stranger should say:** "the bounty hunter in the orange power suit."
- **Silhouette:** the tallest of the cast, about five helmets tall: two huge round shoulder pads, each bigger than the helmet and wider than anything else on it, a helmet with a visor band between them, a narrow waist, long thick armoured legs (half its height, no big boots), and an arm cannon held straight out from the shoulder, reaching far past the body. The robot boy is small, round-helmeted and big-booted; the hunter is none of those.
- **Traits:** an armored suit; huge spherical shoulder pads; a wide visor band across the helmet; an arm cannon; long legs with round knee joints.
- **Palette:** the suit in the player's colour (roster `#d9661f`); the buoys a dark of it (−28) with a band `#f1ece2`; the drainpipe cannon a light of it (+18); the visor dark smoky glass `#38434c` with glint `#a7b3bb`; the undersuit (collar, waist, gloves, knee pads) gunmetal `#4b5059`.
- **Color slot:** costume: the suit, with the buoys and the cannon in tones of it.
- **Gait:** heavy, steady strides; raises the cannon on the jump; tucks into a ball on a long fall.
- **The nod:** the two huge round shoulder pads (the silhouette: nobody else is wider at the top); the tall, long-legged build (what parts it from the small, big-booted robot boy, who also carries a cannon); the visor band across the helmet (the face); the arm cannon (the hunter, and the ball tuck says the rest).
- **Our twist:** a power suit welded together in the scrapyard. The torso is a cut-down water heater, the shoulder pads are two banded fishing buoys, the arm cannon is a length of drainpipe painted to match, and the visor is smoked glass.
- **Swaps:** a rope coiled at the waist; a hand-painted stencil of ours on a buoy; a hazard sticker on the drainpipe; a dent in the helmet.
- **Rig:** drawn flat (2026-11-03), no face (the visor is it). The first drawing failed the blind read ("a mushroom retainer's lobed cap", "a monkey with big ears"): its buoys sat level with the helmet and merged with it into one lobed blob, and the cannon across its chest was lost in the body. Redrawn with the buoys hung low and wide at the ends of a shoulder plate, the helmet clear above them, and a long straight cannon held out level, clear of the body, in every standing, running and jumping pose (raised, it vanished into the outline). That one was named by one blind reader and taken for the blue robot boy by the other, and by both of the robot boy's readers (2026-11-04: "rounded helmet, arm cannon held out, chunky boots"): a round helmet over a level cannon on short legs in big boots is the robot boy's silhouette. Redrawn tall (2026-11-04), its readers lost the robot boy but saw "Rayman-like, low: a big lobed head on thin limbs": the cannon, carried across the waist, barely left the outline, and the buoys and helmet were one lobed head. So the design is the fourth: the cannon is the forearm, held straight out from the shoulder and reaching far past the body, the legs long and thick with big knee pads, a visor band across the helmet; the tallest kind, 25 world px standing (the run at 0.96, the air and wall clips at 0.9, inside the shared box). Worn with a taped cannon, a dented chest with a riveted patch, and a dented muzzle. The ball tuck on a long fall; the undersuit gunmetal `#4b5059`, slate `#646a73` or old iron `#3e3a37` (a light steel or bone one blotched the suit like camouflage); a sticker in the suit's colour on the near buoy's band; one wear mark on the thigh, a scrape or soot.
- **Concept prompt:** A tall, long-legged bounty hunter in a power suit welded together from scrap: an orange suit whose torso is a cut-down water heater, two huge round red-and-white fishing buoys as shoulder pads, each bigger than the helmet and wider than anything else, a helmet with a wide smoked-glass visor band, a narrow dark waist, and long thick armoured legs with big round knee pads and small feet. The near forearm is a long cannon made from a length of drainpipe, held straight out from the shoulder.

### The team shooter's engineer
- **Kind:** `engineer` · **Name:** Engie
- **A stranger should say:** "the engineer with the hard hat, the toolbox and the wrench."
- **Silhouette:** as tall as the other grown men (the miner, the hunter, the merc), broad and square, a slab of a chest on long legs, and a small head for his body (about a quarter of his height with the hat, where the plumber's is near half). The head is a dome hard hat with a narrow rim sticking out all round it, front and back alike, never a cap's bill out front. His kit is carried low and clear of the head: a hard rectangular toolbox with square corners hanging by its handle beside his back knee, to the side of his legs, and one huge open-jawed wrench held low in the other hand, slanting forward, its jaw out in front of his knees.
- **Traits:** a dome hard hat with a rim all round; goggles strapped round it as a band; a clean-shaven square jaw, jutting forward; a work shirt; khaki trousers with a belt; leather work gloves; a toolbox, a crisp box no other kind carries; a huge wrench with one big open jaw. The jaw is no longer the huge lantern jaw as wide as the dome: on a small head it would make the head big again.
- **Palette:** the shirt in the player's colour; the hard hat a light tone of it (+22) and the toolbox a dark one (−20), far enough apart to stay three shapes on a light ground and in the mine. Neutrals: goggles `#3a4246` with grey lenses `#8e8a84`; trousers `#8c7a58`, the belt and boots drawn in them; gloves `#a8794a`; wrench `#8e8a84`; skin `#efc9a4`. (Before 2026-11-04 the hat was its own yellow `#e9b730`.)
- **Color slot:** costume.
- **Gait:** trudges, heavy-stepped, the toolbox and the wrench swinging at his sides.
- **The nod:** the toolbox and the wrench, carried low (the read in silhouette: the kit the original is known for, the box a hard rectangle nobody else has); the dome hard hat with goggles on it (the head shape and the trade, its rim all round where the plumber's cap has a bill); the tall, square build with a small head (the builder, and what keeps him from being read as the plumber); the square jaw (the gruff Texan, at 20 px); the work shirt and khakis (the colour block).
- **Our twist:** a backyard engineer. The goggles are swimming goggles pushed up on a battered hard hat, the wrench is one giant spanner, and the toolbox a dented green tin one. (Drawn flat, the broom handle and the toy turret on his belt went: at play size they made a tangle that hid the hat and the wrench.)
- **Swaps:** a pencil behind the ear; a tape measure on the belt; a toothpick; a grease smear on the cheek.
- **Palette alts:** the trousers in khaki `#8c7a58`, slate work cloth `#6b7178` or charcoal `#5b5955`; the boots are drawn in them (drawn flat, the boots and trousers are one colour in the drawing).
- **Rig:** drawn flat (2026-11-03), redrawn three times after failed blind reads. Carried up behind his head, the spanner and the toy turret read as "a capped figure with spiky bits sticking up from the head"; then a wide brim on a short, stocky man read as the plumber's rival ("wide brimmed hat and a spiky, jagged face/mustache outline on a stocky body"); a spanner with a second jaw down by his boots read as "a long curled tail". Now a broad, taller build under a tall round dome with a short rim and the goggles as a band, a clean-shaven jaw, and one spanner gripped by its end at his hip, slanting up past his shoulder, its one big open jaw beside his shoulder and clear of the hat. The jaw was then made a huge square lantern jaw, as wide as the dome and jutting forward (owner: "the jaw isnt super square"), and every drawing but the wall slide and the knockout mirrored, because the poses had come back turned to the left while he runs right. Worn with a dented dome; the drawings' torn knees are left out, since at play size the skin through a rip read as a stray speck on the trousers. Still unnamed ("a mechanic or engineer, but I can't name the source", and in silhouette the jaw up by his shoulder read as ears), he was redrawn a fourth time (2026-11-04) with a toolbox hanging from one hand and the spanner held low in the other, its jaw out in front of his knees. Two fresh readers then named him, both at low ("engineer-type worker in a hard hat holding a wrench, possibly the TF2 Engineer"; "a hard-hat or helmeted worker, maybe a TF2 Engineer type… a tool or box carried low in one hand"). The hard hat and the shirt are one player's colour in two tones, the toolbox a dark tone of it, and the rest neutrals (Decision 4). That design came back facing right, so nothing is mirrored any more. An audit of the cast then found him the plumber's twin at play scale (stout, a cap with goggles in the player's colour, a tool held low, only a little smaller and with no mustache) and the shortest humanoid in the cast, a small hunched shape in which neither the hat nor the toolbox showed. So the fifth round (2026-11-04) draws him as tall as the miner, hunter and merc (24 world px), broad and square with a small head, the hat a tall dome with a narrow rim all round, and the toolbox a long hard box hanging to the side of his legs, not across them; the lantern jaw went back to a plain square one, since as wide as the dome it made the head big again. The box traces with no corner cutting (`smooth: 0`): rounded, it read as a bag. The drawn eyes are thinner than the role map's ink, so each drawing's are inked over as solid ovals before tracing. Two fresh readers then named him at medium, both from the kit ("Hard-hat engineer (TF2 Engineer parody), medium. Hard hat, toolbox in one hand, wrench"; "TF2-style Engineer. Medium. Hard hat, toolbox carried in one hand, wrench in the other, stocky build"), and neither paired him with the plumber when asked whether any two figures could be the same character. The goggles stay pushed up, so the cast's face shows; eleven pose drawings, drawn three to an image (art/sprites/engineer/design.prompt.txt).
- **Concept prompt:** A tall, broad, square-built engineer, a slab of a chest on long sturdy legs, his head small for his body: a tall yellow dome hard hat with a narrow rim sticking out evenly all round, swimming goggles strapped round it as a band; a clean-shaven square jaw jutting forward; a red work shirt, khaki trousers with a belt and leather work gloves; a big hard rectangular green tin toolbox with square corners hanging by its handle from one hand beside his knee, to the side of his legs, and one giant spanner held low in the other, slanting forward, its single big open jaw out in front of his knees.

### The goose up to no good
- **Kind:** `goose` · **Name:** Honkers
- **A stranger should say:** "the troublemaking goose."
- **Silhouette:** a long body, an S-shaped neck and a tail tipped up. On the run it takes the honk pose: neck thrust out flat, wings flung up.
- **Traits:** white feathers; a tan beak and webbed feet; a small black eye; the honk with its beak wide open.
- **Palette:** body `#f3f0ea`; beak and feet a neutral warm tan `#c08a58` (in a tone of the vest the beak and its loot ran into one shape); eye `#2a1f1a`; vest the player's colour (`#e8d23a` in the roster), its bands folded in; spanner bare steel `#9aa0a8`, blued `#5d6d86` or dark iron `#4f5359`; tape `#8e8a84`.
- **Color slot:** costume: the vest.
- **Gait:** a waddle; when running, the honk charge with neck out and wings up.
- **The nod:** the S of a neck (the goose, not a duck or a chicken); white with a beak and webbed feet in a warm tan (the farmyard goose); the honk pose with wings flung up (the troublemaker, which is the whole character).
- **Our twist:** a site goose. It wears a stolen hi-vis vest put on back to front, and always has something nicked in its beak: whatever the roll gives (see Swaps).
- **Swaps** (the loot in its beak): a spanner; a plunger cup; a single sock; a rubber duck.
- **Rig:** drawn flat (2026-11-03): the vest's hem torn ragged, the tail bent over, the spanner bent; the loot is a spanner in every pose, its swaps a colourway (bare, blued or dark iron: a red one in the beak read as a tongue) and a strip of grey tape behind the eye, small and level with it (lower, the spanner ran over it); the run is the honk charge, neck flat out and wings flung up, and the vest is one block of the player's colour: drawn flat, its reflective bands and the scraps of their arcs cut it into a dozen patches, and their pale grey read as the white showing through (their edges stay as lines).
- **Concept prompt:** A mischievous white farmyard goose with a long S-shaped neck, a tail tipped up, an orange beak and orange webbed feet and a small black eye; it wears a stolen yellow hi-vis vest on back to front and holds a stolen spanner in its beak.

### The barnyard party game's horse (new)
- **Kind:** `horse` · **Name:** Hoarse
- **A stranger should say:** "the horse from the chicken-horse game."
- **Silhouette:** on all four legs, seen from the side: a long barrel body on four long legs, a long neck rising steeply from the chest with the mane standing up along its top as a crest, a long blunt head out in front pointing down, and a long tail of straight hair hanging from the rump to the heels.
- **Traits:** a long boxy muzzle, as deep at the nose as at the eyes, with a pale nose, a big nostril and buck teeth; the mane as a crest along the neck; a long straight tail, never a brush; flat-bottomed hooves wider than the legs; a goofy buck-toothed grin.
- **Palette:** the costume in the player's colour (drawn `#c8743a`), the far legs a dark of it (tone −14) and the scarf a darker one (−28); the rest neutral: nose and muzzle `#e6cfae`; mane, tail, hooves and nostril `#4a3428`; zip and knee patch `#9a9c98`; an open mouth's tongue `#9a3d36`.
- **Color slot:** costume: the coat, head and all; the far legs and the scarf in darks of it.
- **Gait:** a high-stepping trot on the walk, a gallop stretched out and gathered on the run, a show jumper's leap and a buck in the air.
- **The nod:** the four legs under a long body, side on (only a horse's outline: upright on two legs, ten blind readers took it for a fox or the bandicoot); the long neck with its crest of mane and the long blunt head pointing down (a horse, not a dog: a dog has no neck and a pointed snout); the long straight tail hanging to the heels and the hooves (a horse, not a fox's brush); the goofy grin (its personality, at card scale).
- **Our twist:** it's a cheap costume. A zip runs down its chest from under the scarf, stuck open at the bottom, a grey patch is sewn on one front knee, and it's lost its voice: a knitted scarf wound round its neck.
- **Swaps:** a sticking plaster on the jowl. The lozenge tin, the hand-sewn patch and the party horn are dropped: the tin is a speck at play scale, a horn in its mouth would stick out of the silhouette (swaps never change it), and a patch is already sewn on its knee in every drawing, where a second one rolled on would only read as more wear.
- **Palette alts:** the mane, tail and hooves together in dark bay `#4a3428`, black `#302c2c` or chestnut `#74492f`.
- **Idles and cheers:** the idle from the design; pawing the ground with one front hoof, smug. Rearing up on its hind legs, front hooves pawing the air; a buck, both hind legs kicked high behind.
- **Gait range:** a bounce of 0.2–0.9 px on each step, a lean of up to 0.03.
- **Wear:** in the drawing, the zip stuck open and a stitched grey patch on one front knee; scuffed is a faded patch on the body, scorched a soot mark there.
- **Rig:** first drawn flat upright on two legs (2026-11-04): a game-size design with the scarf, zip and patch added in a wear edit (over the prompt's length the image model dropped the scarf) and the head tilted down and the tail narrowed in a second; eleven poses drawn three to a sheet (`art/sprites/horse/design.prompt.txt`). Each drawing's near pupil is repainted solid: drawn, a pupil was a ring of ink round its glint, taken for the line, and the far one sits on the outline. Blind reads (2026-11-04, ten fresh readers over five drawings): never named; read as Fox McCloud or a plain fox ("pointed snout and ears, bushy tail, stands upright on two legs", low) and as the bandicoot ("spiky tuft on the head, lanky", low to medium), as a level head, a shaggy mane, tall ears or a fanned tail made it a canine. In colour it reads as a horse at once. Redrawn on four legs the same day: a new game-size design side on, with the mane a stiff crest along a long neck and a blunt boxy muzzle, the long tail added in an edit (the design drew none) and the scarf, zip and knee patch in the wear edit; eleven poses drawn three to a 16:9 sheet, cut apart and scaled to the design's ink (`art/sprites/horse/cut.py`), every open eye's near pupil inked solid (`pupils.py`). The walk is a trot, the run a gallop stretched out and gathered (drawn at 0.86 of the body size, or its nose and tail leave the box), the air a leap and a buck (0.8: the buck's tail stands up past the box's top), the wall slide rearing against the wall with its front hooves braced on it, the cheers a rear and a buck, the knockout on its side with all four legs stiff in the air. Two fresh readers then named it at once: "Plain horse (maybe Epona), medium-high. Gallops on four legs with a flowing tail and long neck. Stands rearing up in row 1, leaps in row 3"; "Plain horse, medium. Horse head and neck, gallops on four legs in the run frame and rears in the jump. The standing pose looks oddly upright, almost sitting or centaur-like." Neither paired it with another kind when asked whether any two figures could be the same character. The hand-drawn fallback is a horse on four legs too.
- **Concept prompt:** A goofy cartoon horse standing on all four legs, seen from its side, with a long neck rising steeply from its chest, a short stiff dark mane standing up along the neck in one neat crest, a long blunt boxy head pointing forward and down with a pale cream nose, a big nostril and big flat buck teeth in a grin, a long straight dark tail hanging to its heels and flat dark hooves wider than its legs; it is clearly a cheap costume, with a silver zip down its chest stuck open at the bottom, a grey patch sewn on one knee and a red knitted scarf wound round its neck.

### The rapping paper puppy (new)
- **Kind:** `rapper` · **Name:** Parapper
- **A stranger should say:** "the rapping dog in the beanie."
- **Silhouette:** paper-thin: a flat cut-out of a puppy standing on its edge, so a sliver of card shows down his back; a tall knit beanie standing up on top, long floppy ears hanging under it, a round nose out front, a microphone held up to his mouth.
- **Traits:** a tall knit beanie with a turned-up band; long floppy ears; a round nose on a short snout; a baggy tee, baggy shorts and big trainers; a microphone in one hand; the body flat as card, with an edge.
- **Palette:** the beanie and the tee in the player's colour, the shorts a dark of it; the fur a neutral cream, the trainers neutral, the mic grey.
- **Color slot:** costume.
- **Gait:** a bouncy strut on the beat, the head bobbing.
- **The nod:** the tall beanie (the head's outline); the floppy ears (a dog); the flat card body with its edge (the paper look the original is known for); the microphone (the rapper).
- **Our twist:** he's a cardboard shop standee come loose: a fold crease across his middle, a fold-out easel leg flat against his back, and the mic a karaoke mic on a coiled cord. The beanie is hand-knitted with a dropped stitch.
- **Swaps:** a sticker on the tee; a sweatband; a plaster on the nose; a price sticker on the card's edge.
- **Rig:** to draw flat (2026-11-04).
- **Concept prompt:** A paper-thin cartoon puppy drawn as a flat cardboard cut-out standing on its edge, a sliver of card showing down its back, in a tall knit beanie with a turned-up band, long floppy ears hanging under it, a round nose, a baggy tee, baggy shorts and big trainers, holding a karaoke microphone on a coiled cord up to its mouth; a fold crease across its middle.

### The limbless hero (new)
- **Kind:** `limbless` · **Name:** Raymond
- **A stranger should say:** "the hero with no arms or legs."
- **Silhouette:** a small round body and a big-nosed head with a spiky hair tuft standing up, and nothing joining it to its white gloves and big shoes: each floats clear of the body with background all round it.
- **Traits:** no arms or legs; big white gloves; big shoes; a big nose; a spiky hair tuft he can spin; a hooded top with a round mark of ours on the chest (never the original's); a neckerchief.
- **Palette:** the top in the player's colour, the shoes a tone of it; gloves white, skin and hair neutral, the neckerchief a neutral.
- **Color slot:** costume.
- **Gait:** the shoes step on their own under him, the gloves swing ahead and behind; in the air the hair tuft spins.
- **The nod:** the gaps where the limbs should be (the read: nobody else has them); the floating gloves and shoes; the hair tuft standing up; the big nose.
- **Our twist:** a knock-off: the gloves are yellow washing-up gloves bleached white, one shoe is a size bigger than the other, and a safety pin holds the neckerchief.
- **Swaps:** a plaster on the nose; a price tag on one glove; a sticker on the top.
- **Rig:** to draw flat (2026-11-04). Its hands and feet are separate pieces from the body in every drawing: cut sheets so the floating parts stay with their figure.
- **Concept prompt:** A cartoon hero with no arms and no legs: a small round body in a hooded top with a round badge, a big-nosed head with a spiky tuft of hair standing up, a neckerchief held with a safety pin, and big white rubber gloves and two big mismatched shoes floating clear of the body with space all round them.

### The worm in the super suit (new)
- **Kind:** `worm` · **Name:** Earthworm Gym
- **A stranger should say:** "the earthworm in the space suit."
- **Silhouette:** a bulky suit with huge shoulders on stocky legs, and out of its collar a worm's head on a long bendy neck, rising and leaning, with two bulging eyes; a big chunky pistol held out in one hand, at the hip, never level at the shoulder like the hunter's cannon.
- **Traits:** a bulky suit with huge round shoulders; a worm's pink head on a long thin neck out of the collar; bulging eyes and a wide grin; a big chunky pistol in one hand; heavy boots and gloves.
- **Palette:** the suit in the player's colour, the boots and gloves a dark of it; the worm a neutral pink (a face), the pistol grey metal.
- **Color slot:** costume.
- **Gait:** a heavy suit stomp, the worm's neck whipping about over it.
- **The nod:** the worm on a stalk out of the collar (the read); the huge-shouldered suit; the pistol.
- **Our twist:** the suit is a second-hand boiler suit stuffed with pillows at the shoulders, and the pistol is a hair dryer with its cord trailing.
- **Swaps:** a plaster on the worm; a patch on the suit; a pencil behind where an ear would be.
- **Rig:** to draw flat (2026-11-04).
- **Concept prompt:** A cartoon earthworm wearing a bulky boiler suit stuffed out into huge round shoulders, its pink worm head on a long thin bendy neck rising out of the collar, with two bulging eyes and a wide grin, heavy boots and gloves, holding a big chunky hair dryer like a pistol at its hip, its cord trailing.

### The little purple dragon (new)
- **Kind:** `dragon` · **Name:** Spiro
- **A stranger should say:** "the little purple dragon."
- **Silhouette:** small and low on four legs, seen from the side: horns swept back off the head, stubby wings up off the back, a tail out behind ending in an arrowhead tip. Lower and smaller than the horse, never upright like the dino.
- **Traits:** horns swept back; a short snout; stubby wings; a pale belly; a ridge of small spines down the back; an arrowhead tail tip; big eyes.
- **Palette:** the scales in the player's colour, the wings a light of it; the belly, horns and spines neutral bone.
- **Color slot:** costume.
- **Gait:** a quick scampering trot, the wings flicking; a glide with the wings out in the air.
- **The nod:** the swept-back horns and stubby wings (the head and back outline); four legs, small (the build); the arrowhead tail (the tip).
- **Our twist:** his wings are patched umbrella cloth on bent spokes, and a firefly in a jam jar is tied to his tail.
- **Swaps:** a plaster on the snout; a chipped horn; soot on the nose.
- **Rig:** to draw flat (2026-11-04).
- **Concept prompt:** A small cartoon dragon standing on four legs, seen from its side, with horns swept back off its head, a short snout, big eyes, stubby wings made of patched umbrella cloth on bent spokes, a pale belly, a ridge of small spines down its back, and a tail ending in an arrowhead tip with a firefly in a jam jar tied to it.

### The snouted cube hopper (new)
- **Kind:** `hopper` · **Name:** Kewbert
- **A stranger should say:** "the orange ball with the long nose that hops."
- **Silhouette:** a round ball on two big feet, no arms, and a long tube snout sticking straight out front, wider at its open end; big eyes on top. The snout is what parts it from the puffball.
- **Traits:** a round furry ball body; a long tube snout with an open end; big eyes; two short legs with big feet; no arms.
- **Palette:** the ball in the player's colour, the snout a tone of it; the feet neutral.
- **Color slot:** costume.
- **Gait:** hops, both feet together, never walks.
- **The nod:** the tube snout (the read); the ball on two feet with no arms; the hop.
- **Our twist:** the snout is a party blower that unrolls when he cheers, and the feet are in worn old trainers. When it swears it shows a scribble cloud, never letters.
- **Swaps:** a plaster on the ball; a party hat; a sticker.
- **Rig:** to draw flat (2026-11-04).
- **Concept prompt:** A round furry cartoon ball with no arms, standing on two short legs with big feet in worn old trainers, big eyes on top, and a long tube snout sticking straight out front, wider at its open end, like a party blower.

### The jellyfish parasite
- **Kind:** `jelly` · **Name:** Meltroid
- **A stranger should say:** "the floating jellyfish thing from the space game."
- **Silhouette:** a dome with four fangs hooked underneath: two big ones under its middle curving in to a pincer, a small one each side; it floats and never touches the floor.
- **Traits:** a see-through green membrane; three red nuclei inside it; a pale rim; four ivory fangs.
- **Palette:** the dome in the player's colour (`#9ee38a` on the sheets); the cherries a dark of it, the rim a light of it, the mint a dark of it; fangs a bone `#efe6d2`.
- **Color slot:** costume: the dome, its cherries, rim and mint in tones of it.
- **Gait:** hovers with a slow bob and chomps its fangs, faster when moving.
- **The nod:** the translucent green dome (the only see-through body in the cast); the three red nuclei (they make it this parasite, not a jellyfish); the four fangs hooked underneath (the menace); floating (it never walks).
- **Our twist:** a lime jelly dessert that got ideas. The dome wobbles like set gelatine, the nuclei are three glacé cherries, the fangs are sugared almonds, and a paper doily is stuck to its underside.
- **Swaps:** a cocktail umbrella stuck in the top; a sprig of mint; a spoon-dent; a wafer fan.
- **Palette alts:** the sugared-almond fangs in ivory `#efe6d2`, old bone `#e0cfa8` or grey bone `#d6d4cb`.
- **Rig:** drawn flat (2026-11-03), no face and no glass: the dome a flat colour (the player's), turned out of a fluted mould and flaring at its rim like a bell, worn with a melting drip down one side and a spoonful scooped out of its top. Its fangs are the parasite's mandibles (2026-11-04): two big ones, half the dome's height, hang from under the middle of the rim and curve in until their tips nearly cross, a pincer, with a small one each side just inside the rim. In blind reads the fangs' spacing was the read: short fangs evenly along the rim read as the dome-headed ghost's hem (2026-11-03), long curling hooks as an octopus, and short hooked fangs at the rim's edge as the parasite, the ghost or the ape's arms by a few pixels. The cherries are a dark of the dome, the rib lines painted out of them (a rib down a cherry read as a crack); the doily isn't drawn (between the fangs it merged them into one pale skirt). Three drawings carry every clip (the mandibles hanging, pinched shut, spread): asked to move its fangs, the image model adds more, so the two poses are the design with its fangs swung about their roots. The chomp is spread and pinched on the walk and run; the swap is a sprig of mint on the dome.
- **Concept prompt:** A floating translucent lime-green jelly dome that wobbles like set gelatine, with three glacé cherries suspended inside it like nuclei, a pale rim, and four ivory sugared-almond fangs hooked underneath; a paper doily stuck to its underside. It hovers above the ground and never touches it.

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
| 22 | limbless | Raymond | **keyed**, floating hands and feet | medium: parts apart from the body |
| 23 | worm | Earthworm Gym | humanoid + head stalk | medium: the neck |
| 24 | dragon | Spiro | **keyed**, quadruped | medium: wings and tail |
| 25 | hopper | Kewbert | **keyed**, legs only | low |

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

How a Roster entry becomes a kind the game draws from art. The entry is the one source for the design (nod, twist, swaps, palette); this is the pipeline. A kind with rendered frames is always drawn from them (no option); a kind without keeps its hand-drawn body until it is produced. Production steps and the done list: [tools/art3d](../tools/art3d/README.md) and its [checklist](../tools/art3d/CHECKLIST.md). Every rendered kind is a flat kind since 2026-11-03; the 3D route before it (a Tripo model rigged, posed, rendered and traced) is retired: at play size its kinds read rough and blobby, too detailed and lit by a render ([tools/art3d/3D.md](../tools/art3d/3D.md)).

- **Drawn, at game size.** One design made to read as a 24 px sprite (Decision 9), worn in an edit, then drawn in a dozen poses by the image model with the design as its reference: it copies a reference closely, which holds the character from pose to pose. Where the image model draws the original whatever the brief says (the hedgehog), the kind's approved concept is the reference instead.
- **Flat, in the drawing's own shapes.** Each drawing is traced at one body size into its own flat colours, every shade folded in, under a light pen with no ink mass or shade sliver (`flat`), plus its long interior lines (`lines`: an arm over the body, the gap between the legs). A shade that carries a shape is a dark of the costume (the plumber's cap shadow and plunger cup).
- **The cast's face** takes over from the drawing's eyes and mouth, specks at play size: eyes found per pose (a pair, or one and the far one set from it), brows set into the run, wide on a fall, squinting on a cheer, crossed out on a death.
- **What a 20 px read can't take** is drawn otherwise: anything dark under the face reads as a mouth (the zapmouse's black cord belt is brown), a long line across a ball reads as a mouth (the puffball's seam isn't drawn), a cross beside an eye reads as an eye (the puffball's tape is gone), and a colourway that lands on another role's colour loses the colour block (the plumber's brown-canvas overalls are navy).
- **Motion** is a few drawings per clip: a two-frame walk and run, a jump and a fall (the hedgehog's a looping spin ball), a wall slide, two cheers, a second idle, the knocked-out pose; the shared squash and the kind's gait move on top.
- **Variety** (Rules for every kind → Variety) is data and marks on every pose: a colourway (`alts` on `vary` 6), an accessory (a strip on the crown or the cheek), `idle2` and `cheer2`, a `gait` range, and the `wear` slot: clean, scuffed and scorched, marks on bare surface below the face (one quiet one on a smooth ball, where a ring of blobs reads as a rash).
- **Out of the light bands.** Every rendered figure marks its shape in the light map's alpha (`Renderer.markFigures`), and the cel pass lights it evenly, dimmed less with the theme than the world (`figAmbient`), with no band or light tint across it: a band's edge cut across a 20 px body and blew light colours (the tin tail) out to white. The world round it still bands. The hand-drawn kinds don't mark, so they still band.
- **Cost.** About 0.003 ms per runner drawn from the frame-bitmap cache. Frame data is about 80–220 KB per kind, a chunk fetched on first use. No Tripo credits: images are free within the account's allowance, about thirty a kind.
- **Checks:** `tests/sprite-cast.test.ts` (every clip, the shared hitbox box pen and all, at least 18 px tall, every eye on its head, the variety layers), and `pnpm shot sprites --kind K` and `pnpm shot variety --kinds K` (the run cycle, the six-rolls lobby, twelve looks, the draw cost, and `sprites-blind.png`, every kind as a shuffled, unnamed play-scale silhouette for fresh readers).

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
- **Round 10** drew the rendered kinds flat, from a game-size design and pose drawings, and took the cel pass's light bands off them: the 3D-traced kinds read rough, blobby and too detailed at play size (tools/art3d/README.md).
