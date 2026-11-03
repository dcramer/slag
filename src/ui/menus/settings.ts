import type { AudioSystem } from '../../audio';
import { BINDABLE, defaultSettings, type InputSettings, type KeyProfile, keyName, SLOTS } from '../../input/bindings';
import type { InputManager } from '../../input/input';
import { plate } from '../../render/hud-kit';
import type { Glyph } from '../glyphs';
import { CanvasMenu } from '../kit/menu';
import type { ButtonOpts, Rect, Ui } from '../kit/ui';
import { capLabel, type InputMode, promptModes } from '../prompts';
import {
  cycleTab,
  type MenuAction,
  resolveTab,
  SETTINGS_TABS,
  type SettingsSection,
  type SettingsTab,
  TAB_LABELS,
  tabSections,
  visibleTabs,
} from '../settings-nav';
import { FONT, PAL } from '../style';
import type { QualityTier } from '../touch/device';

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

const QUALITY: readonly [QualityTier | null, string][] = [
  [null, 'Auto'],
  ['high', 'High'],
  ['mid', 'Medium'],
  ['low', 'Low'],
];

type Profile = keyof Pick<InputSettings, 'single' | 'left' | 'right'>;

/** Ids: the tabs, the page's controls (`p:`), the footer (`f:`). Only `p:` ones scroll. */
const onPage = (id: string) => id.startsWith('p:');

/** Reopening lands on the last tab of this page load. */
let lastTab: SettingsTab = SETTINGS_TABS[0];

/** Controls (remapping, split keyboard), audio volumes and video options, one tab per page. */
export class SettingsMenu extends CanvasMenu {
  private draft!: InputSettings;
  private listening: { profile: Profile; action: (typeof BINDABLE)[number]; slot: number } | null = null;
  private tab = lastTab;
  /** Per page: the row's label column and how tall a row is, set as the page lays out. */
  private rowH = 30;
  private sections: Record<SettingsSection, (ui: Ui, x: number, y: number, w: number) => number> = {
    audio: (ui, x, y, w) => this.audioSection(ui, x, y, w),
    touch: (ui, x, y, w) => this.touchSection(ui, x, y, w),
    quality: (ui, x, y, w) => this.displaySection(ui, x, y, w),
    keyboard: (ui, x, y, w) => this.keyboardSection(ui, x, y, w),
    mouse: (ui, x, y, w) => this.bindSection(ui, x, y, w, MOUSE_ROWS),
    gamepad: (ui, x, y, w) => this.bindSection(ui, x, y, w, PAD_ROWS),
  };
  /** When set, the menu shows a "Leave Lobby" button that calls it. */
  leave: (() => void) | null = null;
  /** Online: Watch for a player, Play for someone watching with a seat free. Read each frame; null shows nothing. */
  seat: (() => { label: 'Watch' | 'Play'; run: () => void } | null) | null = null;
  /** When set, the menu shows a graphics-quality picker. */
  quality: QualityControl | null = null;

  constructor(
    private readonly manager: InputManager,
    private audio: AudioSystem,
  ) {
    super(manager, 'settings');
  }

  /** The tab on show (tools and tests read it). */
  get page(): SettingsTab {
    return this.tab;
  }

  open() {
    this.draft = structuredClone(this.manager.settings);
    this.tab = resolveTab(visibleTabs(this.tabContext()), lastTab);
    this.listening = null;
    this.ui.resetScroll('panel');
    this.mount();
    this.ui.selected = null;
    if (!this.manager.touch.active) this.selectPage();
  }

  protected override closed() {
    this.listening = null;
  }

  private tabContext() {
    return { touch: this.manager.touch.active, quality: !!this.quality };
  }

  /** Select the first control on the page, or the tab itself on a page with nothing to change. */
  private selectPage() {
    const tab = `tab:${this.tab}`;
    this.ui.selectSoon(onPage, (id) => id === tab);
  }

  private switchTab(tab: SettingsTab, stayOnTab: boolean) {
    if (tab !== this.tab) {
      this.tab = lastTab = tab;
      this.audio.ui?.('click');
      this.ui.resetScroll('panel');
    }
    if (stayOnTab) this.ui.selectSoon((id) => id === `tab:${tab}`);
    else this.selectPage();
  }

  override busy() {
    return !!this.listening;
  }

  act(a: MenuAction) {
    if (this.listening) {
      if (a === 'back') this.listening = null;
      return;
    }
    if (a === 'back') {
      this.audio.ui?.('close');
      this.close();
    } else if (a === 'prevTab' || a === 'nextTab') {
      this.switchTab(cycleTab(visibleTabs(this.tabContext()), this.tab, a === 'prevTab' ? -1 : 1), false);
    }
  }

  /** While a slot listens, the next key is the binding: Q is a key, not "previous tab". */
  override key(e: KeyboardEvent): boolean {
    if (!this.listening) return false;
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
    this.apply();
    return true;
  }

  private apply() {
    this.manager.apply(this.draft);
    this.draft = structuredClone(this.manager.settings);
  }

  // ------------------------------------------------------------------------------------------------

  draw(ui: Ui) {
    const tabs = visibleTabs(this.tabContext());
    this.tab = resolveTab(tabs, this.tab);
    const { inner, full } = ui.sheet(560, 430);
    const thumb = Math.max(ui.tap, 0);
    this.rowH = Math.max(thumb, ui.thumbs ? 34 : 28);
    let y = inner.y;
    if (ui.H >= 330) {
      ui.text('SETTINGS', inner.x, y + 12, 22, PAL.amber, 'left', 400, FONT.display);
      y += 30;
    }
    y = this.tabBar(ui, tabs, { x: inner.x, y, w: inner.w, h: Math.max(thumb, 28) }) + 8;
    const footH = this.footerHeight(ui, inner.w, full);
    const view = { x: inner.x, y, w: inner.w, h: inner.y + inner.h - footH - 8 - y };
    ui.scroll('panel', view, () => {
      let at = view.y;
      for (const s of tabSections(this.tab, this.tabContext())) at = this.sections[s](ui, view.x, at, view.w);
      return at;
    });
    this.footer(ui, { x: inner.x, y: inner.y + inner.h - footH, w: inner.w, h: footH });
  }

  /** The prompts for the inputs in play, for one of the menu's own keys. */
  private prompts(ui: Ui, which: keyof typeof MENU_PROMPTS): Glyph[] {
    const active: InputMode = this.manager.touch.active ? 'touch' : ui.mode === 'gamepad' ? 'gamepad' : 'keyboard';
    const glyphs: Partial<Record<InputMode, Glyph>> = MENU_PROMPTS[which];
    return promptModes(active, { keyboard: true, gamepad: ui.pads > 0 }).flatMap((m) => glyphs[m] ?? []);
  }

  private tabBar(ui: Ui, tabs: readonly SettingsTab[], r: Rect): number {
    const gh = 15;
    const prev = ui.W >= 420 ? this.prompts(ui, 'prev') : [];
    const next = ui.W >= 420 ? this.prompts(ui, 'next') : [];
    const pw = prev.length ? ui.glyphsWidth(prev, gh) + 8 : 0;
    const nw = next.length ? ui.glyphsWidth(next, gh) + 8 : 0;
    if (prev.length) ui.glyphs(prev, r.x, r.y + r.h / 2 - 1, gh);
    if (next.length) ui.glyphs(next, r.x + r.w - nw + 8, r.y + r.h / 2 - 1, gh);
    const gap = 5;
    const w = (r.w - pw - nw - gap * (tabs.length - 1)) / tabs.length;
    const size = w < 70 ? 11 : 12.5;
    tabs.forEach((t, i) => {
      const on = t === this.tab;
      ui.button(`tab:${t}`, { x: r.x + pw + i * (w + gap), y: r.y, w, h: r.h }, TAB_LABELS[t].toUpperCase(), () => this.switchTab(t, true), {
        style: on ? 'primary' : 'secondary',
        font: FONT.display,
        size,
        on,
        label: TAB_LABELS[t],
        // Left and right on a tab walk the tabs, and the selection stays on the tab bar.
        step: (d) => this.switchTab(cycleTab(tabs, this.tab, d), true),
      });
    });
    return r.y + r.h;
  }

  private footItems(ui: Ui): { left: [string, string, () => void, ButtonOpts][]; right: [string, string, () => void, ButtonOpts][] } {
    const left: [string, string, () => void, ButtonOpts][] = [];
    const right: [string, string, () => void, ButtonOpts][] = [];
    if (this.leave) {
      left.push(['f:leave', 'Leave Lobby', () => this.leave?.(), { style: 'danger' }]);
      const seat = this.seat?.();
      if (seat)
        left.push([
          'f:seat',
          seat.label,
          () => {
            seat.run();
            this.close();
          },
          {},
        ]);
    }
    if (this.tab === 'keyboard')
      right.push([
        'f:reset',
        'Reset Controls',
        () => {
          this.draft = { ...defaultSettings(), splitKeyboard: this.draft.splitKeyboard };
          this.apply();
        },
        {},
      ]);
    right.push(['f:done', 'Done', () => this.close(), { style: 'primary', glyphs: this.prompts(ui, 'back') }]);
    return { left, right };
  }

  private footWidth(ui: Ui, items: [string, string, () => void, ButtonOpts][]) {
    return items.reduce((w, [, label, , o]) => w + ui.buttonWidth(label, o) + 8, -8);
  }

  private btnH(ui: Ui) {
    return Math.max(ui.tap, 28);
  }

  private footerHeight(ui: Ui, w: number, _full: boolean): number {
    const { left, right } = this.footItems(ui);
    const one = !left.length || this.footWidth(ui, left) + this.footWidth(ui, right) + 16 <= w;
    return one ? this.btnH(ui) : this.btnH(ui) * 2 + 6;
  }

  /** Leave and Watch on the left, Reset and Done on the right; two lines when they don't fit on one. */
  private footer(ui: Ui, r: Rect) {
    const { left, right } = this.footItems(ui);
    const h = this.btnH(ui);
    const two = r.h > h;
    const row = (items: typeof left, x: number, y: number) => {
      for (const [id, label, press, o] of items) {
        const w = ui.buttonWidth(label, o);
        ui.button(id, { x, y, w, h }, label, press, o);
        x += w + 8;
      }
    };
    row(left, r.x, r.y);
    row(right, r.x + r.w - this.footWidth(ui, right), two ? r.y + h + 6 : r.y);
  }

  // ------------------------------------------------------------------------------------------------
  // Rows

  /** A row's plate: lit in molten while one of its controls is selected. Returns the text color on it. */
  private row(ui: Ui, r: Rect, ids: readonly string[]): string {
    if (!ui.litAny(ids)) return PAL.bone;
    const c = ui.c;
    plate(c, r.x - 6, r.y, r.w + 12, r.h - 2, { fill: '#e8571a', rivets: false, radius: 5, drop: 2, seed: 3 });
    // The diamond in the margin, pointing at the row.
    const cy = r.y + (r.h - 2) / 2;
    c.fillStyle = PAL.ink;
    c.beginPath();
    c.moveTo(r.x - 12, cy - 5);
    c.lineTo(r.x - 7, cy);
    c.lineTo(r.x - 12, cy + 5);
    c.lineTo(r.x - 17, cy);
    c.fill();
    c.fillStyle = PAL.amber;
    c.beginPath();
    c.moveTo(r.x - 12, cy - 3.4);
    c.lineTo(r.x - 8.6, cy);
    c.lineTo(r.x - 12, cy + 3.4);
    c.lineTo(r.x - 15.4, cy);
    c.fill();
    return PAL.ink;
  }

  private label(ui: Ui, s: string, x: number, cy: number, w: number, color: string, size = 12) {
    ui.text(ui.fit(s, w, size), x, cy, size, color, 'left', 700);
  }

  private switchRow(ui: Ui, id: string, x: number, y: number, w: number, label: string, on: boolean, set: (on: boolean) => void): number {
    const r = { x, y, w, h: this.rowH };
    const ink = this.row(ui, r, [id]);
    this.label(ui, label, x + 4, y + r.h / 2, w - 70, ink);
    ui.toggle(id, { x, y, w: w - 4, h: r.h - 2 }, label, on, set);
    return y + r.h + 2;
  }

  private audioSection(ui: Ui, x: number, y: number, w: number): number {
    const muted = !!this.audio.volumes.muted;
    y = this.switchRow(ui, 'p:mute', x, y, w, 'Mute All Sound', muted, (on) => this.audio.setVolumes({ muted: on }));
    const LABEL = { master: 'Master', music: 'Music', sfx: 'Effects' } as const;
    const lw = w < 360 ? 70 : 110;
    for (const k of ['master', 'music', 'sfx'] as const) {
      const id = `p:vol:${k}`;
      const r = { x, y, w, h: this.rowH };
      const ink = this.row(ui, r, [id]);
      const v = this.audio.volumes[k];
      this.label(ui, LABEL[k], x + 4, y + r.h / 2, lw - 8, muted ? PAL.dim : ink);
      ui.slider(id, { x: x + lw, y: y + 2, w: w - lw - 54, h: r.h - 6 }, `${LABEL[k]} volume`, v, 0.05, (nv) => this.audio.setVolumes({ [k]: nv }), muted);
      ui.text(pct(v), x + w - 4, y + r.h / 2, 11, ink === PAL.ink ? PAL.ink : PAL.ash, 'right', 700);
      y += r.h + 2;
    }
    return y;
  }

  private touchSection(ui: Ui, x: number, y: number, w: number): number {
    return this.switchRow(ui, 'p:haptics', x, y, w, 'Vibration', this.manager.touch.haptics, (on) => {
      this.manager.touch.haptics = on;
      try {
        localStorage.setItem(HAPTICS_KEY, on ? '1' : '0');
      } catch {
        // Not persisted; still applies this session.
      }
    });
  }

  private displaySection(ui: Ui, x: number, y: number, w: number): number {
    const q = this.quality;
    if (!q) return y;
    const cur = q.pinned();
    const ids = QUALITY.map(([tier]) => `p:quality:${tier ?? 'auto'}`);
    // The label beside the chips while it fits, above them on a phone.
    const lw = w >= 420 ? 150 : 0;
    const h = this.btnH(ui);
    const r = { x, y, w, h: (lw ? 0 : 22) + h + 8 };
    const ink = this.row(ui, r, ids);
    this.label(ui, 'Graphics Quality', x + 4, lw ? y + r.h / 2 : y + 12, lw ? lw - 8 : w, ink);
    const cx = x + lw;
    const cw = (w - lw - 4 - 6 * (QUALITY.length - 1)) / QUALITY.length;
    QUALITY.forEach(([tier, label], i) => {
      const on = cur === tier;
      ui.button(ids[i], { x: cx + i * (cw + 6), y: y + r.h - h - 4, w: cw, h }, label, () => q.set(tier), { style: on ? 'ready' : 'secondary', on });
    });
    return y + r.h + 2;
  }

  private keyboardSection(ui: Ui, x: number, y: number, w: number): number {
    y = this.switchRow(ui, 'p:split', x, y, w, 'Split Keyboard (Two Players)', this.draft.splitKeyboard, (on) => {
      this.draft.splitKeyboard = on;
      this.apply();
    });
    const profiles: { key: Profile; title: string }[] = this.draft.splitKeyboard
      ? [
          { key: 'left', title: 'Player A' },
          { key: 'right', title: 'Player B' },
        ]
      : [{ key: 'single', title: 'Keys' }];
    const n = profiles.length * SLOTS;
    const kw = Math.min(64, (w - 96) / n - 4);
    const keysX = x + w - n * (kw + 4);
    const rowH = Math.max(ui.tap, 22);
    y += 2;
    profiles.forEach((p, i) => {
      ui.text(p.title.toUpperCase(), keysX + (i * SLOTS + SLOTS / 2) * (kw + 4) - 2, y + 5, 8, PAL.ash, 'center', 800);
    });
    y += 11;
    for (const a of BINDABLE) {
      const ids = profiles.flatMap((p) => Array.from({ length: SLOTS }, (_, s) => `p:key:${p.key}:${a}:${s}`));
      const ink = this.row(ui, { x, y, w, h: rowH + 2 }, ids);
      this.label(ui, BIND_LABELS[a], x + 4, y + rowH / 2, keysX - x - 8, ink, 11);
      let k = 0;
      for (const p of profiles) {
        for (let slot = 0; slot < SLOTS; slot++, k++) {
          const listening = this.listening?.profile === p.key && this.listening.action === a && this.listening.slot === slot;
          const code = this.draft[p.key][a][slot];
          const id = ids[k];
          const label = `${BIND_LABELS[a]}, ${p.title} ${slot + 1}: ${listening ? 'press a key' : code ? keyName(code) : 'empty'}`;
          const r = { x: keysX + k * (kw + 4), y, w: kw, h: rowH };
          const press = () => (this.listening = { profile: p.key, action: a, slot });
          if (listening) {
            const pulse = Math.floor(ui.t * 3) % 2 === 0;
            ui.button(id, r, 'Press a Key', press, { style: pulse ? 'primary' : 'danger', size: 8.5, label });
          } else if (code) ui.button(id, r, '', press, { glyphs: [{ kind: 'key', label: capLabel(code) }], size: 11, label });
          else ui.button(id, r, 'Empty', press, { style: 'ghost', size: 9, label });
        }
      }
      y += rowH + 2;
    }
    y += 3;
    const tip = 'Select a slot, then press the new key.';
    const items: [Glyph, string][] = [
      [{ kind: 'key', label: '⌫' }, 'Clear'],
      [{ kind: 'key', label: 'Esc' }, 'Cancel'],
    ];
    ui.text(ui.fit(tip, w - 150, 9.5), x + 4, y + 8, 9.5, PAL.ash, 'left', 600);
    let px = x + w - 4;
    for (let i = items.length - 1; i >= 0; i--) {
      const [g, label] = items[i];
      px -= ui.measure(label, 10) + 2;
      ui.text(label, px, y + 8, 10, PAL.bone, 'left', 700);
      px -= ui.glyphsWidth([g], 14) + 4;
      ui.glyphs([g], px, y + 8, 14);
      px -= 12;
    }
    return y + 16;
  }

  /** A control sheet: the fixed bindings of an input that can't be remapped. */
  private bindSection(ui: Ui, x: number, y: number, w: number, rows: readonly BindRow[]): number {
    for (const r of rows) {
      const gw = ui.glyphsWidth(r.glyphs, 20, 6);
      this.label(ui, r.label, x + 4, y + this.rowH / 2, w - gw - 16, PAL.bone);
      ui.glyphs(r.glyphs, x + w - gw - 4, y + this.rowH / 2, 20, 6);
      y += this.rowH + 2;
    }
    return y;
  }
}
