import { buttonText, type ButtonStyle, hazardTape, plate, ring, stampButton, track } from '../../render/hud-kit';
import { drawGlyph, type Glyph, glyphWidth } from '../glyphs';
import type { InputMode } from '../prompts';
import { type MenuAction, type NavRect, navTarget } from '../settings-nav';
import { FONT, PAL } from '../style';
import type { TextEntry } from './text-entry';

/**
 * The menus' widget kit: immediate mode, drawn with the HUD's own art (src/render/hud-kit.ts), so a
 * menu is pixels like the rest of the game and runs wherever a Canvas2D does.
 *
 * Every frame a menu lays itself out and calls a widget per control; each call draws the control and
 * records it with what it does (`press`, `step`, `drag`). Input between frames runs against the controls
 * of the frame on screen, so a press always lands on what the player saw. One selection is shared by the
 * mouse (hover moves it), the keys and the pads (arrows walk it through `navTarget`), and touch (a tap).
 *
 * Units: the menu's own px, which the surface (./surface.ts) maps to the window. All sizes are in them.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A control as the last frame left it. */
export interface Control {
  id: string;
  /** Spoken name: what tools and tests find it by. */
  label: string;
  /** Where it's drawn, on screen. */
  r: Rect;
  /** Where a pointer reaches it: `r` cut to its scroll view and grown to a thumb on touch. Null: scrolled out of reach. */
  hit: Rect | null;
  /** Where it sits for the arrows: as if no scroll view were scrolled, so rows hidden behind the footer still sit above it. */
  nav: NavRect;
  scroll: string | null;
  disabled: boolean;
  /** Toggles, chips and tabs: whether it's the one that's on. */
  on?: boolean;
  /** Sliders: where it stands. */
  value?: number;
  press?: () => void;
  /** Left and right on a slider. */
  step?: (d: -1 | 1) => void;
  /** A pointer held on a slider, at x. */
  drag?: (x: number) => void;
  entry?: TextEntry;
}

interface Scroll {
  off: number;
  max: number;
  view: Rect;
}

interface Press {
  id: string | null;
  x: number;
  y: number;
  scroll: string | null;
  off0: number;
  /** `tap` until it moves: then a slider `drag` or a `scroll`, which is never a press. */
  kind: 'tap' | 'drag' | 'scroll';
}

/** How far a finger travels before a press on a scroll view becomes a scroll. */
const SCROLL_SLOP = 6;

export interface ButtonOpts {
  style?: ButtonStyle;
  /** Drawn before the label (prompts, keycaps). */
  glyphs?: Glyph[];
  size?: number;
  font?: string;
  disabled?: boolean;
  on?: boolean;
  /** Spoken name, when the label alone isn't one. */
  label?: string;
  /** Left and right while it's selected (a tab: the next tab). */
  step?: (d: -1 | 1) => void;
}

const inside = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

function cut(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.w, b.x + b.w) - x;
  const h = Math.min(a.y + a.h, b.y + b.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

export class Ui {
  c!: CanvasRenderingContext2D;
  /** The space to lay out in, in units. */
  W = 768;
  H = 432;
  /** Seconds, for anything that moves. */
  t = 0;
  /** The input family in use: touch shows no selection, and prompts follow it. */
  mode: InputMode = 'keyboard';
  /** Pads plugged in. */
  pads = 0;
  /** Touch: the smallest target, in units (0 elsewhere). */
  tap = 0;
  /** Touch-first device: lay out for thumbs. */
  thumbs = false;
  /** What the notch and the home indicator cover, in units: a full-window sheet keeps its controls clear of them. */
  insets = { top: 0, right: 0, bottom: 0, left: 0 };
  selected: string | null = null;
  /** A control was pressed (for the click). */
  onPress: ((c: Control) => void) | null = null;

  private now: Control[] = [];
  private last: Control[] = [];
  private scrolls = new Map<string, Scroll>();
  private region: { id: string; s: Scroll } | null = null;
  private navShift = 0;
  private card: Rect | null = null;
  private lastCard: Rect | null = null;
  private press: Press | null = null;
  /** The selection moved by keys or pad: scroll it into view. */
  private follow = false;
  private soon: ((id: string) => boolean)[] = [];

  begin(c: CanvasRenderingContext2D, W: number, H: number, t: number) {
    this.c = c;
    this.W = W;
    this.H = H;
    this.t = t;
    this.now = [];
    this.navShift = 0;
    this.card = null;
  }

  end() {
    this.last = this.now;
    this.now = [];
    this.lastCard = this.card;
    const live = this.last.filter((k) => !k.disabled);
    if (this.soon.length) {
      const wants = this.soon;
      this.soon = [];
      for (const want of wants) {
        const k = live.find((q) => want(q.id));
        if (!k) continue;
        this.selected = k.id;
        this.follow = true;
        break;
      }
    }
    const cur = this.control(this.selected);
    if (this.selected !== null && (!cur || cur.disabled)) this.selected = null;
    if (this.follow && cur?.scroll) {
      const s = this.scrolls.get(cur.scroll);
      if (s) {
        const top = cur.r.y - s.view.y;
        const bottom = cur.r.y + cur.r.h - (s.view.y + s.view.h);
        if (top < 0) s.off = Math.max(0, s.off + top - 4);
        else if (bottom > 0) s.off = Math.min(s.max, s.off + bottom + 4);
      }
    }
    this.follow = false;
    for (const k of this.last) {
      if (!k.entry) continue;
      if (k.id === this.selected) {
        if (!k.entry.focused) k.entry.focus();
      } else if (k.entry.focused) k.entry.blur();
    }
  }

  /** The controls on screen now, in drawing order. */
  get controls(): readonly Control[] {
    return this.last;
  }

  control(id: string | null): Control | undefined {
    return id === null ? undefined : this.last.find((k) => k.id === id);
  }

  /**
   * Once the next frame has drawn (a tab switch: the page isn't there yet), select the first control the
   * first of `wants` that accepts any accepts.
   */
  selectSoon(...wants: ((id: string) => boolean)[]) {
    this.soon = wants;
  }

  select(id: string) {
    this.selected = id;
    this.follow = true;
  }

  /** Shows as selected: not on touch, where there's nothing under a finger between taps. */
  lit(id: string): boolean {
    return (this.selected === id && this.mode !== 'touch') || (this.press?.kind === 'tap' && this.press.id === id);
  }

  /** Any of these shows as selected. */
  litAny(ids: readonly string[]): boolean {
    return ids.some((id) => this.lit(id));
  }

  // ------------------------------------------------------------------------------------------------
  // Input

  /** Topmost control at (x, y): its own art first, then the space a thumb grows it by. */
  at(x: number, y: number): Control | undefined {
    for (let i = this.last.length - 1; i >= 0; i--) {
      const k = this.last[i];
      const art = k.hit && cut(k.r, k.hit);
      if (art && inside(art, x, y)) return k;
    }
    for (let i = this.last.length - 1; i >= 0; i--) {
      const k = this.last[i];
      if (k.hit && inside(k.hit, x, y)) return k;
    }
    return undefined;
  }

  /** False when it landed outside the card: a press on the backdrop. */
  pointerDown(x: number, y: number): boolean {
    const k = this.at(x, y);
    let scroll: string | null = null;
    for (const [id, s] of this.scrolls) if (s.max > 0 && inside(s.view, x, y)) scroll = id;
    const live = k && !k.disabled ? k : undefined;
    this.press = { id: live?.id ?? null, x, y, scroll, off0: scroll ? this.scrolls.get(scroll)!.off : 0, kind: live?.drag ? 'drag' : 'tap' };
    if (live) this.selected = live.id;
    live?.drag?.(x);
    return !this.lastCard || inside(this.lastCard, x, y) || !!k;
  }

  /** `hover`: a mouse that really moved, with nothing held. It moves the selection the arrows move. */
  pointerMove(x: number, y: number, hover: boolean) {
    const p = this.press;
    if (p) {
      if (p.kind === 'drag') this.control(p.id)?.drag?.(x);
      else if (p.scroll && Math.abs(y - p.y) > SCROLL_SLOP) p.kind = 'scroll';
      if (p.kind === 'scroll' && p.scroll) {
        const s = this.scrolls.get(p.scroll)!;
        s.off = Math.max(0, Math.min(s.max, p.off0 - (y - p.y)));
      }
      return;
    }
    if (!hover) return;
    const k = this.at(x, y);
    if (k && !k.disabled && k.id !== this.selected) this.selected = k.id;
  }

  /**
   * Released over the control it went down on: a press. `defer` hands the control back instead of
   * pressing it, for a host that presses on the click that follows (see MenuSurface).
   */
  pointerUp(x: number, y: number, defer = false): Control | undefined {
    const p = this.press;
    this.press = null;
    if (p?.kind !== 'tap' || !p.id) return undefined;
    const k = this.at(x, y);
    if (k?.id !== p.id) return undefined;
    if (!defer) this.activate(k);
    return k;
  }

  pointerCancel() {
    this.press = null;
  }

  wheel(x: number, y: number, dy: number) {
    for (const s of this.scrolls.values()) if (s.max > 0 && inside(s.view, x, y)) s.off = Math.max(0, Math.min(s.max, s.off + dy));
  }

  /** Arrows and confirm. False: an action for the menu itself (back, the tab keys). */
  act(a: MenuAction): boolean {
    if (a === 'back' || a === 'prevTab' || a === 'nextTab') return false;
    const live = this.last.filter((k) => !k.disabled);
    const cur = this.control(this.selected);
    if (!cur || cur.disabled) {
      if (live[0]) this.select(live[0].id);
      return true;
    }
    if (a === 'confirm') {
      this.activate(cur);
      return true;
    }
    if ((a === 'left' || a === 'right') && cur.step) {
      cur.step(a === 'left' ? -1 : 1);
      return true;
    }
    const next = navTarget(
      live.map((k) => k.nav),
      live.indexOf(cur),
      a,
    );
    if (next !== null) this.select(live[next].id);
    return true;
  }

  /** Tab and Shift+Tab: every control in order, wrapping, never out of the menu. */
  cycle(back: boolean) {
    const live = this.last.filter((k) => !k.disabled);
    if (!live.length) return;
    const at = live.findIndex((k) => k.id === this.selected);
    this.select(live[(at + (back ? live.length - 1 : 1)) % live.length].id);
  }

  activate(k: Control) {
    if (k.disabled || !k.press) return;
    this.onPress?.(k);
    k.press();
  }

  // ------------------------------------------------------------------------------------------------
  // Layout

  /**
   * The game behind washed dark and the menu's card over it: a riveted plate under hazard tape, centered
   * at most `maxW`×`maxH`, or the whole window when that won't fit (a phone's sheet). Returns the space
   * inside it.
   */
  sheet(maxW: number, maxH: number): { inner: Rect; full: boolean } {
    const c = this.c;
    c.fillStyle = 'rgba(14,8,5,0.8)';
    c.fillRect(0, 0, this.W, this.H);
    const full = this.W < maxW + 24 || this.H < Math.min(maxH, 330) + 24;
    const w = full ? this.W : maxW;
    const h = full ? this.H : Math.min(maxH, this.H - 20);
    const x = Math.round((this.W - w) / 2);
    const y = Math.round((this.H - h) / 2);
    this.setCard({ x, y, w, h });
    if (full) {
      c.fillStyle = PAL.iron;
      c.fillRect(x, y, w, h);
    } else plate(c, x, y, w, h, { radius: 6, drop: 5 });
    c.save();
    c.beginPath();
    c.rect(x + (full ? 0 : 2), y + (full ? 0 : 2), w - (full ? 0 : 4), 6);
    c.clip();
    hazardTape(c, x, y, w, 6);
    c.restore();
    if (!full) return { inner: { x: x + 18, y: y + 14, w: w - 36, h: h - 26 }, full };
    const s = this.insets;
    const top = 12 + s.top;
    const left = 12 + s.left;
    return { inner: { x: x + left, y: y + top, w: w - left - 12 - s.right, h: h - top - 8 - s.bottom }, full };
  }

  /** The card: a press outside it is a press on the backdrop. */
  setCard(r: Rect) {
    this.card = r;
  }

  /**
   * A view that scrolls `draw`'s content, which starts at `view.y` and returns its height. Wheel, a
   * dragged finger and the arrows (keeping the selection in sight) scroll it.
   */
  scroll(id: string, view: Rect, draw: () => number) {
    let s = this.scrolls.get(id);
    if (!s) this.scrolls.set(id, (s = { off: 0, max: 0, view }));
    s.view = view;
    const c = this.c;
    c.save();
    c.beginPath();
    // Wide of the view, so a row's plate and its diamond in the margin aren't cut off.
    c.rect(view.x - 18, view.y, view.w + 26, view.h);
    c.clip();
    c.translate(0, -s.off);
    this.region = { id, s };
    this.navShift += s.off;
    const h = draw() - view.y;
    this.navShift -= s.off;
    this.region = null;
    c.restore();
    s.max = Math.max(0, Math.ceil(h - view.h));
    s.off = Math.min(s.off, s.max);
    // What comes after the view sits below all of its content.
    this.navShift += s.max;
    if (s.max > 0) {
      const bar = Math.max(18, (view.h * view.h) / (view.h + s.max));
      const y = view.y + ((view.h - bar) * s.off) / s.max;
      c.fillStyle = 'rgba(18,11,8,0.6)';
      c.fillRect(view.x + view.w + 2, view.y, 3, view.h);
      c.fillStyle = PAL.steel;
      c.fillRect(view.x + view.w + 2, y, 3, bar);
    }
  }

  /** How far a scroll view can scroll (0: everything fits), and how far it has. */
  scrolled(id: string): { off: number; max: number } {
    const s = this.scrolls.get(id);
    return { off: s?.off ?? 0, max: s?.max ?? 0 };
  }

  /** Back to the top: a new page in the same view. */
  resetScroll(id: string) {
    const s = this.scrolls.get(id);
    if (s) s.off = 0;
  }

  /** Record a control drawn at `r` (in the current scroll view's content, if any). */
  add(k: Omit<Control, 'hit' | 'nav' | 'scroll' | 'disabled' | 'r'> & { r: Rect; disabled?: boolean }): Control {
    const reg = this.region;
    const off = reg?.s.off ?? 0;
    const r = { ...k.r, y: k.r.y - off };
    let hit = reg ? cut(r, reg.s.view) : r;
    if (hit && this.tap) {
      const gw = Math.max(0, this.tap - hit.w);
      const gh = Math.max(0, this.tap - hit.h);
      hit = { x: hit.x - gw / 2, y: hit.y - gh / 2, w: hit.w + gw, h: hit.h + gh };
    }
    const nav = { left: r.x, top: r.y + this.navShift, width: r.w, height: r.h };
    const ctl: Control = { ...k, r, hit, nav, scroll: reg?.id ?? null, disabled: !!k.disabled };
    this.now.push(ctl);
    return ctl;
  }

  // ------------------------------------------------------------------------------------------------
  // Drawing

  /** Text with the HUD's hard ink shadow. Returns its width. */
  text(s: string, x: number, y: number, size: number, color: string = PAL.bone, align: CanvasTextAlign = 'left', weight = 700, font: string = FONT.ui): number {
    const c = this.c;
    c.font = `${weight} ${size}px ${font}`;
    c.textAlign = align;
    c.textBaseline = 'middle';
    if (color !== PAL.ink) {
      c.fillStyle = 'rgba(10,5,3,0.85)';
      c.fillText(s, x, y + Math.max(1, size * 0.08));
    }
    c.fillStyle = color;
    c.fillText(s, x, y);
    return c.measureText(s).width;
  }

  measure(s: string, size: number, weight = 700, font: string = FONT.ui): number {
    this.c.font = `${weight} ${size}px ${font}`;
    return this.c.measureText(s).width;
  }

  /** Text cut to `w` with an ellipsis. */
  fit(s: string, w: number, size: number, weight = 700, font: string = FONT.ui): string {
    if (this.measure(s, size, weight, font) <= w) return s;
    let t = s;
    while (t.length > 1 && this.measure(`${t}…`, size, weight, font) > w) t = t.slice(0, -1);
    return `${t}…`;
  }

  /** A row of glyphs, left edge at x. Returns the width taken. */
  glyphs(gs: readonly Glyph[], x: number, cy: number, h: number, gap = 3): number {
    let at = x;
    for (const g of gs) at += drawGlyph(this.c, g, at, cy, h) + gap;
    return gs.length ? at - x - gap : 0;
  }

  glyphsWidth(gs: readonly Glyph[], h: number, gap = 3): number {
    return gs.reduce((w, g) => w + glyphWidth(this.c, g, h), 0) + Math.max(0, gs.length - 1) * gap;
  }

  /** How wide a button for this label wants to be. */
  buttonWidth(label: string, o: ButtonOpts = {}): number {
    const size = o.size ?? 11;
    const gw = o.glyphs?.length ? this.glyphsWidth(o.glyphs, size * 1.35) + 6 : 0;
    return Math.ceil(this.measure(label, size, 700, o.font) + gw + size * 2.2);
  }

  /** A stamped button. The bottom 3 units of `r` are its side. */
  button(id: string, r: Rect, label: string, press: () => void, o: ButtonOpts = {}) {
    this.add({ id, label: o.label ?? label, r, press, disabled: o.disabled, on: o.on, step: o.step });
    const c = this.c;
    const style = o.style ?? 'secondary';
    c.save();
    if (o.disabled) c.globalAlpha *= 0.45;
    const sink = stampButton(c, r.x, r.y, r.w, r.h - 3, style, this.lit(id));
    const size = o.size ?? 11;
    const cy = r.y + (r.h - 3) / 2 + sink;
    const gh = size * 1.35;
    const gw = o.glyphs?.length ? this.glyphsWidth(o.glyphs, gh) + (label ? 6 : 0) : 0;
    const tw = label ? this.measure(label, size, 700, o.font) : 0;
    const x0 = r.x + (r.w - gw - tw) / 2;
    if (o.glyphs?.length) this.glyphs(o.glyphs, x0, cy, gh);
    const ink = buttonText(style);
    if (label) {
      c.font = `700 ${size}px ${o.font ?? FONT.ui}`;
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillStyle = ink;
      c.fillText(label, x0 + gw, cy + 0.5);
    }
    c.restore();
  }

  /** An on/off switch. `r` is what takes the press (the whole row); the switch is drawn at its right end. */
  toggle(id: string, r: Rect, label: string, on: boolean, set: (on: boolean) => void) {
    this.add({ id, label, r, press: () => set(!on), on });
    const c = this.c;
    const h = Math.min(20, r.h - 6);
    const w = h * 1.85;
    const x = r.x + r.w - w;
    const y = r.y + (r.h - h) / 2;
    track(c, x, y, w, h, on ? (g) => ((g.fillStyle = PAL.molten), g.fillRect(0, 0, w, h)) : undefined);
    const k = h - 6;
    const kx = on ? x + w - k - 3 : x + 3;
    c.fillStyle = PAL.ink;
    c.beginPath();
    c.arc(kx + k / 2 + 0.4, y + 3 + k / 2 + 1, k / 2 + 0.8, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = on ? PAL.bone : PAL.ash;
    c.beginPath();
    c.arc(kx + k / 2, y + 3 + k / 2, k / 2, 0, Math.PI * 2);
    c.fill();
    if (this.lit(id)) ring(c, x, y, w, h, PAL.whiteHot);
  }

  /** A slider over [0, 1] in `step`s. */
  slider(id: string, r: Rect, label: string, v: number, step: number, set: (v: number) => void, disabled = false) {
    const snap = (x: number) => Math.max(0, Math.min(1, Math.round(x / step) * step));
    this.add({
      id,
      label,
      r,
      disabled,
      value: v,
      step: (d) => set(snap(v + d * step)),
      drag: (x) => set(snap((x - r.x) / r.w)),
    });
    const c = this.c;
    const h = Math.min(12, r.h * 0.4);
    const y = r.y + (r.h - h) / 2;
    c.save();
    if (disabled) c.globalAlpha *= 0.5;
    track(c, r.x, y, r.w, h, (g) => {
      g.fillStyle = disabled ? PAL.steel : PAL.molten;
      g.fillRect(0, 0, r.w * v, h);
    });
    const kw = Math.max(10, Math.min(14, r.h * 0.4));
    const kh = Math.min(r.h, h + 12);
    const kx = r.x + r.w * v - kw / 2;
    plate(c, kx, r.y + (r.h - kh) / 2, kw, kh, { fill: PAL.bone, rivets: false, radius: 3, drop: 2, seed: 7 });
    if (this.lit(id)) ring(c, kx, r.y + (r.h - kh) / 2, kw, kh, PAL.whiteHot);
    c.restore();
  }

  /** A color swatch. */
  swatch(id: string, r: Rect, label: string, fill: string, on: boolean, disabled: boolean, press: () => void) {
    this.add({ id, label, r, press, disabled, on });
    const c = this.c;
    c.save();
    if (disabled && !on) c.globalAlpha *= 0.4;
    plate(c, r.x, r.y, r.w, r.h - 3, { fill, rivets: false, radius: 4, drop: 3, seed: 11 });
    c.restore();
    if (disabled && !on) {
      c.strokeStyle = PAL.ink;
      c.lineWidth = 2;
      c.lineCap = 'round';
      const m = r.w * 0.3;
      c.beginPath();
      c.moveTo(r.x + m, r.y + m);
      c.lineTo(r.x + r.w - m, r.y + r.h - 3 - m);
      c.moveTo(r.x + r.w - m, r.y + m);
      c.lineTo(r.x + m, r.y + r.h - 3 - m);
      c.stroke();
    }
    if (on) ring(c, r.x, r.y, r.w, r.h - 3, PAL.bone);
    if (this.lit(id)) ring(c, r.x - 2, r.y - 2, r.w + 4, r.h + 1, PAL.amber);
  }

  /**
   * A text field over `entry`: the canvas draws what's typed, the selection and a blinking caret. It
   * types while selected; `press` runs on confirm (Enter, Ⓐ).
   */
  field(id: string, r: Rect, label: string, entry: TextEntry, placeholder: string, press: () => void, size = 15) {
    this.add({ id, label, r, entry, press });
    const c = this.c;
    track(c, r.x, r.y, r.w, r.h);
    const pad = size * 0.6;
    const cy = r.y + r.h / 2;
    const v = entry.value;
    const font = `700 ${size}px ${FONT.ui}`;
    c.save();
    c.beginPath();
    c.rect(r.x + 2, r.y, r.w - 4, r.h);
    c.clip();
    c.font = font;
    const xOf = (i: number) => r.x + pad + c.measureText(v.slice(0, i)).width;
    if (entry.focused && entry.selEnd > entry.selStart) {
      c.fillStyle = 'rgba(255,106,31,0.45)';
      c.fillRect(xOf(entry.selStart), cy - size * 0.62, xOf(entry.selEnd) - xOf(entry.selStart), size * 1.24);
    }
    if (v) this.text(v, r.x + pad, cy, size, PAL.bone, 'left', 700);
    else this.text(placeholder, r.x + pad, cy, size, PAL.dim, 'left', 600);
    if (entry.focused && entry.selEnd === entry.selStart && Math.floor(this.t * 1.8) % 2 === 0) {
      c.fillStyle = PAL.molten;
      c.fillRect(xOf(entry.selStart) + 0.5, cy - size * 0.55, 1.6, size * 1.1);
    }
    c.restore();
    if (entry.focused || this.lit(id)) ring(c, r.x, r.y, r.w, r.h, entry.focused ? PAL.molten : PAL.amber);
  }
}
