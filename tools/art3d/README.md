# art3d: characters drawn from 3D

The production pipeline for the cast: one Roster entry in docs/CHARACTERS.md in, one kind the game draws out. A 3D model supplies the poses, volume and turn; the look is the game's own hand. Every pose is rendered side on, cut into flat parts, traced into a few clean curves, and inked at draw time by the cast's pen (`contour` and `toned` in `src/render/ink-figure.ts`) with the cast's face kit on top. It's a dev tool (Three.js in headless Chromium, served by Vite); the game ships only the generated `src/render/cast/sprites/<kind>/frames.ts`, behind `?sprites=1` until the owner rolls the cast out.

One agent per kind, in a worktree of its own: [CHECKLIST.md](CHECKLIST.md) is the run sheet and the done list. This README is the how.

The sources under `art/` (models, sheets, views) are in Git LFS (`.gitattributes`); builds and tests never read them, only the generated `frames.ts`. Fetch one kind's with `git lfs pull --include "art/sprites/KIND/**"`, and commit new ones as usual: the filter stores them in LFS.

```bash
pnpm sprites KIND [--zoom 6 --only idle,run]   # trace the kind into src/render/cast/sprites/KIND/frames.ts; sheets in shots/art3d/
pnpm sprites keys KIND [--keys launch,wall0]    # each keyed pose alone, both facings, while setting keys from the pose sheet
pnpm sprites study KIND [--frames 16] [--clips a,b] [--from 0.3 --to 0.6] [--face]
                                                # every animation in the model, sampled evenly, to cut clips from
pnpm sprites inspect FILE.glb                   # a raw model: turnaround (painted and clay), clips, bones, texture colours
pnpm shot sprites --kind KIND                   # in game: comparison sheets, six-rolls lobby, draw cost, blind silhouette sheet
```

`pnpm sprites KIND` writes `shots/art3d/KIND-frames.png` (every frame, both facings, drawn by the game's drawer), `-silhouettes.png` (play scale, solid) and `-rolls.png` (six characters' accessories, and all on).

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
- **Face.** `face: { r, iris, mouth? }`; `anchor` sets the eyes from another part (the nose) when the model's eyes are too small to trace.
- **Clips.** idle (fps), walk and run (`stride`, world px per loop), air (`vy` from the jump's keys, or `ball: true` with a `ball`), wall (keys), cheer (fps), death (`center`). Sources: a model animation (`src`, `from`, `to`) or `keys`.
- **Keys.** From the pose sheet: a base (`idle@0.05`), bones turned in degrees about the figure's axes (about x swings a limb forward or back), named `_near` / `_far` for the camera's side and the other (authored facing right; facing left mirrors), `yaw` to cheat the pose toward the camera, `scale` to stretch a bone (keep it small: the owner wants poses, not rubber), `roll` to spin the figure.
- **Weights.** `rebind` moves skin weight from a bone the skin is far from (a strapped prop painted to a finger) to the one it should follow.

Set keys with `pnpm sprites keys KIND --keys a,b --zoom 6`; check the whole kind with `pnpm sprites KIND --zoom 6`.

## Non-humanoid kinds (keyed)

- **Rigged** (`--type other`): Tripo names the bones its own way; `pnpm sprites inspect` lists them. Key poses with those names. `_near` / `_far` resolve to names ending `_l` / `_r`, and `near_` / `far_` to names starting `R_` / `L_` (Tripo's biped `--type other` rig: `near_Thigh`); a rig with neither names its limbs outright, one key per facing if it's asymmetric. Presets for other rigs are few (`walk` for quadrupeds) and prompt motions aren't available, so every clip but walk is keyed.
- **Limbless** (the dot-eater, the jelly): no model or rig at all. Generate the frames as `page/ball.ts` does the spin ball: a shape in the roster's colours, its motion (a chomp, a bob) as frames, marks for speed. One generator per kind in `page/`, `"ball"`-style clips in `sprite.json`.

## Done

[CHECKLIST.md](CHECKLIST.md) has the run sheet and the done list. In short: the nod reads in colour at play scale, the twist on the lobby cards; fresh readers name it from the blind silhouette sheet; `tests/sprite-cast.test.ts` passes (it loads every kind registered in `LOADERS`); the cached draw cost is a few hundredths of a ms per runner; `pnpm check` and `pnpm build` pass.

## How it draws

- **Camera.** Orthographic, side on, the figure turned `yaw` degrees toward the camera and looked down on by `pitch`. Both facings are rendered. Every clip runs in place (the hips over the feet); `pin: "hips"` holds them at rest height for the air; `face` turns back a motion that spins the body; `center` centres a figure lying down; a grounded frame's soles sit just above the floor, where the pen lands.
- **Roles.** Each texel goes to its nearest swatch's role (Lab), cleaned by a majority filter; regions split a role by place in the bind pose.
- **Parts.** One pass writes role and depth at `trace.res` px per world px; `trace.ts` cuts parts (one role, no depth step over `step`), folds those under `min` into a neighbour, traces each grown by a pixel, simplifies, rounds and resamples it evenly from a fixed start. A part that only moved since the frame before keeps its line (`steady`), so lines move only with the pen's boil. Accessories render in passes of their own and are tagged with their slot and option.
- **Drawing** (`src/render/cast/sprites/`): `draw.ts` inks a frame (silhouette mass and strokes, parts `toned`, one hard shadow shape, marks, the face from `face.ts`); `index.ts` dresses it for a character (the kind's colour, the rolled swaps) and keeps each drawn frame as a bitmap per character, boil step, mood and scale bucket; `play.ts` picks the clip and frame from the pose.

## Files

| File                               | What it holds                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------- |
| `sprites.ts`                       | The command: serves the page, drives it, writes the frame table and the sheets        |
| `settings.ts`                      | `Settings`, shared by the command and the page                                        |
| `style.ts`                         | The concept, pose-sheet and model-sheet prompts, and each kind's brief                |
| `CHECKLIST.md`                     | One kind's run sheet and done list                                                    |
| `page/render.ts`                   | Loading, caricature, props and swaps, keyed poses, the camera and the role/depth pass |
| `page/trace.ts`                    | Parts, folding, tracing, resampling, steadying, the eyes                              |
| `page/ball.ts`                     | The generated spin ball (the model for limbless kinds)                                |
| `page/roles.ts`, `page/weights.ts` | Texture to roles; weight fixes                                                        |
| `page/inspect.ts`, `page/sheet.ts` | The turnaround; the contact, keys and rolls sheets (drawn by the game's drawer)       |
