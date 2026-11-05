import { newRoomCode, roomFromPath } from '../../game/room';
import { connectedPads } from '../../input/input';
import type { Nav, Unmount } from '../../router';
import { ABOUT, CODEX, LOBBIES, lobby } from '../../routes';
import { MenuPadReader, readMenuPad } from '../settings-nav';
import { homeHTML, homePromptsHTML, MENU_ITEMS, type MenuItemId } from './markup';

/**
 * The main menu. Console-style selection (one item is always active) that
 * works with mouse, touch, keyboard (↑/↓, Enter, Esc) and gamepads (stick or
 * d-pad, Ⓐ, Ⓑ), read with the same pad reader as Settings. The footer shows
 * pad glyphs once a pad is plugged in. Adopts server-rendered markup when the
 * host sent it; the character stage and Settings load on demand.
 */
export function mountHome(root: HTMLElement, nav: Nav): Unmount {
  if (!root.querySelector(':scope > [data-screen=home]')) root.innerHTML = homeHTML();
  const life = new AbortController();
  const on = { signal: life.signal };
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('.menu-item')];
  const prompts = root.querySelector<HTMLElement>('.prompts')!;
  const item = (id: MenuItemId) => buttons[MENU_ITEMS.findIndex((m) => m.id === id)];
  const joinBtn = item('join');
  const joinLi = joinBtn.parentElement!;
  let active = 0;
  let joining: { form: HTMLFormElement; input: HTMLInputElement; err: HTMLParagraphElement } | null = null;
  let settingsOpen = false;
  let closeSettings: (() => void) | null = null;
  let pad = false;

  const paintPrompts = () => (prompts.innerHTML = homePromptsHTML(pad, !!joining));
  const setActive = (i: number) => {
    active = i;
    buttons.forEach((b, j) => (b.dataset.active = String(j === i)));
  };
  const move = (d: number) => {
    const n = (active + d + buttons.length) % buttons.length;
    setActive(n);
    buttons[n].focus();
  };

  const submitJoin = () => {
    if (!joining) return;
    const room = roomFromPath(`/r/${joining.input.value.trim()}`);
    if (!room) return showError('Codes are 3–12 letters and numbers.');
    nav.go(lobby(room));
  };
  const showError = (msg: string) => {
    if (!joining) return;
    joining.err.textContent = msg;
    joining.err.hidden = !msg;
    joining.input.setAttribute('aria-invalid', String(!!msg));
  };
  const openJoin = () => {
    if (!joining) {
      const form = document.createElement('form');
      form.className = 'join';
      form.innerHTML =
        '<input maxlength="12" placeholder="CODE" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Lobby code" aria-invalid="false"><button type="submit">JOIN</button>';
      const input = form.querySelector('input')!;
      const err = document.createElement('p');
      err.className = 'join-err';
      err.setAttribute('role', 'alert');
      err.hidden = true;
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submitJoin();
      });
      input.addEventListener('input', () => {
        input.value = input.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        showError('');
      });
      joinLi.append(form, err);
      joining = { form, input, err };
      joinBtn.setAttribute('aria-expanded', 'true');
      paintPrompts();
    }
    const input = joining.input;
    setTimeout(() => input.focus(), 0);
  };
  const back = () => {
    if (!joining) return;
    joining.form.remove();
    joining.err.remove();
    joining = null;
    joinBtn.setAttribute('aria-expanded', 'false');
    joinBtn.focus();
    paintPrompts();
  };

  const openSettings = () => {
    settingsOpen = true;
    void import('../standalone').then(({ openStandaloneSettings }) => {
      if (life.signal.aborted || !settingsOpen) return;
      closeSettings = openStandaloneSettings(() => {
        settingsOpen = false;
        closeSettings = null;
        // Whatever is held as Settings closes isn't a press: the Ⓐ on Done must not reopen it.
        reader = new MenuPadReader(readMenuPad(connectedPads()));
        item('settings').focus();
      });
    });
  };

  const activate = (id: MenuItemId) => {
    showError('');
    if (id === 'play') nav.go(lobby(newRoomCode(Math.random)));
    else if (id === 'lobbies') nav.go(LOBBIES);
    else if (id === 'codex') nav.go(CODEX);
    else if (id === 'settings') openSettings();
    else if (id === 'about') nav.go(ABOUT);
    else openJoin();
  };

  buttons.forEach((b, i) => {
    b.disabled = false;
    b.addEventListener('mouseenter', () => setActive(i), on);
    b.addEventListener('focus', () => setActive(i), on);
    b.addEventListener('click', () => activate(b.dataset.id as MenuItemId), on);
  });

  // Keyboard: arrows move the selection; Esc backs out of code entry.
  window.addEventListener(
    'keydown',
    (e) => {
      if (settingsOpen) return;
      if (e.key === 'Escape' && joining) back();
      if (joining && document.activeElement === joining.input) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        move(e.key === 'ArrowDown' ? 1 : -1);
      }
    },
    on,
  );

  // Gamepads: stick/d-pad moves, Ⓐ selects, Ⓑ backs out. Whatever is held as the menu opens isn't a press.
  let reader = new MenuPadReader(readMenuPad(connectedPads()));
  let raf = requestAnimationFrame(function poll() {
    raf = requestAnimationFrame(poll);
    const pads = connectedPads();
    if (pads.length > 0 !== pad) {
      pad = pads.length > 0;
      paintPrompts();
    }
    if (settingsOpen) return;
    for (const a of reader.step(readMenuPad(pads), performance.now())) {
      if (a === 'up' || a === 'down') move(a === 'down' ? 1 : -1);
      else if (a === 'confirm') {
        const el = document.activeElement;
        if (joining && el === joining.input) submitJoin();
        else if (el instanceof HTMLElement && el !== document.body && root.contains(el)) el.click();
        else buttons[active].click();
      } else if (a === 'back') back();
    }
  });

  // The crowd on the slag heap: real game characters, so it loads after the menu is up.
  let stopStage: (() => void) | null = null;
  const canvas = root.querySelector<HTMLCanvasElement>('.stage canvas');
  if (canvas)
    void import('../home-stage').then(({ mountStage }) => {
      if (!life.signal.aborted) stopStage = mountStage(canvas);
    });

  return () => {
    life.abort();
    cancelAnimationFrame(raf);
    stopStage?.();
    settingsOpen = false;
    closeSettings?.();
  };
}
