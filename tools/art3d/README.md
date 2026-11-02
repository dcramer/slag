# art3d: characters rendered from 3D

Turns a rigged, animated 3D model into the cel-shaded, inked sprite atlases a runner is drawn from in game, the way Dead Cells renders its 3D characters to 2D frames. It is a dev tool: Three.js runs in headless Chromium (the browser the shot tools use), served by Vite, and nothing here ships. The game ships only what it writes: two PNG atlases per scale and a generated frame table (`src/render/cast/sprites/<kind>/`).

```bash
pnpm sprites                      # every kind with art/sprites/<kind>/sprite.json, into src/render/cast/sprites/<kind>/
pnpm sprites plumber              # one kind
pnpm sprites study plumber [--frames 16] [--clips idle,run] [--from 0.3 --to 0.6]
                                  # every animation in the model, sampled evenly: shots/art3d/plumber-study.png
pnpm sprites inspect FILE.glb     # a raw model: turnaround (painted and clay), its clips, its texture's colours
pnpm shot sprites [--kind plumber] # in game beside the hand-drawn cast: shots/sprites-<kind>.png
```

`pnpm sprites plumber` takes about 20 s and also writes `shots/art3d/<kind>-play.png` and `-card.png`, every frame of both atlases on a contact sheet. In the game, `?sprites=1` (or `slagDebug.sprites.use(true)`) draws the rendered kinds in place of their hand-drawn bodies. Without it the game loads and draws nothing new.

## What is checked in, per kind

`art/sprites/<kind>/` holds the source art and the settings:

| File                                           | What it is                                                                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `concept.prompt.txt`, `concept.png`            | The design in the game's ink style, from `conceptPrompt` in `style.ts`                                                         |
| `model.prompt.txt`, `tpose.png`, `view-*.jpeg` | The figure the model is made from: one T-posed, flat-coloured figure (`modelPrompt`), and Tripo's other views of it            |
| `model.glb`                                    | The rigged, animated model as Tripo exports it (plain glTF, in place, 1024 px texture). Everything below is rendered from this |
| `sprite.json`                                  | The render settings (`Settings` in `settings.ts`)                                                                              |

`pnpm sprites` regenerates everything in the game from `model.glb` and `sprite.json`. Only making a new `model.glb` needs Tripo.

## Making a kind's model

With the owner's Tripo CLI (terra's `tools/tripo/tripo.ts`, run from that repository so it reads its `.env`; see its README for the commands and their credits):

1. **Concept** (free): `image "$(node tools/art3d/style.ts concept KIND)" --ref <an approved concept> --aspect 16:9 --count 2`. Add the kind's brief to `BRIEFS` in `style.ts` first: traits only, never a name, and a clear twist of ours on top of the nod (docs/CHARACTERS.md → Rendered kinds lists both for each kind). Iterate until the design is right; a bad design can't render well.
2. **Model sheet** (free): `image "$(node tools/art3d/style.ts model KIND)" --ref concept.png --t-pose --count 3`. One figure, flat matte colour, no ink: painted lines and shading would bake into the texture. Keep worn gear clear of the arms in the T-pose (the auto-rig weights whatever touches an arm to it).
3. **Views** (free): `views tpose.png`. Use only the views that agree with the front; the generator invents side views freely.
4. **Model** (40 credits with these options): `model --views tpose.png - view-back.jpeg - --texture-quality standard --no-pbr`. Check it with `pnpm sprites inspect`: proportions, silhouette in profile, and the signature part.
5. **Rig** (20): `rig PROJECT --skeleton unreal`.
6. **Animate**: presets are free (`animate PROJECT idle walk run fall cheer --in-place`; `jump`, `hurt` and `climb` exist too, `die` doesn't); `--prompt` motions are 20 each. The plumber needed two: a platformer jump with an airborne pose, and a wall slide.
7. **Export** (free): `export PROJECT --format glb --animations --in-place --texture-size 1024 -o art/sprites/KIND/model.glb`.

Then write `sprite.json`: `pnpm sprites inspect` lists the texture's colours to sort into roles, and `pnpm sprites study` shows every animation to cut clips from.

## How it renders

- **Camera.** Orthographic, side on, the figure turned `yaw` degrees toward the camera and looked down on by `pitch`. Each facing is rendered from the model, not mirrored, so the light stays up-left on both and asymmetric gear (the plunger on one shoulder) is right on both. Frames are cut from a fixed box about the feet (`BOX`) and trimmed; every clip runs in place, the hips held over the feet, and an airborne clip (`pin: "hips"`) also holds them at rest height, since the sim does the lifting.
- **Roles.** Tripo paints its texture with baked light, soft edges and noise. Each texel is sorted to the role of its nearest swatch in Lab and cleaned with a majority filter (`roles.ts`), so the sprite is painted in the roster's flat colours with crisp borders, and every pixel knows its material.
- **Tone.** N·L from normals smoothed over `smooth` × the height (so bands follow the big forms, not the mesh's lumps), cut by `bands` into lit, base and shade, each the role's colour times a scalar (`tones`).
- **Pen.** Drawn in the compositor (`ink.ts`) from a vector distance transform: a contour round the silhouette `ink.lit` world px wide toward the light and `ink.shadow` away from it, and interior lines `ink.interior` wide where a part passes in front of another (a depth step over `step`) or one role meets another drawn on top of it (`over`). A line is the role's colour pulled `ink.mix` of the way to near-black `INK`, a dark of what it outlines (docs/ART.md).
- **Masks.** The atlas is linear in each recolourable slot's colour: a tone is B times a scalar, the pen is B pulled toward ink. The mask PNG holds that scalar per pixel (R for `paint`, G for `player`, × 200), so the game recolours exactly with `c' = c + (B' − B)·T` (`tint` in `src/render/cast/sprites/play.ts`).
- **Supersampling.** Everything above runs at `ss`× the sprite's resolution and is box-filtered down.
- **Weight fixes.** `rebind` moves skin weight that sits on a bone far from the skin (terra's rig check calls the fault `reach`) to another bone: the plunger, fused into the body mesh and weighted to a finger in the T-pose, rides the upper spine instead of the hand.
- **Scales.** `scales.play` sprite px per world px for every clip in a race (3: a 1080p screen shows 2.5), and `scales.card` for the clips marked `card` (idle and cheer, for the lobby, score and victory screens).

Clips play from the same pose the hand-drawn cast reads (`src/render/cast/sprites/play.ts`): idle and cheer by time, walk and run by distance (`stride`, world px per loop), the air clip by vertical speed (`vy`), the wall clip facing the wall, and a death clip for half a second where a rendered runner came apart.

## Files

| File                               | What it holds                                                                       |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| `sprites.ts`                       | The command: serves the page, drives it, writes atlases, the frame table and sheets |
| `settings.ts`                      | `Settings`, shared by the command and the page                                      |
| `style.ts`                         | The concept and model-sheet prompts, and each kind's brief                          |
| `page/render.ts`                   | Loading, posing, the camera, the render pass, trimming and packing                  |
| `page/ink.ts`                      | The compositor: tone, pen, masks, downsampling                                      |
| `page/roles.ts`                    | Texture to roles; the swatch finder for `inspect`                                   |
| `page/weights.ts`                  | Weight fixes                                                                        |
| `page/inspect.ts`, `page/sheet.ts` | The turnaround and the contact sheets                                               |
