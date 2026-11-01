import type { InputFrame } from '../sim/types';

interface KeyScheme {
  label: string;
  left: string[];
  right: string[];
  up: string[];
  down: string[];
  jump: string[];
  confirm: string[];
  alt: string[];
}

/** Two players can share one keyboard. */
export const KEY_SCHEMES: Record<string, KeyScheme> = {
  kb1: {
    label: 'WASD',
    left: ['KeyA'],
    right: ['KeyD'],
    up: ['KeyW'],
    down: ['KeyS'],
    jump: ['Space', 'KeyW'],
    confirm: ['Space'],
    alt: ['KeyQ', 'KeyE'],
  },
  kb2: {
    label: 'Arrows',
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    jump: ['ArrowUp', 'Enter', 'Slash'],
    confirm: ['Enter', 'Slash'],
    alt: ['Period', 'ShiftRight'],
  },
};

const GAME_KEYS = new Set(Object.values(KEY_SCHEMES).flatMap((s) => [...s.left, ...s.right, ...s.up, ...s.down, ...s.jump, ...s.confirm, ...s.alt]));

interface PadPrev {
  jump: boolean;
  alt: boolean;
  down: boolean;
}

/**
 * Collects raw keyboard/gamepad state and turns it into one InputFrame per
 * device per sim step. Key presses are latched so taps shorter than a frame
 * still register.
 */
export class InputManager {
  private held = new Set<string>();
  private latched = new Set<string>();
  private padPrev = new Map<string, PadPrev>();

  constructor(target: Window = window) {
    target.addEventListener('keydown', (e) => {
      if (GAME_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.held.add(e.code);
      this.latched.add(e.code);
    });
    target.addEventListener('keyup', (e) => {
      this.held.delete(e.code);
    });
    target.addEventListener('blur', () => this.held.clear());
  }

  sample(): Record<string, InputFrame> {
    const out: Record<string, InputFrame> = {};
    const anyHeld = (codes: string[]) => codes.some((c) => this.held.has(c));
    const anyPressed = (codes: string[]) => codes.some((c) => this.latched.has(c));
    for (const [id, s] of Object.entries(KEY_SCHEMES)) {
      out[id] = {
        left: anyHeld(s.left),
        right: anyHeld(s.right),
        up: anyHeld(s.up),
        down: anyHeld(s.down),
        jump: anyHeld(s.jump),
        jumpPressed: anyPressed(s.jump),
        confirmPressed: anyPressed(s.confirm),
        altPressed: anyPressed(s.alt),
        downPressed: anyPressed(s.down),
      };
    }
    this.latched.clear();

    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      const id = `pad${pad.index}`;
      const btn = (i: number) => !!pad.buttons[i]?.pressed;
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      const jump = btn(0);
      const alt = btn(1) || btn(2) || btn(4) || btn(5);
      const down = ay > 0.5 || btn(13);
      const prev = this.padPrev.get(id) ?? { jump: false, alt: false, down: false };
      out[id] = {
        left: ax < -0.4 || btn(14),
        right: ax > 0.4 || btn(15),
        up: ay < -0.5 || btn(12),
        down,
        jump,
        jumpPressed: jump && !prev.jump,
        confirmPressed: jump && !prev.jump,
        altPressed: alt && !prev.alt,
        downPressed: down && !prev.down,
      };
      this.padPrev.set(id, { jump, alt, down });
    }
    return out;
  }
}

export function deviceLabel(device: string): string {
  if (KEY_SCHEMES[device]) return KEY_SCHEMES[device].label;
  if (device.startsWith('pad')) return `Pad ${Number(device.slice(3)) + 1}`;
  return device;
}

export function deviceHints(device: string): { confirm: string; alt: string; jump: string } {
  if (device === 'kb1') return { confirm: 'SPACE', alt: 'Q/E', jump: 'SPACE/W' };
  if (device === 'kb2') return { confirm: 'ENTER', alt: '.', jump: '↑/ENTER' };
  return { confirm: 'A', alt: 'B/X', jump: 'A' };
}
