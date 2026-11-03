import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioSystem } from '../src/audio';
import { defaultSettings, type InputSettings } from '../src/input/bindings';
import type { InputManager } from '../src/input/input';
import { DEFAULT_RULES } from '../src/game/rules';
import { Ui } from '../src/ui/kit/ui';
import { RulesMenu } from '../src/ui/menus/rules';
import { SettingsMenu } from '../src/ui/menus/settings';
import { MockPath, mockCtx } from './lib/canvas';

beforeEach(() => vi.stubGlobal('Path2D', MockPath));
afterEach(() => vi.unstubAllGlobals());

/** A frame of buttons laid out by `layout`, drawn the way a menu draws them. */
function frame(ui: Ui, layout: (ui: Ui) => void, W = 400, H = 300) {
  ui.begin(mockCtx(), W, H, 0);
  layout(ui);
  ui.end();
}

describe('menu kit', () => {
  it('walks a grid with the arrows and presses what is selected', () => {
    const ui = new Ui();
    const pressed: string[] = [];
    const grid = (u: Ui) => {
      for (const [id, x, y] of [
        ['a', 0, 0],
        ['b', 100, 0],
        ['c', 0, 50],
        ['d', 100, 50],
      ] as const)
        u.button(id, { x, y, w: 80, h: 30 }, id, () => pressed.push(id));
    };
    frame(ui, grid);
    ui.act('down'); // nothing selected: the first control
    expect(ui.selected).toBe('a');
    ui.act('right');
    ui.act('down');
    expect(ui.selected).toBe('d');
    ui.act('confirm');
    expect(pressed).toEqual(['d']);
    expect(ui.act('back')).toBe(false); // the menu's own
  });

  it('presses on release over the same control, never after a drag off it', () => {
    const ui = new Ui();
    const pressed: string[] = [];
    frame(ui, (u) => {
      u.button('a', { x: 10, y: 10, w: 80, h: 30 }, 'A', () => pressed.push('a'));
      u.button('b', { x: 10, y: 60, w: 80, h: 30 }, 'B', () => pressed.push('b'));
    });
    ui.pointerDown(20, 20);
    ui.pointerUp(20, 70);
    expect(pressed).toEqual([]);
    ui.pointerDown(20, 70);
    ui.pointerUp(25, 72);
    expect(pressed).toEqual(['b']);
  });

  it('tells a press on the backdrop from one on the card', () => {
    const ui = new Ui();
    frame(ui, (u) => u.setCard({ x: 100, y: 100, w: 100, h: 100 }));
    expect(ui.pointerDown(150, 150)).toBe(true);
    ui.pointerCancel();
    expect(ui.pointerDown(10, 10)).toBe(false);
  });

  it('grows small targets to a thumb on touch', () => {
    const ui = new Ui();
    ui.tap = 40;
    frame(ui, (u) => u.button('a', { x: 100, y: 100, w: 20, h: 20 }, 'A', () => {}));
    expect(ui.at(92, 92)?.id).toBe('a');
    expect(ui.at(80, 80)).toBeUndefined();
  });

  it('scrolls the selection into view and keeps scrolled-out rows out of reach', () => {
    const ui = new Ui();
    const rows = (u: Ui) =>
      u.scroll('list', { x: 0, y: 0, w: 200, h: 100 }, () => {
        for (let i = 0; i < 10; i++) u.button(`r${i}`, { x: 0, y: i * 40, w: 200, h: 36 }, `Row ${i}`, () => {});
        return 400;
      });
    frame(ui, rows);
    expect(ui.scrolled('list')).toEqual({ off: 0, max: 300 });
    expect(ui.control('r5')!.hit).toBeNull();
    for (let i = 0; i < 6; i++) ui.act('down'); // the first selects row 0
    frame(ui, rows);
    frame(ui, rows);
    const r5 = ui.control('r5')!;
    expect(ui.selected).toBe('r5');
    expect(r5.r.y).toBeGreaterThanOrEqual(0);
    expect(r5.r.y + r5.r.h).toBeLessThanOrEqual(100);
    // A finger dragged up the list scrolls it, and the drag is no press.
    ui.pointerDown(50, 80);
    ui.pointerMove(50, 20, false);
    ui.pointerUp(50, 20);
    expect(ui.scrolled('list').off).toBeGreaterThan(0);
  });

  it('sweeps a slider with left and right, and drags it with a pointer', () => {
    const ui = new Ui();
    let v = 0.5;
    const draw = (u: Ui) => u.slider('vol', { x: 0, y: 0, w: 200, h: 20 }, 'Volume', v, 0.05, (nv) => (v = nv));
    frame(ui, draw);
    ui.select('vol');
    ui.act('right');
    expect(v).toBeCloseTo(0.55);
    frame(ui, draw);
    ui.pointerDown(150, 10);
    expect(v).toBeCloseTo(0.75);
    ui.pointerMove(40, 10, false);
    expect(v).toBeCloseTo(0.2);
  });
});

function settingsMenu(touch = false) {
  let settings: InputSettings = defaultSettings();
  const input = {
    captured: false,
    capturePads() {},
    get settings() {
      return settings;
    },
    apply(s: InputSettings) {
      settings = structuredClone(s);
    },
    touch: { active: touch, haptics: true },
  } as unknown as InputManager;
  const audio = { volumes: { master: 0.8, music: 0.6, sfx: 0.9, muted: false }, setVolumes() {}, ui() {} } as unknown as AudioSystem;
  const menu = new SettingsMenu(input, audio);
  menu.quality = { pinned: () => null, set() {} };
  menu.leave = () => {};
  return { menu, settings: () => settings };
}

describe('settings menu', () => {
  it('binds the next key to a slot, Q included, without leaving the page', () => {
    const { menu, settings } = settingsMenu();
    menu.open();
    menu.frame(mockCtx(), 768, 432);
    menu.send('nextTab');
    menu.send('nextTab');
    menu.frame(mockCtx(), 768, 432);
    expect(menu.page).toBe('keyboard');
    menu.ui.select('p:key:single:jump:0');
    menu.send('confirm');
    expect(menu.busy()).toBe(true);
    menu.send('down'); // a pad's arrow while listening goes nowhere
    expect(menu.ui.selected).toBe('p:key:single:jump:0');
    expect(menu.key({ code: 'KeyQ' } as KeyboardEvent)).toBe(true);
    expect(settings().single.jump[0]).toBe('KeyQ');
    expect(menu.page).toBe('keyboard');
    expect(menu.busy()).toBe(false);
  });

  it('fits every page of a 720p window, two players of keys included', () => {
    const { menu } = settingsMenu();
    menu.open();
    for (let i = 0; i < 5; i++) {
      menu.frame(mockCtx(), 768, 432);
      expect([menu.page, menu.ui.scrolled('panel').max]).toEqual([menu.page, 0]);
      if (menu.page === 'keyboard') {
        menu.ui.control('p:split')!.press!();
        menu.frame(mockCtx(), 768, 432);
        expect(['split', menu.ui.scrolled('panel').max]).toEqual(['split', 0]);
      }
      menu.send('nextTab');
    }
  });

  it('lands on the page first, and gives touch its own tabs', () => {
    const { menu } = settingsMenu(true);
    menu.open();
    menu.frame(mockCtx(), 540, 300);
    expect(menu.ui.controls.filter((k) => k.id.startsWith('tab:')).map((k) => k.id)).toEqual(['tab:audio', 'tab:video', 'tab:touch']);
    const { menu: desk } = settingsMenu();
    desk.open();
    desk.frame(mockCtx(), 768, 432);
    // Reopening keeps the last tab of the page load, wherever an earlier test left it.
    expect(desk.ui.selected).toBe(desk.ui.controls.find((k) => k.id.startsWith('p:'))!.id);
  });
});

describe('rules menu', () => {
  it('applies a choice at once and fits a 720p window', () => {
    const seen: boolean[] = [];
    const menu = new RulesMenu({ captured: false, capturePads() {} });
    menu.open(DEFAULT_RULES, (r) => seen.push(r.private), { listed: true });
    menu.frame(mockCtx(), 768, 432);
    expect(menu.ui.scrolled('panel').max).toBe(0);
    menu.ui.controls.find((k) => k.label === 'Lobby: Private')!.press!();
    expect(seen).toEqual([true]);
    menu.send('back');
    expect(menu.isOpen).toBe(false);
  });
});
