import { DEFAULT_RULES, type MatchRules, restoreRules } from '../game/rules';

/** The host's rules, kept between visits. Storage stays out of game/, which runs headless and replays identically. */
const KEY = 'slag.rules.v1';

export function loadRules(): MatchRules {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return restoreRules(JSON.parse(raw) as Partial<MatchRules>);
  } catch {
    // ignore
  }
  return { ...DEFAULT_RULES };
}

/** The host's preferences, for its next lobby: everything but Private, since every lobby starts public. */
export function saveRules(r: MatchRules) {
  try {
    const { private: _room, ...prefs } = r;
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}
