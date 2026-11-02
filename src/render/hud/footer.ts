import type { Match } from '../../game/match';
import { type KeyProfile, keyboardDevices } from '../../input/bindings';
import { RUN_COUNTDOWN } from '../../sim/constants';
import { drawGlyph, glyphWidth } from '../../ui/glyphs';
import { glyphsFor, type PromptAction, promptModes } from '../../ui/prompts';
import { PAL, TYPE } from '../../ui/style';
import { ITEMS } from '../../sim/items';
import { hazardTape } from '../hud-kit';
import type { Hud, HudAction } from '../hud';
import { DISPLAY, UI } from './layout';

/** The footer prompt bar: what each phase offers, with glyphs for the input in use. */

interface FooterItem {
  action: PromptAction;
  label: string;
  /** Touch: the on-screen button this action lives on (its label, e.g. 'PLACE'). */
  touchButton?: string;
  /** Only shown in touch mode. */
  touchOnly?: boolean;
  hud?: HudAction;
  device?: string;
  mouse?: boolean;
  /** The action wants a long hold: `Hold` goes in front of the glyphs. */
  hold?: boolean;
}

/** What goes in front of a held action's glyphs: `Hold [R] Ⓑ  Self-Destruct`. */
const HOLD = 'Hold';

/** Keyboard profile prompts are drawn from (the mouse player's keyboard). */
function profile(hud: Hud): KeyProfile | undefined {
  const s = hud.devices.settings;
  if (!s) return undefined;
  const kbs = keyboardDevices(s);
  return (kbs.find((d) => d.device === hud.mouseDevice) ?? kbs[0])?.profile;
}

/** The Use prompt for the held item of the pointer's player, else of the first local holder. */
function usePrompt(hud: Hud, m: Match): FooterItem[] | null {
  const mine = m.players.find((p) => p.device === hud.mouseDevice)?.slot;
  const holders = m.run?.runners.filter((r) => r.alive && !r.finished && r.items.held) ?? [];
  const held = (holders.find((r) => r.slot === mine) ?? holders[0])?.items.held;
  return held ? [{ action: 'use', label: ITEMS[held.kind].verb }] : null;
}

/** Footer prompts and the left-hand context label for this phase. */
function footerItems(hud: Hud, m: Match): { items: FooterItem[]; left: string; alpha: number; bar: boolean } {
  const touch = hud.mode === 'touch';
  switch (m.phase) {
    case 'lobby': {
      const primary = hud.mode === 'gamepad' ? m.players.find((p) => /(^|:)pad/.test(p.device)) : m.players.find((p) => p.device === hud.mouseDevice);
      const items: FooterItem[] = [];
      if ((hud.net?.kickSlot ?? -1) >= 0) {
        items.push({ action: 'confirm', label: 'Kick' }, { action: 'alt', label: 'Cancel' });
        return { items, left: '', alpha: 1, bar: true };
      }
      // A phone's lobby buttons are all on the cards and the top bar, big enough for a thumb.
      if (hud.phone)
        return { items, left: m.players.length ? `${m.players.filter((p) => p.ready).length}/${m.players.length} Ready` : '', alpha: 1, bar: true };
      if (!primary) {
        if (!hud.net?.stranded) items.push({ action: 'confirm', label: 'Join', hud: 'join', device: hud.mouseDevice });
      } else {
        items.push({ action: 'confirm', label: primary.ready ? 'Not Ready' : 'Ready Up', hud: 'ready', device: primary.device });
        items.push({ action: 'alt', label: 'New Look', hud: 'look', device: primary.device });
        items.push({ action: 'down', label: 'New Level', hud: 'level', device: primary.device });
      }
      if (!touch && hud.net?.kickable?.length) items.push({ action: 'use', label: 'Kick' });
      if (!touch) items.push({ action: 'menu', label: 'Settings', hud: 'settings' });
      const ready = m.players.filter((p) => p.ready).length;
      const left = m.players.length ? `${ready}/${m.players.length} Ready` : '';
      return { items, left, alpha: 1, bar: true };
    }
    case 'pick': {
      const picked = m.players.filter((p) => p.claim >= 0).length;
      return { items: [{ action: 'confirm', label: 'Pick', mouse: true }], left: `${picked}/${m.players.length} Picked`, alpha: 1, bar: true };
    }
    case 'place': {
      const placed = m.players.filter((p) => p.placed).length;
      // Fade out of the way when a cursor is down near the footer.
      const near = m.players.some((p) => !p.placed && hud.worldToView(p.cursor.x, p.cursor.y).y > hud.frame.y1 - hud.footH - 26);
      // On a phone these would sit under the on-screen buttons that already say the same.
      const items: FooterItem[] = [
        { action: 'confirm', label: 'Drag to Aim', touchOnly: true },
        { action: 'alt', label: 'Rotate', mouse: true, touchButton: '⟳' },
        { action: 'confirm', label: 'Place', mouse: true, touchButton: 'PLACE' },
      ];
      return {
        items: hud.phone && touch ? [] : items,
        left: `${placed}/${m.players.length} Placed`,
        alpha: near ? 0.25 : 1,
        bar: true,
      };
    }
    case 'run': {
      if (touch) return { items: [], left: '', alpha: 0, bar: false };
      const use = usePrompt(hud, m);
      const f = m.run?.frame ?? 0;
      const full = RUN_COUNTDOWN + 180;
      // Full controls during the countdown, then only the escape hatch, quietly.
      if (f < full + 40) {
        const a = f < full ? 1 : 1 - (f - full) / 40;
        return {
          items: [{ action: 'jump', label: 'Jump' }, { action: 'run', label: 'Run' }, ...(use ?? []), { action: 'alt', label: 'Self-Destruct', hold: true }],
          left: '',
          alpha: Math.max(0.55, a),
          bar: a > 0.6,
        };
      }
      return { items: [...(use ?? []), { action: 'alt', label: 'Self-Destruct', hold: true }], left: '', alpha: use ? 0.9 : 0.55, bar: false };
    }
    case 'score':
      return {
        items: m.phaseFrame > 90 ? [{ action: 'confirm', label: 'Continue', hud: 'continue', device: hud.mouseDevice }] : [],
        left: '',
        alpha: 1,
        bar: true,
      };
    case 'victory':
      return {
        items: m.phaseFrame > 120 ? [{ action: 'confirm', label: 'Back to Lobby', hud: 'continue', device: hud.mouseDevice }] : [],
        left: '',
        alpha: 1,
        bar: true,
      };
  }
}

export function footer(hud: Hud, m: Match) {
  const { items, left, alpha, bar } = footerItems(hud, m);
  const c = hud.ctx;
  const touch = hud.mode === 'touch';
  const fs = hud.footScale;
  const fh = hud.footH;
  const gh = (touch ? 16 : 12) * fs;
  const size = (touch ? TYPE.label + 1 : TYPE.body + 0.5) * fs;
  const win = hud.frame;
  const y = win.y1 - fh;
  const cy = y + fh / 2 + 1;
  const present = {
    keyboard: true,
    gamepad: hud.padCount > 0 || m.players.some((p) => p.device.startsWith('pad')),
  };
  const modes = promptModes(hud.mode, present);
  const ctx = { profile: profile(hud), modes, mouse: false };
  c.save();
  c.globalAlpha = alpha;
  if (bar && (items.length || left)) {
    c.fillStyle = 'rgba(16,9,6,0.88)';
    c.fillRect(win.x0, y, win.w, fh);
    hazardTape(c, win.x0, y - 2, win.w, 2, 0.8);
    c.fillStyle = PAL.ink;
    c.fillRect(win.x0, y, win.w, 1);
  }
  if (left) hud.text(left, win.safeX0 + 14, cy, size, PAL.ash, 'left', UI, 700);
  if (m.phase === 'lobby' && hud.room) {
    const code = hud.room;
    c.font = `400 ${size + 3}px ${DISPLAY}`;
    const x = win.safeX0 + (left ? 110 * fs : 14);
    hud.text('LOBBY', x, cy, TYPE.caption * fs, PAL.dim, 'left', UI, 800);
    hud.text(code, x + 34 * fs, cy + 0.5, size + 3, PAL.amber, 'left', DISPLAY, 400);
  }
  // Right-aligned prompts, laid out right to left.
  let x = win.safeX1 - 14;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (it.touchOnly && !touch) continue;
    const glyphs = glyphsFor(it.action, {
      ...ctx,
      mouse: !!it.mouse && modes[0] === 'keyboard',
      touchButtons: it.touchButton ? { [it.action]: it.touchButton } : undefined,
    });
    if (!glyphs.length) continue;
    c.font = `700 ${size}px ${UI}`;
    const lw = c.measureText(it.label).width;
    const hw = it.hold ? c.measureText(HOLD).width + 4 : 0;
    let gw = 0;
    for (const g of glyphs) gw += glyphWidth(c, g, gh) + 3;
    const w = hw + gw + 3 + lw;
    const x0 = x - w;
    let hover = false;
    if (it.hud && alpha > 0.5) hover = hud.button({ x: x0 - 5, y, w: w + 10, h: fh, action: it.hud, device: it.device });
    if (hover) {
      c.fillStyle = 'rgba(255,140,40,0.18)';
      c.fillRect(x0 - 5, y + 2, w + 10, fh - 3);
    }
    if (it.hold) hud.text(HOLD, x0, cy, size, PAL.ash, 'left', UI, 700);
    let gx = x0 + hw;
    for (const g of glyphs) gx += drawGlyph(c, g, gx, cy - 0.5, gh) + 3;
    hud.text(it.label, gx + 3, cy, size, hover ? PAL.amber : PAL.bone, 'left', UI, 700);
    x = x0 - (touch ? 22 : 16);
  }
  c.restore();
}
