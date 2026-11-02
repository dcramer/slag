import type { AudioSystem } from '../audio';
import { type MatchRules, RULE_CHOICES } from '../game/rules';
import { ACTION_LABELS, BINDABLE, defaultSettings, type InputSettings, type KeyProfile, keyName, SLOTS } from '../input/bindings';
import type { InputManager } from '../input/input';
import { sanitizeName } from './profile';

/**
 * DOM overlays for menus that need real text input or dense forms:
 * controls/audio settings, match rules, and the name prompt. They sit on
 * top of the game canvas, capture input while open, and persist through
 * the callbacks they're given (localStorage lives in the owners).
 */

const CSS = `
.slag-ov{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(6,5,10,.72);backdrop-filter:blur(3px);z-index:10;font:500 14px Rubik,system-ui,sans-serif;color:#eee}
.slag-card{background:linear-gradient(#1e1b2c,#120f1b);border:1px solid rgba(255,170,90,.35);border-radius:16px;padding:20px 24px;min-width:min(520px,92vw);max-width:94vw;max-height:90vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.6)}
.slag-card h2{font:400 30px "Lilita One",system-ui,sans-serif;margin:0 0 12px;color:#ffb02e;letter-spacing:.5px}
.slag-card h3{font:700 12px Rubik,system-ui;text-transform:uppercase;letter-spacing:1.5px;color:#9a93ad;margin:18px 0 8px}
.slag-row{display:flex;align-items:center;gap:10px;margin:6px 0}
.slag-row label{flex:1;color:#ddd}
.slag-btn{font:700 13px Rubik,system-ui;color:#fff;background:#2c2840;border:1px solid rgba(255,255,255,.14);border-radius:9px;padding:7px 12px;cursor:pointer;min-width:64px}
.slag-btn:hover{background:#3a3555;border-color:rgba(255,170,90,.6)}
.slag-btn.primary{background:linear-gradient(#ff9a2e,#e2561c);border-color:#ffb46a}
.slag-btn.on{background:#2f7d3c;border-color:#7fe08f}
.slag-btn.listen{background:#7a2d8e;border-color:#e08fff;animation:slagpulse .8s infinite alternate}
@keyframes slagpulse{to{filter:brightness(1.4)}}
.slag-grid{display:grid;gap:6px 10px;align-items:center}
.slag-grid .h{font:700 11px Rubik;color:#9a93ad;text-transform:uppercase;letter-spacing:1px}
.slag-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}
.slag-input{font:600 20px Rubik,system-ui;background:#0d0b14;color:#fff;border:1px solid rgba(255,170,90,.5);border-radius:10px;padding:10px 12px;width:100%;box-sizing:border-box;outline:none}
.slag-input:focus{border-color:#ffb02e;box-shadow:0 0 0 3px rgba(255,160,40,.25)}
.slag-note{color:#9a93ad;font-size:12px;margin-top:6px}
input[type=range].slag-range{flex:1.2;accent-color:#ff9a2e}
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

/** Controls (remapping, split keyboard) + audio volumes. */
export class SettingsMenu extends Overlay {
  private draft!: InputSettings;
  private listening: { profile: keyof Pick<InputSettings, 'single' | 'left' | 'right'>; action: (typeof BINDABLE)[number]; slot: number } | null = null;
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);

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

  private render() {
    const card = el('div', { className: 'slag-card' }, el('h2', { textContent: 'Settings' }));
    // Audio.
    card.append(el('h3', { textContent: 'Audio' }));
    for (const k of ['master', 'music', 'sfx'] as const) {
      const range = el('input', { type: 'range', min: '0', max: '1', step: '0.05', className: 'slag-range' });
      range.value = String(this.audio.volumes[k]);
      range.oninput = () => this.audio.setVolumes({ [k]: Number(range.value) });
      card.append(el('div', { className: 'slag-row' }, el('label', { textContent: k === 'sfx' ? 'Effects' : k[0].toUpperCase() + k.slice(1) }), range));
    }
    // Controls.
    card.append(el('h3', { textContent: 'Keyboard & mouse' }));
    const split = el('button', { className: `slag-btn ${this.draft.splitKeyboard ? 'on' : ''}`, textContent: this.draft.splitKeyboard ? 'On' : 'Off' });
    split.onclick = () => {
      this.draft.splitKeyboard = !this.draft.splitKeyboard;
      this.input.apply(this.draft);
      this.render();
    };
    card.append(el('div', { className: 'slag-row' }, el('label', { textContent: 'Split keyboard (two players on one keyboard)' }), split));
    const profiles: { key: 'single' | 'left' | 'right'; title: string }[] = this.draft.splitKeyboard
      ? [
          { key: 'left', title: 'Keys A' },
          { key: 'right', title: 'Keys B' },
        ]
      : [{ key: 'single', title: 'Keyboard' }];
    const cols = profiles.length * SLOTS;
    const grid = el('div', { className: 'slag-grid' });
    grid.style.gridTemplateColumns = `minmax(120px,1fr) repeat(${cols}, minmax(70px, auto))`;
    grid.append(el('div'));
    for (const p of profiles) {
      const h = el('div', { className: 'h', textContent: p.title });
      h.style.gridColumn = `span ${SLOTS}`;
      grid.append(h);
    }
    for (const a of BINDABLE) {
      grid.append(el('div', { textContent: ACTION_LABELS[a] }));
      for (const p of profiles) {
        for (let slot = 0; slot < SLOTS; slot++) {
          const listening = this.listening?.profile === p.key && this.listening.action === a && this.listening.slot === slot;
          const b = el('button', {
            className: `slag-btn ${listening ? 'listen' : ''}`,
            textContent: listening ? 'press…' : keyName(this.draft[p.key][a][slot]),
          });
          b.onclick = () => {
            this.listening = { profile: p.key, action: a, slot };
            this.render();
          };
          grid.append(b);
        }
      }
    }
    card.append(grid);
    card.append(
      el('div', {
        className: 'slag-note',
        textContent:
          'Click a slot, then press a key. Backspace clears, Esc cancels. Mouse: move/left-click to pick & place, right-click or wheel to rotate. Gamepads: stick/d-pad, A = jump/confirm, B/X/bumpers = rotate.',
      }),
    );
    const reset = el('button', { className: 'slag-btn', textContent: 'Reset controls' });
    reset.onclick = () => {
      this.draft = { ...defaultSettings(), splitKeyboard: this.draft.splitKeyboard };
      this.input.apply(this.draft);
      this.render();
    };
    const done = el('button', { className: 'slag-btn primary', textContent: 'Done' });
    done.onclick = () => this.close();
    card.append(el('div', { className: 'slag-actions' }, reset, done));
    if (this.root) {
      this.root.replaceChildren(card);
    } else this.mount(card);
  }
}

const RULE_LABELS: Record<keyof MatchRules, string> = {
  targetScore: 'Points to win',
  pickSeconds: 'Pick timer',
  placeSeconds: 'Place timer',
  raceSeconds: 'Race timer',
};

/** Match rules ("level settings"); applied when the next match starts. */
export class RulesMenu extends Overlay {
  open(rules: MatchRules, onChange: (r: MatchRules) => void) {
    const draft = { ...rules };
    const card = el('div', { className: 'slag-card' }, el('h2', { textContent: 'Level settings' }));
    for (const k of Object.keys(RULE_CHOICES) as (keyof MatchRules)[]) {
      const row = el('div', { className: 'slag-row' }, el('label', { textContent: RULE_LABELS[k] }));
      for (const v of RULE_CHOICES[k]) {
        const b = el('button', {
          className: `slag-btn ${draft[k] === v ? 'on' : ''}`,
          textContent: k === 'targetScore' ? String(v) : v === 0 ? 'Off' : `${v}s`,
        });
        b.onclick = () => {
          draft[k] = v;
          onChange({ ...draft });
          for (const sib of row.querySelectorAll('button')) sib.classList.toggle('on', sib === b);
        };
        row.append(b);
      }
      card.append(row);
    }
    card.append(el('div', { className: 'slag-note', textContent: 'More variations coming. Settings are saved on this device.' }));
    const done = el('button', { className: 'slag-btn primary', textContent: 'Done' });
    done.onclick = () => this.close();
    card.append(el('div', { className: 'slag-actions' }, done));
    this.mount(card);
  }
}

/** "What should we call you?" with a one-click keep-random option. */
export class NamePrompt extends Overlay {
  open(randomName: string, current: string | null, onDone: (name: string | null) => void) {
    const input = el('input', { className: 'slag-input', value: current ?? randomName, maxLength: 12, placeholder: randomName });
    const finish = (name: string | null) => {
      onDone(name);
      this.close();
    };
    const ok = el('button', { className: 'slag-btn primary', textContent: "That's me" });
    ok.onclick = () => finish(sanitizeName(input.value) || null);
    const keep = el('button', { className: 'slag-btn', textContent: `🎲 Keep "${randomName}"` });
    keep.onclick = () => finish(null);
    input.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') ok.click();
    };
    const card = el(
      'div',
      { className: 'slag-card' },
      el('h2', { textContent: 'What should we call you?' }),
      input,
      el('div', { className: 'slag-note', textContent: 'Up to 12 characters. You can change it any time by clicking your name in the lobby.' }),
      el('div', { className: 'slag-actions' }, keep, ok),
    );
    this.mount(card);
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }
}
