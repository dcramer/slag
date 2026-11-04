import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleOp } from '../app/api/net/_server/handlers';
import { MemoryStore } from '../app/api/net/_server/store';
import { Match } from '../src/game/match';
import { roomSeed } from '../src/game/room';
import { connectRoom } from '../src/net/client';
import { loadResume } from '../src/net/identity';

class Mem {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

const store = new MemoryStore();
let joinDelay = 0;

beforeEach(() => {
  joinDelay = 0;
  vi.useFakeTimers({ now: 1_000_000 });
  vi.stubGlobal('localStorage', new Mem());
  vi.stubGlobal('sessionStorage', new Mem());
  vi.stubGlobal('location', { search: '', origin: 'http://x' });
  vi.stubGlobal('addEventListener', () => {});
  vi.stubGlobal('document', { hidden: false, addEventListener: () => {} });
  vi.stubGlobal('RTCPeerConnection', function RTCPeerConnection() {});
  vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
    const op = url.split('/').pop() as Parameters<typeof handleOp>[0];
    if (op === 'join' && joinDelay) await new Promise((r) => setTimeout(r, joinDelay));
    const out = await handleOp(op, JSON.parse(init.body), { store, ice: [] });
    return { ok: true, json: async () => out } as unknown as Response;
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const opts = { primaryDevice: () => 'kb1', params: new URLSearchParams(), onRejoin: () => {}, onRestored: () => {} };

/**
 * The page side of a room (connectRoom) over the real handlers: fetch is a direct call into them and the clock is
 * fake. RTCPeerConnection exists but nobody else is in the room, so this page hosts alone.
 */
describe('the resume save', () => {
  it("a refresh whose join takes over a second still resumes the previous visit's save", async () => {
    // Visit 1: alone in the room, plays a while, refreshes.
    const m1 = new Match(roomSeed('ROOMA'));
    const c1 = connectRoom('ROOMA', m1, opts);
    await vi.advanceTimersByTimeAsync(500);
    expect(c1.net.isHost).toBe(true);
    for (let i = 0; i < 600; i++) c1.net.tick({});
    const frame = m1.frame;
    c1.close();
    expect(loadResume('ROOMA', Date.now() + 1)?.snap).toBeTruthy();
    // Visit 2: a cold function takes 1.5 s to answer the join.
    joinDelay = 1500;
    await vi.advanceTimersByTimeAsync(100);
    const m2 = new Match(roomSeed('ROOMA'));
    const c2 = connectRoom('ROOMA', m2, opts);
    await vi.advanceTimersByTimeAsync(3000);
    expect(c2.net.isHost).toBe(true);
    expect(m2.frame).toBeGreaterThanOrEqual(frame);
    c2.close();
  });

  it('a page that never got into the room saves nothing over the last good save', async () => {
    const m1 = new Match(roomSeed('ROOMB'));
    const c1 = connectRoom('ROOMB', m1, opts);
    await vi.advanceTimersByTimeAsync(500);
    for (let i = 0; i < 600; i++) c1.net.tick({});
    c1.close();
    const saved = loadResume('ROOMB', Date.now() + 1)!.snap;
    // The API is gone for good: this page ends up on its own, unavailable, and must not save its empty lobby.
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 503, json: async () => ({ error: 'unconfigured' }) }) as unknown as Response);
    const c2 = connectRoom('ROOMB', new Match(roomSeed('ROOMB')), opts);
    await vi.advanceTimersByTimeAsync(5000);
    expect(c2.net.status).toBe('unavailable');
    c2.close();
    expect(loadResume('ROOMB', Date.now() + 1)!.snap.frame).toBe(saved.frame);
  });
});
