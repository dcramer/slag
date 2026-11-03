import { nameBlocked } from '../../core/name-filter';
import { connectedPads } from '../../input/input';
import { type CharacterDef, PLAYER_COLORS } from '../../gen/character';
import { css } from '../../core/color';
import { drawInkRunner } from '../../render/ink-character';
import { sanitizeName } from '../profile';
import { KEY_ACTIONS, type MenuAction, MenuPadReader, navTarget, readMenuPad } from '../settings-nav';
import { PAL } from '../style';
import { el, Overlay } from './overlay';

/** What the name screen shows and changes: the name, and the color the player wears. */
export interface NameScreen {
  /** The random name, offered as the one-click default. */
  randomName: string;
  /** The saved name, if any. */
  current: string | null;
  /** The character as it stands, in the color picked so far (`undefined`: the one it wears now). Read every frame. */
  preview(color: number | undefined): CharacterDef;
  /** Whether swatch `i` can be worn right now (someone else seated wears it, or something too close). Read every frame. */
  free(i: number): boolean;
  /** A swatch was picked: applied at once, so the room sees it as the preview does. */
  onColor(i: number): void;
  /** Saved (a name) or kept random (null). */
  onDone(name: string | null): void;
}

/** Spoken names for the swatches, for screen readers: the swatch itself says it to everyone else. */
const COLOR_NAMES = ['Red', 'Orange', 'Yellow', 'Lime', 'Green', 'Teal', 'Sky', 'Blue', 'Violet', 'Purple', 'Pink'];

const CSS = `
.slag-who{display:flex;gap:16px;align-items:center;margin-top:10px}
.slag-who canvas{flex:none;width:112px;height:112px;border-radius:6px;background:radial-gradient(circle at 50% 78%,rgba(255,120,40,.28),rgba(20,12,8,.0) 60%),${PAL.soot};border:2px solid ${PAL.ink};box-shadow:inset 0 3px 0 rgba(0,0,0,.4)}
.slag-who .slag-col{flex:1;min-width:0;display:flex;flex-direction:column;gap:12px}
.slag-swatches{display:flex;flex-wrap:wrap;gap:6px}
.slag-swatch{all:unset;display:block;flex:none;box-sizing:border-box;position:relative;width:44px;height:44px;border-radius:6px;border:2px solid ${PAL.ink};box-shadow:0 3px 0 ${PAL.ink},inset 0 -6px 0 rgba(0,0,0,.18);cursor:pointer;transition:transform .06s,box-shadow .06s}
.slag-swatch:hover{transform:translateY(-1px)}
.slag-swatch:active{transform:translateY(2px);box-shadow:0 1px 0 ${PAL.ink}}
.slag-swatch[aria-pressed=true]{outline:3px solid ${PAL.bone};outline-offset:2px}
.slag-swatch:focus-visible{outline:3px solid ${PAL.amber};outline-offset:2px}
.slag-swatch[aria-pressed=true]:focus-visible{outline-color:${PAL.amber}}
.slag-swatch:disabled{cursor:default;filter:saturate(.35) brightness(.55);box-shadow:inset 0 3px 0 rgba(0,0,0,.4)}
.slag-swatch:disabled::after{content:"";position:absolute;inset:8px;background:linear-gradient(45deg,transparent 45%,${PAL.ink} 45% 55%,transparent 55%),linear-gradient(-45deg,transparent 45%,${PAL.ink} 45% 55%,transparent 55%)}
@media (max-width:520px){.slag-who{flex-direction:column;align-items:stretch}.slag-who canvas{align-self:center}}
@media (max-height:520px){.slag-who canvas{width:96px;height:96px}.slag-who{margin-top:4px}}
`;

let styled = false;
function ensureStyle() {
  if (styled) return;
  styled = true;
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
}

/**
 * Who you are: your name, with the random one a click away, and your color from the player palette, shown
 * live on your character. Mouse, touch, keys (arrows between controls, Enter, Esc) and any pad (the d-pad
 * or stick, Ⓐ, Ⓑ).
 */
export class NamePrompt extends Overlay {
  private raf = 0;
  private pads: MenuPadReader | null = null;
  private keys: ((e: KeyboardEvent) => void) | null = null;

  open(s: NameScreen) {
    ensureStyle();
    let picked: number | undefined;
    const input = el('input', { className: 'slag-input', value: s.current ?? s.randomName, maxLength: 12, placeholder: s.randomName });
    input.setAttribute('aria-label', 'Your name');
    const finish = (name: string | null) => {
      s.onDone(name);
      this.close();
    };
    const ok = el('button', { className: 'slag-btn primary', type: 'button', textContent: 'Save' });
    ok.onclick = () => {
      const name = sanitizeName(input.value);
      if (!nameBlocked(name)) return finish(name || null);
      // Refused: the field goes back to the name you had, with nothing said.
      input.value = s.current ?? s.randomName;
      input.select();
    };
    const keep = el('button', { className: 'slag-btn', type: 'button', textContent: `Keep “${s.randomName}”` });
    keep.onclick = () => finish(null);
    const swatches = PLAYER_COLORS.map((c, i) => {
      const b = el('button', { className: 'slag-swatch', type: 'button' });
      b.style.background = css(c);
      b.setAttribute('aria-label', COLOR_NAMES[i] ?? `Color ${i + 1}`);
      b.onclick = () => {
        if (!s.free(i)) return;
        picked = i;
        s.onColor(i);
        paint();
      };
      return b;
    });
    const canvas = el('canvas', { width: 224, height: 224 });
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d');
    const card = el(
      'div',
      { className: 'slag-card' },
      el('h2', { textContent: 'Your Name' }),
      el('div', { className: 'slag-who' }, canvas, el('div', { className: 'slag-col' }, input, el('div', { className: 'slag-swatches' }, ...swatches))),
      el('div', { className: 'slag-actions' }, keep, ok),
    );
    /** The swatches as the room has them now, and the character in the chosen one. */
    const paint = (t = performance.now() / 1000) => {
      const ch = s.preview(picked);
      swatches.forEach((b, i) => {
        const on = ch.color === i;
        b.setAttribute('aria-pressed', String(on));
        b.disabled = !on && !s.free(i);
      });
      if (!ctx) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawInkRunner({ s: ctx, g: null }, ch, canvas.width / 2, canvas.height * 0.82, {
        facing: Math.sin(t * 0.8) > 0 ? 1 : -1,
        vx: 0,
        vy: 0,
        grounded: true,
        t,
        scale: 7,
      });
    };
    const items = (): HTMLElement[] => [input, ...swatches.filter((b) => !b.disabled), keep, ok];
    const act = (a: MenuAction) => {
      const cur = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (a === 'back') this.close();
      else if (a === 'confirm') (cur === input ? ok : cur)?.click();
      else if (a === 'up' || a === 'down' || a === 'left' || a === 'right') {
        const list = items();
        const from = cur ? list.indexOf(cur) : -1;
        if (from < 0) return input.focus();
        const next = navTarget(
          list.map((e) => e.getBoundingClientRect()),
          from,
          a,
        );
        if (next !== null) list[next].focus();
      }
    };
    input.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') ok.click();
      else if (e.key === 'Escape') this.close();
      else if (e.key === 'ArrowDown') {
        e.preventDefault();
        act('down');
      }
    };
    this.keys = (e) => {
      if (e.target === input || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        return this.close();
      }
      const a = KEY_ACTIONS[e.code];
      if (a && a !== 'prevTab' && a !== 'nextTab') {
        e.preventDefault();
        e.stopPropagation();
        act(a);
      }
    };
    this.mount(card);
    window.addEventListener('keydown', this.keys, true);
    this.pads = new MenuPadReader(readMenuPad(connectedPads()));
    this.input.capturePads(true);
    const frame = () => {
      this.raf = requestAnimationFrame(frame);
      for (const a of this.pads?.step(readMenuPad(connectedPads()), performance.now()) ?? []) act(a);
      paint();
    };
    this.raf = requestAnimationFrame(frame);
    paint();
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  }

  override close() {
    cancelAnimationFrame(this.raf);
    if (this.keys) window.removeEventListener('keydown', this.keys, true);
    this.keys = null;
    if (this.pads) this.input.capturePads(false);
    this.pads = null;
    super.close();
  }
}
