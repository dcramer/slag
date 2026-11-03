/**
 * Typing into a canvas menu. The canvas draws the field; the host supplies the text. In a browser that's
 * a real `<input>` kept invisible over the field, because only a real input brings up a phone's keyboard,
 * composes with an IME and pastes. A host without a DOM implements the same interface over its own text
 * input (SDL's, say), and the menus never know the difference.
 */

import type { Rect } from './ui';

export interface TextEntry {
  value: string;
  /** The selected range, as offsets into `value` (equal: the caret). */
  readonly selStart: number;
  readonly selEnd: number;
  readonly focused: boolean;
  focus(): void;
  blur(): void;
  /** Select all of it, so the first key typed replaces it. */
  selectAll(): void;
  /** Where the field is drawn, in CSS px: a phone scrolls it clear of the keyboard and an IME opens beside it. */
  place(r: Rect): void;
  dispose(): void;
}

export interface TextEntryOptions {
  maxLength: number;
  /** Spoken name of the field. */
  label: string;
  /** A key while typing. True: the menu took it (Enter, Escape, moving away), so the field doesn't. */
  onKey(e: KeyboardEvent): boolean;
  /** It took focus by itself: a click or a tap landed on it. */
  onFocus(): void;
}

/** A TextEntry over an invisible `<input>` laid exactly over the field. */
export function domTextEntry(o: TextEntryOptions): TextEntry {
  const input = document.createElement('input');
  input.maxLength = o.maxLength;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('aria-label', o.label);
  input.dataset.slagUi = '';
  // 16 px: anything smaller and iOS zooms the page in when it takes focus.
  input.style.cssText =
    'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;font-size:16px;border:0;padding:0;margin:0;z-index:11;background:transparent;color:transparent;caret-color:transparent';
  input.addEventListener('keydown', (e) => {
    if (o.onKey(e)) {
      e.preventDefault();
      e.stopPropagation();
    } else e.stopPropagation();
  });
  input.addEventListener('focus', () => o.onFocus());
  document.body.appendChild(input);
  return {
    get value() {
      return input.value;
    },
    set value(v: string) {
      input.value = v;
    },
    get selStart() {
      return input.selectionStart ?? input.value.length;
    },
    get selEnd() {
      return input.selectionEnd ?? input.value.length;
    },
    get focused() {
      return document.activeElement === input;
    },
    focus: () => input.focus({ preventScroll: true }),
    blur: () => input.blur(),
    selectAll: () => input.select(),
    place(r) {
      const s = input.style;
      s.left = `${r.x}px`;
      s.top = `${r.y}px`;
      s.width = `${r.w}px`;
      s.height = `${r.h}px`;
    },
    dispose: () => input.remove(),
  };
}

/** A TextEntry with nothing behind it: what a menu types into with no document (tests). */
export function memoryTextEntry(): TextEntry {
  let sel: [number, number] = [0, 0];
  let focused = false;
  const e: TextEntry = {
    value: '',
    get selStart() {
      return Math.min(sel[0], e.value.length);
    },
    get selEnd() {
      return Math.min(sel[1], e.value.length);
    },
    get focused() {
      return focused;
    },
    focus: () => (focused = true),
    blur: () => (focused = false),
    selectAll: () => (sel = [0, e.value.length]),
    place() {},
    dispose() {},
  };
  return e;
}
