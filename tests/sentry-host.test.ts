import type { ErrorEvent } from '@sentry/browser';
import { describe, expect, it } from 'vitest';
import { REPORT_EVERY_MS, StoreFailureThrottle, storeStatus } from '../app/api/net/_server/report';
import { StoreError } from '../app/api/net/_server/store';
import {
  type BatteryLike,
  clientOf,
  EventBudget,
  eventFingerprint,
  keepBreadcrumb,
  MAX_EVENTS_PER_PAGE,
  metricAttributes,
  noiseReason,
  stampScope,
  watchPower,
} from '../app/sentry-filter';
import { serverTraceRate } from '../app/sentry-options';

const ORIGIN = 'https://slag.example';
const here = { origin: ORIGIN, leaving: false };
const leaving = { origin: ORIGIN, leaving: true };

function thrown(type: string, value: string, files: string[] = [`${ORIGIN}/_next/static/chunks/game.js`]): ErrorEvent {
  return { type: undefined, exception: { values: [{ type, value, stacktrace: { frames: files.map((filename) => ({ filename })) } }] } };
}

describe('sentry noise filter', () => {
  it('keeps the game’s own errors', () => {
    expect(noiseReason(thrown('TypeError', "Cannot read properties of undefined (reading 'x')"), here)).toBeNull();
    expect(noiseReason({ type: undefined, message: 'desync' }, here)).toBeNull();
  });

  it('drops errors with an extension frame anywhere in the stack', () => {
    const ev = thrown('TypeError', 'x is not a function', [`${ORIGIN}/_next/static/chunks/game.js`, 'chrome-extension://abcdef/content.js']);
    expect(noiseReason(ev, here)).toBe('extension');
    expect(noiseReason(thrown('Error', 'boom', ['moz-extension://1234/inject.js']), here)).toBe('extension');
  });

  it('drops errors whose frames are all from other origins, but not ours mixed with theirs', () => {
    expect(noiseReason(thrown('Error', 'ad failed', ['https://ads.example/tag.js']), here)).toBe('third-party');
    expect(noiseReason(thrown('Error', 'boom', ['https://ads.example/tag.js', `${ORIGIN}/_next/static/chunks/main.js`]), here)).toBeNull();
    // Our worker's blob URL and frames without a file are ours.
    expect(noiseReason(thrown('Error', 'boom', [`blob:${ORIGIN}/1f2e`, '<anonymous>']), here)).toBeNull();
  });

  it('drops the old ResizeObserver loop wording', () => {
    expect(noiseReason(thrown('Error', 'ResizeObserver loop limit exceeded', []), here)).toBe('resize-observer');
  });

  it('drops network and chunk failures only while the page is being left', () => {
    for (const [type, value] of [
      ['TypeError', 'Failed to fetch'],
      ['TypeError', 'Load failed'],
      ['TypeError', 'Failed to fetch dynamically imported module: https://slag.example/_next/static/chunks/abc.js'],
      ['AbortError', 'The user aborted a request.'],
    ]) {
      expect(noiseReason(thrown(type, value), leaving)).toBe('page-leave');
      expect(noiseReason(thrown(type, value), here)).toBeNull();
    }
  });
});

describe('sentry event shaping', () => {
  it('stamps the game scope under what the event already carries', () => {
    const ev: ErrorEvent = { type: undefined, tags: { boundary: 'screen', screen: 'codex' }, contexts: { details: { where: 'boot' } } };
    stampScope(ev, { tags: { screen: 'lobby', 'match.phase': 'run', players: undefined }, contexts: { rules: { pickSeconds: 15 } } });
    expect(ev.tags).toEqual({ screen: 'codex', 'match.phase': 'run', boundary: 'screen' });
    expect(ev.contexts).toEqual({ rules: { pickSeconds: 15 }, details: { where: 'boot' } });
  });

  it('slices metrics by the game’s tags, never per room, and lets the metric’s own phase win', () => {
    const tags = { room: 'ABCD', 'level.seed': 42, 'match.round': 3, 'match.phase': 'score', 'device.class': 'phone' as const, players: undefined };
    expect(metricAttributes(tags, { 'match.phase': 'run' })).toEqual({ 'match.phase': 'run', 'device.class': 'phone' });
  });

  it('names the browser family, major version and OS from real user agents', () => {
    const cases: [string, number, string, string | undefined, string][] = [
      ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', 0, 'chrome', '131', 'windows'],
      [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
        0,
        'edge',
        '131',
        'windows',
      ],
      ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15', 0, 'safari', '18', 'macos'],
      ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15', 5, 'safari', '18', 'ios'],
      [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
        5,
        'safari',
        '18',
        'ios',
      ],
      [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',
        5,
        'chrome',
        '131',
        'ios',
      ],
      [
        'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36',
        5,
        'samsung',
        '26',
        'android',
      ],
      ['Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0', 0, 'firefox', '133', 'linux'],
      ['Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', 0, 'chrome', '131', 'chromeos'],
      ['curl/8.0', 0, 'other', undefined, 'other'],
    ];
    for (const [ua, touch, browser, version, os] of cases)
      expect(clientOf(ua, touch), ua).toEqual({ 'browser.name': browser, 'browser.version': version, 'os.name': os });
  });

  it('follows whether the device is on battery, and stays unknown where it can’t tell', async () => {
    const seen: string[] = [];
    let change = () => {};
    const battery: BatteryLike = { charging: false, addEventListener: (_t, l) => (change = l) };
    await watchPower({ getBattery: async () => battery }, (p) => seen.push(p));
    battery.charging = true;
    change();
    expect(seen).toEqual(['battery', 'plugged']);
    await watchPower({}, (p) => seen.push(p));
    await watchPower({ getBattery: () => Promise.reject(new Error('NotAllowedError')) }, (p) => seen.push(p));
    expect(seen).toHaveLength(2);
  });

  it('puts the browser under the game’s tags on a metric', () => {
    const client = { 'browser.name': 'chrome', 'browser.version': '131', 'os.name': 'macos' };
    expect(metricAttributes({ 'device.class': 'desktop' }, { 'match.phase': 'run' }, client)).toEqual({
      ...client,
      'device.class': 'desktop',
      'match.phase': 'run',
    });
  });

  it('caps a page’s events', () => {
    const b = new EventBudget();
    let sent = 0;
    for (let i = 0; i < 100; i++) if (b.take()) sent++;
    expect(sent).toBe(MAX_EVENTS_PER_PAGE);
  });

  it('groups events by name and cause, never by anything else', () => {
    expect(eventFingerprint('desync')).toEqual(['slag-event', 'desync']);
    expect(eventFingerprint('net-unavailable', 'Cannot Reach Host')).toEqual(['slag-event', 'net-unavailable', 'Cannot Reach Host']);
  });

  it('keeps the trail free of signaling polls but not of their failures', () => {
    const fetch = (url: string, status_code: number) => ({ category: 'fetch', data: { url, status_code } });
    expect(keepBreadcrumb(fetch('/api/net/poll', 200))).toBe(false);
    expect(keepBreadcrumb(fetch('https://slag.example/api/net/beat', 200))).toBe(false);
    expect(keepBreadcrumb(fetch('/api/net/poll', 503))).toBe(true);
    expect(keepBreadcrumb(fetch('/textures/grass.png', 200))).toBe(true);
    expect(keepBreadcrumb({ category: 'console', message: '[net] link reconnecting' })).toBe(false);
    expect(keepBreadcrumb({ category: 'console', message: 'WebGL compositor failed' })).toBe(true);
    expect(keepBreadcrumb({ category: 'net', message: 'link reconnecting' })).toBe(true);
  });
});

describe('server telemetry', () => {
  it('traces only the signaling routes, at a rate per environment', () => {
    expect(serverTraceRate({ name: 'POST /api/net/[op]' }, 'production')).toBe(0.01);
    expect(serverTraceRate({ name: 'POST', attributes: { 'http.target': '/api/net/poll' } }, 'preview')).toBe(0.1);
    expect(serverTraceRate({ normalizedRequest: { url: 'http://localhost:3000/api/net/join' } }, 'local')).toBe(1);
    expect(serverTraceRate({ name: 'GET /r/[code]' }, 'production')).toBe(0);
    expect(serverTraceRate({ name: 'POST /api/net/[op]' }, 'development')).toBe(0);
  });

  it('names a store failure by what the store said', () => {
    expect(storeStatus(new StoreError('store responded 429', 429))).toBe('429');
    expect(storeStatus(new StoreError('store rejected a command'))).toBe('rejected');
    expect(storeStatus(new TypeError('fetch failed'))).toBe('network');
  });

  it('reports a store failure once a minute with the op, the status and what it held back', () => {
    let t = 0;
    const th = new StoreFailureThrottle(() => t);
    const first = th.next(new StoreError('store responded 429', 429), 'poll');
    expect(first).toEqual({ tags: { area: 'signal-store', op: 'poll', 'store.status': '429' }, fingerprint: ['signal-store', '429'], suppressed: 0 });
    for (let i = 0; i < 10; i++) expect(th.next(new StoreError('x', 429), 'beat')).toBeNull();
    t = REPORT_EVERY_MS;
    const next = th.next(new TypeError('fetch failed'), 'join');
    expect(next?.suppressed).toBe(10);
    expect(next?.tags['store.status']).toBe('network');
    expect(JSON.stringify(next)).not.toMatch(/room|peer/);
  });
});
