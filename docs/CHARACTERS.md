# Characters: three directions (Phase 1 proposal)

The owner finds today's runners cute but generic: a soft blob with a body shape, palette, eyes, mouth, topper, pattern and ribbon. This doc proposes three ways to give them more identity, each prototyped in-engine behind `?cast=a|b|c`. Nothing changes for players until a direction is picked.

See them: `pnpm shot cast` writes one sheet per direction (`shots/cast/cast-a.png`, `-b`, `-c`) and the three side by side with today's blobs (`shots/cast/cast-all.png`). Each sheet has the 8-player lineup at play scale on a light theme (farm) and a dark one (mine), the race start, a 3× close-up, the lobby cards, and a catalog of every kind on two seeds with the poses (idle, walk, run, jump, fall, wall, cheer). `--only catalog` re-shoots just the catalogs.

## What every direction keeps

- **One hitbox, one physics.** Every kind is drawn around the same 14×15 world-px body, scaled inside the range today's `wide` and `capsule` blobs already use (0.84–1.28 wide, 0.8–1.14 tall). Ears, horns, wings, a shell or a key are thin or sit behind the body, as today's toppers and capes do.
- **The player's color is the body.** The HUD, cursors, card strips and blood all still read `character.body`, and the match's hue spacing (`MIN_HUE_APART`) is untouched. A kind's fixed colors are only its small parts: a beak, gills, a brass key.
- **Determinism.** A kind and its variation come from `rollCast(seed, mode)` (`src/gen/cast.ts`), its own `deriveSeed` stream, so `generateCharacter` and every existing roll in it stay exactly as they are.
- **Distinct at a glance.** `assignCast` gives a lobby eight different kinds in slot order. The prototype applies it render-side; Phase 2 would put the kind in `looksFree`, next to the hue check, so a New Look or a restored look can't duplicate one.
- **Animation.** Squash and stretch, lean, stride, arms, the face's moods, the boil and the one hard shadow are the shared frame (`src/render/cast/draw.ts`); a kind only fills hooks (`back`, `print`, `over`, `front`, `snout`, feet, arms, tail). Death still bursts in the body's colors. The lobby idle and ready cheer work unchanged.
- **Ink.** Flat tones, the body's own `contour`, `toned` parts, no gradients, no even outlines. The only glow is on hot things (C's molten metal).
- **Cost.** `slagDebug.cast.bench` (headless, software canvas): today 0.044–0.061 ms per runner, prototypes 0.053–0.067 ms, about 20% more, under 0.6 ms for eight. Nothing needs baking yet; if it ever does, the print is the part to bake, in body space.

## A. Creature prints

Today's blob, wearing a pattern a child could name, plus the one accessory and body shape that belong to it. 16 prints: bee (bands, wings, antennae), ladybug (dome, head cap, seam, spots), frog (eye bumps, belly, webbed feet), tabby (forehead M, side stripes, ringed tail), zebra (dense stripes, mane), calico (three-tone patches, odd ears), leopard (rosettes, spotted tail), cow (patches, horns, pink muzzle), jellyfish (bell, tentacles, glides), mushroom (cap and stem), beetle (shell, shine, rhino horn), patchwork (cloth panels, stitches, a button), giraffe (pale net, ossicones), clownfish (edged bands, fins), scales (scallops, belly plates, dorsal spikes), dalmatian (spots, eye patch, floppy ears). The blob's own face, scarf and cape still roll on top.

- **Readability:** the weakest at play scale. A print is interior detail, and at 16 px tall it reads as texture, not as "the cow". The prints with an accessory (bee wings, cow horns, mushroom cap, beetle horn) carry; the flat ones (leopard, scales, patchwork) blur.
- **Variety:** the widest: prints × the existing body, face and accessory rolls.
- **Effort:** smallest. One registry of prints; everything else exists.
- **Saved looks:** additive. Old looks keep everything and gain a print.

## B. A species cast

A barnyard party game casts animals; this casts 14 species, each with one silhouette trait that survives 16 px, then its face, feet and markings: bee (wings, stinger), frog (eye bumps, ear-to-ear mouth), cat (pointed ears, whiskers, tail), bunny (long ears, one may flop, buck teeth), owl (tufted head line, facial disc, flipper wings), duck (long bill, crest), fox (big ears, white blaze, bushy tipped tail), hedgehog (spines fanning off the back), penguin (white front, beak, flippers), snail (spiral shell, eye stalks, glides), crab (claw hands, scuttling legs, eyes on stalks), axolotl (frilled gills), pig (snout, curly tail), bear (round ears, muzzle). The body is the player's color, as multiplayer Yoshis and Kirbys are recolored; inside a species the seed varies markings (a tabby, socked or bibbed cat; spotted or striped frog; two- or three-band bee) and ear set.

- **Readability:** the best. In the play-scale lineups every runner is a nameable animal, on both themes, and players can call each other by it ("the duck's winning").
- **Variety:** 14 species × color × in-species markings × the face rolls. Fewer combinations than A, but each one is memorable.
- **Effort:** largest of the three, mostly art: each species is about 40–80 lines of hooks, and new ones are a registry entry. Optional extras: species gibs (feathers, quills) and sounds.
- **Saved looks:** additive, same as A. A saved look keeps its color, name and face, and gets a species.

## C. Foundry toys

SLAG melts junk down and recasts it, so the runners are what comes out of the moulds: painted tin wind-ups and cast-iron novelties in the player's livery, each with a brass key turning in its back (faster when it runs), rivets, a parting seam and paint chipped back to the iron. 10 kinds: robot (grille, dial, antenna), piggy bank (coin slot with a coin in it), tin can (rims, label star, pull ring), kettle (spout, lid, handle), bell (flared lip, swinging clapper, hanging loop), crucible (tapered pot of sloshing molten metal, which glows), slag blob (a critter crawled out of the slag, glowing cracks), tin soldier (shako, crossed belts), clockwork beetle, jack-in-the-box (bounces on a spring, jester cap, ruff). The joke is that every runner is a *thing*: a piggy bank racing a kettle.

- **Readability:** good in the lobby and the close-up, middling in a race: boxy objects share a silhouette, and the key, the best idea here, also adds a yellow blob to every runner that competes with the body's color at 16 px.
- **Variety:** the fewest kinds, and objects vary less within a kind than animals do.
- **Effort:** like B. The fit with ART.md's identity is the strongest of the three; it's the one direction nobody else has.
- **Saved looks:** additive, same as A.

## Research that shaped this

- **One trait per character, judged at real scale.** Clever Endeavour added Snake to *Ultimate Chicken Horse* because it was "very distinct from previous characters", gave it a hood for "a unique silhouette", and dropped a Worm reskin that read in-game as "a beige Snake"; they judge art at actual game scale. [Behind the scenes: Snake](https://cleverendeavourgames.com/blog/2020/9/21/behind-the-scenes-snake). The animals began as a barnyard joke from the title ([CGMag interview](https://www.cgmagonline.com/?p=55047)), and the payoff is that everyone already knows each animal's name, so players and spectators can call each other by it. This is B's premise, and why each species owns one big trait.
- **Read it small, then add pattern.** Mediatonic asks *Fall Guys* costume designers to zoom out and check that the main elements still read, to cover the top half and see if the bottom half alone identifies the design, and adds that "shape isn't everything": color, pattern and texture help players follow their own bean. ([PlayStation Blog](https://blog.playstation.com/?p=224711)). Costumes go over the bean's own padding: a costume over a costume, which is A ([ESPN](https://africa.espn.com/esports/story/_/id/29734365/meet-minds-fall-guys-costumes)).
- **Layered costume parts on one body.** *Gang Beasts* fighters are one body with a base color, then hats, faces, tops, bottoms, and dangling parts that react to physics ([fan wiki, secondary](https://shapes.inc/fandom/gang-beasts/costumes); procedural animation: [Boneloaf dev blog](https://gangbeasts.game/posts/2017/5/30/information-on-the-next-unstable-alpha-build-026)). That is our current blob plus ribbon, and why every direction keeps the rig.
- **One sprite, many explorers.** *Spelunky 2*'s 20 explorers ([Gematsu](https://www.gematsu.com/2021/08/spelunky-and-spelunky-2-for-switch-launch-august-26)) share one body and moveset and differ by color and headgear, which reads in a crowded cave. A fair cast can be all costume.
- **Stand out, and stay trackable.** Sakurai has said a fighter must be distinct enough to earn its place ([Nintendo World Report, GDC 2008](https://nintendoworldreport.com/news/15390/sakurai-speaks-on-brawl-character-development)), and later Smash games outline fighters so players can track their own in a crowd ([Attack of the Fanboy](https://attackofthefanboy.com/news/super-smash-bros-wii-u-character-outlines-detailed/)). Our heavy ink contour already does that job.
- **Color as the player, shape as the character.** Multiplayer Kirbys are told apart by color alone, pink, yellow, red and green ([WiKirby: Color](https://www.wikirby.com/wiki/Color)); Yoshi is a species that comes in many colors, in *Mario Kart* nine ([Mario Kart wiki](https://breezewiki.discard.no/mariokart/wiki/Yoshi), [MarioWiki](https://www.mariowiki.com/Yoshi_(species))). B and C copy this: the species or toy is the identity, and the body color is the player.
- **Few parts, stretched.** Miyamoto describes the Mii editor's variety coming from adjusting the size and spacing of a small set of parts rather than adding parts ([Nintendo World Report](https://nintendoworldreport.com/feature/43032)). Our face rolls already work this way, and every direction keeps them.

## Saved looks

`profile.look` is a seed, and the look is `generateCharacter(seed)`, so a generator change re-rolls every saved character. All three prototypes avoid that: the kind comes from its own stream (`deriveSeed(seed, 'cast:<mode>')`), and `generateCharacter`'s rolls are untouched, so a saved look keeps its color, name and face and gains a kind. Two rules keep it that way:

- **Adding kinds later** must not move existing seeds, which `floor(r × count)` would. Use the `LATE_THEMES` trick from `src/themes.ts`: a separate roll gives new kinds a fixed share and leaves every other seed on its old kind.
- **A taken kind** follows today's rule for a taken hue: `looksFree` refuses it, and the restored look falls back to a fresh roll.

## Recommendation

**B, the species cast, with A's prints as the variation inside each species.** B is the only direction where eight runners at play scale are eight things you can name, which is what UCH gets from its animals. Prints are B's in-species variety, on species where they make sense: a tabby or calico cat, a spotted frog, a three-band bee, a dalmatian-spotted bear. That keeps most of A's variety without making the print carry the identity. C's foundry idea is the most on-brand, so keep it for what it does best: a cast-iron toy *edition* of the species (a tin wind-up duck with a key in its back) as a rare roll or an unlock, and the slag critters for the main menu's heap.

## Questions for the owner

1. Which direction: B with prints inside species (recommended), or A, B or C on its own?
2. Species in the player's color (a blue fox, Yoshi-style, as prototyped), or in natural colors with the player's color on a worn item (a bandana)? Natural colors read more as animals but weaken the HUD match.
3. Should players choose their species in the lobby, as in UCH, or keep New Look as a random roll?
4. Saved looks: keep color, name and face and add a species (recommended), or re-roll everyone once?
5. Should a species also change its death burst and sounds (feathers, quills, a clank for toys)?

## Prototype map

- `src/gen/cast.ts`: kind lists (`PRINTS`, `SPECIES`, `TOYS`), `rollCast`, `assignCast`.
- `src/render/cast/`: `draw.ts` (the shared frame and kit), `prints.ts` (A), `species.ts` (B), `toys.ts` (C), `kit.ts` (wings, antennae, muzzles), `sheet.ts` (the catalog and bench, `slagDebug.cast`), `index.ts` (the `?cast` flag and dispatch).
- Hooks: `drawInkRunner` and `drawInkAccessory` hand off when the flag is on; `Renderer` runs the rig on the kind's tail (`castDef`) and keeps the lobby on distinct kinds (`castLobby`).
- Not ported: the main menu's crowd, which still draws through the older `drawCharacter`.
