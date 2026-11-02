/**
 * Styles for the DOM screens (main menu, 404, error) and the logo, as one
 * string so a host can inline it in its HTML for a styled first paint. The
 * shell (src/main.ts) adds it to the page if the host didn't. Tokens mirror
 * PAL and FONT in ../style.ts; the rules behind them are in docs/ART.md.
 * Pure data: app/ server code imports it.
 */

/** The two faces (docs/ART.md → Type): Lilita One for display, Barlow for UI. Hosts link it; the shell adds it if they didn't. */
export const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Barlow:wght@500;600;700;800&family=Lilita+One&display=swap';

/** The id of the `<style>` element that carries SCREEN_CSS. */
export const SCREEN_STYLE_ID = 'slag-screens';

export const SCREEN_CSS = `
:root {
  --ink: #120b08;
  --soot: #1a1210;
  --iron: #2b201b;
  --iron-hi: #3d2e26;
  --steel: #6e625a;
  --bone: #f6ead8;
  --ash: #c9b8a3;
  --dim: #9b8a78;
  --molten: #ff6a1f;
  --amber: #ffb02e;
  --white-hot: #fff1b8;
  --ember: #b8230f;
  --toxic: #a6e22e;
  --hazard: #f2b705;
  --display: 'Lilita One', 'Arial Rounded MT Bold', system-ui, sans-serif;
  --ui: Barlow, 'Segoe UI', system-ui, sans-serif;
  --grain: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .32 0'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");
  --tape: repeating-linear-gradient(-45deg, var(--hazard) 0 10px, #17110c 10px 20px);
  /* The main menu's backdrop: grain, the pour's glow from below, a warm corner and the dark. Every screen stands on it. */
  --forge:
    var(--grain), radial-gradient(120% 60% at 70% 115%, rgba(255, 90, 20, 0.55), rgba(184, 35, 15, 0.18) 45%, transparent 70%),
    radial-gradient(80% 60% at 10% -10%, #3a241a, transparent 70%), linear-gradient(#1a100c, #0e0806 60%);
  color-scheme: dark;
}

html,
body {
  margin: 0;
  background: #0e0806;
  color: var(--bone);
  font: 500 16px/1.4 var(--ui);
}

/* ------------------------------------------------------------ home */

.home {
  position: relative;
  min-height: 100dvh;
  overflow-x: clip;
  display: grid;
  grid-template-rows: 1fr auto;
  isolation: isolate;
  background: var(--forge);
}

/* Slow heat shimmer from the bottom glow. */
.home::before,
.forge-bg::before {
  content: '';
  position: absolute;
  inset: auto -10% -20% -10%;
  height: 55%;
  background: radial-gradient(50% 60% at 50% 100%, rgba(255, 140, 40, 0.35), transparent 70%);
  animation: heat 5s ease-in-out infinite alternate;
  z-index: -1;
}

@keyframes heat {
  from {
    opacity: 0.6;
    transform: scaleY(0.92);
  }
  to {
    opacity: 1;
    transform: scaleY(1.05);
  }
}

.embers {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: -1;
}

.embers i {
  position: absolute;
  bottom: -10px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--amber);
  box-shadow: 0 0 6px 2px rgba(255, 120, 30, 0.7);
  animation: rise linear infinite;
  opacity: 0;
}

@keyframes rise {
  0% {
    transform: translate(0, 0);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  100% {
    transform: translate(var(--dx, 20px), -95vh);
    opacity: 0;
  }
}

.home-main {
  display: grid;
  grid-template-columns: minmax(320px, 460px) 1fr;
  grid-template-areas:
    'brand stage'
    'menu stage';
  grid-template-rows: auto 1fr;
  align-content: center;
  column-gap: 40px;
  padding: 32px clamp(20px, 6vw, 88px) 24px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
}

.logo {
  position: relative;
  margin: 0;
  font: 400 clamp(88px, 12vw, 150px) / 0.9 var(--display);
  letter-spacing: 0.01em;
  display: inline-block;
  vertical-align: top;
  filter: drop-shadow(0 0 28px rgba(255, 106, 31, 0.3));
}

/* The inked letters (logo-art.ts), in the box the text took: 2.282em × 0.9em. Ink, shadow and drips hang outside it. */
.logo-art {
  display: block;
  width: 2.282em;
  height: 0.9em;
  overflow: visible;
}

/* The word, for screen readers. */
.logo-t {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* Each drip swings from where it leaves its letter (set per drip, in the logo's own px). */
.logo-drip {
  transform-box: view-box;
  animation: drip 3.2s ease-in-out infinite alternate;
}

@keyframes drip {
  from {
    transform: scaleY(0.55);
  }
  to {
    transform: scaleY(1.15);
  }
}

/* Room under the logo for its drips; the menu sits where it always has. */
.brand {
  grid-area: brand;
  margin-bottom: 55px;
}

.menu-wrap {
  grid-area: menu;
  align-self: start;
}

/* Main menu: big stamped plates, console-style selection. */
.menu {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.menu-item {
  all: unset;
  box-sizing: border-box;
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  width: 100%;
  min-height: 60px;
  padding: 9px 18px 11px 22px;
  cursor: pointer;
  background: var(--grain), linear-gradient(var(--iron-hi), var(--iron));
  border: 2px solid var(--ink);
  border-radius: 6px;
  box-shadow: 0 5px 0 var(--ink);
  transition:
    transform 0.08s,
    box-shadow 0.08s,
    background 0.12s;
}

.menu-item .t {
  font: 400 30px/1 var(--display);
  color: var(--bone);
  letter-spacing: 0.02em;
  text-shadow: 0 2px 0 var(--ink);
}

.menu-item .s {
  grid-column: 1;
  margin-top: 4px;
  font: 600 14px/1.2 var(--ui);
  color: var(--ash);
}

.menu-item .chev {
  grid-row: 1 / span 2;
  grid-column: 2;
  width: 14px;
  height: 20px;
  background: var(--ink);
  clip-path: polygon(0 0, 100% 50%, 0 100%);
  opacity: 0.35;
  transition: transform 0.12s;
}

.menu-item[data-active='true'] {
  background: var(--grain), linear-gradient(#ff8a2a, #e8571a);
  transform: translateX(8px);
}

.menu-item[data-active='true'] .t {
  color: var(--ink);
  text-shadow: 0 1px 0 rgba(255, 240, 200, 0.45);
}

.menu-item[data-active='true'] .s {
  color: #3a1206;
}

.menu-item[data-active='true'] .chev {
  opacity: 1;
  transform: translateX(4px);
}

/* Selection marker hanging off the left edge. */
.menu-item[data-active='true']::before {
  content: '';
  position: absolute;
  left: -20px;
  top: 50%;
  width: 10px;
  height: 10px;
  margin-top: -5px;
  background: var(--amber);
  border: 2px solid var(--ink);
  transform: rotate(45deg);
}

.menu-item:active {
  transform: translate(8px, 3px);
  box-shadow: 0 2px 0 var(--ink);
}

.menu-item:focus-visible {
  outline: 3px solid var(--amber);
  outline-offset: 3px;
}

/* Join-a-lobby code entry, revealed under its menu item. */
/* Clear of the plate's drop above, with room for the focus ring all round. */
.join {
  display: flex;
  gap: 10px;
  margin: 12px 0 4px 8px;
  align-items: stretch;
}

.join input {
  flex: 1;
  min-width: 0;
  font: 400 30px/1 var(--display);
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--amber);
  background: var(--soot);
  border: 2px solid var(--ink);
  box-shadow: inset 0 3px 0 rgba(0, 0, 0, 0.45);
  border-radius: 6px;
  padding: 8px 14px;
  outline: none;
}

.join input::placeholder {
  color: #5a4a3e;
}

.join input:focus {
  border-color: var(--molten);
}

.join input:focus-visible {
  outline: 3px solid var(--amber);
  outline-offset: 2px;
}

.join button {
  all: unset;
  cursor: pointer;
  font: 400 24px/1 var(--display);
  color: var(--ink);
  padding: 0 22px;
  background: linear-gradient(#ff8a2a, #e8571a);
  border: 2px solid var(--ink);
  border-radius: 6px;
  box-shadow: 0 4px 0 var(--ink);
}

.join button:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 var(--ink);
}

.join button:focus-visible {
  outline: 3px solid var(--amber);
  outline-offset: 2px;
}

.join-err {
  margin: 0 0 4px 10px;
  font: 700 14px var(--ui);
  color: #ff8a7a;
}

/* Crowd stage on the right. */
.stage {
  grid-area: stage;
  position: relative;
  align-self: stretch;
  min-height: 360px;
}

.stage canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Footer prompt bar, like the in-game one. */
.footbar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  min-height: 44px;
  padding: 0 clamp(16px, 4vw, 40px);
  background: rgba(16, 9, 6, 0.9);
  border-top: 2px solid var(--ink);
}

.footbar::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: -6px;
  height: 4px;
  background: var(--tape);
  opacity: 0.85;
}

/* Context on the left of the footer, prompts on the right. */
.footbar .meta {
  margin-right: auto;
  font: 700 13px var(--ui);
  color: var(--dim);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 20px;
  justify-content: flex-end;
  font: 700 15px var(--ui);
  color: var(--bone);
}

.prompt {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.slag-glyph {
  display: inline-block;
  vertical-align: middle;
  flex: none;
}

@media (max-width: 860px) {
  .home-main {
    grid-template-columns: 1fr;
    grid-template-areas: 'brand' 'stage' 'menu';
    grid-template-rows: auto auto auto;
    align-content: start;
    padding-top: 28px;
  }
  .brand {
    text-align: center;
  }
  .brand {
    margin-bottom: 44px;
  }
  .stage {
    min-height: 180px;
    margin: 0 -16px;
  }
  .menu-item[data-active='true'] {
    transform: none;
  }
  .menu-item[data-active='true']::before {
    display: none;
  }
}

@media (pointer: coarse) {
  .footbar {
    display: none;
  }
}

/* A narrow window keeps the footer for its prompts. */
@media (max-width: 520px) {
  .home .footbar .meta {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .embers,
  .home::before,
  .forge-bg::before {
    display: none;
  }
  .logo-drip {
    animation: none;
  }
}

/* ------------------------------------------------------------ shared by every other screen */

/* The menu's backdrop, pinned to the window. Its screen isolates, so this sits over the page's own dark and under everything else. */
.forge-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
  background: var(--forge);
}

/* The logo built at the menu's full size and scaled as a whole, like the lobby's. */
.logo-k {
  --k: 0.6;
  position: relative;
  width: calc(352px * var(--k));
  height: calc(150px * var(--k));
  flex: none;
}

.logo-k .logo {
  position: absolute;
  left: 0;
  top: 0;
  font-size: 150px;
  transform: scale(var(--k));
  transform-origin: 0 0;
}

/* A footer prompt that does what it says when clicked. */
button.prompt {
  all: unset;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  font: 700 15px var(--ui);
  color: var(--bone);
}

button.prompt:hover {
  color: var(--amber);
}

button.prompt:focus-visible {
  outline: 2px solid var(--amber);
  outline-offset: 3px;
}

/* ------------------------------------------------------------ 404 and error */

.plain {
  position: relative;
  min-height: 100dvh;
  display: grid;
  grid-template-rows: 1fr auto;
  isolation: isolate;
  overflow: clip;
}

.plain-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 34px;
  padding: 40px 20px clamp(120px, 24vh, 220px);
}

.plain-main .logo-k {
  --k: 0.72;
}

/* A riveted iron plate with hazard tape along its top, like the overlays. */
.plain-card {
  position: relative;
  box-sizing: border-box;
  width: min(560px, 100%);
  padding: 34px 34px 30px;
  background: var(--grain), linear-gradient(var(--iron-hi), var(--iron));
  border: 2px solid var(--ink);
  border-radius: 6px;
  box-shadow: 0 6px 0 var(--ink);
}

.plain-card::before {
  content: '';
  position: absolute;
  left: -2px;
  right: -2px;
  top: -2px;
  height: 10px;
  background: var(--tape);
  border: 2px solid var(--ink);
  border-radius: 6px 6px 0 0;
}

/* Rivets in the four corners. */
.plain-card::after {
  content: '';
  position: absolute;
  inset: 16px 10px 10px;
  pointer-events: none;
  background:
    radial-gradient(circle at 3px 3px, var(--steel) 1.6px, var(--ink) 2.4px, transparent 3px) 0 0 / 6px 6px no-repeat,
    radial-gradient(circle at 3px 3px, var(--steel) 1.6px, var(--ink) 2.4px, transparent 3px) 100% 0 / 6px 6px no-repeat,
    radial-gradient(circle at 3px 3px, var(--steel) 1.6px, var(--ink) 2.4px, transparent 3px) 0 100% / 6px 6px no-repeat,
    radial-gradient(circle at 3px 3px, var(--steel) 1.6px, var(--ink) 2.4px, transparent 3px) 100% 100% / 6px 6px no-repeat;
}

.plain-card h1 {
  margin: 0 0 12px;
  font: 400 clamp(34px, 5vw, 46px) / 1 var(--display);
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--bone);
  text-shadow: 0 3px 0 var(--ink);
}

.plain-card p {
  margin: 0 0 26px;
  font: 600 17px/1.45 var(--ui);
  color: var(--ash);
}

.plain-card .menu-item {
  width: calc(100% - 8px);
}

/* The pool along the bottom, and what's sinking in it. */
.plain-pool {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: clamp(110px, 19vh, 180px);
  z-index: -1;
  pointer-events: none;
}

.pool-surf {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 46px;
  z-index: 1;
  overflow: visible;
}

.pool-body {
  position: absolute;
  inset: 40px 0 0;
  z-index: 1;
  background:
    var(--grain), radial-gradient(18% 9px at 22% 30%, rgba(120, 30, 8, 0.45), transparent), radial-gradient(14% 7px at 64% 55%, rgba(120, 30, 8, 0.4), transparent),
    radial-gradient(10% 6px at 86% 22%, rgba(120, 30, 8, 0.4), transparent), linear-gradient(#f25e1c, var(--ember) 55%, #4a1006);
  box-shadow: 0 -10px 60px rgba(255, 106, 31, 0.45);
}

.sinker {
  position: absolute;
  bottom: calc(100% - 52px);
  z-index: 0;
  transform-origin: 50% 100%;
  animation: sink 7s ease-in-out infinite alternate;
}

@keyframes sink {
  from {
    translate: 0 6px;
  }
  to {
    translate: 0 -4px;
  }
}

/* 404: big cooled-iron numerals, glowing where the pool has them. */
.sinker-num {
  right: 5vw;
  rotate: -9deg;
  font: 400 clamp(120px, 18vw, 240px) / 0.8 var(--display);
  color: transparent;
  background: linear-gradient(var(--iron-hi) 30%, #6b3a22 62%, var(--molten) 88%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-stroke: 0.035em var(--ink);
  paint-order: stroke fill;
}

/* Error: a part's crate going under, tape and all. */
.sinker-crate {
  left: 9vw;
  width: clamp(110px, 15vw, 180px);
  aspect-ratio: 1;
  rotate: 14deg;
  box-sizing: border-box;
  background: var(--grain), linear-gradient(var(--iron-hi), var(--iron) 60%, #7a2c12);
  border: 5px solid var(--ink);
  border-radius: 8px;
  box-shadow: inset 0 0 0 5px rgba(255, 255, 255, 0.04);
}

.sinker-crate i {
  position: absolute;
  left: -5px;
  right: -5px;
  top: 30%;
  height: 22%;
  background: var(--tape);
  border-block: 5px solid var(--ink);
}

@media (max-width: 860px) {
  .plain-main {
    gap: 26px;
    padding-top: 32px;
  }
  .plain-main .logo-k {
    --k: 0.56;
  }
  .plain-card {
    padding: 30px 22px 24px;
  }
  .sinker-num {
    right: auto;
    left: 50%;
    margin-left: -0.9em;
  }
  .sinker-crate {
    left: 50%;
    margin-left: -60px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sinker {
    animation: none;
  }
}

/* ------------------------------------------------------------ the logo over the lobby HUD */

/* The home logo at its full size, scaled into the HUD's slot, so the two can't drift apart. */
.slag-logo-float {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 1;
  pointer-events: none;
  transform-origin: 50% 50%;
}

.slag-logo-float .logo {
  font-size: 150px;
}
`;
