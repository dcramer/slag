import { css } from '../../core/color';
import { nameBlocked } from '../../core/name-filter';
import { type CharacterDef, PLAYER_COLORS } from '../../gen/character';
import type { InputManager } from '../../input/input';
import { track } from '../../render/hud-kit';
import { drawInkRunner } from '../../render/ink-character';
import { CanvasMenu } from '../kit/menu';
import { domTextEntry, memoryTextEntry, type TextEntry } from '../kit/text-entry';
import type { Ui } from '../kit/ui';
import { sanitizeName } from '../profile';
import type { MenuAction } from '../settings-nav';
import { FONT, PAL } from '../style';

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

/** Spoken names for the swatches: the swatch itself says it to everyone else. */
const COLOR_NAMES = ['Red', 'Orange', 'Yellow', 'Lime', 'Green', 'Teal', 'Sky', 'Blue', 'Violet', 'Purple', 'Pink'];

const MAX_NAME = 12;

/**
 * Who you are: your name, with the random one a click away, and your color from the player palette, shown
 * live on your character. Mouse, touch, keys (arrows between controls, Enter, Esc) and any pad (the d-pad
 * or stick, Ⓐ, Ⓑ).
 */
export class NamePrompt extends CanvasMenu {
  private s: NameScreen | null = null;
  private picked: number | undefined;
  private entry: TextEntry | null = null;

  constructor(input: Pick<InputManager, 'captured' | 'capturePads'>) {
    super(input, 'name');
  }

  open(s: NameScreen) {
    this.close();
    this.s = s;
    this.picked = undefined;
    this.entry =
      typeof document === 'undefined'
        ? memoryTextEntry()
        : domTextEntry({
            maxLength: MAX_NAME,
            label: 'Your name',
            onKey: (e) => this.fieldKey(e),
            onFocus: () => this.ui.select('name'),
          });
    this.entry.value = s.current ?? s.randomName;
    this.entry.selectAll();
    this.mount();
    this.ui.select('name');
  }

  protected override closed() {
    this.entry?.dispose();
    this.entry = null;
  }

  act(a: MenuAction) {
    if (a === 'back') this.close();
  }

  /** Keys while typing: the field keeps letters and the caret keys, the menu takes the rest. */
  private fieldKey(e: KeyboardEvent): boolean {
    if (e.key === 'Enter') this.save();
    else if (e.key === 'Escape') this.close();
    else if (e.key === 'ArrowDown') this.send('down');
    else if (e.key === 'Tab') this.ui.cycle(e.shiftKey);
    else return false;
    return true;
  }

  private finish(name: string | null) {
    this.s?.onDone(name);
    this.close();
  }

  private save() {
    const s = this.s;
    const entry = this.entry;
    if (!s || !entry) return;
    const name = sanitizeName(entry.value);
    if (!nameBlocked(name)) return this.finish(name || null);
    // Refused: the field goes back to the name you had, with nothing said.
    entry.value = s.current ?? s.randomName;
    entry.selectAll();
    this.ui.select('name');
  }

  draw(ui: Ui) {
    const s = this.s;
    const entry = this.entry;
    if (!s || !entry) return;
    const ch = s.preview(this.picked);
    const { inner } = ui.sheet(460, 320);
    let y = inner.y;
    if (ui.H >= 260) {
      ui.text('YOUR NAME', inner.x, y + 12, 22, PAL.amber, 'left', 400, FONT.display);
      y += 32;
    }
    const tap = Math.max(ui.tap, 26);
    const btnH = Math.max(ui.tap, 28);
    // The character beside the field and swatches, or above them on a narrow phone.
    const narrow = inner.w < 330;
    const box = narrow ? Math.min(84, inner.h - btnH - 2 * tap - 40) : Math.min(104, inner.w * 0.28);
    const bx = narrow ? inner.x + (inner.w - box) / 2 : inner.x;
    this.preview(ui, ch, bx, y, box);
    const cx = narrow ? inner.x : inner.x + box + 14;
    const cw = inner.x + inner.w - cx;
    let cy = narrow ? y + box + 10 : y;
    ui.field('name', { x: cx, y: cy, w: cw, h: Math.max(ui.tap, 32) }, 'Your name', entry, s.randomName, () => this.save());
    cy += Math.max(ui.tap, 32) + 10;
    const gap = 6;
    const per = Math.max(1, Math.floor((cw + gap) / (tap + gap)));
    PLAYER_COLORS.forEach((c, i) => {
      const on = ch.color === i;
      const free = on || s.free(i);
      const r = { x: cx + (i % per) * (tap + gap), y: cy + Math.floor(i / per) * (tap + gap), w: tap, h: tap + 3 };
      ui.swatch(`color:${i}`, r, COLOR_NAMES[i] ?? `Color ${i + 1}`, css(c), on, !free, () => {
        if (!s.free(i)) return;
        this.picked = i;
        s.onColor(i);
      });
    });
    const keep = `Keep “${ui.fit(s.randomName, 120, 11)}”`;
    const by = inner.y + inner.h - btnH;
    const sw = ui.buttonWidth('Save', { style: 'primary' }) + 12;
    const kw = ui.buttonWidth(keep);
    ui.button('keep', { x: inner.x + inner.w - sw - 8 - kw, y: by, w: kw, h: btnH }, keep, () => this.finish(null), { label: `Keep “${s.randomName}”` });
    ui.button('save', { x: inner.x + inner.w - sw, y: by, w: sw, h: btnH }, 'Save', () => this.save(), { style: 'primary' });
  }

  /** The character in its chosen color, turning now and then to show both sides. */
  private preview(ui: Ui, ch: CharacterDef, x: number, y: number, size: number) {
    const c = ui.c;
    track(c, x, y, size, size, (g) => {
      g.fillStyle = 'rgba(255,120,40,0.18)';
      g.beginPath();
      g.ellipse(size / 2, size * 0.8, size * 0.42, size * 0.16, 0, 0, Math.PI * 2);
      g.fill();
      g.save();
      drawInkRunner({ s: g, g: null }, ch, size / 2, size * 0.82, {
        facing: Math.sin(ui.t * 0.8) > 0 ? 1 : -1,
        vx: 0,
        vy: 0,
        grounded: true,
        t: ui.t,
        scale: (size / 112) * 3.5,
      });
      g.restore();
    });
  }
}
