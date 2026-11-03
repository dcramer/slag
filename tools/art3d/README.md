# art3d: characters drawn from 3D

The production pipeline for the cast: one Roster entry in docs/CHARACTERS.md in, one kind the game draws out. A 3D model supplies the poses, volume and turn; the look is the game's own hand. Every pose is rendered side on, cut into flat parts, traced into a few clean curves, and inked at draw time by the cast's pen (`contour` and `toned` in `src/render/ink-figure.ts`) with the cast's face kit on top. It's a dev tool (Three.js in headless Chromium, served by Vite); the game ships only the generated `src/render/cast/sprites/<kind>/frames.ts`, behind `?sprites=1` until the owner rolls the cast out.

One agent per kind, in a worktree of its own: [CHECKLIST.md](CHECKLIST.md) is the run sheet and the done list. This README is the how.

The sources under `art/` (models, sheets, views) are in Git LFS (`.gitattributes`); builds and tests never read them, only the generated `frames.ts`. Fetch one kind's with `git lfs pull --include "art/sprites/KIND/**"`, and commit new ones as usual: the filter stores them in LFS.

```bash
pnpm sprites KIND [--zoom 6 --only idle,run]   # trace the kind into src/render/cast/sprites/KIND/frames.ts; sheets in shots/art3d/
pnpm sprites keys KIND [--keys launch,wall0] [--pick 0,0,0,0,2]
                                                # each keyed pose alone, both facings, while setting keys from the pose sheet;
                                                # --pick shows those slot options (the wear, say) on this and the frames sheet
pnpm sprites study KIND [--frames 16] [--clips a,b] [--from 0.3 --to 0.6] [--face]
                                                # every animation in the model, sampled evenly, to cut clips from
pnpm sprites inspect FILE.glb                   # a raw model: turnaround (painted and clay), clips, bones, texture colours
pnpm shot sprites --kind KIND                   # in game: comparison sheets, six-rolls lobby, draw cost, blind silhouette sheet
pnpm shot variety --kinds KIND[,KIND]           # in game: twelve looks of each kind, eight of it at play scale, the cast lineup
```

`pnpm sprites KIND` writes `shots/art3d/KIND-frames.png` (every frame, both facings, drawn by the game's drawer), `-silhouettes.png` (play scale, solid) and `-rolls.png` (twelve characters' variety: the idle and cheer each plays, its palette, swaps and wear, then each colourway and each wear alone).

## From the Roster entry

Each field of an entry has one place it goes:

| Entry field                 | Where it goes                                                                                                                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kind, Name                  | The kind id: `art/sprites/<kind>/`, `LOADERS` in `src/render/cast/sprites/index.ts`. (`CAST`, `KIND_NAMES`, `PAINTS` in `src/gen/character.ts` for a kind that isn't in the game yet.) |
| Silhouette, Traits, The nod | `BRIEFS[kind].character` in `style.ts` (traits only, never a name); what the model sheet and `sprite.json`'s caricature must keep readable                                             |
| Our twist                   | The brief, and a `prop` when the image model keeps dropping it (the plumber's plunger)                                                                                                 |
| Palette, Color slot         | `roles` in `sprite.json`: each role's `color`; the kind's own colour is `slot: "paint"`; a ring is the shared drawer's                                                                 |
| Gait                        | The clips: which presets, which keyed poses, a generated ball                                                                                                                          |
| Swaps                       | `props` with a `slot` each (option 0 empty, option 1 the item), `slots` mapping each to a `vary` index (0–5)                                                                           |
| Palette alts                | `alts` on the region's role (and on every role that changes with it, as many each), on `vary` 6, the default                                                                           |
| Idles and cheers            | `idle2` and `cheer2` clips: keys from the pose sheet, or a cut of another stretch of a model animation                                                                                 |
| Gait range                  | `gait: { bounce, lean }`, each a `[low, high]` range under `GAIT_MAX`                                                                                                                  |
| Wear                        | a `wear` slot on `vary` 11: three props, the first empty, then scuffed and scorched; their marks are parts stuck on the skin (`face`), each in a role `on` the surface with a `tone`     |
| Rig                         | `rig --type humanoid` or `--type other`; **keyed** means the poses are keyed here                                                                                                      |
| Concept prompt              | `BRIEFS[kind]`; `style.ts` adds the house style                                                                                                                                        |

## Sheets (free)

From terra (`cd /home/dcramer/src/terra`; the Tripo CLI reads that repo's `.env`). `tripo=tools/tripo/tripo.ts`.

1. **Concept:** `node $tripo image "$(node <slag>/tools/art3d/style.ts concept KIND)" --ref <a finished concept> --aspect 16:9 --count 2`. A finished kind's concept as the reference keeps the house look.
2. **Pose sheet:** `node $tripo image "$(node <slag>/tools/art3d/style.ts pose KIND)" --ref concept.png --aspect 16:9 --count 2`. The prompt opens on the layout: one that opens on "model sheet" gets the model sheet back.
3. **Model sheet:** `node $tripo image "$(node <slag>/tools/art3d/style.ts model KIND)" --ref concept.png --t-pose --count 3`. One figure, flat matte colour, no ink, gear clear of the arms. Redraw from the best candidate (`--ref` it, say only what changes) until the figure is right; a bad model can't render well.

**The twist pass.** Before any credits: put the concept next to the original in your head. If it reads as the original redrawn, push the twist (a changed signature prop, a different body detail, foundry or scrap flavour, one joke). If a nod trait is missing or hidden, put it back. The entry decides both.

## Model, rig, motion (credits)

| Step             | Command                                                                                                 | Credits |
| ---------------- | ------------------------------------------------------------------------------------------------------- | ------- |
| Views (optional) | `views tpose.png` (use only views that agree with the front)                                            | 0       |
| Model            | `model tpose.png --texture-quality standard --no-pbr` (or `--views F L B R`)                            | 40      |
| Check            | `pnpm sprites inspect FILE.glb`: proportions, profile, the nod traits as geometry                       | 0       |
| Rig              | `rig PROJECT --skeleton unreal` (humanoid) or `--type other`                                            | 20      |
| Presets          | `animate PROJECT idle walk run jump fall hurt cheer climb --in-place --texture-size 1024`               | 0       |
| Motions          | `animate PROJECT --prompt "…" --seconds 2 --in-place` (humanoid rigs only; a lottery)                   | 20 each |
| Export           | `export PROJECT --format glb --animations --in-place --texture-size 1024 -o art/sprites/KIND/model.glb` | 0       |

A humanoid kind costs 60, plus any motions (round 3's two kinds used none: everything presets didn't give was keyed). Record every project id and charge in your report.

## sprite.json

The settings are `Settings` in `settings.ts`, documented field by field. Start from `art/sprites/plumber/sprite.json`. In order:

- **Roles.** `pnpm sprites inspect` lists the texture's colour clusters; give each a role in the entry's palette (`swatches` are the colours as painted; `color` the palette's). Eyes get `glint` (and a `band`, from the top, when goggles or a visor sit above them). Too-fine details fold `into` a neighbour or get a smaller `min`.
- **The nod, drawn bigger.** A trait that shares a colour with something else (the plumber's nose and cap are the shirt's red) is split off by a `region` (a box of the bind pose) into a role of its own, which can then `grow`. `scale` grows bones (head, hands, feet); `girth` draws the figure wider than the model, per clip if a pose would leave the box.
- **Props.** The signature prop the generator drops, built from `cylinder`, `cup`, `sphere` and `box` on a bone, in world px and the figure's axes (x its left, y up, z forward). Swaps: two props per `slot`, the first empty; their roles are their own and `free` (off the silhouette); `slots` maps each to a `vary` index.
- **Face.** `face: { r, iris, mouth? }`; `anchor` sets the eyes from another part (the nose, the puffball's painted smile) when the model's eyes are too small to trace, turning with a rolled pose; `eye: "tall"` draws tall black eyes with a shine and a blush instead of cartoon eyes.
- **Variety** (docs/CHARACTERS.md → Rules for every kind → Variety). Three layers per kind, each rolled from the look seed:
  - **Palette alts:** 2–3 colourways on one secondary region: `alts` on its role, and on every role that changes with it (a shoe and its sole), as many on each. They take `vary` 6 unless a role says otherwise; an accessory's colour takes its slot's roll instead. Never the costume, skin, eyes or face.
  - **Idles and cheers:** `idle2` and `cheer2`, two to four frames each (the frame budget is tight), keyed from the pose sheet or cut from another stretch of an animation (`pnpm sprites study`). Keep hands off the face: arms folded low read, arms folded high cover the face. Plus `gait`: the extra bounce on each step (world px) and the forward lean (a skew), each a `[low, high]` range under `GAIT_MAX` in `play.ts`.
  - **Wear:** a slot named `wear` on `vary` 11 with three props: an empty one (clean), scuffed and scorched. Each mark is a flattened `sphere` part with its own `bone` and a `face` direction: the tracer casts from `at` (inside the limb) out along `face` to the skin and lays the mark flat on it, half sunk, so what shows is a small cap the body's own shape. `size` is width, height and thickness; `rot`'s third angle spins it; long thin marks (about 1 × 0.35 px) read as scuffs and streaks, round ones as patches. Each mark's role is `free`, `on` the role it sits on, with a `tone` (a faded patch +14, a scuff +20, soot −22 to −26), so it follows that surface's colourway. Three to five marks an option, on the body, limbs and shoes, never the head. Check with `pnpm sprites keys KIND --keys … --pick 0,0,0,0,2`.
- **Clips.** idle (fps), walk and run (`stride`, world px per loop), air (`vy` from the jump's keys, or `ball: true` with a `ball`), wall (keys), cheer (fps), death (`center`). Sources: a model animation (`src`, `from`, `to`) or `keys`.
- **Keys.** From the pose sheet: a base (`idle@0.05`), bones turned in degrees about the figure's axes (about x swings a limb forward or back), named `_near` / `_far` for the camera's side and the other (authored facing right; facing left mirrors), `yaw` to cheat the pose toward the camera, `scale` to stretch a bone (keep it small: the owner wants poses, not rubber), `roll` to spin the figure.
- **Weights.** `rebind` moves skin weight from a bone the skin is far from (a strapped prop painted to a finger) to the one it should follow.

Set keys with `pnpm sprites keys KIND --keys a,b --zoom 6`; check the whole kind with `pnpm sprites KIND --zoom 6`.

## Non-humanoid kinds (keyed)

- **Rigged** (`--type other`): Tripo names the bones its own way; `pnpm sprites inspect` lists them. Key poses with those names. `_near` / `_far` resolve to names ending `_l` / `_r`; a rig without that suffix names its limbs outright, one key per facing if it's asymmetric. Presets for other rigs are few (`walk` for quadrupeds) and prompt motions aren't available, so every clip but walk is keyed.
- **Generated** (the puffball): a body simple enough to build from primitives is built in `page/<kind>.ts` with its own bones, flat key colours for its roles and its face painted where the anchor needs it, registered in `GENERATED` (`page/load.ts`), and named `"model": "gen:<kind>"` in `sprite.json`. No credits, no binary, and the rig has exactly the bones the keys turn. Every clip is keyed from `rest`.
- **Limbless** (the dot-eater, the jelly): no model or rig at all. Generate the frames as `page/ball.ts` does the spin ball: a shape in the roster's colours, its motion (a chomp, a bob) as frames, marks for speed. One generator per kind in `page/` (`page/chomper.ts` is the worked example), registered in `GENERATORS` in `page/shapes.ts`; `sprite.json` names it in `shape` (`{ "by": "chomper", "r": 9.6 }`) in place of `model`, and its clips carry only frames and timing, since the generator draws each clip by name. Its roles need no `swatches`, and a slot's options are counted from the parts it tags.

## Done

[CHECKLIST.md](CHECKLIST.md) has the run sheet and the done list. In short: the nod reads in colour at play scale, the twist on the lobby cards; the variety sheet's twelve looks are one character by one hand; fresh readers name it from the blind silhouette sheet; `tests/sprite-cast.test.ts` passes (it loads every kind registered in `LOADERS` and holds each to the variety layers); the cached draw cost is a few hundredths of a ms per runner; `pnpm check` and `pnpm build` pass.

## How it draws

- **Camera.** Orthographic, side on, the figure turned `yaw` degrees toward the camera and looked down on by `pitch`. Both facings are rendered. Every clip runs in place (the hips over the feet); `pin: "hips"` holds them at rest height for the air; `face` turns back a motion that spins the body; `center` centres a figure lying down; a grounded frame's soles sit just above the floor, where the pen lands.
- **Roles.** Each texel goes to its nearest swatch's role (Lab), cleaned by a majority filter; regions split a role by place in the bind pose.
- **Parts.** One pass writes role and depth at `trace.res` px per world px; `trace.ts` cuts parts (one role, no depth step over `step`), folds those under `min` into a neighbour, traces each grown by a pixel, simplifies, rounds and resamples it evenly from a fixed start. A part that only moved since the frame before keeps its line (`steady`), so lines move only with the pen's boil. Accessories render in passes of their own and are tagged with their slot and option.
- **Drawing** (`src/render/cast/sprites/`): `draw.ts` inks a frame (silhouette mass and strokes, parts `toned`, one hard shadow shape, marks, the face from `face.ts`); `index.ts` dresses it for a character (the costume's colour, the palette, the rolled swaps and wear, the gait's lift and lean) and keeps each drawn frame as a bitmap per character, boil step, mood and scale bucket; `play.ts` picks the clip and frame from the pose, and each character's variety (`varietyOf`) from its rolls.

## Files

| File                                | What it holds                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------------- |
| `sprites.ts`                        | The command: serves the page, drives it, writes the frame table and the sheets        |
| `settings.ts`                       | `Settings`, shared by the command and the page                                        |
| `style.ts`                          | The concept, pose-sheet and model-sheet prompts, and each kind's brief                |
| `CHECKLIST.md`                      | One kind's run sheet and done list                                                    |
| `page/render.ts`                    | Loading, caricature, props and swaps, keyed poses, the camera and the role/depth pass |
| `page/trace.ts`                     | Parts, folding, tracing, resampling, steadying, the eyes                              |
| `page/ball.ts`                      | The generated spin ball (the model for limbless kinds)                                |
| `page/shapes.ts`, `page/chomper.ts` | Limbless kinds: the generator registry, and the dot-eater's generator                 |
| `page/roles.ts`, `page/weights.ts`  | Texture to roles; weight fixes                                                        |
| `page/inspect.ts`, `page/sheet.ts`  | The turnaround; the contact, keys and rolls sheets (drawn by the game's drawer)       |
