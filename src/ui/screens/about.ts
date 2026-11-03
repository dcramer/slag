import { connectedPads } from '../../input/input';
import type { Nav, Unmount } from '../../router';
import { HOME } from '../../routes';
import { KEY_ACTIONS, type MenuAction, MenuPadReader, readMenuPad } from '../settings-nav';
import { aboutHTML, aboutPromptsHTML } from './markup';

/**
 * The About screen: who made the game, what it parodies, credits, and links to the source and its license. The links
 * are a console-style menu like the main menu's, with mouse, touch, keys (↑/↓, Enter, Esc) and gamepads (stick or
 * d-pad, Ⓐ, Ⓑ); they open in a new tab, so the game stays where it was. Adopts server-rendered markup when the host
 * sent it.
 */
export function mountAbout(root: HTMLElement, nav: Nav): Unmount {
  if (!root.querySelector(':scope > [data-screen=about]')) root.innerHTML = aboutHTML();
  const el = root.querySelector<HTMLElement>(':scope > [data-screen=about]')!;
  const links = [...el.querySelectorAll<HTMLAnchorElement>('.ab-links .menu-item')];
  const prompts = el.querySelector<HTMLElement>('.prompts')!;
  const life = new AbortController();
  const on = { signal: life.signal };
  let active = 0;
  let pad = connectedPads().length > 0;

  const paintPrompts = () => (prompts.innerHTML = aboutPromptsHTML(pad));
  const select = (i: number, focus = false) => {
    active = (i + links.length) % links.length;
    links.forEach((a, j) => (a.dataset.active = String(j === active)));
    if (focus) {
      links[active].focus({ preventScroll: true });
      links[active].scrollIntoView({ block: 'nearest' });
    }
  };
  const back = () => nav.go(HOME);

  links.forEach((a, i) => {
    a.addEventListener('mouseenter', () => select(i), on);
    a.addEventListener('focus', () => select(i), on);
  });
  el.addEventListener('click', (e) => (e.target as Element).closest('[data-act=back]') && back(), on);

  const menuAction = (a: MenuAction) => {
    if (a === 'up' || a === 'down') select(active + (a === 'up' ? -1 : 1), true);
    else if (a === 'confirm') links[active].click();
    else if (a === 'back') back();
  };
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        back();
        return;
      }
      const a = KEY_ACTIONS[e.code];
      if (a) {
        e.preventDefault();
        menuAction(a);
        return;
      }
      // Enter on a focused link or button is its own click; with nothing focused it opens the selected link.
      const focused = document.activeElement;
      if (e.key === 'Enter' && !((focused instanceof HTMLAnchorElement || focused instanceof HTMLButtonElement) && el.contains(focused))) {
        e.preventDefault();
        menuAction('confirm');
      }
    },
    on,
  );

  // Gamepads: whatever is held as the screen opens (the Ⓐ that chose About) isn't a press.
  const reader = new MenuPadReader(readMenuPad(connectedPads()));
  let raf = requestAnimationFrame(function poll(now) {
    raf = requestAnimationFrame(poll);
    const pads = connectedPads();
    if (pads.length > 0 !== pad) {
      pad = pads.length > 0;
      paintPrompts();
    }
    for (const a of reader.step(readMenuPad(pads), now)) menuAction(a);
  });

  paintPrompts();
  return () => {
    life.abort();
    cancelAnimationFrame(raf);
  };
}
