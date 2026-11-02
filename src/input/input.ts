import { VIEW_H, VIEW_W } from '../sim/constants';
import type { InputFrame } from '../sim/types';
import { type Action, BINDABLE, hint, type InputSettings, type KeyProfile, keyboardDevices, loadSettings, saveSettings } from './bindings';

interface PadPrev {
  jump: boolean;
  alt: boolean;
  down: boolean;
}

/** A synthetic press produced by clicking a HUD button. */
export interface UiPress {
  device: string;
  confirm?: boolean;
  alt?: boolean;
  down?: boolean;
}

/**
 * Collects raw keyboard/mouse/gamepad state and turns it into one InputFrame
 * per device per sim step. Key presses are latched so taps shorter than a
 * frame still register. The mouse belongs to the first keyboard device.
 */
export class InputManager {
  settings: InputSettings;
  /** When set, keyboard/mouse are captured by a UI overlay (settings, name entry) and not fed to the game. */
  captured = false;
  /** Called on Escape. */
  onEscape: (() => void) | null = null;
  /** HUD hit-test for clicks on menu buttons. Returns a synthetic press, `true` if the click was consumed, or null. */
  hitTest: ((x: number, y: number) => UiPress | true | null) | null = null;
  /** Whether a plain left click (not on a HUD button) counts as "confirm" right now. Lobby: no. */
  clickConfirms: () => boolean = () => true;
  /** Element whose box maps to the 768×432 logical view. */
  viewEl: HTMLElement | null = null;

  private held = new Set<string>();
  private latched = new Set<string>();
  private padPrev = new Map<string, PadPrev>();
  private gameKeys = new Set<string>();
  private pointer: { x: number; y: number } | null = null;
  private pointerDirty = false;
  private click = false;
  private rclick = false;
  private ui: UiPress[] = [];

  constructor(target: Window = window) {
    this.settings = loadSettings();
    this.rebuildKeySet();
    target.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        this.onEscape?.();
        return;
      }
      if (this.captured) return;
      if (this.gameKeys.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.held.add(e.code);
      this.latched.add(e.code);
    });
    target.addEventListener('keyup', (e) => {
      this.held.delete(e.code);
    });
    target.addEventListener('blur', () => this.held.clear());
    target.addEventListener('pointermove', (e) => {
      const p = this.toView(e.clientX, e.clientY);
      if (p) {
        this.pointer = p;
        this.pointerDirty = true;
      }
    });
    target.addEventListener('pointerdown', (e) => {
      const p = this.toView(e.clientX, e.clientY);
      if (!p) return;
      this.pointer = p;
      this.pointerDirty = true;
      if (e.button === 0) {
        const hit = this.hitTest?.(p.x, p.y);
        if (hit === true) return;
        if (hit) {
          this.ui.push(hit);
          return;
        }
      }
      if (this.captured) return;
      if (e.button === 2) this.rclick = true;
      else if (e.button === 0 && this.clickConfirms()) this.click = true;
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener(
      'wheel',
      (e) => {
        if (!this.captured && Math.abs(e.deltaY) > 0) this.rclick = true;
      },
      { passive: true },
    );
  }

  /** Persist and apply new settings. */
  apply(s: InputSettings) {
    this.settings = s;
    saveSettings(s);
    this.rebuildKeySet();
    this.held.clear();
  }

  private rebuildKeySet() {
    this.gameKeys = new Set(keyboardDevices(this.settings).flatMap((d) => BINDABLE.flatMap((a) => d.profile[a])));
  }

  private toView(cx: number, cy: number): { x: number; y: number } | null {
    const el = this.viewEl;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    return { x: ((cx - r.left) / r.width) * VIEW_W, y: ((cy - r.top) / r.height) * VIEW_H };
  }

  /** Latest pointer position in view coords (for drawing hover states). */
  get pointerPos() {
    return this.pointer;
  }

  /** Device the mouse belongs to. */
  get mouseDevice(): string {
    return keyboardDevices(this.settings)[0].device;
  }

  /** Key hints for a device (for HUD prompts). */
  hints(device: string): { confirm: string; alt: string; jump: string; down: string } {
    const kb = keyboardDevices(this.settings).find((d) => d.device === device);
    if (kb) {
      const p: KeyProfile = kb.profile;
      return { confirm: hint(p, 'confirm'), alt: hint(p, 'alt'), jump: hint(p, 'jump'), down: hint(p, 'down') };
    }
    return { confirm: 'A', alt: 'B/Y', jump: 'A', down: '↓' };
  }

  deviceLabel(device: string): string {
    const kb = keyboardDevices(this.settings).find((d) => d.device === device);
    if (kb) return kb.label;
    if (device.startsWith('pad')) return `Pad ${Number(device.slice(3)) + 1}`;
    return device;
  }

  sample(): Record<string, InputFrame> {
    const out: Record<string, InputFrame> = {};
    if (!this.captured) {
      for (const { device, profile } of keyboardDevices(this.settings)) {
        const held = (a: Action) => profile[a].some((c) => this.held.has(c));
        const pressed = (a: Action) => profile[a].some((c) => this.latched.has(c));
        out[device] = {
          left: held('left'),
          right: held('right'),
          up: held('up'),
          down: held('down'),
          jump: held('jump'),
          jumpPressed: pressed('jump'),
          run: held('run'),
          confirmPressed: pressed('confirm'),
          altPressed: pressed('alt'),
          downPressed: pressed('down'),
        };
      }
      // Mouse → first keyboard device.
      const f = out[this.mouseDevice];
      if (f) {
        if (this.pointerDirty && this.pointer) f.pointer = { x: this.pointer.x, y: this.pointer.y };
        if (this.click) f.confirmPressed = true;
        if (this.rclick) f.altPressed = true;
      }
    }
    for (const u of this.ui) {
      const t = out[u.device] ?? (out[u.device] = emptyFrame());
      if (u.confirm) t.confirmPressed = true;
      if (u.alt) t.altPressed = true;
      if (u.down) t.downPressed = true;
    }
    this.latched.clear();
    this.pointerDirty = false;
    this.click = false;
    this.rclick = false;
    this.ui = [];

    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      const id = `pad${pad.index}`;
      const btn = (i: number) => !!pad.buttons[i]?.pressed;
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      const jump = btn(0);
      // X / RB / RT run; B / Y / LB are alt (rotate, self-destruct).
      const run = btn(2) || btn(5) || (pad.buttons[7]?.value ?? 0) > 0.3;
      const alt = btn(1) || btn(3) || btn(4);
      const down = ay > 0.5 || btn(13);
      const prev = this.padPrev.get(id) ?? { jump: false, alt: false, down: false };
      out[id] = {
        left: ax < -0.4 || btn(14),
        right: ax > 0.4 || btn(15),
        up: ay < -0.5 || btn(12),
        down,
        jump,
        run,
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

function emptyFrame(): InputFrame {
  return { left: false, right: false, up: false, down: false, jump: false, jumpPressed: false, confirmPressed: false, altPressed: false, downPressed: false };
}
