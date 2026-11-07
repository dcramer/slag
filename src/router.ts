import { parseRoute, type Route, routePath, sameRoute } from './routes';

/**
 * Moves between the game's screens without reloading the page. Every
 * navigation in src/ goes through here (lint bans `location.assign` and
 * `history.pushState` elsewhere), so a screen never assumes how it's hosted:
 * a browser keeps real, shareable URLs through the History API, and a
 * packaged build with no address bar runs the same screens on `memoryHistory`.
 * Menus are what reach every screen; a URL is just one more way in.
 *
 * Query params (`?seed`, `?theme` and the other debug params) ride along on
 * every navigation, so a debug session stays one.
 */

/** What the router needs from a history. */
export interface HistoryLike {
  readonly path: string;
  readonly search: string;
  readonly hash: string;
  push(url: string): void;
  replace(url: string): void;
  /** Call `cb` when the user moves through history (back/forward). Returns the unsubscribe. */
  listen(cb: () => void): () => void;
  /** Start over with a fresh page load: only for an app in a bad state (the error screen). */
  hardLoad(url: string): void;
}

/** The browser's own history: URLs in the address bar, back and forward buttons. */
export function browserHistory(): HistoryLike {
  return {
    get path() {
      return location.pathname;
    },
    get search() {
      return location.search;
    },
    get hash() {
      return location.hash;
    },
    push: (url) => history.pushState(null, '', url),
    replace: (url) => history.replaceState(null, '', url),
    listen(cb) {
      window.addEventListener('popstate', cb);
      return () => window.removeEventListener('popstate', cb);
    },
    hardLoad: (url) => location.assign(url),
  };
}

/** A history that lives only in memory, for hosts without URLs (a packaged build, tests). */
export function memoryHistory(start = '/'): HistoryLike & { readonly entries: readonly string[] } {
  const entries = [start];
  const split = (url: string) => {
    const q = url.indexOf('?');
    return q < 0 ? [url, ''] : [url.slice(0, q), url.slice(q)];
  };
  return {
    get path() {
      return split(entries[entries.length - 1])[0];
    },
    get search() {
      return split(entries[entries.length - 1])[1];
    },
    hash: '',
    get entries() {
      return entries;
    },
    push: (url) => void entries.push(url),
    replace: (url) => void (entries[entries.length - 1] = url),
    listen: () => () => {},
    hardLoad: (url) => {
      entries.length = 0;
      entries.push(url);
      if (typeof location !== 'undefined') location.reload();
    },
  };
}

export interface GoOptions {
  /** Replace the current history entry instead of adding one (redirects, canonical URLs). */
  replace?: boolean;
}

export class Router {
  route: Route;
  private unlisten: (() => void) | null = null;
  /** The showing screen's taker of back/forward within itself (`followWithin`), if it has one. */
  private within: ((r: Route) => void) | null = null;

  /** `show` mounts a route's screen; the router calls it once per change of route. */
  constructor(
    private hist: HistoryLike,
    private show: (r: Route) => void,
  ) {
    this.route = parseRoute(hist.path);
  }

  /** Show the screen for the current URL, canonicalizing it (a lower-case lobby code), and follow back/forward from now on. */
  start(): void {
    this.unlisten?.();
    this.unlisten = this.hist.listen(() => this.sync());
    this.route = parseRoute(this.hist.path);
    this.canonicalize();
    this.show(this.route);
  }

  stop(): void {
    this.unlisten?.();
    this.unlisten = null;
  }

  /** Go to a screen. Going where you already are does nothing. */
  go(to: Route, opts: GoOptions = {}): void {
    const url = routePath(to) + this.hist.search;
    if (opts.replace) this.hist.replace(url);
    else if (!sameRoute(to, this.route)) this.hist.push(url);
    if (sameRoute(to, this.route)) return;
    this.route = to;
    this.within = null;
    this.show(to);
  }

  /**
   * Point the URL at another state of the screen already showing (the codex opening a card) without remounting it:
   * a history entry of its own unless `replace`. Another screen's route is an ordinary `go`.
   */
  goWithin(to: Route, opts: GoOptions = {}): void {
    if (to.screen !== this.route.screen) return this.go(to, opts);
    const url = routePath(to) + this.hist.search;
    if (opts.replace) this.hist.replace(url);
    else if (!sameRoute(to, this.route)) this.hist.push(url);
    this.route = to;
  }

  /**
   * While the screen showing listens here, back/forward to another route of that same screen comes to `cb` instead
   * of remounting it, so the entries `goWithin` made open and close in place. Returns the unsubscribe; moving to
   * another screen drops it anyway.
   */
  followWithin(cb: (r: Route) => void): () => void {
    this.within = cb;
    return () => {
      if (this.within === cb) this.within = null;
    };
  }

  /** The URL of a route here, query included: for invite links and anything else that leaves the app. */
  href(to: Route): string {
    return routePath(to) + this.hist.search;
  }

  /** A full reload of `to` (home by default). The error screen's way out; nothing else should need it. */
  hardLoad(to: Route): void {
    this.hist.hardLoad(this.href(to));
  }

  /** Back/forward: show wherever the history now points. A fragment link on the same screen changes nothing. */
  private sync() {
    const next = parseRoute(this.hist.path);
    if (sameRoute(next, this.route)) return;
    const within = next.screen === this.route.screen ? this.within : null;
    this.route = next;
    this.canonicalize();
    if (within) return within(next);
    this.within = null;
    this.show(next);
  }

  private canonicalize() {
    const want = routePath(this.route);
    if (this.route.screen !== 'missing' && want !== this.hist.path) this.hist.replace(want + this.hist.search + this.hist.hash);
  }
}

/** What a screen may do with the router: move to another screen, or keep its own state in the URL. */
export type Nav = Pick<Router, 'go' | 'goWithin' | 'followWithin' | 'href' | 'hardLoad'>;

/** A mounted screen's teardown. */
export type Unmount = () => void;
