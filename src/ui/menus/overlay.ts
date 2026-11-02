import type { InputManager } from '../../input/input';
import { glyphSVG, type Glyph } from '../glyphs';
import { FONT, PAL } from '../style';

/**
 * DOM overlays for menus that need real text input or dense forms:
 * controls/audio settings, match rules, and the name prompt. They sit on
 * top of the game canvas, capture input while open, and persist through
 * the callbacks they're given (localStorage lives in the owners).
 */

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .35 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E")`;

/** Foundry-style overlay CSS (tokens from ../style; rules in docs/ART.md). */
const CSS = `
.slag-ov{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(14,8,5,.8);z-index:10;font:500 15px ${FONT.ui};color:${PAL.bone};padding:12px;box-sizing:border-box}
.slag-card{position:relative;background:${GRAIN},linear-gradient(${PAL.iron},#1f1612);border:2px solid ${PAL.ink};border-radius:6px;box-shadow:0 6px 0 ${PAL.ink},0 26px 70px rgba(0,0,0,.65);padding:6px 26px 20px;width:min(600px,100%);max-height:100%;overflow:auto;box-sizing:border-box}
.slag-card::before{content:"";position:sticky;display:block;top:-6px;margin:-6px -26px 0;height:7px;background:repeating-linear-gradient(-45deg,${PAL.hazard} 0 9px,#17110c 9px 18px);border-bottom:2px solid ${PAL.ink};z-index:1}
.slag-card h2{font:400 34px ${FONT.display};text-transform:uppercase;color:${PAL.amber};margin:16px 0 4px;letter-spacing:.5px;text-shadow:0 3px 0 ${PAL.ink}}
.slag-card h3{font:800 12px ${FONT.ui};text-transform:uppercase;letter-spacing:.16em;color:${PAL.ash};margin:22px 0 10px;display:flex;align-items:center;gap:10px}
.slag-card h3::after{content:"";flex:1;height:2px;background:linear-gradient(90deg,${PAL.steel},transparent)}
.slag-row{display:flex;align-items:center;gap:12px;margin:8px 0;min-height:32px}
.slag-row>label,.slag-row>.lbl{flex:0 0 112px;color:${PAL.bone};font-weight:600}
.slag-row>.lbl.wide{flex:1}
.slag-val{flex:0 0 44px;text-align:right;font:700 14px ${FONT.ui};color:${PAL.ash};font-variant-numeric:tabular-nums}
.slag-btn{font:700 15px ${FONT.ui};color:${PAL.bone};background:#4a3a31;border:2px solid ${PAL.ink};border-radius:5px;padding:7px 14px;box-shadow:0 3px 0 ${PAL.ink};cursor:pointer;min-height:36px;transition:transform .06s,box-shadow .06s,background .1s}
.slag-btn:hover{background:#5d4a3e}
.slag-btn:focus-visible{outline:2px solid ${PAL.amber};outline-offset:2px}
.slag-btn:active{transform:translateY(2px);box-shadow:0 1px 0 ${PAL.ink}}
.slag-btn.primary{background:#ff8a2a;color:${PAL.ink}}
.slag-btn.primary:hover{background:#ffa04a}
.slag-btn.on{background:${PAL.toxic};color:${PAL.ink}}
.slag-btn.danger{background:#6a2216}
.slag-btn.key{background:${PAL.soot};padding:4px 8px;min-width:84px;display:inline-flex;align-items:center;justify-content:center}
.slag-btn.key:hover{background:#2c1f19}
.slag-btn.listen{background:#7a2d0e;color:${PAL.whiteHot};font-size:13px;animation:slagpulse .7s infinite alternate}
.slag-btn .slag-empty{color:${PAL.dim};font-weight:600}
@keyframes slagpulse{to{background:#b8410f}}
.slag-grid{display:grid;gap:8px 10px;align-items:center}
.slag-grid .h{font:800 11px ${FONT.ui};color:${PAL.ash};text-transform:uppercase;letter-spacing:.14em}
.slag-actions{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end;align-items:center;margin-top:22px}
.slag-actions .grow{flex:1}
.slag-input{font:700 22px ${FONT.ui};background:${PAL.soot};color:${PAL.bone};border:2px solid ${PAL.ink};box-shadow:inset 0 3px 0 rgba(0,0,0,.4);border-radius:5px;padding:10px 12px;width:100%;box-sizing:border-box;outline:none}
.slag-input:focus{border-color:${PAL.molten}}
.slag-note{color:${PAL.ash};font-size:14px;line-height:1.45;margin-top:10px}
.slag-prompts{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;margin-top:8px;color:${PAL.bone};font-weight:700;font-size:14px}
.slag-prompt{display:inline-flex;align-items:center;gap:6px}
.slag-glyph{display:inline-block;vertical-align:middle;flex:none}
input[type=range].slag-range{-webkit-appearance:none;appearance:none;flex:1;min-width:80px;height:14px;margin:0;border:2px solid ${PAL.ink};border-radius:4px;background:linear-gradient(90deg,${PAL.ember},${PAL.molten} calc(var(--p) * .7),${PAL.amber} var(--p),${PAL.soot} var(--p));box-shadow:inset 0 2px 0 rgba(0,0,0,.35);cursor:pointer}
input[type=range].slag-range:disabled{filter:grayscale(1) brightness(.7);cursor:default}
input[type=range].slag-range::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:26px;border-radius:4px;background:${PAL.bone};border:2px solid ${PAL.ink};box-shadow:0 2px 0 ${PAL.ink}}
input[type=range].slag-range::-moz-range-thumb{width:14px;height:24px;border-radius:4px;background:${PAL.bone};border:2px solid ${PAL.ink}}
input[type=range].slag-range:focus-visible{outline:2px solid ${PAL.amber};outline-offset:3px}
.slag-switch{position:relative;width:52px;height:28px;flex:none;border:2px solid ${PAL.ink};border-radius:14px;background:${PAL.soot};box-shadow:inset 0 2px 0 rgba(0,0,0,.4);cursor:pointer;padding:0}
.slag-switch::after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;background:${PAL.ash};border:2px solid ${PAL.ink};box-sizing:border-box;transition:left .12s}
.slag-switch[aria-checked=true]{background:${PAL.molten}}
.slag-switch[aria-checked=true]::after{left:26px;background:${PAL.bone}}
.slag-switch:focus-visible{outline:2px solid ${PAL.amber};outline-offset:2px}
.slag-chips{display:flex;flex-wrap:wrap;gap:8px}
.slag-pair{display:flex;flex-wrap:wrap;column-gap:28px}.slag-pair>div{flex:0 1 auto}
.slag-chips .slag-btn{min-width:56px;padding:6px 10px}
@media (max-height:520px){.slag-ov{align-items:flex-start}.slag-card h2{font-size:26px;margin-top:10px}}
@media (max-width:520px){.slag-card{padding:6px 16px 16px}.slag-card::before{margin:-6px -16px 0}.slag-row>label,.slag-row>.lbl{flex-basis:84px}.slag-row{flex-wrap:wrap}}
.slag-settings{display:flex;flex-direction:column;width:min(780px,100%);height:min(100%,720px);overflow:hidden;padding-bottom:16px}
.slag-settings h2{flex:none;margin:12px 0 6px}
.slag-tabs{flex:none;display:flex;align-items:center;gap:8px;margin-bottom:8px}
.slag-tablist{flex:1;min-width:0;display:flex;gap:6px;padding:5px 5px 9px}
.slag-tab{all:unset;box-sizing:border-box;flex:1 0 auto;min-height:48px;padding:7px 12px 9px;text-align:center;cursor:pointer;font:400 21px/1.2 ${FONT.display};letter-spacing:.02em;text-transform:uppercase;color:${PAL.bone};text-shadow:0 2px 0 ${PAL.ink};background:${GRAIN},linear-gradient(${PAL.ironHi},${PAL.iron});border:2px solid ${PAL.ink};border-radius:6px;box-shadow:0 4px 0 ${PAL.ink};transition:transform .08s,box-shadow .08s}
.slag-tab:hover{background:${GRAIN},linear-gradient(#4f3d33,${PAL.ironHi})}
.slag-tab[aria-selected=true]{color:${PAL.ink};text-shadow:0 1px 0 rgba(255,240,200,.45);background:${GRAIN},linear-gradient(#ff8a2a,#e8571a);transform:translateY(2px);box-shadow:0 2px 0 ${PAL.ink}}
.slag-tab:focus{outline:3px solid ${PAL.amber};outline-offset:2px}
.slag-tabkey{flex:none;display:inline-flex;align-items:center;gap:4px}
.slag-tabkey:empty{display:none}
.slag-panel{flex:1;min-height:0;overflow:hidden auto;margin:0 -14px;padding:2px 22px 2px 20px;outline:none}
.slag-settings .slag-row{position:relative;min-height:60px;margin:0 0 4px;padding:4px 14px;box-sizing:border-box;border:2px solid transparent;border-radius:6px;font-size:18px;transition:transform .08s}
.slag-settings .slag-row>label,.slag-settings .slag-row>.lbl{flex:0 0 156px;font-weight:700}
.slag-settings .slag-row>.lbl.wide{flex:1}
.slag-settings .slag-row:has(:focus){color:${PAL.ink};background:${GRAIN},linear-gradient(#ff8a2a,#e8571a);border-color:${PAL.ink};transform:translateX(6px)}
.slag-settings .slag-row:has(:focus)>label,.slag-settings .slag-row:has(:focus)>.lbl,.slag-settings .slag-row:has(:focus) .slag-val{color:${PAL.ink}}
.slag-settings .slag-row:has(:focus)::before{content:"";position:absolute;left:-19px;top:50%;width:10px;height:10px;margin-top:-5px;background:${PAL.amber};border:2px solid ${PAL.ink};transform:rotate(45deg)}
.slag-settings .slag-btn{min-height:44px}
.slag-settings .slag-btn:focus,.slag-settings .slag-switch:focus{outline:3px solid ${PAL.whiteHot};outline-offset:1px}
.slag-settings .slag-switch::before{content:"";position:absolute;inset:-10px -6px}
.slag-settings .slag-chips{flex:1}
.slag-settings .slag-chips .slag-btn{flex:1;min-width:72px}
.slag-settings input[type=range].slag-range:focus{outline:none}
.slag-binds{display:inline-flex;align-items:center;gap:8px}
.slag-keys.slag-row{display:grid;gap:8px;min-height:42px;margin:0;padding:1px 14px;font-size:16px}
.slag-keys.slag-row .h{font:800 11px ${FONT.ui};color:${PAL.ash};text-transform:uppercase;letter-spacing:.14em}
.slag-keys.head{min-height:20px;padding-block:0}
.slag-panel[data-tab=keyboard] .slag-row:not(.slag-keys){min-height:48px}
.slag-keys .slag-btn.key{min-width:0;min-height:36px;padding:2px}
.slag-keyfoot{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:6px 18px;padding:4px 14px 0}
.slag-keyfoot .slag-note,.slag-keyfoot .slag-prompts{margin:0}
.slag-settings .slag-actions{flex:none;margin-top:10px}
.slag-actions .slag-btn{display:inline-flex;align-items:center;gap:8px}
@media (max-height:520px){.slag-settings h2{display:none}.slag-tablist{padding-block:6px 8px}.slag-settings .slag-row{min-height:48px;margin-bottom:2px}.slag-settings .slag-actions{margin-top:6px}.slag-settings{padding-bottom:10px}}
@media (max-width:640px){.slag-tablist{overflow-x:auto;scrollbar-width:none}.slag-tabkey{display:none}.slag-tab{font-size:18px;padding-inline:10px}}
@media (max-width:760px),(max-height:520px){
.slag-ov:has(.slag-sheet){padding:0;align-items:stretch}
.slag-card.slag-sheet{width:100%;height:100%;max-height:none;border:0;border-radius:0;box-shadow:none;padding:0 calc(16px + env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left))}
.slag-card.slag-sheet::before{margin-inline:calc(-16px - env(safe-area-inset-left)) calc(-16px - env(safe-area-inset-right))}
.slag-sheet{overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.slag-sheet .slag-chips .slag-btn{min-height:48px;min-width:64px}
.slag-sheet .slag-actions .slag-btn{min-height:48px;padding-inline:20px}
.slag-tablist{overflow-x:auto;scrollbar-width:none}
.slag-tab{min-height:50px;font-size:19px}
.slag-settings .slag-tabkey{display:none}
.slag-panel{margin:0 calc(-16px - env(safe-area-inset-right)) 0 calc(-16px - env(safe-area-inset-left));padding:2px calc(22px + env(safe-area-inset-right)) 2px calc(22px + env(safe-area-inset-left));overscroll-behavior:contain;touch-action:pan-y}
.slag-settings .slag-row,.slag-panel[data-tab=keyboard] .slag-row:not(.slag-keys){min-height:60px;margin-bottom:4px;font-size:18px}
.slag-settings .slag-btn{min-height:48px}
.slag-keys .slag-btn.key{min-height:44px}
.slag-settings .slag-switch{width:64px;height:36px}
.slag-settings .slag-switch::after{width:28px;height:28px}
.slag-settings .slag-switch[aria-checked=true]::after{left:30px}
.slag-settings .slag-switch::before{inset:-8px}
input[type=range].slag-range{height:20px;background-clip:padding-box}
input[type=range].slag-range::-webkit-slider-thumb{width:32px;height:44px}
input[type=range].slag-range::-moz-range-thumb{width:30px;height:42px}
.slag-settings .slag-row:has(:focus){transform:none}
.slag-settings .slag-row:has(:focus)::before{display:none}
}
@media (max-height:520px){.slag-settings{display:grid;grid-template:auto minmax(0,1fr)/minmax(0,1fr) auto;column-gap:12px;padding-top:0}.slag-settings::before{grid-column:1/-1}.slag-settings .slag-tabs{margin-bottom:2px}.slag-settings .slag-panel{grid-row:3;grid-column:1/-1}.slag-settings .slag-actions{grid-row:2;grid-column:2;margin:0 0 4px;align-self:center;flex-wrap:nowrap}.slag-settings .slag-actions .grow{display:none}.slag-card.slag-sheet.slag-settings{padding-bottom:calc(6px + env(safe-area-inset-bottom))}.slag-settings{grid-template-rows:auto auto minmax(0,1fr)}.slag-sheet:not(.slag-settings) h2{display:none}}
@media (max-width:520px){.slag-settings .slag-row>label{flex-basis:76px}.slag-settings .slag-row:has(.slag-range){flex-wrap:nowrap}.slag-settings .slag-row:has(.slag-chips)>.lbl{flex-basis:100%}.slag-settings .slag-row:has(.slag-chips){padding-block:8px}.slag-settings .slag-chips{flex:1 0 100%}.slag-settings .slag-chips .slag-btn{flex:1;min-width:0;padding-inline:6px}}
`;

let styled = false;
function ensureStyle() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
}

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {},
  ...kids: (Node | string)[]
) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const k of kids) e.append(k);
  return e;
}

/** Base overlay: open/close, input capture, Escape handling. */
export abstract class Overlay {
  protected root: HTMLDivElement | null = null;
  constructor(protected input: InputManager) {}
  get isOpen() {
    return !!this.root;
  }
  protected mount(card: HTMLElement) {
    ensureStyle();
    this.close();
    this.root = el('div', { className: 'slag-ov' }, card);
    this.root.addEventListener('pointerdown', (e) => e.target === this.root && this.close());
    document.body.appendChild(this.root);
    this.input.captured = true;
  }
  close() {
    if (!this.root) return;
    this.root.remove();
    this.root = null;
    this.input.captured = false;
    this.onClose?.();
  }
  onClose: (() => void) | null = null;
}

/** Inline glyph (keycap, pad button, mouse) as a DOM node. */
export function glyphEl(g: Glyph, h = 22): HTMLElement {
  const span = el('span', { className: 'slag-glyph' });
  span.innerHTML = glyphSVG(g, h);
  return span;
}

/** A row of "glyph glyph Label" prompts, like the in-game footer. */
export function promptRow(items: { glyphs: Glyph[]; label: string }[], h = 22): HTMLElement {
  const row = el('div', { className: 'slag-prompts' });
  for (const it of items) row.append(el('span', { className: 'slag-prompt' }, ...it.glyphs.map((g) => glyphEl(g, h)), it.label));
  return row;
}
