import { VIEW_H, VIEW_W } from '../sim/constants';
import type { InputFrame } from '../sim/types';
import { type Action, BINDABLE, hint, type InputSettings, type KeyProfile, keyboardDevices, loadSettings, saveSettings } from './bindings';
import { TOUCH_DEVICE, TouchInput } from './touch';

interface PadPrev {
  jump: boolean;
  alt: boolean;
  down: boolean;
  use: boolean;
  start: boolean;
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
  /** Called on Escape and on a pad's Start. */
  onEscape: (() => void) | null = null;
  /** HUD hit-test for clicks on menu buttons. Returns a synthetic press, `true` if the click was consumed, or null. */
  hitTest: ((x: number, y: number) => UiPress | true | null) | null = null;
  /** Whether a plain left click (not on a HUD button) counts as "confirm" right now. Lobby: no. */
  clickConfirms: () => boolean = () => true;
  /** Whether right click and the wheel count as "alt" right now. Only for rotating: alt also self-destructs in a race. */
  mouseAlts: () => boolean = () => true;
  /** Element whose box maps to the 768×432 logical view. */
  viewEl: HTMLElement | null = null;

  private held = new Set<string>();
  private latched = new Set<string>();
  private padPrev = new Map<string, PadPrev>();
  private padsCaptured = false;
  private gameKeys = new Set<string>();
  private pointer: { x: number; y: number } | null = null;
  private pointerDirty = false;
  private click = false;
  private rclick = false;
  private ui: UiPress[] = [];
  /** Touch screen → the single 'touch' device (src/input/touch.ts). Touch pointers never reach the mouse path below. */
  readonly touch = new TouchInput();

  constructor(target: Window = window) {
    this.settings = loadSettings();
    this.rebuildKeySet();
    // --- touch wiring (mobile) ---
    this.touch.toView = (cx, cy) => this.toView(cx, cy);
    this.touch.onUiTap = (x, y) => this.touchUiTap(x, y);
    this.touch.attach(target, (e) => this.captured || !!(e.target as Element | null)?.closest?.('[data-slag-ui],.slag-ov'));
    target.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        this.onEscape?.();
        return;
      }
      if (this.captured) return;
      if (this.gameKeys.has(e.code)) {
        e.preventDefault();
        this.touch.setActive(false); // keyboard play hides the touch controls
      }
      if (e.repeat) return;
      this.held.add(e.code);
      this.latched.add(e.code);
    });
    target.addEventListener('keyup', (e) => {
      this.held.delete(e.code);
    });
    target.addEventListener('blur', () => this.held.clear());
    target.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return; // handled by this.touch
      if (e.pointerType === 'mouse' && (e.movementX || e.movementY)) this.touch.setActive(false);
      const p = this.toView(e.clientX, e.clientY);
      if (p) {
        this.pointer = p;
        this.pointerDirty = true;
      }
    });
    target.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return; // handled by this.touch
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
      if (e.button === 2) this.rclick = this.mouseAlts();
      else if (e.button === 0 && this.clickConfirms()) this.click = true;
    });
    target.addEventListener('contextmenu', (e) => e.preventDefault());
    target.addEventListener(
      'wheel',
      (e) => {
        if (!this.captured && Math.abs(e.deltaY) > 0) this.rclick = this.mouseAlts();
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

  /**
   * While a menu drives itself with the pads, they stop reaching the game. On release, whatever
   * is still held stops being a press, so the Ⓐ on Done can't also ready you up.
   */
  capturePads(on: boolean) {
    this.padsCaptured = on;
    if (on) return;
    for (const pad of connectedPads()) this.padPrev.set(`pad${pad.index}`, padButtons(pad));
  }

  /**
   * Lobby tap from touch: hit-test the HUD, retrying at small offsets so a
   * fingertip slightly off a small pill still lands (fat-finger slop, view px).
   */
  private touchUiTap(x: number, y: number): boolean {
    for (const [dx, dy] of TAP_SLOP_OFFSETS) {
      const hit = this.hitTest?.(x + dx, y + dy);
      if (hit === true) return true;
      if (hit) {
        this.ui.push(hit);
        return true;
      }
    }
    return false;
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

  /** Device that owns pointer-style UI (HUD join/ready/name buttons): 'touch' while touch is the active input, else the mouse's. */
  get pointerDevice(): string {
    return this.touch.active ? TOUCH_DEVICE : this.mouseDevice;
  }

  /** Key hints for a device (for HUD prompts). */
  hints(device: string): { confirm: string; alt: string; jump: string; down: string; use: string } {
    const kb = keyboardDevices(this.settings).find((d) => d.device === device);
    if (kb) {
      const p: KeyProfile = kb.profile;
      return { confirm: hint(p, 'confirm'), alt: hint(p, 'alt'), jump: hint(p, 'jump'), down: hint(p, 'down'), use: hint(p, 'use') };
    }
    if (device === TOUCH_DEVICE) return { confirm: 'tap', alt: 'ALT', jump: 'JUMP', down: '▼', use: 'USE' };
    return { confirm: 'A', alt: 'B', jump: 'A', down: '↓', use: 'Y' };
  }

  deviceLabel(device: string): string {
    const kb = keyboardDevices(this.settings).find((d) => d.device === device);
    if (kb) return kb.label;
    if (device.startsWith('pad')) return `Pad ${Number(device.slice(3)) + 1}`;
    if (device === TOUCH_DEVICE) return 'Touch';
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
          usePressed: pressed('use'),
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
    // Touch → the 'touch' device (one touch player per screen).
    if (this.captured) this.touch.reset();
    else out[TOUCH_DEVICE] = this.touch.sample();
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

    for (const pad of connectedPads()) {
      const id = `pad${pad.index}`;
      const btn = (i: number) => !!pad.buttons[i]?.pressed;
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      const now = padButtons(pad);
      const { jump, alt, down, use } = now;
      // X / RB / RT run; B / LB are alt (rotate, self-destruct); Y / LT use the held item.
      const run = btn(2) || btn(5) || (pad.buttons[7]?.value ?? 0) > 0.3;
      const prev = this.padPrev.get(id) ?? { jump: false, alt: false, down: false, use: false, start: false };
      this.padPrev.set(id, now);
      if (pad.buttons.some((b) => b.pressed) || Math.abs(ax) > 0.5 || Math.abs(ay) > 0.5) this.touch.setActive(false);
      if (this.padsCaptured) continue;
      if (now.start && !prev.start) this.onEscape?.();
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
        usePressed: use && !prev.use,
      };
    }
    return out;
  }
}

function connectedPads(): Gamepad[] {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  return [...pads].filter((p): p is Gamepad => !!p?.connected);
}

/** The pad buttons that count as presses, with their standard-mapping alternatives. */
function padButtons(pad: Gamepad): PadPrev {
  const btn = (i: number) => !!pad.buttons[i]?.pressed;
  return {
    jump: btn(0),
    alt: btn(1) || btn(4),
    down: (pad.axes[1] ?? 0) > 0.5 || btn(13),
    use: btn(3) || (pad.buttons[6]?.value ?? 0) > 0.3,
    start: btn(9),
  };
}

/** Fat-finger retries for lobby taps: exact point first, then a small ring (view px). */
const TAP_SLOP_OFFSETS: readonly [number, number][] = [
  [0, 0],
  [0, -5],
  [0, 5],
  [-6, 0],
  [6, 0],
  [-5, -5],
  [5, -5],
  [-5, 5],
  [5, 5],
  [0, -9],
  [0, 9],
];

function emptyFrame(): InputFrame {
  return { left: false, right: false, up: false, down: false, jump: false, jumpPressed: false, confirmPressed: false, altPressed: false, downPressed: false };
}
