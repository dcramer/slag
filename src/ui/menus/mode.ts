import { MODE_IDS, MODES, type ModeId } from '../../game/modes';
import type { InputManager } from '../../input/input';
import { modeEmblem } from '../../render/mode-emblem';
import { CanvasMenu } from '../kit/menu';
import type { Ui } from '../kit/ui';
import type { MenuAction } from '../settings-nav';
import { FONT, PAL } from '../style';

/** What the card reads from the lobby, live (online a change comes back from the host a few frames later), and how it asks for one. */
export interface ModePick {
  mode: () => ModeId;
  setMode: (mode: ModeId) => void;
}

/**
 * The lobby's playstyle (game/modes.ts): one big tile per mode, its emblem and its name, nothing else. Picking one
 * rebuilds the lobby's level for it, for everyone, and closes the card.
 */
export class ModeMenu extends CanvasMenu {
  private pick: ModePick | null = null;

  constructor(input: Pick<InputManager, 'captured' | 'capturePads'>) {
    super(input, 'mode');
  }

  open(pick: ModePick) {
    this.close();
    this.pick = pick;
    this.mount();
    this.ui.selected = null;
    this.ui.selectSoon((id) => id === `mode:${pick.mode()}`);
  }

  act(a: MenuAction) {
    if (a === 'back') this.close();
  }

  draw(ui: Ui) {
    const p = this.pick;
    if (!p) return;
    const now = p.mode();
    const { inner } = ui.sheet(560, 380);
    let y = inner.y;
    if (ui.H >= 300) {
      ui.text('MODE', inner.x, y + 12, 22, PAL.amber, 'left', 400, FONT.display);
      y += 30;
    }
    const footY = inner.y + inner.h - Math.max(ui.tap, 28);
    const gap = 12;
    const n = MODE_IDS.length;
    const tw = (inner.w - gap * (n - 1)) / n;
    const th = Math.max(ui.tap * 2, footY - 10 - y);
    const c = ui.c;
    MODE_IDS.forEach((id, i) => {
      const on = id === now;
      const r = { x: inner.x + i * (tw + gap), y, w: tw, h: th };
      ui.button(
        `mode:${id}`,
        r,
        '',
        () => {
          if (id !== p.mode()) p.setMode(id);
          this.close();
        },
        { style: on ? 'ready' : 'secondary', on, label: MODES[id].label, step: (k) => this.step(k) },
      );
      const label = Math.min(22, th * 0.12);
      modeEmblem(c, id, r.x + r.w / 2, r.y + (r.h - label - 10) / 2, Math.min(r.w * 0.5, (r.h - label - 24) * 0.75));
      ui.text(
        ui.fit(MODES[id].label.toUpperCase(), r.w - 16, label, 400, FONT.display),
        r.x + r.w / 2,
        r.y + r.h - label * 0.9,
        label,
        on ? PAL.ink : PAL.bone,
        'center',
        400,
        FONT.display,
      );
    });
    const bw = ui.buttonWidth('Done', { style: 'primary' }) + 12;
    ui.button('f:done', { x: inner.x + inner.w - bw, y: footY, w: bw, h: Math.max(ui.tap, 28) }, 'Done', () => this.close(), { style: 'primary' });
  }

  /** Left and right walk the tiles, as the arrows on the Level card turn its themes. */
  private step(k: -1 | 1) {
    const ids = MODE_IDS.map((id) => `mode:${id}`);
    const at = ids.indexOf(this.ui.selected ?? '');
    if (at >= 0) this.ui.select(ids[(at + k + ids.length) % ids.length]);
  }
}
