# Mobile & touch

slag is fully playable on phones and tablets. Touch is one more input device (`'touch'`) next to the keyboard (`kb1`/`kb2`) and gamepads (`pad0…`). It only ever produces `InputFrame`s (plus a view-space `pointer`, like the mouse does), so determinism and netcode are unaffected.

| File | Role |
|---|---|
| `src/input/touch.ts` | `TouchInput`: DOM-free touch → `InputFrame` state machine, the shared `touchLayout()` geometry, and `touchModeFor()` (phase → what touches mean). Unit tested in `tests/touch.test.ts`. |
| `src/ui/touch/overlay.ts` | `TouchOverlay`: the on-screen controls (DOM, `pointer-events:none`), the portrait prompt, the fullscreen and menu buttons, and the page-gesture hardening. |
| `src/ui/touch/device.ts` | Render quality tiers, adaptive resolution (`FrameBudget`), safe-area insets, and touch-first detection. |
| `src/input/input.ts` | Owns `input.touch`. Touch pointers skip the mouse path. `pointerDevice` is `'touch'` while touch is the latest input. |
| `src/game-client.ts` | Sets the touch mode every sim step, updates the overlay every frame, routes HUD buttons to `pointerDevice`, and buzzes when the touch player dies. |
| `src/render/renderer.ts` | Applies the quality tier (internal width and DPR cap), downgrades adaptively, and fits the canvas inside the safe area. |
| `app/r/[room]/page.tsx`, `app/layout.tsx` | Viewport (no zoom, `viewport-fit=cover`, theme colour) on the game route only, and iOS home-screen web-app meta. |

## When controls show

- They show from the start on touch-first devices (`(pointer: coarse)` and `maxTouchPoints > 0`).
- They also show as soon as anything touches the screen.
- They hide when a bound game key is pressed, when the mouse moves, or when a gamepad button or stick is used.
- They come back on the next touch. Tablets with keyboards or pads switch back and forth this way.
- There is one touch player per screen. Local multiplayer on one phone isn't a goal, but touch plus pads works on tablets.

## Control scheme

### Race (landscape)

```
 ┌──────────────────────────────────────────────────────────┐
 │                                                      (⚙) │
 │                                                          │
 │   any touch on the left half               (💥 HOLD)      │
 │   = floating stick                                       │
 │     ( ◯ )   ← push 70%+ = RUN                 ( JUMP )    │
 └──────────────────────────────────────────────────────────┘
```

**Left thumb: floating, follow-anchored, digital stick.**

- The stick's centre is wherever your thumb lands in the left half of the screen.
- Past the rim, the anchor is dragged along with your thumb. Reversing direction is always about one dead zone of travel, however far you've pushed.
- The output is digital: left/right past a 22 % dead zone. Down/up count only past 50 % *and* steeper than ~27°, so thumb sag while running doesn't trigger a fast-fall.

**RUN = push past 70 %.** RUN is not a separate button. Walk is the inner ring and run is the outer ring; the knob glows when you're running. This leaves the right thumb only one job, JUMP. That job is timing-critical: variable jump height and wall jumps depend on it.

A dedicated RUN button would need a third simultaneous touch (stick + run + jump), or would share the right thumb with jump. Both are bad for precision. A 70 % threshold on the stick is the phone version of a gamepad's "tilt far to sprint", and it composes cleanly with down for drop and fast-fall.

**Why not left/right pads?**

- Fixed pads have no feel for walk vs run.
- On glass you can't feel where they are, so you drift off them. A floating stick re-centres to wherever you put your thumb.
- Because the output is digital, it keeps the exact feel of the keyboard controller. There's no analog wobble.

**Right thumb: JUMP.**

- The *whole right half* is JUMP, apart from the ALT and menu buttons. You can't miss it.
- Hold duration = jump hold, so you get variable height. Each new touch is a fresh `jumpPressed`, so wall jumps are just re-taps.
- A tap shorter than one sim frame still registers. Presses are latched like key presses.

**Drop-through** = pull the stick down, then tap JUMP (down + jump, exactly like the keyboard). There's deliberately no one-tap DROP button. Down + jump on solid ground is a normal jump, and a button that guessed the ground under you would need sim state.

**ALT (💥) = self-destruct, hold ~0.35 s.** A ring fills while you hold. An accidental brush must never kill you. Releasing early cancels.

**Each touch keeps its role** from the moment it lands. A jump thumb sliding left never steers. Only one stick thumb counts.

### Other phases

| Phase | Touch |
|---|---|
| Lobby | Tap the HUD buttons: a join slot (joins as `touch`), *Ready up*, *new look*, your name, *new level*, Settings, Level settings. Taps that just miss a small pill retry within ±9 view px. A fullscreen button shows top-left where supported. |
| Pick | Touch-down snaps your cursor to the finger, so the card lifts. Lifting over a card claims it, either by tapping or by sliding to choose. |
| Place | Drag anywhere. The ghost floats a fingertip (56 CSS px) above your finger. The offset fades near the bottom edge so the lowest rows stay reachable. **⟳ ROTATE** taps rotate. **PLACE** places only when the finger lifts *on* it, so sliding off cancels. Lifting a drag never places. PLACE dims red while the spot is illegal. The same two button positions are JUMP and ALT in the race. |
| Score / victory | Tap anywhere to continue. |
| Any time | ⚙ (top right) opens Settings. This is the Esc equivalent and shows outside the lobby, which has its own settings button. |

### Haptics

`navigator.vibrate` gives a subtle tick on each event (Android only; iOS has no web vibration API):

| Event | Duration |
|---|---|
| Jump | 8 ms |
| Rotate | 6 ms |
| Place | 15 ms |
| HUD tap | 8 ms |
| Self-destruct | 40 ms |
| Death | 30 ms |

`input.touch.haptics = false` turns them off. There's no settings UI for it yet.

## Layout

- **Landscape first.** Controls scale with the short side. On an iPhone 13 the JUMP button is about 117 px across and ALT is at least 56 px; both clamp on tablets.
- **Safe areas.**
  - The game route uses `viewport-fit=cover`.
  - The renderer fits the canvas inside the left/right/top insets (notch, status bar).
  - The bottom home-indicator strip may overlap the picture, but the controls keep clear of it.
  - Insets are read with an `env(safe-area-inset-*)` probe element.
- **Portrait.**
  - On phones (short side < 600 px) a "Turn it sideways" card shows, with a "play in portrait anyway" escape. The controls still work in portrait; the game is just small.
  - Tablets in portrait play directly. The canvas spans the width and the controls sit in the space below it.
- **Gestures blocked over the game:**
  - `touch-action:none` and `overscroll-behavior:none`
  - non-passive `touchstart`/`touchmove` `preventDefault` on the game container, for older iOS double-tap zoom and the loupe
  - `gesturestart` and `dblclick` cancelled
  - no user-select, callouts or tap highlight
  - `maximum-scale=1, user-scalable=no` on the game route only, so `/codex` stays zoomable
- DOM menus (`.slag-ov`) and overlay buttons (`[data-slag-ui]`) are excluded from game touch handling. While a menu is open (`input.captured`), touch is reset and ignored.

## Performance knobs

All of these are presentation-only and live in `src/ui/touch/device.ts`.

| Knob | Effect |
|---|---|
| `QUALITY[tier].maxW` | Caps the internal render width. This is the old `MAX_W`. The tiers are high 1920, mid 1280 and low 896. The three Canvas2D layers, the WebGL target and the HUD all scale with it. Bloom buffers are ¼ and ⅛ of it and the light map is ½, so this one knob also scales bloom cost. |
| `QUALITY[tier].dprCap` | Caps devicePixelRatio before `maxW`. The tiers are 4, 2 and 1.5. |
| Auto tier (`pickTier`) | Desktop stays high (unchanged). A touch-first device or short side < 500 px gets mid. If it also has ≤ 4 cores or ≤ 3 GB `deviceMemory`, it gets low. |
| Adaptive (`FrameBudget`) | Mobile tiers only. An average frame time above 22 ms (< ~45 fps) sustained for 2 s drops one tier, with a 3 s cooldown. It never goes back up. Gaps over 250 ms (tab hidden, paused) are ignored. It's disabled under `navigator.webdriver` so screenshots stay deterministic. |
| `?q=low\|mid\|high` or `localStorage['slag.quality']` | Pins a tier and disables adaptive. |
| `renderer.setQuality(tier)` | Runtime switch, for a future settings entry. |

The sim is unaffected: it stays a fixed 60 Hz accumulator, and slow frames run several steps.

## Testing

- `npx vitest run tests/touch.test.ts` covers:
  - layout and safe areas
  - multi-touch run + jump
  - hold-to-jump and sub-frame taps
  - the follow-stick and the down threshold
  - ALT hold
  - role stickiness
  - pick tap
  - place drag offset, bottom fade, and slide-off cancel
  - lobby HUD taps
  - mode-switch reset
  - a determinism check driving a real `Match`
  - quality tiers and `FrameBudget`
- `npm run shot -- mobile [--device "Pixel 7 landscape"]` emulates a phone in Chromium (touch, mobile, DPR) and drives the real game with CDP multi-touch. It covers:
  1. joining via the HUD slot
  2. the name prompt
  3. ready
  4. tapping a crate
  5. dragging, rotating and placing
  6. holding the stick and JUMP at the same time
  7. holding ALT
  8. portrait

  It writes `shots/mobile-<device>-*.png` and logs the touch runner's position before and after input.
