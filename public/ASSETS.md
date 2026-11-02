# Third-party assets

No third-party art or sound. Everything slag draws is made in code: terrain, parts, characters, backdrops and sound. If that
changes, record each asset here with its source URL and license (see "Conventions" in `AGENTS.md`).

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
