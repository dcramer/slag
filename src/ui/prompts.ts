import { type Action, type KeyProfile, keyName } from '../input/bindings';
import type { Glyph, PadButton } from './glyphs';

/**
 * Button prompts: which glyphs to show for a game action under the current
 * bindings and input mode. Pure; the HUD footer and DOM menus render the
 * result with drawGlyph / glyphSVG.
 */

export type InputMode = 'keyboard' | 'gamepad' | 'touch';

/** Actions that get prompts. `menu` is Escape or a pad's Start (settings). */
export type PromptAction = Extract<Action, 'confirm' | 'alt' | 'jump' | 'run' | 'down' | 'use'> | 'menu';

/** Fixed gamepad layout (see InputManager.sample): A jump/confirm, X run, B alt, Y use, d-pad down, Start settings. */
const PAD: Partial<Record<PromptAction, PadButton>> = { confirm: 'A', jump: 'A', alt: 'B', run: 'X', use: 'Y', down: 'DDOWN', menu: 'MENU' };

/** Short keycap text for a KeyboardEvent.code ("ShiftLeft" → "Shift", "KeyR" → "R"). */
export function capLabel(code: string | undefined): string {
  if (!code) return '?';
  if (code === 'Escape') return 'Esc';
  if (code === 'Backspace') return '⌫';
  return keyName(code).replace(/^L-/, '');
}

export interface PromptContext {
  /** Key profile of the keyboard device the prompts are for. */
  profile?: KeyProfile;
  /** Which glyph families to show, most relevant first. */
  modes: readonly InputMode[];
  /** Also show the mouse button for actions that have one. */
  mouse?: boolean;
  /**
   * Touch: name the on-screen button for an action (e.g. { confirm: 'PLACE', alt: '⟳' }).
   * Actions without one fall back to a plain tap for confirm, nothing otherwise.
   */
  touchButtons?: Partial<Record<PromptAction, string>>;
}

/** Glyphs (alternatives, shown side by side) for an action. */
export function glyphsFor(action: PromptAction, ctx: PromptContext): Glyph[] {
  const out: Glyph[] = [];
  for (const mode of ctx.modes) {
    if (mode === 'keyboard') {
      const code = action === 'menu' ? 'Escape' : ctx.profile?.[action]?.[0];
      if (code) out.push({ kind: 'key', label: capLabel(code) });
      if (ctx.mouse && (action === 'confirm' || action === 'alt')) out.push({ kind: 'mouse', button: action === 'confirm' ? 'left' : 'right' });
    } else if (mode === 'gamepad') {
      const b = PAD[action];
      if (b) out.push({ kind: 'pad', button: b });
    } else {
      const label = ctx.touchButtons?.[action];
      if (label) out.push({ kind: 'touch', label });
      else if (action === 'confirm') out.push({ kind: 'touch' });
    }
  }
  return out;
}

/** Order glyph families: the active one first, then any other present family (touch stands alone). */
export function promptModes(active: InputMode, present: { keyboard: boolean; gamepad: boolean }): InputMode[] {
  if (active === 'touch') return ['touch'];
  const other: InputMode = active === 'keyboard' ? 'gamepad' : 'keyboard';
  return present[other] ? [active, other] : [active];
}
