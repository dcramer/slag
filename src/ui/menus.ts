import type { AudioSystem } from '../audio';
import { GRAVITY_CHOICES, gravityLabel, MATCH_LENGTHS, type MatchRules, RULE_CHOICES, type TimerRule } from '../game/rules';
import { BINDABLE, defaultSettings, type InputSettings, type KeyProfile, keyName, SLOTS } from '../input/bindings';
import type { InputManager } from '../input/input';
import { glyphSVG, type Glyph } from './glyphs';
import { capLabel, type InputMode, promptModes } from './prompts';
import { sanitizeName } from './profile';
import {
  cycleTab,
  KEY_ACTIONS,
  type MenuAction,
  type MenuDirection,
  MenuPadReader,
  type NavRect,
  navTarget,
  readMenuPad,
  resolveTab,
  SETTINGS_TABS,
  type SettingsSection,
  type SettingsTab,
  TAB_LABELS,
  tabSections,
  type TabContext,
  visibleTabs,
} from './settings-nav';
import { FONT, PAL } from './style';
import type { QualityTier } from './touch/device';

/** Graphics quality hook (game-client wires it to the renderer). `null` = automatic. */
export interface QualityControl {
  /** The pinned tier, or null when automatic. */
  pinned(): QualityTier | null;
  set(tier: QualityTier | null): void;
}

const HAPTICS_KEY = 'slag.haptics';

/** Saved haptics preference (default on). */
export function loadHaptics(): boolean {
  try {
    return localStorage.getItem(HAPTICS_KEY) !== '0';
  } catch {
    return true;
  }
}

/**
 * DOM overlays for menus that need real text input or dense forms:
 * controls/audio settings, match rules, and the name prompt. They sit on
 * top of the game canvas, capture input while open, and persist through
 * the callbacks they're given (localStorage lives in the owners).
 */

const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .35 0'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E")`;

/** Foundry-style overlay CSS (tokens from ./style; rules in docs/ART.md). */
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

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {}, ...kids: (Node | string)[]) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const k of kids) e.append(k);
  return e;
}

/** Base overlay: open/close, input capture, Escape handling. */
abstract class Overlay {
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

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** Title Case labels for the binding grid (ACTION_LABELS is the input module's plain list). */
const BIND_LABELS: Record<(typeof BINDABLE)[number], string> = {
  left: 'Move Left',
  right: 'Move Right',
  up: 'Up / Aim',
  down: 'Down / Drop',
  jump: 'Jump',
  run: 'Run (Hold)',
  use: 'Use Item',
  confirm: 'Confirm / Pick',
  alt: 'Rotate / Alt',
};

/** A read-only line of a control sheet. */
interface BindRow {
  label: string;
  glyphs: Glyph[];
}

const MOUSE_ROWS: readonly BindRow[] = [
  { label: 'Pick / Place', glyphs: [{ kind: 'mouse', button: 'left' }] },
  {
    label: 'Rotate',
    glyphs: [
      { kind: 'mouse', button: 'right' },
      { kind: 'mouse', button: 'wheel' },
    ],
  },
];

const PAD_ROWS: readonly BindRow[] = [
  {
    label: 'Move',
    glyphs: [
      { kind: 'pad', button: 'LS' },
      { kind: 'pad', button: 'DPAD' },
    ],
  },
  { label: 'Jump / Confirm', glyphs: [{ kind: 'pad', button: 'A' }] },
  {
    label: 'Run',
    glyphs: [
      { kind: 'pad', button: 'X' },
      { kind: 'pad', button: 'RB' },
    ],
  },
  {
    label: 'Use Item',
    glyphs: [
      { kind: 'pad', button: 'Y' },
      { kind: 'pad', button: 'LT' },
    ],
  },
  {
    label: 'Rotate / Self-Destruct',
    glyphs: [
      { kind: 'pad', button: 'B' },
      { kind: 'pad', button: 'LB' },
    ],
  },
  { label: 'Settings', glyphs: [{ kind: 'pad', button: 'MENU' }] },
];

/** What the prompts inside the Settings card show per input family. Touch has no prompts: everything there is a tap. */
const MENU_PROMPTS = {
  prev: { keyboard: { kind: 'key', label: 'Q' }, gamepad: { kind: 'pad', button: 'LB' } },
  next: { keyboard: { kind: 'key', label: 'E' }, gamepad: { kind: 'pad', button: 'RB' } },
  back: { keyboard: { kind: 'key', label: 'Esc' }, gamepad: { kind: 'pad', button: 'B' } },
} as const satisfies Record<string, Partial<Record<InputMode, Glyph>>>;

/** Where the arrows can land: the active tab, the page's controls, the footer. */
const MENU_ITEMS = '.slag-tab[aria-selected=true],.slag-panel button,.slag-panel input,.slag-actions button';

/** Reopening lands on the last tab of this page load. */
let lastTab: SettingsTab = SETTINGS_TABS[0];

function connectedPads(): Gamepad[] {
  return navigator.getGamepads ? [...navigator.getGamepads()].filter((p): p is Gamepad => !!p?.connected) : [];
}

/** Controls (remapping, split keyboard), audio volumes and video options, one tab per page. */
export class SettingsMenu extends Overlay {
  private draft!: InputSettings;
  private listening: { profile: keyof Pick<InputSettings, 'single' | 'left' | 'right'>; action: (typeof BINDABLE)[number]; slot: number } | null = null;
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);
  private tab = lastTab;
  private raf = 0;
  private padReader: MenuPadReader | null = null;
  private padCount = 0;
  /** The last input was a pad: its prompts go first. */
  private padFirst = false;
  private refocus: HTMLElement | null = null;
  private sections: Record<SettingsSection, (panel: HTMLElement) => void> = {
    audio: (p) => this.audioSection(p),
    touch: (p) => this.touchSection(p),
    quality: (p) => this.displaySection(p),
    keyboard: (p) => this.keyboardSection(p),
    mouse: (p) => this.bindSection(p, MOUSE_ROWS),
    gamepad: (p) => this.bindSection(p, PAD_ROWS),
  };
  /** When set, the menu shows a "Leave Lobby" button that calls it. */
  leave: (() => void) | null = null;
  /** When set, the menu shows a graphics-quality picker. */
  quality: QualityControl | null = null;
  /** When set, the menu shows an art-style picker. */

  constructor(
    input: InputManager,
    private audio: AudioSystem,
  ) {
    super(input);
  }

  open() {
    this.draft = structuredClone(this.input.settings);
    this.tab = lastTab;
    this.render();
    this.refocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!this.input.touch.active) this.selectPanel();
    window.addEventListener('keydown', this.keyHandler, true);
    const pads = connectedPads();
    this.padCount = pads.length;
    this.padReader = new MenuPadReader(readMenuPad(pads));
    this.input.capturePads(true);
    this.paintPrompts();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.poll);
  }

  override close() {
    window.removeEventListener('keydown', this.keyHandler, true);
    cancelAnimationFrame(this.raf);
    this.listening = null;
    if (this.isOpen) this.input.capturePads(false);
    const refocus = this.refocus;
    this.refocus = null;
    super.close();
    refocus?.focus();
  }

  /** Gamepads don't raise key events: poll them, and watch for one being plugged in. */
  private poll = () => {
    this.raf = requestAnimationFrame(this.poll);
    const pads = connectedPads();
    if (pads.length !== this.padCount) {
      this.padCount = pads.length;
      this.paintPrompts();
    }
    for (const a of this.padReader?.step(readMenuPad(pads), performance.now()) ?? []) {
      this.setPadFirst(true);
      this.act(a);
    }
  };

  private setPadFirst(on: boolean) {
    if (this.padFirst === on) return;
    this.padFirst = on;
    this.paintPrompts();
  }

  private tabContext(): TabContext {
    return { touch: this.input.touch.active, quality: !!this.quality };
  }

  /** The active tab, the current page's controls and the footer buttons, in reading order. */
  private items(): HTMLElement[] {
    return [...(this.root?.querySelectorAll<HTMLElement>(MENU_ITEMS) ?? [])].filter((e) => !e.matches(':disabled'));
  }

  private selected(): HTMLElement | null {
    const a = document.activeElement;
    return a instanceof HTMLElement && this.root?.contains(a) ? a : null;
  }

  /** Select the first control on the page, or the tab itself on a page with nothing to change. */
  private selectPanel() {
    const first = this.root?.querySelector<HTMLElement>('.slag-panel button:enabled,.slag-panel input:enabled');
    (first ?? this.root?.querySelector<HTMLElement>('.slag-tab[aria-selected=true]'))?.focus({ preventScroll: true });
  }

  private switchTab(tab: SettingsTab, stayOnTab: boolean) {
    if (tab !== this.tab) {
      this.tab = lastTab = tab;
      this.audio.ui?.('click');
      this.render();
    }
    if (stayOnTab) this.root?.querySelector<HTMLElement>('.slag-tab[aria-selected=true]')?.focus();
    else this.selectPanel();
  }

  /** Every input ends up here: keys, the pad, and (through focus) the mouse move one selection. */
  private act(a: MenuAction) {
    if (this.listening) {
      if (a === 'back') {
        this.listening = null;
        this.render();
      }
      return;
    }
    if (a === 'back') {
      this.audio.ui?.('close');
      this.close();
    } else if (a === 'prevTab' || a === 'nextTab') {
      this.switchTab(cycleTab(visibleTabs(this.tabContext()), this.tab, a === 'prevTab' ? -1 : 1), false);
    } else if (a === 'confirm') {
      const cur = this.selected();
      if (cur) cur.click();
      else this.selectPanel();
    } else this.move(a);
  }

  private move(dir: MenuDirection) {
    const items = this.items();
    const cur = this.selected();
    const from = cur ? items.indexOf(cur) : -1;
    if (!cur || from < 0) {
      this.selectPanel();
      return;
    }
    const sideways = dir === 'left' || dir === 'right';
    const d = dir === 'left' ? -1 : 1;
    if (sideways && cur.getAttribute('role') === 'tab') {
      this.switchTab(cycleTab(visibleTabs(this.tabContext()), this.tab, d), true);
    } else if (sideways && cur instanceof HTMLInputElement && cur.type === 'range') {
      if (d < 0) cur.stepDown();
      else cur.stepUp();
      cur.dispatchEvent(new Event('input'));
    } else {
      const next = navTarget(this.itemBoxes(items), from, dir);
      if (next !== null) items[next].focus();
    }
  }

  /** Boxes as if the page weren't scrolled: rows clipped behind the tabs or the footer still sit between them. */
  private itemBoxes(items: readonly HTMLElement[]): NavRect[] {
    const panel = this.root?.querySelector('.slag-panel');
    return items.map((e) => {
      const { left, top, width, height } = e.getBoundingClientRect();
      if (!panel) return { left, top, width, height };
      const below = e.closest('.slag-actions') ? panel.scrollHeight - panel.clientHeight : 0;
      return { left, top: top + below + (panel.contains(e) ? panel.scrollTop : 0), width, height };
    });
  }

  private onKey(e: KeyboardEvent) {
    if (!this.listening) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      this.setPadFirst(false);
      if (e.code === 'Tab') {
        // Tab walks the card and never falls out to the page behind it.
        e.preventDefault();
        const items = this.items();
        const at = items.indexOf(this.selected() ?? items[0]);
        items[(at + (e.shiftKey ? items.length - 1 : 1)) % items.length]?.focus();
        return;
      }
      const action = KEY_ACTIONS[e.code];
      if (action) {
        e.preventDefault();
        this.act(action);
      }
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const { profile, action, slot } = this.listening;
    const prof: KeyProfile = this.draft[profile];
    const codes = prof[action].slice();
    if (e.code === 'Escape') {
      // cancel
    } else if (e.code === 'Backspace' || e.code === 'Delete') {
      codes.splice(slot, 1);
    } else {
      // A key can only do one thing per profile: steal it from other actions.
      for (const a of BINDABLE) if (a !== action) prof[a] = prof[a].filter((c) => c !== e.code);
      codes[slot] = e.code;
    }
    prof[action] = codes.filter(Boolean).slice(0, SLOTS);
    this.listening = null;
    this.input.apply(this.draft);
    this.draft = structuredClone(this.input.settings);
    this.render();
  }

  private audioSection(card: HTMLElement) {
    const muted = !!this.audio.volumes.muted;
    const ranges: HTMLInputElement[] = [];
    card.append(
      this.switchRow('Mute All Sound', muted, (on) => {
        this.audio.setVolumes({ muted: on });
        for (const r of ranges) r.disabled = on;
      }),
    );
    const LABEL = { master: 'Master', music: 'Music', sfx: 'Effects' } as const;
    for (const k of ['master', 'music', 'sfx'] as const) {
      const range = el('input', { type: 'range', min: '0', max: '1', step: '0.05', className: 'slag-range', disabled: muted });
      range.value = String(this.audio.volumes[k]);
      const val = el('span', { className: 'slag-val', textContent: pct(this.audio.volumes[k]) });
      const paint = () => range.style.setProperty('--p', pct(Number(range.value)));
      paint();
      range.oninput = () => {
        this.audio.setVolumes({ [k]: Number(range.value) });
        val.textContent = pct(Number(range.value));
        paint();
      };
      range.setAttribute('aria-label', `${LABEL[k]} volume`);
      ranges.push(range);
      card.append(el('div', { className: 'slag-row' }, el('label', { textContent: LABEL[k] }), range, val));
    }
  }

  private switchRow(label: string, on: boolean, toggle: (on: boolean) => void): HTMLElement {
    const sw = el('button', { className: 'slag-switch', type: 'button' });
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-checked', String(on));
    sw.setAttribute('aria-label', label);
    sw.onclick = () => {
      on = !on;
      sw.setAttribute('aria-checked', String(on));
      toggle(on);
    };
    const name = el('span', { className: 'lbl wide', textContent: label });
    name.onclick = () => sw.click();
    return el('div', { className: 'slag-row' }, name, sw);
  }

  private touchSection(card: HTMLElement) {
    card.append(
      this.switchRow('Vibration', this.input.touch.haptics, (on) => {
        this.input.touch.haptics = on;
        try {
          localStorage.setItem(HAPTICS_KEY, on ? '1' : '0');
        } catch {
          // Not persisted; still applies this session.
        }
      }),
    );
  }

  private displaySection(card: HTMLElement) {
    const q = this.quality;
    if (!q) return;
    const chips = el('div', { className: 'slag-chips' });
    const opts: [QualityTier | null, string][] = [
      [null, 'Auto'],
      ['high', 'High'],
      ['mid', 'Medium'],
      ['low', 'Low'],
    ];
    const cur = q.pinned();
    for (const [tier, label] of opts) {
      const b = el('button', { className: `slag-btn ${cur === tier ? 'on' : ''}`, type: 'button', textContent: label });
      b.onclick = () => {
        q.set(tier);
        for (const sib of chips.querySelectorAll('button')) sib.classList.toggle('on', sib === b);
      };
      chips.append(b);
    }
    card.append(el('div', { className: 'slag-row' }, el('span', { className: 'lbl', textContent: 'Graphics Quality' }), chips));
  }

  private keyboardSection(card: HTMLElement) {
    card.append(
      this.switchRow('Split Keyboard (Two Players)', this.draft.splitKeyboard, (on) => {
        this.draft.splitKeyboard = on;
        this.input.apply(this.draft);
        this.render();
      }),
    );
    const profiles: { key: 'single' | 'left' | 'right'; title: string }[] = this.draft.splitKeyboard
      ? [
          { key: 'left', title: 'Player A' },
          { key: 'right', title: 'Player B' },
        ]
      : [{ key: 'single', title: 'Keys' }];
    const columns = `minmax(72px,1fr) repeat(${profiles.length * SLOTS},minmax(56px,96px))`;
    const keyRow = (head = false) => {
      const row = el('div', { className: `slag-row slag-keys ${head ? 'head' : ''}` });
      row.style.gridTemplateColumns = columns;
      return row;
    };
    const head = keyRow(true);
    head.append(el('div'));
    for (const p of profiles) {
      const h = el('div', { className: 'h', textContent: p.title });
      h.style.gridColumn = `span ${SLOTS}`;
      head.append(h);
    }
    card.append(head);
    for (const a of BINDABLE) {
      const row = keyRow();
      row.append(el('div', { className: 'lbl', textContent: BIND_LABELS[a] }));
      for (const p of profiles) {
        for (let slot = 0; slot < SLOTS; slot++) {
          const listening = this.listening?.profile === p.key && this.listening.action === a && this.listening.slot === slot;
          const code = this.draft[p.key][a][slot];
          const b = el('button', { className: `slag-btn key ${listening ? 'listen' : ''}`, type: 'button' });
          if (listening) b.textContent = 'Press a Key';
          else if (code) b.append(glyphEl({ kind: 'key', label: capLabel(code) }, 24));
          else b.append(el('span', { className: 'slag-empty', textContent: 'Empty' }));
          b.setAttribute('aria-label', `${BIND_LABELS[a]}, ${p.title} ${slot + 1}: ${code ? keyName(code) : 'empty'}`);
          b.onclick = () => {
            this.listening = { profile: p.key, action: a, slot };
            this.render();
          };
          row.append(b);
        }
      }
      card.append(row);
    }
    card.append(
      el(
        'div',
        { className: 'slag-keyfoot' },
        el('div', { className: 'slag-note', textContent: 'Select a slot, then press the new key.' }),
        promptRow([
          { glyphs: [{ kind: 'key', label: '⌫' }], label: 'Clear' },
          { glyphs: [{ kind: 'key', label: 'Esc' }], label: 'Cancel' },
        ]),
      ),
    );
  }

  /** A control sheet: the fixed bindings of an input that can't be remapped. */
  private bindSection(card: HTMLElement, rows: readonly BindRow[]) {
    for (const r of rows) {
      const binds = el('span', { className: 'slag-binds' }, ...r.glyphs.map((g) => glyphEl(g, 30)));
      card.append(el('div', { className: 'slag-row' }, el('span', { className: 'lbl wide', textContent: r.label }), binds));
    }
  }

  private tabBar(tabs: readonly SettingsTab[]): HTMLElement {
    const list = el('div', { className: 'slag-tablist' });
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', 'Settings');
    for (const t of tabs) {
      const b = el('button', { className: 'slag-tab', type: 'button', id: `slag-tab-${t}`, textContent: TAB_LABELS[t] });
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(t === this.tab));
      b.setAttribute('aria-controls', 'slag-panel');
      b.onclick = () => this.switchTab(t, true);
      list.append(b);
    }
    return el('div', { className: 'slag-tabs' }, this.promptSlot('prev'), list, this.promptSlot('next'));
  }

  /** A spot for a prompt: `paintPrompts` fills it for the inputs in play. */
  private promptSlot(prompt: keyof typeof MENU_PROMPTS): HTMLElement {
    const slot = el('span', { className: 'slag-tabkey' });
    slot.dataset.prompt = prompt;
    slot.setAttribute('aria-hidden', 'true');
    return slot;
  }

  private paintPrompts() {
    const active: InputMode = this.input.touch.active ? 'touch' : this.padFirst ? 'gamepad' : 'keyboard';
    const modes = promptModes(active, { keyboard: true, gamepad: this.padCount > 0 });
    for (const slot of this.root?.querySelectorAll<HTMLElement>('[data-prompt]') ?? []) {
      const glyphs: Partial<Record<InputMode, Glyph>> = MENU_PROMPTS[slot.dataset.prompt as keyof typeof MENU_PROMPTS];
      slot.replaceChildren(...modes.flatMap((m) => glyphs[m] ?? []).map((g) => glyphEl(g, 24)));
    }
  }
  private render() {
    const context = this.tabContext();
    const tabs = visibleTabs(context);
    this.tab = resolveTab(tabs, this.tab);
    const card = el('div', { className: 'slag-card slag-sheet slag-settings' }, el('h2', { textContent: 'Settings' }), this.tabBar(tabs));
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Settings');
    const panel = el('div', { className: 'slag-panel', id: 'slag-panel' });
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `slag-tab-${this.tab}`);
    panel.dataset.tab = this.tab;
    for (const s of tabSections(this.tab, context)) this.sections[s](panel);
    card.append(panel);
    const done = el('button', { className: 'slag-btn primary', type: 'button' }, this.promptSlot('back'), 'Done');
    done.onclick = () => this.close();
    const actions = el('div', { className: 'slag-actions' });
    if (this.leave) {
      const leave = el('button', { className: 'slag-btn danger', type: 'button', textContent: 'Leave Lobby' });
      leave.onclick = () => this.leave?.();
      actions.append(leave, el('span', { className: 'grow' }));
    }
    if (this.tab === 'keyboard') {
      const reset = el('button', { className: 'slag-btn', type: 'button', textContent: 'Reset Controls' });
      reset.onclick = () => {
        this.draft = { ...defaultSettings(), splitKeyboard: this.draft.splitKeyboard };
        this.input.apply(this.draft);
        this.render();
      };
      actions.append(reset);
    }
    actions.append(done);
    card.append(actions);
    card.addEventListener('pointermove', (e) => this.onPointerMove(e));
    card.addEventListener('pointerdown', () => this.setPadFirst(false));
    if (this.root) {
      // A rebuild keeps your place: same scroll on the same page, same control selected.
      const old = this.root.querySelector('.slag-panel');
      const scroll = old instanceof HTMLElement && old.dataset.tab === this.tab ? old.scrollTop : 0;
      const before = this.items();
      const cur = this.selected();
      const at = cur ? before.indexOf(cur) : -1;
      this.root.replaceChildren(card);
      panel.scrollTop = scroll;
      const after = this.items();
      if (at >= 0) after[Math.min(at, after.length - 1)]?.focus({ preventScroll: true });
    } else this.mount(card);
    this.paintPrompts();
    card.querySelector('.slag-tab[aria-selected=true]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  /** Mouse hover moves the same selection the arrows do. Only real movement: the DOM changing under a still mouse isn't a choice. */
  private onPointerMove(e: PointerEvent) {
    if (e.pointerType !== 'mouse' || e.buttons || (!e.movementX && !e.movementY)) return;
    const item = (e.target as Element | null)?.closest<HTMLElement>('.slag-panel button,.slag-panel input,.slag-actions button');
    if (item && !item.matches(':disabled') && item !== document.activeElement) item.focus({ preventScroll: true });
  }
}

const RULE_LABELS: Record<TimerRule, string> = {
  pickSeconds: 'Pick Timer',
  placeSeconds: 'Place Timer',
  raceSeconds: 'Race Timer',
};

/** Match rules; applied when the next match starts. */
export class RulesMenu extends Overlay {
  open(rules: MatchRules, onChange: (r: MatchRules) => void) {
    const draft = { ...rules };
    const card = el('div', { className: 'slag-card slag-sheet' }, el('h2', { textContent: 'Match Rules' }));
    const addRow = (title: string, choices: { label: string; on: boolean; apply: () => void }[]) => {
      const chips = el('div', { className: 'slag-chips' });
      for (const c of choices) {
        const b = el('button', { className: `slag-btn ${c.on ? 'on' : ''}`, type: 'button', textContent: c.label });
        b.onclick = () => {
          c.apply();
          onChange({ ...draft });
          for (const sib of chips.querySelectorAll('button')) sib.classList.toggle('on', sib === b);
        };
        chips.append(b);
      }
      card.append(el('h3', { textContent: title }), chips);
    };
    addRow(
      'Match Length',
      MATCH_LENGTHS.map((l) => ({
        label: l.label,
        on: draft.targetScore === l.targetScore && draft.maxRounds === l.maxRounds,
        apply: () => {
          draft.targetScore = l.targetScore;
          draft.maxRounds = l.maxRounds;
        },
      })),
    );
    for (const k of Object.keys(RULE_CHOICES) as TimerRule[]) {
      addRow(
        RULE_LABELS[k],
        RULE_CHOICES[k].map((v) => ({ label: v === 0 ? 'Off' : `${v}s`, on: draft[k] === v, apply: () => (draft[k] = v) })),
      );
    }
    addRow(
      'Gravity',
      GRAVITY_CHOICES.map((v) => ({ label: gravityLabel(v), on: draft.gravity === v, apply: () => (draft.gravity = v) })),
    );
    const done = el('button', { className: 'slag-btn primary', type: 'button', textContent: 'Done' });
    done.onclick = () => this.close();
    card.append(el('div', { className: 'slag-actions' }, done));
    this.mount(card);
  }
}

/** Name entry, with a one-click keep-random option. */
export class NamePrompt extends Overlay {
  open(randomName: string, current: string | null, onDone: (name: string | null) => void) {
    const input = el('input', { className: 'slag-input', value: current ?? randomName, maxLength: 12, placeholder: randomName });
    input.setAttribute('aria-label', 'Your name');
    const finish = (name: string | null) => {
      onDone(name);
      this.close();
    };
    const ok = el('button', { className: 'slag-btn primary', type: 'button', textContent: 'Save Name' });
    ok.onclick = () => finish(sanitizeName(input.value) || null);
    const keep = el('button', { className: 'slag-btn', type: 'button', textContent: `Keep “${randomName}”` });
    keep.onclick = () => finish(null);
    input.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') ok.click();
    };
    const card = el('div', { className: 'slag-card' }, el('h2', { textContent: 'Your Name' }), input, el('div', { className: 'slag-actions' }, keep, ok));
    this.mount(card);
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }
}
