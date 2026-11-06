# Third-party assets

No third-party art. Everything slag draws is made in code: terrain, parts, characters, backdrops and sound effects, with
one exception behind a flag, the rendered kinds below. The music's acoustic instruments are recordings (Music samples, below). Record each asset here with its source URL and license (see
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
| `art/sprites/junior/reference.png` | Junior, Sentry's robot character, the reference the `junior` kind is drawn from (source art, not shipped) | https://junior.sentry.dev/junior-character.png | Sentry's own character, used at the owner's request (2026-11-06); the owner works there |

Three.js (MIT, https://github.com/mrdoob/three.js) renders them; it is a devDependency of the tool and is not in the game.

## Music samples

The music's recorded instruments in `public/samples/`, built by `pnpm samples` (`tools/samples.ts`, which lists every source file): a few notes per instrument, trimmed, peak-normalized and encoded as mono MP3. Synth parts stay synthesized, and every instrument falls back to its synth patch until its samples load.

| Library | Sets | Source | License |
|---|---|---|---|
| Versilian Community Sample Library (Versilian Studios), commit `c1ea7bc` | harmonica (harmonica), recorder (tin whistle), altrecorder (recorder), ocarina (ocarina), harpsichord (harpsichord), organ (pipe organ), organpedal (organ pedals), strumstick (banjo (no CC0 banjo exists; the strumstick is a twangy fretted dulcimer)), folkharp (lute and harp), marimba (marimba), kalimba (kalimba), glock (celesta and music box), vibes (bells), chimes (tubular bells), fmpiano (electric piano), sax (tenor saxophone), framedrum (bodhrán), conga (conga), bongo (bongo), tambourine (tambourine), anvil (anvil), shaker (shaker), clap (claps), bassdrum (bass drum and taiko), snare (snare), sidestick (rim), hihat (hi-hat), tom (tom), brakedrum (pickaxe clank), slitdrum (talking drum), sleigh (sleigh bells) | https://github.com/sgossner/VCSL | CC0 1.0 |
| Versilian Studios Chamber Orchestra 2, Community Edition, commit `4403009` | violin (fiddle), contrabass (upright and plucked bass), cello (low strings), horn (brass), tuba (tuba), flute (flute) | https://github.com/sgossner/VSCO-2-CE | CC0 1.0 |
| FreePats Button Accordion HN, commit `d70d164` | accordion (accordion) | https://github.com/freepats/button-accordion-HN | CC0 1.0 |
| FreePats Ukulele, commit `86d345f` | ukulele (strummed guitar) | https://github.com/freepats/ukulele1 | CC0 1.0 |
| FreePats Electric Guitar FSBS (clean), commit `192cf0d` | eguitar (twangy electric guitar) | https://github.com/freepats/electric-guitar-FSBS-clean | CC0 1.0 |
| FreePats Electric Guitar FSBS (distorted 1), commit `bbae17f` | dguitar (overdriven power chords) | https://github.com/freepats/electric-guitar-FSBS-dist1 | CC0 1.0 |
| jlearman Steel Drum (sfzinstruments), commit `dc15a36` | steeldrum (steel drum) | https://github.com/sfzinstruments/jlearman.SteelDrum | The Unlicense (public domain) |
