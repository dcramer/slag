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

The cast this is heading to: sixteen kinds, every one a homage, because the lore makes the runners the characters who never made the cut, the knock-off heroes who almost got their own game. The ten homages from round 5 stay. The four plain animals (fox, frog, penguin, chicken) are replaced by six more homages. Reserves, if one of these won't read: the shovel-wielding knight, the spinning bandicoot, the red-haired mountain climber.

This spec feeds the art pipeline: a generated concept image, traced into vector parts and rigged on the gait system. Each entry is written to be used as prompt material, so it describes traits only and never names a real character. Every kind is our own design: it must read as the homage from its silhouette and props, never copy the original's exact design, and never carry its name or logo. Sound-alike names stay in data (`KIND_NAMES`). Each one carries a visible twist of our own, such as a changed signature prop, a different body detail, or foundry and scrap flavour. The nod is the silhouette; the rest is ours. A concept that looks like the original redrawn is rejected, however good it looks.

These rules apply to every kind:

- **Size.** About 16 world px tall at play scale, inside the shared 14×15 body envelope. One hitbox for everyone.
- **Style.** Clean, confident curves; few shapes; smooth tapered lines in a dark of each part's own color; two or three flat tones per surface; one soft, hard-edged shadow shape; calm color; no glow, no gradients.
- **Facing.** Drawn facing right, standing on the floor.
- **Player's color.** A flat ring round the feet, except where a kind says "body".
- **Faces.** Expressive eyes with highlights, and brows that react to running, jumping, falling and cheering.

### The mustached plumber
- **A stranger should say:** "that's the plumber with the mustache."
- **Silhouette:** stout and big-headed, about 45% head. A round cap with its bill sticking out front, and a big round nose that breaks the profile.
- **Traits:** red cap with a round white badge on the front carrying our own small mark (a tiny wrench, never a letter); a big round nose; a thick dark-brown mustache under it; blue overalls with two gold buttons over a red shirt; white gloves; brown shoes.
- **Palette:** cap and shirt `#c9473f` (shade `#9c3530`); overalls `#3f62b4` (shade `#2e4a8c`); skin `#efc9a4`; mustache and hair `#4d3426`; buttons `#e8c24a`; gloves `#f4efe6`; shoes `#6b4a35`; badge `#fbf6ee`.
- **Color slot:** ring.
- **Gait:** a jaunty run with a bounce on every step and arms pumping; one fist high on the jump.
- **Our twist** (the 3D render, `art/sprites/plumber/`): a foundry hand rather than a castle plumber, and the joke is his absurdly big rubber plunger on a copper handle, strapped to his back like a greatsword. Round dark welding goggles strapped round the cap, the badge a riveted brass plate, steel hex bolts for the overall buttons, a patched knee, big tan leather gauntlets for the white gloves, steel-toe boots. The cap, nose, mustache, overalls and stout build are the nod (Rendered kinds lists why each one stays).

### The blue speedster
- **A stranger should say:** "the fast blue hedgehog."
- **Silhouette:** a big head with three or four long spikes swept straight back, a small body, thin legs, big shoes.
- **Traits:** cobalt-blue quills swept back; one joined white eye shape with green irises; peach muzzle and belly; a cocky one-sided grin; red sneakers with a white strap and white cuffs; white gloves.
- **Palette:** quills `#2f5bd0` (shade `#2346a6`); muzzle and belly `#f0c99c`; irises `#3a9a46`; sneakers `#d8382f` (shade `#a8281f`); strap and gloves `#fbf6ee`.
- **Color slot:** ring.
- **Gait:** runs leaning hard forward, legs a blur; curls into a spinning ball in the air.
- **Our twist** (the 3D render, `art/sprites/hedgehog/`): a stubby scrapyard speedster. Chunky toy proportions, two separate eyes under heavy brows instead of the joined eye shape, a chipped tooth in the grin, soot-scorched quill tips, a hazard-striped neckerchief, brown fingerless leather gloves for the white ones, and red work high-tops with steel toecaps and a hazard-yellow strap. The swept quills, cobalt, peach muzzle and big red shoes are the nod.

### The green-tunic elf hero
- **A stranger should say:** "the elf hero with the green cap."
- **Silhouette:** slim. A long green cap flopping back like a tail, a pointed ear sticking out, and a tunic flared at the hem.
- **Traits:** long floppy green cap; blond fringe; long pointed ear; green tunic with a brown belt and gold buckle; a kite shield and a sword hilt on the back; brown boots and gloves.
- **Palette:** cap and tunic `#3f7a34` (shade `#2c5a25`); hair `#e6c25a`; skin `#efc9a4`; belt, boots and gloves `#6b4a35`; shield `#3b5fa8` with a silver rim `#c9ccd2`; hilt `#5a7fc0`.
- **Color slot:** ring.
- **Gait:** strides out with the cap tip swinging; a forward somersault on the jump.

### The armored bounty hunter
- **A stranger should say:** "the bounty hunter in the orange power suit."
- **Silhouette:** a round helmet, two huge round shoulder pads wider than the body, a narrow waist, chunky legs, and an arm cannon held out front.
- **Traits:** orange armor; red spherical shoulder pads; a green visor across the helmet; a gray arm cannon with a green light; green lights on the chest.
- **Palette:** armor `#d9661f` (shade `#a84b14`); shoulders `#c9473f`; visor `#2f7a3c` with glint `#9fe08a`; cannon mouth `#3a3a40`; lights `#7fd06a`; waist `#4a4a52`.
- **Color slot:** ring.
- **Gait:** heavy, steady strides; raises the cannon on the jump; tucks into a ball on a long fall.

### The yellow electric mouse
- **A stranger should say:** "the yellow electric mouse."
- **Silhouette:** chubby and round, with two long pointed ears and a lightning-bolt tail that breaks the outline behind.
- **Traits:** yellow; ears tipped black; round red cheeks; a zigzag lightning-bolt tail, brown at the root; two brown stripes across the back; small black eyes with a white glint.
- **Palette:** body `#f2c62a` (shade `#c99c14`); ear tips `#2a1f1a`; cheeks `#e0473b`; stripes and tail root `#6b4a35`.
- **Color slot:** ring.
- **Gait:** a quick scamper on all fours at a run, ears streaming back.

### The impostor crewmate
- **A stranger should say:** "the crewmate from the impostor game."
- **Silhouette:** a bean on two stubby legs, a wide visor standing proud of the front, and a backpack behind.
- **Traits:** a smooth bean body; a pale-blue visor with a white glint; a backpack; no arms.
- **Palette:** body is the player's color; visor `#a9dbe8` (shade `#6aa6ba`); glint `#ffffff`.
- **Color slot:** body, because the original comes in every color.
- **Gait:** a waddling shuffle on its stubby legs.

### The pink puffball
- **A stranger should say:** "the little pink puffball."
- **Silhouette:** a near-perfect ball on two big oval feet, with stubby round arms.
- **Traits:** tall oval eyes with a shine at the top; blush marks; a tiny mouth; big red feet.
- **Palette:** body is the player's color, pink by default; feet `#c9473f`; eyes `#2a1f1a`; blush `rgba(232,96,120,0.55)`.
- **Color slot:** body, because the original comes in every color.
- **Gait:** toddles on its big feet; puffs up round and floats in the air.

### The jellyfish parasite
- **A stranger should say:** "the floating jellyfish thing from the space game."
- **Silhouette:** a translucent dome with four fangs hooked underneath; it floats and never touches the floor.
- **Traits:** a see-through green membrane; three red nuclei inside it; a pale rim; four ivory fangs.
- **Palette:** membrane `#9ee38a` at 60% opacity; nuclei `#c9473f` (shade `#9c3530`); rim `#d8f2c8`; fangs `#efe6d2` (shade `#c8bba0`).
- **Color slot:** ring.
- **Gait:** hovers with a slow bob and chomps its fangs, faster when moving.

### The goose up to no good
- **A stranger should say:** "the troublemaking goose."
- **Silhouette:** a long body, an S-shaped neck and a tail tipped up. On the run it takes the honk pose: neck thrust out flat, wings flung up.
- **Traits:** white feathers; an orange beak and webbed feet; a small black eye; the honk with its beak wide open.
- **Palette:** body `#f3f0ea` (shade `#bdb5a8`); beak and feet `#d9894a` (shade `#a35f2b`); eye `#2a1f1a`.
- **Color slot:** ring.
- **Gait:** a waddle; when running, the honk charge with neck out and wings up.

### The team shooter's engineer
- **A stranger should say:** "the engineer with the hard hat and the wrench."
- **Silhouette:** stocky, with a square jaw, a domed hard hat with a wide brim, and a huge wrench over the shoulder.
- **Traits:** yellow hard hat; dark goggles strapped around it; square jaw; red or blue work shirt; khaki trousers with a belt; leather work glove; a huge steel wrench.
- **Palette:** hat `#e9b730` (shade `#bb8a1c`); goggles `#3a4246`; shirt `#b8433c` or `#3f62a8`; trousers `#8c7a58`; belt `#6b4a35`; glove `#a8794a`; wrench `#8e8a84` (shade `#5c5852`); skin `#efc9a4`.
- **Color slot:** ring.
- **Gait:** trudges, heavy-stepped, the wrench swinging.

### The horned bug knight (new)
- **A stranger should say:** "the little bug knight with the white mask."
- **Silhouette:** a big round white mask-head about half its height, two tall horns curving up and out from it, a small dark body in a cloak, and a thin blade at its side.
- **Traits:** a white mask with two large hollow black eyes and no mouth; two curved horns; a dark gray cloak with a ragged hem; a thin pale blade.
- **Palette:** mask and horns `#f2efe8` (shade `#c9c4b8`); eyes `#14121a`; body `#2a2d38`; cloak `#4a5060` (shade `#363b48`); blade `#c9ccd2`.
- **Color slot:** ring.
- **Gait:** a quick, light scuttle, cloak fluttering; lunges forward with the blade on the jump.

### The green saddled dino (new)
- **A stranger should say:** "the green dinosaur with the saddle."
- **Silhouette:** upright, with a big round snout well out in front, eyes high on top of the head, a short tail, a saddle on its back, and big boots.
- **Traits:** green skin; a bulbous round snout; a white belly and cheeks; a red saddle with a white rim; orange spikes down the back of the head; red boots; big eyes set on top of the head.
- **Palette:** skin `#4cbf4a` (shade `#35913a`); belly and cheeks `#f6f2e8`; saddle `#d8382f` (rim `#fbf6ee`); spikes `#e8853a`; boots `#d8442f` (shade `#a83222`).
- **Color slot:** ring.
- **Gait:** a happy trot, head bobbing; on the jump, legs paddling in the air.

### The necktie ape (new)
- **A stranger should say:** "the big ape with the red tie."
- **Silhouette:** hunched, with huge shoulders and long arms, a small head low and forward, and a protruding muzzle.
- **Traits:** brown fur; a tan face, muzzle and chest; a red necktie carrying our own small mark (never letters); big knuckles.
- **Palette:** fur `#7a4e2c` (shade `#5a3820`); face and chest `#e2b98a`; tie `#d03a30` with mark `#e8c24a`.
- **Color slot:** ring.
- **Gait:** knuckle-gallops on all fours at a run, arms leading; beats its chest on a cheer.

### The cup-headed toon (new)
- **A stranger should say:** "the cartoon guy with a cup for a head."
- **Silhouette:** a white cup for a head with a handle on the side and a striped straw sticking up out of the top; a small rubber-hose body.
- **Traits:** a cup head with liquid at the rim; a red-and-white striped straw; pie-cut black eyes; a small red nose; white gloves; red shorts; brown shoes; drawn in a 1930s cartoon spirit.
- **Palette:** cup `#f6f1e6` (shade `#cfc6b8`); liquid `#5a3a2a`; straw `#d8382f` and `#fbf6ee`; eyes `#14121a`; nose `#d8382f`; shorts `#c9473f`; gloves `#fbf6ee`; shoes `#6b4a35`.
- **Color slot:** ring.
- **Gait:** a bouncy, rubber-hose strut with arms swinging; the straw wobbles.

### The round dot-eater (new)
- **A stranger should say:** "the yellow ball that eats dots."
- **Silhouette:** a yellow circle with a wedge-shaped mouth cut into its front.
- **Traits:** pure yellow; a wedge mouth that opens and shuts; one small eye above the mouth; no limbs.
- **Palette:** body `#f6d02a` (shade `#cba214`); mouth interior `#2a1f1a`; eye `#14121a`.
- **Color slot:** ring.
- **Gait:** bounces along, chomping with every stride.

### The barnyard party game's horse (new)
- **A stranger should say:** "the horse from the chicken-horse game."
- **Silhouette:** upright, with a long head and muzzle out in front, two upright ears, a mane down the neck, and a tail behind.
- **Traits:** brown coat; a dark mane and tail; a pale muzzle with nostrils; hooves; a goofy grin.
- **Palette:** coat `#9a6a40` (shade `#734e2e`); mane and tail `#3a2a20`; muzzle `#e6cfae`; hooves `#2a1f1a`.
- **Color slot:** ring.
- **Gait:** a high-stepping prance, mane bouncing; kicks its heels on the jump.

**What to check.** No two kinds may rhyme. Watch these pairs:

- The puffball and the dot-eater: they're split by feet, arms and a mouth against a wedge and no limbs.
- The goose and the horse: two farmyard homages, but white versus brown and an S-neck versus a long muzzle.
- The bug knight and the elf: both carry a blade, but a white mask with horns versus a cap and pointed ear.

Every kind must also pass the silhouette sheet and the "is it the homage?" sheet before it ships.

## Rendered kinds (spike)

A second route to the cast, the one Dead Cells took: a 3D model as the source of poses, drawn in 2D. The plumber and the speedster are done this way, behind `?sprites=1` (`slagDebug.sprites.use(true)`); without it the game draws and loads exactly the hand-drawn cast. The pipeline is [tools/art3d](../tools/art3d/README.md).

- **Sheets first.** Per kind: a concept in the game's ink style, a model sheet with the proportions pushed for a 20 px read, and a pose sheet (idle, run, jump with its anticipation and fist up, fall, wall slide, cheer, death; the speedster's jump is a curled spin ball). Tripo models, rigs and animates the model sheet; the poses its motions can't make are keyed by hand from the pose sheet.
- **Drawn by the cast's own hand.** The render is cut into flat parts (one material, no depth step inside), each traced and simplified into a few clean curves; detail too small to read at race size folds into its neighbour. The game fills and inks those shapes at draw time with the same `contour` and `toned` the hand-drawn kinds use: the silhouette on its ink mass with three lifting pen strokes, every part on its own mass, thin toward the light and heavy away from it, with a hard sliver of shade, one hard shadow shape over the figure, a glint in the eyes, and the boil on threes. So it's the same pen at any zoom, with no atlas.
- **Caricature is a setting.** Bone scales push the head, hands and feet; `girth` draws the figure wider than the model (a 2D cheat for a stout build); the plumber's plunger is a prop built from primitives on his spine, so its size is the joke and not the model's.
- **Both facings are rendered**, not mirrored, so the light stays up-left and the plunger stays on his back. Keyed poses name limbs `_near` and `_far`, so a fist goes up on the camera's side either way.
- **Colour.** Each part is a role in the roster's palette; the `paint` role takes the character's own colour, so the speedster's two blues come through.
- **Clips** come from the pose the hand-drawn cast reads: idle and cheer by time, walk and run by distance run (the feet keep pace), the air clip by vertical speed (the plumber) or as a spin by time (the speedster), the wall clip facing the wall, and a death clip for half a second where the runner came apart. The ring and the squash and stretch are the shared drawer's, on top.
- **Size.** About 300 KB of frame data per kind, a chunk fetched only with the flag on. Every frame, pen and all, squashed or stretched, stays inside the box the hand-drawn kinds keep and stands on the floor, and no kind stands under 18 world px (`tests/sprite-cast.test.ts`).
- `pnpm shot sprites --kind plumber` shoots it in game beside round 5, round 1 and the traced spike, in the cast lineup, as a run cycle and on lobby cards, and writes the blind read (`sprites-blind.png`: every kind as a shuffled, unnamed play-scale silhouette, `slagDebug.cast.blind()`).

**The nod and the twist.** What each one keeps, and why the read needs it, then what's ours:

- **Plumber.** Kept: the red cap with its bill out front (the first shape anyone names), the big round nose that breaks the profile, the thick mustache (the face at 20 px), blue bib overalls over a red shirt (the colour block), and a stout big-headed build. Ours: a foundry hand with an absurdly big rubber plunger on a copper handle strapped to his back like a greatsword, its cup showing behind his head; welding goggles on the cap, a riveted brass badge with a wrench, hex-bolt buttons, big leather gauntlets for the white gloves, and steel-toe boots.
- **Speedster.** Kept: long cobalt quills swept straight back (the whole silhouette), big red shoes, the peach muzzle and belly, green eyes and a cocky grin, the hard forward-leaning run and the spin-ball jump. Ours: a stubby scrapyard runner, chunky as a toy, with two separate eyes under heavy brows instead of the joined eye shape, a chipped tooth, soot-scorched quill tips, a hazard-striped neckerchief, brown fingerless gloves, and red work high-tops with steel toecaps and a hazard-yellow strap.

**The blind read** (four fresh readers, silhouettes only, all fourteen kinds shuffled): the speedster was named every time with high confidence. The plumber was read as the plumber brothers but at low confidence ("tall and capped, fist up"), as the hand-drawn hunter and engineer are; in colour, at play scale, he reads at once.

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
