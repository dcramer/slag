import type { AudioSystem } from '../audio';
import { GRAVITY_CHOICES, gravityLabel, MATCH_LENGTHS, type MatchRules, RULE_CHOICES, type TimerRule } from '../game/rules';
import { BINDABLE, defaultSettings, type InputSettings, type KeyProfile, keyName, SLOTS } from '../input/bindings';
import type { InputManager } from '../input/input';
import { type RenderStyle, STYLE_IDS, STYLES } from '../render/style';
import { glyphSVG, type Glyph } from './glyphs';
import { capLabel } from './prompts';
import { sanitizeName } from './profile';
import { FONT, PAL } from './style';
import type { QualityTier } from './touch/device';

/** Graphics quality hook (game-client wires it to the renderer). `null` = automatic. */
export interface QualityControl {
  /** The pinned tier, or null when automatic. */
  pinned(): QualityTier | null;
  set(tier: QualityTier | null): void;
}

/** Art style hook (game-client wires it to the renderer). */
export interface StyleControl {
  get(): RenderStyle;
  set(style: RenderStyle): void;
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

/** Controls (remapping, split keyboard) + audio volumes. */
export class SettingsMenu extends Overlay {
  private draft!: InputSettings;
  private listening: { profile: keyof Pick<InputSettings, 'single' | 'left' | 'right'>; action: (typeof BINDABLE)[number]; slot: number } | null = null;
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);
  /** When set, the menu shows a "Leave Lobby" button that calls it. */
  leave: (() => void) | null = null;
  /** When set, the menu shows a graphics-quality picker. */
  quality: QualityControl | null = null;
  /** When set, the menu shows an art-style picker. */
  artStyle: StyleControl | null = null;

  constructor(
    input: InputManager,
    private audio: AudioSystem,
  ) {
    super(input);
  }

  open() {
    this.draft = structuredClone(this.input.settings);
    this.render();
    window.addEventListener('keydown', this.keyHandler, true);
  }

  override close() {
    window.removeEventListener('keydown', this.keyHandler, true);
    this.listening = null;
    super.close();
  }

  private onKey(e: KeyboardEvent) {
    if (!this.listening) return;
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
    card.append(el('h3', { textContent: 'Audio' }));
    const muted = !!this.audio.volumes.muted;
    const sw = el('button', { className: 'slag-switch', type: 'button' });
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-checked', String(muted));
    sw.setAttribute('aria-label', 'Mute all sound');
    const ranges: HTMLInputElement[] = [];
    sw.onclick = () => {
      const on = !this.audio.volumes.muted;
      this.audio.setVolumes({ muted: on });
      sw.setAttribute('aria-checked', String(on));
      for (const r of ranges) r.disabled = on;
    };
    card.append(el('div', { className: 'slag-row' }, el('span', { className: 'lbl wide', textContent: 'Mute All Sound' }), sw));
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
    return el('div', { className: 'slag-row' }, el('span', { className: 'lbl wide', textContent: label }), sw);
  }

  private touchSection(card: HTMLElement) {
    card.append(el('h3', { textContent: 'Touch' }));
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

  private displaySection(card: HTMLElement, q: QualityControl) {
    card.append(el('h3', { textContent: 'Graphics Quality' }));
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
    card.append(chips);
  }

  private styleSection(card: HTMLElement, c: StyleControl) {
    card.append(el('h3', { textContent: 'Art Style' }));
    const chips = el('div', { className: 'slag-chips' });
    for (const style of STYLE_IDS) {
      const b = el('button', { className: `slag-btn ${c.get() === style ? 'on' : ''}`, type: 'button', textContent: STYLES[style].label });
      b.onclick = () => {
        c.set(style);
        for (const sib of chips.querySelectorAll('button')) sib.classList.toggle('on', sib === b);
      };
      chips.append(b);
    }
    card.append(chips);
  }

  private controlsSection(card: HTMLElement) {
    card.append(el('h3', { textContent: 'Keyboard' }));
    const split = el('button', { className: 'slag-switch', type: 'button' });
    split.setAttribute('role', 'switch');
    split.setAttribute('aria-checked', String(this.draft.splitKeyboard));
    split.setAttribute('aria-label', 'Split keyboard');
    split.onclick = () => {
      this.draft.splitKeyboard = !this.draft.splitKeyboard;
      this.input.apply(this.draft);
      this.render();
    };
    card.append(el('div', { className: 'slag-row' }, el('span', { className: 'lbl wide', textContent: 'Split Keyboard (Two Players)' }), split));
    const profiles: { key: 'single' | 'left' | 'right'; title: string }[] = this.draft.splitKeyboard
      ? [
          { key: 'left', title: 'Player A' },
          { key: 'right', title: 'Player B' },
        ]
      : [{ key: 'single', title: 'Keys' }];
    const cols = profiles.length * SLOTS;
    const grid = el('div', { className: 'slag-grid' });
    grid.style.gridTemplateColumns = `minmax(110px,1fr) repeat(${cols}, auto)`;
    grid.append(el('div'));
    for (const p of profiles) {
      const h = el('div', { className: 'h', textContent: p.title });
      h.style.gridColumn = `span ${SLOTS}`;
      grid.append(h);
    }
    for (const a of BINDABLE) {
      grid.append(el('div', { textContent: BIND_LABELS[a] }));
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
          grid.append(b);
        }
      }
    }
    card.append(grid);
    card.append(el('div', { className: 'slag-note', textContent: 'Select a slot, then press the new key.' }));
    card.append(
      promptRow([
        { glyphs: [{ kind: 'key', label: '⌫' }], label: 'Clear' },
        { glyphs: [{ kind: 'key', label: 'Esc' }], label: 'Cancel' },
      ]),
    );
    card.append(el('h3', { textContent: 'Mouse' }));
    card.append(
      promptRow([
        { glyphs: [{ kind: 'mouse', button: 'left' }], label: 'Pick / Place' },
        {
          glyphs: [
            { kind: 'mouse', button: 'right' },
            { kind: 'mouse', button: 'wheel' },
          ],
          label: 'Rotate',
        },
      ]),
    );
    card.append(el('h3', { textContent: 'Gamepad' }));
    card.append(
      promptRow([
        {
          glyphs: [
            { kind: 'pad', button: 'LS' },
            { kind: 'pad', button: 'DPAD' },
          ],
          label: 'Move',
        },
        { glyphs: [{ kind: 'pad', button: 'A' }], label: 'Jump / Confirm' },
        {
          glyphs: [
            { kind: 'pad', button: 'X' },
            { kind: 'pad', button: 'RB' },
          ],
          label: 'Run',
        },
        {
          glyphs: [
            { kind: 'pad', button: 'Y' },
            { kind: 'pad', button: 'LT' },
          ],
          label: 'Use Item',
        },
        {
          glyphs: [
            { kind: 'pad', button: 'B' },
            { kind: 'pad', button: 'LB' },
          ],
          label: 'Rotate / Self-Destruct',
        },
      ]),
    );
  }

  private render() {
    const card = el('div', { className: 'slag-card' }, el('h2', { textContent: 'Settings' }));
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Settings');
    this.audioSection(card);
    // Under touch the key-rebind grid is noise: show the touch options instead.
    if (this.input.touch.active) this.touchSection(card);
    if (this.quality) this.displaySection(card, this.quality);
    if (this.artStyle) this.styleSection(card, this.artStyle);
    if (!this.input.touch.active) this.controlsSection(card);
    const reset = el('button', { className: 'slag-btn', type: 'button', textContent: 'Reset Controls' });
    reset.hidden = this.input.touch.active;
    reset.onclick = () => {
      this.draft = { ...defaultSettings(), splitKeyboard: this.draft.splitKeyboard };
      this.input.apply(this.draft);
      this.render();
    };
    const done = el('button', { className: 'slag-btn primary', type: 'button', textContent: 'Done' });
    done.onclick = () => this.close();
    const actions = el('div', { className: 'slag-actions' });
    if (this.leave) {
      const leave = el('button', { className: 'slag-btn danger', type: 'button', textContent: 'Leave Lobby' });
      leave.onclick = () => this.leave?.();
      actions.append(leave, el('span', { className: 'grow' }));
    }
    actions.append(reset, done);
    card.append(actions);
    if (this.root) {
      const scroll = this.root.querySelector('.slag-card')?.scrollTop ?? 0;
      this.root.replaceChildren(card);
      card.scrollTop = scroll;
    } else this.mount(card);
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
    const card = el('div', { className: 'slag-card' }, el('h2', { textContent: 'Match Rules' }));
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
