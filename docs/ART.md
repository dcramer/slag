# SLAG UI art direction

These rules cover the menus, the lobby, and the in-game HUD. The world art (levels, props, characters) is hand-inked in code: see [World art](#world-art-ink) at the end. What each item and part mocks, with its silhouette and visual gag, is in [PARODY.md](PARODY.md).

## The bar: the main menu

**The main menu is the quality bar for every screen.** The owner loves it: the molten drip logo, the rising embers and heat shimmer, the crowd on the slag heap under the pour, and that it fills the window's full height. Keep its look exactly, and bring every other screen up to it, never the other way round.

- **One logo.** It's `logoHTML()` in `src/ui/screens/markup.ts`: an inked SVG (`src/ui/screens/logo-art.ts`) built from the display face's own letter outlines, so it needs no web font. It has a hard offset shadow, an ink mass heavy away from the light, molten fill cut into three cel bands, pen lines that swell and lift round every edge, drips, and a white-hot highlight per letter. The menu's stage behind the crowd (`src/ui/home-scene.ts`) is inked like the world: a low mound of cinder and clinker with runs of cooled slag, a crucible on a crane, the pour, and its pool. The icons are the same inked S (`markSVG`, rendered by `pnpm brand`). The lobby shows that same element over its top bar, scaled as a whole (`FloatingLogo`), so treatment, proportions and crispness can't drift. Don't draw a second logo on a canvas.
- **No tagline.** Nothing sits under the logo; `1–8 Players` stands at the footer's left. What a shared link says is one plain description with a little personality and no jargon (`DESCRIPTION` in `app/site.ts`).
- **One backdrop.** The codex, 404 and error screens stand on the menu's own dark, glow, heat shimmer and embers (`forgeHTML()`, `--forge`), show the same logo scaled as a whole (`scaledLogoHTML()`), and use the menu's plates, selection and footer bar.
- **One settings menu** (`SettingsMenu` in `src/ui/menus/settings.ts`), the same over the main menu and in a game.
- Every screen is a game screen with the game's input: keyboard, gamepad and touch, the console-style selection below, and a footer prompt bar.

## Identity: a molten foundry that doubles as a toy box

SLAG is junk melted down and recast. The UI looks like **cast-iron plates, hazard tape, and molten metal**. It feels chunky and handled, like a toy: hard outlines, hard drop shadows, buttons that physically press down. It should never read as a generic dark dashboard.

- **Do** use riveted iron plates (`plate()` in `src/render/hud-kit.ts`, `.slag-card` / `.menu-item` in CSS), small corner radii (4–6 px), a 1–2 px ink outline, and a hard drop shadow offset straight down.
- **Do** use molten light (amber → orange → ember gradients, additive glow, rising embers) for heat and focus. Glow belongs to *hot* things only: the logo, the pour, the selected item, sparks.
- **Do** use hazard tape (`hazardTape()`, `--tape`) as an edge accent on bars and dialogs, and to mark empty or dangerous zones.
- **Do** add texture: the speckle grain on plates and the SVG noise on pages.
- **Don't** use translucent purple/blue glass cards, big blurry glows around boxes, large rounded corners, or soft drop shadows. That's the "AI slop" look we're avoiding.
- **Don't** let decoration compete with information. Motion (embers, drips, scrolling tape, button sink) is slow and ambient, and stops under `prefers-reduced-motion`.

## Palette

The canonical palette is `PAL` in `src/ui/style.ts`. `src/ui/screens/css.ts` mirrors it as CSS variables.

| Token | Hex | Use |
|---|---|---|
| `ink` | `#120b08` | outlines, hard shadows, text on bright fills |
| `soot` | `#1a1210` | recessed surfaces: empty slots, inputs, slider tracks |
| `iron` / `ironHi` | `#2b201b` / `#3d2e26` | plates, secondary buttons |
| `steel` | `#6e625a` | rivets, dividers |
| `bone` | `#f6ead8` | primary text |
| `ash` | `#c9b8a3` | secondary text (≥ 7:1 on iron) |
| `dim` | `#9b8a78` | tertiary text and empty states only, never below the caption size |
| `molten` / `amber` / `whiteHot` / `ember` | `#ff6a1f` / `#ffb02e` / `#fff1b8` / `#b8230f` | primary actions, selection, heat |
| `toxic` | `#a6e22e` | ready, success, online |
| `danger` | `#ff4a3d` | urgent timers, deaths |
| `hazard` | `#f2b705` | hazard tape, theme tags |

Player colors come from the characters and are used for accents only: card top strips, cursors, bars. Role colors (Build, Hazard, Utility, Demolish) live in `src/render/hud/pick-place.ts`.

## Type

There are two faces, both loaded from `FONTS_HREF` in `src/ui/screens/css.ts`:

- **Display: Lilita One.** Use it for titles, phase headings, menu items, player names, and big numbers (timers, scores). It always gets an ink outline or ink shadow.
- **UI: Barlow** (500/600/700/800). Use it for everything else: labels, prompts, tags, notes. Use weight 600–700 for most text and 800 for small uppercase tags.

The HUD scale is `TYPE` in `style.ts`, in logical px on the 768×432 view, so multiply by about 1.67 for 720p:

- caption 8, which is **the minimum**; nothing is drawn smaller
- body 9.5
- label 11
- head 16
- title 30
- hero 56

On pages, body text is 15–18 px and menu items are 30 px display.

### Casing

- **UPPERCASE**: display headings and short stamped tags (`ROUND 2/15`, `PLACE YOUR PART`, `OPEN`, `READY`, `BUILD`, `LOBBY`, main-menu items).
- **Title Case**: buttons, prompt labels, settings labels, subtitles (`Ready Up`, `New Look`, `Self-Destruct`, `Choose a Part`, `Mute All Sound`).
- **Sentence case**, with a period: the rare note that says something the screen can't (`Select a slot, then press the new key.`).
- **Never** use lowercase taglines or microcopy (`pick your poison`, `confirm to continue`). There are no slogans in the UI.
- **Never explain the obvious.** No sub lines, hints or notes that restate what's on screen or spell out a rule. See `docs/DESIGN.md` → Discovery.

## Input prompts

**Never spell out an input in prose** ("click", "press Space", "A = jump"). Show a glyph followed by the action:

```
[Enter] Ⓐ  Ready Up      [R] Ⓑ  New Look      [Esc]  Settings
```

- The glyphs live in `src/ui/glyphs.ts`. `drawGlyph` draws on canvas and `glyphSVG` returns an inline-SVG string for the DOM and server pages. There are keycaps (bone cap, ink label), Xbox-layout face buttons (A green, B red, X blue, Y yellow), shoulder and trigger buttons, a stick, a d-pad, mouse buttons (the lit button is molten), and a touch tap.
- Which glyph goes with which action is decided in `src/ui/prompts.ts`. Key labels always come from the **live bindings** (`InputManager.settings` → `capLabel`), so remaps show up immediately.
- Show the active input family first: the one used last (`InputModeTracker`) or the one forced by `hud.inputMode`. Add the other family only if it's present (a pad is connected or joined). Touch shows touch glyphs only.
- Every phase has a **footer prompt bar** at the bottom: ink bar, a hazard-tape top edge, prompts right-aligned, context on the left (`2/4 Ready`, `LOBBY K7QX2`). In-game screens never put prompts anywhere else. Footer prompts that map to a HUD action can be clicked or tapped.
- During races the footer shows Jump, Run, and Self-Destruct through the countdown, then fades to a quiet Self-Destruct hint. While a local player holds an item a Use prompt joins them, labelled with that item's verb (`Swing`, `Throw`). In touch mode it's hidden, because the on-screen controls carry the labels. The same goes for Place's prompts on phones.

## Layout and interaction

- Touch and click targets are at least 22 logical px on the HUD and 44 CSS px on pages and on phones. Empty lobby slots are whole-card targets.
- On phones the HUD grows by groups, each about its own anchor, up to about 1.8×: chips, timers, headings, crate cards, the score panel. A logical px is only ~0.75 CSS px there, so the type scale above would otherwise land below a readable size. The lobby's top-bar buttons become icons, and its footer loses the prompts the cards already carry. Hit rects grow to 44 CSS px even where the art doesn't.
- Selection works like a console menu: one item is always active, shown with a molten fill, a diamond marker, a chevron, and a slight nudge. Mouse hover, keyboard arrows, the d-pad, and the stick all move the same selection.
- Buttons are stamped: a top face over a darker side that sinks 1.5–3 px on hover or press. Primary buttons are molten with ink text, secondary are iron with bone text, and confirmed buttons are toxic.
- Overlays (`src/ui/menus/`) are a single iron card with a hazard-tape top edge over a dark scrim. They have no blur and no glass.
- Settings tabs are stamped plates in display type, with the active one molten and pressed in. Rows use the console selection above: the row holding the selected control fills molten, gets the diamond and nudges. Tab prompts flank the strip and Done carries its back prompt.

## World art: ink

Everything in the world is drawn the way a person inks a comic: flat tones, hard shadow shapes and a pen. There are no gradients and no textures, and all of it is made in code. It's judged at gameplay scale, where 1 world px is about 2.5 screen px at 1080p.

**The line.** Draw with `stroke()` and `line()` from `src/render/ink.ts`: a filled ribbon that swells, tapers and lifts off the page.

- Contours run 1 to 3 world px: thin on the side facing the light (upper left), heaviest away from it.
- A long edge is many strokes, not one. Lift the pen, and leave some joints undrawn: the gaps are what make it look drawn and not stamped.
- Lines are a dark of what they outline, not one black. The cel pass does this for silhouettes, and adds the same wobble and lean to anything without strokes of its own.

**Tone.** Two or three flat tones per surface, cut as shapes with a hand's edge (`blob`, or a block's own bowed sides). Color comes from the theme (`base`, `dark`, `light`, `outline`), so art recolors with the seed.

**Marks.** What a surface is made of is said with marks: chisel ticks, grain, rivets, cracks, pebbles. Add them through a registry: `INK_MATERIALS`, `INK_CAPS`, `INK_PLATFORMS`. Marks are sparse. If it reads as noise at gameplay scale, there are too many.

**Hatching.** Parallel tapered strokes that hang off edges facing away from the light and fade into the fill. Use them on terrain and anything bigger than about two tiles. Hatching vanishes at character size: small things get silhouette and one hard shadow shape instead.

**Objects, not characters.** No part, item, projectile or set piece has a face or a persona: no eyes or pupils, mouths, brows, blush or expressions, no little feet or hands that make it a creature, no cap or hat worn like a character. Only the runners have faces. A lens or a sensor is fine when it reads as optics (a glass disc in a bezel, a lit LED), never an eye with a pupil and lids, and never two side by side. The parody comes through shape, material and mechanism, and a tell that would have been eyes is a mechanism: a sensor light, a creak, grit trickling off.

**Fair play.** The art must not lie about the hitbox. The drawn fill stays within `EDGE_DRIFT` (1.25 px) of the collision shape and floors within `FLOOR_DRIFT` (0.5 px). A corner on a plain rect rounds by at most 3 px; anything rounder (a pipe's rolled rim) is fine when its solids step to follow the curve within about a pixel, and the art draws the same curve the sim steps (`pipeHalfWidth` is the example). Only thin things may hang past that (grass, vines, ink lines, a brace), and thin is what makes them read as decoration. Anything that looks solid is solid.

**The backdrop.** Sky, sun, clouds and skylines follow the same rules, turned down so the play layer pops (`src/render/skyline-ink.ts`). The sky is flat bands with a hand's edge between them; the sun a flat disc in hard flat rings; clouds cut cel shapes with a light pen along their crests. A skyline's pen thins with its depth (`penW`), its ink is a dark of its own color, and its haze is one flat veil over all of it: depth comes from haze, line weight and fewer marks, never blur. Lit windows come in runs along a floor, not as a field of dots, and a busy theme (a city at night) keeps its far layers pure silhouette. The liquid pool is flat bands under one unbroken hand-cut surface line with a pen beneath it, and glints are hard slivers; only fire (lava, slag) glows.

**Banned.** `ctx.stroke()` for an outline; gradients as shading; soft glows on things that aren't hot; photo or painted textures; anything that traces a rectangle with an even line; `Math.random` in a mark, because marks must land in the same place every time.
