import { roomFromPath } from './game/room';

/**
 * The game's screens and the paths that reach them. Pure data and string
 * functions, so a host's server code may import this (app/ uses it for page
 * titles and viewports) and tests can run it headless. The History API side
 * is src/router.ts; the screens themselves are mounted by src/main.ts.
 */

export type Route = { screen: 'home' } | { screen: 'lobby'; room: string } | { screen: 'codex' } | { screen: 'missing'; path: string };
export type ScreenName = Route['screen'];

export const HOME: Route = { screen: 'home' };
export const CODEX: Route = { screen: 'codex' };
export const lobby = (room: string): Route => ({ screen: 'lobby', room });

/** The screen a path shows. Lobby codes are case-insensitive; anything unknown is the 404 screen. */
export function parseRoute(path: string): Route {
  if (path === '/' || path === '') return HOME;
  if (path === '/codex' || path === '/codex/') return CODEX;
  const room = roomFromPath(path);
  return room ? lobby(room) : { screen: 'missing', path };
}

/** The canonical path of a route (upper-case lobby code, no trailing slash). */
export function routePath(r: Route): string {
  switch (r.screen) {
    case 'home':
      return '/';
    case 'codex':
      return '/codex';
    case 'lobby':
      return `/r/${r.room}`;
    case 'missing':
      return r.path;
  }
}

/** Same screen with the same arguments: a navigation between them changes nothing. */
export function sameRoute(a: Route, b: Route): boolean {
  return routePath(a) === routePath(b) && a.screen === b.screen;
}

const NAME = 'SLAG';

/** The document title per screen. app/ uses it for the server-rendered title too, so a soft navigation matches a fresh load. */
export function routeTitle(r: Route): string {
  if (r.screen === 'lobby') return `${NAME} · Lobby ${r.room}`;
  if (r.screen === 'codex') return `${NAME} · Codex`;
  return NAME;
}

/** Browser chrome per screen: menus scroll and zoom like pages; the game owns every pixel and gesture. */
export interface Chrome {
  width: 'device-width';
  initialScale: number;
  maximumScale?: number;
  userScalable?: boolean;
  viewportFit?: 'cover';
  themeColor: string;
}

export const PAGE_CHROME: Chrome = { width: 'device-width', initialScale: 1, themeColor: '#0e0806' };
/** No pinch or double-tap zoom, and drawn edge to edge under the notch (the renderer and touch controls inset themselves). */
export const GAME_CHROME: Chrome = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#07060b',
};

export const SCREEN_CHROME: Record<ScreenName, Chrome> = { home: PAGE_CHROME, codex: PAGE_CHROME, missing: PAGE_CHROME, lobby: GAME_CHROME };

/** A Chrome as the content of `<meta name="viewport">`, written the way Next writes it. */
export function viewportContent(c: Chrome): string {
  const parts = [`width=${c.width}`, `initial-scale=${c.initialScale}`];
  if (c.maximumScale !== undefined) parts.push(`maximum-scale=${c.maximumScale}`);
  if (c.userScalable === false) parts.push('user-scalable=no');
  if (c.viewportFit) parts.push(`viewport-fit=${c.viewportFit}`);
  return parts.join(', ');
}
