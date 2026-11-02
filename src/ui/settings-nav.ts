/**
 * The Settings screen's tabs and console-style navigation, kept apart from
 * the DOM so the rules can be tested: which tabs exist, which section lives
 * on which tab, where a directional press lands, and what a gamepad did.
 */

export type SettingsSection = 'audio' | 'quality' | 'touch' | 'keyboard' | 'mouse' | 'gamepad';

export const SETTINGS_TABS = ['audio', 'video', 'touch', 'keyboard', 'mouse', 'gamepad'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const TAB_LABELS: Record<SettingsTab, string> = {
  audio: 'Audio',
  video: 'Video',
  touch: 'Touch',
  keyboard: 'Keyboard',
  mouse: 'Mouse',
  gamepad: 'Gamepad',
};

/** Every section sits on exactly one tab. */
export const TAB_SECTIONS: Record<SettingsTab, readonly SettingsSection[]> = {
  audio: ['audio'],
  video: ['quality'],
  touch: ['touch'],
  keyboard: ['keyboard'],
  mouse: ['mouse'],
  gamepad: ['gamepad'],
};

export interface TabContext {
  /** Touch is the active input: the touch options replace the keyboard, mouse and pad pages. */
  touch: boolean;
  /** The menu was given a graphics-quality hook. */
  quality: boolean;
}

function hasSection(s: SettingsSection, c: TabContext): boolean {
  if (s === 'audio') return true;
  if (s === 'quality') return c.quality;
  return s === 'touch' ? c.touch : !c.touch;
}

/** The sections shown on a tab here. */
export function tabSections(tab: SettingsTab, c: TabContext): SettingsSection[] {
  return TAB_SECTIONS[tab].filter((s) => hasSection(s, c));
}

/** Tabs with something to show here, in display order. */
export function visibleTabs(c: TabContext): SettingsTab[] {
  return SETTINGS_TABS.filter((t) => tabSections(t, c).length > 0);
}

/** The wanted tab if it's still on offer (input can change between opens), else the first. */
export function resolveTab(tabs: readonly SettingsTab[], wanted: SettingsTab): SettingsTab {
  return tabs.includes(wanted) ? wanted : tabs[0];
}

/** The tab `d` steps away, wrapping like the main menu. */
export function cycleTab(tabs: readonly SettingsTab[], cur: SettingsTab, d: number): SettingsTab {
  const n = tabs.length;
  return tabs[(tabs.indexOf(cur) + d + n) % n];
}

export type MenuDirection = 'up' | 'down' | 'left' | 'right';
export type MenuAction = MenuDirection | 'prevTab' | 'nextTab' | 'confirm' | 'back';

/** A control's on-screen box. */
export interface NavRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Keyboard shortcuts of the menu, by KeyboardEvent.code. Enter and Space stay native button presses. */
export const KEY_ACTIONS: Readonly<Record<string, MenuAction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyQ: 'prevTab',
  KeyE: 'nextTab',
};

const midX = (r: NavRect) => r.left + r.width / 2;
const midY = (r: NavRect) => r.top + r.height / 2;

/** Group controls into visual rows, top to bottom, each sorted left to right (as indices into `rects`). */
function visualRows(rects: readonly NavRect[]): number[][] {
  const rows: number[][] = [];
  const byTop = rects.map((_, i) => i).sort((a, b) => midY(rects[a]) - midY(rects[b]));
  for (const i of byTop) {
    const row = rows.at(-1);
    const first = row === undefined ? undefined : rects[row[0]];
    if (row && first && midY(rects[i]) < first.top + first.height) row.push(i);
    else rows.push([i]);
  }
  for (const row of rows) row.sort((a, b) => rects[a].left - rects[b].left);
  return rows;
}

/**
 * Where a directional press lands, from the controls' real boxes, so layouts
 * that wrap (a phone, split-keyboard columns) need no hand-kept order. Up and
 * down wrap around and keep the nearest column; left and right stop at the
 * row's ends. Null means the selection stays put.
 */
export function navTarget(rects: readonly NavRect[], from: number, dir: MenuDirection): number | null {
  const rows = visualRows(rects);
  const r = rows.findIndex((row) => row.includes(from));
  if (r < 0) return null;
  if (dir === 'left' || dir === 'right') {
    const row = rows[r];
    return row[row.indexOf(from) + (dir === 'left' ? -1 : 1)] ?? null;
  }
  const next = rows[(r + (dir === 'up' ? -1 : 1) + rows.length) % rows.length];
  if (next === rows[r]) return null;
  const x = midX(rects[from]);
  let best = next[0];
  for (const i of next) if (Math.abs(midX(rects[i]) - x) < Math.abs(midX(rects[best]) - x)) best = i;
  return best;
}

/** One poll of the buttons the menu listens to, merged across every pad. */
export interface MenuPadState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  a: boolean;
  b: boolean;
  lb: boolean;
  rb: boolean;
  start: boolean;
}

/** The part of the Gamepad API the menu reads. */
export type PadLike = Pick<Gamepad, 'axes' | 'buttons'>;

/** Merge pads into one state. The menu has one selection, so any pad drives it. Standard mapping. */
export function readMenuPad(pads: readonly PadLike[]): MenuPadState {
  const s: MenuPadState = { up: false, down: false, left: false, right: false, a: false, b: false, lb: false, rb: false, start: false };
  for (const p of pads) {
    const ax = p.axes[0] ?? 0;
    const ay = p.axes[1] ?? 0;
    const btn = (i: number) => !!p.buttons[i]?.pressed;
    s.up ||= ay < -0.5 || btn(12);
    s.down ||= ay > 0.5 || btn(13);
    s.left ||= ax < -0.5 || btn(14);
    s.right ||= ax > 0.5 || btn(15);
    s.a ||= btn(0);
    s.b ||= btn(1);
    s.lb ||= btn(4);
    s.rb ||= btn(5);
    s.start ||= btn(9);
  }
  return s;
}

const REPEAT_DELAY_MS = 320;
const REPEAT_EVERY_MS = 90;
const DIRECTIONS: readonly MenuDirection[] = ['up', 'down', 'left', 'right'];
const BUTTONS: readonly (readonly [Exclude<keyof MenuPadState, MenuDirection>, MenuAction])[] = [
  ['a', 'confirm'],
  ['b', 'back'],
  ['start', 'back'],
  ['lb', 'prevTab'],
  ['rb', 'nextTab'],
];

/**
 * Turns polled pad states into menu actions: buttons fire once per press,
 * directions also repeat while held, so a slider can be swept. Seed it with
 * the state at open: whatever is already held (the Ⓐ that opened the menu)
 * isn't a press.
 */
export class MenuPadReader {
  private due: Partial<Record<MenuDirection, number>> = {};

  constructor(private prev: MenuPadState) {}

  step(cur: MenuPadState, now: number): MenuAction[] {
    const out: MenuAction[] = [];
    for (const d of DIRECTIONS) {
      if (!cur[d]) delete this.due[d];
      else if (!this.prev[d]) {
        out.push(d);
        this.due[d] = now + REPEAT_DELAY_MS;
      } else {
        const at = this.due[d];
        if (at !== undefined && now >= at) {
          out.push(d);
          this.due[d] = now + REPEAT_EVERY_MS;
        }
      }
    }
    for (const [b, action] of BUTTONS) if (cur[b] && !this.prev[b]) out.push(action);
    this.prev = cur;
    return out;
  }
}
