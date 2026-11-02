# Set pieces and stage concepts: proposal

Status: the owner has decided the open questions (section 6). Wave 0, the contracts, has landed; no concept is registered yet.

The ask: much more variety in the large-scale structures each themed level can have, and they have to render well. Today generation reads as minor tweaks. The reference is Ultimate Chicken Horse, where each level is one place (a mansion with an elevator and glass on both sides, a level dominated by one huge moving thing). The answer proposed here is to generate **stage concepts**: pick the place first, build its landmark, then fill in the rest.

## 0. What we have today

### Pipeline

`src/gen/level/index.ts` runs these steps:

1. Theme.
2. Look.
3. Profile: size, route, density, hazard count, danger, gravity.
4. Sculptor: `SCULPTORS[theme]`, retried up to 30 times until `judge` accepts the shape. That means:
   - it needs parts,
   - it is solvable with at most `MAX_BRIDGES`,
   - it is mostly open, with `lanes.ts` adding one-way platform lanes when it isn't.
5. Weather.
6. **Set pieces, last, into whatever air is left.**

The set piece placer (`setpieces/place.ts`) works like this:

- It shuffles the theme's recipes by weight and danger.
- It tries each recipe's candidate spots best-first and takes the first one that `finalize` accepts by simulating it.
- It keeps the piece only if the level's recorded solution still holds (`planHolds`).
- It aims for `profile.hazards` pieces, between 0 and 4.

Nothing tells the sculptor to leave room. A piece that doesn't fit is simply skipped.

### What each theme has

| Theme | Sculptor styles (classic and wide) | Set piece recipes | Builder behind each |
|---|---|---|---|
| farm | fields, barnyard, windmill, orchard | tractor, windmill, hay hoist | vehicle, wheel, pendulum |
| factory | foundry, warehouse, assembly | press, forklift, cog lift | press, vehicle, wheel |
| castle | bailey, gatehouse, dungeon | cannon, chandelier, ram | cannon, pendulum, vehicle |
| jungle | canopy, temple, grotto | log swing, boulder, dart idol | pendulum, vehicle, cannon |
| volcano | spires, caldera, flows | lava plume, vent, spitter, slab | geyser, geyser, cannon, pendulum |
| harbor | docks, galleon, marina | crane, shore battery, forklift | pendulum, cannon, vehicle |
| mine | galleries, cavern, shafts | minecart, drill, ore bucket | vehicle, vehicle, pendulum |
| rooftops | downtown, tenements, skyline | AC updraft, antennas, gondola | fan, tesla, pendulum |
| glacier | crevasses, icefall, cave | frost cannon, frost vent, chairlift, serac | cannon, geyser, pendulum, pendulum |
| space | asteroids, station | flare, turret, comm array, centrifuge, docking arm | geyser, cannon, tesla, wheel, pendulum |

- **34 recipes come from 8 builders.**
  - A swinging platform on a pendulum appears in 9 of the 10 themes.
  - A vehicle patrolling flat ground appears 7 times.
  - A cannon on a ledge appears 6 times.
- **Tall levels share one tower generator.** Seven themes route their tall levels through `sculptors/tall.ts`, a stack of storeys with a per-theme kit. The theme's style is ignored there.

### Measured over 12 seeds per theme

Measured on the current tree (spike script, not committed):

| Theme | Pieces per level | Levels with none | Share of level area | Biggest piece |
|---|---|---|---|---|
| farm | 1.8 | 0/12 | 8.0% | 11×11 windmill sweep |
| factory | 2.3 | 0/12 | 6.5% | 11×11 cog lift |
| castle | 2.2 | 2/12 | 2.9% | 11×7 chandelier |
| jungle | 2.3 | 1/12 | 2.8% | 13×7 log swing |
| volcano | 2.3 | 1/12 | 1.6% | 9×7 slab |
| harbor | 1.3 | 3/12 | 2.1% | 11×10 crane |
| mine | 1.5 | 2/12 | 2.3% | 13×3 drill |
| rooftops | 1.5 | 4/12 | 2.1% | 13×10 gondola |
| glacier | 1.8 | 2/12 | 1.8% | 11×9 chairlift |
| space | 2.6 | 1/12 | 4.4% | 11×11 centrifuge |

- No piece is bigger than 11×11, and that figure is the swept circle, not the object itself.
- A classic level is 48×27. A runner's jump is about 8 tiles long and 3.7 high.

`pnpm shot levels --themes all` (one level per theme) shows the same thing:

- Factory reads as rows of orange one-way shelves with a 3-tile forklift.
- Volcano is spires with a lava plume.
- Only the harbor crane and the farm windmill read as landmarks.

### Why it feels like minor tweaks

1. **Pieces go in last, so they are always small.**
   - They are fitted into air the terrain happened to leave, and lanes have often filled that air with one-way platforms.
   - A piece can't be bigger than the largest hole, and when it doesn't fit it simply doesn't appear (0–4 of 12 levels per theme have none).
2. **Terrain landmarks and set pieces don't know about each other.**
   - `farm:windmill` stamps a windmill tower with no sails.
   - The windmill set piece lands wherever an 11×11 hole is.
   - The same goes for the galleon (no cannons on it), the gatehouse (no portcullis) and the ziggurat (no boulder).
   - The landmark never does anything, and the thing that moves is never the landmark.
3. **Styles reweight the same bag.**
   - A factory style picks a mix of chimney, crates, rack and press.
   - Density changes how many stamps go in.
   - Nothing changes the level's silhouette, so "assembly" and "warehouse" look alike at a glance.
4. **One mechanism, many skins.** A chandelier, a crane hook, an ore bucket, a gondola, a docking arm, a log and a serac are all the same pendulum platform. Players learn that within minutes.
5. **No theme has a hazard family of its own.** Most themes hold a cannon, a vehicle and a pendulum. Nothing plays only on a glacier, the way a train plays only on a metro.
6. **Variety is a list of independent knobs.** Size, density, route shape, gravity and weather are each rolled on their own, so every combination is possible and none of them is memorable. This is Kate Compton's oatmeal: lots of mathematically different bowls that all look the same.

### A problem that bigger movers would make worse

`reach.ts` doesn't model riding, so the proof treats every moving set piece as something to avoid, never as something to stand on. A rideable piece can therefore offer a free crossing that nothing checks.

- In 42 of 200 levels (20 per theme), a rotor's swept area lies over the columns of the recorded solution bridge, within 6 rows above it. Per theme:
  - farm 11
  - castle 8
  - harbor 7
  - glacier 5
  - jungle 4
  - volcano 3
  - rooftops 2
  - factory 1
  - space 1
  - mine 0
- That proximity doesn't prove a bare run can ride across, but nothing rules it out.
- A huge wheel or an elevator would make this much more likely, so section 2 adds a check for it.

## 1. Principles

The UCH facts below come from the community wiki (https://ultimate-chicken-horse.fandom.com/wiki/Maps, read through its API), which lists 23 hand-made levels.

Two corrections to how the brief remembers them:

- The haunted house is **Old Mansion**. It has an elevator (red buttons call it), a big glass shard on the left and a thorn bush on the right (`#Old_Mansion`).
- No UCH level is a factory with a huge wheel. The nearest are:
  - **Metal Plant**: seven blocks circling a square rail that spans most of the map (`#Metal_Plant`).
  - **Windmill**: the goal rides the sails (`#Windmill`).

  The owner's memory makes a good brief anyway, so section 3 builds a Great Wheel.

1. **A level is a place with one dominant landmark.**
   - Every UCH level is one structure: Old Mansion is the house, Pyramid the pyramid, Waterfall the cliff, Rooftops two towers and a gap (https://ultimate-chicken-horse.fandom.com/wiki/Maps).
   - Smash stages are remembered by one thing:
     - Great Bay's turtle: https://www.ssbwiki.com/Great_Bay
     - Halberd's Combo Cannon: https://www.ssbwiki.com/Halberd
     - Dream Land's Whispy Woods: https://www.ssbwiki.com/Dream_Land
     - Wily Castle's Yellow Devil: https://www.ssbwiki.com/Wily_Castle
2. **The landmark is the mechanic.** The hazard is the place's own threat, not a generic trap in a costume.
   - UCH:
     - Pier's wave
     - Metro's train, whose roof you can ride
     - Nuclear Plant's giant elevator
     - Jungle Temple's boulder
     - Toxic Tower's tank
     - Space's UFO pull
   - Smash:
     - Norfair's lava waves: https://www.ssbwiki.com/Norfair
     - Pirate Ship's catapult and rock: https://www.ssbwiki.com/Pirate_Ship
3. **One hazard family per place.**
   - Each TowerFall tower adds one object, such as King's Court's switch blocks (https://towerfall.wiki.gg/wiki/King's_Court) or TowerForge's hot coals (https://towerfall.wiki.gg/wiki/TowerForge).
   - Koichi Hayashida on Mario levels: decide "a core concept… carried through absolutely all the way" (https://www.gamedeveloper.com/design/the-secret-to-i-mario-i-level-design).
   - Donkey Kong Country builds a level on one gimmick, for example Tidal Terror's waves (https://www.mariowiki.com/Tidal_Terror) or the rocket barrel levels (https://www.mariowiki.com/Rocket_Barrel).
4. **Scale contrast.** The landmark is several times a jump in size, not a prop beside the path.
   - UCH's Iceberg is the biggest level, and the goal of Windmill rides sails that span the screen.
   - Hyrule Temple is "extremely large" (https://www.ssbwiki.com/Hyrule_Temple).
   - Our biggest piece today, 11×11, is about one jump across.
5. **Big events telegraph, hit, then leave a refuge.**
   - Bridge of Eldin: a bomb blows the gap and a portal later restores the bridge (https://www.ssbwiki.com/Bridge_of_Eldin).
   - Norfair: an escape hatch appears (https://www.ssbwiki.com/Norfair).
   - Tidal Terror: you shelter behind pillars.
   - Castle Siege: a rumble before each move (https://www.ssbwiki.com/Castle_Siege).
   - Our timed parts already warn; big events need a visible refuge too.
6. **Author the macro structure, randomize inside it.**
   - Spelunky walks a solution path first, then fills rooms from hand-made templates (https://tinysubversions.com/spelunkyGen/).
   - Dead Cells fixes the frame and gives each biome its own room set, after fully procedural levels felt "illogical, chaotic" (https://deepnight.net/tutorial/the-level-design-of-dead-cells-a-hybrid-approach/).
   - TowerFall's Cataclysm generates towers from a seed out of authored hazards (https://towerfall.wiki.gg/wiki/Cataclysm).
7. **Perceptual uniqueness beats mathematical uniqueness.**
   - Compton: "It's more important to have a smaller number of distinct items" (https://www.gamedeveloper.com/design/practical-procedural-generation-for-everyone-).
   - Smash's Battlefield forms are treated as the same stage, because they differ "only in music and aesthetics" (https://www.ssbwiki.com/Battlefield_form).
   - Fifty concepts that each read at a glance beat a million density rolls.
8. **Vary direction, not only density.** UCH's memorable levels:
   - go up: Waterfall, Windmill, Metal Plant, Nuclear Plant, Space
   - go down: Ballroom, Toxic Tower
   - wrap: Picture Frame

   Pokémon Stadium 2 changes one rule per form, such as conveyors or ice (https://www.ssbwiki.com/Pokémon_Stadium_2).
9. **Sparse geometry, one deliberate gap.**
   - UCH's Rooftops is two towers and a gap; Dance Party is start, abyss, goal.
   - The landmark frames the problem, and the parts solve it. That is our solvability rule already, so the landmark should own the crossing whenever it can.
10. **Keep a plain counterpoint.**
    - Smash's Battlefield and Ω forms (https://www.ssbwiki.com/Ω_form).
    - Rivals of Aether's Basic mode (https://rivalsofaether.com/developer-update-november-2014/).
    - Ultimate's hazard toggle (https://www.ssbwiki.com/Stage_hazard).

    A share of plain levels keeps the landmark levels special and gives generation a fallback.

## 2. Generation architecture: concept first

### The pipeline after the change

```
theme → look → profile → CONCEPT (fixed per level)
  → per attempt: claim the landmark's site → sculpt around it → build its structure as tiles
               → judge → lanes (kept out of the landmark's air)
  → weather → LANDMARK PIECES (required: if any fails, retry the attempt)
  → filler set pieces from the concept's hazard family (the hazard budget minus the landmark's share)
```

### New code: `src/gen/stage/`

This sits beside `level/` and `setpieces/`, and both of them use it.

```ts
/** A stage concept: the place a level is. One file per theme, registered in CONCEPTS. */
interface Concept {
  id: string;                       // 'great-wheel', 'haunted-wing'
  weight: number;
  sizes: readonly SizeClass[];      // classic | wide | tall
  routes?: readonly RouteShape[];
  /** Columns and rows it needs, measured from jumpProfile() at the level's gravity, never fixed numbers. */
  box(k: Knobs, rng: Rng): { w: number; h: number };
  /** Does the landmark own the hard crossing? Then the sculptor puts the gap inside it, at `crossing`. */
  ownsCrossing: boolean;
  /** Static structure, written as tiles into the grid: walls, floors, stairs, the axle tower. Returns anchors for movers and the air movers sweep. */
  build(g: Grid, rng: Rng, at: TileRect, parts: number): Landmark;
  /** Movers and hazards bolted onto the anchors. Validated by finalize like any set piece. */
  pieces(rng: Rng, s: Site, l: Landmark): Iterable<Piece>;
  /** Recipe names (setpieces/<theme>.ts) the filler draws from: the place's hazard family. */
  family: readonly string[];
}

interface Landmark {
  concept: string;
  rect: TileRect;                   // the structure's box
  air: TileRect[];                  // reserved empty space movers sweep (lanes, filler and decor stay out)
  anchors: Record<string, Vec>;     // 'hub', 'shaftTop', 'shaftBottom', 'pourLip', ...
  skin?: TerrainKind;               // render-only: how the landmark's tiles are drawn (planks, brick, metal...)
}
```

Where it plugs in:

- **`level/profile.ts`, or a new `stage/roll.ts`:** `rollConcept(seed, theme, profile)` picks the concept from `deriveSeed(seed, 'concept:' + theme)`.
  - It is fixed per level, like `challenge`. A per-attempt roll would quietly select for the concepts that are easiest to sculpt (`src/gen/AGENTS.md`).
  - It filters by size and route.
  - About 20% of levels roll `plain`: today's sculpt with filler pieces. This is the open question in section 6.
- **`level/types.ts`:**
  - `SculptCtx.concept?: Concept`
  - `Shape.landmark?: Landmark`
- **`level/sculptors/common.ts`:** `claimSite(ctx, k, slots, surf)` takes the landmark's columns through the same `Slots` the sculptors already use.
  - It flattens or levels the ground under it.
  - It `reserve`s its air in the keep mask.
  - If the concept owns the crossing, it records the crossing with `hintGap`.

  Every heightmap sculptor calls it before its own feature bag, the way the farm already places a barn. In the tall generator (`tall.ts`), a landmark replaces a storey connector or a storey's deck. `Slots` and `keepClear` keep it off a crossing's banks unless it owns that crossing.
- **`level/lanes.ts`:** `forbiddenColumns` also blocks `shape.landmark.air`, so a second route never lays one-way platforms through the wheel.
- **`level/index.ts`:** after weather, build `concept.pieces` first.
  - Each piece goes through `finalize`, then `keep` (the plan still holds), then the new `noFreeRide` check.
  - If any of them fails, the attempt is rejected (`rejects.landmark++`) and the loop moves on to the next one.
  - After eight landmark rejects the level falls back to `plain`. That counts in `GenInfo.conceptFallback`, and a stats test keeps it under 5%.
  - Filler then runs with `count = profile.hazards - landmark.budget` and a recipe pool narrowed to `family`.
- **`sim/level.ts`:** `Level.landmark?: { concept; rect; skin? }`. This is additive and render-only; the sim ignores it.
- **Tools:**
  - `pnpm level --concept <id>`, plus a concept column in `--stats`
  - `?concept=<id>` in `src/debug.ts`
  - `pnpm shot landmarks` (section 4)

### Keeping every invariant

| Invariant | How it holds |
|---|---|
| Determinism | The concept comes from its own `deriveSeed` stream, and the landmark rng from `landmark:${attempt}`. No new stream shifts an existing one. Builders use `dmath` only. |
| Solvability proven by `reach.ts` | The landmark's structure is **tiles**, so the real controller already proves routes over it. Movers are props, and the plan already keeps clear of their barriers (`sim/props/barrier.ts`). **A mover is never on the proof.** Every concept therefore has a static route: the manor has stairs, and the elevator is the fast way. UCH does the same: Nuclear Plant has stairs beside its elevator. |
| At most `MAX_BRIDGES` parts | The pipeline is unchanged: `judge` and `oneBridgeEnough` run on the final tiles, including the landmark. |
| About 99% need parts; about a quarter need two | `rollChallenges` is unchanged. A concept that owns the crossing builds 1 or 2 of them from `hardGap(rng, parts)`. **New: `noFreeRide`** (below) stops a mover from undoing a crossing. `TWO_PART_ASK` gets re-tuned per theme with `pnpm level --stats 100` after each batch. |
| Bare runs stopped only by gaps and walls parts solve | A landmark never seals: its gaps come from `hardGap`, and its walls carry `undercut` like today's banks. Hazards keep their `MIN_OPENING` windows. |
| Spawn and goal protection | Pockets and `SAFE_TILES` are unchanged. `claimSite` refuses columns within `POCKET + SAFE_TILES` of either end, and `finalize` still rejects any piece that reaches into a zone. |
| Mostly open | Every concept builds two ways past itself (interior and roof, rim and catwalk), and `analyzeRoutes` still scores it. Lanes fill any gap but stay out of the landmark's air. |
| Sizes | Each concept declares the sizes it supports. Its box comes from `jumpProfile()`, so low and high gravity get landmarks scaled to their jumps. Space stays classic or wide. |
| Weather | Its gate runs after the landmark exists. Nothing changes there. |

#### `noFreeRide`

This goes in `gen/level/winnable.ts`. It fixes the problem above for today's pieces as well as new ones.

- For every rideable mover (rotor, vehicle, a body with motion, glider launcher), sample its solids at 8 phases of its cycle.
- Write each snapshot into a copy of the level as static ground, one snapshot at a time.
- Ask `cache.analyze` whether the goal is reachable with **no parts**. If any snapshot opens it, reject the piece.

This doesn't model riding while the mover moves, but it catches the cases that matter: the cab parked at the top floor, a platform hanging over the gap. `ReachCache` re-traces only the changed cells, so it stays cheap. A stats test, `tests/stats/free-ride.test.ts`, checks the share of levels a bare ghost can finish against today's baseline.

### Performance

- Today a level takes about 300 ms (`pnpm level` on wide levels).
- Landmarks add retries. Budget: at most +25% ms/level, `fallbacks: 0`, concept fallback under 5% (`pnpm level --stats 50` against the parent commit).

## 3. Per-theme stage concepts

### Columns

- **Size**: W×H in tiles at normal gravity, scaling with `jumpProfile()`. A classic level is 48×27. Its middle, between the pockets and the spawn/goal safety margins, is about 28 columns, and a hard crossing takes about 10–13 of them, so:
  - a classic landmark is up to about 20 wide, unless it owns the crossing;
  - a wide one is up to about 36;
  - a tall one is the full width.
- **Anchor**: how it meets the terrain.
- **Moves / hurts**: names in `code` are existing modules (`src/sim/props/types.ts`).
- **New**: anything the sim or art needs. The new pieces are defined in the next subsection.
- **Risk**: solvability risk.

### Shared new pieces

There are seven, all additive. Several themes share each one, so they come first in the plan.

| Piece | What it is | Used by |
|---|---|---|
| **Lift** | A body with `motion: rail`, plus an additive `dwell` (frames parked at each end, so it reads as an elevator) and `Piece.motion`. The sim already carries riders on moving solids. | manor, mine headframe, silo, construction site, airlock |
| **Flood** | A new module `flood`: a liquid surface over a column span that rises from `low` to `high` and back on a cycle: off, warn (it bubbles and rises a lip), rise, hold, fall. Below the surface is lethal (lava, toxic) or a pit (water). The plan keeps clear of rows it holds for most of the cycle; the generator keeps `high` below the proven route. | caldera, magma tide, toxic vat, harbor tide, flooded gallery |
| **Track** | A new `Motion` variant: `{ type: 'track'; pts: Vec[]; period; closed }`. A body follows a polyline at constant speed. | conveyor loop, cable car, coaster, gantry trolley |
| **Great wheel** | No new sim: a `rotor` (arm 7–9, 6–8 platforms) and a `swinger` (saw heads, count 2–3) on one hub, period and direction, with the spoke phases offset. It needs a builder and the art. | factory wheel, water wheel, ring station, clock |
| **Spike looks** | An additive `look?: 'glass' \| 'thorn' \| 'crystal' \| 'icicle' \| 'pitchfork'` on `spikes`, and on `coat` where kind is spikes. Art only. | manor glass, thorn gorge, crystal geode, ice palace, barn |
| **Sideways and downward geysers** | Builder options to aim an existing `geyser` along the ground (a wave or avalanche) or down (a waterfall or pour), plus `GeyserLook` values `'water' \| 'toxic' \| 'snow'`. Non-lethal geysers already push by `strength`. | waterfall cliff, avalanche, mill race, tide wave |
| **Landmark skin** | `Level.landmark.skin`: the terrain painter draws tiles inside the landmark's rect with that `TerrainKind` (planks, brick, metal, crystal, ...) instead of the theme's. New `DecoKind`s supply the backdrop shells: facade, gantry, flywheel rim, headframe, hull ribs, billboard. | every concept |

### Farm
**Family:** farm machinery (blades, augers, balers), plus wind.

| Concept | Size | Anchor | Moves / hurts | New | Nod | Risk |
|---|---|---|---|---|---|---|
| **Great Windmill** (promotes `farm:windmill`) | 18×22 | A tapered tile tower stands on levelled ground; the hub sits on its cap | Moves: the sails, a `rotor` with 4 wide platforms and an arm of 6–7, sweeping a 15-wide disc. Hurts: a thresher at the foot, a `swinger` saw (axe) at a low hub | Hub anchored to a tile cap (`support: 'none'` with the tower as tiles); rotor tower skin | The windmill every farm level has, as a lift the size of the sky | **Medium**: the sails must not carry anyone across a crossing (`noFreeRide`); the static route climbs the tower's gallery |
| **Grain Elevator** | 16×22 | Two silos (tiles) on concrete pads, joined by a top gantry | Moves: a bucket lift in an open leg between them. Hurts: a grain chute dumping down the gap, a downward `geyser` that shoves (non-lethal) | Lift; downward geyser | The farm co-op silo; the chute dumps corn kernels | **Low**: the ladder on the outer silo is the proven route |
| **Barn Raising** | 22×14 | A barn on levelled ground, open to the hayloft | Moves: a hay bale on the barn's own hoist beam (pendulum `rotor`, existing look `hay`), a feed `conveyor`. Hurts: a pitchfork strip on the loft lip | Spike look `pitchfork`; anchor the pendulum to the barn's beam | The big red barn; a cow silhouette in the loft window | **Medium**: the interior funnels, so the roof ridge is the second route |
| **Mill Pond** | 20×16 | A dammed pond (the crossing) with the wheel on the near bank, half sunk in the race | Moves: a water wheel (great wheel, arm 5–6, 8 paddle platforms) climbing to a high shelf, and a sluice gate (`phase` blocks). Hurts: a millstone (`dropper`, stone) | Great wheel; sideways water geyser for the race | The water mill; a duck rides a paddle | **High**: the wheel sits beside the pond, never over it (`noFreeRide`) |
| **Combine Run** (wide only) | 26×6 path | Drives the longest flat field run | Moves: the combine, a body with `motion: rail` sideways and rideable. Hurts: a spinning reel at the front, a `swinger` saw that moves with the prop | `Piece.motion` | The tractor chase, scaled up: a straw hat on the cab | **Medium**: a rail across a pit would be a free ride, so it stays on solid fields |

**Ink:**

- The tower and silos are tiles in a `planks` / `concrete` skin, hatched on the shadow side.
- Sails are lattice cloth over a wooden frame, drawn live because they turn. The hub is baked.
- The barn uses brick-red planks with white trim strokes.

### Factory
**Family:** crushers, saws, molten metal, belts.

| Concept | Size | Anchor | Moves / hurts | New | Nod | Risk |
|---|---|---|---|---|---|---|
| **The Great Wheel** (owner's example) | 20×22 classic, 24×24 wide or tall | An A-frame axle stand of tiles on a concrete plinth; the plinth sits on the floor beside a vat | Moves: 6–8 platforms ride the rim (`rotor`, arm 8). Hurts: 2–3 spokes tipped with saws (`swinger`, `saw`), same period, offset phase, so a ride is timing | Great wheel; flywheel rim deco | The factory level's giant gear; a "DAYS WITHOUT INCIDENT: 0" board on the stand (render only) | **High**: the rim sweeps 17 tiles, so it goes in a climb (floor to upper catwalk) and never over the vat; lanes keep out of its disc |
| **Foundry Pour** | 30×16 | A gantry of two tile legs on the floor, with a girder rail | Moves: a ladle on a trolley (track along the rail). Hurts: a molten pour, a downward lethal `flame` that moves with the ladle, onto a mould `conveyor` | Track (or a sideways rail); downward flame | The molten-metal factory; the moulds are rubber ducks | **Medium**: the pour's sweep needs a `MIN_OPENING` gap; the catwalk above is the proven route |
| **Stamping Line** | 30×12 | A run of floor under a ceiling beam | Hurts: 3–5 big presses (`piston`, reach 5–7, width 3–4) phased in sequence over a `conveyor` floor, so a sprint matching the rhythm gets through | One builder placing the presses as one piece with staggered phases | The crusher gauntlet; each press leaves a pancake | **Medium**: the barrier may class a densely phased line as a no-go, so the overhead catwalk must be the static route |
| **Toxic Vat** | 16×16 | A steel tank (tiles) sunk into the floor | Moves: a skimmer platform (lift, sideways). Hurts: sludge that rises and falls (flood, `toxic`), an overflow fountain (upward `geyser`, toxic look) | Flood; toxic geyser look | The polluted vat; a three-eyed fish on the skimmer | **Medium**: high water stays 2 rows under the walkway |
| **Robot Arms** | 24×14 | Two pedestals (tiles) on the floor | Moves: two big pendulum arms (`rotor` swing with a claw platform) swap a crate across the floor. Hurts: a welding laser (`laser` with `sweep`) on a third arm | Claw skin | The car-factory robot arm; a "HUG ME" sticker | **Medium**: the arms meet over the floor, never over the vat (`noFreeRide`) |

**Ink:**

- Stands and tanks are tiles in a `metal` skin.
- The flywheel rim is a BACKDROP lattice (spokes, rim bolts) in muted tones, so it never reads as solid. Only the platforms and saw spokes are drawn in front.
- The rim sprite is baked once and drawn rotated.

### Castle
**Family:** glass, blades and fire from the walls; chandeliers; ghosts.

| Concept | Size | Anchor | Moves / hurts | New | Nod | Risk |
|---|---|---|---|---|---|---|
| **Haunted Wing** (owner's example) | 22×18 | A three-storey manor wing of tiles on the courtyard floor: holes in the floors, a roof ridge, a central lift shaft | Moves: an elevator cab (lift, 2–3 stops, dwell at each floor) up the shaft, a `chandelier` in the hall. Hurts: **broken stained glass on both outer walls** (`spikes`, look `glass`, on the outside faces you'd wall-jump), cobwebs in the stairwell (`web`), a rotten floor (`crumble`) | Lift; spike look `glass`; `planks`/plaster skin; facade deco | The plumber's ghost houses and the build-race game's rickety mansion. Ours: the cab is a dumbwaiter with a service bell, and the portraits' eyes follow the nearest runner (render only) | **Medium**: the stairs are the proven route; the shaft must not skip the crossing (`noFreeRide` with the cab at each stop); glass faces are no-go, and the roof is the second route |
| **Broken Drawbridge** | 26×14 | A gatehouse (promotes `castle:gatehouse`) over the moat, which is the crossing the landmark owns | Moves: a portcullis (lift), and a bridge deck that slides out of the wall (`body` with sideways rail) but **never quite meets** the far bank: the last tiles always need a part. Hurts: boiling oil (downward `flame` from machicolations), a `cannon` in the tower | Lift; downward flame | The moat and drawbridge; the bridge gets stuck one plank short | **High**: the slide's reach is measured so the gap left is still a `hardGap`, and `noFreeRide` checks it at full extension |
| **Clock Tower** (tall) | 16×34 | The tower's own storeys; the clock face is set into the wall above the middle storey | Moves: hour and minute hands, two `rotor`s on one hub with 1 platform each, arms 4 and 6, at different speeds. Hurts: a pendulum axe in the shaft below (`swinger`, `axe`, arm 6) | Clock-face deco; a rotor with one platform per arm length (works as two modules) | The clock-tower level; a cuckoo pops out when the race starts | **Medium**: the hands are bonus routes, and the storey connectors stay the proof |
| **Throne Hall** | 28×14 | A long hall with a tile ceiling | Moves: three synchronised chandeliers (pendulums). Hurts: a chandelier that drops when you pass under and rides back up (`dropper`, chandelier look), and the ram (existing) | Chandelier skin for `dropper` | The boss room, with the boss door at the far end (backdrop) | **Low** |
| **Siege Tower** (wide) | 8×12 moving, 24 span | Rolls on the bailey floor | Moves: a wheeled siege tower (`vehicle` with tall columns) whose top deck is a moving platform. Hurts: its leading face | Tall vehicle columns (already allowed) | The siege engine; a "WIDE LOAD" banner | **High**: its deck could reach a rampart across a gap, so it stays off crossings (`noFreeRide`) |

**Ink:**

- The manor is `planks` with plaster-white fill and timber strokes. Broken windows are dark rectangles with glass shards, drawn only on the spike cells so the hazard edge is exact, with one glint.
- The clock face is baked; the hands are drawn live.
- The gatehouse uses the existing `stone` skin.

### Jungle
**Family:** boulders, darts, thorns, water.

| Concept | Size | Anchor | Moves / hurts | New | Nod | Risk |
|---|---|---|---|---|---|---|
| **Step Temple** (promotes `jungle:temple`) | 24×14 | A ziggurat of tiles on the forest floor, with a tunnel through its base | Moves: a boulder (`vehicle`) rolling across the summit terrace. Hurts: dart idols (`cannon`) facing the stairs, pressure plates (`snapper`) on two steps | none | The temple run; the idol is a bobble-head | **Low**: the summit or the tunnel gives two routes |
| **Waterfall Cliff** | 18×20 | A cliff of tiles rising from a plunge pool (a pit) | Moves: vines (`rope`) hung from the lip. Hurts: the falls, a downward `geyser` (water, non-lethal, strong) pinning you down over one climb line | Downward geyser, `water` look | The waterfall climb; a barrel bobs in the pool | **Low**: the falls column is no-go, so the proof climbs beside it |
| **Canopy Village** (tall) | full width × 30 | A giant trunk (6 wide, tiles) through the storeys, with decks | Moves: a pulley lift with a counterweight (two lifts out of phase), barrel cannons between decks (`keg`). Hurts: a rotten rope bridge (`crumble`) | Lift | The treetop village of the ape games | **Medium**: the kegs fire across air, so `noFreeRide` checks them as a launch, or they point up a storey only |
| **Thorn Gorge** | 24×16 | A gorge (the crossing) with a broken rope bridge hanging from both banks | Moves: logs swinging from the canopy over **the near half only** (existing log pendulum). Hurts: thorn bushes on the gorge walls (spike look `thorn`) | Spike look `thorn` | The rope bridge chase | **High**: the logs must not reach the far bank (`noFreeRide`) |
| **Stone Face** | 14×12 | A giant carved head in the cliff, its mouth a tunnel | Hurts: lasers from the eyes (`laser` with `sweep`, long off phase), a tongue that rises (`piston`) | Carved-stone skin | The giant stone head temple | **Low** |

**Ink:**

- Carved stone is `stone` with moss blobs.
- The falls are drawn on `rc.bg` (soft and thin), with the column edge drawn exactly where `beamOf` stops.
- Vines use the rope art.

### Volcano
**Family:** lava that rises, pours and spits.

| Concept | Size | Anchor | Moves / hurts | New | Nod | Risk |
|---|---|---|---|---|---|---|
| **Caldera** (promotes `volcano:caldera`) | 30×16 | A cone of tiles with the crater as the owned crossing | Moves: basalt rafts in the crater (lift, sideways, never more than half way across). Hurts: crater lava that rises and falls (flood, lava) | Flood | The volcano summit; a marshmallow on a stick on the rim | **High**: rafts versus `noFreeRide`, and the lava must stay under the crater banks |
| **Magma Tide** | full width × lower 10 rows | The level's low ground | Hurts: a long-cycle lava tide (flood) that drowns the low route, with a visible refuge (high ledges that stay dry) | Flood | The bounty hunter's lava-wave stage | **Medium**: the proven route runs above high water; the low route is the fast, timed one |
| **Lavafall Organ** | 16×20 | A basalt-column cliff (tiles, stepped like organ pipes) | Hurts: a lavafall (downward `geyser`, lava, lethal) from the lip on a timer | Downward geyser | Lavafalls | **Low** |
| **Dragon Ribs** | 26×12 | A fossil ribcage half buried in the slope: the ribs are one-way arcs of tiles | Hurts: a `geyser` vent under the ribs, a `cannon` (spitter) in the skull's mouth | Bone skin | The boss skeleton; it wears a party hat | **Low** |
| **Eruption** | cone 20×14 | A cone (tiles) with a vent at the peak | Hurts: the vent lobs cluster bombs that split (`cannon`, `cluster` ammo, high angle) | none | The erupting volcano's rock rain | **Medium**: the arcs mustn't cover a pocket (`finalize` checks `SAFE_TILES`) |

**Ink:**

- The flood surface is the theme's liquid with a hard bright crest line.
- The warning shows as a bubbling lip, drawn live; the rest is the liquid layer.
- Ribs are `bone`-toned tiles with crack marks.

### Harbor
**Family:** sea and cargo.

| Concept | Size | Anchor | Moves / hurts | New | Nod | Risk |
|---|---|---|---|---|---|---|
| **Galleon at Berth** (promotes `harbor:galleon`) | 26×14 | A hull of tiles moored in the water; masts are one-way yards | Moves: rigging ropes (`rope`) between the masts. Hurts: broadside `cannon`s and a crumbling gangplank | none | The pirate level; a parrot on the crow's nest | **Low** |
| **Tidal Pier** | full width × 10 | Pier planks on posts at staggered heights | Hurts: the tide rises over the low pier on a slow cycle (flood, water), plus a breaking wave (sideways water `geyser`) along the lowest deck | Flood; sideways geyser | The beach pier's wave; a lifeguard chair | **Medium**: the tide stays under the high pier |
| **Container Crane** | 24×20 | A gantry crane: two tile legs on the quay, a boom deco | Moves: a trolley on the boom carrying a container (track: across, down, up), rideable. Hurts: the container's drop (it comes down fast) | Track | The dockside crane; the container is labelled FRAGILE | **High**: the boom spans water, so the track is cut to stay on one side of the crossing |
| **Lighthouse** (tall) | 12×34 | A tower of tiles on a rock islet with a spiral stair | Hurts: the lamp is a sweeping `laser` on a long off phase | Lighthouse skin | The lighthouse level; the keeper's death-ray lamp | **Low** |
| **Kraken Lagoon** | 20×12 | Islets of tiles in a lagoon | Hurts: tentacles rising out of the water on a cycle (`piston` aimed up, tentacle look) | Tentacle skin | The sea-monster bell. Ours: the tentacles wear a wedding ring | **Low** |

**Ink:**

- Hulls are `planks`.
- Crane legs are lattice drawn on BACKDROP, with the trolley and container in front.
- The lighthouse is white brick with a red band; the beam is drawn exactly where `beamOf` stops.

### Mine
**Family:** carts, cave-ins, crushers.

| Concept | Size | Anchor | Moves / hurts | New | Nod | Risk |
|---|---|---|---|---|---|---|
| **Headframe Shaft** | 10×24 | A shaft carved through the rock, with the headframe above ground | Moves: a cage lift with 2–3 stops and a ladder of rungs beside it (one-way), a spinning headframe wheel (deco). Hurts: falling rock in the shaft (`dropper`) | Lift; headframe deco | The mine-lift level | **Medium**: the ladder is the proof; the cage at the top must not skip a crossing |
| **Rail Loop** | 26×14 | Track ledges carved into a big cavern | Moves: carts on a closed track, rideable. Hurts: the carts' leading faces | Track | The minecart level every game has; a "LEVEL 4-2"-style sign | **High**: the loop crosses the cavern, so `noFreeRide` samples every cart position |
| **Ore Crusher** | 18×14 | A crusher housing carved into the rock wall | Moves: a feed `conveyor`. Hurts: two jaws (`piston`s facing each other) | none | The rock crusher; the jaws have dentures | **Low** |
| **Crystal Geode** | 20×16 | A hollow geode (`crystal` skin) in the rock | Moves: `crumble` ledges. Hurts: crystal spikes (look `crystal`) on the geode walls | Spike look `crystal` | The crystal cave | **Low** |
| **Flooded Gallery** | full width × lower galleries | The lower tunnel | Hurts: water rises in the low gallery (flood); a pump (`fan`) blows an updraft in the shaft | Flood | The flooded mine | **Medium**: the upper gallery is the proven route |

**Ink:**

- The headframe is a timber lattice on BACKDROP with the wheel baked.
- Crystals are `crystal` with hard light facets.

### Rooftops
**Family:** electricity, wind, signage.

| Concept | Size | Anchor | Moves / hurts | New | Nod | Risk |
|---|---|---|---|---|---|---|
| **Construction Site** | 18×24 | A steel skeleton (one-way girders on tile columns) rising from a roof | Moves: a construction lift, an I-beam swinging on a crane hook (pendulum, existing `crane` look). Hurts: welding sparks (`flame`, short) | Lift | The girder level of the ape's arcade game; a "SAFETY FIRST" sign | **Medium**: the I-beam stays off the alley gap |
| **Neon Billboard** | 16×10 | A billboard on scaffolding (one-ways) on a roof | Moves: neon letters blinking on and off (`phase` blocks, readable as platforms). Hurts: a sparking transformer (`tesla`) | Billboard deco | The neon city; the board advertises crates | **Low** |
| **El Train** (wide) | full width × 6 | A viaduct (tiles) below roof level, beside the buildings | Moves: a train (`vehicle` with many columns, long span) whose roof you can ride. Hurts: its nose | none | The metro train; a "NEXT STOP: PIT" sign | **High**: the viaduct mustn't reach across the hard alley, so it runs between two crossings |
| **Water Tower Row** | 20×14 | 2–3 water towers on legs (tiles) | Moves: washing lines between them (`web`, slows you). Hurts: a burst tank (sideways water `geyser`) | Sideways geyser | Rooftop water towers | **Low** |
| **Helipad** | 12×10 | A helipad on the tallest roof | Moves: a hovering helicopter (lift, rideable skids). Hurts: its rotor (`swinger`, `saw`, count 2, moving with the prop) | `Piece.motion` | The escape-chopper ending | **Medium**: the hover height stays off the alley |

**Ink:**

- Girders are a riveted `metal` skin.
- The billboard is baked; only the letters switch.
- The train is a long baked sprite stamped as it moves.

### Glacier
**Family:** frost, ice and snow that slides.

| Concept | Size | Anchor | Moves / hurts | New | Nod | Risk |
|---|---|---|---|---|---|---|
| **Ski Jump** | 24×18 | A ramp of tile stairs with an ice-ground deck on the slope, landing on a hill | Moves: a chairlift back up (track, or the existing chairlift). Hurts: snow cannons (`cannon`, frost) at the landing | Track (optional) | The ski jump; judges' scorecards at the bottom | **Medium**: the jump off the ramp must not clear the crossing bare. The `reach.ts` ghost walks on ice (`ground`), so the proof covers it |
| **Frozen Falls** (promotes `glacier:icefall`) | 10×22 | A frozen fall of ice tiles, with a cave behind it | Hurts: icicles that drop (`dropper`, look `icicle`) | Icicle skin for `dropper` | The ice cave | **Low** |
| **Avalanche Slope** | full width × 12 | A long slope | Hurts: an avalanche on a long cycle, a sideways `geyser` (snow) down the slope, with caves as refuge | Sideways geyser, `snow` look | The avalanche chase | **Medium**: the proven route goes through the caves |
| **Icebreaker** | 26×12 | A ship hull (tiles) frozen into the ice field | Moves: a radar mast (`rotor`, one platform). Hurts: a frost `cannon` on the bow | Hull and ice skin | The stuck research ship | **Low** |
| **Ice Palace** | 20×16 | A palace of ice tiles; its walls are ice ground (no wall-jumps) | Moves: a frozen chandelier (pendulum). Hurts: icicle spikes on the eaves (look `icicle`) | Spike look `icicle` | The snow queen's palace | **Low** |

**Ink:**

- Clear ice already has a material; glacier tiles keep it.
- The ramp's deck shows zamboni lines.

### Space
**Family:** beams, plasma, pull. Space floats, so landmarks hang in the void, held by struts and clamps.

| Concept | Size | Anchor | Moves / hurts | New | Nod | Risk |
|---|---|---|---|---|---|---|
| **Ring Station** | 20×20 | A hub module (tiles) with docking clamps | Moves: a rotating ring, a great wheel with arm 8 and 8 platforms. Hurts: `tesla` arcs between spokes | Great wheel | The rotating space station; lettuce on one platform | **High**: the void is wide, so `noFreeRide` matters most here |
| **Mothership** | 24×8 overhead | A saucer of tiles across the top | Moves: an abduction beam (`fan` updraft, non-lethal) lifting runners to an upper dock. Hurts: plasma `cannon`s on the rim | none | The UFO abduction; a "WE ♥ COWS" decal | **Medium**: the beam is a utility, and the dock it lifts to is not the goal side of a crossing |
| **Black Hole Lite** | 16×16 | Debris around a core | Moves: a `magnet` pulling toward the core. Hurts: a lethal core (`spikes` ring or `tesla`) | Core art | Gravity puzzles; a diet-soda label | **Medium**: the pull must not fling a bare run across the void (`reach.ts` doesn't model fields). Keep the radius off the crossing |
| **Mining Rig** | 20×12 | A big asteroid of tiles | Moves: ore crates on a closed track. Hurts: a drill (`piston`) | Track | Asteroid mining | **High**: the track stays on the asteroid |
| **Docking Bay** | 18×12 | A hangar module | Moves: airlock doors (`phase`) and `portal` pads between modules. Hurts: an exhaust `flame` | none | The docking bay | **High**: a portal pair can skip a crossing, so it is checked as a free ride (both pads on the same side) |

**Ink:**

- Modules use the hull plating that exists.
- The ring is drawn in front; struts are BACKDROP.
- Every hanging piece shows its clamp or strut.

## 4. Rendering rules for big set pieces

**Grounding: nothing floats unless the theme does.**

- **Tile structures** stand on the ground row they claimed. `claimSite` flattens the ground under them and fills the legs, piers and plinths down to it. Over water or a pit, piles run to the bottom row, and the existing `drawSunken` carries them on under the surface.
- **Supports** reach real ground or a real ceiling, using the `groundBelow` / `ceilingAbove` checks the builders already make:
  - a rotor's tower,
  - a pendulum's mast,
  - a lift's shaft,
  - a gantry's legs.

  Anything hung shows its chain, cable or strut all the way to the anchor.
- **Space** is the exception: there, every piece shows its clamp or strut to a module or asteroid.
- **Doorways and openings don't break it.** A doorway cut through a wall leaves the wall above it hanging over open sky, so the landmark's backdrop shell covers every column of its structure and stands on the lowest ground under it: behind a doorway it draws the door's frame and the dark room beyond, so the wall reads as running down to its threshold.
- **A test enforces it** (`tests/landmark-grounding.test.ts`): every column of a landmark's box that holds structure reaches the terrain under it, through solid tiles or through its backdrop shell, unless the column only holds something that hangs. It runs across every registered concept.

**Layering** (`src/render/AGENTS.md`):

- **What a player can touch** draws in the module layers in front:
  - tiles, through the terrain painter with the landmark's `skin`;
  - platforms, cabs and hazards.
- **Scenery shells** go on `BACKDROP`, behind the terrain:
  - a flywheel rim,
  - a manor facade behind the floors,
  - a crane gantry,
  - a headframe,
  - a billboard face.

  A shell is drawn as lattice or in muted backdrop tones, never as a flat slab, because "anything that looks solid is solid" (`docs/ART.md` → Fair play).
- **Registering new shells:** each new module type that paints on BACKDROP gets an entry in `MAY_PAINT_BACKDROP` (`tests/render-layers.test.ts`).
- **Hazard edges** stay exact, as today:
  - glass, thorns and crystals draw only on their spike cells;
  - a flood's lethal line is its drawn crest;
  - beams and columns stop where `beamOf` says.

**Baking:**

- **Still art:** towers, facades, rims and hulls are baked once with `sprite` and drawn with `stamp`.
- **Rotating parts:** a wheel rim is one baked sprite drawn rotated.
- **Live art:** only what moves, glows or warns is drawn every frame.
- **Landmark tiles** go through the terrain bake. Their marks are keyed to world cells like every terrain mark, so `pnpm shot inkblast --seed S --theme T` must still show no `wrong` pixels.
- **Theme skins:** split `props/modules/skins.ts` into one file per theme first, so skin work can run in parallel.

**Readability:**

- At contact-sheet size, roughly 600 px wide per level, the landmark must be what you'd name the level after.
- Every big event shows its warning in the world: a bell before the lift moves, a rising lip before a flood, a glint along the saw spokes. No text.

**Checking it with `pnpm shot`:**

- `pnpm shot landmarks --theme T [--concept id] [--count N]`: a new scenario in `tools/shot/`, with one level per concept on a contact sheet, using `?concept=`.
- `pnpm shot race --seed S --theme T --frames 60,180,300`: stills of the movers at several phases, to check riders, cabs and hazards line up with their art.
- `pnpm shot levels --themes all`: the before-and-after comparison.
- `pnpm shot inkblast --seed S --theme T`: whenever a landmark skin changes.
- `pnpm shot mobile`: big pieces must still let the follow camera frame runners.

## 5. Plan

The order is set by impact. Each task gets its own worktree and touches files no other task in the same wave touches. Shared contracts land first, on `main`, from the orchestrator.

### Wave 0: contracts (orchestrator, one commit)

**Brief:**

- Add `src/gen/stage/` (`types.ts` holding `Concept` and `Landmark`, and `index.ts` holding `CONCEPTS: Record<ThemeId, Concept[]>`, empty), along with `rollConcept`.
- `SculptCtx.concept`, `Shape.landmark`, `Level.landmark`.
- Additive type variants in `src/sim/props/types.ts`:
  - module `flood`
  - Motion `track`
  - rail `dwell`
  - `SpikeLook`
  - `GeyserLook` water, toxic and snow
  - new `DecoKind`s
- `Piece.motion`.
- The pipeline hook in `level/index.ts`: required landmark pieces, retry, plain fallback, `GenInfo.concept` and `conceptFallback`.
- Lanes kept out of `landmark.air`.
- `pnpm level --concept`, `?concept=`.
- Split `skins.ts` per theme.
- Update `docs/DESIGN.md` (Levels: stage concepts).

**Done when:**

- `pnpm check` passes.
- With no concepts registered, levels are unchanged: `pnpm level --stats 50` matches the parent commit exactly.

### Wave 1: shared sim and art pieces (parallel)

| Task | Files | Done when |
|---|---|---|
| **A. Flood** | `sim/props/modules/flood.ts`, `render/props/modules/flood.ts`, `tests/flood.test.ts` | It rises, holds and falls on its cycle. It is lethal below the crest, with a warning first. The barrier treats rows it holds as no-go. A race shot shows the crest where it kills. |
| **B. Track motion and lift dwell** | `sim/props/transform.ts` (motion only), `render/props/track.ts`, `tests/track.test.ts` | A body on a track carries riders, never pins them, and is deterministic over a 2-match replay. Dwell parks the body at each end. |
| **C. No free ride** | `gen/level/winnable.ts`, `gen/setpieces/place.ts` (calls it), `tests/stats/free-ride.test.ts` | Every rideable piece passes the 8-snapshot check. The share of levels a bare ghost finishes drops from today's baseline (measure it first). `fallbacks: 0`. |
| **D. Landmark skin and shot scenario** | `render/ink-terrain.ts` (skin lookup), `tools/shot/landmarks.ts`, `tests/view-frame.test.ts` if needed | Tiles inside `Level.landmark.rect` draw in the skin. `inkblast` is clean. `pnpm shot landmarks` writes a contact sheet. |
| **E. Spike, geyser and dropper looks** | `render/props/modules/spikes.ts`, `geyser.ts`, `dropper.ts`, `coat.ts` | Glass, thorn, crystal, icicle and pitchfork spikes; water, toxic and snow columns; icicle and chandelier droppers. Each one is shot and looked at. |

### Wave 2: the vertical slice, the owner's two examples (parallel)

| Task | Files | Done when |
|---|---|---|
| **F. Factory: Great Wheel** (+ Stamping Line) | `gen/stage/factory.ts`, `gen/setpieces/builders.ts` (new `greatWheel` only), `sculptors/factory.ts` (`claimSite` call), `render/props/skins/factory.ts` | The wheel appears on its share of factory levels, at least 17 tiles across. `pnpm level --stats 50` for factory: `fallbacks: 0`, concept fallback under 5%, ms/level within +25%, `needBridges` share within ±3 points of parent. Shots at 3 phases show riders on the rim and saw spokes. |
| **G. Castle: Haunted Wing** (+ Throne Hall) | `gen/stage/castle.ts`, `sculptors/castle.ts`, `render/props/skins/castle.ts`, facade deco | Same stats bar for castle. Shots show the cab at each stop and glass on both outer walls. A test checks that the static stair route is the proof and that the cab passes `noFreeRide` at every stop. |

**Owner checkpoint:** play the slice before the batches go out.

### Waves 3–5: the theme batches (parallel within a wave, one theme per task)

Each task:

- adds `gen/stage/<theme>.ts`,
- adds the `claimSite` call to `sculptors/<theme>.ts` (and to its kit in `tall.ts`, if it needs one; `tall.ts` is touched by only one task per wave),
- adds `render/props/skins/<theme>.ts`,
- re-tunes that theme's `TWO_PART_ASK` entry. `common.ts` is a shared file, so the entry is reported and the orchestrator merges it.

**Done when:**

- `pnpm check` passes, which now includes the conformance suite (`tests/conformance/`, below): every concept, recipe and decor kind the task registers is held to its contract with no test of its own.
- `pnpm level --stats 50` passes the bar above.
- The landmarks contact sheet is looked at.
- A behaviour test covers what's particular to each concept (a cab parks at every floor, glass kills where it's drawn); the generic rules (it appears, it's grounded, the proof doesn't use its movers, no free ride) are the conformance suite's.

| Wave | Themes | Why this order |
|---|---|---|
| 3 | farm, harbor, volcano | Each already has a landmark style to promote (windmill, galleon, caldera), and they need flood and track first |
| 4 | jungle, mine, rooftops | Temple, headframe and train reuse the lift and track |
| 5 | glacier, space | Space has the highest free-ride risk; glacier needs ice-ground care |

### Afterwards

Run `pnpm test:stats`. Update `docs/PARODY.md` (set piece rows), `docs/DESIGN.md` and `src/gen/AGENTS.md` (the pipeline line).

### What Wave 0 landed, and where it differs from section 2

- **`src/gen/stage/`**: `types.ts` (`Concept`, `Landmark`), `index.ts` (`CONCEPTS`, all empty; `rollConcept`, `fits`, `conceptName`, `PLAIN_SHARE`, `PLAIN`). `Concept` gained three optional fields: `names` (decision 5), `budget` (the hazard slots its pieces use; default, how many it placed) and `carrier` (decision 1a).
- **`claimSite` is two calls.** The heightmap sculptors lay the ground after their stamps are planned, so `claimSite(ctx, k, slots, surf, locked?)` takes the columns and levels the ground, returning a `Claim`, and `raiseLandmark(g, ctx, claim, parts)` builds the tiles after `groundFromHeights`, reserves the air and sets `Shape.landmark` through `Grid.landmark`. A concept that owns the crossing carves and records it in its own `build` (with `pit` or `hintGap`), since only it knows where the gap goes. `claimSite` keeps `POCKET + SAFE_TILES` columns from either end. The sculptor rolls from `ctx.rng` for the site and the build; the pieces get `landmark:${attempt}`.
- **A live concept with no landmark rejects the attempt.** Until a theme's sculptor calls `claimSite`, registering a concept for it costs 8 attempts and ends plain, and `conceptFallback` shows it.
- **Pipeline** (`level/index.ts`): as in section 2, plus `ProfileOverride.concept` (`--concept`, `?concept=`), which also picks a size and route the concept fits unless those are forced. `PlacerOpts` gained `standing` (the landmark's pieces), `avoid` (its air) and `family`. `Piece.motion` reaches `finalize`, which now simulates whole-piece motion (`motionOffset`) and counts its period in `cycleFrames`.
- **Lanes** block the columns of `landmark.air`.
- **Tools**: `pnpm level --concept <id>|plain`, a `concepts` and `conceptFallbacks` column in `--stats`, `?concept=`, `pnpm shot --concept`, and a minimal `pnpm shot landmarks` (`tools/shot/landmarks.ts`, one level per registered concept) for task D to grow.
- **Additive sim types** (`sim/props/types.ts`): module `flood` (registered, claims its basin, does nothing yet; no art), Motion `track` (task B: constant speed along its polyline, closed loops go round, open ones ping-pong; guide art in `render/props/track.ts`), rail `dwell` (task B: parks on the tiles at each end, so an axis-aligned rail with a whole-tile range proves as a carrier lift), `SpikeLook` on `spikes` and `coat`, `GeyserLook` `water | toxic | snow`, `DecoKind` `facade | gantry | flywheel | headframe | hull | billboard | clockface`, and `FloodLook`.
- **Skins** live in `render/props/skins/<theme>.ts`, one `ThemeSkins` per theme, collected in `skins/index.ts`.
- **Carriers** (decision 1a): `Level.rides`, `gen/level/ride.ts` (`rideProof`, `carrierReach`, `rideSpans`, `MIN_DWELL`), reach.ts walking rides, and `routes.ts` exempting a ride's span from the mostly-open measure, like a bridge span. See decision 1a below.
- **`noFreeRide` (task C)** runs with `level.rides` in place. A carrier's own crossing is then already in the baseline, so it needs no special case: the check still snapshots every mover, the carrier included, and rejects any that lets a bare run reach the flag.

### What Wave 1 task A (Flood) landed

- **Sim** (`sim/props/modules/flood.ts`): the cycle is `floodState(m, frame, phase)`, a pure function of the frame, so snapshots carry nothing new. The surface waits at `low` through off and warn, rises (eased), holds at `high` and falls. The warning is drawn and never felt: the crest moves only after it.
- **Kills:** lava and toxic kill anything the liquid touches; the hazard's top is the crest. Water is a pit, as the bottom of the level is: you wade it and drown once wholly under. That is a `sink` hazard (additive on `Hazard`), counted as a fall, so it splashes like the pit and a shield doesn't stop it.
- **One number:** the module reports its crest as its `Beam` (`len` = height above the basin floor), and the art draws the crest from `beamOf`.
- **Barrier:** a new optional `ModuleSim.holds` gives the cells a module holds for most of its cycle, worked out from the cycle itself, because a flood's cycle can outlast the span `barrier.ts` samples. The flood marks every row the liquid covers for more than half its cycle, so the plan keeps clear of them.
- **Generator:** `capFlood(level, m, standing, cache)` (`gen/stage/flood.ts`) lowers `high` a tile at a time until the recorded solution still holds with the flood in. That keeps high water under the proven route. A concept runs its flood through it before yielding the piece.
- **Art** (`render/props/modules/flood.ts`): flat bands baked once and stamped at the crest, on BACKDROP so the basin's walls stand in front of them. In front of the terrain go the pen crest, glints, bubbles and the warning's froth lip, cut to the open liquid in each column. Lava alone glows. Water takes the theme's hue where the theme's liquid is water.
- **Shot:** `pnpm shot flood [--look lava|toxic|water] [--low 2] [--high 5]` lets a tide into the level. It shoots mid-warning, the two frames either side of the crest taking a runner, and high water.

### What Wave 2 task G (Castle) landed, and where it differs from section 3

- **Both concepts own the crossing** (`gen/stage/castle.ts`): a moat in front, its far bank their doorstep. A classic level's middle has no room for a castle moat beside a landmark this size, and a moat right of one could be cleared bare off its roof. The box is the widest one-part moat (`moatMax`) plus the structure; whatever the rolled moat doesn't take is courtyard. A two-part ask gets its second moat from the sculptor where one fits, as before.
- **Haunted Wing** (weight 3, classic and wide, timber skin): three storeys of plank and plaster. The hall runs straight through, front door to back door, so the floors above are the second way past, the one the mostly-open rule needs; with the glass on both walls, the outer walls can't be the second route. The dumbwaiter's shaft stands against the front wall with a stairwell of loose boards beside it (one-ways you walk under in the hall), so nothing on a route crosses the shaft. The stairs reach every floor; the top floor walks to a door high in the back wall. The cab is not a carrier (a manor is far shorter than `carrierReach().rows`): a rail with an additive `stops` (tiles along the rail) parks it flush with each floor, it's never on the proof, and `noFreeRide` passes at every stop. A drop chandelier hangs in the hall; the rotten boards are on the first floor beside the cab's stop (the top floor's would make the upper route a crumble the proof refuses); cobwebs fill the first floor's far corner.
- **Giant glass**: a new world-only module, `shards` (`sim/props/modules/shards.ts`), not a spike look. Triangles rolled from its seed stand out of a wall face, or a window frame cut into the wall (`inset`), up to two tiles out and 3 or 4 tall; the sim hurts with rects cut across each shard, as narrow as keeps them within `SHARD_FIT` (1 px) of its edge, and the art draws the same triangles. The manor's open margin either side is two columns where gravity leaves room (one under low gravity). Behind the frame, on BACKDROP, the night through it with stained glass left in the corners; in front, the frame, its gilt, a glint along the longest shard and the moon's light.
- **Throne Hall** (weight 2, stone skin): a hall between two towers, chandeliers on one prop so they swing as one, a drop chandelier over the throne's dais, the door behind it. The second route is over the roof.
- **Backdrop shells claim no cells** (`sim/props/modules/deco.ts`), so a facade can stand behind a landmark's walls; it rides in one of the concept's other pieces. The castle skin draws the manor's back wall (a paper per room, the family portraits whose eyes follow the nearest runner, guttering candles, a moonlit window, a grandfather clock) and the hall's (stained glass, banners, the throne). A lift's cage is the deco kind `cab`, with a bell that rings before each move and a lamp lit while it travels.
- **Weather after the landmark** (`level/index.ts`): the landmark's pieces now go in on the terrain's own footing, before weather; rain or snow the landmark can't keep the solution in stays clear. Before, a piece refused only in snow retried the attempt, so weather changed the terrain and a snapshot couldn't regenerate the level.
- **Castle filler** is castle-specific and bigger: giant glass on tall wall faces, a giant pendulum axe, a drop chandelier, and chandeliers (arm 3.5–6) only where a real ceiling holds them.
- **Tests and tools:** `tests/castle-concepts.test.ts`. The set-piece cap no longer counts a landmark's own pieces, and a hazard that never moves (a spike strip, the glass) needs no safe window: it's a wall the proof keeps clear of. `pnpm shot landmarks` shoots a lift parked at each of its stops.

### What Wave 2 task F (factory) landed

- **Both concepts own the crossing** (`gen/stage/factory.ts`). A classic level's middle is about 30 columns, and a 17-tile wheel beside a separate vat with its banks kept clear doesn't fit, so each landmark carves its vat (a 1-part `hardGap`) on its spawn side and stands on the far bank. Past the crossing, nothing it carries can ride a bare run over it. A two-part level builds its second vat itself where there's room (wide levels); a classic one ends up needing one part, and factory's `TWO_PART_ASK` goes from 0.36 to 0.41 to hold its two-part share (28% over 200 seeds, as before).
- **Routes `ltr` only, and not on a classic level under low gravity.** Levelling a ramp under a 30-column landmark leaves a wall nothing climbs; low gravity stretches the vat past the room. `Concept.fits(profile)` (additive) says so when the concept is rolled, so those levels stay plain rather than costing 8 attempts.
- **The Great Wheel**: a `rotor` with the new look `flywheel` (6 or 8 cars, arm 7 on a classic level, up to 9 on a wide one: 17 to 21 tiles across) and a `swinger` of 2 to 4 saws on the same axle, period and direction, riding in the gaps between cars. A rider standing in the middle of a car is never touched; the saws meet whoever jumps between cars. Under it, two static ways: a grated one-way catwalk at floor level over the flywheel pit, or, where the floor is too near the bottom for a pit, a raised catwalk over the floor. Behind it (the `flywheel` deco, drawn by `render/props/skins/factory.ts`): the rotating lattice rim, an A-frame on plinths in the pit (`wheelFeet`), a motor and belt, a beacon, and the board that says 0.
- **The Stamping Line**: three to five presses under a girder (a solid row you walk along, reached by ladders of one-way rungs), slamming onto a conveyor bed in sequence. `piston.lag` (additive) offsets each press's cycle within one prop; the slams roll down the line at about 9 tiles a second, mostly away from the spawn. The conveyor is a no-go for the plan, so the girder is the proof.
- **Filler** stays the theme's recipes: the wheel's family is press and forklift, the line's forklift and cog lift. A molten pour from the roof was tried and dropped: it needs a ceiling most factory levels don't have.
- **Shot**: `pnpm shot landmarks --theme factory --ride` stands three runners on the wheel's cars before the three phases.

### Contracts and the conformance suite

The owner: "landmarks should have generators and rules they adhere to, the level design does, the decor does, etc etc should make it really easy to extend and have the game engine itself make sure they do the right thing." So every generated kind declares its contract as data on its registry entry, and the engine checks it twice: while generating, where a violating instance is rejected and retried through the pipeline above, and in `tests/conformance/`, which runs every registered entry over a few fixed seeds, sizes and gravities. `src/gen/AGENTS.md` (Generators, contracts and the conformance suite) has the field-by-field guide; `src/gen/kinds.ts` has the table.

- **Landmarks** (`gen/stage/contract.ts`, `defineConcept`): `scale` (`large` by default: a third of the view along its biggest side; `grand`: it owns the view), `footing` (`grounded` by default, `hanging`, or `floating` where the ground floats), `ways` (2), `varies` (what its seed changes). The pipeline's `landmarkFaults` rejects a landmark that measures smaller than declared, has a column over open air, takes a protected cell or leaves one way past itself (`Routes.landmark`, the mostly-open share in its own columns). Its pieces must also warn before they hurt (`tellFaults`). The `Concept` literal keeps working: absent fields take the defaults.
- **Set pieces** (`gen/setpieces/contract.ts`): `unique` marks a hazard no other theme has, compared by mechanism (`hazardSignature`), never by look; every module that hurts has a tell in `TELLS`, and one that switches on warns for at least `MIN_TELL` frames.
- **Decor** (`gen/decor`): placement moved out of `render/terrain.ts` into `placeDecor`, behind the rules registry (`defineDecor`: themes, top or under, weight, room); the theme looks draw from the kinds registered for the theme. `render/decor.ts` only draws.
- **Per theme**: the owner's minimums (5 landmarks, 12 decor pieces, 3 unique hazards) are counted by `themeShortfalls`; `tests/conformance/themes` lists what each theme lacks as todos until it has them.

What it found in existing content when it landed: one Great Wheel (factory, stats seed 22, wide) had a single way past it (73% of the way with no second); the pipeline now retries it. The classic Throne Hall and Stamping Line don't yet vary with their seed (their plans are functions of their box), waived in `tests/conformance/lib.ts` until the owner's "every landmark varies" lands for them.

## 6. Decisions

The owner decided these on the proposal's open questions.

1. **Movers are never required.** They are optional fast or risky routes. The proof stays static, and every concept keeps a static way past itself.

   **1a. Except carriers, and then they're big.** In the owner's words: "A giant contraption could help you get past gaps fwiw so sometimes that's ok but if it's true the gap and contraption should be large." A concept may declare itself a `carrier`: a lift or ferry with a dwell across a chasm, a cable car, a crane trolley.
   - The gap it carries you over is beyond what `MAX_BRIDGES` parts close: `carrierReach()` measures it from `jumpProfile()` at the level's gravity (columns across, or rows up), and the contraption's travel is that gap, so it's at least as big.
   - The carrier's gap is not the level's part-requiring crossing. The parts policy holds elsewhere: about 99% need parts, about a quarter two, at most `MAX_BRIDGES`. `noFreeRide` exempts only the carrier's own crossing (by running with its rides in the baseline) and still rejects any mover, the carrier included, that lets a bare run skip the challenge crossing.
   - **The ride proof** (`rideProof`, `gen/level/ride.ts`) is conservative. Sampling two of the carrier's cycles, it needs stretches of at least `MIN_DWELL` frames (plus a walk across its deck) with every solid still and on the grid, at one end and then the other, and a rigid move between them. The carrier must never hurt, push, blow or catch. A runner standing still on its deck must stay clear of every non-empty tile and every other solid of it the whole way. The cells you step on from and off to must stand without it and lie outside everything it sweeps. Each crossing proven that way is a `Ride` on the level; reach.ts takes it as one move while both ends stand and every cell of the rider's path is empty, so a part placed in the way during a match closes it. A side wind closes every ride.
   - What it can't prove keeps a static way past, as before. A wheel rim that only passes level with the banks, without stopping, can't be proven by this check; a concept like that keeps its static route, or a later task adds a passing-window variant with a test.
2. **About 20% of levels are plain**; about 80% get a concept (`PLAIN_SHARE`), among levels where a concept fits the size and route.
3. **Triggers between pieces** (buttons, bells) are out of scope for now.
4. **The haunted manor is a castle concept**, "Haunted Wing", not a new theme.
5. **A level with a concept is named after its landmark**, "The Great Wheel of Skookaish Mill": `Concept.names` holds templates with `{place}`, the theme's place name. Plain levels keep today's names.
6. **Changes between rounds** are out of scope for now.
