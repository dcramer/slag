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
| plumber | the mustached plumber | red cap with a round white badge (our own mark, a little wrench, never the letter), big round nose, thick mustache, blue overalls with two gold buttons, white gloves, brown shoes; big head, stout | costume: cap and shirt |
| hedgehog | the blue speedster | cobalt, spikes swept straight back, joined eyes with green irises, peach muzzle and belly, a one-sided grin, red sneakers with a white strap; runs leaning hard, spins in the air | costume: the quills |
| elf | the green-tunic elf hero | long green cap flopping back, pointed ear, blond fringe, flared green tunic with a belt, a kite shield and a sword hilt on the back | costume: cap and tunic |
| hunter | the armored bounty hunter | orange armor, huge round red shoulder pads, a round helmet with a green visor, an arm cannon held out | costume: the suit |
| zapmouse | the yellow electric mouse | yellow, long ears with black tips, red cheeks, a lightning-bolt tail | costume: the fur; the cheeks keep their red (a face mark), the tin tail and the cord are neutral |
| impostor | the impostor crewmate | a bean on stubby legs, a wide pale visor standing proud, a backpack | costume: the bean, and the pack a dark of it |
| puffball | the pink puffball | a ball on big feet, stubby arms, tall eyes with a shine, blush; puffs up in the air | costume: the ball, and the feet a dark of it |
| jelly | the jellyfish parasite | a translucent green dome, three red nuclei inside, four ivory fangs, a hovering bob | costume: the dome |
| goose | the goose up to no good | white, a tan beak and feet, an S of a neck; on the run the honk pose, neck flat out and wings up | costume: the vest; the beak and feet a neutral tan |
| engineer | the team shooter's engineer | yellow hard hat with dark goggles on it, a square jaw, a red or blue work shirt, khaki trousers, a leather glove, a huge wrench | costume: the shirt |
| chomper | the round dot-eater | a yellow circle with a wedge mouth that chomps, one small eye, a scalloped bite out of its back, a checked napkin tucked into its lower lip | costume: the whole ball |
| miner | the voxel miner | a cube head, a blocky body, a pickaxe | costume (its entry) |
| ape | the necktie ape | hunched, long arms, a necktie | costume (its entry) |
| merc | the spiky-haired mercenary | spiked hair, a blade taller than he is | costume (its entry) |
| king | the spiked turtle king | a spiked shell, horns, a fiery mane, a brute's build | costume (its entry) |
| dino | the green saddled dino | a long snout, a saddle, a round tail, boots | costume (its entry) |
| robot | the blue robot boy | a round helmet with ear discs, an arm cannon, small | costume (its entry) |
| sneak | the sneaking soldier | a box on two legs with an eye slot, a bandana | costume (its entry) |
| cuptoon | the cup-headed toon | a cup for a head with a straw, rubber-hose limbs, shorts | costume (its entry) |
| horse | the barnyard party game's horse | a long head, a mane, standing on two legs | costume (its entry) |

**Is it the homage?** `cast-recognise.png` puts each kind close up beside "This is ___", in its roster colour. Every sheet waits for the rendered kinds' frames (`slagDebug.sprites.ready()`), so it shows what ships; before 2026-11-02 the catalog, recognise and silhouette sheets drew those kinds hand-drawn, so the reads below were judged on the old bodies. As of this round, every homage reads as its caption to us: the plumber, speedster, elf, mouse, impostor, puffball, jelly and goose at once; the bounty hunter and the engineer a beat slower, because their reads lean on props (the shoulder pads and cannon, the hat and wrench) more than on a silhouette nobody else shares. The silhouette test still separates every kind, though the plumber and the hunter are the closest pair of stout shapes.

## Roster (all homages)

The cast this is heading to: **twenty kinds, the greatest game characters to parody**, every one a homage, because the lore makes the runners the characters who never made the cut, the knock-off heroes who almost got their own game. The ten homages from round 5 stay, and so do five of the six round-6 picks. The four plain animals (fox, frog, penguin, chicken) go.

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
- **Traits:** red cap with a riveted brass badge carrying a small wrench (never a letter); a big round nose; a thick dark-brown mustache; blue bib overalls over a red shirt; leather gauntlets; steel-toe boots.
- **Palette:** cap and shirt `#c9473f` (shade `#9c3530`); overalls `#3f62b4` (shade `#2e4a8c`); skin `#efc9a4`; mustache and hair `#4d3426`; badge `#c99a4a`; bolts `#9aa0a8`; gauntlets `#b08454`; boots `#6b4a35`; plunger cup a dark of the cap's colour (the player's, owner 2026-11-03) on a copper handle `#c27a45`.
- **Color slot:** costume: the cap and shirt (the overalls stay blue).
- **Gait:** a jaunty run with a bounce on every step and arms pumping; one fist high on the jump.
- **The nod:** the red cap with its bill out front (the first shape anyone names); the big round nose (it breaks the profile at 20 px, where no face detail survives); the thick mustache (the face, at any size); blue bib overalls over red (the colour block people know from across a room); the stout, big-headed build (it separates him from every slim hero).
- **Our twist:** a foundry hand, not a castle plumber. The joke is an absurdly big rubber plunger on a copper handle strapped to his back like a greatsword. Welding goggles on the cap, hex-bolt overall buttons, a patched knee, tan gauntlets for the white gloves.
- **Swaps:** a pencil behind the ear; a sticking plaster on one cheek; a roll of thread-seal tape on a belt loop; a pressure gauge in the bib pocket.
- **Palette alts:** the overalls in denim blue `#3f62b4`, grey work cloth `#7e848a` or washed denim `#86a3d4` (brown canvas `#8e6a44` went with the flat pass: drawn flat it's the gloves' tan, and the bib loses its colour block; navy work cloth `#2f3b5c` went next: on a dark ground the overalls and boots sank into it). The knee patch is the overalls' own cloth, outlined: in the shirt's red it took the player's colour, a fleck on the leg at every step.
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
- **Palette:** quills `#2f5bd0` (shade `#2346a6`); muzzle and belly `#f0c99c`; irises `#3a9a46`; shoes `#d8382f` (shade `#a8281f`); strap `#e8c24a`; toecaps `#9aa0a8`; gloves `#7a5236`; neckerchief `#e8c24a`, drawn as one clean yellow.
- **Color slot:** costume: the quills.
- **Gait:** runs leaning hard forward, legs a blur; curls into a spinning ball in the air.
- **The nod:** the cobalt quills swept straight back (they are the whole silhouette); the big red shoes (the second thing anyone draws); the peach muzzle and belly (they tell a hedgehog from a blue blob); green eyes and the cocky grin (the attitude); the forward-leaning run and the spin-ball jump (the speedster in motion, readable when the shape blurs).
- **Our twist:** a stubby scrapyard runner, chunky as a toy. Two separate eyes under heavy brows instead of the joined eye shape, a chipped tooth, soot-scorched quill tips, a hazard-striped neckerchief, brown fingerless gloves, red work high-tops with steel toecaps and a hazard-yellow strap.
- **Swaps:** a sticking plaster across the nose; a sweatband on one wrist; a ring-pull hanging off the neckerchief; one shoelace undone.
- **Palette alts:** the shoes and their soles and toecaps as one colourway: red on steel `#d8382f`/`#9a9894`, racing green on cream `#2f8a57`/`#ebe4d2`, or cream on red `#ebe5d6`/`#c8402f`. The strap stays hazard yellow.
- **Idles and cheers:** the idle from the model; arms folded, tapping one toe. The model's cheer, and its later both-fists-up stretch.
- **Gait range:** a bounce of up to 0.45 px and a lean of 0.01–0.06 on top of the hard forward lean he already runs with.
- **Wear:** scuffed is a scuff on the belly; scorched is a scorch there, and soot on the quill tips in every look (two marks or a strong tone on the belly read as a rash).
- **Rig:** drawn flat (2026-11-03), from the round-2 concept as the reference (without it the image model drew the original's joined eyes): a taped quill stump, scorched tips, a torn neckerchief and a flapping sole; the jump a looping spin ball, with no face. The irises are a role of their own: as the ink, the face kit put its eyes on a quill's soot. The neckerchief's hazard stripes fold into its yellow: at play size they were a dark mottle across the chest, never stripes. The taped quill is drawn in the quills' colour with its wrap lines: grey, it was a lump behind the head. The face's stray white and dark specks (a gap by the glove, scraps of the grin) fold away (`min`). The stretch was redrawn with its eyes open (shut, the kit had nothing to ride).
- **Concept prompt:** A stubby, toy-chunky cobalt-blue hedgehog with long quills swept straight back, their tips soot-scorched; two separate green eyes under heavy brows; a peach muzzle and belly; a cocky one-sided grin with a chipped tooth; a hazard-striped neckerchief; brown fingerless leather gloves; big red work high-tops with steel toecaps and a hazard-yellow strap.

### The round dot-eater
- **Kind:** `chomper` · **Name:** Snack-Man
- **A stranger should say:** "the yellow ball that eats dots."
- **Silhouette:** a yellow circle with a wedge-shaped mouth cut into its front. The smallest kind, and the only one with no limbs.
- **Traits:** pure yellow; a wedge mouth that opens and shuts; one small eye above the mouth.
- **Palette:** body `#f6d02a` (shade `#cba214`); mouth interior `#2a1f1a`; eye `#14121a`; bite edge `#e8b81c`; napkin one flat wash of its check, `#f4c6bf`.
- **Color slot:** costume: the whole ball, its bitten edge with it. The napkin keeps its own colour, rolled rose, blue or green.
- **Gait:** bounces along, chomping with every stride; spins once on the jump.
- **The nod:** the circle with a wedge cut out (the most recognised shape in games, and it needs nothing else); pure yellow (half the read); the chomp (it is a mouth, not a pie chart, only when it moves).
- **Our twist:** someone got to him first: a neat bite is missing from the back of his circle, the joke being that the eater got eaten. A checked napkin is tucked under the mouth like a bib.
- **Swaps:** a crumb on the lip; a toothpick in the corner of the mouth; a fork-tine scratch. (A paper party hat would break the outline, so it isn't one.)
- **Palette alts:** the napkin washed rose `#f4c6bf`, blue `#c6d3f2` or green `#cde6c3`: pale, so it never lands on the ball's colour.
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
- **Palette:** cap and tunic `#3f7a34` (shade `#2c5a25`); darn a light of the costume (`#5a9a4a` on the green), so it follows the player's colour; hair `#e6c25a`; skin `#efc9a4`; belt, boots and gloves `#6b4a35`; lid `#a8adb4` (shade `#7a7f86`), or a recycling-blue `#5f80a8` or black-plastic `#5a5e66` lid; poker `#4a4a52`.
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
- **Rig:** drawn flat (2026-11-03), no face (the visor is it). The first drawing failed the blind read ("a mushroom retainer's lobed cap", "a monkey with big ears"): its buoys sat level with the helmet and merged with it into one lobed blob, and the cannon across its chest was lost in the body. Redrawn with the buoys hung low and wide at the ends of a shoulder plate, the helmet clear above them, and a long straight cannon held out level, clear of the body, in every standing, running and jumping pose (raised, it vanished into the outline). Worn with a taped cannon, a dented and patched water-heater torso and grey replacement boots (the poses kept drawing both grey, so both are). The ball tuck on a long fall; the drainpipe and boots grey `#8e9298`, deep rust `#6f3b2a` or bone-white PVC `#d6cdb6` (a light rust `#9a5f3e` was the orange and yellow suits' own brown, and the cannon and boots merged into them); a hazard sticker on the near buoy; one wear mark on the thigh, a scrape or soot.
- **Concept prompt:** A bounty hunter in a power suit welded together from scrap: an orange suit whose torso is a cut-down water heater, two huge round red-and-white fishing buoys as shoulder pads wider than the body, a round helmet with a green bottle-glass visor, green lights on the chest, a narrow dark waist and chunky legs. One arm ends in a cannon made from a length of grey drainpipe with an elbow joint, held out front.

### The team shooter's engineer
- **Kind:** `engineer` · **Name:** Engie
- **A stranger should say:** "the engineer with the hard hat and the wrench."
- **Silhouette:** broad and square-shouldered, a tall round hard hat with a short rim all round, and one huge open-jawed wrench slanting up past his shoulder from his hip, its jaw clear of the hat.
- **Traits:** a tall round yellow hard hat with a short rim all round; dark goggles strapped round it as a band; a huge clean-shaven square lantern jaw, as wide as the dome and jutting forward, flat-bottomed with hard corners; a red or blue work shirt; khaki trousers with a belt; leather work gloves; a huge wrench with one big open jaw.
- **Palette:** bowl `#e9b730` (shade `#bb8a1c`); goggles `#3a4246` with lenses `#5fb0c8`; shirt `#b8433c` or `#3f62a8`; trousers `#8c7a58`; belt `#6b4a35`; glove `#a8794a`; wrench `#8e8a84` (shade `#5c5852`); broom handle `#c49a62`; skin `#efc9a4`.
- **Color slot:** costume.
- **Gait:** trudges, heavy-stepped, the wrench swinging.
- **The nod:** the domed hard hat with goggles on it (the head shape and the trade); the square jaw (the gruff Texan, at 20 px); the huge wrench over the shoulder (the read in profile); the work shirt and khakis (the colour block).
- **Our twist:** a backyard engineer. The hard hat is a deep upturned yellow mixing bowl, the goggles are swimming goggles pushed up on it, and the wrench is one giant battered spanner. (Drawn flat, the broom handle and the toy turret on his belt went: at play size they made a tangle that hid the hat and the wrench.)
- **Swaps:** a pencil behind the ear; a tape measure on the belt; a toothpick; a grease smear on the cheek.
- **Palette alts:** the trousers in khaki `#8c7a58`, slate work cloth `#6b7178` or olive drab `#5e5f3c`; the boots are drawn in them (drawn flat, the boots and trousers are one colour in the drawing).
- **Rig:** drawn flat (2026-11-03), redrawn twice after failed blind reads. Carried up behind his head, the spanner and the toy turret read as "a capped figure with spiky bits sticking up from the head"; then a wide brim on a short, stocky man read as the plumber's rival ("wide brimmed hat and a spiky, jagged face/mustache outline on a stocky body"); a spanner with a second jaw down by his boots read as "a long curled tail". Now a broad, taller build under a tall round dome with a short rim and the goggles as a band, a clean-shaven jaw, and one spanner gripped by its end at his hip, slanting up past his shoulder, its one big open jaw beside his shoulder and clear of the hat. The jaw was then made a huge square lantern jaw, as wide as the dome and jutting forward (owner: "the jaw isnt super square"), and every drawing but the wall slide and the knockout mirrored, because the poses had come back turned to the left while he runs right. Worn with a dented dome; the drawings' torn knees are left out, since at play size the skin through a rip read as a stray speck on the trousers. The goggles stay pushed up, so the cast's face shows; eleven poses.
- **Concept prompt:** A broad, square-shouldered engineer with a deep yellow mixing bowl worn upside down as a tall round hard hat, its rim a short brim all round, swimming goggles strapped round it as a band; a huge clean-shaven square lantern jaw jutting forward; a red work shirt, khaki trousers with a belt and leather work gloves; one giant battered spanner, gripped by the end of its handle at his hip and slanting up past his shoulder, its single big open jaw beside his shoulder.

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
- **Palette alts:** the sugared-almond fangs in ivory `#efe6d2`, pink `#f2c6cc` or pale blue `#c8dcee`.
- **Rig:** drawn flat (2026-11-03), no face and no glass: the dome a flat colour (the player's), turned out of a fluted mould and flaring at its rim like a bell, worn with a melting drip down one side, a spoonful scooped out of its top and a torn doily. Its four fangs are long curved hooks, as long as the dome is tall and splayed wide apart: on short fangs set close together its silhouette read as the dome-headed ghost's skirt in the blind read (2026-11-03). The cherries are drawn in their shade `#9c3530`: in the roster's red they vanish into a red or pink dome, and with the mint on top a red jelly reads as a strawberry. The doily isn't drawn: between the fangs it merged them into one pale skirt. Three drawings carry every clip (the hooks hanging, curled in, spread wide): asked to move its hooks, the image model added more, an octopus. The chomp is spread and curled on the walk and run; the swap is a sprig of mint on the dome.
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
