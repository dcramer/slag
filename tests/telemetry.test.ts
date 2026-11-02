import { afterEach, describe, expect, it, vi } from 'vitest';
import { addBreadcrumb, installTelemetry, reportError, reportEvent, setTelemetryContext, telemetryContext, type TelemetryReporter } from '../src/telemetry';

function recorder() {
  return { error: vi.fn(), event: vi.fn(), breadcrumb: vi.fn() } satisfies TelemetryReporter;
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
    expect(r.event).toHaveBeenCalledWith('desync', 'error', { frame: 120 });
    expect(r.event).toHaveBeenCalledWith('host-migration', 'warning', undefined);
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
    expect(r.event.mock.calls.filter(([name]) => name === 'desync')).toHaveLength(20);
    expect(r.event.mock.calls.filter(([name]) => name === 'host-migration')).toHaveLength(1);
  });

  it('counts a throwing report against the cap too', () => {
    const boom = vi.fn(() => {
      throw new Error('backend down');
    });
    installTelemetry({ ...recorder(), event: boom });
    for (let i = 0; i < 100; i++) reportEvent('desync');
    expect(boom).toHaveBeenCalledTimes(20);
  });

  it('reads context lazily, at report time', () => {
    const state = { phase: 'lobby', round: 0 };
    const read = vi.fn(() => ({ ...state }));
    setTelemetryContext(read);
    expect(read).not.toHaveBeenCalled();
    state.phase = 'run';
    state.round = 3;
    expect(telemetryContext()).toEqual({ phase: 'run', round: 3 });
  });

  it('returns empty context when the reader throws', () => {
    setTelemetryContext(() => {
      throw new Error('match not ready');
    });
    expect(telemetryContext()).toEqual({});
  });
});
