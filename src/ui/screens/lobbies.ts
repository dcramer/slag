import { newRoomCode } from '../../game/room';
import { connectedPads } from '../../input/input';
import { fetchLobbies, SignalError } from '../../net/signal-client';
import { LIST_POLL_MS, type ListedRoom } from '../../net/signal-protocol';
import type { Nav, Unmount } from '../../router';
import { HOME, lobby } from '../../routes';
import { KEY_ACTIONS, type MenuAction, MenuPadReader, readMenuPad } from '../settings-nav';
import { isFull, LOBBY_FILTERS, type LobbyFilter, lobbyRows, PHASE_TAGS, themeLabel } from './lobby-list';
import { lobbiesHTML, lobbiesPromptsHTML } from './markup';

/**
 * The Lobbies screen: the public lobby list, read from the signaling API every LIST_POLL_MS while the page is shown
 * (never while hidden, so an open tab in the background costs nothing). Join lists rooms with a seat, Watch the full
 * ones. Choosing a room opens it the way an invite link does, through the joining screen: seated if there's a seat
 * in its lobby, watching otherwise, and watching from the start under Watch.
 *
 * A console-style menu like the main menu: one row is always selected, with mouse, touch, keys (↑/↓, Enter, Q/E,
 * Esc) and gamepads (stick or d-pad, Ⓐ, LB/RB, Ⓑ). Adopts server-rendered markup when the host sent it.
 */
export function mountLobbies(root: HTMLElement, nav: Nav): Unmount {
  if (!root.querySelector(':scope > [data-screen=lobbies]')) root.innerHTML = lobbiesHTML();
  const el = root.querySelector<HTMLElement>(':scope > [data-screen=lobbies]')!;
  const $ = (sel: string) => el.querySelector<HTMLElement>(sel)!;
  const list = $('.lb-list');
  const empty = $('.lb-empty h2');
  const play = $('.lb-empty .menu-item') as HTMLButtonElement;
  const prompts = $('.prompts');
  const tabs = [...el.querySelectorAll<HTMLButtonElement>('.lb-tab')];
  const life = new AbortController();
  const on = { signal: life.signal };

  let rooms: ListedRoom[] = [];
  let filter: LobbyFilter = 'join';
  let shown: ListedRoom[] = [];
  /** The selected room by code, so a refresh that reorders the list keeps the same room selected. */
  let selected = '';
  let failure = '';
  let pad = connectedPads().length > 0;

  const rows = () => [...list.querySelectorAll<HTMLButtonElement>('.lb-row')];
  /** Everything the selection moves through: the rooms, or the empty state's one button. */
  const items = (): HTMLButtonElement[] => (shown.length ? rows() : el.dataset.state === 'empty' ? [play] : []);
  const paintPrompts = () => (prompts.innerHTML = lobbiesPromptsHTML(pad, el.dataset.state === 'empty' ? 'Play' : filter === 'watch' ? 'Watch' : 'Join'));

  const select = (i: number, focus = false) => {
    const all = items();
    if (all.length === 0) return;
    const k = Math.max(0, Math.min(all.length - 1, i));
    all.forEach((b, j) => (b.dataset.active = String(j === k)));
    selected = shown[k]?.room ?? '';
    if (focus) {
      all[k].focus({ preventScroll: true });
      all[k].scrollIntoView({ block: 'nearest' });
    }
  };
  const activeIndex = () =>
    Math.max(
      0,
      items().findIndex((b) => b.dataset.active === 'true'),
    );

  const render = () => {
    shown = lobbyRows(rooms, filter);
    for (const t of tabs) {
      const f = t.dataset.filter as LobbyFilter;
      t.setAttribute('aria-selected', String(f === filter));
      const n = rooms.filter((r) => isFull(r) === (f === 'watch')).length;
      t.querySelector('.n')!.textContent = n ? String(n) : '';
    }
    const focused =
      document.activeElement instanceof HTMLElement && el.contains(document.activeElement) && document.activeElement.matches('.lb-row, .lb-empty .menu-item');
    list.replaceChildren(...shown.map(rowEl));
    el.dataset.state = failure || shown.length === 0 ? 'empty' : 'list';
    empty.textContent = failure || (filter === 'watch' ? 'Nothing to Watch' : 'No Open Lobbies');
    paintPrompts();
    const at = shown.findIndex((r) => r.room === selected);
    select(at < 0 ? 0 : at, focused);
  };

  const rowEl = (r: ListedRoom): HTMLLIElement => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'menu-item lb-row';
    b.dataset.room = r.room;
    b.dataset.active = 'false';
    const pips = Array.from({ length: r.max }, (_, i) => `<i${i < r.players ? ' class="on"' : ''}></i>`).join('');
    b.innerHTML =
      `<span class="t">${themeLabel(r.theme).toUpperCase()}</span><span class="s">${r.room}</span>` +
      `<span class="lb-seats"><span class="lb-pips">${pips}</span><span class="lb-count">${r.players}/${r.max}</span></span>` +
      `<span class="lb-eyes"${r.observers ? '' : ' data-none'}>${EYE}${r.observers}</span>` +
      `<span class="lb-phase"><span class="lb-tag" data-phase="${r.phase}">${PHASE_TAGS[r.phase]}</span></span><span class="chev"></span>`;
    b.setAttribute('aria-label', `${themeLabel(r.theme)} ${r.room}, ${r.players} of ${r.max} players, ${r.observers} watching, ${PHASE_TAGS[r.phase]}`);
    b.addEventListener('mouseenter', () => select(shown.indexOf(r)), on);
    b.addEventListener('focus', () => select(shown.indexOf(r)), on);
    b.addEventListener('click', () => open(r), on);
    li.append(b);
    return li;
  };

  const open = (r: ListedRoom) => nav.go(lobby(r.room, { watch: filter === 'watch' }));
  const setFilter = (f: LobbyFilter) => {
    if (f === filter) return;
    filter = f;
    selected = '';
    paintPrompts();
    render();
  };
  const cycle = (d: number) => setFilter(LOBBY_FILTERS[(LOBBY_FILTERS.indexOf(filter) + d + LOBBY_FILTERS.length) % LOBBY_FILTERS.length]);
  const back = () => nav.go(HOME);
  const confirm = () => items()[activeIndex()]?.click();

  // The list, while the page is shown. A reply that lands after the screen is gone is dropped with the abort.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let loading = false;
  const refresh = async () => {
    clearTimeout(timer);
    if (life.signal.aborted || loading) return;
    loading = true;
    try {
      rooms = await fetchLobbies(life.signal);
      failure = '';
    } catch (e) {
      if (life.signal.aborted) return;
      // Keep showing the last list through a blip; with nothing to show, say why.
      if (rooms.length === 0) failure = e instanceof SignalError && e.code === 'unconfigured' ? 'Online Not Set Up' : 'Lobbies Unreachable';
    } finally {
      loading = false;
    }
    if (life.signal.aborted) return;
    render();
    if (!document.hidden) timer = setTimeout(() => void refresh(), LIST_POLL_MS);
  };
  document.addEventListener('visibilitychange', () => (document.hidden ? clearTimeout(timer) : void refresh()), on);

  // Mouse and touch: rows act on click; the filters, Back and Play are buttons too.
  for (const t of tabs) t.addEventListener('click', () => setFilter(t.dataset.filter as LobbyFilter), on);
  play.addEventListener('click', () => nav.go(lobby(newRoomCode())), on);
  play.addEventListener('mouseenter', () => select(0), on);
  el.addEventListener('click', (e) => (e.target as Element).closest('[data-act=back]') && back(), on);

  const menuAction = (a: MenuAction) => {
    if (a === 'up' || a === 'down') select(activeIndex() + (a === 'up' ? -1 : 1), true);
    else if (a === 'left' || a === 'prevTab') cycle(-1);
    else if (a === 'right' || a === 'nextTab') cycle(1);
    else if (a === 'confirm') confirm();
    else back();
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
      // Enter on a focused button is that button's own click; with nothing focused it takes the selected row.
      if (e.key === 'Enter' && !(document.activeElement instanceof HTMLButtonElement && el.contains(document.activeElement))) {
        e.preventDefault();
        confirm();
      }
    },
    on,
  );

  // Gamepads: whatever is held as the screen opens (the Ⓐ that chose Lobbies) isn't a press.
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
  void refresh();
  return () => {
    life.abort();
    clearTimeout(timer);
    cancelAnimationFrame(raf);
  };
}

/** The watchers' eye, as on their chips in the lobby. */
const EYE =
  '<svg viewBox="0 0 22 14" aria-hidden="true"><path d="M1 7C4 2.5 7.5 1 11 1s7 1.5 10 6c-3 4.5-6.5 6-10 6S4 11.5 1 7Z" fill="currentColor" stroke="#120b08" stroke-width="1.5"/><circle cx="11" cy="7" r="3" fill="#120b08"/></svg>';
