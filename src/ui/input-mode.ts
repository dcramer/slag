import type { InputMode } from './prompts';

/**
 * Tracks which kind of input the local person used last (keyboard/mouse,
 * gamepad or touch) and whether any gamepad is plugged in, so prompts can
 * show the right glyphs. Presentation only; never feeds the sim.
 */
export class InputModeTracker {
  mode: InputMode = 'keyboard';
  /** Connected gamepads as of the last update(). */
  pads = 0;
  /** Whether the keyboard/mouse has been used at all this session. */
  keyboardSeen = false;
  private padSig = new Map<number, string>();

  constructor(target: Window = window) {
    target.addEventListener('keydown', () => this.set('keyboard'), true);
    target.addEventListener('pointerdown', (e) => this.set(e.pointerType === 'touch' || e.pointerType === 'pen' ? 'touch' : 'keyboard'), true);
    target.addEventListener('pointermove', (e) => e.pointerType === 'mouse' && (e.movementX || e.movementY) && this.set('keyboard'), true);
    if (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) this.mode = 'touch';
  }

  private set(m: InputMode) {
    this.mode = m;
    if (m === 'keyboard') this.keyboardSeen = true;
  }

  /** Poll gamepads (call once per frame): any button/stick change switches to gamepad mode. */
  update() {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    let n = 0;
    for (const p of pads) {
      if (!p || !p.connected) continue;
      n++;
      const sig = p.buttons.map((b) => (b.pressed ? 1 : 0)).join('') + p.axes.map((a) => (Math.abs(a) > 0.5 ? Math.sign(a) : 0)).join('');
      const prev = this.padSig.get(p.index);
      if (prev !== undefined && prev !== sig) this.set('gamepad');
      this.padSig.set(p.index, sig);
    }
    this.pads = n;
  }
}
