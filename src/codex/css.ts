/**
 * The codex's own styles, added while it's mounted. It stands on the screens'
 * shared CSS (src/ui/screens/css.ts): tokens, the forge backdrop, the logo,
 * the footer bar and the console-style selection. Rules: docs/ART.md.
 */

/** Four rivets, one per corner of a plate. */
const RIVETS = ['6px 6px', 'calc(100% - 6px) 6px', '6px calc(100% - 6px)', 'calc(100% - 6px) calc(100% - 6px)']
  .map((at) => `radial-gradient(circle at ${at}, var(--steel) 1.5px, var(--ink) 2.3px, transparent 2.9px)`)
  .join(', ');

const PLATE = `${RIVETS}, var(--grain), linear-gradient(var(--iron-hi), var(--iron))`;
const MOLTEN = 'var(--grain), linear-gradient(#ff8a2a, #e8571a)';

export const CODEX_CSS = `
.codex {
  position: relative;
  min-height: 100dvh;
  isolation: isolate;
  display: grid;
  grid-template-columns: 292px minmax(0, 1fr);
  align-items: start;
}

/* ------------------------------------------------------------ side: logo, title, sections */

.cx-side {
  position: sticky;
  top: 0;
  z-index: 20;
  box-sizing: border-box;
  height: calc(100dvh - 46px);
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 26px 18px 20px 28px;
  overflow-y: auto;
  scrollbar-width: none;
}

.cx-brand {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.cx-brand .logo-k {
  --k: 0.56;
}

.cx-title {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin: 22px 0 0;
  font: 400 32px/1 var(--display);
  letter-spacing: 0.06em;
  color: var(--bone);
  text-shadow: 0 3px 0 var(--ink);
}

.cx-title::before {
  content: '';
  width: 30px;
  height: 9px;
  background: var(--tape);
  border: 2px solid var(--ink);
}

.cx-back {
  all: unset;
  box-sizing: border-box;
  display: none;
  flex: none;
  place-items: center;
  width: 44px;
  height: 44px;
  cursor: pointer;
  background: ${PLATE};
  border: 2px solid var(--ink);
  border-radius: 6px;
  box-shadow: 0 4px 0 var(--ink);
}

.cx-back::after {
  content: '';
  width: 12px;
  height: 18px;
  margin-right: 3px;
  background: var(--bone);
  clip-path: polygon(100% 0, 0 50%, 100% 100%);
}

.cx-back:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 var(--ink);
}

.cx-index {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.cx-index button {
  all: unset;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 31px;
  padding: 5px 11px 6px 13px;
  cursor: pointer;
  font: 400 16px/1 var(--display);
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--ash);
  background: var(--grain), linear-gradient(var(--iron-hi), var(--iron));
  border: 2px solid var(--ink);
  border-radius: 5px;
  box-shadow: 0 3px 0 var(--ink);
  transition:
    color 0.12s,
    box-shadow 0.12s;
}

.cx-index .n {
  font: 800 12px/1 var(--ui);
  letter-spacing: 0.08em;
  color: var(--dim);
}

.cx-index button:hover {
  color: var(--bone);
}

/* The section on screen: an amber edge, not the molten fill, which belongs to the one selected part. */
.cx-index button[aria-current='true'] {
  color: var(--amber);
  box-shadow:
    inset 5px 0 0 var(--amber),
    0 3px 0 var(--ink);
}

.cx-index button[aria-current='true'] .n {
  color: var(--ash);
}

.cx-index button:focus-visible,
.cx-back:focus-visible {
  outline: 3px solid var(--amber);
  outline-offset: 2px;
}

/* ------------------------------------------------------------ sections and cards */

.cx-main {
  min-width: 0;
  padding: 30px clamp(20px, 4vw, 56px) 96px clamp(10px, 2vw, 26px);
}

.cx-sec {
  margin: 0 0 56px;
}

.cx-head {
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: center;
  column-gap: 12px;
  margin: 0 0 20px;
}

.cx-head h2 {
  margin: 0;
  font: 400 clamp(26px, 3vw, 34px) / 1 var(--display);
  letter-spacing: 0.03em;
  text-transform: uppercase;
  color: var(--bone);
  text-shadow: 0 3px 0 var(--ink);
}

.cx-head .n {
  font: 800 13px/1 var(--ui);
  letter-spacing: 0.06em;
  color: var(--ink);
  background: var(--hazard);
  border: 2px solid var(--ink);
  border-radius: 4px;
  padding: 3px 7px 4px;
  box-shadow: 0 2px 0 var(--ink);
}

.cx-head::after {
  content: '';
  grid-row: 1;
  grid-column: 3;
  height: 2px;
  background: linear-gradient(90deg, var(--steel), transparent);
  opacity: 0.6;
}

.cx-head p {
  grid-column: 1 / -1;
  margin: 9px 0 0;
  font: 600 15px/1.35 var(--ui);
  color: var(--ash);
}

.cx-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(186px, 1fr));
  gap: 24px 18px;
}

.cx-card {
  all: unset;
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  background: ${PLATE};
  border: 2px solid var(--ink);
  border-radius: 6px;
  box-shadow: 0 5px 0 var(--ink);
  transition:
    transform 0.08s,
    box-shadow 0.08s;
}

/* A recessed window onto the part, lit warm from the middle. */
.cx-well {
  position: relative;
  display: block;
  margin: 10px 10px 0;
  aspect-ratio: 4 / 3;
  background: radial-gradient(70% 62% at 50% 56%, rgba(255, 140, 60, 0.11), transparent 72%), var(--soot);
  border: 2px solid var(--ink);
  border-radius: 4px;
  box-shadow: inset 0 4px 0 rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.cx-well canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.cx-well canvas.glow {
  mix-blend-mode: plus-lighter;
}

.cx-plate {
  position: relative;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  column-gap: 8px;
  margin: 8px 6px 6px;
  padding: 6px 9px 8px;
  border-radius: 4px;
}

.cx-plate .t {
  font: 400 20px/1.05 var(--display);
  letter-spacing: 0.01em;
  color: var(--bone);
  text-shadow: 0 2px 0 var(--ink);
}

.cx-plate .s {
  display: block;
  grid-column: 1;
  margin-top: 4px;
  font: 600 13.5px/1.3 var(--ui);
  color: var(--ash);
}

.cx-plate .s::first-letter {
  text-transform: uppercase;
}

.cx-plate .chev {
  grid-row: 1 / span 2;
  grid-column: 2;
  width: 10px;
  height: 15px;
  background: var(--ink);
  clip-path: polygon(0 0, 100% 50%, 0 100%);
  opacity: 0;
}

.cx-card[data-active='true'] {
  transform: translateY(-4px);
  box-shadow: 0 9px 0 var(--ink);
}

.cx-card[data-active='true'] .cx-plate {
  background: ${MOLTEN};
  box-shadow: 0 0 0 2px var(--ink);
}

.cx-card[data-active='true'] .t {
  color: var(--ink);
  text-shadow: 0 1px 0 rgba(255, 240, 200, 0.45);
}

.cx-card[data-active='true'] .s {
  color: #3a1206;
}

.cx-card[data-active='true'] .chev {
  opacity: 1;
}

/* The selection marker, hanging off the card's edge like the menu's. */
.cx-card[data-active='true'] .cx-plate::before {
  content: '';
  position: absolute;
  left: -21px;
  top: 50%;
  width: 10px;
  height: 10px;
  margin-top: -5px;
  background: var(--amber);
  border: 2px solid var(--ink);
  transform: rotate(45deg);
}

.cx-card:active {
  transform: translateY(-1px);
  box-shadow: 0 2px 0 var(--ink);
}

.cx-card:focus-visible {
  outline: 3px solid var(--amber);
  outline-offset: 3px;
}

/* ------------------------------------------------------------ one part, up close */

.cx-modal {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 28px 18px 72px;
  background: rgba(8, 4, 3, 0.86);
}

.cx-modal[hidden] {
  display: none;
}

.cx-sheet {
  position: relative;
  box-sizing: border-box;
  width: min(1000px, 100%);
  max-height: calc(100dvh - 100px);
  overflow: auto;
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 28px;
  padding: 34px 28px 26px;
  background: ${PLATE};
  border: 2px solid var(--ink);
  border-radius: 6px;
  box-shadow: 0 8px 0 var(--ink);
}

.cx-sheet::before {
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

.cx-stage {
  position: relative;
  align-self: start;
}

.cx-stage .cx-well {
  margin: 0;
  border-width: 3px;
}

.cx-nav {
  all: unset;
  box-sizing: border-box;
  position: absolute;
  top: 50%;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  margin-top: -22px;
  cursor: pointer;
  background: ${PLATE};
  border: 2px solid var(--ink);
  border-radius: 6px;
  box-shadow: 0 4px 0 var(--ink);
}

.cx-nav::after {
  content: '';
  width: 11px;
  height: 17px;
  background: var(--bone);
  clip-path: polygon(0 0, 100% 50%, 0 100%);
}

.cx-nav.prev {
  left: 10px;
}

.cx-nav.prev::after {
  clip-path: polygon(100% 0, 0 50%, 100% 100%);
}

.cx-nav.next {
  right: 10px;
}

.cx-nav:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 var(--ink);
}

.cx-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.cx-tag {
  align-self: flex-start;
  font: 800 12px/1 var(--ui);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink);
  background: var(--hazard);
  border: 2px solid var(--ink);
  border-radius: 4px;
  padding: 4px 8px 5px;
  box-shadow: 0 2px 0 var(--ink);
}

.cx-info h2 {
  margin: 16px 0 8px;
  font: 400 clamp(32px, 4vw, 46px) / 1 var(--display);
  letter-spacing: 0.01em;
  color: var(--bone);
  text-shadow: 0 3px 0 var(--ink);
}

.cx-joke {
  margin: 0 0 18px;
  font: 700 18px/1.35 var(--ui);
  color: var(--amber);
}

.cx-spec {
  list-style: none;
  margin: 0 0 16px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  background: var(--soot);
  border: 2px solid var(--ink);
  border-radius: 4px;
  box-shadow: inset 0 3px 0 rgba(0, 0, 0, 0.4);
}

.cx-spec li {
  position: relative;
  padding-left: 17px;
  font: 600 14.5px/1.35 var(--ui);
  color: var(--bone);
  font-variant-numeric: tabular-nums;
}

.cx-spec li::first-letter {
  text-transform: uppercase;
}

.cx-spec li::before {
  content: '';
  position: absolute;
  left: 1px;
  top: 0.48em;
  width: 6px;
  height: 6px;
  background: var(--steel);
  transform: rotate(45deg);
}

.cx-quip {
  margin: 0 0 20px;
  font: 600 14.5px/1.4 var(--ui);
  color: var(--ash);
}

.cx-quip[hidden] {
  display: none;
}

.cx-actions {
  margin-top: auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
}

.cx-btn {
  all: unset;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 46px;
  padding: 0 16px 2px 12px;
  cursor: pointer;
  font: 400 21px/1 var(--display);
  color: var(--bone);
  text-shadow: 0 2px 0 var(--ink);
  background: ${PLATE};
  border: 2px solid var(--ink);
  border-radius: 6px;
  box-shadow: 0 4px 0 var(--ink);
}

.cx-btn.primary {
  color: var(--ink);
  text-shadow: none;
  background: ${MOLTEN};
}

.cx-btn[hidden] {
  display: none;
}

.cx-btn:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 var(--ink);
}

.cx-btn:focus-visible,
.cx-nav:focus-visible {
  outline: 3px solid var(--amber);
  outline-offset: 2px;
}

/* The footer stays over the open part, with that part's prompts. */
.cx-foot {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  justify-content: space-between;
}

/* ------------------------------------------------------------ phones and touch */

@media (pointer: coarse) {
  .cx-back {
    display: grid;
  }
  .cx-btn .slag-glyph {
    display: none;
  }
  .cx-modal {
    padding-bottom: 18px;
  }
  .cx-side {
    height: 100dvh;
  }
}

@media (max-width: 860px) {
  .codex {
    display: block;
  }
  .cx-side {
    height: auto;
    gap: 0;
    padding: 10px 14px 0;
    overflow: visible;
    background: var(--grain), #140b08;
    border-bottom: 2px solid var(--ink);
  }
  .cx-side::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -7px;
    height: 4px;
    background: var(--tape);
    opacity: 0.85;
  }
  .cx-brand {
    flex-direction: row;
    align-items: center;
    gap: 14px;
  }
  .cx-back {
    display: grid;
  }
  .cx-brand .logo-k {
    --k: 0.3;
    margin-bottom: 4px;
  }
  .cx-title {
    margin: 0;
    font-size: 26px;
  }
  .cx-title::before {
    display: none;
  }
  .cx-index {
    flex-direction: row;
    gap: 8px;
    margin: 0 -14px;
    padding: 12px 14px 14px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .cx-index button {
    flex: none;
    min-height: 36px;
    font-size: 15px;
  }
  .cx-main {
    padding: 26px 14px 36px;
  }
  .cx-sec {
    margin-bottom: 44px;
  }
  .cx-head p {
    font-size: 14.5px;
  }
  .cx-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 18px 12px;
  }
  .cx-well {
    margin: 8px 8px 0;
  }
  .cx-plate {
    margin: 6px 4px 5px;
    padding: 5px 7px 7px;
  }
  .cx-plate .t {
    font-size: 18px;
  }
  .cx-plate .s {
    font-size: 13px;
  }
  .cx-card[data-active='true'] .cx-plate::before {
    display: none;
  }
  .cx-modal {
    padding: 14px 10px;
    align-items: start;
  }
  .cx-sheet {
    grid-template-columns: 1fr;
    gap: 18px;
    max-height: calc(100dvh - 28px);
    padding: 26px 16px 18px;
  }
  .cx-info h2 {
    margin-top: 12px;
  }
  .cx-joke {
    font-size: 17px;
  }
}
`;
