/**
 * Driving the canvas menus (src/ui/kit) from Playwright. They have no DOM to select, so the page lists
 * what's on screen in `window.slagUi` (src/ui/kit/surface.ts): each control's id, spoken label and box in
 * CSS px. Press them where they're drawn, with a real mouse or a real tap.
 */
import type { Page } from 'playwright';

export interface MenuControl {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  disabled: boolean;
  on?: boolean;
  value?: number;
  selected: boolean;
}

/** The menu that's open (`settings`, `rules`, `name`), or null. */
export const menuOpen = (p: Page): Promise<string | null> => p.evaluate(() => (window as any).slagUi?.menu ?? null);

export const menuControls = (p: Page): Promise<MenuControl[]> => p.evaluate(() => (window as any).slagUi?.controls() ?? []);

/** How far a menu's scroll view overflows, in CSS px (0: its page fits). */
export const menuOverflow = (p: Page, view = 'panel'): Promise<number> => p.evaluate((v) => (window as any).slagUi?.overflow(v) ?? 0, view);

/** The selected control's label. */
export async function menuSelected(p: Page): Promise<string | null> {
  return (await menuControls(p)).find((c) => c.selected)?.label ?? null;
}

/** Wait for `name` to be open and drawn, or (null) for every menu to be gone. */
export async function waitMenu(p: Page, name: string | null, timeout = 10_000) {
  await p.waitForFunction(
    (n) => {
      const ui = (window as any).slagUi;
      return n === null ? !ui : ui?.menu === n && ui.controls().length > 0;
    },
    name,
    { timeout },
  );
}

/** A control by id or label, or the first one `want` accepts. */
export async function menuControl(p: Page, want: string | ((c: MenuControl) => boolean)): Promise<MenuControl> {
  const all = await menuControls(p);
  const c = all.find(typeof want === 'string' ? (k) => k.id === want || k.label === want : want);
  if (!c) throw new Error(`menu: no control ${typeof want === 'string' ? want : 'matching'} (have ${all.map((k) => k.id).join(', ')})`);
  return c;
}

/** Press a control where it's drawn: a mouse click, or a tap on a touch page. */
export async function pressMenu(p: Page, want: string | ((c: MenuControl) => boolean), how: 'click' | 'tap' = 'click'): Promise<MenuControl> {
  const c = await menuControl(p, want);
  const x = c.x + c.w / 2;
  const y = c.y + c.h / 2;
  if (how === 'tap') await p.touchscreen.tap(x, y);
  else await p.mouse.click(x, y);
  return c;
}

/** Hover a control, which selects it the way the arrows do. */
export async function hoverMenu(p: Page, want: string | ((c: MenuControl) => boolean)) {
  const c = await menuControl(p, want);
  await p.mouse.move(c.x + c.w / 2 - 1, c.y + c.h / 2);
  await p.mouse.move(c.x + c.w / 2, c.y + c.h / 2);
}
