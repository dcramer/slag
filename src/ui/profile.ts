import { nameBlocked } from '../core/name-filter';
import { swatchIndex } from '../gen/character';

/** Local player profile (name, look, color), persisted to localStorage. */
export interface Profile {
  version: 1;
  /** Custom display name; null = keep the random generated one. */
  name: string | null;
  /** Whether we've asked for a name yet. */
  prompted: boolean;
  /** Seed of the character look the player last had (persisted across sessions); null = roll one. */
  look?: number | null;
  /** Which cast `look` was rolled in. A look from another cast means nothing now and is dropped. */
  lookCast?: number;
  /**
   * The swatch the player wears (PLAYER_COLORS index), kept through every new look. Absent in a profile saved
   * before swatches: that player wears their look's own rolled hue until they pick one.
   */
  color?: number;
}

/**
 * Bump when a seed stops meaning the same character, so every saved look is discarded once and the
 * next one is saved from the new cast. 2: the foundry toys. 3: slimmer toys, the lantern in for the
 * crucible. 4: twelve hand-designed toys. 5: animals and critters. 6: mostly homages (docs/CHARACTERS.md).
 */
export const LOOK_CAST = 8;

const KEY = 'slag.profile.v1';

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Profile;
      if (p.version !== 1) return fresh();
      // Saved before the name filter refused it: back to the generated name.
      const named = typeof p.name === 'string' && nameBlocked(p.name) ? { ...p, name: null } : p;
      // Storage is anyone's to edit: a color that isn't a swatch is no color.
      const { color, ...rest } = named;
      const q: Profile = swatchIndex(color) === undefined ? rest : named;
      return q.lookCast === LOOK_CAST ? q : { ...q, look: null, lookCast: LOOK_CAST };
    }
  } catch {
    // ignore
  }
  return fresh();
}

const fresh = (): Profile => ({ version: 1, name: null, prompted: false });

export function saveProfile(p: Profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...p, lookCast: LOOK_CAST }));
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
