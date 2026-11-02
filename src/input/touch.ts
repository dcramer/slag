import type { InputFrame } from '../sim/types';

/**
 * Touch screen → one InputFrame per sim step for the single on-device touch
 * player (device id `'touch'`). Like the keyboard and gamepads it only ever
 * produces InputFrames (plus a view-space pointer, exactly like the mouse),
 * so the sim stays a pure function of inputs.
 *
 * The class is DOM-free on purpose: `down/move/up/cancel` take viewport CSS
 * pixels and `sample()` is called once per fixed step, so the whole mapping
 * (multi-touch, hold-to-jump, drag offsets, hold-to-self-destruct) is unit
 * tested without a browser. `attach()` wires real pointer events.
 *
 * Every touch gets a *role* when it lands (stick, jump, alt, drag, tap…)
 * and keeps it until it lifts, so sliding a running thumb over the jump
 * button never turns into a jump, and two thumbs never fight. Layout
 * geometry is shared with the on-screen overlay (src/ui/touch/overlay.ts)
 * through `touchLayout()`, so what you see is exactly what you hit.
 */

export const TOUCH_DEVICE = 'touch';

/**
 * What the touch surface does right now (derived from the match phase and
 * the touch player's state by game-client):
 * - `off`: nothing joined / nothing to do (only the menu button shows)
 * - `lobby`: taps hit-test the HUD buttons (join / ready / new look / name)
 * - `pick`: tap a crate card to claim it (cursor snaps to the finger); two fingers move the camera
 * - `place`: drag moves the ghost (offset above the finger); ROTATE / PLACE buttons; two fingers move the camera
 * - `race`: left-thumb stick, right-thumb JUMP, hold ALT to self-destruct, USE while holding an item
 * - `continue`: tap anywhere = confirm (score / victory screens)
 */
export type TouchMode = 'off' | 'lobby' | 'pick' | 'place' | 'race' | 'continue';

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** Control geometry in viewport CSS pixels. */
export interface TouchLayout {
  w: number;
  h: number;
  /** Touches left of this start the movement stick (race). */
  splitX: number;
  /** Stick radius: full deflection; past RUN_AT × r you run. */
  stickR: number;
  /** Where the stick rests when no thumb is on it (drawn as a hint). */
  stickHome: { x: number; y: number };
  /** Big primary button: JUMP in races, PLACE in the place phase. */
  primary: Circle;
  /** Small secondary button: ALT (hold) in races, ROTATE in the place phase. */
  secondary: Circle;
  /** Use-item button above the primary, there only while the touch player holds an item. */
  use: Circle;
  /** Settings / pause button (a real DOM button; listed so drags avoid it). */
  menu: Circle;
}

/** Fraction of stick deflection where walking becomes running. */
export const RUN_AT = 0.7;
/** Horizontal dead zone as a fraction of stick radius. */
export const DEAD_AT = 0.22;
/** Vertical deflection (fraction of radius) that counts as down/up. */
export const DOWN_AT = 0.5;
/** Frames ALT must be held in a race before it self-destructs (~0.35 s). */
export const ALT_HOLD_FRAMES = 21;
/** How far above the finger the place ghost sits, in CSS px (about a fingertip). */
export const DRAG_OFFSET_CSS = 56;
/** Movement (CSS px) under which a touch still counts as a tap. */
export const TAP_SLOP = 18;

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Landscape-first control layout for a `w×h` viewport. Sizes scale with the
 * short side so thumbs land the same on phones and tablets; everything
 * stays inside the safe-area insets (notch, home indicator).
 */
export function touchLayout(w: number, h: number, ins: Insets = { top: 0, right: 0, bottom: 0, left: 0 }): TouchLayout {
  const s = Math.min(w, h);
  const pad = clamp(s * 0.05, 12, 32);
  const stickR = clamp(s * 0.15, 46, 78);
  const pr = clamp(s * 0.15, 44, 74);
  const sr = clamp(s * 0.085, 28, 44);
  const primary = { x: w - ins.right - pad - pr, y: h - ins.bottom - pad - pr, r: pr };
  // Secondary sits left of and a little above the primary: a short thumb roll away.
  const d = pr + sr + clamp(s * 0.03, 8, 18);
  const secondary = { x: primary.x - d * 0.87, y: primary.y - d * 0.5, r: sr };
  const use = { x: primary.x + pr - sr, y: primary.y - pr - sr - clamp(s * 0.03, 8, 18), r: sr };
  const mr = clamp(s * 0.05, 22, 26); // 44 CSS px across at the least
  const menu = { x: w - ins.right - 10 - mr, y: ins.top + 10 + mr, r: mr };
  return {
    w,
    h,
    splitX: w * 0.5,
    stickR,
    stickHome: { x: ins.left + pad + stickR * 1.2, y: h - ins.bottom - pad - stickR * 1.2 },
    primary,
    secondary,
    use,
    menu,
  };
}

const inCircle = (c: Circle, x: number, y: number, slop = 1) => (x - c.x) ** 2 + (y - c.y) ** 2 <= (c.r * slop) ** 2;

type Role = 'stick' | 'jump' | 'alt' | 'use' | 'drag' | 'pinch' | 'tap' | 'rotate' | 'place' | 'none';

interface Track {
  role: Role;
  x0: number;
  y0: number;
  x: number;
  y: number;
  /** Stick anchor (follows the thumb when it's pushed past the radius). */
  ax: number;
  ay: number;
  /** Sim frames this touch has been held (counted in sample()). */
  frames: number;
  fired: boolean;
}

export interface StickState {
  ax: number;
  ay: number;
  x: number;
  y: number;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  run: boolean;
}

/** Maps CSS viewport px to logical 768×432 view coords (null if the view isn't laid out). */
export type ToView = (cx: number, cy: number) => { x: number; y: number } | null;

export class TouchInput {
  mode: TouchMode = 'off';
  layout: TouchLayout = touchLayout(1, 1);
  /** True while touch is the most recent input (controls visible). Keyboard/mouse/gamepad use clears it. */
  active = false;
  /** Haptic feedback (navigator.vibrate) on presses. Persisted by the owner of the settings UI. */
  haptics = true;
  /** The touch player holds an item, so the USE button is there. Set by the owner each frame. */
  useReady = false;

  /** CSS px → view coords (set by InputManager to its canvas mapping). */
  toView: ToView = () => null;
  /** Lobby: a tap at view (x, y). Return true if a HUD button took it. */
  onUiTap: ((x: number, y: number) => boolean) | null = null;
  /** Any finished touch (user gesture): unlock audio etc. */
  onGesture: (() => void) | null = null;
  /** Vibrate for `ms` (wired to navigator.vibrate when available). */
  vibrate: ((ms: number) => void) | null = null;
  /** Called when `active` flips (overlay show/hide). */
  onActive: ((active: boolean) => void) | null = null;
  /** Pick and place, two fingers: their spread grew by `ratio`, and their midpoint moved by `delta` to `mid` (view px). */
  onPinch: ((ratio: number, mid: { x: number; y: number }, delta: { x: number; y: number }) => void) | null = null;
  /** Sim frames a new drag waits before it moves the ghost, so the second finger of a pinch can land first. Set where pinching exists. */
  pinchWait = 0;

  private tracks = new Map<number, Track>();
  private jumpLatch = false;
  private confirmLatch = false;
  private altLatch = false;
  private useLatch = false;
  private pointer: { x: number; y: number } | null = null;
  /** Place: the dragging finger (CSS px). Re-read every step, because a panning camera moves the world under a still finger. */
  private drag: { x: number; y: number } | null = null;
  private pinchLast: { d: number; mid: { x: number; y: number } } | null = null;

  /** Switch what touches mean. Live touches are dropped so a held role can't leak across phases. */
  setMode(m: TouchMode) {
    if (m === this.mode) return;
    this.mode = m;
    this.reset();
  }

  setActive(on: boolean) {
    if (on === this.active) return;
    this.active = on;
    if (!on) this.reset();
    this.onActive?.(on);
  }

  /** Forget all touches and latched presses (mode change, menu opened, switched to keyboard). */
  reset() {
    this.tracks.clear();
    this.jumpLatch = this.confirmLatch = this.altLatch = this.useLatch = false;
    this.pointer = this.drag = this.pinchLast = null;
  }

  /** Haptic tick, honoring the `haptics` preference. */
  buzz(ms: number) {
    if (this.haptics) this.vibrate?.(ms);
  }

  /** A finger landed at viewport (x, y). */
  down(id: number, x: number, y: number) {
    this.setActive(true);
    const L = this.layout;
    let role: Role = 'none';
    const t: Track = { role, x0: x, y0: y, x, y, ax: x, ay: y, frames: 0, fired: false };
    switch (this.mode) {
      case 'race':
        if (inCircle(L.secondary, x, y, 1.2)) role = 'alt';
        else if (this.useReady && inCircle(L.use, x, y, 1.2)) {
          role = 'use';
          this.useLatch = true;
          this.buzz(10);
        } else if (x < L.splitX) {
          role = 'stick';
          // Keep the anchor far enough from the screen edge that you can still push toward it.
          t.ax = clamp(x, L.stickR * 0.75, L.w - L.stickR * 0.75);
          t.ay = clamp(y, L.stickR * 0.75, L.h - L.stickR * 0.5);
          if ([...this.tracks.values()].some((o) => o.role === 'stick')) role = 'none'; // one stick thumb
        } else {
          role = 'jump';
          this.jumpLatch = true;
          this.buzz(8);
        }
        break;
      case 'place':
        if (inCircle(L.primary, x, y, 1.1)) role = 'place';
        else if (inCircle(L.secondary, x, y, 1.25)) {
          role = 'rotate';
          this.altLatch = true;
          this.buzz(6);
        } else {
          role = this.nextFinger();
          if (role === 'drag') this.drag = { x, y };
        }
        break;
      case 'pick':
        role = this.nextFinger();
        if (role === 'drag') this.pointer = this.toView(x, y) ?? this.pointer;
        break;
      case 'lobby':
      case 'continue':
        role = 'tap';
        break;
      case 'off':
        break;
    }
    t.role = role;
    this.tracks.set(id, t);
    if (role === 'pinch') this.pinchLast = this.pinchState();
  }

  /** Pick and place: one finger drags, and a second turns the pair into a camera gesture. */
  private nextFinger(): Role {
    const fingers = [...this.tracks.values()];
    if (fingers.some((o) => o.role === 'pinch')) return 'none';
    // 'none' here is the finger left down when a pinch partner lifted: landing beside it pinches again.
    const other = fingers.find((o) => o.role === 'drag' || o.role === 'none');
    if (!other) return 'drag';
    other.role = 'pinch';
    this.drag = null;
    return 'pinch';
  }

  move(id: number, x: number, y: number) {
    const t = this.tracks.get(id);
    if (!t) return;
    t.x = x;
    t.y = y;
    if (t.role === 'stick') {
      // Follow stick: past the rim the anchor is dragged along, so reversing direction is always a short move.
      const dx = x - t.ax;
      const dy = y - t.ay;
      const d = Math.hypot(dx, dy);
      const R = this.layout.stickR;
      if (d > R) {
        t.ax = x - (dx / d) * R;
        t.ay = y - (dy / d) * R;
      }
    } else if (t.role === 'drag') {
      if (this.mode === 'place') this.drag = { x, y };
      else this.pointer = this.toView(x, y) ?? this.pointer;
    } else if (t.role === 'pinch') {
      const now = this.pinchState();
      const last = this.pinchLast;
      if (now && last && last.d > 0) this.onPinch?.(now.d / last.d, now.mid, { x: now.mid.x - last.mid.x, y: now.mid.y - last.mid.y });
      this.pinchLast = now;
    }
  }

  /** The two pinching fingers' spread and midpoint, in view px. */
  private pinchState(): { d: number; mid: { x: number; y: number } } | null {
    const ps: { x: number; y: number }[] = [];
    for (const t of this.tracks.values()) {
      const v = t.role === 'pinch' ? this.toView(t.x, t.y) : null;
      if (v) ps.push(v);
    }
    if (ps.length < 2) return null;
    const [a, b] = ps;
    return { d: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  }

  /** Place: where the ghost being dragged is, in view px. Null when nothing is being dragged. */
  dragView(): { x: number; y: number } | null {
    return this.mode === 'place' && this.drag ? this.ghostAt(this.drag.x, this.drag.y) : null;
  }

  /** A lifted pinch finger leaves its partner idle, not dragging: a pinch never moves the ghost. */
  private endPinch() {
    for (const o of this.tracks.values()) if (o.role === 'pinch') o.role = 'none';
    this.pinchLast = null;
  }

  up(id: number, x: number, y: number) {
    const t = this.tracks.get(id);
    this.tracks.delete(id);
    this.onGesture?.();
    if (!t) return;
    t.x = x;
    t.y = y;
    const tap = Math.hypot(x - t.x0, y - t.y0) <= TAP_SLOP;
    switch (t.role) {
      case 'pinch':
        this.endPinch();
        break;
      case 'place':
        // Only a finger that lifts *on* PLACE places: sliding off cancels.
        if (inCircle(this.layout.primary, x, y, 1.3)) {
          this.confirmLatch = true;
          this.buzz(15);
        }
        break;
      case 'drag':
        // A tap shorter than the wait still moves the ghost.
        if (this.drag && t.frames < this.pinchWait) this.pointer = this.ghostAt(x, y) ?? this.pointer;
        this.drag = null;
        if (this.mode === 'pick') {
          // Lifting over a card claims it (tap or slide-to-choose).
          this.pointer = this.toView(x, y) ?? this.pointer;
          this.confirmLatch = true;
        }
        break;
      case 'tap':
        if (!tap) break;
        if (this.mode === 'lobby') {
          const v = this.toView(x, y);
          if (v && this.onUiTap?.(v.x, v.y)) this.buzz(8);
        } else this.confirmLatch = true;
        break;
      default:
        break;
    }
  }

  cancel(id: number) {
    const t = this.tracks.get(id);
    this.tracks.delete(id);
    if (t?.role === 'drag') this.drag = null;
    if (t?.role === 'pinch') this.endPinch();
  }

  /** Place phase: ghost sits above the finger; the offset fades near the bottom edge so the lowest rows stay reachable. */
  private ghostAt(x: number, y: number): { x: number; y: number } | null {
    const a = this.toView(x, y);
    const b = this.toView(x, y - 1);
    if (!a || !b) return null;
    const k = a.y - b.y; // view px per CSS px
    const off = DRAG_OFFSET_CSS * k;
    const VIEW_H = 432;
    const fade = clamp((VIEW_H - a.y) / (off * 1.5), 0, 1);
    return { x: a.x, y: a.y - off * fade };
  }

  /** The race stick's current state (for drawing and for sample()). */
  stick(): StickState | null {
    for (const t of this.tracks.values()) {
      if (t.role !== 'stick') continue;
      const R = this.layout.stickR;
      const dx = t.x - t.ax;
      const dy = t.y - t.ay;
      const down = dy > DOWN_AT * R && dy > Math.abs(dx) * 0.5;
      const up = -dy > DOWN_AT * R && -dy > Math.abs(dx) * 0.5;
      return { ax: t.ax, ay: t.ay, x: t.x, y: t.y, left: dx < -DEAD_AT * R, right: dx > DEAD_AT * R, up, down, run: Math.abs(dx) > RUN_AT * R };
    }
    return null;
  }

  /** Is any touch currently holding this role? (overlay pressed states) */
  holding(role: 'jump' | 'alt' | 'use' | 'place' | 'rotate'): boolean {
    for (const t of this.tracks.values()) if (t.role === role) return true;
    return false;
  }

  /** ALT hold progress 0..1 (race self-destruct ring). */
  altProgress(): number {
    let p = 0;
    for (const t of this.tracks.values()) if (t.role === 'alt') p = Math.max(p, t.fired ? 1 : t.frames / ALT_HOLD_FRAMES);
    return p;
  }

  /** One sim step of input for the touch player. Clears latched presses. */
  sample(): InputFrame {
    const st = this.mode === 'race' ? this.stick() : null;
    let jump = false;
    let alt = this.altLatch;
    for (const t of this.tracks.values()) {
      t.frames++;
      if (t.role === 'jump') jump = true;
      if (t.role === 'drag' && this.drag && t.frames >= this.pinchWait) this.pointer = this.ghostAt(this.drag.x, this.drag.y) ?? this.pointer;
      if (t.role === 'alt' && !t.fired && t.frames >= ALT_HOLD_FRAMES) {
        t.fired = true;
        alt = true;
        this.buzz(40);
      }
    }
    const f: InputFrame = {
      left: !!st?.left,
      right: !!st?.right,
      up: !!st?.up,
      down: !!st?.down,
      run: !!st?.run,
      // A tap shorter than one step still jumps (latched), just like a key tap.
      jump: jump,
      jumpPressed: this.jumpLatch,
      confirmPressed: this.confirmLatch,
      altPressed: alt,
      downPressed: false,
      usePressed: this.useLatch,
    };
    if (this.pointer && (this.mode === 'pick' || this.mode === 'place')) f.pointer = { x: this.pointer.x, y: this.pointer.y };
    this.pointer = null;
    this.jumpLatch = this.confirmLatch = this.altLatch = this.useLatch = false;
    return f;
  }

  /**
   * Listen for touch pointers on `target`. Mouse and pen pointers are left to
   * InputManager. `skip(e)` filters touches meant for DOM UI (menus, buttons).
   */
  attach(target: Window, skip: (e: PointerEvent) => boolean) {
    const isTouch = (e: PointerEvent) => e.pointerType === 'touch';
    target.addEventListener('pointerdown', (e) => {
      if (!isTouch(e)) return;
      if (skip(e)) {
        this.setActive(true);
        return;
      }
      this.down(e.pointerId, e.clientX, e.clientY);
    });
    target.addEventListener('pointermove', (e) => {
      if (isTouch(e)) this.move(e.pointerId, e.clientX, e.clientY);
    });
    target.addEventListener('pointerup', (e) => {
      if (isTouch(e)) this.up(e.pointerId, e.clientX, e.clientY);
    });
    target.addEventListener('pointercancel', (e) => {
      if (isTouch(e)) this.cancel(e.pointerId);
    });
  }
}

/** Minimal match view needed to pick a touch mode (keeps this module free of game imports). */
export interface TouchModeSource {
  phase: string;
  players: readonly { device: string; claim: number; placed: boolean }[];
}

/** What touches should do this frame, given the phase and whether/what the touch player still has to do. */
export function touchModeFor(m: TouchModeSource, device = TOUCH_DEVICE): TouchMode {
  if (m.phase === 'lobby') return 'lobby';
  const p = m.players.find((q) => q.device === device);
  if (!p) return 'off';
  switch (m.phase) {
    case 'pick':
      return p.claim < 0 ? 'pick' : 'off';
    case 'place':
      return p.placed ? 'off' : 'place';
    case 'run':
      return 'race';
    case 'score':
    case 'victory':
      return 'continue';
    default:
      return 'off';
  }
}
