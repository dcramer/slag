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

## Word lists

The name filter (`src/core/name-filter/`) reads two published lists, copied verbatim into `words.ts` by
`tools/name-words.ts`. Which entries it uses, and how strictly, is decided in `index.ts`.

| List | Source | License |
|---|---|---|
| List of Dirty, Naughty, Obscene, and Otherwise Bad Words (Shutterstock and contributors), English (`en`), commit `5faf2ba`; unmodified, the filter leaves two entries out | https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |
| profanity-list, English (`en.json`, without its ids), commit `c279243` | https://github.com/dsojevic/profanity-list | MIT, Copyright (c) 2021 David Sojevic |

## Brand marks

The icon mark (`app/icon.svg`, drawn by hand as paths, no font) and every file made from it
(`app/favicon.ico`, `app/apple-icon.png`, `public/icons/*.png`) are original. `pnpm brand` regenerates
them and the preview cards.

## Generated art

Images and models made with Tripo (tripo3d.ai) on the owner's paid plan are ours to ship: no attribution or
license condition applies. Keep each one's prompt beside it, under `art/`.

## Rendered kinds (`?sprites=1` only)

The plumber's and the speedster's frames (`src/render/cast/sprites/<kind>/frames.ts`: traced outlines, no images) are
made by our own code (`tools/art3d`) from 3D models generated for us with Tripo Studio, on the owner's paid subscription,
and drawn by the game's own pen. The models, and the concept, model and pose sheets they were made from, are kept as
source art in `art/sprites/<kind>/`. The game ships only the traced frames; it ships no model or image, and the flag-off
game loads none of it.

| Asset | Made with | Source | License |
|---|---|---|---|
| `art/sprites/<kind>/concept.png`, `poses.png`, `tpose.png`, `view-*.jpeg` | Tripo Studio image generation (`nano-banana-2`, the app's default image model) and Tripo's multi-view, from our prompts (`*.prompt.txt`) | https://studio.tripo3d.ai | Generated art, above: ours to ship |
| `art/sprites/<kind>/model.glb` | Tripo Studio image-to-3D (`h3.1`), auto-rig (Unreal skeleton), preset and generated animations | https://studio.tripo3d.ai, projects `555485dc-b205-42f1-84dc-18bd55b5b531` (plumber), `6f61cc17-5f3e-4594-9853-50d505cf2e7b` (speedster), both private | as above |
| `src/render/cast/sprites/<kind>/frames.ts` | Traced by `tools/art3d` from `model.glb` | this repository | ours |

Three.js (MIT, https://github.com/mrdoob/three.js) renders them; it is a devDependency of the tool and is not in the game.
