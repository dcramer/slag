# art3d: the cast's drawn kinds

The production pipeline for the cast: one Roster entry in docs/CHARACTERS.md in, one kind the game draws out. Every rendered kind is a **flat kind**: designed once at game size, worn in an edit, drawn in a dozen poses by the image model with the design as its reference, and each drawing traced flat into the game's own shapes (docs/CHARACTERS.md → Rendered kinds). The game ships only the generated `src/render/cast/sprites/<kind>/frames.ts`; a kind with frames is always drawn from them. It costs no Tripo credits: images are free within the account's monthly allowance (the CLI prints what's left), and a kind takes about thirty.

The folder's name is history: kinds were rendered from 3D models until 2026-11-03, and that route is retired ([3D.md](3D.md)). Its tracer (`page/trace.ts`) is this route's too.

One agent per kind, in a worktree of its own: [CHECKLIST.md](CHECKLIST.md) is the run sheet and the done list. This README is the how.

```bash
node $tripo image "$(node tools/art3d/style.ts design KIND)" --aspect 1:1 --count 4 -o design.png
node $tripo image "$(node tools/art3d/style.ts worn KIND)" --ref design.png --aspect 1:1 --count 3 -o worn.png
node $tripo image "$(pnpm -s exec tsx tools/art3d/flat/build.ts pose KIND NAME)" --ref art/sprites/KIND/design.png --aspect 1:1 --count 2 -o NAME.png
python3 -I tools/art3d/flat/swatch.py art/sprites/KIND/design.png shots/KIND-swatch.png   # the design's colours, for map.families
pnpm exec tsx tools/art3d/flat/build.ts KIND    # trace every pose into src/render/cast/sprites/KIND/frames.ts
FLAT_DEBUG=idle pnpm exec tsx tools/art3d/flat/build.ts KIND   # that pose's dark specks, to tune the eyes
pnpm vitest run tests/sprite-cast.test.ts       # every kind held to the cast's box, eyes and variety
pnpm shot variety --kinds KIND [--theme mine]   # twelve looks, eight of it at play scale and 3×, the cast lineup
pnpm shot sprites --kind KIND                   # the run cycle, the six-rolls lobby, the draw cost, the blind silhouette sheet
```

`tripo` is `/home/dcramer/src/terra/tools/tripo/tripo.ts` (`node` it from anywhere; it reads terra's `.env`). The build needs python3 with Pillow. Sources under `art/` are in Git LFS (`.gitattributes`); builds and tests never read them, only `frames.ts`. Role maps land in `.cache/flat/KIND/` (a `*.png` beside each, to check a pose's roles).

## From the Roster entry

| Entry field                            | Where it goes                                                                                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kind, Name                             | The kind id: `art/sprites/<kind>/`, its entry `tools/art3d/flat/kinds/<kind>.ts`, `LOADERS` in `src/render/cast/sprites/index.ts`. (`CAST`, `KIND_NAMES`, `PAINTS` in `src/gen/character.ts` for a kind that isn't in the game yet.) |
| Silhouette, Traits, The nod, Our twist | `BRIEFS[kind].design` in `style.ts`: the nod and the twist as big shapes only, traits never a name. The wear: `BRIEFS[kind].worn`.                                                                                                   |
| Palette, Color slot                    | `roles` in the kind's entry: each role's `color`; the costume is `slot: 'player'`. A shade that carries a shape is a dark of its role (`on`, `tone`).                                                                                |
| Gait                                   | The clips: which drawings, and their timing.                                                                                                                                                                                         |
| Swaps                                  | `accessories`: a strip on the crown or across the cheek, an on-off slot each.                                                                                                                                                        |
| Palette alts                           | `alts` on one secondary role on `vary` 6.                                                                                                                                                                                            |
| Idles and cheers                       | `idle2` and `cheer2`: a drawing each, alternating with the idle.                                                                                                                                                                     |
| Gait range                             | `gait: { bounce, lean }`, each `[low, high]` under `GAIT_MAX`.                                                                                                                                                                       |
| Wear                                   | Two in the drawing (the worn edit), and the `wear` slot: scuffs and a scorch laid on every pose (`wear.marks`).                                                                                                                      |

## 1. Design, at game size

`node $tripo image "$(node tools/art3d/style.ts design KIND)" --aspect 1:1 --count 4`, no reference. `DESIGN` asks for one figure that reads as a 24 px sprite: one silhouette idea, about three big shapes, four flat colours plus ink, the prop, the eyes. Pick the one with the clearest silhouette and the twist as shapes, not detail.

- **The original redrawn.** For a famous design the image model draws the original whatever the brief says (the hedgehog came back with the joined eye shape and long legs twice). Two ways out: the kind's approved concept as the reference, with the brief's twist named again (`--ref art/sprites/KIND/concept.png`; the hedgehog's two eyes and heavy brows came back that way), or the twist pushed in the wear edit (the plumber's welding goggles). Never ship one that reads as the original redrawn (docs/CHARACTERS.md → Roster).
- **Put the signature prop first** in the brief: the image model ignores most of a prompt past its first ~1,800 characters.

## 2. The wear, as an edit

`node $tripo image "$(node tools/art3d/style.ts worn KIND)" --ref design.png --aspect 1:1 --count 3`. Asked for in the design prompt, the damage is dropped; as an edit of the picked design it lands and the design holds. Two to four big, worn shape changes (bent, cracked, taped, torn, patched, a sole flapping), never dirt or a rough line (Decision 9). Keep it off the face: a tape cross beside an eye reads as a third eye at play size. Save the pick as `art/sprites/KIND/design.png`; it is the `idle` pose.

## 3. Poses

Each pose's prompt is `posePrompt` (`flat/kinds.ts`) on the kind's `poses`, with the design as the reference: the image model copies a reference closely, which is what holds the character from pose to pose. Two per pose, keep the best as `art/sprites/KIND/flat/NAME.png`. The usual set: `idle2`, `walk-1`, `walk-2`, `run-1`, `run-2`, `air-1` (rising), `air-2` (falling), `wall`, `cheer`, `cheer2`, `death`.

- **`far`** for a pose far from the design's stance (lying knocked out, side on to a wall): it lets go of the view, or the model hands back the design's stance.
- **Reject** a drawing that lost a prop or the cap (the elf's falls threw his cap off), grew limbs (the dot-eater sprouted legs), changed a colour (a black plunger cup), or reads as a different expression than the clip (shut eyes are fine anywhere but the idle; the face kit has none to ride).
- **A drawn wall line** beside a wall slide is whitened out of the drawing before tracing: the column dark most of the way down, and only what's darker than the figure's fills (the plumber's and the dot-eater's).
- **Reuse** a drawing where a pose adds nothing: a ball slides down a wall in its fall, the elf's one jump drawing is his whole air clip, the hedgehog's jump is two spin-ball drawings looping.

## 4. The map

How `rolemap.py` reads the drawings, in the kind's `map` (`flat/kinds/<kind>.ts`):

- **`families`**: every colour of the design, shades and highlights included, each named for its role. `swatch.py` prints them and draws a sheet beside the design. A shade folds into its role: the drawing's cel shadow is gone, the figure is flat. A shade that carries a shape (the plumber's cap shadow and plunger cup) is a role of its own drawn as a dark of the costume (`on`, `tone`), so it follows the player's colour.
- **`line`** is the ink's role. Thin ink is the line and goes; ink thicker than `ink` px (default 9) stays a fill (the ear tips, the mouth). A thin dark prop (the elf's poker) gets a role of its own, or a lower `ink`.
- **`thin` and `fringe`**: the antialiased dots of a colour along the ink. Every colour role goes in `thin`, with `fringe: 5`, or the outline is speckled.
- **`white` glints** inside the eyes go to the ink's role, so the eyes trace whole.
- **`feet`** are what the figure stands on (its lowest pixels and its centre); **`loose`** roles are left out of its size (a tail, a carried poker). `body` sets every pose to one size: `pnpm exec tsx tools/art3d/flat/build.ts body KIND HEIGHT` prints the one that draws the design HEIGHT world px tall (the shipped kind's height, or about 20 to 22).
- **`min`** per role: the smallest part worth a shape. Raise it to drop slivers (a seam's highlight, the scraps of a tape cross's ink).
- **`stroke`**: the shortest interior line kept (default 1.4 world px; 2.4 for a detailed drawing, or its gloves and goggles fill with flecks). A long line across a ball (the puffball's seam) reads as a mouth at play size: `stroke: 99`, none.
- **`holes`**: the drawing's background closed in by the figure (the gap between an arm and the body, between the legs, a handle's eye), each patch over this many world px², cut through the frame so the level shows (the engineer's 0.8). Traced white, a gap shows as a white blob; folded into a colour, as a blotch. Off by default, since a white body (the goose) is closed in too, and set above a glint's or a tooth's size.
- **`cut`**: a drawn hole that is the read becomes a real one. The dot-eater's open mouth is a dark patch in the drawing; filled, its silhouette is a plain circle and the blind read failed. `cut: { role: 'dark', area: 2 }` takes out every dark patch over 2 world px² open to the outside.
- **A dark under the face** (the zapmouse's black cord belt) reads as a frowning mouth: `recolour` draws it in a role of its own.

## 5. Face, variety, frames

- **`eyes`**: the face kit replaces the drawing's eyes, specks at play size, and draws the cast's (`face`: size, iris, `eye: 'dot' | 'tall'`, a `mouth` offset if the kit draws one). The eyes are the pair of `role` specks `area` big and `gap` apart, in the figure's top `band`, never on its outline; `count: 1` takes the biggest, for one eye (the dot-eater) or a face turned nearly side on, with `pair` setting the far eye from the near one (the elf's sits on his outline, the hedgehog's is lost in its white). `specks` are what goes from the face box: the drawing's eyes, nose and mouth. Keep `face.r` small enough that two kit eyes don't overlap where the drawing's sit close. `FLAT_DEBUG=<pose>` prints that pose's specks with their area, band and distance to the edge. A small face's eyes (a few map pixels across) don't survive the tracer's smoothing: `from: 'map'` finds them in the role map (the engineer's). Eyes drawn tucked under a brim put the kit's shut eyes and cheer arcs on the brim's ink: `drop` moves the kit's eyes down after the drawn face is painted over, and `face.mark` sets the least width of those marks, so a small eye's aren't a hairline (both the engineer's). The face box's specks are painted over whole in the role map before the pose is traced again, so the face traces with no notch. Specks under 0.6 px² are drawn with no pen, so a glint doesn't get a pupil's ring. `recolour` takes several rules.
- **`wear`**: scuffs and a scorch, drawn as slanted streaks (a round blob reads as a spot), in tones of the surface they're `on`, at spots that keep their place in its box from pose to pose, only on bare surface below the `chin`. "No room for" in the build's output means a mark didn't fit a pose: make it smaller. On a smooth ball one quiet mark each (tones ±8 to ±18): a ring of blobs reads as a rash.
- **`accessories`**: a strip of tape or a plaster, on the crown or across the cheek, from the near eye. `offset` moves one off its place: on a small face the cheek's lands on the jaw, on the puffball under its blush. Not on a ball's crown: a cross there reads as a bow, and a ball with a bow as another character.
- **Colourways** must not land on another role's colour: drawn flat, the plumber's brown-canvas overalls were his tan gloves, and the colour block went.
- **Clips**: `frames` and timing (`fps`, `stride`, `vy`, `holds`). `eyes: false` for a pose whose eyes are shut. `centre: 'box'` and `scale` for a pose too wide for the cast's box (the lying death, the hedgehog's and the elf's wall slides, the dot-eater's pancake).

## 6. Check

`tests/sprite-cast.test.ts` loads every kind in `LOADERS`: each clip in both facings, inside the shared box pen and all (every slot option, the boldest gait), at least 18 px tall, every eye on its head and figure at the kit's size, the variety layers present and spread over the seeds, no wear on the face. Then look, at play scale and 3×, on a light theme and a dark one, beside the cast (`pnpm shot variety`), and the run cycle and lobby (`pnpm shot sprites`). The blind read is in the checklist.

## How it draws

- **Tracing** (`flat/build.ts`): each drawing's role map, at 12 px per world px, is cut into parts and traced by `page/trace.ts` with no depth steps (a drawing is flat); interior lines are thinned to their centres and walked into strokes. The frame's feet sit on the floor with the pen just under it; facing left is the mirror.
- **Drawing** (`src/render/cast/sprites/`): `draw.ts` draws a flat set's silhouette in one neutral ink (so the gaps between parts never show the costume's colour, or a dark of it) and its parts filled flat under a light pen (`flat`), the interior lines in that ink, no hard shadow of its own (its offset mottled thin limbs), and the face from `face.ts`; `index.ts` dresses it for a character (the costume's colour, the palette, the rolled accessories and wear, the gait's lift and lean) and keeps each drawn frame as a bitmap; `play.ts` picks the clip and frame from the pose.
- **Light**: every rendered figure marks its shape in the light map's alpha (`Renderer.markFigures`), and the cel pass lights it evenly, with no light band across it (`figAmbient` in `cel-shader.ts`).

## Files

| File                   | What it holds                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `flat/kinds.ts`        | The `FlatKind` type, `posePrompt`, and `FLAT_KINDS`, read from `flat/kinds/`                                 |
| `flat/kinds/<kind>.ts` | One kind: its map, roles, face, variety, clips and pose prompts                                              |
| `flat/build.ts`        | The build: role maps, tracing, the face, wear and accessories, `frames.ts`; `pose KIND NAME` prints a prompt |
| `flat/rolemap.py`      | A drawing to a role map at the tracer's resolution, with its interior lines                                  |
| `flat/swatch.py`       | A design's colours, for `map.families`                                                                       |
| `style.ts`             | `DESIGN` and `WORN`, and each kind's brief (`design`, `worn`; the rest is the 3D route's)                    |
| `page/trace.ts`        | Parts, folding, tracing, resampling (shared with the 3D route)                                               |
| `CHECKLIST.md`         | One kind's run sheet and done list                                                                           |
| `3D.md`                | The retired 3D route                                                                                         |
