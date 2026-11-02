/**
 * Match rules ("level settings"). Part of the deterministic match config:
 * online, the host's rules are authoritative. Persisted locally as the
 * host's preferences. 0 seconds = no time limit.
 *
 * More variations will land here (crate size, scoring tweaks, modifiers…).
 */
export interface MatchRules {
  targetScore: number;
  /** Pick phase limit; stragglers get a random leftover. */
  pickSeconds: number;
  /** Place phase limit; unplaced props are forfeited. */
  placeSeconds: number;
  /** Race limit; anyone still running is eliminated. */
  raceSeconds: number;
}

export const DEFAULT_RULES: MatchRules = { targetScore: 50, pickSeconds: 15, placeSeconds: 0, raceSeconds: 0 };

/** Allowed values for each rule (used by the rules menu). */
export const RULE_CHOICES: { [K in keyof MatchRules]: number[] } = {
  targetScore: [20, 30, 50, 80, 120],
  pickSeconds: [0, 10, 15, 20, 30],
  placeSeconds: [0, 15, 20, 30, 45],
  raceSeconds: [0, 30, 45, 60, 90],
};

const KEY = 'slag.rules.v1';

export function loadRules(): MatchRules {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_RULES, ...(JSON.parse(raw) as Partial<MatchRules>) };
  } catch {
    // ignore
  }
  return { ...DEFAULT_RULES };
}

export function saveRules(r: MatchRules) {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    // ignore
  }
}
