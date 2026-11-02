# Third-party assets

No third-party art or sound. Everything slag draws is made in code: terrain, parts, characters, backdrops and sound, with
one exception behind a flag, the rendered kinds below. Record each asset here with its source URL and license (see
"Conventions" in `AGENTS.md`).

## Fonts

Loaded from Google Fonts by `app/layout.tsx`, not bundled. Both are under the
[SIL Open Font License 1.1](https://openfontlicense.org): free for commercial use, no attribution required.

| Font | Use | Source | License |
|---|---|---|---|
| Lilita One (Juan Montoreano) | display: logo, titles, menu items | https://fonts.google.com/specimen/Lilita+One | OFL 1.1 |
| Barlow (Jeremy Tribby) | UI text | https://fonts.google.com/specimen/Barlow | OFL 1.1 |

The link-preview cards (`app/opengraph-image.jpg`, `app/r/[room]/opengraph-image.jpg`) contain text
rendered in both. The OFL governs the font software, not images made with it, so they carry no conditions.

## Brand marks

The icon mark (`app/icon.svg`, drawn by hand as paths, no font) and every file made from it
(`app/favicon.ico`, `app/apple-icon.png`, `public/icons/*.png`) are original. `pnpm brand` regenerates
them and the preview cards.

## Generated art

Images and models made with Tripo (tripo3d.ai) on the owner's paid plan are ours to ship: no attribution or
license condition applies. Keep each one's prompt beside it, under `art/`.

## Rendered kinds (`?sprites=1` only)

The plumber's and the speedster's sprite atlases (`src/render/cast/sprites/<kind>/*.png`) are rendered by our own code
(`tools/art3d`) from 3D models generated for us with Tripo Studio, on the owner's paid subscription. The models, and the
concept and model-sheet images they were made from, are kept as source art in `art/sprites/<kind>/`. The game ships only
the rendered atlases; it ships no model, and the flag-off game loads none of this.

| Asset | Made with | Source | License |
|---|---|---|---|
| `art/sprites/<kind>/concept.png`, `tpose.png`, `view-*.jpeg` | Tripo Studio image generation (`nano-banana-2`, the app's default image model) and Tripo's multi-view, from our prompts (`*.prompt.txt`) | https://studio.tripo3d.ai | Generated art, below: ours to ship |
| `art/sprites/<kind>/model.glb` | Tripo Studio image-to-3D (`h3.1`), auto-rig (Unreal skeleton), preset and generated animations | https://studio.tripo3d.ai, projects `d2d477f0-58bf-48c4-aaa0-296daaff9f5d` (plumber), `6f61cc17-5f3e-4594-9853-50d505cf2e7b` (speedster), both private | as above |
| `src/render/cast/sprites/<kind>/*.png` | Rendered by `tools/art3d` from `model.glb` | this repository | ours |

Three.js (MIT, https://github.com/mrdoob/three.js) renders them; it is a devDependency of the tool and is not in the game.
