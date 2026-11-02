# SLAG UI art direction

These rules cover the menus, the lobby, and the in-game HUD. The world art (levels, props, characters) has its own procedural rules in `src/render/`.

## Identity: a molten foundry that doubles as a toy box

SLAG is junk melted down and recast. The UI looks like **cast-iron plates, hazard tape, and molten metal**. It feels chunky and handled, like a toy: hard outlines, hard drop shadows, buttons that physically press down. It should never read as a generic dark dashboard.

- **Do** use riveted iron plates (`plate()` in `src/render/hud-kit.ts`, `.slag-card` / `.menu-item` in CSS), small corner radii (4–6 px), a 1–2 px ink outline, and a hard drop shadow offset straight down.
- **Do** use molten light (amber → orange → ember gradients, additive glow, rising embers) for heat and focus. Glow belongs to *hot* things only: the logo, the pour, the selected item, sparks.
- **Do** use hazard tape (`hazardTape()`, `--tape`) as an edge accent on bars and dialogs, and to mark empty or dangerous zones.
- **Do** add texture: the speckle grain on plates and the SVG noise on pages.
- **Don't** use translucent purple/blue glass cards, big blurry glows around boxes, large rounded corners, or soft drop shadows. That's the "AI slop" look we're avoiding.
- **Don't** let decoration compete with information. Motion (embers, drips, scrolling tape, button sink) is slow and ambient, and stops under `prefers-reduced-motion`.

## Palette

The canonical palette is `PAL` in `src/ui/style.ts`. `app/globals.css` mirrors it as CSS variables.

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

Player colors come from the characters and are used for accents only: card top strips, cursors, bars. Role colors (Build, Hazard, Utility, Demolish) live in `hud.ts`.

## Type

There are two faces, both loaded in `app/layout.tsx`:

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

- **UPPERCASE**: display headings and short stamped tags (`ROUND 2`, `PLACE YOUR PART`, `OPEN`, `READY`, `BUILD`, `LOBBY`, main-menu items).
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
- During races the footer shows Jump, Run, and Self-Destruct through the countdown, then fades to a quiet Self-Destruct hint. In touch mode it's hidden, because the on-screen controls carry the labels.

## Layout and interaction

- Touch and click targets are at least 22 logical px on the HUD and 44 CSS px on pages. Empty lobby slots are whole-card targets.
- Selection works like a console menu: one item is always active, shown with a molten fill, a diamond marker, a chevron, and a slight nudge. Mouse hover, keyboard arrows, the d-pad, and the stick all move the same selection.
- Buttons are stamped: a top face over a darker side that sinks 1.5–3 px on hover or press. Primary buttons are molten with ink text, secondary are iron with bone text, and confirmed buttons are toxic.
- Overlays (`src/ui/menus.ts`) are a single iron card with a hazard-tape top edge over a dark scrim. They have no blur and no glass.
