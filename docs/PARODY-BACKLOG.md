# Parody backlog

Status: a proposal for the owner to pick from. Nothing here is built.

The owner's ask: widen the parody well from the build-race game, Nintendo and the crossover brawler to iconic pop-culture games in general. The TF2 sentry turret is the example. This is a ranked list of objects people recognise at a glance that could become a part, a held item or a set piece, mapped onto what the sim already has.

Rules every row follows (`DESIGN.md` → Parody, and the owner's new rules):

- **No faces, no personas.** No part, item or projectile has eyes, a mouth or a character. The joke comes through shape, material and mechanism.
- **Ours only.** The source game is named here, for us, and never in the game. Every idea gets a spoof name and our own drawing, never the original's art or layout.
- **Items never kill on their own.** They bonk, shove and misdirect, and the level does the rest.
- **Fair first.** Every timed or triggered thing shows a tell, and solids stop whatever travels.

Scores: **R** is recognisability (1–5), **F** is fun in our loop (1–5: does it make interesting placements and races?), **E** is effort (S = data, a recipe or a variant of existing code plus art; M = new behavior inside an existing registry; L = a new module, runner state or sim system). **Score** = R × F ÷ E, with S = 1, M = 2, L = 3.

## In progress elsewhere

| Candidate | Source | State |
|---|---|---|
| Sentry turret | TF2's Engineer sentry gun [1] | Another agent is building it. Not duplicated here. |
| Warped pipes | The plumber's warp pipes; also Among Us vents [2], TF2's teleporter [1], Overwatch's teleporter [3] | On a branch (`fd46c51`, "Replace the portal with warped pipes"). Vents and teleporters are reskins of it, not new rows. |

## 1. Ranked candidates

Mappings name existing modules (`src/sim/props/types.ts`) and item code (`src/sim/items/`). "New" marks anything the sim lacks.

| # | Our names | Source game | Object | What it does in slag | Role | Silhouette (faceless) | Gag | E | R | F | Score |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | **Walk-Off Bat**, Dinger, Grand Slammer | Smash Bros. [4] | Home-run bat | One charged swing: hold Use to wind up (rooted while winding), release to bonk a rival with about 3× the sword's knock. Swats shots like the noodle. 1 use. A sword variant (`SWORD` tuning, own `ItemSpec`). | item | A long bat held over the shoulder, tape on the grip | A full hit pops a distance readout ("412 FT") off the victim | S | 4 | 5 | 20 |
| 2 | **Launch Plate**, Leap of Faith Plate, Express Pad | Quake jump pads, Halo man cannon [5], Portal 2 faith plate [6], Fortnite launch pad [7], Galaxy launch star [8] | Jump pad that throws you along a set arc | A floor plate that *sets* your velocity to a fixed arc and lands you on a marked spot, where a spring adds an impulse. Place shows the dotted arc and the landing X. `spring` + an additive `exact` flag. | utility | A round hinged plate with an arrow; a chalk X where it lands | The X is a chalk bullseye; the plate is stamped NO REFUNDS | S | 4 | 4 | 16 |
| 3 | **Tremor Brick**, Floor Punch, Shake Block | Mario Bros. POW block [9] | The block that shakes everything on the floor | Use slams it: every rival touching ground is bonked; anyone airborne is untouched. 1 use. New `ItemSpec`, a loop over runners calling the existing bonk. | item | A chunky block held overhead, a seismograph zigzag on its face | After the slam the zigzag goes flat | S | 4 | 4 | 16 |
| 4 | **Four-Square**, Long Piece, Tetra Block | Tetris [10] | The seven four-cell pieces | A building part whose shape is one of the seven four-cell pieces, in bevelled single-colour cells. A shape option on the `platform` recipe; no new module. Stretch: a "Line Clear" charge (a long horizontal `line` blast). | build | Four bevelled squares | S and Z pieces turn up a little too often [10]; place shows a hard-drop ghost straight below | S | 5 | 3 | 15 |
| 5 | **Front-Runner Tax**, Tall Poppy, Leader Seeker | Mario Kart spiny shell [11] | The shell that hunts whoever is first | Use launches a winged spiked shell over terrain to the runner nearest the flag, circles above them for 1 s (shadow and whistle as the tell), then dives: bonk plus a wide knock within 2 tiles. If you lead, it comes for you. The spawn zone pops it. New `ItemSpec` + homing ammo that ignores terrain (`AMMO_SIM`, like `seeker`). | item | A spiked dome on two flapping wings | The wings are folded paper with "1ST" circled in red | M | 5 | 5 | 12.5 |
| 6 | **Boost Strip**, Express Lane, Speed Bump | Mario Kart dash panel [11], Sonic speed booster [12], Rocket League boost pads [13], Spyro supercharge ramp [14] | Speed-boost floor pad | An attachment strip: touch it and your speed snaps to about 1.6× run in its arrow's direction for half a second, with no skid while boosted. On a wall it flings you up or down the face. New `CoatKind` `'boost'` (additive), mounted like any coat. | utility | A flat plate of three chevrons | Painted road arrows with skid marks; one name is Speed Bump | M | 5 | 5 | 12.5 |
| 7 | **Panic Button**, Pressed for Time, Switcheroo | Mario P Switch [15] | Switch that turns things solid for a while | A floor button plus a dotted outline of 3–6 block cells nearby. Hitting the button makes the cells solid for 5 s, ticking before they go; a cell with a runner in it waits until it's clear. Help yourself across, or time it to strand someone. `phase` cells driven by a new trigger. | build | A dome button on a plate; dotted block outlines | The button's safety flip-cover is taped open | M | 5 | 5 | 12.5 |
| 8 | **Fuse Crate**, Short Fuse, Three-Second Rule | Crash TNT crate [16], Minecraft TNT [17], Angry Birds TNT box [18] | The crate that counts down when you land on it | A solid crate you can stand on. Landing lights a 3-count painted on its side (beeps), then it blasts: lethal within about 1.5 tiles, no terrain damage. It regrows after 6 s. Shots, flames and blasts set it off at once, so they chain. `body` + a new trigger-and-blast module. | build / hazard | A slatted crate with a stencilled lit fuse | FRAGILE stencil crossed out, VERY written over it | M | 5 | 5 | 12.5 |
| 9 | **Pocket Block**, Brick in a Bag, Flat-Pack Floor | Minecraft block placing [17], Fortnite building [7], Worms girder [19] | Build a block where you stand | 3 uses. Use puts one solid block in the cell in front of your feet (in the air, right under you). It lasts 4 s, then crumbles. It refuses protected zones, runners and solids. New: transient solids in `RunWorld`, reusing the blink-block rule that never fills a cell with someone in it. | item | A cube of turf carried like a lunchbox | Each block wears an assembly-instructions sticker | M | 5 | 5 | 12.5 |
| 10 | **Y-Fling**, Rubber Band Rodeo, Sling Shooter | Angry Birds slingshot [18] | Pull back and let go | A grab part: touch it and you sit in the pouch. Hold a direction to pull back (the band stretches the other way); jump fires you opposite your pull, harder the longer you held. Hold too long and the band snaps, drops you and regrows. `keg` with a player-aimed mode. | utility | A forked stick, a band and a pouch | Your last shot's dotted path stays drawn, as in the original's replay trail | M | 5 | 5 | 12.5 |
| 11 | Master Noodle gains a pogo (no new name) | Hollow Knight nail-bounce [20] | Bounce off spikes with a downward swing | A swing aimed below you while falling bounces you up off spikes, hazards and heads instead of hitting them. Down + Use already tosses, so the pogo needs its own trigger (a swing while falling fast, say). | item tweak | The noodle pointing down | The noodle compresses like a pogo spring | S | 3 | 4 | 12 |
| 12 | **Screensaver**, Corner Hit, Rally Ball | Pong [21], the bouncing DVD logo | A ball that bounces forever | One square ball that banks off every solid at constant speed, lethal. A `launcher` firing one long-life `ricochet` and refiring when it pops. | hazard | A square ball and a small dock it launches from | A dead-on corner hit flashes every colour | S | 4 | 3 | 12 |
| 13 | **Turf Bomb**, Splat Pack, Wet Paint | Splatoon splat bomb and ink [22] | Paint grenade | Thrown; it bursts into a 3-tile patch of slime coat for a few seconds (`goo` ammo already coats open terrain). Stretch: the thrower runs at full speed on their own paint. | item | A paint can with a pull ring | A WET PAINT sign stays stuck in the splash | S | 4 | 3 | 12 |
| 14 | **Hot Potato**, Clingy Grenade, Sticky Note | Halo plasma grenade [48] | Sticky grenade | Thrown; it sticks to the first rival it touches and goes off 2 s later (bonk plus a big knock). The carrier can pass it on by touching anyone. New `ItemSpec` + a stuck-to-runner field on `RunnerItems`. | item | A glowing orb with a short stalk | It's a baked potato in foil, steaming | M | 4 | 5 | 10 |
| 15 | **Big Flinger**, Sweeper Arm, Padded Paddle | Fall Guys spinning hammers and flippers [23] | Giant padded sweeper | A spinning or swinging padded paddle that knocks runners (bumper power) instead of killing them, which makes it a pit-sender. `swinger` with a new `head: 'paddle'` and a knock effect. | hazard | A long padded paddle on a hub | The pad is a boxing glove | M | 4 | 5 | 10 |
| 16 | **Crosshair**, Light Gun, Open Season | Duck Hunt Zapper [24] | Light-gun reticle | A reticle drifts toward the nearest runner, slower than a walk; held on target it tightens for 1 s, then flashes a lethal shot at its centre. It only fires where its gun on the mount can see, so walls are cover. New module `reticle`. | hazard | A ring with tick marks over a small gun on the mount | Three shell-shaped pips beside the gun, refilled after each volley | M | 4 | 5 | 10 |
| 17 | **Clicker Charge**, Detonator, Push-Button Pop | GoldenEye remote mine [25], TF2 sticky bombs [1], Overwatch concussion mine [26], Bomberman remote [27] | Stick a charge, set it off later | 2 uses. First Use sticks a charge to the surface you face; second Use pops it: a radial knock with a bonk that throws everyone near, you included, so it's also a blast jump. New `ItemSpec` + a stuck drop. | item | A puck with a blinking antenna; you hold a clicker | The clicker is a TV remote | M | 4 | 5 | 10 |
| 18 | **Cold Shoulder**, Ice Breaker, Freeze Frame | Overwatch ice wall [3] | Raise a wall of ice | Use grows a 3-tall ice column out of the floor in front of you over 0.3 s; it lifts anyone standing there and melts after 3 s. Transient solid that rises (as #9). Build #9 or #18, not both. | item | A column of clear ice cubes | An ice-cube-tray seam on each block | M | 4 | 5 | 10 |
| 19 | **Bounce Glaze**, Rubber Paint, Spring Coat | Portal 2 repulsion gel [6], Minecraft slime block [17] | Bouncy paint | An attachment: floors bounce like jelly blocks and keep your momentum; walls bounce you off. New `CoatKind` `'bounce'` reusing jelly restitution. | utility | A glossy coat | A rubber squeak on every bounce, with the splat that made it at one edge | M | 4 | 5 | 10 |
| 20 | **Slip Peel**, Potassium Mine, Peel Out | Mario Kart banana [11] | Banana peel | 3 uses. Use drops a peel behind you; it lies on the floor until someone steps on it, and they spin out (no control for half a second, skidding). New `ItemSpec` + a floor-lying shot with a new slip effect. | item | A peel lying flat | A tiny ORGANIC sticker on the peel | M | 5 | 4 | 10 |
| 21 | **Totally a Box**, Plausible Deniability, Flat-Pack Ninja | Metal Gear cardboard box [28] | Hide under a box | Use dons a box for 4 s: trackers and seekers lose you, you shuffle at walking speed with no jumps, and you're a crate others can stand on. Use again, or any hit, drops it. New `ItemSpec` + a hidden flag that tracker and seeker targeting skip. | item | A box with the runner's feet underneath | The shipping label is addressed to THE FLAG | M | 5 | 4 | 10 |
| 22 | **Ooze Drum**, Hazmat Drum, Red Barrel | Doom exploding barrel [29] | Exploding barrel | A solid drum that goes off when a shot, flame, laser, arc or blast touches it (a 0.4 s hiss first): lethal within 1.5 tiles, and it sets off drums and Fuse Crates nearby. It regrows after 8 s. Same module as #8 with a shot trigger. | hazard | A ribbed drum with a hazard stencil | The stencil says NOT A BARREL | M | 5 | 4 | 10 |
| 23 | **Power Snack**, Big Pill Energy, Snack Attack | Pac-Man power pellet [30] | Turn the tables | Use eats it: for 4 s every rival tints blue and wobbles, and touching one bonks them. You can still die. New `ItemSpec` + touch-bonk in `sim/collide.ts`. | item | A big round pellet | A nutrition label flutters off as it's eaten | M | 5 | 4 | 10 |
| 24 | **Barrel Rollout**, Keg Bowling, Girder Gutter | Donkey Kong rolling barrels [31] | Barrels rolling down girders | A chute that drops barrels which roll along floors at walking pace, fall off edges onto the floor below and keep rolling. Lethal; you hop them. New `LauncherStyle` + an ammo that follows floors (the Evicted Shell's slide). | hazard | A rack of barrels on a sloped chute | Each barrel is stamped 5¢ DEPOSIT | M | 5 | 4 | 10 |
| 25 | **Plot Armor**, Main Character, Glitter Bomb | Mario super star [52] | Invincibility star | 4 s of immunity to hazards (the shield's `guard`), but you're locked into a full run and can't stop or turn back. Pits still kill. A short daze when it ends. New `ItemSpec` + a forced-run override. | item | A gold foil star stuck on your chest; you sparkle | The music drops to a tinny loop for 4 s | M | 5 | 4 | 10 |
| 26 | **Yoinkshot**, Clawback, Grabby Claw | Zelda hookshot [32], Metroid grapple beam [32], Worms ninja rope [19] | Grappling hook | Fires a claw up-forward up to 8 tiles. If it bites a solid it reels you there; if it hits a rival it yanks them to you with a bonk. Uses the grab-prop machinery as a transient grab. | item | A spring-loaded extending claw | It's the toy litter-picker grabber | L | 5 | 5 | 8.3 |
| 27 | **Gacha Capsule**, Capsule Toy, Surprise Egg | Pokémon's thrown ball and Smash's summon items [4] | Throw a ball, something pops out | Thrown; it opens where it lands and deploys a random small faceless part for 5 s (spring, fan, spike tuft, bumper, web). New: props spawned mid-race. | item | A two-tone capsule toy with a hinge seam | A tiny folded "assembly required" sheet falls out | L | 5 | 5 | 8.3 |
| 28 | **Hallelujah Grenade**, Blessed Pineapple, Choir Bomb | Worms holy hand grenade [19] | The overpowered grenade | Thrown on a bouncy arc with a 3-s fuse; a huge knock within 3 tiles, you included. New `ItemSpec` + a timed shot + radial bonk. | item | An ornate gold grenade with a crown pin | One sustained choir note before the blast | M | 4 | 4 | 8 |
| 29 | **Toe Trap**, Gotcha Hole, Sticky Situation | Overwatch steel trap [26], Animal Crossing pitfall (a Smash item) [4] | Floor trap that roots you | Use drops it on the floor, half hidden (only its rim shows). The first rival onto it is rooted for 1.2 s. New `ItemSpec` + a root status. | item | A giant spring-bar mousetrap | A cheese cube as the bait | M | 4 | 4 | 8 |
| 30 | **Prox Mine**, Motion Censor, Doorbell Mine | GoldenEye proximity mine [25], Smash motion-sensor bomb [4] | Proximity mine | A face-mounted mine. A runner moving fast within 2 tiles sets it off (0.4 s beep, then a 1.5-tile lethal blast; it rearms after 6 s). Walking past slowly doesn't set it off, as in the velocity-sensitive mines of the GoldenEye remake [25], which turns walk vs run into the counter. A sibling of `snapper`. | hazard | A flat puck with a red LED | It chimes like a doorbell instead of beeping | M | 4 | 4 | 8 |
| 31 | **Parasol**, Fair-Weather Brolly, Leaf It Out | Zelda Deku leaf / paraglider [32], Lemmings floater [33] | Glide down | Hold Use to open: you fall slowly and drift; wind gusts and fans push it hard; no jumping while it's open. 6 s of canopy. New `ItemSpec` + a fall cap. | item | An umbrella | A cocktail umbrella, toothpick and all | M | 4 | 4 | 8 |
| 32 | **Payload**, Push Cart, Delivery Cart | TF2 payload [50] | Escort the cart | A cart on rails that rolls forward only while a runner stands on or beside it, and drifts back when left alone. A ride you have to earn, which rivals can stall. `vehicle` with an escort drive mode. | set piece / build | A mine cart carrying a big round load | The load is a giant gift-wrapped parcel | M | 4 | 4 | 8 |
| 33 | **Commuter Block**, Rush Hour, Green Light | Celeste traffic block [34] | Block that zips when stood on | Stand on it: its light goes red, then green, it zips to the end of its rail fast and stops dead (flinging you on), then crawls back. `body` with a triggered rail motion. | build | A block with a traffic light and a short track | A MIND THE GAP stripe on its edge | M | 3 | 5 | 7.5 |
| 34 | **Plus-One Cube**, Emotional Support Cube, Shove Box | Portal companion cube [49], Spelunky push block [35] | A block you push | A 1×1 block that slides when walked into (the runner shove rules), falls, and plugs a 1-tile gap. It resets each round. New module: a dynamic solid. | build | A quilted cube with a stitched heart patch | One violin note when it falls in the pit | L | 5 | 4 | 6.7 |
| 35 | **Bag Check**, Confiscation Gate, Security Check | Portal emancipation grill [49] | Field that deletes what you carry | A shimmering curtain between two posts (up to 5 tiles). Passing through fizzles your held item and pops shots; runners pass freely. New module; the geometry is `tesla`'s. | utility | Two posts and a light curtain | A grey plastic tray beside one post | M | 3 | 4 | 6 |
| 36 | **Pink Slip**, Parry Puff, High-Five Orb | Cuphead parry [36] | Pink means you can bounce on it | Launcher ammo: a pink puff that knocks you if it hits you, but jumping into it with jump held bounces you up like a second jump. New `Ammo` + `AMMO_SIM` behavior. | hazard / utility | A pink puff ball | It's a pink termination notice crumpled into a ball | M | 3 | 4 | 6 |
| 37 | **Diving Raft**, Dunk Deck, Sinker Plank | Frogger diving turtles [37] | Platform that sinks on a beat | A moving platform on a rail that ducks under (not solid) for 1 s every few seconds, bubbling first. Composes `body` + rail `motion` + `phase`. | build | A raft of three lashed logs | A wooden duck decoy rides it | M | 4 | 3 | 6 |
| 38 | **Pixel Bunker**, Chip Shield, Bite-Size Fort | Space Invaders shields [38] | Shield that erodes under fire | An arch of cells that chip away one at a time under shots, flames and lasers; a lost cell stays gone for the round. A shield against launchers that wears out. `body` with per-cell hits. | build | The notched arch | The bites look like bites | M | 4 | 3 | 6 |
| 39 | **Scaffold**, Step Ladder, Rung Stack | Minecraft scaffolding [17], Donkey Kong ladders [31] | A ladder | A vertical stack of jump-through rungs two tiles apart, so a wall can be climbed with walking hops. A new additive `oneway` body material. | build | A timber ladder | DO NOT STAND ON TOP STEP on the top rung | M | 4 | 3 | 6 |
| 40 | **Physics Mitt**, Tractor Mitt, Grabity Gun | Half-Life 2 gravity gun [39] | Grab and punt | Use pulls the nearest loose item, shot or rival in a cone toward you; Use again punts it (a rival is bonked; a shot becomes yours). | item | A three-pronged claw emitter | It's a leaf blower with prongs taped on | L | 4 | 4 | 5.3 |
| 41 | **Teeter Plank**, Seesaw, Balance Beam | Fall Guys seesaws [23] | Plank that tips under weight | A plank on a pivot that tips toward the heavier side and slides runners off when steep. New module: a tilting solid on an axis-aligned tile world. | build | A plank on a triangle | A spirit-level bubble set into the plank | L | 4 | 4 | 5.3 |
| 42 | **Star Taxi**, Cosmic Cab, Wish Upon a Car | Kirby warp star [40] | Ride a star | Use summons a star you ride in a straight line until it hits a solid, then it crashes and bonks everyone near. Transient grab vehicle. | item | A five-point star like a surfboard | A taxi meter on its nose | L | 4 | 3 | 4 |
| 43 | **Lint Ball**, Clump, Rolling Collection | Katamari Damacy [18] | Ball that grows by picking things up | A ball rolling a loop that collects loose items and carries runners it touches for a second, growing as it goes. | set piece | A lumpy ball bristling with junk | A sock is always the first thing stuck to it | L | 4 | 3 | 4 |
| 44 | **Write-Off**, Bonus Sedan, Total Loss | Street Fighter II bonus car [41] | The car you beat up | A parked car you can stand on; every landing dents it, and after five it's a wreck, gone for the round. `crumble` with a hit counter. | build | A boxy sedan | Its plate reads B0NUS | M | 4 | 2 | 4 |
| 45 | **Respray Booth**, Spray 'n' Pray, Quick Coat | GTA Pay 'n' Spray [42] | The garage that makes you someone else | A booth you run through: it clears freeze, slow, daze and soot, takes your held item, and sprays your body a random colour for the round. | utility | A garage with a roll-up door | You come out a different colour | M | 4 | 2 | 4 |
| 46 | **Second Wind**, Comeback Feather, Extra Life Insurance | Final Fantasy Phoenix Down [51] | Revive | Carried: if you die holding it, you pop back on your last safe footing a second later, dazed. The kill still credits the killer. New: a revive runner state. | item | A single bright feather | It's a quill pen clipped to a claim form | L | 4 | 3 | 4 |
| 47 | **Step Builder**, DIY Stairs, Self-Assembly | Lemmings builder [33] | Builds a staircase brick by brick | A kit that lays 8 bricks diagonally, one every quarter second from the race start. New: terrain-like solids that grow during a race. | build | A crate of bricks with a trowel | The last brick is always missing | L | 3 | 3 | 3 |

### Source inventory

Every game the brief named, the objects considered, and where each one went.

| Game or series | Objects | Verdict |
|---|---|---|
| Mario | POW block, P Switch, super star; warp pipe, Bill Blaster, Thwomp, fire bar, donut lift, note block, bob-omb, chain chomp | #3, #7, #25. The rest exist: warped pipes (in progress), `rocket` launcher, `dropper`, Spin Bar, `crumble`, jelly blocks, `bomb`, `flail`. |
| Mario Kart | Spiny shell, banana, dash panel; item box | #5, #20, #6. The item box is our loot box. |
| Zelda | Hookshot, Deku leaf / paraglider; bombs | #26, #31. Bombs exist. |
| Metroid | Grapple beam, bomb jump; speed booster | Grapple → #26, bomb jump → #17, speed booster → #6. |
| Kirby | Warp star | #42 |
| Donkey Kong | Barrel cannon; rolling barrels, ladders | The keg exists; #24, #39. |
| Pokémon | Thrown ball | #27, with nothing alive inside. |
| Smash Bros. | Home-run bat, motion-sensor bomb, pitfall; bumper, crates | #1, #30, #29. Bumper and loot box exist. |
| Splatoon | Splat bomb, ink turf | #13 |
| Animal Crossing | Pitfall seed | #29 |
| Sonic | Speed booster; springs, spikes | #6. Springs and spikes exist. |
| Mega Man | Appearing blocks, Rush Coil [43] | Both exist: Yolo Blocks (`blinker`) and Coil Pup (`spring`). |
| Pac-Man | Power pellet | #23 |
| Tetris | The seven pieces | #4 |
| Space Invaders | Shields | #38 |
| Street Fighter | Bonus-stage car | #44 |
| Half-Life | Gravity gun; red barrel | #40; the barrel trope is #22. |
| Portal / Portal 2 | Companion cube, gels, faith plate, emancipation grill; turret, excursion funnel | #34, #19, #2, #35. The turret is the sentry in progress; the funnel is a slow `fan`. Propulsion gel is our ice coat (see Overlap). |
| TF2 | Sentry, stickies, payload cart; teleporter | Sentry in progress; #17, #32. Teleporter → warped pipes. |
| Halo | Man cannon, plasma grenade; gravity lift | #2, #14. The gravity lift is a `fan`. |
| Doom | Exploding barrel; crusher ceilings | #22. Crushers exist. |
| Quake | Jump pad; rocket jump | #2; #17. |
| GTA | Pay 'n' Spray | #45 |
| Minecraft | TNT, block placing, slime block, scaffolding; piston | #8, #9, #19, #39. Piston is the crusher. |
| Fortnite | Launch pad, building | #2, #9. |
| Overwatch | Ice wall, steel trap, concussion mine; turret, teleporter | #18, #29, #17. The turret is the sentry; the teleporter → pipes. |
| Among Us | Vents, emergency button | Vents → pipes. The button is an alternative look for #3. |
| Fall Guys | Spinning hammers, seesaws; vanishing hex tiles, big fans | #15, #41. Hex tiles are `crumble`; big fans are the proposed great wheel (`SETPIECES.md`). |
| Rocket League | Boost pads | #6 |
| Metal Gear | Cardboard box | #21 |
| Resident Evil | Typewriter save room, ink ribbon [44] | No part. An art nod at most: a typewriter in the spawn pocket, which is already the one safe room. |
| Final Fantasy | Phoenix Down | #46 |
| Celeste | Traffic block; springs, crumble blocks | #33. The rest exist. |
| Super Meat Boy | Saw blades [45] | Exist (`saw`). |
| Spelunky | Push block, rope; arrow trap, tiki trap [35] | #34; a thrown rope is a cheaper cousin of #26. Arrow trap (`crossbow`) and tiki trap (`snapper`) exist. |
| Hollow Knight | Nail pogo | #11 |
| Cuphead | Pink parry | #36 |
| Crash | TNT crate, bounce crate; Nitro crate [16] | #8. Bounce crate = jelly block; Nitro = a `spikeblock` look (see Overlap). |
| Spyro | Supercharge ramp | #6 |
| Rayman | Purple lum swing point [46] | A look for the Sausage Vine lowered from open sky. |
| Angry Birds | Slingshot, TNT, glass / wood / stone blocks | #10, #8. Breakable materials are `crumble` looks. |
| Katamari | The sticky ball | #43 |
| Bomberman | Remote bomb, kick; plus blast | #17. Kick is the Evicted Shell; plus blast is Arena Bomb. |
| Worms | Holy hand grenade, ninja rope, girder; banana bomb | #28, #26, #9. Banana bomb is the Banana Mortar. |
| Lemmings | Floater, builder; digger | #31, #47. Digger is the drill. |
| Frogger | Diving turtles, logs | #37 |
| Pong | Ball, paddle | #12 |
| Duck Hunt | Zapper reticle | #16. The dog is a persona and stays out. |
| GoldenEye | Proximity and remote mines | #30, #17 |

## 2. Gaps

What the roster has today (`src/gen/props.ts`): **4 build** parts (platform with the bridge, crumble, blinker, wheel), **13 hazards**, **11 utilities**, **5 demolition** kinds, and **6 held items**.

- **Held items are the thinnest pool.** Six items carry every loot box, and they cover three jobs only: bonk someone (sword, shell, boomerang), protect yourself (bubble wrap) and get somewhere (jetpack), plus the smoke. Missing:
  - **Catch-up:** nothing punishes the leader. #5 Front-Runner Tax.
  - **Building:** no item makes footing. #9 Pocket Block (or #18).
  - **Area control:** nothing hits everyone. #3 Tremor Brick.
  - **Traps you lay:** #20 Slip Peel, #29 Toe Trap, #17 Clicker Charge.
  - **Big single hits:** #1 Walk-Off Bat, #28 Hallelujah Grenade.
  - **Stealth and defence:** #21 Totally a Box; #25 Plot Armor.
  - **Gliding:** #31 Parasol.
- **Build is thin and static.** Every build part sits still or runs on its own timer. Nothing is *triggered* by a runner, so nothing builds for you and against the next player at once. Fill: #7 Panic Button, #33 Commuter Block, #8 Fuse Crate (a ledge that bites). Nothing builds *vertically*: #39 Scaffold. Shape variety: #4 Four-Square.
- **Surfaces have two coats.** Ice and slime are the only surface changes. #6 Boost Strip and #19 Bounce Glaze add a fast surface and a bouncy one.
- **Few non-lethal hazards.** Only the bumper and the magnet push without killing. #15 Big Flinger and #36 Pink Slip send runners into pits instead, which is the "not everything is death" rule and pays the placer through kill credit.
- **Parts hardly interact.** Today a solid stops a beam, and that's it. #8 and #22 chain off each other and off every launcher; #21 beats trackers; #35 strips items; #38 soaks shots. Combos are what make a pile-up of props funny in round 10.
- **Rewarding the walk.** #30 Prox Mine only wakes for runners moving fast, so walking past slowly is the counter. It makes walk vs run a choice in a new place.
- **Demolition is fine.** Five kinds already. Nothing here adds mid-race terrain destruction on purpose: removing terrain during a race could break the proven plan.

## 3. Recommended first batch

The top ten by score. They come out 4 items and 6 parts, and every one fills a gap above. Each brief stands alone for one agent. Everything shared: read `AGENTS.md`, `docs/DESIGN.md` → Props, `docs/PARODY.md` and `docs/ART.md` first; keep shared-contract changes additive and say so in the report; add the row to `docs/PARODY.md`, and a line to `DESIGN.md` → Props for anything a player can see.

Items: `ItemKind` and `ITEM_KINDS` in `src/sim/items/types.ts`, an `ItemSpec` in `src/sim/items/roster.ts`, any shot in `src/sim/items/ammo.ts`, art in `src/render/items.ts`, tests in `tests/items.test.ts`. Parts: a recipe in `src/gen/props.ts` (`RECIPES`, `ARCHETYPE_WEIGHTS`), modules under `src/sim/props/modules/` and `src/render/props/modules/`, tests in `tests/props-sim.test.ts` or `tests/new-props.test.ts`.

### 1. Walk-Off Bat (item, S)
- **Build:** a new item kind, 1 use. Hold Use to wind up (rooted, about 0.6 s at full charge), release to swing. Reuse the sword's hit test and swat. Knock scales with charge, up to about 3× `SWORD.knockVx/knockVy`. An uncharged tap is a weak swing.
- **Art:** a bat raised over the shoulder while winding, a long arc on release. The distance readout pops on a full-charge hit only.
- **Done when:** a test shows a full-charge hit bonks and knocks harder than the sword; a tap knocks less; winding roots the swinger; it reflects a shot. `pnpm check` passes. Screenshot of the wind-up and the hit (`?race=` plus `slagDebug.give`).

### 2. Launch Plate (utility, S)
- **Build:** a `spring` recipe with an additive `exact?: true` on the module. When set, `RunWorld` *sets* the runner's velocity to the plate's vector and doesn't add to it, so every launch lands in the same place from any entry speed. Roll the power from a short list so the arc lands 6–12 tiles away. Place draws the dotted arc and the landing X from the real controller's ballistic step, not a hand formula.
- **Done when:** a test launches runners with different entry speeds and they all land within a tile of each other; the ghost's arc matches the measured landing. Screenshots of place (arc visible) and mid-flight.

### 3. Tremor Brick (item, S)
- **Build:** a new item kind, 1 use. Use bonks every rival with `onGround` (existing bonk, credit to the user), except runners in the spawn zone, finished or dead, or inside a grab. A screen shake is render only.
- **Done when:** a test shows grounded rivals are dazed and credited, airborne rivals and the user aren't, and the spawn zone protects. Screenshot of the slam.

### 4. Four-Square (build, S)
- **Build:** a shape option on the `platform` recipe: one of the seven four-cell pieces, each with an equal share, except the long straight piece at about half. Cells are bevelled squares in one colour per piece. No new module. The bridge stays the bridge; this is the "another building part" slot.
- **Done when:** a test checks every rolled shape is one of the seven, connected, four cells; crate cards draw them. `pnpm shot props --count 24` and a race screenshot.

### 5. Front-Runner Tax (item, M)
- **Build:** a new item kind, 1 use, and a new item shot. Target: the live, unfinished rival with the smallest distance to the flag (reuse whatever distance field `reach` already exposes; otherwise straight-line distance), ties to the lower slot. If the user leads, it targets the user. The shell flies over terrain at a fixed speed, hovers above the target for 60 frames (shadow on the ground, whistle), then dives: bonk plus knock to every runner within 2 tiles. The spawn zone and finishing pop it harmlessly. Deterministic: no `Map` iteration order, plain data.
- **Done when:** tests show it picks the leader, retargets if the leader finishes, never hits in the spawn zone, and that two identical runs give the same hash. Screenshot of the hover tell and the dive.

### 6. Boost Strip (utility, M)
- **Build:** an additive `CoatKind` `'boost'` (shared contract, call it out). A runner touching a boost face gets horizontal speed set to about 1.6× run speed in the arrow's direction (rotation picks it) for 30 frames, with no skid; a wall strip sets vertical speed instead. Weather leaves it working, as it does conveyors. `reach.ts` treats it like any other coat: a no-go cell for the proof.
- **Done when:** a test shows the boost speed, its direction under rotation, and the wall variant; placement mounts like a coat. Screenshot of a runner leaving a strip.

### 7. Panic Button (build, M)
- **Build:** a new archetype with a button cell and 3–6 outline cells within about 6 tiles (rolled as a straight bridge). Pressing (standing on it or bumping it) makes the outline cells `phase`-solid for 300 frames, with a ticking tell in the last 60. A cell with a runner in it stays open until it's clear, the blink-block rule. Pressing again while it's on restarts the timer. The proof treats the cells as gone, as with any timed solid.
- **Done when:** tests cover press → solid → tick → gone, the occupied-cell rule, and re-press. Screenshots of place, of the pressed state and of the tick.

### 8. Fuse Crate (build / hazard, M)
- **Build:** a new archetype: a solid crate body plus a new module, say `fuse`, with `trigger: 'land'` (here) and `'shot'` (for #22 later). Landing on top starts a 180-frame countdown, drawn 3-2-1 on the crate; then a lethal disk of about 1.5 tiles that clears no terrain and no props; the crate is gone for 360 frames, then regrows (never inside a runner). Any shot, flame, laser, arc or blast touching it fires it at once. Credit goes to the owner, as with any trap.
- **Done when:** tests cover the countdown, the blast radius, chain reactions between two crates, a shot trigger, and regrowth. Screenshot of a mid-count crate and the blast.

### 9. Pocket Block (item, M)
- **Build:** a new item kind, 3 uses, and transient solids in `RunWorld`: a list of cells with an expiry frame, snapshot-friendly, that `build` adds to the solids each frame. Use puts one in front of your feet, or under you when airborne. It refuses protected zones, cells with a runner in them, and solids. It crumbles after 240 frames. Wind, conveyors and blood don't apply to it.
- **Done when:** tests show placement, every refusal, expiry, that it survives a snapshot round trip, and that it's identical across two runs. Screenshot of a runner bridging a gap with it.

### 10. Y-Fling (utility, M)
- **Build:** an additive keg mode, `aim: 'player'`. In the pouch the held stick direction sets the aim (opposite the pull), and the hold time sets power up to a cap. Jump fires. Past `strain` frames the band snaps and drops you, regrowing like the vine. All grab rules carry over: one runner, cooldown, released by shoves.
- **Done when:** tests show aim follows the opposite of the stick, power grows with the hold, the snap and regrowth, and the grab rules. Screenshots of a pulled band and of a release.

Next in line, if one of these stalls: #21 Totally a Box, #15 Big Flinger, #14 Hot Potato.

## 4. Overlap

| Candidate | Overlaps | Verdict |
|---|---|---|
| #2 Launch Plate | `spring`, whose name list already includes "Launch Pad" | Keep both: the spring adds, the plate sets. Move the "Launch Pad" name to the plate. |
| #10 Y-Fling | Kegapult | Build it as a keg mode, not a new module. Separate archetype and name, same grab code. |
| #6 Boost Strip | Conveyor platforms; ice coat | Keep. A conveyor drifts you slowly, ice raises top speed you have to build up, and the strip is an instant kick. |
| Portal propulsion gel | Ice coat, which already raises top speed | No row. Ice already is it. |
| #19 Bounce Glaze | Jelly blocks ("Bounce House") | Keep. It is jelly as an attachment you put on *existing* terrain, and adds the wall bounce. |
| #4 Four-Square | Platform recipe | A reskin and shape option of `platform`, not a new archetype. |
| #1 Walk-Off Bat | Master Noodle | Keep both. Four light swings vs one charged one. |
| #25 Plot Armor | Bubble Wrap; #23 Power Snack | Bubble Wrap soaks one hit; Plot Armor soaks everything for 4 s but drives you. Power Snack is the offensive half. Build at most one of #23 and #25 first. |
| #46 Second Wind | Bubble Wrap | Too close. Drop it unless the revive state comes for free some other way. |
| #8 Fuse Crate and #22 Ooze Drum | Each other; `bomb`, `timebomb` | One module, two triggers (land, shot). Bombs act at placement or race start and clear tiles; these only kill runners, mid-race. |
| Nitro crate | `spikeblock` | A look for the spike block (a crate that jitters), not a part. |
| #30 Prox Mine | `snapper` (pressure plate) | Keep: a blast radius and the speed sensor are new. It could also be built as a snapper option. |
| #29 Toe Trap | `web` | Keep as an item; a laid trap is new for items, the web is a placed part. |
| #24 Barrel Rollout | Evicted Shell; launcher styles | A new launcher style that borrows the shell's floor slide. |
| #12 Screensaver | `ricochet` launcher ammo | A launcher configuration, not a new module. |
| #16 Crosshair | Tracking launchers, sweeping lasers | Keep: it tracks a spot, not an aim, and shoots without travel. Its line-of-sight rule must match "solids stop whatever travels". |
| #18 Cold Shoulder | #9 Pocket Block | Same transient solids. Build #9 first; #18 is a later item on the same plumbing. |
| #26 Yoinkshot | Sausage Vine | Keep: the vine is a placed swing; the claw is a carried pull. |
| Rayman swing point | Sausage Vine lowered from open sky | A look, not a part. |
| #33 Commuter Block | Moving platforms on a rail | Keep: triggered, with a stop that flings. |
| #37 Diving Raft | Moving platform + blink blocks | A composition of existing modules: a recipe, not a module. |
| #35 Bag Check | EMP | Different targets: EMP clears placed props at placement; Bag Check strips held items during a race. |
| Among Us vents, teleporters | Warped pipes | Looks for the pipes, if anything. |
| Spike-ball trap, saw blades, arrow traps, crushers, falling blocks, donut lifts, bob-ombs, barrel cannons | `flail`, `saw`, `crossbow`, `crusher`, `dropper`, `crumble`, `bomb`, `keg` | Already ours. No rows. |

### Existing parts that break the no-face rule

These rows in `PARODY.md` give a part, item or projectile a face or a persona. Each needs a redraw if the rule is retroactive:

| Part | What breaks it | A faceless redraw |
|---|---|---|
| Thwunk / Grudge Block (`dropper`) | A carved face, eyes that follow you, a brow vein | A carved block with a cracked keystone that glows as it winds up |
| Cartoon Bomb (`bomb`) | Two feet, and eyes that squeeze shut | The fuse burns down a printed countdown on its band |
| Coil Pup (`spring`) | Ears and a wagging tail | Drop the persona; keep the coil, or a tennis-ball top |
| Grudge Launcher missile (`rocket`) | Angry eyebrows | Fins scrawled with tally marks |
| Sorry Turret (`turret`) | A worried face | Up to the sentry agent; the speech-bubble shots can stay |
| Heartburn Idol (`totem`) | The idol clutches its belly | An antacid bottle beside a plain carved pillar |
| Sneeze Cannon (`gooper`) | A big nose | A tissue box feeding the barrel |
| Boomerang Bruh (`glaive`) | A backwards cap (persona) | A sports-shop price tag on the launcher |
| Cursed Idol (jungle set piece) | Glowing eyes | Applies only if set pieces fall under the rule |

## 5. Questions for the owner

1. **Retroactive?** Do the existing faces and personas in the table above get redrawn now? Does the rule cover set pieces too?
2. **Transient solids.** Is it fine for items (#9, #18) to make solids mid-race? They never seal a level for longer than 4 s, and the proof never counts on them.
3. **Who's "first"?** Front-Runner Tax needs a leader: the shortest real route to the flag (fair, costs some work) or straight-line distance (cheap, sometimes wrong in towers)?
4. **Pogo trigger.** Down + Use already tosses an item. Should the noodle's pogo be a swing while falling fast, or should toss move?
5. **Sound-alike names** (`TODO.md` #15) apply to new names too: is "Plus-One Cube" or "Yoinkshot" too close a nod, or fine?

## Sources

1. TF2 Engineer and buildings (sentry, dispenser, teleporter): https://wiki.teamfortress.com/wiki/Engineer, https://wiki.teamfortress.com/wiki/Buildings_(Classic)
2. Among Us vents: https://among-us.fandom.com/wiki/Guide:Vent, https://www.shacknews.com/article/120530/how-to-use-vents-among-us
3. Overwatch ice wall, turret, teleporter: https://overwatch.fandom.com/wiki/Ice_Wall
4. Smash Bros. items (home-run bat, motion-sensor bomb, pitfall, bumper, Poké Ball): https://www.mariowiki.com/List_of_Super_Smash_Bros._series_items, https://ssbwiki.com/Home-run_Bat, https://ssbwiki.com/Proximity_Mine
5. Halo man cannon and gravity lift: https://www.halopedia.org/Man_cannon, https://www.halopedia.org/Gravity_Lift
6. Portal 2 gels and faith plates: https://developer.valvesoftware.com/wiki/Gel_(Portal_2), https://strategywiki.org/wiki/Portal_2/Gameplay
7. Fortnite bounce and launch pads: https://fortnite-archive.fandom.com/wiki/Bouncer, https://www.pcgamesn.com/fortnite/fortnite-bouncer
8. Galaxy launch stars: https://www.mariowiki.com/Launch_Star
9. POW block: https://www.mariowiki.com/POW_Block
10. Tetris and the falling-blocks trope, including HATETRIS's unwanted S pieces: https://giantbomb.com/wiki/Games/Tetris, https://gigazine.net/gsc_news/en/20110504_hatetris
11. Mario Kart items (spiny shell, banana, dash panel): https://www.mariowiki.com/List_of_items_in_the_Mario_Kart_series, https://www.mariowiki.com/Dash_panel
12. Sonic speed booster: https://info.sonicretro.org/Dash_Panel
13. Rocket League boost pads: https://dignitas.gg/articles/boost-management-in-rocket-league
14. Spyro supercharge ramps: https://spyrowiki.com/wiki/Supercharge_Ramp
15. P Switch: https://www.mariowiki.com/P_Switch
16. Crash crates (TNT, Nitro, bounce): https://strategywiki.org/wiki/Crash_Bandicoot/Items, https://giantbomb.com/wiki/Objects/TNT_Crate
17. Minecraft slime block and piston: https://minecraft.wiki/w/Slime_block, https://minecraft-archive.fandom.com/wiki/Piston
18. Angry Birds structures and TNT; Katamari's sticky ball: https://en.wikipedia.org/wiki/Angry_Birds_(video_game), https://www.pocketgamer.com/rolling-with-katamari/review/
19. Worms holy hand grenade, ninja rope, girder: https://worms2d.info/Holy_Hand_Grenade, https://worms2d.info/Holy_War
20. Hollow Knight nail-bounce (pogo): https://hollowknight.wiki/w/Old_Nail
21. Pong: https://en.wikipedia.org/wiki/Pong
22. Splatoon splat bomb, sprinkler, ink mine: https://splatoonwiki.org/wiki/Splat_Bomb, https://splatoonwiki.org/wiki/Sub_weapon
23. Fall Guys obstacles (Big Fans, Whirlygig hammers, Hex-A-Gone): https://mediatonicgames.com/blog/fall-guys-season-2-5-update-drops-today, https://www.gamesradar.com/fall-guys-tips
24. Duck Hunt and the Zapper: https://en.wikipedia.org/wiki/Duck_Hunt
25. GoldenEye proximity and remote mines (velocity-sensitive): https://docs.geshl2.com/weapons/proximity_mine, https://wiki.archives.geshl2.com/goldeneye/weapons/remote_mines, https://giantbomb.com/wiki/Objects/Proximity_Mines
26. Overwatch steel trap and concussion mine: https://overwatch.fandom.com/wiki/Junkrat
27. Bomberman power-ups (remote control, kick): https://bomberman.fandom.com/wiki/Power-Ups, https://strategywiki.org/wiki/Super_Bomberman_2/Power-ups
28. Metal Gear cardboard box: https://metalgear.fandom.com/wiki/Cardboard_box, https://giantbomb.com/wiki/Objects/Cardboard_Box
29. Doom exploding barrel and chain reactions: https://doomwiki.org/wiki/Exploding_barrel, https://zdoom.org/wiki/Classes:ExplosiveBarrel
30. Pac-Man: https://en.wikipedia.org/wiki/Pac-Man
31. Donkey Kong barrels: https://www.mariowiki.com/Barrel, https://www.mariowiki.com/Barrel_Cannon
32. Zelda hookshot and gliders; Metroid grapple beam and morph-ball bombs: https://zeldawiki.wiki/wiki/Hookshot, https://screenrant.com/legend-of-zelda-most-useful-items-ranked/
33. Lemmings skills (floater, builder, blocker): https://c64-wiki.com/wiki/Lemmings
34. Celeste chapters with traffic blocks and Kevin blocks: https://celestegame.fandom.com/wiki/Chapter_1:_Forsaken_City, https://celestegame.fandom.com/wiki/Reflection_C-Side
35. Spelunky push block, tiki trap, arrow trap, rope: https://spelunky.fandom.com/wiki/Push_Block_(HD), https://spelunky.fandom.com/wiki/Tiki_Trap_(HD), https://spelunky.fandom.com/wiki/Arrow_Trap_(Classic)
36. Cuphead parry (pink objects): https://cuphead.wiki.gg/wiki/Parry_Slap
37. Frogger diving turtles: https://en.wikipedia.org/wiki/Frogger
38. Space Invaders shields: https://www.raspberrypi.com/news/coding-space-invaders-disintegrating-shields-wireframe-9/, https://shmups.wiki/library/Space_Invaders
39. Half-Life 2 gravity gun: https://en.wikipedia.org/wiki/Gravity_Gun, https://combineoverwiki.net/wiki/Gravity_Gun
40. Kirby warp star: https://ssbwiki.com/Warp_Star
41. Street Fighter II car bonus stage: https://japanesenostalgiccar.com/street-fighter-final-fight-car-smashing-bonus-stages/
42. GTA Pay 'n' Spray: https://gta.wiki/wiki/Pay_%27n%27_Spray
43. Mega Man appearing blocks and Rush Coil: https://megaman.fandom.com/wiki/Yoku_Block, https://megaman.fandom.com/wiki/Rush_Coil
44. Resident Evil typewriters and ink ribbons: https://residentevil.fandom.com/wiki/Ink_Ribbon_(special_item)
45. Super Meat Boy saw blades: https://en.wikipedia.org/wiki/Super_Meat_Boy
46. Rayman swing points: https://raymanpc.com/wiki/en/Hook
47. Which games are "iconic": the World Video Game Hall of Fame classes (Doom, Pac-Man, Pong, Super Mario Bros., Tetris, Zelda, Sonic, Donkey Kong, Halo, Pokémon, Street Fighter, Final Fantasy VII, Super Mario Kart, Minecraft, Animal Crossing, Angry Birds), https://en.wikipedia.org/wiki/World_Video_Game_Hall_of_Fame
48. Halo plasma grenade (sticks, then a three-second fuse): https://www.halopedia.org/Grenade_Stick, https://giantbomb.com/wiki/Objects/Plasma_Grenade
49. Portal companion cube and emancipation grill: https://en.wikipedia.org/wiki/Weighted_Companion_Cube, https://theportalwiki.com/wiki/Fizzler
50. TF2 payload cart (rolls back when nobody pushes): https://wiki.tf2classic.com/wiki/Payload, https://developer.valvesoftware.com/wiki/Team_Fortress_2_level_design/Design_Theory/Payload
51. Final Fantasy Phoenix Down: https://giantbomb.com/wiki/Objects/Phoenix_Down
52. Mario super star: https://www.mariowiki.com/Super_Star (not opened; the trope is common knowledge)
