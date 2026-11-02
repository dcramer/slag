import { describe, expect, it } from 'vitest';
import { memoryHistory, Router } from '../src/router';
import { CODEX, GAME_CHROME, HOME, LOBBIES, lobby, PAGE_CHROME, parseRoute, type Route, routePath, routeTitle, viewportContent } from '../src/routes';
import { homeHTML, MENU_ITEMS, plainHTML } from '../src/ui/screens/markup';

describe('routes', () => {
  it('maps paths to screens', () => {
    expect(parseRoute('/')).toEqual(HOME);
    expect(parseRoute('/codex')).toEqual(CODEX);
    expect(parseRoute('/lobbies')).toEqual(LOBBIES);
    expect(parseRoute('/r/k7qx2')).toEqual(lobby('K7QX2'));
    expect(parseRoute('/r/!!')).toEqual({ screen: 'missing', path: '/r/!!' });
    expect(parseRoute('/nope')).toEqual({ screen: 'missing', path: '/nope' });
  });

  it('round-trips canonical paths', () => {
    for (const r of [HOME, CODEX, LOBBIES, lobby('ABCDE')]) expect(parseRoute(routePath(r))).toEqual(r);
  });

  it('titles match what the server sends', () => {
    expect(routeTitle(HOME)).toBe('SLAG');
    expect(routeTitle(lobby('ABCDE'))).toBe('SLAG · Lobby ABCDE');
    expect(routeTitle(CODEX)).toBe('SLAG · Codex');
    expect(routeTitle(LOBBIES)).toBe('SLAG · Lobbies');
  });

  it('writes viewports the way Next does', () => {
    expect(viewportContent(PAGE_CHROME)).toBe('width=device-width, initial-scale=1');
    expect(viewportContent(GAME_CHROME)).toBe('width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  });
});

describe('router', () => {
  const start = (url: string) => {
    const hist = memoryHistory(url);
    const shown: Route[] = [];
    const router = new Router(hist, (r) => shown.push(r));
    router.start();
    return { hist, shown, router };
  };

  it('shows the start screen and canonicalizes a lobby code', () => {
    const { hist, shown } = start('/r/abcde?seed=x');
    expect(shown).toEqual([lobby('ABCDE')]);
    expect(hist.entries).toEqual(['/r/ABCDE?seed=x']);
  });

  it('pushes screens and carries the query along', () => {
    const { hist, shown, router } = start('/?seed=abc&theme=farm');
    router.go(lobby('QWERT'));
    router.go(HOME);
    expect(shown).toEqual([HOME, lobby('QWERT'), HOME]);
    expect(hist.entries).toEqual(['/?seed=abc&theme=farm', '/r/QWERT?seed=abc&theme=farm', '/?seed=abc&theme=farm']);
  });

  it('replaces for redirects, and going where you are does nothing', () => {
    const { hist, shown, router } = start('/r/AAAAA');
    router.go(HOME, { replace: true });
    router.go(HOME);
    expect(shown).toEqual([lobby('AAAAA'), HOME]);
    expect(hist.entries).toEqual(['/']);
  });

  it('keeps an unknown path as it is', () => {
    const { hist, shown } = start('/r/!!');
    expect(shown).toEqual([{ screen: 'missing', path: '/r/!!' }]);
    expect(hist.entries).toEqual(['/r/!!']);
  });
});

describe('screen markup', () => {
  it('is deterministic, so a server render and a client render agree', () => {
    expect(homeHTML()).toBe(homeHTML());
  });

  it('has every menu item, the first one active, disabled until the screen listens', () => {
    const html = homeHTML();
    for (const it of MENU_ITEMS) expect(html).toContain(`data-id="${it.id}"`);
    expect(html.match(/data-active="true"/g)).toHaveLength(1);
    expect(html.match(/ disabled>/g)).toHaveLength(MENU_ITEMS.length);
    expect(plainHTML('missing')).toContain('Lost in the Slag');
  });
});
