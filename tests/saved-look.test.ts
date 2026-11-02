import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadProfile, LOOK_CAST, saveProfile } from '../src/ui/profile';

function stubStorage() {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) });
  return data;
}

describe('profile', () => {
  afterEach(() => vi.unstubAllGlobals());

  // A look is a seed, and a new cast makes every old seed a different character: drop it once, keep the name.
  it('drops a look saved from an older cast, once', () => {
    const data = stubStorage();
    data.set('slag.profile.v1', JSON.stringify({ version: 1, name: 'Ada', prompted: true, look: 42 }));
    const p = loadProfile();
    expect(p.look).toBeNull();
    expect(p.name).toBe('Ada');
    saveProfile({ ...p, look: 7 });
    expect(loadProfile()).toMatchObject({ look: 7, lookCast: LOOK_CAST, name: 'Ada' });
  });
});
