import 'client-only';
import type { AudioSystem } from './audio';
import { browserHistory, type HistoryLike, type Nav, Router, type Unmount } from './router';
import { type Route, routeTitle, SCREEN_CHROME, type ScreenName, viewportContent } from './routes';
import { addBreadcrumb, reportError, setTag, setTelemetryContext } from './telemetry';
import { mountHome } from './ui/screens/home';
import { mountPlain } from './ui/screens/plain';
import { isTouchFirst } from './ui/touch/device';

/**
 * The game's one entry point for every host. `mountGame(root)` takes over an
 * element and shows whichever screen the URL names (src/routes.ts): the main
 * menu, the lobby list, a lobby, the codex or the 404. Moving between them never reloads the
 * page (src/router.ts), so one page load can play many lobbies.
 *
 * A host only has to supply the element. Next (app/) server-renders the main
 * menu's markup and inlines SCREEN_CSS for a fast first paint, which the
 * screens adopt; any other host can skip both:
 *
 *   import { mountGame } from './src/main';
 *   import { memoryHistory } from './src/router';
 *   mountGame(document.getElementById('game')!, { history: memoryHistory() }); // no address bar: start on the menu
 *
 * A screen that fails to mount is reported through src/telemetry.ts and
 * replaced by the error screen.
 */

type Mount = (root: HTMLElement, route: Route, nav: Nav) => Unmount | Promise<Unmount>;

/** Every screen. The game and the codex load on first visit; the menu, 404 and error screens are small and ship with the shell. */
const SCREENS: Record<ScreenName, Mount> = {
  home: (root, _r, nav) => mountHome(root, nav),
  lobbies: async (root, _r, nav) => (await import('./ui/screens/lobbies')).mountLobbies(root, nav),
  lobby: async (root, r, nav) =>
    (await import('./game-client')).mountLobby(root, r.screen === 'lobby' ? r.room : '', nav, { watch: r.screen === 'lobby' && r.watch }),
  codex: async (root, _r, nav) => (await import('./codex/main')).mountCodex(root, nav),
  missing: (root, _r, nav) => mountPlain(root, 'missing', nav),
};

export interface MountOptions {
  /** Where URLs live. Default: the browser's own history; `memoryHistory()` for a host without URLs. */
  history?: HistoryLike;
}

let mounted: HTMLElement | null = null;

/** Run the game in `root` until the returned function is called. One game per page: a second call is ignored. */
export function mountGame(root: HTMLElement, opts: MountOptions = {}): () => void {
  if (mounted) return () => {};
  mounted = root;
  ensureHead();
  setTag('device.class', isTouchFirst() ? 'phone' : 'desktop');
  // A hidden tab throttles timers and may lose its GPU context; the trail should say when that happened.
  const page = new AbortController();
  document.addEventListener('visibilitychange', () => addBreadcrumb('page', document.hidden ? 'hidden' : 'visible'), { signal: page.signal });
  let current: Unmount | null = null;
  let currentScreen = '';
  let shown = 0;

  // One audio system for the whole visit (src/audio/page.ts). It loads once the first screen is up, and every gesture
  // unlocks it, because browsers only start audio inside one. Screens other than a lobby hear the title tune.
  let audio: AudioSystem | null = null;
  const loadAudio = () =>
    import('./audio/page').then(({ pageAudio }) => {
      if (page.signal.aborted) return;
      audio = pageAudio();
      if (currentScreen !== 'lobby') audio.menu?.();
    });
  const audioReady = new Promise<void>((done) => setTimeout(() => void loadAudio().then(done, done), 0));
  const unlock = () => {
    if (audio) audio.unlock();
    else void audioReady.then(() => audio?.unlock());
  };
  for (const ev of ['pointerdown', 'keydown', 'touchend'] as const) document.addEventListener(ev, unlock, { capture: true, signal: page.signal });

  const unmount = () => {
    const done = current;
    const screen = currentScreen;
    current = null;
    try {
      done?.();
    } catch (e) {
      reportError(e, { boundary: 'screen-unmount', screen });
    }
  };

  const show = (route: Route) => {
    const token = ++shown;
    unmount();
    currentScreen = route.screen;
    // The host may have server-rendered this screen's markup: keep it for the screen to adopt, the first time only.
    const first = root.firstElementChild as HTMLElement | null;
    if (token > 1 || first?.dataset.screen !== route.screen) root.replaceChildren();
    if (token > 1) window.scrollTo(0, 0);
    applyChrome(route);
    if (route.screen !== 'lobby') audio?.menu?.();
    setTelemetryContext(() => ({ screen: route.screen }));
    addBreadcrumb('screen', route.screen);
    const fail = (e: unknown) => {
      if (token !== shown) return;
      reportError(e, { boundary: 'screen', screen: route.screen });
      unmount();
      root.replaceChildren();
      current = mountPlain(root, 'error', router);
    };
    let result: Unmount | Promise<Unmount>;
    try {
      result = SCREENS[route.screen](root, route, router);
    } catch (e) {
      fail(e);
      return;
    }
    Promise.resolve(result).then((done) => {
      // Navigated away while it loaded: drop it.
      if (token === shown) current = done;
      else done();
    }, fail);
  };

  const router = new Router(opts.history ?? browserHistory(), show);
  router.start();
  return () => {
    router.stop();
    page.abort();
    shown++;
    unmount();
    root.replaceChildren();
    if (audio) void import('./audio/page').then(({ closePageAudio }) => closePageAudio());
    audio = null;
    mounted = null;
  };
}

/**
 * The screens' styles and fonts, for hosts that didn't put them in their HTML. Loaded only then, so a
 * host that inlines them (app/ does) doesn't download the CSS twice.
 */
function ensureHead() {
  const style = document.getElementById('slag-screens'); // SCREEN_STYLE_ID, spelled out so the check doesn't pull the CSS in
  const fonts = document.querySelector('link[href^="https://fonts.googleapis.com/css2"]');
  if (style && fonts) return;
  void import('./ui/screens/css').then(({ FONTS_HREF, SCREEN_CSS, SCREEN_STYLE_ID }) => {
    if (!document.getElementById(SCREEN_STYLE_ID)) {
      const st = document.createElement('style');
      st.id = SCREEN_STYLE_ID;
      st.textContent = SCREEN_CSS;
      document.head.append(st);
    }
    if (!fonts) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONTS_HREF;
      document.head.append(link);
    }
  });
}

/** Title, viewport and browser color for a screen, so a soft navigation looks like a fresh load of that URL. */
function applyChrome(route: Route) {
  document.title = routeTitle(route);
  const chrome = SCREEN_CHROME[route.screen];
  meta('viewport').content = viewportContent(chrome);
  meta('theme-color').content = chrome.themeColor;
}

function meta(name: string): HTMLMetaElement {
  let m = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!m) {
    m = document.createElement('meta');
    m.name = name;
    document.head.append(m);
  }
  return m;
}
