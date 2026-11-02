/** Local player profile (name), persisted to localStorage. */
export interface Profile {
  version: 1;
  /** Custom display name; null = keep the random generated one. */
  name: string | null;
  /** Whether we've asked for a name yet. */
  prompted: boolean;
  /** Seed of the character look the player last had (persisted across sessions); null = roll one. */
  look?: number | null;
}

const KEY = 'slag.profile.v1';

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Profile;
      if (p.version === 1) return p;
    }
  } catch {
    // ignore
  }
  return { version: 1, name: null, prompted: false };
}

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

/** Clean up user-entered names: printable, trimmed, ≤ 12 chars. */
export function sanitizeName(s: string): string {
  return s
    .replace(/[^\p{L}\p{N} _.\-!?']/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12);
}
