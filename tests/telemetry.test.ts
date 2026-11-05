import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addBreadcrumb,
  installTelemetry,
  MAX_EVENTS_PER_NAME,
  MAX_LOGS_PER_MESSAGE,
  reportError,
  reportEvent,
  flushTelemetry,
  reportLog,
  setContext,
  setTag,
  setTelemetryContext,
  telemetryContext,
  telemetryScope,
  type TelemetryReporter,
} from '../src/telemetry';
import { reportGenFallback } from '../src/level-ahead';

function recorder() {
  return { error: vi.fn(), event: vi.fn(), breadcrumb: vi.fn(), log: vi.fn() } satisfies TelemetryReporter;
}

function thrower(): TelemetryReporter {
  const boom = () => {
    throw new Error('backend down');
  };
  return { error: boom, event: boom, breadcrumb: boom };
}

afterEach(() => {
  installTelemetry(null);
  setTelemetryContext(null);
  setTag('render.webgl2', undefined);
  setTag('screen', undefined);
  for (const name of ['level', 'rules', 'net']) setContext(name, null);
});

describe('telemetry', () => {
  it('is a no-op until a host installs a reporter', () => {
    expect(() => {
      reportError(new Error('x'));
      reportEvent('desync');
      addBreadcrumb('game', 'phase run');
    }).not.toThrow();
    expect(telemetryContext()).toEqual({});
  });

  it('does not replay calls made before install', () => {
    reportError(new Error('early'));
    const r = recorder();
    installTelemetry(r);
    expect(r.error).not.toHaveBeenCalled();
  });

  it('forwards reports to the installed reporter', () => {
    const r = recorder();
    installTelemetry(r);
    const err = new Error('x');
    reportError(err, { where: 'boot' });
    reportEvent('desync', 'error', { frame: 120 });
    reportEvent('host-migration');
    addBreadcrumb('game', 'phase run', { round: 2 });
    expect(r.error).toHaveBeenCalledWith(err, { where: 'boot' });
    expect(r.event).toHaveBeenCalledWith('desync', 'error', { frame: 120 }, undefined);
    expect(r.event).toHaveBeenCalledWith('host-migration', 'warning', undefined, undefined);
    expect(r.breadcrumb).toHaveBeenCalledWith('game', 'phase run', { round: 2 });
  });

  it('stops forwarding once the reporter is removed', () => {
    const r = recorder();
    installTelemetry(r);
    installTelemetry(null);
    reportError(new Error('x'));
    expect(r.error).not.toHaveBeenCalled();
  });

  it('contains a reporter that throws', () => {
    installTelemetry(thrower());
    expect(() => {
      reportError(new Error('x'));
      reportEvent('desync');
      addBreadcrumb('game', 'phase run');
    }).not.toThrow();
  });

  it('caps repeated events per name so a loop cannot burn the quota', () => {
    const r = recorder();
    installTelemetry(r);
    for (let i = 0; i < 100; i++) reportEvent('desync', 'error', { frame: i });
    reportEvent('host-migration');
    expect(r.event.mock.calls.filter(([name]) => name === 'desync')).toHaveLength(MAX_EVENTS_PER_NAME);
    expect(r.event.mock.calls.filter(([name]) => name === 'host-migration')).toHaveLength(1);
  });

  it('counts a throwing report against the cap too', () => {
    const boom = vi.fn(() => {
      throw new Error('backend down');
    });
    installTelemetry({ ...recorder(), event: boom });
    for (let i = 0; i < 100; i++) reportEvent('desync');
    expect(boom).toHaveBeenCalledTimes(MAX_EVENTS_PER_NAME);
  });

  it('reads context lazily, at report time', () => {
    const state = { phase: 'lobby', round: 0 };
    const read = vi.fn(() => ({ 'match.phase': state.phase, 'match.round': state.round }));
    setTelemetryContext(read);
    expect(read).not.toHaveBeenCalled();
    state.phase = 'run';
    state.round = 3;
    expect(telemetryContext()).toEqual({ 'match.phase': 'run', 'match.round': 3 });
  });

  it('returns empty context when the reader throws', () => {
    setTelemetryContext(() => {
      throw new Error('match not ready');
    });
    expect(telemetryContext()).toEqual({});
  });

  it('passes an event group through to the reporter, capped by name', () => {
    const r = recorder();
    installTelemetry(r);
    for (let i = 0; i < 10; i++) reportEvent('net-unavailable', 'warning', { detail: 'x' }, { group: i % 2 ? 'Cannot Reach Host' : 'WebRTC Unsupported' });
    expect(r.event).toHaveBeenCalledWith('net-unavailable', 'warning', { detail: 'x' }, { group: 'WebRTC Unsupported' });
    expect(r.event).toHaveBeenCalledTimes(MAX_EVENTS_PER_NAME);
  });

  it('sends logs to a reporter that takes them, capped per message', () => {
    const r = recorder();
    installTelemetry(r);
    for (let i = 0; i < 100; i++) reportLog('net resync', 'info', { frame: i });
    reportLog('host migration', 'warning', { ms: 4000 });
    expect(r.log).toHaveBeenCalledTimes(MAX_LOGS_PER_MESSAGE + 1);
    expect(r.log).toHaveBeenCalledWith('warning', 'host migration', { ms: 4000 });
  });

  it('drops logs quietly when the reporter has none', () => {
    const { log: _, ...noLogs } = recorder();
    installTelemetry(noLogs);
    expect(() => reportLog('net resync')).not.toThrow();
  });

  it('builds a scope from set tags, the game reader and lazy contexts', () => {
    setTag('render.webgl2', false);
    setTag('screen', 'home');
    const state = { phase: 'pick' };
    setTelemetryContext(() => ({ screen: 'lobby', 'match.phase': state.phase, players: undefined }));
    setContext('rules', { pickSeconds: 15 });
    const net = vi.fn(() => ({ role: 'host' }));
    setContext('net', net);
    expect(net).not.toHaveBeenCalled();
    state.phase = 'run';
    expect(telemetryScope()).toEqual({
      tags: { 'render.webgl2': false, screen: 'lobby', 'match.phase': 'run' },
      contexts: { rules: { pickSeconds: 15 }, net: { role: 'host' } },
    });
  });

  it('removes tags and contexts, and leaves out a context that throws', () => {
    setTag('render.webgl2', true);
    setTag('render.webgl2', undefined);
    setContext('rules', { pickSeconds: 15 });
    setContext('rules', null);
    setContext('level', () => {
      throw new Error('torn down');
    });
    setContext('net', () => undefined);
    expect(telemetryScope()).toEqual({ tags: {}, contexts: {} });
  });

  it('reports a level fallback by kind, with the request that reproduces it', () => {
    const r = recorder();
    installTelemetry(r);
    const req = { seed: 42, theme: 'farm' as const, profile: { size: 'wide' as const } };
    reportGenFallback({ fallback: false, conceptFallback: false, attempts: 3 }, req);
    expect(r.event).not.toHaveBeenCalled();
    reportGenFallback({ fallback: false, conceptFallback: true, attempts: 9 }, req);
    reportGenFallback({ fallback: true, conceptFallback: false, attempts: 50 }, { seed: 7, profile: {} });
    expect(r.event.mock.calls).toEqual([
      ['level-fallback', 'warning', { seed: 42, theme: 'farm', profile: '{"size":"wide"}', attempts: 9 }, { group: 'concept-fallback' }],
      ['level-fallback', 'error', { seed: 7, theme: 'auto', profile: '{}', attempts: 50 }, { group: 'fallback' }],
    ]);
  });
});

describe('telemetry flush', () => {
  it('asks the backend to send now, and survives one that cannot', () => {
    expect(() => flushTelemetry()).not.toThrow();
    const flush = vi.fn();
    installTelemetry({ ...recorder(), flush });
    flushTelemetry();
    expect(flush).toHaveBeenCalledOnce();
    installTelemetry({ ...thrower(), flush: () => thrower().error(null) });
    expect(() => flushTelemetry()).not.toThrow();
  });
});
