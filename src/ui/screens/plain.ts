import { HOME } from '../../routes';
import type { Nav, Unmount } from '../../router';
import { MenuPadReader, readMenuPad } from '../settings-nav';
import { plainHTML, plainPromptsHTML, type PlainScreen } from './markup';

/**
 * The 404 and error screens: a heading, one line, and MAIN MENU, which is
 * selected from the start so Enter, Ⓐ or a tap leaves. Ⓑ and Esc leave too.
 * The footer shows the pad's glyph once a pad is plugged in.
 * The error screen leaves with a fresh page load, since the app is in a bad state.
 */
export function mountPlain(root: HTMLElement, kind: PlainScreen, nav: Nav): Unmount {
  if (!root.querySelector(`:scope > [data-screen=${kind}]`)) root.innerHTML = plainHTML(kind);
  const life = new AbortController();
  const button = root.querySelector<HTMLButtonElement>('.btn-link')!;
  const prompts = root.querySelector<HTMLElement>('.prompts');
  const leave = () => (kind === 'error' ? nav.hardLoad(HOME) : nav.go(HOME));
  button.disabled = false;
  button.addEventListener('click', leave, { signal: life.signal });
  window.addEventListener('keydown', (e) => e.key === 'Escape' && leave(), { signal: life.signal });
  button.focus({ preventScroll: true });
  const pads = () => (navigator.getGamepads ? [...navigator.getGamepads()].filter((p): p is Gamepad => !!p?.connected) : []);
  const reader = new MenuPadReader(readMenuPad(pads()));
  let pad = false;
  let raf = requestAnimationFrame(function poll() {
    raf = requestAnimationFrame(poll);
    const now = pads();
    if (now.length > 0 !== pad && prompts) {
      pad = now.length > 0;
      prompts.innerHTML = plainPromptsHTML(pad);
    }
    for (const a of reader.step(readMenuPad(now), performance.now())) if (a === 'confirm' || a === 'back') leave();
  });
  return () => {
    life.abort();
    cancelAnimationFrame(raf);
  };
}
