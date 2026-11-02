/**
 * Keyboard bindings and local input settings. Client-side only (never part
 * of the deterministic sim); persisted to localStorage.
 *
 * Default: one keyboard player who can use WASD *and* arrows (plus mouse in
 * menus). "Split keyboard" turns the keyboard into two local players.
 */

export const BINDABLE = ['left', 'right', 'up', 'down', 'jump', 'confirm', 'alt'] as const;
export type Action = (typeof BINDABLE)[number];

export const ACTION_LABELS: Record<Action, string> = {
  left: 'Move left',
  right: 'Move right',
  up: 'Up / aim',
  down: 'Down / drop',
  jump: 'Jump',
  confirm: 'Confirm / pick',
  alt: 'Rotate / alt',
};

/** Up to two KeyboardEvent.code values per action. */
export type KeyProfile = Record<Action, string[]>;

export interface InputSettings {
  version: 1;
  splitKeyboard: boolean;
  /** Used when splitKeyboard is off. */
  single: KeyProfile;
  /** Used when splitKeyboard is on (device kb1 / kb2). */
  left: KeyProfile;
  right: KeyProfile;
}

export const SLOTS = 2;

export function defaultSettings(): InputSettings {
  return {
    version: 1,
    splitKeyboard: false,
    single: {
      left: ['KeyA', 'ArrowLeft'],
      right: ['KeyD', 'ArrowRight'],
      up: ['KeyW', 'ArrowUp'],
      down: ['KeyS', 'ArrowDown'],
      jump: ['Space', 'KeyK'],
      confirm: ['Enter', 'Space'],
      alt: ['KeyR', 'KeyQ'],
    },
    left: {
      left: ['KeyA'],
      right: ['KeyD'],
      up: ['KeyW'],
      down: ['KeyS'],
      jump: ['Space', 'KeyW'],
      confirm: ['Space'],
      alt: ['KeyQ', 'KeyE'],
    },
    right: {
      left: ['ArrowLeft'],
      right: ['ArrowRight'],
      up: ['ArrowUp'],
      down: ['ArrowDown'],
      jump: ['ArrowUp', 'Slash'],
      confirm: ['Enter', 'Slash'],
      alt: ['Period', 'ShiftRight'],
    },
  };
}

const KEY = 'slag.input.v1';

export function loadSettings(): InputSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as InputSettings;
      if (s.version === 1 && s.single && s.left && s.right) return { ...defaultSettings(), ...s };
    }
  } catch {
    // Private mode / blocked storage: fall back to defaults.
  }
  return defaultSettings();
}

export function saveSettings(s: InputSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Non-fatal.
  }
}

/** Active keyboard devices and their profiles under these settings. */
export function keyboardDevices(s: InputSettings): { device: string; profile: KeyProfile; label: string }[] {
  return s.splitKeyboard
    ? [
        { device: 'kb1', profile: s.left, label: 'Keys A' },
        { device: 'kb2', profile: s.right, label: 'Keys B' },
      ]
    : [{ device: 'kb1', profile: s.single, label: 'Keyboard' }];
}

/** Pretty name for a KeyboardEvent.code. */
export function keyName(code: string | undefined): string {
  if (!code) return '—';
  const map: Record<string, string> = {
    Space: 'Space',
    Enter: 'Enter',
    ShiftLeft: 'L-Shift',
    ShiftRight: 'R-Shift',
    ControlLeft: 'L-Ctrl',
    ControlRight: 'R-Ctrl',
    AltLeft: 'L-Alt',
    AltRight: 'R-Alt',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    Slash: '/',
    Period: '.',
    Comma: ',',
    Semicolon: ';',
    Quote: "'",
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Tab: 'Tab',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

/** Short hint like "Space/Enter" for an action, for HUD prompts. */
export function hint(p: KeyProfile, a: Action): string {
  return p[a].filter(Boolean).map(keyName).join('/') || '—';
}
