import { describe, expect, it } from 'vitest';
import { castLink, mapLink, partLink, projectileLink } from '../src/codex/links';
import { mapSections } from '../src/codex/maps';
import { partGroups } from '../src/codex/parts';
import { CAST_ORDER } from '../src/gen/character';
import { type HistoryLike, Router } from '../src/router';
import { CODEX, codexCard, HOME, parseRoute, type Route, routePath } from '../src/routes';
import { AMMO, type Ammo } from '../src/sim/props';

/**
 * Codex permalinks: every card has a link built from registry keys, a link is a path the router reads back
 * to the same card, and opening, closing, back and forward change the URL without remounting the codex.
 */

/** Every card's link, section by section as the codex lays them out (src/codex/main.ts). */
const links = (): string[] => [
  ...partGroups().flatMap((g) => g.entries.map((e) => partLink(g.id, e))),
  ...(Object.keys(AMMO) as Ammo[]).map(projectileLink),
  ...CAST_ORDER.map(castLink),
  ...mapSections().flatMap((s) => s.entries.map((e) => mapLink(s.id, e.job))),
];

describe('codex links', () => {
  const all = links();

  it('gives every card its own link, a path the router reads back to it', () => {
    expect(new Set(all).size).toBe(all.length);
    for (const l of all) {
      expect(l).toMatch(/^[a-z0-9-]+\/[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(parseRoute(routePath(codexCard(l)))).toEqual(codexCard(l));
    }
  });

  it('builds links from keys, not display names', () => {
    expect(all).toContain('cast/plumber');
    expect(all).toContain('projectiles/cannonball');
    expect(all).toContain('heads/saw');
    expect(all).toContain('items/sword');
    expect(all).toContain('attachments/ice-wall');
    expect(all).toContain('map-farm/look');
    for (const s of mapSections()) for (const e of s.entries) if (e.job.kind !== 'theme') expect(mapLink(s.id, e.job)).toContain(`/${e.job.kind}-`);
  });

  it('reads card paths case- and slash-insensitively, and an empty card is the plain codex', () => {
    expect(parseRoute('/codex/cast/plumber')).toEqual(codexCard('cast/plumber'));
    expect(parseRoute('/codex/Cast/Plumber/')).toEqual(codexCard('cast/plumber'));
    expect(parseRoute('/codex/')).toEqual(CODEX);
    expect(parseRoute('/codex/nope')).toEqual(codexCard('nope'));
    expect(routePath(CODEX)).toBe('/codex');
  });
});

/** A browser-like history with back and forward, which `memoryHistory` doesn't have. */
function stackHistory(start: string) {
  const entries = [start];
  let at = 0;
  let cb = () => {};
  const go = (d: number) => {
    at += d;
    cb();
  };
  const hist: HistoryLike = {
    get path() {
      return entries[at].split('?')[0];
    },
    get search() {
      const q = entries[at].indexOf('?');
      return q < 0 ? '' : entries[at].slice(q);
    },
    hash: '',
    push: (url) => {
      entries.length = ++at;
      entries.push(url);
    },
    replace: (url) => void (entries[at] = url),
    listen: (f) => {
      cb = f;
      return () => (cb = () => {});
    },
    hardLoad: () => {},
  };
  return { hist, entries, back: () => go(-1), forward: () => go(1), url: () => entries[at] };
}

describe('router within a screen', () => {
  it('opens and closes cards in the URL without remounting, and back/forward come to the screen', () => {
    const h = stackHistory('/codex/Cast/Plumber?seed=x');
    const shown: Route[] = [];
    const followed: Route[] = [];
    const router = new Router(h.hist, (r) => shown.push(r));
    router.start();
    expect(h.url()).toBe('/codex/cast/plumber?seed=x');
    router.followWithin((r) => followed.push(r));
    router.goWithin(CODEX);
    router.goWithin(codexCard('heads/saw'));
    router.goWithin(codexCard('heads/mace'), { replace: true });
    expect(h.entries).toEqual(['/codex/cast/plumber?seed=x', '/codex?seed=x', '/codex/heads/mace?seed=x']);
    h.back();
    h.back();
    h.forward();
    expect(followed).toEqual([CODEX, codexCard('cast/plumber'), CODEX]);
    expect(shown).toEqual([codexCard('cast/plumber')]);
    // Another screen is a real navigation, and drops the follower with the codex.
    router.go(HOME);
    h.back();
    expect(shown).toEqual([codexCard('cast/plumber'), HOME, CODEX]);
    expect(followed).toHaveLength(3);
  });

  it('remounts on back/forward when the screen takes no routes in place', () => {
    const h = stackHistory('/codex');
    const shown: Route[] = [];
    const router = new Router(h.hist, (r) => shown.push(r));
    router.start();
    router.goWithin(codexCard('cast/plumber'));
    h.back();
    expect(shown).toEqual([CODEX, CODEX]);
  });
});
