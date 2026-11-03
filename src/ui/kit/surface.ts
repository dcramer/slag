import { connectedPads } from '../../input/input';
import { KEY_ACTIONS, type MenuAction, MenuPadReader, readMenuPad } from '../settings-nav';
import { isTouchFirst, safeInsets } from '../touch/device';
import type { Control, Rect, Ui } from './ui';

/**
 * Where a canvas menu meets the browser: one window-sized canvas over the game, a frame loop, and every
 * input turned into the kit's calls (pointer, wheel, keys, pads). The only DOM a menu touches; a host
 * without one drives a `Ui` the same way from its own window and events.
 *
 * Units: the canvas lays out in units of `unit` CSS px, the HUD's own scale (768 across a window that
 * shows the play view whole), but never smaller than the HUD lets type get on a phone. A phone gets a
 * smaller space to lay out in, not smaller type.
 */

export interface MenuHost {
  /** Lay out and draw one frame. */
  draw(ui: Ui): void;
  /** What the kit leaves to the menu: back, the tab keys. */
  act(a: MenuAction): void;
  /** Every key before anything else reads it. True: taken (a key being bound). */
  key?(e: KeyboardEvent): boolean;
  /** Takes every action itself for now, the arrows and confirm too (a key being bound). */
  busy?(): boolean;
}

/** What the tools read and press instead of DOM selectors (`window.slagUi`). */
export interface UiProbe {
  menu: string;
  controls(): { id: string; label: string; x: number; y: number; w: number; h: number; disabled: boolean; on?: boolean; value?: number; selected: boolean }[];
  /** How far each scroll view can scroll, in CSS px (0: its page fits). */
  overflow(id: string): number;
}

const MIN_UNIT_TOUCH = 1.4;
const MIN_UNIT = 1.1;
/** Thumb-sized targets on touch, in CSS px. */
const TAP_CSS = 44;

export class MenuSurface {
  readonly canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private raf = 0;
  private life = new AbortController();
  private pads: MenuPadReader;
  /**
   * A press waits for its click: a press that closes the menu on pointerup would take the canvas away,
   * and the click after it would land on whatever was under the menu (the touch overlay's buttons).
   */
  private tapped: Control | undefined;
  private unit = 1;
  private t0 = performance.now();
  /** Safe-area insets in CSS px, read again only when the window changes size (a rotation). */
  private insets = { key: '', top: 0, right: 0, bottom: 0, left: 0 };
  /** Focus goes back where it was when the menu closes (the main menu's Settings button). */
  private refocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  constructor(
    readonly name: string,
    private host: MenuHost,
    readonly ui: Ui,
  ) {
    const cv = this.canvas;
    cv.dataset.slagUi = '';
    cv.dataset.slagMenu = name;
    cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:10;touch-action:none;display:block';
    document.body.appendChild(cv);
    const on = { signal: this.life.signal };
    const pt = (e: PointerEvent | WheelEvent) => ({ x: e.clientX / this.unit, y: e.clientY / this.unit });
    cv.addEventListener(
      'pointerdown',
      (e) => {
        ui.mode = e.pointerType === 'touch' ? 'touch' : 'keyboard';
        this.tapped = undefined;
        cv.setPointerCapture?.(e.pointerId);
        const p = pt(e);
        if (e.button === 0 && !ui.pointerDown(p.x, p.y)) host.act('back');
      },
      on,
    );
    cv.addEventListener(
      'pointermove',
      (e) => {
        const p = pt(e);
        const hover = e.pointerType === 'mouse' && !e.buttons && (e.movementX !== 0 || e.movementY !== 0);
        if (hover && ui.mode !== 'keyboard') ui.mode = 'keyboard';
        ui.pointerMove(p.x, p.y, hover);
      },
      on,
    );
    cv.addEventListener(
      'pointerup',
      (e) => {
        const p = pt(e);
        this.tapped = ui.pointerUp(p.x, p.y, true);
      },
      on,
    );
    cv.addEventListener(
      'click',
      () => {
        const k = this.tapped;
        this.tapped = undefined;
        if (k) ui.activate(k);
      },
      on,
    );
    cv.addEventListener('pointercancel', () => ui.pointerCancel(), on);
    cv.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const p = pt(e);
        ui.wheel(p.x, p.y, (e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) / this.unit);
      },
      { passive: false, signal: this.life.signal },
    );
    cv.addEventListener('contextmenu', (e) => e.preventDefault(), on);
    window.addEventListener('keydown', (e) => this.onKey(e), { capture: true, signal: this.life.signal });
    this.pads = new MenuPadReader(readMenuPad(connectedPads()));
    (window as { slagUi?: UiProbe }).slagUi = this.probe();
    this.frame();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.life.abort();
    this.canvas.remove();
    this.refocus?.focus({ preventScroll: true });
    const w = window as { slagUi?: UiProbe };
    if (w.slagUi?.menu === this.name) delete w.slagUi;
  }

  /** A menu's own text field reads its own keys; everything else comes here first. */
  private onKey(e: KeyboardEvent) {
    if (this.host.key?.(e)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (this.ui.mode !== 'keyboard') this.ui.mode = 'keyboard';
    const a: MenuAction | undefined =
      e.code === 'Escape' ? 'back' : e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space' ? 'confirm' : KEY_ACTIONS[e.code];
    if (e.code === 'Tab') this.ui.cycle(e.shiftKey);
    else if (a) this.act(a);
    else return;
    e.preventDefault();
    e.stopPropagation();
  }

  act(a: MenuAction) {
    if (this.host.busy?.() || !this.ui.act(a)) this.host.act(a);
  }

  private frame = () => {
    this.raf = requestAnimationFrame(this.frame);
    const pads = connectedPads();
    this.ui.pads = pads.length;
    for (const a of this.pads.step(readMenuPad(pads), performance.now())) {
      this.ui.mode = 'gamepad';
      this.act(a);
    }
    this.draw();
  };

  /** Lay out and paint now (also what a stepped screenshot waits on). */
  draw() {
    const cv = this.canvas;
    const cw = innerWidth;
    const ch = innerHeight;
    const thumbs = isTouchFirst();
    this.unit = Math.max(Math.min(cw / 768, ch / 432), thumbs ? MIN_UNIT_TOUCH : MIN_UNIT);
    const dpr = Math.min(3, devicePixelRatio || 1);
    const pw = Math.round(cw * dpr);
    const ph = Math.round(ch * dpr);
    if (cv.width !== pw || cv.height !== ph) {
      cv.width = pw;
      cv.height = ph;
    }
    const c = this.ctx;
    const k = dpr * this.unit;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, pw, ph);
    c.setTransform(k, 0, 0, k, 0, 0);
    const ui = this.ui;
    const key = `${cw}x${ch}`;
    if (this.insets.key !== key) this.insets = { key, ...safeInsets() };
    const u = this.unit;
    ui.insets = { top: this.insets.top / u, right: this.insets.right / u, bottom: this.insets.bottom / u, left: this.insets.left / u };
    ui.thumbs = thumbs;
    ui.tap = ui.mode === 'touch' || thumbs ? TAP_CSS / this.unit : 0;
    ui.begin(c, cw / this.unit, ch / this.unit, (performance.now() - this.t0) / 1000);
    this.host.draw(ui);
    ui.end();
    for (const k of ui.controls) if (k.entry) k.entry.place(this.css(k.r));
  }

  private css(r: Rect): Rect {
    const u = this.unit;
    return { x: r.x * u, y: r.y * u, w: r.w * u, h: r.h * u };
  }

  private probe(): UiProbe {
    return {
      menu: this.name,
      controls: () =>
        this.ui.controls.map((k) => ({
          id: k.id,
          label: k.label,
          ...this.css(k.hit ?? k.r),
          disabled: k.disabled || !k.hit,
          on: k.on,
          value: k.value,
          selected: this.ui.selected === k.id,
        })),
      overflow: (id) => this.ui.scrolled(id).max * this.unit,
    };
  }
}
