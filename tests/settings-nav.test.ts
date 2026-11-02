import { describe, expect, it } from 'vitest';
import {
  cycleTab,
  KEY_ACTIONS,
  MenuPadReader,
  type MenuPadState,
  navTarget,
  type NavRect,
  type PadLike,
  readMenuPad,
  resolveTab,
  SETTINGS_TABS,
  type SettingsSection,
  TAB_SECTIONS,
  tabSections,
  visibleTabs,
} from '../src/ui/settings-nav';

const desktop = { touch: false, quality: true, style: true };
const phone = { touch: true, quality: true, style: true };
const rest: MenuPadState = { up: false, down: false, left: false, right: false, a: false, b: false, lb: false, rb: false, start: false };

describe('settings tabs', () => {
  it('splits a desktop into pages and gives touch its own', () => {
    expect(visibleTabs(desktop)).toEqual(['audio', 'video', 'keyboard', 'mouse', 'gamepad']);
    expect(visibleTabs(phone)).toEqual(['audio', 'video', 'touch']);
  });

  it('drops a tab with nothing on it', () => {
    expect(visibleTabs({ touch: false, quality: false, style: false })).toEqual(['audio', 'keyboard', 'mouse', 'gamepad']);
  });

  it('keeps every section on exactly one tab', () => {
    const all: SettingsSection[] = ['audio', 'quality', 'style', 'touch', 'keyboard', 'mouse', 'gamepad'];
    const placed = SETTINGS_TABS.flatMap((t) => TAB_SECTIONS[t]);
    expect([...placed].sort()).toEqual([...all].sort());
  });

  it('can reach every section the old single page showed in that input mode', () => {
    const reach = (c: typeof desktop) => visibleTabs(c).flatMap((t) => tabSections(t, c));
    expect(reach(desktop).sort()).toEqual(['audio', 'gamepad', 'keyboard', 'mouse', 'quality', 'style']);
    expect(reach(phone).sort()).toEqual(['audio', 'quality', 'style', 'touch']);
  });

  it('shows only the half of Video that was wired up', () => {
    expect(tabSections('video', { touch: false, quality: false, style: true })).toEqual(['style']);
  });

  it('cycles with wraparound', () => {
    const tabs = visibleTabs(desktop);
    expect(cycleTab(tabs, 'audio', 1)).toBe('video');
    expect(cycleTab(tabs, 'audio', -1)).toBe('gamepad');
    expect(cycleTab(tabs, 'gamepad', 1)).toBe('audio');
  });

  it('falls back to the first tab when the remembered one is gone', () => {
    expect(resolveTab(visibleTabs(desktop), 'mouse')).toBe('mouse');
    expect(resolveTab(visibleTabs(phone), 'keyboard')).toBe('audio');
  });

  it('switches tabs with Q and E', () => {
    expect(KEY_ACTIONS.KeyQ).toBe('prevTab');
    expect(KEY_ACTIONS.KeyE).toBe('nextTab');
  });
});

describe('navTarget', () => {
  const box = (left: number, top: number, width = 80, height = 40): NavRect => ({ left, top, width, height });
  // Row 0: one tab. Row 1: a switch at the right. Row 2 and 3: two key slots each. Row 4: two footer buttons.
  const rects = [box(120, 0), box(500, 60), box(400, 120), box(500, 120), box(400, 170), box(500, 170), box(20, 240), box(500, 240)];

  it('moves between rows and keeps the nearest column', () => {
    expect(navTarget(rects, 3, 'down')).toBe(5);
    expect(navTarget(rects, 2, 'down')).toBe(4);
    expect(navTarget(rects, 5, 'up')).toBe(3);
    expect(navTarget(rects, 1, 'down')).toBe(3);
    expect(navTarget(rects, 4, 'down')).toBe(7);
  });

  it('wraps from the footer to the top and back', () => {
    expect(navTarget(rects, 7, 'down')).toBe(0);
    expect(navTarget(rects, 0, 'up')).toBe(6);
  });

  it('moves within a row and stops at its ends', () => {
    expect(navTarget(rects, 2, 'right')).toBe(3);
    expect(navTarget(rects, 3, 'left')).toBe(2);
    expect(navTarget(rects, 2, 'left')).toBeNull();
    expect(navTarget(rects, 3, 'right')).toBeNull();
  });

  it('treats controls of different heights on one line as one row', () => {
    const line = [box(0, 10, 40, 30), box(100, 0, 40, 60)];
    expect(navTarget(line, 0, 'right')).toBe(1);
  });

  it('stays put on a lone control and for an index that is not a control', () => {
    expect(navTarget([box(0, 0)], 0, 'down')).toBeNull();
    expect(navTarget(rects, 99, 'down')).toBeNull();
  });
});

describe('menu gamepad', () => {
  const pad = (pressed: number[], axes = [0, 0]): PadLike =>
    ({ axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), touched: false, value: 0 })) }) as unknown as PadLike;

  it('reads the d-pad, the stick and the shoulders', () => {
    expect(readMenuPad([pad([12, 4, 9])])).toMatchObject({ up: true, lb: true, start: true, down: false, rb: false });
    expect(readMenuPad([pad([], [0.9, -0.9])])).toMatchObject({ right: true, up: true, left: false });
  });

  it('merges every connected pad', () => {
    expect(readMenuPad([pad([0]), pad([5])])).toMatchObject({ a: true, rb: true });
  });

  it('fires buttons once per press', () => {
    const r = new MenuPadReader(rest);
    expect(r.step({ ...rest, rb: true }, 0)).toEqual(['nextTab']);
    expect(r.step({ ...rest, rb: true }, 1000)).toEqual([]);
    expect(r.step(rest, 1016)).toEqual([]);
    expect(r.step({ ...rest, lb: true }, 1032)).toEqual(['prevTab']);
    expect(r.step({ ...rest, a: true }, 1048)).toEqual(['confirm']);
    expect(r.step({ ...rest, b: true }, 1064)).toEqual(['back']);
    expect(r.step({ ...rest, start: true }, 1080)).toEqual(['back']);
  });

  it('ignores what was already held at open, until it is pressed again', () => {
    const r = new MenuPadReader({ ...rest, a: true });
    expect(r.step({ ...rest, a: true }, 16)).toEqual([]);
    expect(r.step(rest, 32)).toEqual([]);
    expect(r.step({ ...rest, a: true }, 48)).toEqual(['confirm']);
  });

  it('repeats a held direction after a pause, and stops when released', () => {
    const r = new MenuPadReader(rest);
    const held = { ...rest, right: true };
    expect(r.step(held, 0)).toEqual(['right']);
    expect(r.step(held, 300)).toEqual([]);
    expect(r.step(held, 320)).toEqual(['right']);
    expect(r.step(held, 400)).toEqual([]);
    expect(r.step(held, 410)).toEqual(['right']);
    expect(r.step(rest, 500)).toEqual([]);
    expect(r.step(rest, 900)).toEqual([]);
  });

  it('does not repeat a direction held since open', () => {
    const r = new MenuPadReader({ ...rest, down: true });
    expect(r.step({ ...rest, down: true }, 5000)).toEqual([]);
  });
});
