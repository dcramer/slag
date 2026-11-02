# art3d: characters drawn from 3D

Turns a rigged, animated 3D model into the frames a runner is drawn from in game: every pose rendered side on, cut into flat paper-puppet parts, traced into a few clean curves, and inked at draw time by the cast's own pen (`contour` and `toned` in `src/render/ink-figure.ts`). The 3D model supplies poses, volume and consistency across angles; the look is the game's hand. It's a dev tool: Three.js runs in headless Chromium (the browser the shot tools use), served by Vite, and nothing here ships. The game ships only the generated frame table, `src/render/cast/sprites/<kind>/frames.ts`.

```bash
pnpm sprites                       # every kind with art/sprites/<kind>/sprite.json, into src/render/cast/sprites/<kind>/frames.ts
pnpm sprites plumber [--zoom 6 --only idle,run]   # one kind; the contact sheet at that zoom, those clips
pnpm sprites keys plumber [--keys launch,wall]    # each keyed pose alone, both facings: for setting keys from the pose sheet
pnpm sprites study plumber [--frames 16] [--clips a,b] [--from 0.3 --to 0.6] [--face]
                                   # every animation in the model, sampled evenly: shots/art3d/plumber-study.png
pnpm sprites inspect FILE.glb      # a raw model: turnaround (painted and clay), its clips, its texture's colours
pnpm shot sprites [--kind plumber] # in game beside the hand-drawn cast, plus the blind silhouette read
```

`pnpm sprites plumber` takes about 4 s and writes `shots/art3d/<kind>-frames.png` (every frame, both facings, drawn by the game's drawer) and `-silhouettes.png` (play scale, solid). In the game, `?sprites=1` (or `slagDebug.sprites.use(true)`) draws the rendered kinds in place of their hand-drawn bodies; each kind's frames are a chunk fetched on first use, so without the flag nothing new loads or draws.

## What is checked in, per kind

`art/sprites/<kind>/` holds the source art and the settings:

| File                                           | What it is                                                                             |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `concept.prompt.txt`, `concept.png`            | The design in the game's ink style (`conceptPrompt` in `style.ts`)                     |
| `pose.prompt.txt`, `poses.png`                 | The pose sheet: every pose the game plays; keyed poses follow it (`posePrompt`)        |
| `model.prompt.txt`, `tpose.png`, `view-*.jpeg` | The figure the model was made from (`modelPrompt`), and Tripo's other views of it      |
| `model.glb`                                    | The rigged, animated model as Tripo exports it (plain glTF, in place, 1024 px texture) |
| `sprite.json`                                  | The render settings (`Settings` in `settings.ts`)                                      |

`pnpm sprites` regenerates the game's frames from `model.glb` and `sprite.json`. Only a new `model.glb` needs Tripo.

## Making a kind

With the owner's Tripo CLI (terra's `tools/tripo/tripo.ts`, run from that repository so it reads its `.env`; its README lists every command's credits):

1. **Brief.** Add the kind to `BRIEFS` in `style.ts`: traits only, never a name. Its comment lists the nod (each trait the read needs, and why) and the twist (what's ours, and the joke). docs/CHARACTERS.md → Rendered kinds keeps both.
2. **Concept and pose sheet** (free): `image "$(node tools/art3d/style.ts concept KIND)" --ref <a concept> --aspect 16:9 --count 2`, then `image "$(node tools/art3d/style.ts pose KIND)" --ref concept.png --aspect 16:9 --count 2`. The pose prompt opens on the layout: one that opens on "model sheet" gets the model sheet back.
3. **Model sheet** (free): `image "$(node tools/art3d/style.ts model KIND)" --ref concept.png --t-pose --count 3`. One figure, flat matte colour, no ink. Keep gear clear of the arms (the auto-rig weights whatever touches an arm to it). A signature prop the generator keeps dropping is better built as a `prop` (below).
4. **Model** (40 with these options): `model tpose.png --texture-quality standard --no-pbr` (or `--views F L B R` when the side views agree with the front). Check it with `pnpm sprites inspect`.
5. **Rig** (20): `rig PROJECT --skeleton unreal`. **Animate**: presets are free (`animate PROJECT idle walk run jump fall hurt cheer climb --in-place`; `die` doesn't exist); `--prompt` motions are 20 each and a lottery, so key what the presets don't give.
6. **Export** (free): `export PROJECT --format glb --animations --in-place --texture-size 1024 -o art/sprites/KIND/model.glb`.
7. **Settings.** `pnpm sprites inspect` lists the texture's colours to sort into roles; `pnpm sprites study` shows every animation to cut clips from; `pnpm sprites keys` shows keyed poses while you set them from `poses.png`.

## How it draws

- **Camera.** Orthographic, side on, the figure turned `yaw` degrees toward the camera and looked down on by `pitch`. Both facings are rendered, so the light stays up-left and one-sided gear stays where it is. Every clip runs in place (the hips over the feet); an airborne clip (`pin: "hips"`) also holds the hips at rest height, since the sim does the lifting; `face` turns back a motion that spins the whole body round; `center` centres a figure lying down.
- **Roles.** Tripo paints with baked light and noise. Each texel goes to the role of its nearest swatch in Lab, cleaned by a majority filter (`roles.ts`), so the game paints the roster's flat colours and knows every part's material. A role with `slot: "paint"` takes the character's own colour.
- **Parts.** One pass writes each pixel's role and depth at `trace.res` px per world px. `trace.ts` cuts that into parts (4-connected, one role, no depth step over `step`), folds any part under `trace.min` world px² (or the role's `min`) into the neighbour it borders most, traces each part grown by a pixel (so smoothed neighbours overlap instead of cracking), simplifies (`trace.eps`), rounds the corners (`trace.smooth` Chaikin passes) and drops the points a line would do. Parts go back to front by depth. Eyes (`glint` roles in the upper half) get a catch-light.
- **Pen** (`src/render/cast/sprites/draw.ts`, at runtime): the silhouette on its ink mass with three lifting strokes (`contour`), every part a flat shape on its own mass, thin toward the light and heavy away, with a hard sliver of its shade (`toned`), then one hard shadow shape over the figure, the glints, and a boil on threes. Same pen, same weights as the hand-drawn kinds.
- **Caricature.** `scale` grows bones about their joints (head, hands, feet); `girth` draws the whole figure wider (a clip may set its own, as a figure lying down does); `props` builds a signature prop from primitives (`cylinder`, `cup`, `sphere`) on a bone, in world px and the figure's own axes.
- **Keyed poses.** `keys` are poses set by hand from the pose sheet: a base (`clip@fraction` or `rest`), bones turned in the figure's own axes (degrees; x is its left, so a turn about x swings a limb forward or back), bones stretched (`scale`, an arm punched past a big head), a `yaw` cheat toward the camera, and a `roll` about the screen (the spin ball). `_near` and `_far` name the limbs on the camera's side and the other, authored facing right; facing left they swap and mirror. A clip with `keys` runs through them, blending turns and stretches.
- **Weight fixes.** `rebind` moves skin weight that sits on a bone far from the skin (terra's rig check calls it `reach`) to another bone.
- **Clips at runtime** (`play.ts`): idle and cheer by time, walk and run by distance (`stride`, world px per loop), the air clip by vertical speed (`vy`) or by time, the wall clip facing the wall, and a death clip for half a second where a runner came apart.

## Files

| File                               | What it holds                                                               |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `sprites.ts`                       | The command: serves the page, drives it, writes the frame table and sheets  |
| `settings.ts`                      | `Settings`, shared by the command and the page                              |
| `style.ts`                         | The concept, pose-sheet and model-sheet prompts, and each kind's brief      |
| `page/render.ts`                   | Loading, caricature, props, keyed poses, the camera and the role/depth pass |
| `page/trace.ts`                    | Parts, folding, tracing and simplifying                                     |
| `page/roles.ts`                    | Texture to roles; the swatch finder for `inspect`                           |
| `page/weights.ts`                  | Weight fixes                                                                |
| `page/inspect.ts`, `page/sheet.ts` | The turnaround and the contact sheets (drawn by the game's drawer)          |
