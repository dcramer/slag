import type { AudioSystem } from '../../audio';
import { BINDABLE, defaultSettings, type InputSettings, type KeyProfile, keyName, SLOTS } from '../../input/bindings';
import { connectedPads, type InputManager } from '../../input/input';
import type { Glyph } from '../glyphs';
import { capLabel, type InputMode, promptModes } from '../prompts';
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
} from '../settings-nav';
import type { QualityTier } from '../touch/device';
import { el, glyphEl, Overlay, promptRow } from './overlay';

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
  /** Online: Watch for a player, Play for someone watching with a seat free. Read each time the menu draws; null shows nothing. */
  seat: (() => { label: 'Watch' | 'Play'; run: () => void } | null) | null = null;
  /** When set, the menu shows a graphics-quality picker. */
  quality: QualityControl | null = null;

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
      actions.append(leave);
      const seat = this.seat?.();
      if (seat) {
        const b = el('button', { className: 'slag-btn', type: 'button', textContent: seat.label });
        b.onclick = () => {
          seat.run();
          this.close();
        };
        actions.append(b);
      }
      actions.append(el('span', { className: 'grow' }));
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
